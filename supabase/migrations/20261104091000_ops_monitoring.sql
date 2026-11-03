-- Operational monitoring (US-6.4, plan H-4.1): application errors, failed uploads, AI failures and
-- authorization failures are recorded in one place, and a scheduled check alerts engineering when any of
-- them crosses a threshold. Until now only the outbox alerted anyone; everything else was a console line.
--
-- * public.ops_events: one row per failure, with a short machine code and a redacted detail. Never
--   contents: no message text, no field values, no file names, no addresses, no links. Admins read it
--   (public.admin_ops_summary for counts); nobody writes it directly.
-- * The browser reports through public.report_client_event(), which takes only the browser's kinds,
--   redacts and shortens what it is given, keeps a session id only when the caller may see that intake,
--   and drops reports past a per-account and an overall hourly cap (returning false) so a broken page,
--   or someone abusing the endpoint, can't flood it. Signed-out visitors can report too (an error on the
--   landing page), under a shared cap.
-- * Edge functions report through public.record_ops_event() with the service role (AI provider
--   failures, deletion failures).
-- * public.ops_alert_rules() is the threshold for each kind. public.claim_ops_alerts() (service role)
--   returns each kind over its threshold that hasn't been alerted within its cooldown, and records the
--   alert, so two overlapping runs can't both send it. The ops-monitor edge function runs it every five
--   minutes (scheduled at the end of this file) and posts to ENGINEERING_ALERT_WEBHOOK_URL.
-- * Rows are kept 90 days (public.ops_event_retention(); the retention job in the next migration prunes
--   them).
--
-- Not covered here, and covered by the runbook instead (docs/RUNBOOK.md): refusals that never reach the
-- browser or a function (PostgREST 401/403 answers to direct API calls, failed sign-ins) are in Supabase's
-- API and Auth logs.

-- ---------- Events ----------

CREATE TABLE IF NOT EXISTS public.ops_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('app_error', 'upload_failed', 'ai_failed', 'auth_denied', 'deletion_failed')),
  -- 'browser', or the edge function that recorded it.
  source text NOT NULL CHECK (source ~ '^[a-z][a-z0-9-]{0,39}$'),
  code text CHECK (code IS NULL OR code ~ '^[A-Za-z0-9_:.-]{1,80}$'),
  detail text CHECK (detail IS NULL OR length(detail) <= 300),
  route text CHECK (route IS NULL OR length(route) <= 120),
  user_id uuid,
  session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_events_kind_created_idx ON public.ops_events (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_events_user_created_idx ON public.ops_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ops_events_created_idx ON public.ops_events (created_at);

ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view operational events" ON public.ops_events;
CREATE POLICY "Admins can view operational events"
  ON public.ops_events FOR SELECT TO authenticated
  USING (public.has_role('admin'));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ops_events FROM anon, authenticated;

-- How long an event is kept. One place to change it.
CREATE OR REPLACE FUNCTION public.ops_event_retention()
RETURNS interval
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- sync:begin ops_event_retention
    interval '90 days'
    -- sync:end ops_event_retention
$$;

-- Removes what could identify a person or open a file from free text: links (a signed link is a
-- credential), email addresses, long tokens and ids, and runs of four or more digits (phone numbers, SSNs,
-- salaries, dates of birth; an HTTP status survives). Then collapses whitespace and cuts it to p_max
-- characters. src/lib/monitoring.ts does the
-- same in the browser before sending; this is the copy that is trusted.
CREATE OR REPLACE FUNCTION public.ops_redact(p_text text, p_max integer DEFAULT 300)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(left(btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(COALESCE(p_text, ''), '[a-zA-Z][a-zA-Z0-9+.-]*://[^[:space:]]+', '[link]', 'g'),
          '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g'),
        '[A-Za-z0-9_-]{24,}', '[id]', 'g'),
      '[0-9][0-9 ().-]{3,}[0-9]|[0-9]{4,}', '[number]', 'g'),
    '[[:space:]]+', ' ', 'g')), GREATEST(p_max, 0)), '');
$$;

