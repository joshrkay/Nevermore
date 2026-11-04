// What an intake needs before it can be certified and made into a Manuscript (US-1.2, decision D2), where
// each answer sits in the Review step and The Manuscript (C-1), and the one list of open items both show.
//
// Three answers are required: without them the Reckoning won't generate The Manuscript, and the database
// refuses a certification sent from the browser (public.intake_missing_required, migrations
// 20261103110000_certification_readiness.sql and 20261104100100_required_items.sql;
// src/data/schemaSync.test.ts keeps the lists equal). A required answer that holds two competing values
// (field status `conflicting`) blocks certification too, until the prospect picks one (B-2, decision D26;
// public.intake_conflicting_required, migration 20261104100000_certification_conflicts.sql). One that is
// incomplete, not known yet or only inferred is an open item, never a blocker, and so is a conflict on any
// other field. The employee census is recommended, not required: today it can only come from an uploaded
// file, and no document is required, so a missing census is listed as an open item but never blocks.
import type { ChamberData } from "./chamberTypes";
import { FIELD_LABELS, fieldOpenItems, type FieldKey, type FieldStatus, type ProvenanceMap } from "./provenance";

/** Where an answer is shown: the same sections in the Review step and in The Manuscript. */
export type ReviewSection = "company" | "workforce" | "locations" | "payroll" | "benefits" | "workers_comp" | "operations";

export const REVIEW_SECTIONS: readonly { key: ReviewSection; title: string }[] = [
  { key: "company", title: "Company" },
  { key: "workforce", title: "Workforce" },
  { key: "locations", title: "Locations" },
  { key: "payroll", title: "Payroll" },
  { key: "benefits", title: "Benefits" },
  { key: "workers_comp", title: "Workers' comp" },
  { key: "operations", title: "Operations & HR" },
];

export const SECTION_TITLES: Record<ReviewSection, string> = Object.fromEntries(REVIEW_SECTIONS.map((s) => [s.key, s.title])) as Record<ReviewSection, string>;

/**
 * The section each answer belongs to, in the order each section shows them. Every field of the intake
 * schema is here (src/data/manuscript.test.ts holds the Manuscript to it), so nothing captured can go unshown.
 */
export const SECTION_OF: Record<FieldKey, ReviewSection> = {
  company_name: "company",
  industry: "company",
  multiple_entities: "company",
  fein_count: "company",
  start_month: "company",
  virgin_medical: "company",

  employee_count: "workforce",
  has_nonexempt: "workforce",
  nonexempt_count: "workforce",
  exempt_count: "workforce",
  has_1099: "workforce",
  ca_contractors: "workforce",
  hr_staff_count: "workforce",
  has_handbook: "workforce",
  handbook_last_updated: "workforce",
  census: "workforce",

  hq_state: "locations",
  states: "locations",

  payroll_vendor: "payroll",
  pay_frequency: "payroll",
  funding_days: "payroll",
  accrual_method: "payroll",
  pto_types: "payroll",
  uses_computer_timekeeping: "payroll",
  uses_mobile_app: "payroll",
  uses_physical_clocks: "payroll",
  shift_differentials: "payroll",
  hris_system: "payroll",

  current_carrier: "benefits",
  renewal_date: "benefits",
  rate_history: "benefits",
  benefits_waiting_period: "benefits",
  ancillary_benefits: "benefits",
  has_401k: "benefits",
  retirement_type: "benefits",
  employer_contributes: "benefits",

  wc_carrier: "workers_comp",
  wc_renewal_date: "workers_comp",
  wc_experience_mod: "workers_comp",
  wc_annual_premium: "workers_comp",

  key_challenges: "operations",
  business_goals: "operations",
};

const ALL_FIELDS = Object.keys(SECTION_OF) as FieldKey[];

/** The answers of a section, in the order it shows them. */
export const sectionFields = (section: ReviewSection): FieldKey[] => ALL_FIELDS.filter((field) => SECTION_OF[field] === section);

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
    field: "census",
    section: "workforce",
    hint: "Upload a census on the Upload tab. Underwriters will ask for one, but you can certify without it.",
    missing: (d) => d.census.length === 0,
  },
];

