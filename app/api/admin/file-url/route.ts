import { NextResponse } from "next/server";
import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { createDownloadUrl, objectKeyFromPublicUrl } from "@/lib/r2";

const fileUrlSchema = z.object({
  album_id: z.string().uuid(),
  photo_id: z.string().uuid(),
  kind: z.enum(["preview", "full"])
});

export async function POST(request: Request) {
  const parsed = fileUrlSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid file link request" }, { status: 400 });
  }

  const payload = parsed.data;
  const supabase = await getVerifiedAdminApiClient();

  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: photo } = await supabase
    .from("photos")
    .select("id, album_id, filename, preview_url, r2_object_key")
    .eq("id", payload.photo_id)
    .eq("album_id", payload.album_id)
    .maybeSingle();

  if (!photo) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const key =
    payload.kind === "preview"
      ? objectKeyFromPublicUrl(photo.preview_url)
      : photo.r2_object_key;
  const url = await createDownloadUrl(
    key,
    payload.kind === "full" ? photo.filename : undefined
  );

  return NextResponse.json({ url });
}
