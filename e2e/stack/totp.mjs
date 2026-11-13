// Time-based one-time codes (RFC 6238: HMAC-SHA1, 6 digits, 30-second steps), with node:crypto only. The gateway
// checks the codes of its stand-in for GoTrue's multi-factor endpoints with it, and a spec computes the code an
// authenticator app would show from the secret the screen displays.
import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;

export function base32Encode(bytes) {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}

export function base32Decode(text) {
  let bits = "";
  for (const char of text.replace(/=+$/, "").toUpperCase()) bits += ALPHABET.indexOf(char).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export const newSecret = () => base32Encode(randomBytes(20));

/** The 6-digit code for the 30-second step that contains `atMs`. */
export function totpCode(secret, atMs = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / STEP_SECONDS)));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0xf;
  const value = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

/** Whether `code` is right for this step or the one before or after it, as authenticator apps allow for clock drift. */
export function totpMatches(secret, code, atMs = Date.now()) {
  return [-1, 0, 1].some((drift) => totpCode(secret, atMs + drift * STEP_SECONDS * 1000) === String(code));
}
