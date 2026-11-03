-- Data retention and deletion (US-6.1, plan H-1.1 to H-1.3). docs/DATA_HANDLING.md is the policy this
-- enforces; src/data/dataPolicy.ts is the same policy as the product shows it, and
-- src/data/schemaSync.test.ts keeps the windows below equal to it.
--
-- Windows (decision D4: recommended defaults, LEGAL to confirm before launch):
-- * An uncertified draft expires 30 days after its last change (public.intake_draft_retention(), A-1.5).
-- * A closed draft (expired, archived by its prospect, or revoked) is deleted, rows and stored files, 30
--   days after it closed: public.closed_draft_retention().
-- * A submitted record (an intake certified at least once) is never deleted by the draft rule. 3 years
--   after its latest certification (public.submitted_record_retention()) it is listed for an admin to
--   review (public.retention_review_due()) and deleted by request; a person can ask for it to go sooner.
-- * Operational events are pruned after 90 days (public.ops_event_retention()), email delivery events
--   after 365 days (public.email_event_retention()).
--
-- Deleting an intake removes its stored files AND its rows, files first. Files can only be removed through
-- the Storage API (deleting storage.objects rows in SQL leaves the file in the bucket), so a deletion is a
-- request the purge-intakes edge function carries out:
--
--   request_intake_deletion (admin)  ─┐
--   queue_retention_deletions (job)  ─┴─► intake_deletions row, pending
--   purge-intakes: claim_intake_deletions ─► intake_deletion_files ─► Storage API remove ─► complete_intake_deletion
--                                                                               └─ on failure: fail_intake_deletion
--
-- complete_intake_deletion refuses (EA006) while any of the intake's files is still stored, so a row is
-- never deleted before its file. It deletes every row that belongs to the intake in one transaction,
-- including the append-only audit rows (status history, review events, notes, lifecycle events, Manuscript
-- versions), which only it can delete; and records what it removed. The intake_deletions row itself is kept
-- for good as the record that the deletion happened: ids, counts and who asked, no intake content.
--
-- Not deleted with an intake: the account (auth.users, its profile and consent records) and email
-- delivery events (which age out on their own). Deleting an account is a separate, manual step;
-- docs/DATA_HANDLING.md says how.

-- ---------- Windows ----------

CREATE OR REPLACE FUNCTION public.closed_draft_retention()
RETURNS interval
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- sync:begin closed_draft_retention
    interval '30 days'
    -- sync:end closed_draft_retention
$$;

CREATE OR REPLACE FUNCTION public.submitted_record_retention()
RETURNS interval
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- sync:begin submitted_record_retention
    interval '3 years'
    -- sync:end submitted_record_retention
$$;

CREATE OR REPLACE FUNCTION public.email_event_retention()
RETURNS interval
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- sync:begin email_event_retention
    interval '365 days'
    -- sync:end email_event_retention
$$;

REVOKE ALL ON FUNCTION public.closed_draft_retention() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submitted_record_retention() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.email_event_retention() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.closed_draft_retention(), public.submitted_record_retention(), public.email_event_retention()
  TO authenticated, service_role;

-- ---------- Deletions ----------

CREATE TABLE IF NOT EXISTS public.intake_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No foreign key on purpose: the record of a deletion outlives what it deleted.
  session_id uuid NOT NULL,
  -- The intake's owner (an account id), so "was this person's intake deleted?" can be answered.
  user_id uuid,
  trigger text NOT NULL CHECK (trigger IN ('retention', 'request')),
  -- Why, in words. For a request, say who asked and how they were verified, not what the intake held.
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  requested_by uuid,            -- null for the retention job
  requested_by_email text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  -- A failure kind such as storage_remove:500 or files_remain:2, never file names or provider text.
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 200),
  files_deleted integer,
  rows_deleted jsonb,
  completed_at timestamptz
);

-- One open deletion per intake: asking again returns the one already under way.
CREATE UNIQUE INDEX IF NOT EXISTS intake_deletions_open_key
  ON public.intake_deletions (session_id) WHERE status <> 'done';
CREATE INDEX IF NOT EXISTS intake_deletions_due_idx
  ON public.intake_deletions (next_attempt_at) WHERE status IN ('pending', 'claimed');

