import { describe, expect, it, vi } from "vitest";
import { blockedKinds, readDispatchConfig } from "./config";
import {
  CLAIM_LEASE_SECONDS,
  dispatchEvents,
  FROZEN_MAX_AGE_MS,
  logLevel,
  MAX_ATTEMPTS,
  noteBlockedKinds,
  parsePending,
  reapedDeaths,
  reportReaped,
  reportReconcile,
  retryDelaySeconds,
  rpcErrorCode,
  runMaintenance,
  sendableKinds,
  type DispatchDeps,
  type OutboxRow,
  type PendingSend,
} from "./dispatch";
import { createResendAdapter, sendEmail, type EmailMessage, type SendResult } from "./providers";

const env: Record<string, string> = {
  EMAIL_FROM: "Edgar Allan Advisory <intake@mail.example.com>",
  ADVISORY_NOTIFY_EMAIL: "advisors@example.com",
  APP_BASE_URL: "https://app.example.com",
  SUPPORT_EMAIL: "support@example.com",
  PROSPECT_RESPONSE_TIME: "2 business days",
};
const configFrom = (vars: Record<string, string>) => readDispatchConfig((n) => vars[n]);
const config = configFrom(env);

// Every setting a message is built from, changed, as an operator might between an attempt and its retry.
const changedEnv: Record<string, string> = {
  EMAIL_FROM: "Other Sender <other@mail.example.com>",
  ADVISORY_NOTIFY_EMAIL: "new-team@example.com, second@example.com",
  APP_BASE_URL: "https://new.example.com",
  SUPPORT_EMAIL: "help@example.com",
  PROSPECT_RESPONSE_TIME: "1 business day",
};

const NOW = Date.parse("2026-10-22T12:00:00.000Z");
const HOUR = 3_600_000;
const SESSION = "11111111-2222-3333-4444-555555555555";

const advisorRow = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "evt-advisor",
  kind: "advisor_notification",
  session_id: SESSION,
  attempts: 1,
  pending_send: null,
  payload: { reference: "EAA-2026-AB12CD34", company_name: "Acme Co", contact_name: "Joanna Doe", contact_email: "jo@acme.example", resubmission: false },
  ...over,
});
const prospectRow = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "evt-prospect",
  kind: "prospect_confirmation",
  session_id: SESSION,
  attempts: 1,
  pending_send: null,
  payload: { reference: "EAA-2026-AB12CD34", company_name: "Acme Co", recipient_name: "Jo Doe", recipient_email: "jo@acme.example" },
  ...over,
});

const PII = ["jo@acme.example", "Joanna", "Jo Doe", "Acme", "advisors@example.com", "support@example.com"];

/** A frozen send as the database stores it. */
const pendingSend = (over: Partial<PendingSend> = {}): PendingSend => ({
  key: "outbox-evt-advisor-0123456789ab",
  message: { from: "Old Sender <old@mail.example.com>", to: ["old-team@example.com"], subject: "Old subject", text: "Old text", html: "<p>Old html</p>" },
  attempt: 1,
  frozen_at: new Date(NOW - HOUR).toISOString(),
  ...over,
});

/** What a jsonb column keeps of a value. */
const jsonb = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** A `freeze` that stores whatever it is given and answers with the stored copy, under a fixed key. */
const storing = (key = "outbox-evt-aaaaaaaaaaaa") =>
  vi.fn(async (_id: string, attempt: number, message: EmailMessage, _replace: boolean): Promise<unknown> => ({
    key,
    message: jsonb(message),
    attempt,
    frozen_at: new Date(NOW).toISOString(),
  }));

function harness(over: Partial<DispatchDeps> = {}, sendResult: SendResult = { ok: true, messageId: "msg_1" }) {
  const sent: { message: EmailMessage; key: string }[] = [];
  const logs: string[] = [];
  const deps: DispatchDeps = {
    config,
    now: () => NOW,
    send: vi.fn(async (message, key) => {
      sent.push({ message, key });
      return sendResult;
    }),
    freeze: storing(),
    complete: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
    log: (line) => logs.push(line),
    ...over,
  };
  return { deps, sent, logs };
}

const ambiguous503: SendResult = { ok: false, kind: "provider_error", httpStatus: 503, ambiguous: true };

describe("retry schedule", () => {
  it("backs off, then gives up on the fifth failure", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect([1, 2, 3, 4, 5].map(retryDelaySeconds)).toEqual([60, 300, 1800, 7200, null]);
    expect(retryDelaySeconds(9)).toBeNull();
  });
});

describe("dispatching an advisor alert", () => {
  it("sends one email to the distribution list with a link to the secure review, then records it", async () => {
    const { deps, sent, logs } = harness();
    const summary = await dispatchEvents([advisorRow()], deps);

    expect(summary).toEqual({ sent: 1, retrying: 0, dead: 0, unrecorded: 0, skipped: 0 });
    expect(sent).toHaveLength(1);
    const { message } = sent[0];
    expect(message.from).toBe("Edgar Allan Advisory <intake@mail.example.com>");
    expect(message.to).toEqual(["advisors@example.com"]);
    expect(message.subject).toContain("Acme Co");
    expect(message.subject).toContain("EAA-2026-AB12CD34");
    expect(message.text).toContain(`https://app.example.com/advisor/submissions/${SESSION}`);
    expect(deps.complete).toHaveBeenCalledWith("evt-advisor", "msg_1");
    expect(deps.fail).not.toHaveBeenCalled();
    expect(logs).toEqual(["OUTBOX_SENT: kind=advisor_notification event=evt-advisor attempt=1 msg=fresh"]);
  });

  it("sends no census, payroll or document content, even if the row carried it", async () => {
    const { deps, sent } = harness();
    await dispatchEvents(
      [advisorRow({ payload: { ...(advisorRow().payload as object), employees: [{ first_name: "Zelda", salary: 123456 }], documents: ["payroll.pdf"], pay_frequency: "weekly" } })],
      deps,
    );
    const everything = JSON.stringify(sent[0].message);
    for (const forbidden of ["Zelda", "123456", "payroll.pdf", "weekly"]) expect(everything).not.toContain(forbidden);
  });
});

describe("dispatching a prospect confirmation", () => {
  it("goes only to the recipient, with the support address to reply to", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([prospectRow()], deps);
    expect(sent[0].message.to).toEqual(["jo@acme.example"]);
    expect(sent[0].message.replyTo).toBe("support@example.com");
    expect(sent[0].message.text).toContain("within 2 business days");
    expect(sent[0].message.text).toContain("EAA-2026-AB12CD34");
  });
});

