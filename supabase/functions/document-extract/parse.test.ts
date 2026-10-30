import { describe, expect, it } from "vitest";
import { factsFromMask } from "../_shared/census";
import {
  buildPromptText,
  censusCandidates,
  censusNotes,
  docxContent,
  findCensus,
  isPasswordError,
  mapCensusColumns,
  MAX_EMPLOYEES,
  mergeCandidates,
  paragraphSections,
  readGrids,
  sha256Hex,
  shapeAiCandidates,
  sheetText,
  sniffFormat,
  US_STATE_CODES,
} from "./parse";

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

const NOW = new Date("2026-10-29T12:00:00Z");

describe("mapCensusColumns", () => {
  const keys = (header: string[]) => {
    const { columns } = mapCensusColumns(header);
    return Object.fromEntries(Object.entries(columns).map(([k, i]) => [k, header[i!]]));
  };

  it("matches the headers payroll exports and carrier templates use", () => {
    expect(keys(["Employee First Name", "Employee Last Name", "Date of Birth", "Work Location State", "Zip", "Position", "Annual Base Salary", "Pay Type", "FT/PT", "W2/1099", "Medical Tier", "WC Class Code"])).toEqual({
      first_name: "Employee First Name",
      last_name: "Employee Last Name",
      dob: "Date of Birth",
      work_state: "Work Location State",
      zip_code: "Zip",
      job_title: "Position",
      annual_salary: "Annual Base Salary",
      compensation_type: "Pay Type",
      employment_type: "FT/PT",
      classification: "W2/1099",
      coverage_tier: "Medical Tier",
      class_code: "WC Class Code",
    });
  });

  it("tolerates typos, extra words and odd punctuation", () => {
    expect(keys(["Frist Name", "Last_Name", "Birthdate (MM/DD/YYYY)", "State:", "Job Titel", "Current Salary $"])).toEqual({
      first_name: "Frist Name",
      last_name: "Last_Name",
      dob: "Birthdate (MM/DD/YYYY)",
      work_state: "State:",
      job_title: "Job Titel",
      annual_salary: "Current Salary $",
    });
  });

  it("prefers the work state over the home state, and uses the home state when it's all there is", () => {
    expect(keys(["Name", "Home State", "Work State"])).toMatchObject({ work_state: "Work State", home_state: "Home State" });
    expect(keys(["Name", "Home State"])).toMatchObject({ home_state: "Home State" });
  });

  it("never maps an ID number column as the name", () => {
    expect(keys(["Employee #", "Employee Name", "State"])).toMatchObject({ full_name: "Employee Name" });
  });

  it("sets aside SSN and bank columns without reading them", () => {
    const { columns, sensitive } = mapCensusColumns(["Name", "SSN", "Bank Account Number", "Routing #", "State"]);
    expect(sensitive).toEqual([1, 2, 3]);
    expect(Object.values(columns)).not.toContain(1);
  });
});

