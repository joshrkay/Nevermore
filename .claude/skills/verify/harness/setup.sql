-- Harness DB: Supabase-shaped roles/auth stubs + the REAL migrations under test.
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'pw'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT anon, authenticated, service_role TO authenticator;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);

CREATE TABLE public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE,
  company_name text, contact_name text, phone text);
CREATE TABLE public.chamber_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  chamber_data jsonb NOT NULL DEFAULT '{}'::jsonb, transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress', submission jsonb, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.chamber_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_select ON public.chamber_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY own_insert ON public.chamber_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_update ON public.chamber_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

\i supabase/migrations/20261020200000_block_guest_submission.sql
\i supabase/migrations/20261020210000_certification_events.sql
\i supabase/migrations/20261025090000_submission_outbox.sql

-- Seed: a verified prospect (with a profile), a guest, and one fixed session per scenario.
INSERT INTO auth.users VALUES
  ('00000000-0000-0000-0000-00000000000a', 'jo@acme.example'),
  ('00000000-0000-0000-0000-00000000000b', NULL),
  ('00000000-0000-0000-0000-00000000000c', 'pat@globex.example');
INSERT INTO public.profiles (user_id, company_name, contact_name, phone)
VALUES ('00000000-0000-0000-0000-00000000000a', 'Acme (profile)', 'Joanna Doe', '555-0100');
