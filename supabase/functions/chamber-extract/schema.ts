// The extraction contract (US-2.1b): the prompt, the field list and the tool schema, shared by every provider
// adapter and by the handler's response shaping. The fields and their types come from the intake schema
// (_shared/intakeSchema.ts), so chat can answer every top-level field but the census, and nothing the schema
// doesn't know. Relative imports only, so it runs under Deno and Vitest alike.

import { INTAKE_FIELDS, INTAKE_SCHEMA, type JsonSchema } from "../_shared/intakeSchema.ts";

/**
 * What each field means, for the model: B-1.1's definitions, which name the flag each dependent count needs.
 * Every field the chat extracts has one (extraction.test.ts checks).
 */
export const FIELD_GUIDE: Record<string, string> = {
  company_name: "Company or business name",
  industry: "Industry or business type",
  hq_state: "Two-letter US state code for headquarters",
  states: "Array of two-letter state codes where employees work",
  employee_count: "Total number of employees (integer)",
  start_month: "Desired benefits start date",
  multiple_entities: "true if the business is more than one legal entity (separate companies or FEINs), false if it is one",
  fein_count: "How many FEINs (federal employer ID numbers) the business has (integer); report multiple_entities with it",
  virgin_medical: "true if they've never had employer-sponsored health insurance, false if switching",
  current_carrier: "Current insurance carrier name",
  renewal_date: "Current policy renewal date",
  rate_history: "How their health insurance rates changed at recent renewals, as they describe it (e.g. \"up 12% last year\")",
  benefits_waiting_period: "How long a new hire waits before benefits start (e.g. \"30 days\")",
  ancillary_benefits: "Array of benefits they offer besides medical and retirement (e.g. dental, vision, life insurance), one benefit per item",
  has_401k: "true if they offer any employer retirement plan (a 401(k), 403(b), SIMPLE IRA or similar), false if they offer none",
  retirement_type: "The kind of retirement plan they offer (e.g. \"traditional 401(k)\", \"SIMPLE IRA\"); report has_401k with it",
  employer_contributes: "true if the employer contributes to or matches the retirement plan, false if it doesn't; report has_401k with it",
  payroll_vendor: "Current payroll provider",
  pay_frequency: "How often they run payroll (weekly, bi-weekly, semi-monthly, monthly)",
  funding_days: "How many days before payday payroll must be funded (integer)",
  has_nonexempt: "true if any employees are non-exempt (hourly, paid overtime), false if all are exempt (salaried)",
  nonexempt_count: "Number of non-exempt (hourly, overtime-eligible) employees (integer); report has_nonexempt with it",
  exempt_count: "Number of exempt (salaried, not overtime-eligible) employees (integer); report has_nonexempt with it",
  pto_types: "Array of the kinds of paid time off they offer (e.g. vacation, sick, holidays), one kind per item",
  accrual_method: "How employees earn paid time off (e.g. per pay period, all at the start of the year)",
  has_handbook: "Whether they have an employee handbook",
  handbook_last_updated: "When the employee handbook was last updated (e.g. \"2024\")",
  hr_staff_count: "Number of people on staff who handle HR (integer)",
  has_1099: "Whether they have 1099 contractors",
  ca_contractors: "Whether they have contractors in California",
  uses_physical_clocks: "true if employees clock in on a physical time clock, false if not",
  uses_mobile_app: "true if employees track time on a mobile app, false if not",
  uses_computer_timekeeping: "true if employees track time on a computer, false if not",
  shift_differentials: "true if they pay a different rate for some shifts (nights, weekends), false if not",
  hris_system: "The HR information system (HRIS) or tool they keep employee records in, by name",
  key_challenges: "Main HR/compliance challenges described",
  business_goals: "Business goals mentioned",
  wc_carrier: "Their current workers' compensation insurance carrier, by name",
  wc_renewal_date: "When their workers' compensation policy renews",
  wc_experience_mod: "Their workers' compensation experience modification factor, a decimal such as 0.92 (from 0 to 10)",
  wc_annual_premium: "What they pay for workers' compensation a year, in whole US dollars (integer, from 0 to 100,000,000)",
};

