// What prospects can upload, and what each kind of document is good for. None is required:
// recommended categories are suggestions, and a missing one never blocks submission. The keys are
// the values `documents.category` accepts (20261029090000_document_ingestion.sql).

export type DocumentCategory =
  | "employee_census"
  | "benefits_summary"
  | "payroll_report"
  | "workers_comp_loss_runs"
  | "peo_invoice"
  | "prior_proposal"
  | "other";

export interface DocumentCategoryInfo {
  key: DocumentCategory;
  label: string;
  guidance: string;
  example: string;
  recommended: boolean;
}

export const DOCUMENT_CATEGORIES: DocumentCategoryInfo[] = [
  {
    key: "employee_census",
    label: "Employee census",
    guidance: "One row per employee: name, date of birth, work state, title, pay, and W-2 or 1099.",
    example: "An employee export from your payroll system.",
    recommended: true,
  },
  {
    key: "benefits_summary",
    label: "Benefits summary",
    guidance: "Your current medical plan and what you pay for it, so plans can be compared like for like.",
    example: "A summary of benefits, plan design sheet, or renewal notice.",
    recommended: true,
  },
  {
    key: "payroll_report",
    label: "Payroll report",
    guidance: "Recent wages by employee or by state, and how often you run payroll.",
    example: "A payroll register or year-to-date summary.",
    recommended: true,
  },
  {
    key: "workers_comp_loss_runs",
    label: "Workers' comp loss runs",
    guidance: "Your policy declarations and claims history, used to price workers' comp.",
    example: "A W/C declarations page or loss runs from your carrier.",
    recommended: true,
  },
  {
    key: "peo_invoice",
    label: "Current PEO invoice",
    guidance: "What you pay a current PEO today, if you have one. Skip this if you don't use a PEO.",
    example: "A recent PEO invoice or billing statement.",
    recommended: false,
  },
  {
    key: "prior_proposal",
    label: "Prior proposal",
    guidance: "A quote or proposal you've already received, so your advisor can compare it.",
    example: "A PEO or broker proposal, or a renewal quote.",
    recommended: false,
  },
  {
    key: "other",
    label: "Other",
    guidance: "Anything else you'd like your advisor to see.",
    example: "An employee handbook or a company overview.",
    recommended: false,
  },
];

const BY_KEY = new Map(DOCUMENT_CATEGORIES.map((c) => [c.key, c]));

export function isDocumentCategory(v: unknown): v is DocumentCategory {
  return typeof v === "string" && BY_KEY.has(v as DocumentCategory);
}

export function categoryInfo(key: string): DocumentCategoryInfo {
  return BY_KEY.get(key as DocumentCategory) ?? BY_KEY.get("other")!;
}

/** A starting category from the file name; the prospect can change it. */
export function guessCategory(fileName: string): DocumentCategory {
  const lower = fileName.toLowerCase();
  if (/census|employee|roster/.test(lower)) return "employee_census";
  if (/loss.?run|\bw.?c\b|work.*comp|dec.?page/.test(lower)) return "workers_comp_loss_runs";
  if (/payroll|register|wage/.test(lower)) return "payroll_report";
  if (/proposal|quote/.test(lower)) return "prior_proposal";
  if (/invoice|bill|statement/.test(lower)) return "peo_invoice";
  if (/benefit|plan|sbc|renewal|medical/.test(lower)) return "benefits_summary";
  return "other";
}

/** Categories with at least one uploaded document, in display order. */
export function submittedCategories(docs: { category: string }[]): DocumentCategoryInfo[] {
  const present = new Set(docs.map((d) => d.category));
  return DOCUMENT_CATEGORIES.filter((c) => present.has(c.key));
}

/** Recommended categories with no uploaded document yet, in display order. */
export function missingRecommended(docs: { category: string }[]): DocumentCategoryInfo[] {
  const present = new Set(docs.map((d) => d.category));
  return DOCUMENT_CATEGORIES.filter((c) => c.recommended && !present.has(c.key));
}
