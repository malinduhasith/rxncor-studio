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

alter table public.site_contact_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
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

insert into public.site_contact_settings (
  id,
  contact_email,
  contact_phone,
  location,
  instagram_handle,
  instagram_url,
  threads_handle,
  threads_url,
  linkedin_handle,
  linkedin_url,
  youtube_handle,
  youtube_url
)
values (
  'main',
  'hello@rxncor.studio',
  null,
  'Melbourne, Australia',
  '@MR.Rxncor',
  'https://www.instagram.com/mr.rxncor',
  null,
  null,
  null,
  null,
  null,
  null
)
on conflict (id) do nothing;
