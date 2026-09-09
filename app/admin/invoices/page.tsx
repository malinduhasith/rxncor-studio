/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CheckCircle2,
  CopyPlus,
  ExternalLink,
  FileDown,
  FilePlus2,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { AdminCommandMenu } from "@/components/admin/AdminCommandMenu";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { InvoiceComposer, type InvoiceComposerInitial } from "@/components/admin/InvoiceComposer";
import { isAdminEmailAllowed } from "@/lib/admin-auth";
import {
  agingBucket,
  aud,
  billingDocumentKind,
  documentDisplayStatus,
  estimateDecision,
  invoiceCategories,
  invoiceContexts,
  invoiceDate,
  invoiceUnits,
  paymentEntries,
  paymentMethods,
  paymentTotals,
  snapshotValue,
  type AgingBucket,
  type InvoiceLedgerEvent,
} from "@/lib/invoices";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readInvoiceLedger } from "@/lib/invoice-ledger";
import { signOutAction } from "../actions";
import {
  convertEstimateAction,
  createInvoiceAction,
  deleteRateAction,
  duplicateInvoiceAction,
  invoiceStatusAction,
  recordPaymentAction,
  reversePaymentAction,
  saveRateAction,
  saveSettingsAction,
  updateInvoiceAction,
} from "./actions";
import styles from "./invoices.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing | Admin", robots: { index: false, follow: false } };

type InvoiceSearchParams = {
  tab?: string;
  invoice?: string;
  notice?: string;
  q?: string;
  status?: string;
  rate?: string;
  edit?: string;
  kind?: string;
  client?: string;
  leadName?: string;
  leadEmail?: string;
  leadPhone?: string;
  project?: string;
};

const tabs = [
  { key: "register", label: "Billing register", href: "/admin/invoices" },
  { key: "new", label: "New document", href: "/admin/invoices?tab=new" },
  { key: "estimates", label: "Estimates", href: "/admin/invoices?tab=estimates" },
  { key: "payments", label: "Payments & aging", href: "/admin/invoices?tab=payments" },
  { key: "rates", label: "Rate book", href: "/admin/invoices?tab=rates" },
  { key: "settings", label: "Settings", href: "/admin/invoices?tab=settings" },
] as const;

const noticeMessages: Record<string, string> = {
  created: "Draft document created. Nothing has been emailed.",
  updated: "Draft changes saved.",
  duplicated: "A new draft copy was created.",
  converted: "Estimate converted into a new draft invoice.",
  send: "Document email accepted by the email provider. Check delivery monitoring for its status.",
  sent: "Document email accepted by the email provider.",
  resend: "Document email sent again.",
  reminder: "Payment reminder sent.",
  void: "Document voided.",
  reopen: "Document reopened as a draft.",
  deleted: "Draft document deleted.",
  "payment-recorded": "Payment recorded in the append-only ledger.",
  "payment-reversed": "Payment reversal recorded. The original entry remains in history.",
  "payment-too-high": "Payment cannot exceed the remaining balance.",
  "payment-missing": "That payment is missing or has already been reversed.",
  "payment-locked": "Payments can only be recorded against an active invoice.",
  "payment-status-error": "The payment was recorded, but the invoice status could not be refreshed. Review the ledger before retrying.",
  "ledger-error": "The financial ledger could not be saved. No payment or decision was recorded.",
  "void-payment": "Reverse recorded payments before voiding this invoice.",
  "delete-locked": "Only unpaid drafts or void documents can be deleted.",
  "edit-locked": "Sent, paid, and void documents are locked. Duplicate one to make changes.",
  "type-locked": "A numbered document cannot change type. Duplicate it instead.",
  "convert-locked": "A declined or already converted estimate cannot be converted. Reopen a declined estimate first.",
  "send-locked": "A void document cannot be sent.",
  "rate-saved": "Rate saved.",
  "rate-deleted": "Rate deleted.",
  "settings-saved": "Billing settings saved.",
  "email-error": "Email could not be sent. Check email monitoring before retrying.",
  "pdf-error": "The invoice PDF could not be prepared. No email was sent. Please try again.",
  "email-status-error": "The email provider accepted the email, but the document status could not be updated. Check email monitoring before sending again.",
  invalid: "Some required information is missing or invalid.",
  setup: "Invoice database setup is incomplete.",
  error: "The action could not be completed. Nothing was intentionally sent.",
  missing: "That document no longer exists.",
};

