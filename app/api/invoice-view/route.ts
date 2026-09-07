import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { billingDocumentKind } from "@/lib/invoices";
import { checkRateLimit, clientIpFromHeaders, rateLimitHeaders } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmailAllowed } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const parsed = z.object({ token: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400, headers: rateLimitHeaders() });
  const auth = await createSupabaseServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (user && isAdminEmailAllowed(user.email)) return NextResponse.json({ ok: true }, { headers: rateLimitHeaders() });
  const requestHeaders = await headers();
  const ipAddress = clientIpFromHeaders(requestHeaders);
  const rate = checkRateLimit(`document-view:${parsed.data.token}:${ipAddress}`, { limit: 12, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) return NextResponse.json({ ok: false }, { status: 429, headers: rateLimitHeaders(rate.retryAfter) });

  const db = createSupabaseAdminClient();
  const { data: invoice } = await db.from("invoices").select("id,invoice_number,status,issuer_snapshot").eq("public_token", parsed.data.token).maybeSingle();
  if (!invoice || invoice.status === "draft" || invoice.status === "void") return NextResponse.json({ ok: true }, { headers: rateLimitHeaders() });
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: recent } = await db
    .from("admin_audit_logs")
    .select("id")
    .eq("entity_type", "invoice")
    .eq("entity_id", invoice.id)
    .eq("action", "invoice.view")
    .gte("created_at", fifteenMinutesAgo)
    .limit(1);
  if (!recent?.length) {
    await db.from("admin_audit_logs").insert({
      action: "invoice.view",
      entity_type: "invoice",
      entity_id: invoice.id,
      summary: `${invoice.invoice_number} viewed`,
      metadata: { document_kind: billingDocumentKind(invoice), ip_address: ipAddress },
    });
  }
  return NextResponse.json({ ok: true }, { headers: rateLimitHeaders() });
}
