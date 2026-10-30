-- Outbox operations (G-1.1 to G-1.3): a claim vocabulary operators can read, a richer advisor alert,
-- and a way for advisors to see the queue and retry what died without database access.
--
-- * A claimed event says so: status 'claimed' (was 'sending') and claimed_at. The lease is 10
--   minutes (was 5): a claim older than that has lost its worker and is taken over by the next
--   claim, or given up on by reap_outbox_events once every attempt is used. The worker's sends are
--   sequential and each is cut off after 10 seconds, so a live worker never outlasts it.
-- * The advisor alert carries the signer, title, headcount, HQ state and the server-stamped
--   certification time. Values are copied by name and range-checked: building the payload must
--   never raise for a data reason, because a raise leaves the certification unqueued for the sweep
--   to retry forever. Census, payroll and document contents are still never copied.
-- * A kind that cannot be sent (a missing or invalid setting) leaves its events queued, as before,
--   but now says why on each event (note_outbox_config_problem) instead of only in a log.
-- * Advisors see the queue through advisor_list_outbox_events / advisor_outbox_summary and retry a
--   dead event with advisor_requeue_outbox_event. outbox_events itself stays service-role only:
--   these functions return a safe projection (never the payload or the frozen email), and every
--   one checks is_advisor() first, so a signed-in non-advisor gets 42501, which PostgREST answers
--   with 403. Who requeued an event, and how often, is recorded on the event.
--
-- Deploy this BEFORE the dispatch-outbox function that calls note_outbox_config_problem.

-- Fail fast instead of queueing behind a long transaction and stalling submissions behind us.
SET lock_timeout = '3s';

-- ---------- The claim vocabulary ----------

ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_events_status_check;
UPDATE public.outbox_events SET status = 'claimed' WHERE status = 'sending';
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_status_check CHECK (status IN ('pending', 'claimed', 'sent', 'dead'));

ALTER TABLE public.outbox_events
  ADD COLUMN claimed_at timestamptz,
  ADD COLUMN requeue_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_requeued_at timestamptz,
  ADD COLUMN last_requeued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.outbox_events.claimed_at IS
  'When the worker holding the claim took it; null unless status is claimed. locked_until is when the claim lapses.';
COMMENT ON COLUMN public.outbox_events.requeue_count IS
  'How many times an advisor or operator put this event back in the queue after it died.';

-- In-flight claims from before this migration were taken under the old 5 minute lease.
UPDATE public.outbox_events
SET claimed_at = COALESCE(locked_until - interval '5 minutes', now())
WHERE status = 'claimed';

-- The due index follows the vocabulary; the second one serves the advisor list (newest first, by status).
DROP INDEX public.outbox_events_due_idx;
CREATE INDEX outbox_events_due_idx ON public.outbox_events (next_attempt_at)
  WHERE status IN ('pending', 'claimed');
CREATE INDEX outbox_events_status_created_idx ON public.outbox_events (status, created_at DESC);

-- ---------- Enqueueing: the advisor alert's fields ----------

