import { describe, expect, it } from "vitest";
import { cleanFileName, downloadName, looksExecutable, sniffUpload, storageKeyName } from "./fileSignature";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

// The start of a real Windows program: "MZ", the DOS header (zeros), and the "PE\0\0" signature it points to.
const PE = bytes("MZ", [0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0], new Array(46).fill(0), [0x40, 0, 0, 0], "PE", [0, 0]);
const ELF = bytes([0x7f], "ELF", [2, 1, 1, 0]);
const MACH_O = bytes([0xcf, 0xfa, 0xed, 0xfe, 7, 0, 0, 1]);

describe("sniffUpload: the server's check of what a file is", () => {
  it("refuses a program renamed to a document's name, as a program", () => {
    for (const name of ["invoice.pdf", "census.xlsx", "roster.csv", "plan.doc", "payroll.xls", "summary.docx"]) {
      expect(sniffUpload(PE, name), name).toEqual({ ok: false, reason: "executable" });
    }
    expect(sniffUpload(ELF, "census.csv")).toEqual({ ok: false, reason: "executable" });
    expect(sniffUpload(MACH_O, "census.pdf")).toEqual({ ok: false, reason: "executable" });
    expect(sniffUpload(bytes("#!/bin/sh\ncurl x | sh\n"), "census.csv")).toEqual({ ok: false, reason: "executable" });
  });

  it("takes a CSV that merely starts with the letters MZ", () => {
    expect(looksExecutable(bytes("MZ Holdings,CA,12\n"))).toBe(false);
    expect(sniffUpload(bytes("MZ Holdings,CA,12\n"), "roster.csv")).toEqual({ ok: true, contentType: "text/csv" });
  });

  it("refuses a name the intake doesn't take, whatever the contents", () => {
    expect(sniffUpload(bytes("%PDF-1.7"), "setup.exe")).toEqual({ ok: false, reason: "unsupported" });
    expect(sniffUpload(bytes("%PDF-1.7"), "no-extension")).toEqual({ ok: false, reason: "unsupported" });
    expect(sniffUpload(bytes("<svg onload=alert(1)>"), "x.svg")).toEqual({ ok: false, reason: "unsupported" });
  });

  it("takes a document whose contents match its name, by its last extension", () => {
    expect(sniffUpload(bytes("%PDF-1.7"), "statement.final.PDF")).toEqual({ ok: true, contentType: "application/pdf" });
    expect(sniffUpload(bytes("%PDF-1.7"), "statement.pdf.exe")).toEqual({ ok: false, reason: "unsupported" });
  });
});

describe("cleanFileName", () => {
  it("keeps an ordinary name as it is", () => {
    expect(cleanFileName("Employee Census (Q3).xlsx")).toBe("Employee Census (Q3).xlsx");
  });

  it("drops a path the client sent with the name", () => {
    expect(cleanFileName("C:\\Users\\pat\\census.csv")).toBe("census.csv");
    expect(cleanFileName("../../etc/passwd.csv")).toBe("passwd.csv");
  });

  it("drops the direction overrides that disguise a program's extension, and control characters", () => {
    // "invoice_\u202Efdp.exe" displays as "invoice_exe.pdf".
    expect(cleanFileName("invoice_\u202Efdp.exe")).toBe("invoice_fdp.exe");
    expect(cleanFileName("a\u0000b\r\nc.pdf")).toBe("abc.pdf");
  });

  it("is never empty, and never longer than 200 characters, keeping the extension", () => {
    expect(cleanFileName("")).toBe("document");
    expect(cleanFileName("..")).toBe("document");
    const long = cleanFileName(`${"a".repeat(300)}.xlsx`);
    expect(long).toHaveLength(200);
    expect(long.endsWith(".xlsx")).toBe(true);
  });
});

describe("downloadName and storageKeyName", () => {
  it("leaves nothing that could break a Content-Disposition header", () => {
    expect(downloadName('pay"roll 2026.pdf')).toBe("payroll 2026.pdf");
    // A backslash ends a path, so only what follows it is kept.
    expect(downloadName("pay\\roll.pdf")).toBe("roll.pdf");
    expect(downloadName("x\r\nSet-Cookie: a=b.pdf")).toBe("xSet-Cookie: a=b.pdf");
    expect(downloadName('"')).toBe("document");
  });

  it("makes one safe storage key segment", () => {
    expect(storageKeyName("Employee Census (Q3).xlsx")).toBe("Employee_Census_Q3_.xlsx");
  });
});
