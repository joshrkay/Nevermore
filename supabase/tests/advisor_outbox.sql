-- Run against a scratch Postgres (NOT production); it drops and recreates the `public`, `storage`
-- and `auth` schemas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/advisor_outbox.sql
-- The advisor's view of the notification queue (G-1.3), on the real advisor-role migrations: who may
-- list it, count it and retry a dead event, what they are shown, and that a retry is recorded.
-- Callers are exercised as signed-out, guest, prospect, advisor and admin, with the roles
-- PostgREST connects as. The send itself is the worker's and is covered in submission_outbox.sql.
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS storage CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
-- Supabase grants table access to these roles by default and relies on row security.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);

CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  name text NOT NULL
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
-- Supabase's helper: the folder segments of an object path, without the file name.
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
  $$ SELECT string_to_array(regexp_replace(name, '/?[^/]*$', ''), '/') $$;
-- Mirrors "Users can view their own documents" from 20260323224722, under the same name so that
-- 20261023090000 replaces it as it does in production (the original migration also creates the
-- stubbed `documents` table, so it can't be loaded here).
CREATE POLICY "Users can view their own documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  company_name text,
  contact_name text,
  phone text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Same columns as 20260323224722; the NOT NULL ones get defaults so seed rows can stay short.
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT 'f.pdf',
  file_size text NOT NULL DEFAULT '0',
  doc_type text NOT NULL DEFAULT 'other',
  storage_path text NOT NULL DEFAULT 'x',
  status text NOT NULL DEFAULT 'uploaded',
  metadata text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own documents" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own documents" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.chamber_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chamber_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress',
  submission jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chamber_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.chamber_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.chamber_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.chamber_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Supabase grants table access, and EXECUTE on new functions, to these roles by default: a function
-- is only closed to clients if its migration says so.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

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
\i supabase/migrations/20261027095000_outbox_operations.sql
\i supabase/migrations/20261028090000_email_delivery_events.sql
\i supabase/migrations/20261030090000_outbox_census_headcount.sql
\i supabase/migrations/20261030091000_email_delivery_hardening.sql

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

CREATE FUNCTION pg_temp.as_user(uid uuid, guest boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'is_anonymous', guest, 'role', 'authenticated')::text, false);
END $$;

-- An event in `p_status` for `p_sid`, with a payload like the real one (recipient included, so a
-- leak into the advisor's view would show).
CREATE FUNCTION pg_temp.mk_event(p_sid uuid, p_kind text, p_status text, p_attempts integer DEFAULT 0,
                                 p_lock interval DEFAULT NULL, p_pending jsonb DEFAULT NULL, p_error text DEFAULT NULL)
RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, status, attempts, locked_until, claimed_at, pending_send, last_error)
  VALUES (p_kind, p_sid, gen_random_uuid()::text,
          jsonb_build_object('reference', 'EAA-2026-TEST', 'company_name', 'Acme', 'resubmission', false,
                             'recipient_email', 'secret.prospect@acme.example', 'contact_phone', '555-0199'),
          p_status, p_attempts,
          CASE WHEN p_lock IS NULL THEN NULL ELSE now() + p_lock END,
          CASE WHEN p_status = 'claimed' THEN now() ELSE NULL END,
          p_pending, p_error)
  RETURNING id
$$;

DO $$
DECLARE
  adv uuid := gen_random_uuid();
  adm uuid := gen_random_uuid();
  prospect uuid := gen_random_uuid();
  guest uuid := gen_random_uuid();
  sid uuid := gen_random_uuid();
  e_dead uuid; e_dead_frozen uuid; e_dead_rebuild uuid; e_sent uuid; e_pending uuid; e_claimed uuid; e_lapsed uuid; e_missing uuid := gen_random_uuid();
  frozen_send jsonb := jsonb_build_object('key', 'outbox-x-0123456789ab', 'attempt', 3, 'frozen_at', '2026-05-01T12:00:00.000Z',
    'message', jsonb_build_object('from', 'a@x.example', 'to', jsonb_build_array('b@y.example'), 'subject', 's', 'text', 't', 'html', 'h'));
  r record;
  n integer;
  ev public.outbox_events;
  keys text[];
