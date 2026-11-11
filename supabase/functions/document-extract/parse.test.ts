import { describe, expect, it } from "vitest";
import { CENSUS_TEMPLATE_COLUMNS, censusTemplateCsv } from "../_shared/censusTemplate";
import { redactSensitive } from "../_shared/sensitive";
import {
  buildPromptText,
  censusCandidates,
  censusNotes,
  clampSheetRange,
  docxContent,
  findCensus,
  isPasswordError,
  mapCensusColumns,
  MAX_EMPLOYEES,
  MAX_SHEET_COLUMNS,
  MAX_SHEET_ROWS,
  mergeCandidates,
  paragraphSections,
  readGrids,
  sha256Hex,
  shapeAiCandidates,
  sheetCutOff,
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
      { id: expect.any(String), first_name: "Ann", last_name: "Lee", dob: "1990-01-01", work_state: "CA", job_title: "Dev", annual_salary: 105000, compensation_type: "salary", employment_type: "full_time", classification: "w2", assumed: ["employment_type"] },
      { id: expect.any(String), first_name: "Bo", last_name: "Ray", dob: "1985-05-05", work_state: "TX", job_title: "Writer", annual_salary: 72000, compensation_type: "salary", employment_type: "full_time", classification: "1099", assumed: ["employment_type"] },
    ]);
    expect(census.skipped).toBe(0);
    expect(census.facts).toEqual(["dob", "work_state", "job_title", "annual_salary", "classification"]);
    const candidates = censusCandidates(census);
    expect(candidates[0].facts).toEqual(census.facts);
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

