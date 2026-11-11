// The extraction contract (US-2.1b): the prompt, the field list and the tool schema, shared by every provider
// adapter and by the handler's response shaping. The fields and their types come from the intake schema
// (_shared/intakeSchema.ts), so chat can answer every top-level field but the census, and nothing the schema
// doesn't know. Relative imports only, so it runs under Deno and Vitest alike.

import { CHAT_CANNOT_TAKE } from "../_shared/followUp.ts";
import { INTAKE_FIELDS, INTAKE_SCHEMA, LIMITS, type JsonSchema } from "../_shared/intakeSchema.ts";

/**
 * What each field means, for the model. Every field the chat extracts has one (extraction.test.ts checks). An
 * answer the workspace only shows beside its flag says to report the flag with it.
 */
export const FIELD_GUIDE: Record<string, string> = {
  company_name: "The company's legal or business name",
  industry: "What the business does, its industry",
  hq_state: "Two-letter US state code of the headquarters, such as CA",
  states: "Two-letter US state codes of every state where employees work, one state per item",
  employee_count: "Total number of employees (a whole number)",
  start_month: "When they want PEO coverage or benefits to start, as they said it",
  multiple_entities: "true if the business runs as more than one legal entity (separate companies or FEINs), false if it is one",
  fein_count: "How many federal employer ID numbers (FEINs) the business has (a whole number); report multiple_entities with it",
  virgin_medical: "true if they have never offered employer medical coverage, false if they have it now",
  current_carrier: "Their current medical insurance carrier",
  renewal_date: "When their current medical plan renews, as they said it",
  rate_history: "How their medical rates changed at recent renewals, as they describe it (such as \"up 12% last year\")",
  benefits_waiting_period: "How long new hires wait before benefits start (such as \"30 days\")",
  ancillary_benefits: "Benefits they offer besides medical and retirement, such as dental, vision or life insurance, one benefit per item",
  has_401k: "true if they offer any employer retirement plan (a 401(k), 403(b), SIMPLE IRA or similar), false if they offer none",
  retirement_type: "What kind of retirement plan, such as traditional 401(k), SIMPLE IRA or 403(b); report has_401k with it",
  employer_contributes: "true if the employer contributes to or matches the retirement plan, false if it doesn't; report has_401k with it",
  payroll_vendor: "Who runs their payroll now, such as Gusto or ADP",
  pay_frequency: "How often they run payroll: weekly, bi-weekly, semi-monthly or monthly",
  funding_days: "How many days before payday they fund payroll (a whole number)",
  has_nonexempt: "true if any employees are hourly or overtime-eligible (nonexempt), false if all are salaried and exempt",
  nonexempt_count: "How many employees are nonexempt, hourly or overtime-eligible (a whole number); report has_nonexempt with it",
  exempt_count: "How many employees are exempt, salaried and not overtime-eligible (a whole number); report has_nonexempt with it",
  pto_types: "Kinds of paid time off they offer, such as vacation, sick or holidays, one kind per item",
  accrual_method: "How paid time off accrues, such as per pay period or all at the start of the year",
  has_handbook: "true if they have an employee handbook",
  handbook_last_updated: "When the handbook was last updated, as they said it (such as \"2024\")",
  hr_staff_count: "How many people handle HR in-house (a whole number)",
  has_1099: "true if they use 1099 contractors",
  ca_contractors: "true if any contractors work in California",
  uses_physical_clocks: "true if employees clock in on a physical time clock, false if not",
  uses_mobile_app: "true if employees track time in a mobile app, false if not",
  uses_computer_timekeeping: "true if employees track time on a computer, false if not",
  shift_differentials: "true if some shifts (nights, weekends) pay a different rate, false if not",
  hris_system: "The HR information system (HRIS) or tool they keep employee records in, by name",
  key_challenges: "The HR or compliance challenges they describe",
  business_goals: "The business goals they mention",
  wc_carrier: "Their current workers' compensation carrier, by name",
  wc_renewal_date: "When their workers' comp policy renews, as they said it",
  wc_experience_mod: "Their workers' comp experience modification factor, a decimal such as 0.92 (from 0 to 10)",
  wc_annual_premium: "Their annual workers' comp premium in whole US dollars (a whole number, from 0 to 100,000,000)",
  entity_type: "How the business is organised: sole_proprietorship, partnership (including LP and LLP), llc, c_corporation, s_corporation, nonprofit, or other",
  year_founded: "The year the business was founded, as four digits such as 2014 (work it out when they say how long they have been in business)",
  street_address: "The street address of the business's main location, with city, state and ZIP code as they gave them",
  website: "The business's website address",
  naics_code: "The six-digit 2022 NAICS industry code that best fits what the business does. Propose one whenever the prospect describes their operations, with field_status \"inferred\"; never invent digits you aren't sure name a real industry",
  operations_description: "What the business does, in the prospect's own plain words: its products or services and how the work is done (at most 1,000 characters)",
  in_peo: "true if the business is in a PEO (a professional employer organization that co-employs its staff) right now, false if it is not",
  current_peo: "The PEO the business is in now, by name; report in_peo with it",
  peo_renewal_date: "When the agreement with their current PEO renews or ends, as they said it; report in_peo with it",
  owners_officers: "Owners and officers the prospect names, one row per person: name, title, ownership_percent (their share, a number from 0 to 100), duties (what they do in the business), covered (true if workers' comp covers them, false if they are excluded). Give only the rows and keys this message states; never ask for the rest",
  medical_plans: "Current medical plans the prospect describes, one row per plan: name, carrier, rate_ee, rate_ee_sp, rate_ee_ch, rate_fam (the monthly rate in dollars for employee only, employee and spouse, employee and children, and family), renewal_rate_ee, renewal_rate_ee_sp, renewal_rate_ee_ch, renewal_rate_fam (the renewal rates, when they have them), employer_contribution (what the employer pays toward the premium, as they put it), enrolled (how many employees are on the plan). Give only the plans and keys this message states; never ask for the rest",
  suta_rates: "State unemployment tax (SUTA or SUI) rates the prospect states, one row per state: state (two-letter code), rate (the rate as a percentage, such as 3.4), year (the year it applies to). Give only the states and keys this message states; never ask for the rest",
  loss_history: "Workers' comp loss history the prospect states, one row per policy year: policy_year (four digits), carrier, premium (whole dollars), experience_mod, claims (how many; 0 when they say there were none), paid and reserved (whole dollars), valuation_date (the date the figures are as of), no_coverage (true when they had no workers' comp coverage that year). Give only the years and keys this message states; never ask for the rest",
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
  entity_type: "How is the business organised: an LLC, a corporation, a partnership, or something else?",
  year_founded: "What year was the business founded?",
  street_address: "What is the street address of your main location?",
  website: "Does the business have a website?",
  naics_code: "Do you know your NAICS industry code?",
  operations_description: "In a sentence or two, what does the business do day to day?",
  in_peo: "Is the business in a PEO right now?",
  current_peo: "Which PEO are you with now?",
  peo_renewal_date: "When does your agreement with your current PEO renew?",
  owners_officers: "Who are the owners and officers of the business?",
  loss_history: "What has your workers' comp claims history been over the last five years?",
  medical_plans: "Which medical plans do you offer today, and what do they cost?",
  suta_rates: "Do you know your state unemployment tax rate?",
};

