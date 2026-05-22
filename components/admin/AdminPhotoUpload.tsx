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
  thumbnail: File | null;
  preview: File | null;
  full: File;
};

type PhotoUploadMetadata = {
  camera_model?: string;
  lens_model?: string;
  focal_length?: string;
  aperture?: string;
  shutter_speed?: string;
  iso?: string;
  captured_at?: string;
};

type SelectionSummary = {
  thumbnails: number;
  previews: number;
  fulls: number;
  matched: number;
  generatedThumbnails: number;
  generatedPreviews: number;
  fullSize: number;
};

type UploadFailure = {
  index: number;
  filename: string;
  message: string;
};

type ExistingUploadPhoto = {
  id: string;
  filename: string;
  r2_object_key: string;
  uploaded_at: string;
};

type PreparedPhotoSet = PhotoSet & {
  thumbnail: File;
  preview: File;
  metadata: PhotoUploadMetadata;
  generatedThumbnail: boolean;
  generatedPreview: boolean;
};

class R2UploadError extends Error {
  constructor(
    message: string,
    readonly canRetryWithBlob = false
  ) {
    super(message);
    this.name = "R2UploadError";
  }
}

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

function putR2Body(
  signedUpload: SignedUpload,
  body: Blob | File,
  file: File,
  label: string,
  mode: "direct" | "blob"
) {
  const contentType = file.type || "application/octet-stream";
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", signedUpload.uploadUrl);
    request.setRequestHeader("Content-Type", contentType);

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
        new R2UploadError(
          `${label} R2 PUT failed before R2 returned a response during ${mode} upload. Browser status 0 usually means CORS, local-file access, an extension, or network blocking. File type: ${
            file.type || "unknown"
          }, size: ${fileSizeLabel(file.size)}.`,
          mode === "direct"
        )
      );
    };

    request.onabort = () => {
      reject(
        new R2UploadError(
          `${label} R2 PUT was cancelled by the browser for ${file.name}.`,
          mode === "direct"
        )
      );
    };

    request.ontimeout = () => {
      reject(new Error(`${label} R2 PUT timed out for ${file.name}.`));
    };

    request.timeout = 10 * 60 * 1000;
    request.send(body);
  });
}

