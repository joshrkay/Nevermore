import { describe, expect, it, vi } from "vitest";
import { parseAlertWebhook, postAlert } from "./alertWebhook";

const body = { text: "OPS_ALERT: 7 ai_failed event(s)", source: "ops-monitor", alert: "OPS_ALERT", kind: "ai_failed", count: 7 };

describe("parseAlertWebhook", () => {
  it("is off when unset, takes https (or http on localhost), and reports anything else", () => {
    expect(parseAlertWebhook(undefined)).toEqual({ url: null, problem: null });
    expect(parseAlertWebhook("https://hooks.example.com/x")).toEqual({ url: "https://hooks.example.com/x" });
    expect(parseAlertWebhook("http://127.0.0.1:9911/hook")).toEqual({ url: "http://127.0.0.1:9911/hook" });
    expect(parseAlertWebhook("http://hooks.example.com/x")).toEqual({ url: null, problem: "ENGINEERING_ALERT_WEBHOOK_URL is not an https URL" });
  });
});

describe("postAlert", () => {
  it("posts the body as JSON and refuses redirects", async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok", { status: 200 }));
    expect(await postAlert("https://hooks.example.com/x", body, { fetch: fetch as unknown as typeof globalThis.fetch })).toBe(true);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/x");
    expect(init).toMatchObject({ method: "POST", redirect: "error", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it("reports a refusal or a failure, never throws, and stops waiting at its timeout", async () => {
    expect(await postAlert("https://h.example.com", body, { fetch: vi.fn(async () => new Response("", { status: 500 })) })).toBe(false);
    expect(await postAlert("https://h.example.com", body, { fetch: vi.fn(async () => { throw new Error("reset"); }) })).toBe(false);
    const hung = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    expect(await postAlert("https://h.example.com", body, { fetch: hung as unknown as typeof fetch, timeoutMs: 20 })).toBe(false);
  });
});
