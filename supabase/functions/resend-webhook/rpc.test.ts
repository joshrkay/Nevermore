import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { protectedAddresses, recordArgs } from "./rpc";

const ROOT = path.resolve(__dirname, "../../..");

describe("protectedAddresses", () => {
  it("reads the advisory team's list, lower-cased and trimmed, so a mixed-case or padded list still protects", () => {
    expect(protectedAddresses("advisors@example.com, Second@Example.com ,  ")).toEqual(["advisors@example.com", "second@example.com"]);
    expect(protectedAddresses("One@X.example")).toEqual(["one@x.example"]);
  });

  it("is empty, and never throws, when the setting is missing or blank", () => {
    expect(protectedAddresses(undefined)).toEqual([]);
    expect(protectedAddresses("")).toEqual([]);
    expect(protectedAddresses(" , ,")).toEqual([]);
  });
});

describe("recordArgs", () => {
  const input = {
    eventId: "msg_1", type: "email.bounced" as const, messageId: "re_1", recipients: ["a@b.example"],
    bounceType: "Permanent", detail: "General: x", occurredAt: "2026-10-28T12:00:00.000Z", protectedAddresses: ["team@acme.test"],
  };

  it("maps every field to the database function's named argument", () => {
    expect(recordArgs(input)).toEqual({
      p_event_id: "msg_1", p_type: "email.bounced", p_message_id: "re_1", p_recipients: ["a@b.example"],
      p_bounce_type: "Permanent", p_detail: "General: x", p_occurred_at: "2026-10-28T12:00:00.000Z", p_protected: ["team@acme.test"],
    });
  });

  // PostgREST matches arguments by name: a rename on either side makes every webhook fail.
  it("uses exactly the argument names record_email_delivery_event declares", () => {
    const sql = readFileSync(path.join(ROOT, "supabase/migrations/20261028090000_email_delivery_events.sql"), "utf8");
    const declared = /CREATE FUNCTION public\.record_email_delivery_event\(([\s\S]*?)\)\s*RETURNS/.exec(sql)![1];
    const names = [...declared.matchAll(/\b(p_[a-z_]+)\s+[a-z]/g)].map((m) => m[1]).sort();
    expect(names).toEqual(Object.keys(recordArgs(input)).sort());
  });
});
