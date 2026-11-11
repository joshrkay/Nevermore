-- Receiving PEO mail (joshrkay/Nevermore#92, story M-3.2; docs/adr/0004-peo-mail-is-received-before-the-product-sends.md).
--
-- * public.quote_request_messages: each message that reached a quote request's reply address (M-3.1): who sent it,
--   when, the plain text, the few headers that matter, and what kind it is. Idempotent on the provider's message id,
--   so a replayed webhook records nothing new. A message never changes the quote request or its status.
-- * public.quote_request_message_attachments: each attachment's name, type and size, and what became of it:
--   `stored` (scanned clean, kept in the peo-mail bucket), `blocked` (the scanner found malware; its bytes are not
--   kept, only the signature), `not_kept` (another file type than uploads take, over 20 MB, or not what its name
--   says; listed by name and size) or `pending` (waiting for a scan that couldn't run; unreadable meanwhile).
-- * A message to an address that is revoked, was never issued, or names more than one live quote request is held:
--   stored with no quote request and a reason, for an admin to deal with (story M-3.3). Nothing is attached by guess.
-- * record_inbound_mail(), record_inbound_attachment() and finish_inbound_attachment() are the only writers, and
--   only the service role (the receive-mail function) may call them.
-- * The peo-mail bucket holds clean attachments; advisors read them through a signed link, as with documents.
-- * intake_stored_files() lists an intake's mail files, and complete_intake_deletion() deletes its messages and
--   attachments, with everything else of the intake.
--
-- Advisors read messages that reached a quote request; admins also read held ones; prospects read none.
--
-- Deploy this migration before the receive-mail function. Nothing reads the messages yet (story M-3.4 shows them).

SET lock_timeout = '5s';

CREATE TABLE public.quote_request_messages (
  id bigserial PRIMARY KEY,
  provider_message_id text NOT NULL,
  quote_request_id bigint REFERENCES public.quote_requests (id),
  session_id uuid,
  address_local_part text,
  held_reason text,
  direction text NOT NULL,
  is_automatic boolean NOT NULL DEFAULT false,
  new_sender boolean NOT NULL DEFAULT false,
  from_address text NOT NULL,
  from_name text,
  to_addresses text[] NOT NULL DEFAULT '{}',
  cc_addresses text[] NOT NULL DEFAULT '{}',
  subject text,
  body_text text,
  body_truncated boolean NOT NULL DEFAULT false,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX quote_request_messages_provider_id ON public.quote_request_messages (provider_message_id);
CREATE INDEX quote_request_messages_by_request ON public.quote_request_messages (quote_request_id, sent_at DESC);
CREATE INDEX quote_request_messages_by_session ON public.quote_request_messages (session_id);

-- A message is either on a quote request, or held for a reason: never both, never neither.
ALTER TABLE public.quote_request_messages ADD CONSTRAINT quote_request_messages_shape_check CHECK (
  direction IN ('received', 'sent_by_hand')
  AND (quote_request_id IS NULL) = (held_reason IS NOT NULL)
  AND (quote_request_id IS NULL) = (session_id IS NULL)
  AND (held_reason IS NULL OR held_reason IN ('revoked_address', 'unknown_address', 'ambiguous_address'))
);
ALTER TABLE public.quote_request_messages ADD CONSTRAINT quote_request_messages_size_check CHECK (
  char_length(provider_message_id) BETWEEN 1 AND 200
  AND char_length(from_address) BETWEEN 3 AND 320
  AND (subject IS NULL OR char_length(subject) <= 998)
  -- sync:begin mail_body_length
  AND (body_text IS NULL OR char_length(body_text) <= 100000)
  -- sync:end mail_body_length
);

CREATE TABLE public.quote_request_message_attachments (
  id bigserial PRIMARY KEY,
  message_id bigint NOT NULL REFERENCES public.quote_request_messages (id),
  provider_attachment_id text NOT NULL,
  file_name text NOT NULL,
  content_type text,
  size_bytes bigint NOT NULL,
  status text NOT NULL,
  not_kept_reason text,
  scan_verdict text,
  scan_signature text,
  storage_bucket text,
  storage_path text,
  sha256 text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, provider_attachment_id)
);

CREATE INDEX quote_request_message_attachments_by_message ON public.quote_request_message_attachments (message_id);

-- What became of an attachment (MAIL_ATTACHMENT_STATUSES and MAIL_NOT_KEPT_REASONS in src/data/quoteRequests.ts;
-- schemaSync compares them). A stored file has its path and a clean verdict; a not-kept one has its reason.
ALTER TABLE public.quote_request_message_attachments ADD CONSTRAINT quote_request_message_attachments_status_check CHECK (
  status IN (
    -- sync:begin mail_attachment_statuses
    'pending', 'stored', 'blocked', 'not_kept'
    -- sync:end mail_attachment_statuses
  )
  AND (status = 'not_kept') = (not_kept_reason IS NOT NULL)
  AND (not_kept_reason IS NULL OR not_kept_reason IN (
    -- sync:begin mail_not_kept_reasons
    'too_large', 'unsupported_type', 'type_mismatch', 'executable'
    -- sync:end mail_not_kept_reasons
  ))
  AND (status = 'stored') = (storage_path IS NOT NULL)
  AND (status <> 'stored' OR scan_verdict IN ('clean', 'skipped'))
  AND (status <> 'blocked' OR scan_verdict = 'infected')
  AND size_bytes >= 0
  AND char_length(file_name) BETWEEN 1 AND 255
);

ALTER TABLE public.quote_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_message_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_request_messages, public.quote_request_message_attachments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quote_request_messages, public.quote_request_message_attachments TO authenticated;

-- Advisors read the mail on a quote request; only admins read held mail, which belongs to no intake yet.
CREATE POLICY quote_request_messages_advisor_read ON public.quote_request_messages
  FOR SELECT TO authenticated
  USING (public.is_advisor() AND (quote_request_id IS NOT NULL OR public.has_role('admin')));
-- An attachment is readable exactly when its message is.
CREATE POLICY quote_request_message_attachments_read ON public.quote_request_message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quote_request_messages m WHERE m.id = message_id));

