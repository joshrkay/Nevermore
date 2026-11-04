// The user turn the extraction model reads: the prospect's message and, when the browser sent it,
// what the intake already holds. The handler and the extraction eval (scripts/extraction-eval) both
// build it here, so the eval measures the prompt production sends. No imports, so it runs under
// Deno and Vitest alike.

/** The request body's context as the prompt carries it; "" when there is none. The handler limits its length. */
export const serializeContext = (context: unknown): string => (context ? JSON.stringify(context) : "");

/** `contextJson` is serializeContext's output; "" leaves the context out. */
export function buildUserPrompt(message: string, contextJson: string): string {
  // JSON.stringify quotes and escapes the message so it can't break out of its slot.
  return contextJson
    ? `Previous context (already captured data): ${contextJson}\n\nNew user message: ${JSON.stringify(message)}`
    : `User message: ${JSON.stringify(message)}`;
}
