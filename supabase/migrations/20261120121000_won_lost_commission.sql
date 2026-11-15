-- Won, lost and reopen in one step each, with commission (story CRM-O1.3a, Epic 4 build order row 4; docs/BROKER_CRM_BUILD.md D-24, D-28, D-45, D-46, D-209, D-222,
-- D-407, D-446, D-456, D-461 to D-474; ADR 0027; GLOSSARY.md "The broker's CRM"; ADR 0023, ADR 0024; 20261120090000_opportunity_stage.sql,
-- 20261120110000_placements_renewals.sql).
--
-- What this is. The database half of CRM-O1.3 with Q-4.1 (the dialog, the banner and "Record a payment" are CRM-O1.3b). The timestamp is this story's own:
-- the planned 20261120120000 belongs to CRM-O1.1a, and 20261120111000 is already merged, so earlier planned numbers are superseded.
--
--   * opportunity_mark_won: one step, all or none. The submission moves to Won naming the quote the employer took (the one place a quote is chosen, D-464),
--     the other open quotes are closed with the reason "went elsewhere", the placement is made (the PEO from the quote, the start, the broker of record, the
--     opportunity, the quote request, and the commission expected, Q-4.1) with its renewal (a year after the start unless said), and, when the opportunity
--     works a renewal, that renewal's placement ends on the new placement's start (D-456, D-474).
--   * opportunity_mark_lost: a reason from a fixed list (other needs a note). With an intake the submission moves to Lost and its open quotes close "search
--     ended"; with none the opportunity keeps Lost itself (lost_at, lost_by). Either way the reason and note are kept on the opportunity.
--   * opportunity_reopen (ADR 0027): won goes back to Quoted (the quote no longer chosen, the placement and its renewal deleted); lost goes back to the stage
--     it was lost from (or Qualifying with no intake). Refused while the win's renewal is worked by an opportunity or its placement has payments.
--   * commission_payments (Q-4.1, D-467): what the firm received, recorded, edited and deleted through functions, with a history and a version; only against a
--     placement won from an opportunity. set_placement_commission adds, changes or clears a placement's expected commission later (D-466).
--   * The win is in the opportunity's history with the quote taken (cause quote_taken, D-473); undoing "Didn't renew" is refused while the renewal's opportunity
--     is won (the review fixes at the end of this file).
--   * set_submission_status refuses Won and Lost for a submission on an opportunity, and the restore of a submission archived straight from Won or Lost (D-470, D-471).
--
-- Every function asks, in this order: the firm (42501), the guard that refuses a closing firm and Nevermore support (PT423), the fields (22023), the version
-- (22023), then locks the ACCOUNT first (FOR NO KEY UPDATE, as renewal_to_change, archive and owner change do), then the opportunity, then (set_submission_status
-- locks the workflow row before the quote requests) the submission's pipeline row, its quote requests, the placement and the renewals; and asks may the caller see
-- it (PT404), may they change it (42501), is the account archived (55000).

SET lock_timeout = '5s';

-- ---------- 1. What the tables keep ----------
-- Why a quote request closed (D-464): the employer went elsewhere (another quote was chosen) or the search ended (it was lost). Null for a quote an advisor closed by
-- hand, and for any quote that is not closed: a trigger clears it when a send opens the request again.
ALTER TABLE public.quote_requests
  ADD COLUMN close_reason text CONSTRAINT quote_requests_close_reason_check CHECK (close_reason IN ('went_elsewhere', 'search_ended')),
  ADD CONSTRAINT quote_requests_close_reason_closed CHECK (close_reason IS NULL OR status = 'closed');

COMMENT ON COLUMN public.quote_requests.close_reason IS 'Why a closed quote request closed: went_elsewhere (another quote was chosen) or search_ended (the opportunity was lost). Null otherwise (CRM-O1.3a, D-464).';

CREATE FUNCTION public.quote_request_clear_close_reason()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status <> 'closed' THEN
    NEW.close_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.quote_request_clear_close_reason() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER quote_requests_clear_close_reason BEFORE INSERT OR UPDATE OF status ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.quote_request_clear_close_reason();

-- The quote taken in the opportunity's history (D-473): a win is a move with a cause, as a send or a recorded quote is (ADR 0026, 20261120090000). The cause
-- check gains a third word, additively: every row there keeps its value. record_history_list is unchanged and returns it, with the PEO's name.
ALTER TABLE public.submission_status_history DROP CONSTRAINT submission_status_history_cause_check;
ALTER TABLE public.submission_status_history ADD CONSTRAINT submission_status_history_cause_check CHECK (cause IN ('quote_send', 'quote_recorded', 'quote_taken'));

COMMENT ON COLUMN public.submission_status_history.cause IS 'Why the submission moved when no person chose the move: quote_send (a send recorded at Ready for market), quote_recorded (a quote recorded at Sent to PEOs), ADR 0026, or quote_taken (the quote the employer took, on a win, D-473). Null for a person''s own move.';

-- The commission a placement expects (Q-4.1, D-466): the basis (a share of the admin fee, per employee per month, or flat a year), its number (the percent as a
-- person types it, 20 for 20%, above 0 and at most 100; or dollars, above 0) and the figure expected a year. All optional together: no basis, no number; a yearly
-- figure needs its basis. One column holds the number for every basis, wide enough for dollars; the share's limit is the check.
ALTER TABLE public.placements
  ADD COLUMN commission_basis text CONSTRAINT placements_commission_basis_check CHECK (commission_basis IN ('share', 'per_employee', 'flat')),
  ADD COLUMN commission_rate numeric(14, 2),
  ADD COLUMN commission_expected_yearly numeric(14, 2),
  ADD CONSTRAINT placements_commission_rate_check CHECK (
    (commission_basis IS NULL) = (commission_rate IS NULL)
    AND (commission_rate IS NULL OR commission_rate > 0)
    AND (commission_basis IS DISTINCT FROM 'share' OR commission_rate <= 100)),
  ADD CONSTRAINT placements_commission_expected_check CHECK (commission_expected_yearly IS NULL OR (commission_basis IS NOT NULL AND commission_expected_yearly >= 0));

