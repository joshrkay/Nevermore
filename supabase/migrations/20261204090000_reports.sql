-- The firm's reports (docs/BROKER_READINESS_PRD.md BR-6.1; stories CRM-R1.1 to CRM-R1.3; docs/BROKER_CRM_BUILD.md "## Reports", D-2400 on;
-- supabase/tests/reports.sql). Five beside the intake funnel: the pipeline, quotes by market, won and lost, renewals, and commission. Each is worked out
-- when it is asked for, from the records as they are (CRM-R1.3): nothing here is stored, and nothing here reads an intake's answers.

SET lock_timeout = '5s';

-- The longest period a report covers, and how many records a list under a figure holds.
CREATE FUNCTION public.report_limits()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    -- sync:begin report_limits
    'max_days', 1100,
    'max_rows', 50
    -- sync:end report_limits
  )
$$;

REVOKE ALL ON FUNCTION public.report_limits() FROM PUBLIC, anon, authenticated;

-- The five reports, for a current member of the firm (or a support session reading it). p_whose is Home's: 'mine', 'team' (a lead) or 'everyone' (an
-- owner); one the caller may not ask for is read as their first choice. A record is counted only when the caller may see it by the level rule
-- (home_shows), by its account's owner, as on every page. p_line narrows every report to one line of business. Commission is an owner's (CRM-R1.2): for
-- anyone else it is absent.
CREATE FUNCTION public.firm_reports(p_firm_id uuid, p_from date, p_to date, p_whose text DEFAULT 'mine', p_line text DEFAULT NULL, p_time_zone text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_days constant integer := (public.report_limits() ->> 'max_days')::integer;
  max_rows constant integer := (public.report_limits() ->> 'max_rows')::integer;
  firm uuid;
  role text;
  choices text[];
  whose text;
  tz text := CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = p_time_zone) THEN p_time_zone ELSE 'UTC' END;
  today date;
  money boolean;
  pipeline jsonb;
  markets jsonb;
  won_lost jsonb;
  renewals jsonb;
  commission jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  role := public.firm_role(firm);
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Choose a period that starts on or before the day it ends' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > max_days THEN
    RAISE EXCEPTION 'A report covers at most three years' USING ERRCODE = '22023';
  END IF;
  IF p_line IS NOT NULL AND NOT (p_line = ANY (public.quote_lines())) THEN
    RAISE EXCEPTION 'Choose a line from the list' USING ERRCODE = '22023';
  END IF;
  choices := CASE role WHEN 'owner' THEN ARRAY['mine', 'everyone'] WHEN 'support' THEN ARRAY['everyone'] WHEN 'lead' THEN ARRAY['mine', 'team'] ELSE ARRAY['mine'] END;
  whose := CASE WHEN p_whose = ANY (choices) THEN p_whose ELSE choices[1] END;
  today := (now() AT TIME ZONE tz)::date;
  money := COALESCE(role IN ('owner', 'support'), false);

  WITH opps AS MATERIALIZED (
    -- Every search the caller may see, on an account that is not archived, with its stage and, when it is won or lost, the day that happened: the
    -- opportunity's own stamp, or for one closed from its intake's pipeline, the day the pipeline said so.
    SELECT o.id, o.name, o.value, o.source, o.intake_id, o.created_at, o.lost_reason, a.id AS account_id, a.name AS account_name,
           COALESCE(o.owner_id, a.owner_id) AS owner_id, x.stage,
           (CASE x.stage WHEN 'won' THEN COALESCE(o.won_at, h.won_at) WHEN 'lost' THEN COALESCE(o.lost_at, h.lost_at) END AT TIME ZONE tz)::date AS closed_on
    FROM public.opportunities o
    JOIN public.accounts a ON a.id = o.account_id
    CROSS JOIN LATERAL (SELECT public.opportunity_stage(o.id) AS stage) x
    LEFT JOIN LATERAL (SELECT max(s.changed_at) FILTER (WHERE s.to_status = 'won') AS won_at, max(s.changed_at) FILTER (WHERE s.to_status IN ('lost', 'archived')) AS lost_at
                       FROM public.submission_status_history s WHERE s.session_id = o.intake_id) h ON true
    WHERE o.firm_id = firm AND a.firm_id = firm AND a.archived_at IS NULL AND public.home_shows(firm, a.owner_id, whose)
      AND (p_line IS NULL OR o.line = p_line)
  ), open_opps AS (
    SELECT o.*, (today - (o.created_at AT TIME ZONE tz)::date) AS days_open FROM opps o WHERE o.stage NOT IN ('won', 'lost')
  ), closed AS (
    SELECT * FROM opps o WHERE o.stage IN ('won', 'lost') AND o.closed_on BETWEEN p_from AND p_to
  ), asked AS (
    -- Each quote request of those searches first sent in the period, and whether its market was the one placed with.
    SELECT q.id, q.peo_name, q.status, q.sent_on, q.quote_received_on, q.decline_reason, o.id AS opportunity_id, o.name AS opportunity_name, o.account_name,
           EXISTS (SELECT 1 FROM public.placements p WHERE p.firm_id = firm AND p.quote_request_id = q.id) AS placed
    FROM public.quote_requests q JOIN opps o ON o.intake_id = q.session_id
    WHERE q.sent_on BETWEEN p_from AND p_to
  ), rens AS (
    -- Renewals of accounts the caller may see. With a line chosen, only one whose search (or whose placement's search) is of that line.
    SELECT r.id, r.account_id, a.name AS account_name, r.with_whom, r.renews_on, r.not_renewed_on, r.opportunity_id,
           CASE WHEN r.not_renewed_on IS NOT NULL THEN 'lost' WHEN r.opportunity_id IS NOT NULL AND public.opportunity_stage(r.opportunity_id) = 'won' THEN 'kept' ELSE 'open' END AS outcome
    FROM public.renewals r
    JOIN public.accounts a ON a.id = r.account_id
    LEFT JOIN public.placements p ON p.id = r.placement_id
    WHERE r.firm_id = firm AND a.firm_id = firm AND a.archived_at IS NULL AND public.home_shows(firm, a.owner_id, whose)
      AND (p_line IS NULL OR EXISTS (SELECT 1 FROM public.opportunities lo WHERE lo.id IN (r.opportunity_id, p.opportunity_id) AND lo.line = p_line))
  ), placed AS (
    -- Placements of accounts the caller may see, for an owner only. One with no start date counts from the day it was recorded.
    SELECT p.id, p.account_id, a.name AS account_name, p.peo_name, p.commission_expected_yearly AS yearly,
           COALESCE(p.start_date, (p.created_at AT TIME ZONE tz)::date) AS starts, p.ended_on
    FROM public.placements p
    JOIN public.accounts a ON a.id = p.account_id
    LEFT JOIN public.opportunities po ON po.id = p.opportunity_id
    WHERE money AND p.firm_id = firm AND a.firm_id = firm AND a.archived_at IS NULL AND public.home_shows(firm, a.owner_id, whose)
      AND (p_line IS NULL OR po.line = p_line)
  ), months AS (
    SELECT m::date AS month, (m + interval '1 month' - interval '1 day')::date AS month_end
    FROM generate_series(date_trunc('month', p_from::timestamp), date_trunc('month', p_to::timestamp), interval '1 month') m
  ), expected AS (
    -- A twelfth of the year's expected commission for each month of the period the placement is in force for any part of.
    SELECT m.month, pl.id AS placement_id, round(pl.yearly / 12, 2) AS amount
    FROM months m JOIN placed pl ON pl.yearly IS NOT NULL AND pl.starts <= m.month_end AND (pl.ended_on IS NULL OR pl.ended_on >= m.month)
  ), received AS (
    SELECT date_trunc('month', c.received_on::timestamp)::date AS month, c.placement_id, c.amount
    FROM public.commission_payments c JOIN placed pl ON pl.id = c.placement_id
    WHERE c.firm_id = firm AND c.received_on BETWEEN p_from AND p_to
  )
  SELECT
    -- Pipeline: what is open now, whatever the period.
    jsonb_build_object(
      'count', (SELECT count(*) FROM open_opps),
      'value', (SELECT COALESCE(sum(value), 0) FROM open_opps),
      'stages', COALESCE((SELECT jsonb_agg(jsonb_build_object('stage', s.stage, 'count', s.n, 'value', s.v, 'median_days', s.d) ORDER BY s.ord)
                          FROM (SELECT st.stage, st.ord, count(o.id) AS n, COALESCE(sum(o.value), 0) AS v, percentile_cont(0.5) WITHIN GROUP (ORDER BY o.days_open) AS d
                                FROM unnest(ARRAY['qualifying', 'intake_under_way', 'ready_to_send', 'in_market', 'quoted']) WITH ORDINALITY st(stage, ord)
                                LEFT JOIN open_opps o ON o.stage = st.stage GROUP BY st.stage, st.ord) s), '[]'::jsonb),
      'owners', COALESCE((SELECT jsonb_agg(jsonb_build_object('owner_id', g.owner_id, 'owner', public.crm_person_name(g.owner_id), 'count', g.n, 'value', g.v) ORDER BY g.n DESC, g.owner_id)
                          FROM (SELECT owner_id, count(*) AS n, COALESCE(sum(value), 0) AS v FROM open_opps GROUP BY owner_id) g), '[]'::jsonb),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'account', o.account_name, 'stage', o.stage, 'days', o.days_open, 'value', o.value,
                                                            'owner', public.crm_person_name(o.owner_id)) ORDER BY o.days_open DESC, o.id)
                        FROM (SELECT * FROM open_opps ORDER BY days_open DESC, id LIMIT max_rows) o), '[]'::jsonb)),
    -- Quotes by market: of what was first sent in the period.
    jsonb_build_object(
      'sent', (SELECT count(*) FROM asked),
      'quoted', (SELECT count(*) FROM asked WHERE quote_received_on IS NOT NULL),
      'declined', (SELECT count(*) FROM asked WHERE status = 'declined'),
      'won', (SELECT count(*) FROM asked WHERE placed),
      'markets', COALESCE((SELECT jsonb_agg(jsonb_build_object('market', g.peo_name, 'sent', g.sent, 'quoted', g.quoted, 'declined', g.declined, 'won', g.won, 'median_days', g.days,
                                                               'decline_reasons', g.reasons) ORDER BY g.sent DESC, g.peo_name)
                           FROM (SELECT k.peo_name, count(*) AS sent, count(*) FILTER (WHERE k.quote_received_on IS NOT NULL) AS quoted,
                                        count(*) FILTER (WHERE k.status = 'declined') AS declined, count(*) FILTER (WHERE k.placed) AS won,
                                        percentile_cont(0.5) WITHIN GROUP (ORDER BY (k.quote_received_on - k.sent_on)) FILTER (WHERE k.quote_received_on IS NOT NULL) AS days,
                                        COALESCE((SELECT jsonb_object_agg(d.reason, d.n) FROM (SELECT COALESCE(k2.decline_reason, 'not_said') AS reason, count(*) AS n FROM asked k2
                                                                                               WHERE k2.peo_name = k.peo_name AND k2.status = 'declined' GROUP BY 1) d), '{}'::jsonb) AS reasons
                                 FROM asked k GROUP BY k.peo_name) g), '[]'::jsonb),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', k.id, 'market', k.peo_name, 'opportunity_id', k.opportunity_id, 'opportunity', k.opportunity_name, 'account', k.account_name,
                                                            'sent_on', k.sent_on, 'status', k.status, 'placed', k.placed) ORDER BY k.sent_on DESC, k.id DESC)
                        FROM (SELECT * FROM asked ORDER BY sent_on DESC, id DESC LIMIT max_rows) k), '[]'::jsonb)),
    -- Won and lost: what was closed in the period.
    jsonb_build_object(
      'won', (SELECT count(*) FROM closed WHERE stage = 'won'),
      'lost', (SELECT count(*) FROM closed WHERE stage = 'lost'),
      'value_won', (SELECT COALESCE(sum(value), 0) FROM closed WHERE stage = 'won'),
      'owners', COALESCE((SELECT jsonb_agg(jsonb_build_object('owner_id', g.owner_id, 'owner', public.crm_person_name(g.owner_id), 'won', g.won, 'lost', g.lost) ORDER BY g.won DESC, g.lost DESC, g.owner_id)
                          FROM (SELECT owner_id, count(*) FILTER (WHERE stage = 'won') AS won, count(*) FILTER (WHERE stage = 'lost') AS lost FROM closed GROUP BY owner_id) g), '[]'::jsonb),
      'sources', COALESCE((SELECT jsonb_agg(jsonb_build_object('source', g.source, 'won', g.won, 'lost', g.lost) ORDER BY g.won DESC, g.lost DESC, g.source)
                           FROM (SELECT COALESCE(NULLIF(btrim(source), ''), 'Not said') AS source, count(*) FILTER (WHERE stage = 'won') AS won, count(*) FILTER (WHERE stage = 'lost') AS lost
                                 FROM closed GROUP BY 1) g), '[]'::jsonb),
      'reasons', COALESCE((SELECT jsonb_agg(jsonb_build_object('reason', g.reason, 'count', g.n) ORDER BY g.n DESC, g.reason)
                           FROM (SELECT COALESCE(lost_reason, 'not_said') AS reason, count(*) AS n FROM closed WHERE stage = 'lost' GROUP BY 1) g), '[]'::jsonb),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'account', c.account_name, 'outcome', c.stage, 'on', c.closed_on, 'value', c.value,
                                                            'reason', c.lost_reason, 'owner', public.crm_person_name(c.owner_id)) ORDER BY c.closed_on DESC, c.id)
                        FROM (SELECT * FROM closed ORDER BY closed_on DESC, id LIMIT max_rows) c), '[]'::jsonb)),
    -- Renewals: what renews in each of the next twelve months, and how the period's ended.
    jsonb_build_object(
      'months', (SELECT jsonb_agg(jsonb_build_object('month', to_char(m.month, 'YYYY-MM'), 'due', m.due, 'worked', m.worked) ORDER BY m.month)
                 FROM (SELECT g::date AS month, count(r.id) AS due, count(r.id) FILTER (WHERE r.opportunity_id IS NOT NULL) AS worked
                       FROM generate_series(date_trunc('month', today::timestamp), date_trunc('month', today::timestamp) + interval '11 months', interval '1 month') g
                       LEFT JOIN rens r ON r.not_renewed_on IS NULL AND r.outcome <> 'kept' AND date_trunc('month', r.renews_on::timestamp) = g
                       GROUP BY g) m),
      'kept', (SELECT count(*) FROM rens WHERE renews_on BETWEEN p_from AND p_to AND outcome = 'kept'),
      'lost', (SELECT count(*) FROM rens WHERE renews_on BETWEEN p_from AND p_to AND outcome = 'lost'),
      'open', (SELECT count(*) FROM rens WHERE renews_on BETWEEN p_from AND p_to AND outcome = 'open'),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'account_id', r.account_id, 'account', r.account_name, 'with_whom', r.with_whom, 'renews_on', r.renews_on,
                                                            'outcome', r.outcome, 'worked', r.opportunity_id IS NOT NULL) ORDER BY r.renews_on, r.id)
                        FROM (SELECT * FROM rens WHERE renews_on BETWEEN p_from AND p_to ORDER BY renews_on, id LIMIT max_rows) r), '[]'::jsonb)),
    -- Commission: expected against received, by month and by placement. An owner's.
    CASE WHEN money THEN jsonb_build_object(
      'expected', (SELECT COALESCE(sum(amount), 0) FROM expected),
      'received', (SELECT COALESCE(sum(amount), 0) FROM received),
      'months', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', to_char(m.month, 'YYYY-MM'),
                                                              'expected', (SELECT COALESCE(sum(e.amount), 0) FROM expected e WHERE e.month = m.month),
                                                              'received', (SELECT COALESCE(sum(c.amount), 0) FROM received c WHERE c.month = m.month)) ORDER BY m.month)
                          FROM months m), '[]'::jsonb),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('placement_id', g.id, 'account_id', g.account_id, 'account', g.account_name, 'market', g.peo_name,
                                                            'expected', g.expected, 'received', g.received) ORDER BY g.expected DESC, g.received DESC, g.id)
                        FROM (SELECT pl.id, pl.account_id, pl.account_name, pl.peo_name,
                                     (SELECT COALESCE(sum(e.amount), 0) FROM expected e WHERE e.placement_id = pl.id) AS expected,
                                     (SELECT COALESCE(sum(c.amount), 0) FROM received c WHERE c.placement_id = pl.id) AS received
                              FROM placed pl) g
                        WHERE g.expected > 0 OR g.received > 0), '[]'::jsonb)) END
  INTO pipeline, markets, won_lost, renewals, commission;

  RETURN jsonb_build_object('whose', whose, 'whose_choices', to_jsonb(choices), 'line', p_line, 'from', p_from, 'to', p_to, 'today', today,
                            'pipeline', pipeline, 'markets', markets, 'won_lost', won_lost, 'renewals', renewals, 'commission', commission);
END;
$$;

REVOKE ALL ON FUNCTION public.firm_reports(uuid, date, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_reports(uuid, date, date, text, text, text) TO authenticated;