BEGIN
  INSERT INTO auth.users (id, email) VALUES (adv, 'adv@acme.example'), (adm, 'adm@acme.example'), (prospect, 'secret.prospect@acme.example'), (guest, NULL);
  INSERT INTO public.user_roles (user_id, role) VALUES (adv, 'advisor'), (adm, 'admin');
  INSERT INTO public.chamber_sessions (id, user_id, chamber_data) VALUES (sid, prospect, '{"company_name":"Acme"}');

  e_dead := pg_temp.mk_event(sid, 'advisor_notification', 'dead', 5, NULL, NULL, 'provider_error:500');
  e_dead_frozen := pg_temp.mk_event(sid, 'prospect_confirmation', 'dead', 5, NULL, frozen_send, 'timeout');
  e_dead_rebuild := pg_temp.mk_event(sid, 'prospect_confirmation', 'dead', 5, NULL, frozen_send, 'timeout');
  e_sent := pg_temp.mk_event(sid, 'advisor_notification', 'sent', 1);
  e_pending := pg_temp.mk_event(sid, 'advisor_notification', 'pending', 2, NULL, NULL, 'not_configured: ADVISORY_NOTIFY_EMAIL is not set to valid address(es)');
  e_claimed := pg_temp.mk_event(sid, 'advisor_notification', 'claimed', 1, interval '5 minutes');
  e_lapsed := pg_temp.mk_event(sid, 'advisor_notification', 'claimed', 2, interval '-1 minute');
  UPDATE public.outbox_events SET next_attempt_at = now() - interval '30 minutes' WHERE id = e_pending;
  -- Distinct creation times (a transaction's now() is one value), in an order unrelated to the ids.
  UPDATE public.outbox_events o SET created_at = now() - (g.n * interval '1 minute')
  FROM (SELECT id, row_number() OVER (ORDER BY md5(id::text)) AS n FROM public.outbox_events) g WHERE o.id = g.id;

  SET LOCAL ROLE authenticated;

  -- ---------- Who may use it: the database refuses everyone but advisors and admins ----------
  -- 42501 is what PostgREST answers with HTTP 403.
  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM pg_temp.must_raise('SELECT * FROM public.advisor_list_outbox_events()', '42501', 'a signed-out caller listing');
  PERFORM pg_temp.as_user(guest, true);
  PERFORM pg_temp.must_raise('SELECT * FROM public.advisor_list_outbox_events()', '42501', 'a guest listing');
  PERFORM pg_temp.as_user(prospect);
  PERFORM pg_temp.must_raise('SELECT * FROM public.advisor_list_outbox_events()', '42501', 'a prospect listing');
  PERFORM pg_temp.must_raise('SELECT * FROM public.advisor_list_outbox_events(''dead'')', '42501', 'a prospect listing dead events');
  PERFORM pg_temp.must_raise('SELECT * FROM public.advisor_outbox_summary()', '42501', 'a prospect reading the summary');
  PERFORM pg_temp.must_raise(format('SELECT public.advisor_requeue_outbox_event(%L)', e_dead), '42501', 'a prospect retrying');
  PERFORM pg_temp.must_raise(format('SELECT public.advisor_requeue_outbox_event(%L, true)', e_dead), '42501', 'a prospect retrying with a rebuild');
  -- And not around the functions either.
  PERFORM pg_temp.must_raise('SELECT count(*) FROM public.outbox_events', '42501', 'a prospect reading the queue table');
  PERFORM pg_temp.must_raise(format('UPDATE public.outbox_events SET status = ''pending'' WHERE id = %L', e_dead), '42501', 'a prospect updating the queue table');
  PERFORM pg_temp.must_raise(format('SELECT public.requeue_outbox_event(%L)', e_dead), '42501', 'a prospect calling the worker requeue');
  RESET ROLE;
  IF (SELECT status FROM public.outbox_events WHERE id = e_dead) <> 'dead' THEN RAISE EXCEPTION 'FAIL: a refused retry changed the event'; END IF;
  IF EXISTS (SELECT 1 FROM public.outbox_events WHERE requeue_count > 0) THEN RAISE EXCEPTION 'FAIL: a refused retry was recorded'; END IF;

  -- The anon role cannot even reach them.
  SET LOCAL ROLE anon;
  PERFORM pg_temp.must_raise('SELECT * FROM public.advisor_list_outbox_events()', '42501', 'anon listing');
  PERFORM pg_temp.must_raise(format('SELECT public.advisor_requeue_outbox_event(%L)', e_dead), '42501', 'anon retrying');
  RESET ROLE;

  -- ---------- What an advisor sees ----------
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.as_user(adv);
  SELECT count(*) INTO n FROM public.advisor_list_outbox_events();
  IF n <> 7 THEN RAISE EXCEPTION 'FAIL: the advisor sees % of 7 events', n; END IF;
  SELECT count(*) INTO n FROM public.advisor_list_outbox_events('dead');
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL: the dead filter returned % of 3', n; END IF;
  SELECT count(*) INTO n FROM public.advisor_list_outbox_events('sent');
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: the sent filter returned %', n; END IF;
  SELECT count(*) INTO n FROM public.advisor_list_outbox_events('pending');
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: the pending filter returned %', n; END IF;
  SELECT count(*) INTO n FROM public.advisor_list_outbox_events('claimed');
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: the claimed filter returned %', n; END IF;
  PERFORM pg_temp.must_raise('SELECT * FROM public.advisor_list_outbox_events(''sending'')', '22023', 'the retired status name');
  PERFORM pg_temp.must_raise('SELECT * FROM public.advisor_list_outbox_events(''bogus'')', '22023', 'an unknown status');
  SELECT count(*) INTO n FROM public.advisor_list_outbox_events(NULL, 2);
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: the limit was ignored: %', n; END IF;
  SELECT count(*) INTO n FROM public.advisor_list_outbox_events(NULL, 0);
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: a zero limit should clamp to 1: %', n; END IF;

  SELECT * INTO r FROM public.advisor_list_outbox_events('pending');
  IF r.id <> e_pending OR r.kind <> 'advisor_notification' OR r.attempts <> 2 OR r.company_name <> 'Acme' OR r.reference <> 'EAA-2026-TEST'
     OR r.session_id <> sid OR r.resubmission OR r.frozen OR r.requeue_count <> 0
     OR r.last_error <> 'not_configured: ADVISORY_NOTIFY_EMAIL is not set to valid address(es)' THEN
    RAISE EXCEPTION 'FAIL: a pending row is %', to_jsonb(r);
  END IF;
  -- A claim with a live lease is not lapsed; one past its lease is.
  IF (SELECT claim_lapsed FROM public.advisor_list_outbox_events('claimed') WHERE id = e_claimed)
     OR NOT (SELECT claim_lapsed FROM public.advisor_list_outbox_events('claimed') WHERE id = e_lapsed) THEN
    RAISE EXCEPTION 'FAIL: claim_lapsed is wrong';
  END IF;
  IF NOT (SELECT frozen FROM public.advisor_list_outbox_events('dead') WHERE id = e_dead_frozen)
     OR (SELECT frozen FROM public.advisor_list_outbox_events('dead') WHERE id = e_dead) THEN
    RAISE EXCEPTION 'FAIL: frozen does not say whether an email was already written';
  END IF;
  -- Newest first.
  IF (SELECT array_agg(x.id ORDER BY x.created_at DESC) FROM public.advisor_list_outbox_events() x) IS DISTINCT FROM
     (SELECT array_agg(x.id) FROM public.advisor_list_outbox_events() x) THEN
    RAISE EXCEPTION 'FAIL: the list is not newest first';
  END IF;
  -- A projection: no payload, no frozen email, nobody's address or phone.
  SELECT array_agg(k ORDER BY k) INTO keys FROM (SELECT jsonb_object_keys(to_jsonb(x)) k FROM public.advisor_list_outbox_events(NULL, 1) x) q;
  IF keys && ARRAY['payload', 'pending_send', 'dedupe_key', 'recipient_email', 'locked_until'] THEN
    RAISE EXCEPTION 'FAIL: the advisor list exposes internals: %', keys;
  END IF;
  IF (SELECT string_agg(to_jsonb(x)::text, ' ') FROM public.advisor_list_outbox_events() x) ~* 'secret\.prospect|555-0199|b@y\.example|outbox-x-' THEN
    RAISE EXCEPTION 'FAIL: the advisor list leaks a recipient, phone or frozen email';
  END IF;

  -- The summary: one row per status, zeros included, and how long the longest-waiting due event has waited.
  SELECT count(*) INTO n FROM public.advisor_outbox_summary();
  IF n <> 5 THEN RAISE EXCEPTION 'FAIL: the summary has % rows', n; END IF;
  IF (SELECT events FROM public.advisor_outbox_summary() WHERE status = 'dead') <> 3
     OR (SELECT events FROM public.advisor_outbox_summary() WHERE status = 'pending') <> 1
     OR (SELECT events FROM public.advisor_outbox_summary() WHERE status = 'claimed') <> 2
     OR (SELECT events FROM public.advisor_outbox_summary() WHERE status = 'sent') <> 1 THEN
    RAISE EXCEPTION 'FAIL: the summary counts are wrong: %', (SELECT jsonb_agg(to_jsonb(s)) FROM public.advisor_outbox_summary() s);
  END IF;
  IF (SELECT oldest_due_at FROM public.advisor_outbox_summary() WHERE status = 'pending') > now() - interval '29 minutes'
     OR (SELECT count(*) FROM public.advisor_outbox_summary() WHERE status <> 'pending' AND oldest_due_at IS NOT NULL) <> 0 THEN
    RAISE EXCEPTION 'FAIL: oldest_due_at is wrong';
  END IF;

  -- ---------- Retry ----------
  -- Not dead: nothing to do, and nothing changes (a double click, or an event that was sent meanwhile).
  IF public.advisor_requeue_outbox_event(e_sent) OR public.advisor_requeue_outbox_event(e_pending, true)
     OR public.advisor_requeue_outbox_event(e_claimed) OR public.advisor_requeue_outbox_event(e_missing) THEN
    RAISE EXCEPTION 'FAIL: retried an event that was not dead, or one that does not exist';
  END IF;
  PERFORM pg_temp.must_raise('SELECT public.advisor_requeue_outbox_event(NULL)', '22023', 'retrying nothing');

  -- A dead event goes back as new: attempts 0, pending, due now, error cleared, recorded against the advisor.
  IF NOT public.advisor_requeue_outbox_event(e_dead) THEN RAISE EXCEPTION 'FAIL: a dead event was not requeued'; END IF;
  RESET ROLE;
  ev := (SELECT e FROM public.outbox_events e WHERE e.id = e_dead);
  IF ev.status <> 'pending' OR ev.attempts <> 0 OR ev.next_attempt_at > now() OR ev.last_error IS NOT NULL OR ev.locked_until IS NOT NULL OR ev.claimed_at IS NOT NULL
     OR ev.requeue_count <> 1 OR ev.last_requeued_by <> adv OR ev.last_requeued_at IS NULL THEN
    RAISE EXCEPTION 'FAIL: a requeued event is %/%/%/%', ev.status, ev.attempts, ev.last_error, ev.last_requeued_by;
  END IF;
  -- Untouched neighbours.
  IF (SELECT status FROM public.outbox_events WHERE id = e_dead_frozen) <> 'dead' OR (SELECT status FROM public.outbox_events WHERE id = e_sent) <> 'sent'
     OR (SELECT attempts FROM public.outbox_events WHERE id = e_pending) <> 2 THEN
    RAISE EXCEPTION 'FAIL: a retry touched another event';
  END IF;
  SET LOCAL ROLE authenticated;
  -- Once pending, a second click does nothing.
  IF public.advisor_requeue_outbox_event(e_dead) THEN RAISE EXCEPTION 'FAIL: requeued twice'; END IF;

  -- Without a rebuild the email already written is kept (same key, so the provider can de-duplicate).
  -- An admin can do it too.
  PERFORM pg_temp.as_user(adm);
  IF NOT public.advisor_requeue_outbox_event(e_dead_frozen, false) THEN RAISE EXCEPTION 'FAIL: an admin could not retry'; END IF;
  RESET ROLE;
  ev := (SELECT e FROM public.outbox_events e WHERE e.id = e_dead_frozen);
  IF ev.status <> 'pending' OR ev.pending_send ->> 'key' <> frozen_send ->> 'key' OR ev.pending_send -> 'message' <> frozen_send -> 'message'
     OR (ev.pending_send ->> 'attempt')::int <> 0 OR ev.last_requeued_by <> adm THEN
    RAISE EXCEPTION 'FAIL: a plain retry changed the frozen email: %', ev.pending_send;
  END IF;
  -- With rebuild_payload the email is rebuilt from the current settings under a new key.
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.as_user(adv);
  IF NOT public.advisor_requeue_outbox_event(e_dead_rebuild, true) THEN RAISE EXCEPTION 'FAIL: a rebuild retry was not requeued'; END IF;
  RESET ROLE;
  ev := (SELECT e FROM public.outbox_events e WHERE e.id = e_dead_rebuild);
  IF ev.status <> 'pending' OR ev.pending_send IS NOT NULL OR ev.attempts <> 0 THEN
    RAISE EXCEPTION 'FAIL: a rebuild retry kept the frozen email: %', ev.pending_send;
  END IF;

  -- ---------- The next worker run sends it ----------
  -- The retried events are due and are claimed like any other (as the service role the worker uses).
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.claim_outbox_events(ARRAY['advisor_notification', 'prospect_confirmation'], 10, 5);
  RESET ROLE;
  -- The 3 retried, the pending event that is due, and the lapsed claim it takes over. Not the live
  -- claim, and not the sent event.
  IF n <> 5 THEN RAISE EXCEPTION 'FAIL: the worker claimed % events, expected 5', n; END IF;
  IF (SELECT status FROM public.outbox_events WHERE id = e_claimed) <> 'claimed' OR (SELECT attempts FROM public.outbox_events WHERE id = e_claimed) <> 1
     OR (SELECT attempts FROM public.outbox_events WHERE id = e_lapsed) <> 3 OR (SELECT attempts FROM public.outbox_events WHERE id = e_pending) <> 3 THEN
    RAISE EXCEPTION 'FAIL: the worker claimed the wrong events';
  END IF;
  IF (SELECT status FROM public.outbox_events WHERE id = e_dead) <> 'claimed' OR (SELECT attempts FROM public.outbox_events WHERE id = e_dead) <> 1 THEN
    RAISE EXCEPTION 'FAIL: a retried event was not claimed as attempt 1';
  END IF;
  SET LOCAL ROLE service_role;
  PERFORM public.complete_outbox_event(e_dead, 'msg_ok');
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.as_user(adv);
  IF (SELECT status FROM public.advisor_list_outbox_events() WHERE id = e_dead) <> 'sent'
     OR (SELECT requeue_count FROM public.advisor_list_outbox_events() WHERE id = e_dead) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the retried event does not show as sent, once retried';
  END IF;
  RESET ROLE;

  RAISE NOTICE 'advisor_outbox: all cases passed';
END $$;

-- ====================================================================================
-- Bounce and suppression handling (G-2.2): the provider's webhook events, replayed.
-- ====================================================================================
-- Runs the way the webhook function does: as the service role, one event per call.
CREATE FUNCTION pg_temp.hook(p_id text, p_type text, p_msg text, p_to text[], p_bounce text DEFAULT NULL,
                             p_detail text DEFAULT NULL, p_protected text[] DEFAULT ARRAY['team@acme.test']) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  SET LOCAL ROLE service_role;
  SELECT public.record_email_delivery_event(p_id, p_type, p_msg, p_to, p_bounce, p_detail, '2026-10-28T12:00:00Z', p_protected) INTO r;
  RESET ROLE;
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.mk_conf(p_sid uuid, p_to text, p_status text, p_msg text DEFAULT NULL, p_kind text DEFAULT 'prospect_confirmation') RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload, status, provider_message_id, next_attempt_at)
  VALUES (p_kind, p_sid, gen_random_uuid()::text,
          jsonb_build_object('reference', 'EAA-2026-HOOK', 'company_name', 'Hook Co', 'recipient_email', p_to),
          p_status, p_msg, now() - interval '1 minute')
  RETURNING id