describe("failures", () => {
  it("logs a failed send and retries it later, without touching anything else", async () => {
    const { deps, logs } = harness({}, ambiguous503);
    const summary = await dispatchEvents([advisorRow({ attempts: 1 })], deps);
    expect(summary).toEqual({ sent: 0, retrying: 1, dead: 0, unrecorded: 0, skipped: 0 });
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "provider_error:503", 60, 1, false);
    expect(deps.complete).not.toHaveBeenCalled();
    expect(logs).toEqual(["OUTBOX_SEND_FAILED: kind=advisor_notification event=evt-advisor attempt=1/5 msg=fresh reason=provider_error:503 retry_in=60s"]);
  });

  it("backs off further on each attempt", async () => {
    for (const [attempts, delay] of [[2, 300], [3, 1800], [4, 7200]] as const) {
      const { deps } = harness({}, ambiguous503);
      await dispatchEvents([advisorRow({ attempts })], deps);
      expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "provider_error:503", delay, attempts, false);
    }
  });

  it("marks the event dead, and logs it for operators, once attempts run out", async () => {
    const { deps, logs } = harness({}, ambiguous503);
    const summary = await dispatchEvents([advisorRow({ attempts: MAX_ATTEMPTS })], deps);
    expect(summary).toEqual({ sent: 0, retrying: 0, dead: 1, unrecorded: 0, skipped: 0 });
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "provider_error:503", null, MAX_ATTEMPTS, false);
    expect(logs).toEqual(["OUTBOX_DEAD: kind=advisor_notification event=evt-advisor attempts=5 reason=provider_error:503; needs an operator"]);
  });

  it("records a timeout or network error as a failure of that kind", async () => {
    const { deps } = harness({}, { ok: false, kind: "timeout", httpStatus: null, ambiguous: true });
    await dispatchEvents([advisorRow()], deps);
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "timeout", 60, 1, false);
  });

  it("treats a send that throws as an ambiguous network failure", async () => {
    const { deps } = harness({ send: vi.fn(async () => { throw new Error("boom jo@acme.example"); }) });
    const summary = await dispatchEvents([advisorRow()], deps);
    expect(summary.retrying).toBe(1);
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "network", 60, 1, false);
  });

  it("gives up at once on a payload that can never be sent, without freezing or calling the provider", async () => {
    const { deps, sent } = harness();
    const summary = await dispatchEvents(
      [prospectRow({ payload: { reference: "EAA-1", recipient_email: "not an email" } }), advisorRow({ id: "e2", payload: {} }), advisorRow({ id: "e3", kind: "mystery" })],
      deps,
    );
    expect(sent).toHaveLength(0);
    expect(deps.freeze).not.toHaveBeenCalled();
    expect(summary.dead).toBe(3);
    expect(deps.fail).toHaveBeenCalledWith("evt-prospect", "invalid_payload", null, 1, false);
    expect(deps.fail).toHaveBeenCalledWith("e2", "invalid_payload", null, 1, false);
    expect(deps.fail).toHaveBeenCalledWith("e3", "unknown_kind", null, 1, false);
  });

  it("holds an event back, without freezing or sending, if its kind loses its configuration mid-run", async () => {
    const { deps, sent } = harness({ config: readDispatchConfig(() => undefined) });
    const summary = await dispatchEvents([advisorRow()], deps);
    expect(sent).toHaveLength(0);
    expect(deps.freeze).not.toHaveBeenCalled();
    expect(summary.retrying).toBe(1);
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "not_configured", 60, 1, false);
  });

  it("carries on with the rest of the batch after one fails, telling the database whether the rejection was definitive", async () => {
    const send = vi.fn(async (message: EmailMessage): Promise<SendResult> =>
      message.to[0] === "jo@acme.example" ? { ok: false, kind: "auth", httpStatus: 403, ambiguous: false } : { ok: true, messageId: "msg_ok" });
    const { deps } = harness({ send });
    const summary = await dispatchEvents([prospectRow(), advisorRow()], deps);
    expect(summary).toEqual({ sent: 1, retrying: 1, dead: 0, unrecorded: 0, skipped: 0 });
    expect(deps.fail).toHaveBeenCalledWith("evt-prospect", "auth:403", 60, 1, true);
    expect(deps.complete).toHaveBeenCalledWith("evt-advisor", "msg_ok");
  });

  it("keeps going, and says so, when the outcome cannot be written to the database", async () => {
    const complete = vi.fn(async (id: string) => { if (id === "evt-advisor") throw new Error("db down"); });
    const { deps, logs } = harness({ complete });
    const summary = await dispatchEvents([advisorRow(), prospectRow()], deps);
    expect(summary).toEqual({ sent: 1, retrying: 0, dead: 0, unrecorded: 1, skipped: 0 });
    expect(logs.some((l) => l.startsWith("OUTBOX_RECORD_FAILED: kind=advisor_notification event=evt-advisor"))).toBe(true);
  });

  it("never puts an address, name or message body in a log line", async () => {
    const { deps, logs } = harness({}, { ok: false, kind: "provider_error", httpStatus: 500, ambiguous: true });
    await dispatchEvents([advisorRow(), prospectRow({ attempts: MAX_ATTEMPTS })], deps);
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) for (const secret of PII) expect(line).not.toContain(secret);
  });
});

describe("the fail call", () => {
  it("passes the claim's attempt number, so a stale worker's late write matches nothing", async () => {
    for (const attempts of [1, 3, MAX_ATTEMPTS]) {
      const { deps } = harness({}, ambiguous503);
      await dispatchEvents([advisorRow({ attempts })], deps);
      expect(vi.mocked(deps.fail).mock.calls[0][3]).toBe(attempts);
    }
  });

  it("flags a rejection as definitive only when the provider proved it did not send", async () => {
    const answers: [SendResult, boolean][] = [
      [{ ok: false, kind: "rate_limited", httpStatus: 429, ambiguous: false }, true],
      [{ ok: false, kind: "provider_error", httpStatus: 422, ambiguous: false }, true],
      [{ ok: false, kind: "provider_error", httpStatus: 409, ambiguous: true }, false],
      [{ ok: false, kind: "timeout", httpStatus: null, ambiguous: true }, false],
    ];
    for (const [answer, definitive] of answers) {
      const { deps } = harness({}, answer);
      await dispatchEvents([advisorRow()], deps);
      expect(vi.mocked(deps.fail).mock.calls[0][4]).toBe(definitive);
    }
  });
});

