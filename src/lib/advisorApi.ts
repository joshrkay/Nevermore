import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { ChamberData } from "@/data/chamberTypes";
import { parseChamberData } from "@/data/chamberValidation";
import { parseTranscript, type ChatMessage } from "@/data/chat";
import type { ChamberSubmission } from "@/data/manuscript";
import { parseProvenance, type FieldKey, type ProvenanceMap } from "@/data/provenance";
import type { OutboxStatus } from "@/data/outbox";
import {
  isPipelineStatus,
  manuscriptStoragePath,
  reconcileDocuments,
  reviewMap,
  sha256Hex,
  type FieldReview,
  type PipelineStatus,
  type ReviewedDocument,
  type ReviewMap,
  type ReviewState,
} from "@/data/advisor";

import { downloadName } from "../../supabase/functions/_shared/fileSignature.ts";
// Every call here is authorized by the database (row security and advisor-only functions);
// the advisor routes in the UI are a convenience on top of that, not the control.

type Tables = Database["public"]["Tables"];
export type SubmissionSummary = Database["public"]["Functions"]["advisor_list_submissions"]["Returns"][number];
export type StatusHistoryRow = Tables["submission_status_history"]["Row"];
export type AdvisorNote = Tables["advisor_notes"]["Row"];
export type ReviewEvent = Tables["advisor_review_events"]["Row"];
export type ManuscriptVersion = Tables["manuscript_versions"]["Row"];
export type UploadedDocument = Pick<Tables["documents"]["Row"], "id" | "file_name" | "file_size" | "category" | "status" | "storage_path" | "created_at" | "file_sha256" | "scan_verdict">;
export type DocumentEvent = Tables["document_events"]["Row"];

export class AdvisorApiError extends Error {
  constructor(message: string, readonly code?: string, readonly unauthenticated = false) {
    super(message);
  }
  /** The database refused: the account isn't (or is no longer) an advisor. */
  get forbidden() {
    return this.code === "42501";
  }
}

// The API reports a lapsed or unusable token as PostgREST's PGRST301-303; storage words it differently.
const isEndedSession = (error: { message: string; code?: string }) =>
  ["PGRST301", "PGRST302", "PGRST303"].includes(error.code ?? "") || /\bjwt\b|exp claim/i.test(error.message);

const fail = (error: { message: string; code?: string } | null, fallback: string): never => {
  if (error?.code === "42501") throw new AdvisorApiError("You don't have advisor access.", error.code);
  if (error && isEndedSession(error)) {
    throw new AdvisorApiError("Your session has expired. Sign in again to continue.", error.code, true);
  }
  throw new AdvisorApiError(error?.message || fallback, error?.code);
};

export async function fetchIsAdvisor(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_advisor");
  if (error) fail(error, "Couldn't check advisor access.");
  return data === true;
}

/** How many submissions the queue shows at a time. */
export const QUEUE_PAGE_SIZE = 25;

export interface SubmissionPage {
  rows: SubmissionSummary[];
  /** How many submissions match the status and search, across every page. */
  total: number;
}

/**
 * One page of the queue, filtered by status and searched (every word must appear in the company,
 * contact or reference) in the database. Pages count from 1.
 */
export async function listSubmissions(opts: { status: PipelineStatus | null; search?: string; page?: number }): Promise<SubmissionPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const { data, error } = await supabase.rpc("advisor_list_submissions", {
    p_status: opts.status,
    p_search: opts.search?.trim() || null,
    p_limit: QUEUE_PAGE_SIZE,
    p_offset: (page - 1) * QUEUE_PAGE_SIZE,
  });
  if (error) fail(error, "Couldn't load submissions.");
  const rows = data ?? [];
  return { rows, total: rows[0]?.total_count ?? 0 };
}

// ---------- Outbox & notifications (G-1.3) ----------

export type OutboxEvent = Database["public"]["Functions"]["advisor_list_outbox_events"]["Returns"][number];
export type OutboxSummaryRow = Database["public"]["Functions"]["advisor_outbox_summary"]["Returns"][number];

