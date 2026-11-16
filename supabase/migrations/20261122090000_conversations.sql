-- Conversations with contacts and leads (story CRM-E1.2a, slice 6.2, #196; docs/BROKER_CRM_BUILD.md D-601, D-602, D-605, D-606 and D-630 to D-639;
-- supabase/tests/conversations.sql).
--
-- Mail with a contact or a lead has its own store, beside the quote requests' threads, which are not widened (D-601, ADR 0007): a conversation (one per
-- contact, one per lead, shared by the firm, with its own reply address) and its messages. A message is sent through the sender's own connected mailbox by
-- the send-mail function (D-602, ADR 0005): it is recorded here as queued first, and the outbox carries only its id.

-- ---------- 1. Conversations ----------
-- The pair a conversation points at, so its contact is of its own firm (as leads_firm_id_id_key does for leads). Added to, nothing replaced (ADR 0007).
ALTER TABLE public.contacts ADD CONSTRAINT contacts_firm_id_id_key UNIQUE (firm_id, id);

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  contact_id uuid,
  lead_id uuid,
  -- The part before the @ of the address replies come back to (D-606); the domain is the receiving subdomain, a setting. It names this conversation for good.
  reply_address text NOT NULL CONSTRAINT conversations_reply_address_key UNIQUE
    CONSTRAINT conversations_reply_address_check CHECK (reply_address ~ '^c\.[a-z0-9]{1,20}\.[0-9a-f]{16}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_contact_or_lead CHECK ((contact_id IS NULL) <> (lead_id IS NULL)),
  -- One per contact and one per lead (D-601).
  CONSTRAINT conversations_one_per_contact UNIQUE (contact_id),
  CONSTRAINT conversations_one_per_lead UNIQUE (lead_id),
  -- Its contact or lead is of its own firm, and it goes with them: a contact goes with its account (D-806 removes a lead from the bin).
  CONSTRAINT conversations_contact_fkey FOREIGN KEY (firm_id, contact_id) REFERENCES public.contacts (firm_id, id) ON DELETE CASCADE,
  CONSTRAINT conversations_lead_fkey FOREIGN KEY (firm_id, lead_id) REFERENCES public.leads (firm_id, id) ON DELETE CASCADE,
  CONSTRAINT conversations_firm_id_id_key UNIQUE (firm_id, id)
);

-- ---------- 2. Messages ----------
CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  direction text NOT NULL,
  from_address text NOT NULL,
  to_addresses text[] NOT NULL,
  cc_addresses text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL,
  body_text text NOT NULL,
  -- Its own Message-ID, <id@the From domain> (M-2.1), set when it is recorded. It names one message, so a reply's In-Reply-To finds it (CRM-E1.3).
  message_id text NOT NULL CONSTRAINT conversation_messages_message_id_key UNIQUE,
  -- The message this one answers, when the writer names one (M-2.1): its Message-ID, and the thread's Message-IDs, oldest first. Otherwise none.
  in_reply_to text,
  message_references text[] NOT NULL DEFAULT '{}',
  sender_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  -- Recorded queued before anything is sent (D-602), then sent or failed by the send-mail function. Never delivered or bounced: the product has no
  -- delivery events for a send through a mailbox (ADR 0005).
  status text NOT NULL DEFAULT 'queued' CONSTRAINT conversation_messages_status_check CHECK (status IN ('queued', 'sent', 'failed')),
  -- Why a failed message did not go (D-632): the sender's mailbox (not connected, taken back, or more than sending: the place to write says Connect or
  -- Reconnect), refused by Google or Microsoft, uncertain (it may have gone: the sender looks in their Sent folder), or retried until the retries ran out.
  failure_kind text CONSTRAINT conversation_messages_failure_kind_check CHECK (failure_kind IN ('mailbox', 'refused', 'uncertain', 'unavailable')),
  failure_reason text CONSTRAINT conversation_messages_failure_reason_check CHECK (btrim(failure_reason) <> '' AND char_length(failure_reason) <= 500),
  -- Gmail's message id; Microsoft Graph returns none, so a Microsoft send records our own Message-ID (D-633). One send is one message.
  provider_message_id text CONSTRAINT conversation_messages_provider_message_id_key UNIQUE
    CONSTRAINT conversation_messages_provider_message_id_check CHECK (char_length(provider_message_id) <= 300),
  CONSTRAINT conversation_messages_failed_says_why CHECK ((status = 'failed') = (failure_kind IS NOT NULL AND failure_reason IS NOT NULL)
                                                          AND (status = 'failed' OR (failure_kind IS NULL AND failure_reason IS NULL))),
  -- On a conversation of its own firm, and gone with it.
  CONSTRAINT conversation_messages_conversation_fkey FOREIGN KEY (firm_id, conversation_id) REFERENCES public.conversations (firm_id, id) ON DELETE CASCADE
);

