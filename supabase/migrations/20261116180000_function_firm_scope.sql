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

-- The firm guard every function that takes an intake id runs first: one place, one answer (a row of another firm is a row
-- that isn't there), the error code the function already answered with (PT404 or P0002). Called by functions that run as their
-- owner, never through the API.
CREATE OR REPLACE FUNCTION public.require_intake_in_my_firm(p_session_id uuid, p_errcode text)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- A firm's data is the firm's members' alone, whatever the caller's role (D-16, D-18).
  IF NOT public.intake_in_my_firm(p_session_id) THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = p_errcode;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_intake_in_my_firm(uuid, text) FROM PUBLIC, anon, authenticated;

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
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');
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

CREATE OR REPLACE FUNCTION public.set_submission_status(p_session_id uuid, p_status text, p_note text DEFAULT NULL::text, p_won_quote_request_id bigint DEFAULT NULL::bigint)
 RETURNS submission_workflow
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_row public.submission_workflow;
  previous text;
  allowed text[];
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');
  IF p_status IS NULL OR p_status NOT IN (
    'submitted', 'under_review', 'information_requested', 'ready_for_market', 'sent_to_carrier', 'quoted', 'won', 'lost', 'archived'
  ) THEN
    RAISE EXCEPTION 'Not a status an advisor can set: %', p_status USING ERRCODE = '22023';
  END IF;
  IF length(clean_note) > 2000 THEN
    RAISE EXCEPTION 'Status notes are limited to 2000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF current_row.status = p_status THEN
    RETURN current_row;
  END IF;
  IF p_status <> 'archived' AND NOT public.intake_ever_certified(p_session_id) THEN
    RAISE EXCEPTION 'The prospect hasn''t certified this intake yet, so it can only be archived' USING ERRCODE = '22023';
  END IF;
  allowed := public.pipeline_next_statuses(current_row.status);
  IF NOT p_status = ANY (allowed) THEN
    RAISE EXCEPTION 'A submission can''t move from % to %. From % it can move to: %',
      replace(current_row.status, '_', ' '), replace(p_status, '_', ' '), replace(current_row.status, '_', ' '),
      replace(array_to_string(allowed, ', '), '_', ' ')
      USING ERRCODE = '22023';
  END IF;
  IF p_status = 'won' AND NOT EXISTS (
    SELECT 1 FROM public.quote_requests q
    WHERE q.id = p_won_quote_request_id AND q.session_id = p_session_id AND q.status = 'quoted'
  ) THEN
    RAISE EXCEPTION 'To mark this won, name which of this submission''s quotes the employer took' USING ERRCODE = '22023';
  END IF;
  previous := current_row.status;

  UPDATE public.submission_workflow
  SET status = p_status, updated_at = now(), updated_by = auth.uid(),
      won_quote_request_id = CASE WHEN p_status = 'won' THEN p_won_quote_request_id ELSE won_quote_request_id END
  WHERE session_id = p_session_id
  RETURNING * INTO current_row;

  -- A submission that is won, lost or archived waits on no PEO: close every quote request still open, except the
  -- winner. A decline stays a decline.
  IF p_status IN ('won', 'lost', 'archived') THEN
    UPDATE public.quote_requests
    SET status = 'closed'
    WHERE session_id = p_session_id AND status IN ('sent', 'quoted')
      AND id IS DISTINCT FROM current_row.won_quote_request_id;
  END IF;

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (p_session_id, previous, p_status, clean_note, auth.uid(), auth.jwt() ->> 'email');
  RETURN current_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_submission_needs_action(p_session_id uuid, p_needs_action boolean, p_note text DEFAULT NULL::text)
 RETURNS submission_workflow
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_row public.submission_workflow;
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');
  IF p_needs_action IS NULL THEN
    RAISE EXCEPTION 'Say whether the submission needs advisor action' USING ERRCODE = '22023';
  END IF;
  IF length(clean_note) > 500 THEN
    RAISE EXCEPTION 'A needs-advisor-action note is limited to 500 characters' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  -- Already as asked: nothing to record. Raising it again with another note replaces the note.
  IF current_row.needs_action = p_needs_action
     AND (NOT p_needs_action OR current_row.needs_action_note IS NOT DISTINCT FROM clean_note) THEN
    RETURN current_row;
  END IF;

  UPDATE public.submission_workflow
  SET needs_action = p_needs_action,
      needs_action_note = CASE WHEN p_needs_action THEN clean_note END,
      needs_action_at = now(),
      needs_action_by = auth.uid(),
      needs_action_by_email = auth.jwt() ->> 'email'
  WHERE session_id = p_session_id
  RETURNING * INTO current_row;

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (
    p_session_id, current_row.status, current_row.status,
    CASE WHEN p_needs_action THEN 'Marked as needing advisor action' ELSE 'Cleared: no longer needs advisor action' END
      || COALESCE(': ' || clean_note, ''),
    auth.uid(), auth.jwt() ->> 'email'
  );
  RETURN current_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_submission_field(p_session_id uuid, p_field text, p_review_state text, p_correction text DEFAULT 'keep'::text, p_value jsonb DEFAULT NULL::jsonb, p_reason text DEFAULT NULL::text, p_answer jsonb DEFAULT NULL::jsonb)
 RETURNS advisor_field_reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.chamber_sessions;
  prev public.advisor_field_reviews;
  next_row public.advisor_field_reviews;
  clean_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  next_has boolean;
  next_value jsonb;
BEGIN
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');
  IF NOT public.is_reviewable_field(p_field) THEN
    RAISE EXCEPTION 'Unknown field: %', p_field USING ERRCODE = '22023';
  END IF;
  IF p_review_state IS NOT NULL AND p_review_state NOT IN ('verified', 'incomplete', 'follow_up') THEN
    RAISE EXCEPTION 'Unknown review state: %', p_review_state USING ERRCODE = '22023';
  END IF;
  IF p_correction NOT IN ('keep', 'set', 'clear') THEN
    RAISE EXCEPTION 'Unknown correction action: %', p_correction USING ERRCODE = '22023';
  END IF;
  IF p_correction = 'set' AND p_field IN ('census', 'employees') THEN
    RAISE EXCEPTION 'The census is corrected with the prospect, not here' USING ERRCODE = '22023';
  END IF;
  IF p_correction <> 'keep' AND clean_reason IS NULL THEN
    RAISE EXCEPTION 'A correction needs a reason' USING ERRCODE = '22023';
  END IF;
  IF length(clean_reason) > 2000 THEN
    RAISE EXCEPTION 'Reasons are limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_answer IS NOT NULL AND jsonb_typeof(p_answer) <> 'object' THEN
    RAISE EXCEPTION 'The answer reviewed must be given as {"value": ...}' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_answer IS NOT NULL
     AND (p_answer -> 'value') IS DISTINCT FROM (public.advisor_visible_answers(s.status, s.submission, s.chamber_data) -> p_field) THEN
    RAISE EXCEPTION 'The prospect changed this answer after the page was loaded; review the current answer'
      USING ERRCODE = 'PT409';
  END IF;

  SELECT * INTO prev FROM public.advisor_field_reviews
  WHERE session_id = p_session_id AND field = p_field FOR UPDATE;

  next_has := CASE p_correction WHEN 'set' THEN true WHEN 'clear' THEN false ELSE COALESCE(prev.has_correction, false) END;
  next_value := CASE p_correction WHEN 'set' THEN p_value WHEN 'clear' THEN NULL ELSE prev.corrected_value END;

  INSERT INTO public.advisor_field_reviews AS r
    (session_id, field, review_state, has_correction, corrected_value, reason, updated_by, updated_by_email, updated_at,
     answer_changed_at, answer_changed_from)
  VALUES
    (p_session_id, p_field, p_review_state, next_has, next_value,
     CASE WHEN p_correction = 'keep' THEN COALESCE(clean_reason, prev.reason) ELSE clean_reason END,
     auth.uid(), auth.jwt() ->> 'email', now(), NULL, NULL)
  ON CONFLICT (session_id, field) DO UPDATE SET
    review_state = EXCLUDED.review_state,
    has_correction = EXCLUDED.has_correction,
    corrected_value = EXCLUDED.corrected_value,
    reason = EXCLUDED.reason,
    updated_by = EXCLUDED.updated_by,
    updated_by_email = EXCLUDED.updated_by_email,
    updated_at = EXCLUDED.updated_at,
    answer_changed_at = NULL,
    answer_changed_from = NULL
  RETURNING * INTO next_row;

  INSERT INTO public.advisor_review_events
    (session_id, field, from_state, to_state, correction_changed, from_value, to_value,
     had_correction, has_correction, reason, actor_id, actor_email)
  VALUES
    (p_session_id, p_field, prev.review_state, next_row.review_state,
     COALESCE(prev.has_correction, false) IS DISTINCT FROM next_row.has_correction
       OR prev.corrected_value IS DISTINCT FROM next_row.corrected_value,
     prev.corrected_value, next_row.corrected_value,
     COALESCE(prev.has_correction, false), next_row.has_correction,
     clean_reason, auth.uid(), auth.jwt() ->> 'email');

  RETURN next_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_manuscript_version(p_session_id uuid, p_version integer, p_storage_path text, p_pdf_sha256 text, p_review_event_id bigint, p_corrections_applied integer, p_sensitive_revealed boolean, p_certified_data_hash text, p_certified_at timestamp with time zone)
 RETURNS manuscript_versions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.chamber_sessions;
  latest_event bigint;
  next_version integer;
  result public.manuscript_versions;
BEGIN
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');

  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF s.status IS DISTINCT FROM 'submitted' OR s.submission IS NULL THEN
    RAISE EXCEPTION 'Only a certified intake can become a packet' USING ERRCODE = '23514';
  END IF;
  IF p_certified_data_hash IS DISTINCT FROM (s.submission ->> 'data_sha256')
     OR p_certified_at IS DISTINCT FROM (s.submission ->> 'certified_at')::timestamptz THEN
    RAISE EXCEPTION 'The prospect certified their intake again while this packet was being generated; generate it again'
      USING ERRCODE = 'PT409';
  END IF;
  IF p_storage_path IS NULL OR p_storage_path NOT LIKE p_session_id::text || '/%' THEN
    RAISE EXCEPTION 'The file must be stored under its submission' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = p_storage_path) THEN
    RAISE EXCEPTION 'The packet file was not uploaded' USING ERRCODE = '22023';
  END IF;

  -- One version number at a time per submission.
  PERFORM pg_advisory_xact_lock(hashtext('manuscript_versions:' || p_session_id::text));

  SELECT COALESCE(max(id), 0) INTO latest_event FROM public.advisor_review_events WHERE session_id = p_session_id;
  IF p_review_event_id IS DISTINCT FROM latest_event THEN
    RAISE EXCEPTION 'The review changed while this packet was being generated; generate it again'
      USING ERRCODE = 'PT409';
  END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO next_version FROM public.manuscript_versions WHERE session_id = p_session_id;
  IF p_version IS DISTINCT FROM next_version THEN
    RAISE EXCEPTION 'Another version was generated meanwhile; generate it again' USING ERRCODE = 'PT409';
  END IF;

  INSERT INTO public.manuscript_versions
    (session_id, version, file_id, storage_path, pdf_sha256, certified_data_hash, certified_signed_at, certified_at,
     review_event_id, corrections_applied, sensitive_revealed, generated_by, generated_by_email)
  VALUES
    (p_session_id, next_version,
     COALESCE(NULLIF(s.submission ->> 'file_id', ''), 'EAA-' || upper(left(replace(p_session_id::text, '-', ''), 8))),
     p_storage_path, lower(p_pdf_sha256),
     COALESCE(s.submission ->> 'data_sha256', encode(sha256(convert_to(s.chamber_data::text, 'UTF8')), 'hex')),
     (s.submission ->> 'signed_at')::timestamptz,
     (s.submission ->> 'certified_at')::timestamptz,
     latest_event, GREATEST(COALESCE(p_corrections_applied, 0), 0), COALESCE(p_sensitive_revealed, false),
     auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO result;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_request_information(p_session_id uuid, p_message text, p_fields text[] DEFAULT '{}'::text[], p_extra_questions jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  questions jsonb := COALESCE(p_extra_questions, '[]'::jsonb);
  q jsonb;
BEGIN
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');

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

  -- The PEOs' own questions it names: each a question of a listed PEO's profile in use, by its key and as worded.
  IF jsonb_typeof(questions) <> 'array' THEN
    RAISE EXCEPTION 'A request names a PEO''s questions as a list' USING ERRCODE = '22023';
  END IF;
  -- sync:begin request_max_extra_questions
  IF jsonb_array_length(questions) > 60 THEN
  -- sync:end request_max_extra_questions
    RAISE EXCEPTION 'A request can name at most 60 of the PEOs'' own questions' USING ERRCODE = '22023';
  END IF;
  FOR q IN SELECT x FROM jsonb_array_elements(questions) x LOOP
    IF jsonb_typeof(q) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(q) k WHERE k NOT IN ('peo_id', 'key', 'question'))
       OR jsonb_typeof(q -> 'peo_id') IS DISTINCT FROM 'number' OR jsonb_typeof(q -> 'key') IS DISTINCT FROM 'string'
       OR jsonb_typeof(q -> 'question') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Each of a PEO''s questions is named by the PEO, its key and its wording' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.peos p
      CROSS JOIN LATERAL (
        SELECT v.extra_questions FROM public.peo_profile_versions v
        WHERE v.peo_id = p.id AND v.status = 'published' ORDER BY v.version DESC LIMIT 1
      ) in_use
      CROSS JOIN LATERAL jsonb_array_elements(in_use.extra_questions) asked
      WHERE p.id = (q ->> 'peo_id')::numeric AND p.listed
        AND asked ->> 'key' = q ->> 'key' AND asked ->> 'text' = q ->> 'question'
    ) THEN
      RAISE EXCEPTION 'Not a question that PEO''s profile asks, as worded: %', q ->> 'question' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  -- The PEO compared as a number, so 5 and 5.0 are the same PEO.
  IF (SELECT count(*) FROM jsonb_array_elements(questions)) <> (SELECT count(DISTINCT ((x ->> 'peo_id')::numeric, x ->> 'key')) FROM jsonb_array_elements(questions) x) THEN
    RAISE EXCEPTION 'A request names each question once' USING ERRCODE = '22023';
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

  INSERT INTO public.information_requests (session_id, message, fields, extra_questions, requested_by, requested_by_email)
  VALUES (p_session_id, clean_message, clean_fields, questions, auth.uid(), auth.jwt() ->> 'email')
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

  -- Unlike the certification emails, this one is the point of the call: a failure to queue it fails the request. It
  -- carries the fields' labels as before, and never a PEO's questions: the email names no PEO.
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
$function$;

