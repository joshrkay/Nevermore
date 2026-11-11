// Open items (GLOSSARY.md, US-2.2a): what the prospect still owes on an intake, one list, used by Review, The
// Manuscript and (by its SQL copy, public.advisor_list_submissions) the advisor queue, which differs in one case: it
// leaves out a required answer in conflict that an advisor verified, as every other verified field. Each item says
// why it is open.
//
// - A required answer with none: "Not provided" ("Prospect to provide" when the prospect said they don't know).
// - The employee census when none is uploaded: "Document needed". It is recommended, not required (D2): it never
//   blocks certification, but underwriters need one, and it can only come from a document.
// - Any other field whose status is conflicting, incomplete, unknown or inferred, in that order (fieldOpenItems),
//   except one an advisor verified, which is settled (verificationClosesOpenItem): not a required answer in conflict,
//   which certification still needs chosen.
// - A column the census lacks that PEOs ask of every employee (gender, hire date, COBRA status, home state, K-2.1):
//   "Missing from the census", once per column however many people lack it. Like the census, it never blocks, and
//   the advisor queue doesn't count it.
// - A state of operation with no unemployment tax rate (K-4.2): "Rate needed", once per state. It never blocks, and
//   the advisor queue doesn't count it.
// A field marked "Doesn't apply" is closed. A recommended field with no answer is not an open item.
import type { ChamberData } from "./chamberTypes";
import { fieldOpenItems, OPEN_FIELD_STATUSES, type FieldKey, type FieldOpenReason, type ProvenanceMap } from "./provenance";
import { missingCensusColumns, missingRecommendedItems, missingRequired } from "./readiness";
import { NO_VERIFIED_FIELDS } from "./requiredItems";
import { statesWithoutRate } from "./sutaRates";

export type OpenItemReason = FieldOpenReason | "Not provided" | "Document needed" | "Missing from the census" | "Rate needed";

export interface OpenItem {
  /** The field, or `census`; the key the advisor queue and the database name it by. */
  key: string;
  field?: FieldKey;
  label: string;
  reason: OpenItemReason;
  /** For a census column: how many people (or employees, for a class code) lack it, of how many. */
  people?: { missing: number; of: number; who: "people" | "employees" };
}

/**
 * The statuses that leave a field open, most pressing first. The advisor queue counts the same ones
 * (`open_item_statuses` in its migration; src/data/schemaSync.test.ts compares them).
 */
export const OPEN_ITEM_STATUSES = OPEN_FIELD_STATUSES;

/**
 * Every open item on the intake: required answers first, then the census, then fields by status. `verified` are the
 * fields an advisor verified: settled, so not listed by status, except a required answer in conflict (it still has to be
 * chosen). A required answer that is
 * missing is listed even when verified, because verifying never supplies a value.
 */
export function openItems(data: ChamberData, provenance: ProvenanceMap, verified: ReadonlySet<string> = NO_VERIFIED_FIELDS): OpenItem[] {
  const items: OpenItem[] = [];
  const listed = new Set<string>();
  for (const item of missingRequired(data)) {
    const unknown = item.field && provenance[item.field]?.status === "unknown";
    items.push({ key: item.key, field: item.field, label: item.label, reason: unknown ? "Prospect to provide" : "Not provided" });
    listed.add(item.key);
  }
  for (const item of missingRecommendedItems(data)) {
    items.push({ key: item.key, label: item.label, reason: "Document needed" });
    listed.add(item.key);
  }
  for (const column of missingCensusColumns(data)) {
    items.push({ key: column.key, label: column.label, reason: "Missing from the census", people: { missing: column.missing, of: column.of, who: column.who } });
    listed.add(column.key);
  }
  // A state of operation with no unemployment tax rate (K-4.2): one item per state.
  for (const state of statesWithoutRate(data)) {
    items.push({ key: `suta_rates.${state}`, label: `Unemployment tax rate, ${state}`, reason: "Rate needed" });
  }
  for (const { field, label, reason } of fieldOpenItems(provenance, verified)) {
    if (listed.has(field)) continue;
    items.push({ key: field, field, label, reason });
    listed.add(field);
  }
  return items;
}

/** The open items as The Manuscript lists them: "Company legal name — not provided". */
export const describeOpenItem = (item: OpenItem): string =>
  `${item.label} — ${item.reason.toLowerCase()}${item.people ? ` for ${item.people.missing} of ${item.people.of} ${item.people.who === "employees" ? (item.people.of === 1 ? "employee" : "employees") : item.people.of === 1 ? "person" : "people"}` : ""}`;