async function uploadToR2(signedUpload: SignedUpload, file: File, label: string) {
  try {
    await putR2Body(signedUpload, file, file, label, "direct");
    return;
  } catch (error) {
    if (!(error instanceof R2UploadError) || !error.canRetryWithBlob) {
      throw error;
    }

    let uploadBody: Blob;

    try {
      const buffer = await file.arrayBuffer();
      uploadBody = new Blob([buffer], {
        type: file.type || "application/octet-stream"
      });
    } catch (readError) {
      throw new Error(
        `${label} could not be read from this device before retrying upload. Try moving the files to a local folder, then select them again. ${
          readError instanceof Error ? readError.message : ""
        }`.trim()
      );
    }

    try {
      await putR2Body(signedUpload, uploadBody, file, label, "blob");
    } catch (retryError) {
      const retryMessage =
        retryError instanceof Error ? retryError.message : "Blob retry failed.";
      throw new Error(`${error.message} Blob retry also failed: ${retryMessage}`);
    }
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
    .replace(/[-_](thumb|thumbnail|preview|web|screen|full[-_]?res|fullres|full|large)$/i, "");
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

function generatedFilename(source: File, suffix: "thumb" | "preview") {
  return `${baseName(source.name)}_${suffix}.webp`;
}

function formatNumber(value: number, precision = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(precision);
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanCameraModel(make: unknown, model: unknown) {
  const makeText = asString(make);
  const modelText = asString(model);

  if (!makeText) {
    return modelText ?? undefined;
  }

  if (!modelText) {
    return makeText;
  }

  return modelText.toLowerCase().includes(makeText.toLowerCase())
    ? modelText
    : `${makeText} ${modelText}`;
}

function formatExposureTime(value: unknown) {
  const exposure = asNumber(value);

  if (!exposure) {
    return undefined;
  }

  return exposure < 1
    ? `1/${Math.round(1 / exposure)}`
    : `${formatNumber(exposure)}s`;
}

function formatExifDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  const text = asString(value);

  if (!text) {
    return undefined;
  }

  const date = new Date(text.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3"));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

async function readPhotoMetadata(file: File): Promise<PhotoUploadMetadata> {
  try {
    const exifr = await import("exifr");
    const data = (await exifr.parse(file)) as Record<string, unknown> | undefined;

    if (!data) {
      return {};
    }

    const focalLength = asNumber(data.FocalLength);
    const aperture = asNumber(data.FNumber);
    const iso = asNumber(data.ISO);

    return {
      camera_model: cleanCameraModel(data.Make, data.Model),
      lens_model: asString(data.LensModel) ?? undefined,
      focal_length: focalLength ? `${formatNumber(focalLength)}mm` : undefined,
      aperture: aperture ? `f/${formatNumber(aperture)}` : undefined,
      shutter_speed: formatExposureTime(data.ExposureTime),
      iso: iso ? `ISO ${Math.round(iso)}` : undefined,
      captured_at: formatExifDate(data.DateTimeOriginal ?? data.CreateDate)
    };
  } catch {
    return {};
  }
}

async function decodeImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return image;
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error(`${file.name} could not be decoded for automatic image generation.`);
  }
}

async function createImageVariant(
  source: File,
  longEdge: number,
  suffix: "thumb" | "preview",
  quality: number
) {
  const image = await decodeImage(source);

  try {
    const scale = Math.min(1, longEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true
    });

    if (!context) {
      throw new Error("Browser canvas is not available.");
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );

    if (!blob) {
      throw new Error(`Could not create ${suffix} image for ${source.name}.`);
    }

    return new File([blob], generatedFilename(source, suffix), {
      type: "image/webp",
      lastModified: Date.now()
    });
  } finally {
    URL.revokeObjectURL(image.src);
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function buildPhotoSets(thumbnails: File[], previews: File[], fulls: File[]) {
  const thumbnailMap = filesByBaseName(thumbnails);
  const previewMap = filesByBaseName(previews);
  const sortedFulls = sortByName(fulls);
  const matched = sortedFulls.map((full) => {
      const key = baseName(full.name);
      const thumbnail = thumbnailMap.get(key) ?? null;
      const preview = previewMap.get(key) ?? null;

      return {
        baseName: key,
        thumbnail,
        preview,
        full
      };
    });

  if (
    !thumbnails.length ||
    !previews.length ||
    matched.some((set) => set.thumbnail || set.preview)
  ) {
    return matched;
  }

  if (thumbnails.length === previews.length && previews.length === fulls.length) {
    const sortedThumbnails = sortByName(thumbnails);
    const sortedPreviews = sortByName(previews);

    return sortedFulls.map((full, index) => ({
      baseName: baseName(full.name),
      thumbnail: sortedThumbnails[index],
      preview: sortedPreviews[index],
      full
    }));
  }

  return [];
}

async function logUploadEvent(event: {
  album_id: string;
  filename: string;
  status: "failed" | "partial" | "success";
  message: string;
  size_bytes: number;
  duration_ms?: number;
}) {
  await fetch("/api/uploads/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...event,
      event_type: "photo"
    })
  }).catch(() => null);
}

async function notifyPhotoBatchUpload(event: {
  album_id: string;
  total: number;
  uploaded: number;
  failed: number;
  skipped: number;
  generated_thumbnails: number;
  generated_previews: number;
  total_size_bytes: number;
  duration_ms: number;
  failed_files?: Array<{
    filename: string;
    message: string;
  }>;
}) {
  await fetch("/api/uploads/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "photo-batch",
      ...event
    })
  }).catch(() => null);
}

async function existingPhotoFilenames(albumId: string) {
  const response = await fetch("/api/uploads/existing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ album_id: albumId })
  });

  if (!response.ok) {
    throw new Error(
      await responseMessage(response, "Could not check existing album photos.")
    );
  }

  const payload = (await response.json()) as {
    photos?: ExistingUploadPhoto[];
  };

  return new Set(
    (payload.photos ?? []).map((photo) => photo.filename.trim().toLowerCase())
  );
}

async function preparePhotoSet(
  photoSet: PhotoSet,
  onStage?: (message: string) => void
): Promise<PreparedPhotoSet> {
  onStage?.(`Reading EXIF metadata from ${photoSet.full.name}`);
  const metadata = await readPhotoMetadata(photoSet.full);
  let thumbnail = photoSet.thumbnail;
  let preview = photoSet.preview;
  let generatedThumbnail = false;
  let generatedPreview = false;

  if (!thumbnail) {
    onStage?.(`Generating thumbnail for ${photoSet.full.name}`);
    thumbnail = await createImageVariant(photoSet.full, 400, "thumb", 0.78);
    generatedThumbnail = true;
  }

  if (!preview) {
    onStage?.(`Generating preview for ${photoSet.full.name}`);
    preview = await createImageVariant(photoSet.full, 2200, "preview", 0.84);
    generatedPreview = true;
  }

  return {
    ...photoSet,
    thumbnail,
    preview,
    metadata,
    generatedThumbnail,
    generatedPreview
  };
}

