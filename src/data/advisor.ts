import type { ChamberData } from "./chamberTypes";
import { sanitizeChamberPatch } from "./chamberValidation";
import { FIELD_KINDS, FIELD_LABELS, formatFieldValue, type FieldKey, type ProvenanceMap } from "./provenance";
import { REVIEW_FIELDS, REVIEW_SECTIONS } from "./reviewFields";

// Advisor-side view of an intake: where it is in the pipeline, how complete it is, and the
// advisor's review of each field. Mirrors supabase/migrations/20261022090000_advisor_operations.sql.

// ---------- Pipeline status ----------

export const PIPELINE_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "information_requested",
  "ready_for_market",
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
  ready_for_market: "Ready for market",
  sent_to_carrier: "Sent to PEOs",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

/**
 * Where an advisor can move an intake from each stage: one step at a time, so nothing skips review.
 * Every open stage can be lost or archived; a closed one (won, lost) can only be archived; an archived
 * file is reopened as submitted and reviewed again. Draft is the system's stage and can only be archived
 * until the prospect certifies. What the prospect does moves the pipeline outside this list (certifying
 * enters it as submitted, and answers a request for information). The database holds the same list
 * (public.pipeline_next_statuses, migration 20261104122000; src/data/schemaSync.test.ts keeps them equal).
 */
export const PIPELINE_TRANSITIONS: Record<PipelineStatus, readonly PipelineStatus[]> = {
  draft: ["archived"],
  submitted: ["under_review", "information_requested", "lost", "archived"],
  under_review: ["information_requested", "ready_for_market", "lost", "archived"],
  information_requested: ["under_review", "lost", "archived"],
  ready_for_market: ["under_review", "information_requested", "sent_to_carrier", "lost", "archived"],
  sent_to_carrier: ["information_requested", "quoted", "lost", "archived"],
  quoted: ["sent_to_carrier", "won", "lost", "archived"],
  won: ["archived"],
  lost: ["archived"],
  archived: ["submitted"],
};

/**
 * The stages an advisor can move an intake to from `current`. An intake the prospect has never certified
 * can only be archived, and an archived one waits for the prospect to certify.
 */
export function nextPipelineStatuses(current: PipelineStatus, certifiedOnce: boolean): readonly PipelineStatus[] {
  const allowed = PIPELINE_TRANSITIONS[current];
  return certifiedOnce ? allowed : allowed.filter((s) => s === "archived");
}

export const isPipelineStatus = (s: unknown): s is PipelineStatus =>
  typeof s === "string" && (PIPELINE_STATUSES as readonly string[]).includes(s);

/**
 * What a prospect is told for each status we deliberately share. Everything else (carrier
 * routing, quotes, outcomes, archiving) stays internal; the database applies the same list.
 */
export const PROSPECT_STATUS_MESSAGES: Partial<Record<PipelineStatus, string>> = {
  submitted: "Received. An advisor will review your submission.",
  under_review: "An advisor is reviewing your submission.",
  information_requested: "Your advisor needs a little more information. We've emailed you their request, and it's waiting in your intake.",
};

export function prospectStatusMessage(status: unknown): string | null {
  return isPipelineStatus(status) ? PROSPECT_STATUS_MESSAGES[status] ?? null : null;
}

const isShared = (s: unknown): s is PipelineStatus => isPipelineStatus(s) && s in PROSPECT_STATUS_MESSAGES;

/**
 * The status a certified prospect sees once the pipeline is at `next`, given its history (newest first).
 * Mirrors public.prospect_submission_status: a shared status is shown as it is; an internal one leaves
 * the last shared status in place, except that a request for information isn't shown once the pipeline
 * has moved past it (nothing is waiting on the prospect), so they see "under review" instead.
 */
export function prospectStatusAfter(next: PipelineStatus, history: readonly { to_status: string }[]): PipelineStatus | null {
  if (isShared(next)) return next;
  const lastShared = history.find((h) => isShared(h.to_status))?.to_status as PipelineStatus | undefined;
  if (lastShared === "information_requested") return "under_review";
  return lastShared ?? null;
}

// ---------- Needs advisor action (F-4.3) ----------

