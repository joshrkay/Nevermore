import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { ChamberData } from "./chamberTypes";
import { CLASSIFICATIONS, COMPENSATION_TYPES, COVERAGE_TIERS, EMPLOYMENT_TYPES } from "./census";
import {
  COUNT_MAX,
  DOLLARS_MAX,
  EXPERIENCE_MOD_MAX,
  MAX_DEPENDENTS,
  MAX_ENTITIES,
  NAME_MAX,
  MAX_EMPLOYEES,
  MAX_LIST_ITEMS,
  MAX_STATES,
  SALARY_MAX,
  TEXT_MAX,
  US_STATE_CODES,
  YEAR_MAX,
  YEAR_MIN,
  parseChamberData,
  sanitizeChamberPatch,
} from "./chamberValidation";
import { validateChamberData } from "../../supabase/functions/_shared/intakeSchema";
import { applyExtraction } from "./provenance";

describe("sanitizeChamberPatch", () => {
  it("returns an empty patch for non-objects", () => {
    expect(sanitizeChamberPatch(null)).toEqual({});
    expect(sanitizeChamberPatch("CA")).toEqual({});
    expect(sanitizeChamberPatch([1, 2])).toEqual({});
  });

  it("keeps valid fields and drops unknown keys", () => {
    expect(sanitizeChamberPatch({ company_name: "Acme", employee_count: 12, reply: "hi", __proto__x: 1 })).toEqual({
      company_name: "Acme",
      employee_count: 12,
    });
  });

  it("drops fields with the wrong type instead of rejecting the patch", () => {
    expect(sanitizeChamberPatch({ company_name: "Acme", has_401k: "maybe", employees: null })).toEqual({
      company_name: "Acme",
    });
  });

  it("normalizes state codes and accepts comma-separated strings", () => {
    expect(sanitizeChamberPatch({ hq_state: "ca", states: "ca, TX, California, tx" })).toEqual({
      hq_state: "CA",
      states: ["CA", "TX"],
    });
  });

  it("coerces numeric strings for counts and rejects negatives", () => {
    expect(sanitizeChamberPatch({ employee_count: "1,200", fein_count: -1 })).toEqual({ employee_count: 1200 });
  });

  it("keeps valid census rows, fills defaults, and drops nameless ones", () => {
    const patch = sanitizeChamberPatch({
      census: [
        { first_name: "Ada", work_state: "ca", dependents: [{ first_name: "Bo", relationship: "kid" }] },
        { last_name: "No first name" },
        "garbage",
      ],
    });
    expect(patch.census).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        first_name: "Ada",
        last_name: "",
        work_state: "CA",
        compensation_type: "salary",
        employment_type: "full_time",
        classification: "w2",
        dependents: [{ first_name: "Bo", last_name: "", dob: "", relationship: "other" }],
        // Neither was given, so both are recorded as defaults rather than answers.
        assumed: ["classification", "employment_type"],
      },
    ]);
  });

  it("reads a roster saved as `employees` before the census contract", () => {
    const patch = sanitizeChamberPatch({
      employees: [{ first_name: "Sarah", last_name: "Chen", dob: "1988-03-15", state: "CA", title: "Designer", salary: 105000, classification: "W2", dependents: [] }],
    });
    expect(patch).not.toHaveProperty("employees");
    expect(patch.census).toEqual([
      {
        id: expect.any(String),
        first_name: "Sarah",
        last_name: "Chen",
        dob: "1988-03-15",
        work_state: "CA",
        job_title: "Designer",
        annual_salary: 105000,
        compensation_type: "salary",
        employment_type: "full_time",
        classification: "w2",
        // The old roster had no employment type: full time is only the default.
        assumed: ["employment_type"],
      },
    ]);
    // A current census wins over a stale `employees` key.
    expect(sanitizeChamberPatch({ census: [], employees: [{ first_name: "Old" }] }).census).toEqual([]);
  });

  it("keeps a census row's id, so saving and reloading doesn't change it", () => {
    const [row] = sanitizeChamberPatch({ census: [{ first_name: "Ada" }] }).census!;
    expect(sanitizeChamberPatch({ census: [row] }).census).toEqual([row]);
  });

  it("removes Social Security and bank account numbers from free text", () => {
    const patch = sanitizeChamberPatch({
      key_challenges: "Owner SSN is 123-45-6789; payroll from acct # 00012345",
      company_name: "Acme 987654321",
    });
    expect(patch.key_challenges).toBe("Owner SSN is [redacted]; payroll from acct [redacted]");
    expect(patch.company_name).toBe("Acme [redacted]");
  });

  it("reads a workers' comp mod and premium as people write them", () => {
    expect(sanitizeChamberPatch({ wc_experience_mod: "0.92", wc_annual_premium: "$18,400" })).toEqual({ wc_experience_mod: 0.92, wc_annual_premium: 18400 });
    // Two decimal places for the mod, whole dollars for the premium.
    expect(sanitizeChamberPatch({ wc_experience_mod: 1.126, wc_annual_premium: 18400.6 })).toEqual({ wc_experience_mod: 1.13, wc_annual_premium: 18401 });
    expect(sanitizeChamberPatch({ wc_experience_mod: 0, wc_annual_premium: DOLLARS_MAX })).toEqual({ wc_experience_mod: 0, wc_annual_premium: DOLLARS_MAX });
    expect(sanitizeChamberPatch({ wc_experience_mod: EXPERIENCE_MOD_MAX, wc_annual_premium: null })).toEqual({ wc_experience_mod: EXPERIENCE_MOD_MAX, wc_annual_premium: null });
    // Out of range or not a number: dropped, not capped.
    expect(sanitizeChamberPatch({ wc_experience_mod: 10.5, wc_annual_premium: DOLLARS_MAX + 1 })).toEqual({});
    expect(sanitizeChamberPatch({ wc_experience_mod: "about one", wc_annual_premium: -5 })).toEqual({});
    expect(sanitizeChamberPatch({ wc_carrier: " Pinnacle Mutual ", wc_renewal_date: "July 2026" })).toEqual({ wc_carrier: "Pinnacle Mutual", wc_renewal_date: "July 2026" });
  });
});

