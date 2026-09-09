"use client";

import { Printer } from "lucide-react";

export function PrintInvoiceButton() {
  return <button type="button" onClick={() => window.print()}><Printer size={17} aria-hidden="true" />Print</button>;
}
