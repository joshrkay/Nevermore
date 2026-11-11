import { describe, expect, it } from "vitest";
import { emptyExtraction, MAX_UNKNOWN_PER_MESSAGE, quotesMessage, saysNotKnown, shapeExtraction } from "./extraction";
import { INTAKE_SCHEMA, LIMITS } from "../_shared/intakeSchema";
import { EXTRACT_TOOL, FIELD_GUIDE,
  FIELD_QUESTION, FIELDS, MAX_EVIDENCE_CHARS, PROMPT_VERSION, SYSTEM_PROMPT } from "./schema";

// Most cases are about the arguments, not the message: evidence is checked against `message` where it matters.
const shape = (args: Record<string, unknown>, message = "") => shapeExtraction(args, message);

describe("shapeExtraction", () => {
  it("keeps the fields the model extracted, with their status, evidence and corrections", () => {
    const shaped = shape({
      employee_count: 45,
      states: ["CA", "TX"],
      field_status: { employee_count: "confirmed", states: "incomplete" },
      evidence: { employee_count: "actually it's 45", states: "mainly CA and TX" },
      corrected_fields: ["employee_count"],
      reply: "Thank you.",
    }, "Actually it's 45 people now, mainly CA and TX.");
    expect(shaped).toEqual({
      extracted: { employee_count: 45, states: ["CA", "TX"] },
      field_status: { employee_count: "confirmed", states: "incomplete" },
      evidence: { employee_count: "actually it's 45", states: "mainly CA and TX" },
      corrected_fields: ["employee_count"],
      reply: "Thank you.",
      rejected: [],
      prompt_version: PROMPT_VERSION,
      stopping: false,
      doubted_unknown: [],
    });
  });

  // Strict: a value the intake schema refuses is not repaired and not passed on. The browser would
  // otherwise have to guess, and the database would refuse the save.
  it("refuses a value the intake schema doesn't accept as sent, and says which and why", () => {
    const shaped = shape({
      company_name: "Acme",
      hq_state: "ca",
      states: ["CA", "XX"],
      employee_count: 12.5,
      has_401k: "yes",
      key_challenges: "x".repeat(1001),
      field_status: { company_name: "confirmed", hq_state: "confirmed", states: "confirmed" },
      evidence: { hq_state: "in california" },
      corrected_fields: ["hq_state"],
    });
    expect(shaped.extracted).toEqual({ company_name: "Acme" });
    expect(shaped.field_status).toEqual({ company_name: "confirmed" });
    expect(shaped.evidence).toEqual({});
    expect(shaped.corrected_fields).toEqual([]);
    expect(shaped.rejected.map((issue) => issue.path)).toEqual(["hq_state", "states[1]", "employee_count", "has_401k", "key_challenges"]);
    expect(shaped.rejected.find((issue) => issue.path === "key_challenges")?.reason).toBe("must be at most 1000 characters");
  });

  it("keeps answers beyond the company profile: entities, benefits, payroll, HR and timekeeping", () => {
    const answers = {
      multiple_entities: true,
      fein_count: 2,
      rate_history: "up 12% last year",
      benefits_waiting_period: "30 days",
      ancillary_benefits: ["Dental", "Vision"],
      retirement_type: "SIMPLE IRA",
      employer_contributes: false,
      funding_days: 2,
      has_nonexempt: true,
      nonexempt_count: 8,
      exempt_count: 0,
      pto_types: ["Vacation", "Sick"],
      accrual_method: "per pay period",
      handbook_last_updated: "2024",
      hr_staff_count: 1,
      uses_physical_clocks: false,
      uses_mobile_app: true,
      uses_computer_timekeeping: true,
      shift_differentials: false,
      hris_system: "Thistledown HR",
    };
    expect(shapeExtraction(answers)).toMatchObject({ extracted: answers, rejected: [] });
  });

  it("refuses a count that isn't a whole number of 0 or more, and a list sent as one string", () => {
    const shaped = shape({ fein_count: -1, ancillary_benefits: "Dental, Vision", funding_days: 2.5, uses_mobile_app: "yes", hris_system: "Thistledown HR" });
    expect(shaped.extracted).toEqual({ hris_system: "Thistledown HR" });
    expect(shaped.rejected.map((issue) => issue.path)).toEqual(["fein_count", "ancillary_benefits", "funding_days", "uses_mobile_app"]);
  });

  it("never echoes a refused value in its reasons", () => {
    const { rejected } = shape({ hq_state: "Secret Street 12", employee_count: "forty" });
    expect(JSON.stringify(rejected)).not.toMatch(/Secret|forty/);
  });

  it("drops fields we don't collect, and null or empty values", () => {
    const { extracted } = shape({ company_name: "Acme", ssn: "123-45-6789", industry: "", hq_state: null, key_challenges: undefined });
    expect(extracted).toEqual({ company_name: "Acme" });
  });

  it("keeps a false or zero answer: those are answers, not blanks", () => {
    const { extracted } = shape({ virgin_medical: false, employee_count: 0, has_401k: false });
    expect(extracted).toEqual({ virgin_medical: false, employee_count: 0, has_401k: false });
  });

  it("keeps a status, evidence or correction only for a field that was extracted", () => {
    const shaped = shape({
      company_name: "Acme",
      field_status: { company_name: "confirmed", industry: "confirmed" },
      evidence: { company_name: "we are Acme", industry: "retail" },
      corrected_fields: ["company_name", "industry"],
    }, "We are Acme, in retail.");
    expect(shaped.field_status).toEqual({ company_name: "confirmed" });
    expect(shaped.evidence).toEqual({ company_name: "we are Acme" });
    expect(shaped.corrected_fields).toEqual(["company_name"]);
  });

  it("refuses a status the client doesn't know", () => {
    const { field_status } = shape({ company_name: "Acme", field_status: { company_name: "certain" } });
    expect(field_status).toEqual({});
  });

  it("trims evidence, caps its length, and drops a blank quote", () => {
    const long = "x".repeat(MAX_EVIDENCE_CHARS + 50);
    const { evidence } = shape({
      company_name: "Acme",
      industry: "Retail",
      hq_state: "CA",
      evidence: { company_name: `  ${long}  `, industry: "   ", hq_state: " in California " },
    }, `${long} in California`);
    expect(evidence.company_name).toHaveLength(MAX_EVIDENCE_CHARS);
    expect(evidence).not.toHaveProperty("industry");
    expect(evidence.hq_state).toBe("in California");
  });

  it("ignores status, evidence and corrections that aren't the shape we asked for", () => {
    const shaped = shape({ company_name: "Acme", field_status: "confirmed", evidence: ["a quote"], corrected_fields: "company_name" });
    expect(shaped).toMatchObject({ field_status: {}, evidence: {}, corrected_fields: [] });
  });

  it("stamps the contract version, whatever the model sent for it", () => {
    expect(shape({ company_name: "Acme" }).prompt_version).toBe(PROMPT_VERSION);
    expect(shape({ company_name: "Acme", prompt_version: "1999-01-01.1" }).prompt_version).toBe(PROMPT_VERSION);
  });

  it("returns no reply when the model sent none or a blank or non-text one", () => {
    expect(shape({ company_name: "Acme" }).reply).toBeNull();
    expect(shape({ reply: "   " }).reply).toBeNull();
    expect(shape({ reply: 42 }).reply).toBeNull();
  });
});

