import { crc32 } from "node:zlib";

// Stored ZIP entries preserve the originals. ZIP64 is used only where the
// standard 32-bit fields overflow (PKWARE APPNOTE 4.3/4.5.3).
const U32 = 0xffffffff;
const FLAGS = 0x0808; // UTF-8 names and trailing CRC/size descriptors.
export type ZipEntry = { name: string; size: number; offset: number; crc: number };
export type ZipCursor = { phase: "header" | "data" | "descriptor" | "directory" | "end" | "done"; index: number; offset: number; crc: number; bytesRead: number };
export const initialZipCursor = (): ZipCursor => ({ phase: "header", index: 0, offset: 0, crc: 0, bytesRead: 0 });

export function safeDownloadName(value: string, fallback = "photo.jpg") {
  const base = value.normalize("NFC").split(/[/\\]/).pop() || fallback;
  const clean = base.replace(/[\x00-\x1f\x7f<>:"|?*]/g, "-").replace(/^\.+/, "").replace(/[. ]+$/, "").trim();
  return Array.from(clean || fallback).slice(0, 160).join("");
}

export function uniqueZipNames(names: string[]) {
  const used = new Set<string>();
  return names.map((name) => {
    const clean = safeDownloadName(name);
    const dot = clean.lastIndexOf(".");
    const stem = dot > 0 ? clean.slice(0, dot) : clean;
    const extension = dot > 0 ? clean.slice(dot) : "";
    let candidate = clean;
    for (let n = 2; used.has(candidate.toLocaleLowerCase("en")); n++) candidate = `${stem} (${n})${extension}`;
    used.add(candidate.toLocaleLowerCase("en"));
    return candidate;
  });
}

function extra64(values: number[]) {
  if (!values.length) return Buffer.alloc(0);
  const buffer = Buffer.alloc(4 + values.length * 8);
  buffer.writeUInt16LE(1, 0);
  buffer.writeUInt16LE(values.length * 8, 2);
  values.forEach((value, index) => buffer.writeBigUInt64LE(BigInt(value), 4 + index * 8));
  return buffer;
}

export function localHeader(entry: ZipEntry) {
  const large = entry.size >= U32;
  const name = Buffer.from(entry.name);
  const extra = extra64(large ? [entry.size, entry.size] : []);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(large ? 45 : 20, 4);
  header.writeUInt16LE(FLAGS, 6);
  header.writeUInt16LE(33, 12); // 1980-01-01; deterministic across retries.
  header.writeUInt32LE(large ? U32 : 0, 18);
  header.writeUInt32LE(large ? U32 : 0, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(extra.length, 28);
  return Buffer.concat([header, name, extra]);
}

export function dataDescriptor(entry: ZipEntry) {
  const large = entry.size >= U32;
  const buffer = Buffer.alloc(large ? 24 : 16);
  buffer.writeUInt32LE(0x08074b50, 0);
  buffer.writeUInt32LE(entry.crc, 4);
  if (large) {
    buffer.writeBigUInt64LE(BigInt(entry.size), 8);
    buffer.writeBigUInt64LE(BigInt(entry.size), 16);
  } else {
    buffer.writeUInt32LE(entry.size, 8);
    buffer.writeUInt32LE(entry.size, 12);
  }
  return buffer;
}

export function centralHeader(entry: ZipEntry) {
  const large = entry.size >= U32;
  const far = entry.offset >= U32;
  const name = Buffer.from(entry.name);
  const extra = extra64([...(large ? [entry.size, entry.size] : []), ...(far ? [entry.offset] : [])]);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(45, 4);
  header.writeUInt16LE(large || far ? 45 : 20, 6);
  header.writeUInt16LE(FLAGS, 8);
  header.writeUInt16LE(33, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(large ? U32 : entry.size, 20);
  header.writeUInt32LE(large ? U32 : entry.size, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(extra.length, 30);
  header.writeUInt32LE(far ? U32 : entry.offset, 42);
  return Buffer.concat([header, name, extra]);
}

export function zipLayout(entries: ZipEntry[]) {
  let offset = 0;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error("Invalid photo size");
    entry.offset = offset;
    offset += localHeader(entry).length + entry.size + dataDescriptor(entry).length;
  }
  const directorySize = entries.reduce((sum, entry) => sum + centralHeader(entry).length, 0);
  return { directoryOffset: offset, directorySize };
}

export function endOfZip(entries: ZipEntry[]) {
  const { directoryOffset, directorySize } = zipLayout(entries);
  const large = directoryOffset >= U32 || directorySize >= U32 || entries.length >= 65535;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(large ? 65535 : entries.length, 8);
  end.writeUInt16LE(large ? 65535 : entries.length, 10);
  end.writeUInt32LE(large ? U32 : directorySize, 12);
  end.writeUInt32LE(large ? U32 : directoryOffset, 16);
  if (!large) return end;
  const zip64 = Buffer.alloc(56);
  zip64.writeUInt32LE(0x06064b50, 0);
  zip64.writeBigUInt64LE(BigInt(44), 4);
  zip64.writeUInt16LE(45, 12);
  zip64.writeUInt16LE(45, 14);
  zip64.writeBigUInt64LE(BigInt(entries.length), 24);
  zip64.writeBigUInt64LE(BigInt(entries.length), 32);
  zip64.writeBigUInt64LE(BigInt(directorySize), 40);
  zip64.writeBigUInt64LE(BigInt(directoryOffset), 48);
  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0);
  locator.writeBigUInt64LE(BigInt(directoryOffset + directorySize), 8);
  locator.writeUInt32LE(1, 16);
  return Buffer.concat([zip64, locator, end]);
}

/** Fills one multipart buffer, yielding at the deadline. Cursor and CRC are
 * serializable, including mid-file and mid-header boundaries. */
export async function nextZipChunk(
  entries: ZipEntry[], cursor: ZipCursor,
  readRange: (index: number, offset: number, length: number) => Promise<Uint8Array>,
  capacity: number, deadline = Infinity
) {
  const chunks: Buffer[] = [];
  let length = 0;
  while (cursor.phase !== "done" && length < capacity && Date.now() < deadline) {
    if (cursor.phase === "data") {
      const entry = entries[cursor.index];
      const wanted = Math.min(entry.size - cursor.offset, capacity - length, 4 * 1024 * 1024);
      if (!wanted) { entry.crc = cursor.crc; cursor.phase = "descriptor"; cursor.offset = 0; continue; }
      const bytes = Buffer.from(await readRange(cursor.index, cursor.offset, wanted));
      if (bytes.length !== wanted) throw new Error("Photo download was incomplete. Please retry.");
      cursor.crc = crc32(bytes, cursor.crc);
      cursor.offset += wanted;
      cursor.bytesRead += wanted;
      chunks.push(bytes); length += wanted;
      continue;
    }
    if (cursor.phase === "header" && cursor.index >= entries.length) { cursor.phase = "directory"; cursor.index = 0; cursor.offset = 0; }
    if (cursor.phase === "directory" && cursor.index >= entries.length) { cursor.phase = "end"; cursor.offset = 0; }
    const block = cursor.phase === "header" ? localHeader(entries[cursor.index])
      : cursor.phase === "descriptor" ? dataDescriptor(entries[cursor.index])
      : cursor.phase === "directory" ? centralHeader(entries[cursor.index]) : endOfZip(entries);
    const bytes = block.subarray(cursor.offset, cursor.offset + capacity - length);
    chunks.push(bytes); length += bytes.length; cursor.offset += bytes.length;
    if (cursor.offset === block.length) {
      cursor.offset = 0;
      if (cursor.phase === "header") { cursor.phase = "data"; cursor.crc = 0; }
      else if (cursor.phase === "descriptor") { cursor.phase = "header"; cursor.index++; }
      else if (cursor.phase === "directory") cursor.index++;
      else cursor.phase = "done";
    }
  }
  return Buffer.concat(chunks, length);
}
