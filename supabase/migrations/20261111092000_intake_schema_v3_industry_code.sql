-- Intake schema v3, part 3: the industry as a code and a description (Epic K, story K-1.2).
--
-- Two top-level chamber_data keys join the intake, beside the free-text `industry`, which stays:
--   naics_code              'naics': a NAICS industry code, as its six digits. Which six digits name an industry
--                           changes with each NAICS edition, so the database holds the shape only; the browser
--                           and chat extraction hold a code to the 2022 edition (naics2022.ts)
--   operations_description  text: what the business does, in plain words
--
-- chamber_data_field_kind and chamber_data_scalar_reason are the 20261111091000 definitions with these keys
-- and the one kind added, and nothing else changed.

-- Why one value breaks the rule of its kind; NULL when it is acceptable. The value is never null here:
-- the caller decides whether null is allowed. An unknown kind is "not a known intake field".
CREATE OR REPLACE FUNCTION public.chamber_data_scalar_reason(kind text, val jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  -- sync:begin caps
  max_text constant integer := 1000;
  max_year constant integer := 2100;
  -- sync:end caps
  min_year constant integer := 1600;
BEGIN
  CASE kind
    WHEN 'text' THEN
      IF NOT public.chamber_data_is_text(val, max_text) THEN
        RETURN format('must be text of at most %s characters', max_text);
      END IF;
    WHEN 'fein' THEN
      -- A CASE, not AND: SQL may evaluate both sides of AND, and only a string can be matched.
      IF NOT (CASE WHEN jsonb_typeof(val) = 'string' THEN val #>> '{}' ~ '^[0-9]{9}$' ELSE false END) THEN
        RETURN 'must be nine digits, such as 123456789';
      END IF;
    WHEN 'naics' THEN
      IF NOT (CASE WHEN jsonb_typeof(val) = 'string' THEN val #>> '{}' ~ '^[0-9]{6}$' ELSE false END) THEN
        RETURN 'must be a six-digit NAICS code, such as 541430';
      END IF;
    WHEN 'entity_type' THEN
      IF NOT (jsonb_typeof(val) = 'string' AND val #>> '{}' IN (
        -- sync:begin entity_types
        'sole_proprietorship', 'partnership', 'llc', 'c_corporation', 's_corporation', 'nonprofit', 'other'
        -- sync:end entity_types
      )) THEN
        RETURN 'must be sole_proprietorship, partnership, llc, c_corporation, s_corporation, nonprofit or other';
      END IF;
    WHEN 'year' THEN
      IF NOT (public.chamber_data_is_whole_number(val, max_year) AND (val #>> '{}')::numeric >= min_year) THEN
        RETURN format('must be a year from %s to %s', min_year, max_year);
      END IF;
    ELSE
      RETURN 'is not a known intake field';
  END CASE;
  RETURN NULL;
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
    WHEN field IN ('entities') THEN 'rows'
    -- v3, K-1.2
    WHEN field = 'operations_description' THEN 'text'
    WHEN field = 'naics_code' THEN 'naics'
    WHEN field = 'employees' THEN 'employees'
    WHEN field = 'census' THEN 'census'
    -- sync:end field_kinds
  END;
$$;

-- CREATE OR REPLACE keeps the grants 20261111091000 gave these functions; they are repeated here so this
-- file reads on its own.
REVOKE ALL ON FUNCTION public.chamber_data_field_kind(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_scalar_reason(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamber_data_field_kind(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_scalar_reason(text, jsonb) TO authenticated, service_role;
