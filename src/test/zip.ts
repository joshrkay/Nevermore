// Zip files built and taken apart in tests, with Node's own zlib: an .xlsx is one, so a test can add a part to a
// workbook exceljs wrote, or craft a central directory that declares sizes nothing actually holds.
import { crc32, inflateRawSync } from "node:zlib";

export interface ZipPart {
  name: string;
  data: Uint8Array | string;
  /** The uncompressed size the central directory declares; the real one unless a test lies about it. */
  declaredSize?: number;
}

const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

/** A zip of these parts, each stored (not compressed). */
export function zipOf(parts: readonly ZipPart[]): Uint8Array {
  const enc = new TextEncoder();
  const out: number[] = [];
  const central: number[] = [];
  for (const part of parts) {
    const name = [...enc.encode(part.name)];
    const data = typeof part.data === "string" ? enc.encode(part.data) : part.data;
    const crc = crc32(data);
    const size = part.declaredSize ?? data.length;
    const offset = out.length;
    out.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(size), ...u16(name.length), ...u16(0), ...name);
    for (const b of data) out.push(b);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(size),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name);
  }
  const at = out.length;
  out.push(...central, ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(parts.length), ...u16(parts.length), ...u32(central.length), ...u32(at), ...u16(0));
  return new Uint8Array(out);
}

/** The parts of a zip, unpacked. */
export function unzip(bytes: Uint8Array): ZipPart[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (view.getUint32(end, true) !== 0x06054b50) end--;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const parts: ZipPart[] = [];
  for (let n = 0; n < count; n++) {
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const skip = nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const raw = bytes.subarray(start, start + compressed);
    parts.push({ name, data: method === 8 ? new Uint8Array(inflateRawSync(raw)) : new Uint8Array(raw) });
    at += 46 + skip;
  }
  return parts;
}

/** A workbook's bytes with more parts added, as another program might have saved it. */
export const withParts = (xlsx: Uint8Array, extra: readonly ZipPart[]) => zipOf([...unzip(xlsx), ...extra]);

/** The names of a zip's parts, folders left out. */
export const partNames = (bytes: Uint8Array) => unzip(bytes).map((p) => p.name).filter((n) => !n.endsWith("/"));
