-- The employer authorizes each PEO (story M-1.1, slice 6.6a; docs/BROKER_CRM_BUILD.md D-600, D-608, D-620 to D-629; supabase/tests/peo_authorizations.sql).

-- ---------- 1. The wording in force ----------
-- The browser holds the same wording and version (src/data/legalWording.ts); src/data/schemaSync.test.ts keeps the two versions equal.
CREATE FUNCTION public.peo_authorization_version()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- sync:begin peo_authorization_version
    '2026-11-draft-1'::text
    -- sync:end peo_authorization_version
$$;

-- ---------- 2. The record ----------
CREATE TABLE public.peo_authorizations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.chamber_sessions (id) ON DELETE CASCADE,
  peo_id bigint NOT NULL REFERENCES public.peos (id),
  peo_name text NOT NULL,
  authorized boolean NOT NULL,
  wording_version text NOT NULL,
  wording_text text NOT NULL,
  signed_by uuid NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX peo_authorizations_session_peo_idx ON public.peo_authorizations (session_id, peo_id, id DESC);

-- Appended, never changed or deleted, whoever writes, the table's owner included; only deleting the intake takes its rows (reject_audit_change lets
-- complete_intake_deletion through, 20261104092000).
CREATE TRIGGER peo_authorizations_append_only
  BEFORE UPDATE OR DELETE ON public.peo_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

-- Nobody writes it through the API: set_peo_authorization() is the only way in.
ALTER TABLE public.peo_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.peo_authorizations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.peo_authorizations TO authenticated, service_role;

-- Kept like intake_consents: the employer reads their own; the members of the intake's firm read its records, so one can be shown in a dispute.
CREATE POLICY peo_authorizations_employer_read ON public.peo_authorizations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = peo_authorizations.session_id AND s.user_id = auth.uid()));
CREATE POLICY peo_authorizations_firm_read ON public.peo_authorizations FOR SELECT TO authenticated
  USING (public.intake_in_my_firm(session_id));

-- ---------- 3. The employer says ----------
CREATE FUNCTION public.set_peo_authorization(p_session_id uuid, p_peo text, p_authorized boolean, p_version text, p_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  peo public.peos;
  rec public.peo_authorizations;
  w public.submission_workflow;
  note text;
  clean_peo constant text := btrim(COALESCE(p_peo, ''));
  clean_text constant text := btrim(COALESCE(p_text, ''));
BEGIN
  -- The intake's own employer, and nobody else: not its firm's members, another employer, or a caller signed out.
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = p_session_id AND s.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the employer can choose who receives their packet.' USING ERRCODE = '42501';
  END IF;
  -- Signed under the wording the page shows now, or not at all: the browser reloads it (DETAIL the version in force).
  IF p_version IS DISTINCT FROM public.peo_authorization_version() THEN
    RAISE EXCEPTION 'This wording is out of date. Reload the page to read the current version.'
      USING ERRCODE = 'EA005', DETAIL = public.peo_authorization_version();
  END IF;
  IF clean_text = '' OR char_length(clean_text) > 20000 THEN
    RAISE EXCEPTION 'The wording shown is required (1 to 20000 characters).' USING ERRCODE = '22023';
  END IF;
  IF p_authorized IS NULL THEN
    RAISE EXCEPTION 'Say whether the PEO may receive your packet.' USING ERRCODE = '22023';
  END IF;
  IF clean_peo = '' THEN
    RAISE EXCEPTION 'Name the PEO.' USING ERRCODE = '22023';
  END IF;
  -- Only a PEO on the product's list (L-1.1), by name ignoring case and outer spaces; there is no "any PEO".
  SELECT * INTO peo FROM public.peos p WHERE lower(p.name) = lower(clean_peo) AND p.listed;
  IF NOT FOUND THEN
    RAISE EXCEPTION '% is not on the list of PEOs. Ask your advisor to have it added first.', left(clean_peo, 80) USING ERRCODE = '22023';
  END IF;
  -- One change at a time per intake, so two tabs can't both append the same change.
  PERFORM 1 FROM public.chamber_sessions s WHERE s.id = p_session_id FOR UPDATE;
  SELECT * INTO rec FROM public.peo_authorizations a WHERE a.session_id = p_session_id AND a.peo_id = peo.id ORDER BY a.id DESC LIMIT 1;
  -- Saying the same again appends nothing; there is nothing to withdraw from a PEO not authorized.
  IF p_authorized AND rec.authorized THEN
    RETURN to_jsonb(rec);
  ELSIF NOT p_authorized AND rec.authorized IS DISTINCT FROM true THEN
    RAISE EXCEPTION '% is not authorized, so there is nothing to withdraw.', peo.name USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.peo_authorizations (session_id, peo_id, peo_name, authorized, wording_version, wording_text, signed_by)
  VALUES (p_session_id, peo.id, peo.name, p_authorized, p_version, clean_text, auth.uid())
  RETURNING * INTO rec;
  -- Withdrawing a PEO already sent to closes its quote request and marks the submission Needs advisor action, naming the PEO, so an advisor tells it.
  -- The product sends the PEO nothing. Lock order as advisor_record_quote_send's: the pipeline row first, then the quote request.
  IF NOT p_authorized THEN
    SELECT * INTO w FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
    -- A won quote is kept: the win names it.
    IF w.won_quote_request_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.id = w.won_quote_request_id AND lower(q.peo_name) = lower(peo.name)) THEN
      note := format('The employer withdrew %s, whose quote they took. The quote is kept; talk to the employer.', peo.name);
    ELSE
      UPDATE public.quote_requests q SET status = 'closed'
      WHERE q.session_id = p_session_id AND lower(q.peo_name) = lower(peo.name) AND q.status <> 'closed';
      IF FOUND THEN
        note := format('The employer withdrew %s. Tell %s not to use the packet; nothing was sent to it.', peo.name, peo.name);
      END IF;
    END IF;
    IF note IS NOT NULL AND w.session_id IS NOT NULL THEN
      UPDATE public.submission_workflow
      SET needs_action = true, needs_action_note = note, needs_action_at = now(), needs_action_by = auth.uid(), needs_action_by_email = auth.jwt() ->> 'email'
      WHERE session_id = p_session_id;
      INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
      VALUES (p_session_id, w.status, w.status, 'Marked as needing advisor action: ' || note, auth.uid(), auth.jwt() ->> 'email');
    END IF;
  END IF;
  RETURN to_jsonb(rec);
