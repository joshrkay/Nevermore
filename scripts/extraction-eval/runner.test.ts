// The eval's whole path (redaction, context, prompt, shaping, merge, scoring, baseline) against a
// stub model with canned tool arguments. No provider is called.
import { describe, expect, it, vi } from "vitest";
import { EMPTY_CHAMBER_DATA } from "@/data/chamberTypes";
import type { ModelRequest, ModelResult } from "../../supabase/functions/_shared/ai/model";
import { buildUserPrompt, nextFields, userTurnParts } from "../../supabase/functions/chamber-extract/prompt";
import { CHAT_MAX_TOKENS, PROMPT_VERSION, SYSTEM_PROMPT } from "../../supabase/functions/chamber-extract/schema";
import { FIXTURES, type Fixture } from "./fixtures";
import { connectProvider, main, runFixture, runFixtures, type Connection, type MainDeps, type ModelCall } from "./runner";
import { parseBaseline } from "./scoring";

const confirmed = (...fields: string[]) => Object.fromEntries(fields.map((f) => [f, "confirmed"]));

// What a well-behaved model answers to each fixture message, keyed by the message as the model
// receives it (so the SSN message is keyed in its redacted form). {} is a tool call with nothing in it.
const CANNED: Record<string, Record<string, unknown> | null> = {
  "We're Mossgate Ceramics LLC, headquartered in Oregon. All 23 of our employees work in Oregon.": {
    company_name: "Mossgate Ceramics LLC", hq_state: "OR", states: ["OR"], employee_count: 23,
    field_status: confirmed("company_name", "hq_state", "states", "employee_count"),
    evidence: { company_name: "We're Mossgate Ceramics LLC" },
  },
  "We run it as two companies, each with its own FEIN, and keep employee records in Thistledown HR.": {
    multiple_entities: true, fein_count: 2, hris_system: "Thistledown HR",
    field_status: { multiple_entities: "confirmed", fein_count: "inferred", hris_system: "confirmed" },
  },
  "I run a dental practice in Austin with 14 people on staff.": {
    industry: "Dental practice", hq_state: "TX", employee_count: 14,
    field_status: { industry: "confirmed", hq_state: "inferred", employee_count: "confirmed" },
  },
  "Ten of them are hourly; the other four are salaried.": {
    has_nonexempt: true, nonexempt_count: 10, exempt_count: 4,
    field_status: { has_nonexempt: "inferred", nonexempt_count: "confirmed", exempt_count: "confirmed" },
  },
  "We have people in a few states, mainly CA.": { states: ["CA"], field_status: { states: "incomplete" } },
  "Our whole team works in Colorado.": { states: ["CO"], field_status: confirmed("states") },
  "Oh, and also Texas: we just opened a small office in Dallas.": { states: ["CO", "TX"], field_status: confirmed("states") },
  "We have 40 employees.": { employee_count: 40, field_status: confirmed("employee_count") },
  "Actually it's 45, not 40.": { employee_count: 45, field_status: confirmed("employee_count"), corrected_fields: ["employee_count"] },
  "Payroll is getting harder to manage with 55 employees.": { employee_count: 55, field_status: confirmed("employee_count") },
  "hi, what is a PEO?": {},
  // Echoes the whole message into a free-text field: only the redaction before the model keeps the SSN out.
  "We're Wrenfield Bakery with 12 employees. For your records, my SSN is [redacted].": {
    company_name: "Wrenfield Bakery", employee_count: 12,
    key_challenges: "We're Wrenfield Bakery with 12 employees. For your records, my SSN is [redacted].",
    evidence: { key_challenges: "my SSN is [redacted]" },
  },
  "We run payroll bi-weekly through Quillfeather Payroll.": { pay_frequency: "Bi-weekly", payroll_vendor: "Quillfeather Payroll" },
  "Our health plan is with Hollowbrook Mutual, and it renews on 2027-03-01.": {
    current_carrier: "Hollowbrook Mutual", renewal_date: "2027-03-01", virgin_medical: false,
  },
  // A list in its own case and order: the eval compares lists as sets, ignoring case.
  "For retirement we offer a SIMPLE IRA, and we match up to 3%. We also offer dental and vision.": {
    has_401k: true, retirement_type: "SIMPLE IRA", employer_contributes: true, ancillary_benefits: ["Vision", "Dental"],
  },
  "Payroll has to be funded 2 days before payday.": { funding_days: 2, field_status: confirmed("funding_days") },
  "Workers' comp is with Granite Mutual, renews 2027-07-01, our mod is 0.92 and we pay about $48,000 a year for it.": {
    wc_carrier: "Granite Mutual", wc_renewal_date: "2027-07-01", wc_experience_mod: 0.92, wc_annual_premium: 48000,
  },
  "We don't have an employee handbook.": { has_handbook: false, field_status: confirmed("has_handbook") },
  "We do use a few 1099 contractors, including two in California.": {
    has_1099: true, ca_contractors: true, field_status: confirmed("has_1099", "ca_contractors"),
  },
  "Our hourly staff clock in on a mobile app. We don't use physical time clocks.": {
    uses_mobile_app: true, uses_physical_clocks: false, field_status: confirmed("uses_mobile_app", "uses_physical_clocks"),
  },
};