describe("findCensus", () => {
  it("maps a census sheet into canonical rows and says where it was found", () => {
    const rows = [
      ["Acme roster"],
      ["First Name", "Last Name", "DOB", "Work State", "Job Title", "Annual Salary", "Type"],
      ["Ann", "Lee", "1/1/1990", "ca", "Dev", "$105,000", "W-2"],
      ["", "", "", "", "", "", ""],
      ["Bo", "Ray", "1985-05-05", "Texas", "Writer", "72000", "1099"],
    ];
    const census = findCensus(rows, "Sheet Roster", 1, NOW)!;
    expect(census.location).toBe("Sheet Roster, rows 3–5");
    expect(census.census).toEqual([
      { id: expect.any(String), first_name: "Ann", last_name: "Lee", dob: "1990-01-01", work_state: "CA", job_title: "Dev", annual_salary: 105000, compensation_type: "salary", employment_type: "full_time", classification: "w2" },
      { id: expect.any(String), first_name: "Bo", last_name: "Ray", dob: "1985-05-05", work_state: "TX", job_title: "Writer", annual_salary: 72000, compensation_type: "salary", employment_type: "full_time", classification: "1099" },
    ]);
    expect(census.skipped).toBe(0);
    const candidates = censusCandidates(census);
    // Each person's row records the facts it stated: both here stated all five columns.
    expect(Object.values(census.stated).map((m) => factsFromMask(m))).toEqual([
      ["dob", "work_state", "job_title", "annual_salary", "classification"],
      ["dob", "work_state", "job_title", "annual_salary", "classification"],
    ]);
    expect(candidates[0].stated).toEqual(census.stated);
    expect(candidates.map((c) => [c.field, c.field === "census" ? "…" : c.value])).toEqual([
      ["census", "…"],
      ["employee_count", 1],
      ["states", ["CA", "TX"]],
      ["has_1099", true],
    ]);
    expect(candidates.every((c) => c.location === "Sheet Roster, rows 3–5")).toBe(true);
  });

  it("reads every census column the spec names", () => {
    const census = findCensus(
      [
        ["Employee Name", "Age", "State", "Zip Code", "Title", "Hourly Rate", "Hours per Week", "Employee Type", "Coverage", "Class Code"],
        ["Lee, Ann", "34", "NJ", "7030", "Cashier", "$18.50", "24", "Part-time", "Waive", "8017"],
        ["Bo Ray", "51", "NJ", "07030-1234", "Manager", "$40", "40", "Full-time", "Family", "8810"],
      ],
      "CSV",
      1,
      NOW,
    )!;
    expect(census.census).toEqual([
      { id: expect.any(String), first_name: "Ann", last_name: "Lee", age: 34, work_state: "NJ", zip_code: "07030", job_title: "Cashier", annual_salary: 23088, compensation_type: "hourly", employment_type: "part_time", classification: "w2", coverage_tier: "WAIVE", class_code: "8017" },
      { id: expect.any(String), first_name: "Bo", last_name: "Ray", age: 51, work_state: "NJ", zip_code: "07030-1234", job_title: "Manager", annual_salary: 83200, compensation_type: "hourly", employment_type: "full_time", classification: "w2", coverage_tier: "FAM", class_code: "8810" },
    ]);
  });

  it("does not count a blank Employee Type cell as saying W-2", () => {
    // The Employee Type column exists, but only Bo's cell is filled in.
    const census = findCensus([["Name", "State", "Employee Type"], ["Ann Lee", "CA", ""], ["Bo Ray", "TX", "1099"]], "CSV", 1, NOW)!;
    const [ann, bo] = census.census;
    expect(ann.classification).toBe("w2");
    expect(factsFromMask(census.stated[ann.id])).toEqual(["work_state"]);
    expect(factsFromMask(census.stated[bo.id])).toEqual(["work_state", "classification"]);
  });

  it("counts full or part time read from an Employee Type column", () => {
    const census = findCensus([["First Name", "State", "Employee Type"], ["Jane", "CA", "PT"]], "CSV", 1, NOW)!;
    const [jane] = census.census;
    expect(jane.employment_type).toBe("part_time");
    expect(factsFromMask(census.stated[jane.id])).toEqual(["work_state", "employment_type", "classification"]);
  });

  it("treats a 'pay rate' in the tens of thousands as a salary", () => {
    const [row] = findCensus([["Name", "State", "Pay Rate"], ["Ann Lee", "CA", "85,000"]], "CSV", 1, NOW)!.census;
    expect(row).toMatchObject({ annual_salary: 85000, compensation_type: "salary" });
  });

  it("flags 1099 contractors in California", () => {
    const census = findCensus([["Name", "State", "Type"], ["Ann Lee", "CA", "1099"], ["Bo Ray", "TX", "W2"]], "CSV", 1, NOW)!;
    expect(censusCandidates(census).find((c) => c.field === "ca_contractors")?.value).toBe(true);
  });

  it("skips totals, notes and workers it can't classify, and says so", () => {
    const census = findCensus(
      [
        ["Name", "State", "Salary", "Worker Type"],
        ["Ann Lee", "CA", "90000", "W-2"],
        ["Kay Owner", "CA", "0", "K-1"],
        ["Total", "", "90000", ""],
        ["", "Prepared by HR", "", ""],
      ],
      "CSV",
      1,
      NOW,
    )!;
    expect(census.census.map((e) => e.first_name)).toEqual(["Ann"]);
    expect(census.skipped).toBe(3);
    expect(censusNotes(census)).toEqual(["3 rows were left out: no name, a total line, or a worker type that isn't W-2 or 1099."]);
  });

  it("never keeps an SSN or bank column, and tells the prospect it wasn't read", () => {
    const census = findCensus(
      [["Name", "SSN", "DOB", "State", "Direct Deposit Account"], ["Ann Lee", "123-45-6789", "1990-01-01", "CA", "000123456"]],
      "CSV",
      1,
      NOW,
    )!;
    expect(JSON.stringify(census.census)).not.toMatch(/6789|123456/);
    expect(census.ignoredColumns).toEqual(["SSN", "Direct Deposit Account"]);
    expect(censusNotes(census)[0]).toMatch(/^The SSN, Direct Deposit Account columns weren't read/);
  });

  it("splits a single name column", () => {
    const census = findCensus([["Employee Name", "State", "Title"], ["Lee, Ann", "CA", "Dev"], ["Bo Ray", "TX", "Writer"]], "CSV", 1, NOW)!;
    expect(census.census.map((e) => [e.first_name, e.last_name])).toEqual([["Ann", "Lee"], ["Bo", "Ray"]]);
  });

  it("gives the same rows the same ids when read again", () => {
    const rows = [["Name", "State", "Title"], ["Ann Lee", "CA", "Dev"]];
    expect(findCensus(rows, "CSV", 1, NOW)!.census[0].id).toBe(findCensus(rows, "CSV", 1, NOW)!.census[0].id);
  });

  it("reads state names, and blanks a state that isn't a listed US code, keeping the person", () => {
    const rows = [["Name", "State", "Title"], ["Ann Lee", "California", "Dev"], ["Bo Ray", "zz", "Writer"], ["Cy Fox", " pr ", "Ops"], ["Di Kim", "AE", "Ops"]];
    const census = findCensus(rows, "CSV", 1, NOW)!;
    expect(census.census.map((e) => e.work_state)).toEqual(["CA", "", "PR", ""]);
    expect(censusCandidates(census).find((c) => c.field === "states")?.value).toEqual(["CA", "PR"]);
  });

  it("omits states when no row has a listed code", () => {
    const census = findCensus([["Name", "State", "Title"], ["Ann Lee", "Narnia", "Dev"]], "CSV", 1, NOW)!;
    expect(censusCandidates(census).map((c) => c.field)).toEqual(["census", "employee_count"]);
  });

  it("keeps the first MAX_EMPLOYEES people of a large roster and says so", () => {
    const total = MAX_EMPLOYEES + 2500;
    const rows: string[][] = [["Name", "State", "Title", "Type"]];
    for (let i = 0; i < total; i++) rows.push([`Person ${i}`, "CA", "Dev", i % 10 === 0 ? "1099" : "W-2"]);
    const census = findCensus(rows, "CSV", 1, NOW)!;
    expect(census.census).toHaveLength(total);
    const [roster, headcount] = censusCandidates(census);
    expect(roster.value as unknown[]).toHaveLength(MAX_EMPLOYEES);
    // Only the kept people carry their stated facts.
    expect(Object.keys(roster.stated!)).toHaveLength(MAX_EMPLOYEES);
    expect(roster.stated![(roster.value as { id: string }[])[0].id]).toBeDefined();
    // "Person i" splits into last_name "i", so the index shows which end of the roster was kept
    const kept = roster.value as { last_name: string }[];
    expect(kept[0].last_name).toBe("0");
    expect(kept[MAX_EMPLOYEES - 1].last_name).toBe(String(MAX_EMPLOYEES - 1));
    expect(roster.location).toBe(`CSV, rows 2–${total + 1}; first 5,000 of 7,500 people kept`);
    // the headcount is still the whole company's, not the truncated roster's
    expect(headcount).toMatchObject({ field: "employee_count", value: total - total / 10, location: `CSV, rows 2–${total + 1}` });
  });

  it("does not touch a roster at the limit", () => {
    const rows: string[][] = [["Name", "State", "Title"]];
    for (let i = 0; i < MAX_EMPLOYEES; i++) rows.push([`Person ${i}`, "TX", "Dev"]);
    const [roster] = censusCandidates(findCensus(rows, "CSV", 1, NOW)!);
    expect(roster.value as unknown[]).toHaveLength(MAX_EMPLOYEES);
    expect(roster.location).toBe(`CSV, rows 2–${MAX_EMPLOYEES + 1}`);
  });

  it("leaves pay above what the intake holds blank instead of capping it", () => {
    const [row] = findCensus([["Name", "State", "Salary"], ["Ann Lee", "CA", "2,500,000"]], "CSV", 1, NOW)!.census;
    expect(row).not.toHaveProperty("annual_salary");
  });

  it("lists the 50 states, DC and the five territories", () => {
    expect(US_STATE_CODES.size).toBe(56);
  });

  it("ignores sheets that aren't a census", () => {
    expect(findCensus([["Month", "Gross wages", "Taxes"], ["Jan", "100", "10"]], "Sheet1", 1, NOW)).toBeNull();
    expect(findCensus([["Name", "Notes"], ["Ann", "x"]], "Sheet1", 1, NOW)).toBeNull();
    expect(findCensus([["Employee #", "State", "Title"], ["1001", "CA", "Dev"]], "Sheet1", 1, NOW)).toBeNull();
  });
});

describe("readGrids", () => {
  it("reads the census column by column and leaves the other tables for the model, without sensitive columns", () => {
    const reading = readGrids(
      [
        { label: "Sheet Summary", rows: [["Carrier", "Aetna"], ["Renewal", "7/1/2026"]] },
        { label: "Sheet Roster", rows: [["Name", "DOB", "State"], ["Ann Lee", "1990-01-01", "CA"]], firstRow: 1 },
        { label: "Sheet Bank", rows: [["Payee", "Routing Number", "Account"], ["Ann Lee", "021000021", "12345678"]] },
      ],
      NOW,
    );
    expect(reading.candidates.map((c) => c.field)).toEqual(["census", "employee_count", "states"]);
    expect(reading.textSections).toEqual([
      { label: "Sheet Summary", text: "Carrier,Aetna\nRenewal,7/1/2026" },
      { label: "Sheet Bank", text: "Payee,,\nAnn Lee,," },
    ]);
  });

  it("keeps the census's facts over the model's reading of the same field", () => {
    const merged = mergeCandidates(
      [{ field: "employee_count", value: 12, location: "CSV" }],
      [{ field: "employee_count", value: 40, location: "Page 1" }, { field: "current_carrier", value: "Aetna", location: "Page 1" }],
    );
    expect(merged.map((c) => [c.field, c.value])).toEqual([["employee_count", 12], ["current_carrier", "Aetna"]]);
  });
});

describe("sheetText", () => {
  it("redacts sensitive numbers in any cell", () => {
    expect(sheetText([["Note"], ["Owner SSN 123-45-6789"]])).toBe("Note\nOwner SSN [redacted]");
  });
});

describe("Word documents", () => {
  const xml = `<?xml version="1.0"?><w:document><w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Benefits Summary</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:t xml:space="preserve">Carrier: </w:t></w:r><w:r><w:t>Aetna &amp; Co</w:t></w:r><w:r><w:tab/><w:t>Renewal 7/1</w:t></w:r></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>State</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>Ann Lee</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>CA</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:r><w:t>Waiting period: 30 days</w:t></w:r><w:r><w:br/><w:t>Line two &#8211; done</w:t></w:r></w:p>
  </w:body></w:document>`;

  it("reads paragraphs and tables separately", () => {
    expect(docxContent(xml)).toEqual({
      paragraphs: ["Benefits Summary", "Carrier: Aetna & Co\tRenewal 7/1", "Waiting period: 30 days\nLine two – done"],
      tables: [[["Name", "State"], ["Ann Lee", "CA"]]],
    });
  });

  it("groups paragraphs into labelled sections", () => {
    expect(paragraphSections(["a", "b"])).toEqual([{ label: "Paragraphs 1–2", text: "a\nb" }]);
    const long = paragraphSections(["x".repeat(1500), "y".repeat(1500), "z"]);
    expect(long.map((s) => s.label)).toEqual(["Paragraph 1", "Paragraphs 2–3"]);
  });
});

describe("sha256Hex", () => {
  it("hashes the file's bytes", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
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

  it("never sends or keeps a sensitive number", () => {
    expect(buildPromptText([{ label: "Page 1", text: "Group 12345, owner SSN 123-45-6789" }])).toBe("[[Section 1]]\nGroup 12345, owner SSN [redacted]\n\n");
    expect(shapeAiCandidates([{ field: "rate_history", value: "acct 0012345 up 9%", section: 1 }], sections)).toEqual([
      { field: "rate_history", value: "acct [redacted] up 9%", location: "Page 1" },
    ]);
  });

  it("numbers sections and caps the prompt text", () => {
    expect(buildPromptText(sections)).toBe("[[Section 1]]\nCarrier: Aetna\n\n[[Section 2]]\nPaid bi-weekly via ADP\n\n");
    expect(buildPromptText([{ label: "Page 1", text: "x".repeat(50_000) }]).length).toBe(20_000);
  });
});
