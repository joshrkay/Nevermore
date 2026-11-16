-- The files a message to a contact may carry, each as an expiring link (story CRM-E1.2b, slice 6.3, #197; docs/BROKER_CRM_BUILD.md D-605, D-680 to D-689;
-- supabase/tests/conversation_files.sql). A file goes as a link, never as an attachment (ADR 0003, M-3.5): scanned before, revocable, each download logged.

-- ---------- 1. Which files may go to a contact (D-605) ----------
-- A file of the contact's own account (the documents of its opportunities' intakes), past the virus check (clean, as the account's Files tab lists them,
-- D-199), on an intake of a firm the caller belongs to (the documents bucket's own read rule, intake_folder_in_my_firm). Being the contact's account's own
-- file is the "own employer" rule: a census (or any other file of an intake) goes only to a contact of the employer whose intake it is. Internal.
CREATE FUNCTION public.conversation_file_allowed(p_contact_id uuid, p_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contacts c
    JOIN public.opportunities o ON o.account_id = c.account_id AND o.firm_id = c.firm_id
    JOIN public.documents d ON d.session_id = o.intake_id
    WHERE c.id = p_contact_id AND d.id = p_document_id AND d.scan_verdict = 'clean' AND public.intake_in_my_firm(d.session_id))
$$;

REVOKE ALL ON FUNCTION public.conversation_file_allowed(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- [{id, file_name, category, created_at}] newest first: the files a message to this contact may carry, for a contact the caller may see (its account's
-- visibility, as the send asks); PT404 for any other, another firm's or none alike.
CREATE FUNCTION public.conversation_files_for(p_contact_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  person public.contacts;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT c.* INTO person FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
  WHERE c.id = p_contact_id AND c.firm_id = firm AND public.can_see_firm_record(a.firm_id, a.owner_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That contact or lead isn''t one you can see.' USING ERRCODE = 'PT404';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', d.id, 'file_name', d.file_name, 'category', d.category, 'created_at', d.created_at) ORDER BY d.created_at DESC, d.id)
    FROM public.documents d
    WHERE d.session_id IN (SELECT o.intake_id FROM public.opportunities o WHERE o.account_id = person.account_id AND o.firm_id = firm)
      AND public.conversation_file_allowed(person.id, d.id)), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.conversation_files_for(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_files_for(uuid, uuid) TO authenticated;

-- ---------- 2. A message's files (D-605) ----------
-- One row per file a message carries, in the order chosen. It names the document, never copies it: the download reads it where the intake keeps it, and
-- checks it again then. The link's token is issued only when the message is built to be sent (claim_conversation_mail below) and is never kept: only its
-- SHA-256 in hex, as a bundle link's (D-640). Each attempt issues a fresh one, so a token exists only in the one message that went.
ALTER TABLE public.conversation_messages ADD CONSTRAINT conversation_messages_firm_id_id_key UNIQUE (firm_id, id);

CREATE TABLE public.conversation_message_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  message_id uuid NOT NULL,
  n integer NOT NULL CONSTRAINT conversation_message_files_n_check CHECK (n BETWEEN 1 AND 10),
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  -- The name as it was when the message was written, for the message's own list and the link's download.
  file_name text NOT NULL,
  token_hash text CONSTRAINT conversation_message_files_token_hash_key UNIQUE CONSTRAINT conversation_message_files_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_message_files_issued CHECK ((token_hash IS NULL) = (issued_at IS NULL) AND (token_hash IS NULL) = (expires_at IS NULL)),
  CONSTRAINT conversation_message_files_one_place UNIQUE (message_id, n),
  CONSTRAINT conversation_message_files_message_fkey FOREIGN KEY (firm_id, message_id) REFERENCES public.conversation_messages (firm_id, id) ON DELETE CASCADE
);

CREATE INDEX conversation_message_files_firm_idx ON public.conversation_message_files (firm_id);
CREATE INDEX conversation_message_files_document_idx ON public.conversation_message_files (document_id);

COMMENT ON TABLE public.conversation_message_files IS 'A file a message to a contact carries, as an expiring link (glossary: File link). Only the token''s hash is kept.';

-- Closed to the API, its own firm's members included: the place to write reads a message's files through conversation_for, and the edge function
-- message-file opens a link through conversation_file_open.
ALTER TABLE public.conversation_message_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_message_files FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. A message as the read and the send answer it ----------
-- Restated from 20261122090000 with every field it had, and what the place to write shows: when it was recorded and sent, why it failed, and its files by
-- name (never a token, which is not kept).
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
    'failure_kind', m.failure_kind, 'failure_reason', m.failure_reason, 'recorded_at', m.recorded_at, 'sent_at', m.sent_at,
    'files', COALESCE((SELECT jsonb_agg(jsonb_build_object('n', f.n, 'file_name', f.file_name) ORDER BY f.n)
                       FROM public.conversation_message_files f WHERE f.message_id = m.id), '[]'::jsonb))
