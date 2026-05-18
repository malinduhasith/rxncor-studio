"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  albumAccessCookieName,
  albumClientEmailCookieName,
  createAlbumAccessToken,
  createEmailAccessToken
} from "@/lib/gallery-access";
import { verifyPassword } from "@/lib/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const unlockSchema = z.object({
  album_id: z.string().uuid(),
  slug: z.string().min(1),
  client_email: z.string().trim().email().optional().or(z.literal("")),
  password: z.string().optional().or(z.literal(""))
});

type UnlockAlbum = {
  id: string;
  slug: string;
  password_hash?: string | null;
  is_password_protected?: boolean;
  requires_email?: boolean;
  allow_client_password_access?: boolean;
};

type UnlockClient = {
  id: string;
  email: string | null;
  password_hash?: string | null;
};

export async function unlockGalleryAction(formData: FormData) {
  const payload = unlockSchema.safeParse({
    album_id: formData.get("album_id"),
    slug: formData.get("slug"),
    client_email: formData.get("client_email"),
    password: formData.get("password")
  });

  if (!payload.success) {
    redirect("/albums");
  }

  const supabase = createSupabaseAdminClient();
  const { data: album } = await supabase
    .from("albums")
    .select("*")
    .eq("id", payload.data.album_id)
    .eq("slug", payload.data.slug)
    .maybeSingle();
  const unlockAlbum = album as UnlockAlbum | null;
  const email = String(payload.data.client_email ?? "").trim().toLowerCase();
  const password = String(payload.data.password ?? "").trim();
  let accessToken: string | null = null;

  if (!unlockAlbum) {
    redirect(`/client/${payload.data.slug}?notice=wrong-password`);
  }

  if (unlockAlbum.requires_email && !email) {
    redirect(`/client/${payload.data.slug}?notice=email-required`);
  }

  if (
    unlockAlbum.password_hash &&
    password &&
    verifyPassword(password, unlockAlbum.password_hash)
  ) {
    accessToken = createAlbumAccessToken(unlockAlbum.id, unlockAlbum.password_hash);
  }

  if (
    !accessToken &&
    email &&
    password &&
    unlockAlbum.allow_client_password_access !== false
  ) {
    const { data: assignments } = await supabase
      .from("album_clients")
      .select("client_id")
      .eq("album_id", unlockAlbum.id);
    const assignedClientIds = (assignments ?? []).map((row) => row.client_id);
    const { data: clients } = await supabase
      .from("clients")
      .select("id, email, password_hash")
      .ilike("email", email)
      .limit(2);
    const matchingClients = (clients ?? []) as UnlockClient[];
    const unlockClient = matchingClients[0] ?? null;

    if (!unlockClient) {
      redirect(`/client/${payload.data.slug}?notice=client-not-found`);
    }

    if (matchingClients.length > 1) {
      redirect(`/client/${payload.data.slug}?notice=duplicate-client`);
    }

    if (!unlockClient.password_hash) {
      redirect(`/client/${payload.data.slug}?notice=client-no-password`);
    }

    if (!verifyPassword(password, unlockClient.password_hash)) {
      redirect(`/client/${payload.data.slug}?notice=wrong-password`);
    }

    if (!assignedClientIds.includes(unlockClient.id)) {
      redirect(`/client/${payload.data.slug}?notice=client-not-assigned`);
    }

    if (unlockClient.password_hash) {
      accessToken = createAlbumAccessToken(
        unlockAlbum.id,
        `client:${unlockClient.id}:${unlockClient.password_hash}`
      );
    }
  }

  if (!accessToken && email && unlockAlbum.requires_email && !unlockAlbum.is_password_protected) {
    accessToken = createEmailAccessToken(unlockAlbum.id, email);
  }

  if (!accessToken) {
    redirect(`/client/${payload.data.slug}?notice=wrong-password`);
  }

  const cookieStore = await cookies();
  cookieStore.set(albumAccessCookieName(unlockAlbum.id), accessToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  if (email) {
    cookieStore.set(albumClientEmailCookieName(unlockAlbum.id), email, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
  }

  redirect(`/client/${unlockAlbum.slug}`);
}