async function uploadPhotoSet(
  albumId: string,
  photoSet: PhotoSet,
  onStage?: (message: string) => void
) {
  const uploadedKeys: string[] = [];
  const startedAt = performance.now();
  const preparedSet = await preparePhotoSet(photoSet, onStage);
  const totalSize =
    preparedSet.thumbnail.size + preparedSet.preview.size + preparedSet.full.size;

  try {
    onStage?.(`Uploading thumbnail for ${photoSet.full.name}`);
    const thumbnailUpload = await signAndUploadPart(
      albumId,
      "thumbnails",
      preparedSet.thumbnail,
      "Thumbnail"
    );
    uploadedKeys.push(thumbnailUpload.key);

    onStage?.(`Uploading preview for ${photoSet.full.name}`);
    const previewUpload = await signAndUploadPart(
      albumId,
      "previews",
      preparedSet.preview,
      "Preview"
    );
    uploadedKeys.push(previewUpload.key);

    onStage?.(`Uploading full-res file for ${photoSet.full.name}`);
    const fullUpload = await signAndUploadPart(
      albumId,
      "full",
      preparedSet.full,
      "Full-res"
    );
    uploadedKeys.push(fullUpload.key);

    onStage?.(`Saving photo record for ${photoSet.full.name}`);
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
        r2_object_key: fullUpload.key,
        ...preparedSet.metadata,
        thumbnail_size_bytes: preparedSet.thumbnail.size,
        preview_size_bytes: preparedSet.preview.size,
        full_size_bytes: preparedSet.full.size,
        file_size_bytes: totalSize,
        generated_thumbnail: preparedSet.generatedThumbnail,
        generated_preview: preparedSet.generatedPreview,
        upload_duration_ms: Math.round(performance.now() - startedAt)
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

async function uploadPhotoSetWithRetry(
  albumId: string,
  photoSet: PhotoSet,
  onStage?: (message: string) => void,
  attempts = 3
) {
  let lastError: unknown;
  const startedAt = performance.now();

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await uploadPhotoSet(albumId, photoSet, onStage);
      return;
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await sleep(700 * attempt);
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Upload failed.";
  await logUploadEvent({
    album_id: albumId,
    filename: photoSet.full.name,
    status: "failed",
    message: `Failed after ${attempts} attempts. ${message}`,
    size_bytes:
      photoSet.full.size + (photoSet.thumbnail?.size ?? 0) + (photoSet.preview?.size ?? 0),
    duration_ms: Math.round(performance.now() - startedAt)
  });
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
    generatedThumbnails: 0,
    generatedPreviews: 0,
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
      generatedThumbnails: matched.filter((set) => !set.thumbnail).length,
      generatedPreviews: matched.filter((set) => !set.preview).length,
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

    if (!albumId || !fulls.length) {
      setStatusKind("error");
      setStatus("Choose an album and at least one full-res image.");
      return;
    }

    const photoSets = buildPhotoSets(thumbnails, previews, fulls);

    if (!photoSets.length) {
      setStatusKind("error");
      setStatus(
        "No image files found. Choose the full-res JPEGs, then thumbnails and previews can be generated automatically."
      );
      return;
    }

    const skipExisting = formData.get("skip_existing") === "on";
    const uploadStartedAt = performance.now();
    let latestSuccessful = 0;
    let uploadSets = photoSets;
    let skippedExisting = 0;

    setIsUploading(true);
    setCompletedCount(0);
    setProcessedCount(0);
    setTotalCount(photoSets.length);
    setActivePhoto("");
    setFailedUploads([]);
    setStatusKind("info");
    setStatus(`Preparing ${photoSets.length} photo sets for upload...`);

    try {
      if (skipExisting) {
        setStatus("Checking this album for files that are already saved...");
        const existingFilenames = await existingPhotoFilenames(albumId);
        uploadSets = photoSets.filter(
          (photoSet) => !existingFilenames.has(photoSet.full.name.trim().toLowerCase())
        );
        skippedExisting = photoSets.length - uploadSets.length;

        if (!uploadSets.length) {
          setTotalCount(0);
          setStatusKind("info");
          setStatus(
            `All ${photoSets.length} selected photo sets are already saved in this album.`
          );
          setIsUploading(false);
          return;
        }
      }

      const generatedThumbnails = uploadSets.filter((set) => !set.thumbnail).length;
      const generatedPreviews = uploadSets.filter((set) => !set.preview).length;
      const totalSizeBytes = uploadSets.reduce(
        (total, set) => total + set.full.size,
        0
      );
      const sendUploadNotification = (result: {
        successful: number;
        failures: UploadFailure[];
      }) =>
        notifyPhotoBatchUpload({
          album_id: albumId,
          total: photoSets.length,
          uploaded: result.successful,
          failed: result.failures.length,
          skipped: skippedExisting,
          generated_thumbnails: generatedThumbnails,
          generated_previews: generatedPreviews,
          total_size_bytes: totalSizeBytes,
          duration_ms: Math.round(performance.now() - uploadStartedAt),
          failed_files: result.failures.slice(0, 10).map((failure) => ({
            filename: failure.filename,
            message: failure.message.slice(0, 500)
          }))
        });

      setTotalCount(uploadSets.length);
      setStatus(
        skippedExisting
          ? `Skipped ${skippedExisting} existing photo sets. Uploading ${uploadSets.length} remaining sets...`
          : `Uploading ${uploadSets.length} photo sets...`
      );

      const result = await uploadWithLimit(
        uploadSets,
        1,
        (photoSet) =>
          uploadPhotoSetWithRetry(albumId, photoSet, (message) =>
            setActivePhoto(message)
          ),
        (index, photoSet) => {
          setActivePhoto(`Working on ${index}/${uploadSets.length}: ${photoSet.full.name}`);
        },
        ({ processed, successful, failures }) => {
          latestSuccessful = successful;
          setProcessedCount(processed);
          setCompletedCount(successful);
          setFailedUploads(failures);
          setStatus(
            failures.length
              ? `Processed ${processed}/${uploadSets.length}. Uploaded ${successful}, failed ${failures.length}, skipped ${skippedExisting}.`
              : `Uploaded ${successful}/${uploadSets.length} photo sets. Skipped ${skippedExisting} existing sets...`
          );
        },
      );

      if (result.failures.length) {
        await sendUploadNotification(result);
        setStatusKind("error");
        setStatus(
          result.stoppedEarly
            ? `Stopped early because the first ${result.failures.length} uploads failed. This usually points to an R2/CORS/config issue, not bad filenames.`
            : `Uploaded ${result.successful}/${uploadSets.length} new photo sets. ${result.failures.length} failed. ${skippedExisting} existing sets were skipped. You can retry after checking the failed files below.`
        );
        setIsUploading(false);
        return;
      }

      await sendUploadNotification(result);
      window.location.assign("/admin?view=uploads&notice=photos-uploaded#uploads");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      await notifyPhotoBatchUpload({
        album_id: albumId,
        total: photoSets.length,
        uploaded: latestSuccessful,
        failed: 1,
        skipped: skippedExisting,
        generated_thumbnails: uploadSets.filter((set) => !set.thumbnail).length,
        generated_previews: uploadSets.filter((set) => !set.preview).length,
        total_size_bytes: uploadSets.reduce((total, set) => total + set.full.size, 0),
        duration_ms: Math.round(performance.now() - uploadStartedAt),
        failed_files: [
          {
            filename: "Upload workflow",
            message
          }
        ]
      });
      setStatusKind("error");
      setStatus(message);
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
          Choose the full-res JPEGs. The browser will read EXIF, generate WebP
          thumbnails/previews, upload everything to R2, then save the photo records.
          You can still add your own thumbnails or previews as overrides.
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
      <label className="checkbox-field">
        <input name="skip_existing" type="checkbox" defaultChecked />
        Skip photo sets that already exist in this album
      </label>
      <label className="field">
        Thumbnail images <small>Optional override</small>
        <input
          name="thumbnails"
          type="file"
          accept="image/jpeg,image/jpg,image/webp,image/*"
          multiple
        />
      </label>
      <label className="field">
        Preview images <small>Optional override</small>
        <input
          name="previews"
          type="file"
          accept="image/jpeg,image/jpg,image/webp,image/*"
          multiple
        />
      </label>
      <label className="field">
        Full-res images <small>Required source files</small>
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
        <span>{selection.thumbnails} supplied thumbnails</span>
        <span>{selection.previews} supplied previews</span>
        <span>{selection.fulls} full-res</span>
        <span>{selection.generatedThumbnails} auto thumbnails</span>
        <span>{selection.generatedPreviews} auto previews</span>
        <span>{selection.matched} ready</span>
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
