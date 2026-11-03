-- Intake lifecycle (A-1.5): an idle draft expires, the prospect can archive a draft ("Start over"), and an
-- admin can revoke one. Until now drafts never expired and "Start over" only dropped the id in the browser.
--
-- * status is a checked set: in_progress, submitted (certified), expired, archived, revoked. The last
--   three are closed: nothing the prospect sends changes a closed intake.
-- * last_activity_at is when the prospect last saved anything. expires_at is when an uncertified draft
--   expires: last_activity_at + public.intake_draft_retention(). It is null for any intake that was ever
--   certified, and an expired intake keeps the time it was due. The server sets both on every write
--   from the browser and ignores what a client sends. Privileged roles (the jobs, migrations, the
--   service role) may set them, which is how an operator extends one draft.
-- * public.expire_idle_intakes() moves drafts past expires_at to expired. It touches only intakes that
--   are in progress and were never certified, so a certified or submitted intake (or one an advisor is
--   working on after the prospect edited it) never expires. It writes one intake_lifecycle_events row per
--   intake it changes. pg_cron runs it hourly when the project has pg_cron (see the end of this file).
-- * public.archive_chamber_session(id) is the prospect's "Start over": it archives their own draft that
--   was never certified, and keeps anything certified or submitted as it is.
-- * public.revoke_chamber_session(id, reason) lets an admin close a draft for good (for example a link
--   that was shared by mistake). Admins only, drafts that were never certified only, a reason required.
-- * The prospect can no longer read archived or revoked intakes. Their documents and stored files go with
--   them, because those policies look the intake up under the prospect's own row security. The prospect can
--   still read an expired intake, so the Chamber can say it expired, but cannot change it or add
--   documents to it. Advisors still read every intake.
--
-- Retention: D4 is still open. 30 days is the recommended default, in public.intake_draft_retention().
-- Changing the function does not move expires_at on existing rows. Do that in the same migration,
-- as the backfill below does.
--
-- Existing rows: last_activity_at is backfilled from updated_at. Every existing uncertified draft gets
-- expires_at = now() + the window, so nothing expires on the day this deploys. The backfill runs with
-- the version and updated_at triggers off, so open tabs don't see a conflict and the advisor queue's
-- order doesn't change.
--
-- Deploy order: this migration, then the front end (it orders by last_activity_at, selects expires_at
-- and calls archive_chamber_session). The old front end keeps working against it, except that its
-- bare /start would no longer find a draft that has expired (it never resumed archived ones).

-- ---------- Columns and the status set ----------

ALTER TABLE public.chamber_sessions
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- The retention window for an uncertified draft. One place to change it (decision D4).
CREATE OR REPLACE FUNCTION public.intake_draft_retention()
RETURNS interval
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- sync:begin draft_retention
    interval '30 days'
    -- sync:end draft_retention
$$;

-- A backfill is not a save: no new version, no new updated_at.
ALTER TABLE public.chamber_sessions
  DISABLE TRIGGER chamber_sessions_data_version,
  DISABLE TRIGGER update_chamber_sessions_updated_at;

UPDATE public.chamber_sessions s
SET last_activity_at = s.updated_at,
    expires_at = CASE
      WHEN s.status = 'in_progress'
        AND NOT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = s.id)
      THEN now() + public.intake_draft_retention()
    END
WHERE s.last_activity_at IS NULL;

ALTER TABLE public.chamber_sessions
  ENABLE TRIGGER chamber_sessions_data_version,
  ENABLE TRIGGER update_chamber_sessions_updated_at;

ALTER TABLE public.chamber_sessions
  ALTER COLUMN last_activity_at SET DEFAULT now(),
  ALTER COLUMN last_activity_at SET NOT NULL;

-- NOT VALID first so a row holding some other status can't stop the deploy; it is then checked, and a
-- failure only warns (new writes are held to the set either way).
ALTER TABLE public.chamber_sessions DROP CONSTRAINT IF EXISTS chamber_sessions_status_check;
ALTER TABLE public.chamber_sessions ADD CONSTRAINT chamber_sessions_status_check
  CHECK (status IN ('in_progress', 'submitted', 'expired', 'archived', 'revoked')) NOT VALID;
