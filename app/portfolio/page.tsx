import { PhotoTile } from "@/components/PhotoTile";
import { portfolioItems } from "@/lib/sample-data";

export default function PortfolioPage() {
  return (
    <main className="shell section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1 style={{ fontSize: "clamp(3rem, 9vw, 7rem)" }}>Selected work</h1>
        </div>
        <p>
          Replace these generated color studies with real exported WebP previews
          from R2 once the first album is ready.
        </p>
      </div>
      <div className="grid">
        {portfolioItems.map((item) => (
          <PhotoTile
            key={item.title}
            title={item.title}
            meta={item.location}
            colors={item.colors}
          />
        ))}
      </div>
    </main>
  );
}
