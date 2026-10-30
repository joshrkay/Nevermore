import { describe, expect, it, vi } from "vitest";
import { alertText, parseAlertWebhook, sendDeadAlert, type DeadEventAlert } from "./alert";

const alert: DeadEventAlert = {
  event: "11111111-2222-3333-4444-555555555555",
  kind: "advisor_notification",
  attempts: 5,
  reason: "provider_error:500",
  queueUrl: "https://app.example.com/advisor/outbox?status=dead",
};

describe("parseAlertWebhook", () => {
  it("is off, quietly, when unset", () => {
    expect(parseAlertWebhook(undefined)).toEqual({ url: null, problem: null });
    expect(parseAlertWebhook("   ")).toEqual({ url: null, problem: null });
  });

  it("takes an https URL as it is, path and token included", () => {
    expect(parseAlertWebhook(" https://hooks.example.com/services/T0/B0/xyz ")).toEqual({ url: "https://hooks.example.com/services/T0/B0/xyz" });
  });

  it("allows http only for localhost", () => {
    expect(parseAlertWebhook("http://localhost:9999/hook")).toEqual({ url: "http://localhost:9999/hook" });
    expect(parseAlertWebhook("http://127.0.0.1:9999/hook")).toEqual({ url: "http://127.0.0.1:9999/hook" });
  });

  it.each(["http://hooks.example.com/x", "ftp://x.example.com", "not a url", "https://user:pw@hooks.example.com/x", "javascript:alert(1)"])(
    "reports %s instead of silently turning the alert off",
    (bad) => {
      expect(parseAlertWebhook(bad)).toEqual({ url: null, problem: "ENGINEERING_ALERT_WEBHOOK_URL is not an https URL" });
    },
  );
});

describe("alertText", () => {
  it("names the event, kind, attempts, reason and where to retry it", () => {
    const text = alertText(alert);
    expect(text).toContain("OUTBOX_DEAD");
    expect(text).toContain("after 5 attempt(s)");
    expect(text).toContain("kind=advisor_notification");
    expect(text).toContain("event=11111111-2222-3333-4444-555555555555");
    expect(text).toContain("reason=provider_error:500");
    expect(text).toContain("https://app.example.com/advisor/outbox?status=dead");
  });

  it("leaves out the retry link when there is none", () => {
    expect(alertText({ ...alert, queueUrl: null })).not.toContain("Retry it");
  });
});

describe("sendDeadAlert", () => {
  const ok = () => vi.fn(async () => new Response("ok", { status: 200 }));

  it("posts the facts as JSON, with a text field for chat webhooks", async () => {
    const fetch = ok();
    expect(await sendDeadAlert("https://hooks.example.com/x", alert, { fetch })).toBe(true);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/x");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ source: "dispatch-outbox", alert: "OUTBOX_DEAD", event: alert.event, kind: "advisor_notification", attempts: 5, reason: "provider_error:500" });
    expect(body.text).toBe(alertText(alert));
  });

  it("carries no addresses, names or message content", async () => {
    const fetch = ok();
    await sendDeadAlert("https://hooks.example.com/x", alert, { fetch });
    const sent = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string;
    expect(sent).not.toMatch(/@|subject|html|payload/i);
  });

  it("reports a receiver that refuses it", async () => {
    expect(await sendDeadAlert("https://hooks.example.com/x", alert, { fetch: vi.fn(async () => new Response("no", { status: 403 })) })).toBe(false);
    expect(await sendDeadAlert("https://hooks.example.com/x", alert, { fetch: vi.fn(async () => new Response("", { status: 302 })) })).toBe(false);
  });

  it("never throws, whatever goes wrong", async () => {
    const boom = vi.fn(async () => { throw new TypeError("connection reset"); });
    expect(await sendDeadAlert("https://hooks.example.com/x", alert, { fetch: boom })).toBe(false);
  });

  it("gives up on a receiver that never answers", async () => {
    const fetch = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }));
    const started = Date.now();
    expect(await sendDeadAlert("https://hooks.example.com/x", alert, { fetch: fetch as unknown as typeof globalThis.fetch, timeoutMs: 20 })).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
