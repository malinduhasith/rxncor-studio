import { optionalEnv } from "@/config/server-env";
import { siteConfig } from "@/config/site";

type EmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
};

type EmailResult = {
  sent: number;
  failed: number;
  skipped: boolean;
};

type ContactEmailInput = {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  ipAddress?: string | null;
};

type ShootEmailInput = {
  name: string;
  email: string;
  phone?: string | null;
  shootType: string;
  location?: string | null;
  start: string;
  end: string;
  message?: string | null;
  ipAddress?: string | null;
};

type AlbumReadyInput = {
  albumTitle: string;
  albumUrl: string;
  photoCount: number;
  hasZip: boolean;
  isPasswordProtected: boolean;
  requiresEmail: boolean;
  clients: Array<{
    name: string;
    email: string | null;
    hasClientPassword: boolean;
  }>;
};

type ShootStatusInput = {
  name: string;
  email: string;
  status: "reviewing" | "accepted" | "declined" | "archived" | "new";
  shootType: string;
  start: string;
  end: string;
  location?: string | null;
  albumUrl?: string | null;
};

function emailConfig() {
  return {
    apiKey: optionalEnv("RESEND_API_KEY"),
    from: optionalEnv("EMAIL_FROM"),
    replyTo: optionalEnv("EMAIL_REPLY_TO") ?? siteConfig.contactEmail,
    adminEmail: optionalEnv("ADMIN_NOTIFICATION_EMAIL") ?? siteConfig.contactEmail
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function formatWhen(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Melbourne"
  }).format(date);
}

