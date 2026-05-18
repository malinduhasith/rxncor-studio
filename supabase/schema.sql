create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
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
  cover_photo_url text,
  download_zip_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
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

create index if not exists albums_slug_idx on public.albums(slug);
create index if not exists photos_album_id_idx on public.photos(album_id);
create index if not exists download_logs_album_id_idx on public.download_logs(album_id);

alter table public.clients enable row level security;
alter table public.albums enable row level security;
alter table public.photos enable row level security;
alter table public.download_logs enable row level security;

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
