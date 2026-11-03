-- Intake schema v2, part 1: the workers' comp block (US-2.1a, decision D18).
--
-- Four top-level chamber_data keys join the intake:
--   wc_carrier         text, as the other text answers
--   wc_renewal_date    text (dates are free text, as renewal_date is)
--   wc_experience_mod  'experience_mod': a JSON number from 0 to max_experience_mod (an experience
--                      modification factor such as 0.92; fractions are the point, so it is not a count)
--   wc_annual_premium  'dollars': whole dollars from 0 to max_dollars (a premium can pass the 1,000,000
--                      that caps counts and salaries)
--
-- chamber_data_field_kind and chamber_data_error are the 20261029092000 definitions with these keys and
-- the two kinds added, and nothing else changed. src/data/schemaSync.test.ts compares the `sync:` blocks
-- with the client and intake schema v2 (supabase/functions/_shared/intakeSchema.ts), reading each block
-- from the latest migration that defines its function.
--
-- Deploy before the front end that sends the new keys: the database refuses an unknown top-level key, so
-- a front end shipped first would fail every save that holds one. Part 2 (20261103120100) records
-- schema version 2 on every intake.

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
    WHEN field = 'employees' THEN 'employees'
    WHEN field = 'census' THEN 'census'
    -- sync:end field_kinds
  END;
$$;

-- The first rule an intake breaks, as a path and a reason; both NULL when chamber_data is acceptable.
CREATE OR REPLACE FUNCTION public.chamber_data_error(d jsonb, OUT path text, OUT reason text)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  -- sync:begin caps
  max_employees constant integer := 5000;
  max_dependents constant integer := 20;
  max_states constant integer := 60;
  max_list_items constant integer := 100;
  max_text constant integer := 1000;
  max_count constant integer := 1000000;
  max_salary constant integer := 1000000;
  max_name constant integer := 200;
  max_experience_mod constant integer := 10;
  max_dollars constant integer := 100000000;
  -- sync:end caps
  count_reason constant text := 'must be a whole number from 0 to 1,000,000';
  state_reason constant text := 'must be a US state or territory code such as CA';
  key text;
  val jsonb;
  item jsonb;
  employee jsonb;
  dependent jsonb;
  ekey text;
  eval jsonb;
  i integer;
  j integer;
