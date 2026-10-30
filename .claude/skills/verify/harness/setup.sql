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
-- The advisor role objects, copied verbatim from 20261022090000_advisor_operations.sql (lines 17-73). The rest of that
-- migration needs storage and documents, which this harness does not model; the advisor outbox functions only need these.
CREATE TYPE public.app_role AS ENUM ('advisor', 'admin');

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- No write policies, and no write grants: roles are granted with the service role only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_roles FROM anon, authenticated;

-- True when the signed-in user holds `_role`. False for signed-out callers and guests.
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role);
$$;

-- Admins can do everything advisors can.
CREATE OR REPLACE FUNCTION public.is_advisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role('advisor') OR public.has_role('admin');
$$;

REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_advisor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_advisor() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_advisor()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_advisor() THEN
    RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
  END IF;
END;
$$;

\i supabase/migrations/20261025090000_submission_outbox.sql
\i supabase/migrations/20261026090000_outbox_reliability.sql
\i supabase/migrations/20261027095000_outbox_operations.sql
\i supabase/migrations/20261027100000_outbox_schedule.sql
\i supabase/migrations/20261028090000_email_delivery_events.sql

-- Seed: a verified prospect (with a profile), a guest, and one fixed session per scenario.
INSERT INTO auth.users VALUES
  ('00000000-0000-0000-0000-00000000000a', 'jo@acme.example'),
  ('00000000-0000-0000-0000-00000000000b', NULL),
  ('00000000-0000-0000-0000-00000000000c', 'pat@globex.example');
INSERT INTO public.profiles (user_id, company_name, contact_name, phone)
VALUES ('00000000-0000-0000-0000-00000000000a', 'Acme (profile)', 'Joanna Doe', '555-0100');
