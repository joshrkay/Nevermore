// Supabase Auth refuses sign-up, sign-in-code and resend requests with a 429 in three different ways, and
// they need three different answers for the person who hit them. Everything else (a weak password, a
// bad address) is not a rate limit and keeps its own message.
//
// - `cooldown`: this address was emailed a moment ago. Supabase allows one email per address about every
//   minute, and says "you can only request this after N seconds". Waiting a minute clears it.
// - `quota`: the whole project has used its emails for the hour ("email rate limit exceeded", code
//   `over_email_send_rate_limit`, the same code as the cooldown). Every prospect shares it, and waiting a
//   minute does not clear it. The limit is raised in the Supabase dashboard (docs/SUPABASE_SETUP.md).
// - `requests`: too many auth calls from one network (`over_request_rate_limit`), or any other 429.
export type AuthRateLimit = "cooldown" | "quota" | "requests";

/** Which rate limit an auth call's error is, or null when it is not one. */
export function authRateLimit(error: unknown): AuthRateLimit | null {
  if (typeof error !== "object" || error === null) return null;
  const { code, status, message } = error as { code?: unknown; status?: unknown; message?: unknown };
  const text = typeof message === "string" ? message : "";

  // First: the cooldown shares the quota's code, so the wording has to decide.
  if (/only request this after \d+ seconds?/i.test(text)) return "cooldown";
  if (code === "over_email_send_rate_limit" || /email rate limit/i.test(text)) return "quota";
  if (code === "over_request_rate_limit" || status === 429 || /rate limit|too many/i.test(text)) return "requests";
  return null;
}

/**
 * The words for a failed auth call that shows Supabase's own message: the rate-limit explanation when it
 * is one ("email rate limit exceeded" reads as a fault in the address), otherwise Supabase's message,
 * otherwise `fallback`.
 */
export function authErrorMessage(error: Error, fallback = ""): string {
  const limit = authRateLimit(error);
  return limit ? authRateLimitMessage(limit, authRetryAfterSeconds(error)) : error.message || fallback;
}

/** How many seconds Supabase says to wait before asking again ("only request this after 42 seconds"), when it says. */
export function authRetryAfterSeconds(error: unknown): number | null {
  const message = (error as { message?: unknown } | null)?.message;
  const seconds = typeof message === "string" ? /only request this after (\d+) seconds?/i.exec(message)?.[1] : undefined;
  return seconds ? Number(seconds) : null;
}

/** "a minute" (Supabase's usual cooldown, and when it didn't say), "2 minutes", or "45 seconds". */
function waitWords(seconds: number | null): string {
  if (!seconds || seconds === 60) return "a minute";
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

/**
 * What to tell the person, in words that don't blame the address they typed, and how long to wait (QA F3): the
 * seconds Supabase gave for the cooldown when it gave them, the hour the project's email quota runs over.
 */
export function authRateLimitMessage(limit: AuthRateLimit, seconds: number | null = null): string {
  switch (limit) {
    case "cooldown":
      return `We just sent an email to that address. Please wait ${waitWords(seconds)} before asking for another.`;
    case "quota":
      return "We're sending a lot of emails right now and couldn't send yours. Please try again within the hour.";
    case "requests":
      return "Too many attempts from this connection. Please wait a few minutes and try again.";
  }
}
