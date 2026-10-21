-- Run against a scratch Postgres (NOT production); it drops and recreates the `public` schema:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/advisor_operations.sql
-- Stubs Supabase's `auth` and `storage` schemas and its default grants, then checks each advisor
-- resource as a signed-out caller, a guest, a prospect and an advisor, with row security on.
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
-- Mirrors "Users can view their own documents" from 20260323224722 (the migration itself also
-- creates the stubbed `documents` table, so it can't be loaded here).
CREATE POLICY "own documents bucket" ON storage.objects FOR SELECT TO authenticated
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
\i supabase/migrations/20261020210000_guest_abuse_limits.sql
\i supabase/migrations/20261021090000_chamber_field_provenance.sql
\i supabase/migrations/20261021100000_session_documents.sql

-- A session that predates the migration joins the pipeline as a draft.
INSERT INTO public.chamber_sessions (id, user_id) VALUES ('00000000-0000-0000-0000-0000000000aa', gen_random_uuid());

\i supabase/migrations/20261022090000_advisor_operations.sql
\i supabase/migrations/20261023090000_advisor_queue.sql

-- Runs `stmt` as `who` and fails the run unless it's refused (permission, row security or a
-- deliberate check).
CREATE FUNCTION pg_temp.must_refuse(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'FAIL: % was allowed', label;
EXCEPTION
  WHEN insufficient_privilege OR check_violation OR invalid_parameter_value OR serialization_failure
    OR no_data_found THEN NULL;
END $$;

CREATE FUNCTION pg_temp.as_user(uid uuid, email text DEFAULT NULL, guest boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'email', email, 'is_anonymous', guest, 'role', 'authenticated')::text, false);
END $$;

