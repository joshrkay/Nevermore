import { describe, expect, it } from "vitest";
import {
  canRetry,
  countFor,
  explainOutboxError,
  isOutboxStatus,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_STATUSES,
  outboxKindLabel,
  stalledMinutes,
} from "./outbox";

describe("statuses", () => {
  it("are the four the queue uses, dead first because it is the one that needs action", () => {
    expect([...OUTBOX_STATUSES]).toEqual(["dead", "pending", "claimed", "sent"]);
    for (const s of OUTBOX_STATUSES) expect(isOutboxStatus(s)).toBe(true);
    for (const s of ["sending", "failed", "", null, undefined, 3]) expect(isOutboxStatus(s)).toBe(false);
  });

  it("allow a retry only for a dead event", () => {
    expect(canRetry({ status: "dead" })).toBe(true);
    for (const status of ["pending", "claimed", "sent"]) expect(canRetry({ status })).toBe(false);
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

  it("does not guess at text it does not know", () => {
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
