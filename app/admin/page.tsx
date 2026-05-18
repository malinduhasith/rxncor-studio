import { CalendarDays, ImageUp, Link as LinkIcon, LockKeyhole } from "lucide-react";

const recentAlbums = [
  ["Chaya Birthday", "chaya-birthday-2026", "128 photos", "Protected"],
  ["Studio Portrait Selects", "a8f3k2x9", "42 photos", "Protected"],
  ["Family Afternoon", "family-afternoon", "86 photos", "Public"]
];

export default function AdminPage() {
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
          <p className="eyebrow">Dashboard</p>
          <h1 style={{ fontSize: "clamp(2.6rem, 8vw, 5.8rem)" }}>Gallery control</h1>

          <div className="stat-grid">
            <div className="stat">
              <CalendarDays size={20} />
              <strong>3</strong>
              <span>Albums</span>
            </div>
            <div className="stat">
              <ImageUp size={20} />
              <strong>256</strong>
              <span>Photos</span>
            </div>
            <div className="stat">
              <LockKeyhole size={20} />
              <strong>2</strong>
              <span>Protected</span>
            </div>
            <div className="stat">
              <LinkIcon size={20} />
              <strong>5</strong>
              <span>Downloads</span>
            </div>
          </div>

          <section id="clients" className="section" style={{ padding: "28px 0" }}>
            <h2 style={{ fontSize: "2rem" }}>Create client</h2>
            <form>
              <label className="field">
                Client name
                <input name="name" placeholder="Client name" />
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
            <form>
              <label className="field">
                Album title
                <input name="title" placeholder="Chaya Birthday 2026" />
              </label>
              <label className="field">
                Slug
                <input name="slug" placeholder="chaya-birthday-2026 or a8f3k2x9" />
              </label>
              <label className="field">
                Password
                <input name="password" type="password" />
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
            <p className="muted">
              Export thumbnails, previews, full delivery files, and ZIPs first.
              Upload them to R2 under albums/[slug]/, then save generated URLs in
              Supabase.
            </p>
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
                {recentAlbums.map((album) => (
                  <tr key={album[1]}>
                    {album.map((value) => (
                      <td key={value}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      </div>
    </main>
  );
}
