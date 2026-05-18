import { NextResponse } from "next/server";
import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { objectKeyFromPublicUrl } from "@/lib/r2";

const zipSchema = z.object({
  album_id: z.string().uuid(),
  download_zip_url: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = zipSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ZIP request" }, { status: 400 });
  }

  const payload = parsed.data;
  const supabase = await getVerifiedAdminApiClient();

  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: currentAlbum } = await supabase
    .from("albums")
    .select("id, slug")
    .eq("id", payload.album_id)
    .maybeSingle();

  if (!currentAlbum) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const zipObjectKey = objectKeyFromPublicUrl(payload.download_zip_url);

  if (!zipObjectKey.startsWith(`albums/${currentAlbum.slug}/zip/`)) {
    return NextResponse.json({ error: "ZIP file does not match album" }, { status: 400 });
  }

  const { data: album, error } = await supabase
    .from("albums")
    .update({ download_zip_url: payload.download_zip_url })
    .eq("id", payload.album_id)
    .select("id, download_zip_url")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ album });
}
