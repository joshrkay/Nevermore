-- Run against a scratch Postgres (NOT production) after stubbing Supabase's `auth` and `storage` schemas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/session_documents.sql
-- Checks that a document is reachable only by the user who owns both it and its intake.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE IF NOT EXISTS storage.objects (bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
  $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

CREATE TABLE IF NOT EXISTS public.chamber_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chamber_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'in_progress'
);
ALTER TABLE public.chamber_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.chamber_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

\i supabase/migrations/20260323224722_847cb3a9-3573-491f-ba0c-54a2ccea0340.sql
\i supabase/migrations/20261021100000_session_documents.sql
\i supabase/migrations/20261023090000_document_categories_and_storage_access.sql
\i supabase/migrations/20261024090000_document_processing_started.sql

-- Documents uploaded under the earlier category names, to check the rename below.
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-0000000000c1');
INSERT INTO public.chamber_sessions (id, user_id) VALUES ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1');
INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
  SELECT '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', c || '.pdf', '1 B', 'legacy/' || c, c
  FROM unnest(ARRAY['census', 'benefits', 'payroll', 'workers_comp', 'peo_invoice', 'other']) AS c;

\i supabase/migrations/20261029090000_document_ingestion.sql

DO $$
DECLARE
  cats text[];
  b storage.buckets%ROWTYPE;
BEGIN
  SELECT array_agg(category ORDER BY category) INTO cats FROM public.documents WHERE session_id = '00000000-0000-0000-0000-0000000000c2';
  IF cats IS DISTINCT FROM ARRAY['benefits_summary', 'employee_census', 'other', 'payroll_report', 'peo_invoice', 'workers_comp_loss_runs'] THEN
    RAISE EXCEPTION 'FAIL: categories after the rename were %', cats;
  END IF;
  SELECT * INTO b FROM storage.buckets WHERE id = 'documents';
  IF b.file_size_limit IS DISTINCT FROM 20971520 OR NOT ('application/pdf' = ANY (b.allowed_mime_types))
     OR 'application/x-msdownload' = ANY (b.allowed_mime_types) THEN
    RAISE EXCEPTION 'FAIL: documents bucket limits were % %', b.file_size_limit, b.allowed_mime_types;
  END IF;
  DELETE FROM public.documents WHERE session_id = '00000000-0000-0000-0000-0000000000c2';
END $$;

GRANT USAGE ON SCHEMA auth, storage TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth, storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents, public.chamber_sessions, storage.objects TO authenticated;

-- Fixtures, written as the table owner: user A with sessions A1 and A2, user B with session B1.
CREATE TEMP TABLE ids AS SELECT gen_random_uuid() AS a, gen_random_uuid() AS b,
  gen_random_uuid() AS a1, gen_random_uuid() AS a2, gen_random_uuid() AS b1;
GRANT SELECT ON ids TO authenticated;
INSERT INTO auth.users SELECT a FROM ids UNION ALL SELECT b FROM ids;
INSERT INTO public.chamber_sessions (id, user_id)
  SELECT a1, a FROM ids UNION ALL SELECT a2, a FROM ids UNION ALL SELECT b1, b FROM ids;
-- A file under A's folder but another user's session (never creatable through the policies), and
-- a file from before intakes existed, stored directly under A's folder.
INSERT INTO storage.objects (bucket_id, name)
  SELECT 'documents', a || '/' || b1 || '/stray.csv' FROM ids
  UNION ALL SELECT 'documents', a || '/legacy.csv' FROM ids;

SET ROLE authenticated;

DO $$
DECLARE
  r ids%ROWTYPE;
  doc uuid;
  n int;
