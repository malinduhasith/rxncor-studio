import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { noStoreJson } from "@/lib/http";

const existingUploadSchema = z.object({
  album_id: z.string().uuid()
});

export async function POST(request: Request) {
  const parsed = existingUploadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return noStoreJson({ error: "Invalid existing upload request." }, { status: 400 });
  }

  const supabase = await getVerifiedAdminApiClient();

  if (!supabase) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("photos")
    .select("id, filename, r2_object_key, uploaded_at")
    .eq("album_id", parsed.data.album_id)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return noStoreJson(
      { error: "Existing album photos could not be checked." },
      { status: 400 }
    );
  }

  return noStoreJson({ photos: data ?? [] });
}
