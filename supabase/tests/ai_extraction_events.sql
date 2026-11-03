-- Run against a scratch Postgres (NOT production); it drops and recreates the `public` schema:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/ai_extraction_events.sql
-- Extraction events (20261103120200, US-2.4a): what the table refuses so it can never hold prospect
-- content, who can read and write it, and pruning after the retention window. The setup is
-- advisor_operations.sql's, which loads the real migrations is_advisor() comes from.
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS storage CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
-- Supabase grants table access to these roles by default and relies on row security.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);

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
  contact_name text
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
\i supabase/migrations/20261029090000_document_ingestion.sql
\i supabase/migrations/20261029091000_census_advisor_review.sql

\i supabase/migrations/20261103120200_ai_extraction_events.sql

CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', false)::text, true);
END $$;

-- Fails the run unless stmt raises SQLSTATE `state`.
CREATE FUNCTION pg_temp.must_raise(stmt text, state text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    IF s <> state THEN RAISE EXCEPTION 'FAIL: % raised %, expected %', label, s, state; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL: % was accepted', label;
END $$;

-- ---------- what an event may hold ----------
DO $$
DECLARE
  owner uuid := gen_random_uuid();
  sid uuid := gen_random_uuid();
  ins constant text := 'INSERT INTO public.ai_extraction_events (request_id, function_name, outcome, error_code, http_status, fields, refused_paths) VALUES (gen_random_uuid(), %L, %L, %L, %s, %L::text[], %L::text[])';
BEGIN
  INSERT INTO auth.users (id) VALUES (owner);
  INSERT INTO public.chamber_sessions (id, user_id) VALUES (sid, owner);

  -- What the functions write.
  INSERT INTO public.ai_extraction_events (request_id, function_name, user_id, session_id, outcome, http_status, fields, refused_paths,
      prompt_version, contract_version, provider, model, attempts, latency_ms)
    VALUES (gen_random_uuid(), 'chamber-extract', owner, sid, 'ok', 200, '{company_name,states}', '{states[1],census[0].dependents[2].relationship}',
      1, 2, 'lovable', 'google/gemini-3-flash-preview', 1, 840);
  INSERT INTO public.ai_extraction_events (request_id, function_name, user_id, session_id, document_id, outcome, error_code, http_status, document_status)
    VALUES (gen_random_uuid(), 'document-extract', owner, sid, gen_random_uuid(), 'error', 'timeout', 200, 'failed');
  EXECUTE format(ins, 'chamber-extract', 'error', 'rate_limited', 429, '{}', '{}');

  -- Never a value, a sentence or a quote.
  PERFORM pg_temp.must_raise(format(ins, 'chamber-extract', 'ok', NULL, 200, '{Acme Inc}', '{}'), '23514', 'a value in place of a field name');
  PERFORM pg_temp.must_raise(format(ins, 'chamber-extract', 'ok', NULL, 200, '{"company_name: Acme"}', '{}'), '23514', 'a name with its value');
  PERFORM pg_temp.must_raise(format(ins, 'chamber-extract', 'ok', NULL, 200, '{}', '{"states[1] = CA"}'), '23514', 'a path with its value');
  PERFORM pg_temp.must_raise(format(ins, 'chamber-extract', 'ok', NULL, 200, '{}', '{"we have 40 people"}'), '23514', 'words in place of a path');
  PERFORM pg_temp.must_raise(format(ins, 'chamber-extract', 'ok', NULL, 200, '{}', ARRAY[repeat('a', 121)]::text), '23514', 'an overlong path');
  PERFORM pg_temp.must_raise(format(ins, 'chamber-extract', 'ok', NULL, 200, (SELECT array_agg('f' || g)::text FROM generate_series(1, 101) g), '{}'), '23514', 'more than 100 fields');
  -- Codes and outcomes agree, and only known codes and functions are stored.
  PERFORM pg_temp.must_raise(format(ins, 'chamber-extract', 'ok', 'timeout', 200, '{}', '{}'), '23514', 'ok with an error code');
  PERFORM pg_temp.must_raise(format(ins, 'chamber-extract', 'error', NULL, 502, '{}', '{}'), '23514', 'an error without a code');
  PERFORM pg_temp.must_raise(format(ins, 'chamber-extract', 'error', 'teapot', 418, '{}', '{}'), '23514', 'an unknown code');
  PERFORM pg_temp.must_raise(format(ins, 'other-function', 'ok', NULL, 200, '{}', '{}'), '23514', 'an unknown function');
  PERFORM pg_temp.must_raise(format(ins, 'chamber-extract', 'ok', NULL, 99, '{}', '{}'), '23514', 'an HTTP status out of range');

  -- An intake that is deleted takes its events with it.
  DELETE FROM public.chamber_sessions WHERE id = sid;
  IF EXISTS (SELECT 1 FROM public.ai_extraction_events WHERE session_id = sid) THEN RAISE EXCEPTION 'FAIL: events outlived their intake'; END IF;
  RAISE NOTICE 'ai_extraction_events: content cases passed';
END $$;

-- ---------- who reads and writes ----------
DO $$
DECLARE
  prospect uuid := gen_random_uuid();
  advisor uuid := gen_random_uuid();
  seen int;
  total int;
BEGIN
  INSERT INTO auth.users (id) VALUES (prospect), (advisor);
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor');
  INSERT INTO public.ai_extraction_events (request_id, function_name, user_id, outcome, http_status)
    VALUES (gen_random_uuid(), 'chamber-extract', prospect, 'ok', 200);
  SELECT count(*) INTO total FROM public.ai_extraction_events;

  -- A prospect sees no events, not even their own, and can't write one.
  PERFORM pg_temp.as_user(prospect);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO seen FROM public.ai_extraction_events;
  IF seen <> 0 THEN RAISE EXCEPTION 'FAIL: a prospect saw % events', seen; END IF;
  PERFORM pg_temp.must_raise($s$INSERT INTO public.ai_extraction_events (request_id, function_name, outcome, http_status) VALUES (gen_random_uuid(), 'chamber-extract', 'ok', 200)$s$, '42501', 'a prospect writing an event');
  PERFORM pg_temp.must_raise('DELETE FROM public.ai_extraction_events', '42501', 'a prospect deleting events');
  PERFORM pg_temp.must_raise('SELECT public.prune_ai_extraction_events()', '42501', 'a prospect pruning events');
  RESET ROLE;

  -- An advisor reads every event and changes none.
  PERFORM pg_temp.as_user(advisor);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO seen FROM public.ai_extraction_events;
  IF seen <> total OR total = 0 THEN RAISE EXCEPTION 'FAIL: an advisor saw % of % events', seen, total; END IF;
  PERFORM pg_temp.must_raise('UPDATE public.ai_extraction_events SET http_status = 200', '42501', 'an advisor changing an event');
  RESET ROLE;

  -- Signed out: nothing.
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO seen FROM public.ai_extraction_events;
  IF seen <> 0 THEN RAISE EXCEPTION 'FAIL: a signed-out caller saw % events', seen; END IF;
  RESET ROLE;

  IF NOT has_function_privilege('service_role', 'public.prune_ai_extraction_events(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: the service role cannot prune events';
  END IF;
  RAISE NOTICE 'ai_extraction_events: access cases passed';
END $$;

-- ---------- retention ----------
DO $$
DECLARE removed int;
BEGIN
  IF public.ai_event_retention() <> interval '90 days' THEN RAISE EXCEPTION 'FAIL: retention is %', public.ai_event_retention(); END IF;
  DELETE FROM public.ai_extraction_events;
  INSERT INTO public.ai_extraction_events (request_id, function_name, outcome, http_status, created_at)
    SELECT gen_random_uuid(), 'chamber-extract', 'ok', 200, now() - interval '91 days' - g * interval '1 hour' FROM generate_series(1, 3) g;
  INSERT INTO public.ai_extraction_events (request_id, function_name, outcome, http_status, created_at)
    VALUES (gen_random_uuid(), 'chamber-extract', 'ok', 200, now() - interval '89 days');

  -- At most p_limit a run, oldest first; then the rest; never a row inside the window.
  removed := public.prune_ai_extraction_events(2);
  IF removed <> 2 THEN RAISE EXCEPTION 'FAIL: a limited prune removed %', removed; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ai_extraction_events WHERE created_at BETWEEN now() - interval '91 days 2 hours' AND now() - interval '91 days') THEN
    RAISE EXCEPTION 'FAIL: the prune did not take the oldest first';
  END IF;
  removed := public.prune_ai_extraction_events();
  IF removed <> 1 THEN RAISE EXCEPTION 'FAIL: the second prune removed %', removed; END IF;
  IF (SELECT count(*) FROM public.ai_extraction_events) <> 1 THEN RAISE EXCEPTION 'FAIL: an event inside the window was pruned'; END IF;
  IF public.prune_ai_extraction_events() <> 0 THEN RAISE EXCEPTION 'FAIL: a third prune removed something'; END IF;

  -- Without pg_cron the schedule is skipped, quietly.
  IF to_regnamespace('cron') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: the migration invented a cron schema'; END IF;
  RAISE NOTICE 'ai_extraction_events: retention cases passed';
END $$;
