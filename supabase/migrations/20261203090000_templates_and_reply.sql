-- A firm's own opening text for its messages to a PEO or carrier, and a plain reply on a thread (docs/BROKER_READINESS_PRD.md BR-3.5, BR-3.4; stories P-3.2,
-- M-3.5; docs/BROKER_CRM_BUILD.md "## Templates and replies", D-2350 on; supabase/tests/templates_and_reply.sql).

SET lock_timeout = '5s';

-- ---------- 1. A firm's message templates ----------
-- What a message of each kind opens with, for the whole firm, in place of the text kept in code. The agent still edits it before sending, and the fixed
-- block under every message is the database's own and is never a template (attach_peo_link). Closed to the API.
CREATE TABLE public.firm_message_templates (
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  kind text NOT NULL CHECK (kind IN (
    -- sync:begin message_template_kinds
    'send', 'follow_up', 'withdrawal'
    -- sync:end message_template_kinds
  )),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (firm_id, kind)
);
ALTER TABLE public.firm_message_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_message_templates FROM PUBLIC, anon, authenticated;

-- Every member reads the firm's templates: the composer opens with them. A kind with none of the firm's own is absent, and the composer uses its own text.
CREATE FUNCTION public.firm_message_templates(p_firm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  RETURN COALESCE((SELECT jsonb_object_agg(t.kind, t.body) FROM public.firm_message_templates t WHERE t.firm_id = firm), '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.firm_message_templates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_message_templates(uuid) TO authenticated;

-- An owner sets the firm's text for one kind; nothing (or only spaces) puts it back to the product's own.
CREATE FUNCTION public.set_firm_message_template(p_firm_id uuid, p_kind text, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  clean text := btrim(COALESCE(p_body, ''), E' \t\r\n');
BEGIN
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('send', 'follow_up', 'withdrawal') THEN
    RAISE EXCEPTION 'A template is for a first send, a follow-up or a withdrawal' USING ERRCODE = '22023';
  END IF;
  IF clean = '' THEN
    DELETE FROM public.firm_message_templates t WHERE t.firm_id = p_firm_id AND t.kind = p_kind;
    RETURN;
  END IF;
  IF char_length(clean) > 5000 THEN
    RAISE EXCEPTION 'A template is at most 5,000 characters' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.firm_message_templates (firm_id, kind, body, updated_by) VALUES (p_firm_id, p_kind, clean, auth.uid())
  ON CONFLICT (firm_id, kind) DO UPDATE SET body = EXCLUDED.body, updated_by = EXCLUDED.updated_by, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_firm_message_template(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_firm_message_template(uuid, text, text) TO authenticated;

-- ---------- 2. A reply on a PEO's or carrier's thread ----------
-- What an agent writes back on the thread of a quote request the product sent: from their own connected mailbox, continuing the thread, with no bundle
-- link (M-3.5). It changes no status and no link: a reply says something, and nothing else follows from it. Offered while the quote request is open and
-- the employer still authorizes the PEO, as a follow-up is; a closed one is written to again by sending again.
CREATE FUNCTION public.reply_to_peo(p_quote_request_id bigint, p_to text[], p_subject text, p_note text)
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
  IF req.status = 'closed' THEN
    RAISE EXCEPTION '% is closed. Send to it again to write to it.', req.peo_name USING ERRCODE = '22023';
  END IF;
  -- A reply continues a thread the product started: one recorded by hand has no thread here to continue.
  IF req.sent_version IS NULL OR NOT EXISTS (SELECT 1 FROM public.quote_request_messages m WHERE m.quote_request_id = req.id) THEN
    RAISE EXCEPTION 'There is no thread with % here yet. Send to it first.', req.peo_name USING ERRCODE = '22023';
  END IF;
  -- M-1.1: nothing goes to a PEO the employer no longer authorizes.
  PERFORM public.assert_peo_authorized(req.session_id, req.peo_name);
  to_in := public.peo_message_addresses(req.peo_name, p_to);
  problem := public.conversation_message_input_error(p_subject, p_note, '{}');
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  SELECT b.address INTO sender_address FROM public.broker_mailboxes b WHERE b.user_id = auth.uid();
  IF sender_address IS NULL THEN
    RAISE EXCEPTION 'Connect your mailbox to send from here.' USING ERRCODE = 'PT412';
  END IF;
  made := public.record_peo_thread_message(req.id, sender_address, to_in, p_subject, p_note, true);
  RETURN jsonb_build_object('quote_request_id', req.id, 'message_id', made.id);
END;
$$;

REVOKE ALL ON FUNCTION public.reply_to_peo(bigint, text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_peo(bigint, text[], text, text) TO authenticated;

-- ---------- 3. Closing a firm deletes its templates ----------
-- firm_closing_plan restated from its newest definition (20261130090000_import.sql) with every line kept, and one line for the new table.
CREATE OR REPLACE FUNCTION public.firm_closing_plan()
RETURNS TABLE (ord integer, src text, action text, firm_column text, why text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    -- Deleted: the firm's own working data.
    (10, 'public.firm_invitations', 'delete', 'firm_id', 'pending and past invitations to join'),
    (11, 'public.intake_invitations', 'delete', 'firm_id', 'the invitations of broker-started intakes to their employers (the link, never its token); the intakes stay with their employers'),
    (20, 'public.firm_organisations', 'delete', 'firm_id', 'the listed Google domains and Microsoft tenants'),
    (30, 'public.join_requests', 'delete', 'firm_id', 'requests to join'),
    (40, 'public.table_preferences', 'delete', 'firm_id', 'each person''s column choices'),
    (50, 'public.saved_views', 'delete', 'firm_id', 'saved views'),
    (55, 'public.record_history', 'delete', 'firm_id', 'the history of each record: who created it and every change to its fields; it goes with the record'),
    (56, 'public.recent_records', 'delete', 'firm_id', 'each person''s last opened records, for the search box'),
    (56, 'public.bulk_change_records', 'delete', 'firm_id', 'what each bulk change did to each record, kept for ten minutes'' undo'),
    (57, 'public.bulk_changes', 'delete', 'firm_id', 'bulk changes, kept for ten minutes'' undo'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (54, 'public.commission_payments', 'delete', 'firm_id', 'commission payments (what the firm received for its placements); before the placements and accounts they stand on'),
    (56, 'public.renewals', 'delete', 'firm_id', 'renewals (the dates an account''s cover comes up); before the placements they come from and the opportunities working them'),
    (57, 'public.placements', 'delete', 'firm_id', 'placements (what the firm placed for its accounts); before the opportunities and accounts they stand on'),
    (57, 'public.merged_records', 'delete', 'firm_id', 'where each merged-away account or contact went, so its old address led to the kept one'),
    (58, 'public.activities', 'delete', 'firm_id', 'calls, notes and tasks on the firm''s accounts, contacts and leads; before the opportunities, contacts and accounts they stand on'),
    (58, 'public.conversation_file_downloads', 'delete', 'firm_id', 'each download of a file link on the firm''s contact mail; before the links they are of'),
    (58, 'public.conversation_message_files', 'delete', 'firm_id', 'the file links on the firm''s contact mail (the files stay with their intakes); before the messages they are on'),
    (58, 'public.conversation_message_attachments', 'delete', 'firm_id', 'the files received on the firm''s contact and lead mail, each one''s name, size and scan; before the messages they are on'),
    (58, 'public.conversation_messages', 'delete', 'firm_id', 'the mail with the firm''s contacts and leads; before the conversations they are on'),
    (58, 'public.conversations', 'delete', 'firm_id', 'the conversations with the firm''s contacts and leads, their reply addresses with them; before the contacts and leads they are with'),
    (59, 'public.account_labels', 'delete', 'firm_id', 'the labels on the firm''s accounts; before the accounts they stand on'),
    (59, 'public.lead_labels', 'delete', 'firm_id', 'the labels on the firm''s leads; before the leads they stand on'),
    (59, 'public.quote_comparison_notes', 'delete', 'firm_id', 'the broker''s notes on the comparison of an opportunity''s quotes, internal and for the client: the firm''s own working notes; before the opportunities they are on'),
    (60, 'public.leads', 'delete', 'firm_id', 'leads, the people and businesses the firm is not quoting yet, the bin with them; after their calls, notes and tasks'),
    (61, 'public.opportunities', 'delete', 'firm_id', 'opportunities (each is one search for one account); before the contacts and accounts they stand on'),
    (62, 'public.contacts', 'delete', 'firm_id', 'contacts, the people at the firm''s accounts'),
    (63, 'public.accounts', 'delete', 'firm_id', 'accounts, the businesses the firm quotes for; the intakes on their opportunities stay with their employers (below)'),
    (64, 'public.labels', 'delete', 'firm_id', 'the firm''s own list of labels; after the accounts that carried them'),
    (64, 'public.import_rows', 'delete', 'firm_id', 'what each row of an import made, by row number and with no value from the file; before the imports they are of'),
    (65, 'public.imports', 'delete', 'firm_id', 'the firm''s imports: who ran each, when, and of which file'),
    (65, 'public.firm_message_templates', 'delete', 'firm_id', 'the firm''s own opening text for its messages to a PEO or carrier'),
    (65, 'public.firm_market_contacts', 'delete', 'firm_id', 'the firm''s own contacts at PEOs and carriers: the people it deals with there'),
    (65, 'public.market_requests', 'delete', 'firm_id', 'the firm''s requests for a PEO or carrier that wasn''t listed, each with its answer'),
    (65, 'public.firm_licences', 'delete', 'firm_id', 'the states and lines the firm said it was licensed in'),
    (65, 'public.firm_licence_records', 'delete', 'firm_id', 'the firm''s National Producer Number and when its licences were last checked'),
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
    (900, 'public.intake_access_ends', 'keep', NULL, 'each time an employer ended the firm''s access to an intake: appended only, naming the firm, the intake and the employer and holding no answers'),
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
    (900, 'public.quotes', 'keep', NULL, 'a quote request''s: what a PEO quoted on it, the whole offer; quote requests belong to an intake'),
    (900, 'public.submission_status_history', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_workflow', 'keep', NULL, 'an intake''s'),
    (900, 'storage.objects WHERE bucket_id = ''documents''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''manuscripts''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''contact-mail''', 'keep', NULL, 'the bytes of files received on the firm''s contact mail: unreadable once the closing deletes their rows (the bucket is read only through a stored attachment''s row), and not removable from SQL (D-667)'),
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;