-- ---------- Where clean attachments are kept ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('peo-mail', 'peo-mail', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types'
  ) THEN
    UPDATE storage.buckets
    SET file_size_limit = 20 * 1024 * 1024,
        allowed_mime_types = ARRAY['application/octet-stream']
    WHERE id = 'peo-mail';
  END IF;
END $$;

-- Only the receive-mail function (the service role) stores a file here. An advisor reads one that was recorded
-- as stored, on a message they can read: never a file the scanner hasn't passed, and never held mail unless they
-- are an admin.
DROP POLICY IF EXISTS "Advisors can read PEO mail attachments" ON storage.objects;
CREATE POLICY "Advisors can read PEO mail attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'peo-mail' AND public.is_advisor()
    AND EXISTS (
      SELECT 1 FROM public.quote_request_message_attachments a
      WHERE a.storage_bucket = 'peo-mail' AND a.storage_path = name AND a.status = 'stored'
    )
  );

-- ---------- Recording a message ----------
-- Which quote request an address names: the live one if any live address matches; else held. Two live addresses
-- on different quote requests are ambiguous and held. Matching ignores case.
CREATE FUNCTION public.record_inbound_mail(
  p_provider_message_id text, p_local_parts text[], p_from_address text, p_from_name text, p_to text[], p_cc text[],
  p_subject text, p_body_text text, p_body_truncated boolean, p_headers jsonb, p_is_automatic boolean, p_sent_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  existing public.quote_request_messages;
  locals text[] := COALESCE((SELECT array_agg(DISTINCT lower(btrim(x))) FROM unnest(COALESCE(p_local_parts, '{}')) x WHERE btrim(x) <> ''), '{}');
  from_addr text := lower(btrim(COALESCE(p_from_address, '')));
  live_requests bigint[];
  req public.quote_requests;
  reason text;
  chosen_local text;
  dir text := 'received';
  fresh boolean := false;
  msg public.quote_request_messages;
BEGIN
  IF COALESCE(btrim(p_provider_message_id), '') = '' THEN
    RAISE EXCEPTION 'A message needs the provider''s id' USING ERRCODE = '22023';
  END IF;
  IF from_addr = '' THEN
    RAISE EXCEPTION 'A message needs a sender' USING ERRCODE = '22023';
  END IF;

  -- A replay records nothing new.
  SELECT * INTO existing FROM public.quote_request_messages WHERE provider_message_id = p_provider_message_id;
  IF FOUND THEN
    RETURN jsonb_build_object('message_id', existing.id, 'duplicate', true, 'held', existing.quote_request_id IS NULL,
      'held_reason', existing.held_reason, 'quote_request_id', existing.quote_request_id, 'session_id', existing.session_id);
  END IF;

  SELECT array_agg(DISTINCT a.quote_request_id) INTO live_requests
  FROM public.quote_request_addresses a WHERE a.local_part = ANY (locals) AND a.revoked_at IS NULL;

  IF COALESCE(array_length(live_requests, 1), 0) = 1 THEN
    SELECT * INTO req FROM public.quote_requests WHERE id = live_requests[1];
    SELECT a.local_part INTO chosen_local FROM public.quote_request_addresses a
      WHERE a.quote_request_id = req.id AND a.local_part = ANY (locals) AND a.revoked_at IS NULL LIMIT 1;
  ELSIF COALESCE(array_length(live_requests, 1), 0) > 1 THEN
    reason := 'ambiguous_address';
  ELSIF EXISTS (SELECT 1 FROM public.quote_request_addresses a WHERE a.local_part = ANY (locals)) THEN
    reason := 'revoked_address';
  ELSE
    reason := 'unknown_address';
  END IF;
  IF chosen_local IS NULL THEN
    chosen_local := locals[1];
  END IF;

  -- An advisor's own copied-in message is "sent by hand".
  IF EXISTS (
    SELECT 1 FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id
    WHERE lower(u.email) = from_addr AND r.role IN ('advisor', 'admin')
  ) THEN
    dir := 'sent_by_hand';
  END IF;

  -- A sender not seen on the thread before: not among the earlier senders, and not among the people an earlier
  -- message was addressed to (the PEO contact the advisor wrote to is not a stranger).
  IF req.id IS NOT NULL AND dir = 'received' AND NOT COALESCE(p_is_automatic, false) THEN
    fresh := NOT EXISTS (
      SELECT 1 FROM public.quote_request_messages m
      WHERE m.quote_request_id = req.id
        AND (m.from_address = from_addr OR from_addr = ANY (m.to_addresses) OR from_addr = ANY (m.cc_addresses))
    );
  END IF;

  INSERT INTO public.quote_request_messages (
    provider_message_id, quote_request_id, session_id, address_local_part, held_reason, direction, is_automatic,
    new_sender, from_address, from_name, to_addresses, cc_addresses, subject, body_text, body_truncated, headers, sent_at)
  VALUES (
    p_provider_message_id, req.id, req.session_id, chosen_local, reason, dir, COALESCE(p_is_automatic, false),
    fresh, from_addr, NULLIF(left(btrim(COALESCE(p_from_name, '')), 200), ''),
    COALESCE((SELECT array_agg(lower(btrim(x))) FROM unnest(COALESCE(p_to, '{}')) x), '{}'),
    COALESCE((SELECT array_agg(lower(btrim(x))) FROM unnest(COALESCE(p_cc, '{}')) x), '{}'),
    left(p_subject, 998), p_body_text, COALESCE(p_body_truncated, false), COALESCE(p_headers, '{}'::jsonb), p_sent_at)
  ON CONFLICT (provider_message_id) DO NOTHING
  RETURNING * INTO msg;
  IF msg.id IS NULL THEN
    -- Another call recorded it between the check and the insert.
    SELECT * INTO msg FROM public.quote_request_messages WHERE provider_message_id = p_provider_message_id;
    RETURN jsonb_build_object('message_id', msg.id, 'duplicate', true, 'held', msg.quote_request_id IS NULL,
      'held_reason', msg.held_reason, 'quote_request_id', msg.quote_request_id, 'session_id', msg.session_id);
  END IF;
  RETURN jsonb_build_object('message_id', msg.id, 'duplicate', false, 'held', msg.quote_request_id IS NULL,
    'held_reason', msg.held_reason, 'quote_request_id', msg.quote_request_id, 'session_id', msg.session_id);
END;
$$;

-- Records that a message had this attachment, pending unless it is already known not to be kept. A repeat returns
-- the row as it stands.
CREATE FUNCTION public.record_inbound_attachment(
  p_message_id bigint, p_provider_attachment_id text, p_file_name text, p_content_type text, p_size_bytes bigint,
  p_not_kept_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  att public.quote_request_message_attachments;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_messages WHERE id = p_message_id) THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, content_type, size_bytes, status, not_kept_reason)
  VALUES (p_message_id, p_provider_attachment_id,
          COALESCE(NULLIF(left(btrim(COALESCE(p_file_name, '')), 255), ''), 'attachment'),
          left(p_content_type, 200), GREATEST(COALESCE(p_size_bytes, 0), 0),
          CASE WHEN p_not_kept_reason IS NULL THEN 'pending' ELSE 'not_kept' END, p_not_kept_reason)
  ON CONFLICT (message_id, provider_attachment_id) DO NOTHING;
  SELECT * INTO att FROM public.quote_request_message_attachments
    WHERE message_id = p_message_id AND provider_attachment_id = p_provider_attachment_id;
  RETURN jsonb_build_object('id', att.id, 'status', att.status, 'file_name', att.file_name);
