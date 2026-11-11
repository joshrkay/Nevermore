import { describe, expect, it } from "vitest";
import { EMPTY_CHAMBER_DATA } from "./chamberTypes";
import { cleanPeoName, findPeo, groupPeosByFit, listedPeos, PEO_NAME_MAX, peoFit, type PeoRecord } from "./peoCatalog";
import { parsePeoCatalog, RULE_KEYS, type EligibilityRules, type ProfileSource, type RequirementProfile } from "./peoProfiles";

const TODAY = "2026-11-11";
const guide = (checkedOn = "2026-11-02"): ProfileSource => ({ kind: "document", name: "Broker guide", checkedOn });

const peo = (overrides: Partial<PeoRecord> = {}): PeoRecord => ({
  name: "Example PEO",
  listed: true,
  lastVerified: null,
  ...overrides,
});

const NO_RULES: EligibilityRules = { minHeadcount: null, statesServed: null, excludedIndustries: null, excludedClassCodes: null, minEnrolmentPercent: null };
// Each rule's part, by its key: the profile's own table, turned round.
const RULE_PART = Object.fromEntries(Object.entries(RULE_KEYS).map(([part, key]) => [key, part])) as { [K in (typeof RULE_KEYS)[keyof typeof RULE_KEYS]]: keyof typeof RULE_KEYS };

/** A PEO whose profile in use holds these rules, each sourced on `checkedOn` unless `unsourced` names it. */
const withRules = (name: string, rules: Partial<EligibilityRules>, opts: { checkedOn?: string; unsourced?: (keyof typeof RULE_PART)[] } = {}): PeoRecord => {
  const all = { ...NO_RULES, ...rules };
  const sources = Object.fromEntries((Object.keys(RULE_PART) as (keyof typeof RULE_PART)[])
    .filter((k) => all[k] !== null && !opts.unsourced?.includes(k))
    .map((k) => [RULE_PART[k], guide(opts.checkedOn)]));
  const profile: RequirementProfile = { version: 1, neededToQuote: [], neededBeforeSigning: [], censusLayout: null, documents: [], rules: all, extraQuestions: [], sources, publishedAt: null };
  return peo({ name, profile, lastVerified: opts.checkedOn ?? "2026-11-02" });
};

const withCount = (employee_count: number | null) => ({ ...EMPTY_CHAMBER_DATA, employee_count });
const census = (...codes: (string | undefined)[]) =>
  codes.map((class_code, i) => ({ id: String(i), first_name: "A", last_name: "B", work_state: "CA", class_code, compensation_type: "salary" as const, employment_type: "full_time" as const, classification: "w2" as const }));
const fit = (data: Parameters<typeof peoFit>[0], p: PeoRecord) => peoFit(data, p, TODAY);
const check = (data: Parameters<typeof peoFit>[0], p: PeoRecord, rule: string) => fit(data, p).find((c) => c.rule === rule)!;
const brief = (c: ReturnType<typeof check>) => [c.status, c.sentence];

describe("peoFit: one check per rule of the profile in use, in a fixed order", () => {
  it("can't tell anything for a PEO with no published profile, and says so for each rule", () => {
    const checks = fit({ ...withCount(8), states: ["CA"] }, peo({ name: "ADP TotalSource" }));
    expect(checks.map((c) => [c.rule, c.label, c.status, c.checkedOn])).toEqual([
      ["min_headcount", "Minimum headcount", "unknown", null],
      ["states_served", "States served", "unknown", null],
      ["excluded_industries", "Excluded industries", "unknown", null],
      ["excluded_class_codes", "Excluded class codes", "unknown", null],
      ["min_enrolment_percent", "Minimum participation", "unknown", null],
    ]);
    expect(checks[0].sentence).toBe("ADP TotalSource's minimum headcount isn't checked yet.");
    expect(checks[4].sentence).toBe("ADP TotalSource's minimum participation isn't checked yet.");
  });

  it("can't tell from a rule that isn't sourced, whatever it holds", () => {
    expect(brief(check(withCount(3), withRules("TriNet", { minHeadcount: 10 }, { unsourced: ["minHeadcount"] }), "min_headcount")))
      .toEqual(["unknown", "TriNet's minimum headcount isn't checked yet."]);
  });

  it("gives each check the date its rule was checked, and says when that is more than 180 days ago", () => {
    const fresh = check(withCount(12), withRules("TriNet", { minHeadcount: 10 }, { checkedOn: "2026-05-15" }), "min_headcount");
    expect([fresh.checkedOn, fresh.stale]).toEqual(["2026-05-15", false]);
    const stale = check(withCount(12), withRules("TriNet", { minHeadcount: 10 }, { checkedOn: "2026-05-14" }), "min_headcount");
    expect([stale.checkedOn, stale.stale]).toEqual(["2026-05-14", true]);
  });

  it("reads the catalog the database returns", () => {
    const [trinet] = parsePeoCatalog([{ id: 5, name: "TriNet", profile: {
      version: 1, min_headcount: 10, states_served: ["CA"], excluded_class_codes: null,
      needed_to_quote: [], needed_before_signing: [], census_layout: null, documents: [], excluded_industries: null,
      min_enrolment_percent: null, extra_questions: [], published_at: null,
      sources: { min_headcount: { kind: "document", name: "Broker guide", checked_on: "2026-11-02" }, states_served: { kind: "document", name: "Broker guide", checked_on: "2026-10-01" } },
    } }]);
    expect(fit({ ...EMPTY_CHAMBER_DATA, employee_count: 8, states: ["CA", "TX"] }, trinet).map((c) => [c.status, c.checkedOn])).toEqual([
      ["does_not_meet", "2026-11-02"], ["does_not_meet", "2026-10-01"], ["unknown", null], ["unknown", null], ["unknown", null],
    ]);
  });
});

