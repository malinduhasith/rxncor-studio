import { optionalEnv } from "@/config/server-env";

function parseEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function adminEmailAllowlist() {
  const explicitEmails = parseEmails(optionalEnv("ADMIN_EMAILS"));

  if (explicitEmails.length) {
    return explicitEmails;
  }

  const notificationEmails = parseEmails(optionalEnv("ADMIN_NOTIFICATION_EMAIL"));

  if (notificationEmails.length) {
    return notificationEmails;
  }

  return [];
}

export function isAdminEmailAllowed(email: string | null | undefined) {
  const allowlist = adminEmailAllowlist();

  if (!allowlist.length) {
    return true;
  }

  return Boolean(email && allowlist.includes(email.toLowerCase()));
}
