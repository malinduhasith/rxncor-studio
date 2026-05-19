import Link from "next/link";
import { submitContactAction, submitShootRequestAction } from "./actions";
import { AlbumCard } from "@/components/AlbumCard";
import { PhotoTile } from "@/components/PhotoTile";
import { siteConfig } from "@/config/site";
import { getPublicAlbumCards, getPublicPortfolioPhotos } from "@/lib/public-gallery";
import { featuredAlbums, portfolioItems } from "@/lib/sample-data";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    contact?: string;
    shoot?: string;
  }>;
};

function formatDate(date: string | null) {
  return date ?? "Public";
}

export default async function Home({ searchParams }: HomePageProps) {
  const { contact, shoot } = await searchParams;
  const [realPortfolioPhotos, realAlbums] = await Promise.all([
    getPublicPortfolioPhotos(3),
    getPublicAlbumCards(3)
  ]);
  const heroImage = realPortfolioPhotos[0]?.imageUrl ?? realAlbums[0]?.coverUrl ?? null;
  const portfolioTiles = realPortfolioPhotos.length
    ? realPortfolioPhotos.map((photo) => (
        <PhotoTile
          key={photo.id}
          title={photo.title}
          meta={photo.meta}
          imageUrl={photo.imageUrl}
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
    ? realAlbums.map((album) => (
        <AlbumCard
          key={album.slug}
          title={album.title}
          slug={album.slug}
          date={formatDate(album.event_date)}
          count={album.count}
          coverUrl={album.coverUrl}
        />
      ))
    : featuredAlbums.map((album) => <AlbumCard key={album.slug} {...album} />);

  return (
    <main>
      <section className="shell hero">
        <div>
          <p className="eyebrow">Melbourne photography and client delivery</p>
          <h1>{siteConfig.name}</h1>
          <p className="lede">
            Public portfolio, curated featured albums, and private client galleries
            with password-protected delivery and download-ready photo sets.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <Link className="button" href={siteConfig.routes.portfolio}>
              View Portfolio
            </Link>
            <Link className="button secondary" href={siteConfig.routes.albums}>
              Featured Albums
            </Link>
            <Link className="button secondary" href="#book">
              Request Shoot
            </Link>
          </div>
        </div>
        <div className="hero-media" aria-label="Featured photography artwork">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="photo-img" src={heroImage} alt="Featured photography" />
          ) : null}
        </div>
      </section>

      <section className="section alt" id="about">
        <div className="shell section-head">
          <div>
            <p className="eyebrow">About</p>
            <h2>Made for polished galleries without heavy client accounts.</h2>
          </div>
          <p>
            Start with simple public pages, an admin upload flow, private links,
            album passwords, expiry dates, and direct downloads. Payments, comments,
            proofing, and client portals can arrive later.
          </p>
        </div>
      </section>

      <section className="shell section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h2>Recent work</h2>
          </div>
          <Link className="button secondary" href={siteConfig.routes.portfolio}>
            See all
          </Link>
        </div>
        <div className="grid">{portfolioTiles}</div>
      </section>

      <section className="section alt">
        <div className="shell">
          <div className="section-head">
            <div>
              <p className="eyebrow">Featured Albums</p>
              <h2>Client-ready collections</h2>
            </div>
            <Link className="button secondary" href={siteConfig.routes.albums}>
              Browse albums
            </Link>
          </div>
          <div className="grid">{albumTiles}</div>
        </div>
      </section>

      <section className="shell section" id="book">
        <div className="section-head">
          <div>
            <p className="eyebrow">Book</p>
            <h2>Request a shoot</h2>
          </div>
          <p>
            Send the date, time, location, and type of shoot you need. Accepted
            bookings are checked against existing confirmed work before they can
            be locked in.
          </p>
        </div>
        <div className="contact-grid">
          <form action={submitShootRequestAction} className="form-panel contact-form">
            <h3>Shoot request</h3>
            {shoot === "sent" ? (
              <p className="alert success">Request sent. I will confirm availability soon.</p>
            ) : null}
            {shoot === "conflict" ? (
              <p className="alert">
                That time is already booked. Choose another time or send a flexible window.
              </p>
            ) : null}
            {shoot === "setup-error" ? (
              <p className="alert">
                Shoot requests need the latest Supabase migration before this form can save.
              </p>
            ) : null}
            {shoot === "error" ? (
              <p className="alert">Could not send that request. Check the fields and try again.</p>
            ) : null}
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
              Shoot type
              <select name="shoot_type" defaultValue="Portrait session" required>
                <option>Portrait session</option>
                <option>Family session</option>
                <option>Birthday or celebration</option>
                <option>Event coverage</option>
                <option>Brand or product</option>
                <option>Other</option>
              </select>
            </label>
            <label className="field">
              Location
              <input name="location" placeholder="Suburb, venue, or online planning note" />
            </label>
            <div className="form-two-col">
              <label className="field">
                Start
                <input name="preferred_start_at" type="datetime-local" required />
              </label>
              <label className="field">
                Finish
                <input name="preferred_end_at" type="datetime-local" required />
              </label>
            </div>
            <label className="field">
              Details
              <textarea
                name="message"
                placeholder="Tell me what this is for, rough guest count, style, and anything time-sensitive."
              />
            </label>
            <button className="button" type="submit">
              Request shoot
            </button>
          </form>
          <div className="contact-side">
          <form action={submitContactAction} className="form-panel contact-form">
            <h3>Gallery support</h3>
            {contact === "sent" ? (
              <p className="alert success">Message sent. I will reply as soon as I can.</p>
            ) : null}
            {contact === "error" ? (
              <p className="alert">Could not send that message. Check the fields and try again.</p>
            ) : null}
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
                placeholder="Album link, client name, or gallery access issue."
                required
              />
            </label>
            <button className="button" type="submit">
              Send support message
            </button>
          </form>
          <div className="feature-list contact-details">
            <div className="feature">
              <h3>Email</h3>
              <p>
                <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
              </p>
            </div>
            <div className="feature">
              <h3>Instagram</h3>
              <p>
                <a href={siteConfig.instagramUrl}>{siteConfig.instagramHandle}</a>
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
