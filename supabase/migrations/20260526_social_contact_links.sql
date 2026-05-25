alter table public.site_contact_settings
  add column if not exists facebook_handle text,
  add column if not exists facebook_url text,
  add column if not exists custom_links jsonb not null default '[]'::jsonb;

update public.site_contact_settings
set custom_links = '[]'::jsonb
where custom_links is null;
