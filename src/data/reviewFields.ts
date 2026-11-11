// Where each answer sits in the Review step (US-2.2a, D28).
import type { FieldKey } from "./provenance";
import type { ReviewSection } from "./readiness";

/**
 * Every answer in the intake schema but the census (shown as its own table), each in one section, in the order
 * shown (D28). A test fails when a schema field has no place here.
 */
export const REVIEW_FIELDS: Record<ReviewSection, FieldKey[]> = {
  company: ["company_name", "fein", "entity_type", "year_founded", "street_address", "website", "industry", "naics_code", "operations_description", "start_month", "multiple_entities", "fein_count", "entities", "in_peo", "current_peo", "peo_renewal_date"],
  workforce: ["employee_count", "has_nonexempt", "nonexempt_count", "exempt_count", "has_1099", "ca_contractors"],
  locations: ["hq_state", "states"],
  payroll: ["payroll_vendor", "pay_frequency", "funding_days", "pto_types", "accrual_method"],
  benefits: ["virgin_medical", "current_carrier", "renewal_date", "rate_history", "benefits_waiting_period", "ancillary_benefits", "has_401k", "retirement_type", "employer_contributes"],
  workers_comp: ["wc_carrier", "wc_renewal_date", "wc_experience_mod", "wc_annual_premium", "owners_officers", "loss_history"],
  operations: ["has_handbook", "handbook_last_updated", "hr_staff_count", "uses_physical_clocks", "uses_mobile_app", "uses_computer_timekeeping", "shift_differentials", "hris_system", "key_challenges", "business_goals"],
};

/**
 * The seven sections, in the order shown, with their titles: the prospect's Review and the advisor's field
 * review group answers the same way, and The Manuscript keeps each answer in the same section.
 */
export const REVIEW_SECTIONS: readonly { key: ReviewSection; title: string }[] = [
  { key: "company", title: "Company" },
  { key: "workforce", title: "Workforce" },
  { key: "locations", title: "Locations" },
  { key: "payroll", title: "Payroll" },
  { key: "benefits", title: "Benefits" },
  { key: "workers_comp", title: "Workers' comp" },
  { key: "operations", title: "Operations & HR" },
];
