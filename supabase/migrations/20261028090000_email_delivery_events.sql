-- Bounce and suppression handling (G-2.2).
--
-- * The email provider reports what became of a message (a bounce, a spam complaint, a delay) by
--   webhook; the `resend-webhook` function verifies the signature and calls
--   record_email_delivery_event. Every event is kept (email_delivery_events), once: the provider
--   retries a delivery with the same event id, and a replay changes nothing.
-- * A permanent bounce, a complaint, or the provider saying it already suppresses the address puts
--   that address on email_suppressions. A suppressed address is never emailed again: the claim
--   marks its waiting confirmation 'suppressed' instead of handing it to the worker, so a
--   re-certification or a retry cannot send to it either. Temporary trouble (a transient bounce, a
--   delay, a failure) is recorded and changes nothing: the provider is still trying.
-- * The advisory team's own addresses are never suppressed. A bounce on an alert to the team is
--   recorded as 'protected' and the function logs it: silently dropping alerts because one
--   mailbox failed would be worse than the bounce.
-- * advisor_email_problems tells advisors which submissions have a prospect whose confirmation
--   bounced or was reported as spam, so they can reach that person another way. The queue page
--   reads it beside advisor_list_submissions, which is unchanged.
--
-- Both tables hold email addresses. Fold them into the retention rule (D4); deleting rows is
-- safe, and deleting a suppression row lets that address be emailed again.

SET lock_timeout = '3s';

-- ---------- Tables (service role only) ----------

CREATE TABLE public.email_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL UNIQUE,          -- the webhook's message id: stable across the provider's retries
  type text NOT NULL CHECK (type IN ('email.bounced', 'email.complained', 'email.delivery_delayed', 'email.failed', 'email.suppressed')),
  provider_message_id text,                        -- matches outbox_events.provider_message_id when the email is ours
  recipients text[] NOT NULL DEFAULT '{}',         -- lower-cased
  bounce_type text,                                -- the provider's word: Permanent, Transient, Undetermined
  detail text,                                     -- the provider's explanation, addresses redacted
  outcome text NOT NULL CHECK (outcome IN ('suppressed', 'protected', 'recorded')),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_delivery_events_message_idx ON public.email_delivery_events (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE public.email_suppressions (
  address text PRIMARY KEY CHECK (address <> '' AND address = lower(btrim(address))),
  reason text NOT NULL CHECK (reason IN ('bounced', 'complained', 'provider_suppressed')),
  first_event_id uuid REFERENCES public.email_delivery_events(id) ON DELETE SET NULL,
  event_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_delivery_events FROM anon, authenticated;
REVOKE ALL ON public.email_suppressions FROM anon, authenticated;

-- The queue gains a terminal state for an email that was not sent because its address is suppressed.
ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_events_status_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_status_check CHECK (status IN ('pending', 'claimed', 'sent', 'dead', 'suppressed'));

-- Matching a provider message id back to the event that sent it.
CREATE INDEX outbox_events_provider_message_idx ON public.outbox_events (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- ---------- Recording an event (service role, from the webhook) ----------

-- Records one provider event, once, and suppresses what it says to. Returns what happened:
-- {duplicate: true} for a replay (nothing changed), else {duplicate: false, outcome, suppressed,
-- protected} with the counts of addresses suppressed and of team addresses left alone.
--
-- p_protected is the advisory team's list. The email's own record decides first: a message we
-- sent to the team is protected whole, and one we sent to a prospect concerns only that address
-- (the provider reports every recipient of a message, and ours have one). A message that is not in
-- the queue at all (the sign-in codes go through the same provider account) concerns the
-- recipients as reported.
CREATE FUNCTION public.record_email_delivery_event(
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
  WHERE e.kind = 'prospect_confirmation' AND e.status = 'pending'
    AND lower(btrim(e.payload ->> 'recipient_email')) = ANY (v_suppress);

  RETURN jsonb_build_object(
    'duplicate', false, 'outcome', v_outcome,
    'suppressed', cardinality(v_suppress), 'protected', cardinality(v_protected_hit)
  );
END;
$$;

-- ---------- Never mailing a suppressed address again ----------

-- Same as before, plus: a due confirmation to a suppressed address is marked 'suppressed' here, so
-- it is not claimed, however it came to be queued (a re-certification, a retry, a requeue).
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
  WHERE e.kind = 'prospect_confirmation' AND e.status = 'pending' AND e.next_attempt_at <= now()
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

-- ---------- Advisors ----------

-- The advisor's queue view learns the new status.
CREATE OR REPLACE FUNCTION public.advisor_list_outbox_events(p_status text DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  kind text,
  status text,
  attempts integer,
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  claim_lapsed boolean,
  last_error text,
  provider_message_id text,
  created_at timestamptz,
  sent_at timestamptz,
  session_id uuid,
  company_name text,
  reference text,
  resubmission boolean,
  frozen boolean,
  requeue_count integer,
  last_requeued_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  IF p_status IS NOT NULL AND p_status NOT IN ('pending', 'claimed', 'sent', 'dead', 'suppressed') THEN
    RAISE EXCEPTION 'unknown outbox status %', left(p_status, 40) USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT
    e.id, e.kind, e.status, e.attempts, e.next_attempt_at, e.claimed_at,
    (e.status = 'claimed' AND e.locked_until < now()),
    e.last_error, e.provider_message_id, e.created_at, e.sent_at, e.session_id,
    e.payload ->> 'company_name',
    e.payload ->> 'reference',
    COALESCE(e.payload -> 'resubmission' = 'true'::jsonb, false),
    e.pending_send IS NOT NULL,
    e.requeue_count, e.last_requeued_at
  FROM public.outbox_events e
  WHERE p_status IS NULL OR e.status = p_status
  ORDER BY e.created_at DESC, e.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$;

CREATE OR REPLACE FUNCTION public.advisor_outbox_summary()
RETURNS TABLE (status text, events bigint, oldest_due_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  RETURN QUERY
  SELECT v.status, count(e.id), min(e.next_attempt_at) FILTER (WHERE v.status = 'pending' AND e.next_attempt_at <= now())
  FROM (VALUES ('pending'), ('claimed'), ('sent'), ('dead'), ('suppressed')) AS v(status)
  LEFT JOIN public.outbox_events e ON e.status = v.status
  GROUP BY v.status;
END;
$$;

-- The submissions whose prospect cannot be reached by the confirmation email: it bounced for good,
-- or they reported it as spam. One row per submission, with why and since when. Empty when all is
-- well, so the queue page can read it beside the list without paying for it.
CREATE FUNCTION public.advisor_email_problems()
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
  SELECT DISTINCT ON (e.session_id) e.session_id, s.reason, s.created_at
  FROM public.outbox_events e
  JOIN public.email_suppressions s ON s.address = lower(btrim(e.payload ->> 'recipient_email'))
  WHERE e.kind = 'prospect_confirmation'
  ORDER BY e.session_id, s.updated_at DESC;
END;
$$;

-- ---------- Privileges ----------

REVOKE ALL ON FUNCTION public.record_email_delivery_event(text, text, text, text[], text, text, timestamptz, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_email_delivery_event(text, text, text, text[], text, text, timestamptz, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.advisor_list_outbox_events(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.advisor_outbox_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.advisor_email_problems() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_list_outbox_events(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advisor_outbox_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.advisor_email_problems() TO authenticated;

RESET lock_timeout;
