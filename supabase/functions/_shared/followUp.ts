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
 * answered where this is used: chat can't take the census, which comes only from an upload.
 */
export function unsettledFields(
  answers: Record<string, unknown>,
  statuses: Record<string, string | undefined>,
  opts: { exclude?: ReadonlySet<string> } = {},
): FieldInfo[] {
  return INTAKE_FIELDS.filter((f) => !opts.exclude?.has(f.key) && !isSettled(answers[f.key], statuses[f.key]));
}