ALTER TABLE public.intake_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Advisors can view intake deletions" ON public.intake_deletions;
CREATE POLICY "Advisors can view intake deletions"
  ON public.intake_deletions FOR SELECT TO authenticated
  USING (public.is_advisor());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.intake_deletions FROM anon, authenticated;

-- How many times purge-intakes tries before it stops and an operator is alerted.
CREATE OR REPLACE FUNCTION public.intake_deletion_max_attempts()
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT 5 $$;

REVOKE ALL ON FUNCTION public.intake_deletion_max_attempts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intake_deletion_max_attempts() TO authenticated, service_role;

-- ---------- Asking for a deletion ----------

-- An admin asks for an intake (any status, certified or not) to be deleted, for example on a verified
-- request from the person it belongs to. Returns the deletion's id; asking again while one is open returns
-- that one. PT404 when there is no such intake.
CREATE OR REPLACE FUNCTION public.request_intake_deletion(p_session_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  intake public.chamber_sessions;
  clean_reason constant text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  deletion_id uuid;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason IS NULL OR length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'A reason of 1 to 500 characters is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO intake FROM public.chamber_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake not found' USING ERRCODE = 'PT404';
  END IF;

  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, requested_by, requested_by_email)
  VALUES (intake.id, intake.user_id, 'request', clean_reason, auth.uid(), auth.jwt() ->> 'email')
  ON CONFLICT (session_id) WHERE status <> 'done' DO NOTHING
  RETURNING id INTO deletion_id;

  IF deletion_id IS NULL THEN
    SELECT d.id INTO deletion_id FROM public.intake_deletions d WHERE d.session_id = intake.id AND d.status <> 'done';
  END IF;
  RETURN deletion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_intake_deletion(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_intake_deletion(uuid, text) TO authenticated;

-- An admin puts a deletion that ran out of attempts back in the queue, with its attempts reset. True when
-- it did; false when the deletion is not failed.
CREATE OR REPLACE FUNCTION public.retry_intake_deletion(p_deletion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.intake_deletions
  SET status = 'pending', attempts = 0, next_attempt_at = now(), locked_until = NULL
  WHERE id = p_deletion_id AND status = 'failed';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.retry_intake_deletion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_intake_deletion(uuid) TO authenticated;

-- When a closed intake closed: its latest move into the status it holds, or its last update for one that
-- has no such record.
CREATE OR REPLACE FUNCTION public.intake_closed_at(p_session_id uuid, p_status text, p_updated_at timestamptz)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT max(e.created_at) FROM public.intake_lifecycle_events e
     WHERE e.session_id = p_session_id AND e.to_status = p_status),
    p_updated_at);
$$;

REVOKE ALL ON FUNCTION public.intake_closed_at(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_closed_at(uuid, text, timestamptz) TO service_role;

-- Queues a deletion for each closed draft that was never certified and closed more than
-- closed_draft_retention() ago, at most p_limit per call. Returns how many it queued. Anything ever
-- certified is out of its reach.
CREATE OR REPLACE FUNCTION public.queue_retention_deletions(p_limit integer DEFAULT 200)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  queued integer;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'p_limit must be at least 1' USING ERRCODE = '22023';
  END IF;

  WITH due AS (
    SELECT s.id, s.user_id, s.status
    FROM public.chamber_sessions s
    WHERE s.status IN ('expired', 'archived', 'revoked')
      AND NOT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.intake_deletions d WHERE d.session_id = s.id AND d.status <> 'done')
      AND public.intake_closed_at(s.id, s.status, s.updated_at) <= now() - public.closed_draft_retention()
    ORDER BY s.updated_at
    LIMIT p_limit
  ), added AS (
    INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason)
    SELECT due.id, due.user_id, 'retention',
           format('Draft %s and never certified; kept %s after it closed', due.status, public.closed_draft_retention())
    FROM due
    ON CONFLICT (session_id) WHERE status <> 'done' DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO queued FROM added;
  RETURN queued;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_retention_deletions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_retention_deletions(integer) TO service_role;

