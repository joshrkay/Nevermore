import { z } from "zod";
import type { ChamberData } from "./chamberTypes";
import { sanitizeChamberPatch } from "./chamberValidation";
import { INTAKE_FIELDS, INTAKE_SCHEMA } from "./intakeSchema";
import { isRequiredField } from "./readiness";
import { redactSensitive } from "./sensitive";
import { CERTIFICATION_REQUIRED } from "../../supabase/functions/_shared/followUp.ts";

// Every captured field records how sure we are of it and where it came from, so the
// prospect and advisor can tell what Lenore inferred from what someone confirmed.
// Kept beside ChamberData (keyed by field) rather than inside it so existing readers
// of the flat data don't change.

export type FieldKey = keyof ChamberData;

// The field statuses of GLOSSARY.md. `unknown` (the prospect doesn't know yet) and `not_applicable` (the
// field doesn't apply to them) hold no answer (D23); only the prospect marks a field not applicable (D31).
export const FIELD_STATUSES = ["confirmed", "inferred", "incomplete", "conflicting", "unknown", "not_applicable"] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

/** Statuses the extraction model may assign; only a disagreement makes a field conflicting. */
export type ExtractedStatus = "confirmed" | "inferred" | "incomplete";

export type FieldSource =
  // prompt_version is chamber-extract's PROMPT_VERSION (a positive integer, as ai_extraction_events records
  // it) for a chat extraction. Voice extractions, whose
  // prompt lives in the ElevenLabs agent, and entries saved before versioning have none.
  | { kind: "transcript"; message_id: string; quote?: string; prompt_version?: number }
  // A value the prospect applied from an uploaded document (document-extract's candidates).
  | { kind: "document"; document_id: string; document_name?: string; location?: string }
  | { kind: "prospect_edit" };

export interface FieldCandidate {
  value: unknown;
  source: FieldSource;
}

export interface FieldProvenance {
  status: FieldStatus;
  source: FieldSource;
  updated_at: string; // ISO timestamp
  /** The competing values, present only while the field is conflicting. */
  candidates?: FieldCandidate[];
  /**
   * Values a source gave that the field doesn't hold: one it outranked, or one that replaced it.
   * Newest last, one per value, never the field's own value, at most MAX_ALSO_HEARD. A note only:
   * it never changes the status, and the prospect confirming, editing or resolving the field clears it.
   */
  also_heard?: FieldCandidate[];
}

export type ProvenanceMap = Partial<Record<FieldKey, FieldProvenance>>;

export interface IntakeState {
  data: ChamberData;
  provenance: ProvenanceMap;
}

/**
 * Each field's label, from the intake schema (supabase/functions/_shared/intakeSchema.ts), in the order the
 * schema lists the fields (grouped as the workspace groups them), not rank order: lists built from it,
 * such as the advisor's field review, keep their order.
 */
const LABEL_BY_KEY = new Map(INTAKE_FIELDS.map((f) => [f.key, f.label]));
export const FIELD_LABELS = Object.fromEntries(
  Object.keys(INTAKE_SCHEMA.properties as object).map((key) => [key, LABEL_BY_KEY.get(key)!]),
) as Record<FieldKey, string>;

export type FieldKind = "text" | "number" | "decimal" | "boolean" | "list";

/** Input kind per field, for editing. The census has its own tab and isn't edited here. */
export const FIELD_KINDS: Record<Exclude<FieldKey, "census">, FieldKind> = {
  company_name: "text",
  industry: "text",
  hq_state: "text",
  states: "list",
  employee_count: "number",
  start_month: "text",
  multiple_entities: "boolean",
  fein_count: "number",
  virgin_medical: "boolean",
  current_carrier: "text",
  renewal_date: "text",
  rate_history: "text",
  benefits_waiting_period: "text",
  ancillary_benefits: "list",
  has_401k: "boolean",
  retirement_type: "text",
  employer_contributes: "boolean",
  payroll_vendor: "text",
  pay_frequency: "text",
  funding_days: "number",
  has_nonexempt: "boolean",
  nonexempt_count: "number",
  exempt_count: "number",
  pto_types: "list",
  accrual_method: "text",
  has_handbook: "boolean",
  handbook_last_updated: "text",
  hr_staff_count: "number",
  has_1099: "boolean",
  ca_contractors: "boolean",
  uses_physical_clocks: "boolean",
  uses_mobile_app: "boolean",
  uses_computer_timekeeping: "boolean",
  shift_differentials: "boolean",
  hris_system: "text",
  key_challenges: "text",
  business_goals: "text",
  wc_carrier: "text",
  wc_renewal_date: "text",
  wc_experience_mod: "decimal",
  wc_annual_premium: "number",
};

