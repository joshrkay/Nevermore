-- The database checks intake answers and versions every save of them.
--
-- * chamber_data is validated on every write that changes it, and when the session is certified
--   (see public.chamber_data_error for the rules). A refused write changes nothing and raises
--       SQLSTATE EA001, message 'Invalid intake data at <path>: <reason>', DETAIL <path>, HINT <reason>
--   where <path> is zero-based: hq_state, states[2], employees[3].dob,
--   employees[0].dependents[1].relationship, or chamber_data when the value is not an object.
--   PostgREST answers an unknown SQLSTATE with HTTP 400 and passes message, details and hint on.
-- * Rows already holding invalid data stay editable: unchanged chamber_data is not re-checked unless the
--   row is being certified. Nothing is rewritten or backfilled and no CHECK constraint is added.
-- * data_version counts saves. The server sets it (1 on insert, +1 on every update) and ignores any
--   value a client sends, so a client saves with
--       UPDATE ... WHERE id = <id> AND data_version = <last seen>
--   and zero rows updated means someone else saved first (a conflict). The row lock makes two saves
--   from the same version produce one success and one zero-row result.
-- * profiles.phone is checked when it is set to a non-empty value other than the one it already has.
--
-- Deploy order: this migration first, then the front end. The front end selects and filters on
-- data_version, which does not exist until this runs.
--
-- The front end holds the same limits (src/data/chamberValidation.ts) and src/data/schemaSync.test.ts
-- reads the 'sync:begin' / 'sync:end' blocks below to fail when the two sides drift. Add a field,
-- a state code or a cap here and there together.

ALTER TABLE public.chamber_sessions
  ADD COLUMN IF NOT EXISTS data_version integer NOT NULL DEFAULT 1;

