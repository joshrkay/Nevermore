import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { CensusEmployee } from "@/data/census";
import type { PeoCensusLayout } from "@/data/censusExport";
import { censusFile, censusRoundTrip, fillCensusTemplate, readCensusBack, SAMPLE_CENSUS, templateParts, writeCensusXlsx } from "./censusWorkbook";
import { expectCensusRoundTrip } from "@/test/censusRoundTrip";

// No real PEO's template or layout is in the repo, and none is guessed: these are made up for the tests.
const COLUMNS: PeoCensusLayout["columns"] = [
  { header: "Employee Last Name", from: "last_name" },
  { header: "Employee First Name", from: "first_name" },
  { header: "Hire Date", from: null },
  { header: "Annual Salary", from: "annual_salary" },
  { header: "Work State", from: "work_state" },
];
const CSV_LAYOUT: PeoCensusLayout = { peo: "Sample PEO", format: "csv", template: null, columns: COLUMNS };
const XLSX_LAYOUT: PeoCensusLayout = { ...CSV_LAYOUT, format: "xlsx" };
const TEMPLATE_LAYOUT: PeoCensusLayout = { ...XLSX_LAYOUT, template: { id: 12, sheet: "Census", headerRow: 3, firstRow: 4 } };

const ada: CensusEmployee = {
  id: "1", first_name: "Ada", last_name: "Lovelace", dob: "1990-01-01", work_state: "CA", annual_salary: 85000,
  compensation_type: "salary", employment_type: "full_time", classification: "w2",
};

/** A PEO's own template, built here: a sheet of notes, and a census sheet with a title, headers on row 3 in its own order, and a column of its own. */
async function sampleTemplate(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("Read me").getCell("A1").value = "Fill in one row per employee.";
  const ws = wb.addWorksheet("Census");
  ws.getCell("A1").value = "Sample PEO census";
  ws.getCell("A1").font = { bold: true, size: 14 };
  // Matched ignoring case and the spaces at either end, as a PEO's form may write them.
  ws.getRow(3).values = ["WORK STATE ", "Employee First Name", "Notes (PEO use)", " employee last name", "Hire Date", "Annual Salary"];
  ws.getColumn(3).width = 40;
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

const load = async (bytes: Uint8Array) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb;
};

describe("writeCensusXlsx: the census as a new workbook in a PEO's layout", () => {
  it("writes the headers in the layout's order, one row per employee, a number as a number and a blank column blank", async () => {
    const wb = await load(await writeCensusXlsx([ada], XLSX_LAYOUT, { title: "Census for Sample PEO, certified version 3" }));
    const ws = wb.getWorksheet("Census")!;
    expect(ws.getRow(1).values).toEqual([undefined, "Employee Last Name", "Employee First Name", "Hire Date", "Annual Salary", "Work State"]);
    expect(ws.getRow(2).values).toEqual([undefined, "Lovelace", "Ada", undefined, 85000, "CA"]);
    // The file says what it is.
    expect(wb.title).toBe("Census for Sample PEO, certified version 3");
  });

  it("writes a value a spreadsheet would run as a formula as text, never as a formula", async () => {
    const wb = await load(await writeCensusXlsx([{ ...ada, first_name: "=HYPERLINK(\"https://x.example\")", last_name: "@SUM(A1)", work_state: "\tCA" }], XLSX_LAYOUT, { title: "t" }));
    const row = wb.getWorksheet("Census")!.getRow(2);
    for (const col of [1, 2, 5]) {
      expect(row.getCell(col).type).toBe(ExcelJS.ValueType.String);
      expect(row.getCell(col).formula).toBeUndefined();
    }
    expect(row.getCell(2).value).toBe("=HYPERLINK(\"https://x.example\")");
  });
});

