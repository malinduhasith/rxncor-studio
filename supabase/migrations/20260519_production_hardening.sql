create unique index if not exists clients_email_lower_unique_idx
  on public.clients (lower(email))
  where email is not null;

create index if not exists download_logs_photo_id_idx
  on public.download_logs(photo_id);

create extension if not exists pgcrypto;

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

create index if not exists contact_inquiries_created_at_idx
  on public.contact_inquiries(created_at desc);

create index if not exists contact_inquiries_status_idx
  on public.contact_inquiries(status);

alter table public.contact_inquiries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
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
