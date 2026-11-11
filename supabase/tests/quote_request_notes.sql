-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quote_request_notes
-- Quote request notes (joshrkay/Nevermore#92 story M-2.5, 20261111090000_quote_request_notes.sql): an advisor
-- adds a dated note of some kind to a quote request for what happened outside the product. A note changes nothing
-- else and can be added to a closed quote request; a correction is logged with the old value; the underwriters'
-- questions recorded before the migration become notes; deleting an intake deletes its notes. Prospects see none.
-- The migration is loaded after a question is recorded the old way, to test that it is carried over.
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


-- ---------- Before the migration: a question recorded the old way ----------
CREATE TABLE pg_temp.before (advisor uuid, intake uuid, prospect uuid, request bigint);
DO $$
DECLARE
  advisor uuid := pg_temp.new_user();
  a uuid := pg_temp.new_intake('Alpha Co');
  q bigint;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');
  PERFORM pg_temp.move(advisor, a, 'under_review', 'ready_for_market');
  q := (pg_temp.send(advisor, a, 'TriNet') ->> 'id')::bigint;
  PERFORM pg_temp.run(advisor, format('SELECT public.advisor_note_underwriter_question(%s, %L)', q, '  Can they send last year''s loss runs?  '));
  INSERT INTO pg_temp.before VALUES (advisor, a, (SELECT user_id FROM public.chamber_sessions WHERE id = a), q);
END $$;

\i supabase/migrations/20261111090000_quote_request_notes.sql

CREATE FUNCTION pg_temp.add_note(advisor uuid, id bigint, kind text, noted_on date, body text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(advisor, format('SELECT public.advisor_add_quote_request_note(%s, %L, %L, %L)', id, kind, noted_on, body));
$$;

CREATE FUNCTION pg_temp.correct_note(advisor uuid, id bigint, kind text, noted_on date, body text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(advisor, format('SELECT public.advisor_correct_quote_request_note(%s, %L, %L, %L)', id, kind, noted_on, body));
$$;

DO $$
DECLARE
  advisor uuid := (SELECT b.advisor FROM pg_temp.before b);
  a uuid := (SELECT b.intake FROM pg_temp.before b);
  prospect uuid := (SELECT b.prospect FROM pg_temp.before b);
  q bigint := (SELECT b.request FROM pg_temp.before b);
  other_advisor uuid := pg_temp.new_user();
  before_row public.quote_requests := pg_temp.qr(q);
  note public.quote_request_notes;
  result jsonb;
  n integer;
  events_before integer;
  kind text;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (other_advisor, 'advisor');

  -- ---------- The question recorded before the migration is a note now ----------
  SELECT * INTO note FROM public.quote_request_notes WHERE quote_request_id = q;
  IF NOT FOUND OR note.kind <> 'underwriter_question' OR note.body <> 'Can they send last year''s loss runs?'
     OR note.session_id IS DISTINCT FROM a OR note.created_by IS DISTINCT FROM advisor
     OR note.noted_on IS DISTINCT FROM (SELECT (e.changed_at AT TIME ZONE 'UTC')::date FROM public.quote_request_events e
                                         WHERE e.quote_request_id = q AND e.field = 'underwriter_question') THEN
    RAISE EXCEPTION 'FAIL: the earlier question became %', to_jsonb(note);
  END IF;
  IF (SELECT count(*) FROM public.quote_request_events e WHERE e.quote_request_id = q AND e.field = 'underwriter_question') <> 1 THEN
    RAISE EXCEPTION 'FAIL: the log lost or repeated the earlier question';
  END IF;

  -- ---------- Adding a note, of every kind ----------
  SELECT count(*) INTO events_before FROM public.quote_request_events WHERE quote_request_id = q;
  result := pg_temp.add_note(advisor, q, 'call', '2026-11-09', '  Dana called: underwriting wants loss runs.  ');
  SELECT * INTO note FROM public.quote_request_notes WHERE id = (result ->> 'id')::bigint;
  IF note.quote_request_id <> q OR note.session_id IS DISTINCT FROM a OR note.kind <> 'call' OR note.noted_on <> '2026-11-09'
     OR note.body <> 'Dana called: underwriting wants loss runs.' OR note.created_by IS DISTINCT FROM advisor
     OR note.created_by_email IS DISTINCT FROM advisor || '@example.test' THEN
    RAISE EXCEPTION 'FAIL: the note was saved as %', to_jsonb(note);
  END IF;
  FOREACH kind IN ARRAY ARRAY['portal_entry', 'email_elsewhere', 'underwriter_question', 'other'] LOOP
    PERFORM pg_temp.add_note(advisor, q, kind, '2026-11-10', 'A ' || kind);
  END LOOP;
  -- Today in a time zone ahead of the server's is allowed; the day after is not.
  PERFORM pg_temp.add_note(advisor, q, 'call', current_date + 1, 'Recorded east of UTC');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_add_quote_request_note(%s, ''call'', %L, ''Later'')', q, current_date + 2), '22023', 'a note dated in the future');

  -- A note changes nothing else: not the status, the send, the version, or the quote request's log.
  IF to_jsonb(pg_temp.qr(q)) IS DISTINCT FROM to_jsonb(before_row) THEN
    RAISE EXCEPTION 'FAIL: adding notes changed the quote request to %', to_jsonb(pg_temp.qr(q));
  END IF;
  IF (SELECT count(*) FROM public.quote_request_events WHERE quote_request_id = q) <> events_before THEN
    RAISE EXCEPTION 'FAIL: adding a note wrote to the change log';
  END IF;

  -- ---------- What a note can't be ----------
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_add_quote_request_note(%s, ''meeting'', ''2026-11-09'', ''x'')', q), '22023', 'a kind that isn''t listed');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_add_quote_request_note(%s, NULL, ''2026-11-09'', ''x'')', q), '22023', 'a note with no kind');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_add_quote_request_note(%s, ''call'', ''2026-11-09'', ''   '')', q), '22023', 'an empty note');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_add_quote_request_note(%s, ''call'', ''2026-11-09'', %L)', q, repeat('x', 2001)), '22023', 'a note over 2000 characters');
  PERFORM pg_temp.add_note(advisor, q, 'other', '2026-11-09', repeat('x', 2000));
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_add_quote_request_note(%s, ''call'', NULL, ''x'')', q), '22023', 'a note with no date');
  PERFORM pg_temp.must_raise(advisor, 'SELECT public.advisor_add_quote_request_note(999999, ''call'', ''2026-11-09'', ''x'')', 'PT404', 'a note on a quote request that doesn''t exist');
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.advisor_add_quote_request_note(%s, ''call'', ''2026-11-09'', ''x'')', q), '42501', 'a prospect adding a note');

  -- ---------- Correcting a note logs each value changed, with the old one ----------
  result := pg_temp.correct_note(other_advisor, note.id, 'call', '2026-11-08', 'Dana called: underwriting wants three years of loss runs.');
  IF (result ->> 'noted_on') <> '2026-11-08' OR (result ->> 'body') NOT LIKE '%three years%' OR (result ->> 'created_by')::uuid IS DISTINCT FROM advisor THEN
    RAISE EXCEPTION 'FAIL: the corrected note is %', result;
  END IF;
  IF (SELECT jsonb_object_agg(e.field, jsonb_build_array(e.old_value, e.new_value, e.changed_by))
      FROM public.quote_request_events e WHERE e.note_id = note.id) IS DISTINCT FROM jsonb_build_object(
        'note_noted_on', jsonb_build_array('2026-11-09', '2026-11-08', other_advisor),
        'note_body', jsonb_build_array('Dana called: underwriting wants loss runs.', 'Dana called: underwriting wants three years of loss runs.', other_advisor)) THEN
    RAISE EXCEPTION 'FAIL: the correction was logged as %',
      (SELECT jsonb_agg(to_jsonb(e)) FROM public.quote_request_events e WHERE e.note_id = note.id);
  END IF;
  -- The same values again log nothing; a changed kind logs one row.
  PERFORM pg_temp.correct_note(advisor, note.id, 'call', '2026-11-08', 'Dana called: underwriting wants three years of loss runs.');
  PERFORM pg_temp.correct_note(advisor, note.id, 'portal_entry', '2026-11-08', 'Dana called: underwriting wants three years of loss runs.');
  SELECT count(*) INTO n FROM public.quote_request_events e WHERE e.note_id = note.id;
  IF n <> 3 OR NOT EXISTS (SELECT 1 FROM public.quote_request_events e WHERE e.note_id = note.id AND e.field = 'note_kind' AND e.old_value = 'call' AND e.new_value = 'portal_entry') THEN
    RAISE EXCEPTION 'FAIL: after three corrections the log held % rows', n;
  END IF;
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_correct_quote_request_note(%s, ''meeting'', ''2026-11-08'', ''x'')', note.id), '22023', 'correcting to a kind that isn''t listed');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_correct_quote_request_note(%s, ''call'', ''2026-11-08'', '''')', note.id), '22023', 'correcting to an empty note');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_correct_quote_request_note(%s, ''call'', %L, ''x'')', note.id, current_date + 2), '22023', 'correcting to a future date');
  PERFORM pg_temp.must_raise(advisor, 'SELECT public.advisor_correct_quote_request_note(999999, ''call'', ''2026-11-08'', ''x'')', 'PT404', 'correcting a note that doesn''t exist');
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.advisor_correct_quote_request_note(%s, ''call'', ''2026-11-08'', ''x'')', note.id), '42501', 'a prospect correcting a note');
  -- The log of corrections can't be changed.
  PERFORM pg_temp.must_raise(advisor, format('UPDATE public.quote_request_events SET new_value = ''x'' WHERE note_id = %s', note.id), '42501', 'an advisor rewriting the log');

  -- ---------- A closed quote request still takes a note, and stays closed ----------
  PERFORM pg_temp.answer(advisor, q, 'closed', note => 'Withdrawn');
  PERFORM pg_temp.add_note(advisor, q, 'call', '2026-11-10', 'They phoned after we withdrew.');
  IF (pg_temp.qr(q)).status <> 'closed' THEN
    RAISE EXCEPTION 'FAIL: a note reopened a closed quote request';
  END IF;
  -- A note of an email sent elsewhere is not a send: only recording a send reopens it.
  PERFORM pg_temp.add_note(advisor, q, 'email_elsewhere', '2026-11-10', 'Sent the loss runs from my own mail.');
  IF (pg_temp.qr(q)).status <> 'closed' OR (pg_temp.qr(q)).sent_on <> before_row.sent_on THEN
    RAISE EXCEPTION 'FAIL: a note of an email changed the send';
  END IF;

  -- ---------- The function the earlier front end calls now adds a note ----------
  result := pg_temp.run(advisor, format('SELECT public.advisor_note_underwriter_question(%s, %L)', q, '  Who is the current carrier?  '));
  IF (result ->> 'kind') <> 'underwriter_question' OR (result ->> 'body') <> 'Who is the current carrier?' OR (result ->> 'noted_on')::date <> current_date THEN
    RAISE EXCEPTION 'FAIL: a question saved the old way became %', result;
  END IF;
  IF (SELECT count(*) FROM public.quote_request_events e WHERE e.quote_request_id = q AND e.field = 'underwriter_question') <> 1 THEN
    RAISE EXCEPTION 'FAIL: a question was still written to the log';
  END IF;
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.advisor_note_underwriter_question(%s, ''  '')', q), '22023', 'an empty question');
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.advisor_note_underwriter_question(%s, ''Why?'')', q), '42501', 'a prospect noting a question');

  -- ---------- Who reads and writes notes ----------
  IF pg_temp.count_as(advisor, 'public.quote_request_notes') < 9 THEN
    RAISE EXCEPTION 'FAIL: an advisor read % notes', pg_temp.count_as(advisor, 'public.quote_request_notes');
  END IF;
  IF pg_temp.count_as(prospect, 'public.quote_request_notes') <> 0 THEN
    RAISE EXCEPTION 'FAIL: the prospect read notes on their own submission';
  END IF;
  PERFORM pg_temp.must_raise(advisor, format('INSERT INTO public.quote_request_notes (quote_request_id, session_id, kind, noted_on, body) VALUES (%s, %L, ''call'', ''2026-11-09'', ''x'')', q, a), '42501', 'an advisor inserting a note directly');
  PERFORM pg_temp.must_raise(advisor, format('UPDATE public.quote_request_notes SET body = ''x'' WHERE id = %s', note.id), '42501', 'an advisor updating a note directly');
  PERFORM pg_temp.must_raise(advisor, format('DELETE FROM public.quote_request_notes WHERE id = %s', note.id), '42501', 'an advisor deleting a note');

  RAISE NOTICE 'quote_request_notes: all cases passed';
END $$;

-- ---------- Deleting an intake deletes its notes ----------
DO $$
DECLARE
  advisor uuid := (SELECT b.advisor FROM pg_temp.before b);
  del uuid := pg_temp.new_intake('Deleted Co');
  q bigint;
  d uuid;
  removed jsonb;
BEGIN
  PERFORM pg_temp.move(advisor, del, 'under_review', 'ready_for_market');
  q := (pg_temp.send(advisor, del, 'TriNet') ->> 'id')::bigint;
  PERFORM pg_temp.add_note(advisor, q, 'call', '2026-11-09', 'A call');
  PERFORM pg_temp.add_note(advisor, q, 'other', '2026-11-09', 'Another');
  PERFORM pg_temp.correct_note(advisor, (SELECT min(id) FROM public.quote_request_notes WHERE quote_request_id = q), 'call', '2026-11-08', 'A call');
  PERFORM set_config('request.jwt.claims', '', false);

  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status)
  VALUES (del, (SELECT user_id FROM public.chamber_sessions WHERE id = del), 'request', 'x', 'claimed') RETURNING id INTO d;
  SET LOCAL ROLE service_role;
  removed := public.complete_intake_deletion(d, 0);
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.quote_request_notes WHERE session_id = del)
     OR EXISTS (SELECT 1 FROM public.quote_request_events WHERE session_id = del)
     OR EXISTS (SELECT 1 FROM public.quote_requests WHERE session_id = del) THEN
    RAISE EXCEPTION 'FAIL: the deleted intake''s quote requests or notes remain';
  END IF;
  IF (removed ->> 'quote_request_notes')::int IS DISTINCT FROM 2 OR (removed ->> 'quote_requests')::int IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: the deletion reported %', removed;
  END IF;
  RAISE NOTICE 'quote_request_notes: deletion cases passed';
END $$;
