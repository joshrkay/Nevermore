-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh open_items
-- One list of open items (US-2.2a, 20261104103000_open_items.sql): the advisor queue's missing_required and
-- open_fields for each intake in supabase/tests/fixtures/open_items.json, which src/data/openItems.test.ts expects
-- of the browser's openItems too. Also: a workers' comp answer can be reviewed.
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
\i supabase/migrations/20261027090100_outbox_operations.sql
\i supabase/migrations/20261027100000_outbox_schedule.sql
\i supabase/migrations/20261028090000_email_delivery_events.sql
\i supabase/migrations/20261029090000_document_ingestion.sql
\i supabase/migrations/20261029091000_census_advisor_review.sql
\i supabase/migrations/20261029092000_census_in_intake_validation.sql
\i supabase/migrations/20261103090000_intake_lifecycle.sql
\i supabase/migrations/20261103091000_intake_schema_version.sql
\i supabase/migrations/20261103100000_chosen_peo.sql
\i supabase/migrations/20261103110000_certification_readiness.sql
\i supabase/migrations/20261103110100_document_storage_path.sql
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
\i supabase/migrations/20261104103000_open_items.sql
\set fixture `cat supabase/tests/fixtures/open_items.json`
SET client_min_messages = notice;
-- psql substitutes variables outside dollar quotes only, so the fixture goes through a table.
CREATE TEMP TABLE fx AS SELECT :'fixture'::jsonb AS doc;

DO $$
DECLARE
  advisor uuid := gen_random_uuid();
  owner uuid := gen_random_uuid();
  c jsonb;
  sid uuid;
  r record;
  n integer := 0;
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at) VALUES
    (advisor, 'authenticated', 'authenticated', 'adv@example.test', false, now(), now()),
    (owner, 'authenticated', 'authenticated', 'owner@example.test', false, now(), now());
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');

  FOR c IN SELECT value FROM fx, jsonb_array_elements(fx.doc) LOOP
    -- As a job would write it: one person can hold only one open draft from the browser.
    INSERT INTO public.chamber_sessions (user_id, chamber_data, field_provenance)
    VALUES (owner, c -> 'chamber_data', c -> 'field_provenance') RETURNING id INTO sid;

    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', advisor, 'role', 'authenticated', 'is_anonymous', false, 'email', 'adv@example.test')::text, false);
    SET LOCAL ROLE authenticated;
    SELECT * INTO r FROM public.advisor_list_submissions() WHERE session_id = sid;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', false);

    IF r.missing_required IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(c -> 'missing')) THEN
      RAISE EXCEPTION 'FAIL: %: missing_required %, expected %', c ->> 'name', r.missing_required, c -> 'missing';
    END IF;
    IF r.open_fields IS DISTINCT FROM (c ->> 'open_fields')::integer THEN
      RAISE EXCEPTION 'FAIL: %: open_fields %, expected %', c ->> 'name', r.open_fields, c ->> 'open_fields';
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'open_items: % fixture intakes agree', n;

  -- A field an advisor verified leaves the count; an unknown one stays until then.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', advisor, 'role', 'authenticated', 'is_anonymous', false, 'email', 'adv@example.test')::text, false);
  SET LOCAL ROLE authenticated;
  PERFORM public.review_submission_field(sid, 'census', 'verified');
  SELECT * INTO r FROM public.advisor_list_submissions() WHERE session_id = sid;
  IF r.open_fields <> 0 OR r.verified_fields <> 1 THEN RAISE EXCEPTION 'FAIL: a verified field still counted: %', r; END IF;
  -- Workers' comp answers can be reviewed (they couldn't before).
  PERFORM public.review_submission_field(sid, 'wc_experience_mod', 'follow_up');
  SELECT * INTO r FROM public.advisor_list_submissions() WHERE session_id = sid;
  IF r.flagged_fields <> 1 THEN RAISE EXCEPTION 'FAIL: a workers'' comp review was not recorded: %', r; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'open_items: all cases passed';
END $$;
