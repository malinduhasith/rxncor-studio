"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { aud, invoiceCategories, invoiceContexts, invoiceUnits } from "@/lib/invoices";

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

type Line = {
  id: string;
  description: string;
  category: string;
  work_context: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
};

type InvoiceComposerProps = {
  clients: Client[];
  rates: Rate[];
  issueDate?: string;
  dueDate?: string;
  dueDays?: number;
  gstRate?: number;
  notes?: string;
};

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

function initialDates(dueDays: number) {
  const now = Date.now();
  return {
    issue: new Date(now).toISOString().slice(0, 10),
    due: new Date(now + dueDays * 86_400_000).toISOString().slice(0, 10),
  };
}

export function InvoiceComposer({
  clients,
  rates,
  issueDate,
  dueDate,
  dueDays = 14,
  gstRate = 0,
  notes = "",
}: InvoiceComposerProps) {
  const defaults = useMemo(() => initialDates(dueDays), [dueDays]);
  const nextLineId = useRef(1);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [project, setProject] = useState("");
  const [issuedOn, setIssuedOn] = useState(issueDate || defaults.issue);
  const [dueOn, setDueOn] = useState(dueDate || defaults.due);
  const [invoiceNotes, setInvoiceNotes] = useState(notes);
  const [terms, setTerms] = useState("Payment is due by the date shown.");
  const [lines, setLines] = useState<Line[]>([blankLine("line-0")]);
  const [gst, setGst] = useState(gstRate);
  const [selectedRateId, setSelectedRateId] = useState("");

  const availableRates = useMemo(
    () => rates.filter((rate) => !rate.client_id || rate.client_id === clientId),
    [clientId, rates],
  );
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unit_price_cents), 0),
    [lines],
  );
  const gstCents = Math.round((subtotal * gst) / 100);

  function newLineId() {
    const id = `line-${nextLineId.current}`;
    nextLineId.current += 1;
    return id;
  }

  function chooseClient(value: string) {
    setClientId(value);
    setSelectedRateId("");
    const client = clients.find((candidate) => candidate.id === value);
    if (client) {
      setName(client.name);
      setEmail(client.email || "");
      setPhone(client.phone || "");
    }
  }

  function patchLine(id: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function addBlankLine() {
    setLines((current) => [...current, blankLine(newLineId())]);
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
    setLines((current) => {
      const meaningful = current.filter((item) => item.description.trim());
      return [...meaningful, line];
    });
    setSelectedRateId("");
  }

  function removeLine(id: string) {
    setLines((current) => {
      const remaining = current.filter((line) => line.id !== id);
      return remaining.length ? remaining : [blankLine(newLineId())];
    });
  }

  const payload = {
    client_id: clientId || null,
    client_name: name,
    client_email: email,
    client_phone: phone,
    client_address: address,
    project_title: project,
    issue_date: issuedOn,
    due_date: dueOn,
    gst_rate: gst,
    notes: invoiceNotes,
    terms,
    items: lines
      .filter((line) => line.description.trim())
      .map((line) => ({
        description: line.description,
        category: line.category,
        work_context: line.work_context,
        quantity: line.quantity,
        unit: line.unit,
        unit_price_cents: line.unit_price_cents,
      })),
  };

  const canCreate =
    Boolean(name.trim() && email.trim() && issuedOn && dueOn) &&
    payload.items.length > 0 &&
    new Date(dueOn).valueOf() >= new Date(issuedOn).valueOf();

  return (
    <div className="invoice-composer">
      <fieldset className="invoice-fieldset">
        <legend>Bill to</legend>
        <div className="invoice-form-grid">
          <label>
            Saved client
            <select value={clientId} onChange={(event) => chooseClient(event.target.value)}>
              <option value="">One-off client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>
          <label>
            Client name
            <input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Email
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Phone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="invoice-span-two">
            Project / job
            <input value={project} onChange={(event) => setProject(event.target.value)} placeholder="Campaign, shoot, edit…" />
          </label>
          <label className="invoice-span-two">
            Client billing address
            <input value={address} onChange={(event) => setAddress(event.target.value)} />
          </label>
          <label>
            Issue date
            <input required type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} />
          </label>
          <label>
            Due date
            <input required min={issuedOn} type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
          </label>
        </div>
      </fieldset>

      <fieldset className="invoice-fieldset">
        <legend>Services</legend>
        <div className="invoice-rate-picker">
          <label>
            Add from rate book
            <select value={selectedRateId} onChange={(event) => setSelectedRateId(event.target.value)}>
              <option value="">Choose a saved service…</option>
              {availableRates.map((rate) => (
                <option key={rate.id} value={rate.id}>
                  {rate.service_name} · {aud(rate.rate_cents)}/{rate.unit}
                  {rate.client_id ? " · client rate" : ""}
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
              <span>Service</span><span>Type</span><span>Setting</span><span>Qty</span>
              <span>Unit</span><span>Rate</span><span>Total</span><span />
            </div>
            {lines.map((line) => (
              <div className="invoice-line" key={line.id}>
                <label><span>Service</span><input aria-label="Service" value={line.description} onChange={(event) => patchLine(line.id, { description: event.target.value })} /></label>
                <label><span>Type</span><select aria-label="Type" value={line.category} onChange={(event) => patchLine(line.id, { category: event.target.value })}>{invoiceCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label><span>Setting</span><select aria-label="Setting" value={line.work_context} onChange={(event) => patchLine(line.id, { work_context: event.target.value })}>{invoiceContexts.map((context) => <option key={context}>{context}</option>)}</select></label>
                <label><span>Quantity</span><input aria-label="Quantity" type="number" min="0.01" step="0.25" value={line.quantity} onChange={(event) => patchLine(line.id, { quantity: Number(event.target.value) })} /></label>
                <label><span>Unit</span><select aria-label="Unit" value={line.unit} onChange={(event) => patchLine(line.id, { unit: event.target.value })}>{invoiceUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                <label><span>Rate in AUD</span><input aria-label="Rate in AUD" type="number" min="0" step="0.01" value={line.unit_price_cents / 100} onChange={(event) => patchLine(line.id, { unit_price_cents: Math.round(Number(event.target.value) * 100) })} /></label>
                <output aria-label="Line total">{aud(Math.round(line.quantity * line.unit_price_cents))}</output>
                <button aria-label={`Remove ${line.description || "blank line"}`} className="invoice-remove-line" onClick={() => removeLine(line.id)} type="button"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
        <button className="invoice-secondary" type="button" onClick={addBlankLine}>
          <Plus size={15} aria-hidden="true" /> Add custom line
        </button>
      </fieldset>

      <div className="invoice-bottom">
        <fieldset className="invoice-fieldset invoice-notes">
          <legend>Notes and tax</legend>
          <div className="invoice-note-grid">
            <label>
              GST rate %
              <input type="number" min="0" max="100" step="0.1" value={gst} onChange={(event) => setGst(Number(event.target.value))} />
              <small>Use 0% unless you are registered for GST.</small>
            </label>
            <label>
              Payment terms
              <input value={terms} onChange={(event) => setTerms(event.target.value)} />
            </label>
            <label className="invoice-span-two">
              Invoice note
              <textarea value={invoiceNotes} onChange={(event) => setInvoiceNotes(event.target.value)} placeholder="Thank you, usage details, or payment note" />
            </label>
          </div>
        </fieldset>
        <dl className="invoice-totals">
          <div><dt>Subtotal</dt><dd>{aud(subtotal)}</dd></div>
          <div><dt>GST ({gst}%)</dt><dd>{aud(gstCents)}</dd></div>
          <div><dt>Total AUD</dt><dd>{aud(subtotal + gstCents)}</dd></div>
        </dl>
      </div>

      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <div className="invoice-submit-row">
        <span>This creates a draft. Nothing is emailed until you review and send it.</span>
        <button className="invoice-primary" type="submit" disabled={!canCreate}>Create draft invoice</button>
      </div>
    </div>
  );
}
