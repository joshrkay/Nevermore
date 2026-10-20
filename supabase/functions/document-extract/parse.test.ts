import { describe, expect, it } from "vitest";
import { buildPromptText, censusCandidates, findCensus, isPasswordError, shapeAiCandidates, sniffFormat } from "./parse";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const utf16 = (s: string) => [...s].flatMap((c) => [c.charCodeAt(0), 0]);
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

describe("sniffFormat", () => {
  it("identifies files by their contents, not their extension", () => {
    expect(sniffFormat(bytes("%PDF-1.7\n..."), "x.pdf")).toBe("pdf");
    expect(sniffFormat(bytes([0x50, 0x4b, 0x03, 0x04], "....xl/workbook.xml"), "a.xlsx")).toBe("xlsx");
    expect(sniffFormat(bytes([0x50, 0x4b, 0x03, 0x04], "....word/document.xml"), "a.docx")).toBe("docx");
    expect(sniffFormat(bytes("First,Last,State\nAnn,Lee,CA\n"), "census.csv")).toBe("csv");
  });

  it("rejects a file renamed to .pdf", () => {
    expect(sniffFormat(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), "photo.pdf")).toBe("unknown");
    expect(sniffFormat(bytes("just some words"), "notes.pdf")).toBe("unknown");
  });

  it("recognizes a password-protected Office file", () => {
    expect(sniffFormat(bytes(OLE, utf16("EncryptionInfo")), "census.xlsx")).toBe("encrypted_office");
    expect(sniffFormat(bytes(OLE, utf16("EncryptionInfo")), "census.xls")).toBe("encrypted_office");
    expect(sniffFormat(bytes(OLE, utf16("Workbook")), "census.xls")).toBe("xls");
    expect(sniffFormat(bytes(OLE, utf16("WordDocument")), "memo.doc")).toBe("doc");
  });

  it("is a password error for PDF and spreadsheet parsers", () => {
    expect(isPasswordError({ name: "PasswordException", message: "No password given" })).toBe(true);
    expect(isPasswordError(new Error("File is password-protected"))).toBe(true);
    expect(isPasswordError(new Error("Bad header"))).toBe(false);
  });
});

describe("findCensus", () => {
  it("maps a census sheet and says where it was found", () => {
    const rows = [
      ["Acme roster"],
      ["First Name", "Last Name", "DOB", "Work State", "Job Title", "Annual Salary", "Type"],
      ["Ann", "Lee", "1990-01-01", "ca", "Dev", "$105,000", "W-2"],
      ["", "", "", "", "", "", ""],
      ["Bo", "Ray", "1985-05-05", "TX", "Writer", "72000", "1099"],
    ];
    const census = findCensus(rows, "Sheet Roster", 1)!;
    expect(census.location).toBe("Sheet Roster, rows 3–5");
    expect(census.employees).toEqual([
      { first_name: "Ann", last_name: "Lee", dob: "1990-01-01", state: "CA", title: "Dev", salary: 105000, classification: "W-2", dependents: [] },
      { first_name: "Bo", last_name: "Ray", dob: "1985-05-05", state: "TX", title: "Writer", salary: 72000, classification: "1099", dependents: [] },
    ]);
    const candidates = censusCandidates(census);
    expect(candidates.map((c) => [c.field, c.field === "employees" ? "…" : c.value])).toEqual([
      ["employees", "…"],
      ["employee_count", 1],
      ["states", ["CA", "TX"]],
      ["has_1099", true],
    ]);
    expect(candidates.every((c) => c.location === "Sheet Roster, rows 3–5")).toBe(true);
  });

  it("splits a single name column", () => {
    const census = findCensus([["Employee Name", "State", "Title"], ["Lee, Ann", "CA", "Dev"], ["Bo Ray", "TX", "Writer"]], "CSV")!;
    expect(census.employees.map((e) => [e.first_name, e.last_name])).toEqual([["Ann", "Lee"], ["Bo", "Ray"]]);
  });

  it("ignores sheets that aren't a census", () => {
    expect(findCensus([["Month", "Gross wages", "Taxes"], ["Jan", "100", "10"]], "Sheet1")).toBeNull();
    expect(findCensus([["Name", "Notes"], ["Ann", "x"]], "Sheet1")).toBeNull();
  });
});

describe("AI-read fields", () => {
  const sections = [{ label: "Page 1", text: "Carrier: Aetna" }, { label: "Page 2", text: "Paid bi-weekly via ADP" }];

  it("labels each field with the page it came from and drops unknown or empty ones", () => {
    const out = shapeAiCandidates(
      [
        { field: "current_carrier", value: "Aetna", section: 1 },
        { field: "pay_frequency", value: "Bi-weekly", section: 2 },
        { field: "has_401k", value: "yes", section: 2 },
        { field: "has_handbook", value: "maybe", section: 2 },
        { field: "employees", value: "[...]", section: 1 },
        { field: "payroll_vendor", value: " ", section: 2 },
      ],
      sections,
    );
    expect(out).toEqual([
      { field: "current_carrier", value: "Aetna", location: "Page 1" },
      { field: "pay_frequency", value: "Bi-weekly", location: "Page 2" },
      { field: "has_401k", value: true, location: "Page 2" },
    ]);
  });

  it("numbers sections and caps the prompt text", () => {
    expect(buildPromptText(sections)).toBe("[[Section 1]]\nCarrier: Aetna\n\n[[Section 2]]\nPaid bi-weekly via ADP\n\n");
    expect(buildPromptText([{ label: "Page 1", text: "x".repeat(50_000) }]).length).toBe(20_000);
  });
});
