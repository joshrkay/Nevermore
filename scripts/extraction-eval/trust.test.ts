import { describe, expect, it, vi } from "vitest";
import { FIELD_QUESTION } from "../../supabase/functions/chamber-extract/schema";
import { main, runFixture, type MainDeps, type ModelCall } from "./runner";
import { formatBaseline, type Cells } from "./scoring";

describe("strict evaluation", () => {
  const model: ModelCall = async () => ({ ok: true, args: { employee_count: 999, evidence: { employee_count: "12 employees" } }, attempts: 1, latencyMs: 0 });
  const setup = (args: string[]): MainDeps => ({
    args, env: () => undefined, log: vi.fn(), baselinePath: "baseline.json", readBaseline: () => null,
    writeBaseline: vi.fn(), now: () => new Date(0), connect: () => ({ ok: true, provider: "stub", model: "stub", call: model }),
    fixtures: [{ id: "count", description: "count", turns: [{ message: "We have 12 employees." }], expected: { employee_count: { value: 12 } } }],
  });
  it("fails a bad assertion without a baseline", async () => {
    const deps = setup(["--strict"]);
    expect(await main(deps)).toBe(1);
    expect(deps.log).toHaveBeenCalledWith("Strict evaluation failed: required assertions did not pass.");
  });
  it("does not write a failing strict baseline", async () => {
    const deps = setup(["--strict", "--update-baseline"]);
    expect(await main(deps)).toBe(1);
    expect(deps.writeBaseline).not.toHaveBeenCalled();
  });
  it.each([{}, { "count/employee_count": { pass: false, actual: 999, status: "inferred" } }] as Cells[])("fails known or newly added failing assertions with an existing baseline", async (cells) => {
      const deps = setup(["--strict"]);
      deps.readBaseline = () => formatBaseline({ prompt_version: 11, provider: "stub", model: "stub", recorded_at: new Date(0).toISOString() }, cells);
      expect(await main(deps)).toBe(1);
    });
  it("passes correct assertions without a baseline", async () => {
    const deps = setup(["--strict"]);
    deps.fixtures![0].expected.employee_count = { value: 999, status: "inferred" };
    expect(await main(deps)).toBe(0);
  });
});

it("scores the raw reply but replays the guarded reply before a short answer and PEO/advisor questions", async () => {
  const requests: string[] = [];
  const result = await runFixture({ id: "guarded", description: "guarded", expected: {}, turns: [
    { message: "Hello", requested: ["has_401k"] },
    { message: "Yes", requested: ["has_401k"], extraQuestions: [{ id: "1.fleet", peo: "Example", text: "Do you run a fleet?", kind: "yes_no", answered: false }] },
  ] }, async (request) => {
    requests.push(request.user);
    return { ok: true, attempts: 1, latencyMs: 0, args: requests.length === 1
      ? { reply: "That's everything I need." }
      : { has_401k: true, evidence: { has_401k: "Yes" } } };
  });
  expect(result.replies[0]).toBe("That's everything I need.");
  expect(result.deliveredReplies?.[0]).toContain(FIELD_QUESTION.has_401k);
  expect(requests[1]).toContain(FIELD_QUESTION.has_401k);
  expect(requests[1]).not.toContain("That's everything I need.");
  expect(requests[1]).toContain("Do you run a fleet?");
  expect(result.state.data.has_401k).toBe(true);
  expect(result.state.provenance.has_401k?.status).toBe("inferred");
});
