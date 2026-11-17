-- A decline keeps its reason (N-1.4, slice 7.1; joshrkay/Nevermore#206; the list and the rules are #88's decisions 5 and 6).
--
-- A PEO that declines now says why: advisor_update_quote_request takes a decline reason. It is required when the answer is declined, refused for any other
-- answer (a quote or a closing has none), one of six, logged like any change (the quote request's own log writes every column that changes: quote_request_events),
-- and cleared when the request is answered some other way, so a request that was declined and then quoted is not counted as a decline. The PEO's words stay in the
-- request's own note, beside the reason, as before. A request declined before this migration reads as declined with no reason; saving it declined again needs one.
--
-- advisor_update_quote_request is restated from 20261120090000_opportunity_stage.sql with every rule it had (the closing-firm check, the advisor, the answers it takes,
-- the lock order of the pipeline row and then the quote request, the note and fee limits, the closed request, the quote-only fields, the move to Quoted). It
-- gains an eighth argument, defaulted, so the function is dropped and made again: a caller that sends seven (the older front end, any test) is unchanged.
-- The reasons are in one function, decline_reasons(): the column's check and the function both read it, and src/data/schemaSync.test.ts keeps it equal to
-- DECLINE_REASONS in src/data/quoteRequests.ts.

SET lock_timeout = '5s';

CREATE FUNCTION public.decline_reasons()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT ARRAY[
    -- sync:begin decline_reasons
    'below_minimum_headcount', 'state_not_served', 'industry_or_class_code_excluded', 'claims_or_loss_history', 'incomplete_information', 'other'
    -- sync:end decline_reasons
  ]
$$;

REVOKE ALL ON FUNCTION public.decline_reasons() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decline_reasons() TO service_role;

ALTER TABLE public.quote_requests ADD COLUMN decline_reason text;
ALTER TABLE public.quote_requests ADD CONSTRAINT quote_requests_decline_reason_check CHECK (decline_reason IS NULL OR decline_reason = ANY (public.decline_reasons()));

DROP FUNCTION public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text);

CREATE FUNCTION public.advisor_update_quote_request(
  p_quote_request_id bigint, p_status text, p_received_on date DEFAULT NULL::date, p_expires_on date DEFAULT NULL::date, p_start_on date DEFAULT NULL::date,
  p_admin_fee_pepm numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text, p_decline_reason text DEFAULT NULL::text)
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
  -- The reason (#88: required for a decline, refused for any other answer, one of the six).
  IF p_status <> 'declined' AND p_decline_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Only a decline has a reason. Mark it declined, or leave the reason empty.' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'declined' AND p_decline_reason IS NULL THEN
    RAISE EXCEPTION 'Say why it declined: below minimum headcount, a state not served, industry or class code excluded, claims or loss history, incomplete information, or other.'
      USING ERRCODE = '22023';
  END IF;
  IF p_decline_reason IS NOT NULL AND NOT (p_decline_reason = ANY (public.decline_reasons())) THEN
    RAISE EXCEPTION 'Choose one of the reasons a PEO declines: below minimum headcount, a state not served, industry or class code excluded, claims or loss history, incomplete information, or other.'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_requests
  SET status = p_status,
      quote_received_on = p_received_on,
      quote_expires_on = p_expires_on,
      proposed_start_on = p_start_on,
      admin_fee_pepm = p_admin_fee_pepm,
      note = NULLIF(btrim(COALESCE(p_note, '')), ''),
      -- Only a decline has one: answering some other way clears it.
      decline_reason = CASE WHEN p_status = 'declined' THEN p_decline_reason END
  WHERE id = p_quote_request_id
  RETURNING * INTO req;
  -- ADR 0026: a quote recorded while the submission is Sent to PEOs moves it to Quoted, in this transaction, and at no other stage.
  IF p_status = 'quoted' THEN
    PERFORM public.submission_move_for_cause(req.session_id, 'sent_to_carrier', 'quoted', 'quote_recorded', req.id);
  END IF;
  RETURN to_jsonb(req);
END;
$function$;

REVOKE ALL ON FUNCTION public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text, text) TO authenticated;
