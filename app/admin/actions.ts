"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { hashPassword, verifyPassword } from "@/lib/password";
import { deleteR2Object, objectKeyFromPublicUrl } from "@/lib/r2";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminSupabaseClient = Awaited<ReturnType<typeof requireAdmin>>;

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(siteConfig.routes.adminLogin);
  }

  return createSupabaseAdminClient();
}

const clientSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  password: z.string().optional()
});

const clientUpdateSchema = clientSchema.extend({
  client_id: z.string().uuid(),
  remove_password: z.boolean()
});

const clientPasswordResetSchema = z.object({
  client_id: z.string().uuid(),
  password: z.string().trim().min(4)
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
  requires_email: z.boolean(),
  allow_client_password_access: z.boolean(),
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

const inquiryStatusSchema = z.object({
  inquiry_id: z.string().uuid(),
  status: z.enum(["new", "replied", "archived"])
});

function emptyToNull(value: string | undefined) {
  return value ? value : null;
}

function emailToNull(value: string | undefined) {
  return value ? value.trim().toLowerCase() : null;
}

function uniqueKeys(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function formUuidList(formData: FormData, name: string) {
  const uuidSchema = z.string().uuid();

  return [
    ...new Set(
      formData
        .getAll(name)
        .map(String)
        .filter((value) => uuidSchema.safeParse(value).success)
    )
  ];
}

async function deleteR2Objects(keys: string[]) {
  await Promise.allSettled(keys.map((key) => deleteR2Object(key)));
}

async function updateAlbumAccessFlags(
  supabase: AdminSupabaseClient,
  albumId: string,
  accessFlags: {
    requires_email: boolean;
    allow_client_password_access: boolean;
  }
) {
  const { error } = await supabase.from("albums").update(accessFlags).eq("id", albumId);

  return error;
}

async function syncAlbumClients(
  supabase: AdminSupabaseClient,
  albumId: string,
  clientIds: string[]
) {
  const { error: deleteError } = await supabase
    .from("album_clients")
    .delete()
    .eq("album_id", albumId);

  if (deleteError) {
    return deleteError;
  }

  if (clientIds.length) {
    const { error } = await supabase.from("album_clients").insert(
      clientIds.map((clientId) => ({
        album_id: albumId,
        client_id: clientId
      }))
    );

    return error;
  }

  return null;
}

async function clientEmailExists(
  supabase: AdminSupabaseClient,
  email: string | null,
  exceptClientId?: string
) {
  if (!email) {
    return false;
  }

  let query = supabase.from("clients").select("id").ilike("email", email).limit(1);

  if (exceptClientId) {
    query = query.neq("id", exceptClientId);
  }

  const { data, error } = await query;

  if (error) {
    return true;
  }

  return Boolean(data?.length);
}

export async function createClientAction(formData: FormData) {
  const supabase = await requireAdmin();
  const rawPassword = String(formData.get("password") ?? "").trim();
  const payload = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: rawPassword
  });

  if (!payload.success) {
    redirect("/admin?notice=client-error#clients");
  }

  const email = emailToNull(payload.data.email);

  if (await clientEmailExists(supabase, email)) {
    redirect("/admin?notice=client-duplicate-email#clients");
  }

  const passwordHash = rawPassword ? hashPassword(rawPassword) : null;
  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name: payload.data.name,
      email,
      phone: emptyToNull(payload.data.phone),
      password_hash: passwordHash
    })
    .select("id, password_hash")
    .single();

  if (error || !client) {
    redirect("/admin?notice=client-error#clients");
  }

  if (rawPassword && !verifyPassword(rawPassword, client.password_hash)) {
    redirect("/admin?notice=client-password-error#clients");
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
    phone: formData.get("phone"),
    password: String(formData.get("password") ?? ""),
    remove_password: formData.get("remove_password") === "on"
  });

  if (!payload.success) {
    redirect("/admin?notice=client-error#clients");
  }

  const rawPassword = String(payload.data.password ?? "").trim();
  const email = emailToNull(payload.data.email);

  if (await clientEmailExists(supabase, email, payload.data.client_id)) {
    redirect("/admin?notice=client-duplicate-email#clients");
  }

  const clientUpdates: {
    name: string;
    email: string | null;
    phone: string | null;
    password_hash?: string | null;
  } = {
    name: payload.data.name,
    email,
    phone: emptyToNull(payload.data.phone)
  };

  if (rawPassword) {
    clientUpdates.password_hash = hashPassword(rawPassword);
  } else if (payload.data.remove_password) {
    clientUpdates.password_hash = null;
  }

  const { data: updatedClient, error } = await supabase
    .from("clients")
    .update(clientUpdates)
    .eq("id", payload.data.client_id)
    .select("password_hash")
    .single();

  if (error || !updatedClient) {
    redirect("/admin?notice=client-error#clients");
  }

  if (rawPassword && !verifyPassword(rawPassword, updatedClient.password_hash)) {
    redirect("/admin?notice=client-password-error#clients");
  }

  if (payload.data.remove_password && updatedClient.password_hash) {
    redirect("/admin?notice=client-password-error#clients");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=client-updated#clients");
}

