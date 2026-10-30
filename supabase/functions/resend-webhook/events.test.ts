import { describe, expect, it } from "vitest";
import { cleanText, parseResendEvent, TRACKED_TYPES } from "./events";

const bounce = (over: Record<string, unknown> = {}, dataOver: Record<string, unknown> = {}) => ({
  type: "email.bounced",
  created_at: "2026-10-28T12:00:01.000Z",
  data: {
    email_id: "re_abc123",
    created_at: "2026-10-28T12:00:00.000Z",
    from: "Edgar Allan Advisory <intake@mail.example.com>",
    to: ["jo@acme.example"],
    subject: "We received your intake (EAA-2026-AB12CD34)",
    bounce: { type: "Permanent", subType: "General", message: "The recipient's mail server said the mailbox does not exist." },
    ...dataOver,
  },
  ...over,
});

describe("parseResendEvent", () => {
  it("reads a bounce: the message, who it went to, the bounce type, the provider's reason and when", () => {
    expect(parseResendEvent(bounce())).toEqual({
      kind: "event",
      event: {
        type: "email.bounced",
        messageId: "re_abc123",
        recipients: ["jo@acme.example"],
        bounceType: "Permanent",
        detail: "General: The recipient's mail server said the mailbox does not exist.",
        occurredAt: "2026-10-28T12:00:00.000Z",
      },
    });
  });

  it("tracks the five events that say a message went wrong, and drops the rest", () => {
    expect([...TRACKED_TYPES]).toEqual(["email.bounced", "email.complained", "email.delivery_delayed", "email.failed", "email.suppressed"]);
    for (const type of ["email.sent", "email.delivered", "email.opened", "email.clicked", "email.scheduled", "contact.created", "domain.updated", "suppression.added"]) {
      expect(parseResendEvent({ type, created_at: "x", data: { to: ["a@b.example"] } })).toEqual({ kind: "ignore", type });
    }
  });

  it.each([
    ["a complaint", { type: "email.complained", data: { email_id: "re_1", to: ["a@b.example"] } }, null],
    ["a delay", { type: "email.delivery_delayed", data: { email_id: "re_1", to: ["a@b.example"] } }, null],
    ["a failure", { type: "email.failed", data: { email_id: "re_1", to: ["a@b.example"], failed: { reason: "Provider fault" } } }, "Provider fault"],
    ["a suppression", { type: "email.suppressed", data: { email_id: "re_1", to: ["a@b.example"], suppressed: { type: "OnAccountSuppressionList", message: "Resend suppressed it" } } }, "Resend suppressed it"],
  ])("reads %s", (_name, body, detail) => {
    const parsed = parseResendEvent({ created_at: "2026-10-28T12:00:00.000Z", ...body });
    expect(parsed.kind).toBe("event");
    if (parsed.kind === "event") {
      expect(parsed.event.detail).toBe(detail);
      expect(parsed.event.bounceType).toBeNull();
      expect(parsed.event.recipients).toEqual(["a@b.example"]);
    }
  });

  it("keeps only the fields it names: the subject, sender and body of the email never come through", () => {
    const parsed = parseResendEvent(bounce({}, { tags: { secret: "TAG-VALUE" }, html: "<p>BODY-TEXT</p>" }));
    expect(JSON.stringify(parsed)).not.toMatch(/We received your intake|intake@mail|TAG-VALUE|BODY-TEXT|EAA-2026/);
  });

  it("ignores or flags, rather than throws on, anything that is not an event", () => {
    for (const junk of [null, undefined, 5, "text", [], {}, { type: 5 }, { type: null }]) {
      expect(parseResendEvent(junk)).toEqual({ kind: "ignore", type: null });
    }
  });

  it("calls a tracked event with no usable recipient unusable, so it is acknowledged and not retried forever", () => {
    for (const data of [undefined, null, {}, { to: [] }, { to: "a@b.example" }, { to: [5, null, "not an address", "a b@c.example", "x@y.example, z@w.example"] }]) {
      expect(parseResendEvent({ type: "email.bounced", data })).toEqual({ kind: "unusable", type: "email.bounced" });
    }
  });

  it("keeps only plausible addresses, once each, at most twenty", () => {
    const many = Array.from({ length: 30 }, (_, i) => `user${i}@x.example`);
    const parsed = parseResendEvent(bounce({}, { to: ["a@b.example", "a@b.example", "bad address", ...many] }));
    expect(parsed.kind === "event" && parsed.event.recipients).toHaveLength(20);
    expect(parsed.kind === "event" && parsed.event.recipients[0]).toBe("a@b.example");
    expect(parsed.kind === "event" && parsed.event.recipients.filter((r) => r === "a@b.example")).toHaveLength(1);
  });

  it("takes the time from the event, else the envelope, else says it does not know", () => {
    const at = (over: Record<string, unknown>, dataOver: Record<string, unknown>) => {
      const p = parseResendEvent(bounce(over, dataOver));
      return p.kind === "event" ? p.event.occurredAt : "NOT AN EVENT";
    };
    expect(at({}, {})).toBe("2026-10-28T12:00:00.000Z");
    expect(at({}, { created_at: "garbage" })).toBe("2026-10-28T12:00:01.000Z");
    expect(at({ created_at: "also garbage" }, { created_at: null })).toBeNull();
  });

  it("has no message id when the provider sends none, or one that is not usable", () => {
    for (const email_id of [undefined, null, "", "   ", 7, "x".repeat(201)]) {
      const p = parseResendEvent(bounce({}, { email_id }));
      expect(p.kind === "event" && p.event.messageId).toBeNull();
    }
  });
});

describe("cleanText", () => {
  it("replaces addresses and key-like strings, flattens to one line and caps it", () => {
    expect(cleanText("Mailbox jo@acme.example is full; try again", 100)).toBe("Mailbox [email] is full; try again");
    expect(cleanText("key re_AbCdEfGh12345678_ijklMNOP was refused", 100)).toBe("key [redacted] was refused");
    expect(cleanText("line one\r\nline two\t\t three", 100)).toBe("line one line two three");
    const long = cleanText("word ".repeat(100), 40)!;
    expect(Array.from(long)).toHaveLength(40);
    expect(long.endsWith("…")).toBe(true);
  });

  it("says nothing for what is not text, or only blanks", () => {
    expect(cleanText(undefined, 10)).toBeNull();
    expect(cleanText(5, 10)).toBeNull();
    expect(cleanText("  \n ", 10)).toBeNull();
  });

  it("drops invisible and bidi-override characters", () => {
    expect(cleanText(`a${String.fromCharCode(0x202e)}b${String.fromCharCode(0x200b)}c`, 10)).toBe("a b c");
  });
});
