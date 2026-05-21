import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { noStoreJson } from "@/lib/http";
import { deleteR2Object } from "@/lib/r2";

const cleanupSchema = z.object({
  keys: z.array(z.string().min(1)).min(1).max(25)
});

export async function POST(request: Request) {
  const parsed = cleanupSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return noStoreJson({ error: "Invalid cleanup request." }, { status: 400 });
  }

  if (!(await getVerifiedAdminApiClient())) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const keys = [...new Set(parsed.data.keys)].filter((key) =>
    key.startsWith("albums/")
  );

  if (!keys.length) {
    return noStoreJson({ deleted: 0, failed: 0 });
  }

  const results = await Promise.allSettled(keys.map((key) => deleteR2Object(key)));
  const deleted = results.filter((result) => result.status === "fulfilled").length;

  return noStoreJson({
    deleted,
    failed: results.length - deleted
  });
}
