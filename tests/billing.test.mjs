import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function loadTypeScript(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const billing = await loadTypeScript("../lib/invoices.ts");
const { readInvoiceLedger } = await loadTypeScript("../lib/invoice-ledger.ts");
const invoice = { status: "sent", total_cents: 1800, due_date: "2026-09-20" };
const event = (id, action, metadata) => ({ id, action, metadata, entity_id: "invoice", summary: "QA", created_at: "2026-09-06T20:00:00Z" });
const payment = event("one", "invoice.payment.record", { payment_id: "payment-one", amount_cents: 450, received_on: "2026-09-07" });

test("fractional hours, equipment, discount and tax round in cents", () => {
  const result = billing.invoiceTotals([{ quantity: 1.5, unit_price_cents: 1000 }, { quantity: 1, unit_price_cents: 500 }], 10, "percent", 10);
  assert.deepEqual(result, { subtotal: 2000, discount: 200, taxableSubtotal: 1800, gst: 180, total: 1980 });
});
test("fixed discount cannot create a negative invoice", () => {
  assert.equal(billing.invoiceTotals([{ quantity: 1, unit_price_cents: 100 }], 10, "fixed", 5).total, 0);
});
test("partial payment retains the outstanding amount", () => {
  assert.equal(billing.paymentTotals(invoice, [payment]).balance, 1350);
  assert.equal(billing.documentDisplayStatus(invoice, [payment]), "part-paid");
});
test("reversal restores balance without losing payment history", () => {
  const reversal = event("two", "invoice.payment.reverse", { payment_id: "payment-one" });
  const totals = billing.paymentTotals(invoice, [reversal, payment]);
  assert.equal(totals.balance, 1800);
  assert.equal(totals.entries[0].reversed, true);
});
test("legacy paid documents remain settled without a ledger", () => {
  assert.equal(billing.paymentTotals({ ...invoice, status: "paid" }, []).balance, 0);
});
test("void status overrides an old estimate acceptance", () => {
  assert.equal(billing.documentDisplayStatus({ ...invoice, status: "void", issuer_snapshot: { billing: { document_kind: "estimate" } } }, [event("accept", "estimate.accepted", {})]), "void");
});
test("reopening an estimate clears its previous decision", () => {
  assert.equal(billing.estimateDecision([event("new", "estimate.reopen", {}), event("old", "estimate.declined", {})]), null);
});
test("Melbourne billing dates advance before UTC midnight", () => {
  assert.equal(billing.invoiceDate(new Date("2026-09-06T20:00:00Z")), "2026-09-07");
  assert.equal(billing.agingBucket("2026-09-06", new Date("2026-09-06T20:00:00Z")), "1–30 days");
});
test("Melbourne billing dates handle daylight saving", () => {
  assert.equal(billing.invoiceDate(new Date("2026-12-06T13:30:00Z")), "2026-12-07");
});
test("an estimate is usable through its valid-until date", () => {
  assert.equal(billing.estimateExpired({ due_date: "2026-09-07" }, "2026-09-07"), false);
  assert.equal(billing.estimateExpired({ due_date: "2026-09-07" }, "2026-09-08"), true);
});
test("ledger reads beyond the default database row cap", async () => {
  const rows = Array.from({ length: 1201 }, (_, index) => ({ id: String(index) }));
  const ranges = [];
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, async range(start, end) { ranges.push([start, end]); return { data: rows.slice(start, end + 1), error: null }; } };
  const result = await readInvoiceLedger({ from: () => query }, "invoice");
  assert.equal(result.data.length, 1201);
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
});
test("a later ledger failure never returns a partial financial balance", async () => {
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, async range(start) { return start ? { data: null, error: { message: "unavailable" } } : { data: Array(500).fill(payment), error: null }; } };
  const result = await readInvoiceLedger({ from: () => query });
  assert.equal(result.data, null);
  assert.equal(result.error.message, "unavailable");
});
