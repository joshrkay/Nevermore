-- Intake schema v3, part 11: the standard workers' comp questions (Epic K, story K-3.4).
--
-- Forty-eight top-level chamber_data keys join the intake, two for each of the 24 yes/no questions in the
-- general information section of ACORD 130, the Workers Compensation Application (edition 2017/05):
--   wcq_01 .. wcq_24                  boolean: the answer
--   wcq_01_explain .. wcq_24_explain  text: the explanation the form asks for with a "yes"
-- The questions' wording is in supabase/functions/_shared/acord130.ts. Which of them are marked "Doesn't
-- apply" or answered from the census is decided in the browser; the database stores what it is given.
--
-- chamber_data_field_kind is the 20261111099000 definition with these keys added, and nothing else changed.

-- How each top-level chamber_data key is checked; NULL for a key that is not part of the intake.
CREATE OR REPLACE FUNCTION public.chamber_data_field_kind(field text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    -- sync:begin field_kinds
    WHEN field IN ('company_name', 'industry', 'start_month', 'current_carrier', 'renewal_date', 'rate_history',
      'benefits_waiting_period', 'retirement_type', 'payroll_vendor', 'pay_frequency', 'accrual_method',
      'handbook_last_updated', 'hris_system', 'key_challenges', 'business_goals', 'wc_carrier',
      'wc_renewal_date') THEN 'text'
    WHEN field IN ('employee_count', 'fein_count', 'funding_days', 'nonexempt_count', 'exempt_count',
      'hr_staff_count') THEN 'count'
    WHEN field IN ('multiple_entities', 'virgin_medical', 'has_401k', 'employer_contributes', 'has_nonexempt',
      'has_handbook', 'has_1099', 'ca_contractors', 'uses_physical_clocks', 'uses_mobile_app',
      'uses_computer_timekeeping', 'shift_differentials') THEN 'boolean'
    WHEN field = 'hq_state' THEN 'state'
    WHEN field = 'states' THEN 'state_list'
    WHEN field IN ('ancillary_benefits', 'pto_types') THEN 'text_list'
    WHEN field = 'wc_experience_mod' THEN 'experience_mod'
    WHEN field = 'wc_annual_premium' THEN 'dollars'
    -- v3, K-1.1
    WHEN field IN ('street_address', 'website') THEN 'text'
    WHEN field = 'fein' THEN 'fein'
    WHEN field = 'entity_type' THEN 'entity_type'
    WHEN field = 'year_founded' THEN 'year'
    WHEN field IN ('entities', 'owners_officers', 'loss_history', 'medical_plans', 'suta_rates') THEN 'rows'
    -- v3, K-1.2
    WHEN field = 'operations_description' THEN 'text'
    WHEN field = 'naics_code' THEN 'naics'
    -- v3, K-1.3
    WHEN field IN ('current_peo', 'peo_renewal_date') THEN 'text'
    WHEN field = 'in_peo' THEN 'boolean'
    -- v3, K-3.4: the 24 ACORD 130 general information questions, each a yes or no with a text explanation
    WHEN field IN (
      'wcq_01', 'wcq_02', 'wcq_03', 'wcq_04', 'wcq_05', 'wcq_06',
      'wcq_07', 'wcq_08', 'wcq_09', 'wcq_10', 'wcq_11', 'wcq_12',
      'wcq_13', 'wcq_14', 'wcq_15', 'wcq_16', 'wcq_17', 'wcq_18',
      'wcq_19', 'wcq_20', 'wcq_21', 'wcq_22', 'wcq_23', 'wcq_24') THEN 'boolean'
    WHEN field IN (
      'wcq_01_explain', 'wcq_02_explain', 'wcq_03_explain', 'wcq_04_explain',
      'wcq_05_explain', 'wcq_06_explain', 'wcq_07_explain', 'wcq_08_explain',
      'wcq_09_explain', 'wcq_10_explain', 'wcq_11_explain', 'wcq_12_explain',
      'wcq_13_explain', 'wcq_14_explain', 'wcq_15_explain', 'wcq_16_explain',
      'wcq_17_explain', 'wcq_18_explain', 'wcq_19_explain', 'wcq_20_explain',
      'wcq_21_explain', 'wcq_22_explain', 'wcq_23_explain', 'wcq_24_explain') THEN 'text'
    WHEN field = 'employees' THEN 'employees'
    WHEN field = 'census' THEN 'census'
    -- sync:end field_kinds
  END;
$$;

REVOKE ALL ON FUNCTION public.chamber_data_field_kind(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamber_data_field_kind(text) TO authenticated, service_role;
