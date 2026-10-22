-- Outbox reliability: no silent loss, and no duplicate after an ambiguous send.
--
-- Gap 1. A queueing fault is fenced so it cannot block a submission, which also made it silent:
--   the certification stood and nobody was ever told. The truth now lives ON the certification
--   (outbox_queued_at), so a scheduled sweep can find every active certification that was never
--   queued, queue it, and say so. It is never inferred from a missing outbox_events row:
--   operators and retention delete queue rows on purpose, and that must never re-send anything.
--   A fault in the queueing code can never block a submission. (A cancelled query, such as a
--   statement timeout, is the one thing EXCEPTION WHEN OTHERS does not catch.)
-- Gap 2. A send that timed out or errored may still have been delivered. The retry must carry the
--   same message and the same idempotency key, even if settings changed in between, so the
--   message is frozen on the event (pending_send) before the first send and reused until the
--   provider gives a definitive answer.
-- Also: a lapsed claim with every attempt used was marked dead inside claim_outbox_events with no
--   trace. That is reap_outbox_events now, which returns what it killed so the worker can log it.
--
-- Deploy this BEFORE the dispatch-outbox function that calls it: the old 3-argument
-- fail_outbox_event is dropped here.

-- Fail fast instead of queueing behind a long transaction and stalling submissions behind us.
SET lock_timeout = '3s';

-- ---------- Gap 1: the marker on the certification ----------

ALTER TABLE public.chamber_certifications
  ADD COLUMN outbox_queued_at timestamptz,
  ADD COLUMN outbox_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN outbox_last_failed_at timestamptz,
  ADD COLUMN outbox_last_sqlstate text;

COMMENT ON COLUMN public.chamber_certifications.outbox_queued_at IS
  'Set when its notifications were queued; null on an active certification means they never were. Set it to now() to dismiss one on purpose, to null to queue it again.';
COMMENT ON COLUMN public.chamber_certifications.outbox_failures IS
  'Best-effort count of failed attempts to queue it. Only a hint (it drives the retry cooldown); finding unqueued certifications never depends on it.';
COMMENT ON COLUMN public.chamber_certifications.outbox_last_sqlstate IS
  'SQLSTATE of the last failed attempt to queue it. Never the error text, which can echo row data.';

-- Everything certified before this migration was handled by the earlier trigger, or deliberately
-- not: nothing is back-filled. To queue an old one on purpose:
--   update chamber_certifications set outbox_queued_at = null where id = '...';
UPDATE public.chamber_certifications SET outbox_queued_at = recorded_at WHERE outbox_queued_at IS NULL;

-- What the sweep looks for: small however many certifications there are.
CREATE INDEX chamber_certifications_unqueued_idx ON public.chamber_certifications (recorded_at)
  WHERE superseded_at IS NULL AND outbox_queued_at IS NULL;

-- ---------- Gap 2: the frozen send ----------

-- {"key": "outbox-<event>-<12 hex>", "message": {...}, "attempt": <claim that froze it>, "frozen_at": "<iso>"}
-- The idempotency key lives inside it, so clearing it is the only way a key rotates.
ALTER TABLE public.outbox_events ADD COLUMN pending_send jsonb;

-- ---------- Enqueueing ----------

