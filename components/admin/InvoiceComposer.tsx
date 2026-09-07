"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  aud,
  invoiceCategories,
  invoiceContexts,
  invoiceTotals,
  invoiceUnits,
  type BillingDocumentKind,
  type DiscountKind,
} from "@/lib/invoices";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Rate = {
  id: string;
  client_id: string | null;
  service_name: string;
  category: string;
  work_context: string;
  unit: string;
  rate_cents: number;
};

export type InvoiceComposerLine = {
  id?: string;
  description: string;
  category: string;
  work_context: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
};

export type InvoiceComposerInitial = {
  documentKind?: BillingDocumentKind;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  projectTitle?: string;
  purchaseOrder?: string;
  issueDate: string;
  dueDate: string;
  validUntil?: string;
  gstRate?: number;
  discountKind?: DiscountKind;
  discountValue?: number;
  depositPercent?: number;
  notes?: string;
  terms?: string;
  lines?: InvoiceComposerLine[];
};

type InvoiceComposerProps = {
  clients: Client[];
  rates: Rate[];
  initial: InvoiceComposerInitial;
  submitLabel?: string;
  lockDocumentKind?: boolean;
};

type Line = InvoiceComposerLine & { id: string };

function blankLine(id: string): Line {
  return {
    id,
    description: "",
    category: "Photography",
    work_context: "On location",
    quantity: 1,
    unit: "hour",
    unit_price_cents: 0,
  };
}

function normaliseLines(lines: InvoiceComposerLine[] | undefined): Line[] {
  if (!lines?.length) return [blankLine("line-0")];
  return lines.map((line, index) => ({ ...line, id: line.id || `line-${index}` }));
}

