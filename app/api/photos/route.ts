import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { noStoreJson } from "@/lib/http";
import { objectKeyFromPublicUrl } from "@/lib/r2";

const photoSchema = z.object({
  album_id: z.string().uuid(),
  filename: z.string().min(1),
  thumbnail_url: z.string().min(1),
  preview_url: z.string().min(1),
  full_res_url: z.string().min(1),
  r2_object_key: z.string().min(1),
  display_title: z.string().trim().max(120).optional(),
  caption: z.string().trim().max(240).optional(),
  camera_model: z.string().trim().max(120).optional(),
  lens_model: z.string().trim().max(160).optional(),
  focal_length: z.string().trim().max(40).optional(),
  aperture: z.string().trim().max(40).optional(),
  shutter_speed: z.string().trim().max(40).optional(),
  iso: z.string().trim().max(40).optional(),
  captured_at: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  thumbnail_size_bytes: z.number().int().nonnegative().optional(),
  preview_size_bytes: z.number().int().nonnegative().optional(),
  full_size_bytes: z.number().int().nonnegative().optional(),
  file_size_bytes: z.number().int().nonnegative().optional(),
  generated_thumbnail: z.boolean().optional(),
  generated_preview: z.boolean().optional(),
  upload_duration_ms: z.number().int().nonnegative().optional()
});

function optionalText(value: string | undefined) {
  return value?.trim() || undefined;
}

function optionalNumber(value: number | undefined) {
  return typeof value === "number" ? value : undefined;
}

function cleanPayload(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  );
}

function schemaColumnError(error: { message?: string; code?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("column")
  );
}

function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

export async function POST(request: Request) {
  const parsed = photoSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return noStoreJson({ error: "Invalid photo request." }, { status: 400 });
  }

  const payload = parsed.data;
  const supabase = await getVerifiedAdminApiClient();

  if (!supabase) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }
  const adminSupabase = supabase;

  const { data: album } = await adminSupabase
    .from("albums")
    .select("id, slug, cover_photo_url")
    .eq("id", payload.album_id)
    .maybeSingle();

  if (!album) {
    return noStoreJson({ error: "Album not found." }, { status: 404 });
  }

  const albumPrefix = `albums/${album.slug}/`;
  const uploadKeys = [
    objectKeyFromPublicUrl(payload.thumbnail_url),
    objectKeyFromPublicUrl(payload.preview_url),
    objectKeyFromPublicUrl(payload.full_res_url),
    payload.r2_object_key
  ];

  if (!uploadKeys.every((key) => key.startsWith(albumPrefix))) {
    return noStoreJson(
      { error: "Photo files do not match this album." },
      { status: 400 }
    );
  }

  const { data: existingPhoto, error: existingPhotoError } = await adminSupabase
    .from("photos")
    .select("id")
    .eq("album_id", payload.album_id)
    .eq("filename", payload.filename)
    .maybeSingle();

  if (existingPhotoError) {
    return noStoreJson(
      { error: "Photo filename could not be checked." },
      { status: 400 }
    );
  }

  const basePhotoPayload = {
    album_id: payload.album_id,
    filename: payload.filename,
    thumbnail_url: payload.thumbnail_url,
    preview_url: payload.preview_url,
    full_res_url: payload.full_res_url,
    r2_object_key: payload.r2_object_key,
    uploaded_at: new Date().toISOString()
  };
  const optionalPhotoPayload = cleanPayload({
    display_title: optionalText(payload.display_title),
    caption: optionalText(payload.caption),
    camera_model: optionalText(payload.camera_model),
    lens_model: optionalText(payload.lens_model),
    focal_length: optionalText(payload.focal_length),
    aperture: optionalText(payload.aperture),
    shutter_speed: optionalText(payload.shutter_speed),
    iso: optionalText(payload.iso),
    captured_at: optionalText(payload.captured_at),
    location: optionalText(payload.location),
    thumbnail_size_bytes: optionalNumber(payload.thumbnail_size_bytes),
    preview_size_bytes: optionalNumber(payload.preview_size_bytes),
    full_size_bytes: optionalNumber(payload.full_size_bytes),
    file_size_bytes: optionalNumber(payload.file_size_bytes),
    generated_thumbnail: payload.generated_thumbnail,
    generated_preview: payload.generated_preview
  });
  const photoPayload = {
    ...basePhotoPayload,
    ...optionalPhotoPayload
  };

  async function writePhoto(record: Record<string, unknown>) {
    const writeQuery = existingPhoto
      ? adminSupabase.from("photos").update(record).eq("id", existingPhoto.id)
      : adminSupabase.from("photos").insert(record);

    return writeQuery.select().single();
  }

  let { data: photo, error } = await writePhoto(photoPayload);

  if (error && Object.keys(optionalPhotoPayload).length && schemaColumnError(error)) {
    const fallbackResult = await writePhoto(basePhotoPayload);
    photo = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    return noStoreJson({ error: "Photo record could not be saved." }, { status: 400 });
  }

  if (!album.cover_photo_url) {
    await adminSupabase
      .from("albums")
      .update({ cover_photo_url: payload.preview_url })
      .eq("id", payload.album_id);
  }

  try {
    await adminSupabase.from("upload_events").insert({
      album_id: payload.album_id,
      photo_id: photo.id,
      filename: payload.filename,
      event_type: "photo",
      status: "success",
      message:
        payload.generated_thumbnail || payload.generated_preview
          ? "Uploaded with browser-generated delivery images."
          : "Uploaded with supplied delivery images.",
      size_bytes:
        payload.file_size_bytes ??
        (payload.thumbnail_size_bytes ?? 0) +
          (payload.preview_size_bytes ?? 0) +
          (payload.full_size_bytes ?? 0),
      duration_ms: payload.upload_duration_ms,
      ip_address: requestIp(request)
    });
  } catch {
    // Monitoring should never block a finished client upload.
  }

  return noStoreJson({ photo });
}
