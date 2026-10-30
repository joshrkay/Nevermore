import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readZipEntry, ZipError } from "./zip";

// A zip with the given entries, deflated unless `stored`. CRCs are left at zero: the reader doesn't check them.
function zip(files: Record<string, string>, opts: { stored?: boolean } = {}): Uint8Array {
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
      ...u32(data.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
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

  it("refuses something that isn't a zip", async () => {
    await expect(readZipEntry(new TextEncoder().encode("not a zip at all, just text"), "word/document.xml", 1000)).rejects.toBeInstanceOf(ZipError);
  });
});
