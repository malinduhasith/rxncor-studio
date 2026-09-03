"use client";

import {
  Aperture,
  BookOpenText,
  CloudUpload,
  ContactRound,
  Download,
  ExternalLink,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Mail,
  MessageSquareText,
  Plus,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type AdminCommandMenuProps = {
  albums: Array<{ id: string; title: string; slug: string }>;
  clients: Array<{ id: string; name: string; email: string | null }>;
  selectedAlbumId?: string;
  selectedAlbumSlug?: string;
};

const destinations = [
  { label: "Overview", detail: "Studio health and priorities", view: "overview", icon: LayoutDashboard },
  { label: "Albums", detail: "Manage galleries and photos", view: "albums", icon: FolderKanban },
  { label: "New album", detail: "Create a delivery gallery", view: "new-album", icon: Plus },
  { label: "Clients", detail: "Passwords and assignments", view: "clients", icon: UsersRound },
  { label: "Uploads", detail: "Photos and final ZIP", view: "uploads", icon: CloudUpload },
  { label: "Delivery", detail: "Gallery readiness overview", view: "delivery", icon: Mail },
  { label: "Shoot requests", detail: "Review bookings", view: "requests", icon: Aperture },
  { label: "Inquiries", detail: "Contact messages", view: "inquiries", icon: MessageSquareText },
  { label: "Monitoring", detail: "Uploads, emails, and storage", view: "monitoring", icon: Gauge },
  { label: "Downloads", detail: "Client download history", view: "downloads", icon: Download },
  { label: "About builder", detail: "Edit the public About page", view: "about", icon: BookOpenText },
  { label: "Contact settings", detail: "Email, phone, and socials", view: "contact", icon: ContactRound },
] as const;

export function AdminCommandMenu({
  albums,
  clients,
  selectedAlbumId,
  selectedAlbumSlug,
}: AdminCommandMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    if (!normalised) return destinations;
    return destinations.filter(({ label, detail }) =>
      `${label} ${detail}`.toLowerCase().includes(normalised),
    );
  }, [query]);
  const matchingAlbums = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    if (!normalised) return [];
    return albums
      .filter((album) => `${album.title} ${album.slug}`.toLowerCase().includes(normalised))
      .slice(0, 5);
  }, [albums, query]);
  const matchingClients = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    if (!normalised) return [];
    return clients
      .filter((client) => `${client.name} ${client.email ?? ""}`.toLowerCase().includes(normalised))
      .slice(0, 5);
  }, [clients, query]);

  function openMenu() {
    dialogRef.current?.showModal();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function closeMenu() {
    dialogRef.current?.close();
    setQuery("");
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialogRef.current?.open) closeMenu();
        else openMenu();
      }
      if (event.key === "Escape" && dialogRef.current?.open) closeMenu();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <button className="admin-command-trigger" onClick={openMenu} type="button">
        <Search size={17} />
        <span>Jump to…</span>
        <kbd>⌘ K</kbd>
      </button>
      <dialog
        aria-label="Admin command menu"
        className="admin-command-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
        ref={dialogRef}
      >
        <div className="admin-command-dialog-panel">
          <div className="admin-command-search">
            <Search size={19} aria-hidden="true" />
            <input
              aria-label="Search admin pages"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search admin pages and actions"
              ref={inputRef}
              type="search"
              value={query}
            />
            <button aria-label="Close command menu" onClick={closeMenu} type="button">
              <X size={18} />
            </button>
          </div>
          <div className="admin-command-results">
            <span className="admin-command-group-label">Navigate</span>
            {filtered.map(({ label, detail, view, icon: Icon }) => (
              <a
                href={`/admin?view=${view}${selectedAlbumId && ["albums", "uploads"].includes(view) ? `&album=${selectedAlbumId}` : ""}`}
                key={view}
              >
                <span className="admin-command-icon"><Icon size={18} /></span>
                <span><strong>{label}</strong><small>{detail}</small></span>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
            {!filtered.length ? (
              matchingAlbums.length || matchingClients.length ? null : (
                <div className="admin-command-empty">Nothing matches “{query}”.</div>
              )
            ) : null}
            {matchingAlbums.length ? (
              <>
                <span className="admin-command-group-label">Albums</span>
                {matchingAlbums.map((album) => (
                  <a href={`/admin?view=albums&album=${album.id}`} key={album.id}>
                    <span className="admin-command-icon"><FolderKanban size={18} /></span>
                    <span><strong>{album.title}</strong><small>/{album.slug}</small></span>
                    <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </>
            ) : null}
            {matchingClients.length ? (
              <>
                <span className="admin-command-group-label">Clients</span>
                {matchingClients.map((client) => (
                  <a href={`/admin?view=clients&clientQ=${encodeURIComponent(client.email || client.name)}`} key={client.id}>
                    <span className="admin-command-icon"><UsersRound size={18} /></span>
                    <span><strong>{client.name}</strong><small>{client.email ?? "No email saved"}</small></span>
                    <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </>
            ) : null}
            {selectedAlbumSlug && !query ? (
              <>
                <span className="admin-command-group-label">Current album</span>
                <a href={`/client/${selectedAlbumSlug}`} target="_blank" rel="noreferrer">
                  <span className="admin-command-icon"><ExternalLink size={18} /></span>
                  <span><strong>Open client gallery</strong><small>Preview the current delivery</small></span>
                  <span aria-hidden="true">↗</span>
                </a>
              </>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
