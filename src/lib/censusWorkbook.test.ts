import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { CensusEmployee } from "@/data/census";
import type { PeoCensusLayout } from "@/data/censusExport";
import { censusFile, censusRoundTrip, checkLayoutRoundTrip, fillTemplateWorkbook, isKeptPart, readCensusBack, SAMPLE_CENSUS, templateParts, templateWorkbookFits, writeCensusXlsx } from "./censusWorkbook";
import { partNames, withParts, zipOf } from "@/test/zip";
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

describe("fillTemplateWorkbook: the census written into a PEO's own template", () => {
  it("writes each employee under the template's headers, matched by their text, and keeps everything else", async () => {
    const filled = await fillTemplateWorkbook(await sampleTemplate(), [ada, { ...ada, id: "2", first_name: "Alan", last_name: "Turing", annual_salary: undefined }], TEMPLATE_LAYOUT);
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

  it("leaves a column the intake can't fill blank, as the template formats it", async () => {
    const wb = await load(await sampleTemplate());
    wb.getWorksheet("Census")!.getCell("E4").numFmt = "mm/dd/yyyy";
    const filled = await fillTemplateWorkbook(new Uint8Array(await wb.xlsx.writeBuffer()), [ada], TEMPLATE_LAYOUT);
    const cell = (await load((filled as { bytes: Uint8Array }).bytes)).getWorksheet("Census")!.getCell("E4");
    expect(cell.value).toBeNull();
    expect(cell.numFmt).toBe("mm/dd/yyyy");
  });

  it("writes a value a spreadsheet would run as a formula as text", async () => {
    const filled = await fillTemplateWorkbook(await sampleTemplate(), [{ ...ada, first_name: "+1-555-0100", last_name: "=1+1" }], TEMPLATE_LAYOUT);
    const ws = (await load((filled as { bytes: Uint8Array }).bytes)).getWorksheet("Census")!;
    expect(ws.getRow(4).getCell(4).type).toBe(ExcelJS.ValueType.String);
    expect(ws.getRow(4).getCell(4).value).toBe("=1+1");
    expect(ws.getRow(4).getCell(2).type).toBe(ExcelJS.ValueType.String);
  });

  it("refuses, naming what is missing, when the template's headers don't match the layout: never a half-filled file", async () => {
    const layout = { ...TEMPLATE_LAYOUT, columns: [...COLUMNS, { header: "Date of Birth", from: "dob" as const }, { header: "Zip", from: "zip_code" as const }] };
    expect(await fillTemplateWorkbook(await sampleTemplate(), [ada], layout)).toEqual({
      ok: false,
      message: "The PEO template workbook's headers don't match the census layout: row 3 of the sheet \"Census\" has no \"Date of Birth\" or \"Zip\".",
    });
    expect(await fillTemplateWorkbook(await sampleTemplate(), [ada], { ...layout, template: { ...layout.template!, headerRow: 2, firstRow: 3 } })).toMatchObject({ ok: false });
  });

  it("refuses a template without the sheet the layout names", async () => {
    expect(await fillTemplateWorkbook(await sampleTemplate(), [ada], { ...TEMPLATE_LAYOUT, template: { ...TEMPLATE_LAYOUT.template!, sheet: "Employees" } })).toEqual({
      ok: false,
      message: "The PEO template workbook has no sheet called \"Employees\".",
    });
  });

  it("refuses a file that isn't a workbook, and one with charts, pivot tables or macros that filling it would lose", async () => {
    expect(await fillTemplateWorkbook(new TextEncoder().encode("not a workbook"), [ada], TEMPLATE_LAYOUT)).toEqual({ ok: false, message: "The file given as the PEO template workbook isn't an Excel workbook we can read." });
    const withChart = zipOf(["[Content_Types].xml", "xl/workbook.xml", "xl/charts/chart1.xml"].map((name) => ({ name, data: "" })));
    expect(templateParts(withChart)).toEqual(["[Content_Types].xml", "xl/workbook.xml", "xl/charts/chart1.xml"]);
    expect(await fillTemplateWorkbook(withChart, [ada], TEMPLATE_LAYOUT)).toEqual({
      ok: false,
      message: "The PEO template workbook holds parts that filling it would lose (xl/charts/chart1.xml): charts, pivot tables, macros, slicers, data connections or the like. Ask the PEO for a plain copy.",
    });
  });
});

/** A template with its headers on row 1, data from row 2, and the PEO's own words below: a signature line in A7. */
async function templateWithFooter(extra: (ws: import("exceljs").Worksheet) => void = () => {}): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Census");
  ws.getRow(1).values = ["Employee Last Name", "Employee First Name", "Hire Date", "Annual Salary", "Work State"];
  ws.getCell("A7").value = "Signature of employer";
  extra(ws);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
const ROW2_LAYOUT: PeoCensusLayout = { ...TEMPLATE_LAYOUT, template: { id: 12, sheet: "Census", headerRow: 1, firstRow: 2 } };
const staff = (n: number): CensusEmployee[] => Array.from({ length: n }, (_, i) => ({ ...ada, id: String(i + 1), last_name: `Person${i + 1}` }));

describe("fillTemplateWorkbook: never writes over what the PEO template workbook already holds", () => {
  it("refuses, writing nothing, when an employee would go where the template has its own words, naming the cell and what is in it", async () => {
    expect(await fillTemplateWorkbook(await templateWithFooter(), staff(6), ROW2_LAYOUT)).toEqual({
      ok: false,
      message: "The PEO template workbook has \"Signature of employer\" in A7, where employee 6 would go. Remove it, or use a template workbook with more room.",
    });
  });

  it("fills a census that fits above the footer, and keeps the footer", async () => {
    const filled = await fillTemplateWorkbook(await templateWithFooter(), staff(5), ROW2_LAYOUT);
    const ws = (await load((filled as { bytes: Uint8Array }).bytes)).getWorksheet("Census")!;
    expect(ws.getCell("A6").value).toBe("Person5");
    expect(ws.getCell("A7").value).toBe("Signature of employer");
  });

  it("looks at every column of those rows, not only the ones the layout fills", async () => {
    const template = await templateWithFooter((ws) => { ws.getCell("H3").value = "Totals"; });
    expect(await fillTemplateWorkbook(template, staff(2), ROW2_LAYOUT)).toEqual({
      ok: false,
      message: "The PEO template workbook has \"Totals\" in H3, where employee 2 would go. Remove it, or use a template workbook with more room.",
    });
  });

  it("refuses example rows under the headers rather than send them as employees", async () => {
    const template = await templateWithFooter((ws) => { ws.getRow(2).values = ["Example", "Jane", "01/01/2020", 50000, "CA"]; });
    expect(await fillTemplateWorkbook(template, staff(1), ROW2_LAYOUT)).toEqual({
      ok: false,
      message: "The PEO template workbook has \"Example\" in A2, where employee 1 would go. Remove it, or use a template workbook with more room.",
    });
  });
});

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const CALC_CHAIN = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="H1" i="1"/></calcChain>';

/** A template with everything exceljs keeps, built here: an image, a comment, a table, a link, a formula, a page setup. */
async function richTemplate(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Census", { pageSetup: { orientation: "landscape" } });
  ws.getRow(3).values = ["Work State", "Employee First Name", "Notes", "Employee Last Name", "Hire Date", "Annual Salary"];
  ws.getCell("A1").value = { text: "Instructions", hyperlink: "https://peo.example/help" };
  ws.getCell("A1").note = "Fill one row per employee";
  ws.getCell("H1").value = { formula: "1+1", result: 2 };
  ws.addTable({ name: "Codes", ref: "J1", headerRow: true, columns: [{ name: "Code" }, { name: "Meaning" }], rows: [["F", "Family"]] });
  ws.addImage(wb.addImage({ buffer: PNG as unknown as ExcelJS.Buffer, extension: "png" }), "L1:M2");
  return withParts(new Uint8Array(await wb.xlsx.writeBuffer()), [
    { name: "xl/calcChain.xml", data: CALC_CHAIN },
    { name: "xl/printerSettings/printerSettings1.bin", data: new Uint8Array([1, 2, 3]) },
  ]);
}

describe("which parts of a PEO template workbook filling keeps", () => {
  it("keeps every part on the list it allows, apart from the calculation chain and printer settings, which go harmlessly", async () => {
    const template = await richTemplate();
    const before = partNames(template);
    expect(before.every(isKeptPart)).toBe(true);
    const filled = await fillTemplateWorkbook(template, [ada], TEMPLATE_LAYOUT);
    expect(filled.ok).toBe(true);
    const after = partNames((filled as { bytes: Uint8Array }).bytes);
    expect(before.filter((p) => !after.includes(p))).toEqual(["xl/calcChain.xml", "xl/printerSettings/printerSettings1.bin"]);
    // Why their going is harmless: a spreadsheet rebuilds the calculation chain from the formulas, which are kept with
    // their results, and the page setup is in the sheet, not the printer's own settings.
    const ws = (await load((filled as { bytes: Uint8Array }).bytes)).getWorksheet("Census")!;
    expect(ws.getCell("H1").value).toEqual({ formula: "1+1", result: 2 });
    expect(ws.pageSetup.orientation).toBe("landscape");
    expect(ws.getCell("A1").note).toBe("Fill one row per employee");
    expect(ws.getImages()).toHaveLength(1);
  });

  it("refuses a template workbook holding parts filling would lose, naming them, and writes nothing", async () => {
    const plain = await sampleTemplate();
    const cases: [string, string][] = [
      ["xl/connections.xml", "<connections/>"],
      ["xl/slicers/slicer1.xml", "<slicers/>"],
      ["customXml/item1.xml", "<a/>"],
    ];
    for (const [name, data] of cases) {
      expect(await fillTemplateWorkbook(withParts(plain, [{ name, data }]), [ada], TEMPLATE_LAYOUT)).toEqual({
        ok: false,
        message: `The PEO template workbook holds parts that filling it would lose (${name}): charts, pivot tables, macros, slicers, data connections or the like. Ask the PEO for a plain copy.`,
      });
    }
    const both = withParts(plain, [{ name: "xl/connections.xml", data: "<c/>" }, { name: "xl/charts/chart1.xml", data: "<c/>" }]);
    expect(await fillTemplateWorkbook(both, [ada], TEMPLATE_LAYOUT)).toMatchObject({ ok: false, message: expect.stringContaining("(xl/connections.xml, xl/charts/chart1.xml)") });
    // A plain one still fills.
    expect(await fillTemplateWorkbook(plain, [ada], TEMPLATE_LAYOUT)).toMatchObject({ ok: true });
  });

  it("refuses a template workbook that says it unpacks to more than 100 MB, before reading any of it", async () => {
    const parts = partNames(await sampleTemplate()).map((name) => ({ name, data: "" }));
    // Nothing large is made: the central directory only says so.
    const bomb = zipOf([...parts.slice(1), { name: parts[0].name, data: "", declaredSize: 101 * 1024 * 1024 }]);
    const refusal = { ok: false, message: "The PEO template workbook unpacks to more than 100 MB, far more than a census form needs. Ask the PEO for a plain copy." };
    expect(await fillTemplateWorkbook(bomb, [ada], TEMPLATE_LAYOUT)).toEqual(refusal);
    expect(await templateWorkbookFits(bomb, [ada], TEMPLATE_LAYOUT)).toEqual(refusal);
    expect(await checkLayoutRoundTrip(TEMPLATE_LAYOUT, bomb)).toEqual(refusal);
    // A part too large for the plain zip format to say its size is taken as too large.
    const huge = zipOf([...parts.slice(1), { name: parts[0].name, data: "", declaredSize: 0xffffffff }]);
    expect(await fillTemplateWorkbook(huge, [ada], TEMPLATE_LAYOUT)).toEqual(refusal);
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

  it("checks a layout with as many sample rows as reach the last thing the PEO template workbook holds, and refuses one with anything below its first row of data", async () => {
    // A7 is the 6th row of data: six sample rows reach it, though only three are held.
    expect(await checkLayoutRoundTrip(ROW2_LAYOUT, await templateWithFooter())).toEqual({
      ok: false,
      message: "The PEO template workbook has \"Signature of employer\" in A7, where employee 6 would go. Remove it, or use a template workbook with more room. A census can be any length, so nothing can sit below the first row of data.",
    });
    // A far-off note is found too.
    const far = await templateWithFooter((ws) => { ws.getCell("A7").value = null; ws.getCell("C40").value = "Rev. 2024"; });
    expect(await checkLayoutRoundTrip(ROW2_LAYOUT, far)).toMatchObject({ ok: false, message: expect.stringContaining("\"Rev. 2024\" in C40, where employee 39 would go") });
    // Right under the first row of data, within the sample rows' reach, it says the same.
    const near = await templateWithFooter((ws) => { ws.getCell("A7").value = null; ws.getCell("B3").value = "Totals"; });
    expect(await checkLayoutRoundTrip(ROW2_LAYOUT, near)).toEqual({
      ok: false,
      message: "The PEO template workbook has \"Totals\" in B3, where employee 2 would go. Remove it, or use a template workbook with more room. A census can be any length, so nothing can sit below the first row of data.",
    });
    // Nothing below the headers: it reads back.
    expect(await checkLayoutRoundTrip(TEMPLATE_LAYOUT, await sampleTemplate())).toEqual({ ok: true });
    expect(await checkLayoutRoundTrip(CSV_LAYOUT, null)).toEqual({ ok: true });
  });

  it("says plainly when the file doesn't read back to the census", async () => {
    // A layout naming the same header twice in a template can't be filled column by column.
    const twice = { ...TEMPLATE_LAYOUT, columns: [{ header: "Work State", from: "work_state" as const }, { header: "Work State", from: "first_name" as const }] };
    expect(await censusRoundTrip(twice, SAMPLE_CENSUS, await sampleTemplate())).toEqual({ ok: false, message: expect.stringMatching(/^The census doesn't read back from the file as written/) });
    expect(await censusRoundTrip(TEMPLATE_LAYOUT, SAMPLE_CENSUS, null)).toEqual({ ok: false, message: "The census layout fills the PEO template workbook, so that file is needed to check it." });
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
    expect(await censusFile([ada], TEMPLATE_LAYOUT, { ...about, template: new Uint8Array([1, 2]) })).toEqual({ ok: false, message: "The file given as the PEO template workbook isn't an Excel workbook we can read." });
  });
});
