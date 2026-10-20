// What prospects can upload, and what each kind of document is good for. None is required:
// recommended categories are suggestions, and a missing one never blocks submission.

export type DocumentCategory = "census" | "benefits" | "payroll" | "workers_comp" | "prior_invoices" | "other";

export interface DocumentCategoryInfo {
  key: DocumentCategory;
  label: string;
  guidance: string;
  example: string;
  recommended: boolean;
}

export const DOCUMENT_CATEGORIES: DocumentCategoryInfo[] = [
  {
    key: "census",
    label: "Employee census",
    guidance: "One row per employee: name, date of birth, work state, title, pay, and W-2 or 1099.",
    example: "An employee export from your payroll system.",
    recommended: true,
  },
  {
    key: "benefits",
    label: "Benefits summary",
    guidance: "Your current medical plan and what you pay for it, so plans can be compared like for like.",
    example: "A summary of benefits, plan design sheet, or renewal notice.",
    recommended: true,
  },
  {
    key: "payroll",
    label: "Payroll report",
    guidance: "Recent wages by employee or by state, and how often you run payroll.",
    example: "A payroll register or year-to-date summary.",
    recommended: true,
  },
  {
    key: "workers_comp",
    label: "Workers' comp",
    guidance: "Your policy declarations and claims history, used to price workers' comp.",
    example: "A W/C declarations page or loss runs from your carrier.",
    recommended: true,
  },
  {
    key: "prior_invoices",
    label: "Prior invoices",
    guidance: "What you pay a current PEO or benefits provider today.",
    example: "A recent PEO invoice or benefits bill.",
    recommended: false,
  },
  {
    key: "other",
    label: "Other",
    guidance: "Anything else you'd like your advisor to see.",
    example: "An employee handbook or a prior proposal.",
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
  if (/census|employee|roster/.test(lower)) return "census";
  if (/loss.?run|\bw.?c\b|work.*comp|dec.?page/.test(lower)) return "workers_comp";
  if (/payroll|register|wage/.test(lower)) return "payroll";
  if (/invoice|bill|statement/.test(lower)) return "prior_invoices";
  if (/benefit|plan|sbc|renewal|medical/.test(lower)) return "benefits";
  return "other";
}

/** Recommended categories with no uploaded document yet, in display order. */
export function missingRecommended(docs: { category: string }[]): DocumentCategoryInfo[] {
  const present = new Set(docs.map((d) => d.category));
  return DOCUMENT_CATEGORIES.filter((c) => c.recommended && !present.has(c.key));
}
