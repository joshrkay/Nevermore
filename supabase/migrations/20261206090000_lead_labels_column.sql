-- The Label column and filter on the leads table (docs/BROKER_READINESS_PRD.md BR-5.4; issue 245; docs/BROKER_CRM_BUILD.md "## Leads catch up", D-2345 on;
-- supabase/tests/lead_labels_column.sql). Labels have been put on leads by the bulk change since slice 8.4 (lead_labels) and read on a lead's page; the
-- table could neither show them nor filter by them. A row gains its labels, and the four functions that name a row's fields are restated with it, each
-- from its definition in 20261121110500_leads_table_query.sql with every other line kept. Saved views, the view counts, the bulk change's "everything
-- that matches" and the export's filters all go through leads_filters_checked and leads_row_passes, so they take the Label filter with no change.

SET lock_timeout = '5s';

-- ---------- 1. A row holds the lead's labels ----------
ALTER TYPE public.leads_row ADD ATTRIBUTE labels text[];

-- ---------- 2. Label is a field: filtered as the accounts table's is (any of, none of, is empty), sorted by the labels read as one text ----------
CREATE OR REPLACE FUNCTION public.leads_field_kind(p_field text)
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
    WHEN 'labels' THEN 'choices'
    -- sync:end leads_fields
  END
$$;

CREATE OR REPLACE FUNCTION public.leads_row_passes(r public.leads_row, p_checked jsonb, p_time_zone text)
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
      WHEN 'labels' THEN public.workspace_filter_match_choices(r.labels, f)
    END, false)
  )
$$;

-- ---------- 3. The rows, each with its labels ----------
CREATE OR REPLACE FUNCTION public.leads_rows(p_firm_id uuid, p_search text DEFAULT NULL)
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
    GREATEST(l.created_at, act.at),
    COALESCE(lab.names, '{}')
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
  -- The firm's own words on the lead, in the order the accounts table lists an account's.
  LEFT JOIN LATERAL (
    SELECT array_agg(b.name ORDER BY lower(b.name), b.name) AS names
    FROM public.lead_labels ll JOIN public.labels b ON b.id = ll.label_id
    WHERE ll.lead_id = l.id
  ) lab ON true
  WHERE l.firm_id = p_firm_id
    AND l.deleted_at IS NULL
    AND (l.owner_id = ANY (seen_owners) OR (l.owner_id IS NULL AND seen_unowned))
    AND NOT EXISTS (
      SELECT 1 FROM unnest(terms) AS w (term)
      WHERE strpos(lower(concat_ws(E'\n', l.name, l.business, l.email, l.phone)), w.term) = 0
    );
END;
$$;

-- ---------- 4. The page, sorted by label when asked ----------
CREATE OR REPLACE FUNCTION public.leads_list(
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
        WHEN 'labels' THEN lower(array_to_string((m.r).labels, ', ') COLLATE "und-x-icu")
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
