"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import {
  aboutBlockKinds,
  aboutBlockSections,
  parseMetaItemsFromLines
} from "@/lib/about-builder";
import { isAdminEmailAllowed } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/audit-log";
import { sendAlbumReadyEmails, sendShootStatusEmail } from "@/lib/email";
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

  if (!isAdminEmailAllowed(user.email)) {
    await supabase.auth.signOut();
    redirect(`${siteConfig.routes.adminLogin}?error=unauthorized`);
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

const requiredAlbumSlugSchema = z
  .string()
  .trim()
  .min(3)
  .regex(/^[a-z0-9-]+$/);

const optionalAlbumSlugSchema = z.string().trim().refine(
  (value) => value.length === 0 || (value.length >= 3 && /^[a-z0-9-]+$/.test(value)),
  "Use lowercase letters, numbers, and hyphens only."
);

const albumSchema = z.object({
  client_id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1),
  slug: optionalAlbumSlugSchema,
  event_date: z.string().optional().or(z.literal("")),
  is_public: z.boolean(),
  requires_email: z.boolean(),
  allow_client_password_access: z.boolean(),
  password: z.string().optional(),
  expires_at: z.string().optional().or(z.literal(""))
});

const albumUpdateSchema = albumSchema.extend({
  album_id: z.string().uuid(),
  slug: requiredAlbumSlugSchema,
  remove_password: z.boolean()
});

const albumIdSchema = z.object({
  album_id: z.string().uuid()
});

const photoIdSchema = z.object({
  photo_id: z.string().uuid()
});

const photoMetadataSchema = z.object({
  photo_id: z.string().uuid(),
  display_title: z.string().trim().max(120).optional().or(z.literal("")),
  caption: z.string().trim().max(240).optional().or(z.literal("")),
  camera_model: z.string().trim().max(120).optional().or(z.literal("")),
  lens_model: z.string().trim().max(160).optional().or(z.literal("")),
  focal_length: z.string().trim().max(40).optional().or(z.literal("")),
  aperture: z.string().trim().max(40).optional().or(z.literal("")),
  shutter_speed: z.string().trim().max(40).optional().or(z.literal("")),
  iso: z.string().trim().max(40).optional().or(z.literal("")),
  captured_at: z.string().trim().max(80).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal(""))
});

const inquiryStatusSchema = z.object({
  inquiry_id: z.string().uuid(),
  status: z.enum(["new", "replied", "archived"])
});

const shootRequestUpdateSchema = z.object({
  shoot_request_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  shoot_type: z.string().trim().min(1).max(80),
  location: z.string().trim().max(180).optional().or(z.literal("")),
  preferred_start_at: z.string().trim().min(1),
  preferred_end_at: z.string().trim().min(1),
  status: z.enum(["new", "reviewing", "accepted", "declined", "archived"]),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  admin_notes: z.string().trim().max(2000).optional().or(z.literal("")),
  create_client: z.boolean(),
  create_album: z.boolean(),
  email_client_update: z.boolean()
});

const shootRequestIdSchema = z.object({
  shoot_request_id: z.string().uuid()
});

const aboutSettingsSchema = z.object({
  hero_label: z.string().trim().min(1).max(120),
  hero_title: z.string().trim().min(1).max(180),
  intro: z.string().trim().min(1).max(1000),
  closing: z.string().trim().min(1).max(1000),
  meta_items: z.string().trim().max(2000)
});

const aboutBlockSchema = z.object({
  section: z.enum(aboutBlockSections),
  kind: z.enum(aboutBlockKinds),
  label: z.string().trim().max(100).optional().or(z.literal("")),
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().max(4000).optional().or(z.literal("")),
  reference: z.string().trim().max(2000).optional().or(z.literal("")),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_active: z.boolean()
});

const aboutBlockUpdateSchema = aboutBlockSchema.extend({
  block_id: z.string().uuid()
});

