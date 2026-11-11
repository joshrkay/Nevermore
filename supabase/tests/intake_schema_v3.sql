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
\i supabase/migrations/20261112091000_intake_schema_v3_company_identity.sql
\i supabase/migrations/20261112092000_intake_schema_v3_industry_code.sql
\i supabase/migrations/20261112093000_intake_schema_v3_current_peo.sql
\i supabase/migrations/20261112094000_intake_schema_v3_census_columns.sql
\i supabase/migrations/20261112095000_intake_schema_v3_census_worksite.sql
\i supabase/migrations/20261112096000_intake_schema_v3_owners_officers.sql
\i supabase/migrations/20261112097000_intake_schema_v3_loss_history.sql
\i supabase/migrations/20261112098000_intake_schema_v3_medical_plans.sql
\i supabase/migrations/20261112099000_intake_schema_v3_suta_rates.sql
\i supabase/migrations/20261112100000_intake_schema_v3_acord_130_questions.sql

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

-- ---------- K-3.1 owners and officers ----------
DO $$
BEGIN
  PERFORM pg_temp.must_accept('{"owners_officers":[{"name":"Dana Reyes","title":"President","ownership_percent":60,"duties":"Runs sales; no field work","covered":false},{"name":"Sam Okafor","ownership_percent":12.5,"covered":true},{}]}', 'owners and officers');
  PERFORM pg_temp.must_accept('{"owners_officers":[]}', 'no owners listed');
  PERFORM pg_temp.must_accept('{"owners_officers":[{"ownership_percent":0},{"ownership_percent":100}]}', 'shares at the limits');
  PERFORM pg_temp.must_refuse('{"owners_officers":[{"ownership_percent":100.01}]}', 'owners_officers[0].ownership_percent', 'a share over 100');
  PERFORM pg_temp.must_refuse('{"owners_officers":[{"ownership_percent":-1}]}', 'owners_officers[0].ownership_percent', 'a negative share');
  PERFORM pg_temp.must_refuse('{"owners_officers":[{"ownership_percent":"60"}]}', 'owners_officers[0].ownership_percent', 'a share sent as text');
  PERFORM pg_temp.must_refuse('{"owners_officers":[{"name":"A"},{"covered":"no"}]}', 'owners_officers[1].covered', 'covered sent as text');
  PERFORM pg_temp.must_refuse(jsonb_build_object('owners_officers', jsonb_build_array(jsonb_build_object('name', repeat('x', 201)))), 'owners_officers[0].name', 'a name of 201 characters');
  PERFORM pg_temp.must_refuse(jsonb_build_object('owners_officers', jsonb_build_array(jsonb_build_object('title', repeat('x', 201)))), 'owners_officers[0].title', 'a title of 201 characters');
  PERFORM pg_temp.must_refuse(jsonb_build_object('owners_officers', jsonb_build_array(jsonb_build_object('duties', repeat('x', 1001)))), 'owners_officers[0].duties', 'duties of 1,001 characters');
  PERFORM pg_temp.must_refuse('{"owners_officers":[{"ssn":"1"}]}', 'owners_officers[0].ssn', 'an unknown key on an owner');
  PERFORM pg_temp.must_refuse(jsonb_build_object('owners_officers', (SELECT jsonb_agg(jsonb_build_object('name', 'O')) FROM generate_series(1, 21))), 'owners_officers', '21 owners');
  PERFORM pg_temp.must_accept(jsonb_build_object('owners_officers', (SELECT jsonb_agg(jsonb_build_object('name', 'O')) FROM generate_series(1, 20))), '20 owners');
  PERFORM pg_temp.must_accept('{"entities":[{"legal_name":"A","fein":"841234567"}]}', 'legal entities after K-3.1');
  PERFORM pg_temp.must_refuse('{"entities":[{"name":"A"}]}', 'entities[0].name', 'an owner''s key on a legal entity');
  RAISE NOTICE 'intake_schema_v3: owners and officers cases passed';
END $$;

