-- The daily summary, and the two emails about a request for a PEO or carrier (docs/BROKER_READINESS_PRD.md BR-3.3, BR-3.6; docs/BROKER_CRM_BUILD.md
-- "## Daily summary and request emails", D-2220 to D-2239; supabase/tests/daily_summary.sql).
--
-- Three emails ride the outbox every other email uses; the database only queues them and the dispatch-outbox function sends them:
--   * market_request: a firm asked for a PEO or carrier that isn't listed. It goes to every platform admin.
--   * market_answer: a platform admin answered it. It goes to the person who asked.
--   * daily_summary: what needs one member of a firm today. It goes to that member, Monday to Friday, in the morning of their own time zone, only
--     when there is something in it.

SET lock_timeout = '5s';

-- ---------- 1. Three new kinds, each about a firm and no intake ----------
-- Restated whole, with every kind each already had (20261124090000).
ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_events_one_target;
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_events_one_target CHECK (
  CASE WHEN kind IN ('member_left', 'firm_closing', 'export_alert', 'conversation_message', 'lead_from_link', 'firm_waiting', 'firm_decision',
                     'market_request', 'market_answer', 'daily_summary') THEN session_id IS NULL AND firm_id IS NOT NULL
  ELSE session_id IS NOT NULL AND firm_id IS NULL END);

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request', 'draft_expiry_reminder', 'peo_mail_arrived', 'member_left', 'firm_closing', 'export_alert',
    'conversation_message', 'peo_message', 'lead_from_link', 'firm_waiting', 'firm_decision', 'market_request', 'market_answer', 'daily_summary'
    -- sync:end outbox_kinds
  ));

-- All three are a firm's alerts (D-1670), as an export alert is: each waits while the firm is suspended and ends, unsent, once the firm has closed (a closed
-- firm's members are told nothing more, and its request for a PEO is asked of nobody). Restated from 20261122240000 with every kind it named.
CREATE OR REPLACE FUNCTION public.outbox_kind_is_firm_alert(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT p_kind IN ('advisor_notification', 'peo_mail_arrived', 'member_left', 'firm_closing', 'export_alert', 'lead_from_link',
                        'market_request', 'market_answer', 'daily_summary') $$;

-- ---------- 2. A request for a PEO or carrier is queued for the admins, and its answer for the person who asked ----------
CREATE FUNCTION public.queue_market_request_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  f public.firms;
  asker text;
BEGIN
  SELECT * INTO f FROM public.firms x WHERE x.id = NEW.firm_id;
  IF TG_OP = 'INSERT' THEN
    -- Who it goes to is looked up when it is sent (the platform admins then), so the event names nobody.
    INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
    VALUES ('market_request', NEW.firm_id, 'market_request:' || NEW.id, jsonb_build_object('firm_name', f.name, 'market_name', NEW.name, 'line', NEW.line))
    ON CONFLICT (kind, dedupe_key) DO NOTHING;
  ELSE
    -- The person who asked, at the address their account has now. Someone whose account is gone is told nothing; their firm reads the answer on the page.
    SELECT NULLIF(lower(btrim(u.email)), '') INTO asker FROM auth.users u WHERE u.id = NEW.requested_by;
    IF asker IS NOT NULL THEN
      INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
      VALUES ('market_answer', NEW.firm_id, 'market_answer:' || NEW.id,
              jsonb_build_object('recipient_email', asker, 'firm_name', f.name, 'address', f.address, 'market_name', NEW.name, 'line', NEW.line,
                                 'listed', NEW.status = 'listed', 'answer', NEW.answer))
      ON CONFLICT (kind, dedupe_key) DO NOTHING;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_market_request_emails() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER market_requests_queue_request_email
  AFTER INSERT ON public.market_requests
  FOR EACH ROW EXECUTE FUNCTION public.queue_market_request_emails();

CREATE TRIGGER market_requests_queue_answer_email
  AFTER UPDATE OF status ON public.market_requests
  FOR EACH ROW WHEN (OLD.status = 'open' AND NEW.status <> 'open')
  EXECUTE FUNCTION public.queue_market_request_emails();

-- ---------- 3. A person's own settings for the daily summary ----------
-- One row for a person, theirs alone, whatever firms they belong to: whether they get the daily summary (they do unless they turn it off) and the time zone
-- their morning is in. Closed to the API; a person reads and changes their own through the functions below.
CREATE TABLE public.member_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  daily_summary boolean NOT NULL DEFAULT true,
  time_zone text CHECK (time_zone IS NULL OR char_length(time_zone) BETWEEN 1 AND 64),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_settings FROM PUBLIC, anon, authenticated;

-- The zone a person's morning is in until their browser has said: most firms are in the United States (BR-3.3).
CREATE FUNCTION public.default_summary_time_zone()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT 'America/New_York'::text $$;
REVOKE ALL ON FUNCTION public.default_summary_time_zone() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.my_summary_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_signed_in_person() THEN
    RAISE EXCEPTION 'Sign in to see your settings' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'daily_summary', COALESCE((SELECT s.daily_summary FROM public.member_settings s WHERE s.user_id = auth.uid()), true),
    'time_zone', COALESCE((SELECT s.time_zone FROM public.member_settings s WHERE s.user_id = auth.uid()), public.default_summary_time_zone()));
END;
$$;

REVOKE ALL ON FUNCTION public.my_summary_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_summary_settings() TO authenticated;

