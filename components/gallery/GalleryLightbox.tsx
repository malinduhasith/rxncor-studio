"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Notice } from "@/components/Notice";
import type { NoticeTone } from "@/lib/notices";

export type GalleryDisplayPhoto = {
  id: string;
  filename: string;
  title: string;
  eyebrow: string;
  detail: string;
  thumbnailDisplayUrl: string;
  r2ObjectKey: string;
};

type GalleryLightboxProps = {
  albumId: string;
  albumTitle: string;
  photos: GalleryDisplayPhoto[];
  zipObjectKey?: string | null;
  clientEmail?: string | null;
};

const INITIAL_VISIBLE_PHOTOS = 48;
const VISIBLE_PHOTO_INCREMENT = 48;

async function requestDownload(
  albumId: string,
  r2ObjectKey: string,
  photoId?: string,
  clientEmail?: string | null
) {
  const response = await fetch("/api/downloads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      album_id: albumId,
      photo_id: photoId,
      r2_object_key: r2ObjectKey,
      client_email: clientEmail || undefined
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
  photos,
  zipObjectKey,
  clientEmail
}: GalleryLightboxProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<NoticeTone>("info");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(INITIAL_VISIBLE_PHOTOS, photos.length)
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const selectedPhoto = selectedIndex === null ? null : photos[selectedIndex];
  const selectedPreviewUrl = selectedPhoto ? previewUrls[selectedPhoto.id] : null;
  const safeVisibleCount = Math.min(visibleCount, photos.length);
  const visiblePhotos = photos.slice(0, safeVisibleCount);
  const hasMorePhotos = safeVisibleCount < photos.length;

  const loadMorePhotos = useCallback(() => {
    setVisibleCount((current) =>
      Math.min(current + VISIBLE_PHOTO_INCREMENT, photos.length)
    );
  }, [photos.length]);

  function directPhotoDownloadHref(photoId: string) {
    const params = new URLSearchParams({
      album_id: albumId,
      photo_id: photoId
    });

    return `/api/downloads?${params.toString()}`;
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
      await requestDownload(albumId, photo.r2ObjectKey, photo.id, clientEmail);
    } catch (error) {
      setStatusTone("error");
      setStatus(error instanceof Error ? error.message : "Download failed.");
    }
  }

  async function downloadZip() {
    if (!zipObjectKey) {
      return;
    }

    setStatusTone("info");
    setStatus("Preparing album ZIP...");
    try {
      await requestDownload(albumId, zipObjectKey, undefined, clientEmail);
    } catch (error) {
      setStatusTone("error");
      setStatus(error instanceof Error ? error.message : "ZIP download failed.");
    }
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
        <div className="gallery-actions">
          <div>
            <span className="label">Delivered set</span>
            <p className="muted">Open previews or download the final delivery files.</p>
          </div>
          <button className="button" disabled={!zipObjectKey} onClick={downloadZip} type="button">
            <Download size={18} />
            Download ZIP
          </button>
        </div>
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
        <div className="lightbox-grid">
          {visiblePhotos.map((photo, index) => (
            <article className="photo-tile" key={photo.id}>
              <button
                className="photo-open-button"
                onClick={() => setSelectedIndex(index)}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="photo-img"
                  src={photo.thumbnailDisplayUrl}
                  alt={photo.filename}
                  loading={index < 8 ? "eager" : "lazy"}
                  decoding="async"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="watermark watermark-logo"
                  src="/sig.png"
                  alt=""
                  aria-hidden="true"
                />
                <div className="tile-caption">
                  <span className="tile-info">
                    <strong className="tile-album">{albumTitle}</strong>
                    <small>{photo.eyebrow}</small>
                    <em className="tile-frame">{photo.title}</em>
                  </span>
                  <span className="tile-action">Open</span>
                </div>
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
          {hasMorePhotos ? (
            <div className="gallery-load-sentinel" ref={loadMoreRef}>
              <button className="button secondary" onClick={loadMorePhotos} type="button">
                Load more photos
              </button>
              <span>
                {safeVisibleCount}/{photos.length} shown
              </span>
            </div>
          ) : photos.length > INITIAL_VISIBLE_PHOTOS ? (
            <p className="gallery-load-summary">{photos.length} photos loaded</p>
          ) : null}
        </div>
      </section>
      {selectedPhoto ? (
        <div className="lightbox-modal" role="dialog" aria-modal="true">
          <div className="lightbox-toolbar">
            <div>
              <span className="label">Preview</span>
              <strong>{selectedPhoto.title}</strong>
              <small className="lightbox-meta-line">{selectedPhoto.eyebrow}</small>
              <small className="lightbox-meta-line">{selectedPhoto.detail}</small>
              <code>{selectedPhoto.filename}</code>
            </div>
            <div className="lightbox-toolbar-actions">
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="lightbox-image"
            src={selectedPreviewUrl ?? selectedPhoto.thumbnailDisplayUrl}
            alt={selectedPhoto.filename}
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="lightbox-watermark watermark-logo"
            src="/sig.png"
            alt=""
            aria-hidden="true"
          />
        </div>
      ) : null}
    </>
  );
}
