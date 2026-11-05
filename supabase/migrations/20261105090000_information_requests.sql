-- Information requests: an advisor asks the prospect for more, and the product tells them.
--
-- Before this, an advisor could move a submission to `information_requested`, and the prospect's status note
-- said to watch their email for the request, but nothing sent one, the Advisor Console doesn't show the
-- account's address, and a field an advisor marked as needing follow-up never reached the prospect.
--
-- * public.information_requests: what the advisor asked, and which fields it is about. Append-only, like the
--   notes and the status history: it is the record of what the prospect was asked and when.
-- * public.advisor_request_information(): records a request, moves the pipeline to `information_requested`
--   (or keeps it there for a second request), writes the status history, and queues an `information_request`
--   email to the account's own address, all in one transaction. Only for an intake certified at least once.
-- * public.prospect_information_request(): the owner reads the latest request while the pipeline is still at
--   `information_requested`. Certifying again answers it (20261104111000 moves the pipeline back to
--   `submitted`), and so does an advisor moving the pipeline on, as the prospect's status already shows.
-- * public.outbox_kind_reaches_prospect(): the outbox kinds sent to the prospect's own address. A bounce or a
--   complaint on any of them suppresses that address, and nothing more of any of them is sent to it: the
--   claim, the webhook's record and the advisor's email problems now ask this instead of naming the
--   confirmation alone.
--
-- The email carries the advisor's message, the labels of the fields it is about, the File ID and a link to
-- the intake (sign-in required). Never an answer, the census, payroll or document contents. The advisor's
-- message is theirs to write: the panel tells them not to put employee details in it.
--
-- Deploy order: this migration, then dispatch-outbox (it sends the new kind), then the front end. Until the
-- function is deployed, requests are recorded and their emails wait in the queue.

SET lock_timeout = '5s';

-- ---------- Which outbox kinds go to the prospect ----------

CREATE OR REPLACE FUNCTION public.outbox_kind_reaches_prospect(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_kind IN (
    -- sync:begin prospect_outbox_kinds
    'prospect_confirmation', 'information_request'
    -- sync:end prospect_outbox_kinds
  );
$$;

REVOKE ALL ON FUNCTION public.outbox_kind_reaches_prospect(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request'
    -- sync:end outbox_kinds
  ));

-- ---------- The requests ----------

CREATE TABLE public.information_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.chamber_sessions(id) ON DELETE CASCADE,
  -- What the advisor wrote to the prospect. The prospect reads it in the email and in The Chamber.
  message text NOT NULL CHECK (btrim(message) <> '' AND char_length(message) <= 1000),
  -- The reviewable fields it is about, each once (public.is_reviewable_field), in the order asked.
  fields text[] NOT NULL DEFAULT '{}' CHECK (cardinality(fields) <= 40),
  requested_by uuid,
  requested_by_email text,
  requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX information_requests_session_idx ON public.information_requests (session_id, id DESC);

ALTER TABLE public.information_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.information_requests FROM anon, authenticated;
GRANT SELECT ON public.information_requests TO authenticated;

-- Advisors read every request; prospects read theirs only through prospect_information_request(). Nobody
-- writes the table directly: advisor_request_information() does.
CREATE POLICY information_requests_advisor_read ON public.information_requests
  FOR SELECT TO authenticated
  USING (public.is_advisor());

DROP TRIGGER IF EXISTS information_requests_append_only ON public.information_requests;
CREATE TRIGGER information_requests_append_only
  BEFORE UPDATE OR DELETE ON public.information_requests
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

-- ---------- Asking ----------

-- Records a request and sends it. p_fields are reviewable fields (the census's older name, employees, counts as
-- the census), each kept once in the order given; none is fine when the request is about something no field
-- holds, such as a document. Moves the pipeline to `information_requested` when it may move there from where it
-- is (pipeline_next_statuses), and keeps it there for a second request. Refused (22023) without a message, for
-- an intake never certified, a closed one, or a prospect with no email address; PT404 when there is no such
-- submission. Returns the request id and the pipeline stages before and after.
CREATE OR REPLACE FUNCTION public.advisor_request_information(p_session_id uuid, p_message text, p_fields text[] DEFAULT '{}')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.chamber_sessions;
  w public.submission_workflow;
  clean_message text := btrim(COALESCE(p_message, ''));
  clean_fields text[];
  unknown_fields text;
  recipient text;
  contact text;
  company text;
  req public.information_requests;