CREATE FUNCTION public.set_my_summary_settings(p_daily_summary boolean, p_time_zone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  zone text := NULLIF(btrim(COALESCE(p_time_zone, '')), '');
BEGIN
  IF NOT public.is_signed_in_person() THEN
    RAISE EXCEPTION 'Sign in to change your settings' USING ERRCODE = '42501';
  END IF;
  IF p_daily_summary IS NULL THEN
    RAISE EXCEPTION 'Say whether you want the daily summary' USING ERRCODE = '22023';
  END IF;
  IF zone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = zone) THEN
    RAISE EXCEPTION 'Choose a time zone from the list' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.member_settings (user_id, daily_summary, time_zone) VALUES (auth.uid(), p_daily_summary, zone)
  ON CONFLICT (user_id) DO UPDATE SET daily_summary = EXCLUDED.daily_summary, time_zone = EXCLUDED.time_zone, updated_at = now();
  RETURN jsonb_build_object('daily_summary', p_daily_summary, 'time_zone', zone);
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_summary_settings(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_summary_settings(boolean, text) TO authenticated;

-- The time zone a person's browser reports, kept only when they have none yet: what they chose is never overwritten by where they happen to open the
-- product. A zone the database does not know is ignored, not refused: the page that reports it has nothing to say about it.
CREATE FUNCTION public.note_my_time_zone(p_time_zone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  zone text := NULLIF(btrim(COALESCE(p_time_zone, '')), '');
BEGIN
  IF NOT public.is_signed_in_person() OR zone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = zone) THEN
    RETURN;
  END IF;
  INSERT INTO public.member_settings (user_id, time_zone) VALUES (auth.uid(), zone)
  ON CONFLICT (user_id) DO UPDATE SET time_zone = EXCLUDED.time_zone, updated_at = now() WHERE public.member_settings.time_zone IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.note_my_time_zone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.note_my_time_zone(text) TO authenticated;

-- ---------- 4. The daily summary ----------
-- Queues one summary for each current member of each firm that is not suspended or closed, who has not turned it off, when it is Monday to Friday and
-- between 7 and 10 in the morning where they are, once for that member, firm and day, and only when something needs them (public.home_needs, their own).
-- The event holds the first lines and how many there are in all: record names and what each is about, never an intake's answers. Run every quarter of an
-- hour; p_now is the moment it is run for.
CREATE FUNCTION public.queue_daily_summaries(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- sync:begin daily_summary_limits
  first_hour constant integer := 7;
  last_hour constant integer := 9;
  max_lines constant integer := 20;
  -- sync:end daily_summary_limits
  m record;
  local_now timestamp;
  lines jsonb;
  total bigint;
  queued integer := 0;
  made integer;
BEGIN
  FOR m IN
    SELECT DISTINCT ON (mb.firm_id, mb.user_id) mb.firm_id, mb.user_id, f.name AS firm_name, f.address, lower(btrim(u.email)) AS email,
           COALESCE(s.time_zone, public.default_summary_time_zone()) AS zone
    FROM public.firm_memberships mb
    JOIN public.firms f ON f.id = mb.firm_id
    JOIN auth.users u ON u.id = mb.user_id
    LEFT JOIN public.member_settings s ON s.user_id = mb.user_id
    WHERE public.membership_is_current(mb.valid_from, mb.valid_until)
      AND COALESCE(s.daily_summary, true)
      AND COALESCE(btrim(u.email), '') <> ''
      AND NOT public.firm_is_suspended(mb.firm_id) AND NOT public.firm_is_closed(mb.firm_id)
    ORDER BY mb.firm_id, mb.user_id
  LOOP
    local_now := p_now AT TIME ZONE m.zone;
    CONTINUE WHEN extract(isodow FROM local_now) > 5 OR extract(hour FROM local_now) NOT BETWEEN first_hour AND last_hour;
    -- Already queued for this member, firm and day: nothing is read again.
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.outbox_events o WHERE o.kind = 'daily_summary'
                            AND o.dedupe_key = 'daily_summary:' || m.user_id || ':' || m.firm_id || ':' || local_now::date);
    SELECT count(*), COALESCE(jsonb_agg(jsonb_build_object('kind', n.kind, 'record_type', n.record_type, 'record_id', n.record_id, 'name', n.name, 'about', n.about, 'at', n.at)
                                        ORDER BY n.at DESC, n.kind, n.record_id) FILTER (WHERE n.ord <= max_lines), '[]'::jsonb)
    INTO total, lines
    FROM (SELECT x.*, row_number() OVER (ORDER BY x.at DESC, x.kind, x.record_id) AS ord FROM public.home_needs(m.firm_id, m.user_id, 'mine', m.zone) x) n;
    CONTINUE WHEN total = 0;
    INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
    VALUES ('daily_summary', m.firm_id, 'daily_summary:' || m.user_id || ':' || m.firm_id || ':' || local_now::date,
            jsonb_build_object('recipient_email', m.email, 'firm_name', m.firm_name, 'address', m.address, 'day', local_now::date, 'time_zone', m.zone,
                               'total', total, 'lines', lines))
    ON CONFLICT (kind, dedupe_key) DO NOTHING;
    GET DIAGNOSTICS made = ROW_COUNT;
    queued := queued + made;
  END LOOP;
  RETURN queued;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_daily_summaries(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_daily_summaries(timestamptz) TO service_role;

-- Every quarter of an hour, where pg_cron is there; where it is not this does nothing and says so.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE NOTICE 'the daily summary: pg_cron is not here; run public.queue_daily_summaries() every 15 minutes another way';
    RETURN;
  END IF;
  PERFORM cron.schedule('queue-daily-summaries', '*/15 * * * *', 'select public.queue_daily_summaries();');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'the daily summary: could not schedule it (%); run public.queue_daily_summaries() every 15 minutes another way', SQLERRM;
END $$;