-- The daily retention job: queue closed drafts for deletion, and prune operational, email delivery and AI
-- rate-limit records past their windows. Returns what it did.
--
-- The AI rate-limit logs were only ever pruned for the caller, on their next call, so the rows of an account
-- or address that stopped calling were kept for good. They are pruned here for everyone.
CREATE OR REPLACE FUNCTION public.run_retention()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  queued integer;
  ops_pruned integer;
  email_pruned integer;
  ai_pruned integer;
  ip_pruned integer;
  usage_pruned integer;
BEGIN
  queued := public.queue_retention_deletions(500);

  DELETE FROM public.ops_events WHERE created_at < now() - public.ops_event_retention();
  GET DIAGNOSTICS ops_pruned = ROW_COUNT;

  -- A suppression keeps its address; it only loses the link to the event that caused it.
  DELETE FROM public.email_delivery_events WHERE received_at < now() - public.email_event_retention();
  GET DIAGNOSTICS email_pruned = ROW_COUNT;

  -- The same day the limits look back over (20261020190000_ai_rate_limit, 20261020220000_guest_abuse_limits).
  DELETE FROM public.ai_request_log WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS ai_pruned = ROW_COUNT;
  DELETE FROM public.ai_ip_log WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS ip_pruned = ROW_COUNT;
  -- Daily totals hold no account or address; kept as long as operational events, for cost questions.
  DELETE FROM public.ai_global_usage WHERE day < (now() - public.ops_event_retention())::date;
  GET DIAGNOSTICS usage_pruned = ROW_COUNT;

  RETURN jsonb_build_object(
    'deletions_queued', queued,
    'ops_events_pruned', ops_pruned,
    'email_events_pruned', email_pruned,
    'ai_request_log_pruned', ai_pruned,
    'ai_ip_log_pruned', ip_pruned,
    'ai_global_usage_pruned', usage_pruned
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_retention() TO service_role;

-- Submitted records whose latest certification is older than submitted_record_retention(), with no
-- deletion under way, oldest first: what an admin reviews for deletion (docs/DATA_HANDLING.md).
CREATE OR REPLACE FUNCTION public.retention_review_due(p_limit integer DEFAULT 100)
RETURNS TABLE (session_id uuid, file_id text, last_certified_at timestamptz, review_due_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_advisor();
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT c.session_id,
           (array_agg(c.file_id ORDER BY c.recorded_at DESC))[1],
           max(c.recorded_at),
           max(c.recorded_at) + public.submitted_record_retention()
    FROM public.chamber_certifications c
    WHERE NOT EXISTS (SELECT 1 FROM public.intake_deletions d WHERE d.session_id = c.session_id AND d.status <> 'done')
    GROUP BY c.session_id
    HAVING max(c.recorded_at) + public.submitted_record_retention() <= now()
    ORDER BY max(c.recorded_at), c.session_id
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.retention_review_due(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retention_review_due(integer) TO authenticated;

-- ---------- Carrying a deletion out (purge-intakes, service role) ----------

-- Claims up to p_batch deletions that are due (pending, or claimed by a worker whose lock lapsed), one
-- attempt each.
CREATE OR REPLACE FUNCTION public.claim_intake_deletions(p_batch integer DEFAULT 5, p_lock_seconds integer DEFAULT 600)
RETURNS TABLE (id uuid, session_id uuid, user_id uuid, attempt integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_batch IS NULL OR p_batch < 1 OR p_lock_seconds IS NULL OR p_lock_seconds < 30 THEN
    RAISE EXCEPTION 'p_batch must be at least 1 and p_lock_seconds at least 30' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    WITH due AS (
      SELECT d.id
      FROM public.intake_deletions d
      WHERE (d.status = 'pending' AND d.next_attempt_at <= now())
         OR (d.status = 'claimed' AND d.locked_until <= now())
      ORDER BY d.next_attempt_at, d.id
      LIMIT p_batch
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.intake_deletions d
    SET status = 'claimed',
        attempts = d.attempts + 1,
        locked_until = now() + make_interval(secs => p_lock_seconds)
    FROM due
    WHERE d.id = due.id
    RETURNING d.id, d.session_id, d.user_id, d.attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_intake_deletions(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_intake_deletions(integer, integer) TO service_role;

-- The intake's files that are still stored: everything in the documents bucket under its owner's folder
-- for it ({user_id}/{session_id}/...), and every generated Manuscript under {session_id}/ in the
-- manuscripts bucket. A document row that points anywhere else (only rows from before
-- 20261103110000_document_storage_path can) is not followed: that file may be someone else's.
CREATE OR REPLACE FUNCTION public.intake_stored_files(p_session_id uuid, p_user_id uuid)
RETURNS TABLE (bucket text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.bucket_id::text, o.name::text
  FROM storage.objects o
  WHERE (o.bucket_id = 'documents' AND p_user_id IS NOT NULL
         AND o.name LIKE p_user_id::text || '/' || p_session_id::text || '/%')
     OR (o.bucket_id = 'manuscripts' AND o.name LIKE p_session_id::text || '/%')
  ORDER BY 1, 2;
$$;

REVOKE ALL ON FUNCTION public.intake_stored_files(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_stored_files(uuid, uuid) TO service_role;

-- The files a claimed deletion still has to remove.
CREATE OR REPLACE FUNCTION public.intake_deletion_files(p_deletion_id uuid)
RETURNS TABLE (bucket text, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.intake_deletions;
BEGIN
  SELECT * INTO d FROM public.intake_deletions WHERE id = p_deletion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deletion not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN QUERY
    SELECT f.bucket, f.name
    FROM public.intake_stored_files(d.session_id, COALESCE((SELECT s.user_id FROM public.chamber_sessions s WHERE s.id = d.session_id), d.user_id)) f;
END;
$$;

REVOKE ALL ON FUNCTION public.intake_deletion_files(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_deletion_files(uuid) TO service_role;

-- The append-only audit tables refuse every change, except the deletion of the one intake
-- complete_intake_deletion() is deleting, inside that function (it runs as its owner, never as an API
-- role, and names the intake in a setting that lasts until the end of its transaction).
CREATE OR REPLACE FUNCTION public.reject_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_user NOT IN ('anon', 'authenticated', 'service_role')
     AND NULLIF(current_setting('eaa.deleting_intake', true), '') = to_jsonb(OLD) ->> 'session_id' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% records cannot be changed or deleted', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$;

-- Deletes every row of a claimed deletion's intake, once none of its files is stored any more (EA006,
-- DETAIL the count, otherwise), and marks the deletion done with what it removed. p_files_deleted is how
-- many files the worker removed for it. An intake that is already gone is done with nothing to delete.
CREATE OR REPLACE FUNCTION public.complete_intake_deletion(p_deletion_id uuid, p_files_deleted integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.intake_deletions;
  sid uuid;
  owner_id uuid;
  remaining integer;
  n integer;
  removed jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO d FROM public.intake_deletions WHERE id = p_deletion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deletion not found' USING ERRCODE = 'PT404';
  END IF;
  IF d.status <> 'claimed' THEN
    RAISE EXCEPTION 'Only a claimed deletion can be completed (this one is %)', d.status USING ERRCODE = '55000';
  END IF;
  sid := d.session_id;

  -- Hold the intake still while it is checked and deleted.
  SELECT s.user_id INTO owner_id FROM public.chamber_sessions s WHERE s.id = sid FOR UPDATE;
  owner_id := COALESCE(owner_id, d.user_id);

  SELECT count(*)::integer INTO remaining FROM public.intake_stored_files(sid, owner_id);
  IF remaining > 0 THEN
    RAISE EXCEPTION 'The intake still has % stored file(s); remove them first', remaining
      USING ERRCODE = 'EA006', DETAIL = remaining::text;
  END IF;

  PERFORM set_config('eaa.deleting_intake', sid::text, true);

  -- Children first, so each count says what that table held; the session row last.
  DELETE FROM public.manuscript_versions WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('manuscript_versions', n);
  DELETE FROM public.advisor_review_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_review_events', n);
  DELETE FROM public.advisor_field_reviews WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_field_reviews', n);
  DELETE FROM public.advisor_notes WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_notes', n);
  DELETE FROM public.submission_status_history WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('submission_status_history', n);
  DELETE FROM public.submission_workflow WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('submission_workflow', n);
  DELETE FROM public.intake_lifecycle_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('intake_lifecycle_events', n);
  DELETE FROM public.outbox_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('outbox_events', n);
  DELETE FROM public.chamber_certifications WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('chamber_certifications', n);
  DELETE FROM public.documents WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('documents', n);
  -- Operational events stay (they are counts for monitoring) but no longer point at the intake.
  UPDATE public.ops_events SET session_id = NULL WHERE session_id = sid;
  DELETE FROM public.chamber_sessions WHERE id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('chamber_sessions', n);

  PERFORM set_config('eaa.deleting_intake', '', true);

  UPDATE public.intake_deletions
  SET status = 'done',
      completed_at = now(),
      locked_until = NULL,
      last_error = NULL,
      files_deleted = GREATEST(COALESCE(p_files_deleted, 0), 0),
      rows_deleted = removed
  WHERE id = d.id;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_intake_deletion(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_intake_deletion(uuid, integer) TO service_role;

-- Records a failed attempt. Returns 'pending' (tried again after p_retry_in_seconds) or, once every attempt
-- is used, 'failed', which also records a deletion_failed operational event so an operator is alerted.
CREATE OR REPLACE FUNCTION public.fail_intake_deletion(p_deletion_id uuid, p_error text, p_retry_in_seconds integer DEFAULT 3600)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.intake_deletions;
  clean_error constant text := COALESCE(public.ops_clean_code(p_error), 'unknown');
BEGIN
  SELECT * INTO d FROM public.intake_deletions WHERE id = p_deletion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deletion not found' USING ERRCODE = 'PT404';
  END IF;
  IF d.status <> 'claimed' THEN
    RAISE EXCEPTION 'Only a claimed deletion can fail (this one is %)', d.status USING ERRCODE = '55000';
  END IF;

  IF d.attempts >= public.intake_deletion_max_attempts() THEN
    UPDATE public.intake_deletions
    SET status = 'failed', locked_until = NULL, last_error = left(clean_error, 200)
    WHERE id = d.id;
    PERFORM public.record_ops_event('deletion_failed', 'purge-intakes', clean_error, NULL, NULL, d.session_id);
    RETURN 'failed';
  END IF;

  UPDATE public.intake_deletions
  SET status = 'pending',
      locked_until = NULL,
      last_error = left(clean_error, 200),
      next_attempt_at = now() + make_interval(secs => GREATEST(COALESCE(p_retry_in_seconds, 3600), 0))
  WHERE id = d.id;
  RETURN 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.fail_intake_deletion(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_intake_deletion(uuid, text, integer) TO service_role;

-- ---------- Schedules ----------

-- The retention job, daily at 03:41 UTC. Needs pg_cron only. Without it, run `select public.run_retention();`
-- from any scheduler with the service role. An existing job of the same name is left as it is.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'retention: pg_cron is not available (%); run public.run_retention() another way', SQLERRM;
      RETURN;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-retention') THEN
    RAISE NOTICE 'retention: a run-retention job already exists; leaving it as it is';
    RETURN;
  END IF;

  PERFORM cron.schedule('run-retention', '41 3 * * *', 'select public.run_retention();');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'retention: could not schedule run-retention (%); run public.run_retention() another way', SQLERRM;
END $$;

-- purge-intakes, hourly at 23 minutes past, the same way dispatch-outbox is scheduled
-- (20261027100000_outbox_schedule.sql): Vault holds the project URL and service-role key, the job does
-- nothing until both exist, and a missing pg_cron or pg_net is a notice, not a failed migration.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'purge schedule: pg_cron is not available (%); schedule purge-intakes another way (docs/DATA_HANDLING.md)', SQLERRM;
      RETURN;
    END;
  END IF;

  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'purge schedule: pg_net is not available (%); schedule purge-intakes another way (docs/DATA_HANDLING.md)', SQLERRM;
      RETURN;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-intakes') THEN
    RAISE NOTICE 'purge schedule: a purge-intakes job already exists; leaving it as it is';
    RETURN;
  END IF;

  PERFORM cron.schedule('purge-intakes', '23 * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/purge-intakes',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'),
      body := '{}'::jsonb
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
  $job$);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'purge schedule: could not schedule purge-intakes (%); schedule it another way (docs/DATA_HANDLING.md)', SQLERRM;
END $$;
