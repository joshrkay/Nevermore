-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh intake_milestones
-- The pilot funnel (20261105092000_intake_milestones.sql): intakes from before it are backfilled, flagged, from what
-- the database held; each intake records each step once, when it first reaches it (started, answered, a document,
-- a census, ready to certify, a verified email, certified, the Manuscript downloaded, the last from the owner's
-- browser only); rows hold no answers; deleting an intake keeps its rows without the link; the yearly prune takes a
-- whole cohort; and only advisors read the funnel, which counts each step for intakes started in a period.
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
\i supabase/migrations/20261104103000_required_items.sql
\i supabase/migrations/20261104110000_pin_reviews_and_manuscripts_to_answers.sql
\i supabase/migrations/20261104111000_pipeline_follows_the_prospect.sql
\i supabase/migrations/20261104112000_certified_evidence.sql
\i supabase/migrations/20261104113000_share_reviewed_manuscript.sql
\i supabase/migrations/20261104114000_paged_advisor_queue.sql
\i supabase/migrations/20261104115000_advisor_review_followups.sql
\i supabase/migrations/20261104116000_intake_deletion_removes_document_history.sql
\i supabase/migrations/20261104117000_certification_snapshots.sql
\i supabase/migrations/20261104117100_alert_headcount_census.sql
\i supabase/migrations/20261104118000_open_items.sql
\i supabase/migrations/20261104120000_submission_records.sql
\i supabase/migrations/20261104121000_voice_failed_ops_kind.sql
\i supabase/migrations/20261104122000_pipeline_transitions.sql
\i supabase/migrations/20261104130000_document_scanning.sql
\i supabase/migrations/20261104131000_certification_file_id_check.sql
\i supabase/migrations/20261104132000_needs_advisor_action.sql
\i supabase/migrations/20261104133000_queue_hides_empty_guest_drafts.sql
\i supabase/migrations/20261105090000_information_requests.sql
\i supabase/migrations/20261105091000_draft_expiry_reminders.sql
SET client_min_messages = notice;

