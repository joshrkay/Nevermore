-- Run against a scratch Postgres, never one you care about (not production, not a local or dev
-- Supabase): it drops and recreates the `public` AND `auth` schemas, which deletes real users:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/submission_outbox.sql
-- Stubs Supabase's `auth` schema and roles, then exercises certification together with the
-- notification outbox and the worker functions, as they run in production. The outbox migration
-- is loaded in two steps (the original, then the reliability one) with data in between, to prove
-- the upgrade path.
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
-- It grants EXECUTE on new functions to them too, so a function is only closed to clients if its
-- migration says so.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

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

-- Fails the run unless `stmt` raises exactly `expected_state`.
CREATE FUNCTION pg_temp.must_raise(stmt text, expected_state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  raised boolean := false;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    raised := true;
    IF SQLSTATE <> expected_state THEN
      RAISE EXCEPTION 'FAIL: % raised % (%), expected %', label, SQLSTATE, SQLERRM, expected_state;
    END IF;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'FAIL: % did not raise', label; END IF;
END $$;

CREATE FUNCTION pg_temp.count_events(sid uuid, k text DEFAULT NULL) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.outbox_events WHERE session_id = sid AND (k IS NULL OR kind = k)
$$;

-- An intake for `p_uid`, not yet submitted.
CREATE FUNCTION pg_temp.new_session(p_uid uuid, p_company text) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.chamber_sessions (user_id, chamber_data)
  VALUES (p_uid, jsonb_build_object('company_name', p_company)) RETURNING id
$$;

-- Certifies the session's current answers and returns the new active certification. Callers that
-- send no JWT are treated as a service connection, so nothing here is refused as a guest.
CREATE FUNCTION pg_temp.submit(p_sid uuid, p_signed_at text DEFAULT '2026-05-01T12:00:00Z', p_signer text DEFAULT 'Jo Doe')
RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
    'signer_name', p_signer, 'signer_title', 'CEO', 'signed_at', p_signed_at,
    'file_id', 'EAA-2026-' || upper(left(replace(p_sid::text, '-', ''), 8)),
    'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', chamber_data)
  WHERE id = p_sid;
  RETURN (SELECT c.id FROM public.chamber_certifications c WHERE c.session_id = p_sid AND c.superseded_at IS NULL);
END $$;

-- ---------- Upgrade: data made under the ORIGINAL trigger, then the reliability migration ----------
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000000c1';
  sid uuid := '00000000-0000-0000-0000-0000000000d1';
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO auth.users (id, email) VALUES (u, 'old@acme.example');
  INSERT INTO public.chamber_sessions (id, user_id, chamber_data) VALUES (sid, u, '{"company_name":"Old Co"}');
  PERFORM pg_temp.submit(sid);
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Old Corp"}' WHERE id = sid;
  PERFORM pg_temp.submit(sid, '2026-05-02T09:00:00Z');

  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid) <> 2
     OR pg_temp.count_events(sid, 'advisor_notification') <> 2 OR pg_temp.count_events(sid, 'prospect_confirmation') <> 2 THEN
    RAISE EXCEPTION 'FAIL: test premise: the original trigger should have queued 2 + 2 events for 2 certifications';
  END IF;
  -- One already sent, one in flight whose claim has lapsed: states a deploy can find the queue in.
  UPDATE public.outbox_events SET status = 'sent', sent_at = now(), provider_message_id = 'msg_old', attempts = 1
  WHERE session_id = sid AND kind = 'advisor_notification' AND (payload ->> 'resubmission')::boolean = false;
  UPDATE public.outbox_events SET status = 'sending', attempts = 1, locked_until = now() - interval '1 second'
  WHERE session_id = sid AND kind = 'advisor_notification' AND (payload ->> 'resubmission')::boolean = true;
END $$;

\i supabase/migrations/20261026090000_outbox_reliability.sql

-- Everything below needs the new columns and functions.
-- Runs `stmt`, a query returning one value, as the service role (the role the worker connects as).
CREATE FUNCTION pg_temp.svc(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  r text;
BEGIN
  SET LOCAL ROLE service_role;
  EXECUTE stmt INTO r;
  RESET ROLE;
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.reconcile(p_limit integer DEFAULT 25) RETURNS jsonb LANGUAGE sql AS $$
  SELECT pg_temp.svc(format('SELECT public.reconcile_outbox_events(%s)', p_limit))::jsonb
$$;

CREATE FUNCTION pg_temp.ev(p_id uuid) RETURNS public.outbox_events LANGUAGE sql AS $$
  SELECT * FROM public.outbox_events WHERE id = p_id
$$;

-- Inserts an event in a given state for `p_sid`; `p_lock` is how far from now its lock runs out.
CREATE FUNCTION pg_temp.mk_event(p_sid uuid, p_status text, p_attempts integer, p_lock interval DEFAULT NULL, p_pending jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, status, attempts, locked_until, pending_send)
  VALUES ('advisor_notification', p_sid, gen_random_uuid()::text, '{}', p_status, p_attempts,
          CASE WHEN p_lock IS NULL THEN NULL ELSE now() + p_lock END, p_pending)
  RETURNING id
$$;

DO $$
DECLARE
  sid uuid := '00000000-0000-0000-0000-0000000000d1';
  r jsonb;
  before_events jsonb;
  ev_lapsed uuid;
  ev_pending uuid;
BEGIN
  IF current_setting('lock_timeout') NOT IN ('0', '0ms') THEN
    RAISE EXCEPTION 'FAIL: the migration left lock_timeout at %', current_setting('lock_timeout');
  END IF;
  IF to_regclass('public.chamber_certifications_unqueued_idx') IS NULL THEN
    RAISE EXCEPTION 'FAIL: the partial index for the sweep is missing';
  END IF;
  -- Its predicate is what keeps it small, and what the sweep's query has to match to use it.
  IF pg_get_indexdef('public.chamber_certifications_unqueued_idx'::regclass) NOT LIKE
     '% USING btree (recorded_at) WHERE ((superseded_at IS NULL) AND (outbox_queued_at IS NULL))' THEN
    RAISE EXCEPTION 'FAIL: the sweep index is %', pg_get_indexdef('public.chamber_certifications_unqueued_idx'::regclass);
  END IF;

  -- Everything certified before the migration counts as handled: nothing is back-filled.
  IF EXISTS (
    SELECT 1 FROM public.chamber_certifications
    WHERE outbox_queued_at IS DISTINCT FROM recorded_at OR outbox_failures <> 0
       OR outbox_last_failed_at IS NOT NULL OR outbox_last_sqlstate IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: certifications made before the migration were not marked handled';
  END IF;
  IF (SELECT count(*) FROM public.outbox_events WHERE pending_send IS NOT NULL) <> 0 THEN
    RAISE EXCEPTION 'FAIL: old events should have no frozen send';
  END IF;

  before_events := (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.outbox_events e);
  r := pg_temp.reconcile();
  IF r <> jsonb_build_object('healed', 0, 'failed', 0, 'unqueued', 0, 'oldest_age_seconds', 0, 'last_sqlstate', NULL) THEN
    RAISE EXCEPTION 'FAIL: the sweep found work among old certifications: %', r;
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.outbox_events e) IS DISTINCT FROM before_events THEN
    RAISE EXCEPTION 'FAIL: the sweep changed the queue of old certifications';
  END IF;

  -- The old rows go through the new worker interface: the lapsed claim and the pending
  -- confirmations are claimed, a fenced failure and a completion both land.
  IF pg_temp.svc('SELECT count(*) FROM public.claim_outbox_events(ARRAY[''advisor_notification'', ''prospect_confirmation''], 100, 5)')::int <> 3 THEN
    RAISE EXCEPTION 'FAIL: old events were not claimable';
  END IF;
  SELECT id INTO ev_lapsed FROM public.outbox_events WHERE session_id = sid AND kind = 'advisor_notification' AND status = 'sending';
  SELECT id INTO ev_pending FROM public.outbox_events WHERE session_id = sid AND kind = 'prospect_confirmation' ORDER BY created_at LIMIT 1;
  IF (pg_temp.ev(ev_lapsed)).attempts <> 2 THEN RAISE EXCEPTION 'FAIL: the old lapsed claim was not retried as attempt 2'; END IF;
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''timeout'', 60, 2)', ev_lapsed));
  IF (pg_temp.ev(ev_lapsed)).status <> 'pending' OR (pg_temp.ev(ev_lapsed)).pending_send IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: failing an old event did not retry it';
  END IF;
  PERFORM pg_temp.svc(format('SELECT public.complete_outbox_event(%L, ''msg_after_upgrade'')', ev_pending));
  IF (pg_temp.ev(ev_pending)).status <> 'sent' THEN RAISE EXCEPTION 'FAIL: completing an old event failed'; END IF;

  RAISE NOTICE 'submission_outbox: upgrade cases passed';
