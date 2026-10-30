import { describe, expect, it } from "vitest";
import { readBodyCapped } from "./body";

const streamOf = (chunks: Uint8Array[], onCancel?: () => void) =>
  new ReadableStream<Uint8Array>({
    start(controller) { for (const c of chunks) controller.enqueue(c); controller.close(); },
    cancel() { onCancel?.(); },
  });
const bytes = (s: string) => new TextEncoder().encode(s);

describe("readBodyCapped", () => {
  it("returns the whole body, across chunks, decoded as UTF-8", async () => {
    const body = JSON.stringify({ text: "héllo \u{1F600}" });
    const raw = bytes(body);
    const split = [raw.slice(0, 5), raw.slice(5, 11), raw.slice(11)];
    expect(await readBodyCapped(String(raw.length), streamOf(split), 1000)).toEqual({ ok: true, text: body });
  });

  it("treats no body as an empty one", async () => {
    expect(await readBodyCapped(null, null, 10)).toEqual({ ok: true, text: "" });
    expect(await readBodyCapped("0", streamOf([]), 10)).toEqual({ ok: true, text: "" });
  });

  it("refuses a body that declares itself too long, without reading any of it", async () => {
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(bytes("x")); } });
    expect(await readBodyCapped("1001", stream, 1000)).toEqual({ ok: false });
    // Never even took the reader: nothing of the body was consumed.
    expect(stream.locked).toBe(false);
  });

  it("cuts a stream off the moment it passes the limit, whatever it declared, and stops reading it", async () => {
    let cancelled = false;
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) { pulled++; controller.enqueue(bytes("x".repeat(400))); },
      cancel() { cancelled = true; },
    });
    expect(await readBodyCapped(null, endless, 1000)).toEqual({ ok: false });
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThan(10);
    // A lie about the length does not help either.
    expect(await readBodyCapped("5", streamOf([bytes("y".repeat(2000))]), 1000)).toEqual({ ok: false });
  });

  it("accepts a body of exactly the limit and refuses one byte more", async () => {
    expect((await readBodyCapped(null, streamOf([bytes("a".repeat(1000))]), 1000)).ok).toBe(true);
    expect((await readBodyCapped(null, streamOf([bytes("a".repeat(1001))]), 1000)).ok).toBe(false);
  });

  it("ignores a length header that is not a plain number, and reads the stream under the same cap", async () => {
    expect((await readBodyCapped("lots", streamOf([bytes("ok")]), 1000)).ok).toBe(true);
    expect((await readBodyCapped("lots", streamOf([bytes("a".repeat(2000))]), 1000)).ok).toBe(false);
  });

  it("refuses, rather than throws, when the stream errors", async () => {
    const broken = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error("connection reset")); } });
    expect(await readBodyCapped(null, broken, 1000)).toEqual({ ok: false });
  });
});
