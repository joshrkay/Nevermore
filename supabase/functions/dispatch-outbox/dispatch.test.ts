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
  runReply,
  sendableKinds,
  type DispatchDeps,
  type OutboxRow,
  type PendingSend,
} from "./dispatch";
import { createResendAdapter, sendEmail, type EmailMessage, type SendResult } from "./providers";

const env: Record<string, string> = {
  EMAIL_FROM: "Edgar Allan Advisory <intake@mail.example.com>",
  // The old platform-wide list: no longer who an alert goes to (the intake's firm's members are), so it must never show up in `to`.
  ADVISORY_NOTIFY_EMAIL: "platform-list@example.com",
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

/** The current members of the firm the intake belongs to, as the database answers for it. */
const FIRM_MEMBERS = ["advisors@example.com"];
/** The current owners of the firm a "member left" email is about, as the database answers for it. */
const FIRM_OWNERS = ["owner@firm-a.example"];
const FIRM = "99999999-8888-7777-6666-555555555555";

const PII = ["jo@acme.example", "Joanna", "Jo Doe", "Acme", "advisors@example.com", "support@example.com"];

/** A frozen send as the database stores it. */
const pendingSend = (over: Partial<PendingSend> = {}): PendingSend => ({
  key: "outbox-evt-advisor-0123456789ab",
  message: { from: "Old Sender <old@mail.example.com>", to: FIRM_MEMBERS, subject: "Old subject", text: "Old text", html: "<p>Old html</p>" },
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
    advisorRecipients: vi.fn(async () => FIRM_MEMBERS),
    ownerRecipients: vi.fn(async () => FIRM_OWNERS),
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

const peoMailRow = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "evt-peo-mail",
  kind: "peo_mail_arrived",
  session_id: SESSION,
  attempts: 1,
  pending_send: null,
  payload: { reference: "EAA-2026-AB12CD34", company_name: "Acme Co", peo_name: "TriNet" },
  ...over,
});

describe("dispatching a PEO mail notice", () => {
  it("goes to the advisor distribution list with a link to the thread behind sign-in, and nothing of the message", async () => {
    const { deps, sent } = harness();
    const summary = await dispatchEvents(
      [peoMailRow({ payload: { reference: "EAA-2026-AB12CD34", company_name: "Acme Co", peo_name: "TriNet", from_address: "dana@trinet.example", subject: "Our quote", body_text: "We can offer 4.2%" } })],
      deps,
    );
    expect(summary.sent).toBe(1);
    const { message } = sent[0];
    expect(message.to).toEqual(["advisors@example.com"]);
    expect(message.subject).toBe("New PEO mail: TriNet on Acme Co (EAA-2026-AB12CD34)");
    expect(message.text).toContain(`/advisor/submissions/${SESSION}`);
    for (const leaked of ["dana@trinet.example", "Our quote", "4.2%"]) {
      expect(message.text + message.html).not.toContain(leaked);
    }
  });

  it("is refused for good when its payload has no File ID or PEO, and waits when advisors aren't configured", async () => {
    const bad = harness();
    await dispatchEvents([peoMailRow({ payload: { peo_name: "TriNet" } })], bad.deps);
    expect(bad.sent).toHaveLength(0);
    expect(bad.deps.fail).toHaveBeenCalledWith("evt-peo-mail", "invalid_payload", null, 1, false);

    const unconfigured = harness({ config: readDispatchConfig((n) => ({ ...env, APP_BASE_URL: "" })[n]) });
    await dispatchEvents([peoMailRow()], unconfigured.deps);
    expect(unconfigured.sent).toHaveLength(0);
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
      // It names the people who are still the team: age frees the message to be rebuilt, never the recipients to change (D-35).
      const stored = pendingSend({
        frozen_at: new Date(NOW - age).toISOString(),
        message: { ...pendingSend().message, to: ["new-team@example.com", "second@example.com"] },
      });
      const { deps, sent, logs } = harness({ config: configFrom(changedEnv), advisorRecipients: vi.fn(async () => ["new-team@example.com", "second@example.com"]) });
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
  let members = FIRM_MEMBERS;
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
    /** The firm's members change (someone joins or leaves) between attempts. */
    setMembers(next: string[]) {
      members = next;
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
        advisorRecipients: async () => members,
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
    world.setMembers(["new-team@example.com"]);
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
    expect(sendableKinds(config)).toEqual(["advisor_notification", "peo_mail_arrived", "member_left", "firm_closing", "export_alert", "prospect_confirmation", "information_request", "draft_expiry_reminder"]);
    expect(sendableKinds(readDispatchConfig((n) => ({ ...env, SUPPORT_EMAIL: "" })[n]))).toEqual(["advisor_notification", "peo_mail_arrived", "member_left", "firm_closing", "export_alert"]);
    // The emails that link to the intake need the app's address; the confirmation doesn't.
    expect(sendableKinds(readDispatchConfig((n) => ({ ...env, APP_BASE_URL: "" })[n]))).toEqual(["prospect_confirmation"]);
    expect(sendableKinds(readDispatchConfig(() => undefined))).toEqual([]);
  });
});

describe("dispatching the emails that link to the intake", () => {
  const requestRow = (over: Partial<OutboxRow> = {}): OutboxRow => ({
    id: "evt-request",
    kind: "information_request",
    session_id: SESSION,
    attempts: 1,
    pending_send: null,
    payload: {
      reference: "EAA-2026-0042", company_name: "Acme Co", recipient_name: "Jo Doe", recipient_email: "jo@acme.example",
      message: "Please confirm your pay frequency.", fields: ["pay_frequency", "employees", "not_a_field"],
      requested_at: "2026-11-05T12:00:00Z", census: [{ first_name: "Zelda" }],
    },
    ...over,
  });
  const reminderRow = (over: Partial<OutboxRow> = {}): OutboxRow => ({
    id: "evt-reminder",
    kind: "draft_expiry_reminder",
    session_id: SESSION,
    attempts: 1,
    pending_send: null,
    payload: { company_name: "Acme Co", recipient_name: "Jo Doe", recipient_email: "jo@acme.example", expires_at: "2026-12-05T09:30:00Z" },
    ...over,
  });

  it("sends a request to the prospect alone, names its fields by label, links to the intake, and replies to support", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([requestRow()], deps);
    expect(sent).toHaveLength(1);
    const { message } = sent[0];
    expect(message.to).toEqual(["jo@acme.example"]);
    expect(message.replyTo).toBe("support@example.com");
    expect(message.subject).toBe("Your advisor needs a bit more info (EAA-2026-0042)");
    expect(message.text).toContain(`https://app.example.com/start?session=${SESSION}`);
    expect(message.text).toContain("- Pay frequency\n- Employee census\n");
    expect(message.text).not.toContain("not_a_field");
    expect(message.text + message.html).not.toContain("Zelda");
    expect(deps.complete).toHaveBeenCalledWith("evt-request", "msg_1");
  });

  it("sends the reminder to the prospect alone, with the day the draft closes and the link", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([reminderRow()], deps);
    expect(sent).toHaveLength(1);
    expect(sent[0].message.to).toEqual(["jo@acme.example"]);
    expect(sent[0].message.subject).toBe("Heads up: your intake for Acme Co closes on 5 December 2026");
    expect(sent[0].message.text).toContain(`https://app.example.com/start?session=${SESSION}`);
  });

  it("gives up on a payload that can never be sent", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([requestRow({ payload: { reference: "EAA-2026-0042", recipient_email: "jo@acme.example", message: "   " } })], deps);
    await dispatchEvents([reminderRow({ id: "evt-r2", payload: { recipient_email: "jo@acme.example", expires_at: "soon" } })], deps);
    expect(sent).toHaveLength(0);
    expect(deps.freeze).not.toHaveBeenCalled();
    expect(deps.fail).toHaveBeenCalledWith("evt-request", "invalid_payload", null, 1, false);
    expect(deps.fail).toHaveBeenCalledWith("evt-r2", "invalid_payload", null, 1, false);
  });

  it("holds them back, sending nothing, without the app's address to link to", async () => {
    const { deps, sent } = harness({ config: configFrom({ ...env, APP_BASE_URL: "" }) });
    await dispatchEvents([requestRow(), reminderRow()], deps);
    expect(sent).toHaveLength(0);
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
    const noSender = configFrom({ ...env, EMAIL_FROM: "" });
    expect(blockedKinds(noSender, null).map((b) => [b.kind, b.problem])).toEqual([
      ["advisor_notification", "EMAIL_FROM is not set to a valid sender address"],
      ["peo_mail_arrived", "EMAIL_FROM is not set to a valid sender address"],
      ["member_left", "EMAIL_FROM is not set to a valid sender address"],
      ["firm_closing", "EMAIL_FROM is not set to a valid sender address"],
      ["export_alert", "EMAIL_FROM is not set to a valid sender address"],
      ["prospect_confirmation", "EMAIL_FROM is not set to a valid sender address"],
      ["information_request", "EMAIL_FROM is not set to a valid sender address"],
      ["draft_expiry_reminder", "EMAIL_FROM is not set to a valid sender address"],
    ]);
    // Who an advisor alert goes to is the intake's firm's members, so the platform list is not a setting it waits for.
    expect(blockedKinds(configFrom({ ...env, ADVISORY_NOTIFY_EMAIL: "" }), null)).toEqual([]);
  });

  it("lists every missing setting of a kind together", () => {
    const blocked = blockedKinds(configFrom({ ...env, APP_BASE_URL: "http://app.example.com", SUPPORT_EMAIL: "" }), null);
    expect(blocked).toEqual([
      { kind: "advisor_notification", problem: "APP_BASE_URL is not set to an https URL" },
      { kind: "peo_mail_arrived", problem: "APP_BASE_URL is not set to an https URL" },
      { kind: "member_left", problem: "APP_BASE_URL is not set to an https URL" },
      { kind: "firm_closing", problem: "APP_BASE_URL is not set to an https URL" },
      { kind: "export_alert", problem: "APP_BASE_URL is not set to an https URL" },
      { kind: "prospect_confirmation", problem: "SUPPORT_EMAIL is not set to a valid address" },
      { kind: "information_request", problem: "SUPPORT_EMAIL is not set to a valid address; APP_BASE_URL is not set to an https URL" },
      { kind: "draft_expiry_reminder", problem: "SUPPORT_EMAIL is not set to a valid address; APP_BASE_URL is not set to an https URL" },
    ]);
  });

  it("blocks every kind, naming the provider problem first, when there is no usable provider", () => {
    expect(blockedKinds(config, "RESEND_API_KEY is not set")).toEqual([
      { kind: "advisor_notification", problem: "RESEND_API_KEY is not set" },
      { kind: "peo_mail_arrived", problem: "RESEND_API_KEY is not set" },
      { kind: "member_left", problem: "RESEND_API_KEY is not set" },
      { kind: "firm_closing", problem: "RESEND_API_KEY is not set" },
      { kind: "export_alert", problem: "RESEND_API_KEY is not set" },
      { kind: "prospect_confirmation", problem: "RESEND_API_KEY is not set" },
      { kind: "information_request", problem: "RESEND_API_KEY is not set" },
      { kind: "draft_expiry_reminder", problem: "RESEND_API_KEY is not set" },
    ]);
    expect(blockedKinds(configFrom({ ...env, SUPPORT_EMAIL: "" }), "RESEND_API_KEY is not set")[5].problem)
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
    expect(note).toHaveBeenCalledTimes(8);
    expect(note).toHaveBeenCalledWith("prospect_confirmation", "RESEND_API_KEY is not set");
    expect(note).toHaveBeenCalledWith("information_request", "RESEND_API_KEY is not set");
    expect(logs).toEqual(["OUTBOX_NOTE_ERROR: kind=advisor_notification PGRST202"]);
  });

  it("does nothing when nothing is blocked", async () => {
    const note = vi.fn(async () => {});
    await noteBlockedKinds([], note, () => {});
    expect(note).not.toHaveBeenCalled();
  });
});

