import { cookies } from "next/headers";
import { adminEmailAllowlist, isAdminEmailAllowed } from "@/lib/admin-auth";
import { getGalleryAccessForCookies, type AccessAlbum } from "@/lib/gallery-security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { noStoreJson } from "@/lib/http";

export class DownloadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function checkDownloadOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    throw new DownloadError("Open this download from the gallery.", 403);
  }
}

export async function authorizeAlbumDownload(albumId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("albums")
    .select("id,client_id,title,slug,is_public,is_password_protected,password_hash,requires_email,allow_client_password_access,expires_at,download_zip_url")
    .eq("id", albumId).maybeSingle();
  if (error) throw new DownloadError("Gallery access could not be checked. Please retry.", 503);
  if (!data) throw new DownloadError("Gallery not found.", 404);
  const album = data as AccessAlbum & { title: string; slug: string; expires_at: string | null; download_zip_url: string | null };
  if (album.expires_at && (!Number.isFinite(Date.parse(album.expires_at)) || Date.parse(album.expires_at) <= Date.now())) {
    throw new DownloadError("This gallery has expired. Contact the studio to reopen it.", 410);
  }
  const viewer = await createSupabaseServerClient();
  const { data: { user } } = await viewer.auth.getUser();
  const access = await getGalleryAccessForCookies({ supabase, album, cookieStore: await cookies(),
    adminBypass: Boolean(user?.email && adminEmailAllowlist().length && isAdminEmailAllowed(user.email)) });
  if (!access.canAccess) throw new DownloadError("Unlock this gallery before downloading photos.", 403);
  return { supabase, album, clientEmail: access.clientEmail };
}

export function downloadErrorResponse(error: unknown) {
  if (error instanceof DownloadError) return noStoreJson({ error: error.message }, { status: error.status });
  console.error("Gallery download operation failed", error instanceof Error ? error.name : "UnknownError");
  return noStoreJson({ error: "The download could not be prepared. Please retry." }, { status: 503 });
}
