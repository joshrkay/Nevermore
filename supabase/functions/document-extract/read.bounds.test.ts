import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// read.ts imports SheetJS and unpdf by URL, which Vitest can't load, so how it calls them is checked in its
// source. Each bound below was tried against SheetJS itself: without them, a one-cell .xlsx declaring
// A1:Z1048576 ran a 256 MB heap out of memory, and A1:XFD200 took 1.8 s to build 3.3 million empty cells;
// with them, each is read in about 10 ms.
const source = readFileSync("supabase/functions/document-extract/read.ts", "utf8");
const readSpreadsheet = source.slice(source.indexOf("async function readSpreadsheet"), source.indexOf("async function readTablesAndText"));

describe("read.ts bounds the spreadsheet library's work", () => {
  it("reads no more rows of any sheet than a census needs, for every format", () => {
    // Each call, up to the end of its options object.
    const reads = readSpreadsheet.split("XLSX.read(").slice(1).map((rest) => rest.slice(0, rest.indexOf("})")));
    expect(reads).toHaveLength(2); // CSV, then .xls/.xlsx
    for (const call of reads) expect(call).toContain("sheetRows: MAX_SHEET_ROWS");
  });

  it("turns only the clamped range of each sheet into rows", () => {
    expect(readSpreadsheet).toMatch(/sheet_to_json<unknown\[\]>\(ws, \{[^}]*range: clampSheetRange\(/);
  });

  it("marks a sheet whose declared rows ran past what was read, so its census isn't taken as the whole company", () => {
    // SheetJS keeps the declared range in !fullref when sheetRows cuts !ref.
    expect(readSpreadsheet).toContain('ws["!fullref"]');
    expect(readSpreadsheet).toMatch(/cutOff: sheetCutOff\(/);
    // A CSV declares no range (SheetJS leaves !fullref unset): one that filled every row read counts as longer.
    expect(readSpreadsheet).toMatch(/rows\.length >= MAX_SHEET_ROWS \? Number\.POSITIVE_INFINITY/);
  });

  it("checks how large an .xlsx unzips to before the library unzips it", () => {
    const check = readSpreadsheet.indexOf("unzippedSize(bytes, MAX_XLSX_UNZIPPED_BYTES)");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(readSpreadsheet.indexOf("XLSX.read("));
  });
});
