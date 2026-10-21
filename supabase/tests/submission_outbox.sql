-- Run against a scratch Postgres (NOT production); it drops and recreates the `public` schema:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/submission_outbox.sql
-- Stubs Supabase's `auth` schema and roles, then exercises certification together with the
-- notification outbox and the worker functions, as they run in production.
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
-- Supabase grants table access to these roles by default and relies on row security.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  company_name text,
  contact_name text,
  phone text
);

CREATE TABLE public.chamber_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chamber_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress',
  submission jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
\i supabase/migrations/20261020200000_block_guest_submission.sql
\i supabase/migrations/20261020210000_certification_events.sql
\i supabase/migrations/20261025090000_submission_outbox.sql

-- Fails the run if `stmt` succeeds.
CREATE FUNCTION pg_temp.must_refuse(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'FAIL: % was allowed', label;
EXCEPTION WHEN check_violation OR insufficient_privilege THEN NULL;
END $$;

CREATE FUNCTION pg_temp.count_events(sid uuid, k text DEFAULT NULL) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.outbox_events WHERE session_id = sid AND (k IS NULL OR kind = k)
$$;

DO $$
DECLARE
  uid uuid := gen_random_uuid();
  no_email uuid := gen_random_uuid();
  guest uuid := gen_random_uuid();
  sid uuid;
  sid2 uuid;
  sid3 uuid;
  data jsonb := jsonb_build_object(
    'company_name', 'Acme Co',
    'employee_count', 1,
    'employees', jsonb_build_array(jsonb_build_object(
      'first_name', 'Zelda', 'last_name', 'Zorander', 'dob', '1980-02-03', 'salary', 123456,
      'dependents', jsonb_build_array(jsonb_build_object('first_name', 'Dep', 'last_name', 'Endent', 'dob', '2015-05-05')))));
  edited jsonb := data || '{"company_name":"Acme Incorporated"}';
  good jsonb;
  ev public.outbox_events;
  n bigint;
  certs bigint;
  claimed int;
  eid uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (uid, 'jo@acme.example'), (no_email, NULL), (guest, NULL);
  INSERT INTO public.profiles (user_id, company_name, contact_name, phone) VALUES (uid, 'Acme (profile)', 'Joanna Doe', '555-0100');

  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","is_anonymous":false}', uid), false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id INTO sid;
  good := jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-05-01T12:00:00Z',
    'file_id', 'EAA-2026-AAAA1111', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', data);

  -- ---------- Nothing is queued before there is a submission ----------
  UPDATE public.chamber_sessions SET transcript = '[{"role":"user"}]' WHERE id = sid;
  IF pg_temp.count_events(sid) <> 0 THEN RAISE EXCEPTION 'FAIL: an unsubmitted session queued events'; END IF;

  -- A refused submission queues nothing (the whole statement rolls back).
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'' WHERE id = %L', sid), 'submitting with no certification');
  IF pg_temp.count_events(sid) <> 0 THEN RAISE EXCEPTION 'FAIL: a refused submission queued events'; END IF;

  -- ---------- A successful submission queues one advisor alert and one confirmation ----------
  UPDATE public.chamber_sessions SET status = 'submitted', submission = good WHERE id = sid;
  IF pg_temp.count_events(sid, 'advisor_notification') <> 1 THEN RAISE EXCEPTION 'FAIL: expected 1 advisor alert'; END IF;
  IF pg_temp.count_events(sid, 'prospect_confirmation') <> 1 THEN RAISE EXCEPTION 'FAIL: expected 1 prospect confirmation'; END IF;

  SELECT * INTO ev FROM public.outbox_events WHERE session_id = sid AND kind = 'advisor_notification';
  IF ev.status <> 'pending' OR ev.attempts <> 0 THEN RAISE EXCEPTION 'FAIL: new event is %/% attempts', ev.status, ev.attempts; END IF;
  IF ev.payload <> jsonb_build_object(
       'reference', 'EAA-2026-AAAA1111', 'company_name', 'Acme Co', 'contact_name', 'Joanna Doe',
       'contact_email', 'jo@acme.example', 'contact_phone', '555-0100', 'resubmission', false) THEN
    RAISE EXCEPTION 'FAIL: advisor payload was %', ev.payload;
  END IF;
  SELECT * INTO ev FROM public.outbox_events WHERE session_id = sid AND kind = 'prospect_confirmation';
  IF ev.payload <> jsonb_build_object(
       'reference', 'EAA-2026-AAAA1111', 'company_name', 'Acme Co', 'recipient_name', 'Jo Doe',
       'recipient_email', 'jo@acme.example') THEN
    RAISE EXCEPTION 'FAIL: prospect payload was %', ev.payload;
  END IF;

  -- No census, payroll or document content reaches any queued row.
  SELECT count(*) INTO n FROM public.outbox_events
  WHERE session_id = sid AND (payload::text ~* 'zelda|zorander|endent|123456|1980-02-03|2015-05-05|salary|dob|employees|signed_at|consent|I certify');
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: sensitive content in % queued rows', n; END IF;

  -- ---------- Saving the transcript of a certified session queues nothing ----------
  UPDATE public.chamber_sessions SET transcript = '[{"role":"user"},{"role":"assistant"}]' WHERE id = sid;
  IF pg_temp.count_events(sid) <> 2 THEN RAISE EXCEPTION 'FAIL: a transcript save queued events'; END IF;

  -- ---------- Changed answers certified again are a new, flagged submission ----------
  UPDATE public.chamber_sessions SET chamber_data = edited WHERE id = sid;  -- withdraws the certification
  IF pg_temp.count_events(sid) <> 2 THEN RAISE EXCEPTION 'FAIL: withdrawing a certification queued events'; END IF;
  UPDATE public.chamber_sessions SET status = 'submitted',
    submission = good || jsonb_build_object('chamber_data', edited, 'signed_at', '2026-05-02T09:30:00Z') WHERE id = sid;
  IF pg_temp.count_events(sid, 'advisor_notification') <> 2 OR pg_temp.count_events(sid, 'prospect_confirmation') <> 2 THEN
    RAISE EXCEPTION 'FAIL: re-certified changed data should queue one more of each';
  END IF;
  SELECT count(*) INTO n FROM public.outbox_events
  WHERE session_id = sid AND kind = 'advisor_notification' AND (payload ->> 'resubmission')::boolean = true
    AND payload ->> 'company_name' = 'Acme Incorporated';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: the second advisor alert should be flagged as an update'; END IF;
  SELECT count(*) INTO n FROM public.outbox_events
  WHERE session_id = sid AND kind = 'advisor_notification' AND (payload ->> 'resubmission')::boolean = false;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: the first advisor alert should not be flagged as an update'; END IF;
  -- ---------- Reference falls back to the one the advisor view derives ----------
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","is_anonymous":false}', uid), false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, '{"company_name":"  "}') RETURNING id INTO sid2;
  UPDATE public.chamber_sessions SET status = 'submitted',
    submission = (good - 'file_id') || jsonb_build_object('chamber_data', '{"company_name":"  "}'::jsonb) WHERE id = sid2;
  SELECT * INTO ev FROM public.outbox_events WHERE session_id = sid2 AND kind = 'advisor_notification';
  IF ev.payload ->> 'reference' <> 'EAA-' || to_char(now(), 'YYYY') || '-' || upper(left(replace(sid2::text, '-', ''), 8)) THEN
    RAISE EXCEPTION 'FAIL: fallback reference was %', ev.payload ->> 'reference';
  END IF;
  -- A blank company name in the intake falls back to the profile's.
  IF ev.payload ->> 'company_name' <> 'Acme (profile)' THEN RAISE EXCEPTION 'FAIL: company fallback was %', ev.payload ->> 'company_name'; END IF;

  -- ---------- An account with no address still alerts the advisors, but gets no email ----------
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","is_anonymous":false}', no_email), false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (no_email, data) RETURNING id INTO sid3;
  UPDATE public.chamber_sessions SET status = 'submitted', submission = good WHERE id = sid3;
  IF pg_temp.count_events(sid3, 'advisor_notification') <> 1 OR pg_temp.count_events(sid3, 'prospect_confirmation') <> 0 THEN
    RAISE EXCEPTION 'FAIL: a user with no email should queue the advisor alert only';
  END IF;

  -- ---------- Guests still cannot submit, and queue nothing ----------
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","is_anonymous":true}', guest), false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (guest, data) RETURNING id INTO sid3;
  PERFORM pg_temp.must_refuse(format('UPDATE public.chamber_sessions SET status = ''submitted'', submission = %L WHERE id = %L', good, sid3), 'guest submission');
  IF pg_temp.count_events(sid3) <> 0 THEN RAISE EXCEPTION 'FAIL: a guest submission queued events'; END IF;

  -- ---------- A queueing fault never undoes a submission ----------
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","is_anonymous":false}', uid), false);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, data) RETURNING id INTO sid3;
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
  UPDATE public.chamber_sessions SET status = 'submitted', submission = good WHERE id = sid3;
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;
  IF (SELECT status FROM public.chamber_sessions WHERE id = sid3) <> 'submitted' THEN
    RAISE EXCEPTION 'FAIL: a queueing fault blocked the submission';
  END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid3) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the certification was lost with the queueing fault';
  END IF;
  IF pg_temp.count_events(sid3) <> 0 THEN RAISE EXCEPTION 'FAIL: a half-written event survived the fault'; END IF;

  -- ---------- Nobody but the service role can touch the queue ----------
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.must_refuse('SELECT * FROM public.outbox_events', 'authenticated read of the queue');
  PERFORM pg_temp.must_refuse('INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload) SELECT ''advisor_notification'', id, ''x'', ''{}'' FROM public.chamber_sessions LIMIT 1', 'authenticated insert into the queue');
  PERFORM pg_temp.must_refuse('UPDATE public.outbox_events SET status = ''sent''', 'authenticated update of the queue');
  PERFORM pg_temp.must_refuse('SELECT public.claim_outbox_events(ARRAY[''advisor_notification''], 10, 5)', 'authenticated claim');
  PERFORM pg_temp.must_refuse('SELECT public.complete_outbox_event(gen_random_uuid(), ''x'')', 'authenticated complete');
  PERFORM pg_temp.must_refuse('SELECT public.fail_outbox_event(gen_random_uuid(), ''x'', 60)', 'authenticated fail');
  RESET ROLE;
  SET LOCAL ROLE anon;
  PERFORM pg_temp.must_refuse('SELECT * FROM public.outbox_events', 'anonymous read of the queue');
  PERFORM pg_temp.must_refuse('SELECT public.claim_outbox_events(ARRAY[''advisor_notification''], 10, 5)', 'anonymous claim');
  RESET ROLE;

  -- ---------- The worker's claim / complete / fail cycle ----------
  SET LOCAL ROLE service_role;
  -- Only the requested kinds, only up to the batch size.
  SELECT count(*) INTO claimed FROM public.claim_outbox_events(ARRAY['advisor_notification'], 2, 5);
  IF claimed <> 2 THEN RAISE EXCEPTION 'FAIL: batch of 2 claimed %', claimed; END IF;
  RESET ROLE;
  IF (SELECT count(*) FROM public.outbox_events WHERE status = 'sending' AND kind = 'advisor_notification' AND attempts = 1 AND locked_until > now()) <> 2 THEN
    RAISE EXCEPTION 'FAIL: claimed events are not marked sending with a lock';
  END IF;
  IF (SELECT count(*) FROM public.outbox_events WHERE kind = 'prospect_confirmation' AND status <> 'pending') <> 0 THEN
    RAISE EXCEPTION 'FAIL: an unrequested kind was claimed';
  END IF;

  -- A second worker does not get events already claimed.
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO claimed FROM public.claim_outbox_events(ARRAY['advisor_notification'], 10, 5);
  RESET ROLE;
  IF claimed <> (SELECT count(*) FROM public.outbox_events WHERE kind = 'advisor_notification' AND status = 'sending' AND attempts = 1) - 2 THEN
    RAISE EXCEPTION 'FAIL: second claim returned % events', claimed;
  END IF;
  UPDATE public.outbox_events SET status = 'pending', attempts = 0, locked_until = NULL, next_attempt_at = now();  -- reset

  -- Success.
  SELECT id INTO eid FROM public.outbox_events WHERE kind = 'advisor_notification' ORDER BY created_at LIMIT 1;
  SET LOCAL ROLE service_role;
  PERFORM public.claim_outbox_events(ARRAY['advisor_notification'], 1, 5);
  PERFORM public.complete_outbox_event(eid, 'msg_123');
  RESET ROLE;
  SELECT * INTO ev FROM public.outbox_events WHERE id = eid;
  IF ev.status <> 'sent' OR ev.sent_at IS NULL OR ev.provider_message_id <> 'msg_123' OR ev.locked_until IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: completed event is % / % / %', ev.status, ev.sent_at, ev.provider_message_id;
  END IF;

  -- A sent event is never claimed again.
  SET LOCAL ROLE service_role;
  PERFORM public.claim_outbox_events(ARRAY['advisor_notification', 'prospect_confirmation'], 100, 5);
  RESET ROLE;
  IF (SELECT attempts FROM public.outbox_events WHERE id = eid) <> 1 OR (SELECT status FROM public.outbox_events WHERE id = eid) <> 'sent' THEN
    RAISE EXCEPTION 'FAIL: a sent event was claimed again';
  END IF;
  UPDATE public.outbox_events SET status = 'pending', attempts = 0, locked_until = NULL, next_attempt_at = now() WHERE id <> eid;

  -- Failure with a retry delay is not due until the delay passes.
  SELECT id INTO eid FROM public.outbox_events WHERE kind = 'prospect_confirmation' ORDER BY created_at LIMIT 1;
  SET LOCAL ROLE service_role;
  PERFORM public.claim_outbox_events(ARRAY['prospect_confirmation'], 100, 5);
  PERFORM public.fail_outbox_event(eid, 'timeout', 60);
  RESET ROLE;
  SELECT * INTO ev FROM public.outbox_events WHERE id = eid;
  IF ev.status <> 'pending' OR ev.last_error <> 'timeout' OR ev.attempts <> 1 OR ev.next_attempt_at < now() + interval '50 seconds' THEN
    RAISE EXCEPTION 'FAIL: failed event is % / % / % / %', ev.status, ev.last_error, ev.attempts, ev.next_attempt_at;
  END IF;
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO claimed FROM public.claim_outbox_events(ARRAY['prospect_confirmation'], 100, 5) WHERE id = eid;
  RESET ROLE;
  IF claimed <> 0 THEN RAISE EXCEPTION 'FAIL: an event was claimed before its retry time'; END IF;
  UPDATE public.outbox_events SET next_attempt_at = now() - interval '1 second' WHERE id = eid;
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO claimed FROM public.claim_outbox_events(ARRAY['prospect_confirmation'], 100, 5) WHERE id = eid;
  RESET ROLE;
  IF claimed <> 1 THEN RAISE EXCEPTION 'FAIL: a due retry was not claimed'; END IF;
  IF (SELECT attempts FROM public.outbox_events WHERE id = eid) <> 2 THEN RAISE EXCEPTION 'FAIL: retry did not count as attempt 2'; END IF;

  -- Failure with no retry left is dead, and a dead event stays dead.
  SET LOCAL ROLE service_role;
  PERFORM public.fail_outbox_event(eid, 'provider_error', NULL);
  RESET ROLE;
  IF (SELECT status FROM public.outbox_events WHERE id = eid) <> 'dead' THEN RAISE EXCEPTION 'FAIL: event was not marked dead'; END IF;
  SET LOCAL ROLE service_role;
  PERFORM public.fail_outbox_event(eid, 'again', 60);  -- no longer sending: ignored
  SELECT count(*) INTO claimed FROM public.claim_outbox_events(ARRAY['prospect_confirmation'], 100, 5) WHERE id = eid;
  RESET ROLE;
  IF (SELECT status FROM public.outbox_events WHERE id = eid) <> 'dead' OR claimed <> 0 THEN
    RAISE EXCEPTION 'FAIL: a dead event was revived';
  END IF;

  -- A worker that died mid-send: the lapsed claim is retried, or given up on once attempts run out.
  UPDATE public.outbox_events SET status = 'sending', attempts = 2, locked_until = now() - interval '1 second' WHERE id = eid;
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO claimed FROM public.claim_outbox_events(ARRAY['prospect_confirmation'], 100, 5) WHERE id = eid;
  RESET ROLE;
  IF claimed <> 1 OR (SELECT attempts FROM public.outbox_events WHERE id = eid) <> 3 THEN
    RAISE EXCEPTION 'FAIL: a lapsed claim was not picked up again';
  END IF;
  UPDATE public.outbox_events SET status = 'sending', attempts = 5, locked_until = now() - interval '1 second' WHERE id = eid;
  SET LOCAL ROLE service_role;
  PERFORM public.claim_outbox_events(ARRAY['prospect_confirmation'], 100, 5);
  RESET ROLE;
  SELECT * INTO ev FROM public.outbox_events WHERE id = eid;
  IF ev.status <> 'dead' OR ev.last_error <> 'worker_lost' THEN
    RAISE EXCEPTION 'FAIL: an exhausted lapsed claim is % / %', ev.status, ev.last_error;
  END IF;

  -- A live claim is left alone.
  UPDATE public.outbox_events SET status = 'sending', attempts = 1, locked_until = now() + interval '1 minute' WHERE id = eid;
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO claimed FROM public.claim_outbox_events(ARRAY['prospect_confirmation'], 100, 5) WHERE id = eid;
  RESET ROLE;
  IF claimed <> 0 THEN RAISE EXCEPTION 'FAIL: a live claim was taken over'; END IF;

  -- A message that went out is recorded as sent even if its event had been given up on.
  UPDATE public.outbox_events SET status = 'dead', locked_until = NULL WHERE id = eid;
  SET LOCAL ROLE service_role;
  PERFORM public.complete_outbox_event(eid, 'msg_late');
  RESET ROLE;
  IF (SELECT status FROM public.outbox_events WHERE id = eid) <> 'sent' THEN RAISE EXCEPTION 'FAIL: a late completion was dropped'; END IF;

  -- Deleting a session removes its queued events.
  DELETE FROM public.chamber_sessions WHERE id = sid;
  IF pg_temp.count_events(sid) <> 0 THEN RAISE EXCEPTION 'FAIL: events outlived their session'; END IF;

  RAISE NOTICE 'submission_outbox: all cases passed';