CREATE OR REPLACE FUNCTION public.session_verified_fields(p_session_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT v.field ORDER BY v.field), '{}'::text[])
  FROM (
    SELECT CASE WHEN r.field = 'employees' THEN 'census' ELSE r.field END AS field
    FROM public.advisor_field_reviews r
    JOIN public.chamber_sessions s ON s.id = r.session_id
    WHERE r.session_id = p_session_id
      AND r.review_state = 'verified'
      AND (
        (s.user_id = auth.uid() AND s.status NOT IN ('archived', 'revoked'))
        OR (public.is_advisor() AND public.intake_in_my_firm(s.id))
      )
      AND (r.field <> 'employees' OR NOT EXISTS (
        SELECT 1 FROM public.advisor_field_reviews c WHERE c.session_id = r.session_id AND c.field = 'census'
      ))
  ) v;
$function$;

CREATE OR REPLACE FUNCTION public.request_intake_deletion(p_session_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  intake public.chamber_sessions;
  clean_reason constant text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  deletion_id uuid;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason IS NULL OR length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'A reason of 1 to 500 characters is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO intake FROM public.chamber_sessions WHERE id = p_session_id AND public.intake_in_my_firm(id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake not found' USING ERRCODE = 'PT404';
  END IF;

  INSERT INTO public.intake_deletions (session_id, user_id, trigger, reason, requested_by, requested_by_email)
  VALUES (intake.id, intake.user_id, 'request', clean_reason, auth.uid(), auth.jwt() ->> 'email')
  ON CONFLICT (session_id) WHERE status <> 'done' DO NOTHING
  RETURNING id INTO deletion_id;

  IF deletion_id IS NULL THEN
    SELECT d.id INTO deletion_id FROM public.intake_deletions d WHERE d.session_id = intake.id AND d.status <> 'done';
  END IF;
  RETURN deletion_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_chamber_session(p_session_id uuid, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  intake public.chamber_sessions;
  clean_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason IS NULL OR length(clean_reason) > 2000 THEN
    RAISE EXCEPTION 'A reason of 1 to 2000 characters is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO intake FROM public.chamber_sessions WHERE id = p_session_id AND public.intake_in_my_firm(id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake not found' USING ERRCODE = 'PT404';
  END IF;
  IF intake.status = 'revoked' THEN
    RETURN 'revoked';
  END IF;
  IF intake.status NOT IN ('in_progress', 'expired')
     OR EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = intake.id) THEN
    RAISE EXCEPTION 'Only a draft that was never certified can be revoked (this intake is %)', intake.status
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.chamber_sessions SET status = 'revoked' WHERE id = intake.id;
  INSERT INTO public.intake_lifecycle_events (session_id, user_id, from_status, to_status, reason, actor_id, actor_email)
  VALUES (intake.id, intake.user_id, intake.status, 'revoked', clean_reason, auth.uid(), auth.jwt() ->> 'email');
  RETURN 'revoked';
END;
$function$;

CREATE OR REPLACE FUNCTION public.retry_intake_deletion(p_deletion_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.intake_deletions
  SET status = 'pending', attempts = 0, next_attempt_at = now(), locked_until = NULL
  WHERE id = p_deletion_id AND status = 'failed' AND public.is_firm_member(firm_id);
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_email_problems()
 RETURNS TABLE(session_id uuid, reason text, since timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  RETURN QUERY
  SELECT DISTINCT ON (e.session_id) e.session_id, s.reason, s.created_at
  FROM public.outbox_events e
  JOIN public.email_suppressions s ON s.address = lower(btrim(e.payload ->> 'recipient_email'))
  WHERE public.outbox_kind_reaches_prospect(e.kind)
    AND public.intake_in_my_firm(e.session_id)
  ORDER BY e.session_id, s.updated_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_list_outbox_events(p_status text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, kind text, status text, attempts integer, next_attempt_at timestamp with time zone, claimed_at timestamp with time zone, claim_lapsed boolean, last_error text, provider_message_id text, created_at timestamp with time zone, sent_at timestamp with time zone, session_id uuid, company_name text, reference text, resubmission boolean, frozen boolean, requeue_count integer, last_requeued_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  WHERE (p_status IS NULL OR e.status = p_status)
    AND public.intake_in_my_firm(e.session_id)
  ORDER BY e.created_at DESC, e.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_outbox_summary()
 RETURNS TABLE(status text, events bigint, oldest_due_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  RETURN QUERY
  SELECT v.status, count(e.id), min(e.next_attempt_at) FILTER (WHERE v.status = 'pending' AND e.next_attempt_at <= now())
  FROM (VALUES ('pending'), ('claimed'), ('sent'), ('dead'), ('suppressed')) AS v(status)
  LEFT JOIN public.outbox_events e ON e.status = v.status AND public.intake_in_my_firm(e.session_id)
  GROUP BY v.status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_requeue_outbox_event(event_id uuid, rebuild_payload boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_advisor();
  IF event_id IS NULL THEN
    RAISE EXCEPTION 'an event id is required' USING ERRCODE = '22023';
  END IF;
  -- An email of another firm's intake is none the caller can see, so there is nothing to retry.
  IF NOT EXISTS (SELECT 1 FROM public.outbox_events e WHERE e.id = event_id AND public.intake_in_my_firm(e.session_id)) THEN
    RETURN false;
  END IF;
  RETURN public.requeue_outbox_event(event_id, COALESCE(rebuild_payload, false), auth.uid());
END;
$function$;

CREATE OR REPLACE FUNCTION public.retention_review_due(p_limit integer DEFAULT 100)
 RETURNS TABLE(session_id uuid, file_id text, last_certified_at timestamp with time zone, review_due_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_advisor();
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 1000' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT c.session_id,
           (array_agg(c.file_id ORDER BY c.recorded_at DESC))[1],
           max(c.recorded_at),
           max(c.recorded_at) + public.submitted_record_retention()
    FROM public.chamber_certifications c
    WHERE public.intake_in_my_firm(c.session_id)
      AND NOT EXISTS (SELECT 1 FROM public.intake_deletions d WHERE d.session_id = c.session_id AND d.status <> 'done')
    GROUP BY c.session_id
    HAVING max(c.recorded_at) + public.submitted_record_retention() <= now()
    ORDER BY max(c.recorded_at), c.session_id
    LIMIT p_limit;
END;
$function$;

-- ---------- The funnel's steps belong to a firm even after their intake is deleted ----------
-- intake_milestones.session_id goes null when an intake is deleted (the steps are kept, without the link), so the
-- firm can't be asked of the intake. Each step carries its firm, set from the intake when written, never moved.
ALTER TABLE public.intake_milestones ADD COLUMN firm_id uuid REFERENCES public.firms(id) ON DELETE SET NULL;
UPDATE public.intake_milestones m SET firm_id = s.firm_id FROM public.chamber_sessions s WHERE s.id = m.session_id;
-- Steps of intakes deleted before this migration have no link left. Every intake belonged to Edgar Allan Advisory until now
-- (CRM P-1.1), so those steps are its own: nobody loses sight of a submission (D-15).
CREATE FUNCTION public.backfill_intake_milestone_firms()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.intake_milestones SET firm_id = public.default_firm_id() WHERE session_id IS NULL AND firm_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_intake_milestone_firms() FROM PUBLIC, anon, authenticated;
SELECT public.backfill_intake_milestone_firms();
CREATE OR REPLACE FUNCTION public.intake_milestone_firm()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    -- A linked step is always in its intake's firm: read at insert. No lock on the intake is taken: nothing a person or a job
    -- can do today changes an intake's firm after it is made (keep_intake_firm freezes it for the API roles; no function sets
    -- it), so there is no move to wait for (D-32). The story that first lets an intake move between firms must add a lock
    -- (FOR SHARE on this read) back with a two-session test.
    NEW.firm_id := (SELECT s.firm_id FROM public.chamber_sessions s WHERE s.id = NEW.session_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.firm_id IS NOT NULL AND OLD.firm_id IS NOT NULL THEN
    -- The intake went (the link goes null) and the step stays in its firm (a firm-less step may be given one: the backfill). A null firm_id is let through: it is the
    -- foreign key emptying it because the firm itself was deleted.
    NEW.firm_id := OLD.firm_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intake_milestone_firm() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER intake_milestones_firm BEFORE INSERT OR UPDATE ON public.intake_milestones
  FOR EACH ROW EXECUTE FUNCTION public.intake_milestone_firm();

-- Placing an intake in another firm moves the steps linked to it.
CREATE OR REPLACE FUNCTION public.intake_firm_to_milestones()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.intake_milestones SET firm_id = NEW.firm_id WHERE session_id = NEW.id AND firm_id IS DISTINCT FROM NEW.firm_id;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.intake_firm_to_milestones() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER chamber_sessions_milestone_firm AFTER UPDATE OF firm_id ON public.chamber_sessions
  FOR EACH ROW WHEN (OLD.firm_id IS DISTINCT FROM NEW.firm_id) EXECUTE FUNCTION public.intake_firm_to_milestones();

CREATE OR REPLACE FUNCTION public.advisor_intake_funnel(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(step integer, milestone text, intakes bigint, median_minutes numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'The period must start before it ends' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > interval '366 days' THEN
    RAISE EXCEPTION 'The funnel covers at most a year at once' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT s.ord::integer, s.name,
           count(m.id),
           round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM m.reached_at - m.started_at) / 60)
                  FILTER (WHERE NOT m.backfilled))::numeric, 1)
    FROM unnest(ARRAY[
      'started', 'answered', 'document_uploaded', 'census_provided', 'ready_to_certify', 'email_verified', 'certified', 'manuscript_downloaded'
    ]) WITH ORDINALITY AS s(name, ord)
    LEFT JOIN public.intake_milestones m
      ON m.milestone = s.name AND m.started_at >= p_from AND m.started_at < p_to
     AND public.is_firm_member(m.firm_id)
    GROUP BY s.ord, s.name
    ORDER BY s.ord;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_intake_sources(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(referral_code text, partner_name text, utm_source text, utm_medium text, utm_campaign text, started bigint, answered bigint, document_uploaded bigint, census_provided bigint, ready_to_certify bigint, email_verified bigint, certified bigint, manuscript_downloaded bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'The period must start before it ends' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > interval '366 days' THEN
    RAISE EXCEPTION 'The funnel covers at most a year at once' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign,
           count(*) FILTER (WHERE m.milestone = 'started'),
           count(*) FILTER (WHERE m.milestone = 'answered'),
           count(*) FILTER (WHERE m.milestone = 'document_uploaded'),
           count(*) FILTER (WHERE m.milestone = 'census_provided'),
           count(*) FILTER (WHERE m.milestone = 'ready_to_certify'),
           count(*) FILTER (WHERE m.milestone = 'email_verified'),
           count(*) FILTER (WHERE m.milestone = 'certified'),
           count(*) FILTER (WHERE m.milestone = 'manuscript_downloaded')
    FROM public.intake_milestones m
    LEFT JOIN public.referral_partners p ON p.code = m.referral_code
    WHERE m.started_at >= p_from AND m.started_at < p_to AND public.is_firm_member(m.firm_id)
    GROUP BY m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign
    ORDER BY count(*) FILTER (WHERE m.milestone = 'started') DESC,
             m.referral_code NULLS LAST, m.utm_source NULLS LAST, m.utm_medium NULLS LAST, m.utm_campaign NULLS LAST
    LIMIT 200;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advisor_list_submissions(p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT NULL::integer, p_offset integer DEFAULT 0, p_needs_action boolean DEFAULT NULL::boolean, p_waiting boolean DEFAULT NULL::boolean, p_sort text DEFAULT NULL::text)
 RETURNS TABLE(session_id uuid, company_name text, contact_name text, employee_count integer, pipeline_status text, intake_status text, signer_name text, submitted_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, missing_required text[], open_fields integer, flagged_fields integer, verified_fields integer, file_id text, states text[], needs_action boolean, needs_action_note text, quote_requests_sent integer, quotes_received integer, oldest_waiting_on date, earliest_quote_expires_on date, sent_older_version boolean, new_peo_mail_requests integer, start_month text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  terms text[] := ARRAY(
    SELECT lower(t) FROM regexp_split_to_table(btrim(COALESCE(p_search, '')), '\s+') AS t WHERE t <> ''
  );
BEGIN
  PERFORM public.require_advisor();
  IF p_limit IS NOT NULL AND (p_limit < 1 OR p_limit > 500) THEN
    RAISE EXCEPTION 'A page holds 1 to 500 submissions' USING ERRCODE = '22023';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'The page offset can''t be negative' USING ERRCODE = '22023';
  END IF;
  IF p_sort IS NOT NULL AND p_sort NOT IN ('oldest_waiting', 'earliest_expiry') THEN
    RAISE EXCEPTION 'The queue sorts by oldest_waiting or earliest_expiry, not %', p_sort USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      s.user_id,
      s.status,
      s.created_at,
      s.updated_at,
      s.submission,
      s.file_id,
      -- Who signed: the certification in force, or, once it was withdrawn, the latest on record. Never a
      -- submission the browser wrote (S-1; since 20261106090000 only certifying writes one).
      CASE WHEN snap.used THEN NULLIF(btrim(s.submission ->> 'signer_name'), '')
        ELSE (SELECT NULLIF(btrim(c.signer_name), '') FROM public.chamber_certifications c
               WHERE c.session_id = s.id ORDER BY c.recorded_at DESC, c.id DESC LIMIT 1)
      END AS signer,
      w.status AS pipeline,
      w.needs_action AS action_needed,
      w.needs_action_note AS action_note,
      CASE WHEN s.status = 'submitted' THEN (s.submission ->> 'certified_at')::timestamptz END AS certified_at,
      -- The copy the advisor sees, answers and provenance together: the certified snapshot while
      -- certified, otherwise as it stands. The same test as public.advisor_visible_answers.
      CASE WHEN snap.used THEN s.submission -> 'chamber_data' ELSE s.chamber_data END AS shown,
      CASE WHEN snap.used THEN s.submission -> 'field_provenance' ELSE s.field_provenance END AS prov
    FROM public.chamber_sessions s
    JOIN public.submission_workflow w ON w.session_id = s.id
    LEFT JOIN auth.users u ON u.id = s.user_id
    CROSS JOIN LATERAL (
      SELECT s.status = 'submitted'
         AND jsonb_typeof(s.submission) = 'object'
         AND btrim(COALESCE(s.submission ->> 'signer_name', '')) <> ''
         AND s.submission ? 'chamber_data' AS used
    ) snap
    WHERE public.is_firm_member(s.firm_id)
      AND (p_status IS NULL OR w.status = p_status)
      AND (p_needs_action IS NULL OR w.needs_action = p_needs_action)
      -- Waiting on a PEO: a quote request sent and not yet answered.
      AND (p_waiting IS NULL OR p_waiting = EXISTS (
        SELECT 1 FROM public.quote_requests q WHERE q.session_id = s.id AND q.status = 'sent'
      ))
      -- Not an empty guest draft (F-2.1): a guest's intake, never certified, that holds nothing the prospect did.
      -- Since A-1 an intake is created only by the prospect's first action, so these are left from before then.
      AND NOT (
        COALESCE(u.is_anonymous, false)
        AND NOT public.intake_ever_certified(s.id)
        AND public.intake_holds_nothing(s.chamber_data, s.field_provenance, s.transcript, s.chosen_peo)
        AND NOT EXISTS (SELECT 1 FROM public.documents doc WHERE doc.session_id = s.id)
      )
  ),
  shaped AS (
    SELECT
      b.*,
      CASE WHEN jsonb_typeof(b.shown) = 'object' THEN b.shown ELSE '{}'::jsonb END AS d,
      CASE WHEN jsonb_typeof(b.prov) = 'object' THEN b.prov ELSE '{}'::jsonb END AS fp,
      p.company_name AS profile_company,
      p.contact_name AS profile_contact
    FROM base b
    LEFT JOIN public.profiles p ON p.user_id = b.user_id
  ),
  described AS (
    SELECT
      x.*,
      -- The census, or the roster an intake saved before the census contract.
      CASE
        WHEN jsonb_typeof(x.d -> 'census') = 'array' THEN x.d -> 'census'
        WHEN jsonb_typeof(x.d -> 'employees') = 'array' THEN x.d -> 'employees'
        ELSE '[]'::jsonb
      END AS roster,
      -- At most 200 characters of each: a page lists up to 500 rows (S-3).
      left(COALESCE(NULLIF(btrim(x.d ->> 'company_name'), ''), NULLIF(btrim(x.profile_company), '')), 200) AS company,
      left(COALESCE(NULLIF(btrim(x.profile_contact), ''), x.signer), 200) AS contact,
      -- The File ID the database assigned (S-1), kept when a certification is withdrawn.
      NULLIF(btrim(x.file_id), '') AS certified_file_id
    FROM shaped x
  ),
  matched AS (
    SELECT r.*
    FROM described r
    -- Every word must appear in the company, the contact or the reference the queue shows (the
    -- certified file id, or the one the app derives for a draft: EAA-<year>-<first 8 hex of the id>).
    WHERE NOT EXISTS (
      SELECT 1 FROM unnest(terms) AS t
      WHERE strpos(
        lower(concat_ws(E'\n', r.company, r.contact, COALESCE(
          r.certified_file_id,
          'EAA-' || extract(year FROM r.created_at AT TIME ZONE 'UTC')::int || '-' || upper(left(replace(r.id::text, '-', ''), 8))
        ))),
        t
      ) = 0
    )
  )
  SELECT
    m.id,
    m.company,
    m.contact,
    CASE WHEN jsonb_typeof(m.d -> 'employee_count') = 'number' THEN (m.d ->> 'employee_count')::numeric::integer END,
    m.pipeline,
    m.status,
    left(m.signer, 200),
    m.certified_at,
    m.created_at,
    m.updated_at,
    -- The required items still missing, in order (public.intake_required_items, 20261104103000: the
    -- recommended census is never one), less any the advisor supplied through a verified correction with
    -- a value, which the advisor's Manuscript shows. A verification alone supplies nothing.
    ARRAY(
      SELECT ri.item ->> 'label'
      FROM jsonb_array_elements(public.intake_required_items(m.d, m.fp, '{}'::text[])) WITH ORDINALITY AS ri(item, ord)
      WHERE ri.item ->> 'state' = 'missing' AND (ri.item ->> 'required')::boolean
        AND NOT public.advisor_supplied(m.id, ri.item ->> 'field')
      ORDER BY ri.ord
    ),
    -- The other open items, as Review and The Manuscript list them (src/data/openItems.ts): reviewable fields whose
    -- status leaves them open, less a required answer still missing (missing_required names it, so one the prospect
    -- doesn't know is one open item, not two), less the census when none is uploaded (a document, which the queue
    -- never lists), and less any field an advisor verified. A field closed as not applicable is never counted.
    -- The census matches a review under either of its names.
    (SELECT count(*)::integer
       FROM jsonb_each(m.fp) f
      WHERE f.value ->> 'status' IN (
          -- sync:begin open_item_statuses
          'conflicting', 'incomplete', 'unknown', 'inferred'
          -- sync:end open_item_statuses
        )
        AND public.is_reviewable_field(f.key)
        AND NOT (f.key IN ('census', 'employees') AND jsonb_array_length(m.roster) = 0)
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(public.intake_required_items(m.d, m.fp, '{}'::text[])) AS ri(item)
          WHERE ri.item ->> 'state' = 'missing' AND (ri.item ->> 'required')::boolean
            AND ri.item ->> 'field' = f.key
            AND NOT public.advisor_supplied(m.id, ri.item ->> 'field')
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.advisor_field_reviews r
          WHERE r.session_id = m.id AND r.review_state = 'verified'
            AND (r.field = f.key OR (r.field IN ('census', 'employees') AND f.key IN ('census', 'employees')))
        )),
    (SELECT count(*)::integer FROM public.advisor_field_reviews r
      WHERE r.session_id = m.id AND r.review_state IN ('incomplete', 'follow_up')),
    (SELECT count(*)::integer FROM public.advisor_field_reviews r
      WHERE r.session_id = m.id AND r.review_state = 'verified'),
    m.certified_file_id,
    ARRAY(
      SELECT DISTINCT upper(btrim(y.st)) AS abbr
      FROM (
        SELECT st FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(m.d -> 'states') = 'array' THEN m.d -> 'states' ELSE '[]'::jsonb END) AS st
        UNION ALL
        SELECT COALESCE(e ->> 'work_state', e ->> 'state') FROM jsonb_array_elements(m.roster) AS e
      ) y
      WHERE btrim(COALESCE(y.st, '')) <> ''
      ORDER BY abbr
    ),
    m.action_needed,
    m.action_note,
    qs.sent,
    qs.received,
    qs.waiting_since,
    qs.expires,
    qs.older,
    qs.new_mail,
    left(NULLIF(btrim(m.d ->> 'start_month'), ''), 200),
    count(*) OVER ()
  FROM matched m
  CROSS JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE q.status <> 'closed')::integer AS sent,
      count(*) FILTER (WHERE q.status = 'quoted')::integer AS received,
      min(q.sent_on) FILTER (WHERE q.status = 'sent') AS waiting_since,
      min(q.quote_expires_on) FILTER (WHERE q.status = 'quoted') AS expires,
      COALESCE(bool_or(q.sent_version < (
        SELECT max(c.version) FROM public.chamber_certifications c WHERE c.session_id = m.id
      )) FILTER (WHERE q.status IN ('sent', 'quoted')), false) AS older,
      -- Mail a person at the PEO wrote (not an automatic reply, not an advisor's own copied-in message) that arrived
      -- after any advisor last opened that quote request's thread; held mail belongs to no quote request.
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM public.quote_request_messages x
        WHERE x.quote_request_id = q.id AND x.direction = 'received' AND NOT x.is_automatic
          AND x.recorded_at > COALESCE((SELECT r.last_opened_at FROM public.quote_request_thread_reads r WHERE r.quote_request_id = q.id), '-infinity'::timestamptz)
      ))::integer AS new_mail
    FROM public.quote_requests q
    WHERE q.session_id = m.id
  ) qs
  -- Certified is the intake's status; its date only orders the group. Rows submitted before the
  -- server stamped certifications have no certified_at: they stay in the group, after the stamped ones.
  ORDER BY
    CASE WHEN p_sort = 'oldest_waiting' THEN qs.waiting_since END ASC NULLS LAST,
    CASE WHEN p_sort = 'earliest_expiry' THEN qs.expires END ASC NULLS LAST,
    (m.status = 'submitted') DESC, m.certified_at DESC NULLS LAST, m.updated_at DESC, m.id
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- A failure report keeps an intake only if it is the reporter's own or of the reporter's firm: the role alone opens no firm's data.
CREATE OR REPLACE FUNCTION public.report_client_event(
  p_kind text,
  p_code text DEFAULT NULL,
  p_detail text DEFAULT NULL,
  p_route text DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid constant uuid := auth.uid();
  -- sync:begin ops_report_caps
  per_account constant integer := 30;
  signed_out constant integer := 200;
  everyone constant integer := 2000;
  -- sync:end ops_report_caps
  recent integer;
  keep_session uuid;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('app_error', 'upload_failed', 'ai_failed', 'auth_denied', 'voice_failed') THEN
    RAISE EXCEPTION 'Unknown event kind' USING ERRCODE = '22023';
  END IF;

  IF uid IS NOT NULL THEN
    SELECT count(*) INTO recent FROM public.ops_events
    WHERE user_id = uid AND source = 'browser' AND created_at > now() - interval '1 hour';
    IF recent >= per_account THEN RETURN false; END IF;
  ELSE
    SELECT count(*) INTO recent FROM public.ops_events
    WHERE user_id IS NULL AND source = 'browser' AND created_at > now() - interval '1 hour';
    IF recent >= signed_out THEN RETURN false; END IF;
  END IF;
  SELECT count(*) INTO recent FROM public.ops_events
  WHERE source = 'browser' AND created_at > now() - interval '1 hour';
  IF recent >= everyone THEN RETURN false; END IF;

  -- Only an intake the caller may read: their own, or one of their own firm. Anything else is dropped, so
  -- the table never links an account to an intake it has nothing to do with (D-16, D-18).
  IF p_session_id IS NOT NULL AND uid IS NOT NULL
     AND (public.intake_in_my_firm(p_session_id) OR EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = p_session_id AND s.user_id = uid)) THEN
    keep_session := p_session_id;
  END IF;

  INSERT INTO public.ops_events (kind, source, code, detail, route, user_id, session_id)
  VALUES (
    p_kind,
    'browser',
    public.ops_clean_code(p_code),
    public.ops_redact(p_detail, 300),
    -- The path only: a query string or fragment can carry a token.
    public.ops_redact(split_part(split_part(COALESCE(p_route, ''), '?', 1), '#', 1), 120),
    uid,
    keep_session
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.report_client_event(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_client_event(text, text, text, text, uuid) TO anon, authenticated;
