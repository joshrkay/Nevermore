-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh extra_answers
-- The answers to a PEO's own extra questions (joshrkay/Nevermore#91, L-2.3, 20261113090000_extra_answers.sql): kept
-- with the intake beside its answers, each with the question's wording as it was answered and its field status and
-- source; refused when malformed; certified with the rest (the submission and the certification record keep a copy),
-- and changing one after certifying withdraws the certification like any other answer. The prospect reads their own,
-- advisors read them all.
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
\i supabase/migrations/20261111090000_peo_requirement_profiles.sql
\i supabase/migrations/20261111100000_peo_profile_editor.sql
\i supabase/migrations/20261112090000_peo_industry_class_codes.sql
\i supabase/migrations/20261113090000_extra_answers.sql
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

CREATE FUNCTION pg_temp.save(uid uuid, sid uuid, answers jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.try(uid, format('UPDATE public.chamber_sessions SET extra_answers = %L WHERE id = %L', answers, sid));
$$;

-- An answer to one extra question, as the browser stores it: the wording answered, how it is answered, the value,
-- and its field status and source.
CREATE FUNCTION pg_temp.answer(question text, kind text, value jsonb, status text DEFAULT 'confirmed') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('question', question, 'kind', kind, 'status', status,
    'source', '{"kind":"prospect_edit"}'::jsonb, 'updated_at', '2026-11-13T10:00:00Z')
    || CASE WHEN value IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('value', value) END;
$$;

-- ---------- kept with the intake; the prospect reads their own, advisors all ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  other uuid := pg_temp.new_user();
  advisor uuid := pg_temp.new_user('advisor');
  sid uuid := pg_temp.new_intake(uid);
  answers jsonb := jsonb_build_object('3', jsonb_build_object(
    'vehicles', pg_temp.answer('Do employees drive for work?', 'yes_no', 'true'),
    'fleet_size', pg_temp.answer('How many company vehicles?', 'number', '4', 'inferred'),
    'union', pg_temp.answer('Which union, if any?', 'choice', '"None"'),
    'notes', pg_temp.answer('Anything else we should know?', 'text', NULL, 'unknown')));
  outcome text;
BEGIN
  IF (SELECT extra_answers FROM public.chamber_sessions WHERE id = sid) <> '{}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: a new intake holds extra answers';
  END IF;
  outcome := pg_temp.save(uid, sid, answers);
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: saving extra answers gave %', outcome; END IF;
  IF pg_temp.run(uid, format('SELECT extra_answers FROM public.chamber_sessions WHERE id = %L', sid)) <> answers THEN
    RAISE EXCEPTION 'FAIL: the prospect reads back something else';
  END IF;
  IF pg_temp.run(advisor, format('SELECT extra_answers FROM public.chamber_sessions WHERE id = %L', sid)) <> answers THEN
    RAISE EXCEPTION 'FAIL: an advisor can''t read the extra answers';
  END IF;
  IF pg_temp.run(other, format('SELECT extra_answers FROM public.chamber_sessions WHERE id = %L', sid)) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: another prospect reads them';
  END IF;
  -- An advisor never writes them.
  PERFORM pg_temp.try(advisor, format('UPDATE public.chamber_sessions SET extra_answers = ''{}'' WHERE id = %L', sid));
  IF (SELECT extra_answers FROM public.chamber_sessions WHERE id = sid) <> answers THEN
    RAISE EXCEPTION 'FAIL: an advisor changed the extra answers';
  END IF;
  RAISE NOTICE 'extra_answers: kept with the intake, read by its owner and advisors only';
END $$;

-- ---------- what is refused ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid := pg_temp.new_intake(uid);
  ok jsonb := pg_temp.answer('Do employees drive for work?', 'yes_no', 'true');
  c record;
  outcome text;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('not an object', '[]'::jsonb, 'extra_answers'),
    ('a PEO named, not numbered', jsonb_build_object('TriNet', jsonb_build_object('vehicles', ok)), 'extra_answers.TriNet'),
    ('a PEO''s answers that aren''t an object', '{"3": []}'::jsonb, 'extra_answers.3'),
    ('a key the profile couldn''t hold', jsonb_build_object('3', jsonb_build_object('Vehicles!', ok)), 'extra_answers.3.Vehicles!'),
    ('no wording', jsonb_build_object('3', jsonb_build_object('vehicles', ok - 'question')), 'extra_answers.3.vehicles'),
    ('blank wording', jsonb_build_object('3', jsonb_build_object('vehicles', ok || '{"question":"  "}')), 'extra_answers.3.vehicles'),
    ('wording longer than a question can be', jsonb_build_object('3', jsonb_build_object('vehicles', ok || jsonb_build_object('question', repeat('x', 501)))), 'extra_answers.3.vehicles'),
    ('a kind no question has', jsonb_build_object('3', jsonb_build_object('vehicles', ok || '{"kind":"date"}')), 'extra_answers.3.vehicles'),
    ('an unknown status', jsonb_build_object('3', jsonb_build_object('vehicles', ok || '{"status":"great"}')), 'extra_answers.3.vehicles'),
    ('a source the browser wouldn''t keep', jsonb_build_object('3', jsonb_build_object('vehicles', ok || '{"source":{"kind":"transcript"}}')), 'extra_answers.3.vehicles'),
    ('something else beside the answer', jsonb_build_object('3', jsonb_build_object('vehicles', ok || '{"peo":"TriNet"}')), 'extra_answers.3.vehicles'),
    ('a confirmed answer with no value', jsonb_build_object('3', jsonb_build_object('vehicles', ok - 'value')), 'extra_answers.3.vehicles'),
    ('a value marked unknown', jsonb_build_object('3', jsonb_build_object('vehicles', ok || '{"status":"unknown"}')), 'extra_answers.3.vehicles'),
    ('text for a yes or no', jsonb_build_object('3', jsonb_build_object('vehicles', ok || '{"value":"yes"}')), 'extra_answers.3.vehicles'),
    ('a number as text', jsonb_build_object('3', jsonb_build_object('n', pg_temp.answer('How many?', 'number', '"4"'))), 'extra_answers.3.n'),
    ('a number too large', jsonb_build_object('3', jsonb_build_object('n', pg_temp.answer('How many?', 'number', '1000000000001'))), 'extra_answers.3.n'),
    ('blank text', jsonb_build_object('3', jsonb_build_object('t', pg_temp.answer('Why?', 'text', '" "'))), 'extra_answers.3.t'),
    ('text longer than an answer can be', jsonb_build_object('3', jsonb_build_object('t', pg_temp.answer('Why?', 'text', to_jsonb(repeat('x', 1001))))), 'extra_answers.3.t'),
    ('a choice longer than a choice can be', jsonb_build_object('3', jsonb_build_object('c', pg_temp.answer('Which?', 'choice', to_jsonb(repeat('x', 101))))), 'extra_answers.3.c'),
    ('a competing value of the wrong kind', jsonb_build_object('3', jsonb_build_object('vehicles', ok || '{"status":"conflicting","candidates":[{"value":"maybe","source":{"kind":"prospect_edit"}}]}')), 'extra_answers.3.vehicles')
  ) AS t(label, answers, path) LOOP
    outcome := pg_temp.save(uid, sid, c.answers);
    IF outcome <> 'EA001 ' || c.path THEN RAISE EXCEPTION 'FAIL: % gave %', c.label, outcome; END IF;
  END LOOP;

  -- Caps: at most 50 PEOs, and 100 answers for one PEO.
  outcome := pg_temp.save(uid, sid, (SELECT jsonb_object_agg(i::text, jsonb_build_object('vehicles', ok)) FROM generate_series(1, 51) i));
  IF outcome <> 'EA001 extra_answers' THEN RAISE EXCEPTION 'FAIL: 51 PEOs gave %', outcome; END IF;
  outcome := pg_temp.save(uid, sid, jsonb_build_object('3', (SELECT jsonb_object_agg('q' || i, ok) FROM generate_series(1, 101) i)));
  IF outcome <> 'EA001 extra_answers.3' THEN RAISE EXCEPTION 'FAIL: 101 answers gave %', outcome; END IF;
  outcome := pg_temp.save(uid, sid, (SELECT jsonb_object_agg(i::text, (SELECT jsonb_object_agg('q' || j, ok) FROM generate_series(1, 30) j)) FROM generate_series(1, 50) i));
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: 30 answers for each of 50 PEOs gave %', outcome; END IF;
  -- A conflict holds its competing values; "doesn't apply" holds none.
  outcome := pg_temp.save(uid, sid, jsonb_build_object('3', jsonb_build_object(
    'vehicles', ok || '{"status":"conflicting","candidates":[{"value":true,"source":{"kind":"transcript","message_id":"m1"}},{"value":false,"source":{"kind":"transcript","message_id":"m2"}}]}',
    'notes', pg_temp.answer('Anything else?', 'text', NULL, 'not_applicable'))));
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: a conflict and a "doesn''t apply" gave %', outcome; END IF;
  RAISE NOTICE 'extra_answers: malformed answers refused, at the answer they are about';
