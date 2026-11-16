-- The quotes table's query in the database (story CRM-Q4.1, slice 5.11; docs/BROKER_CRM_BUILD.md D-1702, D-1705, D-1800 to D-1809;
-- 20261121110500_leads_table_query.sql, whose shape this follows; supabase/tests/quotes_query.sql).

-- ---------- 1. One row of the table ----------
CREATE TYPE public.quotes_row AS (
  key text,
  quote_request_id bigint,
  opportunity_id uuid,
  account_id uuid,
  account_name text,
  opportunity_name text,
  target_start date,
  peo text,
  status text,
  sent_on date,
  sent_version integer,
  admin_fee_pepm numeric,
  expires_on date,
  proposed_start date,
  file_id text,
  owner uuid,
  owner_name text,
  new_mail boolean,
  emails integer,
  last_message_at timestamptz
);

-- Every quote request of the firm's opportunities, one row for each PEO of each opportunity, and every opportunity left half done: one with an intake and no quote
-- request (D-1702: worked out here, never stored; "Not sent" is no status), unless it is Won or Lost, which are finished, or its account is archived. A half-done
-- one reads status 'not_sent' with no PEO and no quote request.
-- Reads as its owner, so who may see a row is decided here: a quote and its opportunity are seen by whoever may see their account (the level rule, can_see_firm_record
-- on the account's owner, which search and the opportunity page read the same way), asked once for each owner the firm's accounts have.
CREATE FUNCTION public.quotes_rows(p_firm_id uuid, p_search text DEFAULT NULL)
RETURNS SETOF public.quotes_row
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  seen_owners uuid[];
  seen_unowned boolean;
  with_mail bigint[];
  terms text[] := ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '');
BEGIN
  SELECT COALESCE(array_agg(o.owner_id) FILTER (WHERE o.owner_id IS NOT NULL), '{}'), COALESCE(bool_or(o.owner_id IS NULL), false)
  INTO seen_owners, seen_unowned
  FROM (SELECT DISTINCT x.owner_id FROM public.accounts x WHERE x.firm_id = p_firm_id OFFSET 0) o
  WHERE public.can_see_firm_record(p_firm_id, o.owner_id);
  -- New mail: mail a person at the PEO wrote after any advisor last opened the thread (the one rule the menu's Inbox count and the queue use).
  SELECT COALESCE(array_agg(n.quote_request_id), '{}') INTO with_mail FROM public.quote_requests_with_new_peo_mail() n;

  RETURN QUERY
  SELECT (ROW(
    'q' || q.id, q.id, o.id, a.id, a.name, o.name, o.target_start, q.peo_name, q.status, q.sent_on, q.sent_version, q.admin_fee_pepm, q.quote_expires_on,
    q.proposed_start_on, s.file_id, mem.user_id, mem.name,
    q.id = ANY (with_mail), msg.n, msg.last_at
  )::public.quotes_row).*
  FROM public.quote_requests q
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS n, max(x.recorded_at) AS last_at FROM public.quote_request_messages x WHERE x.quote_request_id = q.id
  ) msg ON true
  JOIN public.opportunities o ON o.intake_id = q.session_id AND o.firm_id = p_firm_id
  JOIN public.accounts a ON a.id = o.account_id AND a.firm_id = p_firm_id
  LEFT JOIN public.chamber_sessions s ON s.id = q.session_id
  LEFT JOIN LATERAL (
    SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text) AS name
    FROM public.firm_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = p_firm_id AND m.user_id = o.owner_id AND public.membership_is_current(m.valid_from, m.valid_until)
    LIMIT 1
  ) mem ON true
  WHERE (a.owner_id = ANY (seen_owners) OR (a.owner_id IS NULL AND seen_unowned))
    AND NOT EXISTS (SELECT 1 FROM unnest(terms) AS w (term) WHERE strpos(lower(concat_ws(E'\n', a.name, q.peo_name, s.file_id)), w.term) = 0)
  UNION ALL
  SELECT (ROW(
    'o' || o.id, NULL, o.id, a.id, a.name, o.name, o.target_start, NULL, 'not_sent', NULL, NULL, NULL, NULL,
    NULL, s.file_id, mem.user_id, mem.name,
    false, 0, NULL
  )::public.quotes_row).*
  FROM public.opportunities o
  JOIN public.accounts a ON a.id = o.account_id AND a.firm_id = p_firm_id
  LEFT JOIN public.chamber_sessions s ON s.id = o.intake_id
  LEFT JOIN LATERAL (
    SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text) AS name
    FROM public.firm_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = p_firm_id AND m.user_id = o.owner_id AND public.membership_is_current(m.valid_from, m.valid_until)
    LIMIT 1
  ) mem ON true
  WHERE o.firm_id = p_firm_id AND o.intake_id IS NOT NULL AND a.archived_at IS NULL
    AND (a.owner_id = ANY (seen_owners) OR (a.owner_id IS NULL AND seen_unowned))
    AND NOT EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.session_id = o.intake_id)
    AND NOT EXISTS (SELECT 1 FROM unnest(terms) AS w (term) WHERE strpos(lower(concat_ws(E'\n', a.name, s.file_id)), w.term) = 0)
    AND public.opportunity_stage(o.id) NOT IN ('won', 'lost');