$$;

DO $$
DECLARE
  adv uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); p3 uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); s3 uuid := gen_random_uuid();
  conf1 uuid; conf2 uuid; conf3 uuid; conf4 uuid; conf5 uuid; alert1 uuid;
  r jsonb; n integer; ev public.outbox_events; sup public.email_suppressions;
BEGIN
  DELETE FROM public.outbox_events;
  INSERT INTO auth.users (id, email) VALUES (adv, 'adv2@acme.example'), (p1, 'bounce1@x.example'), (p2, 'ok@x.example'), (p3, 'late@x.example');
  INSERT INTO public.user_roles (user_id, role) VALUES (adv, 'advisor');
  INSERT INTO public.chamber_sessions (id, user_id, chamber_data) VALUES (s1, p1, '{"company_name":"One"}'), (s2, p2, '{"company_name":"Two"}'), (s3, p3, '{"company_name":"Three"}');
  conf1 := pg_temp.mk_conf(s1, 'bounce1@x.example', 'sent', 'msg-1');
  conf2 := pg_temp.mk_conf(s1, 'bounce1@x.example', 'pending');            -- a re-certification's confirmation, still waiting
  conf3 := pg_temp.mk_conf(s2, 'ok@x.example', 'pending');
  conf4 := pg_temp.mk_conf(s2, 'ok@x.example', 'sent', 'msg-4');
  alert1 := pg_temp.mk_conf(s1, NULL, 'sent', 'msg-adv', 'advisor_notification');

  -- ---------- A permanent bounce suppresses the address, once ----------
  -- The provider reports every recipient of the message; ours has one, so only that address is the bounce's.
  r := pg_temp.hook('evt_1', 'email.bounced', 'msg-1', ARRAY['Bounce1@X.example', 'other@x.example'], 'Permanent',
                    'The mailbox bounce1@x.example does not exist');
  IF r ->> 'duplicate' <> 'false' OR r ->> 'outcome' <> 'suppressed' OR (r ->> 'suppressed')::int <> 1 THEN RAISE EXCEPTION 'FAIL: a permanent bounce gave %', r; END IF;
  SELECT * INTO sup FROM public.email_suppressions WHERE address = 'bounce1@x.example';
  IF sup.reason <> 'bounced' OR sup.event_count <> 1 THEN RAISE EXCEPTION 'FAIL: the suppression is %/%', sup.reason, sup.event_count; END IF;
  IF (SELECT count(*) FROM public.email_suppressions) <> 1 THEN RAISE EXCEPTION 'FAIL: another address was suppressed'; END IF;
  -- What was already waiting for that address is held back; others are untouched.
  ev := (SELECT e FROM public.outbox_events e WHERE e.id = conf2);
  IF ev.status <> 'suppressed' OR ev.last_error <> 'suppressed: bounced' THEN RAISE EXCEPTION 'FAIL: the waiting confirmation is %/%', ev.status, ev.last_error; END IF;
  IF (SELECT status FROM public.outbox_events WHERE id = conf3) <> 'pending' OR (SELECT status FROM public.outbox_events WHERE id = conf1) <> 'sent' THEN
    RAISE EXCEPTION 'FAIL: the bounce touched another event';
  END IF;
  -- The stored explanation never holds the address.
  IF (SELECT detail FROM public.email_delivery_events WHERE provider_event_id = 'evt_1') <> 'The mailbox [email] does not exist' THEN
    RAISE EXCEPTION 'FAIL: the detail is %', (SELECT detail FROM public.email_delivery_events WHERE provider_event_id = 'evt_1');
  END IF;

  -- ---------- Replaying the same webhook changes nothing ----------
  r := pg_temp.hook('evt_1', 'email.bounced', 'msg-1', ARRAY['bounce1@x.example'], 'Permanent', 'again');
  IF r <> '{"duplicate": true}'::jsonb THEN RAISE EXCEPTION 'FAIL: a replay gave %', r; END IF;
  IF (SELECT count(*) FROM public.email_delivery_events) <> 1 OR (SELECT event_count FROM public.email_suppressions WHERE address = 'bounce1@x.example') <> 1 THEN
    RAISE EXCEPTION 'FAIL: a replay was counted';
  END IF;
  -- A different event for the same address is counted.
  PERFORM pg_temp.hook('evt_2', 'email.bounced', 'msg-1', ARRAY['bounce1@x.example'], 'Permanent');
  IF (SELECT event_count FROM public.email_suppressions WHERE address = 'bounce1@x.example') <> 2 THEN RAISE EXCEPTION 'FAIL: a second bounce was not counted'; END IF;

  -- ---------- Temporary trouble is recorded and acts on nothing ----------
  FOR n IN 1..4 LOOP
    r := CASE n
      WHEN 1 THEN pg_temp.hook('evt_t1', 'email.bounced', 'msg-4', ARRAY['ok@x.example'], 'Transient', 'mailbox full')
      WHEN 2 THEN pg_temp.hook('evt_t2', 'email.bounced', 'msg-4', ARRAY['ok@x.example'], 'Undetermined')
      WHEN 3 THEN pg_temp.hook('evt_t3', 'email.delivery_delayed', 'msg-4', ARRAY['ok@x.example'])
      ELSE pg_temp.hook('evt_t4', 'email.failed', 'msg-4', ARRAY['ok@x.example'], NULL, 'provider fault')
    END;
    IF r ->> 'outcome' <> 'recorded' OR (r ->> 'suppressed')::int <> 0 THEN RAISE EXCEPTION 'FAIL: temporary trouble % gave %', n, r; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.email_suppressions WHERE address = 'ok@x.example') OR (SELECT status FROM public.outbox_events WHERE id = conf3) <> 'pending' THEN
    RAISE EXCEPTION 'FAIL: temporary trouble suppressed an address';
  END IF;
  -- "Permanent" is read whatever its case.
  PERFORM pg_temp.hook('evt_p', 'email.bounced', NULL, ARRAY['upper@x.example'], 'PERMANENT');
  IF NOT EXISTS (SELECT 1 FROM public.email_suppressions WHERE address = 'upper@x.example') THEN RAISE EXCEPTION 'FAIL: PERMANENT was not read as permanent'; END IF;

  -- ---------- A complaint suppresses, and stays the stronger reason ----------
  r := pg_temp.hook('evt_c', 'email.complained', 'msg-4', ARRAY['ok@x.example']);
  IF r ->> 'outcome' <> 'suppressed' THEN RAISE EXCEPTION 'FAIL: a complaint gave %', r; END IF;
  PERFORM pg_temp.hook('evt_c2', 'email.bounced', NULL, ARRAY['ok@x.example'], 'Permanent');
  IF (SELECT reason FROM public.email_suppressions WHERE address = 'ok@x.example') <> 'complained' THEN RAISE EXCEPTION 'FAIL: a later bounce weakened a complaint'; END IF;
  PERFORM pg_temp.hook('evt_c3', 'email.bounced', NULL, ARRAY['late@x.example'], 'Permanent');
  PERFORM pg_temp.hook('evt_c4', 'email.complained', NULL, ARRAY['late@x.example']);
  IF (SELECT reason FROM public.email_suppressions WHERE address = 'late@x.example') <> 'complained' THEN RAISE EXCEPTION 'FAIL: a complaint did not upgrade a bounce'; END IF;
  -- The provider saying it suppresses the address counts too.
  r := pg_temp.hook('evt_s', 'email.suppressed', NULL, ARRAY['prov@x.example'], NULL, 'on the suppression list');
  IF (SELECT reason FROM public.email_suppressions WHERE address = 'prov@x.example') IS DISTINCT FROM 'provider_suppressed' THEN RAISE EXCEPTION 'FAIL: provider suppression was not recorded'; END IF;
  -- An email that is not in the queue (the sign-in codes share the account) concerns the recipients as reported.
  PERFORM pg_temp.hook('evt_u', 'email.bounced', 'msg-not-ours', ARRAY['signin@x.example'], 'Permanent');
  IF NOT EXISTS (SELECT 1 FROM public.email_suppressions WHERE address = 'signin@x.example') THEN RAISE EXCEPTION 'FAIL: an unmatched message was ignored'; END IF;

  -- ---------- The advisory team is never suppressed ----------
  r := pg_temp.hook('evt_a', 'email.bounced', 'msg-adv', ARRAY['team@acme.test', 'Second@acme.test'], 'Permanent');
  IF r ->> 'outcome' <> 'protected' OR (r ->> 'suppressed')::int <> 0 OR (r ->> 'protected')::int <> 2 THEN RAISE EXCEPTION 'FAIL: a team bounce gave %', r; END IF;
  r := pg_temp.hook('evt_a2', 'email.bounced', 'msg-gone', ARRAY['team@acme.test'], 'Permanent');   -- message id unknown, address on the list
  IF r ->> 'outcome' <> 'protected' THEN RAISE EXCEPTION 'FAIL: a listed address was suppressed: %', r; END IF;
  IF EXISTS (SELECT 1 FROM public.email_suppressions WHERE address IN ('team@acme.test', 'second@acme.test')) THEN RAISE EXCEPTION 'FAIL: a team address was suppressed'; END IF;
  IF (SELECT outcome FROM public.email_delivery_events WHERE provider_event_id = 'evt_a') <> 'protected' THEN RAISE EXCEPTION 'FAIL: the team bounce was not recorded as protected'; END IF;

  -- ---------- Never mailed again ----------
  -- A confirmation queued after the bounce (a re-certification) is due now, to the same address.
  conf5 := pg_temp.mk_conf(s1, 'Bounce1@X.example', 'pending');
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.claim_outbox_events(ARRAY['prospect_confirmation', 'advisor_notification'], 10, 5);
  RESET ROLE;
  -- Only conf3 (to ok@, now suppressed by the complaint) and conf5 (bounce1@) were waiting, and neither is handed out.
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: the worker was handed % suppressed email(s)', n; END IF;
  IF (SELECT status FROM public.outbox_events WHERE id = conf5) <> 'suppressed' OR (SELECT status FROM public.outbox_events WHERE id = conf3) <> 'suppressed' THEN
    RAISE EXCEPTION 'FAIL: late confirmations to suppressed addresses were not held back';
  END IF;
  -- Anyone else still goes out.
  PERFORM pg_temp.mk_conf(s3, 'fine@x.example', 'pending');
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.claim_outbox_events(ARRAY['prospect_confirmation'], 10, 5);
  RESET ROLE;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: an unsuppressed address was held back (% claimed)', n; END IF;
  -- A suppressed event is not retryable by the advisor retry (it is not dead).
  IF (SELECT public.requeue_outbox_event(conf5)) THEN RAISE EXCEPTION 'FAIL: a suppressed event was requeued'; END IF;

  -- ---------- Input the function refuses ----------
  PERFORM pg_temp.must_raise($q$SELECT pg_temp.hook('', 'email.bounced', NULL, ARRAY['a@x.example'], 'Permanent')$q$, '22023', 'an empty event id');
  PERFORM pg_temp.must_raise($q$SELECT pg_temp.hook('e', 'email.delivered', NULL, ARRAY['a@x.example'])$q$, '22023', 'an event type it does not handle');
  PERFORM pg_temp.must_raise($q$INSERT INTO public.email_suppressions (address, reason) VALUES ('Mixed@Case.example', 'bounced')$q$, '23514', 'a non-normalized suppression');

  RAISE NOTICE 'advisor_outbox: webhook and suppression cases passed';
