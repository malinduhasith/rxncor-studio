import { NextResponse } from "next/server";
import { z } from "zod";
import { createDownloadUrl } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const downloadSchema = z.object({
  album_id: z.string().uuid(),
  photo_id: z.string().uuid().optional(),
  r2_object_key: z.string().min(1),
  client_email: z.string().email().optional()
});

export async function POST(request: Request) {
  const payload = downloadSchema.parse(await request.json());
  const supabase = await createSupabaseServerClient();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null;

  await supabase.from("download_logs").insert({
    album_id: payload.album_id,
    photo_id: payload.photo_id ?? null,
    client_email: payload.client_email ?? null,
    ip_address: ipAddress
  });

  const url = await createDownloadUrl(payload.r2_object_key);

  return NextResponse.json({ url });
}
