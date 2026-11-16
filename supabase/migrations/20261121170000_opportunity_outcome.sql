-- The review of CRM-O1.3b: a win and a reopening move the opportunity's version, and the outcome is one read (docs/BROKER_CRM_BUILD.md D-24, D-28, D-46, D-209, D-407,
-- D-423, D-461 to D-474; ADR 0027; GLOSSARY.md "The broker's CRM"; 20261120121000_won_lost_commission.sql, 20261120120000_opportunity_page.sql).
--
--   * P1, the version. opportunity_mark_won and opportunity_reopen (from a win) wrote nothing on the opportunity's own row when it had an intake, so its version
--     stayed where it was: a reopen from a page that predates the win, or from a win that has since been reopened and made again, passed the check and undid
--     the newer win, and a win from a page that had been through a win and a reopening was not told so. The opportunity gets won_at and won_by, as it has
--     lost_at and lost_by; they are tracked fields (history and version), added to the list as it stands (read from the version trigger, as
--     20261120130000_opportunity_create.sql adds the referral partner), so a win and its reopening each move the version by one, appear in the opportunity's
--     history, and each answer names the opportunity's new version.
--   * P2, one read. opportunity_outcome(firm, opportunity): the lost reason and note, the placement with its commission, the renewal made with it, the payments
--     with what is received to date, and each quote's close reason and proposed start, in one snapshot, with opportunity_page's
--     visibility (PT404 for an opportunity the caller may not see, a support session reads). The page read the tables one by one, in two waves.
--
-- Restated from their LATEST definition (20261120121000 is the only one: no later migration restates either function), each with every rule it had and the
-- one change above: opportunity_mark_won and opportunity_reopen. record_history_table is not widened (opportunities is already in it).

SET lock_timeout = '5s';

-- ---------- 1. When it was won, and by whom ----------
ALTER TABLE public.opportunities
  ADD COLUMN won_at timestamptz,
  ADD COLUMN won_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD CONSTRAINT opportunities_won_by_check CHECK (won_by IS NULL OR won_at IS NOT NULL);

COMMENT ON COLUMN public.opportunities.won_at IS 'When the opportunity was marked won (D-461); null while it is not won. Cleared by a reopening (the history keeps it). A tracked field: a win and its reopening move the version (D-46).';
COMMENT ON COLUMN public.opportunities.won_by IS 'Who marked it won (null when that person''s account is gone).';

-- Tracked fields (history and version): added to what the table tracks when this runs, read from its version trigger, so a field another story added to the
-- list (lost_reason and lost_note, the referral partner) is kept and a restated copy of an older list cannot drop it. Calling record_track again replaces its
-- triggers with themselves. No table is added to the history's list of tables: opportunities is already there.
DO $$
DECLARE
  fields text[];
BEGIN
  SELECT array_agg(r.m[1] ORDER BY r.ord) INTO fields
  FROM pg_trigger t CROSS JOIN LATERAL regexp_matches(pg_get_triggerdef(t.oid), '''([a-z0-9_]+)''', 'g') WITH ORDINALITY AS r (m, ord)
  WHERE t.tgrelid = 'public.opportunities'::regclass AND t.tgname = 'opportunities_version';
  IF fields IS NULL THEN
    RAISE EXCEPTION 'public.opportunities has no version trigger to read its tracked fields from';
  END IF;
  IF NOT 'won_at' = ANY (fields) THEN fields := array_append(fields, 'won_at'); END IF;
  IF NOT 'won_by' = ANY (fields) THEN fields := array_append(fields, 'won_by'); END IF;
  PERFORM public.record_track('public.opportunities', 'opportunities', ARRAY['id'], fields);
END $$;

