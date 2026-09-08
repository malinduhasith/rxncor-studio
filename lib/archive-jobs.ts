import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getR2Env } from "@/config/server-env";
import { createR2Client } from "@/lib/r2";
import { DownloadError } from "@/lib/download-access";
import { endOfZip, initialZipCursor, nextZipChunk, safeDownloadName, uniqueZipNames, zipLayout, type ZipCursor, type ZipEntry } from "@/lib/zip";

const PREFIX = "rxncor-generated/";
const RETENTION_MS = 48 * 60 * 60 * 1000;
const BASE_PART_SIZE = 16 * 1024 * 1024;
const JOB_ID = /^\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}$/;
type ArchivePhoto = ZipEntry & { id: string; key: string; etag?: string };
export type ArchiveJob = {
  version: 1; id: string; albumId: string; filename: string; expiresAt: number;
  phase: "checking" | "building" | "ready" | "failed";
  files: ArchivePhoto[]; checked: number; cursor: ZipCursor; pending: string;
  parts: { PartNumber: number; ETag: string }[];
  uploadId?: string; partSize: number; totalBytes: number; error?: string;
  lease?: { id: string; until: number };
};
export type ArchivePhotoInput = { id: string; filename: string; r2_object_key: string };

function encryptionKey() {
  return createHash("sha256").update("rxncor-archive-state-v1:").update(getR2Env().secretAccessKey).digest();
}
function signature(value: string) { return createHmac("sha256", encryptionKey()).update(`download-token:${value}`).digest("hex"); }
export function archiveToken(job: Pick<ArchiveJob, "id" | "albumId" | "expiresAt">) {
  const payload = Buffer.from(JSON.stringify({ id: job.id, albumId: job.albumId, expiresAt: job.expiresAt })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function parseArchiveToken(token: string) {
  const [payload, mac, extra] = token.split(".");
  if (!payload || !/^[a-f0-9]{64}$/.test(mac ?? "") || extra || token.length > 1024 || !timingSafeEqual(Buffer.from(mac), Buffer.from(signature(payload)))) {
    throw new DownloadError("Invalid download link.", 403);
  }
  let parsed: { id: string; albumId: string; expiresAt: number };
  try { parsed = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { throw new DownloadError("Invalid download link.", 403); }
  if (!parsed || !JOB_ID.test(parsed.id) || typeof parsed.albumId !== "string" || !Number.isFinite(parsed.expiresAt)) throw new DownloadError("Invalid download link.", 403);
  if (parsed.expiresAt <= Date.now()) throw new DownloadError("This ZIP has expired. Select your photos to prepare a new download.", 410);
  return parsed;
}
function stateKey(id: string) { if (!JOB_ID.test(id)) throw new DownloadError("Invalid download.", 400); return `${PREFIX}jobs/${id}.bin`; }
export function archiveObjectKey(job: Pick<ArchiveJob, "id">) { return `${PREFIX}archives/${job.id}.zip`; }

function encryptJob(job: ArchiveJob) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(job.id));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(job)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}
function decryptJob(id: string, bytes: Uint8Array): ArchiveJob {
  const body = Buffer.from(bytes);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), body.subarray(0, 12));
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(body.subarray(12, 28));
  const job = JSON.parse(Buffer.concat([decipher.update(body.subarray(28)), decipher.final()]).toString()) as ArchiveJob;
  if (job.id !== id || job.version !== 1) throw new Error("Invalid archive state");
  return job;
}

const operationOptions = () => ({ abortSignal: AbortSignal.timeout(25_000) });
function isMissing(error: unknown) { return error instanceof Error && ["NotFound", "NoSuchKey", "NoSuchUpload"].includes(error.name); }
function isConflict(error: unknown) { return error instanceof Error && ["PreconditionFailed", "ConditionalRequestConflict"].includes(error.name); }

export async function readArchiveJob(id: string) {
  const client = createR2Client();
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: getR2Env().bucket, Key: stateKey(id) }), operationOptions());
    if (!object.Body || !object.ETag) throw new Error("Download state missing");
    return { job: decryptJob(id, await object.Body.transformToByteArray()), etag: object.ETag };
  } catch (error) {
    if (isMissing(error)) throw new DownloadError("This download is no longer available. Prepare a new ZIP.", 410);
    throw error;
  }
}
async function saveJob(job: ArchiveJob, etag?: string) {
  const result = await createR2Client().send(new PutObjectCommand({ Bucket: getR2Env().bucket, Key: stateKey(job.id),
    Body: encryptJob(job), ContentType: "application/octet-stream", CacheControl: "no-store",
    ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }) }), operationOptions());
  if (!result.ETag) throw new Error("Download checkpoint missing");
  return result.ETag;
}

