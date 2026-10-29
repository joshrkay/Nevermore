import { describe, expect, it } from "vitest";
import { DEMO_CHAMBER_DATA, EMPTY_CHAMBER_DATA } from "./chamberTypes";
import type { ChamberData } from "./chamberTypes";
import {
  COUNT_MAX,
  MAX_DEPENDENTS,
  MAX_EMPLOYEES,
  MAX_LIST_ITEMS,
  MAX_STATES,
  SALARY_MAX,
  TEXT_MAX,
  US_STATE_CODES,
  mergeChamberData,
  parseChamberData,
  sanitizeChamberPatch,
} from "./chamberValidation";

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

  it("keeps valid employees, fills defaults, and drops nameless ones", () => {
    const patch = sanitizeChamberPatch({
      employees: [
        { first_name: "Ada", state: "ca", dependents: [{ first_name: "Bo", relationship: "kid" }] },
        { last_name: "No first name" },
        "garbage",
      ],
    });
    expect(patch.employees).toEqual([
      {
        first_name: "Ada",
        last_name: "",
        dob: "",
        state: "CA",
        title: "",
        salary: null,
        classification: "W2",
        dependents: [{ first_name: "Bo", last_name: "", dob: "", relationship: "other" }],
      },
    ]);
  });
});

describe("worker classification", () => {
  const classify = (classification: unknown) =>
    sanitizeChamberPatch({ employees: [{ first_name: "Ada", classification }] }).employees?.map((e) => e.classification);

  it("normalizes common spellings", () => {
    expect(classify("w-2")).toEqual(["W2"]);
    expect(classify("Employee")).toEqual(["W2"]);
    expect(classify("1099 Contractor")).toEqual(["1099"]);
    expect(classify("independent_contractor")).toEqual(["1099"]);
    expect(classify("freelancer")).toEqual(["1099"]);
  });

  it("treats a missing label as W-2", () => {
    expect(classify(undefined)).toEqual(["W2"]);
  });

  it("drops workers whose label can't be recognized instead of counting them as W-2", () => {
    expect(classify("K-1 owner")).toEqual([]);
    expect(classify(42)).toEqual([]);
  });
});

describe("mergeChamberData", () => {
  it("merges only validated fields over existing data", () => {
    const prev = { ...EMPTY_CHAMBER_DATA, company_name: "Old", states: ["NY"] };
    const next = mergeChamberData(prev, { states: "not-a-list-of-states", industry: "Design" });
    expect(next.company_name).toBe("Old");
    expect(next.industry).toBe("Design");
    expect(next.states).toEqual([]); // "not-a-list-of-states" has no valid codes
  });
});

