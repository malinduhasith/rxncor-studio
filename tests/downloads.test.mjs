import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import ts from "typescript";

const sourceUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
async function moduleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
  return sourceUrl(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
}
const zipUrl = await moduleUrl("../lib/zip.ts");
const zip = await import(zipUrl);
const { readAlbumPhotos } = await import(await moduleUrl("../lib/album-photos.ts"));

async function independentExtract(bytes, expected) {
  const folder = await mkdtemp(join(tmpdir(), "rxncor-zip-test-"));
  try {
    await writeFile(join(folder, "photos.zip"), bytes);
    await writeFile(join(folder, "expected.json"), JSON.stringify(expected.map(([name, value]) => [name, Buffer.from(value).toString("base64")])));
    execFileSync("python", ["-c", "import zipfile,json,base64,sys; z=zipfile.ZipFile(sys.argv[1]); e=json.load(open(sys.argv[2])); assert z.namelist()==[n for n,v in e]; assert z.testzip() is None; assert all(z.read(n)==base64.b64decode(v) for n,v in e)", join(folder, "photos.zip"), join(folder, "expected.json")]);
  } finally { await rm(folder, { recursive: true, force: true }); }
}

test("ZIP extracts byte-for-byte with Unicode, duplicate names, empty files and every checkpoint boundary", async () => {
  const values = [randomBytes(2051), Buffer.alloc(0), Buffer.from("original photograph"), randomBytes(523)];
  const names = zip.uniqueZipNames(["../කැමරා.jpg", "..\\empty.jpg", "කැමරා.jpg", "EMPTY.jpg"]);
  assert.deepEqual(names, ["කැමරා.jpg", "empty.jpg", "කැමරා (2).jpg", "EMPTY (2).jpg"]);
  let entries = values.map((bytes, i) => ({ name: names[i], size: bytes.length, offset: 0, crc: 0 }));
  zip.zipLayout(entries);
  let cursor = zip.initialZipCursor();
  const chunks = [];
  while (cursor.phase !== "done") {
    chunks.push(await zip.nextZipChunk(entries, cursor, async (i, offset, length) => values[i].subarray(offset, offset + length), 13));
    // Every call behaves like a new server invocation, with no shared objects.
    entries = JSON.parse(JSON.stringify(entries)); cursor = JSON.parse(JSON.stringify(cursor));
  }
  await independentExtract(Buffer.concat(chunks), names.map((name, i) => [name, values[i]]));
});

test("ZIP64 supports more than 65,535 selected photos", async () => {
  const entries = Array.from({ length: 65536 }, (_, i) => ({ name: `${i}.jpg`, size: 0, offset: 0, crc: 0 }));
  zip.zipLayout(entries);
  const cursor = zip.initialZipCursor(); const chunks = [];
  while (cursor.phase !== "done") chunks.push(await zip.nextZipChunk(entries, cursor, async () => { throw new Error("Empty files need no body"); }, 1024 * 1024));
  const folder = await mkdtemp(join(tmpdir(), "rxncor-zip64-test-"));
  try {
    await writeFile(join(folder, "many.zip"), Buffer.concat(chunks));
    execFileSync("python", ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert len(z.infolist())==65536; assert z.read('65535.jpg')==b''", join(folder, "many.zip")]);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test("ZIP64 records originals and archive offsets larger than 4 GiB without truncation", () => {
  const entries = [{ name: "large.jpg", size: 0x100000001, offset: 0, crc: 0 }, { name: "last.jpg", size: 1, offset: 0, crc: 0 }];
  const layout = zip.zipLayout(entries);
  const local = zip.localHeader(entries[0]);
  assert.equal(local.readUInt32LE(18), 0xffffffff);
  assert.equal(local.readBigUInt64LE(30 + Buffer.byteLength(entries[0].name) + 4), BigInt(entries[0].size));
  const central = zip.centralHeader(entries[1]);
  assert.equal(central.readUInt32LE(42), 0xffffffff);
  assert.equal(central.readBigUInt64LE(46 + Buffer.byteLength(entries[1].name) + 4), BigInt(entries[1].offset));
  assert.equal(zip.endOfZip(entries).readBigUInt64LE(48), BigInt(layout.directoryOffset));
});

test("all-photo selection loads more than one database page", async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id: String(id) }));
  const ranges = [];
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, async range(start, end) { ranges.push([start, end]); return { data: rows.slice(start, end + 1) }; } };
  assert.equal((await readAlbumPhotos({ from: () => query }, "album", "id")).length, 1201);
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
});
test("a later database error never silently produces an incomplete album ZIP", async () => {
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, async range(start) { return start ? { error: { message: "Unavailable" } } : { data: Array(500).fill({ id: "photo" }) }; } };
  await assert.rejects(readAlbumPhotos({ from: () => query }, "album", "id"), /complete photo list/);
});

