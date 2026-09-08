import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const sourceUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
async function moduleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
  return sourceUrl(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
}
const tokensUrl = await moduleUrl("../lib/gallery-access.ts");
const tokens = await import(tokensUrl);
const securityUrl = await moduleUrl("../lib/gallery-security.ts", { "@/lib/gallery-access": tokensUrl });
const adminUrl = await moduleUrl("../lib/admin-auth.ts", { "@/config/server-env": sourceUrl('export const optionalEnv = name => name === "ADMIN_EMAILS" ? globalThis.rxncorAccessTest.adminEmails : undefined;') });
const access = await import(await moduleUrl("../lib/download-access.ts", {
  "next/headers": sourceUrl('export const cookies = async () => ({ get: name => { const value = globalThis.rxncorAccessTest.cookies[name]; return value ? { value } : undefined; } });'),
  "@/lib/admin-auth": adminUrl, "@/lib/gallery-security": securityUrl,
  "@/lib/supabase/admin": sourceUrl('export const createSupabaseAdminClient = () => globalThis.rxncorAccessTest.database;'),
  "@/lib/supabase/server": sourceUrl('export const createSupabaseServerClient = async () => ({ auth: { getUser: async () => ({ data: { user: globalThis.rxncorAccessTest.user } }) } });'),
  "@/lib/http": sourceUrl('export const noStoreJson = (data, init) => Response.json(data, init);')
}));

function setup(overrides = {}) {
  const album = { id: "album", title: "Private album", is_public: false, is_password_protected: true, password_hash: "synthetic-hash", expires_at: null, allow_client_password_access: true, ...overrides };
  const state = { album, cookies: {}, user: null, adminEmails: "admin@example.test", queryError: null };
  state.database = { from(table) {
    let rows = table === "albums" ? [album] : table === "clients" ? [{ id: "client", email: "client@example.test", password_hash: "client-hash" }] : [];
    return { select() { return this; }, eq(key, value) { rows = rows.filter(row => row[key] === value); return this; },
      async maybeSingle() { return { data: rows[0] || null, error: state.queryError }; }, then(resolve) { return Promise.resolve({ data: rows }).then(resolve); } };
  } };
  globalThis.rxncorAccessTest = state;
  return state;
}

test("a signed-in non-admin cannot bypass a private gallery password for downloads", async () => {
  const state = setup(); state.user = { email: "other@example.test" };
  await assert.rejects(access.authorizeAlbumDownload("album"), error => error.status === 403);
});
test("missing admin configuration cannot turn any signed-in user into a download administrator", async () => {
  const state = setup(); state.adminEmails = ""; state.user = { email: "other@example.test" };
  await assert.rejects(access.authorizeAlbumDownload("album"), error => error.status === 403);
});
test("an allowlisted admin and an unlocked client can download a private gallery", async () => {
  const state = setup(); state.user = { email: "admin@example.test" };
  assert.equal((await access.authorizeAlbumDownload("album")).album.id, "album");
  state.user = null; state.cookies[tokens.albumAccessCookieName("album")] = tokens.createAlbumAccessToken("album", "synthetic-hash");
  assert.equal((await access.authorizeAlbumDownload("album")).album.id, "album");
});
test("legacy assigned-client sessions are honored by the same download authorization", async () => {
  const state = setup({ client_id: "client" });
  state.cookies[tokens.clientSessionCookieName()] = tokens.createClientSessionCookieValue("client", "client-hash");
  assert.equal((await access.authorizeAlbumDownload("album")).clientEmail, "client@example.test");
});
test("expired galleries reject direct downloads even with an existing unlock cookie", async () => {
  const state = setup({ expires_at: "2020-01-01T00:00:00Z" });
  state.cookies[tokens.albumAccessCookieName("album")] = tokens.createAlbumAccessToken("album", "synthetic-hash");
  await assert.rejects(access.authorizeAlbumDownload("album"), error => error.status === 410);
});
test("album lookup errors fail closed", async () => {
  const state = setup({ is_public: true, is_password_protected: false }); state.queryError = { message: "offline" };
  await assert.rejects(access.authorizeAlbumDownload("album"), error => error.status === 503);
});
test("archive preparation rejects requests from unrelated websites", () => {
  assert.throws(() => access.checkDownloadOrigin(new Request("https://www.rxncor.studio/api/downloads/archive", { headers: { origin: "https://unrelated.example" } })), error => error.status === 403);
  assert.doesNotThrow(() => access.checkDownloadOrigin(new Request("https://www.rxncor.studio/api/downloads/archive", { headers: { origin: "https://www.rxncor.studio" } })));
});
