import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { IntakeState } from "@/data/provenance";
import type { Fixture } from "./fixtures";
import { accuracy, diffBaseline, formatBaseline, formatTable, normalise, parseBaseline, scoreFixture, valuesMatch, type Cells } from "./scoring";

const source = (quote?: string) => ({ kind: "transcript" as const, message_id: "m1", ...(quote ? { quote } : {}) });
const state = (data: Partial<IntakeState["data"]>, provenance: IntakeState["provenance"] = {}): IntakeState => ({
  data: { ...EMPTY_CHAMBER_DATA, ...data },
  provenance,
});
const fixture = (f: Partial<Fixture>): Fixture => ({ id: "f", description: "", turns: [{ message: "x" }], expected: {}, ...f });

describe("matching values", () => {
  it("compares strings trimmed and ignoring case", () => {
    expect(valuesMatch("  Bi-Weekly ", "bi-weekly")).toBe(true);
    expect(valuesMatch("biweekly", "bi-weekly")).toBe(false);
  });

  it("compares lists as sets of normalised strings", () => {
    expect(valuesMatch(["TX", "co", "CO"], ["CO", "TX"])).toBe(true);
    expect(valuesMatch(["CO"], ["CO", "TX"])).toBe(false);
    expect(valuesMatch("CO", ["CO"])).toBe(false);
    expect(normalise([" B", "a", "b"])).toEqual(["a", "b"]);
  });

  it("compares numbers and booleans exactly", () => {
    expect(valuesMatch(45, 45)).toBe(true);
    expect(valuesMatch("45", 45)).toBe(false);
    expect(valuesMatch(false, false)).toBe(true);
    expect(valuesMatch(null, false)).toBe(false);
  });
});

