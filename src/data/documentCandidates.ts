import type { CensusEmployee, ChamberData } from "./chamberTypes";
import { CENSUS_FACTS, isAssumed, samePerson, type CensusFact } from "./census";
import { sanitizeChamberPatch } from "./chamberValidation";
import { applyChosenValue, applyExtraction, applyFieldAction, outranks, type FieldSource, type IntakeState, type ProvenanceMap } from "./provenance";

// Values read out of an uploaded document are candidates, not answers: they are stored on the
// document (with where they were found) and only reach the intake when the prospect applies
// them. The Upload tab offers Apply for a value the intake doesn't hold yet, or holds only from
// the conversation, which a document outranks; a value that differs from the prospect's own or
// another document's is settled by the prospect in the conflict dialog. Applied values carry a
// `document` source in the field provenance (see docs/intake-schema.md).

export type CandidateField = keyof ChamberData;

export interface DocumentCandidate {
  field: CandidateField;
  value: ChamberData[CandidateField];
  /** Where in the document it was found, e.g. "Sheet1, rows 2–29" or "Page 3". */
  location: string | null;
  /**
   * For a census: the row facts the document had columns for. Others are defaults (full time,
   * salaried, W-2) or blank, and never replace what the intake already says. Absent: all of them.
   */
  facts?: CensusFact[];
}

export interface DocumentExtraction {
  message: string | null;
  /** What the prospect should know about how the file was read, e.g. a column that was skipped. */
  notes: string[];
  candidates: DocumentCandidate[];
  /** Fields the prospect applied from this document, with when. */
  applied: Partial<Record<CandidateField, string>>;
  /** Fields where the prospect kept their own answer over this document's, with when. */
  kept: Partial<Record<CandidateField, string>>;
}

export const EMPTY_EXTRACTION: DocumentExtraction = { message: null, notes: [], candidates: [], applied: {}, kept: {} };

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
    const facts = Array.isArray(c.facts) ? CENSUS_FACTS.filter((f) => (c.facts as unknown[]).includes(f)) : undefined;
    candidates.push({
      field,
      value: patch[field] as ChamberData[CandidateField],
      location: typeof c.location === "string" ? c.location : null,
      ...(field === "census" && facts ? { facts } : {}),
    });
  }
  const notes = Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === "string" && n.trim() !== "") : [];
  return {
    message: typeof raw.message === "string" ? raw.message : null,
    notes,
    candidates,
    applied: timestamps(raw.applied),
    kept: timestamps(raw.kept),
  };
}

