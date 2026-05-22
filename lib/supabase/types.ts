export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  created_at: string;
};

export type Album = {
  id: string;
  client_id: string | null;
  title: string;
  slug: string;
  event_date: string | null;
  is_public: boolean;
  is_password_protected: boolean;
  password_hash: string | null;
  requires_email: boolean;
  allow_client_password_access: boolean;
  cover_photo_url: string | null;
  created_at: string;
  expires_at: string | null;
  download_zip_url: string | null;
};

export type AlbumClient = {
  album_id: string;
  client_id: string;
  created_at: string;
};

export type Photo = {
  id: string;
  album_id: string;
  filename: string;
  thumbnail_url: string;
  preview_url: string;
  full_res_url: string;
  r2_object_key: string;
  display_title: string | null;
  caption: string | null;
  camera_model: string | null;
  lens_model: string | null;
  focal_length: string | null;
  aperture: string | null;
  shutter_speed: string | null;
  iso: string | null;
  captured_at: string | null;
  location: string | null;
  thumbnail_size_bytes: number | null;
  preview_size_bytes: number | null;
  full_size_bytes: number | null;
  file_size_bytes: number | null;
  generated_thumbnail: boolean;
  generated_preview: boolean;
  is_selected: boolean;
  uploaded_at: string;
};

export type ContactInquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "new" | "replied" | "archived";
  created_at: string;
  ip_address: string | null;
};

export type ShootRequest = {
  id: string;
  client_id: string | null;
  album_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  shoot_type: string;
  location: string | null;
  message: string | null;
  preferred_start_at: string;
  preferred_end_at: string;
  status: "new" | "reviewing" | "accepted" | "declined" | "archived";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  ip_address: string | null;
};

export type AboutPageSettings = {
  id: string;
  hero_label: string;
  hero_title: string;
  intro: string;
  closing: string;
  meta_items: Array<[string, string]>;
  updated_at: string;
};

export type AboutPageBlock = {
  id: string;
  section: "intro_cards" | "banners" | "spoken" | "timeline" | "tools";
  kind: "card" | "banner" | "spoken" | "timeline" | "tool";
  label: string | null;
  title: string;
  body: string | null;
  reference: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type EmailEvent = {
  id: string;
  email_type: string;
  recipient: string | null;
  subject: string;
  status: "sent" | "failed" | "skipped";
  provider: string;
  provider_status: number | null;
  message: string | null;
  album_id: string | null;
  client_id: string | null;
  related_type: string | null;
  related_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
