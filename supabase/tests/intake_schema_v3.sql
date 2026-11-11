-- Run against a scratch Postgres, never one you care about: it drops and recreates the `public` AND `auth`
-- schemas (see intake_validation.sql). Intake schema v3 (Epic K): what public.chamber_data_error accepts and
-- refuses of each group of the common questions, as the function is after the v3 migrations.
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
\i supabase/migrations/20261027090000_intake_validation_and_versioning.sql
\i supabase/migrations/20261029092000_census_in_intake_validation.sql
\i supabase/migrations/20261103120000_intake_schema_v2_workers_comp.sql
-- v3: each group of the common questions, in order.
\i supabase/migrations/20261111091000_intake_schema_v3_company_identity.sql
\i supabase/migrations/20261111092000_intake_schema_v3_industry_code.sql
\i supabase/migrations/20261111093000_intake_schema_v3_current_peo.sql
\i supabase/migrations/20261111094000_intake_schema_v3_census_columns.sql
\i supabase/migrations/20261111095000_intake_schema_v3_census_worksite.sql

-- ---------- helpers ----------
-- The path chamber_data_error names for d, or NULL when d is acceptable.
CREATE FUNCTION pg_temp.refused_at(d jsonb) RETURNS text LANGUAGE sql AS
  $$ SELECT e.path FROM public.chamber_data_error(d) e $$;

