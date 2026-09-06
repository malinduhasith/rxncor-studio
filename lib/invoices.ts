export const invoiceCategories = ["Photography", "Videography", "Editing", "Studio", "Equipment", "Travel", "Production", "Other"] as const;
export const invoiceContexts = ["Any", "In studio", "On location", "Remote"] as const;
export const invoiceUnits = ["hour", "day", "half day", "session", "item", "kilometre", "fixed"] as const;

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type InvoiceItemInput = { description: string; category: string; work_context: string; quantity: number; unit: string; unit_price_cents: number };

export function aud(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format((cents || 0) / 100);
}

export function invoiceTotals(items: InvoiceItemInput[], gstRate: number) {
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.quantity * item.unit_price_cents), 0);
  const gst = Math.round(subtotal * Math.max(0, gstRate) / 100);
  return { subtotal, gst, total: subtotal + gst };
}

export function invoiceDisplayStatus(status: InvoiceStatus, dueDate: string) {
  if (status === "sent" && dueDate < new Date().toISOString().slice(0, 10)) return "overdue";
  return status;
}
