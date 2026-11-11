-- Intake schema v3, part 7: owners and officers (Epic K, story K-3.1).
--
-- One top-level chamber_data key joins the intake:
--   owners_officers  'rows': up to 20 people, each as { name, title, ownership_percent, duties, covered }, so a
--                    workers' comp underwriter can price who is included in coverage and who is excluded
--
-- chamber_data_scalar_reason gains the kinds v3's lists of rows are made of, here and in the stories after this
-- one (loss history, medical plans, unemployment rates): 'name', 'boolean', 'count', 'dollars',
-- 'experience_mod', 'percent', 'money' and 'state'. A list's own migration then only names its keys.
-- chamber_data_field_kind, chamber_data_row_field_kind and chamber_data_row_list_max are the earlier v3
-- definitions with this list added, and nothing else changed.

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
  max_name constant integer := 200;
  max_count constant integer := 1000000;
  max_dollars constant integer := 100000000;
  max_experience_mod constant integer := 10;
  max_percent constant integer := 100;
  max_money constant integer := 1000000;
  -- sync:end caps
  min_year constant integer := 1600;
BEGIN
  CASE kind
    WHEN 'text' THEN
      IF NOT public.chamber_data_is_text(val, max_text) THEN
        RETURN format('must be text of at most %s characters', max_text);
      END IF;
    -- A name or a title: shorter than free text.
    WHEN 'name' THEN
      IF NOT public.chamber_data_is_text(val, max_name) THEN
        RETURN format('must be text of at most %s characters', max_name);
      END IF;
    WHEN 'boolean' THEN
      IF jsonb_typeof(val) <> 'boolean' THEN
        RETURN 'must be true or false';
      END IF;
    WHEN 'count' THEN
      IF NOT public.chamber_data_is_whole_number(val, max_count) THEN
        RETURN 'must be a whole number from 0 to 1,000,000';
      END IF;
    WHEN 'dollars' THEN
      IF NOT public.chamber_data_is_whole_number(val, max_dollars) THEN
        RETURN 'must be a whole number of dollars from 0 to 100,000,000';
      END IF;
    -- A CASE, not AND, in each of the next three: SQL may evaluate both sides of AND, and a string can't be
    -- cast to a number.
    WHEN 'experience_mod' THEN
      IF NOT (CASE WHEN jsonb_typeof(val) = 'number' THEN (val #>> '{}')::numeric BETWEEN 0 AND max_experience_mod ELSE false END) THEN
        RETURN format('must be a number from 0 to %s', max_experience_mod);
      END IF;
    -- A share or a rate, as a percentage.
    WHEN 'percent' THEN
      IF NOT (CASE WHEN jsonb_typeof(val) = 'number' THEN (val #>> '{}')::numeric BETWEEN 0 AND max_percent ELSE false END) THEN
        RETURN format('must be a number from 0 to %s', max_percent);
      END IF;
    -- An amount with cents, such as a monthly premium rate.
    WHEN 'money' THEN
      IF NOT (CASE WHEN jsonb_typeof(val) = 'number' THEN (val #>> '{}')::numeric BETWEEN 0 AND max_money ELSE false END) THEN
        RETURN 'must be an amount from 0 to 1,000,000';
      END IF;
    WHEN 'state' THEN
      IF NOT (jsonb_typeof(val) = 'string' AND public.is_us_state_code(val #>> '{}')) THEN
        RETURN 'must be a US state or territory code such as CA';
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
    WHEN field IN ('entities', 'owners_officers') THEN 'rows'
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
REVOKE ALL ON FUNCTION public.chamber_data_scalar_reason(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_row_field_kind(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_row_list_max(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamber_data_field_kind(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_scalar_reason(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_row_field_kind(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_row_list_max(text) TO authenticated, service_role;