describe("scoreFixture", () => {
  it("passes a value cell when the value matches and, if asked, so does the status", () => {
    const f = fixture({ expected: { employee_count: { value: 40, status: "conflicting" }, hq_state: { value: "tx" } } });
    const s = state(
      { employee_count: 40, hq_state: "TX" },
      { employee_count: { status: "conflicting", source: source(), updated_at: "x" }, hq_state: { status: "inferred", source: source(), updated_at: "x" } },
    );
    expect(scoreFixture(f, s)).toEqual({
      "f/employee_count": { pass: true, actual: 40, status: "conflicting" },
      "f/hq_state": { pass: true, actual: "TX", status: "inferred" },
    });
  });

  it("fails a value cell on the wrong value, the wrong status or no value", () => {
    const f = fixture({ expected: { employee_count: { value: 45, status: "confirmed" }, industry: { value: "Retail" } } });
    const cells = scoreFixture(f, state({ employee_count: 45 }, { employee_count: { status: "inferred", source: source(), updated_at: "x" } }));
    expect(cells["f/employee_count"]).toEqual({ pass: false, actual: 45, status: "inferred" });
    expect(cells["f/industry"]).toEqual({ pass: false, actual: null, status: null });
  });

  it("fails a value cell left conflicting unless the fixture expects the conflict", () => {
    const conflicting = { status: "conflicting" as const, source: source(), updated_at: "x", candidates: [{ value: "Quillfeather Payroll", source: source() }, { value: "Quillfeather", source: source() }] };
    const s = state({ payroll_vendor: "Quillfeather Payroll" }, { payroll_vendor: conflicting });
    expect(scoreFixture(fixture({ expected: { payroll_vendor: { value: "Quillfeather Payroll" } } }), s)["f/payroll_vendor"]).toEqual({
      pass: false, actual: "Quillfeather Payroll", status: "conflicting",
    });
    expect(scoreFixture(fixture({ expected: { payroll_vendor: { value: "Quillfeather Payroll", status: "conflicting" } } }), s)["f/payroll_vendor"].pass).toBe(true);
  });

  it("passes an absent cell only while the field is empty", () => {
    const f = fixture({ absent: ["company_name", "states", "key_challenges"] });
    const cells = scoreFixture(f, state({ key_challenges: "Understanding PEOs" }, { key_challenges: { status: "inferred", source: source(), updated_at: "x" } }));
    expect(cells["f/company_name"].pass).toBe(true);
    expect(cells["f/states"]).toEqual({ pass: true, actual: [], status: null });
    expect(cells["f/key_challenges"]).toEqual({ pass: false, actual: "Understanding PEOs", status: "inferred" });
  });

  it("finds forbidden digits in a value, a quote or a conflict candidate, whatever separates them", () => {
    const f = fixture({ forbidden_digits: ["123456789"] });
    expect(scoreFixture(f, state({ key_challenges: "SSN [redacted], 12 staff, 3 sites" }))["f/no_digits:123456789"]).toEqual({ pass: true, actual: [], status: null });
    expect(scoreFixture(f, state({ key_challenges: "SSN 123 45 6789" }))["f/no_digits:123456789"]).toMatchObject({ pass: false, actual: ["key_challenges"] });
    const quoted = state({ company_name: "Wrenfield" }, { company_name: { status: "confirmed", source: source("ssn 123-45-6789"), updated_at: "x" } });
    expect(scoreFixture(f, quoted)["f/no_digits:123456789"].actual).toEqual(["company_name"]);
    const candidate = state(
      { employee_count: 12 },
      { employee_count: { status: "conflicting", source: source(), updated_at: "x", candidates: [{ value: 12, source: source() }, { value: 123456789, source: source() }] } },
    );
    expect(scoreFixture(f, candidate)["f/no_digits:123456789"].actual).toEqual(["employee_count"]);
  });

  it("finds forbidden digits kept only in what else was heard, as a value or a quote", () => {
    const f = fixture({ forbidden_digits: ["4417"] });
    const noted = (also_heard: { value: unknown; source: ReturnType<typeof source> }[]) =>
      state({ pto_types: ["Vacation", "Sick"] }, { pto_types: { status: "inferred", source: source(), updated_at: "x", also_heard } });
    expect(scoreFixture(f, noted([{ value: ["Plan 4417"], source: source() }]))["f/no_digits:4417"].actual).toEqual(["pto_types"]);
    expect(scoreFixture(f, noted([{ value: ["PTO"], source: source("plan 44-17") }]))["f/no_digits:4417"].actual).toEqual(["pto_types"]);
    expect(scoreFixture(f, noted([{ value: ["PTO"], source: source("plan four") }]))["f/no_digits:4417"]).toMatchObject({ pass: true, actual: [] });
  });

  it("passes a reply cell only when Lenore's own reply to that turn matches, and fails one she didn't reply to", () => {
    const f = fixture({
      turns: [{ message: "a" }, { message: "b", reply: { template: /template/i, upload_tab: /upload/i } }, { message: "c", reply: { template: /template/i } }],
    });
    const cells = scoreFixture(f, state({}), null, ["Noted.", "Download the census template on the Upload tab.", null]);
    expect(cells).toEqual({
      "f/reply2:template": { pass: true, actual: "Download the census template on the Upload tab.", status: null },
      "f/reply2:upload_tab": { pass: true, actual: "Download the census template on the Upload tab.", status: null },
      "f/reply3:template": { pass: false, actual: "(no reply)", status: null },
    });
    expect(scoreFixture(f, state({}), null, ["", "Thanks! How often do you run payroll?", "A template."])).toMatchObject({
      "f/reply2:template": { pass: false, actual: "Thanks! How often do you run payroll?" },
      "f/reply2:upload_tab": { pass: false },
      "f/reply3:template": { pass: true },
    });
  });

  it("fails every cell of a fixture that didn't finish, saying why", () => {
    const f = fixture({
      turns: [{ message: "x", reply: { template: /template/i } }],
      expected: { employee_count: { value: 1 } },
      absent: ["industry"],
      forbidden_digits: ["123456789"],
    });
    const cells = scoreFixture(f, state({ employee_count: 1 }), "turn 1: model call failed (timeout, HTTP -)");
    expect(Object.keys(cells)).toEqual(["f/employee_count", "f/industry", "f/no_digits:123456789", "f/reply1:template"]);
    for (const cell of Object.values(cells)) {
      expect(cell).toEqual({ pass: false, actual: "(not run: turn 1: model call failed (timeout, HTTP -))", status: null });
    }
  });
});