describe("freezing the message", () => {
  it("builds from the current settings and freezes with the claim's attempt before anything is sent", async () => {
    const order: string[] = [];
    const { deps } = harness();
    const { freeze, send } = deps;
    deps.freeze = vi.fn(async (...args: Parameters<DispatchDeps["freeze"]>) => { order.push("freeze"); return freeze(...args); });
    deps.send = vi.fn(async (...args: Parameters<DispatchDeps["send"]>) => { order.push("send"); return send(...args); });
    await dispatchEvents([advisorRow({ attempts: 3 })], deps);
    expect(order).toEqual(["freeze", "send"]);
    const [id, attempt, message, replace] = vi.mocked(deps.freeze).mock.calls[0];
    expect([id, attempt, replace]).toEqual(["evt-advisor", 3, false]);
    expect(message.to).toEqual(["advisors@example.com"]);
    expect(message.from).toBe("Edgar Allan Advisory <intake@mail.example.com>");
  });

  it("sends the stored copy and its key, never the message it built", async () => {
    const stored = pendingSend({ key: "outbox-evt-advisor-feedfacecafe", attempt: 1 });
    const { deps, sent } = harness({ freeze: vi.fn(async () => jsonb(stored)) });
    await dispatchEvents([advisorRow()], deps);
    expect(sent).toEqual([{ message: stored.message, key: "outbox-evt-advisor-feedfacecafe" }]);
  });

  it("freezes only well-formed text, however odd the prospect's entry", async () => {
    const stray = "Jo\ud83d Doe\ude00 \u{1F600}";
    const { deps } = harness();
    await dispatchEvents([
      advisorRow({ payload: { reference: "EAA-1", company_name: `Acme${stray}`, contact_name: stray } }),
      prospectRow({ payload: { reference: "EAA-1", company_name: stray, recipient_name: stray, recipient_email: "a@b.example" } }),
    ], deps);
    const calls = vi.mocked(deps.freeze).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [, , message] of calls) {
      const body = JSON.stringify(message);
      expect(body).not.toMatch(/\\ud[89a-f][0-9a-f]{2}/i);
      expect(body).toContain("\u{1F600}");
    }
  });

  describe("a freeze that cannot be used", () => {
    it("is a visible, backed-off failure and sends nothing, when the freeze throws", async () => {
      const freeze = vi.fn(async () => { throw new Error("db down for jo@acme.example"); });
      const { deps, sent, logs } = harness({ freeze });
      const summary = await dispatchEvents([advisorRow({ attempts: 2 })], deps);
      expect(sent).toHaveLength(0);
      expect(summary).toEqual({ sent: 0, retrying: 1, dead: 0, unrecorded: 0, skipped: 0 });
      expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "freeze_failed", 300, 2, false);
      expect(logs).toEqual(["OUTBOX_SEND_FAILED: kind=advisor_notification event=evt-advisor attempt=2/5 reason=freeze_failed retry_in=300s"]);
      for (const line of logs) for (const secret of PII) expect(line).not.toContain(secret);
    });

    it("ends as a logged dead event once attempts run out", async () => {
      const { deps, logs } = harness({ freeze: vi.fn(async () => { throw new Error("db down"); }) });
      const summary = await dispatchEvents([advisorRow({ attempts: MAX_ATTEMPTS })], deps);
      expect(summary.dead).toBe(1);
      expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "freeze_failed", null, MAX_ATTEMPTS, false);
      expect(logs).toEqual(["OUTBOX_DEAD: kind=advisor_notification event=evt-advisor attempts=5 reason=freeze_failed; needs an operator"]);
    });

    it.each([
      ["an empty object", {}],
      ["a string", "stored"],
      ["a pending with no message", { key: "k", attempt: 1, frozen_at: new Date(NOW).toISOString() }],
      ["a message without html", { ...pendingSend(), message: { from: "a@b.example", to: ["c@d.example"], subject: "s", text: "t" } }],
    ])("is the same failure when the answer is malformed (%s)", async (_name, answer) => {
      const { deps, sent } = harness({ freeze: vi.fn(async () => answer) });
      const summary = await dispatchEvents([advisorRow()], deps);
      expect(sent).toHaveLength(0);
      expect(summary.retrying).toBe(1);
      expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "freeze_failed", 60, 1, false);
    });

    it("skips the event, sending nothing, when the database says this worker no longer holds it", async () => {
      const freeze = vi.fn(async (id: string, ...rest: [number, EmailMessage, boolean]) =>
        id === "evt-advisor" ? null : storing("outbox-evt-prospect-aaaaaaaaaaaa")(id, ...rest));
      const { deps, sent, logs } = harness({ freeze });
      const summary = await dispatchEvents([advisorRow(), prospectRow()], deps);
      expect(summary).toEqual({ sent: 1, retrying: 0, dead: 0, unrecorded: 0, skipped: 1 });
      expect(sent.map((s) => s.message.to[0])).toEqual(["jo@acme.example"]);
      expect(deps.fail).not.toHaveBeenCalled();
      expect(deps.complete).toHaveBeenCalledTimes(1);
      expect(logs.some((l) => l.includes("evt-advisor"))).toBe(false);
    });
  });
});

