"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { optionalEnv } from "@/config/server-env";
import { siteConfig } from "@/config/site";
import { isAdminEmailAllowed } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/audit-log";
import { sendInvoiceEmail } from "@/lib/email";
import {
  billingDocumentKind,
  billingSnapshot,
  estimateDecision,
  invoiceDate,
  invoiceTotals,
  paymentMethods,
  paymentTotals,
  snapshotValue,
  type BillingDocumentKind,
  type InvoiceItemInput,
  type InvoiceLedgerEvent,
} from "@/lib/invoices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readInvoiceLedger } from "@/lib/invoice-ledger";
import { readInvoiceItems } from "@/lib/invoice-document";
import { createInvoicePdf } from "@/lib/invoice-pdf";

async function admin() {
  const auth = await createSupabaseServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect(siteConfig.routes.adminLogin);
  if (!isAdminEmailAllowed(user.email)) redirect(`${siteConfig.routes.adminLogin}?error=unauthorized`);
  return createSupabaseAdminClient();
}

const itemSchema = z.object({
  description: z.string().trim().min(1).max(240),
  category: z.string().trim().min(1).max(60),
  work_context: z.string().trim().min(1).max(60),
  quantity: z.coerce.number().finite().positive().max(100_000),
  unit: z.string().trim().min(1).max(40),
  unit_price_cents: z.coerce.number().int().nonnegative().max(100_000_000),
});

const documentSchema = z.object({
  document_kind: z.enum(["invoice", "estimate"]),
  client_id: z.string().uuid().nullable().optional(),
  client_name: z.string().trim().min(1).max(160),
  client_email: z.string().trim().email().max(320),
  client_phone: z.string().trim().max(80).optional(),
  client_address: z.string().trim().max(800).optional(),
  project_title: z.string().trim().max(240).optional(),
  purchase_order: z.string().trim().max(120).optional(),
  issue_date: z.string().date(),
  due_date: z.string().date(),
  valid_until: z.string().date(),
  gst_rate: z.coerce.number().finite().min(0).max(100),
  discount_kind: z.enum(["none", "percent", "fixed"]),
  discount_value: z.coerce.number().finite().min(0).max(10_000_000),
  deposit_percent: z.coerce.number().finite().min(0).max(100),
  notes: z.string().trim().max(4000).optional(),
  terms: z.string().trim().max(2000).optional(),
  items: z.array(itemSchema).min(1).max(100),
}).superRefine((value, context) => {
  const finalDate = value.document_kind === "estimate" ? value.valid_until : value.due_date;
  if (finalDate < value.issue_date) {
    context.addIssue({ code: "custom", path: [value.document_kind === "estimate" ? "valid_until" : "due_date"], message: "Date must be on or after issue date." });
  }
  const totals = invoiceTotals(value.items, value.gst_rate, value.discount_kind, value.discount_value);
  if (value.items.some((item) => Math.round(item.quantity * item.unit_price_cents) > 2_000_000_000) || totals.total > 2_000_000_000) {
    context.addIssue({ code: "custom", path: ["items"], message: "Document value exceeds the supported accounting limit." });
  }
});

type DocumentInput = z.infer<typeof documentSchema>;

function parseDocument(formData: FormData) {
  let raw: unknown = {};
  try {
    raw = JSON.parse(String(formData.get("payload") || "{}"));
  } catch {
    redirect("/admin/invoices?notice=invalid");
  }
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) redirect("/admin/invoices?notice=invalid");
  return parsed.data;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function documentNumber(allocated: string, kind: BillingDocumentKind) {
  return kind === "estimate" ? allocated.replace(/^[^-]+-/, "EST-") : allocated;
}

function invoiceRows(invoiceId: string, items: InvoiceItemInput[]) {
  return items.map((item, index) => ({
    ...item,
    invoice_id: invoiceId,
    line_total_cents: Math.round(item.quantity * item.unit_price_cents),
    sort_order: index,
  }));
}

