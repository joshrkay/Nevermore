// Just enough of the zip format to read one entry out of a .docx: the central directory, stored
// and deflated entries, no zip64 or encryption. Inflating uses the runtime's DecompressionStream
// (Deno, browsers, Node 18+), so no dependency, and stops once an entry passes `maxBytes` so a
// small file can't expand into a huge one.

export class ZipError extends Error {}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
  flags: number;
}

function entries(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record is the last 22 bytes, plus a comment of up to 64 KiB.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("not a zip file");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out: Entry[] = [];
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== CENTRAL) throw new ZipError("bad central directory");
    const nameLength = view.getUint16(p + 28, true);
    out.push({
      flags: view.getUint16(p + 8, true),
      method: view.getUint16(p + 10, true),
      compressedSize: view.getUint32(p + 20, true),
      localOffset: view.getUint32(p + 42, true),
      name: decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength)),
    });
    p += 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  return out;
}

async function inflate(data: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const stream = source.pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ZipError("entry too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** The bytes of the entry called `name`, or null when the archive has no such entry. */
export async function readZipEntry(bytes: Uint8Array, name: string, maxBytes: number): Promise<Uint8Array | null> {
  const entry = entries(bytes).find((e) => e.name === name);
  if (!entry) return null;
  if (entry.flags & 0x1) throw new ZipError("encrypted entry");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const p = entry.localOffset;
  if (p + 30 > bytes.length || view.getUint32(p, true) !== LOCAL) throw new ZipError("bad local header");
  const start = p + 30 + view.getUint16(p + 26, true) + view.getUint16(p + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) {
    if (data.length > maxBytes) throw new ZipError("entry too large");
    return data;
  }
  if (entry.method === 8) return await inflate(data, maxBytes);
  throw new ZipError(`unsupported compression ${entry.method}`);
}
