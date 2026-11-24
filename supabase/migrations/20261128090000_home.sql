-- Home (CRM-H1; docs/BROKER_READINESS_PRD.md BR-3.1, BR-3.2, BR-5.2; docs/BROKER_CRM_BUILD.md "## Home", D-2200 to D-2219; supabase/tests/home.sql).
-- One read for the first page a member of a firm opens: what needs them, five counts, renewals coming up, open opportunities by stage, upcoming tasks,
-- and, for a firm with nothing in it yet, what stops it sending. It adds no table: everything is read from what the firm already keeps.

SET lock_timeout = '5s';

-- The day counts Home goes by, in one place (BR-3.1: founder, 2026-11-24). The browser shows the same numbers (src/data/home.ts; schemaSync holds them equal).
CREATE FUNCTION public.home_days()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT jsonb_build_object(
    -- sync:begin home_days
    'quote_expiring', 14, 'intake_quiet', 7, 'lead_quiet', 7, 'upcoming_tasks', 14, 'renewals', 120
    -- sync:end home_days
  )
$$;
REVOKE ALL ON FUNCTION public.home_days() FROM PUBLIC, anon, authenticated;

-- Whether Home shows the caller a record of this owner: one they may see by the level rule (D-18), and, when they asked for their own, one they own.
CREATE FUNCTION public.home_shows(p_firm_id uuid, p_owner_id uuid, p_whose text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.can_see_firm_record(p_firm_id, p_owner_id) AND (p_whose <> 'mine' OR p_owner_id IS NOT DISTINCT FROM auth.uid())
$$;
REVOKE ALL ON FUNCTION public.home_shows(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- What needs a person in a firm, one line each (CRM-H1's "Needs you"). For their own ('mine') it goes by what they own and the tasks that are theirs, and
-- asks nothing of the caller, so the daily summary's job reads the same lines for each member; for a team's or everyone's it goes by the caller's level
-- rule. The one definition of each kind, for Home and for the summary. Not called through the API.
CREATE FUNCTION public.home_needs(p_firm_id uuid, p_user_id uuid, p_whose text, p_time_zone text)
RETURNS TABLE (kind text, record_type text, record_id text, name text, about text, at timestamptz, owner_id uuid)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH d AS (
    SELECT (now() AT TIME ZONE p_time_zone)::date AS today, public.home_days() AS days
  ), open_opps AS MATERIALIZED (
    SELECT x.* FROM (
      SELECT o.id, o.name, o.intake_id, a.name AS account_name, a.owner_id, public.opportunity_stage(o.id) AS stage
      FROM public.opportunities o JOIN public.accounts a ON a.id = o.account_id
      WHERE o.firm_id = p_firm_id AND a.firm_id = p_firm_id AND a.archived_at IS NULL
        AND CASE WHEN p_whose = 'mine' THEN a.owner_id IS NOT DISTINCT FROM p_user_id ELSE public.can_see_firm_record(p_firm_id, a.owner_id) END) x
    WHERE x.stage NOT IN ('won', 'lost')
  )
    -- New mail: one line for a thread, its newest new message (the inbox's own rows, which already go by the level rule).
    SELECT * FROM (
      SELECT DISTINCT ON (r.kind, r.thread_id) 'new_mail'::text AS kind, 'inbox'::text AS record_type, r.thread_id AS record_id,
             COALESCE(r.account_name, r.lead_name, r.peo_name, r.from_name, r.from_address) AS name, r.subject AS about, r.at, r.owner AS owner_id
      FROM public.inbox_rows(p_firm_id) r
      -- The inbox's rows go by the caller's own level, so a read for someone else (the daily summary's job) holds no mail: new mail has its own alert.
      WHERE r.is_new AND p_user_id IS NOT DISTINCT FROM auth.uid() AND (p_whose <> 'mine' OR r.owner IS NOT DISTINCT FROM p_user_id)
      ORDER BY r.kind, r.thread_id, r.at DESC) m
    UNION ALL
    -- An intake certified and sent to nobody yet.
    SELECT 'intake_certified', 'opportunity', o.id::text, o.account_name, o.name, c.signed_at, o.owner_id
    FROM open_opps o
    JOIN LATERAL (SELECT x.signed_at FROM public.chamber_certifications x WHERE x.session_id = o.intake_id AND x.superseded_at IS NULL ORDER BY x.version DESC LIMIT 1) c ON true
    WHERE NOT EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.session_id = o.intake_id)
    UNION ALL
    -- A quote that expires within the days given, today included; one already expired is not expiring.
    SELECT 'quote_expiring', 'quote', q.id::text, o.account_name, q.peo_name, e.expires_on::timestamp AT TIME ZONE p_time_zone, o.owner_id
    FROM open_opps o
    JOIN public.quote_requests q ON q.session_id = o.intake_id AND q.status = 'quoted'
    JOIN LATERAL (SELECT COALESCE((SELECT x.expires_on FROM public.quotes x WHERE x.quote_request_id = q.id ORDER BY x.id DESC LIMIT 1), q.quote_expires_on) AS expires_on) e ON true
    CROSS JOIN d
    WHERE e.expires_on BETWEEN d.today AND d.today + (d.days ->> 'quote_expiring')::integer
    UNION ALL
    -- An intake under way with nothing new on it for the days given.
    SELECT 'intake_quiet', 'opportunity', o.id::text, o.account_name, o.name, s.updated_at, o.owner_id
    FROM open_opps o JOIN public.chamber_sessions s ON s.id = o.intake_id CROSS JOIN d
    WHERE o.stage = 'intake_under_way' AND s.updated_at < now() - make_interval(days => (d.days ->> 'intake_quiet')::integer)
    UNION ALL
    -- A task due today or overdue: the person's own when they asked for their own, otherwise those on what they may see.
    SELECT 'task_due', CASE WHEN t.lead_id IS NOT NULL THEN 'lead' ELSE 'account' END, COALESCE(t.lead_id, t.account_id)::text,
           COALESCE(a.name, l.name), t.title, t.due_on::timestamp AT TIME ZONE p_time_zone, t.assignee_id
    FROM public.activities t
    LEFT JOIN public.accounts a ON a.id = t.account_id
    LEFT JOIN public.leads l ON l.id = t.lead_id
    CROSS JOIN d
    WHERE t.firm_id = p_firm_id AND t.kind = 'task' AND t.done_at IS NULL AND t.due_on <= d.today
      AND (l.id IS NULL OR l.deleted_at IS NULL)
      AND CASE WHEN p_whose = 'mine' THEN t.assignee_id IS NOT DISTINCT FROM p_user_id ELSE public.can_see_firm_record(p_firm_id, COALESCE(a.owner_id, l.owner_id)) END
    UNION ALL
    -- An open lead with no call, note or task for the days given (its last activity, as the leads table has it: D-814).
    SELECT 'lead_quiet', 'lead', l.id::text, l.name, NULLIF(btrim(l.business), ''), x.last_at, l.owner_id
    FROM public.leads l
    JOIN LATERAL (SELECT COALESCE((SELECT max(t.activity_at) FROM public.activities t WHERE t.lead_id = l.id), l.created_at) AS last_at) x ON true
    CROSS JOIN d
    WHERE l.firm_id = p_firm_id AND l.status IN ('new', 'working') AND l.deleted_at IS NULL
      AND CASE WHEN p_whose = 'mine' THEN l.owner_id IS NOT DISTINCT FROM p_user_id ELSE public.can_see_firm_record(p_firm_id, l.owner_id) END
      AND x.last_at < now() - make_interval(days => (d.days ->> 'lead_quiet')::integer)
$$;
REVOKE ALL ON FUNCTION public.home_needs(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Home, for a current member of the firm (or a support session reading it). p_whose is 'mine', 'team' (a lead) or 'everyone' (an owner); one the caller
-- may not ask for is answered as their own, and the answer says which was used and which they may choose. Days are the caller's own, by p_time_zone.
CREATE FUNCTION public.home_page(p_firm_id uuid, p_whose text DEFAULT 'mine', p_time_zone text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_needs constant integer := 50;
  max_rows constant integer := 20;
  firm uuid;
  f public.firms;
  role text;
  choices text[];
  whose text;
  me uuid := auth.uid();
  tz text := CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = p_time_zone) THEN p_time_zone ELSE 'UTC' END;
  today date;
  days jsonb := public.home_days();
  needs jsonb;
  needs_total bigint;
  counts jsonb;
  renewals jsonb;
  stages jsonb;
  tasks jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT * INTO f FROM public.firms x WHERE x.id = firm;
  role := public.firm_role(firm);
  choices := CASE role WHEN 'owner' THEN ARRAY['mine', 'everyone'] WHEN 'support' THEN ARRAY['everyone'] WHEN 'lead' THEN ARRAY['mine', 'team'] ELSE ARRAY['mine'] END;
  whose := CASE WHEN p_whose = ANY (choices) THEN p_whose ELSE choices[1] END;
  today := (now() AT TIME ZONE tz)::date;

  -- The searches Home counts and lists: on an account that is not archived, shown by its account's owner as every page of an opportunity is.
  WITH opps AS MATERIALIZED (
    SELECT o.id, o.name, o.intake_id, o.won_at, a.id AS account_id, a.name AS account_name, a.owner_id, public.opportunity_stage(o.id) AS stage
    FROM public.opportunities o JOIN public.accounts a ON a.id = o.account_id
    WHERE o.firm_id = firm AND a.firm_id = firm AND a.archived_at IS NULL AND public.home_shows(firm, a.owner_id, whose)
  ), open_opps AS (
    SELECT * FROM opps WHERE stage NOT IN ('won', 'lost')
  ), lines AS (
    SELECT * FROM public.home_needs(firm, me, whose, tz)
  )
  SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', n.kind, 'record_type', n.record_type, 'record_id', n.record_id, 'name', n.name, 'about', n.about,
                                                       'at', n.at, 'owner', public.crm_person_name(n.owner_id)) ORDER BY n.at DESC, n.kind, n.record_id)
                   FROM (SELECT * FROM lines ORDER BY at DESC, kind, record_id LIMIT max_needs) n), '[]'::jsonb),
         (SELECT count(*) FROM lines),
         jsonb_build_object(
           'open_leads', (SELECT count(*) FROM public.leads l WHERE l.firm_id = firm AND l.status IN ('new', 'working') AND l.deleted_at IS NULL AND public.home_shows(firm, l.owner_id, whose)),
           'open_opportunities', (SELECT count(*) FROM open_opps),
           'quotes_waiting', (SELECT count(*) FROM open_opps o JOIN public.quote_requests q ON q.session_id = o.intake_id WHERE q.status IN ('sent', 'acknowledged', 'question_open')),
           'renewals_due', (SELECT count(*) FROM public.renewals r JOIN public.accounts a ON a.id = r.account_id
                            WHERE r.firm_id = firm AND a.archived_at IS NULL AND public.home_shows(firm, a.owner_id, whose)
                              AND NOT public.renewal_is_done(r.not_renewed_on, r.opportunity_id) AND r.renews_on <= today + (days ->> 'renewals')::integer),
           'won_this_quarter', (SELECT count(*) FROM opps o WHERE o.stage = 'won' AND (o.won_at AT TIME ZONE tz) >= date_trunc('quarter', today::timestamp))),
         -- Open opportunities by stage, in the stages' own order; a stage with none says so.
         (SELECT jsonb_agg(jsonb_build_object('stage', s.stage, 'count', (SELECT count(*) FROM open_opps o WHERE o.stage = s.stage)) ORDER BY s.ord)
          FROM unnest(ARRAY['qualifying', 'intake_under_way', 'ready_to_send', 'in_market', 'quoted']) WITH ORDINALITY s(stage, ord))
  INTO needs, needs_total, counts, stages;

  -- Renewals coming up: not done, within the days given, an overdue one included (as the accounts table's "Renewing in 120 days", D-450); soonest first.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'account_id', r.account_id, 'account_name', r.account_name, 'kind', r.kind, 'with_whom', r.with_whom,
                                               'renews_on', r.renews_on, 'days_away', r.renews_on - today) ORDER BY r.renews_on, r.id), '[]'::jsonb)
  INTO renewals
  FROM (SELECT r.id, r.account_id, a.name AS account_name, r.kind, r.with_whom, r.renews_on
        FROM public.renewals r JOIN public.accounts a ON a.id = r.account_id
        WHERE r.firm_id = firm AND a.archived_at IS NULL AND public.home_shows(firm, a.owner_id, whose)
          AND NOT public.renewal_is_done(r.not_renewed_on, r.opportunity_id) AND r.renews_on <= today + (days ->> 'renewals')::integer
        ORDER BY r.renews_on, r.id LIMIT max_rows) r;

  -- Upcoming tasks (BR-3.2): open, due within the days given, an overdue one included; by due date.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'due_on', t.due_on, 'days_away', t.due_on - today, 'record_type', t.record_type,
                                               'record_id', t.record_id, 'name', t.name, 'assignee', public.crm_person_name(t.assignee_id)) ORDER BY t.due_on, t.id), '[]'::jsonb)
  INTO tasks
  FROM (SELECT t.id, t.title, t.due_on, t.assignee_id, CASE WHEN t.lead_id IS NOT NULL THEN 'lead' ELSE 'account' END AS record_type,
               COALESCE(t.lead_id, t.account_id)::text AS record_id, COALESCE(a.name, l.name) AS name
        FROM public.activities t
        LEFT JOIN public.accounts a ON a.id = t.account_id
        LEFT JOIN public.leads l ON l.id = t.lead_id
        WHERE t.firm_id = firm AND t.kind = 'task' AND t.done_at IS NULL AND t.due_on <= today + (days ->> 'upcoming_tasks')::integer
          AND (l.id IS NULL OR l.deleted_at IS NULL)
          AND public.can_see_firm_record(firm, COALESCE(a.owner_id, l.owner_id))
          AND (whose <> 'mine' OR t.assignee_id IS NOT DISTINCT FROM me)
        ORDER BY t.due_on, t.id LIMIT max_rows) t;

  RETURN jsonb_build_object(
    'whose', whose, 'whose_choices', to_jsonb(choices),
    -- A firm with no lead and no account has nothing yet (CRM-H1's "Nothing yet"), whoever is asking and whatever they may see.
    'empty', NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.firm_id = firm) AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.firm_id = firm),
    -- What stops the caller sending now (BR-5.2), the firm's approval before their own mailbox; null when nothing does.
    'blocks_sending', CASE WHEN f.decision = 'refused' THEN 'refused'
                           WHEN f.approved_at IS NULL THEN 'waiting_for_approval'
                           WHEN NOT EXISTS (SELECT 1 FROM public.broker_mailboxes b WHERE b.user_id = me) THEN 'no_mailbox' END,
    'needs', needs, 'needs_total', needs_total, 'counts', counts, 'stages', stages, 'renewals', renewals, 'upcoming_tasks', tasks);
END;
$$;

REVOKE ALL ON FUNCTION public.home_page(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.home_page(uuid, text, text) TO authenticated;
