// What a chat call carries besides the prospect's new message (decision D22), and its limits. One copy: the
// browser builds the context with chatContext, and chamber-extract refuses one past these limits. No imports,
// so it runs under Deno and Vitest alike.

/** The prospect's new message, typed or spoken. A longer one is refused; the browser cuts a spoken one to fit. */
export const MAX_CHAT_MESSAGE_CHARS = 2000;
/** The answers, their field statuses and the recent conversation together, as JSON. */
export const MAX_CONTEXT_CHARS = 20000;
/** How many earlier messages a call carries, and how long each may be. */
export const MAX_RECENT_MESSAGES = 10;
export const MAX_RECENT_CHARS = 2000;

export interface RecentMessage {
  sender: "user" | "lenore";
  text: string;
}

export interface ChatContext {
  /** The answers captured so far, the census left out. */
  context: Record<string, unknown>;
  /** Each captured field's status. */
  statuses: Record<string, string>;
  /** The last few messages, oldest first: the prospect's and Lenore's only. */
  recent: RecentMessage[];
}

const clip = (s: string) => (s.length > MAX_RECENT_CHARS ? s.slice(0, MAX_RECENT_CHARS).replace(/[\uD800-\uDBFF]$/, "") : s);

/**
 * The context for one call. `transcript` is the conversation so far; `exceptId` is the message being sent,
 * which travels as the message itself. Only what came before it is carried: a spoken message read after later
 * lines were said (US-2.3b) must not be placed against a question Lenore asked after it. The oldest messages are
 * dropped until it all fits MAX_CONTEXT_CHARS.
 */
export function chatContext(
  answers: Record<string, unknown>,
  statuses: Record<string, string>,
  transcript: readonly { id?: string; sender: string; text: string }[],
  exceptId?: string,
): ChatContext {
  const at = exceptId === undefined ? -1 : transcript.findIndex((m) => m.id === exceptId);
  const before = at >= 0 ? transcript.slice(0, at) : transcript;
  const recent: RecentMessage[] = before
    .filter((m): m is { id?: string; sender: "user" | "lenore"; text: string } => m.sender === "user" || m.sender === "lenore")
    .slice(-MAX_RECENT_MESSAGES)
    .map((m) => ({ sender: m.sender, text: clip(m.text) }));
  const fixed = JSON.stringify(answers).length + JSON.stringify(statuses).length;
  while (recent.length > 0 && fixed + JSON.stringify(recent).length > MAX_CONTEXT_CHARS) recent.shift();
  return { context: answers, statuses, recent };
}