END $$;

DELETE FROM public.chamber_sessions;
DELETE FROM auth.users;

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
  cert public.chamber_certifications;
  n bigint;
  certs bigint;
  claimed int;
  eid uuid;
  stmt text;
  client_stmts text[] := ARRAY[
    'SELECT public.enqueue_certification_notifications(gen_random_uuid())',
    'SELECT public.enqueue_submission_notifications()',
    'SELECT public.reconcile_outbox_events()',
    'SELECT * FROM public.reap_outbox_events(5)',
    'SELECT public.freeze_outbox_message(gen_random_uuid(), 1, ''{"from":"a","to":["b"],"subject":"s","text":"t","html":"h"}''::jsonb)',
    'SELECT public.fail_outbox_event(gen_random_uuid(), ''x'', 60, 1)',
    'SELECT public.fail_outbox_event(gen_random_uuid(), ''x'', 60, 1, true)',
    'SELECT public.requeue_outbox_event(gen_random_uuid())',
    'SELECT public.requeue_outbox_event(gen_random_uuid(), true)',
    'UPDATE public.chamber_certifications SET outbox_queued_at = now()'
  ];
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
  -- ... and records that it did, on the certification itself.
  SELECT * INTO cert FROM public.chamber_certifications WHERE session_id = sid;
  IF cert.outbox_queued_at IS NULL OR cert.outbox_failures <> 0 OR cert.outbox_last_failed_at IS NOT NULL OR cert.outbox_last_sqlstate IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a queued certification is marked % / % / %', cert.outbox_queued_at, cert.outbox_failures, cert.outbox_last_sqlstate;
  END IF;

  SELECT * INTO ev FROM public.outbox_events WHERE session_id = sid AND kind = 'advisor_notification';
  IF ev.status <> 'pending' OR ev.attempts <> 0 OR ev.pending_send IS NOT NULL THEN RAISE EXCEPTION 'FAIL: new event is %/% attempts', ev.status, ev.attempts; END IF;
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
  -- Both certifications, the superseded one too, are marked as queued.
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid AND outbox_queued_at IS NULL) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a queued certification was left unmarked';
  END IF;
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

  -- ---------- A queueing fault never undoes a submission, and is recorded ----------
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
  SELECT * INTO cert FROM public.chamber_certifications WHERE session_id = sid3;
  IF cert.outbox_queued_at IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a certification that was not queued is marked queued'; END IF;
  IF cert.outbox_failures <> 1 OR cert.outbox_last_failed_at IS NULL OR cert.outbox_last_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'FAIL: the fault was recorded as % / % / %', cert.outbox_failures, cert.outbox_last_failed_at, cert.outbox_last_sqlstate;
  END IF;

  -- ---------- Nobody but the service role can touch the queue ----------
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.must_refuse('SELECT * FROM public.outbox_events', 'authenticated read of the queue');
  PERFORM pg_temp.must_refuse('INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload) SELECT ''advisor_notification'', id, ''x'', ''{}'' FROM public.chamber_sessions LIMIT 1', 'authenticated insert into the queue');
  PERFORM pg_temp.must_refuse('UPDATE public.outbox_events SET status = ''sent''', 'authenticated update of the queue');
  PERFORM pg_temp.must_refuse('SELECT public.claim_outbox_events(ARRAY[''advisor_notification''], 10, 5)', 'authenticated claim');
  PERFORM pg_temp.must_refuse('SELECT public.complete_outbox_event(gen_random_uuid(), ''x'')', 'authenticated complete');
  FOREACH stmt IN ARRAY client_stmts LOOP
    PERFORM pg_temp.must_refuse(stmt, 'authenticated: ' || stmt);
  END LOOP;
  RESET ROLE;
  SET LOCAL ROLE anon;
  PERFORM pg_temp.must_refuse('SELECT * FROM public.outbox_events', 'anonymous read of the queue');
  PERFORM pg_temp.must_refuse('SELECT public.claim_outbox_events(ARRAY[''advisor_notification''], 10, 5)', 'anonymous claim');
  PERFORM pg_temp.must_refuse('SELECT public.complete_outbox_event(gen_random_uuid(), ''x'')', 'anonymous complete');
  FOREACH stmt IN ARRAY client_stmts LOOP
    PERFORM pg_temp.must_refuse(stmt, 'anonymous: ' || stmt);
  END LOOP;
  RESET ROLE;
  -- The enqueue helper is for the trigger, the sweep and an operator: not even the service role.
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.must_refuse('SELECT public.enqueue_certification_notifications(gen_random_uuid())', 'service role calling the enqueue helper');
  RESET ROLE;
  -- The old 3-argument fail is gone, not left to be called ambiguously.
  IF to_regprocedure('public.fail_outbox_event(uuid, text, integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the old 3-argument fail_outbox_event still exists';
  END IF;

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
  PERFORM public.fail_outbox_event(eid, 'timeout', 60, 1);
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
  PERFORM public.fail_outbox_event(eid, 'provider_error', NULL, 2);
  RESET ROLE;
  IF (SELECT status FROM public.outbox_events WHERE id = eid) <> 'dead' THEN RAISE EXCEPTION 'FAIL: event was not marked dead'; END IF;
  SET LOCAL ROLE service_role;
  PERFORM public.fail_outbox_event(eid, 'again', 60, 2);  -- no longer sending: ignored
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
  SELECT count(*) INTO claimed FROM public.claim_outbox_events(ARRAY['prospect_confirmation'], 100, 5) WHERE id = eid;
  RESET ROLE;
  -- Claiming no longer gives up on it: that is the reaper's job, so that it is reported.
  IF claimed <> 0 OR (SELECT status FROM public.outbox_events WHERE id = eid) <> 'sending' THEN
    RAISE EXCEPTION 'FAIL: claiming reaped or claimed an exhausted lapsed claim';
  END IF;
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO claimed FROM public.reap_outbox_events(5) WHERE id = eid;
  RESET ROLE;
  SELECT * INTO ev FROM public.outbox_events WHERE id = eid;
  IF claimed <> 1 OR ev.status <> 'dead' OR ev.last_error <> 'worker_lost' OR ev.locked_until IS NOT NULL THEN
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

-- ---------- Every function closed to clients, with a pinned search path ----------
DO $$
DECLARE
  f record;
  worker text[] := ARRAY['reconcile_outbox_events', 'reap_outbox_events', 'claim_outbox_events', 'freeze_outbox_message',
                         'complete_outbox_event', 'fail_outbox_event', 'requeue_outbox_event'];
  seen integer := 0;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig, COALESCE(p.proacl, acldefault('f', p.proowner)) AS acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'enqueue_submission_notifications', 'enqueue_certification_notifications', 'reconcile_outbox_events', 'reap_outbox_events',
      'claim_outbox_events', 'freeze_outbox_message', 'complete_outbox_event', 'fail_outbox_event', 'requeue_outbox_event')
  LOOP
    seen := seen + 1;
    IF has_function_privilege('anon', f.oid, 'EXECUTE') OR has_function_privilege('authenticated', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: % can be executed by a client', f.proname;
    END IF;
    IF EXISTS (SELECT 1 FROM aclexplode(f.acl) a WHERE a.grantee = 0) THEN
      RAISE EXCEPTION 'FAIL: % can be executed by PUBLIC', f.proname;
    END IF;
    IF NOT f.prosecdef OR NOT ('search_path=public, pg_temp' = ANY (COALESCE(f.proconfig, ARRAY[]::text[]))) THEN
      RAISE EXCEPTION 'FAIL: % is not SECURITY DEFINER with a pinned search path', f.proname;
    END IF;
    IF f.proname = ANY (worker) AND NOT has_function_privilege('service_role', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: the service role cannot execute %', f.proname;
    END IF;
    IF f.proname = 'enqueue_certification_notifications' AND has_function_privilege('service_role', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: the enqueue helper is executable by the service role';
    END IF;
  END LOOP;
  IF seen <> 9 THEN RAISE EXCEPTION 'FAIL: expected 9 outbox functions, found %', seen; END IF;
  RAISE NOTICE 'submission_outbox: privilege cases passed';
END $$;

-- ---------- Healing: the sweep that queues what a fault left behind ----------
DELETE FROM public.chamber_sessions;  -- a clean slate: the sweep looks at every certification
DO $$
DECLARE
  u uuid := gen_random_uuid();
  s uuid;
  s2 uuid;
  s3 uuid;
  c uuid;
  c2 uuid;
  c3 uuid;
  r jsonb;
  cert public.chamber_certifications;
  n bigint;
  i integer;
  attempted boolean;
  -- (failures so far, minutes since the last failure, whether the sweep tries it again)
  cooldowns integer[][] := ARRAY[
    [1, 1, 0], [1, 3, 1], [2, 3, 0], [2, 5, 1], [3, 7, 0], [3, 9, 1], [4, 15, 0], [4, 17, 1],
    [5, 31, 0], [5, 33, 1], [6, 59, 0], [6, 61, 1], [9, 59, 0], [9, 61, 1], [40, 59, 0], [40, 61, 1]];
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO auth.users (id, email) VALUES (u, 'heal@acme.example');

  -- A queueing fault: the submission commits, the certification is left unqueued and says why.
  s := pg_temp.new_session(u, 'Heal Co');
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
  c := pg_temp.submit(s);
  IF (SELECT status FROM public.chamber_sessions WHERE id = s) <> 'submitted' OR c IS NULL THEN
    RAISE EXCEPTION 'FAIL: the fault blocked the submission';
  END IF;
  SELECT * INTO cert FROM public.chamber_certifications WHERE id = c;
  IF cert.outbox_queued_at IS NOT NULL OR cert.outbox_failures <> 1 OR cert.outbox_last_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'FAIL: the fault was recorded as % / % / %', cert.outbox_queued_at, cert.outbox_failures, cert.outbox_last_sqlstate;
  END IF;

  -- It just failed, so the sweep leaves it alone for now.
  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '0' OR r ->> 'failed' <> '0' OR r ->> 'unqueued' <> '1' OR r ->> 'last_sqlstate' IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'FAIL: a certification in its cooldown was retried or not reported: %', r;
  END IF;
  IF (SELECT outbox_failures FROM public.chamber_certifications WHERE id = c) <> 1 THEN
    RAISE EXCEPTION 'FAIL: skipping a certification counted a failure';
  END IF;

  -- Past its cooldown it is tried again; with the fault still there it fails again and is reported.
  UPDATE public.chamber_certifications SET outbox_last_failed_at = now() - interval '3 minutes', recorded_at = now() - interval '2 hours' WHERE id = c;
  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '0' OR r ->> 'failed' <> '1' OR r ->> 'unqueued' <> '1' OR r ->> 'last_sqlstate' IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'FAIL: a persistent fault was not reported: %', r;
  END IF;
  IF (r ->> 'oldest_age_seconds')::bigint <> 7200 THEN RAISE EXCEPTION 'FAIL: the oldest unqueued certification is 2 hours old, reported %', r; END IF;
  SELECT * INTO cert FROM public.chamber_certifications WHERE id = c;
  IF cert.outbox_failures <> 2 OR cert.outbox_last_failed_at <> now() OR cert.outbox_queued_at IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a failed attempt was recorded as % / %', cert.outbox_failures, cert.outbox_last_failed_at;
  END IF;

  -- The cooldown doubles with each failure and stops at an hour.
  FOR i IN 1 .. array_length(cooldowns, 1) LOOP
    UPDATE public.chamber_certifications
    SET outbox_failures = cooldowns[i][1], outbox_last_failed_at = now() - make_interval(mins => cooldowns[i][2]) WHERE id = c;
    attempted := (pg_temp.reconcile() ->> 'failed') = '1';
    IF attempted <> (cooldowns[i][3] = 1) THEN
      RAISE EXCEPTION 'FAIL: % failures, last % minutes ago: retried = %', cooldowns[i][1], cooldowns[i][2], attempted;
    END IF;
  END LOOP;

  -- Once the fault is gone the sweep queues both notifications; the first alert is not an update.
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;
  UPDATE public.chamber_certifications SET outbox_failures = 2, outbox_last_failed_at = now() - interval '3 hours' WHERE id = c;
  r := pg_temp.reconcile();
  IF r <> jsonb_build_object('healed', 1, 'failed', 0, 'unqueued', 0, 'oldest_age_seconds', 0, 'last_sqlstate', NULL) THEN
    RAISE EXCEPTION 'FAIL: healing reported %', r;
  END IF;
  IF pg_temp.count_events(s, 'advisor_notification') <> 1 OR pg_temp.count_events(s, 'prospect_confirmation') <> 1 THEN
    RAISE EXCEPTION 'FAIL: healing did not queue both notifications';
  END IF;
  IF (SELECT (payload ->> 'resubmission')::boolean FROM public.outbox_events WHERE session_id = s AND kind = 'advisor_notification') THEN
    RAISE EXCEPTION 'FAIL: the first alert, queued late, was flagged as an update';
  END IF;
  IF (SELECT outbox_queued_at FROM public.chamber_certifications WHERE id = c) IS NULL THEN
    RAISE EXCEPTION 'FAIL: a healed certification was not marked queued';
  END IF;

  -- A second run has nothing to do.
  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '0' OR r ->> 'failed' <> '0' OR r ->> 'unqueued' <> '0' OR pg_temp.count_events(s) <> 2 THEN
    RAISE EXCEPTION 'FAIL: a second sweep was not a no-op: %', r;
  END IF;

  -- A re-certification whose queueing failed is healed as the update it is.
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Heal Corp"}' WHERE id = s;
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
  c := pg_temp.submit(s, '2026-05-02T09:00:00Z');
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;
  UPDATE public.chamber_certifications SET outbox_last_failed_at = now() - interval '3 hours' WHERE id = c;
  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '1' OR pg_temp.count_events(s, 'advisor_notification') <> 2 THEN
    RAISE EXCEPTION 'FAIL: the changed answers were not queued: %', r;
  END IF;
  IF (SELECT count(*) FROM public.outbox_events WHERE session_id = s AND kind = 'advisor_notification'
        AND (payload ->> 'resubmission')::boolean AND payload ->> 'company_name' = 'Heal Corp') <> 1 THEN
    RAISE EXCEPTION 'FAIL: the healed re-certification was not flagged as an update';
  END IF;

  RAISE NOTICE 'submission_outbox: sweep cases passed';
END $$;

-- Detection never depends on the hints: with the hint write failing too, the submission still
-- commits and the sweep still finds the certification.
DELETE FROM public.chamber_sessions;
DO $$
DECLARE
  u uuid := gen_random_uuid();
  s uuid;
  c uuid;
  r jsonb;
  cert public.chamber_certifications;
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO auth.users (id, email) VALUES (u, 'hint@acme.example');
  s := pg_temp.new_session(u, 'Hint Co');
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
  ALTER TABLE public.chamber_certifications ADD CONSTRAINT cert_test_break CHECK (outbox_failures = 0) NOT VALID;
  c := pg_temp.submit(s);
  IF (SELECT status FROM public.chamber_sessions WHERE id = s) <> 'submitted' OR c IS NULL THEN
    RAISE EXCEPTION 'FAIL: a failing hint write blocked the submission';
  END IF;
  SELECT * INTO cert FROM public.chamber_certifications WHERE id = c;
  IF cert.outbox_queued_at IS NOT NULL OR cert.outbox_failures <> 0 OR cert.outbox_last_failed_at IS NOT NULL OR cert.outbox_last_sqlstate IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: test premise: the hint should not have been written';
  END IF;
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;
  ALTER TABLE public.chamber_certifications DROP CONSTRAINT cert_test_break;
  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '1' OR r ->> 'unqueued' <> '0' OR pg_temp.count_events(s) <> 2 THEN
    RAISE EXCEPTION 'FAIL: a certification without hints was not found: %', r;
  END IF;

  RAISE NOTICE 'submission_outbox: hint-independence cases passed';
END $$;

-- One row whose failure cannot even be recorded must not abort the run and roll back the heals
-- before it.
DELETE FROM public.chamber_sessions;
DO $$
DECLARE
  u uuid := gen_random_uuid();
  s_ok uuid;
  s_bad uuid;
  c_ok uuid;
  c_bad uuid;
  r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO auth.users (id, email) VALUES (u, 'mixed@acme.example');
  s_ok := pg_temp.new_session(u, 'Mixed Healthy');
  s_bad := pg_temp.new_session(u, 'POISON');
  -- Both are left unqueued with no hints at all.
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
  ALTER TABLE public.chamber_certifications ADD CONSTRAINT cert_test_break CHECK (outbox_failures = 0) NOT VALID;
  c_ok := pg_temp.submit(s_ok);
  c_bad := pg_temp.submit(s_bad, '2026-05-01T12:00:00Z', 'Poison Signer');
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;
  ALTER TABLE public.chamber_certifications DROP CONSTRAINT cert_test_break;
  -- Now only the poison row fails to queue, and only its hint cannot be written.
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_poison CHECK (payload ->> 'company_name' IS DISTINCT FROM 'POISON') NOT VALID;
  ALTER TABLE public.chamber_certifications ADD CONSTRAINT cert_test_poison CHECK (outbox_failures = 0 OR signer_name <> 'Poison Signer') NOT VALID;
  UPDATE public.chamber_certifications SET recorded_at = now() - interval '2 hours' WHERE id = c_ok;  -- healed first
  UPDATE public.chamber_certifications SET recorded_at = now() - interval '1 hour' WHERE id = c_bad;

  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '1' OR r ->> 'failed' <> '1' OR r ->> 'unqueued' <> '1' THEN
    RAISE EXCEPTION 'FAIL: a row with an unwritable hint broke the run: %', r;
  END IF;
  IF (SELECT outbox_queued_at FROM public.chamber_certifications WHERE id = c_ok) IS NULL OR pg_temp.count_events(s_ok) <> 2 THEN
    RAISE EXCEPTION 'FAIL: the heal before the bad row was rolled back';
  END IF;
  IF pg_temp.count_events(s_bad) <> 0 OR (SELECT outbox_queued_at FROM public.chamber_certifications WHERE id = c_bad) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the poison row was queued';
  END IF;
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_poison;
  ALTER TABLE public.chamber_certifications DROP CONSTRAINT cert_test_poison;

  RAISE NOTICE 'submission_outbox: fenced-hint cases passed';
END $$;

-- Absence of queue rows means nothing; the marker on the certification is the truth.
DELETE FROM public.chamber_sessions;
DO $$
DECLARE
  u uuid := gen_random_uuid();
  s uuid;
  s2 uuid;
  s3 uuid;
  c uuid;
  c2 uuid;
  c3 uuid;
  r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO auth.users (id, email) VALUES (u, 'marker@acme.example');

  -- Deleting queue events (operators and retention do) never re-queues anything.
  s := pg_temp.new_session(u, 'Retention Co');
  c := pg_temp.submit(s);
  IF pg_temp.count_events(s) <> 2 THEN RAISE EXCEPTION 'FAIL: test premise: 2 events'; END IF;
  DELETE FROM public.outbox_events WHERE session_id = s;
  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '0' OR r ->> 'unqueued' <> '0' OR pg_temp.count_events(s) <> 0 THEN
    RAISE EXCEPTION 'FAIL: deleting queue events re-queued them: %', r;
  END IF;

  -- Queueing one again on purpose: clear its marker. Events that still exist are not duplicated.
  UPDATE public.chamber_certifications SET outbox_queued_at = NULL WHERE id = c;
  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '1' OR pg_temp.count_events(s) <> 2 OR (SELECT outbox_queued_at FROM public.chamber_certifications WHERE id = c) IS NULL THEN
    RAISE EXCEPTION 'FAIL: clearing the marker did not queue it again: %', r;
  END IF;
  UPDATE public.chamber_certifications SET outbox_queued_at = NULL WHERE id = c;
  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '1' OR pg_temp.count_events(s) <> 2 THEN
    RAISE EXCEPTION 'FAIL: queueing again duplicated events: %', r;
  END IF;

  -- A certification dismissed by an operator (marker set by hand) is ignored.
  s2 := pg_temp.new_session(u, 'Dismissed Co');
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
  c2 := pg_temp.submit(s2);
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;
  -- Past its cooldown, so only the marker keeps the sweep away from it.
  UPDATE public.chamber_certifications SET outbox_queued_at = now(), outbox_last_failed_at = now() - interval '3 hours' WHERE id = c2;
  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '0' OR r ->> 'unqueued' <> '0' OR pg_temp.count_events(s2) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a dismissed certification was queued: %', r;
  END IF;

  -- A superseded certification is never healed: the newer one carries the current data.
  s3 := pg_temp.new_session(u, 'Stale Co');
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
  c3 := pg_temp.submit(s3);
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;
  UPDATE public.chamber_sessions SET chamber_data = '{"company_name":"Stale Corp"}' WHERE id = s3;  -- withdraws it
  IF (SELECT superseded_at FROM public.chamber_certifications WHERE id = c3) IS NULL THEN
    RAISE EXCEPTION 'FAIL: test premise: the certification should be superseded';
  END IF;
  -- Past its cooldown, so only being superseded keeps the sweep away from it.
  UPDATE public.chamber_certifications SET outbox_last_failed_at = now() - interval '3 hours' WHERE id = c3;
  r := pg_temp.reconcile();
  IF r ->> 'healed' <> '0' OR r ->> 'failed' <> '0' OR r ->> 'unqueued' <> '0' OR pg_temp.count_events(s3) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a superseded certification was healed or counted: %', r;
  END IF;
  PERFORM pg_temp.must_raise(format('SELECT public.enqueue_certification_notifications(%L)', c3), 'P0001', 'enqueueing a superseded certification');
  PERFORM pg_temp.must_raise('SELECT public.enqueue_certification_notifications(gen_random_uuid())', 'P0002', 'enqueueing an unknown certification');
  IF pg_temp.count_events(s3) <> 0 THEN RAISE EXCEPTION 'FAIL: a refused enqueue still queued events'; END IF;
  -- The newer certification queues normally.
  c3 := pg_temp.submit(s3, '2026-05-02T09:00:00Z');
  IF pg_temp.count_events(s3) <> 2 OR (SELECT count(*) FROM public.outbox_events WHERE session_id = s3 AND payload ->> 'company_name' = 'Stale Corp') <> 2 THEN
    RAISE EXCEPTION 'FAIL: the newer certification was not queued with the current data';
  END IF;

  RAISE NOTICE 'submission_outbox: marker cases passed';
END $$;

-- The batch limit is honoured, and the order of a batch is fair.
DELETE FROM public.chamber_sessions;
DO $$
DECLARE
  u uuid := gen_random_uuid();
  r jsonb;
  i integer;
  c_x uuid;
  c_y uuid;
  c_z uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO auth.users (id, email) VALUES (u, 'batch@acme.example');
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
  FOR i IN 1 .. 3 LOOP
    PERFORM pg_temp.submit(pg_temp.new_session(u, 'Batch Co ' || i));
  END LOOP;
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;
  UPDATE public.chamber_certifications SET outbox_last_failed_at = now() - interval '3 hours';
  r := pg_temp.reconcile(2);
  IF r ->> 'healed' <> '2' OR r ->> 'unqueued' <> '1' THEN RAISE EXCEPTION 'FAIL: a limit of 2 gave %', r; END IF;
  r := pg_temp.reconcile(2);
  IF r ->> 'healed' <> '1' OR r ->> 'unqueued' <> '0' THEN RAISE EXCEPTION 'FAIL: the rest was not healed: %', r; END IF;

  -- A batch takes what has never been tried first, then what was tried longest ago, whatever the
  -- age of the certification.
  DELETE FROM public.chamber_sessions;
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
  c_x := pg_temp.submit(pg_temp.new_session(u, 'Tried 5h ago'));
  c_y := pg_temp.submit(pg_temp.new_session(u, 'Tried 3h ago'));
  c_z := pg_temp.submit(pg_temp.new_session(u, 'Never tried'));
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;
  UPDATE public.chamber_certifications SET recorded_at = now() - interval '1 day', outbox_failures = 1, outbox_last_failed_at = now() - interval '5 hours' WHERE id = c_x;
  UPDATE public.chamber_certifications SET recorded_at = now() - interval '3 days', outbox_failures = 1, outbox_last_failed_at = now() - interval '3 hours' WHERE id = c_y;
  UPDATE public.chamber_certifications SET recorded_at = now() - interval '2 days', outbox_failures = 0, outbox_last_failed_at = NULL WHERE id = c_z;
  PERFORM pg_temp.reconcile(1);
  IF (SELECT outbox_queued_at IS NOT NULL FROM public.chamber_certifications WHERE id = c_z) IS NOT TRUE
     OR (SELECT count(*) FROM public.chamber_certifications WHERE outbox_queued_at IS NOT NULL AND id IN (c_x, c_y)) <> 0 THEN
    RAISE EXCEPTION 'FAIL: the sweep did not take the never-tried certification first';
  END IF;
  PERFORM pg_temp.reconcile(1);
  IF (SELECT outbox_queued_at IS NOT NULL FROM public.chamber_certifications WHERE id = c_x) IS NOT TRUE
     OR (SELECT outbox_queued_at IS NOT NULL FROM public.chamber_certifications WHERE id = c_y) THEN
    RAISE EXCEPTION 'FAIL: the sweep did not take the one tried longest ago next';
  END IF;

  RAISE NOTICE 'submission_outbox: batch cases passed';
END $$;

-- Poison rows must not starve a healthy one: the 60 oldest fail every time, but each failure
-- puts the row in a cooldown, so the sweep moves on to the rest.
DELETE FROM public.chamber_sessions;
DO $$
DECLARE
  u uuid := gen_random_uuid();
  s uuid;
  c_ok uuid;
  r jsonb;
  healed integer := 0;
  failed integer := 0;
  i integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM set_config('client_min_messages', 'error', true);  -- 61 expected warnings
  INSERT INTO auth.users (id, email) VALUES (u, 'starve@acme.example');
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
  FOR i IN 1 .. 60 LOOP
    PERFORM pg_temp.submit(pg_temp.new_session(u, 'POISON'));
  END LOOP;
  c_ok := pg_temp.submit(pg_temp.new_session(u, 'Healthy Co'));
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;
  PERFORM set_config('client_min_messages', 'notice', true);
  -- From here only the poison rows fail. They are older, and failed earlier, than the healthy one.
  ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_poison CHECK (payload ->> 'company_name' IS DISTINCT FROM 'POISON') NOT VALID;
  UPDATE public.chamber_certifications c
  SET recorded_at = now() - interval '2 days' + make_interval(mins => sub.n::integer),
      outbox_failures = 1,
      outbox_last_failed_at = now() - interval '3 hours' + make_interval(secs => sub.n::integer)
  FROM (SELECT cc.id, row_number() OVER (ORDER BY cc.recorded_at, cc.id) AS n
        FROM public.chamber_certifications cc WHERE cc.id <> c_ok) sub
  WHERE c.id = sub.id;
  UPDATE public.chamber_certifications SET recorded_at = now() - interval '1 hour', outbox_failures = 1,
    outbox_last_failed_at = now() - interval '3 hours' + interval '100 seconds' WHERE id = c_ok;

  FOR i IN 1 .. 3 LOOP
    r := pg_temp.reconcile();
    healed := healed + (r ->> 'healed')::int;
    failed := failed + (r ->> 'failed')::int;
    IF i = 1 AND (r ->> 'failed')::int <> 25 THEN RAISE EXCEPTION 'FAIL: the first sweep tried % rows, not a batch of 25', r ->> 'failed'; END IF;
  END LOOP;
  IF (SELECT outbox_queued_at FROM public.chamber_certifications WHERE id = c_ok) IS NULL OR healed <> 1 OR failed <> 60 THEN
    RAISE EXCEPTION 'FAIL: poison rows starved a healthy one (healed %, failed %)', healed, failed;
  END IF;
  IF (r ->> 'unqueued')::int <> 60 OR r ->> 'last_sqlstate' IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'FAIL: the poison rows were not reported: %', r;
  END IF;
  ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_poison;

  RAISE NOTICE 'submission_outbox: starvation cases passed';
END $$;

-- ---------- The frozen send: freeze, fail, complete, reap, requeue ----------
DELETE FROM public.chamber_sessions;
DO $$
DECLARE
  u uuid := gen_random_uuid();
  sid uuid;
  eid uuid;
  eid2 uuid;
  pend jsonb;
  pend2 jsonb;
  claimed jsonb;
  ev public.outbox_events;
  msg jsonb := jsonb_build_object('from', 'Alerts <a@x.example>', 'to', jsonb_build_array('b@y.example'),
                                  'subject', 'Subject', 'text', 'Text', 'html', '<p>Text</p>');
  msg2 jsonb := msg || '{"subject":"Rebuilt"}';
  bad text;
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO auth.users (id, email) VALUES (u, 'freeze@acme.example');
  sid := pg_temp.new_session(u, 'Freeze Co');

  -- Freezing by the claimant stores the message with its key, once.
  eid := pg_temp.mk_event(sid, 'sending', 1, interval '5 minutes');
  pend := pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 1, %L)', eid, msg))::jsonb;
  IF pend IS NULL OR pend ->> 'key' !~ ('^outbox-' || eid || '-[0-9a-f]{12}$') OR pend -> 'attempt' <> '1' OR pend -> 'message' <> msg THEN
    RAISE EXCEPTION 'FAIL: freeze returned %', pend;
  END IF;
  IF abs(extract(epoch FROM now() - (pend ->> 'frozen_at')::timestamptz)) > 1 THEN
    RAISE EXCEPTION 'FAIL: frozen_at is %', pend ->> 'frozen_at';
  END IF;
  IF (pg_temp.ev(eid)).pending_send IS DISTINCT FROM pend THEN RAISE EXCEPTION 'FAIL: freeze did not return what it stored'; END IF;
  -- A second freeze does not overwrite: the key it holds is the one that may already be out there.
  IF pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 1, %L)', eid, msg2)) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a second freeze applied';
  END IF;
  IF (pg_temp.ev(eid)).pending_send IS DISTINCT FROM pend THEN RAISE EXCEPTION 'FAIL: a second freeze changed the stored message'; END IF;
  -- p_replace overwrites, with a new key.
  pend2 := pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 1, %L, true)', eid, msg2))::jsonb;
  IF pend2 IS NULL OR pend2 ->> 'key' = pend ->> 'key' OR pend2 -> 'message' <> msg2 OR (pg_temp.ev(eid)).pending_send IS DISTINCT FROM pend2 THEN
    RAISE EXCEPTION 'FAIL: replace gave %', pend2;
  END IF;

  -- Only the worker holding the claim can freeze.
  eid2 := pg_temp.mk_event(sid, 'sending', 2, interval '5 minutes');
  IF pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 1, %L)', eid2, msg)) IS NOT NULL
     OR (pg_temp.ev(eid2)).pending_send IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a stale attempt froze';
  END IF;
  FOREACH bad IN ARRAY ARRAY['pending', 'sent', 'dead'] LOOP
    eid2 := pg_temp.mk_event(sid, bad, 1);
    IF pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 1, %L)', eid2, msg)) IS NOT NULL THEN
      RAISE EXCEPTION 'FAIL: froze a % event', bad;
    END IF;
  END LOOP;
  IF pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 1, %L)', gen_random_uuid(), msg)) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: froze a row that does not exist';
  END IF;

  -- Anything but an object with the five parts is refused, and nothing is stored.
  eid2 := pg_temp.mk_event(sid, 'sending', 1, interval '5 minutes');
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.must_raise(format('SELECT public.freeze_outbox_message(%L, 1, ''"a string"'')', eid2), '22023', 'freezing a string');
  PERFORM pg_temp.must_raise(format('SELECT public.freeze_outbox_message(%L, 1, ''[]'')', eid2), '22023', 'freezing an array');
  PERFORM pg_temp.must_raise(format('SELECT public.freeze_outbox_message(%L, 1, NULL)', eid2), '22023', 'freezing null');
  PERFORM pg_temp.must_raise(format('SELECT public.freeze_outbox_message(%L, 1, %L)', eid2, msg - 'html'), '22023', 'freezing without html');
  PERFORM pg_temp.must_raise(format('SELECT public.freeze_outbox_message(%L, 1, %L)', eid2, msg - 'to'), '22023', 'freezing without a recipient');
  RESET ROLE;
  IF (pg_temp.ev(eid2)).pending_send IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a refused freeze stored something'; END IF;

  -- ---------- fail: fenced by the claim's attempt ----------
  DELETE FROM public.outbox_events;
  eid := pg_temp.mk_event(sid, 'sending', 2, interval '5 minutes');
  pend := pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 2, %L)', eid, msg))::jsonb;
  -- A worker whose claim lapsed and was taken over (attempt 1, now attempt 2) cannot write.
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''late'', 60, 1, true)', eid));
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, NULL, NULL, 1)', eid));
  ev := pg_temp.ev(eid);
  IF ev.status <> 'sending' OR ev.last_error IS NOT NULL OR ev.pending_send IS DISTINCT FROM pend OR ev.locked_until IS NULL THEN
    RAISE EXCEPTION 'FAIL: a stale worker''s failure landed: % / % / %', ev.status, ev.last_error, ev.pending_send;
  END IF;
  -- An ambiguous failure (the default) keeps the frozen message.
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''timeout'', 60, 2)', eid));
  ev := pg_temp.ev(eid);
  IF ev.status <> 'pending' OR ev.last_error <> 'timeout' OR ev.pending_send IS DISTINCT FROM pend OR ev.locked_until IS NOT NULL
     OR ev.next_attempt_at < now() + interval '50 seconds' THEN
    RAISE EXCEPTION 'FAIL: an ambiguous failure gave % / % / %', ev.status, ev.last_error, ev.pending_send;
  END IF;
  -- Explicitly not definitive: the same.
  UPDATE public.outbox_events SET status = 'sending', locked_until = now() + interval '5 minutes' WHERE id = eid;
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''provider_error:500'', 60, 2, false)', eid));
  IF (pg_temp.ev(eid)).pending_send IS DISTINCT FROM pend THEN RAISE EXCEPTION 'FAIL: a non-definitive failure dropped the frozen message'; END IF;
  -- The recorded error is bounded: it is a short kind, never a provider response body.
  UPDATE public.outbox_events SET status = 'sending', locked_until = now() + interval '5 minutes' WHERE id = eid;
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, repeat(''x'', 500), 60, 2)', eid));
  IF length((pg_temp.ev(eid)).last_error) <> 200 THEN RAISE EXCEPTION 'FAIL: last_error was not truncated'; END IF;

  -- A definitive rejection of the first send of a freeze drops it, so the next send rebuilds.
  eid := pg_temp.mk_event(sid, 'sending', 1, interval '5 minutes');
  PERFORM pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 1, %L)', eid, msg));
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''provider_error:400'', 60, 1, true)', eid));
  ev := pg_temp.ev(eid);
  IF ev.status <> 'pending' OR ev.pending_send IS NOT NULL OR ev.last_error <> 'provider_error:400' THEN
    RAISE EXCEPTION 'FAIL: a definitive first-send failure left % / %', ev.status, ev.pending_send;
  END IF;
  -- ... also when it is the last attempt.
  eid := pg_temp.mk_event(sid, 'sending', 1, interval '5 minutes');
  PERFORM pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 1, %L)', eid, msg));
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''provider_error:401'', NULL, 1, true)', eid));
  ev := pg_temp.ev(eid);
  IF ev.status <> 'dead' OR ev.pending_send IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a dead event kept its frozen message after a definitive rejection'; END IF;
  -- ... whichever claim froze it: the freeze records the attempt it was given, not the first.
  eid := pg_temp.mk_event(sid, 'sending', 3, interval '5 minutes');
  pend := pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 3, %L)', eid, msg))::jsonb;
  IF pend -> 'attempt' <> '3' THEN RAISE EXCEPTION 'FAIL: the freeze recorded attempt %', pend -> 'attempt'; END IF;
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''provider_error:403'', 60, 3, true)', eid));
  IF (pg_temp.ev(eid)).status <> 'pending' OR (pg_temp.ev(eid)).pending_send IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a definitive rejection of the first send of a later claim kept the frozen message';
  END IF;
  -- Nothing frozen is not an error.
  eid := pg_temp.mk_event(sid, 'sending', 1, interval '5 minutes');
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''no_recipient'', 60, 1, true)', eid));
  IF (pg_temp.ev(eid)).status <> 'pending' OR (pg_temp.ev(eid)).pending_send IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a definitive failure with nothing frozen went wrong';
  END IF;

  -- Timeout, then 429: the 429 answers the RETRY, so it says nothing about the first send, which
  -- may have been delivered. The frozen message, and so its key, stays.
  DELETE FROM public.outbox_events;
  eid := pg_temp.mk_event(sid, 'pending', 0);
  claimed := pg_temp.svc('SELECT jsonb_agg(to_jsonb(c)) FROM public.claim_outbox_events(ARRAY[''advisor_notification''], 10, 5) c')::jsonb;
  IF jsonb_array_length(claimed) <> 1 OR claimed -> 0 ->> 'attempts' <> '1' OR claimed -> 0 -> 'pending_send' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FAIL: first claim was %', claimed;
  END IF;
  pend := pg_temp.svc(format('SELECT public.freeze_outbox_message(%L, 1, %L)', eid, msg))::jsonb;
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''timeout'', 60, 1, false)', eid));
  UPDATE public.outbox_events SET next_attempt_at = now() - interval '1 second' WHERE id = eid;
  claimed := pg_temp.svc('SELECT jsonb_agg(to_jsonb(c)) FROM public.claim_outbox_events(ARRAY[''advisor_notification''], 10, 5) c')::jsonb;
  -- The claim hands the frozen message back to the next worker.
  IF jsonb_array_length(claimed) <> 1 OR claimed -> 0 ->> 'attempts' <> '2' OR claimed -> 0 -> 'pending_send' <> pend THEN
    RAISE EXCEPTION 'FAIL: the retry claim did not carry the frozen message: %', claimed;
  END IF;
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''provider_error:429'', 60, 2, true)', eid));
  ev := pg_temp.ev(eid);
  IF ev.status <> 'pending' OR ev.pending_send IS DISTINCT FROM pend THEN
    RAISE EXCEPTION 'FAIL: a definitive failure of a retry rotated the key: %', ev.pending_send;
  END IF;

  -- ---------- complete: clears the frozen message, and accepts a late success ----------
  UPDATE public.outbox_events SET status = 'sending', locked_until = now() + interval '5 minutes' WHERE id = eid;
  PERFORM pg_temp.svc(format('SELECT public.complete_outbox_event(%L, ''msg_ok'')', eid));
  ev := pg_temp.ev(eid);
  IF ev.status <> 'sent' OR ev.pending_send IS NOT NULL OR ev.provider_message_id <> 'msg_ok' THEN
    RAISE EXCEPTION 'FAIL: completion left % / %', ev.status, ev.pending_send;
  END IF;
  PERFORM pg_temp.svc(format('SELECT public.complete_outbox_event(%L, ''msg_again'')', eid));
  IF (pg_temp.ev(eid)).provider_message_id <> 'msg_ok' THEN RAISE EXCEPTION 'FAIL: a sent event was completed twice'; END IF;
  eid := pg_temp.mk_event(sid, 'dead', 3, NULL, pend);  -- given up on, but the message had in fact gone out
  PERFORM pg_temp.svc(format('SELECT public.complete_outbox_event(%L, ''msg_late'')', eid));
  ev := pg_temp.ev(eid);
  IF ev.status <> 'sent' OR ev.pending_send IS NOT NULL OR ev.provider_message_id <> 'msg_late' THEN
    RAISE EXCEPTION 'FAIL: a late success was dropped or kept its frozen message: % / %', ev.status, ev.pending_send;
  END IF;

  RAISE NOTICE 'submission_outbox: freeze, fail and complete cases passed';
