// Turns the model's tool arguments into the response the browser reads. Only known fields get
// through, each one only if it is valid under the intake schema (_shared/intakeSchema.ts) exactly as
// the model sent it, and a status, evidence quote or correction survives only for a field that was
// extracted, or (status "unknown" and its evidence) for a field the prospect said they don't know. An evidence
// quote survives only when it is the prospect's own words from the message, and "unknown" only with such a quote that
// says they don't know (QA F4, F11). No Deno or network imports, so it is unit-tested with the frontend suite.

import { isNaicsCode } from "../_shared/naics2022.ts";
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
  /** True when the prospect asked to stop for now: Lenore's reply may then wrap up with fields still unsettled. */
  stopping: boolean;
  /**
   * Fields the model marked "unknown" without the prospect's own words saying so, which are left unsettled for Lenore to
   * ask about. For the handler's log only: never sent to the browser.
   */
  doubted_unknown: string[];
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
  stopping: false,
  doubted_unknown: [],
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

// Text compared for quoting: case, curly quotes and runs of whitespace don't matter.
const normalize = (text: string) =>
  text.toLowerCase().replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ").trim();
// What a quote may trim at its ends: spaces, punctuation and the quote marks the model wraps it in.
const EDGES = /^[\s"'.,;:!?-]+|[\s"'.,;:!?-]+$/g;

/**
 * Whether `quote` is the prospect's own words from `message`: every part of it (the model may join parts with an
 * ellipsis) appears there, ignoring case, curly quotes, whitespace and punctuation at its ends. A paraphrase isn't
 * evidence, so it is dropped, and the browser quotes the message itself for an answer it holds.
 */
export function quotesMessage(quote: string, message: string): boolean {
  const said = normalize(message);
  const parts = normalize(quote).split(/\s*(?:\.\.\.|\u2026)\s*/).map((p) => p.replace(EDGES, "")).filter(Boolean);
  return parts.length > 0 && parts.every((p) => said.includes(p));
}

// Phrases that say the prospect doesn't know or can't say yet. An "unknown" needs its quote to contain one: a message
// that simply doesn't mention a field never does (QA F4: after "Bi-weekly. We have 12 employees, all paid hourly...",
// every other field came back "unknown", so Lenore stopped asking). Whole phrases, never a bare "no", "not", "check" or
// "ask": "no contractors", "none of them salaried" and "we pay by check" are answers, not "I don't know". A phrase this
// misses only means Lenore asks again.
const NOT_KNOWN = new RegExp(
  [
    "\\b(?:don'?t|do not|didn'?t|did not) (?:really |actually )?(?:know|remember|recall)\\b",
    "\\b(?:not|never) (?:sure|certain)\\b|\\b(?:unsure|uncertain|idk|dunno|tbd)\\b",
    "\\b(?:no|not a|haven'?t a|haven'?t got a) (?:idea|clue)\\b|\\bbeats me\\b",
    "\\b(?:can'?t|cannot|couldn'?t) (?:say|tell|remember|recall)\\b|\\bforg[eo]t\\b",
    "\\bnot (?:off|from) the top of my head\\b|\\b(?:don'?t|do not) have (?:it|that|those|the \\w+) (?:handy|to hand|with me)\\b",
    "\\b(?:i'?ll|i will|let me|i'?d|i would|i need to|i have to|i'?d have to|need to|have to) (?:double[- ])?check\\b|\\bcheck with\\b",
    "\\b(?:i'?ll|i will|i'?d|i would|i need to|i have to|i'?d have to|need to|have to) ask\\b|\\bask (?:my|our|the) \\w+",
    "\\b(?:find out|look (?:it |that |them )?up|get back to you)\\b|\\b(?:haven'?t|have not|not yet) decided\\b",
  ].join("|"),
  "i",
);

/** Whether a quote says the prospect doesn't know, or can't say yet. */
export const saysNotKnown = (quote: string): boolean => NOT_KNOWN.test(normalize(quote));

/**
 * The most fields one message may mark "unknown": a section the prospect disclaims at once (workers' comp has four).
 * More is the model marking fields wholesale (QA F4: some 35 at once), and then only the field Lenore was asking about
 * keeps it. Lenore asks about the others again: the cost of a cap is a repeated question, never a field settled that the
 * prospect didn't speak to.
 */
export const MAX_UNKNOWN_PER_MESSAGE = 4;

/**
 * The model's tool arguments as the browser's response. `message` is the prospect's message the model read: evidence
 * must quote it. `asking` is the field Lenore was asking about (the first field not yet settled), which keeps its
 * "unknown" when a message marks more than MAX_UNKNOWN_PER_MESSAGE.
 */
export function shapeExtraction(args: Record<string, unknown>, message: string, asking?: string): Extraction {
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
    // Six digits the model made up are not an industry (K-1.2).
    else if (k === "naics_code" && !isNaicsCode(v)) rejected.push({ path: k, reason: "is not a 2022 NAICS code" });
    else extracted[k] = v;
  }
  // A value's status is confirmed, inferred or incomplete. "unknown" (the prospect doesn't know, D23) holds no
  // value, so it is kept only for a known field the model gave no value: a value marked unknown is a
  // contradiction, and the value keeps no status (the browser then treats it as inferred).
  // Evidence is kept only as the prospect's own words from the message (quotesMessage).
  const quoted = (v: unknown): v is string => typeof v === "string" && v.trim() !== "" && quotesMessage(v, message);
  const rawEvidence = typeof args.evidence === "object" && args.evidence !== null ? (args.evidence as Record<string, unknown>) : {};
  // "Unknown" stands only on a quote of the prospect saying so: a message that doesn't mention a field doesn't settle it.
  const field_status: Record<string, string> = {};
  const doubted_unknown: string[] = [];
  const refused = rejectedFields(rejected);
  const unknown: string[] = [];
  if (typeof args.field_status === "object" && args.field_status !== null) {
    for (const [k, v] of Object.entries(args.field_status)) {
      if (typeof v !== "string" || !FIELD_STATUSES.includes(v)) continue;
      if (k in extracted) {
        // A NAICS code is the model's proposal for the prospect to confirm, unless their message gives the code itself.
        if (k === "naics_code" && v === "confirmed" && !message.includes(String(extracted[k]))) field_status[k] = "inferred";
        else if (v !== "unknown") field_status[k] = v;
      } else if (v === "unknown" && FIELDS.includes(k) && !(k in refused)) {
        const quote = rawEvidence[k];
        if (quoted(quote) && saysNotKnown(quote)) unknown.push(k);
        else doubted_unknown.push(k);
      }
    }
  }
  // Wholesale: only the field Lenore was asking about keeps it.
  const wholesale = unknown.length > MAX_UNKNOWN_PER_MESSAGE;
  for (const k of unknown) {
    if (!wholesale || k === asking) field_status[k] = "unknown";
    else doubted_unknown.push(k);
  }
  const evidence = Object.fromEntries(
    Object.entries(pickPerField(rawEvidence, { ...extracted, ...field_status }, quoted)).map(([k, v]) => [k, v.trim().slice(0, MAX_EVIDENCE_CHARS)]),
  );
  const corrected_fields = Array.isArray(args.corrected_fields)
    ? args.corrected_fields.filter((f: unknown): f is string => typeof f === "string" && f in extracted)
    : [];
  const reply = typeof args.reply === "string" && args.reply.trim() ? args.reply : null;
  const stopping = args.prospect_stopping === true;
  return { extracted, field_status, evidence, corrected_fields, reply, rejected, prompt_version: PROMPT_VERSION, stopping, doubted_unknown };
}
