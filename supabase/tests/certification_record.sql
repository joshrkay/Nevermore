-- Run against a scratch Postgres (NOT production) after stubbing Supabase's `auth` schema and roles:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/certification_record.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;

CREATE TABLE IF NOT EXISTS public.chamber_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chamber_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress',
  submission jsonb
);
\i supabase/migrations/20261020200000_block_guest_submission.sql
\i supabase/migrations/20261020210000_certification_record.sql

DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  sub jsonb;
  stored jsonb;
  n int;
  st text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'is_anonymous', false)::text, false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, '{"company_name":"Acme","employee_count":10}') RETURNING id INTO sid;
  sub := jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-10-20T12:00:00Z',
    'file_id', 'EAA-2026-X', 'consent_text_version', 'v1', 'consent_text', jsonb_build_array('I agree'),
    'chamber_data', '{"company_name":"Acme","employee_count":10}'::jsonb);

  -- Each required piece of the certification is enforced by the database.
  FOREACH st IN ARRAY ARRAY['signer_name', 'signer_title', 'consent_text_version', 'consent_text', 'signed_at'] LOOP
    BEGIN
      UPDATE public.chamber_sessions SET status = 'submitted', submission = sub - st WHERE id = sid;
      RAISE EXCEPTION 'FAIL: submission without % was allowed', st;
    EXCEPTION WHEN check_violation THEN NULL; END;
  END LOOP;
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', submission = sub || '{"signer_title":"   "}' WHERE id = sid;
    RAISE EXCEPTION 'FAIL: blank role was allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', submission = NULL WHERE id = sid;
    RAISE EXCEPTION 'FAIL: submission with no certification was allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- The snapshot must be the data being submitted.
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', submission = sub || '{"chamber_data":{"company_name":"Other"}}' WHERE id = sid;
    RAISE EXCEPTION 'FAIL: snapshot that differs from the saved data was allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  SELECT count(*) INTO n FROM public.chamber_certifications;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: rejected attempts left % certification rows', n; END IF;

  -- A complete certification is accepted, stamped, and recorded.
  UPDATE public.chamber_sessions SET status = 'submitted', submission = sub || '{"certified_at":"1999-01-01T00:00:00Z"}' WHERE id = sid;
  SELECT submission INTO stored FROM public.chamber_sessions WHERE id = sid;
  IF stored ->> 'certified_at' = '1999-01-01T00:00:00Z' OR stored ->> 'data_hash' IS NULL THEN
    RAISE EXCEPTION 'FAIL: server did not stamp certified_at / data_hash (%).', stored;
  END IF;
  SELECT count(*) INTO n FROM public.chamber_certifications WHERE session_id = sid AND signer_name = 'Jo Doe' AND signer_title = 'CEO' AND consent_text_version = 'v1';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: expected one certification row, got %', n; END IF;

  -- The certification record is readable by its owner only, and never changeable.
  BEGIN
    UPDATE public.chamber_certifications SET signer_name = 'Mallory';
    RAISE EXCEPTION 'FAIL: certification row was updated';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.chamber_certifications;
    RAISE EXCEPTION 'FAIL: certification row was deleted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- Autosave rewriting identical data (or the transcript) leaves the certification alone.
  UPDATE public.chamber_sessions SET chamber_data = '{"employee_count":10,"company_name":"Acme"}', transcript = '[{"x":1}]' WHERE id = sid;
  SELECT status INTO st FROM public.chamber_sessions WHERE id = sid;
  IF st <> 'submitted' THEN RAISE EXCEPTION 'FAIL: unchanged data withdrew the certification (%)', st; END IF;

  -- Changing the data withdraws it: re-certification is required.
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Acme","employee_count":11}' WHERE id = sid;
  SELECT status INTO st FROM public.chamber_sessions WHERE id = sid;
  IF st <> 'in_progress' THEN RAISE EXCEPTION 'FAIL: edit after certification kept status %', st; END IF;

  -- The old certification cannot be reused for the edited data...
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted' WHERE id = sid;
    RAISE EXCEPTION 'FAIL: stale certification was reused for edited data';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', submission = sub WHERE id = sid;
    RAISE EXCEPTION 'FAIL: stale snapshot was accepted for edited data';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- ...but a fresh certification of the edited data is accepted and recorded.
  UPDATE public.chamber_sessions SET status = 'submitted',
    submission = sub || '{"signed_at":"2026-10-21T09:00:00Z","chamber_data":{"company_name":"Acme","employee_count":11}}'
  WHERE id = sid;
  SELECT count(*) INTO n FROM public.chamber_certifications WHERE session_id = sid;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: expected two certification rows after re-certifying, got %', n; END IF;

  -- Guests are still refused before any of this.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'is_anonymous', true)::text, false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, '{}') RETURNING id INTO sid;
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', submission = sub || '{"chamber_data":{}}' WHERE id = sid;
    RAISE EXCEPTION 'FAIL: guest certified';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  RAISE NOTICE 'certification_record: all cases passed';
END $$;
