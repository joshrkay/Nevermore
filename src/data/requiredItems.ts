import type { ChamberData } from "./chamberTypes";
import { FIELD_OPEN_REASONS, type FieldKey, type FieldOpenReason, type FieldStatus, type ProvenanceMap } from "./provenance";
import { conflictingRequired, RECOMMENDED_ITEMS, REQUIRED_ITEMS, type ReadinessItem } from "./readiness";

// How far along each item an intake needs is (decision D2): the three required answers, then the
// recommended census, as src/data/readiness.ts lists them and decides whether each is there. This adds
// whether a present answer is settled, from its provenance and the advisor's verifications. The
// database's public.intake_required_items (migration 20261104103000) is the same rule; the advisor queue's
// "missing required" reads it. requiredItems.cases.json holds the cases both sides are tested against.

/** "unconfirmed" is an inferred field. A settled item needs nothing more from the prospect. */
export type RequiredItemState = "missing" | "conflicting" | "incomplete" | "unconfirmed" | "settled";

export interface RequiredItem {
  /** The readiness key: company_name, states, pay_frequency or census. */
  item: string;
  label: string;
  field: FieldKey;
  /** Required items hold back certification and completeness; the recommended census never does. */
  required: boolean;
  state: RequiredItemState;
  /**
   * States of operation only: `states` isn't settled, so the census's work states and the census's state
   * decide it. The Employee census item says the same, so lists name that one instead.
   */
  viaCensus?: true;
  /** Where the item is answered and what to tell the prospect about it. */
  readiness: ReadinessItem;
}

/** No field verified by an advisor: a new intake, or one whose verified fields couldn't be read. */
export const NO_VERIFIED_FIELDS: ReadonlySet<string> = new Set();

/** What the prospect is told about an item that isn't settled: a field's own reason, or "Not provided". */
export const REQUIRED_ITEM_REASONS: Record<Exclude<RequiredItemState, "settled">, FieldOpenReason | "Not provided"> = {
  missing: "Not provided",
  conflicting: FIELD_OPEN_REASONS.conflicting,
  incomplete: FIELD_OPEN_REASONS.incomplete,
  unconfirmed: FIELD_OPEN_REASONS.inferred,
};

// A present answer's status, when it isn't settled. not_applicable is the prospect closing the field (US-2.1a);
// unknown holds no answer, so a value beside it is one they haven't confirmed.
const UNSETTLED: Record<Exclude<FieldStatus, "confirmed" | "not_applicable">, RequiredItemState> = {
  conflicting: "conflicting",
  incomplete: "incomplete",
  inferred: "unconfirmed",
  unknown: "unconfirmed",
};

const readinessItem = (key: string): ReadinessItem => {
  const found = [...REQUIRED_ITEMS, ...RECOMMENDED_ITEMS].find((item) => item.key === key);
  if (!found) throw new Error(`No readiness item ${key}`);
  return found;
};
const COMPANY = readinessItem("company_name");
const STATES = readinessItem("states");
const PAY = readinessItem("pay_frequency");
const CENSUS = readinessItem("census");

// A present field is settled when confirmed (by anyone), verified by an advisor, or without provenance:
// every AI value carries provenance, so a value with none was typed by the prospect or predates it.
function fieldState(present: boolean, field: FieldKey, provenance: ProvenanceMap, verified: ReadonlySet<string>): RequiredItemState {
  if (!present) return "missing";
  const status = provenance[field]?.status;
  if (!status || status === "confirmed" || status === "not_applicable" || verified.has(field)) return "settled";
  return UNSETTLED[status];
}

/**
 * The required items, then the recommended census, in their fixed order. Whether each is there is
 * readiness's own test. `verified` are the fields an advisor verified. The census also settles States of
 * operation when it is settled and a row names a work state; while only an unsettled census names states,
 * the states take the census's state.
 */
export function requiredItems(data: ChamberData, provenance: ProvenanceMap, verified: ReadonlySet<string>): RequiredItem[] {
  // Readiness counts States of operation as there when the list or a census row names a state; asked of
  // each source alone, the same test says which one does.
  const statesListed = !STATES.missing({ ...data, census: [] });
  const censusNamesStates = !STATES.missing({ ...data, states: [] });
  const census = fieldState(!CENSUS.missing(data), "census", provenance, verified);
  const states = fieldState(statesListed, "states", provenance, verified);
  // Unless `states` is settled, the census decides when it is settled itself, or when `states` is empty.
  const statesViaCensus = states !== "settled" && censusNamesStates && (census === "settled" || states === "missing");
  const item = (readiness: ReadinessItem, field: FieldKey, state: RequiredItemState, required: boolean): RequiredItem => ({
    item: readiness.key,
    label: readiness.label,
    field,
    required,
    state,
    readiness,
  });
  return [
    item(COMPANY, "company_name", fieldState(!COMPANY.missing(data), "company_name", provenance, verified), true),
    statesViaCensus ? { ...item(STATES, "states", census, true), viaCensus: true } : item(STATES, "states", states, true),
    item(PAY, "pay_frequency", fieldState(!PAY.missing(data), "pay_frequency", provenance, verified), true),
    item(CENSUS, "census", census, false),
  ];
}

/** Whether every required item is settled. The recommended census never holds an intake back. */
export const isIntakeComplete = (items: readonly RequiredItem[]): boolean =>
  items.every((item) => !item.required || item.state === "settled");

/**
 * What holds certification back, in order: each required item that is missing (US-1.2; the database refuses
 * it too, EA003) or in conflict. A required field whose answers conflict blocks whoever verified it and
 * whatever the census says, as the database's gate does (B-2 D26, EA008: it reads the field statuses, not
 * the advisor's reviews). States of operation that only a census in conflict gives blocks too, in the browser
 * only (B-2.2), and is named as the census. The recommended census never blocks by itself.
 */
export function certificationBlockingItems(data: ChamberData, provenance: ProvenanceMap): RequiredItem[] {
  const refused = new Set(conflictingRequired(provenance).map((item) => item.key));
  return requiredItems(data, provenance, NO_VERIFIED_FIELDS).flatMap((item): RequiredItem[] => {
    if (!item.required) return [];
    if (item.state === "missing") return [item];
    if (refused.has(item.item)) {
      const { viaCensus: _census, ...answer } = item;
      return [{ ...answer, state: "conflicting" }];
    }
    return item.state === "conflicting" && item.viaCensus ? [item] : [];
  });
}