// buildUserPrompt ends with the JSON-quoted message.
const lastMessage = (user: string) => JSON.parse(/New user message: ("(?:[^"\\]|\\.)*")$/s.exec(user)![1]) as string;

/** A model that answers from CANNED, recording what it was sent. Unknown messages fail the test. */
const stubModel = (overrides: Record<string, ModelResult> = {}) => {
  const requests: ModelRequest[] = [];
  const call = vi.fn(async (request: ModelRequest): Promise<ModelResult> => {
    requests.push(request);
    const message = lastMessage(request.user);
    if (overrides[message]) return overrides[message];
    if (!(message in CANNED)) throw new Error(`no canned answer for ${JSON.stringify(message)}`);
    return { ok: true, args: CANNED[message] ? { ...CANNED[message], reply: "Noted." } : null, attempts: 1, latencyMs: 0 };
  });
  return { call: call as ModelCall & typeof call, requests };
};

const fixture = (id: string): Fixture => FIXTURES.find((f) => f.id === id)!;

describe("runFixture", () => {
  it("sends the message the way the browser does: redacted, with the intake so far minus the census, its statuses and the conversation, in the handler's prompt", async () => {
    const model = stubModel();
    const run = await runFixture(fixture("contradiction"), model.call);
    expect(model.requests).toHaveLength(2);
    const { census: _census, ...empty } = EMPTY_CHAMBER_DATA;
    expect(model.requests[0]).toEqual({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt("We have 40 employees.", userTurnParts(empty, {}, []), nextFields(empty, {})),
    });
    const afterFirst = { ...empty, employee_count: 40 };
    const statuses = { employee_count: "confirmed" };
    const said = [{ sender: "user" as const, text: "We have 40 employees." }, { sender: "lenore" as const, text: "Noted." }];
    expect(model.requests[1].user).toBe(
      buildUserPrompt("Payroll is getting harder to manage with 55 employees.", userTurnParts(afterFirst, statuses, said), nextFields(afterFirst, statuses)),
    );
    expect(model.requests[1].user).not.toContain("census");
    expect(run.error).toBeNull();
  });

  it("never sends the SSN to the model", async () => {
    const model = stubModel();
    await runFixture(fixture("ssn-redacted"), model.call);
    expect(model.requests[0].user).toContain("my SSN is [redacted]");
    expect(model.requests[0].user).not.toMatch(/6789/);
  });

  it("merges like the Chamber: a correction replaces, a contradiction conflicts, a longer list extends", async () => {
    const model = stubModel();
    const corrected = await runFixture(fixture("explicit-correction"), model.call);
    expect(corrected.state.data.employee_count).toBe(45);
    expect(corrected.state.provenance.employee_count?.status).toBe("confirmed");

    const conflicting = await runFixture(fixture("contradiction"), model.call);
    expect(conflicting.state.data.employee_count).toBe(40);
    expect(conflicting.state.provenance.employee_count?.status).toBe("conflicting");
    expect(conflicting.state.provenance.employee_count?.candidates?.map((c) => c.value)).toEqual([40, 55]);

    const extended = await runFixture(fixture("states-extended"), model.call);
    expect(extended.state.data.states).toEqual(["CO", "TX"]);
  });

  it("records the prompt version and the evidence on each value's transcript source", async () => {
    const run = await runFixture(fixture("clean-profile"), stubModel().call);
    expect(run.state.provenance.company_name?.source).toMatchObject({
      kind: "transcript",
      quote: "We're Mossgate Ceramics LLC",
      prompt_version: PROMPT_VERSION,
    });
  });

  it("stops at a failed model call and says which turn and why", async () => {
    const failed: ModelResult = { ok: false, kind: "rate_limited", httpStatus: 429, attempts: 2, latencyMs: 0 };
    const model = stubModel({ "Actually it's 45, not 40.": failed });
    const run = await runFixture(fixture("explicit-correction"), model.call);
    expect(run.error).toBe("turn 2: model call failed (rate_limited, HTTP 429)");
    expect(run.state.data.employee_count).toBe(40);
  });
});