BEGIN
  IF jsonb_typeof(d) IS DISTINCT FROM 'object' THEN
    path := 'chamber_data'; reason := 'must be an object'; RETURN;
  END IF;

  FOR key, val IN SELECT * FROM jsonb_each(d) LOOP
    CASE public.chamber_data_field_kind(key)
      WHEN 'text' THEN
        IF jsonb_typeof(val) <> 'null' AND NOT public.chamber_data_is_text(val, max_text) THEN
          path := key; reason := format('must be text of at most %s characters', max_text); RETURN;
        END IF;

      WHEN 'count' THEN
        IF jsonb_typeof(val) <> 'null' AND NOT public.chamber_data_is_whole_number(val, max_count) THEN
          path := key; reason := count_reason; RETURN;
        END IF;

      WHEN 'experience_mod' THEN
        -- A CASE, not AND: SQL may evaluate both sides of AND, and a string can't be cast to a number.
        IF jsonb_typeof(val) <> 'null' AND NOT (CASE WHEN jsonb_typeof(val) = 'number'
            THEN (val #>> '{}')::numeric BETWEEN 0 AND max_experience_mod ELSE false END) THEN
          path := key; reason := format('must be a number from 0 to %s', max_experience_mod); RETURN;
        END IF;

      WHEN 'dollars' THEN
        IF jsonb_typeof(val) <> 'null' AND NOT public.chamber_data_is_whole_number(val, max_dollars) THEN
          path := key; reason := 'must be a whole number of dollars from 0 to 100,000,000'; RETURN;
        END IF;

      WHEN 'boolean' THEN
        IF jsonb_typeof(val) NOT IN ('null', 'boolean') THEN
          path := key; reason := 'must be true or false'; RETURN;
        END IF;

      WHEN 'state' THEN
        IF jsonb_typeof(val) <> 'null' AND NOT (jsonb_typeof(val) = 'string' AND public.is_us_state_code(val #>> '{}')) THEN
          path := key; reason := state_reason; RETURN;
        END IF;

      WHEN 'state_list' THEN
        IF jsonb_typeof(val) <> 'array' THEN
          path := key; reason := 'must be a list of state codes'; RETURN;
        END IF;
        IF jsonb_array_length(val) > max_states THEN
          path := key; reason := format('must have at most %s entries', max_states); RETURN;
        END IF;
        i := 0;
        FOR item IN SELECT * FROM jsonb_array_elements(val) LOOP
          IF NOT (jsonb_typeof(item) = 'string' AND public.is_us_state_code(item #>> '{}')) THEN
            path := format('%s[%s]', key, i); reason := state_reason; RETURN;
          END IF;
          i := i + 1;
        END LOOP;

      WHEN 'text_list' THEN
        IF jsonb_typeof(val) <> 'array' THEN
          path := key; reason := 'must be a list'; RETURN;
        END IF;
        IF jsonb_array_length(val) > max_list_items THEN
          path := key; reason := format('must have at most %s entries', max_list_items); RETURN;
        END IF;
        i := 0;
        FOR item IN SELECT * FROM jsonb_array_elements(val) LOOP
          IF NOT public.chamber_data_is_text(item, max_text) THEN
            path := format('%s[%s]', key, i); reason := format('must be text of at most %s characters', max_text); RETURN;
          END IF;
          i := i + 1;
        END LOOP;

      WHEN 'employees' THEN
        IF jsonb_typeof(val) <> 'array' THEN
          path := key; reason := 'must be a list'; RETURN;
        END IF;
        IF jsonb_array_length(val) > max_employees THEN
          path := key; reason := format('must have at most %s entries', max_employees); RETURN;
        END IF;
        i := 0;
        FOR employee IN SELECT * FROM jsonb_array_elements(val) LOOP
          SELECT e.path, e.reason INTO path, reason
            FROM public.chamber_data_person_error(employee, format('employees[%s]', i)) e;
          IF path IS NOT NULL THEN RETURN; END IF;

          FOR ekey, eval IN SELECT * FROM jsonb_each(employee) LOOP
            CASE ekey
              WHEN 'title' THEN
                IF NOT public.chamber_data_is_text(eval, max_name) THEN
                  path := format('employees[%s].title', i); reason := format('must be text of at most %s characters', max_name); RETURN;
                END IF;
              WHEN 'state' THEN
                -- Blank means the roster did not say; it is not a null.
                IF NOT (jsonb_typeof(eval) = 'string' AND (eval #>> '{}' = '' OR public.is_us_state_code(eval #>> '{}'))) THEN
                  path := format('employees[%s].state', i); reason := 'must be blank or a US state or territory code such as CA'; RETURN;
                END IF;
              WHEN 'salary' THEN
                IF jsonb_typeof(eval) <> 'null' AND NOT public.chamber_data_is_whole_number(eval, max_salary) THEN
                  path := format('employees[%s].salary', i); reason := count_reason; RETURN;
                END IF;
              WHEN 'classification' THEN
                IF NOT (jsonb_typeof(eval) = 'string' AND eval #>> '{}' IN ('W2', '1099')) THEN
                  path := format('employees[%s].classification', i); reason := 'must be W2 or 1099'; RETURN;
                END IF;
              WHEN 'dependents' THEN
                IF jsonb_typeof(eval) <> 'array' THEN
                  path := format('employees[%s].dependents', i); reason := 'must be a list'; RETURN;
                END IF;
                IF jsonb_array_length(eval) > max_dependents THEN
                  path := format('employees[%s].dependents', i); reason := format('must have at most %s entries', max_dependents); RETURN;
                END IF;
                j := 0;
                FOR dependent IN SELECT * FROM jsonb_array_elements(eval) LOOP
                  SELECT e.path, e.reason INTO path, reason
                    FROM public.chamber_data_person_error(dependent, format('employees[%s].dependents[%s]', i, j)) e;
                  IF path IS NOT NULL THEN RETURN; END IF;
                  IF dependent ? 'relationship'
                     AND NOT (jsonb_typeof(dependent -> 'relationship') = 'string'
                              AND dependent ->> 'relationship' IN ('spouse', 'domestic_partner', 'child', 'other')) THEN
                    path := format('employees[%s].dependents[%s].relationship', i, j);
                    reason := 'must be spouse, domestic_partner, child or other'; RETURN;
                  END IF;
                  j := j + 1;
                END LOOP;
              ELSE
                NULL; -- unknown employee keys are tolerated so an older client can save a newer census
            END CASE;
          END LOOP;
          i := i + 1;
        END LOOP;

      WHEN 'census' THEN
        IF jsonb_typeof(val) <> 'array' THEN
          path := key; reason := 'must be a list'; RETURN;
        END IF;
        IF jsonb_array_length(val) > max_employees THEN
          path := key; reason := format('must have at most %s entries', max_employees); RETURN;
        END IF;
        i := 0;
        FOR employee IN SELECT * FROM jsonb_array_elements(val) LOOP
          SELECT e.path, e.reason INTO path, reason
            FROM public.chamber_data_census_row_error(employee, format('census[%s]', i)) e;
          IF path IS NOT NULL THEN RETURN; END IF;
          i := i + 1;
        END LOOP;

      ELSE
        path := key; reason := 'is not a known intake field'; RETURN;
    END CASE;
  END LOOP;
END;
$$;

-- CREATE OR REPLACE keeps the grants 20261027090000 gave these functions; they are repeated here so this
-- file reads on its own.
REVOKE ALL ON FUNCTION public.chamber_data_field_kind(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_error(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamber_data_field_kind(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_error(jsonb) TO authenticated, service_role;
