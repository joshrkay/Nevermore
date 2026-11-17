-- An opportunity's Activity shows its intake's own events (joshrkay/Nevermore#237).
--
-- docs/prd-screens/19-opportunity.png draws an Intake kind in the Activity ("Started by Dana from the account's details; Elena invited"), Home's "Needs you" already
-- tracks "an intake certified", and the page's Intake card shows the certification, but the Activity had no row for any of it: after an intake was certified the
-- list still showed only the quotes and the changes. docs/BROKER_CRM_STORIES.md (CRM-O1.1) says only "its activity", so which events belong was a question;
-- decided here (D-1902): the ones the database already records, so nothing new is written: a member started the intake for the client (chamber_sessions.started_by),
-- the client was invited and reminded (intake_invitations), and each certification, the first and every later version (chamber_certifications).
--
-- They are Changes as the quote requests' events are (All and Changes show them; Calls, Notes and Tasks do not), and the count is of what is shown. A row never
-- carries the invitation link's token and names the invitee by name, or by address where no name is on file. who is a member of the firm, or for a certification the
-- employer's signer (who_kind 'client'): they are not a member and are not named by their account.
--
-- opportunity_activity is restated from 20261123100000_quote_statuses.sql with every rule it had (the page size and offset, the filters, the refusal for an
-- opportunity the caller may not see, the history read newest first), and the one branch added. CREATE OR REPLACE keeps its grants.

SET lock_timeout = '5s';

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
                              'who_kind', CASE WHEN e.actor_is_staff THEN 'nevermore' WHEN e.changed_by IS NULL THEN 'system' ELSE 'member' END)
    FROM public.quote_request_events e JOIN public.quote_requests q ON q.id = e.quote_request_id
    WHERE p_filter IN ('all', 'changes') AND o.intake_id IS NOT NULL AND e.session_id = o.intake_id AND e.field = 'status'
      AND e.new_value IN ('sent', 'acknowledged', 'question_open', 'quoted', 'declined', 'closed')
    UNION ALL
    -- The intake's own events (#237): a member started it for the client, the client was invited and reminded, and each certification (the first, and every later
    -- version). Read from what is recorded, never the link's token or, where a name is on file, the address. A certification is dated by the database's own clock
    -- (recorded_at), not the signer's browser's (signed_at).
    SELECT i.entry_key, i.at, i.j
    FROM (
      SELECT 'intake_started:' || s.id AS entry_key, s.created_at AS at,
             jsonb_build_object('type', 'intake', 'entry_key', 'intake_started:' || s.id, 'at', s.created_at, 'event', 'started', 'version', NULL, 'reference', NULL,
                                'invitee', NULL, 'who', public.record_history_who(s.started_by, false), 'who_kind', 'member') AS j
      FROM public.chamber_sessions s
      WHERE s.id = o.intake_id AND s.started_by IS NOT NULL
      UNION ALL
      SELECT 'intake_invitation:' || v.id, v.created_at,
             jsonb_build_object('type', 'intake', 'entry_key', 'intake_invitation:' || v.id, 'at', v.created_at,
                                'event', CASE WHEN v.created_at <= v.invited_at THEN 'invited' ELSE 'reminded' END, 'version', NULL, 'reference', NULL,
                                'invitee', COALESCE(v.contact_name, v.email), 'who', public.record_history_who(v.invited_by, false),
                                'who_kind', CASE WHEN v.invited_by IS NULL THEN 'system' ELSE 'member' END)
      FROM public.intake_invitations v
      WHERE v.intake_id = o.intake_id AND v.firm_id = o.firm_id
      UNION ALL
      SELECT 'intake_certified:' || c.id, c.recorded_at,
             jsonb_build_object('type', 'intake', 'entry_key', 'intake_certified:' || c.id, 'at', c.recorded_at, 'event', 'certified', 'version', c.version,
                                'reference', c.file_id, 'invitee', NULL, 'who', c.signer_name, 'who_kind', 'client')
      FROM public.chamber_certifications c
      WHERE c.session_id = o.intake_id
    ) i
    WHERE p_filter IN ('all', 'changes') AND o.intake_id IS NOT NULL
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