$$;

REVOKE ALL ON FUNCTION public.conversation_message_fields(public.conversation_messages) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. Sending one message, with its files (D-602, D-605) ----------
-- Restated from 20261122090000 with every rule kept, in the same order (D-631), and p_document_ids: at most 10 files, each one a message to this contact
-- may carry (conversation_file_allowed), refused in words (22023) otherwise, before anything is recorded. A lead's message carries none: a lead has no
-- account and so no files.
DROP FUNCTION public.send_conversation_message(uuid, uuid, text, text, text[], uuid, uuid);

CREATE FUNCTION public.send_conversation_message(
  p_contact_id uuid DEFAULT NULL, p_lead_id uuid DEFAULT NULL, p_subject text DEFAULT NULL, p_body text DEFAULT NULL, p_cc text[] DEFAULT NULL,
  p_in_reply_to uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL, p_document_ids uuid[] DEFAULT NULL)
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
  docs uuid[] := ARRAY(SELECT x FROM unnest(COALESCE(p_document_ids, '{}')) WITH ORDINALITY AS u (x, n) WHERE x IS NOT NULL GROUP BY x ORDER BY min(n));
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
  -- Its files (D-605): each one the contact's own account's, past the virus check, that the caller may open. Another employer's census, another firm's
  -- file, one still being checked, and any file to a lead (which has no account) read alike.
  IF cardinality(docs) > 0 AND (person.id IS NULL OR EXISTS (SELECT 1 FROM unnest(docs) x WHERE NOT public.conversation_file_allowed(person.id, x))) THEN
    RAISE EXCEPTION 'That file can''t go with this message. Only the account''s own files that passed the virus check can.' USING ERRCODE = '22023';
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
  -- Its files, in the order chosen, each a link issued when it is sent.
  INSERT INTO public.conversation_message_files (firm_id, message_id, n, document_id, file_name)
  SELECT firm, made.id, x.n, d.id, d.file_name
  FROM unnest(docs) WITH ORDINALITY AS x (id, n) JOIN public.documents d ON d.id = x.id;
  -- Queued in the same transaction, so a message recorded is a message that will be tried, and one rolled back is never sent.
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  VALUES ('conversation_message', firm, 'conversation_message:' || made.id, jsonb_build_object('message_id', made.id));
  RETURN public.conversation_message_fields(made);
END;
$$;