describe("runFixtures", () => {
  it("passes every cell of every fixture when the model answers as it should", async () => {
    const { cells, errors } = await runFixtures(FIXTURES, stubModel().call);
    expect(errors).toEqual([]);
    expect(Object.entries(cells).filter(([, c]) => !c.pass)).toEqual([]);
    const assertions = FIXTURES.reduce(
      (n, f) => n + Object.keys(f.expected).length + (f.absent?.length ?? 0) + (f.forbidden_digits?.length ?? 0),
      0,
    );
    expect(Object.keys(cells)).toHaveLength(assertions);
  });

  it("counts a reply with no tool call as a failed call, as the handler answers it invalid_response", async () => {
    const noToolCall = async (): Promise<ModelResult> => ({ ok: true, args: null, attempts: 1, latencyMs: 0 });
    const { errors } = await runFixtures(FIXTURES.filter((f) => f.id === "incomplete-states"), noToolCall);
    expect(errors.join()).toMatch(/no tool call \(invalid_response\)/);
  });

  it("fails a fixture's cells when its model call fails, and reports it", async () => {
    const failed: ModelResult = { ok: false, kind: "timeout", httpStatus: null, attempts: 1, latencyMs: 20_000 };
    const { cells, errors } = await runFixtures([fixture("incomplete-states")], stubModel({ "We have people in a few states, mainly CA.": failed }).call);
    expect(errors).toEqual(["incomplete-states: turn 1: model call failed (timeout, HTTP -)"]);
    expect(cells["incomplete-states/states"]).toMatchObject({ pass: false, status: null });
  });
});

