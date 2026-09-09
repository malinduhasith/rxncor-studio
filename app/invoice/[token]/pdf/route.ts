import { siteConfig } from "@/config/site";
import { readClientInvoice } from "@/lib/invoice-document-access";
import { readInvoiceItems } from "@/lib/invoice-document";
import { readInvoiceLedger } from "@/lib/invoice-ledger";
import { createInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const document = await readClientInvoice(token);
    if (!document) return new Response("Document not found.", { status: 404, headers: privateHeaders });
    const { db, invoice } = document;
    const [items, ledger] = await Promise.all([readInvoiceItems(db, invoice.id), readInvoiceLedger(db, invoice.id)]);
    if (ledger.error) throw new Error("Invoice ledger is temporarily unavailable.");
    const previewHost = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
    const base = process.env.VERCEL_ENV === "preview" && previewHost ? `https://${previewHost}` : siteConfig.url;
    const pdf = await createInvoicePdf({ invoice, items, events: ledger.data || [], invoiceUrl: `${base}/invoice/${token}` });
    return new Response(new Uint8Array(pdf.bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.filename}"`,
        "Content-Length": String(pdf.bytes.length),
      },
    });
  } catch (error) {
    console.error("Invoice PDF download failed", error);
    return new Response("Your PDF is temporarily unavailable. Please return to the invoice and try again.", { status: 503, headers: privateHeaders });
  }
}
