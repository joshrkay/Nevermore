// Which answers are settled and which Lenore still needs (decisions D26 and D27). One copy, used by
// chamber-extract to tell the model what to ask next and by the Chamber in the browser, so the two never
// disagree about what is left. Derived from the answers and their field statuses; nothing is stored.
// Relative imports only, so it runs under Deno and Vitest alike.

import { INTAKE_FIELDS, type IntakeFieldMeta } from "./intakeSchema.ts";

/** The field statuses of GLOSSARY.md, as the browser keeps them in field_provenance. */
export const FIELD_STATUSES = ["confirmed", "inferred", "incomplete", "conflicting", "unknown", "not_applicable"] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

export type FieldInfo = { key: string } & IntakeFieldMeta;

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/**
 * Settled (D26): the field holds an answer that isn't conflicting or incomplete (an inferred answer counts,
 * though it stays an open item until confirmed), or the prospect said they don't know it (`unknown`) or that
 * it doesn't apply (`not_applicable`). 0 and false are answers.
 */
export function isSettled(value: unknown, status: string | undefined): boolean {
  if (status === "unknown" || status === "not_applicable") return true;
  if (status === "conflicting" || status === "incomplete") return false;
  return !isEmpty(value);
}

/**
 * The fields not yet settled, most important first (rank, D25). `exclude` leaves out fields that can't be
 * answered where this is used: chat can't take the census, which comes only from an upload. With `census`,
 * states the census names count as an answer to the states question, as they do for readiness.
 */
export function unsettledFields(
  answers: Record<string, unknown>,
  statuses: Record<string, string | undefined>,
  opts: { exclude?: ReadonlySet<string>; census?: CensusSummary } = {},
): FieldInfo[] {
  return INTAKE_FIELDS.filter((f) => {
    if (opts.exclude?.has(f.key)) return false;
    const status = statuses[f.key];
    // The census answers the states question when B-2.2's rule says it does (it names work states and is settled,
    // or nothing else names states), unless that answer is itself in conflict or incomplete.
    if (f.key === "states" && opts.census?.workStates && isReadyState(requiredItemStates(answers, statuses, opts.census).states)) return false;
    return !isSettled(answers[f.key], status);
  });
}

/**
 * The answers certification requires (D2, US-1.2): what the Reckoning and the database enforce. src/data/readiness.ts
 * REQUIRED_ITEMS holds the same keys (readiness.test.ts checks).
 */
export const CERTIFICATION_REQUIRED = ["company_name", "states", "pay_frequency"] as const;

/** What a call knows of the census without its rows: how many, and whether any names a work state. */
export interface CensusSummary {
  rows: number;
  workStates: boolean;
}

export type RequiredItemState = "missing" | "conflicting" | "incomplete" | "unconfirmed" | "settled";

const hasText = (v: unknown) => typeof v === "string" && v.trim() !== "";

/**
 * Where each required answer stands, by B-2.2's rule (src/data/requiredItems.ts, public.intake_required_items): a
 * present answer is settled when it has no provenance or is confirmed, not applicable or verified by an advisor;
 * inferred or unknown is unconfirmed; incomplete and conflicting are themselves. States of operation is settled by
 * `states`, or by a settled census that names work states; while only the census names states, it takes the
 * census's state, so a census in conflict holds it back too. A required answer whose own status is conflicting stays
 * in conflict, verified or not, as the gate has it. Pass `verified` where it is known (the browser).
 */
export function requiredItemStates(
  answers: Record<string, unknown>,
  statuses: Record<string, string | undefined>,
  census: CensusSummary = { rows: 0, workStates: false },
  verified: ReadonlySet<string> = new Set(),
): Record<(typeof CERTIFICATION_REQUIRED)[number], RequiredItemState> {
  const state = (present: boolean, field: string): RequiredItemState => {
    if (!present) return "missing";
    const status = statuses[field];
    // A status that isn't one counts as no provenance, as the browser reads stored provenance.
    if (!status || !(FIELD_STATUSES as readonly string[]).includes(status)) return "settled";
    if (status === "confirmed" || status === "not_applicable" || verified.has(field)) return "settled";
    if (status === "inferred" || status === "unknown") return "unconfirmed";
    return status as RequiredItemState;
  };
  const statesListed = Array.isArray(answers.states) && answers.states.some(hasText);
  const statesState = state(statesListed, "states");
  const censusState = state(census.rows > 0, "census");
  const statesViaCensus = statesState !== "settled" && census.workStates && (censusState === "settled" || statesState === "missing");
  // A required answer whose own status is `conflicting` stays in conflict whoever verified it and whatever the census
  // says: the gate reads the field statuses, not the advisor's reviews (EA008; certificationBlockingItems).
  const refused = (key: (typeof CERTIFICATION_REQUIRED)[number], item: RequiredItemState): RequiredItemState =>
    item !== "missing" && statuses[key] === "conflicting" ? "conflicting" : item;
  return {
    company_name: refused("company_name", state(hasText(answers.company_name), "company_name")),
    states: refused("states", statesViaCensus ? censusState : statesState),
    pay_frequency: refused("pay_frequency", state(hasText(answers.pay_frequency), "pay_frequency")),
  };
}

/** Whether a required item lets the intake be ready to certify: given, and not in conflict or incomplete. */
export const isReadyState = (state: RequiredItemState): boolean => state === "settled" || state === "unconfirmed";

/**
 * Ready to certify (GLOSSARY.md, D26 as certification decides it, D2): every answer certification requires is
 * there and none is in conflict (what the gate refuses, EA003 and EA008) or incomplete. "Unknown" or "doesn't apply"
 * can't stand in for an answer, because certification needs the answer itself. One rule with the gate: the item
 * states are B-2.2's (requiredItemStates).
 */
export function readyToCertify(
  answers: Record<string, unknown>,
  statuses: Record<string, string | undefined>,
  census: CensusSummary = { rows: 0, workStates: false },
  verified: ReadonlySet<string> = new Set(),
): boolean {
  return Object.values(requiredItemStates(answers, statuses, census, verified)).every(isReadyState);
}