const CENSUS_ITEM = RECOMMENDED_ITEMS[0];

/** The required answers this intake doesn't have yet, in the order they are shown. */
export const missingRequired = (data: ChamberData): ReadinessItem[] => REQUIRED_ITEMS.filter((item) => item.missing(data));

/** The recommended answers this intake doesn't have yet. They never block certification. */
export const missingRecommendedItems = (data: ChamberData): ReadinessItem[] => RECOMMENDED_ITEMS.filter((item) => item.missing(data));

const REQUIRED_FIELDS: ReadonlySet<FieldKey> = new Set(REQUIRED_ITEMS.flatMap((item) => (item.field ? [item.field] : [])));

/** Whether a field has to be answered before the intake can be certified. */
export const isRequiredField = (field: FieldKey): boolean => REQUIRED_FIELDS.has(field);

/**
 * Field statuses a required answer can't be certified with: the answer is there, but the prospect still has
 * to choose one. The database refuses the same (public.intake_conflicting_required, SQLSTATE EA008).
 */
export const BLOCKING_STATUSES: readonly FieldStatus[] = ["conflicting"];

/** No field verified by an advisor. */
const NONE: ReadonlySet<string> = new Set();

/**
 * The required answers the prospect gave two different values for, in the order they are shown. Each
 * blocks certification until one value is chosen in Review. A field an advisor verified is settled.
 */
export const conflictingRequired = (provenance: ProvenanceMap, verified: ReadonlySet<string> = NONE): ReadinessItem[] =>
  REQUIRED_ITEMS.filter((item) => item.field !== undefined && provenance[item.field]?.status === "conflicting" && !verified.has(item.field));

// ---------- Open items ----------

/** Why an item is open, in the order the list shows them. */
export type OpenItemReason = "missing" | "conflicting" | "incomplete" | "unknown" | "inferred" | "recommended";

export interface OpenItem {
  /** The field, or the readiness key for an item that isn't one field. */
  key: string;
  field?: FieldKey;
  section: ReviewSection;
  label: string;
  reason: OpenItemReason;
  /** What the prospect can do about it, in plain words. */
  action: string;
  /** True when the intake can't be certified until it is settled. */
  blocking: boolean;
}

const ACTIONS: Record<Exclude<OpenItemReason, "missing" | "recommended">, string> = {
  conflicting: "You've given two different answers. Choose the right one.",
  incomplete: "Only part of this answer was given. Complete it.",
  unknown: "You said you didn't know this yet. Add it when you can, or mark it as not applicable.",
  inferred: "Lenore took this from the conversation. Confirm it, or correct it.",
};

/** States of operation taken from a census whose answers conflict: the census is what to settle. */
const CENSUS_CONFLICT_ACTION = "The census's answers conflict, and it gives your states. Choose which is right.";

const STATUS_REASON: Partial<Record<FieldStatus, OpenItemReason>> = {
  conflicting: "conflicting",
  incomplete: "incomplete",
  unknown: "unknown",
  inferred: "inferred",
};

/**
 * Everything the prospect still owes, in one list, for the Review step, the Reckoning and The Manuscript:
 * the required answers that are missing or given two ways (blocking), then the required answers given but
 * not settled, then every other answer that is conflicting, incomplete, not known yet or only inferred, then
 * the recommended census. A field an advisor verified (`verified`) is settled whatever its status, though
 * verifying never supplies a missing answer. A field marked not applicable is closed and never listed. A
 * recommended answer with no answer at all isn't owed. While only the census names the states of operation,
 * the census is the answer to settle, and the item says so.
 */
