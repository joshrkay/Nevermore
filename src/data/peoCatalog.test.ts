import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { catalogProblems, cleanPeoName, findPeo, PEO_CATALOG, PEO_NAME_MAX, peoFit, type PeoRecord } from "./peoCatalog";

const peo = (overrides: Partial<PeoRecord> = {}): PeoRecord => ({
  name: "Example PEO",
  minHeadcount: null,
  statesServed: null,
  excludedClassCodes: null,
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

  it("names the PEO's minimum and the prospect's headcount when it doesn't meet it", () => {
    expect(peoFit(withCount(8), peo({ name: "TriNet", minHeadcount: 10 }))[0].label).toBe("TriNet lists a 10-employee minimum; you have 8");
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

describe("cleanPeoName", () => {
  it("keeps a name as typed, trimmed", () => {
    expect(cleanPeoName("  Justworks ")).toBe("Justworks");
    expect(cleanPeoName("Acme PEO, Inc.")).toBe("Acme PEO, Inc.");
  });

  it("reads anything that isn't a name as no choice", () => {
    for (const value of [null, undefined, "", "   ", 42, {}, ["Justworks"]]) expect(cleanPeoName(value)).toBeNull();
  });

  it("cuts a long name to the limit the database accepts, by character", () => {
    expect(cleanPeoName("P".repeat(PEO_NAME_MAX + 5))).toBe("P".repeat(PEO_NAME_MAX));
    // Each emoji is two UTF-16 units: cutting by unit would leave half of the last one.
    expect(cleanPeoName("🦅".repeat(PEO_NAME_MAX + 1))).toBe("🦅".repeat(PEO_NAME_MAX));
  });
});

describe("peoFit class codes", () => {
  const withCodes = (...codes: (string | undefined)[]) => ({
    ...EMPTY_CHAMBER_DATA,
    census: codes.map((class_code, i) => ({ id: String(i), first_name: "A", last_name: "B", work_state: "CA", class_code, compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const })),
  });
  const classCheck = (data: ReturnType<typeof withCodes>, p: PeoRecord) => peoFit(data, p)[2];

  it("is unknown when the PEO's excluded class codes aren't sourced", () => {
    expect(classCheck(withCodes("8810"), peo()).status).toBe("unknown");
  });

  it("is unknown when no one in the census has a class code", () => {
    expect(classCheck(withCodes(undefined), peo({ excludedClassCodes: ["5551"] })).status).toBe("unknown");
  });

  it("meets when none of the census's class codes is excluded", () => {
    expect(classCheck(withCodes("8810", "8742"), peo({ excludedClassCodes: ["5551"] })).status).toBe("meets");
  });

  it("names each excluded class code the census holds, once", () => {
    const check = classCheck(withCodes("8810", "5551", "5551"), peo({ name: "TriNet", excludedClassCodes: ["5551", "7380"] }));
    expect(check.status).toBe("does_not_meet");
    expect(check.label).toBe("TriNet lists class code 5551 as excluded");
  });
});

describe("catalogProblems: every fact is sourced", () => {
  it("accepts a PEO with no facts yet", () => {
    expect(catalogProblems([peo()])).toEqual([]);
  });

  it("asks a fact for its source in the PEO's own materials, as an https link", () => {
    expect(catalogProblems([peo({ name: "TriNet", minHeadcount: 5, lastVerified: "2026-11-10" })])).toEqual([
      "TriNet: minHeadcount has no source",
    ]);
    expect(catalogProblems([peo({ name: "TriNet", statesServed: ["CA"], lastVerified: "2026-11-10", sources: { statesServed: "trinet.example/states" } })])).toEqual([
      "TriNet: statesServed's source isn't an https link",
    ]);
    expect(catalogProblems([peo({ name: "TriNet", statesServed: ["CA"], lastVerified: "2026-11-10", sources: { statesServed: "http://trinet.example/states" } })])).toEqual([
      "TriNet: statesServed's source isn't an https link",
    ]);
  });

  it("asks a PEO with any fact for the date the facts were checked", () => {
    expect(catalogProblems([peo({ name: "TriNet", excludedClassCodes: ["5551"], sources: { excludedClassCodes: "https://trinet.example/appetite" } })])).toEqual([
      "TriNet: facts with no lastVerified date",
    ]);
  });

  it("holds for the catalog the app ships", () => {
    expect(catalogProblems(PEO_CATALOG)).toEqual([]);
  });
});
