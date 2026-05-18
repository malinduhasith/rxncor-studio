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
  is_selected boolean not null default false,
  uploaded_at timestamptz not null default now()
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

create index if not exists albums_slug_idx on public.albums(slug);
create unique index if not exists clients_email_lower_unique_idx
  on public.clients (lower(email))
  where email is not null;
create index if not exists album_clients_album_id_idx on public.album_clients(album_id);
create index if not exists album_clients_client_id_idx on public.album_clients(client_id);
create index if not exists photos_album_id_idx on public.photos(album_id);
create index if not exists download_logs_photo_id_idx on public.download_logs(photo_id);
create index if not exists download_logs_album_id_idx on public.download_logs(album_id);
create index if not exists contact_inquiries_created_at_idx
  on public.contact_inquiries(created_at desc);
create index if not exists contact_inquiries_status_idx
  on public.contact_inquiries(status);

alter table public.clients enable row level security;
alter table public.albums enable row level security;
alter table public.album_clients enable row level security;
alter table public.photos enable row level security;
alter table public.download_logs enable row level security;
alter table public.contact_inquiries enable row level security;

create policy "Public albums are readable"
  on public.albums for select
  using (is_public = true);

create policy "Public photos are readable through public albums"
  on public.photos for select
  using (
    exists (
      select 1 from public.albums
      where albums.id = photos.album_id
      and albums.is_public = true
    )
  );

create policy "Admins can manage clients"
  on public.clients for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Admins can manage albums"
  on public.albums for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Admins can manage album clients"
  on public.album_clients for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Admins can manage photos"
  on public.photos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Admins can read download logs"
  on public.download_logs for select
  using (auth.role() = 'authenticated');

create policy "Downloads can be logged by app"
  on public.download_logs for insert
  with check (true);

create policy "Admins can manage contact inquiries"
  on public.contact_inquiries for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