/**
 * How Lenore asks for each field when the model gave no reply of its own (US-2.3a): always the next unsettled
 * field, never a canned question. Every field the chat extracts has one (extraction.test.ts checks).
 */
export const FIELD_QUESTION: Record<string, string> = {
  company_name: "What is the company's legal name?",
  industry: "What does the business do?",
  hq_state: "Which state is the company headquartered in?",
  states: "Which states do your employees work in?",
  employee_count: "How many employees do you have?",
  start_month: "When would you like coverage to start?",
  multiple_entities: "Does the business run as more than one legal entity?",
  fein_count: "How many federal employer ID numbers does the business have?",
  virgin_medical: "Do you offer employer medical coverage today?",
  current_carrier: "Who is your current medical carrier?",
  renewal_date: "When does your current medical plan renew?",
  rate_history: "How have your medical rates changed at recent renewals?",
  benefits_waiting_period: "How long do new hires wait before their benefits start?",
  ancillary_benefits: "Which other benefits do you offer, such as dental or vision?",
  has_401k: "Do you offer a retirement plan, such as a 401(k)?",
  retirement_type: "What kind of retirement plan do you offer?",
  employer_contributes: "Does the company contribute to the retirement plan?",
  payroll_vendor: "Who runs your payroll today?",
  pay_frequency: "How often do you run payroll?",
  funding_days: "How many days before payday do you fund payroll?",
  has_nonexempt: "Are any of your employees hourly or eligible for overtime?",
  nonexempt_count: "How many of your employees are nonexempt?",
  exempt_count: "How many of your employees are exempt?",
  pto_types: "What kinds of paid time off do you offer?",
  accrual_method: "How does paid time off accrue?",
  has_handbook: "Do you have an employee handbook?",
  handbook_last_updated: "When was the handbook last updated?",
  hr_staff_count: "How many people work in HR in-house?",
  has_1099: "Do you work with any 1099 contractors?",
  ca_contractors: "Do any of your contractors work in California?",
  uses_physical_clocks: "Do employees clock in on a physical time clock?",
  uses_mobile_app: "Do employees track their time in a mobile app?",
  uses_computer_timekeeping: "Do employees track their time on a computer?",
  shift_differentials: "Do any shifts pay more than others?",
  hris_system: "Which HR information system do you use, if any?",
  key_challenges: "What are your biggest HR or compliance challenges right now?",
  business_goals: "What are the business's goals for the year ahead?",
  wc_carrier: "Who is your workers' compensation carrier?",
  wc_renewal_date: "When does your workers' comp policy renew?",
  wc_experience_mod: "Do you know your workers' comp experience mod?",
  wc_annual_premium: "What is your annual workers' comp premium?",
};

// The census (the employee roster) comes only from an uploaded file (D21).
const NOT_FROM_CHAT = new Set(["census"]);

const PROPERTIES = INTAKE_SCHEMA.properties as Record<string, JsonSchema>;

/** The tool type for a schema rule: its non-null type, and a list's item type. */
function toolType(rule: JsonSchema): JsonSchema {
  const types = Array.isArray(rule.type) ? rule.type : [rule.type];
  const type = types.find((t) => t !== "null") as string;
  if (type === "array") return { type: "array", items: { type: "string" } };
  return { type };
}

/** The fields chat extracts, in schema order: every top-level field but the census. */
export const FIELDS = Object.keys(PROPERTIES).filter((key) => !NOT_FROM_CHAT.has(key));
export const FIELD_TYPES: Record<string, JsonSchema> = Object.fromEntries(FIELDS.map((key) => [key, toolType(PROPERTIES[key])]));
/** What the model may say about a field. Only a disagreement makes one conflicting, and only the prospect marks one not applicable (D31). */
export const FIELD_STATUSES = ["confirmed", "inferred", "incomplete", "unknown"];
export const MAX_EVIDENCE_CHARS = 200;
// An answer can carry a value, a status and a quote for every field, plus the reply: well past the
// Anthropic adapter's default cap, which would cut it off. Not part of the contract hash.
export const CHAT_MAX_TOKENS = 8192;

