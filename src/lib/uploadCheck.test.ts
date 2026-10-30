import { describe, expect, it } from "vitest";
import { fileSha256, inspectUpload, sniffUpload } from "./uploadCheck";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];

describe("sniffUpload", () => {
  it("accepts files whose contents match their name, typed by their contents", () => {
    expect(sniffUpload(bytes("%PDF-1.7"), "SBC.PDF")).toEqual({ ok: true, contentType: "application/pdf" });
    expect(sniffUpload(bytes(ZIP, "xl/"), "census.xlsx")).toEqual({ ok: true, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    expect(sniffUpload(bytes(ZIP, "word/"), "summary.docx")).toMatchObject({ ok: true });
    expect(sniffUpload(bytes(OLE), "old.xls")).toEqual({ ok: true, contentType: "application/vnd.ms-excel" });
    expect(sniffUpload(bytes(OLE), "memo.doc")).toMatchObject({ ok: true });
    expect(sniffUpload(bytes("First,Last\nAnn,Lee"), "roster.csv")).toEqual({ ok: true, contentType: "text/csv" });
  });

  it("accepts a password-protected .xlsx and a tab-separated .xls export, which the server reads or explains", () => {
    expect(sniffUpload(bytes(OLE), "locked.xlsx")).toMatchObject({ ok: true });
    expect(sniffUpload(bytes("Name\tState\nAnn\tCA"), "export.xls")).toMatchObject({ ok: true });
  });

  it("refuses a file renamed to look like another kind", () => {
    expect(sniffUpload(bytes(PNG), "scan.pdf")).toEqual({ ok: false });
    expect(sniffUpload(bytes("%PDF-1.4"), "census.xlsx")).toEqual({ ok: false });
    expect(sniffUpload(bytes(PNG), "roster.csv")).toEqual({ ok: false });
    expect(sniffUpload(bytes("MZ", [0x90, 0]), "invoice.doc")).toEqual({ ok: false });
    expect(sniffUpload(bytes("%PDF-1.4"), "setup.exe")).toEqual({ ok: false });
  });
});

describe("inspectUpload", () => {
  it("returns the stored type and the file's SHA-256", async () => {
    const result = await inspectUpload(new File(["abc"], "a.csv"));
    expect(result).toEqual({ ok: true, contentType: "text/csv", sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" });
  });

  it("refuses empty files and mismatched contents", async () => {
    expect(await inspectUpload(new File([], "empty.pdf"))).toEqual({ ok: false, reason: "empty" });
    expect(await inspectUpload(new File([new Uint8Array(PNG)], "photo.pdf"))).toEqual({ ok: false, reason: "mismatch" });
  });

  it("hashes the same bytes the same way whatever the file is called", async () => {
    expect(await fileSha256(new File(["x,y"], "a.csv"))).toBe(await fileSha256(new File(["x,y"], "b.csv")));
  });
});
