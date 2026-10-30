// The census contract lives beside the edge functions so document-extract and the app read a row
// the same way. See supabase/functions/_shared/census.ts.
import { ageOn, COVERAGE_TIER_LABELS, type CensusEmployee, type CensusFact } from "../../supabase/functions/_shared/census.ts";

export {
  CENSUS_FACTS,
  CLASSIFICATIONS,
  COMPENSATION_TYPES,
  COVERAGE_TIER_LABELS,
  COVERAGE_TIERS,
  EMPLOYMENT_TYPES,
  MAX_ANNUAL_SALARY,
  MAX_CENSUS_ROWS,
  MAX_DEPENDENTS,
  ageOn,
  censusGaps,
  factsFromMask,
  factsMask,
  isW2,
  normalizeCensus,
  personNameKey,
  samePerson,
  stripUnstorable,
} from "../../supabase/functions/_shared/census.ts";
export type {
  CensusDependent,
  CensusEmployee,
  CensusFact,
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