function billingMetadata(input: DocumentInput, totals: ReturnType<typeof invoiceTotals>, extras: Record<string, unknown> = {}) {
  return {
    document_kind: input.document_kind,
    purchase_order: input.purchase_order || null,
    valid_until: input.valid_until,
    discount_kind: input.discount_kind,
    discount_value: input.discount_value,
    discount_cents: totals.discount,
    deposit_percent: input.document_kind === "invoice" ? input.deposit_percent : 0,
    ...extras,
  };
}

function persistedDocumentFields(input: DocumentInput) {
  return {
    client_id: input.client_id || null,
    client_name: input.client_name,
    client_email: input.client_email,
    client_phone: input.client_phone || null,
    client_address: input.client_address || null,
    project_title: input.project_title || null,
    issue_date: input.issue_date,
    due_date: input.due_date,
    gst_rate: input.gst_rate,
    notes: input.notes || null,
    terms: input.terms || null,
  };
}

async function settingsAndNumber(supabase: ReturnType<typeof createSupabaseAdminClient>, kind: BillingDocumentKind) {
  const [{ data: allocated, error: numberError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.rpc("allocate_invoice_number"),
    supabase.from("invoice_settings").select("*").eq("id", "main").maybeSingle(),
  ]);
  if (numberError || !allocated || settingsError) redirect("/admin/invoices?notice=setup");
  return { settings, number: documentNumber(String(allocated), kind) };
}

function issuerSnapshot(settings: Record<string, unknown> | null, billing: Record<string, unknown>) {
  return {
    business_name: settings?.business_name || "RXNCOR Studio",
    issuer_name: settings?.issuer_name || "Malindu Herath",
    email: settings?.email || null,
    phone: settings?.phone || null,
    address: settings?.address || null,
    abn: settings?.abn || null,
    billing,
  };
}

function paymentSnapshot(settings: Record<string, unknown> | null) {
  return {
    pay_id: settings?.pay_id || optionalEnv("INVOICE_PAYID") || null,
    bank_name: settings?.bank_name || null,
    account_name: settings?.account_name || null,
    bsb: settings?.bsb || null,
    account_number: settings?.account_number || null,
  };
}

async function fetchLedger(supabase: ReturnType<typeof createSupabaseAdminClient>, invoiceId: string) {
  const { data, error } = await readInvoiceLedger(supabase, invoiceId);
  if (error) redirect(`/admin/invoices?invoice=${invoiceId}&notice=ledger-error`);
  return (data ?? []) as InvoiceLedgerEvent[];
}

async function insertLedgerEvent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  values: { action: string; entityId: string; summary: string; metadata: Record<string, unknown> },
) {
  const { error } = await supabase.from("admin_audit_logs").insert({
    action: values.action,
    entity_type: "invoice",
    entity_id: values.entityId,
    summary: values.summary,
    metadata: values.metadata,
  });
  return !error;
}

