import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { noStoreJson } from "@/lib/http";
import { objectKeyFromPublicUrl } from "@/lib/r2";

const zipSchema = z.object({
  album_id: z.string().uuid(),
  download_zip_url: z.string().min(1)
});

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
    .select("id, slug")
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
    .select("id, download_zip_url")
    .single();

  if (error) {
    return noStoreJson({ error: "ZIP link could not be saved." }, { status: 400 });
  }

  return noStoreJson({ album });
}