END $$;

-- ---------- What advisors see, and who may ----------
DO $$
DECLARE
  adv uuid := (SELECT user_id FROM public.user_roles WHERE role = 'advisor' LIMIT 1);
  prospect uuid := (SELECT user_id FROM public.chamber_sessions LIMIT 1);
  n integer;
  rows jsonb;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.as_user(adv);

  SELECT jsonb_agg(jsonb_build_object('reason', p.reason) ORDER BY p.reason) INTO rows FROM public.advisor_email_problems() p;
  -- Session one (bounced), session two (complained, a later bounce notwithstanding), session three has none.
  IF rows IS DISTINCT FROM '[{"reason":"bounced"},{"reason":"complained"}]'::jsonb THEN RAISE EXCEPTION 'FAIL: the advisor sees %', rows; END IF;
  SELECT count(*) INTO n FROM public.advisor_email_problems();
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: % submissions flagged', n; END IF;
  -- No address or message detail in what they are shown.
  IF (SELECT string_agg(to_jsonb(p)::text, ' ') FROM public.advisor_email_problems() p) ~* '@' THEN RAISE EXCEPTION 'FAIL: the flag exposes an address'; END IF;

  -- The queue filter and counts know the new status.
  SELECT count(*) INTO n FROM public.advisor_list_outbox_events('suppressed');
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL: % suppressed events listed', n; END IF;
  IF (SELECT events FROM public.advisor_outbox_summary() WHERE status = 'suppressed') <> 3 THEN RAISE EXCEPTION 'FAIL: the suppressed count is wrong'; END IF;
  IF (SELECT last_error FROM public.advisor_list_outbox_events('suppressed') LIMIT 1) NOT LIKE 'suppressed: %' THEN RAISE EXCEPTION 'FAIL: the reason is not shown'; END IF;

  -- Not for anyone else.
  PERFORM pg_temp.as_user(prospect);
  PERFORM pg_temp.must_raise('SELECT * FROM public.advisor_email_problems()', '42501', 'a prospect reading the bounce flags');
  PERFORM pg_temp.must_raise('SELECT count(*) FROM public.email_suppressions', '42501', 'a prospect reading the suppression list');
  PERFORM pg_temp.must_raise('SELECT count(*) FROM public.email_delivery_events', '42501', 'a prospect reading the event log');
  PERFORM pg_temp.must_raise($q$SELECT public.record_email_delivery_event('x', 'email.bounced', NULL, ARRAY['a@x.example'], 'Permanent', NULL, now())$q$, '42501', 'a prospect recording a bounce');
  PERFORM pg_temp.as_user(adv);
  PERFORM pg_temp.must_raise($q$SELECT public.record_email_delivery_event('x', 'email.bounced', NULL, ARRAY['a@x.example'], 'Permanent', NULL, now())$q$, '42501', 'an advisor recording a bounce');
  RESET ROLE;
  SET LOCAL ROLE anon;
  PERFORM pg_temp.must_raise('SELECT * FROM public.advisor_email_problems()', '42501', 'anon reading the bounce flags');
  RESET ROLE;

  RAISE NOTICE 'advisor_outbox: bounce flag and access cases passed';
