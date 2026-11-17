import { PIPELINE_TRANSITIONS, type PipelineStatus } from "./advisor";

// Quote requests (GLOSSARY.md): which PEOs a submission was sent to and what each answered. Advisors record them
// after acting outside the product; the prospect never sees them. The database is
// supabase/migrations/20261110090000_quote_requests.sql.

/** Where one PEO's quote request stands. src/data/schemaSync.test.ts keeps this list equal to the database's. */
export const QUOTE_REQUEST_STATUSES = ["sent", "acknowledged", "question_open", "quoted", "declined", "closed"] as const;
export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

export const QUOTE_REQUEST_LABELS: Record<QuoteRequestStatus, string> = {
  sent: "Sent",
  acknowledged: "Acknowledged",
  question_open: "Question open",
  quoted: "Quoted",
  declined: "Declined",
  closed: "Closed",
};

/**
 * The pipeline stages at which a send can be recorded: the advisor has reviewed the file. The database holds the
 * same list (advisor_record_quote_send); src/data/schemaSync.test.ts keeps them equal.
 */
export const SENDABLE_STAGES = ["ready_for_market", "sent_to_carrier", "quoted"] as const satisfies readonly PipelineStatus[];

export const canRecordSend = (stage: PipelineStatus) => (SENDABLE_STAGES as readonly PipelineStatus[]).includes(stage);

/**
 * What kind of thing a quote request note records (GLOSSARY.md, Quote request note). The database holds the same
 * list (20261111090000_quote_request_notes.sql); src/data/schemaSync.test.ts keeps them equal.
 */
export const QUOTE_NOTE_KINDS = ["call", "portal_entry", "email_elsewhere", "underwriter_question", "other"] as const;
export type QuoteNoteKind = (typeof QUOTE_NOTE_KINDS)[number];

export const QUOTE_NOTE_KIND_LABELS: Record<QuoteNoteKind, string> = {
  call: "Call",
  portal_entry: "Portal entry",
  email_elsewhere: "Email sent elsewhere",
  underwriter_question: "Underwriter's question",
  other: "Other",
};

/**
 * The subdomain that receives mail for quote requests (VITE_QUOTE_REPLY_DOMAIN), or null while receiving is
 * switched off. With none set the console shows no reply address, so nobody copies one that can't receive.
 */
export function quoteReplyDomain(value: unknown = import.meta.env.VITE_QUOTE_REPLY_DOMAIN): string | null {
  const domain = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain) ? domain : null;
}

/** A quote request's whole reply address, from the part the database holds and the receiving subdomain. */
export const replyAddress = (localPart: string, domain: string) => `${localPart}@${domain}`;

/**
 * What became of an attachment on PEO mail. The database holds the same lists
 * (20261111110000_quote_request_messages.sql); src/data/schemaSync.test.ts keeps them equal.
 */
export const MAIL_ATTACHMENT_STATUSES = ["pending", "stored", "blocked", "not_kept"] as const;
export const MAIL_NOT_KEPT_REASONS = ["too_large", "unsupported_type", "type_mismatch", "executable"] as const;

/** The longest a message's text can be; the receiving function cuts to it and the database refuses more. */
export const MAIL_BODY_MAX = 100_000;

/** The longest a note can be; the database refuses a longer one. */
export const QUOTE_NOTE_MAX = 2000;

export const isQuoteNoteKind = (k: unknown): k is QuoteNoteKind =>
  typeof k === "string" && (QUOTE_NOTE_KINDS as readonly string[]).includes(k);

export const quoteNoteKindLabel = (kind: string) => (isQuoteNoteKind(kind) ? QUOTE_NOTE_KIND_LABELS[kind] : kind);

/**
 * The statuses of a PEO that has the packet and has not answered with a quote or a decline: Sent, Acknowledged and Question open (CRM-Q3.1). A
 * submission archived, won or lost closes every one of them; wherever a Sent quote request counts as open, these count.
 */
export const OPEN_QUOTE_REQUEST_STATUSES = ["sent", "acknowledged", "question_open"] as const;

export const isOpenQuoteRequest = (status: unknown): boolean =>
  typeof status === "string" && (OPEN_QUOTE_REQUEST_STATUSES as readonly string[]).includes(status);

