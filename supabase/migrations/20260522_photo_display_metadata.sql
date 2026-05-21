alter table public.photos
  add column if not exists display_title text,
  add column if not exists caption text,
  add column if not exists camera_model text,
  add column if not exists lens_model text,
  add column if not exists focal_length text,
  add column if not exists aperture text,
  add column if not exists shutter_speed text,
  add column if not exists iso text,
  add column if not exists captured_at timestamptz,
  add column if not exists location text;
