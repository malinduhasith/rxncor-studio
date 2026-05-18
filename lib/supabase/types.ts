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
