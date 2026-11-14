// An invitation's token: made here, sent in the link, and kept by the database only as its SHA-256 in hex. No imports, so it
// runs under Deno, the browser and Vitest alike (the browser hashes the token from the link the same way before asking the
// database to accept it, so the database never sees the token).

/** The SHA-256 of a token, in lower-case hex: the only form of it the database stores or is given. */
export async function hashInvitationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A new token: 32 random bytes in URL-safe base64, and its hash. */
export async function newInvitationToken(): Promise<{ token: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { token, hash: await hashInvitationToken(token) };
}
