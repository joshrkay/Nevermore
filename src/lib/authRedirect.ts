import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * What a link in a sign-up or email-change email brought back in the address:
 * - `error`: Supabase refused the link (used, expired, or never valid) and says why.
 * - `token`: a token for the app to verify itself (an email template that links to the app with
 *   `?token_hash=…&type=…`). Verifying on a click means a mail scanner that opens the link first
 *   can't use it up.
 * - `session`: Supabase already verified the link and sent `#access_token=…`; supabase-js signs the
 *   person in from it on load.
 */
export type AuthRedirect =
  | { kind: "error"; code: string; description: string }
  | { kind: "token"; tokenHash: string; type: EmailOtpType }
  | { kind: "session"; type: string | null };

const TOKEN_TYPES: readonly string[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Query and hash parameters together; the query wins, as in supabase-js. */
function params(href: string): Record<string, string> {
  const result: Record<string, string> = {};
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return result;
  }
  if (url.hash.length > 1) {
    try {
      new URLSearchParams(url.hash.slice(1)).forEach((value, key) => (result[key] = value));
    } catch {
      // a hash that isn't a query string, e.g. a section id
    }
  }
  url.searchParams.forEach((value, key) => (result[key] = value));
  return result;
}

/** The auth outcome in `href`, or null when it carries none (an ordinary page address). */
export function parseAuthRedirect(href: string): AuthRedirect | null {
  const p = params(href);
  // Supabase always names the error with a code or a description; a bare ?error= is some other page's.
  if (p.error_code || p.error_description) {
    return { kind: "error", code: p.error_code || p.error || "unknown", description: p.error_description ?? "" };
  }
  if (p.token_hash && p.type && TOKEN_TYPES.includes(p.type)) {
    return { kind: "token", tokenHash: p.token_hash, type: p.type as EmailOtpType };
  }
  if (p.access_token && p.refresh_token) return { kind: "session", type: p.type ?? null };
  return null;
}

export const AUTH_CALLBACK_PATH = "/auth/callback";
export const DEFAULT_NEXT = "/start";

/**
 * Where to send the person after the link, from the `next` parameter: a path on this site only,
 * so the link can't be turned into a redirect to somewhere else.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return DEFAULT_NEXT;
  // Control characters are refused too: browsers strip tabs and newlines, so "/\t/evil.example" is "//evil.example".
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return DEFAULT_NEXT;
  }
  if (raw === AUTH_CALLBACK_PATH || raw.startsWith(`${AUTH_CALLBACK_PATH}?`) || raw.startsWith(`${AUTH_CALLBACK_PATH}#`)) return DEFAULT_NEXT;
  return raw;
}

/** The address an auth email should link back to: the callback page, then `next`. */
export function authCallbackUrl(origin: string, next: string = DEFAULT_NEXT): string {
  const target = safeNext(next);
  return target === DEFAULT_NEXT
    ? `${origin}${AUTH_CALLBACK_PATH}`
    : `${origin}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(target)}`;
}

/**
 * The address the page was opened with, read when this module first loads. supabase-js clears
 * `#access_token=…` from the address once it has signed the person in, so the callback page reads
 * this copy, not the live address.
 */
export const initialHref: string = typeof window === "undefined" ? "" : window.location.href;

let initialRedirectTaken = false;

/** The auth outcome the page was opened with, while no page has acted on it yet. */
export function peekInitialAuthRedirect(): AuthRedirect | null {
  return initialRedirectTaken ? null : parseAuthRedirect(initialHref);
}

/**
 * The auth outcome the page was opened with, once: later calls return null, so an app that moves
 * on to another page doesn't act on the same link twice.
 */
export function takeInitialAuthRedirect(): AuthRedirect | null {
  if (initialRedirectTaken) return null;
  initialRedirectTaken = true;
  return parseAuthRedirect(initialHref);
}
