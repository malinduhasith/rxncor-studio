import { NextResponse } from "next/server";
import { z } from "zod";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { deleteR2Object } from "@/lib/r2";

const cleanupSchema = z.object({
  keys: z.array(z.string().min(1)).min(1).max(25)
});

export async function POST(request: Request) {
  const parsed = cleanupSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cleanup request" }, { status: 400 });
  }

  if (!(await getVerifiedAdminApiClient())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = [...new Set(parsed.data.keys)].filter((key) =>
    key.startsWith("albums/")
  );

  if (!keys.length) {
    return NextResponse.json({ deleted: 0, failed: 0 });
  }

  const results = await Promise.allSettled(keys.map((key) => deleteR2Object(key)));
  const deleted = results.filter((result) => result.status === "fulfilled").length;

  return NextResponse.json({
    deleted,
    failed: results.length - deleted
  });
}