describe("what a run answers", () => {
  const counts = { claimed: 3, sent: 1, retrying: 1, dead: 1, unrecorded: 0, skipped: 0 };

  it("tells the schedule (the service role) what it did", () => {
    expect(runReply(true, counts)).toEqual(counts);
  });

  it("tells a browser caller only that the run happened: queue health is the advisory team's to read", () => {
    expect(runReply(false, counts)).toEqual({ ok: true });
  });
});

// Who an advisor alert and a new-PEO-mail notice go to: the current members of the firm the intake belongs to, as the database
// answers for the event's intake (CRM-P2.1c). Never the platform's list, never another firm's people.
describe("who an advisor alert goes to", () => {
  const kinds: [string, () => OutboxRow][] = [["advisor alert", advisorRow], ["new PEO mail notice", peoMailRow]];

  it.each(kinds)("sends the %s to the intake's firm's current members, asking for them by the event's intake", async (_name, makeRow) => {
    const advisorRecipients = vi.fn(async () => ["owner@firm-a.example", "agent@firm-a.example"]);
    const { deps, sent } = harness({ advisorRecipients });
    await dispatchEvents([makeRow()], deps);
    expect(advisorRecipients).toHaveBeenCalledWith(SESSION);
    expect(sent).toHaveLength(1);
    expect(sent[0].message.to).toEqual(["owner@firm-a.example", "agent@firm-a.example"]);
    expect(vi.mocked(deps.freeze).mock.calls[0][2].to).toEqual(["owner@firm-a.example", "agent@firm-a.example"]);
  });

  it.each(kinds)("never sends the %s to the platform-wide list, whatever it holds", async (_name, makeRow) => {
    const { deps, sent } = harness({ config: configFrom({ ...env, ADVISORY_NOTIFY_EMAIL: "everyone@platform.example, ops@platform.example" }) });
    await dispatchEvents([makeRow()], deps);
    expect(sent[0].message.to).toEqual(FIRM_MEMBERS);
    expect(JSON.stringify(sent[0])).not.toContain("platform.example");
  });

  it.each(kinds)("tells two firms' alerts apart: each intake's own members and no one else", async (_name, makeRow) => {
    const byIntake: Record<string, string[]> = { "intake-a": ["a1@firm-a.example"], "intake-b": ["b1@firm-b.example", "b2@firm-b.example"] };
    const { deps, sent } = harness({ advisorRecipients: vi.fn(async (id: string) => byIntake[id] ?? []) });
    await dispatchEvents([makeRow({ id: "e-a", session_id: "intake-a" }), makeRow({ id: "e-b", session_id: "intake-b" })], deps);
    expect(sent.map((s) => s.message.to)).toEqual([["a1@firm-a.example"], ["b1@firm-b.example", "b2@firm-b.example"]]);
  });

  it.each(kinds)("holds back the %s, sending nothing, when the firm has nobody to tell, and tries again", async (_name, makeRow) => {
    const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => []) });
    const summary = await dispatchEvents([makeRow()], deps);
    expect(sent).toHaveLength(0);
    expect(deps.freeze).not.toHaveBeenCalled();
    expect(summary.retrying).toBe(1);
    expect(deps.fail).toHaveBeenCalledWith(makeRow().id, "no_recipients", 60, 1, false);
  });

  it.each(kinds)("holds back the %s, sending nothing, when the recipients cannot be looked up", async (_name, makeRow) => {
    const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => { throw new Error("db down"); }) });
    const summary = await dispatchEvents([makeRow()], deps);
    expect(sent).toHaveLength(0);
    expect(deps.freeze).not.toHaveBeenCalled();
    expect(summary.retrying).toBe(1);
    expect(deps.fail).toHaveBeenCalledWith(makeRow().id, "recipients_failed", 60, 1, false);
  });

  it("does not ask for recipients to send a prospect's email", async () => {
    const { deps } = harness();
    await dispatchEvents([prospectRow()], deps);
    expect(deps.advisorRecipients).not.toHaveBeenCalled();
  });

  describe("a member who has left", () => {
    const frozen = (to: string[]) => pendingSend({ message: { ...pendingSend().message, to } });

    it.each(kinds)("stops receiving at once: a frozen %s that names them is rebuilt for the current members, under a new key", async (_name, makeRow) => {
      const stored = frozen(["stayer@firm-a.example", "gone@firm-a.example"]);
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["stayer@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      const [, , message, replace] = vi.mocked(deps.freeze).mock.calls[0];
      expect(replace).toBe(true);
      expect(message.to).toEqual(["stayer@firm-a.example"]);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
      expect(sent[0].key).not.toBe(stored.key);
    });

    // D-35: who is told is fixed when the alert is first prepared. A retry only drops the people who have left; it never adds the
    // people who joined since, whose address would change the message's key for everyone who already has it.
    it.each(kinds)("rebuilds a frozen %s for the people it named who are still members, and does not add anyone who joined since", async (_name, makeRow) => {
      const stored = frozen(["stayer@firm-a.example", "gone@firm-a.example"]);
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["stayer@firm-a.example", "joined@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      const [, , message] = vi.mocked(deps.freeze).mock.calls[0];
      expect(message.to).toEqual(["stayer@firm-a.example"]);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
    });

    it.each(kinds)("rebuilds a frozen %s for the current members, with a new key, when everyone it named has left (D-102)", async (_name, makeRow) => {
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["joined@firm-a.example"]) });
      const stored = frozen(["gone@firm-a.example"]);
      await dispatchEvents([makeRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["joined@firm-a.example"]);
      expect(sent[0].key).not.toBe(stored.key);
      expect(deps.fail).not.toHaveBeenCalled();
    });

    // D-35 and D-102: the first-preparation recipients are stored on the row itself, apart from the disposable frozen message, so a
    // freeze that has aged out or was cleared by a definitive failure does not let a retry reach someone who joined after preparation.
    it.each(kinds)("sends a %s whose freeze is gone only to the stored first recipients who are still members", async (_name, makeRow) => {
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["stayer@firm-a.example", "joined@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 2, pending_send: null, first_recipients: ["stayer@firm-a.example", "gone@firm-a.example"] })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
    });

    it.each(kinds)("does the same when the %s's freeze is older than the key window", async (_name, makeRow) => {
      const old = pendingSend({ frozen_at: new Date(NOW - 21 * 60 * 60 * 1000).toISOString(), message: { ...pendingSend().message, to: ["stayer@firm-a.example"] } });
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["stayer@firm-a.example", "joined@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 3, pending_send: jsonb(old), first_recipients: ["stayer@firm-a.example"] })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
    });

    it.each(kinds)("prefers the stored first recipients over the people a later freeze named, for a %s", async (_name, makeRow) => {
      const later = pendingSend({ message: { ...pendingSend().message, to: ["gone@firm-a.example"] } });
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["stayer@firm-a.example", "joined@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 3, pending_send: jsonb(later), first_recipients: ["stayer@firm-a.example", "gone@firm-a.example"] })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
    });

    it.each(kinds)("sends a %s whose old freeze is all it has (no stored first recipients) only to those the freeze named who are still members", async (_name, makeRow) => {
      const old = pendingSend({ frozen_at: new Date(NOW - 21 * 60 * 60 * 1000).toISOString(), message: { ...pendingSend().message, to: ["stayer@firm-a.example"] } });
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["stayer@firm-a.example", "joined@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 3, pending_send: jsonb(old), first_recipients: null })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
    });

    it.each(kinds)("treats an empty stored first-recipient list as none, and falls back to the people the %s's freeze named", async (_name, makeRow) => {
      const old = pendingSend({ frozen_at: new Date(NOW - 21 * 60 * 60 * 1000).toISOString(), message: { ...pendingSend().message, to: ["stayer@firm-a.example"] } });
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["stayer@firm-a.example", "joined@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 2, pending_send: jsonb(old), first_recipients: [] })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
    });

    it.each(kinds)("treats stored first recipients that are not a list of addresses as none, and sends the %s to the current members", async (_name, makeRow) => {
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["joined@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 2, pending_send: null, first_recipients: [1, null] })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["joined@firm-a.example"]);
    });

    it.each(kinds)("sends a %s with no freeze and no one left of its first recipients to the current members (D-102)", async (_name, makeRow) => {
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["joined@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 2, pending_send: null, first_recipients: ["gone@firm-a.example"] })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["joined@firm-a.example"]);
    });

    it.each(kinds)("sends nothing from a frozen %s when no one is left to tell", async (_name, makeRow) => {
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => []) });
      await dispatchEvents([makeRow({ attempts: 2, pending_send: jsonb(frozen(["gone@firm-a.example"])) })], deps);
      expect(sent).toHaveLength(0);
      expect(deps.fail).toHaveBeenCalledWith(makeRow().id, "no_recipients", 300, 2, false);
    });

    it("sends a frozen alert whose every named person has left to the current members, since none of them can have had it, once, under a new key (D-102, which amends D-35)", async () => {
      const stored = frozen(["gone@firm-a.example"]);
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["joined@firm-a.example"]) });
      await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["joined@firm-a.example"]);
      expect(sent[0].key).not.toBe(stored.key);
      expect(deps.freeze).toHaveBeenCalledTimes(1);
    });

    it("rebuilds an alert frozen to the shared inbox, as it was before alerts went to members, for the current members", async () => {
      const stored = frozen(["advisory@shared-inbox.example"]);
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["a@firm-a.example", "b@firm-a.example"]) });
      await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["a@firm-a.example", "b@firm-a.example"]);
      expect(deps.fail).not.toHaveBeenCalled();
    });

    it("sends nothing from a frozen message when the current members cannot be looked up", async () => {
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => { throw new Error("db down"); }) });
      await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(frozen(["gone@firm-a.example"])) })], deps);
      expect(sent).toHaveLength(0);
      expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "recipients_failed", 300, 2, false);
    });

    it("matches addresses without regard to case, in either direction", async () => {
      const stored = frozen(["Stayer@Firm-A.example"]);
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["stayer@firm-a.example"]) });
      await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      expect(sent).toEqual([{ message: stored.message, key: stored.key }]);
    });

    it("recognises a stayer whose address differs only in case when it rebuilds for someone who left", async () => {
      const stored = frozen(["stayer@firm-a.example", "gone@firm-a.example"]);
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["Stayer@Firm-A.example", "joined@firm-a.example"]) });
      await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["Stayer@Firm-A.example"]);
    });

    it.each(kinds)("a frozen %s rebuilt because someone left, while a stayer remains, goes to the stayers only: a joiner never gets it (D-35)", async (_name, makeRow) => {
      const stored = frozen(["stayer@firm-a.example", "gone@firm-a.example"]);
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["stayer@firm-a.example", "joined@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
    });

    it.each(kinds)("a %s frozen more than 20 hours ago is rebuilt for the people it named who are still members, not for a member who joined since or one who left (D-35)", async (_name, makeRow) => {
      const stored = frozen(["stayer@firm-a.example", "gone@firm-a.example"]);
      stored.frozen_at = new Date(NOW - 21 * HOUR).toISOString();
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["stayer@firm-a.example", "joined@firm-a.example"]) });
      await dispatchEvents([makeRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      const [, , message, replace] = vi.mocked(deps.freeze).mock.calls[0];
      expect(replace).toBe(true);
      expect(message.to).toEqual(["stayer@firm-a.example"]);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
      expect(sent[0].key).not.toBe(stored.key);
    });

    it("sends an aged alert whose every named person has left to the current members (D-102)", async () => {
      const stored = frozen(["gone@firm-a.example"]);
      stored.frozen_at = new Date(NOW - 168 * HOUR).toISOString();
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["joined@firm-a.example"]) });
      await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.to).toEqual(["joined@firm-a.example"]);
      expect(deps.fail).not.toHaveBeenCalled();
    });

    // D-35: recipients are fixed when the alert is first prepared. A later joiner is deliberately NOT added to a frozen alert: rebuilding
    // changes the send key, so the people who already received it would get it twice. They receive every alert prepared after they joined.
    it("still reuses a frozen message, as stored with its key, while everyone it names is a current member, even if others have joined since (D-35)", async () => {
      const stored = frozen(["stayer@firm-a.example"]);
      const { deps, sent } = harness({ advisorRecipients: vi.fn(async () => ["Stayer@firm-a.example", "joined@firm-a.example"]) });
      await dispatchEvents([advisorRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
      expect(sent).toEqual([{ message: stored.message, key: stored.key }]);
      expect(deps.freeze).not.toHaveBeenCalled();
    });
  });
});

