-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh pipeline_learning
-- Learning from what PEOs send back (joshrkay/Nevermore#88, 20261111090000_pipeline_learning.sql): the funnel's
-- market steps, decline and lost reasons, underwriters' questions tagged with fields, and the counts advisors read.
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
\i supabase/migrations/20261111090000_pipeline_learning.sql
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

CREATE FUNCTION pg_temp.answers(company text, employees integer DEFAULT 12) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('company_name', company, 'states', jsonb_build_array('NY'), 'pay_frequency', 'bi-weekly',
    'employee_count', employees, 'start_month', 'April');
$$;

CREATE FUNCTION pg_temp.cert(data jsonb, signed_at text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', signed_at,
    'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', data);
$$;

-- A new intake of its own prospect, certified unless told not to. Runs as that prospect.
CREATE FUNCTION pg_temp.new_intake(company text, certify boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := pg_temp.new_user();
  sid uuid;
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, pg_temp.answers(company)) RETURNING id INTO sid;
  IF certify THEN
    UPDATE public.chamber_sessions
    SET status = 'submitted', submission = pg_temp.cert(pg_temp.answers(company), '2026-11-04T12:00:00Z')
    WHERE id = sid;
  END IF;
  RESET ROLE;
  RETURN sid;
END $$;

-- The prospect changes an answer and certifies again: the submission's next version.
CREATE FUNCTION pg_temp.recertify(sid uuid, employees integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  uid uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = sid);
  company text := (SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = sid);
BEGIN
  PERFORM pg_temp.as_user(uid);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = pg_temp.answers(company, employees) WHERE id = sid;
  UPDATE public.chamber_sessions
  SET status = 'submitted', submission = pg_temp.cert(pg_temp.answers(company, employees), '2026-11-05T12:00:00Z')
  WHERE id = sid;
  RESET ROLE;
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

-- How many rows `who` reads from a source; -1 when they can't read it at all.
CREATE FUNCTION pg_temp.count_as(who uuid, src text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE 'SELECT count(*) FROM ' || src INTO n;
  EXCEPTION WHEN insufficient_privilege THEN
    n := -1;
  END;
  RESET ROLE;
  RETURN n;
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

-- Moves the pipeline as an advisor, one allowed step at a time.
CREATE FUNCTION pg_temp.move(advisor uuid, sid uuid, VARIADIC stages text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE st text;
BEGIN
  FOREACH st IN ARRAY stages LOOP
    PERFORM pg_temp.as_user(advisor);
    SET LOCAL ROLE authenticated;
    PERFORM public.set_submission_status(sid, st, NULL);
    RESET ROLE;
  END LOOP;
END $$;

CREATE FUNCTION pg_temp.send(advisor uuid, sid uuid, peo text, sent_on date DEFAULT '2026-11-10') RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(advisor, format('SELECT public.advisor_record_quote_send(%L, %L, %L)', sid, peo, sent_on));
$$;

-- Sets a quote request's status and quote, as the panel's form sends them.
CREATE FUNCTION pg_temp.answer(advisor uuid, id bigint, status text, received date DEFAULT NULL, expires date DEFAULT NULL,
    starts date DEFAULT NULL, fee numeric DEFAULT NULL, note text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(advisor, format('SELECT public.advisor_update_quote_request(%s, %L, %L, %L, %L, %L, %L)',
    id, status, received, expires, starts, fee, note));
$$;

CREATE FUNCTION pg_temp.qr(id bigint) RETURNS public.quote_requests LANGUAGE sql AS $$
  SELECT * FROM public.quote_requests WHERE quote_requests.id = qr.id;
$$;

CREATE FUNCTION pg_temp.milestone(sid uuid, m text) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT reached_at FROM public.intake_milestones WHERE session_id = sid AND milestone = m;
$$;

DO $$
DECLARE
  advisor uuid := pg_temp.new_user();
  a uuid := pg_temp.new_intake('Alpha Co');
  q bigint;
  prospect_a uuid;
  b uuid;
  c uuid;
  qb bigint;
  t0 timestamptz;
  f jsonb;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');
  prospect_a := (SELECT user_id FROM public.chamber_sessions WHERE id = a);
  PERFORM pg_temp.move(advisor, a, 'under_review', 'ready_for_market');

  -- ---------- The market steps of the funnel ----------
  IF pg_temp.milestone(a, 'sent_to_peo') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: sent before any send'; END IF;
  q := (pg_temp.send(advisor, a, 'TriNet', current_date + 2) ->> 'id')::bigint;
  IF pg_temp.milestone(a, 'sent_to_peo') IS DISTINCT FROM (current_date + 2)::timestamptz THEN
    RAISE EXCEPTION 'FAIL: the first send was recorded at %, not the day it was sent', pg_temp.milestone(a, 'sent_to_peo');
  END IF;

  IF pg_temp.milestone(a, 'first_quote') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a quote before any quote'; END IF;
  PERFORM pg_temp.move(advisor, a, 'sent_to_carrier');
  PERFORM pg_temp.answer(advisor, q, 'quoted', received => (current_date + 1), fee => 150);
  IF pg_temp.milestone(a, 'first_quote') IS DISTINCT FROM (current_date + 1)::timestamptz THEN
    RAISE EXCEPTION 'FAIL: the first quote was recorded at %, not the day it arrived', pg_temp.milestone(a, 'first_quote');
  END IF;

  PERFORM pg_temp.move(advisor, a, 'quoted');
  IF pg_temp.milestone(a, 'won') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: won before winning'; END IF;
  PERFORM pg_temp.run(advisor, format('SELECT to_jsonb(public.set_submission_status(%L, ''won'', NULL, %s))', a, q));
  IF pg_temp.milestone(a, 'won') IS NULL THEN RAISE EXCEPTION 'FAIL: winning wasn''t recorded'; END IF;

  -- The funnel lists the market steps after the others, each timed from certification, and says which clock it uses.
  -- Certified an hour after starting, so timing from the start and from certification read differently.
  UPDATE public.intake_milestones SET reached_at = started_at + interval '1 hour' WHERE session_id = a AND milestone = 'certified';
  t0 := (SELECT reached_at FROM public.intake_milestones WHERE session_id = a AND milestone = 'certified');
  UPDATE public.intake_milestones SET reached_at = t0 + interval '1 day' WHERE session_id = a AND milestone = 'sent_to_peo';
  UPDATE public.intake_milestones SET reached_at = t0 + interval '3 days' WHERE session_id = a AND milestone = 'first_quote';
  UPDATE public.intake_milestones SET reached_at = t0 + interval '10 days' WHERE session_id = a AND milestone = 'won';
  f := pg_temp.run(advisor, 'SELECT jsonb_agg(to_jsonb(x) ORDER BY x.step) FROM public.advisor_intake_funnel(now() - interval ''1 day'', now() + interval ''1 day'') x');
  IF (SELECT jsonb_agg(e ->> 'milestone') FROM jsonb_array_elements(f) e) <> '["started", "answered", "document_uploaded", "census_provided", "ready_to_certify", "email_verified", "certified", "manuscript_downloaded", "sent_to_peo", "first_quote", "won"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: the funnel''s steps are %', (SELECT jsonb_agg(e ->> 'milestone') FROM jsonb_array_elements(f) e);
  END IF;
  IF (SELECT jsonb_agg(jsonb_build_array(e ->> 'milestone', (e ->> 'intakes')::int, (e ->> 'median_minutes')::numeric, e ->> 'measured_from'))
        FROM jsonb_array_elements(f) e WHERE e ->> 'milestone' IN ('certified', 'sent_to_peo', 'first_quote', 'won'))
     <> jsonb_build_array(
          jsonb_build_array('certified', 1, (SELECT round((extract(epoch FROM t0 - started_at) / 60)::numeric, 1) FROM public.intake_milestones WHERE session_id = a AND milestone = 'certified'), 'start'),
          jsonb_build_array('sent_to_peo', 1, 1440.0, 'certification'),
          jsonb_build_array('first_quote', 1, 4320.0, 'certification'),
          jsonb_build_array('won', 1, 14400.0, 'certification')) THEN
    RAISE EXCEPTION 'FAIL: the funnel''s market steps read %', f;
  END IF;

  -- The same steps by source.
  IF (SELECT jsonb_build_array((x ->> 'sent_to_peo')::int, (x ->> 'first_quote')::int, (x ->> 'won')::int)
        FROM jsonb_array_elements(pg_temp.run(advisor, 'SELECT jsonb_agg(to_jsonb(x)) FROM public.advisor_intake_sources(now() - interval ''1 day'', now() + interval ''1 day'') x')) x
       WHERE x ->> 'referral_code' IS NULL AND x ->> 'utm_source' IS NULL) IS DISTINCT FROM '[1, 1, 1]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: the funnel by source doesn''t count the market steps';
  END IF;

  -- ---------- Decline reasons ----------
  b := pg_temp.new_intake('Beta Co');
  PERFORM pg_temp.move(advisor, b, 'under_review', 'ready_for_market');
  qb := (pg_temp.send(advisor, b, 'Justworks') ->> 'id')::bigint;
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_update_quote_request(%s, ''declined'')', qb), '22023', 'a decline with no reason');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_update_quote_request(%s, ''declined'', p_decline_reason => ''too_small'')', qb), '22023', 'a reason not on the list');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_update_quote_request(%s, ''quoted'', p_decline_reason => ''other'')', qb), '22023', 'a reason on a quote');
  PERFORM pg_temp.run(advisor, format('SELECT public.advisor_update_quote_request(%s, ''declined'', p_note => ''Not in WA yet'', p_decline_reason => ''state_not_served'')', qb));
  IF (SELECT decline_reason FROM public.quote_requests WHERE id = qb) IS DISTINCT FROM 'state_not_served'
     OR NOT EXISTS (SELECT 1 FROM public.quote_request_events WHERE quote_request_id = qb AND field = 'decline_reason' AND new_value = 'state_not_served') THEN
    RAISE EXCEPTION 'FAIL: the decline reason wasn''t recorded and logged';
  END IF;

  -- ---------- Lost reasons ----------
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.set_submission_status(%L, ''lost'')', b), '22023', 'lost with no reason');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.set_submission_status(%L, ''lost'', p_lost_reason => ''nope'')', b), '22023', 'a lost reason not on the list');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.set_submission_status(%L, ''under_review'', p_lost_reason => ''cost'')', b), '22023', 'a lost reason on another move');
  PERFORM pg_temp.run(advisor, format('SELECT to_jsonb(public.set_submission_status(%L, ''lost'', ''Renewed with their broker'', p_lost_reason => ''stayed_with_current''))', b));
  IF (SELECT lost_reason FROM public.submission_status_history WHERE session_id = b ORDER BY id DESC LIMIT 1) IS DISTINCT FROM 'stayed_with_current' THEN
    RAISE EXCEPTION 'FAIL: the lost reason wasn''t kept in the history';
  END IF;

  -- ---------- Underwriters' questions, tagged ----------
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_note_underwriter_question(%s, ''Loss runs?'', ARRAY[''salary_of_ceo''])', q), '22023', 'a field that isn''t one');
  PERFORM pg_temp.run(advisor, format('SELECT public.advisor_note_underwriter_question(%s, ''Census and pay frequency?'', ARRAY[''employees'', ''pay_frequency'', ''census''])', q));
  IF (SELECT fields FROM public.quote_request_events WHERE quote_request_id = q AND field = 'underwriter_question' ORDER BY id DESC LIMIT 1)
     IS DISTINCT FROM ARRAY['census', 'pay_frequency'] THEN
    RAISE EXCEPTION 'FAIL: the question''s fields were kept as %',
      (SELECT fields FROM public.quote_request_events WHERE quote_request_id = q AND field = 'underwriter_question' ORDER BY id DESC LIMIT 1);
  END IF;
  -- Untagged still works.
  PERFORM pg_temp.run(advisor, format('SELECT public.advisor_note_underwriter_question(%s, ''Anything else?'')', q));

  -- ---------- By PEO ----------
  -- Alpha Co: TriNet sent, quoted (received tomorrow) and won. Beta Co: Justworks declined, a state it doesn't serve.
  f := pg_temp.run(advisor, 'SELECT jsonb_agg(to_jsonb(x)) FROM public.advisor_peo_outcomes(now() - interval ''1 day'', now() + interval ''1 day'') x');
  IF f IS DISTINCT FROM jsonb_build_array(
       jsonb_build_object('peo_name', 'Justworks', 'sent', 1, 'quoted', 0, 'declined', 1, 'decline_reasons', '{"state_not_served": 1}'::jsonb,
                          'median_days_to_quote', NULL, 'won', 0),
       jsonb_build_object('peo_name', 'TriNet', 'sent', 1, 'quoted', 1, 'declined', 0, 'decline_reasons', '{}'::jsonb,
                          'median_days_to_quote', ((current_date + 1) - (current_date + 2))::numeric, 'won', 1)) THEN
    RAISE EXCEPTION 'FAIL: by PEO reads %', f;
  END IF;
  PERFORM pg_temp.must_raise(prospect_a, 'SELECT * FROM public.advisor_peo_outcomes(now() - interval ''1 day'', now())', '42501', 'a prospect reading by PEO');

  -- ---------- Lost reasons, counted ----------
  -- A file lost, reopened and lost again counts once, by its latest reason.
  PERFORM pg_temp.move(advisor, b, 'archived', 'submitted', 'under_review');
  PERFORM pg_temp.run(advisor, format('SELECT to_jsonb(public.set_submission_status(%L, ''lost'', p_lost_reason => ''cost''))', b));
  f := pg_temp.run(advisor, 'SELECT jsonb_agg(to_jsonb(x)) FROM public.advisor_lost_reasons(now() - interval ''1 day'', now() + interval ''1 day'') x');
  IF f IS DISTINCT FROM '[{"reason": "cost", "submissions": 1}]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: lost reasons read %', f;
  END IF;

  -- ---------- The fields underwriters ask about ----------
  -- Two questions on Alpha Co: one tagged census and pay frequency, one untagged.
  f := pg_temp.run(advisor, 'SELECT jsonb_agg(to_jsonb(x)) FROM public.advisor_question_fields(now() - interval ''1 day'', now() + interval ''1 day'') x');
  IF f IS DISTINCT FROM '[{"field": "census", "questions": 1, "total_questions": 2, "tagged_questions": 1},
                         {"field": "pay_frequency", "questions": 1, "total_questions": 2, "tagged_questions": 1}]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: the asked-about fields read %', f;
  END IF;

  -- By source, a quote that hasn't won counts as a quote and not a win.
  c := pg_temp.new_intake('Gamma Co');
  PERFORM pg_temp.move(advisor, c, 'under_review', 'ready_for_market');
  PERFORM pg_temp.answer(advisor, (pg_temp.send(advisor, c, 'Insperity') ->> 'id')::bigint, 'quoted', fee => 130);
  IF (SELECT jsonb_build_array((x ->> 'sent_to_peo')::int, (x ->> 'first_quote')::int, (x ->> 'won')::int)
        FROM jsonb_array_elements(pg_temp.run(advisor, 'SELECT jsonb_agg(to_jsonb(x)) FROM public.advisor_intake_sources(now() - interval ''1 day'', now() + interval ''1 day'') x')) x
       WHERE x ->> 'referral_code' IS NULL AND x ->> 'utm_source' IS NULL) IS DISTINCT FROM '[3, 2, 1]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: by source, the market steps don''t count each intake once per step';
  END IF;

  RAISE NOTICE 'pipeline_learning: all cases passed';
END $$;
