import { NextResponse } from "next/server";
import { z } from "zod";
import { albumObjectKey, createUploadUrl, publicR2Url } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uploadSchema = z.object({
  albumId: z.string().uuid(),
  kind: z.enum(["thumbnails", "previews", "full", "zip"]),
  filename: z.string().min(1),
  contentType: z.string().min(1).default("application/octet-stream")
});

function safeFilename(filename: string) {
  const cleaned = filename
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return cleaned || `upload-${Date.now()}`;
}

export async function POST(request: Request) {
  const payload = uploadSchema.parse(await request.json());
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("id, slug")
    .eq("id", payload.albumId)
    .single();

  if (albumError || !album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const filename = safeFilename(payload.filename);
  const key = albumObjectKey(album.slug, payload.kind, filename);
  const uploadUrl = await createUploadUrl(key, payload.contentType);

  return NextResponse.json({
    key,
    uploadUrl,
    publicUrl: publicR2Url(key)
  });
}
