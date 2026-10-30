import { describe, expect, it, vi } from "vitest";
import { errorCode, handleWebhook, logLevel, MAX_BODY_BYTES, type RecordInput, type WebhookDeps, type WebhookRequest } from "./handler";
import { decodeSecret, sign } from "./verify";

const SECRET = "whsec_dmVyaWZ5LWhhcm5lc3Mtd2ViaG9vay1zZWNyZXQtMzJiIQ==";
const NOW = 1761652800 * 1000;
const ID = "msg_2Lh9KRb0pzN8Vj1nAh5Pq4sTxYz";

const bouncedBody = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "email.bounced",
    created_at: "2025-10-28T12:00:00.000Z",
    data: {
      email_id: "re_abc123",
      to: ["jo@acme.example"],
      subject: "We received your intake",
      bounce: { type: "Permanent", subType: "General", message: "Mailbox jo@acme.example does not exist" },
      ...over,
    },
  });

/** A request signed the way the provider signs it. */
async function signed(body: string, over: { id?: string; ts?: number; secret?: string; method?: string } = {}): Promise<WebhookRequest> {
  const id = over.id ?? ID;
  const ts = String(over.ts ?? NOW / 1000);
  const mac = await sign(decodeSecret(over.secret ?? SECRET)!, id, ts, body);
  const headers: Record<string, string> = { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${mac}` };
  return { method: over.method ?? "POST", header: (n) => headers[n.toLowerCase()] ?? null, body };
}

const bare = (body: string, headers: Record<string, string> = {}, method = "POST"): WebhookRequest => ({
  method, header: (n) => headers[n.toLowerCase()] ?? null, body,
});

function harness(over: Partial<WebhookDeps> = {}) {
  const logs: string[] = [];
  const record = vi.fn(async (_input: RecordInput) => ({ duplicate: false, outcome: "suppressed", suppressed: 1, protected: 0 }));
  const deps: WebhookDeps = { secret: SECRET, protectedAddresses: ["team@acme.test"], now: () => NOW, record, log: (l) => logs.push(l), ...over };
  return { deps, record, logs };
}

describe("a bounce fixture, replayed", () => {
  it("records it with the provider's message id as the event id, and answers 200", async () => {
    const { deps, record, logs } = harness();
    const res = await handleWebhook(await signed(bouncedBody()), deps);
    expect(res).toEqual({ status: 200, body: { ok: true, duplicate: false, outcome: "suppressed" } });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({
      eventId: ID,
      type: "email.bounced",
      messageId: "re_abc123",
      recipients: ["jo@acme.example"],
      bounceType: "Permanent",
      detail: "General: Mailbox [email] does not exist",
      occurredAt: "2025-10-28T12:00:00.000Z",   // the envelope's time: this fixture's data has none
      protectedAddresses: ["team@acme.test"],
    });
    expect(logs).toEqual(["WEBHOOK_RECORDED: type=email.bounced bounce=Permanent outcome=suppressed suppressed=1"]);
  });

  it("answers 200 to the provider's retry of the same delivery, and the database says nothing changed", async () => {
    const record = vi.fn(async () => ({ duplicate: true }));
    const { deps, logs } = harness({ record });
    const first = await handleWebhook(await signed(bouncedBody()), deps);
    const retry = await handleWebhook(await signed(bouncedBody()), deps);
    expect(first).toEqual({ status: 200, body: { ok: true, duplicate: true } });
    expect(retry).toEqual(first);
    // Both carried the same event id, which is what lets the database tell a replay.
    expect(record.mock.calls.map(([i]) => i.eventId)).toEqual([ID, ID]);
    expect(logs).toEqual([]);
  });

  it("never puts an address, the subject or the provider's text in a log line or an answer", async () => {
    const { deps, logs } = harness();
    const res = await handleWebhook(await signed(bouncedBody()), deps);
    for (const text of [...logs, JSON.stringify(res)]) expect(text).not.toMatch(/jo@acme|We received|does not exist|re_abc123/);
  });
});

describe("who may call it", () => {
  it("refuses a request that is not signed, however the settings are, so the setup's probe sees the function itself", async () => {
    for (const secret of [SECRET, undefined]) {
      const { deps, record } = harness({ secret });
      expect(await handleWebhook(bare("{}"), deps)).toEqual({ status: 401, body: { error: "Unauthorized" } });
      expect(await handleWebhook(bare("{}", { authorization: "Bearer a-supabase-jwt" }), deps)).toEqual({ status: 401, body: { error: "Unauthorized" } });
      expect(record).not.toHaveBeenCalled();
    }
  });

  it("refuses a signature made with another secret, a changed body, or a stale timestamp, and records nothing", async () => {
    const { deps, record, logs } = harness();
    const wrongKey = await signed(bouncedBody(), { secret: `whsec_${btoa("another-endpoints-secret-value-32b")}` });
    const tampered = { ...(await signed(bouncedBody())), body: bouncedBody({ to: ["someone.else@acme.example"] }) };
    const stale = await signed(bouncedBody(), { ts: NOW / 1000 - 301 });
    for (const req of [wrongKey, tampered, stale]) expect(await handleWebhook(req, deps)).toEqual({ status: 401, body: { error: "Unauthorized" } });
    expect(record).not.toHaveBeenCalled();
    expect(logs).toEqual(["WEBHOOK_REJECTED: reason=no_match", "WEBHOOK_REJECTED: reason=no_match", "WEBHOOK_REJECTED: reason=timestamp_too_old"]);
  });

  it("accepts the standard webhook-* header names too", async () => {
    const { deps, record } = harness();
    const body = bouncedBody();
    const mac = await sign(decodeSecret(SECRET)!, ID, String(NOW / 1000), body);
    const headers: Record<string, string> = { "webhook-id": ID, "webhook-timestamp": String(NOW / 1000), "webhook-signature": `v1,${mac}` };
    expect((await handleWebhook(bare(body, headers), deps)).status).toBe(200);
    expect(record).toHaveBeenCalled();
  });

  it("only takes POST, and bodies of a sane size", async () => {
    const { deps, record } = harness();
    expect((await handleWebhook(await signed(bouncedBody(), { method: "GET" }), deps)).status).toBe(405);
    expect((await handleWebhook(await signed(bouncedBody(), { method: "PUT" }), deps)).status).toBe(405);
    expect((await handleWebhook(bare("x".repeat(MAX_BODY_BYTES + 1)), deps)).status).toBe(413);
    expect(record).not.toHaveBeenCalled();
  });
});

describe("settings", () => {
  it("says so, and records nothing, when the secret is not set: a signed request cannot be checked", async () => {
    const { deps, record, logs } = harness({ secret: undefined });
    const res = await handleWebhook(await signed(bouncedBody()), deps);
    expect(res).toEqual({ status: 503, body: { error: "Webhooks are unavailable right now." } });
    expect(record).not.toHaveBeenCalled();
    expect(logs).toEqual(["WEBHOOK_CONFIG_MISSING: RESEND_WEBHOOK_SECRET is not set; bounces and complaints are not being processed"]);
  });

  it("says so when the secret is not a signing secret", async () => {
    const { deps, logs } = harness({ secret: "whsec_***" });
    const res = await handleWebhook(await signed(bouncedBody()), deps);
    expect(res.status).toBe(503);
    expect(logs[0]).toContain("is not a whsec_ signing secret");
  });
});

describe("what it does with an event", () => {
  it("acknowledges, and drops, an event it does not act on", async () => {
    const { deps, record } = harness();
    const delivered = JSON.stringify({ type: "email.delivered", created_at: "x", data: { email_id: "re_1", to: ["a@b.example"] } });
    expect(await handleWebhook(await signed(delivered), deps)).toEqual({ status: 200, body: { ok: true, ignored: true } });
    expect(record).not.toHaveBeenCalled();
  });

  it("acknowledges a tracked event with no recipient, and logs it as unusable (warn, not error)", async () => {
    const { deps, record, logs } = harness();
    const res = await handleWebhook(await signed(bouncedBody({ to: [] })), deps);
    expect(res).toEqual({ status: 200, body: { ok: true, ignored: true } });
    expect(record).not.toHaveBeenCalled();
    expect(logs).toEqual(["WEBHOOK_UNUSABLE: type=email.bounced had no recipient to act on"]);
    expect(logLevel(logs[0])).toBe("warn");
  });

  it("answers 400 to a signed body that is not JSON", async () => {
    const { deps, record } = harness();
    expect(await handleWebhook(await signed("not json"), deps)).toEqual({ status: 400, body: { error: "Bad request" } });
    expect(record).not.toHaveBeenCalled();
  });

  it("answers 5xx when the database fails, so the provider retries, and logs only a code", async () => {
    const record = vi.fn(async () => { throw { code: "PGRST202", message: "row for jo@acme.example violates something" }; });
    const { deps, logs } = harness({ record });
    expect(await handleWebhook(await signed(bouncedBody()), deps)).toEqual({ status: 500, body: { error: "Internal error" } });
    expect(logs).toEqual(["WEBHOOK_RECORD_FAILED: type=email.bounced PGRST202; the provider will retry"]);
    expect(logs.join("")).not.toContain("jo@acme");
  });

  it("raises an alert-grade line when a bounce hits the advisory team, which is left unsuppressed", async () => {
    const record = vi.fn(async () => ({ duplicate: false, outcome: "protected", suppressed: 0, protected: 1 }));
    const { deps, logs } = harness({ record });
    const res = await handleWebhook(await signed(bouncedBody({ to: ["team@acme.test"] })), deps);
    expect(res.status).toBe(200);
    expect(logs.map((l) => l.split(":")[0])).toEqual(["WEBHOOK_RECORDED", "WEBHOOK_ADVISOR_BOUNCE"]);
    expect(logLevel(logs[1])).toBe("error");
    expect(logs[1]).toContain("NOT suppressed");
    expect(logs.join("")).not.toContain("team@acme.test");
  });

  it("passes a transient bounce and a complaint through for the database to judge", async () => {
    const { deps, record } = harness();
    await handleWebhook(await signed(JSON.stringify({ type: "email.complained", created_at: "x", data: { email_id: "re_2", to: ["a@b.example"] } }), { id: "msg_c" }), deps);
    await handleWebhook(await signed(bouncedBody({ bounce: { type: "Transient", subType: "MailboxFull", message: "full" } }), { id: "msg_t" }), deps);
    expect(record.mock.calls.map(([i]) => [i.type, i.bounceType])).toEqual([["email.complained", null], ["email.bounced", "Transient"]]);
  });
});

describe("log routing and codes", () => {
  it("sends a recorded event to the info log, outside noise to warnings, and everything else to the error log operators alert on", () => {
    expect(logLevel("WEBHOOK_RECORDED: type=email.bounced outcome=suppressed suppressed=1")).toBe("log");
    expect(logLevel("WEBHOOK_REJECTED: reason=no_match")).toBe("warn");
    expect(logLevel("WEBHOOK_UNUSABLE: type=email.bounced had no recipient to act on")).toBe("warn");
    for (const line of ["WEBHOOK_RECORD_FAILED: x", "WEBHOOK_CONFIG_MISSING: x", "WEBHOOK_ADVISOR_BOUNCE: x", "WEBHOOK_ERROR: x"]) expect(logLevel(line)).toBe("error");
  });

  it("reduces a database error to its code and never its text", () => {
    expect(errorCode({ code: "23505", message: "dup jo@acme.example" })).toBe("23505");
    expect(errorCode({ code: "not a code!", message: "x" })).toBe("unknown");
    expect(errorCode(new Error("boom"))).toBe("unknown");
    expect(errorCode(null)).toBe("unknown");
  });
});
