-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh information_requests
-- Information requests (20261105090000_information_requests.sql): only an advisor asks, with a message and
-- reviewable fields, about an intake certified at least once and not closed, from a stage that may move to
-- information requested. Asking records the request, moves the pipeline, writes the history and queues an email
-- to the account's own address carrying named facts only. The owner, and nobody else, reads the latest request
-- until certifying again or the advisor moving on answers it. The record is append-only, and every email to the
-- prospect respects suppression. Advisors and prospects run as `authenticated` with their JWT claims.
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

CREATE FUNCTION pg_temp.answers(company text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('company_name', company, 'states', jsonb_build_array('NY'), 'pay_frequency', 'bi-weekly');
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
  UPDATE public.profiles SET contact_name = 'Jo Doe' WHERE user_id = uid;
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

CREATE FUNCTION pg_temp.ask(advisor uuid, sid uuid, message text, fields text[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  result := public.advisor_request_information(sid, message, fields);
  RESET ROLE;
  RETURN result;
END $$;

CREATE FUNCTION pg_temp.seen_by(who uuid, sid uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  PERFORM pg_temp.as_user(who);
  SET LOCAL ROLE authenticated;
  result := public.prospect_information_request(sid);
  RESET ROLE;
  RETURN result;
END $$;

DO $$
DECLARE
  advisor uuid := pg_temp.new_user();
  a uuid := pg_temp.new_intake('Alpha Co');
  b uuid := pg_temp.new_intake('Beta Co');
  lost uuid := pg_temp.new_intake('Lost Co');
  draft uuid := pg_temp.new_intake('Draft Co', false);
  prospect uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = a);
  stranger uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = b);
  file_id text := (SELECT file_id FROM public.chamber_sessions WHERE id = a);
  result jsonb;
  req public.information_requests;
  h public.submission_status_history;
  e public.outbox_events;
  seen jsonb;
  n bigint;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');
  IF file_id IS NULL THEN RAISE EXCEPTION 'setup: the certified intake has no File ID'; END IF;

  -- ---------- Who may ask, and what is refused ----------
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.advisor_request_information(%L, ''Send it'', ''{}'')', a), '42501', 'a prospect asking');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_request_information(%L, ''   '', ''{}'')', a), '22023', 'a request with no message');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_request_information(%L, %L, ''{}'')', a, repeat('x', 1001)), '22023', 'a request over 1000 characters');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_request_information(%L, ''Send it'', ''{salary_of_ceo}'')', a), '22023', 'an unknown field');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_request_information(%L, ''Send it'', ARRAY[NULL]::text[])', a), '22023', 'a null field');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_request_information(%L, ''Send it'', ''{}'')', draft), '22023', 'a draft never certified');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_request_information(%L, ''Send it'', ''{}'')', gen_random_uuid()), 'PT404', 'an intake that doesn''t exist');
  IF (SELECT count(*) FROM public.information_requests) <> 0 OR (SELECT count(*) FROM public.outbox_events WHERE kind = 'information_request') <> 0 THEN
    RAISE EXCEPTION 'FAIL: a refused request left a record or an email';
  END IF;

  -- ---------- Asking: recorded, the pipeline moves, the history says what was asked, an email is queued ----------
  result := pg_temp.ask(advisor, a, '  Please confirm your pay frequency and upload the census.  ',
    ARRAY['pay_frequency', 'employees', 'census', 'pay_frequency', 'hq_state']);
  IF result ->> 'from_status' <> 'submitted' OR result ->> 'status' <> 'information_requested' THEN
    RAISE EXCEPTION 'FAIL: asking returned %', result;
  END IF;
  SELECT * INTO req FROM public.information_requests WHERE session_id = a;
  IF req.message <> 'Please confirm your pay frequency and upload the census.'
     OR req.fields <> ARRAY['pay_frequency', 'census', 'hq_state']
     OR req.requested_by IS DISTINCT FROM advisor OR req.requested_by_email IS DISTINCT FROM advisor || '@example.test'
     OR req.id <> (result ->> 'request_id')::bigint THEN
    RAISE EXCEPTION 'FAIL: the request was recorded as %', req;
  END IF;
  IF (SELECT status FROM public.submission_workflow WHERE session_id = a) <> 'information_requested' THEN
    RAISE EXCEPTION 'FAIL: asking didn''t move the pipeline';
  END IF;
  SELECT * INTO h FROM public.submission_status_history WHERE session_id = a ORDER BY id DESC LIMIT 1;
  IF h.from_status <> 'submitted' OR h.to_status <> 'information_requested' OR h.changed_by IS DISTINCT FROM advisor
     OR h.note <> 'Asked the prospect: Please confirm your pay frequency and upload the census.' THEN
    RAISE EXCEPTION 'FAIL: asking was recorded in the history as %', h;
  END IF;
  SELECT * INTO e FROM public.outbox_events WHERE session_id = a AND kind = 'information_request';
  IF e.dedupe_key <> 'request:' || req.id OR e.status <> 'pending'
     OR e.payload ->> 'recipient_email' <> prospect || '@example.test'
     OR e.payload ->> 'reference' <> file_id
     OR e.payload ->> 'company_name' <> 'Alpha Co'
     OR e.payload ->> 'recipient_name' <> 'Jo Doe'
     OR e.payload ->> 'message' <> req.message
     OR e.payload -> 'fields' <> '["pay_frequency", "census", "hq_state"]'::jsonb
     OR e.payload ->> 'requested_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$' THEN
    RAISE EXCEPTION 'FAIL: the queued email was %', e;
  END IF;
  -- The email carries named facts only, never the answers.
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(e.payload) k
             WHERE k NOT IN ('reference', 'company_name', 'recipient_name', 'recipient_email', 'message', 'fields', 'requested_at')) THEN
    RAISE EXCEPTION 'FAIL: the email payload carries more than it should: %', e.payload;
  END IF;

  -- ---------- The prospect sees it; nobody else does ----------
  seen := pg_temp.seen_by(prospect, a);
  IF seen ->> 'message' <> req.message OR seen -> 'fields' <> '["pay_frequency", "census", "hq_state"]'::jsonb
     OR (seen ->> 'requested_at')::timestamptz <> req.requested_at THEN
    RAISE EXCEPTION 'FAIL: the prospect read %', seen;
  END IF;
  IF pg_temp.seen_by(stranger, a) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: another prospect read the request'; END IF;
  IF pg_temp.seen_by(advisor, a) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: the prospect-only read answered an advisor'; END IF;
  IF pg_temp.seen_by(stranger, b) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: an intake with no request read one'; END IF;
  PERFORM set_config('request.jwt.claims', '', false);
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.prospect_information_request(a);
    RAISE EXCEPTION 'FAIL: a signed-out caller could read a request';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
  -- The table itself: advisors read it, prospects don't.
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.information_requests) <> 0 THEN RAISE EXCEPTION 'FAIL: a prospect read the table'; END IF;
  RESET ROLE;
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.information_requests) <> 1 THEN RAISE EXCEPTION 'FAIL: the advisor couldn''t read the table'; END IF;
  RESET ROLE;
  PERFORM pg_temp.must_raise(advisor, format('INSERT INTO public.information_requests (session_id, message) VALUES (%L, ''Direct'')', a), '42501', 'an advisor writing the table directly');

  -- ---------- A second request while the first waits: recorded and sent, the stage kept ----------
  result := pg_temp.ask(advisor, a, 'Also: who runs payroll today?', ARRAY['payroll_vendor']);
  IF result ->> 'from_status' <> 'information_requested' THEN RAISE EXCEPTION 'FAIL: a second request returned %', result; END IF;
  IF (SELECT count(*) FROM public.outbox_events WHERE session_id = a AND kind = 'information_request') <> 2 THEN
    RAISE EXCEPTION 'FAIL: the second request queued no email';
  END IF;
  SELECT * INTO h FROM public.submission_status_history WHERE session_id = a ORDER BY id DESC LIMIT 1;
  IF h.from_status <> 'information_requested' OR h.to_status <> 'information_requested' THEN
    RAISE EXCEPTION 'FAIL: a second request was recorded as %', h;
  END IF;
  IF pg_temp.seen_by(prospect, a) ->> 'message' <> 'Also: who runs payroll today?' THEN
    RAISE EXCEPTION 'FAIL: the prospect didn''t see the latest request';
  END IF;

  -- ---------- Certifying changed answers answers it ----------
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  UPDATE public.chamber_sessions SET chamber_data = pg_temp.answers('Alpha Company') WHERE id = a;
  -- While they work on it, the request is still theirs to see.
  IF public.prospect_information_request(a) IS NULL THEN RAISE EXCEPTION 'FAIL: editing hid the request'; END IF;
  UPDATE public.chamber_sessions
  SET status = 'submitted', submission = pg_temp.cert(pg_temp.answers('Alpha Company'), '2026-11-05T12:00:00Z')
  WHERE id = a;
  RESET ROLE;
  IF (SELECT status FROM public.submission_workflow WHERE session_id = a) <> 'submitted' THEN
    RAISE EXCEPTION 'FAIL: certifying didn''t answer the request';
  END IF;
  IF pg_temp.seen_by(prospect, a) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: an answered request was still shown'; END IF;

  -- ---------- An advisor moving on closes it too ----------
  PERFORM pg_temp.ask(advisor, b, 'Is the HQ still in New York?', ARRAY['hq_state']);
  IF pg_temp.seen_by(stranger, b) IS NULL THEN RAISE EXCEPTION 'FAIL: the second prospect didn''t see their request'; END IF;
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  PERFORM public.set_submission_status(b, 'under_review', 'Answered by phone');
  RESET ROLE;
  IF pg_temp.seen_by(stranger, b) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a request the advisor moved past was still shown'; END IF;

  -- ---------- Only from a stage that may move to information requested ----------
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  PERFORM public.set_submission_status(lost, 'lost', 'Went with their broker');
  RESET ROLE;
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_request_information(%L, ''Send it'', ''{}'')', lost), '22023', 'asking about a lost submission');
  -- A closed intake can't answer.
  UPDATE public.chamber_sessions SET status = 'archived' WHERE id = b;
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_request_information(%L, ''Send it'', ''{}'')', b), '22023', 'asking about an archived intake');

  -- ---------- The record is append-only ----------
  BEGIN
    UPDATE public.information_requests SET message = 'Rewritten' WHERE session_id = a;
    RAISE EXCEPTION 'FAIL: a request was rewritten';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.information_requests WHERE session_id = a;
    RAISE EXCEPTION 'FAIL: a request was deleted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- ---------- Every email to the prospect respects suppression ----------
  IF NOT public.outbox_kind_reaches_prospect('information_request') OR NOT public.outbox_kind_reaches_prospect('prospect_confirmation')
     OR public.outbox_kind_reaches_prospect('advisor_notification') THEN
    RAISE EXCEPTION 'FAIL: outbox_kind_reaches_prospect is wrong';
  END IF;
  INSERT INTO public.email_suppressions (address, reason) VALUES (lower(prospect || '@example.test'), 'bounced');
  SELECT count(*) INTO n FROM public.claim_outbox_events(ARRAY['information_request'], 10, 5, 600) c WHERE c.session_id = a;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % request(s) to a suppressed address were claimed', n; END IF;
  IF EXISTS (SELECT 1 FROM public.outbox_events WHERE session_id = a AND kind = 'information_request' AND status <> 'suppressed') THEN
    RAISE EXCEPTION 'FAIL: a request to a suppressed address wasn''t held back';
  END IF;
  -- The second prospect's request still goes.
  IF NOT EXISTS (SELECT 1 FROM public.outbox_events WHERE session_id = b AND kind = 'information_request' AND status = 'claimed') THEN
    RAISE EXCEPTION 'FAIL: a request to a reachable address wasn''t claimed';
  END IF;

  -- A bounce on a request concerns that address only, and holds back what is waiting for it.
  UPDATE public.outbox_events SET provider_message_id = 'msg_req_b', status = 'sent' WHERE session_id = b AND kind = 'information_request';
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
  VALUES ('information_request', b, 'request:later', jsonb_build_object('recipient_email', stranger || '@example.test', 'message', 'Later'));
  result := public.record_email_delivery_event('evt_req_b', 'email.bounced', 'msg_req_b', ARRAY[stranger || '@example.test', 'someone@else.test'], 'Permanent', 'No such mailbox', now());
  IF result ->> 'outcome' <> 'suppressed' OR (result ->> 'suppressed')::int <> 1 THEN
    RAISE EXCEPTION 'FAIL: a bounced request recorded %', result;
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_suppressions WHERE address = 'someone@else.test') THEN
    RAISE EXCEPTION 'FAIL: a bounce on a request suppressed an address it wasn''t sent to';
  END IF;
  IF (SELECT status FROM public.outbox_events WHERE dedupe_key = 'request:later') <> 'suppressed' THEN
    RAISE EXCEPTION 'FAIL: a waiting request to a bounced address wasn''t held back';
  END IF;

  -- The advisor sees the bounce on the submission.
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  IF NOT EXISTS (SELECT 1 FROM public.advisor_email_problems() p WHERE p.session_id = b) THEN
    RAISE EXCEPTION 'FAIL: a bounced request wasn''t shown to the advisor';
  END IF;
  RESET ROLE;

  RAISE NOTICE 'information_requests: all cases passed';
END $$;
