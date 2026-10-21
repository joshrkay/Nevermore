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
    [429, "rate_limited"],
    [401, "auth"],
    [403, "auth"],
    [422, "provider_error"],
    [500, "provider_error"],
    [503, "provider_error"],
  ])("maps HTTP %i to %s without exposing the response body", async (status, kind) => {
    const result = await sendEmail(adapter, message, "k", { fetch: respond(status, { message: "echoes jo@acme.example" }) });
    expect(result).toEqual({ ok: false, kind, httpStatus: status });
  });

  it("reports a network error", async () => {
    const fetch = vi.fn(async () => { throw new TypeError("connection reset"); });
    expect(await sendEmail(adapter, message, "k", { fetch })).toEqual({ ok: false, kind: "network", httpStatus: null });
  });

  it("gives up on a provider that never answers", async () => {
    const fetch = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }));
    const result = await sendEmail(adapter, message, "k", { fetch: fetch as unknown as typeof globalThis.fetch, timeoutMs: 20 });
    expect(result).toEqual({ ok: false, kind: "timeout", httpStatus: null });
  });
});
