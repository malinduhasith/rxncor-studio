import { NextResponse } from "next/server";
import { isAdminEmailAllowed } from "@/lib/admin-auth";
import { billingDocumentKind, documentDisplayStatus, paymentTotals, type InvoiceLedgerEvent } from "@/lib/invoices";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET() {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user || !isAdminEmailAllowed(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const [{ data: invoices, error }, { data: events }] = await Promise.all([
    db.from("invoices").select("*").order("created_at", { ascending: false }),
    db.from("admin_audit_logs").select("id,action,entity_id,summary,metadata,created_at").eq("entity_type", "invoice").order("created_at", { ascending: false }).limit(5000),
  ]);
  if (error) return NextResponse.json({ error: "Billing register unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const eventRows = (events ?? []) as InvoiceLedgerEvent[];
  const header = ["Document", "Type", "Status", "Client", "Email", "Project", "Issue date", "Due date", "Subtotal AUD", "GST AUD", "Total AUD", "Paid AUD", "Balance AUD"];
  const rows = (invoices ?? []).map((invoice) => {
    const invoiceEvents = eventRows.filter((event) => event.entity_id === invoice.id);
    const totals = paymentTotals(invoice, invoiceEvents);
    return [invoice.invoice_number, billingDocumentKind(invoice), documentDisplayStatus(invoice, invoiceEvents), invoice.client_name, invoice.client_email, invoice.project_title, invoice.issue_date, invoice.due_date, (invoice.subtotal_cents / 100).toFixed(2), (invoice.gst_cents / 100).toFixed(2), (invoice.total_cents / 100).toFixed(2), (totals.paid / 100).toFixed(2), (totals.balance / 100).toFixed(2)];
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="rxncor-billing-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