const FIELD_KEYS = Object.keys(FIELD_LABELS) as FieldKey[];
const isFieldKey = (k: unknown): k is FieldKey => typeof k === "string" && k in FIELD_LABELS;

const MAX_QUOTE_CHARS = 200;
// A cut between the halves of an emoji leaves a lone high surrogate, which Postgres jsonb
// refuses; the whole field_provenance is resent on every save, so one bad quote would fail them all.
const clip = (s: string) =>
  s.length > MAX_QUOTE_CHARS ? `${s.slice(0, MAX_QUOTE_CHARS - 1).replace(/[\uD800-\uDBFF]$/, "")}…` : s;

const MAX_ALSO_HEARD = 5;

// chamber-extract's PROMPT_VERSION: a positive integer, the smallint ai_extraction_events stores.
const promptVersionSchema = z.number().int().positive().max(32767);

// ---------- Comparing values ----------

export const isEmpty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

const contains = (list: unknown[], items: unknown[]) => items.every((i) => list.some((l) => same(l, i)));

// The intake's lists are sets (states, benefits, PTO types), so the same entries in another order
// are the same value.
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return contains(a, b) && contains(b, a);
  return JSON.stringify(a) === JSON.stringify(b);
}

// A list that adds entries and drops none ("also Texas") extends the old one rather than contradicting it.
function extendsList(prev: unknown, next: unknown): boolean {
  return Array.isArray(prev) && Array.isArray(next) && contains(next, prev) && !contains(prev, next);
}

// ---------- Parsing stored provenance ----------

// public.provenance_entry_status (migration 20261103110000) keeps and drops the same entries, so the
// database's required items read provenance as the browser does; change both together
// (src/data/requiredItems.cases.json tests them against each other).

const sourceSchema: z.ZodType<FieldSource, z.ZodTypeDef, unknown> = z.union([
  z.object({
    kind: z.literal("transcript"),
    message_id: z.string().min(1),
    quote: z.string().max(MAX_QUOTE_CHARS).optional(),
    // Only a label for tracing, so a malformed one is dropped rather than losing the whole entry.
    prompt_version: promptVersionSchema.optional().catch(undefined),
  }),
  z.object({
    kind: z.literal("document"),
    document_id: z.string().min(1),
    document_name: z.string().optional(),
    location: z.string().optional(),
  }),
  z.object({ kind: z.literal("prospect_edit") }),
]) as unknown as z.ZodType<FieldSource, z.ZodTypeDef, unknown>;

const candidateSchema = z.object({ value: z.unknown(), source: sourceSchema });
const heardSchema = candidateSchema.refine((c) => !isEmpty(c.value));

const provenanceSchema = z.object({
  status: z.enum(FIELD_STATUSES),
  source: sourceSchema,
  updated_at: z.string(),
  candidates: z.array(candidateSchema).optional(),
  // Only notes, so a malformed one is dropped rather than losing the whole entry.
  also_heard: z
    .array(z.unknown())
    .transform((entries) => {
      const kept = entries.flatMap((e) => {
        const parsed = heardSchema.safeParse(e);
        return parsed.success ? [parsed.data as FieldCandidate] : [];
      });
      return kept.length > 0 ? kept.slice(-MAX_ALSO_HEARD) : undefined;
    })
    .optional()
    .catch(undefined),
}) as unknown as z.ZodType<FieldProvenance, z.ZodTypeDef, unknown>;

/**
 * Rebuilds a provenance map from a stored jsonb column, dropping malformed entries. The census was
 * keyed `employees` before the census contract; that entry is read as `census`.
 */
export function parseProvenance(raw: unknown): ProvenanceMap {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const map: ProvenanceMap = {};
  for (const [stored, value] of Object.entries(raw)) {
    const key = stored === "employees" && !("census" in raw) ? "census" : stored;
    if (!isFieldKey(key)) continue;
    const result = provenanceSchema.safeParse(value);
    if (result.success) map[key] = result.data;
  }
  return map;
}