// QA F11 and F4: a quote stands only as the prospect's own words, and "unknown" only on their words of not knowing.
describe("shapeExtraction: evidence and unknown fields", () => {
  const QA_MESSAGE = "Bi-weekly. We have 12 employees, all paid hourly, and we use a small local payroll provider.";

  it("drops a quote that isn't the prospect's own words, keeping the answer", () => {
    const shaped = shape(
      { company_name: "Acme", industry: "Retail", field_status: { company_name: "confirmed", industry: "inferred" }, evidence: { company_name: "We're Acme", industry: "they run a shop" } },
      "We\u2019re  ACME, and we sell shoes.",
    );
    expect(shaped.extracted).toEqual({ company_name: "Acme", industry: "Retail" });
    expect(shaped.evidence).toEqual({ company_name: "We're Acme" });
  });

  it("reads a quote as the message's whatever its case, curly quotes, spacing, end punctuation or ellipsis", () => {
    const said = "Honestly? We\u2019re  in CA,   mainly. A few others too!";
    expect(quotesMessage("we're in ca", said)).toBe(true);
    expect(quotesMessage("\u201cWe're in CA, mainly.\u201d", said)).toBe(true);
    expect(quotesMessage("in CA ... a few others too", said)).toBe(true);
    expect(quotesMessage("in CA \u2026 several others", said)).toBe(false);
    expect(quotesMessage("in Oregon", said)).toBe(false);
    expect(quotesMessage(" ... ", said)).toBe(false);
  });

  it("marks nothing unknown that the message doesn't say the prospect doesn't know (the QA conversation)", () => {
    const untouched = ["fein_count", "start_month", "current_carrier", "renewal_date", "funding_days", "hris_system"];
    const args = {
      pay_frequency: "bi-weekly",
      employee_count: 12,
      has_nonexempt: true,
      field_status: { pay_frequency: "confirmed", employee_count: "confirmed", has_nonexempt: "inferred", ...Object.fromEntries(untouched.map((f) => [f, "unknown"])) },
    };
    // With no quote, with the whole message as the quote, and with a quote the message doesn't hold.
    for (const evidence of [{}, Object.fromEntries(untouched.map((f) => [f, QA_MESSAGE])), Object.fromEntries(untouched.map((f) => [f, "I don't know"]))]) {
      const shaped = shape({ ...args, evidence }, QA_MESSAGE);
      expect(shaped.field_status).toEqual({ pay_frequency: "confirmed", employee_count: "confirmed", has_nonexempt: "inferred" });
      expect(shaped.doubted_unknown).toEqual(untouched);
      for (const f of untouched) expect(shaped.evidence).not.toHaveProperty(f);
    }
  });

  it("keeps an unknown whose quote is the prospect saying they don't know", () => {
    const shaped = shape(
      { field_status: { funding_days: "unknown", fein_count: "unknown" }, evidence: { funding_days: "I'd have to check with our bookkeeper", fein_count: "Bi-weekly" } },
      "Bi-weekly. I'd have to check with our bookkeeper on the funding.",
    );
    expect(shaped.field_status).toEqual({ funding_days: "unknown" });
    expect(shaped.doubted_unknown).toEqual(["fein_count"]);
  });

  it.each([
    ["I don't know", true], ["no idea", true], ["not sure yet", true], ["dunno", true], ["Nope, can't say", true], ["let me check", true],
    ["I'll find out", true], ["beats me", true], ["haven't a clue", true], ["I'd have to ask our bookkeeper", true], ["I'll double-check", true],
    ["I don't have it handy", true], ["not off the top of my head", true], ["we haven't decided", true],
    ["Bi-weekly", false], ["We have 12 employees", false], ["we use a small local payroll provider", false], ["Larkspur Plumbing", false],
    // Answers that hold a bare "no", "none", "not", "check" or "ask" (code review: these settled every field).
    ["all paid hourly, no contractors", false], ["none of them salaried", false], ["no union", false], ["not counting the owners", false],
    ["We pay by check every two weeks", false], ["ask about our benefits later", false],
  ])("reads %j as not knowing: %s", (quote, expected) => {
    expect(saysNotKnown(quote)).toBe(expected);
  });

  // More than a section's worth of "unknown" in one message is the model marking fields wholesale (QA F4).
  it("keeps at most a section's worth of unknowns from one message, and past that only the field Lenore was asking about", () => {
    const fields = ["funding_days", "fein_count", "start_month", "current_carrier", "renewal_date", "hris_system"];
    const args = { field_status: Object.fromEntries(fields.map((f) => [f, "unknown"])), evidence: Object.fromEntries(fields.map((f) => [f, "No idea, sorry"])) };
    const asked = shape(args, "No idea, sorry.");
    expect(shapeExtraction(args, "No idea, sorry.", "funding_days").field_status).toEqual({ funding_days: "unknown" });
    expect(asked.field_status).toEqual({});
    expect(asked.doubted_unknown).toEqual(fields);
    const wc = ["wc_carrier", "wc_renewal_date", "wc_experience_mod", "wc_annual_premium"];
    expect(wc).toHaveLength(MAX_UNKNOWN_PER_MESSAGE);
    const section = shape(
      { field_status: Object.fromEntries(wc.map((f) => [f, "unknown"])), evidence: Object.fromEntries(wc.map((f) => [f, "no idea about any of our workers' comp"])) },
      "Honestly, no idea about any of our workers' comp.",
    );
    expect(Object.keys(section.field_status)).toEqual(wc);
  });

  it("says the prospect is stopping only when the model says so outright", () => {
    expect(shape({ prospect_stopping: true }).stopping).toBe(true);
    expect(shape({ prospect_stopping: "true" }).stopping).toBe(false);
    expect(shape({}).stopping).toBe(false);
  });
});

