-- Run against a scratch Postgres (NOT production); it drops and recreates the `public` schema:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/certification_snapshots.sql
-- Stubs Supabase's `auth` functions, then checks that every certification keeps the answers it covered, with the
-- guest block, as they run in production.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.chamber_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chamber_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress',
  submission jsonb
);
\i supabase/migrations/20261020200000_block_guest_submission.sql
\i supabase/migrations/20261020210000_certification_events.sql

-- Fails the run unless `stmt` is refused by a check.
CREATE FUNCTION pg_temp.must_refuse(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'FAIL: % was allowed', label;
EXCEPTION WHEN check_violation THEN NULL;
END $$;

-- An intake certified before this migration: the backfill gives its current certification the snapshot.
CREATE TEMP TABLE before_ AS SELECT gen_random_uuid() AS uid, NULL::uuid AS sid;
DO $$
DECLARE
  uid uuid := (SELECT uid FROM before_);
  new_id uuid;
  data jsonb := '{"company_name":"Early Co"}';
BEGIN
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","is_anonymous":false}', uid), false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id INTO new_id;
  UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
    'signer_name', 'Ann', 'signer_title', 'COO', 'signed_at', '2026-04-01T12:00:00Z', 'file_id', 'EAA-0',
    'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', data,
    'field_provenance', '{"company_name":{"status":"confirmed"}}'::jsonb)
  WHERE id = new_id;
  UPDATE before_ SET sid = new_id;
END $$;

-- An intake certified twice with the same answers (changed, then changed back): both certifications hash the
-- same, but only the latest one's signing is on the submission, so only it may be given that snapshot.
CREATE TEMP TABLE twice_ AS SELECT NULL::uuid AS sid;
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  new_id uuid;
  data jsonb := '{"company_name":"Twice Co"}';
  base jsonb := jsonb_build_object('signer_name', 'Ann', 'signer_title', 'COO', 'file_id', 'EAA-T',
    'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', '{"company_name":"Twice Co"}'::jsonb);
BEGIN
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","is_anonymous":false}', uid), false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id INTO new_id;
  UPDATE public.chamber_sessions SET status = 'submitted',
    submission = base || jsonb_build_object('signed_at', '2026-04-01T12:00:00Z', 'field_provenance', '{"company_name":{"status":"inferred"}}'::jsonb)
  WHERE id = new_id;
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Other Co"}' WHERE id = new_id;
  UPDATE public.chamber_sessions SET chamber_data = data WHERE id = new_id;
  UPDATE public.chamber_sessions SET status = 'submitted',
    submission = base || jsonb_build_object('signed_at', '2026-04-02T12:00:00Z', 'field_provenance', '{"company_name":{"status":"confirmed"}}'::jsonb)
  WHERE id = new_id;
  UPDATE twice_ SET sid = new_id;
END $$;

\i supabase/migrations/20261104117000_certification_snapshots.sql

DO $$
DECLARE
  early uuid := (SELECT sid FROM before_);
  uid uuid := gen_random_uuid();
  sid uuid;
  first_ jsonb := '{"company_name":"Acme","employee_count":12}';
  second_ jsonb := '{"company_name":"Acme Inc","employee_count":14}';
  prov jsonb := '{"employee_count":{"status":"inferred"}}';
  base jsonb;
  c_first uuid;
  c_second uuid;
  n int;
