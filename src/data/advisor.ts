import type { ChamberData } from "./chamberTypes";
import { sanitizeChamberPatch } from "./chamberValidation";
import { fileIdForSession } from "./manuscript";
import { FIELD_KINDS, FIELD_LABELS, formatFieldValue, type FieldKey, type ProvenanceMap } from "./provenance";

// Advisor-side view of an intake: where it is in the pipeline, how complete it is, and the
// advisor's review of each field. Mirrors supabase/migrations/20261022090000_advisor_operations.sql.

// ---------- Pipeline status ----------

export const PIPELINE_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "information_requested",
  "sent_to_carrier",
  "quoted",
  "won",
  "lost",
  "archived",
] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const PIPELINE_LABELS: Record<PipelineStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  information_requested: "Information requested",
  sent_to_carrier: "Sent to carrier/PEO",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

/** Draft is set only by the system, for intakes the prospect hasn't certified. */
export const ADVISOR_SETTABLE_STATUSES = PIPELINE_STATUSES.filter((s) => s !== "draft");

export const isPipelineStatus = (s: unknown): s is PipelineStatus =>
  typeof s === "string" && (PIPELINE_STATUSES as readonly string[]).includes(s);

/**
 * What a prospect is told for each status we deliberately share. Everything else (carrier
 * routing, quotes, outcomes, archiving) stays internal; the database applies the same list.
 */
export const PROSPECT_STATUS_MESSAGES: Partial<Record<PipelineStatus, string>> = {
  submitted: "Received. An advisor will review your submission.",
  under_review: "An advisor is reviewing your submission.",
  information_requested: "Your advisor needs a little more information. Watch your email for their request.",
};

export function prospectStatusMessage(status: unknown): string | null {
  return isPipelineStatus(status) ? PROSPECT_STATUS_MESSAGES[status] ?? null : null;
}

// ---------- Completeness ----------

export type Completeness =
  | { state: "missing_required"; label: string; detail: string }
  | { state: "needs_review"; label: string; detail: string }
  | { state: "complete"; label: string; detail: string };

export function completenessOf(row: { missing_required: string[]; open_fields: number; flagged_fields: number }): Completeness {
  if (row.missing_required.length > 0) {
    return { state: "missing_required", label: "Missing required", detail: row.missing_required.join(", ") };
  }
  const open = row.open_fields + row.flagged_fields;
  if (open > 0) {
    const parts = [
      row.open_fields > 0 && `${row.open_fields} unconfirmed`,
      row.flagged_fields > 0 && `${row.flagged_fields} flagged by an advisor`,
    ].filter(Boolean);
    return { state: "needs_review", label: "Needs review", detail: parts.join(", ") };
  }
  return { state: "complete", label: "Complete", detail: "Every required item captured and confirmed" };
}

// ---------- Queue: reference, search, footprint ----------

/** What the dashboard lists for an intake; a subset of the database's list row. */
export interface QueueRow {
  session_id: string;
  company_name: string | null;
  contact_name: string | null;
  /** The certified file id; null until the prospect certifies. */
  file_id: string | null;
  created_at: string;
}

/** The reference an advisor quotes for an intake: the certified file id, or the one the detail page derives. */
export function referenceOf(row: Pick<QueueRow, "session_id" | "file_id" | "created_at">): string {
  return row.file_id ?? fileIdForSession(row.session_id, new Date(row.created_at));
}

/**
 * True when every word typed appears in the company, contact or reference the row shows. Nothing
 * else is searched, so a search can't surface (or be matched against) a detail the list hides.
 */
