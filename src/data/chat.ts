import type { ChamberData } from "./chamberTypes";
import { redactSensitive } from "./sensitive";

/** Who a transcript message is from: the prospect, Lenore, or the Chamber itself (a note such as a voice call starting). */
export type ChatSender = "lenore" | "user" | "system";

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  text: string;
  /**
   * When the message was written, as an ISO 8601 instant ("2026-11-04T14:34:05.123Z"). Messages saved before
   * 2026-11-04 hold the browser's local time of day ("02:34 PM") with no date; they are shown as they are.
   * Show either with formatMessageTime.
   */
  timestamp: string;
  /** "greeting": Lenore's hello at the start of a conversation. A transcript keeps only the first one. */
  kind?: "greeting";
  /** Said aloud in a voice call rather than typed (decision D33). Absent for a typed message. */
  spoken?: true;
}

// The limits the database holds every message to (public.chamber_transcript_error, migration
// 20261104101000_transcript_validation.sql; src/data/schemaSync.test.ts compares them). Messages made here
// and messages read back by parseTranscript always fit, so a save is never refused for its transcript.
export const TRANSCRIPT_SENDERS: readonly ChatSender[] = ["lenore", "user", "system"];
export const MAX_MESSAGE_CHARS = 20_000;
export const MAX_MESSAGE_ID_CHARS = 100;
export const MAX_TIMESTAMP_CHARS = 64;

// A cut between the halves of an emoji leaves a lone high surrogate, which Postgres jsonb refuses.
const clipText = (s: string) => (s.length > MAX_MESSAGE_CHARS ? s.slice(0, MAX_MESSAGE_CHARS).replace(/[\uD800-\uDBFF]$/, "") : s);

/** Lenore's opening line in a new intake. */
export const OPENING_MESSAGE = "Good evening. I'm Lenore — your guide through The Chamber. As we talk, I'll fill in the workspace beside us, and you can check or correct anything there. Shall we begin with something simple — tell me a little about your business and what you do.";

// Openings saved before messages carried `kind`. They are recognised as greetings by their words.
const KNOWN_OPENINGS: ReadonlySet<string> = new Set([
  OPENING_MESSAGE,
  "Good evening. I'm Lenore — your guide through The Chamber. Before we begin, I want to be transparent: what you see in the workspace beside us is a demonstration. By the time our conversation is complete, it will hold your company's information instead. Shall we begin with something simple — tell me a little about your business and what you do.",
]);

/**
 * A transcript entry, stamped with the time it was made. Social Security and bank account numbers are removed
 * before it is kept, and text past MAX_MESSAGE_CHARS is cut.
 */
export function createChatMessage(
  sender: ChatSender,
  text: string,
  opts: { kind?: ChatMessage["kind"]; spoken?: boolean; now?: Date } = {},
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sender,
    text: clipText(redactSensitive(text)),
    timestamp: (opts.now ?? new Date()).toISOString(),
    ...(opts.kind ? { kind: opts.kind } : {}),
    ...(opts.spoken ? { spoken: true as const } : {}),
  };
}

/** Lenore's opening line, as a fresh message. */
export const openingMessage = (): ChatMessage => createChatMessage("lenore", OPENING_MESSAGE, { kind: "greeting" });

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * A message's time for people to read, in their own time zone: "2:34 PM", or with `withDate` "Nov 4, 2026,
 * 2:34 PM". A time of day saved before messages carried the full instant is shown as it was saved, and
 * nothing at all as "".
 */
export function formatMessageTime(timestamp: string, opts: { withDate?: boolean } = {}): string {
  if (!ISO_INSTANT.test(timestamp)) return timestamp;
  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return timestamp;
  return opts.withDate
    ? at.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Whether a message is Lenore's hello: marked as one, or an opening line saved before the mark existed. */
export const isGreeting = (m: ChatMessage): boolean =>
  m.sender === "lenore" && (m.kind === "greeting" || KNOWN_OPENINGS.has(m.text));

/**
 * Keeps the first greeting and drops any later one. A greeting came back each time the voice agent
 * connected (its own first line), and some older transcripts saved the opening twice.
 */
export function dedupeGreetings(messages: ChatMessage[]): ChatMessage[] {
  let seen = false;
  const kept = messages.filter((m) => {
    if (!isGreeting(m)) return true;
    if (seen) return false;
    seen = true;
    return true;
  });
  return kept.length === messages.length ? messages : kept;
}

/**
 * Rebuilds a transcript from a stored jsonb column, in its stored order, skipping malformed entries. What it
 * returns always fits the database's rules for a message, so saving it back is never refused.
 */
export function parseTranscript(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m) => {
    if (typeof m !== "object" || m === null) return [];
    const { id, sender, text, timestamp, kind, spoken } = m as Record<string, unknown>;
    if (typeof text !== "string" || !TRANSCRIPT_SENDERS.includes(sender as ChatSender)) return [];
    return [{
      id: typeof id === "string" && id.trim() && id.length <= MAX_MESSAGE_ID_CHARS ? id : crypto.randomUUID(),
      sender: sender as ChatSender,
      text: clipText(redactSensitive(text)),
      timestamp: typeof timestamp === "string" && timestamp.length <= MAX_TIMESTAMP_CHARS ? timestamp : "",
      ...(kind === "greeting" && sender === "lenore" ? { kind } : {}),
      ...(spoken === true ? { spoken: true as const } : {}),
    }];
  });
}

/**
 * The intake as Lenore's chat sends it to chamber-extract for context. The roster isn't extracted
 * from chat and holds personal details, so it is left out. scripts/extraction-eval replays it too.
 */
export function chatContext(data: ChamberData): Omit<ChamberData, "census"> {
  const { census: _census, ...context } = data;
  return context;
}
