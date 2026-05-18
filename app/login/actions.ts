"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import {
  clientSessionCookieName,
  createClientSessionCookieValue
} from "@/lib/gallery-access";
import { verifyPassword } from "@/lib/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type LoginClient = {
  id: string;
  email: string | null;
  password_hash?: string | null;
};

export async function clientLoginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect(`${siteConfig.routes.login}?error=missing`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, email, password_hash")
    .ilike("email", email)
    .limit(2);
  const matchingClients = (clients ?? []) as LoginClient[];
  const loginClient = matchingClients[0] ?? null;

  if (error) {
    redirect(`${siteConfig.routes.login}?error=lookup`);
  }

  if (!loginClient) {
    redirect(`${siteConfig.routes.login}?error=no-client`);
  }

  if (matchingClients.length > 1) {
    redirect(`${siteConfig.routes.login}?error=duplicate-client`);
  }

  if (!loginClient.password_hash) {
    redirect(`${siteConfig.routes.login}?error=no-password`);
  }

  if (!verifyPassword(password, loginClient.password_hash)) {
    redirect(`${siteConfig.routes.login}?error=wrong-password`);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    clientSessionCookieName(),
    createClientSessionCookieValue(loginClient.id, loginClient.password_hash),
    {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  );

  redirect(siteConfig.routes.clientPortal);
}
