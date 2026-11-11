-- Intake schema v3, part 2: who the employer is (Epic K, story K-1.1).
--
-- Six top-level chamber_data keys join the intake:
--   fein            'fein': the employer's federal employer identification number, as its nine digits
--   entity_type     'entity_type': one of the listed ways an employer is organised
--   year_founded    'year': a whole number from 1600 to max_year
--   street_address  text
--   website         text
--   entities        'rows': each legal entity of an employer that is more than one, as { legal_name, fein }
--
-- v3 adds many answers, so the rules are now read from three small functions that later v3 migrations
-- replace, and chamber_data_error itself stays as it is here:
--   chamber_data_scalar_reason(kind, value)  why one value breaks its kind's rule (NULL when it doesn't)
--   chamber_data_row_field_kind(list, key)   the kind of each key inside a list of rows
--   chamber_data_row_list_max(list)          how many rows each list may hold
-- chamber_data_error is the 20261103120000 definition with two cases added and nothing else changed: a
-- 'rows' kind, and every kind it has no case of its own for, which is one value checked by
-- chamber_data_scalar_reason. A row is stricter than a census row: an unknown key inside one is refused,
-- as an unknown top-level key is.
--
-- is_reviewable_field no longer keeps its own list (v2 forgot to add its answers to it): an advisor can
-- review whatever chamber_data_field_kind knows.
--
-- src/data/schemaSync.test.ts compares the `sync:` blocks with the client and intake schema v3.
-- Deploy before the front end that sends the new keys: the database refuses an unknown top-level key.

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
    WHEN field IN ('entities') THEN 'rows'
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
  kind text;
  max_rows integer;
  rkey text;
  rval jsonb;
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
    kind := public.chamber_data_field_kind(key);
    CASE kind
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

      -- A list of rows (v3): each row an object whose keys are that list's own, each value checked as its kind.
      -- Every key of a row is optional, none may be null, and an unknown key is refused.
      WHEN 'rows' THEN
        IF jsonb_typeof(val) <> 'array' THEN
          path := key; reason := 'must be a list'; RETURN;
        END IF;
        max_rows := public.chamber_data_row_list_max(key);
        IF jsonb_array_length(val) > max_rows THEN
          path := key; reason := format('must have at most %s entries', max_rows); RETURN;
        END IF;
        i := 0;
        FOR item IN SELECT * FROM jsonb_array_elements(val) LOOP
          IF jsonb_typeof(item) <> 'object' THEN
            path := format('%s[%s]', key, i); reason := 'must be an object'; RETURN;
          END IF;
          FOR rkey, rval IN SELECT * FROM jsonb_each(item) LOOP
            reason := public.chamber_data_scalar_reason(public.chamber_data_row_field_kind(key, rkey), rval);
            IF reason IS NOT NULL THEN
              path := format('%s[%s].%s', key, i, rkey); RETURN;
            END IF;
          END LOOP;
          i := i + 1;
        END LOOP;

      ELSE
        IF kind IS NULL THEN
          path := key; reason := 'is not a known intake field'; RETURN;
        END IF;
        -- Every other kind (v3) is one value, or null while unanswered.
        IF jsonb_typeof(val) <> 'null' THEN
          reason := public.chamber_data_scalar_reason(kind, val);
          IF reason IS NOT NULL THEN
            path := key; RETURN;
          END IF;
        END IF;
    END CASE;
  END LOOP;
END;
$$;

-- Every top-level answer of the intake, the census's older name included, can be marked verified or as
-- needing follow-up by an advisor. It reads chamber_data_field_kind, which signed-out callers can't run, so it
-- is closed to them too (below): only advisors, who are signed in, and the service role ever ask.
CREATE OR REPLACE FUNCTION public.is_reviewable_field(f text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.chamber_data_field_kind(f) IS NOT NULL
$$;

-- CREATE OR REPLACE keeps the grants earlier migrations gave the replaced functions; all are stated here
-- so this file reads on its own.
REVOKE ALL ON FUNCTION public.chamber_data_field_kind(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_error(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_scalar_reason(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_row_field_kind(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_row_list_max(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_reviewable_field(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamber_data_field_kind(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_error(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_scalar_reason(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_row_field_kind(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_row_list_max(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_reviewable_field(text) TO authenticated, service_role;
