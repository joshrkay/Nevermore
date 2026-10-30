import type { CensusEmployee } from "./census";

export type { CensusDependent, CensusEmployee } from "./census";

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
  census: [
    { id: "6f1c2a40-0001-4c1e-9a7b-3d5e00000001", first_name: "Sarah", last_name: "Chen", dob: "1988-03-15", work_state: "CA", zip_code: "94107", job_title: "Senior Designer", annual_salary: 105000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "FAM", class_code: "8810", dependents: [{ first_name: "Michael", last_name: "Chen", dob: "1985-06-12", relationship: "spouse" }, { first_name: "Emma", last_name: "Chen", dob: "2018-03-22", relationship: "child" }] },
    { id: "6f1c2a40-0002-4c1e-9a7b-3d5e00000002", first_name: "Marcus", last_name: "Rivera", dob: "1985-07-22", work_state: "CA", zip_code: "94110", job_title: "Art Director", annual_salary: 125000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "EE+SP", class_code: "8810", dependents: [{ first_name: "Ana", last_name: "Rivera", dob: "1987-09-04", relationship: "spouse" }] },
    { id: "6f1c2a40-0003-4c1e-9a7b-3d5e00000003", first_name: "Aisha", last_name: "Patel", dob: "1990-11-08", work_state: "CA", zip_code: "94612", job_title: "UX Researcher", annual_salary: 98000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "EE", class_code: "8810" },
    { id: "6f1c2a40-0004-4c1e-9a7b-3d5e00000004", first_name: "James", last_name: "O'Brien", dob: "1992-01-30", work_state: "TX", zip_code: "78701", job_title: "Copywriter", annual_salary: 78000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "EE", class_code: "8810" },
    { id: "6f1c2a40-0005-4c1e-9a7b-3d5e00000005", first_name: "Lisa", last_name: "Tanaka", dob: "1987-09-12", work_state: "CA", zip_code: "94103", job_title: "Project Manager", annual_salary: 110000, compensation_type: "salary", employment_type: "full_time", classification: "w2", coverage_tier: "FAM", class_code: "8810", dependents: [{ first_name: "Kenji", last_name: "Tanaka", dob: "2015-05-18", relationship: "child" }, { first_name: "Yuki", last_name: "Tanaka", dob: "2019-11-02", relationship: "child" }, { first_name: "Hiro", last_name: "Tanaka", dob: "1986-02-14", relationship: "spouse" }] },
    { id: "6f1c2a40-0006-4c1e-9a7b-3d5e00000006", first_name: "Tom", last_name: "Bradley", dob: "1994-02-14", work_state: "TX", zip_code: "78702", job_title: "Freelance Illustrator", annual_salary: 72000, compensation_type: "salary", employment_type: "full_time", classification: "1099" },
  ],
};
