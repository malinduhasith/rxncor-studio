import Image from "next/image";
import Link from "next/link";
import { FrameReel, type FrameReelItem } from "@/components/home/FrameReel";
import { CompositionMark } from "@/components/home/CompositionMark";
import { HeroVectorField } from "@/components/home/HeroVectorField";
import { InquiryConsole } from "@/components/home/InquiryConsole";
import { MelbourneClock } from "@/components/home/MelbourneClock";
import { MorphCanvas } from "@/components/home/MorphCanvas";
import { ProjectRail, type ProjectRailItem } from "@/components/home/ProjectRail";
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
  {
    name: "Private delivery",
    detail: "Secure galleries / full-resolution files",
    href: "/login"
  }
];

function displayDate(value: string | null) {
  if (!value) return "Selected work";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return value;

  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric"
  }).format(date);
}

export default async function Home({ searchParams }: HomePageProps) {
  const { contact } = await searchParams;
  const contactNotice = contact ? contactNotices[contact] : undefined;
  const [realPortfolioPhotos, realAlbums] = await Promise.all([
    getPublicPortfolioPhotos().catch(() => []),
    getPublicAlbumCards(4).catch(() => [])
  ]);

  const frames: FrameReelItem[] = realPortfolioPhotos.length
    ? realPortfolioPhotos.map((photo) => ({
        id: photo.id,
        title: photo.title,
        meta: photo.meta,
        detail: photo.detail,
        imageUrl: photo.imageUrl,
        cameraModel: photo.cameraModel,
        lensModel: photo.lensModel,
        focalLength: photo.focalLength,
        aperture: photo.aperture,
        shutterSpeed: photo.shutterSpeed,
        iso: photo.iso
      }))
    : portfolioItems.map((item, index) => ({
        id: `sample-${index}`,
        title: item.title,
        meta: item.location,
        detail: "RXNCOR selected work",
        imageUrl: null
      }));

  const work: ProjectRailItem[] = realAlbums.length
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
  const introFrames = [frames[1] ?? frames[0], frames[2] ?? frames[0]];

  return (
    <main className="rr-home">
      <NoticeToaster cleanupQueryKeys={["contact"]} notices={[contactNotice]} />

      <section
        className="rr-hero"
        data-scroll-track
        id="top"
      >
        <div className="rr-hero-sticky">
          <MorphCanvas />
          <HeroVectorField />
          <CompositionMark className="rr-page-vector rr-hero-vector-aperture" variant="aperture" />
          <CompositionMark className="rr-page-vector rr-hero-vector-curve" variant="curve" />
          <div className="rr-cross rr-cross-nw" aria-hidden="true" />
          <div className="rr-cross rr-cross-ne" aria-hidden="true" />
          <div className="rr-cross rr-cross-sw" aria-hidden="true" />
          <div className="rr-cross rr-cross-se" aria-hidden="true" />

          <div className="rr-hero-meta">
            <span>RXNCOR / Independent photo studio</span>
            <MelbourneClock />
          </div>

          <h1 className="rr-hero-title">
            <span>MELBOURNE</span>
            <span>PHOTOGRAPHER</span>
          </h1>

          <div className="rr-hero-scene" aria-label="Featured RXNCOR photograph">
            <div className="rr-hero-orbit" aria-hidden="true" />
            <div className="rr-hero-photo" data-cursor="View">
              {heroFrame?.imageUrl ? (
                <Image
                  alt={heroFrame.title}
                  fill
                  priority
                  sizes="(max-width: 760px) 68vw, 30vw"
                  src={heroFrame.imageUrl}
                />
              ) : (
                <div className="rx-image-fallback" aria-hidden="true" />
              )}
            </div>
            <Link className="rr-hero-action" data-cursor="Go" href="#frames">
              <span aria-hidden="true">▶</span>
              Run the reel
            </Link>
          </div>

          <div className="rr-hero-about">
            <span>About</span>
            <p>
              Honest people. Loud machines. Fast nights. Photographed with feeling
              in Melbourne and wherever the story takes us.
            </p>
          </div>

          <div className="rr-hero-location">
            <span>Location</span>
            <strong>Melbourne / Australia</strong>
          </div>

          <Link className="rr-scroll-cue" href="#about">
            Scroll <span aria-hidden="true">↓</span>
          </Link>
        </div>
      </section>

      <section
        className="rr-intro"
        data-scroll-track
        data-transition
        id="about"
      >
        <CompositionMark className="rr-page-vector rr-intro-vector-spiral" variant="spiral" />
        <CompositionMark className="rr-page-vector rr-intro-vector-v" variant="v" />
        <div className="rr-section-label" data-reveal>
          <span>Approach / 01</span>
          <span>Feeling first. Polish second.</span>
        </div>

        <div className="rr-intro-headings" data-reveal>
          <h2>THOUGHTFUL<br />FRAMES WITH<br />MEANING</h2>
          <h2>BOLD STORIES<br />BUILT TO HOLD<br />ATTENTION</h2>
        </div>

        <div className="rr-intro-body">
          <div className="rr-intro-copy" data-reveal>
            <span>[ RX / 01 ]</span>
            <p>
              RXNCOR sits between documentary instinct and graphic precision—natural
              enough to feel true, considered enough to last.
            </p>
            <Link href={siteConfig.routes.about}>
              About the studio <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="rr-intro-media" data-reveal>
            {introFrames.map((frame, index) => (
              <figure data-cursor="View" data-parallax={index ? "22" : "38"} key={`${frame.id}-${index}`}>
                <div>
                  {frame.imageUrl ? (
                    <Image
                      alt={frame.title}
                      fill
                      sizes="(max-width: 760px) 86vw, 38vw"
                      src={frame.imageUrl}
                    />
                  ) : (
                    <div className="rx-image-fallback" aria-hidden="true" />
                  )}
                </div>
                <figcaption>{String(index + 1).padStart(2, "0")} / {frame.meta}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="rr-services" data-transition>
        <CompositionMark className="rr-page-vector rr-services-vector-radial" variant="radial" />
        <CompositionMark className="rr-page-vector rr-services-vector-tunnel" variant="tunnel" />
        <div className="rr-section-label" data-reveal>
          <span>Focus / 02</span>
          <span>What I photograph</span>
        </div>
        <div className="rr-services-title" data-reveal>
          <span>Built around</span>
          <h2>YOUR STORY.</h2>
        </div>
        <div className="rr-service-list" data-reveal>
          {services.map((service, index) => (
            <Link data-cursor="Open" href={service.href} key={service.name}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <strong>{service.name}</strong>
              <span>{service.detail}</span>
              <i aria-hidden="true">↗</i>
            </Link>
          ))}
        </div>
      </section>

      <FrameReel frames={frames} />
      <ProjectRail projects={work} />

      <section className="rr-contact" data-transition id="inquiries">
        <CompositionMark className="rr-page-vector rr-contact-vector-spiral" variant="spiral" />
        <CompositionMark className="rr-page-vector rr-contact-vector-thirds" variant="thirds" />
        <div className="rr-contact-intro" data-reveal>
          <div className="rr-section-label">
            <span>New commission / 04</span>
            <span>Melbourne + anywhere</span>
          </div>
          <h2>BRING ME<br />THE IDEA.</h2>
          <p>
            A date, a place, a feeling. Give me the useful details and I&apos;ll shape
            the visual approach with you.
          </p>
          <Link className="rr-round-link" data-cursor="Book" href={siteConfig.routes.book}>
            Book a shoot <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <InquiryConsole />
      </section>
    </main>
  );
}
