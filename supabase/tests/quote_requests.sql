-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quote_requests
-- Quote requests (joshrkay/Nevermore#82, 20261110090000_quote_requests.sql): an advisor records each PEO a
-- submission was sent to and what that PEO answered, one quote request per PEO, every change logged; Won names the
-- winning quote and closes the rest, Lost and Archived close them all; the queue counts them. Prospects see none of it.
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

DO $$
DECLARE
  advisor uuid := pg_temp.new_user();
  a uuid := pg_temp.new_intake('Alpha Co');
  prospect uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = a);
  result jsonb;
  r public.quote_requests;
  b uuid := pg_temp.new_intake('Beta Co');
  row record;
  l uuid := pg_temp.new_intake('Lost Co');
  l_trinet bigint;
  l_tri bigint;
  w uuid := pg_temp.new_intake('Won Co');
  w_trinet bigint;
  w_justworks bigint;
  w_insperity bigint;
  o uuid := pg_temp.new_intake('Other Co');
  o_quote bigint;
  early uuid := pg_temp.new_intake('Early Co');
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');
  PERFORM pg_temp.move(advisor, a, 'under_review', 'ready_for_market');
  PERFORM pg_temp.move(advisor, early, 'under_review');

  -- ---------- Recording a send ----------
  result := pg_temp.send(advisor, a, '  TriNet  ');
  r := pg_temp.qr((result ->> 'id')::bigint);
  IF r.session_id IS DISTINCT FROM a OR r.peo_name <> 'TriNet' OR r.status <> 'sent'
     OR r.sent_version <> 1 OR r.sent_on <> '2026-11-10' THEN
    RAISE EXCEPTION 'FAIL: the send was recorded as %', r;
  END IF;

  -- Only advisors record sends.
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.advisor_record_quote_send(%L, ''Insperity'', NULL)', a), '42501', 'a prospect recording a send');

  -- A send is refused before the submission is ready for market.
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_record_quote_send(%L, ''Insperity'', NULL)', early), '22023', 'a send while under review');

  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_record_quote_send(%L, ''Insperity'', NULL)', gen_random_uuid()), 'PT404', 'a send for a submission that doesn''t exist');

  -- The PEO's name is required and at most 80 characters, as the prospect's chosen PEO is.
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_record_quote_send(%L, ''   '', NULL)', a), '22023', 'a send with no PEO');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_record_quote_send(%L, %L, NULL)', a, repeat('x', 81)), '22023', 'a PEO name over 80 characters');

  -- The same PEO again, however it is capitalised, continues the same quote request.
  result := pg_temp.send(advisor, a, 'trinet', '2026-11-12');
  IF (result ->> 'id')::bigint <> r.id OR (SELECT count(*) FROM public.quote_requests WHERE session_id = a) <> 1 THEN
    RAISE EXCEPTION 'FAIL: a second send to TriNet made another quote request: %', result;
  END IF;
  IF (pg_temp.qr(r.id)).sent_on <> '2026-11-12' THEN
    RAISE EXCEPTION 'FAIL: the second send didn''t record its date';
  END IF;

  -- Every change is logged: who, when, the field, the old and the new value.
  IF NOT EXISTS (
    SELECT 1 FROM public.quote_request_events e
    WHERE e.quote_request_id = r.id AND e.field = 'sent_on' AND e.old_value = '2026-11-10' AND e.new_value = '2026-11-12'
      AND e.changed_by = advisor AND e.changed_by_email = advisor || '@example.test' AND e.changed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: the second send wasn''t logged: %', (SELECT jsonb_agg(e) FROM public.quote_request_events e);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.quote_request_events e
    WHERE e.quote_request_id = r.id AND e.field = 'status' AND e.old_value IS NULL AND e.new_value = 'sent'
  ) THEN
    RAISE EXCEPTION 'FAIL: the first send wasn''t logged';
  END IF;

  -- The history can't be rewritten, by an advisor or by anyone else.
  PERFORM pg_temp.must_raise(advisor, 'UPDATE public.quote_request_events SET new_value = ''x''', '42501', 'an advisor editing the history');
  PERFORM pg_temp.must_raise(advisor, 'DELETE FROM public.quote_request_events', '42501', 'an advisor deleting the history');
  BEGIN
    UPDATE public.quote_request_events SET new_value = 'x';
    RAISE EXCEPTION 'FAIL: the history was edited by the table owner';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
  -- Nobody writes quote requests directly: the functions do.
  PERFORM pg_temp.must_raise(advisor, format('UPDATE public.quote_requests SET status = ''quoted'' WHERE id = %s', r.id), '42501', 'an advisor writing a quote request directly');
  -- Advisors read them; the prospect never sees one, even on their own intake.
  IF pg_temp.count_as(advisor, format('public.quote_requests WHERE session_id = %L', a)) <> 1
     OR pg_temp.count_as(advisor, format('public.quote_request_events WHERE session_id = %L', a)) <= 0 THEN
    RAISE EXCEPTION 'FAIL: an advisor can''t read the quote requests';
  END IF;
  IF (pg_temp.run(prospect, 'SELECT to_jsonb(count(*)) FROM public.quote_requests'))::int <> 0
     OR (pg_temp.run(prospect, 'SELECT to_jsonb(count(*)) FROM public.quote_request_events'))::int <> 0 THEN
    RAISE EXCEPTION 'FAIL: the prospect can read quote requests';
  END IF;

  -- ---------- A PEO answers ----------
  PERFORM pg_temp.answer(advisor, r.id, 'quoted', '2026-11-14', '2026-12-14', '2027-04-01', 145.50, '  Includes the Aetna PPO.  ');
  r := pg_temp.qr(r.id);
  IF r.status <> 'quoted' OR r.quote_received_on <> '2026-11-14' OR r.quote_expires_on <> '2026-12-14'
     OR r.proposed_start_on <> '2027-04-01' OR r.admin_fee_pepm <> 145.50 OR r.note <> 'Includes the Aetna PPO.' THEN
    RAISE EXCEPTION 'FAIL: the quote was recorded as %', r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_events e WHERE e.quote_request_id = r.id
                  AND e.field = 'admin_fee_pepm' AND e.old_value IS NULL AND e.new_value = '145.50') THEN
    RAISE EXCEPTION 'FAIL: the quote''s fee wasn''t logged';
  END IF;

  PERFORM pg_temp.must_raise(advisor, 'SELECT public.advisor_update_quote_request(999999, ''declined'')', 'PT404', 'answering a quote request that doesn''t exist');
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.advisor_update_quote_request(%s, ''declined'')', r.id), '42501', 'a prospect answering');
  -- A change logs only the fields it changed: answering didn't log the PEO's name, which the first send set.
  IF (SELECT count(*) FROM public.quote_request_events e WHERE e.quote_request_id = r.id AND e.field = 'peo_name') <> 1 THEN
    RAISE EXCEPTION 'FAIL: fields that didn''t change were logged';
  END IF;

  -- A quote's terms belong to a quote: refused on a quote request that isn't quoted.
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_update_quote_request(%s, ''declined'', NULL, NULL, NULL, 99)', r.id), '22023', 'a fee on a declined quote request');

  -- Only the moves a PEO's answer makes: never back to sent (a send does that), never out of closed but by a send.
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_update_quote_request(%s, ''sent'')', r.id), '22023', 'answering back to sent');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_update_quote_request(%s, ''maybe'')', r.id), '22023', 'a status that doesn''t exist');

  -- Closing: a closed quote request is answered again only after a new send reopens it.
  PERFORM pg_temp.answer(advisor, r.id, 'closed', note => 'Withdrawn: the employer chose to wait.');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_update_quote_request(%s, ''quoted'')', r.id), '22023', 'answering a closed quote request');

  -- After the prospect certifies again, a new send reopens the closed quote request with the new version.
  PERFORM pg_temp.recertify(a, 14);
  result := pg_temp.send(advisor, a, 'TriNet', '2026-11-20');
  r := pg_temp.qr(r.id);
  IF (result ->> 'id')::bigint <> r.id OR r.status <> 'sent' OR r.sent_version <> 2 OR r.sent_on <> '2026-11-20' THEN
    RAISE EXCEPTION 'FAIL: resending to a closed quote request left it as %', r;
  END IF;

  -- ---------- A question from the PEO's underwriter ----------
  result := pg_temp.run(advisor, format('SELECT public.advisor_note_underwriter_question(%s, %L)', r.id, '  Can they send last year''s loss runs?  '));
  IF (pg_temp.qr(r.id)).status <> 'sent' OR NOT EXISTS (
    SELECT 1 FROM public.quote_request_events e WHERE e.quote_request_id = r.id AND e.field = 'underwriter_question'
      AND e.new_value = 'Can they send last year''s loss runs?' AND e.changed_by = advisor) THEN
    RAISE EXCEPTION 'FAIL: the underwriter''s question wasn''t noted, or changed the status';
  END IF;
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_note_underwriter_question(%s, ''  '')', r.id), '22023', 'an empty question');
  PERFORM pg_temp.must_raise(advisor, 'SELECT public.advisor_note_underwriter_question(999999, ''Why?'')', 'PT404', 'a question on a quote request that doesn''t exist');
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.advisor_note_underwriter_question(%s, ''Why?'')', r.id), '42501', 'a prospect noting a question');

  -- Limits: a note or question of at most 2000 characters, a fee from 0 to 100000.
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_update_quote_request(%s, ''declined'', NULL, NULL, NULL, NULL, %L)', r.id, repeat('x', 2001)), '22023', 'a note over 2000 characters');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_update_quote_request(%s, ''quoted'', NULL, NULL, NULL, -1)', r.id), '22023', 'a negative fee');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_note_underwriter_question(%s, %L)', r.id, repeat('x', 2001)), '22023', 'a question over 2000 characters');

  -- ---------- Won names the winning quote; the rest close ----------
  PERFORM pg_temp.move(advisor, w, 'under_review', 'ready_for_market');
  w_trinet := (pg_temp.send(advisor, w, 'TriNet') ->> 'id')::bigint;
  w_justworks := (pg_temp.send(advisor, w, 'Justworks') ->> 'id')::bigint;
  w_insperity := (pg_temp.send(advisor, w, 'Insperity') ->> 'id')::bigint;
  PERFORM pg_temp.move(advisor, w, 'sent_to_carrier');
  -- Sending is open at Sent to carrier/PEO and at Quoted too.
  BEGIN
    PERFORM pg_temp.send(advisor, w, 'Rippling', '2026-11-11');
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE EXCEPTION 'FAIL: a send at Sent to carrier/PEO was refused: %', SQLERRM;
  END;
  PERFORM pg_temp.answer(advisor, w_trinet, 'quoted', '2026-11-14', '2026-12-14', '2027-04-01', 150);
  PERFORM pg_temp.answer(advisor, w_justworks, 'declined', note => 'Outside their appetite.');
  PERFORM pg_temp.move(advisor, w, 'quoted');
  IF (pg_temp.send(advisor, w, 'Rippling', '2026-11-13') ->> 'sent_on') <> '2026-11-13' THEN
    RAISE EXCEPTION 'FAIL: a send at Quoted wasn''t recorded';
  END IF;
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.set_submission_status(%L, ''won'')', w), '22023', 'won with no winning quote');

  -- The winner is one of this submission's quotes, and a quote, not a decline or another submission's request.
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.set_submission_status(%L, ''won'', NULL, %s)', w, w_justworks), '22023', 'won with a declined quote request');
  PERFORM pg_temp.move(advisor, o, 'under_review', 'ready_for_market');
  o_quote := (pg_temp.send(advisor, o, 'TriNet') ->> 'id')::bigint;
  PERFORM pg_temp.answer(advisor, o_quote, 'quoted', fee => 140);
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.set_submission_status(%L, ''won'', NULL, %s)', w, o_quote), '22023', 'won with another submission''s quote');

  PERFORM pg_temp.run(advisor, format('SELECT to_jsonb(public.set_submission_status(%L, ''won'', ''TriNet it is'', %s))', w, w_trinet));
  IF (SELECT won_quote_request_id FROM public.submission_workflow WHERE session_id = w) IS DISTINCT FROM w_trinet THEN
    RAISE EXCEPTION 'FAIL: the winning quote wasn''t recorded';
  END IF;
  IF (pg_temp.qr(w_trinet)).status <> 'quoted' OR (pg_temp.qr(w_justworks)).status <> 'declined'
     OR (pg_temp.qr(w_insperity)).status <> 'closed' THEN
    RAISE EXCEPTION 'FAIL: winning left TriNet %, Justworks %, Insperity %',
      (pg_temp.qr(w_trinet)).status, (pg_temp.qr(w_justworks)).status, (pg_temp.qr(w_insperity)).status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_events e WHERE e.quote_request_id = w_insperity
                  AND e.field = 'status' AND e.old_value = 'sent' AND e.new_value = 'closed' AND e.changed_by = advisor) THEN
    RAISE EXCEPTION 'FAIL: closing Insperity wasn''t logged';
  END IF;
  PERFORM pg_temp.move(advisor, w, 'archived');
  IF (SELECT won_quote_request_id FROM public.submission_workflow WHERE session_id = w) IS DISTINCT FROM w_trinet THEN
    RAISE EXCEPTION 'FAIL: archiving a won submission forgot which quote won';
  END IF;

  -- ---------- Lost and archived close every open quote request ----------
  PERFORM pg_temp.move(advisor, l, 'under_review', 'ready_for_market');
  l_trinet := (pg_temp.send(advisor, l, 'TriNet') ->> 'id')::bigint;
  l_tri := (pg_temp.send(advisor, l, 'Rippling') ->> 'id')::bigint;
  PERFORM pg_temp.answer(advisor, l_tri, 'quoted', expires => '2026-11-25', fee => 120);
  PERFORM pg_temp.move(advisor, l, 'lost');
  IF (pg_temp.qr(l_trinet)).status <> 'closed' OR (pg_temp.qr(l_tri)).status <> 'closed' THEN
    RAISE EXCEPTION 'FAIL: losing left an open quote request';
  END IF;
  -- Archiving the lost file and reopening it doesn't reopen them; a new send does.
  PERFORM pg_temp.move(advisor, l, 'archived', 'submitted', 'under_review', 'ready_for_market');
  IF (pg_temp.qr(l_trinet)).status <> 'closed' THEN RAISE EXCEPTION 'FAIL: reopening the file reopened a quote request'; END IF;
  PERFORM pg_temp.send(advisor, l, 'TriNet');
  IF (pg_temp.qr(l_trinet)).status <> 'sent' OR (SELECT count(*) FROM public.quote_requests WHERE session_id = l) <> 2 THEN
    RAISE EXCEPTION 'FAIL: sending the reopened file to TriNet didn''t reopen its quote request';
  END IF;
  -- Archiving an open file closes them too.
  PERFORM pg_temp.move(advisor, l, 'archived');
  IF (pg_temp.qr(l_trinet)).status <> 'closed' THEN RAISE EXCEPTION 'FAIL: archiving left an open quote request'; END IF;
  -- A newer version doesn't flag a PEO whose quote request is closed.
  PERFORM pg_temp.recertify(l, 20);
  IF (pg_temp.run(advisor, 'SELECT to_jsonb(q.sent_older_version) FROM public.advisor_list_submissions(p_search => ''Lost Co'') q'))::boolean THEN
    RAISE EXCEPTION 'FAIL: a closed quote request was flagged as sent an older version';
  END IF;

  -- ---------- The queue ----------
  SELECT * INTO row FROM jsonb_to_record(pg_temp.run(advisor,
    'SELECT to_jsonb(q) FROM public.advisor_list_submissions(p_search => ''Won Co'') q')) AS x(
      quote_requests_sent integer, quotes_received integer, oldest_waiting_on date, earliest_quote_expires_on date,
      sent_older_version boolean, start_month text);
  IF row.quote_requests_sent IS DISTINCT FROM 2 OR row.quotes_received IS DISTINCT FROM 1 OR row.oldest_waiting_on IS NOT NULL
     OR row.earliest_quote_expires_on IS DISTINCT FROM '2026-12-14' OR row.sent_older_version IS DISTINCT FROM false
     OR row.start_month IS DISTINCT FROM 'April' THEN
    RAISE EXCEPTION 'FAIL: the queue showed Won Co''s quote requests as %', row;
  END IF;

  -- Alpha Co certifies a third version after TriNet was sent the second.
  PERFORM pg_temp.recertify(a, 16);
  SELECT * INTO row FROM jsonb_to_record(pg_temp.run(advisor,
    'SELECT to_jsonb(q) FROM public.advisor_list_submissions(p_search => ''Alpha Co'') q')) AS x(
      quote_requests_sent integer, oldest_waiting_on date, sent_older_version boolean);
  IF row.quote_requests_sent IS DISTINCT FROM 1 OR row.oldest_waiting_on IS DISTINCT FROM '2026-11-20' OR row.sent_older_version IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: the queue showed Alpha Co''s quote requests as %', row;
  END IF;

  -- "Waiting on a PEO" lists only the submissions with a quote request sent and unanswered.
  IF pg_temp.run(advisor, 'SELECT jsonb_agg(q.company_name ORDER BY q.company_name) FROM public.advisor_list_submissions(p_waiting => true) q')
     IS DISTINCT FROM '["Alpha Co"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: waiting on a PEO listed %',
      pg_temp.run(advisor, 'SELECT jsonb_agg(q.company_name) FROM public.advisor_list_submissions(p_waiting => true) q');
  END IF;

  -- Sorting by the longest wait puts the earliest unanswered send first, whatever the default order says.
  PERFORM pg_temp.move(advisor, b, 'under_review', 'ready_for_market');
  PERFORM pg_temp.send(advisor, b, 'Insperity', '2026-11-01');
  PERFORM pg_temp.recertify(a, 17);
  IF pg_temp.run(advisor, 'SELECT jsonb_agg(q.company_name) FROM public.advisor_list_submissions(p_waiting => true, p_sort => ''oldest_waiting'') q')
     IS DISTINCT FROM '["Beta Co", "Alpha Co"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: sorted by the longest wait, the queue was %',
      pg_temp.run(advisor, 'SELECT jsonb_agg(q.company_name) FROM public.advisor_list_submissions(p_waiting => true, p_sort => ''oldest_waiting'') q');
  END IF;

  -- Sorting by the earliest expiry puts the quote that runs out soonest first.
  PERFORM pg_temp.answer(advisor, (SELECT id FROM public.quote_requests WHERE session_id = b), 'quoted', expires => '2026-12-01', fee => 160);
  IF pg_temp.run(advisor, 'SELECT jsonb_agg(q.company_name) FROM (SELECT * FROM public.advisor_list_submissions(p_sort => ''earliest_expiry'', p_limit => 2)) q')
     IS DISTINCT FROM '["Beta Co", "Won Co"]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: sorted by the earliest expiry, the queue began %',
      pg_temp.run(advisor, 'SELECT jsonb_agg(q.company_name) FROM public.advisor_list_submissions(p_sort => ''earliest_expiry'', p_limit => 2) q');
  END IF;
  PERFORM pg_temp.must_raise(advisor, 'SELECT * FROM public.advisor_list_submissions(p_sort => ''company'')', '22023', 'a sort the queue doesn''t offer');

  RAISE NOTICE 'quote_requests: all cases passed';