CREATE FUNCTION pg_temp.as_user(uid uuid, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated', 'email', CASE WHEN guest THEN '' ELSE uid || '@example.test' END)::text, false);
END $$;

CREATE FUNCTION pg_temp.new_user(guest boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', CASE WHEN guest THEN NULL ELSE uid || '@example.test' END, guest, now(), now());
  RETURN uid;
END $$;

-- A new intake of `owner`, holding `data`, written as the owner.
CREATE FUNCTION pg_temp.new_intake(owner uuid, data jsonb, guest boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_user(owner, guest);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (owner, data) RETURNING id INTO sid;
  RESET ROLE;
  RETURN sid;
END $$;

CREATE FUNCTION pg_temp.certify(owner uuid, sid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user(owner);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-04T12:00:00Z',
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', chamber_data)
  WHERE id = sid;
  RESET ROLE;
END $$;

-- ---------- Before the migration: what is there to backfill ----------
CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid);
DO $$
DECLARE
  owner uuid := pg_temp.new_user(false);
  guest uuid := pg_temp.new_user(true);
  old_cert uuid;
  old_guest uuid;
BEGIN
  old_cert := pg_temp.new_intake(owner, '{"company_name":"Old Co","states":["NY"],"pay_frequency":"weekly","census":[{"first_name":"A","work_state":"NY"}]}');
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  VALUES (owner, old_cert, 'census.xlsx', '12 KB', owner || '/' || old_cert || '/census.xlsx', 'employee_census');
  PERFORM pg_temp.certify(owner, old_cert);
  old_guest := pg_temp.new_intake(guest, '{}', true);
  INSERT INTO fx VALUES ('owner', owner), ('guest', guest), ('old_cert', old_cert), ('old_guest', old_guest);
END $$;

\i supabase/migrations/20261105092000_intake_milestones.sql

CREATE FUNCTION pg_temp.reached(sid uuid) RETURNS text[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(milestone ORDER BY milestone), '{}') FROM public.intake_milestones WHERE session_id = sid;
$$;

DO $$
DECLARE
  owner uuid := (SELECT id FROM fx WHERE name = 'owner');
  old_cert uuid := (SELECT id FROM fx WHERE name = 'old_cert');
  old_guest uuid := (SELECT id FROM fx WHERE name = 'old_guest');
  guest uuid := pg_temp.new_user(true);
  stranger uuid := pg_temp.new_user(false);
  advisor uuid := pg_temp.new_user(false);
  sid uuid;
  draft uuid;
  f record;
  n integer;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');

  -- ---------- The backfill ----------
  IF pg_temp.reached(old_cert) <> ARRAY['answered', 'census_provided', 'certified', 'document_uploaded', 'email_verified', 'ready_to_certify', 'started'] THEN
    RAISE EXCEPTION 'FAIL: the certified intake was backfilled with %', pg_temp.reached(old_cert);
  END IF;
  IF pg_temp.reached(old_guest) <> ARRAY['started'] THEN
    RAISE EXCEPTION 'FAIL: the empty guest draft was backfilled with %', pg_temp.reached(old_guest);
  END IF;
  IF EXISTS (SELECT 1 FROM public.intake_milestones WHERE NOT backfilled OR reached_at < started_at) THEN
    RAISE EXCEPTION 'FAIL: a backfilled row isn''t flagged, or was reached before its intake started';
  END IF;

  -- ---------- A guest's intake, step by step ----------
  sid := pg_temp.new_intake(guest, '{}', true);
  IF pg_temp.reached(sid) <> ARRAY['started'] THEN RAISE EXCEPTION 'FAIL: a new empty intake reached %', pg_temp.reached(sid); END IF;
  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Acme"}' WHERE id = sid;
  RESET ROLE;
  IF pg_temp.reached(sid) <> ARRAY['answered', 'started'] THEN RAISE EXCEPTION 'FAIL: a first answer reached %', pg_temp.reached(sid); END IF;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  VALUES (guest, sid, 'payroll.pdf', '12 KB', guest || '/' || sid || '/payroll.pdf', 'payroll_report');
  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Acme","states":["CA"],"pay_frequency":"weekly"}' WHERE id = sid;
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"census":[{"first_name":"A","work_state":"CA"}]}' WHERE id = sid;
  RESET ROLE;
  IF pg_temp.reached(sid) <> ARRAY['answered', 'census_provided', 'document_uploaded', 'ready_to_certify', 'started'] THEN
    RAISE EXCEPTION 'FAIL: the guest''s intake reached %', pg_temp.reached(sid);
  END IF;
  -- Each step once: saving again records nothing new.
  SELECT count(*) INTO n FROM public.intake_milestones WHERE session_id = sid;
  PERFORM pg_temp.as_user(guest, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"industry":"Retail"}' WHERE id = sid;
  RESET ROLE;
  IF (SELECT count(*) FROM public.intake_milestones WHERE session_id = sid) <> n THEN RAISE EXCEPTION 'FAIL: a step was recorded twice'; END IF;

  -- Verifying an email upgrades the guest in place: the intake has reached that step.
  UPDATE auth.users SET is_anonymous = false, email = guest || '@example.test' WHERE id = guest;
  IF NOT 'email_verified' = ANY (pg_temp.reached(sid)) THEN RAISE EXCEPTION 'FAIL: verifying an email wasn''t recorded'; END IF;

  -- Certifying.
  PERFORM pg_temp.certify(guest, sid);
  IF NOT 'certified' = ANY (pg_temp.reached(sid)) THEN RAISE EXCEPTION 'FAIL: certifying wasn''t recorded'; END IF;

  -- ---------- The Manuscript download: the owner's own certified intake only, once ----------
  PERFORM pg_temp.as_user(stranger);
  SET LOCAL ROLE authenticated;
  IF public.record_manuscript_download(sid) THEN RAISE EXCEPTION 'FAIL: someone else recorded a download'; END IF;
  RESET ROLE;
  PERFORM pg_temp.as_user(guest);
  SET LOCAL ROLE authenticated;
  IF NOT public.record_manuscript_download(sid) THEN RAISE EXCEPTION 'FAIL: the owner''s download wasn''t recorded'; END IF;
  IF public.record_manuscript_download(sid) THEN RAISE EXCEPTION 'FAIL: a second download was recorded again'; END IF;
  RESET ROLE;
  draft := pg_temp.new_intake(stranger, '{"company_name":"Draft Co"}');
  PERFORM pg_temp.as_user(stranger);
  SET LOCAL ROLE authenticated;
  IF public.record_manuscript_download(draft) THEN RAISE EXCEPTION 'FAIL: a download of a draft was recorded'; END IF;
  -- Prospects never read the record itself.
  BEGIN
    PERFORM count(*) FROM public.intake_milestones;
    RAISE EXCEPTION 'FAIL: a prospect read the milestones';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.record_manuscript_download(sid);
    RAISE EXCEPTION 'FAIL: a signed-out caller could record a download';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  -- Nothing about the prospect is kept: a row is ids, a step and times.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'intake_milestones'
      AND column_name NOT IN ('id', 'session_id', 'started_at', 'milestone', 'reached_at', 'backfilled')
  ) THEN
    RAISE EXCEPTION 'FAIL: intake_milestones holds more than ids, steps and times';
  END IF;

  -- ---------- The funnel ----------
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  SELECT string_agg(format('%s:%s', x.milestone, x.intakes), ' ' ORDER BY x.step) INTO f
  FROM public.advisor_intake_funnel(now() - interval '1 day', now() + interval '1 day') x;
  IF f.string_agg <> 'started:4 answered:3 document_uploaded:2 census_provided:2 ready_to_certify:2 email_verified:3 certified:2 manuscript_downloaded:1' THEN
    RAISE EXCEPTION 'FAIL: the funnel was %', f.string_agg;
  END IF;
  -- Medians come from recorded times only: the backfilled intakes don't count towards them.
  IF (SELECT median_minutes FROM public.advisor_intake_funnel(now() - interval '1 day', now() + interval '1 day') WHERE milestone = 'manuscript_downloaded') IS NULL THEN
    RAISE EXCEPTION 'FAIL: a recorded step had no median';
  END IF;
  -- An empty period still lists every step, at zero.
  IF (SELECT count(*) FROM public.advisor_intake_funnel(now() - interval '30 days', now() - interval '20 days') WHERE intakes = 0) <> 8 THEN
    RAISE EXCEPTION 'FAIL: an empty period didn''t list every step at zero';
  END IF;
  BEGIN
    PERFORM public.advisor_intake_funnel(now(), now() - interval '1 day');
    RAISE EXCEPTION 'FAIL: a backwards period was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.advisor_intake_funnel(now() - interval '400 days', now());
    RAISE EXCEPTION 'FAIL: a period over a year was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RESET ROLE;
  PERFORM pg_temp.as_user(stranger);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.advisor_intake_funnel(now() - interval '1 day', now());
    RAISE EXCEPTION 'FAIL: a prospect read the funnel';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  -- ---------- Deleting an intake keeps how far it got, without the link ----------
  DELETE FROM public.chamber_sessions WHERE id = draft;
  IF EXISTS (SELECT 1 FROM public.intake_milestones WHERE session_id = draft) THEN RAISE EXCEPTION 'FAIL: a deleted intake''s rows kept its id'; END IF;
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  IF (SELECT intakes FROM public.advisor_intake_funnel(now() - interval '1 day', now() + interval '1 day') WHERE milestone = 'started') <> 4 THEN
    RAISE EXCEPTION 'FAIL: the funnel lost a deleted intake';
  END IF;
  RESET ROLE;

  -- ---------- The yearly prune takes a whole cohort ----------
  INSERT INTO public.intake_milestones (session_id, started_at, milestone, reached_at)
  VALUES (NULL, now() - interval '400 days', 'started', now() - interval '400 days'),
         (NULL, now() - interval '400 days', 'certified', now() - interval '300 days');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, false);
  SET LOCAL ROLE service_role;
  IF (public.run_retention() ->> 'intake_milestones_pruned')::int <> 2 THEN RAISE EXCEPTION 'FAIL: the old cohort wasn''t pruned whole'; END IF;
  RESET ROLE;
  IF (SELECT count(*) FROM public.intake_milestones WHERE started_at < now() - interval '365 days') <> 0 THEN
    RAISE EXCEPTION 'FAIL: rows older than a year were kept';
  END IF;

  RAISE NOTICE 'intake_milestones: all cases passed';
END $$;
