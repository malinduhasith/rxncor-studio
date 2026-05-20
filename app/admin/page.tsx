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
  createAboutBlockAction,
  createAlbumAction,
  createClientAction,
  deleteAboutBlockAction,
  deleteClientAction,
  deleteAlbumAction,
  deletePhotoAction,
  deleteShootRequestAction,
  removeClientPasswordAction,
  removeZipAction,
  resetClientPasswordAction,
  setCoverPhotoAction,
  signOutAction,
  togglePhotoSelectedAction,
  updateAboutBlockAction,
  updateAboutSettingsAction,
  updateAlbumAction,
  updateClientAction,
  updateInquiryStatusAction,
  updateShootRequestAction
} from "./actions";
import { AdminPhotoUpload } from "@/components/admin/AdminPhotoUpload";
import { AdminZipUpload } from "@/components/admin/AdminZipUpload";
import { AlbumSlugFields } from "@/components/admin/AlbumSlugFields";
import { ClientPasswordResetForm } from "@/components/admin/ClientPasswordResetForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { CopyTextButton } from "@/components/admin/CopyTextButton";
import { siteConfig } from "@/config/site";
import {
  aboutBlockKindCopy,
  aboutBlockKinds,
  aboutBlockSectionCopy,
  aboutBlockSections,
  getAboutPageContent,
  metaItemsToLines
} from "@/lib/about-builder";
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
  "album-error": "Album could not be created. Check the album details and try again.",
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
  "inquiry-error": "Inquiry could not be updated.",
  "shoot-request-updated": "Shoot request updated.",
  "shoot-request-deleted": "Shoot request deleted.",
  "shoot-request-error": "Shoot request could not be updated.",
  "shoot-request-conflict":
    "That accepted shoot overlaps another accepted booking. Adjust the time or decline/archive one first.",
  "about-updated": "About page settings updated.",
  "about-block-created": "About page block added.",
  "about-block-updated": "About page block updated.",
  "about-block-deleted": "About page block deleted.",
  "about-error": "About page settings could not be saved.",
  "about-meta-error": "About metadata needs at least one valid line like Based in: Melbourne.",
  "about-block-error": "About page block could not be saved.",
  "about-setup-error":
    "About builder tables are not available yet. Run the Supabase about builder migration."
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

type ShootRequest = {
  id: string;
  client_id: string | null;
  album_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  shoot_type: string;
  location: string | null;
  message: string | null;
  preferred_start_at: string;
  preferred_end_at: string;
  status: "new" | "reviewing" | "accepted" | "declined" | "archived";
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  ip_address: string | null;
};

type AdminPageProps = {
  searchParams: Promise<{
    notice?: string;
    album?: string;
    q?: string;
    status?: string;
    view?: string;
  }>;
};

const adminViews = [
  "overview",
  "about",
  "albums",
  "clients",
  "new-album",
  "uploads",
  "delivery",
  "downloads",
  "requests",
  "inquiries",
  "backups"
] as const;

type AdminView = (typeof adminViews)[number];

const adminViewCopy: Record<AdminView, { label: string; title: string; detail: string }> = {
  overview: {
    label: "Overview",
    title: "Today in the studio",
    detail: "A quick read on delivery health, recent activity, and what needs attention."
  },
  about: {
    label: "About Builder",
    title: "About page builder",
    detail: "Edit the About page hero, metadata, cards, banners, spoken notes, timeline, and tools."
  },
  albums: {
    label: "Albums",
    title: "Albums and files",
    detail: "Select an album, edit gallery details, manage files, set covers, and copy client links."
  },
  clients: {
    label: "Clients",
    title: "Client records",
    detail: "Create clients, reset client passwords, and keep contact details tidy."
  },
  "new-album": {
    label: "New Album",
    title: "Create album",
    detail: "Start a public or private gallery, assign clients, and set delivery rules."
  },
  uploads: {
    label: "Uploads",
    title: "Upload workflow",
    detail: "Upload matched thumbnails, previews, full-res files, and the final delivery ZIP."
  },
  delivery: {
    label: "Delivery",
    title: "Delivery overview",
    detail: "Scan every gallery status before sending client links."
  },
  downloads: {
    label: "Downloads",
    title: "Download logs",
    detail: "Review recent client downloads and support access questions."
  },
  requests: {
    label: "Requests",
    title: "Shoot requests",
    detail: "Review booking requests, protect accepted slots from overlaps, and create client records."
  },
  inquiries: {
    label: "Inquiries",
    title: "Booking inquiries",
    detail: "Track general messages from the contact form and mark replies."
  },
  backups: {
    label: "Backups",
    title: "Backup checklist",
    detail: "Keep a small operational checklist for Supabase exports and R2 delivery files."
  }
};

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function isAdminView(value: string | undefined): value is AdminView {
  return adminViews.includes(value as AdminView);
}

