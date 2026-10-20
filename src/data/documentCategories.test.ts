import { describe, expect, it } from "vitest";
import { DOCUMENT_CATEGORIES, guessCategory, missingRecommended } from "./documentCategories";

describe("document categories", () => {
  it("guesses a category from the file name", () => {
    expect(guessCategory("Employee_Census_2026.xlsx")).toBe("census");
    expect(guessCategory("WC loss runs.pdf")).toBe("workers_comp");
    expect(guessCategory("payroll-register.csv")).toBe("payroll");
    expect(guessCategory("PEO invoice March.pdf")).toBe("prior_invoices");
    expect(guessCategory("Medical SBC.pdf")).toBe("benefits");
    expect(guessCategory("scan001.pdf")).toBe("other");
  });

  it("lists recommended categories still missing, with zero, some, or all uploaded", () => {
    const recommended = DOCUMENT_CATEGORIES.filter((c) => c.recommended).map((c) => c.key);
    expect(missingRecommended([]).map((c) => c.key)).toEqual(recommended);
    expect(missingRecommended([{ category: "census" }, { category: "other" }]).map((c) => c.key)).toEqual(
      recommended.filter((k) => k !== "census"),
    );
    expect(missingRecommended(recommended.map((category) => ({ category })))).toEqual([]);
  });

  it("never calls a document required", () => {
    for (const c of DOCUMENT_CATEGORIES) expect(`${c.label} ${c.guidance} ${c.example}`).not.toMatch(/required|must/i);
  });
});