function timestamps(raw: unknown): Partial<Record<CandidateField, string>> {
  const out: Partial<Record<CandidateField, string>> = {};
  if (isPlainObject(raw)) {
    for (const [k, v] of Object.entries(raw)) if (typeof v === "string") out[candidateField(k) as CandidateField] = v;
  }
  return out;
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

/**
 * "replace": the intake's value came from the conversation, which a document outranks, so applying
 * the candidate replaces it and keeps it as also_heard. "conflict": it is the prospect's own or
 * another document's, so the prospect settles it in the conflict dialog.
 */
export type MergeKind = "new" | "same" | "replace" | "conflict";

export interface PlannedCandidate {
  candidate: DocumentCandidate;
  kind: MergeKind;
  current: unknown;
}

/** How each candidate relates to what the intake already holds, and where that came from. */
export function planCandidateMerge(data: ChamberData, candidates: DocumentCandidate[], provenance: ProvenanceMap = {}): PlannedCandidate[] {
  return candidates.map((candidate) => {
    const current = data[candidate.field];
    const entry = provenance[candidate.field];
    const same =
      candidate.field === "census"
        ? censusAgrees(compareCensus(data.census, candidate.value as CensusEmployee[], candidate.facts))
        : normalize(current) === normalize(candidate.value);
    // A census is always compared in the dialog, since it merges person by person.
    const replaces = candidate.field !== "census" && entry !== undefined && outranks("document", entry);
    const kind: MergeKind = isEmpty(current) ? "new" : same ? "same" : replaces ? "replace" : "conflict";
    return { candidate, kind, current };
  });
}

// ---------- Census: comparing and merging rosters ----------

export interface CensusChange {
  fact: CensusFact;
  from: unknown;
  to: unknown;
}

export interface CensusComparison {
  /** People in both, with the stated facts where the document differs. */
  matched: { current: CensusEmployee; incoming: CensusEmployee; changes: CensusChange[] }[];
  /** People only in the document. */
  added: CensusEmployee[];
  /** People only in the intake. */
  missing: CensusEmployee[];
}

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== "";

/** Whether the document stated `fact` for this row: a column it had, a value in it, and not a default. */
const statesFact = (row: CensusEmployee, fact: CensusFact, facts: readonly CensusFact[]) =>
  facts.includes(fact) && hasValue(row[fact]) && !isAssumed(row, fact);

/**
 * Lines a document's census up against the intake's, person by person (same name, and birth dates
 * that don't disagree). Only facts the document stated count as changes: a default it filled in for a
 * blank cell never replaces what the intake says.
 */
export function compareCensus(current: CensusEmployee[], incoming: CensusEmployee[], facts: readonly CensusFact[] = CENSUS_FACTS): CensusComparison {
  const unmatched = [...current];
  const matched: CensusComparison["matched"] = [];
  const added: CensusEmployee[] = [];
  for (const row of incoming) {
    const i = unmatched.findIndex((c) => samePerson(c, row));
    if (i === -1) {
      added.push(row);
      continue;
    }
    const [existing] = unmatched.splice(i, 1);
    const changes = facts
      .filter((f) => statesFact(row, f, facts) && row[f] !== existing[f])
      .map((f) => ({ fact: f, from: existing[f], to: row[f] }));
    matched.push({ current: existing, incoming: row, changes });
  }
  return { matched, added, missing: unmatched };
}

export const censusAgrees = (c: CensusComparison) =>
  c.added.length === 0 && c.missing.length === 0 && c.matched.every((m) => m.changes.length === 0);

/**
 * The intake's census updated from a document: people in both take the document's stated facts
 * (keeping their id and the dependents named in conversation), people only in the document are
 * added, and people only in the intake stay.
 */
export function mergeCensus(current: CensusEmployee[], incoming: CensusEmployee[], facts: readonly CensusFact[] = CENSUS_FACTS): CensusEmployee[] {
  const { matched, added } = compareCensus(current, incoming, facts);
  const updates = new Map(matched.map((m) => [m.current.id, m]));
  const merged = current.map((row) => {
    const m = updates.get(row.id);
    if (!m) return row;
    const next = { ...row };
    for (const { fact, to } of m.changes) (next as Record<string, unknown>)[fact] = to;
    // What the document states is an answer now, whether or not it changed the value.
    const stillAssumed = (row.assumed ?? []).filter((fact) => !statesFact(m.incoming, fact, facts));
    if (stillAssumed.length > 0) next.assumed = stillAssumed;
    else delete next.assumed;
    return next;
  });
  const ids = new Set(merged.map((r) => r.id));
  return [...merged, ...added.map((r) => (ids.has(r.id) ? { ...r, id: `${r.id}-${merged.length}` } : r))];
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
 * confirmed, with the document as its source. Without `replace`, the merge ladder holds
 * (applyExtraction): a value the prospect entered is never changed, a value from chat gives way
 * to the document's and is kept as also_heard, and a different value from another document
 * becomes a conflict. `replace` is the prospect choosing the document's value in the conflict
 * dialog (applyChosenValue): it replaces their own answer too, and keeps a replaced value from
 * another kind of source as also_heard.
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
    return opts.replace
      ? applyChosenValue(acc, c.field, c.value, source, now)
      : applyExtraction(acc, { [c.field]: c.value }, { source, statuses: { [c.field]: "confirmed" }, now });
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

// ---------- The prospect's decision on a candidate ----------

export type CandidateResolution =
  /** Values the intake doesn't have yet. */
  | { type: "apply"; candidates: DocumentCandidate[] }
  /** The document's value over the intake's. */
  | { type: "use_document"; candidate: DocumentCandidate }
  /** The intake's value over the document's; the prospect has now confirmed it. */
  | { type: "keep_current"; candidate: DocumentCandidate }
  /** A census merged into the intake's (see mergeCensus). */
  | { type: "merge_census"; candidate: DocumentCandidate };

/** Applies the prospect's choice to the intake. */
export function resolveCandidate(
  state: IntakeState,
  doc: { id: string; file_name: string },
  r: CandidateResolution,
  now = new Date(),
): IntakeState {
  switch (r.type) {
    case "apply":
      return applyDocumentCandidates(state, doc, r.candidates, { now });
    case "use_document":
      return applyDocumentCandidates(state, doc, [r.candidate], { replace: true, now });
    case "keep_current": {
      const { field } = r.candidate;
      // A census the prospect keeps is left exactly as it is.
      if (field === "census" || isEmpty(state.data[field])) return state;
      return applyFieldAction(state, { type: "edit", field, value: state.data[field] }, now);
    }
    case "merge_census": {
      const census = mergeCensus(state.data.census, r.candidate.value as CensusEmployee[], r.candidate.facts);
      return {
        data: { ...state.data, census },
        provenance: {
          ...state.provenance,
          census: { status: "confirmed", source: documentSource(doc, r.candidate), updated_at: now.toISOString() },
        },
      };
    }
  }
}

/** The fields a resolution settles, and whether the prospect kept their own answer. */
export function resolutionFields(r: CandidateResolution): { fields: CandidateField[]; kept: boolean } {
  return r.type === "apply"
    ? { fields: r.candidates.map((c) => c.field), kept: false }
    : { fields: [r.candidate.field], kept: r.type === "keep_current" };
}
