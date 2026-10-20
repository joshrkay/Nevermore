import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callModel, failureLogLine, failureResponse, unexpectedErrorLine, type ModelResult, type ProviderAdapter } from "./model";

// A stand-in provider: the adapter contract is what callModel depends on.
const adapter: ProviderAdapter = {
  name: "fake",
  buildRequest: ({ system, user }) => ({
    url: "https://provider.test/v1",
    headers: { "content-type": "application/json" },
    body: { system, user },
  }),
  parseResponse: (json) => {
    const args = (json as { args?: Record<string, unknown> | null }).args;
    return args ?? null;
  },
};

const reply = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const request = { system: "SYSTEM", user: "USER" };

const setup = (responses: Array<Response | Error>) => {
  const queue = [...responses];
  const fetchFn = vi.fn(async (_url: string, _init: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("fetch called more times than expected");
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async (_ms: number) => {});
  let clock = 0;
  const now = () => (clock += 5);
  return { fetchFn, sleep, deps: { fetch: fetchFn as unknown as typeof fetch, sleep, now } };
};

describe("callModel", () => {
  it("returns what the provider extracted", async () => {
    const { deps, fetchFn } = setup([reply(200, { args: { company_name: "Acme" } })]);
    const result = await callModel(adapter, request, deps);
    expect(result).toMatchObject({ ok: true, args: { company_name: "Acme" }, attempts: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe("https://provider.test/v1");
  });

  it("treats a reply with nothing extracted as success, not an error", async () => {
    const { deps } = setup([reply(200, { args: null })]);
    expect(await callModel(adapter, request, deps)).toMatchObject({ ok: true, args: null });
  });

  it("retries once after a rate limit, then succeeds", async () => {
    const { deps, fetchFn, sleep } = setup([reply(429), reply(200, { args: { company_name: "Acme" } })]);
    const result = await callModel(adapter, request, deps);
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("gives up as rate_limited after the single retry", async () => {
    const { deps, fetchFn } = setup([reply(429), reply(429)]);
    expect(await callModel(adapter, request, deps)).toMatchObject({ ok: false, kind: "rate_limited", httpStatus: 429, attempts: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("retries once on a provider server error", async () => {
    const { deps } = setup([reply(503), reply(200, { args: {} })]);
    expect(await callModel(adapter, request, deps)).toMatchObject({ ok: true, attempts: 2 });
    const failing = setup([reply(500), reply(502)]);
    expect(await callModel(adapter, request, failing.deps)).toMatchObject({ ok: false, kind: "provider_error", attempts: 2 });
  });

  it("retries once after a network failure", async () => {
    const { deps } = setup([new TypeError("fetch failed"), reply(200, { args: {} })]);
    expect(await callModel(adapter, request, deps)).toMatchObject({ ok: true, attempts: 2 });
    const failing = setup([new TypeError("fetch failed"), new TypeError("fetch failed")]);
    expect(await callModel(adapter, request, failing.deps)).toMatchObject({ ok: false, kind: "network", attempts: 2 });
  });

  it("does not retry when credits are exhausted or the request itself was rejected", async () => {
    const credits = setup([reply(402)]);
    expect(await callModel(adapter, request, credits.deps)).toMatchObject({ ok: false, kind: "credits", attempts: 1 });
    expect(credits.fetchFn).toHaveBeenCalledTimes(1);

    const rejected = setup([reply(400)]);
    expect(await callModel(adapter, request, rejected.deps)).toMatchObject({ ok: false, kind: "provider_error", httpStatus: 400, attempts: 1 });
    expect(rejected.fetchFn).toHaveBeenCalledTimes(1);
  });

  it("reports a malformed reply as invalid_response without retrying", async () => {
    const notJson = setup([new Response("<html>oops</html>", { status: 200 })]);
    expect(await callModel(adapter, request, notJson.deps)).toMatchObject({ ok: false, kind: "invalid_response", attempts: 1 });

    const throwing: ProviderAdapter = { ...adapter, parseResponse: () => { throw new Error("bad shape"); } };
    const shaped = setup([reply(200, {})]);
    expect(await callModel(throwing, request, shaped.deps)).toMatchObject({ ok: false, kind: "invalid_response", attempts: 1 });
    expect(shaped.fetchFn).toHaveBeenCalledTimes(1);
  });

  it("never carries the provider's response body, which can echo what the prospect typed", async () => {
    const { deps } = setup([reply(500, { error: "echo: SSN 123-45-6789 Acme Corp" }), reply(500, { error: "echo: SSN 123-45-6789 Acme Corp" })]);
    const result = await callModel(adapter, request, deps);
    expect(JSON.stringify(result)).not.toMatch(/123-45-6789|Acme/);
  });
});

describe("callModel timeout", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("gives up on a stalled call after the timeout and does not retry it", async () => {
    const stalled = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );
    const deps = { fetch: stalled as unknown as typeof fetch, sleep: async () => {}, now: () => Date.now(), timeoutMs: 20_000 };
    const pending = callModel(adapter, request, deps);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await pending).toMatchObject({ ok: false, kind: "timeout", attempts: 1 });
    expect(stalled).toHaveBeenCalledTimes(1);
  });
});

describe("failureResponse", () => {
  it.each([
    ["timeout", 504, /taking too long/i],
    ["rate_limited", 429, /rate limited/i],
    ["credits", 503, /unavailable/i],
    ["provider_error", 502, /couldn't respond/i],
    ["invalid_response", 502, /couldn't respond/i],
    ["network", 502, /couldn't respond/i],
  ] as const)("maps %s to %i with a calm message", (kind, status, message) => {
    const r = failureResponse(kind);
    expect(r.status).toBe(status);
    expect(r.message).toMatch(message);
  });

  it("doesn't tell the prospect about our billing when credits run out", () => {
    expect(failureResponse("credits").message).not.toMatch(/credit|billing|payment|quota/i);
  });
});

describe("failureLogLine", () => {
  const failed: Extract<ModelResult, { ok: false }> = { ok: false, kind: "provider_error", httpStatus: 503, attempts: 2, latencyMs: 1234 };

  it("is a single line of fixed fields", () => {
    expect(failureLogLine({ requestId: "req-1", provider: "anthropic", result: failed })).toBe(
      "AI_CALL_FAILED request=req-1 provider=anthropic kind=provider_error status=503 attempts=2 latency_ms=1234",
    );
  });

  it("shows a dash when there was no HTTP status", () => {
    const line = failureLogLine({ requestId: "r", provider: "lovable", result: { ...failed, kind: "timeout", httpStatus: null } });
    expect(line).toContain("status=-");
  });

  it("can't be made to include text from the prospect or the provider", () => {
    const line = failureLogLine({ requestId: "req-1", provider: "anthropic", result: { ...failed, kind: "invalid_response" } });
    expect(line).not.toMatch(/SSN|123-45|Acme|message|context/);
    expect(line.split("\n")).toHaveLength(1);
  });
});

describe("unexpectedErrorLine", () => {
  it("names the kind of error without its message, which can quote the request body", () => {
    let thrown: unknown;
    try { JSON.parse("SSN 123-45-6789 for Acme"); } catch (e) { thrown = e; }
    expect((thrown as Error).message).toMatch(/123-45-6789|SSN|Acme/); // the hazard is real
    expect(unexpectedErrorLine("req-9", thrown)).toBe("AI_UNEXPECTED_ERROR request=req-9 error=SyntaxError");
  });

  it("copes with things that aren't errors", () => {
    expect(unexpectedErrorLine("req-9", "boom 123-45-6789")).toBe("AI_UNEXPECTED_ERROR request=req-9 error=unknown");
  });
});