describe("emptyExtraction", () => {
  it("is nothing extracted and no reply, so the browser falls back to its own line, under the current contract version", () => {
    expect(emptyExtraction()).toEqual({
      extracted: {},
      field_status: {},
      evidence: {},
      corrected_fields: [],
      reply: null,
      rejected: [],
      prompt_version: PROMPT_VERSION,
      stopping: false,
      doubted_unknown: [],
    });
  });

  it("hands out a fresh object each time", () => {
    const first = emptyExtraction();
    first.extracted.company_name = "Acme";
    expect(emptyExtraction().extracted).toEqual({});
  });
});

// The prompt and the tool schema once existed in two diverged copies (one in the handler, one
// here) and the function shipped with the thinner one. These keep the contract in one place.
describe("extraction tool schema", () => {
  const properties = EXTRACT_TOOL.parameters.properties as Record<string, { properties?: Record<string, unknown> }>;

  it("asks for every field, plus a status and an evidence quote for each, the corrections and a reply", () => {
    for (const field of FIELDS) expect(properties).toHaveProperty(field);
    expect(Object.keys(properties.field_status.properties ?? {})).toEqual(FIELDS);
    expect(Object.keys(properties.evidence.properties ?? {})).toEqual(FIELDS);
    expect(properties).toHaveProperty("corrected_fields");
    expect(properties).toHaveProperty("reply");
  });

  // A field the tool asks for with no definition leaves the model to guess what it means.
  it("defines every field it asks for in the system prompt", () => {
    const defined = new Set([...SYSTEM_PROMPT.matchAll(/^- (\w+) \([^)]*\): \S/gm)].map((m) => m[1]));
    expect(FIELDS.filter((field) => !defined.has(field))).toEqual([]);
  });

  // Each line reads "- key (Label): what it means".
  const definition = (field: string) => SYSTEM_PROMPT.match(new RegExp(`^- ${field} \\([^)]*\\): (.*)$`, "m"))?.[1] ?? "";

  // The workspace labels has_401k "Retirement plan", and shows the plan type and match only while it is true.
  it("defines has_401k as any retirement plan, not only a 401(k)", () => {
    expect(definition("has_401k")).toMatch(/any .*retirement plan/i);
  });

  // The workspace shows each of these only beside its flag (the FEIN count while multiple_entities is true,
  // the plan type and match while has_401k is, the counts once has_nonexempt is answered), so one sent alone is hidden.
  it("asks for the flag with each answer the workspace only shows beside it", () => {
    const flags = { fein_count: "multiple_entities", retirement_type: "has_401k", employer_contributes: "has_401k", nonexempt_count: "has_nonexempt", exempt_count: "has_nonexempt" };
    for (const [field, flag] of Object.entries(flags)) expect(definition(field), field).toContain(`report ${flag}`);
  });

  // Intake schema v1 refuses a value past its caps, so the prompt states them.
  it("states intake schema v1's caps on counts, text and lists", () => {
    expect(SYSTEM_PROMPT).toContain(`whole numbers from 0 to ${LIMITS.count.toLocaleString("en-US")}`);
    expect(SYSTEM_PROMPT).toContain(`at most ${LIMITS.text.toLocaleString("en-US")} characters`);
    expect(SYSTEM_PROMPT).toContain(`at most ${LIMITS.listItems} items`);
  });

  it("tells the model how to report status, evidence and corrections", () => {
    for (const word of ["field_status", "evidence", "corrected_fields"]) expect(SYSTEM_PROMPT).toContain(word);
    expect(SYSTEM_PROMPT).toContain(`at most ${MAX_EVIDENCE_CHARS} characters`);
  });

  // US-2.3d (D21): the roster comes only from a file, so whenever it comes up Lenore points to the template.
  it("has Lenore point to the census template whenever the roster comes up, and never ask for SSNs or bank numbers", () => {
    const replyRules = SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf("How Lenore replies"));
    const rule = replyRules.split("\n").find((line) => line.startsWith("- Whenever the prospect brings up their employees")) ?? "";
    expect(rule).toContain("census template on the Upload tab");
    expect(rule).toMatch(/roster or census, or starts listing employees/);
    expect(rule).toContain("instead of taking the details in chat");
    expect(rule).toContain("Never ask for Social Security or bank numbers");
    // The invitation when no census is in names the template too.
    expect(replyRules).toMatch(/When no employee census is uploaded[^\n]*census template[^\n]*Upload tab/);
  });
});

