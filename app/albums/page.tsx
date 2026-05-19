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
    <main className="shell section editorial-page">
      <div className="section-head numbered" data-index="01">
        <div>
          <p className="eyebrow">Featured Albums</p>
          <h1 className="page-title">Public albums</h1>
        </div>
        <p>
          Public albums can be shown here. Private albums should stay discoverable
          only by direct client link.
        </p>
      </div>
      <div className="grid album-gallery-grid">
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
