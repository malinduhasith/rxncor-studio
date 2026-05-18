"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAlbumAccessToken, albumAccessCookieName } from "@/lib/gallery-access";
import { verifyPassword } from "@/lib/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const unlockSchema = z.object({
  album_id: z.string().uuid(),
  slug: z.string().min(1),
  password: z.string().min(1)
});

export async function unlockGalleryAction(formData: FormData) {
  const payload = unlockSchema.safeParse({
    album_id: formData.get("album_id"),
    slug: formData.get("slug"),
    password: formData.get("password")
  });

  if (!payload.success) {
    redirect("/albums");
  }

  const supabase = createSupabaseAdminClient();
  const { data: album } = await supabase
    .from("albums")
    .select("id, slug, password_hash")
    .eq("id", payload.data.album_id)
    .eq("slug", payload.data.slug)
    .maybeSingle();

  if (
    !album ||
    !album.password_hash ||
    !verifyPassword(payload.data.password, album.password_hash)
  ) {
    redirect(`/client/${payload.data.slug}?notice=wrong-password`);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    albumAccessCookieName(album.id),
    createAlbumAccessToken(album.id, album.password_hash),
    {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 14,
      path: `/client/${album.slug}`,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  );

  redirect(`/client/${album.slug}`);
}
