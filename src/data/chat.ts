import type { ChamberData } from "./chamberTypes";
import { redactSensitive } from "./sensitive";

export interface ChatMessage {
  id: string;
  sender: "lenore" | "user";
  text: string;
  timestamp: string;
  /** "greeting": Lenore's hello at the start of a conversation. A transcript keeps only the first one. */
  kind?: "greeting";
}

/** Lenore's opening line in a new intake. */
export const OPENING_MESSAGE = "Good evening. I'm Lenore — your guide through The Chamber. As we talk, I'll fill in the workspace beside us, and you can check or correct anything there. Shall we begin with something simple — tell me a little about your business and what you do.";

// Openings saved before messages carried `kind`. They are recognised as greetings by their words.
const KNOWN_OPENINGS: ReadonlySet<string> = new Set([
  OPENING_MESSAGE,
  "Good evening. I'm Lenore — your guide through The Chamber. Before we begin, I want to be transparent: what you see in the workspace beside us is a demonstration. By the time our conversation is complete, it will hold your company's information instead. Shall we begin with something simple — tell me a little about your business and what you do.",
]);

/** A transcript entry. Social Security and bank account numbers are removed before it is kept. */
export function createChatMessage(sender: ChatMessage["sender"], text: string, kind?: ChatMessage["kind"]): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sender,
    text: redactSensitive(text),
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    ...(kind ? { kind } : {}),
  };
}

/** Lenore's opening line, as a fresh message. */
export const openingMessage = (): ChatMessage => createChatMessage("lenore", OPENING_MESSAGE, "greeting");

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

/** Rebuilds a transcript from a stored jsonb column, skipping malformed entries. */
export function parseTranscript(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m) => {
    if (typeof m !== "object" || m === null) return [];
    const { id, sender, text, timestamp, kind } = m as Record<string, unknown>;
    if (typeof text !== "string" || (sender !== "lenore" && sender !== "user")) return [];
    return [{
      id: typeof id === "string" && id ? id : crypto.randomUUID(),
      sender,
      text: redactSensitive(text),
      timestamp: typeof timestamp === "string" ? timestamp : "",
      ...(kind === "greeting" && sender === "lenore" ? { kind } : {}),
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