export function openItems(data: ChamberData, provenance: ProvenanceMap = {}, verified: ReadonlySet<string> = NONE): OpenItem[] {
  const items: OpenItem[] = [];
  const listed = new Set<string>();
  const add = (item: OpenItem) => {
    if (listed.has(item.key)) return;
    listed.add(item.key);
    items.push(item);
  };
  const statusOf = (field: FieldKey): FieldStatus | undefined => (verified.has(field) ? undefined : provenance[field]?.status);
  const statesFromCensus = !data.states.some((s) => !blank(s)) && data.census.some((e) => !blank(e.work_state));
  // The field whose status settles a required item: the census, while it alone names the states.
  const settledBy = (item: ReadinessItem): FieldKey | undefined => (item.key === "states" && statesFromCensus ? "census" : item.field);

  for (const item of missingRequired(data)) {
    add({ key: item.key, field: item.field, section: item.section, label: item.label, reason: "missing", action: item.hint, blocking: true });
  }
  for (const item of REQUIRED_ITEMS) {
    const field = settledBy(item);
    if (!field || statusOf(field) !== "conflicting") continue;
    const viaCensus = field === "census";
    add({
      key: item.key,
      field,
      section: viaCensus ? CENSUS_ITEM.section : item.section,
      label: viaCensus ? CENSUS_ITEM.label : item.label,
      reason: "conflicting",
      action: viaCensus ? CENSUS_CONFLICT_ACTION : ACTIONS.conflicting,
      blocking: true,
    });
    if (viaCensus) listed.add("census");
  }
  // The required answers given but not settled come before every other open field.
  for (const item of REQUIRED_ITEMS) {
    const field = settledBy(item);
    const status = field ? statusOf(field) : undefined;
    const reason = status ? STATUS_REASON[status] : undefined;
    if (!field || !reason || reason === "conflicting") continue;
    add({ key: field, field, section: SECTION_OF[field], label: field === "census" ? CENSUS_ITEM.label : item.label, reason, action: ACTIONS[reason], blocking: false });
  }
  for (const open of fieldOpenItems(provenance, verified)) {
    const reason = STATUS_REASON[provenance[open.field]!.status]!;
    add({
      key: open.field,
      field: open.field,
      section: SECTION_OF[open.field],
      label: FIELD_LABELS[open.field],
      reason,
      action: ACTIONS[reason as keyof typeof ACTIONS],
      blocking: false,
    });
  }
  for (const item of missingRecommendedItems(data)) {
    add({ key: item.key, field: item.field, section: item.section, label: item.label, reason: "recommended", action: item.hint, blocking: false });
  }
  return items;
}

/** The open items that block certification: required answers missing or given two ways. */
export const blockingItems = (data: ChamberData, provenance: ProvenanceMap = {}, verified: ReadonlySet<string> = NONE): OpenItem[] =>
  openItems(data, provenance, verified).filter((item) => item.blocking);

/** Ready to certify: every required answer is there and settled (GLOSSARY.md). */
export const readyToCertify = (data: ChamberData, provenance: ProvenanceMap = {}, verified: ReadonlySet<string> = NONE): boolean =>
  blockingItems(data, provenance, verified).length === 0;

// ---------- Section status ----------

export type SectionStatus = "complete" | "needs_confirmation" | "incomplete" | "not_applicable";

export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  complete: "Complete",
  needs_confirmation: "Needs confirmation",
  incomplete: "Incomplete",
  not_applicable: "Not applicable",
};

/**
 * One status per section: not applicable when the prospect marked every answer in it as not applying;
 * incomplete while any of its answers is still owed (missing, conflicting, incomplete, not known yet, or
 * the recommended census); needs confirmation while any is only inferred; complete otherwise.
 */
export function sectionStatus(
  section: ReviewSection,
  data: ChamberData,
  provenance: ProvenanceMap = {},
  verified: ReadonlySet<string> = NONE,
  items = openItems(data, provenance, verified),
): SectionStatus {
  const fields = sectionFields(section);
  if (fields.length > 0 && fields.every((field) => provenance[field]?.status === "not_applicable")) return "not_applicable";
  const here = items.filter((item) => item.section === section);
  if (here.some((item) => item.reason !== "inferred")) return "incomplete";
  if (here.length > 0) return "needs_confirmation";
  return "complete";
}

/**
 * The labels for the keys the database names when it refuses an unready certification: the missing answers
 * (SQLSTATE EA003) or those given two ways (EA008).
 */
export function describeRequiredKeys(keys: string | null | undefined): string[] {
  const named = (keys ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  return named.map((key) => REQUIRED_ITEMS.find((item) => item.key === key)?.label ?? key);
}
