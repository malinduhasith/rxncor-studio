import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const zipSchema = z.object({
  album_id: z.string().uuid(),
  download_zip_url: z.string().min(1)
});

export async function POST(request: Request) {
  const payload = zipSchema.parse(await request.json());
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
