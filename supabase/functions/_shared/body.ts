// Reading a request body without holding more of it than a function will accept. `req.json()` and
// `req.text()` read the whole body before any size check can run, so a caller could make a function
// buffer as much as the platform lets through. No imports: it runs under Deno, Node's type stripping
// (the e2e gateway loads chamber-extract) and Vitest alike.

/**
 * The request's body, or null once it is longer than `max` bytes. A declared Content-Length over the
 * limit is refused before anything is read; a body without one is read only until it passes the limit.
 */
export async function readBodyCapped(req: Request, max: number): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get("Content-Length") ?? NaN);
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    body.set(c, at);
    at += c.length;
  }
  return body;
}

export type JsonBody = { ok: true; value: unknown } | { ok: false; reason: "too_large" | "not_json" };

/** The request's body parsed as JSON, read no further than `max` bytes. */
export async function readJsonCapped(req: Request, max: number): Promise<JsonBody> {
  const bytes = await readBodyCapped(req, max);
  if (bytes === null) return { ok: false, reason: "too_large" };
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, reason: "not_json" };
  }
}
