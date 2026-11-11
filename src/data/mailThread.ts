// The thread on the submission page (GLOSSARY.md, Thread; joshrkay/Nevermore#92, story M-3.4): everything that
// happened on a quote request, newest first, and which quote requests have PEO mail nobody has opened. Pure: the
// panel gives it the rows it loaded. The database is supabase/migrations/20261111110000_quote_request_messages.sql
// and 20261111120000_quote_request_threads.sql.

import { formatFileSize } from "../../supabase/functions/_shared/fileSignature";

/** The part of a quote request the thread needs. */
export interface ThreadRequest {
  id: number;
  peo_name: string;
}

export interface ThreadMessage {
  id: number;
  quote_request_id: number | null;
  direction: string;
  is_automatic: boolean;
  new_sender: boolean;
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  body_text: string | null;
  body_truncated: boolean;
  sent_at: string | null;
  recorded_at: string;
}

export interface ThreadAttachment {
  id: number;
  message_id: number;
  file_name: string;
  size_bytes: number;
  status: string;
  not_kept_reason: string | null;
  scan_signature: string | null;
  storage_path: string | null;
}

export interface ThreadNote {
  id: number;
  quote_request_id: number;
  kind: string;
  noted_on: string;
  body: string;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

export interface ThreadEvent {
  id: number;
  quote_request_id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_at: string;
  note_id: number | null;
}

export interface ThreadRead {
  quote_request_id: number;
  last_opened_at: string;
}

/** One line of a thread. `at` is when it happened, as an ISO time the entries are ordered by. */
export type TimelineEntry =
  | { kind: "message"; key: string; at: string; requestId: number; peo: string; message: ThreadMessage; attachments: ThreadAttachment[] }
  | { kind: "note"; key: string; at: string; requestId: number; peo: string; note: ThreadNote }
  | { kind: "send"; key: string; at: string; requestId: number; peo: string; sentOn: string; version: string | null; by: { id: string | null; email: string | null } }
  | { kind: "status"; key: string; at: string; requestId: number; peo: string; from: string; to: string; by: { id: string | null; email: string | null } };

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Every message, attachment, send, status change and quote request note of the given quote requests, newest first.
 * A note is placed at midday UTC of the day it records, since it holds a day and not a time. Corrections to a quote
 * request's fields (a fee fixed, a date changed, a note corrected) are not here: they stay in the change log
 * (isThreadEvent says which events are). Mail held for want of a quote request is on no thread.
 */
export function buildTimeline(input: {
  requests: readonly ThreadRequest[];
  messages: readonly ThreadMessage[];
  attachments: readonly ThreadAttachment[];
  notes: readonly ThreadNote[];
  events: readonly ThreadEvent[];
}): TimelineEntry[] {
  const peo = new Map(input.requests.map((r) => [r.id, r.peo_name]));
  const entries: TimelineEntry[] = [];

  for (const m of input.messages) {
    if (m.quote_request_id === null || !peo.has(m.quote_request_id)) continue;
    entries.push({
      kind: "message", key: `message-${m.id}`, at: m.sent_at ?? m.recorded_at, requestId: m.quote_request_id, peo: peo.get(m.quote_request_id)!,
      message: m, attachments: input.attachments.filter((a) => a.message_id === m.id).sort((a, b) => a.id - b.id),
    });
  }
  for (const n of input.notes) {
    if (!peo.has(n.quote_request_id)) continue;
    entries.push({ kind: "note", key: `note-${n.id}`, at: `${n.noted_on}T12:00:00.000Z`, requestId: n.quote_request_id, peo: peo.get(n.quote_request_id)!, note: n });
  }
  for (const e of input.events) {
    if (!peo.has(e.quote_request_id) || e.note_id !== null) continue;
    const by = { id: e.changed_by, email: e.changed_by_email };
    if (e.field === "sent_on" && e.new_value) {
      // The version sent was logged by the same write.
      const version = input.events.find((v) => v.quote_request_id === e.quote_request_id && v.field === "sent_version" && v.changed_at === e.changed_at)?.new_value ?? null;
      entries.push({ kind: "send", key: `send-${e.id}`, at: e.changed_at, requestId: e.quote_request_id, peo: peo.get(e.quote_request_id)!, sentOn: e.new_value, version, by });
    } else if (e.field === "status" && e.old_value !== null && e.new_value) {
      // The first status ("sent") is the send itself, which has its own entry.
      entries.push({ kind: "status", key: `status-${e.id}`, at: e.changed_at, requestId: e.quote_request_id, peo: peo.get(e.quote_request_id)!, from: e.old_value, to: e.new_value, by });
    }
  }
  return entries.sort((a, b) => time(b.at) - time(a.at) || (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

/** Whether the thread shows an event, so the change log can leave it out and hold the rest. */
export const isThreadEvent = (e: { field: string; old_value: string | null; note_id: number | null }) =>
  e.note_id === null && (e.field === "sent_on" || (e.field === "status" && e.old_value !== null));

/**
 * Whether a quote request has mail a person at the PEO wrote that no advisor has opened: a received message that
 * isn't an automatic reply, recorded after the thread was last opened. An advisor's own copied-in message, an
 * automatic reply and held mail never count. The database holds the same rule (the queue's new_peo_mail_requests).
 */
export function hasNewMail(requestId: number, messages: readonly ThreadMessage[], reads: readonly ThreadRead[]): boolean {
  const opened = reads.find((r) => r.quote_request_id === requestId)?.last_opened_at;
  const openedAt = opened === undefined ? -Infinity : time(opened);
  return messages.some((m) => m.quote_request_id === requestId && m.direction === "received" && !m.is_automatic && time(m.recorded_at) > openedAt);
}

/**
 * The time of the latest message a quote request holds, exactly as the database gave it, or null with none. Opening
 * the thread marks it read through this, so mail that arrived after the page loaded stays new.
 */
export function latestRecordedAt(requestId: number, messages: readonly ThreadMessage[]): string | null {
  let latest: ThreadMessage | null = null;
  for (const m of messages) {
    if (m.quote_request_id === requestId && (latest === null || time(m.recorded_at) > time(latest.recorded_at))) latest = m;
  }
  return latest?.recorded_at ?? null;
}

const ATTRIBUTION = /^on\b[^]{0,300}\bwrote:\s*$/i;
const ORIGINAL_MESSAGE = /^-{2,}\s*(original message|forwarded message)\s*-{2,}\s*$/i;
const UNDERSCORES = /^_{10,}\s*$/;

/**
 * A message's text with its quoted history split off, to be shown behind "Show quoted text": the text above an
 * "-----Original Message-----" or Outlook header block, or the trailing block of lines that start with ">" with the
 * "On ... wrote:" line above it. Text between quoted lines (an inline answer) stays visible. When splitting would
 * leave nothing visible, the whole text is visible.
 */
export function splitQuotedText(raw: string): { visible: string; quoted: string } {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  const lines = text.split("\n");
  let cut = -1;

  // An explicit marker: everything from it down is the earlier message.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headerBlock = /^from:\s/i.test(line) && lines.slice(i + 1, i + 5).some((l) => /^(sent|date):\s/i.test(l.trim()));
    if (ORIGINAL_MESSAGE.test(line) || UNDERSCORES.test(line) || headerBlock) {
      cut = i;
      break;
    }
  }

  // Otherwise the trailing block of ">" lines (blank lines allowed between them), and its attribution.
  if (cut < 0) {
    let start = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith(">")) start = i;
      else if (line !== "") break;
    }
    if (start < lines.length) {
      cut = start;
      // "On Mon, Nov 10, 2026 at 3:42 PM Dana <d@x.example> wrote:", possibly wrapped over two or three lines.
      for (let back = 1; back <= 3 && cut - back >= 0; back++) {
        const joined = lines.slice(cut - back, cut).map((l) => l.trim()).join(" ");
        if (/^on\b/i.test(lines[cut - back].trim()) && ATTRIBUTION.test(joined)) {
          cut -= back;
          break;
        }
      }
    }
  }

  if (cut < 0) return { visible: text, quoted: "" };
  const visible = lines.slice(0, cut).join("\n").trim();
  if (visible === "") return { visible: text, quoted: "" };
  return { visible, quoted: lines.slice(cut).join("\n").trim() };
}

/** What an attachment's state says to an advisor, and whether it can be opened. */
export function describeAttachment(a: Pick<ThreadAttachment, "status" | "not_kept_reason" | "size_bytes">): { text: string; openable: boolean } {
  const size = formatFileSize(a.size_bytes);
  if (a.status === "stored") return { text: `${size} · scanned, clean`, openable: true };
  if (a.status === "blocked") return { text: `${size} · blocked: the malware scan flagged this file, so it was not kept`, openable: false };
  if (a.status === "pending") return { text: `${size} · being checked for viruses; it can't be opened yet`, openable: false };
  const why: Record<string, string> = {
    too_large: "it is over 20 MB",
    unsupported_type: "this type of file isn't accepted",
    type_mismatch: "it isn't the type its name says",
    executable: "it is a program",
  };
  return { text: `${size} · not kept: ${(a.not_kept_reason && why[a.not_kept_reason]) || "it isn't accepted"}`, openable: false };
}
