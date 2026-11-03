import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

// Why Lenore couldn't answer, as the prospect is told it. The AI functions answer a failure with a code
// (supabase/functions/_shared/ai/errors.ts); several codes read the same to a prospect, so they are
// folded into these kinds. Each kind has its own words (US-2.4a).
export type AiFailureKind = "rate_limited" | "daily_cap" | "timeout" | "unavailable" | "failed";

export interface AiFailureInfo {
  kind: AiFailureKind;
  /** The function's request id, which finds the call's extraction event. */
  requestId?: string;
}

/** The kind for a function's error code; anything unrecognised is a plain failure. */
export function failureKindFromCode(code: unknown): AiFailureKind {
  switch (code) {
    case "rate_limited":
      return "rate_limited";
    case "daily_cap":
      return "daily_cap";
    case "timeout":
      return "timeout";
    case "unavailable":
    case "provider_error":
      return "unavailable";
    default:
      return "failed";
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * What `supabase.functions.invoke` failed with. An HTTP error carries the function's code and request
 * id in its body; a network error means Lenore couldn't be reached at all.
 */
export async function describeInvokeError(error: unknown): Promise<AiFailureInfo> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response | undefined;
    let body: unknown = null;
    try {
      body = await response?.clone().json();
    } catch {
      body = null;
    }
    const requestId = (isObject(body) && typeof body.request_id === "string" ? body.request_id : null) ?? response?.headers?.get("X-Request-Id") ?? undefined;
    // A function too old to send a code still says 429 for a rate limit.
    const code = isObject(body) && typeof body.code === "string" ? body.code : response?.status === 429 ? "rate_limited" : null;
    return { kind: failureKindFromCode(code), requestId };
  }
  if (error instanceof FunctionsFetchError) return { kind: "unavailable" };
  return { kind: "failed" };
}

/** What the chat says when Lenore couldn't answer a message. The message itself is always kept. */
export const CHAT_FAILURE_MESSAGES: Record<AiFailureKind, string> = {
  rate_limited: "You're writing faster than Lenore can keep up. Give her a minute, then try again.",
  daily_cap: "Lenore is resting for the day. Your message is saved, and you can keep filling in the workspace yourself.",
  timeout: "Lenore took too long to answer. Your message is saved.",
  unavailable: "Lenore can't be reached right now. Your message is saved.",
  failed: "Lenore couldn't respond. Your message is saved.",
};

/** What the Upload tab says when a document wasn't read this time. The file itself is always kept. */
export const DOCUMENT_FAILURE_MESSAGES: Record<AiFailureKind, string> = {
  rate_limited: "Lenore is reading a lot at once. Give her a minute, then try again.",
  daily_cap: "Lenore is resting for the day. The file is saved, and you can try again tomorrow.",
  timeout: "Lenore took too long reading it. The file is saved, and you can try again.",
  unavailable: "Lenore can't be reached right now. The file is saved, and you can try again.",
  failed: "Something went wrong reading this file. It's saved, and you can try again.",
};
