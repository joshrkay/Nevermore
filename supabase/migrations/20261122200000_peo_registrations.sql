-- The registration record and the warning about a second submission (Q-2.1, Q-2.2, slice 6.10, #204; docs/BROKER_CRM_BUILD.md D-604, D-1630 to
-- D-1639; supabase/tests/peo_registrations.sql).

-- ---------- 1. The registration record ----------
-- One row per send of the packet to a PEO: the firm that sent it, the PEO, who the employer is (its FEIN, or its name and state where there is none),
-- the version sent and when. It is the firm's proof of when it submitted the employer to the PEO.
CREATE TABLE public.peo_registrations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  peo_id bigint NOT NULL REFERENCES public.peos (id),
  peo_name text NOT NULL,
  fein text,
  employer_name text,
  employer_state text,
  file_id text NOT NULL,
  version integer NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now()
);

-- The statement reads one firm's, oldest first; the warning looks an employer up across firms by its FEIN, or by its name and state.
CREATE INDEX peo_registrations_firm_idx ON public.peo_registrations (firm_id, registered_at, id);
CREATE INDEX peo_registrations_fein_idx ON public.peo_registrations (fein, peo_id) WHERE fein IS NOT NULL;
CREATE INDEX peo_registrations_name_idx ON public.peo_registrations (employer_state, peo_id);

-- Appended, never changed or deleted, whoever writes: a member, a platform admin, the table's owner. Unlike an intake's audit tables, deleting the
-- intake does not take it either (it names no intake, D-1634), so reject_audit_change's one way through never opens for it.
CREATE TRIGGER peo_registrations_append_only
  BEFORE UPDATE OR DELETE ON public.peo_registrations
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();
CREATE TRIGGER peo_registrations_never_emptied
  BEFORE TRUNCATE ON public.peo_registrations
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_audit_change();

-- Closed to the API, the service role included: it holds every firm's registrations, FEINs among them, side by side. A firm reads its own through
-- peo_registration_statement(); the warning reads the others' through peo_registered_elsewhere(), which names no firm and no FEIN.
ALTER TABLE public.peo_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.peo_registrations FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The one writer ----------
-- Called by a send in its own transaction, once the message is recorded: send_to_peo (6.6), and so each send of several PEOs (6.7). Who the employer
-- is comes from the answers of the version sent.
CREATE FUNCTION public.register_peo_send(p_session_id uuid, p_peo text, p_version integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.peo_registrations (firm_id, peo_id, peo_name, fein, employer_name, employer_state, file_id, version)
  SELECT s.firm_id, p.id, p.name, c.chamber_data ->> 'fein', public.crm_answer_text(c.chamber_data, 'company_name', 200),
         CASE WHEN public.is_us_state_code(public.crm_answer_text(c.chamber_data, 'hq_state', 2)) THEN public.crm_answer_text(c.chamber_data, 'hq_state', 2) END,
         c.file_id, p_version
  FROM public.chamber_sessions s
  JOIN public.chamber_certifications c ON c.session_id = s.id AND c.version = p_version
  JOIN public.peos p ON lower(p.name) = lower(btrim(p_peo))
  WHERE s.id = p_session_id;
END;
$$;

-- The send's alone: no API role calls it, so no one writes a registration that no send made.
REVOKE ALL ON FUNCTION public.register_peo_send(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. The warning about a second submission (Q-2.2, D-604) ----------
-- An employer's name as two registrations are compared: lower case, letters and digits only ("BAY  CAFE." is "Bay Cafe"). NULL when nothing is left.
CREATE FUNCTION public.peo_registration_name_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(regexp_replace(lower(COALESCE(p_name, '')), '[^a-z0-9]', '', 'g'), '')
$$;

REVOKE ALL ON FUNCTION public.peo_registration_name_key(text) FROM PUBLIC, anon, authenticated, service_role;

-- For the intake the caller's firm is sending: each PEO another firm has registered the same employer with, and the first time it did. Nothing of
-- which firm, how many, the FEIN or the version. It warns and never blocks: the send does not ask it.
CREATE FUNCTION public.peo_registered_elsewhere(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  intake public.chamber_sessions;
  answers jsonb;
  my_fein text;
  my_name text;
  my_state text;
BEGIN
  -- Only for an intake the caller's own firm holds, so no firm can ask about an employer it doesn't hold.
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');
  SELECT * INTO intake FROM public.chamber_sessions s WHERE s.id = p_session_id;
  SELECT c.chamber_data INTO answers FROM public.chamber_certifications c WHERE c.session_id = p_session_id ORDER BY c.version DESC LIMIT 1;
  my_fein := answers ->> 'fein';
  my_name := public.peo_registration_name_key(public.crm_answer_text(answers, 'company_name', 200));
  my_state := public.crm_answer_text(answers, 'hq_state', 2);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('peo', x.peo_name, 'registered_at', x.first_at) ORDER BY x.peo_name)
    FROM (SELECT min(g.peo_name) AS peo_name, min(g.registered_at) AS first_at
          FROM public.peo_registrations g
          WHERE g.firm_id <> intake.firm_id
            -- The same employer: the same FEIN where both have one; where either has none, the same name in the same state.
            AND (g.fein = my_fein
                 OR ((g.fein IS NULL OR my_fein IS NULL)
                     AND public.peo_registration_name_key(g.employer_name) = my_name AND g.employer_state = my_state))
          GROUP BY g.peo_id) x), '[]');
