import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const albumSchema = z.object({
  client_id: z.string().uuid().optional(),
  title: z.string().min(1),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  event_date: z.string().optional(),
  is_public: z.boolean().default(false),
  is_password_protected: z.boolean().default(true),
  password_hash: z.string().optional(),
  cover_photo_url: z.string().url().optional(),
  expires_at: z.string().optional()
});

export async function POST(request: Request) {
  const payload = albumSchema.parse(await request.json());
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("albums").insert(payload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ album: data });
}