-- The 50 states, DC and the five inhabited territories, in exact upper case.
CREATE OR REPLACE FUNCTION public.is_us_state_code(code text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(code = ANY (ARRAY[
    -- sync:begin us_state_codes
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','AS','GU','MP','PR','VI'
    -- sync:end us_state_codes
  ]), false);
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
    -- sync:end field_kinds
  END;
$$;

-- A JSON string of at most max_length characters.
CREATE OR REPLACE FUNCTION public.chamber_data_is_text(v jsonb, max_length integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT jsonb_typeof(v) = 'string' AND char_length(v #>> '{}') <= max_length;
$$;

-- A JSON number with no fractional part in [0, max_value]. Compared as numeric so a huge value is
-- a clean failure, not an integer overflow; CASE because AND does not promise to stop at the first false.
CREATE OR REPLACE FUNCTION public.chamber_data_is_whole_number(v jsonb, max_value numeric)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN jsonb_typeof(v) = 'number' THEN
      (v #>> '{}')::numeric BETWEEN 0 AND max_value AND (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric)
    ELSE false
  END;
$$;

-- What an employee and a dependent have in common: an object with a non-blank first name and optional
-- last name and date of birth. base is the path of the object, for example employees[3].
CREATE OR REPLACE FUNCTION public.chamber_data_person_error(person jsonb, base text, OUT path text, OUT reason text)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  -- sync:begin caps_person
  max_text constant integer := 1000;
  max_name constant integer := 200;
  max_dob constant integer := 40;
  -- sync:end caps_person
BEGIN
  IF jsonb_typeof(person) <> 'object' THEN
    path := base; reason := 'must be an object'; RETURN;
  END IF;
  IF NOT person ? 'first_name' THEN
    path := base || '.first_name'; reason := 'is required'; RETURN;
  END IF;
  IF NOT (public.chamber_data_is_text(person -> 'first_name', max_text) AND btrim(person ->> 'first_name') <> '') THEN
    path := base || '.first_name'; reason := format('must be non-blank text of at most %s characters', max_text); RETURN;
  END IF;
  IF person ? 'last_name' AND NOT public.chamber_data_is_text(person -> 'last_name', max_name) THEN
    path := base || '.last_name'; reason := format('must be text of at most %s characters', max_name); RETURN;
  END IF;
  IF person ? 'dob' AND NOT public.chamber_data_is_text(person -> 'dob', max_dob) THEN
    path := base || '.dob'; reason := format('must be text of at most %s characters', max_dob); RETURN;
  END IF;
END;
$$;

-- The first rule an intake breaks, as a path and a reason; both NULL when chamber_data is acceptable.
-- Missing keys are fine (rows predate some fields), as is any key inside an employee or dependent that
-- this function does not know; only an unknown top-level key, or a known one of the wrong shape, fails.
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

      ELSE
        path := key; reason := 'is not a known intake field'; RETURN;
    END CASE;
  END LOOP;
END;
$$;

-- Refuses invalid chamber_data. It runs on insert, when chamber_data changes, and when the session is
-- certified, so a row that was already invalid can still be saved in its other columns. It never
-- rewrites the data: the certification trigger hashes exactly what the client sent.
-- Fires after chamber_sessions_certification_validate (so guests and incomplete certifications are
-- refused first) and before the updated_at trigger, by trigger name order.
CREATE OR REPLACE FUNCTION public.validate_chamber_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  checking boolean;
  failure record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    checking := true;
  ELSE
    checking := NEW.chamber_data IS DISTINCT FROM OLD.chamber_data
      OR (NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission));
  END IF;

  IF checking THEN
    SELECT * INTO failure FROM public.chamber_data_error(NEW.chamber_data);
    IF failure.path IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid intake data at %: %', failure.path, failure.reason
        USING ERRCODE = 'EA001', DETAIL = failure.path, HINT = failure.reason;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- The server owns the version: a client-supplied value is overwritten, so only the WHERE data_version = n
-- predicate of a save can express "from the version I saw". Every update counts, even a no-op one.
CREATE OR REPLACE FUNCTION public.set_chamber_data_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.data_version := 1;
  ELSE
    NEW.data_version := OLD.data_version + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER chamber_sessions_data_validate
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_chamber_data();

CREATE TRIGGER chamber_sessions_data_version
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_chamber_data_version();

-- A phone number the advisor can dial: digits with spaces, parentheses, dots and dashes, an optional
-- leading + and an optional extension (x, ext or ext.). 7 to 15 digits excluding the extension, at most
-- 50 characters (what the notification emails keep).
CREATE OR REPLACE FUNCTION public.is_valid_phone(phone text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT phone IS NOT NULL
    AND char_length(phone) <= 50
    AND phone ~* '^\+?[0-9 ().-]+(\s*(x|ext\.?)\s*[0-9]{1,6})?$'
    AND char_length(regexp_replace(regexp_replace(phone, '\s*(x|ext\.?)\s*[0-9]{1,6}$', '', 'i'), '[^0-9]', '', 'g')) BETWEEN 7 AND 15;
$$;

-- Empty means "not given" and is fine, as is a phone this row already had.
CREATE OR REPLACE FUNCTION public.validate_profile_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_valid_phone(NEW.phone) THEN
    RAISE EXCEPTION 'Invalid profile data at phone: must be a phone number such as (555) 123-4567'
      USING ERRCODE = 'EA001', DETAIL = 'phone', HINT = 'must be a phone number such as (555) 123-4567';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_phone_validate
  BEFORE INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_phone();

-- Trigger functions need no EXECUTE grant to fire. The pure helpers do, because the triggers call them
-- as the signed-in user (authenticated) or, for service-role writes, as service_role.
REVOKE ALL ON FUNCTION public.validate_chamber_data() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_chamber_data_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_profile_phone() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_us_state_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_field_kind(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_is_text(jsonb, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_is_whole_number(jsonb, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_person_error(jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chamber_data_error(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_valid_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_us_state_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_field_kind(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_is_text(jsonb, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_is_whole_number(jsonb, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_person_error(jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.chamber_data_error(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_valid_phone(text) TO authenticated, service_role;
