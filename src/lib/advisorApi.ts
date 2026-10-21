import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { ChamberData } from "@/data/chamberTypes";
import { parseChamberData } from "@/data/chamberValidation";
import { parseTranscript, type ChatMessage } from "@/data/chat";
import { fileIdForSession, type ChamberSubmission } from "@/data/manuscript";
import { parseProvenance, type FieldKey, type ProvenanceMap } from "@/data/provenance";
import {
  isPipelineStatus,
  manuscriptStoragePath,
  reviewMap,
  sha256Hex,
  type FieldReview,
  type PipelineStatus,
  type ReviewMap,
  type ReviewState,
} from "@/data/advisor";

// Every call here is authorized by the database (row security and advisor-only functions);
// the advisor routes in the UI are a convenience on top of that, not the control.

type Tables = Database["public"]["Tables"];
export type SubmissionSummary = Database["public"]["Functions"]["advisor_list_submissions"]["Returns"][number];
export type StatusHistoryRow = Tables["submission_status_history"]["Row"];
export type AdvisorNote = Tables["advisor_notes"]["Row"];
export type ReviewEvent = Tables["advisor_review_events"]["Row"];
export type ManuscriptVersion = Tables["manuscript_versions"]["Row"];
export type UploadedDocument = Pick<Tables["documents"]["Row"], "id" | "file_name" | "file_size" | "category" | "status" | "storage_path" | "created_at">;

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

export async function listSubmissions(status: PipelineStatus | null): Promise<SubmissionSummary[]> {
  const { data, error } = await supabase.rpc("advisor_list_submissions", status ? { p_status: status } : {});
  if (error) fail(error, "Couldn't load submissions.");
  return data ?? [];
}

export interface SubmissionDetail {
  id: string;
  userId: string;
  fileId: string;
  intakeStatus: string;
  pipelineStatus: PipelineStatus;
  createdAt: string;
  updatedAt: string;
  /** The values as the prospect certified them (or as saved, if not certified). */
  data: ChamberData;
  provenance: ProvenanceMap;
  /** True when `data` is the certified snapshot. */
  certified: boolean;
  submission: ChamberSubmission | null;
  transcript: ChatMessage[];
  contactName: string | null;
  phone: string | null;
  history: StatusHistoryRow[];
  notes: AdvisorNote[];
  reviews: ReviewMap;
  reviewEvents: ReviewEvent[];
  versions: ManuscriptVersion[];
  documents: UploadedDocument[];
}

export async function loadSubmission(id: string): Promise<SubmissionDetail | null> {
  const [session, workflow, history, notes, reviews, events, versions] = await Promise.all([
    supabase
      .from("chamber_sessions")
      .select("id, user_id, chamber_data, field_provenance, transcript, status, submission, created_at, updated_at")
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

  const [docs, profile] = await Promise.all([
    supabase
      .from("documents")
      .select("id, file_name, file_size, category, status, storage_path, created_at")
      .eq("user_id", row.user_id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("contact_name, phone").eq("user_id", row.user_id).maybeSingle(),
  ]);
  if (docs.error) fail(docs.error, "Couldn't load uploaded documents.");

  const submission = (row.submission as unknown as ChamberSubmission | null) ?? null;
  const certified = row.status === "submitted" && !!submission?.signer_name;
  const useSnapshot = certified && submission?.chamber_data !== undefined;
  return {
    id: row.id,
    userId: row.user_id,
    fileId: submission?.file_id || fileIdForSession(row.id, new Date(row.created_at)),
    intakeStatus: row.status,
    pipelineStatus: isPipelineStatus(workflow.data.status) ? workflow.data.status : "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data: parseChamberData(useSnapshot ? submission!.chamber_data : row.chamber_data),
    // Pair provenance with whichever copy of the data is shown, as the prospect's Manuscript does.
    provenance: parseProvenance(useSnapshot ? submission!.field_provenance : row.field_provenance),
    certified,
    submission,
    transcript: parseTranscript(row.transcript),
    contactName: profile.data?.contact_name ?? null,
    phone: profile.data?.phone ?? null,
    history: history.data ?? [],
    notes: notes.data ?? [],
    reviews: reviewMap((reviews.data ?? []) as unknown as FieldReview[]),
    reviewEvents: events.data ?? [],
    versions: versions.data ?? [],
    documents: docs.data ?? [],
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

export async function reviewField(
  sessionId: string,
  field: FieldKey,
  state: ReviewState | null,
  correction: CorrectionChange,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("review_submission_field", {
    p_session_id: sessionId,
    p_field: field,
    p_review_state: state,
    p_correction: correction.kind,
    p_value: correction.kind === "set" ? (correction.value as Json) : null,
    p_reason: reason.trim() || null,
  });
  if (error) fail(error, "Couldn't save the review.");
}

const SIGNED_URL_SECONDS = 60;

/** A short-lived link to a stored file, issued only if the caller may read it. */
async function signedUrl(bucket: "documents" | "manuscripts", path: string, download?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS, download ? { download } : undefined);
  if (error || !data) fail(error, "Couldn't open that file.");
  return data!.signedUrl;
}

export const documentUrl = (doc: UploadedDocument) => signedUrl("documents", doc.storage_path, doc.file_name);

export const manuscriptUrl = (v: ManuscriptVersion, filename: string) => signedUrl("manuscripts", v.storage_path, filename);

/**
 * Stores a generated Manuscript as the next version of a submission. The database refuses it if
 * someone else generated a version or changed the review in the meantime.
 */
export async function saveManuscriptVersion(opts: {
  sessionId: string;
  version: number;
  pdf: Blob;
  reviewEventId: number;
  correctionsApplied: number;
  sensitiveRevealed: boolean;
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
  });
  if (error || !data) {
    // Not recorded, so not a version: don't leave the file behind.
    await supabase.storage.from("manuscripts").remove([path]);
    fail(error, "Couldn't record the Manuscript version.");
  }
  return data!;
}
