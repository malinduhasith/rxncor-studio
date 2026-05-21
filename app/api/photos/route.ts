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
  r2_object_key: z.string().min(1)
});

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

  const { data: album } = await supabase
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

  const { data: existingPhoto, error: existingPhotoError } = await supabase
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

  const photoPayload = {
    ...payload,
    uploaded_at: new Date().toISOString()
  };

  const writeQuery = existingPhoto
    ? supabase.from("photos").update(photoPayload).eq("id", existingPhoto.id)
    : supabase.from("photos").insert(payload);

  const { data: photo, error } = await writeQuery
    .select()
    .single();

  if (error) {
    return noStoreJson({ error: "Photo record could not be saved." }, { status: 400 });
  }

  if (!album.cover_photo_url) {
    await supabase
      .from("albums")
      .update({ cover_photo_url: payload.preview_url })
      .eq("id", payload.album_id);
  }

  return noStoreJson({ photo });
}