END $$;

-- ---------- reap ----------
DO $$
DECLARE
  u uuid := gen_random_uuid();
  sid uuid;
  e_lost uuid;
  e_maybe uuid;
  e_live uuid;
  e_retry uuid;
  e_stale uuid;
  e_pending uuid;
  reaped jsonb;
  claimed int;
  frozen jsonb := jsonb_build_object('key', 'outbox-x-0123456789ab', 'attempt', 1, 'frozen_at', '2026-05-01T12:00:00.000Z',
    'message', jsonb_build_object('from', 'a@x.example', 'to', jsonb_build_array('b@y.example'), 'subject', 's', 'text', 't', 'html', 'h'));
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO auth.users (id, email) VALUES (u, 'reap@acme.example');
  sid := pg_temp.new_session(u, 'Reap Co');
  DELETE FROM public.outbox_events;
  e_lost := pg_temp.mk_event(sid, 'sending', 5, interval '-1 minute');
  e_maybe := pg_temp.mk_event(sid, 'sending', 5, interval '-1 minute', frozen);
  e_live := pg_temp.mk_event(sid, 'sending', 5, interval '1 minute', frozen);
  e_retry := pg_temp.mk_event(sid, 'sending', 2, interval '-1 minute');
  e_pending := pg_temp.mk_event(sid, 'pending', 5);

  -- Claiming retries the one with attempts left and no longer touches the exhausted ones.
  claimed := pg_temp.svc('SELECT count(*) FROM public.claim_outbox_events(ARRAY[''advisor_notification''], 10, 5)')::int;
  IF claimed <> 1 OR (pg_temp.ev(e_retry)).attempts <> 3 THEN RAISE EXCEPTION 'FAIL: claim returned % events', claimed; END IF;
  IF (pg_temp.ev(e_lost)).status <> 'sending' OR (pg_temp.ev(e_maybe)).status <> 'sending' THEN
    RAISE EXCEPTION 'FAIL: claiming gave up on an exhausted lapsed claim';
  END IF;
  -- A lapsed claim with one attempt left, made only now: the claim above would have taken it, and
  -- once reclaimed it is no longer lapsed, which would hide a reaper that ignores the attempts.
  e_stale := pg_temp.mk_event(sid, 'sending', 4, interval '-1 minute');

  -- The reaper kills exactly the exhausted lapsed claims and says which, and whether a message
  -- had been frozen (so may have gone out).
  reaped := pg_temp.svc('SELECT jsonb_agg(to_jsonb(r) ORDER BY r.last_error) FROM public.reap_outbox_events(5) r')::jsonb;
  IF reaped <> jsonb_build_array(
       jsonb_build_object('id', e_lost, 'kind', 'advisor_notification', 'attempts', 5, 'last_error', 'worker_lost'),
       jsonb_build_object('id', e_maybe, 'kind', 'advisor_notification', 'attempts', 5, 'last_error', 'worker_lost_maybe_sent')) THEN
    RAISE EXCEPTION 'FAIL: reap returned %', reaped;
  END IF;
  IF (pg_temp.ev(e_lost)).status <> 'dead' OR (pg_temp.ev(e_lost)).locked_until IS NOT NULL
     OR (pg_temp.ev(e_maybe)).status <> 'dead' OR (pg_temp.ev(e_maybe)).pending_send IS NULL THEN
    RAISE EXCEPTION 'FAIL: reaped events are not dead, or lost their frozen message';
  END IF;
  -- Untouched: a live claim, one the claim above took over, one still lapsed with an attempt left
  -- (the next claim's to retry), one not being sent.
  IF (pg_temp.ev(e_live)).status <> 'sending' OR (pg_temp.ev(e_live)).locked_until IS NULL
     OR (pg_temp.ev(e_retry)).status <> 'sending' OR (pg_temp.ev(e_pending)).status <> 'pending' THEN
    RAISE EXCEPTION 'FAIL: reap touched an event it should not';
  END IF;
  IF (pg_temp.ev(e_stale)).status <> 'sending' OR (pg_temp.ev(e_stale)).attempts <> 4 OR (pg_temp.ev(e_stale)).last_error IS NOT NULL
     OR (pg_temp.ev(e_stale)).locked_until >= now() THEN
    RAISE EXCEPTION 'FAIL: reap gave up on a lapsed claim that still had an attempt left';
  END IF;
  -- And nothing is reported twice.
  IF pg_temp.svc('SELECT count(*) FROM public.reap_outbox_events(5)')::int <> 0 THEN RAISE EXCEPTION 'FAIL: reap reported an event twice'; END IF;

  RAISE NOTICE 'submission_outbox: reap cases passed';
END $$;

-- ---------- requeue ----------
DO $$
DECLARE
  u uuid := gen_random_uuid();
  sid uuid;
  e_dead uuid;
  e_keep uuid;
  e_rebuild uuid;
  e_other uuid;
  ev public.outbox_events;
  frozen jsonb := jsonb_build_object('key', 'outbox-x-0123456789ab', 'attempt', 1, 'frozen_at', '2026-05-01T12:00:00.000Z',
    'message', jsonb_build_object('from', 'a@x.example', 'to', jsonb_build_array('b@y.example'), 'subject', 's', 'text', 't', 'html', 'h'));
  st text;
BEGIN
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO auth.users (id, email) VALUES (u, 'requeue@acme.example');
  sid := pg_temp.new_session(u, 'Requeue Co');
  DELETE FROM public.outbox_events;

  -- Only a dead event is requeued.
  FOREACH st IN ARRAY ARRAY['pending', 'sending', 'sent'] LOOP
    e_other := pg_temp.mk_event(sid, st, 3, CASE WHEN st = 'sending' THEN interval '1 minute' END, frozen);
    IF pg_temp.svc(format('SELECT public.requeue_outbox_event(%L)', e_other))::boolean
       OR pg_temp.svc(format('SELECT public.requeue_outbox_event(%L, true)', e_other))::boolean THEN
      RAISE EXCEPTION 'FAIL: requeued a % event', st;
    END IF;
    ev := pg_temp.ev(e_other);
    IF ev.status <> st OR ev.attempts <> 3 OR ev.pending_send IS DISTINCT FROM frozen THEN RAISE EXCEPTION 'FAIL: refusing to requeue a % event changed it', st; END IF;
  END LOOP;
  IF pg_temp.svc(format('SELECT public.requeue_outbox_event(%L)', gen_random_uuid()))::boolean THEN
    RAISE EXCEPTION 'FAIL: requeued a row that does not exist';
  END IF;
  DELETE FROM public.outbox_events;

  -- A dead event goes back as new; nothing was frozen, so there is nothing to keep.
  e_dead := pg_temp.mk_event(sid, 'dead', 5);
  UPDATE public.outbox_events SET last_error = 'provider_error:400', next_attempt_at = now() + interval '1 day' WHERE id = e_dead;
  IF NOT pg_temp.svc(format('SELECT public.requeue_outbox_event(%L)', e_dead))::boolean THEN RAISE EXCEPTION 'FAIL: a dead event was not requeued'; END IF;
  ev := pg_temp.ev(e_dead);
  IF ev.status <> 'pending' OR ev.attempts <> 0 OR ev.last_error IS NOT NULL OR ev.locked_until IS NOT NULL
     OR ev.next_attempt_at > now() OR ev.pending_send IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a requeued event is %/%/%', ev.status, ev.attempts, ev.last_error;
  END IF;
  -- Once requeued it is pending, so a second requeue does nothing.
  IF pg_temp.svc(format('SELECT public.requeue_outbox_event(%L)', e_dead))::boolean THEN RAISE EXCEPTION 'FAIL: requeued twice'; END IF;

  -- By default the frozen message stays, so the retry carries the same key.
  e_keep := pg_temp.mk_event(sid, 'dead', 5, NULL, frozen);
  IF NOT pg_temp.svc(format('SELECT public.requeue_outbox_event(%L)', e_keep))::boolean THEN RAISE EXCEPTION 'FAIL: a dead event was not requeued'; END IF;
  ev := pg_temp.ev(e_keep);
  IF ev.status <> 'pending' OR ev.attempts <> 0 OR ev.pending_send ->> 'key' <> frozen ->> 'key' OR ev.pending_send -> 'message' <> frozen -> 'message' THEN
    RAISE EXCEPTION 'FAIL: a keep-requeue changed the frozen message: %', ev.pending_send;
  END IF;
  -- Attempts restarted at 0, so a definitive answer to the first CLAIM after the requeue (attempt
  -- 1, the number it was frozen under) must not be taken for the answer to the first send.
  DELETE FROM public.outbox_events WHERE id <> e_keep;
  IF pg_temp.svc('SELECT count(*) FROM public.claim_outbox_events(ARRAY[''advisor_notification''], 10, 5)')::int <> 1
     OR (pg_temp.ev(e_keep)).attempts <> 1 THEN
    RAISE EXCEPTION 'FAIL: a requeued event was not claimed as attempt 1';
  END IF;
  PERFORM pg_temp.svc(format('SELECT public.fail_outbox_event(%L, ''provider_error:429'', 60, 1, true)', e_keep));
  IF (pg_temp.ev(e_keep)).pending_send ->> 'key' IS DISTINCT FROM frozen ->> 'key' THEN
    RAISE EXCEPTION 'FAIL: a definitive failure after a keep-requeue rotated the key';
  END IF;

  -- A rebuild drops it: the next send is built from the current settings, under a new key.
  e_rebuild := pg_temp.mk_event(sid, 'dead', 5, NULL, frozen);
  IF NOT pg_temp.svc(format('SELECT public.requeue_outbox_event(%L, true)', e_rebuild))::boolean THEN RAISE EXCEPTION 'FAIL: a dead event was not requeued'; END IF;
  ev := pg_temp.ev(e_rebuild);
  IF ev.status <> 'pending' OR ev.attempts <> 0 OR ev.pending_send IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a rebuild-requeue kept the frozen message: %', ev.pending_send;
  END IF;

  RAISE NOTICE 'submission_outbox: requeue cases passed';
END $$;

DELETE FROM public.chamber_sessions;

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
  -- Every one of those certifications was queued or superseded by one that was.
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = '00000000-0000-0000-0000-0000000000b1' AND outbox_queued_at IS NULL) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a retried certification was left unmarked';
  END IF;
  RAISE NOTICE 'submission_outbox: retry cases passed';
