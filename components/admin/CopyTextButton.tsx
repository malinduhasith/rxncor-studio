"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

type CopyTextButtonProps = {
  text: string;
  label?: string;
};

export function CopyTextButton({ text, label = "Copy" }: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="button secondary small" onClick={copyText} type="button">
      <Copy size={16} />
      {copied ? "Copied" : label}
    </button>
  );
}
