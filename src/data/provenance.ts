import { z } from "zod";
import type { ChamberData } from "./chamberTypes";
import { sanitizeChamberPatch } from "./chamberValidation";
import { redactSensitive } from "./sensitive";

// Every captured field records how sure we are of it and where it came from, so the
// prospect and advisor can tell what Lenore inferred from what someone confirmed.
// Kept beside ChamberData (keyed by field) rather than inside it so existing readers
// of the flat data don't change.

export type FieldKey = keyof ChamberData;

export const FIELD_STATUSES = ["confirmed", "inferred", "incomplete", "conflicting"] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

/** Statuses the extraction model may assign; only a disagreement makes a field conflicting. */
export type ExtractedStatus = Exclude<FieldStatus, "conflicting">;

export type FieldSource =
  | { kind: "transcript"; message_id: string; quote?: string }
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
}

export type ProvenanceMap = Partial<Record<FieldKey, FieldProvenance>>;

export interface IntakeState {
  data: ChamberData;
  provenance: ProvenanceMap;
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  company_name: "Company legal name",
  industry: "Industry",
  hq_state: "HQ state",
  states: "States of operation",
  employee_count: "Employee count",
  start_month: "Target start",
  multiple_entities: "Multiple entities",
  fein_count: "FEIN count",
  virgin_medical: "First-time medical coverage",
  current_carrier: "Current carrier",
  renewal_date: "Renewal date",
  rate_history: "Rate history",
  benefits_waiting_period: "Waiting period",
  ancillary_benefits: "Ancillary benefits",
  has_401k: "Retirement plan",
  retirement_type: "Retirement plan type",
  employer_contributes: "Employer retirement contribution",
  payroll_vendor: "Payroll vendor",
  pay_frequency: "Pay frequency",
  funding_days: "Funding lead time",
  has_nonexempt: "Nonexempt employees",
  nonexempt_count: "Nonexempt count",
  exempt_count: "Exempt count",
  pto_types: "PTO types",
  accrual_method: "Accrual method",
  has_handbook: "Employee handbook",
  handbook_last_updated: "Handbook last updated",
  hr_staff_count: "In-house HR staff",
  has_1099: "1099 contractors",
  ca_contractors: "California contractors",
  uses_physical_clocks: "Physical time clocks",
  uses_mobile_app: "Mobile timekeeping",
  uses_computer_timekeeping: "Computer timekeeping",
  shift_differentials: "Shift differentials",
  hris_system: "HRIS system",
  key_challenges: "Key challenges",
  business_goals: "Business goals",
  census: "Employee census",
};

export type FieldKind = "text" | "number" | "boolean" | "list";

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
};

const FIELD_KEYS = Object.keys(FIELD_LABELS) as FieldKey[];
const isFieldKey = (k: unknown): k is FieldKey => typeof k === "string" && k in FIELD_LABELS;

const MAX_QUOTE_CHARS = 200;
// A cut between the halves of an emoji leaves a lone high surrogate, which Postgres jsonb
// refuses; the whole field_provenance is resent on every save, so one bad quote would fail them all.
const clip = (s: string) =>
  s.length > MAX_QUOTE_CHARS ? `${s.slice(0, MAX_QUOTE_CHARS - 1).replace(/[\uD800-\uDBFF]$/, "")}…` : s;

// ---------- Parsing stored provenance ----------

const sourceSchema: z.ZodType<FieldSource, z.ZodTypeDef, unknown> = z.union([
  z.object({ kind: z.literal("transcript"), message_id: z.string().min(1), quote: z.string().max(MAX_QUOTE_CHARS).optional() }),
  z.object({
    kind: z.literal("document"),
    document_id: z.string().min(1),
    document_name: z.string().optional(),
    location: z.string().optional(),
  }),
  z.object({ kind: z.literal("prospect_edit") }),
]) as unknown as z.ZodType<FieldSource, z.ZodTypeDef, unknown>;