// The email to a firm's owners when a member leaves (story CRM-P1.6). It belongs to the firm, not to an intake, and goes through the
// same dispatcher as the firm's other alerts: the same sender, the same retry, and the same rule about who is told on a retry (D-35).
const memberLeftRow = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "evt-left",
  kind: "member_left",
  session_id: null,
  firm_id: FIRM,
  attempts: 1,
  pending_send: null,
  payload: { member_email: "sam@firm-a.example", left_at: "2026-11-18T14:05:09Z", firm_name: "Acme Brokers" },
  ...over,
});

describe("dispatching the email that a member left", () => {
  // Catches: the owners are asked for by the wrong thing (the intake's members, or nobody, since the event has no intake), or a
  // platform-wide list is used.
  it("goes to the firm's owners, asked for by the event's firm, and never to the intake members' list", async () => {
    const ownerRecipients = vi.fn(async () => ["owner@firm-a.example", "owner2@firm-a.example"]);
    const { deps, sent } = harness({ ownerRecipients });
    const summary = await dispatchEvents([memberLeftRow()], deps);
    expect(summary.sent).toBe(1);
    expect(ownerRecipients).toHaveBeenCalledWith(FIRM);
    expect(deps.advisorRecipients).not.toHaveBeenCalled();
    expect(sent[0].message.to).toEqual(["owner@firm-a.example", "owner2@firm-a.example"]);
    expect(JSON.stringify(sent[0])).not.toContain("platform-list@example.com");
  });

  // Catches: the email names someone else, omits when they left, says more than who and when (a role, a reason, a link into the
  // firm's records), or lets a name carry markup into the HTML.
  it("names who left and when, and nothing else", async () => {
    const { deps, sent } = harness();
    await dispatchEvents(
      [memberLeftRow({ payload: { member_email: "sam@firm-a.example", left_at: "2026-11-18T14:05:09Z", firm_name: "Acme Brokers", role: "owner", reason: "new job", leads: ["Zelda Co"] } })],
      deps,
    );
    const { message } = sent[0];
    expect(message.subject).toBe("sam@firm-a.example left Acme Brokers");
    expect(message.text).toContain("sam@firm-a.example left Acme Brokers on 2026-11-18 14:05 UTC.");
    expect(message.html).toContain("sam@firm-a.example left Acme Brokers on 2026-11-18 14:05 UTC.");
    for (const leaked of ["owner", "new job", "Zelda", "http"]) {
      expect(message.text).not.toContain(leaked);
      expect(message.html).not.toContain(leaked.startsWith("http") ? "href=" : leaked);
    }
  });

  it("escapes a firm's name in the HTML", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([memberLeftRow({ payload: { member_email: "sam@firm-a.example", left_at: "2026-11-18T14:05:09Z", firm_name: "<b>Evil</b> & Co" } })], deps);
    expect(sent[0].message.html).toContain("&lt;b&gt;Evil&lt;/b&gt; &amp; Co");
    expect(sent[0].message.html).not.toContain("<b>Evil</b>");
  });

  // Catches: a payload without who or when is sent as an empty email, or retried for ever.
  it.each([
    ["no member", { left_at: "2026-11-18T14:05:09Z", firm_name: "Acme Brokers" }],
    ["no time", { member_email: "sam@firm-a.example", firm_name: "Acme Brokers" }],
    ["no firm", { member_email: "sam@firm-a.example", left_at: "2026-11-18T14:05:09Z" }],
    ["a time that is not one", { member_email: "sam@firm-a.example", left_at: "yesterday", firm_name: "Acme Brokers" }],
  ])("gives up on a payload with %s, sending nothing", async (_why, payload) => {
    const { deps, sent } = harness();
    const summary = await dispatchEvents([memberLeftRow({ payload })], deps);
    expect(sent).toHaveLength(0);
    expect(summary.dead).toBe(1);
    expect(deps.fail).toHaveBeenCalledWith("evt-left", "invalid_payload", null, 1, false);
  });

  // Catches: an event with no firm is looked up by a null id and told to nobody, or sent to the wrong people.
  it("gives up on an event that names no firm", async () => {
    const { deps, sent } = harness();
    const summary = await dispatchEvents([memberLeftRow({ firm_id: null })], deps);
    expect(sent).toHaveLength(0);
    expect(summary.dead).toBe(1);
    expect(deps.ownerRecipients).not.toHaveBeenCalled();
  });

  // Catches: an email with nobody to send to is sent anyway, or is dropped for good when the owners can't be looked up.
  it("holds back, sending nothing, when the firm has no owner to tell or the owners can't be looked up, and tries again", async () => {
    const none = harness({ ownerRecipients: vi.fn(async () => []) });
    const a = await dispatchEvents([memberLeftRow()], none.deps);
    expect(none.sent).toHaveLength(0);
    expect(a.retrying).toBe(1);
    expect(none.deps.fail).toHaveBeenCalledWith("evt-left", "no_recipients", 60, 1, false);
    const down = harness({ ownerRecipients: vi.fn(async () => { throw new Error("db down"); }) });
    const b = await dispatchEvents([memberLeftRow()], down.deps);
    expect(down.sent).toHaveLength(0);
    expect(b.retrying).toBe(1);
    expect(down.deps.fail).toHaveBeenCalledWith("evt-left", "recipients_failed", 60, 1, false);
  });

  // D-35: an owner who has since left the firm, or stopped being an owner, is not sent the email on a retry; one who became an owner
  // since the first preparation is not added (that would change the key for everyone who already has it).
  it("on a retry drops an owner who is no longer one, and adds nobody who became one since", async () => {
    const stored = pendingSend({ message: { ...pendingSend().message, to: ["stayer@firm-a.example", "gone@firm-a.example"] } });
    const { deps, sent } = harness({ ownerRecipients: vi.fn(async () => ["stayer@firm-a.example", "new-owner@firm-a.example"]) });
    await dispatchEvents([memberLeftRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
    expect(sent).toHaveLength(1);
    expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
    expect(sent[0].key).not.toBe(stored.key);
  });

  it("resends a stored message as it is while every owner it names is still an owner", async () => {
    const stored = pendingSend({ message: { ...pendingSend().message, to: ["owner@firm-a.example"] } });
    const { deps, sent } = harness();
    await dispatchEvents([memberLeftRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
    expect(deps.freeze).not.toHaveBeenCalled();
    expect(sent[0].key).toBe(stored.key);
  });

  // Catches: the kind is not sendable (it would wait for ever) or is sent when the sender isn't set up.
  it("is sent whenever the advisor sender is set up, and waits with the reason when it is not", async () => {
    expect(sendableKinds(config)).toContain("member_left");
    const { deps, sent } = harness({ config: configFrom({ ...env, EMAIL_FROM: "" }) });
    await dispatchEvents([memberLeftRow()], deps);
    expect(sent).toHaveLength(0);
    expect(deps.fail).toHaveBeenCalledWith("evt-left", "not_configured", 60, 1, false);
  });
});

// The email to a firm's owners when an owner asks to close the firm, or withdraws the request (story CRM-P1.7). A firm's own email, like
// the leaving notice: it goes to the firm's owners, asked for by the event's firm, with the same sender and retry rules.
const closingRow = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "evt-closing",
  kind: "firm_closing",
  session_id: null,
  firm_id: FIRM,
  attempts: 1,
  pending_send: null,
  payload: { event: "asked", by_email: "sam@firm-a.example", firm_name: "Acme Brokers", closes_at: "2026-12-18T14:05:09Z" },
  ...over,
});

describe("dispatching the email that a request to close the firm was made or withdrawn", () => {
  // Catches: the owners are not the ones told (the intake members' list, or nobody), or the date or the way back is left out.
  it("tells the firm's owners who asked, which firm and when it closes", async () => {
    const ownerRecipients = vi.fn(async () => ["owner@firm-a.example", "owner2@firm-a.example"]);
    const { deps, sent } = harness({ ownerRecipients });
    await dispatchEvents([closingRow()], deps);
    expect(ownerRecipients).toHaveBeenCalledWith(FIRM);
    expect(deps.advisorRecipients).not.toHaveBeenCalled();
    expect(sent[0].message.to).toEqual(["owner@firm-a.example", "owner2@firm-a.example"]);
    expect(sent[0].message.subject).toBe("sam@firm-a.example asked to close Acme Brokers");
    expect(sent[0].message.text).toContain("It closes on 2026-12-18 unless an owner withdraws the request first.");
    expect(sent[0].message.text).toContain("withdraw the request in Settings");
  });

  // Catches: a withdrawal reads like a request, or still names a closing date.
  it("says a withdrawal leaves the firm open and nothing deleted", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([closingRow({ payload: { event: "withdrawn", by_email: "sam@firm-a.example", firm_name: "Acme Brokers" } })], deps);
    expect(sent[0].message.subject).toBe("sam@firm-a.example withdrew the request to close Acme Brokers");
    expect(sent[0].message.text).toContain("The firm stays open and nothing was deleted.");
    expect(sent[0].message.text).not.toContain("closes on");
  });

  it("escapes a firm's name in the HTML and carries nothing else the payload held", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([closingRow({ payload: { event: "asked", by_email: "sam@firm-a.example", firm_name: "<b>Evil</b> & Co", closes_at: "2026-12-18T14:05:09Z", reason: "secret reason" } })], deps);
    expect(sent[0].message.html).toContain("&lt;b&gt;Evil&lt;/b&gt; &amp; Co");
    expect(sent[0].message.html).not.toContain("<b>Evil</b>");
    expect(sent[0].message.text).not.toContain("secret reason");
  });

  // Catches: an event that cannot say who, what or when is sent as an empty email, or retried for ever.
  it.each([
    ["no event", { by_email: "sam@firm-a.example", firm_name: "Acme Brokers", closes_at: "2026-12-18T14:05:09Z" }],
    ["no person", { event: "asked", firm_name: "Acme Brokers", closes_at: "2026-12-18T14:05:09Z" }],
    ["a request with no date", { event: "asked", by_email: "sam@firm-a.example", firm_name: "Acme Brokers" }],
    ["a date that is not one", { event: "asked", by_email: "sam@firm-a.example", firm_name: "Acme Brokers", closes_at: "soon" }],
  ])("gives up on a payload with %s, sending nothing", async (_why, payload) => {
    const { deps, sent } = harness();
    const summary = await dispatchEvents([closingRow({ payload })], deps);
    expect(sent).toHaveLength(0);
    expect(summary.dead).toBe(1);
    expect(deps.fail).toHaveBeenCalledWith("evt-closing", "invalid_payload", null, 1, false);
  });

  // D-35 for this kind: an owner who is no longer one is not sent it on a retry.
  it("on a retry drops an owner who is no longer one", async () => {
    const stored = pendingSend({ message: { ...pendingSend().message, to: ["stayer@firm-a.example", "gone@firm-a.example"] } });
    const { deps, sent } = harness({ ownerRecipients: vi.fn(async () => ["stayer@firm-a.example"]) });
    await dispatchEvents([closingRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
    expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
  });

  it("is sent whenever the advisor sender is set up, and waits with the reason when it is not", async () => {
    expect(sendableKinds(config)).toContain("firm_closing");
    const { deps, sent } = harness({ config: configFrom({ ...env, EMAIL_FROM: "" }) });
    await dispatchEvents([closingRow()], deps);
    expect(sent).toHaveLength(0);
    expect(deps.fail).toHaveBeenCalledWith("evt-closing", "not_configured", 60, 1, false);
  });
});

describe("dispatching the email that Nevermore stopped a closing", () => {
  // Catches: the firm learns who at Nevermore stopped it or why (D-33), or the email reads like an owner's withdrawal.
  it("says Nevermore stopped it and names no person, whatever the payload held", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([closingRow({ payload: { event: "stopped", firm_name: "Acme Brokers", by_email: "staff@nevermore.example", reason: "under investigation" } })], deps);
    const { message } = sent[0];
    expect(message.subject).toBe("Nevermore stopped the request to close Acme Brokers");
    expect(message.text).toContain("The firm stays open and nothing was deleted.");
    for (const leaked of ["staff@nevermore.example", "investigation"]) {
      expect(message.text).not.toContain(leaked);
      expect(message.html).not.toContain(leaked);
    }
  });

  it("gives up on a stop that names no firm", async () => {
    const { deps, sent } = harness();
    const summary = await dispatchEvents([closingRow({ payload: { event: "stopped" } })], deps);
    expect(sent).toHaveLength(0);
    expect(summary.dead).toBe(1);
  });
});