// US-2.3d: the CSV the Upload tab offers. A filled-in template must read with every column matched.
describe("the census template", () => {
  // The template holds no quoted cells, so splitting on commas reads it as the spreadsheet reader would.
  const csvRows = (csv: string) => csv.trim().split(/\r?\n/).map((line) => line.split(","));

  it("matches every header to the census column of the same name, with none set aside", () => {
    const { columns, sensitive } = mapCensusColumns([...CENSUS_TEMPLATE_COLUMNS]);
    expect(sensitive).toEqual([]);
    expect(columns).toEqual(Object.fromEntries(CENSUS_TEMPLATE_COLUMNS.map((column, i) => [column, i])));
  });

  it("reads a filled-in template, as typed and as a spreadsheet saves it, with every fact stated and no notes", () => {
    const csv = [
      censusTemplateCsv().trim(),
      "Ann,Lee,1990-01-01,F,2019-04-01,CA,NV,94105,Oakland office,no,yes,Engineer,105000,salary,full_time,w2,EE+SP,no,8810",
      // Saved from a spreadsheet: a US date, the ZIP's leading zero gone.
      "Bo,Ray,3/15/1988,M,6/3/2021,NJ,NJ,7030,Store 12,no,no,Cashier,31200,hourly,part_time,1099,WAIVE,yes,8017",
    ].join("\r\n");
    const reading = readGrids([{ label: "CSV", rows: csvRows(csv) }], NOW);

    expect(reading.notes).toEqual([]);
    // Every row is read column by column, so nothing in the file goes to the model.
    expect(reading.textSections).toEqual([]);
    const census = reading.candidates.find((c) => c.field === "census")!;
    expect(census.location).toBe("CSV, rows 2–3");
    expect(census.facts).toEqual([
      "dob", "work_state", "zip_code", "job_title", "annual_salary", "compensation_type", "employment_type",
      "classification", "coverage_tier", "class_code", "gender", "hire_date", "cobra", "home_state",
      "worksite", "remote", "travels",
    ]);
    expect((census.value as CensusEmployee[]).map((e) => [e.worksite, e.remote, e.travels])).toEqual([["Oakland office", false, true], ["Store 12", false, false]]);
    // No fact is a default (no `assumed`): the template states each one.
    expect(census.value).toEqual([
      { id: expect.any(String), first_name: "Ann", last_name: "Lee", dob: "1990-01-01", work_state: "CA", zip_code: "94105", job_title: "Engineer", annual_salary: 105000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "EE+SP", class_code: "8810", gender: "F", hire_date: "2019-04-01", cobra: false, home_state: "NV", worksite: "Oakland office", remote: false, travels: true },
      { id: expect.any(String), first_name: "Bo", last_name: "Ray", dob: "1988-03-15", work_state: "NJ", zip_code: "07030", job_title: "Cashier", annual_salary: 31200, compensation_type: "hourly", employment_type: "part_time", classification: "1099", coverage_tier: "WAIVE", class_code: "8017", gender: "M", hire_date: "2021-06-03", cobra: true, home_state: "NJ", worksite: "Store 12", remote: false, travels: false },
    ]);
  });

  // K-2.1: the spellings payroll exports and carrier census forms use for the columns PEOs ask for.
  it("reads gender, hire date, COBRA status and home state under their common headers", () => {
    const { columns } = mapCensusColumns(["Employee Name", "Sex", "Date of Hire", "COBRA Participant", "Home State", "Work State", "DOB"]);
    expect(columns).toMatchObject({ full_name: 0, gender: 1, hire_date: 2, cobra: 3, home_state: 4, work_state: 5, dob: 6 });
    for (const header of ["Gender", "Sex", "M/F", "Gender (M/F)"]) expect(mapCensusColumns(["Name", header]).columns.gender, header).toBe(1);
    for (const header of ["Hire Date", "Date of Hire", "DOH", "Original Hire Date", "Hired", "Start Date", "Hired Date", "Most Recent Hire Dt"]) expect(mapCensusColumns(["Name", header]).columns.hire_date, header).toBe(1);
    for (const header of ["COBRA", "Cobra Status", "On COBRA", "COBRA (Y/N)"]) expect(mapCensusColumns(["Name", header]).columns.cobra, header).toBe(1);
    // A date of birth is still a date of birth.
    expect(mapCensusColumns(["Name", "Birth Date", "Hire Date"]).columns).toMatchObject({ dob: 1, hire_date: 2 });
  });

  // K-2.2
  it("reads worksite, remote and travel columns under their common headers, and never takes a worksite for the work state", () => {
    const { columns } = mapCensusColumns(["Name", "Work State", "Worksite", "Remote", "Travels"]);
    expect(columns).toMatchObject({ full_name: 0, work_state: 1, worksite: 2, remote: 3, travels: 4 });
    for (const header of ["Worksite", "Work Site", "Work Location", "Location", "Office", "Job Site"]) expect(mapCensusColumns(["Name", "State", header]).columns.worksite, header).toBe(2);
    for (const header of ["Remote", "Remote Worker", "Works Remotely", "Work From Home", "WFH", "Telecommute"]) expect(mapCensusColumns(["Name", header]).columns.remote, header).toBe(1);
    for (const header of ["Travels", "Travel", "Travels for Work", "Business Travel", "Travel Required"]) expect(mapCensusColumns(["Name", header]).columns.travels, header).toBe(1);
    // "Worksite State" and "Work Location State" still name the state.
    expect(mapCensusColumns(["Name", "Worksite State"]).columns).toMatchObject({ work_state: 1 });
    expect(mapCensusColumns(["Name", "Work Location State"]).columns).toMatchObject({ work_state: 1 });
    expect(mapCensusColumns(["Name", "Site State Code"]).columns).toEqual({ full_name: 0, work_state: 1 });
  });

  it("still takes the work state from a home state column when the sheet has no work state, and keeps the home state too", () => {
    const found = findCensus([["Name", "Home State", "Salary"], ["Ann Lee", "NV", "50000"]], "Sheet1", 1, NOW)!;
    expect(found.census[0]).toMatchObject({ work_state: "NV", home_state: "NV" });
    expect(found.facts).toContain("home_state");
  });

  it("accepts a census that has none of them", () => {
    const found = findCensus([["Name", "State", "Salary"], ["Ann Lee", "CA", "50000"]], "Sheet1", 1, NOW)!;
    expect(found.census[0]).not.toHaveProperty("gender");
    expect(found.facts).toEqual(["work_state", "annual_salary"]);
  });

  it("finds no census in the template before it is filled in", () => {
    expect(findCensus(csvRows(censusTemplateCsv()), "CSV", 1, NOW)).toBeNull();
  });
});

