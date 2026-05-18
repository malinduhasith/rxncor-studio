import { PhotoTile } from "@/components/PhotoTile";
import { getPublicPortfolioPhotos } from "@/lib/public-gallery";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const realPhotos = await getPublicPortfolioPhotos(12);
  const portfolioTiles = realPhotos.map((photo) => (
    <PhotoTile
      key={photo.id}
      title={photo.title}
      meta={photo.meta}
      imageUrl={photo.imageUrl}
    />
  ));

  return (
    <main className="shell section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1 style={{ fontSize: "clamp(3rem, 9vw, 7rem)" }}>Selected work</h1>
        </div>
        <p>
          A rotating selection from public client albums and featured studio work.
        </p>
      </div>
      {portfolioTiles.length ? (
        <div className="grid">{portfolioTiles}</div>
      ) : (
        <div className="form-panel">
          <p className="eyebrow">Portfolio Empty</p>
          <h2>Choose photos in admin</h2>
          <p className="form-note">
            Select photos in the album manager to publish them here. Public album
            photos will also appear when available.
          </p>
        </div>
      )}
    </main>
  );
}