DO $$
BEGIN
  ALTER TABLE public.chamber_sessions VALIDATE CONSTRAINT chamber_sessions_status_check;
EXCEPTION WHEN check_violation THEN
  RAISE WARNING 'intake lifecycle: some chamber_sessions rows hold a status outside the set; find them with: select id, status from chamber_sessions where status not in (''in_progress'', ''submitted'', ''expired'', ''archived'', ''revoked'')';
END $$;

-- What the expiry job scans, and what a returning prospect's latest intake is found by.
CREATE INDEX IF NOT EXISTS chamber_sessions_draft_expiry_idx
  ON public.chamber_sessions (expires_at) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS chamber_sessions_user_activity_idx
  ON public.chamber_sessions (user_id, last_activity_at DESC);

-- ---------- Audit ----------

-- Every expiry, archive and revocation, kept for good.
CREATE TABLE IF NOT EXISTS public.intake_lifecycle_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- No foreign key on purpose: the record must outlive the session row.
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text,
  actor_id uuid,          -- null for the system (the expiry job)
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intake_lifecycle_events_session_idx
  ON public.intake_lifecycle_events (session_id, created_at DESC);

ALTER TABLE public.intake_lifecycle_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Advisors can view intake lifecycle events" ON public.intake_lifecycle_events;
CREATE POLICY "Advisors can view intake lifecycle events"
  ON public.intake_lifecycle_events FOR SELECT TO authenticated
  USING (public.is_advisor());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.intake_lifecycle_events FROM anon, authenticated;

DROP TRIGGER IF EXISTS intake_lifecycle_events_append_only ON public.intake_lifecycle_events;
CREATE TRIGGER intake_lifecycle_events_append_only
  BEFORE UPDATE OR DELETE ON public.intake_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

-- ---------- The server owns the lifecycle columns ----------

-- Runs after the certification trigger (by name order), so it sees the status that write leaves: a
-- certified intake whose answers change is back in progress, but was certified, so it never expires.
--
-- A write from the browser (current_user anon or authenticated) cannot touch a closed intake (EA002,
-- DETAIL the status), cannot close one itself (that is archive_chamber_session and the jobs), and counts
-- as activity. Row security already hides closed rows from those writes, so this is the backstop.
-- Inside a SECURITY DEFINER function current_user is the function's owner, not the caller, which is
-- how archive_chamber_session and revoke_chamber_session get past the second rule.
CREATE OR REPLACE FUNCTION public.stamp_intake_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  from_client constant boolean := current_user IN ('anon', 'authenticated');
  recompute boolean;
BEGIN
  IF from_client THEN
    IF TG_OP = 'UPDATE' AND OLD.status IN ('expired', 'archived', 'revoked') THEN
      RAISE EXCEPTION 'This intake is closed (%) and can no longer be changed', OLD.status
        USING ERRCODE = 'EA002', DETAIL = OLD.status;
    END IF;
    IF NEW.status IN ('expired', 'archived', 'revoked') THEN
      RAISE EXCEPTION 'An intake cannot be set to % directly', NEW.status USING ERRCODE = '42501';
    END IF;
    NEW.last_activity_at := now();
    recompute := true;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.last_activity_at := COALESCE(NEW.last_activity_at, now());
    recompute := NEW.expires_at IS NULL;
  ELSE
    -- A privileged write keeps what it set; a new activity time, a draft that is open again, or a
    -- missing expiry is worked out again.
    recompute := NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at
      OR OLD.status IS DISTINCT FROM 'in_progress'
      OR NEW.expires_at IS NULL;
  END IF;

  IF NEW.status = 'in_progress'
     AND NOT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = NEW.id) THEN
    IF recompute THEN
      NEW.expires_at := NEW.last_activity_at + public.intake_draft_retention();
    END IF;
  ELSIF NEW.status = 'expired' THEN
    -- When it was due, for the "expired on" the Chamber shows.
    IF TG_OP = 'UPDATE' THEN
      NEW.expires_at := COALESCE(OLD.expires_at, now());
    ELSE
      NEW.expires_at := COALESCE(NEW.expires_at, now());
    END IF;
  ELSE
    NEW.expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chamber_sessions_lifecycle ON public.chamber_sessions;