export function matchesSearch(row: QueueRow, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [row.company_name, row.contact_name, referenceOf(row)].filter(Boolean).join("\n").toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

/** The state footprint for a list cell: "CA, NY, TX", or the first few and a count. Null when unknown. */
export function formatStates(states: readonly string[], limit = 4): string | null {
  if (states.length === 0) return null;
  if (states.length <= limit) return states.join(", ");
  return `${states.slice(0, limit).join(", ")} +${states.length - limit} more`;
}

// ---------- Field review ----------

export const REVIEW_STATES = ["verified", "incomplete", "follow_up"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const REVIEW_LABELS: Record<ReviewState, string> = {
  verified: "Verified",
  incomplete: "Incomplete",
  follow_up: "Needs follow-up",
};

export interface FieldReview {
  field: FieldKey;
  review_state: ReviewState | null;
  has_correction: boolean;
  corrected_value: unknown;
  reason: string | null;
  updated_by_email: string | null;
  updated_at: string;
}

export type ReviewMap = Partial<Record<FieldKey, FieldReview>>;

/** Reviews by field. A census review recorded before the census contract is keyed `employees`. */
export function reviewMap(rows: FieldReview[]): ReviewMap {
  const map: ReviewMap = {};
  for (const r of rows) {
    if (r.field in FIELD_LABELS) map[r.field] = r;
  }
  for (const r of rows) {
    if ((r.field as string) === "employees" && !map.census) map.census = { ...r, field: "census" };
  }
  return map;
}

export interface AppliedCorrection {
  field: FieldKey;
  label: string;
  prospectValue: string;
  advisorValue: string;
  reason: string;
}

export interface AdvisorPacket {
  data: ChamberData;
  provenance: ProvenanceMap;
  corrections: AppliedCorrection[];
  /** Open items the advisor flagged, in Manuscript wording. */
  followUps: string[];
}

/**
 * The data an advisor-generated Manuscript is built from: the prospect's certified values, with
 * each correction applied once its field is marked verified. A correction on a field still being
 * looked into isn't approved yet, so the prospect's value stands. The prospect's data isn't changed.
 */
export function applyAdvisorReview(data: ChamberData, provenance: ProvenanceMap, reviews: ReviewMap): AdvisorPacket {
  let next = data;
  const nextProvenance: ProvenanceMap = { ...provenance };
  const corrections: AppliedCorrection[] = [];
  const followUps: string[] = [];

  for (const field of Object.keys(reviews) as FieldKey[]) {
    const review = reviews[field]!;
    const label = FIELD_LABELS[field];
    if (review.review_state === "verified") {
      if (review.has_correction && field !== "census") {
        const patch = sanitizeChamberPatch({ [field]: review.corrected_value });
        if (field in patch) {
          corrections.push({
            field,
            label,
            prospectValue: formatFieldValue(data[field]),
            advisorValue: formatFieldValue(patch[field]),
            reason: review.reason ?? "",
          });
          next = { ...next, [field]: patch[field] };
        }
      }
      const prev = nextProvenance[field];
      if (prev) nextProvenance[field] = { ...prev, status: "confirmed", candidates: undefined };
    } else if (review.review_state === "incomplete") {
      followUps.push(`${label} — marked incomplete by an advisor`);
    } else if (review.review_state === "follow_up") {
      followUps.push(`${label} — advisor follow-up needed`);
    }
  }

  return { data: next, provenance: nextProvenance, corrections, followUps };
}

/** Parses an advisor's typed correction for a field. Null when it isn't a valid value. */
export function parseCorrection(field: FieldKey, input: string): { value: unknown } | null {
  if (field === "census") return null;
  const text = input.trim();
  let value: unknown;
  switch (FIELD_KINDS[field]) {
    case "list":
      value = text ? text.split(",").map((s) => s.trim()).filter(Boolean) : [];
      break;
    case "boolean":
      if (/^(y|yes|true)$/i.test(text)) value = true;
      else if (/^(n|no|false)$/i.test(text)) value = false;
      else return null;
      break;
    case "number":
      if (!/^\d+(\.\d+)?$/.test(text)) return null;
      value = Number(text);
      break;
    default:
      value = text || null;
  }
  const patch = sanitizeChamberPatch({ [field]: value });
  return field in patch ? { value: patch[field] } : null;
}

/** How a correction is shown in its edit box. */
export function correctionInput(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

// ---------- Manuscript versions ----------

/** Where a generated Manuscript is stored: under its submission, never reused. */
export function manuscriptStoragePath(sessionId: string, version: number, nonce: string): string {
  return `${sessionId}/v${version}-${nonce}.pdf`;
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
