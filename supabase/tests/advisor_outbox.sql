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
\i supabase/migrations/20261027090000_outbox_operations.sql

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
  IF n <> 4 THEN RAISE EXCEPTION 'FAIL: the summary has % rows', n; END IF;
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
