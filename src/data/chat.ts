import type { ChamberData } from "./chamberTypes";
import { redactSensitive } from "./sensitive";

export interface ChatMessage {
  id: string;
  sender: "lenore" | "user";
  text: string;
  timestamp: string;
}

/** A transcript entry. Social Security and bank account numbers are removed before it is kept. */
export function createChatMessage(sender: ChatMessage["sender"], text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sender,
    text: redactSensitive(text),
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

/** Rebuilds a transcript from a stored jsonb column, skipping malformed entries. */
export function parseTranscript(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m) => {
    if (typeof m !== "object" || m === null) return [];
    const { id, sender, text, timestamp } = m as Record<string, unknown>;
    if (typeof text !== "string" || (sender !== "lenore" && sender !== "user")) return [];
    return [{
      id: typeof id === "string" && id ? id : crypto.randomUUID(),
      sender,
      text: redactSensitive(text),
      timestamp: typeof timestamp === "string" ? timestamp : "",
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
