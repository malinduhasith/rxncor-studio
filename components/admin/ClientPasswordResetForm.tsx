"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

type ClientPasswordResetFormProps = {
  clientId: string;
  clientEmail: string | null;
  clientName: string;
  hasPassword: boolean;
  loginUrl: string;
  resetAction: (formData: FormData) => void | Promise<void>;
  removeAction: (formData: FormData) => void | Promise<void>;
};

export function ClientPasswordResetForm({
  clientId,
  clientEmail,
  clientName,
  hasPassword,
  loginUrl,
  resetAction,
  removeAction
}: ClientPasswordResetFormProps) {
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const loginMessage = useMemo(
    () =>
      [
        `Hi ${clientName},`,
        "",
        "Your client gallery login is ready.",
        `Client login: ${loginUrl}`,
        `Email: ${clientEmail ?? "[add client email]"}`,
        `Password: ${password || "[enter password before copying]"}`,
        "",
        "Use this login to view every album assigned to you."
      ].join("\n"),
    [clientEmail, clientName, loginUrl, password]
  );

  async function copyLogin() {
    if (!password) {
      return;
    }

    await navigator.clipboard.writeText(loginMessage);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function generatePassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
    const values = new Uint32Array(14);
    window.crypto.getRandomValues(values);
    setPassword(Array.from(values, (value) => alphabet[value % alphabet.length]).join(""));
    setVisible(true);
    setCopied(false);
  }

  return (
    <div className="password-reset-row admin-password-manager">
      <div className="admin-password-manager-head">
        <div>
          <span className="label">Portal password</span>
          <strong>{hasPassword ? "Active" : "Not set"}</strong>
        </div>
        <span className={`admin-status-dot ${hasPassword ? "is-ready" : "needs-action"}`}>
          {hasPassword ? "Client can sign in" : "Setup required"}
        </span>
      </div>
      <form action={resetAction} className="password-inline-form">
        <input name="client_id" type="hidden" value={clientId} />
        <div className="field admin-password-field">
          <span className="admin-field-label">Set or replace password</span>
          <div className="admin-password-control">
            <input
              name="password"
              type={visible ? "text" : "password"}
              minLength={4}
              placeholder="Enter or generate a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            <button aria-label={visible ? "Hide password" : "Show password"} className="admin-icon-button" onClick={() => setVisible((current) => !current)} type="button">
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        <button className="button secondary small" onClick={generatePassword} type="button">
          <RefreshCw size={16} /> Generate
        </button>
        <button className="button secondary small" type="submit" disabled={!password}>
          <KeyRound size={16} />
          Set password
        </button>
      </form>
      <button
        className="button secondary small"
        type="button"
        disabled={!password}
        onClick={copyLogin}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copied" : "Copy with password"}
      </button>
      {hasPassword ? (
        <form action={removeAction}>
          <input name="client_id" type="hidden" value={clientId} />
          <ConfirmSubmitButton
            className="button danger small"
            confirmMessage={`Remove the client login password for ${clientName}?`}
          >
            <Trash2 size={16} />
            Remove password
          </ConfirmSubmitButton>
        </form>
      ) : null}
    </div>
  );
}
