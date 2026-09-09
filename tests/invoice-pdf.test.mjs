import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";
import { invoice, items, events, invoiceUrl } from "./fixtures/invoice.mjs";

const billing = loadTs(new URL("../lib/invoices.ts", import.meta.url));
const renderer = loadTs(new URL("../lib/invoice-pdf.ts", import.meta.url), { "@/lib/invoices": billing });
const pdf = await renderer.createInvoicePdf({ invoice, items, events, invoiceUrl });

test("invoice PDF uses AES-256 with editing blocked and printing/accessibility allowed", () => {
  const raw = pdf.bytes.toString("latin1");
  assert.ok(raw.startsWith("%PDF-1.7"));
  assert.match(raw, /\/Encrypt\s+\d+\s+0\s+R/);
  assert.match(raw, /\/CFM\s+\/AESV3/);
  const permissions = Number(raw.match(/\/P\s+(-?\d+)\b/)[1]);
  for (const bit of [3, 5, 10, 12]) assert.ok(permissions & (1 << (bit - 1)), `permission ${bit} enabled`);
  for (const bit of [4, 6, 9, 11]) assert.equal(permissions & (1 << (bit - 1)), 0, `permission ${bit} disabled`);
  assert.doesNotMatch(raw, /\/AcroForm\b/);
  assert.equal(pdf.filename, "RX-TEST-0042.pdf");
});

test("long invoices paginate all 100 items and retain safe filenames", async () => {
  const longItems = Array.from({ length: 100 }, (_, index) => ({
    ...items[index % 2], id: `item-${index}`, description: `Service ${index + 1} — ${"Detailed production work, editing and delivery. ".repeat(4)}`,
  }));
  const long = await renderer.createInvoicePdf({ invoice, items: longItems, events, invoiceUrl });
  assert.ok((long.bytes.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length > 5);
  assert.equal(renderer.invoicePdfFilename({ invoice_number: '../evil\r\n".pdf', status: "draft" }), "-evil-pdf-draft.pdf");
  assert.equal(renderer.invoicePdfFilename({ invoice_number: invoice.invoice_number, status: "void" }), "RX-TEST-0042-void.pdf");
  if (process.env.PDF_TEST_OUTPUT) {
    await mkdir(process.env.PDF_TEST_OUTPUT, { recursive: true });
    await writeFile(`${process.env.PDF_TEST_OUTPUT}/protected-invoice.pdf`, pdf.bytes);
    await writeFile(`${process.env.PDF_TEST_OUTPUT}/long-invoice.pdf`, long.bytes);
  }
});

test("PDF generation refuses a document with missing line items", async () => {
  await assert.rejects(renderer.createInvoicePdf({ invoice, items: [], events, invoiceUrl }), /line items/);
});

function emailHarness() {
  const requests = [];
  const logs = [];
  const email = loadTs(new URL("../lib/email.ts", import.meta.url), {
    "@/config/server-env": { optionalEnv: (name) => ({ RESEND_API_KEY: "test-key", EMAIL_FROM: "test@example.com" })[name] },
    "@/config/site": { siteConfig: { email: "test@example.com" } },
    "@/lib/email-events": { logEmailEvents: async (entry) => logs.push(entry) },
  });
  return { email, requests, logs };
}

test("send, resend and reminder emails attach the actual PDF and link to the client view", async (t) => {
  const { email, requests, logs } = emailHarness();
  t.mock.method(globalThis, "fetch", async (url, request) => {
    assert.equal(url, "https://api.resend.com/emails");
    requests.push(JSON.parse(request.body));
    return Response.json({ id: "provider-test-id" });
  });
  for (const deliveryKind of ["send", "resend", "reminder"]) {
    const result = await email.sendInvoiceEmail({
      documentKind: "invoice", deliveryKind, invoiceId: invoice.id, invoiceNumber: invoice.invoice_number,
      clientName: invoice.client_name, clientEmail: invoice.client_email, issueDate: invoice.issue_date, dueDate: invoice.due_date,
      total: billing.aud(invoice.total_cents), balance: "$1,333.50", invoiceUrl, pdf,
    });
    assert.equal(result.sent, 1);
    const request = requests.at(-1);
    assert.deepEqual(request.to, [invoice.client_email]);
    assert.equal(request.attachments.length, 1);
    assert.equal(request.attachments[0].content_type, "application/pdf");
    assert.deepEqual(Buffer.from(request.attachments[0].content, "base64"), pdf.bytes);
    assert.ok(request.html.includes(`href="${invoiceUrl}"`));
    assert.match(request.text, /PDF is attached/);
    assert.equal(logs.at(-1).context.metadata.provider_email_id, "provider-test-id");
  }
});

test("invoice email cannot be sent without a valid PDF attachment", async (t) => {
  const { email } = emailHarness();
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not send"); });
  await assert.rejects(email.sendInvoiceEmail({ documentKind: "invoice" }), /attachment is required/);
  assert.equal(fetch.mock.callCount(), 0);
});

test("a provider rejection remains a failed delivery when the attachment is present", async (t) => {
  const { email, logs } = emailHarness();
  t.mock.method(globalThis, "fetch", async () => new Response("Attachment rejected", { status: 422 }));
  t.mock.method(console, "error", () => {});
  const result = await email.sendInvoiceEmail({
    documentKind: "invoice", deliveryKind: "send", invoiceId: invoice.id, invoiceNumber: invoice.invoice_number,
    clientName: invoice.client_name, clientEmail: invoice.client_email, invoiceUrl, pdf,
    issueDate: invoice.issue_date, dueDate: invoice.due_date, total: "$1,633.50", balance: "$1,333.50",
  });
  assert.equal(result.sent, 0);
  assert.equal(result.failed, 1);
  assert.equal(logs.at(-1).status, "failed");
});

function accessHarness({ status = "sent", user = null, error = null, found = true } = {}) {
  let lookups = 0;
  const db = { from: (table) => {
    assert.equal(table, "invoices");
    const query = { select: () => query, eq: (field, value) => {
      assert.equal(field, "public_token"); assert.equal(value, invoice.public_token); lookups++; return query;
    }, maybeSingle: async () => ({ data: found ? { ...invoice, status } : null, error }) };
    return query;
  } };
  const access = loadTs(new URL("../lib/invoice-document-access.ts", import.meta.url), {
    "@/lib/admin-auth": { isAdminEmailAllowed: (email) => email === "admin@example.com" },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => db },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
  });
  return { ...access, lookups: () => lookups };
}

