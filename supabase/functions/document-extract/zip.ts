// Just enough of the zip format to read one entry out of a .docx, or to measure what an .xlsx unzips
// to: the central directory, stored and deflated entries, no zip64 or encryption. Inflating uses the
// runtime's DecompressionStream (Deno, browsers, Node 18+), so no dependency, fed a slice at a time
// and stopped once it passes its limit, so a small file can't expand into a huge one.

export class ZipError extends Error {}
/** The archive, or an entry of it, unzips to more than was allowed. */
export class ZipTooLargeError extends ZipError {}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  /** What the central directory says the entry unzips to. A crafted file can say anything. */
  uncompressedSize: number;
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
      uncompressedSize: view.getUint32(p + 24, true),
      localOffset: view.getUint32(p + 42, true),
      name: decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength)),
    });
    p += 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  return out;
}

// How much compressed input the decompressor is given at a time. Deno's DecompressionStream inflates each
// written chunk completely before any of it can be read, so `maxBytes` is only checked between writes:
// written whole, a 10 MB entry could expand to about 10 GB first. At deflate's most (about 1,032 to 1) a
// slice this size expands to about 16 MB, and the source is pulled only as output is read. Smaller slices
// bound that further but cost a stream round trip each, which a large legitimate file pays thousands of.
export const INFLATE_SLICE_BYTES = 16 * 1024;

type Decompressor = () => ReadableWritablePair<Uint8Array, Uint8Array>;
const deflateRaw: Decompressor = () => new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;

/** Inflates raw deflate data, refusing (ZipTooLargeError) once the output passes `maxBytes`. */
export async function inflateRaw(data: Uint8Array, maxBytes: number, decompressor: Decompressor = deflateRaw): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const total = await inflateChunks(data, maxBytes, decompressor, (chunk) => chunks.push(chunk));
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Inflates `data`, handing each piece of output to `each`; returns the length, or throws past `maxBytes`. */
async function inflateChunks(data: Uint8Array, maxBytes: number, decompressor: Decompressor, each: (chunk: Uint8Array) => void): Promise<number> {
  let fed = 0;
  const source = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (fed >= data.length) {
          controller.close();
          return;
        }
        controller.enqueue(data.subarray(fed, fed + INFLATE_SLICE_BYTES));
        fed += INFLATE_SLICE_BYTES;
      },
    },
    { highWaterMark: 0 },
  );
  const stream = source.pipeThrough(decompressor());
  const reader = stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ZipTooLargeError("entry too large");
    }
    each(value);
  }
}

/** An entry's stored bytes (compressed, unless the entry is stored as is). */
function entryData(bytes: Uint8Array, entry: Entry): Uint8Array {
  if (entry.flags & 0x1) throw new ZipError("encrypted entry");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const p = entry.localOffset;
  if (p + 30 > bytes.length || view.getUint32(p, true) !== LOCAL) throw new ZipError("bad local header");
  const start = p + 30 + view.getUint16(p + 26, true) + view.getUint16(p + 28, true);
  return bytes.subarray(start, start + entry.compressedSize);
}

/** The bytes of the entry called `name`, or null when the archive has no such entry. */
export async function readZipEntry(bytes: Uint8Array, name: string, maxBytes: number): Promise<Uint8Array | null> {
  const entry = entries(bytes).find((e) => e.name === name);
  if (!entry) return null;
  const data = entryData(bytes, entry);
  if (entry.method === 0) {
    if (data.length > maxBytes) throw new ZipTooLargeError("entry too large");
    return data;
  }
  if (entry.method === 8) return await inflateRaw(data, maxBytes);
  throw new ZipError(`unsupported compression ${entry.method}`);
}

/**
 * What the whole archive unzips to, refusing (ZipTooLargeError) past `max`. The sizes the archive declares
 * are checked first, which turns away an honest bomb without inflating anything; then every entry is
 * inflated and counted (and its output dropped), since a crafted archive can declare whatever it likes.
 */
export async function unzippedSize(bytes: Uint8Array, max: number): Promise<number> {
  const list = entries(bytes);
  if (list.reduce((sum, e) => sum + e.uncompressedSize, 0) > max) throw new ZipTooLargeError("archive too large");
  let total = 0;
  for (const entry of list) {
    const data = entryData(bytes, entry);
    if (entry.method === 0) total += data.length;
    else if (entry.method === 8) total += await inflateChunks(data, max - total, deflateRaw, () => {});
    else throw new ZipError(`unsupported compression ${entry.method}`);
    if (total > max) throw new ZipTooLargeError("archive too large");
  }
  return total;
}
