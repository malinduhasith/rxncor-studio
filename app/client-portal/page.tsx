import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlbumCard } from "@/components/AlbumCard";
import { siteConfig } from "@/config/site";
import {
  clientSessionCookieName,
  createClientSessionToken,
  parseClientSessionCookie
} from "@/lib/gallery-access";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientSignOutAction } from "./actions";

export const dynamic = "force-dynamic";

type PortalClient = {
  id: string;
  name: string;
  email: string | null;
  password_hash?: string | null;
};

type PortalAlbum = {
  id: string;
  title: string;
  slug: string;
  event_date: string | null;
  cover_photo_url: string | null;
  expires_at: string | null;
};

function formatDate(date: string | null) {
  return date ?? "Client gallery";
}

async function coverUrl(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    return await createDownloadUrl(objectKeyFromPublicUrl(url));
  } catch {
    return null;
  }
}

export default async function ClientPortalPage() {
  const cookieStore = await cookies();
  const session = parseClientSessionCookie(
    cookieStore.get(clientSessionCookieName())?.value
  );

  if (!session) {
    redirect(`${siteConfig.routes.login}?error=session`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", session.clientId)
    .maybeSingle();
  const portalClient = client as PortalClient | null;

  if (
    !portalClient?.password_hash ||
    session.token !== createClientSessionToken(portalClient.id, portalClient.password_hash)
  ) {
    redirect(`${siteConfig.routes.login}?error=session`);
  }

  const { data: assignments } = await supabase
    .from("album_clients")
    .select("album_id")
    .eq("client_id", portalClient.id);
  const albumIds = (assignments ?? []).map((assignment) => assignment.album_id);
  const { data: albumsData } = albumIds.length
    ? await supabase
        .from("albums")
        .select("id, title, slug, event_date, cover_photo_url, expires_at")
        .in("id", albumIds)
        .order("event_date", { ascending: false })
    : { data: [] };
  const albums = ((albumsData ?? []) as PortalAlbum[]).filter(
    (album) => !album.expires_at || new Date(album.expires_at) >= new Date()
  );
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

  const displayAlbums = await Promise.all(
    albums.map(async (album) => ({
      ...album,
      coverUrl: await coverUrl(album.cover_photo_url),
      count: photoCounts.get(album.id) ?? 0
    }))
  );

  return (
    <main className="shell section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Client Portal</p>
          <h1 style={{ fontSize: "clamp(3rem, 9vw, 7rem)" }}>Your albums</h1>
          <p className="muted">Signed in as {portalClient.email ?? portalClient.name}</p>
        </div>
        <form action={clientSignOutAction}>
          <button className="button secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>
      <div className="grid">
        {displayAlbums.map((album) => (
          <AlbumCard
            key={album.id}
            title={album.title}
            slug={album.slug}
            date={formatDate(album.event_date)}
            count={album.count}
            coverUrl={album.coverUrl}
          />
        ))}
      </div>
      {!displayAlbums.length ? (
        <p className="muted">No active albums are assigned to this client yet.</p>
      ) : null}
    </main>
  );
}
