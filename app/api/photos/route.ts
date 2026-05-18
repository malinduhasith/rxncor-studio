import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const photoSchema = z.object({
  album_id: z.string().uuid(),
  filename: z.string().min(1),
  thumbnail_url: z.string().min(1),
  preview_url: z.string().min(1),
  full_res_url: z.string().min(1),
  r2_object_key: z.string().min(1)
});

export async function POST(request: Request) {
  const payload = photoSchema.parse(await request.json());
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: photo, error } = await supabase
    .from("photos")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: album } = await supabase
    .from("albums")
    .select("cover_photo_url")
    .eq("id", payload.album_id)
    .single();

  if (album && !album.cover_photo_url) {
    await supabase
      .from("albums")
      .update({ cover_photo_url: payload.preview_url })
      .eq("id", payload.album_id);
  }

  return NextResponse.json({ photo });
}