export async function createInvoiceAction(formData: FormData) {
  const supabase = await admin();
  const input = parseDocument(formData);
  const totals = invoiceTotals(input.items, input.gst_rate, input.discount_kind, input.discount_value);
  const { settings, number } = await settingsAndNumber(supabase, input.document_kind);
  const base = persistedDocumentFields(input);
  const { data: invoice, error } = await supabase.from("invoices").insert({
    ...base,
    invoice_number: number,
    subtotal_cents: totals.subtotal,
    gst_cents: totals.gst,
    total_cents: totals.total,
    issuer_snapshot: issuerSnapshot(settings, billingMetadata(input, totals)),
    payment_snapshot: paymentSnapshot(settings),
  }).select("id").single();
  if (error || !invoice) redirect("/admin/invoices?notice=error");
  const { error: itemError } = await supabase.from("invoice_items").insert(invoiceRows(invoice.id, input.items));
  if (itemError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    redirect("/admin/invoices?notice=error");
  }
  await logAdminAudit(supabase, { action: `${input.document_kind}.create`, entityType: "invoice", entityId: invoice.id, summary: `Created ${number}` });
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices?invoice=${invoice.id}&notice=created`);
}

export async function updateInvoiceAction(formData: FormData) {
  const supabase = await admin();
  const id = String(formData.get("invoice_id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin/invoices?notice=invalid");
  const input = parseDocument(formData);
  const [{ data: current }, { data: oldItems }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
  ]);
  if (!current) redirect("/admin/invoices?notice=missing");
  if (current.status !== "draft") redirect(`/admin/invoices?invoice=${id}&notice=edit-locked`);
  if (billingDocumentKind(current) !== input.document_kind) redirect(`/admin/invoices?invoice=${id}&notice=type-locked`);
  const totals = invoiceTotals(input.items, input.gst_rate, input.discount_kind, input.discount_value);
  const previousIssuer = asRecord(current.issuer_snapshot);
  const base = persistedDocumentFields(input);
  const update = {
    ...base,
    subtotal_cents: totals.subtotal,
    gst_cents: totals.gst,
    total_cents: totals.total,
    issuer_snapshot: { ...previousIssuer, billing: billingMetadata(input, totals) },
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await supabase.from("invoices").update(update).eq("id", id);
  if (updateError) redirect(`/admin/invoices?invoice=${id}&notice=error`);
  const { error: deleteError } = await supabase.from("invoice_items").delete().eq("invoice_id", id);
  const { error: itemError } = deleteError
    ? { error: deleteError }
    : await supabase.from("invoice_items").insert(invoiceRows(id, input.items));
  if (itemError) {
    const restore = {
      client_id: current.client_id,
      client_name: current.client_name,
      client_email: current.client_email,
      client_phone: current.client_phone,
      client_address: current.client_address,
      project_title: current.project_title,
      issue_date: current.issue_date,
      due_date: current.due_date,
      gst_rate: current.gst_rate,
      notes: current.notes,
      terms: current.terms,
      subtotal_cents: current.subtotal_cents,
      gst_cents: current.gst_cents,
      total_cents: current.total_cents,
      issuer_snapshot: current.issuer_snapshot,
      updated_at: current.updated_at,
    };
    await supabase.from("invoices").update(restore).eq("id", id);
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    if (oldItems?.length) await supabase.from("invoice_items").insert(oldItems);
    redirect(`/admin/invoices?invoice=${id}&notice=error`);
  }
  await logAdminAudit(supabase, { action: `${input.document_kind}.update`, entityType: "invoice", entityId: id, summary: `Updated ${current.invoice_number}` });
  revalidatePath("/admin/invoices");
  revalidatePath(`/invoice/${current.public_token}`);
  redirect(`/admin/invoices?invoice=${id}&notice=updated`);
}

async function copyDocument(supabase: ReturnType<typeof createSupabaseAdminClient>, sourceId: string, kind: BillingDocumentKind) {
  const [{ data: source }, { data: items }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", sourceId).maybeSingle(),
    supabase.from("invoice_items").select("description,category,work_context,quantity,unit,unit_price_cents,line_total_cents,sort_order").eq("invoice_id", sourceId).order("sort_order"),
  ]);
  if (!source || !items?.length) redirect(`/admin/invoices?invoice=${sourceId}&notice=missing`);
  const { number, settings } = await settingsAndNumber(supabase, kind);
  const today = new Date();
  const issueDate = invoiceDate(today);
  const dueDays = Number(settings?.default_due_days ?? 14);
  const dueDate = invoiceDate(new Date(today.valueOf() + dueDays * 86_400_000));
  const sourceIssuer = asRecord(source.issuer_snapshot);
  const sourceBilling = billingSnapshot(source);
  const { data: created, error } = await supabase.from("invoices").insert({
    invoice_number: number,
    client_id: source.client_id,
    client_name: source.client_name,
    client_email: source.client_email,
    client_phone: source.client_phone,
    client_address: source.client_address,
    project_title: source.project_title,
    issue_date: issueDate,
    due_date: dueDate,
    status: "draft",
    notes: source.notes,
    terms: source.terms,
    issuer_snapshot: { ...sourceIssuer, billing: { ...sourceBilling, document_kind: kind, valid_until: dueDate, source_document_id: sourceId } },
    payment_snapshot: source.payment_snapshot,
    subtotal_cents: source.subtotal_cents,
    gst_rate: source.gst_rate,
    gst_cents: source.gst_cents,
    total_cents: source.total_cents,
  }).select("id").single();
  if (error || !created) redirect(`/admin/invoices?invoice=${sourceId}&notice=error`);
  const clonedItems = items.map(({ line_total_cents, sort_order, ...item }) => ({ ...item, invoice_id: created.id, line_total_cents, sort_order }));
  const { error: itemError } = await supabase.from("invoice_items").insert(clonedItems);
  if (itemError) {
    await supabase.from("invoices").delete().eq("id", created.id);
    redirect(`/admin/invoices?invoice=${sourceId}&notice=error`);
  }
  return { id: created.id, number };
}

export async function duplicateInvoiceAction(formData: FormData) {
  const supabase = await admin();
  const id = String(formData.get("invoice_id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin/invoices?notice=invalid");
  const { data: source } = await supabase.from("invoices").select("issuer_snapshot").eq("id", id).maybeSingle();
  if (!source) redirect("/admin/invoices?notice=missing");
  const created = await copyDocument(supabase, id, billingDocumentKind(source));
  await logAdminAudit(supabase, { action: "invoice.duplicate", entityType: "invoice", entityId: created.id, summary: `Duplicated as ${created.number}`, metadata: { source_id: id } });
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices?invoice=${created.id}&notice=duplicated`);
}

