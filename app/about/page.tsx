import type { Metadata } from "next";
import Link from "next/link";
import {
  aboutProfile,
  aboutSections,
  aboutTechStack,
  aboutTimeline,
  aboutTools,
  aboutValues
} from "@/lib/about-content";
import { getPublicPortfolioPhotos } from "@/lib/public-gallery";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Malindu Herath",
  description:
    "About Malindu Herath, a Melbourne-based Sri Lankan creative and technologist building rxncor.studio."
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
  const portfolioPhotos = await getPublicPortfolioPhotos(4);

  return (
    <main className="about-page">
      <section className="shell about-hero">
        <div className="about-hero-copy">
          <p className="eyebrow">About / Malindu Herath</p>
          <h1>{aboutProfile.hero}</h1>
          <p className="lede">{aboutProfile.intro}</p>
        </div>
        <aside className="about-meta-panel" aria-label="Profile metadata">
          {aboutProfile.metadata.map(([label, value]) => (
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

      <section className="shell section about-block-grid">
        {aboutSections.map((section) => (
          <article className="about-copy-panel" key={section.index}>
            <span className="about-index">{section.index}</span>
            <p className="eyebrow">{section.label}</p>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>

      <section className="section alt">
        <div className="shell about-split">
          <div>
            <p className="eyebrow">Creative / Technical</p>
            <h2>Two instincts, one working method.</h2>
          </div>
          <div className="about-split-panel">
            <p>
              The camera side is about feeling, light, atmosphere, and timing.
              The software side is about structure, systems, repeatability, and
              making things easier to use. RXNCOR sits in that overlap: creative
              direction with technical execution.
            </p>
            <div className="about-tag-cloud" aria-label="Technology experience">
              {aboutTechStack.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="shell section">
        <div className="section-head numbered" data-index="04">
          <div>
            <p className="eyebrow">Approach</p>
            <h2>Small rules for making things.</h2>
          </div>
          <p>
            A simple set of instincts that apply to photographs, interfaces,
            client galleries, automations, and the quiet details between them.
          </p>
        </div>
        <div className="about-statement-grid">
          {aboutValues.map((value, index) => (
            <article className="about-statement" key={value}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section alt">
        <div className="shell about-timeline-section">
          <div className="section-head numbered" data-index="05">
            <div>
              <p className="eyebrow">Background</p>
              <h2>A route through media, software, and Melbourne light.</h2>
            </div>
          </div>
          <div className="about-timeline">
            {aboutTimeline.map((item, index) => (
              <article className="about-timeline-item" key={item.place}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.place}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="shell section about-tools-section">
        <div>
          <p className="eyebrow">Tools</p>
          <h2>Camera, glass, code, and systems.</h2>
        </div>
        <div className="about-tool-grid">
          {aboutTools.map((tool) => (
            <span key={tool}>{tool}</span>
          ))}
        </div>
      </section>

      <section className="shell section about-closing">
        <p>{aboutProfile.closing}</p>
        <div className="inline-actions">
          <Link className="button" href={siteConfig.routes.portfolio}>
            View portfolio
          </Link>
          <Link className="button secondary" href="/#book">
            Request a shoot
          </Link>
        </div>
      </section>
    </main>
  );
}
