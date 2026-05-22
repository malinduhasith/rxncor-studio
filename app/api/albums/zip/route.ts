import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { sendGalleryUpdateEmails, sendZipUploadNotificationEmail } from "@/lib/email";
import { noStoreJson } from "@/lib/http";
import { objectKeyFromPublicUrl } from "@/lib/r2";
import { siteConfig } from "@/config/site";

const zipSchema = z.object({
  album_id: z.string().uuid(),
  download_zip_url: z.string().min(1),
  filename: z.string().trim().max(240).optional(),
  zip_size_bytes: z.number().int().nonnegative().optional(),
  upload_duration_ms: z.number().int().nonnegative().optional(),
  notify_clients: z.boolean().default(false)
});

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export async function POST(request: Request) {
  const parsed = zipSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return noStoreJson({ error: "Invalid ZIP request." }, { status: 400 });
  }

  const payload = parsed.data;
  const supabase = await getVerifiedAdminApiClient();

  if (!supabase) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: currentAlbum } = await supabase
    .from("albums")
    .select("id, title, slug, is_password_protected, requires_email")
    .eq("id", payload.album_id)
    .maybeSingle();

  if (!currentAlbum) {
    return noStoreJson({ error: "Album not found." }, { status: 404 });
  }

  const zipObjectKey = objectKeyFromPublicUrl(payload.download_zip_url);

  if (!zipObjectKey.startsWith(`albums/${currentAlbum.slug}/zip/`)) {
    return noStoreJson(
      { error: "ZIP file does not match this album." },
      { status: 400 }
    );
  }

  const { data: album, error } = await supabase
    .from("albums")
    .update({ download_zip_url: payload.download_zip_url })
    .eq("id", payload.album_id)
    .select("id, title, slug, is_password_protected, requires_email, download_zip_url")
    .single();

  if (error) {
    return noStoreJson({ error: "ZIP link could not be saved." }, { status: 400 });
  }

  try {
    await supabase.from("upload_events").insert({
      album_id: payload.album_id,
      filename: payload.filename ?? zipObjectKey.split("/").pop(),
      event_type: "zip",
      status: "success",
      message: "ZIP uploaded and linked to album.",
      size_bytes: payload.zip_size_bytes ?? 0,
      duration_ms: payload.upload_duration_ms,
      ip_address: requestIp(request)
    });
  } catch {
    // Monitoring should never block a finished ZIP upload.
  }

  try {
    await sendZipUploadNotificationEmail({
      albumTitle: album.title,
      albumSlug: album.slug,
      filename: payload.filename ?? zipObjectKey.split("/").pop(),
      zipSizeBytes: payload.zip_size_bytes,
      durationMs: payload.upload_duration_ms
    });
  } catch (error) {
    console.error("ZIP upload notification failed", error);
  }

  let clientEmail = { sent: 0, failed: 0, skipped: true };

  if (payload.notify_clients) {
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
        updateKind: "zip",
        albumTitle: album.title,
        albumUrl: `${siteConfig.url}${siteConfig.routes.clientGallery}/${album.slug}`,
        photoCount: count ?? 0,
        hasZip: true,
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
        console.error("Client ZIP notification failed", error);
        return { sent: 0, failed: 1, skipped: false };
      });
    }
  }

  return noStoreJson({ album, clientEmail });
}
