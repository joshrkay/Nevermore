-- Telling advisors that PEO mail arrived (joshrkay/Nevermore#92, story M-3.6; docs/adr/0004-peo-mail-is-received-before-the-product-sends.md).
--
-- A person at a PEO writing to a quote request's reply address queues one email, through the outbox, to the Advisor
-- Alert recipients: the File ID and employer as the Advisor Alert gives them, the PEO's name, and a link to the
-- submission page behind advisor sign-in, where the thread is. It carries nothing from the message: no sender, no
-- subject, no text, no file name.
--
-- * Queued by a trigger on quote_request_messages, in the transaction that records the message, so it can't be
--   missed or sent twice (the dedupe key is the message and when it joined the thread). A fault in queueing is
--   caught and logged as a warning: the message is recorded either way.
-- * Only a message on a quote request, received, and not an automatic reply: an advisor's own copied-in message, an
--   automatic reply and held mail queue nothing. This is the rule of the "new PEO mail" mark (20261111120000).
--   A held message an admin assigns to a thread (20261111130000) joins it then, so it queues one at that point.
-- * The outbox learns the kind. It goes to the advisors, so a bounce must never suppress an advisor's address:
--   record_email_delivery_event guards its recipients as it does for the Advisor Alert.
--
-- Deploy dispatch-outbox before or after; nothing is sent until both are deployed, and a queued event waits.

SET lock_timeout = '5s';

-- ---------- The outbox's kinds ----------
ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request', 'draft_expiry_reminder', 'peo_mail_arrived'
    -- sync:end outbox_kinds
  ));

-- ---------- Queueing ----------
CREATE FUNCTION public.queue_peo_mail_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  req public.quote_requests;
  s public.chamber_sessions;
BEGIN
  BEGIN
    IF NEW.quote_request_id IS NULL OR NEW.direction <> 'received' OR NEW.is_automatic THEN
      RETURN NULL;
    END IF;
    SELECT * INTO req FROM public.quote_requests WHERE id = NEW.quote_request_id;
    SELECT * INTO s FROM public.chamber_sessions WHERE id = req.session_id;
    IF req.id IS NULL OR s.id IS NULL THEN
      RETURN NULL;
    END IF;
    INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
    VALUES (
      'peo_mail_arrived', s.id, 'peo_mail:' || NEW.id || ':' || extract(epoch FROM NEW.recorded_at)::text,
      jsonb_build_object(
        'reference', left(COALESCE(
          NULLIF(btrim(s.file_id), ''),
          'EAA-' || to_char(s.created_at, 'YYYY') || '-' || upper(left(replace(s.id::text, '-', ''), 8))
        ), 64),
        'company_name', left(NULLIF(btrim(s.chamber_data ->> 'company_name'), ''), 200),
        'peo_name', left(req.peo_name, 80)
      )
    )
    ON CONFLICT (kind, dedupe_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'queue_peo_mail_alert: message % not queued (%)', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

CREATE TRIGGER quote_request_messages_queue_alert_insert
  AFTER INSERT ON public.quote_request_messages
  FOR EACH ROW WHEN (NEW.quote_request_id IS NOT NULL) EXECUTE FUNCTION public.queue_peo_mail_alert();
CREATE TRIGGER quote_request_messages_queue_alert_assign
  AFTER UPDATE ON public.quote_request_messages
  FOR EACH ROW WHEN (NEW.quote_request_id IS NOT NULL AND OLD.quote_request_id IS NULL) EXECUTE FUNCTION public.queue_peo_mail_alert();

REVOKE ALL ON FUNCTION public.queue_peo_mail_alert() FROM PUBLIC, anon, authenticated;

-- ---------- A bounce never suppresses an advisor's address ----------
-- Unchanged from 20261105090000_information_requests.sql except that peo_mail_arrived is guarded like the Advisor Alert.
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
  IF v_kind IN ('advisor_notification', 'peo_mail_arrived') THEN
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