REVOKE ALL ON FUNCTION public.send_conversation_message(uuid, uuid, text, text, text[], uuid, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_conversation_message(uuid, uuid, text, text, text[], uuid, uuid, uuid[]) TO authenticated;

-- ---------- 5. The links are issued when the message is built (D-605) ----------
-- Restated from 20261122090000 with every rule kept (the gone message's event ended first, the same lease and attempt fence, the same order), and each
-- claimed message's files: a fresh token for each, 32 random bytes in URL-safe base64 (as a bundle link's, D-640), answered to send-mail alone, which puts
-- the link in the message it builds; only the token's SHA-256 is kept, with 30 days to run. A retry issues new tokens over the earlier attempt's, so a
-- link opens only from the message that went.
CREATE OR REPLACE FUNCTION public.claim_conversation_mail(p_batch integer, p_max_attempts integer, p_lock_seconds integer DEFAULT 600)
RETURNS TABLE (event_id uuid, attempt integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  f public.conversation_message_files;
  files jsonb;
  tok text;
BEGIN
  -- A message deleted with its record (an account, a lead, a closing firm) is never sent: its waiting event ends here, before anything is claimed.
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = 'cancelled: the message is gone', claimed_at = NULL, locked_until = NULL
  WHERE e.kind = 'conversation_message'
    AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    AND NOT EXISTS (SELECT 1 FROM public.conversation_messages m WHERE m.id = (e.payload ->> 'message_id')::uuid);

  FOR r IN
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
    SELECT c.id AS ev, c.attempts AS att, m AS msg, v.reply_address
    FROM claimed c
    JOIN public.conversation_messages m ON m.id = (c.payload ->> 'message_id')::uuid
    JOIN public.conversations v ON v.id = m.conversation_id
    ORDER BY c.next_attempt_at, c.created_at
  LOOP
    files := '[]'::jsonb;
    FOR f IN SELECT * FROM public.conversation_message_files x WHERE x.message_id = (r.msg).id ORDER BY x.n FOR UPDATE LOOP
      tok := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
      UPDATE public.conversation_message_files x
      SET token_hash = encode(extensions.digest(tok, 'sha256'), 'hex'), issued_at = now(), expires_at = now() + interval '30 days', revoked_at = NULL
      WHERE x.id = f.id;
      files := files || jsonb_build_array(jsonb_build_object('n', f.n, 'file_name', f.file_name, 'token', tok));
    END LOOP;
    event_id := r.ev;
    attempt := r.att;
    message := public.conversation_message_fields(r.msg) || jsonb_build_object('reply_address', r.reply_address, 'files', files);
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_conversation_mail(integer, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_conversation_mail(integer, integer, integer) TO service_role;

-- ---------- 6. Opening a link: what the edge function message-file asks, as the service role ----------
-- The function hashes the token and the caller's address itself; the database never sees either as it is. Each download is a row here (when, and which
-- link), never who: whoever holds the link is not someone we know.
CREATE TABLE public.conversation_file_downloads (
  id bigserial PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  file_id uuid NOT NULL REFERENCES public.conversation_message_files (id) ON DELETE CASCADE,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversation_file_downloads_firm_idx ON public.conversation_file_downloads (firm_id);
CREATE INDEX conversation_file_downloads_file_idx ON public.conversation_file_downloads (file_id);

COMMENT ON TABLE public.conversation_file_downloads IS 'Each download of a file link on a message to a contact (glossary: File link): when, and which link.';

ALTER TABLE public.conversation_file_downloads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_file_downloads FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.conversation_file_downloads_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- Where a live link's file is, for the function to sign for 60 seconds and pass on: {bucket, path, name}; NULL for anything else. A link that is not live
-- (unknown, past its 30 days, revoked) counts as a guess for the caller's address, on the bundle link's one guessing limit (D-644: 20 an hour); a live link
-- whose file no longer passes the virus check is NULL but not a guess. The download is logged.
CREATE FUNCTION public.conversation_file_open(p_token_hash text, p_address_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  link public.conversation_message_files;
  doc public.documents;
BEGIN
  IF public.bundle_link_address_refused(p_address_hash) THEN
    RETURN NULL;
  END IF;
  SELECT f.* INTO link FROM public.conversation_message_files f
  WHERE f.token_hash = p_token_hash AND f.revoked_at IS NULL AND f.expires_at > now();
  IF NOT FOUND THEN
    PERFORM public.bundle_link_miss(p_address_hash);
    RETURN NULL;
  END IF;
  SELECT d.* INTO doc FROM public.documents d WHERE d.id = link.document_id AND d.scan_verdict = 'clean';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.conversation_file_downloads (firm_id, file_id) VALUES (link.firm_id, link.id);
  RETURN jsonb_build_object('bucket', 'documents', 'path', doc.storage_path, 'name', link.file_name);
END;
$$;

REVOKE ALL ON FUNCTION public.conversation_file_open(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_file_open(text, text) TO service_role;
