/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCommandMenu } from "@/components/admin/AdminCommandMenu";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { InvoiceComposer } from "@/components/admin/InvoiceComposer";
import { isAdminEmailAllowed } from "@/lib/admin-auth";
import {
  aud,
  invoiceCategories,
  invoiceContexts,
  invoiceDisplayStatus,
  invoiceUnits,
} from "@/lib/invoices";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "../actions";
import {
  createInvoiceAction,
  deleteRateAction,
  invoiceStatusAction,
  saveRateAction,
  saveSettingsAction,
} from "./actions";
import styles from "./invoices.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Invoices | Admin",
  robots: { index: false, follow: false },
};

type InvoiceSearchParams = {
  tab?: string;
  invoice?: string;
  notice?: string;
  q?: string;
  status?: string;
  rate?: string;
  edit?: string;
};

const tabs = [
  { key: "register", label: "Invoice register", href: "/admin/invoices" },
  { key: "new", label: "New invoice", href: "/admin/invoices?tab=new" },
  { key: "rates", label: "Rate book", href: "/admin/invoices?tab=rates" },
  { key: "settings", label: "Billing settings", href: "/admin/invoices?tab=settings" },
] as const;

const noticeMessages: Record<string, string> = {
  created: "Draft invoice created.",
  sent: "Invoice email sent and delivery status updated.",
  paid: "Invoice marked as paid.",
  void: "Invoice voided.",
  reopen: "Invoice reopened as a draft.",
  deleted: "Invoice deleted.",
  "rate-saved": "Rate saved.",
  "rate-deleted": "Rate deleted.",
  "settings-saved": "Billing settings saved.",
  "email-error": "The invoice could not be emailed. Check the email provider and try again.",
  invalid: "Some required information is missing or invalid.",
  setup: "Invoice database setup is incomplete.",
  error: "The invoice could not be saved. Try again.",
  missing: "That invoice no longer exists.",
};

