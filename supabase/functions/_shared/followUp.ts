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
    if (f.key === "states" && opts.census?.workStates && status !== "conflicting" && status !== "incomplete") return false;
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

/**
 * Ready to certify (GLOSSARY.md, D26 as certification decides it, D2): every answer certification requires holds an
 * answer that isn't in conflict or incomplete. "Unknown" or "doesn't apply" can't stand in for one, because
 * certification needs the answer itself. States count as answered when the census names work states, as the
 * Reckoning counts them.
 */
export function readyToCertify(
  answers: Record<string, unknown>,
  statuses: Record<string, string | undefined>,
  census: CensusSummary = { rows: 0, workStates: false },
): boolean {
  return CERTIFICATION_REQUIRED.every((key) => {
    const status = statuses[key];
    if (status === "conflicting" || status === "incomplete") return false;
    if (key === "states" && census.workStates && !(status === "unknown" || status === "not_applicable")) return true;
    return !isEmpty(answers[key]) && status !== "unknown" && status !== "not_applicable";
  });
}
