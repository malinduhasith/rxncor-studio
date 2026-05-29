import Link from "next/link";
import { submitContactAction } from "./actions";
import { AlbumCard } from "@/components/AlbumCard";
import { NoticeToaster } from "@/components/Notice";
import { PhotoTile } from "@/components/PhotoTile";
import { siteConfig } from "@/config/site";
import { contactNotices } from "@/lib/notices";
import { getPublicAlbumCards, getPublicPortfolioPhotos } from "@/lib/public-gallery";
import { featuredAlbums, portfolioItems } from "@/lib/sample-data";
import { getSiteContactSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    contact?: string;
  }>;
};

function formatDate(date: string | null) {
  return date ?? "Public";
}

export default async function Home({ searchParams }: HomePageProps) {
  const { contact } = await searchParams;
  const contactNotice = contact ? contactNotices[contact] : undefined;
  const [brandRoot, ...brandParts] = siteConfig.name.split(".");
  const brandSuffix = brandParts.join(".");
  const [realPortfolioPhotos, realAlbums, siteContactSettings] = await Promise.all([
    getPublicPortfolioPhotos(3),
    getPublicAlbumCards(3),
    getSiteContactSettings()
  ]);
  const heroImage = realPortfolioPhotos[0]?.imageUrl ?? realAlbums[0]?.coverUrl ?? null;
  const portfolioTiles = realPortfolioPhotos.length
    ? realPortfolioPhotos.map((photo, index) => (
        <PhotoTile
          key={photo.id}
          title={photo.title}
          meta={photo.meta}
          detail={photo.detail}
          eyebrow={photo.eyebrow}
          imageUrl={photo.imageUrl}
          loading={index < 3 ? "eager" : "lazy"}
        />
      ))
    : portfolioItems.slice(0, 3).map((item) => (
        <PhotoTile
          key={item.title}
          title={item.title}
          meta={item.location}
          colors={item.colors}
        />
      ));
  const albumTiles = realAlbums.length
    ? realAlbums.map((album, index) => (
        <AlbumCard
          key={album.slug}
          title={album.title}
          slug={album.slug}
          date={formatDate(album.event_date)}
          count={album.count}
          coverUrl={album.coverUrl}
          loading={index < 2 ? "eager" : "lazy"}
        />
      ))
    : featuredAlbums.map((album) => <AlbumCard key={album.slug} {...album} />);

  return (
    <main>
      <NoticeToaster cleanupQueryKeys={["contact"]} notices={[contactNotice]} />
      <section className="shell hero">
        <div className="hero-copy">
          <p className="eyebrow">Melbourne photography and client delivery</p>
          <h1 className="hero-title">
            <span>{brandRoot}{brandSuffix ? "." : ""}</span>
            {brandSuffix ? <span>{brandSuffix}</span> : null}
          </h1>
          <p className="lede">
            Public portfolio, curated featured albums, and private client galleries
            with password-protected delivery and download-ready photo sets.
          </p>
          <div className="hero-actions">
            <Link className="button" href={siteConfig.routes.portfolio}>
              View Portfolio
            </Link>
            <Link className="button secondary" href={siteConfig.routes.albums}>
              Featured Albums
            </Link>
            <Link className="button secondary" href={siteConfig.routes.book}>
              Request Shoot
            </Link>
          </div>
        </div>
        <div className="hero-media" aria-label="Featured photography artwork">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="photo-img"
              src={heroImage}
              alt="Featured photography"
              loading="eager"
              decoding="async"
            />
          ) : null}
          <div className="hero-stamp" aria-hidden="true">
            <span>RX</span>
            <span>Archive ready</span>
          </div>
        </div>
      </section>

      <section className="section alt" id="about">
        <div className="shell section-head numbered" data-index="01">
          <div>
            <p className="eyebrow">About</p>
            <h2>Made for polished galleries, bookings, and clean client access.</h2>
          </div>
          <p>
            Public pages, shoot requests, admin upload tools, private links,
            client passwords, expiry dates, and direct downloads are wired together
            so booking and delivery can stay in one place.
          </p>
        </div>
      </section>

      <section className="shell section">
        <div className="section-head numbered" data-index="02">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h2>Recent work</h2>
          </div>
          <Link className="button secondary" href={siteConfig.routes.portfolio}>
            See all
          </Link>
        </div>
        <div className="grid portfolio-gallery-grid">{portfolioTiles}</div>
      </section>

      <section className="section alt">
        <div className="shell">
          <div className="section-head numbered" data-index="03">
            <div>
              <p className="eyebrow">Featured Albums</p>
              <h2>Client-ready collections</h2>
            </div>
            <Link className="button secondary" href={siteConfig.routes.albums}>
              Browse albums
            </Link>
          </div>
          <div className="grid album-gallery-grid">{albumTiles}</div>
        </div>
      </section>

      <section className="shell section contact-showcase" id="contact">
        <div className="section-head numbered" data-index="04">
          <div>
            <p className="eyebrow">Contact / Socials</p>
            <h2>Start with a message, follow the work.</h2>
          </div>
          <p>
            For bookings, gallery support, or creative work, use email or the
            request form. Instagram is the quickest place to see current frames.
          </p>
        </div>
        <div className="contact-showcase-grid">
          <div className="contact-primary-card">
            <span className="label">Direct email</span>
            <a href={`mailto:${siteContactSettings.contactEmail}`}>
              {siteContactSettings.contactEmail}
            </a>
            <p>
              Best for booking details, private gallery questions, collaboration
              ideas, and anything that needs a clear reply.
            </p>
          </div>
          <div className="contact-social-grid" aria-label="Social links">
            {siteContactSettings.socialLinks.map((social, index) => (
              <a
                className="social-card"
                href={social.href}
                key={`${social.label}-${social.href}`}
                rel="noreferrer"
                target="_blank"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{social.label}</strong>
                <small>{social.handle}</small>
                <p>{social.detail}</p>
              </a>
            ))}
          </div>
          <div className="contact-info-strip">
            <div>
              <span className="label">Based in</span>
              <strong>{siteContactSettings.location}</strong>
            </div>
            {siteContactSettings.contactPhone ? (
              <div>
                <span className="label">Phone</span>
                <a href={`tel:${siteContactSettings.contactPhone}`}>
                  {siteContactSettings.contactPhone}
                </a>
              </div>
            ) : null}
            <div>
              <span className="label">Response path</span>
              <strong>Bookings, gallery support, and socials</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="shell section" id="inquiries">
        <div className="section-head numbered compact" data-index="05">
          <div>
            <p className="eyebrow">Questions / support</p>
            <h2>Need help, access, or a quick answer?</h2>
          </div>
          <p>
            For new shoot requests, use the booking page. For gallery access,
            downloads, album links, or general questions, send a message here.
          </p>
        </div>
        <div className="contact-grid">
          <div className="form-panel contact-form">
            <h3>Choose the right path</h3>
            <p className="form-note">
              This section is for quick questions and gallery help. The full
              booking flow has its own page so session details stay clear.
            </p>
            <div className="feature-list contact-details">
              <div className="feature">
                <h3>Book a shoot</h3>
                <p>Use the booking page for dates, times, locations, and shoot details.</p>
              </div>
              <div className="feature">
                <h3>Gallery access</h3>
                <p>Ask about passwords, private links, downloads, or expired albums.</p>
              </div>
              <div className="feature">
                <h3>Album help</h3>
                <p>Send the album name or link if something is not opening correctly.</p>
              </div>
              <div className="feature">
                <h3>Direct reply</h3>
                <p>I will reply by email, so include the best address to reach you.</p>
              </div>
            </div>
            <Link className="button" href={siteConfig.routes.book}>
              Go to booking page
            </Link>
          </div>
          <div className="contact-side">
            <form action={submitContactAction} className="form-panel contact-form">
              <h3>Send a message</h3>
              <label className="field">
                Name
                <input name="name" autoComplete="name" required />
              </label>
              <label className="field">
                Email
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label className="field">
                Phone
                <input name="phone" autoComplete="tel" placeholder="+61" />
              </label>
              <label className="field">
                Message
                <textarea
                  name="message"
                  placeholder="Album link, gallery question, booking follow-up, or anything I should know."
                  required
                />
              </label>
              <button className="button" type="submit">
                Send message
              </button>
            </form>
            <div className="feature-list contact-details">
              <div className="feature">
                <h3>Email</h3>
                <p>
                  <a href={`mailto:${siteContactSettings.contactEmail}`}>
                    {siteContactSettings.contactEmail}
                  </a>
                </p>
              </div>
              <div className="feature">
                <h3>Instagram</h3>
                <p>
                  <a href={siteContactSettings.instagramUrl}>
                    {siteContactSettings.instagramHandle}
                  </a>
                </p>
              </div>
              <div className="feature">
                <h3>Delivery</h3>
                <p>Private galleries with single photo and ZIP downloads.</p>
              </div>
              <div className="feature">
                <h3>Storage</h3>
                <p>Photos live in Cloudflare R2, not inside the website project.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