export async function convertEstimateAction(formData: FormData) {
  const supabase = await admin();
  const id = String(formData.get("invoice_id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin/invoices?notice=invalid");
  const { data: source } = await supabase.from("invoices").select("invoice_number,issuer_snapshot,status").eq("id", id).maybeSingle();
  if (!source || billingDocumentKind(source) !== "estimate" || source.status === "void") redirect(`/admin/invoices?invoice=${id}&notice=invalid`);
  const sourceEvents = await fetchLedger(supabase, id);
  if (["declined", "converted"].includes(estimateDecision(sourceEvents) ?? "")) redirect(`/admin/invoices?invoice=${id}&notice=convert-locked`);
  const created = await copyDocument(supabase, id, "invoice");
  const logged = await insertLedgerEvent(supabase, {
    action: "estimate.converted",
    entityId: id,
    summary: `Converted ${source.invoice_number} to ${created.number}`,
    metadata: { invoice_id: created.id, invoice_number: created.number },
  });
  if (!logged) {
    await supabase.from("invoices").delete().eq("id", created.id);
    redirect(`/admin/invoices?invoice=${id}&notice=ledger-error`);
  }
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices?invoice=${created.id}&notice=converted`);
}

const statusActionSchema = z.enum(["send", "resend", "reminder", "void", "reopen", "delete"]);

export async function invoiceStatusAction(formData: FormData) {
  const supabase = await admin();
  const id = String(formData.get("invoice_id") || "");
  const parsedAction = statusActionSchema.safeParse(String(formData.get("invoice_action") || ""));
  if (!z.string().uuid().safeParse(id).success || !parsedAction.success) redirect("/admin/invoices?notice=invalid");
  const action = parsedAction.data;
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!invoice) redirect("/admin/invoices?notice=missing");
  const kind = billingDocumentKind(invoice);
  const events = await fetchLedger(supabase, id);
  const totals = paymentTotals(invoice, events);

  if (action === "delete") {
    if (!["draft", "void"].includes(invoice.status) || totals.paid > 0) redirect(`/admin/invoices?invoice=${id}&notice=delete-locked`);
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) redirect(`/admin/invoices?invoice=${id}&notice=error`);
    await logAdminAudit(supabase, { action: `${kind}.delete`, entityType: "invoice", entityId: id, summary: `Deleted ${invoice.invoice_number}` });
    redirect("/admin/invoices?notice=deleted");
  }

  if (action === "void") {
    if (invoice.status === "paid" || totals.paid > 0) redirect(`/admin/invoices?invoice=${id}&notice=void-payment`);
    const { error } = await supabase.from("invoices").update({ status: "void", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) redirect(`/admin/invoices?invoice=${id}&notice=error`);
  }

  if (action === "reopen") {
    if (invoice.status !== "void") redirect(`/admin/invoices?invoice=${id}&notice=invalid`);
    const { error } = await supabase.from("invoices").update({ status: "draft", sent_at: null, paid_at: null, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) redirect(`/admin/invoices?invoice=${id}&notice=error`);
    if (kind === "estimate") {
      const logged = await insertLedgerEvent(supabase, { action: "estimate.reopen", entityId: id, summary: `Reopened ${invoice.invoice_number}`, metadata: {} });
      if (!logged) {
        await supabase.from("invoices").update({ status: invoice.status, sent_at: invoice.sent_at, paid_at: invoice.paid_at, updated_at: invoice.updated_at }).eq("id", id);
        redirect(`/admin/invoices?invoice=${id}&notice=ledger-error`);
      }
    }
  }

  if (["send", "resend", "reminder"].includes(action)) {
    if (invoice.status === "void") redirect(`/admin/invoices?invoice=${id}&notice=send-locked`);
    if (action === "reminder" && (kind !== "invoice" || invoice.status !== "sent" || totals.balance === 0)) redirect(`/admin/invoices?invoice=${id}&notice=send-locked`);
    const previewHost = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
    const base = process.env.VERCEL_ENV === "preview" && previewHost ? `https://${previewHost}` : siteConfig.url;
    const depositPercent = snapshotValue<number>(invoice, "deposit_percent", 0);
    const invoiceUrl = `${base}/invoice/${invoice.public_token}`;
    const pdf = await (async () => {
      try {
        const items = await readInvoiceItems(supabase, id);
        return await createInvoicePdf({
          invoice: { ...invoice, status: invoice.status === "draft" ? "sent" : invoice.status },
          items, events, invoiceUrl,
        });
      } catch (error) {
        console.error("Invoice PDF could not be prepared", error);
        return null;
      }
    })();
    if (!pdf) redirect(`/admin/invoices?invoice=${id}&notice=pdf-error`);
    const result = await sendInvoiceEmail({
      documentKind: kind,
      deliveryKind: action === "reminder" ? "reminder" : action === "resend" ? "resend" : "send",
      invoiceId: id,
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client_name,
      clientEmail: invoice.client_email,
      projectTitle: invoice.project_title,
      issueDate: invoice.issue_date,
      dueDate: kind === "estimate" ? snapshotValue(invoice, "valid_until", invoice.due_date) : invoice.due_date,
      total: new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(invoice.total_cents / 100),
      balance: new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(totals.balance / 100),
      deposit: depositPercent > 0 ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(Math.round(invoice.total_cents * depositPercent / 100) / 100) : null,
      invoiceUrl,
      pdf,
      payId: kind === "invoice" ? invoice.payment_snapshot?.pay_id : null,
      bankName: kind === "invoice" ? invoice.payment_snapshot?.bank_name : null,
      accountName: kind === "invoice" ? invoice.payment_snapshot?.account_name : null,
      bsb: kind === "invoice" ? invoice.payment_snapshot?.bsb : null,
      accountNumber: kind === "invoice" ? invoice.payment_snapshot?.account_number : null,
    });
    if (result.sent < 1) redirect(`/admin/invoices?invoice=${id}&notice=email-error`);
    const { error } = await supabase.from("invoices").update({ status: invoice.status === "paid" ? "paid" : "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    if (error) redirect(`/admin/invoices?invoice=${id}&notice=email-status-error`);
  }

  await logAdminAudit(supabase, { action: `${kind}.${action}`, entityType: "invoice", entityId: id, summary: `${action} ${invoice.invoice_number}` });
  revalidatePath("/admin/invoices");
  revalidatePath(`/invoice/${invoice.public_token}`);
  redirect(`/admin/invoices?invoice=${id}&notice=${action}`);
}

const paymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.coerce.number().finite().positive().max(100_000_000),
  method: z.enum(paymentMethods),
  received_on: z.string().date(),
  reference: z.string().trim().max(160),
  note: z.string().trim().max(800),
});

