// The fixtures must be answerable: every asserted field is one chamber-extract extracts, and every
// expected value is one the intake would store exactly as written.
import { describe, expect, it } from "vitest";
import { sanitizeChamberPatch } from "@/data/chamberValidation";
import { FIELD_STATUSES } from "@/data/provenance";
import { redactSensitive } from "@/data/sensitive";
import { FIELD_TYPES } from "../../supabase/functions/chamber-extract/schema";
import { CENSUS_TEMPLATE_REPLY, FIXTURES, KEEPS_ASKING_REPLY } from "./fixtures";
import { replyChecks } from "./scoring";

describe("extraction eval fixtures", () => {
  it("are thirteen, with unique ids that are safe in a baseline key", () => {
    expect(FIXTURES).toHaveLength(13);
    const ids = FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(FIXTURES.map((f) => [f.id, f] as const))("%s asserts something, about fields chamber-extract extracts", (_id, f) => {
    expect(f.turns.length).toBeGreaterThan(0);
    for (const { message } of f.turns) expect(message.trim()).not.toBe("");
    const asserted = [...Object.keys(f.expected), ...(f.absent ?? [])];
    expect(asserted.length + (f.forbidden_digits?.length ?? 0) + replyChecks(f).length).toBeGreaterThan(0);
    for (const field of asserted) expect(Object.keys(FIELD_TYPES)).toContain(field);
    for (const field of f.absent ?? []) expect(f.expected).not.toHaveProperty(field);
  });

  it.each(FIXTURES.map((f) => [f.id, f] as const))("%s expects values the intake stores unchanged, with real statuses", (_id, f) => {
    for (const [field, { value, status }] of Object.entries(f.expected)) {
      expect(sanitizeChamberPatch({ [field]: value }), field).toEqual({ [field]: value });
      if (status !== undefined) expect(FIELD_STATUSES).toContain(status);
    }
  });

  it("name their reply checks safely for a baseline key, with patterns that keep no state between tests", () => {
    for (const f of FIXTURES) {
      for (const { name, pattern } of replyChecks(f)) {
        expect(name).toMatch(/^reply\d+:[a-z0-9_]+$/);
        // A global or sticky pattern remembers where it last matched, so a second test() could fail on the same reply.
        expect(pattern.flags).not.toMatch(/[gy]/);
      }
    }
  });

  // US-2.3d: whenever the roster comes up, Lenore points to the census template on the Upload tab.
  it("check that Lenore points to the census template when employees are listed in chat and when asked how to send them", () => {
    const turn = (id: string, i: number) => FIXTURES.find((f) => f.id === id)!.turns[i];
    expect(turn("roster-in-chat", 1).reply).toBe(CENSUS_TEMPLATE_REPLY);
    expect(turn("roster-question", 0).reply).toBe(CENSUS_TEMPLATE_REPLY);
    const passes = (reply: string) => Object.values(CENSUS_TEMPLATE_REPLY).every((p) => p.test(reply));
    expect(passes("The easiest way is our census template: download it on the Upload tab, add one row per person and upload it there.")).toBe(true);
    expect(passes("Thank you. How often do you run payroll?")).toBe(false);
    expect(passes("You can upload a spreadsheet on the Upload tab.")).toBe(false);
  });

  // QA F4: after two short answers Lenore keeps asking instead of saying she has everything.
  it("check that Lenore keeps asking after two short answers", () => {
    const passes = (reply: string) => Object.values(KEEPS_ASKING_REPLY).every((p) => p.test(reply));
    expect(FIXTURES.find((f) => f.id === "two-short-answers")!.turns.every((t) => t.reply === KEEPS_ASKING_REPLY)).toBe(true);
    expect(passes("Bi-weekly, noted. How many days before payday do you fund payroll?")).toBe(true);
    expect(passes("Thank you. That's everything The Manuscript needs. Anything else?")).toBe(false);
    expect(passes("Thank you, the intake is complete.")).toBe(false);
    expect(passes("Noted.")).toBe(false);
  });

  it("only forbid digits a message actually contains, and that redaction removes", () => {
    for (const f of FIXTURES) {
      for (const digits of f.forbidden_digits ?? []) {
        const said = f.turns.map((t) => t.message).join(" ");
        expect(said.replace(/\D/g, "")).toContain(digits);
        expect(redactSensitive(said).replace(/\D/g, "")).not.toContain(digits);
      }
    }
  });
});
