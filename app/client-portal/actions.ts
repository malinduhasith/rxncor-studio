"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { clientSessionCookieName } from "@/lib/gallery-access";

export async function clientSignOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(clientSessionCookieName());
  redirect(siteConfig.routes.login);
}
