import type { Metadata } from "next";
import { AlbumCard } from "@/components/AlbumCard";
import { getPublicAlbumCards } from "@/lib/public-gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Public Albums",
  description: "Featured public albums from rxncor.studio."
};

function formatDate(date: string | null) {
  if (!date) {
    return "Public";
  }

  return date;
}

export default async function AlbumsPage() {
  const publicAlbums = await getPublicAlbumCards();

  return (
    <main className="shell section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Featured Albums</p>
          <h1 style={{ fontSize: "clamp(3rem, 9vw, 7rem)" }}>Public albums</h1>
        </div>
        <p>
          Public albums can be shown here. Private albums should stay discoverable
          only by direct client link.
        </p>
      </div>
      <div className="grid">
        {publicAlbums.map((album) => (
          <AlbumCard
            key={album.slug}
            title={album.title}
            slug={album.slug}
            date={formatDate(album.event_date)}
            count={album.count}
            coverUrl={album.coverUrl}
          />
        ))}
      </div>
      {!publicAlbums.length ? (
        <p className="muted">No public albums are live yet.</p>
      ) : null}
    </main>
  );
}
