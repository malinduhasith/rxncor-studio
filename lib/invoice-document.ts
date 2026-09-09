import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceItemInput, InvoiceRecord } from "@/lib/invoices";

export type InvoiceDocument = InvoiceRecord & {
  public_token: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string | null;
  client_address?: string | null;
  project_title?: string | null;
  subtotal_cents: number;
  gst_rate: number;
  gst_cents: number;
  notes?: string | null;
  terms?: string | null;
  issuer_snapshot: Record<string, unknown> | null;
  payment_snapshot: Record<string, unknown> | null;
};

export type InvoiceDocumentItem = InvoiceItemInput & {
  id: string;
  line_total_cents: number;
};

export async function readInvoiceItems(db: SupabaseClient, invoiceId: string) {
  const items: InvoiceDocumentItem[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from("invoice_items").select("*")
      .eq("invoice_id", invoiceId).order("sort_order").order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Invoice items are temporarily unavailable.");
    items.push(...(data as InvoiceDocumentItem[]));
    if (data.length < pageSize) return items;
  }
}
