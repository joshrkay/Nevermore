// Open items (GLOSSARY.md, US-2.2a): what the prospect still owes on an intake, one list, used by Review, The
// Manuscript and (by its SQL copy, public.advisor_list_submissions) the advisor queue. Each item says why it is open.
//
// - A required answer with none: "Not provided" ("Prospect to provide" when the prospect said they don't know).
// - The employee census when none is uploaded: "Document needed". It is recommended, not required (D2): it never
//   blocks certification, but underwriters need one, and it can only come from a document.
// - Any other field whose status is conflicting, incomplete, unknown or inferred, in that order.
// A field marked "Doesn't apply" is closed. A recommended field with no answer is not an open item.
import type { ChamberData } from "./chamberTypes";
import { FIELD_LABELS, type FieldKey, type FieldStatus, type ProvenanceMap } from "./provenance";
import { missingRecommendedItems, missingRequired } from "./readiness";

export type OpenItemReason =
  | "Not provided"
  | "Document needed"
  | "Conflicting answers"
  | "Incomplete"
  | "Prospect to provide"
  | "Please confirm";

export interface OpenItem {
  /** The field, or `census`; the key the advisor queue and the database name it by. */
  key: string;
  field?: FieldKey;
  label: string;
  reason: OpenItemReason;
}

/**
 * The statuses that leave a field open, most pressing first. The advisor queue counts the same ones
 * (`open_item_statuses` in its migration; src/data/schemaSync.test.ts compares them).
 */
export const OPEN_ITEM_STATUSES: readonly FieldStatus[] = ["conflicting", "incomplete", "unknown", "inferred"];

const STATUS_REASONS: Record<string, OpenItemReason> = {
  conflicting: "Conflicting answers",
  incomplete: "Incomplete",
  unknown: "Prospect to provide",
  inferred: "Please confirm",
};

const FIELD_KEYS = Object.keys(FIELD_LABELS) as FieldKey[];

/** Every open item on the intake: required answers first, then the census, then fields by status. */
export function openItems(data: ChamberData, provenance: ProvenanceMap): OpenItem[] {
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
  for (const status of OPEN_ITEM_STATUSES) {
    for (const field of FIELD_KEYS) {
      if (listed.has(field) || provenance[field]?.status !== status) continue;
      items.push({ key: field, field, label: FIELD_LABELS[field], reason: STATUS_REASONS[status] });
      listed.add(field);
    }
  }
  return items;
}

/** The open items as The Manuscript lists them: "Company legal name — not provided". */
export const describeOpenItem = (item: OpenItem): string => `${item.label} — ${item.reason.toLowerCase()}`;