const provenanceSchema = z.object({
  status: z.enum(FIELD_STATUSES),
  source: sourceSchema,
  updated_at: z.string(),
  candidates: z.array(z.object({ value: z.unknown(), source: sourceSchema })).optional(),
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

// ---------- Merging extractions ----------

const isEmpty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// A list that only adds entries ("also Texas") extends the old one rather than contradicting it.
const extendsList = (prev: unknown, next: unknown) =>
  Array.isArray(prev) && Array.isArray(next) && prev.every((p) => next.some((n) => same(p, n)));

export interface ExtractionOptions {
  source: FieldSource;
  /** Model-assigned status per field; defaults to "inferred". */
  statuses?: Partial<Record<FieldKey, ExtractedStatus>>;
  /** Short supporting quote per field; overrides the source's own quote. */
  evidence?: Partial<Record<FieldKey, string>>;
  /** Fields the prospect explicitly corrected, which replace rather than conflict. */
  corrections?: FieldKey[];
  now?: Date;
}

/**
 * Applies an untrusted AI patch. A prospect's own edit is never overwritten, and a
 * value that contradicts an earlier AI value is kept as a conflict, not swapped in.
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

    const replaces =
      !prev || // nothing recorded yet (or a session saved before provenance existed)
      isEmpty(prevValue) ||
      opts.corrections?.includes(field) ||
      field === "census" || // the roster is rebuilt as it grows
      extendsList(prevValue, value);

    if (replaces) {
      (data as Record<FieldKey, unknown>)[field] = value;
      provenance[field] = { status, source, updated_at };
      continue;
    }

    if (same(prevValue, value)) {
      if (prev.status === "conflicting") continue;
      // Hearing the same value again can raise confidence, never lower it.
      const keep = prev.status === "confirmed" && status !== "confirmed";
      provenance[field] = { status: keep ? prev.status : status, source, updated_at };
      continue;
    }

    const candidates = prev.candidates ?? [{ value: prevValue, source: prev.source }];
    provenance[field] = {
      status: "conflicting",
      source: prev.source,
      updated_at,
      candidates: candidates.some((c) => same(c.value, value)) ? candidates : [...candidates, { value, source }],
    };
  }

  return { data, provenance };
}

// ---------- Prospect actions ----------

export type FieldAction =
  | { type: "confirm"; field: FieldKey }
  | { type: "edit"; field: FieldKey; value: unknown }
  | { type: "resolve"; field: FieldKey; candidate: number };

/** Applies a prospect's confirm, edit, or conflict resolution. Invalid edits change nothing. */
export function applyFieldAction(state: IntakeState, action: FieldAction, now = new Date()): IntakeState {
  const confirmed = (): FieldProvenance => ({ status: "confirmed", source: { kind: "prospect_edit" }, updated_at: now.toISOString() });
  const { field } = action;

  if (action.type === "confirm") {
    if (state.provenance[field]?.status === "conflicting") return state; // must pick a value first
    return { data: state.data, provenance: { ...state.provenance, [field]: confirmed() } };
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

// ---------- Open items ----------

export type FieldOpenReason = "Conflicting answers" | "Incomplete" | "Please confirm";

export interface FieldOpenItem {
  field: FieldKey;
  label: string;
  reason: FieldOpenReason;
}

const REASONS: Partial<Record<FieldStatus, FieldOpenReason>> = {
  conflicting: "Conflicting answers",
  incomplete: "Incomplete",
  inferred: "Please confirm",
};

/** Fields that still need the prospect: conflicts first, then incomplete, then inferred. */
export function fieldOpenItems(provenance: ProvenanceMap): FieldOpenItem[] {
  const order: FieldStatus[] = ["conflicting", "incomplete", "inferred"];
  return order.flatMap((status) =>
    FIELD_KEYS.filter((f) => provenance[f]?.status === status).map((field) => ({
      field,
      label: FIELD_LABELS[field],
      reason: REASONS[status]!,
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
 * optional field_status, evidence and corrected_fields; the message text is the
 * fallback quote for fields with no evidence of their own.
 */
export function transcriptExtraction(message: { id: string; text: string }, meta: unknown): ExtractionOptions {
  const m = (typeof meta === "object" && meta !== null ? meta : {}) as Record<string, unknown>;
  return {
    source: { kind: "transcript", message_id: message.id, quote: clip(message.text.trim()) },
    statuses: parseExtractedStatuses(m.field_status),
    evidence: parseEvidence(m.evidence),
    corrections: parseFieldList(m.corrected_fields),
  };
}