END;
$$;

-- ---------- 1b. The table's fields ----------
-- The fields a filter or a sort may name, and the kind of each. Nothing else is a field (src/lib/quotesApi.ts holds the same list; src/lib/quotesApi.test.ts compares them).
CREATE FUNCTION public.quotes_field_kind(p_field text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    -- sync:begin quotes_fields
    WHEN 'account_name' THEN 'text'
    WHEN 'opportunity_name' THEN 'text'
    WHEN 'peo' THEN 'text'
    WHEN 'file_id' THEN 'text'
    WHEN 'admin_fee_pepm' THEN 'number'
    WHEN 'sent_version' THEN 'number'
    WHEN 'days_waiting' THEN 'number'
    WHEN 'emails' THEN 'number'
    WHEN 'sent_on' THEN 'date'
    WHEN 'expires_on' THEN 'date'
    WHEN 'proposed_start' THEN 'date'
    WHEN 'target_start' THEN 'date'
    WHEN 'status' THEN 'choice'
    WHEN 'owner' THEN 'person'
    WHEN 'new_mail' THEN 'yes_no'
    -- sync:end quotes_fields
  END
$$;

-- The values a choice field holds, in the order it sorts by.
CREATE FUNCTION public.quotes_field_choices(p_field text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    WHEN 'status' THEN ARRAY[
      -- sync:begin quotes_statuses
      'not_sent', 'sent', 'acknowledged', 'question_open', 'quoted', 'declined', 'closed'
      -- sync:end quotes_statuses
    ]
  END
$$;

-- The filters of one call, checked, as leads_filters_checked checks the leads': at most 20, each on a listed field, each read by workspace_filter_check. Reads no quote.
CREATE FUNCTION public.quotes_filters_checked(p_firm_id uuid, p_filters jsonb, p_today date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  f jsonb;
  field text;
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
    IF public.quotes_field_kind(field) IS NULL THEN
      RAISE EXCEPTION 'The quotes table has no field "%" to filter by', left(field, 64) USING ERRCODE = '22023';
    END IF;
    checked := public.workspace_filter_check(public.quotes_field_kind(field), f, public.quotes_field_choices(field), p_today);
    -- "Me" and "my team" are worked out into the people they are (as the accounts' and leads' tables do).
    IF public.quotes_field_kind(field) = 'person' AND checked ->> 'op' = 'me' THEN
      checked := jsonb_build_object('op', 'any_of', 'vs', jsonb_build_array(auth.uid()::text));
    ELSIF public.quotes_field_kind(field) = 'person' AND checked ->> 'op' = 'my_team' THEN
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

-- Whether one row passes every checked filter ("and").
CREATE FUNCTION public.quotes_row_passes(r public.quotes_row, p_checked jsonb, p_time_zone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_checked) f
    WHERE NOT COALESCE(CASE f ->> 'field'
      WHEN 'account_name' THEN public.workspace_filter_match_text(r.account_name, f)
      WHEN 'opportunity_name' THEN public.workspace_filter_match_text(r.opportunity_name, f)
      WHEN 'peo' THEN public.workspace_filter_match_text(r.peo, f)
      WHEN 'file_id' THEN public.workspace_filter_match_text(r.file_id, f)
      WHEN 'status' THEN public.workspace_filter_match_choice(r.status, f)
      WHEN 'owner' THEN public.workspace_filter_match_person(r.owner, f)
      WHEN 'new_mail' THEN public.workspace_filter_match_yes_no(r.new_mail, f)
      WHEN 'days_waiting' THEN public.workspace_filter_match_number(
        CASE WHEN r.status IN ('sent', 'acknowledged', 'question_open') THEN (now() AT TIME ZONE p_time_zone)::date - r.sent_on END, f)
      WHEN 'admin_fee_pepm' THEN public.workspace_filter_match_number(r.admin_fee_pepm, f)
      WHEN 'sent_version' THEN public.workspace_filter_match_number(r.sent_version, f)
      WHEN 'emails' THEN public.workspace_filter_match_number(r.emails, f)
      WHEN 'proposed_start' THEN public.workspace_filter_match_date(r.proposed_start, f)
      WHEN 'target_start' THEN public.workspace_filter_match_date(r.target_start, f)
      WHEN 'sent_on' THEN public.workspace_filter_match_date(r.sent_on, f)
      WHEN 'expires_on' THEN public.workspace_filter_match_date(r.expires_on, f)
    END, false)
  )
$$;

-- One page of the quotes table: the rows the caller may see, sorted, 50 a page, with how many there are in all. Returns {"rows": [...], "total": n, "page": p, "page_size": 50}.
-- One firm at a time: the firm named, or (NULL) the caller's only firm at this address (firm_to_act_for).
--
-- No sort at all is "needs me first" (CRM-Q4.1; D-1705): new mail, then the soonest expiry of a quote (one that expired sorts first of them: nothing moves by itself),
-- then the longest wait of a quote request still open, the rest by account. A sort on a field is that field, either way, a blank last in both directions; equal values
-- go by the same order, so every row has one place.
CREATE FUNCTION public.quotes_list(
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
  checked := public.quotes_filters_checked(firm, p_filters, (now() AT TIME ZONE tz)::date);
  IF p_sort IS NOT NULL THEN
    IF public.quotes_field_kind(p_sort) IS NULL THEN
      RAISE EXCEPTION 'The quotes table has no field "%" to sort by', left(p_sort, 64) USING ERRCODE = '22023';
    END IF;
    choices := public.quotes_field_choices(p_sort);
  END IF;
  IF p_direction IS NULL OR p_direction NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'A sort goes asc or desc' USING ERRCODE = '22023';
  END IF;
  IF pg < 1 OR pg > 100000 THEN
    RAISE EXCEPTION 'A page number is 1 to 100000' USING ERRCODE = '22023';
  END IF;

  WITH matched AS MATERIALIZED (
    SELECT r FROM public.quotes_rows(firm, p_search) r WHERE public.quotes_row_passes(r, checked, tz)
  ),
  keyed AS (
    SELECT
      m.r,
      NULLIF(btrim(CASE p_sort
        WHEN 'account_name' THEN lower((m.r).account_name COLLATE "und-x-icu")
        WHEN 'opportunity_name' THEN lower((m.r).opportunity_name COLLATE "und-x-icu")
        WHEN 'peo' THEN lower((m.r).peo COLLATE "und-x-icu")
        WHEN 'file_id' THEN lower((m.r).file_id COLLATE "und-x-icu")
        WHEN 'owner' THEN lower((m.r).owner_name COLLATE "und-x-icu")
      END), '') AS k_text,
      CASE p_sort
        WHEN 'admin_fee_pepm' THEN (m.r).admin_fee_pepm
        WHEN 'sent_version' THEN (m.r).sent_version::numeric
        WHEN 'days_waiting' THEN CASE WHEN (m.r).status IN ('sent', 'acknowledged', 'question_open')
          THEN (now() AT TIME ZONE tz)::date - (m.r).sent_on END
        WHEN 'status' THEN COALESCE(array_position(choices, (m.r).status), cardinality(choices) + 1)
      END AS k_number,
      CASE p_sort
        WHEN 'sent_on' THEN (m.r).sent_on
        WHEN 'expires_on' THEN (m.r).expires_on
        WHEN 'proposed_start' THEN (m.r).proposed_start
        WHEN 'target_start' THEN (m.r).target_start
      END AS k_day
    FROM matched m
  ),
  ordered AS (
    SELECT k.r, row_number() OVER (ORDER BY
      (p_sort IS NOT NULL AND k.k_text IS NULL AND k.k_number IS NULL AND k.k_day IS NULL),
      CASE WHEN p_direction = 'asc' THEN k.k_text END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_text END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_number END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_number END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_day END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_day END DESC,
      NOT (k.r).new_mail,
      CASE WHEN (k.r).status = 'quoted' THEN (k.r).expires_on END NULLS LAST,
      CASE WHEN (k.r).status IN ('sent', 'acknowledged', 'question_open') THEN (k.r).sent_on END NULLS LAST,
      lower((k.r).account_name), (k.r).key
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

-- The count for each view's tab: `p_views` is a list of {"name": text, "filters": [...]}, at most 20, names unique; one row per view in the order given, each counting
-- what quotes_list would total for those filters and the search, for the same firm and person. One refused filter refuses the call, naming the view.
CREATE FUNCTION public.quotes_view_counts(p_firm_id uuid, p_views jsonb, p_search text DEFAULT NULL, p_time_zone text DEFAULT 'UTC')
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
      sets := sets || public.quotes_filters_checked(firm, COALESCE(v -> 'filters', '[]'::jsonb), today);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'View "%": %', v ->> 'name', SQLERRM USING ERRCODE = SQLSTATE;
    END;
    names := names || (v ->> 'name');
  END LOOP;

  RETURN QUERY
  WITH visible AS MATERIALIZED (
    SELECT r FROM public.quotes_rows(firm, p_search) r
  )
  SELECT w.name, (SELECT count(*) FROM visible x WHERE public.quotes_row_passes(x.r, w.filters, tz))
  FROM unnest(names, sets) WITH ORDINALITY AS w(name, filters, ord)
  ORDER BY w.ord;
END;
$$;

REVOKE ALL ON FUNCTION public.quotes_view_counts(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quotes_view_counts(uuid, jsonb, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.quotes_filters_checked(uuid, jsonb, date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.quotes_row_passes(public.quotes_row, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.quotes_field_kind(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.quotes_field_choices(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.quotes_rows(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.quotes_list(uuid, jsonb, text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quotes_list(uuid, jsonb, text, text, integer, text, text) TO authenticated;

-- ---------- 3. Saved views and column choices ----------
-- The quotes table keeps them as the queue, the accounts and the leads do (CRM-S3.1, CRM-S3.4); the newest list (20261121110500) with `quotes`.
ALTER DOMAIN public.workspace_table DROP CONSTRAINT workspace_table_known;
ALTER DOMAIN public.workspace_table ADD CONSTRAINT workspace_table_known CHECK (VALUE IN ('submissions', 'accounts', 'leads', 'quotes'));

-- Why a change to this opportunity's quotes is not made, as {code, reason}, or NULL when it may be: the level rule on the opportunity's owner, an archived account (D-432:
-- nothing on it changes) or an opportunity won or lost (finished). Asked of the opportunity held. Internal.
CREATE FUNCTION public.quotes_bulk_blocked(o public.opportunities)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.can_change_firm_record(o.firm_id, o.owner_id) THEN
    RETURN jsonb_build_object('code', 'level', 'reason', public.opportunity_change_words(o.owner_id));
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = o.account_id AND a.archived_at IS NOT NULL) THEN
    RETURN jsonb_build_object('code', 'archived', 'reason', 'This account is archived. Nothing on it can be changed.');
  END IF;
  IF public.opportunity_stage(o.id) IN ('won', 'lost') THEN
    RETURN jsonb_build_object('code', 'finished', 'reason', 'The opportunity is won or lost, so it is read, not changed.');
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.quotes_bulk_blocked(public.opportunities) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. Bulk actions (CRM-Q4.1: change owner, close; export is the export's) ----------
-- What a bulk change of quotes does, and nothing more: the opportunity's owner, or closing quote requests with one reason. A quote's status, figures and dates are
-- recorded on its own quote, never in bulk (CRM-Q4.1). The rows are chosen by their keys (`ids`) or as "all that match" (`filters`, the table's own).
-- Answers {action, selected, requested, unavailable, changed, unchanged, skipped: [{key, name, code, reason}]}: `requested` is how many different keys were named, `selected`
-- how many of them are rows the caller may see, `unavailable` the difference (another firm's, another agent's, made up); `skipped` the rows the caller may see and not change.
-- Owner: params {owner_id}; changes the opportunity of each row, once however many of its rows are chosen. Close: params {reason} (one of M-2.4's four); closes each chosen
-- quote request with it and stops its link, telling no PEO (a withdrawal that writes to them is the opportunity's own); a row never sent has nothing to close.
CREATE FUNCTION public.bulk_quotes_change(p_firm_id uuid, p_action text, p_params jsonb DEFAULT '{}'::jsonb, p_filters jsonb DEFAULT NULL, p_ids jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  firm uuid;
  new_owner uuid;
  reason text;
  tz text;
  checked jsonb;
  r public.quotes_row;
  o public.opportunities;
  q public.quote_requests;
  requested integer;
  n_selected integer := 0;
  n_changed integer := 0;
  n_same integer := 0;
  skipped jsonb := '[]'::jsonb;
  done_opps uuid[] := '{}';
  why jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_action IS NULL OR p_action NOT IN ('owner', 'close') THEN
    RAISE EXCEPTION 'Choose what to change: the owner, or close.' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'owner' THEN
    IF jsonb_typeof(p_params -> 'owner_id') IS DISTINCT FROM 'string'
       OR (p_params ->> 'owner_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Choose who will own these quotes.' USING ERRCODE = '22023';
    END IF;
    new_owner := (p_params ->> 'owner_id')::uuid;
  ELSE
    reason := p_params ->> 'reason';
    IF reason IS NULL OR reason NOT IN ('employer_went_elsewhere', 'prospect_withdrew_peo', 'peo_not_a_fit', 'other') THEN
      RAISE EXCEPTION 'Choose why: the employer went elsewhere, the prospect withdrew this PEO, the PEO is not a fit, or other.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_filters IS NOT NULL AND p_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Choose the quotes by their keys or by the table''s filters, not both.' USING ERRCODE = '22023';
  END IF;
  IF p_filters IS NULL AND p_ids IS NULL THEN
    RAISE EXCEPTION 'Choose the quotes to change.' USING ERRCODE = '22023';
  END IF;
  IF p_ids IS NOT NULL THEN
    IF jsonb_typeof(p_ids) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_ids) e WHERE jsonb_typeof(e) <> 'string') THEN
      RAISE EXCEPTION 'Name the quotes as a list of keys.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_ids) = 0 THEN
      RAISE EXCEPTION 'Choose at least one quote.' USING ERRCODE = '22023';
    END IF;
    -- Cut before anything is looked up: a list of a million keys costs one length.
    IF jsonb_array_length(p_ids) > 1000 THEN
      RAISE EXCEPTION 'That is % quotes. A bulk change takes at most 1,000: narrow the selection and try again.', jsonb_array_length(p_ids) USING ERRCODE = 'PT413';
    END IF;
    SELECT count(DISTINCT k) INTO requested FROM jsonb_array_elements_text(p_ids) k;
  ELSE
    IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_filters) k WHERE k NOT IN ('filters', 'search', 'time_zone'))
       OR (p_filters ? 'search' AND jsonb_typeof(p_filters -> 'search') IS DISTINCT FROM 'string')
       OR (p_filters ? 'time_zone' AND jsonb_typeof(p_filters -> 'time_zone') IS DISTINCT FROM 'string')
       OR (p_filters ? 'filters' AND jsonb_typeof(p_filters -> 'filters') IS DISTINCT FROM 'array') THEN
      RAISE EXCEPTION 'Those filters don''t apply to this table' USING ERRCODE = '22023';
    END IF;
    -- "All that match": the table's own filters, search and time zone, matched by the table's own query.
    tz := public.workspace_time_zone(p_filters ->> 'time_zone');
    checked := public.quotes_filters_checked(firm, COALESCE(p_filters -> 'filters', '[]'::jsonb), (now() AT TIME ZONE tz)::date);
  END IF;
  IF p_action = 'owner' THEN
    PERFORM public.member_to_own(firm, new_owner);
  END IF;
  FOR r IN
    SELECT x.* FROM public.quotes_rows(firm, CASE WHEN p_ids IS NULL THEN p_filters ->> 'search' END) x
    WHERE CASE WHEN p_ids IS NOT NULL THEN x.key IN (SELECT jsonb_array_elements_text(p_ids)) ELSE public.quotes_row_passes(x, checked, tz) END
    ORDER BY x.opportunity_id, x.key
  LOOP
    n_selected := n_selected + 1;
    IF p_action = 'owner' THEN
      IF r.opportunity_id = ANY (done_opps) THEN
        CONTINUE;
      END IF;
      done_opps := done_opps || r.opportunity_id;
      SELECT * INTO o FROM public.opportunities x WHERE x.id = r.opportunity_id FOR NO KEY UPDATE;
      why := public.quotes_bulk_blocked(o);
      IF why IS NOT NULL THEN
        skipped := skipped || (jsonb_build_object('key', r.key, 'name', r.account_name) || why);
      ELSIF o.owner_id IS NOT DISTINCT FROM new_owner THEN
        n_same := n_same + 1;
      ELSE
        UPDATE public.opportunities SET owner_id = new_owner WHERE id = o.id;
        n_changed := n_changed + 1;
      END IF;
    ELSE
      IF r.quote_request_id IS NULL THEN
        skipped := skipped || jsonb_build_object('key', r.key, 'name', r.account_name, 'code', 'not_sent', 'reason', 'Nothing was sent for it yet, so there is nothing to close.');
        CONTINUE;
      END IF;
      SELECT * INTO o FROM public.opportunities x WHERE x.id = r.opportunity_id FOR NO KEY UPDATE;
      why := public.quotes_bulk_blocked(o);
      IF why IS NOT NULL THEN
        skipped := skipped || (jsonb_build_object('key', r.key, 'name', r.account_name) || why);
        CONTINUE;
      END IF;
      SELECT * INTO q FROM public.quote_requests x WHERE x.id = r.quote_request_id FOR NO KEY UPDATE;
      IF q.status = 'closed' THEN
        n_same := n_same + 1;
      ELSE
        UPDATE public.quote_requests SET status = 'closed', withdrawn_reason = reason WHERE id = q.id;
        PERFORM public.bundle_link_revoke(q.id, 'withdrawn');
        n_changed := n_changed + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('action', p_action, 'selected', n_selected, 'requested', requested, 'unavailable', GREATEST(COALESCE(requested, 0) - n_selected, 0),
    'changed', n_changed, 'unchanged', n_same, 'skipped', skipped);
END;
$$;

-- The words that refuse a change to an opportunity the level rule does not give the caller (opportunity_to_change says the same). Internal.
CREATE FUNCTION public.opportunity_change_words(p_owner_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_owner_id IS NULL
    THEN 'An opportunity with no owner can only be changed by an owner of the firm.'
    ELSE 'Only the opportunity''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
$$;

REVOKE ALL ON FUNCTION public.opportunity_change_words(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bulk_quotes_change(uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_quotes_change(uuid, text, jsonb, jsonb, jsonb) TO authenticated;

-- ---------- 5. Export (CRM-Q4.1: export is the existing export's, through its registry) ----------
-- What can be exported (20261122210000, the newest definition, with its four lines), restated with the fifth: the quotes, for any current member (the reader applies the
-- level rule itself). The columns are the table's, in the order a file shows them.
CREATE OR REPLACE FUNCTION public.export_table_registry()
RETURNS TABLE (name text, label text, who text, columns jsonb)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    ('referral_partners', 'Referral partners', 'member',
     '[{"id":"code","label":"Code"},{"id":"name","label":"Name"},{"id":"kind","label":"Kind"},{"id":"started_30d","label":"Started, 30 days"},{"id":"certified_30d","label":"Certified, 30 days"},{"id":"created_at","label":"Added"},{"id":"updated_at","label":"Last changed"}]'::jsonb),
    ('firm_activity', 'The firm''s record', 'owner',
     '[{"id":"at","label":"When"},{"id":"who","label":"Who"},{"id":"kind","label":"What"},{"id":"record_type","label":"Record type"},{"id":"record_id","label":"Record"},{"id":"subject","label":"About"},{"id":"role","label":"Role"},{"id":"row_count","label":"Rows"}]'::jsonb),
    ('accounts', 'Accounts', 'member',
     '[{"id":"name","label":"Account"},{"id":"trade_name","label":"Trade name"},{"id":"website","label":"Website"},{"id":"city","label":"City"},{"id":"state","label":"State"},{"id":"employees","label":"Employees"},{"id":"industry","label":"Industry"},{"id":"states_of_operation","label":"States of operation"},{"id":"current_provider","label":"Current provider"},{"id":"source","label":"Source"},{"id":"status","label":"Status"},{"id":"owner","label":"Owner"},{"id":"main_contact","label":"Main contact"},{"id":"main_contact_email","label":"Main contact email"},{"id":"main_contact_phone","label":"Main contact phone"},{"id":"opportunity","label":"Opportunity"},{"id":"opportunity_stage","label":"Opportunity stage"},{"id":"target_start","label":"Target start"},{"id":"open_opportunities","label":"Open opportunities"},{"id":"quote_requests_sent","label":"Quotes asked for"},{"id":"quotes_received","label":"Quotes back"},{"id":"earliest_quote_expires_on","label":"Nearest quote expiry"},{"id":"renewal_date","label":"Renewal date"},{"id":"last_activity_at","label":"Last activity"},{"id":"created_at","label":"Created"},{"id":"archived","label":"Archived"}]'::jsonb),
    ('leads', 'Leads', 'member',
     '[{"id":"name","label":"Lead"},{"id":"title","label":"Title"},{"id":"business","label":"Business"},{"id":"email","label":"Email"},{"id":"phone","label":"Phone"},{"id":"city","label":"City"},{"id":"state","label":"State"},{"id":"employees","label":"Employees"},{"id":"current_provider","label":"Current provider"},{"id":"status","label":"Status"},{"id":"not_fit_reason","label":"Not a fit because"},{"id":"source","label":"Source"},{"id":"owner","label":"Owner"},{"id":"last_activity_at","label":"Last activity"},{"id":"created_at","label":"Created"}]'::jsonb),
    ('quotes', 'Quotes', 'member',
     '[{"id":"account","label":"Account"},{"id":"opportunity","label":"Opportunity"},{"id":"peo","label":"PEO"},{"id":"status","label":"Status"},{"id":"sent_on","label":"Sent"},{"id":"sent_version","label":"Version sent"},{"id":"admin_fee_pepm","label":"Admin fee"},{"id":"expires_on","label":"Expires"},{"id":"proposed_start","label":"Proposed start"},{"id":"target_start","label":"Target start"},{"id":"emails","label":"Emails"},{"id":"new_mail","label":"New mail"},{"id":"last_message_at","label":"Last message"},{"id":"file_id","label":"File ID"},{"id":"owner","label":"Owner"}]'::jsonb)
  ) t (name, label, who, columns)
$$;

REVOKE ALL ON FUNCTION public.export_table_registry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_table_registry() TO service_role;

-- A quote's codes in the words a person reads (src/data/quoteRequests.ts and src/data/quotes.ts say the same). Internal.
CREATE FUNCTION public.quotes_words(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_code WHEN 'not_sent' THEN 'Not sent yet' WHEN 'sent' THEN 'Sent' WHEN 'acknowledged' THEN 'Acknowledged' WHEN 'question_open' THEN 'Question open'
    WHEN 'quoted' THEN 'Quoted' WHEN 'declined' THEN 'Declined' WHEN 'closed' THEN 'Closed' END
$$;

REVOKE ALL ON FUNCTION public.quotes_words(text) FROM PUBLIC, anon, authenticated, service_role;

-- The quotes' reader, run by export_rows after its checks: the table's own rows (quotes_rows: those the caller may see by level), in the table's own order, no column the
-- table does not list. Filters: an object of `filters` (the table's own), `search` and `time_zone`, each optional; a key it does not have is refused, so a typo never exports
-- everything. A selection by keys is the rows among them the caller may see.
CREATE FUNCTION public.export_source_quotes(p_firm_id uuid, p_filters jsonb, p_ids jsonb, p_limit integer)
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  tz text;
  checked jsonb;
BEGIN
  IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_filters) k WHERE k NOT IN ('filters', 'search', 'time_zone'))
     OR (p_filters ? 'search' AND jsonb_typeof(p_filters -> 'search') IS DISTINCT FROM 'string')
     OR (p_filters ? 'time_zone' AND jsonb_typeof(p_filters -> 'time_zone') IS DISTINCT FROM 'string')
     OR (p_filters ? 'filters' AND jsonb_typeof(p_filters -> 'filters') IS DISTINCT FROM 'array') THEN
    RAISE EXCEPTION 'Those filters don''t apply to this table' USING ERRCODE = '22023';
  END IF;
  tz := public.workspace_time_zone(p_filters ->> 'time_zone');
  checked := public.quotes_filters_checked(p_firm_id, COALESCE(p_filters -> 'filters', '[]'::jsonb), (now() AT TIME ZONE tz)::date);
  RETURN QUERY
    SELECT jsonb_build_object(
      'account', r.account_name, 'opportunity', r.opportunity_name, 'peo', r.peo, 'status', public.quotes_words(r.status), 'sent_on', r.sent_on,
      'sent_version', r.sent_version, 'admin_fee_pepm', r.admin_fee_pepm, 'expires_on', r.expires_on, 'proposed_start', r.proposed_start, 'target_start', r.target_start,
      'emails', r.emails, 'new_mail', r.new_mail, 'last_message_at', r.last_message_at, 'file_id', r.file_id, 'owner', r.owner_name)
    FROM public.quotes_rows(p_firm_id, CASE WHEN p_ids IS NULL THEN p_filters ->> 'search' END) r
    WHERE true
    ORDER BY NOT r.new_mail,
      CASE WHEN r.status = 'quoted' THEN r.expires_on END NULLS LAST,
      CASE WHEN r.status IN ('sent', 'acknowledged', 'question_open') THEN r.sent_on END NULLS LAST,
      lower(r.account_name), r.key
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.export_source_quotes(uuid, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;