END $$;

-- ---------- certified with the rest; a change withdraws the certification ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid := pg_temp.new_intake(uid);
  first jsonb := jsonb_build_object('3', jsonb_build_object('vehicles', pg_temp.answer('Do employees drive for work?', 'yes_no', 'true')));
  changed jsonb := jsonb_build_object('3', jsonb_build_object('vehicles', pg_temp.answer('Do employees drive for work?', 'yes_no', 'false')));
  row_ public.chamber_sessions;
  cert public.chamber_certifications;
  outcome text;
BEGIN
  IF pg_temp.save(uid, sid, first) <> 'ok' THEN RAISE EXCEPTION 'FAIL: setup could not save'; END IF;
  outcome := pg_temp.certify(uid, sid);
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: could not certify: %', outcome; END IF;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.submission -> 'extra_answers' IS DISTINCT FROM first THEN RAISE EXCEPTION 'FAIL: the submission keeps %', row_.submission -> 'extra_answers'; END IF;
  SELECT * INTO cert FROM public.chamber_certifications WHERE session_id = sid;
  IF cert.extra_answers IS DISTINCT FROM first THEN RAISE EXCEPTION 'FAIL: the certification record keeps %', cert.extra_answers; END IF;

  -- Saving the same answers again changes nothing.
  IF pg_temp.save(uid, sid, first) <> 'ok' THEN RAISE EXCEPTION 'FAIL: saving the same answers was refused'; END IF;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid) <> 'submitted' THEN RAISE EXCEPTION 'FAIL: the same answers withdrew the certification'; END IF;

  -- A changed extra answer withdraws it; the record keeps what was certified.
  IF pg_temp.save(uid, sid, changed) <> 'ok' THEN RAISE EXCEPTION 'FAIL: changing an answer was refused'; END IF;
  SELECT * INTO row_ FROM public.chamber_sessions WHERE id = sid;
  IF row_.status <> 'in_progress' THEN RAISE EXCEPTION 'FAIL: a changed extra answer left the intake %', row_.status; END IF;
  SELECT * INTO cert FROM public.chamber_certifications WHERE session_id = sid;
  IF cert.superseded_reason IS DISTINCT FROM 'data_changed' OR cert.extra_answers IS DISTINCT FROM first THEN
    RAISE EXCEPTION 'FAIL: the certification on record reads % / %', cert.superseded_reason, cert.extra_answers;
  END IF;

  -- Certifying again covers the new answers, in a record of its own.
  outcome := pg_temp.certify(uid, sid, '2026-11-13T13:00:00Z');
  IF outcome <> 'ok' THEN RAISE EXCEPTION 'FAIL: could not certify again: %', outcome; END IF;
  IF (SELECT extra_answers FROM public.chamber_certifications WHERE session_id = sid AND superseded_at IS NULL) IS DISTINCT FROM changed THEN
    RAISE EXCEPTION 'FAIL: the new certification doesn''t keep the new answers';
  END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid) <> 2 THEN RAISE EXCEPTION 'FAIL: expected two certifications'; END IF;
  RAISE NOTICE 'extra_answers: certified with the rest, and a change withdraws the certification';