-- Same as the reliability migration's, plus signer_name, signer_title, employee_count, hq_state and
-- certified_at in the advisor payload. employee_count follows the app's headcount rule: the
-- stated count, else the W-2 rows of the roster (only counted, never copied). A value outside what
-- the app accepts is left out rather than raised on.
CREATE OR REPLACE FUNCTION public.enqueue_certification_notifications(p_certification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cert public.chamber_certifications;
  s public.chamber_sessions;
  prof public.profiles;
  account_email text;
  company text;
  reference text;
  dedupe text;
  is_update boolean;
  headcount integer;
  hq text;
BEGIN
  -- Locked, so "still active" stays true until this transaction ends: a re-certification waits.
  SELECT * INTO cert FROM public.chamber_certifications WHERE id = p_certification_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'certification % does not exist', p_certification_id USING ERRCODE = 'P0002';
  END IF;
  IF cert.superseded_at IS NOT NULL THEN
    -- The newer certification carries the current data; alerting for this one would be stale.
    RAISE EXCEPTION 'certification % is superseded', p_certification_id;
  END IF;

  SELECT * INTO s FROM public.chamber_sessions WHERE id = cert.session_id;
  SELECT * INTO prof FROM public.profiles WHERE user_id = cert.user_id;
  SELECT u.email INTO account_email FROM auth.users u WHERE u.id = cert.user_id;

  company := COALESCE(NULLIF(btrim(s.chamber_data ->> 'company_name'), ''), NULLIF(btrim(prof.company_name), ''));
  -- Same fallback the advisor view uses (fileIdForSession) if the certification carries none.
  reference := left(COALESCE(
    NULLIF(btrim(cert.file_id), ''),
    'EAA-' || to_char(s.created_at, 'YYYY') || '-' || upper(left(replace(s.id::text, '-', ''), 8))
  ), 64);
  dedupe := cert.session_id::text || ':' || cert.data_sha256;
  -- Checked before inserting: an earlier alert for this intake makes this one an update.
  is_update := EXISTS (
    SELECT 1 FROM public.outbox_events WHERE session_id = cert.session_id AND kind = 'advisor_notification'
  );

  -- Nested CASEs, not AND: SQL does not promise to skip the cast when the type test fails.
  headcount := CASE
    WHEN jsonb_typeof(s.chamber_data -> 'employee_count') = 'number' THEN
      CASE WHEN (s.chamber_data ->> 'employee_count')::numeric BETWEEN 0 AND 10000000
           THEN round((s.chamber_data ->> 'employee_count')::numeric)::integer END
    -- No stated count: the W-2 rows of the census, or of the roster the census replaced (`employees`).
    ELSE COALESCE(
      NULLIF((SELECT count(*)::integer FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(s.chamber_data -> 'census') = 'array' THEN s.chamber_data -> 'census' ELSE '[]'::jsonb END) r
              WHERE lower(r ->> 'classification') = 'w2'), 0),
      NULLIF((SELECT count(*)::integer FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(s.chamber_data -> 'employees') = 'array' THEN s.chamber_data -> 'employees' ELSE '[]'::jsonb END) r
              WHERE r ->> 'classification' = 'W2'), 0)
    )
  END;
  hq := CASE
    WHEN jsonb_typeof(s.chamber_data -> 'hq_state') = 'string' AND (s.chamber_data ->> 'hq_state') ~ '^[A-Za-z]{2}$'
    THEN upper(s.chamber_data ->> 'hq_state')
  END;

  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
  VALUES (
    'advisor_notification', cert.session_id, dedupe,
    jsonb_build_object(
      'reference', reference,
      'company_name', left(company, 200),
      'contact_name', left(COALESCE(NULLIF(btrim(prof.contact_name), ''), cert.signer_name), 200),
      'contact_email', account_email,
      'contact_phone', left(NULLIF(btrim(prof.phone), ''), 50),
      'signer_name', left(cert.signer_name, 200),
      'signer_title', left(cert.signer_title, 200),
      'employee_count', headcount,
      'hq_state', hq,
      -- The database's own stamp (what the advisor review shows), not the signer's browser clock.
      'certified_at', to_char(cert.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'resubmission', is_update
    )
  )
  ON CONFLICT (kind, dedupe_key) DO NOTHING;

  -- The confirmation goes to the signed-in account's own address: a certifying account is never
  -- anonymous (see block_guest_submission), and an address typed into the intake is not trusted.
  IF account_email IS NOT NULL AND btrim(account_email) <> '' THEN
    INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
    VALUES (
      'prospect_confirmation', cert.session_id, dedupe,
      jsonb_build_object(
        'reference', reference,
        'company_name', left(company, 200),
        'recipient_name', left(cert.signer_name, 200),
        'recipient_email', account_email
      )
    )
    ON CONFLICT (kind, dedupe_key) DO NOTHING;
  END IF;

  -- Last, so the marker is only ever set once everything above has happened.
  UPDATE public.chamber_certifications SET outbox_queued_at = now() WHERE id = p_certification_id;
END;
$$;

-- ---------- Worker interface (service role only) ----------

-- Gives up on lapsed claims (the worker died mid-send) with every attempt used, and returns them
-- so the worker can say so. Those with attempts left are not touched here: the next claim takes
-- them over, with their frozen message, so the retry carries the same idempotency key.
CREATE OR REPLACE FUNCTION public.reap_outbox_events(p_max_attempts integer)
RETURNS TABLE (id uuid, kind text, attempts integer, last_error text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.outbox_events e
  SET status = 'dead',
      claimed_at = NULL,
      locked_until = NULL,
      last_error = CASE WHEN e.pending_send IS NOT NULL THEN 'worker_lost_maybe_sent' ELSE 'worker_lost' END
  WHERE e.status = 'claimed' AND e.locked_until < now() AND e.attempts >= p_max_attempts
  RETURNING e.id, e.kind, e.attempts, e.last_error;
$$;

-- Claims up to `p_batch` due events of the given kinds for one worker, for `p_lock_seconds` (10
-- minutes by default). Concurrent workers never get the same event (FOR UPDATE SKIP LOCKED). A
-- claim that has lapsed is taken over again.
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

-- Same as before, for the renamed status: only the worker holding the claim can freeze.
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

CREATE OR REPLACE FUNCTION public.complete_outbox_event(p_id uuid, p_message_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.outbox_events
  SET status = 'sent', sent_at = now(), provider_message_id = left(p_message_id, 200),
      last_error = NULL, claimed_at = NULL, locked_until = NULL, pending_send = NULL
  WHERE id = p_id AND status <> 'sent';
$$;

-- Records a failed send: retried after `p_retry_in_seconds`, or marked dead when that is null.
-- Fenced by the claim's attempt number, and (see the reliability migration) the frozen message is
-- only dropped for a definitive rejection of the first send of that freeze.
CREATE OR REPLACE FUNCTION public.fail_outbox_event(
  p_id uuid,
  p_error text,
  p_retry_in_seconds integer,
  p_attempt integer,
  p_definitive boolean DEFAULT false
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.outbox_events
  SET status = CASE WHEN p_retry_in_seconds IS NULL THEN 'dead' ELSE 'pending' END,
      next_attempt_at = CASE WHEN p_retry_in_seconds IS NULL THEN next_attempt_at
                             ELSE now() + make_interval(secs => p_retry_in_seconds) END,
      last_error = left(p_error, 200),
      claimed_at = NULL,
      locked_until = NULL,
      pending_send = CASE WHEN p_definitive AND (pending_send -> 'attempt') = to_jsonb(p_attempt)
                          THEN NULL ELSE pending_send END
  WHERE id = p_id AND status = 'claimed' AND attempts = p_attempt;
$$;

-- Says why a kind is not being sent, on each of its waiting events, without spending an attempt:
-- the events stay pending and go out the moment the setting is fixed (a send then clears the
-- note). `p_error` names settings, never their values. Rows already carrying this exact note are
-- left alone, so the every-minute run does not rewrite the table. Returns how many it changed.
CREATE FUNCTION public.note_outbox_config_problem(p_kind text, p_error text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH noted AS (
    UPDATE public.outbox_events e
    SET last_error = left('not_configured: ' || p_error, 200)
    WHERE e.kind = p_kind AND e.status = 'pending'
      AND e.last_error IS DISTINCT FROM left('not_configured: ' || p_error, 200)
    RETURNING 1
  )
  SELECT count(*)::integer FROM noted;
$$;

-- Puts a dead event back in the queue. The frozen message is kept by default, so the retry carries
-- the same key and the provider can still de-duplicate; p_rebuild drops it, so the next send is
-- built from the stored payload and the current settings, under a fresh key. Check the provider
-- log for the old key first when the event was dead with a frozen message. `p_actor` is who asked
-- (null for an operator at the SQL editor). Returns whether it requeued.
DROP FUNCTION public.requeue_outbox_event(uuid, boolean);
CREATE FUNCTION public.requeue_outbox_event(p_id uuid, p_rebuild boolean DEFAULT false, p_actor uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.outbox_events
  SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL,
      claimed_at = NULL, locked_until = NULL,
      requeue_count = requeue_count + 1, last_requeued_at = now(), last_requeued_by = p_actor,
      -- attempts restarts at 0, so the frozen attempt number could meet a later claim's: a
      -- definitive answer to that retry would then be taken for the answer to the first send and
      -- rotate the key. Attempt 0 is never a claim's.
      pending_send = CASE
        WHEN p_rebuild THEN NULL
        WHEN pending_send IS NULL THEN NULL
        ELSE jsonb_set(pending_send, '{attempt}', '0')
      END
  WHERE id = p_id AND status = 'dead';
  RETURN FOUND;
END;
$$;

-- ---------- Advisors (signed in, advisor or admin role) ----------

-- The queue, newest first, optionally one status. A projection: company and reference for
-- recognising the event, the state of the delivery, never the payload or the frozen email.
-- `claim_lapsed` marks a claim whose worker is gone (the next run takes it over). `frozen` marks an
-- event with an email already written, which an ambiguous attempt may have delivered.
CREATE FUNCTION public.advisor_list_outbox_events(p_status text DEFAULT NULL, p_limit integer DEFAULT 100)
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
  IF p_status IS NOT NULL AND p_status NOT IN ('pending', 'claimed', 'sent', 'dead') THEN
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

-- One row per status (zero counts included), for the tabs. `oldest_due_at` is, for pending, when
-- the longest-waiting due event became due: it keeps growing when nothing is working the queue
-- (the schedule is down, or a kind's settings are incomplete).
CREATE FUNCTION public.advisor_outbox_summary()
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
  FROM (VALUES ('pending'), ('claimed'), ('sent'), ('dead')) AS v(status)
  LEFT JOIN public.outbox_events e ON e.status = v.status
  GROUP BY v.status;
END;
$$;

-- One-click retry for a dead event. `rebuild_payload` drops the email already written for it, so
-- the next send is rebuilt from the stored payload and the current settings under a new key: use it
-- after fixing the sender or recipient, and know that if the old one was delivered this sends a
-- second copy. Without it the same email goes out under the same key, which the provider
-- de-duplicates. The payload is the summary taken when the intake was certified; it is deliberately
-- not re-read from live data. Resets attempts to 0 and schedules it now. Returns false when the
-- event is not dead (someone else already requeued it, or it was sent), so a double click is
-- harmless.
CREATE FUNCTION public.advisor_requeue_outbox_event(event_id uuid, rebuild_payload boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.require_advisor();
  IF event_id IS NULL THEN
    RAISE EXCEPTION 'an event id is required' USING ERRCODE = '22023';
  END IF;
  RETURN public.requeue_outbox_event(event_id, COALESCE(rebuild_payload, false), auth.uid());
END;
$$;

-- ---------- Privileges ----------

-- Supabase's default privileges grant EXECUTE on new functions to anon and authenticated: take it
-- away, then give the worker interface to the service role alone and the advisor functions to
-- signed-in users (each checks the role itself).
REVOKE ALL ON FUNCTION public.reap_outbox_events(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.freeze_outbox_message(uuid, integer, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_outbox_event(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_outbox_event(uuid, text, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.note_outbox_config_problem(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.requeue_outbox_event(uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
-- Still granted to nobody, the service role included (see the reliability migration).
REVOKE ALL ON FUNCTION public.enqueue_certification_notifications(uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reap_outbox_events(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.freeze_outbox_message(uuid, integer, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_outbox_event(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_outbox_event(uuid, text, integer, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.note_outbox_config_problem(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_outbox_event(uuid, boolean, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.advisor_list_outbox_events(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.advisor_outbox_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.advisor_requeue_outbox_event(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_list_outbox_events(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advisor_outbox_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.advisor_requeue_outbox_event(uuid, boolean) TO authenticated;

RESET lock_timeout;
