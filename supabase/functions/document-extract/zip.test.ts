import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { INFLATE_SLICE_BYTES, inflateRaw, readZipEntry, unzippedSize, ZipError, ZipTooLargeError } from "./zip";

// A zip with the given entries, deflated unless `stored`. CRCs are left at zero: the reader doesn't check them.
// `declared` replaces each entry's uncompressed size in the central directory, as a crafted file can.
function zip(files: Record<string, string>, opts: { stored?: boolean; declared?: number } = {}): Uint8Array {
  const enc = new TextEncoder();
  const locals: number[] = [];
  const central: number[] = [];
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const data = opts.stored ? raw : new Uint8Array(deflateRawSync(raw));
    const nameBytes = [...enc.encode(name)];
    const method = opts.stored ? 0 : 8;
    const offset = locals.length;
    locals.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(method), ...u16(0), ...u16(0), ...u32(0),
      ...u32(data.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0), ...nameBytes, ...data);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(method), ...u16(0), ...u16(0), ...u32(0),
      ...u32(data.length), ...u32(opts.declared ?? raw.length), ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset), ...nameBytes);
  }
  const count = Object.keys(files).length;
  const eocd = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count), ...u16(count), ...u32(central.length), ...u32(locals.length), ...u16(0)];
  return new Uint8Array([...locals, ...central, ...eocd]);
}

const text = (b: Uint8Array | null) => (b ? new TextDecoder().decode(b) : null);

describe("readZipEntry", () => {
  const doc = '<w:document><w:body><w:p><w:r><w:t>Carrier: Aetna</w:t></w:r></w:p></w:body></w:document>';

  it("reads a deflated entry by name", async () => {
    const bytes = zip({ "[Content_Types].xml": "<Types/>", "word/document.xml": doc });
    expect(text(await readZipEntry(bytes, "word/document.xml", 1_000_000))).toBe(doc);
  });

  it("reads a stored entry", async () => {
    expect(text(await readZipEntry(zip({ "word/document.xml": doc }, { stored: true }), "word/document.xml", 1_000_000))).toBe(doc);
  });

  it("returns null when the entry isn't there", async () => {
    expect(await readZipEntry(zip({ "xl/workbook.xml": "<x/>" }), "word/document.xml", 1_000_000)).toBeNull();
  });

  it("stops inflating an entry that grows past the limit", async () => {
    const bomb = zip({ "word/document.xml": "a".repeat(200_000) });
    expect(bomb.length).toBeLessThan(2_000);
    await expect(readZipEntry(bomb, "word/document.xml", 100_000)).rejects.toBeInstanceOf(ZipError);
  });

  it("hands the decompressor the entry a small slice at a time, and stops feeding it at the limit", async () => {
    // Deno's DecompressionStream expands each written chunk completely before any output can be read, so a
    // whole entry written at once would be inflated in full (deflate reaches about 1,032 to 1) before the
    // limit is ever checked. Node streams its output, which hides that, so the input itself is checked here.
    const compressed = new Uint8Array(deflateRawSync(Buffer.alloc(32 * 1024 * 1024)));
    const written: number[] = [];
    const spied = () => {
      const spy = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          written.push(chunk.length);
          controller.enqueue(chunk);
        },
      });
      return { writable: spy.writable, readable: spy.readable.pipeThrough(new DecompressionStream("deflate-raw")) };
    };
    await expect(inflateRaw(compressed, 1024 * 1024, spied)).rejects.toBeInstanceOf(ZipError);
    expect(Math.max(...written)).toBeLessThanOrEqual(INFLATE_SLICE_BYTES);
  });

  it("with a decompressor that expands each write at once, as Deno's does, stops within a slice's worth of the limit", async () => {
    // Every input byte becomes 100 output bytes, all at once per write, behind a stream's usual backpressure.
    const RATIO = 100;
    const produced: number[] = [];
    const denoLike = () =>
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          produced.push(chunk.length * RATIO);
          controller.enqueue(new Uint8Array(chunk.length * RATIO));
        },
      });
    const perSlice = RATIO * INFLATE_SLICE_BYTES;
    const limit = 4 * perSlice;
    await expect(inflateRaw(new Uint8Array(64 * INFLATE_SLICE_BYTES), limit, denoLike)).rejects.toBeInstanceOf(ZipError);
    // Written whole, the entry would have been expanded to 64 slices' worth in one go before the limit was checked.
    expect(Math.max(...produced)).toBeLessThanOrEqual(perSlice);
    expect(produced.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(limit + 3 * perSlice);
  });

  it("inflates an entry sliced into many pieces to the same bytes", async () => {
    const big = Array.from({ length: 20_000 }, (_, i) => `<w:p>${i}</w:p>`).join("");
    expect(text(await readZipEntry(zip({ "word/document.xml": big }), "word/document.xml", 10_000_000))).toBe(big);
  });

  it("refuses something that isn't a zip", async () => {
    await expect(readZipEntry(new TextEncoder().encode("not a zip at all, just text"), "word/document.xml", 1000)).rejects.toBeInstanceOf(ZipError);
  });
});

// An .xlsx is unzipped by the spreadsheet library itself, which sets no limit; this is checked first.
describe("unzippedSize", () => {
  it("adds up every entry's bytes, deflated or stored", async () => {
    expect(await unzippedSize(zip({ "xl/workbook.xml": "x".repeat(1_000), "xl/styles.xml": "y".repeat(500) }), 1_000_000)).toBe(1_500);
    expect(await unzippedSize(zip({ "a.xml": "abc" }, { stored: true }), 1_000_000)).toBe(3);
  });

  it("refuses an archive whose entries say they are larger than the limit, without inflating them", async () => {
    const declared = zip({ "xl/worksheets/sheet1.xml": "x" }, { declared: 3_000_000_000 });
    await expect(unzippedSize(declared, 50_000_000)).rejects.toBeInstanceOf(ZipTooLargeError);
  });

  it("refuses an archive that inflates past the limit whatever its entries claim", async () => {
    const lying = zip({ "xl/sharedStrings.xml": "a".repeat(2_000_000) }, { declared: 10 });
    await expect(unzippedSize(lying, 1_000_000)).rejects.toBeInstanceOf(ZipTooLargeError);
  });

  it("counts the limit across all entries, not each alone", async () => {
    const many = zip(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`xl/worksheets/sheet${i}.xml`, "z".repeat(200_000)])));
    await expect(unzippedSize(many, 1_000_000)).rejects.toBeInstanceOf(ZipTooLargeError);
    expect(await unzippedSize(many, 2_000_000)).toBe(2_000_000);
  });

  it("is a ZipError for something that isn't a zip", async () => {
    await expect(unzippedSize(new TextEncoder().encode("plain text"), 1_000)).rejects.toBeInstanceOf(ZipError);
  });
});
