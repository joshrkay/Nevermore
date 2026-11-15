-- The leads table's query in the database (story CRM-L1.1a, slice 8.3, #190; docs/BROKER_CRM_BUILD.md D-44, D-806, D-809, D-814;
-- 20261119130000_accounts_table_query.sql, whose shape this follows; supabase/tests/leads_query.sql).
--
-- What the Leads page needs from the database, so the page only draws it: the table's fields, one row with its worked-out columns (leads_rows), a page of it
-- (leads_list) and the views' counts (leads_view_counts): search, filters, sort, 50 a page, the caller's visibility (the level rule, D-809), one firm at a
-- time. A lead in the bin is in no row here (D-806); its Deleted view is slice 8.4's.
--
-- As every table's query does it, no SQL is built from what the caller sends (D-44): no EXECUTE, no format(); a field's name chooses a branch of a fixed CASE.

-- ---------- 1. One row of the table ----------
--   owner / owner_name   the record owner, only while they are a current member of the firm (a lead whose owner left reads as owned by no one)
--   last_activity_at     the newest of its calls, notes and tasks (activity_at), or when it was made when it has none (D-814)
CREATE TYPE public.leads_row AS (
  id uuid,
  name text,
  title text,
  business text,
  email text,
  phone text,
  city text,
  state text,
  employees integer,
  current_provider text,
  source text,
  status text,
  not_fit_reason text,
  created_at timestamptz,
  owner uuid,
  owner_name text,
  last_activity_at timestamptz
);