/**
 * Whether an advisor's verification settles an answer in this status for what the prospect and the Manuscript
 * show: one that still needs the prospect (inferred, incomplete, in conflict). A confirmed answer is already
 * settled, and unknown or not applicable hold no answer, so they keep their status. A REQUIRED answer in conflict
 * is never settled this way: certification (D26, EA008) reads the field's status, not the advisor's review, so
 * it still blocks and the prospect still has to choose one answer. The open-items list, the required-items rule
 * and the advisor's own packet (`applyAdvisorReview`) settle every status instead.
 */
export const verificationSettles = (status: FieldStatus | undefined, required = false): boolean =>
  status === "inferred" || status === "incomplete" || (status === "conflicting" && !required);

/**
 * The also-heard notes worth showing: those that aren't already one of a conflict's rival answers, when those
 * are listed beside them. `candidatesShown` is false where the rival answers are hidden (a conflict an advisor
 * verified), so a note repeating one still has somewhere to be seen.
 */
export function visibleAlsoHeard(entry: FieldProvenance, candidatesShown = true): FieldCandidate[] {
  const notes = entry.also_heard ?? [];
  return candidatesShown ? notes.filter((heard) => !entry.candidates?.some((c) => same(c.value, heard.value))) : notes;
}

// ---------- Merging extractions ----------

// Which source stands when two disagree: the prospect's own answer, then a document they applied,
// then the conversation. The value that loses is kept on the field as also_heard.
const RANK: Record<FieldSource["kind"], number> = { prospect_edit: 3, document: 2, transcript: 1 };

// The rank a field holds: its source's, or while it is conflicting, its highest candidate's.
const fieldRank = (entry: FieldProvenance) =>
  Math.max(RANK[entry.source.kind], ...(entry.status === "conflicting" ? (entry.candidates ?? []) : []).map((c) => RANK[c.source.kind]));

/** Whether a different value from this kind of source replaces the field's, rather than conflicting or only being noted. */
export const outranks = (kind: FieldSource["kind"], entry: FieldProvenance) => RANK[kind] > fieldRank(entry);

/** A field's also_heard with `heard` added: newest last, one entry per value, never `current`. */
function noteHeard(notes: FieldCandidate[] | undefined, heard: FieldCandidate[], current: unknown): FieldCandidate[] | undefined {
  let next = notes ?? [];
  for (const h of heard) {
    // A value heard again moves to the end, keeping the higher-ranked of the sources that gave it.
    const earlier = next.find((n) => same(n.value, h.value));
    const kept = earlier && RANK[earlier.source.kind] > RANK[h.source.kind] ? earlier : h;
    next = [...next.filter((n) => !same(n.value, h.value)), kept];
  }
  next = next.filter((n) => !same(n.value, current)).slice(-MAX_ALSO_HEARD);
  return next.length > 0 ? next : undefined;
}

const withNotes = (entry: FieldProvenance, notes: FieldCandidate[] | undefined): FieldProvenance => {
  const { also_heard: _replaced, ...rest } = entry;
  return notes ? { ...rest, also_heard: notes } : rest;
};

// What a field holds: the competing values while it is conflicting, otherwise its value.
const heldValues = (entry: FieldProvenance, value: unknown): FieldCandidate[] =>
  entry.status === "conflicting" && entry.candidates?.length ? entry.candidates : [{ value, source: entry.source }];

export interface ExtractionOptions {
  source: FieldSource;
  /** Model-assigned status per field; defaults to "inferred". */
  statuses?: Partial<Record<FieldKey, ExtractedStatus>>;
  /** Short supporting quote per field; overrides the source's own quote. */
  evidence?: Partial<Record<FieldKey, string>>;
  /** Fields the prospect explicitly corrected, which replace rather than conflict. */
  corrections?: FieldKey[];
  /**
   * Fields the prospect said they don't know (the model's "unknown", D23, D31). They hold no answer: one is
   * marked unknown only while it has none, and never over the prospect's own edit or "Doesn't apply".
   */
  unknown?: FieldKey[];
  now?: Date;
}

/**
 * Applies an untrusted AI patch (chat, voice, or a document the prospect applied). A prospect's own
 * edit is never overwritten. Otherwise, when values disagree, the higher-ranked source (RANK) stands
 * and the other is noted in also_heard; two values from sources of the same rank are kept as a
 * conflict for the prospect to settle. An explicit correction and a list that only adds entries
 * replace the value instead.
 */
