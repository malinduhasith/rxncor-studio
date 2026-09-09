import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { aud, billingDocumentKind, estimateDecision, paymentTotals, snapshotValue, type InvoiceLedgerEvent } from "@/lib/invoices";
import type { InvoiceDocument, InvoiceDocumentItem } from "@/lib/invoice-document";

type PdfInput = {
  invoice: InvoiceDocument;
  items: InvoiceDocumentItem[];
  events: InvoiceLedgerEvent[];
  invoiceUrl: string;
};

export type InvoicePdf = { filename: string; bytes: Buffer };

const ink = "#172033";
const muted = "#626D7E";
const line = "#DDE2E9";
const accent = "#4F46E5";
let fonts: { regular: Buffer; bold: Buffer } | undefined;

function text(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n").trim();
}

function date(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-AU", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(parsed);
}

export function invoicePdfFilename(invoice: Pick<InvoiceDocument, "invoice_number" | "status">) {
  const number = invoice.invoice_number.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 100) || "invoice";
  const suffix = invoice.status === "draft" || invoice.status === "void" ? `-${invoice.status}` : "";
  return `${number}${suffix}.pdf`;
}

export async function createInvoicePdf({ invoice, items, events, invoiceUrl }: PdfInput): Promise<InvoicePdf> {
  if (!items.length) throw new Error("An invoice PDF must contain its line items.");
  fonts ??= {
    regular: readFileSync(join(process.cwd(), "assets/fonts/DejaVuSans.ttf")),
    bold: readFileSync(join(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf")),
  };
  const issuer = invoice.issuer_snapshot || {};
  const payment = invoice.payment_snapshot || {};
  const isEstimate = billingDocumentKind(invoice) === "estimate";
  const label = isEstimate ? "Estimate" : invoice.gst_cents > 0 && issuer.abn ? "Tax invoice" : "Invoice";
  const totals = paymentTotals(invoice, events);
  const decision = isEstimate ? estimateDecision(events) : null;
  const discount = snapshotValue<number>(invoice, "discount_cents", 0);
  const deposit = Math.round(invoice.total_cents * snapshotValue<number>(invoice, "deposit_percent", 0) / 100);
  const finalDate = isEstimate ? snapshotValue(invoice, "valid_until", invoice.due_date) : invoice.due_date;
  const businessName = text(issuer.business_name) || "RXNCOR Studio";
  const state = invoice.status === "draft" ? "DRAFT — not issued" : invoice.status === "void" ? "VOID — no payment required"
    : isEstimate && decision ? `Estimate ${decision === "converted" ? "converted to invoice" : decision}`
    : !isEstimate && totals.balance === 0 ? "PAID IN FULL" : "";
  const doc = new PDFDocument({
    size: "A4", margin: 42, bufferPages: true, compress: true,
    pdfVersion: "1.7ext3",
    // No opening password. The random owner password restricts editing in
    // compliant readers; PDF permissions are not a digital signature/DRM.
    ownerPassword: randomBytes(32).toString("hex"),
    permissions: {
      printing: "highResolution", modifying: false, copying: true,
      annotating: false, fillingForms: false, contentAccessibility: true, documentAssembly: false,
    },
    info: { Title: `${label} ${invoice.invoice_number}`, Author: businessName, Subject: text(invoice.project_title) || label, Creator: "RXNCOR Studio" },
  });
  doc.registerFont("Regular", fonts.regular).registerFont("Bold", fonts.bold);
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  // Attach a handler immediately even if a synchronous layout/font error occurs.
  void completed.catch(() => undefined);
  const left = 42;
  const width = doc.page.width - left * 2;
  const bottom = doc.page.height - 80;
  let y = 0;

  type Cell = { value: unknown; x: number; width: number; bold?: boolean; size?: number; color?: string; align?: "left" | "right" };
  function write(value: string, x: number, top: number, cellWidth: number, size = 9, bold = false, color = ink, align: "left" | "right" = "left") {
    doc.font(bold ? "Bold" : "Regular").fontSize(size).fillColor(color)
      .text(value, x, top, { width: cellWidth, lineBreak: false, align });
  }
  function rule(top: number) {
    doc.moveTo(left, top).lineTo(left + width, top).lineWidth(0.6).strokeColor(line).stroke();
  }
  function header(first = false) {
    write("RXNCOR", left, 42, 220, first ? 26 : 13, true);
    write(first ? label : `${label} · ${invoice.invoice_number}`, left + 230, 44, width - 230, first ? 23 : 10, true, ink, "right");
    if (first) {
      write("PHOTO / VIDEO / PRODUCTION", left, 78, 250, 7.5, true, muted);
      write(invoice.invoice_number, left + 270, 79, width - 270, 10, true, muted, "right");
    }
    rule(first ? 104 : 69);
    y = first ? 123 : 88;
  }
  function nextPage() { doc.addPage(); header(); }
  function ensure(height: number) { if (y + height > bottom) nextPage(); }
  function wrap(cell: Cell) {
    doc.font(cell.bold ? "Bold" : "Regular").fontSize(cell.size ?? 9);
    const lines: string[] = [];
    for (const paragraph of text(cell.value).split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (doc.widthOfString(current ? `${current} ${word}` : word) <= cell.width) {
          current = current ? `${current} ${word}` : word;
          continue;
        }
        if (current) { lines.push(current); current = ""; }
        for (const character of word) {
          if (current && doc.widthOfString(current + character) > cell.width) {
            lines.push(current); current = "";
          }
          current += character;
        }
      }
      lines.push(current);
    }
    return lines;
  }
  function row(cells: Cell[], options: { padding?: number; lineHeight?: number; divider?: boolean; continuation?: () => void } = {}) {
    const padding = options.padding ?? 0;
    const lineHeight = options.lineHeight ?? 14;
    const lines = cells.map(wrap);
    const length = Math.max(...lines.map((part) => part.length));
    const height = length * lineHeight + padding * 2;
    if (y + height > bottom && height <= bottom - 122) { nextPage(); options.continuation?.(); }
    let offset = 0;
    while (offset < length) {
      if (y + lineHeight + padding * 2 > bottom) { nextPage(); options.continuation?.(); }
      const count = Math.min(length - offset, Math.floor((bottom - y - padding * 2) / lineHeight));
      cells.forEach((cell, index) => {
        for (let item = 0; item < count; item++) {
          const value = lines[index][offset + item];
          if (value) write(value, cell.x, y + padding + item * lineHeight, cell.width, cell.size, cell.bold, cell.color, cell.align);
        }
      });
      y += count * lineHeight + padding * 2;
      offset += count;
      if (options.divider) rule(y);
    }
  }
  function section(title: string, value: string) {
    ensure(Math.min(wrap({ value, x: left, width }).length * 14 + 28, bottom - 88));
    write(title, left, y, width, 8, true, muted);
    y += 14;
    row([{ value, x: left, width, color: muted }]);
    y += 14;
  }
  function moneySize(value: string, available: number) {
    doc.font("Regular").fontSize(9);
    return Math.min(9, Math.max(7, 9 * available / doc.widthOfString(value)));
  }
  function tableHeader() {
    ensure(52);
    doc.rect(left, y, width, 27).fill(ink);
    for (const cell of [
      { value: "DESCRIPTION", x: left + 10, width: 219 },
      { value: "QTY", x: left + 247, width: 44 },
      { value: "RATE", x: left + 302, width: 88, align: "right" as const },
      { value: "AMOUNT", x: left + 401, width: width - 411, align: "right" as const },
    ]) write(cell.value, cell.x, y + 8, cell.width, 7.5, true, "#FFFFFF", cell.align);
    y += 27;
  }

  try {
    header(true);
    if (state) {
      row([{ value: state, x: left, width, bold: true, color: invoice.status === "void" ? "#B42318" : accent, size: 10 }]);
      y += 14;
    }
    const second = left + 172;
    const third = left + 366;
    const purchaseOrder = snapshotValue<string>(invoice, "purchase_order", "");
    row([
      { value: "FROM", x: left, width: 154, bold: true, size: 8, color: muted },
      { value: isEstimate ? "PREPARED FOR" : "BILL TO", x: second, width: 176, bold: true, size: 8, color: muted },
      { value: "ISSUED", x: third, width: width - 366, bold: true, size: 8, color: muted },
    ]);
    y += 4;
    row([
      { value: businessName, x: left, width: 154, bold: true, size: 10 },
      { value: invoice.client_name, x: second, width: 176, bold: true, size: 10 },
      { value: date(invoice.issue_date), x: third, width: width - 366, bold: true },
    ], { lineHeight: 16 });
    row([
      { value: [issuer.issuer_name, issuer.email, issuer.phone, issuer.address, issuer.abn ? `ABN ${issuer.abn}` : ""].map(text).filter(Boolean).join("\n"), x: left, width: 154, color: muted },
      { value: [invoice.client_email, invoice.client_phone, invoice.client_address].map(text).filter(Boolean).join("\n"), x: second, width: 176, color: muted },
      { value: `${isEstimate ? "VALID UNTIL" : "DUE DATE"}\n${date(finalDate)}${purchaseOrder ? `\n\nPO / REFERENCE\n${purchaseOrder}` : ""}`, x: third, width: width - 366, color: muted },
    ]);
    y += 18;
    if (invoice.project_title) section("PROJECT", invoice.project_title);
    tableHeader();
    for (const item of items) {
      const rate = aud(item.unit_price_cents);
      const amount = aud(item.line_total_cents);
      row([
        { value: [item.description, [item.category, item.work_context].filter(Boolean).join(" · ")].filter(Boolean).join("\n"), x: left + 10, width: 219 },
        { value: `${item.quantity} ${item.unit}`, x: left + 247, width: 44, size: 8 },
        { value: rate, x: left + 302, width: 88, size: moneySize(rate, 88), align: "right" },
        { value: amount, x: left + 401, width: width - 411, size: moneySize(amount, width - 411), align: "right" },
      ], { padding: 8, divider: true, continuation: tableHeader });
    }
    y += 22;
    const summary: Array<[string, string]> = [["Subtotal", aud(invoice.subtotal_cents)]];
    if (discount > 0) summary.push(["Discount", `−${aud(discount)}`]);
    if (invoice.gst_cents > 0) summary.push([`GST (${invoice.gst_rate}%)`, aud(invoice.gst_cents)]);
    summary.push(["Total AUD", aud(invoice.total_cents)]);
    if (!isEstimate) {
      if (totals.paid > 0) summary.push(["Paid", `−${aud(totals.paid)}`]);
      summary.push([invoice.status === "void" ? "Balance (void)" : "Balance", aud(totals.balance)]);
    }
    if (deposit > 0 && totals.paid === 0 && !["draft", "void"].includes(invoice.status)) summary.push(["Deposit requested", aud(deposit)]);
    const paymentLines = invoice.status === "void" ? ["VOID DOCUMENT", "No payment is required."]
      : invoice.status === "draft" ? ["DRAFT FOR REVIEW", "No payment is requested."]
      : isEstimate ? ["NEXT STEP", "Review this estimate using your secure document link.", "Contact RXNCOR with any questions."]
      : totals.balance === 0 ? ["PAYMENT COMPLETE", "Thank you. This invoice is paid in full."]
      : ["PAYMENT DETAILS", payment.pay_id ? `PayID: ${payment.pay_id}` : "",
        payment.bsb && payment.account_number ? [payment.bank_name || "Bank transfer", `Account: ${payment.account_name || issuer.issuer_name || businessName}`, `BSB: ${payment.bsb}`, `Account no: ${payment.account_number}`].join("\n") : "",
        payment.pay_id || (payment.bsb && payment.account_number) ? `Reference: ${invoice.invoice_number}` : "Contact RXNCOR for payment details."];
    row([
      { value: paymentLines.filter(Boolean).join("\n"), x: left, width: 222, size: 8.5, color: muted },
      { value: summary.map(([key]) => key).join("\n"), x: left + 246, width: 108, size: 8.5, bold: true },
      { value: summary.map(([, value]) => value).join("\n"), x: left + 364, width: width - 364, size: 10, bold: true, align: "right" },
    ], { lineHeight: 16 });
    y += 20;
    if (!isEstimate && totals.entries.length) {
      ensure(52);
      write("PAYMENT HISTORY", left, y, width, 8, true, muted); y += 18;
      for (const entry of totals.entries) row([
        { value: `${date(entry.receivedOn)} · ${entry.method}${entry.reference ? ` · ${entry.reference}` : ""}${entry.reversed ? " · REVERSED" : ""}`, x: left, width: width - 136, size: 8.5, color: muted },
        { value: aud(entry.amountCents), x: left + width - 120, width: 120, align: "right", bold: true },
      ], { padding: 7, divider: true });
      y += 22;
    }
    if (invoice.notes) section("PROJECT NOTE", invoice.notes);
    if (invoice.terms) section("TERMS", invoice.terms);
    const pages = doc.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index++) {
      doc.switchToPage(index);
      const footerY = doc.page.height - 55;
      rule(footerY - 12);
      write(`${invoice.invoice_number}${invoice.status === "draft" || invoice.status === "void" ? ` · ${invoice.status.toUpperCase()}` : ""} · All amounts in AUD`, left, footerY, width - 100, 7, false, muted);
      write(`Page ${index + 1} of ${pages.count}`, left + width - 90, footerY, 90, 7, false, muted, "right");
      doc.font("Regular").fontSize(7).fillColor(accent).text("View secure document online", left, footerY + 14, { lineBreak: false, link: invoiceUrl });
    }
    doc.end();
    return { filename: invoicePdfFilename(invoice), bytes: await completed };
  } catch (error) {
    doc.destroy();
    throw error;
  }
}
