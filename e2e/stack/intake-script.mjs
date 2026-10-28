// What the prospect tells Lenore in the end-to-end test, and what the fake AI provider answers.
// The fake provider (fake-ai.mjs) and the spec both read this file, so they cannot drift apart.

export const COMPANY_NAME = "Ravenwood Bindery LLC";

/** Typed into the Chamber's chat box. */
export const INTAKE_MESSAGE =
  "We're Ravenwood Bindery LLC, a bookbinding studio headquartered in New York. " +
  "We have 12 employees, all in New York, and we pay them bi-weekly.";

/**
 * The arguments of the model's forced `extract_chamber_data` tool call for INTAKE_MESSAGE: the values,
 * plus per-field status, verbatim evidence and Lenore's reply (supabase/functions/chamber-extract/schema.ts).
 * Industry is only inferred, so the prospect has something to confirm.
 */
export const INTAKE_EXTRACTION = {
  company_name: COMPANY_NAME,
  industry: "Bookbinding",
  hq_state: "NY",
  states: ["NY"],
  employee_count: 12,
  pay_frequency: "bi-weekly",
  field_status: {
    company_name: "confirmed",
    industry: "inferred",
    hq_state: "confirmed",
    states: "confirmed",
    employee_count: "confirmed",
    pay_frequency: "confirmed",
  },
  evidence: {
    company_name: "We're Ravenwood Bindery LLC",
    industry: "a bookbinding studio",
    hq_state: "headquartered in New York",
    states: "all in New York",
    employee_count: "We have 12 employees",
    pay_frequency: "we pay them bi-weekly",
  },
  corrected_fields: [],
  reply: "Ravenwood Bindery LLC: twelve souls in New York, paid bi-weekly. Who carries your health coverage today?",
};

/** Lenore's answer to any other message. */
export const FALLBACK_REPLY = "I've noted that. Tell me more about your team.";
