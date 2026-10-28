// The prompt and tool for reading company facts out of a document's text. No imports beyond the
// pure helpers, so it runs under Deno and Vitest alike.

import type { ExtractionTool } from "../_shared/ai/model.ts";
import { DOCUMENT_FIELDS } from "./parse.ts";

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
            field: { type: "string", enum: [...DOCUMENT_FIELDS] },
            value: { type: "string" },
            section: { type: "integer" },
          },
          required: ["field", "value", "section"],
          additionalProperties: false,
        },
      },
    },
    required: ["fields"],
    additionalProperties: false,
  },
};
