// What an intake needs before it can be certified and made into a Manuscript (US-1.2, decision D2).
//
// Three answers are required: without them the Reckoning won't generate The Manuscript, and the database
// refuses a certification sent from the browser (public.intake_missing_required, migration
// 20261103110000_certification_readiness.sql; src/data/schemaSync.test.ts keeps the two lists equal).
// The employee census is recommended, not required: today it can only come from an uploaded file, and no
// document is required, so a missing census is listed as an open item but never blocks.
//
// A required answer that holds two competing values (field status `conflicting`) blocks certification too,
// until the prospect picks one (B-2, decision D26; public.intake_conflicting_required, migration
// 20261104100000_certification_conflicts.sql). A conflict on any other field is an open item, never a blocker.
import type { ChamberData } from "./chamberTypes";
import type { FieldKey, ProvenanceMap } from "./provenance";

/** Where an item is answered in the Review step. */
export type ReviewSection = "company" | "workforce" | "locations" | "payroll" | "benefits" | "workers_comp" | "operations";

export interface ReadinessItem {
  /** The key the database reports for it. */
  key: string;
  label: string;
  /** The answer that settles it, when it is a single field. */
  field?: FieldKey;
  section: ReviewSection;
  /** What to tell the prospect to do about it. */
  hint: string;
  missing: (data: ChamberData) => boolean;
}

const blank = (value: string | null | undefined) => !value || value.trim() === "";

/** The census columns listed as an item of their own when people lack them, with what each is called. */
export const CENSUS_COLUMN_ITEMS = [
  ["gender", "Gender"],
  ["hire_date", "Hire date"],
  ["cobra", "COBRA status"],
  ["home_state", "Home state"],
  // What the payroll-by-class-code table needs (K-3.2). Asked of employees only: a contractor has no class code.
  ["class_code", "Workers' comp class code"],
] as const satisfies readonly (readonly [keyof ChamberData["census"][number], string])[];
export type CensusColumnItem = (typeof CENSUS_COLUMN_ITEMS)[number][0];

export const REQUIRED_ITEMS: readonly ReadinessItem[] = [
  {
    key: "company_name",
    label: "Company legal name",
    field: "company_name",
    section: "company",
    hint: "The name the company is registered under.",
    missing: (d) => blank(d.company_name),
  },
  {
    key: "states",
    label: "States of operation",
    field: "states",
    section: "locations",
    hint: "Every state where employees work, as two-letter codes such as NY, CA.",
    // A work state on the census counts too, as it does in the Manuscript's state breakdown.
    missing: (d) => !d.states.some((s) => !blank(s)) && !d.census.some((e) => !blank(e.work_state)),
  },
  {
    key: "pay_frequency",
    label: "Pay frequency",
    field: "pay_frequency",
    section: "payroll",
    hint: "How often employees are paid, for example bi-weekly.",
    missing: (d) => blank(d.pay_frequency),
  },
];

export const RECOMMENDED_ITEMS: readonly ReadinessItem[] = [
  {
    key: "census",
    label: "Employee census",
    section: "workforce",
    hint: "Upload a census on the Upload tab, where there's a template to fill in. Underwriters will ask for one, but you can certify without it.",
    missing: (d) => d.census.length === 0,
  },
];

/**
 * The columns PEOs' health underwriters ask of every employee that people on this census lack (K-2.1), each once
 * with how many people lack it. A census without a column is still accepted, and none of these ever blocks
 * certification. Empty when there is no census: the census itself is then the item.
 */
export function missingCensusColumns(data: ChamberData): { key: string; column: CensusColumnItem; label: string; missing: number; of: number; who: "people" | "employees" }[] {
  return CENSUS_COLUMN_ITEMS.flatMap(([column, label]) => {
    const who = column === "class_code" ? ("employees" as const) : ("people" as const);
    const asked = who === "employees" ? data.census.filter((e) => e.classification !== "1099") : data.census;
    const missing = asked.filter((e) => e[column] === undefined).length;
    return missing > 0 ? [{ key: `census.${column}`, column, label, missing, of: asked.length, who }] : [];
  });
}

/** What to tell the prospect to do about a column their census lacks. */
export const CENSUS_COLUMN_HINT = "Add it to your census file and upload the file again. You can certify without it.";

/** The required answers this intake doesn't have yet, in the order they are shown. */
export const missingRequired = (data: ChamberData): ReadinessItem[] => REQUIRED_ITEMS.filter((item) => item.missing(data));

/** The recommended answers this intake doesn't have yet. They never block certification. */
export const missingRecommendedItems = (data: ChamberData): ReadinessItem[] => RECOMMENDED_ITEMS.filter((item) => item.missing(data));

const REQUIRED_FIELDS: ReadonlySet<FieldKey> = new Set(REQUIRED_ITEMS.flatMap((item) => (item.field ? [item.field] : [])));

/** Whether a field has to be answered before the intake can be certified. */
export const isRequiredField = (field: FieldKey): boolean => REQUIRED_FIELDS.has(field);

/**
 * The required answers the prospect gave two different values for, in the order they are shown. Each
 * blocks certification until one value is chosen in Review.
 */
export const conflictingRequired = (provenance: ProvenanceMap): ReadinessItem[] =>
  REQUIRED_ITEMS.filter((item) => item.field !== undefined && provenance[item.field]?.status === "conflicting");

/**
 * The labels for the keys the database names when it refuses an unready certification: the missing answers
 * (SQLSTATE EA003) or those in conflict (EA008).
 */
export function describeRequiredKeys(keys: string | null | undefined): string[] {
  const named = (keys ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  return named.map((key) => REQUIRED_ITEMS.find((item) => item.key === key)?.label ?? key);
}