REVOKE ALL ON FUNCTION public.ops_redact(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_redact(text, integer) TO anon, authenticated, service_role;

-- A machine code: letters, digits and _ : . - only, at most 80 characters, or null.
CREATE OR REPLACE FUNCTION public.ops_clean_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(left(regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9_:.-]', '', 'g'), 80), '');
$$;

REVOKE ALL ON FUNCTION public.ops_clean_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_clean_code(text) TO anon, authenticated, service_role;

-- ---------- Reporting from the browser ----------

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
  IF p_kind IS NULL OR p_kind NOT IN ('app_error', 'upload_failed', 'ai_failed', 'auth_denied') THEN
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

-- ---------- Reporting from edge functions ----------

CREATE OR REPLACE FUNCTION public.record_ops_event(
  p_kind text,
  p_source text,
  p_code text DEFAULT NULL,
  p_detail text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_source IS NULL OR p_source = 'browser' THEN
    RAISE EXCEPTION 'Name the function that saw the failure' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ops_events (kind, source, code, detail, user_id, session_id)
  VALUES (p_kind, p_source, public.ops_clean_code(p_code), public.ops_redact(p_detail, 300), p_user_id, p_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_ops_event(text, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_event(text, text, text, text, uuid, uuid) TO service_role;

-- ---------- Alerts ----------

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
    ('deletion_failed', 60, 1, 60)
    -- sync:end ops_alert_rules
$$;

REVOKE ALL ON FUNCTION public.ops_alert_rules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_alert_rules() TO authenticated, service_role;

-- Every alert raised, kept for good (counts and codes only).
CREATE TABLE IF NOT EXISTS public.ops_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL,
  event_count integer NOT NULL,
  window_minutes integer NOT NULL,
  threshold integer NOT NULL,
  top_codes text,
  raised_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_alerts_kind_raised_idx ON public.ops_alerts (kind, raised_at DESC);

ALTER TABLE public.ops_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view operational alerts" ON public.ops_alerts;
CREATE POLICY "Admins can view operational alerts"
  ON public.ops_alerts FOR SELECT TO authenticated
  USING (public.has_role('admin'));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ops_alerts FROM anon, authenticated;

-- The kinds to alert on now, each recorded as raised. A kind is locked while it is checked, so two runs at
-- once raise it once. top_codes is the five most frequent codes in the window, e.g. "timeout x4, 42501 x1".
CREATE OR REPLACE FUNCTION public.claim_ops_alerts()
RETURNS TABLE (kind text, event_count integer, window_minutes integer, threshold integer, top_codes text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n integer;
  codes text;
BEGIN
  FOR r IN SELECT * FROM public.ops_alert_rules() ORDER BY 1 LOOP
    PERFORM pg_advisory_xact_lock(hashtext('ops_alert:' || r.kind));
    IF EXISTS (
      SELECT 1 FROM public.ops_alerts a
      WHERE a.kind = r.kind AND a.raised_at > now() - make_interval(mins => r.cooldown_minutes)
    ) THEN
      CONTINUE;
    END IF;

    SELECT count(*)::integer INTO n FROM public.ops_events e
    WHERE e.kind = r.kind AND e.created_at > now() - make_interval(mins => r.window_minutes);
    IF n < r.threshold THEN
      CONTINUE;
    END IF;

    SELECT string_agg(t.code || ' x' || t.c, ', ' ORDER BY t.c DESC, t.code) INTO codes
    FROM (
      SELECT COALESCE(e.code, '-') AS code, count(*) AS c
      FROM public.ops_events e
      WHERE e.kind = r.kind AND e.created_at > now() - make_interval(mins => r.window_minutes)
      GROUP BY 1
      ORDER BY 2 DESC, 1
      LIMIT 5
    ) t;

    INSERT INTO public.ops_alerts (kind, event_count, window_minutes, threshold, top_codes)
    VALUES (r.kind, n, r.window_minutes, r.threshold, codes);

    kind := r.kind;
    event_count := n;
    window_minutes := r.window_minutes;
    threshold := r.threshold;
    top_codes := codes;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ops_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ops_alerts() TO service_role;

-- ---------- Reading ----------

-- Counts by kind, source and code over the last p_hours (1 to 720). Admins only.
CREATE OR REPLACE FUNCTION public.admin_ops_summary(p_hours integer DEFAULT 24)
RETURNS TABLE (kind text, source text, code text, events bigint, last_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 720 THEN
    RAISE EXCEPTION 'p_hours must be between 1 and 720' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT e.kind, e.source, e.code, count(*), max(e.created_at)
    FROM public.ops_events e
    WHERE e.created_at > now() - make_interval(hours => p_hours)
    GROUP BY e.kind, e.source, e.code
    ORDER BY count(*) DESC, e.kind, e.source, e.code;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ops_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ops_summary(integer) TO authenticated;

-- ---------- Schedule ----------

-- ops-monitor every five minutes, from the database, the same way dispatch-outbox is scheduled
-- (20261027100000_outbox_schedule.sql): the project URL and service-role key are read from Vault on each
-- run, the job does nothing until both exist, an existing job of the same name is left alone, and a
-- database without pg_cron or pg_net gets a notice, never a failed migration.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ops monitor: pg_cron is not available (%); schedule ops-monitor another way (docs/RUNBOOK.md)', SQLERRM;
      RETURN;
    END;
  END IF;

  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ops monitor: pg_net is not available (%); schedule ops-monitor another way (docs/RUNBOOK.md)', SQLERRM;
      RETURN;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-monitor') THEN
    RAISE NOTICE 'ops monitor: an ops-monitor job already exists; leaving it as it is';
    RETURN;
  END IF;

  PERFORM cron.schedule('ops-monitor', '*/5 * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/ops-monitor',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'),
      body := '{}'::jsonb
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
  $job$);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ops monitor: could not schedule ops-monitor (%); schedule it another way (docs/RUNBOOK.md)', SQLERRM;
END $$;
