import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlbumCard } from "@/components/AlbumCard";
import { NoticeToaster } from "@/components/Notice";
import { PublicPageHero } from "@/components/public/PublicPageHero";
import { siteConfig } from "@/config/site";
import {
  clientSessionCookieName,
  createClientSessionToken,
  parseClientSessionCookie
} from "@/lib/gallery-access";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientPortalNotices } from "@/lib/notices";
import { changeClientPasswordAction, clientSignOutAction } from "./actions";

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

type ClientPortalPageProps = {
  searchParams: Promise<{
    password?: string;
  }>;
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

export default async function ClientPortalPage({
  searchParams
}: ClientPortalPageProps) {
  const { password } = await searchParams;
  const passwordNotice = password ? clientPortalNotices[password] : undefined;
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

  const [{ data: assignments }, { data: legacyAssignments }] = await Promise.all([
    supabase
      .from("album_clients")
      .select("album_id")
      .eq("client_id", portalClient.id),
    supabase
      .from("albums")
      .select("id")
      .eq("client_id", portalClient.id)
  ]);
  const albumIds = [
    ...new Set([
      ...(assignments ?? []).map((assignment) => assignment.album_id),
      ...(legacyAssignments ?? []).map((album) => album.id)
    ])
  ];
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
  const photoCounts = new Map(
    await Promise.all(
      albums.map(async (album) => {
        const { count } = await supabase
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("album_id", album.id);

        return [album.id, count ?? 0] as const;
      })
    )
  );

  const displayAlbums = await Promise.all(
    albums.map(async (album) => ({
      ...album,
      coverUrl: await coverUrl(album.cover_photo_url),
      count: photoCounts.get(album.id) ?? 0
    }))
  );

  return (
    <main className="rx-page rx-portal-page">
      <NoticeToaster cleanupQueryKeys={["password"]} notices={[passwordNotice]} />
      <PublicPageHero
        description={`Welcome back, ${portalClient.name}. Every active story assigned to this client account is collected here.`}
        eyebrow="Private client portal"
        index="DELIVERY / 01"
        meta={[
          portalClient.email ?? portalClient.name,
          `${displayAlbums.length} active galleries`,
          "Protected access"
        ]}
        title="YOUR ALBUMS."
        tone="dark"
      >
        <form action={clientSignOutAction}>
          <button className="rx-outline-button" type="submit">Sign out</button>
        </form>
      </PublicPageHero>

      <section className="rx-album-index rx-portal-albums">
        <div className="rx-section-kicker" data-reveal>
          <span>Assigned stories / Active</span>
          <span>{String(displayAlbums.length).padStart(2, "0")} galleries</span>
        </div>
        {displayAlbums.length ? (
          <div className="rx-album-grid" data-reveal>
            {displayAlbums.map((album, index) => (
              <AlbumCard
                count={album.count}
                coverUrl={album.coverUrl}
                date={formatDate(album.event_date)}
                index={index}
                key={album.id}
                loading={index < 4 ? "eager" : "lazy"}
                slug={album.slug}
                title={album.title}
              />
            ))}
          </div>
        ) : (
          <div className="rx-empty-state" data-reveal>
            <span>Delivery / Waiting</span>
            <h2>NO ACTIVE<br />ALBUMS YET.</h2>
            <p>Your assigned galleries will appear here when they are ready.</p>
          </div>
        )}
      </section>

      <section className="rx-portal-password">
        <div data-reveal>
          <span>Account security / 02</span>
          <h2>MAKE THE<br />PASSWORD<br />YOURS.</h2>
          <p>If you received a temporary password, replace it here after signing in.</p>
        </div>
        <form action={changeClientPasswordAction} className="rx-form" data-reveal>
          <label className="field">
            <span>01 / Current password</span>
            <input name="current_password" autoComplete="current-password" required type="password" />
          </label>
          <label className="field">
            <span>02 / New password</span>
            <input name="new_password" autoComplete="new-password" minLength={6} required type="password" />
          </label>
          <label className="field">
            <span>03 / Confirm new password</span>
            <input name="confirm_password" autoComplete="new-password" minLength={6} required type="password" />
          </label>
          <button type="submit">Update password <span aria-hidden="true">↗</span></button>
        </form>
      </section>
    </main>
  );
}
