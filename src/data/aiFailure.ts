import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";

// Why Lenore couldn't answer, as the prospect is told it. The AI functions answer a failure with a code
// (supabase/functions/_shared/ai/errors.ts); several codes read the same to a prospect, so they are
// folded into these kinds. Each kind has its own words (US-2.4a). `unavailable` is Lenore not being set
// up or paid for; `unreachable` is the provider or the function not answering this time.
export type AiFailureKind = "rate_limited" | "daily_cap" | "timeout" | "unavailable" | "unreachable" | "failed";

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
      return "unavailable";
    case "provider_error":
      return "unreachable";
    default:
      return "failed";
  }
}

/**
 * Whether trying again could get Lenore to answer. A daily cap, or a Lenore that isn't set up or paid
 * for, won't clear by retrying, so no retry is offered for them (B-3.2).
 */
export const retryCanClear = (kind: AiFailureKind): boolean => kind !== "daily_cap" && kind !== "unavailable";

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
  if (error instanceof FunctionsFetchError) return { kind: "unreachable" };
  return { kind: "failed" };
}

/** What the chat says when Lenore couldn't answer a message. The message itself is always kept. */
export const CHAT_FAILURE_MESSAGES: Record<AiFailureKind, string> = {
  rate_limited: "You're writing faster than Lenore can keep up. Give her a minute, then try again.",
  daily_cap: "Lenore is resting for the day. Your message is saved, and you can keep filling in the workspace yourself.",
  timeout: "Lenore took too long to answer. Your message is saved.",
  unavailable: "Lenore isn't available right now. Your message is saved, and you can keep filling in the workspace yourself.",
  unreachable: "Lenore can't be reached right now. Your message is saved.",
  failed: "Lenore couldn't respond. Your message is saved.",
};

/**
 * What the chat says when something the prospect said in a voice call couldn't be noted (US-2.3b). Lenore already
 * answered aloud, so it says her answers weren't taken from it, not that she couldn't respond. What they said is
 * always in the transcript.
 */
export const SPOKEN_FAILURE_MESSAGES: Record<AiFailureKind, string> = {
  rate_limited: "Lenore heard you, but she's taking in a lot at once and couldn't note that answer. It's in the transcript: give her a minute, then try again.",
  daily_cap: "Lenore heard you, but she can't note answers for the rest of the day. What you said is in the transcript, and you can keep filling in the workspace yourself.",
  timeout: "Lenore heard you, but took too long noting that answer. It's in the transcript.",
  unavailable: "Lenore heard you, but she can't note answers right now. What you said is in the transcript, and you can keep filling in the workspace yourself.",
  unreachable: "Lenore heard you, but couldn't be reached to note that answer. It's in the transcript.",
  failed: "Lenore heard you, but couldn't note that answer. It's in the transcript.",
};

/** What the Upload tab says when a document wasn't read this time. The file itself is always kept. */
export const DOCUMENT_FAILURE_MESSAGES: Record<AiFailureKind, string> = {
  rate_limited: "Lenore is reading a lot at once. Give her a minute, then try again.",
  daily_cap: "Lenore is resting for the day. The file is saved, and you can try again tomorrow.",
  timeout: "Lenore took too long reading it. The file is saved, and you can try again.",
  unavailable: "Lenore isn't available right now. The file is saved, and you can keep filling in the workspace yourself.",
  unreachable: "Lenore can't be reached right now. The file is saved, and you can try again.",
  failed: "Something went wrong reading this file. It's saved, and you can try again.",
};
