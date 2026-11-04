// The user turn the extraction model reads (D22): the answers captured so far, their field statuses, the
// fields not yet settled (most important first), the recent conversation, and the prospect's new message.
// The handler and the extraction eval (scripts/extraction-eval) both build it here, so the eval measures the
// prompt production sends, and _shared/ai/promptVersion.test.ts fingerprints its wording. Relative imports
// only, so it runs under Deno and Vitest alike.

import { unsettledFields, type FieldInfo } from "../_shared/followUp.ts";

/** How many unsettled fields the prompt names, most important first. */
export const NEXT_FIELDS = 8;

// Chat can't take the census: it comes only from an uploaded file (D21).
const CHAT_EXCLUDES: ReadonlySet<string> = new Set(["census"]);

/** The request body's answers as the prompt carries them; "" when there are none. */
export const serializeContext = (context: unknown): string => (context ? JSON.stringify(context) : "");

/** What the request carries besides the message, as the prompt holds it. The handler caps their total length. */
export interface UserTurnParts {
  contextJson: string;
  statusesJson: string;
  recentJson: string;
}

export function userTurnParts(
  context: unknown,
  statuses: Record<string, string>,
  recent: readonly { sender: "user" | "lenore"; text: string }[],
): UserTurnParts {
  return { contextJson: serializeContext(context), statusesJson: JSON.stringify(statuses), recentJson: JSON.stringify(recent) };
}

/** The total the context cap (MAX_CONTEXT_CHARS) applies to. */
export const userTurnLength = (parts: UserTurnParts): number => parts.contextJson.length + parts.statusesJson.length + parts.recentJson.length;

/** The fields the prompt names as not yet settled, most important first. */
export function nextFields(answers: Record<string, unknown>, statuses: Record<string, string>): FieldInfo[] {
  return unsettledFields(answers, statuses, { exclude: CHAT_EXCLUDES }).slice(0, NEXT_FIELDS);
}

/** The user turn. JSON.stringify quotes and escapes what the prospect wrote so it can't break out of its slot. */
export function buildUserPrompt(message: string, parts: UserTurnParts, next: readonly { key: string; label: string }[]): string {
  return [
    `Captured so far (answers): ${parts.contextJson || "{}"}`,
    `Field statuses: ${parts.statusesJson}`,
    `Not yet settled, most important first: ${next.length > 0 ? next.map((f) => `${f.key} (${f.label})`).join(", ") : "none"}`,
    `Recent conversation, oldest first: ${parts.recentJson}`,
    `New user message: ${JSON.stringify(message)}`,
  ].join("\n\n");
}
