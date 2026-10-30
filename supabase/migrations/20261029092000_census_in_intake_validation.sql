-- The intake database knows the census (20261027090000 knew only the older roster, `employees`).
--
-- chamber_data.census is the employee census (see supabase/functions/_shared/census.ts): rows of
-- { id, first_name, last_name, dob, age, work_state, zip_code, job_title, annual_salary, compensation_type,
-- employment_type, classification, coverage_tier, class_code, dependents }. Without this, every save of an
-- intake holding a `census` key would be refused as 'is not a known intake field'.
--
-- * `employees` stays valid. Intakes saved before the census, and a browser that has not yet loaded the
--   version that writes `census`, still write it, and the front end reads it as `census`. Deploy this
--   migration before the front end, as with 20261027090000.
-- * The same caps apply: at most max_employees rows, pay up to max_salary, state codes from
--   is_us_state_code. A census row is checked like an employee (chamber_data_person_error) and then by
--   its own facts. The allowed values of each fact are marked `sync:begin` / `sync:end` and compared with
--   the front end's by src/data/schemaSync.test.ts, which reads the latest definition of each block.
--
-- chamber_data_field_kind and chamber_data_error are the 20261027090000 definitions with the `census`
-- case added, and nothing else changed.

-- One census row: the shared person rules (name, last name, date of birth) and the facts a census row
-- carries. base is the path of the row, for example census[3]. Unknown keys are tolerated, as in employees.
CREATE OR REPLACE FUNCTION public.chamber_data_census_row_error(census_row jsonb, base text, OUT path text, OUT reason text)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  -- sync:begin caps
  max_dependents constant integer := 20;
  max_text constant integer := 1000;
  max_salary constant integer := 1000000;
  max_name constant integer := 200;
  -- sync:end caps
  count_reason constant text := 'must be a whole number from 0 to 1,000,000';
  rkey text;
  rval jsonb;
  dependent jsonb;
  j integer;
