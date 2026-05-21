import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { noStoreJson } from "@/lib/http";
import { albumObjectKey, createUploadUrl, publicR2Url } from "@/lib/r2";

const uploadSchema = z.object({
  albumId: z.string().uuid(),
  kind: z.enum(["thumbnails", "previews", "full", "zip"]),
  filename: z.string().min(1),
  contentType: z.string().min(1).default("application/octet-stream")
});

function safeFilename(filename: string) {
  const cleaned = filename
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return cleaned || `upload-${Date.now()}`;
}

function allowedContentType(kind: z.infer<typeof uploadSchema>["kind"], contentType: string) {
  const normalized = contentType.toLowerCase();

  if (kind === "zip") {
    return ["application/zip", "application/x-zip-compressed", "application/octet-stream"].includes(
      normalized
    );
  }

  if (kind === "full") {
    return ["image/jpeg", "image/jpg", "image/webp", "image/png"].includes(normalized);
  }

  return ["image/webp", "image/jpeg", "image/jpg", "image/png"].includes(normalized);
}

export async function POST(request: Request) {
  const parsed = uploadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return noStoreJson({ error: "Invalid upload request" }, { status: 400 });
  }

  const payload = parsed.data;
  const supabase = await getVerifiedAdminApiClient();

  if (!supabase) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  if (!allowedContentType(payload.kind, payload.contentType)) {
    return noStoreJson({ error: "File type is not allowed" }, { status: 400 });
  }

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("id, slug")
    .eq("id", payload.albumId)
    .single();

  if (albumError || !album) {
    return noStoreJson({ error: "Album not found" }, { status: 404 });
  }

  const filename = safeFilename(payload.filename);
  const key = albumObjectKey(album.slug, payload.kind, filename);
  const uploadUrl = await createUploadUrl(key, payload.contentType);

  return noStoreJson({
    key,
    uploadUrl,
    publicUrl: publicR2Url(key)
  });
}
