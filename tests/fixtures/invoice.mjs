export const invoice = {
  id: "af683fd4-36a3-4586-971b-a7ce3b80425a",
  public_token: "6450368c-e339-4d91-9a94-fe8eff11d0fa",
  invoice_number: "RX-TEST-0042", status: "sent",
  issue_date: "2026-09-09", due_date: "2026-09-23",
  client_name: "Jordan Léon", client_email: "jordan@example.com",
  client_phone: "+61 400 000 000", client_address: "Example Creative Pty Ltd\n123 Example Street\nMelbourne VIC 3000",
  project_title: "Brand photography — spring campaign",
  subtotal_cents: 165000, gst_rate: 10, gst_cents: 14850, total_cents: 163350,
  notes: "Test document for layout verification only. No payment is required.\nIncludes a private gallery and delivery of edited, full-resolution photographs.",
  terms: "Payment due within 14 days of issue. Please use the invoice number as your payment reference.",
  issuer_snapshot: {
    business_name: "RXNCOR Studio", issuer_name: "Example Photographer", email: "studio@example.com",
    phone: "+61 400 000 001", address: "Melbourne, Victoria, Australia", abn: "12 345 678 901",
    billing: { document_kind: "invoice", discount_cents: 16500, deposit_percent: 30, purchase_order: "PO-EXAMPLE-2026" },
  },
  payment_snapshot: { pay_id: "studio@example.com", bank_name: "Example Bank", account_name: "Example Photographer", bsb: "000-000", account_number: "00000000" },
};

export const items = [
  { id: "item-1", description: "On-location brand photography", category: "Photography", work_context: "On location", quantity: 1.5, unit: "day", unit_price_cents: 90000, line_total_cents: 135000 },
  { id: "item-2", description: "Retouching and colour grading", category: "Editing", work_context: "Remote", quantity: 4, unit: "hour", unit_price_cents: 7500, line_total_cents: 30000 },
];

export const events = [{
  id: "event-1", entity_id: invoice.id, action: "invoice.payment.record", summary: "Test payment",
  created_at: "2026-09-09T12:00:00Z",
  metadata: { payment_id: "payment-1", amount_cents: 30000, method: "bank transfer", received_on: "2026-09-09", reference: "EXAMPLE-TRANSFER" },
}];

export const invoiceUrl = `https://www.rxncor.studio/invoice/${invoice.public_token}`;
