"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

type CopyTextButtonProps = {
  text: string;
  label?: string;
};

export function CopyTextButton({ text, label = "Copy" }: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  const [manual, setManual] = useState(false);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setManual(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setManual(true);
    }
  }

  return (
    <span style={{ display: "inline-grid", gap: 8, minWidth: 0 }}>
    <button aria-live="polite" className="button secondary small" onClick={copyText} type="button">
      <Copy size={16} />
      {copied ? "Copied" : label}
    </button>
    {manual ? <label style={{ fontSize: 14 }}><span role="status">Automatic copy is unavailable. Select and copy below.</span><textarea aria-label="Text to copy" readOnly value={text} onFocus={event => event.currentTarget.select()} style={{ width: "100%", fontSize: 16 }} /></label> : null}
    </span>
  );
}