export async function createArchiveJob(albumId: string, title: string, photos: ArchivePhotoInput[]) {
  const names = uniqueZipNames(photos.map(photo => photo.filename));
  const job: ArchiveJob = {
    version: 1, id: `${new Date().toISOString().slice(0, 10)}/${randomUUID()}`, albumId,
    filename: `${safeDownloadName(title, "album")}-${photos.length}-photos.zip`, expiresAt: Date.now() + RETENTION_MS,
    phase: "checking", checked: 0, cursor: initialZipCursor(), pending: "", parts: [],
    partSize: BASE_PART_SIZE, totalBytes: 0,
    files: photos.map((photo, index) => ({ id: photo.id, key: photo.r2_object_key, name: names[index], size: 0, offset: 0, crc: 0 }))
  };
  await saveJob(job);
  return job;
}

export function archiveProgress(job: ArchiveJob) {
  const fileBytes = job.files.reduce((sum, file) => sum + file.size, 0);
  const percent = job.phase === "ready" ? 100 : job.phase === "checking"
    ? Math.floor(job.checked / Math.max(1, job.files.length) * 5)
    : Math.min(99, 5 + Math.floor(job.cursor.bytesRead / Math.max(1, fileBytes) * 94));
  return { job_token: archiveToken(job), phase: job.phase, percent, photo_count: job.files.length,
    filename: job.filename, expires_at: job.expiresAt, bytes: job.totalBytes, error: job.error,
    download_url: job.phase === "ready" ? `/api/downloads/archive?download=1&token=${encodeURIComponent(archiveToken(job))}` : undefined };
}

/** Work is checkpointed in R2, including partial files and CRCs. The browser
 * requests another bounded step; only the server ever sees archive bytes. */