// The email to a firm's owners that a member made a large export or their third within an hour (story CRM-S3.8b, D-206). A firm's own
// email, like the leaving and closing notices: it goes to the firm's owners, asked for by the event's firm, with the same rules.
const exportPayload = {
  member_email: "alex@firm-a.example", firm_name: "Acme Brokers", table: "referral_partners", row_count: 1250,
  exported_at: "2026-11-14T09:30:00Z", large: true, exports_in_hour: 1,
};
const exportRow = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "evt-export",
  kind: "export_alert",
  session_id: null,
  firm_id: FIRM,
  attempts: 1,
  pending_send: null,
  payload: exportPayload,
  ...over,
});

describe("dispatching the email that a member made a large or repeated export", () => {
  // Catches: the owners are not the ones told (the intake members' list, or nobody), or who, what, how many or when is left out.
  it("tells the firm's owners who exported how many rows of which table, and when", async () => {
    const ownerRecipients = vi.fn(async () => ["owner@firm-a.example", "owner2@firm-a.example"]);
    const { deps, sent } = harness({ ownerRecipients });
    await dispatchEvents([exportRow()], deps);
    expect(ownerRecipients).toHaveBeenCalledWith(FIRM);
    expect(deps.advisorRecipients).not.toHaveBeenCalled();
    expect(sent[0].message.to).toEqual(["owner@firm-a.example", "owner2@firm-a.example"]);
    expect(sent[0].message.subject).toBe("alex@firm-a.example exported 1,250 rows of referral partners from Acme Brokers");
    expect(sent[0].message.text).toContain("on 2026-11-14 09:30 UTC.");
    expect(sent[0].message.text).toContain("It holds more than 500 rows.");
    expect(sent[0].message.text).not.toContain("within an hour");
  });

  // Catches: a repeated export reads like a large one, or the firm's record is named wrongly.
  it("says when it is the member's third export within an hour", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([exportRow({ payload: { ...exportPayload, table: "firm_activity", row_count: 1, large: false, exports_in_hour: 3 } })], deps);
    expect(sent[0].message.subject).toBe("alex@firm-a.example exported 1 row of the firm's record of who did what from Acme Brokers");
    expect(sent[0].message.text).toContain("It is their third export within an hour.");
    expect(sent[0].message.text).not.toContain("more than 500");
  });

  // Catches: the email picks up rows or columns that a payload should never hold, or the firm's name reaches the HTML unescaped.
  it("escapes a firm's name in the HTML and carries nothing else the payload held", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([exportRow({ payload: { ...exportPayload, firm_name: "<b>Evil</b> & Co", rows: [["Acme CFO"]], columns: ["name"] } })], deps);
    expect(sent[0].message.html).toContain("&lt;b&gt;Evil&lt;/b&gt; &amp; Co");
    expect(sent[0].message.html).not.toContain("<b>Evil</b>");
    expect(sent[0].message.text).not.toContain("Acme CFO");
    expect(sent[0].message.html).not.toContain("Acme CFO");
  });

  // Catches: an event that cannot say who, what, how many or when is sent as an empty email, or retried for ever; a table the product
  // does not export (the queue) is named in an email.
  it.each([
    ["no person", { member_email: null }],
    ["no firm", { firm_name: "" }],
    ["a table that is not exported", { table: "submissions" }],
    ["no count", { row_count: "many" }],
    ["a date that is not one", { exported_at: "today" }],
    ["no reason", { large: undefined }],
    ["no count of the hour", { exports_in_hour: 0 }],
  ])("gives up on a payload with %s, sending nothing", async (_why, change) => {
    const { deps, sent } = harness();
    const summary = await dispatchEvents([exportRow({ payload: { ...exportPayload, ...change } })], deps);
    expect(sent).toHaveLength(0);
    expect(summary.dead).toBe(1);
    expect(deps.fail).toHaveBeenCalledWith("evt-export", "invalid_payload", null, 1, false);
  });

  // D-35 for this kind: an owner who is no longer one is not sent it on a retry.
  it("on a retry drops an owner who is no longer one", async () => {
    const stored = pendingSend({ message: { ...pendingSend().message, to: ["stayer@firm-a.example", "gone@firm-a.example"] } });
    const { deps, sent } = harness({ ownerRecipients: vi.fn(async () => ["stayer@firm-a.example"]) });
    await dispatchEvents([exportRow({ attempts: 2, pending_send: jsonb(stored) })], deps);
    expect(sent[0].message.to).toEqual(["stayer@firm-a.example"]);
  });

  // Catches: the kind is not sendable (it would wait for ever) or is sent when the sender isn't set up.
  it("is sent whenever the advisor sender is set up, and waits with the reason when it is not", async () => {
    expect(sendableKinds(config)).toContain("export_alert");
    const { deps, sent } = harness({ config: configFrom({ ...env, EMAIL_FROM: "" }) });
    await dispatchEvents([exportRow()], deps);
    expect(sent).toHaveLength(0);
    expect(deps.fail).toHaveBeenCalledWith("evt-export", "not_configured", 60, 1, false);
  });
});