-- Queues both notifications for one certification. The trigger and the sweep both call it, so
-- they cannot drift apart. Idempotent: the dedupe key makes a second call add nothing.
CREATE FUNCTION public.enqueue_certification_notifications(p_certification_id uuid)
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

  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
  VALUES (
    'advisor_notification', cert.session_id, dedupe,
    jsonb_build_object(
      'reference', reference,
      'company_name', left(company, 200),
      'contact_name', left(COALESCE(NULLIF(btrim(prof.contact_name), ''), cert.signer_name), 200),
      'contact_email', account_email,
      'contact_phone', left(NULLIF(btrim(prof.phone), ''), 50),
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

-- Enqueues both notifications for a new certification. A failure is recorded on the
-- certification and warned about, never raised: the submission stands and the sweep heals it.
CREATE OR REPLACE FUNCTION public.enqueue_submission_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    PERFORM public.enqueue_certification_notifications(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- The subtransaction is rolled back, so neither event is half-written. The certification
    -- itself stands.
    RAISE WARNING 'enqueue_submission_notifications failed for certification %: % (%)', NEW.id, left(SQLERRM, 200), SQLSTATE;
    -- A hint for the sweep's cooldown and for diagnosis. Nested so it can never escape either: a
    -- failing hint must not undo the submission, and detection does not depend on it.
    BEGIN
      UPDATE public.chamber_certifications
      SET outbox_failures = outbox_failures + 1,
          outbox_last_failed_at = now(),
          outbox_last_sqlstate = SQLSTATE
      WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'enqueue_submission_notifications could not record the failure for certification % (%)', NEW.id, SQLSTATE;
    END;
  END;
  RETURN NULL;
END;
$$;

-- ---------- Healing (service role, from the scheduled sweep) ----------

-- Queues the notifications of active certifications that never were, and reports what is still
-- unqueued afterwards so the caller can raise it. A certification that keeps failing backs off
-- exponentially (2, 4 ... 60 minutes) so a few poison rows cannot starve healthy ones of the
-- batch. SKIP LOCKED makes concurrent runs split the work, and the row lock keeps a concurrent
-- re-certification from superseding a certification mid-heal. Superseded certifications are
-- never healed: the newer one carries the current data.
CREATE FUNCTION public.reconcile_outbox_events(p_limit integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cert_id uuid;
  healed integer := 0;
  failed integer := 0;
  still_unqueued integer;
  oldest_seconds bigint;
  last_state text;
BEGIN
  FOR cert_id IN
    SELECT c.id
    FROM public.chamber_certifications c
    WHERE c.superseded_at IS NULL
      AND c.outbox_queued_at IS NULL
      AND (c.outbox_last_failed_at IS NULL
           OR c.outbox_last_failed_at < now() - make_interval(mins => LEAST(60, (2 ^ LEAST(c.outbox_failures, 6))::integer)))
    ORDER BY c.outbox_last_failed_at NULLS FIRST, c.recorded_at
    LIMIT GREATEST(COALESCE(p_limit, 25), 0)
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM public.enqueue_certification_notifications(cert_id);
      healed := healed + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      -- Nested: a hint that cannot be written must not abort the run and roll back every heal.
      BEGIN
        UPDATE public.chamber_certifications
        SET outbox_failures = outbox_failures + 1,
            outbox_last_failed_at = now(),
            outbox_last_sqlstate = SQLSTATE
        WHERE id = cert_id;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END LOOP;

  SELECT count(*), GREATEST(0, COALESCE(floor(extract(epoch FROM now() - min(c.recorded_at))), 0))::bigint
  INTO still_unqueued, oldest_seconds
  FROM public.chamber_certifications c
  WHERE c.superseded_at IS NULL AND c.outbox_queued_at IS NULL;

  SELECT c.outbox_last_sqlstate INTO last_state
  FROM public.chamber_certifications c
  WHERE c.superseded_at IS NULL AND c.outbox_queued_at IS NULL AND c.outbox_last_failed_at IS NOT NULL
  ORDER BY c.outbox_last_failed_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'healed', healed,
    'failed', failed,
    'unqueued', still_unqueued,
    'oldest_age_seconds', oldest_seconds,
    'last_sqlstate', last_state
  );
END;
$$;

-- ---------- Worker interface (service role only) ----------

-- Gives up on lapsed claims (the worker died mid-send) with every attempt used, and returns them
-- so the worker can say so. 'worker_lost_maybe_sent' means a message had been frozen: it may
-- have been delivered, so check the provider log for its key before requeueing.
CREATE FUNCTION public.reap_outbox_events(p_max_attempts integer)
RETURNS TABLE (id uuid, kind text, attempts integer, last_error text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.outbox_events e
  SET status = 'dead',
      locked_until = NULL,
      last_error = CASE WHEN e.pending_send IS NOT NULL THEN 'worker_lost_maybe_sent' ELSE 'worker_lost' END
  WHERE e.status = 'sending' AND e.locked_until < now() AND e.attempts >= p_max_attempts
  RETURNING e.id, e.kind, e.attempts, e.last_error;
$$;

-- Claims up to `p_batch` due events of the given kinds for one worker. Concurrent workers never
-- get the same event. A claim that has lapsed (the worker died mid-send) is picked up again with
-- its frozen message, so the retry carries the same idempotency key. Exhausted ones are left for
-- reap_outbox_events: killing them here left no trace.
CREATE OR REPLACE FUNCTION public.claim_outbox_events(
  p_kinds text[],
  p_batch integer,
  p_max_attempts integer,
  p_lock_seconds integer DEFAULT 300
)
RETURNS SETOF public.outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.outbox_events e
  SET status = 'sending', attempts = e.attempts + 1, locked_until = now() + make_interval(secs => p_lock_seconds)
  WHERE e.id IN (
    SELECT o.id
    FROM public.outbox_events o
    WHERE o.kind = ANY (p_kinds)
      AND o.attempts < p_max_attempts
      AND ((o.status = 'pending' AND o.next_attempt_at <= now()) OR (o.status = 'sending' AND o.locked_until < now()))
    ORDER BY o.next_attempt_at, o.created_at
    LIMIT p_batch
    FOR UPDATE SKIP LOCKED
  )
  RETURNING e.*;
END;
$$;

-- Freezes what is about to be sent, before it is sent: the message and its idempotency key. Only
-- the worker holding the claim (p_attempt is the attempt number the claim returned) can freeze,
-- and only once, unless p_replace says the stored one is unusable. Returns the stored value, which
-- the worker must send as it is, or null when this did not apply (not the claimant, already
-- frozen, row gone).
CREATE FUNCTION public.freeze_outbox_message(
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
  WHERE e.id = p_id AND e.status = 'sending' AND e.attempts = p_attempt AND (e.pending_send IS NULL OR p_replace)
  RETURNING e.pending_send INTO frozen;

  RETURN frozen;
END;
$$;

-- Records a successful send. Also accepted for an event that was already given up on or requeued:
-- if the message went out, that is what happened. Nothing is left to freeze or retry.
CREATE OR REPLACE FUNCTION public.complete_outbox_event(p_id uuid, p_message_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.outbox_events
  SET status = 'sent', sent_at = now(), provider_message_id = left(p_message_id, 200),
      last_error = NULL, locked_until = NULL, pending_send = NULL
  WHERE id = p_id AND status <> 'sent';
$$;

-- Records a failed send: retried after `p_retry_in_seconds`, or marked dead when that is null.
-- Fenced by the claim's attempt number, so a worker whose claim lapsed and was taken over cannot
-- overwrite the new claimant's outcome.
--
-- The frozen message is dropped (so the next send rebuilds from current settings with a new key)
-- only when the provider definitively rejected the FIRST send of this freeze. A definitive answer
-- to a retry says nothing about the earlier attempts, which may have been delivered: the key must
-- not rotate after an ambiguous attempt.
DROP FUNCTION public.fail_outbox_event(uuid, text, integer);
CREATE FUNCTION public.fail_outbox_event(
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
      locked_until = NULL,
      pending_send = CASE WHEN p_definitive AND (pending_send -> 'attempt') = to_jsonb(p_attempt)
                          THEN NULL ELSE pending_send END
  WHERE id = p_id AND status = 'sending' AND attempts = p_attempt;
$$;

-- Puts a dead event back in the queue for an operator. The frozen message is kept by default, so
-- the retry carries the same key and the provider can still de-duplicate; p_rebuild drops it, so
-- the next send is built from the current settings with a fresh key. Check the provider log for
-- the old key first when the event was dead with a frozen message. Returns whether it requeued.
CREATE FUNCTION public.requeue_outbox_event(p_id uuid, p_rebuild boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.outbox_events
  SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL, locked_until = NULL,
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

-- ---------- Privileges ----------

-- Supabase's default privileges grant EXECUTE on new functions to anon and authenticated: take it
-- away from everything below, then give the worker interface to the service role alone.
REVOKE ALL ON FUNCTION public.enqueue_submission_notifications() FROM PUBLIC, anon, authenticated;
-- The trigger and the sweep call this as the function owner. A client that could call it could
-- force alerts, so it is granted to nobody, the service role included; an operator runs it from
-- the SQL editor.
REVOKE ALL ON FUNCTION public.enqueue_certification_notifications(uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.reconcile_outbox_events(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reap_outbox_events(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.freeze_outbox_message(uuid, integer, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_outbox_event(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_outbox_event(uuid, text, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.requeue_outbox_event(uuid, boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reconcile_outbox_events(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reap_outbox_events(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.freeze_outbox_message(uuid, integer, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_outbox_event(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_outbox_event(uuid, text, integer, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_outbox_event(uuid, boolean) TO service_role;

RESET lock_timeout;
