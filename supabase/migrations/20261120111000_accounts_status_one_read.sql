-- An account's status read once from its placements (review of joshrkay/Nevermore#182; docs/BROKER_CRM_BUILD.md D-451, D-455).
--
-- 20261120110000_placements_renewals.sql's accounts_rows, restated with every rule it had and one change: the account's status asked its placements three
-- times (one placement not ended; no placement; any placement), each a correlated EXISTS, for every account the table, its view counts, the export and the
-- bulk changes read. It now reads them once, as an aggregate, and asks the won-submission fallback only for an account with no placement. The answer is
-- the same for every account (supabase/tests/accounts_query.sql and placements_renewals.sql compare it with account_status() for every row).

CREATE OR REPLACE FUNCTION public.accounts_rows(p_firm_id uuid, p_search text, p_ids uuid[] DEFAULT NULL)
RETURNS SETOF public.accounts_row
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  seen_owners uuid[];
  seen_unowned boolean;
  terms text[] := ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '');
  domains text[] := ARRAY(SELECT public.web_domain_of(t) FROM unnest(ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '')) AS t);
BEGIN
  SELECT COALESCE(array_agg(o.owner_id) FILTER (WHERE o.owner_id IS NOT NULL), '{}'), COALESCE(bool_or(o.owner_id IS NULL), false)
  INTO seen_owners, seen_unowned
  FROM (SELECT DISTINCT a.owner_id FROM public.accounts a WHERE a.firm_id = p_firm_id OFFSET 0) o   -- OFFSET 0: the question is asked of each owner, not pushed down to each account
  WHERE public.can_see_firm_record(p_firm_id, o.owner_id);

  RETURN QUERY
  SELECT (ROW(
    a.id, a.name, a.trade_name, a.website, a.city, a.state, a.industry, a.employees, a.states_of_operation, a.current_provider, a.source,
    CASE WHEN st.is_client THEN 'client' WHEN st.has_placement THEN 'former_client' ELSE 'prospect' END, a.archived_at IS NOT NULL, a.archived_at, a.created_at,
    mem.user_id, mem.name,
    mc.id, mc.name, mc.email, mc.phone,
    oo.id, oo.name, oo.stage, oo.target_start, COALESCE(oo.n, 0),
    COALESCE(q.sent, 0), COALESCE(q.received, 0), COALESCE(q.waiting, false), q.expires,
    act.at, COALESCE(lab.names, '{}'), ren.renews_on
  )::public.accounts_row).*
  FROM public.accounts a
  LEFT JOIN LATERAL (
    SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text) AS name
    FROM public.firm_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = p_firm_id AND m.user_id = a.owner_id AND public.membership_is_current(m.valid_from, m.valid_until)
    LIMIT 1
  ) mem ON true
  -- The account's status (D-197, D-451, D-455): a client while it has a placement not ended, or, with no placement at all, a won submission (one won before
  -- placements); a former client when it has placements and all of them have ended. account_status() says the same for any account by its id alone, which no
  -- index serves for the opportunities (they are indexed by firm and account), so asked for each account of a firm it reads every opportunity of every firm;
  -- this asks by firm and account. supabase/tests/accounts_query.sql and placements_renewals.sql compare the two for every account.
  LEFT JOIN LATERAL (
    -- One read of the account's placements (by placements_firm_account_idx) answers both questions; the won-submission fallback is asked only when the
    -- account has no placement at all (D-455), which is the only case it can change the answer.
    SELECT pl.has_placement,
           pl.has_active_placement
           OR (NOT pl.has_placement
               AND EXISTS (SELECT 1 FROM public.opportunities w
                           WHERE w.firm_id = p_firm_id AND w.account_id = a.id AND w.intake_id IS NOT NULL AND public.submission_opportunity_stage(w.intake_id) = 'won')) AS is_client
    FROM (SELECT count(*) > 0 AS has_placement, COALESCE(bool_or(p.ended_on IS NULL), false) AS has_active_placement
          FROM public.placements p WHERE p.firm_id = p_firm_id AND p.account_id = a.id) pl
  ) st ON true
  -- The Renewal column (D-450): the date of the nearest renewal not done (renewal_is_done: not marked "Didn't renew" and not worked by a Won opportunity).
  LEFT JOIN LATERAL (
    SELECT min(rn.renews_on) AS renews_on
    FROM public.renewals rn
    WHERE rn.firm_id = p_firm_id AND rn.account_id = a.id AND NOT public.renewal_is_done(rn.not_renewed_on, rn.opportunity_id)
  ) ren ON true
  LEFT JOIN LATERAL (
    SELECT c.id, btrim(concat_ws(' ', c.first_name, c.last_name)) AS name, NULLIF(btrim(c.email), '') AS email,
           COALESCE(NULLIF(btrim(c.phone), ''), NULLIF(btrim(c.mobile), '')) AS phone
    FROM public.contacts c
    WHERE c.account_id = a.id AND c.is_main
  ) mc ON true
  LEFT JOIN LATERAL (
    SELECT x.id, x.name, x.target_start, x.stage, x.intake_id, (count(*) OVER ())::integer AS n
    FROM (
      SELECT o.id, o.name, o.target_start, o.created_at, o.intake_id, public.opportunity_stage(o.id) AS stage
      FROM public.opportunities o
      WHERE o.firm_id = p_firm_id AND o.account_id = a.id
    ) x
    WHERE x.stage NOT IN ('won', 'lost')
    ORDER BY x.target_start NULLS LAST, x.created_at, x.id
    LIMIT 1
  ) oo ON true
  LEFT JOIN LATERAL (
    SELECT (count(*) FILTER (WHERE r.status <> 'closed'))::integer AS sent,
           (count(*) FILTER (WHERE r.status = 'quoted'))::integer AS received,
           min(r.quote_expires_on) FILTER (WHERE r.status = 'quoted') AS expires,
           COALESCE(bool_or(r.status = 'sent'), false) AS waiting
    FROM public.quote_requests r
    WHERE r.session_id = oo.intake_id
  ) q ON true
  LEFT JOIN LATERAL (
    SELECT max(t.at) AS at FROM public.account_activity_times(p_firm_id, a.id) t
  ) act ON true
  LEFT JOIN LATERAL (
    SELECT lower(string_agg(concat_ws(' ', c.first_name, c.last_name, c.email), E'\n')) AS t
    FROM public.contacts c
    WHERE cardinality(terms) > 0 AND c.account_id = a.id
  ) ct ON true
  LEFT JOIN LATERAL (
    SELECT array_agg(l.name ORDER BY lower(l.name), l.name) AS names
    FROM public.account_labels al JOIN public.labels l ON l.id = al.label_id
    WHERE al.account_id = a.id
  ) lab ON true
  WHERE a.firm_id = p_firm_id
    AND (a.owner_id = ANY (seen_owners) OR (a.owner_id IS NULL AND seen_unowned))
    AND (p_ids IS NULL OR a.id = ANY (p_ids))
    AND NOT EXISTS (
      SELECT 1 FROM unnest(terms, domains) AS w (term, dom)
      WHERE strpos(lower(concat_ws(E'\n', a.name, a.trade_name, a.web_domain)) || E'\n' || COALESCE(ct.t, ''), w.term) = 0
        AND (w.dom IS NULL OR a.web_domain IS NULL OR strpos(a.web_domain, w.dom) = 0)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.accounts_rows(uuid, text, uuid[]) FROM PUBLIC, anon, authenticated, service_role;