END $$;

-- ---------- A queueing fault across real transactions ----------
-- Each statement is its own transaction again, so the fault, the sweeps and their cooldown are
-- separated by real time, not one frozen now().
CREATE TEMP TABLE sweep_log (n serial PRIMARY KEY, r jsonb);
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000a2', 'fault@acme.example');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","is_anonymous":false}', false);
INSERT INTO public.chamber_sessions (id, user_id, chamber_data)
VALUES ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', '{"company_name":"Fault Co"}');
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_test_break CHECK (false) NOT VALID;
UPDATE public.chamber_sessions SET status = 'submitted', submission =
  '{"signer_name":"Jo","signer_title":"CEO","signed_at":"2026-05-01T12:00:00Z","file_id":"EAA-2026-FAULT001","consent_version":"v1","consent_text":"I certify.","chamber_data":{"company_name":"Fault Co"}}'
WHERE id = '00000000-0000-0000-0000-0000000000b2';
ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_test_break;

DO $$
BEGIN
  IF (SELECT status FROM public.chamber_sessions WHERE id = '00000000-0000-0000-0000-0000000000b2') <> 'submitted' THEN
    RAISE EXCEPTION 'FAIL: the committed submission was lost with the queueing fault';
  END IF;
  IF (SELECT count(*) FROM public.chamber_certifications WHERE session_id = '00000000-0000-0000-0000-0000000000b2'
        AND outbox_queued_at IS NULL AND outbox_failures = 1 AND outbox_last_sqlstate = '23514') <> 1 THEN
    RAISE EXCEPTION 'FAIL: the committed fault was not left on the certification';
  END IF;