// K-1.1: the FEIN goes in the workspace, so Lenore is told how to handle it in the conversation.
describe("how Lenore handles answers entered in the workspace", () => {
  const replyRules = SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf("How Lenore replies"));
  const rule = (start: string) => replyRules.split("\n").find((l) => l.startsWith(start)) ?? "";

  it("never asks for them, and says where each goes once nothing else is left to ask", () => {
    expect(rule("- Never ask for an answer named in \"Entered in the workspace\"")).toMatch(/When "Not yet settled" is "none" and "Entered in the workspace" names any, end the wrap-up by saying where each one goes/);
  });

  it("sends a FEIN the prospect offers in chat to the FEIN box on the Company tab, and never repeats or keeps it", () => {
    const fein = rule("- When the prospect gives or offers their FEIN");
    expect(fein).toContain("FEIN box on the Company tab");
    expect(fein).toMatch(/never repeat the number/);
  });

  it("has Lenore say their advisor asked about a workspace answer, and where to check it", () => {
    expect(rule("- An entry in \"Entered in the workspace\" marked \"[your advisor asked]\"")).toMatch(/say their advisor asked about it and which tab it is on/);
  });

  it("tells the model never to extract a FEIN", () => {
    expect(SYSTEM_PROMPT).toContain("Never extract a federal employer identification number (FEIN or EIN)");
  });
});