function viewFromNotice(
  notice: string | undefined,
  selectedAlbumId?: string
): AdminView {
  if (!notice) {
    return selectedAlbumId ? "albums" : "overview";
  }

  if (notice.startsWith("client")) {
    return "clients";
  }

  if (notice.startsWith("album-created") || notice.startsWith("album-error")) {
    return "new-album";
  }

  if (
    notice.startsWith("album") ||
    notice.startsWith("cover") ||
    notice.startsWith("photo")
  ) {
    return "albums";
  }

  if (notice === "zip-removed") {
    return selectedAlbumId ? "albums" : "uploads";
  }

  if (notice.startsWith("zip")) {
    return "uploads";
  }

  if (notice.startsWith("shoot-request")) {
    return "requests";
  }

  if (notice.startsWith("inquiry")) {
    return "inquiries";
  }

  if (notice.startsWith("about")) {
    return "about";
  }

  return "overview";
}

function adminHref(
  view: AdminView,
  params: Record<string, string | null | undefined> = {}
) {
  const search = new URLSearchParams({ view });

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  return `/admin?${search.toString()}`;
}

function dateTimeInputValue(value: string | null) {
  return value ? value.slice(0, 16) : "";
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
    status: albumStatusFilter = "all",
    view
  } = await searchParams;
  const activeView = isAdminView(view)
    ? view
    : viewFromNotice(notice, selectedAlbumId);
  const activeViewCopy = adminViewCopy[activeView];
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
    inquiriesResult,
    shootRequestsResult
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
      .limit(20),
    supabase
      .from("shoot_requests")
      .select(
        "id, client_id, album_id, name, email, phone, shoot_type, location, message, preferred_start_at, preferred_end_at, status, admin_notes, created_at, updated_at, ip_address"
      )
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const clients = (clientsResult.data ?? []) as ClientOption[];
  const albums = (albumsResult.data ?? []) as AdminAlbum[];
  const albumClients = (albumClientsResult.data ?? []) as AdminAlbumClient[];
  const shootRequests = (shootRequestsResult.data ?? []) as ShootRequest[];
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
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const albumById = new Map(albums.map((album) => [album.id, album]));
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
  const shootRequestsUnavailable = Boolean(shootRequestsResult.error);
  const aboutContent = await getAboutPageContent({ includeInactive: true });
  const aboutBlocksBySection = new Map(
    aboutBlockSections.map((section) => [
      section,
      aboutContent.blocks.filter((block) => block.section === section)
    ])
  );
  const nextAboutSortOrder =
    Math.max(0, ...aboutContent.blocks.map((block) => block.sortOrder)) + 10;

  return (
    <main className="shell section">
      <div className="admin-layout">
        <aside className="sidebar">
          <strong>Admin</strong>
          {adminViews.map((viewName) => (
            <a
              className={activeView === viewName ? "active" : undefined}
              href={adminHref(viewName, {
                album: selectedAlbum?.id,
                q: viewName === "albums" ? albumQuery : undefined,
                status: viewName === "albums" ? albumStatusFilter : undefined
              })}
              key={viewName}
            >
              {adminViewCopy[viewName].label}
            </a>
          ))}
        </aside>

        <section className="dashboard-panel">
          <div className="admin-topbar">
            <div>
              <p className="eyebrow">Admin / {activeViewCopy.label}</p>
              <p className="muted">Signed in as {user.email}</p>
            </div>
            <form action={signOutAction}>
              <button className="button secondary" type="submit">
                Sign out
              </button>
            </form>
          </div>
          <h1 className="admin-title">Gallery control</h1>
          <div className="admin-page-header">
            <div>
              <span className="label">Current page</span>
              <h2>{activeViewCopy.title}</h2>
              <p>{activeViewCopy.detail}</p>
            </div>
            <div className="inline-actions">
              {activeView === "about" ? (
                <a className="button small" href="/about">
                  <ExternalLink size={16} />
                  View About page
                </a>
              ) : (
                <>
                  <a className="button secondary small" href={adminHref("new-album")}>
                    New album
                  </a>
                  <a className="button secondary small" href={adminHref("uploads", { album: selectedAlbum?.id })}>
                    Upload
                  </a>
                  {selectedAlbum ? (
                    <a className="button small" href={`/client/${selectedAlbum.slug}`}>
                      <ExternalLink size={16} />
                      View gallery
                    </a>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {noticeMessage ? <p className="alert success">{noticeMessage}</p> : null}

          {activeView === "overview" ? (
            <>
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
                      <a
                        className="button secondary small"
                        href={adminHref("albums", { album: selectedAlbum.id })}
                      >
                        Edit album
                      </a>
                      <a
                        className="button secondary small"
                        href={adminHref("uploads", { album: selectedAlbum.id })}
                      >
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

              <div className="admin-quick-grid">
                <a className="admin-quick-card" href={adminHref("about")}>
                  <strong>About builder</strong>
                  <span>Edit page copy, banners, spoken notes, timeline, and tools.</span>
                </a>
                <a className="admin-quick-card" href={adminHref("albums", { album: selectedAlbum?.id })}>
                  <strong>Manage albums</strong>
                  <span>Edit gallery settings, covers, files, and share messages.</span>
                </a>
                <a className="admin-quick-card" href={adminHref("clients")}>
                  <strong>Clients</strong>
                  <span>Create clients and reset portal passwords.</span>
                </a>
                <a className="admin-quick-card" href={adminHref("requests")}>
                  <strong>Shoot requests</strong>
                  <span>Review booking requests and accepted shoot times.</span>
                </a>
                <a className="admin-quick-card" href={adminHref("delivery")}>
                  <strong>Delivery scan</strong>
                  <span>Check which albums are ready, public, protected, or missing ZIPs.</span>
                </a>
              </div>
            </>
          ) : null}

          {activeView === "about" ? (
          <section id="about-builder" className="admin-section active-admin-page">
            <div className="section-head compact">
              <div>
                <p className="eyebrow">About Builder</p>
                <h2>Edit the About page</h2>
              </div>
              <p>
                This is the build area for About page copy. Change the hero,
                add banners, reorder cards, hide weak lines, and publish without
                editing code.
              </p>
            </div>

            {aboutContent.setupMissing ? (
              <p className="alert">
                About builder is running from fallback content. Run{" "}
                <code>supabase/migrations/20260519_about_builder.sql</code> in
                Supabase SQL Editor, then refresh this page to save edits.
              </p>
            ) : null}

            <div className="about-builder-grid">
              <form action={updateAboutSettingsAction} className="manager-panel about-settings-form">
                <div className="panel-title-row">
                  <div>
                    <h3>Page settings</h3>
                    <p className="muted">
                      The main hero, intro, metadata panel, and closing line.
                    </p>
                  </div>
                  <a className="button secondary small" href="/about">
                    <ExternalLink size={16} />
                    Preview
                  </a>
                </div>
                <label className="field">
                  Hero label
                  <input
                    name="hero_label"
                    defaultValue={aboutContent.settings.heroLabel}
                    required
                  />
                </label>
                <label className="field">
                  Hero title
                  <input
                    name="hero_title"
                    defaultValue={aboutContent.settings.heroTitle}
                    required
                  />
                </label>
                <label className="field textarea-field">
                  Intro
                  <textarea name="intro" defaultValue={aboutContent.settings.intro} />
                </label>
                <label className="field textarea-field">
                  Closing line
                  <textarea name="closing" defaultValue={aboutContent.settings.closing} />
                </label>
                <label className="field textarea-field">
                  Metadata
                  <textarea
                    name="meta_items"
                    defaultValue={metaItemsToLines(aboutContent.settings.metaItems)}
                  />
                  <small>One item per line, like Based in: Melbourne.</small>
                </label>
                <button className="button" type="submit">
                  <Save size={18} />
                  Save page settings
                </button>
              </form>

              <form action={createAboutBlockAction} className="manager-panel about-create-form">
                <div className="panel-title-row">
                  <div>
                    <h3>Add a new block</h3>
                    <p className="muted">
                      Add a card, wide banner, spoken snippet, timeline item, or tool.
                    </p>
                  </div>
                </div>
                <label className="field">
                  Section
                  <select name="section" defaultValue="banners">
                    {aboutBlockSections.map((section) => (
                      <option key={section} value={section}>
                        {aboutBlockSectionCopy[section].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Display type
                  <select name="kind" defaultValue="banner">
                    {aboutBlockKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {aboutBlockKindCopy[kind]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Sort order
                  <input name="sort_order" type="number" defaultValue={nextAboutSortOrder} />
                </label>
                <label className="field">
                  Label
                  <input name="label" placeholder="Perspective, Name, Practice..." />
                </label>
                <label className="field wide-field">
                  Title / line
                  <input
                    name="title"
                    placeholder="A useful line, banner title, or tool name"
                    required
                  />
                </label>
                <label className="field textarea-field wide-field">
                  Body
                  <textarea name="body" placeholder="Longer copy for cards and banners." />
                </label>
                <label className="field textarea-field wide-field">
                  References / tags
                  <textarea
                    name="reference"
                    placeholder="One per line. Used as tags, card references, or notes."
                  />
                </label>
                <label className="checkbox-field wide-field">
                  <input name="is_active" type="checkbox" defaultChecked />
                  Publish this block
                </label>
                <button className="button" type="submit">
                  Add block
                </button>
              </form>
            </div>

            <div className="about-builder-sections">
              {aboutBlockSections.map((section) => {
                const blocks = aboutBlocksBySection.get(section) ?? [];

                return (
                  <section className="about-builder-section" key={section}>
                    <div className="panel-title-row">
                      <div>
                        <h3>{aboutBlockSectionCopy[section].label}</h3>
                        <p className="muted">{aboutBlockSectionCopy[section].detail}</p>
                      </div>
                      <span className="pill">{blocks.length} blocks</span>
                    </div>
                    <div className="about-block-list">
                      {blocks.map((block) => (
                        <article className="about-builder-block" key={block.id}>
                          <form action={updateAboutBlockAction} className="about-block-edit-form">
                            <input name="block_id" type="hidden" value={block.id} />
                            <div className="block-form-head">
                              <div>
                                <span className="label">
                                  {aboutBlockKindCopy[block.kind]} · #{block.sortOrder}
                                </span>
                                <strong>{block.title}</strong>
                              </div>
                              <label className="checkbox-field compact">
                                <input
                                  name="is_active"
                                  type="checkbox"
                                  defaultChecked={block.isActive}
                                />
                                Live
                              </label>
                            </div>
                            <label className="field">
                              Section
                              <select name="section" defaultValue={block.section}>
                                {aboutBlockSections.map((sectionOption) => (
                                  <option key={sectionOption} value={sectionOption}>
                                    {aboutBlockSectionCopy[sectionOption].label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              Type
                              <select name="kind" defaultValue={block.kind}>
                                {aboutBlockKinds.map((kind) => (
                                  <option key={kind} value={kind}>
                                    {aboutBlockKindCopy[kind]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              Sort
                              <input
                                name="sort_order"
                                type="number"
                                defaultValue={block.sortOrder}
                              />
                            </label>
                            <label className="field">
                              Label
                              <input name="label" defaultValue={block.label ?? ""} />
                            </label>
                            <label className="field wide-field">
                              Title / line
                              <input name="title" defaultValue={block.title} required />
                            </label>
                            <label className="field textarea-field wide-field">
                              Body
                              <textarea name="body" defaultValue={block.body ?? ""} />
                            </label>
                            <label className="field textarea-field wide-field">
                              References / tags
                              <textarea
                                name="reference"
                                defaultValue={block.reference ?? ""}
                              />
                            </label>
                            <button className="button secondary small" type="submit">
                              <Save size={16} />
                              Save block
                            </button>
                          </form>
                          <form action={deleteAboutBlockAction} className="danger-zone">
                            <input name="block_id" type="hidden" value={block.id} />
                            <ConfirmSubmitButton
                              className="button danger small"
                              confirmMessage={`Delete this About page block: ${block.title}?`}
                            >
                              <Trash2 size={16} />
                              Delete block
                            </ConfirmSubmitButton>
                          </form>
                        </article>
                      ))}
                      {!blocks.length ? (
                        <p className="muted">No blocks in this section yet.</p>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
          ) : null}

          {activeView === "albums" ? (
          <section id="manager" className="admin-section active-admin-page">
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
                  <input name="view" type="hidden" value="albums" />
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
                      href={adminHref("albums", {
                        album: album.id,
                        q: albumQuery,
                        status: albumStatusFilter
                      })}
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
                  <a
                    className="button secondary small"
                    href={adminHref("uploads", { album: selectedAlbum.id })}
                  >
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
          ) : null}

          {activeView === "clients" ? (
          <section id="clients" className="admin-section">
            <h2 className="section-title">Create client</h2>
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
          ) : null}

          {activeView === "new-album" ? (
          <section id="albums" className="admin-section">
            <h2 className="section-title">Create album</h2>
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
              <AlbumSlugFields />
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
          ) : null}

          {activeView === "uploads" ? (
          <section id="uploads" className="admin-section">
            <h2 className="section-title">Upload workflow</h2>
            <h3>Photos</h3>
            <AdminPhotoUpload albums={albums} defaultAlbumId={selectedAlbum?.id} />
            <h3 className="subsection-title">Full album ZIP</h3>
            <AdminZipUpload albums={albums} defaultAlbumId={selectedAlbum?.id} />
          </section>
          ) : null}

          {activeView === "delivery" ? (
          <section id="delivery" className="admin-section">
            <h2 className="section-title">Delivery overview</h2>
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
          ) : null}

          {activeView === "downloads" ? (
          <section id="logs" className="admin-section">
            <div className="panel-title-row">
              <div>
                <h2 className="section-title">Download logs</h2>
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
          ) : null}

          {activeView === "requests" ? (
          <section id="shoot-requests" className="admin-section">
            <div className="panel-title-row">
              <div>
                <h2 className="section-title">Shoot requests</h2>
                <p className="muted">
                  Review client shoot requests, adjust timing, accept work, and create
                  client/gallery records when needed.
                </p>
              </div>
              <span className="pill">{shootRequests.length} recent</span>
            </div>
            {shootRequestsUnavailable ? (
              <p className="alert">
                Shoot requests are not available yet. Run
                supabase/migrations/20260519_shoot_requests.sql in Supabase SQL
                Editor, then refresh this page.
              </p>
            ) : null}
            <div className="shoot-request-list">
              {shootRequests.map((request) => {
                const linkedClient = request.client_id
                  ? clientById.get(request.client_id)
                  : null;
                const linkedAlbum = request.album_id ? albumById.get(request.album_id) : null;

                return (
                  <article className="request-card" key={request.id}>
                    <div className="panel-title-row">
                      <div>
                        <p className="eyebrow">{request.status}</p>
                        <h3>{request.name}</h3>
                        <p className="muted">
                          {request.shoot_type}
                          {request.location ? ` · ${request.location}` : ""}
                        </p>
                      </div>
                      <div className="request-meta">
                        <span>
                          {formatDateTime(request.preferred_start_at)} to{" "}
                          {formatDateTime(request.preferred_end_at)}
                        </span>
                        <span>{request.email}</span>
                        {request.phone ? <span>{request.phone}</span> : null}
                        {linkedClient ? <span>Client: {linkedClient.name}</span> : null}
                        {linkedAlbum ? <span>Album: {linkedAlbum.title}</span> : null}
                      </div>
                    </div>
                    {request.message ? (
                      <p className="table-message">{request.message}</p>
                    ) : null}
                    <form action={updateShootRequestAction} className="request-edit-form">
                      <input name="shoot_request_id" type="hidden" value={request.id} />
                      <label className="field">
                        Name
                        <input name="name" defaultValue={request.name} required />
                      </label>
                      <label className="field">
                        Email
                        <input
                          name="email"
                          type="email"
                          defaultValue={request.email}
                          required
                        />
                      </label>
                      <label className="field">
                        Phone
                        <input name="phone" defaultValue={request.phone ?? ""} />
                      </label>
                      <label className="field">
                        Shoot type
                        <input name="shoot_type" defaultValue={request.shoot_type} required />
                      </label>
                      <label className="field">
                        Location
                        <input name="location" defaultValue={request.location ?? ""} />
                      </label>
                      <label className="field">
                        Status
                        <select name="status" defaultValue={request.status}>
                          <option value="new">New</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="accepted">Accepted</option>
                          <option value="declined">Declined</option>
                          <option value="archived">Archived</option>
                        </select>
                      </label>
                      <label className="field">
                        Start
                        <input
                          name="preferred_start_at"
                          type="datetime-local"
                          defaultValue={dateTimeInputValue(request.preferred_start_at)}
                          required
                        />
                      </label>
                      <label className="field">
                        Finish
                        <input
                          name="preferred_end_at"
                          type="datetime-local"
                          defaultValue={dateTimeInputValue(request.preferred_end_at)}
                          required
                        />
                      </label>
                      <label className="field wide-field">
                        Request details
                        <textarea name="message" defaultValue={request.message ?? ""} />
                      </label>
                      <label className="field wide-field">
                        Admin notes
                        <textarea
                          name="admin_notes"
                          defaultValue={request.admin_notes ?? ""}
                          placeholder="Pricing, package notes, follow-up, deposit status."
                        />
                      </label>
                      <label className="checkbox-field">
                        <input
                          name="create_client"
                          type="checkbox"
                          defaultChecked={Boolean(request.client_id)}
                        />
                        Create or link client from this request
                      </label>
                      <label className="checkbox-field">
                        <input name="create_album" type="checkbox" />
                        Create draft private album for accepted work
                      </label>
                      <div className="inline-actions">
                        <button className="button" type="submit">
                          <Save size={18} />
                          Save request
                        </button>
                      </div>
                    </form>
                    <form action={deleteShootRequestAction} className="danger-zone">
                      <input name="shoot_request_id" type="hidden" value={request.id} />
                      <ConfirmSubmitButton
                        className="button danger small"
                        confirmMessage={`Delete the shoot request from ${request.name}?`}
                      >
                        <Trash2 size={16} />
                        Delete request
                      </ConfirmSubmitButton>
                    </form>
                  </article>
                );
              })}
              {!shootRequests.length ? (
                <p className="muted">No shoot requests yet.</p>
              ) : null}
            </div>
          </section>
          ) : null}

          {activeView === "inquiries" ? (
          <section id="inquiries" className="admin-section">
            <div className="panel-title-row">
              <div>
                <h2 className="section-title">Booking inquiries</h2>
                <p className="muted">
                  Messages from the homepage contact form. Reply from your email,
                  then update the status here.
                </p>
              </div>
              <span className="pill">{inquiries.length} recent</span>
            </div>
            {inquiriesUnavailable ? (
              <p className="alert">
                Booking inquiries are not available yet. Run
                supabase/migrations/20260519_contact_inquiries.sql in Supabase SQL
                Editor, then refresh this page.
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
          ) : null}

          {activeView === "backups" ? (
          <section id="backups" className="admin-section">
            <div className="panel-title-row">
              <div>
                <h2 className="section-title">Backup checklist</h2>
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
                <p>Check per-album download history and keep shoot request notes current.</p>
              </div>
            </div>
          </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
