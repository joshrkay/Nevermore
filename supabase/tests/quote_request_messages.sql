-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quote_request_messages
-- Received PEO mail (joshrkay/Nevermore#92 story M-3.2, 20261111110000_quote_request_messages.sql): a message to a
-- quote request's reply address is recorded once however often it is replayed, marked as new, automatic or sent by
-- hand; mail to a revoked, unknown or ambiguous address is held, never attached by guess; an attachment is stored
-- only once scanned clean; a message never changes the quote request; only the service role writes; advisors read
-- what reached a quote request and admins read the held mail too; deleting an intake deletes its mail and files.
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

DO $$
DECLARE
  advisor uuid := pg_temp.new_user();
  admin uuid := pg_temp.new_user();
  a uuid := pg_temp.new_intake('Alpha Co');
  b uuid := pg_temp.new_intake('Beta Co');
  prospect uuid := (SELECT user_id FROM public.chamber_sessions WHERE id = a);
  q bigint; q2 bigint;
  local1 text; local2 text; old_local text;
  res jsonb;
  m public.quote_request_messages;
  att jsonb; att2 jsonb; att3 jsonb; att4 jsonb;
  before_row public.quote_requests;
  n integer;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor'), (admin, 'admin');
  PERFORM pg_temp.move(advisor, a, 'under_review', 'ready_for_market');
  PERFORM pg_temp.move(advisor, b, 'under_review', 'ready_for_market');
  q := (pg_temp.send(advisor, a, 'TriNet') ->> 'id')::bigint;
  q2 := (pg_temp.send(advisor, b, 'TriNet') ->> 'id')::bigint;
  local1 := (SELECT local_part FROM public.quote_request_addresses WHERE quote_request_id = q AND revoked_at IS NULL);
  local2 := (SELECT local_part FROM public.quote_request_addresses WHERE quote_request_id = q2 AND revoked_at IS NULL);
  before_row := pg_temp.qr(q);

  -- ---------- The advisor's own message, copied in, is sent by hand ----------
  res := pg_temp.mail('re_1', ARRAY[local1], advisor || '@example.test', ARRAY['dana@trinet.example']);
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (res ->> 'message_id')::bigint;
  IF (res ->> 'duplicate')::boolean OR (res ->> 'held')::boolean OR m.quote_request_id <> q OR m.session_id IS DISTINCT FROM a
     OR m.direction <> 'sent_by_hand' OR m.new_sender OR m.is_automatic OR m.address_local_part <> local1 THEN
    RAISE EXCEPTION 'FAIL: the advisor''s copied-in message was recorded as % (%)', to_jsonb(m), res;
  END IF;

  -- ---------- The PEO contact the advisor wrote to is not a new sender; a stranger is ----------
  res := pg_temp.mail('re_2', ARRAY[upper(local1)], 'Dana@Trinet.Example');
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (res ->> 'message_id')::bigint;
  IF m.quote_request_id <> q OR m.direction <> 'received' OR m.new_sender OR m.from_address <> 'dana@trinet.example'
     OR m.body_text <> 'Hello' OR m.subject <> 'Re: Harbor Street' OR m.headers ->> 'message-id' <> '<x@y>' THEN
    RAISE EXCEPTION 'FAIL: the contact''s reply was recorded as %', to_jsonb(m);
  END IF;
  res := pg_temp.mail('re_3', ARRAY[local1], 'priya.raman@trinet.example');
  IF NOT (SELECT new_sender FROM public.quote_request_messages WHERE id = (res ->> 'message_id')::bigint) THEN
    RAISE EXCEPTION 'FAIL: a sender never seen on the thread wasn''t marked new';
  END IF;
  res := pg_temp.mail('re_4', ARRAY[local1], 'priya.raman@trinet.example');
  IF (SELECT new_sender FROM public.quote_request_messages WHERE id = (res ->> 'message_id')::bigint) THEN
    RAISE EXCEPTION 'FAIL: a sender already on the thread was marked new again';
  END IF;
  -- An automatic reply is marked as one, and is never a new sender.
  res := pg_temp.mail('re_5', ARRAY[local1], 'ooo@elsewhere.example', auto => true);
  IF NOT (SELECT is_automatic AND NOT new_sender FROM public.quote_request_messages WHERE id = (res ->> 'message_id')::bigint) THEN
    RAISE EXCEPTION 'FAIL: an automatic reply wasn''t marked automatic';
  END IF;

  -- ---------- A replay records nothing new ----------
  res := pg_temp.mail('re_3', ARRAY[local1], 'someone.else@example.test', body => 'Changed');
  IF NOT (res ->> 'duplicate')::boolean OR (SELECT count(*) FROM public.quote_request_messages WHERE provider_message_id = 're_3') <> 1
     OR (SELECT body_text FROM public.quote_request_messages WHERE provider_message_id = 're_3') <> 'Hello' THEN
    RAISE EXCEPTION 'FAIL: a replayed message was recorded again: %', res;
  END IF;

  -- ---------- A message never changes the quote request; a closed one still receives ----------
  IF to_jsonb(pg_temp.qr(q)) IS DISTINCT FROM to_jsonb(before_row) THEN
    RAISE EXCEPTION 'FAIL: mail changed the quote request to %', to_jsonb(pg_temp.qr(q));
  END IF;
  PERFORM pg_temp.answer(advisor, q, 'closed', note => 'Withdrawn');
  res := pg_temp.mail('re_6', ARRAY[local1], 'dana@trinet.example', body => 'One more thing');
  IF (res ->> 'held')::boolean OR (pg_temp.qr(q)).status <> 'closed' THEN
    RAISE EXCEPTION 'FAIL: a closed quote request didn''t take mail, or mail reopened it: %', res;
  END IF;

  -- ---------- Held mail: revoked, unknown and ambiguous addresses ----------
  PERFORM pg_temp.run(advisor, format('SELECT public.advisor_reissue_quote_request_address(%s)', q));
  old_local := local1;
  local1 := (SELECT local_part FROM public.quote_request_addresses WHERE quote_request_id = q AND revoked_at IS NULL);
  res := pg_temp.mail('re_7', ARRAY[old_local], 'dana@trinet.example');
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (res ->> 'message_id')::bigint;
  IF NOT (res ->> 'held')::boolean OR m.held_reason <> 'revoked_address' OR m.quote_request_id IS NOT NULL OR m.session_id IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: mail to a revoked address was recorded as %', to_jsonb(m);
  END IF;
  res := pg_temp.mail('re_8', ARRAY['eaa-2026-9999.nobody.0123456789abcdef'], 'dana@trinet.example');
  IF NOT (res ->> 'held')::boolean OR (res ->> 'held_reason') <> 'unknown_address' THEN
    RAISE EXCEPTION 'FAIL: mail to an unknown address was recorded as %', res;
  END IF;
  res := pg_temp.mail('re_9', ARRAY[local1, local2], 'dana@trinet.example');
  IF NOT (res ->> 'held')::boolean OR (res ->> 'held_reason') <> 'ambiguous_address' OR (res ->> 'quote_request_id') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: mail to two quote requests'' addresses was recorded as %', res;
  END IF;
  -- A live address wins over a revoked one named beside it.
  res := pg_temp.mail('re_10', ARRAY[old_local, local1], 'dana@trinet.example');
  IF (res ->> 'held')::boolean OR (res ->> 'quote_request_id')::bigint <> q THEN
    RAISE EXCEPTION 'FAIL: a live address beside a revoked one didn''t win: %', res;
  END IF;
  -- No address of ours at all is unknown, not a crash.
  res := pg_temp.mail('re_11', ARRAY[]::text[], 'dana@trinet.example');
  IF NOT (res ->> 'held')::boolean OR (res ->> 'held_reason') <> 'unknown_address' THEN
    RAISE EXCEPTION 'FAIL: mail with no address of ours was recorded as %', res;
  END IF;

  PERFORM pg_temp.svc_must_raise(format('SELECT public.record_inbound_mail('''', %L::text[], ''a@b.example'', NULL, NULL, NULL, NULL, NULL, false, NULL, false, NULL)', ARRAY[local1]), '22023', 'a message with no provider id');
  PERFORM pg_temp.svc_must_raise(format('SELECT public.record_inbound_mail(''re_x'', %L::text[], '' '', NULL, NULL, NULL, NULL, NULL, false, NULL, false, NULL)', ARRAY[local1]), '22023', 'a message with no sender');
  PERFORM pg_temp.svc_must_raise(format('SELECT public.record_inbound_mail(''re_y'', %L::text[], ''a@b.example'', NULL, NULL, NULL, NULL, %L, false, NULL, false, NULL)', ARRAY[local1], repeat('x', 100001)), '23514', 'a body over the cap');

  -- ---------- Attachments ----------
  res := pg_temp.mail('re_12', ARRAY[local1], 'dana@trinet.example');
  n := (res ->> 'message_id')::int;
  att := pg_temp.svc(format('SELECT public.record_inbound_attachment(%s, ''att_1'', ''proposal.pdf'', ''application/pdf'', 412000)', n));
  IF att ->> 'status' <> 'pending' THEN RAISE EXCEPTION 'FAIL: a new attachment is %', att; END IF;
  IF pg_temp.svc(format('SELECT public.record_inbound_attachment(%s, ''att_1'', ''renamed.pdf'', ''application/pdf'', 1)', n)) ->> 'id' <> att ->> 'id' THEN
    RAISE EXCEPTION 'FAIL: a repeated attachment was recorded twice';
  END IF;
  IF (SELECT count(*) FROM public.quote_request_message_attachments WHERE message_id = n) <> 1 THEN RAISE EXCEPTION 'FAIL: a repeated attachment made a second row'; END IF;
  -- Stored only with its place in the peo-mail bucket.
  PERFORM pg_temp.svc_must_raise(format('SELECT public.finish_inbound_attachment(%s, ''clean'', NULL, ''documents'', ''x/y.pdf'')', att ->> 'id'), '22023', 'storing an attachment outside the peo-mail bucket');
  PERFORM pg_temp.svc_must_raise(format('SELECT public.finish_inbound_attachment(%s, ''clean'')', att ->> 'id'), '22023', 'storing an attachment with no path');
  PERFORM pg_temp.svc_must_raise(format('SELECT public.finish_inbound_attachment(%s, ''maybe'')', att ->> 'id'), '22023', 'settling with a verdict that doesn''t exist');
  IF (SELECT status FROM public.quote_request_message_attachments WHERE id = (att ->> 'id')::bigint) <> 'pending' THEN RAISE EXCEPTION 'FAIL: a refused settlement changed the attachment'; END IF;
  res := pg_temp.svc(format('SELECT public.finish_inbound_attachment(%s, ''clean'', NULL, ''peo-mail'', %L, ''abc'')', att ->> 'id', a || '/' || n || '/1-proposal.pdf'));
  IF res ->> 'status' <> 'stored' OR NOT (res ->> 'changed')::boolean THEN RAISE EXCEPTION 'FAIL: a clean attachment settled as %', res; END IF;
  -- A settled attachment doesn't change again.
  res := pg_temp.svc(format('SELECT public.finish_inbound_attachment(%s, ''infected'', ''Eicar'')', att ->> 'id'));
  IF res ->> 'status' <> 'stored' OR (res ->> 'changed')::boolean THEN RAISE EXCEPTION 'FAIL: a stored attachment was changed to %', res; END IF;
  -- Infected: blocked, with the signature and no path.
  att2 := pg_temp.svc(format('SELECT public.record_inbound_attachment(%s, ''att_2'', ''invoice.pdf'', ''application/pdf'', 100)', n));
  res := pg_temp.svc(format('SELECT public.finish_inbound_attachment(%s, ''infected'', ''Eicar-Test-Signature'')', att2 ->> 'id'));
  IF res ->> 'status' <> 'blocked' OR (SELECT scan_signature FROM public.quote_request_message_attachments WHERE id = (att2 ->> 'id')::bigint) <> 'Eicar-Test-Signature'
     OR (SELECT storage_path FROM public.quote_request_message_attachments WHERE id = (att2 ->> 'id')::bigint) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: an infected attachment settled as %', res;
  END IF;
  -- Not kept: listed with the reason, from the start or once its bytes show it isn't what it says.
  att3 := pg_temp.svc(format('SELECT public.record_inbound_attachment(%s, ''att_3'', ''rate-model.xlsm'', ''application/vnd.ms-excel'', 88000, ''unsupported_type'')', n));
  att4 := pg_temp.svc(format('SELECT public.record_inbound_attachment(%s, ''att_4'', ''notes.pdf'', ''application/pdf'', 5)', n));
  PERFORM pg_temp.svc(format('SELECT public.finish_inbound_attachment(%s, NULL, NULL, NULL, NULL, NULL, ''type_mismatch'')', att4 ->> 'id'));
  IF att3 ->> 'status' <> 'not_kept' OR (SELECT status FROM public.quote_request_message_attachments WHERE id = (att4 ->> 'id')::bigint) <> 'not_kept' THEN
    RAISE EXCEPTION 'FAIL: not-kept attachments are %, %', att3, att4;
  END IF;
  PERFORM pg_temp.svc_must_raise(format('SELECT public.record_inbound_attachment(%s, ''att_5'', ''x.pdf'', ''application/pdf'', 1, ''because'')', n), '23514', 'a not-kept reason that isn''t listed');
  PERFORM pg_temp.svc_must_raise('SELECT public.record_inbound_attachment(999999, ''att_1'', ''x.pdf'', ''application/pdf'', 1)', 'PT404', 'an attachment on a message that doesn''t exist');
  PERFORM pg_temp.svc_must_raise('SELECT public.finish_inbound_attachment(999999, ''clean'', NULL, ''peo-mail'', ''x'')', 'PT404', 'settling an attachment that doesn''t exist');

  -- ---------- Who reads and writes ----------
  IF pg_temp.count_as(advisor, 'public.quote_request_messages') <> (SELECT count(*) FROM public.quote_request_messages WHERE quote_request_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL: an advisor read % messages', pg_temp.count_as(advisor, 'public.quote_request_messages');
  END IF;
  IF pg_temp.count_as(admin, 'public.quote_request_messages') <> (SELECT count(*) FROM public.quote_request_messages) THEN
    RAISE EXCEPTION 'FAIL: an admin read % messages, not all, held ones included', pg_temp.count_as(admin, 'public.quote_request_messages');
  END IF;
  IF pg_temp.count_as(advisor, 'public.quote_request_messages WHERE held_reason IS NOT NULL') <> 0 THEN
    RAISE EXCEPTION 'FAIL: an advisor read held mail';
  END IF;
  IF pg_temp.count_as(advisor, 'public.quote_request_message_attachments') <> 4 THEN
    RAISE EXCEPTION 'FAIL: an advisor read % attachments', pg_temp.count_as(advisor, 'public.quote_request_message_attachments');
  END IF;
  IF pg_temp.count_as(prospect, 'public.quote_request_messages') <> 0 OR pg_temp.count_as(prospect, 'public.quote_request_message_attachments') <> 0 THEN
    RAISE EXCEPTION 'FAIL: the prospect read the mail on their own submission';
  END IF;
  PERFORM pg_temp.must_raise(advisor, format('INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address) VALUES (''z'', %s, %L, ''received'', ''a@b.example'')', q, a), '42501', 'an advisor inserting a message');
  PERFORM pg_temp.must_raise(advisor, 'UPDATE public.quote_request_messages SET body_text = ''x''', '42501', 'an advisor updating a message');
  PERFORM pg_temp.must_raise(advisor, 'DELETE FROM public.quote_request_messages', '42501', 'an advisor deleting messages');
  PERFORM pg_temp.must_raise(advisor, 'SELECT public.record_inbound_mail(''q'', ARRAY[''x''], ''a@b.example'', NULL, NULL, NULL, NULL, NULL, false, NULL, false, NULL)', '42501', 'an advisor recording mail');
  PERFORM pg_temp.must_raise(prospect, 'SELECT public.record_inbound_attachment(1, ''a'', ''x.pdf'', NULL, 1)', '42501', 'a prospect recording an attachment');
  PERFORM pg_temp.must_raise(advisor, 'SELECT public.finish_inbound_attachment(1, ''clean'', NULL, ''peo-mail'', ''x'')', '42501', 'an advisor settling an attachment');

  RAISE NOTICE 'quote_request_messages: all cases passed';
END $$;

-- ---------- Deleting an intake deletes its mail and files ----------
DO $$
DECLARE
  advisor uuid := (SELECT user_id FROM public.user_roles WHERE role = 'advisor' LIMIT 1);
  del uuid := pg_temp.new_intake('Deleted Co');
  q bigint; d uuid; removed jsonb; local_part text; n integer; att jsonb;
  raised text := NULL;
BEGIN
  PERFORM pg_temp.move(advisor, del, 'under_review', 'ready_for_market');
  q := (pg_temp.send(advisor, del, 'TriNet') ->> 'id')::bigint;
  local_part := (SELECT a.local_part FROM public.quote_request_addresses a WHERE a.quote_request_id = q AND a.revoked_at IS NULL);
  n := (pg_temp.mail('del_1', ARRAY[local_part], 'dana@trinet.example') ->> 'message_id')::int;
  att := pg_temp.svc(format('SELECT public.record_inbound_attachment(%s, ''att_1'', ''p.pdf'', ''application/pdf'', 10)', n));
  PERFORM pg_temp.svc(format('SELECT public.finish_inbound_attachment(%s, ''clean'', NULL, ''peo-mail'', %L, ''abc'')', att ->> 'id', del || '/' || n || '/1-p.pdf'));
  PERFORM pg_temp.mail('del_held', ARRAY['eaa-2026-9999.nobody.0123456789abcdef'], 'dana@trinet.example');
  INSERT INTO storage.objects (bucket_id, name) VALUES ('peo-mail', del || '/' || n || '/1-p.pdf');
  PERFORM set_config('request.jwt.claims', '', false);

  -- The intake's files are listed for the deletion, which refuses to finish while one remains.
  IF (SELECT count(*) FROM public.intake_stored_files(del, (SELECT user_id FROM public.chamber_sessions WHERE id = del)) WHERE bucket = 'peo-mail') <> 1 THEN
    RAISE EXCEPTION 'FAIL: the intake''s mail attachment isn''t listed among its stored files';
  END IF;
  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, status)
  VALUES (del, (SELECT user_id FROM public.chamber_sessions WHERE id = del), 'request', 'x', 'claimed') RETURNING id INTO d;
  SET LOCAL ROLE service_role;
  BEGIN
    PERFORM public.complete_intake_deletion(d, 0);
  EXCEPTION WHEN OTHERS THEN
    raised := SQLSTATE;
  END;
  RESET ROLE;
  IF raised IS DISTINCT FROM 'EA006' THEN RAISE EXCEPTION 'FAIL: the deletion went ahead with a mail file left (%)', raised; END IF;

  DELETE FROM storage.objects WHERE bucket_id = 'peo-mail' AND name LIKE del || '/%';
  SET LOCAL ROLE service_role;
  removed := public.complete_intake_deletion(d, 1);
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM public.quote_request_messages WHERE session_id = del) OR EXISTS (SELECT 1 FROM public.quote_request_message_attachments WHERE message_id = n)
     OR EXISTS (SELECT 1 FROM public.quote_requests WHERE session_id = del) THEN
    RAISE EXCEPTION 'FAIL: the deleted intake''s mail remains';
  END IF;
  IF (removed ->> 'quote_request_messages')::int IS DISTINCT FROM 1 OR (removed ->> 'quote_request_message_attachments')::int IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: the deletion reported %', removed;
  END IF;
  -- Held mail belongs to no intake, so deleting one leaves it.
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_messages WHERE provider_message_id = 'del_held') THEN
    RAISE EXCEPTION 'FAIL: deleting an intake deleted held mail';
  END IF;
  RAISE NOTICE 'quote_request_messages: deletion cases passed';
END $$;
