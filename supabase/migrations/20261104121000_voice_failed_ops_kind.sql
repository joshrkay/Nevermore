-- Voice failures in operational monitoring (I-5.1, US-2.3c). A voice call that couldn't connect, gave up after
-- 15 seconds of connecting, or dropped mid-call used to be a console line on the prospect's screen. The browser
-- now reports each one as kind 'voice_failed' (src/hooks/useLenoreVoice.ts; codes in docs/RUNBOOK.md), and it
-- alerts like the other kinds. A microphone the prospect blocked, or one their device can't give, is told to
-- the prospect and not reported: it is their choice or their device, nothing anyone on call can fix.
--
-- * public.ops_events accepts the kind.
-- * public.report_client_event takes it from the browser. Only the list of kinds changes; the rest is the body
--   of 20261104091000_ops_monitoring.sql, caps included.
-- * public.ops_alert_rules alerts at 5 in 15 minutes, at most once an hour, like failed uploads and AI failures.
--   docs/RUNBOOK.md lists the same numbers; src/data/schemaSync.test.ts checks it does.
--
-- Deploy order: before the front end that reports the kind. A front end deployed first only has its reports
-- refused (22023), which the browser ignores (src/lib/monitoring.ts never fails the page).

ALTER TABLE public.ops_events DROP CONSTRAINT IF EXISTS ops_events_kind_check;
ALTER TABLE public.ops_events ADD CONSTRAINT ops_events_kind_check
  CHECK (kind IN ('app_error', 'upload_failed', 'ai_failed', 'auth_denied', 'deletion_failed', 'voice_failed'));

-- Per signed-in account, per hour; shared by every signed-out visitor, per hour; and for all browser
-- reports together, per hour. Past a cap a report is dropped (false), not refused, so the page carries on.
CREATE OR REPLACE FUNCTION public.report_client_event(
  p_kind text,
  p_code text DEFAULT NULL,
  p_detail text DEFAULT NULL,
  p_route text DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid constant uuid := auth.uid();
  -- sync:begin ops_report_caps
  per_account constant integer := 30;
  signed_out constant integer := 200;
  everyone constant integer := 2000;
  -- sync:end ops_report_caps
  recent integer;
  keep_session uuid;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('app_error', 'upload_failed', 'ai_failed', 'auth_denied', 'voice_failed') THEN
    RAISE EXCEPTION 'Unknown event kind' USING ERRCODE = '22023';
  END IF;

  IF uid IS NOT NULL THEN
    SELECT count(*) INTO recent FROM public.ops_events
    WHERE user_id = uid AND source = 'browser' AND created_at > now() - interval '1 hour';
    IF recent >= per_account THEN RETURN false; END IF;
  ELSE
    SELECT count(*) INTO recent FROM public.ops_events
    WHERE user_id IS NULL AND source = 'browser' AND created_at > now() - interval '1 hour';
    IF recent >= signed_out THEN RETURN false; END IF;
  END IF;
  SELECT count(*) INTO recent FROM public.ops_events
  WHERE source = 'browser' AND created_at > now() - interval '1 hour';
  IF recent >= everyone THEN RETURN false; END IF;

  -- Only an intake the caller may read: their own, or any for an advisor. Anything else is dropped, so
  -- the table never links an account to an intake it has nothing to do with.
  IF p_session_id IS NOT NULL AND uid IS NOT NULL
     AND (public.is_advisor() OR EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = p_session_id AND s.user_id = uid)) THEN
    keep_session := p_session_id;
  END IF;

  INSERT INTO public.ops_events (kind, source, code, detail, route, user_id, session_id)
  VALUES (
    p_kind,
    'browser',
    public.ops_clean_code(p_code),
    public.ops_redact(p_detail, 300),
    -- The path only: a query string or fragment can carry a token.
    public.ops_redact(split_part(split_part(COALESCE(p_route, ''), '?', 1), '#', 1), 120),
    uid,
    keep_session
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.report_client_event(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_client_event(text, text, text, text, uuid) TO anon, authenticated;

-- When each kind alerts: at least `threshold` events within the last `window_minutes`, at most once per
-- `cooldown_minutes`. docs/RUNBOOK.md lists the same numbers; src/data/schemaSync.test.ts checks it does.
CREATE OR REPLACE FUNCTION public.ops_alert_rules()
RETURNS TABLE (kind text, window_minutes integer, threshold integer, cooldown_minutes integer)
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  VALUES
    -- sync:begin ops_alert_rules
    ('app_error'::text, 15, 10, 60),
    ('upload_failed', 15, 5, 60),
    ('ai_failed', 15, 5, 60),
    ('auth_denied', 15, 20, 60),
    ('deletion_failed', 60, 1, 60),
    ('voice_failed', 15, 5, 60)
    -- sync:end ops_alert_rules
$$;

REVOKE ALL ON FUNCTION public.ops_alert_rules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_alert_rules() TO authenticated, service_role;
