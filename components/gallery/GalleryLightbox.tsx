"use client";

import Image from "next/image";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Check, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { GalleryDownloads } from "./GalleryDownloads";
import styles from "./gallery-downloads.module.css";
import { Notice } from "@/components/Notice";
import type { NoticeTone } from "@/lib/notices";

export type GalleryDisplayPhoto = {
  id: string;
  filename: string;
  title: string;
  eyebrow: string;
  detail: string;
  thumbnailDisplayUrl: string;
};

type GalleryLightboxProps = {
  albumId: string;
  albumTitle: string;
  photos: GalleryDisplayPhoto[];
};

const INITIAL_VISIBLE_PHOTOS = 48;
const VISIBLE_PHOTO_INCREMENT = 48;
const MOBILE_GALLERY_QUERY = "(max-width: 760px)";
const VIRTUALIZE_AFTER_PHOTOS = 72;
const VIRTUAL_BUFFER_ROWS = 5;
const MOBILE_VIRTUAL_COLUMNS = 3;
const MOBILE_TILE_ASPECT_RATIO = 1.16;

type VirtualGalleryWindow = {
  startIndex: number;
  endIndex: number;
  columns: number;
  gap: number;
  itemWidth: number;
  itemHeight: number;
  rowStride: number;
  totalHeight: number;
};

const defaultVirtualWindow: VirtualGalleryWindow = {
  startIndex: 0,
  endIndex: 0,
  columns: MOBILE_VIRTUAL_COLUMNS,
  gap: 7,
  itemWidth: 120,
  itemHeight: 140,
  rowStride: 147,
  totalHeight: 0
};

async function requestDownload(
  albumId: string,
  photoId: string
) {
  const response = await fetch("/api/downloads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      album_id: albumId,
      photo_id: photoId
    })
  });

  if (!response.ok) {
    throw new Error("Download could not be prepared.");
  }

  const payload = (await response.json()) as { url: string };
  window.location.assign(payload.url);
}

async function requestPreview(albumId: string, photoId: string) {
  const response = await fetch("/api/gallery/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      album_id: albumId,
      photo_id: photoId
    })
  });

  if (!response.ok) {
    throw new Error("Preview could not be prepared.");
  }

  const payload = (await response.json()) as { url: string };
  return payload.url;
}