export function applyExtraction(state: IntakeState, raw: unknown, opts: ExtractionOptions): IntakeState {
  const patch = sanitizeChamberPatch(raw);
  const data = { ...state.data };
  const provenance = { ...state.provenance };
  const updated_at = (opts.now ?? new Date()).toISOString();

  for (const field of Object.keys(patch) as FieldKey[]) {
    const value = patch[field];
    if (isEmpty(value)) continue;
    const quote = opts.evidence?.[field];
    const source: FieldSource =
      quote && opts.source.kind === "transcript" ? { ...opts.source, quote: clip(quote) } : opts.source;
    const status: ExtractedStatus = opts.statuses?.[field] ?? "inferred";
    const prev = provenance[field];
    const prevValue = data[field];

    if (prev?.source.kind === "prospect_edit") continue;
    // Only the prospect marks a field not applicable, and only they can take it back.
    if (prev?.status === "not_applicable") continue;

    // The field takes the incoming value; `displaced` are the values it held that are noted.
    const take = (takenStatus: FieldStatus, displaced: FieldCandidate[] = []) => {
      (data as Record<FieldKey, unknown>)[field] = value;
      provenance[field] = withNotes({ status: takenStatus, source, updated_at }, noteHeard(prev?.also_heard, displaced, value));
    };

    if (
      !prev || // nothing recorded yet (or a session saved before provenance existed)
      isEmpty(prevValue) ||
      field === "census" // the roster is rebuilt as it grows; documents merge it in documentCandidates.ts
    ) {
      take(status);
      continue;
    }

    const rank = RANK[source.kind];
    const heldRank = fieldRank(prev);
    const conflicting = prev.status === "conflicting";
    const held = heldValues(prev, prevValue);

    if (!conflicting && same(prevValue, value)) {
      // Hearing the same value again (a list in any order) can raise confidence, never lower it,
      // and never trades the source for a lower-ranked one. The stored value is kept as it is.
      const keep = prev.status === "confirmed" && status !== "confirmed";
      provenance[field] = withNotes(
        { status: keep ? prev.status : status, source: rank < heldRank ? prev.source : source, updated_at },
        noteHeard(prev.also_heard, [], value),
      );
      continue;
    }

    if (opts.corrections?.includes(field)) {
      // The prospect corrected it in chat. A value from another kind of source is noted; one from
      // the same kind is what they corrected.
      take(status, held.filter((c) => c.source.kind !== source.kind));
      continue;
    }

    if (extendsList(prevValue, value)) {
      // Extended by a lower-ranked source, the prospect confirms the whole list again.
      take(rank < heldRank ? "inferred" : status, held.filter((c) => !extendsList(c.value, value)));
      continue;
    }

    if (rank > heldRank) {
      take(status, held);
      continue;
    }

    if (held.some((c) => same(c.value, value))) continue; // already one of the competing values

    if (rank < heldRank) {
      provenance[field] = withNotes({ ...prev, updated_at }, noteHeard(prev.also_heard, [{ value, source }], prevValue));
      continue;
    }

    provenance[field] = withNotes(
      { status: "conflicting", source: prev.source, updated_at, candidates: [...held, { value, source }] },
      noteHeard(prev.also_heard, [], prevValue),
    );
  }

  for (const field of opts.unknown ?? []) {
    if (field in patch) continue; // an answer in the same message wins
    const prev = provenance[field];
    if (prev?.source.kind === "prospect_edit" || prev?.status === "not_applicable") continue;
    // An answer already given stands: "I don't know" about it is for the prospect to settle in Review.
    if (!isEmpty(data[field])) continue;
    const quote = opts.evidence?.[field];
    const source: FieldSource =
      quote && opts.source.kind === "transcript" ? { ...opts.source, quote: clip(quote) } : opts.source;
    provenance[field] = { status: "unknown", source, updated_at };
  }

  return { data, provenance };
}

// ---------- Prospect actions ----------

export type FieldAction =
  | { type: "confirm"; field: FieldKey }
  | { type: "edit"; field: FieldKey; value: unknown }
  | { type: "resolve"; field: FieldKey; candidate: number }
  // "Doesn't apply" (D31): only the prospect closes a field this way, and can take it back with "reopen".
  | { type: "not_applicable"; field: FieldKey }
  | { type: "reopen"; field: FieldKey };