const LABELS = new Map(INTAKE_FIELDS.map((f) => [f.key, f.label]));

const perField = (schema: unknown) => ({
  type: "object",
  properties: Object.fromEntries(FIELDS.map((f) => [f, schema])),
  additionalProperties: false,
});

// Recorded on every extraction event. Raise it with any change to SYSTEM_PROMPT or EXTRACT_TOOL: promptVersion.test.ts
// fails until you do, so an event always says which prompt produced it.
export const PROMPT_VERSION = 4;

const fieldLines = FIELDS.map((key) => `- ${key} (${LABELS.get(key)}): ${FIELD_GUIDE[key]}`).join("\n");

export const SYSTEM_PROMPT = `You are a data extraction assistant for an HR/PEO underwriting system.
You are given the answers captured so far with each field's status, the fields not yet settled (most important first), the recent conversation between the prospect and Lenore, and the prospect's new message. Extract the structured data the new message gives.

You MUST use the extract_chamber_data tool to return the extracted fields. Only include fields that are clearly stated or strongly implied by the new message. Do not guess, and never invent a value the prospect didn't give.

Field definitions:
${fieldLines}

Integers are whole numbers from 0 to 1,000,000 unless a field says otherwise. Text is at most 1,000 characters. An array holds at most 100 items, one entry per item, never a comma-separated string.

Never extract the employee census or details of individual employees: the roster comes only from an uploaded file.

A short answer ("yes", "no", "about twelve", "weekly") answers the question Lenore asked last in the recent conversation: capture it against the field that question was about.

For every field you return, also report:
- field_status: "confirmed" if the prospect stated it explicitly, "inferred" if you derived or assumed it from what they said, "incomplete" if they gave only part of the answer (e.g. "a few states, mainly CA").
- evidence: the short phrase from the prospect's message that supports it (at most ${MAX_EVIDENCE_CHARS} characters, quoted verbatim).
- corrected_fields: list a field only when the prospect explicitly corrects a value already captured ("actually it's 45 people, not 40").

When the prospect says they don't know a field's answer, or can't say yet, give that field no value: set its field_status to "unknown" and its evidence to the phrase where they said so. Never mark a field "unknown" because the message simply doesn't mention it.

How Lenore replies (the reply field):
- Ask about exactly one thing: the first field in "Not yet settled" that the new message didn't just answer. Never ask about a field that isn't in that list, and never ask about two at once.
- When the prospect doesn't know an answer, accept it kindly and move on to the next field.
- When "Not yet settled" is "none", ask nothing more: thank them, tell them the intake is complete, and that they can review it on the Review tab.
- When no employee census is uploaded and the next fields aren't required ones, you may invite them to upload a census on the Upload tab.
- Don't tell them the intake is ready to certify: the Chamber says so itself when it is.
- Keep it short: one or two sentences.`;

export const EXTRACT_TOOL = {
  name: "extract_chamber_data",
  description: "Extract structured business data fields from the prospect's new message",
  parameters: {
    type: "object",
    properties: {
      ...FIELD_TYPES,
      field_status: perField({ type: "string", enum: FIELD_STATUSES }),
      evidence: perField({ type: "string" }),
      corrected_fields: { type: "array", items: { type: "string", enum: FIELDS } },
      reply: { type: "string", description: "Lenore's reply, the gothic HR advisor: intelligent, warm and slightly literary. It acknowledges the answer and asks about the first field in \"Not yet settled\" the message didn't answer, or, when none is left, wraps up." },
    },
    additionalProperties: false,
  } as Record<string, unknown>,
};
