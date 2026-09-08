"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Download, LoaderCircle, Share2 } from "lucide-react";
import styles from "./gallery-downloads.module.css";

type Photo = { id: string; filename: string };
type ArchiveStatus = {
  job_token: string; phase: "checking" | "building" | "ready" | "failed";
  percent: number; photo_count: number; filename: string; download_url?: string; error?: string;
};
type Props = {
  albumId: string; photos: Photo[]; selectedIds: Set<string>; selecting: boolean;
  onSelectMode: () => void; onSelectAll: () => void; onClear: () => void; onDone: () => void;
};
const SHARE_BYTES = 48 * 1024 * 1024;
const SHARE_FILES = 24;
const subscribeToCapabilities = () => () => {};
let shareSupport: boolean | undefined;
function fileSharingAvailable() {
  if (shareSupport === undefined) {
    try { shareSupport = typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([new Uint8Array([0])], "photo.jpg", { type: "image/jpeg" })] }); }
    catch { shareSupport = false; }
  }
  return shareSupport;
}

async function jsonRequest<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: body ? "POST" : "GET", signal, cache: "no-store",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Please try again. Your download could not be prepared.");
  return data as T;
}

function photoMime(filename: string, contentType?: string) {
  if (contentType?.startsWith("image/")) return contentType.split(";")[0];
  const types: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp", gif: "image/gif", tif: "image/tiff", tiff: "image/tiff" };
  return types[filename.split(".").pop()?.toLowerCase() || ""] || "application/octet-stream";
}