-- ---------- 3. Row security ----------
-- Read by the level rule, as calls, notes and tasks are (activities_visible, 20261121090000): a contact's conversation by whoever may see its account (so it
-- follows the contact to another account), a lead's as the lead's row is, the bin's by its owners and support only. A message by whoever reads its
-- conversation. Written by no API role: send_conversation_message and the send-mail function's own functions do.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.conversations TO authenticated, service_role;

CREATE POLICY conversations_visible ON public.conversations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
            WHERE c.id = conversations.contact_id AND public.can_see_firm_record(a.firm_id, a.owner_id))
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = conversations.lead_id AND public.can_see_firm_record(l.firm_id, l.owner_id)
               AND (l.deleted_at IS NULL OR public.firm_role(l.firm_id) = 'owner' OR public.is_support_session(l.firm_id))));

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_messages FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.conversation_messages TO authenticated, service_role;

CREATE POLICY conversation_messages_visible ON public.conversation_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_messages.conversation_id));

-- ---------- 4. The outbox carries a message by its id (D-602) ----------
-- A new kind on the outbox every email uses, belonging to the firm (not to an intake). Its event carries the message's id and nothing else; the send-mail
-- function reads the message itself. Restated with every kind it had (20261119090000).
ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_events_one_target;
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_events_one_target CHECK (
  CASE WHEN kind IN ('member_left', 'firm_closing', 'export_alert', 'conversation_message') THEN session_id IS NULL AND firm_id IS NOT NULL
  ELSE session_id IS NOT NULL AND firm_id IS NULL END);

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request', 'draft_expiry_reminder', 'peo_mail_arrived', 'member_left', 'firm_closing', 'export_alert',
    'conversation_message'
    -- sync:end outbox_kinds
  ));

-- ---------- 5. A conversation's reply address (D-606) ----------
-- c.<the business or the name, letters and digits, at most 20>.<16 random hex>. The c. prefix can't be a File ID, so it never reads as a quote request's.
CREATE FUNCTION public.new_conversation_address(p_name text)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT 'c.' || COALESCE(NULLIF(left(regexp_replace(lower(COALESCE(p_name, '')), '[^a-z0-9]+', '', 'g'), 20), ''), 'contact')
    || '.' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)
$$;

REVOKE ALL ON FUNCTION public.new_conversation_address(text) FROM PUBLIC, anon, authenticated, service_role;

-- A message as the read and the send answer it. Internal.
CREATE FUNCTION public.conversation_message_fields(m public.conversation_messages)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', m.id, 'conversation_id', m.conversation_id, 'direction', m.direction, 'from_address', m.from_address, 'to_addresses', to_jsonb(m.to_addresses), 'cc_addresses', to_jsonb(m.cc_addresses),
    'subject', m.subject, 'body_text', m.body_text, 'message_id', m.message_id, 'in_reply_to', m.in_reply_to,
    'message_references', to_jsonb(m.message_references), 'sender_id', m.sender_id, 'status', m.status)
$$;

