import type { ChamberData } from "./chamberTypes";
import { sanitizeChamberPatch } from "./chamberValidation";
import { applyExtraction, type FieldSource, type IntakeState } from "./provenance";

// Values read out of an uploaded document are candidates, not answers: they are stored on the
// document (with where they were found) and only reach the intake when the prospect applies
// them. A candidate never replaces a value already in the intake without an explicit "Replace".
// Applied values carry a `document` source in the field provenance (see docs/intake-schema.md).

export type CandidateField = keyof ChamberData;

export interface DocumentCandidate {
  field: CandidateField;
  value: ChamberData[CandidateField];
  /** Where in the document it was found, e.g. "Sheet1, rows 2–29" or "Page 3". */
  location: string | null;
}

export interface DocumentExtraction {
  message: string | null;
  candidates: DocumentCandidate[];
  /** Fields the prospect applied from this document, with when. */
  applied: Partial<Record<CandidateField, string>>;
}

export const EMPTY_EXTRACTION: DocumentExtraction = { message: null, candidates: [], applied: {} };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Documents read before the census contract proposed the roster as `employees`.
const candidateField = (f: string) => (f === "employees" ? "census" : f);

/** Reads a stored `extraction` column, keeping only candidates that pass the intake's field rules. */
export function parseExtraction(raw: unknown): DocumentExtraction {
  if (!isPlainObject(raw)) return EMPTY_EXTRACTION;
  const candidates: DocumentCandidate[] = [];
  for (const c of Array.isArray(raw.candidates) ? raw.candidates : []) {
    if (!isPlainObject(c) || typeof c.field !== "string") continue;
    const field = candidateField(c.field) as CandidateField;
    const patch = sanitizeChamberPatch({ [field]: c.value });
    if (!(field in patch) || isEmpty(patch[field])) continue;
    candidates.push({
      field,
      value: patch[field] as ChamberData[CandidateField],
      location: typeof c.location === "string" ? c.location : null,
    });
  }
  const applied: DocumentExtraction["applied"] = {};
  if (isPlainObject(raw.applied)) {
    for (const [k, v] of Object.entries(raw.applied)) if (typeof v === "string") applied[candidateField(k) as CandidateField] = v;
  }
  return { message: typeof raw.message === "string" ? raw.message : null, candidates, applied };
}

export function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

// A census row's id is generated, so two rosters with the same people and facts are the same census.
const withoutIds = (rows: unknown[]) =>
  rows.map((r) => (isPlainObject(r) ? Object.fromEntries(Object.entries(r).filter(([k]) => k !== "id")) : r));

const normalize = (v: unknown): string =>
  JSON.stringify(
    Array.isArray(v) && v.every((x) => typeof x === "string")
      ? [...v].map((s) => s.toLowerCase()).sort()
      : Array.isArray(v)
        ? withoutIds(v)
        : typeof v === "string"
          ? v.trim().toLowerCase()
          : v,
  );

export type MergeKind = "new" | "same" | "conflict";

export interface PlannedCandidate {
  candidate: DocumentCandidate;
  kind: MergeKind;
  current: unknown;
}

/** How each candidate relates to what the intake already holds. */
export function planCandidateMerge(data: ChamberData, candidates: DocumentCandidate[]): PlannedCandidate[] {
  return candidates.map((candidate) => {
    const current = data[candidate.field];
    const kind: MergeKind = isEmpty(current)
      ? "new"
      : normalize(current) === normalize(candidate.value)
        ? "same"
        : "conflict";
    return { candidate, kind, current };
  });
}

export function documentSource(doc: { id: string; file_name: string }, c: DocumentCandidate): FieldSource {
  return {
    kind: "document",
    document_id: doc.id,
    document_name: doc.file_name,
    ...(c.location ? { location: c.location } : {}),
  };
}

/**
 * Applies candidates the prospect chose. They reviewed each value, so it is recorded as
 * confirmed, with the document as its source. Without `replace`, the usual merge rules hold:
 * a value the prospect entered is never changed, and a different existing value becomes a
 * conflict rather than being overwritten. `replace` is the prospect's explicit "Replace".
 */
export function applyDocumentCandidates(
  state: IntakeState,
  doc: { id: string; file_name: string },
  chosen: DocumentCandidate[],
  opts: { replace?: boolean; now?: Date } = {},
): IntakeState {
  const now = opts.now ?? new Date();
  return chosen.reduce<IntakeState>((acc, c) => {
    const source = documentSource(doc, c);
    if (!opts.replace) {
      return applyExtraction(acc, { [c.field]: c.value }, { source, statuses: { [c.field]: "confirmed" }, now });
    }
    const patch = sanitizeChamberPatch({ [c.field]: c.value });
    if (!(c.field in patch)) return acc;
    return {
      data: { ...acc.data, [c.field]: patch[c.field] },
      provenance: { ...acc.provenance, [c.field]: { status: "confirmed", source, updated_at: now.toISOString() } },
    };
  }, state);
}

const FIELD_LABELS: Partial<Record<CandidateField, string>> = {
  company_name: "Company",
  industry: "Industry",
  hq_state: "HQ state",
  states: "States",
  employee_count: "Employees",
  start_month: "Start date",
  current_carrier: "Current carrier",
  renewal_date: "Renewal date",
  rate_history: "Rate history",
  benefits_waiting_period: "Waiting period",
  ancillary_benefits: "Ancillary benefits",
  has_401k: "Offers 401(k)",
  retirement_type: "Retirement plan",
  payroll_vendor: "Payroll vendor",
  pay_frequency: "Pay frequency",
  nonexempt_count: "Non-exempt employees",
  exempt_count: "Exempt employees",
  has_1099: "Has 1099 contractors",
  census: "Employee census",
};

export function fieldLabel(field: CandidateField): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** A short, human-readable rendering of a candidate or current value. */
export function formatValue(field: CandidateField, v: unknown): string {
  if (isEmpty(v)) return "—";
  if (field === "census" && Array.isArray(v)) return `${v.length} employee${v.length === 1 ? "" : "s"}`;
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
