// The fixtures must be answerable: every asserted field is one chamber-extract extracts, and every
// expected value is one the intake would store exactly as written.
import { describe, expect, it } from "vitest";
import { sanitizeChamberPatch } from "@/data/chamberValidation";
import { FIELD_STATUSES } from "@/data/provenance";
import { redactSensitive } from "@/data/sensitive";
import { FIELD_TYPES } from "../../supabase/functions/chamber-extract/schema";
import { FIXTURES } from "./fixtures";

describe("extraction eval fixtures", () => {
  it("are ten, with unique ids that are safe in a baseline key", () => {
    expect(FIXTURES).toHaveLength(10);
    const ids = FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(FIXTURES.map((f) => [f.id, f] as const))("%s asserts something, about fields chamber-extract extracts", (_id, f) => {
    expect(f.turns.length).toBeGreaterThan(0);
    for (const { message } of f.turns) expect(message.trim()).not.toBe("");
    const asserted = [...Object.keys(f.expected), ...(f.absent ?? [])];
    expect(asserted.length + (f.forbidden_digits?.length ?? 0)).toBeGreaterThan(0);
    for (const field of asserted) expect(Object.keys(FIELD_TYPES)).toContain(field);
    for (const field of f.absent ?? []) expect(f.expected).not.toHaveProperty(field);
  });

  it.each(FIXTURES.map((f) => [f.id, f] as const))("%s expects values the intake stores unchanged, with real statuses", (_id, f) => {
    for (const [field, { value, status }] of Object.entries(f.expected)) {
      expect(sanitizeChamberPatch({ [field]: value }), field).toEqual({ [field]: value });
      if (status !== undefined) expect(FIELD_STATUSES).toContain(status);
    }
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