// The census (the employee roster) comes only from an uploaded file (D21), and the FEIN is typed into the workspace.
const NOT_FROM_CHAT = CHAT_CANNOT_TAKE;

const PROPERTIES = INTAKE_SCHEMA.properties as Record<string, JsonSchema>;

const MAX_TOOL_CHOICES = 20;

/** The tool type for a schema rule: its non-null type, and a list's item type. */
function toolType(rule: JsonSchema): JsonSchema {
  const types = Array.isArray(rule.type) ? rule.type : [rule.type];
  const type = types.find((t) => t !== "null") as string;
  if (type === "array") {
    // A table of rows: each row an object of the list's own keys, typed as the schema types them.
    const ref = (rule.items as JsonSchema | undefined)?.$ref;
    const row = typeof ref === "string" ? (INTAKE_SCHEMA.$defs as Record<string, JsonSchema>)[ref.slice("#/$defs/".length)] : undefined;
    if (row?.type === "object") {
      const properties = Object.fromEntries(Object.entries(row.properties as Record<string, JsonSchema>).map(([key, cell]) => [key, { type: cell.type }]));
      return { type: "array", items: { type: "object", properties, additionalProperties: false } };
    }
    return { type: "array", items: { type: "string" } };
  }
  // One of a short list of values (an entity type). A state code stays plain text: its guide says what it is.
  const values = Array.isArray(rule.enum) ? rule.enum.filter((v) => v !== null) : [];
  if (values.length > 0 && values.length <= MAX_TOOL_CHOICES) return { type, enum: values };
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

// Versions the whole extraction contract: SYSTEM_PROMPT, EXTRACT_TOOL, the user turn (prompt.ts) and the
// response shape. Recorded on every extraction event (US-2.4a), returned with every extraction, and stored
// by the browser on each value's provenance (B-1.4), so a value can be traced to the prompt that produced
// it. Raise it with any change to them: _shared/ai/promptVersion.test.ts fails until you do. See
// "Extraction contract version and eval" in docs/intake-schema.md. Version 2 named two contracts built at
// the same time (US-2.1b and B-1.1); 3 is the two merged; 4 adds how Lenore replies and the user turn's ready and
// census lines (US-2.3a); 5 has her point to the census template whenever the roster comes up (US-2.3d); 6 marks
// "unknown" only on the prospect's own words of not knowing, never claims the intake is finished while a field is
// unsettled, re-asks a question the message didn't answer, and adds prospect_stopping (QA F4, F11); 7 puts the
// fields an advisor asked about first in "Not yet settled", marked, and has Lenore say the advisor asked; 8 is the
// Nevermore rebrand: Lenore is Nevermore's intake assistant, warm, quick and plain-spoken rather than a gothic,
// literary advisor, and the app's own names replace the Chamber's. The extraction rules are unchanged.
// 9 is intake schema v3 (Epic K): the common questions join the fields, an entity type is one of a listed set, the
// FEIN and the legal entities are never taken in chat, and the user turn names the answers entered in the workspace
// so Lenore can say where each goes.
export const PROMPT_VERSION = 9;

const fieldLines = FIELDS.map((key) => `- ${key} (${LABELS.get(key)}): ${FIELD_GUIDE[key]}`).join("\n");

export const SYSTEM_PROMPT = `You are a data extraction assistant for an HR/PEO underwriting system.
You are given the answers captured so far with each field's status, the fields not yet settled (most important first), the recent conversation between the prospect and Lenore, and the prospect's new message. Extract the structured data the new message gives.

You MUST use the extract_chamber_data tool to return the extracted fields. Only include fields that are clearly stated or strongly implied by the new message. Do not guess, and never invent a value the prospect didn't give.

Field definitions:
${fieldLines}

Integers are whole numbers from 0 to ${LIMITS.count.toLocaleString("en-US")} unless a field says otherwise. Text is at most ${LIMITS.text.toLocaleString("en-US")} characters. An array holds at most ${LIMITS.listItems} items, one entry per item, never a comma-separated string.

Never extract the employee census or details of individual employees: the roster comes only from an uploaded file.

Never extract a federal employer identification number (FEIN or EIN), the employer's or a legal entity's: the prospect types it into the workspace.

A short answer ("yes", "no", "about twelve", "weekly") answers the question Lenore asked last in the recent conversation: capture it against the field that question was about.

For every field you return, also report:
- field_status: "confirmed" if the prospect stated it explicitly, "inferred" if you derived or assumed it from what they said, "incomplete" if they gave only part of the answer (e.g. "a few states, mainly CA").
- evidence: the short phrase from the prospect's message that supports it (at most ${MAX_EVIDENCE_CHARS} characters, quoted verbatim).
- corrected_fields: list a field only when the prospect explicitly corrects a value already captured ("actually it's 45 people, not 40").

When the prospect says they don't know a field's answer, or can't say yet, give that field no value: set its field_status to "unknown" and its evidence to the phrase where they said so, quoted verbatim. Mark only the fields they said they don't know. Never mark a field "unknown" because the message simply doesn't mention it: a field the message doesn't speak to gets no status at all, and Lenore asks about it later. An "unknown" without the prospect's own words of not knowing is discarded.

Lenore is the intake assistant at Nevermore. She sounds warm, quick and a little informal: plain words, short sentences, no flourishes. She never jokes about the prospect's business or their data.

How Lenore replies (the reply field):
- Ask about exactly one thing: the first field in "Not yet settled" that the new message didn't just answer. Never ask about a field that isn't in that list, and never ask about two at once.
- When the new message doesn't answer the question Lenore asked last, that field is still first in "Not yet settled": ask it again, kindly, perhaps in other words.
- A field marked "[your advisor asked]" is one their advisor asked about after reviewing the intake, and it may already hold an answer: say their advisor asked about it, say what the intake holds for it (or that it holds nothing), and ask them to confirm or correct it.
- When the prospect doesn't know an answer, accept it kindly and move on to the next field.
- While "Not yet settled" names any field the new message didn't answer, never say the intake is complete, that you have everything, or that nothing is left: ask the next question.
- When "Not yet settled" is "none", ask nothing more: thank them, tell them the intake is complete, and that they can review it on the Review tab.
- When the prospect asks to stop, pause or finish for now, set prospect_stopping to true and ask nothing more: tell them their answers are saved, that they can come back to carry on, and that they can review them on the Review tab.
- When no employee census is uploaded and the next fields aren't required ones, you may invite them to share one with the census template: they download it on the Upload tab, fill in one row per employee and upload it there.
- Whenever the prospect brings up their employees' details, their roster or census, or starts listing employees, point them to the census template on the Upload tab instead of taking the details in chat, then carry on with the next field. Never ask for Social Security or bank numbers: the template has no place for them.
- A table (owners and officers and the like) is filled in on its tab. When the prospect volunteers a row of one, capture it; never ask for a table's rows one by one.
- Never ask for an answer named in "Entered in the workspace": the prospect types those into the app, not the chat. When "Not yet settled" is "none" and "Entered in the workspace" names any, end the wrap-up by saying where each one goes.
- An entry in "Entered in the workspace" marked "[your advisor asked]" is one their advisor asked about after reviewing the intake: say their advisor asked about it and which tab it is on, once, then carry on.
- When the prospect gives or offers their FEIN (their EIN or federal tax ID), tell them to type it into the FEIN box on the Company tab, where it is kept out of the conversation; never repeat the number, and carry on with the next field.
- Don't tell them the intake is ready to certify: the app tells them itself when it is.
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
      prospect_stopping: { type: "boolean", description: "true only when the prospect asks to stop, pause or finish for now" },
      reply: { type: "string", description: "Lenore's reply, in her voice: warm, quick and a little informal, in plain words. It acknowledges the answer and asks about the first field in \"Not yet settled\" the message didn't answer, or, when none is left, wraps up." },
    },
    additionalProperties: false,
  } as Record<string, unknown>,
};
