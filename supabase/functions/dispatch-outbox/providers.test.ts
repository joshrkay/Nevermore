import { describe, expect, it, vi } from "vitest";
import { createResendAdapter, selectEmailAdapter, sendEmail, type EmailMessage } from "./providers";

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
  ])("maps HTTP %i to %s without exposing the response body", async (status, kind, ambiguous) => {
    const result = await sendEmail(adapter, message, "k", { fetch: respond(status, { message: "echoes jo@acme.example" }) });
    expect(result).toEqual({ ok: false, kind, httpStatus: status, ambiguous });
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
