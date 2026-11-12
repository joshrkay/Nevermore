import { describe, expect, it } from "vitest";
import { unzip } from "@/test/zip";
import { storedZip } from "./storedZip";

// A reference CRC-32 worked bit by bit, as the zip format defines it (no table, unlike storedZip's), so the test runs
// on any Node: zlib's crc32 needs Node 22.2 or later.
const crc32 = (data: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of data) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
};

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const endRecord = (b: Uint8Array) => {
  let at = b.length - 22;
  while (view(b).getUint32(at, true) !== 0x06054b50) at--;
  return at;
};

describe("storedZip: a zip any unzip tool opens, its files stored as they are", () => {
  it("holds each file under its name, in order, byte for byte", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10]);
    const zip = storedZip([
      { name: "CONTENTS.txt", data: new TextEncoder().encode("What is in this bundle\n") },
      { name: "documents/Loss runs 2025.pdf", data: pdf },
      { name: "empty.csv", data: new Uint8Array() },
    ]);
    const parts = unzip(zip);
    expect(parts.map((p) => p.name)).toEqual(["CONTENTS.txt", "documents/Loss runs 2025.pdf", "empty.csv"]);
    expect(new TextDecoder().decode(parts[0].data as Uint8Array)).toBe("What is in this bundle\n");
    expect([...(parts[1].data as Uint8Array)]).toEqual([...pdf]);
    expect((parts[2].data as Uint8Array).length).toBe(0);
  });

  it("records each file's CRC-32 and sizes, stored, in the local header and the central directory alike", () => {
    const data = new TextEncoder().encode("Additional questions from Sample PEO");
    const zip = storedZip([{ name: "a.txt", data }]);
    const v = view(zip);
    // Local header: stored (method 0), UTF-8 names (flag bit 11), the CRC and both sizes.
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(6, true)).toBe(0x0800);
    expect(v.getUint16(8, true)).toBe(0);
    expect(v.getUint32(14, true)).toBe(crc32(data));
    expect(v.getUint32(18, true)).toBe(data.length);
    expect(v.getUint32(22, true)).toBe(data.length);
    const central = v.getUint32(endRecord(zip) + 16, true);
    expect(v.getUint32(central, true)).toBe(0x02014b50);
    expect(v.getUint16(central + 8, true)).toBe(0x0800);
    expect(v.getUint32(central + 16, true)).toBe(crc32(data));
    expect(v.getUint32(central + 20, true)).toBe(data.length);
    expect(v.getUint32(central + 24, true)).toBe(data.length);
  });

  it("gets the CRC-32 right for every byte value", () => {
    // The standard check value: CRC-32 of "123456789".
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(view(storedZip([{ name: "a", data: new TextEncoder().encode("123456789") }])).getUint32(14, true)).toBe(0xcbf43926);
    const all = Uint8Array.from({ length: 1024 }, (_, i) => (i * 7) & 0xff);
    const zip = storedZip([{ name: "all.bin", data: all }]);
    expect(view(zip).getUint32(14, true)).toBe(crc32(all));
  });

  it("keeps a name in any language, as UTF-8", () => {
    const zip = storedZip([{ name: "documents/Nómina año 2025.pdf", data: new Uint8Array([1]) }]);
    expect(unzip(zip)[0].name).toBe("documents/Nómina año 2025.pdf");
  });

  it("carries a comment, which unzip tools print above the listing", () => {
    const comment = "Bundle for Sample PEO\nMissing: loss runs";
    const zip = storedZip([{ name: "CONTENTS.txt", data: new Uint8Array([1]) }], comment);
    const end = endRecord(zip);
    const length = view(zip).getUint16(end + 20, true);
    expect(new TextDecoder().decode(zip.subarray(end + 22, end + 22 + length))).toBe(comment);
    expect(end + 22 + length).toBe(zip.length);
    expect(view(zip).getUint16(end + 10, true)).toBe(1);
  });

  it("cuts a comment to what a zip can hold rather than writing a broken file", () => {
    const zip = storedZip([{ name: "a", data: new Uint8Array([1]) }], "x".repeat(70_000));
    const end = endRecord(zip);
    expect(view(zip).getUint16(end + 20, true)).toBe(65_535);
    expect(zip.length).toBe(end + 22 + 65_535);
  });

  it("never cuts a comment inside a character", () => {
    const zip = storedZip([{ name: "a", data: new Uint8Array([1]) }], "é".repeat(40_000));
    const end = endRecord(zip);
    const length = view(zip).getUint16(end + 20, true);
    expect(length).toBe(65_534);
    expect(new TextDecoder("utf-8", { fatal: true }).decode(zip.subarray(end + 22))).toBe("é".repeat(32_767));
  });

  it("dates every file with the time given, in the zip's own format", () => {
    const zip = storedZip([{ name: "a", data: new Uint8Array([1]) }], "", new Date(2026, 10, 11, 14, 30, 20));
    const v = view(zip);
    expect(v.getUint16(10, true)).toBe((14 << 11) | (30 << 5) | 10);
    expect(v.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (11 << 5) | 11);
  });
});
