"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export type GalleryDisplayPhoto = {
  id: string;
  filename: string;
  thumbnailDisplayUrl: string;
  previewDisplayUrl: string;
  r2ObjectKey: string;
};

type GalleryLightboxProps = {
  albumId: string;
  photos: GalleryDisplayPhoto[];
  zipObjectKey?: string | null;
  clientEmail?: string | null;
};

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

export function GalleryLightbox({
  albumId,
  photos,
  zipObjectKey,
  clientEmail
}: GalleryLightboxProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const selectedPhoto = selectedIndex === null ? null : photos[selectedIndex];

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

  async function downloadPhoto(photo: GalleryDisplayPhoto) {
    setStatus("Preparing download...");
    try {
      await requestDownload(albumId, photo.r2ObjectKey, photo.id, clientEmail);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Download failed.");
    }
  }

  async function downloadZip() {
    if (!zipObjectKey) {
      return;
    }

    setStatus("Preparing album ZIP...");
    try {
      await requestDownload(albumId, zipObjectKey, undefined, clientEmail);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "ZIP download failed.");
    }
  }

  return (
    <>
      <div className="gallery-actions">
        <button className="button" disabled={!zipObjectKey} onClick={downloadZip} type="button">
          <Download size={18} />
          Download ZIP
        </button>
      </div>
      {status ? <p className="muted">{status}</p> : null}
      <div className="lightbox-grid">
        {photos.map((photo, index) => (
          <button
            className="photo-tile photo-button"
            key={photo.id}
            onClick={() => setSelectedIndex(index)}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="photo-img" src={photo.thumbnailDisplayUrl} alt={photo.filename} />
            <span className="watermark">rxncor.studio</span>
            <div className="tile-caption">
              <strong>{photo.filename}</strong>
              <span>Open</span>
            </div>
          </button>
        ))}
      </div>
      {selectedPhoto ? (
        <div className="lightbox-modal" role="dialog" aria-modal="true">
          <div className="lightbox-toolbar">
            <strong>{selectedPhoto.filename}</strong>
            <div className="lightbox-toolbar-actions">
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
            src={selectedPhoto.previewDisplayUrl}
            alt={selectedPhoto.filename}
          />
          <span className="lightbox-watermark">rxncor.studio</span>
        </div>
      ) : null}
    </>
  );
}
