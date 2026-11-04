-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh needs_advisor_action
-- Needs advisor action (F-4.3, 20261104132000_needs_advisor_action.sql): an advisor raises and clears it on a
-- submission with an optional note, each change is in the status history at the current stage, the queue shows
-- it and filters on it (alone or with the status filter), it survives stage changes, the prospect never sees it,
-- and nobody else can set it. Advisors and prospects run as `authenticated` with their JWT claims.
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

-- A new intake of its own prospect (one open draft each), certified unless told not to. Runs as that prospect.
CREATE FUNCTION pg_temp.new_intake(company text, certify boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid;
  data jsonb := jsonb_build_object('company_name', company, 'states', jsonb_build_array('NY'), 'pay_frequency', 'bi-weekly');
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id INTO sid;
  IF certify THEN
    UPDATE public.chamber_sessions
    SET status = 'submitted', submission = jsonb_build_object(
      'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-11-04T12:00:00Z', 'file_id', 'EAA-2026-CLIENT',
      'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', data)
    WHERE id = sid;
  END IF;
  RESET ROLE;
  RETURN sid;
END $$;

-- Fails the run unless stmt, run as `who`, raises exactly `state`.
CREATE FUNCTION pg_temp.must_raise(who uuid, stmt text, state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE raised text := NULL;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    raised := SQLSTATE;
  END;
  RESET ROLE;
  IF raised IS NULL THEN RAISE EXCEPTION 'FAIL: % was allowed', label; END IF;
  IF raised <> state THEN RAISE EXCEPTION 'FAIL: % raised % instead of %', label, raised, state; END IF;
END $$;

CREATE FUNCTION pg_temp.flag(advisor uuid, sid uuid, raise_it boolean, note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  PERFORM public.set_submission_needs_action(sid, raise_it, note);
  RESET ROLE;
END $$;

-- The queue's session ids, as the advisor, for a needs-action filter and a status filter.
CREATE FUNCTION pg_temp.queue(advisor uuid, needs boolean, stage text DEFAULT NULL) RETURNS uuid[] LANGUAGE plpgsql AS $$
DECLARE ids uuid[];
BEGIN
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  SELECT array_agg(q.session_id ORDER BY q.session_id) INTO ids
  FROM public.advisor_list_submissions(p_status => stage, p_needs_action => needs) q;
  RESET ROLE;
  RETURN COALESCE(ids, '{}');
END $$;

DO $$
DECLARE
  advisor uuid := pg_temp.new_user();
  a uuid := pg_temp.new_intake('Alpha Co');
  b uuid := pg_temp.new_intake('Beta Co');
  draft uuid := pg_temp.new_intake('Draft Co', false);
  prospect uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = a);
  w public.submission_workflow;
  h public.submission_status_history;
  q record;
  n bigint;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');

  -- ---------- Nothing needs advisor action until an advisor says so ----------
  IF pg_temp.queue(advisor, true) <> '{}' THEN RAISE EXCEPTION 'FAIL: a new intake needed advisor action'; END IF;

  -- ---------- Raising it, with a note ----------
  PERFORM pg_temp.flag(advisor, a, true, '  Call the CFO about the payroll register  ');
  SELECT * INTO w FROM public.submission_workflow WHERE session_id = a;
  IF NOT w.needs_action OR w.needs_action_note IS DISTINCT FROM 'Call the CFO about the payroll register'
     OR w.needs_action_by IS DISTINCT FROM advisor OR w.needs_action_by_email IS DISTINCT FROM advisor || '@example.test'
     OR w.needs_action_at IS NULL OR w.status <> 'submitted' THEN
    RAISE EXCEPTION 'FAIL: raising it left %', w;
  END IF;
  SELECT * INTO h FROM public.submission_status_history WHERE session_id = a ORDER BY id DESC LIMIT 1;
  IF h.from_status <> 'submitted' OR h.to_status <> 'submitted' OR h.changed_by IS DISTINCT FROM advisor
     OR h.note IS DISTINCT FROM 'Marked as needing advisor action: Call the CFO about the payroll register' THEN
    RAISE EXCEPTION 'FAIL: raising it was recorded as %', h;
  END IF;

  -- ---------- The queue shows it and filters on it ----------
  IF pg_temp.queue(advisor, true) <> ARRAY[a] THEN RAISE EXCEPTION 'FAIL: the needs-action filter gave %', pg_temp.queue(advisor, true); END IF;
  IF cardinality(pg_temp.queue(advisor, NULL)) <> 3 THEN RAISE EXCEPTION 'FAIL: without the filter the queue lost rows'; END IF;
  IF pg_temp.queue(advisor, false) <> (SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[b, draft]) x) THEN
    RAISE EXCEPTION 'FAIL: the not-needed filter gave %', pg_temp.queue(advisor, false);
  END IF;
  -- With the status filter too: both have to match.
  IF pg_temp.queue(advisor, true, 'submitted') <> ARRAY[a] OR pg_temp.queue(advisor, true, 'draft') <> '{}' THEN
    RAISE EXCEPTION 'FAIL: the needs-action and status filters didn''t combine';
  END IF;
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  SELECT * INTO q FROM public.advisor_list_submissions(p_needs_action => true, p_limit => 25);
  IF NOT q.needs_action OR q.needs_action_note IS DISTINCT FROM 'Call the CFO about the payroll register' OR q.total_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: the queue row was %', q;
  END IF;
  SELECT * INTO q FROM public.advisor_list_submissions() WHERE session_id = b;
  IF q.needs_action OR q.needs_action_note IS NOT NULL THEN RAISE EXCEPTION 'FAIL: an unmarked row read %', q; END IF;
  RESET ROLE;

  -- ---------- Raising it again: the same note records nothing, a new note replaces it ----------
  SELECT count(*) INTO n FROM public.submission_status_history WHERE session_id = a;
  PERFORM pg_temp.flag(advisor, a, true, 'Call the CFO about the payroll register');
  IF (SELECT count(*) FROM public.submission_status_history WHERE session_id = a) <> n THEN
    RAISE EXCEPTION 'FAIL: raising it again with the same note wrote history';
  END IF;
  PERFORM pg_temp.flag(advisor, a, true, 'CFO is out; email the controller');
  IF (SELECT needs_action_note FROM public.submission_workflow WHERE session_id = a) <> 'CFO is out; email the controller'
     OR (SELECT count(*) FROM public.submission_status_history WHERE session_id = a) <> n + 1 THEN
    RAISE EXCEPTION 'FAIL: a new note didn''t replace the old one';
  END IF;

  -- ---------- It stays with the submission as the stage moves, and the prospect never hears of it ----------
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  PERFORM public.set_submission_status(a, 'under_review');
  PERFORM public.set_submission_status(a, 'ready_for_market');
  RESET ROLE;
  IF NOT (SELECT needs_action FROM public.submission_workflow WHERE session_id = a) THEN RAISE EXCEPTION 'FAIL: a stage change cleared it'; END IF;
  PERFORM pg_temp.flag(advisor, a, true, 'One more question for the broker');
  SELECT * INTO h FROM public.submission_status_history WHERE session_id = a ORDER BY id DESC LIMIT 1;
  IF h.from_status <> 'ready_for_market' OR h.to_status <> 'ready_for_market' THEN RAISE EXCEPTION 'FAIL: recorded at %', h; END IF;
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  IF public.prospect_submission_status(a) IS DISTINCT FROM 'under_review' THEN
    RAISE EXCEPTION 'FAIL: the prospect was told %', public.prospect_submission_status(a);
  END IF;
  IF EXISTS (SELECT 1 FROM public.submission_workflow) THEN RAISE EXCEPTION 'FAIL: a prospect read the pipeline'; END IF;
  RESET ROLE;

  -- ---------- Clearing it ----------
  PERFORM pg_temp.flag(advisor, a, false, 'Spoke to the controller');
  SELECT * INTO w FROM public.submission_workflow WHERE session_id = a;
  IF w.needs_action OR w.needs_action_note IS NOT NULL OR w.needs_action_by IS DISTINCT FROM advisor THEN
    RAISE EXCEPTION 'FAIL: clearing it left %', w;
  END IF;
  SELECT * INTO h FROM public.submission_status_history WHERE session_id = a ORDER BY id DESC LIMIT 1;
  IF h.note IS DISTINCT FROM 'Cleared: no longer needs advisor action: Spoke to the controller' THEN
    RAISE EXCEPTION 'FAIL: clearing it was recorded as %', h;
  END IF;
  SELECT count(*) INTO n FROM public.submission_status_history WHERE session_id = a;
  PERFORM pg_temp.flag(advisor, a, false);
  IF (SELECT count(*) FROM public.submission_status_history WHERE session_id = a) <> n THEN
    RAISE EXCEPTION 'FAIL: clearing it twice wrote history';
  END IF;
  IF pg_temp.queue(advisor, true) <> '{}' THEN RAISE EXCEPTION 'FAIL: a cleared submission stayed in the filter'; END IF;

  -- An intake not yet certified can be marked too: the team may need to chase the prospect.
  PERFORM pg_temp.flag(advisor, draft, true);
  IF pg_temp.queue(advisor, true) <> ARRAY[draft] THEN RAISE EXCEPTION 'FAIL: a draft couldn''t be marked'; END IF;
  SELECT * INTO h FROM public.submission_status_history WHERE session_id = draft ORDER BY id DESC LIMIT 1;
  IF h.note IS DISTINCT FROM 'Marked as needing advisor action' THEN RAISE EXCEPTION 'FAIL: a note-less mark was recorded as %', h; END IF;

  -- ---------- Refusals ----------
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.set_submission_needs_action(%L, NULL)', b), '22023', 'a missing answer');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.set_submission_needs_action(%L, true, %L)', b, repeat('x', 501)), '22023', 'a note over 500 characters');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.set_submission_needs_action(%L, true)', gen_random_uuid()), 'P0002', 'a missing submission');
  PERFORM pg_temp.must_raise(advisor, format('UPDATE public.submission_workflow SET needs_action = true WHERE session_id = %L', b), '42501', 'an advisor writing the pipeline directly');
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.set_submission_needs_action(%L, true)', a), '42501', 'a prospect marking a submission');
  PERFORM pg_temp.must_raise(prospect, 'SELECT count(*) FROM public.advisor_list_submissions(p_needs_action => true)', '42501', 'a prospect filtering the queue');
  IF (SELECT needs_action FROM public.submission_workflow WHERE session_id = b) THEN RAISE EXCEPTION 'FAIL: a refusal marked a submission'; END IF;

  PERFORM set_config('request.jwt.claims', '', false);
  RAISE NOTICE 'needs_advisor_action: all cases passed';
END $$;