BEGIN
  SELECT * INTO r FROM ids;

  -- User A uploads into their own session.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', r.a)::text, false);
  INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', r.a || '/' || r.a1 || '/x_census.csv');
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category, size_bytes, mime_type)
    VALUES (r.a, r.a1, 'census.csv', '1 KB', r.a || '/' || r.a1 || '/x_census.csv', 'employee_census', 1024, 'text/csv')
    RETURNING id INTO doc;
  SELECT count(*) INTO n FROM public.documents WHERE session_id = r.a1;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: owner cannot see their document'; END IF;
  UPDATE public.documents SET category = 'payroll_report', status = 'extracted' WHERE id = doc;

  -- A cannot store an object under a session that isn't theirs, or outside their folder.
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', r.a || '/' || r.b1 || '/y.csv');
    RAISE EXCEPTION 'FAIL: object stored under another user''s session';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('documents', r.a || '/y.csv');
    RAISE EXCEPTION 'FAIL: object stored without a session folder';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- A cannot attach a row to B's session, nor an upload without a session.
  BEGIN
    INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
      VALUES (r.a, r.b1, 'x', '1 B', 'p');
    RAISE EXCEPTION 'FAIL: document attached to another user''s session';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.documents (user_id, file_name, file_size, storage_path) VALUES (r.a, 'x', '1 B', 'p');
    RAISE EXCEPTION 'FAIL: document inserted without a session';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- A cannot move a document to another intake, even one of their own.
  BEGIN
    UPDATE public.documents SET session_id = r.a2 WHERE id = doc;
    RAISE EXCEPTION 'FAIL: document moved to another session';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- Reading or deleting a file requires owning the intake it is stored under.
  SELECT count(*) INTO n FROM storage.objects WHERE name = r.a || '/' || r.b1 || '/stray.csv';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: object under another user''s session is readable'; END IF;
  DELETE FROM storage.objects WHERE name = r.a || '/' || r.b1 || '/stray.csv';
  SELECT count(*) INTO n FROM storage.objects WHERE name = r.a || '/legacy.csv';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: owner cannot read a file from before intakes existed'; END IF;
  SELECT count(*) INTO n FROM storage.objects WHERE name = r.a || '/' || r.a1 || '/x_census.csv';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: owner cannot read a file in their own session'; END IF;

  -- User B sees, changes, and deletes nothing of A's.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', r.b)::text, false);
  SELECT count(*) INTO n FROM public.documents;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: other user can see a document'; END IF;
  SELECT count(*) INTO n FROM storage.objects;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: other user can see a stored object'; END IF;
  UPDATE public.documents SET category = 'other' WHERE id = doc;
  DELETE FROM public.documents WHERE id = doc;
  BEGIN
    INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
      VALUES (r.b, r.a1, 'x', '1 B', 'p');
    RAISE EXCEPTION 'FAIL: document attached to another user''s session';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- A still has the document unchanged, and can remove it and its object.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', r.a)::text, false);
  SELECT count(*) INTO n FROM public.documents WHERE id = doc AND category = 'payroll_report';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: other user changed or deleted a document'; END IF;
  DELETE FROM public.documents WHERE id = doc;
  DELETE FROM storage.objects WHERE name = r.a || '/' || r.a1 || '/x_census.csv';
  SELECT count(*) INTO n FROM public.documents;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: owner could not delete their document'; END IF;

  -- Bad categories and statuses are rejected.
  BEGIN
    INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
      VALUES (r.a, r.a1, 'x', '1 B', 'p', 'tax_returns');
    RAISE EXCEPTION 'FAIL: unknown category accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- The intake's own categories are accepted; the retired one is not.
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
    VALUES (r.a, r.a1, 'inv.pdf', '1 B', 'p1', 'peo_invoice'), (r.a, r.a1, 'prop.pdf', '1 B', 'p2', 'prior_proposal');
  BEGIN
    INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
      VALUES (r.a, r.a1, 'x', '1 B', 'p', 'prior_invoices');
    RAISE EXCEPTION 'FAIL: retired category accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- The owner can record when a read started; the column is unset until then.
  SELECT count(*) INTO n FROM public.documents WHERE processing_started_at IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: processing_started_at set without a read'; END IF;
  UPDATE public.documents SET status = 'processing', processing_started_at = now() WHERE file_name = 'inv.pdf';
  SELECT count(*) INTO n FROM public.documents WHERE processing_started_at IS NOT NULL AND status = 'processing';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: owner could not record the start of a read'; END IF;

  -- The category names before the census contract are no longer accepted.
  BEGIN
    INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category)
      VALUES (r.a, r.a1, 'x', '1 B', 'p', 'census');
    RAISE EXCEPTION 'FAIL: retired category ''census'' accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- A new row's extraction starts empty rather than null.
  SELECT count(*) INTO n FROM public.documents WHERE file_name = 'inv.pdf' AND extraction = '{}'::jsonb;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: extraction did not default to {}'; END IF;

  -- The file fingerprint is a SHA-256 in hex, and an intake can't hold the same file twice.
  BEGIN
    INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, file_sha256)
      VALUES (r.a, r.a1, 'x', '1 B', 'p', 'not-a-hash');
    RAISE EXCEPTION 'FAIL: malformed file_sha256 accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, file_sha256)
    VALUES (r.a, r.a1, 'roster.csv', '1 B', 'h1', repeat('ab', 32));
  BEGIN
    INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, file_sha256)
      VALUES (r.a, r.a1, 'roster copy.csv', '1 B', 'h2', repeat('ab', 32));
    RAISE EXCEPTION 'FAIL: the same file was stored twice in one intake';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, file_sha256)
    VALUES (r.a, r.a2, 'roster.csv', '1 B', 'h3', repeat('ab', 32));

  -- An intake holds at most 25 documents.
  DELETE FROM public.documents WHERE session_id = r.a2;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
    SELECT r.a, r.a2, 'f' || i, '1 B', 'cap/' || i FROM generate_series(1, 25) AS i;
  BEGIN
    INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
      VALUES (r.a, r.a2, 'one too many', '1 B', 'cap/26');
    RAISE EXCEPTION 'FAIL: a 26th document was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- Another intake is unaffected.
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path)
    VALUES (r.a, r.a1, 'still fine', '1 B', 'cap/a1');

  RAISE NOTICE 'session_documents: all checks passed';
END $$;

RESET ROLE;
