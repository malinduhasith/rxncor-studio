import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const tokensUrl = await moduleUrl("../lib/gallery-access.ts");
const tokens = await import(tokensUrl);
const security = await import(await moduleUrl("../lib/gallery-security.ts", { "@/lib/gallery-access": tokensUrl }));
const passwords = await import(await moduleUrl("../lib/password.ts"));
const album = { id: "test-album", is_public: false, is_password_protected: true, password_hash: "test-album-hash", requires_email: true, allow_client_password_access: true };
const client = { id: "test-client", email: "qa@example.test", password_hash: "test-client-hash" };

function database(assigned = true, currentClient = client) {
  const tables = { clients: [currentClient], album_clients: assigned ? [{ album_id: album.id, client_id: currentClient.id }] : [] };
  return { from(table) {
    let rows = tables[table] || [];
    return {
      select() { return this; },
      eq(key, value) { rows = rows.filter(row => row[key] === value); return this; },
      in(key, values) { rows = rows.filter(row => values.includes(row[key])); return this; },
      ilike(key, value) { rows = rows.filter(row => row[key]?.toLowerCase() === value.toLowerCase()); return this; },
      async maybeSingle() { return { data: rows[0] || null }; },
      then(resolve) { return Promise.resolve({ data: rows }).then(resolve); },
    };
  } };
}
function access(cookies = {}, record = album, db = database()) {
  return security.getGalleryAccessForCookies({ supabase: db, album: record, cookieStore: { get: name => cookies[name] === undefined ? undefined : { value: cookies[name] } } });
}
const albumCookie = hash => ({ [tokens.albumAccessCookieName(album.id)]: tokens.createAlbumAccessToken(album.id, hash) });
const clientCookies = { ...albumCookie(`client:${client.id}:${client.password_hash}`), [tokens.albumClientEmailCookieName(album.id)]: client.email };

test("anonymous visitors cannot view a private album", async () => assert.equal((await access()).canAccess, false));
test("public unprotected albums remain public", async () => assert.equal((await access({}, { ...album, is_public: true, is_password_protected: false, requires_email: false })).canAccess, true));
test("album password access works independently of client email", async () => assert.equal((await access(albumCookie(album.password_hash))).canAccess, true));
test("assigned client password can unlock a protected album", async () => assert.equal((await access(clientCookies)).canAccess, true));
test("an unassigned client cannot unlock another client's album", async () => assert.equal((await access(clientCookies, album, database(false))).canAccess, false));
test("rotating the album password invalidates previous access", async () => assert.equal((await access(albumCookie(album.password_hash), { ...album, password_hash: "new-hash" })).canAccess, false));
test("rotating the client password invalidates previous access", async () => assert.equal((await access(clientCookies, album, database(true, { ...client, password_hash: "new-client-hash" }))).canAccess, false));
test("disabling client password access preserves album password access", async () => {
  const record = { ...album, allow_client_password_access: false };
  assert.equal((await access(clientCookies, record)).canAccess, false);
  assert.equal((await access(albumCookie(album.password_hash), record)).canAccess, true);
});
test("a signed-in assigned client can open their album", async () => {
  const cookies = { [tokens.clientSessionCookieName()]: tokens.createClientSessionCookieValue(client.id, client.password_hash) };
  assert.equal((await access(cookies)).canAccess, true);
  assert.equal((await access(cookies, album, database(false))).canAccess, false);
});
test("old email-only access must fail after password protection is enabled", async () => {
  const cookies = { [tokens.albumAccessCookieName(album.id)]: tokens.createEmailAccessToken(album.id, client.email), [tokens.albumClientEmailCookieName(album.id)]: client.email };
  assert.equal((await access(cookies, { ...album, is_password_protected: false })).canAccess, true);
  assert.equal((await access(cookies)).canAccess, false);
});
test("password verification rejects wrong or malformed credentials", () => {
  const hash = passwords.hashPassword("synthetic-QA-password");
  assert.equal(passwords.verifyPassword("synthetic-QA-password", hash), true);
  assert.equal(passwords.verifyPassword("wrong-password", hash), false);
  assert.equal(passwords.verifyPassword("synthetic-QA-password", null), false);
  assert.equal(passwords.verifyPassword("synthetic-QA-password", "malformed"), false);
});
