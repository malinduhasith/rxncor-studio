"use client";

import { useMemo, useState } from "react";
import { FileArchive } from "lucide-react";
import { Notice } from "@/components/Notice";
import type { NoticeTone } from "@/lib/notices";

type UploadAlbum = {
  id: string;
  title: string;
  slug: string;
};

type SignedUpload = {
  key: string;
  uploadUrl: string;
  publicUrl: string;
};

type AdminZipUploadProps = {
  albums: UploadAlbum[];
  defaultAlbumId?: string;
};

function fileSizeLabel(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function signZipUpload(albumId: string, file: File) {
  const response = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      albumId,
      kind: "zip",
      filename: file.name,
      contentType: file.type || "application/zip"
    })
  });

  if (!response.ok) {
    throw new Error("Could not create ZIP upload URL.");
  }

  return (await response.json()) as SignedUpload;
}

async function cleanupUploadedKeys(keys: string[]) {
  if (!keys.length) {
    return;
  }

  await fetch("/api/uploads/cleanup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ keys })
  }).catch(() => null);
}

async function logZipFailure(albumId: string, zipFile: File, message: string, durationMs: number) {
  await fetch("/api/uploads/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      album_id: albumId,
      filename: zipFile.name,
      event_type: "zip",
      status: "failed",
      message,
      size_bytes: zipFile.size,
      duration_ms: durationMs
    })
  }).catch(() => null);
}

export function AdminZipUpload({
  albums,
  defaultAlbumId: preferredAlbumId
}: AdminZipUploadProps) {
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<NoticeTone>("info");
  const [isUploading, setIsUploading] = useState(false);
  const [zipSummary, setZipSummary] = useState("");
  const hasAlbums = albums.length > 0;
  const defaultAlbumId =
    albums.find((album) => album.id === preferredAlbumId)?.id ?? albums[0]?.id ?? "";
  const albumOptions = useMemo(
    () =>
      albums.map((album) => (
        <option key={album.id} value={album.id}>
          {album.title} ({album.slug})
        </option>
      )),
    [albums]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isUploading) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const albumId = String(formData.get("album_id") ?? "");
    const zipFile = formData.get("zip") as File | null;

    if (!albumId || !zipFile?.size) {
      setStatusTone("warning");
      setStatus("Choose an album and a ZIP file.");
      return;
    }

    setIsUploading(true);
    setStatusTone("info");
    setStatus("Creating ZIP upload link...");
    const startedAt = performance.now();

    try {
      const signedUpload = await signZipUpload(albumId, zipFile);
      setStatus("Uploading ZIP to R2...");

      try {
        const uploadResponse = await fetch(signedUpload.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": zipFile.type || "application/zip"
          },
          body: zipFile
        });

        if (!uploadResponse.ok) {
          throw new Error("ZIP upload failed.");
        }

        setStatus("Saving ZIP link...");
        const saveResponse = await fetch("/api/albums/zip", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            album_id: albumId,
            download_zip_url: signedUpload.publicUrl,
            filename: zipFile.name,
            zip_size_bytes: zipFile.size,
            upload_duration_ms: Math.round(performance.now() - startedAt)
          })
        });

        if (!saveResponse.ok) {
          await cleanupUploadedKeys([signedUpload.key]);
          throw new Error("ZIP link could not be saved. R2 file was cleaned up.");
        }
      } catch (error) {
        await cleanupUploadedKeys([signedUpload.key]);
        throw error;
      }

      window.location.assign("/admin?view=uploads&notice=zip-uploaded#uploads");
    } catch (error) {
      await logZipFailure(
        albumId,
        zipFile,
        error instanceof Error ? error.message : "ZIP upload failed.",
        Math.round(performance.now() - startedAt)
      );
      setStatusTone("error");
      setStatus(error instanceof Error ? error.message : "ZIP upload failed.");
      setIsUploading(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label className="field">
        Album
        <select name="album_id" defaultValue={defaultAlbumId} disabled={!hasAlbums}>
          {hasAlbums ? albumOptions : <option value="">Create an album first</option>}
        </select>
      </label>
      <div className="upload-guidance">
        <strong>Use one final delivery ZIP</strong>
        <span>The ZIP should contain the full-resolution files you want the client to keep.</span>
      </div>
      <label className="field">
        Full album ZIP
        <input
          name="zip"
          type="file"
          accept=".zip,application/zip"
          required
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            setZipSummary(file ? `${file.name} · ${fileSizeLabel(file.size)}` : "");
          }}
        />
      </label>
      <button className="button secondary" type="submit" disabled={!hasAlbums || isUploading}>
        <FileArchive size={18} />
        {isUploading ? "Uploading ZIP" : "Upload ZIP"}
      </button>
      {zipSummary ? <p className="muted">{zipSummary}</p> : null}
      {isUploading ? <progress className="upload-progress" /> : null}
      <Notice
        notice={
          status
            ? {
                tone: statusTone,
                title: statusTone === "error" ? "ZIP upload issue" : "ZIP upload status",
                message: status
              }
            : undefined
        }
      />
    </form>
  );
}
