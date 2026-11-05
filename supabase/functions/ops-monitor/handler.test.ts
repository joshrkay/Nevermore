import { describe, expect, it, vi } from "vitest";
import { alertLogLine, alertText, handleRequest, PLAYBOOKS, type MonitorDeps, type OpsAlert } from "./handler";

const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: "https://project.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

const AI: OpsAlert = { kind: "ai_failed", event_count: 7, window_minutes: 15, threshold: 5, top_codes: "provider_error:503 x4, timeout:- x3" };
const UPLOADS: OpsAlert = { kind: "upload_failed", event_count: 5, window_minutes: 15, threshold: 5, top_codes: "storage_upload x5" };

const setup = (opts: { alerts?: OpsAlert[]; claimError?: { code: string }; env?: Record<string, string | undefined>; webhookStatus?: number } = {}) => {
  const env = { ...ENV, ...opts.env };
  const logs: string[] = [];
  const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) =>
    opts.claimError ? { data: null, error: opts.claimError } : { data: opts.alerts ?? [], error: null });
  const createClient = vi.fn((_url: string, _key: string) => ({ rpc }));
  const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok", { status: opts.webhookStatus ?? 200 }));
  const deps: MonitorDeps = {
    env: (n) => env[n],
    createClient,
    fetch: fetchFn as unknown as typeof fetch,
    log: (l) => logs.push(l),
    now: () => Date.parse("2026-11-05T15:04:05Z"),
  };
  return { deps, logs, rpc, createClient, fetchFn };
};

const scheduled = (key = "service-key", body = "{}") =>
  new Request("https://functions.test/ops-monitor", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body });
const testAlert = (key = "service-key") => scheduled(key, JSON.stringify({ test: true }));
const read = async (response: Response) => ({ status: response.status, body: await response.json() });

