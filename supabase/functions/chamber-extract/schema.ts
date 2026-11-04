// The extraction prompt, field list and tool schema, shared by every provider adapter and by the
// handler's response shaping. No imports, so it runs under Deno and Vitest alike.

// Every answer the intake holds except the census, which comes from a document. src/data/schemaSync.test.ts
// holds the keys to ChamberData and each type to the kind the client edits it as.
export const FIELD_TYPES: Record<string, unknown> = {
  company_name: { type: "string" },
  industry: { type: "string" },
  hq_state: { type: "string" },
  states: { type: "array", items: { type: "string" } },
  employee_count: { type: "integer" },
  start_month: { type: "string" },
  multiple_entities: { type: "boolean" },
  fein_count: { type: "integer" },

  virgin_medical: { type: "boolean" },
  current_carrier: { type: "string" },
  renewal_date: { type: "string" },
  rate_history: { type: "string" },
  benefits_waiting_period: { type: "string" },
  ancillary_benefits: { type: "array", items: { type: "string" } },
  has_401k: { type: "boolean" },
  retirement_type: { type: "string" },
  employer_contributes: { type: "boolean" },

  payroll_vendor: { type: "string" },
  pay_frequency: { type: "string" },
  funding_days: { type: "integer" },
  has_nonexempt: { type: "boolean" },
  nonexempt_count: { type: "integer" },
  exempt_count: { type: "integer" },
  pto_types: { type: "array", items: { type: "string" } },
  accrual_method: { type: "string" },

  has_handbook: { type: "boolean" },
  handbook_last_updated: { type: "string" },
  hr_staff_count: { type: "integer" },
  has_1099: { type: "boolean" },
  ca_contractors: { type: "boolean" },
  uses_physical_clocks: { type: "boolean" },
  uses_mobile_app: { type: "boolean" },
  uses_computer_timekeeping: { type: "boolean" },
  shift_differentials: { type: "boolean" },
  hris_system: { type: "string" },
  key_challenges: { type: "string" },
  business_goals: { type: "string" },

  wc_carrier: { type: "string" },
  wc_renewal_date: { type: "string" },
  wc_experience_mod: { type: "number" },
  wc_annual_premium: { type: "integer" },
};
export const FIELDS = Object.keys(FIELD_TYPES);
export const FIELD_STATUSES = ["confirmed", "inferred", "incomplete"];
export const MAX_EVIDENCE_CHARS = 200;
// An answer can carry a value, a status and a quote for every field, plus the reply: well past the
// Anthropic adapter's default cap, which would cut it off. Not part of the contract hash.
export const CHAT_MAX_TOKENS = 8192;

const perField = (schema: unknown) => ({
  type: "object",
  properties: Object.fromEntries(FIELDS.map((f) => [f, schema])),
  additionalProperties: false,
});

// Versions the whole extraction contract: SYSTEM_PROMPT, EXTRACT_TOOL, the user turn (prompt.ts) and the
// response shape. Recorded on every extraction event (US-2.4a), returned with every extraction, and stored
// by the browser on each value's provenance (B-1.4), so a value can be traced to the prompt that produced
// it. Raise it with any change to them: _shared/ai/promptVersion.test.ts fails until you do. See
// "Extraction contract version and eval" in docs/intake-schema.md.
export const PROMPT_VERSION = 2;