describe("reusing a frozen message", () => {
  it("sends it as stored, with its key, without building or freezing again", async () => {
    const stored = pendingSend({ attempt: 1, frozen_at: new Date(NOW - HOUR).toISOString() });
    // The settings differ from the ones the message was built with; they must not matter.
    const { deps, sent, logs } = harness({ config: configFrom(changedEnv) });
    const summary = await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
    expect(summary.sent).toBe(1);
    expect(sent).toEqual([{ message: stored.message, key: stored.key }]);
    expect(deps.freeze).not.toHaveBeenCalled();
    expect(logs).toEqual(["OUTBOX_SENT: kind=advisor_notification event=evt-advisor attempt=2 msg=frozen"]);
  });

  it("tags a failed retry of a frozen message as such", async () => {
    const { deps, logs } = harness({}, ambiguous503);
    await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(pendingSend()) })], deps);
    expect(logs).toEqual(["OUTBOX_SEND_FAILED: kind=advisor_notification event=evt-advisor attempt=2/5 msg=frozen reason=provider_error:503 retry_in=300s"]);
  });

  it("sends only the fields of a message, whatever else the stored object carries", async () => {
    const stored = jsonb(pendingSend({ message: { ...pendingSend().message, bcc: "x@y.example" } as EmailMessage }));
    const { deps, sent } = harness();
    await dispatchEvents([advisorRow({ attempts: 2, pending_send: stored })], deps);
    expect(sent[0].message).not.toHaveProperty("bcc");
  });

  describe("expiry", () => {
    it("still reuses a message frozen just under 20 hours ago", async () => {
      const stored = pendingSend({ frozen_at: new Date(NOW - FROZEN_MAX_AGE_MS + 1000).toISOString() });
      const { deps, sent } = harness();
      await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      expect(sent[0].key).toBe(stored.key);
      expect(deps.freeze).not.toHaveBeenCalled();
    });

    it.each([
      ["exactly 20 hours", FROZEN_MAX_AGE_MS],
      ["21 hours", 21 * HOUR],
      ["a week", 168 * HOUR],
    ])("replaces a message frozen %s ago: rebuilt from the current settings, overwriting the stored one", async (_name, age) => {
      const stored = pendingSend({ frozen_at: new Date(NOW - age).toISOString() });
      const { deps, sent, logs } = harness({ config: configFrom(changedEnv) });
      await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      const [id, attempt, message, replace] = vi.mocked(deps.freeze).mock.calls[0];
      expect([id, attempt, replace]).toEqual(["evt-advisor", 2, true]);
      expect(message.to).toEqual(["new-team@example.com", "second@example.com"]);
      expect(sent).toHaveLength(1);
      expect(sent[0].key).not.toBe(stored.key);
      expect(sent[0].message.to).toEqual(["new-team@example.com", "second@example.com"]);
      expect(logs[0]).toContain("msg=fresh");
    });
  });

  describe("a stored value that is not a frozen send", () => {
    const valid = pendingSend();
    it.each([
      ["a string", "pending"],
      ["an array", [valid]],
      ["a number", 7],
      ["an empty object", {}],
      ["no key", { ...valid, key: undefined }],
      ["an empty key", { ...valid, key: "" }],
      ["no message", { ...valid, message: undefined }],
      ["a message without html", { ...valid, message: { ...valid.message, html: undefined } }],
      ["a message without a sender", { ...valid, message: { ...valid.message, from: "" } }],
      ["recipients that are not a list", { ...valid, message: { ...valid.message, to: "a@b.example" } }],
      ["no recipients", { ...valid, message: { ...valid.message, to: [] } }],
      ["a recipient that is not text", { ...valid, message: { ...valid.message, to: [42] } }],
      ["a reply-to that is not text", { ...valid, message: { ...valid.message, replyTo: 7 } }],
      ["an attempt that is not a whole number", { ...valid, attempt: 1.5 }],
      ["an attempt that is text", { ...valid, attempt: "1" }],
      ["no freeze time", { ...valid, frozen_at: undefined }],
      ["a freeze time that is not a date", { ...valid, frozen_at: "yesterday" }],
    ])("is replaced, not trusted: %s", async (_name, stored) => {
      expect(parsePending(jsonb(stored))).toBeNull();
      const { deps, sent } = harness();
      await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      expect(vi.mocked(deps.freeze).mock.calls[0][3]).toBe(true);
      expect(sent).toHaveLength(1);
      expect(sent[0].key).toBe("outbox-evt-aaaaaaaaaaaa");
    });

    it("is not replaced when nothing is stored (so the freeze can use its compare-and-set)", async () => {
      for (const absent of [null, undefined]) {
        const { deps } = harness();
        await dispatchEvents([advisorRow({ pending_send: absent })], deps);
        expect(vi.mocked(deps.freeze).mock.calls[0][3]).toBe(false);
      }
    });

    it("is read back as the message it holds when well formed", () => {
      expect(parsePending(jsonb(valid))).toEqual(valid);
      const withReplyTo = pendingSend({ message: { ...valid.message, replyTo: "support@example.com" } });
      expect(parsePending(jsonb(withReplyTo))?.message.replyTo).toBe("support@example.com");
      expect(parsePending(jsonb(valid))?.message).not.toHaveProperty("replyTo");
    });
  });
});

// The scenarios below run the dispatcher against a model of the database's contract (freeze is a
// compare-and-set on the claim's attempt, a fenced fail clears the freeze only for a definitive
// rejection of the first send, complete clears it) and the real provider classification, with only
// the HTTP answers scripted. supabase/tests/submission_outbox.sql tests the real SQL.
type Answer = number | "ok" | "timeout" | "network";

interface StoredEvent {
  event: Pick<OutboxRow, "id" | "kind" | "session_id" | "payload">;
  status: "pending" | "sending" | "sent" | "dead";
  lapsed: boolean;
  attempts: number;
  pending_send: unknown;
  last_error: string | null;
}

function createWorld(vars: Record<string, string> = env) {
  const stored = new Map<string, StoredEvent>();
  const requests: { key: string; body: string }[] = [];
  const logs: string[] = [];
  const answers: Answer[] = [];
  const faults = { completeFails: false, freezeReplyLost: false };
  const adapter = createResendAdapter({ apiKey: "re_key" });
  let current = configFrom(vars);
  let keys = 0;

  const fetchStub = (async (_url: string, init: RequestInit) => {
    requests.push({ key: (init.headers as Record<string, string>)["Idempotency-Key"], body: init.body as string });
    const answer = answers.shift() ?? "ok";
    if (answer === "network") throw new TypeError("connection reset");
    if (answer === "timeout") {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }
    return new Response(answer === "ok" ? JSON.stringify({ id: "msg_ok" }) : "{}", { status: answer === "ok" ? 200 : answer });
  }) as unknown as typeof fetch;

  const freeze = vi.fn(async (id: string, attempt: number, message: EmailMessage, replace: boolean): Promise<unknown> => {
    const s = stored.get(id);
    if (!s || s.status !== "sending" || s.attempts !== attempt || (s.pending_send !== null && !replace)) return null;
    keys += 1;
    s.pending_send = jsonb({ key: `outbox-${id}-${keys.toString(16).padStart(12, "0")}`, message, attempt, frozen_at: new Date(NOW).toISOString() });
    if (faults.freezeReplyLost) {
      faults.freezeReplyLost = false;
      throw new Error("connection reset after the write");
    }
    return jsonb(s.pending_send);
  });

  const complete = vi.fn(async (id: string) => {
    if (faults.completeFails) {
      faults.completeFails = false;
      throw new Error("db down");
    }
    const s = stored.get(id);
    if (s && s.status !== "sent") Object.assign(s, { status: "sent", pending_send: null });
  });

  const fail = vi.fn(async (id: string, error: string, retryInSeconds: number | null, attempt: number, definitive: boolean) => {
    const s = stored.get(id);
    if (!s || s.status !== "sending" || s.attempts !== attempt) return;
    s.status = retryInSeconds === null ? "dead" : "pending";
    s.last_error = error;
    if (definitive && (s.pending_send as PendingSend | null)?.attempt === attempt) s.pending_send = null;
  });

  return {
    requests,
    logs,
    answers,
    faults,
    freeze,
    complete,
    fail,
    get config() {
      return current;
    },
    setEnv(next: Record<string, string>) {
      current = configFrom(next);
    },
    add(row: OutboxRow) {
      const { id, kind, session_id, payload } = row;
      stored.set(id, { event: { id, kind, session_id, payload }, status: "pending", lapsed: false, attempts: 0, pending_send: null, last_error: null });
    },
    get: (id: string) => stored.get(id)!,
    /** The claim's lease runs out without the worker recording anything. */
    lapse(id: string) {
      stored.get(id)!.lapsed = true;
    },
    /** One scheduled run: claim what is due, then dispatch it. */
    async run() {
      const rows: OutboxRow[] = [...stored.values()]
        .filter((s) => s.status === "pending" || (s.status === "sending" && s.lapsed))
        .map((s) => {
          Object.assign(s, { status: "sending", lapsed: false, attempts: s.attempts + 1 });
          return { ...s.event, attempts: s.attempts, pending_send: jsonb(s.pending_send) };
        });
      return dispatchEvents(rows, {
        config: current,
        now: () => NOW,
        send: (message, key) => sendEmail(adapter, message, key, { fetch: fetchStub, timeoutMs: 5 }),
        freeze,
        complete,
        fail,
        log: (line) => logs.push(line),
      });
    },
  };
}

