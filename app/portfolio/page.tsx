import type { Metadata } from "next";
import Image from "next/image";
import type { CSSProperties } from "react";
import { PublicPageHero } from "@/components/public/PublicPageHero";
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

function PortfolioImage({
  item,
  loading = "lazy",
  sizes = "(max-width: 760px) 100vw, 50vw"
}: {
  item: PortfolioCard;
  loading?: "eager" | "lazy";
  sizes?: string;
}) {
  if (item.imageUrl) {
    return (
      <Image
        alt={`${item.title} from ${item.meta}`}
        className="portfolio-card-img"
        fill
        loading={loading}
        sizes={sizes}
        src={item.imageUrl}
        unoptimized
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
  const realPhotos = await getPublicPortfolioPhotos(18).catch(() => []);
  const portfolioCards: PortfolioCard[] = realPhotos.length
    ? realPhotos
    : portfolioFallbackCards();
  const leadCard = portfolioCards[0];
  const secondaryCards = portfolioCards.slice(1, 4);

  return (
    <main className="rx-page rx-portfolio-page">
      <PublicPageHero
        description="A living edit of people, movement, machines, light, atmosphere, and the split seconds that make a story feel real."
        eyebrow="Selected photography"
        index="PORTFOLIO / 02"
        meta={["Melbourne / Australia", `${portfolioCards.length} selected frames`, "Portrait / Event / Automotive"]}
        title="THE WORK."
        tone="dark"
      />

      {leadCard ? (
        <>
          <section className="rx-portfolio-lead">
            <div className="rx-section-kicker" data-reveal>
              <span>Lead frame / 01</span>
              <span>{leadCard.meta}</span>
            </div>
            <div className="rx-portfolio-lead-grid" data-reveal>
              <div className="rx-portfolio-lead-copy">
                <span>{leadCard.eyebrow ?? "Selected direction"}</span>
                <h2>{leadCard.title}</h2>
                <p>
                  Honest faces, real light, movement, texture, and frames that
                  feel like they were lived through.
                </p>
              </div>
              <figure className="rx-portfolio-lead-image">
                <PortfolioImage item={leadCard} loading="eager" sizes="(max-width: 760px) 100vw, 64vw" />
                <figcaption>01 / RXNCOR / {leadCard.meta}</figcaption>
              </figure>
            </div>
          </section>

          <section className="rx-portfolio-strip" aria-label="Portfolio contact sheet">
            <div className="rx-portfolio-strip-copy">
              <span>Current direction</span>
              <strong>PEOPLE.<br />MOTION.<br />ATMOSPHERE.</strong>
            </div>
            {secondaryCards.map((item, index) => (
              <figure key={item.id}>
                <PortfolioImage item={item} loading={index === 0 ? "eager" : "lazy"} sizes="(max-width: 760px) 70vw, 25vw" />
                <figcaption>{String(index + 2).padStart(2, "0")} / {item.title}</figcaption>
              </figure>
            ))}
          </section>

          <section className="rx-portfolio-wall">
            <div className="rx-section-kicker" data-reveal>
              <span>The edit / 02</span>
              <span>Every frame earns its place</span>
            </div>
            <div className="rx-portfolio-grid" data-reveal>
              {portfolioCards.map((item, index) => (
                <article
                  className={[
                    "rx-portfolio-card",
                    index % 7 === 0 ? "is-wide" : "",
                    index % 5 === 2 ? "is-tall" : ""
                  ].filter(Boolean).join(" ")}
                  key={item.id}
                >
                  <div className="rx-portfolio-card-media">
                    <PortfolioImage
                      item={item}
                      loading={index < 5 ? "eager" : "lazy"}
                      sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 25vw"
                    />
                  </div>
                  <div className="rx-portfolio-card-caption">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.meta} / {item.detail ?? "Selected frame"}</small>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="rx-empty-state">
          <span>Portfolio / Empty</span>
          <h2>SELECT FRAMES<br />IN ADMIN.</h2>
          <p>Chosen album photos will appear here automatically.</p>
        </section>
      )}
    </main>
  );
}
