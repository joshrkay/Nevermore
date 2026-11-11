-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quote_request_threads
-- The thread on the submission page (joshrkay/Nevermore#92 story M-3.4, 20261111120000_quote_request_threads.sql):
-- a quote request has "new PEO mail" when a person at the PEO wrote to it after any advisor last opened its thread,
-- and the queue counts those; an automatic reply, an advisor's own copied-in message and held mail never count;
-- opening is for the whole team, only through what the advisor was shown, and never moves backwards; only advisors
-- read the marks and only the function writes them; deleting an intake deletes them.
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
\i supabase/migrations/20261111090000_quote_request_notes.sql
\i supabase/migrations/20261111100000_quote_request_addresses.sql
\i supabase/migrations/20261111110000_quote_request_messages.sql
\i supabase/migrations/20261111120000_quote_request_threads.sql
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


-- Runs stmt as the service role (the receive-mail function) and returns its value as jsonb.
CREATE FUNCTION pg_temp.svc(stmt text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  SET LOCAL ROLE service_role;
  EXECUTE stmt INTO result;
  RESET ROLE;
  RETURN result;
END $$;

-- Runs stmt as the service role and fails the run unless it raises exactly `state`.
CREATE FUNCTION pg_temp.svc_must_raise(stmt text, state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE raised text := NULL;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  SET LOCAL ROLE service_role;
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    raised := SQLSTATE;
  END;
  RESET ROLE;
  IF raised IS NULL THEN RAISE EXCEPTION 'FAIL: % was allowed', label; END IF;
  IF raised <> state THEN RAISE EXCEPTION 'FAIL: % raised % instead of %', label, raised, state; END IF;
END $$;

-- A message to the given local parts, as the function receives it.
CREATE FUNCTION pg_temp.mail(id text, locals text[], from_addr text, to_addrs text[] DEFAULT '{}', auto boolean DEFAULT false,
    body text DEFAULT 'Hello') RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.svc(format(
    'SELECT public.record_inbound_mail(%L, %L::text[], %L, %L, %L::text[], %L::text[], %L, %L, false, %L::jsonb, %L, %L)',
    id, locals, from_addr, 'Sender', to_addrs, '{}'::text[], 'Re: Harbor Street', body, '{"message-id":"<x@y>"}', auto, '2026-11-10T15:00:00Z'));
$$;



-- A message at a fixed time, as record_inbound_mail records it, so what is "after" is under the test's control.
CREATE FUNCTION pg_temp.mail_at(id text, locals text[], from_addr text, at text, auto boolean DEFAULT false) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE mid bigint;
BEGIN
  mid := (pg_temp.mail(id, locals, from_addr, '{}', auto) ->> 'message_id')::bigint;
  UPDATE public.quote_request_messages SET recorded_at = at::timestamptz WHERE quote_request_messages.id = mid;
  RETURN mid;
END $$;

-- How many quote requests the queue says have new PEO mail, by company.
CREATE FUNCTION pg_temp.queue(who uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(who, 'SELECT jsonb_object_agg(q.company_name, q.new_peo_mail_requests) FROM public.advisor_list_submissions() q');
$$;

CREATE FUNCTION pg_temp.open_thread(who uuid, q bigint, seen text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.advisor_open_quote_request_thread(%s, %L)', q, seen));
$$;

DO $$
DECLARE
  advisor uuid := pg_temp.new_user();
  advisor2 uuid := pg_temp.new_user();
  a uuid := pg_temp.new_intake('Alpha Co');
  b uuid := pg_temp.new_intake('Beta Co');
  prospect uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = a);
  q bigint; q2 bigint; q3 bigint;
  la text; la2 text; lb text;
  m1 bigint; m5 bigint;
  res jsonb;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor'), (advisor2, 'advisor');
  PERFORM pg_temp.move(advisor, a, 'under_review', 'ready_for_market');
  PERFORM pg_temp.move(advisor, b, 'under_review', 'ready_for_market');
  q := (pg_temp.send(advisor, a, 'TriNet') ->> 'id')::bigint;
  q2 := (pg_temp.send(advisor, a, 'Justworks') ->> 'id')::bigint;
  q3 := (pg_temp.send(advisor, b, 'TriNet') ->> 'id')::bigint;
  la := (SELECT local_part FROM public.quote_request_addresses WHERE quote_request_id = q AND revoked_at IS NULL);
  la2 := (SELECT local_part FROM public.quote_request_addresses WHERE quote_request_id = q2 AND revoked_at IS NULL);
  lb := (SELECT local_part FROM public.quote_request_addresses WHERE quote_request_id = q3 AND revoked_at IS NULL);

  -- ---------- Mail that is not a person at the PEO writing never sets the mark ----------
  PERFORM pg_temp.mail_at('t_auto', ARRAY[la], 'ooo@trinet.example', '2026-01-01 10:00+00', auto => true);
  PERFORM pg_temp.mail_at('t_hand', ARRAY[la], advisor || '@example.test', '2026-01-01 10:01+00');
  PERFORM pg_temp.mail_at('t_held', ARRAY['eaa-2026-9999.nobody.0123456789abcdef'], 'stranger@example.test', '2026-01-01 10:02+00');
  IF pg_temp.queue(advisor) IS DISTINCT FROM '{"Alpha Co": 0, "Beta Co": 0}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: automatic, copied-in and held mail set the mark: %', pg_temp.queue(advisor);
  END IF;

  -- ---------- A person at the PEO writing sets it, and the queue counts the quote requests ----------
  m1 := pg_temp.mail_at('t_1', ARRAY[la], 'dana@trinet.example', '2026-01-01 11:00+00');
  IF pg_temp.queue(advisor) IS DISTINCT FROM '{"Alpha Co": 1, "Beta Co": 0}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: a PEO''s mail was counted as %', pg_temp.queue(advisor);
  END IF;
  PERFORM pg_temp.mail_at('t_2', ARRAY[la2], 'tomas@justworks.example', '2026-01-01 11:05+00');
  PERFORM pg_temp.mail_at('t_3', ARRAY[la], 'dana@trinet.example', '2026-01-01 11:06+00');
  IF pg_temp.queue(advisor) IS DISTINCT FROM '{"Alpha Co": 2, "Beta Co": 0}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: two quote requests with new mail, and a second message on one, were counted as %', pg_temp.queue(advisor);
  END IF;
  -- A closed quote request that still gets mail counts too: a late answer is still new.
  PERFORM pg_temp.answer(advisor, q3, 'closed', note => 'Withdrawn');
  PERFORM pg_temp.mail_at('t_4', ARRAY[lb], 'priya@trinet.example', '2026-01-01 11:10+00');
  IF pg_temp.queue(advisor) IS DISTINCT FROM '{"Alpha Co": 2, "Beta Co": 1}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: mail on a closed quote request was counted as %', pg_temp.queue(advisor);
  END IF;

  -- ---------- Opening a thread clears it, for the whole team ----------
  res := pg_temp.open_thread(advisor, q, '2026-01-01 11:06+00');
  IF (res ->> 'last_opened_by')::uuid <> advisor OR (res ->> 'last_opened_by_email') <> advisor || '@example.test' THEN
    RAISE EXCEPTION 'FAIL: the open was recorded as %', res;
  END IF;
  IF pg_temp.queue(advisor) IS DISTINCT FROM '{"Alpha Co": 1, "Beta Co": 1}'::jsonb OR pg_temp.queue(advisor2) IS DISTINCT FROM pg_temp.queue(advisor) THEN
    RAISE EXCEPTION 'FAIL: after one advisor opened a thread the queue says % and, to a colleague, %', pg_temp.queue(advisor), pg_temp.queue(advisor2);
  END IF;
  -- A colleague opens the other: Alpha Co has none left.
  PERFORM pg_temp.open_thread(advisor2, q2, '2026-01-01 11:05+00');
  IF pg_temp.queue(advisor) IS DISTINCT FROM '{"Alpha Co": 0, "Beta Co": 1}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: a colleague''s open left %', pg_temp.queue(advisor);
  END IF;

  -- ---------- Mail that arrives after the page loaded stays new ----------
  m5 := pg_temp.mail_at('t_5', ARRAY[la], 'dana@trinet.example', '2026-01-01 12:00+00');
  IF pg_temp.queue(advisor) IS DISTINCT FROM '{"Alpha Co": 1, "Beta Co": 1}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: mail after the last open was counted as %', pg_temp.queue(advisor);
  END IF;
  -- Opening a page that was loaded before t_5 arrived (it showed mail through 11:30) doesn't clear it.
  PERFORM pg_temp.open_thread(advisor, q, '2026-01-01 11:30+00');
  IF pg_temp.queue(advisor) IS DISTINCT FROM '{"Alpha Co": 1, "Beta Co": 1}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: an open through 11:30 cleared mail from 12:00: %', pg_temp.queue(advisor);
  END IF;
  -- It never moves backwards: an open through 11:00 after one through 11:30 leaves 11:30.
  PERFORM pg_temp.open_thread(advisor, q, '2026-01-01 11:00+00');
  IF (SELECT last_opened_at FROM public.quote_request_thread_reads WHERE quote_request_id = q) <> '2026-01-01 11:30+00'::timestamptz THEN
    RAISE EXCEPTION 'FAIL: an earlier open moved the mark back to %', (SELECT last_opened_at FROM public.quote_request_thread_reads WHERE quote_request_id = q);
  END IF;
  -- Through the time of that message it is read.
  PERFORM pg_temp.open_thread(advisor, q, '2026-01-01 12:00+00');
  IF pg_temp.queue(advisor) IS DISTINCT FROM '{"Alpha Co": 0, "Beta Co": 1}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: opening through the message left %', pg_temp.queue(advisor);
  END IF;
  -- With no time given it is now, which is after every message here, and never later than now.
  PERFORM pg_temp.open_thread(advisor, q3);
  PERFORM pg_temp.open_thread(advisor, q2, '2999-01-01 00:00+00');
  IF pg_temp.queue(advisor) IS DISTINCT FROM '{"Alpha Co": 0, "Beta Co": 0}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: opening with no time left %', pg_temp.queue(advisor);
  END IF;
  IF (SELECT last_opened_at FROM public.quote_request_thread_reads WHERE quote_request_id = q2) > now() THEN
    RAISE EXCEPTION 'FAIL: a thread was marked opened in the future';
  END IF;

  -- ---------- Who reads and writes ----------
  PERFORM pg_temp.must_raise(advisor, 'SELECT public.advisor_open_quote_request_thread(999999)', 'PT404', 'opening a thread of a quote request that doesn''t exist');
  PERFORM pg_temp.must_raise(prospect, format('SELECT public.advisor_open_quote_request_thread(%s)', q), '42501', 'a prospect opening a thread');
  IF pg_temp.count_as(advisor, 'public.quote_request_thread_reads') <> 3 THEN
    RAISE EXCEPTION 'FAIL: an advisor read % marks', pg_temp.count_as(advisor, 'public.quote_request_thread_reads');
  END IF;
  IF pg_temp.count_as(prospect, 'public.quote_request_thread_reads') <> 0 THEN
    RAISE EXCEPTION 'FAIL: the prospect read the marks on their own submission';
  END IF;
  PERFORM pg_temp.must_raise(advisor, format('INSERT INTO public.quote_request_thread_reads (quote_request_id, last_opened_at) VALUES (%s, now())', q), '42501', 'an advisor writing a mark directly');
  PERFORM pg_temp.must_raise(advisor, 'UPDATE public.quote_request_thread_reads SET last_opened_at = ''2000-01-01''', '42501', 'an advisor changing a mark');
  PERFORM pg_temp.must_raise(advisor, 'DELETE FROM public.quote_request_thread_reads', '42501', 'an advisor deleting a mark');

  -- The queue is otherwise what it was: the new column didn't disturb the quote columns.
  res := pg_temp.run(advisor, 'SELECT jsonb_agg(to_jsonb(q) - ''total_count'' ORDER BY q.company_name) FROM public.advisor_list_submissions(p_waiting => true) q');
  -- Only Alpha Co still waits on a PEO: Beta Co's one quote request is closed.
  IF jsonb_array_length(res) <> 1 OR (res -> 0 ->> 'company_name') <> 'Alpha Co' OR (res -> 0 ->> 'quote_requests_sent')::int <> 2
     OR (res -> 0 ->> 'oldest_waiting_on') <> '2026-11-10' THEN
    RAISE EXCEPTION 'FAIL: the queue''s quote columns changed: %', res;
  END IF;

  RAISE NOTICE 'quote_request_threads: all cases passed';
END $$;

-- ---------- Deleting an intake deletes its marks ----------
DO $$
DECLARE
  advisor uuid := (SELECT user_id FROM public.user_roles WHERE role = 'advisor' LIMIT 1);
  del uuid := pg_temp.new_intake('Deleted Co');
  q bigint; d uuid;
BEGIN
  PERFORM pg_temp.move(advisor, del, 'under_review', 'ready_for_market');
  q := (pg_temp.send(advisor, del, 'TriNet') ->> 'id')::bigint;
  PERFORM pg_temp.open_thread(advisor, q);
  PERFORM set_config('request.jwt.claims', '', false);
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_thread_reads WHERE quote_request_id = q) THEN RAISE EXCEPTION 'setup: no mark'; END IF;

  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status)
  VALUES (del, (SELECT user_id FROM public.chamber_sessions WHERE id = del), 'request', 'x', 'claimed') RETURNING id INTO d;
  SET LOCAL ROLE service_role;
  PERFORM public.complete_intake_deletion(d, 0);
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.quote_request_thread_reads WHERE quote_request_id = q) OR EXISTS (SELECT 1 FROM public.quote_requests WHERE id = q) THEN
    RAISE EXCEPTION 'FAIL: the deleted intake''s thread marks remain';
  END IF;
  RAISE NOTICE 'quote_request_threads: deletion cases passed';
END $$;
