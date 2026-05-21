import { cookies } from "next/headers";
import { z } from "zod";
import {
  albumRequiresUnlock,
  getGalleryAccessForCookies,
  type AccessAlbum
} from "@/lib/gallery-security";
import { noStoreJson } from "@/lib/http";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
import { checkRateLimit, clientIpFromHeaders, rateLimitHeaders } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const downloadSchema = z.object({
  album_id: z.string().uuid(),
  photo_id: z.string().uuid().optional(),
  r2_object_key: z.string().min(1),
  client_email: z.string().email().optional()
});

export async function POST(request: Request) {
  const parsed = downloadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return noStoreJson({ error: "Invalid download request" }, { status: 400 });
  }

  const payload = parsed.data;
  const viewerSupabase = await createSupabaseServerClient();
  const ipAddress = clientIpFromHeaders(request.headers);
  const ipLimit = checkRateLimit(`download:ip:${ipAddress}`, {
    limit: 180,
    windowMs: 60 * 1000
  });
  const albumLimit = checkRateLimit(`download:${ipAddress}:${payload.album_id}`, {
    limit: 80,
    windowMs: 60 * 1000
  });

  if (!ipLimit.allowed || !albumLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfter, albumLimit.retryAfter);

    return noStoreJson(
      { error: "Too many download requests" },
      { status: 429, headers: rateLimitHeaders(retryAfter) }
    );
  }

  const {
    data: { user }
  } = await viewerSupabase.auth.getUser();
  const supabase = createSupabaseAdminClient();
  const { data: albumData } = await supabase
    .from("albums")
    .select(
      "id, is_public, is_password_protected, password_hash, requires_email, allow_client_password_access, download_zip_url"
    )
    .eq("id", payload.album_id)
    .maybeSingle();
  const album = albumData as (AccessAlbum & {
    download_zip_url: string | null;
    is_public: boolean;
  }) | null;

  if (!album) {
    return noStoreJson({ error: "Album not found" }, { status: 404 });
  }

  let verifiedObjectKey: string | null = null;
  let downloadFilename = "download";

  if (payload.photo_id) {
    const { data: photo } = await supabase
      .from("photos")
      .select("id, album_id, filename, r2_object_key")
      .eq("id", payload.photo_id)
      .eq("album_id", payload.album_id)
      .maybeSingle();

    if (photo?.r2_object_key === payload.r2_object_key) {
      verifiedObjectKey = photo.r2_object_key;
      downloadFilename = photo.filename;
    }
  } else if (album.download_zip_url) {
    const zipObjectKey = objectKeyFromPublicUrl(album.download_zip_url);

    if (zipObjectKey === payload.r2_object_key) {
      verifiedObjectKey = zipObjectKey;
      downloadFilename = zipObjectKey.split("/").pop() ?? "album.zip";
    }
  }

  if (!verifiedObjectKey) {
    return noStoreJson({ error: "Download file not found" }, { status: 404 });
  }

  const galleryAccess = await getGalleryAccessForCookies({
    supabase,
    album,
    cookieStore: await cookies(),
    adminBypass: Boolean(user)
  });

  if (albumRequiresUnlock(album) && !galleryAccess.canAccess && !user) {
    return noStoreJson({ error: "Forbidden" }, { status: 403 });
  }

  await supabase.from("download_logs").insert({
    album_id: payload.album_id,
    photo_id: payload.photo_id ?? null,
    client_email: galleryAccess.clientEmail,
    ip_address: ipAddress === "unknown" ? null : ipAddress
  });

  const url = await createDownloadUrl(verifiedObjectKey, downloadFilename);

  return noStoreJson({ url });
}