describe("connectProvider", () => {
  it("picks the provider and model chamber-extract would, without calling it", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const lovable = connectProvider((name) => ({ LOVABLE_API_KEY: "k" })[name]);
    // The default model itself is providers.test.ts's business; here it only has to be named.
    expect(lovable).toMatchObject({ ok: true, provider: "lovable", model: expect.stringMatching(/^(?!undefined$)\S+$/) });
    const anthropic = connectProvider((name) => ({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", AI_MODEL: "claude-other" })[name]);
    expect(anthropic).toMatchObject({ ok: true, provider: "anthropic", model: "claude-other" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("names the missing key", () => {
    expect(connectProvider(() => undefined)).toEqual({ ok: false, problem: "LOVABLE_API_KEY is not set" });
  });

  it("gives Anthropic the reply budget chamber-extract gives it", async () => {
    const reply = new Response(JSON.stringify({ stop_reason: "tool_use", content: [] }), { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(reply);
    try {
      const anthropic = connectProvider((name) => ({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" })[name]);
      if (!anthropic.ok) throw new Error(anthropic.problem);
      await anthropic.call({ system: "s", user: "u" });
      expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string).max_tokens).toBe(CHAT_MAX_TOKENS);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("main", () => {
  const RECORDED_AT = new Date("2026-11-03T10:00:00Z");

  const setup = (opts: { args?: string[]; baseline?: string | null; model?: ReturnType<typeof stubModel>; connect?: MainDeps["connect"] } = {}) => {
    const lines: string[] = [];
    const written: string[] = [];
    const model = opts.model ?? stubModel();
    const connect = opts.connect ?? ((): Connection => ({ ok: true, provider: "stub", model: "canned-1", call: model.call }));
    const deps: MainDeps = {
      args: opts.args ?? [],
      env: () => undefined,
      log: (line) => lines.push(line),
      baselinePath: "scripts/extraction-eval/baseline.json",
      readBaseline: () => opts.baseline ?? null,
      writeBaseline: (text) => written.push(text),
      now: () => RECORDED_AT,
      connect,
    };
    return { deps, lines, written, model, output: () => lines.join("\n") };
  };

  const recordBaseline = async () => {
    const t = setup({ args: ["--update-baseline"] });
    expect(await main(t.deps)).toBe(0);
    return t.written[0];
  };

  it("refuses to run without a provider key, with the variables to set", async () => {
    const t = setup({ connect: connectProvider });
    expect(await main(t.deps)).toBe(1);
    expect(t.output()).toContain("LOVABLE_API_KEY is not set");
    expect(t.output()).toContain("AI_PROVIDER");
  });

  it("prints the table and how to record a baseline when there is none, and exits cleanly", async () => {
    const t = setup();
    expect(await main(t.deps)).toBe(0);
    expect(t.output()).toMatch(/clean-profile\s+company_name\s+pass\s+"Mossgate Ceramics LLC" \(confirmed\)/);
    expect(t.output()).toMatch(/Accuracy: (\d+)\/\1 cells \(100%\)/);
    expect(t.output()).toContain("npm run eval:extraction -- --update-baseline");
    expect(t.written).toEqual([]);
  });

  it("records a baseline with the version, provider, model, time and every cell", async () => {
    const baseline = parseBaseline(await recordBaseline());
    expect(baseline).toMatchObject({ prompt_version: PROMPT_VERSION, provider: "stub", model: "canned-1", recorded_at: RECORDED_AT.toISOString() });
    expect(baseline.cells["contradiction/employee_count"]).toEqual({ pass: true, actual: 40, status: "conflicting" });
    expect(baseline.cells["ssn-redacted/no_digits:123456789"]).toEqual({ pass: true, actual: [], status: null });
  });

  it("passes when nothing regressed", async () => {
    const t = setup({ baseline: await recordBaseline() });
    expect(await main(t.deps)).toBe(0);
    expect(t.output()).toContain("No regressions against the baseline");
  });

  it("fails and lists a cell that passed in the baseline and fails now", async () => {
    const baseline = await recordBaseline();
    // The model stops flagging the correction, so the second value conflicts instead of replacing.
    const regressed: ModelResult = { ok: true, args: { employee_count: 45, field_status: confirmed("employee_count") }, attempts: 1, latencyMs: 0 };
    const t = setup({ baseline, model: stubModel({ "Actually it's 45, not 40.": regressed }) });
    expect(await main(t.deps)).toBe(1);
    expect(t.output()).toContain("REGRESSIONS: 1 cell(s)");
    expect(t.output()).toContain("explicit-correction/employee_count: 45 (confirmed) -> 40 (conflicting)");
  });

  it("reports cells that are new since the baseline", async () => {
    const recorded = JSON.parse(await recordBaseline());
    delete recorded.cells["payroll-benefits/renewal_date"];
    const t = setup({ baseline: JSON.stringify(recorded) });
    expect(await main(t.deps)).toBe(0);
    expect(t.output()).toContain("New since the baseline (1):");
    expect(t.output()).toContain('payroll-benefits/renewal_date: pass "2027-03-01"');
  });

  it("reports a fixture deleted since the baseline as no longer asserted", async () => {
    const t = setup({ baseline: await recordBaseline() });
    t.deps.fixtures = FIXTURES.filter((f) => f.id !== "contradiction");
    expect(await main(t.deps)).toBe(0);
    expect(t.output()).toContain("No longer asserted (1): contradiction/employee_count");
  });

  it("runs one fixture with --only, without reporting the others as removed", async () => {
    const t = setup({ args: ["--only", "incomplete-states"], baseline: await recordBaseline() });
    expect(await main(t.deps)).toBe(0);
    expect(t.model.requests).toHaveLength(1);
    expect(t.output()).not.toContain("No longer asserted");
  });

  it("refuses a malformed baseline before calling the model", async () => {
    const t = setup({ baseline: JSON.stringify({ prompt_version: PROMPT_VERSION }) });
    expect(await main(t.deps)).toBe(1);
    expect(t.output()).toContain("baseline.json is not a baseline");
    expect(t.model.requests).toEqual([]);
  });

  it("reports failed model calls but exits cleanly when there is no baseline to regress from", async () => {
    const failed: ModelResult = { ok: false, kind: "provider_error", httpStatus: 500, attempts: 2, latencyMs: 0 };
    const t = setup({ model: stubModel({ "hi, what is a PEO?": failed }) });
    expect(await main(t.deps)).toBe(0);
    expect(t.output()).toContain("nothing-extractable: turn 1: model call failed (provider_error, HTTP 500)");
    expect(t.output()).toContain("No baseline yet");
  });

  it("fails a run against the baseline whose model calls failed", async () => {
    const recorded = JSON.parse(await recordBaseline());
    // The cell already failed in the baseline, so only the failed call can fail the run.
    recorded.cells["incomplete-states/states"].pass = false;
    const failed: ModelResult = { ok: false, kind: "timeout", httpStatus: null, attempts: 1, latencyMs: 20_000 };
    const t = setup({ baseline: JSON.stringify(recorded), model: stubModel({ "We have people in a few states, mainly CA.": failed }) });
    expect(await main(t.deps)).toBe(1);
    expect(t.output()).toContain("No regressions against the baseline");
    expect(t.output()).toContain("incomplete-states: turn 1: model call failed (timeout, HTTP -)");
  });

  it("won't record a baseline from a run whose model calls failed", async () => {
    const failed: ModelResult = { ok: false, kind: "provider_error", httpStatus: 500, attempts: 2, latencyMs: 0 };
    const t = setup({ args: ["--update-baseline"], model: stubModel({ "hi, what is a PEO?": failed }) });
    expect(await main(t.deps)).toBe(1);
    expect(t.output()).toContain("nothing-extractable: turn 1: model call failed (provider_error, HTTP 500)");
    expect(t.written).toEqual([]);
  });

  it("notes a baseline recorded under an older prompt version", async () => {
    const recorded = JSON.parse(await recordBaseline());
    const t = setup({ baseline: JSON.stringify({ ...recorded, prompt_version: PROMPT_VERSION + 100 }) });
    expect(await main(t.deps)).toBe(0);
    expect(t.output()).toContain(`The prompt is now ${PROMPT_VERSION}`);
  });
});
