import Image from "next/image";
import Link from "next/link";
import { submitContactAction } from "./actions";
import { FrameReel, type FrameReelItem } from "@/components/home/FrameReel";
import { MelbourneClock } from "@/components/home/MelbourneClock";
import { NoticeToaster } from "@/components/Notice";
import { siteConfig } from "@/config/site";
import { contactNotices } from "@/lib/notices";
import { getPublicAlbumCards, getPublicPortfolioPhotos } from "@/lib/public-gallery";
import { featuredAlbums, portfolioItems } from "@/lib/sample-data";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    contact?: string;
  }>;
};

const services = [
  { name: "Portraits", detail: "People / identity / editorial", href: "/book" },
  { name: "Events", detail: "Energy / atmosphere / celebration", href: "/book" },
  { name: "Automotive", detail: "Machines / movement / detail", href: "/book" },
  { name: "Lifestyle", detail: "Brands / spaces / everyday stories", href: "/book" },
  { name: "Private delivery", detail: "Secure galleries / full-resolution files", href: "/login" }
];

function displayDate(value: string | null) {
  if (!value) {
    return "Selected work";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric"
  }).format(date);
}

export default async function Home({ searchParams }: HomePageProps) {
  const { contact } = await searchParams;
  const contactNotice = contact ? contactNotices[contact] : undefined;
  const [realPortfolioPhotos, realAlbums] = await Promise.all([
    getPublicPortfolioPhotos(7).catch(() => []),
    getPublicAlbumCards(4).catch(() => [])
  ]);

  const frames: FrameReelItem[] = realPortfolioPhotos.length
    ? realPortfolioPhotos.map((photo) => ({
        id: photo.id,
        title: photo.title,
        meta: photo.meta,
        detail: photo.detail,
        imageUrl: photo.imageUrl
      }))
    : portfolioItems.map((item, index) => ({
        id: `sample-${index}`,
        title: item.title,
        meta: item.location,
        detail: "RXNCOR selected work",
        imageUrl: null
      }));

  const work = realAlbums.length
    ? realAlbums.map((album) => ({
        id: album.id,
        title: album.title,
        slug: album.slug,
        date: displayDate(album.event_date),
        count: album.count,
        coverUrl: album.coverUrl
      }))
    : featuredAlbums.map((album, index) => ({
        id: `sample-album-${index}`,
        title: album.title,
        slug: album.slug,
        date: displayDate(album.date),
        count: album.count,
        coverUrl: null
      }));

  const heroFrame = frames[0];
  const collageFrames = [frames[1] ?? frames[0], frames[2] ?? frames[0], frames[3] ?? frames[0]];

  return (
    <main className="rx-home">
      <NoticeToaster cleanupQueryKeys={["contact"]} notices={[contactNotice]} />

      <section className="rx-hero" id="top">
        <div className="rx-grain" aria-hidden="true" />
        <div className="rx-crop rx-crop-nw" aria-hidden="true" />
        <div className="rx-crop rx-crop-ne" aria-hidden="true" />
        <div className="rx-crop rx-crop-sw" aria-hidden="true" />
        <div className="rx-crop rx-crop-se" aria-hidden="true" />

        <div className="rx-hero-meta">
          <span>Independent photo studio</span>
          <MelbourneClock />
        </div>

        <h1 className="rx-hero-title" aria-label="Melbourne photographer">
          <span>MELBOURNE</span>
          <span>PHOTOGRAPHER</span>
        </h1>

        <div className="rx-hero-object">
          <div className="rx-hero-ring" aria-hidden="true" />
          <div className="rx-hero-image">
            {heroFrame?.imageUrl ? (
              <Image
                alt={heroFrame.title}
                fill
                priority
                sizes="(max-width: 800px) 72vw, 34vw"
                src={heroFrame.imageUrl}
                unoptimized
              />
            ) : (
              <div className="rx-image-fallback" aria-hidden="true" />
            )}
          </div>
          <Link className="rx-hero-play" href="/#frames">
            <span aria-hidden="true">↓</span>
            Explore frames
          </Link>
        </div>

        <div className="rx-hero-foot">
          <p>
            Honest people. Loud machines. Fast nights. Photographed with feeling in
            Melbourne and wherever the story takes us.
          </p>
          <span>Scroll / 01</span>
        </div>
      </section>

      <section className="rx-manifesto" id="about">
        <div className="rx-section-kicker" data-reveal>
          <span>Approach / 01</span>
          <span>Unstaged when it matters</span>
        </div>
        <div className="rx-manifesto-copy" data-reveal>
          <h2>
            <span>REAL MOMENTS</span>
            <span>MADE LOUD.</span>
          </h2>
          <p>
            RXNCOR is a Melbourne photography studio led by Malindu. The work sits
            between documentary instinct and graphic precision—natural enough to
            feel true, considered enough to last.
          </p>
        </div>

        <div className="rx-collage" aria-label="Selected RXNCOR photography" data-reveal>
          {collageFrames.map((frame, index) => (
            <figure className={`rx-collage-frame rx-collage-${index + 1}`} key={`${frame.id}-${index}`}>
              {frame.imageUrl ? (
                <Image
                  alt={frame.title}
                  fill
                  sizes="(max-width: 800px) 58vw, 32vw"
                  src={frame.imageUrl}
                  unoptimized
                />
              ) : (
                <div className="rx-image-fallback" aria-hidden="true" />
              )}
              <figcaption>{String(index + 1).padStart(2, "0")} / {frame.meta}</figcaption>
            </figure>
          ))}
          <span className="rx-collage-note">No stiff poses<br />No empty polish</span>
        </div>
      </section>

      <section className="rx-services">
        <div className="rx-section-kicker" data-reveal>
          <span>What I shoot / 02</span>
          <span>Built around your story</span>
        </div>
        <h2 data-reveal>FOCUS</h2>
        <div className="rx-service-list" data-reveal>
          {services.map((service, index) => (
            <Link href={service.href} key={service.name}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <strong>{service.name}</strong>
              <span>{service.detail}</span>
              <i aria-hidden="true">↗</i>
            </Link>
          ))}
        </div>
      </section>

      <FrameReel frames={frames.slice(0, 6)} />

      <section className="rx-work" id="work">
        <div className="rx-work-heading">
          <div className="rx-section-kicker" data-reveal>
            <span>Recent stories / 03</span>
            <span>Public albums</span>
          </div>
          <h2 data-reveal>WORK</h2>
        </div>

        <div className="rx-project-list">
          {work.map((album, index) => (
            <article className="rx-project" key={album.id}>
              <div className="rx-project-card">
                <div className="rx-project-side">
                  <span>{String(index + 1).padStart(2, "0")} / {String(work.length).padStart(2, "0")}</span>
                  <Link href={`${siteConfig.routes.clientGallery}/${album.slug}`}>
                    Open story <span aria-hidden="true">↗</span>
                  </Link>
                </div>
                <Link
                  aria-label={`View ${album.title}`}
                  className="rx-project-image"
                  href={`${siteConfig.routes.clientGallery}/${album.slug}`}
                >
                  {album.coverUrl ? (
                    <Image
                      alt={album.title}
                      fill
                      sizes="(max-width: 800px) 90vw, 50vw"
                      src={album.coverUrl}
                      unoptimized
                    />
                  ) : (
                    <div className="rx-image-fallback" aria-hidden="true" />
                  )}
                </Link>
                <div className="rx-project-copy">
                  <span>{album.date}</span>
                  <h3>{album.title}</h3>
                  <p>{album.count} photographs / Melbourne and beyond</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <Link className="rx-all-work" href={siteConfig.routes.albums}>
          <span>View every public album</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </section>

      <section className="rx-contact" id="inquiries">
        <div className="rx-contact-intro" data-reveal>
          <div className="rx-section-kicker">
            <span>Start a conversation / 04</span>
            <span>Usually replies within 48 hours</span>
          </div>
          <h2>GOT A STORY<br />IN MIND?</h2>
          <p>
            Tell me what you are making, celebrating, driving, launching, or trying
            to remember. For a full quote and date request, use the booking page.
          </p>
          <Link className="rx-pill-link" href={siteConfig.routes.book}>
            Book a shoot <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <form action={submitContactAction} className="rx-contact-form" data-reveal>
          <label>
            <span>01 / Your name</span>
            <input name="name" autoComplete="name" placeholder="Name" required />
          </label>
          <label>
            <span>02 / Email</span>
            <input name="email" type="email" autoComplete="email" placeholder="you@email.com" required />
          </label>
          <label>
            <span>03 / Phone, optional</span>
            <input name="phone" autoComplete="tel" placeholder="+61" />
          </label>
          <label>
            <span>04 / What are we making?</span>
            <textarea name="message" placeholder="A few details about the idea, timing, or gallery question…" required />
          </label>
          <button type="submit">
            Send inquiry <span aria-hidden="true">↗</span>
          </button>
        </form>
      </section>
    </main>
  );
}
