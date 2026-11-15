-- What an opportunity's stage is (story CRM-O1.2; docs/BROKER_CRM_BUILD.md D-10, D-408 to D-417; ADR 0026).
--
-- What this is. An opportunity's stage is still worked out and never stored (D-206), with one exception: an opportunity with no intake that an agent
-- marked lost keeps that on itself (lost_at, lost_by), since there is no submission to say so (D-408). With an intake the stage is the submission's, as
-- before; so there is one truth for each opportunity, never two. The reason an opportunity was lost comes with CRM-O1.3.
--
--   1. opportunities.lost_at and lost_by; opportunity_stage() reads them (no intake: Lost when marked, else Qualifying). Both are tracked fields of the
--      opportunity (history and version, record_track). A lost opportunity is refused an intake with D-410's words, and one that has an intake cannot be
--      marked lost on itself.
--   2. submission_status_history gains `cause` (null for a person's move; quote_send or quote_recorded) and cause_quote_request_id, additively (ADR 0007).
--   3. ADR 0026: recording a send while the submission is Ready for market moves it to Sent to PEOs, and recording a quote while it is Sent to PEOs moves
--      it to Quoted, in the same transaction as the record, by the person who recorded it, with its cause. Only those two moves, only forward, only from
--      that exact stage. advisor_record_quote_send and advisor_update_quote_request are restated from 20261118110000 with every rule they had.
--   4. record_history_list for an opportunity also reads the stage changes of its submission's status history (D-413): read, never copied into
--      record_history. It gains two columns, cause and cause_peo, empty for every other entry. Restated from 20261118160000 with every rule it had.
--
-- Not changed here: opportunity_stage() stays closed to the API roles (D-416); archived is D-216's (D-417); the closing plan, the grants and row
-- security of the three tables are as they were (only a column is added to one).

-- ---------- 1. Lost with no intake ----------
ALTER TABLE public.opportunities
  ADD COLUMN lost_at timestamptz,
  ADD COLUMN lost_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD CONSTRAINT opportunities_lost_by_check CHECK (lost_by IS NULL OR lost_at IS NOT NULL);

COMMENT ON COLUMN public.opportunities.lost_at IS 'When an agent marked this opportunity lost while it had no intake (D-408); null otherwise. With an intake the stage is the submission''s, so this is never set then. The reason comes with CRM-O1.3.';
COMMENT ON COLUMN public.opportunities.lost_by IS 'Who marked it lost (null when that person''s account is gone).';
COMMENT ON TABLE public.opportunities IS 'One search for one account and one start date (glossary: Opportunity). Its stage is worked out by opportunity_stage(), never stored; the one thing it keeps is that it was marked lost with no intake (lost_at, lost_by).';

-- One truth for each opportunity (D-408): a lost mark and an intake never sit together. Giving a lost opportunity an intake is D-410's refusal; marking
-- one that has an intake lost on itself is refused too, since that is the submission's to say (CRM-O1.3).
CREATE FUNCTION public.opportunity_lost_or_intake()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.lost_at IS NOT NULL AND NEW.intake_id IS NOT NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.intake_id IS NOT NULL AND OLD.intake_id IS NOT DISTINCT FROM NEW.intake_id THEN
      RAISE EXCEPTION 'This opportunity has an intake, so it is lost through its submission.' USING ERRCODE = '22023';
    END IF;
    RAISE EXCEPTION 'This opportunity was marked lost. Reopen it before starting a quote.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_lost_or_intake() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER opportunities_lost_or_intake BEFORE INSERT OR UPDATE OF intake_id, lost_at ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.opportunity_lost_or_intake();

-- Lost and reopened with no intake are the opportunity's own tracked fields (20261119100000's list, with the two).
SELECT public.record_track('public.opportunities', 'opportunities', ARRAY['id'], ARRAY[
  'account_id', 'owner_id', 'name', 'target_start', 'employees', 'main_contact_id', 'expected_close', 'value', 'source', 'next_step',
  'lost_at', 'lost_by']);

