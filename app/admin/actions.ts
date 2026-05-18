"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { deleteR2Object, objectKeyFromPublicUrl } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return supabase;
}

const clientSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional()
});

const clientUpdateSchema = clientSchema.extend({
  client_id: z.string().uuid()
});

const clientIdSchema = z.object({
  client_id: z.string().uuid()
});

const albumSchema = z.object({
  client_id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(3)
    .regex(/^[a-z0-9-]+$/),
  event_date: z.string().optional().or(z.literal("")),
  is_public: z.boolean(),
  password: z.string().optional(),
  expires_at: z.string().optional().or(z.literal(""))
});

const albumUpdateSchema = albumSchema.extend({
  album_id: z.string().uuid(),
  remove_password: z.boolean()
});

const albumIdSchema = z.object({
  album_id: z.string().uuid()
});

const photoIdSchema = z.object({
  photo_id: z.string().uuid()
});

function emptyToNull(value: string | undefined) {
  return value ? value : null;
}

function uniqueKeys(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function deleteR2Objects(keys: string[]) {
  await Promise.allSettled(keys.map((key) => deleteR2Object(key)));
}

export async function createClientAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone")
  });

  if (!payload.success) {
    redirect("/admin?notice=client-error#clients");
  }

  const { error } = await supabase.from("clients").insert({
    name: payload.data.name,
    email: emptyToNull(payload.data.email),
    phone: emptyToNull(payload.data.phone)
  });

  if (error) {
    redirect("/admin?notice=client-error#clients");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=client-created#clients");
}

