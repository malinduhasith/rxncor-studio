/* eslint-disable @typescript-eslint/no-explicit-any */
import { CheckCircle2, CircleAlert, Clock3 } from "lucide-react";
import { notFound } from "next/navigation";
import { DocumentViewTracker } from "@/components/DocumentViewTracker";
import { PrintInvoiceButton } from "@/components/PrintInvoiceButton";
import {
  aud,
  billingDocumentKind,
  estimateDecision,
  paymentTotals,
  snapshotValue,
  type InvoiceLedgerEvent,
} from "@/lib/invoices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { estimateDecisionAction } from "./actions";
import styles from "./invoice.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing document | RXNCOR", robots: { index: false, follow: false } };

const decisionMessages: Record<string, string> = {
  accepted: "Thank you. Your acceptance has been recorded and RXNCOR has been notified.",
  declined: "Your decision has been recorded and RXNCOR has been notified.",
  invalid: "Enter your name and tick the confirmation box before submitting.",
  "rate-limited": "Too many attempts were made. Please wait and try again.",
  unavailable: "This estimate can no longer accept a decision.",
  "already-recorded": "A decision has already been recorded for this estimate.",
  error: "The decision could not be recorded. Please try again or reply to the email.",
};

function prettyDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "long", timeZone: "Australia/Melbourne" }).format(new Date(`${value}T00:00:00+10:00`));
}

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ decision?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const db = createSupabaseAdminClient();
  const { data: invoice } = await db.from("invoices").select("*").eq("public_token", token).maybeSingle();
  if (!invoice) notFound();
  const [{ data: items }, { data: auditRows }] = await Promise.all([
    db.from("invoice_items").select("*").eq("invoice_id", invoice.id).order("sort_order"),
    db.from("admin_audit_logs").select("id,action,entity_id,summary,metadata,created_at").eq("entity_type", "invoice").eq("entity_id", invoice.id).order("created_at", { ascending: false }),
  ]);
  const events = (auditRows ?? []) as InvoiceLedgerEvent[];
  const kind = billingDocumentKind(invoice);
  const isEstimate = kind === "estimate";
  const label = isEstimate ? "Estimate" : invoice.gst_cents > 0 && invoice.issuer_snapshot?.abn ? "Tax invoice" : "Invoice";
  const issuer = invoice.issuer_snapshot || {};
  const payment = invoice.payment_snapshot || {};
  const totals = paymentTotals(invoice, events);
  const decision = isEstimate ? estimateDecision(events) : null;
  const discountCents = snapshotValue<number>(invoice, "discount_cents", 0);
  const depositPercent = snapshotValue<number>(invoice, "deposit_percent", 0);
  const depositCents = Math.round(invoice.total_cents * depositPercent / 100);
  const purchaseOrder = snapshotValue<string>(invoice, "purchase_order", "");
  const finalDate = isEstimate ? snapshotValue(invoice, "valid_until", invoice.due_date) : invoice.due_date;
  const isOverdue = !isEstimate && totals.balance > 0 && invoice.status === "sent" && invoice.due_date < new Date().toISOString().slice(0, 10);
  const hasPaymentDetails = !isEstimate && (payment.pay_id || (payment.bsb && payment.account_number));

  return (
    <main className={styles.shell}>
      <DocumentViewTracker token={token} />
      <div className={styles.tools}><span>Secure client document</span><PrintInvoiceButton /></div>
      {query.decision && decisionMessages[query.decision] ? <div className={styles.message} role="status">{decisionMessages[query.decision]}</div> : null}
      <article className={styles.invoice}>
        {invoice.status === "void" ? <div className={styles.void}>VOID</div> : null}
        <header className={styles.header}>
          <div className={styles.brand}><b>RXNCOR</b><span>PHOTO / VIDEO / PRODUCTION</span></div>
          <div className={styles.documentTitle}><span>{invoice.invoice_number}</span><h1>{label}</h1></div>
        </header>

        {decision || isOverdue || totals.balance === 0 && !isEstimate ? (
          <div className={`${styles.stateBanner} ${decision === "declined" || isOverdue ? styles.stateWarning : ""}`}>
            {decision === "accepted" || decision === "converted" || totals.balance === 0 ? <CheckCircle2 size={20} /> : decision === "declined" || isOverdue ? <CircleAlert size={20} /> : <Clock3 size={20} />}
            <div>
              <strong>{decision === "accepted" ? "Estimate accepted" : decision === "declined" ? "Estimate declined" : decision === "converted" ? "Converted to invoice" : totals.balance === 0 ? "Paid in full" : "Payment overdue"}</strong>
              <span>{decision ? "This client decision is recorded in the studio activity log." : totals.balance === 0 ? "Thank you. No balance remains on this invoice." : `The remaining balance is ${aud(totals.balance)}.`}</span>
            </div>
          </div>
        ) : null}

        <section className={styles.meta}>
          <div><small>FROM</small><strong>{issuer.business_name || "RXNCOR Studio"}</strong><span>{issuer.issuer_name || "Malindu Herath"}</span><span>{issuer.email}</span><span>{issuer.phone}</span><span>{issuer.address}</span>{issuer.abn ? <span>ABN {issuer.abn}</span> : null}</div>
          <div><small>{isEstimate ? "PREPARED FOR" : "BILL TO"}</small><strong>{invoice.client_name}</strong><span>{invoice.client_email}</span><span>{invoice.client_phone}</span><span>{invoice.client_address}</span></div>
          <dl><dt>{label}</dt><dd>{invoice.invoice_number}</dd><dt>Issued</dt><dd>{prettyDate(invoice.issue_date)}</dd><dt>{isEstimate ? "Valid until" : "Due"}</dt><dd>{prettyDate(finalDate)}</dd>{invoice.project_title ? <><dt>Project</dt><dd>{invoice.project_title}</dd></> : null}{purchaseOrder ? <><dt>PO / ref</dt><dd>{purchaseOrder}</dd></> : null}</dl>
        </section>

        <div className={styles.tableWrap}>
          <table><thead><tr><th>Description</th><th>Setting</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{(items || []).map((item: any) => <tr key={item.id}><td><strong>{item.description}</strong><small>{item.category}</small></td><td>{item.work_context}</td><td>{item.quantity} {item.unit}</td><td>{aud(item.unit_price_cents)}</td><td>{aud(item.line_total_cents)}</td></tr>)}</tbody></table>
        </div>

        <div className={styles.summaryArea}>
          <div className={styles.commercialCopy}>{invoice.notes ? <div><small>PROJECT NOTE</small><p>{invoice.notes}</p></div> : null}{invoice.terms ? <div><small>TERMS</small><p>{invoice.terms}</p></div> : null}</div>
          <dl className={styles.totals}><dt>Subtotal</dt><dd>{aud(invoice.subtotal_cents)}</dd>{discountCents > 0 ? <><dt>Discount</dt><dd>−{aud(discountCents)}</dd></> : null}{invoice.gst_cents > 0 ? <><dt>GST ({invoice.gst_rate}%)</dt><dd>{aud(invoice.gst_cents)}</dd></> : null}<dt>Total AUD</dt><dd>{aud(invoice.total_cents)}</dd>{!isEstimate && totals.paid > 0 ? <><dt>Paid</dt><dd>−{aud(totals.paid)}</dd><dt className={styles.balance}>Balance</dt><dd className={styles.balance}>{aud(totals.balance)}</dd></> : null}{depositCents > 0 && totals.paid === 0 ? <><dt className={styles.deposit}>Deposit requested</dt><dd className={styles.deposit}>{aud(depositCents)}</dd></> : null}</dl>
        </div>

        {!isEstimate && totals.entries.length ? (
          <section className={styles.payments}><small>PAYMENT HISTORY</small><div>{totals.entries.map((entry) => <div className={entry.reversed ? styles.reversed : undefined} key={entry.paymentId}><span><strong>{entry.receivedOn}</strong><small>{entry.method}{entry.reference ? ` · ${entry.reference}` : ""}{entry.reversed ? " · Reversed" : ""}</small></span><b>{aud(entry.amountCents)}</b></div>)}</div></section>
        ) : null}

        {isEstimate && !decision && invoice.status !== "void" ? (
          <section className={styles.decision}>
            <div><small>CLIENT DECISION</small><h2>Approve this estimate</h2><p>Confirm your name, then accept or decline. RXNCOR will receive a time-stamped record.</p></div>
            <form action={estimateDecisionAction}>
              <input name="token" type="hidden" value={token} />
              <label>Your name<input name="confirmed_by" defaultValue={invoice.client_name} required /></label>
              <label className={styles.confirm}><input name="confirm" type="checkbox" required /> I am authorised to make this decision.</label>
              <div><button name="decision" value="accepted" type="submit">Accept estimate</button><button className={styles.decline} name="decision" value="declined" type="submit">Decline</button></div>
            </form>
          </section>
        ) : null}

        <footer className={styles.footer}>
          <div><small>{isEstimate ? "NEXT STEP" : "PAYMENT"}</small>{isEstimate ? <span>Accept the estimate above or reply to the email with any questions.</span> : hasPaymentDetails ? <>{payment.pay_id ? <strong>PayID {payment.pay_id}</strong> : null}{payment.bsb && payment.account_number ? <><span>{payment.bank_name || "Bank transfer"}</span><span>Account name {payment.account_name || issuer.issuer_name}</span><span>BSB {payment.bsb} · Account {payment.account_number}</span></> : null}<span>Reference {invoice.invoice_number}</span></> : <span>Contact RXNCOR for payment details.</span>}</div>
          <div><small>QUESTIONS</small><span>Reply to the delivery email or contact {issuer.email || "RXNCOR Studio"}.</span></div>
        </footer>
      </article>
    </main>
  );
}
