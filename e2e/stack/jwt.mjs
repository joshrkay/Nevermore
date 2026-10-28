// HS256 JWTs for the e2e gateway, with node:crypto only. Real Supabase signs with the project's JWT
// secret; here the secret lives in config.mjs and never leaves the test machine.
import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (value) => Buffer.from(value).toString("base64url");

export function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

/** The token's claims, or null when the signature is wrong, the token is malformed or it has expired. */
export function verifyJwt(token, secret) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  const got = Buffer.from(parts[2], "base64url");
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return null;
  return payload;
}