describe("peoFit: minimum headcount", () => {
  const trinet = withRules("TriNet", { minHeadcount: 10 });
  it("compares the employer's headcount with the PEO's minimum", () => {
    expect(brief(check(withCount(12), trinet, "min_headcount"))).toEqual(["meets", "TriNet takes groups of 10 or more employees; this employer has 12."]);
    expect(check(withCount(10), trinet, "min_headcount").status).toBe("meets");
    expect(brief(check(withCount(8), trinet, "min_headcount"))).toEqual(["does_not_meet", "TriNet takes groups of 10 or more employees; this employer has 8."]);
  });
  it("can't tell before the headcount is given", () => {
    expect(brief(check(withCount(null), trinet, "min_headcount"))).toEqual(["unknown", "TriNet takes groups of 10 or more employees; this employer's headcount isn't given yet."]);
  });
});

describe("peoFit: states served", () => {
  const withStates = (states: string[]) => ({ ...EMPTY_CHAMBER_DATA, states });
  const trinet = withRules("TriNet", { statesServed: ["CA", "NY", "TX"] });
  it("meets when every state the employer operates in is served", () => {
    expect(brief(check(withStates(["TX", "CA"]), trinet, "states_served"))).toEqual(["meets", "TriNet serves CA, NY, TX; this employer operates in TX, CA."]);
  });
  it("names the states that aren't served", () => {
    expect(brief(check(withStates(["TX", "WA", "OR"]), trinet, "states_served"))).toEqual(["does_not_meet", "TriNet doesn't serve WA, OR; this employer operates in TX, WA, OR."]);
  });
  it("can't tell before the employer says where it operates", () => {
    expect(brief(check(withStates([]), trinet, "states_served"))).toEqual(["unknown", "TriNet serves CA, NY, TX; the states this employer operates in aren't given yet."]);
  });
});

describe("peoFit: excluded industries, through the class codes an admin mapped", () => {
  const trinet = (codes: Record<string, string[]>, industries = ["Roofing", "Cannabis dispensaries"]) =>
    withRules("TriNet", { excludedIndustries: industries, excludedIndustryCodes: codes });
  const withCensus = (...codes: string[]) => ({ ...EMPTY_CHAMBER_DATA, industry: "Roofing contractor", census: census(...codes) });

  it("doesn't meet when the census holds a class code mapped to an excluded industry", () => {
    expect(brief(check(withCensus("8810", "5551"), trinet({ Roofing: ["5551", "5645"] }), "excluded_industries")))
      .toEqual(["does_not_meet", "TriNet won't take Roofing (class codes 5551, 5645); this employer's census has 5551."]);
  });
  it("can't tell, showing the PEO's wording, while an industry has no codes mapped", () => {
    expect(brief(check(withCensus("8810"), trinet({ Roofing: ["5551"] }), "excluded_industries")))
      .toEqual(["unknown", "TriNet won't take Cannabis dispensaries; no class codes are mapped to it yet, so it can't be checked."]);
    expect(brief(check(withCensus("8810"), trinet({}), "excluded_industries")))
      .toEqual(["unknown", "TriNet won't take Roofing, Cannabis dispensaries; no class codes are mapped to them yet, so they can't be checked."]);
  });
  it("never matches the employer's own words for its industry", () => {
    // The intake says "Roofing contractor"; with no codes mapped, that settles nothing.
    expect(check(withCensus(), trinet({}, ["Roofing"]), "excluded_industries").status).toBe("unknown");
  });
  it("meets when every industry is mapped and none of the census's class codes is among them", () => {
    expect(brief(check(withCensus("8810", "8742"), trinet({ Roofing: ["5551"], "Cannabis dispensaries": ["8017"] }), "excluded_industries")))
      .toEqual(["meets", "None of this employer's class codes (8810, 8742) is in an industry TriNet won't take."]);
  });
  it("can't tell before the census has class codes", () => {
    expect(brief(check(withCensus(), trinet({ Roofing: ["5551"], "Cannabis dispensaries": ["8017"] }), "excluded_industries")))
      .toEqual(["unknown", "TriNet won't take Roofing, Cannabis dispensaries; this employer's census has no class codes yet."]);
  });
  it("meets when the PEO excludes no industries", () => {
    expect(brief(check(withCensus(), withRules("TriNet", { excludedIndustries: [] }), "excluded_industries"))).toEqual(["meets", "TriNet excludes no industries."]);
  });
});