/** What the queue and the submission page call a submission an advisor marked for the team to act on. */
// ---------- Information requests ----------

/** The longest message a request for information can carry; the database refuses longer (20261105090000). */
export const INFORMATION_REQUEST_MAX = 1000;

/** The most PEO extra questions one request can name; the database refuses more (20261115130000). */
export const INFORMATION_REQUEST_MAX_EXTRA_QUESTIONS = 60;

/** Intake statuses a prospect can't answer from (public.advisor_request_information refuses them). */
const CLOSED_INTAKE_STATUSES: ReadonlySet<string> = new Set(["archived", "revoked", "expired"]);

/**
 * Whether an advisor can ask the prospect for more information now: the intake was certified at least once, is
 * not closed, and its pipeline is at, or may move to, information requested. The database applies the same rule.
 */
export function canRequestInformation(status: PipelineStatus, certifiedOnce: boolean, intakeStatus: string): boolean {
  if (!certifiedOnce || CLOSED_INTAKE_STATUSES.has(intakeStatus)) return false;
  return status === "information_requested" || PIPELINE_TRANSITIONS[status].includes("information_requested");
}

/** Why an advisor can't ask the prospect for more information now (canRequestInformation), in their terms; null when they can. */
export function informationRequestBlockedReason(status: PipelineStatus, certifiedOnce: boolean, intakeStatus: string): string | null {
  if (canRequestInformation(status, certifiedOnce, intakeStatus)) return null;
  if (!certifiedOnce) return "Available once the prospect has certified their intake.";
  if (CLOSED_INTAKE_STATUSES.has(intakeStatus)) return "This intake is closed, so the prospect can't answer a request on it.";
  return `A submission at ${PIPELINE_LABELS[status]} can't move to ${PIPELINE_LABELS.information_requested}.`;
}

/**
 * Every field a request can name, in Review's order: the census (reviewed in Workforce, with its table) after the
 * Workforce answers.
 */
export const REQUESTABLE_FIELDS: readonly FieldKey[] = REVIEW_SECTIONS.flatMap(({ key }) =>
  key === "workforce" ? [...REVIEW_FIELDS[key], "census" as FieldKey] : REVIEW_FIELDS[key],
);

/** The fields an advisor marked as needing follow-up, in Review's order: what a request starts out asking about. */
export function followUpFieldsOf(reviews: ReviewMap): FieldKey[] {
  return REQUESTABLE_FIELDS.filter((f) => reviews[f]?.review_state === "follow_up");
}

export const NEEDS_ACTION_LABEL = "Needs advisor action";

/** The longest note it can carry; the database holds the same cap (20261104132000_needs_advisor_action.sql). */
export const NEEDS_ACTION_NOTE_MAX = 500;

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
      row.open_fields > 0 && `${row.open_fields} open item${row.open_fields === 1 ? "" : "s"}`,
      row.flagged_fields > 0 && `${row.flagged_fields} flagged by an advisor`,
    ].filter(Boolean);
    return { state: "needs_review", label: "Needs review", detail: parts.join(", ") };
  }
  return { state: "complete", label: "Complete", detail: "Every required item captured and confirmed" };
}

// ---------- Queue: reference, search, footprint ----------

/** The fewest characters the queue searches on (F-2.2); a shorter search would match nearly every row. */
export const QUEUE_SEARCH_MIN_CHARS = 3;

/** What the dashboard lists for an intake; a subset of the database's list row. */
export interface QueueRow {
  session_id: string;
  company_name: string | null;
  contact_name: string | null;
  /** The File ID, assigned by the database when the prospect first certifies; null until then. */
  file_id: string | null;
  created_at: string;
}

/** The reference an advisor quotes for an intake: its File ID, assigned by the database at the first certification; null before. */
export function referenceOf(row: Pick<QueueRow, "file_id">): string | null {
  return row.file_id?.trim() || null;
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
  /**
   * Set when the prospect changed this answer after it was reviewed: the database then resets the
   * review (a correction stays, unapproved) until an advisor reviews the new answer.
   */
  answer_changed_at?: string | null;
  /** The answer as it was when it was reviewed. */
  answer_changed_from?: unknown;
}