// US-2.1b: the contract covers every top-level field of the intake schema that the conversation can take: not the
// census (a file) and not the FEIN or the legal entities' FEINs (typed into the workspace, K-1.1).
describe("the extraction contract", () => {
  const PROPERTIES = INTAKE_SCHEMA.properties as Record<string, { type: unknown; enum?: unknown[]; minimum?: number }>;
  const FROM_CHAT = Object.keys(PROPERTIES).filter((k) => !["census", "fein", "entities"].includes(k));
  // A value the schema accepts for each kind of field, as the model would send it.
  const sample = (key: string): unknown => {
    if (key === "hq_state") return "NY";
    if (key === "states") return ["NY", "NJ"];
    if (key === "naics_code") return "541430";
    const types = Array.isArray(PROPERTIES[key].type) ? (PROPERTIES[key].type as string[]) : [PROPERTIES[key].type as string];
    // A table of rows: one row holding the list's first key.
    const ref = (PROPERTIES[key] as { items?: { $ref?: string } }).items?.$ref;
    if (ref && ref !== "#/$defs/stateCode") {
      const row = (INTAKE_SCHEMA.$defs as Record<string, { properties: Record<string, unknown> }>)[ref.slice("#/$defs/".length)];
      const [name, cell] = Object.entries(row.properties).find(([, each]) => (each as { type?: string }).type === "string")! as [string, { enum?: string[] }];
      return [{ [name]: cell.enum ? cell.enum[0] : "Acme" }];
    }
    if (types.includes("array")) return ["Dental"];
    if (PROPERTIES[key].enum) return PROPERTIES[key].enum![0];
    if (types.includes("boolean")) return false;
    if (types.includes("integer")) return PROPERTIES[key].minimum ?? 0;
    if (types.includes("number")) return 0.92;
    return "Acme";
  };

  it("asks for every field of the intake schema the conversation can take, each with a guide for the model and a type", () => {
    expect([...FIELDS].sort()).toEqual([...FROM_CHAT].sort());
    for (const key of FIELDS) {
      expect(FIELD_GUIDE[key], key).toBeTruthy();
      expect(SYSTEM_PROMPT).toContain(`- ${key} (`);
      expect((EXTRACT_TOOL.parameters.properties as Record<string, unknown>)[key], key).toBeTruthy();
    }
    expect(Object.keys(FIELD_GUIDE).sort()).toEqual([...FIELDS].sort());
    expect(EXTRACT_TOOL.parameters.properties).not.toHaveProperty("census");
  });

  it("has a question of Lenore's own for every field, for when the model gives no reply", () => {
    for (const key of FIELDS) expect(FIELD_QUESTION[key], key).toMatch(/\?$/);
    expect(Object.keys(FIELD_QUESTION).sort()).toEqual([...FIELDS].sort());
  });

  it("never takes a FEIN from the conversation, the employer's or a legal entity's (K-1.1)", () => {
    expect(EXTRACT_TOOL.parameters.properties).not.toHaveProperty("fein");
    expect(EXTRACT_TOOL.parameters.properties).not.toHaveProperty("entities");
    const shaped = shape({ fein: "841234567", entities: [{ legal_name: "Acme LLC", fein: "841234567" }], company_name: "Acme" }, "Our EIN is 84-1234567, we're Acme.");
    expect(shaped.extracted).toEqual({ company_name: "Acme" });
  });

  // K-1.2: Lenore proposes a NAICS code from the description of operations; the prospect confirms it.
  it("takes a NAICS code the model proposes as inferred, however sure the model says it is", () => {
    const shaped = shape(
      { operations_description: "We design packaging for consumer brands", naics_code: "541430", field_status: { operations_description: "confirmed", naics_code: "confirmed" }, evidence: { naics_code: "design packaging" } },
      "We design packaging for consumer brands.",
    );
    expect(shaped.extracted).toEqual({ operations_description: "We design packaging for consumer brands", naics_code: "541430" });
    expect(shaped.field_status).toEqual({ operations_description: "confirmed", naics_code: "inferred" });
  });

  it("takes a NAICS code as confirmed only when the prospect's own message gives the code", () => {
    const shaped = shape({ naics_code: "541430", field_status: { naics_code: "confirmed" }, evidence: { naics_code: "541430" } }, "Our NAICS code is 541430.");
    expect(shaped.field_status).toEqual({ naics_code: "confirmed" });
  });

  it("refuses a NAICS code that isn't a 2022 industry, so a made-up code never reaches the intake", () => {
    const shaped = shape({ naics_code: "999999", company_name: "Acme", field_status: { naics_code: "inferred" } }, "We're Acme, a design shop.");
    expect(shaped.extracted).toEqual({ company_name: "Acme" });
    expect(shaped.rejected).toEqual([{ path: "naics_code", reason: "is not a 2022 NAICS code" }]);
    expect(shaped.field_status).not.toHaveProperty("naics_code");
  });

  // K-3.1: Lenore doesn't ask for a table row by row, but takes what the prospect volunteers of one.
  it("takes owners and officers the prospect volunteers, as rows of the table's own keys", () => {
    expect((EXTRACT_TOOL.parameters.properties as Record<string, unknown>).owners_officers).toEqual({
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, title: { type: "string" }, ownership_percent: { type: "number" }, duties: { type: "string" }, covered: { type: "boolean" } },
        additionalProperties: false,
      },
    });
    const shaped = shape({ owners_officers: [{ name: "Dana Reyes", ownership_percent: 60, covered: false }], field_status: { owners_officers: "confirmed" } }, "I own 60% and I'm excluded from comp.");
    expect(shaped.extracted).toEqual({ owners_officers: [{ name: "Dana Reyes", ownership_percent: 60, covered: false }] });
    const bad = shape({ owners_officers: [{ name: "Dana Reyes", ownership_percent: "60%" }] }, "I own 60%.");
    expect(bad.extracted).toEqual({});
    expect(bad.rejected).toEqual([{ path: "owners_officers[0].ownership_percent", reason: "must be a number" }]);
  });

  it("offers the model an entity type as one of the listed values", () => {
    expect((EXTRACT_TOOL.parameters.properties as Record<string, unknown>).entity_type).toEqual({
      type: "string", enum: ["sole_proprietorship", "partnership", "llc", "c_corporation", "s_corporation", "nonprofit", "other"],
    });
  });

  // A NAICS code is the one answer that never arrives confirmed unless the message holds it: its own cases are above.
  it.each(FROM_CHAT.filter((k) => k !== "naics_code"))("takes an answer for %s, with its status and evidence", (key) => {
    const value = sample(key);
    const shaped = shape({ [key]: value, field_status: { [key]: "confirmed" }, evidence: { [key]: "as they said" } }, "That's as they said.");
    expect(shaped.extracted).toEqual({ [key]: value });
    expect(shaped.field_status).toEqual({ [key]: "confirmed" });
    expect(shaped.evidence).toEqual({ [key]: "as they said" });
    expect(shaped.rejected).toEqual([]);
  });

  it("never takes the census from chat", () => {
    const shaped = shape({ census: [{ id: "1", first_name: "Ada" }], field_status: { census: "unknown" } });
    expect(shaped.extracted).toEqual({});
    expect(shaped.field_status).toEqual({});
  });

  it("records a field the prospect doesn't know as unknown, with its evidence and no answer", () => {
    const shaped = shape({
      field_status: { wc_experience_mod: "unknown", renewal_date: "unknown" },
      evidence: { wc_experience_mod: "no idea what our mod is", renewal_date: "not sure when it renews" },
      reply: "No matter.",
    }, "Honestly, no idea what our mod is, and I'm not sure when it renews.");
    expect(shaped.extracted).toEqual({});
    expect(shaped.field_status).toEqual({ wc_experience_mod: "unknown", renewal_date: "unknown" });
    expect(shaped.evidence).toEqual({ wc_experience_mod: "no idea what our mod is", renewal_date: "not sure when it renews" });
  });

  it("doesn't call an answer unknown, or a refused answer unknown", () => {
    const shaped = shape({
      employee_count: 12,
      hq_state: "new york",
      field_status: { employee_count: "unknown", hq_state: "unknown", made_up_field: "unknown" },
    });
    // An answer marked unknown keeps the answer, without the contradictory status.
    expect(shaped.extracted).toEqual({ employee_count: 12 });
    expect(shaped.field_status).toEqual({});
    expect(shaped.rejected.map((r) => r.path)).toEqual(["hq_state"]);
  });

  it("never takes conflicting or not applicable from the model: only a disagreement or the prospect sets those", () => {
    const shaped = shape({
      industry: "Print",
      field_status: { industry: "conflicting", hq_state: "not_applicable" },
    });
    expect(shaped.extracted).toEqual({ industry: "Print" });
    expect(shaped.field_status).toEqual({});
  });
});
