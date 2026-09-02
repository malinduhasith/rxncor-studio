import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicPageHero } from "@/components/public/PublicPageHero";
import { siteConfig } from "@/config/site";
import { blockReferenceItems, getAboutPageContent } from "@/lib/about-builder";
import { getPublicPortfolioPhotos } from "@/lib/public-gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Malindu Herath",
  description:
    "About Malindu Herath, a Melbourne-based Sri Lankan photographer building rxncor.studio around portraits, events, street moments, and client galleries."
};

type AboutImageProps = {
  image?: { imageUrl: string | null; title: string; meta: string };
  index: number;
};

function AboutImage({ image, index }: AboutImageProps) {
  return (
    <figure className={`rx-about-image rx-about-image-${index + 1}`}>
      {image?.imageUrl ? (
        <Image
          alt={`${image.title} from ${image.meta}`}
          fill
          sizes="(max-width: 760px) 72vw, 34vw"
          src={image.imageUrl}
          unoptimized
        />
      ) : (
        <div className="rx-image-fallback" aria-hidden="true" />
      )}
      <figcaption>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span>{image?.title ?? "RXNCOR visual study"}</span>
      </figcaption>
    </figure>
  );
}

export default async function AboutPage() {
  const [portfolioPhotos, aboutContent] = await Promise.all([
    getPublicPortfolioPhotos(4).catch(() => []),
    getAboutPageContent()
  ]);
  const introCards = aboutContent.blocks.filter((block) => block.section === "intro_cards");
  const bannerBlocks = aboutContent.blocks.filter((block) => block.section === "banners");
  const spokenBlocks = aboutContent.blocks.filter((block) => block.section === "spoken");
  const timelineBlocks = aboutContent.blocks.filter((block) => block.section === "timeline");
  const toolBlocks = aboutContent.blocks.filter((block) => block.section === "tools");

  return (
    <main className="rx-page rx-about-page">
      <PublicPageHero
        description={aboutContent.settings.intro}
        eyebrow={aboutContent.settings.heroLabel}
        index="ABOUT / 01"
        meta={aboutContent.settings.metaItems.slice(0, 3).map(([label, value]) => `${label} / ${value}`)}
        title={aboutContent.settings.heroTitle}
      />

      <section className="rx-about-collage" aria-label="Selected visual direction">
        <div className="rx-section-kicker" data-reveal>
          <span>Selected perspective</span>
          <span>Melbourne / Sri Lankan</span>
        </div>
        <div className="rx-about-image-stage" data-reveal>
          {[0, 1, 2].map((index) => (
            <AboutImage
              image={portfolioPhotos[index] ? {
                imageUrl: portfolioPhotos[index].imageUrl,
                title: portfolioPhotos[index].title,
                meta: portfolioPhotos[index].meta
              } : undefined}
              index={index}
              key={index}
            />
          ))}
          <p>Instinct first.<br />Polish second.</p>
        </div>
      </section>

      {introCards.length ? (
        <section className="rx-about-principles">
          <div className="rx-section-kicker" data-reveal>
            <span>Working principles / 02</span>
            <span>How the frame comes together</span>
          </div>
          <div className="rx-about-principle-grid" data-reveal>
            {introCards.map((block, index) => (
              <article key={block.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {block.label ? <small>{block.label}</small> : null}
                <h2>{block.title}</h2>
                {block.body ? <p>{block.body}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {bannerBlocks.map((block, index) => {
        const tags = blockReferenceItems(block.reference);

        return (
          <section
            className="rx-about-band"
            data-tone={index % 2 === 0 ? "orange" : "dark"}
            key={block.id}
          >
            <div className="rx-section-kicker" data-reveal>
              <span>{block.label ?? "Perspective"}</span>
              <span>{String(index + 3).padStart(2, "0")}</span>
            </div>
            <div className="rx-about-band-grid" data-reveal>
              <h2>{block.title}</h2>
              <div>
                {block.body ? <p>{block.body}</p> : null}
                {tags.length ? (
                  <div className="rx-about-tags" aria-label={`${block.title} references`}>
                    {tags.map((item) => <span key={item}>{item}</span>)}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}

      {spokenBlocks.length ? (
        <section className="rx-about-notes">
          <div className="rx-section-kicker" data-reveal>
            <span>Frame notes / 03</span>
            <span>Things worth keeping close</span>
          </div>
          <div className="rx-about-note-list" data-reveal>
            {spokenBlocks.map((block, index) => (
              <article key={block.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{block.title}</strong>
                <small>{block.reference ?? "RXNCOR note"}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {timelineBlocks.length ? (
        <section className="rx-about-path">
          <div className="rx-section-kicker" data-reveal>
            <span>Background / 04</span>
            <span>A work in progress</span>
          </div>
          <h2 data-reveal>THE PATH<br />SO FAR.</h2>
          <div className="rx-about-path-grid" data-reveal>
            {timelineBlocks.map((block, index) => (
              <article key={block.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{block.title}</h3>
                {block.body ? <p>{block.body}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {toolBlocks.length ? (
        <section className="rx-about-tools">
          <div className="rx-section-kicker" data-reveal>
            <span>Tools / 05</span>
            <span>Camera to delivery</span>
          </div>
          <div className="rx-about-tool-list" data-reveal>
            {toolBlocks.map((block, index) => (
              <span key={block.id}>{String(index + 1).padStart(2, "0")} / {block.title}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rx-about-closing">
        <p data-reveal>{aboutContent.settings.closing}</p>
        <div data-reveal>
          <Link className="rx-pill-link" href={siteConfig.routes.portfolio}>
            View portfolio <span aria-hidden="true">↗</span>
          </Link>
          <Link className="rx-pill-link" href={siteConfig.routes.book}>
            Request a shoot <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
