import type { Metadata } from "next";
import { PhotoTile } from "@/components/PhotoTile";
import { getPublicPortfolioPhotos } from "@/lib/public-gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Selected photography work from rxncor.studio."
};

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
    <main className="shell section editorial-page">
      <div className="section-head numbered" data-index="01">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1 className="page-title">Selected work</h1>
        </div>
        <p>
          A rotating selection from public client albums and featured studio work.
        </p>
      </div>
      {portfolioTiles.length ? (
        <div className="grid portfolio-gallery-grid">{portfolioTiles}</div>
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
