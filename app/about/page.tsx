import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicPageHero } from "@/components/public/PublicPageHero";
import { siteConfig } from "@/config/site";
import {
  blockReferenceItems,
  defaultAboutBlocks,
  defaultAboutSettings
} from "@/lib/about-builder";
import { getPublicPortfolioPhotos } from "@/lib/public-gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Malindu Herath",
  description:
    "About Malindu Herath, a Melbourne-based Sri Lankan photographer using a practical technical workflow for portraits, events, automotive work, and secure client delivery."
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
  const portfolioPhotos = await getPublicPortfolioPhotos(4).catch(() => []);
  const aboutContent = {
    settings: defaultAboutSettings,
    blocks: defaultAboutBlocks.map((block) =>
      block.id === "default-banner-delivery"
        ? {
            ...block,
            label: "File workflow",
            title: "The finished file matters as much as the capture.",
            body:
              "The workflow continues through selection, exposure and colour correction, consistent crops, and exports matched to their intended use. Client galleries separate fast previews from full-resolution files and keep private work behind access controls."
          }
        : block
    )
  };
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
          <span>Working samples</span>
          <span>Capture / Edit / Delivery</span>
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
          <p>Observe.<br />Capture.<br />Refine.</p>
        </div>
      </section>

      {introCards.length ? (
        <section className="rx-about-principles">
          <div className="rx-section-kicker" data-reveal>
            <span>Working method / 02</span>
            <span>Brief to delivery</span>
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
            <span>Technical notes / 03</span>
            <span>Practical working rules</span>
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
            <span>Photography and software</span>
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
            <span>Capture to cloud delivery</span>
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
