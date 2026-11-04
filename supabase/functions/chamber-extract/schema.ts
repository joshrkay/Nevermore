// The extraction contract (US-2.1b): the prompt, the field list and the tool schema, shared by every provider
// adapter and by the handler's response shaping. The fields and their types come from the intake schema
// (_shared/intakeSchema.ts), so chat can answer every top-level field but the census, and nothing the schema
// doesn't know. Relative imports only, so it runs under Deno and Vitest alike.

import { INTAKE_FIELDS, INTAKE_SCHEMA, type JsonSchema } from "../_shared/intakeSchema.ts";

/** What each field means, for the model. Every field the chat extracts has one (schema.test.ts checks). */
export const FIELD_GUIDE: Record<string, string> = {
  company_name: "The company's legal or business name",
  industry: "What the business does, its industry",
  hq_state: "Two-letter US state code of the headquarters, such as CA",
  states: "Two-letter US state codes of every state where employees work",
  employee_count: "Total number of employees (a whole number)",
  start_month: "When they want PEO coverage or benefits to start, as they said it",
  multiple_entities: "true if the business runs as more than one legal entity",
  fein_count: "How many federal employer ID numbers (FEINs) the business has",
  virgin_medical: "true if they have never offered employer medical coverage, false if they have it now",
  current_carrier: "Their current medical insurance carrier",
  renewal_date: "When their current medical plan renews, as they said it",
  rate_history: "What they said about recent medical rate increases",
  benefits_waiting_period: "How long new hires wait before benefits start",
  ancillary_benefits: "Other benefits they offer, such as dental, vision or life",
  has_401k: "true if they offer a retirement plan such as a 401(k)",
  retirement_type: "What kind of retirement plan, such as 401(k), SIMPLE IRA or 403(b)",
  employer_contributes: "true if the employer contributes to the retirement plan",
  payroll_vendor: "Who runs their payroll now, such as Gusto or ADP",
  pay_frequency: "How often they run payroll: weekly, bi-weekly, semi-monthly or monthly",
  funding_days: "How many days before payday they fund payroll (a whole number)",
  has_nonexempt: "true if any employees are hourly or overtime-eligible (nonexempt)",
  nonexempt_count: "How many employees are nonexempt (a whole number)",
  exempt_count: "How many employees are exempt (a whole number)",
  pto_types: "Kinds of paid time off they offer, such as vacation or sick",
  accrual_method: "How paid time off accrues, such as per pay period or up front",
  has_handbook: "true if they have an employee handbook",
  handbook_last_updated: "When the handbook was last updated, as they said it",
  hr_staff_count: "How many people work in HR in-house (a whole number)",
  has_1099: "true if they use 1099 contractors",
  ca_contractors: "true if any contractors work in California",
  uses_physical_clocks: "true if employees clock in on a physical time clock",
  uses_mobile_app: "true if employees track time in a mobile app",
  uses_computer_timekeeping: "true if employees track time on a computer",
  shift_differentials: "true if some shifts pay more",
  hris_system: "Their HR information system, if any",
  key_challenges: "The HR or compliance challenges they describe",
  business_goals: "The business goals they mention",
  wc_carrier: "Their current workers' compensation carrier",
  wc_renewal_date: "When their workers' comp policy renews, as they said it",
  wc_experience_mod: "Their workers' comp experience modification factor, a decimal such as 0.92",
  wc_annual_premium: "Their annual workers' comp premium in whole dollars",
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

const LABELS = new Map(INTAKE_FIELDS.map((f) => [f.key, f.label]));

const perField = (schema: unknown) => ({
  type: "object",
  properties: Object.fromEntries(FIELDS.map((f) => [f, schema])),
  additionalProperties: false,
});

// Recorded on every extraction event. Raise it with any change to SYSTEM_PROMPT or EXTRACT_TOOL: promptVersion.test.ts
// fails until you do, so an event always says which prompt produced it.
export const PROMPT_VERSION = 2;

const fieldLines = FIELDS.map((key) => `- ${key} (${LABELS.get(key)}): ${FIELD_GUIDE[key]}`).join("\n");

export const SYSTEM_PROMPT = `You are a data extraction assistant for an HR/PEO underwriting system.
You are given the answers captured so far with each field's status, the fields not yet settled (most important first), the recent conversation between the prospect and Lenore, and the prospect's new message. Extract the structured data the new message gives.

You MUST use the extract_chamber_data tool to return the extracted fields. Only include fields that are clearly stated or strongly implied by the new message. Do not guess, and never invent a value the prospect didn't give.

Field definitions:
${fieldLines}

Never extract the employee census or details of individual employees: the roster comes only from an uploaded file.

A short answer ("yes", "no", "about twelve", "weekly") answers the question Lenore asked last in the recent conversation: capture it against the field that question was about.

For every field you return, also report:
- field_status: "confirmed" if the prospect stated it explicitly, "inferred" if you derived or assumed it from what they said, "incomplete" if they gave only part of the answer (e.g. "a few states, mainly CA").
- evidence: the short phrase from the prospect's message that supports it (at most ${MAX_EVIDENCE_CHARS} characters, quoted verbatim).
- corrected_fields: list a field only when the prospect explicitly corrects a value already captured ("actually it's 45 people, not 40").

When the prospect says they don't know a field's answer, or can't say yet, give that field no value: set its field_status to "unknown" and its evidence to the phrase where they said so. Never mark a field "unknown" because the message simply doesn't mention it.`;

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
      reply: { type: "string", description: "A natural conversational reply from Lenore, the gothic HR advisor. Keep her tone intelligent, warm, and slightly literary. Ask a follow-up question to continue the discovery." },
    },
    additionalProperties: false,
  } as Record<string, unknown>,
};