export async function recordPaymentAction(formData: FormData) {
  const supabase = await admin();
  const parsed = paymentSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    received_on: formData.get("received_on"),
    reference: String(formData.get("reference") || ""),
    note: String(formData.get("note") || ""),
  });
  if (!parsed.success) redirect("/admin/invoices?notice=invalid");
  const input = parsed.data;
  if (input.received_on > invoiceDate()) redirect(`/admin/invoices?invoice=${input.invoice_id}&notice=invalid`);
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", input.invoice_id).maybeSingle();
  if (!invoice || billingDocumentKind(invoice) !== "invoice" || invoice.status === "void") redirect(`/admin/invoices?invoice=${input.invoice_id}&notice=payment-locked`);
  const events = await fetchLedger(supabase, input.invoice_id);
  const before = paymentTotals(invoice, events);
  const amountCents = Math.round(input.amount * 100);
  if (amountCents > before.balance) redirect(`/admin/invoices?invoice=${input.invoice_id}&notice=payment-too-high`);
  const paymentId = randomUUID();
  const logged = await insertLedgerEvent(supabase, {
    action: "invoice.payment.record",
    entityId: input.invoice_id,
    summary: `Recorded ${amountCents} cents for ${invoice.invoice_number}`,
    metadata: { payment_id: paymentId, amount_cents: amountCents, method: input.method, received_on: input.received_on, reference: input.reference, note: input.note },
  });
  if (!logged) redirect(`/admin/invoices?invoice=${input.invoice_id}&notice=ledger-error`);
  const settled = amountCents === before.balance;
  const { error } = await supabase.from("invoices").update({
    status: settled ? "paid" : invoice.status === "draft" ? "sent" : invoice.status,
    paid_at: settled ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", input.invoice_id);
  if (error) redirect(`/admin/invoices?invoice=${input.invoice_id}&notice=payment-status-error`);
  revalidatePath("/admin/invoices");
  revalidatePath(`/invoice/${invoice.public_token}`);
  redirect(`/admin/invoices?invoice=${input.invoice_id}&notice=payment-recorded`);
}

export async function reversePaymentAction(formData: FormData) {
  const supabase = await admin();
  const invoiceId = String(formData.get("invoice_id") || "");
  const paymentId = String(formData.get("payment_id") || "");
  if (!z.string().uuid().safeParse(invoiceId).success || !z.string().uuid().safeParse(paymentId).success) redirect("/admin/invoices?notice=invalid");
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) redirect("/admin/invoices?notice=missing");
  const events = await fetchLedger(supabase, invoiceId);
  const payment = paymentTotals(invoice, events).entries.find((entry) => entry.paymentId === paymentId && !entry.reversed);
  if (!payment) redirect(`/admin/invoices?invoice=${invoiceId}&notice=payment-missing`);
  const logged = await insertLedgerEvent(supabase, {
    action: "invoice.payment.reverse",
    entityId: invoiceId,
    summary: `Reversed payment on ${invoice.invoice_number}`,
    metadata: { payment_id: paymentId, amount_cents: payment.amountCents, reason: String(formData.get("reason") || "Correction").slice(0, 400) },
  });
  if (!logged) redirect(`/admin/invoices?invoice=${invoiceId}&notice=ledger-error`);
  const { error } = await supabase.from("invoices").update({ status: "sent", paid_at: null, updated_at: new Date().toISOString() }).eq("id", invoiceId);
  if (error) redirect(`/admin/invoices?invoice=${invoiceId}&notice=payment-status-error`);
  revalidatePath("/admin/invoices");
  revalidatePath(`/invoice/${invoice.public_token}`);
  redirect(`/admin/invoices?invoice=${invoiceId}&notice=payment-reversed`);
}

