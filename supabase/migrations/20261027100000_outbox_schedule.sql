-- Runs dispatch-outbox every minute (G-1.1), from the database, so the queue is worked even when no
-- browser is open: retries, the sweep that queues what a fenced fault left behind, and the
-- reaper for lost workers all ride on this schedule.
--
-- * The job reads the project URL and the service-role key from Supabase Vault each time it runs
--   (secrets `project_url` and `service_role_key`), so no key is ever written into a migration, and
--   a rotated key is picked up without touching the job. Until both secrets exist the job does
--   nothing, quietly. `npm run setup:supabase` stores the key; see docs/NOTIFICATIONS.md for the
--   two `vault.create_secret` calls by hand.
-- * An existing `dispatch-outbox` job is left exactly as it is: the setup script schedules one on
--   the project's own URL, and replacing it here would break a working schedule.
-- * Where pg_cron or pg_net cannot be had (a plain Postgres, a project that has not enabled them),
--   this logs a notice and does nothing: a missing scheduler must never fail the migration chain.
--   Check the schedule with `select jobname, schedule from cron.job;`.

DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'outbox schedule: pg_cron is not available (%); schedule dispatch-outbox another way (docs/NOTIFICATIONS.md)', SQLERRM;
      RETURN;
    END;
  END IF;

  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'outbox schedule: pg_net is not available (%); schedule dispatch-outbox another way (docs/NOTIFICATIONS.md)', SQLERRM;
      RETURN;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-outbox') THEN
    RAISE NOTICE 'outbox schedule: a dispatch-outbox job already exists; leaving it as it is';
    RETURN;
  END IF;

  PERFORM cron.schedule('dispatch-outbox', '* * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/dispatch-outbox',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'),
      body := '{}'::jsonb
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
  $job$);
EXCEPTION WHEN OTHERS THEN
  -- Scheduling is an operational convenience, never a reason to stop the schema from deploying.
  RAISE WARNING 'outbox schedule: could not schedule dispatch-outbox (%); schedule it another way (docs/NOTIFICATIONS.md)', SQLERRM;
END $$;