export function InvoiceComposer({
  clients,
  rates,
  initial,
  submitLabel = "Create draft",
  lockDocumentKind = false,
}: InvoiceComposerProps) {
  const { pending } = useFormStatus();
  const nextLineId = useRef((initial.lines?.length ?? 0) + 1);
  const [documentKind, setDocumentKind] = useState<BillingDocumentKind>(initial.documentKind ?? "invoice");
  const [clientId, setClientId] = useState(initial.clientId ?? "");
  const [name, setName] = useState(initial.clientName ?? "");
  const [email, setEmail] = useState(initial.clientEmail ?? "");
  const [phone, setPhone] = useState(initial.clientPhone ?? "");
  const [address, setAddress] = useState(initial.clientAddress ?? "");
  const [project, setProject] = useState(initial.projectTitle ?? "");
  const [purchaseOrder, setPurchaseOrder] = useState(initial.purchaseOrder ?? "");
  const [issuedOn, setIssuedOn] = useState(initial.issueDate);
  const [dueOn, setDueOn] = useState(initial.dueDate);
  const [validUntil, setValidUntil] = useState(initial.validUntil ?? initial.dueDate);
  const [invoiceNotes, setInvoiceNotes] = useState(initial.notes ?? "");
  const [terms, setTerms] = useState(initial.terms ?? "Payment is due by the date shown.");
  const [lines, setLines] = useState<Line[]>(() => normaliseLines(initial.lines));
  const [gst, setGst] = useState(initial.gstRate ?? 0);
  const [discountKind, setDiscountKind] = useState<DiscountKind>(initial.discountKind ?? "none");
  const [discountValue, setDiscountValue] = useState(initial.discountValue ?? 0);
  const [depositPercent, setDepositPercent] = useState(initial.depositPercent ?? 0);
  const [selectedRateId, setSelectedRateId] = useState("");

  const availableRates = useMemo(
    () => rates.filter((rate) => !rate.client_id || rate.client_id === clientId),
    [clientId, rates],
  );
  const meaningfulLines = useMemo(
    () => lines.filter((line) => line.description.trim()),
    [lines],
  );
  const totals = useMemo(
    () => invoiceTotals(meaningfulLines, gst, discountKind, discountValue),
    [meaningfulLines, gst, discountKind, discountValue],
  );
  const depositCents = Math.round(totals.total * Math.max(0, Math.min(100, depositPercent)) / 100);

  function newLineId() {
    const id = `line-${nextLineId.current}`;
    nextLineId.current += 1;
    return id;
  }

  function chooseClient(value: string) {
    setClientId(value);
    setSelectedRateId("");
    const client = clients.find((candidate) => candidate.id === value);
    setName(client?.name || "");
    setEmail(client?.email || "");
    setPhone(client?.phone || "");
    setAddress("");
  }

  function patchLine(id: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addSelectedRate() {
    const rate = availableRates.find((candidate) => candidate.id === selectedRateId);
    if (!rate) return;
    const line: Line = {
      id: newLineId(),
      description: rate.service_name,
      category: rate.category,
      work_context: rate.work_context,
      quantity: 1,
      unit: rate.unit,
      unit_price_cents: rate.rate_cents,
    };
    setLines((current) => [...current.filter((item) => item.description.trim()), line]);
    setSelectedRateId("");
  }

  function removeLine(id: string) {
    setLines((current) => {
      const remaining = current.filter((line) => line.id !== id);
      return remaining.length ? remaining : [blankLine(newLineId())];
    });
  }

  const payload = {
    document_kind: documentKind,
    client_id: clientId || null,
    client_name: name,
    client_email: email,
    client_phone: phone,
    client_address: address,
    project_title: project,
    purchase_order: purchaseOrder,
    issue_date: issuedOn,
    due_date: dueOn,
    valid_until: validUntil,
    gst_rate: gst,
    discount_kind: discountKind,
    discount_value: discountValue,
    deposit_percent: depositPercent,
    notes: invoiceNotes,
    terms,
    items: meaningfulLines.map((line) => ({
      description: line.description,
      category: line.category,
      work_context: line.work_context,
      quantity: line.quantity,
      unit: line.unit,
      unit_price_cents: line.unit_price_cents,
    })),
  };

  const comparisonDate = documentKind === "estimate" ? validUntil : dueOn;
  const canSubmit =
    Boolean(name.trim() && email.trim() && issuedOn && comparisonDate) &&
    meaningfulLines.length > 0 &&
    new Date(comparisonDate).valueOf() >= new Date(issuedOn).valueOf();

  return (
    <div className="invoice-composer">
      <fieldset className="invoice-fieldset">
        <legend>Document and client</legend>
        <div className="invoice-form-grid">
          <label>
            Document type
            <select disabled={lockDocumentKind} value={documentKind} onChange={(event) => setDocumentKind(event.target.value as BillingDocumentKind)}>
              <option value="invoice">Invoice</option>
              <option value="estimate">Estimate / quote</option>
            </select>
            {lockDocumentKind ? <small>Duplicate the document to change its type.</small> : null}
          </label>
          <label>
            Saved client
            <select value={clientId} onChange={(event) => chooseClient(event.target.value)}>
              <option value="">One-off client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label>Client name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label>PO / reference<input value={purchaseOrder} onChange={(event) => setPurchaseOrder(event.target.value)} placeholder="Optional" /></label>
          <label className="invoice-span-two">Project / job<input value={project} onChange={(event) => setProject(event.target.value)} placeholder="Campaign, shoot, edit…" /></label>
          <label className="invoice-span-two">Client billing address<input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <label>Issue date<input required type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} /></label>
          {documentKind === "estimate" ? (
            <label>Valid until<input required min={issuedOn} type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
          ) : (
            <label>Due date<input required min={issuedOn} type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label>
          )}
        </div>
      </fieldset>

      <fieldset className="invoice-fieldset">
        <legend>Services and costs</legend>
        <div className="invoice-rate-picker">
          <label>
            Add from rate book
            <select value={selectedRateId} onChange={(event) => setSelectedRateId(event.target.value)}>
              <option value="">Choose a saved service…</option>
              {availableRates.map((rate) => (
                <option key={rate.id} value={rate.id}>
                  {rate.service_name} · {aud(rate.rate_cents)}/{rate.unit}{rate.client_id ? " · client rate" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="invoice-secondary" disabled={!selectedRateId} onClick={addSelectedRate} type="button">
            <Plus size={15} aria-hidden="true" /> Add service
          </button>
        </div>
        <div className="invoice-lines-wrap">
          <div className="invoice-lines">
            <div className="invoice-line invoice-line-head" aria-hidden="true">
              <span>Service</span><span>Type</span><span>Setting</span><span>Qty</span><span>Unit</span><span>Rate</span><span>Total</span><span />
            </div>
            {lines.map((line) => (
              <div className="invoice-line" key={line.id}>
                <label><span>Service</span><input aria-label="Service" value={line.description} onChange={(event) => patchLine(line.id, { description: event.target.value })} /></label>
                <label><span>Type</span><select aria-label="Type" value={line.category} onChange={(event) => patchLine(line.id, { category: event.target.value })}>{invoiceCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label><span>Setting</span><select aria-label="Setting" value={line.work_context} onChange={(event) => patchLine(line.id, { work_context: event.target.value })}>{invoiceContexts.map((context) => <option key={context}>{context}</option>)}</select></label>
                <label><span>Quantity</span><input aria-label="Quantity" type="number" min="0.01" step="0.01" required value={line.quantity} onChange={(event) => patchLine(line.id, { quantity: Number(event.target.value) })} /></label>
                <label><span>Unit</span><select aria-label="Unit" value={line.unit} onChange={(event) => patchLine(line.id, { unit: event.target.value })}>{invoiceUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                <label><span>Rate in AUD</span><input aria-label="Rate in AUD" type="number" min="0" step="0.01" value={line.unit_price_cents / 100} onChange={(event) => patchLine(line.id, { unit_price_cents: Math.round(Number(event.target.value) * 100) })} /></label>
                <output aria-label="Line total">{aud(Math.round(line.quantity * line.unit_price_cents))}</output>
                <button aria-label={`Remove ${line.description || "blank line"}`} className="invoice-remove-line" onClick={() => removeLine(line.id)} type="button"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
        <button className="invoice-secondary" type="button" onClick={() => setLines((current) => [...current, blankLine(newLineId())])}>
          <Plus size={15} aria-hidden="true" /> Add custom line
        </button>
      </fieldset>

      <div className="invoice-bottom">
        <fieldset className="invoice-fieldset invoice-notes">
          <legend>Commercial terms</legend>
          <div className="invoice-note-grid">
            <label>GST rate %<input type="number" min="0" max="100" step="0.1" value={gst} onChange={(event) => setGst(Number(event.target.value))} /><small>Use 0% unless registered for GST.</small></label>
            <label>Discount<select value={discountKind} onChange={(event) => setDiscountKind(event.target.value as DiscountKind)}><option value="none">No discount</option><option value="percent">Percentage</option><option value="fixed">Fixed AUD amount</option></select></label>
            {discountKind !== "none" ? <label>Discount {discountKind === "percent" ? "%" : "AUD"}<input min="0" max={discountKind === "percent" ? 100 : undefined} step="0.01" type="number" value={discountValue} onChange={(event) => setDiscountValue(Number(event.target.value))} /></label> : null}
            {documentKind === "invoice" ? <label>Deposit due %<input min="0" max="100" step="1" type="number" value={depositPercent} onChange={(event) => setDepositPercent(Number(event.target.value))} /></label> : null}
            <label className="invoice-span-two">Terms<input value={terms} onChange={(event) => setTerms(event.target.value)} /></label>
            <label className="invoice-span-two">Client note<textarea value={invoiceNotes} onChange={(event) => setInvoiceNotes(event.target.value)} placeholder="Scope, usage, exclusions, or a thank-you note" /></label>
          </div>
        </fieldset>
        <dl className="invoice-totals">
          <div><dt>Subtotal</dt><dd>{aud(totals.subtotal)}</dd></div>
          {totals.discount > 0 ? <div><dt>Discount</dt><dd>−{aud(totals.discount)}</dd></div> : null}
          <div><dt>GST ({gst}%)</dt><dd>{aud(totals.gst)}</dd></div>
          <div><dt>Total AUD</dt><dd>{aud(totals.total)}</dd></div>
          {depositCents > 0 ? <div><dt>Deposit due</dt><dd>{aud(depositCents)}</dd></div> : null}
        </dl>
      </div>

      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <div className="invoice-submit-row">
        <span>This saves a private draft. Nothing is emailed until you review and send it.</span>
        <button className="invoice-primary" type="submit" disabled={!canSubmit || pending}>{pending ? "Saving…" : submitLabel}</button>
      </div>
    </div>
  );
}