/** The queue of notification emails, newest first, optionally one status. Never includes the payload or the email itself. */
export async function listOutboxEvents(status: OutboxStatus | null): Promise<OutboxEvent[]> {
  const { data, error } = await supabase.rpc("advisor_list_outbox_events", status ? { p_status: status } : {});
  if (error) fail(error, "Couldn't load the outbox.");
  return data ?? [];
}

export type EmailProblem = Database["public"]["Functions"]["advisor_email_problems"]["Returns"][number];

/**
 * The submissions whose prospect cannot be reached by the confirmation email (it bounced for good,
 * or was reported as spam). Empty when all is well. Read beside the queue, not as part of it.
 */
export async function listEmailProblems(): Promise<EmailProblem[]> {
  const { data, error } = await supabase.rpc("advisor_email_problems");
  if (error) fail(error, "Couldn't check for bounced emails.");
  return data ?? [];
}

/** How many events are in each status, and how long the longest-waiting due one has waited. */
export async function outboxSummary(): Promise<OutboxSummaryRow[]> {
  const { data, error } = await supabase.rpc("advisor_outbox_summary");
  if (error) fail(error, "Couldn't load the outbox counts.");
  return data ?? [];
}

/**
 * Puts a dead event back in the queue (attempts reset, due now); the next run of the worker sends
 * it. `rebuild` discards the email already written for it, so it is rebuilt from the current
 * settings under a new key. Resolves to false when the event was no longer dead.
 */
export async function requeueOutboxEvent(eventId: string, rebuild: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc("advisor_requeue_outbox_event", { event_id: eventId, rebuild_payload: rebuild });
  if (error) fail(error, "Couldn't retry this notification.");
  return data === true;
}

export interface SubmissionDetail {
  id: string;
  userId: string;
  /** The File ID, assigned by the database at the first certification; null for a draft never certified. */
  fileId: string | null;
  intakeStatus: string;
  pipelineStatus: PipelineStatus;
  createdAt: string;
  updatedAt: string;
  /** The values as the prospect certified them (or as saved, if not certified). */
  data: ChamberData;
  /**
   * The same answers exactly as stored, before the browser tidies them for display. A review names
   * the stored answer it was made on, so the database can refuse it if the prospect has changed it since.
   */
  storedAnswers: Record<string, Json | undefined>;
  provenance: ProvenanceMap;
  /** True when `data` is the certified snapshot. */
  certified: boolean;
  /**
   * What the prospect signed, when they changed their answers afterwards and so withdrew the
   * certification: `data` is then their current answers, and this the copy they certified.
   */
  signed: { data: ChamberData; signedAt: string } | null;
  submission: ChamberSubmission | null;
  /** The conversation as certified when the intake is certified (otherwise as it stands). */
  transcript: ChatMessage[];
  /** The prospect's conversation has changed since they certified; `transcript` shows it as certified. */
  transcriptChangedSinceCertified: boolean;
  contactName: string | null;
  phone: string | null;
  history: StatusHistoryRow[];
  notes: AdvisorNote[];
  reviews: ReviewMap;
  reviewEvents: ReviewEvent[];
  versions: ManuscriptVersion[];
  /** The documents set against the list the intake was certified with. */
  documents: ReviewedDocument[];
  /** Every document added, removed, renamed or re-categorised, newest first. */
  documentEvents: DocumentEvent[];
}