export function GalleryDownloads({ albumId, photos, selectedIds, selecting, onSelectMode, onSelectAll, onClear, onDone }: Props) {
  const [job, setJob] = useState<ArchiveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canShare = useSyncExternalStore(subscribeToCapabilities, fileSharingAvailable, () => false);
  const [busyKind, setBusyKind] = useState<"zip" | "photos" | null>(null);
  const [shareFiles, setShareFiles] = useState<File[]>([]);
  const [sharedCount, setSharedCount] = useState(0);
  const [shareStatus, setShareStatus] = useState("");
  const [sharing, setSharing] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const signature = [...selectedIds].sort().join(",");
  const previousSignature = useRef(signature);
  const storageKey = `rxncor:archive:${albumId}`;
  const targets = selectedIds.size ? photos.filter(photo => selectedIds.has(photo.id)) : photos;

  function remember(token?: string) {
    try { if (token) sessionStorage.setItem(storageKey, token); else sessionStorage.removeItem(storageKey); } catch { /* Downloads also work with storage disabled. */ }
  }

  useEffect(() => {
    let token: string | null = null;
    try { token = sessionStorage.getItem(storageKey); } catch { /* Storage is optional. */ }
    const abort = new AbortController();
    const run = generation.current;
    if (token) {
      jsonRequest<ArchiveStatus>(`/api/downloads/archive?token=${encodeURIComponent(token)}`, undefined, abort.signal)
        .then(saved => { if (run === generation.current) setJob(saved); })
        .catch(() => { /* An expired saved job does not prevent a fresh download. */ });
    }
    const lifecycle = generation;
    return () => { abort.abort(); controller.current?.abort(); lifecycle.current++; };
  }, [storageKey]);

  useEffect(() => {
    if (previousSignature.current === signature) return;
    previousSignature.current = signature;
    generation.current++;
    controller.current?.abort();
    setJob(null); setBusy(false); setError(""); setShareFiles([]); setSharedCount(0); setShareStatus(""); setSharing(false);
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
  }, [signature, storageKey]);

  function begin(kind: "zip" | "photos") {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const run = ++generation.current;
    setBusy(true); setBusyKind(kind); setError("");
    return { abort, run };
  }

  async function prepareZip() {
    const { abort, run } = begin("zip");
    setShareFiles([]); setShareStatus("");
    try {
      let current = job && job.phase !== "failed" ? job : await jsonRequest<ArchiveStatus>("/api/downloads/archive",
        { album_id: albumId, ...(selectedIds.size ? { photo_ids: [...selectedIds] } : {}) }, abort.signal);
      if (run !== generation.current) return;
      setJob(current); remember(current.job_token);
      while (current.phase !== "ready" && current.phase !== "failed" && !abort.signal.aborted) {
        const started = Date.now();
        current = await jsonRequest<ArchiveStatus>("/api/downloads/archive", { job_token: current.job_token }, abort.signal);
        if (run !== generation.current) return;
        setJob(current);
        // A second tab may own the active step. Avoid polling its lease rapidly.
        if (current.phase !== "ready" && Date.now() - started < 1500) {
          await new Promise<void>(resolve => {
            const stop = () => { clearTimeout(timer); resolve(); };
            const timer = setTimeout(() => { abort.signal.removeEventListener("abort", stop); resolve(); }, 1800);
            abort.signal.addEventListener("abort", stop, { once: true });
          });
        }
      }
      if (current.phase === "failed") setError(current.error || "Please prepare a new ZIP.");
    } catch (failure) {
      if (!abort.signal.aborted && run === generation.current) setError(failure instanceof Error ? failure.message : "Download preparation paused. Please resume.");
    } finally { if (run === generation.current) setBusy(false); }
  }

  function pause() {
    generation.current++; controller.current?.abort(); setBusy(false);
  }

  function resetZip() {
    pause(); setJob(null); setError(""); remember();
  }

  async function preparePhotos() {
    const { abort, run } = begin("photos");
    setShareStatus("Preparing photos for your phone…");
    const files: File[] = [];
    let totalBytes = 0;
    try {
      for (const photo of targets.slice(sharedCount)) {
        if (files.length >= SHARE_FILES) break;
        const meta = await jsonRequest<{ url: string; filename: string; size: number; content_type?: string }>("/api/downloads",
          { album_id: albumId, photo_id: photo.id, mode: "share" }, abort.signal);
        if (!Number.isSafeInteger(meta.size) || meta.size < 0) throw new Error("The photo size could not be checked. Use ZIP download instead.");
        if (totalBytes + meta.size > SHARE_BYTES) {
          if (files.length) break;
          throw new Error("This original is too large for the phone share sheet. Use ZIP download or the photo’s download button.");
        }
        const response = await fetch(meta.url, { signal: abort.signal, cache: "no-store" });
        if (!response.ok) throw new Error("A photo could not be loaded. Please retry or use ZIP download.");
        const blob = await response.blob();
        if (blob.size !== meta.size) throw new Error("A photo changed during preparation. Please retry.");
        files.push(new File([blob], meta.filename, { type: photoMime(meta.filename, meta.content_type) }));
        totalBytes += blob.size;
        if (run !== generation.current) return;
        setShareStatus(`Preparing photo ${sharedCount + files.length} of ${targets.length}…`);
      }
      if (!files.length || !navigator.canShare?.({ files })) throw new Error("Your phone cannot share these originals together. Use ZIP download or download individual photos.");
      if (run !== generation.current) return;
      setShareFiles(files);
      setShareStatus(`${files.length} photos ready. Tap Share photos to open your phone’s options.`);
    } catch (failure) {
      if (!abort.signal.aborted && run === generation.current) { setShareStatus(""); setError(failure instanceof Error ? failure.message : "Use ZIP download if photo sharing is unavailable."); }
    } finally { if (run === generation.current) setBusy(false); }
  }

  async function sharePhotos() {
    // This must run directly from a fresh tap, after the file preparation step.
    const run = generation.current;
    setSharing(true); setError("");
    try {
      await navigator.share({ files: shareFiles });
      if (run !== generation.current) return;
      const count = sharedCount + shareFiles.length;
      setSharedCount(count); setShareFiles([]);
      setShareStatus(count < targets.length ? `${count} of ${targets.length} photos shared. Prepare the next group when you’re ready.` : "All selected photos have been shared.");
    } catch (failure) {
      if (run === generation.current && !(failure instanceof Error && failure.name === "AbortError")) setError("The share sheet could not open. Try again, or use ZIP download.");
    } finally { if (run === generation.current) setSharing(false); }
  }

  return (
    <div className={styles.panel} aria-label="Photo selection and downloads">
      <div className={styles.heading}>
        <div><span className="label">Your photos</span><strong aria-live="polite">{selectedIds.size ? `${selectedIds.size} of ${photos.length} selected` : `${photos.length} photos · Original quality`}</strong></div>
        <div className={styles.selectionActions}>
          {!selecting ? <button type="button" onClick={onSelectMode}>Select photos</button> : <>
            <button type="button" onClick={onSelectAll} disabled={selectedIds.size === photos.length}>Select all {photos.length}</button>
            <button type="button" onClick={onClear} disabled={!selectedIds.size}>Clear</button>
            <button type="button" onClick={onDone}>Done</button>
          </>}
        </div>
      </div>
      <div className={styles.actions}>
        {job?.phase === "ready" && job.download_url ? <>
          <a className={styles.primary} download={job.filename} href={job.download_url}><Download size={18} /> Download ZIP · {job.photo_count} photos</a>
          <button type="button" onClick={resetZip}>New ZIP</button>
        </> : <>
          <button className={styles.primary} disabled={busy || sharing || !photos.length} onClick={prepareZip} type="button">
            {busy && busyKind === "zip" ? <LoaderCircle className={styles.spinner} size={18} /> : <Download size={18} />}
            {busy && busyKind === "zip" ? "Preparing ZIP…" : job && job.phase !== "failed" ? `Resume ZIP · ${job.photo_count} photos` : selectedIds.size ? `Prepare ZIP · ${selectedIds.size} selected` : "Download all as ZIP"}
          </button>
          {busy ? <button type="button" onClick={pause}>Pause</button> : null}
          {job && !busy ? <button type="button" onClick={resetZip}>Start again</button> : null}
        </>}
        {canShare && photos.length ? shareFiles.length ? <button className={styles.share} disabled={busy || sharing} onClick={sharePhotos} type="button"><Share2 size={18} /> Share photos · {shareFiles.length}</button>
          : <button className={styles.share} disabled={busy || sharing || sharedCount >= targets.length} onClick={preparePhotos} type="button"><Share2 size={18} /> {sharedCount ? "Prepare next photos" : "Save / share photos"}</button> : null}
      </div>
      {job && job.phase !== "failed" ? <div className={styles.progress} role="status">
        {job.phase === "ready" ? <span><Check size={16} /> Your ZIP is ready · {job.photo_count} photos</span> : <>
          <span>{busy && busyKind === "zip" ? job.phase === "checking" ? "Checking originals" : "Preparing your ZIP" : "ZIP preparation paused"} · {job.photo_count} photos · {job.percent}%</span>
          <progress value={job.percent} max={100} aria-label="ZIP preparation" />
          <small>Keep this gallery open while preparing. You can pause and resume here for up to 48 hours.</small>
        </>}
      </div> : null}
      {shareStatus ? <p className={styles.message} role="status">{shareStatus}</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <details className={styles.help}>
        <summary>Saving photos on iPhone</summary>
        <p>Download the ZIP, then open it in the Files app and tap it to extract your photos. Select the extracted images, tap Share, then choose Save Images when available.</p>
        <p>On phones with photo sharing, “Save / share photos” prepares a small group at a time. Tap “Share photos” and choose your preferred app or Save Images. ZIP downloads include every photo you selected.</p>
      </details>
    </div>
  );
}
