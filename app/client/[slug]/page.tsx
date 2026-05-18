import { LockKeyhole } from "lucide-react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { unlockGalleryAction } from "./actions";
import { featuredAlbums } from "@/lib/sample-data";
import { GalleryLightbox, type GalleryDisplayPhoto } from "@/components/gallery/GalleryLightbox";
import { PhotoTile } from "@/components/PhotoTile";
import {
  albumAccessCookieName,
  albumClientEmailCookieName,
  createAlbumAccessToken,
  createEmailAccessToken
} from "@/lib/gallery-access";
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
  requires_email?: boolean;
  allow_client_password_access?: boolean;
  expires_at: string | null;
  download_zip_url: string | null;
};

type GalleryClient = {
  id: string;
  email: string | null;
  password_hash?: string | null;
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
    .select("*")
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
  const clientEmail = album
    ? cookieStore.get(albumClientEmailCookieName(album.id))?.value ?? null
    : null;
  const accessCookie = album
    ? cookieStore.get(albumAccessCookieName(album.id))?.value
    : undefined;
  let hasUnlockedAlbum = false;

  if (album && accessCookie) {
    const possibleTokens = [
      album.password_hash ? createAlbumAccessToken(album.id, album.password_hash) : null,
      clientEmail && album.requires_email
        ? createEmailAccessToken(album.id, clientEmail)
        : null
    ];

    if (clientEmail && album.allow_client_password_access !== false) {
      const { data: assignments } = await supabase
        .from("album_clients")
        .select("client_id")
        .eq("album_id", album.id);
      const assignedClientIds = (assignments ?? []).map((row) => row.client_id);
      const { data: client } = assignedClientIds.length
        ? await supabase
            .from("clients")
            .select("*")
            .in("id", assignedClientIds)
            .eq("email", clientEmail)
            .maybeSingle()
        : { data: null };
      const galleryClient = client as GalleryClient | null;

      if (galleryClient?.password_hash) {
        possibleTokens.push(
          createAlbumAccessToken(
            album.id,
            `client:${galleryClient.id}:${galleryClient.password_hash}`
          )
        );
      }
    }

    hasUnlockedAlbum = possibleTokens.includes(accessCookie);
  }

  const requiresUnlock = Boolean(album?.is_password_protected || album?.requires_email);
  const canViewPhotos =
    Boolean(user) || !requiresUnlock || hasUnlockedAlbum;
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
  const isProtected = requiresUnlock;
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

      {album && isProtected && !canViewPhotos ? (
        <section className="gallery-gate" style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: "1.7rem" }}>Password protection</h2>
          <p className="form-note">
            {album?.is_password_protected
              ? "Enter the album password, or use your client email and personal client password if one was assigned."
              : "Enter your email to view and download this album."}
          </p>
          {notice === "wrong-password" ? (
            <p className="alert">That password did not match. Try again.</p>
          ) : null}
          {notice === "email-required" ? (
            <p className="alert">Enter your email before opening this gallery.</p>
          ) : null}
          <form action={unlockGalleryAction}>
            <input name="album_id" type="hidden" value={album.id} />
            <input name="slug" type="hidden" value={album.slug} />
            <label className="field">
              Email
              <input
                name="client_email"
                type="email"
                placeholder="you@example.com"
                required={Boolean(album?.requires_email)}
              />
            </label>
            {album?.is_password_protected ? (
              <label className="field">
                Gallery or client password
                <input type="password" name="password" required />
              </label>
            ) : null}
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
          clientEmail={clientEmail}
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