describe("reporting", () => {
  const cells: Cells = {
    "clean-profile/company_name": { pass: true, actual: "Mossgate Ceramics LLC", status: "confirmed" },
    "contradiction/employee_count": { pass: false, actual: 45, status: "confirmed" },
    "nothing-extractable/industry": { pass: true, actual: null, status: null },
  };

  it("counts passing cells", () => {
    expect(accuracy(cells)).toEqual({ passed: 2, total: 3, percent: 66.7 });
    expect(accuracy({})).toEqual({ passed: 0, total: 0, percent: 0 });
  });

  it("prints one aligned row per cell and the accuracy", () => {
    expect(formatTable(cells)).toEqual([
      "fixture              field           result  actual (status)",
      'clean-profile        company_name    pass    "Mossgate Ceramics LLC" (confirmed)',
      "contradiction        employee_count  FAIL    45 (confirmed)",
      "nothing-extractable  industry        pass    null",
      "",
      "Accuracy: 2/3 cells (66.7%)",
    ]);
  });
});

describe("baseline", () => {
  const meta = { prompt_version: 1, provider: "anthropic", model: "m", recorded_at: "2026-11-03T10:00:00.000Z" };

  it("is written sorted by cell and reads back as it was", () => {
    const text = formatBaseline(meta, {
      "b/x": { pass: false, actual: undefined, status: null },
      "a/y": { pass: true, actual: ["CO"], status: "confirmed" },
    });
    expect(Object.keys(JSON.parse(text).cells)).toEqual(["a/y", "b/x"]);
    expect(text.endsWith("}\n")).toBe(true);
    expect(parseBaseline(text)).toEqual({ ...meta, cells: { "a/y": { pass: true, actual: ["CO"], status: "confirmed" }, "b/x": { pass: false, actual: null, status: null } } });
  });

  it("refuses a file that isn't a baseline", () => {
    expect(() => parseBaseline(JSON.stringify({ ...meta, cells: { "a/y": { pass: "yes" } } }))).toThrow(/not a baseline: cells\.a\/y\.pass/);
    expect(() => parseBaseline("not json")).toThrow();
  });

  describe("diffBaseline", () => {
    const cell = (pass: boolean) => ({ pass, actual: null, status: null });

    it("calls a cell that passed in the baseline and fails now a regression", () => {
      expect(diffBaseline({ "a/x": cell(true) }, { "a/x": cell(false) })).toEqual({ regressions: ["a/x"], fixed: [], added: [], removed: [], unchanged: 0 });
    });

    it("reports a cell missing from the baseline as new, and one now passing as fixed", () => {
      expect(diffBaseline({ "a/x": cell(false) }, { "a/x": cell(true), "a/y": cell(false) })).toEqual({
        regressions: [], fixed: ["a/x"], added: ["a/y"], removed: [], unchanged: 0,
      });
    });

    it("counts unchanged cells, including ones that failed before and still fail", () => {
      expect(diffBaseline({ "a/x": cell(true), "a/y": cell(false) }, { "a/x": cell(true), "a/y": cell(false) })).toMatchObject({ regressions: [], unchanged: 2 });
    });

    it("reports a dropped assertion or a deleted fixture as removed", () => {
      const baseline = { "a/x": cell(true), "a/gone": cell(true), "b/x": cell(true) };
      expect(diffBaseline(baseline, { "a/x": cell(true) })).toMatchObject({ regressions: [], removed: ["a/gone", "b/x"] });
    });

    it("looks for removals only in the --only fixture", () => {
      const baseline = { "a/x": cell(true), "a/gone": cell(true), "b/x": cell(true) };
      expect(diffBaseline(baseline, { "a/x": cell(true) }, "a")).toMatchObject({ regressions: [], removed: ["a/gone"] });
    });
  });
});
