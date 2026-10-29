-- Run against a scratch Postgres (NOT production); it drops and recreates the `cron`, `net`, `vault`
-- and `extensions` schemas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/outbox_schedule.sql
-- The every-minute dispatch-outbox schedule (G-1.1) as a migration. A plain Postgres has no pg_cron,
-- so the migration must do nothing, without failing. Then stand-ins for pg_cron, pg_net and Vault
-- (same names and signatures as the real ones) prove the job it creates: once, on every minute, not
-- over an existing job, and idle until the two secrets exist, then posting with the service-role key.
DROP SCHEMA IF EXISTS cron CASCADE;
DROP SCHEMA IF EXISTS net CASCADE;
DROP SCHEMA IF EXISTS vault CASCADE;
DROP SCHEMA IF EXISTS extensions CASCADE;
DROP TABLE IF EXISTS public.http_log;

-- ---------- Without a scheduler: a notice, no failure, no job ----------
\i supabase/migrations/20261027100000_outbox_schedule.sql

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: the migration invented a cron schema'; END IF;
  RAISE NOTICE 'outbox_schedule: no-scheduler case passed';
END $$;

-- ---------- Stand-ins ----------
CREATE SCHEMA cron;
CREATE TABLE cron.job (jobid serial PRIMARY KEY, jobname text UNIQUE, schedule text NOT NULL, command text NOT NULL);
-- pg_cron's schedule(name, schedule, command) creates the job, or replaces the one of that name.
CREATE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job (jobname, schedule, command) VALUES (job_name, schedule, command)
  ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
  RETURNING jobid::bigint
$$;

CREATE SCHEMA net;
CREATE TABLE public.http_log (url text, headers jsonb, body jsonb);
CREATE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}', params jsonb DEFAULT '{}',
                              headers jsonb DEFAULT '{"Content-Type": "application/json"}', timeout_milliseconds integer DEFAULT 5000)
RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO public.http_log VALUES (url, headers, body) RETURNING 1::bigint
$$;

CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets (name text PRIMARY KEY, decrypted_secret text);

-- ---------- With one: the job is created once ----------
\i supabase/migrations/20261027100000_outbox_schedule.sql
\i supabase/migrations/20261027100000_outbox_schedule.sql

DO $$
DECLARE
  job cron.job;
BEGIN
  IF (SELECT count(*) FROM cron.job) <> 1 THEN RAISE EXCEPTION 'FAIL: expected one job, found %', (SELECT count(*) FROM cron.job); END IF;
  SELECT * INTO job FROM cron.job WHERE jobname = 'dispatch-outbox';
  IF job.schedule <> '* * * * *' THEN RAISE EXCEPTION 'FAIL: the job runs on "%", not every minute', job.schedule; END IF;

  -- No key in the migration or the job: both come from Vault when it runs.
  IF job.command !~ 'project_url' OR job.command !~ 'service_role_key' OR job.command !~ '/functions/v1/dispatch-outbox' THEN
    RAISE EXCEPTION 'FAIL: the job does not read the URL and key from Vault and call dispatch-outbox: %', job.command;
  END IF;
  IF job.command ~* 'eyJ|https://[a-z0-9]+\.supabase\.co' THEN RAISE EXCEPTION 'FAIL: a key or project URL is written into the job'; END IF;

  -- Idle until both secrets exist: nothing is posted, and nothing fails.
  EXECUTE job.command;
  INSERT INTO vault.decrypted_secrets VALUES ('service_role_key', 'KEY-ONLY');
  EXECUTE job.command;
  IF (SELECT count(*) FROM public.http_log) <> 0 THEN RAISE EXCEPTION 'FAIL: the job posted without both secrets'; END IF;
  DELETE FROM vault.decrypted_secrets;
  INSERT INTO vault.decrypted_secrets VALUES ('project_url', 'https://abc.supabase.co');
  EXECUTE job.command;
  IF (SELECT count(*) FROM public.http_log) <> 0 THEN RAISE EXCEPTION 'FAIL: the job posted without the key'; END IF;

  -- With both: one authenticated POST to the function, per run.
  INSERT INTO vault.decrypted_secrets VALUES ('service_role_key', 'SECRET-KEY');
  EXECUTE job.command;
  IF (SELECT count(*) FROM public.http_log) <> 1
     OR (SELECT url FROM public.http_log) <> 'https://abc.supabase.co/functions/v1/dispatch-outbox'
     OR (SELECT headers ->> 'Authorization' FROM public.http_log) <> 'Bearer SECRET-KEY'
     OR (SELECT headers ->> 'Content-Type' FROM public.http_log) <> 'application/json' THEN
    RAISE EXCEPTION 'FAIL: the job posted %', (SELECT to_jsonb(h) FROM public.http_log h LIMIT 1);
  END IF;
  -- A rotated key is picked up without touching the job.
  UPDATE vault.decrypted_secrets SET decrypted_secret = 'NEW-KEY' WHERE name = 'service_role_key';
  EXECUTE job.command;
  IF (SELECT headers ->> 'Authorization' FROM public.http_log ORDER BY ctid DESC LIMIT 1) <> 'Bearer NEW-KEY' THEN
    RAISE EXCEPTION 'FAIL: a rotated key was not picked up';
  END IF;
  RAISE NOTICE 'outbox_schedule: job cases passed';
END $$;

-- ---------- An existing job (the setup script's, on the project's own URL) is never replaced ----------
DELETE FROM cron.job;
SELECT cron.schedule('dispatch-outbox', '* * * * *', 'select 1 -- the setup script''s job');
\i supabase/migrations/20261027100000_outbox_schedule.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM cron.job) <> 1 OR (SELECT command FROM cron.job) <> 'select 1 -- the setup script''s job' THEN
    RAISE EXCEPTION 'FAIL: the migration replaced an existing dispatch-outbox job: %', (SELECT command FROM cron.job);
  END IF;
  RAISE NOTICE 'outbox_schedule: existing-job case passed';
END $$;

-- ---------- A scheduler that fails never fails the migration ----------
DELETE FROM cron.job;
CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'cron is broken'; END $$;
\i supabase/migrations/20261027100000_outbox_schedule.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM cron.job) <> 0 THEN RAISE EXCEPTION 'FAIL: a job appeared despite the failing scheduler'; END IF;
  RAISE NOTICE 'outbox_schedule: all cases passed';
END $$;