describe("parseChamberData", () => {
  it("fills every field from defaults when stored data is malformed", () => {
    expect(parseChamberData(undefined)).toEqual(EMPTY_CHAMBER_DATA);
    expect(parseChamberData({ states: 5, employees: "x" })).toEqual(EMPTY_CHAMBER_DATA);
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

  it("turns an unlisted employee state into blank without dropping the employee", () => {
    const states = (state: unknown) =>
      sanitizeChamberPatch({ employees: [{ first_name: "Ann", state }] }).employees?.map((e) => e.state);
    expect(states("ca")).toEqual(["CA"]);
    expect(states(" tx ")).toEqual(["TX"]);
    expect(states("")).toEqual([""]);
    for (const bad of ["ZZ", "C", "12", "1!", "W2", "AE", "California", null, 5, undefined]) expect(states(bad)).toEqual([""]);
  });
});

describe("caps truncate instead of rejecting", () => {
  const person = (i: number) => ({ first_name: `E${i}`, state: "CA" });

  it("keeps the first MAX_EMPLOYEES employees", () => {
    const out = sanitizeChamberPatch({ employees: Array.from({ length: MAX_EMPLOYEES + 1000 }, (_, i) => person(i)) });
    expect(out.employees).toHaveLength(MAX_EMPLOYEES);
    expect(out.employees?.[0].first_name).toBe("E0");
    expect(out.employees?.at(-1)?.first_name).toBe(`E${MAX_EMPLOYEES - 1}`);
  });

  it("does not let dropped employees use up slots", () => {
    const raw = [...Array.from({ length: 10 }, () => ({ last_name: "no first name" })), ...Array.from({ length: MAX_EMPLOYEES }, (_, i) => person(i))];
    expect(sanitizeChamberPatch({ employees: raw }).employees).toHaveLength(MAX_EMPLOYEES);
  });

  it("keeps the first MAX_DEPENDENTS dependents of an employee", () => {
    const dependents = Array.from({ length: MAX_DEPENDENTS + 5 }, (_, i) => ({ first_name: `D${i}`, relationship: "child" }));
    const [emp] = sanitizeChamberPatch({ employees: [{ first_name: "Ann", dependents }] }).employees ?? [];
    expect(emp.dependents).toHaveLength(MAX_DEPENDENTS);
    expect(emp.dependents.at(-1)?.first_name).toBe(`D${MAX_DEPENDENTS - 1}`);
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
    const salary = (v: unknown) => sanitizeChamberPatch({ employees: [{ first_name: "A", salary: v }] }).employees?.[0].salary;
    expect(salary(SALARY_MAX)).toBe(SALARY_MAX);
    expect(salary(SALARY_MAX + 1)).toBeNull();
    expect(salary(-5)).toBeNull();
    expect(salary("105,000")).toBe(105000);
  });

  it("limits text to TEXT_MAX and employee fields to their own lengths", () => {
    expect(sanitizeChamberPatch({ company_name: "x".repeat(TEXT_MAX) }).company_name).toHaveLength(TEXT_MAX);
    expect(sanitizeChamberPatch({ company_name: "x".repeat(TEXT_MAX + 1) })).toEqual({});
    const [emp] = sanitizeChamberPatch({
      employees: [{ first_name: "A", last_name: "x".repeat(201), title: "x".repeat(201), dob: "x".repeat(41) }],
    }).employees ?? [];
    expect([emp.last_name, emp.title, emp.dob]).toEqual(["", "", ""]);
  });

  it("removes characters Postgres jsonb refuses", () => {
    const out = sanitizeChamberPatch({
      company_name: "Ac\u0000me\ud800",
      pto_types: ["a\udc00b"],
      employees: [{ first_name: "An\u0000n", last_name: "Le\ud83d", dependents: [{ first_name: "B\u0000o" }] }],
    });
    expect(out.company_name).toBe("Acme");
    expect(out.pto_types).toEqual(["ab"]);
    expect(out.employees?.[0]).toMatchObject({ first_name: "Ann", last_name: "Le", dependents: [{ first_name: "Bo" }] });
    expect(JSON.stringify(sanitizeChamberPatch({ company_name: "😀 ok" }))).toContain("😀");
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
  for (const k of ["company_name", "industry", "start_month", "current_carrier", "renewal_date", "rate_history", "benefits_waiting_period", "retirement_type", "payroll_vendor", "pay_frequency", "accrual_method", "handbook_last_updated", "hris_system", "key_challenges", "business_goals"]) kinds[k] = "text";
  for (const k of ["employee_count", "fein_count", "funding_days", "nonexempt_count", "exempt_count", "hr_staff_count"]) kinds[k] = "count";
  for (const k of ["multiple_entities", "virgin_medical", "has_401k", "employer_contributes", "has_nonexempt", "has_handbook", "has_1099", "ca_contractors", "uses_physical_clocks", "uses_mobile_app", "uses_computer_timekeeping", "shift_differentials"]) kinds[k] = "bool";
  for (const [k, kind] of [["hq_state", "state"], ["states", "states"], ["ancillary_benefits", "list"], ["pto_types", "list"], ["employees", "employees"]]) kinds[k] = kind;
  for (const [k, v] of Object.entries(d)) {
    switch (kinds[k]) {
      case "text": if (v !== null && !isText(v, TEXT_MAX)) return k; break;
      case "count": if (v !== null && !isCount(v, COUNT_MAX)) return k; break;
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
    expect(serverRefusal({ employees: [{ first_name: "A", dependents: Array.from({ length: 21 }, () => ({ first_name: "D" })) }] })).toBe("employees[0].dependents");
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
    ["unknown top-level keys", { reply: "hello", unknown_field: 1, __proto__x: 2 }],
  ];

  it.each(golden)("%s", (_name, raw) => {
    const data = parseChamberData(raw);
    expect(serverRefusal(data)).toBeNull();
    expect(serverRefusal(sanitizeChamberPatch(raw))).toBeNull();
    // merging into valid data stays valid too
    expect(serverRefusal(mergeChamberData(DEMO_CHAMBER_DATA, raw))).toBeNull();
    // and the stored form survives a JSON round trip unchanged, so what the server holds is what we sent
    expect(parseChamberData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it("holds across seeded random input", () => {
    let seed = 20261029;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
    const strings = ["", " ", "CA", "ca", " ca ", "California", "ZZ", "AE", "DC", "PR", "12", "1,200", "1e3", "yes", "Acme, Inc.", "x".repeat(41), "x".repeat(201), "x".repeat(1001), "😀".repeat(600), "a\u0000b", "\ud800", "CA, TX, ZZ", "W2", "1099", "contractor", "Hourly", "spouse", "kid"];
    const numbers = [0, -1, 12, 12.5, 999999, 1000000, 1000001, 2 ** 53, 1e21, null, true, false];
    const junk = [[], {}, [1, 2], { a: 1 }, null, undefined];
    const any = (): unknown => { const r = rnd(); return r < 0.5 ? pick(strings) : r < 0.8 ? pick(numbers) : pick(junk); };
    const maybe = <T,>(f: () => T) => (rnd() < 0.85 ? f() : undefined);
    const dependent = () => ({ first_name: pick(strings), last_name: pick(strings), dob: pick(strings), relationship: pick(strings), extra: any() });
    const employee = () => ({
      first_name: maybe(() => pick(strings)), last_name: maybe(any), dob: maybe(any), state: maybe(any), title: maybe(any),
      salary: maybe(any), classification: maybe(any),
      dependents: maybe(() => (rnd() < 0.3 ? pick(strings) : Array.from({ length: Math.floor(rnd() * 4) }, () => (rnd() < 0.85 ? dependent() : any())))),
    });
    for (let n = 0; n < 400; n++) {
      const raw: Record<string, unknown> = {};
      for (const k of Object.keys(EMPTY_CHAMBER_DATA)) {
        if (rnd() < 0.2) continue;
        if (k === "employees") raw[k] = rnd() < 0.15 ? any() : Array.from({ length: Math.floor(rnd() * 6) }, () => (rnd() < 0.9 ? employee() : any()));
        else if (k === "states" || k === "ancillary_benefits" || k === "pto_types") raw[k] = rnd() < 0.4 ? pick(strings) : Array.from({ length: Math.floor(rnd() * 5) }, any);
        else raw[k] = any();
      }
      const data: ChamberData = parseChamberData(raw);
      expect(serverRefusal(data), JSON.stringify(raw)).toBeNull();
    }
  });
});
