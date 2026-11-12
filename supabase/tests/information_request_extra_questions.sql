-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh information_request_extra_questions
-- An advisor's information request can name a PEO's own extra questions (joshrkay/Nevermore#91, L-2.3,
-- 20261115130000_information_request_extra_questions.sql): each by its PEO, its key and its wording, which must be a
-- question of that PEO's profile in use, as worded. The prospect reads them with the request. The email never carries
-- them: it names no PEO.
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
\i supabase/migrations/20261105092000_intake_milestones.sql
\i supabase/migrations/20261106090000_hardening.sql
\i supabase/migrations/20261106100000_intake_sources.sql
\i supabase/migrations/20261107090000_intake_consent_v2.sql
\i supabase/migrations/20261109090000_packet_error_messages.sql
\i supabase/migrations/20261110090000_quote_requests.sql
\i supabase/migrations/20261115090000_peo_requirement_profiles.sql
\i supabase/migrations/20261115100000_peo_profile_editor.sql
\i supabase/migrations/20261115110000_peo_industry_class_codes.sql
\i supabase/migrations/20261115120000_extra_answers.sql
\i supabase/migrations/20261115130000_information_request_extra_questions.sql
SET client_min_messages = notice;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', false, 'role', 'authenticated', 'email', uid || '@example.test')::text, false);
END $$;

CREATE FUNCTION pg_temp.new_user(role text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', uid || '@example.test', false, now(), now());
  IF role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, role::public.app_role);
  END IF;
  RETURN uid;
END $$;

