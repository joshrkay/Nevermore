import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { scorePEOs } from "./peoScoring";

describe("scorePEOs", () => {
  it("scores every PEO within 0–100, sorted best first", () => {
    const results = scorePEOs(DEMO_CHAMBER_DATA);
    expect(results.map((r) => r.name).sort()).toEqual(["ADP TotalSource", "Insperity", "Justworks", "Rippling", "TriNet"]);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
    const scores = results.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("does not throw on an empty profile", () => {
    expect(() => scorePEOs(EMPTY_CHAMBER_DATA)).not.toThrow();
  });

  it("favors TriNet for a small California creative agency buying first-time coverage", () => {
    expect(scorePEOs({ ...DEMO_CHAMBER_DATA, virgin_medical: true })[0].name).toBe("TriNet");
  });

  it("favors ADP TotalSource for a large multi-entity company", () => {
    const results = scorePEOs({
      ...EMPTY_CHAMBER_DATA,
      employee_count: 400,
      states: ["NY", "NJ", "PA", "TX"],
      multiple_entities: true,
      fein_count: 3,
      has_nonexempt: true,
      nonexempt_count: 150,
      shift_differentials: true,
      has_1099: true,
    });
    expect(results[0].name).toBe("ADP TotalSource");
  });

  it("applies the size discount to PEPM ranges", () => {
    const small = scorePEOs({ ...EMPTY_CHAMBER_DATA, employee_count: 10 }).find((r) => r.name === "TriNet")!;
    const large = scorePEOs({ ...EMPTY_CHAMBER_DATA, employee_count: 80 }).find((r) => r.name === "TriNet")!;
    expect(small.pepmRange).toBe("$150–$220");
    expect(large.pepmRange).toBe("$128–$187");
  });
});
