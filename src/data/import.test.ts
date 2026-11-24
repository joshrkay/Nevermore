import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRows, chunks, IMPORT_FIELDS, IMPORT_LIMITS, matchingProblem, parseCsv, proposeMatches, readImportFile } from "./import";

describe("reading a CSV", () => {
  // Break caught: a business called "Cole, Dana & Sons" split into two columns, shifting every field after it.
  it("keeps commas, line breaks and quotes that are inside quotes", () => {
    expect(parseCsv('Name,Note\r\n"Cole, Dana & Sons","said ""call\nback"""\r\n')).toEqual([["Name", "Note"], ["Cole, Dana & Sons", 'said "call\nback"']]);
  });

  it("drops a byte-order mark and blank lines, and reads a last row with no line break after it", () => {
    expect(parseCsv("\uFEFFName,State\n\n , \nAcme,TX")).toEqual([["Name", "State"], ["Acme", "TX"]]);
  });

  it("reads a file a spreadsheet wrote with semicolons or tabs", () => {
    expect(parseCsv("Name;State\nAcme;TX")).toEqual([["Name", "State"], ["Acme", "TX"]]);
    expect(parseCsv("Name\tState\nAcme\tTX")).toEqual([["Name", "State"], ["Acme", "TX"]]);
  });

  // CRM-X4.1's "a file that can't be read": what is wrong and what a file needs.
  it.each([
    ["PK\u0003\u0004 a spreadsheet", "That file isn't a CSV."],
    ["", "That file is empty."],
    ["Name,State\n", "The file has column names and no rows under them."],
  ])("says what is wrong with %j", (text, starts) => {
    const read = readImportFile(text);
    expect(read.ok).toBe(false);
    expect("problem" in read && read.problem.startsWith(starts)).toBe(true);
  });

  it("refuses a file with more rows than an import holds, and says how many it has", () => {
    const read = readImportFile(`Name\n${"x\n".repeat(IMPORT_LIMITS.max_rows + 1)}`);
    expect(read).toEqual({ ok: false, problem: "The file has 10,001 rows. An import holds at most 10,000: split the file and import each part." });
  });

  it("gives the header row and the rows under it", () => {
    expect(readImportFile("Name , State\nAcme,TX\n")).toEqual({ ok: true, headers: ["Name", "State"], rows: [["Acme", "TX"]] });
  });
});

describe("matching columns to fields", () => {
  // Break caught: "Company" imported as nothing, so every lead arrives without its business.
  it("proposes a field for a column that reads as it, whatever its capitals and punctuation, and Don't import for one that doesn't", () => {
    expect(proposeMatches("leads", ["Full Name", "E-mail Address", "Company", "# of Employees", "Favourite colour"])).toEqual(["name", "email", "business", "employees", null]);
    expect(proposeMatches("leads", ["Name", "Head count", "Current PEO", "Assigned To"])).toEqual(["name", "employees", "current_provider", "owner"]);
  });

  it("reads a first name, last name and email on an accounts file as the contact's, and the company as the account", () => {
    expect(proposeMatches("accounts", ["Company", "First Name", "Last Name", "Email", "Zip", "Renewal Date", "X-Date"]))
      .toEqual(["name", "contact_first_name", "contact_last_name", "contact_email", "postal_code", "renewal_date", null]);
  });

  it("proposes a field once, and prefers the column that is named exactly for it", () => {
    expect(proposeMatches("accounts", ["Company", "Business name"])).toEqual([null, "name"]);
    expect(proposeMatches("leads", ["Email", "Work email"])).toEqual(["email", null]);
  });

  it("says a required field is unmatched, or a field matched twice, and nothing when the matching can be used", () => {
    expect(matchingProblem("leads", ["email", null])).toBe("Match a column to Name: every row needs one.");
    expect(matchingProblem("accounts", ["name", "city", "city"])).toBe("Two columns are matched to City. Match one of them to something else, or to Don't import.");
    expect(matchingProblem("accounts", ["name", null])).toBeNull();
  });

  it("offers no field that could hold a tax ID or anything about an employee", () => {
    for (const field of [...IMPORT_FIELDS.leads, ...IMPORT_FIELDS.accounts]) expect(`${field.key} ${field.label} ${field.also.join(" ")}`).not.toMatch(/fein|ein\b|ssn|tax|salary|wage|dob|birth/i);
  });
});

describe("the rows the database is sent", () => {
  // Break caught: a problem reported against the wrong row of the person's file.
  it("names each matched column by its field, trims it, leaves empty cells out, and numbers each row as the file does (the header is row 1)", () => {
    expect(buildRows([[" Dana Cole ", "x", ""], ["Sam Roe", "y", "TX"]], ["name", null, "state"])).toEqual([{ _row: 2, name: "Dana Cole" }, { _row: 3, name: "Sam Roe", state: "TX" }]);
  });

  it("cuts the rows into requests of at most 500", () => {
    const pieces = chunks(Array.from({ length: 1201 }, (_, i) => i));
    expect(pieces.map((p) => p.length)).toEqual([500, 500, 201]);
  });

  it("goes by the limits the database goes by", () => {
    const sql = readFileSync("supabase/migrations/20261130090000_import.sql", "utf8");
    const block = sql.slice(sql.indexOf("-- sync:begin import_limits"), sql.indexOf("-- sync:end import_limits"));
    expect(Object.fromEntries([...block.matchAll(/'([a-z_]+)', (\d+)/g)].map((m) => [m[1], Number(m[2])]))).toEqual({ ...IMPORT_LIMITS });
  });
});
