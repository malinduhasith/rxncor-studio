import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { sendPhotoUploadNotificationEmail } from "@/lib/email";
import { noStoreJson } from "@/lib/http";

const failedFileSchema = z.object({
  filename: z.string().trim().min(1).max(240),
  message: z.string().trim().min(1).max(500)
});

const uploadNotificationSchema = z.object({
  type: z.literal("photo-batch"),
  album_id: z.string().uuid(),
  total: z.number().int().nonnegative(),
  uploaded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative().default(0),
  generated_thumbnails: z.number().int().nonnegative(),
  generated_previews: z.number().int().nonnegative(),
  total_size_bytes: z.number().int().nonnegative().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  failed_files: z.array(failedFileSchema).max(10).optional()
});

export async function POST(request: Request) {
  const parsed = uploadNotificationSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return noStoreJson({ error: "Invalid upload notification." }, { status: 400 });
  }

  const supabase = await getVerifiedAdminApiClient();

  if (!supabase) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = parsed.data;
  const { data: album } = await supabase
    .from("albums")
    .select("title, slug")
    .eq("id", payload.album_id)
    .maybeSingle();

  if (!album) {
    return noStoreJson({ error: "Album not found." }, { status: 404 });
  }

  const result = await sendPhotoUploadNotificationEmail({
    albumTitle: album.title,
    albumSlug: album.slug,
    total: payload.total,
    uploaded: payload.uploaded,
    failed: payload.failed,
    skipped: payload.skipped,
    generatedThumbnails: payload.generated_thumbnails,
    generatedPreviews: payload.generated_previews,
    totalSizeBytes: payload.total_size_bytes,
    durationMs: payload.duration_ms,
    failedFiles: payload.failed_files
  }).catch((error: unknown) => {
    console.error("Photo upload notification failed", error);
    return { sent: 0, failed: 1, skipped: false };
  });

  return noStoreJson({ ok: true, email: result });
}