CREATE FUNCTION pg_temp.count_visible(tbl text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %s', tbl) INTO n;
  RETURN n;
END $$;

DO $$
DECLARE
  advisor uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
  prospect uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  sid uuid;
  other_sid uuid;
  data jsonb := '{"company_name":"Acme","states":["CA"],"pay_frequency":"Bi-weekly","employee_count":12,"employees":[{"first_name":"A","state":"CA"}]}';
  edited jsonb := '{"company_name":"Acme Inc","states":["CA"],"pay_frequency":"Bi-weekly","employee_count":12,"employees":[{"first_name":"A","state":"CA"}]}';
  cert jsonb;
  n bigint;
  s text;
  r record;
  latest bigint;
BEGIN
  INSERT INTO auth.users (id) VALUES (advisor), (admin_user), (prospect), (other);
  INSERT INTO public.user_roles (user_id, role) VALUES (advisor, 'advisor'), (admin_user, 'admin');
  INSERT INTO public.profiles (user_id, company_name, contact_name) VALUES (prospect, 'Acme (profile)', 'Pat Prospect');

  -- Backfill: the pre-existing session is in the pipeline as a draft.
  SELECT status INTO s FROM public.submission_workflow WHERE session_id = '00000000-0000-0000-0000-0000000000aa';
  IF s IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'FAIL: backfilled status was %', s; END IF;

  SET LOCAL ROLE authenticated;

  -- ---------- Roles ----------
  PERFORM set_config('request.jwt.claims', '', false);
  IF public.is_advisor() THEN RAISE EXCEPTION 'FAIL: signed-out caller is an advisor'; END IF;
  PERFORM pg_temp.as_user(advisor, 'adv@example.com', true);
  IF public.is_advisor() THEN RAISE EXCEPTION 'FAIL: a guest token counted as an advisor'; END IF;
  PERFORM pg_temp.as_user(prospect, 'p@example.com');
  IF public.is_advisor() THEN RAISE EXCEPTION 'FAIL: prospect is an advisor'; END IF;
  PERFORM pg_temp.must_refuse(format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, ''advisor'')', prospect), 'self-assigning a role');
  PERFORM pg_temp.as_user(advisor, 'adv@example.com');
  IF NOT public.is_advisor() OR NOT public.has_role('advisor') THEN RAISE EXCEPTION 'FAIL: advisor not recognised'; END IF;
  IF public.has_role('admin') THEN RAISE EXCEPTION 'FAIL: advisor is an admin'; END IF;
  PERFORM pg_temp.as_user(admin_user, 'admin@example.com');
  IF NOT public.is_advisor() THEN RAISE EXCEPTION 'FAIL: admin lacks advisor access'; END IF;

  -- ---------- Intake creates a draft; certifying submits it ----------
  PERFORM pg_temp.as_user(prospect, 'p@example.com');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (prospect, data) RETURNING id INTO sid;
  PERFORM pg_temp.as_user(other, 'o@example.com');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (other, data) RETURNING id INTO other_sid;

  PERFORM pg_temp.as_user(prospect, 'p@example.com');
  cert := jsonb_build_object(
    'signer_name', 'Jo Doe', 'signer_title', 'CEO', 'signed_at', '2026-05-01T12:00:00Z',
    'file_id', 'EAA-2026-TEST', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', data);
  UPDATE public.chamber_sessions SET status = 'submitted', submission = cert WHERE id = sid;
  IF public.prospect_submission_status(sid) IS DISTINCT FROM 'submitted' THEN
    RAISE EXCEPTION 'FAIL: prospect sees %', public.prospect_submission_status(sid);
  END IF;

  -- ---------- Prospects can't reach advisor data ----------
  IF pg_temp.count_visible('public.chamber_sessions') <> 1 THEN RAISE EXCEPTION 'FAIL: prospect sees other sessions'; END IF;
  IF pg_temp.count_visible('public.profiles') <> 1 THEN RAISE EXCEPTION 'FAIL: prospect sees other profiles'; END IF;
  FOREACH s IN ARRAY ARRAY['public.submission_workflow', 'public.submission_status_history', 'public.advisor_notes',
                           'public.advisor_field_reviews', 'public.advisor_review_events', 'public.manuscript_versions'] LOOP
    IF pg_temp.count_visible(s) <> 0 THEN RAISE EXCEPTION 'FAIL: prospect can read %', s; END IF;
  END LOOP;
  PERFORM pg_temp.must_refuse('SELECT * FROM public.advisor_list_submissions()', 'prospect listing submissions');
  PERFORM pg_temp.must_refuse(format('SELECT public.set_submission_status(%L, ''won'')', sid), 'prospect setting a status');
  PERFORM pg_temp.must_refuse(format('SELECT public.review_submission_field(%L, ''company_name'', ''verified'')', sid), 'prospect reviewing a field');
  PERFORM pg_temp.must_refuse(format('INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, %L, ''hi'')', sid, prospect), 'prospect adding a note');
  PERFORM pg_temp.must_refuse(format('INSERT INTO public.submission_workflow (session_id, status) VALUES (%L, ''won'') ON CONFLICT (session_id) DO UPDATE SET status = ''won''', sid), 'prospect writing the pipeline');
  PERFORM pg_temp.must_refuse(format('SELECT public.record_manuscript_version(%L, 1, %L, repeat(''a'', 64), 0, 0, false)', sid, sid || '/x.pdf'), 'prospect recording a manuscript');
  PERFORM pg_temp.must_refuse(format('INSERT INTO storage.objects (bucket_id, name) VALUES (''manuscripts'', %L)', sid || '/x.pdf'), 'prospect storing a manuscript');
  IF public.prospect_submission_status(other_sid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: prospect sees another intake''s status'; END IF;

  -- A guest token is no better, even for an account that holds the role.
  PERFORM pg_temp.as_user(advisor, 'adv@example.com', true);
  PERFORM pg_temp.must_refuse('SELECT * FROM public.advisor_list_submissions()', 'guest listing submissions');

  -- ---------- Advisors see every intake ----------
  PERFORM pg_temp.as_user(advisor, 'adv@example.com');
  IF pg_temp.count_visible('public.chamber_sessions') <> 3 THEN RAISE EXCEPTION 'FAIL: advisor sees % sessions', pg_temp.count_visible('public.chamber_sessions'); END IF;
  IF pg_temp.count_visible('public.chamber_certifications') <> 1 THEN RAISE EXCEPTION 'FAIL: advisor can''t see certifications'; END IF;
  SELECT * INTO r FROM public.advisor_list_submissions() WHERE session_id = sid;
  IF r.company_name <> 'Acme' OR r.contact_name <> 'Pat Prospect' OR r.employee_count <> 12
     OR r.pipeline_status <> 'submitted' OR r.intake_status <> 'submitted' OR r.submitted_at IS NULL
     OR cardinality(r.missing_required) <> 0 THEN
    RAISE EXCEPTION 'FAIL: list row was %', r;
  END IF;
  IF r.file_id IS DISTINCT FROM 'EAA-2026-TEST' OR r.states IS DISTINCT FROM ARRAY['CA'] THEN
    RAISE EXCEPTION 'FAIL: list row reference/footprint was % / %', r.file_id, r.states;
  END IF;
  SELECT * INTO r FROM public.advisor_list_submissions() WHERE session_id = '00000000-0000-0000-0000-0000000000aa';
  IF cardinality(r.missing_required) <> 4 OR r.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'FAIL: empty draft row was %', r; END IF;
  IF r.file_id IS NOT NULL OR cardinality(r.states) <> 0 THEN RAISE EXCEPTION 'FAIL: empty draft had a reference or states: %', r; END IF;
  SELECT count(*) INTO n FROM public.advisor_list_submissions('submitted');
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: status filter returned % rows', n; END IF;

  -- ---------- Status management ----------
  PERFORM pg_temp.must_refuse(format('SELECT public.set_submission_status(%L, ''draft'')', sid), 'moving a submission back to draft');
  PERFORM pg_temp.must_refuse(format('SELECT public.set_submission_status(%L, ''pending'')', sid), 'an unknown status');
  PERFORM pg_temp.must_refuse(format('SELECT public.set_submission_status(%L, ''won'')', gen_random_uuid()), 'a missing submission');
  PERFORM public.set_submission_status(sid, 'under_review', '  Starting review  ');
  SELECT * INTO r FROM public.submission_status_history WHERE session_id = sid ORDER BY id DESC LIMIT 1;
  IF r.from_status <> 'submitted' OR r.to_status <> 'under_review' OR r.changed_by <> advisor
     OR r.changed_by_email <> 'adv@example.com' OR r.note <> 'Starting review' THEN
    RAISE EXCEPTION 'FAIL: history row was %', r;
  END IF;
  SELECT count(*) INTO n FROM public.submission_status_history WHERE session_id = sid;
  PERFORM public.set_submission_status(sid, 'under_review');
  IF (SELECT count(*) FROM public.submission_status_history WHERE session_id = sid) <> n THEN
    RAISE EXCEPTION 'FAIL: an unchanged status wrote history';
  END IF;
  SELECT count(*) INTO n FROM public.advisor_list_submissions('under_review');
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: filter after status change returned %', n; END IF;
  PERFORM public.set_submission_status(sid, 'lost');

  -- The prospect only hears the statuses we share.
  PERFORM pg_temp.as_user(prospect, 'p@example.com');
  IF public.prospect_submission_status(sid) IS DISTINCT FROM 'under_review' THEN
    RAISE EXCEPTION 'FAIL: internal status leaked as %', public.prospect_submission_status(sid);
  END IF;

  -- ---------- Notes ----------
  PERFORM pg_temp.as_user(advisor, 'adv@example.com');
  INSERT INTO public.advisor_notes (session_id, body) VALUES (sid, '  Called the CFO.  ');
  SELECT * INTO r FROM public.advisor_notes WHERE session_id = sid;
  IF r.author_id <> advisor OR r.author_email <> 'adv@example.com' OR r.body <> 'Called the CFO.' THEN
    RAISE EXCEPTION 'FAIL: note was %', r;
  END IF;
  PERFORM pg_temp.must_refuse(format('INSERT INTO public.advisor_notes (session_id, author_id, body) VALUES (%L, %L, ''x'')', sid, admin_user), 'a note in someone else''s name');
  PERFORM pg_temp.must_refuse(format('UPDATE public.advisor_notes SET body = ''changed'' WHERE session_id = %L', sid), 'editing a note');

  -- ---------- Field review and corrections ----------
  PERFORM pg_temp.must_refuse(format('SELECT public.review_submission_field(%L, ''company_name'', ''verified'', ''set'', ''"Acme Holdings"'')', sid), 'a correction without a reason');
  PERFORM pg_temp.must_refuse(format('SELECT public.review_submission_field(%L, ''not_a_field'', ''verified'')', sid), 'an unknown field');
  PERFORM pg_temp.must_refuse(format('SELECT public.review_submission_field(%L, ''employees'', ''verified'', ''set'', ''[]'', ''x'')', sid), 'correcting the census');
  PERFORM pg_temp.must_refuse(format('SELECT public.review_submission_field(%L, ''company_name'', ''approved'')', sid), 'an unknown review state');
  PERFORM public.review_submission_field(sid, 'company_name', 'follow_up', 'set', '"Acme Holdings LLC"', 'Legal name per W-9');
  PERFORM public.review_submission_field(sid, 'company_name', 'verified');
  PERFORM public.review_submission_field(sid, 'employees', 'incomplete');
  SELECT * INTO r FROM public.advisor_field_reviews WHERE session_id = sid AND field = 'company_name';
  IF r.review_state <> 'verified' OR NOT r.has_correction OR r.corrected_value <> '"Acme Holdings LLC"'
     OR r.reason <> 'Legal name per W-9' OR r.updated_by <> advisor THEN
    RAISE EXCEPTION 'FAIL: review was %', r;
  END IF;
  SELECT count(*) INTO n FROM public.advisor_review_events WHERE session_id = sid;
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL: % review events', n; END IF;
  SELECT * INTO r FROM public.advisor_review_events WHERE session_id = sid ORDER BY id LIMIT 1;
  IF NOT r.correction_changed OR r.to_value <> '"Acme Holdings LLC"' OR r.from_value IS NOT NULL OR r.actor_email <> 'adv@example.com' THEN
    RAISE EXCEPTION 'FAIL: first review event was %', r;
  END IF;
  -- The prospect's own values are untouched.
  IF (SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = sid) <> 'Acme'
     OR (SELECT submission -> 'chamber_data' ->> 'company_name' FROM public.chamber_sessions WHERE id = sid) <> 'Acme' THEN
    RAISE EXCEPTION 'FAIL: an advisor correction changed the prospect''s data';
  END IF;
  -- Advisors can't edit the prospect's row directly either.
  UPDATE public.chamber_sessions SET chamber_data = edited WHERE id = sid;
  IF (SELECT chamber_data ->> 'company_name' FROM public.chamber_sessions WHERE id = sid) <> 'Acme' THEN
    RAISE EXCEPTION 'FAIL: an advisor edited the prospect''s row';
  END IF;
  SELECT * INTO r FROM public.advisor_list_submissions() WHERE session_id = sid;
  IF r.verified_fields <> 1 OR r.flagged_fields <> 1 THEN RAISE EXCEPTION 'FAIL: review counts were %', r; END IF;

  -- ---------- Manuscript versions ----------
  SELECT max(id) INTO latest FROM public.advisor_review_events WHERE session_id = sid;
  PERFORM pg_temp.must_refuse(format('SELECT public.record_manuscript_version(%L, 1, %L, repeat(''a'', 64), %s, 1, false)', sid, sid || '/v1.pdf', latest), 'recording a file that was never uploaded');
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', sid || '/v1.pdf');
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', other_sid || '/v1.pdf');
  PERFORM pg_temp.must_refuse(format('SELECT public.record_manuscript_version(%L, 1, %L, repeat(''a'', 64), %s, 1, false)', sid, other_sid || '/v1.pdf', latest), 'a file stored under another submission');
  PERFORM pg_temp.must_refuse(format('SELECT public.record_manuscript_version(%L, 1, %L, repeat(''a'', 64), %s, 1, false)', other_sid, other_sid || '/v1.pdf', 0), 'an uncertified intake');
  PERFORM pg_temp.must_refuse(format('SELECT public.record_manuscript_version(%L, 1, %L, repeat(''a'', 64), %s, 1, false)', sid, sid || '/v1.pdf', latest - 1), 'a packet built before the latest review');
  PERFORM pg_temp.must_refuse(format('SELECT public.record_manuscript_version(%L, 2, %L, repeat(''a'', 64), %s, 1, false)', sid, sid || '/v1.pdf', latest), 'skipping a version number');
  PERFORM public.record_manuscript_version(sid, 1, sid || '/v1.pdf', repeat('a', 64), latest, 1, false);
  SELECT * INTO r FROM public.manuscript_versions WHERE session_id = sid;
  IF r.version <> 1 OR r.file_id <> 'EAA-2026-TEST' OR r.certified_data_hash IS NULL OR r.review_event_id <> latest
     OR r.generated_by <> advisor OR r.corrections_applied <> 1 THEN
    RAISE EXCEPTION 'FAIL: version row was %', r;
  END IF;
  PERFORM pg_temp.must_refuse(format('SELECT public.record_manuscript_version(%L, 1, %L, repeat(''b'', 64), %s, 1, false)', sid, sid || '/v1.pdf', latest), 'reusing a version number');
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', sid || '/v2.pdf');
  PERFORM public.record_manuscript_version(sid, 2, sid || '/v2.pdf', repeat('b', 64), latest, 1, true);
  PERFORM pg_temp.must_refuse(format('UPDATE public.manuscript_versions SET version = 9 WHERE session_id = %L', sid), 'changing a version');
  -- A recorded file can't be removed; an unrecorded upload can.
  DELETE FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = sid || '/v1.pdf';
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE name = sid || '/v1.pdf') THEN RAISE EXCEPTION 'FAIL: a recorded manuscript was deleted'; END IF;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', sid || '/orphan.pdf');
  DELETE FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = sid || '/orphan.pdf';
  IF EXISTS (SELECT 1 FROM storage.objects WHERE name = sid || '/orphan.pdf') THEN RAISE EXCEPTION 'FAIL: an unrecorded upload could not be removed'; END IF;

  -- Prospects can't see or fetch any stored Manuscript, their own included.
  PERFORM pg_temp.as_user(prospect, 'p@example.com');
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'manuscripts';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: prospect can list % stored manuscripts', n; END IF;

  -- ---------- Withdrawn certification returns an unclaimed submission to draft ----------
  PERFORM pg_temp.as_user(other, 'o@example.com');
  UPDATE public.chamber_sessions SET status = 'submitted', submission = cert || jsonb_build_object('chamber_data', data) WHERE id = other_sid;
  UPDATE public.chamber_sessions SET chamber_data = edited WHERE id = other_sid;
  RESET ROLE;
  SELECT status INTO s FROM public.submission_workflow WHERE session_id = other_sid;
  IF s <> 'draft' THEN RAISE EXCEPTION 'FAIL: withdrawn certification left status %', s; END IF;

  -- History and audit rows are permanent, even for the table owner.
  PERFORM pg_temp.must_refuse(format('DELETE FROM public.submission_status_history WHERE session_id = %L', sid), 'deleting status history');
  PERFORM pg_temp.must_refuse(format('DELETE FROM public.advisor_review_events WHERE session_id = %L', sid), 'deleting review events');

  RAISE NOTICE 'advisor_operations: all cases passed';
END $$;

-- ====================================================================================
-- Access matrix (F-1): every protected data type, read and written by every kind of caller.
--   signed_out        no token (the `anon` role)
--   guest             anonymous-auth token that owns nothing
--   prospect_a        owns intake A      prospect_b   owns intake B
--   advisor / admin   hold a role
--   advisor_as_guest  an advisor's account presenting a guest token (must count as nobody)
-- A new table or function that isn't covered here fails the catalogue checks at the end.
-- ====================================================================================

CREATE FUNCTION pg_temp.become(who text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  uid uuid;
  guest boolean := false;
BEGIN
  RESET ROLE;
  IF who = 'signed_out' THEN
    PERFORM set_config('request.jwt.claims', '', false);
    SET LOCAL ROLE anon;
    RETURN;
  END IF;
  IF who = 'advisor_as_guest' THEN
    uid := current_setting('test.advisor')::uuid;
    guest := true;
  ELSE
    uid := current_setting('test.' || who)::uuid;
    guest := who = 'guest';
  END IF;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'email', who || '@example.com', 'is_anonymous', guest, 'role', 'authenticated')::text, false);
  SET LOCAL ROLE authenticated;
END $$;

-- A table the caller may not read at all counts as zero visible rows.
CREATE FUNCTION pg_temp.visible(src text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %s', src) INTO n;
  RETURN n;
EXCEPTION WHEN insufficient_privilege THEN RETURN 0;
END $$;

-- An UPDATE or DELETE that is refused, or that matches no row the caller may touch.
CREATE FUNCTION pg_temp.must_change_nothing(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % changed % row(s)', label, n; END IF;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$
DECLARE
  adv uuid := gen_random_uuid();
  adm uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  g uuid := gen_random_uuid();
  sid_a uuid;
  sid_b uuid;
  data jsonb := '{"company_name":"Acme","states":["CA","tx"],"pay_frequency":"Bi-weekly","employee_count":2,"employees":[{"first_name":"A","state":"CA"},{"first_name":"B","state":"NY"}]}';
  cert jsonb;
  latest bigint;
  who text;
  spec jsonb;
  src text;
  tot bigint;
  expected bigint;
  seen bigint;
  s text;
  n int;
  rec record;
  specs jsonb := $j$[
    {"t":"public.chamber_sessions",                                 "a":1, "b":1},
    {"t":"public.chamber_certifications",                           "a":1, "b":0},
    {"t":"public.profiles",                                         "a":1, "b":1},
    {"t":"public.documents",                                        "a":1, "b":1},
    {"t":"storage.objects WHERE bucket_id = 'documents'",           "a":1, "b":1},
    {"t":"public.user_roles",                                       "a":0, "b":0, "adv":1, "g":1},
    {"t":"public.submission_workflow",                              "a":0, "b":0},
    {"t":"public.submission_status_history",                        "a":0, "b":0},
    {"t":"public.advisor_notes",                                    "a":0, "b":0},
    {"t":"public.advisor_field_reviews",                            "a":0, "b":0},
    {"t":"public.advisor_review_events",                            "a":0, "b":0},
    {"t":"public.manuscript_versions",                              "a":0, "b":0},
    {"t":"storage.objects WHERE bucket_id = 'manuscripts'",         "a":0, "b":0}
  ]$j$;
BEGIN
  -- Clean slate: this block counts rows exactly.
  FOR s IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('TRUNCATE public.%I CASCADE', s);
  END LOOP;
  TRUNCATE storage.objects;
  TRUNCATE auth.users CASCADE;

  INSERT INTO auth.users (id) VALUES (adv), (adm), (a), (b), (g);
  INSERT INTO public.user_roles (user_id, role) VALUES (adv, 'advisor'), (adm, 'admin');
  INSERT INTO public.profiles (user_id, company_name, contact_name) VALUES (a, 'Acme', 'Pat A'), (b, 'Beta', 'Bo B');
  INSERT INTO public.documents (user_id) VALUES (a), (b);
  INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', a || '/doc-a.pdf'), ('documents', b || '/doc-b.pdf');
  PERFORM set_config('test.advisor', adv::text, false);
  PERFORM set_config('test.admin', adm::text, false);
  PERFORM set_config('test.prospect_a', a::text, false);
  PERFORM set_config('test.prospect_b', b::text, false);
  PERFORM set_config('test.guest', g::text, false);

  -- Prospect A certifies an intake; prospect B has a draft.
  PERFORM pg_temp.become('prospect_a');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (a, data) RETURNING id INTO sid_a;
  cert := jsonb_build_object('signer_name', 'Pat A', 'signer_title', 'CEO', 'signed_at', '2026-05-01T12:00:00Z',
    'file_id', 'EAA-2026-MATRIX', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', data);
  UPDATE public.chamber_sessions SET status = 'submitted', submission = cert WHERE id = sid_a;
  PERFORM pg_temp.become('prospect_b');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (b, data) RETURNING id INTO sid_b;

  -- An advisor works on A's intake, so every advisor-side table has a row to protect.
  PERFORM pg_temp.become('advisor');
  PERFORM public.set_submission_status(sid_a, 'under_review', 'Matrix');
  INSERT INTO public.advisor_notes (session_id, body) VALUES (sid_a, 'Internal note');
  PERFORM public.review_submission_field(sid_a, 'company_name', 'verified');
  SELECT max(id) INTO latest FROM public.advisor_review_events WHERE session_id = sid_a;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('manuscripts', sid_a || '/v1.pdf');
  PERFORM public.record_manuscript_version(sid_a, 1, sid_a || '/v1.pdf', repeat('c', 64), latest, 0, false);

  -- ---------- Reads: each data type, each caller ----------
  FOR spec IN SELECT jsonb_array_elements(specs) LOOP
    src := spec ->> 't';
    PERFORM pg_temp.become('advisor');
    RESET ROLE;
    tot := pg_temp.visible(src);
    IF tot < 1 THEN RAISE EXCEPTION 'FAIL: matrix has no rows to protect in %', src; END IF;
    FOREACH who IN ARRAY ARRAY['signed_out', 'guest', 'prospect_a', 'prospect_b', 'advisor', 'admin', 'advisor_as_guest'] LOOP
      expected := CASE who
        WHEN 'prospect_a' THEN (spec ->> 'a')::bigint
        WHEN 'prospect_b' THEN (spec ->> 'b')::bigint
        WHEN 'advisor' THEN COALESCE((spec ->> 'adv')::bigint, tot)
        WHEN 'admin' THEN COALESCE((spec ->> 'adv')::bigint, tot)
        WHEN 'advisor_as_guest' THEN COALESCE((spec ->> 'g')::bigint, 0)
        ELSE 0 END;
      PERFORM pg_temp.become(who);
      seen := pg_temp.visible(src);
      IF seen <> expected THEN
        RAISE EXCEPTION 'FAIL: % sees % row(s) of %, expected %', who, seen, src, expected;
      END IF;
    END LOOP;
  END LOOP;

  -- ---------- Functions: only a real advisor gets past the check ----------
  FOREACH who IN ARRAY ARRAY['signed_out', 'guest', 'prospect_a', 'prospect_b', 'advisor_as_guest'] LOOP
    PERFORM pg_temp.become(who);
    PERFORM pg_temp.must_refuse('SELECT * FROM public.advisor_list_submissions()', who || ' listing submissions');
    PERFORM pg_temp.must_refuse(format('SELECT public.set_submission_status(%L, ''won'')', sid_a), who || ' setting a status');
    PERFORM pg_temp.must_refuse(format('SELECT public.review_submission_field(%L, ''company_name'', ''verified'')', sid_a), who || ' reviewing a field');
    PERFORM pg_temp.must_refuse(format('SELECT public.record_manuscript_version(%L, 2, %L, repeat(''d'', 64), %s, 0, false)', sid_a, sid_a || '/v1.pdf', latest), who || ' recording a manuscript');
    IF public.is_advisor() THEN RAISE EXCEPTION 'FAIL: % counts as an advisor', who; END IF;
  END LOOP;
  -- Another prospect's status is not theirs to read, and a signed-out caller can't ask.
  PERFORM pg_temp.become('prospect_b');
  IF public.prospect_submission_status(sid_a) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: a prospect read another intake''s status'; END IF;
  PERFORM pg_temp.become('signed_out');
  PERFORM pg_temp.must_refuse(format('SELECT public.prospect_submission_status(%L)', sid_a), 'signed-out caller reading a status');

  -- ---------- Writes: advisor-side data changes only through the functions ----------
  FOREACH who IN ARRAY ARRAY['signed_out', 'guest', 'prospect_a', 'prospect_b', 'advisor_as_guest', 'advisor', 'admin'] LOOP
    PERFORM pg_temp.become(who);
    PERFORM pg_temp.must_refuse(format('INSERT INTO public.user_roles (user_id, role) VALUES (%L, ''admin'')', a), who || ' granting a role');
    PERFORM pg_temp.must_refuse(format('INSERT INTO public.submission_workflow (session_id, status) VALUES (%L, ''won'')', gen_random_uuid()), who || ' writing the pipeline');
    PERFORM pg_temp.must_refuse(format('INSERT INTO public.submission_status_history (session_id, to_status) VALUES (%L, ''won'')', sid_a), who || ' writing status history');
    PERFORM pg_temp.must_refuse(format('INSERT INTO public.advisor_field_reviews (session_id, field, review_state, updated_by) VALUES (%L, ''pay_frequency'', ''verified'', %L)', sid_a, a), who || ' writing a review');
    PERFORM pg_temp.must_refuse(format('INSERT INTO public.advisor_review_events (session_id, field, correction_changed, had_correction, has_correction, actor_id) VALUES (%L, ''pay_frequency'', false, false, false, %L)', sid_a, a), who || ' writing a review event');
    PERFORM pg_temp.must_refuse(format('INSERT INTO public.manuscript_versions (session_id, version, file_id, storage_path, pdf_sha256, certified_data_hash, certified_signed_at, generated_by) VALUES (%L, 9, ''x'', %L, repeat(''e'', 64), ''h'', now(), %L)', sid_a, sid_a || '/forged.pdf', a), who || ' writing a manuscript version');
    PERFORM pg_temp.must_change_nothing(format('UPDATE public.user_roles SET role = ''admin'' WHERE user_id = %L', adv), who || ' changing a role');
    PERFORM pg_temp.must_change_nothing(format('DELETE FROM public.user_roles WHERE user_id = %L', adm), who || ' revoking a role');
    PERFORM pg_temp.must_change_nothing(format('UPDATE public.advisor_notes SET body = ''x'' WHERE session_id = %L', sid_a), who || ' editing a note');
    PERFORM pg_temp.must_change_nothing(format('DELETE FROM public.advisor_notes WHERE session_id = %L', sid_a), who || ' deleting a note');
    PERFORM pg_temp.must_change_nothing('DELETE FROM storage.objects WHERE bucket_id = ''manuscripts''', who || ' deleting a stored manuscript');
    PERFORM pg_temp.must_change_nothing(format('UPDATE storage.objects SET name = %L WHERE bucket_id = ''manuscripts''', 'moved.pdf'), who || ' renaming a stored manuscript');
  END LOOP;

  -- Nobody but the owner changes a prospect's own records, advisors included.
  FOREACH who IN ARRAY ARRAY['signed_out', 'guest', 'prospect_b', 'advisor_as_guest', 'advisor', 'admin'] LOOP
    PERFORM pg_temp.become(who);
    PERFORM pg_temp.must_change_nothing(format('UPDATE public.chamber_sessions SET chamber_data = ''{}'' WHERE id = %L', sid_a), who || ' editing an intake');
    PERFORM pg_temp.must_change_nothing(format('UPDATE public.chamber_sessions SET status = ''in_progress'' WHERE id = %L', sid_a), who || ' withdrawing a certification');
    PERFORM pg_temp.must_change_nothing(format('DELETE FROM public.chamber_sessions WHERE id = %L', sid_a), who || ' deleting an intake');
    PERFORM pg_temp.must_change_nothing(format('UPDATE public.profiles SET contact_name = ''x'' WHERE user_id = %L', a), who || ' editing a profile');
    PERFORM pg_temp.must_change_nothing(format('UPDATE public.documents SET file_name = ''x'' WHERE user_id = %L', a), who || ' editing a document record');
    PERFORM pg_temp.must_change_nothing(format('DELETE FROM public.documents WHERE user_id = %L', a), who || ' deleting a document record');
    PERFORM pg_temp.must_change_nothing(format('UPDATE public.chamber_certifications SET signer_name = ''x'' WHERE session_id = %L', sid_a), who || ' editing a certification');
    PERFORM pg_temp.must_change_nothing(format('DELETE FROM public.chamber_certifications WHERE session_id = %L', sid_a), who || ' deleting a certification');
  END LOOP;

  -- ---------- Catalogue: nothing slips in unprotected ----------
  RESET ROLE;
  SELECT string_agg(c.relname, ', ') INTO s
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity;
  IF s IS NOT NULL THEN RAISE EXCEPTION 'FAIL: row security is off for %', s; END IF;

  n := 0;
  FOR rec IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND p.proname IN ('advisor_list_submissions', 'set_submission_status', 'review_submission_field', 'record_manuscript_version')
  LOOP
    n := n + 1;
    IF has_function_privilege('anon', rec.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: signed-out callers can execute %', rec.proname;
    END IF;
  END LOOP;
  IF n <> 4 THEN RAISE EXCEPTION 'FAIL: expected 4 advisor functions, found %', n; END IF;

  RAISE NOTICE 'advisor access matrix: all cases passed';
END $$;
