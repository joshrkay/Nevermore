-- CRM-P1.6 review fixes, on top of 20261118090000 (which is merged and not edited).
--
-- 1. Firm-level outbox rows (a "member left" email) are deleted 90 days after they were queued, the window of the firm's record, by
--    the same daily job that prunes it. They are not tied to an intake, so nothing else ever deleted them.
-- 2. The kinds whose recipients a bounce must never suppress are the firm's alerts, named once in outbox_kind_is_firm_alert().
-- 3. An index on outbox_events.firm_id.

-- 3. Deleting a firm cascades to its outbox rows, and the clean-up below looks them up by firm.
CREATE INDEX outbox_events_firm_id_idx ON public.outbox_events (firm_id) WHERE firm_id IS NOT NULL;

-- 1. The clean-up. Run by the service role (the database's own scheduler) only. Rows of an intake are left alone: they go with it.
CREATE FUNCTION public.prune_firm_outbox_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.outbox_events WHERE firm_id IS NOT NULL AND created_at < now() - public.firm_activity_retention();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_firm_outbox_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_firm_outbox_events() TO service_role;

-- The firm record's daily job (20261116160001) also runs it: no second scheduler. Where the job does not exist (no pg_cron) this does
-- nothing and says so, as the migrations that made the job do; run both functions every day another way.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL OR NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-firm-activity') THEN
    RAISE NOTICE 'firm outbox clean-up: the prune-firm-activity job does not exist; run public.prune_firm_outbox_events() every day another way';
    RETURN;
  END IF;
  PERFORM cron.schedule('prune-firm-activity', '53 3 * * *', 'select public.prune_firm_activity(); select public.prune_firm_outbox_events();');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'firm outbox clean-up: could not add it to the daily job (%); run public.prune_firm_outbox_events() every day another way', SQLERRM;
END $$;

-- 2. record_email_delivery_event as 20261118090000 leaves it. The one change: the guarded kinds are asked of outbox_kind_is_firm_alert()
-- (advisor_notification, peo_mail_arrived, member_left: the same three the hand-written list held), so the list lives in one place.
CREATE OR REPLACE FUNCTION public.record_email_delivery_event(
  p_event_id text,
  p_type text,
  p_message_id text,
  p_recipients text[],
  p_bounce_type text,
  p_detail text,
  p_occurred_at timestamptz,
  p_protected text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipients text[];
  v_guard text[];
  v_kind text;
  v_sent_to text;
  v_acts boolean;
  v_reason text;
  v_suppress text[];
  v_protected_hit text[];
  v_outcome text;
  v_new_id uuid;
BEGIN
  IF p_event_id IS NULL OR btrim(p_event_id) = '' OR length(p_event_id) > 200 THEN
    RAISE EXCEPTION 'record_email_delivery_event: an event id is required' USING ERRCODE = '22023';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('email.bounced', 'email.complained', 'email.delivery_delayed', 'email.failed', 'email.suppressed') THEN
    RAISE EXCEPTION 'record_email_delivery_event: unsupported event type' USING ERRCODE = '22023';
  END IF;

  v_recipients := ARRAY(
    SELECT DISTINCT lower(btrim(r)) FROM unnest(COALESCE(p_recipients, ARRAY[]::text[])) AS r
    WHERE btrim(r) <> '' AND length(btrim(r)) <= 320
    LIMIT 20
  );
  v_guard := ARRAY(
    SELECT DISTINCT lower(btrim(g)) FROM unnest(COALESCE(p_protected, ARRAY[]::text[])) AS g WHERE btrim(g) <> ''
  );

  IF p_message_id IS NOT NULL THEN
    SELECT e.kind, lower(btrim(e.payload ->> 'recipient_email'))
    INTO v_kind, v_sent_to
    FROM public.outbox_events e
    WHERE e.provider_message_id = p_message_id
    ORDER BY e.created_at DESC
    LIMIT 1;
  END IF;
  IF public.outbox_kind_is_firm_alert(v_kind) THEN
    v_guard := v_guard || v_recipients;
  ELSIF public.outbox_kind_reaches_prospect(v_kind) AND v_sent_to IS NOT NULL AND v_sent_to = ANY (v_recipients) THEN
    v_recipients := ARRAY[v_sent_to];
  END IF;

  -- Only what says the address cannot or must not be mailed acts. A transient bounce, a delay and
  -- a failure are the provider still trying (or reporting a fault of its own).
  v_acts := p_type IN ('email.complained', 'email.suppressed')
            OR (p_type = 'email.bounced' AND lower(COALESCE(p_bounce_type, '')) = 'permanent');
  v_reason := CASE p_type WHEN 'email.complained' THEN 'complained' WHEN 'email.suppressed' THEN 'provider_suppressed' ELSE 'bounced' END;
  v_suppress := CASE WHEN v_acts THEN ARRAY(SELECT r FROM unnest(v_recipients) AS r WHERE r <> ALL (v_guard)) ELSE ARRAY[]::text[] END;
  v_protected_hit := CASE WHEN v_acts THEN ARRAY(SELECT r FROM unnest(v_recipients) AS r WHERE r = ANY (v_guard)) ELSE ARRAY[]::text[] END;
  v_outcome := CASE
    WHEN cardinality(v_suppress) > 0 THEN 'suppressed'
    WHEN cardinality(v_protected_hit) > 0 THEN 'protected'
    ELSE 'recorded'
  END;

  INSERT INTO public.email_delivery_events
    (provider_event_id, type, provider_message_id, recipients, bounce_type, detail, outcome, occurred_at)
  VALUES (
    btrim(p_event_id), p_type, left(p_message_id, 200), v_recipients, left(NULLIF(btrim(p_bounce_type), ''), 40),
    -- Addresses are redacted by the function too; this is the backstop for what it missed.
    left(NULLIF(btrim(regexp_replace(COALESCE(p_detail, ''), '[^\s@<>,;"()]+@[^\s@<>,;"()]+', '[email]', 'g')), ''), 200),
    v_outcome, COALESCE(p_occurred_at, now())
  )
  ON CONFLICT (provider_event_id) DO NOTHING
  RETURNING id INTO v_new_id;
  IF v_new_id IS NULL THEN
    RETURN jsonb_build_object('duplicate', true);
  END IF;

  INSERT INTO public.email_suppressions (address, reason, first_event_id)
  SELECT r, v_reason, v_new_id FROM unnest(v_suppress) AS r
  ON CONFLICT (address) DO UPDATE
    SET event_count = public.email_suppressions.event_count + 1,
        updated_at = now(),
        -- A complaint is the stronger statement; otherwise the first reason stands.
        reason = CASE WHEN EXCLUDED.reason = 'complained' THEN 'complained' ELSE public.email_suppressions.reason END;

  -- What is already waiting for that address goes no further. (The claim does the same for
  -- anything queued later.)
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = left('suppressed: ' || v_reason, 200),
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  WHERE public.outbox_kind_reaches_prospect(e.kind) AND e.status = 'pending'
    AND lower(btrim(e.payload ->> 'recipient_email')) = ANY (v_suppress);

  RETURN jsonb_build_object(
    'duplicate', false, 'outcome', v_outcome,
    'suppressed', cardinality(v_suppress), 'protected', cardinality(v_protected_hit)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_email_delivery_event(text, text, text, text[], text, text, timestamptz, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_email_delivery_event(text, text, text, text[], text, text, timestamptz, text[]) TO service_role;