/**
 * Whether the prospect may mark a field "Doesn't apply": a field they haven't answered that certification doesn't
 * need. A required answer is needed whatever the business, and the census is a document.
 */
export const canMarkNotApplicable = (field: FieldKey, data: ChamberData): boolean =>
  field !== "census" && !(CERTIFICATION_REQUIRED as readonly string[]).includes(field) && isEmpty(data[field]);

/** Applies a prospect's confirm, edit, or conflict resolution. Invalid edits change nothing. */
export function applyFieldAction(state: IntakeState, action: FieldAction, now = new Date()): IntakeState {
  const confirmed = (): FieldProvenance => ({ status: "confirmed", source: { kind: "prospect_edit" }, updated_at: now.toISOString() });
  const { field } = action;

  if (action.type === "confirm") {
    if (state.provenance[field]?.status === "conflicting") return state; // must pick a value first
    if (isEmpty(state.data[field])) return state; // nothing to confirm (an unknown or not applicable field holds no answer)
    return { data: state.data, provenance: { ...state.provenance, [field]: confirmed() } };
  }

  if (action.type === "not_applicable") {
    if (!canMarkNotApplicable(field, state.data)) return state;
    return {
      data: state.data,
      provenance: { ...state.provenance, [field]: { status: "not_applicable", source: { kind: "prospect_edit" }, updated_at: now.toISOString() } },
    };
  }

  if (action.type === "reopen") {
    if (state.provenance[field]?.status !== "not_applicable") return state;
    const { [field]: _closed, ...rest } = state.provenance;
    return { data: state.data, provenance: rest };
  }

  const value = action.type === "edit" ? action.value : state.provenance[field]?.candidates?.[action.candidate]?.value;
  if (action.type === "resolve" && value === undefined) return state;
  const patch = sanitizeChamberPatch({ [field]: value });
  if (!(field in patch)) return state;
  return {
    data: { ...state.data, [field]: patch[field] },
    provenance: { ...state.provenance, [field]: confirmed() },
  };
}

/**
 * The prospect choosing a sourced value over the field's (a document's, in the Upload tab's
 * conflict dialog), recorded as confirmed with that source. Like a correction, it replaces
 * whatever the field held, their own answer included, and a replaced value from another kind of
 * source is noted in also_heard. Invalid values change nothing.
 */
export function applyChosenValue(state: IntakeState, field: FieldKey, raw: unknown, source: FieldSource, now = new Date()): IntakeState {
  const patch = sanitizeChamberPatch({ [field]: raw });
  if (!(field in patch)) return state;
  const value = patch[field];
  const prev = state.provenance[field];
  const prevValue = state.data[field];
  // The census isn't ranked, so a replaced roster isn't noted (as in applyExtraction).
  const displaced =
    prev && field !== "census" && !isEmpty(prevValue) ? heldValues(prev, prevValue).filter((c) => c.source.kind !== source.kind) : [];
  return {
    data: { ...state.data, [field]: value },
    provenance: {
      ...state.provenance,
      [field]: withNotes({ status: "confirmed", source, updated_at: now.toISOString() }, noteHeard(prev?.also_heard, displaced, value)),
    },
  };
}

// ---------- Open items ----------

export type FieldOpenReason = "Conflicting answers" | "Incomplete" | "Prospect to provide" | "Please confirm";

export interface FieldOpenItem {
  field: FieldKey;
  label: string;
  reason: FieldOpenReason;
}

/**
 * The statuses that leave a field open, most pressing first. The advisor queue counts the same ones
 * (`open_item_statuses` in its migration; src/data/schemaSync.test.ts compares them).
 */
export const OPEN_FIELD_STATUSES = ["conflicting", "incomplete", "unknown", "inferred"] as const satisfies readonly FieldStatus[];

/** What the prospect is told about a field in each status that still needs them. */
export const FIELD_OPEN_REASONS: Record<Exclude<FieldStatus, "confirmed" | "not_applicable">, FieldOpenReason> = {
  conflicting: "Conflicting answers",
  incomplete: "Incomplete",
  unknown: "Prospect to provide",
  inferred: "Please confirm",
};