const rateSchema = z.object({
  id: z.union([z.string().uuid(), z.literal("")]),
  client_id: z.union([z.string().uuid(), z.literal("")]),
  service_name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  work_context: z.string().trim().min(1).max(60),
  unit: z.string().trim().min(1).max(40),
  rate: z.coerce.number().finite().min(0).max(1_000_000),
});

export async function saveRateAction(formData: FormData) {
  const supabase = await admin();
  const parsed = rateSchema.safeParse({ id: String(formData.get("id") || ""), client_id: String(formData.get("client_id") || ""), service_name: String(formData.get("service_name") || ""), category: String(formData.get("category") || "Other"), work_context: String(formData.get("work_context") || "Any"), unit: String(formData.get("unit") || "hour"), rate: formData.get("rate") });
  if (!parsed.success) redirect("/admin/invoices?tab=rates&notice=invalid");
  const { id, client_id, rate, ...details } = parsed.data;
  const row = { ...details, client_id: client_id || null, rate_cents: Math.round(rate * 100), is_active: true, updated_at: new Date().toISOString() };
  const result = id ? await supabase.from("client_rates").update(row).eq("id", id) : await supabase.from("client_rates").insert(row);
  if (result.error) redirect("/admin/invoices?tab=rates&notice=error");
  await logAdminAudit(supabase, { action: id ? "invoice_rate.update" : "invoice_rate.create", entityType: "client_rate", entityId: id || undefined, summary: `${id ? "Updated" : "Created"} ${details.service_name}` });
  revalidatePath("/admin/invoices");
  redirect("/admin/invoices?tab=rates&notice=rate-saved");
}

