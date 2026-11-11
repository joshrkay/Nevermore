-- Intake schema v3, part 8: workers' comp loss history by year (Epic K, story K-3.3).
--
-- One top-level chamber_data key joins the intake:
--   loss_history  'rows': up to five policy years, each as { policy_year, carrier, premium, experience_mod,
--                 claims, paid, reserved, valuation_date, no_coverage }. `claims: 0` is "no claims" and
--                 `no_coverage: true` is "no prior coverage" that year: both are answers.
--
-- chamber_data_field_kind, chamber_data_row_field_kind and chamber_data_row_list_max are the 20261112096000
-- definitions with this list added, and nothing else changed.

-- The kind of each key inside a list of rows; NULL for a key the list does not have.
CREATE OR REPLACE FUNCTION public.chamber_data_row_field_kind(list text, key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    -- sync:begin row_field_kinds
    WHEN list = 'entities' AND key IN ('legal_name') THEN 'text'
    WHEN list = 'entities' AND key IN ('fein') THEN 'fein'
    -- v3, K-3.1
    WHEN list = 'owners_officers' AND key IN ('name', 'title') THEN 'name'
    WHEN list = 'owners_officers' AND key IN ('ownership_percent') THEN 'percent'
    WHEN list = 'owners_officers' AND key IN ('duties') THEN 'text'
    WHEN list = 'owners_officers' AND key IN ('covered') THEN 'boolean'
    -- v3, K-3.3
    WHEN list = 'loss_history' AND key IN ('policy_year') THEN 'year'
    WHEN list = 'loss_history' AND key IN ('carrier', 'valuation_date') THEN 'name'
    WHEN list = 'loss_history' AND key IN ('premium', 'paid', 'reserved') THEN 'dollars'
    WHEN list = 'loss_history' AND key IN ('experience_mod') THEN 'experience_mod'
    WHEN list = 'loss_history' AND key IN ('claims') THEN 'count'
    WHEN list = 'loss_history' AND key IN ('no_coverage') THEN 'boolean'
    -- sync:end row_field_kinds
  END;
$$;

-- How many rows each list of rows may hold.
CREATE OR REPLACE FUNCTION public.chamber_data_row_list_max(list text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    -- sync:begin row_caps
    WHEN list = 'entities' THEN 50
    WHEN list = 'owners_officers' THEN 20
    WHEN list = 'loss_history' THEN 5
    -- sync:end row_caps
  END;
$$;

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
    WHEN field IN ('entities', 'owners_officers', 'loss_history') THEN 'rows'
    -- v3, K-1.2
    WHEN field = 'operations_description' THEN 'text'
    WHEN field = 'naics_code' THEN 'naics'
    -- v3, K-1.3
    WHEN field IN ('current_peo', 'peo_renewal_date') THEN 'text'
    WHEN field = 'in_peo' THEN 'boolean'
    WHEN field = 'employees' THEN 'employees'
    WHEN field = 'census' THEN 'census'
    -- sync:end field_kinds
  END;
$$;

REVOKE ALL ON FUNCTION public.chamber_data_field_kind(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_row_field_kind(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_row_list_max(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamber_data_field_kind(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_row_field_kind(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_row_list_max(text) TO authenticated, service_role;
