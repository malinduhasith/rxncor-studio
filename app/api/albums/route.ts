import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";

const albumSchema = z.object({
  client_id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().min(1),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  event_date: z.string().optional().or(z.literal("")),
  is_public: z.boolean().default(false),
  password: z.string().optional().or(z.literal("")),
  requires_email: z.boolean().default(false),
  allow_client_password_access: z.boolean().default(true),
  cover_photo_url: z.string().url().optional(),
  expires_at: z.string().optional().or(z.literal(""))
});

export async function POST(request: Request) {
  const parsed = albumSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid album request" }, { status: 400 });
  }

  const payload = parsed.data;
  const supabase = await getVerifiedAdminApiClient();

  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawPassword = String(payload.password ?? "").trim();
  const passwordHash = rawPassword ? hashPassword(rawPassword) : null;
  const { data, error } = await supabase
    .from("albums")
    .insert({
      client_id: payload.client_id || null,
      title: payload.title,
      slug: payload.slug,
      event_date: payload.event_date || null,
      is_public: payload.is_public,
      is_password_protected: Boolean(passwordHash),
      password_hash: passwordHash,
      requires_email: payload.requires_email,
      allow_client_password_access: payload.allow_client_password_access,
      cover_photo_url: payload.cover_photo_url ?? null,
      expires_at: payload.expires_at || null
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (payload.client_id) {
    const { error: assignmentError } = await supabase.from("album_clients").insert({
      album_id: data.id,
      client_id: payload.client_id
    });

    if (assignmentError) {
      await supabase.from("albums").delete().eq("id", data.id);

      return NextResponse.json({ error: assignmentError.message }, { status: 400 });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/albums");

  return NextResponse.json({ album: data });
}
