import { Download, LockKeyhole } from "lucide-react";
import { notFound } from "next/navigation";
import { featuredAlbums } from "@/lib/sample-data";
import { PhotoTile } from "@/components/PhotoTile";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type GalleryAlbum = {
  id: string;
  title: string;
  slug: string;
  event_date: string | null;
  is_public: boolean;
  is_password_protected: boolean;
  expires_at: string | null;
  download_zip_url: string | null;
};

type GalleryPhoto = {
  id: string;
  filename: string;
  thumbnail_url: string;
  preview_url: string;
  full_res_url: string;
  r2_object_key: string;
};

type DisplayPhoto = GalleryPhoto & {
  thumbnailDisplayUrl: string;
  previewDisplayUrl: string;
};

type ClientGalleryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ClientGalleryPage({ params }: ClientGalleryPageProps) {
  const { slug } = await params;
  const supabase = createSupabaseAdminClient();
  const viewerSupabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await viewerSupabase.auth.getUser();
  const { data: dbAlbum } = await supabase
    .from("albums")
    .select(
      "id, title, slug, event_date, is_public, is_password_protected, expires_at, download_zip_url"
    )
    .eq("slug", slug)
    .maybeSingle();
  const fallbackAlbum = featuredAlbums.find((item) => item.slug === slug);
  const album = dbAlbum as GalleryAlbum | null;

  if (!album && !fallbackAlbum) {
    notFound();
  }

  if (album?.expires_at && new Date(album.expires_at) < new Date()) {
    notFound();
  }

  const canViewPhotos =
    Boolean(user) || Boolean(album?.is_public) || !album?.is_password_protected;
  const { data: dbPhotos } =
    album && canViewPhotos
      ? await supabase
          .from("photos")
          .select(
            "id, filename, thumbnail_url, preview_url, full_res_url, r2_object_key"
          )
          .eq("album_id", album.id)
          .order("uploaded_at", { ascending: true })
      : { data: [] };
  const photos = (dbPhotos ?? []) as GalleryPhoto[];
  const displayPhotos: DisplayPhoto[] = await Promise.all(
    photos.map(async (photo) => {
      const thumbnailKey = objectKeyFromPublicUrl(photo.thumbnail_url);
      const previewKey = objectKeyFromPublicUrl(photo.preview_url);

      return {
        ...photo,
        thumbnailDisplayUrl: await createDownloadUrl(thumbnailKey),
        previewDisplayUrl: await createDownloadUrl(previewKey)
      };
    })
  );
  const title = album?.title ?? fallbackAlbum?.title ?? "";
  const photoCount = album ? displayPhotos.length : fallbackAlbum?.count ?? 0;
  const isProtected = Boolean(album?.is_password_protected);

  return (
    <main className="shell section">
      <div className="gallery-bar">
        <div>
          <p className="eyebrow">Private Gallery</p>
          <h1 style={{ fontSize: "clamp(2.8rem, 8vw, 6rem)" }}>{title}</h1>
          <p className="muted">
            {photoCount} photos
            {album?.event_date ? ` · ${album.event_date}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isProtected ? (
            <button className="button secondary" type="button">
              <LockKeyhole size={18} />
              Protected
            </button>
          ) : null}
          {album?.download_zip_url ? (
            <a className="button" href={album.download_zip_url}>
              <Download size={18} />
              Download ZIP
            </a>
          ) : (
            <button className="button" type="button" disabled>
              <Download size={18} />
              Download ZIP
            </button>
          )}
        </div>
      </div>

      {isProtected && !canViewPhotos ? (
        <section className="gallery-gate" style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: "1.7rem" }}>Password protection</h2>
          <p className="form-note">Enter the gallery password to view this album.</p>
          <form>
            <label className="field">
              Gallery password
              <input type="password" name="password" />
            </label>
            <button className="button" type="submit">
              Unlock gallery
            </button>
          </form>
        </section>
      ) : null}

      <div className="lightbox-grid">
        {displayPhotos.map((photo) => (
          <a className="photo-tile" href={photo.previewDisplayUrl} key={photo.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="photo-img"
              src={photo.thumbnailDisplayUrl}
              alt={photo.filename}
            />
            <div className="tile-caption">
              <strong>{photo.filename}</strong>
              <span>Open</span>
            </div>
          </a>
        ))}
        {!album && fallbackAlbum
          ? Array.from({ length: 12 }, (_, index) => (
              <PhotoTile
                key={index}
                title={`Image ${String(index + 1).padStart(3, "0")}`}
                meta="Preview"
                colors={
                  index % 2 === 0 ? ["#31566f", "#d8b35f"] : ["#713d2f", "#d7cbc0"]
                }
              />
            ))
          : null}
      </div>
      {album && canViewPhotos && !photos.length ? (
        <p className="muted">No photos uploaded yet.</p>
      ) : null}
    </main>
  );
}