describe("fillCensusTemplate: the census written into a PEO's own template", () => {
  it("writes each employee under the template's headers, matched by their text, and keeps everything else", async () => {
    const filled = await fillCensusTemplate(await sampleTemplate(), [ada, { ...ada, id: "2", first_name: "Alan", last_name: "Turing", annual_salary: undefined }], TEMPLATE_LAYOUT);
    expect(filled.ok).toBe(true);
    const wb = await load((filled as { bytes: Uint8Array }).bytes);
    const ws = wb.getWorksheet("Census")!;
    expect(ws.getRow(4).values).toEqual([undefined, "CA", "Ada", undefined, "Lovelace", undefined, 85000]);
    expect(ws.getRow(5).values).toEqual([undefined, "CA", "Alan", undefined, "Turing"]);
    // The rest of the workbook as it was: its other sheet, the title and its style, the column the PEO uses, its width.
    expect(wb.getWorksheet("Read me")!.getCell("A1").value).toBe("Fill in one row per employee.");
    expect(ws.getCell("A1").value).toBe("Sample PEO census");
    expect(ws.getCell("A1").font).toMatchObject({ bold: true, size: 14 });
    expect(ws.getRow(3).getCell(3).value).toBe("Notes (PEO use)");
    expect(ws.getRow(3).getCell(1).value).toBe("WORK STATE ");
    expect(ws.getColumn(3).width).toBe(40);
  });

  it("leaves a column the intake can't fill as the template has it", async () => {
    const wb = await load(await sampleTemplate());
    wb.getWorksheet("Census")!.getCell("E4").value = "MM/DD/YYYY";
    const filled = await fillCensusTemplate(new Uint8Array(await wb.xlsx.writeBuffer()), [ada], TEMPLATE_LAYOUT);
    expect((await load((filled as { bytes: Uint8Array }).bytes)).getWorksheet("Census")!.getCell("E4").value).toBe("MM/DD/YYYY");
  });

  it("writes a value a spreadsheet would run as a formula as text", async () => {
    const filled = await fillCensusTemplate(await sampleTemplate(), [{ ...ada, first_name: "+1-555-0100", last_name: "=1+1" }], TEMPLATE_LAYOUT);
    const ws = (await load((filled as { bytes: Uint8Array }).bytes)).getWorksheet("Census")!;
    expect(ws.getRow(4).getCell(4).type).toBe(ExcelJS.ValueType.String);
    expect(ws.getRow(4).getCell(4).value).toBe("=1+1");
    expect(ws.getRow(4).getCell(2).type).toBe(ExcelJS.ValueType.String);
  });

  it("refuses, naming what is missing, when the template's headers don't match the layout: never a half-filled file", async () => {
    const layout = { ...TEMPLATE_LAYOUT, columns: [...COLUMNS, { header: "Date of Birth", from: "dob" as const }, { header: "Zip", from: "zip_code" as const }] };
    expect(await fillCensusTemplate(await sampleTemplate(), [ada], layout)).toEqual({
      ok: false,
      message: "The template's headers don't match the census layout: row 3 of the sheet \"Census\" has no \"Date of Birth\" or \"Zip\".",
    });
    expect(await fillCensusTemplate(await sampleTemplate(), [ada], { ...layout, template: { ...layout.template!, headerRow: 2, firstRow: 3 } })).toMatchObject({ ok: false });
  });

  it("refuses a template without the sheet the layout names", async () => {
    expect(await fillCensusTemplate(await sampleTemplate(), [ada], { ...TEMPLATE_LAYOUT, template: { ...TEMPLATE_LAYOUT.template!, sheet: "Employees" } })).toEqual({
      ok: false,
      message: "The template has no sheet called \"Employees\".",
    });
  });

  it("refuses a file that isn't a workbook, and one with charts, pivot tables or macros that filling it would lose", async () => {
    expect(await fillCensusTemplate(new TextEncoder().encode("not a workbook"), [ada], TEMPLATE_LAYOUT)).toEqual({ ok: false, message: "The template file isn't an Excel workbook we can read." });
    const withChart = storedZip(["[Content_Types].xml", "xl/workbook.xml", "xl/charts/chart1.xml"]);
    expect(templateParts(withChart)).toEqual(["[Content_Types].xml", "xl/workbook.xml", "xl/charts/chart1.xml"]);
    expect(await fillCensusTemplate(withChart, [ada], TEMPLATE_LAYOUT)).toEqual({
      ok: false,
      message: "The template has charts, pivot tables or macros, which filling it would lose. Ask the PEO for a plain copy.",
    });
  });
});

