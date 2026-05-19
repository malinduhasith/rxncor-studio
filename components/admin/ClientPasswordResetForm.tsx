"use client";

import { useMemo, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
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

  return (
    <div className="password-reset-row">
      <form action={resetAction} className="password-inline-form">
        <input name="client_id" type="hidden" value={clientId} />
        <label className="field">
          Set new password
          <input
            name="password"
            type="password"
            minLength={4}
            placeholder="New client password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
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
        <Copy size={16} />
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
