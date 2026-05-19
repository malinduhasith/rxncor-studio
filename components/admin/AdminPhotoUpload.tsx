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
  defaultAlbumId?: string;
};

type PhotoSet = {
  baseName: string;
  thumbnail: File;
  preview: File;
  full: File;
};

type SelectionSummary = {
  thumbnails: number;
  previews: number;
  fulls: number;
  matched: number;
  fullSize: number;
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

function fileList(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((file): file is File => file instanceof File && file.size > 0);
}

function baseName(filename: string) {
  const cleanName = filename.split(/[/\\]/).pop() ?? filename;
  const extensionIndex = cleanName.lastIndexOf(".");
  const withoutExtension =
    extensionIndex > 0 ? cleanName.slice(0, extensionIndex) : cleanName;

  return withoutExtension
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[-_](thumb|thumbnail|preview|web|screen|full|large)$/i, "");
}

function filesByBaseName(files: File[]) {
  return new Map(files.map((file) => [baseName(file.name), file]));
}

function sortByName(files: File[]) {
  return [...files].sort((a, b) => a.name.localeCompare(b.name));
}

function fileSizeLabel(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function buildPhotoSets(thumbnails: File[], previews: File[], fulls: File[]) {
  const thumbnailMap = filesByBaseName(thumbnails);
  const previewMap = filesByBaseName(previews);
  const matched = fulls
    .map((full) => {
      const key = baseName(full.name);
      const thumbnail = thumbnailMap.get(key);
      const preview = previewMap.get(key);

      if (!thumbnail || !preview) {
        return null;
      }

      return {
        baseName: key,
        thumbnail,
        preview,
        full
      };
    })
    .filter((set): set is PhotoSet => Boolean(set));

  if (matched.length > 0) {
    return matched;
  }

  if (thumbnails.length === previews.length && previews.length === fulls.length) {
    const sortedThumbnails = sortByName(thumbnails);
    const sortedPreviews = sortByName(previews);
    const sortedFulls = sortByName(fulls);

    return sortedFulls.map((full, index) => ({
      baseName: baseName(full.name),
      thumbnail: sortedThumbnails[index],
      preview: sortedPreviews[index],
      full
    }));
  }

  return [];
}

async function uploadPhotoSet(albumId: string, photoSet: PhotoSet) {
  const [thumbnailUpload, previewUpload, fullUpload] = await Promise.all([
    signUpload(albumId, "thumbnails", photoSet.thumbnail),
    signUpload(albumId, "previews", photoSet.preview),
    signUpload(albumId, "full", photoSet.full)
  ]);
  const uploadedKeys = [thumbnailUpload.key, previewUpload.key, fullUpload.key];

  try {
    const uploadResults = await Promise.allSettled([
      uploadToR2(thumbnailUpload, photoSet.thumbnail),
      uploadToR2(previewUpload, photoSet.preview),
      uploadToR2(fullUpload, photoSet.full)
    ]);

    if (uploadResults.some((result) => result.status === "rejected")) {
      await cleanupUploadedKeys(uploadedKeys);
      throw new Error(`Could not upload all files for ${photoSet.full.name}.`);
    }

    const photoResponse = await fetch("/api/photos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        album_id: albumId,
        filename: photoSet.full.name,
        thumbnail_url: thumbnailUpload.publicUrl,
        preview_url: previewUpload.publicUrl,
        full_res_url: fullUpload.publicUrl,
        r2_object_key: fullUpload.key
      })
    });

    if (!photoResponse.ok) {
      await cleanupUploadedKeys(uploadedKeys);
      throw new Error(`Could not save ${photoSet.full.name}. R2 files were cleaned up.`);
    }
  } catch (error) {
    await cleanupUploadedKeys(uploadedKeys);
    throw error;
  }
}

async function uploadWithLimit(
  photoSets: PhotoSet[],
  limit: number,
  upload: (photoSet: PhotoSet) => Promise<void>,
  onProgress: (completed: number) => void
) {
  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.min(limit, photoSets.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < photoSets.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await upload(photoSets[currentIndex]);
        completed += 1;
        onProgress(completed);
      }
    })
  );
}

