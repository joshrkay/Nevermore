import { describe, expect, it } from "vitest";
import { readBodyCapped, readJsonCapped } from "./body";

/** A request body that streams `chunks` chunks of `size` bytes and counts how many were pulled. */
function streamed(chunks: number, size: number) {
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled === chunks) return controller.close();
      pulled++;
      controller.enqueue(new Uint8Array(size).fill(0x61));
    },
  });
  return { body, pulled: () => pulled };
}

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("https://functions.test/x", { method: "POST", body, headers, duplex: "half" } as RequestInit);

describe("readBodyCapped", () => {
  it("returns a body within the limit whole", async () => {
    expect(new TextDecoder().decode((await readBodyCapped(post("hello"), 5))!)).toBe("hello");
    expect(await readBodyCapped(new Request("https://functions.test/x"), 5)).toEqual(new Uint8Array(0));
  });

  it("refuses a declared Content-Length over the limit without reading the body", async () => {
    const s = streamed(100, 1024);
    expect(await readBodyCapped(post(s.body, { "Content-Length": String(100 * 1024) }), 4096)).toBeNull();
    expect(s.pulled()).toBeLessThanOrEqual(1);
  });

  it("stops reading an undeclared body as soon as it passes the limit", async () => {
    const s = streamed(10_000, 1024); // 10 MB if read to the end
    expect(await readBodyCapped(post(s.body), 4096)).toBeNull();
    expect(s.pulled()).toBeLessThan(10);
  });
});

describe("readJsonCapped", () => {
  it("parses JSON within the limit", async () => {
    expect(await readJsonCapped(post('{"a":1}'), 100)).toEqual({ ok: true, value: { a: 1 } });
  });

  it("tells a body that is too large from one that isn't JSON", async () => {
    expect(await readJsonCapped(post("x".repeat(101)), 100)).toEqual({ ok: false, reason: "too_large" });
    expect(await readJsonCapped(post("{not json"), 100)).toEqual({ ok: false, reason: "not_json" });
  });
});