const errorUrl = sourceUrl('export class DownloadError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }');
const archive = await import(await moduleUrl("../lib/archive-jobs.ts", {
  "@aws-sdk/client-s3": import.meta.resolve("@aws-sdk/client-s3"),
  "@/config/server-env": sourceUrl('export const getR2Env = () => ({ bucket: "test-bucket", secretAccessKey: "synthetic-test-key-only" });'),
  "@/lib/r2": sourceUrl('export const createR2Client = () => globalThis.rxncorTestStorage;'),
  "@/lib/download-access": errorUrl,
  "@/lib/zip": zipUrl
}));

function storage() {
  const objects = new Map(); const uploads = new Map(); let sequence = 0;
  let failure = null;
  const namedError = name => Object.assign(new Error(name), { name });
  const store = (key, bytes) => { const object = { bytes: Buffer.from(bytes), etag: `"etag-${++sequence}"`, modified: new Date() }; objects.set(key, object); return object; };
  const service = {
    objects, uploads, store, calls: [], failOnce(match, name = "TimeoutError") { failure = { match, name }; },
    async send(command) {
      const name = command.constructor.name; const input = command.input;
      service.calls.push({ name, input });
      if (failure?.match(name, input, service)) { const { name: errorName } = failure; failure = null; throw namedError(errorName); }
      const object = objects.get(input.Key);
      if (name === "PutObjectCommand") {
        if ((input.IfMatch && object?.etag !== input.IfMatch) || (input.IfNoneMatch === "*" && object)) throw namedError("PreconditionFailed");
        return { ETag: store(input.Key, input.Body).etag };
      }
      if (name === "GetObjectCommand" || name === "HeadObjectCommand") {
        if (!object) throw namedError("NoSuchKey");
        if (input.IfMatch && input.IfMatch !== object.etag) throw namedError("PreconditionFailed");
        const range = input.Range?.match(/bytes=(\d+)-(\d+)/);
        const bytes = range ? object.bytes.subarray(Number(range[1]), Number(range[2]) + 1) : object.bytes;
        return { ETag: object.etag, ContentLength: bytes.length, Body: { async transformToByteArray() { return bytes; } } };
      }
      if (name === "CreateMultipartUploadCommand") { const id = `upload-${++sequence}`; uploads.set(id, new Map()); return { UploadId: id }; }
      if (name === "UploadPartCommand") {
        const parts = uploads.get(input.UploadId); if (!parts) throw namedError("NoSuchUpload");
        const part = { bytes: Buffer.from(input.Body), etag: `"part-${++sequence}"` }; parts.set(input.PartNumber, part); return { ETag: part.etag };
      }
      if (name === "CompleteMultipartUploadCommand") {
        const parts = uploads.get(input.UploadId); if (!parts) throw namedError("NoSuchUpload");
        const ordered = input.MultipartUpload.Parts.map((part, i, all) => {
          const stored = parts.get(part.PartNumber); assert.equal(part.ETag, stored.etag);
          if (i < all.length - 1) assert.ok(stored.bytes.length >= 5 * 1024 * 1024, "R2 multipart minimum");
          return stored.bytes;
        });
        store(input.Key, Buffer.concat(ordered)); uploads.delete(input.UploadId);
        if (service.loseCompleteResponse) { service.loseCompleteResponse = false; throw namedError("NoSuchUpload"); }
        return {};
      }
      if (name === "AbortMultipartUploadCommand") { uploads.delete(input.UploadId); return {}; }
      if (name === "DeleteObjectCommand") { objects.delete(input.Key); return {}; }
      if (name === "ListObjectsV2Command") return { Contents: [...objects].filter(([key]) => key.startsWith(input.Prefix)).map(([Key, o]) => ({ Key, LastModified: o.modified })).slice(0, input.MaxKeys) };
      throw new Error(`Unhandled ${name}`);
    }
  };
  globalThis.rxncorTestStorage = service;
  return service;
}

