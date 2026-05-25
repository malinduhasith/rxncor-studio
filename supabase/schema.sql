create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  slug text not null unique,
  event_date date,
  is_public boolean not null default false,
  is_password_protected boolean not null default true,
  password_hash text,
  requires_email boolean not null default false,
  allow_client_password_access boolean not null default true,
  cover_photo_url text,
  download_zip_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.album_clients (
  album_id uuid not null references public.albums(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (album_id, client_id)
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  filename text not null,
  thumbnail_url text not null,
  preview_url text not null,
  full_res_url text not null,
  r2_object_key text not null,
  display_title text,
  caption text,
  camera_model text,
  lens_model text,
  focal_length text,
  aperture text,
  shutter_speed text,
  iso text,
  captured_at timestamptz,
  location text,
  thumbnail_size_bytes bigint,
  preview_size_bytes bigint,
  full_size_bytes bigint,
  file_size_bytes bigint,
  generated_thumbnail boolean not null default false,
  generated_preview boolean not null default false,
  is_selected boolean not null default false,
  uploaded_at timestamptz not null default now()
);

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

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

create table if not exists public.site_contact_settings (
  id text primary key default 'main',
  contact_email text not null default 'hello@rxncor.studio',
  contact_phone text,
  location text not null default 'Melbourne, Australia',
  instagram_handle text not null default '@MR.Rxncor',
  instagram_url text not null default 'https://www.instagram.com/mr.rxncor',
  threads_handle text,
  threads_url text,
  linkedin_handle text,
  linkedin_url text,
  youtube_handle text,
  youtube_url text,
  updated_at timestamptz not null default now(),
  constraint site_contact_settings_singleton check (id = 'main')
);

create table if not exists public.download_logs (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete set null,
  client_email text,
  downloaded_at timestamptz not null default now(),
  ip_address inet
);

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'replied', 'archived')),
  created_at timestamptz not null default now(),
  ip_address inet
);

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

create index if not exists albums_slug_idx on public.albums(slug);
create unique index if not exists clients_email_lower_unique_idx
  on public.clients (lower(email))
  where email is not null;
create index if not exists album_clients_album_id_idx on public.album_clients(album_id);
create index if not exists album_clients_client_id_idx on public.album_clients(client_id);
create index if not exists photos_album_id_idx on public.photos(album_id);
create index if not exists upload_events_created_at_idx
  on public.upload_events(created_at desc);
create index if not exists upload_events_album_created_idx
  on public.upload_events(album_id, created_at desc);
create index if not exists upload_events_status_created_idx
  on public.upload_events(status, created_at desc);
create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_entity_idx
  on public.admin_audit_logs(entity_type, entity_id, created_at desc);
create index if not exists email_events_created_at_idx
  on public.email_events(created_at desc);
create index if not exists email_events_status_created_idx
  on public.email_events(status, created_at desc);
create index if not exists email_events_album_created_idx
  on public.email_events(album_id, created_at desc);
create index if not exists email_events_type_created_idx
  on public.email_events(email_type, created_at desc);
create index if not exists download_logs_photo_id_idx on public.download_logs(photo_id);
create index if not exists download_logs_album_id_idx on public.download_logs(album_id);
create index if not exists contact_inquiries_created_at_idx
  on public.contact_inquiries(created_at desc);
create index if not exists contact_inquiries_status_idx
  on public.contact_inquiries(status);
create index if not exists shoot_requests_created_at_idx
  on public.shoot_requests(created_at desc);
create index if not exists shoot_requests_status_idx
  on public.shoot_requests(status);
create index if not exists shoot_requests_time_idx
  on public.shoot_requests(preferred_start_at, preferred_end_at);

alter table public.clients enable row level security;
alter table public.albums enable row level security;
alter table public.album_clients enable row level security;
alter table public.photos enable row level security;
alter table public.download_logs enable row level security;
alter table public.upload_events enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.email_events enable row level security;
alter table public.site_contact_settings enable row level security;
alter table public.contact_inquiries enable row level security;
alter table public.shoot_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'albums'
      and policyname = 'Public albums are readable'
  ) then
    create policy "Public albums are readable"
      on public.albums for select
      using (is_public = true);
  end if;
end $$;

create table if not exists public.about_page_settings (
  id text primary key default 'main',
  hero_label text not null default 'About / Malindu Herath',
  hero_title text not null,
  intro text not null,
  closing text not null,
  meta_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.about_page_blocks (
  id uuid primary key default gen_random_uuid(),
  section text not null default 'intro_cards'
    check (section in ('intro_cards', 'banners', 'spoken', 'timeline', 'tools')),
  kind text not null default 'card'
    check (kind in ('card', 'banner', 'spoken', 'timeline', 'tool')),
  label text,
  title text not null,
  body text,
  reference text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists about_page_blocks_section_sort_idx
  on public.about_page_blocks(section, sort_order, created_at);

alter table public.about_page_settings enable row level security;
alter table public.about_page_blocks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'about_page_settings'
      and policyname = 'Admins can manage about page settings'
  ) then
    create policy "Admins can manage about page settings"
      on public.about_page_settings for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'site_contact_settings'
      and policyname = 'Admins can manage site contact settings'
  ) then
    create policy "Admins can manage site contact settings"
      on public.site_contact_settings for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_logs'
      and policyname = 'Admins can manage audit logs'
  ) then
    create policy "Admins can manage audit logs"
      on public.admin_audit_logs for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'about_page_blocks'
      and policyname = 'Admins can manage about page blocks'
  ) then
    create policy "Admins can manage about page blocks"
      on public.about_page_blocks for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'Public photos are readable through public albums'
  ) then
    create policy "Public photos are readable through public albums"
      on public.photos for select
      using (
        exists (
          select 1 from public.albums
          where albums.id = photos.album_id
          and albums.is_public = true
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clients'
      and policyname = 'Admins can manage clients'
  ) then
    create policy "Admins can manage clients"
      on public.clients for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'albums'
      and policyname = 'Admins can manage albums'
  ) then
    create policy "Admins can manage albums"
      on public.albums for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'album_clients'
      and policyname = 'Admins can manage album clients'
  ) then
    create policy "Admins can manage album clients"
      on public.album_clients for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'Admins can manage photos'
  ) then
    create policy "Admins can manage photos"
      on public.photos for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'download_logs'
      and policyname = 'Admins can read download logs'
  ) then
    create policy "Admins can read download logs"
      on public.download_logs for select
      using (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'download_logs'
      and policyname = 'Downloads can be logged by app'
  ) then
    create policy "Downloads can be logged by app"
      on public.download_logs for insert
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contact_inquiries'
      and policyname = 'Admins can manage contact inquiries'
  ) then
    create policy "Admins can manage contact inquiries"
      on public.contact_inquiries for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;
