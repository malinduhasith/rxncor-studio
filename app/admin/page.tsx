import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  DatabaseBackup,
  Download,
  ExternalLink,
  FileArchive,
  ImageUp,
  Link as LinkIcon,
  LockKeyhole,
  Save,
  Search,
  Star,
  Trash2
} from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  createAlbumAction,
  createClientAction,
  deleteClientAction,
  deleteAlbumAction,
  deletePhotoAction,
  removeClientPasswordAction,
  removeZipAction,
  resetClientPasswordAction,
  setCoverPhotoAction,
  signOutAction,
  togglePhotoSelectedAction,
  updateAlbumAction,
  updateClientAction,
  updateInquiryStatusAction
} from "./actions";
import { AdminPhotoUpload } from "@/components/admin/AdminPhotoUpload";
import { AdminZipUpload } from "@/components/admin/AdminZipUpload";
import { ClientPasswordResetForm } from "@/components/admin/ClientPasswordResetForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { CopyTextButton } from "@/components/admin/CopyTextButton";
import { siteConfig } from "@/config/site";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false
  }
};

const notices: Record<string, string> = {
  "client-created": "Client created. Use that exact email and client password on /login.",
  "client-updated":
    "Client updated. If you reset the password, use the new client password on /login.",
  "client-password-reset": "Client password updated. Share the new password with the client.",
  "client-password-removed": "Client password removed.",
  "client-deleted": "Client deleted.",
  "client-error": "Client could not be created. Check the fields and try again.",
  "client-duplicate-email": "Another client already uses that email address.",
  "client-password-error": "Client password could not be saved. Set it again and try login.",
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
  "zip-error": "ZIP action could not be completed.",
  "inquiry-updated": "Inquiry status updated.",
  "inquiry-error": "Inquiry could not be updated."
};

type ClientOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password_hash?: string | null;
  created_at: string;
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
  requires_email?: boolean;
  allow_client_password_access?: boolean;
  created_at: string;
  expires_at: string | null;
};

type AdminAlbumClient = {
  album_id: string;
  client_id: string;
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

type DownloadLog = {
  id: string;
  album_id: string;
  photo_id: string | null;
  client_email: string | null;
  downloaded_at: string;
  ip_address: string | null;
};

type ContactInquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "new" | "replied" | "archived";
  created_at: string;
  ip_address: string | null;
};

