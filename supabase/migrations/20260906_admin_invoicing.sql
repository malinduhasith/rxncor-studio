create table if not exists public.invoice_settings (
  id text primary key default 'main' check (id = 'main'), business_name text not null default 'RXNCOR Studio', issuer_name text not null default 'Malindu Herath',
  email text, phone text, address text, abn text, pay_id text, bank_name text, account_name text, bsb text, account_number text,
  currency text not null default 'AUD', invoice_prefix text not null default 'RX',
  next_invoice_number integer not null default 1 check (next_invoice_number > 0), default_due_days integer not null default 14,
  default_gst_rate numeric(5,2) not null default 0, default_notes text, updated_at timestamptz not null default now()
);
insert into public.invoice_settings(id) values ('main') on conflict (id) do nothing;
create table if not exists public.client_rates (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id) on delete cascade, service_name text not null,
  category text not null, work_context text not null default 'Any', unit text not null default 'hour', rate_cents integer not null check (rate_cents >= 0),
  is_active boolean not null default true, sort_order integer not null default 100, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(), public_token uuid not null unique default gen_random_uuid(), invoice_number text not null unique,
  client_id uuid references public.clients(id) on delete set null, client_name text not null, client_email text not null, client_phone text, client_address text,
  project_title text, issue_date date not null default current_date, due_date date not null, status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  notes text, terms text, issuer_snapshot jsonb not null default '{}'::jsonb, payment_snapshot jsonb not null default '{}'::jsonb,
  subtotal_cents integer not null default 0, gst_rate numeric(5,2) not null default 0, gst_cents integer not null default 0, total_cents integer not null default 0,
  sent_at timestamptz, paid_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade, description text not null,
  category text not null, work_context text not null default 'Any', quantity numeric(10,2) not null check (quantity > 0), unit text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0), line_total_cents integer not null check (line_total_cents >= 0), sort_order integer not null default 0
);
create index if not exists invoices_status_due_idx on public.invoices(status, due_date desc);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id, sort_order);
create index if not exists client_rates_client_idx on public.client_rates(client_id, is_active, sort_order);
alter table public.invoice_settings enable row level security;
alter table public.client_rates enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
do $$ declare t text; begin
  foreach t in array array['invoice_settings','client_rates','invoices','invoice_items'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='Authenticated admins can manage invoices') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', 'Authenticated admins can manage invoices', t);
    end if;
  end loop;
end $$;
create or replace function public.allocate_invoice_number() returns text language plpgsql security definer set search_path = public as $$
declare n integer; prefix text;
begin
  update public.invoice_settings set next_invoice_number=next_invoice_number+1, updated_at=now() where id='main'
  returning next_invoice_number-1, invoice_prefix into n, prefix;
  return prefix || '-' || to_char(current_date,'YYYY') || '-' || lpad(n::text,4,'0');
end $$;
revoke all on function public.allocate_invoice_number() from public, anon, authenticated;
grant execute on function public.allocate_invoice_number() to service_role;