describe("worker classification", () => {
  const classify = (classification: unknown) =>
    sanitizeChamberPatch({ census: [{ first_name: "Ada", classification }] }).census?.map((e) => e.classification);

  it("normalizes common spellings", () => {
    expect(classify("w-2")).toEqual(["w2"]);
    expect(classify("Employee")).toEqual(["w2"]);
    expect(classify("1099 Contractor")).toEqual(["1099"]);
    expect(classify("independent_contractor")).toEqual(["1099"]);
    expect(classify("freelancer")).toEqual(["1099"]);
  });

  it("treats a missing label as W-2", () => {
    expect(classify(undefined)).toEqual(["w2"]);
  });

  it("drops workers whose label can't be recognized instead of counting them as W-2", () => {
    expect(classify("K-1 owner")).toEqual([]);
    expect(classify(42)).toEqual([]);
  });
});

describe("parseChamberData", () => {
  it("fills every field from defaults when stored data is malformed", () => {
    expect(parseChamberData(undefined)).toEqual(EMPTY_CHAMBER_DATA);
    expect(parseChamberData({ states: 5, employees: "x" })).toEqual(EMPTY_CHAMBER_DATA);
    expect(parseChamberData({ census: { first_name: "not a list" } })).toEqual(EMPTY_CHAMBER_DATA);
  });
});

