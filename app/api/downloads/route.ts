import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { getR2Env } from "@/config/server-env";
import { authorizeAlbumDownload, checkDownloadOrigin, DownloadError, downloadErrorResponse } from "@/lib/download-access";
import { noStoreJson } from "@/lib/http";
import { createDownloadUrl, createR2Client, objectKeyFromPublicUrl } from "@/lib/r2";
import { checkRateLimit, clientIpFromHeaders, rateLimitHeaders } from "@/lib/rate-limit";
import { safeDownloadName } from "@/lib/zip";

export const runtime = "nodejs";
const downloadSchema = z.object({
  album_id: z.string().uuid(), photo_id: z.string().uuid().optional(),
  r2_object_key: z.string().min(1).optional(), mode: z.enum(["download", "share"]).optional()
});

async function prepareDownload(request: Request, payload: z.infer<typeof downloadSchema>) {
  const ip = clientIpFromHeaders(request.headers);
  const limit = checkRateLimit(`download:ip:${ip}`, { limit: 180, windowMs: 60_000 });
  if (!limit.allowed) return noStoreJson({ error: "Too many download requests. Please try again shortly." },
    { status: 429, headers: rateLimitHeaders(limit.retryAfter) });
  const { supabase, album, clientEmail } = await authorizeAlbumDownload(payload.album_id);
  let key: string | null = null;
  let filename = "photos.zip";
  if (payload.photo_id) {
    const { data: photo, error } = await supabase.from("photos").select("filename,r2_object_key")
      .eq("id", payload.photo_id).eq("album_id", payload.album_id).maybeSingle();
    if (error) throw new DownloadError("The photo could not be checked. Please retry.", 503);
    if (photo && (!payload.r2_object_key || photo.r2_object_key === payload.r2_object_key)) {
      key = photo.r2_object_key; filename = safeDownloadName(photo.filename);
    }
  } else if (album.download_zip_url && payload.r2_object_key && payload.mode !== "share") {
    const legacyKey = objectKeyFromPublicUrl(album.download_zip_url);
    if (legacyKey === payload.r2_object_key) { key = legacyKey; filename = safeDownloadName(legacyKey, "photos.zip"); }
  }
  if (!key) throw new DownloadError("Download file not found.", 404);
  let metadata: { size?: number; content_type?: string } = {};
  if (payload.mode === "share") {
    const head = await createR2Client().send(new HeadObjectCommand({ Bucket: getR2Env().bucket, Key: key }),
      { abortSignal: AbortSignal.timeout(20_000) });
    if (!Number.isSafeInteger(head.ContentLength)) throw new DownloadError("The photo size could not be checked.", 503);
    metadata = { size: head.ContentLength, content_type: head.ContentType };
  }
  const url = await createDownloadUrl(key, filename);
  await supabase.from("download_logs").insert({ album_id: album.id, photo_id: payload.photo_id ?? null,
    client_email: clientEmail, ip_address: ip === "unknown" ? null : ip });
  return { url, filename, ...metadata };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = downloadSchema.safeParse({ album_id: url.searchParams.get("album_id"), photo_id: url.searchParams.get("photo_id") });
    if (!parsed.success || !parsed.data.photo_id) throw new DownloadError("Invalid download request.");
    const prepared = await prepareDownload(request, parsed.data);
    if (prepared instanceof Response) return prepared;
    return new Response(null, { status: 302, headers: { Location: prepared.url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return downloadErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    checkDownloadOrigin(request);
    const parsed = downloadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DownloadError("Invalid download request.");
    const prepared = await prepareDownload(request, parsed.data);
    return prepared instanceof Response ? prepared : noStoreJson(prepared);
  } catch (error) { return downloadErrorResponse(error); }
}