export async function resetClientPasswordAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = clientPasswordResetSchema.safeParse({
    client_id: formData.get("client_id"),
    password: formData.get("password")
  });

  if (!payload.success) {
    redirect("/admin?notice=client-password-error#clients");
  }

  const passwordHash = hashPassword(payload.data.password);
  const { data: updatedClient, error } = await supabase
    .from("clients")
    .update({ password_hash: passwordHash })
    .eq("id", payload.data.client_id)
    .select("password_hash")
    .single();

  if (
    error ||
    !updatedClient ||
    !verifyPassword(payload.data.password, updatedClient.password_hash)
  ) {
    redirect("/admin?notice=client-password-error#clients");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=client-password-reset#clients");
}

export async function removeClientPasswordAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = clientIdSchema.safeParse({
    client_id: formData.get("client_id")
  });

  if (!payload.success) {
    redirect("/admin?notice=client-password-error#clients");
  }

  const { error } = await supabase
    .from("clients")
    .update({ password_hash: null })
    .eq("id", payload.data.client_id);

  if (error) {
    redirect("/admin?notice=client-password-error#clients");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=client-password-removed#clients");
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
  const rawPassword = String(formData.get("password") ?? "").trim();
  const payload = albumSchema.safeParse({
    client_id: formData.get("client_id"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    event_date: formData.get("event_date"),
    is_public: formData.get("is_public") === "on",
    requires_email: formData.get("requires_email") === "on",
    allow_client_password_access: formData.get("allow_client_password_access") === "on",
    password: rawPassword,
    expires_at: formData.get("expires_at")
  });

  if (!payload.success) {
    redirect("/admin?notice=album-error#albums");
  }

  const passwordHash = rawPassword ? hashPassword(rawPassword) : null;
  const { data: album, error } = await supabase
    .from("albums")
    .insert({
      client_id: emptyToNull(payload.data.client_id),
      title: payload.data.title,
      slug: payload.data.slug,
      event_date: emptyToNull(payload.data.event_date),
      is_public: payload.data.is_public,
      is_password_protected: Boolean(passwordHash),
      password_hash: passwordHash,
      expires_at: emptyToNull(payload.data.expires_at)
    })
    .select("id")
    .single();

  if (error || !album) {
    redirect("/admin?notice=album-error#albums");
  }

  const accessError = await updateAlbumAccessFlags(supabase, album.id, {
    requires_email: payload.data.requires_email,
    allow_client_password_access: payload.data.allow_client_password_access
  });

  if (accessError) {
    redirect("/admin?notice=album-error#albums");
  }

  const assignedClientIds = [
    ...new Set([
      ...formUuidList(formData, "assigned_client_ids"),
      ...(payload.data.client_id ? [payload.data.client_id] : [])
    ])
  ];
  const assignmentError = await syncAlbumClients(supabase, album.id, assignedClientIds);

  if (assignmentError) {
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
    requires_email: formData.get("requires_email") === "on",
    allow_client_password_access: formData.get("allow_client_password_access") === "on",
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

  const assignedClientIds = [
    ...new Set([
      ...formUuidList(formData, "assigned_client_ids"),
      ...(payload.data.client_id ? [payload.data.client_id] : [])
    ])
  ];

  const accessError = await updateAlbumAccessFlags(supabase, payload.data.album_id, {
    requires_email: payload.data.requires_email,
    allow_client_password_access: payload.data.allow_client_password_access
  });
  const assignmentError = await syncAlbumClients(
    supabase,
    payload.data.album_id,
    assignedClientIds
  );

  if (accessError || assignmentError) {
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

  const { error } = await supabase.from("albums").delete().eq("id", payload.data.album_id);

  if (error) {
    redirect(`/admin?notice=album-delete-error&album=${payload.data.album_id}#manager`);
  }

  await deleteR2Objects(r2Keys);

  if (album?.slug) {
    revalidatePath(`/client/${album.slug}`);
  }

  revalidatePath("/admin");
  revalidatePath("/albums");
  revalidatePath("/portfolio");
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
  revalidatePath("/portfolio");
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
  revalidatePath("/portfolio");
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

  await deleteR2Objects(
    uniqueKeys([
      objectKeyFromPublicUrl(photo.thumbnail_url),
      objectKeyFromPublicUrl(photo.preview_url),
      objectKeyFromPublicUrl(photo.full_res_url),
      photo.r2_object_key
    ])
  );

  if (album?.slug) {
    revalidatePath(`/client/${album.slug}`);
  }

  revalidatePath("/admin");
  revalidatePath("/albums");
  revalidatePath("/portfolio");
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

  const zipKey = album?.download_zip_url
    ? objectKeyFromPublicUrl(album.download_zip_url)
    : null;

  const { error } = await supabase
    .from("albums")
    .update({ download_zip_url: null })
    .eq("id", payload.data.album_id);

  if (error) {
    redirect(`/admin?notice=zip-error&album=${payload.data.album_id}#uploads`);
  }

  if (zipKey) {
    await deleteR2Objects([zipKey]);
  }

  if (album?.slug) {
    revalidatePath(`/client/${album.slug}`);
  }

  revalidatePath("/admin");
  redirect(`/admin?notice=zip-removed&album=${payload.data.album_id}#manager`);
}

export async function updateInquiryStatusAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = inquiryStatusSchema.safeParse({
    inquiry_id: formData.get("inquiry_id"),
    status: formData.get("status")
  });

  if (!payload.success) {
    redirect("/admin?notice=inquiry-error#inquiries");
  }

  const { error } = await supabase
    .from("contact_inquiries")
    .update({ status: payload.data.status })
    .eq("id", payload.data.inquiry_id);

  if (error) {
    redirect("/admin?notice=inquiry-error#inquiries");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=inquiry-updated#inquiries");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(siteConfig.routes.adminLogin);
}