END;
$$;

-- Settles a pending attachment: a clean or skipped scan stores it (at the path the function stored it under), an
-- infected one blocks it, and a file found not to be what it says, or not kept, is listed with its reason. Only a
-- pending attachment changes; a repeat returns the row as it stands.
CREATE FUNCTION public.finish_inbound_attachment(
  p_attachment_id bigint, p_verdict text, p_signature text DEFAULT NULL, p_bucket text DEFAULT NULL, p_path text DEFAULT NULL,
  p_sha256 text DEFAULT NULL, p_not_kept_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  att public.quote_request_message_attachments;
BEGIN
  SELECT * INTO att FROM public.quote_request_message_attachments WHERE id = p_attachment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attachment not found' USING ERRCODE = 'PT404';
  END IF;
  IF att.status <> 'pending' THEN
    RETURN jsonb_build_object('id', att.id, 'status', att.status, 'changed', false);
  END IF;
  IF p_not_kept_reason IS NOT NULL THEN
    UPDATE public.quote_request_message_attachments
    SET status = 'not_kept', not_kept_reason = p_not_kept_reason, updated_at = now() WHERE id = att.id;
  ELSIF p_verdict IN ('clean', 'skipped') THEN
    IF p_bucket IS DISTINCT FROM 'peo-mail' OR COALESCE(p_path, '') = '' THEN
      RAISE EXCEPTION 'A stored attachment needs its place in the peo-mail bucket' USING ERRCODE = '22023';
    END IF;
    UPDATE public.quote_request_message_attachments
    SET status = 'stored', scan_verdict = p_verdict, storage_bucket = p_bucket, storage_path = p_path, sha256 = p_sha256, updated_at = now()
    WHERE id = att.id;
  ELSIF p_verdict = 'infected' THEN
    UPDATE public.quote_request_message_attachments
    SET status = 'blocked', scan_verdict = 'infected', scan_signature = left(p_signature, 200), updated_at = now() WHERE id = att.id;
  ELSE
    RAISE EXCEPTION 'An attachment is settled as clean, skipped, infected or not kept, not %', COALESCE(p_verdict, 'nothing') USING ERRCODE = '22023';
  END IF;
  SELECT * INTO att FROM public.quote_request_message_attachments WHERE id = p_attachment_id;
  RETURN jsonb_build_object('id', att.id, 'status', att.status, 'changed', true);
END;
$$;

-- ---------- An intake's stored files ----------
-- As in 20261104130000_document_scanning.sql, plus the intake's PEO mail attachments, which sit under its id.
CREATE OR REPLACE FUNCTION public.intake_stored_files(p_session_id uuid, p_user_id uuid)
RETURNS TABLE (bucket text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.bucket_id::text, o.name::text
  FROM storage.objects o
  WHERE (o.bucket_id IN ('documents', 'quarantine') AND p_user_id IS NOT NULL
         AND o.name LIKE p_user_id::text || '/' || p_session_id::text || '/%')
     OR (o.bucket_id IN ('manuscripts', 'peo-mail') AND o.name LIKE p_session_id::text || '/%')
  ORDER BY 1, 2;
$$;

REVOKE ALL ON FUNCTION public.intake_stored_files(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_stored_files(uuid, uuid) TO service_role;

-- ---------- Deleting an intake ----------
-- As in 20261111100000_quote_request_addresses.sql, plus the intake's PEO mail: its messages and their attachments.
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
  -- After the pipeline row, which names the winning quote request.
  DELETE FROM public.quote_request_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_events', n);
  DELETE FROM public.quote_request_notes WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_notes', n);
  -- Mail first: its rows name the quote request, and each attachment names its message.
  DELETE FROM public.quote_request_message_attachments a USING public.quote_request_messages m
    WHERE a.message_id = m.id AND m.session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_message_attachments', n);
  DELETE FROM public.quote_request_messages WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_messages', n);
  DELETE FROM public.quote_request_addresses WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_addresses', n);
  DELETE FROM public.quote_requests WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_requests', n);
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
  -- So are the funnel's milestones: how far the intake got stays, with no link to whose it was.
  UPDATE public.intake_milestones SET session_id = NULL WHERE session_id = sid;
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

-- ---------- Who may call what ----------
REVOKE ALL ON FUNCTION public.record_inbound_mail(text, text[], text, text, text[], text[], text, text, boolean, jsonb, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_inbound_mail(text, text[], text, text, text[], text[], text, text, boolean, jsonb, boolean, timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.record_inbound_attachment(bigint, text, text, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_inbound_attachment(bigint, text, text, text, bigint, text) TO service_role;
REVOKE ALL ON FUNCTION public.finish_inbound_attachment(bigint, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_inbound_attachment(bigint, text, text, text, text, text, text) TO service_role;
