import { PIPELINE_TRANSITIONS, type PipelineStatus } from "./advisor";

// Quote requests (GLOSSARY.md): which PEOs a submission was sent to and what each answered. Advisors record them
// after acting outside the product; the prospect never sees them. The database is
// supabase/migrations/20261110090000_quote_requests.sql.

/** Where one PEO's quote request stands. src/data/schemaSync.test.ts keeps this list equal to the database's. */
export const QUOTE_REQUEST_STATUSES = ["sent", "quoted", "declined", "closed"] as const;
export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

export const QUOTE_REQUEST_LABELS: Record<QuoteRequestStatus, string> = {
  sent: "Waiting",
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

/** The longest a note can be; the database refuses a longer one. */
export const QUOTE_NOTE_MAX = 2000;

export const isQuoteNoteKind = (k: unknown): k is QuoteNoteKind =>
  typeof k === "string" && (QUOTE_NOTE_KINDS as readonly string[]).includes(k);

export const quoteNoteKindLabel = (kind: string) => (isQuoteNoteKind(kind) ? QUOTE_NOTE_KIND_LABELS[kind] : kind);

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
 * "Sent v2, current v3" when a PEO still working on the submission (its request sent or quoted) has an older
 * version than the latest certified; null otherwise. The quote itself stands: the advisor decides whether to resend.
 */
export function olderVersionNote(
  r: { status: string; sent_version: number | null },
  currentVersion: number | null,
): string | null {
  if (r.status !== "sent" && r.status !== "quoted") return null;
  if (r.sent_version === null || currentVersion === null || r.sent_version >= currentVersion) return null;
  return `Sent v${r.sent_version}, current v${currentVersion}`;
}

/**
 * The one pipeline step to offer after recording something: the first send moves Ready for market on to Sent to
 * PEOs, and the first quote moves Sent to PEOs on to Quoted. Null when the submission is anywhere
 * else, or the allow-list doesn't permit the move. The advisor still decides: the offer can be declined.
 */
export function stageToOffer(recorded: "send" | "quote", stage: PipelineStatus): PipelineStatus | null {
  const [from, to]: [PipelineStatus, PipelineStatus] =
    recorded === "send" ? ["ready_for_market", "sent_to_carrier"] : ["sent_to_carrier", "quoted"];
  return stage === from && PIPELINE_TRANSITIONS[from].includes(to) ? to : null;
}

const FIELD_NAMES: Record<string, string> = {
  status: "Status",
  peo_name: "PEO",
  sent_on: "Sent on",
  sent_version: "Version sent",
  quote_received_on: "Received on",
  quote_expires_on: "Expires on",
  proposed_start_on: "Proposed start",
  admin_fee_pepm: "Admin fee per employee per month",
  note: "Note",
  note_kind: "Note kind",
  note_noted_on: "Note date",
  note_body: "Note text",
};

const shown = (field: string, value: string | null) => {
  if (value === null) return "—";
  if (field === "note_kind") return quoteNoteKindLabel(value);
  return field === "status" && isQuoteRequestStatus(value) ? QUOTE_REQUEST_LABELS[value] : value;
};

/**
 * Whether a logged event belongs in a quote request's change log. An underwriter's question recorded before
 * questions became notes is left out: the note that replaced it is shown instead.
 */
export const isChangeLogEvent = (e: { field: string }) => e.field !== "underwriter_question";

/** One line for a recorded change to a quote request, or a correction to one of its notes. */
export function describeQuoteRequestEvent(e: { field: string; old_value: string | null; new_value: string | null }): string {
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