END $$;

-- ---------- A retried submission queues nothing more ----------
-- Every statement below is its own transaction, as separate requests are. A re-sent submission
-- records another certification (so `now()` differs), which must not alert anyone again.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000a1', 'retry@acme.example');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","is_anonymous":false}', false);
INSERT INTO public.chamber_sessions (id, user_id, chamber_data)
VALUES ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '{"company_name":"Retry Co"}');

UPDATE public.chamber_sessions SET status = 'submitted', submission =
  '{"signer_name":"Jo","signer_title":"CEO","signed_at":"2026-05-01T12:00:00Z","file_id":"EAA-2026-RETRY001","consent_version":"v1","consent_text":"I certify.","chamber_data":{"company_name":"Retry Co"}}'
WHERE id = '00000000-0000-0000-0000-0000000000b1';
UPDATE public.chamber_sessions SET status = 'submitted', submission =
  '{"signer_name":"Jo","signer_title":"CEO","signed_at":"2026-05-01T12:00:00Z","file_id":"EAA-2026-RETRY001","consent_version":"v1","consent_text":"I certify.","chamber_data":{"company_name":"Retry Co"}}'
WHERE id = '00000000-0000-0000-0000-0000000000b1';
UPDATE public.chamber_sessions SET status = 'submitted', submission =
  '{"signer_name":"Jo","signer_title":"CEO","signed_at":"2026-05-01T12:00:00Z","file_id":"EAA-2026-RETRY001","consent_version":"v1","consent_text":"I certify.","chamber_data":{"company_name":"Retry Co"}}'
