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

type R2UploadKind = "thumbnails" | "previews" | "full";

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

type UploadFailure = {
  index: number;
  filename: string;
  message: string;
};

async function responseMessage(response: Response, fallback: string) {
  const text = await response.text().catch(() => "");

  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text) as { error?: string };
    return payload.error || fallback;
  } catch {
    return text.slice(0, 240);
  }
}

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
    throw new Error(await responseMessage(response, "Could not create upload URL."));
  }

  return (await response.json()) as SignedUpload;
}

function uploadToR2(signedUpload: SignedUpload, file: File, label: string) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", signedUpload.uploadUrl);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${label} R2 PUT returned ${request.status}: ${
            request.responseText || request.statusText || "R2 upload failed."
          }`
        )
      );
    };

    request.onerror = () => {
      reject(
        new Error(
          `${label} R2 PUT failed before R2 returned a response. Browser status 0 usually means CORS, local-file access, an extension, or network blocking. File type: ${
            file.type || "unknown"
          }, size: ${fileSizeLabel(file.size)}.`
        )
      );
    };

    request.ontimeout = () => {
      reject(new Error(`${label} R2 PUT timed out for ${file.name}.`));
    };

    request.timeout = 10 * 60 * 1000;
    request.send(file);
  });
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

async function signAndUploadPart(
  albumId: string,
  kind: R2UploadKind,
  file: File,
  label: string
) {
  const signedUpload = await signUpload(albumId, kind, file);
  await uploadToR2(signedUpload, file, label);
  return signedUpload;
}

async function runServerR2Diagnostic() {
  const response = await fetch("/api/uploads/diagnostic", {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await responseMessage(response, "Server R2 diagnostic failed."));
  }
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

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
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
  const uploadedKeys: string[] = [];

  try {
    const thumbnailUpload = await signAndUploadPart(
      albumId,
      "thumbnails",
      photoSet.thumbnail,
      "Thumbnail"
    );
    uploadedKeys.push(thumbnailUpload.key);

    const previewUpload = await signAndUploadPart(
      albumId,
      "previews",
      photoSet.preview,
      "Preview"
    );
    uploadedKeys.push(previewUpload.key);

    const fullUpload = await signAndUploadPart(
      albumId,
      "full",
      photoSet.full,
      "Full-res"
    );
    uploadedKeys.push(fullUpload.key);

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
      throw new Error(
        await responseMessage(photoResponse, `Could not save ${photoSet.full.name}.`)
      );
    }
  } catch (error) {
    await cleanupUploadedKeys(uploadedKeys);
    throw error;
  }
}

async function uploadPhotoSetWithRetry(albumId: string, photoSet: PhotoSet, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await uploadPhotoSet(albumId, photoSet);
      return;
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await sleep(700 * attempt);
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Upload failed.";
  throw new Error(`Failed after ${attempts} attempts. ${message}`);
}

async function uploadWithLimit(
  photoSets: PhotoSet[],
  limit: number,
  upload: (photoSet: PhotoSet) => Promise<void>,
  onStart: (index: number, photoSet: PhotoSet) => void,
  onProgress: (state: {
    processed: number;
    successful: number;
    failures: UploadFailure[];
  }) => void
) {
  let nextIndex = 0;
  let processed = 0;
  let successful = 0;
  let stoppedEarly = false;
  const failures: UploadFailure[] = [];
  const workerCount = Math.min(limit, photoSets.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < photoSets.length && !stoppedEarly) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const photoSet = photoSets[currentIndex];
        onStart(currentIndex + 1, photoSet);

        try {
          await upload(photoSet);
          successful += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed.";

          failures.push({
            index: currentIndex + 1,
            filename: photoSet.full.name,
            message
          });

          if (successful === 0 && failures.length >= 10) {
            stoppedEarly = true;
          }
        }

        processed += 1;
        onProgress({
          processed,
          successful,
          failures: [...failures]
        });
      }
    })
  );

  return {
    successful,
    failures,
    stoppedEarly
  };
}

export function AdminPhotoUpload({
  albums,
  defaultAlbumId: preferredAlbumId
}: AdminPhotoUploadProps) {
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"info" | "error">("info");
  const [isUploading, setIsUploading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activePhoto, setActivePhoto] = useState("");
  const [failedUploads, setFailedUploads] = useState<UploadFailure[]>([]);
  const [isTestingR2, setIsTestingR2] = useState(false);
  const [diagnosticStatus, setDiagnosticStatus] = useState("");
  const [diagnosticKind, setDiagnosticKind] = useState<"info" | "error">("info");
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
      setStatusKind("error");
      setStatus("Choose an album and all three export groups.");
      return;
    }

    const photoSets = buildPhotoSets(thumbnails, previews, fulls);

    if (!photoSets.length) {
      setStatusKind("error");
      setStatus(
        "No matching files found. Use matching names like img_001_thumb.jpg, img_001_preview.jpg, and img_001.jpg."
      );
      return;
    }

    if (photoSets.length !== fulls.length) {
      setStatusKind("error");
      setStatus(
        `Matched ${photoSets.length}/${fulls.length} full-res files. Check thumbnail and preview filenames before uploading.`
      );
      return;
    }

    setIsUploading(true);
    setCompletedCount(0);
    setProcessedCount(0);
    setTotalCount(photoSets.length);
    setActivePhoto("");
    setFailedUploads([]);
    setStatusKind("info");
    setStatus(`Preparing ${photoSets.length} photo sets for upload...`);

    try {
      const result = await uploadWithLimit(
        photoSets,
        1,
        (photoSet) => uploadPhotoSetWithRetry(albumId, photoSet),
        (index, photoSet) => {
          setActivePhoto(`Working on ${index}/${photoSets.length}: ${photoSet.full.name}`);
        },
        ({ processed, successful, failures }) => {
          setProcessedCount(processed);
          setCompletedCount(successful);
          setFailedUploads(failures);
          setStatus(
            failures.length
              ? `Processed ${processed}/${photoSets.length}. Uploaded ${successful}, failed ${failures.length}.`
              : `Uploaded ${successful}/${photoSets.length} photo sets...`
          );
        },
      );

      if (result.failures.length) {
        setStatusKind("error");
        setStatus(
          result.stoppedEarly
            ? `Stopped early because the first ${result.failures.length} uploads failed. This usually points to an R2/CORS/config issue, not bad filenames.`
            : `Uploaded ${result.successful}/${photoSets.length} photo sets. ${result.failures.length} failed. You can retry after checking the failed files below.`
        );
        setIsUploading(false);
        return;
      }

      window.location.assign("/admin?view=uploads&notice=photos-uploaded#uploads");
    } catch (error) {
      setStatusKind("error");
      setStatus(error instanceof Error ? error.message : "Upload failed.");
      setIsUploading(false);
    }
  }

  async function handleR2Diagnostic(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;

    if (!form || isTestingR2) {
      return;
    }

    const formData = new FormData(form);
    const albumId = String(formData.get("album_id") ?? "");

    if (!albumId) {
      setDiagnosticKind("error");
      setDiagnosticStatus("Choose an album before running the R2 upload test.");
      return;
    }

    setIsTestingR2(true);
    setDiagnosticKind("info");
    setDiagnosticStatus("Testing server R2 access...");

    try {
      await runServerR2Diagnostic();
      setDiagnosticStatus("Server R2 access passed. Testing browser signed upload...");

      const testFile = new File(
        [`rxncor.studio browser R2 diagnostic ${new Date().toISOString()}`],
        `_r2-browser-test-${Date.now()}.png`,
        { type: "image/png" }
      );
      const signedUpload = await signUpload(albumId, "thumbnails", testFile);

      await uploadToR2(signedUpload, testFile, "Browser diagnostic");
      await cleanupUploadedKeys([signedUpload.key]);

      setDiagnosticKind("info");
      setDiagnosticStatus(
        "R2 diagnostics passed. Server credentials and browser signed upload both work."
      );
    } catch (error) {
      setDiagnosticKind("error");
      setDiagnosticStatus(error instanceof Error ? error.message : "R2 diagnostic failed.");
    } finally {
      setIsTestingR2(false);
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
      <div className="upload-diagnostic">
        <button
          className="button secondary"
          type="button"
          disabled={!hasAlbums || isUploading || isTestingR2}
          onClick={handleR2Diagnostic}
        >
          {isTestingR2 ? "Testing R2" : "Test R2 upload"}
        </button>
        {diagnosticStatus ? (
          <p className={`upload-message ${diagnosticKind}`}>{diagnosticStatus}</p>
        ) : null}
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
        <div className="upload-status-panel">
          <div>
            <strong>
              {processedCount}/{totalCount} processed · {completedCount} uploaded
            </strong>
            <small>
              One set means thumbnail, preview, full-res file, and Supabase record.
            </small>
          </div>
          {activePhoto ? <span>{activePhoto}</span> : null}
          <progress className="upload-progress" value={processedCount} max={totalCount} />
        </div>
      ) : null}
      {status ? <p className={`upload-message ${statusKind}`}>{status}</p> : null}
      {failedUploads.length ? (
        <div className="upload-failure-list">
          <strong>Failed files</strong>
          <ul>
            {failedUploads.map((failure) => (
              <li key={`${failure.index}-${failure.filename}`}>
                <span>
                  #{failure.index} {failure.filename}
                </span>
                <small>{failure.message}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
