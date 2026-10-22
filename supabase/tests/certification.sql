-- Run against a scratch Postgres (NOT production); it drops and recreates the `public` schema:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/certification.sql
-- Stubs Supabase's `auth` functions, then exercises the certification triggers together with the
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

-- Fails the run if `stmt` succeeds.
CREATE FUNCTION pg_temp.must_refuse(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'FAIL: % was allowed', label;
EXCEPTION WHEN check_violation OR insufficient_privilege THEN NULL;
END $$;

DO $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid;
  data jsonb := '{"company_name":"Acme","employees":[]}';
  edited jsonb := '{"company_name":"Acme Inc","employees":[]}';
  good jsonb;
  row_ public.chamber_sessions;
  events int;
  active int;
  sid2 uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","is_anonymous":false}', uid), false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id INTO sid;
  good := jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-05-01T12:00:00Z',
    'file_id', 'EAA-1', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', data);

  -- Blocked until certification is complete: each missing piece is refused.
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'' WHERE id = %L', sid), 'submitting with no certification');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', good - 'signer_name', sid), 'missing name');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', good || '{"signer_name":"   "}', sid), 'blank name');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', good - 'signer_title', sid), 'missing role');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', good - 'consent_text', sid), 'missing consent text');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', good - 'consent_version', sid), 'missing consent version');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', good || '{"signed_at":"not a date"}', sid), 'bad signing time');
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', good || jsonb_build_object('chamber_data', edited), sid), 'certified data that differs from the saved session');
  SELECT count(*) INTO events FROM public.chamber_certifications;
  IF events <> 0 THEN RAISE EXCEPTION 'FAIL: refused attempts left % events', events; END IF;

  -- The app stores the consent as the list of statements shown, then the signing statement. A list is
  -- accepted and recorded in that order, so the record is exactly what the signer agreed to.
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id INTO sid2;
  UPDATE public.chamber_sessions SET status = 'submitted',
    submission = good || jsonb_build_object('file_id', 'EAA-2', 'consent_text', jsonb_build_array('First statement.', 'By signing, I certify.'))
   WHERE id = sid2;
  IF NOT EXISTS (
    SELECT 1 FROM public.chamber_certifications
     WHERE session_id = sid2 AND consent_text::jsonb = '["First statement.","By signing, I certify."]'::jsonb
  ) THEN RAISE EXCEPTION 'FAIL: a list of consent statements was not recorded as given'; END IF;
  DELETE FROM public.chamber_sessions WHERE id = sid2;
  DELETE FROM public.chamber_certifications WHERE session_id = sid2;

  -- A complete certification goes through, is recorded, and is stamped server-side.
  UPDATE public.chamber_sessions SET status = 'submitted', submission = good || '{"certified_at":"1999-01-01T00:00:00Z","data_sha256":"forged"}' WHERE id = sid;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'submitted' THEN RAISE EXCEPTION 'FAIL: status is %', row_.status; END IF;
  IF (row_.submission ->> 'data_sha256') <> encode(sha256(convert_to(data::text, 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'FAIL: client-supplied hash was kept';
  END IF;
  IF (row_.submission ->> 'certified_at')::timestamptz < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'FAIL: client-supplied certified_at was kept';
  END IF;
  SELECT count(*) INTO events FROM public.chamber_certifications WHERE session_id = sid AND superseded_at IS NULL
    AND signer_name = 'Jo Doe' AND signer_title = 'CEO' AND consent_text = 'I certify.' AND user_id = uid;
  IF events <> 1 THEN RAISE EXCEPTION 'FAIL: expected 1 recorded certification, got %', events; END IF;

  -- Saving only the transcript (or identical data) leaves the certification standing.
  UPDATE public.chamber_sessions SET transcript = '[{"role":"user"}]', chamber_data = data WHERE id = sid;
  SELECT status INTO row_.status FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'submitted' THEN RAISE EXCEPTION 'FAIL: unrelated save withdrew the certification'; END IF;
  SELECT count(*) INTO events FROM public.chamber_certifications WHERE session_id = sid;
  IF events <> 1 THEN RAISE EXCEPTION 'FAIL: unrelated save recorded % events', events; END IF;

  -- Changing the answers withdraws the certification: re-certification is required.
  UPDATE public.chamber_sessions SET chamber_data = edited WHERE id = sid;
  SELECT status INTO row_.status FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'in_progress' THEN RAISE EXCEPTION 'FAIL: edit after certification left status %', row_.status; END IF;
  SELECT count(*) INTO active FROM public.chamber_certifications WHERE session_id = sid AND superseded_at IS NULL;
  IF active <> 0 THEN RAISE EXCEPTION 'FAIL: withdrawn certification still active'; END IF;

  -- The edit can't be slipped past by re-sending the old signed copy.
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', good, sid), 're-submitting the stale signed data');

  -- Re-certifying the new data works and keeps the history.
  UPDATE public.chamber_sessions SET status = 'submitted', submission = good || jsonb_build_object('chamber_data', edited, 'signed_at', '2026-05-02T09:30:00Z') WHERE id = sid;
  SELECT count(*) INTO events FROM public.chamber_certifications WHERE session_id = sid;
  SELECT count(*) INTO active FROM public.chamber_certifications WHERE session_id = sid AND superseded_at IS NULL;
  IF events <> 2 OR active <> 1 THEN RAISE EXCEPTION 'FAIL: expected 2 events / 1 active, got % / %', events, active; END IF;

  -- Guests still can't certify.
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","is_anonymous":true}', uid), false);
  UPDATE public.chamber_sessions SET chamber_data = data WHERE id = sid;  -- withdraws
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', good, sid), 'guest certification');

  RAISE NOTICE 'certification: all cases passed';
END $$;
