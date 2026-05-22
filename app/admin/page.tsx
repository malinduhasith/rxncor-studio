import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  DatabaseBackup,
  ExternalLink,
  FileArchive,
  ImageUp,
  Link as LinkIcon,
  LockKeyhole,
  Mail,
  Save,
  Search,
  Star,
  Trash2,
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
  sendAlbumReadyEmailAction,
  setCoverPhotoAction,
  signOutAction,
  togglePhotoSelectedAction,
  updateAboutBlockAction,
  updateAboutSettingsAction,
  updateAlbumAction,
  updateClientAction,
  updatePhotoMetadataAction,
  updateInquiryStatusAction,
  updateShootRequestAction,
} from "./actions";
import { AdminFileActionButton } from "@/components/admin/AdminFileActionButton";
import { AdminPhotoUpload } from "@/components/admin/AdminPhotoUpload";
import { AdminZipUpload } from "@/components/admin/AdminZipUpload";
import { AlbumSlugFields } from "@/components/admin/AlbumSlugFields";
import { ClientPasswordResetForm } from "@/components/admin/ClientPasswordResetForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { CopyTextButton } from "@/components/admin/CopyTextButton";
import { Notice, NoticeStack } from "@/components/Notice";
import { siteConfig } from "@/config/site";
import {
  aboutBlockKindCopy,
  aboutBlockKinds,
  aboutBlockSectionCopy,
  aboutBlockSections,
  getAboutPageContent,
  metaItemsToLines,
  type AboutBlockKind,
  type AboutBlockSection,
} from "@/lib/about-builder";
import { isAdminEmailAllowed } from "@/lib/admin-auth";
import { adminNotices, type NoticeContent } from "@/lib/notices";
import {
  photoDisplayLabel,
  type PhotoDisplaySource,
} from "@/lib/photo-display";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
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
  thumbnail_size_bytes?: number | null;
  preview_size_bytes?: number | null;
  full_size_bytes?: number | null;
  file_size_bytes?: number | null;
  generated_thumbnail?: boolean | null;
  generated_preview?: boolean | null;
} & PhotoDisplaySource;

type DisplayPhoto = AdminPhoto & {
  thumbnailDisplayUrl: string | null;
  isCover: boolean;
  fileType: string;
  displayLabel: ReturnType<typeof photoDisplayLabel>;
};

type DownloadLog = {
  id: string;
  album_id: string;
  photo_id: string | null;
  client_email: string | null;
  downloaded_at: string;
  ip_address: string | null;
};

type UploadEvent = {
  id: string;
  album_id: string | null;
  photo_id: string | null;
  filename: string | null;
  event_type: "photo" | "zip" | "diagnostic" | "cleanup";
  status: "success" | "failed" | "partial";
  message: string | null;
  size_bytes: number | null;
  duration_ms: number | null;
  created_at: string;
  ip_address: string | null;
};

type EmailEvent = {
  id: string;
  email_type: string;
  recipient: string | null;
  subject: string;
  status: "sent" | "failed" | "skipped";
  provider: string;
  provider_status: number | null;
  message: string | null;
  album_id: string | null;
  client_id: string | null;
  related_type: string | null;
  related_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AdminAuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
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
  "monitoring",
  "delivery",
  "downloads",
  "requests",
  "inquiries",
  "backups",
] as const;

type AdminView = (typeof adminViews)[number];

const adminViewCopy: Record<
  AdminView,
  { label: string; title: string; detail: string }
> = {
  overview: {
    label: "Overview",
    title: "Today in the studio",
    detail:
      "A quick read on delivery health, recent activity, and what needs attention.",
  },
  about: {
    label: "About Builder",
    title: "About page builder",
    detail:
      "Edit the About page hero, metadata, cards, banners, spoken notes, timeline, and tools.",
  },
  albums: {
    label: "Albums",
    title: "Albums and files",
    detail:
      "Select an album, edit gallery details, manage files, set covers, and copy client links.",
  },
  clients: {
    label: "Clients",
    title: "Client records",
    detail:
      "Create clients, reset client passwords, and keep contact details tidy.",
  },
  "new-album": {
    label: "New Album",
    title: "Create album",
    detail:
      "Start a public or private gallery, assign clients, and set delivery rules.",
  },
  uploads: {
    label: "Uploads",
    title: "Upload workflow",
    detail:
      "Upload full-res files, auto-generate delivery images, read EXIF, and attach the final ZIP.",
  },
  monitoring: {
    label: "Monitoring",
    title: "Analytics and monitoring",
    detail:
      "Watch upload health, failures, download activity, and tracked storage.",
  },
  delivery: {
    label: "Delivery",
    title: "Delivery overview",
    detail: "Scan every gallery status before sending client links.",
  },
  downloads: {
    label: "Downloads",
    title: "Download logs",
    detail: "Review recent client downloads and support access questions.",
  },
  requests: {
    label: "Requests",
    title: "Shoot requests",
    detail:
      "Review booking requests, protect accepted slots from overlaps, and create client records.",
  },
  inquiries: {
    label: "Inquiries",
    title: "Booking inquiries",
    detail: "Track general messages from the contact form and mark replies.",
  },
  backups: {
    label: "Backups",
    title: "Backup checklist",
    detail:
      "Keep a small operational checklist for Supabase exports and R2 delivery files.",
  },
};

type AboutTemplate = {
  title: string;
  description: string;
  section: AboutBlockSection;
  kind: AboutBlockKind;
  label: string;
  blockTitle: string;
  body: string;
  reference: string;
};

const aboutQuickTemplates: AboutTemplate[] = [
  {
    title: "Intro card",
    description: "A short idea near the top of the page.",
    section: "intro_cards",
    kind: "card",
    label: "Practice",
    blockTitle: "A grounded line about the work.",
    body: "Write one honest paragraph about how you see, shoot, and edit.",
    reference: "",
  },
  {
    title: "Wide banner",
    description: "A bigger thought, belief, or brand note.",
    section: "banners",
    kind: "banner",
    label: "Perspective",
    blockTitle: "A bigger thought for the page.",
    body: "Use this for a longer idea, belief, or meaning behind the work.",
    reference: "Optional note\nOptional tag",
  },
  {
    title: "Spoken line",
    description: "A simple quote-like thought with a reference.",
    section: "spoken",
    kind: "spoken",
    label: "",
    blockTitle: "A short line that sounds like you.",
    body: "",
    reference: "Reference, influence, or note",
  },
  {
    title: "Timeline item",
    description: "One step in your background or current direction.",
    section: "timeline",
    kind: "timeline",
    label: "",
    blockTitle: "Melbourne",
    body: "Add one stage of your creative or technical path.",
    reference: "",
  },
  {
    title: "Tool",
    description: "Gear, software, or a working system.",
    section: "tools",
    kind: "tool",
    label: "",
    blockTitle: "Sony A7 IV",
    body: "",
    reference: "",
  },
];

const aboutSectionDefaults: Record<
  AboutBlockSection,
  {
    kind: AboutBlockKind;
    label: string;
    titlePlaceholder: string;
    bodyPlaceholder: string;
    referencePlaceholder: string;
    submitLabel: string;
  }
> = {
  intro_cards: {
    kind: "card",
    label: "Practice",
    titlePlaceholder: "Card title",
    bodyPlaceholder: "Short paragraph for this idea",
    referencePlaceholder: "",
    submitLabel: "Add intro card",
  },
  banners: {
    kind: "banner",
    label: "Perspective",
    titlePlaceholder: "Banner title",
    bodyPlaceholder: "Longer page section copy",
    referencePlaceholder: "Optional tags or notes, one per line",
    submitLabel: "Add banner",
  },
  spoken: {
    kind: "spoken",
    label: "",
    titlePlaceholder: "Short spoken line",
    bodyPlaceholder: "",
    referencePlaceholder: "Reference or note",
    submitLabel: "Add spoken line",
  },
  timeline: {
    kind: "timeline",
    label: "",
    titlePlaceholder: "Place, period, or chapter",
    bodyPlaceholder: "What happened in this stage",
    referencePlaceholder: "",
    submitLabel: "Add timeline item",
  },
  tools: {
    kind: "tool",
    label: "",
    titlePlaceholder: "Tool name",
    bodyPlaceholder: "",
    referencePlaceholder: "",
    submitLabel: "Add tool",
  },
};

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function isAdminView(value: string | undefined): value is AdminView {
  return adminViews.includes(value as AdminView);
}

