-- Following up and withdrawing (story M-2.4, slice 6.9, #203; docs/BROKER_CRM_BUILD.md D-1620 to D-1629; ADR 0003, ADR 0005;
-- supabase/tests/follow_up_and_withdraw.sql).
--
-- After a send (6.6), an advisor can follow up with a PEO or withdraw the submission from it, each on the PEO's own thread (In-Reply-To and References
-- continue it), through their own connected mailbox, recorded before it goes, on the same outbox and queue as the send (D-602). A follow-up carries a
-- fresh live link to the version already sent (D-1621); a withdrawal closes the quote request, revokes its link and keeps a reason for advisors only.
-- Marking a submission Won, Lost or Archived revokes the links of the PEOs it closes, and can send them all one withdrawal (D-1624).

-- ---------- 1. Why a PEO was withdrawn, for advisors only ----------
-- Prospects read no quote request (20261110090000), so the reason is the firm's alone. Every change to it is in the quote request's history (its trigger).
ALTER TABLE public.quote_requests
  ADD COLUMN withdrawn_reason text CONSTRAINT quote_requests_withdrawn_reason_check CHECK (withdrawn_reason IN (
    -- sync:begin withdrawal_reasons
    'employer_went_elsewhere', 'prospect_withdrew_peo', 'peo_not_a_fit', 'other'
    -- sync:end withdrawal_reasons
  ));

-- A quote request reopened (send_to_peo sends to a closed one again) is no longer withdrawn: its reason goes, in the same write.
CREATE FUNCTION public.quote_request_reopened()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.withdrawn_reason := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.quote_request_reopened() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER quote_requests_reopened BEFORE UPDATE OF status ON public.quote_requests
  FOR EACH ROW WHEN (OLD.status = 'closed' AND NEW.status <> 'closed')
  EXECUTE FUNCTION public.quote_request_reopened();

-- ---------- 2. One message on a PEO's thread ----------
-- What a follow-up and a withdrawal both record, as send_to_peo records a send (20261122140000): the message queued on the quote request's thread with
-- its own Message-ID, continuing the thread from its newest message that has one, and its outbox event. Not an API function: its callers check first.
CREATE FUNCTION public.record_peo_thread_message(p_quote_request_id bigint, p_from text, p_to text[], p_subject text, p_body text, p_without_link boolean)
RETURNS public.quote_request_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req public.quote_requests;
  own_id text := '<' || gen_random_uuid() || '@' || split_part(p_from, '@', 2) || '>';
  before_id text;
  before_refs text[];
  made public.quote_request_messages;
BEGIN
  SELECT * INTO req FROM public.quote_requests q WHERE q.id = p_quote_request_id;
  -- The thread it continues: a sent message keeps its own ids; a received one has them in its headers, as receive-mail stored them (D-677).
  SELECT x.mid, x.refs || x.mid INTO before_id, before_refs
  FROM (
    SELECT COALESCE(m.message_id, NULLIF(btrim(m.headers ->> 'message-id'), '')) AS mid,
           CASE WHEN m.direction = 'sent' THEN m.message_references
                ELSE COALESCE(regexp_split_to_array(NULLIF(btrim(m.headers ->> 'references'), ''), '\s+'), '{}') END AS refs,
           m.recorded_at, m.id
    FROM public.quote_request_messages m
    WHERE m.quote_request_id = req.id) x
  WHERE x.mid IS NOT NULL
  ORDER BY x.recorded_at DESC, x.id DESC LIMIT 1;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, to_addresses, subject, body_text,
                                             sent_at, status, message_id, in_reply_to, message_references, sender_id)
  VALUES (own_id, req.id, req.session_id, 'sent', p_from, p_to, btrim(p_subject), p_body, NULL, 'queued', own_id, before_id, COALESCE(before_refs, '{}'),
          auth.uid())
  RETURNING * INTO made;
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
  VALUES ('peo_message', req.session_id, 'peo_message:' || made.id, jsonb_build_object(
    'message_id', made.id,
    'company_name', (SELECT c.chamber_data ->> 'company_name' FROM public.chamber_certifications c WHERE c.session_id = req.session_id AND c.version = req.sent_version),
    'reference', (SELECT c.file_id FROM public.chamber_certifications c WHERE c.session_id = req.session_id AND c.version = req.sent_version))
    -- A withdrawal carries no link: its event goes as written, never waiting for a token (claim_peo_mail).
    || CASE WHEN p_without_link THEN jsonb_build_object('without_link', true) ELSE '{}'::jsonb END);
  RETURN made;