CREATE TRIGGER chamber_sessions_lifecycle
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_lifecycle();

REVOKE ALL ON FUNCTION public.stamp_intake_lifecycle() FROM PUBLIC, anon, authenticated;
-- The trigger calls it as the signed-in user.
REVOKE ALL ON FUNCTION public.intake_draft_retention() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intake_draft_retention() TO authenticated, service_role;

-- ---------- Row security: closed intakes ----------

-- Owners see everything but archived and revoked intakes. An expired one stays readable so the Chamber
-- can say what happened to it.
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.chamber_sessions;
CREATE POLICY "Users can view their own sessions"
  ON public.chamber_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND status NOT IN ('archived', 'revoked'));

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.chamber_sessions;
CREATE POLICY "Users can insert their own sessions"
  ON public.chamber_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status IN ('in_progress', 'submitted'));

-- Only an open intake can be changed, and only into an open state. A save to a closed intake matches
-- no row, which the browser reads back and tells apart from another tab's save.
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.chamber_sessions;
CREATE POLICY "Users can update their own sessions"
  ON public.chamber_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('in_progress', 'submitted'))
  WITH CHECK (auth.uid() = user_id AND status IN ('in_progress', 'submitted'));

-- No document is added to a closed intake. Row security already refuses archived and revoked ones (the
-- prospect can't see them); this covers an expired one. Server-side writers (document-extract) only
-- update rows, so they are unaffected.
CREATE OR REPLACE FUNCTION public.documents_refuse_closed_intake()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  intake_status text;
BEGIN
  IF NEW.session_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT s.status INTO intake_status FROM public.chamber_sessions s WHERE s.id = NEW.session_id;
  IF intake_status IN ('expired', 'archived', 'revoked') THEN
    RAISE EXCEPTION 'This intake is closed (%) and can no longer take documents', intake_status
      USING ERRCODE = 'EA002', DETAIL = intake_status;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.documents_refuse_closed_intake() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS documents_refuse_closed_intake ON public.documents;
CREATE TRIGGER documents_refuse_closed_intake
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_refuse_closed_intake();

-- Stored files: an upload has to name an intake that is still open, as well as one the uploader owns.
DROP POLICY IF EXISTS "Users can upload documents into their own sessions" ON storage.objects;
CREATE POLICY "Users can upload documents into their own sessions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.chamber_sessions s
    WHERE s.id::text = (storage.foldername(name))[2] AND s.user_id = auth.uid()
      AND s.status IN ('in_progress', 'submitted')
  )
);

-- ---------- Expiry ----------

