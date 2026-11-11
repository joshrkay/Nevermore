import type { CensusEmployee } from "./census";
import type { ENTITY_TYPES } from "../../supabase/functions/_shared/intakeSchema.ts";

export type { CensusDependent, CensusEmployee } from "./census";

export type EntityType = (typeof ENTITY_TYPES)[number];

/** One legal entity of an employer that is more than one (K-1.1). */
export interface LegalEntity {
  legal_name?: string;
  /** Nine digits, no hyphen. */
  fein?: string;
}

/** One owner or officer of the employer (K-3.1). */
export interface OwnerOfficer {
  name?: string;
  title?: string;
  /** Their share of the business, from 0 to 100. */
  ownership_percent?: number;
  /** What they do in the business, as a workers' comp underwriter needs it. */
  duties?: string;
  /** Whether the workers' comp policy covers them (included) or not (excluded). */
  covered?: boolean;
}

/** One policy year of workers' comp loss history (K-3.3). */
export interface LossYear {
  policy_year?: number;
  carrier?: string;
  /** Whole dollars. */
  premium?: number;
  experience_mod?: number;
  /** How many claims; 0 is "no claims". */
  claims?: number;
  /** Whole dollars paid on the year's claims. */
  paid?: number;
  /** Whole dollars reserved for the year's open claims. */
  reserved?: number;
  /** The date the figures are valued as of, as the loss run prints it. */
  valuation_date?: string;
  /** True when the employer had no workers' comp coverage that year. */
  no_coverage?: boolean;
}

export interface ChamberData {
  // Company
  company_name: string | null;
  industry: string | null;
  hq_state: string | null;
  states: string[];
  employee_count: number | null;
  start_month: string | null;
  multiple_entities: boolean | null;
  fein_count: number | null;

  // Benefits
  virgin_medical: boolean | null;
  current_carrier: string | null;
  renewal_date: string | null;
  rate_history: string | null;
  benefits_waiting_period: string | null;
  ancillary_benefits: string[];
  has_401k: boolean | null;
  retirement_type: string | null;
  employer_contributes: boolean | null;

  // Payroll
  payroll_vendor: string | null;
  pay_frequency: string | null;
  funding_days: number | null;
  has_nonexempt: boolean | null;
  nonexempt_count: number | null;
  exempt_count: number | null;
  pto_types: string[];
  accrual_method: string | null;

  // HR / Tech
  has_handbook: boolean | null;
  handbook_last_updated: string | null;
  hr_staff_count: number | null;
  has_1099: boolean | null;
  ca_contractors: boolean | null;
  uses_physical_clocks: boolean | null;
  uses_mobile_app: boolean | null;
  uses_computer_timekeeping: boolean | null;
  shift_differentials: boolean | null;
  hris_system: string | null;
  key_challenges: string | null;
  business_goals: string | null;

  // Workers' comp (intake schema v2)
  wc_carrier: string | null;
  wc_renewal_date: string | null;
  /** Experience modification factor, such as 0.92. */
  wc_experience_mod: number | null;
  /** Whole dollars a year. */
  wc_annual_premium: number | null;

  // Company identity (intake schema v3, K-1.1)
  /** The employer's federal employer identification number: nine digits, no hyphen. */
  fein: string | null;
  entity_type: EntityType | null;
  year_founded: number | null;
  street_address: string | null;
  website: string | null;
  /** Each legal entity, when the employer is more than one. */
  entities: LegalEntity[];

  // Industry as a code and a description (K-1.2); the free-text `industry` stays beside them.
  /** A six-digit 2022 NAICS code. */
  naics_code: string | null;
  /** What the business does, in plain words. */
  operations_description: string | null;

  // Current PEO (K-1.3). `in_peo: false` closes the other two.
  in_peo: boolean | null;
  current_peo: string | null;
  peo_renewal_date: string | null;

  // Workers' comp tables (intake schema v3)
  /** Each owner and officer (K-3.1). */
  owners_officers: OwnerOfficer[];
  /** Up to five policy years of loss history (K-3.3). */
  loss_history: LossYear[];

  // Employees: the canonical census (see supabase/functions/_shared/census.ts)
  census: CensusEmployee[];
}

export const EMPTY_CHAMBER_DATA: ChamberData = {
  company_name: null,
  industry: null,
  hq_state: null,
  states: [],
  employee_count: null,
  start_month: null,
  multiple_entities: null,
  fein_count: null,
  virgin_medical: null,
  current_carrier: null,
  renewal_date: null,
  rate_history: null,
  benefits_waiting_period: null,
  ancillary_benefits: [],
  has_401k: null,
  retirement_type: null,
  employer_contributes: null,
  payroll_vendor: null,
  pay_frequency: null,
  funding_days: null,
  has_nonexempt: null,
  nonexempt_count: null,
  exempt_count: null,
  pto_types: [],
  accrual_method: null,
  has_handbook: null,
  handbook_last_updated: null,
  hr_staff_count: null,
  has_1099: null,
  ca_contractors: null,
  uses_physical_clocks: null,
  uses_mobile_app: null,
  uses_computer_timekeeping: null,
  shift_differentials: null,
  hris_system: null,
  key_challenges: null,
  business_goals: null,
  wc_carrier: null,
  wc_renewal_date: null,
  wc_experience_mod: null,
  wc_annual_premium: null,
  fein: null,
  entity_type: null,
  year_founded: null,
  street_address: null,
  website: null,
  entities: [],
  naics_code: null,
  operations_description: null,
  in_peo: null,
  current_peo: null,
  peo_renewal_date: null,
  owners_officers: [],
  loss_history: [],
  census: [],
};

