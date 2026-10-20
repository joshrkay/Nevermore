-- Run against a scratch Postgres (NOT production) after stubbing Supabase's `auth` schema:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/block_guest_submission.sql
-- Stubs `auth.jwt()` so each case can pretend to be a guest, a verified user, or a service connection.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;

CREATE TABLE IF NOT EXISTS public.chamber_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'in_progress',
  submission jsonb
);
\i supabase/migrations/20261020200000_block_guest_submission.sql

DO $$
DECLARE sid uuid;
BEGIN
  -- Guest can create and edit an in-progress intake.
  PERFORM set_config('request.jwt.claims', '{"is_anonymous": true}', false);
  INSERT INTO public.chamber_sessions DEFAULT VALUES RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET submission = NULL WHERE id = sid;

  -- Guest cannot submit.
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', submission = '{"signer_name":"x"}' WHERE id = sid;
    RAISE EXCEPTION 'FAIL: guest update to submitted was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- Guest cannot create an already-submitted row.
  BEGIN
    INSERT INTO public.chamber_sessions (status) VALUES ('submitted');
    RAISE EXCEPTION 'FAIL: guest insert as submitted was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- Verified (non-anonymous) user can submit.
  PERFORM set_config('request.jwt.claims', '{"is_anonymous": false}', false);
  UPDATE public.chamber_sessions SET status = 'submitted', submission = '{"signer_name":"x"}' WHERE id = sid;

  -- No JWT (service role / migrations) is unaffected.
  PERFORM set_config('request.jwt.claims', '', false);
  INSERT INTO public.chamber_sessions (status) VALUES ('submitted');

  -- A guest touching an already-submitted row without changing it is not blocked.
  PERFORM set_config('request.jwt.claims', '{"is_anonymous": true}', false);
  UPDATE public.chamber_sessions SET status = 'submitted' WHERE id = sid;

  RAISE NOTICE 'block_guest_submission: all cases passed';
END $$;
