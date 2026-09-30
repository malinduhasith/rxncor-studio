"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ImageUp, LoaderCircle } from "lucide-react";
import styles from "@/app/admin/albums.module.css";

type AlbumCard = {
  id: string;
  title: string;
  clientLabel: string;
  date: string;
  count: number;
  cover?: string;
  status: string;
  isPublic: boolean;
  href: string;
};

export function AlbumAccordion({ albums, selectedId, children }: {
  albums: AlbumCard[];
  selectedId: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selection, setSelection] = useState({ loaded: selectedId, expanded: selectedId });
  const [discardTarget, setDiscardTarget] = useState<AlbumCard | null>(null);
  const [uploadWarning, setUploadWarning] = useState(false);
  const dirty = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Server actions and browser history can select a different album too.
  if (selection.loaded !== selectedId) {
    setSelection({ loaded: selectedId, expanded: selectedId });
  }

  function open(album: AlbumCard) {
    setDiscardTarget(null);
    setUploadWarning(false);
    setSelection(current => ({ ...current, expanded: album.id }));
    if (album.id !== selectedId) {
      dirty.current = null;
      startTransition(() => router.replace(album.href, { scroll: false }));
    }
  }

  function toggle(album: AlbumCard) {
    if (selection.expanded === album.id) {
      // Keep the form and any upload mounted when the card is folded away.
      setSelection(current => ({ ...current, expanded: null }));
      return;
    }
    if (album.id !== selectedId && root.current?.querySelector('[data-upload-busy="true"]')) {
      setSelection(current => ({ ...current, expanded: selectedId }));
      setUploadWarning(true);
      return;
    }
    if (selectedId !== null && album.id !== selectedId && dirty.current === selectedId) {
      setSelection(current => ({ ...current, expanded: selectedId }));
      setDiscardTarget(album);
      return;
    }
    open(album);
  }

  return <div className={styles.albumList} aria-label="Albums" ref={root}>
    {albums.map(album => {
      const expanded = selection.expanded === album.id;
      const loaded = selectedId === album.id;
      return <article className={styles.albumCard} data-expanded={expanded} key={album.id}>
        <h2 className={styles.cardHeading}>
          <button className={styles.albumRow} type="button" id={`album-heading-${album.id}`}
            aria-expanded={expanded} aria-controls={`album-options-${album.id}`}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${album.title}`}
            disabled={pending} onClick={() => toggle(album)}>
            <span className={styles.cover}>{album.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={album.cover} alt="" loading="lazy" />
            ) : <ImageUp size={24} aria-hidden="true" />}</span>
            <span className={styles.albumIdentity}><strong>{album.title}</strong><small>{album.clientLabel}{album.date ? ` · ${album.date}` : ""}</small></span>
            <span className={styles.albumCount}>{album.count} <small>photos</small></span>
            <span className={styles.albumState}><span data-status={album.status}>{album.status}</span><small>{album.isPublic ? "Public" : "Private"}</small></span>
            <ChevronDown size={20} className={styles.cardChevron} aria-hidden="true" />
          </button>
        </h2>
        <div id={`album-options-${album.id}`} className={styles.cardContent} role="region"
          aria-labelledby={`album-heading-${album.id}`} hidden={!expanded}
          onChangeCapture={event => {
            if ((event.target as HTMLElement).closest("[data-album-settings]")) dirty.current = selectedId;
          }}>
          {loaded ? <>
            {uploadWarning ? <p className={styles.cardNotice} role="alert">An upload is still running. You can use the tabs here; wait for it to finish before opening another album.</p> : null}
            {discardTarget ? <div className={styles.cardNotice} role="alert">
              <p>You have unsaved access settings. Keep editing or discard them to open {discardTarget.title}.</p>
              <button className="button secondary" type="button" onClick={() => setDiscardTarget(null)}>Keep editing</button>{" "}
              <button className="button" type="button" onClick={() => open(discardTarget)}>Discard changes</button>
            </div> : null}
            {children}
          </> : <div className={styles.cardLoading} role="status" aria-live="polite">
            {pending ? <><LoaderCircle size={20} aria-hidden="true" /> Loading album options…</> : <><span>Album options could not be loaded.</span><button className="button secondary" type="button" onClick={() => open(album)}>Try again</button></>}
          </div>}
        </div>
      </article>;
    })}
  </div>;
}
