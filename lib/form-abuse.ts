import { createHash } from "node:crypto";

type PublicForm = { name: string; email: string; message?: string | null };

function normalize(value: string) {
  return value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLowerCase();
}

export function isSpamSubmission(input: PublicForm, honeypot: unknown) {
  if (typeof honeypot === "string" && honeypot.trim()) return true;
  const name = normalize(input.name);
  const message = normalize(input.message || "");
  const text = `${name} ${message}`;
  // Match the observed campaign, not a language, country, or email provider.
  if (/(?:^|[^a-z0-9-])(?:www\.)?goo\.su(?:[\s/#?:]|$)/i.test(text)) return true;
  if (/(?:https?:\/\/|www\.)/i.test(name)) return true;
  const hasLink = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|su|ru|net|me)\//i.test(text);
  const moneyLure = /вам\s+(?:денежный\s+)?перевод\s*\d|(?:получить|забрать)\s+\d+\s*(?:руб|₽)|(?:claim|collect)\s+(?:your\s+)?(?:prize|winnings)/i.test(text);
  return hasLink && moneyLure;
}

export function publicFormKeys(kind: "contact" | "shoot", input: PublicForm, ip: string, extra = "") {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const email = normalize(input.email);
  return {
    p_ip_hash: hash(ip),
    p_email_hash: hash(email),
    p_duplicate_hash: hash(JSON.stringify([kind, email, normalize(input.message || "").replace(/\s+/g, " "), extra]))
  };
}
