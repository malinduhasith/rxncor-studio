"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import {
  clientSessionCookieName,
  createClientSessionCookieValue,
  createClientSessionToken,
  parseClientSessionCookie
} from "@/lib/gallery-access";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const passwordChangeSchema = z
  .object({
    current_password: z.string().trim().min(1),
    new_password: z.string().trim().min(6).max(120),
    confirm_password: z.string().trim().min(6).max(120)
  })
  .refine((value) => value.new_password === value.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match."
  });

export async function clientSignOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(clientSessionCookieName());
  redirect(siteConfig.routes.login);
}

export async function changeClientPasswordAction(formData: FormData) {
  const payload = passwordChangeSchema.safeParse({
    current_password: formData.get("current_password"),
    new_password: formData.get("new_password"),
    confirm_password: formData.get("confirm_password")
  });

  if (!payload.success) {
    redirect(`${siteConfig.routes.clientPortal}?password=invalid`);
  }

  const cookieStore = await cookies();
  const session = parseClientSessionCookie(
    cookieStore.get(clientSessionCookieName())?.value
  );

  if (!session) {
    redirect(`${siteConfig.routes.login}?error=session`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: client, error: lookupError } = await supabase
    .from("clients")
    .select("id, password_hash")
    .eq("id", session.clientId)
    .maybeSingle();

  if (
    lookupError ||
    !client?.password_hash ||
    session.token !== createClientSessionToken(client.id, client.password_hash)
  ) {
    redirect(`${siteConfig.routes.login}?error=session`);
  }

  if (!verifyPassword(payload.data.current_password, client.password_hash)) {
    redirect(`${siteConfig.routes.clientPortal}?password=current`);
  }

  const newPasswordHash = hashPassword(payload.data.new_password);
  const { data: updatedClient, error: updateError } = await supabase
    .from("clients")
    .update({ password_hash: newPasswordHash })
    .eq("id", client.id)
    .select("password_hash")
    .single();

  if (
    updateError ||
    !updatedClient?.password_hash ||
    !verifyPassword(payload.data.new_password, updatedClient.password_hash)
  ) {
    redirect(`${siteConfig.routes.clientPortal}?password=error`);
  }

  cookieStore.set(
    clientSessionCookieName(),
    createClientSessionCookieValue(client.id, updatedClient.password_hash),
    {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  );

  revalidatePath(siteConfig.routes.clientPortal);
  redirect(`${siteConfig.routes.clientPortal}?password=updated`);
}