describe("readCensusBack and censusRoundTrip: a file reads back to the rows it was written from", () => {
  it("reads a CSV back to its rows, undoing what kept a value from running as a formula", async () => {
    const { csv } = (await import("@/data/censusExport")).censusExport([{ ...ada, first_name: "=1+1", last_name: "O'Brien, \"Jr\"" }], CSV_LAYOUT);
    expect(await readCensusBack(csv, CSV_LAYOUT)).toEqual([["O'Brien, \"Jr\"", "=1+1", "", "85000", "CA"]]);
  });

  it("finds nothing wrong for CSV, a new xlsx and a template built here", async () => {
    await expectCensusRoundTrip(CSV_LAYOUT);
    await expectCensusRoundTrip(XLSX_LAYOUT);
    await expectCensusRoundTrip(TEMPLATE_LAYOUT, await sampleTemplate());
  });

  it("says plainly when the file doesn't read back to the census", async () => {
    // A layout naming the same header twice in a template can't be filled column by column.
    const twice = { ...TEMPLATE_LAYOUT, columns: [{ header: "Work State", from: "work_state" as const }, { header: "Work State", from: "first_name" as const }] };
    expect(await censusRoundTrip(twice, SAMPLE_CENSUS, await sampleTemplate())).toEqual({ ok: false, message: expect.stringMatching(/^The census doesn't read back from the file as written/) });
    expect(await censusRoundTrip(TEMPLATE_LAYOUT, SAMPLE_CENSUS, null)).toEqual({ ok: false, message: "The census layout fills the PEO's template, so the template file is needed to check it." });
  });

  it("samples rows that test what a file can get wrong, about nobody real", () => {
    const values = SAMPLE_CENSUS.flatMap((e) => [e.first_name, e.last_name, e.job_title ?? ""]);
    expect(values.some((v) => v.startsWith("="))).toBe(true);
    expect(values.some((v) => v.includes(","))).toBe(true);
    expect(values.some((v) => v.includes("\""))).toBe(true);
    expect(SAMPLE_CENSUS.every((e) => e.last_name.startsWith("Sample"))).toBe(true);
  });
});

describe("censusFile: the download, named for what it is", () => {
  it("is a CSV, a new xlsx or the PEO's template filled, named for the File ID, the PEO and the certified version", async () => {
    const about = { fileId: "EAA-2026-0042", version: 3 };
    expect(await censusFile([ada], CSV_LAYOUT, about)).toMatchObject({ ok: true, filename: "EAA-2026-0042-census-sample-peo-v3.csv" });
    expect(await censusFile([ada], XLSX_LAYOUT, about)).toMatchObject({ ok: true, filename: "EAA-2026-0042-census-sample-peo-v3.xlsx" });
    expect(await censusFile([ada], TEMPLATE_LAYOUT, { ...about, template: await sampleTemplate() })).toMatchObject({ ok: true, filename: "EAA-2026-0042-census-sample-peo-v3.xlsx" });
    expect(await censusFile([ada], { ...CSV_LAYOUT, peo: null }, { fileId: "EAA-2026-0042", version: null })).toMatchObject({ ok: true, filename: "EAA-2026-0042-census.csv" });
    expect(await censusFile([ada], TEMPLATE_LAYOUT, { ...about, template: new Uint8Array([1, 2]) })).toEqual({ ok: false, message: "The template file isn't an Excel workbook we can read." });
  });
});

/** A zip holding empty files with these names, stored, as an .xlsx is laid out: enough to read its parts' names. */
function storedZip(names: string[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: number[] = [];
  const central: number[] = [];
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  for (const name of names) {
    const bytes = [...enc.encode(name)];
    const offset = chunks.length;
    chunks.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...u32(0), ...u16(bytes.length), ...u16(0), ...bytes);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...u32(0),
      ...u16(bytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...bytes);
  }
  const cdOffset = chunks.length;
  const end = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(names.length), ...u16(names.length), ...u32(central.length), ...u32(cdOffset), ...u16(0)];
  return new Uint8Array([...chunks, ...central, ...end]);
}