export function GalleryLightbox({
  albumId,
  albumTitle,
  photos
}: GalleryLightboxProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selecting, setSelecting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<NoticeTone>("info");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(INITIAL_VISIBLE_PHOTOS, photos.length)
  );
  const [isMobileGallery, setIsMobileGallery] = useState(false);
  const [virtualWindow, setVirtualWindow] =
    useState<VirtualGalleryWindow>(defaultVirtualWindow);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const selectedPhoto = selectedIndex === null ? null : photos[selectedIndex];
  const selectedPreviewUrl = selectedPhoto ? previewUrls[selectedPhoto.id] : null;
  const safeVisibleCount = Math.min(visibleCount, photos.length);
  const visiblePhotos = photos.slice(0, safeVisibleCount);
  const hasMorePhotos = safeVisibleCount < photos.length;
  const shouldVirtualizeGallery =
    isMobileGallery && photos.length > VIRTUALIZE_AFTER_PHOTOS;
  const virtualPhotos = useMemo(
    () =>
      photos
        .slice(virtualWindow.startIndex, virtualWindow.endIndex)
        .map((photo, offset) => ({
          index: virtualWindow.startIndex + offset,
          photo
        })),
    [photos, virtualWindow.endIndex, virtualWindow.startIndex]
  );
  const renderedPhotos = shouldVirtualizeGallery
    ? virtualPhotos
    : visiblePhotos.map((photo, index) => ({ index, photo }));

  const loadMorePhotos = useCallback(() => {
    setVisibleCount((current) =>
      Math.min(current + VISIBLE_PHOTO_INCREMENT, photos.length)
    );
  }, [photos.length]);

  const updateVirtualWindow = useCallback(() => {
    const node = gridRef.current;

    if (!node || !shouldVirtualizeGallery) {
      return;
    }

    const styles = window.getComputedStyle(node);
    const parsedGap = Number.parseFloat(styles.columnGap || styles.gap || "");
    const gap = Number.isFinite(parsedGap) ? parsedGap : 7;
    const columns = MOBILE_VIRTUAL_COLUMNS;
    const itemWidth = Math.max(
      1,
      (node.clientWidth - gap * (columns - 1)) / columns
    );
    const itemHeight = itemWidth * MOBILE_TILE_ASPECT_RATIO;
    const rowStride = itemHeight + gap;
    const totalRows = Math.ceil(photos.length / columns);
    const totalHeight = Math.max(0, totalRows * rowStride - gap);
    const gridTop = node.getBoundingClientRect().top + window.scrollY;
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;
    const startRow = Math.max(
      0,
      Math.floor((viewportTop - gridTop) / rowStride) - VIRTUAL_BUFFER_ROWS
    );
    const endRow = Math.min(
      totalRows,
      Math.ceil((viewportBottom - gridTop) / rowStride) + VIRTUAL_BUFFER_ROWS
    );

    const nextWindow = {
      startIndex: Math.min(photos.length, startRow * columns),
      endIndex: Math.min(photos.length, endRow * columns),
      columns,
      gap,
      itemWidth,
      itemHeight,
      rowStride,
      totalHeight
    };

    setVirtualWindow((current) => {
      const sameWindow =
        current.startIndex === nextWindow.startIndex &&
        current.endIndex === nextWindow.endIndex &&
        Math.abs(current.itemWidth - nextWindow.itemWidth) < 0.5 &&
        Math.abs(current.totalHeight - nextWindow.totalHeight) < 0.5;

      return sameWindow ? current : nextWindow;
    });
  }, [photos.length, shouldVirtualizeGallery]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_GALLERY_QUERY);
    const syncMedia = () => setIsMobileGallery(mediaQuery.matches);

    syncMedia();
    mediaQuery.addEventListener("change", syncMedia);

    return () => mediaQuery.removeEventListener("change", syncMedia);
  }, []);

  useEffect(() => {
    if (!shouldVirtualizeGallery) {
      return;
    }

    let frame = 0;
    const requestUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateVirtualWindow);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    const node = gridRef.current;
    const resizeObserver =
      node && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(requestUpdate)
        : null;

    if (node && resizeObserver) {
      resizeObserver.observe(node);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      resizeObserver?.disconnect();
    };
  }, [shouldVirtualizeGallery, updateVirtualWindow]);

  function directPhotoDownloadHref(photoId: string) {
    const params = new URLSearchParams({
      album_id: albumId,
      photo_id: photoId
    });

    return `/api/downloads?${params.toString()}`;
  }

  function virtualTileStyle(index: number): CSSProperties | undefined {
    if (!shouldVirtualizeGallery) {
      return undefined;
    }

    const row = Math.floor(index / virtualWindow.columns);
    const column = index % virtualWindow.columns;

    return {
      height: virtualWindow.itemHeight,
      left: column * (virtualWindow.itemWidth + virtualWindow.gap),
      top: row * virtualWindow.rowStride,
      width: virtualWindow.itemWidth
    };
  }

  useEffect(() => {
    const node = loadMoreRef.current;

    if (!node || !hasMorePhotos || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMorePhotos();
        }
      },
      { rootMargin: "700px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMorePhotos, loadMorePhotos]);

  useEffect(() => {
    document.body.classList.toggle("rx-lightbox-open", selectedIndex !== null);

    return () => document.body.classList.remove("rx-lightbox-open");
  }, [selectedIndex]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (selectedIndex === null) {
        return;
      }

      if (event.key === "Escape") {
        setSelectedIndex(null);
      }

      if (event.key === "ArrowRight") {
        setSelectedIndex((current) =>
          current === null ? current : Math.min(current + 1, photos.length - 1)
        );
      }

      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) =>
          current === null ? current : Math.max(current - 1, 0)
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photos.length, selectedIndex]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!selectedPhoto || previewUrls[selectedPhoto.id]) {
        return;
      }

      setStatusTone("info");
      setStatus("Loading preview...");

      try {
        const url = await requestPreview(albumId, selectedPhoto.id);

        if (!cancelled) {
          setPreviewUrls((current) => ({
            ...current,
            [selectedPhoto.id]: url
          }));
          setStatus("");
        }
      } catch (error) {
        if (!cancelled) {
          setStatusTone("error");
          setStatus(error instanceof Error ? error.message : "Preview failed.");
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [albumId, previewUrls, selectedPhoto]);

  async function downloadPhoto(photo: GalleryDisplayPhoto) {
    setStatusTone("info");
    setStatus("Preparing download...");
    try {
      await requestDownload(albumId, photo.id);
      setStatus("");
    } catch (error) {
      setStatusTone("error");
      setStatus(error instanceof Error ? error.message : "Download failed.");
    }
  }

  function togglePhoto(id: string) {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function previousPhoto() {
    setSelectedIndex((current) => (current === null ? current : Math.max(current - 1, 0)));
  }

  function nextPhoto() {
    setSelectedIndex((current) =>
      current === null ? current : Math.min(current + 1, photos.length - 1)
    );
  }

  return (
    <>
      <section className="gallery-delivery" aria-label="Delivered album images">
        <GalleryDownloads
          albumId={albumId} photos={photos} selectedIds={selectedIds} selecting={selecting}
          onSelectMode={() => setSelecting(true)}
          onSelectAll={() => setSelectedIds(new Set(photos.map(photo => photo.id)))}
          onClear={() => setSelectedIds(new Set())} onDone={() => setSelecting(false)}
        />
        <Notice
          notice={
            status
              ? {
                  tone: statusTone,
                  title: statusTone === "error" ? "Gallery action failed" : "Gallery status",
                  message: status
                }
              : undefined
          }
        />
        <div
          className={
            shouldVirtualizeGallery
              ? "lightbox-grid lightbox-virtual-grid"
              : "lightbox-grid"
          }
          data-virtualized={shouldVirtualizeGallery ? "true" : "false"}
          ref={gridRef}
          style={
            shouldVirtualizeGallery
              ? ({
                  "--virtual-gallery-height": `${virtualWindow.totalHeight}px`
                } as CSSProperties)
              : undefined
          }
        >
          {renderedPhotos.map(({ photo, index }) => (
            <article className={`photo-tile ${selectedIds.has(photo.id) ? styles.selectedTile : ""}`} data-photo-id={photo.id} key={photo.id} style={virtualTileStyle(index)}>
              <button
                className="photo-open-button"
                aria-label={selecting ? `${selectedIds.has(photo.id) ? "Deselect" : "Select"} ${photo.filename}` : `Preview ${photo.filename}`}
                onClick={() => selecting ? togglePhoto(photo.id) : setSelectedIndex(index)}
                type="button"
              >
                <Image
                  alt={photo.filename}
                  className="photo-img"
                  fill
                  loading={shouldVirtualizeGallery ? "lazy" : index < 8 ? "eager" : "lazy"}
                  sizes="(max-width: 760px) 33vw, (max-width: 1100px) 25vw, 20vw"
                  src={photo.thumbnailDisplayUrl}
                  unoptimized
                />
                <Image
                  alt=""
                  aria-hidden="true"
                  className="watermark watermark-logo"
                  height={66}
                  loading="lazy"
                  src="/sig.png"
                  width={220}
                />
                <div className="tile-caption">
                  <span className="tile-info">
                    <strong className="tile-album">{albumTitle}</strong>
                    <small>{photo.eyebrow}</small>
                    <em className="tile-frame">{photo.title}</em>
                  </span>
                  <span className="tile-action">{selecting ? selectedIds.has(photo.id) ? "Selected" : "Select" : "Open"}</span>
                </div>
              </button>
              <button type="button" className={styles.selectToggle}
                aria-label={`${selectedIds.has(photo.id) ? "Deselect" : "Select"} photo ${photo.filename}`}
                aria-pressed={selectedIds.has(photo.id)}
                onClick={() => { setSelecting(true); togglePhoto(photo.id); }}>
                <span>{selectedIds.has(photo.id) ? <Check size={17} aria-hidden="true" /> : null}</span>
              </button>
              <a
                aria-label={`Download ${photo.filename}`}
                className="tile-download-button"
                download={photo.filename}
                href={directPhotoDownloadHref(photo.id)}
              >
                <Download size={15} aria-hidden="true" />
                <span className="sr-only">Download {photo.filename}</span>
              </a>
            </article>
          ))}
          {!shouldVirtualizeGallery && hasMorePhotos ? (
            <div className="gallery-load-sentinel" ref={loadMoreRef}>
              <button className="button secondary" onClick={loadMorePhotos} type="button">
                Load more photos
              </button>
              <span>
                {safeVisibleCount}/{photos.length} shown
              </span>
            </div>
          ) : !shouldVirtualizeGallery && photos.length > INITIAL_VISIBLE_PHOTOS ? (
            <p className="gallery-load-summary">{photos.length} photos loaded</p>
          ) : null}
        </div>
      </section>
      {selectedPhoto ? (
        <div
          aria-label={`${selectedPhoto.title} preview`}
          aria-modal="true"
          className="lightbox-modal"
          role="dialog"
        >
          <div className="lightbox-toolbar">
            <div>
              <span className="label">Preview</span>
              <strong>{selectedPhoto.title}</strong>
              <small className="lightbox-meta-line">{selectedPhoto.eyebrow}</small>
              <small className="lightbox-meta-line">{selectedPhoto.detail}</small>
              <code>{selectedPhoto.filename}</code>
            </div>
            <div className="lightbox-toolbar-actions">
              <button className="icon-button" type="button" aria-pressed={selectedIds.has(selectedPhoto.id)}
                aria-label={selectedIds.has(selectedPhoto.id) ? "Deselect current photo" : "Select current photo"}
                onClick={() => { setSelecting(true); togglePhoto(selectedPhoto.id); }}>
                <Check size={22} />
              </button>
              <button
                className="icon-button"
                onClick={previousPhoto}
                type="button"
                aria-label="Previous image"
                disabled={selectedIndex === 0}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                className="icon-button"
                onClick={nextPhoto}
                type="button"
                aria-label="Next image"
                disabled={selectedIndex === photos.length - 1}
              >
                <ChevronRight size={22} />
              </button>
              <button
                className="button secondary"
                onClick={() => downloadPhoto(selectedPhoto)}
                type="button"
              >
                <Download size={18} />
                Download
              </button>
              <button
                className="icon-button"
                onClick={() => setSelectedIndex(null)}
                type="button"
                aria-label="Close preview"
              >
                <X size={22} />
              </button>
            </div>
          </div>
          <Image
            alt={selectedPhoto.filename}
            className="lightbox-image"
            fill
            sizes="100vw"
            src={selectedPreviewUrl ?? selectedPhoto.thumbnailDisplayUrl}
            unoptimized
          />
          <Image
            alt=""
            aria-hidden="true"
            className="lightbox-watermark watermark-logo"
            height={66}
            src="/sig.png"
            width={220}
          />
        </div>
      ) : null}
    </>
  );
}
