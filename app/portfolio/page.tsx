import { PhotoTile } from "@/components/PhotoTile";
import { getPublicPortfolioPhotos } from "@/lib/public-gallery";
import { portfolioItems } from "@/lib/sample-data";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const realPhotos = await getPublicPortfolioPhotos(12);
  const portfolioTiles = realPhotos.length
    ? realPhotos.map((photo) => (
        <PhotoTile
          key={photo.id}
          title={photo.title}
          meta={photo.meta}
          imageUrl={photo.imageUrl}
        />
      ))
    : portfolioItems.map((item) => (
        <PhotoTile
          key={item.title}
          title={item.title}
          meta={item.location}
          colors={item.colors}
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
      <div className="grid">{portfolioTiles}</div>
    </main>
  );
}
