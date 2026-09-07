import {
  Aperture,
  Archive,
  BookOpenText,
  BriefcaseBusiness,
  CloudUpload,
  ContactRound,
  Download,
  ExternalLink,
  FolderKanban,
  Gauge,
  ImagePlus,
  LayoutDashboard,
  Mail,
  Menu,
  MessageSquareText,
  ReceiptText,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/app/admin/admin.module.css";

export type AdminWorkspaceView =
  | "overview"
  | "albums"
  | "clients"
  | "invoices"
  | "pipeline"
  | "requests"
  | "inquiries"
  | "delivery"
  | "uploads"
  | "new-album"
  | "about"
  | "contact"
  | "monitoring"
  | "downloads"
  | "backups";

type NavigationItem = {
  view: AdminWorkspaceView;
  label: string;
  icon: typeof LayoutDashboard;
};

const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { view: "overview", label: "Overview", icon: LayoutDashboard },
      { view: "albums", label: "Albums & files", icon: FolderKanban },
      { view: "clients", label: "Clients", icon: UsersRound },
      { view: "invoices", label: "Invoices", icon: ReceiptText },
    ],
  },
  {
    label: "Jobs & delivery",
    items: [
      { view: "pipeline", label: "Jobs pipeline", icon: BriefcaseBusiness },
      { view: "requests", label: "Shoot requests", icon: Aperture },
      { view: "inquiries", label: "Inquiries", icon: MessageSquareText },
      { view: "uploads", label: "Uploads", icon: CloudUpload },
      { view: "delivery", label: "Delivery status", icon: Mail },
    ],
  },
  {
    label: "Website",
    items: [
      { view: "about", label: "About page", icon: BookOpenText },
      { view: "contact", label: "Contact & socials", icon: ContactRound },
    ],
  },
  {
    label: "Operations",
    items: [
      { view: "monitoring", label: "Activity & health", icon: Gauge },
      { view: "downloads", label: "Download log", icon: Download },
      { view: "backups", label: "Backups", icon: Archive },
    ],
  },
];

const mobileNavigation = navigationGroups.flatMap((group) => group.items);

function adminLink(view: AdminWorkspaceView, selectedAlbumId?: string) {
  if (view === "invoices") return "/admin/invoices";

  const search = new URLSearchParams({ view });
  if (selectedAlbumId && ["albums", "uploads", "delivery"].includes(view)) {
    search.set("album", selectedAlbumId);
  }
  return `/admin?${search.toString()}`;
}

type AdminWorkspaceShellProps = {
  activeView: AdminWorkspaceView;
  children: ReactNode;
  counts?: Partial<Record<AdminWorkspaceView, number>>;
  selectedAlbumId?: string;
};

export function AdminWorkspaceShell({
  activeView,
  children,
  counts = {},
  selectedAlbumId,
}: AdminWorkspaceShellProps) {
  const activeLabel =
    mobileNavigation.find((item) => item.view === activeView)?.label ??
    (activeView === "new-album" ? "New album" : "Admin");

  return (
    <main className={`${styles.app} admin-v4`}>
      <div className="admin-layout" data-view={activeView}>
        <aside className="admin-sidebar" aria-label="Admin workspace navigation">
          <Link className="admin-sidebar-brand" href="/admin?view=overview">
            <span className="admin-signature-mark" aria-hidden="true">
              <Image alt="" height={52} priority src="/sig.png" width={172} />
            </span>
            <span className="admin-brand-copy">
              <strong>Studio admin</strong>
              <small>RXNCOR / Melbourne</small>
            </span>
          </Link>

          <Link className="admin-create-shortcut" href="/admin?view=new-album">
            <ImagePlus size={17} aria-hidden="true" />
            New album
          </Link>

          <nav className="admin-primary-nav" aria-label="Admin pages">
            {navigationGroups.map((group) => (
              <div className="admin-nav-group" key={group.label}>
                <span className="admin-nav-group-label">{group.label}</span>
                {group.items.map(({ view, label, icon: Icon }) => {
                  const count = counts[view] ?? 0;
                  const active = activeView === view;
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={active ? "active" : undefined}
                      href={adminLink(view, selectedAlbumId)}
                      key={view}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{label}</span>
                      {count > 0 ? <span className="admin-nav-count">{count}</span> : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <span className="admin-environment"><i aria-hidden="true" /> {process.env.VERCEL_ENV === "production" ? "Production" : process.env.VERCEL_ENV === "preview" ? "Preview" : "Development"}</span>
            <Link href="/" target="_blank" rel="noreferrer">
              Open site <ExternalLink size={15} aria-hidden="true" />
            </Link>
          </div>
        </aside>

        <section className="dashboard-panel admin-main-panel">
          <details className="admin-mobile-nav">
            <summary>
              <Menu size={19} aria-hidden="true" />
              <span>RXNCOR Admin</span>
              <strong>{activeLabel}</strong>
            </summary>
            <nav className="admin-mobile-nav-grid" aria-label="Mobile admin pages">
              <Link className="admin-mobile-create" href="/admin?view=new-album">
                <ImagePlus size={17} aria-hidden="true" /> New album
              </Link>
              {mobileNavigation.map(({ view, label, icon: Icon }) => {
                const active = activeView === view;
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={active ? "active" : undefined}
                    href={adminLink(view, selectedAlbumId)}
                    key={view}
                  >
                    <Icon size={17} aria-hidden="true" /> {label}
                  </Link>
                );
              })}
            </nav>
          </details>
          {children}
        </section>
      </div>
    </main>
  );
}
