"use client";

import { Check, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";

type AdminPasswordFieldProps = {
  helper: string;
  label: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
};

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";

function generatePassword(length = 14) {
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

export function AdminPasswordField({
  helper,
  label,
  name = "password",
  placeholder = "Enter or generate a password",
  required = false,
}: AdminPasswordFieldProps) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="field admin-password-field">
      <span className="admin-field-label">{label}</span>
      <div className="admin-password-control">
        <input
          autoComplete="new-password"
          minLength={4}
          name={name}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={placeholder}
          required={required}
          type={visible ? "text" : "password"}
          value={password}
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          className="admin-icon-button"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <div className="admin-password-actions">
        <button
          className="button secondary small"
          onClick={() => {
            setPassword(generatePassword());
            setVisible(true);
            setCopied(false);
          }}
          type="button"
        >
          <RefreshCw size={15} /> Generate secure
        </button>
        <button
          className="button secondary small"
          disabled={!password}
          onClick={copyPassword}
          type="button"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <small>{helper}</small>
    </div>
  );
}