export async function loadSubmission(id: string): Promise<SubmissionDetail | null> {
  const [session, workflow, history, notes, reviews, events, versions] = await Promise.all([
    supabase
      .from("chamber_sessions")
      .select("id, user_id, chamber_data, field_provenance, transcript, status, submission, created_at, updated_at, file_id")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("submission_workflow").select("status").eq("session_id", id).maybeSingle(),
    supabase.from("submission_status_history").select("*").eq("session_id", id).order("id", { ascending: false }),
    supabase.from("advisor_notes").select("*").eq("session_id", id).order("created_at", { ascending: false }),
    supabase.from("advisor_field_reviews").select("*").eq("session_id", id),
    supabase.from("advisor_review_events").select("*").eq("session_id", id).order("id", { ascending: false }),
    supabase.from("manuscript_versions").select("*").eq("session_id", id).order("version", { ascending: false }),
  ]);
  for (const r of [session, workflow, history, notes, reviews, events, versions]) {
    if (r.error) fail(r.error, "Couldn't load this submission.");
  }
  const row = session.data;
  // Row security hides sessions the caller may not see; a missing pipeline row means the same.
  if (!row || !workflow.data) return null;

  const [docs, profile, docEvents] = await Promise.all([
    supabase
      .from("documents")
      .select("id, file_name, file_size, category, status, storage_path, created_at, file_sha256, scan_verdict")
      // This intake's uploads only, not everything the same prospect has ever uploaded.
      .eq("session_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("contact_name, phone").eq("user_id", row.user_id).maybeSingle(),
    supabase.from("document_events").select("*").eq("session_id", id).order("id", { ascending: false }),
  ]);
  if (docs.error) fail(docs.error, "Couldn't load uploaded documents.");
  if (docEvents.error) fail(docEvents.error, "Couldn't load the document history.");

  const submission = (row.submission as unknown as ChamberSubmission | null) ?? null;
  const certified = row.status === "submitted" && !!submission?.signer_name;
  const useSnapshot = certified && submission?.chamber_data !== undefined;
  // The database decides which copy an advisor sees the same way (public.advisor_visible_answers).
  const shown = useSnapshot ? (submission!.chamber_data as Json) : row.chamber_data;
  const storedAnswers = shown && typeof shown === "object" && !Array.isArray(shown) ? (shown as Record<string, Json | undefined>) : {};
  // The evidence as certified, when the certification kept it (submissions from before it did don't).
  const certifiedTranscript = useSnapshot && submission!.transcript !== undefined ? submission!.transcript : undefined;
  return {
    id: row.id,
    userId: row.user_id,
    fileId: row.file_id ?? submission?.file_id ?? null,
    intakeStatus: row.status,
    pipelineStatus: isPipelineStatus(workflow.data.status) ? workflow.data.status : "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data: parseChamberData(shown),
    storedAnswers,
    // Pair provenance with whichever copy of the data is shown, as the prospect's Manuscript does.
    provenance: parseProvenance(useSnapshot ? submission!.field_provenance : row.field_provenance),
    certified,
    signed:
      !certified && submission?.signer_name && submission.chamber_data !== undefined && submission.chamber_data !== null
        ? { data: parseChamberData(submission.chamber_data), signedAt: submission.certified_at ?? submission.signed_at }
        : null,
    submission,
    transcript: parseTranscript(certifiedTranscript ?? row.transcript),
    // Both copies come back from the database the same way, so equal copies serialise identically.
    transcriptChangedSinceCertified:
      certifiedTranscript !== undefined && JSON.stringify(certifiedTranscript) !== JSON.stringify(row.transcript),
    contactName: profile.data?.contact_name ?? null,
    phone: profile.data?.phone ?? null,
    history: history.data ?? [],
    notes: notes.data ?? [],
    reviews: reviewMap((reviews.data ?? []) as unknown as FieldReview[]),
    reviewEvents: events.data ?? [],
    versions: versions.data ?? [],
    documents: reconcileDocuments(docs.data ?? [], useSnapshot ? submission!.documents : undefined),
    documentEvents: docEvents.data ?? [],
  };
}

export async function setStatus(sessionId: string, status: PipelineStatus, note: string): Promise<void> {
  const { error } = await supabase.rpc("set_submission_status", {
    p_session_id: sessionId,
    p_status: status,
    p_note: note.trim() || null,
  });
  if (error) fail(error, "Couldn't change the status.");
}

export async function addNote(sessionId: string, body: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("advisor_notes").insert({ session_id: sessionId, body, author_id: auth.user?.id });
  if (error) fail(error, "Couldn't save the note.");
}

export type CorrectionChange = { kind: "keep" } | { kind: "set"; value: unknown } | { kind: "clear" };

/**
 * Records an advisor's review of one field. `answer` is the stored answer the advisor was looking
 * at (`SubmissionDetail.storedAnswers[field]`, undefined when there was none): the database refuses
 * the review (code PT409, HTTP 409) if the prospect has changed it since, so a review always belongs to the
 * answer it was made on.
 */
export async function reviewField(
  sessionId: string,
  field: FieldKey,
  state: ReviewState | null,
  correction: CorrectionChange,
  reason: string,
  answer: Json | undefined,
): Promise<void> {
  const { error } = await supabase.rpc("review_submission_field", {
    p_session_id: sessionId,
    p_field: field,
    p_review_state: state,
    p_correction: correction.kind,
    p_value: correction.kind === "set" ? (correction.value as Json) : null,
    p_reason: reason.trim() || null,
    // {} says "there was no answer"; a missing key can't be told apart from a missing argument.
    p_answer: answer === undefined ? {} : { value: answer },
  });
  if (error) fail(error, "Couldn't save the review.");
}

/** How long a link to a stored file works. src/lib/fileLinks.test.ts holds every link to this. */
export const SIGNED_URL_SECONDS = 60;

/**
 * A short-lived link to a stored file, issued only if the caller may read it. Every link asks Storage for
 * `Content-Disposition: attachment`, so the browser saves the file and never shows it inline. Storage
 * doesn't sign that request, but every document is also stored as application/octet-stream
 * (20261104130000_document_scanning.sql), which a browser downloads whatever the link says.
 */
async function signedUrl(bucket: "documents" | "manuscripts", path: string, download: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: downloadName(download) });
  if (error || !data) fail(error, "Couldn't open that file.");
  return data!.signedUrl;
}