END $$;

-- ---------- the intake's own deletion takes them ----------
DO $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid := pg_temp.new_intake(uid);
  d uuid;
BEGIN
  IF pg_temp.save(uid, sid, jsonb_build_object('3', jsonb_build_object('vehicles', pg_temp.answer('Do employees drive for work?', 'yes_no', 'true')))) <> 'ok' THEN
    RAISE EXCEPTION 'FAIL: setup could not save';
  END IF;
  IF pg_temp.certify(uid, sid) <> 'ok' THEN RAISE EXCEPTION 'FAIL: setup could not certify'; END IF;
  -- They live on the intake's row and its certifications, which the deletion process removes.
  INSERT INTO public.intake_deletions (session_id, trigger, reason) VALUES (sid, 'retention', 'Kept past its retention') RETURNING id INTO d;
  SET LOCAL ROLE service_role;
  PERFORM * FROM public.claim_intake_deletions(5);
  PERFORM public.complete_intake_deletion(d, 0);
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.chamber_sessions WHERE id = sid) THEN RAISE EXCEPTION 'FAIL: the intake outlived its deletion'; END IF;
  IF EXISTS (SELECT 1 FROM public.chamber_certifications WHERE session_id = sid) THEN RAISE EXCEPTION 'FAIL: a certified copy outlived its intake'; END IF;
  RAISE NOTICE 'extra_answers: removed with the intake';
END $$;

DO $$ BEGIN RAISE NOTICE 'extra_answers: all cases passed'; END $$;
