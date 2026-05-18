"use server";

import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`${siteConfig.routes.adminLogin}?error=missing`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`${siteConfig.routes.adminLogin}?error=invalid`);
  }

  redirect(siteConfig.routes.admin);
}
