import { z } from "zod";
import { authorizeAlbumDownload, checkDownloadOrigin, DownloadError, downloadErrorResponse } from "@/lib/download-access";
import { noStoreJson } from "@/lib/http";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
import { checkRateLimit, clientIpFromHeaders, rateLimitHeaders } from "@/lib/rate-limit";

const previewSchema = z.object({ album_id: z.string().uuid(), photo_id: z.string().uuid() });

export async function POST(request: Request) {
  try {
    checkDownloadOrigin(request);
    const parsed = previewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DownloadError("Invalid preview request.");
    const ip = clientIpFromHeaders(request.headers);
    const limit = checkRateLimit(`preview:ip:${ip}`, { limit: 240, windowMs: 60_000 });
    if (!limit.allowed) return noStoreJson({ error: "Too many preview requests." }, { status: 429, headers: rateLimitHeaders(limit.retryAfter) });
    const { supabase } = await authorizeAlbumDownload(parsed.data.album_id);
    const { data: photo, error } = await supabase.from("photos").select("preview_url")
      .eq("id", parsed.data.photo_id).eq("album_id", parsed.data.album_id).maybeSingle();
    if (error) throw new DownloadError("The preview could not be checked. Please retry.", 503);
    if (!photo?.preview_url) throw new DownloadError("Preview not found.", 404);
    return noStoreJson({ url: await createDownloadUrl(objectKeyFromPublicUrl(photo.preview_url)) });
  } catch (error) { return downloadErrorResponse(error); }
}
