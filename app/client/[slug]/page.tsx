import { LockKeyhole } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unlockGalleryAction } from "./actions";
import { NoticeToaster } from "@/components/Notice";
import { siteConfig } from "@/config/site";
import { featuredAlbums } from "@/lib/sample-data";
import { GalleryLightbox, type GalleryDisplayPhoto } from "@/components/gallery/GalleryLightbox";
import { PhotoTile } from "@/components/PhotoTile";
import {
  albumRequiresUnlock,
  getGalleryAccessForCookies
} from "@/lib/gallery-security";
import { galleryNotices } from "@/lib/notices";
import { photoDisplayLabel, type PhotoDisplaySource } from "@/lib/photo-display";
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

type GalleryPhoto = {
  id: string;
  filename: string;
  thumbnail_url: string;
  r2_object_key: string;
} & PhotoDisplaySource;

type DisplayPhoto = GalleryPhoto & {
  thumbnailDisplayUrl: string;
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
    return (
      <main className="shell section">
        <div className="form-panel">
          <p className="eyebrow">Gallery Expired</p>
          <h1 className="page-title">{album.title}</h1>
          <p className="form-note">
            This gallery expired on {album.expires_at.slice(0, 10)}. Contact
            rxncor.studio if you need the gallery reopened or the ZIP resent.
          </p>
          <div className="inline-actions">
            <a className="button" href={`mailto:${siteConfig.contactEmail}`}>
              Contact
            </a>
            <Link className="button secondary" href={siteConfig.routes.login}>
              Client login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const cookieStore = await cookies();
  const galleryAccess = album
    ? await getGalleryAccessForCookies({
        supabase,
        album,
        cookieStore,
        adminBypass: Boolean(user)
      })
    : { canAccess: false, clientEmail: null };
  const requiresUnlock = album ? albumRequiresUnlock(album) : false;
  const canViewPhotos =
    Boolean(user) || !requiresUnlock || galleryAccess.canAccess;
  const photoBaseSelect = "id, filename, thumbnail_url, r2_object_key";
  const photoMetadataSelect = `${photoBaseSelect}, display_title, caption, camera_model, lens_model, focal_length, aperture, shutter_speed, iso, captured_at, location`;
  const { data: dbPhotos } =
    album && canViewPhotos
      ? await (async () => {
          const metadataResult = await supabase
            .from("photos")
            .select(photoMetadataSelect)
            .eq("album_id", album.id)
            .order("uploaded_at", { ascending: true });

          if (!metadataResult.error) {
            return metadataResult;
          }

          return supabase
            .from("photos")
            .select(photoBaseSelect)
            .eq("album_id", album.id)
            .order("uploaded_at", { ascending: true });
        })()
      : { data: [] };
  const photos = (dbPhotos ?? []) as GalleryPhoto[];
  const displayPhotos: DisplayPhoto[] = await Promise.all(
    photos.map(async (photo) => {
      const thumbnailKey = objectKeyFromPublicUrl(photo.thumbnail_url);

      return {
        ...photo,
        thumbnailDisplayUrl: await createDownloadUrl(thumbnailKey)
      };
    })
  );
  const title = album?.title ?? fallbackAlbum?.title ?? "";
  const isProtected = requiresUnlock;
  const galleryLabel = album?.is_public ? "Public Gallery" : "Private Gallery";
  const canUseClientPassword =
    Boolean(album) && album?.allow_client_password_access !== false;
  const needsClientEmail =
    Boolean(album?.requires_email) ||
    Boolean(album && !album.is_password_protected && canUseClientPassword);
  const needsPassword =
    Boolean(album?.is_password_protected) ||
    Boolean(album && !album.is_password_protected && canUseClientPassword);
  const photoSummary = album
    ? canViewPhotos
      ? `${displayPhotos.length} photos`
      : "Password required"
    : `${fallbackAlbum?.count ?? 0} photos`;
  const zipObjectKey = album?.download_zip_url
    ? objectKeyFromPublicUrl(album.download_zip_url)
    : null;
  const galleryPhotos: GalleryDisplayPhoto[] = displayPhotos.map((photo, index) => {
    const label = photoDisplayLabel(photo, {
      albumTitle: title,
      eventDate: album?.event_date,
      index
    });

    return {
      id: photo.id,
      filename: label.filename,
      title: label.title,
      eyebrow: label.eyebrow,
      detail: label.detail,
      thumbnailDisplayUrl: photo.thumbnailDisplayUrl,
      r2ObjectKey: photo.r2_object_key
    };
  });
  const galleryNotice = notice ? galleryNotices[notice] : undefined;

  return (
    <main className="shell section gallery-page">
      <NoticeToaster cleanupQueryKeys={["notice"]} notices={[galleryNotice]} />
      <div className="gallery-bar">
        <div>
          <p className="eyebrow">{galleryLabel}</p>
          <h1 className="page-title gallery-title">{title}</h1>
          <p className="muted">
            {photoSummary}
            {album?.event_date ? ` · ${album.event_date}` : ""}
          </p>
        </div>
        <div className="gallery-inline-actions">
          {isProtected ? (
            <button className="button secondary" type="button">
              <LockKeyhole size={18} />
              Protected
            </button>
          ) : null}
        </div>
      </div>

      {album && canViewPhotos && displayPhotos.length ? (
        <section className="client-delivery-summary" aria-label="Gallery delivery status">
          <div>
            <span className="label">Photo set</span>
            <strong>{displayPhotos.length} files ready</strong>
            <small>Open any frame for preview and single-photo download.</small>
          </div>
          <div>
            <span className="label">Full ZIP</span>
            <strong>{zipObjectKey ? "Attached" : "Not attached yet"}</strong>
            <small>
              {zipObjectKey
                ? "Use the ZIP button in the lightbox toolbar."
                : "The final archive will appear here when it is delivered."}
            </small>
          </div>
          <div>
            <span className="label">Access</span>
            <strong>{isProtected ? "Protected" : "Open link"}</strong>
            <small>
              {galleryAccess.clientEmail
                ? `Unlocked for ${galleryAccess.clientEmail}.`
                : "Keep this gallery link private."}
            </small>
          </div>
          <div>
            <span className="label">Expiry</span>
            <strong>{album.expires_at ? album.expires_at.slice(0, 10) : "No expiry"}</strong>
            <small>Ask for reopening if you need more time.</small>
          </div>
        </section>
      ) : null}

      {album && canViewPhotos && displayPhotos.length ? (
        <section className="album-hero-collage" aria-label="Album preview collage">
          <div className="collage-copy">
            <span className="label">Album view</span>
            <p>
              Browse previews, open the lightbox, download selected frames, or
              collect the delivered ZIP when it is attached.
            </p>
          </div>
          <div className="collage-stack">
            {displayPhotos.slice(0, 5).map((photo, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.thumbnailDisplayUrl}
                alt={`${title} preview ${index + 1}`}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            ))}
          </div>
        </section>
      ) : null}

      {album && isProtected && !canViewPhotos ? (
        <section className="gallery-gate">
          <h2 className="gate-title">Password protection</h2>
          <p className="form-note">
            {album?.is_password_protected
              ? "Enter the album password, or use your client email and personal client password if one was assigned."
              : canUseClientPassword
                ? "Use your client email and personal client password to view and download this album."
                : "Enter your email to view and download this album."}
          </p>
          <div className="access-options">
            {album?.is_password_protected ? (
              <div>
                <strong>Gallery password</strong>
                <span>Use the shared album password. Email is optional unless requested.</span>
              </div>
            ) : null}
            {canUseClientPassword ? (
              <div>
                <strong>Client login</strong>
                <span>Enter your client email and personal password to unlock assigned galleries.</span>
              </div>
            ) : null}
            {!album?.is_password_protected && !canUseClientPassword ? (
              <div>
                <strong>Access not ready</strong>
                <span>This private gallery needs an album password or assigned client access.</span>
              </div>
            ) : null}
          </div>
          <form action={unlockGalleryAction}>
            <input name="album_id" type="hidden" value={album.id} />
            <input name="slug" type="hidden" value={album.slug} />
            <label className="field">
              Email
              <input
                name="client_email"
                type="email"
                placeholder="you@example.com"
                required={needsClientEmail}
              />
            </label>
            {needsPassword ? (
              <label className="field">
                {album?.is_password_protected ? "Gallery or client password" : "Client password"}
                <input type="password" name="password" required />
              </label>
            ) : null}
            <button className="button" type="submit" disabled={!needsPassword && !needsClientEmail}>
              Unlock gallery
            </button>
          </form>
        </section>
      ) : null}

      {album && canViewPhotos ? (
        <GalleryLightbox
          albumId={album.id}
          albumTitle={title}
          photos={galleryPhotos}
          zipObjectKey={zipObjectKey}
          clientEmail={galleryAccess.clientEmail}
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
