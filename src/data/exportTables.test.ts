import { describe, expect, it } from "vitest";
import { exportedWords, exportFileName } from "./exportTables";

describe("what an export of each table is called", () => {
  // Catches: the accounts table missing from the words (an export of accounts read as "rows of accounts", or a file with no name).
  it("calls an export of accounts by the accounts' own words and names its file for them", () => {
    expect(exportedWords("accounts", 1)).toBe("Exported 1 account");
    expect(exportedWords("accounts", 1204)).toBe("Exported 1,204 accounts");
    expect(exportFileName("accounts", "2026-11-19")).toBe("accounts-2026-11-19.csv");
  });

  it("keeps the words of the tables before it", () => {
    expect(exportedWords("referral_partners", 2)).toBe("Exported 2 referral partners");
    expect(exportedWords("firm_activity", 1)).toBe("Exported 1 entry in the firm's record");
    expect(exportedWords("leads", 2)).toBe("Exported 2 leads");
  });

  // Catches: the quotes export read as "rows of quotes", or its file named for no table.
  it("calls an export of quotes by their own words and names its file for them", () => {
    expect(exportedWords("quotes", 1)).toBe("Exported 1 quote");
    expect(exportedWords("quotes", 3)).toBe("Exported 3 quotes");
    expect(exportFileName("quotes", "2026-11-19")).toBe("quotes-2026-11-19.csv");
  });

  it("names a table this version does not know as the database wrote it", () => {
    expect(exportedWords("invoices", 3)).toBe("Exported 3 rows of invoices");
  });
});
