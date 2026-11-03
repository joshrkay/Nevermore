-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh certification_readiness
-- Certification readiness (US-1.2, 20261103110000_certification_readiness.sql): which answers count as
-- missing, that the prospect can't certify while any are, that the refusal names them and changes nothing,
-- and that other saves, existing certifications and privileged writes are untouched. Everything a prospect
-- does runs as `authenticated` with their JWT claims, so row security is on.
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
\i supabase/migrations/20261027090000_outbox_operations.sql
\i supabase/migrations/20261027100000_outbox_schedule.sql
\i supabase/migrations/20261028090000_email_delivery_events.sql
\i supabase/migrations/20261029090000_document_ingestion.sql
\i supabase/migrations/20261029091000_census_advisor_review.sql
\i supabase/migrations/20261029092000_census_in_intake_validation.sql
\i supabase/migrations/20261103090000_intake_lifecycle.sql
\i supabase/migrations/20261103091000_intake_schema_version.sql
\i supabase/migrations/20261103100000_chosen_peo.sql
\i supabase/migrations/20261103110000_certification_readiness.sql
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

-- A certification of `data`, as the Reckoning sends it.
CREATE FUNCTION pg_temp.certification(data jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z', 'file_id', 'EAA-2026-TEST',
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', data)
$$;

-- Certifies sid over `data` as the signed-in owner. Returns 'ok', or the SQLSTATE and DETAIL it was refused with.
-- A refusal must leave the row and the certifications exactly as they were.
CREATE FUNCTION pg_temp.certify(sid uuid, data jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  before_row jsonb := pg_temp.snap(sid);
  certs bigint := (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid);
  s text; d text;
BEGIN
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', chamber_data = data, submission = pg_temp.certification(data) WHERE id = sid;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, d = PG_EXCEPTION_DETAIL;
  END;
  IF pg_temp.snap(sid) IS DISTINCT FROM before_row THEN RAISE EXCEPTION 'FAIL: a refused certification changed the row'; END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid) <> certs THEN
    RAISE EXCEPTION 'FAIL: a refused certification was recorded';
  END IF;
  RETURN s || ' ' || coalesce(d, '');
END $$;

-- ---------- which answers count as missing ----------
DO $$
DECLARE
  cases jsonb[] := ARRAY[
    '{}', '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}',
    '{"company_name":"   ","states":["NY"],"pay_frequency":"bi-weekly"}',
    '{"company_name":"Acme","states":[],"pay_frequency":"bi-weekly"}',
    '{"company_name":"Acme","states":["  "],"pay_frequency":"bi-weekly"}',
    '{"company_name":"Acme","states":[],"census":[{"first_name":"Ada","work_state":"CA"}],"pay_frequency":"weekly"}',
    '{"company_name":"Acme","states":[],"census":[{"first_name":"Ada","work_state":""}],"pay_frequency":"weekly"}',
    '{"company_name":"Acme","employees":[{"first_name":"Ada","state":"TX"}],"pay_frequency":"weekly"}',
    '{"company_name":"Acme","states":["NY"],"pay_frequency":""}',
    '{"company_name":"Acme","states":["NY"],"pay_frequency":null}',
    '[]', 'null', '"text"'
  ]::jsonb[];
  expected text[] := ARRAY[
    '{company_name,states,pay_frequency}', '{}',
    '{company_name}',
    '{states}',
    '{states}',
    '{}',
    '{states}',
    '{}',
    '{pay_frequency}',
    '{pay_frequency}',
    '{company_name,states,pay_frequency}', '{company_name,states,pay_frequency}', '{company_name,states,pay_frequency}'
  ];
  got text[];
BEGIN
  FOR i IN 1 .. array_length(cases, 1) LOOP
    got := public.intake_missing_required(cases[i]);
    IF got IS DISTINCT FROM expected[i]::text[] THEN
      RAISE EXCEPTION 'FAIL: intake_missing_required(%) = %, expected %', cases[i], got, expected[i];
    END IF;
  END LOOP;
  RAISE NOTICE 'certification_readiness: % missing-answer cases passed', array_length(cases, 1);
END $$;

-- ---------- the prospect can't certify until the answers are there ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid;
  complete jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}';
  outcome text;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, '{"company_name":"Acme"}') RETURNING id INTO sid;

  -- Ordinary saves of an unready intake are fine: only certifying is checked.
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Acme","states":["NY"]}' WHERE id = sid;

  outcome := pg_temp.certify(sid, '{"company_name":"Acme","states":["NY"]}');
  IF outcome <> 'EA003 pay_frequency' THEN RAISE EXCEPTION 'FAIL: certifying without a pay frequency gave %', outcome; END IF;
  outcome := pg_temp.certify(sid, '{}');
  IF outcome <> 'EA003 company_name,states,pay_frequency' THEN RAISE EXCEPTION 'FAIL: certifying an empty intake gave %', outcome; END IF;

  outcome := pg_temp.certify(sid, complete);
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: a complete intake could not be certified: %', outcome; END IF;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'submitted' THEN RAISE EXCEPTION 'FAIL: not submitted'; END IF;

  -- Certifying again over the same answers with a new signature goes through too.
  UPDATE public.chamber_sessions SET submission = pg_temp.certification(complete) || '{"signed_at":"2026-11-02T09:00:00Z"}' WHERE id = sid;

  -- Removing a required answer later withdraws the certification (an ordinary save), and certifying that is refused.
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Acme","states":["NY"]}' WHERE id = sid;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'in_progress' THEN RAISE EXCEPTION 'FAIL: the edit did not withdraw the certification'; END IF;
  outcome := pg_temp.certify(sid, '{"company_name":"Acme","states":["NY"]}');
  IF outcome <> 'EA003 pay_frequency' THEN RAISE EXCEPTION 'FAIL: re-certifying without a pay frequency gave %', outcome; END IF;
  RESET ROLE;
  RAISE NOTICE 'certification_readiness: prospect cases passed';
END $$;

-- ---------- what isn't checked ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid;
  thin jsonb := '{"company_name":"Thin Co"}';
BEGIN
  -- A guest is refused as a guest, not for missing answers.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'is_anonymous', true, 'role', 'authenticated')::text, false);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, thin) RETURNING id INTO sid;
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', submission = pg_temp.certification(thin) WHERE id = sid;
    RAISE EXCEPTION 'FAIL: a guest certified';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  -- Privileged writes (a job, a migration, an operator) are not checked.
  PERFORM set_config('request.jwt.claims', '', false);
  UPDATE public.chamber_sessions SET status = 'submitted', submission = pg_temp.certification(thin) WHERE id = sid;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'submitted' THEN RAISE EXCEPTION 'FAIL: a privileged certification was refused'; END IF;
  RAISE NOTICE 'certification_readiness: unchecked cases passed';
END $$;

DO $$ BEGIN RAISE NOTICE 'certification_readiness: all cases passed'; END $$;