END;
$$;

REVOKE ALL ON FUNCTION public.peo_registered_elsewhere(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.peo_registered_elsewhere(uuid) TO authenticated;

-- ---------- 4. A firm's statement of its own registrations (Q-2.1) ----------
-- Every registration of the firm, oldest first, dated when it was asked for. The FEIN is given by its last four digits only: the statement is a file
-- taken out of the product, and no export holds a FEIN (D-48, ADR 0006); the whole one stays on the intake. The browser writes it as a CSV.
CREATE FUNCTION public.peo_registration_statement(p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  -- A support session takes no file out of a firm (D-128, ADR 0024), first, before anything is read; then a current member of that firm (D-40).
  PERFORM public.refuse_support_session(p_firm_id);
  firm := public.firm_to_act_for(p_firm_id);
  RETURN jsonb_build_object(
    'firm', (SELECT f.name FROM public.firms f WHERE f.id = firm),
    'as_of', now(),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('registered_at', g.registered_at, 'peo', g.peo_name, 'employer', g.employer_name, 'state', g.employer_state,
                                          'fein_last_four', right(g.fein, 4), 'file_id', g.file_id, 'version', g.version) ORDER BY g.registered_at, g.id)
      FROM public.peo_registrations g WHERE g.firm_id = firm), '[]'));
END;
$$;

REVOKE ALL ON FUNCTION public.peo_registration_statement(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.peo_registration_statement(uuid) TO authenticated;

-- ---------- 5. Every send writes one ----------
-- send_to_peo restated from its newest definition (20261122140000) with every line kept; the registration is written at the seam it left (D-679).
CREATE OR REPLACE FUNCTION public.send_to_peo(p_session_id uuid, p_peo text, p_to text[], p_subject text, p_note text)
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
  -- Q-2.1 (slice 6.10): the send's append-only registration (firm, PEO, the employer's FEIN or name and state, version, time), written here, in this
  -- transaction, once the message is recorded (D-679).
  PERFORM public.register_peo_send(p_session_id, peo, version_sent);
  RETURN jsonb_build_object('quote_request_id', req.id, 'message_id', made.id);
END;
$$;

REVOKE ALL ON FUNCTION public.send_to_peo(uuid, text, text[], text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.send_to_peo(uuid, text, text[], text, text) TO authenticated;

-- ---------- 6. Closing a firm keeps its registrations (D-1635) ----------
-- firm_closing_plan() restated from its newest definition (20261122160000) with every line kept, and this table's line.
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
    (58, 'public.conversation_file_downloads', 'delete', 'firm_id', 'each download of a file link on the firm''s contact mail; before the links they are of'),
    (58, 'public.conversation_message_files', 'delete', 'firm_id', 'the file links on the firm''s contact mail (the files stay with their intakes); before the messages they are on'),
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
    (900, 'public.bundle_links', 'keep', NULL, 'a quote request''s links to its bundle: they go with the intake, under the intake retention rules'),
    (900, 'storage.objects WHERE bucket_id = ''bundle-links''', 'keep', NULL, 'an intake''s files: a bundle link''s made files, deleted with the intake'),
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
    (900, 'public.peo_registrations', 'keep', NULL, 'the firm''s proof of each send to a PEO (firm, PEO, the employer''s FEIN or name and state, version, time): appended only, so nobody deletes it, the closing included; it stays as the record that the send happened, and still warns another firm sending the same employer to that PEO (D-1635)'),
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
