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

const previewSchema = z.object({
  album_id: z.string().uuid(),
  photo_id: z.string().uuid()
});

export async function POST(request: Request) {
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preview request" }, { status: 400 });
  }

  const payload = parsed.data;
  const viewerSupabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await viewerSupabase.auth.getUser();
  const supabase = createSupabaseAdminClient();
  const { data: albumData } = await supabase
    .from("albums")
    .select(
      "id, is_public, is_password_protected, password_hash, requires_email, allow_client_password_access"
    )
    .eq("id", payload.album_id)
    .maybeSingle();
  const album = albumData as AccessAlbum | null;

  if (!album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
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

  const { data: photo } = await supabase
    .from("photos")
    .select("id, album_id, preview_url")
    .eq("id", payload.photo_id)
    .eq("album_id", payload.album_id)
    .maybeSingle();

  if (!photo?.preview_url) {
    return NextResponse.json({ error: "Preview not found" }, { status: 404 });
  }

  const previewKey = objectKeyFromPublicUrl(photo.preview_url);
  const url = await createDownloadUrl(previewKey);

  return NextResponse.json({ url });
}
