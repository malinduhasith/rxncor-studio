create unique index if not exists clients_email_lower_unique_idx
  on public.clients (lower(email))
  where email is not null;

create index if not exists download_logs_photo_id_idx
  on public.download_logs(photo_id);
