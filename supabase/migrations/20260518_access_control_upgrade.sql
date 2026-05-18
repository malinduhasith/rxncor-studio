alter table public.clients
  add column if not exists password_hash text;

alter table public.albums
  add column if not exists requires_email boolean not null default false,
  add column if not exists allow_client_password_access boolean not null default true;

create table if not exists public.album_clients (
  album_id uuid not null references public.albums(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (album_id, client_id)
);

insert into public.album_clients (album_id, client_id)
select id, client_id
from public.albums
where client_id is not null
on conflict do nothing;

create index if not exists album_clients_album_id_idx
  on public.album_clients(album_id);

create index if not exists album_clients_client_id_idx
  on public.album_clients(client_id);

alter table public.album_clients enable row level security;

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
end
$$;
