-- The broker's comparison of an opportunity's quotes, and the notes on it (N-3.1, N-3.2, slice 7.7; docs/BROKER_CRM_BUILD.md "### 7.7 N-3.1, N-3.2 decisions",
-- D-770 to D-779; supabase/tests/quote_comparison.sql).

-- ---------- 1. The broker's notes on a comparison ----------
-- A note is about an opportunity's comparison (D-774): optionally about one PEO's column (quote_request_id) and, within it, one cost area, marked internal or for the
-- client (N-3.2). No API role reads or writes the table: the comparison reads its notes and add_comparison_note writes them, both SECURITY DEFINER.
CREATE TABLE public.quote_comparison_notes (
  id bigserial PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities (id) ON DELETE CASCADE,
  quote_request_id bigint REFERENCES public.quote_requests (id) ON DELETE CASCADE,
  area text,
  visibility text NOT NULL,
  body text NOT NULL,
  author_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_comparison_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_comparison_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.quote_comparison_notes_id_seq FROM PUBLIC, anon, authenticated;
CREATE INDEX quote_comparison_notes_opportunity_idx ON public.quote_comparison_notes (opportunity_id, id DESC);

CREATE FUNCTION public.add_comparison_note(
  p_firm_id uuid, p_opportunity_id uuid, p_quote_request_id bigint, p_area text, p_visibility text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  o public.opportunities;
  a public.accounts;
  n public.quote_comparison_notes;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_visibility IS NULL OR p_visibility NOT IN ('internal', 'client') THEN
    RAISE EXCEPTION 'A note is marked internal or for the client' USING ERRCODE = '22023';
  END IF;
  IF p_area IS NOT NULL AND p_area NOT IN ('admin_fee', 'one_off_fees', 'workers_comp', 'unemployment', 'medical') THEN
    RAISE EXCEPTION 'A note is about the administrative fee, one-off fees, workers'' comp, unemployment tax or medical' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_body), '') IS NULL OR char_length(btrim(p_body)) > 2000 THEN
    RAISE EXCEPTION 'A note has words, at most 2000 characters' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = firm;
  SELECT * INTO a FROM public.accounts x WHERE x.id = o.account_id AND x.firm_id = o.firm_id;
  IF o.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing on its opportunities can be changed.' USING ERRCODE = '55000';
  END IF;
  IF p_quote_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.id = p_quote_request_id AND q.session_id = o.intake_id) THEN
    RAISE EXCEPTION 'That PEO is not on this opportunity' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.quote_comparison_notes (firm_id, opportunity_id, quote_request_id, area, visibility, body, author_id)
  VALUES (firm, o.id, p_quote_request_id, p_area, p_visibility, btrim(p_body), auth.uid())
  RETURNING * INTO n;
  RETURN jsonb_build_object('id', n.id, 'body', n.body);
END;
$$;

REVOKE ALL ON FUNCTION public.add_comparison_note(uuid, uuid, bigint, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_comparison_note(uuid, uuid, bigint, text, text, text) TO authenticated;

-- ---------- 2. The comparison ----------
-- One column for each quote request of the opportunity's intake, alphabetical by PEO (as opportunity_page lists them), read as opportunity_page is: by whoever sees
-- the opportunity's account, one refusal (PT404) for an opportunity that is not there, is another firm's or may not be seen.
CREATE FUNCTION public.opportunity_quote_comparison(p_firm_id uuid, p_opportunity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.opportunities;
  a public.accounts;
BEGIN
  IF p_firm_id IS NOT NULL AND p_opportunity_id IS NOT NULL THEN
    SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = p_firm_id;
    SELECT * INTO a FROM public.accounts x WHERE x.id = o.account_id AND x.firm_id = o.firm_id;
  END IF;
  IF o.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object(
    -- Whether a note may be added: the account is not archived (D-432), as the opportunity's page has it.
    'can_add', a.archived_at IS NULL,
    'columns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('quote_request_id', q.id, 'peo_name', q.peo_name, 'status', q.status,
                                          'quote', CASE WHEN cq.id IS NULL THEN NULL ELSE jsonb_build_object(
                                            'id', cq.id, 'kind', cq.kind, 'received_on', cq.received_on, 'expires_on', cq.expires_on, 'proposed_start_on', cq.proposed_start_on,
                                            'admin_fee', cq.admin_fee, 'admin_fee_basis', cq.admin_fee_basis,
                                            -- A cost area left out is NULL and stays JSON null here, never [] or 0 (D-721); the screen reads "Not quoted" from it.
                                            'one_off_fees', cq.one_off_fees, 'workers_comp', cq.workers_comp, 'unemployment', cq.unemployment, 'medical', cq.medical,
                                            'note', cq.note) END)
                       ORDER BY lower(q.peo_name), q.id)
      FROM public.quote_requests q
      -- The current quote is the newest row of the quote request (D-720).
      LEFT JOIN LATERAL (SELECT x.* FROM public.quotes x WHERE x.quote_request_id = q.id ORDER BY x.id DESC LIMIT 1) cq ON true
      WHERE q.session_id = o.intake_id), '[]'::jsonb),
    -- The notes on it, newest first.
    'notes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', n.id, 'quote_request_id', n.quote_request_id, 'area', n.area, 'visibility', n.visibility, 'body', n.body,
                                          'author', public.crm_person_name(n.author_id), 'created_at', n.created_at) ORDER BY n.id DESC)
      FROM public.quote_comparison_notes n WHERE n.opportunity_id = o.id), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_quote_comparison(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_quote_comparison(uuid, uuid) TO authenticated;

-- ---------- 3. Closing a firm deletes its notes on comparisons ----------
-- firm_closing_plan restated from its newest definition (20261124140000_quote_offer.sql) with every line kept, and the one line for the new table (D-777): the notes are
-- the firm's own working notes, deleted with its opportunities. The comparison itself is a read of quotes, which stay with their intake.
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
