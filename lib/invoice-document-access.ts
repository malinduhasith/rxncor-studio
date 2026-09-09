import { z } from "zod";
import { isAdminEmailAllowed } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InvoiceDocument } from "@/lib/invoice-document";

// The web view and PDF use the same unguessable link and draft access rules.
export async function readClientInvoice(token: string) {
  if (!z.string().uuid().safeParse(token).success) return null;
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("invoices").select("*").eq("public_token", token).maybeSingle();
  if (error) throw new Error("Invoice is temporarily unavailable.");
  if (!data) return null;
  const auth = await createSupabaseServerClient();
  const { data: { user } } = await auth.auth.getUser();
  const isAdmin = Boolean(user && isAdminEmailAllowed(user.email));
  if (data.status === "draft" && !isAdmin) return null;
  return { db, invoice: data as InvoiceDocument, isAdmin };
}
