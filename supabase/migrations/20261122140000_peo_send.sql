-- Sending the bundle to a PEO (story M-2.1, slice 6.6, #200; docs/BROKER_CRM_BUILD.md D-602, D-609, D-670 to D-679; ADR 0003, ADR 0005;
-- supabase/tests/peo_send.sql).
--
-- An advisor sends a PEO its bundle from the submission page: the send creates or continues that PEO's quote request, records the version sent, and
-- records the message on the quote request's thread as queued before anything goes (D-602). The bundle link (6.6b) is issued for that quote request
-- next, and joined to the message (attach_peo_link), which only then lets the send-mail function send it, through the advisor's own connected mailbox
-- (ADR 0005), on the outbox every email uses, with its retries. The message carries the link, never a file (ADR 0003).

-- ---------- 1. A message the product sends goes on the quote request's thread ----------
-- quote_request_messages held what arrived and what an advisor recorded sending by hand. It now also holds what the product sends through the advisor's
-- mailbox (direction 'sent'), with what the send needs and how it went, as conversation_messages has for contacts (6.2). Added to, nothing replaced
-- (ADR 0007): every earlier row keeps its shape. A sent message's provider_message_id is its own Message-ID until Gmail answers its id (D-633).
ALTER TABLE public.quote_request_messages
  ADD COLUMN status text CONSTRAINT quote_request_messages_status_check CHECK (status IN ('queued', 'sent', 'failed')),
  ADD COLUMN failure_kind text CONSTRAINT quote_request_messages_failure_kind_check CHECK (failure_kind IN ('mailbox', 'refused', 'uncertain', 'unavailable')),
  ADD COLUMN failure_reason text CONSTRAINT quote_request_messages_failure_reason_check CHECK (btrim(failure_reason) <> '' AND char_length(failure_reason) <= 500),
  ADD COLUMN message_id text CONSTRAINT quote_request_messages_message_id_key UNIQUE,
  ADD COLUMN in_reply_to text,
  ADD COLUMN message_references text[] NOT NULL DEFAULT '{}',
  ADD COLUMN sender_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN bundle_link_id bigint REFERENCES public.bundle_links (id) ON DELETE SET NULL;

-- 20261111130000's shape, restated with every rule it had, and 'sent': a sent message is on a quote request, never held, with its status and its
-- Message-ID; no other message has either.
ALTER TABLE public.quote_request_messages DROP CONSTRAINT quote_request_messages_shape_check;
ALTER TABLE public.quote_request_messages ADD CONSTRAINT quote_request_messages_shape_check CHECK (
  direction IN ('received', 'sent_by_hand', 'sent')
  AND (quote_request_id IS NULL) = (held_reason IS NOT NULL)
  AND (quote_request_id IS NULL) = (session_id IS NULL)
  AND (quote_request_id IS NULL) = (held_at IS NOT NULL)
  AND (held_reason IS NULL OR held_reason IN ('revoked_address', 'unknown_address', 'ambiguous_address', 'moved_by_advisor'))
  AND (moved_note IS NULL OR char_length(moved_note) <= 500)
  AND (held_reason = 'moved_by_advisor' OR (moved_by IS NULL AND moved_from_quote_request_id IS NULL AND moved_note IS NULL))
  AND (direction = 'sent') = (status IS NOT NULL)
  AND (direction = 'sent') = (message_id IS NOT NULL)
  AND (direction <> 'sent' OR quote_request_id IS NOT NULL)
);

-- ---------- 2. The outbox carries a sent message by its id ----------
-- A new kind on the outbox every email uses, an intake's (so the Outbox page lists it and its retry, as other emails). Restated with every kind it had
-- (20261122090000).
ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request', 'draft_expiry_reminder', 'peo_mail_arrived', 'member_left', 'firm_closing', 'export_alert',
    'conversation_message', 'peo_message'
    -- sync:end outbox_kinds
  ));