WHERE id = '00000000-0000-0000-0000-0000000000b1';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = '00000000-0000-0000-0000-0000000000b1') < 2 THEN
    RAISE EXCEPTION 'FAIL: test premise: re-sent submissions should each record a certification';
  END IF;
  IF (SELECT count(*) FROM public.outbox_events WHERE session_id = '00000000-0000-0000-0000-0000000000b1' AND kind = 'advisor_notification') <> 1
     OR (SELECT count(*) FROM public.outbox_events WHERE session_id = '00000000-0000-0000-0000-0000000000b1' AND kind = 'prospect_confirmation') <> 1 THEN
    RAISE EXCEPTION 'FAIL: re-sent submissions queued % events', (SELECT count(*) FROM public.outbox_events WHERE session_id = '00000000-0000-0000-0000-0000000000b1');
  END IF;
END $$;

-- Changed answers certified again are one new alert, however often that request is retried.
UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Retry Corp"}' WHERE id = '00000000-0000-0000-0000-0000000000b1';
UPDATE public.chamber_sessions SET status = 'submitted', submission =
  '{"signer_name":"Jo","signer_title":"CEO","signed_at":"2026-05-02T12:00:00Z","file_id":"EAA-2026-RETRY001","consent_version":"v1","consent_text":"I certify.","chamber_data":{"company_name":"Retry Corp"}}'
