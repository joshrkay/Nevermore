-- A decline keeps its reason (story N-1.4, slice 7.1; docs/BROKER_CRM_BUILD.md D-710 to D-719; supabase/tests/quote_decline_reason.sql).

-- ---------- 1. What a quote request keeps about a decline ----------
-- The reasons a PEO gives (DECLINE_REASONS in src/data/quoteRequests.ts; schemaSync compares them): outside its appetite, too small, too large, a claims
-- history, a state it does not cover, information missing, will not price it competitively, or something else (D-710).
CREATE FUNCTION public.quote_decline_reasons()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    -- sync:begin decline_reasons
    'industry', 'too_small', 'too_large', 'claims_history', 'states', 'missing_information', 'pricing', 'other'
    -- sync:end decline_reasons
  ]
$$;

ALTER TABLE public.quote_requests
  ADD COLUMN decline_reason text CONSTRAINT quote_requests_decline_reason_check CHECK (decline_reason = ANY (public.quote_decline_reasons())),
  ADD COLUMN decline_words text;

-- ---------- 2. Recording a PEO's answer takes the reason and the words ----------
-- 20261120090000's advisor_update_quote_request, with every rule it had, and two more arguments. The old signature goes: two functions of one name would
-- make every call that names its arguments ambiguous.
DROP FUNCTION public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text);
CREATE FUNCTION public.advisor_update_quote_request(p_quote_request_id bigint, p_status text, p_received_on date DEFAULT NULL::date, p_expires_on date DEFAULT NULL::date, p_start_on date DEFAULT NULL::date, p_admin_fee_pepm numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text, p_decline_reason text DEFAULT NULL::text, p_decline_words text DEFAULT NULL::text)
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
  IF p_status = 'declined' AND p_decline_reason IS NULL THEN
    RAISE EXCEPTION 'Say why the PEO declined. Choose a reason from the list' USING ERRCODE = '22023';
  END IF;
  IF p_status <> 'declined' AND (p_decline_reason, p_decline_words) IS DISTINCT FROM (NULL::text, NULL::text) THEN
    RAISE EXCEPTION 'Only a decline has a reason and words. Mark it declined, or leave them empty' USING ERRCODE = '22023';
  END IF;
  IF p_decline_reason IS NOT NULL AND NOT (p_decline_reason = ANY (public.quote_decline_reasons())) THEN
    RAISE EXCEPTION '% is not a reason from the list', p_decline_reason USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(COALESCE(p_decline_words, ''), E' \t\r\n')) > 500 THEN
    RAISE EXCEPTION 'The PEO''s words are limited to 500 characters' USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_requests
  SET status = p_status,
      quote_received_on = p_received_on,
      quote_expires_on = p_expires_on,
      proposed_start_on = p_start_on,
      admin_fee_pepm = p_admin_fee_pepm,
      note = NULLIF(btrim(COALESCE(p_note, '')), ''),
      decline_reason = CASE WHEN p_status = 'declined' THEN p_decline_reason ELSE decline_reason END,
      decline_words = CASE WHEN p_status = 'declined' THEN NULLIF(btrim(p_decline_words, E' \t\r\n'), '') ELSE decline_words END
  WHERE id = p_quote_request_id
  RETURNING * INTO req;
  -- ADR 0026: a quote recorded while the submission is Sent to PEOs moves it to Quoted, in this transaction, and at no other stage.
  IF p_status = 'quoted' THEN
    PERFORM public.submission_move_for_cause(req.session_id, 'sent_to_carrier', 'quoted', 'quote_recorded', req.id);
  END IF;
  RETURN to_jsonb(req);
END;
$function$;

REVOKE ALL ON FUNCTION public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text, text, text) TO authenticated;

