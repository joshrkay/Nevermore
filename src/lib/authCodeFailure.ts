// What to tell someone whose emailed code couldn't be sent or checked, by what actually went wrong (QA F3): the
// Chamber said "Check the address and try again" when Supabase Auth's own email sending failed (HTTP 500, "Error
// sending email change email"), so a prospect kept retyping a correct address.
//
// - A rate limit (429) says how long to wait (authRateLimitMessage).
// - A 5xx, or no answer at all (a network failure), is on our side: "Try again in a minute", with a reference that
//   is logged and reported (app_error, <step>_code:<flow>:<status>), so what the prospect quotes can be found.
// - Anything else (a 4xx, or an error that names no status) is about what was typed: the address, or for a check,
//   the code, as before.

import { authRateLimit, authRateLimitMessage, authRetryAfterSeconds } from "@/data/authRateLimit";
import { errorDetail, failureReference, reportOpsEvent } from "./monitoring";

export type AuthCodeStep = "send" | "check";
/** Which form asked: attaching an email to a guest, or signing back in to an intake. */
export type AuthCodeFlow = "verify_email" | "sign_in";
export type AuthCodeFailureKind = "rate_limit" | "input" | "server";

export const ADDRESS_MESSAGE = "We couldn't send a code to that address. Check the address and try again.";
export const WRONG_CODE_MESSAGE = "That code didn't work. Check it and try again, or send a new one.";
export const SEND_SERVER_MESSAGE = "We couldn't send the email right now. Try again in a minute.";
export const CHECK_SERVER_MESSAGE = "We couldn't check the code right now. Try again in a minute.";

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status > 0 ? status : null;
};

// supabase-js's name for a request that got no answer (status 0), and the browsers' words for one.
const UNANSWERED = /failed to fetch|networkerror|load failed|network request failed/i;

/** Whose fault a failed code request is: a rate limit, ours (a 5xx, or no answer), or what was typed (anything else). */
export function authCodeFailureKind(error: unknown): AuthCodeFailureKind {
  if (authRateLimit(error)) return "rate_limit";
  const { status, name, message } = (error ?? {}) as { status?: unknown; name?: unknown; message?: unknown };
  if (typeof status === "number" && status >= 500) return "server";
  if (status === 0 || name === "AuthRetryableFetchError" || (typeof message === "string" && UNANSWERED.test(message))) return "server";
  return "input";
}

/** The words for a failed send or check of an emailed code. A failure on our side is logged and reported with a reference. */
export function authCodeFailureMessage(error: unknown, step: AuthCodeStep, flow: AuthCodeFlow): string {
  const limit = authRateLimit(error);
  if (limit) return authRateLimitMessage(limit, authRetryAfterSeconds(error));
  if (authCodeFailureKind(error) === "input") return step === "send" ? ADDRESS_MESSAGE : WRONG_CODE_MESSAGE;
  const reference = failureReference();
  const status = statusOf(error);
  const detail = errorDetail(error);
  console.error(`Couldn't ${step} a ${flow} code (reference ${reference}, status ${status ?? "none"}): ${detail}`);
  reportOpsEvent("app_error", { code: `${step}_code:${flow}:${status ?? "none"}`, detail: `reference ${reference}: ${detail}` });
  return `${step === "send" ? SEND_SERVER_MESSAGE : CHECK_SERVER_MESSAGE} (Reference ${reference}.)`;
}
