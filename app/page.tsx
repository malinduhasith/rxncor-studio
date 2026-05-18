import Link from "next/link";
import { AlbumCard } from "@/components/AlbumCard";
import { PhotoTile } from "@/components/PhotoTile";
import { siteConfig } from "@/config/site";
import { getPublicAlbumCards, getPublicPortfolioPhotos } from "@/lib/public-gallery";
import { featuredAlbums, portfolioItems } from "@/lib/sample-data";

export const dynamic = "force-dynamic";

function formatDate(date: string | null) {
  return date ?? "Public";
}

export default async function Home() {
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

      <section className="shell section" id="contact">
        <div className="section-head">
          <div>
            <p className="eyebrow">Contact</p>
            <h2>Bookings and gallery support</h2>
          </div>
          <p>
            For bookings, album delivery help, or gallery access support, use the
            email or Instagram below.
          </p>
        </div>
        <div className="feature-list">
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
      </section>
    </main>
  );
}