export async function advanceArchiveJob(id: string) {
  let { job, etag } = await readArchiveJob(id);
  if (job.phase === "ready" || job.phase === "failed" || (job.lease && job.lease.until > Date.now())) return job;
  const leaseId = randomUUID();
  job.lease = { id: leaseId, until: Date.now() + 150_000 };
  try { etag = await saveJob(job, etag); } catch (error) { if (isConflict(error)) return (await readArchiveJob(id)).job; throw error; }
  const client = createR2Client();
  const Bucket = getR2Env().bucket;
  const deadline = Date.now() + 35_000;
  const checkpoint = async () => {
    job.lease = { id: leaseId, until: Date.now() + 150_000 };
    etag = await saveJob(job, etag);
  };
  const finish = async () => {
    const object = await client.send(new HeadObjectCommand({ Bucket, Key: archiveObjectKey(job) }), operationOptions());
    if (object.ContentLength !== job.totalBytes) throw new Error("ZIP size did not match");
    job.phase = "ready"; job.pending = ""; delete job.error; delete job.lease;
    etag = await saveJob(job, etag);
    return job;
  };
  try {
    while (job.phase === "checking" && Date.now() < deadline) {
      const batch = job.files.slice(job.checked, job.checked + 16);
      const results = await Promise.all(batch.map(async file => {
        try {
          const head = await client.send(new HeadObjectCommand({ Bucket, Key: file.key }), operationOptions());
          if (!Number.isSafeInteger(head.ContentLength) || !head.ETag) throw new Error("Missing photo metadata");
          return { size: head.ContentLength!, etag: head.ETag };
        } catch (error) { if (isMissing(error)) throw new DownloadError("A selected original is missing. Ask the studio to check this album.", 410); throw error; }
      }));
      results.forEach((result, index) => Object.assign(job.files[job.checked + index], result));
      job.checked += results.length;
      if (job.checked === job.files.length) {
        const layout = zipLayout(job.files);
        job.totalBytes = layout.directoryOffset + layout.directorySize + endOfZip(job.files).length;
        // R2 permits 10,000 parts. Choose a part size from the actual album size.
        job.partSize = Math.max(BASE_PART_SIZE, Math.ceil(job.totalBytes / 9999 / (1024 * 1024)) * 1024 * 1024);
        if (job.partSize > 256 * 1024 * 1024) throw new DownloadError("This archive exceeds the storage service's maximum size. Download it in separate selections.", 413);
        const upload = await client.send(new CreateMultipartUploadCommand({ Bucket, Key: archiveObjectKey(job), ContentType: "application/zip",
          ContentDisposition: `attachment; filename="photos.zip"; filename*=UTF-8''${encodeURIComponent(job.filename)}`, CacheControl: "private, no-store" }), operationOptions());
        if (!upload.UploadId) throw new Error("Could not start archive upload");
        job.uploadId = upload.UploadId; job.phase = "building";
      }
      await checkpoint();
    }
    let uploadedThisStep = 0;
    while (job.phase === "building" && Date.now() < deadline && uploadedThisStep < 256 * 1024 * 1024) {
      const pending = Buffer.from(job.pending, "base64");
      const bytes = await nextZipChunk(job.files, job.cursor, async (index, offset, length) => {
        const file = job.files[index];
        try {
          const response = await client.send(new GetObjectCommand({ Bucket, Key: file.key, Range: `bytes=${offset}-${offset + length - 1}`, IfMatch: file.etag }), operationOptions());
          if (!response.Body) throw new Error("Photo stream missing");
          return await response.Body.transformToByteArray();
        } catch (error) {
          if (isConflict(error) || isMissing(error)) throw new DownloadError("A selected photo changed. Start a new ZIP to include the current originals.", 410);
          throw error;
        }
      }, job.partSize - pending.length, deadline);
      const part = Buffer.concat([pending, bytes]);
      if (part.length === job.partSize || job.cursor.phase === "done") {
        if (part.length) {
          const PartNumber = job.parts.length + 1;
          const uploaded = await client.send(new UploadPartCommand({ Bucket, Key: archiveObjectKey(job), UploadId: job.uploadId, PartNumber, Body: part }), operationOptions());
          if (!uploaded.ETag) throw new Error("ZIP part was not saved");
          job.parts.push({ PartNumber, ETag: uploaded.ETag });
          uploadedThisStep += part.length;
        }
        job.pending = "";
      } else job.pending = part.toString("base64");
      await checkpoint();
      if (job.cursor.phase === "done") {
        await client.send(new CompleteMultipartUploadCommand({ Bucket, Key: archiveObjectKey(job), UploadId: job.uploadId, MultipartUpload: { Parts: job.parts } }), operationOptions());
        return await finish();
      }
    }
    delete job.lease;
    await saveJob(job, etag);
    return job;
  } catch (error) {
    // The upload may have completed immediately before a lost response. The
    // exact expected byte count makes that retry recoverable.
    if (job.phase === "building" && isMissing(error)) {
      try { return await finish(); } catch { /* Resume from the last checkpoint. */ }
    }
    const latest = await readArchiveJob(id);
    job = latest.job; etag = latest.etag;
    if (job.lease?.id === leaseId) {
      delete job.lease;
      if (error instanceof DownloadError && [410, 413].includes(error.status)) { job.phase = "failed"; job.error = error.message; }
      await saveJob(job, etag);
    }
    throw error;
  }
}

/** Only this feature's temporary artifacts are cleaned. Work stays available
 * for 48 hours; the next ZIP request removes expired artifacts in small batches. */
export async function cleanupExpiredArchiveJobs() {
  const client = createR2Client(); const Bucket = getR2Env().bucket;
  const list = await client.send(new ListObjectsV2Command({ Bucket, Prefix: `${PREFIX}jobs/`, MaxKeys: 32 }), operationOptions());
  const stale = (list.Contents ?? []).filter(item => item.Key && item.LastModified && item.LastModified.getTime() < Date.now() - RETENTION_MS).slice(0, 8);
  for (const item of stale) {
    const id = item.Key!.slice(`${PREFIX}jobs/`.length, -4);
    if (!JOB_ID.test(id)) continue;
    const { job } = await readArchiveJob(id);
    if (job.expiresAt > Date.now() || (job.lease && job.lease.until > Date.now())) continue;
    if (job.uploadId && job.phase !== "ready") {
      try { await client.send(new AbortMultipartUploadCommand({ Bucket, Key: archiveObjectKey(job), UploadId: job.uploadId }), operationOptions()); }
      catch (error) { if (!isMissing(error)) throw error; }
    }
    await client.send(new DeleteObjectCommand({ Bucket, Key: archiveObjectKey(job) }), operationOptions());
    await client.send(new DeleteObjectCommand({ Bucket, Key: stateKey(id) }), operationOptions());
  }
}
