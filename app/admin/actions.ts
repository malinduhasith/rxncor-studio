"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "@/lib/password";
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

function emptyToNull(value: string | undefined) {
  return value ? value : null;
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

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