/**
 * The database refused a change because what it was based on changed after the page loaded: the
 * prospect changed the answer or certified again, the review changed, or another version was
 * generated. Reloading shows the current state. The code is PostgREST's custom HTTP 409 (PT409).
 */
export const isStaleRefusal = (err: unknown): boolean => (err as { code?: unknown } | null)?.code === "PT409";

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

/** The fields an advisor verified: the same names session_verified_fields gives the prospect. */
export function verifiedFieldsOf(reviews: ReviewMap): ReadonlySet<FieldKey> {
  return new Set(Object.values(reviews).flatMap((r) => (r?.review_state === "verified" ? [r.field] : [])));
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

// ---------- Audit badges ----------

/**
 * Whose value an answer in the advisor's review is: the prospect confirmed it themselves, or an advisor's
 * verified correction replaces it in the advisor Manuscript. An answer that is neither (inferred, still
 * open, or carrying a correction not yet verified) has no badge.
 */
export type AuditBadge = "prospect_confirmed" | "advisor_overridden";

export const AUDIT_BADGES: readonly AuditBadge[] = ["prospect_confirmed", "advisor_overridden"];

export const AUDIT_BADGE_LABELS: Record<AuditBadge, string> = {
  prospect_confirmed: "Prospect confirmed",
  advisor_overridden: "Advisor overridden",
};

/**
 * Each answer's audit badge. "Advisor overridden" is exactly the corrections applyAdvisorReview applies,
 * so the badge never disagrees with the Manuscript; it wins over the prospect's own confirmation.
 */
export function auditBadges(data: ChamberData, provenance: ProvenanceMap, reviews: ReviewMap): Partial<Record<FieldKey, AuditBadge>> {
  const overridden = new Set(applyAdvisorReview(data, provenance, reviews).corrections.map((c) => c.field));
  const badges: Partial<Record<FieldKey, AuditBadge>> = {};
  for (const field of Object.keys(FIELD_LABELS) as FieldKey[]) {
    if (overridden.has(field)) badges[field] = "advisor_overridden";
    else if (provenance[field]?.status === "confirmed") badges[field] = "prospect_confirmed";
  }
  return badges;
}

/** How many of `fields` carry each badge. */
export function countAuditBadges(badges: Partial<Record<FieldKey, AuditBadge>>, fields: readonly FieldKey[]): Record<AuditBadge, number> {
  const counts: Record<AuditBadge, number> = { prospect_confirmed: 0, advisor_overridden: 0 };
  for (const field of fields) {
    const badge = badges[field];
    if (badge) counts[badge] += 1;
  }
  return counts;
}

export interface ChangeSinceSigning {
  field: FieldKey;
  label: string;
  signed: string;
  current: string;
}

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/**
 * The answers that differ between what the prospect signed and what the intake holds now, in the field
 * review's order. The census is one entry: its head count, and whether anyone's details changed.
 */
export function changesSinceSigning(signed: ChamberData, current: ChamberData): ChangeSinceSigning[] {
  return (Object.keys(FIELD_LABELS) as FieldKey[]).flatMap((field): ChangeSinceSigning[] => {
    const before = signed[field];
    const after = current[field];
    if (JSON.stringify(before) === JSON.stringify(after)) return [];
    if (field === "census") {
      const [a, b] = [signed.census.length, current.census.length];
      return [{ field, label: FIELD_LABELS[field], signed: people(a), current: a === b ? `${people(b)}, details changed` : people(b) }];
    }
    return [{ field, label: FIELD_LABELS[field], signed: formatFieldValue(before), current: formatFieldValue(after) }];
  });
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

// ---------- Documents against the certified list ----------

/** A document as stored, or as copied into a certification. */
export interface DocumentRecord {
  id: string;
  file_name: string;
  file_size: string;
  category: string;
  status: string;
  storage_path: string;
  created_at: string;
  /** SHA-256 of the stored bytes, when known. */
  file_sha256?: string | null;
  /**
   * The malware scan, for a live document (20261104130000_document_scanning.sql). Absent for a certified copy
   * whose live row is gone: storage decides then, and withholds nothing it has no row for.
   */
  scan_verdict?: string;
}

/** A document as an advisor reviews it: where it stands against what the prospect certified. */
export interface ReviewedDocument extends DocumentRecord {
  /**
   * "certified": part of the certified intake and still there; "removed": certified, then removed by the
   * prospect (its file is kept for review); "added": added after certifying. Absent when the intake isn't
   * certified, or was certified before certifications kept their document list.
   */
  certification?: "certified" | "removed" | "added";
  /** The category it was certified with, when it has been re-categorised since. */
  certifiedCategory?: string;
  /** The name it was certified with, when it has been renamed since. */
  certifiedFileName?: string;
}

const asDocumentRecord = (v: unknown): DocumentRecord | null => {
  const d = v as Partial<Record<keyof DocumentRecord, unknown>> | null;
  if (!d || typeof d !== "object" || typeof d.id !== "string" || typeof d.storage_path !== "string") return null;
  const text = (x: unknown) => (typeof x === "string" ? x : "");
  return {
    id: d.id,
    file_name: text(d.file_name) || "Untitled document",
    file_size: text(d.file_size),
    category: text(d.category) || "other",
    status: text(d.status),
    storage_path: d.storage_path,
    created_at: text(d.created_at),
    file_sha256: typeof d.file_sha256 === "string" ? d.file_sha256 : null,
  };
};

/** The same stored file: same path, and the same bytes when both say what they are. */
const sameFile = (a: DocumentRecord, b: DocumentRecord) =>
  a.storage_path === b.storage_path && (!a.file_sha256 || !b.file_sha256 || a.file_sha256 === b.file_sha256);

/**
 * The live documents set against the list the intake was certified with (`submission.documents`),
 * newest first. Without a certified list, the live documents as they are. A document is the certified
 * one only while it still has the certified file: a row re-created under the same id with another file
 * shows as the certified one removed and a new one added.
 */
export function reconcileDocuments(live: readonly DocumentRecord[], certified: unknown): ReviewedDocument[] {
  if (!Array.isArray(certified)) return [...live];
  const certifiedDocs = certified.map(asDocumentRecord).filter((d): d is DocumentRecord => d !== null);
  const liveById = new Map(live.map((d) => [d.id, d]));
  const kept = new Set<DocumentRecord>();
  const out: ReviewedDocument[] = certifiedDocs.map((c) => {
    const now = liveById.get(c.id);
    if (!now || !sameFile(now, c)) return { ...c, certification: "removed" };
    kept.add(now);
    return {
      ...now,
      certification: "certified",
      ...(now.category !== c.category ? { certifiedCategory: c.category } : {}),
      ...(now.file_name !== c.file_name ? { certifiedFileName: c.file_name } : {}),
    };
  });
  for (const d of live) if (!kept.has(d)) out.push({ ...d, certification: "added" });
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

// ---------- Manuscript versions ----------

const sameInstant = (a: string | null | undefined, b: string | null | undefined) =>
  a === b || (!!a && !!b && !Number.isNaN(Date.parse(a)) && Date.parse(a) === Date.parse(b));

/**
 * True when a stored Manuscript version was built from the intake's current certification: the same
 * certification time, signing time and data. An older one shows answers the prospect has since
 * changed. Mirrors public.prospect_final_manuscript, which offers the prospect only such a version.
 */
export function isCurrentVersion(
  v: { certified_at?: string | null; certified_signed_at: string; certified_data_hash: string },
  submission: { certified_at?: string; signed_at: string; data_sha256?: string } | null,
): boolean {
  if (!submission) return false;
  return (
    // A version recorded before certified_at existed is matched by its signing time and data alone.
    (v.certified_at == null || sameInstant(v.certified_at, submission.certified_at ?? null)) &&
    sameInstant(v.certified_signed_at, submission.signed_at) &&
    v.certified_data_hash === (submission.data_sha256 ?? null)
  );
}

/** Where a generated Manuscript is stored: under its submission, never reused. */
export function manuscriptStoragePath(sessionId: string, version: number, nonce: string): string {
  return `${sessionId}/v${version}-${nonce}.pdf`;
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