test("archive tokens reject tampering and expired links, and stored state does not expose original object keys", async () => {
  const s = storage(); s.store("private/secret-photo.jpg", Buffer.from("original"));
  const job = await archive.createArchiveJob("album", "Event", [{ id: "one", filename: "one.jpg", r2_object_key: "private/secret-photo.jpg" }]);
  const token = archive.archiveToken(job);
  assert.equal(archive.parseArchiveToken(token).albumId, "album");
  assert.throws(() => archive.parseArchiveToken(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a")), /Invalid/);
  assert.throws(() => archive.parseArchiveToken(archive.archiveToken({ ...job, expiresAt: Date.now() - 1 })), /expired/);
  const saved = [...s.objects].find(([key]) => key.endsWith(".bin"))[1].bytes;
  assert.equal(saved.includes(Buffer.from("private/secret-photo.jpg")), false);
  assert.equal((await archive.readArchiveJob(job.id)).job.files[0].key, "private/secret-photo.jpg");
});

test("a failed multipart checkpoint resumes without skipped bytes or duplicate photos", async () => {
  const s = storage(); const original = randomBytes(18 * 1024 * 1024 + 13);
  s.store("original.jpg", original);
  const job = await archive.createArchiveJob("album", "Event", [{ id: "one", filename: "original.jpg", r2_object_key: "original.jpg" }]);
  s.failOnce((name, input, store) => name === "PutObjectCommand" && store.calls.some(call => call.name === "UploadPartCommand"));
  await assert.rejects(archive.advanceArchiveJob(job.id), /Timeout/);
  const ready = await archive.advanceArchiveJob(job.id);
  assert.equal(ready.phase, "ready");
  const bytes = s.objects.get(archive.archiveObjectKey(ready)).bytes;
  assert.equal(bytes.length, ready.totalBytes);
  await independentExtract(bytes, [["original.jpg", original]]);
});

test("a lost completion response is recovered and parallel tabs cannot build the same job twice", async () => {
  const s = storage(); s.store("original.jpg", Buffer.from("unchanged original")); s.loseCompleteResponse = true;
  const job = await archive.createArchiveJob("album", "Event", [{ id: "one", filename: "original.jpg", r2_object_key: "original.jpg" }]);
  await Promise.all([archive.advanceArchiveJob(job.id), archive.advanceArchiveJob(job.id)]);
  const ready = (await archive.readArchiveJob(job.id)).job;
  assert.equal(ready.phase, "ready");
  assert.equal(s.calls.filter(call => call.name === "CreateMultipartUploadCommand").length, 1);
  await independentExtract(s.objects.get(archive.archiveObjectKey(ready)).bytes, [["original.jpg", Buffer.from("unchanged original")]]);
});

test("changing an original after preflight fails safely instead of producing a corrupt ZIP", async () => {
  const s = storage(); s.store("original.jpg", Buffer.from("original"));
  const job = await archive.createArchiveJob("album", "Event", [{ id: "one", filename: "original.jpg", r2_object_key: "original.jpg" }]);
  s.failOnce((name, input) => name === "GetObjectCommand" && input.Range, "PreconditionFailed");
  await assert.rejects(archive.advanceArchiveJob(job.id), /photo changed/);
  assert.equal((await archive.readArchiveJob(job.id)).job.phase, "failed");
  assert.equal(s.objects.has(archive.archiveObjectKey(job)), false);
});
