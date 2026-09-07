export const invoiceCategories = [
  "Photography",
  "Videography",
  "Editing",
  "Studio",
  "Equipment",
  "Travel",
  "Production",
  "Licensing",
  "Other",
] as const;

export const invoiceContexts = ["Any", "In studio", "On location", "Remote"] as const;
export const invoiceUnits = ["hour", "day", "half day", "session", "item", "kilometre", "fixed"] as const;
export const paymentMethods = ["bank transfer", "PayID", "cash", "card", "other"] as const;

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type BillingDocumentKind = "invoice" | "estimate";
export type DiscountKind = "none" | "percent" | "fixed";
export type PaymentMethod = (typeof paymentMethods)[number];

export type InvoiceItemInput = {
  description: string;
  category: string;
  work_context: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
};

export type InvoiceRecord = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  due_date: string;
  total_cents: number;
  issuer_snapshot?: unknown;
};

export type InvoiceLedgerEvent = {
  id: string;
  action: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type PaymentEntry = {
  eventId: string;
  paymentId: string;
  amountCents: number;
  method: string;
  receivedOn: string;
  reference: string;
  note: string;
  createdAt: string;
  reversed: boolean;
  reversedAt: string | null;
};

export function aud(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function billingSnapshot(invoice: { issuer_snapshot?: unknown }) {
  const issuer = objectValue(invoice.issuer_snapshot);
  return objectValue(issuer.billing);
}

export function snapshotValue<T>(
  invoice: { issuer_snapshot?: unknown },
  key: string,
  fallback: T,
): T {
  const value = billingSnapshot(invoice)[key];
  return value === undefined || value === null ? fallback : (value as T);
}

export function billingDocumentKind(invoice: { issuer_snapshot?: unknown }): BillingDocumentKind {
  return snapshotValue<BillingDocumentKind>(invoice, "document_kind", "invoice") === "estimate"
    ? "estimate"
    : "invoice";
}

export function invoiceTotals(
  items: InvoiceItemInput[],
  gstRate: number,
  discountKind: DiscountKind = "none",
  discountValue = 0,
) {
  const subtotal = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unit_price_cents),
    0,
  );
  const requestedDiscount =
    discountKind === "percent"
      ? Math.round(subtotal * Math.max(0, Math.min(100, discountValue)) / 100)
      : discountKind === "fixed"
        ? Math.round(Math.max(0, discountValue) * 100)
        : 0;
  const discount = Math.min(subtotal, requestedDiscount);
  const taxableSubtotal = subtotal - discount;
  const gst = Math.round(taxableSubtotal * Math.max(0, gstRate) / 100);
  return { subtotal, discount, taxableSubtotal, gst, total: taxableSubtotal + gst };
}

export function invoiceDisplayStatus(status: InvoiceStatus, dueDate: string) {
  if (status === "sent" && dueDate < invoiceDate()) {
    return "overdue";
  }
  return status;
}

function stringMeta(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function numberMeta(metadata: Record<string, unknown>, key: string) {
  const value = Number(metadata[key]);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

export function paymentEntries(events: InvoiceLedgerEvent[]): PaymentEntry[] {
  const reversals = new Map<string, string>();
  for (const event of events) {
    if (event.action !== "invoice.payment.reverse") continue;
    const metadata = objectValue(event.metadata);
    const paymentId = stringMeta(metadata, "payment_id");
    if (paymentId) reversals.set(paymentId, event.created_at);
  }

  return events
    .filter((event) => event.action === "invoice.payment.record")
    .map((event) => {
      const metadata = objectValue(event.metadata);
      const paymentId = stringMeta(metadata, "payment_id") || event.id;
      return {
        eventId: event.id,
        paymentId,
        amountCents: Math.max(0, numberMeta(metadata, "amount_cents")),
        method: stringMeta(metadata, "method") || "other",
        receivedOn: stringMeta(metadata, "received_on") || event.created_at.slice(0, 10),
        reference: stringMeta(metadata, "reference"),
        note: stringMeta(metadata, "note"),
        createdAt: event.created_at,
        reversed: reversals.has(paymentId),
        reversedAt: reversals.get(paymentId) ?? null,
      };
    })
    .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));
}

export function paymentTotals(
  invoice: { total_cents: number; status: InvoiceStatus },
  events: InvoiceLedgerEvent[],
) {
  const entries = paymentEntries(events);
  const ledgerPaid = entries
    .filter((entry) => !entry.reversed)
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const hasLedger = entries.length > 0;
  const paid = hasLedger
    ? Math.min(invoice.total_cents, ledgerPaid)
    : invoice.status === "paid"
      ? invoice.total_cents
      : 0;
  return {
    paid,
    balance: Math.max(0, invoice.total_cents - paid),
    hasLedger,
    entries,
  };
}

export function estimateDecision(events: InvoiceLedgerEvent[]) {
  const decisionEvent = events.find((event) =>
    ["estimate.converted", "estimate.accepted", "estimate.declined", "estimate.reopen"].includes(event.action),
  );
  if (!decisionEvent || decisionEvent.action === "estimate.reopen") return null;
  if (decisionEvent.action === "estimate.converted") return "converted" as const;
  if (decisionEvent.action === "estimate.accepted") return "accepted" as const;
  return "declined" as const;
}

export function documentDisplayStatus(
  invoice: Pick<InvoiceRecord, "status" | "due_date" | "total_cents"> & { issuer_snapshot?: unknown },
  events: InvoiceLedgerEvent[],
) {
  if (invoice.status === "void") return "void";
  if (billingDocumentKind(invoice) === "estimate") {
    return estimateDecision(events) ?? invoice.status;
  }
  const totals = paymentTotals(invoice, events);
  if (totals.balance === 0 && totals.paid > 0) return "paid";
  if (totals.paid > 0) return "part-paid";
  return invoiceDisplayStatus(invoice.status, invoice.due_date);
}

export type AgingBucket = "Current" | "1–30 days" | "31–60 days" | "61–90 days" | "90+ days";

export function invoiceDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function estimateExpired(invoice: { issuer_snapshot?: unknown; due_date: string }, today = invoiceDate()) {
  return snapshotValue(invoice, "valid_until", invoice.due_date) < today;
}

export function agingBucket(dueDate: string, today = new Date()): AgingBucket {
  const due = new Date(`${dueDate}T00:00:00Z`).valueOf();
  const at = new Date(`${invoiceDate(today)}T00:00:00Z`).valueOf();
  const days = Math.floor((at - due) / 86_400_000);
  if (days <= 0) return "Current";
  if (days <= 30) return "1–30 days";
  if (days <= 60) return "31–60 days";
  if (days <= 90) return "61–90 days";
  return "90+ days";
}
