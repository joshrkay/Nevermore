// The extraction prompt and tool schema, shared by every provider adapter.

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
- business_goals: Business goals mentioned`;

export const EXTRACT_TOOL = {
  name: "extract_chamber_data",
  description: "Extract structured business data fields from the user message",
  parameters: {
    type: "object",
    properties: {
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
      reply: { type: "string", description: "A natural conversational reply from Lenore, the gothic HR advisor. Keep her tone intelligent, warm, and slightly literary. Ask a follow-up question to continue the discovery." },
    },
    additionalProperties: false,
  } as Record<string, unknown>,
};
