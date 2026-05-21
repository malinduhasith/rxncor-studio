"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import {
  clientSessionCookieName,
  createClientSessionCookieValue
} from "@/lib/gallery-access";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
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

  const requestHeaders = await headers();
  const ipAddress = clientIpFromHeaders(requestHeaders);
  const ipLimit = checkRateLimit(`client-login:ip:${ipAddress}`, {
    limit: 30,
    windowMs: 15 * 60 * 1000
  });
  const emailLimit = checkRateLimit(`client-login:${ipAddress}:${email}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000
  });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    redirect(`${siteConfig.routes.login}?error=rate-limited`);
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
    redirect(`${siteConfig.routes.login}?error=invalid`);
  }

  if (matchingClients.length > 1) {
    redirect(`${siteConfig.routes.login}?error=invalid`);
  }

  if (!loginClient.password_hash) {
    redirect(`${siteConfig.routes.login}?error=invalid`);
  }

  if (!verifyPassword(password, loginClient.password_hash)) {
    redirect(`${siteConfig.routes.login}?error=invalid`);
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
