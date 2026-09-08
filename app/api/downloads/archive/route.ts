import { after } from "next/server";
import { z } from "zod";
import { advanceArchiveJob, archiveObjectKey, archiveProgress, cleanupExpiredArchiveJobs, createArchiveJob, parseArchiveToken, readArchiveJob, type ArchivePhotoInput } from "@/lib/archive-jobs";
import { readAlbumPhotos } from "@/lib/album-photos";
import { authorizeAlbumDownload, checkDownloadOrigin, DownloadError, downloadErrorResponse } from "@/lib/download-access";
import { noStoreJson } from "@/lib/http";
import { createDownloadUrl } from "@/lib/r2";
import { checkRateLimit, clientIpFromHeaders, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 180;
const createSchema = z.object({ album_id: z.string().uuid(), photo_ids: z.array(z.string().uuid()).min(1).optional() });
const stepSchema = z.object({ job_token: z.string().max(1024) });

export async function POST(request: Request) {
  try {
    checkDownloadOrigin(request);
    if (Number(request.headers.get("content-length")) > 2 * 1024 * 1024) throw new DownloadError("This selection is too large for one request. Use Download all for the entire album.", 413);
    const body = await request.json().catch(() => null);
    const step = stepSchema.safeParse(body);
    if (step.success) {
      const limit = checkRateLimit(`archive:step:${clientIpFromHeaders(request.headers)}`, { limit: 120, windowMs: 60_000 });
      if (!limit.allowed) return noStoreJson({ error: "Please wait a moment, then resume your ZIP." }, { status: 429, headers: rateLimitHeaders(limit.retryAfter) });
      const token = parseArchiveToken(step.data.job_token);
      await authorizeAlbumDownload(token.albumId);
      const { job } = await readArchiveJob(token.id);
      if (job.albumId !== token.albumId) throw new DownloadError("Invalid download.", 403);
      return noStoreJson(archiveProgress(await advanceArchiveJob(token.id)));
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw new DownloadError("Choose photos from this gallery to download.");
    const ip = clientIpFromHeaders(request.headers);
    const limit = checkRateLimit(`archive:create:${ip}`, { limit: 8, windowMs: 60 * 1000 });
    if (!limit.allowed) return noStoreJson({ error: "Please wait before preparing another ZIP." }, { status: 429, headers: rateLimitHeaders(limit.retryAfter) });
    const { album, supabase } = await authorizeAlbumDownload(parsed.data.album_id);
    const all = await readAlbumPhotos<ArchivePhotoInput>(supabase, album.id, "id,filename,r2_object_key");
    const selected = parsed.data.photo_ids ? new Set(parsed.data.photo_ids) : null;
    const photos = selected ? all.filter(photo => selected.has(photo.id)) : all;
    if (selected && photos.length !== selected.size) throw new DownloadError("Some selected photos are no longer in this gallery. Refresh and try again.", 409);
    if (!photos.length) throw new DownloadError("There are no photos to download.");
    const job = await createArchiveJob(album.id, album.title, photos);
    after(async () => { try { await cleanupExpiredArchiveJobs(); } catch { console.error("Temporary ZIP cleanup deferred"); } });
    return noStoreJson(archiveProgress(job), { status: 201 });
  } catch (error) { return downloadErrorResponse(error); }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = parseArchiveToken(url.searchParams.get("token") ?? "");
    const { supabase, clientEmail } = await authorizeAlbumDownload(token.albumId);
    const { job } = await readArchiveJob(token.id);
    if (job.albumId !== token.albumId) throw new DownloadError("Invalid download.", 403);
    if (url.searchParams.get("download") !== "1") return noStoreJson(archiveProgress(job));
    if (job.phase !== "ready") throw new DownloadError("Your ZIP is still being prepared.", 409);
    const currentPhotos = await readAlbumPhotos<ArchivePhotoInput>(supabase, job.albumId, "id,filename,r2_object_key");
    const currentKeys = new Map(currentPhotos.map(photo => [photo.id, photo.r2_object_key]));
    if (job.files.some(photo => currentKeys.get(photo.id) !== photo.key)) throw new DownloadError("This gallery changed. Prepare a new ZIP with the current photos.", 409);
    const location = await createDownloadUrl(archiveObjectKey(job), job.filename);
    const ip = clientIpFromHeaders(request.headers);
    await supabase.from("download_logs").insert({ album_id: job.albumId, photo_id: null, client_email: clientEmail, ip_address: ip === "unknown" ? null : ip });
    return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return downloadErrorResponse(error); }
}