type AdminPageProps = {
  searchParams: Promise<{
    notice?: string;
    album?: string;
    q?: string;
    status?: string;
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

function albumStatus(album: AdminAlbum, photoCount: number) {
  if (album.expires_at && new Date(album.expires_at) < new Date()) {
    return "Expired";
  }

  if (!photoCount) {
    return "Draft";
  }

  if (!album.download_zip_url) {
    return "Needs ZIP";
  }

  return "Ready";
}

function matchesAlbumFilter(
  album: AdminAlbum,
  query: string,
  status: string,
  photoCount: number,
  client: ClientOption | undefined
) {
  const normalizedQuery = query.trim().toLowerCase();
  const statusLabel = albumStatus(album, photoCount).toLowerCase();
  const searchableText = [
    album.title,
    album.slug,
    album.event_date,
    client?.name,
    client?.email,
    statusLabel
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const queryMatch = !normalizedQuery || searchableText.includes(normalizedQuery);

  if (!queryMatch) {
    return false;
  }

  switch (status) {
    case "public":
      return album.is_public;
    case "private":
      return !album.is_public;
    case "protected":
      return album.is_password_protected;
    case "draft":
    case "ready":
    case "expired":
    case "needs zip":
      return statusLabel === status;
    default:
      return true;
  }
}

function shareMessage({
  album,
  client,
  link,
  photoCount
}: {
  album: AdminAlbum;
  client: ClientOption | null | undefined;
  link: string;
  photoCount: number;
}) {
  const greeting = client?.name ? `Hi ${client.name},` : "Hi,";
  const expiryLine = album.expires_at
    ? `This gallery will be available until ${dateInputValue(album.expires_at)}.`
    : null;
  const passwordLine = album.is_password_protected
    ? "Password: [add the password you set for this album]"
    : "No password is required.";
  const clientPasswordLine = !album.is_public && album.allow_client_password_access !== false
    ? "Assigned clients can also use their email and personal client password."
    : null;
  const emailLine = album.requires_email
    ? "The client will be asked for their email before the gallery opens."
    : null;
  const zipLine = album.download_zip_url
    ? "You can download individual photos or the full album ZIP."
    : "You can download individual photos now. The full album ZIP will be added separately.";

  return [
    greeting,
    "",
    `Your ${album.title} gallery is ready.`,
    `Link: ${link}`,
    passwordLine,
    clientPasswordLine,
    emailLine,
    `Photos: ${photoCount}`,
    expiryLine,
    zipLine,
    "",
    "Thank you,"
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function clientLoginDetailsMessage({
  album,
  client,
  albumLink,
  photoCount
}: {
  album: AdminAlbum;
  client: ClientOption;
  albumLink: string;
  photoCount: number;
}) {
  const loginUrl = `${siteConfig.url}${siteConfig.routes.login}`;
  const expiryLine = album.expires_at
    ? `Available until: ${dateInputValue(album.expires_at)}`
    : null;

  return [
    `Hi ${client.name},`,
    "",
    `Your ${album.title} gallery is ready.`,
    `Gallery link: ${albumLink}`,
    `Client login: ${loginUrl}`,
    `Email: ${client.email ?? "[add client email]"}`,
    "Password: [paste the client password you set/reset]",
    `Photos: ${photoCount}`,
    expiryLine,
    "You can open the gallery link directly, or sign in to see all albums assigned to you.",
    "",
    "Thank you,"
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function readinessItems({
  album,
  photoCount,
  assignedClientCount
}: {
  album: AdminAlbum;
  photoCount: number;
  assignedClientCount: number;
}) {
  return [
    {
      label: "Client access",
      detail: album.is_public
        ? "Public album"
        : assignedClientCount
          ? `${assignedClientCount} assigned`
          : "Assign at least one client",
      complete: album.is_public || assignedClientCount > 0
    },
    {
      label: "Gallery protection",
      detail: album.is_password_protected
        ? "Album password set"
        : album.allow_client_password_access !== false
          ? "Client password access"
          : "No password",
      complete:
        album.is_public ||
        album.is_password_protected ||
        album.allow_client_password_access !== false
    },
    {
      label: "Photos",
      detail: photoCount ? `${photoCount} uploaded` : "Upload the album",
      complete: photoCount > 0
    },
    {
      label: "Cover",
      detail: album.cover_photo_url ? "Cover selected" : "Choose a cover",
      complete: Boolean(album.cover_photo_url)
    },
    {
      label: "Full ZIP",
      detail: album.download_zip_url ? "ZIP ready" : "Upload the delivery ZIP",
      complete: Boolean(album.download_zip_url)
    },
    {
      label: "Expiry",
      detail: album.expires_at ? dateInputValue(album.expires_at) : "No expiry set",
      complete: true
    }
  ];
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
  const {
    notice,
    album: selectedAlbumId,
    q: albumQuery = "",
    status: albumStatusFilter = "all"
  } = await searchParams;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(siteConfig.routes.adminLogin);
  }

  const [
    clientsResult,
    albumsResult,
    albumCountResult,
    photoCountResult,
    protectedAlbumCountResult,
    downloadCountResult,
    downloadLogsResult,
    albumClientsResult,
    inquiriesResult
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("albums")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("albums").select("id", { count: "exact", head: true }),
    supabase.from("photos").select("id", { count: "exact", head: true }),
    supabase
      .from("albums")
      .select("id", { count: "exact", head: true })
      .eq("is_password_protected", true),
    supabase.from("download_logs").select("id", { count: "exact", head: true }),
    supabase
      .from("download_logs")
      .select("id, album_id, photo_id, client_email, downloaded_at, ip_address")
      .order("downloaded_at", { ascending: false })
      .limit(30),
    supabase.from("album_clients").select("album_id, client_id"),
    supabase
      .from("contact_inquiries")
      .select("id, name, email, phone, message, status, created_at, ip_address")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const clients = (clientsResult.data ?? []) as ClientOption[];
  const albums = (albumsResult.data ?? []) as AdminAlbum[];
  const albumClients = (albumClientsResult.data ?? []) as AdminAlbumClient[];
  const selectedAlbum =
    albums.find((album) => album.id === selectedAlbumId) ?? albums[0] ?? null;
  const albumCount = albumCountResult.count ?? 0;
  const photoCount = photoCountResult.count ?? 0;
  const protectedAlbumCount = protectedAlbumCountResult.count ?? 0;
  const downloadCount = downloadCountResult.count ?? 0;
  const downloadLogs = (downloadLogsResult.data ?? []) as DownloadLog[];
  const inquiries = (inquiriesResult.data ?? []) as ContactInquiry[];
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
  const clientAlbumCounts = new Map<string, number>();
  const albumAssignedClientIds = new Map<string, Set<string>>();

  for (const assignment of albumClients) {
    clientAlbumCounts.set(
      assignment.client_id,
      (clientAlbumCounts.get(assignment.client_id) ?? 0) + 1
    );

    const assignedSet =
      albumAssignedClientIds.get(assignment.album_id) ?? new Set<string>();
    assignedSet.add(assignment.client_id);
    albumAssignedClientIds.set(assignment.album_id, assignedSet);
  }

  for (const album of albums) {
    if (album.client_id && !albumAssignedClientIds.get(album.id)?.has(album.client_id)) {
      clientAlbumCounts.set(
        album.client_id,
        (clientAlbumCounts.get(album.client_id) ?? 0) + 1
      );
      const assignedSet = albumAssignedClientIds.get(album.id) ?? new Set<string>();
      assignedSet.add(album.client_id);
      albumAssignedClientIds.set(album.id, assignedSet);
    }
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
  const { data: selectedAlbumLogRows } = selectedAlbum
    ? await supabase
        .from("download_logs")
        .select("id, album_id, photo_id, client_email, downloaded_at, ip_address")
        .eq("album_id", selectedAlbum.id)
        .order("downloaded_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const selectedAlbumLogs = (selectedAlbumLogRows ?? []) as DownloadLog[];
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
  const selectedAssignedClientIds = selectedAlbum
    ? albumAssignedClientIds.get(selectedAlbum.id) ?? new Set<string>()
    : new Set<string>();
  const selectedAssignedClients = clients.filter((client) =>
    selectedAssignedClientIds.has(client.id)
  );
  const selectedAlbumPhotoCount = selectedAlbum
    ? albumPhotoCounts.get(selectedAlbum.id) ?? selectedPhotos.length
    : 0;
  const selectedClientLink = selectedAlbum
    ? `${siteConfig.url}/client/${selectedAlbum.slug}`
    : "";
  const selectedShareMessage = selectedAlbum
    ? shareMessage({
        album: selectedAlbum,
        client: selectedClient,
        link: selectedClientLink,
        photoCount: selectedAlbumPhotoCount
      })
    : "";
  const selectedReadinessItems = selectedAlbum
    ? readinessItems({
        album: selectedAlbum,
        photoCount: selectedAlbumPhotoCount,
        assignedClientCount: selectedAssignedClients.length
      })
    : [];
  const selectedReadinessComplete = selectedReadinessItems.filter(
    (item) => item.complete
  ).length;
  const visibleAlbums = albums.filter((album) =>
    matchesAlbumFilter(
      album,
      albumQuery,
      albumStatusFilter.toLowerCase(),
      albumPhotoCounts.get(album.id) ?? 0,
      clients.find((client) => client.id === album.client_id)
    )
  );
  const logAlbumTitles = new Map(albums.map((album) => [album.id, album.title]));
  const logPhotoIds = [
    ...new Set(
      [...downloadLogs, ...selectedAlbumLogs]
        .map((log) => log.photo_id)
        .filter((photoId): photoId is string => Boolean(photoId))
    )
  ];
  const { data: logPhotoRows } = logPhotoIds.length
    ? await supabase.from("photos").select("id, filename").in("id", logPhotoIds)
    : { data: [] };
  const logPhotoNames = new Map(
    [
      ...selectedPhotos.map((photo) => ({ id: photo.id, filename: photo.filename })),
      ...((logPhotoRows ?? []) as { id: string; filename: string }[])
    ].map((photo) => [photo.id, photo.filename])
  );
  const noticeMessage = notice ? notices[notice] : undefined;
  const inquiriesUnavailable = Boolean(inquiriesResult.error);

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
          <a href="#logs">Download logs</a>
          <a href="#inquiries">Inquiries</a>
          <a href="#backups">Backups</a>
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

          {selectedAlbum ? (
            <section className="workflow-panel" aria-label="Selected album readiness">
              <div className="panel-title-row">
                <div>
                  <p className="eyebrow">Selected Album</p>
                  <h2>{selectedAlbum.title}</h2>
                  <p className="muted">
                    {selectedReadinessComplete}/{selectedReadinessItems.length} delivery checks
                    ready for {selectedAlbum.is_public ? "public viewing" : "client delivery"}.
                  </p>
                </div>
                <div className="inline-actions">
                  <a className="button secondary small" href="#manager">
                    Edit album
                  </a>
                  <a className="button secondary small" href="#uploads">
                    Upload files
                  </a>
                  <a className="button small" href={`/client/${selectedAlbum.slug}`}>
                    <ExternalLink size={16} />
                    View gallery
                  </a>
                </div>
              </div>
              <div className="readiness-grid">
                {selectedReadinessItems.map((item) => (
                  <div
                    className={`readiness-item ${item.complete ? "complete" : "attention"}`}
                    key={item.label}
                  >
                    {item.complete ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

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
                  <span className="pill">
                    {visibleAlbums.length}/{albums.length} shown
                  </span>
                </div>
                <form className="filter-bar" action="/admin" method="get">
                  <input name="album" type="hidden" value={selectedAlbum?.id ?? ""} />
                  <label className="field">
                    Search
                    <input
                      name="q"
                      placeholder="Album, slug, client"
                      defaultValue={albumQuery}
                    />
                  </label>
                  <label className="field">
                    Filter
                    <select name="status" defaultValue={albumStatusFilter}>
                      <option value="all">All albums</option>
                      <option value="ready">Ready</option>
                      <option value="draft">Draft</option>
                      <option value="needs zip">Needs ZIP</option>
                      <option value="expired">Expired</option>
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                      <option value="protected">Protected</option>
                    </select>
                  </label>
                  <button className="button secondary small" type="submit">
                    <Search size={16} />
                    Apply
                  </button>
                </form>
                <div className="album-list">
                  {visibleAlbums.map((album) => (
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
                        <span>{albumStatus(album, albumPhotoCounts.get(album.id) ?? 0)}</span>
                        <span>{album.is_public ? "Public" : "Private"}</span>
                        {album.requires_email ? <span>Email</span> : null}
                        {album.allow_client_password_access !== false ? (
                          <span>Client PW</span>
                        ) : null}
                        {album.is_password_protected ? <span>Protected</span> : null}
                        {album.download_zip_url ? <span>ZIP</span> : null}
                      </span>
                    </a>
                  ))}
                  {!albums.length ? <p className="muted">No albums yet.</p> : null}
                  {albums.length && !visibleAlbums.length ? (
                    <p className="muted">No albums match this filter.</p>
                  ) : null}
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
                        <CopyLinkButton value={selectedClientLink} />
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
                        <span className="label">Status</span>
                        <strong>
                          {albumStatus(selectedAlbum, selectedAlbumPhotoCount)}
                        </strong>
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
                      <div>
                        <span className="label">Assigned clients</span>
                        <strong>{selectedAssignedClients.length}</strong>
                      </div>
                      <div>
                        <span className="label">Access</span>
                        <strong>
                          {selectedAlbum.allow_client_password_access !== false
                            ? "Client password on"
                            : "Client password off"}
                          {selectedAlbum.requires_email ? " + email required" : ""}
                        </strong>
                      </div>
                    </div>

                    <div className="share-box">
                      <div className="panel-title-row">
                        <div>
                          <h3>Send to client</h3>
                          <p className="muted">
                            Copy this message into Gmail, Instagram, or SMS. For password
                            albums, add the password you set.
                          </p>
                        </div>
                        <CopyTextButton text={selectedShareMessage} label="Copy message" />
                      </div>
                      <pre>{selectedShareMessage}</pre>
                      <div className="copy-detail-list">
                        {selectedAssignedClients.map((client) => (
                          <div className="copy-detail-row" key={client.id}>
                            <div>
                              <strong>{client.name}</strong>
                              <small>{client.email ?? "No email saved"}</small>
                            </div>
                            <CopyTextButton
                              label="Copy login details"
                              text={clientLoginDetailsMessage({
                                album: selectedAlbum,
                                client,
                                albumLink: selectedClientLink,
                                photoCount: selectedAlbumPhotoCount
                              })}
                            />
                          </div>
                        ))}
                        {!selectedAssignedClients.length ? (
                          <p className="muted">
                            Assign clients below to generate client-specific login messages.
                          </p>
                        ) : null}
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
                        <input
                          name="requires_email"
                          type="checkbox"
                          defaultChecked={Boolean(selectedAlbum.requires_email)}
                        />
                        Require email before viewing
                      </label>
                      <label className="checkbox-field">
                        <input
                          name="allow_client_password_access"
                          type="checkbox"
                          defaultChecked={
                            selectedAlbum.allow_client_password_access !== false
                          }
                        />
                        Assigned clients can use their own password
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
                      <div className="assignment-list">
                        <span className="label">Assigned clients</span>
                        {clients.map((client) => (
                          <label className="checkbox-field compact" key={client.id}>
                            <input
                              name="assigned_client_ids"
                              type="checkbox"
                              value={client.id}
                              defaultChecked={selectedAssignedClientIds.has(client.id)}
                            />
                            {client.name}
                            {client.email ? ` (${client.email})` : ""}
                            {client.password_hash ? " · client password set" : ""}
                          </label>
                        ))}
                        {!clients.length ? (
                          <p className="muted">Create clients first, then assign them here.</p>
                        ) : null}
                      </div>
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

            {selectedAlbum ? (
              <div className="manager-panel file-panel">
                <div className="panel-title-row">
                  <div>
                    <h3>Download history for {selectedAlbum.title}</h3>
                    <p className="muted">
                      Per-album download history for client support and delivery checks.
                    </p>
                  </div>
                  <span className="pill">{selectedAlbumLogs.length} recent</span>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>File</th>
                        <th>Email</th>
                        <th>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAlbumLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{formatDateTime(log.downloaded_at)}</td>
                          <td>
                            {log.photo_id
                              ? logPhotoNames.get(log.photo_id) ?? log.photo_id.slice(0, 8)
                              : "Album ZIP"}
                          </td>
                          <td>{log.client_email ?? "Not captured"}</td>
                          <td>{log.ip_address ?? "Not captured"}</td>
                        </tr>
                      ))}
                      {!selectedAlbumLogs.length ? (
                        <tr>
                          <td colSpan={4}>No downloads for this album yet.</td>
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
              <label className="field">
                Client password
                <input name="password" type="password" placeholder="Optional" />
                <small>
                  Used only on the public client login page. This is separate from
                  admin login and album passwords.
                </small>
              </label>
              <button className="button" type="submit">
                Create client
              </button>
            </form>

            <div className="client-list">
              {clients.map((client) => (
                <div className="client-card" key={client.id}>
                  <form action={updateClientAction} className="client-edit-row">
                    <input name="client_id" type="hidden" value={client.id} />
                    <div>
                      <span className="label">Client login</span>
                      <strong>{client.password_hash ? "Password set" : "No password"}</strong>
                    </div>
                    <label className="field">
                      Name
                      <input name="name" defaultValue={client.name} required />
                    </label>
                    <label className="field">
                      Email
                      <input name="email" type="email" defaultValue={client.email ?? ""} />
                    </label>
                    <label className="field">
                      Phone
                      <input name="phone" defaultValue={client.phone ?? ""} />
                    </label>
                    <div>
                      <span className="label">Albums</span>
                      <strong>{clientAlbumCounts.get(client.id) ?? 0}</strong>
                    </div>
                    <button className="button secondary small" type="submit">
                      <Save size={16} />
                      Save
                    </button>
                  </form>
                  <ClientPasswordResetForm
                    clientId={client.id}
                    clientEmail={client.email}
                    clientName={client.name}
                    hasPassword={Boolean(client.password_hash)}
                    loginUrl={`${siteConfig.url}${siteConfig.routes.login}`}
                    resetAction={resetClientPasswordAction}
                    removeAction={removeClientPasswordAction}
                  />
                  <form action={deleteClientAction}>
                    <input name="client_id" type="hidden" value={client.id} />
                    <ConfirmSubmitButton
                      className="button danger small"
                      confirmMessage={`Delete ${client.name}? Albums will stay, but this client will be removed from them.`}
                    >
                      <Trash2 size={16} />
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </div>
              ))}
              {!clients.length ? <p className="muted">No clients yet.</p> : null}
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
              <label className="checkbox-field">
                <input name="requires_email" type="checkbox" />
                Require email before viewing
              </label>
              <label className="checkbox-field">
                <input name="allow_client_password_access" type="checkbox" defaultChecked />
                Assigned clients can use their own password
              </label>
              <label className="field">
                Expiry date
                <input name="expires_at" type="date" />
              </label>
              <div className="assignment-list">
                <span className="label">Assign clients</span>
                <p className="muted">
                  Choose everyone who should see this album in their client login.
                  The primary client above is included automatically.
                </p>
                {clients.map((client) => (
                  <label className="checkbox-field compact" key={client.id}>
                    <input name="assigned_client_ids" type="checkbox" value={client.id} />
                    {client.name}
                    {client.email ? ` (${client.email})` : ""}
                    {client.password_hash ? " · password set" : " · needs password"}
                  </label>
                ))}
                {!clients.length ? (
                  <p className="muted">Create clients first, then assign them here.</p>
                ) : null}
              </div>
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
                        {albumStatus(album, albumPhotoCounts.get(album.id) ?? 0)}
                        {" · "}
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

          <section id="logs" className="admin-section">
            <div className="panel-title-row">
              <div>
                <h2 style={{ fontSize: "2rem" }}>Download logs</h2>
                <p className="muted">
                  Latest downloads from client galleries. Private galleries can capture
                  client email during unlock.
                </p>
              </div>
              <span className="pill">{downloadLogs.length} recent</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Album</th>
                    <th>Photo</th>
                    <th>Email</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {downloadLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.downloaded_at)}</td>
                      <td>{logAlbumTitles.get(log.album_id) ?? log.album_id}</td>
                      <td>
                        {log.photo_id
                          ? logPhotoNames.get(log.photo_id) ?? log.photo_id.slice(0, 8)
                          : "Album ZIP"}
                      </td>
                      <td>{log.client_email ?? "Not captured"}</td>
                      <td>{log.ip_address ?? "Not captured"}</td>
                    </tr>
                  ))}
                  {!downloadLogs.length ? (
                    <tr>
                      <td colSpan={5}>No downloads logged yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section id="inquiries" className="admin-section">
            <div className="panel-title-row">
              <div>
                <h2 style={{ fontSize: "2rem" }}>Booking inquiries</h2>
                <p className="muted">
                  Messages from the homepage contact form. Reply from your email,
                  then update the status here.
                </p>
              </div>
              <span className="pill">{inquiries.length} recent</span>
            </div>
            {inquiriesUnavailable ? (
              <p className="alert">
                Booking inquiries are not available yet. Run the contact inquiries
                Supabase migration, then redeploy or refresh this page.
              </p>
            ) : null}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Client</th>
                    <th>Message</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map((inquiry) => (
                    <tr key={inquiry.id}>
                      <td>{formatDateTime(inquiry.created_at)}</td>
                      <td>
                        <strong>{inquiry.name}</strong>
                        <small>{inquiry.email}</small>
                        {inquiry.phone ? <small>{inquiry.phone}</small> : null}
                      </td>
                      <td>
                        <p className="table-message">{inquiry.message}</p>
                        <small>{inquiry.ip_address ?? "IP not captured"}</small>
                      </td>
                      <td>
                        <form action={updateInquiryStatusAction} className="status-form">
                          <input name="inquiry_id" type="hidden" value={inquiry.id} />
                          <select name="status" defaultValue={inquiry.status}>
                            <option value="new">New</option>
                            <option value="replied">Replied</option>
                            <option value="archived">Archived</option>
                          </select>
                          <button className="button secondary small" type="submit">
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {!inquiries.length ? (
                    <tr>
                      <td colSpan={4}>No booking inquiries yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section id="backups" className="admin-section">
            <div className="panel-title-row">
              <div>
                <h2 style={{ fontSize: "2rem" }}>Backup checklist</h2>
                <p className="muted">
                  R2 is delivery storage. Keep Lightroom/Capture One exports and
                  delivered ZIP files somewhere you control.
                </p>
              </div>
              <DatabaseBackup size={26} />
            </div>
            <div className="feature-list backup-list">
              <div className="feature">
                <h3>Supabase export</h3>
                <p>Export clients, albums, album_clients, photos, downloads, and inquiries weekly.</p>
              </div>
              <div className="feature">
                <h3>R2 delivery files</h3>
                <p>Keep a local or external backup of each final album ZIP before deleting R2 files.</p>
              </div>
              <div className="feature">
                <h3>Before sending</h3>
                <p>Confirm cover, assigned client, password, expiry date, photos, ZIP, and test download.</p>
              </div>
              <div className="feature">
                <h3>After sending</h3>
                <p>Check per-album download history and update inquiry/client notes outside this MVP.</p>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
