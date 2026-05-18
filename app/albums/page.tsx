import { AlbumCard } from "@/components/AlbumCard";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
import { featuredAlbums } from "@/lib/sample-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PublicAlbum = {
  id: string;
  title: string;
  slug: string;
  event_date: string | null;
  cover_photo_url: string | null;
};

function formatDate(date: string | null) {
  if (!date) {
    return "Public";
  }

  return date;
}

export default async function AlbumsPage() {
  const supabase = createSupabaseAdminClient();
  const { data: albumsData } = await supabase
    .from("albums")
    .select("id, title, slug, event_date, cover_photo_url")
    .eq("is_public", true)
    .order("event_date", { ascending: false });
  const albums = (albumsData ?? []) as PublicAlbum[];
  const { data: photoRows } = albums.length
    ? await supabase.from("photos").select("album_id").in(
        "album_id",
        albums.map((album) => album.id)
      )
    : { data: [] };
  const photoCounts = new Map<string, number>();

  for (const row of (photoRows ?? []) as { album_id: string }[]) {
    photoCounts.set(row.album_id, (photoCounts.get(row.album_id) ?? 0) + 1);
  }

  const publicAlbums = await Promise.all(
    albums.map(async (album) => ({
      ...album,
      coverUrl: album.cover_photo_url
        ? await createDownloadUrl(objectKeyFromPublicUrl(album.cover_photo_url))
        : null,
      count: photoCounts.get(album.id) ?? 0
    }))
  );

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
        {!publicAlbums.length
          ? featuredAlbums.map((album) => <AlbumCard key={album.slug} {...album} />)
          : null}
      </div>
    </main>
  );
}