END $$;

-- ====================================================================================
-- Review follow-ups (G-2.2): claims that bypass the hold-back, lifting a suppression, what the
-- flag follows, undelivered mail, and addresses in the provider's own text.
-- ====================================================================================
DO $$
DECLARE
  u uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  ev_lapsed uuid; ev_lapsed2 uuid; ev_live2 uuid; ev_clean uuid; ev_h1 uuid; ev_h2 uuid;
  frozen jsonb;
  msg jsonb := jsonb_build_object('from', 'a@x.example', 'to', jsonb_build_array('b@y.example'), 'subject', 's', 'text', 't', 'html', 'h');
  n integer;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (u, 'followup@acme.example');
  INSERT INTO public.chamber_sessions (id, user_id, chamber_data) VALUES (s, u, '{"company_name":"Followup"}');
  DELETE FROM public.outbox_events;

  -- ---------- A claim whose worker was lost is held back too, not handed to the next worker ----------
  PERFORM pg_temp.hook('fu_1', 'email.bounced', NULL, ARRAY['late1@x.example'], 'Permanent');
  ev_lapsed := pg_temp.mk_conf(s, 'late1@x.example', 'claimed');
  UPDATE public.outbox_events SET attempts = 1, locked_until = now() - interval '1 minute', claimed_at = now() - interval '11 minutes' WHERE id = ev_lapsed;
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.claim_outbox_events(ARRAY['prospect_confirmation'], 10, 5);
  RESET ROLE;
  IF n <> 0 OR (SELECT status FROM public.outbox_events WHERE id = ev_lapsed) <> 'suppressed' THEN
    RAISE EXCEPTION 'FAIL: a lapsed claim to a suppressed address was handed on (% claimed)', n;
  END IF;

  -- The webhook holds back a lapsed claim at once, and leaves a LIVE claim to the freeze below.
  ev_lapsed2 := pg_temp.mk_conf(s, 'late2@x.example', 'claimed');
  UPDATE public.outbox_events SET attempts = 1, locked_until = now() - interval '1 minute' WHERE id = ev_lapsed2;
  ev_live2 := pg_temp.mk_conf(s, 'late2@x.example', 'claimed');
  UPDATE public.outbox_events SET attempts = 1, locked_until = now() + interval '5 minutes', claimed_at = now() WHERE id = ev_live2;
  PERFORM pg_temp.hook('fu_2', 'email.bounced', NULL, ARRAY['late2@x.example'], 'Permanent');
  IF (SELECT status FROM public.outbox_events WHERE id = ev_lapsed2) <> 'suppressed' THEN RAISE EXCEPTION 'FAIL: the webhook left a lapsed claim in the queue'; END IF;
  IF (SELECT status FROM public.outbox_events WHERE id = ev_live2) <> 'claimed' THEN RAISE EXCEPTION 'FAIL: the webhook took a live claim out from under its worker'; END IF;

  -- The live claim's worker asks to write the email: refused, the event is held back, and the worker is told it no longer holds it.
  SET LOCAL ROLE service_role;
  frozen := public.freeze_outbox_message(ev_live2, 1, msg);
  RESET ROLE;
  IF frozen IS NOT NULL THEN RAISE EXCEPTION 'FAIL: an email was written for a suppressed address: %', frozen; END IF;
  IF (SELECT status FROM public.outbox_events WHERE id = ev_live2) <> 'suppressed' OR (SELECT pending_send FROM public.outbox_events WHERE id = ev_live2) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the refused freeze left the event %', (SELECT status FROM public.outbox_events WHERE id = ev_live2);
  END IF;
  -- Anyone else is frozen as before; and only the claimant's attempt can do either.
  ev_clean := pg_temp.mk_conf(s, 'clean@x.example', 'claimed');
  UPDATE public.outbox_events SET attempts = 1, locked_until = now() + interval '5 minutes', claimed_at = now() WHERE id = ev_clean;
  SET LOCAL ROLE service_role;
  IF public.freeze_outbox_message(ev_clean, 2, msg) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a freeze by a stale attempt was applied'; END IF;
  frozen := public.freeze_outbox_message(ev_clean, 1, msg);
  RESET ROLE;
  IF frozen IS NULL OR frozen ->> 'key' NOT LIKE 'outbox-%' OR (SELECT status FROM public.outbox_events WHERE id = ev_clean) <> 'claimed' THEN
    RAISE EXCEPTION 'FAIL: a normal freeze changed: %', frozen;
  END IF;

  -- ---------- Lifting a suppression, on purpose ----------
  ev_h1 := pg_temp.mk_conf(s, 'late3@x.example', 'pending');
  ev_h2 := pg_temp.mk_conf(s, 'late3@x.example', 'pending');
  PERFORM pg_temp.hook('fu_3', 'email.bounced', NULL, ARRAY['late3@x.example'], 'Permanent');
  IF (SELECT count(*) FROM public.outbox_events WHERE id IN (ev_h1, ev_h2) AND status = 'suppressed') <> 2 THEN RAISE EXCEPTION 'FAIL: test premise: both should be held back'; END IF;
  SET LOCAL ROLE service_role;
  -- Without p_requeue the held-back mail stays held back (it may be old); the address is free again.
  n := public.lift_email_suppression('  Late1@X.example ', false);
  IF n <> 0 OR EXISTS (SELECT 1 FROM public.email_suppressions WHERE address = 'late1@x.example') THEN RAISE EXCEPTION 'FAIL: lifting did not just lift (% requeued)', n; END IF;
  n := public.lift_email_suppression('late3@x.example', true);
  RESET ROLE;
  IF n <> 2 OR EXISTS (SELECT 1 FROM public.email_suppressions WHERE address = 'late3@x.example') THEN RAISE EXCEPTION 'FAIL: lifting with a requeue returned %', n; END IF;
  IF (SELECT count(*) FROM public.outbox_events WHERE id IN (ev_h1, ev_h2) AND status = 'pending' AND attempts = 0 AND last_error IS NULL AND next_attempt_at <= now()) <> 2 THEN
    RAISE EXCEPTION 'FAIL: the held-back confirmations were not requeued as new';
  END IF;
  SET LOCAL ROLE service_role;
  IF public.lift_email_suppression('never-suppressed@x.example', true) <> 0 THEN RAISE EXCEPTION 'FAIL: lifting an address that was not suppressed did something'; END IF;
  RESET ROLE;
  PERFORM pg_temp.must_raise($q$SELECT public.lift_email_suppression('   ')$q$, '22023', 'lifting nothing');
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.must_raise($q$SELECT public.lift_email_suppression('late1@x.example')$q$, '42501', 'a signed-in user lifting a suppression');
  RESET ROLE;

  RAISE NOTICE 'advisor_outbox: hold-back, freeze and lift cases passed';
