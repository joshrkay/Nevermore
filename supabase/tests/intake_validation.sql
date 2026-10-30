-- Run against a scratch Postgres, never one you care about (not production, not a local or dev
-- Supabase): it drops and recreates the `public` AND `auth` schemas, which deletes real users:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/intake_validation.sql
-- Loads the real migrations chamber_sessions and profiles come from, so the guest block, certification,
-- updated_at and new triggers fire in their production order, then exercises server-side validation
-- (SQLSTATE EA001 naming the field path) and data_version, as the signed-in user with row security on.
--
-- Rows are created BEFORE the new migration is loaded, to prove the upgrade path: existing rows get
-- version 1 with no backfill, and rows already holding invalid data stay editable.
--
-- Two saves from the same version: the app saves with UPDATE ... WHERE id = x AND data_version = n.
-- Run for real from two connections, the second blocks on the first's row lock, and when the first
-- commits it re-checks the WHERE against the new row, matches nothing and reports 0 rows: one save wins,
-- the other is told it conflicted. The row lock does that, whatever the triggers do (checked by hand with
-- two psql sessions; mutation: without the predicate both saves win). Here it is run one after the other
-- on one connection, which proves the predicate and the trigger-owned version, not the lock wait.
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
-- Supabase grants table access to these roles by default and relies on row security.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
-- It grants EXECUTE on new functions to them too, so a function is only closed to clients if its
-- migration says so.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb);

\i supabase/migrations/20260323215855_6110f697-3604-440a-bcc3-685413801386.sql
\i supabase/migrations/20260324031329_0de2017b-f5c3-4631-b280-4cfa150f3c76.sql
\i supabase/migrations/20261020180000_signup_company_and_session_submission.sql
\i supabase/migrations/20261020200000_block_guest_submission.sql
\i supabase/migrations/20261020210000_certification_events.sql
\i supabase/migrations/20261021090000_chamber_field_provenance.sql

-- Data from before the new migration. The legacy session breaks one rule (hq_state is not a code);
-- the legacy profile has a phone that is not a phone number.
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-00000000000a');
INSERT INTO public.chamber_sessions (id, user_id, chamber_data) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a',
   '{"company_name":"Legacy Co","hq_state":"California","employee_count":12}');
INSERT INTO public.chamber_sessions (id, user_id, chamber_data, status) VALUES
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a',
   '{"company_name":"Clean Legacy Co","hq_state":"CA"}', 'in_progress');
-- A session certified before the migration, still holding the invalid value (the certification trigger loaded
-- above stamps it, as it did then).
INSERT INTO public.chamber_sessions (id, user_id, chamber_data, status, submission) VALUES
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000000a',
   '{"company_name":"Legacy Co","hq_state":"California"}', 'submitted',
   '{"signer_name":"Jo Doe","signer_title":"CEO","signed_at":"2026-04-01T12:00:00Z","file_id":"EAA-L0","consent_version":"v1","consent_text":"I certify.","chamber_data":{"company_name":"Legacy Co","hq_state":"California"}}');
UPDATE public.profiles SET phone = 'call me', company_name = 'Legacy Co' WHERE user_id = '00000000-0000-0000-0000-00000000000a';

\i supabase/migrations/20261027090000_intake_validation_and_versioning.sql
\i supabase/migrations/20261029092000_census_in_intake_validation.sql

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated')::text, false);
END $$;

CREATE FUNCTION pg_temp.snap(sid uuid) RETURNS jsonb LANGUAGE sql AS
  $$ SELECT to_jsonb(s) FROM public.chamber_sessions s WHERE s.id = sid $$;

