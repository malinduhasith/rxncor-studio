import type { Metadata } from "next";
import Link from "next/link";
import { blockReferenceItems, getAboutPageContent } from "@/lib/about-builder";
import { getPublicPortfolioPhotos } from "@/lib/public-gallery";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Malindu Herath",
  description:
    "About Malindu Herath, a Melbourne-based Sri Lankan creative building rxncor.studio around photography, design, and software."
};

function AboutImage({
  image,
  index
}: {
  image?: { imageUrl: string | null; title: string; meta: string };
  index: number;
}) {
  if (image?.imageUrl) {
    return (
      <figure className="about-image-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.imageUrl} alt={`${image.title} from ${image.meta}`} />
        <figcaption>
          <span>{String(index + 1).padStart(2, "0")}</span>
          {image.title}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="about-image-frame about-image-placeholder">
      <div aria-hidden="true" />
      <figcaption>
        <span>{String(index + 1).padStart(2, "0")}</span>
        RXNCOR visual study
      </figcaption>
    </figure>
  );
}

export default async function AboutPage() {
  const [portfolioPhotos, aboutContent] = await Promise.all([
    getPublicPortfolioPhotos(4),
    getAboutPageContent()
  ]);
  const introCards = aboutContent.blocks.filter((block) => block.section === "intro_cards");
  const bannerBlocks = aboutContent.blocks.filter((block) => block.section === "banners");
  const spokenBlocks = aboutContent.blocks.filter((block) => block.section === "spoken");
  const timelineBlocks = aboutContent.blocks.filter((block) => block.section === "timeline");
  const toolBlocks = aboutContent.blocks.filter((block) => block.section === "tools");

  return (
    <main className="about-page">
      <section className="shell about-hero" data-ghost={aboutContent.settings.heroTitle}>
        <div className="about-hero-copy">
          <p className="eyebrow">{aboutContent.settings.heroLabel}</p>
          <h1>{aboutContent.settings.heroTitle}</h1>
          <p className="lede">{aboutContent.settings.intro}</p>
        </div>
        <aside className="about-meta-panel" aria-label="Profile metadata">
          {aboutContent.settings.metaItems.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </aside>
      </section>

      <section className="shell about-visual-strip" aria-label="Selected visual direction">
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
      </section>

      {introCards.length ? (
        <section className="shell section about-block-grid">
          {introCards.map((block, index) => (
            <article className="about-copy-panel" key={block.id}>
              <span className="about-index">{String(index + 1).padStart(2, "0")}</span>
              {block.label ? <p className="eyebrow">{block.label}</p> : null}
              <h2>{block.title}</h2>
              {block.body ? <p>{block.body}</p> : null}
            </article>
          ))}
        </section>
      ) : null}

      {bannerBlocks.map((block, index) => {
        const tags = blockReferenceItems(block.reference);
        const bannerContent = (
          <>
            <div>
              {block.label ? <p className="eyebrow">{block.label}</p> : null}
              <h2>{block.title}</h2>
            </div>
            <div className="about-split-panel">
              {block.body ? <p>{block.body}</p> : null}
              {tags.length ? (
                <div className="about-tag-cloud" aria-label={`${block.title} references`}>
                  {tags.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        );

        return index % 2 === 0 ? (
          <section className="section alt" key={block.id}>
            <div className="shell about-split">{bannerContent}</div>
          </section>
        ) : (
          <section className="shell section about-split" key={block.id}>
            {bannerContent}
          </section>
        );
      })}

      {spokenBlocks.length ? (
        <section className="shell section">
          <div className="section-head numbered" data-index="NOTES">
            <div>
              <p className="eyebrow">Spoken references</p>
              <h2>Short notes that can keep changing.</h2>
            </div>
            <p>
              Small lines, references, and working thoughts. This whole section
              can be edited from the admin builder.
            </p>
          </div>
          <div className="about-statement-grid">
            {spokenBlocks.map((block, index) => (
              <article className="about-statement" key={block.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{block.title}</strong>
                {block.reference ? <small>{block.reference}</small> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {timelineBlocks.length ? (
        <section className="section alt">
          <div className="shell about-timeline-section">
            <div className="section-head numbered" data-index="PATH">
              <div>
                <p className="eyebrow">Background</p>
                <h2>A work in progress through media, software, and Melbourne light.</h2>
              </div>
            </div>
            <div className="about-timeline">
              {timelineBlocks.map((block, index) => (
                <article className="about-timeline-item" key={block.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{block.title}</h3>
                  {block.body ? <p>{block.body}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {toolBlocks.length ? (
        <section className="shell section about-tools-section">
          <div>
            <p className="eyebrow">Tools</p>
            <h2>Camera, glass, code, and systems.</h2>
          </div>
          <div className="about-tool-grid">
            {toolBlocks.map((block) => (
              <span key={block.id}>{block.title}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="shell section about-closing">
        <p>{aboutContent.settings.closing}</p>
        <div className="inline-actions">
          <Link className="button" href={siteConfig.routes.portfolio}>
            View portfolio
          </Link>
          <Link className="button secondary" href={siteConfig.routes.book}>
            Request a shoot
          </Link>
        </div>
      </section>
    </main>
  );
}
