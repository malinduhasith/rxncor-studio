create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  email_type text not null,
  recipient text,
  subject text not null,
  status text not null
    check (status in ('sent', 'failed', 'skipped')),
  provider text not null default 'resend',
  provider_status integer,
  message text,
  album_id uuid references public.albums(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  related_type text,
  related_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_events_created_at_idx
  on public.email_events(created_at desc);

create index if not exists email_events_status_created_idx
  on public.email_events(status, created_at desc);

create index if not exists email_events_album_created_idx
  on public.email_events(album_id, created_at desc);

create index if not exists email_events_type_created_idx
  on public.email_events(email_type, created_at desc);

alter table public.email_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'email_events'
      and policyname = 'Admins can manage email events'
  ) then
    create policy "Admins can manage email events"
      on public.email_events for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;
