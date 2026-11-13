import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { ChamberData } from "@/data/chamberTypes";
import { parseChamberData } from "@/data/chamberValidation";
import { parseTranscript, type ChatMessage } from "@/data/chat";
import type { ChamberSubmission } from "@/data/manuscript";
import { parseProvenance, type FieldKey, type ProvenanceMap } from "@/data/provenance";
import type { OutboxStatus } from "@/data/outbox";
import type { IntakeSource } from "@/data/intakeSource";
import { contactsOf, EMPTY_PROFILE, parseProfileVersion, profilePayload, type DraftBasis, type EditableProfile, type PeoContact, type ProfileVersion } from "@/data/peoEditor";
import type { ProfilePart, ProfileSource } from "@/data/peoProfiles";
import { parseCertifiedExtraAnswers, parseExtraAnswers, type ExtraAnswers, type ExtraQuestionRef } from "@/data/extraAnswers";
import type { QuoteNoteKind } from "@/data/quoteRequests";
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
export type InformationRequestRow = Tables["information_requests"]["Row"];
export type QuoteRequestRow = Tables["quote_requests"]["Row"];
export type QuoteRequestEventRow = Tables["quote_request_events"]["Row"];
export type QuoteRequestNoteRow = Tables["quote_request_notes"]["Row"];
export type QuoteRequestAddressRow = Tables["quote_request_addresses"]["Row"];
export type QuoteRequestMessageRow = Tables["quote_request_messages"]["Row"];
export type QuoteRequestMailAttachmentRow = Tables["quote_request_message_attachments"]["Row"];
export type QuoteRequestThreadReadRow = Tables["quote_request_thread_reads"]["Row"];

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

/**
 * True when the caller's role is held back only by the second factor: they signed in with a password and
 * haven't completed one (decision D-19). False for everyone else, including a Google or Microsoft sign-in.
 */
export async function fetchNeedsSecondFactor(): Promise<boolean> {
  const { data, error } = await supabase.rpc("advisor_needs_second_factor");
  if (error) fail(error, "Couldn't check your sign-in.");
  return data === true;
}

/** The queue's sorts besides its default: the longest wait on a PEO, or the quote that expires soonest. */
export type QueueSort = "oldest_waiting" | "earliest_expiry";

/** How many submissions the queue shows at a time. */
export const QUEUE_PAGE_SIZE = 25;

export interface SubmissionPage {
  rows: SubmissionSummary[];
  /** How many submissions match the status and search, across every page. */
  total: number;
}

/**
 * One page of the queue, filtered by status (and, with `needsAction`, to the submissions that need advisor
 * action) and searched (every word must appear in the company, contact or reference) in the database.
 * Pages count from 1.
 */
