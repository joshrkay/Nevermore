// Verifies that a webhook really comes from the email provider. Resend delivers webhooks through
// Svix, which signs each one: HMAC-SHA256, keyed with the endpoint's secret (`whsec_` plus base64),
// over `<svix-id>.<svix-timestamp>.<raw body>`, sent as one or more space-separated `v1,<base64>`
// entries (several while a secret is being rotated). A signature that matches and a timestamp
// within five minutes of now are what make a request the provider's, and a replay of an old one
// harmless. No imports, so it runs under Deno and Vitest alike.

/** How far the timestamp may be from now, either way, as the Svix libraries enforce. */
export const TOLERANCE_SECONDS = 5 * 60;

export type VerifyFailure =
  | "missing_headers"
  | "bad_timestamp"
  | "timestamp_too_old"
  | "timestamp_too_new"
  | "bad_secret"
  | "no_match";

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure };

export interface SignedRequest {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  /** The body exactly as received: a re-serialised copy would not match. */
  body: string;
}

const PREFIX = "whsec_";

function base64ToBytes(text: string): Uint8Array | null {
  try {
    const bin = atob(text);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** The signing key from the secret as the provider shows it, or null if it is not one. */
export function decodeSecret(secret: string): Uint8Array | null {
  const raw = secret.trim();
  const key = base64ToBytes(raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw);
  return key && key.length > 0 ? key : null;
}

/** Compares without stopping at the first differing character. */
function sameText(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** The `v1` signature the provider would send for this message, without its `v1,` prefix. */
export async function sign(key: Uint8Array, id: string, timestamp: string, body: string): Promise<string> {
  const hmacKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(`${id}.${timestamp}.${body}`)));
  let bin = "";
  for (const byte of mac) bin += String.fromCharCode(byte);
  return btoa(bin);
}

/**
 * Whether `request` carries a valid signature for `secret` at time `nowMs`. Every offered
 * signature is compared, so how long it takes does not say which one (or how much of it) matched.
 */
export async function verifySignature(secret: string, request: SignedRequest, nowMs: number): Promise<VerifyResult> {
  const { id, timestamp, signature, body } = request;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing_headers" };

  const key = decodeSecret(secret);
  if (!key) return { ok: false, reason: "bad_secret" };

  // Digits only: the signed text is this number, so a form that parses to the same number
  // ("+1", " 1", "1e3") must not be accepted.
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  const seconds = Number(timestamp);
  const now = Math.floor(nowMs / 1000);
  if (now - seconds > TOLERANCE_SECONDS) return { ok: false, reason: "timestamp_too_old" };
  if (seconds - now > TOLERANCE_SECONDS) return { ok: false, reason: "timestamp_too_new" };

  const expected = await sign(key, id, String(seconds), body);
  let matched = false;
  for (const entry of signature.split(" ")) {
    const [version, candidate] = entry.split(",");
    if (version !== "v1" || !candidate) continue;
    if (sameText(candidate, expected)) matched = true;
  }
  return matched ? { ok: true } : { ok: false, reason: "no_match" };
}