-- ---------- K-3.3 loss history by year ----------
DO $$
BEGIN
  PERFORM pg_temp.must_accept('{"loss_history":[{"policy_year":2025,"carrier":"Pinnacle Mutual","premium":18400,"experience_mod":0.92,"claims":2,"paid":12500,"reserved":4000,"valuation_date":"2026-09-30"},{"policy_year":2024,"claims":0,"paid":0,"reserved":0},{"policy_year":2023,"no_coverage":true}]}', 'loss history');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"policy_year":1599}]}', 'loss_history[0].policy_year', 'a policy year before 1600');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"policy_year":"2025"}]}', 'loss_history[0].policy_year', 'a policy year sent as text');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"premium":1.5}]}', 'loss_history[0].premium', 'a premium with cents');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"paid":100000001}]}', 'loss_history[0].paid', 'paid over the cap');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"reserved":-1}]}', 'loss_history[0].reserved', 'a negative reserve');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"experience_mod":10.5}]}', 'loss_history[0].experience_mod', 'a mod over 10');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"experience_mod":"0.92"}]}', 'loss_history[0].experience_mod', 'a mod sent as text');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"claims":1.5}]}', 'loss_history[0].claims', 'a fractional claim count');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"no_coverage":"yes"}]}', 'loss_history[0].no_coverage', 'no coverage sent as text');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"carrier":7}]}', 'loss_history[0].carrier', 'a carrier that is not text');
  PERFORM pg_temp.must_refuse('{"loss_history":[{"adjuster":"x"}]}', 'loss_history[0].adjuster', 'an unknown key on a year');
  PERFORM pg_temp.must_refuse(jsonb_build_object('loss_history', (SELECT jsonb_agg(jsonb_build_object('policy_year', 2019 + n)) FROM generate_series(1, 6) n)), 'loss_history', 'six years');
  PERFORM pg_temp.must_accept(jsonb_build_object('loss_history', (SELECT jsonb_agg(jsonb_build_object('policy_year', 2019 + n)) FROM generate_series(1, 5) n)), 'five years');
  PERFORM pg_temp.must_accept('{"owners_officers":[{"name":"Dana Reyes","ownership_percent":60}]}', 'owners after K-3.3');
  RAISE NOTICE 'intake_schema_v3: loss history cases passed';
END $$;

-- ---------- K-4.1 current medical plans ----------
DO $$
BEGIN
  PERFORM pg_temp.must_accept('{"medical_plans":[{"name":"Gold PPO 500","carrier":"Blue Shield","rate_ee":612.4,"rate_ee_sp":1286.04,"rate_ee_ch":1102.32,"rate_fam":1837.2,"renewal_rate_ee":685.89,"renewal_rate_ee_sp":1440.36,"renewal_rate_ee_ch":1234.6,"renewal_rate_fam":2057.66,"employer_contribution":"75% of employee-only","enrolled":14},{"name":"Silver HMO"}]}', 'medical plans');
  PERFORM pg_temp.must_accept('{"medical_plans":[{"rate_ee":0},{"rate_fam":1000000}]}', 'rates at the limits');
  PERFORM pg_temp.must_refuse('{"medical_plans":[{"rate_ee":1000000.01}]}', 'medical_plans[0].rate_ee', 'a rate over the cap');
  PERFORM pg_temp.must_refuse('{"medical_plans":[{"rate_ee_sp":-0.01}]}', 'medical_plans[0].rate_ee_sp', 'a negative rate');
  PERFORM pg_temp.must_refuse('{"medical_plans":[{"renewal_rate_fam":"2057.66"}]}', 'medical_plans[0].renewal_rate_fam', 'a rate sent as text');
  PERFORM pg_temp.must_refuse('{"medical_plans":[{"enrolled":1.5}]}', 'medical_plans[0].enrolled', 'a fractional enrolment');
  PERFORM pg_temp.must_refuse('{"medical_plans":[{"name":7}]}', 'medical_plans[0].name', 'a plan name that is not text');
  PERFORM pg_temp.must_refuse(jsonb_build_object('medical_plans', jsonb_build_array(jsonb_build_object('employer_contribution', repeat('x', 201)))), 'medical_plans[0].employer_contribution', 'a contribution of 201 characters');
  PERFORM pg_temp.must_refuse('{"medical_plans":[{"deductible":500}]}', 'medical_plans[0].deductible', 'an unknown key on a plan');
  PERFORM pg_temp.must_refuse(jsonb_build_object('medical_plans', (SELECT jsonb_agg(jsonb_build_object('name', 'P')) FROM generate_series(1, 21))), 'medical_plans', '21 plans');
  PERFORM pg_temp.must_accept('{"loss_history":[{"policy_year":2025,"premium":18400}]}', 'loss history after K-4.1');
  RAISE NOTICE 'intake_schema_v3: medical plan cases passed';
