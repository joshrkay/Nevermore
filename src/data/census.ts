// The census contract lives beside the edge functions so document-extract and the app read a row
// the same way. See supabase/functions/_shared/census.ts.
import { ageOn, type CensusEmployee } from "../../supabase/functions/_shared/census.ts";

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
