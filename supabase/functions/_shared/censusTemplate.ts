// The census template (US-2.3d, D21): the CSV a prospect downloads from the Upload tab, fills in with one row per
// employee and uploads. Its headers are the census row's own keys, which document-extract's column matching reads
// exactly (parse.test.ts holds every header to its column), so a filled-in template reads with every column
// matched. It has no SSN or bank column. It lives beside the census contract, which the app re-exports
// (src/data/census.ts), so the template, the guide the Upload tab shows and the reader name the same columns.

import {
  CLASSIFICATIONS,
  COMPENSATION_TYPES,
  COVERAGE_TIER_LABELS,
  COVERAGE_TIERS,
  EMPLOYMENT_TYPES,
  type CensusEmployee,
} from "./census.ts";

/** The template's columns, in order: a census row's facts a roster states, under the row's own key. */
export const CENSUS_TEMPLATE_COLUMNS = [
  "first_name",
  "last_name",
  "dob",
  "work_state",
  "zip_code",
  "job_title",
  "annual_salary",
  "compensation_type",
  "employment_type",
  "classification",
  "coverage_tier",
  "class_code",
] as const satisfies readonly (keyof CensusEmployee)[];
export type CensusTemplateColumn = (typeof CENSUS_TEMPLATE_COLUMNS)[number];

export const CENSUS_TEMPLATE_FILE_NAME = "employee-census-template.csv";

const either = (values: readonly string[]) => `${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`;

/** What goes in each column, for the prospect. The value lists come from the census contract, so they can't drift. */
export const CENSUS_TEMPLATE_GUIDE: Record<CensusTemplateColumn, string> = {
  first_name: "Legal first name",
  last_name: "Legal last name",
  dob: "Date of birth, as YYYY-MM-DD or MM/DD/YYYY",
  work_state: "Two-letter code of the state they work in, such as CA",
  zip_code: "ZIP code where they work",
  job_title: "Job title",
  annual_salary: "Yearly pay in dollars, such as 85000. For hourly staff, what they earn in a usual year",
  compensation_type: either(COMPENSATION_TYPES),
  employment_type: either(EMPLOYMENT_TYPES),
  classification: either(CLASSIFICATIONS),
  coverage_tier: either(COVERAGE_TIERS.map((t) => `${t} (${COVERAGE_TIER_LABELS[t]})`)),
  class_code: "Four-digit workers' comp class code, such as 8810, if you know it",
};

/** The template: its header row and nothing else, so no sample person can end up in a census. */
export function censusTemplateCsv(): string {
  return `${CENSUS_TEMPLATE_COLUMNS.join(",")}\r\n`;
}