export const documentUrl = (doc: Pick<UploadedDocument, "storage_path" | "file_name">) =>
  signedUrl("documents", doc.storage_path, doc.file_name);

export const manuscriptUrl = (v: ManuscriptVersion, filename: string) => signedUrl("manuscripts", v.storage_path, filename);

/**
 * The prospect's own final Manuscript (public.prospect_final_manuscript). Storage signs it only for that
 * intake's owner, and only while it is the latest version built from their current certification.
 */
export const finalManuscriptUrl = (storagePath: string, filename: string) => signedUrl("manuscripts", storagePath, filename);

/**
 * Stores a generated Manuscript as the next version of a submission. The database refuses it
 * (code PT409, HTTP 409) if, since the page loaded, someone else generated a version, the review changed, or
 * the prospect certified again: the version must name the certification it was built from.
 */
export async function saveManuscriptVersion(opts: {
  sessionId: string;
  version: number;
  pdf: Blob;
  reviewEventId: number;
  correctionsApplied: number;
  sensitiveRevealed: boolean;
  /** The certification the PDF was built from: its `data_sha256` and `certified_at`, as loaded. */
  certifiedDataHash: string | null;
  certifiedAt: string | null;
}): Promise<ManuscriptVersion> {
  const path = manuscriptStoragePath(opts.sessionId, opts.version, crypto.randomUUID());
  const upload = await supabase.storage
    .from("manuscripts")
    .upload(path, opts.pdf, { contentType: "application/pdf", upsert: false });
  if (upload.error) fail(upload.error as { message: string }, "Couldn't store the Manuscript.");
  const { data, error } = await supabase.rpc("record_manuscript_version", {
    p_session_id: opts.sessionId,
    p_version: opts.version,
    p_storage_path: path,
    p_pdf_sha256: await sha256Hex(opts.pdf),
    p_review_event_id: opts.reviewEventId,
    p_corrections_applied: opts.correctionsApplied,
    p_sensitive_revealed: opts.sensitiveRevealed,
    p_certified_data_hash: opts.certifiedDataHash,
    p_certified_at: opts.certifiedAt,
  });
  if (error || !data) {
    // Not recorded, so not a version: don't leave the file behind.
    await supabase.storage.from("manuscripts").remove([path]);
    fail(error, "Couldn't record the Manuscript version.");
  }
  return data!;
}
