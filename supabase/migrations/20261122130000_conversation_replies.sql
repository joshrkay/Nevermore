-- Replies come back to their conversation (story CRM-E1.3, slice 6.4, #198; docs/BROKER_CRM_BUILD.md D-601, D-606, D-607 and D-660 to D-669;
-- supabase/tests/conversation_replies.sql).

SET lock_timeout = '5s';

-- ---------- 1. A received message on a conversation ----------
-- Added to, nothing replaced (ADR 0007). A message that came in is direction 'inbound' (from anyone but the firm's own people) and status 'received';
-- the send's own statuses (queued, sent, failed) stay the outbound messages'.
ALTER TABLE public.conversation_messages ADD COLUMN from_name text CONSTRAINT conversation_messages_from_name_check CHECK (char_length(from_name) <= 200);
-- An automatic reply (an out-of-office, a delivery failure, a list): receive-mail's rule, as on PEO mail.
ALTER TABLE public.conversation_messages ADD COLUMN is_automatic boolean NOT NULL DEFAULT false;
-- A sender not seen on the conversation before (CRM-E1.3): offered as a contact on the account (add_sender_as_contact).
ALTER TABLE public.conversation_messages ADD COLUMN new_sender boolean NOT NULL DEFAULT false;
ALTER TABLE public.conversation_messages DROP CONSTRAINT conversation_messages_status_check;
ALTER TABLE public.conversation_messages ADD CONSTRAINT conversation_messages_status_check CHECK (status IN ('queued', 'sent', 'failed', 'received'));
-- A copy one of the firm's own people sent from their own mail with the conversation's address in To or CC is 'sent_by_hand', as on PEO mail.
ALTER TABLE public.conversation_messages ADD CONSTRAINT conversation_messages_direction_check CHECK (
  direction IN ('outbound', 'inbound', 'sent_by_hand') AND ((direction = 'outbound') = (status <> 'received')));

-- What record_inbound_mail answers for a message on a conversation: the conversation and the message, never a quote request. Internal.
CREATE FUNCTION public.received_conversation_answer(m public.conversation_messages, p_duplicate boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('conversation_message_id', m.id, 'conversation_id', m.conversation_id, 'firm_id', m.firm_id, 'duplicate', p_duplicate,
    'held', false, 'held_reason', NULL)
$$;

REVOKE ALL ON FUNCTION public.received_conversation_answer(public.conversation_messages, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. receive-mail looks in both address tables (D-606) ----------
-- record_inbound_mail restated from its LATEST definition (20261116240000_held_mail_to_the_right_firm.sql), every rule kept. Added: a reply address of a
-- conversation (c.<name>.<16 hex>) named by the message, when no live quote request is, files it on that conversation as a received message, and the
-- answer names the conversation and the message (conversation_message_id) instead of a quote request's message.
CREATE OR REPLACE FUNCTION public.record_inbound_mail(
  p_provider_message_id text, p_local_parts text[], p_from_address text, p_from_name text, p_to text[], p_cc text[],
  p_subject text, p_body_text text, p_body_truncated boolean, p_headers jsonb, p_is_automatic boolean, p_sent_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  existing public.quote_request_messages;
  locals text[] := COALESCE((SELECT array_agg(DISTINCT lower(btrim(x))) FROM unnest(COALESCE(p_local_parts, '{}')) x WHERE btrim(x) <> ''), '{}');
  from_addr text := lower(btrim(COALESCE(p_from_address, '')));
  live_requests bigint[];
  live_conversations uuid[];
  conv public.conversations;
  cmsg public.conversation_messages;
  own_mid text;
  answers text;
  req public.quote_requests;
  reason text;
  chosen_local text;
  matched_firms uuid[];
  matched_local text;
  held_firm uuid;
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
  SELECT * INTO cmsg FROM public.conversation_messages m WHERE m.provider_message_id = p_provider_message_id AND m.direction <> 'outbound';
  IF FOUND THEN
    RETURN public.received_conversation_answer(cmsg, true);
  END IF;

  SELECT array_agg(DISTINCT a.quote_request_id) INTO live_requests
  FROM public.quote_request_addresses a WHERE a.local_part = ANY (locals) AND a.revoked_at IS NULL;
  SELECT array_agg(c.id) INTO live_conversations FROM public.conversations c WHERE c.reply_address = ANY (locals);

  -- A conversation's address, and no live quote request's: the message joins that conversation, whoever sent it.
  IF COALESCE(array_length(live_requests, 1), 0) = 0 AND COALESCE(array_length(live_conversations, 1), 0) = 1 THEN
    SELECT * INTO conv FROM public.conversations c WHERE c.id = live_conversations[1];
    -- One of the conversation's firm's current people, by their sign-in address or their connected mailbox's: their own copy, sent by hand.
    IF EXISTS (
      SELECT 1 FROM public.firm_memberships fm JOIN auth.users u ON u.id = fm.user_id LEFT JOIN public.broker_mailboxes b ON b.user_id = fm.user_id
      WHERE fm.firm_id = conv.firm_id AND public.membership_is_current(fm.valid_from, fm.valid_until)
        AND (lower(u.email) = from_addr OR lower(b.address) = from_addr)
    ) THEN
      dir := 'sent_by_hand';
    ELSE
      dir := 'inbound';
    END IF;
    -- A sender not seen on the conversation before: not an earlier message's sender, and no one an earlier message was addressed or copied to (the contact
    -- the agent wrote to is not a stranger). Never an automatic reply or the firm's own copy.
    IF dir = 'inbound' AND NOT COALESCE(p_is_automatic, false) THEN
      fresh := NOT EXISTS (
        SELECT 1 FROM public.conversation_messages m
        WHERE m.conversation_id = conv.id
          AND (lower(m.from_address) = from_addr OR from_addr = ANY (SELECT lower(x) FROM unnest(m.to_addresses || m.cc_addresses) x)));
    END IF;
    -- Its own Message-ID, so the agent's answer to it names it (In-Reply-To, M-2.1), and the one it answers. A Message-ID that isn't one, or that names a
    -- message already kept (the same message delivered twice), gives way to one of its own, made from the provider's id.
    own_mid := btrim(COALESCE(p_headers ->> 'message-id', ''));
    IF own_mid !~ '^<[^<>\s]+>$' OR char_length(own_mid) > 300 OR EXISTS (SELECT 1 FROM public.conversation_messages m WHERE m.message_id = own_mid) THEN
      own_mid := '<' || p_provider_message_id || '@inbound.invalid>';
    END IF;
    answers := left(substring(btrim(COALESCE(p_headers ->> 'in-reply-to', '')) FROM '^<[^<>\s]+>$'), 300);
    INSERT INTO public.conversation_messages (firm_id, conversation_id, direction, status, is_automatic, new_sender, from_address, from_name, to_addresses, cc_addresses, subject, body_text,
                                              message_id, in_reply_to, provider_message_id, sent_at)
    VALUES (conv.firm_id, conv.id, dir, 'received', COALESCE(p_is_automatic, false), fresh, from_addr, NULLIF(left(btrim(COALESCE(p_from_name, '')), 200), ''),
            COALESCE((SELECT array_agg(lower(btrim(x))) FROM unnest(COALESCE(p_to, '{}')) x), '{}'),
            COALESCE((SELECT array_agg(lower(btrim(x))) FROM unnest(COALESCE(p_cc, '{}')) x), '{}'),
            COALESCE(left(p_subject, 998), ''), COALESCE(p_body_text, ''),
            own_mid, answers, p_provider_message_id, p_sent_at)
    ON CONFLICT (provider_message_id) DO NOTHING
    RETURNING * INTO cmsg;
    IF cmsg.id IS NULL THEN
      -- Another call recorded it between the check and the insert.
      SELECT * INTO cmsg FROM public.conversation_messages m WHERE m.provider_message_id = p_provider_message_id;
      RETURN public.received_conversation_answer(cmsg, true);
    END IF;
    RETURN public.received_conversation_answer(cmsg, false);
  END IF;

  -- Every address of ours the message was sent to, live or revoked: whose firms they are, and the first of them by name.
  SELECT array_agg(DISTINCT s.firm_id), min(a.local_part) INTO matched_firms, matched_local
  FROM public.quote_request_addresses a JOIN public.chamber_sessions s ON s.id = a.session_id
  WHERE a.local_part = ANY (locals);
  -- And the firms of the conversations it names: two conversations' addresses make it ambiguous, held for their firm when they are one firm's.
  matched_firms := NULLIF(ARRAY(
    SELECT DISTINCT f FROM unnest(COALESCE(matched_firms, '{}') || ARRAY(SELECT c.firm_id FROM public.conversations c WHERE c.id = ANY (live_conversations))) f
    ORDER BY f), '{}');

  IF COALESCE(array_length(live_requests, 1), 0) = 1 THEN
    SELECT * INTO req FROM public.quote_requests WHERE id = live_requests[1];
    SELECT a.local_part INTO chosen_local FROM public.quote_request_addresses a
      WHERE a.quote_request_id = req.id AND a.local_part = ANY (locals) AND a.revoked_at IS NULL LIMIT 1;
  ELSIF COALESCE(array_length(live_requests, 1), 0) > 1 OR COALESCE(array_length(live_conversations, 1), 0) > 1 THEN
    reason := 'ambiguous_address';
  ELSIF matched_local IS NOT NULL THEN
    -- Addresses of two firms on one message are ambiguous too: no one firm can claim it.
    reason := CASE WHEN array_length(matched_firms, 1) > 1 THEN 'ambiguous_address' ELSE 'revoked_address' END;
  ELSE
    reason := 'unknown_address';
  END IF;
  -- Mail held for one firm's address, or addresses, is that firm's; anything else is the platform's alone (no firm).
  IF req.id IS NULL AND array_length(matched_firms, 1) = 1 THEN
    held_firm := matched_firms[1];
  END IF;
  IF chosen_local IS NULL THEN
    chosen_local := COALESCE(matched_local, locals[1]);
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
    provider_message_id, quote_request_id, session_id, firm_id, address_local_part, held_reason, direction, is_automatic,
    new_sender, from_address, from_name, to_addresses, cc_addresses, subject, body_text, body_truncated, headers, sent_at)
  VALUES (
    p_provider_message_id, req.id, req.session_id, held_firm, chosen_local, reason, dir, COALESCE(p_is_automatic, false),
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

-- ---------- 3. A message as the reads answer it ----------
-- conversation_message_fields is restated in section 7, with each message's attachments: 6.2's fields (20261122090000), every one kept, and who sent a
-- received message by name, whether it is automatic, whether its sender is new, and whether the sender is offered as a contact.

-- ---------- 4. Adding a new sender as a contact (CRM-E1.3) ----------
-- The sender of a received message offered as a contact (conversation_message_fields' offer_contact) is added to the account of the conversation's contact,
-- with their address, through add_contact and every one of its rules (the firm, a closing firm and a support session, the account seen and not archived, the
-- fields, the owner by the level rule). Answers what add_contact answers. Refused, before add_contact's own: a message on a conversation the caller may not
-- see, another firm's or none, PT404, as add_contact's account is; a message on a lead's conversation (a lead has no account, D-662), PT409; a sender not
-- offered (already a contact on the account, the contact's own reply, the firm's own copy, an automatic reply, a message sent), PT409.
CREATE FUNCTION public.add_sender_as_contact(
  p_message_id uuid, p_first_name text DEFAULT NULL, p_last_name text DEFAULT NULL, p_title text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_mobile text DEFAULT NULL, p_owner_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  m public.conversation_messages;
  account uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  -- add_contact asks it again; asked here first, so a closing firm or a support session is refused before anything about the message is said.
  PERFORM public.assert_firm_writable(firm);
  -- The message is held to the end of this transaction, so two people adding the same sender at once are ordered and the second is told it's done.
  SELECT x.* INTO m FROM public.conversation_messages x WHERE x.id = p_message_id AND x.firm_id = firm FOR UPDATE;
  SELECT k.account_id INTO account FROM public.conversations v JOIN public.contacts k ON k.id = v.contact_id JOIN public.accounts a ON a.id = k.account_id
  WHERE v.id = m.conversation_id AND public.can_see_firm_record(a.firm_id, a.owner_id);
  IF account IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.conversations v JOIN public.leads l ON l.id = v.lead_id
               WHERE v.id = m.conversation_id AND public.can_see_firm_record(l.firm_id, l.owner_id)
                 AND (l.deleted_at IS NULL OR public.firm_role(l.firm_id) = 'owner' OR public.is_support_session(l.firm_id))) THEN
      RAISE EXCEPTION 'A lead''s conversation has no account to add a contact to.' USING ERRCODE = 'PT409';
    END IF;
    RAISE EXCEPTION 'That message isn''t one you can see.' USING ERRCODE = 'PT404';
  END IF;
  IF NOT (public.conversation_message_fields(m) ->> 'offer_contact')::boolean THEN
    RAISE EXCEPTION 'This sender isn''t one to add: they are already a contact, or the message isn''t from someone new.' USING ERRCODE = 'PT409';
  END IF;
  RETURN public.add_contact(account, p_first_name, p_last_name, p_title, m.from_address, p_phone, p_mobile, p_owner_id, false, false, firm);
END;
$$;

REVOKE ALL ON FUNCTION public.add_sender_as_contact(uuid, text, text, text, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_sender_as_contact(uuid, text, text, text, text, text, uuid, uuid) TO authenticated;

-- ---------- 5. New mail on a conversation (D-607) ----------
-- One mark per conversation for the firm, as PEO threads have (quote_request_thread_reads): when anyone last opened it, through which moment, and who. New
-- mail is a message from a person (inbound, not automatic: an out-of-office is not, and the firm's own copy is sent by hand) recorded after that moment. The
-- inbox (6.5) and Home read it through conversation_has_new_mail, so they cannot disagree with the conversation's read.
ALTER TABLE public.conversations ADD COLUMN last_opened_at timestamptz;
ALTER TABLE public.conversations ADD COLUMN last_opened_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE FUNCTION public.conversation_has_new_mail(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_messages m JOIN public.conversations v ON v.id = m.conversation_id
    WHERE m.conversation_id = p_conversation_id AND m.direction = 'inbound' AND NOT m.is_automatic
      AND m.recorded_at > COALESCE(v.last_opened_at, '-infinity'::timestamptz))
$$;

REVOKE ALL ON FUNCTION public.conversation_has_new_mail(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- conversation_for restated from 20261122090000, every rule kept; the conversation now says whether it has new mail.
CREATE OR REPLACE FUNCTION public.conversation_for(p_contact_id uuid DEFAULT NULL, p_lead_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  conv public.conversations;
  msgs jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF NOT (
    (p_contact_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
      WHERE c.id = p_contact_id AND c.firm_id = firm AND public.can_see_firm_record(a.firm_id, a.owner_id)))
    OR (p_contact_id IS NULL AND p_lead_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = p_lead_id AND l.firm_id = firm AND public.can_see_firm_record(l.firm_id, l.owner_id)
        AND (l.deleted_at IS NULL OR public.firm_role(l.firm_id) = 'owner' OR public.is_support_session(l.firm_id))))) THEN
    RAISE EXCEPTION 'That contact or lead isn''t one you can see.' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO conv FROM public.conversations c
  WHERE c.firm_id = firm AND (c.contact_id = p_contact_id OR (p_contact_id IS NULL AND c.lead_id = p_lead_id));
  SELECT COALESCE(jsonb_agg(public.conversation_message_fields(x) ORDER BY x.recorded_at DESC, x.id DESC), '[]'::jsonb) INTO msgs
  FROM (SELECT m.* FROM public.conversation_messages m WHERE m.conversation_id = conv.id ORDER BY m.recorded_at DESC, m.id DESC LIMIT 500) x;
  RETURN jsonb_build_object(
    'conversation', CASE WHEN conv.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', conv.id, 'reply_address', conv.reply_address, 'contact_id', conv.contact_id, 'lead_id', conv.lead_id, 'created_at', conv.created_at,
      'new_mail', public.conversation_has_new_mail(conv.id)) END,
    'messages', msgs,
    -- The caller's own mailbox (CRM-E1.1): connected, and whether their newest send failed for a mailbox reason. Not connected after such a failure is
    -- Reconnect; not connected otherwise is Connect.
    'mailbox', jsonb_build_object(
      'connected', EXISTS (SELECT 1 FROM public.broker_mailboxes b WHERE b.user_id = auth.uid()),
      'last_send_failed', COALESCE((
        SELECT m.status = 'failed' AND m.failure_kind = 'mailbox' FROM public.conversation_messages m
        WHERE m.sender_id = auth.uid() ORDER BY m.recorded_at DESC, m.id DESC LIMIT 1), false)));
END;
$$;

-- Opening a conversation clears its mark for the whole firm, through the moment of the newest message the page showed (so mail that came after the page loaded
-- stays new); never backwards; with no moment, now. For a conversation the caller may see (the level rule, as conversation_for); any other, another firm's
-- or none, PT404. Answers {last_opened_at}. Allowed while a firm is closing: it only marks what was read, as advisor_open_quote_request_thread.
CREATE FUNCTION public.open_conversation(p_conversation_id uuid, p_seen_through timestamptz DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  seen timestamptz := LEAST(COALESCE(p_seen_through, now()), now());
  conv public.conversations;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT v.* INTO conv FROM public.conversations v
  WHERE v.id = p_conversation_id AND v.firm_id = firm
    AND (EXISTS (SELECT 1 FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
                 WHERE c.id = v.contact_id AND public.can_see_firm_record(a.firm_id, a.owner_id))
         OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = v.lead_id AND public.can_see_firm_record(l.firm_id, l.owner_id)
                    AND (l.deleted_at IS NULL OR public.firm_role(l.firm_id) = 'owner' OR public.is_support_session(l.firm_id))));
  IF conv.id IS NULL THEN
    RAISE EXCEPTION 'That conversation isn''t one you can see.' USING ERRCODE = 'PT404';
  END IF;
  -- A support session reads and marks nothing (ADR 0024): the mark is the firm's, and the admin is never left as who opened it.
  IF NOT public.is_support_session(firm) THEN
    UPDATE public.conversations v
    SET last_opened_at = seen, last_opened_by = auth.uid()
    WHERE v.id = conv.id AND (v.last_opened_at IS NULL OR v.last_opened_at < seen);
  END IF;
  RETURN jsonb_build_object('last_opened_at', (SELECT v.last_opened_at FROM public.conversations v WHERE v.id = p_conversation_id));
END;
$$;

REVOKE ALL ON FUNCTION public.open_conversation(uuid, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_conversation(uuid, timestamptz, uuid) TO authenticated;

-- ---------- 6. One message on every record it belongs to (D-601) ----------
-- What an account's page and an opportunity's page read: the messages of the conversations of the account's contacts (an opportunity's are its account's),
-- newest first, at most 500, each as conversation_for answers it plus the contact whose conversation it is on and whether that conversation has new mail.
-- From the one row each message is (no copy per record). For an account, or an opportunity and its account, the caller may see by the level rule; any other,
-- another firm's or none, PT404. No screen reads it yet (6.3 and 6.5).
CREATE FUNCTION public.account_conversation_messages(p_account_id uuid DEFAULT NULL, p_opportunity_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  account uuid;
  msgs jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF p_opportunity_id IS NOT NULL THEN
    SELECT a.id INTO account FROM public.opportunities o JOIN public.accounts a ON a.id = o.account_id
    WHERE o.id = p_opportunity_id AND o.firm_id = firm AND public.can_see_firm_record(o.firm_id, o.owner_id) AND public.can_see_firm_record(a.firm_id, a.owner_id);
  ELSE
    SELECT a.id INTO account FROM public.accounts a WHERE a.id = p_account_id AND a.firm_id = firm AND public.can_see_firm_record(a.firm_id, a.owner_id);
  END IF;
  IF account IS NULL THEN
    RAISE EXCEPTION 'That account or opportunity isn''t one you can see.' USING ERRCODE = 'PT404';
  END IF;
  SELECT COALESCE(jsonb_agg(public.conversation_message_fields(x.m) || jsonb_build_object('contact_id', x.contact_id, 'new_mail', x.new_mail)
                            ORDER BY (x.m).recorded_at DESC, (x.m).id DESC), '[]'::jsonb) INTO msgs
  FROM (SELECT m, v.contact_id, public.conversation_has_new_mail(v.id) AS new_mail
        FROM public.conversation_messages m JOIN public.conversations v ON v.id = m.conversation_id JOIN public.contacts c ON c.id = v.contact_id
        WHERE c.account_id = account AND v.firm_id = firm
        ORDER BY m.recorded_at DESC, m.id DESC LIMIT 500) x;
  RETURN jsonb_build_object('messages', msgs);
END;
$$;

REVOKE ALL ON FUNCTION public.account_conversation_messages(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_conversation_messages(uuid, uuid, uuid) TO authenticated;
-- Indexed already: a contact's conversation by conversations_one_per_contact, a conversation's messages newest first by conversation_messages_conversation_idx.

-- ---------- 7. A received message's attachments ----------
-- PEO mail's rules (20261111110000_quote_request_messages.sql), on a table of their own beside the quote requests' (ADR 0007): each attachment's name, type
-- and size, and what became of it, `stored` (scanned clean, kept in the contact-mail bucket), `blocked` (the scanner found malware: only the signature is
-- kept), `not_kept` (another type than uploads take, over 20 MB, or not what its name says) or `pending` (waiting for a scan; unreadable meanwhile). Each file
-- is settled by its own scan, so a failed scan blocks only that file. Written only by the receive-mail function (the service role).
ALTER TABLE public.conversation_messages ADD CONSTRAINT conversation_messages_firm_id_id_key UNIQUE (firm_id, id);

CREATE TABLE public.conversation_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  message_id uuid NOT NULL,
  provider_attachment_id text NOT NULL CONSTRAINT conversation_message_attachments_provider_id_check CHECK (char_length(provider_attachment_id) BETWEEN 1 AND 200),
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
  CONSTRAINT conversation_message_attachments_once UNIQUE (message_id, provider_attachment_id),
  -- On a message of its own firm, and gone with it.
  CONSTRAINT conversation_message_attachments_message_fkey FOREIGN KEY (firm_id, message_id) REFERENCES public.conversation_messages (firm_id, id) ON DELETE CASCADE,
  -- The same states and reasons as PEO mail's (quote_request_message_attachments_status_check).
  CONSTRAINT conversation_message_attachments_status_check CHECK (
    status IN ('pending', 'stored', 'blocked', 'not_kept')
    AND (status = 'not_kept') = (not_kept_reason IS NOT NULL)
    AND (not_kept_reason IS NULL OR not_kept_reason IN ('too_large', 'unsupported_type', 'type_mismatch', 'executable'))
    AND (status = 'stored') = (storage_path IS NOT NULL)
    AND (status <> 'stored' OR (scan_verdict IN ('clean', 'skipped') AND storage_bucket = 'contact-mail'))
    AND (status <> 'blocked' OR scan_verdict = 'infected')
    AND size_bytes >= 0
    AND char_length(file_name) BETWEEN 1 AND 255)
);

CREATE INDEX conversation_message_attachments_message_idx ON public.conversation_message_attachments (message_id);
CREATE INDEX conversation_message_attachments_firm_idx ON public.conversation_message_attachments (firm_id);

-- Records that a received message had this attachment, pending unless it is already known not to be kept. A repeat returns the row as it stands.
CREATE FUNCTION public.record_conversation_attachment(
  p_message_id uuid, p_provider_attachment_id text, p_file_name text, p_content_type text, p_size_bytes bigint, p_not_kept_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  m public.conversation_messages;
  att public.conversation_message_attachments;
BEGIN
  SELECT * INTO m FROM public.conversation_messages x WHERE x.id = p_message_id AND x.direction <> 'outbound';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO public.conversation_message_attachments (firm_id, message_id, provider_attachment_id, file_name, content_type, size_bytes, status, not_kept_reason)
  VALUES (m.firm_id, m.id, p_provider_attachment_id, COALESCE(NULLIF(left(btrim(COALESCE(p_file_name, '')), 255), ''), 'attachment'),
          left(p_content_type, 200), GREATEST(COALESCE(p_size_bytes, 0), 0),
          CASE WHEN p_not_kept_reason IS NULL THEN 'pending' ELSE 'not_kept' END, p_not_kept_reason)
  ON CONFLICT (message_id, provider_attachment_id) DO NOTHING;
  SELECT * INTO att FROM public.conversation_message_attachments x WHERE x.message_id = m.id AND x.provider_attachment_id = p_provider_attachment_id;
  RETURN jsonb_build_object('id', att.id, 'status', att.status, 'file_name', att.file_name);
END;
$$;

REVOKE ALL ON FUNCTION public.record_conversation_attachment(uuid, text, text, text, bigint, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_conversation_attachment(uuid, text, text, text, bigint, text) TO service_role;

-- Settles a pending attachment as finish_inbound_attachment settles a PEO's: a clean or skipped scan stores it (at the path the function stored it under, in
-- the contact-mail bucket), an infected one blocks it, and a file found not to be what it says is listed with its reason. Only a pending attachment changes; a
-- repeat returns the row as it stands.
CREATE FUNCTION public.finish_conversation_attachment(
  p_attachment_id uuid, p_verdict text, p_signature text DEFAULT NULL, p_bucket text DEFAULT NULL, p_path text DEFAULT NULL,
  p_sha256 text DEFAULT NULL, p_not_kept_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  att public.conversation_message_attachments;
BEGIN
  SELECT * INTO att FROM public.conversation_message_attachments x WHERE x.id = p_attachment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attachment not found' USING ERRCODE = 'PT404';
  END IF;
  IF att.status <> 'pending' THEN
    RETURN jsonb_build_object('id', att.id, 'status', att.status, 'changed', false);
  END IF;
  IF p_not_kept_reason IS NOT NULL THEN
    UPDATE public.conversation_message_attachments x SET status = 'not_kept', not_kept_reason = p_not_kept_reason, updated_at = now() WHERE x.id = att.id;
  ELSIF p_verdict IN ('clean', 'skipped') THEN
    IF p_bucket IS DISTINCT FROM 'contact-mail' OR COALESCE(p_path, '') = '' THEN
      RAISE EXCEPTION 'A stored attachment needs its place in the contact-mail bucket' USING ERRCODE = '22023';
    END IF;
    UPDATE public.conversation_message_attachments x
    SET status = 'stored', scan_verdict = p_verdict, storage_bucket = p_bucket, storage_path = p_path, sha256 = p_sha256, updated_at = now()
    WHERE x.id = att.id;
  ELSIF p_verdict = 'infected' THEN
    UPDATE public.conversation_message_attachments x
    SET status = 'blocked', scan_verdict = 'infected', scan_signature = left(p_signature, 200), updated_at = now() WHERE x.id = att.id;
  ELSE
    RAISE EXCEPTION 'An attachment is settled as clean, skipped, infected or not kept, not %', COALESCE(p_verdict, 'nothing') USING ERRCODE = '22023';
  END IF;
  SELECT * INTO att FROM public.conversation_message_attachments x WHERE x.id = p_attachment_id;
  RETURN jsonb_build_object('id', att.id, 'status', att.status, 'changed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.finish_conversation_attachment(uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finish_conversation_attachment(uuid, text, text, text, text, text, text) TO service_role;

-- A message's attachments as the reads show them: name, type, size and state, and where a stored one is kept (read through a signed link, by the bucket's
-- policy). Never the scanner's signature. Internal.
CREATE FUNCTION public.conversation_message_attachment_list(p_message_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'file_name', a.file_name, 'content_type', a.content_type, 'size_bytes', a.size_bytes, 'status', a.status,
                                               'not_kept_reason', a.not_kept_reason, 'storage_path', a.storage_path) ORDER BY a.recorded_at, a.id), '[]'::jsonb)
  FROM public.conversation_message_attachments a WHERE a.message_id = p_message_id
$$;

REVOKE ALL ON FUNCTION public.conversation_message_attachment_list(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- conversation_message_fields restated from 20261122090000, every field kept, with what a received message adds: who sent it by name, whether it is
-- automatic, whether its sender is new, whether the sender is offered as a contact, and its attachments.
CREATE OR REPLACE FUNCTION public.conversation_message_fields(m public.conversation_messages)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', m.id, 'conversation_id', m.conversation_id, 'direction', m.direction, 'from_address', m.from_address, 'to_addresses', to_jsonb(m.to_addresses), 'cc_addresses', to_jsonb(m.cc_addresses),
    'subject', m.subject, 'body_text', m.body_text, 'message_id', m.message_id, 'in_reply_to', m.in_reply_to,
    'message_references', to_jsonb(m.message_references), 'sender_id', m.sender_id, 'status', m.status,
    'from_name', m.from_name, 'is_automatic', m.is_automatic, 'new_sender', m.new_sender,
    -- A new sender on a contact's conversation who is no contact on that account yet is offered as one (add_sender_as_contact). A lead has no account, so
    -- its conversation offers nothing (D-662).
    'offer_contact', m.new_sender AND m.direction = 'inbound' AND EXISTS (
      SELECT 1 FROM public.conversations v JOIN public.contacts k ON k.id = v.contact_id
      WHERE v.id = m.conversation_id
        AND NOT EXISTS (SELECT 1 FROM public.contacts o WHERE o.account_id = k.account_id AND lower(btrim(o.email)) = lower(m.from_address))),
    'attachments', public.conversation_message_attachment_list(m.id))
$$;

-- ---------- 8. Who reads a received file ----------
-- An attachment's row by whoever reads its message (and so its conversation, by the level rule); written by no API role.
ALTER TABLE public.conversation_message_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_message_attachments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.conversation_message_attachments TO authenticated, service_role;

CREATE POLICY conversation_message_attachments_visible ON public.conversation_message_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversation_messages m WHERE m.id = conversation_message_attachments.message_id));

-- Clean files of contact mail are kept in their own bucket, beside PEO mail's (whose files are an intake's): only the receive-mail function stores one. A
-- person reads a file recorded as stored on a message they may read, through a signed link; never one the scanner hasn't passed. Not a support session's:
-- the firm's files are not support's to download, as for every other bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact-mail', 'contact-mail', false)
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
    WHERE id = 'contact-mail';
  END IF;
END $$;

CREATE POLICY "Firm members can read their contacts' mail files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contact-mail'
    AND EXISTS (
      SELECT 1 FROM public.conversation_message_attachments a
      WHERE a.storage_bucket = 'contact-mail' AND a.storage_path = name AND a.status = 'stored' AND NOT public.is_support_session(a.firm_id)
    )
  );

-- ---------- 9. Closing a firm deletes the received files' rows (ADR 0023) ----------
-- The closing's one list, restated from its LATEST definition (20261122100500_conversations_closing.sql) with every line it had, and the received files: their
-- rows deleted with the conversations' messages (ord 58; within one ord the closing goes by name, so the files go first), their bytes kept, unreadable (D-667).
CREATE OR REPLACE FUNCTION public.firm_closing_plan()
RETURNS TABLE (ord integer, src text, action text, firm_column text, why text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    -- Deleted: the firm's own working data.
    (10, 'public.firm_invitations', 'delete', 'firm_id', 'pending and past invitations to join'),
    (20, 'public.firm_organisations', 'delete', 'firm_id', 'the listed Google domains and Microsoft tenants'),
    (30, 'public.join_requests', 'delete', 'firm_id', 'requests to join'),
    (40, 'public.table_preferences', 'delete', 'firm_id', 'each person''s column choices'),
    (50, 'public.saved_views', 'delete', 'firm_id', 'saved views'),
    (55, 'public.record_history', 'delete', 'firm_id', 'the history of each record: who created it and every change to its fields; it goes with the record'),
    (56, 'public.recent_records', 'delete', 'firm_id', 'each person''s last opened records, for the search box'),
    (56, 'public.bulk_change_records', 'delete', 'firm_id', 'what each bulk change did to each record, kept for ten minutes'' undo'),
    (57, 'public.bulk_changes', 'delete', 'firm_id', 'bulk changes, kept for ten minutes'' undo'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (58, 'public.activities', 'delete', 'firm_id', 'calls, notes and tasks on the firm''s accounts, contacts and leads; before the opportunities, contacts and accounts they stand on'),
    (58, 'public.conversation_message_attachments', 'delete', 'firm_id', 'the files received on the firm''s contact and lead mail, each one''s name, size and scan; before the messages they are on'),
    (58, 'public.conversation_messages', 'delete', 'firm_id', 'the mail with the firm''s contacts and leads; before the conversations they are on'),
    (58, 'public.conversations', 'delete', 'firm_id', 'the conversations with the firm''s contacts and leads, their reply addresses with them; before the contacts and leads they are with'),
    (59, 'public.account_labels', 'delete', 'firm_id', 'the labels on the firm''s accounts; before the accounts they stand on'),
    (59, 'public.lead_labels', 'delete', 'firm_id', 'the labels on the firm''s leads; before the leads they stand on'),
    (60, 'public.leads', 'delete', 'firm_id', 'leads, the people and businesses the firm is not quoting yet, the bin with them; after their calls, notes and tasks'),
    (61, 'public.opportunities', 'delete', 'firm_id', 'opportunities (each is one search for one account); before the contacts and accounts they stand on'),
    (62, 'public.contacts', 'delete', 'firm_id', 'contacts, the people at the firm''s accounts'),
    (63, 'public.accounts', 'delete', 'firm_id', 'accounts, the businesses the firm quotes for; the intakes on their opportunities stay with their employers (below)'),
    (64, 'public.labels', 'delete', 'firm_id', 'the firm''s own list of labels; after the accounts that carried them'),
    (70, 'public.firm_teams', 'delete', 'firm_id', 'teams (the memberships that named one are cleared first)'),
    -- Kept, and why.
    (900, 'public.firms', 'keep', NULL, 'the row stays: its address stays taken for twelve months and its record must still exist'),
    (900, 'public.firm_memberships', 'keep', NULL, 'every membership is ended, not deleted: a membership is the dated record of who belonged (it is never changed)'),
    (900, 'public.firm_member_suspensions', 'keep', NULL, 'each open one is ended; the rows are the dated record of who was suspended'),
    (900, 'public.firm_activity', 'keep', NULL, 'the firm''s own record is pruned after ninety days by its own job (D-45)'),
    (900, 'public.firm_suspensions', 'keep', NULL, 'the platform''s record of suspensions'),
    (900, 'public.firm_closures', 'keep', NULL, 'the platform''s record of this: when it was asked, by whom, when it closed, and what was deleted, without content'),
    (900, 'public.support_sessions', 'keep', NULL, 'the platform''s record of each time Nevermore looked at the firm: who, why, when it started and ended (a session ends when the firm closes)'),
    (900, 'public.advisor_field_reviews', 'keep', NULL, 'an intake''s: it stays for its employer under the intake retention rules'),
    (900, 'public.advisor_notes', 'keep', NULL, 'an intake''s'),
    (900, 'public.advisor_review_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.ai_extraction_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.chamber_certifications', 'keep', NULL, 'an intake''s'),
    (900, 'public.chamber_sessions', 'keep', NULL, 'the intakes: they belong to the employer who made them and are not the firm''s to delete'),
    (900, 'public.document_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.documents', 'keep', NULL, 'an intake''s'),
    (900, 'public.information_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.intake_consents', 'keep', NULL, 'the employer''s own agreement'),
    (900, 'public.intake_deletions', 'keep', NULL, 'the record that an intake was deleted, kept after it'),
    (900, 'public.intake_lifecycle_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.manuscript_versions', 'keep', NULL, 'an intake''s'),
    (900, 'public.peo_authorizations', 'keep', NULL, 'the employer''s own say over which PEOs may receive their packet; an intake''s'),
    (900, 'public.profiles', 'keep', NULL, 'the employer''s own profile'),
    (900, 'public.quote_request_addresses', 'keep', NULL, 'a quote request''s: quote requests belong to an intake'),
    (900, 'public.quote_request_events', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_message_attachments', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_messages', 'keep', NULL, 'a quote request''s mail thread with a PEO'),
    (900, 'public.quote_request_messages WHERE quote_request_id IS NULL', 'keep', NULL, 'held mail from a PEO: held for the platform once the firm has no members, and discarded by the holding list''s own schedule'),
    (900, 'public.quote_request_notes', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_thread_reads', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_status_history', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_workflow', 'keep', NULL, 'an intake''s'),
    (900, 'storage.objects WHERE bucket_id = ''documents''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''manuscripts''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''contact-mail''', 'keep', NULL, 'the bytes of files received on the firm''s contact mail: unreadable once the closing deletes their rows (the bucket is read only through a stored attachment''s row), and not removable from SQL (D-667)'),
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;
