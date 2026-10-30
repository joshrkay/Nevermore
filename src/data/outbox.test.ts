import { describe, expect, it } from "vitest";
import {
  canRetry,
  countFor,
  emailProblemHelp,
  emailProblemLabel,
  emailProblemsBySession,
  explainOutboxError,
  isOutboxStatus,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_STATUSES,
  outboxKindLabel,
  stalledMinutes,
} from "./outbox";

describe("statuses", () => {
  it("are the five the queue uses, dead first because it is the one that needs action", () => {
    expect([...OUTBOX_STATUSES]).toEqual(["dead", "pending", "claimed", "sent", "suppressed"]);
    for (const s of OUTBOX_STATUSES) expect(isOutboxStatus(s)).toBe(true);
    for (const s of ["sending", "failed", "", null, undefined, 3]) expect(isOutboxStatus(s)).toBe(false);
  });

  it("allow a retry only for a dead event", () => {
    expect(canRetry({ status: "dead" })).toBe(true);
    for (const status of ["pending", "claimed", "sent", "suppressed"]) expect(canRetry({ status })).toBe(false);
  });

  it("match the worker's attempt limit", () => {
    expect(OUTBOX_MAX_ATTEMPTS).toBe(5);
  });
});

describe("kind labels", () => {
  it("name both emails and pass an unknown kind through rather than hiding it", () => {
    expect(outboxKindLabel("advisor_notification")).toBe("Advisor alert");
    expect(outboxKindLabel("prospect_confirmation")).toBe("Prospect confirmation");
    expect(outboxKindLabel("crm_sync")).toBe("crm_sync");
  });
});

describe("explainOutboxError", () => {
  it("says nothing when there is no error", () => {
    expect(explainOutboxError(null)).toBeNull();
    expect(explainOutboxError("   ")).toBeNull();
  });

  it.each([
    ["provider_error:503", /provider reported an error \(HTTP 503\)/i],
    ["provider_error:422 (validation_error: Invalid `to` field)", /HTTP 422/],
    ["auth:403 (validation_error: The mail.example.com domain is not verified.)", /sender domain/i],
    ["auth:401", /API key/],
    ["rate_limited:429", /slow down/i],
    ["timeout", /may have been delivered/i],
    ["network", /may have been delivered/i],
    ["worker_lost", /nothing was sent/i],
    ["worker_lost_maybe_sent", /check the provider's log/i],
    ["invalid_payload", /can't be turned into an email/i],
    ["freeze_failed", /nothing was sent/i],
  ])("reads %s", (recorded, expected) => {
    expect(explainOutboxError(recorded)).toMatch(expected);
  });

  it("repeats a missing setting by name, and says the event sends by itself once it is fixed", () => {
    const text = explainOutboxError("not_configured: ADVISORY_NOTIFY_EMAIL is not set to valid address(es)")!;
    expect(text).toContain("ADVISORY_NOTIFY_EMAIL is not set to valid address(es)");
    expect(text).toContain("sends by itself");
  });

  it.each([
    ["suppressed: bounced", /bounced for good earlier/],
    ["suppressed: complained", /reported an earlier email as spam/],
    ["suppressed: provider_suppressed", /provider already blocks/],
  ])("reads %s", (recorded, expected) => {
    expect(explainOutboxError(recorded)).toMatch(expected);
  });

  it("does not guess at text it does not know", () => {
    expect(explainOutboxError("suppressed: something new")).toBeNull();
    expect(explainOutboxError("something odd happened")).toBeNull();
    expect(explainOutboxError("mystery_code")).toBeNull();
  });
});

describe("stalledMinutes", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  const due = (minutesAgo: number | null) => [
    { status: "dead", oldest_due_at: null },
    { status: "pending", oldest_due_at: minutesAgo === null ? null : new Date(now - minutesAgo * 60_000).toISOString() },
  ];

  it("is quiet while the worker is keeping up", () => {
    expect(stalledMinutes(due(null), now)).toBeNull();
    expect(stalledMinutes(due(0), now)).toBeNull();
    expect(stalledMinutes(due(9), now)).toBeNull();
  });

  it("reports how long the longest-waiting due event has waited, from ten minutes", () => {
    expect(stalledMinutes(due(10), now)).toBe(10);
    expect(stalledMinutes(due(95), now)).toBe(95);
  });

  it("copes with a missing or unreadable row", () => {
    expect(stalledMinutes([], now)).toBeNull();
    expect(stalledMinutes([{ status: "pending", oldest_due_at: "garbage" }], now)).toBeNull();
  });
});

describe("countFor", () => {
  it("reads a status's count, 0 when absent, and tolerates a count that arrives as text", () => {
    const summary = [{ status: "dead", events: 3 }, { status: "sent", events: "12" as unknown as number }];
    expect(countFor(summary, "dead")).toBe(3);
    expect(countFor(summary, "sent")).toBe(12);
    expect(countFor(summary, "pending")).toBe(0);
  });
});

describe("prospects who cannot be reached by email", () => {
  it("labels each reason, and any reason it does not know, without hiding that something is wrong", () => {
    expect(emailProblemLabel("bounced")).toBe("Email bounced");
    expect(emailProblemLabel("complained")).toBe("Reported as spam");
    expect(emailProblemLabel("provider_suppressed")).toBe("Email blocked");
    expect(emailProblemLabel("something_new")).toBe("Email problem");
  });

  it("says what to do, and that the address will not be emailed again", () => {
    for (const reason of ["bounced", "complained", "provider_suppressed", "something_new"]) {
      expect(emailProblemHelp(reason)).toMatch(/Reach them another way/);
    }
    expect(emailProblemHelp("bounced")).toMatch(/bounced for good/);
    expect(emailProblemHelp("complained")).toMatch(/reported our confirmation email as spam/);
  });

  it("indexes the flagged submissions by id", () => {
    const map = emailProblemsBySession([
      { session_id: "s1", reason: "bounced", since: "2026-10-28T12:00:00Z" },
      { session_id: "s2", reason: "complained", since: "2026-10-28T13:00:00Z" },
    ]);
    expect(map.get("s1")?.reason).toBe("bounced");
    expect(map.get("s2")?.reason).toBe("complained");
    expect(map.get("s3")).toBeUndefined();
    expect(emailProblemsBySession([]).size).toBe(0);
  });
});
