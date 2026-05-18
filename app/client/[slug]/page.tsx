import { Download, LockKeyhole } from "lucide-react";
import { notFound } from "next/navigation";
import { featuredAlbums } from "@/lib/sample-data";
import { PhotoTile } from "@/components/PhotoTile";

const galleryPhotos = Array.from({ length: 12 }, (_, index) => ({
  title: `Image ${String(index + 1).padStart(3, "0")}`,
  meta: "Preview",
  colors: index % 2 === 0 ? ["#31566f", "#d8b35f"] : ["#713d2f", "#d7cbc0"]
}));

type ClientGalleryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ClientGalleryPage({ params }: ClientGalleryPageProps) {
  const { slug } = await params;
  const album = featuredAlbums.find((item) => item.slug === slug);

  if (!album) {
    notFound();
  }

  return (
    <main className="shell section">
      <div className="gallery-bar">
        <div>
          <p className="eyebrow">Private Gallery</p>
          <h1 style={{ fontSize: "clamp(2.8rem, 8vw, 6rem)" }}>{album.title}</h1>
          <p className="muted">
            {album.count} photos · expires when the Supabase album expiry date is reached
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="button secondary" type="button">
            <LockKeyhole size={18} />
            Protected
          </button>
          <button className="button" type="button">
            <Download size={18} />
            Download ZIP
          </button>
        </div>
      </div>

      <section className="gallery-gate" style={{ marginBottom: 26 }}>
        <h2 style={{ fontSize: "1.7rem" }}>Password protection</h2>
        <p className="form-note">
          The MVP should check this password against the album password_hash in
          Supabase before returning photo metadata or signed download URLs.
        </p>
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

      <div className="lightbox-grid">
        {galleryPhotos.map((photo) => (
          <PhotoTile
            key={photo.title}
            title={photo.title}
            meta={photo.meta}
            colors={photo.colors}
          />
        ))}
      </div>
    </main>
  );
}