describe("state codes", () => {
  it("lists the 50 states, DC and the five territories, sorted, in exact upper case", () => {
    expect(US_STATE_CODES).toHaveLength(56);
    expect([...US_STATE_CODES]).toEqual([...US_STATE_CODES].sort());
    expect(new Set(US_STATE_CODES).size).toBe(56);
    expect(US_STATE_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    for (const c of ["DC", "PR", "GU", "VI", "AS", "MP"]) expect(US_STATE_CODES).toContain(c);
    for (const c of ["AA", "AE", "AP", "UM", "FM", "ZZ", "XX"]) expect(US_STATE_CODES).not.toContain(c);
  });

  it("drops an unlisted hq_state instead of keeping it", () => {
    expect(sanitizeChamberPatch({ hq_state: "ZZ" })).toEqual({});
    expect(sanitizeChamberPatch({ hq_state: "AE" })).toEqual({});
    expect(sanitizeChamberPatch({ hq_state: "12" })).toEqual({});
    expect(sanitizeChamberPatch({ hq_state: " pr " })).toEqual({ hq_state: "PR" });
  });

  it("drops unlisted entries from states and keeps the rest", () => {
    expect(sanitizeChamberPatch({ states: ["ca", "ZZ", "dc", "AA", " tx "] })).toEqual({ states: ["CA", "DC", "TX"] });
    expect(sanitizeChamberPatch({ states: "ny, XX, ny, Guam" })).toEqual({ states: ["NY"] });
  });

  it("turns an unlisted work state into blank without dropping the person, and reads a state's name", () => {
    const states = (work_state: unknown) =>
      sanitizeChamberPatch({ census: [{ first_name: "Ann", work_state }] }).census?.map((e) => e.work_state);
    expect(states("ca")).toEqual(["CA"]);
    expect(states(" tx ")).toEqual(["TX"]);
    expect(states("California")).toEqual(["CA"]);
    expect(states("")).toEqual([""]);
    for (const bad of ["ZZ", "C", "12", "1!", "W2", "AE", "Narnia", null, 5, undefined]) expect(states(bad)).toEqual([""]);
  });
});

describe("caps truncate instead of rejecting", () => {
  const person = (i: number) => ({ first_name: `E${i}`, work_state: "CA" });

  it("keeps the first MAX_EMPLOYEES people of the census", () => {
    const out = sanitizeChamberPatch({ census: Array.from({ length: MAX_EMPLOYEES + 1000 }, (_, i) => person(i)) });
    expect(out.census).toHaveLength(MAX_EMPLOYEES);
    expect(out.census?.[0].first_name).toBe("E0");
    expect(out.census?.at(-1)?.first_name).toBe(`E${MAX_EMPLOYEES - 1}`);
  });

  it("does not let dropped rows use up slots", () => {
    const raw = [...Array.from({ length: 10 }, () => ({ last_name: "no first name" })), ...Array.from({ length: MAX_EMPLOYEES }, (_, i) => person(i))];
    expect(sanitizeChamberPatch({ census: raw }).census).toHaveLength(MAX_EMPLOYEES);
  });

  it("keeps the first MAX_DEPENDENTS dependents of a person", () => {
    const dependents = Array.from({ length: MAX_DEPENDENTS + 5 }, (_, i) => ({ first_name: `D${i}`, relationship: "child" }));
    const [emp] = sanitizeChamberPatch({ census: [{ first_name: "Ann", dependents }] }).census ?? [];
    expect(emp.dependents).toHaveLength(MAX_DEPENDENTS);
    expect(emp.dependents?.at(-1)?.first_name).toBe(`D${MAX_DEPENDENTS - 1}`);
  });

  it("keeps the first MAX_LIST_ITEMS entries of the text lists", () => {
    const items = Array.from({ length: MAX_LIST_ITEMS + 50 }, (_, i) => `item ${i}`);
    const out = sanitizeChamberPatch({ ancillary_benefits: items, pto_types: items.join(",") });
    expect(out.ancillary_benefits).toHaveLength(MAX_LIST_ITEMS);
    expect(out.pto_types).toHaveLength(MAX_LIST_ITEMS);
    expect(out.pto_types?.at(-1)).toBe(`item ${MAX_LIST_ITEMS - 1}`);
  });

  it("can never hold more than MAX_STATES states", () => {
    const every = Array.from({ length: 676 }, (_, i) => String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
    const out = sanitizeChamberPatch({ states: every }).states ?? [];
    expect(out).toHaveLength(US_STATE_CODES.length);
    expect(out.length).toBeLessThanOrEqual(MAX_STATES);
  });
});

describe("limits shared with the database", () => {
  it("rejects counts and salaries above their maximums and fractions", () => {
    expect(sanitizeChamberPatch({ employee_count: COUNT_MAX })).toEqual({ employee_count: COUNT_MAX });
    expect(sanitizeChamberPatch({ employee_count: COUNT_MAX + 1 })).toEqual({});
    expect(sanitizeChamberPatch({ employee_count: 12.5 })).toEqual({});
    expect(sanitizeChamberPatch({ employee_count: "1e21" })).toEqual({});
    // Pay the intake can't hold is left blank rather than capped.
    const salary = (v: unknown) => sanitizeChamberPatch({ census: [{ first_name: "A", annual_salary: v }] }).census?.[0].annual_salary;
    expect(salary(SALARY_MAX)).toBe(SALARY_MAX);
    expect(salary(SALARY_MAX + 1)).toBeUndefined();
    expect(salary(-5)).toBeUndefined();
    expect(salary("105,000")).toBe(105000);
  });

  it("limits text to TEXT_MAX and census fields to their own lengths", () => {
    expect(sanitizeChamberPatch({ company_name: "x".repeat(TEXT_MAX) }).company_name).toHaveLength(TEXT_MAX);
    expect(sanitizeChamberPatch({ company_name: "x".repeat(TEXT_MAX + 1) })).toEqual({});
    // Over-long text in a row is cut to the limit, never left for the server to refuse.
    const [emp] = sanitizeChamberPatch({
      census: [{ first_name: "A", last_name: "x".repeat(201), job_title: "x".repeat(201), dob: "x".repeat(41) }],
    }).census ?? [];
    expect(emp.last_name).toHaveLength(NAME_MAX);
    expect(emp.job_title).toHaveLength(NAME_MAX);
    expect(emp.dob).toBeUndefined();
  });

  it("removes characters Postgres jsonb refuses", () => {
    const out = sanitizeChamberPatch({
      company_name: "Ac\u0000me\ud800",
      pto_types: ["a\udc00b"],
      census: [{ first_name: "An\u0000n", last_name: "Le\ud83d", job_title: "D\u0000ev", dependents: [{ first_name: "B\u0000o" }] }],
    });
    expect(out.company_name).toBe("Acme");
    expect(out.pto_types).toEqual(["ab"]);
    expect(out.census?.[0]).toMatchObject({ first_name: "Ann", last_name: "Le", job_title: "Dev", dependents: [{ first_name: "Bo" }] });
    expect(JSON.stringify(sanitizeChamberPatch({ company_name: "😀 ok" }))).toContain("😀");
  });
});

describe("company identity (K-1.1)", () => {
  it("keeps a FEIN as its nine digits, with or without the hyphen, and nothing shaped like an SSN", () => {
    expect(sanitizeChamberPatch({ fein: "84-1234567" })).toEqual({ fein: "841234567" });
    expect(sanitizeChamberPatch({ fein: " 841234567 " })).toEqual({ fein: "841234567" });
    expect(sanitizeChamberPatch({ fein: null })).toEqual({ fein: null });
    // 3-2-4 is how a Social Security number is written: never a FEIN.
    expect(sanitizeChamberPatch({ fein: "123-45-6789" })).toEqual({});
    expect(sanitizeChamberPatch({ fein: "84-123456" })).toEqual({});
    expect(sanitizeChamberPatch({ fein: "84 1234567" })).toEqual({});
    expect(sanitizeChamberPatch({ fein: 841234567 })).toEqual({});
  });

  it("reads an entity type however it is commonly written", () => {
    expect(sanitizeChamberPatch({ entity_type: "llc" })).toEqual({ entity_type: "llc" });
    expect(sanitizeChamberPatch({ entity_type: "LLC" })).toEqual({ entity_type: "llc" });
    expect(sanitizeChamberPatch({ entity_type: "S-Corp" })).toEqual({ entity_type: "s_corporation" });
    expect(sanitizeChamberPatch({ entity_type: "C corporation" })).toEqual({ entity_type: "c_corporation" });
    expect(sanitizeChamberPatch({ entity_type: "Sole proprietor" })).toEqual({ entity_type: "sole_proprietorship" });
    expect(sanitizeChamberPatch({ entity_type: "Non-profit" })).toEqual({ entity_type: "nonprofit" });
    expect(sanitizeChamberPatch({ entity_type: "a family business" })).toEqual({});
  });

  it("keeps a year founded that is a real year", () => {
    expect(sanitizeChamberPatch({ year_founded: "1998" })).toEqual({ year_founded: 1998 });
    expect(sanitizeChamberPatch({ year_founded: 2014 })).toEqual({ year_founded: 2014 });
    expect(sanitizeChamberPatch({ year_founded: 1599 })).toEqual({});
    expect(sanitizeChamberPatch({ year_founded: 2101 })).toEqual({});
    expect(sanitizeChamberPatch({ year_founded: 1998.5 })).toEqual({});
  });

  it("keeps a street address with its ZIP+4 and a website as text", () => {
    expect(sanitizeChamberPatch({ street_address: " 500 Main St, Austin, TX 78701-1234 ", website: "meridian.example" })).toEqual({
      street_address: "500 Main St, Austin, TX 78701-1234", website: "meridian.example",
    });
  });

  it("keeps each legal entity that has a name or a FEIN, drops the rest, and stops at 50", () => {
    expect(sanitizeChamberPatch({ entities: [
      { legal_name: " Meridian Creative LLC ", fein: "84-1234567", dba: "Meridian" },
      { legal_name: "Meridian Studios Inc", fein: "123-45-6789" },
      { fein: "841234568" },
      { legal_name: "  " },
      "Meridian Holdings",
      null,
    ] })).toEqual({ entities: [
      { legal_name: "Meridian Creative LLC", fein: "841234567" },
      { legal_name: "Meridian Studios Inc" },
      { fein: "841234568" },
    ] });
    expect(sanitizeChamberPatch({ entities: Array.from({ length: 60 }, (_, i) => ({ legal_name: `Entity ${i}` })) }).entities).toHaveLength(50);
    expect(sanitizeChamberPatch({ entities: "Meridian Creative LLC" })).toEqual({});
  });
});

describe("industry as a code and a description (K-1.2)", () => {
  it("keeps a NAICS code that is one of the 2022 industries, and drops one that isn't", () => {
    expect(sanitizeChamberPatch({ naics_code: "541430" })).toEqual({ naics_code: "541430" });
    expect(sanitizeChamberPatch({ naics_code: " 541430 " })).toEqual({ naics_code: "541430" });
    expect(sanitizeChamberPatch({ naics_code: 541430 })).toEqual({ naics_code: "541430" });
    expect(sanitizeChamberPatch({ naics_code: null })).toEqual({ naics_code: null });
    // Six digits, but no 2022 industry has them.
    expect(sanitizeChamberPatch({ naics_code: "999999" })).toEqual({});
    expect(sanitizeChamberPatch({ naics_code: "54143" })).toEqual({});
    expect(sanitizeChamberPatch({ naics_code: "Graphic design" })).toEqual({});
  });

  it("keeps a description of operations of up to 1,000 characters", () => {
    expect(sanitizeChamberPatch({ operations_description: "  Brand and packaging design.  " })).toEqual({ operations_description: "Brand and packaging design." });
    expect(sanitizeChamberPatch({ operations_description: "x".repeat(1000) }).operations_description).toHaveLength(1000);
    expect(sanitizeChamberPatch({ operations_description: "x".repeat(1001) })).toEqual({});
  });
});

describe("owners and officers (K-3.1)", () => {
  it("keeps each person with what was given of them, reading percentages and yes or no as people write them", () => {
    expect(sanitizeChamberPatch({ owners_officers: [
      { name: " Dana Reyes ", title: "President", ownership_percent: "60%", duties: "Runs sales; no field work", covered: "no" },
      { name: "Sam Okafor", ownership_percent: 12.5, covered: true },
      { name: "Lee Park", ownership_percent: "a third", covered: "maybe" },
      { title: "Treasurer" },
      { ownership_percent: 150 },
      "Pat",
    ] })).toEqual({ owners_officers: [
      { name: "Dana Reyes", title: "President", ownership_percent: 60, duties: "Runs sales; no field work", covered: false },
      { name: "Sam Okafor", ownership_percent: 12.5, covered: true },
      { name: "Lee Park" },
      { title: "Treasurer" },
    ] });
  });

  it("keeps a share to two decimal places, and stops at 20 people", () => {
    expect(sanitizeChamberPatch({ owners_officers: [{ name: "A", ownership_percent: 33.3333 }] }).owners_officers).toEqual([{ name: "A", ownership_percent: 33.33 }]);
    expect(sanitizeChamberPatch({ owners_officers: Array.from({ length: 25 }, (_, i) => ({ name: `Owner ${i}` })) }).owners_officers).toHaveLength(20);
  });

  it("never keeps a Social Security number typed into a name, title or duties", () => {
    const [row] = sanitizeChamberPatch({ owners_officers: [{ name: "Dana Reyes", duties: "Owner, SSN 123-45-6789" }] }).owners_officers!;
    expect(row.duties).toBe("Owner, SSN [redacted]");
  });
});

describe("loss history by year (K-3.3)", () => {
  it("reads each year's figures as people and loss runs write them", () => {
    expect(sanitizeChamberPatch({ loss_history: [
      { policy_year: "2025", carrier: " Pinnacle Mutual ", premium: "$18,400", experience_mod: "0.92", claims: "2", paid: "$12,500.40", reserved: 4000, valuation_date: "9/30/2026" },
      { policy_year: 2024, claims: 0, paid: 0, reserved: 0 },
      { policy_year: 2023, no_coverage: "yes" },
      { policy_year: "last year", premium: "a lot", claims: -1 },
      { carrier: "Pinnacle Mutual" },
    ] })).toEqual({ loss_history: [
      { policy_year: 2025, carrier: "Pinnacle Mutual", premium: 18400, experience_mod: 0.92, claims: 2, paid: 12500, reserved: 4000, valuation_date: "9/30/2026" },
      // No claims is an answer: the zeros are kept.
      { policy_year: 2024, claims: 0, paid: 0, reserved: 0 },
      // So is no prior coverage.
      { policy_year: 2023, no_coverage: true },
      { carrier: "Pinnacle Mutual" },
    ] });
  });

  it("stops at five years", () => {
    expect(sanitizeChamberPatch({ loss_history: Array.from({ length: 8 }, (_, i) => ({ policy_year: 2018 + i })) }).loss_history).toHaveLength(5);
  });
});

describe("current medical plans (K-4.1)", () => {
  it("reads each plan's monthly rates as invoices print them, to the cent", () => {
    expect(sanitizeChamberPatch({ medical_plans: [
      { name: " Gold PPO 500 ", carrier: "Blue Shield", rate_ee: "$612.40", rate_ee_sp: "1,286.04", rate_ee_ch: 1102.321, rate_fam: 1837.2, renewal_rate_ee: "$685.89", employer_contribution: "75% of employee-only", enrolled: "14" },
      { name: "Silver HMO", rate_ee: "ask the broker", rate_fam: 2_000_000 },
      { rate_ee: 400 },
      { deductible: 500 },
    ] })).toEqual({ medical_plans: [
      { name: "Gold PPO 500", carrier: "Blue Shield", rate_ee: 612.4, rate_ee_sp: 1286.04, rate_ee_ch: 1102.32, rate_fam: 1837.2, renewal_rate_ee: 685.89, employer_contribution: "75% of employee-only", enrolled: 14 },
      { name: "Silver HMO" },
      { rate_ee: 400 },
    ] });
    expect(sanitizeChamberPatch({ medical_plans: Array.from({ length: 30 }, (_, i) => ({ name: `Plan ${i}` })) }).medical_plans).toHaveLength(20);
  });
});

describe("state unemployment rates (K-4.2)", () => {
  it("reads each state's rate as a rate notice prints it, and keeps one rate per state", () => {
    expect(sanitizeChamberPatch({ suta_rates: [
      { state: "ca", rate: "3.4%", year: "2026" },
      { state: "TX", rate: 2.7 },
      // A second rate for a state already listed is dropped: one rate per state.
      { state: "CA", rate: 9.9 },
      { state: "Atlantis", rate: 1 },
      { state: "NY", rate: "low" },
      { rate: 2 },
    ] })).toEqual({ suta_rates: [{ state: "CA", rate: 3.4, year: 2026 }, { state: "TX", rate: 2.7 }, { rate: 1 }, { state: "NY" }, { rate: 2 }] });
  });

  it("keeps a rate to four decimal places, which state notices print", () => {
    expect(sanitizeChamberPatch({ suta_rates: [{ state: "NJ", rate: "2.68125" }] }).suta_rates).toEqual([{ state: "NJ", rate: 2.6813 }]);
  });
});

// A TypeScript copy of the server's rules (public.chamber_data_error), used to prove that whatever
// the sanitiser emits is accepted. The SQL tests prove the same against the real function.
function serverRefusal(d: unknown): string | null {
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  const isText = (v: unknown, max: number): v is string => typeof v === "string" && [...v].length <= max && !v.includes("\u0000");
  const isCount = (v: unknown, max: number) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
  const isState = (v: unknown) => typeof v === "string" && US_STATE_CODES.includes(v);
  if (!isObj(d)) return "chamber_data";
  const kinds: Record<string, string> = {};
  for (const k of ["company_name", "industry", "start_month", "current_carrier", "renewal_date", "rate_history", "benefits_waiting_period", "retirement_type", "payroll_vendor", "pay_frequency", "accrual_method", "handbook_last_updated", "hris_system", "key_challenges", "business_goals", "wc_carrier", "wc_renewal_date"]) kinds[k] = "text";
  for (const k of ["employee_count", "fein_count", "funding_days", "nonexempt_count", "exempt_count", "hr_staff_count"]) kinds[k] = "count";
  for (const k of ["multiple_entities", "virgin_medical", "has_401k", "employer_contributes", "has_nonexempt", "has_handbook", "has_1099", "ca_contractors", "uses_physical_clocks", "uses_mobile_app", "uses_computer_timekeeping", "shift_differentials"]) kinds[k] = "bool";
  for (const k of ["street_address", "website", "operations_description", "current_peo", "peo_renewal_date"]) kinds[k] = "text";
  kinds.in_peo = "bool";
  kinds.naics_code = "naics";
  for (const [k, kind] of [["hq_state", "state"], ["states", "states"], ["ancillary_benefits", "list"], ["pto_types", "list"], ["employees", "employees"], ["census", "census"], ["wc_experience_mod", "experience_mod"], ["wc_annual_premium", "dollars"]]) kinds[k] = kind;
  // New in v3: the scalar kinds public.chamber_data_scalar_reason checks, and the lists of rows.
  for (const [k, kind] of [["fein", "fein"], ["entity_type", "entity_type"], ["year_founded", "year"], ["entities", "rows"], ["owners_officers", "rows"], ["loss_history", "rows"], ["medical_plans", "rows"], ["suta_rates", "rows"]]) kinds[k] = kind;
  const scalarOk = (kind: string, v: unknown): boolean => {
    switch (kind) {
      case "text": return isText(v, TEXT_MAX);
      case "fein": return typeof v === "string" && /^[0-9]{9}$/.test(v);
      case "naics": return typeof v === "string" && /^[0-9]{6}$/.test(v);
      case "entity_type": return typeof v === "string" && ["sole_proprietorship", "partnership", "llc", "c_corporation", "s_corporation", "nonprofit", "other"].includes(v);
      case "year": return isCount(v, YEAR_MAX) && (v as number) >= YEAR_MIN;
      case "name": return isText(v, NAME_MAX);
      case "percent": return typeof v === "number" && v >= 0 && v <= 100;
      case "boolean": return typeof v === "boolean";
      case "count": return isCount(v, COUNT_MAX);
      case "money": return typeof v === "number" && v >= 0 && v <= 1_000_000;
      case "state": return isState(v);
      case "dollars": return isCount(v, DOLLARS_MAX);
      case "experience_mod": return typeof v === "number" && v >= 0 && v <= EXPERIENCE_MOD_MAX;
      default: return false;
    }
  };
  const rowLists: Record<string, { max: number; keys: Record<string, string> }> = {
    entities: { max: MAX_ENTITIES, keys: { legal_name: "text", fein: "fein" } },
    loss_history: { max: 5, keys: { policy_year: "year", carrier: "name", premium: "dollars", experience_mod: "experience_mod", claims: "count", paid: "dollars", reserved: "dollars", valuation_date: "name", no_coverage: "boolean" } },
    medical_plans: { max: 20, keys: { name: "name", carrier: "name", employer_contribution: "name", enrolled: "count", ...Object.fromEntries(["rate_ee", "rate_ee_sp", "rate_ee_ch", "rate_fam", "renewal_rate_ee", "renewal_rate_ee_sp", "renewal_rate_ee_ch", "renewal_rate_fam"].map((k) => [k, "money"])) } },
    suta_rates: { max: 60, keys: { state: "state", rate: "percent", year: "year" } },
    owners_officers: { max: 20, keys: { name: "name", title: "name", ownership_percent: "percent", duties: "text", covered: "boolean" } },
  };
  for (const [k, v] of Object.entries(d)) {
    switch (kinds[k]) {
      case "text": if (v !== null && !isText(v, TEXT_MAX)) return k; break;
      case "fein": case "entity_type": case "year": case "naics": if (v !== null && !scalarOk(kinds[k], v)) return k; break;
      case "rows": {
        const list = rowLists[k];
        if (!Array.isArray(v) || v.length > list.max) return k;
        for (const [i, row] of v.entries()) {
          if (!isObj(row)) return `${k}[${i}]`;
          for (const [rk, rv] of Object.entries(row)) if (!(rk in list.keys) || !scalarOk(list.keys[rk], rv)) return `${k}[${i}].${rk}`;
        }
        break;
      }
      case "count": if (v !== null && !isCount(v, COUNT_MAX)) return k; break;
      case "experience_mod": if (v !== null && !(typeof v === "number" && v >= 0 && v <= EXPERIENCE_MOD_MAX)) return k; break;
      case "dollars": if (v !== null && !isCount(v, DOLLARS_MAX)) return k; break;
      case "bool": if (v !== null && typeof v !== "boolean") return k; break;
      case "state": if (v !== null && !isState(v)) return k; break;
      case "states":
        if (!Array.isArray(v) || v.length > MAX_STATES) return k;
        for (const [i, el] of v.entries()) if (!isState(el)) return `${k}[${i}]`;
        break;
      case "list":
        if (!Array.isArray(v) || v.length > MAX_LIST_ITEMS) return k;
        for (const [i, el] of v.entries()) if (!isText(el, TEXT_MAX)) return `${k}[${i}]`;
        break;
      case "employees": {
        if (!Array.isArray(v) || v.length > MAX_EMPLOYEES) return k;
        for (const [i, e] of v.entries()) {
          const at = `employees[${i}]`;
          if (!isObj(e)) return at;
          if (!isText(e.first_name, TEXT_MAX) || e.first_name.trim() === "") return `${at}.first_name`;
          for (const [f, max] of [["last_name", 200], ["title", 200], ["dob", 40]] as const) if (f in e && !isText(e[f], max)) return `${at}.${f}`;
          if ("state" in e && !(e.state === "" || isState(e.state))) return `${at}.state`;
          if ("salary" in e && e.salary !== null && !isCount(e.salary, SALARY_MAX)) return `${at}.salary`;
          if ("classification" in e && e.classification !== "W2" && e.classification !== "1099") return `${at}.classification`;
          if ("dependents" in e) {
            const deps = e.dependents;
            if (!Array.isArray(deps) || deps.length > MAX_DEPENDENTS) return `${at}.dependents`;
            for (const [j, dep] of deps.entries()) {
              const dat = `${at}.dependents[${j}]`;
              if (!isObj(dep)) return dat;
              if (!isText(dep.first_name, TEXT_MAX) || dep.first_name.trim() === "") return `${dat}.first_name`;
              for (const [f, max] of [["last_name", 200], ["dob", 40]] as const) if (f in dep && !isText(dep[f], max)) return `${dat}.${f}`;
              if ("relationship" in dep && !["spouse", "domestic_partner", "child", "other"].includes(dep.relationship as string)) return `${dat}.relationship`;
            }
          }
        }
        break;
      }
      case "census": {
        if (!Array.isArray(v) || v.length > MAX_EMPLOYEES) return k;
        const oneOf = (x: unknown, list: readonly string[]) => typeof x === "string" && list.includes(x);
        for (const [i, e] of v.entries()) {
          const at = `census[${i}]`;
          if (!isObj(e)) return at;
          if (!isText(e.first_name, TEXT_MAX) || e.first_name.trim() === "") return `${at}.first_name`;
          for (const [f, max] of [["last_name", 200], ["dob", 40]] as const) if (f in e && !isText(e[f], max)) return `${at}.${f}`;
          if ("id" in e && !(isText(e.id, 64) && e.id.trim() !== "")) return `${at}.id`;
          if ("age" in e && !(isCount(e.age, 100) && (e.age as number) >= 14)) return `${at}.age`;
          if ("work_state" in e && !(e.work_state === "" || isState(e.work_state))) return `${at}.work_state`;
          if ("zip_code" in e && !(typeof e.zip_code === "string" && /^[0-9]{5}(-[0-9]{4})?$/.test(e.zip_code))) return `${at}.zip_code`;
          if ("job_title" in e && !isText(e.job_title, NAME_MAX)) return `${at}.job_title`;
          if ("annual_salary" in e && !isCount(e.annual_salary, SALARY_MAX)) return `${at}.annual_salary`;
          if ("compensation_type" in e && !oneOf(e.compensation_type, COMPENSATION_TYPES)) return `${at}.compensation_type`;
          if ("employment_type" in e && !oneOf(e.employment_type, EMPLOYMENT_TYPES)) return `${at}.employment_type`;
          if ("classification" in e && !oneOf(e.classification, CLASSIFICATIONS)) return `${at}.classification`;
          if ("coverage_tier" in e && !oneOf(e.coverage_tier, COVERAGE_TIERS)) return `${at}.coverage_tier`;
          if ("class_code" in e && !(typeof e.class_code === "string" && /^[0-9]{4}$/.test(e.class_code))) return `${at}.class_code`;
          if ("dependents" in e) {
            const deps = e.dependents;
            if (!Array.isArray(deps) || deps.length > MAX_DEPENDENTS) return `${at}.dependents`;
            for (const [j, dep] of deps.entries()) {
              const dat = `${at}.dependents[${j}]`;
              if (!isObj(dep)) return dat;
              if (!isText(dep.first_name, TEXT_MAX) || dep.first_name.trim() === "") return `${dat}.first_name`;
              for (const [f, max] of [["last_name", 200], ["dob", 40]] as const) if (f in dep && !isText(dep[f], max)) return `${dat}.${f}`;
              if ("relationship" in dep && !["spouse", "domestic_partner", "child", "other"].includes(dep.relationship as string)) return `${dat}.relationship`;
            }
          }
        }
        break;
      }
      default: return k;
    }
  }
  return null;
}

describe("sanitiser output the server must accept", () => {
  it("the reference checker refuses what the server refuses", () => {
    expect(serverRefusal({ hq_state: "ZZ" })).toBe("hq_state");
    expect(serverRefusal({ states: ["CA", "ca"] })).toBe("states[1]");
    expect(serverRefusal({ employee_count: 1_000_001 })).toBe("employee_count");
    expect(serverRefusal({ employee_count: "5" })).toBe("employee_count");
    expect(serverRefusal({ employees: [{ first_name: "A", state: "ZZ" }] })).toBe("employees[0].state");
    expect(serverRefusal({ census: [{ first_name: "A", work_state: "ZZ" }] })).toBe("census[0].work_state");
    expect(serverRefusal({ census: [{ first_name: "A", classification: "W2" }] })).toBe("census[0].classification");
    expect(serverRefusal({ census: [{ first_name: "A", annual_salary: 1_000_001 }] })).toBe("census[0].annual_salary");
    expect(serverRefusal({ employees: [{ first_name: "A", dependents: Array.from({ length: 21 }, () => ({ first_name: "D" })) }] })).toBe("employees[0].dependents");
    expect(serverRefusal({ wc_experience_mod: 10.5 })).toBe("wc_experience_mod");
    expect(serverRefusal({ wc_annual_premium: 12.5 })).toBe("wc_annual_premium");
    expect(serverRefusal({ wc_annual_premium: 100_000_001 })).toBe("wc_annual_premium");
    expect(serverRefusal({ extra: 1 })).toBe("extra");
    expect(serverRefusal([])).toBe("chamber_data");
    expect(serverRefusal({})).toBeNull();
  });

  it("accepts the demo data and the empty data", () => {
    expect(serverRefusal(DEMO_CHAMBER_DATA)).toBeNull();
    expect(serverRefusal(EMPTY_CHAMBER_DATA)).toBeNull();
  });

  it("leaves the demo data and the empty data unchanged (they are fixed points)", () => {
    expect(parseChamberData(DEMO_CHAMBER_DATA)).toEqual(DEMO_CHAMBER_DATA);
    expect(parseChamberData(EMPTY_CHAMBER_DATA)).toEqual(EMPTY_CHAMBER_DATA);
    expect(sanitizeChamberPatch(DEMO_CHAMBER_DATA)).toEqual(DEMO_CHAMBER_DATA);
    expect(sanitizeChamberPatch(EMPTY_CHAMBER_DATA)).toEqual(EMPTY_CHAMBER_DATA);
    expect(parseChamberData(parseChamberData(DEMO_CHAMBER_DATA))).toEqual(DEMO_CHAMBER_DATA);
  });

  // Each row is hostile input a client can really hold (model output, voice JSON, a stored row, a roster).
  const bigRoster = Array.from({ length: MAX_EMPLOYEES + 1000 }, (_, i) => ({ first_name: `E${i}`, state: "CA", salary: 1 }));
  const bigCensus = Array.from({ length: MAX_EMPLOYEES + 1000 }, (_, i) => ({ first_name: `E${i}`, work_state: "CA", annual_salary: 1 }));
  const golden: [string, Record<string, unknown>][] = [
    ["empty object", {}],
    ["unlisted and lower-case states", { hq_state: "zz", states: ["ca", "ZZ", "AE", " dc "] }],
    ["every state code", { states: [...US_STATE_CODES, ...US_STATE_CODES] }],
    ["all 676 two-letter pairs", { states: Array.from({ length: 676 }, (_, i) => String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))) }],
    ["counts out of range or not integers", { employee_count: 1_000_001, fein_count: -1, funding_days: 12.5, nonexempt_count: "1e3", exempt_count: "0x10", hr_staff_count: 2 ** 53 }],
    ["numeric text counts", { employee_count: "1,200", funding_days: " 3 ", hr_staff_count: "" }],
    ["booleans as words", { has_401k: "yes", virgin_medical: "true", multiple_entities: 1 }],
    ["limit-length and over-length text", { company_name: "x".repeat(1000), industry: "x".repeat(1001), key_challenges: "😀".repeat(600) }],
    ["control characters", { company_name: "a\u0000b", pay_frequency: "x\ud800y", pto_types: ["\u0000", "ok"] }],
    ["more than 100 list items", { ancillary_benefits: Array.from({ length: 150 }, (_, i) => `b${i}`), pto_types: Array.from({ length: 101 }, (_, i) => `p${i}`).join(",") }],
    ["blank and duplicate list items", { ancillary_benefits: ["", " ", "FSA", "FSA", 5, null] }],
    ["bad employee fields", { employees: [{ first_name: "A", last_name: "x".repeat(201), dob: "x".repeat(41), state: "California", title: "x".repeat(300), salary: 1_000_001, classification: "1099" }] }],
    ["employees that must be dropped", { employees: [{ last_name: "none" }, { first_name: " " }, "garbage", null, 7, { first_name: "A", classification: "Hourly" }, [1]] }],
    ["employee state spellings", { employees: ["ca", " Tx ", "zz", "12", "", null, "W2"].map((state) => ({ first_name: "A", state })) }],
    ["unknown employee and dependent keys", { employees: [{ first_name: "A", nickname: "Al", dependents: [{ first_name: "B", extra: 1 }] }] }],
    ["employees as a string or object", { employees: "A, B" }],
    ["25 dependents", { employees: [{ first_name: "A", dependents: Array.from({ length: 25 }, (_, i) => ({ first_name: `D${i}`, relationship: "kid" })) }] }],
    ["dependents that are not objects", { employees: [{ first_name: "A", dependents: ["x", null, { last_name: "no first" }, { first_name: "B", relationship: "spouse" }] }] }],
    ["more than MAX_EMPLOYEES employees", { employees: bigRoster }],
    ["census rows with bad facts", { census: [{ first_name: "A", last_name: "x".repeat(201), dob: "soon", age: 7, work_state: "California", zip_code: "n/a", job_title: "x".repeat(300), annual_salary: 2_000_000, compensation_type: "weekly", employment_type: "ft", classification: "1099", coverage_tier: "Gold", class_code: "88" }] }],
    ["census rows that must be dropped", { census: [{ last_name: "none" }, { first_name: " " }, "garbage", null, 7, { first_name: "A", classification: "K-1" }, [1]] }],
    ["census state spellings", { census: ["ca", " Tx ", "zz", "12", "", null, "W2", "New York"].map((work_state) => ({ first_name: "A", work_state })) }],
    ["census keys the older roster used", { census: [{ first_name: "A", state: "ca", title: "Dev", salary: "90,000", classification: "W2" }] }],
    ["census ids", { census: [{ id: "x", first_name: "A" }, { id: "x", first_name: "B" }, { id: " ", first_name: "C" }, { id: "y".repeat(100), first_name: "D" }, { id: 7, first_name: "E" }] }],
    ["unknown census keys", { census: [{ first_name: "A", nickname: "Al", dependents: [{ first_name: "B", extra: 1 }] }] }],
    ["census hours and rates", { census: [{ first_name: "A", hourly_rate: "$20", hours_per_week: 20 }, { first_name: "B", hourly_rate: 900 }] }],
    ["more than MAX_EMPLOYEES census rows", { census: bigCensus }],
    ["unknown top-level keys", { reply: "hello", unknown_field: 1, __proto__x: 2 }],
  ];

  it.each(golden)("%s", (_name, raw) => {
    const data = parseChamberData(raw);
    expect(serverRefusal(data)).toBeNull();
    expect(serverRefusal(sanitizeChamberPatch(raw))).toBeNull();
    // merging into valid data, as an extraction is merged, stays valid too
    const merged = applyExtraction({ data: DEMO_CHAMBER_DATA, provenance: {} }, raw, { source: { kind: "transcript", message_id: "m1" } });
    expect(serverRefusal(merged.data)).toBeNull();
    // and the stored form survives a JSON round trip unchanged, so what the server holds is what we sent
    expect(parseChamberData(JSON.parse(JSON.stringify(data)))).toEqual(data);
    // and it is canonical: the intake schema accepts it exactly as it is
    expect(validateChamberData(data)).toEqual([]);
    expect(validateChamberData(sanitizeChamberPatch(raw))).toEqual([]);
  });

  // The schema is the stricter side: whatever it accepts, the server accepts, and whatever the server
  // refuses, the schema refuses.
  it("the intake schema accepts nothing the server refuses", () => {
    const atTheLimits = {
      ...DEMO_CHAMBER_DATA,
      company_name: "😀".repeat(TEXT_MAX),
      states: Array.from({ length: MAX_STATES }, () => "PR"),
      ancillary_benefits: Array.from({ length: MAX_LIST_ITEMS }, () => "x".repeat(TEXT_MAX)),
      employee_count: COUNT_MAX,
      census: Array.from({ length: MAX_EMPLOYEES }, (_, i) => ({
        id: `id-${i}`, first_name: "x".repeat(TEXT_MAX), last_name: "x".repeat(NAME_MAX), dob: "x".repeat(40), age: 100,
        work_state: "", zip_code: "94107-1234", job_title: "x".repeat(NAME_MAX), annual_salary: SALARY_MAX,
        compensation_type: "hourly", employment_type: "part_time", classification: "1099", coverage_tier: "WAIVE", class_code: "0000",
        dependents: Array.from({ length: MAX_DEPENDENTS }, () => ({ first_name: "D", last_name: "", dob: "", relationship: "other" })),
      })).slice(0, 50),
    };
    expect(validateChamberData(atTheLimits)).toEqual([]);
    expect(serverRefusal(atTheLimits)).toBeNull();
    for (const refused of [
      { hq_state: "ZZ" }, { states: ["CA", "ca"] }, { employee_count: 1_000_001 }, { employee_count: "5" },
      { census: [{ first_name: "A", work_state: "ZZ" }] }, { census: [{ first_name: "A", classification: "W2" }] },
      { census: [{ first_name: "A", annual_salary: 1_000_001 }] }, { census: [{ first_name: " " }] }, { extra: 1 }, [],
      { fein: "12-3456789" }, { entity_type: "LLC" }, { year_founded: 1599 }, { entities: [{ dba: "x" }] }, { entities: [{ fein: "1" }] }, { entities: null }, { naics_code: "54143" }, { naics_code: 541430 },
      { medical_plans: [{ rate_ee: 1_000_001 }] }, { medical_plans: [{ rate_ee: "612.40" }] }, { medical_plans: [{ enrolled: 1.5 }] },
      { suta_rates: [{ state: "California" }] }, { suta_rates: [{ rate: 101 }] }, { suta_rates: [{ year: "2026" }] },
      { loss_history: [{ policy_year: 1599 }] }, { loss_history: [{ premium: 1.5 }] }, { loss_history: [{ claims: "2" }] },
      { owners_officers: [{ ownership_percent: 101 }] }, { owners_officers: [{ covered: "yes" }] }, { owners_officers: [{ name: "x".repeat(201) }] },
    ]) {
      expect(serverRefusal(refused), JSON.stringify(refused)).not.toBeNull();
      expect(validateChamberData(refused), JSON.stringify(refused)).not.toEqual([]);
    }
  });

  it("holds across seeded random input", () => {
    let seed = 20261029;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
    const strings = ["", " ", "CA", "ca", " ca ", "California", "ZZ", "AE", "DC", "PR", "12", "1,200", "1e3", "yes", "Acme, Inc.", "x".repeat(41), "x".repeat(201), "x".repeat(1001), "😀".repeat(600), "a\u0000b", "\ud800", "CA, TX, ZZ", "W2", "1099", "contractor", "Hourly", "spouse", "kid", "$18,400", "0.92", "1.126", "$ 1,200.50"];
    const numbers = [0, -1, 0.92, 10, 10.01, 12, 12.5, 999999, 1000000, 1000001, 100000000, 100000001, 2 ** 53, 1e21, null, true, false];
    const junk = [[], {}, [1, 2], { a: 1 }, null, undefined];
    const any = (): unknown => { const r = rnd(); return r < 0.5 ? pick(strings) : r < 0.8 ? pick(numbers) : pick(junk); };
    const maybe = <T,>(f: () => T) => (rnd() < 0.85 ? f() : undefined);
    const dependent = () => ({ first_name: pick(strings), last_name: pick(strings), dob: pick(strings), relationship: pick(strings), extra: any() });
    const employee = () => ({
      first_name: maybe(() => pick(strings)), last_name: maybe(any), dob: maybe(any), state: maybe(any), title: maybe(any),
      salary: maybe(any), classification: maybe(any),
      dependents: maybe(() => (rnd() < 0.3 ? pick(strings) : Array.from({ length: Math.floor(rnd() * 4) }, () => (rnd() < 0.85 ? dependent() : any())))),
    });
    const censusRow = () => ({
      id: maybe(any), first_name: maybe(() => pick(strings)), last_name: maybe(any), full_name: maybe(any), dob: maybe(any), age: maybe(any),
      work_state: maybe(any), zip_code: maybe(any), job_title: maybe(any), annual_salary: maybe(any), hourly_rate: maybe(any),
      hours_per_week: maybe(any), compensation_type: maybe(any), employment_type: maybe(any), classification: maybe(any),
      coverage_tier: maybe(any), class_code: maybe(any),
      dependents: maybe(() => (rnd() < 0.3 ? pick(strings) : Array.from({ length: Math.floor(rnd() * 4) }, () => (rnd() < 0.85 ? dependent() : any())))),
    });
    for (let n = 0; n < 400; n++) {
      const raw: Record<string, unknown> = {};
      // The roster as older browsers and stored rows name it.
      if (rnd() < 0.3) raw.employees = rnd() < 0.15 ? any() : Array.from({ length: Math.floor(rnd() * 6) }, () => (rnd() < 0.9 ? employee() : any()));
      for (const k of Object.keys(EMPTY_CHAMBER_DATA)) {
        if (rnd() < 0.2) continue;
        if (k === "census") raw[k] = rnd() < 0.15 ? any() : Array.from({ length: Math.floor(rnd() * 6) }, () => (rnd() < 0.9 ? (rnd() < 0.3 ? employee() : censusRow()) : any()));
        else if (k === "states" || k === "ancillary_benefits" || k === "pto_types") raw[k] = rnd() < 0.4 ? pick(strings) : Array.from({ length: Math.floor(rnd() * 5) }, any);
        else raw[k] = any();
      }
      const data: ChamberData = parseChamberData(raw);
      expect(serverRefusal(data), JSON.stringify(raw)).toBeNull();
      expect(validateChamberData(data), JSON.stringify(raw)).toEqual([]);
    }
  });
});
