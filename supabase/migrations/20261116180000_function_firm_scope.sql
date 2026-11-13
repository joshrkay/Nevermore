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
  -- A firm's data is the firm's members' alone, whatever the caller's role (D-16, D-18).
  IF NOT public.intake_in_my_firm(p_session_id) THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
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
  -- A firm's data is the firm's members' alone, whatever the caller's role (D-16, D-18).
  IF NOT public.intake_in_my_firm(p_session_id) THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
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
  -- A firm's data is the firm's members' alone, whatever the caller's role (D-16, D-18).
  IF NOT public.intake_in_my_firm(p_session_id) THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
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
  -- A firm's data is the firm's members' alone, whatever the caller's role (D-16, D-18).
  IF NOT public.intake_in_my_firm(p_session_id) THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;

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
  -- A firm's data is the firm's members' alone, whatever the caller's role (D-16, D-18).
  IF NOT public.intake_in_my_firm(p_session_id) THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;

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
