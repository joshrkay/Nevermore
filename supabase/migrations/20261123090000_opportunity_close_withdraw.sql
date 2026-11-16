-- Closing an opportunity (slice 5.0x/5.0y; docs/BROKER_CRM_BUILD.md D-1720 to D-1729).

SET lock_timeout = '5s';

-- ---------- opportunity_mark_won, restated from 20261121170000_opportunity_outcome.sql (its newest) with every line kept and one step more ----------
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
  -- D-1721: every quote request of the search but the winner's stops being openable, as set_submission_status does for Archived (D-1624): the PEOs this win
  -- closed, and any already closed, lose their live link.
  PERFORM public.bundle_link_revoke(x.id, 'submission_closed') FROM public.quote_requests x WHERE x.session_id = cur.intake_id AND x.id <> q.id;
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

-- ---------- opportunity_mark_lost, restated from 20261120121000_won_lost_commission.sql (its newest) with every line kept and one step more ----------
CREATE OR REPLACE FUNCTION public.opportunity_mark_lost(
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
    -- D-1721: a lost search has no winner, so every quote request of it loses its live link (as set_submission_status does, D-1624).
    PERFORM public.bundle_link_revoke(x.id, 'submission_closed') FROM public.quote_requests x WHERE x.session_id = cur.intake_id;
  END IF;
  RETURN jsonb_build_object('conflict', false, 'record', jsonb_build_object(
    'id', changed.id, 'stage', 'lost', 'version', changed.version, 'lost_reason', changed.lost_reason, 'lost_note', changed.lost_note));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_mark_lost(uuid, text, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_mark_lost(uuid, text, text, uuid, integer) TO authenticated;

-- ---------- The two halves of a withdrawal (D-1720, D-1722, D-1723), internal ----------
-- Before the move: the refusals of 6.9 (D-1626) after the firm and the guard the wrappers ask first (the mailbox, 6.2's limits for the subject and note) and the PEOs to tell,
-- read before the move closes them: the quote requests of the opportunity's intake still open (sent or quoted), but the winner's, that the product wrote to,
-- each with the people its newest message from the product went to. Answers {sender, targets: [{id, to}]}. The callers are the two wrappers below.
CREATE FUNCTION public.opportunity_withdrawal_start(p_firm_id uuid, p_opportunity_id uuid, p_winner bigint, p_subject text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sender_address text;
  problem text;
  targets jsonb;
BEGIN
  -- From the advisor's own connected mailbox (ADR 0005). With none, nothing moves: the advisor chose to tell the PEOs (D-634).
  SELECT b.address INTO sender_address FROM public.broker_mailboxes b WHERE b.user_id = auth.uid();
  IF sender_address IS NULL THEN
    RAISE EXCEPTION 'Connect your mailbox to send from here.' USING ERRCODE = 'PT412';
  END IF;
  -- The subject and the one note by 6.2's limits (D-636), for every PEO it goes to.
  problem := public.conversation_message_input_error(p_subject, p_body, '{}');
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', q.id, 'to', (
           SELECT to_jsonb(m.to_addresses) FROM public.quote_request_messages m WHERE m.quote_request_id = q.id AND m.direction = 'sent'
           ORDER BY m.recorded_at DESC, m.id DESC LIMIT 1)) ORDER BY q.id), '[]'::jsonb)
  INTO targets
  FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id
  WHERE o.id = p_opportunity_id AND q.status IN ('sent', 'quoted') AND q.id IS DISTINCT FROM p_winner
    AND EXISTS (SELECT 1 FROM public.quote_request_messages m WHERE m.quote_request_id = q.id AND m.direction = 'sent');
  RETURN jsonb_build_object('sender', sender_address, 'targets', targets);
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_withdrawal_start(uuid, uuid, bigint, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- After the move: the note recorded on each PEO's own thread, as 6.9's withdrawal records it (no link). Answers the new messages' ids.
CREATE FUNCTION public.opportunity_withdrawal_send(p_start jsonb, p_subject text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target jsonb;
  made public.quote_request_messages;
  ids jsonb := '[]'::jsonb;
BEGIN
  FOR target IN SELECT * FROM jsonb_array_elements(p_start -> 'targets') LOOP
    made := public.record_peo_thread_message((target ->> 'id')::bigint, p_start ->> 'sender', ARRAY(SELECT jsonb_array_elements_text(target -> 'to')),
                                             p_subject, p_body, true);
    ids := ids || to_jsonb(made.id);
  END LOOP;
  RETURN ids;
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_withdrawal_send(jsonb, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- Won with one withdrawal to every PEO still open (D-1720) ----------
-- opportunity_mark_won and, in the same transaction, the one note on each still-open PEO's own thread. Takes what opportunity_mark_won takes, then the subject and note.
CREATE FUNCTION public.opportunity_mark_won_and_withdraw(
  p_opportunity_id uuid, p_quote_request_id bigint, p_start_date date, p_renewal_date date, p_broker_of_record text,
  p_firm_id uuid, p_version integer, p_commission_basis text, p_commission_rate numeric,
  p_commission_expected_yearly numeric, p_time_zone text, p_subject text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  started jsonb;
  result jsonb;
BEGIN
  -- Who may act for the firm (42501), then the guard that refuses a closing firm and Nevermore support (PT423; ADR 0023, ADR 0024), before anything else is asked.
  PERFORM public.assert_firm_writable(public.firm_to_act_for(p_firm_id));
  started := public.opportunity_withdrawal_start(p_firm_id, p_opportunity_id, p_quote_request_id, p_subject, p_body);
  result := public.opportunity_mark_won(p_opportunity_id, p_quote_request_id, p_start_date, p_renewal_date, p_broker_of_record, p_firm_id, p_version,
                                        p_commission_basis, p_commission_rate, p_commission_expected_yearly, p_time_zone);
  -- A conflict (D-46) moved nothing, so nobody is told.
  IF (result ->> 'conflict')::boolean THEN
    RETURN result;
  END IF;
  RETURN result || jsonb_build_object('message_ids', public.opportunity_withdrawal_send(started, p_subject, p_body));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_mark_won_and_withdraw(uuid, bigint, date, date, text, uuid, integer, text, numeric, numeric, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.opportunity_mark_won_and_withdraw(uuid, bigint, date, date, text, uuid, integer, text, numeric, numeric, text, text, text) TO authenticated;

-- ---------- Lost with one withdrawal to every PEO still open (D-1720) ----------
-- opportunity_mark_lost and the one note on each still-open PEO's own thread (a lost search has no winner, so every one). Takes what opportunity_mark_lost takes, then the subject and note.
CREATE FUNCTION public.opportunity_mark_lost_and_withdraw(
  p_opportunity_id uuid, p_reason text, p_note text, p_firm_id uuid, p_version integer, p_subject text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  started jsonb;
  result jsonb;
BEGIN
  -- Who may act for the firm (42501), then the guard that refuses a closing firm and Nevermore support (PT423; ADR 0023, ADR 0024), before anything else is asked.
  PERFORM public.assert_firm_writable(public.firm_to_act_for(p_firm_id));
  started := public.opportunity_withdrawal_start(p_firm_id, p_opportunity_id, NULL, p_subject, p_body);
  result := public.opportunity_mark_lost(p_opportunity_id, p_reason, p_note, p_firm_id, p_version);
  IF (result ->> 'conflict')::boolean THEN
    RETURN result;
  END IF;
  RETURN result || jsonb_build_object('message_ids', public.opportunity_withdrawal_send(started, p_subject, p_body));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_mark_lost_and_withdraw(uuid, text, text, uuid, integer, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.opportunity_mark_lost_and_withdraw(uuid, text, text, uuid, integer, text, text) TO authenticated;