REVOKE ALL ON FUNCTION public.conversation_message_fields(public.conversation_messages) FROM PUBLIC, anon, authenticated, service_role;

-- The one address rule (D-637): a bare address, no name, no space, no bracket or separator a header could be split on. The send-mail function's message
-- builder holds the same pattern (supabase/functions/_shared/mailAddress.ts; src/data/schemaSync.test.ts compares them), so what the database took is what
-- the builder puts in a header.
CREATE FUNCTION public.is_mail_address(p_address text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_address IS NOT NULL AND char_length(p_address) <= 254 AND p_address ~
    -- sync:begin mail_address_pattern
    '^[^\s@<>,;"()\[\]\\]+@[^\s@<>,;"()\[\]\\]+\.[^\s@<>,;"()\[\]\\]+$'
    -- sync:end mail_address_pattern
$$;

REVOKE ALL ON FUNCTION public.is_mail_address(text) FROM PUBLIC, anon, authenticated, service_role;

-- What is wrong with a message's fields, in words; NULL when nothing is. The CC is already trimmed. Used by the send.
CREATE FUNCTION public.conversation_message_input_error(p_subject text, p_body text, p_cc text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(p_subject), '') IS NULL THEN 'Enter a subject.'
    -- One line: a line break in a subject would start another header.
    WHEN p_subject ~ '[\r\n]' THEN 'A subject is one line.'
    WHEN char_length(btrim(p_subject)) > 300 THEN 'A subject is at most 300 characters.'
    WHEN NULLIF(btrim(p_body, E' \t\r\n'), '') IS NULL THEN 'Write a message.'
    WHEN char_length(p_body) > 50000 THEN 'A message is at most 50,000 characters.'
    WHEN cardinality(p_cc) > 10 THEN 'At most 10 people in CC.'
    WHEN EXISTS (SELECT 1 FROM unnest(p_cc) x WHERE NOT public.is_mail_address(x)) THEN 'Enter each CC address like name@example.com.'
  END
$$;

REVOKE ALL ON FUNCTION public.conversation_message_input_error(text, text, text[]) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 6. Sending one message (D-602) ----------
CREATE FUNCTION public.send_conversation_message(
  p_contact_id uuid DEFAULT NULL, p_lead_id uuid DEFAULT NULL, p_subject text DEFAULT NULL, p_body text DEFAULT NULL, p_cc text[] DEFAULT NULL,
  p_in_reply_to uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  person public.contacts;
  prospect public.leads;
  short_name text;
  to_address text;
  conv public.conversations;
  sender_address text;
  made public.conversation_messages;
  new_id uuid := gen_random_uuid();
  problem text;
  answered public.conversation_messages;
  cc_in text[] := ARRAY(SELECT btrim(x) FROM unnest(COALESCE(p_cc, '{}')) x WHERE btrim(x) <> '');
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  -- The record must be one the caller may see (the level rule, as its calls, notes and tasks are); any other, another firm's or none, reads alike.
  IF p_contact_id IS NOT NULL THEN
    SELECT c.* INTO person FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
    WHERE c.id = p_contact_id AND c.firm_id = firm AND public.can_see_firm_record(a.firm_id, a.owner_id);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That contact or lead isn''t one you can see.' USING ERRCODE = 'PT404';
    END IF;
    IF person.do_not_email THEN
      RAISE EXCEPTION 'This contact is marked Do not email.' USING ERRCODE = 'PT409';
    END IF;
    IF NULLIF(btrim(person.email), '') IS NULL THEN
      RAISE EXCEPTION 'This contact has no email address. Add one first.' USING ERRCODE = 'PT409';
    END IF;
    to_address := btrim(person.email);
    IF NOT public.is_mail_address(to_address) THEN
      RAISE EXCEPTION 'This contact''s email address can''t be written to. Correct it first.' USING ERRCODE = 'PT409';
    END IF;
    SELECT a.name INTO short_name FROM public.accounts a WHERE a.id = person.account_id;
  ELSE
    SELECT l.* INTO prospect FROM public.leads l
    WHERE l.id = p_lead_id AND l.firm_id = firm AND public.can_see_firm_record(l.firm_id, l.owner_id)
      AND (l.deleted_at IS NULL OR public.firm_role(l.firm_id) = 'owner' OR public.is_support_session(l.firm_id));
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That contact or lead isn''t one you can see.' USING ERRCODE = 'PT404';
    END IF;
    IF prospect.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'This lead is in the bin. Restore it to write to it.' USING ERRCODE = 'PT409';
    END IF;
    IF prospect.status = 'converted' THEN
      RAISE EXCEPTION 'This lead was converted. Write to its contact instead.' USING ERRCODE = 'PT409';
    END IF;
    IF NULLIF(btrim(prospect.email), '') IS NULL THEN
      RAISE EXCEPTION 'This lead has no email address. Add one first.' USING ERRCODE = 'PT409';
    END IF;
    to_address := btrim(prospect.email);
    IF NOT public.is_mail_address(to_address) THEN
      RAISE EXCEPTION 'This lead''s email address can''t be written to. Correct it first.' USING ERRCODE = 'PT409';
    END IF;
    short_name := COALESCE(prospect.business, prospect.name);
  END IF;
  problem := public.conversation_message_input_error(p_subject, p_body, cc_in);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  -- From the sender's own connected mailbox (ADR 0005). With none there is no From, so nothing is recorded: the place to write says Connect (D-634).
  SELECT b.address INTO sender_address FROM public.broker_mailboxes b WHERE b.user_id = auth.uid();
  IF sender_address IS NULL THEN
    RAISE EXCEPTION 'Connect your mailbox to send from here.' USING ERRCODE = 'PT412';
  END IF;
  SELECT * INTO conv FROM public.conversations c WHERE c.contact_id = person.id OR c.lead_id = prospect.id;
  IF NOT FOUND THEN
    INSERT INTO public.conversations (firm_id, contact_id, lead_id, reply_address) VALUES (firm, person.id, prospect.id, public.new_conversation_address(short_name))
    RETURNING * INTO conv;
  END IF;
  -- In-Reply-To and References only when the writer names the message they answer, and only a message of this conversation.
  IF p_in_reply_to IS NOT NULL THEN
    SELECT m.* INTO answered FROM public.conversation_messages m WHERE m.id = p_in_reply_to AND m.conversation_id = conv.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That message isn''t in this conversation.' USING ERRCODE = '22023';
    END IF;
  END IF;
  -- Its own Message-ID, <its id@the From domain> (M-2.1), so a reply's In-Reply-To names it.
  INSERT INTO public.conversation_messages (id, firm_id, conversation_id, direction, from_address, to_addresses, cc_addresses, subject, body_text, message_id,
                                            in_reply_to, message_references, sender_id)
  VALUES (new_id, firm, conv.id, 'outbound', sender_address, ARRAY[to_address], cc_in, btrim(p_subject), p_body,
          '<' || new_id || '@' || split_part(sender_address, '@', 2) || '>',
          answered.message_id, CASE WHEN p_in_reply_to IS NULL THEN '{}' ELSE answered.message_references || answered.message_id END, auth.uid())
  RETURNING * INTO made;
  -- Queued in the same transaction, so a message recorded is a message that will be tried, and one rolled back is never sent.
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  VALUES ('conversation_message', firm, 'conversation_message:' || made.id, jsonb_build_object('message_id', made.id));
  RETURN public.conversation_message_fields(made);
END;
$$;

REVOKE ALL ON FUNCTION public.send_conversation_message(uuid, uuid, text, text, text[], uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_conversation_message(uuid, uuid, text, text, text[], uuid, uuid) TO authenticated;

-- ---------- 7. Reading a record's conversation ----------
-- {conversation: {id, reply_address, contact_id, lead_id, created_at} or null, messages: newest first, at most 500}, for a contact or a lead the caller may
-- see by the level rule (the bin's by its owners and support); PT404 for any other, another firm's or none alike.
CREATE FUNCTION public.conversation_for(p_contact_id uuid DEFAULT NULL, p_lead_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
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
      'id', conv.id, 'reply_address', conv.reply_address, 'contact_id', conv.contact_id, 'lead_id', conv.lead_id, 'created_at', conv.created_at) END,
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

REVOKE ALL ON FUNCTION public.conversation_for(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_for(uuid, uuid, uuid) TO authenticated;

-- ---------- 8. The send-mail function's own claim, completion and failure (D-638) ----------
-- On the outbox every email uses, with the same lease and attempt fence as dispatch-outbox's (claim_outbox_events, fail_outbox_event): a claim holds an
-- event until locked_until, and only the worker holding the claim of attempt n records attempt n's outcome. The service role alone calls them.
CREATE FUNCTION public.claim_conversation_mail(p_batch integer, p_max_attempts integer, p_lock_seconds integer DEFAULT 600)
RETURNS TABLE (event_id uuid, attempt integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- A message deleted with its record (an account, a lead, a closing firm) is never sent: its waiting event ends here, before anything is claimed.
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = 'cancelled: the message is gone', claimed_at = NULL, locked_until = NULL
  WHERE e.kind = 'conversation_message'
    AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    AND NOT EXISTS (SELECT 1 FROM public.conversation_messages m WHERE m.id = (e.payload ->> 'message_id')::uuid);

  RETURN QUERY
  WITH claimed AS (
    UPDATE public.outbox_events e
    SET status = 'claimed', attempts = e.attempts + 1, claimed_at = now(), locked_until = now() + make_interval(secs => p_lock_seconds)
    WHERE e.id IN (
      SELECT o.id FROM public.outbox_events o
      WHERE o.kind = 'conversation_message' AND o.attempts < p_max_attempts
        AND ((o.status = 'pending' AND o.next_attempt_at <= now()) OR (o.status = 'claimed' AND o.locked_until < now()))
      ORDER BY o.next_attempt_at, o.created_at
      LIMIT p_batch
      FOR UPDATE SKIP LOCKED)
    RETURNING e.id, e.attempts, e.payload, e.next_attempt_at, e.created_at)
  SELECT c.id, c.attempts, public.conversation_message_fields(m) || jsonb_build_object('reply_address', v.reply_address)
  FROM claimed c
  JOIN public.conversation_messages m ON m.id = (c.payload ->> 'message_id')::uuid
  JOIN public.conversations v ON v.id = m.conversation_id
  ORDER BY c.next_attempt_at, c.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_conversation_mail(integer, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_conversation_mail(integer, integer, integer) TO service_role;

-- A send went: the message is sent, with the provider's id (Gmail's; for Microsoft, our own Message-ID, D-633) and when. Only the claim of that attempt
-- records it; true when it did.
CREATE FUNCTION public.complete_conversation_mail(p_event_id uuid, p_attempt integer, p_provider_message_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ev public.outbox_events;
BEGIN
  UPDATE public.outbox_events e
  SET status = 'sent', sent_at = now(), provider_message_id = left(p_provider_message_id, 200), last_error = NULL, claimed_at = NULL, locked_until = NULL
  WHERE e.id = p_event_id AND e.kind = 'conversation_message' AND e.status = 'claimed' AND e.attempts = p_attempt
  RETURNING * INTO ev;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE public.conversation_messages m
  SET status = 'sent', sent_at = now(), provider_message_id = p_provider_message_id, failure_kind = NULL, failure_reason = NULL
  WHERE m.id = (ev.payload ->> 'message_id')::uuid;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_conversation_mail(uuid, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_conversation_mail(uuid, integer, text) TO service_role;

-- A send did not go. With a delay it is tried again then and the message stays queued; with none it is final: the event is dead and the message failed,
-- with its kind and the reason in the sender's words (D-632). The event keeps the kind alone, never the words. Only the claim of that attempt records it;
-- true when it did.
CREATE FUNCTION public.fail_conversation_mail(p_event_id uuid, p_attempt integer, p_kind text, p_reason text, p_retry_in_seconds integer)
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
  WHERE e.id = p_event_id AND e.kind = 'conversation_message' AND e.status = 'claimed' AND e.attempts = p_attempt
  RETURNING * INTO ev;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF p_retry_in_seconds IS NULL THEN
    UPDATE public.conversation_messages m SET status = 'failed', failure_kind = p_kind, failure_reason = left(p_reason, 500)
    WHERE m.id = (ev.payload ->> 'message_id')::uuid;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_conversation_mail(uuid, integer, text, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fail_conversation_mail(uuid, integer, text, text, integer) TO service_role;

-- An event of a message that ends dead by any other path (the outbox's reaper, when the worker of its last attempt was lost) leaves its message failed as
-- uncertain: the worker may have sent it before it was lost (D-632). fail_conversation_mail then writes its own kind and reason over this.
CREATE FUNCTION public.conversation_mail_ended()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.conversation_messages m
  SET status = 'failed', failure_kind = 'uncertain', failure_reason = 'This message may have been sent. Look in your Sent folder before writing again.'
  WHERE m.id = (NEW.payload ->> 'message_id')::uuid AND m.status = 'queued';
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.conversation_mail_ended() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER outbox_events_conversation_mail_ended AFTER UPDATE OF status ON public.outbox_events
  FOR EACH ROW WHEN (NEW.kind = 'conversation_message' AND NEW.status = 'dead' AND OLD.status IS DISTINCT FROM 'dead')
  EXECUTE FUNCTION public.conversation_mail_ended();


-- ---------- 9. Closing a firm deletes them (ADR 0023) ----------
-- The closing's one list (20261121090000), restated with every line it had, and the conversations and their messages, after the calls, notes and tasks and
-- before the leads and contacts they are with (ord 58; within one ord the closing goes by name, so the messages go first).
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
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;

-- ---------- 10. Indexes ----------
-- A conversation's messages newest first (conversation_for), a firm's closing (DELETE ... WHERE firm_id), and a sender's newest send (the mailbox state).
CREATE INDEX conversation_messages_conversation_idx ON public.conversation_messages (conversation_id, recorded_at DESC, id DESC);
CREATE INDEX conversation_messages_firm_idx ON public.conversation_messages (firm_id);
CREATE INDEX conversation_messages_sender_idx ON public.conversation_messages (sender_id, recorded_at DESC, id DESC) WHERE sender_id IS NOT NULL;
CREATE INDEX conversations_firm_idx ON public.conversations (firm_id);

COMMENT ON TABLE public.conversations IS 'The mail thread with one contact or one lead (glossary: Conversation), with its reply address. Written only by send_conversation_message.';
COMMENT ON TABLE public.conversation_messages IS 'A message on a conversation (glossary: Conversation). Recorded queued by send_conversation_message, sent or failed by the send-mail function.';

-- ---------- 11. The minute schedule ----------
-- send-mail is worked every minute from the database, as dispatch-outbox is (20261027100000): retries ride on it, and a send whose browser closed before
-- it called the function still goes. Read from Vault each run; where pg_cron or pg_net can't be had this logs a notice and does nothing, and an existing
-- job is left as it is.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL OR to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    RAISE NOTICE 'send-mail schedule: pg_cron or pg_net is not available; schedule send-mail another way (docs/NOTIFICATIONS.md)';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-mail') THEN
    RAISE NOTICE 'send-mail schedule: a send-mail job already exists; leaving it as it is';
    RETURN;
  END IF;
  PERFORM cron.schedule('send-mail', '* * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-mail',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'),
      body := '{}'::jsonb
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
  $job$);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'send-mail schedule: could not schedule send-mail (%); schedule it another way (docs/NOTIFICATIONS.md)', SQLERRM;
END $$;