const aboutBlockIdSchema = z.object({
  block_id: z.string().uuid()
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

function validDateRange(start: string, end: string) {
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);

  return Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || `shoot-${Date.now()}`
  );
}

async function deleteR2Objects(keys: string[]) {
  await Promise.allSettled(keys.map((key) => deleteR2Object(key)));
}

async function acceptedShootOverlap(
  supabase: AdminSupabaseClient,
  start: string,
  end: string,
  exceptShootRequestId?: string
) {
  let query = supabase
    .from("shoot_requests")
    .select("id")
    .eq("status", "accepted")
    .lt("preferred_start_at", end)
    .gt("preferred_end_at", start)
    .limit(1);

  if (exceptShootRequestId) {
    query = query.neq("id", exceptShootRequestId);
  }

  const { data, error } = await query;

  if (error) {
    return { error };
  }

  return { hasOverlap: Boolean(data?.length) };
}

async function findOrCreateClientFromShoot(
  supabase: AdminSupabaseClient,
  shoot: {
    name: string;
    email: string;
    phone?: string;
  }
) {
  const email = shoot.email.toLowerCase();
  const { data: existingClients, error: existingError } = await supabase
    .from("clients")
    .select("id")
    .ilike("email", email)
    .limit(2);

  if (existingError) {
    return { error: existingError };
  }

  if (existingClients?.length) {
    return { clientId: existingClients[0].id as string };
  }

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name: shoot.name,
      email,
      phone: emptyToNull(shoot.phone)
    })
    .select("id")
    .single();

  if (error || !client) {
    return { error };
  }

  return { clientId: client.id as string };
}

