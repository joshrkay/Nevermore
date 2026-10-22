// Turns the model's tool arguments into the response the browser reads. Only known fields get
// through, and a status, evidence quote or correction survives only for a field that was actually
// extracted. No Deno or network imports, so it is unit-tested with the frontend suite.

import { FIELDS, FIELD_STATUSES, MAX_EVIDENCE_CHARS } from "./schema.ts";

export interface Extraction {
  extracted: Record<string, unknown>;
  field_status: Record<string, string>;
  evidence: Record<string, string>;
  corrected_fields: string[];
  reply: string | null;
}

/** What the browser gets when the model made no tool call: nothing extracted, and no reply of ours. */
export const emptyExtraction = (): Extraction => ({ extracted: {}, field_status: {}, evidence: {}, corrected_fields: [], reply: null });

// Keeps only entries for fields that were actually extracted.
function pickPerField<T>(raw: unknown, extracted: Record<string, unknown>, ok: (v: unknown) => v is T): Record<string, T> {
  const out: Record<string, T> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (k in extracted && ok(v)) out[k] = v;
  }
  return out;
}

export function shapeExtraction(args: Record<string, unknown>): Extraction {
  // Keep known fields only, without null/empty values.
  const extracted: Record<string, unknown> = {};
  for (const k of FIELDS) {
    const v = args[k];
    if (v !== null && v !== undefined && v !== "") extracted[k] = v;
  }
  const field_status = pickPerField(args.field_status, extracted, (v): v is string =>
    typeof v === "string" && FIELD_STATUSES.includes(v));
  const evidence = Object.fromEntries(
    Object.entries(pickPerField(args.evidence, extracted, (v): v is string => typeof v === "string" && v.trim() !== ""))
      .map(([k, v]) => [k, v.trim().slice(0, MAX_EVIDENCE_CHARS)]),
  );
  const corrected_fields = Array.isArray(args.corrected_fields)
    ? args.corrected_fields.filter((f: unknown): f is string => typeof f === "string" && f in extracted)
    : [];
  const reply = typeof args.reply === "string" && args.reply.trim() ? args.reply : null;
  return { extracted, field_status, evidence, corrected_fields, reply };
}