END $$;

-- ---------- Deleting an intake deletes its quote requests and their history ----------
DO $$
DECLARE
  advisor uuid := (SELECT user_id FROM public.user_roles WHERE role = 'advisor' LIMIT 1);
  del uuid := pg_temp.new_intake('Deleted Co');
  q bigint;
  d uuid;
  removed jsonb;
BEGIN
  PERFORM pg_temp.move(advisor, del, 'under_review', 'ready_for_market', 'sent_to_carrier');
  q := (pg_temp.send(advisor, del, 'TriNet') ->> 'id')::bigint;
  PERFORM pg_temp.answer(advisor, q, 'quoted', fee => 150);
  PERFORM pg_temp.move(advisor, del, 'quoted');
  PERFORM pg_temp.run(advisor, format('SELECT to_jsonb(public.set_submission_status(%L, ''won'', NULL, %s))', del, q));
  PERFORM pg_temp.run(advisor, format('SELECT public.advisor_note_underwriter_question(%s, ''Loss runs?'')', q));
  PERFORM set_config('request.jwt.claims', '', false);

  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status)
  VALUES (del, (SELECT user_id FROM public.chamber_sessions WHERE id = del), 'request', 'x', 'claimed') RETURNING id INTO d;
  SET LOCAL ROLE service_role;
  removed := public.complete_intake_deletion(d, 0);
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.quote_requests WHERE session_id = del) OR EXISTS (SELECT 1 FROM public.quote_request_events WHERE session_id = del) THEN
    RAISE EXCEPTION 'FAIL: the deleted intake''s quote requests remain';
  END IF;
  IF (removed ->> 'quote_requests')::int IS DISTINCT FROM 1 OR (removed ->> 'quote_request_events')::int IS NULL THEN
    RAISE EXCEPTION 'FAIL: the deletion reported %', removed;
  END IF;
  RAISE NOTICE 'quote_requests: deletion cases passed';
END $$;