-- Moves uncertified drafts that are past expires_at to expired, at most p_limit per call, and returns how
-- many it moved. Rows being saved at that moment are skipped (SKIP LOCKED) and picked up next run, or
-- not at all if the save made them active again.
CREATE OR REPLACE FUNCTION public.expire_idle_intakes(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved integer;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'p_limit must be at least 1' USING ERRCODE = '22023';
  END IF;

  WITH due AS (
    SELECT s.id
    FROM public.chamber_sessions s
    WHERE s.status = 'in_progress'
      AND s.expires_at <= now()
      AND NOT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = s.id)
    ORDER BY s.expires_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ), changed AS (
    UPDATE public.chamber_sessions s
    SET status = 'expired'
    FROM due
    WHERE s.id = due.id
    RETURNING s.id, s.user_id, s.last_activity_at
  ), logged AS (
    INSERT INTO public.intake_lifecycle_events (session_id, user_id, from_status, to_status, reason)
    SELECT c.id, c.user_id, 'in_progress', 'expired',
           format('No activity since %s (retention %s)', to_char(c.last_activity_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI "UTC"'), public.intake_draft_retention())
    FROM changed c
    RETURNING 1
  )
  SELECT count(*)::integer INTO moved FROM logged;
  RETURN moved;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_idle_intakes(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_idle_intakes(integer) TO service_role;

-- ---------- Start over ----------

-- The prospect's "Start over". Archives their own draft when it was never certified and returns
-- 'archived'. Anything else of theirs that is still visible (certified, submitted, a certified intake
-- they have since changed, or one that already expired) is kept as it is: 'kept'. PT404 when there is
-- no such intake of theirs, which includes one already archived (so a retry after a lost response
-- reads as done) and someone else's (without saying whether it exists). PostgREST answers a PTxyz
-- SQLSTATE with HTTP xyz, so this is a 404, not the 500 an unmapped code such as P0002 would be.
CREATE OR REPLACE FUNCTION public.archive_chamber_session(p_session_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  intake public.chamber_sessions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to archive an intake' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO intake
  FROM public.chamber_sessions
  WHERE id = p_session_id AND user_id = auth.uid() AND status NOT IN ('archived', 'revoked')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake not found' USING ERRCODE = 'PT404';
  END IF;

  IF intake.status <> 'in_progress'
     OR EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = intake.id) THEN
    RETURN 'kept';
  END IF;

  UPDATE public.chamber_sessions SET status = 'archived' WHERE id = intake.id;
  INSERT INTO public.intake_lifecycle_events (session_id, user_id, from_status, to_status, reason, actor_id, actor_email)
  VALUES (intake.id, intake.user_id, intake.status, 'archived', 'The prospect started over', auth.uid(), auth.jwt() ->> 'email');
  RETURN 'archived';
END;
$$;

REVOKE ALL ON FUNCTION public.archive_chamber_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_chamber_session(uuid) TO authenticated;

-- ---------- Revocation ----------

-- Closes a draft for good: its owner can no longer read it, change it, or reach its documents. Admins
-- only, for drafts that were never certified (in progress, or already expired), with a reason.
-- Returns 'revoked'; revoking a revoked intake again changes nothing.
CREATE OR REPLACE FUNCTION public.revoke_chamber_session(p_session_id uuid, p_reason text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  intake public.chamber_sessions;
  clean_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason IS NULL OR length(clean_reason) > 2000 THEN
    RAISE EXCEPTION 'A reason of 1 to 2000 characters is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO intake FROM public.chamber_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake not found' USING ERRCODE = 'PT404';
  END IF;
  IF intake.status = 'revoked' THEN
    RETURN 'revoked';
  END IF;
  IF intake.status NOT IN ('in_progress', 'expired')
     OR EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = intake.id) THEN
    RAISE EXCEPTION 'Only a draft that was never certified can be revoked (this intake is %)', intake.status
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.chamber_sessions SET status = 'revoked' WHERE id = intake.id;
  INSERT INTO public.intake_lifecycle_events (session_id, user_id, from_status, to_status, reason, actor_id, actor_email)
  VALUES (intake.id, intake.user_id, intake.status, 'revoked', clean_reason, auth.uid(), auth.jwt() ->> 'email');
  RETURN 'revoked';
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_chamber_session(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_chamber_session(uuid, text) TO authenticated;

-- ---------- Schedule ----------

-- Hourly, from the database. Needs pg_cron only (no pg_net, no Vault). Without it this logs a notice
-- and the job can be run another way (for example `select public.expire_idle_intakes();` from any
-- scheduler with the service role). An existing job of the same name is left as it is.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'intake expiry: pg_cron is not available (%); run public.expire_idle_intakes() another way', SQLERRM;
      RETURN;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-idle-intakes') THEN
    RAISE NOTICE 'intake expiry: an expire-idle-intakes job already exists; leaving it as it is';
    RETURN;
  END IF;

  -- Seventeen past the hour, off the top of the hour when most schedules run.
  PERFORM cron.schedule('expire-idle-intakes', '17 * * * *', 'select public.expire_idle_intakes();');
EXCEPTION WHEN OTHERS THEN
  -- Scheduling is an operational convenience, never a reason to stop the schema from deploying.
  RAISE WARNING 'intake expiry: could not schedule expire-idle-intakes (%); run public.expire_idle_intakes() another way', SQLERRM;
END $$;
