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
