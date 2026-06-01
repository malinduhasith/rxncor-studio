import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getPublicPortfolioPhotos } from "@/lib/public-gallery";
import { portfolioItems } from "@/lib/sample-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Selected photography work from rxncor.studio."
};

type PortfolioCard = {
  id: string;
  title: string;
  meta: string;
  detail?: string;
  eyebrow?: string;
  imageUrl?: string | null;
  colors?: string[];
};

function portfolioFallbackCards(): PortfolioCard[] {
  return portfolioItems.map((item) => ({
    id: item.title,
    title: item.title,
    meta: item.location,
    detail: "Portfolio study",
    eyebrow: "Selected direction",
    imageUrl: null,
    colors: item.colors
  }));
}

function PortfolioImage({ item, loading }: { item: PortfolioCard; loading: "eager" | "lazy" }) {
  if (item.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="portfolio-card-img"
        src={item.imageUrl}
        alt={`${item.title} from ${item.meta}`}
        loading={loading}
        decoding="async"
      />
    );
  }

  return (
    <div
      className="portfolio-card-fill"
      style={{
        "--portfolio-fill-a": item.colors?.[0] ?? "#713d2f",
        "--portfolio-fill-b": item.colors?.[1] ?? "#d8b35f"
      } as CSSProperties}
    />
  );
}

export default async function PortfolioPage() {
  const realPhotos = await getPublicPortfolioPhotos(14);
  const portfolioCards: PortfolioCard[] = realPhotos.length
    ? realPhotos
    : portfolioFallbackCards();
  const leadCard = portfolioCards[0];
  const secondaryCards = portfolioCards.slice(1, 4);

  return (
    <main className="shell section editorial-page portfolio-page">
      {leadCard ? (
        <>
          <section className="portfolio-hero-board" aria-labelledby="portfolio-title">
            <div className="portfolio-hero-copy">
              <div className="section-head numbered compact" data-index="01">
                <div>
                  <p className="eyebrow">Portfolio</p>
                  <h1 className="page-title" id="portfolio-title">
                    A tighter edit of people, light, and story.
                  </h1>
                </div>
              </div>
              <p className="portfolio-hero-note">
                Chosen frames from shoots and public albums: portraits, movement,
                atmosphere, and the small in-between moments that make a set feel
                alive.
              </p>
              <div className="portfolio-hero-meta" aria-label="Portfolio summary">
                <span>Melbourne</span>
                <span>People / Event / Story</span>
                <span>{portfolioCards.length} selected frames</span>
              </div>
            </div>
            <article className="portfolio-lead-card">
              <div className="portfolio-lead-media">
                <PortfolioImage item={leadCard} loading="eager" />
              </div>
              <div className="portfolio-lead-caption">
                <span>Lead frame</span>
                <strong>{leadCard.meta}</strong>
                <p>{leadCard.title}</p>
              </div>
            </article>
          </section>

          <section className="portfolio-contact-sheet" aria-label="Portfolio contact sheet">
            <div className="portfolio-contact-copy">
              <span className="label">Current direction</span>
              <p>
                The edit favours honest faces, real light, movement, texture, and
                frames that feel like they were lived through.
              </p>
            </div>
            {secondaryCards.map((item, index) => (
              <article className="portfolio-mini-frame" key={item.id}>
                <PortfolioImage item={item} loading={index === 0 ? "eager" : "lazy"} />
                <span>{String(index + 2).padStart(2, "0")}</span>
              </article>
            ))}
          </section>

          <section className="portfolio-card-wall" aria-label="Curated portfolio cards">
            {portfolioCards.map((item, index) => (
              <article
                className={[
                  "portfolio-project-card",
                  index % 5 === 0 ? "is-featured" : "",
                  index % 4 === 2 ? "is-tall" : ""
                ].filter(Boolean).join(" ")}
                key={item.id}
              >
                <div className="portfolio-card-media">
                  <PortfolioImage item={item} loading={index < 5 ? "eager" : "lazy"} />
                </div>
                <div className="portfolio-card-body">
                  <div className="portfolio-card-topline">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <small>{item.detail ?? "Selected frame"}</small>
                  </div>
                  <h2>{item.meta}</h2>
                  <p>{item.title}</p>
                  <dl>
                    <div>
                      <dt>Type</dt>
                      <dd>{item.eyebrow ?? "Portfolio frame"}</dd>
                    </div>
                    <div>
                      <dt>Use</dt>
                      <dd>Portfolio edit</dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </section>
        </>
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