describe("peoFit: excluded class codes", () => {
  const withCensus = (...codes: (string | undefined)[]) => ({ ...EMPTY_CHAMBER_DATA, census: census(...codes) });
  const trinet = withRules("TriNet", { excludedClassCodes: ["5551", "7380"] });
  it("names each excluded class code the census holds, once", () => {
    expect(brief(check(withCensus("8810", "5551", "5551"), trinet, "excluded_class_codes"))).toEqual(["does_not_meet", "TriNet excludes class code 5551, which is on this employer's census."]);
  });
  it("meets when none of the census's class codes is excluded", () => {
    expect(brief(check(withCensus("8810", "8742"), trinet, "excluded_class_codes"))).toEqual(["meets", "TriNet excludes class codes 5551, 7380; none is on this employer's census (8810, 8742)."]);
  });
  it("can't tell when no one in the census has a class code", () => {
    expect(brief(check(withCensus(undefined), trinet, "excluded_class_codes"))).toEqual(["unknown", "TriNet excludes class codes 5551, 7380; this employer's census has no class codes yet."]);
  });
  it("meets when the PEO excludes no class codes", () => {
    expect(brief(check(withCensus(), withRules("TriNet", { excludedClassCodes: [] }), "excluded_class_codes"))).toEqual(["meets", "TriNet excludes no class codes."]);
  });
});

describe("peoFit: minimum participation", () => {
  it("can't tell until the intake holds how many employees are eligible and how many enrol, and says so", () => {
    // Coverage tiers, waivers and headcount are on the census, but never stand in for the two numbers.
    const data = { ...withCount(14), census: census("8810", "8810") };
    expect(brief(check(data, withRules("TriNet", { minEnrolmentPercent: 75 }), "min_enrolment_percent"))).toEqual([
      "unknown",
      "TriNet needs 75% of employees eligible for the health plan to enrol; the intake doesn't hold how many are eligible or how many will enrol yet.",
    ]);
  });
});

describe("groupPeosByFit: nothing is ranked", () => {
  const fails = (name: string) => withRules(name, { minHeadcount: 50 });
  const unsure = (name: string) => peo({ name });
  const data = { ...withCount(8), states: ["CA"] };

  it("puts the PEOs alphabetically within each outcome, the outcomes in a fixed order", () => {
    const groups = groupPeosByFit(data, [fails("trinet"), unsure("Insperity"), fails("ADP TotalSource"), unsure("justworks"), fails("Rippling")], TODAY);
    expect(groups.map((g) => [g.outcome, g.peos.map((p) => p.name)])).toEqual([
      ["unknown", ["Insperity", "justworks"]],
      ["does_not_meet", ["ADP TotalSource", "Rippling", "trinet"]],
    ]);
  });

  it("keeps the same order of outcomes whichever holds more PEOs", () => {
    const few = groupPeosByFit(data, [fails("A"), unsure("B"), unsure("C"), unsure("D")], TODAY).map((g) => g.outcome);
    const many = groupPeosByFit(data, [fails("A"), fails("B"), fails("C"), unsure("D")], TODAY).map((g) => g.outcome);
    expect(few).toEqual(["unknown", "does_not_meet"]);
    expect(many).toEqual(few);
  });
});



describe("findPeo", () => {
  const catalog = [peo({ name: "Justworks" }), peo({ name: "TriNet", listed: false })];

  it("finds a PEO the catalog holds by name regardless of case, and nothing for a name it doesn't hold", () => {
    expect(findPeo(catalog, " justworks ")?.name).toBe("Justworks");
    expect(findPeo(catalog, "Acme PEO")).toBeUndefined();
    expect(findPeo([], "Justworks")).toBeUndefined();
  });

  it("still finds a PEO taken off the list, so what was sent to it reads against its profile", () => {
    expect(findPeo(catalog, "trinet")?.name).toBe("TriNet");
  });
});

describe("listedPeos", () => {
  it("keeps only the PEOs an admin lists, in the catalog's order", () => {
    const catalog = [peo({ name: "ADP TotalSource" }), peo({ name: "Insperity", listed: false }), peo({ name: "TriNet" })];
    expect(listedPeos(catalog).map((p) => p.name)).toEqual(["ADP TotalSource", "TriNet"]);
    expect(listedPeos([])).toEqual([]);
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