const agingOrder: AgingBucket[] = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"];

function currentTab(tab?: string) {
  return tabs.some((item) => item.key === tab) ? tab! : "register";
}

function plusDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Melbourne" }).format(new Date(value));
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<InvoiceSearchParams> }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(siteConfig.routes.adminLogin);
  if (!isAdminEmailAllowed(user.email)) redirect(`${siteConfig.routes.adminLogin}?error=unauthorized`);

  const [invoicesResult, clientsResult, ratesResult, settingsResult, albumsResult, auditResult] = await Promise.all([
    supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("id,name,email,phone").order("name"),
    supabase.from("client_rates").select("*").order("sort_order").order("service_name"),
    supabase.from("invoice_settings").select("*").eq("id", "main").maybeSingle(),
    supabase.from("albums").select("id,title,slug").order("created_at", { ascending: false }),
    readInvoiceLedger(supabase),
  ]);

  const setupMissing = Boolean(invoicesResult.error || ratesResult.error || settingsResult.error || auditResult.error);
  const invoices = (invoicesResult.data ?? []) as any[];
  const clients = (clientsResult.data ?? []) as any[];
  const rates = (ratesResult.data ?? []) as any[];
  const settings = settingsResult.data as any;
  const albums = (albumsResult.data ?? []) as Array<{ id: string; title: string; slug: string }>;
  const auditEvents = (auditResult.data ?? []) as InvoiceLedgerEvent[];
  const eventsByInvoice = new Map<string, InvoiceLedgerEvent[]>();
  for (const event of auditEvents) {
    if (!event.entity_id) continue;
    const current = eventsByInvoice.get(event.entity_id) ?? [];
    current.push(event);
    eventsByInvoice.set(event.entity_id, current);
  }

  const selectedInvoice = invoices.find((invoice) => invoice.id === params.invoice);
  const selectedItems = selectedInvoice ? (await supabase.from("invoice_items").select("*").eq("invoice_id", selectedInvoice.id).order("sort_order")).data ?? [] : [];
  const selectedEvents = selectedInvoice ? eventsByInvoice.get(selectedInvoice.id) ?? [] : [];
  const selectedPayment = selectedInvoice ? paymentTotals(selectedInvoice, selectedEvents) : null;
  const selectedKind = selectedInvoice ? billingDocumentKind(selectedInvoice) : null;
  const hasPaymentSidebar = Boolean((selectedKind === "invoice" && selectedInvoice?.status !== "void" && (selectedPayment?.balance ?? 0) > 0) || selectedPayment?.entries.length);
  const editingRate = rates.find((rate) => rate.id === params.rate);
  const showRateEditor = params.edit === "new" || Boolean(editingRate);
  const activeTab = params.edit === "document" && selectedInvoice ? "new" : currentTab(params.tab);
  const today = invoiceDate();
  const defaultDueDate = plusDays(today, Number(settings?.default_due_days ?? 14));
  const prefillClient = clients.find((client) => client.id === params.client);

  const initial: InvoiceComposerInitial = selectedInvoice && params.edit === "document"
    ? {
        documentKind: billingDocumentKind(selectedInvoice),
        clientId: selectedInvoice.client_id ?? "",
        clientName: selectedInvoice.client_name,
        clientEmail: selectedInvoice.client_email,
        clientPhone: selectedInvoice.client_phone ?? "",
        clientAddress: selectedInvoice.client_address ?? "",
        projectTitle: selectedInvoice.project_title ?? "",
        purchaseOrder: snapshotValue(selectedInvoice, "purchase_order", ""),
        issueDate: selectedInvoice.issue_date,
        dueDate: selectedInvoice.due_date,
        validUntil: snapshotValue(selectedInvoice, "valid_until", selectedInvoice.due_date),
        gstRate: Number(selectedInvoice.gst_rate),
        discountKind: snapshotValue(selectedInvoice, "discount_kind", "none"),
        discountValue: Number(snapshotValue(selectedInvoice, "discount_value", 0)),
        depositPercent: Number(snapshotValue(selectedInvoice, "deposit_percent", 0)),
        notes: selectedInvoice.notes ?? "",
        terms: selectedInvoice.terms ?? "",
        lines: selectedItems.map((item: any) => ({ description: item.description, category: item.category, work_context: item.work_context, quantity: Number(item.quantity), unit: item.unit, unit_price_cents: item.unit_price_cents })),
      }
    : {
        documentKind: params.kind === "estimate" ? "estimate" : "invoice",
        clientId: prefillClient?.id ?? "",
        clientName: prefillClient?.name ?? params.leadName ?? "",
        clientEmail: prefillClient?.email ?? params.leadEmail ?? "",
        clientPhone: prefillClient?.phone ?? params.leadPhone ?? "",
        projectTitle: params.project ?? "",
        issueDate: today,
        dueDate: defaultDueDate,
        validUntil: defaultDueDate,
        gstRate: Number(settings?.default_gst_rate || 0),
        notes: settings?.default_notes || "",
      };

  const query = (params.q ?? "").trim().toLowerCase();
  const visibleInvoices = invoices.filter((invoice) => {
    const events = eventsByInvoice.get(invoice.id) ?? [];
    const baseStatus = documentDisplayStatus(invoice, events);
    const status = baseStatus === "sent" && events.some((event) => event.action === "invoice.view") ? "viewed" : baseStatus;
    const kind = billingDocumentKind(invoice);
    const statusMatches = !params.status || params.status === "all" || status === params.status;
    const kindMatches = !params.kind || params.kind === "all" || kind === params.kind;
    const searchMatches = !query || [invoice.invoice_number, invoice.client_name, invoice.client_email, invoice.project_title].some((value) => String(value ?? "").toLowerCase().includes(query));
    return statusMatches && kindMatches && searchMatches;
  });

  const invoiceDocuments = invoices.filter((invoice) => billingDocumentKind(invoice) === "invoice" && invoice.status !== "void");
  const estimates = invoices.filter((invoice) => billingDocumentKind(invoice) === "estimate");
  const outstandingInvoices = invoiceDocuments.filter((invoice) => paymentTotals(invoice, eventsByInvoice.get(invoice.id) ?? []).balance > 0 && invoice.status !== "draft");
  const outstandingCents = outstandingInvoices.reduce((sum, invoice) => sum + paymentTotals(invoice, eventsByInvoice.get(invoice.id) ?? []).balance, 0);
  const overdueInvoices = outstandingInvoices.filter((invoice) => invoice.due_date < today);
  const paidCents = invoiceDocuments.reduce((sum, invoice) => sum + paymentTotals(invoice, eventsByInvoice.get(invoice.id) ?? []).paid, 0);
  const openEstimateCents = estimates.filter((estimate) => !estimateDecision(eventsByInvoice.get(estimate.id) ?? []) && estimate.status !== "void").reduce((sum, estimate) => sum + estimate.total_cents, 0);
  const aging = new Map<AgingBucket, number>(agingOrder.map((bucket) => [bucket, 0]));
  for (const invoice of outstandingInvoices) {
    const bucket = agingBucket(invoice.due_date);
    aging.set(bucket, (aging.get(bucket) ?? 0) + paymentTotals(invoice, eventsByInvoice.get(invoice.id) ?? []).balance);
  }
  const allPayments = invoices.flatMap((invoice) => paymentEntries(eventsByInvoice.get(invoice.id) ?? []).map((entry) => ({ ...entry, invoice })));
  const currentMonth = today.slice(0, 7);
  const paymentsReceivedThisMonth = allPayments.filter((entry) => entry.receivedOn.startsWith(currentMonth)).reduce((sum, entry) => sum + entry.amountCents, 0);
  const paymentsReversedThisMonth = auditEvents
    .filter((event) => event.action === "invoice.payment.reverse" && event.created_at.startsWith(currentMonth))
    .reduce((sum, event) => sum + Math.max(0, Number(event.metadata?.amount_cents || 0)), 0);
  const monthPaidCents = paymentsReceivedThisMonth - paymentsReversedThisMonth;
  const notice = params.notice ? noticeMessages[params.notice] ?? params.notice.replaceAll("-", " ") : null;

  return (
    <AdminWorkspaceShell activeView="invoices" counts={{ invoices: overdueInvoices.length }}>
      <div className={styles.workspace}>
        <div className="admin-topbar">
          <div><p className="eyebrow">Admin / Billing</p><p className="muted">{overdueInvoices.length ? `${overdueInvoices.length} overdue · ${aud(outstandingCents)} receivable` : "Accounts are up to date"}</p></div>
          <div className="admin-topbar-actions"><AdminCommandMenu albums={albums} clients={clients.map(({ id, name, email }) => ({ id, name, email }))} /><form action={signOutAction}><button className="button secondary" type="submit">Sign out</button></form></div>
        </div>

        <header className="admin-page-header">
          <div><span className="label">Finance operations</span><h2>Billing and receivables</h2><p>Estimates, approvals, invoicing, payments, client rates, reminders, and audit history.</p></div>
          <div className="inline-actions"><a className="button secondary small" href="/admin/invoices/export"><FileDown size={15} /> Export CSV</a><Link className="button secondary small" href="/admin/invoices?tab=new&kind=estimate"><FilePlus2 size={15} /> New estimate</Link><Link className="button small" href="/admin/invoices?tab=new&kind=invoice"><FilePlus2 size={15} /> New invoice</Link></div>
        </header>

        <nav className={styles.tabs} aria-label="Billing sections">{tabs.map((tab) => <Link aria-current={activeTab === tab.key ? "page" : undefined} className={activeTab === tab.key ? styles.activeTab : undefined} href={tab.href} key={tab.key}>{tab.label}</Link>)}</nav>
        {notice ? <div className={styles.notice} role="status"><span>{notice}</span><Link href={activeTab === "register" ? "/admin/invoices" : `/admin/invoices?tab=${activeTab}`}>Dismiss</Link></div> : null}

        {setupMissing ? (
          <section className={styles.setup}><h3>Billing data is unavailable</h3><p>Check the invoice migrations and authenticated database policies, then refresh. No finance action is available while the ledger cannot be read.</p></section>
        ) : activeTab === "new" ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><div><span>{selectedInvoice && params.edit === "document" ? "Edit draft" : "Document builder"}</span><h3>{selectedInvoice && params.edit === "document" ? `Edit ${selectedInvoice.invoice_number}` : "Create a billing document"}</h3><p>Build from a client rate, add production costs, then save privately for review.</p></div>{selectedInvoice ? <Link href={`/admin/invoices?invoice=${selectedInvoice.id}`}>Cancel</Link> : null}</div>
            <form action={selectedInvoice && params.edit === "document" ? updateInvoiceAction : createInvoiceAction}>
              {selectedInvoice && params.edit === "document" ? <input name="invoice_id" type="hidden" value={selectedInvoice.id} /> : null}
              <InvoiceComposer clients={clients} initial={initial} lockDocumentKind={Boolean(selectedInvoice && params.edit === "document")} rates={rates.filter((rate) => rate.is_active !== false)} submitLabel={selectedInvoice && params.edit === "document" ? "Save draft changes" : "Create draft"} />
            </form>
          </section>
        ) : activeTab === "rates" ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><div><span>Pricing library</span><h3>Rate book</h3><p>Standard services plus client-specific rates for studio, location, editing, equipment, licensing, and more.</p></div><Link className="button small" href="/admin/invoices?tab=rates&edit=new"><Plus size={15} /> Add rate</Link></div>
            {showRateEditor ? <form className={styles.rateEditor} action={saveRateAction}><div className={styles.editorHeading}><div><strong>{editingRate ? "Edit rate" : "New rate"}</strong><small>Client-specific entries appear only when that client is selected.</small></div><Link href="/admin/invoices?tab=rates">Cancel</Link></div><input name="id" type="hidden" value={editingRate?.id ?? ""} /><label>Service name<input name="service_name" required defaultValue={editingRate?.service_name ?? ""} /></label><label>Client<select name="client_id" defaultValue={editingRate?.client_id ?? ""}><option value="">Standard rate · all clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Category<select name="category" defaultValue={editingRate?.category ?? "Photography"}>{invoiceCategories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Setting<select name="work_context" defaultValue={editingRate?.work_context ?? "Any"}>{invoiceContexts.map((value) => <option key={value}>{value}</option>)}</select></label><label>Unit<select name="unit" defaultValue={editingRate?.unit ?? "hour"}>{invoiceUnits.map((value) => <option key={value}>{value}</option>)}</select></label><label>Rate AUD<input name="rate" type="number" min="0" step="0.01" required defaultValue={editingRate ? editingRate.rate_cents / 100 : ""} /></label><button className="button" type="submit">Save rate</button></form> : null}
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Service</th><th>Client</th><th>Category</th><th>Setting</th><th>Unit</th><th className={styles.number}>Rate</th><th>Action</th></tr></thead><tbody>{rates.map((rate) => <tr key={rate.id}><td><strong>{rate.service_name}</strong></td><td>{clients.find((client) => client.id === rate.client_id)?.name || "All clients"}</td><td>{rate.category}</td><td>{rate.work_context}</td><td>{rate.unit}</td><td className={styles.number}><strong>{aud(rate.rate_cents)}</strong></td><td className={styles.rowActions}><Link href={`/admin/invoices?tab=rates&rate=${rate.id}`}><Pencil size={14} /> Edit</Link></td></tr>)}{!rates.length ? <tr><td className={styles.emptyRow} colSpan={7}>No rates yet.</td></tr> : null}</tbody></table></div>
            {editingRate ? <form className={styles.deleteRate} action={deleteRateAction}><input name="id" type="hidden" value={editingRate.id} /><ConfirmSubmitButton className="button danger small" confirmMessage={`Delete “${editingRate.service_name}”? Existing documents will not change.`}><Trash2 size={14} /> Delete selected rate</ConfirmSubmitButton></form> : null}
          </section>
        ) : activeTab === "settings" ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><div><span>Business defaults</span><h3>Billing settings</h3><p>New documents take a locked snapshot of these details, preserving historical accuracy.</p></div></div>
            <form className={styles.settings} action={saveSettingsAction}>
              <fieldset><legend>Business identity</legend><div className={styles.settingsGrid}><label>Business name<input name="business_name" required defaultValue={settings?.business_name || "RXNCOR Studio"} /></label><label>Your name<input name="issuer_name" required defaultValue={settings?.issuer_name || "Malindu Herath"} /></label><label>Billing email<input type="email" name="email" defaultValue={settings?.email || ""} /></label><label>Phone<input name="phone" defaultValue={settings?.phone || ""} /></label><label>ABN<input name="abn" defaultValue={settings?.abn || ""} /></label><label className={styles.wide}>Business address<textarea name="address" defaultValue={settings?.address || ""} /></label></div></fieldset>
              <fieldset><legend>Payment instructions</legend><div className={styles.settingsGrid}><label>PayID<input name="pay_id" defaultValue={settings?.pay_id || ""} /></label><label>Bank<input name="bank_name" defaultValue={settings?.bank_name || ""} /></label><label>Account name<input name="account_name" defaultValue={settings?.account_name || ""} /></label><label>BSB<input name="bsb" inputMode="numeric" defaultValue={settings?.bsb || ""} /></label><label>Account number<input name="account_number" inputMode="numeric" defaultValue={settings?.account_number || ""} /></label></div></fieldset>
              <fieldset><legend>Defaults</legend><div className={styles.settingsGrid}><label>Invoice prefix<input name="invoice_prefix" required defaultValue={settings?.invoice_prefix || "RX"} /></label><label>Payment due (days)<input type="number" min="0" max="365" name="default_due_days" defaultValue={settings?.default_due_days || 14} /></label><label>GST rate %<input type="number" min="0" max="100" step="0.1" name="default_gst_rate" defaultValue={settings?.default_gst_rate || 0} /></label><label className={styles.wide}>Default note<textarea name="default_notes" defaultValue={settings?.default_notes || ""} /></label></div></fieldset>
              <div className={styles.settingsActions}><button className="button" type="submit">Save billing settings</button></div>
            </form>
          </section>
        ) : activeTab === "estimates" ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><div><span>Pre-sale workflow</span><h3>Estimate pipeline</h3><p>{estimates.length} estimates · {aud(openEstimateCents)} awaiting a decision.</p></div><Link className="button small" href="/admin/invoices?tab=new&kind=estimate">New estimate</Link></div>
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Estimate</th><th>Client</th><th>Project</th><th>Valid until</th><th>Decision</th><th className={styles.number}>Value</th><th>Next step</th></tr></thead><tbody>{estimates.map((estimate) => { const events = eventsByInvoice.get(estimate.id) ?? []; const decision = estimateDecision(events); return <tr key={estimate.id}><td><Link className={styles.invoiceLink} href={`/admin/invoices?invoice=${estimate.id}`}>{estimate.invoice_number}</Link></td><td><strong>{estimate.client_name}</strong><small>{estimate.client_email}</small></td><td>{estimate.project_title || "—"}</td><td>{snapshotValue(estimate, "valid_until", estimate.due_date)}</td><td><span className={`${styles.status} ${styles[decision || estimate.status]}`}>{decision || estimate.status}</span></td><td className={styles.number}><strong>{aud(estimate.total_cents)}</strong></td><td className={styles.rowActions}>{decision !== "converted" && estimate.status !== "void" ? <form action={convertEstimateAction}><input name="invoice_id" type="hidden" value={estimate.id} /><button type="submit">Convert to invoice</button></form> : <span>Complete</span>}</td></tr>; })}{!estimates.length ? <tr><td className={styles.emptyRow} colSpan={7}>No estimates yet. Create one from a client or lead.</td></tr> : null}</tbody></table></div>
          </section>
        ) : activeTab === "payments" ? (
          <>
            <div className={styles.metrics} aria-label="Receivables summary"><div><span>Outstanding</span><strong>{aud(outstandingCents)}</strong></div><div><span>Overdue</span><strong>{aud(overdueInvoices.reduce((sum, invoice) => sum + paymentTotals(invoice, eventsByInvoice.get(invoice.id) ?? []).balance, 0))}</strong></div><div><span>Collected this month</span><strong>{aud(monthPaidCents)}</strong></div><div><span>All recorded payments</span><strong>{aud(paidCents)}</strong></div></div>
            <section className={styles.section}><div className={styles.sectionHeader}><div><span>Accounts receivable</span><h3>Aging report</h3><p>Remaining invoice balances grouped by days past due.</p></div></div><div className={styles.aging}>{agingOrder.map((bucket) => <div key={bucket}><span>{bucket}</span><strong>{aud(aging.get(bucket) ?? 0)}</strong></div>)}</div></section>
            <section className={styles.section}><div className={styles.sectionHeader}><div><span>Immutable history</span><h3>Payment ledger</h3><p>Payments are reversed, never deleted, so corrections remain traceable.</p></div></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Received</th><th>Invoice</th><th>Client</th><th>Method</th><th>Reference</th><th>Status</th><th className={styles.number}>Amount</th></tr></thead><tbody>{allPayments.map((entry) => <tr key={entry.paymentId}><td>{entry.receivedOn}</td><td><Link className={styles.invoiceLink} href={`/admin/invoices?invoice=${entry.invoice.id}`}>{entry.invoice.invoice_number}</Link></td><td>{entry.invoice.client_name}</td><td>{entry.method}</td><td>{entry.reference || "—"}</td><td><span className={`${styles.status} ${entry.reversed ? styles.void : styles.paid}`}>{entry.reversed ? "reversed" : "received"}</span></td><td className={styles.number}><strong>{aud(entry.amountCents)}</strong></td></tr>)}{!allPayments.length ? <tr><td className={styles.emptyRow} colSpan={7}>No payments recorded yet.</td></tr> : null}</tbody></table></div></section>
          </>
        ) : (
          <>
            <div className={styles.metrics} aria-label="Billing summary"><div><span>Receivable</span><strong>{aud(outstandingCents)}</strong></div><div><span>Overdue</span><strong>{overdueInvoices.length}</strong></div><div><span>Open estimates</span><strong>{aud(openEstimateCents)}</strong></div><div><span>Collected</span><strong>{aud(paidCents)}</strong></div></div>
            <section className={styles.section}>
              <div className={styles.sectionHeader}><div><span>Financial documents</span><h3>Billing register</h3><p>{visibleInvoices.length} of {invoices.length} documents shown.</p></div></div>
              <form className={styles.filters}><label className={styles.searchField}><Search size={15} /><span className={styles.srOnly}>Search documents</span><input name="q" defaultValue={params.q} placeholder="Search number, client, email, or project" /></label><select aria-label="Document type" name="kind" defaultValue={params.kind || "all"}><option value="all">All document types</option><option value="invoice">Invoices</option><option value="estimate">Estimates</option></select><select aria-label="Status" name="status" defaultValue={params.status || "all"}><option value="all">All statuses</option>{["draft", "sent", "viewed", "overdue", "part-paid", "paid", "accepted", "declined", "converted", "void"].map((status) => <option key={status}>{status}</option>)}</select><button className="button secondary" type="submit">Apply</button>{params.q || params.kind || params.status ? <Link href="/admin/invoices">Clear</Link> : null}</form>
              <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Document</th><th>Client</th><th>Project</th><th>Issued</th><th>Due / valid</th><th>Status</th><th className={styles.number}>Total</th><th className={styles.number}>Balance</th><th>Action</th></tr></thead><tbody>{visibleInvoices.map((invoice) => { const events = eventsByInvoice.get(invoice.id) ?? []; const status = documentDisplayStatus(invoice, events); const kind = billingDocumentKind(invoice); const balances = paymentTotals(invoice, events); const viewed = events.some((event) => event.action === "invoice.view"); const displayStatus = status === "sent" && viewed ? "viewed" : status; return <tr className={selectedInvoice?.id === invoice.id ? styles.selected : undefined} key={invoice.id}><td><Link className={styles.invoiceLink} href={`/admin/invoices?invoice=${invoice.id}`}>{invoice.invoice_number}</Link><small>{kind}</small></td><td><strong>{invoice.client_name}</strong><small>{invoice.client_email}</small></td><td>{invoice.project_title || "—"}</td><td>{invoice.issue_date}</td><td>{kind === "estimate" ? snapshotValue(invoice, "valid_until", invoice.due_date) : invoice.due_date}</td><td><span className={`${styles.status} ${styles[displayStatus]}`}>{displayStatus}</span></td><td className={styles.number}><strong>{aud(invoice.total_cents)}</strong></td><td className={styles.number}>{kind === "invoice" ? aud(balances.balance) : "—"}</td><td className={styles.rowActions}><Link href={`/invoice/${invoice.public_token}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</Link></td></tr>; })}{!visibleInvoices.length ? <tr><td className={styles.emptyRow} colSpan={9}>No documents match these filters.</td></tr> : null}</tbody></table></div>
            </section>
            {selectedInvoice ? <section className={styles.invoiceDetail} aria-label={`${selectedInvoice.invoice_number} details`}>
              <div className={styles.detailHeading}><div><span>{selectedKind}</span><h3>{selectedInvoice.invoice_number}</h3><p>{selectedInvoice.client_name} · {selectedInvoice.project_title || "No project title"}</p></div><div className={styles.detailActions}><Link href={`/invoice/${selectedInvoice.public_token}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Client view</Link><Link href="/admin/invoices">Close</Link></div></div>
              <dl className={styles.detailSummary}><div><dt>Status</dt><dd><span className={`${styles.status} ${styles[documentDisplayStatus(selectedInvoice, selectedEvents)]}`}>{documentDisplayStatus(selectedInvoice, selectedEvents)}</span></dd></div><div><dt>Recipient</dt><dd>{selectedInvoice.client_email}</dd></div><div><dt>{selectedKind === "estimate" ? "Valid until" : "Due"}</dt><dd>{selectedKind === "estimate" ? snapshotValue(selectedInvoice, "valid_until", selectedInvoice.due_date) : selectedInvoice.due_date}</dd></div><div><dt>Total</dt><dd>{aud(selectedInvoice.total_cents)}</dd></div>{selectedKind === "invoice" ? <><div><dt>Paid</dt><dd>{aud(selectedPayment?.paid ?? 0)}</dd></div><div><dt>Balance</dt><dd>{aud(selectedPayment?.balance ?? selectedInvoice.total_cents)}</dd></div></> : <><div><dt>Decision</dt><dd>{estimateDecision(selectedEvents) || "Awaiting"}</dd></div><div><dt>Viewed</dt><dd>{selectedEvents.some((event) => event.action === "invoice.view") ? "Yes" : "Not yet"}</dd></div></>}</dl>
              <div className={`${styles.detailColumns} ${hasPaymentSidebar ? "" : styles.detailFullWidth}`}><div><div className={styles.detailLines}>{selectedItems.map((item: any) => <div key={item.id}><span>{item.description}<small>{item.quantity} {item.unit} · {item.work_context}</small></span><strong>{aud(item.line_total_cents)}</strong></div>)}</div><div className={styles.invoiceActions}>{selectedInvoice.status === "draft" ? <Link className="button secondary" href={`/admin/invoices?invoice=${selectedInvoice.id}&edit=document`}><Pencil size={14} /> Edit draft</Link> : null}{selectedInvoice.status !== "void" ? <form action={invoiceStatusAction}><input name="invoice_id" type="hidden" value={selectedInvoice.id} /><ConfirmSubmitButton className="button" confirmMessage={`Email ${selectedInvoice.invoice_number} to ${selectedInvoice.client_email}?`} name="invoice_action" value={selectedInvoice.status === "draft" ? "send" : "resend"}><Mail size={14} /> {selectedInvoice.status === "draft" ? "Send" : "Resend"}</ConfirmSubmitButton></form> : null}{selectedKind === "invoice" && selectedInvoice.status === "sent" && (selectedPayment?.balance ?? 0) > 0 ? <form action={invoiceStatusAction}><input name="invoice_id" type="hidden" value={selectedInvoice.id} /><ConfirmSubmitButton className="button secondary" confirmMessage={`Send a payment reminder to ${selectedInvoice.client_email}?`} name="invoice_action" value="reminder"><Send size={14} /> Reminder</ConfirmSubmitButton></form> : null}<form action={duplicateInvoiceAction}><input name="invoice_id" type="hidden" value={selectedInvoice.id} /><button className="button secondary" type="submit"><CopyPlus size={14} /> Duplicate</button></form>{selectedKind === "estimate" && estimateDecision(selectedEvents) !== "converted" && selectedInvoice.status !== "void" ? <form action={convertEstimateAction}><input name="invoice_id" type="hidden" value={selectedInvoice.id} /><button className="button secondary" type="submit">Convert to invoice</button></form> : null}{selectedInvoice.status !== "void" && (selectedPayment?.paid ?? 0) === 0 ? <form action={invoiceStatusAction}><input name="invoice_id" type="hidden" value={selectedInvoice.id} /><ConfirmSubmitButton className="button secondary" confirmMessage={`Void ${selectedInvoice.invoice_number}?`} name="invoice_action" value="void">Void</ConfirmSubmitButton></form> : selectedInvoice.status === "void" ? <form action={invoiceStatusAction}><input name="invoice_id" type="hidden" value={selectedInvoice.id} /><button className="button secondary" name="invoice_action" value="reopen" type="submit"><RotateCcw size={14} /> Reopen</button></form> : null}{["draft", "void"].includes(selectedInvoice.status) && (selectedPayment?.paid ?? 0) === 0 ? <form action={invoiceStatusAction}><input name="invoice_id" type="hidden" value={selectedInvoice.id} /><ConfirmSubmitButton className="button danger" confirmMessage={`Permanently delete ${selectedInvoice.invoice_number}?`} name="invoice_action" value="delete"><Trash2 size={14} /> Delete</ConfirmSubmitButton></form> : null}</div></div>
                {hasPaymentSidebar ? <aside>{selectedKind === "invoice" && selectedInvoice.status !== "void" && (selectedPayment?.balance ?? 0) > 0 ? <form className={styles.paymentForm} action={recordPaymentAction}><div><span>Payment entry</span><strong>Record money received</strong><small>Remaining balance {aud(selectedPayment?.balance ?? 0)}</small></div><input name="invoice_id" type="hidden" value={selectedInvoice.id} /><label>Amount AUD<input name="amount" required type="number" min="0.01" max={(selectedPayment?.balance ?? 0) / 100} step="0.01" defaultValue={(selectedPayment?.balance ?? 0) / 100} /></label><label>Received on<input name="received_on" required type="date" defaultValue={today} /></label><label>Method<select name="method" defaultValue="bank transfer">{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label><label>Reference<input name="reference" placeholder="Transfer reference" /></label><label className={styles.wide}>Internal note<input name="note" placeholder="Optional reconciliation note" /></label><button className="button" type="submit"><CheckCircle2 size={14} /> Record payment</button></form> : null}
                  {selectedPayment?.entries.length ? <div className={styles.paymentHistory}><div><span>Payment history</span><strong>Append-only ledger</strong></div>{selectedPayment.entries.map((entry) => <div className={entry.reversed ? styles.reversedPayment : undefined} key={entry.paymentId}><span><strong>{entry.receivedOn} · {entry.method}</strong><small>{entry.reference || entry.note || "No reference"}{entry.reversed ? " · Reversed" : ""}</small></span><b>{aud(entry.amountCents)}</b>{!entry.reversed ? <form action={reversePaymentAction}><input name="invoice_id" type="hidden" value={selectedInvoice.id} /><input name="payment_id" type="hidden" value={entry.paymentId} /><input name="reason" type="hidden" value="Admin correction" /><ConfirmSubmitButton confirmMessage={`Reverse the ${aud(entry.amountCents)} payment? The original stays in the audit history.`}><RotateCcw size={13} /> Reverse</ConfirmSubmitButton></form> : null}</div>)}</div> : null}</aside> : null}
              </div>
              <div className={styles.activity}><div><span>Activity</span><strong>Document history</strong></div>{selectedEvents.length ? selectedEvents.slice(0, 30).map((event) => <div key={event.id}><span>{event.summary}</span><time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time></div>) : <p>No activity recorded yet.</p>}</div>
            </section> : null}
          </>
        )}
      </div>
    </AdminWorkspaceShell>
  );
}
