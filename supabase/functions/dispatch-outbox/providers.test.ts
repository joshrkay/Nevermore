import { describe, expect, it, vi } from "vitest";
import { createResendAdapter, providerErrorDetail, selectEmailAdapter, sendEmail, type EmailMessage } from "./providers";

const message: EmailMessage = {
  from: "Edgar Allan Advisory <intake@mail.example.com>",
  to: ["team@example.com"],
  replyTo: "support@example.com",
  subject: "Subject",
  text: "Text",
  html: "<p>Html</p>",
};

const adapter = createResendAdapter({ apiKey: "re_key" });

const respond = (status: number, body: unknown = {}) =>
  vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

describe("resend adapter", () => {
  it("builds the send request with the idempotency key", () => {
    const { url, headers, body } = adapter.buildRequest(message, "key-1");
    expect(url).toBe("https://api.resend.com/emails");
    expect(headers).toMatchObject({ Authorization: "Bearer re_key", "Idempotency-Key": "key-1", "Content-Type": "application/json" });
    expect(body).toEqual({
      from: message.from,
      to: message.to,
      subject: "Subject",
      text: "Text",
      html: "<p>Html</p>",
      reply_to: "support@example.com",
    });
  });

  it("omits reply_to when there is none", () => {
    const { body } = adapter.buildRequest({ ...message, replyTo: undefined }, "k");
    expect(body).not.toHaveProperty("reply_to");
  });

  it("reads the message id", () => {
    expect(adapter.parseResponse({ id: "msg_1" })).toBe("msg_1");
    expect(adapter.parseResponse({})).toBeNull();
    expect(adapter.parseResponse(null)).toBeNull();
  });
});

describe("selectEmailAdapter", () => {
  it("defaults to resend and needs its key", () => {
    const ok = selectEmailAdapter((n) => ({ RESEND_API_KEY: "k" })[n]);
    expect(ok.ok && ok.adapter.name).toBe("resend");
    expect(selectEmailAdapter(() => undefined)).toEqual({ ok: false, problem: "RESEND_API_KEY is not set" });
  });

  it("names an unsupported provider without leaking secrets", () => {
    const r = selectEmailAdapter((n) => ({ EMAIL_PROVIDER: "carrier-pigeon", RESEND_API_KEY: "secret" })[n]);
    expect(r).toEqual({ ok: false, problem: 'EMAIL_PROVIDER "carrier-pigeon" is not supported' });
  });
});

describe("sendEmail", () => {
  it("returns the provider's message id on success", async () => {
    const fetch = respond(200, { id: "msg_9" });
    expect(await sendEmail(adapter, message, "k", { fetch })).toEqual({ ok: true, messageId: "msg_9" });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("k");
    expect(JSON.parse(init.body as string).to).toEqual(["team@example.com"]);
  });

  it("treats an accepted message with an unreadable body as sent, not as a retry", async () => {
    expect(await sendEmail(adapter, message, "k", { fetch: respond(200, "<html>") })).toEqual({ ok: true, messageId: null });
  });

  it.each([
    [429, "rate_limited", false],
    [401, "auth", false],
    [403, "auth", false],
    [422, "provider_error", false],
    [500, "provider_error", true],
    [503, "provider_error", true],
  ])("maps HTTP %i to %s, keeping the provider's explanation only once cleaned", async (status, kind, ambiguous) => {
    const result = await sendEmail(adapter, message, "k", { fetch: respond(status, { message: "echoes jo@acme.example" }) });
    expect(result).toEqual({ ok: false, kind, httpStatus: status, ambiguous, detail: "echoes [email]" });
  });

  it("carries what the provider said was wrong, so an operator can tell a bad sender from a bad key", async () => {
    const result = await sendEmail(adapter, message, "k", {
      fetch: respond(403, { statusCode: 403, name: "validation_error", message: "The mail.example.com domain is not verified. Add DNS records." }),
    });
    expect(result).toEqual({
      ok: false, kind: "auth", httpStatus: 403, ambiguous: false,
      detail: "validation_error: The mail.example.com domain is not verified. Add DNS records.",
    });
  });

  it("has no detail when the provider's answer is not a JSON error with a message", async () => {
    for (const body of ["<html>Bad Gateway</html>", "", "[]", '{"name":"x"}', '{"message":5}']) {
      const result = await sendEmail(adapter, message, "k", { fetch: respond(502, body) });
      expect(result).toEqual({ ok: false, kind: "provider_error", httpStatus: 502, ambiguous: true });
    }
  });

  it("does not hang on an error body that never ends", async () => {
    const fetch = vi.fn((_url: string, init: RequestInit) => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"message":"slow'));
          init.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      });
      return Promise.resolve(new Response(stream, { status: 500 }));
    });
    const result = await sendEmail(adapter, message, "k", { fetch: fetch as unknown as typeof globalThis.fetch, timeoutMs: 30 });
    expect(result).toEqual({ ok: false, kind: "provider_error", httpStatus: 500, ambiguous: true });
  });

  // Only an answer that proves nothing was sent is definitive; the retry may then rebuild the
  // message under a new key. Anything else might follow an accepted message, so the frozen message
  // and key must be kept.
  describe("whether a failure is ambiguous", () => {
    it.each([400, 401, 403, 404, 405, 413, 422, 429])("HTTP %i is definitive", async (status) => {
      const result = await sendEmail(adapter, message, "k", { fetch: respond(status) });
      expect(result).toMatchObject({ ok: false, httpStatus: status, ambiguous: false });
    });

    it.each([
      [408, "request timeout"],
      [409, "idempotency conflict"],
      [425, "too early"],
      [300, "multiple choices"],
      [301, "redirect"],
      [302, "redirect"],
      [307, "redirect"],
      [308, "redirect"],
      [402, "unlisted 4xx"],
      [406, "unlisted 4xx"],
      [410, "unlisted 4xx"],
      [418, "unlisted 4xx"],
      [451, "unlisted 4xx"],
      [500, "5xx"],
      [502, "5xx"],
      [503, "5xx"],
      [504, "5xx"],
      [599, "5xx"],
    ])("HTTP %i (%s) is ambiguous", async (status) => {
      const result = await sendEmail(adapter, message, "k", { fetch: respond(status) });
      expect(result).toMatchObject({ ok: false, kind: "provider_error", httpStatus: status, ambiguous: true });
    });

    it("keeps the same classification whether or not there is a detail", async () => {
      const plain = await sendEmail(adapter, message, "k", { fetch: respond(422) });
      const detailed = await sendEmail(adapter, message, "k", { fetch: respond(422, { message: "Invalid `to` field" }) });
      expect(plain).toMatchObject({ kind: "provider_error", ambiguous: false });
      expect(detailed).toMatchObject({ kind: "provider_error", ambiguous: false });
    });

    it("shows a 409 as provider_error:409, not as something it is not", async () => {
      expect(await sendEmail(adapter, message, "k", { fetch: respond(409) })).toEqual({ ok: false, kind: "provider_error", httpStatus: 409, ambiguous: true });
    });
  });

  it("refuses to follow a redirect, so one surfaces as an ambiguous network failure and not a status", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.redirect === "error") throw new TypeError("redirect mode is set to error");
      return new Response(null, { status: 302 });
    });
    const result = await sendEmail(adapter, message, "k", { fetch: fetch as unknown as typeof globalThis.fetch });
    expect(result).toEqual({ ok: false, kind: "network", httpStatus: null, ambiguous: true });
    expect((fetch.mock.calls[0][1] as RequestInit).redirect).toBe("error");
  });

  it("reports a network error", async () => {
    const fetch = vi.fn(async () => { throw new TypeError("connection reset"); });
    expect(await sendEmail(adapter, message, "k", { fetch })).toEqual({ ok: false, kind: "network", httpStatus: null, ambiguous: true });
  });

  it("gives up on a provider that never answers", async () => {
    const fetch = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }));
    const result = await sendEmail(adapter, message, "k", { fetch: fetch as unknown as typeof globalThis.fetch, timeoutMs: 20 });
    expect(result).toEqual({ ok: false, kind: "timeout", httpStatus: null, ambiguous: true });
  });
});

