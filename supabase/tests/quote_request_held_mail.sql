-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quote_request_held_mail
-- The holding list (joshrkay/Nevermore#92 story M-3.3, 20261111130000_held_mail.sql): an advisor moves a message off
-- a thread, an admin assigns a held message or discards it, a message nobody deals with is deleted after 30 days,
-- the files follow the message, the list stopping being empty raises one alert and not one per message, and
-- only the service role may call any of it.
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
\i supabase/migrations/20261111130000_held_mail.sql
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




-- Runs a held-mail function as the service role, as the held-mail function calls it.
CREATE FUNCTION pg_temp.plan_move(msg bigint, target bigint, actor uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.svc(format('SELECT public.plan_mail_move(%s, %L, %L)', msg, target, actor));
$$;
CREATE FUNCTION pg_temp.apply_move(msg bigint, target bigint, actor uuid, note text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.svc(format('SELECT public.apply_mail_move(%s, %L, %L, %L)', msg, target, actor, note));
$$;
CREATE FUNCTION pg_temp.held_count() RETURNS integer LANGUAGE sql AS $$
  SELECT count(*)::integer FROM public.quote_request_messages WHERE quote_request_id IS NULL;
$$;
CREATE FUNCTION pg_temp.alerts() RETURNS integer LANGUAGE sql AS $$
  SELECT count(*)::integer FROM public.ops_events WHERE kind = 'held_mail';
$$;

DO $$
DECLARE
  advisor uuid := pg_temp.new_user();
  admin uuid := pg_temp.new_user();
  nobody uuid := pg_temp.new_user();
  a uuid := pg_temp.new_intake('Alpha Co');
  b uuid := pg_temp.new_intake('Beta Co');
  q bigint; q2 bigint; q3 bigint;
  la text; lb text;
  m_on bigint; m_held bigint; m_held2 bigint;
  plan jsonb; res jsonb;
  att bigint;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor'), (admin, 'admin');
  PERFORM pg_temp.move(advisor, a, 'under_review', 'ready_for_market');
  PERFORM pg_temp.move(advisor, b, 'under_review', 'ready_for_market');
  q := (pg_temp.send(advisor, a, 'TriNet') ->> 'id')::bigint;
  q2 := (pg_temp.send(advisor, a, 'Justworks') ->> 'id')::bigint;
  q3 := (pg_temp.send(advisor, b, 'TriNet') ->> 'id')::bigint;
  la := (SELECT local_part FROM public.quote_request_addresses WHERE quote_request_id = q AND revoked_at IS NULL);
  lb := (SELECT local_part FROM public.quote_request_addresses WHERE quote_request_id = q3 AND revoked_at IS NULL);

  -- ---------- The list stops being empty: one alert, not one per message ----------
  IF pg_temp.held_count() <> 0 OR pg_temp.alerts() <> 0 THEN RAISE EXCEPTION 'FAIL: the list should start empty and quiet'; END IF;
  m_on := (pg_temp.mail('h_on', ARRAY[la], 'dana@trinet.example') ->> 'message_id')::bigint;
  IF pg_temp.alerts() <> 0 THEN RAISE EXCEPTION 'FAIL: mail on a thread raised the holding alert'; END IF;
  m_held := (pg_temp.mail('h_1', ARRAY['eaa-2026-9999.nobody.0123456789abcdef'], 'stranger@example.test') ->> 'message_id')::bigint;
  IF pg_temp.alerts() <> 1 THEN RAISE EXCEPTION 'FAIL: the first held message raised % alerts', pg_temp.alerts(); END IF;
  m_held2 := (pg_temp.mail('h_2', ARRAY['eaa-2026-9998.nobody.0123456789abcdef'], 'other@example.test') ->> 'message_id')::bigint;
  IF pg_temp.alerts() <> 1 THEN RAISE EXCEPTION 'FAIL: a second held message raised another alert (% in all)', pg_temp.alerts(); END IF;
  IF (SELECT held_at FROM public.quote_request_messages WHERE id = m_held) IS NULL THEN RAISE EXCEPTION 'FAIL: a held message has no held_at'; END IF;
  -- A replay of a held message records nothing new.
  PERFORM pg_temp.mail('h_1', ARRAY['eaa-2026-9999.nobody.0123456789abcdef'], 'stranger@example.test');
  IF pg_temp.alerts() <> 1 OR pg_temp.held_count() <> 2 THEN RAISE EXCEPTION 'FAIL: a replay changed the list'; END IF;
  -- The alert reaches the monitor: one event is enough for held_mail.
  IF NOT EXISTS (SELECT 1 FROM public.ops_alert_rules() r WHERE r.kind = 'held_mail' AND r.threshold = 1) THEN
    RAISE EXCEPTION 'FAIL: held_mail has no alert rule';
  END IF;

  -- ---------- Moving a message off a thread: an advisor, with the files following it ----------
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, content_type, size_bytes, status, scan_verdict, storage_bucket, storage_path)
  VALUES (m_on, 'att_a', 'proposal.pdf', 'application/pdf', 100, 'stored', 'clean', 'peo-mail',
          (SELECT session_id::text FROM public.quote_requests WHERE id = q) || '/' || m_on || '/1-proposal.pdf')
  RETURNING id INTO att;
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, content_type, size_bytes, status, not_kept_reason)
  VALUES (m_on, 'att_b', 'big.zip', 'application/zip', 100, 'not_kept', 'unsupported_type');

  PERFORM pg_temp.svc_must_raise(format('SELECT public.plan_mail_move(%s, NULL, %L)', m_on, nobody), '42501', 'a stranger planning a move off');
  PERFORM pg_temp.svc_must_raise(format('SELECT public.plan_mail_move(%s, NULL, NULL)', m_on), '42501', 'a move off with no one named');
  PERFORM pg_temp.svc_must_raise(format('SELECT public.plan_mail_move(%s, NULL, %L)', m_held, advisor), '55000', 'moving off a message that is already held');
  plan := pg_temp.plan_move(m_on, NULL, advisor);
  IF jsonb_array_length(plan -> 'moves') <> 1 OR (plan -> 'moves' -> 0 ->> 'to') <> 'held/' || m_on || '/1-proposal.pdf' THEN
    RAISE EXCEPTION 'FAIL: the plan to move the files off is %', plan;
  END IF;
  IF (SELECT storage_path FROM public.quote_request_message_attachments WHERE id = att) NOT LIKE '%/' || m_on || '/1-proposal.pdf'
     OR (SELECT quote_request_id FROM public.quote_request_messages WHERE id = m_on) IS NULL THEN
    RAISE EXCEPTION 'FAIL: planning changed something';
  END IF;
  PERFORM pg_temp.svc_must_raise(format('SELECT public.apply_mail_move(%s, NULL, %L, NULL)', m_on, nobody), '42501', 'a stranger moving a message off');
  res := pg_temp.apply_move(m_on, NULL, advisor, 'This is Justworks answering on the TriNet address.');
  IF (res ->> 'held')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: the move result is %', res; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_messages m WHERE m.id = m_on AND m.quote_request_id IS NULL AND m.session_id IS NULL
       AND m.held_reason = 'moved_by_advisor' AND m.held_at IS NOT NULL AND m.moved_by = advisor AND m.moved_from_quote_request_id = q
       AND m.moved_note LIKE 'This is Justworks%' AND m.moved_by_email = advisor || '@example.test') THEN
    RAISE EXCEPTION 'FAIL: the moved message is %', (SELECT to_jsonb(m) FROM public.quote_request_messages m WHERE m.id = m_on);
  END IF;
  IF (SELECT storage_path FROM public.quote_request_message_attachments WHERE id = att) <> 'held/' || m_on || '/1-proposal.pdf' THEN
    RAISE EXCEPTION 'FAIL: the file path did not follow the message';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_events e WHERE e.quote_request_id = q AND e.field = 'mail_moved_off' AND e.new_value = m_on::text AND e.changed_by = advisor) THEN
    RAISE EXCEPTION 'FAIL: the move was not logged on the quote request';
  END IF;
  -- Moving into a list that already holds mail raises nothing more.
  IF pg_temp.alerts() <> 1 THEN RAISE EXCEPTION 'FAIL: a move into a non-empty list alerted (% in all)', pg_temp.alerts(); END IF;
  -- A message can't be moved off twice.
  PERFORM pg_temp.svc_must_raise(format('SELECT public.apply_mail_move(%s, NULL, %L, NULL)', m_on, advisor), '55000', 'moving a held message off again');
  -- The moved message is now an admin's to read, not an advisor's.
  IF pg_temp.count_as(advisor, 'public.quote_request_messages WHERE id = ' || m_on) <> 0 OR pg_temp.count_as(admin, 'public.quote_request_messages WHERE id = ' || m_on) <> 1 THEN
    RAISE EXCEPTION 'FAIL: who can read the moved message is wrong';
  END IF;

  -- ---------- Assigning: an admin only, to a quote request that exists ----------
  PERFORM pg_temp.svc_must_raise(format('SELECT public.plan_mail_move(%s, %s, %L)', m_on, q2, advisor), '42501', 'an advisor assigning');
  PERFORM pg_temp.svc_must_raise(format('SELECT public.apply_mail_move(%s, %s, %L, NULL)', m_on, q2, advisor), '42501', 'an advisor applying an assignment');
  PERFORM pg_temp.svc_must_raise(format('SELECT public.plan_mail_move(%s, 999999, %L)', m_on, admin), 'PT404', 'assigning to a quote request that does not exist');

  -- Plan the assignment: the files go to the intake the message joins.
  plan := pg_temp.plan_move(m_on, q2, admin);
  IF (plan -> 'moves' -> 0 ->> 'to') <> (SELECT session_id::text FROM public.quote_requests WHERE id = q2) || '/' || m_on || '/1-proposal.pdf' THEN
    RAISE EXCEPTION 'FAIL: the plan to assign the files is %', plan;
  END IF;
  res := pg_temp.apply_move(m_on, q2, admin);
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_messages m WHERE m.id = m_on AND m.quote_request_id = q2
       AND m.session_id = (SELECT session_id FROM public.quote_requests WHERE id = q2) AND m.held_reason IS NULL AND m.held_at IS NULL
       AND m.moved_by IS NULL AND m.moved_note IS NULL AND m.moved_from_quote_request_id IS NULL) THEN
    RAISE EXCEPTION 'FAIL: the assigned message is %', (SELECT to_jsonb(m) FROM public.quote_request_messages m WHERE m.id = m_on);
  END IF;
  IF (SELECT storage_path FROM public.quote_request_message_attachments WHERE id = att)
     <> (SELECT session_id::text FROM public.quote_requests WHERE id = q2) || '/' || m_on || '/1-proposal.pdf' THEN
    RAISE EXCEPTION 'FAIL: the file path did not follow the assignment';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_events e WHERE e.quote_request_id = q2 AND e.field = 'mail_assigned' AND e.new_value = m_on::text AND e.changed_by = admin) THEN
    RAISE EXCEPTION 'FAIL: the assignment was not logged';
  END IF;
  -- A message that is on a thread can't be assigned again, and an assignment never changes a status.
  PERFORM pg_temp.svc_must_raise(format('SELECT public.apply_mail_move(%s, %s, %L, NULL)', m_on, q, admin), '55000', 'assigning a message that is on a thread');
  IF (SELECT status FROM public.quote_requests WHERE id = q2) <> 'sent' THEN RAISE EXCEPTION 'FAIL: an assignment changed the status'; END IF;
  -- The attachment that was never kept still lists, untouched.
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_message_attachments WHERE message_id = m_on AND status = 'not_kept' AND storage_path IS NULL) THEN
    RAISE EXCEPTION 'FAIL: the not-kept attachment changed';
  END IF;

  -- ---------- Discarding: an admin only; the files go first, then the rows ----------
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, content_type, size_bytes, status, scan_verdict, storage_bucket, storage_path)
  VALUES (m_held, 'att_c', 'offer.pdf', 'application/pdf', 100, 'stored', 'clean', 'peo-mail', 'held/' || m_held || '/1-offer.pdf');
  INSERT INTO storage.objects (bucket_id, name) VALUES ('peo-mail', 'held/' || m_held || '/1-offer.pdf');
  PERFORM pg_temp.svc_must_raise(format('SELECT public.plan_held_mail_discard(%s, %L)', m_held, advisor), '42501', 'an advisor discarding');
  PERFORM pg_temp.svc_must_raise(format('SELECT public.plan_held_mail_discard(%s, %L)', m_on, admin), '55000', 'discarding a message that is on a thread');
  plan := pg_temp.svc(format('SELECT public.plan_held_mail_discard(%s, %L)', m_held, admin));
  IF plan -> 'paths' ->> 0 <> 'held/' || m_held || '/1-offer.pdf' THEN RAISE EXCEPTION 'FAIL: the discard plan is %', plan; END IF;
  PERFORM pg_temp.svc_must_raise(format('SELECT public.finish_held_mail_discard(%s, %L)', m_held, admin), 'EA006', 'discarding while its file is still stored');
  DELETE FROM storage.objects WHERE bucket_id = 'peo-mail' AND name = 'held/' || m_held || '/1-offer.pdf';
  PERFORM pg_temp.svc_must_raise(format('SELECT public.finish_held_mail_discard(%s, %L)', m_held, advisor), '42501', 'an advisor finishing a discard');
  res := pg_temp.svc(format('SELECT public.finish_held_mail_discard(%s, %L)', m_held, admin));
  IF (res ->> 'deleted')::boolean IS NOT TRUE OR EXISTS (SELECT 1 FROM public.quote_request_messages WHERE id = m_held)
     OR EXISTS (SELECT 1 FROM public.quote_request_message_attachments WHERE message_id = m_held) THEN
    RAISE EXCEPTION 'FAIL: the discard left rows: %', res;
  END IF;
  -- Doing it again is harmless.
  IF (pg_temp.svc(format('SELECT public.finish_held_mail_discard(%s, %L)', m_held, admin)) ->> 'deleted')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: discarding twice reported a deletion';
  END IF;

  -- ---------- Thirty days, and no more ----------
  IF EXISTS (SELECT 1 FROM public.held_mail_due()) THEN RAISE EXCEPTION 'FAIL: fresh mail is due'; END IF;
  PERFORM pg_temp.svc_must_raise(format('SELECT public.plan_held_mail_discard(%s, NULL)', m_held2), '55000', 'expiring mail held for a day');
  UPDATE public.quote_request_messages SET held_at = now() - interval '29 days 23 hours' WHERE id = m_held2;
  IF EXISTS (SELECT 1 FROM public.held_mail_due()) THEN RAISE EXCEPTION 'FAIL: mail held 29 days 23 hours is due'; END IF;
  UPDATE public.quote_request_messages SET held_at = now() - interval '30 days 1 hour' WHERE id = m_held2;
  IF (SELECT array_agg(message_id) FROM public.held_mail_due()) IS DISTINCT FROM ARRAY[m_held2] THEN
    RAISE EXCEPTION 'FAIL: the mail due is %', (SELECT array_agg(message_id) FROM public.held_mail_due());
  END IF;
  -- The schedule never reaches a message that is on a thread, however old.
  UPDATE public.quote_request_messages SET recorded_at = now() - interval '90 days' WHERE id = m_on;
  PERFORM pg_temp.svc_must_raise(format('SELECT public.plan_held_mail_discard(%s, NULL)', m_on), '55000', 'expiring a message on a thread');
  PERFORM pg_temp.svc(format('SELECT public.plan_held_mail_discard(%s, NULL)', m_held2));
  PERFORM pg_temp.svc(format('SELECT public.finish_held_mail_discard(%s, NULL)', m_held2));
  IF pg_temp.held_count() <> 0 THEN RAISE EXCEPTION 'FAIL: the list should be empty, holds %', pg_temp.held_count(); END IF;

  -- ---------- Empty again, then not: the alert is raised again ----------
  PERFORM pg_temp.mail('h_3', ARRAY['eaa-2026-9997.nobody.0123456789abcdef'], 'third@example.test');
  IF pg_temp.alerts() <> 2 THEN RAISE EXCEPTION 'FAIL: the list stopping being empty again raised % alerts in all', pg_temp.alerts(); END IF;

  -- ---------- Only the service role calls any of it ----------
  PERFORM pg_temp.must_raise(admin, format('SELECT public.apply_mail_move(%s, %s, %L, NULL)', m_on, q, admin), '42501', 'an admin calling apply directly');
  PERFORM pg_temp.must_raise(advisor, format('SELECT public.plan_mail_move(%s, NULL, %L)', m_on, advisor), '42501', 'an advisor calling plan directly');
  PERFORM pg_temp.must_raise(admin, 'SELECT public.held_mail_due()', '42501', 'an admin calling held_mail_due');
  PERFORM pg_temp.must_raise(admin, format('SELECT public.finish_held_mail_discard(1, %L)', admin), '42501', 'an admin calling finish directly');
  PERFORM pg_temp.must_raise(admin, format('SELECT public.held_mail_actor_has(%L, %L)', admin, 'admin'), '42501', 'an admin probing roles');

  -- ---------- Deleting an intake does not leave moved mail behind, and a held message is not an intake's ----------
  IF EXISTS (SELECT 1 FROM public.quote_request_messages WHERE quote_request_id IS NOT NULL AND session_id IS NULL) THEN
    RAISE EXCEPTION 'FAIL: a message is on a quote request with no intake';
  END IF;

  RAISE NOTICE 'quote_request_held_mail: all checks passed';
END $$;
