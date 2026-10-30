// Reads a request body without ever holding more than a limit in memory. The endpoint is public
// (the gateway's JWT check is off, the signature is checked after the body is read), so an
// unauthenticated caller must not be able to make it buffer something large: the declared length
// is checked first, and a stream is cut off the moment it passes the limit. No imports, so it runs
// under Deno and Vitest alike.

export type BodyRead = { ok: true; text: string } | { ok: false };

/** The whole body as text, or `ok: false` if it is, or turns out to be, longer than `max` bytes. */
export async function readBodyCapped(
  contentLength: string | null,
  stream: ReadableStream<Uint8Array> | null,
  max: number,
): Promise<BodyRead> {
  if (contentLength !== null && /^\d+$/.test(contentLength.trim()) && Number(contentLength) > max) return { ok: false };
  if (stream === null) return { ok: true, text: "" };

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => {});
        return { ok: false };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // The same decoding req.text() does (UTF-8, a leading byte order mark dropped).
  return { ok: true, text: new TextDecoder().decode(bytes) };
}
