"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

type CopyLinkButtonProps = {
  value: string;
};

export function CopyLinkButton({ value }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="button secondary small" onClick={copyLink} type="button">
      <Copy size={16} />
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
