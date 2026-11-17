-- The employer ends a firm's access to their intake (story CRM-P2.5 / P-2.3, slice 5.13; docs/BROKER_CRM_BUILD.md D-1714, D-1703, D-1820 to D-1829).

-- ---------- 1. The record ----------
-- One row for each time an employer ended a firm's access to an intake: the firm's own record of it (D-1822). No answers in it. Written only by
-- employer_end_firm_access.
CREATE TABLE public.intake_access_ends (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  firm_name text NOT NULL,
  session_id uuid NOT NULL,
  opportunity_id uuid,
  ended_by uuid NOT NULL,
  ended_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_access_ends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.intake_access_ends FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.employer_end_firm_access(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i public.chamber_sessions;
  v_opportunity uuid;
  v_account uuid;
  v_sent text;
  v_notes text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = p_session_id AND s.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the employer can end a firm''s access to their intake.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO i FROM public.chamber_sessions s WHERE s.id = p_session_id FOR NO KEY UPDATE;
  -- The default firm is no outside firm (D-1742); an intake there was never shared, or its sharing has been ended.
  IF i.firm_id = public.default_firm_id() THEN
    RAISE EXCEPTION 'No firm sees this intake, so there is nothing to end.' USING ERRCODE = '22023';
  END IF;
  -- The opportunity lets go of the intake, which the intake's own firm key (opportunities_intake_firm) needs before the intake can change firm; the rule that
  -- every submission sits on an opportunity is asked again when the intake has its new firm's (below).
  SELECT o.id, o.account_id INTO v_opportunity, v_account FROM public.opportunities o WHERE o.intake_id = p_session_id;
  INSERT INTO public.intake_access_ends (firm_id, firm_name, session_id, opportunity_id, ended_by)
  VALUES (i.firm_id, (SELECT f.name FROM public.firms f WHERE f.id = i.firm_id), p_session_id, v_opportunity, auth.uid());
  -- The firm keeps what it sent as a note on the opportunity (D-1825): the intake, with its quote requests, goes with the employer.
  IF v_opportunity IS NOT NULL THEN
    SELECT string_agg('Sent to ' || q.peo_name || ' on ' || to_char(q.sent_on, 'FMDD Mon YYYY') || ' (' || initcap(replace(q.status, '_', ' ')) || ').', ' ' ORDER BY q.id)
    INTO v_sent FROM public.quote_requests q WHERE q.session_id = p_session_id;
    -- The firm's notes on the submission are append-only and stay with the intake, so they are copied here, where only the firm reads them (D-1826).
    SELECT string_agg(to_char(n.created_at, 'FMDD Mon YYYY') || ', ' || COALESCE(n.author_email, 'a member') || ': ' || n.body, E'\n' ORDER BY n.created_at, n.id)
    INTO v_notes FROM public.advisor_notes n WHERE n.session_id = p_session_id;
    INSERT INTO public.activities (firm_id, account_id, opportunity_id, kind, body)
    VALUES (i.firm_id, v_account, v_opportunity, 'note', left(
      format('The employer ended %s''s access to their intake on %s. %s The intake and its answers are no longer shown to your firm; the account, its contacts and your notes stay.',
        (SELECT f.name FROM public.firms f WHERE f.id = i.firm_id), to_char(now(), 'FMDD Mon YYYY'), COALESCE(v_sent, 'Nothing had been sent to a PEO.'))
      || COALESCE(E'\n\nYour notes on the submission:\n' || v_notes, ''), 5000));
  END IF;
  PERFORM public.bundle_link_revoke(q.id, 'access_ended') FROM public.quote_requests q WHERE q.session_id = p_session_id;
  SET CONSTRAINTS opportunities_keep_intake_unlink DEFERRED;
  UPDATE public.opportunities o SET intake_id = NULL WHERE o.intake_id = p_session_id;
  PERFORM set_config('nevermore.ending_firm_access', p_session_id::text, true);
  UPDATE public.chamber_sessions s SET firm_id = public.default_firm_id() WHERE s.id = p_session_id;
  IF public.intake_ever_certified(p_session_id) OR i.status = 'submitted' THEN
    PERFORM public.make_intake_chain(p_session_id);
  END IF;
  SET CONSTRAINTS opportunities_keep_intake_unlink IMMEDIATE;
  RETURN '{}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.employer_end_firm_access(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.employer_end_firm_access(uuid) TO authenticated;

-- keep_intake_firm restated from its newest definition (20261123110000_firm_link.sql) with every line kept, and one rule more: the employer's ending of a
-- firm's access (employer_end_firm_access) moves the intake to the default firm, which no update by a browser's role may do (D-1740).
CREATE OR REPLACE FUNCTION public.keep_intake_firm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_address text;
  v_firm uuid;
BEGIN
  IF current_setting('role', true) NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND current_setting('nevermore.ending_firm_access', true) = NEW.id::text THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_address := NULLIF(lower(btrim(NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-firm-address')), '');
    IF v_address IS NULL THEN
      NEW.firm_id := public.default_firm_id();
    ELSE
      v_firm := public.firm_for_intake_link(v_address);
      IF v_firm IS NULL THEN
        RAISE EXCEPTION 'This link doesn''t start an intake' USING ERRCODE = 'PT404';
      END IF;
      NEW.firm_id := v_firm;
    END IF;
  ELSE
    NEW.firm_id := OLD.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_intake_firm() FROM PUBLIC, anon, authenticated;

-- Appended, never changed or deleted, whoever writes, the table's owner included. Its intake's deletion leaves it: it holds no answers, and it is the firm's.
CREATE TRIGGER intake_access_ends_append_only
  BEFORE UPDATE OR DELETE ON public.intake_access_ends
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

-- ---------- 2. No further send ----------
-- Has an employer ended a firm's access to this intake? The one question the PEO gate asks (D-1823).
CREATE FUNCTION public.intake_access_ended(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.intake_access_ends e WHERE e.session_id = p_session_id)
$$;

REVOKE ALL ON FUNCTION public.intake_access_ended(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- peo_authorized restated from its only definition (20261122100000_peo_authorizations.sql) with every line kept, and no authorization once access ended: a
-- bundle link is read through it each time it is opened (6.6b), so the links of such an intake are dead whether or not they were revoked too.
CREATE OR REPLACE FUNCTION public.peo_authorized(p_session_id uuid, p_peo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT a.authorized FROM public.peo_authorizations a
    WHERE a.session_id = p_session_id AND lower(a.peo_name) = lower(btrim(p_peo))
    ORDER BY a.id DESC LIMIT 1), false)
    AND NOT public.intake_access_ended(p_session_id)
$$;

REVOKE ALL ON FUNCTION public.peo_authorized(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- assert_peo_authorized restated from its only definition (20261122100000_peo_authorizations.sql) with every line kept, and the ending asked first.
CREATE OR REPLACE FUNCTION public.assert_peo_authorized(p_session_id uuid, p_peo text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  last public.peo_authorizations;
  clean_peo constant text := btrim(COALESCE(p_peo, ''));
BEGIN
  IF public.intake_access_ended(p_session_id) THEN
    RAISE EXCEPTION 'The employer ended a firm''s access to this intake. Nothing more can be sent for it.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO last FROM public.peo_authorizations a
  WHERE a.session_id = p_session_id AND lower(a.peo_name) = lower(clean_peo)
  ORDER BY a.id DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The employer hasn''t authorized % to receive their packet. Ask them to add it.', left(clean_peo, 80) USING ERRCODE = '22023';
  ELSIF NOT last.authorized THEN
    RAISE EXCEPTION 'The employer withdrew %. Nothing more can be sent to it.', last.peo_name USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_peo_authorized(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. Revoking the links ----------
-- A link's reasons, with the employer ending the firm's access (D-1824). bundle_links_revoked_check is 20261122110000's with the one reason added.
ALTER TABLE public.bundle_links DROP CONSTRAINT bundle_links_revoked_check;
ALTER TABLE public.bundle_links ADD CONSTRAINT bundle_links_revoked_check CHECK (
  (revoked_at IS NULL) = (revoked_reason IS NULL)
  AND (revoked_reason IS NULL OR revoked_reason IN ('replaced', 'newer_version', 'withdrawn', 'submission_closed', 'authorization_withdrawn', 'revoked_by_advisor', 'access_ended')));

-- bundle_link_revoke restated from its only definition (20261122110000_bundle_links.sql) with every line kept and the one reason added.
CREATE OR REPLACE FUNCTION public.bundle_link_revoke(p_quote_request_id bigint, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n integer;
BEGIN
  IF p_reason IS NULL OR p_reason NOT IN ('replaced', 'newer_version', 'withdrawn', 'submission_closed', 'authorization_withdrawn', 'revoked_by_advisor', 'access_ended') THEN
    RAISE EXCEPTION 'A link is revoked for a known reason, not %', COALESCE(p_reason, 'none') USING ERRCODE = '22023';
  END IF;
  UPDATE public.bundle_links SET revoked_at = now(), revoked_reason = p_reason WHERE quote_request_id = p_quote_request_id AND revoked_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.bundle_link_revoke(bigint, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. The employer's view ----------
-- The firm that sees each of the caller's own intakes, for the profile (D-1821): only an outside firm's (the default firm is none, D-1742), and only the caller's own
-- intakes, with the company each one is for (null until it has one). A firm's name is not readable by an employer, so this is how the profile names it.
CREATE FUNCTION public.my_intake_firms()
RETURNS TABLE (session_id uuid, firm_name text, company text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, f.name, NULLIF(btrim(s.chamber_data ->> 'company_name'), '')
  FROM public.chamber_sessions s
  JOIN public.firms f ON f.id = s.firm_id
  WHERE auth.uid() IS NOT NULL AND s.user_id = auth.uid() AND s.firm_id <> public.default_firm_id()
$$;

REVOKE ALL ON FUNCTION public.my_intake_firms() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.my_intake_firms() TO authenticated;

-- ---------- 5. Closing a firm keeps the record ----------
-- firm_closing_plan restated from its newest definition (20261122200500_main_merged.sql) with every line kept, and the one line for the new table (D-1828).
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
    (900, 'public.submission_status_history', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_workflow', 'keep', NULL, 'an intake''s'),
    (900, 'storage.objects WHERE bucket_id = ''documents''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''manuscripts''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''contact-mail''', 'keep', NULL, 'the bytes of files received on the firm''s contact mail: unreadable once the closing deletes their rows (the bucket is read only through a stored attachment''s row), and not removable from SQL (D-667)'),
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;