BEGIN
  PERFORM public.require_advisor();

  IF clean_message = '' THEN
    RAISE EXCEPTION 'Write what you need from the prospect' USING ERRCODE = '22023';
  END IF;
  IF char_length(clean_message) > 1000 THEN
    RAISE EXCEPTION 'A request is limited to 1000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT string_agg(DISTINCT f, ', ') INTO unknown_fields
  FROM unnest(COALESCE(p_fields, '{}'::text[])) AS f
  WHERE f IS NULL OR NOT public.is_reviewable_field(f);
  IF unknown_fields IS NOT NULL OR array_position(COALESCE(p_fields, '{}'::text[]), NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Not a field the prospect can be asked about: %', COALESCE(unknown_fields, 'an empty name') USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(x.field ORDER BY x.first_at), '{}'::text[]) INTO clean_fields
  FROM (
    SELECT CASE WHEN u.f = 'employees' THEN 'census' ELSE u.f END AS field, min(u.ord) AS first_at
    FROM unnest(COALESCE(p_fields, '{}'::text[])) WITH ORDINALITY AS u(f, ord)
    GROUP BY 1
  ) x;
  IF cardinality(clean_fields) > 40 THEN
    RAISE EXCEPTION 'A request can name at most 40 fields' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO w FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  IF s.status IN ('archived', 'revoked', 'expired') THEN
    RAISE EXCEPTION 'This intake is closed (%), so the prospect can''t answer a request on it', s.status USING ERRCODE = '22023';
  END IF;
  IF NOT public.intake_ever_certified(p_session_id) THEN
    RAISE EXCEPTION 'The prospect hasn''t certified this intake yet, so there is nothing to ask them about' USING ERRCODE = '22023';
  END IF;
  IF w.status <> 'information_requested' AND NOT ('information_requested' = ANY (public.pipeline_next_statuses(w.status))) THEN
    RAISE EXCEPTION 'A submission can''t move from % to information requested', replace(w.status, '_', ' ') USING ERRCODE = '22023';
  END IF;

  SELECT NULLIF(btrim(u.email), '') INTO recipient
  FROM auth.users u
  WHERE u.id = s.user_id AND NOT COALESCE(u.is_anonymous, false);
  IF recipient IS NULL THEN
    RAISE EXCEPTION 'The prospect''s account has no email address to send this to' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.information_requests (session_id, message, fields, requested_by, requested_by_email)
  VALUES (p_session_id, clean_message, clean_fields, auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO req;

  IF w.status <> 'information_requested' THEN
    UPDATE public.submission_workflow
    SET status = 'information_requested', updated_at = now(), updated_by = auth.uid()
    WHERE session_id = p_session_id;
  END IF;
  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (p_session_id, w.status, 'information_requested', left('Asked the prospect: ' || clean_message, 2000), auth.uid(), auth.jwt() ->> 'email');

  SELECT NULLIF(btrim(p.contact_name), '') INTO contact FROM public.profiles p WHERE p.user_id = s.user_id;
  company := NULLIF(btrim(s.chamber_data ->> 'company_name'), '');

  -- Unlike the certification emails, this one is the point of the call: a failure to queue it fails the request.
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
  VALUES (
    'information_request', p_session_id, 'request:' || req.id,
    jsonb_build_object(
      'reference', left(COALESCE(NULLIF(btrim(s.file_id), ''), NULLIF(btrim(s.submission ->> 'file_id'), '')), 64),
      'company_name', left(company, 200),
      'recipient_name', left(contact, 200),
      'recipient_email', recipient,
      'message', clean_message,
      'fields', to_jsonb(clean_fields),
      'requested_at', to_char(req.requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  RETURN jsonb_build_object('request_id', req.id, 'from_status', w.status, 'status', 'information_requested');
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_request_information(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_request_information(uuid, text, text[]) TO authenticated;

-- ---------- What the prospect reads ----------

-- The latest request on the caller's own intake while the pipeline still waits on them, as
-- { message, fields, requested_at }; null otherwise, and for anyone else's intake.
CREATE OR REPLACE FUNCTION public.prospect_information_request(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('message', r.message, 'fields', to_jsonb(r.fields), 'requested_at', r.requested_at)
  FROM public.information_requests r
  JOIN public.chamber_sessions s ON s.id = r.session_id
  JOIN public.submission_workflow w ON w.session_id = r.session_id
  WHERE r.session_id = p_session_id
    AND s.user_id = auth.uid()
    AND s.status NOT IN ('archived', 'revoked')
    AND w.status = 'information_requested'
  ORDER BY r.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.prospect_information_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospect_information_request(uuid) TO authenticated;

-- ---------- Suppression covers every email to the prospect ----------

-- Unchanged from 20261028090000_email_delivery_events.sql except that every kind sent to the prospect's own
-- address (outbox_kind_reaches_prospect) is treated as the confirmation was: a bounce concerns that address,
-- and what is waiting for it goes no further.
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

-- Unchanged from 20261028090000_email_delivery_events.sql except that a due email of any kind sent to the prospect
-- (not only the confirmation) to a suppressed address is marked 'suppressed' instead of being claimed.
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
  WHERE public.outbox_kind_reaches_prospect(e.kind) AND e.status = 'pending' AND e.next_attempt_at <= now()
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

-- Unchanged from 20261028090000_email_delivery_events.sql except that any email to the prospect counts, not only
-- the confirmation: a bounced information request means the same as a bounced confirmation.
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
  SELECT DISTINCT ON (e.session_id) e.session_id, s.reason, s.created_at
  FROM public.outbox_events e
  JOIN public.email_suppressions s ON s.address = lower(btrim(e.payload ->> 'recipient_email'))
  WHERE public.outbox_kind_reaches_prospect(e.kind)
  ORDER BY e.session_id, s.updated_at DESC;
END;
$$;

-- ---------- Deleting an intake deletes its requests ----------

-- Unchanged from 20261104116000_intake_deletion_removes_document_history.sql except that the intake's information
-- requests are deleted with its other rows, and counted.
CREATE OR REPLACE FUNCTION public.complete_intake_deletion(p_deletion_id uuid, p_files_deleted integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.intake_deletions;
  sid uuid;
  owner_id uuid;
  remaining integer;
  n integer;
  removed jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO d FROM public.intake_deletions WHERE id = p_deletion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deletion not found' USING ERRCODE = 'PT404';
  END IF;
  IF d.status <> 'claimed' THEN
    RAISE EXCEPTION 'Only a claimed deletion can be completed (this one is %)', d.status USING ERRCODE = '55000';
  END IF;
  sid := d.session_id;

  -- Hold the intake still while it is checked and deleted. This waits for any upload still in flight: each
  -- holds a share lock on the row from its policy check (intake_accepts_files) until it commits, so its file
  -- is visible to the check below, and any upload after this one finds the deletion open, or the intake gone.
  SELECT s.user_id INTO owner_id FROM public.chamber_sessions s WHERE s.id = sid FOR UPDATE;
  owner_id := COALESCE(owner_id, d.user_id);

  SELECT count(*)::integer INTO remaining FROM public.intake_stored_files(sid, owner_id);
  IF remaining > 0 THEN
    RAISE EXCEPTION 'The intake still has % stored file(s); remove them first', remaining
      USING ERRCODE = 'EA006', DETAIL = remaining::text;
  END IF;

  PERFORM set_config('eaa.deleting_intake', sid::text, true);

  -- Children first, so each count says what that table held; the session row last.
  DELETE FROM public.manuscript_versions WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('manuscript_versions', n);
  DELETE FROM public.advisor_review_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_review_events', n);
  DELETE FROM public.advisor_field_reviews WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_field_reviews', n);
  DELETE FROM public.advisor_notes WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_notes', n);
  DELETE FROM public.information_requests WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('information_requests', n);
  DELETE FROM public.submission_status_history WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('submission_status_history', n);
  DELETE FROM public.submission_workflow WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('submission_workflow', n);
  DELETE FROM public.intake_lifecycle_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('intake_lifecycle_events', n);
  DELETE FROM public.outbox_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('outbox_events', n);
  DELETE FROM public.chamber_certifications WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('chamber_certifications', n);
  DELETE FROM public.document_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('document_events', n);
  DELETE FROM public.documents WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('documents', n);
  DELETE FROM public.ai_extraction_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('ai_extraction_events', n);
  -- Operational events stay (they are counts for monitoring) but no longer point at the intake.
  UPDATE public.ops_events SET session_id = NULL WHERE session_id = sid;
  DELETE FROM public.chamber_sessions WHERE id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('chamber_sessions', n);

  PERFORM set_config('eaa.deleting_intake', '', true);

  UPDATE public.intake_deletions
  SET status = 'done',
      completed_at = now(),
      locked_until = NULL,
      last_error = NULL,
      files_deleted = GREATEST(COALESCE(p_files_deleted, 0), 0),
      rows_deleted = removed
  WHERE id = d.id;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.record_email_delivery_event(text, text, text, text[], text, text, timestamptz, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_email_delivery_event(text, text, text, text[], text, text, timestamptz, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.advisor_email_problems() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_email_problems() TO authenticated;
REVOKE ALL ON FUNCTION public.complete_intake_deletion(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_intake_deletion(uuid, integer) TO service_role;

RESET lock_timeout;