-- ---------- 3. Sending to a PEO ----------
CREATE FUNCTION public.send_to_peo(p_session_id uuid, p_peo text, p_to text[], p_subject text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  peo text := btrim(COALESCE(p_peo, ''));
  req public.quote_requests;
  sender_address text;
  to_in text[] := ARRAY(SELECT btrim(x) FROM unnest(COALESCE(p_to, '{}')) x WHERE btrim(x) <> '');
  made public.quote_request_messages;
  own_id text;
  version_sent integer;
  problem text;
  stage text;
  before_id text;
  before_refs text[];
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');
  -- M-1.1: no send to a PEO without the employer's live authorization; the database refuses it, not only the screen.
  PERFORM public.assert_peo_authorized(p_session_id, peo);
  -- Only the latest certified version is sent, and only while it still covers the answers: a changed answer supersedes it ('data_changed') until the
  -- prospect certifies again.
  SELECT c.version INTO version_sent FROM public.chamber_certifications c WHERE c.session_id = p_session_id AND c.superseded_at IS NULL
  ORDER BY c.version DESC LIMIT 1;
  IF version_sent IS NULL THEN
    RAISE EXCEPTION 'The prospect changed an answer since certifying. Sending waits until they certify again.' USING ERRCODE = '22023';
  END IF;
  -- One or more people at the PEO, picked from its contacts or typed, each a bare address by the one address rule (D-637).
  IF cardinality(to_in) = 0 THEN
    RAISE EXCEPTION 'Address it to at least one person at %.', peo USING ERRCODE = '22023';
  END IF;
  IF cardinality(to_in) > 10 THEN
    RAISE EXCEPTION 'Address it to at most 10 people.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(to_in) x WHERE NOT public.is_mail_address(x)) THEN
    RAISE EXCEPTION 'Enter each address like name@example.com.' USING ERRCODE = '22023';
  END IF;
  -- The subject and the note by 6.2's limits (D-636): a subject of one line, a note that says something.
  problem := public.conversation_message_input_error(p_subject, p_note, '{}');
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  -- From the advisor's own connected mailbox (ADR 0005). With none there is no From, so nothing is recorded: the composer says Connect (D-634).
  SELECT b.address INTO sender_address FROM public.broker_mailboxes b WHERE b.user_id = auth.uid();
  IF sender_address IS NULL THEN
    RAISE EXCEPTION 'Connect your mailbox to send from here.' USING ERRCODE = 'PT412';
  END IF;
  -- The stages a send is recorded at, as advisor_record_quote_send's (the pipeline row locked first, then the quote request, as every send locks them).
  SELECT w.status INTO stage FROM public.submission_workflow w WHERE w.session_id = p_session_id FOR UPDATE;
  IF stage IS NULL OR stage NOT IN ('ready_for_market', 'sent_to_carrier', 'quoted') THEN
    RAISE EXCEPTION 'Move this submission to Ready for market first. It is %', replace(COALESCE(stage, 'not started'), '_', ' ') USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_version, sent_on)
  VALUES (p_session_id, peo, 'sent', version_sent, current_date)
  ON CONFLICT (session_id, lower(peo_name)) DO UPDATE
    SET sent_version = EXCLUDED.sent_version, sent_on = EXCLUDED.sent_on,
        status = CASE WHEN quote_requests.status = 'closed' THEN 'sent' ELSE quote_requests.status END
  RETURNING * INTO req;
  -- The address replies about this quote request are sent to; kept if it already has one.
  PERFORM public.issue_quote_request_address(req.id);
  -- ADR 0026: a send while the submission is Ready for market moves it to Sent to PEOs, in this transaction, and at no other stage.
  IF stage = 'ready_for_market' THEN
    PERFORM public.submission_move_for_cause(p_session_id, 'ready_for_market', 'sent_to_carrier', 'quote_send', req.id);
  END IF;
  -- Its own Message-ID, <a new id@the From domain> (M-2.1), and the thread it continues: the newest message on this quote request that has one.
  own_id := '<' || gen_random_uuid() || '@' || split_part(sender_address, '@', 2) || '>';
  -- A sent one keeps its own; a received one has them in its headers, as receive-mail stored them.
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
  VALUES (own_id, req.id, p_session_id, 'sent', sender_address, to_in, btrim(p_subject), p_note, NULL, 'queued', own_id, before_id, COALESCE(before_refs, '{}'),
          auth.uid())
  RETURNING * INTO made;
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
  -- Its event carries the message's id, and the company and File ID the Outbox page names it by; never the note, the addresses or the token.
  VALUES ('peo_message', p_session_id, 'peo_message:' || made.id, jsonb_build_object(
    'message_id', made.id,
    'company_name', (SELECT c.chamber_data ->> 'company_name' FROM public.chamber_certifications c WHERE c.session_id = p_session_id AND c.version = version_sent),
    'reference', (SELECT c.file_id FROM public.chamber_certifications c WHERE c.session_id = p_session_id AND c.version = version_sent)));
  -- Seam for Q-2.1 (slice 6.10): the send's append-only registration (firm, PEO, the employer's FEIN or name and state, version, time) is written
  -- here, in this transaction, once the message is recorded (D-679).
  RETURN jsonb_build_object('quote_request_id', req.id, 'message_id', made.id);
