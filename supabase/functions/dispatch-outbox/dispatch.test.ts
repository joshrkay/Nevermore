import { describe, expect, it, vi } from "vitest";
import { readDispatchConfig } from "./config";
import {
  dispatchEvents,
  idempotencyKey,
  MAX_ATTEMPTS,
  retryDelaySeconds,
  sendableKinds,
  type DispatchDeps,
  type OutboxRow,
} from "./dispatch";
import type { EmailMessage, SendResult } from "./providers";

const env: Record<string, string> = {
  EMAIL_FROM: "Edgar Allan Advisory <intake@mail.example.com>",
  ADVISORY_NOTIFY_EMAIL: "advisors@example.com",
  APP_BASE_URL: "https://app.example.com",
  SUPPORT_EMAIL: "support@example.com",
  PROSPECT_RESPONSE_TIME: "2 business days",
};
const config = readDispatchConfig((n) => env[n]);

const SESSION = "11111111-2222-3333-4444-555555555555";
const advisorRow = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "evt-advisor",
  kind: "advisor_notification",
  session_id: SESSION,
  attempts: 1,
  payload: { reference: "EAA-2026-AB12CD34", company_name: "Acme Co", contact_name: "Joanna Doe", contact_email: "jo@acme.example", resubmission: false },
  ...over,
});
const prospectRow = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "evt-prospect",
  kind: "prospect_confirmation",
  session_id: SESSION,
  attempts: 1,
  payload: { reference: "EAA-2026-AB12CD34", company_name: "Acme Co", recipient_name: "Jo Doe", recipient_email: "jo@acme.example" },
  ...over,
});

