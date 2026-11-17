-- A draft the firm started does not expire from sitting idle (D-1911).
--
-- expire_idle_intakes ended every uncertified draft left 30 days, with no thought for who the draft belongs to. A draft a firm's member started for a client (start_broker_intake)
-- is the firm's working file, not a prospect's abandoned one: it carries the answers the broker typed, the invitation to the client and the way back (Continue the intake, D-1908).
-- Two things were wrong with expiring it:
--   * The job would have stopped working. A firm-started draft has no user until the client accepts the invitation (user_id is null), and the event the job writes for each intake it expires
--     (intake_lifecycle_events) requires one. The first such draft to pass its 30 days would have made the whole statement fail, hourly, and every other intake's expiry with it.
--   * A broker who left one for a month and came back would have found it expired, the quote gone with it.
-- So the job leaves any intake with a starter alone (accept_intake_invite gives the intake a user and never clears started_by, so it stays the firm's file after the client takes it over), and the
-- reminder that a draft is about to close is not sent for one either, since nothing is going to close it. An employer's own draft expires and is reminded exactly as before.
-- The job also skips any intake with no user whatever the reason (started_by goes null if the starter's account is deleted), so a row it could not write an event for can never stop it again.
--
-- Not changed: anything else that ends an intake (archive, revoke) works on a firm-started draft as before; only the idle clock leaves it alone.

SET lock_timeout = '5s';

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
      AND s.started_by IS NULL
      AND s.user_id IS NOT NULL
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
      AND s.started_by IS NULL
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

REVOKE ALL ON FUNCTION public.expire_idle_intakes(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_idle_intakes(integer) TO service_role;

REVOKE ALL ON FUNCTION public.queue_draft_expiry_reminders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_draft_expiry_reminders(integer) TO service_role;
