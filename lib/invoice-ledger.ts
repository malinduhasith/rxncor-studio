import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceLedgerEvent } from "@/lib/invoices";

// Never calculate a financial balance from a silently truncated audit query.
export async function readInvoiceLedger(db: SupabaseClient, invoiceId?: string) {
  const rows: InvoiceLedgerEvent[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from("admin_audit_logs")
      .select("id,action,entity_id,summary,metadata,created_at")
      .eq("entity_type", "invoice")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (invoiceId) query = query.eq("entity_id", invoiceId);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data as InvoiceLedgerEvent[]));
    if (data.length < pageSize) return { data: rows, error: null };
  }
}
