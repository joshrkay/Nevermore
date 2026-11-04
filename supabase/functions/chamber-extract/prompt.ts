// The user turn the extraction model reads: what the intake holds, how settled each answer is, which
// fields are still open, the recent conversation, and the prospect's new message (D22). The handler and
// the extraction eval (scripts/extraction-eval) both build it here, so the eval measures the prompt
// production sends.
import { unsettledFields } from "../_shared/followUp.ts";

/** How many unsettled fields the model is pointed to, most important first. */
export const NEXT_FIELDS = 8;
/** Chat never asks for the census: it comes from an uploaded file. */
const CHAT_EXCLUDES: ReadonlySet<string> = new Set(["census"]);

/** The request body's answers as the prompt carries them; "" when there are none. The handler limits its length. */
export const serializeContext = (context: unknown): string => (context ? JSON.stringify(context) : "");

export interface PromptInput {
  message: string;
  /** The answers captured so far (the request's `context`), census left out. */
  context: Record<string, unknown> | null | undefined;
  /** Each captured field's status. */
  statuses: Record<string, string>;
  /** The last few messages, oldest first. */
  recent: readonly { sender: string; text: string }[];
}

export function buildUserPrompt({ message, context, statuses, recent }: PromptInput): string {
  const answers = context ?? {};
  const next = unsettledFields(answers, statuses, { exclude: CHAT_EXCLUDES }).slice(0, NEXT_FIELDS);
  return [
    `Captured so far (answers): ${serializeContext(context) || "{}"}`,
    `Field statuses: ${JSON.stringify(statuses)}`,
    `Not yet settled, most important first: ${next.length > 0 ? next.map((f) => `${f.key} (${f.label})`).join(", ") : "none"}`,
    `Recent conversation, oldest first: ${JSON.stringify(recent)}`,
    // JSON.stringify quotes and escapes the message so it can't break out of its slot.
    `New user message: ${JSON.stringify(message)}`,
  ].join("\n\n");
}
