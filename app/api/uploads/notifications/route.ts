import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import {
  sendGalleryUpdateEmails,
  sendPhotoUploadNotificationEmail
} from "@/lib/email";
import { noStoreJson } from "@/lib/http";
import { siteConfig } from "@/config/site";

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
  notify_clients: z.boolean().default(false),
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
    .select(
      "id, title, slug, is_password_protected, requires_email, download_zip_url"
    )
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

  let clientEmail = { sent: 0, failed: 0, skipped: true };

  if (payload.notify_clients && payload.failed === 0 && payload.uploaded > 0) {
    const { data: assignments } = await supabase
      .from("album_clients")
      .select("client_id")
      .eq("album_id", album.id);
    const clientIds = (assignments ?? []).map((assignment) => assignment.client_id);

    if (clientIds.length) {
      const [{ data: clients }, { count }] = await Promise.all([
        supabase
          .from("clients")
          .select("name, email, password_hash")
          .in("id", clientIds),
        supabase
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("album_id", album.id)
      ]);

      clientEmail = await sendGalleryUpdateEmails({
        updateKind: "photos",
        albumTitle: album.title,
        albumUrl: `${siteConfig.url}${siteConfig.routes.clientGallery}/${album.slug}`,
        photoCount: count ?? payload.uploaded,
        uploadedCount: payload.uploaded,
        hasZip: Boolean(album.download_zip_url),
        isPasswordProtected: Boolean(album.is_password_protected),
        requiresEmail: Boolean(album.requires_email),
        clients: ((clients ?? []) as Array<{
          name: string;
          email: string | null;
          password_hash: string | null;
        }>).map((client) => ({
          name: client.name,
          email: client.email,
          hasClientPassword: Boolean(client.password_hash)
        }))
      }).catch((error: unknown) => {
        console.error("Client photo upload notification failed", error);
        return { sent: 0, failed: 1, skipped: false };
      });
    }
  }

  return noStoreJson({ ok: true, email: result, clientEmail });
}