export async function updateClientAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = clientUpdateSchema.safeParse({
    client_id: formData.get("client_id"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone")
  });

  if (!payload.success) {
    redirect("/admin?notice=client-error#clients");
  }

  const { error } = await supabase
    .from("clients")
    .update({
      name: payload.data.name,
      email: emptyToNull(payload.data.email),
      phone: emptyToNull(payload.data.phone)
    })
    .eq("id", payload.data.client_id);

  if (error) {
    redirect("/admin?notice=client-error#clients");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=client-updated#clients");
}

export async function deleteClientAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = clientIdSchema.safeParse({
    client_id: formData.get("client_id")
  });

  if (!payload.success) {
    redirect("/admin?notice=client-error#clients");
  }

  const { error } = await supabase.from("clients").delete().eq("id", payload.data.client_id);

  if (error) {
    redirect("/admin?notice=client-error#clients");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=client-deleted#clients");
}

export async function createAlbumAction(formData: FormData) {
  const supabase = await requireAdmin();
  const rawPassword = String(formData.get("password") ?? "");
  const payload = albumSchema.safeParse({
    client_id: formData.get("client_id"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    event_date: formData.get("event_date"),
    is_public: formData.get("is_public") === "on",
    password: rawPassword,
    expires_at: formData.get("expires_at")
  });

  if (!payload.success) {
    redirect("/admin?notice=album-error#albums");
  }

  const passwordHash = rawPassword ? hashPassword(rawPassword) : null;
  const { error } = await supabase.from("albums").insert({
    client_id: emptyToNull(payload.data.client_id),
    title: payload.data.title,
    slug: payload.data.slug,
    event_date: emptyToNull(payload.data.event_date),
    is_public: payload.data.is_public,
    is_password_protected: Boolean(passwordHash),
    password_hash: passwordHash,
    expires_at: emptyToNull(payload.data.expires_at)
  });

  if (error) {
    redirect("/admin?notice=album-error#albums");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=album-created#albums");
}

export async function updateAlbumAction(formData: FormData) {
  const supabase = await requireAdmin();
  const rawPassword = String(formData.get("password") ?? "").trim();
  const payload = albumUpdateSchema.safeParse({
    album_id: formData.get("album_id"),
    client_id: formData.get("client_id"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    event_date: formData.get("event_date"),
    is_public: formData.get("is_public") === "on",
    password: rawPassword,
    remove_password: formData.get("remove_password") === "on",
    expires_at: formData.get("expires_at")
  });

  if (!payload.success) {
    redirect("/admin?notice=album-update-error#manager");
  }

  const albumUpdates: {
    client_id: string | null;
    title: string;
    slug: string;
    event_date: string | null;
    is_public: boolean;
    expires_at: string | null;
    is_password_protected?: boolean;
    password_hash?: string | null;
  } = {
    client_id: emptyToNull(payload.data.client_id),
    title: payload.data.title,
    slug: payload.data.slug,
    event_date: emptyToNull(payload.data.event_date),
    is_public: payload.data.is_public,
    expires_at: emptyToNull(payload.data.expires_at)
  };

  if (rawPassword) {
    albumUpdates.password_hash = hashPassword(rawPassword);
    albumUpdates.is_password_protected = true;
  } else if (payload.data.remove_password) {
    albumUpdates.password_hash = null;
    albumUpdates.is_password_protected = false;
  }

  const { error } = await supabase
    .from("albums")
    .update(albumUpdates)
    .eq("id", payload.data.album_id);

  if (error) {
    redirect(`/admin?notice=album-update-error&album=${payload.data.album_id}#manager`);
  }

  revalidatePath("/admin");
  revalidatePath("/albums");
  revalidatePath(`/client/${payload.data.slug}`);
  redirect(`/admin?notice=album-updated&album=${payload.data.album_id}#manager`);
}

export async function deleteAlbumAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = albumIdSchema.safeParse({
    album_id: formData.get("album_id")
  });

  if (!payload.success) {
    redirect("/admin?notice=album-delete-error#manager");
  }

  const { data: album } = await supabase
    .from("albums")
    .select("slug, download_zip_url")
    .eq("id", payload.data.album_id)
    .maybeSingle();
  const { data: photos } = await supabase
    .from("photos")
    .select("thumbnail_url, preview_url, full_res_url, r2_object_key")
    .eq("album_id", payload.data.album_id);
  const r2Keys = uniqueKeys([
    album?.download_zip_url ? objectKeyFromPublicUrl(album.download_zip_url) : null,
    ...((photos ?? []) as {
      thumbnail_url: string;
      preview_url: string;
      full_res_url: string;
      r2_object_key: string;
    }[]).flatMap((photo) => [
      objectKeyFromPublicUrl(photo.thumbnail_url),
      objectKeyFromPublicUrl(photo.preview_url),
      objectKeyFromPublicUrl(photo.full_res_url),
      photo.r2_object_key
    ])
  ]);

  await deleteR2Objects(r2Keys);

  const { error } = await supabase.from("albums").delete().eq("id", payload.data.album_id);

  if (error) {
    redirect(`/admin?notice=album-delete-error&album=${payload.data.album_id}#manager`);
  }

  if (album?.slug) {
    revalidatePath(`/client/${album.slug}`);
  }

  revalidatePath("/admin");
  revalidatePath("/albums");
  redirect("/admin?notice=album-deleted#manager");
}

export async function setCoverPhotoAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = photoIdSchema.safeParse({
    photo_id: formData.get("photo_id")
  });

  if (!payload.success) {
    redirect("/admin?notice=photo-error#manager");
  }

  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .select("album_id, preview_url")
    .eq("id", payload.data.photo_id)
    .maybeSingle();

  if (photoError || !photo) {
    redirect("/admin?notice=photo-error#manager");
  }

  const { error } = await supabase
    .from("albums")
    .update({ cover_photo_url: photo.preview_url })
    .eq("id", photo.album_id);

  if (error) {
    redirect(`/admin?notice=photo-error&album=${photo.album_id}#manager`);
  }

  revalidatePath("/admin");
  revalidatePath("/albums");
  redirect(`/admin?notice=cover-updated&album=${photo.album_id}#manager`);
}

export async function togglePhotoSelectedAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = photoIdSchema.safeParse({
    photo_id: formData.get("photo_id")
  });

  if (!payload.success) {
    redirect("/admin?notice=photo-error#manager");
  }

  const { data: photo } = await supabase
    .from("photos")
    .select("album_id, is_selected")
    .eq("id", payload.data.photo_id)
    .maybeSingle();

  if (!photo) {
    redirect("/admin?notice=photo-error#manager");
  }

  const { error } = await supabase
    .from("photos")
    .update({ is_selected: !photo.is_selected })
    .eq("id", payload.data.photo_id);

  if (error) {
    redirect(`/admin?notice=photo-error&album=${photo.album_id}#manager`);
  }

  revalidatePath("/admin");
  redirect(`/admin?notice=photo-updated&album=${photo.album_id}#manager`);
}

export async function deletePhotoAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = photoIdSchema.safeParse({
    photo_id: formData.get("photo_id")
  });

  if (!payload.success) {
    redirect("/admin?notice=photo-error#manager");
  }

  const { data: photo } = await supabase
    .from("photos")
    .select(
      "album_id, thumbnail_url, preview_url, full_res_url, r2_object_key"
    )
    .eq("id", payload.data.photo_id)
    .maybeSingle();

  if (!photo) {
    redirect("/admin?notice=photo-error#manager");
  }

  await deleteR2Objects(
    uniqueKeys([
      objectKeyFromPublicUrl(photo.thumbnail_url),
      objectKeyFromPublicUrl(photo.preview_url),
      objectKeyFromPublicUrl(photo.full_res_url),
      photo.r2_object_key
    ])
  );

  const { data: album } = await supabase
    .from("albums")
    .select("slug, cover_photo_url")
    .eq("id", photo.album_id)
    .maybeSingle();
  const { data: nextCover } = await supabase
    .from("photos")
    .select("preview_url")
    .eq("album_id", photo.album_id)
    .neq("id", payload.data.photo_id)
    .order("uploaded_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("photos")
    .delete()
    .eq("id", payload.data.photo_id);

  if (error) {
    redirect(`/admin?notice=photo-error&album=${photo.album_id}#manager`);
  }

  if (album?.cover_photo_url === photo.preview_url) {
    await supabase
      .from("albums")
      .update({ cover_photo_url: nextCover?.preview_url ?? null })
      .eq("id", photo.album_id);
  }

  if (album?.slug) {
    revalidatePath(`/client/${album.slug}`);
  }

  revalidatePath("/admin");
  revalidatePath("/albums");
  redirect(`/admin?notice=photo-deleted&album=${photo.album_id}#manager`);
}

export async function removeZipAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = albumIdSchema.safeParse({
    album_id: formData.get("album_id")
  });

  if (!payload.success) {
    redirect("/admin?notice=zip-error#uploads");
  }

  const { data: album } = await supabase
    .from("albums")
    .select("slug, download_zip_url")
    .eq("id", payload.data.album_id)
    .maybeSingle();

  if (album?.download_zip_url) {
    await deleteR2Objects([objectKeyFromPublicUrl(album.download_zip_url)]);
  }

  const { error } = await supabase
    .from("albums")
    .update({ download_zip_url: null })
    .eq("id", payload.data.album_id);

  if (error) {
    redirect(`/admin?notice=zip-error&album=${payload.data.album_id}#uploads`);
  }

  if (album?.slug) {
    revalidatePath(`/client/${album.slug}`);
  }

  revalidatePath("/admin");
  redirect(`/admin?notice=zip-removed&album=${payload.data.album_id}#manager`);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
