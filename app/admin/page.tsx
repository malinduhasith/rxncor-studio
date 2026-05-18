import {
  CalendarDays,
  Download,
  ExternalLink,
  FileArchive,
  ImageUp,
  Link as LinkIcon,
  LockKeyhole,
  Save,
  Star,
  Trash2
} from "lucide-react";
import { redirect } from "next/navigation";
import {
  createAlbumAction,
  createClientAction,
  deleteAlbumAction,
  deletePhotoAction,
  removeZipAction,
  setCoverPhotoAction,
  signOutAction,
  togglePhotoSelectedAction,
  updateAlbumAction
} from "./actions";
import { AdminPhotoUpload } from "@/components/admin/AdminPhotoUpload";
import { AdminZipUpload } from "@/components/admin/AdminZipUpload";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { siteConfig } from "@/config/site";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  "client-created": "Client created.",
  "client-error": "Client could not be created. Check the fields and try again.",
  "album-created": "Album created.",
  "album-error": "Album could not be created. Check the slug is unique and valid.",
  "album-updated": "Album updated.",
  "album-update-error": "Album could not be updated. Check the fields and try again.",
  "album-deleted": "Album deleted.",
  "album-delete-error": "Album could not be deleted.",
  "cover-updated": "Cover photo updated.",
  "photo-uploaded": "Photo uploaded.",
  "photos-uploaded": "Photos uploaded.",
  "photo-updated": "Photo updated.",
  "photo-deleted": "Photo deleted.",
  "photo-error": "Photo action could not be completed.",
  "zip-uploaded": "Album ZIP uploaded.",
  "zip-removed": "Album ZIP removed.",
  "zip-error": "ZIP action could not be completed."
};

type ClientOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type AdminAlbum = {
  id: string;
  client_id: string | null;
  title: string;
  slug: string;
  event_date: string | null;
  is_public: boolean;
  is_password_protected: boolean;
  cover_photo_url: string | null;
  download_zip_url: string | null;
  created_at: string;
  expires_at: string | null;
};

type AdminPhoto = {
  id: string;
  album_id: string;
  filename: string;
  thumbnail_url: string;
  preview_url: string;
  full_res_url: string;
  r2_object_key: string;
  is_selected: boolean;
  uploaded_at: string;
};

type DisplayPhoto = AdminPhoto & {
  thumbnailDisplayUrl: string | null;
  previewDisplayUrl: string | null;
  fullDownloadUrl: string | null;
  isCover: boolean;
  fileType: string;
};

type AdminPageProps = {
  searchParams: Promise<{
    notice?: string;
    album?: string;
  }>;
};

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function fileType(filename: string) {
  const extension = filename.split(".").pop();

  return extension ? extension.toUpperCase() : "File";
}

