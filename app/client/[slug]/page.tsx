import { LockKeyhole } from "lucide-react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { unlockGalleryAction } from "./actions";
import { featuredAlbums } from "@/lib/sample-data";
import { GalleryLightbox, type GalleryDisplayPhoto } from "@/components/gallery/GalleryLightbox";
import { PhotoTile } from "@/components/PhotoTile";
import { albumAccessCookieName, hasAlbumAccess } from "@/lib/gallery-access";
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
  password_hash: string | null;
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
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function ClientGalleryPage({
  params,
  searchParams
}: ClientGalleryPageProps) {
  const { slug } = await params;
  const { notice } = await searchParams;
  const supabase = createSupabaseAdminClient();
  const viewerSupabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await viewerSupabase.auth.getUser();
  const { data: dbAlbum } = await supabase
    .from("albums")
    .select(
      "id, title, slug, event_date, is_public, is_password_protected, password_hash, expires_at, download_zip_url"
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

  const cookieStore = await cookies();
  const hasUnlockedAlbum = album
    ? hasAlbumAccess(
        album.id,
        album.password_hash,
        cookieStore.get(albumAccessCookieName(album.id))?.value
      )
    : false;
  const canViewPhotos =
    Boolean(user) || !album?.is_password_protected || hasUnlockedAlbum;
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
  const isProtected = Boolean(album?.is_password_protected);
  const galleryLabel = album?.is_public ? "Public Gallery" : "Private Gallery";
  const photoSummary = album
    ? canViewPhotos
      ? `${displayPhotos.length} photos`
      : "Password required"
    : `${fallbackAlbum?.count ?? 0} photos`;
  const zipObjectKey = album?.download_zip_url
    ? objectKeyFromPublicUrl(album.download_zip_url)
    : null;
  const galleryPhotos: GalleryDisplayPhoto[] = displayPhotos.map((photo) => ({
    id: photo.id,
    filename: photo.filename,
    thumbnailDisplayUrl: photo.thumbnailDisplayUrl,
    previewDisplayUrl: photo.previewDisplayUrl,
    r2ObjectKey: photo.r2_object_key
  }));

  return (
    <main className="shell section">
      <div className="gallery-bar">
        <div>
          <p className="eyebrow">{galleryLabel}</p>
          <h1 style={{ fontSize: "clamp(2.8rem, 8vw, 6rem)" }}>{title}</h1>
          <p className="muted">
            {photoSummary}
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
        </div>
      </div>

      {isProtected && !canViewPhotos ? (
        <section className="gallery-gate" style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: "1.7rem" }}>Password protection</h2>
          <p className="form-note">Enter the gallery password to view and download this album.</p>
          {notice === "wrong-password" ? (
            <p className="alert">That password did not match. Try again.</p>
          ) : null}
          <form action={unlockGalleryAction}>
            <input name="album_id" type="hidden" value={album.id} />
            <input name="slug" type="hidden" value={album.slug} />
            <label className="field">
              Gallery password
              <input type="password" name="password" required />
            </label>
            <button className="button" type="submit">
              Unlock gallery
            </button>
          </form>
        </section>
      ) : null}

      {album && canViewPhotos ? (
        <GalleryLightbox
          albumId={album.id}
          photos={galleryPhotos}
          zipObjectKey={zipObjectKey}
        />
      ) : null}
      <div className="lightbox-grid">
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
