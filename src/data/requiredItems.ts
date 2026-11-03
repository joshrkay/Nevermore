import type { ChamberData } from "./chamberTypes";
import { FIELD_OPEN_REASONS, type FieldKey, type FieldOpenReason, type FieldStatus, type ProvenanceMap } from "./provenance";

// The four items every intake must hold (decision D2), and how far along each one is. The database's
// public.intake_required_items (migration 20261103110000) is the definition, and the advisor queue's
// "missing required" reads it; this mirrors it for the Chamber, the Manuscript and certification.
// requiredItems.cases.json holds the cases both sides are tested against, so they can't drift apart.

export const REQUIRED_ITEMS = [
  { item: "company_legal_name", label: "Company legal name", field: "company_name" },
  { item: "states_of_operation", label: "States of operation", field: "states" },
  { item: "pay_frequency", label: "Pay frequency", field: "pay_frequency" },
  { item: "employee_census", label: "Employee census", field: "census" },
] as const satisfies readonly { item: string; label: string; field: FieldKey }[];

export type RequiredItemId = (typeof REQUIRED_ITEMS)[number]["item"];
type RequiredField = (typeof REQUIRED_ITEMS)[number]["field"];

/** "unconfirmed" is an inferred field. A settled item needs nothing more from the prospect. */
export type RequiredItemState = "missing" | "conflicting" | "incomplete" | "unconfirmed" | "settled";

export interface RequiredItem {
  item: RequiredItemId;
  label: string;
  field: FieldKey;
  state: RequiredItemState;
  /**
   * States of operation only: `states` names no state, so the census's work states and the census's
   * state decide it. The Employee census item says the same, so lists name that one instead.
   */
  viaCensus?: true;
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

const UNSETTLED: Record<Exclude<FieldStatus, "confirmed">, RequiredItemState> = {
  conflicting: "conflicting",
  incomplete: "incomplete",
  inferred: "unconfirmed",
};

const hasText = (v: unknown) => typeof v === "string" && v.trim() !== "";

// A present field is settled when confirmed (by anyone), verified by an advisor, or without provenance:
// every AI value carries provenance, so a value with none was typed by the prospect or predates it.
function fieldState(present: boolean, field: FieldKey, provenance: ProvenanceMap, verified: ReadonlySet<string>): RequiredItemState {
  if (!present) return "missing";
  const status = provenance[field]?.status;
  if (!status || status === "confirmed" || verified.has(field)) return "settled";
  return UNSETTLED[status];
}

/**
 * The required items in their fixed order. `verified` are the fields an advisor verified. The census
 * also settles States of operation when it is settled and a row names a work state; while only an
 * unsettled census names states, the states take the census's state.
 */
export function requiredItems(data: ChamberData, provenance: ProvenanceMap, verified: ReadonlySet<string>): RequiredItem[] {
  const census = fieldState(data.census.length > 0, "census", provenance, verified);
  const states = fieldState(data.states.some(hasText), "states", provenance, verified);
  const censusNamesStates = data.census.some((e) => hasText(e.work_state));
  // Unless `states` is settled, the census decides when it is settled itself, or when `states` is empty.
  const statesViaCensus = states !== "settled" && censusNamesStates && (census === "settled" || states === "missing");
  const state: Record<RequiredField, RequiredItemState> = {
    company_name: fieldState(hasText(data.company_name), "company_name", provenance, verified),
    states: statesViaCensus ? census : states,
    pay_frequency: fieldState(hasText(data.pay_frequency), "pay_frequency", provenance, verified),
    census,
  };
  return REQUIRED_ITEMS.map(({ item, label, field }): RequiredItem =>
    field === "states" && statesViaCensus
      ? { item, label, field, state: state[field], viaCensus: true }
      : { item, label, field, state: state[field] },
  );
}