COMMENT ON COLUMN public.placements.commission_basis IS 'The expected commission''s basis (glossary: Commission basis): share (of the admin fee, per employee per month), per_employee (dollars per employee per month) or flat (dollars a year). Null: none recorded.';
COMMENT ON COLUMN public.placements.commission_rate IS 'The basis''s number: a percent (20 for 20%) for share, dollars otherwise.';
COMMENT ON COLUMN public.placements.commission_expected_yearly IS 'The commission expected a year, in dollars: worked out by the dialog and overwritable by the person (D-466).';

-- ---------- 2. Small pieces, internal ----------
-- The first thing wrong with the commission asked for, in words, or NULL. Internal.
CREATE FUNCTION public.commission_input_error(p_basis text, p_rate numeric, p_yearly numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_basis IS NOT NULL AND p_basis NOT IN ('share', 'per_employee', 'flat') THEN 'Choose how the commission is worked out: a share of the admin fee, per employee, or flat.'
    WHEN p_basis IS NULL AND (p_rate IS NOT NULL OR p_yearly IS NOT NULL) THEN 'Choose how the commission is worked out.'
    WHEN p_basis IS NOT NULL AND p_rate IS NULL THEN 'Give the commission''s number.'
    WHEN p_rate <= 0 THEN 'The commission must be more than zero.'
    WHEN p_rate <> round(p_rate, 2) THEN 'Keep the commission to cents.'
    WHEN p_basis = 'share' AND p_rate > 100 THEN 'A share is a percent: 100 at most.'
    WHEN p_rate > 999999999999.99 THEN 'That commission is too large.'
    WHEN p_yearly < 0 THEN 'The expected commission can''t be negative.'
    WHEN p_yearly > 999999999999.99 THEN 'That expected commission is too large.'
    WHEN p_yearly <> round(p_yearly, 2) THEN 'Keep the expected commission to cents.'
  END
$$;

REVOKE ALL ON FUNCTION public.commission_input_error(text, numeric, numeric) FROM PUBLIC, anon, authenticated, service_role;

-- A placement as the screens read it (the banner's commission line). Internal.
CREATE FUNCTION public.crm_placement_row(p public.placements)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'account_id', p.account_id, 'opportunity_id', p.opportunity_id, 'quote_request_id', p.quote_request_id, 'peo_name', p.peo_name,
    'start_date', p.start_date, 'broker_of_record', p.broker_of_record, 'ended_on', p.ended_on,
    'commission_basis', p.commission_basis, 'commission_rate', p.commission_rate, 'commission_expected_yearly', p.commission_expected_yearly,
    'version', p.version)
$$;

REVOKE ALL ON FUNCTION public.crm_placement_row(public.placements) FROM PUBLIC, anon, authenticated, service_role;

-- The firm's opportunity, held for the change, after the questions every write asks: may the caller see its account (PT404, one answer for an opportunity that
-- is not there, is another firm's or may not be seen), may they do this (42501, in words), is the account archived (55000, D-222). `p_rule` 'change' is the level
-- rule on the opportunity's own record owner (D-209, D-222, D-422: with no owner, a firm owner only); 'reopen' is the opportunity's record owner or an owner of
-- the firm (D-462). Returns it. Internal: the callers have asked the firm and the guard.
-- Lock order: the ACCOUNT first, then the opportunity, as renewal_to_change takes the account before the renewal: the account an archive, an owner change and a
-- delete hold is waited for before anything of the opportunity is held, and the level rule is asked of the account and the opportunity as they stand once held.
CREATE FUNCTION public.opportunity_to_change(p_firm_id uuid, p_opportunity_id uuid, p_rule text)
RETURNS public.opportunities
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  cur public.opportunities;
  a public.accounts;
  acct uuid;
BEGIN
  SELECT x.account_id INTO acct FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = p_firm_id;
  IF acct IS NOT NULL THEN
    SELECT * INTO a FROM public.accounts y WHERE y.id = acct FOR NO KEY UPDATE;
  END IF;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  -- Then the opportunity, which another session may have deleted while this one waited for the account.
  SELECT * INTO cur FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = p_firm_id FOR NO KEY UPDATE;
  IF cur.id IS NULL THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  -- The account held is the one the opportunity was on before the wait; if it moved meanwhile, the level rule and the archive check below would be asked of the
  -- wrong account (CRM-O1.1a's update_opportunity refuses the same way).
  IF cur.account_id <> a.id THEN
    RAISE EXCEPTION 'That opportunity was moved while you were working. Try again.' USING ERRCODE = '40001';
  END IF;
  IF p_rule = 'reopen' THEN
    IF NOT ((cur.owner_id IS NOT NULL AND cur.owner_id = auth.uid()) OR public.firm_role(cur.firm_id) = 'owner') THEN
      RAISE EXCEPTION 'Only the opportunity''s owner or an owner of the firm can reopen it.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.can_change_firm_record(cur.firm_id, cur.owner_id) THEN
    RAISE EXCEPTION '%', CASE WHEN cur.owner_id IS NULL
      THEN 'An opportunity with no owner can only be changed by an owner of the firm.'
      ELSE 'Only the opportunity''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
      USING ERRCODE = '42501';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing on it can be changed.' USING ERRCODE = '55000';
  END IF;
  RETURN cur;
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_to_change(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. Marking won (D-461, D-463 to D-466, D-474) ----------
-- Marks the opportunity won on the quote the employer took, from the version the person started from (D-46). `p_start_date` is the placement's start (offered as the
-- quote's proposed start, else the opportunity's target start: used when not sent), `p_renewal_date` the renewal's (a year after the start when not sent) and
-- must come after the start; `p_broker_of_record` is required, at most 120. The commission is optional: its basis, number and the yearly figure expected.
-- In one transaction: the submission is Won naming the quote, every other open quote is closed 'went_elsewhere', the placement is made, the renewal is added
-- (with the PEO, on the date) and, when this opportunity works a renewal, that renewal's placement ends on the new start (D-456). The account is then a client
-- because its status is worked out. Answers {conflict: false, record: {id, stage, version, quote_request_id, closed_quote_request_ids, placement, renewal,
-- ended_placement_id}} or, when someone saved first and nothing was done, {conflict: true, currentVersion, current: {stage}, changed: [{field, value, who, at}]}.
-- Refused, in this order: not a member of the firm (42501), a closing firm or Nevermore support (PT423), what is wrong with the fields (22023, in words), no
-- version (22023), an opportunity the caller may not see or that is not there (PT404), one the level rule does not give them (42501), an archived account
-- (55000), a version it never had (22023); and then, without changing anything: one that is not Quoted, or has no quote of that request that is quoted (22023).
CREATE FUNCTION public.opportunity_mark_won(
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
  RETURN jsonb_build_object('conflict', false, 'record', jsonb_build_object(
    'id', cur.id, 'stage', 'won', 'version', cur.version, 'quote_request_id', q.id, 'closed_quote_request_ids', to_jsonb(closed),
    'placement', public.crm_placement_row(pl),
    'renewal', public.crm_renewal_row(rn, (now() AT TIME ZONE public.workspace_time_zone(p_time_zone))::date),
    'ended_placement_id', ended));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_mark_won(uuid, bigint, date, date, text, uuid, integer, text, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_mark_won(uuid, bigint, date, date, text, uuid, integer, text, numeric, numeric, text) TO authenticated;

-- ---------- 4. Lost: the reason, kept on the opportunity (D-468) ----------
-- The reason (a fixed list; "other" needs a note) and the note (at most 500), kept whether the loss is the submission's (an intake) or the opportunity's own (none).
-- Cleared by a reopen, and kept in the history.
ALTER TABLE public.opportunities
  ADD COLUMN lost_reason text CONSTRAINT opportunities_lost_reason_check CHECK (lost_reason IN ('stayed_with_current_provider', 'price', 'went_direct', 'no_decision', 'other')),
  ADD COLUMN lost_note text CONSTRAINT opportunities_lost_note_check CHECK (char_length(lost_note) BETWEEN 1 AND 500),
  ADD CONSTRAINT opportunities_lost_note_needs_reason CHECK (lost_note IS NULL OR lost_reason IS NOT NULL),
  ADD CONSTRAINT opportunities_other_needs_note CHECK (lost_reason IS DISTINCT FROM 'other' OR lost_note IS NOT NULL);

COMMENT ON COLUMN public.opportunities.lost_reason IS 'Why the search was lost (glossary: Lost reason), kept while it is lost and cleared by a reopen (the history keeps it): stayed_with_current_provider, price, went_direct, no_decision or other.';
COMMENT ON COLUMN public.opportunities.lost_note IS 'What the person said about the loss; required for the reason other, at most 500 characters.';

-- History and version: the history's list of tables gets commission_payments added to whatever it holds when this runs. This comes before
-- anything here that names a table to the history (record_track below): a migration runs as one transaction, and PL/pgSQL keeps a checked
-- name's domain test for the rest of the transaction, so a name added after the first such call would still be refused.
DO $$
DECLARE
  names text[];
BEGIN
  SELECT COALESCE(array_agg(m[1] ORDER BY m[1]), '{}') INTO names
  FROM pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([a-z0-9_]+)''', 'g') AS m
  WHERE c.contypid = 'public.record_history_table'::regtype AND c.conname = 'record_history_table_known';
  IF NOT 'commission_payments' = ANY (names) THEN names := array_append(names, 'commission_payments'); END IF;
  ALTER DOMAIN public.record_history_table DROP CONSTRAINT record_history_table_known;
  EXECUTE format('ALTER DOMAIN public.record_history_table ADD CONSTRAINT record_history_table_known CHECK (VALUE IN (%s))',
    (SELECT string_agg(quote_literal(x), ', ' ORDER BY x) FROM unnest(names) x));
END $$;

-- Tracked fields (history and version) are added to what the table tracks when this runs, read from its version trigger, so a field another story added to
-- the list since 20261120090000 is kept and a restated copy of an older list cannot drop it. Calling record_track again replaces its triggers with themselves.
CREATE FUNCTION pg_temp.track_more(p_table regclass, p_name text, p_more text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  fields text[];
  f text;
BEGIN
  SELECT array_agg(r.m[1] ORDER BY r.ord) INTO fields
  FROM pg_trigger t CROSS JOIN LATERAL regexp_matches(pg_get_triggerdef(t.oid), '''([a-z0-9_]+)''', 'g') WITH ORDINALITY AS r (m, ord)
  WHERE t.tgrelid = p_table AND t.tgname = (SELECT c.relname FROM pg_class c WHERE c.oid = p_table) || '_version';
  IF fields IS NULL THEN
    RAISE EXCEPTION '% has no version trigger to read its tracked fields from', p_table;
  END IF;
  FOREACH f IN ARRAY p_more LOOP
    IF NOT f = ANY (fields) THEN fields := fields || f; END IF;
  END LOOP;
  PERFORM public.record_track(p_table, p_name, ARRAY['id'], fields);
END $$;

SELECT pg_temp.track_more('public.opportunities', 'opportunities', ARRAY['lost_reason', 'lost_note']);
SELECT pg_temp.track_more('public.placements', 'placements', ARRAY['commission_basis', 'commission_rate', 'commission_expected_yearly']);

-- ---------- 5. Marking lost (D-468) ----------
-- Marks the opportunity lost for a reason from the list (stayed_with_current_provider, price, went_direct, no_decision, other; other needs a note), from the
-- version the person started from (D-46). With an intake the submission moves to Lost, which closes every open quote with the reason 'search_ended' (a decline
-- stays a decline); with none the opportunity keeps Lost itself (lost_at, lost_by, D-408). Either way the reason and the note are kept on the opportunity.
-- Answers {conflict: false, record: {id, stage, version, lost_reason, lost_note}} or the conflict shape of opportunity_mark_won. Refused as it is, with, once
-- the version has been looked at: an opportunity already lost, won or archived, or an intake the pipeline does not let go to Lost (a draft) (22023, in words).
CREATE FUNCTION public.opportunity_mark_lost(
  p_opportunity_id uuid, p_reason text, p_note text DEFAULT NULL, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  note text := NULLIF(btrim(p_note), '');
  cur public.opportunities;
  pipeline text;
  changed public.opportunities;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_reason IS NULL OR p_reason NOT IN ('stayed_with_current_provider', 'price', 'went_direct', 'no_decision', 'other') THEN
    RAISE EXCEPTION 'Choose why it was lost: stayed with current provider, price, went direct to a PEO, no decision or other.' USING ERRCODE = '22023';
  END IF;
  IF p_reason = 'other' AND note IS NULL THEN
    RAISE EXCEPTION 'Other needs a note saying why.' USING ERRCODE = '22023';
  END IF;
  IF char_length(note) > 500 THEN
    RAISE EXCEPTION 'Keep the note to 500 characters.' USING ERRCODE = '22023';
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
    IF cur.lost_at IS NOT NULL THEN
      RAISE EXCEPTION 'This opportunity is already lost.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.opportunities SET lost_at = now(), lost_by = auth.uid(), lost_reason = p_reason, lost_note = note WHERE id = cur.id RETURNING * INTO changed;
  ELSE
    -- The submission's pipeline row before its quote requests (set_submission_status's order).
    SELECT w.status INTO pipeline FROM public.submission_workflow w WHERE w.session_id = cur.intake_id FOR UPDATE;
    IF pipeline = 'lost' THEN
      RAISE EXCEPTION 'This opportunity is already lost.' USING ERRCODE = '22023';
    ELSIF pipeline = 'won' THEN
      RAISE EXCEPTION 'This opportunity is won. Reopen it first.' USING ERRCODE = '22023';
    ELSIF pipeline = 'archived' THEN
      -- Archived straight from Won or Lost is still that outcome, reopened; from any other stage it is restored from the archive (as opportunity_reopen says).
      RAISE EXCEPTION '%', CASE WHEN (SELECT x.from_status FROM public.submission_status_history x
                                      WHERE x.session_id = cur.intake_id AND x.to_status = 'archived' AND x.from_status IS DISTINCT FROM 'archived' ORDER BY x.id DESC LIMIT 1)
                                     IN ('won', 'lost') THEN 'This opportunity''s submission is archived. Reopen it first.'
                                ELSE 'This opportunity''s submission is archived. Restore it from the archive.' END USING ERRCODE = '22023';
    ELSIF NOT 'lost' = ANY (public.pipeline_next_statuses(pipeline)) THEN
      RAISE EXCEPTION 'A submission can''t move from % to lost.', replace(pipeline, '_', ' ') USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.quote_requests x WHERE x.session_id = cur.intake_id ORDER BY x.id FOR UPDATE;
    UPDATE public.submission_workflow SET status = 'lost', updated_at = now(), updated_by = auth.uid() WHERE session_id = cur.intake_id;
    UPDATE public.quote_requests SET status = 'closed', close_reason = 'search_ended' WHERE session_id = cur.intake_id AND status IN ('sent', 'quoted');
    INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
    VALUES (cur.intake_id, pipeline, 'lost', 'Lost: ' || replace(p_reason, '_', ' ') || COALESCE(' (' || note || ')', ''), auth.uid(), auth.jwt() ->> 'email');
    UPDATE public.opportunities SET lost_reason = p_reason, lost_note = note WHERE id = cur.id RETURNING * INTO changed;
  END IF;
  RETURN jsonb_build_object('conflict', false, 'record', jsonb_build_object(
    'id', changed.id, 'stage', 'lost', 'version', changed.version, 'lost_reason', changed.lost_reason, 'lost_note', changed.lost_note));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_mark_lost(uuid, text, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_mark_lost(uuid, text, text, uuid, integer) TO authenticated;

-- ---------- 6. Reopening (D-462, D-469, D-471, ADR 0027) ----------
-- Reopens a won or lost opportunity, from the version the person started from (D-46), for its record owner or an owner of the firm. Won goes back to Quoted: the
-- submission moves to it, the quote is no longer chosen (it stays quoted, the quotes the win closed stay closed), the placement and the renewal the win made are
-- deleted, and the placement that this opportunity's own renewal came from, which the win ended (D-456), runs again (unless that renewal was marked "Didn't
-- renew", which is its own day). Lost goes back to the stage it was lost from (the submission's last move into Lost), or, with no intake, loses its mark; the
-- reason and note are cleared from the opportunity (the history keeps them). A submission archived straight from Won or Lost is reopened the same way, by a
-- move out of archived; one archived from any other stage has no outcome to undo and is restored from the archive. Refused, after the questions
-- opportunity_mark_won asks and in these words (22023): an opportunity that is neither won nor lost; and (PT409) while the win's renewal is being worked by
-- an opportunity or its placement has commission payments, so no later work or money record is deleted with it. All or none. Answers {conflict: false,
-- record: {id, stage, version}} or the conflict shape of opportunity_mark_won.
CREATE FUNCTION public.opportunity_reopen(p_opportunity_id uuid, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
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
    ELSE
      SELECT x.from_status INTO target FROM public.submission_status_history x
      WHERE x.session_id = cur.intake_id AND x.to_status = 'lost' ORDER BY x.id DESC LIMIT 1;
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

-- ---------- 7. One way to win, lose and reopen (D-470, D-471) ----------
-- 20261118110000's set_submission_status (the latest definition: nothing since has restated it), with every rule it had (the closing-firm check first, the advisor,
-- the intake in the caller's firm, the statuses an advisor can set, the 2000-character note, the one pipeline row held, no move to the status it is at, certified
-- before any move but archiving, the pipeline's allowed moves, a quote named for Won, the quotes still open closed by Won, Lost and Archived, the history row), and
-- two refusals: Won and Lost for a submission on an opportunity (D-470), and Submitted from an archive made straight from Won or Lost (D-471).
CREATE OR REPLACE FUNCTION public.set_submission_status(p_session_id uuid, p_status text, p_note text DEFAULT NULL::text, p_won_quote_request_id bigint DEFAULT NULL::bigint)
 RETURNS submission_workflow
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_row public.submission_workflow;
  previous text;
  allowed text[];
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');
  IF p_status IS NULL OR p_status NOT IN (
    'submitted', 'under_review', 'information_requested', 'ready_for_market', 'sent_to_carrier', 'quoted', 'won', 'lost', 'archived'
  ) THEN
    RAISE EXCEPTION 'Not a status an advisor can set: %', p_status USING ERRCODE = '22023';
  END IF;
  IF length(clean_note) > 2000 THEN
    RAISE EXCEPTION 'Status notes are limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  -- D-470: a submission on an opportunity is won or lost on its opportunity (opportunity_mark_won, opportunity_mark_lost), which choose the quote, close the
  -- rest with their reason and make the placement, renewal and commission or keep the lost reason in one step. Only a submission with no opportunity is moved
  -- to Won or Lost here.
  IF p_status IN ('won', 'lost') AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.intake_id = p_session_id) THEN
    RAISE EXCEPTION 'Mark it won or lost on its opportunity' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF current_row.status = p_status THEN
    RETURN current_row;
  END IF;
  IF p_status <> 'archived' AND NOT public.intake_ever_certified(p_session_id) THEN
    RAISE EXCEPTION 'The prospect hasn''t certified this intake yet, so it can only be archived' USING ERRCODE = '22023';
  END IF;
  allowed := public.pipeline_next_statuses(current_row.status);
  IF NOT p_status = ANY (allowed) THEN
    RAISE EXCEPTION 'A submission can''t move from % to %. From % it can move to: %',
      replace(current_row.status, '_', ' '), replace(p_status, '_', ' '), replace(current_row.status, '_', ' '),
      replace(array_to_string(allowed, ', '), '_', ' ')
      USING ERRCODE = '22023';
  END IF;
  -- D-471: a submission archived straight from Won or from Lost is a closed search with its outcome, placement or reason: it is restored by reopening it on
  -- its opportunity (opportunity_reopen), not to Submitted. One archived from any other stage has no outcome to undo and is restored as before.
  IF current_row.status = 'archived' AND p_status = 'submitted' AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.intake_id = p_session_id)
     AND (SELECT x.from_status FROM public.submission_status_history x
          WHERE x.session_id = p_session_id AND x.to_status = 'archived' AND x.from_status IS DISTINCT FROM 'archived' ORDER BY x.id DESC LIMIT 1) IN ('won', 'lost') THEN
    RAISE EXCEPTION 'Reopen it on its opportunity' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'won' AND NOT EXISTS (
    SELECT 1 FROM public.quote_requests q
    WHERE q.id = p_won_quote_request_id AND q.session_id = p_session_id AND q.status = 'quoted'
  ) THEN
    RAISE EXCEPTION 'To mark this won, name which of this submission''s quotes the employer took' USING ERRCODE = '22023';
  END IF;
  previous := current_row.status;

  UPDATE public.submission_workflow
  SET status = p_status, updated_at = now(), updated_by = auth.uid(),
      won_quote_request_id = CASE WHEN p_status = 'won' THEN p_won_quote_request_id ELSE won_quote_request_id END
  WHERE session_id = p_session_id
  RETURNING * INTO current_row;

  -- A submission that is won, lost or archived waits on no PEO: close every quote request still open, except the
  -- winner. A decline stays a decline.
  IF p_status IN ('won', 'lost', 'archived') THEN
    UPDATE public.quote_requests
    SET status = 'closed'
    WHERE session_id = p_session_id AND status IN ('sent', 'quoted')
      AND id IS DISTINCT FROM current_row.won_quote_request_id;
  END IF;

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (p_session_id, previous, p_status, clean_note, auth.uid(), auth.jwt() ->> 'email');
  RETURN current_row;
END;
$function$;

-- ---------- 8. Commission received (Q-4.1, D-467, D-407) ----------
-- What the firm received against a placement: the day, an amount above zero and a note. Read by whoever may see the account (so never by a prospect or a PEO:
-- the firm's own record), written by no API role, only by the functions below, with a history and a version (record_track).
CREATE TABLE public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  account_id uuid NOT NULL,
  placement_id uuid NOT NULL,
  received_on date NOT NULL,
  amount numeric(14, 2) NOT NULL CONSTRAINT commission_payments_amount_check CHECK (amount > 0),
  note text CONSTRAINT commission_payments_note_check CHECK (char_length(note) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_payments_account_fkey FOREIGN KEY (firm_id, account_id) REFERENCES public.accounts (firm_id, id) ON DELETE CASCADE,
  -- The placement is one of the payment's own account. No cascade: a placement with money recorded against it is not deleted from under it (a reopen is
  -- refused while it has payments; closing a firm deletes the payments first).
  CONSTRAINT commission_payments_placement_fkey FOREIGN KEY (account_id, placement_id) REFERENCES public.placements (account_id, id)
);

CREATE INDEX commission_payments_placement_idx ON public.commission_payments (placement_id, received_on);
CREATE INDEX commission_payments_firm_account_idx ON public.commission_payments (firm_id, account_id);

COMMENT ON TABLE public.commission_payments IS 'Commission the firm received for a placement (glossary: Commission payment). Seen only by the firm: read by whoever may see the account; written only through functions.';

CREATE TRIGGER commission_payments_updated_at BEFORE UPDATE ON public.commission_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commission_payments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.commission_payments TO authenticated, service_role;

CREATE POLICY commission_payments_visible ON public.commission_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = commission_payments.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id)));

-- (Its name was added to the history's list of tables near the top of this file.)
SELECT public.record_track('public.commission_payments', 'commission_payments', ARRAY['id'], ARRAY['received_on', 'amount', 'note']);

-- The history's two questions and the closing plan are taught the new table by adding a line to each as it stands when this runs (read with
-- pg_get_functiondef), not by restating it: every branch and every line any earlier migration, or a story building beside this one, gave them stays. Running
-- this twice adds nothing, and a function that no longer has the line to put it next to stops the migration, so a payment can never be left out of them.
DO $$
DECLARE
  def text;
BEGIN
  def := pg_get_functiondef('public.record_history_can_see(uuid, public.record_history_table, text)'::regprocedure);
  IF position('commission_payments' IN def) = 0 THEN
    IF (length(def) - length(replace(def, E'  END IF;\n  RETURN false;', ''))) <> length(E'  END IF;\n  RETURN false;') THEN
      RAISE EXCEPTION 'record_history_can_see() does not end as expected, so the payments cannot be added to it';
    END IF;
    EXECUTE replace(def, E'  END IF;\n  RETURN false;', E'  ELSIF p_table = ''commission_payments'' THEN\n    RETURN EXISTS (\n      SELECT 1 FROM public.commission_payments p JOIN public.accounts a ON a.id = p.account_id\n      WHERE p.firm_id = p_firm_id AND p.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));\n  END IF;\n  RETURN false;');
  END IF;
  def := pg_get_functiondef('public.record_history_record_exists(uuid, public.record_history_table, text)'::regprocedure);
  IF position('commission_payments' IN def) = 0 THEN
    IF (length(def) - length(replace(def, E'  END IF;\n  RETURN true;', ''))) <> length(E'  END IF;\n  RETURN true;') THEN
      RAISE EXCEPTION 'record_history_record_exists() does not end as expected, so the payments cannot be added to it';
    END IF;
    EXECUTE replace(def, E'  END IF;\n  RETURN true;', E'  ELSIF p_table = ''commission_payments'' THEN\n    RETURN EXISTS (SELECT 1 FROM public.commission_payments p WHERE p.firm_id = p_firm_id AND p.id = public.record_history_key_uuid(p_key));\n  END IF;\n  RETURN true;');
  END IF;
  def := pg_get_functiondef('public.firm_closing_plan()'::regprocedure);
  IF position('public.commission_payments' IN def) = 0 THEN
    IF position('    (56, ''public.renewals'',' IN def) = 0 THEN
      RAISE EXCEPTION 'firm_closing_plan() has no line for the renewals to put the commission payments before';
    END IF;
    EXECUTE replace(def, '    (56, ''public.renewals'',', E'    (54, ''public.commission_payments'', ''delete'', ''firm_id'', ''commission payments (what the firm received for its placements); before the placements and accounts they stand on''),\n    (56, ''public.renewals'',');
  END IF;
END $$;

-- ---------- 9. Recording, editing and deleting a payment ----------
-- The first thing wrong with a payment's fields, in words, or NULL. Internal.
CREATE FUNCTION public.commission_payment_input_error(p_received_on date, p_amount numeric, p_note text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_received_on IS NULL THEN 'Give the date it was received.'
    WHEN p_amount IS NULL THEN 'Give the amount received.'
    WHEN p_amount <= 0 THEN 'The amount must be more than zero.'
    WHEN p_amount <> round(p_amount, 2) THEN 'Keep the amount to cents.'
    WHEN p_amount > 999999999999.99 THEN 'That amount is too large.'
    WHEN char_length(p_note) > 500 THEN 'Keep the note to 500 characters.'
  END
$$;

REVOKE ALL ON FUNCTION public.commission_payment_input_error(date, numeric, text) FROM PUBLIC, anon, authenticated, service_role;

-- The firm's placement, held for a change to its money, after the questions every write asks (D-467: whoever may change the opportunity it was won on). A
-- placement the firm made by hand has no opportunity and so no commission to record: once the caller may see and change its account, and it is not archived, it
-- is refused (PT409, in words). Returns it. Internal: the callers have asked the firm and the guard.
-- Lock order: the account, then the opportunity (opportunity_to_change), then the placement.
CREATE FUNCTION public.placement_to_change(p_firm_id uuid, p_placement_id uuid)
RETURNS public.placements
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  cur public.placements;
  a public.accounts;
  opp uuid;
  acct uuid;
BEGIN
  SELECT x.opportunity_id, x.account_id INTO opp, acct FROM public.placements x WHERE x.id = p_placement_id AND x.firm_id = p_firm_id;
  IF acct IS NULL THEN
    RAISE EXCEPTION 'That placement isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF opp IS NOT NULL THEN
    PERFORM public.opportunity_to_change(p_firm_id, opp, 'change');
  ELSE
    SELECT * INTO a FROM public.accounts y WHERE y.id = acct FOR NO KEY UPDATE;
    IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
      RAISE EXCEPTION 'That placement isn''t available' USING ERRCODE = 'PT404';
    END IF;
    IF NOT public.can_change_firm_record(a.firm_id, a.owner_id) THEN
      RAISE EXCEPTION '%', CASE WHEN a.owner_id IS NULL
        THEN 'An account with no owner can only be changed by an owner of the firm.'
        ELSE 'Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.' END USING ERRCODE = '42501';
    END IF;
    IF a.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'This account is archived. Nothing on it can be changed.' USING ERRCODE = '55000';
    END IF;
    RAISE EXCEPTION 'Commission is recorded on a placement won from an opportunity' USING ERRCODE = 'PT409';
  END IF;
  SELECT * INTO cur FROM public.placements x WHERE x.id = p_placement_id AND x.firm_id = p_firm_id FOR NO KEY UPDATE;
  IF cur.id IS NULL THEN
    RAISE EXCEPTION 'That placement isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN cur;
END;
$$;

REVOKE ALL ON FUNCTION public.placement_to_change(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- A payment as the screens read it. Internal.
CREATE FUNCTION public.crm_commission_payment_row(p public.commission_payments)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('id', p.id, 'placement_id', p.placement_id, 'received_on', p.received_on, 'amount', p.amount, 'note', p.note, 'version', p.version)
$$;

REVOKE ALL ON FUNCTION public.crm_commission_payment_row(public.commission_payments) FROM PUBLIC, anon, authenticated, service_role;

-- Records a payment against a placement won from an opportunity (a placement made by hand is refused, PT409): the day it was received, an amount above zero (to the cent), a note (at most 500). Answers {payment, received_to_date,
-- expected_yearly}. Refused, in this order: not a member of the firm (42501), a closing firm or Nevermore support (PT423), what is wrong with the fields
-- (22023, in words), a placement the caller may not see or that is not there (PT404), one the level rule does not give them (42501), an archived account (55000), a
-- placement with no opportunity (PT409).
CREATE FUNCTION public.record_commission_payment(
  p_placement_id uuid, p_received_on date, p_amount numeric, p_note text DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  note_in text := NULLIF(btrim(p_note), '');
  problem text;
  pl public.placements;
  made public.commission_payments;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  problem := public.commission_payment_input_error(p_received_on, p_amount, note_in);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  pl := public.placement_to_change(firm, p_placement_id);
  INSERT INTO public.commission_payments (firm_id, account_id, placement_id, received_on, amount, note)
  VALUES (pl.firm_id, pl.account_id, pl.id, p_received_on, p_amount, note_in) RETURNING * INTO made;
  RETURN jsonb_build_object('payment', public.crm_commission_payment_row(made),
    'received_to_date', (SELECT COALESCE(sum(x.amount), 0) FROM public.commission_payments x WHERE x.placement_id = pl.id),
    'expected_yearly', pl.commission_expected_yearly);
END;
$$;

REVOKE ALL ON FUNCTION public.record_commission_payment(uuid, date, numeric, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_commission_payment(uuid, date, numeric, text, uuid) TO authenticated;

-- Saves a payment's day, amount and note (all sent) from the version the person started from (D-46). Answers {conflict: false, record, received_to_date,
-- expected_yearly} or, when someone saved first and nothing was saved, {conflict: true, currentVersion, current: {received_on, amount, note}, changed}.
-- Refused as record_commission_payment is, before the version is looked at: no version (22023), a payment the caller may not see or that is not there (PT404),
-- one the level rule does not give them (42501), a version it never had (22023).
CREATE FUNCTION public.update_commission_payment(
  p_payment_id uuid, p_received_on date, p_amount numeric, p_note text DEFAULT NULL, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  note_in text := NULLIF(btrim(p_note), '');
  problem text;
  pid uuid;
  pl public.placements;
  cur public.commission_payments;
  changed public.commission_payments;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  problem := public.commission_payment_input_error(p_received_on, p_amount, note_in);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the payment it started from, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  SELECT x.placement_id INTO pid FROM public.commission_payments x WHERE x.id = p_payment_id AND x.firm_id = firm;
  IF pid IS NULL THEN
    RAISE EXCEPTION 'That payment isn''t available' USING ERRCODE = 'PT404';
  END IF;
  pl := public.placement_to_change(firm, pid);
  SELECT * INTO cur FROM public.commission_payments x WHERE x.id = p_payment_id AND x.firm_id = firm FOR NO KEY UPDATE;
  IF cur.id IS NULL THEN
    RAISE EXCEPTION 'That payment isn''t available' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.commission_payments SET received_on = p_received_on, amount = p_amount, note = note_in WHERE id = cur.id AND version = p_version RETURNING * INTO changed;
  IF changed.id IS NOT NULL THEN
    RETURN jsonb_build_object('conflict', false, 'record', public.crm_commission_payment_row(changed),
      'received_to_date', (SELECT COALESCE(sum(x.amount), 0) FROM public.commission_payments x WHERE x.placement_id = pl.id),
      'expected_yearly', pl.commission_expected_yearly);
  END IF;
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the payment that does not exist, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('conflict', true, 'currentVersion', cur.version,
    'current', jsonb_build_object('received_on', cur.received_on, 'amount', cur.amount, 'note', cur.note),
    'changed', public.record_version_changes(cur.firm_id, 'commission_payments', cur.id::text, p_version, cur.version));
END;
$$;

REVOKE ALL ON FUNCTION public.update_commission_payment(uuid, date, numeric, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_commission_payment(uuid, date, numeric, text, uuid, integer) TO authenticated;

-- Deletes a payment from the version the person started from (D-46). Answers {deleted: true, amount, received_to_date} or update_commission_payment's conflict.
-- Refused as it is (no fields).
CREATE FUNCTION public.delete_commission_payment(p_payment_id uuid, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  pid uuid;
  pl public.placements;
  cur public.commission_payments;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the payment it started from, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  SELECT x.placement_id INTO pid FROM public.commission_payments x WHERE x.id = p_payment_id AND x.firm_id = firm;
  IF pid IS NULL THEN
    RAISE EXCEPTION 'That payment isn''t available' USING ERRCODE = 'PT404';
  END IF;
  pl := public.placement_to_change(firm, pid);
  SELECT * INTO cur FROM public.commission_payments x WHERE x.id = p_payment_id AND x.firm_id = firm FOR NO KEY UPDATE;
  IF cur.id IS NULL THEN
    RAISE EXCEPTION 'That payment isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the payment that does not exist, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  IF p_version < cur.version THEN
    RETURN jsonb_build_object('conflict', true, 'currentVersion', cur.version,
      'current', jsonb_build_object('received_on', cur.received_on, 'amount', cur.amount, 'note', cur.note),
      'changed', public.record_version_changes(cur.firm_id, 'commission_payments', cur.id::text, p_version, cur.version));
  END IF;
  DELETE FROM public.commission_payments WHERE id = cur.id;
  RETURN jsonb_build_object('deleted', true, 'amount', cur.amount,
    'received_to_date', (SELECT COALESCE(sum(x.amount), 0) FROM public.commission_payments x WHERE x.placement_id = pl.id));
END;
$$;

REVOKE ALL ON FUNCTION public.delete_commission_payment(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_commission_payment(uuid, uuid, integer) TO authenticated;

-- ---------- 10. Review fixes ----------
-- Undoing "Didn't renew" after the renewal's opportunity was won (renewal_set_not_renewed, restated from 20261120110000_placements_renewals.sql, its only
-- definition, with every rule it had and one more): refused (PT409, in words) while the opportunity working the renewal is won, so the undo can't clear the
-- end day of the placement the win replaced and leave two placements running. Marking, and the win, are unchanged. Same grants as before (internal).
CREATE OR REPLACE FUNCTION public.renewal_set_not_renewed(p_firm_id uuid, p_renewal_id uuid, p_mark boolean, p_on date, p_version integer, p_time_zone text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  cur public.renewals;
  changed public.renewals;
  started date;
BEGIN
  IF p_mark AND p_on IS NULL THEN
    RAISE EXCEPTION 'Give the day it didn''t renew.' USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the renewal it started from, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  cur := public.renewal_to_change(p_firm_id, p_renewal_id);
  IF p_mark AND cur.opportunity_id IS NOT NULL AND public.opportunity_stage(cur.opportunity_id) = 'won' THEN
    RAISE EXCEPTION 'This renewal was renewed, so it can''t be marked as not renewed.' USING ERRCODE = 'PT409';
  END IF;
  -- The undo of a win-renewed renewal would clear the end day of a placement the win's new placement replaced and leave two running (CRM-O1.3a review): refused
  -- while the opportunity working the renewal is won. The win itself is not refused: didn't renew, then won elsewhere, is a normal case.
  IF NOT p_mark AND cur.opportunity_id IS NOT NULL AND public.opportunity_stage(cur.opportunity_id) = 'won' THEN
    RAISE EXCEPTION 'This renewal was renewed by %. Reopen that win first.',
      COALESCE((SELECT o.name FROM public.opportunities o WHERE o.id = cur.opportunity_id), 'an opportunity') USING ERRCODE = 'PT409';
  END IF;
  IF cur.placement_id IS NOT NULL THEN
    SELECT p.start_date INTO started FROM public.placements p WHERE p.id = cur.placement_id FOR NO KEY UPDATE;
    IF p_mark AND started IS NOT NULL AND p_on < started THEN
      RAISE EXCEPTION 'The placement started on %, so it can''t end before.', to_char(started, 'YYYY-MM-DD') USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.renewals SET not_renewed_on = CASE WHEN p_mark THEN p_on END WHERE id = cur.id AND version = p_version RETURNING * INTO changed;
  IF changed.id IS NOT NULL THEN
    UPDATE public.placements SET ended_on = CASE WHEN p_mark THEN p_on END WHERE id = changed.placement_id;
    RETURN jsonb_build_object('conflict', false, 'record', public.crm_renewal_row(changed, (now() AT TIME ZONE public.workspace_time_zone(p_time_zone))::date));
  END IF;
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the renewal that does not exist, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'conflict', true,
    'currentVersion', cur.version,
    'current', jsonb_build_object('not_renewed_on', cur.not_renewed_on),
    'changed', public.record_version_changes(cur.firm_id, 'renewals', cur.id::text, p_version, cur.version));
END;
$$;

-- Adds, changes or clears the commission a placement expects, later than the win (D-466): the basis, its number and the yearly figure expected, from the version the
-- person started from (D-46); all three sent as they should stand, so sending none clears them. Whoever may change the opportunity the placement was won on may (D-467).
-- Answers {conflict: false, record: <the placement as crm_placement_row reads it>} or, when someone saved first and nothing was saved, {conflict: true,
-- currentVersion, current: {commission_basis, commission_rate, commission_expected_yearly}, changed}. Refused, in this order, as the payment functions are: not a
-- member of the firm (42501), a closing firm or Nevermore support (PT423), what is wrong with the values (22023, in words, as the win words them), no version (22023),
-- a placement the caller may not see or that is not there (PT404), one the level rule does not give them (42501), an archived account (55000), one with no
-- opportunity (PT409), a version it never had (22023). The same lock order: the account, then the opportunity, then the placement.
CREATE FUNCTION public.set_placement_commission(
  p_placement_id uuid, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL, p_basis text DEFAULT NULL, p_rate numeric DEFAULT NULL, p_expected_yearly numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  problem text;
  cur public.placements;
  changed public.placements;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  problem := public.commission_input_error(p_basis, p_rate, p_expected_yearly);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the placement it started from, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  cur := public.placement_to_change(firm, p_placement_id);
  UPDATE public.placements SET commission_basis = p_basis, commission_rate = p_rate, commission_expected_yearly = p_expected_yearly
  WHERE id = cur.id AND version = p_version RETURNING * INTO changed;
  IF changed.id IS NOT NULL THEN
    RETURN jsonb_build_object('conflict', false, 'record', public.crm_placement_row(changed));
  END IF;
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the placement that does not exist, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('conflict', true, 'currentVersion', cur.version,
    'current', jsonb_build_object('commission_basis', cur.commission_basis, 'commission_rate', cur.commission_rate, 'commission_expected_yearly', cur.commission_expected_yearly),
    'changed', public.record_version_changes(cur.firm_id, 'placements', cur.id::text, p_version, cur.version));
END;
$$;

REVOKE ALL ON FUNCTION public.set_placement_commission(uuid, uuid, integer, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_placement_commission(uuid, uuid, integer, text, numeric, numeric) TO authenticated;