WHERE id = '00000000-0000-0000-0000-0000000000b1';
UPDATE public.chamber_sessions SET status = 'submitted', submission =
  '{"signer_name":"Jo","signer_title":"CEO","signed_at":"2026-05-02T12:00:00Z","file_id":"EAA-2026-RETRY001","consent_version":"v1","consent_text":"I certify.","chamber_data":{"company_name":"Retry Corp"}}'
WHERE id = '00000000-0000-0000-0000-0000000000b1';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.outbox_events WHERE session_id = '00000000-0000-0000-0000-0000000000b1' AND kind = 'advisor_notification') <> 2
     OR (SELECT count(*) FROM public.outbox_events WHERE session_id = '00000000-0000-0000-0000-0000000000b1' AND kind = 'prospect_confirmation') <> 2 THEN
    RAISE EXCEPTION 'FAIL: a retried update queued % events', (SELECT count(*) FROM public.outbox_events WHERE session_id = '00000000-0000-0000-0000-0000000000b1');
  END IF;
  IF (SELECT count(*) FROM public.outbox_events WHERE session_id = '00000000-0000-0000-0000-0000000000b1'
        AND kind = 'advisor_notification' AND (payload ->> 'resubmission')::boolean) <> 1 THEN
    RAISE EXCEPTION 'FAIL: exactly the second alert should be flagged as an update';
  END IF;
  RAISE NOTICE 'submission_outbox: retry cases passed';
END $$;