END $$;

DO $$
DECLARE
  adv uuid := (SELECT user_id FROM public.user_roles WHERE role = 'advisor' LIMIT 1);
  mk uuid;
  s_move uuid := gen_random_uuid(); s_nd uuid := gen_random_uuid(); s_fail uuid := gen_random_uuid();
  s_both uuid := gen_random_uuid(); s_other uuid := gen_random_uuid(); s_ok uuid := gen_random_uuid();
  flags jsonb;
BEGIN
  DELETE FROM public.outbox_events; DELETE FROM public.email_suppressions; DELETE FROM public.email_delivery_events;
  FOREACH mk IN ARRAY ARRAY[s_move, s_nd, s_fail, s_both, s_other, s_ok] LOOP
    INSERT INTO auth.users (id, email) VALUES (mk, mk::text || '@acme.example');
    INSERT INTO public.chamber_sessions (id, user_id, chamber_data) VALUES (mk, mk, '{"company_name":"Flags"}');
  END LOOP;

  -- ---------- The flag follows the LATEST confirmation: a new address that was emailed clears it ----------
  PERFORM pg_temp.hook('fl_1', 'email.bounced', 'm-old', ARRAY['old@x.example'], 'Permanent');
  PERFORM pg_temp.mk_conf(s_move, 'old@x.example', 'sent', 'm-old');
  UPDATE public.outbox_events SET created_at = now() - interval '2 hours' WHERE session_id = s_move;
  PERFORM pg_temp.mk_conf(s_move, 'new@x.example', 'sent', 'm-new');   -- the prospect changed their address and certified again
  UPDATE public.outbox_events SET created_at = now() - interval '1 hour' WHERE session_id = s_move AND provider_message_id = 'm-new';

  -- ---------- Mail the provider reports undelivered, though the address is not suppressed ----------
  PERFORM pg_temp.mk_conf(s_nd, 'nd@x.example', 'sent', 'm-nd');
  PERFORM pg_temp.hook('fl_2', 'email.bounced', 'm-nd', ARRAY['nd@x.example'], 'Transient', 'mailbox full');
  PERFORM pg_temp.mk_conf(s_fail, 'f@x.example', 'sent', 'm-f');
  PERFORM pg_temp.hook('fl_3', 'email.failed', 'm-f', ARRAY['f@x.example'], NULL, 'provider fault');
  -- A later, permanent report for the same address: the suppression is the stronger statement.
  PERFORM pg_temp.mk_conf(s_both, 'both@x.example', 'sent', 'm-both');
  PERFORM pg_temp.hook('fl_4', 'email.bounced', 'm-both', ARRAY['both@x.example'], 'Transient');
  PERFORM pg_temp.hook('fl_5', 'email.complained', 'm-both', ARRAY['both@x.example']);
  -- Trouble with a message that is not this submission's confirmation says nothing about it.
  PERFORM pg_temp.mk_conf(s_other, 'other@x.example', 'sent', 'm-other');
  PERFORM pg_temp.hook('fl_6', 'email.bounced', 'm-someone-elses', ARRAY['other@x.example'], 'Transient');
  PERFORM pg_temp.mk_conf(s_ok, 'ok2@x.example', 'sent', 'm-ok');
  PERFORM pg_temp.hook('fl_7', 'email.delivery_delayed', 'm-ok', ARRAY['ok2@x.example']);   -- still trying: not a problem

  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.as_user(adv);
  SELECT jsonb_object_agg(p.session_id, p.reason) INTO flags FROM public.advisor_email_problems() p;
  RESET ROLE;
  IF flags IS DISTINCT FROM jsonb_build_object(s_nd, 'not_delivered', s_fail, 'not_delivered', s_both, 'complained') THEN
    RAISE EXCEPTION 'FAIL: the flags are %', flags;
  END IF;

  -- A newer confirmation to the bounced address (a re-certification after the bounce) brings the flag back.
  PERFORM pg_temp.mk_conf(s_move, 'old@x.example', 'pending');
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.as_user(adv);
  SELECT jsonb_object_agg(p.session_id, p.reason) INTO flags FROM public.advisor_email_problems() p;
  RESET ROLE;
  IF (flags ->> s_move::text) IS DISTINCT FROM 'bounced' THEN RAISE EXCEPTION 'FAIL: a new confirmation to the bounced address did not flag again: %', flags; END IF;

  -- ---------- Addresses in the provider's own text never reach the table ----------
  PERFORM pg_temp.hook('rd_1', 'email.bounced', NULL, ARRAY['x1@x.example'], 'Permanent', '550 5.1.1 <"mary o''connor"@example.com>: Recipient address rejected');
  PERFORM pg_temp.hook('rd_2', 'email.bounced', NULL, ARRAY['x2@x.example'], 'Permanent', '550 <mary.o''connor@example.com>, bob@example.org: unknown');
  PERFORM pg_temp.hook('rd_3', 'email.bounced', NULL, ARRAY['x3@x.example'], 'Permanent', 'user+tag@sub.example.co.uk mailbox gone; Idempotency-Key outbox-2f0c1a7e-3b1d-4c9e-9d5a-0123456789ab');
  IF (SELECT detail FROM public.email_delivery_events WHERE provider_event_id = 'rd_1') <> '550 5.1.1 <[email] Recipient address rejected'
     OR (SELECT detail FROM public.email_delivery_events WHERE provider_event_id = 'rd_2') <> '550 [email] [email] unknown'
     OR (SELECT detail FROM public.email_delivery_events WHERE provider_event_id = 'rd_3') NOT LIKE '[email] mailbox gone;%' THEN
    RAISE EXCEPTION 'FAIL: redacted details are %', (SELECT jsonb_agg(detail ORDER BY provider_event_id) FROM public.email_delivery_events WHERE provider_event_id LIKE 'rd_%');
  END IF;
  IF EXISTS (SELECT 1 FROM public.email_delivery_events WHERE detail ~* 'mary|connor|bob@|example\.org|user\+tag') THEN RAISE EXCEPTION 'FAIL: part of an address survived redaction'; END IF;

  RAISE NOTICE 'advisor_outbox: flag follow-up and redaction cases passed';
END $$;
