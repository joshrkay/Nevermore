-- Intake schema v3, part 6: where and how each employee works (Epic K, story K-2.2).
--
-- Three optional keys join a census row, each checked when present, so a workers' comp underwriter can assign
-- class codes:
--   worksite  text of at most max_name characters: the office, store or site the employee works at
--   remote    true or false: works from home or another remote place, some or all of the time
--   travels   true or false: travels for work
--
-- chamber_data_census_row_error is the 20261112094000 definition with these keys added, and nothing else
-- changed.

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
  max_dob constant integer := 40;
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
      -- New in intake schema v3 (K-2.1): what a health underwriter rates the group on.
      WHEN 'gender' THEN
        IF NOT (jsonb_typeof(rval) = 'string' AND rval #>> '{}' IN (
          -- sync:begin census_genders
          'F', 'M', 'X'
          -- sync:end census_genders
        )) THEN
          path := base || '.gender'; reason := 'must be F, M or X'; RETURN;
        END IF;
      WHEN 'hire_date' THEN
        IF NOT public.chamber_data_is_text(rval, max_dob) THEN
          path := base || '.hire_date'; reason := format('must be text of at most %s characters', max_dob); RETURN;
        END IF;
      WHEN 'cobra' THEN
        IF jsonb_typeof(rval) <> 'boolean' THEN
          path := base || '.cobra'; reason := 'must be true or false'; RETURN;
        END IF;
      WHEN 'home_state' THEN
        IF NOT (jsonb_typeof(rval) = 'string' AND public.is_us_state_code(rval #>> '{}')) THEN
          path := base || '.home_state'; reason := 'must be a US state or territory code such as CA'; RETURN;
        END IF;
      -- New in intake schema v3 (K-2.2): where and how the employee works.
      WHEN 'worksite' THEN
        IF NOT public.chamber_data_is_text(rval, max_name) THEN
          path := base || '.worksite'; reason := format('must be text of at most %s characters', max_name); RETURN;
        END IF;
      WHEN 'remote' THEN
        IF jsonb_typeof(rval) <> 'boolean' THEN
          path := base || '.remote'; reason := 'must be true or false'; RETURN;
        END IF;
      WHEN 'travels' THEN
        IF jsonb_typeof(rval) <> 'boolean' THEN
          path := base || '.travels'; reason := 'must be true or false'; RETURN;
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

REVOKE ALL ON FUNCTION public.chamber_data_census_row_error(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamber_data_census_row_error(jsonb, text) TO authenticated, service_role;
