import type { Metadata } from "next";
import Link from "next/link";
import { AlbumCard } from "@/components/AlbumCard";
import { CompositionMark } from "@/components/home/CompositionMark";
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
      <div className="rx-albums-hero-stage">
        <PublicPageHero
          description="Complete stories rather than isolated highlights. Public albums stay open; private client deliveries remain protected behind their own links and access details."
          eyebrow="Stories and client work"
          index="ALBUMS / 03"
          meta={[`${publicAlbums.length} public stories`, "Private delivery available", "Full-resolution downloads"]}
          title="ALBUMS."
          tone="orange"
        />
        <div aria-hidden="true" className="rx-albums-hero-vectors">
          <CompositionMark className="rx-albums-vector rx-albums-vector-aperture" variant="aperture" />
          <CompositionMark className="rx-albums-vector rx-albums-vector-thirds" variant="thirds" />
          <CompositionMark className="rx-albums-vector rx-albums-vector-perspective" variant="perspective" />
          <CompositionMark className="rx-albums-vector rx-albums-vector-meter" variant="meter" />
          <CompositionMark className="rx-albums-vector rx-albums-vector-waveform" variant="waveform" />
          <CompositionMark className="rx-albums-vector rx-albums-vector-spiral" variant="spiral" />
        </div>
      </div>

      <section className="rx-album-index">
        <div aria-hidden="true" className="rx-albums-index-vectors">
          <CompositionMark className="rx-albums-index-vector rx-albums-index-sensor" variant="sensor" />
          <CompositionMark className="rx-albums-index-vector rx-albums-index-triangles" variant="triangles" />
          <CompositionMark className="rx-albums-index-vector rx-albums-index-v" variant="v" />
          <CompositionMark className="rx-albums-index-vector rx-albums-index-radial" variant="radial" />
          <CompositionMark className="rx-albums-index-vector rx-albums-index-curve" variant="curve" />
          <CompositionMark className="rx-albums-index-vector rx-albums-index-tunnel" variant="tunnel" />
        </div>
        <div className="rx-section-kicker" data-reveal>
          <span>Public archive / Latest first</span>
          <span>{String(publicAlbums.length).padStart(2, "0")} stories</span>
        </div>
        <div aria-hidden="true" className="rx-albums-instrument-rail" data-reveal>
          <div><span>01 / Focus plane</span><CompositionMark variant="focus" /></div>
          <div><span>02 / Exposure arc</span><CompositionMark variant="meter" /></div>
          <div><span>03 / Sensor grid</span><CompositionMark variant="sensor" /></div>
          <div><span>04 / Tonal signal</span><CompositionMark variant="waveform" /></div>
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