-- 20261119100000's opportunity_stage(), with D-408: no intake is Qualifying, or Lost when an agent marked it so. Answers for any opportunity; no API role
-- runs it (D-416): a query that has decided the caller may see the record calls it.
CREATE OR REPLACE FUNCTION public.opportunity_stage(p_opportunity_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN o.intake_id IS NOT NULL THEN public.submission_opportunity_stage(o.intake_id)
    WHEN o.lost_at IS NOT NULL THEN 'lost'
    ELSE 'qualifying'
  END
  FROM public.opportunities o
  WHERE o.id = p_opportunity_id
$$;

REVOKE ALL ON FUNCTION public.opportunity_stage(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The cause of a move (D-412) ----------
-- Null for a person's own move; quote_send or quote_recorded for the move a send or a quote made, with the quote request that caused it. No foreign key
-- on the quote request, for the reason the session has none: the history outlives the rows it names. The table stays append-only, and no API role
-- writes it (20261022090000); the new columns are read with the rest of the row, by the policy that already decides who reads it.
ALTER TABLE public.submission_status_history
  ADD COLUMN cause text CONSTRAINT submission_status_history_cause_check CHECK (cause IN ('quote_send', 'quote_recorded')),
  ADD COLUMN cause_quote_request_id bigint,
  ADD CONSTRAINT submission_status_history_cause_request_check CHECK (cause_quote_request_id IS NULL OR cause IS NOT NULL);

COMMENT ON COLUMN public.submission_status_history.cause IS 'Why the submission moved when no person chose the move: quote_send (a send recorded at Ready for market) or quote_recorded (a quote recorded at Sent to PEOs), ADR 0026. Null for a person''s own move.';
COMMENT ON COLUMN public.submission_status_history.cause_quote_request_id IS 'The quote request whose send or quote caused the move. No foreign key: this history outlives the intake''s rows.';

-- Whether the person who made a move acted as Nevermore staff (D-33), decided when the row is written and never again, as record_history and
-- firm_activity already keep it: reading it later from today's roles and memberships would change an old entry's author when someone becomes an
-- admin or leaves the firm. Set by a trigger on every insert, whichever function writes the row. Rows written before this migration are stamped once
-- here from the roles and memberships of today, the best record there is; the append-only trigger is held off for that one statement only.
ALTER TABLE public.submission_status_history ADD COLUMN actor_is_staff boolean;
ALTER TABLE public.submission_status_history DISABLE TRIGGER submission_status_history_append_only;
UPDATE public.submission_status_history h
SET actor_is_staff = public.firm_actor_is_staff(h.changed_by, (SELECT s.firm_id FROM public.chamber_sessions s WHERE s.id = h.session_id));
ALTER TABLE public.submission_status_history ENABLE TRIGGER submission_status_history_append_only;
ALTER TABLE public.submission_status_history ALTER COLUMN actor_is_staff SET DEFAULT false,
  ALTER COLUMN actor_is_staff SET NOT NULL;

CREATE FUNCTION public.submission_status_history_stamp_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.actor_is_staff := COALESCE(public.firm_actor_is_staff(NEW.changed_by, (SELECT s.firm_id FROM public.chamber_sessions s WHERE s.id = NEW.session_id)), false);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.submission_status_history_stamp_staff() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER submission_status_history_stamp_staff BEFORE INSERT ON public.submission_status_history
  FOR EACH ROW EXECUTE FUNCTION public.submission_status_history_stamp_staff();

-- ---------- 3. A send and a quote move the pipeline stage (D-411, ADR 0026) ----------
-- The one move, for the two writers below: the submission at exactly p_from goes to p_to, by the person acting, with its cause and quote request, in
-- the caller's transaction. Does nothing at any other stage (never backward, never past). Internal: no API role runs it, and it checks nothing the
-- writers have not already checked (the firm, the advisor, the closing and support-session refusals).
CREATE FUNCTION public.submission_move_for_cause(p_session_id uuid, p_from text, p_to text, p_cause text, p_quote_request_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.submission_workflow
  SET status = p_to, updated_at = now(), updated_by = auth.uid()
  WHERE session_id = p_session_id AND status = p_from;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO public.submission_status_history (session_id, from_status, to_status, changed_by, changed_by_email, cause, cause_quote_request_id)
  VALUES (p_session_id, p_from, p_to, auth.uid(), auth.jwt() ->> 'email', p_cause, p_quote_request_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submission_move_for_cause(uuid, text, text, text, bigint) FROM PUBLIC, anon, authenticated, service_role;

-- 20261118110000's advisor_record_quote_send, with every rule it had (the closing-firm check first, the advisor, the intake in the caller's firm, the PEO
-- name, the stages a send is recorded at, one quote request for each PEO, the reply address), and now the move to Sent to PEOs.
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

-- 20261118110000's advisor_update_quote_request, with every rule it had, and now the move to Quoted when the answer is a quote recorded while the
-- submission is Sent to PEOs. The submission's pipeline row is locked first, before the quote request, so the stage it is moved from is the stage it was at when the quote was recorded and the lock order matches set_submission_status's.
CREATE OR REPLACE FUNCTION public.advisor_update_quote_request(p_quote_request_id bigint, p_status text, p_received_on date DEFAULT NULL::date, p_expires_on date DEFAULT NULL::date, p_start_on date DEFAULT NULL::date, p_admin_fee_pepm numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.quote_requests;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  IF p_status IS NULL OR p_status NOT IN ('quoted', 'declined', 'closed') THEN
    RAISE EXCEPTION 'A PEO''s answer is quoted, declined or closed, not %. Record a send to send it again', COALESCE(p_status, 'nothing')
      USING ERRCODE = '22023';
  END IF;
  -- Lock order: the submission's pipeline row first, then the quote request, as set_submission_status and advisor_record_quote_send do, so recording a
  -- quote while someone marks the submission won, lost or archived waits instead of deadlocking (each would hold one row and wait for the other).
  -- A quote request never changes submission, so the row looked up here is the one locked.
  PERFORM 1 FROM public.submission_workflow w
  WHERE w.session_id = (SELECT q.session_id FROM public.quote_requests q WHERE q.id = p_quote_request_id AND public.quote_request_in_my_firm(q.id))
  FOR UPDATE;
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id AND public.quote_request_in_my_firm(id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  IF char_length(btrim(COALESCE(p_note, ''))) > 2000 THEN
    RAISE EXCEPTION 'A note is limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_admin_fee_pepm < 0 OR p_admin_fee_pepm > 100000 THEN
    RAISE EXCEPTION 'The admin fee is per employee per month, from 0 to 100000' USING ERRCODE = '22023';
  END IF;
  IF req.status = 'closed' AND p_status <> 'closed' THEN
    RAISE EXCEPTION 'This quote request is closed. Record a send to % to reopen it', req.peo_name USING ERRCODE = '22023';
  END IF;
  IF p_status <> 'quoted' AND (p_received_on, p_expires_on, p_start_on, p_admin_fee_pepm) IS DISTINCT FROM (NULL::date, NULL::date, NULL::date, NULL::numeric) THEN
    RAISE EXCEPTION 'Only a quote has dates and a fee. Mark it quoted, or leave them empty' USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_requests
  SET status = p_status,
      quote_received_on = p_received_on,
      quote_expires_on = p_expires_on,
      proposed_start_on = p_start_on,
      admin_fee_pepm = p_admin_fee_pepm,
      note = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_quote_request_id
  RETURNING * INTO req;
  -- ADR 0026: a quote recorded while the submission is Sent to PEOs moves it to Quoted, in this transaction, and at no other stage.
  IF p_status = 'quoted' THEN
    PERFORM public.submission_move_for_cause(req.session_id, 'sent_to_carrier', 'quoted', 'quote_recorded', req.id);
  END IF;
  RETURN to_jsonb(req);
END;
$function$;

-- ---------- 4. An opportunity's history reads its submission's stage changes (D-413) ----------
-- 20261118160000's record_history_list, restated with every rule it had (the page size and its cursor of time and key together, the one refusal for a
-- record that is not there, is another firm's or may not be seen, the names of who, the grants), and for table 'opportunities' it also returns each
-- move of the opportunity's submission that changes the opportunity's stage, as its own entry: kind 'stage_changed', field 'stage', the stage before
-- and after as the codes opportunity_stage_of gives (qualifying, intake_under_way, ready_to_send, in_market, quoted, won, lost), who made the move, and
-- when the move had a cause (ADR 0026) the cause and the PEO of the quote request that made it. Read from the status history, never copied into
-- record_history (D-130): nothing but the capture trigger writes that. The entry key is a UUID worked out from the status history row's own id,
-- so it is stable between calls, and both kinds of entry are ordered together by time and then key, as before: a page never skips or repeats an entry
-- that shares a time.
--
-- Which moves count. A move inside one stage (submitted to under review) is not a stage change and is not shown. A move from nothing (the row that
-- starts a submission) is not one either. Archived is D-216's: a submission archived straight from won stays Won, so that move is not shown, and
-- reopening it from archived is a move from Won; archived from any other stage is a move to Lost, and reopening that is a move from Lost. Marking or
-- clearing "needs action" writes a row from a stage to itself, which is no move.
--
-- Two columns are added to what it returns, so the function is dropped and made again: cause (quote_send or quote_recorded, null for every other
-- entry) and cause_peo (the PEO's name, null when there is no cause or its quote request is gone). Neither is an id or an email (D-33).
DROP FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid);
CREATE FUNCTION public.record_history_list(
  p_firm_id uuid, p_table text, p_key text, p_limit integer DEFAULT 50, p_after_at timestamptz DEFAULT NULL, p_after_key uuid DEFAULT NULL)
RETURNS TABLE (
  entry_key uuid, at timestamptz, change_id uuid, kind text, who text, who_kind text, field text, from_value jsonb, to_value jsonb,
  cause text, cause_peo text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t public.record_history_table;
BEGIN
  t := public.record_history_table_named(p_table);
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR (p_after_at IS NULL) <> (p_after_key IS NULL) THEN
    RAISE EXCEPTION 'A page is 1 to 100 entries, after an entry given by its time and key together' USING ERRCODE = '22023';
  END IF;
  -- One refusal for a record of another firm, one that was never made and one the caller may not see: nobody learns that it exists.
  IF NOT public.record_history_can_see(p_firm_id, t, p_key) THEN
    RAISE EXCEPTION 'That record isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN QUERY
    WITH e AS (
      SELECT h.entry_key AS e_key, h.at AS e_at, h.change_id AS e_change, h.kind AS e_kind,
             public.record_history_who(h.actor_id, h.actor_is_staff) AS e_who,
             CASE WHEN h.actor_is_staff THEN 'nevermore' WHEN h.actor_id IS NULL THEN 'system' ELSE 'member' END AS e_who_kind,
             h.field AS e_field, h.old_value AS e_old, h.new_value AS e_new, NULL::text AS e_cause, NULL::text AS e_peo
      FROM public.record_history h
      WHERE h.firm_id = p_firm_id AND h.table_name = t AND h.record_key = p_key
      UNION ALL
      SELECT md5('submission_status_history:' || s.id)::uuid, s.changed_at, md5('submission_status_history:' || s.id)::uuid, 'stage_changed',
             public.record_history_who(s.changed_by, s.actor_is_staff),
             CASE WHEN s.actor_is_staff THEN 'nevermore' WHEN s.changed_by IS NULL THEN 'system' ELSE 'member' END,
             'stage', to_jsonb(s.stage_before), to_jsonb(s.stage_after), s.cause,
             (SELECT q.peo_name FROM public.quote_requests q WHERE q.id = s.cause_quote_request_id AND q.session_id = s.session_id)
      FROM (
        SELECT h.id, h.session_id, h.changed_at, h.changed_by, h.actor_is_staff, h.cause, h.cause_quote_request_id,
               CASE WHEN h.from_status = 'archived' THEN
                      CASE WHEN (SELECT x.from_status FROM public.submission_status_history x
                                 WHERE x.session_id = h.session_id AND x.to_status = 'archived' AND x.from_status IS DISTINCT FROM 'archived' AND x.id < h.id
                                 ORDER BY x.id DESC LIMIT 1) = 'won' THEN 'won' ELSE 'lost' END
                    ELSE public.opportunity_stage_of(h.from_status) END AS stage_before,
               CASE WHEN h.to_status = 'archived' THEN CASE WHEN h.from_status = 'won' THEN 'won' ELSE 'lost' END
                    ELSE public.opportunity_stage_of(h.to_status) END AS stage_after
        FROM public.opportunities o
        JOIN public.submission_status_history h ON h.session_id = o.intake_id
        WHERE t = 'opportunities' AND o.firm_id = p_firm_id AND o.id = public.record_history_key_uuid(p_key)
          AND h.from_status IS NOT NULL AND h.from_status IS DISTINCT FROM h.to_status
      ) s
      WHERE s.stage_before IS DISTINCT FROM s.stage_after
    )
    SELECT e.e_key, e.e_at, e.e_change, e.e_kind, e.e_who, e.e_who_kind, e.e_field, e.e_old, e.e_new, e.e_cause, e.e_peo
    FROM e
    WHERE (p_after_at IS NULL OR (e.e_at, e.e_key) < (p_after_at, p_after_key))
    ORDER BY e.e_at DESC, e.e_key DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid) TO authenticated;
