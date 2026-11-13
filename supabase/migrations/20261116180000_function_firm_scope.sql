-- Every advisor and admin function that reads or changes firm data filters by the caller's firm (story CRM-P2.1b).
--
-- CRM-P2.1a scoped every table and storage policy to the firm, but a SECURITY DEFINER function runs as its owner and sees
-- every firm's rows whatever row security says. Each function below checked only that the caller held the advisor or admin
-- role, so an advisor of one firm, a former member, or a platform admin who is a member of no firm (D-16) could list, change
-- or add to another firm's submissions, quote requests, outbox and records by id. Each now asks the same question the
-- policies ask: is the caller a current member of the firm the row belongs to (is_firm_member, intake_in_my_firm and
-- quote_request_in_my_firm, 20261116110000), taking the firm from the row and never from the caller (D-18). A row of another
-- firm is answered as a row that isn't there. The role is still asked first: whether a member needs it is CRM P-1.4's.
--
-- Left as they were, and why, is in the pull request's inventory: the platform's own functions (the PEO catalogue and profiles,
-- allowed organisations, monitoring counts), a person's own (the prospect's, the mailbox), the service-role work, and what has
-- no submission behind it (referral partners, held mail, mailboxes: CRM-P2.1c).


CREATE OR REPLACE FUNCTION public.advisor_add_quote_request_note(p_quote_request_id bigint, p_kind text, p_noted_on date, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.quote_requests;
  clean_body text;
  note public.quote_request_notes;
BEGIN
  PERFORM public.require_advisor();
  clean_body := public.check_quote_request_note(p_kind, p_noted_on, p_body);
  IF p_noted_on > current_date + 1 THEN
    RAISE EXCEPTION 'A note records something that has happened. Its date can''t be in the future' USING ERRCODE = '22023';
  END IF;
  -- Any status, a closed one included: a PEO that phones after its quote request closed can still be recorded.
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id AND public.quote_request_in_my_firm(id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO public.quote_request_notes (quote_request_id, session_id, kind, noted_on, body, created_by, created_by_email)
  VALUES (req.id, req.session_id, p_kind, p_noted_on, clean_body, auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO note;
  RETURN to_jsonb(note);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_correct_quote_request_note(p_note_id bigint, p_kind text, p_noted_on date, p_body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  clean_body text;
  note public.quote_request_notes;
BEGIN
  PERFORM public.require_advisor();
  clean_body := public.check_quote_request_note(p_kind, p_noted_on, p_body);
  IF p_noted_on > current_date + 1 THEN
    RAISE EXCEPTION 'A note records something that has happened. Its date can''t be in the future' USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_request_notes
  SET kind = p_kind, noted_on = p_noted_on, body = clean_body
  WHERE id = p_note_id AND public.quote_request_in_my_firm(quote_request_id)
  RETURNING * INTO note;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN to_jsonb(note);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_open_quote_request_thread(p_quote_request_id bigint, p_seen_through timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  seen timestamptz := LEAST(COALESCE(p_seen_through, now()), now());
  r public.quote_request_thread_reads;
BEGIN
  PERFORM public.require_advisor();
  IF NOT EXISTS (SELECT 1 FROM public.quote_requests WHERE id = p_quote_request_id AND public.quote_request_in_my_firm(id)) THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO public.quote_request_thread_reads AS t (quote_request_id, last_opened_at, last_opened_by, last_opened_by_email)
  VALUES (p_quote_request_id, seen, auth.uid(), auth.jwt() ->> 'email')
  ON CONFLICT (quote_request_id) DO UPDATE
    SET last_opened_at = GREATEST(t.last_opened_at, EXCLUDED.last_opened_at),
        last_opened_by = CASE WHEN EXCLUDED.last_opened_at > t.last_opened_at THEN EXCLUDED.last_opened_by ELSE t.last_opened_by END,
        last_opened_by_email = CASE WHEN EXCLUDED.last_opened_at > t.last_opened_at THEN EXCLUDED.last_opened_by_email ELSE t.last_opened_by_email END
  RETURNING * INTO r;
  RETURN to_jsonb(r);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_reissue_quote_request_address(p_quote_request_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.quote_requests;
  old_local text;
  addr public.quote_request_addresses;
BEGIN
  PERFORM public.require_advisor();
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id AND public.quote_request_in_my_firm(id) FOR UPDATE;
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
$function$;

CREATE OR REPLACE FUNCTION public.advisor_update_quote_request(p_quote_request_id bigint, p_status text, p_received_on date DEFAULT NULL::date, p_expires_on date DEFAULT NULL::date, p_start_on date DEFAULT NULL::date, p_admin_fee_pepm numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.quote_requests;
BEGIN
  PERFORM public.require_advisor();
  IF p_status IS NULL OR p_status NOT IN ('quoted', 'declined', 'closed') THEN
    RAISE EXCEPTION 'A PEO''s answer is quoted, declined or closed, not %. Record a send to send it again', COALESCE(p_status, 'nothing')
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id AND public.quote_request_in_my_firm(id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  IF char_length(btrim(COALESCE(p_note, ''))) > 2000 THEN
    RAISE EXCEPTION 'A note is limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_admin_fee_pepm < 0 OR p_admin_fee_pepm > 100000 THEN
    RAISE EXCEPTION 'The admin fee is per employee per month, from 0 to 100000' USING ERRCODE = '22023';
  END IF;
  IF req.status = 'closed' AND p_status <> 'closed' THEN
    RAISE EXCEPTION 'This quote request is closed. Record a send to % to reopen it', req.peo_name USING ERRCODE = '22023';
  END IF;
  IF p_status <> 'quoted' AND (p_received_on, p_expires_on, p_start_on, p_admin_fee_pepm) IS DISTINCT FROM (NULL::date, NULL::date, NULL::date, NULL::numeric) THEN
    RAISE EXCEPTION 'Only a quote has dates and a fee. Mark it quoted, or leave them empty' USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_requests
  SET status = p_status,
      quote_received_on = p_received_on,
      quote_expires_on = p_expires_on,
      proposed_start_on = p_start_on,
      admin_fee_pepm = p_admin_fee_pepm,
      note = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_quote_request_id
  RETURNING * INTO req;
  RETURN to_jsonb(req);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_record_quote_send(p_session_id uuid, p_peo text, p_sent_on date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.quote_requests;
  stage text;
  peo text := btrim(COALESCE(p_peo, ''));
BEGIN
  PERFORM public.require_advisor();
  -- A firm's data is the firm's members' alone, whatever the caller's role (D-16, D-18).
  IF NOT public.intake_in_my_firm(p_session_id) THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
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
$function$;