-- ---------- 2. Marking won, restated: the win moves the version ----------
-- Everything opportunity_mark_won did before (20261120121000, section 3: its questions in their order, the fields, the version, the locks, the submission moved
-- to Won naming the quote, the other open quotes closed, the placement, the renewal, the end of the renewed placement) and one more step: the opportunity's own
-- row records the win (won_at, won_by), which raises its version by exactly one. The answer's record.version is that new version, where it used to be the one
-- the save started from.
CREATE OR REPLACE FUNCTION public.opportunity_mark_won(
  p_opportunity_id uuid, p_quote_request_id bigint, p_start_date date DEFAULT NULL, p_renewal_date date DEFAULT NULL, p_broker_of_record text DEFAULT NULL,
  p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL, p_commission_basis text DEFAULT NULL, p_commission_rate numeric DEFAULT NULL,
  p_commission_expected_yearly numeric DEFAULT NULL, p_time_zone text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  broker text := NULLIF(btrim(p_broker_of_record), '');
  problem text;
  cur public.opportunities;
  pipeline text;
  q public.quote_requests;
  started date;
  renewing date;
  old_r public.renewals;
  old_p public.placements;
  pl public.placements;
  rn public.renewals;
  closed bigint[];
  ended uuid;
  version_now integer;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  problem := CASE
    WHEN broker IS NULL THEN 'Say who the broker of record is.'
    WHEN char_length(broker) > 120 THEN 'Keep the broker of record to 120 characters.'
    ELSE public.commission_input_error(p_commission_basis, p_commission_rate, p_commission_expected_yearly) END;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the opportunity it started from, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  cur := public.opportunity_to_change(firm, p_opportunity_id, 'change');
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the opportunity that does not exist, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  IF p_version < cur.version THEN
    RETURN jsonb_build_object('conflict', true, 'currentVersion', cur.version, 'current', jsonb_build_object('stage', public.opportunity_stage(cur.id)),
      'changed', public.record_version_changes(cur.firm_id, 'opportunities', cur.id::text, p_version, cur.version));
  END IF;

  IF cur.intake_id IS NULL THEN
    RAISE EXCEPTION '%', CASE WHEN cur.lost_at IS NOT NULL THEN 'This opportunity is lost. Reopen it first.'
      ELSE 'Won needs a quote the employer took. None of this opportunity''s quotes is quoted yet' END USING ERRCODE = '22023';
  END IF;
  -- The submission's pipeline row before its quote requests, as set_submission_status holds them.
  SELECT w.status INTO pipeline FROM public.submission_workflow w WHERE w.session_id = cur.intake_id FOR UPDATE;
  IF pipeline IS DISTINCT FROM 'quoted' THEN
    RAISE EXCEPTION '%', CASE
      -- Archived from a stage other than Won or Lost has no outcome to reopen: it is restored from the archive (as opportunity_reopen says).
      WHEN pipeline = 'archived' AND NOT COALESCE((SELECT x.from_status IN ('won', 'lost') FROM public.submission_status_history x
                                                  WHERE x.session_id = cur.intake_id AND x.to_status = 'archived' AND x.from_status IS DISTINCT FROM 'archived'
                                                  ORDER BY x.id DESC LIMIT 1), false) THEN 'This opportunity''s submission is archived. Restore it from the archive.'
      WHEN public.opportunity_stage(cur.id) = 'won' THEN 'This opportunity is already won.'
      WHEN public.opportunity_stage(cur.id) = 'lost' THEN 'This opportunity is lost. Reopen it first.'
      ELSE 'Only a quoted opportunity can be won. It is ' || replace(public.opportunity_stage(cur.id), '_', ' ') END USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.quote_requests x WHERE x.session_id = cur.intake_id ORDER BY x.id FOR UPDATE;
  SELECT * INTO q FROM public.quote_requests x WHERE x.id = p_quote_request_id AND x.session_id = cur.intake_id AND x.status = 'quoted';
  IF q.id IS NULL THEN
    RAISE EXCEPTION '%', CASE WHEN EXISTS (SELECT 1 FROM public.quote_requests x WHERE x.session_id = cur.intake_id AND x.status = 'quoted')
      THEN 'Choose which of this opportunity''s quoted quotes the employer took.'
      ELSE 'Won needs a quote the employer took. None of this opportunity''s quotes is quoted yet' END USING ERRCODE = '22023';
  END IF;

  started := COALESCE(p_start_date, q.proposed_start_on, cur.target_start);
  IF started IS NULL THEN
    RAISE EXCEPTION 'Give the start date.' USING ERRCODE = '22023';
  END IF;
  renewing := COALESCE(p_renewal_date, (started + interval '1 year')::date);
  IF renewing <= started THEN
    RAISE EXCEPTION 'The renewal must come after the start.' USING ERRCODE = '22023';
  END IF;

  -- D-456: the renewal this opportunity works, and the placement it came from, which this win ends.
  SELECT * INTO old_r FROM public.renewals r WHERE r.opportunity_id = cur.id FOR NO KEY UPDATE;
  IF old_r.id IS NOT NULL AND old_r.placement_id IS NOT NULL THEN
    SELECT * INTO old_p FROM public.placements p WHERE p.id = old_r.placement_id FOR NO KEY UPDATE;
    IF old_p.start_date IS NOT NULL AND started < old_p.start_date THEN
      RAISE EXCEPTION 'The placement this renews started on %, so the new one can''t start before.', to_char(old_p.start_date, 'YYYY-MM-DD') USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.submission_workflow SET status = 'won', won_quote_request_id = q.id, updated_at = now(), updated_by = auth.uid() WHERE session_id = cur.intake_id;
  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email, cause, cause_quote_request_id)
  VALUES (cur.intake_id, 'quoted', 'won', 'Won: ' || q.peo_name, auth.uid(), auth.jwt() ->> 'email', 'quote_taken', q.id);
  WITH c AS (
    UPDATE public.quote_requests x SET status = 'closed', close_reason = 'went_elsewhere'
    WHERE x.session_id = cur.intake_id AND x.status IN ('sent', 'quoted') AND x.id <> q.id RETURNING x.id)
  SELECT COALESCE(array_agg(c.id ORDER BY c.id), '{}') INTO closed FROM c;
  INSERT INTO public.placements (firm_id, account_id, opportunity_id, quote_request_id, peo_name, start_date, broker_of_record,
                                 commission_basis, commission_rate, commission_expected_yearly)
  VALUES (cur.firm_id, cur.account_id, cur.id, q.id, q.peo_name, started, broker, p_commission_basis, p_commission_rate, p_commission_expected_yearly)
  RETURNING * INTO pl;
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, placement_id)
  VALUES (cur.firm_id, cur.account_id, 'peo_placement', q.peo_name, renewing, pl.id) RETURNING * INTO rn;
  IF old_p.id IS NOT NULL AND old_p.ended_on IS NULL THEN
    UPDATE public.placements SET ended_on = started WHERE id = old_p.id;
    ended := old_p.id;
  END IF;
  -- The win is a change of the opportunity (D-46): when and by whom are its own tracked fields, so its version moves with it and the next save, a reopening
  -- from the page's older view and a second win from it are told someone else got there first.
  UPDATE public.opportunities SET won_at = now(), won_by = auth.uid() WHERE id = cur.id RETURNING version INTO version_now;
  RETURN jsonb_build_object('conflict', false, 'record', jsonb_build_object(
    'id', cur.id, 'stage', 'won', 'version', version_now, 'quote_request_id', q.id, 'closed_quote_request_ids', to_jsonb(closed),
    'placement', public.crm_placement_row(pl),
    'renewal', public.crm_renewal_row(rn, (now() AT TIME ZONE public.workspace_time_zone(p_time_zone))::date),
    'ended_placement_id', ended));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_mark_won(uuid, bigint, date, date, text, uuid, integer, text, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_mark_won(uuid, bigint, date, date, text, uuid, integer, text, numeric, numeric, text) TO authenticated;

-- ---------- 3. Reopening, restated: reopening a win moves the version ----------
-- Everything opportunity_reopen did before (section 6 of 20261120121000) and one more step for a win: the opportunity's won_at and won_by are cleared, which
-- raises its version, so a reopening from a view older than the win, or older than a later win, is a conflict and undoes nothing. The answer's record.version is
-- the opportunity's version after the reopening, for a win as it already was for a loss.
CREATE OR REPLACE FUNCTION public.opportunity_reopen(p_opportunity_id uuid, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.opportunities;
  pipeline text;
  was text;
  prior text;
  target text;
  pl public.placements;
  win_r public.renewals;
  work_r public.renewals;
  worker text;
  version_now integer;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the opportunity it started from, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  cur := public.opportunity_to_change(firm, p_opportunity_id, 'reopen');
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the opportunity that does not exist, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  IF p_version < cur.version THEN
    RETURN jsonb_build_object('conflict', true, 'currentVersion', cur.version, 'current', jsonb_build_object('stage', public.opportunity_stage(cur.id)),
      'changed', public.record_version_changes(cur.firm_id, 'opportunities', cur.id::text, p_version, cur.version));
  END IF;
  version_now := cur.version;

  IF cur.intake_id IS NULL THEN
    IF cur.lost_at IS NULL THEN
      RAISE EXCEPTION 'This opportunity isn''t won or lost.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.opportunities SET lost_at = NULL, lost_by = NULL, lost_reason = NULL, lost_note = NULL WHERE id = cur.id RETURNING version INTO version_now;
  ELSE
    -- The submission's pipeline row before its quote requests, placement and renewals.
    SELECT w.status INTO pipeline FROM public.submission_workflow w WHERE w.session_id = cur.intake_id FOR UPDATE;
    IF pipeline IN ('won', 'lost') THEN
      was := pipeline;
    ELSIF pipeline = 'archived' THEN
      -- Archived straight from Won or Lost is still that outcome (D-216, D-471): the last move into archived says which.
      SELECT x.from_status INTO prior FROM public.submission_status_history x
      WHERE x.session_id = cur.intake_id AND x.to_status = 'archived' AND x.from_status IS DISTINCT FROM 'archived' ORDER BY x.id DESC LIMIT 1;
      IF prior IN ('won', 'lost') THEN
        was := prior;
      ELSE
        RAISE EXCEPTION 'This opportunity was archived, not won or lost. Restore it from the archive.' USING ERRCODE = '22023';
      END IF;
    ELSE
      RAISE EXCEPTION 'This opportunity isn''t won or lost.' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.quote_requests x WHERE x.session_id = cur.intake_id ORDER BY x.id FOR UPDATE;

    IF was = 'won' THEN
      SELECT * INTO pl FROM public.placements p WHERE p.opportunity_id = cur.id FOR NO KEY UPDATE;
      IF pl.id IS NOT NULL THEN
        SELECT * INTO win_r FROM public.renewals r WHERE r.placement_id = pl.id FOR NO KEY UPDATE;
        IF win_r.opportunity_id IS NOT NULL THEN
          SELECT o.name INTO worker FROM public.opportunities o WHERE o.id = win_r.opportunity_id;
          RAISE EXCEPTION 'Its renewal is being worked by %', COALESCE(worker, 'an opportunity') USING ERRCODE = 'PT409';
        END IF;
        -- The placement is held, so no payment can be recorded against it between this question and the delete below.
        IF EXISTS (SELECT 1 FROM public.commission_payments c WHERE c.placement_id = pl.id) THEN
          RAISE EXCEPTION 'Delete its payments first' USING ERRCODE = 'PT409';
        END IF;
      END IF;
      -- The renewal this opportunity itself works: the win ended its placement (D-456), so the reopening lets it run again.
      SELECT * INTO work_r FROM public.renewals r WHERE r.opportunity_id = cur.id FOR NO KEY UPDATE;
      IF work_r.id IS NOT NULL AND work_r.placement_id IS NOT NULL AND work_r.not_renewed_on IS NULL THEN
        UPDATE public.placements SET ended_on = NULL WHERE id = work_r.placement_id AND ended_on IS NOT NULL;
      END IF;
      IF pl.id IS NOT NULL THEN
        DELETE FROM public.placements WHERE id = pl.id;
      END IF;
      target := 'quoted';
      UPDATE public.submission_workflow SET status = target, won_quote_request_id = NULL, updated_at = now(), updated_by = auth.uid() WHERE session_id = cur.intake_id;
      -- The win's mark goes with it, which moves the version (a reopening from an older view is then a conflict, and so is a second reopening).
      UPDATE public.opportunities SET won_at = NULL, won_by = NULL WHERE id = cur.id RETURNING version INTO version_now;
    ELSE
      -- The last move INTO Lost: marking or clearing needs action writes lost-to-lost rows, which are not where it was lost from.
      SELECT x.from_status INTO target FROM public.submission_status_history x
      WHERE x.session_id = cur.intake_id AND x.to_status = 'lost' AND x.from_status IS DISTINCT FROM 'lost' ORDER BY x.id DESC LIMIT 1;
      target := COALESCE(target, 'submitted');
      UPDATE public.submission_workflow SET status = target, updated_at = now(), updated_by = auth.uid() WHERE session_id = cur.intake_id;
      UPDATE public.opportunities SET lost_reason = NULL, lost_note = NULL WHERE id = cur.id RETURNING version INTO version_now;
    END IF;
    INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
    VALUES (cur.intake_id, pipeline, target, 'Reopened', auth.uid(), auth.jwt() ->> 'email');
  END IF;
  RETURN jsonb_build_object('conflict', false, 'record', jsonb_build_object('id', cur.id, 'stage', public.opportunity_stage(cur.id), 'version', version_now));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_reopen(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_reopen(uuid, uuid, integer) TO authenticated;

-- ---------- 4. The outcome, in one read (D-423) ----------
-- What the won or lost banner, the close dialog and the Quotes panel read beyond the page: the lost reason and note (D-468), the placement a win made with its
-- commission and version (D-466, D-472), the renewal made with it, the payments with what is received to date (D-467) and each quote request's close reason and
-- proposed start (D-424, D-465). The visibility is opportunity_page's, exactly: whoever may see the opportunity's account (can_see_firm_record, which lets a support
-- session read), and one refusal, PT404, for an opportunity that is not there, is another firm's, may not be seen, or was asked with no firm or no id. Answers
-- {lost_reason, lost_note, placement: {id, peo_name, start_date, broker_of_record, ended_on, commission_basis, commission_rate, commission_expected_yearly,
-- version} | null, renewal: {id, renews_on} | null, payments: [{id, received_on, amount, note, version}] (earliest day first), received_to_date,
-- quotes: [{id, close_reason, proposed_start_on}]} (one per quote request of the opportunity's intake, by id; none without an intake). One statement's snapshot:
-- the function is STABLE, so every read in it sees the same data.
CREATE FUNCTION public.opportunity_outcome(p_firm_id uuid, p_opportunity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.opportunities;
  a public.accounts;
  pl public.placements;
  rn public.renewals;
BEGIN
  IF p_firm_id IS NOT NULL AND p_opportunity_id IS NOT NULL THEN
    SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = p_firm_id;
    SELECT * INTO a FROM public.accounts x WHERE x.id = o.account_id AND x.firm_id = o.firm_id;
  END IF;
  IF o.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO pl FROM public.placements p WHERE p.opportunity_id = o.id AND p.firm_id = o.firm_id;
  IF pl.id IS NOT NULL THEN
    SELECT * INTO rn FROM public.renewals r WHERE r.placement_id = pl.id;
  END IF;
  RETURN jsonb_build_object(
    'lost_reason', o.lost_reason,
    'lost_note', o.lost_note,
    'placement', CASE WHEN pl.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', pl.id, 'peo_name', pl.peo_name, 'start_date', pl.start_date, 'broker_of_record', pl.broker_of_record, 'ended_on', pl.ended_on,
      'commission_basis', pl.commission_basis, 'commission_rate', pl.commission_rate, 'commission_expected_yearly', pl.commission_expected_yearly,
      'version', pl.version) END,
    'renewal', CASE WHEN rn.id IS NULL THEN NULL ELSE jsonb_build_object('id', rn.id, 'renews_on', rn.renews_on) END,
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'received_on', c.received_on, 'amount', c.amount, 'note', c.note, 'version', c.version) ORDER BY c.received_on, c.created_at, c.id)
      FROM public.commission_payments c WHERE c.placement_id = pl.id), '[]'::jsonb),
    'received_to_date', COALESCE((SELECT sum(c.amount) FROM public.commission_payments c WHERE c.placement_id = pl.id), 0),
    'quotes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', q.id, 'close_reason', q.close_reason, 'proposed_start_on', q.proposed_start_on) ORDER BY q.id)
      FROM public.quote_requests q WHERE q.session_id = o.intake_id), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_outcome(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_outcome(uuid, uuid) TO authenticated;
