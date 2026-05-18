import { CalendarDays, ImageUp, Link as LinkIcon, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { createAlbumAction, createClientAction, signOutAction } from "./actions";
import { AdminPhotoUpload } from "@/components/admin/AdminPhotoUpload";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  "client-created": "Client created.",
  "client-error": "Client could not be created. Check the fields and try again.",
  "album-created": "Album created.",
  "album-error": "Album could not be created. Check the slug is unique and valid.",
  "photo-uploaded": "Photo uploaded.",
  "photos-uploaded": "Photos uploaded."
};

type ClientOption = {
  id: string;
  name: string;
  email: string | null;
};

type AdminAlbum = {
  id: string;
  title: string;
  slug: string;
  is_public: boolean;
  is_password_protected: boolean;
};

type AdminPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = await createSupabaseServerClient();
  const { notice } = await searchParams;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    clientsResult,
    albumsResult,
    albumCountResult,
    photoCountResult,
    protectedAlbumCountResult,
    downloadCountResult
  ] = await Promise.all([
    supabase.from("clients").select("id, name, email").order("created_at", {
      ascending: false
    }),
    supabase
      .from("albums")
      .select("id, title, slug, is_public, is_password_protected, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("albums").select("id", { count: "exact", head: true }),
    supabase.from("photos").select("id", { count: "exact", head: true }),
    supabase
      .from("albums")
      .select("id", { count: "exact", head: true })
      .eq("is_password_protected", true),
    supabase.from("download_logs").select("id", { count: "exact", head: true })
  ]);

  const clients = (clientsResult.data ?? []) as ClientOption[];
  const albums = (albumsResult.data ?? []) as AdminAlbum[];
  const albumCount = albumCountResult.count ?? 0;
  const photoCount = photoCountResult.count ?? 0;
  const protectedAlbumCount = protectedAlbumCountResult.count ?? 0;
  const downloadCount = downloadCountResult.count ?? 0;
  const noticeMessage = notice ? notices[notice] : undefined;

  return (
    <main className="shell section">
      <div className="admin-layout">
        <aside className="sidebar">
          <strong>Admin</strong>
          <a href="#clients">Clients</a>
          <a href="#albums">Albums</a>
          <a href="#uploads">Uploads</a>
          <a href="#delivery">Delivery</a>
        </aside>

        <section className="dashboard-panel">
          <div className="admin-topbar">
            <div>
              <p className="eyebrow">Dashboard</p>
              <p className="muted">Signed in as {user.email}</p>
            </div>
            <form action={signOutAction}>
              <button className="button secondary" type="submit">
                Sign out
              </button>
            </form>
          </div>
          <h1 style={{ fontSize: "clamp(2.6rem, 8vw, 5.8rem)" }}>Gallery control</h1>
          {noticeMessage ? <p className="alert success">{noticeMessage}</p> : null}

          <div className="stat-grid">
            <div className="stat">
              <CalendarDays size={20} />
              <strong>{albumCount}</strong>
              <span>Albums</span>
            </div>
            <div className="stat">
              <ImageUp size={20} />
              <strong>{photoCount}</strong>
              <span>Photos</span>
            </div>
            <div className="stat">
              <LockKeyhole size={20} />
              <strong>{protectedAlbumCount}</strong>
              <span>Protected</span>
            </div>
            <div className="stat">
              <LinkIcon size={20} />
              <strong>{downloadCount}</strong>
              <span>Downloads</span>
            </div>
          </div>

          <section id="clients" className="section" style={{ padding: "28px 0" }}>
            <h2 style={{ fontSize: "2rem" }}>Create client</h2>
            <form action={createClientAction}>
              <label className="field">
                Client name
                <input name="name" placeholder="Client name" required />
              </label>
              <label className="field">
                Email
                <input name="email" type="email" placeholder="client@example.com" />
              </label>
              <label className="field">
                Phone
                <input name="phone" placeholder="+61" />
              </label>
              <button className="button" type="submit">
                Create client
              </button>
            </form>
          </section>

          <section id="albums" className="section" style={{ padding: "28px 0" }}>
            <h2 style={{ fontSize: "2rem" }}>Create album</h2>
            <form action={createAlbumAction}>
              <label className="field">
                Client
                <select name="client_id" defaultValue="">
                  <option value="">No client selected</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.email ? ` (${client.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Album title
                <input name="title" placeholder="Chaya Birthday 2026" required />
              </label>
              <label className="field">
                Slug
                <input
                  name="slug"
                  pattern="[a-z0-9-]+"
                  placeholder="chaya-birthday-2026 or a8f3k2x9"
                  required
                />
              </label>
              <label className="field">
                Event date
                <input name="event_date" type="date" />
              </label>
              <label className="field">
                Password
                <input name="password" type="password" />
              </label>
              <label className="checkbox-field">
                <input name="is_public" type="checkbox" />
                Public album
              </label>
              <label className="field">
                Expiry date
                <input name="expires_at" type="date" />
              </label>
              <button className="button" type="submit">
                Save album
              </button>
            </form>
          </section>

          <section id="uploads" className="section" style={{ padding: "28px 0" }}>
            <h2 style={{ fontSize: "2rem" }}>Upload workflow</h2>
            <AdminPhotoUpload albums={albums} />
          </section>

          <section id="delivery" className="section" style={{ padding: "28px 0" }}>
            <h2 style={{ fontSize: "2rem" }}>Recent albums</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Album</th>
                  <th>Slug</th>
                  <th>Photos</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {albums.map((album) => (
                  <tr key={album.id}>
                    <td>{album.title}</td>
                    <td>{album.slug}</td>
                    <td>Upload next</td>
                    <td>
                      {album.is_public ? "Public" : "Private"}
                      {album.is_password_protected ? " + protected" : ""}
                    </td>
                  </tr>
                ))}
                {!albums.length ? (
                  <tr>
                    <td colSpan={4}>No albums yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </section>
      </div>
    </main>
  );
}
