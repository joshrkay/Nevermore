-- Hardening for the bounce and suppression handling (20261028090000), found in review.
--
-- Nothing here changes a table. Every function below keeps its signature, so grants carry over;
-- the one new function is lift_email_suppression.
--
--   * A bounce also holds back a confirmation a worker has already claimed. A claim whose lease has
--     lapsed is treated like a pending one by the webhook and by the claim's pre-step; a claim that
--     is still live is refused at freeze_outbox_message, before anything is written for sending.
--   * lift_email_suppression(address, requeue) undoes a suppression on purpose (service role only).
--     Do not purge email_suppressions by age: deleting a row lets that address be emailed again,
--     which for a spam complaint is the one thing that must not happen. email_delivery_events can be
--     purged freely.
--   * advisor_email_problems() follows the submission's LATEST confirmation, so a prospect who
--     corrects their address clears the flag, and it reports 'not_delivered' for a temporary bounce
--     or a failed send (nothing is suppressed for those).
--   * The detail stored for an event is cut at 2000 characters before its addresses are redacted,
--     and redaction handles quoted local parts and runs in linear time.

SET lock_timeout = '3s';

-- ---------- Recording ----------

-- Same as before, plus the stronger redaction and the lapsed-claim hold-back described above.
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
  IF v_kind = 'advisor_notification' THEN
    v_guard := v_guard || v_recipients;
  ELSIF v_kind = 'prospect_confirmation' AND v_sent_to IS NOT NULL AND v_sent_to = ANY (v_recipients) THEN
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
    left(NULLIF(btrim(regexp_replace(regexp_replace(left(COALESCE(p_detail, ''), 2000), '"[^"]*"@\S*', '[email]', 'g'), '\S*@\S*', '[email]', 'g')), ''), 200),
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

  -- What is already waiting for that address goes no further, including a claim whose worker was
  -- lost (the next claim would take it over). A live claim is the worker's: it is refused at
  -- freeze_outbox_message, before anything is written for sending. (The claim does the same for
  -- anything queued later.)
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = left('suppressed: ' || v_reason, 200),
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  WHERE e.kind = 'prospect_confirmation'
    AND (e.status = 'pending' OR (e.status = 'claimed' AND e.locked_until < now()))
    AND lower(btrim(e.payload ->> 'recipient_email')) = ANY (v_suppress);

  RETURN jsonb_build_object(
    'duplicate', false, 'outcome', v_outcome,
    'suppressed', cardinality(v_suppress), 'protected', cardinality(v_protected_hit)
  );
END;
$$;

-- ---------- Never mailing a suppressed address again ----------

-- Same as before, plus: a confirmation whose claim has lapsed and is about to be taken over is
-- held back here too when its address is suppressed.
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
  WHERE e.kind = 'prospect_confirmation'
    AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    AND s.address = lower(btrim(e.payload ->> 'recipient_email'));

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

-- Same as before, plus: the email of a claim whose address was suppressed after it was claimed is
-- not written for sending. The event becomes 'suppressed' and the answer is null, which the
-- worker reads as "no longer mine" and sends nothing. A retry that already has its email written
-- does not pass through here: the claim's pre-step holds those back instead.
CREATE OR REPLACE FUNCTION public.freeze_outbox_message(
  p_id uuid,
  p_attempt integer,
  p_message jsonb,
  p_replace boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  frozen jsonb;
BEGIN
  IF p_message IS NULL OR jsonb_typeof(p_message) <> 'object'
     OR NOT (p_message ?& ARRAY['from', 'to', 'subject', 'text', 'html']) THEN
    RAISE EXCEPTION 'freeze_outbox_message: the message must be an object with from, to, subject, text and html'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = left('suppressed: ' || s.reason, 200),
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  FROM public.email_suppressions s
  WHERE e.id = p_id AND e.status = 'claimed' AND e.attempts = p_attempt AND e.kind = 'prospect_confirmation'
    AND s.address = lower(btrim(e.payload ->> 'recipient_email'));
  IF FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.outbox_events e
  SET pending_send = jsonb_build_object(
    'key', 'outbox-' || p_id::text || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    'message', p_message,
    'attempt', p_attempt,
    'frozen_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
  WHERE e.id = p_id AND e.status = 'claimed' AND e.attempts = p_attempt AND (e.pending_send IS NULL OR p_replace)
  RETURNING e.pending_send INTO frozen;

  RETURN frozen;
END;
$$;

-- Lets an address be emailed again, on purpose (the prospect fixed their mailbox, or it was
-- suppressed by mistake). Removes the suppression and, when p_requeue is true, puts the
-- confirmations that were held back for it back in the queue, due now: they may be old, so the
-- default leaves them. Returns how many it requeued. A new certification with unchanged answers
-- queues nothing new (the same data is one notification), which is why this exists.
CREATE FUNCTION public.lift_email_suppression(p_address text, p_requeue boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_address text := lower(btrim(COALESCE(p_address, '')));
  v_requeued integer := 0;
BEGIN
  IF v_address = '' THEN
    RAISE EXCEPTION 'lift_email_suppression: an address is required' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.email_suppressions WHERE address = v_address;
  IF p_requeue THEN
    UPDATE public.outbox_events e
    SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL,
        claimed_at = NULL, locked_until = NULL, pending_send = NULL
    WHERE e.kind = 'prospect_confirmation' AND e.status = 'suppressed'
      AND lower(btrim(e.payload ->> 'recipient_email')) = v_address;
    GET DIAGNOSTICS v_requeued = ROW_COUNT;
  END IF;
  RETURN v_requeued;
END;
$$;

-- ---------- Advisors ----------

-- Only the LATEST confirmation per submission counts, and 'not_delivered' is new.
CREATE OR REPLACE FUNCTION public.advisor_email_problems()
RETURNS TABLE (session_id uuid, reason text, since timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (e.session_id) e.session_id, lower(btrim(e.payload ->> 'recipient_email')) AS address, e.provider_message_id
    FROM public.outbox_events e
    WHERE e.kind = 'prospect_confirmation'
    ORDER BY e.session_id, e.created_at DESC, e.id
  )
  SELECT l.session_id, COALESCE(s.reason, 'not_delivered'), COALESCE(s.created_at, d.received_at)
  FROM latest l
  LEFT JOIN public.email_suppressions s ON s.address = l.address
  LEFT JOIN LATERAL (
    SELECT max(x.received_at) AS received_at
    FROM public.email_delivery_events x
    WHERE x.provider_message_id = l.provider_message_id
      AND (x.type = 'email.failed' OR (x.type = 'email.bounced' AND lower(COALESCE(x.bounce_type, '')) <> 'permanent'))
  ) d ON true
  WHERE s.address IS NOT NULL OR d.received_at IS NOT NULL;
END;
$$;

-- ---------- Grants ----------

REVOKE ALL ON FUNCTION public.freeze_outbox_message(uuid, integer, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lift_email_suppression(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_outbox_message(uuid, integer, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.lift_email_suppression(text, boolean) TO service_role;

RESET lock_timeout;