-- Runs stmt as `who` and returns its single value as jsonb.
CREATE FUNCTION pg_temp.run(who uuid, stmt text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  EXECUTE stmt INTO result;
  RESET ROLE;
  RETURN result;
END $$;

-- Runs stmt as `who`: 'ok', or the SQLSTATE and DETAIL it was refused with.
CREATE FUNCTION pg_temp.try(who uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; d text;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE stmt;
    RESET ROLE;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, d = PG_EXCEPTION_DETAIL;
  END;
  RESET ROLE;
  RETURN s || ' ' || coalesce(d, '');
END $$;

-- A new intake of uid's holding the answers certifying needs.
CREATE FUNCTION pg_temp.new_intake(uid uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data)
  VALUES (uid, '{"company_name":"Acme","states":["NY"],"pay_frequency":"bi-weekly"}') RETURNING id INTO sid;
  RESET ROLE;
  RETURN sid;
END $$;

-- Certifies sid as its owner, over the answers it holds.
CREATE FUNCTION pg_temp.certify(uid uuid, sid uuid, signed_at text DEFAULT '2026-11-13T12:00:00Z') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.try(uid, format($f$
    UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
      'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', %L, 'consent_version', '2026-10-draft-1',
      'consent_text', '["I certify."]'::jsonb, 'chamber_data', chamber_data) WHERE id = %L$f$, signed_at, sid));
$$;

CREATE FUNCTION pg_temp.peo(name text) RETURNS bigint LANGUAGE sql AS $$
  SELECT id FROM public.peos WHERE peos.name = peo.name;
$$;

CREATE FUNCTION pg_temp.request(who uuid, sid uuid, questions jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.try(who, format('SELECT public.advisor_request_information(%L, %L, %L, %L)', sid, 'A few more things, please.', '{hris_system}', questions));
$$;

DO $$
DECLARE
  admin uuid := pg_temp.new_user('admin');
  advisor uuid := pg_temp.new_user('advisor');
  uid uuid := pg_temp.new_user();
  sid uuid := pg_temp.new_intake(uid);
  trinet bigint := pg_temp.peo('TriNet');
  justworks bigint := pg_temp.peo('Justworks');
  guide jsonb := '{"kind":"document","name":"Broker guide 2026","checked_on":"2026-11-01"}';
  drives jsonb;
  req public.information_requests;
  seen jsonb;
  outcome text;
  c record;
BEGIN
  -- TriNet's profile in use asks two questions of its own; Justworks has none.
  PERFORM pg_temp.run(admin, format('SELECT public.admin_save_peo_profile(%s, %L, %L, %L)', trinet, jsonb_build_object(
    'extra_questions', '[{"key":"vehicles","text":"Do employees drive for work?","kind":"yes_no"},{"key":"fleet","text":"How many company vehicles?","kind":"number"}]'::jsonb,
    'sources', jsonb_build_object('extra_questions', guide)),
    (SELECT revision FROM public.peo_profile_versions WHERE peo_id = trinet AND status = 'draft'),
    (SELECT max(version) FROM public.peo_profile_versions WHERE peo_id = trinet AND status = 'published')));
  PERFORM pg_temp.run(admin, format('SELECT public.admin_publish_peo_profile(%s, %L)', trinet,
    (SELECT revision FROM public.peo_profile_versions WHERE peo_id = trinet AND status = 'draft')));
  IF pg_temp.certify(uid, sid) <> 'ok' THEN RAISE EXCEPTION 'FAIL: setup could not certify'; END IF;

  drives := jsonb_build_array(jsonb_build_object('peo_id', trinet, 'key', 'vehicles', 'question', 'Do employees drive for work?'));
  FOR c IN SELECT * FROM (VALUES
    ('not a list', '{}'::jsonb),
    ('a question with no PEO', '[{"key":"vehicles","question":"Do employees drive for work?"}]'::jsonb),
    ('a PEO that isn''t there', '[{"peo_id":999999,"key":"vehicles","question":"Do employees drive for work?"}]'::jsonb),
    ('a key its profile doesn''t ask', jsonb_build_array(jsonb_build_object('peo_id', trinet, 'key', 'union', 'question', 'Do employees drive for work?'))),
    ('other wording than its profile asks', jsonb_build_array(jsonb_build_object('peo_id', trinet, 'key', 'vehicles', 'question', 'Do any staff drive?'))),
    ('another PEO''s question', jsonb_build_array(jsonb_build_object('peo_id', justworks, 'key', 'vehicles', 'question', 'Do employees drive for work?'))),
    ('the same question twice', drives || drives),
    ('something else beside the question', jsonb_build_array(jsonb_build_object('peo_id', trinet, 'key', 'vehicles', 'question', 'Do employees drive for work?', 'answer', true)))
  ) AS t(label, questions) LOOP
    outcome := pg_temp.request(advisor, sid, c.questions);
    IF outcome NOT LIKE '22023%' THEN RAISE EXCEPTION 'FAIL: % gave %', c.label, outcome; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.information_requests WHERE session_id = sid) THEN RAISE EXCEPTION 'FAIL: a refused request was recorded'; END IF;

  -- A PEO taken off the list isn't asked about.
  PERFORM pg_temp.run(admin, format('SELECT public.admin_set_peo_listed(%s, false)', trinet));
  outcome := pg_temp.request(advisor, sid, drives);
  IF outcome NOT LIKE '22023%' THEN RAISE EXCEPTION 'FAIL: a PEO not listed gave %', outcome; END IF;
  PERFORM pg_temp.run(admin, format('SELECT public.admin_set_peo_listed(%s, true)', trinet));

  -- A prospect can't ask.
  IF pg_temp.request(uid, sid, drives) NOT LIKE '42501%' THEN RAISE EXCEPTION 'FAIL: the prospect sent a request'; END IF;

  outcome := pg_temp.request(advisor, sid, drives);
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: asking about TriNet''s question gave %', outcome; END IF;
  SELECT * INTO req FROM public.information_requests WHERE session_id = sid;
  IF req.extra_questions <> drives OR req.fields <> '{hris_system}' THEN RAISE EXCEPTION 'FAIL: the request holds % / %', req.extra_questions, req.fields; END IF;

  -- The prospect reads the questions with the request.
  seen := pg_temp.run(uid, format('SELECT public.prospect_information_request(%L)', sid));
  IF seen -> 'extra_questions' IS DISTINCT FROM drives OR seen -> 'fields' <> '["hris_system"]' THEN RAISE EXCEPTION 'FAIL: the prospect reads %', seen; END IF;

  -- The email carries no PEO and no question.
  IF (SELECT payload::text FROM public.outbox_events WHERE session_id = sid AND kind = 'information_request') ~ '(TriNet|vehicles|drive)' THEN
    RAISE EXCEPTION 'FAIL: the email names the PEO or its question';
  END IF;

  -- A request naming none, as before, still works and holds none.
  outcome := pg_temp.try(advisor, format('SELECT public.advisor_request_information(%L, %L, %L)', sid, 'One more thing.', '{}'));
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: a request with no questions gave %', outcome; END IF;
  IF (SELECT extra_questions FROM public.information_requests WHERE session_id = sid ORDER BY id DESC LIMIT 1) <> '[]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: a request with no questions holds some';
  END IF;
  RAISE NOTICE 'information_request_extra_questions: all cases passed';
END $$;

-- The message a request is refused with, or 'ok'.
CREATE FUNCTION pg_temp.refusal(who uuid, sid uuid, questions jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE m text;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.advisor_request_information(sid, 'A few more things, please.', '{}', questions);
    RESET ROLE;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS m = MESSAGE_TEXT;
  END;
  RESET ROLE;
  RETURN m;
END $$;

-- ---------- at most 60 questions, each once, the PEO compared as a number ----------
DO $$
DECLARE
  advisor uuid := pg_temp.new_user('advisor');
  uid uuid := pg_temp.new_user();
  sid uuid := pg_temp.new_intake(uid);
  trinet bigint := pg_temp.peo('TriNet');
  drives jsonb;
  outcome text;
BEGIN
  IF pg_temp.certify(uid, sid) <> 'ok' THEN RAISE EXCEPTION 'FAIL: setup could not certify'; END IF;
  drives := jsonb_build_object('peo_id', trinet, 'key', 'vehicles', 'question', 'Do employees drive for work?');

  -- 60 is within the cap (refused only for naming one question 60 times); 61 is past it.
  outcome := pg_temp.refusal(advisor, sid, (SELECT jsonb_agg(drives) FROM generate_series(1, 60)));
  IF outcome <> 'A request names each question once' THEN RAISE EXCEPTION 'FAIL: 60 questions gave %', outcome; END IF;
  outcome := pg_temp.refusal(advisor, sid, (SELECT jsonb_agg(drives) FROM generate_series(1, 61)));
  IF outcome <> 'A request can name at most 60 of the PEOs'' own questions' THEN RAISE EXCEPTION 'FAIL: 61 questions gave %', outcome; END IF;

  -- The same PEO written as 5 and as 5.0 is the same question twice.
  outcome := pg_temp.refusal(advisor, sid, jsonb_build_array(drives, drives || jsonb_build_object('peo_id', (trinet::text || '.0')::numeric)));
  IF outcome <> 'A request names each question once' THEN RAISE EXCEPTION 'FAIL: one PEO as % and %.0 gave %', trinet, trinet, outcome; END IF;

  -- The table holds no more than 60 either, whoever writes it.
  BEGIN
    INSERT INTO public.information_requests (session_id, message, fields, extra_questions)
    VALUES (sid, 'Too many', '{}', (SELECT jsonb_agg(drives) FROM generate_series(1, 61)));
    RAISE EXCEPTION 'FAIL: the table took 61 questions';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO public.information_requests (session_id, message, fields, extra_questions)
  VALUES (sid, 'As many as can be', '{}', (SELECT jsonb_agg(drives) FROM generate_series(1, 60)));
  RAISE NOTICE 'information_request_extra_questions: at most 60, each once';
END $$;