/**
 * Fields that still need the prospect: conflicts first, then incomplete, then unknown, then inferred.
 * A field marked not applicable is closed and never listed, and a field in `verified` (an advisor
 * verified it) is settled, so it is left out too, except a required answer in conflict: it still has to be
 * chosen (`verificationSettles`), and the Manuscript would otherwise mark it unresolved with nothing to point to.
 */
export function fieldOpenItems(provenance: ProvenanceMap, verified: ReadonlySet<string> = new Set()): FieldOpenItem[] {
  return OPEN_FIELD_STATUSES.flatMap((status) =>
    FIELD_KEYS.filter((f) => provenance[f]?.status === status && !(verified.has(f) && !(status === "conflicting" && isRequiredField(f)))).map((field) => ({
      field,
      label: FIELD_LABELS[field],
      reason: FIELD_OPEN_REASONS[status],
    })),
  );
}

// ---------- Display ----------

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object")) return value.join(", ");
    return `${value.length} entr${value.length === 1 ? "y" : "ies"}`;
  }
  return String(value);
}

export function describeSource(source: FieldSource): string {
  switch (source.kind) {
    case "transcript":
      return source.quote ? `From the conversation: “${source.quote}”` : "From the conversation";
    case "document":
      return `From document ${source.document_name ?? source.document_id}${source.location ? ` (${source.location})` : ""}`;
    case "prospect_edit":
      return "Entered or confirmed by the prospect";
  }
}

export const STATUS_LABELS: Record<FieldStatus, string> = {
  confirmed: "Confirmed",
  inferred: "Inferred",
  incomplete: "Incomplete",
  conflicting: "Conflicting",
  unknown: "Not known yet",
  not_applicable: "Doesn't apply",
};

/** Parses the model's per-field status map, ignoring unknown fields and statuses. */
export function parseExtractedStatuses(raw: unknown): Partial<Record<FieldKey, ExtractedStatus>> {
  const out: Partial<Record<FieldKey, ExtractedStatus>> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (isFieldKey(k) && (v === "confirmed" || v === "inferred" || v === "incomplete")) out[k] = v;
  }
  return out;
}

/** The fields the model marked "unknown": the prospect said they don't know them. The census is never one. */
export function parseUnknownFields(raw: unknown): FieldKey[] {
  if (typeof raw !== "object" || raw === null) return [];
  return Object.entries(raw).flatMap(([k, v]) => (isFieldKey(k) && k !== "census" && v === "unknown" ? [k] : []));
}

/** Parses the model's per-field evidence quotes. */
export function parseEvidence(raw: unknown): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (isFieldKey(k) && typeof v === "string" && v.trim()) out[k] = clip(redactSensitive(v.trim()));
  }
  return out;
}

export function parseFieldList(raw: unknown): FieldKey[] {
  return Array.isArray(raw) ? raw.filter(isFieldKey) : [];
}

/**
 * Extraction options for a reply to a transcript message. `meta` carries the model's
 * optional field_status, evidence and corrected_fields, and chamber-extract's prompt_version;
 * the message text is the fallback quote for fields with no evidence of their own.
 */
export function transcriptExtraction(message: { id: string; text: string; spoken?: boolean }, meta: unknown): ExtractionOptions {
  const m = (typeof meta === "object" && meta !== null ? meta : {}) as Record<string, unknown>;
  const statuses = parseExtractedStatuses(m.field_status);
  const unknown = parseUnknownFields(m.field_status);
  // Speech-to-text mishears ("fifteen" as 50), so a spoken answer is at most inferred until the prospect
  // confirms it in Review or types it (D33).
  if (message.spoken) {
    for (const field of Object.keys(statuses) as FieldKey[]) if (statuses[field] === "confirmed") statuses[field] = "inferred";
  }
  return {
    source: { kind: "transcript", message_id: message.id, quote: clip(message.text.trim()) },
    statuses,
    evidence: parseEvidence(m.evidence),
    corrections: parseFieldList(m.corrected_fields),
    unknown,
  };
}

/**
 * Extraction options for a voice <extract>. The agent's prompt lives in ElevenLabs, outside
 * PROMPT_VERSION, so a prompt_version in what it wrote is never stored as chamber-extract's.
 */
export function voiceExtraction(message: { id: string; text: string }, data: unknown): ExtractionOptions {
  const { prompt_version: _unversioned, ...meta } = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  return transcriptExtraction(message, meta);
}
