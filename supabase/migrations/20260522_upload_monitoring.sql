alter table public.photos
  add column if not exists thumbnail_size_bytes bigint,
  add column if not exists preview_size_bytes bigint,
  add column if not exists full_size_bytes bigint,
  add column if not exists file_size_bytes bigint,
  add column if not exists generated_thumbnail boolean not null default false,
  add column if not exists generated_preview boolean not null default false;

create table if not exists public.upload_events (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references public.albums(id) on delete set null,
  photo_id uuid references public.photos(id) on delete set null,
  filename text,
  event_type text not null default 'photo'
    check (event_type in ('photo', 'zip', 'diagnostic', 'cleanup')),
  status text not null
    check (status in ('success', 'failed', 'partial')),
  message text,
  size_bytes bigint not null default 0,
  duration_ms integer,
  created_at timestamptz not null default now(),
  ip_address text
);

create index if not exists upload_events_created_at_idx
  on public.upload_events(created_at desc);

create index if not exists upload_events_album_created_idx
  on public.upload_events(album_id, created_at desc);

create index if not exists upload_events_status_created_idx
  on public.upload_events(status, created_at desc);

alter table public.upload_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'upload_events'
      and policyname = 'Admins can manage upload events'
  ) then
    create policy "Admins can manage upload events"
      on public.upload_events for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;
