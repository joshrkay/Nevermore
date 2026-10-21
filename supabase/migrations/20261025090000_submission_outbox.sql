-- Submission notifications (G-1 advisor alert, G-2 prospect confirmation): a transactional outbox.
--
-- * Certifying an intake (which is what submits it) enqueues the notifications in the same
--   transaction, so there is never a submission that was lost before anyone could be told, and
--   never a notification for a submission that rolled back.
-- * The queue row carries only a small, safe summary built here from named fields: company,
--   contact, reference. Census, payroll and document contents are never copied into it, so no
--   message built from it can leak them.
-- * One notification of each kind per distinct certified data (session + data hash). A client
--   retry, which re-certifies identical data, adds a certification row but no second alert.
--   Re-certifying changed answers is a new submission and is flagged as an update.
-- * The edge function `dispatch-outbox` sends the queue with retry and backoff and records the
--   outcome. A send failure never touches the submission.
-- * A bug in this file must never block a prospect's submission, so enqueueing failures are
--   reported as warnings rather than raised.

CREATE TABLE public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('advisor_notification', 'prospect_confirmation')),
  session_id uuid NOT NULL REFERENCES public.chamber_sessions(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,                -- a short failure kind, never a provider response body
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (kind, dedupe_key)
);

CREATE INDEX outbox_events_due_idx ON public.outbox_events (next_attempt_at)
  WHERE status IN ('pending', 'sending');

-- Internal: no client, prospect or advisor reads or writes it. The service role (the edge
-- function) bypasses row security.
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outbox_events FROM anon, authenticated;

-- Enqueues both notifications for a new certification.
CREATE OR REPLACE FUNCTION public.enqueue_submission_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.chamber_sessions;
  prof public.profiles;
  account_email text;
  company text;
  reference text;
  dedupe text;
  is_update boolean;
BEGIN
  BEGIN
    SELECT * INTO s FROM public.chamber_sessions WHERE id = NEW.session_id;
    SELECT * INTO prof FROM public.profiles WHERE user_id = NEW.user_id;
    SELECT u.email INTO account_email FROM auth.users u WHERE u.id = NEW.user_id;

    company := COALESCE(NULLIF(btrim(s.chamber_data ->> 'company_name'), ''), NULLIF(btrim(prof.company_name), ''));
    -- Same fallback the advisor view uses (fileIdForSession) if the certification carries none.
    reference := left(COALESCE(
      NULLIF(btrim(NEW.file_id), ''),
      'EAA-' || to_char(s.created_at, 'YYYY') || '-' || upper(left(replace(s.id::text, '-', ''), 8))
    ), 64);
    dedupe := NEW.session_id::text || ':' || NEW.data_sha256;
    -- Checked before inserting: an earlier alert for this intake makes this one an update.
    is_update := EXISTS (
      SELECT 1 FROM public.outbox_events WHERE session_id = NEW.session_id AND kind = 'advisor_notification'
    );

    INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
    VALUES (
      'advisor_notification', NEW.session_id, dedupe,
      jsonb_build_object(
        'reference', reference,
        'company_name', left(company, 200),
        'contact_name', left(COALESCE(NULLIF(btrim(prof.contact_name), ''), NEW.signer_name), 200),
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
        'prospect_confirmation', NEW.session_id, dedupe,
        jsonb_build_object(
          'reference', reference,
          'company_name', left(company, 200),
          'recipient_name', left(NEW.signer_name, 200),
          'recipient_email', account_email
        )
      )
      ON CONFLICT (kind, dedupe_key) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- The subtransaction is rolled back, so neither event is half-written. The certification
    -- itself stands.
    RAISE WARNING 'enqueue_submission_notifications failed for session %: % (%)', NEW.session_id, SQLERRM, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_submission_notifications() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_certifications_enqueue_notifications
  AFTER INSERT ON public.chamber_certifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_submission_notifications();

-- ---------- Worker interface (service role only) ----------

-- Claims up to `p_batch` due events of the given kinds for one worker. Concurrent workers never
-- get the same event. A claim that has lapsed (the worker died mid-send) is picked up again; the
-- send carries the event id as its idempotency key, so the provider does not send twice.
CREATE OR REPLACE FUNCTION public.claim_outbox_events(
  p_kinds text[],
  p_batch integer,
  p_max_attempts integer,
  p_lock_seconds integer DEFAULT 300
)
RETURNS SETOF public.outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A lapsed claim with every attempt used has nothing left to retry.
  UPDATE public.outbox_events
  SET status = 'dead', last_error = 'worker_lost', locked_until = NULL
  WHERE status = 'sending' AND locked_until < now() AND attempts >= p_max_attempts;

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

-- Records a successful send. Also accepted for an event that was already given up on or requeued:
-- if the message went out, that is what happened.
CREATE OR REPLACE FUNCTION public.complete_outbox_event(p_id uuid, p_message_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.outbox_events
  SET status = 'sent', sent_at = now(), provider_message_id = left(p_message_id, 200),
      last_error = NULL, locked_until = NULL
  WHERE id = p_id AND status <> 'sent';
$$;

-- Records a failed send: retried after `p_retry_in_seconds`, or marked dead when that is null.
CREATE OR REPLACE FUNCTION public.fail_outbox_event(p_id uuid, p_error text, p_retry_in_seconds integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.outbox_events
  SET status = CASE WHEN p_retry_in_seconds IS NULL THEN 'dead' ELSE 'pending' END,
      next_attempt_at = CASE WHEN p_retry_in_seconds IS NULL THEN next_attempt_at
                             ELSE now() + make_interval(secs => p_retry_in_seconds) END,
      last_error = left(p_error, 200),
      locked_until = NULL
  WHERE id = p_id AND status = 'sending';
$$;

REVOKE ALL ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_outbox_event(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_outbox_event(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_outbox_event(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_outbox_event(uuid, text, integer) TO service_role;