// Demo data for demo mode
export const DEMO_CHAMBER_DATA: ChamberData = {
  company_name: "Meridian Creative Group",
  industry: "Creative Agency",
  hq_state: "CA",
  states: ["CA", "TX"],
  employee_count: 28,
  start_month: "March 2026",
  multiple_entities: false,
  fein_count: 1,
  virgin_medical: false,
  current_carrier: "Blue Shield",
  renewal_date: "June 2026",
  rate_history: "12% increase last year",
  benefits_waiting_period: "30 days",
  ancillary_benefits: ["Life Insurance", "FSA", "EAP"],
  has_401k: true,
  retirement_type: "Safe Harbor 401k",
  employer_contributes: true,
  payroll_vendor: "ADP Run",
  pay_frequency: "Bi-weekly",
  funding_days: 2,
  has_nonexempt: true,
  nonexempt_count: 8,
  exempt_count: 20,
  pto_types: ["Vacation", "Sick", "Personal"],
  accrual_method: "Annual accrual",
  has_handbook: true,
  handbook_last_updated: "2024",
  hr_staff_count: 1,
  has_1099: true,
  ca_contractors: false,
  uses_physical_clocks: false,
  uses_mobile_app: true,
  uses_computer_timekeeping: true,
  shift_differentials: false,
  hris_system: "Google Sheets",
  key_challenges: "Compliance with CA employment law, managing multi-state payroll",
  business_goals: "Scale to 50 employees, offer competitive benefits to attract talent",
  wc_carrier: "Pinnacle Mutual",
  wc_renewal_date: "July 2026",
  wc_experience_mod: 0.92,
  wc_annual_premium: 18400,
  fein: "841234567",
  entity_type: "llc",
  year_founded: 2014,
  street_address: "500 Harbor Street, Suite 300, San Francisco, CA 94107",
  website: "meridiancreative.example",
  entities: [],
  naics_code: "541430",
  operations_description: "Brand, packaging and campaign design for consumer goods companies, from one studio.",
  in_peo: true,
  current_peo: "Summit Employer Services",
  peo_renewal_date: "January 2027",
  owners_officers: [
    { name: "Dana Reyes", title: "Chief Executive Officer", ownership_percent: 60, duties: "Runs the studio and client accounts; office work only", covered: false },
    { name: "Marcus Rivera", title: "Art Director", ownership_percent: 40, duties: "Leads design; on the census as an employee", covered: true },
  ],
  loss_history: [
    { policy_year: 2025, carrier: "Pinnacle Mutual", premium: 18400, experience_mod: 0.92, claims: 1, paid: 3200, reserved: 0, valuation_date: "2026-09-30" },
    { policy_year: 2024, carrier: "Pinnacle Mutual", premium: 17100, experience_mod: 0.95, claims: 0, paid: 0, reserved: 0, valuation_date: "2026-09-30" },
    { policy_year: 2023, carrier: "Pinnacle Mutual", premium: 16300, experience_mod: 0.97, claims: 0, paid: 0, reserved: 0, valuation_date: "2026-09-30" },
  ],
  census: [
    { id: "6f1c2a40-0001-4c1e-9a7b-3d5e00000001", first_name: "Sarah", last_name: "Chen", dob: "1988-03-15", work_state: "CA", zip_code: "94107", job_title: "Senior Designer", annual_salary: 105000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "FAM", class_code: "8810", dependents: [{ first_name: "Michael", last_name: "Chen", dob: "1985-06-12", relationship: "spouse" }, { first_name: "Emma", last_name: "Chen", dob: "2018-03-22", relationship: "child" }] },
    { id: "6f1c2a40-0002-4c1e-9a7b-3d5e00000002", first_name: "Marcus", last_name: "Rivera", dob: "1985-07-22", work_state: "CA", zip_code: "94110", job_title: "Art Director", annual_salary: 125000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "EE+SP", class_code: "8810", dependents: [{ first_name: "Ana", last_name: "Rivera", dob: "1987-09-04", relationship: "spouse" }] },
    { id: "6f1c2a40-0003-4c1e-9a7b-3d5e00000003", first_name: "Aisha", last_name: "Patel", dob: "1990-11-08", work_state: "CA", zip_code: "94612", job_title: "UX Researcher", annual_salary: 98000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "EE", class_code: "8810" },
    { id: "6f1c2a40-0004-4c1e-9a7b-3d5e00000004", first_name: "James", last_name: "O'Brien", dob: "1992-01-30", work_state: "TX", zip_code: "78701", job_title: "Copywriter", annual_salary: 78000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "EE", class_code: "8810" },
    { id: "6f1c2a40-0005-4c1e-9a7b-3d5e00000005", first_name: "Lisa", last_name: "Tanaka", dob: "1987-09-12", work_state: "CA", zip_code: "94103", job_title: "Project Manager", annual_salary: 110000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "FAM", class_code: "8810", dependents: [{ first_name: "Kenji", last_name: "Tanaka", dob: "2015-05-18", relationship: "child" }, { first_name: "Yuki", last_name: "Tanaka", dob: "2019-11-02", relationship: "child" }, { first_name: "Hiro", last_name: "Tanaka", dob: "1986-02-14", relationship: "spouse" }] },
    { id: "6f1c2a40-0006-4c1e-9a7b-3d5e00000006", first_name: "Tom", last_name: "Bradley", dob: "1994-02-14", work_state: "TX", zip_code: "78702", job_title: "Freelance Illustrator", annual_salary: 72000, compensation_type: "salary", employment_type: "full_time", classification: "1099" },
  ],
};
