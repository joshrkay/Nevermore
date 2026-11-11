import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { cleanPeoName, findPeo, PEO_NAME_MAX, peoFit, type PeoRecord } from "./peoCatalog";
import { parsePeoCatalog } from "./peoProfiles";

const peo = (overrides: Partial<PeoRecord> = {}): PeoRecord => ({
  name: "Example PEO",
  listed: true,
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

describe("findPeo", () => {
  const catalog = [peo({ name: "Justworks" }), peo({ name: "TriNet" })];

  it("finds a listed PEO by name regardless of case, and returns nothing for an unlisted one", () => {
    expect(findPeo(catalog, " justworks ")?.name).toBe("Justworks");
    expect(findPeo(catalog, "Acme PEO")).toBeUndefined();
    expect(findPeo([], "Justworks")).toBeUndefined();
  });
});

describe("peoFit on the catalog the database returns", () => {
  it("checks against the rules of the profile in use", () => {
    const [trinet] = parsePeoCatalog([{ id: 5, name: "TriNet", profile: {
      version: 1, min_headcount: 10, states_served: ["CA"], excluded_class_codes: null,
      needed_to_quote: [], needed_before_signing: [], census_layout: null, documents: [], excluded_industries: null,
      min_enrolment_percent: null, extra_questions: [], published_at: null,
      sources: { min_headcount: { kind: "document", name: "Broker guide", checked_on: "2026-11-02" }, states_served: { kind: "document", name: "Broker guide", checked_on: "2026-11-02" } },
    } }]);
    const checks = peoFit({ ...EMPTY_CHAMBER_DATA, employee_count: 8, states: ["CA", "TX"] }, trinet);
    expect(checks.map((c) => [c.label, c.status])).toEqual([
      ["TriNet lists a 10-employee minimum; you have 8", "does_not_meet"],
      ["TriNet doesn't list: TX", "does_not_meet"],
      ["Class codes vs TriNet exclusions", "unknown"],
    ]);
  });

  it("can't tell anything for a PEO with no published profile", () => {
    const [adp] = parsePeoCatalog([{ id: 1, name: "ADP TotalSource", profile: null }]);
    expect(peoFit({ ...EMPTY_CHAMBER_DATA, employee_count: 8, states: ["CA"] }, adp).map((c) => c.status)).toEqual(["unknown", "unknown", "unknown"]);
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