END $$;

-- ---------- K-4.2 state unemployment rates ----------
DO $$
BEGIN
  PERFORM pg_temp.must_accept('{"suta_rates":[{"state":"CA","rate":3.4,"year":2026},{"state":"TX","rate":2.7},{"state":"NY"}]}', 'unemployment rates');
  PERFORM pg_temp.must_accept('{"suta_rates":[{"rate":0},{"rate":100}]}', 'rates at the limits');
  PERFORM pg_temp.must_refuse('{"suta_rates":[{"state":"California"}]}', 'suta_rates[0].state', 'a state by name');
  PERFORM pg_temp.must_refuse('{"suta_rates":[{"state":"CA"},{"rate":100.1}]}', 'suta_rates[1].rate', 'a rate over 100');
  PERFORM pg_temp.must_refuse('{"suta_rates":[{"rate":"3.4%"}]}', 'suta_rates[0].rate', 'a rate sent as text');
  PERFORM pg_temp.must_refuse('{"suta_rates":[{"year":2101}]}', 'suta_rates[0].year', 'a year after 2100');
  PERFORM pg_temp.must_refuse('{"suta_rates":[{"wage_base":7000}]}', 'suta_rates[0].wage_base', 'an unknown key on a rate');
  PERFORM pg_temp.must_refuse(jsonb_build_object('suta_rates', (SELECT jsonb_agg(jsonb_build_object('state', 'CA')) FROM generate_series(1, 61))), 'suta_rates', '61 rates');
  PERFORM pg_temp.must_accept('{"medical_plans":[{"name":"Gold PPO","rate_ee":612.4}]}', 'medical plans after K-4.2');
  RAISE NOTICE 'intake_schema_v3: unemployment rate cases passed';
END $$;

-- ---------- K-3.4 the ACORD 130 general information questions ----------
DO $$
DECLARE
  n int;
BEGIN
  PERFORM pg_temp.must_accept('{"wcq_01":false,"wcq_06":true,"wcq_06_explain":"About 20% of the work","wcq_13":null,"wcq_24":true,"wcq_24_explain":null}', 'ACORD 130 answers');
  PERFORM pg_temp.must_refuse('{"wcq_06":"yes"}', 'wcq_06', 'a question answered in text');
  PERFORM pg_temp.must_refuse('{"wcq_06_explain":20}', 'wcq_06_explain', 'an explanation that is not text');
  PERFORM pg_temp.must_refuse(jsonb_build_object('wcq_24_explain', repeat('x', 1001)), 'wcq_24_explain', 'an explanation of 1,001 characters');
  PERFORM pg_temp.must_refuse('{"wcq_25":true}', 'wcq_25', 'a twenty-fifth question');
  PERFORM pg_temp.must_refuse('{"wcq_00":true}', 'wcq_00', 'a question numbered zero');
  -- Every one of the 24 is known, with its explanation, and can be reviewed by an advisor.
  FOR n IN 1..24 LOOP
    IF public.chamber_data_field_kind(format('wcq_%s', lpad(n::text, 2, '0'))) IS DISTINCT FROM 'boolean'
       OR public.chamber_data_field_kind(format('wcq_%s_explain', lpad(n::text, 2, '0'))) IS DISTINCT FROM 'text' THEN
      RAISE EXCEPTION 'FAIL: ACORD 130 question % is not a yes or no with a text explanation', n;
    END IF;
  END LOOP;
  IF NOT public.is_reviewable_field('wcq_13') THEN RAISE EXCEPTION 'FAIL: an ACORD 130 answer cannot be reviewed'; END IF;
  PERFORM pg_temp.must_accept('{"suta_rates":[{"state":"CA","rate":3.4}]}', 'unemployment rates after K-3.4');
  RAISE NOTICE 'intake_schema_v3: ACORD 130 cases passed';
END $$;