const KEY_FORMAT = /^outbox-evt-(advisor|prospect)-[0-9a-f]{12}$/;

describe("a retry after an ambiguous failure", () => {
  const kinds: [string, () => OutboxRow][] = [["advisor alert", advisorRow], ["prospect confirmation", prospectRow]];

  it.each(kinds)("sends the byte-identical frozen %s with the same key, even after every setting changed", async (_name, makeRow) => {
    const row = makeRow();
    const world = createWorld();
    world.add(row);
    world.answers.push(503, "ok");

    expect(await world.run()).toMatchObject({ sent: 0, retrying: 1 });
    expect(world.get(row.id).pending_send).not.toBeNull();

    world.setEnv(changedEnv);
    expect(await world.run()).toMatchObject({ sent: 1, retrying: 0 });

    expect(world.requests).toHaveLength(2);
    expect(world.requests[1].body).toBe(world.requests[0].body);
    expect(world.requests[1].key).toBe(world.requests[0].key);
    expect(world.requests[0].key).toMatch(KEY_FORMAT);
    expect(world.freeze).toHaveBeenCalledTimes(1);
    expect(world.logs.filter((l) => l.startsWith("OUTBOX_SENT"))).toEqual([`OUTBOX_SENT: kind=${row.kind} event=${row.id} attempt=2 msg=frozen`]);
    expect(world.get(row.id)).toMatchObject({ status: "sent", pending_send: null });

    // Control: the changed settings really would have produced a different message, so the
    // identical body above is the frozen copy and not a coincidence.
    const rebuilt = createWorld(changedEnv);
    rebuilt.add(row);
    await rebuilt.run();
    expect(rebuilt.requests[0].body).not.toBe(world.requests[0].body);
    for (const changed of ["other@mail.example.com", "new-team@example.com", "help@example.com", "new.example.com", "1 business day"]) {
      expect(world.requests[1].body).not.toContain(changed);
    }
  });

  it.each<[string, Answer]>([
    ["409 (an earlier send with this key may still be in flight)", 409],
    ["408", 408],
    ["425", 425],
    ["a 5xx", 502],
    ["a redirect status", 302],
    ["a timeout", "timeout"],
    ["a network error", "network"],
  ])("keeps the frozen message and key after %s", async (_name, answer) => {
    const world = createWorld();
    world.add(advisorRow());
    world.answers.push(answer, "ok");

    await world.run();
    const frozen = jsonb(world.get("evt-advisor").pending_send);
    expect(frozen).not.toBeNull();
    expect(world.fail.mock.calls[0][4]).toBe(false);

    world.setEnv(changedEnv);
    await world.run();
    expect(world.requests.map((r) => r.key)).toEqual([world.requests[0].key, world.requests[0].key]);
    expect(world.requests[1].body).toBe(world.requests[0].body);
    expect(world.freeze).toHaveBeenCalledTimes(1);
  });

  it("keeps the frozen message through timeout, then 429, then a success", async () => {
    const world = createWorld();
    world.add(advisorRow());
    world.answers.push("timeout", 429, "ok");

    await world.run();
    world.setEnv(changedEnv);
    await world.run();
    // The 429 was definitive, but of a retry, not of the first send: the freeze must survive it.
    expect(world.fail.mock.calls[1]).toEqual(["evt-advisor", "rate_limited:429", 300, 2, true]);
    expect(world.get("evt-advisor").pending_send).not.toBeNull();

    world.setEnv({ ...changedEnv, EMAIL_FROM: "Third Sender <third@mail.example.com>" });
    await world.run();

    expect(world.requests).toHaveLength(3);
    expect(new Set(world.requests.map((r) => r.key)).size).toBe(1);
    expect(new Set(world.requests.map((r) => r.body)).size).toBe(1);
    expect(world.freeze).toHaveBeenCalledTimes(1);
    expect(world.get("evt-advisor")).toMatchObject({ status: "sent", pending_send: null });
  });

  it("re-sends the frozen message when the send succeeded but recording it failed and the claim lapsed", async () => {
    const world = createWorld();
    world.add(advisorRow());
    world.faults.completeFails = true;

    expect(await world.run()).toMatchObject({ sent: 0, unrecorded: 1 });
    expect(world.get("evt-advisor").status).toBe("sending");

    world.setEnv(changedEnv);
    world.lapse("evt-advisor");
    expect(await world.run()).toMatchObject({ sent: 1, unrecorded: 0 });

    expect(world.requests).toHaveLength(2);
    expect(world.requests[1]).toEqual(world.requests[0]);
    expect(world.freeze).toHaveBeenCalledTimes(1);
    expect(world.get("evt-advisor")).toMatchObject({ status: "sent", pending_send: null });
  });

  it("picks up a freeze whose reply was lost: nothing is sent that attempt, the retry sends the stored message", async () => {
    const world = createWorld();
    world.add(advisorRow());
    world.faults.freezeReplyLost = true;

    expect(await world.run()).toMatchObject({ sent: 0, retrying: 1 });
    expect(world.requests).toHaveLength(0);
    expect(world.fail.mock.calls[0]).toEqual(["evt-advisor", "freeze_failed", 60, 1, false]);

    world.setEnv(changedEnv);
    await world.run();
    expect(world.requests).toHaveLength(1);
    expect(world.requests[0].key).toMatch(KEY_FORMAT);
    expect(world.requests[0].body).toContain("advisors@example.com");
    expect(world.requests[0].body).not.toContain("new-team@example.com");
    expect(world.freeze).toHaveBeenCalledTimes(1);
  });

  it("never carries a frozen address or name into a log line", async () => {
    const world = createWorld();
    world.add(advisorRow());
    world.add(prospectRow());
    world.answers.push(503, 503, 429, "ok");
    await world.run();
    await world.run();
    const text = world.logs.join("\n");
    expect(text).toContain("msg=fresh");
    expect(text).toContain("msg=frozen");
    for (const secret of PII) expect(text).not.toContain(secret);
  });
});

describe("a retry after a definitive failure of the first send", () => {
  it.each([400, 401, 403, 404, 405, 413, 422, 429])("rebuilds from the current settings under a new key after HTTP %i", async (status) => {
    const world = createWorld();
    world.add(advisorRow());
    world.answers.push(status, "ok");

    await world.run();
    expect(world.fail.mock.calls[0][4]).toBe(true);
    // The provider proved it sent nothing, so there is nothing left to protect.
    expect(world.get("evt-advisor").pending_send).toBeNull();

    world.setEnv(changedEnv);
    await world.run();

    expect(world.requests).toHaveLength(2);
    expect(world.requests[1].key).not.toBe(world.requests[0].key);
    expect(world.requests[1].key).toMatch(KEY_FORMAT);
    expect(world.requests[0].body).toContain("advisors@example.com");
    expect(world.requests[1].body).toContain("new-team@example.com");
    expect(world.requests[1].body).not.toContain("advisors@example.com");
    expect(world.freeze).toHaveBeenCalledTimes(2);
    expect(world.freeze.mock.calls.map((c) => c[3])).toEqual([false, false]);
    expect(world.logs.filter((l) => l.startsWith("OUTBOX_SENT"))).toEqual(["OUTBOX_SENT: kind=advisor_notification event=evt-advisor attempt=2 msg=fresh"]);
  });
});