test("client PDF and view share token validation and draft restrictions", async () => {
  const invalid = accessHarness();
  assert.equal(await invalid.readClientInvoice("not-a-token"), null);
  assert.equal(invalid.lookups(), 0);
  for (const user of [null, { email: "client@example.com" }]) {
    assert.equal(await accessHarness({ status: "draft", user }).readClientInvoice(invoice.public_token), null);
  }
  assert.equal((await accessHarness({ status: "draft", user: { email: "admin@example.com" } }).readClientInvoice(invoice.public_token)).isAdmin, true);
  for (const status of ["sent", "paid", "void"]) {
    assert.equal((await accessHarness({ status }).readClientInvoice(invoice.public_token)).invoice.status, status);
  }
  assert.equal(await accessHarness({ found: false }).readClientInvoice(invoice.public_token), null);
  await assert.rejects(accessHarness({ error: { message: "Database unavailable" } }).readClientInvoice(invoice.public_token), /unavailable/);
});

test("download returns a named, private PDF and fails closed if the ledger is unavailable", async (t) => {
  let ledgerError = null;
  let allowed = true;
  let generations = 0;
  const { GET } = loadTs(new URL("../app/invoice/[token]/pdf/route.ts", import.meta.url), {
    "@/config/site": { siteConfig: { url: "https://www.rxncor.studio" } },
    "@/lib/invoice-document-access": { readClientInvoice: async () => allowed ? { db: {}, invoice } : null },
    "@/lib/invoice-document": { readInvoiceItems: async () => items },
    "@/lib/invoice-ledger": { readInvoiceLedger: async () => ({ data: events, error: ledgerError }) },
    "@/lib/invoice-pdf": { createInvoicePdf: async () => { generations++; return pdf; } },
  });
  const request = () => GET(new Request(`${invoiceUrl}/pdf`), { params: Promise.resolve({ token: invoice.public_token }) });
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="RX-TEST-0042.pdf"');
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf.bytes);
  allowed = false;
  assert.equal((await request()).status, 404);
  allowed = true; ledgerError = { message: "Second ledger page failed" };
  t.mock.method(console, "error", () => {});
  assert.equal((await request()).status, 503);
  assert.equal(generations, 1);
});
