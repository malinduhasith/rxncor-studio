"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendEstimateDecisionNotification } from "@/lib/email";
import { billingDocumentKind, estimateDecision, type InvoiceLedgerEvent } from "@/lib/invoices";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const decisionSchema = z.object({
  token: z.string().uuid(),
  decision: z.enum(["accepted", "declined"]),
  confirmed_by: z.string().trim().min(2).max(160),
  confirm: z.literal("on"),
});

export async function estimateDecisionAction(formData: FormData) {
  const parsed = decisionSchema.safeParse({
    token: formData.get("token"),
    decision: formData.get("decision"),
    confirmed_by: formData.get("confirmed_by"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) redirect(`/invoice/${String(formData.get("token") || "")}?decision=invalid`);

  const requestHeaders = await headers();
  const ipAddress = clientIpFromHeaders(requestHeaders);
  const limit = checkRateLimit(`estimate-decision:${parsed.data.token}:${ipAddress}`, { limit: 8, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) redirect(`/invoice/${parsed.data.token}?decision=rate-limited`);

  const db = createSupabaseAdminClient();
  const { data: invoice } = await db.from("invoices").select("*").eq("public_token", parsed.data.token).maybeSingle();
  if (!invoice || billingDocumentKind(invoice) !== "estimate" || invoice.status !== "sent") redirect(`/invoice/${parsed.data.token}?decision=unavailable`);
  const { data: events, error: eventError } = await db
    .from("admin_audit_logs")
    .select("id,action,entity_id,summary,metadata,created_at")
    .eq("entity_type", "invoice")
    .eq("entity_id", invoice.id)
    .in("action", ["estimate.accepted", "estimate.declined", "estimate.converted", "estimate.reopen"])
    .order("created_at", { ascending: false });
  if (eventError) redirect(`/invoice/${parsed.data.token}?decision=error`);
  const currentDecision = estimateDecision((events ?? []) as InvoiceLedgerEvent[]);
  if (currentDecision) redirect(`/invoice/${parsed.data.token}?decision=already-recorded`);

  const { error } = await db.from("admin_audit_logs").insert({
    action: `estimate.${parsed.data.decision}`,
    entity_type: "invoice",
    entity_id: invoice.id,
    summary: `${invoice.invoice_number} ${parsed.data.decision} by ${parsed.data.confirmed_by}`,
    metadata: {
      confirmed_by: parsed.data.confirmed_by,
      client_email: invoice.client_email,
      ip_address: ipAddress,
      user_agent: requestHeaders.get("user-agent")?.slice(0, 500) || null,
      decided_at: new Date().toISOString(),
    },
  });
  if (error) redirect(`/invoice/${parsed.data.token}?decision=error`);

  await sendEstimateDecisionNotification({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    clientName: invoice.client_name,
    clientEmail: invoice.client_email,
    decision: parsed.data.decision,
    confirmedBy: parsed.data.confirmed_by,
  });
  revalidatePath(`/invoice/${parsed.data.token}`);
  revalidatePath("/admin/invoices");
  redirect(`/invoice/${parsed.data.token}?decision=${parsed.data.decision}`);
}