END;
$$;

REVOKE ALL ON FUNCTION public.send_to_peo(uuid, text, text[], text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.send_to_peo(uuid, text, text[], text, text) TO authenticated;

-- ---------- 4. The line every message to a PEO carries (D-12) ----------
-- DRAFT, not yet reviewed by counsel. The words are src/data/legalWording.ts's PEO_SEND_NOTICE, the one legal-wording module; src/data/schemaSync.test.ts
-- keeps this copy equal to it, so counsel's text is still one change there and this follows.
CREATE FUNCTION public.peo_send_notice()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    -- sync:begin peo_send_notice
    'Draft wording: sent with the authorization of the employer, for this PEO alone to consider them for a quote. Please do not pass the link on.'
    -- sync:end peo_send_notice
$$;

-- ---------- 5. The bundle link joins its message ----------
-- What the stored body keeps of the link (D-673): never the token. The body holds this marker where the link goes; the send-mail function puts the link
-- in its place as it sends, from the token the outbox event alone carries.
CREATE FUNCTION public.peo_link_marker()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT '[the bundle link, sent in the email and not kept here]' $$;

CREATE FUNCTION public.attach_peo_link(p_message_id bigint, p_link_id bigint, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m public.quote_request_messages;
  link public.bundle_links;
  file_id text;
  firm_name text;
  person text;
  phone text;
  items text;
  block text;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zm.firm_id FROM public.quote_request_messages zm WHERE zm.id = p_message_id));
  PERFORM public.require_advisor();
  -- A message of the caller's own firm; another firm's reads as none. Only the advisor who wrote it sends it: it goes from their mailbox.
  SELECT * INTO m FROM public.quote_request_messages x
  WHERE x.id = p_message_id AND x.direction = 'sent' AND public.intake_in_my_firm(x.session_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404';
  END IF;
  IF m.sender_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the advisor who wrote this message can send it.' USING ERRCODE = 'PT409';
  END IF;
  IF m.bundle_link_id IS NOT NULL OR m.status <> 'queued' THEN
    RAISE EXCEPTION 'This message already has its link.' USING ERRCODE = 'PT409';
  END IF;
  -- The live link of the message's own quote request, opened by this token: what the PEO will be sent is what opens.
  SELECT * INTO link FROM public.bundle_links b
  WHERE b.id = p_link_id AND b.quote_request_id = m.quote_request_id AND b.revoked_at IS NULL AND b.expires_at > now()
    AND b.token_hash = encode(extensions.digest(COALESCE(p_token, ''), 'sha256'), 'hex');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bundle link isn''t this message''s.' USING ERRCODE = '22023';
  END IF;
  SELECT c.file_id INTO file_id FROM public.chamber_certifications c WHERE c.session_id = link.session_id AND c.version = link.version;
  SELECT f.name INTO firm_name FROM public.firms f WHERE f.id = link.firm_id;
  SELECT COALESCE(NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''), NULLIF(btrim(u.raw_user_meta_data ->> 'name'), ''), u.email::text)
  INTO person FROM auth.users u WHERE u.id = m.sender_id;
  SELECT NULLIF(btrim(p.phone), '') INTO phone FROM public.profiles p WHERE p.user_id = m.sender_id;
  SELECT string_agg(x, '; ' ORDER BY n) INTO items FROM jsonb_array_elements_text(link.open_items) WITH ORDINALITY AS t (x, n);
  -- The fixed block under the note, which the advisor can't edit: the link, File ID and version, the open items, the advisor's name, firm and phone,
  -- and the line counsel's wording will replace (D-12).
  block := E'-- \n'
    || 'The bundle: ' || public.peo_link_marker() || E'\n'
    || 'The link stops working on ' || to_char(link.expires_at AT TIME ZONE 'UTC', 'FMMonth FMDD, YYYY') || E'.\n'
    || 'File ID ' || COALESCE(file_id, 'not assigned') || ', version ' || link.version || E'\n'
    || 'Open items: ' || COALESCE(items, 'none') || E'\n'
    || concat_ws(', ', person, firm_name, phone) || E'\n'
    || public.peo_send_notice();
  UPDATE public.quote_request_messages SET body_text = m.body_text || E'\n\n' || block, bundle_link_id = link.id WHERE id = m.id;
  -- The token goes on the outbox event alone, which no API role reads, for the send-mail function to put in the email.
  UPDATE public.outbox_events e SET payload = e.payload || jsonb_build_object('link_token', p_token)
  WHERE e.kind = 'peo_message' AND (e.payload ->> 'message_id')::bigint = m.id;
  RETURN jsonb_build_object('message_id', m.id);