export async function deleteRateAction(formData: FormData) {
  const supabase = await admin();
  const id = String(formData.get("id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin/invoices?tab=rates&notice=invalid");
  const { data: rate } = await supabase.from("client_rates").select("service_name").eq("id", id).maybeSingle();
  const { error } = await supabase.from("client_rates").delete().eq("id", id);
  if (error) redirect("/admin/invoices?tab=rates&notice=error");
  await logAdminAudit(supabase, { action: "invoice_rate.delete", entityType: "client_rate", entityId: id, summary: `Deleted ${rate?.service_name || "invoice rate"}` });
  revalidatePath("/admin/invoices");
  redirect("/admin/invoices?tab=rates&notice=rate-deleted");
}

const settingsSchema = z.object({
  business_name: z.string().trim().min(1).max(160),
  issuer_name: z.string().trim().min(1).max(160),
  email: z.union([z.string().trim().email(), z.literal("")]),
  phone: z.string().trim().max(80),
  address: z.string().trim().max(800),
  abn: z.string().trim().max(40),
  pay_id: z.string().trim().max(160),
  bank_name: z.string().trim().max(160),
  account_name: z.string().trim().max(160),
  bsb: z.string().trim().max(20),
  account_number: z.string().trim().max(40),
  invoice_prefix: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9]+$/),
  default_due_days: z.coerce.number().int().min(0).max(365),
  default_gst_rate: z.coerce.number().min(0).max(100),
  default_notes: z.string().trim().max(4000),
});

export async function saveSettingsAction(formData: FormData) {
  const supabase = await admin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect("/admin/invoices?tab=settings&notice=invalid");
  const values = parsed.data;
  const nullable = (value: string) => value || null;
  const { error } = await supabase.from("invoice_settings").upsert({
    id: "main",
    ...values,
    email: nullable(values.email), phone: nullable(values.phone), address: nullable(values.address), abn: nullable(values.abn), pay_id: nullable(values.pay_id), bank_name: nullable(values.bank_name), account_name: nullable(values.account_name), bsb: nullable(values.bsb), account_number: nullable(values.account_number), default_notes: nullable(values.default_notes), invoice_prefix: values.invoice_prefix.toUpperCase(), updated_at: new Date().toISOString(),
  });
  if (error) redirect("/admin/invoices?tab=settings&notice=error");
  await logAdminAudit(supabase, { action: "invoice_settings.update", entityType: "invoice_settings", entityId: "main", summary: "Updated billing settings" });
  revalidatePath("/admin/invoices");
  redirect("/admin/invoices?tab=settings&notice=settings-saved");
}
