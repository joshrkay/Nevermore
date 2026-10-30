// The census contract lives beside the edge functions so document-extract and the app read a row
// the same way. See supabase/functions/_shared/census.ts.
import { ageOn, COVERAGE_TIER_LABELS, type CensusEmployee } from "../../supabase/functions/_shared/census.ts";

export {
  COVERAGE_TIER_LABELS,
  ageOn,
  censusGaps,
  isW2,
  normalizeCensus,
  samePerson,
} from "../../supabase/functions/_shared/census.ts";
export type {
  CensusDependent,
  CensusEmployee,
  CensusGap,
  CompensationType,
  CoverageTier,
  EmploymentType,
  WorkerClassification,
} from "../../supabase/functions/_shared/census.ts";

/** Age today, from the date of birth when there is one. */
export const censusAge = (e: CensusEmployee): number | undefined => (e.dob ? ageOn(e.dob) : e.age);

/** Annual pay for a table cell: "$85,000", "$41,600 (hourly)" for an hourly worker, or "—". */
export const censusPay = (e: CensusEmployee): string =>
  e.annual_salary ? `$${e.annual_salary.toLocaleString()}${e.compensation_type === "hourly" ? " (hourly)" : ""}` : "—";

/** Facts of a census row a document can state; the rest of a row is its name and id. */
export const CENSUS_FACTS = [
  "dob", "age", "work_state", "zip_code", "job_title", "annual_salary", "compensation_type",
  "employment_type", "classification", "coverage_tier", "class_code",
] as const;
export type CensusFact = (typeof CENSUS_FACTS)[number];

export const CENSUS_FACT_LABELS: Record<CensusFact, string> = {
  dob: "date of birth",
  age: "age",
  work_state: "work state",
  zip_code: "ZIP",
  job_title: "title",
  annual_salary: "annual salary",
  compensation_type: "pay type",
  employment_type: "full or part time",
  classification: "W-2 or 1099",
  coverage_tier: "coverage tier",
  class_code: "class code",
};

/** One census fact for display: "$95,000", "Part time", "W-2", "Employee + Spouse", or "—". */
export function formatCensusFact(fact: CensusFact, v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  switch (fact) {
    case "annual_salary":
      return typeof v === "number" ? `$${v.toLocaleString()}` : String(v);
    case "compensation_type":
      return v === "hourly" ? "Hourly" : "Salaried";
    case "employment_type":
      return v === "part_time" ? "Part time" : "Full time";
    case "classification":
      return v === "1099" ? "1099" : "W-2";
    case "coverage_tier":
      return COVERAGE_TIER_LABELS[v as keyof typeof COVERAGE_TIER_LABELS] ?? String(v);
    default:
      return String(v);
  }
}