describe("housekeeping before a scheduled run", () => {
  const reconcileOk = { healed: 0, failed: 0, unqueued: 0, oldest_age_seconds: 0, last_sqlstate: null };

  describe("reconcile reporting", () => {
    it("says nothing when nothing was missed", () => {
      const lines: string[] = [];
      expect(reportReconcile(reconcileOk, (l) => lines.push(l))).toEqual({ healed: 0, failed: 0, unqueued: 0 });
      expect(lines).toEqual([]);
    });

    it("notes what it queued", () => {
      const lines: string[] = [];
      expect(reportReconcile({ ...reconcileOk, healed: 3 }, (l) => lines.push(l))).toEqual({ healed: 3, failed: 0, unqueued: 0 });
      expect(lines).toEqual(["OUTBOX_RECONCILED: queued notifications for 3 missed certification(s)"]);
    });

    it("raises an alert, with counters and a code only, while any certification is still unqueued", () => {
      const lines: string[] = [];
      const report = reportReconcile({ healed: 1, failed: 2, unqueued: 2, oldest_age_seconds: 5432.9, last_sqlstate: "23514" }, (l) => lines.push(l));
      expect(report).toEqual({ healed: 1, failed: 2, unqueued: 2 });
      expect(lines).toEqual([
        "OUTBOX_RECONCILED: queued notifications for 1 missed certification(s)",
        "OUTBOX_ENQUEUE_FAILED: unqueued=2 oldest_age_s=5432 last_sqlstate=23514",
      ]);
    });

    it("says there is no code when none was recorded, and never repeats anything that is not a code", () => {
      for (const sqlstate of [null, undefined, "", "constraint violated for jo@acme.example", 23514]) {
        const lines: string[] = [];
        reportReconcile({ ...reconcileOk, unqueued: 1, oldest_age_seconds: 60, last_sqlstate: sqlstate }, (l) => lines.push(l));
        expect(lines).toEqual(["OUTBOX_ENQUEUE_FAILED: unqueued=1 oldest_age_s=60 last_sqlstate=none"]);
      }
    });

    it("reads nothing into an answer that is not an object", () => {
      const lines: string[] = [];
      for (const bad of [null, undefined, "ok", 5, []]) expect(reportReconcile(bad, (l) => lines.push(l))).toBeNull();
      expect(lines).toEqual([]);
    });
  });

  describe("reap reporting", () => {
    it("logs every abandoned event as dead and needing an operator, saying whether it may have been sent", () => {
      const lines: string[] = [];
      const count = reportReaped(
        [
          { id: "evt-1", kind: "advisor_notification", attempts: 5, last_error: "worker_lost" },
          { id: "evt-2", kind: "prospect_confirmation", attempts: 5, last_error: "worker_lost_maybe_sent" },
        ],
        (l) => lines.push(l),
      );
      expect(count).toBe(2);
      expect(lines).toEqual([
        "OUTBOX_DEAD: kind=advisor_notification event=evt-1 attempts=5 reason=worker_lost; needs an operator",
        "OUTBOX_DEAD: kind=prospect_confirmation event=evt-2 attempts=5 reason=worker_lost_maybe_sent; needs an operator",
      ]);
    });

    it("never repeats error text it was handed", () => {
      const lines: string[] = [];
      reportReaped([{ id: "evt-1", kind: "advisor_notification", attempts: 5, last_error: "boom for jo@acme.example" }], (l) => lines.push(l));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("reason=worker_lost;");
      expect(lines[0]).not.toContain("jo@acme.example");
    });

    it("has nothing to say about nothing", () => {
      const lines: string[] = [];
      for (const none of [[], null, undefined]) expect(reportReaped(none, (l) => lines.push(l))).toBe(0);
      expect(lines).toEqual([]);
    });
  });

  describe("runMaintenance", () => {
    const run = (over: Partial<Parameters<typeof runMaintenance>[0]> = {}) => {
      const logs: string[] = [];
      const deps = {
        reap: vi.fn(async () => [] as unknown),
        reconcile: vi.fn(async () => reconcileOk as unknown),
        log: (l: string) => logs.push(l),
        ...over,
      };
      return { logs, deps, result: runMaintenance(deps) };
    };

    it("reports what was reaped and healed", async () => {
      const { logs, result } = run({
        reap: async () => [{ id: "evt-1", kind: "advisor_notification", attempts: 5, last_error: "worker_lost" }],
        reconcile: async () => ({ ...reconcileOk, healed: 2 }),
      });
      expect(await result).toEqual({ reaped: 1, reconciled: { healed: 2, failed: 0, unqueued: 0 } });
      expect(logs).toHaveLength(2);
    });

    it("logs only the code when reconcile fails, and does not throw", async () => {
      const { logs, result } = run({
        reconcile: async () => { throw { code: "PGRST202", message: "Could not find the function for jo@acme.example" }; },
      });
      await expect(result).resolves.toEqual({ reaped: 0, reconciled: { healed: 0, failed: 0, unqueued: 0 } });
      expect(logs).toEqual(["OUTBOX_RECONCILE_ERROR: PGRST202"]);
    });

    it("still reconciles when reap fails, and the other way round", async () => {
      const first = run({ reap: async () => { throw { code: "57014" }; } });
      await first.result;
      expect(first.logs).toEqual(["OUTBOX_REAP_ERROR: 57014"]);
      expect(first.deps.reconcile).toHaveBeenCalled();

      const second = run({ reconcile: async () => { throw { code: "42501" }; }, reap: async () => [{ id: "e", kind: "k", attempts: 5, last_error: "worker_lost" }] });
      expect(await second.result).toMatchObject({ reaped: 1 });
      expect(second.logs).toContain("OUTBOX_RECONCILE_ERROR: 42501");
    });

    it("calls a call that was cut off a timeout", async () => {
      const { logs, result } = run({ reconcile: async () => { throw new DOMException("signal timed out", "TimeoutError"); } });
      await result;
      expect(logs).toEqual(["OUTBOX_RECONCILE_ERROR: timeout"]);
    });

    it("flags an answer it cannot read", async () => {
      const { logs, result } = run({ reconcile: async () => "ok" });
      await result;
      expect(logs).toEqual(["OUTBOX_RECONCILE_ERROR: malformed_result"]);
    });

    // That index.ts awaits this ahead of the claim and lets nothing escape is the one thing no unit
    // test can see (it is Deno-only); the verify skill's scheduled-run flows cover it.
    it("survives both calls failing at once, logging each and returning the empty answer", async () => {
      const { logs, result } = run({
        reap: async () => { throw new Error("boom"); },
        reconcile: async () => { throw new Error("boom"); },
      });
      await expect(result).resolves.toEqual({ reaped: 0, reconciled: { healed: 0, failed: 0, unqueued: 0 } });
      expect(logs).toEqual(["OUTBOX_REAP_ERROR: unknown", "OUTBOX_RECONCILE_ERROR: unknown"]);
    });
  });

  describe("rpcErrorCode", () => {
    it("is the PostgREST or SQLSTATE code, and nothing else", () => {
      expect(rpcErrorCode({ code: "PGRST202", message: "x" })).toBe("PGRST202");
      expect(rpcErrorCode({ code: "23514" })).toBe("23514");
      expect(rpcErrorCode({ code: "a code with spaces and jo@acme.example" })).toBe("unknown");
      expect(rpcErrorCode({ code: 23 })).toBe("unknown");
      expect(rpcErrorCode({ message: "no code" })).toBe("unknown");
      for (const odd of [null, undefined, "boom", 5]) expect(rpcErrorCode(odd)).toBe("unknown");
    });

    it("recognises an aborted call", () => {
      expect(rpcErrorCode(new DOMException("signal timed out", "TimeoutError"))).toBe("timeout");
      expect(rpcErrorCode(new DOMException("aborted", "AbortError"))).toBe("timeout");
      expect(rpcErrorCode({ message: "AbortError: The signal has been aborted", code: "" })).toBe("timeout");
    });
  });
});

