-- Reply addresses (joshrkay/Nevermore#92, story M-3.1): the address replies about one quote request are sent to.
--
-- * public.quote_request_addresses: each quote request has one live address at a time. Only the part before the
--   @ is stored; the domain is the receiving subdomain, a setting of the front end and of the function that
--   receives mail. The local part reads <File ID>.<the PEO's short name>.<16 random hex characters>, so an advisor
--   can see it is the right one before pasting it, and nobody can guess it.
-- * advisor_record_quote_send() issues the address when a send is recorded, and keeps the one a quote request
--   already has. There is no new quote request status. Every quote request recorded before this migration gets
--   one now.
-- * advisor_reissue_quote_request_address() revokes the live address and issues a new one. The revoked row stays,
--   so mail to it can be told from mail to an address that never existed. Closing a quote request does not
--   revoke its address: a PEO that answers late still reaches the thread.
-- * Issuing and reissuing are logged in public.quote_request_events (field reply_address, old and new).
-- * complete_intake_deletion() deletes an intake's addresses with the rest of it.
--
-- Advisors read the addresses; prospects read none, even for their own submission. Nothing here receives mail:
-- that is story M-3.2. Until the receiving subdomain is set, the console shows no address.
--
-- Deploy this migration before the front end that shows addresses. The older front end keeps working against it.

SET lock_timeout = '5s';

CREATE TABLE public.quote_request_addresses (
  id bigserial PRIMARY KEY,
  quote_request_id bigint NOT NULL REFERENCES public.quote_requests (id),
  session_id uuid NOT NULL,
  local_part text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid,
  issued_by_email text,
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_by_email text
);

-- Lower case, in the characters every mail system accepts, and no longer than a local part may be.
ALTER TABLE public.quote_request_addresses ADD CONSTRAINT quote_request_addresses_local_part_check CHECK (
  local_part ~ '^[a-z0-9]+([.-][a-z0-9]+)*$' AND char_length(local_part) <= 64
);
-- An address names one quote request for good: a revoked one is never issued again.
CREATE UNIQUE INDEX quote_request_addresses_local_part ON public.quote_request_addresses (local_part);
CREATE UNIQUE INDEX quote_request_addresses_one_live ON public.quote_request_addresses (quote_request_id) WHERE revoked_at IS NULL;
CREATE INDEX quote_request_addresses_by_session ON public.quote_request_addresses (session_id);

ALTER TABLE public.quote_request_addresses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_request_addresses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quote_request_addresses TO authenticated;

CREATE POLICY quote_request_addresses_advisor_read ON public.quote_request_addresses
  FOR SELECT TO authenticated USING (public.is_advisor());

-- A new local part for a quote request: the File ID and the PEO's name reduced to letters and digits, then 64
-- random bits. An intake with no File ID reads "file", and a PEO whose name has no letter or digit reads "peo".
CREATE FUNCTION public.new_quote_request_address(p_file_id text, p_peo text)
RETURNS text LANGUAGE sql VOLATILE SET search_path = public, pg_temp AS $$
  SELECT COALESCE(NULLIF(left(btrim(regexp_replace(lower(COALESCE(p_file_id, '')), '[^a-z0-9]+', '-', 'g'), '-'), 24), ''), 'file')
    || '.' || COALESCE(NULLIF(left(regexp_replace(lower(COALESCE(p_peo, '')), '[^a-z0-9]+', '', 'g'), 20), ''), 'peo')
    || '.' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
$$;

-- Gives a quote request its address if it has no live one, and logs it. Returns the live address either way.
CREATE FUNCTION public.issue_quote_request_address(p_quote_request_id bigint)
RETURNS public.quote_request_addresses LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  req public.quote_requests;
  addr public.quote_request_addresses;
BEGIN
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO addr FROM public.quote_request_addresses WHERE quote_request_id = req.id AND revoked_at IS NULL;
  IF FOUND THEN
    RETURN addr;
  END IF;
  INSERT INTO public.quote_request_addresses (quote_request_id, session_id, local_part, issued_by, issued_by_email)
  VALUES (req.id, req.session_id,
          public.new_quote_request_address((SELECT s.file_id FROM public.chamber_sessions s WHERE s.id = req.session_id), req.peo_name),
          auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO addr;
  INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value, changed_by, changed_by_email)
  VALUES (req.id, req.session_id, 'reply_address', addr.local_part, auth.uid(), auth.jwt() ->> 'email');
  RETURN addr;
END;
$$;

-- Revokes a quote request's address and issues a new one, for an address that leaked or drew junk. Mail to the
-- old one no longer reaches the quote request.
CREATE FUNCTION public.advisor_reissue_quote_request_address(p_quote_request_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  req public.quote_requests;
  old_local text;
  addr public.quote_request_addresses;
BEGIN
  PERFORM public.require_advisor();
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.quote_request_addresses
  SET revoked_at = now(), revoked_by = auth.uid(), revoked_by_email = auth.jwt() ->> 'email'
  WHERE quote_request_id = req.id AND revoked_at IS NULL
  RETURNING local_part INTO old_local;
  INSERT INTO public.quote_request_addresses (quote_request_id, session_id, local_part, issued_by, issued_by_email)
  VALUES (req.id, req.session_id,
          public.new_quote_request_address((SELECT s.file_id FROM public.chamber_sessions s WHERE s.id = req.session_id), req.peo_name),
          auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO addr;
  INSERT INTO public.quote_request_events (quote_request_id, session_id, field, old_value, new_value, changed_by, changed_by_email)
  VALUES (req.id, req.session_id, 'reply_address', old_local, addr.local_part, auth.uid(), auth.jwt() ->> 'email');
  RETURN to_jsonb(addr);
END;
$$;

-- ---------- Recording a send issues the address ----------
-- As in 20261110090000_quote_requests.sql, plus the address.
CREATE OR REPLACE FUNCTION public.advisor_record_quote_send(p_session_id uuid, p_peo text, p_sent_on date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  req public.quote_requests;
  stage text;
  peo text := btrim(COALESCE(p_peo, ''));
BEGIN
  PERFORM public.require_advisor();
  IF peo = '' THEN
    RAISE EXCEPTION 'Name the PEO the packet went to' USING ERRCODE = '22023';
  END IF;
  -- sync:begin quote_peo_length
  IF char_length(peo) > 80 THEN
  -- sync:end quote_peo_length
    RAISE EXCEPTION 'A PEO name is limited to 80 characters' USING ERRCODE = '22023';
  END IF;
  SELECT w.status INTO stage FROM public.submission_workflow w WHERE w.session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  IF stage NOT IN (
    -- sync:begin quote_sendable_stages
    'ready_for_market', 'sent_to_carrier', 'quoted'
    -- sync:end quote_sendable_stages
  ) THEN
    RAISE EXCEPTION 'Move this submission to Ready for market first. It is %', replace(stage, '_', ' ') USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_version, sent_on)
  VALUES (
    p_session_id, peo, 'sent',
    (SELECT max(c.version) FROM public.chamber_certifications c WHERE c.session_id = p_session_id),
    COALESCE(p_sent_on, current_date)
  )
  ON CONFLICT (session_id, lower(peo_name)) DO UPDATE
    SET sent_version = EXCLUDED.sent_version, sent_on = EXCLUDED.sent_on,
        status = CASE WHEN quote_requests.status = 'closed' THEN 'sent' ELSE quote_requests.status END
  RETURNING * INTO req;
  -- The address replies about this quote request are sent to; kept if it already has one.
  PERFORM public.issue_quote_request_address(req.id);
  RETURN to_jsonb(req);
END;
$$;

-- Every quote request recorded before this migration gets its address now.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.quote_requests ORDER BY id LOOP
    PERFORM public.issue_quote_request_address(r.id);
  END LOOP;
END $$;

-- ---------- Deleting an intake ----------
-- As in 20261111090000_quote_request_notes.sql, plus the intake's reply addresses.
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
REVOKE ALL ON FUNCTION public.advisor_reissue_quote_request_address(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_reissue_quote_request_address(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.issue_quote_request_address(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.new_quote_request_address(text, text) FROM PUBLIC, anon, authenticated;