function viewFromNotice(
  notice: string | undefined,
  selectedAlbumId?: string,
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
  params: Record<string, string | null | undefined> = {},
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
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 1 : 2)} ${units[unitIndex]}`;
}

function fileType(filename: string) {
  const extension = filename.split(".").pop();

  return extension ? extension.toUpperCase() : "File";
}

function emailTypeLabel(type: string) {
  return type.replace(/[._]/g, " ");
}

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim() ? value : null;
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
  client: ClientOption | undefined,
) {
  const normalizedQuery = query.trim().toLowerCase();
  const statusLabel = albumStatus(album, photoCount).toLowerCase();
  const searchableText = [
    album.title,
    album.slug,
    album.event_date,
    client?.name,
    client?.email,
    statusLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const queryMatch =
    !normalizedQuery || searchableText.includes(normalizedQuery);

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
  photoCount,
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
  const clientPasswordLine =
    !album.is_public && album.allow_client_password_access !== false
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
    "Thank you,",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function clientLoginDetailsMessage({
  album,
  client,
  albumLink,
  photoCount,
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
    "Thank you,",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function readinessItems({
  album,
  photoCount,
  assignedClientCount,
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
      complete: album.is_public || assignedClientCount > 0,
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
        album.allow_client_password_access !== false,
    },
    {
      label: "Photos",
      detail: photoCount ? `${photoCount} uploaded` : "Upload the album",
      complete: photoCount > 0,
    },
    {
      label: "Cover",
      detail: album.cover_photo_url ? "Cover selected" : "Choose a cover",
      complete: Boolean(album.cover_photo_url),
    },
    {
      label: "Full ZIP",
      detail: album.download_zip_url ? "ZIP ready" : "Upload the delivery ZIP",
      complete: Boolean(album.download_zip_url),
    },
    {
      label: "Expiry",
      detail: album.expires_at
        ? dateInputValue(album.expires_at)
        : "No expiry set",
      complete: true,
    },
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
    view,
  } = await searchParams;
  const activeView = isAdminView(view)
    ? view
    : viewFromNotice(notice, selectedAlbumId);
  const activeViewCopy = adminViewCopy[activeView];
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(siteConfig.routes.adminLogin);
  }

  if (!isAdminEmailAllowed(user.email)) {
    redirect(`${siteConfig.routes.adminLogin}?error=unauthorized`);
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
    shootRequestsResult,
    uploadEventsResult,
    emailEventsResult,
    auditLogsResult,
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
        "id, client_id, album_id, name, email, phone, shoot_type, location, message, preferred_start_at, preferred_end_at, status, admin_notes, created_at, updated_at, ip_address",
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("upload_events")
      .select(
        "id, album_id, photo_id, filename, event_type, status, message, size_bytes, duration_ms, created_at, ip_address",
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("email_events")
      .select(
        "id, email_type, recipient, subject, status, provider, provider_status, message, album_id, client_id, related_type, related_id, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("admin_audit_logs")
      .select(
        "id, action, entity_type, entity_id, summary, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(20),
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
  const uploadEvents = (uploadEventsResult.data ?? []) as UploadEvent[];
  const emailEvents = (emailEventsResult.data ?? []) as EmailEvent[];
  const auditLogs = (auditLogsResult.data ?? []) as AdminAuditLog[];
  const albumPhotoResult = albums.length
    ? await supabase
        .from("photos")
        .select("album_id")
        .in(
          "album_id",
          albums.map((album) => album.id),
        )
    : { data: [], error: null };
  const photoStorageResult = albums.length
    ? await supabase
        .from("photos")
        .select(
          "album_id, thumbnail_size_bytes, preview_size_bytes, full_size_bytes, file_size_bytes, generated_thumbnail, generated_preview",
        )
        .in(
          "album_id",
          albums.map((album) => album.id),
        )
    : { data: [], error: null };
  const albumPhotoCounts = new Map<string, number>();
  const albumStorageBytes = new Map<string, number>();
  const albumGeneratedCounts = new Map<string, number>();

  for (const row of (albumPhotoResult.data ?? []) as { album_id: string }[]) {
    albumPhotoCounts.set(
      row.album_id,
      (albumPhotoCounts.get(row.album_id) ?? 0) + 1,
    );
  }
  for (const row of (photoStorageResult.data ?? []) as {
    album_id: string;
    thumbnail_size_bytes: number | null;
    preview_size_bytes: number | null;
    full_size_bytes: number | null;
    file_size_bytes: number | null;
    generated_thumbnail: boolean | null;
    generated_preview: boolean | null;
  }[]) {
    const bytes =
      row.file_size_bytes ??
      (row.thumbnail_size_bytes ?? 0) +
        (row.preview_size_bytes ?? 0) +
        (row.full_size_bytes ?? 0);

    albumStorageBytes.set(
      row.album_id,
      (albumStorageBytes.get(row.album_id) ?? 0) + bytes,
    );

    if (row.generated_thumbnail || row.generated_preview) {
      albumGeneratedCounts.set(
        row.album_id,
        (albumGeneratedCounts.get(row.album_id) ?? 0) + 1,
      );
    }
  }
  const clientAlbumCounts = new Map<string, number>();
  const albumAssignedClientIds = new Map<string, Set<string>>();

  for (const assignment of albumClients) {
    clientAlbumCounts.set(
      assignment.client_id,
      (clientAlbumCounts.get(assignment.client_id) ?? 0) + 1,
    );

    const assignedSet =
      albumAssignedClientIds.get(assignment.album_id) ?? new Set<string>();
    assignedSet.add(assignment.client_id);
    albumAssignedClientIds.set(assignment.album_id, assignedSet);
  }

  for (const album of albums) {
    if (
      album.client_id &&
      !albumAssignedClientIds.get(album.id)?.has(album.client_id)
    ) {
      clientAlbumCounts.set(
        album.client_id,
        (clientAlbumCounts.get(album.client_id) ?? 0) + 1,
      );
      const assignedSet =
        albumAssignedClientIds.get(album.id) ?? new Set<string>();
      assignedSet.add(album.client_id);
      albumAssignedClientIds.set(album.id, assignedSet);
    }
  }

  const adminPhotoBaseSelect =
    "id, album_id, filename, thumbnail_url, preview_url, full_res_url, r2_object_key, is_selected, uploaded_at";
  const adminPhotoMetadataSelect = `${adminPhotoBaseSelect}, display_title, caption, camera_model, lens_model, focal_length, aperture, shutter_speed, iso, captured_at, location, thumbnail_size_bytes, preview_size_bytes, full_size_bytes, file_size_bytes, generated_thumbnail, generated_preview`;
  const selectedPhotoResult = selectedAlbum
    ? await (async () => {
        const metadataResult = await supabase
          .from("photos")
          .select(adminPhotoMetadataSelect)
          .eq("album_id", selectedAlbum.id)
          .order("uploaded_at", { ascending: true });

        if (!metadataResult.error) {
          return metadataResult;
        }

        return supabase
          .from("photos")
          .select(adminPhotoBaseSelect)
          .eq("album_id", selectedAlbum.id)
          .order("uploaded_at", { ascending: true });
      })()
    : { data: [], error: null };
  const selectedPhotos = (selectedPhotoResult.data ?? []) as AdminPhoto[];
  const selectedAlbumLogResult = selectedAlbum
    ? await supabase
        .from("download_logs")
        .select(
          "id, album_id, photo_id, client_email, downloaded_at, ip_address",
        )
        .eq("album_id", selectedAlbum.id)
        .order("downloaded_at", { ascending: false })
        .limit(50)
    : { data: [], error: null };
  const selectedAlbumLogs = (selectedAlbumLogResult.data ??
    []) as DownloadLog[];
  const displayPhotos: DisplayPhoto[] = await Promise.all(
    selectedPhotos.map(async (photo, index) => ({
      ...photo,
      thumbnailDisplayUrl: await signedObjectUrl(photo.thumbnail_url),
      isCover: selectedAlbum?.cover_photo_url === photo.preview_url,
      fileType: fileType(photo.filename),
      displayLabel: photoDisplayLabel(photo, {
        albumTitle: selectedAlbum?.title,
        eventDate: selectedAlbum?.event_date,
        index,
      }),
    })),
  );
  const selectedClient = selectedAlbum
    ? clients.find((client) => client.id === selectedAlbum.client_id)
    : null;
  const selectedAssignedClientIds = selectedAlbum
    ? (albumAssignedClientIds.get(selectedAlbum.id) ?? new Set<string>())
    : new Set<string>();
  const selectedAssignedClients = clients.filter((client) =>
    selectedAssignedClientIds.has(client.id),
  );
  const selectedAlbumPhotoCount = selectedAlbum
    ? (albumPhotoCounts.get(selectedAlbum.id) ?? selectedPhotos.length)
    : 0;
  const selectedClientLink = selectedAlbum
    ? `${siteConfig.url}/client/${selectedAlbum.slug}`
    : "";
  const selectedShareMessage = selectedAlbum
    ? shareMessage({
        album: selectedAlbum,
        client: selectedClient,
        link: selectedClientLink,
        photoCount: selectedAlbumPhotoCount,
      })
    : "";
  const selectedReadinessItems = selectedAlbum
    ? readinessItems({
        album: selectedAlbum,
        photoCount: selectedAlbumPhotoCount,
        assignedClientCount: selectedAssignedClients.length,
      })
    : [];
  const selectedReadinessComplete = selectedReadinessItems.filter(
    (item) => item.complete,
  ).length;
  const visibleAlbums = albums.filter((album) =>
    matchesAlbumFilter(
      album,
      albumQuery,
      albumStatusFilter.toLowerCase(),
      albumPhotoCounts.get(album.id) ?? 0,
      clients.find((client) => client.id === album.client_id),
    ),
  );
  const logAlbumTitles = new Map(
    albums.map((album) => [album.id, album.title]),
  );
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const logPhotoIds = [
    ...new Set(
      [...downloadLogs, ...selectedAlbumLogs]
        .map((log) => log.photo_id)
        .filter((photoId): photoId is string => Boolean(photoId)),
    ),
  ];
  const logPhotoResult = logPhotoIds.length
    ? await supabase.from("photos").select("id, filename").in("id", logPhotoIds)
    : { data: [], error: null };
  const logPhotoNames = new Map(
    [
      ...selectedPhotos.map((photo) => ({
        id: photo.id,
        filename: photo.filename,
      })),
      ...((logPhotoResult.data ?? []) as { id: string; filename: string }[]),
    ].map((photo) => [photo.id, photo.filename]),
  );
  const noticeContent = notice ? adminNotices[notice] : undefined;
  const inquiriesUnavailable = Boolean(inquiriesResult.error);
  const shootRequestsUnavailable = Boolean(shootRequestsResult.error);
  const aboutContent = await getAboutPageContent({ includeInactive: true });
  const dataLoadNotices: NoticeContent[] = [
    clientsResult.error
      ? {
          tone: "error",
          title: "Clients could not load",
          message:
            "Client records are unavailable. Check the clients table and Supabase policies before editing client access.",
        }
      : null,
    albumsResult.error
      ? {
          tone: "error",
          title: "Albums could not load",
          message:
            "Album records are unavailable. Public galleries and admin album tools may show incomplete data.",
        }
      : null,
    albumClientsResult.error
      ? {
          tone: "warning",
          title: "Client assignments unavailable",
          message:
            "Album-to-client links could not be loaded. Client portal access may look empty until this is fixed.",
        }
      : null,
    downloadLogsResult.error
      ? {
          tone: "warning",
          title: "Download logs unavailable",
          message:
            "Download history could not be loaded. New downloads can still work, but audit stats may be incomplete.",
        }
      : null,
    albumCountResult.error ||
    photoCountResult.error ||
    protectedAlbumCountResult.error ||
    downloadCountResult.error
      ? {
          tone: "warning",
          title: "Dashboard counts are incomplete",
          message:
            "One or more summary counts could not be loaded. The lists may still work, but headline numbers may be lower than expected.",
        }
      : null,
    albumPhotoResult.error
      ? {
          tone: "warning",
          title: "Album photo counts unavailable",
          message:
            "Per-album photo counts could not be loaded. Album readiness and filters may be incomplete.",
        }
      : null,
    photoStorageResult.error
      ? {
          tone: "warning",
          title: "Storage tracking needs setup",
          message:
            "Run the upload monitoring Supabase migration to show tracked storage and generated-image counts.",
        }
      : null,
    uploadEventsResult.error
      ? {
          tone: "warning",
          title: "Upload monitoring needs setup",
          message:
            "Run the upload monitoring Supabase migration to store upload successes and failures.",
        }
      : null,
    emailEventsResult.error
      ? {
          tone: "warning",
          title: "Email monitoring needs setup",
          message:
            "Run the email monitoring Supabase migration to track sent, failed, and skipped email notifications.",
        }
      : null,
    auditLogsResult.error
      ? {
          tone: "warning",
          title: "Admin audit trail needs setup",
          message:
            "Run the admin audit/export Supabase migration to store admin change history.",
        }
      : null,
    selectedPhotoResult.error
      ? {
          tone: "warning",
          title: "Selected album files unavailable",
          message:
            "The selected album's file list could not be loaded. Try refreshing or opening another album.",
        }
      : null,
    selectedAlbumLogResult.error || logPhotoResult.error
      ? {
          tone: "warning",
          title: "Selected album download details unavailable",
          message:
            "Some selected album download details could not be loaded. Audit rows may show partial information.",
        }
      : null,
    inquiriesUnavailable
      ? {
          tone: "warning",
          title: "Booking inquiries need setup",
          message:
            "Run the contact inquiries Supabase migration, then refresh this page.",
        }
      : null,
    shootRequestsUnavailable
      ? {
          tone: "warning",
          title: "Shoot requests need setup",
          message:
            "Run the shoot requests Supabase migration before accepting bookings from the homepage.",
        }
      : null,
    aboutContent.setupMissing
      ? {
          tone: "warning",
          title: "About builder is in fallback mode",
          message:
            "Run the About Builder Supabase migration before saving custom About page blocks.",
        }
      : null,
  ].filter((item): item is NoticeContent => Boolean(item));
  const aboutBlocksBySection = new Map(
    aboutBlockSections.map((section) => [
      section,
      aboutContent.blocks.filter((block) => block.section === section),
    ]),
  );
  const nextAboutSortOrder =
    Math.max(0, ...aboutContent.blocks.map((block) => block.sortOrder)) + 10;
  const activeAboutBlockCount = aboutContent.blocks.filter(
    (block) => block.isActive,
  ).length;
  const hiddenAboutBlockCount =
    aboutContent.blocks.length - activeAboutBlockCount;
  const aboutEditorStats = [
    {
      label: "Main facts",
      detail: `${aboutContent.settings.metaItems.length} lines`,
    },
    {
      label: "Live blocks",
      detail: `${activeAboutBlockCount} published`,
    },
    {
      label: "Hidden blocks",
      detail: `${hiddenAboutBlockCount} drafts`,
    },
    {
      label: "Content source",
      detail: aboutContent.source === "database" ? "Supabase" : "Fallback",
    },
  ];
  const aboutEditingSteps = [
    {
      number: "01",
      title: "Write the main story",
      detail:
        "Start with the hero, intro, closing line, and small profile facts.",
    },
    {
      number: "02",
      title: "Add page pieces",
      detail:
        "Use quick templates when you need a card, banner, spoken line, timeline item, or tool.",
    },
    {
      number: "03",
      title: "Tune one section",
      detail:
        "Open a section, adjust only the blocks you need, then save that block.",
    },
    {
      number: "04",
      title: "Preview",
      detail:
        "Check the public About page after edits and hide anything that feels too heavy.",
    },
  ];
  const albumsNeedingZipCount = albums.filter(
    (album) =>
      (albumPhotoCounts.get(album.id) ?? 0) > 0 && !album.download_zip_url,
  ).length;
  const expiredAlbumCount = albums.filter(
    (album) => album.expires_at && new Date(album.expires_at) < new Date(),
  ).length;
  const draftAlbumCount = albums.filter(
    (album) =>
      albumStatus(album, albumPhotoCounts.get(album.id) ?? 0) === "Draft",
  ).length;
  const clientsWithoutPasswordCount = clients.filter(
    (client) => !client.password_hash,
  ).length;
  const albumsMissingCoverCount = albums.filter(
    (album) =>
      (albumPhotoCounts.get(album.id) ?? 0) > 0 && !album.cover_photo_url,
  ).length;
  const privateUnassignedCount = albums.filter(
    (album) => !album.is_public && !albumAssignedClientIds.get(album.id)?.size,
  ).length;
  const recentDownloadCount = downloadLogs.length;
  const newInquiryCount = inquiries.filter(
    (inquiry) => inquiry.status === "new",
  ).length;
  const newShootRequestCount = shootRequests.filter(
    (request) => request.status === "new",
  ).length;
  const now = new Date().valueOf();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recentUploadEvents = uploadEvents.filter(
    (event) => new Date(event.created_at).getTime() >= dayAgo,
  );
  const weeklyUploadEvents = uploadEvents.filter(
    (event) => new Date(event.created_at).getTime() >= weekAgo,
  );
  const recentEmailEvents = emailEvents.filter(
    (event) => new Date(event.created_at).getTime() >= dayAgo,
  );
  const weeklyEmailEvents = emailEvents.filter(
    (event) => new Date(event.created_at).getTime() >= weekAgo,
  );
  const recentUploadFailures = recentUploadEvents.filter(
    (event) => event.status === "failed",
  ).length;
  const weeklyUploadFailures = weeklyUploadEvents.filter(
    (event) => event.status === "failed",
  ).length;
  const recentEmailFailures = recentEmailEvents.filter(
    (event) => event.status === "failed",
  ).length;
  const recentEmailSkipped = recentEmailEvents.filter(
    (event) => event.status === "skipped",
  ).length;
  const weeklyEmailFailures = weeklyEmailEvents.filter(
    (event) => event.status === "failed",
  ).length;
  const emailSentToday = recentEmailEvents.filter(
    (event) => event.status === "sent",
  ).length;
  const trackedStorageBytes = [...albumStorageBytes.values()].reduce(
    (total, bytes) => total + bytes,
    0,
  );
  const generatedPhotoCount = [...albumGeneratedCounts.values()].reduce(
    (total, count) => total + count,
    0,
  );
  const downloadEventsToday = downloadLogs.filter(
    (log) => new Date(log.downloaded_at).getTime() >= dayAgo,
  ).length;
  const operationalItems = [
    {
      label: "New shoot requests",
      detail: `${newShootRequestCount} waiting for review`,
      attention: newShootRequestCount > 0,
    },
    {
      label: "New inquiries",
      detail: `${newInquiryCount} waiting for reply`,
      attention: newInquiryCount > 0,
    },
    {
      label: "Client passwords",
      detail: `${clientsWithoutPasswordCount} clients without a portal password`,
      attention: clientsWithoutPasswordCount > 0,
    },
    {
      label: "Private access",
      detail: `${privateUnassignedCount} private albums without assigned clients`,
      attention: privateUnassignedCount > 0,
    },
    {
      label: "Album covers",
      detail: `${albumsMissingCoverCount} uploaded albums without a cover`,
      attention: albumsMissingCoverCount > 0,
    },
    {
      label: "Recent downloads",
      detail: `${recentDownloadCount} latest log entries loaded`,
      attention: false,
    },
    {
      label: "Upload failures",
      detail: `${recentUploadFailures} failed upload events in the last 24 hours`,
      attention: recentUploadFailures > 0,
    },
    {
      label: "Email failures",
      detail: `${recentEmailFailures} failed email events in the last 24 hours`,
      attention: recentEmailFailures > 0,
    },
  ];

  return (
    <main className="shell section admin-workspace">
      <div className="admin-layout" data-view={activeView}>
        <aside
          className="sidebar admin-sidebar"
          aria-label="Admin workspace navigation"
        >
          <strong className="admin-sidebar-title">Admin</strong>
          {adminViews.map((viewName, index) => (
            <a
              className={activeView === viewName ? "active" : undefined}
              href={adminHref(viewName, {
                album: selectedAlbum?.id,
                q: viewName === "albums" ? albumQuery : undefined,
                status: viewName === "albums" ? albumStatusFilter : undefined,
              })}
              aria-current={activeView === viewName ? "page" : undefined}
              key={viewName}
            >
              <span className="admin-nav-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="admin-nav-copy">
                <span>{adminViewCopy[viewName].label}</span>
                <small>{adminViewCopy[viewName].title}</small>
              </span>
            </a>
          ))}
        </aside>

        <section className="dashboard-panel admin-main-panel">
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
                  <a
                    className="button secondary small"
                    href={adminHref("new-album")}
                  >
                    New album
                  </a>
                  <a
                    className="button secondary small"
                    href={adminHref("uploads", { album: selectedAlbum?.id })}
                  >
                    Upload
                  </a>
                  {selectedAlbum ? (
                    <a
                      className="button small"
                      href={`/client/${selectedAlbum.slug}`}
                    >
                      <ExternalLink size={16} />
                      View gallery
                    </a>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <NoticeStack notices={[noticeContent, ...dataLoadNotices]} />

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

              <section className="workflow-panel" aria-label="Resource monitor">
                <div className="panel-title-row">
                  <div>
                    <p className="eyebrow">Resource monitor</p>
                    <h2>Load and storage guardrails</h2>
                    <p className="muted">
                      Album pages now load signed thumbnails first. Large
                      previews, full-res files, and admin file links are created
                      only when opened or downloaded.
                    </p>
                  </div>
                  <DatabaseBackup size={26} />
                </div>
                <div className="readiness-grid">
                  <div className="readiness-item complete">
                    <ImageUp size={18} />
                    <span>
                      <strong>{photoCount} photo records</strong>
                      <small>Keep exports and ZIPs backed up outside R2.</small>
                    </span>
                  </div>
                  <div
                    className={`readiness-item ${
                      albumsNeedingZipCount ? "attention" : "complete"
                    }`}
                  >
                    <FileArchive size={18} />
                    <span>
                      <strong>{albumsNeedingZipCount} need ZIPs</strong>
                      <small>
                        Albums with photos but no final delivery ZIP.
                      </small>
                    </span>
                  </div>
                  <div
                    className={`readiness-item ${draftAlbumCount ? "attention" : "complete"}`}
                  >
                    <CircleAlert size={18} />
                    <span>
                      <strong>{draftAlbumCount} drafts</strong>
                      <small>Albums with no uploaded photos yet.</small>
                    </span>
                  </div>
                  <div className="readiness-item complete">
                    <CalendarDays size={18} />
                    <span>
                      <strong>{expiredAlbumCount} expired</strong>
                      <small>Archive or reopen from the album manager.</small>
                    </span>
                  </div>
                </div>
              </section>

              <section className="workflow-panel" aria-label="Action center">
                <div className="panel-title-row">
                  <div>
                    <p className="eyebrow">Action center</p>
                    <h2>What needs attention</h2>
                    <p className="muted">
                      These counts catch the small operational things that can
                      confuse clients: missing passwords, missing covers,
                      unassigned private albums, and unanswered booking work.
                    </p>
                  </div>
                  <CircleAlert size={26} />
                </div>
                <div className="readiness-grid">
                  {operationalItems.map((item) => (
                    <div
                      className={`readiness-item ${item.attention ? "attention" : "complete"}`}
                      key={item.label}
                    >
                      {item.attention ? (
                        <CircleAlert size={18} />
                      ) : (
                        <CircleCheck size={18} />
                      )}
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {selectedAlbum ? (
                <section
                  className="workflow-panel"
                  aria-label="Selected album readiness"
                >
                  <div className="panel-title-row">
                    <div>
                      <p className="eyebrow">Selected Album</p>
                      <h2>{selectedAlbum.title}</h2>
                      <p className="muted">
                        {selectedReadinessComplete}/
                        {selectedReadinessItems.length} delivery checks ready
                        for{" "}
                        {selectedAlbum.is_public
                          ? "public viewing"
                          : "client delivery"}
                        .
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
                      <a
                        className="button small"
                        href={`/client/${selectedAlbum.slug}`}
                      >
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
                        {item.complete ? (
                          <CircleCheck size={18} />
                        ) : (
                          <CircleAlert size={18} />
                        )}
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
                  <span>
                    Edit page copy, banners, spoken notes, timeline, and tools.
                  </span>
                </a>
                <a
                  className="admin-quick-card"
                  href={adminHref("albums", { album: selectedAlbum?.id })}
                >
                  <strong>Manage albums</strong>
                  <span>
                    Edit gallery settings, covers, files, and share messages.
                  </span>
                </a>
                <a className="admin-quick-card" href={adminHref("clients")}>
                  <strong>Clients</strong>
                  <span>Create clients and reset portal passwords.</span>
                </a>
                <a className="admin-quick-card" href={adminHref("requests")}>
                  <strong>Shoot requests</strong>
                  <span>Review booking requests and accepted shoot times.</span>
                </a>
                <a className="admin-quick-card" href={adminHref("monitoring")}>
                  <strong>Monitoring</strong>
                  <span>
                    Track upload failures, generated files, storage, and
                    downloads.
                  </span>
                </a>
                <a className="admin-quick-card" href={adminHref("delivery")}>
                  <strong>Delivery scan</strong>
                  <span>
                    Check which albums are ready, public, protected, or missing
                    ZIPs.
                  </span>
                </a>
              </div>
            </>
          ) : null}

          {activeView === "about" ? (
            <section
              id="about-builder"
              className="admin-section active-admin-page"
            >
              <div className="section-head compact">
                <div>
                  <p className="eyebrow">About Builder</p>
                  <h2>Edit the About page</h2>
                </div>
                <p>
                  Work from top to bottom: main story first, quick add when you
                  need a new piece, then open one section at a time to refine
                  it.
                </p>
              </div>

              {aboutContent.setupMissing ? (
                <Notice
                  notice={{
                    tone: "warning",
                    title: "About Builder is in fallback mode",
                    message:
                      "Run supabase/migrations/20260519_about_builder.sql in Supabase SQL Editor, then refresh this page to save edits.",
                  }}
                />
              ) : null}

              <section
                className="about-editor-overview"
                aria-label="About editing guide"
              >
                <div className="about-editor-overview-copy">
                  <p className="eyebrow">Editing path</p>
                  <h3>Small changes, clear sections.</h3>
                  <p>
                    This builder now treats the About page like a page layout,
                    not a database table. Keep the main story short, add blocks
                    with templates, and hide anything that is not ready yet.
                  </p>
                </div>
                <div className="about-editor-stats">
                  {aboutEditorStats.map((stat) => (
                    <span className="pill" key={stat.label}>
                      {stat.label}: {stat.detail}
                    </span>
                  ))}
                </div>
                <div className="about-editor-steps">
                  {aboutEditingSteps.map((step) => (
                    <div className="about-editor-step" key={step.number}>
                      <span>{step.number}</span>
                      <strong>{step.title}</strong>
                      <small>{step.detail}</small>
                    </div>
                  ))}
                </div>
              </section>

              <div className="about-builder-grid">
                <form
                  action={updateAboutSettingsAction}
                  className="manager-panel about-settings-form"
                >
                  <div className="panel-title-row">
                    <div>
                      <p className="eyebrow">Main story</p>
                      <h3>Hero and profile facts</h3>
                      <p className="muted">
                        The big headline, intro paragraph, metadata panel, and
                        closing line on the About page.
                      </p>
                    </div>
                    <a className="button secondary small" href="/about">
                      <ExternalLink size={16} />
                      Preview
                    </a>
                  </div>
                  <label className="field">
                    Small label above the headline
                    <input
                      name="hero_label"
                      defaultValue={aboutContent.settings.heroLabel}
                      placeholder="About / Malindu Herath"
                      required
                    />
                    <small>Example: About / Malindu Herath</small>
                  </label>
                  <label className="field">
                    Main headline
                    <input
                      name="hero_title"
                      defaultValue={aboutContent.settings.heroTitle}
                      placeholder="A creative eye with a technical backbone."
                      required
                    />
                    <small>This is the largest line on the page.</small>
                  </label>
                  <label className="field textarea-field">
                    Intro paragraph
                    <textarea
                      name="intro"
                      defaultValue={aboutContent.settings.intro}
                      placeholder="A short, human introduction."
                    />
                    <small>Keep this to one honest paragraph.</small>
                  </label>
                  <label className="field textarea-field">
                    Closing line
                    <textarea
                      name="closing"
                      defaultValue={aboutContent.settings.closing}
                      placeholder="A simple closing thought."
                    />
                  </label>
                  <label className="field textarea-field">
                    Profile facts
                    <textarea
                      name="meta_items"
                      defaultValue={metaItemsToLines(
                        aboutContent.settings.metaItems,
                      )}
                      placeholder={
                        "Based in: Melbourne\nOrigin: Sri Lanka\nFocus: Photography / design / systems"
                      }
                    />
                    <small>One fact per line. Use Label: Value.</small>
                  </label>
                  <button className="button" type="submit">
                    <Save size={18} />
                    Save main story
                  </button>
                </form>

                <aside
                  className="manager-panel about-quick-add"
                  aria-label="Quick add About blocks"
                >
                  <div className="panel-title-row">
                    <div>
                      <p className="eyebrow">Quick add</p>
                      <h3>Add a page piece</h3>
                      <p className="muted">
                        These add editable starter blocks. Add one, then refine
                        it in the matching section below.
                      </p>
                    </div>
                  </div>
                  <div className="about-template-grid">
                    {aboutQuickTemplates.map((template, index) => (
                      <form
                        action={createAboutBlockAction}
                        className="about-template-card"
                        key={template.title}
                      >
                        <input
                          name="section"
                          type="hidden"
                          value={template.section}
                        />
                        <input
                          name="kind"
                          type="hidden"
                          value={template.kind}
                        />
                        <input
                          name="sort_order"
                          type="hidden"
                          value={nextAboutSortOrder + index}
                        />
                        <input
                          name="label"
                          type="hidden"
                          value={template.label}
                        />
                        <input
                          name="title"
                          type="hidden"
                          value={template.blockTitle}
                        />
                        <input
                          name="body"
                          type="hidden"
                          value={template.body}
                        />
                        <input
                          name="reference"
                          type="hidden"
                          value={template.reference}
                        />
                        <input name="is_active" type="hidden" value="on" />
                        <span className="label">
                          {aboutBlockSectionCopy[template.section].label}
                        </span>
                        <strong>{template.title}</strong>
                        <small>{template.description}</small>
                        <button
                          className="button secondary small"
                          type="submit"
                        >
                          Add {template.title.toLowerCase()}
                        </button>
                      </form>
                    ))}
                  </div>

                  <details className="about-advanced-add">
                    <summary>Custom block</summary>
                    <form
                      action={createAboutBlockAction}
                      className="about-create-form"
                    >
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
                        Sort
                        <input
                          name="sort_order"
                          type="number"
                          defaultValue={nextAboutSortOrder}
                        />
                      </label>
                      <label className="field">
                        Label
                        <input
                          name="label"
                          placeholder="Perspective, Practice..."
                        />
                      </label>
                      <label className="field wide-field">
                        Title / line
                        <input
                          name="title"
                          placeholder="Block title"
                          required
                        />
                      </label>
                      <label className="field textarea-field wide-field">
                        Body
                        <textarea
                          name="body"
                          placeholder="Longer copy if this block needs it."
                        />
                      </label>
                      <label className="field textarea-field wide-field">
                        References / tags
                        <textarea
                          name="reference"
                          placeholder="One per line."
                        />
                      </label>
                      <label className="checkbox-field wide-field">
                        <input
                          name="is_active"
                          type="checkbox"
                          defaultChecked
                        />
                        Publish this block
                      </label>
                      <button className="button" type="submit">
                        Add custom block
                      </button>
                    </form>
                  </details>
                </aside>
              </div>

              <div className="about-builder-sections">
                {aboutBlockSections.map((section, sectionIndex) => {
                  const blocks = aboutBlocksBySection.get(section) ?? [];
                  const liveCount = blocks.filter(
                    (block) => block.isActive,
                  ).length;
                  const sectionDefault = aboutSectionDefaults[section];

                  return (
                    <details
                      className="about-builder-section"
                      key={section}
                      open={sectionIndex === 0}
                    >
                      <summary className="about-section-summary">
                        <span>
                          <span className="label">
                            Section {String(sectionIndex + 1).padStart(2, "0")}
                          </span>
                          <strong>
                            {aboutBlockSectionCopy[section].label}
                          </strong>
                          <small>{aboutBlockSectionCopy[section].detail}</small>
                        </span>
                        <span className="about-summary-pills">
                          <span className="pill">{liveCount} live</span>
                          <span className="pill">
                            {blocks.length - liveCount} hidden
                          </span>
                        </span>
                      </summary>

                      <form
                        action={createAboutBlockAction}
                        className="about-section-add-form"
                      >
                        <input name="section" type="hidden" value={section} />
                        <input
                          name="kind"
                          type="hidden"
                          value={sectionDefault.kind}
                        />
                        <input
                          name="sort_order"
                          type="hidden"
                          value={nextAboutSortOrder + sectionIndex}
                        />
                        <input
                          name="label"
                          type="hidden"
                          value={sectionDefault.label}
                        />
                        <input name="is_active" type="hidden" value="on" />
                        <label className="field">
                          Quick title
                          <input
                            name="title"
                            placeholder={sectionDefault.titlePlaceholder}
                            required
                          />
                        </label>
                        <label className="field">
                          Body
                          <textarea
                            name="body"
                            placeholder={sectionDefault.bodyPlaceholder}
                          />
                        </label>
                        <label className="field">
                          Notes / tags
                          <textarea
                            name="reference"
                            placeholder={sectionDefault.referencePlaceholder}
                          />
                        </label>
                        <button
                          className="button secondary small"
                          type="submit"
                        >
                          {sectionDefault.submitLabel}
                        </button>
                      </form>

                      <div className="about-block-list">
                        {blocks.map((block) => (
                          <details
                            className="about-builder-block"
                            key={block.id}
                          >
                            <summary className="about-block-summary">
                              <span>
                                <span className="label">
                                  {aboutBlockKindCopy[block.kind]} · #
                                  {block.sortOrder}
                                </span>
                                <strong>{block.title}</strong>
                                {block.body ? (
                                  <small>{block.body}</small>
                                ) : null}
                              </span>
                              <span className="about-summary-pills">
                                <span className="pill">
                                  {block.isActive ? "Live" : "Hidden"}
                                </span>
                                <span className="pill">Edit</span>
                              </span>
                            </summary>
                            <form
                              action={updateAboutBlockAction}
                              className="about-block-edit-form"
                            >
                              <input
                                name="block_id"
                                type="hidden"
                                value={block.id}
                              />
                              <div className="block-form-head">
                                <div>
                                  <span className="label">Edit block</span>
                                  <strong>{block.title}</strong>
                                </div>
                                <label className="checkbox-field compact">
                                  <input
                                    name="is_active"
                                    type="checkbox"
                                    defaultChecked={block.isActive}
                                  />
                                  Live on About page
                                </label>
                              </div>
                              <label className="field">
                                Section
                                <select
                                  name="section"
                                  defaultValue={block.section}
                                >
                                  {aboutBlockSections.map((sectionOption) => (
                                    <option
                                      key={sectionOption}
                                      value={sectionOption}
                                    >
                                      {
                                        aboutBlockSectionCopy[sectionOption]
                                          .label
                                      }
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
                                <input
                                  name="label"
                                  defaultValue={block.label ?? ""}
                                />
                              </label>
                              <label className="field wide-field">
                                Title / line
                                <input
                                  name="title"
                                  defaultValue={block.title}
                                  required
                                />
                              </label>
                              <label className="field textarea-field wide-field">
                                Body
                                <textarea
                                  name="body"
                                  defaultValue={block.body ?? ""}
                                />
                              </label>
                              <label className="field textarea-field wide-field">
                                References / tags
                                <textarea
                                  name="reference"
                                  defaultValue={block.reference ?? ""}
                                />
                              </label>
                              <button
                                className="button secondary small"
                                type="submit"
                              >
                                <Save size={16} />
                                Save block
                              </button>
                            </form>
                            <form
                              action={deleteAboutBlockAction}
                              className="danger-zone"
                            >
                              <input
                                name="block_id"
                                type="hidden"
                                value={block.id}
                              />
                              <ConfirmSubmitButton
                                className="button danger small"
                                confirmMessage={`Delete this About page block: ${block.title}?`}
                              >
                                <Trash2 size={16} />
                                Delete block
                              </ConfirmSubmitButton>
                            </form>
                          </details>
                        ))}
                        {!blocks.length ? (
                          <p className="muted">
                            No blocks in this section yet.
                          </p>
                        ) : null}
                      </div>
                    </details>
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
                  Select an album to edit details, check upload status, set a
                  cover, manage ZIP delivery, and remove files.
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
                    <input
                      name="album"
                      type="hidden"
                      value={selectedAlbum?.id ?? ""}
                    />
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
                          status: albumStatusFilter,
                        })}
                        key={album.id}
                      >
                        <span>
                          <strong>{album.title}</strong>
                          <small>{album.slug}</small>
                        </span>
                        <span className="album-badges">
                          <span>
                            {albumPhotoCounts.get(album.id) ?? 0} photos
                          </span>
                          <span>
                            {albumStatus(
                              album,
                              albumPhotoCounts.get(album.id) ?? 0,
                            )}
                          </span>
                          <span>{album.is_public ? "Public" : "Private"}</span>
                          {album.requires_email ? <span>Email</span> : null}
                          {album.allow_client_password_access !== false ? (
                            <span>Client PW</span>
                          ) : null}
                          {album.is_password_protected ? (
                            <span>Protected</span>
                          ) : null}
                          {album.download_zip_url ? <span>ZIP</span> : null}
                        </span>
                      </a>
                    ))}
                    {!albums.length ? (
                      <p className="muted">No albums yet.</p>
                    ) : null}
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
                          <a
                            className="button secondary small"
                            href={`/client/${selectedAlbum.slug}`}
                          >
                            <ExternalLink size={16} />
                            Open gallery
                          </a>
                          <CopyLinkButton value={selectedClientLink} />
                          {selectedAlbum.is_public ? (
                            <a
                              className="button secondary small"
                              href="/albums"
                            >
                              <ExternalLink size={16} />
                              Public page
                            </a>
                          ) : null}
                        </div>
                      </div>

                      <div className="detail-grid">
                        <div>
                          <span className="label">Client link</span>
                          <code className="code-line">
                            {selectedClientLink}
                          </code>
                        </div>
                        <div>
                          <span className="label">Status</span>
                          <strong>
                            {albumStatus(
                              selectedAlbum,
                              selectedAlbumPhotoCount,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span className="label">Created</span>
                          <strong>
                            {formatDateTime(selectedAlbum.created_at)}
                          </strong>
                        </div>
                        <div>
                          <span className="label">ZIP</span>
                          <strong>
                            {selectedAlbum.download_zip_url
                              ? "Uploaded"
                              : "Missing"}
                          </strong>
                        </div>
                        <div>
                          <span className="label">Cover</span>
                          <strong>
                            {selectedAlbum.cover_photo_url ? "Set" : "Not set"}
                          </strong>
                        </div>
                        <div>
                          <span className="label">Assigned clients</span>
                          <strong>{selectedAssignedClients.length}</strong>
                        </div>
                        <div>
                          <span className="label">Access</span>
                          <strong>
                            {selectedAlbum.allow_client_password_access !==
                            false
                              ? "Client password on"
                              : "Client password off"}
                            {selectedAlbum.requires_email
                              ? " + email required"
                              : ""}
                          </strong>
                        </div>
                      </div>

                      <div className="share-box">
                        <div className="panel-title-row">
                          <div>
                            <h3>Send to client</h3>
                            <p className="muted">
                              Copy this message into Gmail, Instagram, or SMS.
                              For password albums, add the password you set.
                            </p>
                          </div>
                          <div className="inline-actions">
                            <form action={sendAlbumReadyEmailAction}>
                              <input
                                name="album_id"
                                type="hidden"
                                value={selectedAlbum.id}
                              />
                              <button
                                className="button small"
                                type="submit"
                                disabled={
                                  !selectedAssignedClients.some(
                                    (client) => client.email,
                                  )
                                }
                              >
                                <Mail size={16} />
                                Email clients
                              </button>
                            </form>
                            <CopyTextButton
                              text={selectedShareMessage}
                              label="Copy message"
                            />
                          </div>
                        </div>
                        <pre>{selectedShareMessage}</pre>
                        <div className="delivery-summary-grid">
                          <div>
                            <span className="label">Email subject</span>
                            <strong>
                              {selectedAlbum.title} is ready - rxncor.studio
                            </strong>
                          </div>
                          <div>
                            <span className="label">Recipients</span>
                            <strong>
                              {
                                selectedAssignedClients.filter(
                                  (client) => client.email,
                                ).length
                              }{" "}
                              ready
                            </strong>
                            <small>
                              {selectedAssignedClients
                                .map((client) => client.email)
                                .filter(Boolean)
                                .join(", ") ||
                                "Add client emails before sending."}
                            </small>
                          </div>
                          <div>
                            <span className="label">Access note</span>
                            <strong>
                              {selectedAlbum.is_password_protected
                                ? "Gallery password required"
                                : selectedAlbum.allow_client_password_access !==
                                    false
                                  ? "Client password login"
                                  : "Email gate only"}
                            </strong>
                          </div>
                        </div>
                        <div className="copy-detail-list">
                          {selectedAssignedClients.map((client) => (
                            <div className="copy-detail-row" key={client.id}>
                              <div>
                                <strong>{client.name}</strong>
                                <small>
                                  {client.email ?? "No email saved"}
                                </small>
                              </div>
                              <CopyTextButton
                                label="Copy login details"
                                text={clientLoginDetailsMessage({
                                  album: selectedAlbum,
                                  client,
                                  albumLink: selectedClientLink,
                                  photoCount: selectedAlbumPhotoCount,
                                })}
                              />
                            </div>
                          ))}
                          {!selectedAssignedClients.length ? (
                            <p className="muted">
                              Assign clients below to generate client-specific
                              login messages.
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <form action={updateAlbumAction} className="compact-form">
                        <input
                          name="album_id"
                          type="hidden"
                          value={selectedAlbum.id}
                        />
                        <label className="field">
                          Client
                          <select
                            name="client_id"
                            defaultValue={selectedAlbum.client_id ?? ""}
                          >
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
                          <input
                            name="title"
                            defaultValue={selectedAlbum.title}
                            required
                          />
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
                            defaultValue={dateInputValue(
                              selectedAlbum.event_date,
                            )}
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
                            defaultChecked={Boolean(
                              selectedAlbum.requires_email,
                            )}
                          />
                          Require email before viewing
                        </label>
                        <label className="checkbox-field">
                          <input
                            name="allow_client_password_access"
                            type="checkbox"
                            defaultChecked={
                              selectedAlbum.allow_client_password_access !==
                              false
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
                            defaultValue={dateInputValue(
                              selectedAlbum.expires_at,
                            )}
                          />
                        </label>
                        <div className="assignment-list">
                          <span className="label">Assigned clients</span>
                          {clients.map((client) => (
                            <label
                              className="checkbox-field compact"
                              key={client.id}
                            >
                              <input
                                name="assigned_client_ids"
                                type="checkbox"
                                value={client.id}
                                defaultChecked={selectedAssignedClientIds.has(
                                  client.id,
                                )}
                              />
                              {client.name}
                              {client.email ? ` (${client.email})` : ""}
                              {client.password_hash
                                ? " · client password set"
                                : ""}
                            </label>
                          ))}
                          {!clients.length ? (
                            <p className="muted">
                              Create clients first, then assign them here.
                            </p>
                          ) : null}
                        </div>
                        <button className="button" type="submit">
                          <Save size={18} />
                          Save album details
                        </button>
                      </form>

                      <div className="danger-zone">
                        <form action={deleteAlbumAction}>
                          <input
                            name="album_id"
                            type="hidden"
                            value={selectedAlbum.id}
                          />
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
                            <input
                              name="album_id"
                              type="hidden"
                              value={selectedAlbum.id}
                            />
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
                    <p className="muted">
                      Create an album first, then it will appear here.
                    </p>
                  )}
                </div>
              </div>

              {selectedAlbum ? (
                <div className="manager-panel file-panel">
                  <div className="panel-title-row">
                    <div>
                      <h3>Files in {selectedAlbum.title}</h3>
                      <p className="muted">
                        {displayPhotos.length} files shown with upload date, R2
                        key, cover status, and actions.
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
                                <span className="mini-thumb placeholder">
                                  No preview
                                </span>
                              )}
                            </td>
                            <td>
                              <strong>{photo.displayLabel.title}</strong>
                              <small>{photo.displayLabel.eyebrow}</small>
                              <code className="code-line">
                                {photo.filename}
                              </code>
                            </td>
                            <td>
                              <span>{photo.displayLabel.detail}</span>
                              <span>
                                {formatBytes(
                                  photo.file_size_bytes ??
                                    (photo.thumbnail_size_bytes ?? 0) +
                                      (photo.preview_size_bytes ?? 0) +
                                      (photo.full_size_bytes ?? 0),
                                )}
                                {photo.generated_thumbnail ||
                                photo.generated_preview
                                  ? " · auto-generated web images"
                                  : ""}
                              </span>
                              <span>
                                Uploaded {formatDateTime(photo.uploaded_at)}
                              </span>
                              <code className="code-line">
                                {photo.r2_object_key}
                              </code>
                              <details className="photo-meta-editor">
                                <summary>Edit public card label</summary>
                                <form
                                  action={updatePhotoMetadataAction}
                                  className="photo-meta-form"
                                >
                                  <input
                                    name="photo_id"
                                    type="hidden"
                                    value={photo.id}
                                  />
                                  <label className="field">
                                    Card title
                                    <input
                                      name="display_title"
                                      defaultValue={photo.display_title ?? ""}
                                      placeholder={photo.displayLabel.title}
                                    />
                                  </label>
                                  <label className="field">
                                    Caption
                                    <input
                                      name="caption"
                                      defaultValue={photo.caption ?? ""}
                                      placeholder="Short human caption"
                                    />
                                  </label>
                                  <label className="field">
                                    Camera
                                    <input
                                      name="camera_model"
                                      defaultValue={photo.camera_model ?? ""}
                                      placeholder="Sony A7 IV"
                                    />
                                  </label>
                                  <label className="field">
                                    Lens
                                    <input
                                      name="lens_model"
                                      defaultValue={photo.lens_model ?? ""}
                                      placeholder="Sony 35mm f/1.4 GM"
                                    />
                                  </label>
                                  <label className="field">
                                    Focal length
                                    <input
                                      name="focal_length"
                                      defaultValue={photo.focal_length ?? ""}
                                      placeholder="35mm"
                                    />
                                  </label>
                                  <label className="field">
                                    Aperture
                                    <input
                                      name="aperture"
                                      defaultValue={photo.aperture ?? ""}
                                      placeholder="f/1.8"
                                    />
                                  </label>
                                  <label className="field">
                                    Shutter
                                    <input
                                      name="shutter_speed"
                                      defaultValue={photo.shutter_speed ?? ""}
                                      placeholder="1/250"
                                    />
                                  </label>
                                  <label className="field">
                                    ISO
                                    <input
                                      name="iso"
                                      defaultValue={photo.iso ?? ""}
                                      placeholder="ISO 400"
                                    />
                                  </label>
                                  <label className="field">
                                    Captured
                                    <input
                                      name="captured_at"
                                      type="datetime-local"
                                      defaultValue={dateTimeInputValue(
                                        photo.captured_at ?? null,
                                      )}
                                    />
                                  </label>
                                  <label className="field">
                                    Location
                                    <input
                                      name="location"
                                      defaultValue={photo.location ?? ""}
                                      placeholder="Melbourne"
                                    />
                                  </label>
                                  <button
                                    className="button secondary small"
                                    type="submit"
                                  >
                                    <Save size={16} />
                                    Save label
                                  </button>
                                </form>
                              </details>
                            </td>
                            <td>
                              <span className="album-badges">
                                {photo.isCover ? <span>Cover</span> : null}
                                {photo.is_selected ? (
                                  <span>Selected</span>
                                ) : null}
                                {!photo.isCover && !photo.is_selected ? (
                                  <span>Ready</span>
                                ) : null}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions">
                                <AdminFileActionButton
                                  albumId={selectedAlbum.id}
                                  photoId={photo.id}
                                  kind="preview"
                                />
                                <AdminFileActionButton
                                  albumId={selectedAlbum.id}
                                  photoId={photo.id}
                                  kind="full"
                                />
                                <form action={setCoverPhotoAction}>
                                  <input
                                    name="photo_id"
                                    type="hidden"
                                    value={photo.id}
                                  />
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
                                  <input
                                    name="photo_id"
                                    type="hidden"
                                    value={photo.id}
                                  />
                                  <button
                                    className="button secondary small"
                                    type="submit"
                                  >
                                    <Star size={16} />
                                    {photo.is_selected ? "Unselect" : "Select"}
                                  </button>
                                </form>
                                <form action={deletePhotoAction}>
                                  <input
                                    name="photo_id"
                                    type="hidden"
                                    value={photo.id}
                                  />
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
                            <td colSpan={5}>
                              No photos uploaded to this album yet.
                            </td>
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
                        Per-album download history for client support and
                        delivery checks.
                      </p>
                    </div>
                    <span className="pill">
                      {selectedAlbumLogs.length} recent
                    </span>
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
                                ? (logPhotoNames.get(log.photo_id) ??
                                  log.photo_id.slice(0, 8))
                                : "Album ZIP"}
                            </td>
                            <td>{log.client_email ?? "Not captured"}</td>
                            <td>{log.ip_address ?? "Not captured"}</td>
                          </tr>
                        ))}
                        {!selectedAlbumLogs.length ? (
                          <tr>
                            <td colSpan={4}>
                              No downloads for this album yet.
                            </td>
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
                  <input
                    name="email"
                    type="email"
                    placeholder="client@example.com"
                  />
                </label>
                <label className="field">
                  Phone
                  <input name="phone" placeholder="+61" />
                </label>
                <label className="field">
                  Client password
                  <input
                    name="password"
                    type="password"
                    placeholder="Optional"
                  />
                  <small>
                    Used only on the public client login page. This is separate
                    from admin login and album passwords.
                  </small>
                </label>
                <button className="button" type="submit">
                  Create client
                </button>
              </form>

              <div className="client-list">
                {clients.map((client) => (
                  <div className="client-card" key={client.id}>
                    <form
                      action={updateClientAction}
                      className="client-edit-row"
                    >
                      <input name="client_id" type="hidden" value={client.id} />
                      <div>
                        <span className="label">Client login</span>
                        <strong>
                          {client.password_hash
                            ? "Password set"
                            : "No password"}
                        </strong>
                      </div>
                      <label className="field">
                        Name
                        <input
                          name="name"
                          defaultValue={client.name}
                          required
                        />
                      </label>
                      <label className="field">
                        Email
                        <input
                          name="email"
                          type="email"
                          defaultValue={client.email ?? ""}
                        />
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
                {!clients.length ? (
                  <p className="muted">No clients yet.</p>
                ) : null}
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
                  <input
                    name="allow_client_password_access"
                    type="checkbox"
                    defaultChecked
                  />
                  Assigned clients can use their own password
                </label>
                <label className="field">
                  Expiry date
                  <input name="expires_at" type="date" />
                </label>
                <div className="assignment-list">
                  <span className="label">Assign clients</span>
                  <p className="muted">
                    Choose everyone who should see this album in their client
                    login. The primary client above is included automatically.
                  </p>
                  {clients.map((client) => (
                    <label className="checkbox-field compact" key={client.id}>
                      <input
                        name="assigned_client_ids"
                        type="checkbox"
                        value={client.id}
                      />
                      {client.name}
                      {client.email ? ` (${client.email})` : ""}
                      {client.password_hash
                        ? " · password set"
                        : " · needs password"}
                    </label>
                  ))}
                  {!clients.length ? (
                    <p className="muted">
                      Create clients first, then assign them here.
                    </p>
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
              <AdminPhotoUpload
                albums={albums}
                defaultAlbumId={selectedAlbum?.id}
              />
              <h3 className="subsection-title">Full album ZIP</h3>
              <AdminZipUpload
                albums={albums}
                defaultAlbumId={selectedAlbum?.id}
              />
            </section>
          ) : null}

          {activeView === "monitoring" ? (
            <section id="monitoring" className="admin-section">
              <div className="stat-grid">
                <div className="stat">
                  <DatabaseBackup size={20} />
                  <strong>{formatBytes(trackedStorageBytes)}</strong>
                  <span>Tracked storage</span>
                </div>
                <div className="stat">
                  <ImageUp size={20} />
                  <strong>{recentUploadEvents.length}</strong>
                  <span>Uploads 24h</span>
                </div>
                <div className="stat">
                  <CircleAlert size={20} />
                  <strong>{recentUploadFailures}</strong>
                  <span>Failed 24h</span>
                </div>
                <div className="stat">
                  <LinkIcon size={20} />
                  <strong>{downloadEventsToday}</strong>
                  <span>Downloads 24h</span>
                </div>
                <div className="stat">
                  <Mail size={20} />
                  <strong>{emailSentToday}</strong>
                  <span>Emails sent 24h</span>
                </div>
              </div>

              <section className="workflow-panel" aria-label="Upload health">
                <div className="panel-title-row">
                  <div>
                    <p className="eyebrow">Upload health</p>
                    <h2>What the system is seeing</h2>
                    <p className="muted">
                      Upload events are written after successful photo saves and
                      after failed browser/R2 attempts. This gives you a trail
                      when a large album gets interrupted.
                    </p>
                  </div>
                  <span className="pill">
                    {weeklyUploadFailures} failed this week
                  </span>
                </div>
                <div className="readiness-grid">
                  <div
                    className={`readiness-item ${
                      weeklyUploadFailures ? "attention" : "complete"
                    }`}
                  >
                    {weeklyUploadFailures ? (
                      <CircleAlert size={18} />
                    ) : (
                      <CircleCheck size={18} />
                    )}
                    <span>
                      <strong>
                        {weeklyUploadFailures} weekly upload failures
                      </strong>
                      <small>
                        Check failed rows before retrying a large album.
                      </small>
                    </span>
                  </div>
                  <div className="readiness-item complete">
                    <ImageUp size={18} />
                    <span>
                      <strong>
                        {generatedPhotoCount} generated image sets
                      </strong>
                      <small>
                        Photos where thumbnail or preview was made in-browser.
                      </small>
                    </span>
                  </div>
                  <div className="readiness-item complete">
                    <DatabaseBackup size={18} />
                    <span>
                      <strong>
                        {formatBytes(trackedStorageBytes)} tracked
                      </strong>
                      <small>
                        Based on upload metadata saved with photo records.
                      </small>
                    </span>
                  </div>
                  <div className="readiness-item complete">
                    <LinkIcon size={18} />
                    <span>
                      <strong>
                        {downloadLogs.length} recent downloads loaded
                      </strong>
                      <small>
                        Open Downloads for per-file client audit rows.
                      </small>
                    </span>
                  </div>
                  <div
                    className={`readiness-item ${
                      weeklyEmailFailures ? "attention" : "complete"
                    }`}
                  >
                    {weeklyEmailFailures ? (
                      <CircleAlert size={18} />
                    ) : (
                      <Mail size={18} />
                    )}
                    <span>
                      <strong>
                        {weeklyEmailFailures} weekly email failures
                      </strong>
                      <small>
                        Failed Resend calls and skipped config checks are logged
                        below.
                      </small>
                    </span>
                  </div>
                </div>
              </section>

              <section
                className="workflow-panel"
                aria-label="Album storage summary"
              >
                <div className="panel-title-row">
                  <div>
                    <p className="eyebrow">Album storage</p>
                    <h2>Largest tracked albums</h2>
                    <p className="muted">
                      This is an app-side estimate from files uploaded after
                      storage tracking was added. Cloudflare R2 remains the
                      billing source of truth.
                    </p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Album</th>
                        <th>Photos</th>
                        <th>Tracked size</th>
                        <th>Auto generated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...albums]
                        .sort(
                          (a, b) =>
                            (albumStorageBytes.get(b.id) ?? 0) -
                            (albumStorageBytes.get(a.id) ?? 0),
                        )
                        .slice(0, 10)
                        .map((album) => (
                          <tr key={album.id}>
                            <td>
                              <strong>{album.title}</strong>
                              <small>{album.slug}</small>
                            </td>
                            <td>{albumPhotoCounts.get(album.id) ?? 0}</td>
                            <td>
                              {formatBytes(
                                albumStorageBytes.get(album.id) ?? 0,
                              )}
                            </td>
                            <td>{albumGeneratedCounts.get(album.id) ?? 0}</td>
                          </tr>
                        ))}
                      {!albums.length ? (
                        <tr>
                          <td colSpan={4}>No albums yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className="workflow-panel"
                aria-label="Recent upload events"
              >
                <div className="panel-title-row">
                  <div>
                    <p className="eyebrow">Event trail</p>
                    <h2>Recent upload events</h2>
                  </div>
                  <span className="pill">{uploadEvents.length} loaded</span>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Status</th>
                        <th>Album</th>
                        <th>File</th>
                        <th>Size</th>
                        <th>Time</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadEvents.map((event) => (
                        <tr key={event.id}>
                          <td>{formatDateTime(event.created_at)}</td>
                          <td>{event.status}</td>
                          <td>
                            {event.album_id
                              ? (logAlbumTitles.get(event.album_id) ??
                                event.album_id.slice(0, 8))
                              : "Not captured"}
                          </td>
                          <td>{event.filename ?? "Not captured"}</td>
                          <td>{formatBytes(event.size_bytes ?? 0)}</td>
                          <td>
                            {event.duration_ms
                              ? `${(event.duration_ms / 1000).toFixed(1)}s`
                              : "Not captured"}
                          </td>
                          <td>
                            <p className="table-message">
                              {event.message ?? "No message"}
                            </p>
                          </td>
                        </tr>
                      ))}
                      {!uploadEvents.length ? (
                        <tr>
                          <td colSpan={7}>No upload events logged yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="workflow-panel" aria-label="Email monitoring">
                <div className="panel-title-row">
                  <div>
                    <p className="eyebrow">Email chain</p>
                    <h2>Recent email events</h2>
                    <p className="muted">
                      Every monitored email attempt is logged here: client
                      gallery updates, ZIP notices, booking replies, contact
                      confirmations, and admin upload alerts.
                    </p>
                  </div>
                  <span className="pill">
                    {recentEmailFailures} failed · {recentEmailSkipped} skipped
                    24h
                  </span>
                </div>
                <div className="readiness-grid">
                  <div className="readiness-item complete">
                    <Mail size={18} />
                    <span>
                      <strong>{emailSentToday} emails sent today</strong>
                      <small>
                        Accepted by Resend from tracked app workflows.
                      </small>
                    </span>
                  </div>
                  <div
                    className={`readiness-item ${
                      recentEmailFailures ? "attention" : "complete"
                    }`}
                  >
                    {recentEmailFailures ? (
                      <CircleAlert size={18} />
                    ) : (
                      <CircleCheck size={18} />
                    )}
                    <span>
                      <strong>{recentEmailFailures} failed today</strong>
                      <small>
                        Provider rejections or network failures show in the
                        event table.
                      </small>
                    </span>
                  </div>
                  <div
                    className={`readiness-item ${
                      recentEmailSkipped ? "attention" : "complete"
                    }`}
                  >
                    {recentEmailSkipped ? (
                      <CircleAlert size={18} />
                    ) : (
                      <CircleCheck size={18} />
                    )}
                    <span>
                      <strong>{recentEmailSkipped} skipped today</strong>
                      <small>
                        Usually no recipients or missing email environment
                        variables.
                      </small>
                    </span>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Status</th>
                        <th>Type</th>
                        <th>Recipient</th>
                        <th>Subject</th>
                        <th>Related</th>
                        <th>Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailEvents.map((event) => {
                        const albumTitle = event.album_id
                          ? logAlbumTitles.get(event.album_id)
                          : metadataText(event.metadata, "album_title");
                        const relatedLabel =
                          albumTitle ??
                          (event.related_type
                            ? `${event.related_type}${event.related_id ? ` · ${event.related_id}` : ""}`
                            : "Not captured");

                        return (
                          <tr key={event.id}>
                            <td>{formatDateTime(event.created_at)}</td>
                            <td>{event.status}</td>
                            <td>{emailTypeLabel(event.email_type)}</td>
                            <td>{event.recipient ?? "No recipient"}</td>
                            <td>
                              <p className="table-message">{event.subject}</p>
                            </td>
                            <td>
                              <strong>{relatedLabel}</strong>
                              <small>
                                {event.provider_status ?? event.provider}
                              </small>
                            </td>
                            <td>
                              <p className="table-message">
                                {event.message ?? "No message"}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                      {!emailEvents.length ? (
                        <tr>
                          <td colSpan={7}>No email events logged yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className="workflow-panel"
                aria-label="Admin audit trail"
              >
                <div className="panel-title-row">
                  <div>
                    <p className="eyebrow">Audit trail</p>
                    <h2>Recent admin changes</h2>
                    <p className="muted">
                      A lightweight record of album, client, delivery, request,
                      and page-builder actions. Helpful when you need to
                      remember what changed before a client saw it.
                    </p>
                  </div>
                  <span className="pill">{auditLogs.length} loaded</span>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Action</th>
                        <th>Object</th>
                        <th>Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{formatDateTime(log.created_at)}</td>
                          <td>{log.action}</td>
                          <td>
                            <strong>{log.entity_type}</strong>
                            <small>{log.entity_id ?? "No object id"}</small>
                          </td>
                          <td>
                            <p className="table-message">{log.summary}</p>
                          </td>
                        </tr>
                      ))}
                      {!auditLogs.length ? (
                        <tr>
                          <td colSpan={4}>No admin changes logged yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
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
                          {albumStatus(
                            album,
                            albumPhotoCounts.get(album.id) ?? 0,
                          )}
                          {" · "}
                          {album.is_public ? "Public" : "Private"}
                          {album.is_password_protected ? " + protected" : ""}
                          {album.download_zip_url ? " + ZIP" : ""}
                        </td>
                        <td>
                          <a
                            className="button secondary small"
                            href={`/client/${album.slug}`}
                          >
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
                    Latest downloads from client galleries. Private galleries
                    can capture client email during unlock.
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
                        <td>
                          {logAlbumTitles.get(log.album_id) ?? log.album_id}
                        </td>
                        <td>
                          {log.photo_id
                            ? (logPhotoNames.get(log.photo_id) ??
                              log.photo_id.slice(0, 8))
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
                    Review client shoot requests, adjust timing, accept work,
                    and create client/gallery records when needed.
                  </p>
                </div>
                <span className="pill">{shootRequests.length} recent</span>
              </div>
              {shootRequestsUnavailable ? (
                <Notice
                  notice={{
                    tone: "warning",
                    title: "Shoot requests are not available yet",
                    message:
                      "Run supabase/migrations/20260519_shoot_requests.sql in Supabase SQL Editor, then refresh this page.",
                  }}
                />
              ) : null}
              <div className="shoot-request-list">
                {shootRequests.map((request) => {
                  const linkedClient = request.client_id
                    ? clientById.get(request.client_id)
                    : null;
                  const linkedAlbum = request.album_id
                    ? albumById.get(request.album_id)
                    : null;

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
                          {linkedClient ? (
                            <span>Client: {linkedClient.name}</span>
                          ) : null}
                          {linkedAlbum ? (
                            <span>Album: {linkedAlbum.title}</span>
                          ) : null}
                        </div>
                      </div>
                      {request.message ? (
                        <p className="table-message">{request.message}</p>
                      ) : null}
                      <form
                        action={updateShootRequestAction}
                        className="request-edit-form"
                      >
                        <input
                          name="shoot_request_id"
                          type="hidden"
                          value={request.id}
                        />
                        <label className="field">
                          Name
                          <input
                            name="name"
                            defaultValue={request.name}
                            required
                          />
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
                          <input
                            name="phone"
                            defaultValue={request.phone ?? ""}
                          />
                        </label>
                        <label className="field">
                          Shoot type
                          <input
                            name="shoot_type"
                            defaultValue={request.shoot_type}
                            required
                          />
                        </label>
                        <label className="field">
                          Location
                          <input
                            name="location"
                            defaultValue={request.location ?? ""}
                          />
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
                            defaultValue={dateTimeInputValue(
                              request.preferred_start_at,
                            )}
                            required
                          />
                        </label>
                        <label className="field">
                          Finish
                          <input
                            name="preferred_end_at"
                            type="datetime-local"
                            defaultValue={dateTimeInputValue(
                              request.preferred_end_at,
                            )}
                            required
                          />
                        </label>
                        <label className="field wide-field">
                          Request details
                          <textarea
                            name="message"
                            defaultValue={request.message ?? ""}
                          />
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
                        <label className="checkbox-field">
                          <input name="email_client_update" type="checkbox" />
                          Email client this status update
                        </label>
                        <div className="inline-actions">
                          <button className="button" type="submit">
                            <Save size={18} />
                            Save request
                          </button>
                        </div>
                      </form>
                      <form
                        action={deleteShootRequestAction}
                        className="danger-zone"
                      >
                        <input
                          name="shoot_request_id"
                          type="hidden"
                          value={request.id}
                        />
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
                    Messages from the homepage contact form. Reply from your
                    email, then update the status here.
                  </p>
                </div>
                <span className="pill">{inquiries.length} recent</span>
              </div>
              {inquiriesUnavailable ? (
                <Notice
                  notice={{
                    tone: "warning",
                    title: "Booking inquiries are not available yet",
                    message:
                      "Run supabase/migrations/20260519_contact_inquiries.sql in Supabase SQL Editor, then refresh this page.",
                  }}
                />
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
                          {inquiry.phone ? (
                            <small>{inquiry.phone}</small>
                          ) : null}
                        </td>
                        <td>
                          <p className="table-message">{inquiry.message}</p>
                          <small>
                            {inquiry.ip_address ?? "IP not captured"}
                          </small>
                        </td>
                        <td>
                          <form
                            action={updateInquiryStatusAction}
                            className="status-form"
                          >
                            <input
                              name="inquiry_id"
                              type="hidden"
                              value={inquiry.id}
                            />
                            <select name="status" defaultValue={inquiry.status}>
                              <option value="new">New</option>
                              <option value="replied">Replied</option>
                              <option value="archived">Archived</option>
                            </select>
                            <button
                              className="button secondary small"
                              type="submit"
                            >
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
                    R2 is delivery storage. Keep Lightroom/Capture One exports
                    and delivered ZIP files somewhere you control.
                  </p>
                </div>
                <DatabaseBackup size={26} />
              </div>
              <div className="feature-list backup-list">
                <div className="feature">
                  <h3>Supabase export</h3>
                  <p>
                    Export clients, albums, album_clients, photos, downloads,
                    uploads, email events, requests, inquiries, and audit rows
                    weekly.
                  </p>
                  <div className="inline-actions">
                    <a
                      className="button small"
                      href="/api/admin/export?format=json"
                    >
                      Download full JSON
                    </a>
                    <a
                      className="button secondary small"
                      href="/api/admin/export?format=csv&table=clients"
                    >
                      Clients CSV
                    </a>
                    <a
                      className="button secondary small"
                      href="/api/admin/export?format=csv&table=albums"
                    >
                      Albums CSV
                    </a>
                    <a
                      className="button secondary small"
                      href="/api/admin/export?format=csv&table=photos"
                    >
                      Photos CSV
                    </a>
                  </div>
                </div>
                <div className="feature">
                  <h3>R2 delivery files</h3>
                  <p>
                    Keep a local or external backup of each final album ZIP
                    before deleting R2 files.
                  </p>
                </div>
                <div className="feature">
                  <h3>Before sending</h3>
                  <p>
                    Confirm cover, assigned client, password, expiry date,
                    photos, ZIP, and test download.
                  </p>
                </div>
                <div className="feature">
                  <h3>After sending</h3>
                  <p>
                    Check per-album download history and keep shoot request
                    notes current.
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