END;
$$;

REVOKE ALL ON FUNCTION public.set_peo_authorization(uuid, text, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_peo_authorization(uuid, text, boolean, text, text) TO authenticated;

-- ---------- 4. The check ----------
CREATE FUNCTION public.peo_authorized(p_session_id uuid, p_peo text)
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
$$;

-- Refuses, in plain words, a PEO the employer never authorized or withdrew. Sends recorded by hand (advisor_record_quote_send) and every send of later
-- slices call it; the bundle link (6.6b) asks peo_authorized each time it is opened.
CREATE FUNCTION public.assert_peo_authorized(p_session_id uuid, p_peo text)
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

-- ---------- 5. Deleted with its intake ----------
-- 20261111110000's complete_intake_deletion, restated with every line it had, and the intake's PEO authorizations counted among what it removed.
CREATE OR REPLACE FUNCTION public.complete_intake_deletion(p_deletion_id uuid, p_files_deleted integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.intake_deletions;
  sid uuid;
  owner_id uuid;
  remaining integer;
  n integer;
  removed jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO d FROM public.intake_deletions WHERE id = p_deletion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deletion not found' USING ERRCODE = 'PT404';
  END IF;
  IF d.status <> 'claimed' THEN
    RAISE EXCEPTION 'Only a claimed deletion can be completed (this one is %)', d.status USING ERRCODE = '55000';
  END IF;
  sid := d.session_id;

  -- Hold the intake still while it is checked and deleted. This waits for any upload still in flight: each
  -- holds a share lock on the row from its policy check (intake_accepts_files) until it commits, so its file
  -- is visible to the check below, and any upload after this one finds the deletion open, or the intake gone.
  SELECT s.user_id INTO owner_id FROM public.chamber_sessions s WHERE s.id = sid FOR UPDATE;
  owner_id := COALESCE(owner_id, d.user_id);

  SELECT count(*)::integer INTO remaining FROM public.intake_stored_files(sid, owner_id);
  IF remaining > 0 THEN
    RAISE EXCEPTION 'The intake still has % stored file(s); remove them first', remaining
      USING ERRCODE = 'EA006', DETAIL = remaining::text;
  END IF;

  PERFORM set_config('eaa.deleting_intake', sid::text, true);

  -- Children first, so each count says what that table held; the session row last.
  DELETE FROM public.manuscript_versions WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('manuscript_versions', n);
  DELETE FROM public.advisor_review_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_review_events', n);
  DELETE FROM public.advisor_field_reviews WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_field_reviews', n);
  DELETE FROM public.advisor_notes WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_notes', n);
  DELETE FROM public.information_requests WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('information_requests', n);
  -- The employer's say over which PEOs may receive the packet (M-1.1): append-only, so only here.
  DELETE FROM public.peo_authorizations WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('peo_authorizations', n);
  DELETE FROM public.submission_status_history WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('submission_status_history', n);
  DELETE FROM public.submission_workflow WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('submission_workflow', n);
  -- After the pipeline row, which names the winning quote request.
  DELETE FROM public.quote_request_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_events', n);
  DELETE FROM public.quote_request_notes WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_notes', n);
  -- Mail first: its rows name the quote request, and each attachment names its message.
  DELETE FROM public.quote_request_message_attachments a USING public.quote_request_messages m
    WHERE a.message_id = m.id AND m.session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_message_attachments', n);
  DELETE FROM public.quote_request_messages WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_messages', n);
  DELETE FROM public.quote_request_addresses WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_addresses', n);
  DELETE FROM public.quote_requests WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_requests', n);
  DELETE FROM public.intake_lifecycle_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('intake_lifecycle_events', n);
  DELETE FROM public.outbox_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('outbox_events', n);
  DELETE FROM public.chamber_certifications WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('chamber_certifications', n);
  DELETE FROM public.document_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('document_events', n);
  DELETE FROM public.documents WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('documents', n);
  DELETE FROM public.ai_extraction_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('ai_extraction_events', n);
  -- Operational events stay (they are counts for monitoring) but no longer point at the intake.
  UPDATE public.ops_events SET session_id = NULL WHERE session_id = sid;
  -- So are the funnel's milestones: how far the intake got stays, with no link to whose it was.
  UPDATE public.intake_milestones SET session_id = NULL WHERE session_id = sid;
  DELETE FROM public.chamber_sessions WHERE id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('chamber_sessions', n);

  PERFORM set_config('eaa.deleting_intake', '', true);

  UPDATE public.intake_deletions
  SET status = 'done',
      completed_at = now(),
      locked_until = NULL,
      last_error = NULL,
      files_deleted = GREATEST(COALESCE(p_files_deleted, 0), 0),
      rows_deleted = removed
  WHERE id = d.id;
  RETURN removed;
END;
$$;
-- ---------- 6. Each PEO's current state ----------
-- Every listed PEO, and any PEO no longer listed that the employer said something about, alphabetically: authorized, withdrawn or not asked, with when
-- and under which wording it was last said.
CREATE FUNCTION public.peo_authorization_states(p_session_id uuid)
RETURNS TABLE (peo text, state text, signed_at timestamptz, wording_version text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- The employer, and the members of the intake's firm (D-16, D-18); anyone else is told there is no such submission.
  IF NOT (EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = p_session_id AND s.user_id = auth.uid())
          OR public.intake_in_my_firm(p_session_id)) THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN QUERY
  SELECT p.name,
         CASE WHEN l.id IS NULL THEN 'not_asked' WHEN l.authorized THEN 'authorized' ELSE 'withdrawn' END,
         l.signed_at, l.wording_version
  FROM public.peos p
  LEFT JOIN LATERAL (
    SELECT a.id, a.authorized, a.signed_at, a.wording_version FROM public.peo_authorizations a
    WHERE a.session_id = p_session_id AND a.peo_id = p.id ORDER BY a.id DESC LIMIT 1) l ON true
  WHERE p.listed OR l.id IS NOT NULL
  ORDER BY lower(p.name);
END;
$$;

REVOKE ALL ON FUNCTION public.peo_authorization_states(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peo_authorization_states(uuid) TO authenticated;

-- ---------- 7. Who may call what ----------
-- The checks are the database's own, for the functions that send: no API role asks them, so nobody learns another employer's choices by guessing ids.
REVOKE ALL ON FUNCTION public.peo_authorized(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.assert_peo_authorized(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 8. No send recorded without a live authorization ----------
-- 20261120090000's advisor_record_quote_send, with every rule it had (the closing-firm check first, the advisor, the intake in the caller's firm, the PEO
-- name, the stages a send is recorded at, one quote request for each PEO, the reply address, the move to Sent to PEOs), and now the employer's
-- authorization of that PEO, checked after the name and before anything is read or changed.
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
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');
  IF peo = '' THEN
    RAISE EXCEPTION 'Name the PEO the packet went to' USING ERRCODE = '22023';
  END IF;
  -- sync:begin quote_peo_length
  IF char_length(peo) > 80 THEN
  -- sync:end quote_peo_length
    RAISE EXCEPTION 'A PEO name is limited to 80 characters' USING ERRCODE = '22023';
  END IF;
  -- M-1.1: no send to a PEO without the employer's live authorization; the database refuses it, not only the screen.
  PERFORM public.assert_peo_authorized(p_session_id, peo);
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
  -- ADR 0026: a send recorded while the submission is Ready for market moves it to Sent to PEOs, in this transaction, and at no other stage.
  IF stage = 'ready_for_market' THEN
    PERFORM public.submission_move_for_cause(p_session_id, 'ready_for_market', 'sent_to_carrier', 'quote_send', req.id);
  END IF;
  RETURN to_jsonb(req);
END;
$function$;

-- ---------- 9. Closing a firm keeps them ----------
-- The closing's one list (20261121090000), restated with every line it had, and the employer's PEO authorizations kept with their intake.
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
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;