export const SYSTEM_PROMPT = `You are a data extraction assistant for an HR/PEO underwriting system.
Given a user message from a business discovery conversation, extract any structured data fields you can identify.

You MUST use the extract_chamber_data tool to return the extracted fields. Only include fields that are clearly stated or strongly implied. Do not guess.

Field definitions:
- company_name: Company or business name
- industry: Industry or business type
- hq_state: Two-letter US state code for headquarters
- states: Array of two-letter state codes where employees work
- employee_count: Total number of employees (integer)
- start_month: Desired benefits start date
- multiple_entities: true if the business is more than one legal entity (separate companies or FEINs), false if it is one
- fein_count: How many FEINs (federal employer ID numbers) the business has (integer); report multiple_entities with it
- virgin_medical: true if they've never had employer-sponsored health insurance, false if switching
- current_carrier: Current insurance carrier name
- renewal_date: Current policy renewal date
- rate_history: How their health insurance rates changed at recent renewals, as they describe it (e.g. "up 12% last year")
- benefits_waiting_period: How long a new hire waits before benefits start (e.g. "30 days")
- ancillary_benefits: Array of benefits they offer besides medical and retirement (e.g. dental, vision, life insurance), one benefit per item
- has_401k: true if they offer any employer retirement plan (a 401(k), 403(b), SIMPLE IRA or similar), false if they offer none
- retirement_type: The kind of retirement plan they offer (e.g. "traditional 401(k)", "SIMPLE IRA"); report has_401k with it
- employer_contributes: true if the employer contributes to or matches the retirement plan, false if it doesn't; report has_401k with it
- payroll_vendor: Current payroll provider
- pay_frequency: How often they run payroll (weekly, bi-weekly, semi-monthly, monthly)
- funding_days: How many days before payday payroll must be funded (integer)
- has_nonexempt: true if any employees are non-exempt (hourly, paid overtime), false if all are exempt (salaried)
- nonexempt_count: Number of non-exempt (hourly, overtime-eligible) employees (integer); report has_nonexempt with it
- exempt_count: Number of exempt (salaried, not overtime-eligible) employees (integer); report has_nonexempt with it
- pto_types: Array of the kinds of paid time off they offer (e.g. vacation, sick, holidays), one kind per item
- accrual_method: How employees earn paid time off (e.g. per pay period, all at the start of the year)
- has_handbook: Whether they have an employee handbook
- handbook_last_updated: When the employee handbook was last updated (e.g. "2024")
- hr_staff_count: Number of people on staff who handle HR (integer)
- has_1099: Whether they have 1099 contractors
- ca_contractors: Whether they have contractors in California
- uses_physical_clocks: true if employees clock in on a physical time clock, false if not
- uses_mobile_app: true if employees track time on a mobile app, false if not
- uses_computer_timekeeping: true if employees track time on a computer, false if not
- shift_differentials: true if they pay a different rate for some shifts (nights, weekends), false if not
- hris_system: The HR information system (HRIS) or tool they keep employee records in, by name
- key_challenges: Main HR/compliance challenges described
- business_goals: Business goals mentioned
- wc_carrier: Their current workers' compensation insurance carrier, by name
- wc_renewal_date: When their workers' compensation policy renews
- wc_experience_mod: Their workers' compensation experience modification factor, a decimal such as 0.92 (from 0 to 10)
- wc_annual_premium: What they pay for workers' compensation a year, in whole US dollars (integer, from 0 to 100,000,000)

Integers are whole numbers from 0 to 1,000,000 unless a field says otherwise. Text is at most 1,000 characters. An array holds at most 100 items, one entry per item, never a comma-separated string.

For every field you return, also report:
- field_status: "confirmed" if the user stated it explicitly, "inferred" if you derived or assumed it from what they said, "incomplete" if they gave only part of the answer (e.g. "a few states, mainly CA").
- evidence: the short phrase from the user's message that supports it (at most ${MAX_EVIDENCE_CHARS} characters, quoted verbatim).
- corrected_fields: list a field only when the user explicitly corrects a value already in the previous context ("actually it's 45 people, not 40").`;

export const EXTRACT_TOOL = {
  name: "extract_chamber_data",
  description: "Extract structured business data fields from the user message",
  parameters: {
    type: "object",
    properties: {
      ...FIELD_TYPES,
      field_status: perField({ type: "string", enum: FIELD_STATUSES }),
      evidence: perField({ type: "string" }),
      corrected_fields: { type: "array", items: { type: "string", enum: FIELDS } },
      reply: { type: "string", description: "A natural conversational reply from Lenore, the gothic HR advisor. Keep her tone intelligent, warm, and slightly literary. Ask a follow-up question to continue the discovery." },
    },
    additionalProperties: false,
  } as Record<string, unknown>,
};
