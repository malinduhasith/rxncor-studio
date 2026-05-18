import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicAlbumCard = {
  id: string;
  title: string;
  slug: string;
  event_date: string | null;
  coverUrl: string | null;
  count: number;
};

export type PublicPortfolioPhoto = {
  id: string;
  title: string;
  meta: string;
  imageUrl: string | null;
};

type PublicAlbumRow = {
  id: string;
  title: string;
  slug: string;
  event_date: string | null;
  cover_photo_url: string | null;
};

type PublicPhotoRow = {
  id: string;
  album_id: string;
  filename: string;
  preview_url: string;
  uploaded_at: string;
};

function activeAlbumFilter(album: { expires_at?: string | null }) {
  return !album.expires_at || new Date(album.expires_at) >= new Date();
}

async function signedUrl(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    return await createDownloadUrl(objectKeyFromPublicUrl(url));
  } catch {
    return null;
  }
}

export async function getPublicAlbumCards(limit?: number) {
  const supabase = createSupabaseAdminClient();
  let albumQuery = supabase
    .from("albums")
    .select("id, title, slug, event_date, cover_photo_url, expires_at")
    .eq("is_public", true)
    .order("event_date", { ascending: false });

  if (limit) {
    albumQuery = albumQuery.limit(limit);
  }

  const { data: albumsData } = await albumQuery;
  const albums = ((albumsData ?? []) as (PublicAlbumRow & {
    expires_at: string | null;
  })[]).filter(activeAlbumFilter);
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

  return Promise.all(
    albums.map(async (album) => ({
      id: album.id,
      title: album.title,
      slug: album.slug,
      event_date: album.event_date,
      coverUrl: await signedUrl(album.cover_photo_url),
      count: photoCounts.get(album.id) ?? 0
    }))
  );
}

export async function getPublicPortfolioPhotos(limit = 9) {
  const supabase = createSupabaseAdminClient();
  const { data: albumRows } = await supabase
    .from("albums")
    .select("id, title, event_date, expires_at")
    .eq("is_public", true)
    .order("event_date", { ascending: false });
  const albums = ((albumRows ?? []) as {
    id: string;
    title: string;
    event_date: string | null;
    expires_at: string | null;
  }[]).filter(activeAlbumFilter);
  const albumIds = albums.map((album) => album.id);
  const albumTitles = new Map(albums.map((album) => [album.id, album.title]));

  if (!albumIds.length) {
    return [];
  }

  const { data: photoRows } = await supabase
    .from("photos")
    .select("id, album_id, filename, preview_url, uploaded_at")
    .in("album_id", albumIds)
    .order("uploaded_at", { ascending: false })
    .limit(limit);
  const photos = (photoRows ?? []) as PublicPhotoRow[];

  return Promise.all(
    photos.map(async (photo) => ({
      id: photo.id,
      title: photo.filename.replace(/\.[^.]+$/, ""),
      meta: albumTitles.get(photo.album_id) ?? "Portfolio",
      imageUrl: await signedUrl(photo.preview_url)
    }))
  );
}