END;
$$;

REVOKE ALL ON FUNCTION public.record_peo_thread_message(bigint, text, text[], text, text, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- The addresses of a message on a PEO's thread, as send_to_peo checks them: one to ten people at the PEO, each a bare address by the one address rule
-- (D-637). Answers them trimmed, empty entries dropped. Not an API function.
CREATE FUNCTION public.peo_message_addresses(p_peo text, p_to text[])
RETURNS text[]
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  to_in text[] := ARRAY(SELECT btrim(x) FROM unnest(COALESCE(p_to, '{}')) x WHERE btrim(x) <> '');
BEGIN
  IF cardinality(to_in) = 0 THEN
    RAISE EXCEPTION 'Address it to at least one person at %.', p_peo USING ERRCODE = '22023';
  END IF;
  IF cardinality(to_in) > 10 THEN
    RAISE EXCEPTION 'Address it to at most 10 people.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(to_in) x WHERE NOT public.is_mail_address(x)) THEN
    RAISE EXCEPTION 'Enter each address like name@example.com.' USING ERRCODE = '22023';
  END IF;
  RETURN to_in;
END;
$$;

REVOKE ALL ON FUNCTION public.peo_message_addresses(text, text[]) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. A follow-up ----------
CREATE FUNCTION public.follow_up_peo(p_quote_request_id bigint, p_to text[], p_subject text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req public.quote_requests;
  to_in text[];
  problem text;
  revoked text;
  sender_address text;
  made public.quote_request_messages;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  -- A quote request of the caller's own firm; another firm's is not there for them. Locked, as a send locks it.
  SELECT q.* INTO req FROM public.quote_requests q WHERE q.id = p_quote_request_id AND public.quote_request_in_my_firm(q.id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  -- A withdrawn PEO, or one a closed submission closed, is not followed up: sending again reopens it (send_to_peo).
  IF req.status = 'closed' THEN
    RAISE EXCEPTION 'This quote request is closed. Send to % again to reopen it.', req.peo_name USING ERRCODE = '22023';
  END IF;
  -- M-1.1: a follow-up carries the packet's link, so it needs the employer's live authorization, as a send does (6.6a's words).
  PERFORM public.assert_peo_authorized(req.session_id, req.peo_name);
  -- A revoked link stays revoked (D-1622): only one replaced by a newer link, or past its 30 days, is issued afresh by a follow-up.
  SELECT b.revoked_reason INTO revoked FROM public.bundle_links b WHERE b.quote_request_id = req.id ORDER BY b.issued_at DESC, b.id DESC LIMIT 1;
  IF revoked = 'revoked_by_advisor' THEN
    RAISE EXCEPTION 'You revoked the link to %, so a follow-up can''t carry one. Send to % again to issue a new link.', req.peo_name, req.peo_name
      USING ERRCODE = '22023';
  END IF;
  to_in := public.peo_message_addresses(req.peo_name, p_to);
  -- The subject and the note by 6.2's limits (D-636).
  problem := public.conversation_message_input_error(p_subject, p_note, '{}');
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  -- From the advisor's own connected mailbox (ADR 0005). With none there is no From, so nothing is recorded (D-634).
  SELECT b.address INTO sender_address FROM public.broker_mailboxes b WHERE b.user_id = auth.uid();
  IF sender_address IS NULL THEN
    RAISE EXCEPTION 'Connect your mailbox to send from here.' USING ERRCODE = 'PT412';
  END IF;
  made := public.record_peo_thread_message(req.id, sender_address, to_in, p_subject, p_note, false);
  -- The browser issues the fresh link for the version already sent (D-1621) and joins it with attach_peo_link, as a send does (D-671).
  RETURN jsonb_build_object('quote_request_id', req.id, 'message_id', made.id, 'version', req.sent_version);
END;
$$;

REVOKE ALL ON FUNCTION public.follow_up_peo(bigint, text[], text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.follow_up_peo(bigint, text[], text, text) TO authenticated;

-- ---------- 4. A withdrawal ----------
CREATE FUNCTION public.withdraw_from_peo(p_quote_request_id bigint, p_to text[], p_subject text, p_note text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req public.quote_requests;
  to_in text[];
  problem text;
  sender_address text;
  made public.quote_request_messages;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  -- The pipeline row first, then the quote request, as every send locks them; a quote request of the caller's own firm only.
  PERFORM 1 FROM public.submission_workflow w JOIN public.quote_requests zq ON zq.session_id = w.session_id WHERE zq.id = p_quote_request_id FOR UPDATE OF w;
  SELECT q.* INTO req FROM public.quote_requests q WHERE q.id = p_quote_request_id AND public.quote_request_in_my_firm(q.id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  -- A PEO already withdrawn, or closed with its submission, is told nothing again.
  IF req.status = 'closed' THEN
    RAISE EXCEPTION '% is already closed, so there is nothing to withdraw.', req.peo_name USING ERRCODE = '22023';
  END IF;
  -- Why, for advisors only: one of the four (M-2.4).
  IF p_reason IS NULL OR p_reason NOT IN ('employer_went_elsewhere', 'prospect_withdrew_peo', 'peo_not_a_fit', 'other') THEN
    RAISE EXCEPTION 'Choose why: the employer went elsewhere, the prospect withdrew this PEO, the PEO is not a fit, or other.' USING ERRCODE = '22023';
  END IF;
  to_in := public.peo_message_addresses(req.peo_name, p_to);
  -- The subject and the note by 6.2's limits (D-636).
  problem := public.conversation_message_input_error(p_subject, p_note, '{}');
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  -- From the advisor's own connected mailbox (ADR 0005). With none, nothing is closed or recorded: the PEO would never be told (D-634).
  SELECT b.address INTO sender_address FROM public.broker_mailboxes b WHERE b.user_id = auth.uid();
  IF sender_address IS NULL THEN
    RAISE EXCEPTION 'Connect your mailbox to send from here.' USING ERRCODE = 'PT412';
  END IF;
  -- The quote request closes with its reason, and its link stops working (6.6b's reason withdrawn), in the same transaction as the message.
  UPDATE public.quote_requests SET status = 'closed', withdrawn_reason = p_reason WHERE id = req.id;
  PERFORM public.bundle_link_revoke(req.id, 'withdrawn');
  made := public.record_peo_thread_message(req.id, sender_address, to_in, p_subject, p_note, true);
  RETURN jsonb_build_object('quote_request_id', req.id, 'message_id', made.id);
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_from_peo(bigint, text[], text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_from_peo(bigint, text[], text, text, text) TO authenticated;

-- ---------- 5. The send-mail function claims a message with no link ----------
-- claim_peo_mail restated from 20261122140000 with every rule it had, and one change: an event marked without_link (a withdrawal) is claimed as it is,
-- and never ended for a link that never joined it. Every other message still waits for its link, and is still checked again before it goes (D-676).
CREATE OR REPLACE FUNCTION public.claim_peo_mail(p_batch integer, p_max_attempts integer, p_lock_seconds integer DEFAULT 600)
RETURNS TABLE (event_id uuid, attempt integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- A message whose link never joined it within ten minutes (the advisor's page closed between the send and its link) is never sent: its event ends
  -- here, untried, and the message says so. A withdrawal carries no link (without_link), so it never waits for one (M-2.4).
  WITH ended AS (
    UPDATE public.outbox_events e SET status = 'dead', last_error = 'refused', claimed_at = NULL, locked_until = NULL
    WHERE e.kind = 'peo_message' AND e.status = 'pending' AND NOT e.payload ? 'link_token' AND NOT e.payload ? 'without_link'
      AND e.created_at < now() - interval '10 minutes'
    RETURNING (e.payload ->> 'message_id')::bigint AS message_id)
  UPDATE public.quote_request_messages m
  SET status = 'failed', failure_kind = 'refused', failure_reason = 'The bundle link wasn''t made, so nothing was sent. Send it again.'
  FROM ended WHERE m.id = ended.message_id;
  -- A message whose link stopped working before it went (revoked, or past its 30 days) is never sent: the PEO would get a link that opens nothing, or
  -- mail after the employer withdrew it. Its event ends here, its token with it.
  WITH ended AS (
    UPDATE public.outbox_events e SET status = 'dead', last_error = 'refused', claimed_at = NULL, locked_until = NULL, payload = e.payload - 'link_token'
    FROM public.quote_request_messages qm JOIN public.bundle_links b ON b.id = qm.bundle_link_id
    WHERE e.kind = 'peo_message' AND qm.id = (e.payload ->> 'message_id')::bigint AND (b.revoked_at IS NOT NULL OR b.expires_at <= now())
      AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    RETURNING qm.id AS message_id)
  UPDATE public.quote_request_messages m
  SET status = 'failed', failure_kind = 'refused', failure_reason = 'The bundle link stopped working before this went, so nothing was sent.'
  FROM ended WHERE m.id = ended.message_id;
  -- Nor once the employer withdrew the PEO while it waited (M-1.1): the bundle link reads peo_authorized as it is opened, so this asks the same.
  WITH ended AS (
    UPDATE public.outbox_events e SET status = 'dead', last_error = 'refused', claimed_at = NULL, locked_until = NULL, payload = e.payload - 'link_token'
    FROM public.quote_request_messages qm JOIN public.quote_requests q ON q.id = qm.quote_request_id
    WHERE e.kind = 'peo_message' AND qm.id = (e.payload ->> 'message_id')::bigint AND NOT public.peo_authorized(q.session_id, q.peo_name)
      AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    RETURNING qm.id AS message_id, q.peo_name)
  UPDATE public.quote_request_messages m
  SET status = 'failed', failure_kind = 'refused', failure_reason = format('The employer withdrew %s before this went, so nothing was sent.', ended.peo_name)
  FROM ended WHERE m.id = ended.message_id;

  RETURN QUERY
  WITH claimed AS (
    UPDATE public.outbox_events e
    SET status = 'claimed', attempts = e.attempts + 1, claimed_at = now(), locked_until = now() + make_interval(secs => p_lock_seconds)
    WHERE e.id IN (
      SELECT o.id FROM public.outbox_events o
      WHERE o.kind = 'peo_message' AND o.attempts < p_max_attempts AND (o.payload ? 'link_token' OR o.payload ? 'without_link')
        AND ((o.status = 'pending' AND o.next_attempt_at <= now()) OR (o.status = 'claimed' AND o.locked_until < now()))
      ORDER BY o.next_attempt_at, o.created_at
      LIMIT p_batch
      FOR UPDATE SKIP LOCKED)
    RETURNING e.id, e.attempts, e.payload, e.next_attempt_at, e.created_at)
  SELECT c.id, c.attempts, jsonb_build_object(
    'id', m.id, 'from_address', m.from_address, 'to_addresses', to_jsonb(m.to_addresses), 'cc_addresses', to_jsonb(m.cc_addresses),
    'subject', m.subject, 'body_text', m.body_text, 'message_id', m.message_id, 'in_reply_to', m.in_reply_to,
    'message_references', to_jsonb(m.message_references), 'sender_id', m.sender_id,
    'reply_address', (SELECT a.local_part FROM public.quote_request_addresses a WHERE a.quote_request_id = m.quote_request_id AND a.revoked_at IS NULL
                      ORDER BY a.issued_at DESC LIMIT 1),
    'link_token', c.payload ->> 'link_token')
  FROM claimed c
  JOIN public.quote_request_messages m ON m.id = (c.payload ->> 'message_id')::bigint
  ORDER BY c.next_attempt_at, c.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_peo_mail(integer, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_peo_mail(integer, integer, integer) TO service_role;

-- ---------- 6. Won, Lost and Archived revoke the links ----------
-- set_submission_status restated from 20261118110000 with every rule it had, and one more: the quote requests it closes, and every other but the winner,
-- lose their live bundle link (6.6b's reason submission_closed), whether or not the advisor sends the withdrawal it offers (M-2.4).
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
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
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
    -- M-2.4: and no PEO but the winner can open the employer's packet any more, whether or not the advisor writes to them (D-1624).
    PERFORM public.bundle_link_revoke(q.id, 'submission_closed')
    FROM public.quote_requests q
    WHERE q.session_id = p_session_id AND q.id IS DISTINCT FROM current_row.won_quote_request_id;
  END IF;

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (p_session_id, previous, p_status, clean_note, auth.uid(), auth.jwt() ->> 'email');
  RETURN current_row;
END;
$function$;

-- ---------- 7. Won, Lost or Archived with one withdrawal to every PEO still open ----------
-- The status panel's offer (D-1624): the advisor writes one note, and in the same transaction as the move each PEO set_submission_status closes is sent
-- it on its own thread, to the people its newest message from the product went to. A PEO never sent to through the product has no thread to write on
-- and is left out (its send was recorded by hand). Skipping the offer is set_submission_status alone; the links are revoked either way.
CREATE FUNCTION public.close_submission_and_withdraw(p_session_id uuid, p_status text, p_note text, p_won_quote_request_id bigint, p_subject text,
                                                     p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sender_address text;
  problem text;
  targets jsonb;
  target jsonb;
  made public.quote_request_messages;
  ids jsonb := '[]'::jsonb;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  -- Another firm's intake is not there for them, before anything about the caller's own mailbox is said (as set_submission_status refuses it).
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');
  -- From the advisor's own connected mailbox (ADR 0005). With none, the submission does not move either: the advisor chose to tell the PEOs (D-634).
  SELECT b.address INTO sender_address FROM public.broker_mailboxes b WHERE b.user_id = auth.uid();
  IF sender_address IS NULL THEN
    RAISE EXCEPTION 'Connect your mailbox to send from here.' USING ERRCODE = 'PT412';
  END IF;
  -- The one note by 6.2's limits (D-636), for every PEO it goes to.
  problem := public.conversation_message_input_error(p_subject, p_body, '{}');
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  -- The PEOs still open, and who each was last written to, read before the move closes them.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', q.id, 'to', (
           SELECT to_jsonb(m.to_addresses) FROM public.quote_request_messages m WHERE m.quote_request_id = q.id AND m.direction = 'sent'
           ORDER BY m.recorded_at DESC, m.id DESC LIMIT 1)) ORDER BY q.id), '[]'::jsonb)
  INTO targets
  FROM public.quote_requests q
  WHERE q.session_id = p_session_id AND q.status IN ('sent', 'quoted') AND q.id IS DISTINCT FROM p_won_quote_request_id
    AND EXISTS (SELECT 1 FROM public.quote_request_messages m WHERE m.quote_request_id = q.id AND m.direction = 'sent');
  PERFORM public.set_submission_status(p_session_id, p_status, p_note, p_won_quote_request_id);
  FOR target IN SELECT * FROM jsonb_array_elements(targets) LOOP
    made := public.record_peo_thread_message((target ->> 'id')::bigint, sender_address, ARRAY(SELECT jsonb_array_elements_text(target -> 'to')),
                                             p_subject, p_body, true);
    ids := ids || to_jsonb(made.id);
  END LOOP;
  RETURN jsonb_build_object('message_ids', ids);
END;
$$;

REVOKE ALL ON FUNCTION public.close_submission_and_withdraw(uuid, text, text, bigint, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.close_submission_and_withdraw(uuid, text, text, bigint, text, text) TO authenticated;