END $$;

INSERT INTO sweep_log (r) SELECT pg_temp.reconcile();  -- moments after the failure: in its cooldown
UPDATE public.chamber_certifications SET outbox_last_failed_at = now() - interval '3 minutes'
WHERE session_id = '00000000-0000-0000-0000-0000000000b2';
INSERT INTO sweep_log (r) SELECT pg_temp.reconcile();  -- past it: healed

DO $$
DECLARE
  first_run jsonb := (SELECT r FROM sweep_log WHERE n = 1);
  second_run jsonb := (SELECT r FROM sweep_log WHERE n = 2);
BEGIN
  IF first_run ->> 'healed' <> '0' OR first_run ->> 'failed' <> '0' OR first_run ->> 'unqueued' <> '1' THEN
    RAISE EXCEPTION 'FAIL: the cooldown did not hold across transactions: %', first_run;
  END IF;
  IF second_run ->> 'healed' <> '1' OR second_run ->> 'unqueued' <> '0' THEN
    RAISE EXCEPTION 'FAIL: the sweep did not heal after the cooldown: %', second_run;
  END IF;
  IF (SELECT count(*) FROM public.outbox_events WHERE session_id = '00000000-0000-0000-0000-0000000000b2') <> 2 THEN
    RAISE EXCEPTION 'FAIL: healing across transactions queued % events', (SELECT count(*) FROM public.outbox_events WHERE session_id = '00000000-0000-0000-0000-0000000000b2');
  END IF;
  IF (SELECT count(*) FROM public.chamber_certifications c WHERE c.session_id = '00000000-0000-0000-0000-0000000000b2'
        AND c.outbox_queued_at > c.recorded_at) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the healed certification was not marked at heal time';
  END IF;
  RAISE NOTICE 'submission_outbox: cross-transaction fault cases passed';
END $$;
