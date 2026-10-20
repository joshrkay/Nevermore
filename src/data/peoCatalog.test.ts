import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { findPeo, PEO_CATALOG, peoFit, type PeoRecord } from "./peoCatalog";

const peo = (overrides: Partial<PeoRecord> = {}): PeoRecord => ({
  name: "Example PEO",
  minHeadcount: null,
  statesServed: null,
  lastVerified: null,
  ...overrides,
});

const withCount = (employee_count: number | null) => ({ ...EMPTY_CHAMBER_DATA, employee_count });

describe("peoFit headcount", () => {
  it("is unknown, never an invented pass or fail, when the PEO's minimum isn't sourced", () => {
    const [headcount] = peoFit(withCount(3), peo());
    expect(headcount.status).toBe("unknown");
  });

  it("compares the prospect's stated headcount with a sourced minimum", () => {
    const sourced = peo({ minHeadcount: 10 });
    expect(peoFit(withCount(12), sourced)[0].status).toBe("meets");
    expect(peoFit(withCount(10), sourced)[0].status).toBe("meets");
    expect(peoFit(withCount(3), sourced)[0].status).toBe("does_not_meet");
  });

  it("is unknown when the prospect hasn't given a headcount", () => {
    expect(peoFit(withCount(null), peo({ minHeadcount: 10 }))[0].status).toBe("unknown");
  });
});

describe("peoFit states", () => {
  const withStates = (states: string[]) => ({ ...EMPTY_CHAMBER_DATA, states });
  const statesCheck = (data: ReturnType<typeof withStates>, p: PeoRecord) => peoFit(data, p)[1];

  it("is unknown when the PEO's served states aren't sourced", () => {
    expect(statesCheck(withStates(["TX"]), peo()).status).toBe("unknown");
  });

  it("meets when every state the prospect operates in is served", () => {
    expect(statesCheck(withStates(["TX", "CA"]), peo({ statesServed: ["CA", "TX", "NY"] })).status).toBe("meets");
  });

  it("names the states that aren't served", () => {
    const check = statesCheck(withStates(["TX", "WA"]), peo({ statesServed: ["TX"] }));
    expect(check.status).toBe("does_not_meet");
    expect(check.label).toContain("WA");
    expect(check.label).not.toContain("TX,");
  });

  it("is unknown when the prospect hasn't said where they operate", () => {
    expect(statesCheck(withStates([]), peo({ statesServed: ["TX"] })).status).toBe("unknown");
  });
});

describe("PEO_CATALOG", () => {
  it("lists each PEO once, alphabetically, so no PEO is ranked above another", () => {
    const names = PEO_CATALOG.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("carries a verification date for every sourced fact", () => {
    for (const p of PEO_CATALOG) {
      const hasFacts = p.minHeadcount !== null || p.statesServed !== null;
      if (hasFacts) expect(p.lastVerified, p.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("finds a PEO by name regardless of case, and returns nothing for an unlisted one", () => {
    expect(findPeo("justworks")?.name).toBe("Justworks");
    expect(findPeo("Acme PEO")).toBeUndefined();
  });
});
