import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { noStoreJson } from "@/lib/http";

const uploadEventSchema = z.object({
  album_id: z.string().uuid().optional(),
  photo_id: z.string().uuid().optional(),
  filename: z.string().trim().max(240).optional(),
  event_type: z.enum(["photo", "zip", "diagnostic", "cleanup"]).default("photo"),
  status: z.enum(["success", "failed", "partial"]),
  message: z.string().trim().max(1000).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  duration_ms: z.number().int().nonnegative().optional()
});

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export async function POST(request: Request) {
  const parsed = uploadEventSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return noStoreJson({ error: "Invalid upload event." }, { status: 400 });
  }

  const supabase = await getVerifiedAdminApiClient();

  if (!supabase) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = parsed.data;
  const { error } = await supabase.from("upload_events").insert({
    album_id: payload.album_id,
    photo_id: payload.photo_id,
    filename: payload.filename,
    event_type: payload.event_type,
    status: payload.status,
    message: payload.message,
    size_bytes: payload.size_bytes ?? 0,
    duration_ms: payload.duration_ms,
    ip_address: requestIp(request)
  });

  if (error) {
    return noStoreJson({ error: "Upload event could not be saved." }, { status: 400 });
  }

  return noStoreJson({ ok: true });
}
