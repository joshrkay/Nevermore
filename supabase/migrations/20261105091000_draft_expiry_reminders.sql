-- A reminder before an idle draft closes.
--
-- An uncertified draft expires 30 days after its last change (20261103090000_intake_lifecycle.sql), and until now
-- nothing told the prospect it was about to. A prospect who verified an email and asked for it (the box in the
-- Chamber's "Save your progress", or on their profile) now gets one email a week before: when the draft closes and
-- a link back to it. Nobody else does: a reminder isn't a receipt for something the prospect just did, so it needs
-- their consent and a way to stop (docs/NOTIFICATIONS.md, "Consent and preferences").
--
-- * profiles.draft_reminders_at: when the account asked for reminders, stamped by the server; null for none. The
--   owner sets and clears it with their own profile update (the existing policy); turning it off is clearing it.
--
-- * public.draft_reminder_lead(): how long before the draft closes the reminder goes (7 days).
-- * public.queue_draft_expiry_reminders(): queues a `draft_expiry_reminder` for each draft inside that window whose
--   owner has a verified email and asked for reminders, that holds something the prospect did (public.intake_holds_nothing), and that has
--   none queued for its current closing time. Any change moves the closing time, so a draft left idle again gets
--   another reminder for its new one; never two for the same. Hourly, from pg_cron, at 29 past.
-- * The outbox learns the new kind, and it counts as reaching the prospect, so suppression applies to it. A due
--   reminder whose reason has gone (reminders stopped, or the draft's closing time moved or ended) is cancelled
--   before it is claimed (claim_outbox_events).
--
-- The email carries the company name, the closing time, a link, and how to stop (the profile's box, or a reply);
-- never an answer. Counsel to confirm the wording and the stop mechanism (docs/LEGAL_REVIEW.md).
--
-- Deploy order: dispatch-outbox (it sends the new kind) before or after; nothing is sent until both are deployed.

SET lock_timeout = '5s';

-- ---------- The outbox's kinds ----------

-- Unchanged from 20261105090000_information_requests.sql except that the reminder reaches the prospect too.
CREATE OR REPLACE FUNCTION public.outbox_kind_reaches_prospect(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_kind IN (
    -- sync:begin prospect_outbox_kinds
    'prospect_confirmation', 'information_request', 'draft_expiry_reminder'
    -- sync:end prospect_outbox_kinds
  );
$$;

REVOKE ALL ON FUNCTION public.outbox_kind_reaches_prospect(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request', 'draft_expiry_reminder'
    -- sync:end outbox_kinds
  ));

-- ---------- A reminder that no longer holds is not sent ----------

-- Unchanged from 20261105090000_information_requests.sql except that, before claiming, a due draft reminder is
-- cancelled (marked 'suppressed', and why) when its owner has stopped reminders or the draft no longer closes when the
-- reminder says. Queued and sent are a minute apart when all is well, but a reminder can wait longer (the provider
-- down, a setting missing), and unticking the box must stop it.
CREATE OR REPLACE FUNCTION public.claim_outbox_events(
  p_kinds text[],
  p_batch integer,
  p_max_attempts integer,
  p_lock_seconds integer DEFAULT 600
)
RETURNS SETOF public.outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = left('suppressed: ' || s.reason, 200),
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  FROM public.email_suppressions s
  WHERE public.outbox_kind_reaches_prospect(e.kind) AND e.status = 'pending' AND e.next_attempt_at <= now()
    AND s.address = lower(btrim(e.payload ->> 'recipient_email'));

  -- A draft reminder whose reason has gone is not sent: its owner stopped reminders, or the draft no longer closes
  -- when it says (a change moved the closing time; certifying, archiving or expiry ended it).
  UPDATE public.outbox_events e
  SET status = 'suppressed',
      last_error = CASE WHEN p.draft_reminders_at IS NULL THEN 'cancelled: reminders turned off' ELSE 'cancelled: the draft changed' END,
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  FROM public.chamber_sessions s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE e.kind = 'draft_expiry_reminder' AND e.status = 'pending' AND e.next_attempt_at <= now()
    AND s.id = e.session_id
    AND (p.draft_reminders_at IS NULL
         OR s.status <> 'in_progress'
         OR s.expires_at IS NULL
         OR to_char(s.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') IS DISTINCT FROM e.payload ->> 'expires_at');

  RETURN QUERY
  UPDATE public.outbox_events e
  SET status = 'claimed', attempts = e.attempts + 1, claimed_at = now(),
      locked_until = now() + make_interval(secs => p_lock_seconds)
  WHERE e.id IN (
    SELECT o.id
    FROM public.outbox_events o
    WHERE o.kind = ANY (p_kinds)
      AND o.attempts < p_max_attempts
      AND ((o.status = 'pending' AND o.next_attempt_at <= now()) OR (o.status = 'claimed' AND o.locked_until < now()))
    ORDER BY o.next_attempt_at, o.created_at
    LIMIT p_batch
    FOR UPDATE SKIP LOCKED
  )
  RETURNING e.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) TO service_role;

-- ---------- Who asked to be reminded ----------

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS draft_reminders_at timestamptz;

-- The time is the server's: a browser can ask for reminders or stop them, not say when it asked.
CREATE OR REPLACE FUNCTION public.stamp_draft_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.draft_reminders_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.draft_reminders_at IS NULL OR NEW.draft_reminders_at IS DISTINCT FROM OLD.draft_reminders_at) THEN
    NEW.draft_reminders_at := CASE WHEN TG_OP = 'UPDATE' AND OLD.draft_reminders_at IS NOT NULL THEN OLD.draft_reminders_at ELSE now() END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_draft_reminders() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stamp_draft_reminders ON public.profiles;
CREATE TRIGGER stamp_draft_reminders
  BEFORE INSERT OR UPDATE OF draft_reminders_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.stamp_draft_reminders();

-- ---------- Who is reminded, and when ----------

CREATE OR REPLACE FUNCTION public.draft_reminder_lead()
RETURNS interval
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT interval '7 days';
$$;

REVOKE ALL ON FUNCTION public.draft_reminder_lead() FROM PUBLIC, anon, authenticated;

-- Queues at most p_limit reminders, the drafts closing soonest first, and returns how many. Runs as the service role
-- (pg_cron); nobody else may call it.
CREATE OR REPLACE FUNCTION public.queue_draft_expiry_reminders(p_limit integer DEFAULT 200)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  queued integer;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'p_limit must be at least 1' USING ERRCODE = '22023';
  END IF;

  WITH due AS (
    SELECT s.id, s.expires_at, s.chamber_data, NULLIF(btrim(u.email), '') AS email, NULLIF(btrim(p.contact_name), '') AS contact,
           s.id::text || ':' || to_char(s.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS dedupe
    FROM public.chamber_sessions s
    JOIN auth.users u ON u.id = s.user_id
    JOIN public.profiles p ON p.user_id = s.user_id
    WHERE s.status = 'in_progress'
      AND p.draft_reminders_at IS NOT NULL
      AND s.expires_at > now()
      AND s.expires_at <= now() + public.draft_reminder_lead()
      AND NOT COALESCE(u.is_anonymous, false)
      AND NULLIF(btrim(u.email), '') IS NOT NULL
      AND NOT public.intake_holds_nothing(s.chamber_data, s.field_provenance, s.transcript, s.chosen_peo)
      AND NOT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = s.id)
  ), fresh AS (
    SELECT d.*
    FROM due d
    WHERE NOT EXISTS (SELECT 1 FROM public.outbox_events e WHERE e.kind = 'draft_expiry_reminder' AND e.dedupe_key = d.dedupe)
    ORDER BY d.expires_at
    LIMIT p_limit
  ), inserted AS (
    INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
    SELECT 'draft_expiry_reminder', f.id, f.dedupe,
      jsonb_build_object(
        'company_name', left(NULLIF(btrim(f.chamber_data ->> 'company_name'), ''), 200),
        'recipient_name', left(f.contact, 200),
        'recipient_email', f.email,
        'expires_at', to_char(f.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    FROM fresh f
    ON CONFLICT (kind, dedupe_key) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO queued FROM inserted;
  RETURN queued;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_draft_expiry_reminders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_draft_expiry_reminders(integer) TO service_role;

-- ---------- Schedule ----------

-- Hourly, from the database. Needs pg_cron only. Without it this logs a notice and the job can be run another way
-- (`select public.queue_draft_expiry_reminders();` with the service role). An existing job of the same name is left
-- as it is. dispatch-outbox, every minute, sends what it queues.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'draft reminders: pg_cron is not available (%); run public.queue_draft_expiry_reminders() another way', SQLERRM;
      RETURN;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'remind-idle-intakes') THEN
    RAISE NOTICE 'draft reminders: a remind-idle-intakes job already exists; leaving it as it is';
    RETURN;
  END IF;

  -- Twenty-nine past the hour: off the top of the hour, and apart from expire-idle-intakes (:17) and purge-intakes (:23).
  PERFORM cron.schedule('remind-idle-intakes', '29 * * * *', 'select public.queue_draft_expiry_reminders();');
EXCEPTION WHEN OTHERS THEN
  -- Scheduling is an operational convenience, never a reason to stop the schema from deploying.
  RAISE WARNING 'draft reminders: could not schedule remind-idle-intakes (%); run public.queue_draft_expiry_reminders() another way', SQLERRM;
END $$;

RESET lock_timeout;
