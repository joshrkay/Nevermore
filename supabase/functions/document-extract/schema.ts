// The prompt and tool for reading company facts out of a document's text. No imports beyond the
// pure helpers, so it runs under Deno and Vitest alike.

import type { ExtractionTool } from "../_shared/ai/model.ts";
import { DOCUMENT_FIELDS, DOCUMENT_ROW_FIELDS } from "./parse.ts";

// Recorded on every extraction event. Raise it with any change to SYSTEM_PROMPT or REPORT_TOOL: promptVersion.test.ts
// fails until you do, so an event always says which prompt produced it. 2 is intake schema v3 (Epic K): the
// common questions a document can state, and never a FEIN.
export const PROMPT_VERSION = 2;

export const SYSTEM_PROMPT = `You read business documents (benefits summaries, payroll reports, workers' comp pages, invoices) for an HR/PEO intake.
Report only company-level facts the document clearly states. Never report details about an individual person.
The text is split into numbered sections marked [[Section N]]; give the section number each fact came from.
Field meanings:
- company_name, industry, hq_state (two-letter code), states (two-letter codes, comma-separated), employee_count (integer)
- start_month: desired benefits start date; renewal_date: current policy renewal date
- virgin_medical: "yes" if they have never had employer health insurance; current_carrier: current medical carrier
- rate_history: recent premium changes; benefits_waiting_period; ancillary_benefits (comma-separated, e.g. dental, vision, life)
- has_401k, retirement_type, employer_contributes (to retirement)
- payroll_vendor, pay_frequency (weekly, bi-weekly, semi-monthly, monthly), nonexempt_count, exempt_count
- has_handbook, has_1099 (uses 1099 contractors), ca_contractors (contractors in California)
- entity_type (sole proprietorship, partnership, LLC, C corporation, S corporation or nonprofit), year_founded (four digits), street_address (the business's main address, with city, state and ZIP), website
- naics_code (the six-digit NAICS industry code, only when the document prints one), operations_description (what the business does, as the document describes it)
- in_peo (whether the business is in a PEO now), current_peo (that PEO's name), peo_renewal_date (when its agreement renews)
- wc_carrier (the current workers' comp carrier), wc_renewal_date, wc_experience_mod (a decimal such as 0.92), wc_annual_premium (whole dollars)
Tables are reported as rows (one object per row) in place of a value:
- loss_history, from a workers' comp loss run or experience rating worksheet: one row per policy year with policy_year (four digits), carrier, premium, experience_mod, claims (the number of claims; 0 when the run shows none), paid, reserved (whole dollars), and valuation_date (the date the run is valued as of). Include only what the document prints for that year.
- medical_plans, from a carrier invoice, a benefits summary or a renewal letter: one row per plan with name, carrier, rate_ee, rate_ee_sp, rate_ee_ch, rate_fam (the current monthly rate for employee only, employee and spouse, employee and children, and family), renewal_rate_ee, renewal_rate_ee_sp, renewal_rate_ee_ch, renewal_rate_fam (the renewal rates, from a renewal letter), employer_contribution and enrolled (the number of employees enrolled).
Never report a federal employer identification number (FEIN or EIN) or any other tax ID.
Use "yes"/"no" for yes-or-no fields. Leave out anything not stated.`;

export const REPORT_TOOL: ExtractionTool = {
  name: "report_document_fields",
  description: "Report the company-level intake fields stated in the document",
  parameters: {
    type: "object",
    properties: {
      fields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string", enum: [...DOCUMENT_FIELDS, ...DOCUMENT_ROW_FIELDS] },
            value: { type: "string" },
            rows: { type: "array", items: { type: "object" }, description: "For a table field only: one object per row, in place of value" },
            section: { type: "integer" },
          },
          required: ["field", "section"],
          additionalProperties: false,
        },
      },
    },
    required: ["fields"],
    additionalProperties: false,
  },
};