BEGIN
  SELECT p.path, p.reason INTO path, reason FROM public.chamber_data_person_error(census_row, base) p;
  IF path IS NOT NULL THEN RETURN; END IF;

  FOR rkey, rval IN SELECT * FROM jsonb_each(census_row) LOOP
    CASE rkey
      WHEN 'id' THEN
        IF NOT (public.chamber_data_is_text(rval, 64) AND btrim(rval #>> '{}') <> '') THEN
          path := base || '.id'; reason := 'must be non-blank text of at most 64 characters'; RETURN;
        END IF;
      WHEN 'age' THEN
        IF NOT (public.chamber_data_is_whole_number(rval, 100) AND (rval #>> '{}')::numeric >= 14) THEN
          path := base || '.age'; reason := 'must be a whole number from 14 to 100'; RETURN;
        END IF;
      WHEN 'work_state' THEN
        -- Blank means the census did not say; it is not a null.
        IF NOT (jsonb_typeof(rval) = 'string' AND (rval #>> '{}' = '' OR public.is_us_state_code(rval #>> '{}'))) THEN
          path := base || '.work_state'; reason := 'must be blank or a US state or territory code such as CA'; RETURN;
        END IF;
      WHEN 'zip_code' THEN
        IF NOT (jsonb_typeof(rval) = 'string' AND rval #>> '{}' ~ '^[0-9]{5}(-[0-9]{4})?$') THEN
          path := base || '.zip_code'; reason := 'must be a ZIP code such as 94107 or 94107-1234'; RETURN;
        END IF;
      WHEN 'job_title' THEN
        IF NOT public.chamber_data_is_text(rval, max_name) THEN
          path := base || '.job_title'; reason := format('must be text of at most %s characters', max_name); RETURN;
        END IF;
      WHEN 'annual_salary' THEN
        IF NOT public.chamber_data_is_whole_number(rval, max_salary) THEN
          path := base || '.annual_salary'; reason := count_reason; RETURN;
        END IF;
      WHEN 'compensation_type' THEN
        IF NOT (jsonb_typeof(rval) = 'string' AND rval #>> '{}' IN (
          -- sync:begin census_compensation_types
          'salary', 'hourly'
          -- sync:end census_compensation_types
        )) THEN
          path := base || '.compensation_type'; reason := 'must be salary or hourly'; RETURN;
        END IF;
      WHEN 'employment_type' THEN
        IF NOT (jsonb_typeof(rval) = 'string' AND rval #>> '{}' IN (
          -- sync:begin census_employment_types
          'full_time', 'part_time'
          -- sync:end census_employment_types
        )) THEN
          path := base || '.employment_type'; reason := 'must be full_time or part_time'; RETURN;
        END IF;
      WHEN 'classification' THEN
        IF NOT (jsonb_typeof(rval) = 'string' AND rval #>> '{}' IN (
          -- sync:begin census_classifications
          'w2', '1099'
          -- sync:end census_classifications
        )) THEN
          path := base || '.classification'; reason := 'must be w2 or 1099'; RETURN;
        END IF;
      WHEN 'coverage_tier' THEN
        IF NOT (jsonb_typeof(rval) = 'string' AND rval #>> '{}' IN (
          -- sync:begin census_coverage_tiers
          'EE', 'EE+SP', 'EE+CH', 'FAM', 'WAIVE'
          -- sync:end census_coverage_tiers
        )) THEN
          path := base || '.coverage_tier'; reason := 'must be EE, EE+SP, EE+CH, FAM or WAIVE'; RETURN;
        END IF;
      WHEN 'class_code' THEN
        IF NOT (jsonb_typeof(rval) = 'string' AND rval #>> '{}' ~ '^[0-9]{4}$') THEN
          path := base || '.class_code'; reason := 'must be a four-digit workers'' comp class code'; RETURN;
        END IF;
      WHEN 'dependents' THEN
        IF jsonb_typeof(rval) <> 'array' THEN
          path := base || '.dependents'; reason := 'must be a list'; RETURN;
        END IF;
        IF jsonb_array_length(rval) > max_dependents THEN
          path := base || '.dependents'; reason := format('must have at most %s entries', max_dependents); RETURN;
        END IF;
        j := 0;
        FOR dependent IN SELECT * FROM jsonb_array_elements(rval) LOOP
          SELECT d.path, d.reason INTO path, reason
            FROM public.chamber_data_person_error(dependent, format('%s.dependents[%s]', base, j)) d;
          IF path IS NOT NULL THEN RETURN; END IF;
          IF dependent ? 'relationship'
             AND NOT (jsonb_typeof(dependent -> 'relationship') = 'string'
                      AND dependent ->> 'relationship' IN ('spouse', 'domestic_partner', 'child', 'other')) THEN
            path := format('%s.dependents[%s].relationship', base, j);
            reason := 'must be spouse, domestic_partner, child or other'; RETURN;
          END IF;
          j := j + 1;
        END LOOP;
      ELSE
        NULL; -- unknown keys are tolerated so an older client can save a newer census
    END CASE;
  END LOOP;
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
      'handbook_last_updated', 'hris_system', 'key_challenges', 'business_goals') THEN 'text'
    WHEN field IN ('employee_count', 'fein_count', 'funding_days', 'nonexempt_count', 'exempt_count',
      'hr_staff_count') THEN 'count'
    WHEN field IN ('multiple_entities', 'virgin_medical', 'has_401k', 'employer_contributes', 'has_nonexempt',
      'has_handbook', 'has_1099', 'ca_contractors', 'uses_physical_clocks', 'uses_mobile_app',
      'uses_computer_timekeeping', 'shift_differentials') THEN 'boolean'
    WHEN field = 'hq_state' THEN 'state'
    WHEN field = 'states' THEN 'state_list'
    WHEN field IN ('ancillary_benefits', 'pto_types') THEN 'text_list'
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

REVOKE ALL ON FUNCTION public.chamber_data_census_row_error(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamber_data_census_row_error(jsonb, text) TO authenticated, service_role;