END;
$$;

REVOKE ALL ON FUNCTION public.attach_peo_link(bigint, bigint, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.attach_peo_link(bigint, bigint, text) TO authenticated;

-- ---------- 6. The send-mail function's own claim, completion and failure for a PEO message (as D-638's for a contact's) ----------
-- On the outbox every email uses, with dispatch-outbox's lease and attempt fence. Only a message whose link has joined it is claimed: before then its
-- event waits. The claim answers the message as send-mail's builder takes it, with the quote request's reply address and the link's token.
CREATE FUNCTION public.claim_peo_mail(p_batch integer, p_max_attempts integer, p_lock_seconds integer DEFAULT 600)
RETURNS TABLE (event_id uuid, attempt integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- A message whose link never joined it within ten minutes (the advisor's page closed between the send and its link) is never sent: its event ends
  -- here, untried, and the message says so.
  WITH ended AS (
    UPDATE public.outbox_events e SET status = 'dead', last_error = 'refused', claimed_at = NULL, locked_until = NULL
    WHERE e.kind = 'peo_message' AND e.status = 'pending' AND NOT e.payload ? 'link_token' AND e.created_at < now() - interval '10 minutes'
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
      WHERE o.kind = 'peo_message' AND o.attempts < p_max_attempts AND o.payload ? 'link_token'
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

-- A send went: the message is sent, with the provider's id (Gmail's; for Microsoft, its own Message-ID, D-633) and when, and the token leaves the outbox,
-- its work done. Only the claim of that attempt records it; true when it did.
CREATE FUNCTION public.complete_peo_mail(p_event_id uuid, p_attempt integer, p_provider_message_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ev public.outbox_events;
BEGIN
  UPDATE public.outbox_events e
  SET status = 'sent', sent_at = now(), provider_message_id = left(p_provider_message_id, 200), last_error = NULL, claimed_at = NULL, locked_until = NULL,
      payload = e.payload - 'link_token'
  WHERE e.id = p_event_id AND e.kind = 'peo_message' AND e.status = 'claimed' AND e.attempts = p_attempt
  RETURNING * INTO ev;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE public.quote_request_messages m
  SET status = 'sent', sent_at = now(), provider_message_id = left(p_provider_message_id, 200), failure_kind = NULL, failure_reason = NULL
  WHERE m.id = (ev.payload ->> 'message_id')::bigint;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_peo_mail(uuid, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_peo_mail(uuid, integer, text) TO service_role;

-- A send did not go. With a delay it is tried again then and the message stays queued; with none it is final: the event is dead (the Outbox page offers
-- its retry, as for every email) and the message failed, with its kind and the reason in the advisor's words (D-632). The event keeps the kind alone.
-- The token stays on a dead event, so the Outbox page's retry can still send the link while it is live. Only the claim of that attempt records it.
CREATE FUNCTION public.fail_peo_mail(p_event_id uuid, p_attempt integer, p_kind text, p_reason text, p_retry_in_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ev public.outbox_events;
BEGIN
  UPDATE public.outbox_events e
  SET status = CASE WHEN p_retry_in_seconds IS NULL THEN 'dead' ELSE 'pending' END,
      next_attempt_at = CASE WHEN p_retry_in_seconds IS NULL THEN e.next_attempt_at ELSE now() + make_interval(secs => p_retry_in_seconds) END,
      last_error = left(p_kind, 200), claimed_at = NULL, locked_until = NULL
  WHERE e.id = p_event_id AND e.kind = 'peo_message' AND e.status = 'claimed' AND e.attempts = p_attempt
  RETURNING * INTO ev;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF p_retry_in_seconds IS NULL THEN
    UPDATE public.quote_request_messages m SET status = 'failed', failure_kind = p_kind, failure_reason = left(p_reason, 500)
    WHERE m.id = (ev.payload ->> 'message_id')::bigint;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_peo_mail(uuid, integer, text, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fail_peo_mail(uuid, integer, text, text, integer) TO service_role;

-- The Outbox page's retry of a dead PEO message (advisor_requeue_outbox_event) puts its message back in the queue, its failure cleared, so the thread
-- says queued while it is sent again.
CREATE FUNCTION public.peo_mail_requeued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.quote_request_messages m SET status = 'queued', failure_kind = NULL, failure_reason = NULL
  WHERE m.id = (NEW.payload ->> 'message_id')::bigint AND m.status = 'failed';
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.peo_mail_requeued() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER outbox_events_peo_mail_requeued AFTER UPDATE OF status ON public.outbox_events
  FOR EACH ROW WHEN (NEW.kind = 'peo_message' AND OLD.status = 'dead' AND NEW.status = 'pending')
  EXECUTE FUNCTION public.peo_mail_requeued();

-- An event of a PEO message that ends dead by any other path (the outbox's reaper, when the worker of its last attempt was lost) leaves its message failed
-- as uncertain: the worker may have sent it before it was lost (D-632). fail_peo_mail then writes its own kind and reason over this.
CREATE FUNCTION public.peo_mail_ended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.quote_request_messages m
  SET status = 'failed', failure_kind = 'uncertain', failure_reason = 'This message may have been sent. Look in your Sent folder before sending again.'
  WHERE m.id = (NEW.payload ->> 'message_id')::bigint AND m.status = 'queued';
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.peo_mail_ended() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER outbox_events_peo_mail_ended AFTER UPDATE OF status ON public.outbox_events
  FOR EACH ROW WHEN (NEW.kind = 'peo_message' AND NEW.status = 'dead' AND OLD.status IS DISTINCT FROM 'dead')
  EXECUTE FUNCTION public.peo_mail_ended();

-- ---------- 7. What the composer reads ----------
-- For an advisor of the intake's own firm: their own mailbox (connected, and its address), the people at the PEO with an email on its profile in use
-- (the newest published version), in its order, and the quote request's reply address when it has one. Another firm's intake is not there for them.
CREATE FUNCTION public.peo_send_context(p_session_id uuid, p_peo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  peo text := btrim(COALESCE(p_peo, ''));
  address text;
BEGIN
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');
  SELECT b.address INTO address FROM public.broker_mailboxes b WHERE b.user_id = auth.uid();
  RETURN jsonb_build_object(
    'mailbox', jsonb_build_object('connected', address IS NOT NULL, 'address', address),
    'contacts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', c.name, 'role', c.role, 'email', c.email) ORDER BY c.position)
      FROM public.peo_contacts c
      WHERE c.email IS NOT NULL AND c.profile_version_id = (
        SELECT v.id FROM public.peo_profile_versions v JOIN public.peos p ON p.id = v.peo_id
        WHERE lower(p.name) = lower(peo) AND v.status = 'published' ORDER BY v.version DESC LIMIT 1)), '[]'::jsonb),
    'reply_address', (
      SELECT a.local_part FROM public.quote_request_addresses a JOIN public.quote_requests q ON q.id = a.quote_request_id
      WHERE q.session_id = p_session_id AND lower(q.peo_name) = lower(peo) AND a.revoked_at IS NULL ORDER BY a.issued_at DESC LIMIT 1));
END;
$$;

REVOKE ALL ON FUNCTION public.peo_send_context(uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.peo_send_context(uuid, text) TO authenticated;

-- The notice and the marker are the database's own, read by attach_peo_link alone.
REVOKE ALL ON FUNCTION public.peo_send_notice() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.peo_link_marker() FROM PUBLIC, anon, authenticated, service_role;
