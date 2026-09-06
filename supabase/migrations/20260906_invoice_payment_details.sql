alter table public.invoice_settings add column if not exists bank_name text;
alter table public.invoice_settings add column if not exists account_name text;
alter table public.invoice_settings add column if not exists bsb text;
alter table public.invoice_settings add column if not exists account_number text;
