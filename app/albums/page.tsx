import type { Metadata } from "next";
import Link from "next/link";
import { AlbumCard } from "@/components/AlbumCard";
import { PublicPageHero } from "@/components/public/PublicPageHero";
import { siteConfig } from "@/config/site";
import { getPublicAlbumCards } from "@/lib/public-gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Public Albums",
  description: "Featured public albums from rxncor.studio."
};

function formatDate(date: string | null) {
  return date ?? "Public archive";
}

export default async function AlbumsPage() {
  const publicAlbums = await getPublicAlbumCards().catch(() => []);

  return (
    <main className="rx-page rx-albums-page">
      <PublicPageHero
        description="Complete stories rather than isolated highlights. Public albums stay open; private client deliveries remain protected behind their own links and access details."
        eyebrow="Stories and client work"
        index="ALBUMS / 03"
        meta={[`${publicAlbums.length} public stories`, "Private delivery available", "Full-resolution downloads"]}
        title="ALBUMS."
        tone="orange"
      />

      <section className="rx-album-index">
        <div className="rx-section-kicker" data-reveal>
          <span>Public archive / Latest first</span>
          <span>{String(publicAlbums.length).padStart(2, "0")} stories</span>
        </div>
        {publicAlbums.length ? (
          <div className="rx-album-grid" data-reveal>
            {publicAlbums.map((album, index) => (
              <AlbumCard
                count={album.count}
                coverUrl={album.coverUrl}
                date={formatDate(album.event_date)}
                index={index}
                key={album.slug}
                loading={index < 4 ? "eager" : "lazy"}
                slug={album.slug}
                title={album.title}
              />
            ))}
          </div>
        ) : (
          <div className="rx-empty-state" data-reveal>
            <span>Archive / Preparing</span>
            <h2>NEW STORIES<br />COMING SOON.</h2>
            <p>Public albums will appear here as soon as they are published.</p>
            <Link className="rx-pill-link" href={siteConfig.routes.portfolio}>
              View selected frames <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
