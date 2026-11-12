// Encrypts a broker's refresh token for storage (joshrkay/Nevermore#92, story M-4.3). AES-256-GCM with a random
// 96-bit nonce, and the broker's id as additional data, so a ciphertext copied to another broker's row doesn't decrypt.
// The key (MAILBOX_TOKEN_KEY, 32 random bytes, base64) lives only in the mailbox function's settings: the database
// holds ciphertext it can't read. No imports beyond Web Crypto, so it runs under Deno and Vitest alike.

const ENC = new TextEncoder();
const DEC = new TextDecoder();

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** The key's 32 bytes from its setting, or null when it isn't a base64 string of exactly 32 bytes. */
export function parseTokenKey(raw: string | undefined): Uint8Array | null {
  if (!raw) return null;
  try {
    const bytes = fromBase64(raw.trim());
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

async function importKey(key: Uint8Array, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", key as BufferSource, { name: "AES-GCM" }, false, [usage]);
}

export interface Sealed {
  ciphertext: string;
  iv: string;
}

export async function sealToken(key: Uint8Array, userId: string, token: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const out = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: ENC.encode(userId) as BufferSource },
    await importKey(key, "encrypt"),
    ENC.encode(token) as BufferSource,
  );
  return { ciphertext: toBase64(new Uint8Array(out)), iv: toBase64(iv) };
}

/** The token, or null when it can't be opened: the wrong key, another broker's row, or a damaged value. */
export async function openToken(key: Uint8Array, userId: string, sealed: Sealed): Promise<string | null> {
  try {
    const out = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(sealed.iv) as BufferSource, additionalData: ENC.encode(userId) as BufferSource },
      await importKey(key, "decrypt"),
      fromBase64(sealed.ciphertext) as BufferSource,
    );
    return DEC.decode(out);
  } catch {
    return null;
  }
}