describe("ops-monitor: who may call it", () => {
  it("answers a preflight and refuses anything but POST", async () => {
    const t = setup();
    expect((await handleRequest(new Request("https://functions.test/ops-monitor", { method: "OPTIONS" }), t.deps)).status).toBe(200);
    expect((await handleRequest(new Request("https://functions.test/ops-monitor", { method: "GET" }), t.deps)).status).toBe(405);
  });

  it("refuses anyone but the schedule with its own 401, so a stray caller can't swallow an alert", async () => {
    const t = setup({ alerts: [AI] });
    const { status, body } = await read(await handleRequest(scheduled("anon-key"), t.deps));
    expect(status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(t.rpc).not.toHaveBeenCalled();
  });

  it("says it is unavailable when its own settings are missing", async () => {
    const t = setup({ env: { SUPABASE_URL: undefined } });
    expect((await handleRequest(scheduled(), t.deps)).status).toBe(503);
  });
});

describe("ops-monitor: alerting", () => {
  it("claims the alerts that are due, logs each, and posts each to the webhook", async () => {
    const t = setup({ alerts: [AI, UPLOADS], env: { ENGINEERING_ALERT_WEBHOOK_URL: "https://hooks.example.com/x" } });
    const { status, body } = await read(await handleRequest(scheduled(), t.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ alerts: 2, delivered: 2, webhook: "set" });
    expect(t.rpc).toHaveBeenCalledWith("claim_ops_alerts", {});
    expect(t.logs).toEqual([
      "OPS_ALERT kind=ai_failed count=7 window=15m threshold=5 codes=provider_error:503*4,timeout:-*3",
      "OPS_ALERT kind=upload_failed count=5 window=15m threshold=5 codes=storage_upload*5",
    ]);
    const sent = t.fetchFn.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string));
    expect(sent[0]).toEqual({
      text: alertText(AI),
      source: "ops-monitor",
      alert: "OPS_ALERT",
      kind: "ai_failed",
      count: 7,
      window_minutes: 15,
      threshold: 5,
      codes: "provider_error:503 x4, timeout:- x3",
      playbook: "AI failures",
    });
    expect(sent[1]).toMatchObject({ kind: "upload_failed", playbook: "Failed uploads" });
  });

  it("points every kind at its runbook playbook", () => {
    for (const kind of ["app_error", "upload_failed", "ai_failed", "auth_denied", "deletion_failed", "voice_failed", "malware_detected", "scan_failed"]) {
      const text = alertText({ ...AI, kind });
      expect(text).toContain("docs/RUNBOOK.md");
      expect(text).toContain(`"${PLAYBOOKS[kind]}"`);
    }
  });

  it("does nothing, and posts nothing, when no kind is over its threshold", async () => {
    const t = setup({ alerts: [], env: { ENGINEERING_ALERT_WEBHOOK_URL: "https://hooks.example.com/x" } });
    expect((await read(await handleRequest(scheduled(), t.deps))).body).toEqual({ alerts: 0, delivered: 0, webhook: "set" });
    expect(t.logs).toEqual([]);
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("logs the alert, and says once that it is only logged, when the webhook is unset", async () => {
    const t = setup({ alerts: [AI, UPLOADS] });
    expect((await read(await handleRequest(scheduled(), t.deps))).body).toEqual({ alerts: 2, delivered: 0, webhook: "missing" });
    expect(t.logs[0]).toBe("OPS_CONFIG_MISSING: ENGINEERING_ALERT_WEBHOOK_URL is not set; alerts are only logged");
    expect(t.logs.filter((l) => l.startsWith("OPS_CONFIG_MISSING"))).toHaveLength(1);
    expect(t.logs.filter((l) => l.startsWith("OPS_ALERT "))).toHaveLength(2);
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("reports a webhook that is set wrong instead of silently dropping the alert", async () => {
    const t = setup({ alerts: [AI], env: { ENGINEERING_ALERT_WEBHOOK_URL: "http://hooks.example.com/x" } });
    expect((await read(await handleRequest(scheduled(), t.deps))).body).toMatchObject({ webhook: "invalid" });
    expect(t.logs[0]).toBe("OPS_CONFIG_MISSING: ENGINEERING_ALERT_WEBHOOK_URL is not an https URL; alerts are only logged");
  });

  it("says the webhook is unset on every run, even when nothing is due, so it is found before an alert is lost", async () => {
    const t = setup({ alerts: [] });
    const { status, body } = await read(await handleRequest(scheduled(), t.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ alerts: 0, delivered: 0, webhook: "missing" });
    expect(t.logs).toEqual(["OPS_CONFIG_MISSING: ENGINEERING_ALERT_WEBHOOK_URL is not set; alerts are only logged"]);
  });

  it("counts an alert the receiver refused as undelivered, and still answers", async () => {
    const t = setup({ alerts: [AI], env: { ENGINEERING_ALERT_WEBHOOK_URL: "https://hooks.example.com/x" }, webhookStatus: 500 });
    expect((await read(await handleRequest(scheduled(), t.deps))).body).toEqual({ alerts: 1, delivered: 0, webhook: "set" });
    expect(t.logs).toContain("OPS_ALERT_UNDELIVERED kind=ai_failed");
  });

  it("answers a 500 with a fixed line when the alerts can't be claimed", async () => {
    const t = setup({ claimError: { code: "42501" }, env: { ENGINEERING_ALERT_WEBHOOK_URL: "https://hooks.example.com/x" } });
    const { status } = await read(await handleRequest(scheduled(), t.deps));
    expect(status).toBe(500);
    expect(t.logs).toEqual(["OPS_MONITOR_ERROR: rpc_claim:42501"]);
  });
});

describe("ops-monitor: a test alert", () => {
  const HOOK = { ENGINEERING_ALERT_WEBHOOK_URL: "https://hooks.example.com/x" };

  it("posts one OPS_TEST alert, claims nothing, and answers 200 when the receiver took it", async () => {
    const t = setup({ alerts: [AI], env: HOOK });
    const { status, body } = await read(await handleRequest(testAlert(), t.deps));
    expect(status).toBe(200);
    expect(body).toEqual({ test: true, webhook: "set", delivered: true });
    // A real alert that is due is left for the next scheduled run, not swallowed by the test.
    expect(t.rpc).not.toHaveBeenCalled();
    expect(t.fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = t.fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/x");
    expect(JSON.parse(init.body as string)).toEqual({
      // Spelled out, not built with testAlertText: docs/RUNBOOK.md tells the operator to look for these words (code review).
      text: "OPS_TEST: a test alert from ops-monitor, sent by an operator at 2026-11-05T15:04:05.000Z. If you can read this, engineering alerts reach this channel. Nothing needs doing.",
      source: "ops-monitor",
      alert: "OPS_TEST",
      sent_at: "2026-11-05T15:04:05.000Z",
    });
    expect(t.logs).toEqual(["OPS_TEST delivered"]);
  });

  it("answers 503 and sends nothing when no webhook is set", async () => {
    const t = setup({ alerts: [AI] });
    const { status, body } = await read(await handleRequest(testAlert(), t.deps));
    expect(status).toBe(503);
    expect(body).toEqual({ test: true, webhook: "missing", delivered: false });
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(t.rpc).not.toHaveBeenCalled();
  });

  it("answers 502 when the receiver refused it", async () => {
    const t = setup({ env: HOOK, webhookStatus: 404 });
    const { status, body } = await read(await handleRequest(testAlert(), t.deps));
    expect(status).toBe(502);
    expect(body).toEqual({ test: true, webhook: "set", delivered: false });
    expect(t.logs).toEqual(["OPS_TEST_UNDELIVERED"]);
  });

  it("is refused without the service-role key, like a scheduled run", async () => {
    const t = setup({ env: HOOK });
    expect((await handleRequest(testAlert("anon-key"), t.deps)).status).toBe(401);
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it("treats a body that isn't {\"test\": true} as a scheduled run", async () => {
    const t = setup({ alerts: [], env: HOOK });
    for (const body of ["", "not json", JSON.stringify({ test: "yes" }), JSON.stringify([true])]) {
      expect((await read(await handleRequest(scheduled("service-key", body), t.deps))).body).toEqual({ alerts: 0, delivered: 0, webhook: "set" });
    }
    expect(t.fetchFn).not.toHaveBeenCalled();
  });
});

describe("alertLogLine", () => {
  it("keeps the codes field free of spaces and anything that isn't a code", () => {
    expect(alertLogLine({ ...AI, top_codes: null })).toBe("OPS_ALERT kind=ai_failed count=7 window=15m threshold=5 codes=-");
    expect(alertLogLine({ ...AI, top_codes: "a\nb=c x2" })).toBe("OPS_ALERT kind=ai_failed count=7 window=15m threshold=5 codes=abc*2");
  });
});
