-- Shared across all server instances. No raw IPs, messages, or emails stored here.
create table public.public_form_limits (
  bucket_key text primary key,
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null
);
create index public_form_limits_expiry_idx on public.public_form_limits (expires_at);
alter table public.public_form_limits enable row level security;
revoke all on public.public_form_limits from public, anon, authenticated;
grant select, insert, update, delete on public.public_form_limits to service_role;

create function public.claim_public_form_submission(p_ip_hash text, p_email_hash text, p_duplicate_hash text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry record;
  claimed boolean;
  at_time timestamptz := clock_timestamp();
begin
  if p_ip_hash is null or p_email_hash is null or p_duplicate_hash is null
    or p_ip_hash !~ '^[a-f0-9]{64}$' or p_email_hash !~ '^[a-f0-9]{64}$'
    or p_duplicate_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid form guard key';
  end if;

  -- Bounded cleanup; never remove enquiries or other business records.
  delete from public.public_form_limits where bucket_key in (
    select bucket_key from public.public_form_limits where expires_at < at_time
    order by expires_at limit 100 for update skip locked
  );

  -- Identical lock order for concurrent requests. The upsert is atomic.
  for entry in select * from (values
    ('d:' || p_duplicate_hash, 1, 600),
    ('e:' || p_email_hash, 3, 3600),
    ('i:' || p_ip_hash, 5, 3600)
  ) as limits(key, max_count, seconds) order by key loop
    claimed := false;
    insert into public.public_form_limits as bucket (bucket_key, attempts, expires_at)
    values (entry.key, 1, at_time + make_interval(secs => entry.seconds))
    on conflict (bucket_key) do update set
      attempts = case when bucket.expires_at <= at_time then 1 else bucket.attempts + 1 end,
      expires_at = case when bucket.expires_at <= at_time then excluded.expires_at else bucket.expires_at end
    where bucket.expires_at <= at_time or bucket.attempts < entry.max_count
    returning true into claimed;
    if not coalesce(claimed, false) then
      return case when left(entry.key,2) = 'd:' then 'duplicate' else 'rate-limited' end;
    end if;
  end loop;
  return 'allowed';
end;
$$;
revoke all on function public.claim_public_form_submission(text,text,text) from public, anon, authenticated;
grant execute on function public.claim_public_form_submission(text,text,text) to service_role;
