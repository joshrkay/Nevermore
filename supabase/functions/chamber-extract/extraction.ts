// Turns the model's tool arguments into the response the browser reads. Only known fields get
// through, each one only if it is valid under the intake schema (_shared/intakeSchema.ts) exactly as
// the model sent it, and a status, evidence quote or correction survives only for a field that was
// extracted, or (status "unknown" and its evidence) for a field the prospect said they don't know. No Deno or network imports, so it is unit-tested with the frontend suite.

import { type IntakeIssue, validateIntakeField } from "../_shared/intakeSchema.ts";
import { FIELDS, FIELD_STATUSES, MAX_EVIDENCE_CHARS, PROMPT_VERSION } from "./schema.ts";

export interface Extraction {
  extracted: Record<string, unknown>;
  field_status: Record<string, string>;
  evidence: Record<string, string>;
  corrected_fields: string[];
  reply: string | null;
  /** Fields the model sent that the intake schema refuses, by path and reason (never the value). */
  rejected: IntakeIssue[];
  /** The contract this answer was produced under (PROMPT_VERSION), which the browser stores with each value. */
  prompt_version: number;
}

/** What the browser gets when the model made no tool call: nothing extracted, and no reply of ours. */
export const emptyExtraction = (): Extraction => ({
  extracted: {},
  field_status: {},
  evidence: {},
  corrected_fields: [],
  reply: null,
  rejected: [],
  prompt_version: PROMPT_VERSION,
});

// Keeps only entries for the fields in `keep` (those extracted, or with a status).
function pickPerField<T>(raw: unknown, keep: Record<string, unknown>, ok: (v: unknown) => v is T): Record<string, T> {
  const out: Record<string, T> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (k in keep && ok(v)) out[k] = v;
  }
  return out;
}

// The top-level fields with a refused value: a refused answer isn't "unknown" either.
const rejectedFields = (issues: IntakeIssue[]): Record<string, true> =>
  Object.fromEntries(issues.map((issue) => [issue.path.split(/[.[]/)[0], true as const]));

export function shapeExtraction(args: Record<string, unknown>): Extraction {
  // Keep known fields only, without null/empty values, and only values the schema accepts as sent: a
  // value is not repaired (no trimming, upper-casing or splitting), so the browser never receives an
  // answer the database would refuse, and what was refused is reported rather than guessed at.
  const extracted: Record<string, unknown> = {};
  const rejected: IntakeIssue[] = [];
  for (const k of FIELDS) {
    const v = args[k];
    if (v === null || v === undefined || v === "") continue;
    const issues = validateIntakeField(k, v);
    if (issues.length > 0) rejected.push(...issues);
    else extracted[k] = v;
  }
  // A value's status is confirmed, inferred or incomplete. "unknown" (the prospect doesn't know, D23) holds no
  // value, so it is kept only for a known field the model gave no value: a value marked unknown is a
  // contradiction, and the value keeps no status (the browser then treats it as inferred).
  const field_status: Record<string, string> = {};
  const refused = rejectedFields(rejected);
  if (typeof args.field_status === "object" && args.field_status !== null) {
    for (const [k, v] of Object.entries(args.field_status)) {
      if (typeof v !== "string" || !FIELD_STATUSES.includes(v)) continue;
      if (k in extracted ? v !== "unknown" : v === "unknown" && FIELDS.includes(k) && !(k in refused)) field_status[k] = v;
    }
  }
  const evidence = Object.fromEntries(
    Object.entries(pickPerField(args.evidence, { ...extracted, ...field_status }, (v): v is string => typeof v === "string" && v.trim() !== ""))
      .map(([k, v]) => [k, v.trim().slice(0, MAX_EVIDENCE_CHARS)]),
  );
  const corrected_fields = Array.isArray(args.corrected_fields)
    ? args.corrected_fields.filter((f: unknown): f is string => typeof f === "string" && f in extracted)
    : [];
  const reply = typeof args.reply === "string" && args.reply.trim() ? args.reply : null;
  return { extracted, field_status, evidence, corrected_fields, reply, rejected, prompt_version: PROMPT_VERSION };
}