async function signedObjectUrl(urlOrKey: string | null) {
  if (!urlOrKey) {
    return null;
  }

  try {
    return await createDownloadUrl(objectKeyFromPublicUrl(urlOrKey));
  } catch {
    return null;
  }
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = await createSupabaseServerClient();
  const { notice, album: selectedAlbumId } = await searchParams;
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
    supabase
      .from("clients")
      .select("id, name, email, phone")
      .order("created_at", { ascending: false }),
    supabase
      .from("albums")
      .select(
        "id, client_id, title, slug, event_date, is_public, is_password_protected, cover_photo_url, download_zip_url, created_at, expires_at"
      )
      .order("created_at", { ascending: false }),
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
  const selectedAlbum =
    albums.find((album) => album.id === selectedAlbumId) ?? albums[0] ?? null;
  const albumCount = albumCountResult.count ?? 0;
  const photoCount = photoCountResult.count ?? 0;
  const protectedAlbumCount = protectedAlbumCountResult.count ?? 0;
  const downloadCount = downloadCountResult.count ?? 0;
  const { data: albumPhotoRows } = albums.length
    ? await supabase.from("photos").select("album_id").in(
        "album_id",
        albums.map((album) => album.id)
      )
    : { data: [] };
  const albumPhotoCounts = new Map<string, number>();

  for (const row of (albumPhotoRows ?? []) as { album_id: string }[]) {
    albumPhotoCounts.set(row.album_id, (albumPhotoCounts.get(row.album_id) ?? 0) + 1);
  }

  const { data: selectedPhotoRows } = selectedAlbum
    ? await supabase
        .from("photos")
        .select(
          "id, album_id, filename, thumbnail_url, preview_url, full_res_url, r2_object_key, is_selected, uploaded_at"
        )
        .eq("album_id", selectedAlbum.id)
        .order("uploaded_at", { ascending: true })
    : { data: [] };
  const selectedPhotos = (selectedPhotoRows ?? []) as AdminPhoto[];
  const displayPhotos: DisplayPhoto[] = await Promise.all(
    selectedPhotos.map(async (photo) => ({
      ...photo,
      thumbnailDisplayUrl: await signedObjectUrl(photo.thumbnail_url),
      previewDisplayUrl: await signedObjectUrl(photo.preview_url),
      fullDownloadUrl: await signedObjectUrl(photo.r2_object_key),
      isCover: selectedAlbum?.cover_photo_url === photo.preview_url,
      fileType: fileType(photo.filename)
    }))
  );
  const selectedClient = selectedAlbum
    ? clients.find((client) => client.id === selectedAlbum.client_id)
    : null;
  const selectedAlbumPhotoCount = selectedAlbum
    ? albumPhotoCounts.get(selectedAlbum.id) ?? selectedPhotos.length
    : 0;
  const selectedClientLink = selectedAlbum
    ? `${siteConfig.url}/client/${selectedAlbum.slug}`
    : "";
  const noticeMessage = notice ? notices[notice] : undefined;

  return (
    <main className="shell section">
      <div className="admin-layout">
        <aside className="sidebar">
          <strong>Admin</strong>
          <a href="#manager">Album manager</a>
          <a href="#clients">Clients</a>
          <a href="#albums">Create album</a>
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

          <section id="manager" className="admin-section">
            <div className="section-head compact">
              <div>
                <p className="eyebrow">Album manager</p>
                <h2>Albums and files</h2>
              </div>
              <p>
                Select an album to edit details, check upload status, set a cover,
                manage ZIP delivery, and remove files.
              </p>
            </div>

            <div className="manager-grid">
              <div className="manager-panel">
                <div className="panel-title-row">
                  <h3>Album list</h3>
                  <span className="pill">{albums.length} total</span>
                </div>
                <div className="album-list">
                  {albums.map((album) => (
                    <a
                      className={`album-list-row ${
                        selectedAlbum?.id === album.id ? "active" : ""
                      }`}
                      href={`/admin?album=${album.id}#manager`}
                      key={album.id}
                    >
                      <span>
                        <strong>{album.title}</strong>
                        <small>{album.slug}</small>
                      </span>
                      <span className="album-badges">
                        <span>{albumPhotoCounts.get(album.id) ?? 0} photos</span>
                        <span>{album.is_public ? "Public" : "Private"}</span>
                        {album.is_password_protected ? <span>Protected</span> : null}
                        {album.download_zip_url ? <span>ZIP</span> : null}
                      </span>
                    </a>
                  ))}
                  {!albums.length ? <p className="muted">No albums yet.</p> : null}
                </div>
              </div>

              <div className="manager-panel">
                {selectedAlbum ? (
                  <>
                    <div className="panel-title-row">
                      <div>
                        <h3>{selectedAlbum.title}</h3>
                        <p className="muted">
                          {selectedAlbumPhotoCount} photos
                          {selectedClient ? ` · ${selectedClient.name}` : ""}
                        </p>
                      </div>
                      <div className="inline-actions">
                        <a className="button secondary small" href={`/client/${selectedAlbum.slug}`}>
                          <ExternalLink size={16} />
                          Open gallery
                        </a>
                        {selectedAlbum.is_public ? (
                          <a className="button secondary small" href="/albums">
                            <ExternalLink size={16} />
                            Public page
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="detail-grid">
                      <div>
                        <span className="label">Client link</span>
                        <code className="code-line">{selectedClientLink}</code>
                      </div>
                      <div>
                        <span className="label">Created</span>
                        <strong>{formatDateTime(selectedAlbum.created_at)}</strong>
                      </div>
                      <div>
                        <span className="label">ZIP</span>
                        <strong>{selectedAlbum.download_zip_url ? "Uploaded" : "Missing"}</strong>
                      </div>
                      <div>
                        <span className="label">Cover</span>
                        <strong>{selectedAlbum.cover_photo_url ? "Set" : "Not set"}</strong>
                      </div>
                    </div>

                    <form action={updateAlbumAction} className="compact-form">
                      <input name="album_id" type="hidden" value={selectedAlbum.id} />
                      <label className="field">
                        Client
                        <select name="client_id" defaultValue={selectedAlbum.client_id ?? ""}>
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
                        <input name="title" defaultValue={selectedAlbum.title} required />
                      </label>
                      <label className="field">
                        Slug
                        <input
                          name="slug"
                          defaultValue={selectedAlbum.slug}
                          pattern="[a-z0-9-]+"
                          required
                        />
                      </label>
                      <label className="field">
                        Event date
                        <input
                          name="event_date"
                          type="date"
                          defaultValue={dateInputValue(selectedAlbum.event_date)}
                        />
                      </label>
                      <label className="field">
                        New password
                        <input
                          name="password"
                          type="password"
                          placeholder={
                            selectedAlbum.is_password_protected
                              ? "Leave blank to keep current password"
                              : "Optional"
                          }
                        />
                      </label>
                      <label className="checkbox-field">
                        <input
                          name="is_public"
                          type="checkbox"
                          defaultChecked={selectedAlbum.is_public}
                        />
                        Public album
                      </label>
                      <label className="checkbox-field">
                        <input name="remove_password" type="checkbox" />
                        Remove password protection
                      </label>
                      <label className="field">
                        Expiry date
                        <input
                          name="expires_at"
                          type="date"
                          defaultValue={dateInputValue(selectedAlbum.expires_at)}
                        />
                      </label>
                      <button className="button" type="submit">
                        <Save size={18} />
                        Save album details
                      </button>
                    </form>

                    <div className="danger-zone">
                      <form action={deleteAlbumAction}>
                        <input name="album_id" type="hidden" value={selectedAlbum.id} />
                        <ConfirmSubmitButton
                          className="button danger"
                          confirmMessage={`Delete ${selectedAlbum.title} and all uploaded R2 files?`}
                        >
                          <Trash2 size={18} />
                          Delete album
                        </ConfirmSubmitButton>
                      </form>
                      {selectedAlbum.download_zip_url ? (
                        <form action={removeZipAction}>
                          <input name="album_id" type="hidden" value={selectedAlbum.id} />
                          <ConfirmSubmitButton
                            className="button secondary"
                            confirmMessage={`Remove the ZIP file for ${selectedAlbum.title}?`}
                          >
                            <FileArchive size={18} />
                            Remove ZIP
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="muted">Create an album first, then it will appear here.</p>
                )}
              </div>
            </div>

            {selectedAlbum ? (
              <div className="manager-panel file-panel">
                <div className="panel-title-row">
                  <div>
                    <h3>Files in {selectedAlbum.title}</h3>
                    <p className="muted">
                      {displayPhotos.length} files shown with upload date, R2 key,
                      cover status, and actions.
                    </p>
                  </div>
                  <a className="button secondary small" href="#uploads">
                    <ImageUp size={16} />
                    Upload more
                  </a>
                </div>
                <div className="table-wrap">
                  <table className="table file-table">
                    <thead>
                      <tr>
                        <th>Preview</th>
                        <th>File</th>
                        <th>Data</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayPhotos.map((photo) => (
                        <tr key={photo.id}>
                          <td>
                            {photo.thumbnailDisplayUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                className="mini-thumb"
                                src={photo.thumbnailDisplayUrl}
                                alt={photo.filename}
                              />
                            ) : (
                              <span className="mini-thumb placeholder">No preview</span>
                            )}
                          </td>
                          <td>
                            <strong>{photo.filename}</strong>
                            <small>{photo.fileType}</small>
                          </td>
                          <td>
                            <span>Uploaded {formatDateTime(photo.uploaded_at)}</span>
                            <code className="code-line">{photo.r2_object_key}</code>
                          </td>
                          <td>
                            <span className="album-badges">
                              {photo.isCover ? <span>Cover</span> : null}
                              {photo.is_selected ? <span>Selected</span> : null}
                              {!photo.isCover && !photo.is_selected ? <span>Ready</span> : null}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              {photo.previewDisplayUrl ? (
                                <a
                                  className="button secondary small"
                                  href={photo.previewDisplayUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink size={16} />
                                  Preview
                                </a>
                              ) : null}
                              {photo.fullDownloadUrl ? (
                                <a
                                  className="button secondary small"
                                  href={photo.fullDownloadUrl}
                                >
                                  <Download size={16} />
                                  Full
                                </a>
                              ) : null}
                              <form action={setCoverPhotoAction}>
                                <input name="photo_id" type="hidden" value={photo.id} />
                                <button
                                  className="button secondary small"
                                  disabled={photo.isCover}
                                  type="submit"
                                >
                                  <Star size={16} />
                                  Cover
                                </button>
                              </form>
                              <form action={togglePhotoSelectedAction}>
                                <input name="photo_id" type="hidden" value={photo.id} />
                                <button className="button secondary small" type="submit">
                                  <Star size={16} />
                                  {photo.is_selected ? "Unselect" : "Select"}
                                </button>
                              </form>
                              <form action={deletePhotoAction}>
                                <input name="photo_id" type="hidden" value={photo.id} />
                                <ConfirmSubmitButton
                                  className="button danger small"
                                  confirmMessage={`Delete ${photo.filename} from this album and R2?`}
                                >
                                  <Trash2 size={16} />
                                  Delete
                                </ConfirmSubmitButton>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!displayPhotos.length ? (
                        <tr>
                          <td colSpan={5}>No photos uploaded to this album yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>

          <section id="clients" className="admin-section">
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

            <div className="table-wrap" style={{ marginTop: 24 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Email</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td>{client.email ?? "Not set"}</td>
                      <td>{client.phone ?? "Not set"}</td>
                    </tr>
                  ))}
                  {!clients.length ? (
                    <tr>
                      <td colSpan={3}>No clients yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section id="albums" className="admin-section">
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

          <section id="uploads" className="admin-section">
            <h2 style={{ fontSize: "2rem" }}>Upload workflow</h2>
            <h3>Photos</h3>
            <AdminPhotoUpload albums={albums} />
            <h3 style={{ marginTop: 30 }}>Full album ZIP</h3>
            <AdminZipUpload albums={albums} />
          </section>

          <section id="delivery" className="admin-section">
            <h2 style={{ fontSize: "2rem" }}>Delivery overview</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Album</th>
                    <th>Slug</th>
                    <th>Photos</th>
                    <th>Status</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {albums.map((album) => (
                    <tr key={album.id}>
                      <td>{album.title}</td>
                      <td>{album.slug}</td>
                      <td>{albumPhotoCounts.get(album.id) ?? 0}</td>
                      <td>
                        {album.is_public ? "Public" : "Private"}
                        {album.is_password_protected ? " + protected" : ""}
                        {album.download_zip_url ? " + ZIP" : ""}
                      </td>
                      <td>
                        <a className="button secondary small" href={`/client/${album.slug}`}>
                          <ExternalLink size={16} />
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                  {!albums.length ? (
                    <tr>
                      <td colSpan={5}>No albums yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