export function AdminPhotoUpload({
  albums,
  defaultAlbumId: preferredAlbumId
}: AdminPhotoUploadProps) {
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selection, setSelection] = useState<SelectionSummary>({
    thumbnails: 0,
    previews: 0,
    fulls: 0,
    matched: 0,
    fullSize: 0
  });
  const defaultAlbumId =
    albums.find((album) => album.id === preferredAlbumId)?.id ?? albums[0]?.id ?? "";
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

  function updateSelectionSummary(form: HTMLFormElement) {
    const formData = new FormData(form);
    const thumbnails = fileList(formData, "thumbnails");
    const previews = fileList(formData, "previews");
    const fulls = fileList(formData, "fulls");
    const matched = buildPhotoSets(thumbnails, previews, fulls);

    setSelection({
      thumbnails: thumbnails.length,
      previews: previews.length,
      fulls: fulls.length,
      matched: matched.length,
      fullSize: fulls.reduce((total, file) => total + file.size, 0)
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isUploading) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const albumId = String(formData.get("album_id") ?? "");
    const thumbnails = fileList(formData, "thumbnails");
    const previews = fileList(formData, "previews");
    const fulls = fileList(formData, "fulls");

    if (!albumId || !thumbnails.length || !previews.length || !fulls.length) {
      setStatus("Choose an album and all three export groups.");
      return;
    }

    const photoSets = buildPhotoSets(thumbnails, previews, fulls);

    if (!photoSets.length) {
      setStatus(
        "No matching files found. Use matching names like img_001_thumb.jpg, img_001_preview.jpg, and img_001.jpg."
      );
      return;
    }

    if (photoSets.length !== fulls.length) {
      setStatus(
        `Matched ${photoSets.length}/${fulls.length} full-res files. Check thumbnail and preview filenames before uploading.`
      );
      return;
    }

    setIsUploading(true);
    setCompletedCount(0);
    setTotalCount(photoSets.length);
    setStatus(`Uploading 0/${photoSets.length} photos...`);

    try {
      await uploadWithLimit(
        photoSets,
        3,
        (photoSet) => uploadPhotoSet(albumId, photoSet),
        (completed) => {
          setCompletedCount(completed);
          setStatus(`Uploaded ${completed}/${photoSets.length} photos...`);
        },
      );

      window.location.assign("/admin?view=uploads&notice=photos-uploaded#uploads");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
      setIsUploading(false);
    }
  }

  return (
    <form
      className="upload-form"
      onChange={(event) => updateSelectionSummary(event.currentTarget)}
      onSubmit={handleSubmit}
    >
      <label className="field">
        Album
        <select name="album_id" defaultValue={defaultAlbumId} disabled={!hasAlbums}>
          {hasAlbums ? albumOptions : <option value="">Create an album first</option>}
        </select>
      </label>
      <div className="upload-guidance">
        <strong>Upload a full album in one run</strong>
        <span>
          Choose matching thumbnail, preview, and full-res exports. Matching names are
          paired automatically.
        </span>
      </div>
      <label className="field">
        Thumbnail images
        <input
          name="thumbnails"
          type="file"
          accept="image/jpeg,image/jpg,image/webp,image/*"
          multiple
          required
        />
      </label>
      <label className="field">
        Preview images
        <input
          name="previews"
          type="file"
          accept="image/jpeg,image/jpg,image/webp,image/*"
          multiple
          required
        />
      </label>
      <label className="field">
        Full-res images
        <input
          name="fulls"
          type="file"
          accept="image/jpeg,image/jpg,image/*"
          multiple
          required
        />
      </label>
      <button className="button" type="submit" disabled={!hasAlbums || isUploading}>
        <UploadCloud size={18} />
        {isUploading ? "Uploading" : "Upload album photos"}
      </button>
      <div className="upload-summary">
        <span>{selection.thumbnails} thumbnails</span>
        <span>{selection.previews} previews</span>
        <span>{selection.fulls} full-res</span>
        <span>{selection.matched} matched</span>
        <span>{fileSizeLabel(selection.fullSize)}</span>
      </div>
      {isUploading && totalCount ? (
        <progress className="upload-progress" value={completedCount} max={totalCount} />
      ) : null}
      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
