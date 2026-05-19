create extension if not exists pgcrypto;

create table if not exists public.shoot_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  album_id uuid references public.albums(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  shoot_type text not null,
  location text,
  message text,
  preferred_start_at timestamp not null,
  preferred_end_at timestamp not null,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'accepted', 'declined', 'archived')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address inet,
  constraint shoot_requests_time_order
    check (preferred_end_at > preferred_start_at)
);

create index if not exists shoot_requests_created_at_idx
  on public.shoot_requests(created_at desc);

create index if not exists shoot_requests_status_idx
  on public.shoot_requests(status);

create index if not exists shoot_requests_time_idx
  on public.shoot_requests(preferred_start_at, preferred_end_at);

alter table public.shoot_requests enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shoot_requests'
      and policyname = 'Admins can manage shoot requests'
  ) then
    create policy "Admins can manage shoot requests"
      on public.shoot_requests for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shoot_requests_no_accepted_overlap'
      and conrelid = 'public.shoot_requests'::regclass
  ) then
    alter table public.shoot_requests
      add constraint shoot_requests_no_accepted_overlap
      exclude using gist (
        tsrange(preferred_start_at, preferred_end_at, '[)') with &&
      )
      where (status = 'accepted');
  end if;
end $$;
