-- Run against a scratch Postgres, never one you care about (not production, not a local or dev
-- Supabase): it drops and recreates the `public` AND `auth` schemas, which deletes real users:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/intake_handoff.sql
-- Loads the real migrations chamber_sessions comes from, so the guest block, certification, validation,
-- version and updated_at triggers fire in their production order, then checks what
-- 20261103090000_chosen_peo_and_expired_intakes.sql adds:
-- * chosen_peo is saved with the intake, in the versioned write, and is not an answer: changing it on a
--   certified intake keeps the certification. Only a trimmed name of 1 to 80 characters is stored.
-- * an expired intake can be read by its owner but not changed by them (SQLSTATE EA002, row untouched),
--   whatever the change, and that refusal comes before every other one. The service role and a
--   connection with no user JWT (a scheduled job) can still change it.
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
\i supabase/migrations/20261103090000_chosen_peo_and_expired_intakes.sql

-- ---------- helpers ----------
-- The signed-in user, as PostgREST presents them: JWT claims with role `authenticated`.
CREATE FUNCTION pg_temp.as_user(uid uuid, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated')::text, false);
END $$;

-- No user JWT at all: a migration, or a scheduled job such as the retention job will be.
CREATE FUNCTION pg_temp.as_job() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
END $$;

CREATE FUNCTION pg_temp.snap(sid uuid) RETURNS jsonb LANGUAGE sql AS
  $$ SELECT to_jsonb(s) FROM public.chamber_sessions s WHERE s.id = sid $$;

-- Fails the run unless stmt raises exactly `state` and leaves the row as it was. Run it as the caller being tested.
CREATE FUNCTION pg_temp.must_raise(sid uuid, stmt text, state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  before_row jsonb := pg_temp.snap(sid);
  s text; m text;
  raised boolean := false;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    raised := true;
    IF s <> state THEN RAISE EXCEPTION 'FAIL: % raised % (%), expected %', label, s, m, state; END IF;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'FAIL: % was accepted', label; END IF;
  IF pg_temp.snap(sid) IS DISTINCT FROM before_row THEN RAISE EXCEPTION 'FAIL: % changed the row', label; END IF;
END $$;

-- Rows an UPDATE matched: what PostgREST returns with .select(), so 0 is a conflict.
CREATE FUNCTION pg_temp.rows_changed(stmt text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- A certification of `data`, as the Reckoning sends it.
CREATE FUNCTION pg_temp.certification(data jsonb, peo text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z', 'file_id', 'EAA-2026-TEST',
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'peo', peo, 'chamber_data', data)
$$;

-- ---------- the chosen PEO ----------
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  data jsonb := '{"company_name":"Acme"}';
  v integer;
  row_ record;
  longest text := repeat('P', 80);
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id, data_version INTO sid, v;
  IF (SELECT chosen_peo FROM public.chamber_sessions WHERE id = sid) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a new intake has a chosen PEO';
  END IF;

  -- Saved with the intake, in the same versioned write as the answers.
  IF pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chosen_peo = %L, chamber_data = %L WHERE id = %L AND data_version = %s',
       'Justworks', data, sid, v)) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the owner could not save a chosen PEO';
  END IF;
  SELECT chosen_peo, data_version INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.chosen_peo <> 'Justworks' OR row_.data_version <> v + 1 THEN
    RAISE EXCEPTION 'FAIL: chosen PEO save left % at version %', row_.chosen_peo, row_.data_version;
  END IF;
  v := row_.data_version;

  -- A name of exactly 80 characters is kept, and clearing the choice is allowed.
  UPDATE public.chamber_sessions SET chosen_peo = longest WHERE id = sid;
  IF (SELECT chosen_peo FROM public.chamber_sessions WHERE id = sid) <> longest THEN RAISE EXCEPTION 'FAIL: an 80-character name was not kept'; END IF;
  UPDATE public.chamber_sessions SET chosen_peo = NULL WHERE id = sid;
  IF (SELECT chosen_peo FROM public.chamber_sessions WHERE id = sid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: the choice could not be cleared'; END IF;

  -- Anything the front end would never send is refused, and the row is left alone.
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET chosen_peo = %L WHERE id = %L', '', sid), '23514', 'an empty name');
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET chosen_peo = %L WHERE id = %L', '   ', sid), '23514', 'a blank name');
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET chosen_peo = %L WHERE id = %L', ' Justworks', sid), '23514', 'an untrimmed name');
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET chosen_peo = %L WHERE id = %L', longest || 'X', sid), '23514', 'an 81-character name');

  -- Certify for Justworks, then pick another PEO: the choice is saved and the certification stands,
  -- because the answers it covers did not change. The certified PEO stays in the submission.
  UPDATE public.chamber_sessions SET chosen_peo = 'Justworks' WHERE id = sid;
  UPDATE public.chamber_sessions SET status = 'submitted', submission = pg_temp.certification(data, 'Justworks') WHERE id = sid;
  UPDATE public.chamber_sessions SET chosen_peo = 'TriNet' WHERE id = sid;
  SELECT status, chosen_peo, submission ->> 'peo' AS certified_peo INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'submitted' OR row_.chosen_peo <> 'TriNet' OR row_.certified_peo <> 'Justworks' THEN
    RAISE EXCEPTION 'FAIL: choosing another PEO left status %, chosen %, certified %', row_.status, row_.chosen_peo, row_.certified_peo;
  END IF;
  RESET ROLE;
  RAISE NOTICE 'intake_handoff: chosen PEO cases passed';
END $$;

-- ---------- an expired intake ----------
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  data jsonb := '{"company_name":"Gone Co"}';
  v integer;
  row_ record;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data, chosen_peo) VALUES (uid, data, 'Insperity') RETURNING id INTO sid;
  RESET ROLE;

  -- The retention job runs with no user JWT. Expiring the intake moves its version on, like any update.
  PERFORM pg_temp.as_job();
  SELECT data_version INTO v FROM public.chamber_sessions WHERE id = sid;
  UPDATE public.chamber_sessions SET status = 'expired' WHERE id = sid;
  IF (SELECT data_version FROM public.chamber_sessions WHERE id = sid) <> v + 1 THEN RAISE EXCEPTION 'FAIL: expiring did not move the version'; END IF;
  v := v + 1;

  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;

  -- The owner can still read it, so the app can say that it expired.
  SELECT status, chosen_peo INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status IS DISTINCT FROM 'expired' THEN RAISE EXCEPTION 'FAIL: the owner cannot see their expired intake (status %)', row_.status; END IF;

  -- Nothing the owner sends changes it, and expiry is the reason given, ahead of every other refusal.
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L AND data_version = %s',
    '{"company_name":"Back again"}', sid, v), 'EA002', 'an autosave');
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET transcript = %L WHERE id = %L', '[{"sender":"user","text":"hi"}]', sid),
    'EA002', 'a transcript-only save');
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET chosen_peo = %L WHERE id = %L', 'TriNet', sid), 'EA002', 'choosing a PEO');
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET status = %L WHERE id = %L', 'in_progress', sid), 'EA002', 'reopening it');
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"employee_count":-1}', sid),
    'EA002', 'an invalid answer (EA001 otherwise)');
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET status = %L, submission = %L WHERE id = %L',
    'submitted', pg_temp.certification(data, 'Insperity'), sid), 'EA002', 'certifying it');
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET status = %L, submission = %L WHERE id = %L',
    'submitted', '{}', sid), 'EA002', 'an incomplete certification (23514 otherwise)');

  -- A save from before it expired names the old version: it matches nothing, so the app reads the row back.
  IF pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L AND data_version = %s',
       '{"company_name":"Stale tab"}', sid, v - 1)) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a save at the version before expiry matched the row';
  END IF;
  RESET ROLE;

  -- A guest owner is refused as expired too, not as a guest certifying.
  PERFORM pg_temp.as_user(uid, true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.must_raise(sid, format('UPDATE public.chamber_sessions SET status = %L, submission = %L WHERE id = %L',
    'submitted', pg_temp.certification(data, 'Insperity'), sid), 'EA002', 'a guest certifying it (42501 otherwise)');
  RESET ROLE;

  -- The service role, and a job with no user JWT, can still change it. (The guard reads the JWT's role;
  -- the service role also bypasses row security in Supabase, which this scratch database doesn't set up.)
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  UPDATE public.chamber_sessions SET transcript = '[]' WHERE id = sid;
  PERFORM pg_temp.as_job();
  UPDATE public.chamber_sessions SET chosen_peo = NULL WHERE id = sid;
  SELECT status, chosen_peo, data_version INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'expired' OR row_.chosen_peo IS NOT NULL OR row_.data_version <> v + 2 THEN
    RAISE EXCEPTION 'FAIL: privileged updates left status %, chosen %, version %', row_.status, row_.chosen_peo, row_.data_version;
  END IF;
  RAISE NOTICE 'intake_handoff: expired intake cases passed';
END $$;

-- ---------- other intakes are untouched ----------
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  live uuid;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, '{"company_name":"Live Co"}') RETURNING id INTO live;
  -- An intake that has not expired takes every kind of save, and an invalid answer is still EA001.
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Live Co Inc"}', chosen_peo = 'Rippling' WHERE id = live;
  PERFORM pg_temp.must_raise(live, format('UPDATE public.chamber_sessions SET chamber_data = %L WHERE id = %L', '{"employee_count":-1}', live),
    'EA001', 'an invalid answer on a live intake');
  IF (SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = live) <> 'Live Co Inc' THEN
    RAISE EXCEPTION 'FAIL: a live intake did not save';
  END IF;
  RESET ROLE;
  RAISE NOTICE 'intake_handoff: live intake cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'intake_handoff: all cases passed'; END $$;