function harness(over: Partial<DispatchDeps> = {}, sendResult: SendResult = { ok: true, messageId: "msg_1" }) {
  const sent: { message: EmailMessage; key: string }[] = [];
  const logs: string[] = [];
  const deps: DispatchDeps = {
    config,
    send: vi.fn(async (message, key) => {
      sent.push({ message, key });
      return sendResult;
    }),
    complete: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
    log: (line) => logs.push(line),
    ...over,
  };
  return { deps, sent, logs };
}

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

    expect(summary).toEqual({ sent: 1, retrying: 0, dead: 0, unrecorded: 0 });
    expect(sent).toHaveLength(1);
    const { message } = sent[0];
    expect(message.from).toBe("Edgar Allan Advisory <intake@mail.example.com>");
    expect(message.to).toEqual(["advisors@example.com"]);
    expect(message.subject).toContain("Acme Co");
    expect(message.subject).toContain("EAA-2026-AB12CD34");
    expect(message.text).toContain(`https://app.example.com/advisor/submissions/${SESSION}`);
    expect(deps.complete).toHaveBeenCalledWith("evt-advisor", "msg_1");
    expect(deps.fail).not.toHaveBeenCalled();
    expect(logs).toEqual(["OUTBOX_SENT: kind=advisor_notification event=evt-advisor attempt=1"]);
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
  const failing: SendResult = { ok: false, kind: "provider_error", httpStatus: 503 };

  it("logs a failed send and retries it later, without touching anything else", async () => {
    const { deps, logs } = harness({}, failing);
    const summary = await dispatchEvents([advisorRow({ attempts: 1 })], deps);
    expect(summary).toEqual({ sent: 0, retrying: 1, dead: 0, unrecorded: 0 });
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "provider_error:503", 60);
    expect(deps.complete).not.toHaveBeenCalled();
    expect(logs).toEqual(["OUTBOX_SEND_FAILED: kind=advisor_notification event=evt-advisor attempt=1/5 reason=provider_error:503 retry_in=60s"]);
  });

  it("backs off further on each attempt", async () => {
    for (const [attempts, delay] of [[2, 300], [3, 1800], [4, 7200]] as const) {
      const { deps } = harness({}, failing);
      await dispatchEvents([advisorRow({ attempts })], deps);
      expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "provider_error:503", delay);
    }
  });

  it("marks the event dead, and logs it for operators, once attempts run out", async () => {
    const { deps, logs } = harness({}, failing);
    const summary = await dispatchEvents([advisorRow({ attempts: MAX_ATTEMPTS })], deps);
    expect(summary).toEqual({ sent: 0, retrying: 0, dead: 1, unrecorded: 0 });
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "provider_error:503", null);
    expect(logs).toEqual(["OUTBOX_DEAD: kind=advisor_notification event=evt-advisor attempts=5 reason=provider_error:503; needs an operator"]);
  });

  it("records a timeout or network error as a failure of that kind", async () => {
    const { deps } = harness({}, { ok: false, kind: "timeout", httpStatus: null });
    await dispatchEvents([advisorRow()], deps);
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "timeout", 60);
  });

  it("treats a send that throws as a network failure", async () => {
    const { deps } = harness({ send: vi.fn(async () => { throw new Error("boom jo@acme.example"); }) });
    const summary = await dispatchEvents([advisorRow()], deps);
    expect(summary.retrying).toBe(1);
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "network", 60);
  });

  it("gives up at once on a payload that can never be sent, without calling the provider", async () => {
    const { deps, sent } = harness();
    const summary = await dispatchEvents(
      [prospectRow({ payload: { reference: "EAA-1", recipient_email: "not an email" } }), advisorRow({ id: "e2", payload: {} }), advisorRow({ id: "e3", kind: "mystery" })],
      deps,
    );
    expect(sent).toHaveLength(0);
    expect(summary.dead).toBe(3);
    expect(deps.fail).toHaveBeenCalledWith("evt-prospect", "invalid_payload", null);
    expect(deps.fail).toHaveBeenCalledWith("e2", "invalid_payload", null);
    expect(deps.fail).toHaveBeenCalledWith("e3", "unknown_kind", null);
  });

  it("holds an event back, without sending, if its kind loses its configuration mid-run", async () => {
    const { deps, sent } = harness({ config: readDispatchConfig(() => undefined) });
    const summary = await dispatchEvents([advisorRow()], deps);
    expect(sent).toHaveLength(0);
    expect(summary.retrying).toBe(1);
    expect(deps.fail).toHaveBeenCalledWith("evt-advisor", "not_configured", 60);
  });

  it("carries on with the rest of the batch after one fails", async () => {
    const send = vi.fn(async (message: EmailMessage): Promise<SendResult> =>
      message.to[0] === "jo@acme.example" ? { ok: false, kind: "auth", httpStatus: 403 } : { ok: true, messageId: "msg_ok" });
    const { deps } = harness({ send });
    const summary = await dispatchEvents([prospectRow(), advisorRow()], deps);
    expect(summary).toEqual({ sent: 1, retrying: 1, dead: 0, unrecorded: 0 });
    expect(deps.fail).toHaveBeenCalledWith("evt-prospect", "auth:403", 60);
    expect(deps.complete).toHaveBeenCalledWith("evt-advisor", "msg_ok");
  });

  it("keeps going, and says so, when the outcome cannot be written to the database", async () => {
    const complete = vi.fn(async (id: string) => { if (id === "evt-advisor") throw new Error("db down"); });
    const { deps, logs } = harness({ complete });
    const summary = await dispatchEvents([advisorRow(), prospectRow()], deps);
    expect(summary).toEqual({ sent: 1, retrying: 0, dead: 0, unrecorded: 1 });
    expect(logs.some((l) => l.startsWith("OUTBOX_RECORD_FAILED: kind=advisor_notification event=evt-advisor"))).toBe(true);
  });

  it("never puts an address, name or message body in a log line", async () => {
    const { deps, logs } = harness({}, { ok: false, kind: "provider_error", httpStatus: 500 });
    await dispatchEvents([advisorRow(), prospectRow({ attempts: MAX_ATTEMPTS })], deps);
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      for (const secret of ["jo@acme.example", "Joanna", "Jo Doe", "Acme", "advisors@example.com"]) expect(line).not.toContain(secret);
    }
  });
});

describe("idempotency key", () => {
  const message: EmailMessage = { from: "a@b.example", to: ["c@d.example"], subject: "S", text: "T", html: "H" };

  it("is the same for a retry of the same message, so the provider sends it once", () => {
    expect(idempotencyKey("evt-1", message)).toBe(idempotencyKey("evt-1", { ...message }));
  });

  it("differs per event, and when the message changes (so a fixed sender is not rejected as a reused key)", () => {
    const base = idempotencyKey("evt-1", message);
    expect(idempotencyKey("evt-2", message)).not.toBe(base);
    expect(idempotencyKey("evt-1", { ...message, from: "other@b.example" })).not.toBe(base);
  });

  it("stays within the provider's 256-character limit", () => {
    expect(idempotencyKey("11111111-2222-3333-4444-555555555555", message).length).toBeLessThanOrEqual(256);
  });

  it("is what each send carries", async () => {
    const { deps, sent } = harness();
    await dispatchEvents([advisorRow()], deps);
    expect(sent[0].key).toBe(idempotencyKey("evt-advisor", sent[0].message));
  });
});

describe("sendableKinds", () => {
  it("lists the kinds whose configuration is complete", () => {
    expect(sendableKinds(config)).toEqual(["advisor_notification", "prospect_confirmation"]);
    expect(sendableKinds(readDispatchConfig((n) => ({ ...env, SUPPORT_EMAIL: "" })[n]))).toEqual(["advisor_notification"]);
    expect(sendableKinds(readDispatchConfig(() => undefined))).toEqual([]);
  });
});