describe("providerErrorDetail", () => {
  const detail = (message: string, name?: string) => providerErrorDetail(JSON.stringify({ name, message }));

  it("prefixes the error name when it is a plain identifier", () => {
    expect(detail("Missing `to` field.", "missing_required_field")).toBe("missing_required_field: Missing `to` field.");
    expect(detail("No name")).toBe("No name");
    expect(detail("Odd name", "has spaces and <markup>")).toBe("Odd name");
  });

  it("replaces addresses, wherever they sit", () => {
    expect(detail("Invalid address jo@acme.example in to; cc <a.b+c@d.example>, x@y.example")).toBe("Invalid address [email] in to; cc [email] [email]");
  });

  it("replaces an address whole, whatever surrounds it: a quoted local part, an apostrophe, brackets", () => {
    const out = [
      detail(`550 5.1.1 <"mary o'connor"@example.com>: Recipient address rejected`),
      detail("550 <mary.o'connor@example.com>, bob@example.org: unknown"),
      detail("rejected: 'sam@example.com'."),
    ].join(" | ");
    expect(out).not.toMatch(/mary|connor|bob|sam|example\.(com|org)/i);
    expect(out).toContain("[email]");
  });

  it("looks only at the start of a very long message, and stays fast on one with no spaces", () => {
    const started = Date.now();
    const out = detail("a".repeat(500_000))!;
    expect(Date.now() - started).toBeLessThan(500);
    expect(Array.from(out).length).toBeLessThanOrEqual(140);
  });

  it("replaces anything that could be a key, token or idempotency key", () => {
    const out = detail("Key re_AbCdEfGh12345678_ijklMNOP rejected; Idempotency-Key outbox-2f0c1a7e-3b1d-4c9e-9d5a-0123456789ab-0123456789ab in use")!;
    expect(out).not.toMatch(/re_AbCd|outbox-2f0c/);
    expect(out).toContain("[redacted]");
    expect(out).toContain("rejected");
  });

  it("is one capped line without control or invisible characters", () => {
    const out = detail(`line one\r\nBcc: x\u202e${"y ".repeat(200)}`)!;
    expect(out).not.toMatch(/[\r\n\u202e]/);
    expect(Array.from(out).length).toBeLessThanOrEqual(140);
    expect(out.endsWith("…")).toBe(true);
  });

  it("says nothing for what it cannot use", () => {
    expect(providerErrorDetail("not json")).toBeUndefined();
    expect(providerErrorDetail("null")).toBeUndefined();
    expect(providerErrorDetail("[1]")).toBeUndefined();
    expect(providerErrorDetail('{"message":"   "}')).toBeUndefined();
    expect(providerErrorDetail('{"message":{"nested":true}}')).toBeUndefined();
  });
});