function textRows(rows: Array<[string, string | null | undefined]>) {
  return rows
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

function htmlRows(rows: Array<[string, string | null | undefined]>) {
  return rows
    .filter(([, value]) => Boolean(value))
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #ddd6c8;color:#6b6258;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #ddd6c8;color:#11100e;font-weight:700;">${escapeHtml(String(value))}</td>
        </tr>`
    )
    .join("");
}

function emailShell(title: string, intro: string, body: string, action?: { href: string; label: string }) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f3eee4;color:#11100e;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:660px;margin:0 auto;padding:28px 18px;">
      <div style="border:2px solid #11100e;background:#fffaf0;box-shadow:6px 6px 0 rgba(17,16,14,.15);">
        <div style="padding:22px;border-bottom:2px solid #11100e;">
          <div style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.16em;color:#9a3323;">rxncor.studio</div>
          <h1 style="margin:14px 0 0;font-size:42px;line-height:.95;letter-spacing:0;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:22px;">
          <p style="margin:0 0 18px;color:#5f574e;font-size:16px;line-height:1.55;">${escapeHtml(intro)}</p>
          ${body}
          ${
            action
              ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(action.href)}" style="display:inline-block;border:2px solid #11100e;background:#11100e;color:#fffaf0;text-decoration:none;font-weight:900;padding:12px 16px;">${escapeHtml(action.label)}</a></p>`
              : ""
          }
        </div>
      </div>
      <p style="margin:18px 0 0;color:#6b6258;font-size:12px;line-height:1.5;">
        Sent by rxncor.studio. Reply to this email if you need to reach Malindu.
      </p>
    </div>
  </body>
</html>`;
}

async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const config = emailConfig();
  const recipients = Array.isArray(payload.to) ? payload.to.filter(Boolean) : [payload.to].filter(Boolean);

  if (!config.apiKey || !config.from || recipients.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.from,
      to: recipients,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      reply_to: payload.replyTo || config.replyTo
    })
  }).catch((error: unknown) => {
    console.error("Email request failed", error);
    return null;
  });

  if (!response) {
    return { sent: 0, failed: recipients.length, skipped: false };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "No response body");
    console.error("Email provider rejected message", response.status, detail);
    return { sent: 0, failed: recipients.length, skipped: false };
  }

  return { sent: recipients.length, failed: 0, skipped: false };
}

function mergeResults(results: EmailResult[]): EmailResult {
  return results.reduce(
    (total, result) => ({
      sent: total.sent + result.sent,
      failed: total.failed + result.failed,
      skipped: total.skipped && result.skipped
    }),
    { sent: 0, failed: 0, skipped: true }
  );
}

export async function sendContactEmails(input: ContactEmailInput) {
  const config = emailConfig();
  const rows: Array<[string, string | null | undefined]> = [
    ["Name", input.name],
    ["Email", input.email],
    ["Phone", input.phone],
    ["IP", input.ipAddress]
  ];
  const message = input.message.trim();

  const admin = await sendEmail({
    to: config.adminEmail,
    replyTo: input.email,
    subject: `New contact message from ${input.name}`,
    text: `${textRows(rows)}\n\nMessage:\n${message}`,
    html: emailShell(
      "New contact message",
      "A new message came through the rxncor.studio contact form.",
      `<table style="width:100%;border-collapse:collapse;border:1px solid #ddd6c8;">${htmlRows(rows)}</table>
       <div style="margin-top:18px;padding:16px;border:1px solid #ddd6c8;background:#f8f5ef;color:#11100e;line-height:1.55;">${nl2br(message)}</div>`
    )
  });

  const client = await sendEmail({
    to: input.email,
    subject: "Message received - rxncor.studio",
    text: `Hi ${input.name},\n\nThanks for reaching out. I received your message and will reply as soon as I can.\n\nYour message:\n${message}\n\n- Malindu`,
    html: emailShell(
      "Message received",
      `Hi ${input.name}, thanks for reaching out. I received your message and will reply as soon as I can.`,
      `<div style="padding:16px;border:1px solid #ddd6c8;background:#f8f5ef;color:#11100e;line-height:1.55;">${nl2br(message)}</div>`
    )
  });

  return mergeResults([admin, client]);
}

export async function sendShootRequestEmails(input: ShootEmailInput) {
  const config = emailConfig();
  const rows: Array<[string, string | null | undefined]> = [
    ["Name", input.name],
    ["Email", input.email],
    ["Phone", input.phone],
    ["Shoot type", input.shootType],
    ["Location", input.location],
    ["Start", formatWhen(input.start)],
    ["Finish", formatWhen(input.end)],
    ["IP", input.ipAddress]
  ];
  const message = input.message?.trim() || "No extra message.";

  const admin = await sendEmail({
    to: config.adminEmail,
    replyTo: input.email,
    subject: `New shoot request from ${input.name}`,
    text: `${textRows(rows)}\n\nMessage:\n${message}`,
    html: emailShell(
      "New shoot request",
      "A new shoot request came through the booking form.",
      `<table style="width:100%;border-collapse:collapse;border:1px solid #ddd6c8;">${htmlRows(rows)}</table>
       <div style="margin-top:18px;padding:16px;border:1px solid #ddd6c8;background:#f8f5ef;color:#11100e;line-height:1.55;">${nl2br(message)}</div>`,
      { href: `${siteConfig.url}/rxncor-admin`, label: "Open admin" }
    )
  });

  const client = await sendEmail({
    to: input.email,
    subject: "Shoot request received - rxncor.studio",
    text: `Hi ${input.name},\n\nI received your shoot request and will confirm availability soon.\n\nShoot: ${input.shootType}\nStart: ${formatWhen(input.start)}\nFinish: ${formatWhen(input.end)}\n\n- Malindu`,
    html: emailShell(
      "Shoot request received",
      `Hi ${input.name}, I received your shoot request and will confirm availability soon.`,
      `<table style="width:100%;border-collapse:collapse;border:1px solid #ddd6c8;">${htmlRows(rows.slice(3, 7))}</table>`
    )
  });

  return mergeResults([admin, client]);
}

export async function sendShootStatusEmail(input: ShootStatusInput) {
  const statusCopy: Record<ShootStatusInput["status"], string> = {
    new: "Your request has been received.",
    reviewing: "I am reviewing the timing and details now.",
    accepted: "Your shoot request has been accepted. I will follow up with any final details.",
    declined: "I cannot take this shoot at the requested time. We can look at another slot if that helps.",
    archived: "This request has been archived."
  };
  const rows: Array<[string, string | null | undefined]> = [
    ["Status", input.status],
    ["Shoot type", input.shootType],
    ["Location", input.location],
    ["Start", formatWhen(input.start)],
    ["Finish", formatWhen(input.end)]
  ];

  return sendEmail({
    to: input.email,
    subject: `Shoot request update - ${siteConfig.name}`,
    text: `Hi ${input.name},\n\n${statusCopy[input.status]}\n\n${textRows(rows)}\n\n- Malindu`,
    html: emailShell(
      "Shoot request update",
      `Hi ${input.name}, ${statusCopy[input.status]}`,
      `<table style="width:100%;border-collapse:collapse;border:1px solid #ddd6c8;">${htmlRows(rows)}</table>`,
      input.albumUrl ? { href: input.albumUrl, label: "Open gallery" } : undefined
    )
  });
}

export async function sendAlbumReadyEmails(input: AlbumReadyInput) {
  const recipients = input.clients.filter((client) => client.email);

  if (!recipients.length) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const results = await Promise.all(
    recipients.map((client) => {
      const accessNotes = [
        input.requiresEmail ? "This gallery asks for your email before viewing." : null,
        input.isPasswordProtected
          ? client.hasClientPassword
            ? "Use your client email and personal client password, or the gallery password if one was shared."
            : "Use the gallery password shared by Malindu."
          : client.hasClientPassword
            ? "You can also sign in from the client login page with your client password."
            : null,
        input.hasZip ? "A full album ZIP download is attached in the gallery." : null
      ].filter(Boolean);

      return sendEmail({
        to: client.email as string,
        subject: `${input.albumTitle} is ready - rxncor.studio`,
        text: `Hi ${client.name},\n\nYour gallery is ready.\n\nAlbum: ${input.albumTitle}\nPhotos: ${input.photoCount}\nLink: ${input.albumUrl}\n\n${accessNotes.join("\n")}\n\n- Malindu`,
        html: emailShell(
          "Your gallery is ready",
          `Hi ${client.name}, your gallery is ready.`,
          `<table style="width:100%;border-collapse:collapse;border:1px solid #ddd6c8;">${htmlRows([
            ["Album", input.albumTitle],
            ["Photos", String(input.photoCount)],
            ["ZIP", input.hasZip ? "Ready" : "Not attached"],
            ["Access", accessNotes.join(" ")]
          ])}</table>`,
          { href: input.albumUrl, label: "Open gallery" }
        )
      });
    })
  );

  return mergeResults(results);
}