export async function listSubmissions(opts: {
  status: PipelineStatus | null;
  search?: string;
  page?: number;
  needsAction?: boolean;
  /** Only the submissions with a quote request sent and not yet answered. */
  waiting?: boolean;
  sort?: QueueSort | null;
}): Promise<SubmissionPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const { data, error } = await supabase.rpc("advisor_list_submissions", {
    p_status: opts.status,
    p_search: opts.search?.trim() || null,
    p_limit: QUEUE_PAGE_SIZE,
    p_offset: (page - 1) * QUEUE_PAGE_SIZE,
    p_needs_action: opts.needsAction ? true : null,
    p_waiting: opts.waiting ? true : null,
    p_sort: opts.sort ?? null,
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
export type FunnelResult = Database["public"]["Functions"]["advisor_intake_funnel"]["Returns"][number];

/** The pilot funnel for intakes started between `from` and `to`: each step, how many reached it, the median minutes. */
export async function loadFunnel(from: Date, to: Date): Promise<FunnelResult[]> {
  const { data, error } = await supabase.rpc("advisor_intake_funnel", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) fail(error, "Couldn't load the funnel.");
  return data ?? [];
}

export type IntakeSourceResult = Database["public"]["Functions"]["advisor_intake_sources"]["Returns"][number];

/** For intakes started between `from` and `to`: each source, and how many of its intakes reached each step. */
export async function loadIntakeSources(from: Date, to: Date): Promise<IntakeSourceResult[]> {
  const { data, error } = await supabase.rpc("advisor_intake_sources", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) fail(error, "Couldn't load the intakes by source.");
  return data ?? [];
}

// ---------- Referral partners (J-2.3) ----------

export type ReferralPartner = Tables["referral_partners"]["Row"];

/** Every referral partner, by name. */
export async function listReferralPartners(): Promise<ReferralPartner[]> {
  const { data, error } = await supabase.from("referral_partners").select("*").order("name");
  if (error) fail(error, "Couldn't load the referral partners.");
  return data ?? [];
}

/** Adds a partner under a new code. The database refuses a code that is taken or badly formed, with a message to show. */
export async function addReferralPartner(code: string, name: string, kind: string): Promise<ReferralPartner> {
  const { data, error } = await supabase.rpc("advisor_add_referral_partner", { p_code: code, p_name: name, p_kind: kind });
  if (error || !data) fail(error, "Couldn't add the partner.");
  return data as ReferralPartner;
}

/** Renames a partner or changes its kind. Its code never changes. */
export async function updateReferralPartner(code: string, name: string, kind: string): Promise<ReferralPartner> {
  const { data, error } = await supabase.rpc("advisor_update_referral_partner", { p_code: code, p_name: name, p_kind: kind });
  if (error || !data) fail(error, "Couldn't save the partner.");
  return data as ReferralPartner;
}

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

/** Whether an advisor marked the submission as needing advisor action, why, and who last raised or cleared it. */
export interface NeedsAction {
  on: boolean;
  note: string | null;
  at: string | null;
  by: string | null;
  byEmail: string | null;
}

export interface SubmissionDetail {
  id: string;
  userId: string;
  /** The File ID, assigned by the database at the first certification; null for a draft never certified. */
  fileId: string | null;
  intakeStatus: string;
  pipelineStatus: PipelineStatus;
  needsAction: NeedsAction;
  createdAt: string;
  updatedAt: string;
  /** The referral code and campaign tags of the link the intake started from; all null when it had none. */
  source: IntakeSource;
  /** The partner the referral code names, when one is listed. */
  sourcePartnerName: string | null;
  /** The values as the prospect certified them (or as saved, if not certified). */
  data: ChamberData;
  /**
   * The same answers exactly as stored, before the browser tidies them for display. A review names
   * the stored answer it was made on, so the database can refuse it if the prospect has changed it since.
   */
  storedAnswers: Record<string, Json | undefined>;
  provenance: ProvenanceMap;
  /**
   * The answers to PEOs' own extra questions, as `data`: the certified copy while certified, otherwise as they stand.
   * They go only to their PEO. Null when the certification shown was recorded before they were kept: can't tell.
   */
  extraAnswers: ExtraAnswers | null;
  /** True when `data` is the certified snapshot. */
  certified: boolean;
  /**
   * What the prospect signed, when they changed their answers afterwards and so withdrew the
   * certification: `data` is then their current answers, and this the copy they certified.
   */
  signed: {
    data: ChamberData;
    signedAt: string;
    /** The field status and sources as certified. */
    provenance: ProvenanceMap;
    /** The documents set against the list that certification covered (reconcileDocuments). */
    documents: ReviewedDocument[];
    /** The extra answers as certified; null for a certification from before they were kept (can't tell). */
    extraAnswers: ExtraAnswers | null;
  } | null;
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
  /** What advisors have asked the prospect for, newest first. */
  informationRequests: InformationRequestRow[];
  /** The PEOs this submission went to and what each answered, oldest first. */
  quoteRequests: QuoteRequestRow[];
  /** Every change to those quote requests and every correction to their notes, newest first. */
  quoteRequestEvents: QuoteRequestEventRow[];
  /** What happened on those quote requests outside the product, the latest day first. */
  quoteRequestNotes: QuoteRequestNoteRow[];
  /** Each quote request's live reply address: the part before the @. */
  quoteRequestAddresses: QuoteRequestAddressRow[];
  /** The mail that reached those quote requests' reply addresses (held mail, which has no quote request, isn't here). */
  quoteRequestMessages: QuoteRequestMessageRow[];
  /** What became of each attachment on that mail. */
  quoteRequestMailAttachments: QuoteRequestMailAttachmentRow[];
  /** When an advisor last opened each quote request's thread. */
  quoteRequestThreadReads: QuoteRequestThreadReadRow[];
  /** The submission's latest certified version (1, 2, ...); null before the first certification. */
  currentVersion: number | null;
  /**
   * The certification on record (the submission while it stands, else the last chamber_certifications row) kept no
   * field status or no list of the documents it covered: one recorded before 20261104117000 / 20261104120000. What
   * it held can't then be told apart from what the intake holds now.
   */
  certificationLacksSnapshot: boolean;
  /** The quote request whose quote the employer took, once won. */
  wonQuoteRequestId: number | null;
}

/** The columns of a chamber_certifications row the detail page reads. */
interface RecordedCertification {
  file_id: string | null;
  version: number | null;
  signed_at: string | null;
  recorded_at: string | null;
  chamber_data: Json | null;
  field_provenance?: Json | null;
  documents?: Json | null;
  extra_answers?: Json | null;
}

export async function loadSubmission(id: string): Promise<SubmissionDetail | null> {
  const [session, workflow, history, notes, reviews, events, versions] = await Promise.all([
    supabase
      .from("chamber_sessions")
      .select("id, user_id, chamber_data, field_provenance, extra_answers, transcript, status, submission, created_at, updated_at, file_id, referral_code, utm_source, utm_medium, utm_campaign")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("submission_workflow")
      .select("status, needs_action, needs_action_note, needs_action_at, needs_action_by, needs_action_by_email, won_quote_request_id")
      .eq("session_id", id)
      .maybeSingle(),
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

  const [docs, profile, docEvents, requests, lastCertification, partner, quotes, quoteEvents, quoteNotes, quoteAddresses] = await Promise.all([
    supabase
      .from("documents")
      .select("id, file_name, file_size, category, status, storage_path, created_at, file_sha256, scan_verdict")
      // This intake's uploads only, not everything the same prospect has ever uploaded.
      .eq("session_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("contact_name, phone").eq("user_id", row.user_id).maybeSingle(),
    supabase.from("document_events").select("*").eq("session_id", id).order("id", { ascending: false }),
    supabase.from("information_requests").select("*").eq("session_id", id).order("id", { ascending: false }),
    // The latest certification on record (append-only, written by the database): what a withdrawn
    // certification covered, and its File ID. Never the intake's own `submission`, which a prospect could
    // rewrite once their certification was withdrawn before 20261106090000_hardening.sql.
    // chamber_certifications isn't in the generated types (src/integrations/supabase/types.ts).
    (supabase as unknown as SupabaseClient)
      .from("chamber_certifications")
      .select("file_id, version, signed_at, recorded_at, chamber_data, field_provenance, documents, extra_answers")
      .eq("session_id", id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // The partner behind the referral code, if one is listed.
    row.referral_code
      ? supabase.from("referral_partners").select("name").eq("code", row.referral_code).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("quote_requests").select("*").eq("session_id", id).order("id", { ascending: true }),
    supabase.from("quote_request_events").select("*").eq("session_id", id).order("id", { ascending: false }),
    supabase
      .from("quote_request_notes")
      .select("*")
      .eq("session_id", id)
      .order("noted_on", { ascending: false })
      .order("id", { ascending: false }),
    // The live address of each quote request; revoked ones stay in the table and aren't shown.
    supabase.from("quote_request_addresses").select("*").eq("session_id", id).is("revoked_at", null),
  ]);
  if (docs.error) fail(docs.error, "Couldn't load uploaded documents.");
  if (lastCertification.error) fail(lastCertification.error, "Couldn't load the certification on record.");
  const recorded = lastCertification.data as RecordedCertification | null;
  if (docEvents.error) fail(docEvents.error, "Couldn't load the document history.");
  if (requests.error) fail(requests.error, "Couldn't load the requests sent to the prospect.");
  if (partner.error) fail(partner.error, "Couldn't load the referral partner.");
  if (quotes.error) fail(quotes.error, "Couldn't load the quote requests.");
  if (quoteEvents.error) fail(quoteEvents.error, "Couldn't load the quote requests' history.");
  if (quoteNotes.error) fail(quoteNotes.error, "Couldn't load the quote requests' notes.");
  if (quoteAddresses.error) fail(quoteAddresses.error, "Couldn't load the quote requests' reply addresses.");

  // The mail on those quote requests, then what depends on it. Read after the quote requests, so a failure here
  // is named for what it loads; the thread is only as complete as these.
  const requestIds = (quotes.data ?? []).map((q) => q.id);
  const [mail, threadReads] = await Promise.all([
    supabase.from("quote_request_messages").select("*").eq("session_id", id).order("recorded_at", { ascending: false }).order("id", { ascending: false }),
    requestIds.length > 0
      ? supabase.from("quote_request_thread_reads").select("*").in("quote_request_id", requestIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (mail.error) fail(mail.error, "Couldn't load the mail on the quote requests.");
  if (threadReads.error) fail(threadReads.error, "Couldn't load which threads were opened.");
  const mailIds = (mail.data ?? []).map((m) => m.id);
  const mailAttachments =
    mailIds.length > 0
      ? await supabase.from("quote_request_message_attachments").select("*").in("message_id", mailIds).order("id", { ascending: true })
      : { data: [], error: null };
  if (mailAttachments.error) fail(mailAttachments.error, "Couldn't load the attachments on that mail.");

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
    fileId: row.file_id ?? recorded?.file_id ?? null,
    intakeStatus: row.status,
    pipelineStatus: isPipelineStatus(workflow.data.status) ? workflow.data.status : "draft",
    needsAction: {
      on: workflow.data.needs_action === true,
      note: workflow.data.needs_action_note ?? null,
      at: workflow.data.needs_action_at ?? null,
      by: workflow.data.needs_action_by ?? null,
      byEmail: workflow.data.needs_action_by_email ?? null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: {
      referral_code: row.referral_code ?? null,
      utm_source: row.utm_source ?? null,
      utm_medium: row.utm_medium ?? null,
      utm_campaign: row.utm_campaign ?? null,
    },
    sourcePartnerName: partner.data?.name ?? null,
    data: parseChamberData(shown),
    storedAnswers,
    // Pair provenance with whichever copy of the data is shown, as the prospect's Manuscript does.
    provenance: parseProvenance(useSnapshot ? submission!.field_provenance : row.field_provenance),
    extraAnswers: certified ? parseCertifiedExtraAnswers((submission as { extra_answers?: unknown }).extra_answers) : parseExtraAnswers(row.extra_answers),
    certified,
    signed:
      !certified && recorded && recorded.chamber_data !== null && recorded.chamber_data !== undefined
        ? {
            data: parseChamberData(recorded.chamber_data),
            signedAt: recorded.recorded_at ?? recorded.signed_at,
            provenance: parseProvenance(recorded.field_provenance),
            documents: reconcileDocuments(docs.data ?? [], recorded.documents ?? undefined),
            extraAnswers: parseCertifiedExtraAnswers(recorded.extra_answers),
          }
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
    informationRequests: requests.data ?? [],
    quoteRequests: quotes.data ?? [],
    quoteRequestEvents: quoteEvents.data ?? [],
    quoteRequestNotes: quoteNotes.data ?? [],
    quoteRequestAddresses: quoteAddresses.data ?? [],
    quoteRequestMessages: mail.data ?? [],
    quoteRequestMailAttachments: mailAttachments.data ?? [],
    quoteRequestThreadReads: threadReads.data ?? [],
    currentVersion: recorded?.version ?? null,
    certificationLacksSnapshot: certified
      ? (useSnapshot && submission!.field_provenance == null) || !Array.isArray(submission!.documents)
      : !!recorded && (recorded.field_provenance == null || !Array.isArray(recorded.documents)),
    wonQuoteRequestId: workflow.data.won_quote_request_id ?? null,
  };
}

/** Moves the pipeline one step. Marking it won names the quote request whose quote the employer took. */
export async function setStatus(sessionId: string, status: PipelineStatus, note: string, wonQuoteRequestId?: number): Promise<void> {
  const { error } = await supabase.rpc("set_submission_status", {
    p_session_id: sessionId,
    p_status: status,
    p_note: note.trim() || null,
    p_won_quote_request_id: status === "won" ? wonQuoteRequestId ?? null : null,
  });
  if (error) fail(error, "Couldn't change the status.");
}

/**
 * Marks a submission as needing advisor action, with an optional note, or clears it. The database records
 * each change in the status history at the current stage.
 */
export async function setNeedsAction(sessionId: string, needsAction: boolean, note: string): Promise<void> {
  const { error } = await supabase.rpc("set_submission_needs_action", {
    p_session_id: sessionId,
    p_needs_action: needsAction,
    p_note: note.trim() || null,
  });
  if (error) fail(error, needsAction ? "Couldn't mark this submission." : "Couldn't clear the mark.");
}

/**
 * Asks the prospect for more information: records the request, moves the pipeline to information requested (or
 * keeps it there), and emails the prospect, in one transaction. `fields` are the answers it is about.
 */
export async function requestInformation(sessionId: string, message: string, fields: readonly FieldKey[], questions: readonly ExtraQuestionRef[] = []): Promise<void> {
  const { error } = await supabase.rpc("advisor_request_information", {
    p_session_id: sessionId,
    p_message: message.trim(),
    p_fields: [...fields],
    // A PEO's own extra questions it names (20261115130000): by PEO, key and wording.
    p_extra_questions: questions.map((q) => ({ peo_id: q.peo_id, key: q.key, question: q.question })) as unknown as Json,
  });
  if (error) fail(error, "Couldn't send the request.");
}

// ---------- Quote requests (joshrkay/Nevermore#82) ----------

/**
 * Records that the packet went to a PEO on `sentOn` (YYYY-MM-DD): a new quote request, or the PEO's existing one
 * continued with the latest version. Refused before Ready for market.
 */
export async function recordQuoteSend(sessionId: string, peo: string, sentOn: string): Promise<void> {
  const { error } = await supabase.rpc("advisor_record_quote_send", { p_session_id: sessionId, p_peo: peo, p_sent_on: sentOn });
  if (error) fail(error, "Couldn't record the send.");
}

/** What a PEO answered: its quote's terms only when it quoted (dates YYYY-MM-DD, the fee in dollars). */
export interface QuoteAnswer {
  status: "quoted" | "declined" | "closed";
  receivedOn: string | null;
  expiresOn: string | null;
  startOn: string | null;
  adminFeePepm: number | null;
  note: string | null;
}

/** Records a PEO's answer on a quote request, replacing what was recorded before. Every change is logged. */
export async function updateQuoteRequest(id: number, answer: QuoteAnswer): Promise<void> {
  const { error } = await supabase.rpc("advisor_update_quote_request", {
    p_quote_request_id: id,
    p_status: answer.status,
    p_received_on: answer.receivedOn,
    p_expires_on: answer.expiresOn,
    p_start_on: answer.startOn,
    p_admin_fee_pepm: answer.adminFeePepm,
    p_note: answer.note,
  });
  if (error) fail(error, "Couldn't record the answer.");
}

/**
 * Revokes a quote request's reply address and issues a new one. Mail sent to the old address no longer reaches
 * the quote request, so the PEO has to be given the new one.
 */
export async function reissueQuoteRequestAddress(quoteRequestId: number): Promise<void> {
  const { error } = await supabase.rpc("advisor_reissue_quote_request_address", { p_quote_request_id: quoteRequestId });
  if (error) fail(error, "Couldn't issue a new address.");
}

/**
 * Marks a quote request's thread opened, for the whole team, through `seenThrough`: the time of the latest message
 * the page showed, exactly as it was loaded, so mail that arrived since stays new. With none it is now.
 */
export async function openQuoteRequestThread(quoteRequestId: number, seenThrough: string | null): Promise<void> {
  const { error } = await supabase.rpc("advisor_open_quote_request_thread", { p_quote_request_id: quoteRequestId, p_seen_through: seenThrough });
  if (error) fail(error, "Couldn't mark the thread as read.");
}

type HeldMailAction =
  | { action: "move_off"; message_id: number; note?: string }
  | { action: "assign"; message_id: number; quote_request_id: number }
  | { action: "discard"; message_id: number };

/** Asks the held-mail function to move, assign or discard a message and its files. The database checks who may. */
async function heldMail(body: HeldMailAction, fallback: string): Promise<void> {
  const { error } = await supabase.functions.invoke("held-mail", { body });
  if (!error) return;
  let message = fallback;
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    const said = await context.json().catch(() => null) as { error?: unknown } | null;
    if (typeof said?.error === "string") message = said.error;
    if (context.status === 403) throw new AdvisorApiError(message, "42501");
  }
  throw new AdvisorApiError(message);
}

/** An advisor moves a message off its thread to the holding list, with the files, and may say why. */
export const moveMessageOffThread = (messageId: number, note?: string) =>
  heldMail({ action: "move_off", message_id: messageId, note: note?.trim() || undefined }, "Couldn't move the message.");

/** An admin assigns a held message to a quote request. */
export const assignHeldMessage = (messageId: number, quoteRequestId: number) =>
  heldMail({ action: "assign", message_id: messageId, quote_request_id: quoteRequestId }, "Couldn't assign the message.");

/** An admin discards a held message and its files. Nobody is told. */
export const discardHeldMessage = (messageId: number) => heldMail({ action: "discard", message_id: messageId }, "Couldn't discard the message.");

/** Whether the signed-in advisor is also an admin (held mail, organisations, editing PEO profiles). The database checks it again on every write. */
export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", { _role: "admin" });
  if (error) fail(error, "Couldn't check admin access.");
  return data === true;
}

/** A quote request an admin can assign held mail to: its PEO and employer, and the address it once had. */
export interface AssignableRequest {
  id: number;
  fileId: string;
  company: string;
  peo: string;
  localParts: string[];
}

export interface HeldMail {
  messages: QuoteRequestMessageRow[];
  attachments: QuoteRequestMailAttachmentRow[];
  requests: AssignableRequest[];
  /** The file ID and PEO of each quote request an advisor moved a message from, for the "moved from" line. */
  names: Map<number, string>;
}

/** The holding list, oldest first, with what an admin needs to place each message. Admins only: row security returns nothing else. */
export async function loadHeldMail(): Promise<HeldMail> {
  const held = await supabase.from("quote_request_messages").select("*").is("quote_request_id", null).order("held_at", { ascending: true });
  if (held.error) fail(held.error, "Couldn't load the holding list.");
  const messages = held.data ?? [];
  const attachments = messages.length
    ? await supabase.from("quote_request_message_attachments").select("*").in("message_id", messages.map((m) => m.id))
    : { data: [], error: null };
  if (attachments.error) fail(attachments.error, "Couldn't load the holding list.");
  const requests = await supabase.from("quote_requests").select("id, session_id, peo_name").order("id", { ascending: false });
  if (requests.error) fail(requests.error, "Couldn't load the quote requests.");
  const rows = requests.data ?? [];
  const sessionIds = [...new Set(rows.map((r) => r.session_id))];
  const [summaries, addresses] = await Promise.all([
    sessionIds.length ? supabase.from("chamber_sessions").select("id, file_id, chamber_data").in("id", sessionIds) : { data: [], error: null },
    rows.length ? supabase.from("quote_request_addresses").select("quote_request_id, local_part").in("quote_request_id", rows.map((r) => r.id)) : { data: [], error: null },
  ]);
  if (summaries.error) fail(summaries.error, "Couldn't load the quote requests.");
  if (addresses.error) fail(addresses.error, "Couldn't load the quote requests.");
  const bySession = new Map((summaries.data ?? []).map((r) => [r.id, r]));
  const requestsOut: AssignableRequest[] = rows.map((r) => ({
    id: r.id,
    fileId: bySession.get(r.session_id)?.file_id ?? "",
    company: String((bySession.get(r.session_id)?.chamber_data as { company_name?: unknown } | null)?.company_name ?? "Unnamed"),
    peo: r.peo_name,
    localParts: (addresses.data ?? []).filter((a) => a.quote_request_id === r.id).map((a) => a.local_part),
  }));
  return {
    messages,
    attachments: attachments.data ?? [],
    requests: requestsOut,
    names: new Map(requestsOut.map((r) => [r.id, `${r.fileId || `quote request ${r.id}`}, ${r.peo}`])),
  };
}

/** Whether the signed-in broker's own mailbox is connected (public.my_mailbox): never the token. */
export interface MyMailbox {
  connected: boolean;
  provider?: "google" | "microsoft";
  address?: string;
  connectedAt?: string;
}

export async function fetchMyMailbox(): Promise<MyMailbox> {
  const { data, error } = await supabase.rpc("my_mailbox");
  if (error) fail(error, "Couldn't check your mailbox.");
  const row = (data ?? {}) as { connected?: boolean; provider?: "google" | "microsoft"; address?: string; connected_at?: string };
  return row.connected ? { connected: true, provider: row.provider, address: row.address, connectedAt: row.connected_at } : { connected: false };
}

/** Disconnects the broker's mailbox: the stored token is deleted, and a send then says no mailbox is connected. */
export async function disconnectMailbox(): Promise<void> {
  const { error } = await supabase.functions.invoke("mailbox", { body: { action: "disconnect" } });
  if (error) throw new AdvisorApiError("Couldn't disconnect your mailbox. Try again.");
}

export type AllowedOrganisationRow = Tables["allowed_organisations"]["Row"];
export type AdvisorRoleEventRow = Tables["advisor_role_events"]["Row"];

/** The organisations whose members get the advisor role without an admin, and the log of changes and grants. Admins only. */
export async function loadOrganisationRule(): Promise<{ organisations: AllowedOrganisationRow[]; events: AdvisorRoleEventRow[] }> {
  const [orgs, events] = await Promise.all([
    supabase.from("allowed_organisations").select("*").order("added_at", { ascending: false }),
    supabase.from("advisor_role_events").select("*").order("at", { ascending: false }).limit(50),
  ]);
  if (orgs.error) fail(orgs.error, "Couldn't load the allowed organisations.");
  if (events.error) fail(events.error, "Couldn't load the allowed organisations.");
  return { organisations: orgs.data ?? [], events: events.data ?? [] };
}

/** Adds an organisation (a Google domain or a Microsoft tenant ID). The database refuses free-mail domains and says why. */
export async function addAllowedOrganisation(provider: "google" | "microsoft", orgId: string, label: string): Promise<void> {
  const { error } = await supabase.rpc("admin_add_allowed_organisation", { p_provider: provider, p_org_id: orgId, p_label: label });
  if (error) fail(error, "Couldn't add the organisation.");
}

export async function removeAllowedOrganisation(id: number): Promise<void> {
  const { error } = await supabase.rpc("admin_remove_allowed_organisation", { p_id: id });
  if (error) fail(error, "Couldn't remove the organisation.");
}

/** A quote request note as the form holds it: its kind, the day it happened (YYYY-MM-DD) and its text. */
export interface QuoteNoteInput {
  kind: QuoteNoteKind;
  notedOn: string;
  body: string;
}

/**
 * Adds a note to a quote request for something that happened outside the product. It changes nothing else: not
 * the status, and not the send, even when the note is of an email sent elsewhere.
 */
export async function addQuoteRequestNote(quoteRequestId: number, note: QuoteNoteInput): Promise<void> {
  const { error } = await supabase.rpc("advisor_add_quote_request_note", {
    p_quote_request_id: quoteRequestId,
    p_kind: note.kind,
    p_noted_on: note.notedOn,
    p_body: note.body.trim(),
  });
  if (error) fail(error, "Couldn't save the note.");
}

/** Corrects a note's kind, date or text. Each value changed is logged with the one it replaced. */
export async function correctQuoteRequestNote(noteId: number, note: QuoteNoteInput): Promise<void> {
  const { error } = await supabase.rpc("advisor_correct_quote_request_note", {
    p_note_id: noteId,
    p_kind: note.kind,
    p_noted_on: note.notedOn,
    p_body: note.body.trim(),
  });
  if (error) fail(error, "Couldn't correct the note.");
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

/**
 * Tells the firm's record of who did what that the caller opened a submission or downloaded a file (CRM-P2.3). Only the
 * kind and the record's id are sent: the database works out the firm and the person, and refuses a record that isn't in
 * a firm the caller belongs to. Best effort: a failure is never shown and never stops what the advisor was doing.
 */
export async function recordActivity(
  kind: "submission_viewed" | "document_downloaded" | "packet_downloaded",
  recordType: "submission" | "document" | "manuscript",
  recordId: string,
): Promise<void> {
  try {
    await supabase.rpc("record_member_activity", { p_kind: kind, p_record_type: recordType, p_record_id: recordId });
  } catch {
    // Not recorded; the advisor's work goes on.
  }
}

export type FirmActivityEntry = Database["public"]["Functions"]["firm_activity_list"]["Returns"][number];
export type FirmActivityPerson = Database["public"]["Functions"]["firm_activity_people"]["Returns"][number];
/** Entries on a page of the firm's record. */
export const FIRM_ACTIVITY_PAGE_SIZE = 25;

/** The firm the signed-in person currently owns, or null: only an owner reads a firm's record. */
export async function fetchOwnedFirm(): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_owner_firm");
  if (error) fail(error, "Couldn't check your role in your firm.");
  return data ?? null;
}

/** Who appears as the doer in the firm's record, for the person filter. Owners only. */
export async function listFirmActivityPeople(firmId: string): Promise<FirmActivityPerson[]> {
  const { data, error } = await supabase.rpc("firm_activity_people", { p_firm_id: firmId });
  if (error) fail(error, "Couldn't load the people in the record.");
  return data ?? [];
}

/**
 * One page of the firm's record, newest first, filtered by the person who did it and the kind (null keeps all). Pages
 * count from 1. One more row than a page is asked for, to say whether another page follows. Owners only: for anyone else
 * the database refuses (code 42501, `forbidden` on the error).
 */
export async function listFirmActivity(
  firmId: string,
  opts: { person: string | null; kind: string | null; page: number },
): Promise<{ entries: FirmActivityEntry[]; hasMore: boolean }> {
  const page = Math.max(1, Math.floor(opts.page));
  const { data, error } = await supabase.rpc("firm_activity_list", {
    p_firm_id: firmId,
    p_person: opts.person,
    p_kind: opts.kind,
    p_limit: FIRM_ACTIVITY_PAGE_SIZE + 1,
    p_offset: (page - 1) * FIRM_ACTIVITY_PAGE_SIZE,
  });
  if (error) fail(error, "Couldn't load the record.");
  const rows = data ?? [];
  return { entries: rows.slice(0, FIRM_ACTIVITY_PAGE_SIZE), hasMore: rows.length > FIRM_ACTIVITY_PAGE_SIZE };
}

/** How long a link to a stored file works. src/lib/fileLinks.test.ts holds every link to this. */
export const SIGNED_URL_SECONDS = 60;

/**
 * A short-lived link to a stored file, issued only if the caller may read it. Every link asks Storage for
 * `Content-Disposition: attachment`, so the browser saves the file and never shows it inline. Storage
 * doesn't sign that request, but every document is also stored as application/octet-stream
 * (20261104130000_document_scanning.sql), which a browser downloads whatever the link says.
 */
async function signedUrl(bucket: "documents" | "manuscripts" | "peo-mail", path: string, download: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: downloadName(download) });
  if (error || !data) fail(error, "Couldn't open that file.");
  return data!.signedUrl;
}

export const documentUrl = (doc: Pick<UploadedDocument, "storage_path" | "file_name">) =>
  signedUrl("documents", doc.storage_path, doc.file_name);

/**
 * One uploaded document's file, read on the caller's own storage rights: the same policies that sign its links, so a
 * file blocked or not yet through its virus check is refused. For a PEO's bundle, which carries the file itself. A
 * refusal says only that the file couldn't be opened, never its path.
 */
export async function documentFile(doc: Pick<UploadedDocument, "storage_path">): Promise<Blob> {
  const { data, error } = await supabase.storage.from("documents").download(doc.storage_path);
  if (error && isEndedSession(error)) fail(error, "Couldn't open that file.");
  if (error || !data) throw new AdvisorApiError("Couldn't open that file.");
  return data;
}

/** A signed link to an attachment on PEO mail, which only a scanned-clean one has a file for. */
export const mailAttachmentUrl = (a: { storage_path: string | null; file_name: string }) => {
  if (!a.storage_path) throw new AdvisorApiError("That file isn't stored: it was blocked, not kept, or is still being checked.");
  return signedUrl("peo-mail", a.storage_path, a.file_name);
};

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
  if (upload.error) fail(upload.error as { message: string }, "Couldn't store the packet.");
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
    fail(error, "Couldn't record the packet version.");
  }
  return data!;
}

// ---------- PEOs and their requirement profiles (L-1.2, the PEOs page) ----------

/* fetchIsAdmin (above, with held mail) says whether the signed-in advisor is also an admin: only admins edit profiles. */

/** A PEO on the PEOs page: whether it is listed, and every version an advisor may read (drafts for admins), newest first. */
export interface PeoDirectoryEntry {
  id: number;
  name: string;
  listed: boolean;
  versions: ProfileVersion[];
}

/** Versions whose contacts one request reads: at most 20 contacts each, well under the API's row cap. */
const CONTACT_VERSIONS_PER_READ = 40;

async function contactRows(versionIds: readonly number[]): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < versionIds.length; i += CONTACT_VERSIONS_PER_READ) {
    const { data, error } = await supabase.from("peo_contacts").select("*")
      .in("profile_version_id", versionIds.slice(i, i + CONTACT_VERSIONS_PER_READ)).order("position");
    if (error) fail(error, "Couldn't load the PEOs' contacts.");
    rows.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return rows;
}

/**
 * Every PEO with its profile versions, as row security lets the reader see them: advisors read the published
 * versions, admins drafts too (20261115090000). Alphabetical. Only the contacts of each PEO's version in use and its
 * draft are read, the ones the page shows and an edit starts from; an older version's are read with
 * loadVersionContacts() when its history is opened, and until then it lists none.
 */
export async function loadPeoDirectory(): Promise<PeoDirectoryEntry[]> {
  const [peos, versions] = await Promise.all([
    supabase.from("peos").select("id, name, listed").order("name"),
    supabase.from("peo_profile_versions").select("*").order("version", { ascending: false }),
  ]);
  for (const r of [peos, versions]) if (r.error) fail(r.error, "Couldn't load the PEOs.");
  const rows = (versions.data ?? []) as Record<string, unknown>[];
  const current = (peoId: number) => {
    const mine = rows.filter((v) => Number(v.peo_id) === peoId);
    const inUse = mine.filter((v) => v.status === "published").sort((a, b) => Number(b.version) - Number(a.version))[0];
    return [mine.find((v) => v.status === "draft"), inUse].filter(Boolean).map((v) => Number(v!.id));
  };
  const contacts = await contactRows((peos.data ?? []).flatMap((p) => current(p.id)));
  return [...(peos.data ?? [])]
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    .map((p) => ({
      id: p.id,
      name: p.name,
      listed: p.listed,
      versions: rows
        .filter((v) => Number(v.peo_id) === p.id)
        .map((v) => parseProfileVersion(p.name, v, contacts))
        .sort((a, b) => b.version - a.version),
    }));
}

/** The contacts each of these profile versions names, in order, by version id: for a PEO's history. */
export async function loadVersionContacts(versionIds: readonly number[]): Promise<Map<number, PeoContact[]>> {
  const rows = await contactRows(versionIds);
  return new Map(versionIds.map((id) => [id, contactsOf(id, rows)]));
}

/** Adds a PEO, listed, with no profile. The database refuses a name already listed, in words to show. */
export async function addPeo(name: string): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc("admin_add_peo", { p_name: name });
  if (error || !data) fail(error, "Couldn't add the PEO.");
  return data as { id: number };
}

/**
 * Saves the PEO's draft from the whole profile, making the draft when there is none. `basis` is what the editor was
 * based on: the database refuses the save (PT409) when the draft changed since, so old content is never written back.
 */
export async function savePeoDraft(peoId: number, profile: EditableProfile, basis: DraftBasis): Promise<void> {
  const { error } = await supabase.rpc("admin_save_peo_profile", {
    p_peo_id: peoId,
    p_profile: profilePayload(profile) as Json,
    p_draft_revision: basis.draftRevision,
    p_in_use_version: basis.inUseVersion,
  });
  if (error) fail(error, "Couldn't save the draft.");
}

/**
 * Publishes the PEO's draft, the revision the admin reviewed: it is the profile in use from now on, and never changes.
 * The database refuses it (PT409) when the draft changed since.
 */
export async function publishPeoDraft(peoId: number, draftRevision: string | null): Promise<void> {
  const { error } = await supabase.rpc("admin_publish_peo_profile", { p_peo_id: peoId, p_draft_revision: draftRevision });
  if (error) fail(error, "Couldn't publish the draft.");
}

/** Drops the PEO's draft. Nobody but admins ever saw it. */
export async function discardPeoDraft(peoId: number): Promise<void> {
  const { error } = await supabase.rpc("admin_discard_peo_draft", { p_peo_id: peoId });
  if (error) fail(error, "Couldn't discard the draft.");
}

/** "Checked again, nothing changed": a new published version, with `source` for each part re-checked. */
export async function recheckPeoProfile(peoId: number, parts: readonly ProfilePart[], source: ProfileSource): Promise<void> {
  const payload = profilePayload({ ...EMPTY_PROFILE, sources: Object.fromEntries(parts.map((p) => [p, source])) }).sources as Json;
  const { error } = await supabase.rpc("admin_recheck_peo_profile", { p_peo_id: peoId, p_sources: payload });
  if (error) fail(error, "Couldn't record the re-check.");
}

/** Lists a PEO again, or takes it off the list. Nothing else about it changes. */
export async function setPeoListed(peoId: number, listed: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_set_peo_listed", { p_peo_id: peoId, p_listed: listed });
  if (error) fail(error, "Couldn't change whether the PEO is listed.");
}