describe("a census longer than the rows read", () => {
  // The row bound (MAX_SHEET_ROWS) keeps a read within memory and CPU, so a longer census is read only in part.
  // The headcount, states and contractor facts would then cover part of the company while reading as the whole.
  const census = (n: number) => {
    const rows: string[][] = [["Name", "State", "Title", "Type"]];
    for (let i = 0; i < n; i++) rows.push([`Person ${i}`, i < 10 ? "NY" : "CA", "Dev", "W-2"]);
    return rows;
  };

  it("keeps the rows that were read but takes no headcount, states or contractor facts from them, and says why", () => {
    const { candidates, notes } = readGrids([{ label: "Sheet Staff", rows: census(MAX_SHEET_ROWS - 1), cutOff: true }], NOW);
    expect(candidates.map((c) => c.field)).toEqual(["census"]);
    expect(candidates[0].location).toContain("the sheet has more rows than were read");
    expect(notes).toContainEqual(expect.stringContaining(`only its first ${MAX_SHEET_ROWS.toLocaleString("en-US")} rows were read`));
  });

  it("reads a census that wasn't cut off as before", () => {
    const { candidates } = readGrids([{ label: "Sheet Staff", rows: census(20), cutOff: false }], NOW);
    expect(candidates.map((c) => c.field)).toEqual(["census", "employee_count", "states"]);
  });

  // Shapes taken from SheetJS itself with sheetRows: MAX_SHEET_ROWS. A 7,500-person .xlsx reads back 5,050 rows
  // and declares A1:D7501 in !fullref; the same CSV reads back 5,050 rows and declares nothing; a 100-person
  // .xlsx whose range formatting inflated to A1:Z1048576 reads back its 101 real rows.
  it("counts a sheet as cut off when the rows read reached the bound, the last holds data and more were declared", () => {
    const full = census(MAX_SHEET_ROWS - 1); // header + data fill every row read
    expect(sheetCutOff(full, 7501)).toBe(true);
    // A CSV declares no range: one that filled every row read is taken as running past them.
    expect(sheetCutOff(full, Number.POSITIVE_INFINITY)).toBe(true);
  });

  it("doesn't count a short census in an inflated range, or one that ends exactly at the bound", () => {
    expect(sheetCutOff(census(100), 1_048_576)).toBe(false);
    const padded = [...census(100), ...Array.from({ length: MAX_SHEET_ROWS - 101 }, () => ["", "", "", ""])];
    expect(sheetCutOff(padded, 1_048_576)).toBe(false);
    expect(sheetCutOff(census(MAX_SHEET_ROWS - 1), MAX_SHEET_ROWS)).toBe(false);
  });
});

