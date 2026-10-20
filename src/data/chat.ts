export interface ChatMessage {
  id: string;
  sender: "lenore" | "user";
  text: string;
  timestamp: string;
}

export function createChatMessage(sender: ChatMessage["sender"], text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sender,
    text,
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
      text,
      timestamp: typeof timestamp === "string" ? timestamp : "",
    }];
  });
}