BEGIN
  IF (SELECT chamber_data FROM public.chamber_certifications WHERE session_id = early) IS DISTINCT FROM '{"company_name":"Early Co"}'::jsonb
     OR (SELECT field_provenance ->> 'company_name' FROM public.chamber_certifications WHERE session_id = early) IS NULL THEN
    RAISE EXCEPTION 'FAIL: the backfill did not copy the current snapshot';
  END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = (SELECT twice_.sid FROM twice_)) <> 2
     OR (SELECT count(*) FROM public.chamber_certifications WHERE session_id = (SELECT twice_.sid FROM twice_) AND chamber_data IS NOT NULL) <> 1
     OR (SELECT field_provenance -> 'company_name' ->> 'status' FROM public.chamber_certifications
         WHERE session_id = (SELECT twice_.sid FROM twice_) AND chamber_data IS NOT NULL) IS DISTINCT FROM 'confirmed'
     OR (SELECT signed_at FROM public.chamber_certifications
         WHERE session_id = (SELECT twice_.sid FROM twice_) AND chamber_data IS NOT NULL) IS DISTINCT FROM '2026-04-02T12:00:00Z'::timestamptz THEN
    RAISE EXCEPTION 'FAIL: the backfill gave an earlier certification of the same answers the latest one''s snapshot';
  END IF;

  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","is_anonymous":false}', uid), false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, first_) RETURNING id INTO sid;
  base := jsonb_build_object('signer_name', 'Jo Doe', 'signer_title', 'CEO', 'file_id', 'EAA-1',
    'consent_version', 'v1', 'consent_text', 'I certify.');

  -- First certification records its answers and their provenance.
  UPDATE public.chamber_sessions SET status = 'submitted',
    submission = base || jsonb_build_object('signed_at', '2026-05-01T12:00:00Z', 'chamber_data', first_, 'field_provenance', prov)
  WHERE id = sid;
  SELECT id INTO c_first FROM public.chamber_certifications WHERE session_id = sid;
  IF (SELECT chamber_data FROM public.chamber_certifications WHERE id = c_first) IS DISTINCT FROM first_
     OR (SELECT field_provenance FROM public.chamber_certifications WHERE id = c_first) IS DISTINCT FROM prov THEN
    RAISE EXCEPTION 'FAIL: the certification did not keep what it covered';
  END IF;

  -- Edit, then certify again: the session's submission is overwritten, the first record is not.
  UPDATE public.chamber_sessions SET chamber_data = second_ WHERE id = sid;
  UPDATE public.chamber_sessions SET status = 'submitted',
    submission = base || jsonb_build_object('signed_at', '2026-05-02T12:00:00Z', 'chamber_data', second_)
  WHERE id = sid;
  SELECT count(*) INTO n FROM public.chamber_certifications WHERE session_id = sid;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: expected 2 certifications, got %', n; END IF;
  SELECT id INTO c_second FROM public.chamber_certifications WHERE session_id = sid AND superseded_at IS NULL;
  IF (SELECT chamber_data FROM public.chamber_certifications WHERE id = c_first) IS DISTINCT FROM first_ THEN
    RAISE EXCEPTION 'FAIL: certifying again changed the earlier snapshot';
  END IF;
  IF (SELECT superseded_reason FROM public.chamber_certifications WHERE id = c_first) IS DISTINCT FROM 'data_changed' THEN
    RAISE EXCEPTION 'FAIL: the earlier certification was not superseded';
  END IF;
  IF (SELECT chamber_data FROM public.chamber_certifications WHERE id = c_second) IS DISTINCT FROM second_
     OR (SELECT field_provenance FROM public.chamber_certifications WHERE id = c_second) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the new certification did not keep exactly what it covered';
  END IF;

  -- What was signed can't be changed, even by the table's owner; bookkeeping still can.
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_certifications SET chamber_data = %L WHERE id = %L', '{"company_name":"Forged"}', c_first), 'changing a certified snapshot');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_certifications SET field_provenance = NULL WHERE id = %L', c_first), 'dropping a snapshot''s provenance');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_certifications SET signer_name = %L WHERE id = %L', 'Someone Else', c_first), 'changing the signer');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_certifications SET data_sha256 = %L WHERE id = %L', 'x', c_first), 'changing the fingerprint');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_certifications SET consent_text = %L WHERE id = %L', 'Other words.', c_first), 'changing the consent');
  UPDATE public.chamber_certifications SET recorded_at = recorded_at - interval '1 day', superseded_reason = 'recertified' WHERE id = c_first;

  -- Deleting still works, as the deletion process needs.
  DELETE FROM public.chamber_sessions WHERE id = sid;
  IF EXISTS (SELECT 1 FROM public.chamber_certifications WHERE session_id = sid) THEN
    RAISE EXCEPTION 'FAIL: certifications outlived their intake';
  END IF;

  RAISE NOTICE 'certification_snapshots: all cases passed';
END $$;
