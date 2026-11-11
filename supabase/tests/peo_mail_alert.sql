-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh peo_mail_alert
-- Telling advisors that PEO mail arrived (joshrkay/Nevermore#92 story M-3.6, 20261111140000_peo_mail_alert.sql): a person
-- at a PEO writing on a quote request queues one advisor email through the outbox, naming the PEO, the employer and the
-- File ID and carrying nothing of the message; an automatic reply, an advisor's own copied-in message, held mail and a
-- replay queue nothing; an admin assigning held mail queues one; a bounce never suppresses an advisor's address.
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
\i supabase/migrations/20261111140000_peo_mail_alert.sql
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





CREATE FUNCTION pg_temp.alerts(sid uuid DEFAULT NULL) RETURNS integer LANGUAGE sql AS $$
  SELECT count(*)::integer FROM public.outbox_events WHERE kind = 'peo_mail_arrived' AND (sid IS NULL OR session_id = sid);
$$;

DO $$
DECLARE
  advisor uuid := pg_temp.new_user();
  admin uuid := pg_temp.new_user();
  a uuid := pg_temp.new_intake('Alpha Co');
  q bigint; q2 bigint;
  la text; la2 text;
  m bigint; held bigint;
  ev public.outbox_events;
  res jsonb;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor'), (admin, 'admin');
  PERFORM pg_temp.move(advisor, a, 'under_review', 'ready_for_market');
  q := (pg_temp.send(advisor, a, 'TriNet') ->> 'id')::bigint;
  q2 := (pg_temp.send(advisor, a, 'Justworks') ->> 'id')::bigint;
  la := (SELECT local_part FROM public.quote_request_addresses WHERE quote_request_id = q AND revoked_at IS NULL);
  la2 := (SELECT local_part FROM public.quote_request_addresses WHERE quote_request_id = q2 AND revoked_at IS NULL);

  -- ---------- Mail that is not a person at the PEO writing queues nothing ----------
  PERFORM pg_temp.mail('a_auto', ARRAY[la], 'ooo@trinet.example', '{}', true);
  PERFORM pg_temp.mail('a_hand', ARRAY[la], advisor || '@example.test');
  held := (pg_temp.mail('a_held', ARRAY['eaa-2026-9999.nobody.0123456789abcdef'], 'stranger@example.test') ->> 'message_id')::bigint;
  IF pg_temp.alerts() <> 0 THEN RAISE EXCEPTION 'FAIL: an automatic reply, a copied-in message or held mail queued % email(s)', pg_temp.alerts(); END IF;

  -- ---------- A person at the PEO writing queues one, with nothing of the message ----------
  m := (pg_temp.mail('a_1', ARRAY[la], 'dana@trinet.example', '{}', false, 'We can offer 4.2 percent') ->> 'message_id')::bigint;
  IF pg_temp.alerts(a) <> 1 THEN RAISE EXCEPTION 'FAIL: a PEO''s message queued % email(s)', pg_temp.alerts(a); END IF;
  SELECT * INTO ev FROM public.outbox_events WHERE kind = 'peo_mail_arrived';
  IF ev.status <> 'pending' OR ev.session_id <> a THEN RAISE EXCEPTION 'FAIL: the event is %', to_jsonb(ev); END IF;
  IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(ev.payload) k) IS DISTINCT FROM ARRAY['company_name', 'peo_name', 'reference'] THEN
    RAISE EXCEPTION 'FAIL: the payload carries %', ev.payload;
  END IF;
  IF ev.payload ->> 'peo_name' <> 'TriNet' OR ev.payload ->> 'company_name' <> 'Alpha Co'
     OR COALESCE(ev.payload ->> 'reference', '') !~ '^EAA-' THEN
    RAISE EXCEPTION 'FAIL: the payload says %', ev.payload;
  END IF;
  IF ev.payload::text ~* '(dana|trinet\.example|4\.2|percent|Harbor)' THEN RAISE EXCEPTION 'FAIL: the payload carries the message: %', ev.payload; END IF;
  -- The queue row is never read by advisors or prospects.
  IF pg_temp.count_as(advisor, 'public.outbox_events') <> -1 THEN RAISE EXCEPTION 'FAIL: an advisor can read the outbox table'; END IF;

  -- A replay of the same message queues nothing more; another message, or another PEO's, queues its own.
  PERFORM pg_temp.mail('a_1', ARRAY[la], 'dana@trinet.example');
  IF pg_temp.alerts() <> 1 THEN RAISE EXCEPTION 'FAIL: a replay queued another email'; END IF;
  PERFORM pg_temp.mail('a_2', ARRAY[la], 'dana@trinet.example');
  PERFORM pg_temp.mail('a_3', ARRAY[la2], 'tomas@justworks.example');
  IF pg_temp.alerts() <> 3 OR (SELECT count(*) FROM public.outbox_events WHERE kind = 'peo_mail_arrived' AND payload ->> 'peo_name' = 'Justworks') <> 1 THEN
    RAISE EXCEPTION 'FAIL: three messages queued % email(s)', pg_temp.alerts();
  END IF;

  -- ---------- A message never changes anything else ----------
  IF (SELECT status FROM public.quote_requests WHERE id = q) <> 'sent' THEN RAISE EXCEPTION 'FAIL: mail changed the status'; END IF;

  -- ---------- Held mail an admin assigns to a thread queues one then ----------
  PERFORM pg_temp.svc(format('SELECT public.apply_mail_move(%s, %s, %L, NULL)', held, q2, admin));
  IF pg_temp.alerts() <> 4 THEN RAISE EXCEPTION 'FAIL: assigning held mail queued % email(s) in all', pg_temp.alerts(); END IF;
  -- Moving it off the thread queues nothing.
  PERFORM pg_temp.svc(format('SELECT public.apply_mail_move(%s, NULL, %L, NULL)', held, advisor));
  IF pg_temp.alerts() <> 4 THEN RAISE EXCEPTION 'FAIL: moving a message off a thread queued an email'; END IF;

  -- ---------- A failure in queueing never loses the message ----------
  CREATE FUNCTION pg_temp.refuse_outbox() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RAISE EXCEPTION 'outbox is down'; END $f$;
  CREATE TRIGGER refuse_outbox BEFORE INSERT ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION pg_temp.refuse_outbox();
  res := pg_temp.mail('a_broken', ARRAY[la], 'dana@trinet.example');
  DROP TRIGGER refuse_outbox ON public.outbox_events;
  IF res ->> 'message_id' IS NULL OR NOT EXISTS (SELECT 1 FROM public.quote_request_messages WHERE provider_message_id = 'a_broken') THEN
    RAISE EXCEPTION 'FAIL: a queueing fault lost the message';
  END IF;
  IF pg_temp.alerts() <> 4 THEN RAISE EXCEPTION 'FAIL: a broken queue still queued'; END IF;

  -- ---------- A bounce never suppresses an advisor's address ----------
  UPDATE public.outbox_events SET provider_message_id = 'prov_peo_1', status = 'sent', payload = payload WHERE id = ev.id;
  res := pg_temp.svc(format(
    'SELECT public.record_email_delivery_event(%L, %L, %L, %L::text[], %L, NULL, now(), %L::text[])',
    'evt_bounce_1', 'email.bounced', 'prov_peo_1', ARRAY['advisors@example.com'], 'Permanent', ARRAY[]::text[]));
  IF res ->> 'outcome' <> 'protected' OR EXISTS (SELECT 1 FROM public.email_suppressions WHERE address = 'advisors@example.com') THEN
    RAISE EXCEPTION 'FAIL: a bounce on a PEO mail notice was % and suppressed an advisor address: %', res ->> 'outcome', res;
  END IF;

  RAISE NOTICE 'peo_mail_alert: all checks passed';
END $$;
