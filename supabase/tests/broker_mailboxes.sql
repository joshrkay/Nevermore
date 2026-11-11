-- Run against a scratch Postgres as the superuser `postgres`, never one you care about: it loads the e2e
-- Supabase bootstrap (roles, auth and storage) into the fresh database run.sh creates, then every migration:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh broker_mailboxes
-- A broker's connected mailbox (joshrkay/Nevermore#92 story M-4.3, 20261113090000_broker_mailboxes.sql): the encrypted
-- token is readable by no API role and only the service role can store, read or delete it; a broker learns only
-- whether a mailbox is connected; it is deleted on disconnect, when the account is deleted, and when the broker no longer
-- holds the advisor or admin role; only an advisor can connect one.
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
\i supabase/migrations/20261112090000_intake_schema_v3_version.sql
\i supabase/migrations/20261112091000_intake_schema_v3_company_identity.sql
\i supabase/migrations/20261112092000_intake_schema_v3_industry_code.sql
\i supabase/migrations/20261112093000_intake_schema_v3_current_peo.sql
\i supabase/migrations/20261112094000_intake_schema_v3_census_columns.sql
\i supabase/migrations/20261112095000_intake_schema_v3_census_worksite.sql
\i supabase/migrations/20261112096000_intake_schema_v3_owners_officers.sql
\i supabase/migrations/20261112097000_intake_schema_v3_loss_history.sql
\i supabase/migrations/20261112098000_intake_schema_v3_medical_plans.sql
\i supabase/migrations/20261112099000_intake_schema_v3_suta_rates.sql
\i supabase/migrations/20261112100000_intake_schema_v3_acord_130_questions.sql
\i supabase/migrations/20261113090000_broker_mailboxes.sql
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
  other uuid := pg_temp.new_user();
  prospect uuid := pg_temp.new_user();
  res jsonb;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor'), (admin, 'admin'), (admin, 'advisor'), (other, 'advisor');

  -- ---------- Nothing connected ----------
  IF pg_temp.run(advisor, 'SELECT public.my_mailbox()') <> '{"connected": false}'::jsonb THEN RAISE EXCEPTION 'FAIL: a broker with no mailbox is told %', pg_temp.run(advisor, 'SELECT public.my_mailbox()'); END IF;
  IF pg_temp.svc(format('SELECT public.mailbox_secret(%L)', advisor)) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a secret exists for a broker with no mailbox'; END IF;

  -- ---------- Only an advisor connects one ----------
  PERFORM pg_temp.svc_must_raise(format('SELECT public.mailbox_store(%L, %L, %L, %L, %L, %L)', prospect, 'google', 'p@example.test', 'scope', 'ct', 'iv'), '42501', 'connecting a prospect''s mailbox');
  res := pg_temp.svc(format('SELECT public.mailbox_store(%L, %L, %L, %L, %L, %L)', advisor, 'google', 'marcus@advisory.example', 'https://www.googleapis.com/auth/gmail.send', 'CIPHERTEXT-1', 'IV-1'));
  IF (res ->> 'connected')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: connect returned %', res; END IF;

  -- ---------- The broker learns who and since when, never the token ----------
  res := pg_temp.run(advisor, 'SELECT public.my_mailbox()');
  IF res ->> 'provider' <> 'google' OR res ->> 'address' <> 'marcus@advisory.example' OR (res ->> 'connected')::boolean IS NOT TRUE
     OR res::text ~* 'CIPHERTEXT|IV-1|token' THEN
    RAISE EXCEPTION 'FAIL: my_mailbox tells %', res;
  END IF;
  -- Another broker sees nothing of it.
  IF pg_temp.run(other, 'SELECT public.my_mailbox()') <> '{"connected": false}'::jsonb THEN RAISE EXCEPTION 'FAIL: a colleague saw a mailbox'; END IF;

  -- ---------- Nobody reads or writes the table, whatever their role ----------
  FOR i IN 1..3 LOOP
    DECLARE who uuid := (ARRAY[advisor, admin, prospect])[i];
    BEGIN
      IF pg_temp.count_as(who, 'public.broker_mailboxes') <> -1 THEN RAISE EXCEPTION 'FAIL: user % can read broker_mailboxes', i; END IF;
      PERFORM pg_temp.must_raise(who, format('UPDATE public.broker_mailboxes SET address = %L', 'x@example.test'), '42501', 'writing broker_mailboxes as user ' || i);
      PERFORM pg_temp.must_raise(who, 'DELETE FROM public.broker_mailboxes', '42501', 'deleting from broker_mailboxes as user ' || i);
      PERFORM pg_temp.must_raise(who, format('SELECT public.mailbox_secret(%L)', advisor), '42501', 'reading the secret as user ' || i);
      PERFORM pg_temp.must_raise(who, format('SELECT public.mailbox_delete(%L)', advisor), '42501', 'deleting the mailbox as user ' || i);
      PERFORM pg_temp.must_raise(who, format('SELECT public.mailbox_store(%L, %L, %L, %L, %L, %L)', advisor, 'google', 'a@b.example', 's', 'c', 'i'), '42501', 'storing as user ' || i);
    END;
  END LOOP;

  -- ---------- The function reads the encrypted token back, and replaces it when the provider rotates it ----------
  res := pg_temp.svc(format('SELECT public.mailbox_secret(%L)', advisor));
  IF res ->> 'token_ciphertext' <> 'CIPHERTEXT-1' OR res ->> 'token_iv' <> 'IV-1' OR res ->> 'provider' <> 'google' THEN RAISE EXCEPTION 'FAIL: the secret is %', res; END IF;
  UPDATE public.broker_mailboxes SET connected_at = '2026-01-01T00:00:00Z' WHERE user_id = advisor;
  PERFORM pg_temp.svc(format('SELECT public.mailbox_store(%L, %L, %L, %L, %L, %L, true)', advisor, 'google', 'marcus@advisory.example', 'https://www.googleapis.com/auth/gmail.send', 'CIPHERTEXT-2', 'IV-2'));
  IF (pg_temp.svc(format('SELECT public.mailbox_secret(%L)', advisor)) ->> 'token_ciphertext') <> 'CIPHERTEXT-2'
     OR (SELECT connected_at FROM public.broker_mailboxes WHERE user_id = advisor) <> '2026-01-01T00:00:00Z' THEN
    RAISE EXCEPTION 'FAIL: a rotated token did not replace the old one, or moved the connection date';
  END IF;
  -- Connecting again is a new connection.
  PERFORM pg_temp.svc(format('SELECT public.mailbox_store(%L, %L, %L, %L, %L, %L)', advisor, 'microsoft', 'marcus@advisory.example', 'Mail.Send', 'CIPHERTEXT-3', 'IV-3'));
  IF (SELECT connected_at FROM public.broker_mailboxes WHERE user_id = advisor) < now() - interval '1 minute'
     OR pg_temp.run(advisor, 'SELECT public.my_mailbox()') ->> 'provider' <> 'microsoft' THEN
    RAISE EXCEPTION 'FAIL: reconnecting did not make a new connection';
  END IF;

  -- ---------- Disconnecting deletes the token ----------
  IF (pg_temp.svc(format('SELECT to_jsonb(public.mailbox_delete(%L))', advisor)))::text <> 'true' THEN RAISE EXCEPTION 'FAIL: disconnect reported nothing to delete'; END IF;
  IF pg_temp.svc(format('SELECT public.mailbox_secret(%L)', advisor)) IS NOT NULL OR EXISTS (SELECT 1 FROM public.broker_mailboxes WHERE user_id = advisor) THEN
    RAISE EXCEPTION 'FAIL: the token survived a disconnect';
  END IF;
  IF (pg_temp.svc(format('SELECT to_jsonb(public.mailbox_delete(%L))', advisor)))::text <> 'false' THEN RAISE EXCEPTION 'FAIL: disconnecting twice reported a deletion'; END IF;

  -- ---------- The broker leaving deletes it: the role going, and the account going ----------
  PERFORM pg_temp.svc(format('SELECT public.mailbox_store(%L, %L, %L, %L, %L, %L)', other, 'google', 'o@advisory.example', 's', 'c', 'i'));
  PERFORM pg_temp.svc(format('SELECT public.mailbox_store(%L, %L, %L, %L, %L, %L)', admin, 'google', 'a@advisory.example', 's', 'c', 'i'));
  -- An admin who keeps one of their two roles keeps the mailbox; one with none left loses it.
  DELETE FROM public.user_roles WHERE user_id = admin AND role = 'admin';
  IF NOT EXISTS (SELECT 1 FROM public.broker_mailboxes WHERE user_id = admin) THEN RAISE EXCEPTION 'FAIL: dropping one role of two deleted the mailbox'; END IF;
  DELETE FROM public.user_roles WHERE user_id = admin AND role = 'advisor';
  IF EXISTS (SELECT 1 FROM public.broker_mailboxes WHERE user_id = admin) THEN RAISE EXCEPTION 'FAIL: the mailbox survived the broker losing every role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.broker_mailboxes WHERE user_id = other) THEN RAISE EXCEPTION 'FAIL: another broker''s mailbox was deleted'; END IF;
  DELETE FROM auth.users WHERE id = other;
  IF EXISTS (SELECT 1 FROM public.broker_mailboxes WHERE user_id = other) THEN RAISE EXCEPTION 'FAIL: the mailbox survived the account'; END IF;

  -- ---------- The table is small and bounded ----------
  PERFORM pg_temp.svc_must_raise(format('SELECT public.mailbox_store(%L, %L, %L, %L, %L, %L)', advisor, 'yahoo', 'a@b.example', 's', 'c', 'i'), '23514', 'an unknown provider');

  RAISE NOTICE 'broker_mailboxes: all checks passed';
END $$;
