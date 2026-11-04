-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh intake_handoff
-- The chosen PEO (20261103100000_chosen_peo.sql): it is saved with the intake in the versioned write, it is
-- not an answer (changing it on a certified intake keeps the certification), only a trimmed name of 1 to 80
-- characters is stored, and a closed intake refuses it like any other change. Everything a prospect does
-- runs as `authenticated` with their JWT claims, so row security and the lifecycle guard are on.
\set ON_ERROR_STOP 1
\i e2e/stack/bootstrap.sql
\i supabase/migrations/20260323215855_6110f697-3604-440a-bcc3-685413801386.sql
\i supabase/migrations/20260323224722_847cb3a9-3573-491f-ba0c-54a2ccea0340.sql
\i supabase/migrations/20260324031329_0de2017b-f5c3-4631-b280-4cfa150f3c76.sql
\i supabase/migrations/20261020180000_signup_company_and_session_submission.sql
\i supabase/migrations/20261020190000_ai_rate_limit.sql
\i supabase/migrations/20261020200000_block_guest_submission.sql
\i supabase/migrations/20261020210000_certification_events.sql
\i supabase/migrations/20261020220000_guest_abuse_limits.sql
\i supabase/migrations/20261021090000_chamber_field_provenance.sql
\i supabase/migrations/20261021100000_session_documents.sql
\i supabase/migrations/20261022090000_advisor_operations.sql
\i supabase/migrations/20261023090000_document_categories_and_storage_access.sql
\i supabase/migrations/20261024090000_document_processing_started.sql
\i supabase/migrations/20261024100000_advisor_queue.sql
\i supabase/migrations/20261025090000_submission_outbox.sql
\i supabase/migrations/20261026090000_outbox_reliability.sql
\i supabase/migrations/20261027090000_intake_validation_and_versioning.sql
\i supabase/migrations/20261027090001_outbox_operations.sql
\i supabase/migrations/20261027100000_outbox_schedule.sql
\i supabase/migrations/20261028090000_email_delivery_events.sql
\i supabase/migrations/20261029090000_document_ingestion.sql
\i supabase/migrations/20261029091000_census_advisor_review.sql
\i supabase/migrations/20261029092000_census_in_intake_validation.sql
\i supabase/migrations/20261103090000_intake_lifecycle.sql
\i supabase/migrations/20261103091000_intake_schema_version.sql
\i supabase/migrations/20261103100000_chosen_peo.sql
\i supabase/migrations/20261103110001_document_storage_path.sql
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
END $$;

CREATE FUNCTION pg_temp.new_user() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  RETURN uid;
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
  uid uuid := pg_temp.new_user();
  sid uuid;
  data jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}';
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
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid AND superseded_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'FAIL: choosing another PEO withdrew or added a certification';
  END IF;
  RESET ROLE;
  RAISE NOTICE 'intake_handoff: chosen PEO cases passed';
END $$;

-- ---------- a closed intake keeps its choice ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid;
  n bigint;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data, chosen_peo) VALUES (uid, '{"company_name":"Gone Co"}', 'Insperity') RETURNING id INTO sid;
  RESET ROLE;

  -- Expired as the expiry job leaves it (a privileged write).
  UPDATE public.chamber_sessions SET status = 'expired' WHERE id = sid;

  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  -- Row security matches no row for a write to a closed intake, and the lifecycle guard refuses one that gets
  -- through (EA002). Either way the choice is unchanged.
  BEGIN
    n := pg_temp.rows_changed(format('UPDATE public.chamber_sessions SET chosen_peo = %L WHERE id = %L', 'TriNet', sid));
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL: the owner changed the PEO of an expired intake'; END IF;
  EXCEPTION WHEN SQLSTATE 'EA002' THEN NULL;
  END;
  IF (SELECT chosen_peo FROM public.chamber_sessions WHERE id = sid) IS DISTINCT FROM 'Insperity' THEN
    RAISE EXCEPTION 'FAIL: an expired intake''s chosen PEO changed';
  END IF;
  RESET ROLE;
  RAISE NOTICE 'intake_handoff: closed intake cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'intake_handoff: all cases passed'; END $$;
