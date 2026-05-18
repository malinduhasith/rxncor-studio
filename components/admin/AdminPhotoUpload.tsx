"use client";

import { useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";

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

type AdminPhotoUploadProps = {
  albums: UploadAlbum[];
};

async function signUpload(albumId: string, kind: string, file: File) {
  const response = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      albumId,
      kind,
      filename: file.name,
      contentType: file.type || "application/octet-stream"
    })
  });

  if (!response.ok) {
    throw new Error("Could not create upload URL.");
  }

  return (await response.json()) as SignedUpload;
}

async function uploadToR2(signedUpload: SignedUpload, file: File) {
  const response = await fetch(signedUpload.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });

  if (!response.ok) {
    throw new Error("R2 upload failed.");
  }
}

export function AdminPhotoUpload({ albums }: AdminPhotoUploadProps) {
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const defaultAlbumId = albums[0]?.id ?? "";
  const hasAlbums = albums.length > 0;

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

    const form = event.currentTarget;
    const formData = new FormData(form);
    const albumId = String(formData.get("album_id") ?? "");
    const filename = String(formData.get("filename") ?? "").trim();
    const thumbnail = formData.get("thumbnail") as File | null;
    const preview = formData.get("preview") as File | null;
    const full = formData.get("full") as File | null;

    if (!albumId || !thumbnail?.size || !preview?.size || !full?.size) {
      setStatus("Choose an album and all three photo files.");
      return;
    }

    setIsUploading(true);
    setStatus("Creating upload links...");

    try {
      const [thumbnailUpload, previewUpload, fullUpload] = await Promise.all([
        signUpload(albumId, "thumbnails", thumbnail),
        signUpload(albumId, "previews", preview),
        signUpload(albumId, "full", full)
      ]);

      setStatus("Uploading to R2...");
      await Promise.all([
        uploadToR2(thumbnailUpload, thumbnail),
        uploadToR2(previewUpload, preview),
        uploadToR2(fullUpload, full)
      ]);

      setStatus("Saving photo...");
      const photoResponse = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          album_id: albumId,
          filename: filename || full.name,
          thumbnail_url: thumbnailUpload.publicUrl,
          preview_url: previewUpload.publicUrl,
          full_res_url: fullUpload.publicUrl,
          r2_object_key: fullUpload.key
        })
      });

      if (!photoResponse.ok) {
        throw new Error("Photo metadata could not be saved.");
      }

      window.location.assign("/admin?notice=photo-uploaded#uploads");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
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
      <label className="field">
        Display filename
        <input name="filename" placeholder="img_001.jpg" />
      </label>
      <label className="field">
        Thumbnail WebP
        <input name="thumbnail" type="file" accept="image/webp,image/*" required />
      </label>
      <label className="field">
        Preview WebP
        <input name="preview" type="file" accept="image/webp,image/*" required />
      </label>
      <label className="field">
        Full-res JPEG
        <input name="full" type="file" accept="image/jpeg,image/jpg,image/*" required />
      </label>
      <button className="button" type="submit" disabled={!hasAlbums || isUploading}>
        <UploadCloud size={18} />
        {isUploading ? "Uploading" : "Upload photo"}
      </button>
      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