describe("log routing", () => {
  it("sends a send to the info log, a heal to warnings, and everything else to the error log operators alert on", () => {
    expect(logLevel("OUTBOX_SENT: kind=x event=y attempt=1 msg=fresh")).toBe("log");
    expect(logLevel("OUTBOX_RECONCILED: queued notifications for 1 missed certification(s)")).toBe("warn");
    for (const line of [
      "OUTBOX_ENQUEUE_FAILED: unqueued=1 oldest_age_s=5 last_sqlstate=23514",
      "OUTBOX_RECONCILE_ERROR: PGRST202",
      "OUTBOX_REAP_ERROR: 57014",
      "OUTBOX_DEAD: kind=x event=y attempts=5 reason=worker_lost; needs an operator",
      "OUTBOX_SEND_FAILED: kind=x event=y attempt=1/5 msg=fresh reason=timeout retry_in=60s",
      "OUTBOX_RECORD_FAILED: kind=x event=y could not be recorded; it will be retried once its claim lapses",
    ]) {
      expect(logLevel(line)).toBe("error");
    }
  });
});

describe("sendableKinds", () => {
  it("lists the kinds whose configuration is complete", () => {
    expect(sendableKinds(config)).toEqual(["advisor_notification", "prospect_confirmation"]);
    expect(sendableKinds(readDispatchConfig((n) => ({ ...env, SUPPORT_EMAIL: "" })[n]))).toEqual(["advisor_notification"]);
    expect(sendableKinds(readDispatchConfig(() => undefined))).toEqual([]);
  });
});

describe("what the event records about a failed send", () => {
  const refused: SendResult = {
    ok: false, kind: "auth", httpStatus: 403, ambiguous: false,
    detail: "validation_error: The mail.example.com domain is not verified.",
  };

  it("stores the provider's cleaned explanation after the failure kind, so an advisor can see why", async () => {
    const { deps } = harness({}, refused);
    await dispatchEvents([advisorRow()], deps);
    expect(deps.fail).toHaveBeenCalledWith(
      "evt-advisor", "auth:403 (validation_error: The mail.example.com domain is not verified.)", 60, 1, true,
    );
  });

  it("stores it on the event that dies too", async () => {
    const { deps } = harness({}, refused);
    await dispatchEvents([advisorRow({ attempts: MAX_ATTEMPTS })], deps);
    expect(deps.fail).toHaveBeenCalledWith(
      "evt-advisor", "auth:403 (validation_error: The mail.example.com domain is not verified.)", null, MAX_ATTEMPTS, true,
    );
  });

  it("keeps it out of every log line: logs carry the failure kind only", async () => {
    const { deps, logs } = harness({}, refused);
    await dispatchEvents([advisorRow(), advisorRow({ id: "e2", attempts: MAX_ATTEMPTS })], deps);
    expect(logs).toHaveLength(2);
    for (const line of logs) {
      expect(line).toContain("reason=auth:403");
      expect(line).not.toMatch(/domain|verified|validation_error/);
    }
  });

  it("is just the kind when the provider said nothing usable, as before", async () => {
    const { deps } = harness({}, { ok: false, kind: "provider_error", httpStatus: 500, ambiguous: true });
    await dispatchEvents([advisorRow()], deps);
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "provider_error:500", 60, 1, false);
  });

  it("holds a lease that outlasts a whole batch of sends by a wide margin (10 minutes)", () => {
    expect(CLAIM_LEASE_SECONDS).toBe(600);
  });
});

