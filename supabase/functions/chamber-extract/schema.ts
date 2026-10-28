// The extraction prompt, field list and tool schema, shared by every provider adapter and by the
// handler's response shaping. No imports, so it runs under Deno and Vitest alike.

export const FIELD_TYPES: Record<string, unknown> = {
  company_name: { type: "string" },
  industry: { type: "string" },
  hq_state: { type: "string" },
  states: { type: "array", items: { type: "string" } },
  employee_count: { type: "integer" },
  start_month: { type: "string" },
  virgin_medical: { type: "boolean" },
  current_carrier: { type: "string" },
  renewal_date: { type: "string" },
  payroll_vendor: { type: "string" },
  pay_frequency: { type: "string" },
  has_401k: { type: "boolean" },
  has_1099: { type: "boolean" },
  ca_contractors: { type: "boolean" },
  has_handbook: { type: "boolean" },
  key_challenges: { type: "string" },
  business_goals: { type: "string" },
};
export const FIELDS = Object.keys(FIELD_TYPES);
export const FIELD_STATUSES = ["confirmed", "inferred", "incomplete"];
export const MAX_EVIDENCE_CHARS = 200;

const perField = (schema: unknown) => ({
  type: "object",
  properties: Object.fromEntries(FIELDS.map((f) => [f, schema])),
  additionalProperties: false,
});

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
- virgin_medical: true if they've never had employer-sponsored health insurance, false if switching
- current_carrier: Current insurance carrier name
- renewal_date: Current policy renewal date
- payroll_vendor: Current payroll provider
- pay_frequency: How often they run payroll (weekly, bi-weekly, semi-monthly, monthly)
- has_401k: Whether they offer 401k
- has_1099: Whether they have 1099 contractors
- ca_contractors: Whether they have contractors in California
- has_handbook: Whether they have an employee handbook
- key_challenges: Main HR/compliance challenges described
- business_goals: Business goals mentioned

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