-- ---------- 1b. The table's fields ----------
-- The fields a filter or a sort may name, and the kind of each. Nothing else is a field (src/lib/leadsApi.ts holds the same list; src/lib/leadsApi.test.ts
-- compares them). Email and phone have no sort (CRM-L1.1); labels come with slice 8.4 and custom fields with Epic 9 (D-805).
CREATE FUNCTION public.leads_field_kind(p_field text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    -- sync:begin leads_fields
    WHEN 'name' THEN 'text'
    WHEN 'title' THEN 'text'
    WHEN 'business' THEN 'text'
    WHEN 'city' THEN 'text'
    WHEN 'current_provider' THEN 'text'
    WHEN 'employees' THEN 'number'
    WHEN 'created_at' THEN 'date'
    WHEN 'last_activity_at' THEN 'date'
    WHEN 'state' THEN 'choice'
    WHEN 'source' THEN 'choice'
    WHEN 'status' THEN 'choice'
    WHEN 'not_fit_reason' THEN 'choice'
    WHEN 'owner' THEN 'person'
    -- sync:end leads_fields
  END
$$;

-- The values a choice field holds, in the order it sorts by. A state is checked as a state code; it has no list here.
CREATE FUNCTION public.leads_field_choices(p_field text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    WHEN 'source' THEN ARRAY[
      -- sync:begin leads_sources
      'added_by_hand', 'import', 'referral_partner', 'firms_link'
      -- sync:end leads_sources
    ]
    WHEN 'status' THEN ARRAY[
      -- sync:begin leads_statuses
      'new', 'working', 'converted', 'not_fit'
      -- sync:end leads_statuses
    ]
    WHEN 'not_fit_reason' THEN ARRAY[
      -- sync:begin leads_not_fit_reasons
      'too_small', 'wrong_industry', 'not_interested', 'bad_contact_details', 'other'
      -- sync:end leads_not_fit_reasons
    ]
  END
$$;

-- The filters of one call, checked, as accounts_filters_checked checks the accounts': at most 20, each on a listed field, each read by
-- workspace_filter_check; "me" and "my team" worked out into the people they are. Reads no lead.
CREATE FUNCTION public.leads_filters_checked(p_firm_id uuid, p_filters jsonb, p_today date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  f jsonb;
  field text;
  kind text;
  checked jsonb;
  people uuid[];
  out jsonb := '[]'::jsonb;
BEGIN
  IF p_filters IS NULL OR p_filters = 'null'::jsonb THEN
    RETURN out;
  END IF;
  IF jsonb_typeof(p_filters) <> 'array' THEN
    RAISE EXCEPTION 'Filters are a list' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_filters) > 20 THEN
    RAISE EXCEPTION 'A table takes at most 20 filters' USING ERRCODE = '22023';
  END IF;
  FOR f IN SELECT e FROM jsonb_array_elements(p_filters) e LOOP
    IF jsonb_typeof(f) <> 'object' OR jsonb_typeof(f -> 'field') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'A filter is an object that names a field' USING ERRCODE = '22023';
    END IF;
    field := f ->> 'field';
    kind := public.leads_field_kind(field);
    IF kind IS NULL THEN
      RAISE EXCEPTION 'The leads table has no field "%" to filter by', left(field, 64) USING ERRCODE = '22023';
    END IF;
    checked := public.workspace_filter_check(kind, f, public.leads_field_choices(field), p_today);
    IF field = 'state' AND checked ? 'vs' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(checked -> 'vs') s WHERE NOT COALESCE(public.is_us_state_code(upper(s)), false)
    ) THEN
      RAISE EXCEPTION 'The filter "% %" takes state codes such as CA', field, checked ->> 'op' USING ERRCODE = '22023';
    END IF;
    IF kind = 'person' AND checked ->> 'op' = 'me' THEN
      checked := jsonb_build_object('op', 'any_of', 'vs', jsonb_build_array(auth.uid()::text));
    ELSIF kind = 'person' AND checked ->> 'op' = 'my_team' THEN
      WITH RECURSIVE my_teams (id) AS (
        SELECT m.team_id
        FROM public.firm_memberships m
        WHERE m.firm_id = p_firm_id AND m.user_id = auth.uid() AND m.team_id IS NOT NULL AND public.membership_is_current(m.valid_from, m.valid_until)
        UNION
        SELECT t.id FROM public.firm_teams t JOIN my_teams ON t.parent_team_id = my_teams.id
      )
      SELECT COALESCE(array_agg(DISTINCT o.user_id), '{}') INTO people
      FROM public.firm_memberships o
      WHERE o.firm_id = p_firm_id AND public.membership_is_current(o.valid_from, o.valid_until) AND o.team_id IN (SELECT id FROM my_teams);
      checked := jsonb_build_object('op', 'any_of', 'vs', to_jsonb(ARRAY(SELECT p::text FROM unnest(people) p ORDER BY p::text)));
    END IF;
    out := out || jsonb_build_array(checked || jsonb_build_object('field', field));
  END LOOP;
  RETURN out;
END;
$$;

-- Whether one row passes every checked filter ("and"). A moment is compared as the day it falls on in `p_time_zone`.
CREATE FUNCTION public.leads_row_passes(r public.leads_row, p_checked jsonb, p_time_zone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_checked) f
    WHERE NOT COALESCE(CASE f ->> 'field'
      WHEN 'name' THEN public.workspace_filter_match_text(r.name, f)
      WHEN 'title' THEN public.workspace_filter_match_text(r.title, f)
      WHEN 'business' THEN public.workspace_filter_match_text(r.business, f)
      WHEN 'city' THEN public.workspace_filter_match_text(r.city, f)
      WHEN 'current_provider' THEN public.workspace_filter_match_text(r.current_provider, f)
      WHEN 'employees' THEN public.workspace_filter_match_number(r.employees, f)
      WHEN 'created_at' THEN public.workspace_filter_match_date((r.created_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'last_activity_at' THEN public.workspace_filter_match_date((r.last_activity_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'state' THEN public.workspace_filter_match_choice(r.state, f)
      WHEN 'source' THEN public.workspace_filter_match_choice(r.source, f)
      WHEN 'status' THEN public.workspace_filter_match_choice(r.status, f)
      WHEN 'not_fit_reason' THEN public.workspace_filter_match_choice(r.not_fit_reason, f)
      WHEN 'owner' THEN public.workspace_filter_match_person(r.owner, f)
    END, false)
  )
$$;

-- Every lead of the firm the caller may see that the search matches, the bin left out, each with its columns. Search: every word must be somewhere in the
-- lead's name, business, email or phone, ignoring case (CRM-L1.1). The one definition of a row: the list and the counts read it. Reads as
-- its owner, so the visibility is decided here, by asking can_see_firm_record once for each owner the firm's leads have (and for no owner), as accounts_rows
-- does: the same rule row security applies (supabase/tests/leads_query.sql compares the two).
CREATE FUNCTION public.leads_rows(p_firm_id uuid, p_search text DEFAULT NULL)
RETURNS SETOF public.leads_row
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  seen_owners uuid[];
  seen_unowned boolean;
  terms text[] := ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '');
BEGIN
  SELECT COALESCE(array_agg(o.owner_id) FILTER (WHERE o.owner_id IS NOT NULL), '{}'), COALESCE(bool_or(o.owner_id IS NULL), false)
  INTO seen_owners, seen_unowned
  FROM (SELECT DISTINCT l.owner_id FROM public.leads l WHERE l.firm_id = p_firm_id OFFSET 0) o
  WHERE public.can_see_firm_record(p_firm_id, o.owner_id);

  RETURN QUERY
  SELECT (ROW(
    l.id, l.name, l.title, l.business, l.email, l.phone, l.city, l.state, l.employees, l.current_provider, l.source, l.status, l.not_fit_reason, l.created_at,
    mem.user_id, mem.name,
    GREATEST(l.created_at, act.at)
  )::public.leads_row).*
  FROM public.leads l
  LEFT JOIN LATERAL (
    SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text) AS name
    FROM public.firm_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = p_firm_id AND m.user_id = l.owner_id AND public.membership_is_current(m.valid_from, m.valid_until)
    LIMIT 1
  ) mem ON true
  LEFT JOIN LATERAL (
    SELECT max(a.activity_at) AS at FROM public.activities a WHERE a.lead_id = l.id
  ) act ON true
  WHERE l.firm_id = p_firm_id
    AND l.deleted_at IS NULL
    AND (l.owner_id = ANY (seen_owners) OR (l.owner_id IS NULL AND seen_unowned))
    AND NOT EXISTS (
      SELECT 1 FROM unnest(terms) AS w (term)
      WHERE strpos(lower(concat_ws(E'\n', l.name, l.business, l.email, l.phone)), w.term) = 0
    );
END;
$$;

-- ---------- 2. What the browser calls ----------
-- One page of the leads table: the leads the caller may see that the search and every filter match, sorted, 50 a page, with how many match in all. Returns {"rows": [...], "total": n, "page": p, "page_size": 50}. One firm at a time: the firm named, or (NULL) the caller's
-- only firm at this address (firm_to_act_for).
--
-- Sort: any listed field (email and phone have none, CRM-L1.1), "asc" or "desc". Text ignoring case and by the alphabet; a status, a source and a reason by
-- their place in the field's list; a moment as a moment. Empty values come last in both directions. Equal values, and no sort at all, go by last activity,
-- newest first (the table's own order, D-814), then the lead's id: every row has one place.
CREATE FUNCTION public.leads_list(
  p_firm_id uuid,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_sort text DEFAULT NULL,
  p_direction text DEFAULT 'asc',
  p_page integer DEFAULT 1,
  p_search text DEFAULT NULL,
  p_time_zone text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  page_size constant integer := 50;
  firm uuid;
  pg integer := COALESCE(p_page, 1);
  tz text;
  checked jsonb;
  choices text[];
  result jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  tz := public.workspace_time_zone(p_time_zone);
  checked := public.leads_filters_checked(firm, p_filters, (now() AT TIME ZONE tz)::date);
  IF p_sort IS NOT NULL THEN
    IF public.leads_field_kind(p_sort) IS NULL THEN
      RAISE EXCEPTION 'The leads table has no field "%" to sort by', left(p_sort, 64) USING ERRCODE = '22023';
    END IF;
    choices := public.leads_field_choices(p_sort);
  END IF;
  IF p_direction IS NULL OR p_direction NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'A sort goes asc or desc' USING ERRCODE = '22023';
  END IF;
  IF pg < 1 OR pg > 100000 THEN
    RAISE EXCEPTION 'A page number is 1 to 100000' USING ERRCODE = '22023';
  END IF;

  WITH matched AS MATERIALIZED (
    SELECT r FROM public.leads_rows(firm, p_search) r WHERE public.leads_row_passes(r, checked, tz)
  ),
  keyed AS (
    SELECT
      m.r,
      NULLIF(btrim(CASE p_sort
        WHEN 'name' THEN lower((m.r).name COLLATE "und-x-icu")
        WHEN 'title' THEN lower((m.r).title COLLATE "und-x-icu")
        WHEN 'business' THEN lower((m.r).business COLLATE "und-x-icu")
        WHEN 'city' THEN lower((m.r).city COLLATE "und-x-icu")
        WHEN 'current_provider' THEN lower((m.r).current_provider COLLATE "und-x-icu")
        WHEN 'state' THEN lower((m.r).state COLLATE "und-x-icu")
        WHEN 'owner' THEN lower((m.r).owner_name COLLATE "und-x-icu")
      END), '') AS k_text,
      CASE p_sort
        WHEN 'employees' THEN (m.r).employees::numeric
        WHEN 'status' THEN COALESCE(array_position(choices, (m.r).status), cardinality(choices) + 1)
        WHEN 'source' THEN COALESCE(array_position(choices, (m.r).source), cardinality(choices) + 1)
        WHEN 'not_fit_reason' THEN CASE WHEN (m.r).not_fit_reason IS NULL THEN NULL
          ELSE COALESCE(array_position(choices, (m.r).not_fit_reason), cardinality(choices) + 1) END
      END AS k_number,
      CASE p_sort
        WHEN 'created_at' THEN (m.r).created_at
        WHEN 'last_activity_at' THEN (m.r).last_activity_at
      END AS k_moment
    FROM matched m
  ),
  ordered AS (
    SELECT k.r, row_number() OVER (ORDER BY
      (p_sort IS NOT NULL AND k.k_text IS NULL AND k.k_number IS NULL AND k.k_moment IS NULL),
      CASE WHEN p_direction = 'asc' THEN k.k_text END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_text END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_number END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_number END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_moment END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_moment END DESC,
      (k.r).last_activity_at DESC NULLS LAST, (k.r).id
    ) AS pos
    FROM keyed k
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(o.r) ORDER BY o.pos)
      FROM ordered o
      WHERE o.pos > (pg - 1)::bigint * page_size AND o.pos <= pg::bigint * page_size
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM matched),
    'page', pg,
    'page_size', page_size
  ) INTO result;
  RETURN result;
END;
$$;

-- The count for each view's tab: `p_views` is a list of {"name": text, "filters": [...]}, at most 20, names unique; one row per view in the order given,
-- each counting what leads_list would total for those filters and the search, for the same firm and person. One refused filter refuses the call, naming the view.
CREATE FUNCTION public.leads_view_counts(p_firm_id uuid, p_views jsonb, p_search text DEFAULT NULL, p_time_zone text DEFAULT 'UTC')
RETURNS TABLE (view_name text, total bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  tz text;
  today date;
  v jsonb;
  names text[] := '{}';
  sets jsonb[] := '{}';
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  tz := public.workspace_time_zone(p_time_zone);
  today := (now() AT TIME ZONE tz)::date;
  IF p_views IS NULL OR jsonb_typeof(p_views) <> 'array' OR jsonb_array_length(p_views) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Views are a list of 1 to 20' USING ERRCODE = '22023';
  END IF;
  FOR v IN SELECT e FROM jsonb_array_elements(p_views) e LOOP
    IF jsonb_typeof(v) <> 'object' OR jsonb_typeof(v -> 'name') IS DISTINCT FROM 'string'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(v) k WHERE k NOT IN ('name', 'filters')) THEN
      RAISE EXCEPTION 'A view is an object with a name and its filters' USING ERRCODE = '22023';
    END IF;
    IF btrim(v ->> 'name') = '' OR char_length(v ->> 'name') > 100 THEN
      RAISE EXCEPTION 'A view''s name is 1 to 100 characters' USING ERRCODE = '22023';
    END IF;
    IF (v ->> 'name') = ANY (names) THEN
      RAISE EXCEPTION 'Two views are named "%"', v ->> 'name' USING ERRCODE = '22023';
    END IF;
    BEGIN
      sets := sets || public.leads_filters_checked(firm, COALESCE(v -> 'filters', '[]'::jsonb), today);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'View "%": %', v ->> 'name', SQLERRM USING ERRCODE = SQLSTATE;
    END;
    names := names || (v ->> 'name');
  END LOOP;

  RETURN QUERY
  WITH visible AS MATERIALIZED (
    SELECT r FROM public.leads_rows(firm, p_search) r
  )
  SELECT w.name, (SELECT count(*) FROM visible x WHERE public.leads_row_passes(x.r, w.filters, tz))
  FROM unnest(names, sets) WITH ORDINALITY AS w(name, filters, ord)
  ORDER BY w.ord;
END;
$$;

REVOKE ALL ON FUNCTION public.leads_rows(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.leads_field_kind(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.leads_field_choices(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.leads_filters_checked(uuid, jsonb, date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.leads_row_passes(public.leads_row, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.leads_list(uuid, jsonb, text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leads_list(uuid, jsonb, text, text, integer, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.leads_view_counts(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leads_view_counts(uuid, jsonb, text, text) TO authenticated;

-- ---------- 3. Saved views and column choices ----------
-- The leads table keeps them as the queue and the accounts table do (CRM-S3.1, CRM-S3.4).
ALTER DOMAIN public.workspace_table DROP CONSTRAINT workspace_table_known;
ALTER DOMAIN public.workspace_table ADD CONSTRAINT workspace_table_known CHECK (VALUE IN ('submissions', 'accounts', 'leads'));

-- ---------- 4. The menu's count of open leads (CRM-S1.1) ----------
-- menu_counts (20261118140500), restated with every count it had, and `leads`: the open leads (New or Working) the caller may see, the bin left out.
CREATE OR REPLACE FUNCTION public.menu_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  quotes bigint;
  inbox bigint;
  leads bigint;
BEGIN
  PERFORM public.require_advisor();
  -- The firms to look in: those the caller has a membership or an open support session for. This only narrows where to look;
  -- is_firm_member is the lock (current member, this address's firm, not suspended, past the second factor, or support's read).
  -- The rows are the queue's: an intake with its workflow row that the queue does not hide (queue_hides_empty_guest_draft).
  WITH mine AS (
    SELECT m.firm_id FROM public.firm_memberships m WHERE m.user_id = auth.uid()
    UNION
    SELECT s.firm_id FROM public.support_sessions s WHERE s.admin_id = auth.uid() AND s.ended_at IS NULL
  ), allowed AS MATERIALIZED (
    SELECT t.firm_id FROM mine t WHERE public.is_firm_member(t.firm_id)
  ), requests AS MATERIALIZED (
    SELECT q.id, q.session_id, q.status
    FROM public.chamber_sessions s
    JOIN public.submission_workflow w ON w.session_id = s.id
    JOIN public.quote_requests q ON q.session_id = s.id
    WHERE s.firm_id IN (SELECT a.firm_id FROM allowed a)
      -- The guest flag is read one session at a time, by key: joining the whole user table to the firm's sessions was a scan of every user.
      AND NOT public.queue_hides_empty_guest_draft(s.id, (SELECT u.is_anonymous FROM auth.users u WHERE u.id = s.user_id),
                                                  s.chamber_data, s.field_provenance, s.transcript, s.chosen_peo)
  )
  SELECT
    count(*) FILTER (WHERE r.status = 'sent'),
    count(DISTINCT r.session_id) FILTER (WHERE EXISTS (SELECT 1 FROM public.quote_requests_with_new_peo_mail() n WHERE n.quote_request_id = r.id))
  INTO quotes, inbox
  FROM requests r;
  -- Open leads (New or Working) the caller may see by the level rule, the bin left out (CRM-S1.1, CRM-L1.1a), in the same firms.
  SELECT count(*) INTO leads
  FROM public.leads l
  WHERE l.firm_id IN (
      SELECT m.firm_id FROM public.firm_memberships m WHERE m.user_id = auth.uid()
      UNION
      SELECT s.firm_id FROM public.support_sessions s WHERE s.admin_id = auth.uid() AND s.ended_at IS NULL)
    AND public.is_firm_member(l.firm_id)
    AND l.status IN ('new', 'working') AND l.deleted_at IS NULL
    AND public.can_see_firm_record(l.firm_id, l.owner_id);
  RETURN jsonb_build_object('quotes', quotes, 'inbox', inbox, 'leads', leads);
END;
$$;