describe("telling engineering an event died", () => {
  const dead = { event: "evt-advisor", kind: "advisor_notification", attempts: MAX_ATTEMPTS, reason: "provider_error:503" };

  it("alerts when the fifth failure is recorded, with ids and the failure kind only", async () => {
    const alertDead = vi.fn(async () => true);
    const { deps } = harness({ alertDead }, ambiguous503);
    await dispatchEvents([advisorRow({ attempts: MAX_ATTEMPTS })], deps);
    expect(alertDead).toHaveBeenCalledTimes(1);
    expect(alertDead).toHaveBeenCalledWith(dead);
    expect(JSON.stringify(alertDead.mock.calls)).not.toMatch(/@|Acme|Joanna/);
  });

  it("does not alert for a failure that will be retried", async () => {
    for (const attempts of [1, 2, 3, 4]) {
      const alertDead = vi.fn(async () => true);
      const { deps } = harness({ alertDead }, ambiguous503);
      await dispatchEvents([advisorRow({ attempts })], deps);
      expect(alertDead).not.toHaveBeenCalled();
    }
  });

  it("alerts for a payload that can never be sent, which dies at once", async () => {
    const alertDead = vi.fn(async () => true);
    const { deps } = harness({ alertDead });
    await dispatchEvents([advisorRow({ id: "e2", payload: {} })], deps);
    expect(alertDead).toHaveBeenCalledWith({ event: "e2", kind: "advisor_notification", attempts: 1, reason: "invalid_payload" });
  });

  it("does not alert when the death could not be written: the reaper will find it, and say so then", async () => {
    const alertDead = vi.fn(async () => true);
    const { deps } = harness({ alertDead, fail: vi.fn(async () => { throw new Error("db down"); }) }, ambiguous503);
    const summary = await dispatchEvents([advisorRow({ attempts: MAX_ATTEMPTS })], deps);
    expect(summary.unrecorded).toBe(1);
    expect(alertDead).not.toHaveBeenCalled();
  });

  it("does not alert for a send that succeeded", async () => {
    const alertDead = vi.fn(async () => true);
    const { deps } = harness({ alertDead });
    await dispatchEvents([advisorRow({ attempts: MAX_ATTEMPTS })], deps);
    expect(alertDead).not.toHaveBeenCalled();
  });

  it.each([
    ["is refused", async () => false],
    ["throws", async (): Promise<boolean> => { throw new Error("hooks down: https://hooks.example.com/secret-token"); }],
  ])("logs, and carries on with the batch, when the alert %s", async (_name, alertDead) => {
    const { deps, logs } = harness({ alertDead });
    deps.send = vi.fn(async (): Promise<SendResult> => ambiguous503);
    const summary = await dispatchEvents([advisorRow({ attempts: MAX_ATTEMPTS }), advisorRow({ id: "e2", attempts: MAX_ATTEMPTS })], deps);
    expect(summary.dead).toBe(2);
    expect(logs.filter((l) => l.startsWith("OUTBOX_ALERT_FAILED: event=evt-advisor"))).toHaveLength(1);
    expect(logs.filter((l) => l.startsWith("OUTBOX_ALERT_FAILED: event=e2"))).toHaveLength(1);
    expect(logs.join("\n")).not.toContain("secret-token");
  });

  it("works without any alert channel, which is the default", async () => {
    const { deps } = harness({}, ambiguous503);
    expect(deps.alertDead).toBeUndefined();
    await expect(dispatchEvents([advisorRow({ attempts: MAX_ATTEMPTS })], deps)).resolves.toMatchObject({ dead: 1 });
  });

  it("routes the alert-failed line to the error log", () => {
    expect(logLevel("OUTBOX_ALERT_FAILED: event=x died but the engineering alert was not delivered")).toBe("error");
  });

  describe("an event the reaper killed", () => {
    const killed = [
      { id: "evt-1", kind: "advisor_notification", attempts: 5, last_error: "worker_lost" },
      { id: "evt-2", kind: "prospect_confirmation", attempts: 5, last_error: "worker_lost_maybe_sent" },
    ];

    it("is described by id, kind, attempts and a fixed reason, never the stored error text", () => {
      expect(reapedDeaths(killed)).toEqual([
        { event: "evt-1", kind: "advisor_notification", attempts: 5, reason: "worker_lost" },
        { event: "evt-2", kind: "prospect_confirmation", attempts: 5, reason: "worker_lost_maybe_sent" },
      ]);
      expect(reapedDeaths([{ id: "e", kind: "k", attempts: 5, last_error: "boom for jo@acme.example" }])[0].reason).toBe("worker_lost");
      expect(reapedDeaths(null)).toEqual([]);
    });

    it("is alerted once each by the scheduled run's housekeeping", async () => {
      const alertDead = vi.fn(async () => true);
      const logs: string[] = [];
      const result = await runMaintenance({
        reap: async () => killed,
        reconcile: async () => ({ healed: 0, failed: 0, unqueued: 0 }),
        alertDead,
        log: (l) => logs.push(l),
      });
      expect(result.reaped).toBe(2);
      expect(alertDead.mock.calls.map(([e]) => e.event)).toEqual(["evt-1", "evt-2"]);
      expect(logs.filter((l) => l.startsWith("OUTBOX_DEAD:"))).toHaveLength(2);
    });

    it("never fails the run if the alert cannot be sent", async () => {
      const result = await runMaintenance({
        reap: async () => killed,
        reconcile: async () => ({ healed: 0, failed: 0, unqueued: 0 }),
        alertDead: async () => { throw new Error("hooks down"); },
        log: () => {},
      });
      expect(result.reaped).toBe(2);
    });
  });
});

describe("telling a blocked kind's events why they are waiting", () => {
  it("names the settings in the way, per kind, and nothing for a kind that is ready", () => {
    expect(blockedKinds(config, null)).toEqual([]);
    const noAdvisors = configFrom({ ...env, ADVISORY_NOTIFY_EMAIL: "" });
    expect(blockedKinds(noAdvisors, null)).toEqual([
      { kind: "advisor_notification", problem: "ADVISORY_NOTIFY_EMAIL is not set to valid address(es)" },
    ]);
    expect(blockedKinds(configFrom({ ...env, ADVISORY_NOTIFY_EMAIL: "not an address, x" }), null)[0].problem)
      .toBe("ADVISORY_NOTIFY_EMAIL is not set to valid address(es)");
  });

  it("lists every missing setting of a kind together", () => {
    const blocked = blockedKinds(configFrom({ ...env, APP_BASE_URL: "http://app.example.com", ADVISORY_NOTIFY_EMAIL: "" }), null);
    expect(blocked).toEqual([
      { kind: "advisor_notification", problem: "ADVISORY_NOTIFY_EMAIL is not set to valid address(es); APP_BASE_URL is not set to an https URL" },
    ]);
  });

  it("blocks both kinds, naming the provider problem first, when there is no usable provider", () => {
    expect(blockedKinds(config, "RESEND_API_KEY is not set")).toEqual([
      { kind: "advisor_notification", problem: "RESEND_API_KEY is not set" },
      { kind: "prospect_confirmation", problem: "RESEND_API_KEY is not set" },
    ]);
    expect(blockedKinds(configFrom({ ...env, SUPPORT_EMAIL: "" }), "RESEND_API_KEY is not set")[1].problem)
      .toBe("RESEND_API_KEY is not set; SUPPORT_EMAIL is not set to a valid address");
  });

  it("never carries a setting's value", () => {
    const problem = JSON.stringify(blockedKinds(configFrom({ ...env, EMAIL_FROM: "super-secret-looking-value" }), null));
    expect(problem).not.toContain("super-secret-looking-value");
    expect(problem).toContain("EMAIL_FROM is not set to a valid sender address");
  });

  it("writes each note, and logs only a code, never an error's text, when one cannot be written", async () => {
    const logs: string[] = [];
    const note = vi.fn(async (kind: string) => {
      if (kind === "advisor_notification") throw { code: "PGRST202", message: "function not found, row jo@acme.example" };
    });
    await noteBlockedKinds(blockedKinds(config, "RESEND_API_KEY is not set"), note, (l) => logs.push(l));
    expect(note).toHaveBeenCalledTimes(2);
    expect(note).toHaveBeenCalledWith("prospect_confirmation", "RESEND_API_KEY is not set");
    expect(logs).toEqual(["OUTBOX_NOTE_ERROR: kind=advisor_notification PGRST202"]);
  });

  it("does nothing when nothing is blocked", async () => {
    const note = vi.fn(async () => {});
    await noteBlockedKinds([], note, () => {});
    expect(note).not.toHaveBeenCalled();
  });
});