CREATE FUNCTION pg_temp.must_accept(d jsonb, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p text; r text;
BEGIN
  SELECT e.path, e.reason INTO p, r FROM public.chamber_data_error(d) e;
  IF p IS NOT NULL THEN RAISE EXCEPTION 'FAIL: % was refused at % (%)', label, p, r; END IF;
END $$;

CREATE FUNCTION pg_temp.must_refuse(d jsonb, path text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p text; r text;
BEGIN
  SELECT e.path, e.reason INTO p, r FROM public.chamber_data_error(d) e;
  IF p IS DISTINCT FROM path THEN RAISE EXCEPTION 'FAIL: % was refused at % (%), expected %', label, p, r, path; END IF;
  IF coalesce(r, '') = '' THEN RAISE EXCEPTION 'FAIL: % was refused at % without a reason', label, p; END IF;
END $$;

-- ---------- K-1.1 company identity ----------
DO $$
BEGIN
  PERFORM pg_temp.must_accept('{"fein":"841234567","entity_type":"llc","year_founded":2014,"street_address":"500 Harbor Street, San Francisco, CA 94107-1234","website":"meridiancreative.example","entities":[]}', 'company identity');
  PERFORM pg_temp.must_accept('{"fein":null,"entity_type":null,"year_founded":null,"street_address":null,"website":null}', 'unanswered company identity');
  PERFORM pg_temp.must_accept('{"year_founded":1600}', 'the earliest year');
  PERFORM pg_temp.must_accept('{"year_founded":2100}', 'the latest year');
  PERFORM pg_temp.must_refuse('{"fein":"84-1234567"}', 'fein', 'a hyphenated FEIN');
  PERFORM pg_temp.must_refuse('{"fein":"84123456"}', 'fein', 'an eight-digit FEIN');
  PERFORM pg_temp.must_refuse('{"fein":841234567}', 'fein', 'a FEIN sent as a number');
  PERFORM pg_temp.must_refuse('{"entity_type":"LLC"}', 'entity_type', 'an entity type in upper case');
  PERFORM pg_temp.must_refuse('{"entity_type":7}', 'entity_type', 'an entity type that is not text');
  PERFORM pg_temp.must_refuse('{"year_founded":1599}', 'year_founded', 'a year before 1600');
  PERFORM pg_temp.must_refuse('{"year_founded":2101}', 'year_founded', 'a year after 2100');
  PERFORM pg_temp.must_refuse('{"year_founded":"1998"}', 'year_founded', 'a year sent as text');
  PERFORM pg_temp.must_refuse('{"year_founded":1998.5}', 'year_founded', 'a fractional year');
  PERFORM pg_temp.must_refuse('{"website":7}', 'website', 'a website that is not text');

  PERFORM pg_temp.must_accept('{"entities":[{"legal_name":"Meridian Creative LLC","fein":"841234567"},{"legal_name":"Meridian Studios Inc"},{}]}', 'legal entities');
  PERFORM pg_temp.must_refuse('{"entities":null}', 'entities', 'entities that are not a list');
  PERFORM pg_temp.must_refuse('{"entities":["Meridian"]}', 'entities[0]', 'an entity that is not an object');
  PERFORM pg_temp.must_refuse('{"entities":[{"legal_name":"A"},{"legal_name":"B","fein":"84-1234567"}]}', 'entities[1].fein', 'a hyphenated FEIN on an entity');
  PERFORM pg_temp.must_refuse('{"entities":[{"legal_name":null}]}', 'entities[0].legal_name', 'a null inside a row');
  PERFORM pg_temp.must_refuse('{"entities":[{"dba":"Meridian"}]}', 'entities[0].dba', 'an unknown key on an entity');
  PERFORM pg_temp.must_refuse(jsonb_build_object('entities', (SELECT jsonb_agg(jsonb_build_object('legal_name', 'E')) FROM generate_series(1, 51))), 'entities', '51 entities');
  PERFORM pg_temp.must_accept(jsonb_build_object('entities', (SELECT jsonb_agg(jsonb_build_object('legal_name', 'E')) FROM generate_series(1, 50))), '50 entities');

  -- What v2 held is checked as it was.
  PERFORM pg_temp.must_accept('{"company_name":"Acme","states":["CA"],"wc_experience_mod":0.92,"wc_annual_premium":18400,"census":[{"first_name":"Ann"}]}', 'v2 answers');
  PERFORM pg_temp.must_refuse('{"hq_state":"California"}', 'hq_state', 'a state name');
  PERFORM pg_temp.must_refuse('{"nickname":"Acme"}', 'nickname', 'an unknown key');

  -- Advisors can review every answer the intake holds (and the census's older name), and nothing else.
  IF NOT (public.is_reviewable_field('fein') AND public.is_reviewable_field('entities') AND public.is_reviewable_field('company_name')
          AND public.is_reviewable_field('census') AND public.is_reviewable_field('employees')) THEN
    RAISE EXCEPTION 'FAIL: an intake answer cannot be reviewed';
  END IF;
  IF public.is_reviewable_field('nickname') OR public.is_reviewable_field(NULL) THEN RAISE EXCEPTION 'FAIL: something that is not an answer can be reviewed'; END IF;
  -- Signed-in callers (advisors) can ask; signed-out ones can't, as with the kinds it reads.
  IF NOT has_function_privilege('authenticated', 'public.is_reviewable_field(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.is_reviewable_field(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: is_reviewable_field is not open to signed-in callers only';
  END IF;
  SET LOCAL ROLE authenticated;
  IF NOT public.is_reviewable_field('fein') OR public.is_reviewable_field('nickname') THEN RAISE EXCEPTION 'FAIL: a signed-in caller gets a different answer about what can be reviewed'; END IF;
  RESET ROLE;
  RAISE NOTICE 'intake_schema_v3: company identity cases passed';
END $$;

-- ---------- K-1.2 industry as a code and a description ----------
DO $$
BEGIN
  PERFORM pg_temp.must_accept('{"naics_code":"541430","operations_description":"Brand and packaging design for consumer goods."}', 'an industry code and description');
  PERFORM pg_temp.must_accept('{"naics_code":null,"operations_description":null}', 'an unanswered industry code and description');
  PERFORM pg_temp.must_accept(jsonb_build_object('operations_description', repeat('x', 1000)), 'a description of 1,000 characters');
  PERFORM pg_temp.must_refuse(jsonb_build_object('operations_description', repeat('x', 1001)), 'operations_description', 'a description of 1,001 characters');
  PERFORM pg_temp.must_refuse('{"naics_code":"54143"}', 'naics_code', 'a five-digit NAICS code');
  PERFORM pg_temp.must_refuse('{"naics_code":"5414300"}', 'naics_code', 'a seven-digit NAICS code');
  PERFORM pg_temp.must_refuse('{"naics_code":541430}', 'naics_code', 'a NAICS code sent as a number');
  PERFORM pg_temp.must_refuse('{"naics_code":"54143x"}', 'naics_code', 'a NAICS code with a letter');
  -- The earlier v3 answers are checked as they were.
  PERFORM pg_temp.must_accept('{"fein":"841234567","entities":[{"legal_name":"Meridian Creative LLC"}]}', 'company identity after K-1.2');
  PERFORM pg_temp.must_refuse('{"fein":"84-1234567"}', 'fein', 'a hyphenated FEIN after K-1.2');
  RAISE NOTICE 'intake_schema_v3: industry code cases passed';
END $$;

-- ---------- K-1.3 current PEO ----------
DO $$
BEGIN
  PERFORM pg_temp.must_accept('{"in_peo":true,"current_peo":"Summit PEO","peo_renewal_date":"January 2027"}', 'an employer in a PEO');
  PERFORM pg_temp.must_accept('{"in_peo":false,"current_peo":null,"peo_renewal_date":null}', 'an employer in no PEO');
  PERFORM pg_temp.must_refuse('{"in_peo":"no"}', 'in_peo', 'in_peo sent as text');
  PERFORM pg_temp.must_refuse('{"current_peo":7}', 'current_peo', 'a PEO sent as a number');
  PERFORM pg_temp.must_refuse(jsonb_build_object('peo_renewal_date', repeat('x', 1001)), 'peo_renewal_date', 'a renewal of 1,001 characters');
  PERFORM pg_temp.must_accept('{"naics_code":"541430","fein":"841234567"}', 'earlier v3 answers after K-1.3');
  RAISE NOTICE 'intake_schema_v3: current PEO cases passed';
END $$;

-- ---------- K-2.1 census columns PEOs ask for ----------
DO $$
BEGIN
  PERFORM pg_temp.must_accept('{"census":[{"first_name":"Ann","gender":"F","hire_date":"2019-04-01","cobra":false,"home_state":"NV"}]}', 'a census row with the new columns');
  PERFORM pg_temp.must_accept('{"census":[{"first_name":"Ann"}]}', 'a census row without them');
  PERFORM pg_temp.must_accept('{"census":[{"first_name":"Ann","gender":"X","cobra":true}]}', 'gender X and COBRA');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann"},{"first_name":"Bo","gender":"female"}]}', 'census[1].gender', 'a gender written out');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann","gender":1}]}', 'census[0].gender', 'a gender that is not text');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann","cobra":"no"}]}', 'census[0].cobra', 'COBRA sent as text');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann","home_state":"Nevada"}]}', 'census[0].home_state', 'a home state by name');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann","home_state":""}]}', 'census[0].home_state', 'a blank home state');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann","hire_date":20190401}]}', 'census[0].hire_date', 'a hire date sent as a number');
  PERFORM pg_temp.must_refuse(jsonb_build_object('census', jsonb_build_array(jsonb_build_object('first_name', 'Ann', 'hire_date', repeat('x', 41)))), 'census[0].hire_date', 'a hire date of 41 characters');
  -- What a census row held before is checked as it was, and a key the database doesn't know is still tolerated.
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann","work_state":"California"}]}', 'census[0].work_state', 'a work state by name');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":" "}]}', 'census[0].first_name', 'a blank first name');
  PERFORM pg_temp.must_accept('{"census":[{"first_name":"Ann","nickname":"A"}]}', 'an unknown key on a census row');
  RAISE NOTICE 'intake_schema_v3: census column cases passed';
END $$;

-- ---------- K-2.2 where and how each employee works ----------
DO $$
BEGIN
  PERFORM pg_temp.must_accept('{"census":[{"first_name":"Ann","worksite":"Oakland warehouse","remote":false,"travels":true}]}', 'a census row with a worksite');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann","worksite":4}]}', 'census[0].worksite', 'a worksite that is not text');
  PERFORM pg_temp.must_refuse(jsonb_build_object('census', jsonb_build_array(jsonb_build_object('first_name', 'Ann', 'worksite', repeat('x', 201)))), 'census[0].worksite', 'a worksite of 201 characters');
  PERFORM pg_temp.must_accept(jsonb_build_object('census', jsonb_build_array(jsonb_build_object('first_name', 'Ann', 'worksite', repeat('x', 200)))), 'a worksite of 200 characters');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann","remote":"no"}]}', 'census[0].remote', 'remote sent as text');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann","travels":1}]}', 'census[0].travels', 'travels sent as a number');
  PERFORM pg_temp.must_refuse('{"census":[{"first_name":"Ann","gender":"female"}]}', 'census[0].gender', 'a gender written out, after K-2.2');
  RAISE NOTICE 'intake_schema_v3: worksite cases passed';
END $$;