describe("clampSheetRange", () => {
  const range = (sr: number, sc: number, er: number, ec: number) => ({ s: { r: sr, c: sc }, e: { r: er, c: ec } });

  it("leaves a sheet of ordinary size as it is", () => {
    expect(clampSheetRange(range(0, 0, 199, 25))).toEqual(range(0, 0, 199, 25));
    expect(clampSheetRange(range(2, 1, MAX_SHEET_ROWS + 1, MAX_SHEET_COLUMNS))).toEqual(range(2, 1, MAX_SHEET_ROWS + 1, MAX_SHEET_COLUMNS));
  });

  it("cuts a declared range (a sheet's <dimension> says what it likes) to the rows and columns read", () => {
    // A1:XFD1048576: a one-cell file declaring every cell Excel has.
    expect(clampSheetRange(range(0, 0, 1_048_575, 16_383))).toEqual(range(0, 0, MAX_SHEET_ROWS - 1, MAX_SHEET_COLUMNS - 1));
    expect(clampSheetRange(range(4, 3, 1_048_575, 9))).toEqual(range(4, 3, 4 + MAX_SHEET_ROWS - 1, 9));
  });

  it("reads every row a full census needs", () => {
    expect(MAX_SHEET_ROWS).toBeGreaterThan(MAX_EMPLOYEES + 1);
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

  it("reads markup that never closes in time in proportion to its length", () => {
    // Each unclosed tag once sent a lazy pattern to the end of the text: 200 KB of "<w:p>" took over a second.
    const n = 200_000;
    const unclosed = [
      "<w:p>".repeat(n),
      "<w:p ".repeat(n),
      `<w:p>${"<w:t>".repeat(n)}</w:p>`,
      `<w:p>${"<w:t ".repeat(n)}</w:p>`,
      `<w:p>${"<w:br ".repeat(n)}</w:p>`,
      `<w:p>${"<w:br ".repeat(n)}<w:t>x</w:t></w:p>`,
      "<w:tbl>".repeat(n),
      `<w:tbl>${"<w:tr>".repeat(n)}</w:tbl>`,
      `<w:tbl><w:tr>${"<w:tc>".repeat(n)}</w:tr></w:tbl>`,
    ];
    for (const markup of unclosed) {
      const started = performance.now();
      docxContent(markup);
      expect(performance.now() - started, markup.slice(0, 20)).toBeLessThan(500);
    }
  });

  it("reads the same text as before from ordinary markup", () => {
    expect(docxContent("<w:p><w:pPr/><w:r><w:t>a</w:t></w:r></w:p><w:p w:rsidR=\"1\"/><w:p><w:r><w:t>b</w:t><w:cr/><w:t>c</w:t></w:r></w:p>"))
      .toEqual({ paragraphs: ["a", "b\nc"], tables: [] });
    // A paragraph's properties (<w:pPr>) are not a paragraph.
    expect(docxContent("<w:pPr><w:t>x</w:t></w:pPr>")).toEqual({ paragraphs: [], tables: [] });
    // A table's text is the table's, and the paragraph after it is a paragraph.
    expect(docxContent("<w:tbl><w:tr><w:tc><w:p><w:r><w:t>only</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>after</w:t></w:r></w:p>"))
      .toEqual({ paragraphs: ["after"], tables: [[["only"]]] });
  });

  it("keeps a character reference that names no character instead of failing the document", () => {
    expect(docxContent("<w:p><w:r><w:t>a&#x110000;b&#9999999999;c</w:t></w:r></w:p>").paragraphs).toEqual(["a&#x110000;b&#9999999999;c"]);
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

  // K-1.1: a document can state who the employer is; the FEIN is typed into the workspace, never read from a file.
  it("reads the employer's entity type, year founded, address and website from a document, and never its FEIN", () => {
    expect(shapeAiCandidates(
      [
        { field: "entity_type", value: "LLC", section: 1 },
        { field: "year_founded", value: "2014", section: 1 },
        { field: "street_address", value: "500 Harbor Street, San Francisco, CA 94107", section: 1 },
        { field: "website", value: "meridiancreative.example", section: 2 },
        { field: "fein", value: "84-1234567", section: 1 },
        { field: "entities", value: "Meridian Creative LLC", section: 1 },
      ],
      sections,
    )).toEqual([
      { field: "entity_type", value: "LLC", location: "Page 1" },
      { field: "year_founded", value: "2014", location: "Page 1" },
      { field: "street_address", value: "500 Harbor Street, San Francisco, CA 94107", location: "Page 1" },
      { field: "website", value: "meridiancreative.example", location: "Page 2" },
    ]);
  });

  it("reads a NAICS code and a description of operations a document states (K-1.2)", () => {
    expect(shapeAiCandidates([{ field: "naics_code", value: "541430", section: 1 }, { field: "operations_description", value: "Brand and packaging design", section: 2 }], sections)).toEqual([
      { field: "naics_code", value: "541430", location: "Page 1" },
      { field: "operations_description", value: "Brand and packaging design", location: "Page 2" },
    ]);
  });

  it("reads whether the employer is in a PEO, which one and when it renews (K-1.3)", () => {
    expect(shapeAiCandidates([{ field: "in_peo", value: "yes", section: 1 }, { field: "current_peo", value: "Summit PEO", section: 1 }, { field: "peo_renewal_date", value: "January 2027", section: 2 }], sections)).toEqual([
      { field: "in_peo", value: true, location: "Page 1" },
      { field: "current_peo", value: "Summit PEO", location: "Page 1" },
      { field: "peo_renewal_date", value: "January 2027", location: "Page 2" },
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

  it("redacts only what can reach the prompt, so a huge section costs no more than a full prompt", () => {
    let redacted = 0;
    const counting = (text: string) => {
      redacted += text.length;
      return text;
    };
    buildPromptText([{ label: "Page 1", text: "x".repeat(5_000_000) }], counting);
    expect(redacted).toBeGreaterThan(0);
    expect(redacted).toBeLessThan(50_000);

    redacted = 0;
    const text = sheetText(Array.from({ length: 5_000 }, (_, i) => [`row ${i}`, "y".repeat(2_000)]), counting);
    expect(text.length).toBeLessThanOrEqual(20_000);
    expect(redacted).toBeGreaterThan(0);
    expect(redacted).toBeLessThan(50_000);
  });

  it("never lets part of a number cut at the edge of what is redacted through", () => {
    // Shrinking earlier numbers to [redacted] pulls later text forward; a number cut in two where the
    // redacted window ends must not be pulled into the prompt unredacted.
    const cards = "card 4111 1111 1111 1111 ".repeat(400); // each 19-character card becomes 10 characters
    // An unlabelled 16-digit account number, redacted whole but not once cut below nine digits, placed at
    // every position around where a window of the prompt's size (plus any small margin) would end.
    for (let at = 19_900; at <= 20_150; at++) {
      const text = cards + "x".repeat(at - cards.length) + " 1234567890123456 " + "y".repeat(40_000);
      expect(buildPromptText([{ label: "Page 1", text }]), `number at ${at}`).not.toMatch(/\d{4}/);
    }
  });

  it("matches the whole text's redaction exactly when the text fits", () => {
    const text = "Owner SSN 123-45-6789, routing: 021000021. ".repeat(100);
    expect(buildPromptText([{ label: "Page 1", text }])).toBe(`[[Section 1]]\n${redactSensitive(text).trim()}\n\n`);
  });
});