-- Superuser only: a session for uid, with updated_at moved to the past so a write that gets through
-- shows in updated_at (the trigger resets it) while a refused one visibly does not.
CREATE FUNCTION pg_temp.new_session(uid uuid, data jsonb, guest boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_user(uid, guest);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id INTO sid;
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.chamber_sessions SET updated_at = '2020-01-01T00:00:00Z' WHERE id = sid;
  PERFORM set_config('session_replication_role', 'origin', true);
  RETURN sid;
END $$;

-- Fails the run unless stmt raises exactly state, its DETAIL is exactly path (NULL for an error that has
-- none), its message names the path, and the row is as it was. Run it as the caller being tested.
CREATE FUNCTION pg_temp.must_reject(sid uuid, stmt text, state text, path text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  before_row jsonb := pg_temp.snap(sid);
  s text; m text; d text; h text;
  raised boolean := false;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT, d = PG_EXCEPTION_DETAIL, h = PG_EXCEPTION_HINT;
    raised := true;
    IF s <> state THEN RAISE EXCEPTION 'FAIL: % raised % (%), expected %', label, s, m, state; END IF;
    IF nullif(d, '') IS DISTINCT FROM path THEN RAISE EXCEPTION 'FAIL: % named path % (message: %), expected %', label, d, m, path; END IF;
    IF path IS NOT NULL AND (m NOT LIKE 'Invalid intake data at ' || path || ': %' OR coalesce(h, '') = '') THEN
      RAISE EXCEPTION 'FAIL: % message does not name % with a reason: % / %', label, path, m, h;
    END IF;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'FAIL: % was accepted', label; END IF;
  IF pg_temp.snap(sid) IS DISTINCT FROM before_row THEN RAISE EXCEPTION 'FAIL: % changed the row', label; END IF;
END $$;

-- Same for an INSERT into chamber_sessions: nothing may be left behind.
CREATE FUNCTION pg_temp.must_reject_insert(stmt text, path text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  rows_before bigint := (SELECT count(*) FROM public.chamber_sessions);
  s text; d text;
  raised boolean := false;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, d = PG_EXCEPTION_DETAIL;
    raised := true;
    IF s <> 'EA001' OR d IS DISTINCT FROM path THEN RAISE EXCEPTION 'FAIL: % raised % naming %, expected EA001 naming %', label, s, d, path; END IF;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'FAIL: % was accepted', label; END IF;
  IF (SELECT count(*) FROM public.chamber_sessions) <> rows_before THEN RAISE EXCEPTION 'FAIL: % left a row behind', label; END IF;
END $$;

-- Rows an UPDATE matched: what PostgREST returns with .select(), so 0 is a conflict.
CREATE FUNCTION pg_temp.rows_changed(stmt text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- The data a fresh intake holds, and the app's demo intake (both copied from src/data/chamberTypes.ts).
CREATE FUNCTION pg_temp.empty_data() RETURNS jsonb LANGUAGE sql AS
  $j$ SELECT '{"company_name":null,"industry":null,"hq_state":null,"states":[],"employee_count":null,"start_month":null,"multiple_entities":null,"fein_count":null,"virgin_medical":null,"current_carrier":null,"renewal_date":null,"rate_history":null,"benefits_waiting_period":null,"ancillary_benefits":[],"has_401k":null,"retirement_type":null,"employer_contributes":null,"payroll_vendor":null,"pay_frequency":null,"funding_days":null,"has_nonexempt":null,"nonexempt_count":null,"exempt_count":null,"pto_types":[],"accrual_method":null,"has_handbook":null,"handbook_last_updated":null,"hr_staff_count":null,"has_1099":null,"ca_contractors":null,"uses_physical_clocks":null,"uses_mobile_app":null,"uses_computer_timekeeping":null,"shift_differentials":null,"hris_system":null,"key_challenges":null,"business_goals":null,"census":[]}'::jsonb $j$;
CREATE FUNCTION pg_temp.demo_data() RETURNS jsonb LANGUAGE sql AS
  $j$ SELECT $d${"company_name":"Meridian Creative Group","industry":"Creative Agency","hq_state":"CA","states":["CA","TX"],"employee_count":28,"start_month":"March 2026","multiple_entities":false,"fein_count":1,"virgin_medical":false,"current_carrier":"Blue Shield","renewal_date":"June 2026","rate_history":"12% increase last year","benefits_waiting_period":"30 days","ancillary_benefits":["Life Insurance","FSA","EAP"],"has_401k":true,"retirement_type":"Safe Harbor 401k","employer_contributes":true,"payroll_vendor":"ADP Run","pay_frequency":"Bi-weekly","funding_days":2,"has_nonexempt":true,"nonexempt_count":8,"exempt_count":20,"pto_types":["Vacation","Sick","Personal"],"accrual_method":"Annual accrual","has_handbook":true,"handbook_last_updated":"2024","hr_staff_count":1,"has_1099":true,"ca_contractors":false,"uses_physical_clocks":false,"uses_mobile_app":true,"uses_computer_timekeeping":true,"shift_differentials":false,"hris_system":"Google Sheets","key_challenges":"Compliance with CA employment law, managing multi-state payroll","business_goals":"Scale to 50 employees, offer competitive benefits to attract talent","census":[{"id":"6f1c2a40-0001-4c1e-9a7b-3d5e00000001","first_name":"Sarah","last_name":"Chen","dob":"1988-03-15","work_state":"CA","zip_code":"94107","job_title":"Senior Designer","annual_salary":105000,"compensation_type":"salary","employment_type":"full_time","classification":"w2","coverage_tier":"FAM","class_code":"8810","dependents":[{"first_name":"Michael","last_name":"Chen","dob":"1985-06-12","relationship":"spouse"},{"first_name":"Emma","last_name":"Chen","dob":"2018-03-22","relationship":"child"}]},{"id":"6f1c2a40-0002-4c1e-9a7b-3d5e00000002","first_name":"Marcus","last_name":"Rivera","dob":"1985-07-22","work_state":"CA","zip_code":"94110","job_title":"Art Director","annual_salary":125000,"compensation_type":"salary","employment_type":"full_time","classification":"w2","coverage_tier":"EE+SP","class_code":"8810","dependents":[{"first_name":"Ana","last_name":"Rivera","dob":"1987-09-04","relationship":"spouse"}]},{"id":"6f1c2a40-0003-4c1e-9a7b-3d5e00000003","first_name":"Aisha","last_name":"Patel","dob":"1990-11-08","work_state":"CA","zip_code":"94612","job_title":"UX Researcher","annual_salary":98000,"compensation_type":"salary","employment_type":"full_time","classification":"w2","coverage_tier":"EE","class_code":"8810"},{"id":"6f1c2a40-0004-4c1e-9a7b-3d5e00000004","first_name":"James","last_name":"O'Brien","dob":"1992-01-30","work_state":"TX","zip_code":"78701","job_title":"Copywriter","annual_salary":78000,"compensation_type":"salary","employment_type":"full_time","classification":"w2","coverage_tier":"EE","class_code":"8810"},{"id":"6f1c2a40-0005-4c1e-9a7b-3d5e00000005","first_name":"Lisa","last_name":"Tanaka","dob":"1987-09-12","work_state":"CA","zip_code":"94103","job_title":"Project Manager","annual_salary":110000,"compensation_type":"salary","employment_type":"full_time","classification":"w2","coverage_tier":"FAM","class_code":"8810","dependents":[{"first_name":"Kenji","last_name":"Tanaka","dob":"2015-05-18","relationship":"child"},{"first_name":"Yuki","last_name":"Tanaka","dob":"2019-11-02","relationship":"child"},{"first_name":"Hiro","last_name":"Tanaka","dob":"1986-02-14","relationship":"spouse"}]},{"id":"6f1c2a40-0006-4c1e-9a7b-3d5e00000006","first_name":"Tom","last_name":"Bradley","dob":"1994-02-14","work_state":"TX","zip_code":"78702","job_title":"Freelance Illustrator","annual_salary":72000,"compensation_type":"salary","employment_type":"full_time","classification":"1099"}]}$d$::jsonb $j$;

-- What a browser that predates the census wrote: the roster under `employees`, with `state`, `title`, `salary` and "W2".
CREATE FUNCTION pg_temp.legacy_demo_data() RETURNS jsonb LANGUAGE sql AS
  $j$ SELECT $d${"company_name":"Meridian Creative Group","industry":"Creative Agency","hq_state":"CA","states":["CA","TX"],"employee_count":28,"start_month":"March 2026","multiple_entities":false,"fein_count":1,"virgin_medical":false,"current_carrier":"Blue Shield","renewal_date":"June 2026","rate_history":"12% increase last year","benefits_waiting_period":"30 days","ancillary_benefits":["Life Insurance","FSA","EAP"],"has_401k":true,"retirement_type":"Safe Harbor 401k","employer_contributes":true,"payroll_vendor":"ADP Run","pay_frequency":"Bi-weekly","funding_days":2,"has_nonexempt":true,"nonexempt_count":8,"exempt_count":20,"pto_types":["Vacation","Sick","Personal"],"accrual_method":"Annual accrual","has_handbook":true,"handbook_last_updated":"2024","hr_staff_count":1,"has_1099":true,"ca_contractors":false,"uses_physical_clocks":false,"uses_mobile_app":true,"uses_computer_timekeeping":true,"shift_differentials":false,"hris_system":"Google Sheets","key_challenges":"Compliance with CA employment law, managing multi-state payroll","business_goals":"Scale to 50 employees, offer competitive benefits to attract talent","employees":[{"first_name":"Sarah","last_name":"Chen","dob":"1988-03-15","state":"CA","title":"Senior Designer","salary":105000,"classification":"W2","dependents":[{"first_name":"Michael","last_name":"Chen","dob":"1985-06-12","relationship":"spouse"},{"first_name":"Emma","last_name":"Chen","dob":"2018-03-22","relationship":"child"}]},{"first_name":"Marcus","last_name":"Rivera","dob":"1985-07-22","state":"CA","title":"Art Director","salary":125000,"classification":"W2","dependents":[{"first_name":"Ana","last_name":"Rivera","dob":"1987-09-04","relationship":"spouse"}]},{"first_name":"Aisha","last_name":"Patel","dob":"1990-11-08","state":"CA","title":"UX Researcher","salary":98000,"classification":"W2","dependents":[]},{"first_name":"James","last_name":"O'Brien","dob":"1992-01-30","state":"TX","title":"Copywriter","salary":78000,"classification":"W2","dependents":[]},{"first_name":"Lisa","last_name":"Tanaka","dob":"1987-09-12","state":"CA","title":"Project Manager","salary":110000,"classification":"W2","dependents":[{"first_name":"Kenji","last_name":"Tanaka","dob":"2015-05-18","relationship":"child"},{"first_name":"Yuki","last_name":"Tanaka","dob":"2019-11-02","relationship":"child"},{"first_name":"Hiro","last_name":"Tanaka","dob":"1986-02-14","relationship":"spouse"}]},{"first_name":"Tom","last_name":"Bradley","dob":"1994-02-14","state":"TX","title":"Freelance Illustrator","salary":72000,"classification":"1099","dependents":[]}]}$d$::jsonb $j$;

-- ---------- what the migration installed ----------
DO $$
DECLARE
  before_triggers text;
  state_codes int;
  any_pairs int;
BEGIN
  -- The validator and the version run after certification (guests and incomplete certifications are
  -- refused first) and before updated_at, so they see the final row.
  SELECT string_agg(tgname, ' < ' ORDER BY tgname) INTO before_triggers
    FROM pg_trigger
   WHERE tgrelid = 'public.chamber_sessions'::regclass AND NOT tgisinternal
     AND (tgtype & 2) = 2 AND (tgtype & 16) = 16;
  IF before_triggers IS DISTINCT FROM 'chamber_sessions_block_guest_submission < chamber_sessions_certification_validate'
      || ' < chamber_sessions_data_validate < chamber_sessions_data_version < update_chamber_sessions_updated_at' THEN
    RAISE EXCEPTION 'FAIL: BEFORE UPDATE order is %', before_triggers;
  END IF;

  -- Trigger functions are closed to clients (a trigger needs no EXECUTE grant to fire), and the helpers
  -- the triggers call are open to signed-in users only.
  IF has_function_privilege('authenticated', 'public.validate_chamber_data()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.set_chamber_data_version()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.validate_profile_phone()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.validate_chamber_data()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: a trigger function is executable by clients';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.chamber_data_error(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_us_state_code(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_valid_phone(text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.chamber_data_error(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.chamber_data_error(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.chamber_data_census_row_error(jsonb, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.chamber_data_census_row_error(jsonb, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.chamber_data_census_row_error(jsonb, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: validator helpers are not open to authenticated and service_role only';
  END IF;

  -- 50 states, DC and five territories; exact upper case; nothing else of the 676 two-letter pairs.
  SELECT count(*) INTO state_codes FROM unnest(ARRAY['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
    'DC','AS','GU','MP','PR','VI']) c WHERE public.is_us_state_code(c);
  SELECT count(*) INTO any_pairs FROM (SELECT chr(a) || chr(b) AS c FROM generate_series(65, 90) a, generate_series(65, 90) b) q WHERE public.is_us_state_code(c);
  IF state_codes <> 56 OR any_pairs <> 56 THEN RAISE EXCEPTION 'FAIL: state codes accepted: % listed, % of all pairs', state_codes, any_pairs; END IF;
  IF public.is_us_state_code('ca') OR public.is_us_state_code(' CA') OR public.is_us_state_code('') OR public.is_us_state_code(NULL)
     OR public.is_us_state_code('AE') OR public.is_us_state_code('California') THEN
    RAISE EXCEPTION 'FAIL: is_us_state_code accepted a non-code';
  END IF;

  -- Upgrade path: rows from before the migration hold version 1, with no backfill.
  IF EXISTS (SELECT 1 FROM public.chamber_sessions WHERE data_version <> 1) THEN
    RAISE EXCEPTION 'FAIL: a pre-existing row is not at version 1';
  END IF;
  RAISE NOTICE 'intake_validation: installation cases passed';
END $$;

-- ---------- acceptance ----------
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  base jsonb := pg_temp.demo_data();
  good jsonb;
  n int;
BEGIN
  -- The app's own payloads are accepted on insert and on update, and so is the column default.
  sid := pg_temp.new_session(uid, pg_temp.empty_data());
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = pg_temp.demo_data() WHERE id = sid;
  UPDATE public.chamber_sessions SET chamber_data = pg_temp.empty_data() WHERE id = sid;
  UPDATE public.chamber_sessions SET chamber_data = '{}' WHERE id = sid;
  INSERT INTO public.chamber_sessions (user_id) VALUES (uid);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, pg_temp.demo_data());
  -- A browser that has not loaded the census version still saves the roster as `employees`.
  UPDATE public.chamber_sessions SET chamber_data = pg_temp.legacy_demo_data() WHERE id = sid;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, pg_temp.legacy_demo_data());

  -- Limits are inclusive.
  FOREACH good IN ARRAY ARRAY[
    '{"employee_count":0,"fein_count":1000000,"funding_days":12.0,"hr_staff_count":null}'::jsonb,
    jsonb_build_object('industry', repeat('a', 1000), 'key_challenges', repeat(E'\U0001F600', 1000)),
    jsonb_build_object('states', (SELECT jsonb_agg('CA'::text) FROM generate_series(1, 60))),
    jsonb_build_object('ancillary_benefits', (SELECT jsonb_agg('x'::text) FROM generate_series(1, 100)),
                       'pto_types', (SELECT jsonb_agg(repeat('x', 1000)) FROM generate_series(1, 100))),
    '{"hq_state":"DC","states":["PR","GU","VI","AS","MP"]}',
    '{"company_name":"   ","has_401k":null,"employees":[]}',
    -- Employees: blank state, null salary, a salary at the limit, W2 and 1099, text at its limits, keys this
    -- version does not know (tolerated), and missing optional keys.
    jsonb_build_object('employees', jsonb_build_array(
      jsonb_build_object('first_name', repeat('f', 1000), 'last_name', repeat('l', 200), 'dob', repeat('9', 40), 'title', repeat('t', 200),
                         'state', '', 'salary', null, 'classification', '1099', 'hire_date', '2020-01-01'),
      jsonb_build_object('first_name', 'B', 'salary', 1000000, 'state', 'NY', 'dob', '3/15/1988'),
      jsonb_build_object('first_name', 'C', 'dependents', jsonb_build_array(
        jsonb_build_object('first_name', 'D', 'relationship', 'domestic_partner', 'shoe_size', 9),
        jsonb_build_object('first_name', 'E'))))),
    jsonb_build_object('employees', jsonb_build_array(jsonb_build_object('first_name', 'A', 'dependents',
      (SELECT jsonb_agg(jsonb_build_object('first_name', 'D' || g, 'relationship', 'child')) FROM generate_series(1, 20) g))))
  ] LOOP
    UPDATE public.chamber_sessions SET chamber_data = good WHERE id = sid;
  END LOOP;

  -- The largest list the server accepts, in one write.
  UPDATE public.chamber_sessions SET chamber_data = jsonb_build_object('employees',
    (SELECT jsonb_agg(jsonb_build_object('first_name', 'E' || g, 'last_name', 'Employee', 'dob', '1988-03-15', 'state', 'CA',
       'title', 'Engineer', 'salary', 105000, 'classification', 'W2',
       'dependents', jsonb_build_array(jsonb_build_object('first_name', 'D', 'relationship', 'child'))))
       FROM generate_series(1, 5000) g)) WHERE id = sid;
  SELECT jsonb_array_length(chamber_data -> 'employees') INTO n FROM public.chamber_sessions WHERE id = sid;
  IF n <> 5000 THEN RAISE EXCEPTION 'FAIL: 5000 employees were not saved'; END IF;
  RESET ROLE;
  RAISE NOTICE 'intake_validation: acceptance cases passed';
END $$;

-- ---------- one rejection per type: names the path, changes nothing ----------
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  base jsonb := '{"company_name":"Acme","hq_state":"NY","employee_count":12,"employees":[{"first_name":"A","state":"CA"}]}';
  upd text;
  c record;
  rejections int := 0;
BEGIN
  sid := pg_temp.new_session(uid, base);
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  upd := format('UPDATE public.chamber_sessions SET chamber_data = %%L WHERE id = %L', sid);

  -- label, the whole chamber_data to save (a patch is merged into base), the path the error must name
  FOR c IN SELECT label, CASE WHEN jsonb_typeof(patch) = 'object' AND NOT whole THEN base || patch ELSE patch END AS data, path
    FROM (VALUES
      -- wrong JSON type
      ('text given a number',              false, '{"company_name":5}'::jsonb,           'company_name'),
      ('text given a boolean',             false, '{"industry":true}',                   'industry'),
      ('text given an object',             false, '{"payroll_vendor":{"a":1}}',          'payroll_vendor'),
      ('count given a string',             false, '{"employee_count":"12"}',             'employee_count'),
      ('count given a boolean',            false, '{"funding_days":true}',               'funding_days'),
      ('count given a list',               false, '{"exempt_count":[1]}',                'exempt_count'),
      ('boolean given a string',           false, '{"has_401k":"yes"}',                  'has_401k'),
      ('boolean given a number',           false, '{"has_handbook":1}',                  'has_handbook'),
      ('list given a string',              false, '{"states":"CA,TX"}',                  'states'),
      ('text list given a string',         false, '{"pto_types":"Vacation"}',            'pto_types'),
      ('list given null',                  false, '{"ancillary_benefits":null}',         'ancillary_benefits'),
      ('employees given an object',        false, '{"employees":{"state":"NY"}}',        'employees'),
      ('employee that is not an object',   false, '{"employees":[{"first_name":"A"},"junk"]}', 'employees[1]'),
      ('dependent that is not an object',  false, '{"employees":[{"first_name":"A","dependents":[5]}]}', 'employees[0].dependents[0]'),
      ('dependents given an object',       false, '{"employees":[{"first_name":"A","dependents":{"first_name":"B"}}]}', 'employees[0].dependents'),
      ('text list item not text',          false, '{"pto_types":["Vacation",5]}',        'pto_types[1]'),
      ('text list item null',              false, '{"pto_types":["Vacation",null]}',     'pto_types[1]'),
      ('benefits list item null',          false, '{"ancillary_benefits":[null]}',       'ancillary_benefits[0]'),
      ('chamber_data a list',              true,  '[]',                                  'chamber_data'),
      ('chamber_data a string',            true,  '"{}"',                                'chamber_data'),
      ('chamber_data JSON null',           true,  'null',                                'chamber_data'),
      -- counts
      ('count below 0',                    false, '{"employee_count":-1}',               'employee_count'),
      ('count above 1,000,000',            false, '{"fein_count":1000001}',              'fein_count'),
      ('count fractional',                 false, '{"hr_staff_count":12.5}',             'hr_staff_count'),
      ('count too large for an integer',   false, '{"funding_days":1e400}',              'funding_days'),
      ('salary above 1,000,000',           false, '{"employees":[{"first_name":"A","salary":1000001}]}', 'employees[0].salary'),
      ('salary below 0',                   false, '{"employees":[{"first_name":"A","salary":-5}]}',      'employees[0].salary'),
      ('salary fractional',                false, '{"employees":[{"first_name":"A","salary":10.5}]}',    'employees[0].salary'),
      ('salary a string',                  false, '{"employees":[{"first_name":"A","salary":"85,000"}]}', 'employees[0].salary'),
      -- states
      ('hq_state not a state',             false, '{"hq_state":"ZZ"}',                   'hq_state'),
      ('hq_state lower case',              false, '{"hq_state":"ca"}',                   'hq_state'),
      ('hq_state a whole name',            false, '{"hq_state":"California"}',           'hq_state'),
      ('hq_state blank',                   false, '{"hq_state":""}',                     'hq_state'),
      ('hq_state a military code',         false, '{"hq_state":"AE"}',                   'hq_state'),
      ('states entry not a state',         false, '{"states":["CA","TX","XX"]}',         'states[2]'),
      ('states entry a number',            false, '{"states":["CA",5]}',                 'states[1]'),
      ('employee state a whole name',      false, '{"employees":[{"first_name":"A"},{"first_name":"B"},{"first_name":"C","state":"California"}]}', 'employees[2].state'),
      ('employee state lower case',        false, '{"employees":[{"first_name":"A","state":"ca"}]}', 'employees[0].state'),
      ('employee state null',              false, '{"employees":[{"first_name":"A","state":null}]}', 'employees[0].state'),
      -- enums
      ('classification outside W2/1099',   false, '{"employees":[{"first_name":"A","classification":"K-1"}]}', 'employees[0].classification'),
      ('relationship outside the list',    false, '{"employees":[{"first_name":"A","dependents":[{"first_name":"B","relationship":"spouse"},{"first_name":"C","relationship":"kid"}]}]}', 'employees[0].dependents[1].relationship'),
      ('relationship not text',            false, '{"employees":[{"first_name":"A","dependents":[{"first_name":"B","relationship":1}]}]}', 'employees[0].dependents[0].relationship'),
      -- lengths
      ('text over 1000 characters',        false, jsonb_build_object('industry', repeat('a', 1001)), 'industry'),
      ('text list item over 1000',         false, jsonb_build_object('ancillary_benefits', jsonb_build_array('ok', repeat('a', 1001))), 'ancillary_benefits[1]'),
      ('employee first name over 1000',    false, jsonb_build_object('employees', jsonb_build_array(jsonb_build_object('first_name', repeat('a', 1001)))), 'employees[0].first_name'),
      ('employee last name over 200',      false, jsonb_build_object('employees', jsonb_build_array(jsonb_build_object('first_name', 'A', 'last_name', repeat('a', 201)))), 'employees[0].last_name'),
      ('employee title over 200',          false, jsonb_build_object('employees', jsonb_build_array(jsonb_build_object('first_name', 'A', 'title', repeat('a', 201)))), 'employees[0].title'),
      ('employee dob over 40',             false, (SELECT jsonb_build_object('employees', jsonb_agg(jsonb_build_object('first_name', 'E' || g, 'dob', CASE WHEN g = 3 THEN repeat('x', 41) ELSE '1988-03-15' END))) FROM generate_series(0, 3) g), 'employees[3].dob'),
      ('dependent dob over 40',            false, jsonb_build_object('employees', jsonb_build_array(jsonb_build_object('first_name', 'A', 'dependents', jsonb_build_array(jsonb_build_object('first_name', 'B', 'dob', repeat('9', 41)))))), 'employees[0].dependents[0].dob'),
      ('dependent last name over 200',     false, jsonb_build_object('employees', jsonb_build_array(jsonb_build_object('first_name', 'A', 'dependents', jsonb_build_array(jsonb_build_object('first_name', 'B', 'last_name', repeat('a', 201)))))), 'employees[0].dependents[0].last_name'),
      -- required names
      ('employee without a first name',    false, '{"employees":[{"state":"CA"}]}',      'employees[0].first_name'),
      ('employee with a blank first name', false, '{"employees":[{"first_name":"  "}]}', 'employees[0].first_name'),
      ('employee first name not text',     false, '{"employees":[{"first_name":7}]}',    'employees[0].first_name'),
      ('dependent without a first name',   false, '{"employees":[{"first_name":"A","dependents":[{"relationship":"child"}]}]}', 'employees[0].dependents[0].first_name'),
      -- shape
      ('unknown top-level key',            false, '{"reply":"hi"}',                      'reply'),
      ('unknown key with a field prefix',  false, '{"company_name_2":"x"}',              'company_name_2'),
      -- caps
      ('states over 60 entries',           false, jsonb_build_object('states', (SELECT jsonb_agg('CA'::text) FROM generate_series(1, 61))), 'states'),
      ('ancillary_benefits over 100',      false, jsonb_build_object('ancillary_benefits', (SELECT jsonb_agg('x'::text) FROM generate_series(1, 101))), 'ancillary_benefits'),
      ('pto_types over 100',               false, jsonb_build_object('pto_types', (SELECT jsonb_agg('x'::text) FROM generate_series(1, 101))), 'pto_types'),
      ('dependents over 20',               false, jsonb_build_object('employees', jsonb_build_array(jsonb_build_object('first_name', 'A', 'dependents', (SELECT jsonb_agg(jsonb_build_object('first_name', 'D')) FROM generate_series(1, 21))))), 'employees[0].dependents'),
      ('employees over 5000',              false, jsonb_build_object('employees', (SELECT jsonb_agg(jsonb_build_object('first_name', 'E')) FROM generate_series(1, 5001))), 'employees')
    ) AS t(label, whole, patch, path)
  LOOP
    PERFORM pg_temp.must_reject(sid, format(upd, c.data), 'EA001', c.path, c.label);
    rejections := rejections + 1;
  END LOOP;

  -- The same data is refused on insert, and no row is left behind.
  PERFORM pg_temp.must_reject_insert(format('INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (%L, %L)', uid, '{"hq_state":"ZZ"}'), 'hq_state', 'insert with a bad state');
  PERFORM pg_temp.must_reject_insert(format('INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (%L, %L)', uid, '{"employee_count":-3}'), 'employee_count', 'insert with a negative count');
  PERFORM pg_temp.must_reject_insert(format('INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (%L, %L)', uid, '[]'), 'chamber_data', 'insert with a list');

  -- A refused save also carries nothing else in the same statement: the transcript and status stay put.
  PERFORM pg_temp.must_reject(sid, format('UPDATE public.chamber_sessions SET chamber_data = %L, transcript = %L, field_provenance = %L, status = %L WHERE id = %L',
    '{"employee_count":"many"}', '[{"role":"user","content":"hi"}]', '{"employee_count":{"status":"confirmed"}}', 'archived', sid), 'EA001', 'employee_count', 'a refused save that also changes other columns');
  PERFORM pg_temp.must_reject(sid, format('UPDATE public.chamber_sessions SET chamber_data = %L, data_version = 99 WHERE id = %L AND data_version = 1', '{"employee_count":"many"}', sid), 'EA001', 'employee_count', 'a refused save with a forged version');

  -- Boundaries: the cases above sit right next to values that are accepted.
  UPDATE public.chamber_sessions SET chamber_data = base || '{"employee_count":0}' WHERE id = sid;
  UPDATE public.chamber_sessions SET chamber_data = base || '{"employee_count":1000000}' WHERE id = sid;
  RESET ROLE;
  RAISE NOTICE 'intake_validation: % rejection cases passed', rejections;
END $$;

-- ---------- versions: the server owns them ----------
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  sid uuid;
  sid2 uuid;
  v integer;
  n bigint;
  updated timestamptz;
BEGIN
  -- Guests are who fills in an intake, so the cases run as one.
  PERFORM pg_temp.as_user(uid, true);
  SET LOCAL ROLE authenticated;
  -- A new row starts at version 1 whatever the client asks for.
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, '{"company_name":"Acme"}') RETURNING id, data_version INTO sid, v;
  IF v <> 1 THEN RAISE EXCEPTION 'FAIL: a new row starts at version 1, got %', v; END IF;
  INSERT INTO public.chamber_sessions (user_id, data_version) VALUES (uid, 500) RETURNING id, data_version INTO sid2, v;
  IF v <> 1 THEN RAISE EXCEPTION 'FAIL: client-supplied data_version 500 on insert was kept (got %)', v; END IF;
  RESET ROLE;
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.chamber_sessions SET updated_at = '2020-01-01T00:00:00Z' WHERE id = sid;
  PERFORM set_config('session_replication_role', 'origin', true);
  SET LOCAL ROLE authenticated;

  -- A save from the version the client holds matches one row and moves the version by exactly 1.
  n := pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L AND data_version = 1', '{"company_name":"Acme Inc"}', sid));
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: a save from the current version matched % rows', n; END IF;
  SELECT data_version, updated_at INTO v, updated FROM public.chamber_sessions WHERE id = sid;
  IF v <> 2 THEN RAISE EXCEPTION 'FAIL: version after one save is %', v; END IF;
  IF updated < now() - interval '1 minute' THEN RAISE EXCEPTION 'FAIL: updated_at was not set by the save'; END IF;

  -- The same save again, still from version 1, is a conflict: zero rows, nothing changes.
  n := pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L AND data_version = 1', '{"company_name":"STALE"}', sid));
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: a stale save matched % rows', n; END IF;
  SELECT data_version INTO v FROM public.chamber_sessions WHERE id = sid;
  IF v <> 2 OR (SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = sid) <> 'Acme Inc' THEN
    RAISE EXCEPTION 'FAIL: a stale save changed the row (version %)', v;
  END IF;

  -- A client cannot set the version, forward or back, alone or with the predicate.
  PERFORM pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET data_version = 99 WHERE id = %L', sid));
  SELECT data_version INTO v FROM public.chamber_sessions WHERE id = sid;
  IF v <> 3 THEN RAISE EXCEPTION 'FAIL: client-supplied data_version 99 was kept (got %)', v; END IF;
  PERFORM pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET data_version = 0, transcript = %L WHERE id = %L AND data_version = 3', '[{"role":"user"}]', sid));
  SELECT data_version INTO v FROM public.chamber_sessions WHERE id = sid;
  IF v <> 4 THEN RAISE EXCEPTION 'FAIL: client-supplied data_version 0 was kept (got %)', v; END IF;

  -- Every update counts: transcript only, identical data, field_provenance, status.
  UPDATE public.chamber_sessions SET transcript = '[{"role":"assistant"}]' WHERE id = sid;
  SELECT data_version INTO v FROM public.chamber_sessions WHERE id = sid;
  IF v <> 5 THEN RAISE EXCEPTION 'FAIL: a transcript-only save left version %', v; END IF;
  UPDATE public.chamber_sessions SET chamber_data = chamber_data WHERE id = sid;
  SELECT data_version INTO v FROM public.chamber_sessions WHERE id = sid;
  IF v <> 6 THEN RAISE EXCEPTION 'FAIL: a no-op save left version %', v; END IF;
  UPDATE public.chamber_sessions SET field_provenance = '{"company_name":{"status":"confirmed"}}' WHERE id = sid;
  UPDATE public.chamber_sessions SET status = 'in_progress' WHERE id = sid;
  SELECT data_version INTO v FROM public.chamber_sessions WHERE id = sid;
  IF v <> 8 THEN RAISE EXCEPTION 'FAIL: two more saves left version %', v; END IF;

  -- A refused save does not use up a version.
  PERFORM pg_temp.must_reject(sid, format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L AND data_version = 8', '{"employee_count":-1}', sid), 'EA001', 'employee_count', 'refused save');
  SELECT data_version INTO v FROM public.chamber_sessions WHERE id = sid;
  IF v <> 8 THEN RAISE EXCEPTION 'FAIL: a refused save moved the version to %', v; END IF;

  -- Another owner's row is invisible: zero rows, so a conflict cannot be told from a missing row without a read.
  PERFORM pg_temp.as_user(other, true);
  n := pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L AND data_version = 8', '{"company_name":"Hijack"}', sid));
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: another user updated the row'; END IF;
  RESET ROLE;
  IF (SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = sid) <> 'Acme Inc' THEN RAISE EXCEPTION 'FAIL: another user changed the row'; END IF;
  RAISE NOTICE 'intake_validation: version cases passed';
END $$;

-- ---------- two saves from the same version: one wins, one conflicts ----------
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  held integer;
  first_save bigint;
  second_save bigint;
  final record;
BEGIN
  sid := pg_temp.new_session(uid, '{"company_name":"Race"}');
  SELECT data_version INTO held FROM public.chamber_sessions WHERE id = sid;
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  -- Both tabs loaded version `held`; each saves with the WHERE it was given.
  first_save := pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L AND data_version = %s', '{"company_name":"tab one"}', sid, held));
  second_save := pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L AND data_version = %s', '{"company_name":"tab two"}', sid, held));
  IF first_save <> 1 OR second_save <> 0 THEN RAISE EXCEPTION 'FAIL: expected one success and one conflict, got % and % rows', first_save, second_save; END IF;
  SELECT chamber_data ->> 'company_name' AS name, data_version INTO final FROM public.chamber_sessions WHERE id = sid;
  IF final.name <> 'tab one' OR final.data_version <> held + 1 THEN RAISE EXCEPTION 'FAIL: the loser changed the row (%, version %)', final.name, final.data_version; END IF;
  -- The loser re-reads, sees the new version, and its save then goes through.
  IF pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L AND data_version = %s', '{"company_name":"tab two, retried"}', sid, final.data_version)) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the retry at the current version did not go through';
  END IF;
  RESET ROLE;
  RAISE NOTICE 'intake_validation: two-saves cases passed';
END $$;

-- ---------- rows that were already invalid stay editable ----------
DO $$
DECLARE
  uid uuid := '00000000-0000-0000-0000-00000000000a';
  legacy uuid := '00000000-0000-0000-0000-0000000000a1';
  certified uuid := '00000000-0000-0000-0000-0000000000a3';
  dirty jsonb := '{"company_name":"Legacy Co","hq_state":"California","employee_count":12}';
  row_ public.chamber_sessions;
  sub jsonb;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  -- Saves that do not change chamber_data go through, and count.
  UPDATE public.chamber_sessions SET transcript = '[{"role":"user","content":"hello"}]' WHERE id = legacy AND data_version = 1;
  UPDATE public.chamber_sessions SET field_provenance = '{"company_name":{"status":"confirmed"}}', status = 'in_progress' WHERE id = legacy AND data_version = 2;
  -- Re-sending the same dirty data is not a change.
  UPDATE public.chamber_sessions SET chamber_data = dirty, transcript = '[]' WHERE id = legacy AND data_version = 3;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = legacy;
  IF row_.data_version <> 4 OR row_.chamber_data <> dirty THEN RAISE EXCEPTION 'FAIL: legacy row after three saves: version %, data %', row_.data_version, row_.chamber_data; END IF;

  -- Changing the data to another invalid value is refused, naming the first problem; the row stays as it was.
  PERFORM pg_temp.must_reject(legacy, format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', dirty || '{"company_name":"Now Named"}', legacy), 'EA001', 'hq_state', 'edit that keeps the invalid value');
  PERFORM pg_temp.must_reject(legacy, format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', dirty || '{"hq_state":"CA","states":["XX"]}', legacy), 'EA001', 'states[0]', 'edit that fixes one problem and adds another');

  -- Certifying it is refused too: the certified data is the saved data, and it is invalid.
  sub := jsonb_build_object('signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-05-01T12:00:00Z', 'file_id', 'EAA-L',
    'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', dirty);
  PERFORM pg_temp.must_reject(legacy, format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', sub, legacy), 'EA001', 'hq_state', 'certifying invalid data');
  IF EXISTS (SELECT 1 FROM public.chamber_certifications WHERE session_id = legacy) THEN RAISE EXCEPTION 'FAIL: invalid data was certified'; END IF;

  -- So is signing again a row that is already certified with invalid data (a new submission, same data):
  -- that is a fresh certification, not a save that leaves the old one standing.
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = certified AND superseded_at IS NULL) <> 1 THEN RAISE EXCEPTION 'FAIL: the pre-migration certification is not recorded'; END IF;
  PERFORM pg_temp.must_reject(certified, format('UPDATE public.chamber_sessions SET submission = %L WHERE id = %L', (SELECT submission || jsonb_build_object('signed_at', '2026-05-02T09:30:00Z') FROM public.chamber_sessions WHERE id = certified), certified), 'EA001', 'hq_state', 're-certifying a submitted row holding invalid data');
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = certified) <> 1 THEN RAISE EXCEPTION 'FAIL: a refused re-certification was recorded'; END IF;
  -- Saves that do not touch the data or the signature still go through on it.
  UPDATE public.chamber_sessions SET transcript = '[]' WHERE id = certified;

  -- Fixing the data (what the app sends once the user corrects it) goes through.
  UPDATE public.chamber_sessions SET chamber_data = dirty || '{"hq_state":"CA"}' WHERE id = legacy AND data_version = 4;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = legacy;
  IF row_.data_version <> 5 OR row_.chamber_data ->> 'hq_state' <> 'CA' THEN RAISE EXCEPTION 'FAIL: fixing the legacy row: version %, data %', row_.data_version, row_.chamber_data; END IF;
  RESET ROLE;
  RAISE NOTICE 'intake_validation: legacy row cases passed';
END $$;

-- ---------- certification keeps working ----------
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  data jsonb := '{"company_name":"Acme","hq_state":"NY","employee_count":12,"employees":[{"first_name":"A","state":"CA"}]}';
  edited jsonb := '{"company_name":"Acme Inc","hq_state":"NY","employee_count":12,"employees":[{"first_name":"A","state":"CA"}]}';
  invalid jsonb := '{"company_name":"Acme","hq_state":"ZZ","employee_count":12,"employees":[{"first_name":"A","state":"CA"}]}';
  sub jsonb;
  certify text := 'UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L AND data_version = %s';
  row_ public.chamber_sessions;
  v integer;
  n bigint;
BEGIN
  sid := pg_temp.new_session(uid, data);
  sub := jsonb_build_object('signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-05-01T12:00:00Z', 'file_id', 'EAA-1',
    'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', data);
  SELECT data_version INTO v FROM public.chamber_sessions WHERE id = sid;
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;

  -- A guest is still refused first, before the data is even looked at.
  PERFORM pg_temp.as_user(uid, true);
  PERFORM pg_temp.must_reject(sid, format(certify, sub || jsonb_build_object('chamber_data', invalid), sid, v), '42501', NULL, 'guest certifying invalid data');
  PERFORM pg_temp.must_reject(sid, format(certify, sub, sid, v), '42501', NULL, 'guest certifying');
  PERFORM pg_temp.as_user(uid);

  -- Incomplete certifications are still refused by the certification rules, ahead of the data rules.
  PERFORM pg_temp.must_reject(sid, format(certify, (sub - 'signer_name') || jsonb_build_object('chamber_data', invalid), sid, v), '23514', NULL, 'certification with no signer, invalid data');

  -- Invalid data cannot be certified, naming the path; the session stays uncertified at the same version.
  PERFORM pg_temp.must_reject(sid, format('UPDATE public.chamber_sessions SET status = ''submitted'', chamber_data = %L, submission = %L WHERE id = %L AND data_version = %s',
    invalid, sub || jsonb_build_object('chamber_data', invalid), sid, v), 'EA001', 'hq_state', 'certifying invalid data');

  -- A stale version does not certify: zero rows.
  n := pg_temp.rows_changed(format(certify, sub, sid, v - 1));
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: certifying from a stale version matched % rows', n; END IF;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'in_progress' OR row_.data_version <> v THEN RAISE EXCEPTION 'FAIL: a stale certification changed the row'; END IF;

  -- Valid data certifies, is stamped and recorded, and counts as a save.
  n := pg_temp.rows_changed(format(certify, sub, sid, v));
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: certifying from the current version matched % rows', n; END IF;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'submitted' OR row_.data_version <> v + 1
     OR row_.submission ->> 'data_sha256' <> encode(sha256(convert_to(data::text, 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'FAIL: certified row is %, version %', row_.status, row_.data_version;
  END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid AND superseded_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the certification was not recorded';
  END IF;

  -- Saving the transcript leaves the certification standing, and the version moves.
  UPDATE public.chamber_sessions SET transcript = '[{"role":"user"}]', chamber_data = data WHERE id = sid;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'submitted' OR row_.data_version <> v + 2 THEN RAISE EXCEPTION 'FAIL: a transcript save: %, version %', row_.status, row_.data_version; END IF;

  -- Invalid answers on a certified session are refused and the certification stays.
  PERFORM pg_temp.must_reject(sid, format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', invalid, sid), 'EA001', 'hq_state', 'invalid edit of a certified session');
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'submitted'
     OR (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid AND superseded_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'FAIL: a refused edit withdrew the certification';
  END IF;

  -- Valid changed answers withdraw it, as before, and count as a save.
  UPDATE public.chamber_sessions SET chamber_data = edited WHERE id = sid;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'in_progress' OR row_.data_version <> v + 3 THEN RAISE EXCEPTION 'FAIL: changed answers left %, version %', row_.status, row_.data_version; END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid AND superseded_at IS NULL) <> 0 THEN RAISE EXCEPTION 'FAIL: the withdrawn certification is still active'; END IF;

  -- The old signed copy cannot be re-submitted over the edit, and re-certifying the new data works.
  PERFORM pg_temp.must_reject(sid, format(certify, sub, sid, v + 3), '23514', NULL, 're-submitting the stale signed data');
  n := pg_temp.rows_changed(format(certify, sub || jsonb_build_object('chamber_data', edited, 'signed_at', '2026-05-02T09:30:00Z'), sid, v + 3));
  IF n <> 1 OR (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'submitted' THEN RAISE EXCEPTION 'FAIL: re-certifying the edited data'; END IF;
  RESET ROLE;
  RAISE NOTICE 'intake_validation: certification cases passed';
END $$;

-- ---------- phone numbers on profiles ----------
CREATE FUNCTION pg_temp.must_reject_phone(uid uuid, stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  before_row jsonb := (SELECT to_jsonb(p) FROM public.profiles p WHERE p.user_id = uid);
  s text; m text; d text;
  raised boolean := false;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT, d = PG_EXCEPTION_DETAIL;
    raised := true;
    IF s <> 'EA001' OR d IS DISTINCT FROM 'phone' OR m NOT LIKE '%at phone: %' THEN RAISE EXCEPTION 'FAIL: % raised % naming % (%)', label, s, d, m; END IF;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'FAIL: % was accepted', label; END IF;
  IF (SELECT to_jsonb(p) FROM public.profiles p WHERE p.user_id = uid) IS DISTINCT FROM before_row THEN RAISE EXCEPTION 'FAIL: % changed the row', label; END IF;
END $$;

DO $$
DECLARE
  uid uuid := gen_random_uuid();
  legacy uuid := '00000000-0000-0000-0000-00000000000a';
  phone_ text;
  bad text;
BEGIN
  -- Sign-up still creates a profile (no phone, nothing to check), and the existing fixtures' number is fine.
  INSERT INTO auth.users (id, raw_user_meta_data) VALUES (uid, '{"company_name":"Acme"}');
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = uid AND phone IS NULL AND company_name = 'Acme') THEN
    RAISE EXCEPTION 'FAIL: sign-up did not create the profile';
  END IF;

  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  FOREACH phone_ IN ARRAY ARRAY['555-0100', '(555) 123-4567', '+1 (555) 123-4567', '555.123.4567', '5551234567', '+44 20 7946 0958',
      '555-123-4567 x123', '555-123-4567 ext. 12', '555-123-4567 EXT 12', ' 555-0100 ', repeat('5', 15),
      '555' || repeat(' ', 40) || '1234567', '', NULL] LOOP
    UPDATE public.profiles SET phone = phone_ WHERE user_id = uid;
    IF (SELECT phone FROM public.profiles WHERE user_id = uid) IS DISTINCT FROM phone_ THEN RAISE EXCEPTION 'FAIL: phone % was not saved', phone_; END IF;
  END LOOP;

  FOREACH bad IN ARRAY ARRAY['call me', '123', '555-123', '++1555', '+', '12345678901234567890', '<script>1234567</script>', '555-123-4567; DROP TABLE x',
      '555 1234 abc', '555-123-4567 x1234567', '555-123-4567 x', repeat('5', 16), repeat('5 ', 26),
      '555' || repeat(' ', 41) || '1234567', '   '] LOOP
    PERFORM pg_temp.must_reject_phone(uid, format('UPDATE public.profiles SET phone = %L WHERE user_id = %L', bad, uid), 'phone ' || quote_literal(bad));
  END LOOP;
  -- With other columns in the same statement, and on insert.
  PERFORM pg_temp.must_reject_phone(uid, format('UPDATE public.profiles SET phone = %L, company_name = %L WHERE user_id = %L', 'call me', 'Changed', uid), 'phone with another column');
  RESET ROLE;
  DELETE FROM public.profiles WHERE user_id = uid;
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.profiles (user_id, phone) VALUES (uid, 'call me');
    RAISE EXCEPTION 'FAIL: a profile was inserted with a bad phone';
  EXCEPTION WHEN SQLSTATE 'EA001' THEN NULL;
  END;
  INSERT INTO public.profiles (user_id, phone) VALUES (uid, '(555) 123-4567');

  -- A profile that already held a bad phone stays editable in its other columns; changing the phone to
  -- another bad value is refused; clearing it or entering a good one is fine.
  PERFORM pg_temp.as_user(legacy);
  UPDATE public.profiles SET company_name = 'Legacy Co 2', phone = 'call me' WHERE user_id = legacy;
  UPDATE public.profiles SET company_name = 'Legacy Co 3', contact_name = 'Jo' WHERE user_id = legacy;
  PERFORM pg_temp.must_reject_phone(legacy, format('UPDATE public.profiles SET phone = %L WHERE user_id = %L', 'call me later', legacy), 'a different bad phone');
  UPDATE public.profiles SET phone = '555-0100' WHERE user_id = legacy;
  RESET ROLE;
  RAISE NOTICE 'intake_validation: phone cases passed';
END $$;

-- ---------- the validator on its own: first failing path and reason ----------
DO $$
DECLARE r record; ok int := 0;
BEGIN
  FOR r IN SELECT v.label, e.path, e.reason, v.expect FROM (VALUES
    ('empty object', '{}'::jsonb, NULL::text),
    ('count 1e3 is whole', '{"funding_days":1e3}', NULL),
    ('blank company tolerated', '{"company_name":"  "}', NULL),
    ('employee state blank', '{"employees":[{"first_name":"A","state":""}]}', NULL),
    ('dependents omitted', '{"employees":[{"first_name":"A"}]}', NULL),
    ('first failure is in list order', '{"employees":[{"first_name":"A"},{"first_name":"B","state":"XX"},{"first_name":"C","state":"YY"}]}', 'employees[1].state'),
    ('first failure in a nested list', ('{"employees":[{"first_name":"A","dependents":[{"first_name":"B"},{"first_name":"C","dob":"' || repeat('1', 41) || '"}]}]}')::jsonb, 'employees[0].dependents[1].dob'),
    ('a null chamber_data', NULL::jsonb, 'chamber_data')
  ) v(label, payload, expect), LATERAL public.chamber_data_error(v.payload) e LOOP
    IF r.path IS DISTINCT FROM r.expect OR (r.path IS NULL) <> (r.reason IS NULL) THEN
      RAISE EXCEPTION 'FAIL: % gave path %, reason %', r.label, r.path, r.reason;
    END IF;
    ok := ok + 1;
  END LOOP;
  RAISE NOTICE 'intake_validation: % validator cases passed', ok;
END $$;

-- ---------- the census (chamber_data.census) ----------
DO $$
DECLARE
  r record;
  ok int := 0;
  one jsonb := '{"id":"a1","first_name":"Ann","last_name":"Lee","dob":"1990-01-01","age":35,"work_state":"CA","zip_code":"94107","job_title":"Dev","annual_salary":100000,"compensation_type":"salary","employment_type":"full_time","classification":"w2","coverage_tier":"EE","class_code":"8810","dependents":[{"first_name":"B","relationship":"child"}]}';
  one_of constant text := 'jsonb_build_object(''census'', jsonb_build_array(';
BEGIN
  FOR r IN SELECT v.label, e.path, e.reason, v.expect FROM (VALUES
    ('a full census row', jsonb_build_object('census', jsonb_build_array(one)), NULL::text),
    ('an empty census', '{"census":[]}'::jsonb, NULL),
    ('a row that is only a name', '{"census":[{"first_name":"A"}]}', NULL),
    ('an unknown key in a row is tolerated', jsonb_build_object('census', jsonb_build_array(one || '{"future_fact":1}')), NULL),
    ('work state blank', jsonb_build_object('census', jsonb_build_array(one || '{"work_state":""}')), NULL),
    ('classification 1099', jsonb_build_object('census', jsonb_build_array(one || '{"classification":"1099"}')), NULL),
    ('every coverage tier', jsonb_build_object('census', jsonb_build_array(one || '{"coverage_tier":"EE+SP"}', one || '{"coverage_tier":"EE+CH"}', one || '{"coverage_tier":"FAM"}', one || '{"coverage_tier":"WAIVE"}')), NULL),
    ('hourly and part time', jsonb_build_object('census', jsonb_build_array(one || '{"compensation_type":"hourly","employment_type":"part_time"}')), NULL),
    ('pay of exactly 1,000,000', jsonb_build_object('census', jsonb_build_array(one || '{"annual_salary":1000000}')), NULL),
    ('a ZIP+4', jsonb_build_object('census', jsonb_build_array(one || '{"zip_code":"94107-1234"}')), NULL),
    ('age at both ends', jsonb_build_object('census', jsonb_build_array(one || '{"age":14}', one || '{"age":100}')), NULL),
    ('the older roster is still accepted', '{"employees":[{"first_name":"A","state":"CA","salary":5,"classification":"W2"}]}', NULL),
    ('both keys together', jsonb_build_object('census', jsonb_build_array(one), 'employees', '[{"first_name":"A"}]'::jsonb), NULL),
    ('exactly 5000 people', (SELECT jsonb_build_object('census', jsonb_agg(jsonb_build_object('first_name', 'E' || g))) FROM generate_series(1, 5000) g), NULL),

    ('census given an object', '{"census":{"first_name":"A"}}', 'census'),
    ('more than 5000 people', (SELECT jsonb_build_object('census', jsonb_agg(jsonb_build_object('first_name', 'E' || g))) FROM generate_series(1, 5001) g), 'census'),
    ('row that is not an object', '{"census":[{"first_name":"A"},"junk"]}', 'census[1]'),
    ('row without a first name', '{"census":[{"work_state":"CA"}]}', 'census[0].first_name'),
    ('row with a blank first name', '{"census":[{"first_name":" "}]}', 'census[0].first_name'),
    ('last name over 200', jsonb_build_object('census', jsonb_build_array(one || jsonb_build_object('last_name', repeat('a', 201)))), 'census[0].last_name'),
    ('date of birth over 40', jsonb_build_object('census', jsonb_build_array(one || jsonb_build_object('dob', repeat('1', 41)))), 'census[0].dob'),
    ('id blank', jsonb_build_object('census', jsonb_build_array(one || '{"id":" "}')), 'census[0].id'),
    ('id over 64', jsonb_build_object('census', jsonb_build_array(one || jsonb_build_object('id', repeat('a', 65)))), 'census[0].id'),
    ('id not text', jsonb_build_object('census', jsonb_build_array(one || '{"id":7}')), 'census[0].id'),
    ('age 13', jsonb_build_object('census', jsonb_build_array(one || '{"age":13}')), 'census[0].age'),
    ('age 101', jsonb_build_object('census', jsonb_build_array(one || '{"age":101}')), 'census[0].age'),
    ('age fractional', jsonb_build_object('census', jsonb_build_array(one || '{"age":40.5}')), 'census[0].age'),
    ('age a string', jsonb_build_object('census', jsonb_build_array(one || '{"age":"40"}')), 'census[0].age'),
    ('work state a whole name', jsonb_build_object('census', jsonb_build_array(one || '{"work_state":"California"}')), 'census[0].work_state'),
    ('work state lower case', jsonb_build_object('census', jsonb_build_array(one || '{"work_state":"ca"}')), 'census[0].work_state'),
    ('work state null', jsonb_build_object('census', jsonb_build_array(one || '{"work_state":null}')), 'census[0].work_state'),
    ('work state not a listed code', jsonb_build_object('census', jsonb_build_array(one || '{"work_state":"AE"}')), 'census[0].work_state'),
    ('ZIP too short', jsonb_build_object('census', jsonb_build_array(one || '{"zip_code":"9410"}')), 'census[0].zip_code'),
    ('ZIP not text', jsonb_build_object('census', jsonb_build_array(one || '{"zip_code":94107}')), 'census[0].zip_code'),
    ('job title over 200', jsonb_build_object('census', jsonb_build_array(one || jsonb_build_object('job_title', repeat('a', 201)))), 'census[0].job_title'),
    ('pay above 1,000,000', jsonb_build_object('census', jsonb_build_array(one || '{"annual_salary":1000001}')), 'census[0].annual_salary'),
    ('pay below 0', jsonb_build_object('census', jsonb_build_array(one || '{"annual_salary":-5}')), 'census[0].annual_salary'),
    ('pay fractional', jsonb_build_object('census', jsonb_build_array(one || '{"annual_salary":10.5}')), 'census[0].annual_salary'),
    ('pay a string', jsonb_build_object('census', jsonb_build_array(one || '{"annual_salary":"85,000"}')), 'census[0].annual_salary'),
    ('pay null', jsonb_build_object('census', jsonb_build_array(one || '{"annual_salary":null}')), 'census[0].annual_salary'),
    ('pay type outside salary/hourly', jsonb_build_object('census', jsonb_build_array(one || '{"compensation_type":"weekly"}')), 'census[0].compensation_type'),
    ('employment type outside full/part time', jsonb_build_object('census', jsonb_build_array(one || '{"employment_type":"ft"}')), 'census[0].employment_type'),
    ('classification in the roster''s old case', jsonb_build_object('census', jsonb_build_array(one || '{"classification":"W2"}')), 'census[0].classification'),
    ('classification outside w2/1099', jsonb_build_object('census', jsonb_build_array(one || '{"classification":"k-1"}')), 'census[0].classification'),
    ('coverage tier outside the list', jsonb_build_object('census', jsonb_build_array(one || '{"coverage_tier":"Gold"}')), 'census[0].coverage_tier'),
    ('class code of three digits', jsonb_build_object('census', jsonb_build_array(one || '{"class_code":"881"}')), 'census[0].class_code'),
    ('class code a number', jsonb_build_object('census', jsonb_build_array(one || '{"class_code":8810}')), 'census[0].class_code'),
    ('dependents given an object', jsonb_build_object('census', jsonb_build_array(one || '{"dependents":{"first_name":"B"}}')), 'census[0].dependents'),
    ('more than 20 dependents', jsonb_build_object('census', jsonb_build_array(one || jsonb_build_object('dependents', (SELECT jsonb_agg(jsonb_build_object('first_name', 'D' || g)) FROM generate_series(1, 21) g)))), 'census[0].dependents'),
    ('dependent without a first name', jsonb_build_object('census', jsonb_build_array(one || '{"dependents":[{"relationship":"child"}]}')), 'census[0].dependents[0].first_name'),
    ('dependent relationship outside the list', jsonb_build_object('census', jsonb_build_array(one || '{"dependents":[{"first_name":"B","relationship":"kid"}]}')), 'census[0].dependents[0].relationship'),
    ('first failure is in list order', jsonb_build_object('census', jsonb_build_array(one, one || '{"work_state":"XX"}', one || '{"work_state":"YY"}')), 'census[1].work_state')
  ) v(label, payload, expect), LATERAL public.chamber_data_error(v.payload) e LOOP
    IF r.path IS DISTINCT FROM r.expect OR (r.path IS NULL) <> (r.reason IS NULL) THEN
      RAISE EXCEPTION 'FAIL: census case "%" gave path %, reason %, expected path %', r.label, r.path, r.reason, r.expect;
    END IF;
    ok := ok + 1;
  END LOOP;
  RAISE NOTICE 'intake_validation: % census validator cases passed', ok;
END $$;

-- The census is saved through the trigger as the signed-in user, and a bad row is refused naming its path.
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  detail text;
  state text;
  good jsonb := '{"census":[{"id":"a1","first_name":"Ann","work_state":"CA","annual_salary":90000,"compensation_type":"salary","employment_type":"full_time","classification":"w2"}]}';
BEGIN
  sid := pg_temp.new_session(uid, pg_temp.empty_data());
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = good WHERE id = sid;
  IF (SELECT chamber_data FROM public.chamber_sessions WHERE id = sid) IS DISTINCT FROM good THEN
    RAISE EXCEPTION 'FAIL: the census was not saved as sent';
  END IF;

  BEGIN
    UPDATE public.chamber_sessions SET chamber_data = jsonb_set(good, '{census,0,work_state}', '"Texas"') WHERE id = sid;
    RAISE EXCEPTION 'FAIL: a census with a state name was saved';
  EXCEPTION WHEN SQLSTATE 'EA001' THEN
    GET STACKED DIAGNOSTICS detail = PG_EXCEPTION_DETAIL;
    IF detail <> 'census[0].work_state' THEN RAISE EXCEPTION 'FAIL: a bad census row named %', detail; END IF;
  END;
  IF (SELECT chamber_data FROM public.chamber_sessions WHERE id = sid) IS DISTINCT FROM good THEN
    RAISE EXCEPTION 'FAIL: a refused census save changed the row';
  END IF;

  -- A new intake can hold a census, and the certification hash covers it as it does any other answer.
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, good);
  RESET ROLE;
  RAISE NOTICE 'intake_validation: census save cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'intake_validation: all cases passed'; END $$;
