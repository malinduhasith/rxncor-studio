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

create policy "Admins can manage contact inquiries"
  on public.contact_inquiries for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
