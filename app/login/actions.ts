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
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`${siteConfig.routes.login}?error=missing`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  const loginClient = client as LoginClient | null;

  if (
    !loginClient?.password_hash ||
    !verifyPassword(password, loginClient.password_hash)
  ) {
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
