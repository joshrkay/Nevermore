-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh one_open_draft
-- One open draft per prospect (A-1, 20261104102000_one_open_draft.sql): a second intake from the browser is
-- refused while one is open, naming it; closing, certifying or expiring the first makes room; a certified intake
-- changed since doesn't count; other people, existing rows and privileged writes are untouched. Two
-- simultaneous inserts need two connections and are checked by hand (docs/intake-schema.md).
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
\i supabase/migrations/20261103110000_certification_readiness.sql
\i supabase/migrations/20261103110001_document_storage_path.sql
\i supabase/migrations/20261103120000_intake_schema_v2_workers_comp.sql
\i supabase/migrations/20261103120100_intake_schema_v2_version.sql
\i supabase/migrations/20261103120200_ai_extraction_events.sql
\i supabase/migrations/20261104090000_intake_consent.sql
\i supabase/migrations/20261104091000_ops_monitoring.sql
\i supabase/migrations/20261104092000_data_retention_and_deletion.sql
\i supabase/migrations/20261104093000_security_review_fixes.sql
\i supabase/migrations/20261104100000_certification_conflicts.sql
\i supabase/migrations/20261104101000_transcript_validation.sql
\i supabase/migrations/20261104102000_one_open_draft.sql
SET client_min_messages = notice;

CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
END $$;

CREATE FUNCTION pg_temp.new_prospect() RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  RESET ROLE;
  RETURN uid;
END $$;

-- Starts an intake as the signed-in prospect: its id, or 'SQLSTATE DETAIL' when refused (and then nothing was added).
CREATE FUNCTION pg_temp.start(uid uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  before bigint := (SELECT count(*) FROM public.chamber_sessions WHERE user_id = uid);
  sid uuid; s text; d text;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, '{"company_name":"Acme"}') RETURNING id INTO sid;
    RESET ROLE;
    RETURN sid::text;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, d = PG_EXCEPTION_DETAIL;
  END;
  RESET ROLE;
  IF (SELECT count(*) FROM public.chamber_sessions WHERE user_id = uid) <> before THEN RAISE EXCEPTION 'FAIL: a refused start added an intake'; END IF;
  RETURN s || ' ' || coalesce(d, '');
END $$;

DO $$
DECLARE
  a uuid := pg_temp.new_prospect();
  b uuid := pg_temp.new_prospect();
  first text; second text; r text;
  data jsonb := '{"company_name":"Acme","states":["NY"],"pay_frequency":"weekly"}';
BEGIN
  first := pg_temp.start(a);
  IF first !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'FAIL: the first intake was refused: %', first; END IF;

  -- A second is refused, naming the open one.
  r := pg_temp.start(a);
  IF r <> 'EA009 ' || first THEN RAISE EXCEPTION 'FAIL: a second open draft gave %', r; END IF;

  -- Someone else is unaffected.
  IF pg_temp.start(b) !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'FAIL: another person was refused'; END IF;

  -- Start over: archived, it no longer counts.
  PERFORM pg_temp.as_user(a);
  SET LOCAL ROLE authenticated;
  IF public.archive_chamber_session(first::uuid) <> 'archived' THEN RAISE EXCEPTION 'FAIL: archive'; END IF;
  RESET ROLE;
  second := pg_temp.start(a);
  IF second !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'FAIL: starting over was refused: %', second; END IF;

  -- Certified: no longer a draft, so a new intake can start beside it.
  PERFORM pg_temp.as_user(a);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = data, status = 'submitted',
    submission = jsonb_build_object('signer_name', 'Jo', 'signer_title', 'CEO', 'signed_at', '2026-11-04T12:00:00Z',
      'file_id', 'EAA-2026-TEST', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', data)
  WHERE id = second::uuid;
  -- Changed afterwards, it is back in progress, but still a submission, not a draft (Start over keeps it).
  UPDATE public.chamber_sessions SET chamber_data = data || '{"industry":"Print"}' WHERE id = second::uuid;
  IF (SELECT status FROM public.chamber_sessions WHERE id = second::uuid) <> 'in_progress' THEN RAISE EXCEPTION 'FAIL: the change did not withdraw it'; END IF;
  RESET ROLE;
  r := pg_temp.start(a);
  IF r !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'FAIL: a changed submission blocked a new intake: %', r; END IF;

  -- Expired: closed, so it doesn't count either.
  UPDATE public.chamber_sessions SET last_activity_at = now() - interval '40 days' WHERE id = r::uuid;
  IF public.expire_idle_intakes() <> 1 THEN RAISE EXCEPTION 'FAIL: expected one draft to expire'; END IF;
  first := pg_temp.start(a);
  IF first !~ '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'FAIL: an expired draft blocked a new intake: %', first; END IF;

  -- Privileged writes (a job, a migration, an operator) are not checked.
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (a, '{}');
  IF (SELECT count(*) FROM public.chamber_sessions WHERE user_id = a AND status = 'in_progress'
        AND NOT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = chamber_sessions.id)) <> 2 THEN
    RAISE EXCEPTION 'FAIL: a privileged insert was refused';
  END IF;
  -- With two open (from before this rule, say), the browser still can't add a third; it is told the latest.
  UPDATE public.chamber_sessions SET last_activity_at = now() + interval '1 minute' WHERE id = first::uuid;
  r := pg_temp.start(a);
  IF r <> 'EA009 ' || first THEN RAISE EXCEPTION 'FAIL: a third open draft gave %', r; END IF;

  RAISE NOTICE 'one_open_draft: all cases passed';
END $$;
