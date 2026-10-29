import { describe, expect, it } from "vitest";
import { DOCUMENT_CATEGORIES, guessCategory, missingRecommended, submittedCategories } from "./documentCategories";

describe("document categories", () => {
  it("guesses a category from the file name", () => {
    expect(guessCategory("Employee_Census_2026.xlsx")).toBe("employee_census");
    expect(guessCategory("WC loss runs.pdf")).toBe("workers_comp_loss_runs");
    expect(guessCategory("payroll-register.csv")).toBe("payroll_report");
    expect(guessCategory("PEO invoice March.pdf")).toBe("peo_invoice");
    expect(guessCategory("Prior proposal - Acme PEO.pdf")).toBe("prior_proposal");
    expect(guessCategory("Medical SBC.pdf")).toBe("benefits_summary");
    expect(guessCategory("scan001.pdf")).toBe("other");
  });

  it("lists recommended categories still missing, with zero, some, or all uploaded", () => {
    const recommended = DOCUMENT_CATEGORIES.filter((c) => c.recommended).map((c) => c.key);
    expect(missingRecommended([]).map((c) => c.key)).toEqual(recommended);
    expect(missingRecommended([{ category: "employee_census" }, { category: "other" }]).map((c) => c.key)).toEqual(
      recommended.filter((k) => k !== "employee_census"),
    );
    expect(missingRecommended(recommended.map((category) => ({ category })))).toEqual([]);
  });

  it("offers each kind of document the intake guidance names", () => {
    expect(DOCUMENT_CATEGORIES.map((c) => c.key)).toEqual([
      "employee_census", "benefits_summary", "payroll_report", "workers_comp_loss_runs", "peo_invoice", "prior_proposal", "other",
    ]);
  });

  it("separates what was submitted from what is still helpful, without requiring either", () => {
    const docs = [{ category: "employee_census" }, { category: "employee_census" }, { category: "prior_proposal" }];
    expect(submittedCategories(docs).map((c) => c.key)).toEqual(["employee_census", "prior_proposal"]);
    expect(missingRecommended(docs).map((c) => c.key)).toEqual(["benefits_summary", "payroll_report", "workers_comp_loss_runs"]);
    expect(submittedCategories([])).toEqual([]);
  });

  it("never calls a document required", () => {
    for (const c of DOCUMENT_CATEGORIES) expect(`${c.label} ${c.guidance} ${c.example}`).not.toMatch(/required|must/i);
  });
});