export const isQuoteRequestStatus = (s: unknown): s is QuoteRequestStatus =>
  typeof s === "string" && (QUOTE_REQUEST_STATUSES as readonly string[]).includes(s);

/** A calendar date as stored (YYYY-MM-DD), the way the console shows it: "Nov 10, 2026". */
export const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** A quote's terms on one line: the fee first, then whichever dates were recorded. */
export function describeQuote(q: {
  admin_fee_pepm: number | null;
  quote_received_on: string | null;
  quote_expires_on: string | null;
  proposed_start_on: string | null;
}): string {
  return [
    q.admin_fee_pepm !== null ? `${money(Number(q.admin_fee_pepm))} per employee per month` : null,
    q.quote_received_on ? `received ${formatDay(q.quote_received_on)}` : null,
    q.quote_expires_on ? `expires ${formatDay(q.quote_expires_on)}` : null,
    q.proposed_start_on ? `start ${formatDay(q.proposed_start_on)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * "Sent v2, current v3" when a PEO still working on the submission (its request sent, acknowledged, with a question open, or quoted) has an older
 * version than the latest certified; null otherwise. The quote itself stands: the advisor decides whether to resend.
 */
export function olderVersionNote(
  r: { status: string; sent_version: number | null },
  currentVersion: number | null,
): string | null {
  if (!(isOpenQuoteRequest(r.status) || r.status === "quoted")) return null;
  if (r.sent_version === null || currentVersion === null || r.sent_version >= currentVersion) return null;
  return `Sent v${r.sent_version}, current v${currentVersion}`;
}

/**
 * The version a PEO holds when it is offered the update (M-2.3): a quote request still open on the submission (sent or quoted, as the queue's "A PEO
 * has an older version" counts it) that was sent an older version than the latest certified. Null when there is no update to offer.
 */
export function updateFrom(r: { status: string; sent_version: number | null } | undefined, currentVersion: number | null): number | null {
  if (!r || !(isOpenQuoteRequest(r.status) || r.status === "quoted")) return null;
  if (r.sent_version === null || currentVersion === null || r.sent_version >= currentVersion) return null;
  return r.sent_version;
}

/**
 * "Quote given on version 1; version 2 sent since" (M-2.3): a quoted request's quote was given on an older version than the one sent since, until the
 * advisor records the PEO's new answer (quote_requests.quoted_version, 20261122180000). Null otherwise.
 */
export function quotedOnOlderNote(r: { status: string; sent_version: number | null; quoted_version?: number | null }): string | null {
  if (r.status !== "quoted" || r.quoted_version == null || r.sent_version === null || r.quoted_version >= r.sent_version) return null;
  return `Quote given on version ${r.quoted_version}; version ${r.sent_version} sent since`;
}

/** Why a PEO was withdrawn (quote_requests.withdrawn_reason), for advisors only; the database's list, compared by schemaSync.test.ts. */
export const WITHDRAWAL_REASONS = [
  // sync:begin withdrawal_reasons
  "employer_went_elsewhere", "prospect_withdrew_peo", "peo_not_a_fit", "other",
  // sync:end withdrawal_reasons
] as const;
export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number];

export const WITHDRAWAL_REASON_LABELS: Record<WithdrawalReason, string> = {
  employer_went_elsewhere: "The employer went elsewhere",
  prospect_withdrew_peo: "The prospect withdrew this PEO",
  peo_not_a_fit: "The PEO is not a fit",
  other: "Other",
};

/** Why a PEO declined (quote_requests.decline_reason, N-1.4); the database's list, compared by schemaSync.test.ts. */
export const DECLINE_REASONS = [
  // sync:begin decline_reasons
  "industry", "too_small", "too_large", "claims_history", "states", "missing_information", "pricing", "other",
  // sync:end decline_reasons
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  industry: "Outside their appetite (industry)",
  too_small: "Too small",
  too_large: "Too large",
  claims_history: "Claims history",
  states: "A state they don't cover",
  missing_information: "Missing information",
  pricing: "Won't price it competitively",
  other: "Other",
};

/** The most characters of a PEO's own words a decline keeps (the database's limit). */
export const DECLINE_WORDS_MAX = 500;

const FIELD_NAMES: Record<string, string> = {
  status: "Status",
  peo_name: "PEO",
  sent_on: "Sent on",
  sent_version: "Version sent",
  quoted_version: "Quote given on version",
  quote_received_on: "Received on",
  quote_expires_on: "Expires on",
  proposed_start_on: "Proposed start",
  admin_fee_pepm: "Admin fee per employee per month",
  note: "Note",
  reply_address: "Reply address",
  note_kind: "Note kind",
  note_noted_on: "Note date",
  note_body: "Note text",
  withdrawn_reason: "Why withdrawn",
  decline_reason: "Why declined",
  decline_words: "The PEO's words",
};

// A message moved on or off a thread (story M-3.3): the event names the message by id and carries nothing from it.
const MAIL_EVENT_LABELS: Record<string, string> = {
  mail_assigned: "A held message was assigned to this thread",
  mail_moved_off: "A message was moved off this thread to the holding list",
};

const shown = (field: string, value: string | null) => {
  if (value === null) return "—";
  if (field === "note_kind") return quoteNoteKindLabel(value);
  if (field === "withdrawn_reason" && value in WITHDRAWAL_REASON_LABELS) return WITHDRAWAL_REASON_LABELS[value as WithdrawalReason];
  if (field === "decline_reason" && value in DECLINE_REASON_LABELS) return DECLINE_REASON_LABELS[value as DeclineReason];
  return field === "status" && isQuoteRequestStatus(value) ? QUOTE_REQUEST_LABELS[value] : value;
};

/**
 * Whether a logged event belongs in a quote request's change log. An underwriter's question recorded before
 * questions became notes is left out: the note that replaced it is shown instead.
 */
export const isChangeLogEvent = (e: { field: string }) => e.field !== "underwriter_question";

// Why a bundle link stopped working (bundle_links.revoked_reason, 20261122110000), in words.
const BUNDLE_LINK_REVOKED: Record<string, string> = {
  replaced: "a new link replaced it",
  newer_version: "a newer version was sent",
  withdrawn: "the quote request was withdrawn",
  submission_closed: "the submission was closed",
  authorization_withdrawn: "the employer withdrew this PEO",
  revoked_by_advisor: "revoked by an advisor",
  access_ended: "the employer ended the firm's access",
};

/** "Issued for version 3" or "Revoked: <reason>", as the database logs a bundle link (slice 6.6b). */
const describeBundleLinkEvent = (v: string) => {
  const reason = /^Revoked: (\w+)$/.exec(v)?.[1];
  if (reason) return `Bundle link revoked: ${BUNDLE_LINK_REVOKED[reason] ?? reason}`;
  return `Bundle link ${v.charAt(0).toLowerCase()}${v.slice(1)}`;
};

/** One line for a recorded change to a quote request, or a correction to one of its notes. */
export function describeQuoteRequestEvent(e: { field: string; old_value: string | null; new_value: string | null }): string {
  if (e.field === "bundle_link") return describeBundleLinkEvent(e.new_value ?? "");
  if (e.field in MAIL_EVENT_LABELS) return `${MAIL_EVENT_LABELS[e.field]} (message ${e.new_value ?? "?"})`;
  return `${FIELD_NAMES[e.field] ?? e.field}: ${shown(e.field, e.old_value)} → ${shown(e.field, e.new_value)}`;
}

/** Whole days from a send (YYYY-MM-DD) to today in the advisor's own calendar: 0 on the day it was sent. */
export function daysSince(day: string, now: Date = new Date()): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, m - 1, d)) / 86_400_000);
}

/** "Waiting 6 days" for the longest-waiting quote request. */
export const waitingLabel = (sentOn: string, now?: Date) => {
  const days = daysSince(sentOn, now);
  return `Waiting ${days} day${days === 1 ? "" : "s"}`;
};

/** Why a message is on the holding list, in the words an admin sees. */
export const HELD_REASON_LABELS: Record<string, string> = {
  revoked_address: "Revoked address",
  unknown_address: "Address never issued",
  ambiguous_address: "Address on more than one quote request",
  moved_by_advisor: "Moved off a thread",
};

/** Whole days left before an unassigned held message is deleted (30 days after it was held), never below 0. */
export function heldDaysLeft(heldAt: string, now: Date = new Date(), keepDays = 30): number {
  const left = keepDays - (now.getTime() - new Date(heldAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(left));
}