-- ---------- 3. An opportunity's activity says why a PEO declined ----------
-- 20261123100000's opportunity_activity, with every rule it had, and on a quote's line for a decline the reason that decline gave (D-714).
CREATE OR REPLACE FUNCTION public.opportunity_activity(p_firm_id uuid, p_opportunity_id uuid, p_filter text DEFAULT 'all', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.opportunities;
  a public.accounts;
  want text;
  hist jsonb := '[]'::jsonb;
  chunk jsonb;
  after_at timestamptz;
  after_key uuid;
  need bigint := p_offset::bigint + p_limit;
  hist_total bigint := 0;
  take integer;
  n bigint;
  r jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit < 0 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'A page is 0 to 100 rows, from a place that is not before the first' USING ERRCODE = '22023';
  END IF;
  IF p_filter IS NULL OR p_filter NOT IN ('all', 'calls', 'notes', 'tasks', 'changes') THEN
    RAISE EXCEPTION 'An opportunity''s activity is all, calls, notes, tasks or changes' USING ERRCODE = '22023';
  END IF;
  IF p_firm_id IS NOT NULL AND p_opportunity_id IS NOT NULL THEN
    SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = p_firm_id;
    SELECT * INTO a FROM public.accounts x WHERE x.id = o.account_id AND x.firm_id = o.firm_id;
  END IF;
  IF o.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  want := CASE p_filter WHEN 'calls' THEN 'call' WHEN 'notes' THEN 'note' WHEN 'tasks' THEN 'task' END;
  IF p_filter IN ('all', 'changes') THEN
    -- How many history entries there are, without building them: the capture trigger's rows and the intake's stage changes.
    SELECT (SELECT count(*) FROM public.record_history h
            WHERE h.firm_id = o.firm_id AND h.table_name = public.record_history_table_named('opportunities') AND h.record_key = o.id::text)
           + CASE WHEN o.intake_id IS NULL THEN 0 ELSE public.opportunity_stage_change_count(o.intake_id) END
    INTO hist_total;
    -- The newest `need` of them, and no more.
    WHILE jsonb_array_length(hist) < LEAST(need, hist_total) LOOP
      take := LEAST(100, need - jsonb_array_length(hist))::integer;
      SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.at DESC, l.entry_key DESC), '[]'::jsonb) INTO chunk
      FROM public.record_history_list(o.firm_id, 'opportunities', o.id::text, take, after_at, after_key) l;
      EXIT WHEN jsonb_array_length(chunk) = 0;
      hist := hist || chunk;
      after_at := (chunk -> (jsonb_array_length(chunk) - 1) ->> 'at')::timestamptz;
      after_key := (chunk -> (jsonb_array_length(chunk) - 1) ->> 'entry_key')::uuid;
    END LOOP;
  END IF;
  WITH entries AS (
    SELECT h.e ->> 'entry_key' AS entry_key, (h.e ->> 'at')::timestamptz AS at,
           h.e || jsonb_build_object('type', 'change', 'record_table', 'opportunities', 'record_id', o.id, 'record_name', o.name) AS j
    FROM jsonb_array_elements(hist) AS h (e)
    UNION ALL
    SELECT 'quote_request_event:' || e.id, e.changed_at,
           jsonb_build_object('type', 'quote', 'entry_key', 'quote_request_event:' || e.id, 'at', e.changed_at, 'quote_request_id', e.quote_request_id,
                              'peo_name', q.peo_name, 'event', e.new_value, 'who', public.record_history_who(e.changed_by, e.actor_is_staff),
                              'who_kind', CASE WHEN e.actor_is_staff THEN 'nevermore' WHEN e.changed_by IS NULL THEN 'system' ELSE 'member' END,
                              'decline_reason', CASE WHEN e.new_value = 'declined' THEN (SELECT d.new_value FROM public.quote_request_events d
                                WHERE d.quote_request_id = e.quote_request_id AND d.field = 'decline_reason' AND d.changed_at <= e.changed_at
                                ORDER BY d.changed_at DESC, d.id DESC LIMIT 1) END,
                              'decline_words', CASE WHEN e.new_value = 'declined' THEN (SELECT d.new_value FROM public.quote_request_events d
                                WHERE d.quote_request_id = e.quote_request_id AND d.field = 'decline_words' AND d.changed_at <= e.changed_at
                                ORDER BY d.changed_at DESC, d.id DESC LIMIT 1) END)
    FROM public.quote_request_events e JOIN public.quote_requests q ON q.id = e.quote_request_id
    WHERE p_filter IN ('all', 'changes') AND o.intake_id IS NOT NULL AND e.session_id = o.intake_id AND e.field = 'status'
      AND e.new_value IN ('sent', 'acknowledged', 'question_open', 'quoted', 'declined', 'closed')
    UNION ALL
    -- Only the key is taken here: the row is built below, for the page's rows alone.
    SELECT t.id::text, t.at, NULL::jsonb
    FROM public.activities t
    WHERE p_filter IN ('all', 'calls', 'notes', 'tasks') AND t.opportunity_id = o.id AND t.account_id = o.account_id AND (want IS NULL OR t.kind = want)
  )
  SELECT (SELECT count(*) FROM entries) + (hist_total - jsonb_array_length(hist)),
         COALESCE((SELECT jsonb_agg(x.j ORDER BY x.o) FROM (
           SELECT row_number() OVER (ORDER BY e.at DESC, e.entry_key DESC) AS o,
                  COALESCE(e.j, (SELECT public.crm_activity_row(t) FROM public.activities t WHERE t.id = e.entry_key::uuid)) AS j
           FROM (SELECT * FROM entries ORDER BY at DESC, entry_key DESC OFFSET p_offset LIMIT p_limit) e) x), '[]'::jsonb)
  INTO n, r;
  RETURN jsonb_build_object('count', n, 'rows', r);
END;
$$;
