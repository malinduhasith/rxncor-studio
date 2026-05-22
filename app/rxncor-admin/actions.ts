"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { isAdminEmailAllowed } from "@/lib/admin-auth";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`${siteConfig.routes.adminLogin}?error=missing`);
  }

  const requestHeaders = await headers();
  const ipAddress = clientIpFromHeaders(requestHeaders);
  const ipLimit = checkRateLimit(`admin-login:ip:${ipAddress}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000
  });
  const emailLimit = checkRateLimit(`admin-login:${ipAddress}:${email.toLowerCase()}`, {
    limit: 6,
    windowMs: 15 * 60 * 1000
  });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    redirect(`${siteConfig.routes.adminLogin}?error=rate-limited`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`${siteConfig.routes.adminLogin}?error=invalid`);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!isAdminEmailAllowed(user?.email)) {
    await supabase.auth.signOut();
    redirect(`${siteConfig.routes.adminLogin}?error=unauthorized`);
  }

  redirect(siteConfig.routes.admin);
}