async function uniqueAlbumSlug(supabase: AdminSupabaseClient, baseSlug: string) {
  for (let index = 0; index < 20; index += 1) {
    const slug = index ? `${baseSlug}-${index + 1}` : baseSlug;
    const { data } = await supabase.from("albums").select("id").eq("slug", slug).maybeSingle();

    if (!data) {
      return slug;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

async function createDraftAlbumFromShoot(
  supabase: AdminSupabaseClient,
  shoot: {
    clientId: string;
    name: string;
    shootType: string;
    start: string;
  }
) {
  const eventDate = shoot.start.slice(0, 10);
  const title = `${shoot.name} - ${shoot.shootType}`;
  const slug = await uniqueAlbumSlug(
    supabase,
    slugify(`${shoot.name}-${shoot.shootType}-${eventDate}`)
  );
  const { data: album, error } = await supabase
    .from("albums")
    .insert({
      client_id: shoot.clientId,
      title,
      slug,
      event_date: eventDate,
      is_public: false,
      is_password_protected: false,
      password_hash: null,
      requires_email: false,
      allow_client_password_access: true
    })
    .select("id")
    .single();

  if (error || !album) {
    return { error };
  }

  const assignmentError = await syncAlbumClients(supabase, album.id as string, [
    shoot.clientId
  ]);

  if (assignmentError) {
    return { error: assignmentError };
  }

  return { albumId: album.id as string };
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

  await logAdminAudit(supabase, {
    action: "client.create",
    entityType: "client",
    entityId: client.id,
    summary: `Created client ${payload.data.name}`,
    metadata: { email, has_password: Boolean(rawPassword) }
  });

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

  await logAdminAudit(supabase, {
    action: "client.update",
    entityType: "client",
    entityId: payload.data.client_id,
    summary: `Updated client ${payload.data.name}`,
    metadata: {
      email,
      password_changed: Boolean(rawPassword),
      password_removed: payload.data.remove_password
    }
  });

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

  await logAdminAudit(supabase, {
    action: "client.password.reset",
    entityType: "client",
    entityId: payload.data.client_id,
    summary: "Reset client portal password"
  });

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

  await logAdminAudit(supabase, {
    action: "client.password.remove",
    entityType: "client",
    entityId: payload.data.client_id,
    summary: "Removed client portal password"
  });

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

  await logAdminAudit(supabase, {
    action: "client.delete",
    entityType: "client",
    entityId: payload.data.client_id,
    summary: "Deleted client record"
  });

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

  const generatedSlug = await uniqueAlbumSlug(
    supabase,
    slugify(
      payload.data.slug ||
        [payload.data.title, payload.data.event_date].filter(Boolean).join(" ")
    )
  );
  const passwordHash = rawPassword ? hashPassword(rawPassword) : null;
  const { data: album, error } = await supabase
    .from("albums")
    .insert({
      client_id: emptyToNull(payload.data.client_id),
      title: payload.data.title,
      slug: generatedSlug,
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

  await logAdminAudit(supabase, {
    action: "album.create",
    entityType: "album",
    entityId: album.id,
    summary: `Created album ${payload.data.title}`,
    metadata: {
      slug: generatedSlug,
      assigned_clients: assignedClientIds.length,
      is_public: payload.data.is_public,
      has_password: Boolean(passwordHash)
    }
  });

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

  await logAdminAudit(supabase, {
    action: "album.update",
    entityType: "album",
    entityId: payload.data.album_id,
    summary: `Updated album ${payload.data.title}`,
    metadata: {
      slug: payload.data.slug,
      assigned_clients: assignedClientIds.length,
      is_public: payload.data.is_public,
      password_changed: Boolean(rawPassword),
      password_removed: payload.data.remove_password
    }
  });

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

  await logAdminAudit(supabase, {
    action: "album.delete",
    entityType: "album",
    entityId: payload.data.album_id,
    summary: `Deleted album ${album?.slug ?? payload.data.album_id}`,
    metadata: { deleted_r2_objects: r2Keys.length }
  });

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

  await logAdminAudit(supabase, {
    action: "photo.cover.set",
    entityType: "photo",
    entityId: payload.data.photo_id,
    summary: "Set album cover photo",
    metadata: { album_id: photo.album_id }
  });

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

  await logAdminAudit(supabase, {
    action: "photo.selection.toggle",
    entityType: "photo",
    entityId: payload.data.photo_id,
    summary: !photo.is_selected ? "Selected portfolio photo" : "Unselected portfolio photo",
    metadata: { album_id: photo.album_id }
  });

  revalidatePath("/admin");
  revalidatePath("/portfolio");
  redirect(`/admin?notice=photo-updated&album=${photo.album_id}#manager`);
}

export async function updatePhotoMetadataAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = photoMetadataSchema.safeParse({
    photo_id: formData.get("photo_id"),
    display_title: formData.get("display_title"),
    caption: formData.get("caption"),
    camera_model: formData.get("camera_model"),
    lens_model: formData.get("lens_model"),
    focal_length: formData.get("focal_length"),
    aperture: formData.get("aperture"),
    shutter_speed: formData.get("shutter_speed"),
    iso: formData.get("iso"),
    captured_at: formData.get("captured_at"),
    location: formData.get("location")
  });

  if (!payload.success) {
    redirect("/admin?notice=photo-error#manager");
  }

  const { data: photo } = await supabase
    .from("photos")
    .select("album_id")
    .eq("id", payload.data.photo_id)
    .maybeSingle();

  if (!photo) {
    redirect("/admin?notice=photo-error#manager");
  }

  const { data: album } = await supabase
    .from("albums")
    .select("slug")
    .eq("id", photo.album_id)
    .maybeSingle();
  const { error } = await supabase
    .from("photos")
    .update({
      display_title: emptyToNull(payload.data.display_title),
      caption: emptyToNull(payload.data.caption),
      camera_model: emptyToNull(payload.data.camera_model),
      lens_model: emptyToNull(payload.data.lens_model),
      focal_length: emptyToNull(payload.data.focal_length),
      aperture: emptyToNull(payload.data.aperture),
      shutter_speed: emptyToNull(payload.data.shutter_speed),
      iso: emptyToNull(payload.data.iso),
      captured_at: emptyToNull(payload.data.captured_at),
      location: emptyToNull(payload.data.location)
    })
    .eq("id", payload.data.photo_id);

  if (error) {
    redirect(`/admin?notice=photo-error&album=${photo.album_id}#manager`);
  }

  await logAdminAudit(supabase, {
    action: "photo.metadata.update",
    entityType: "photo",
    entityId: payload.data.photo_id,
    summary: "Updated photo metadata",
    metadata: { album_id: photo.album_id }
  });

  revalidatePath("/admin");
  revalidatePath("/portfolio");

  if (album?.slug) {
    revalidatePath(`/client/${album.slug}`);
  }

  redirect(`/admin?notice=photo-updated&view=albums&album=${photo.album_id}#manager`);
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
      "album_id, filename, thumbnail_url, preview_url, full_res_url, r2_object_key"
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

  await logAdminAudit(supabase, {
    action: "photo.delete",
    entityType: "photo",
    entityId: payload.data.photo_id,
    summary: "Deleted photo and R2 objects",
    metadata: { album_id: photo.album_id, filename: photo.filename }
  });

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

  await logAdminAudit(supabase, {
    action: "album.zip.remove",
    entityType: "album",
    entityId: payload.data.album_id,
    summary: "Removed album ZIP",
    metadata: { zip_key: zipKey }
  });

  if (album?.slug) {
    revalidatePath(`/client/${album.slug}`);
  }

  revalidatePath("/admin");
  redirect(`/admin?notice=zip-removed&album=${payload.data.album_id}#manager`);
}

export async function sendAlbumReadyEmailAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = albumIdSchema.safeParse({
    album_id: formData.get("album_id")
  });

  if (!payload.success) {
    redirect("/admin?view=albums&notice=email-error#manager");
  }

  const { data: album } = await supabase
    .from("albums")
    .select(
      "id, title, slug, is_password_protected, requires_email, allow_client_password_access, download_zip_url"
    )
    .eq("id", payload.data.album_id)
    .maybeSingle();

  if (!album) {
    redirect("/admin?view=albums&notice=email-error#manager");
  }

  const { data: assignments } = await supabase
    .from("album_clients")
    .select("client_id")
    .eq("album_id", payload.data.album_id);
  const clientIds = (assignments ?? []).map((assignment) => assignment.client_id);

  if (!clientIds.length) {
    redirect(`/admin?view=albums&notice=email-no-recipients&album=${album.id}#manager`);
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("name, email, password_hash")
    .in("id", clientIds);
  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("album_id", album.id);

  const result = await sendAlbumReadyEmails({
    albumId: album.id,
    albumTitle: album.title,
    albumUrl: `${siteConfig.url}${siteConfig.routes.clientGallery}/${album.slug}`,
    photoCount: count ?? 0,
    hasZip: Boolean(album.download_zip_url),
    isPasswordProtected: Boolean(album.is_password_protected),
    requiresEmail: Boolean(album.requires_email),
    clients: ((clients ?? []) as Array<{
      name: string;
      email: string | null;
      password_hash: string | null;
    }>).map((client) => ({
      name: client.name,
      email: client.email,
      hasClientPassword: Boolean(client.password_hash)
    }))
  });

  if (result.skipped) {
    redirect(`/admin?view=albums&notice=email-not-configured&album=${album.id}#manager`);
  }

  if (!result.sent || result.failed) {
    redirect(`/admin?view=albums&notice=email-error&album=${album.id}#manager`);
  }

  await logAdminAudit(supabase, {
    action: "album.email.ready",
    entityType: "album",
    entityId: album.id,
    summary: `Sent album ready email for ${album.title}`,
    metadata: { recipients: clientIds.length }
  });

  redirect(`/admin?view=albums&notice=email-sent&album=${album.id}#manager`);
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

  await logAdminAudit(supabase, {
    action: "inquiry.status.update",
    entityType: "contact_inquiry",
    entityId: payload.data.inquiry_id,
    summary: `Marked inquiry ${payload.data.status}`
  });

  revalidatePath("/admin");
  redirect("/admin?notice=inquiry-updated#inquiries");
}

export async function updateShootRequestAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = shootRequestUpdateSchema.safeParse({
    shoot_request_id: formData.get("shoot_request_id"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    shoot_type: formData.get("shoot_type"),
    location: formData.get("location"),
    preferred_start_at: formData.get("preferred_start_at"),
    preferred_end_at: formData.get("preferred_end_at"),
    status: formData.get("status"),
    message: formData.get("message"),
    admin_notes: formData.get("admin_notes"),
    create_client: formData.get("create_client") === "on",
    create_album: formData.get("create_album") === "on",
    email_client_update: formData.get("email_client_update") === "on"
  });

  if (
    !payload.success ||
    !validDateRange(payload.data.preferred_start_at, payload.data.preferred_end_at)
  ) {
    redirect("/admin?notice=shoot-request-error#shoot-requests");
  }

  if (payload.data.status === "accepted") {
    const overlap = await acceptedShootOverlap(
      supabase,
      payload.data.preferred_start_at,
      payload.data.preferred_end_at,
      payload.data.shoot_request_id
    );

    if (overlap.error) {
      redirect("/admin?notice=shoot-request-error#shoot-requests");
    }

    if (overlap.hasOverlap) {
      redirect("/admin?notice=shoot-request-conflict#shoot-requests");
    }
  }

  const { data: existingShoot } = await supabase
    .from("shoot_requests")
    .select("client_id, album_id, status")
    .eq("id", payload.data.shoot_request_id)
    .maybeSingle();

  if (!existingShoot) {
    redirect("/admin?notice=shoot-request-error#shoot-requests");
  }

  let clientId = (existingShoot.client_id as string | null) ?? null;
  let albumId = (existingShoot.album_id as string | null) ?? null;

  if ((payload.data.create_client || payload.data.create_album) && !clientId) {
    const clientResult = await findOrCreateClientFromShoot(supabase, {
      name: payload.data.name,
      email: payload.data.email,
      phone: payload.data.phone
    });

    if (clientResult.error || !clientResult.clientId) {
      redirect("/admin?notice=shoot-request-error#shoot-requests");
    }

    clientId = clientResult.clientId;
  }

  if (payload.data.create_album && clientId && !albumId) {
    const albumResult = await createDraftAlbumFromShoot(supabase, {
      clientId,
      name: payload.data.name,
      shootType: payload.data.shoot_type,
      start: payload.data.preferred_start_at
    });

    if (albumResult.error || !albumResult.albumId) {
      redirect("/admin?notice=shoot-request-error#shoot-requests");
    }

    albumId = albumResult.albumId;
  }

  const { error } = await supabase
    .from("shoot_requests")
    .update({
      client_id: clientId,
      album_id: albumId,
      name: payload.data.name,
      email: payload.data.email.toLowerCase(),
      phone: emptyToNull(payload.data.phone),
      shoot_type: payload.data.shoot_type,
      location: emptyToNull(payload.data.location),
      preferred_start_at: payload.data.preferred_start_at,
      preferred_end_at: payload.data.preferred_end_at,
      status: payload.data.status,
      message: emptyToNull(payload.data.message),
      admin_notes: emptyToNull(payload.data.admin_notes),
      updated_at: new Date().toISOString()
    })
    .eq("id", payload.data.shoot_request_id);

  if (error) {
    redirect(
      error.message.toLowerCase().includes("overlap")
        ? "/admin?notice=shoot-request-conflict#shoot-requests"
        : "/admin?notice=shoot-request-error#shoot-requests"
    );
  }

  if (payload.data.email_client_update) {
    let albumUrl: string | null = null;

    if (albumId) {
      const { data: album } = await supabase
        .from("albums")
        .select("slug")
        .eq("id", albumId)
        .maybeSingle();

      if (album?.slug) {
        albumUrl = `${siteConfig.url}${siteConfig.routes.clientGallery}/${album.slug}`;
      }
    }

    const emailResult = await sendShootStatusEmail({
      name: payload.data.name,
      email: payload.data.email.toLowerCase(),
      status: payload.data.status,
      shootType: payload.data.shoot_type,
      start: payload.data.preferred_start_at,
      end: payload.data.preferred_end_at,
      location: payload.data.location || null,
      albumUrl,
      relatedId: payload.data.shoot_request_id
    });

    if (emailResult.skipped) {
      redirect("/admin?notice=email-not-configured#shoot-requests");
    }

    if (!emailResult.sent || emailResult.failed) {
      redirect("/admin?notice=email-error#shoot-requests");
    }

    await logAdminAudit(supabase, {
      action: "shoot_request.update.email",
      entityType: "shoot_request",
      entityId: payload.data.shoot_request_id,
      summary: `Updated shoot request and emailed ${payload.data.email}`,
      metadata: {
        status: payload.data.status,
        client_id: clientId,
        album_id: albumId
      }
    });

    revalidatePath("/admin");
    redirect("/admin?notice=shoot-request-emailed#shoot-requests");
  }

  await logAdminAudit(supabase, {
    action: "shoot_request.update",
    entityType: "shoot_request",
    entityId: payload.data.shoot_request_id,
    summary: `Updated shoot request for ${payload.data.name}`,
    metadata: {
      status: payload.data.status,
      client_id: clientId,
      album_id: albumId
    }
  });

  revalidatePath("/admin");
  redirect("/admin?notice=shoot-request-updated#shoot-requests");
}

export async function deleteShootRequestAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = shootRequestIdSchema.safeParse({
    shoot_request_id: formData.get("shoot_request_id")
  });

  if (!payload.success) {
    redirect("/admin?notice=shoot-request-error#shoot-requests");
  }

  const { error } = await supabase
    .from("shoot_requests")
    .delete()
    .eq("id", payload.data.shoot_request_id);

  if (error) {
    redirect("/admin?notice=shoot-request-error#shoot-requests");
  }

  await logAdminAudit(supabase, {
    action: "shoot_request.delete",
    entityType: "shoot_request",
    entityId: payload.data.shoot_request_id,
    summary: "Deleted shoot request"
  });

  revalidatePath("/admin");
  redirect("/admin?notice=shoot-request-deleted#shoot-requests");
}

export async function updateAboutSettingsAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = aboutSettingsSchema.safeParse({
    hero_label: formData.get("hero_label"),
    hero_title: formData.get("hero_title"),
    intro: formData.get("intro"),
    closing: formData.get("closing"),
    meta_items: formData.get("meta_items")
  });

  if (!payload.success) {
    redirect("/admin?view=about&notice=about-error#about-builder");
  }

  const metaItems = parseMetaItemsFromLines(payload.data.meta_items);

  if (!metaItems.length) {
    redirect("/admin?view=about&notice=about-meta-error#about-builder");
  }

  const { error } = await supabase.from("about_page_settings").upsert({
    id: "main",
    hero_label: payload.data.hero_label,
    hero_title: payload.data.hero_title,
    intro: payload.data.intro,
    closing: payload.data.closing,
    meta_items: metaItems,
    updated_at: new Date().toISOString()
  });

  if (error) {
    redirect("/admin?view=about&notice=about-setup-error#about-builder");
  }

  await logAdminAudit(supabase, {
    action: "about.settings.update",
    entityType: "about_page_settings",
    entityId: "main",
    summary: "Updated About page hero and intro"
  });

  revalidatePath("/admin");
  revalidatePath("/about");
  redirect("/admin?view=about&notice=about-updated#about-builder");
}

export async function createAboutBlockAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = aboutBlockSchema.safeParse({
    section: formData.get("section"),
    kind: formData.get("kind"),
    label: formData.get("label"),
    title: formData.get("title"),
    body: formData.get("body"),
    reference: formData.get("reference"),
    sort_order: formData.get("sort_order"),
    is_active: formData.get("is_active") === "on"
  });

  if (!payload.success) {
    redirect("/admin?view=about&notice=about-block-error#about-builder");
  }

  const { data: block, error } = await supabase
    .from("about_page_blocks")
    .insert({
      section: payload.data.section,
      kind: payload.data.kind,
      label: emptyToNull(payload.data.label),
      title: payload.data.title,
      body: emptyToNull(payload.data.body),
      reference: emptyToNull(payload.data.reference),
      sort_order: payload.data.sort_order,
      is_active: payload.data.is_active
    })
    .select("id")
    .single();

  if (error || !block) {
    redirect("/admin?view=about&notice=about-setup-error#about-builder");
  }

  await logAdminAudit(supabase, {
    action: "about.block.create",
    entityType: "about_page_block",
    entityId: block.id,
    summary: `Created About block ${payload.data.title}`,
    metadata: { section: payload.data.section, kind: payload.data.kind }
  });

  revalidatePath("/admin");
  revalidatePath("/about");
  redirect("/admin?view=about&notice=about-block-created#about-builder");
}

export async function updateAboutBlockAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = aboutBlockUpdateSchema.safeParse({
    block_id: formData.get("block_id"),
    section: formData.get("section"),
    kind: formData.get("kind"),
    label: formData.get("label"),
    title: formData.get("title"),
    body: formData.get("body"),
    reference: formData.get("reference"),
    sort_order: formData.get("sort_order"),
    is_active: formData.get("is_active") === "on"
  });

  if (!payload.success) {
    redirect("/admin?view=about&notice=about-block-error#about-builder");
  }

  const { error } = await supabase
    .from("about_page_blocks")
    .update({
      section: payload.data.section,
      kind: payload.data.kind,
      label: emptyToNull(payload.data.label),
      title: payload.data.title,
      body: emptyToNull(payload.data.body),
      reference: emptyToNull(payload.data.reference),
      sort_order: payload.data.sort_order,
      is_active: payload.data.is_active,
      updated_at: new Date().toISOString()
    })
    .eq("id", payload.data.block_id);

  if (error) {
    redirect("/admin?view=about&notice=about-block-error#about-builder");
  }

  await logAdminAudit(supabase, {
    action: "about.block.update",
    entityType: "about_page_block",
    entityId: payload.data.block_id,
    summary: `Updated About block ${payload.data.title}`,
    metadata: { section: payload.data.section, kind: payload.data.kind }
  });

  revalidatePath("/admin");
  revalidatePath("/about");
  redirect("/admin?view=about&notice=about-block-updated#about-builder");
}

export async function deleteAboutBlockAction(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = aboutBlockIdSchema.safeParse({
    block_id: formData.get("block_id")
  });

  if (!payload.success) {
    redirect("/admin?view=about&notice=about-block-error#about-builder");
  }

  const { error } = await supabase
    .from("about_page_blocks")
    .delete()
    .eq("id", payload.data.block_id);

  if (error) {
    redirect("/admin?view=about&notice=about-block-error#about-builder");
  }

  await logAdminAudit(supabase, {
    action: "about.block.delete",
    entityType: "about_page_block",
    entityId: payload.data.block_id,
    summary: "Deleted About block"
  });

  revalidatePath("/admin");
  revalidatePath("/about");
  redirect("/admin?view=about&notice=about-block-deleted#about-builder");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(siteConfig.routes.adminLogin);
}
