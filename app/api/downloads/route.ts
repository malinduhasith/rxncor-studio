import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  albumRequiresUnlock,
  getGalleryAccessForCookies,
  type AccessAlbum
} from "@/lib/gallery-security";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";
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
    return NextResponse.json({ error: "Invalid download request" }, { status: 400 });
  }

  const payload = parsed.data;
  const viewerSupabase = await createSupabaseServerClient();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null;
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
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  let verifiedObjectKey: string | null = null;

  if (payload.photo_id) {
    const { data: photo } = await supabase
      .from("photos")
      .select("id, album_id, r2_object_key")
      .eq("id", payload.photo_id)
      .eq("album_id", payload.album_id)
      .maybeSingle();

    if (photo?.r2_object_key === payload.r2_object_key) {
      verifiedObjectKey = photo.r2_object_key;
    }
  } else if (album.download_zip_url) {
    const zipObjectKey = objectKeyFromPublicUrl(album.download_zip_url);

    if (zipObjectKey === payload.r2_object_key) {
      verifiedObjectKey = zipObjectKey;
    }
  }

  if (!verifiedObjectKey) {
    return NextResponse.json({ error: "Download file not found" }, { status: 404 });
  }

  const galleryAccess = await getGalleryAccessForCookies({
    supabase,
    album,
    cookieStore: await cookies(),
    adminBypass: Boolean(user)
  });

  if (albumRequiresUnlock(album) && !galleryAccess.canAccess && !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabase.from("download_logs").insert({
    album_id: payload.album_id,
    photo_id: payload.photo_id ?? null,
    client_email: galleryAccess.clientEmail,
    ip_address: ipAddress
  });

  const url = await createDownloadUrl(verifiedObjectKey);

  return NextResponse.json({ url });
}