function currentTab(tab?: string) {
  return ["new", "rates", "settings"].includes(tab ?? "") ? tab! : "register";
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<InvoiceSearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");
  if (!isAdminEmailAllowed(user.email)) {
    redirect("/admin/login?error=unauthorized");
  }

  const [invoicesResult, clientsResult, ratesResult, settingsResult, albumsResult] =
    await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name,email,phone").order("name"),
      supabase.from("client_rates").select("*").order("sort_order").order("service_name"),
      supabase.from("invoice_settings").select("*").eq("id", "main").maybeSingle(),
      supabase.from("albums").select("id,title,slug").order("created_at", { ascending: false }),
    ]);

  const setupMissing = Boolean(
    invoicesResult.error || ratesResult.error || settingsResult.error,
  );
  const invoices = (invoicesResult.data ?? []) as any[];
  const clients = (clientsResult.data ?? []) as any[];
  const rates = (ratesResult.data ?? []) as any[];
  const albums = (albumsResult.data ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
  }>;
  const settings = settingsResult.data as any;
  const selectedInvoice = invoices.find((invoice) => invoice.id === params.invoice);
  const editingRate = rates.find((rate) => rate.id === params.rate);
  const showRateEditor = params.edit === "new" || Boolean(editingRate);
  const query = (params.q ?? "").trim().toLowerCase();
  const visibleInvoices = invoices.filter((invoice) => {
    const status = invoiceDisplayStatus(invoice.status, invoice.due_date);
    const statusMatches = !params.status || params.status === "all" || status === params.status;
    const searchMatches =
      !query ||
      [invoice.invoice_number, invoice.client_name, invoice.client_email, invoice.project_title]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    return statusMatches && searchMatches;
  });
  const selectedItems = selectedInvoice
    ? (
        await supabase
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", selectedInvoice.id)
          .order("sort_order")
      ).data ?? []
    : [];
  const overdueCount = invoices.filter(
    (invoice) => invoiceDisplayStatus(invoice.status, invoice.due_date) === "overdue",
  ).length;
  const outstandingCents = invoices
    .filter((invoice) => invoice.status === "sent")
    .reduce((sum, invoice) => sum + invoice.total_cents, 0);
  const paidCents = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.total_cents, 0);
  const activeTab = currentTab(params.tab);
  const notice = params.notice
    ? noticeMessages[params.notice] ?? params.notice.replaceAll("-", " ")
    : null;

  return (
    <AdminWorkspaceShell activeView="invoices" counts={{ invoices: overdueCount }}>
      <div className={styles.workspace}>
        <div className="admin-topbar">
          <div>
            <p className="eyebrow">Admin / Invoices</p>
            <p className="muted">
              {overdueCount
                ? `${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}`
                : "Accounts are up to date"}
            </p>
          </div>
          <div className="admin-topbar-actions">
            <AdminCommandMenu
              albums={albums}
              clients={clients.map(({ id, name, email }) => ({ id, name, email }))}
            />
            <form action={signOutAction}>
              <button className="button secondary" type="submit">Sign out</button>
            </form>
          </div>
        </div>

        <header className="admin-page-header">
          <div>
            <span className="label">Finance</span>
            <h2>Invoices</h2>
            <p>Create, send, and reconcile freelance invoices from one register.</p>
          </div>
          <Link className="button small" href="/admin/invoices?tab=new">
            <FilePlus2 size={16} aria-hidden="true" /> New invoice
          </Link>
        </header>

        <nav className={styles.tabs} aria-label="Invoice sections">
          {tabs.map((tab) => (
            <Link
              aria-current={activeTab === tab.key ? "page" : undefined}
              className={activeTab === tab.key ? styles.activeTab : undefined}
              href={tab.href}
              key={tab.key}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {notice ? (
          <div className={styles.notice} role="status">
            <span>{notice}</span>
            <Link href={activeTab === "register" ? "/admin/invoices" : `/admin/invoices?tab=${activeTab}`}>
              Dismiss
            </Link>
          </div>
        ) : null}

        {setupMissing ? (
          <section className={styles.setup}>
            <h3>Database setup required</h3>
            <p>
              Apply <code>supabase/migrations/20260906_admin_invoicing.sql</code>, then refresh this page.
            </p>
          </section>
        ) : activeTab === "new" ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <span>Draft builder</span>
                <h3>Create an invoice</h3>
                <p>Select a saved client or enter one-off billing details, then add services.</p>
              </div>
            </div>
            <form action={createInvoiceAction}>
              <InvoiceComposer
                clients={clients}
                dueDays={settings?.default_due_days || 14}
                gstRate={Number(settings?.default_gst_rate || 0)}
                notes={settings?.default_notes || ""}
                rates={rates.filter((rate) => rate.is_active !== false)}
              />
            </form>
          </section>
        ) : activeTab === "rates" ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <span>Pricing library</span>
                <h3>Rate book</h3>
                <p>Maintain standard services and client-specific pricing.</p>
              </div>
              <Link className="button small" href="/admin/invoices?tab=rates&edit=new">
                <Plus size={16} aria-hidden="true" /> Add rate
              </Link>
            </div>

            {showRateEditor ? (
              <form className={styles.rateEditor} action={saveRateAction}>
                <div className={styles.editorHeading}>
                  <div>
                    <strong>{editingRate ? "Edit rate" : "New rate"}</strong>
                    <small>Client-specific entries override your standard service rate.</small>
                  </div>
                  <Link href="/admin/invoices?tab=rates">Cancel</Link>
                </div>
                <input name="id" type="hidden" value={editingRate?.id ?? ""} />
                <label>
                  Service name
                  <input name="service_name" required defaultValue={editingRate?.service_name ?? ""} placeholder="Photography coverage" />
                </label>
                <label>
                  Applies to
                  <select name="client_id" defaultValue={editingRate?.client_id ?? ""}>
                    <option value="">All clients</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </label>
                <label>
                  Service type
                  <select name="category" defaultValue={editingRate?.category ?? "Photography"}>
                    {invoiceCategories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <label>
                  Work setting
                  <select name="work_context" defaultValue={editingRate?.work_context ?? "On location"}>
                    {invoiceContexts.map((context) => <option key={context}>{context}</option>)}
                  </select>
                </label>
                <label>
                  Billing unit
                  <select name="unit" defaultValue={editingRate?.unit ?? "hour"}>
                    {invoiceUnits.map((unit) => <option key={unit}>{unit}</option>)}
                  </select>
                </label>
                <label>
                  Rate (AUD)
                  <input
                    min="0"
                    name="rate"
                    required
                    step="0.01"
                    type="number"
                    defaultValue={editingRate ? editingRate.rate_cents / 100 : ""}
                    placeholder="0.00"
                  />
                </label>
                <div className={styles.editorActions}>
                  <button className="button" type="submit">Save rate</button>
                </div>
              </form>
            ) : null}

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Service</th><th>Client</th><th>Type</th><th>Setting</th><th>Unit</th>
                    <th className={styles.number}>Rate</th><th><span className={styles.srOnly}>Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.id}>
                      <td><strong>{rate.service_name}</strong></td>
                      <td>{clients.find((client) => client.id === rate.client_id)?.name ?? "All clients"}</td>
                      <td>{rate.category}</td><td>{rate.work_context}</td><td>{rate.unit}</td>
                      <td className={styles.number}><strong>{aud(rate.rate_cents)}</strong></td>
                      <td className={styles.rowActions}>
                        <Link aria-label={`Edit ${rate.service_name}`} href={`/admin/invoices?tab=rates&rate=${rate.id}`}>
                          <Pencil size={15} aria-hidden="true" /> Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!rates.length ? (
                    <tr><td className={styles.emptyRow} colSpan={7}>No rates yet. Add your first standard or client rate.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {editingRate ? (
              <form className={styles.deleteRate} action={deleteRateAction}>
                <input name="id" type="hidden" value={editingRate.id} />
                <ConfirmSubmitButton
                  className="button danger small"
                  confirmMessage={`Delete the rate “${editingRate.service_name}”? Existing invoices will not change.`}
                >
                  <Trash2 size={15} aria-hidden="true" /> Delete selected rate
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </section>
        ) : activeTab === "settings" ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <span>Invoice defaults</span>
                <h3>Billing settings</h3>
                <p>These details are copied into each new invoice so historical invoices stay accurate.</p>
              </div>
            </div>
            <form className={styles.settings} action={saveSettingsAction}>
              <fieldset>
                <legend>Business identity</legend>
                <div className={styles.settingsGrid}>
                  <label>Business name<input name="business_name" defaultValue={settings?.business_name || "RXNCOR Studio"} /></label>
                  <label>Your name<input name="issuer_name" defaultValue={settings?.issuer_name || "Malindu Herath"} /></label>
                  <label>Billing email<input type="email" name="email" defaultValue={settings?.email || ""} /></label>
                  <label>Phone<input name="phone" defaultValue={settings?.phone || ""} /></label>
                  <label>ABN<input name="abn" defaultValue={settings?.abn || ""} /></label>
                  <label className={styles.wide}>Business address<textarea name="address" defaultValue={settings?.address || ""} /></label>
                </div>
              </fieldset>
              <fieldset>
                <legend>Payment instructions</legend>
                <div className={styles.settingsGrid}>
                  <label>PayID<input name="pay_id" defaultValue={settings?.pay_id || ""} placeholder="Mobile or email PayID" /></label>
                  <label>Bank<input name="bank_name" defaultValue={settings?.bank_name || ""} /></label>
                  <label>Account name<input name="account_name" defaultValue={settings?.account_name || ""} /></label>
                  <label>BSB<input name="bsb" inputMode="numeric" defaultValue={settings?.bsb || ""} /></label>
                  <label>Account number<input name="account_number" inputMode="numeric" defaultValue={settings?.account_number || ""} /></label>
                </div>
              </fieldset>
              <fieldset>
                <legend>Defaults</legend>
                <div className={styles.settingsGrid}>
                  <label>Invoice prefix<input name="invoice_prefix" defaultValue={settings?.invoice_prefix || "RX"} /></label>
                  <label>Payment due (days)<input type="number" min="0" name="default_due_days" defaultValue={settings?.default_due_days || 14} /></label>
                  <label>GST rate %<input type="number" min="0" max="100" step="0.1" name="default_gst_rate" defaultValue={settings?.default_gst_rate || 0} /></label>
                  <label className={styles.wide}>Default note<textarea name="default_notes" defaultValue={settings?.default_notes || ""} /></label>
                </div>
              </fieldset>
              <div className={styles.settingsActions}>
                <button className="button" type="submit">Save billing settings</button>
              </div>
            </form>
          </section>
        ) : (
          <>
            <div className={styles.metrics} aria-label="Invoice summary">
              <div><span>Total invoices</span><strong>{invoices.length}</strong></div>
              <div><span>Outstanding</span><strong>{aud(outstandingCents)}</strong></div>
              <div><span>Overdue</span><strong>{overdueCount}</strong></div>
              <div><span>Paid to date</span><strong>{aud(paidCents)}</strong></div>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <span>Accounts receivable</span>
                  <h3>Invoice register</h3>
                  <p>{visibleInvoices.length} of {invoices.length} invoices shown.</p>
                </div>
              </div>
              <form className={styles.filters}>
                <label className={styles.searchField}>
                  <Search size={16} aria-hidden="true" />
                  <span className={styles.srOnly}>Search invoices</span>
                  <input name="q" defaultValue={params.q} placeholder="Search invoice, client, email, or project" />
                </label>
                <label>
                  <span className={styles.srOnly}>Filter by status</span>
                  <select name="status" defaultValue={params.status || "all"}>
                    <option value="all">All statuses</option>
                    {(["draft", "sent", "overdue", "paid", "void"] as const).map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <button className="button secondary" type="submit">Apply</button>
                {params.q || (params.status && params.status !== "all") ? <Link href="/admin/invoices">Clear</Link> : null}
              </form>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Invoice</th><th>Client</th><th>Project</th><th>Issued</th><th>Due</th><th>Status</th><th className={styles.number}>Total</th><th><span className={styles.srOnly}>Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleInvoices.map((invoice) => {
                      const status = invoiceDisplayStatus(invoice.status, invoice.due_date);
                      return (
                        <tr className={selectedInvoice?.id === invoice.id ? styles.selected : undefined} key={invoice.id}>
                          <td><Link className={styles.invoiceLink} href={`/admin/invoices?invoice=${invoice.id}`}>{invoice.invoice_number}</Link></td>
                          <td><strong>{invoice.client_name}</strong><small>{invoice.client_email}</small></td>
                          <td>{invoice.project_title || "—"}</td><td>{invoice.issue_date}</td><td>{invoice.due_date}</td>
                          <td><span className={`${styles.status} ${styles[status]}`}>{status}</span></td>
                          <td className={styles.number}><strong>{aud(invoice.total_cents)}</strong></td>
                          <td className={styles.rowActions}>
                            <Link href={`/invoice/${invoice.public_token}`} target="_blank" rel="noreferrer">
                              <ExternalLink size={15} aria-hidden="true" /> Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    {!visibleInvoices.length ? (
                      <tr><td className={styles.emptyRow} colSpan={8}>No invoices match these filters.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedInvoice ? (
              <section className={styles.invoiceDetail} aria-label={`${selectedInvoice.invoice_number} actions`}>
                <div className={styles.detailHeading}>
                  <div>
                    <span>Selected invoice</span><h3>{selectedInvoice.invoice_number}</h3>
                    <p>{selectedInvoice.client_name} · {selectedInvoice.project_title || "No project title"}</p>
                  </div>
                  <Link href="/admin/invoices">Close</Link>
                </div>
                <dl className={styles.detailSummary}>
                  <div><dt>Status</dt><dd><span className={`${styles.status} ${styles[invoiceDisplayStatus(selectedInvoice.status, selectedInvoice.due_date)]}`}>{invoiceDisplayStatus(selectedInvoice.status, selectedInvoice.due_date)}</span></dd></div>
                  <div><dt>Recipient</dt><dd>{selectedInvoice.client_email}</dd></div>
                  <div><dt>Due</dt><dd>{selectedInvoice.due_date}</dd></div>
                  <div><dt>Total</dt><dd>{aud(selectedInvoice.total_cents)}</dd></div>
                </dl>
                {selectedItems.length ? (
                  <div className={styles.detailLines}>
                    {selectedItems.map((item: any) => (
                      <div key={item.id}><span>{item.description}<small>{item.quantity} {item.unit}</small></span><strong>{aud(item.line_total_cents)}</strong></div>
                    ))}
                  </div>
                ) : null}
                <form className={styles.invoiceActions} action={invoiceStatusAction}>
                  <input type="hidden" name="invoice_id" value={selectedInvoice.id} />
                  {selectedInvoice.status !== "paid" && selectedInvoice.status !== "void" ? (
                    <ConfirmSubmitButton
                      className="button"
                      confirmMessage={`Email ${selectedInvoice.invoice_number} to ${selectedInvoice.client_name} at ${selectedInvoice.client_email}?`}
                      name="invoice_action"
                      value="send"
                    >
                      <Mail size={15} aria-hidden="true" /> Send invoice email
                    </ConfirmSubmitButton>
                  ) : null}
                  {selectedInvoice.status === "sent" ? (
                    <button className="button secondary" name="invoice_action" value="paid" type="submit"><CheckCircle2 size={15} aria-hidden="true" /> Mark paid</button>
                  ) : null}
                  {selectedInvoice.status !== "void" ? (
                    <ConfirmSubmitButton className="button secondary" confirmMessage={`Void ${selectedInvoice.invoice_number}?`} name="invoice_action" value="void">
                      Void invoice
                    </ConfirmSubmitButton>
                  ) : (
                    <button className="button secondary" name="invoice_action" value="reopen" type="submit">Reopen draft</button>
                  )}
                  {["draft", "void"].includes(selectedInvoice.status) ? (
                    <ConfirmSubmitButton className="button danger" confirmMessage={`Permanently delete ${selectedInvoice.invoice_number}?`} name="invoice_action" value="delete">
                      <Trash2 size={15} aria-hidden="true" /> Delete
                    </ConfirmSubmitButton>
                  ) : null}
                </form>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AdminWorkspaceShell>
  );
}
