import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadTs } from "./helpers/load-ts.mjs";

const guard = loadTs(fileURLToPath(new URL("../lib/form-abuse.ts", import.meta.url)));
const legitimate = { name: "Malindu Herath", email: "test@example.com", phone: "", message: "Can you photograph our graduation in Melbourne?" };

test("blocks the observed scam and invisible-character variants", () => {
  for (const message of ["Вам перевод 117709 руб. получить тут https://goo.su/example", "https://GOO.\u200bSU/example", "Claim your prize https://example.com/claim"]) {
    assert.equal(guard.isSpamSubmission({ ...legitimate, message }, ""), true);
  }
});
test("does not block genuine multilingual enquiries or portfolio links", () => {
  for (const message of [legitimate.message, "Здравствуйте, нужна фотосессия на выпускной.", "මගේ උත්සවයේ ඡායාරූප ගැනීමට පුළුවන්ද?", "Here is my mood board: https://pin.it/example and venue https://example.com/venue"]) {
    assert.equal(guard.isSpamSubmission({ ...legitimate, message }, ""), false);
  }
});
test("honeypot and links in the name are rejected", () => {
  assert.equal(guard.isSpamSubmission(legitimate, "https://spam.example"), true);
  assert.equal(guard.isSpamSubmission({ ...legitimate, name: "https://spam.example" }, ""), true);
});
test("duplicate keys ignore name changes, case and whitespace; booking dates remain distinct", () => {
  const a = guard.publicFormKeys("contact", legitimate, "192.0.2.1");
  const b = guard.publicFormKeys("contact", { ...legitimate, name: "Another name", email: "TEST@EXAMPLE.COM", message: `  ${legitimate.message.toUpperCase()}  ` }, "192.0.2.2");
  assert.equal(a.p_duplicate_hash, b.p_duplicate_hash);
  assert.equal(a.p_email_hash, b.p_email_hash);
  assert.notEqual(a.p_ip_hash, b.p_ip_hash);
  assert.match(a.p_email_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(guard.publicFormKeys("shoot", legitimate, "192.0.2.1", "date1").p_duplicate_hash, guard.publicFormKeys("shoot", legitimate, "192.0.2.1", "date2").p_duplicate_hash);
});

function actionHarness(result = { data: "allowed", error: null }) {
  const calls = { rpc: 0, insert: 0, email: 0 };
  const actions = loadTs(fileURLToPath(new URL("../app/actions.ts", import.meta.url)), {
    "next/headers": { headers: async () => new Headers() },
    "next/navigation": { redirect: (url) => { throw new Error(url); } },
    "@/lib/email": { sendContactEmails: async () => { calls.email++; } },
    "@/lib/rate-limit": { clientIpFromHeaders: () => "192.0.2.1", checkRateLimit: () => ({ allowed: true }) },
    "@/lib/form-abuse": guard,
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({
      rpc: async () => { calls.rpc++; return result; },
      from: () => ({ insert: async () => { calls.insert++; return { error: null }; } })
    }) }
  });
  return { calls, submit: async (values) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    await actions.submitContactAction(form);
  } };
}
test("known spam never reaches database insert or either email notification", async () => {
  const h = actionHarness();
  await assert.rejects(h.submit({ ...legitimate, message: "Вам перевод 117709 руб. https://goo.su/example" }), /contact=sent/);
  assert.deepEqual(h.calls, { rpc: 0, insert: 0, email: 0 });
});
for (const status of ["duplicate", "rate-limited"]) test(`${status} never sends mail or saves an enquiry`, async () => {
  const h = actionHarness({ data: status, error: null });
  await assert.rejects(h.submit(legitimate), /contact=rate-limited/);
  assert.deepEqual(h.calls, { rpc: 1, insert: 0, email: 0 });
});
test("normal enquiry is saved then passed to the mailer", async () => {
  const h = actionHarness();
  await assert.rejects(h.submit(legitimate), /contact=sent/);
  assert.deepEqual(h.calls, { rpc: 1, insert: 1, email: 1 });
});
test("guard outages fail closed without sending mail", async () => {
  const h = actionHarness({ data: null, error: { code: "TEST_UNAVAILABLE" } });
  await assert.rejects(h.submit(legitimate), /contact=error/);
  assert.deepEqual(h.calls, { rpc: 1, insert: 0, email: 0 });
});
