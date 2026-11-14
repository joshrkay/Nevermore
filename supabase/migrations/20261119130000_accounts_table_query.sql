-- The accounts table's query in the database (story CRM-A1.1b; docs/BROKER_CRM_BUILD.md D-24, D-43, D-44, D-49, D-135 to D-173, D-185 to D-221;
-- GLOSSARY.md "The broker's CRM"; 20261117100000_queue_query.sql, 20261117100500_queue_query_fast_path.sql, 20261118150000_queue_sort_collation.sql,
-- 20261119090000_export.sql, 20261119100000_crm_records.sql).
--
-- Everything the Accounts page needs from the database, so the page only draws it (CRM-A1.1a):
--   1. person filters, for any table: workspace_filter_check takes the person kind (any of, me, my team) and workspace_filter_match_person decides one
--      owner against one checked filter (D-173);
--   2. who the firm's current members are, by name, for the Owner filter's choices (firm_member_choices);
--   3. the accounts table: its fields, one row of the table with its worked-out columns (accounts_rows), the page and the views' counts
--      (accounts_list, accounts_view_counts), search, sort, 50 a page, the caller's visibility, one firm at a time;
--   4. last activity, in one place the later stories extend (account_activity_times, D-201);
--   5. `accounts` joins the saved views and column choices (the domain workspace_table) and Epic 3's export (export_table_registry and
--      export_source_accounts, D-218).
--
-- As the queue's query does it, no SQL is built from what the caller sends (D-44): no EXECUTE, no format(); a field's name chooses a branch of a fixed CASE.

SET lock_timeout = '5s';

-- ---------- 1. Person filters ----------

-- One filter, read for a field of `p_kind` (20261117100000), restated with every rule it had; the only change is the person kind, which was refused (0A000)
-- until records had an owner.
CREATE OR REPLACE FUNCTION public.workspace_filter_check(p_kind text, p_filter jsonb, p_choices text[] DEFAULT NULL, p_today date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  field text;
  op text;
  v jsonb;
  label text;
  d1 date;
  d2 date;
  n1 numeric;
  n2 numeric;
  item jsonb;
  vs text[] := '{}';
BEGIN
  IF p_filter IS NULL OR jsonb_typeof(p_filter) <> 'object' THEN
    RAISE EXCEPTION 'A filter is an object with a field, an operator and a value' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_filter) k WHERE k NOT IN ('field', 'op', 'value')) THEN
    RAISE EXCEPTION 'A filter holds a field, an operator and a value, nothing else' USING ERRCODE = '22023';
  END IF;
  field := left(p_filter ->> 'field', 64);
  IF jsonb_typeof(p_filter -> 'op') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'The filter on % names no operator', field USING ERRCODE = '22023';
  END IF;
  op := p_filter ->> 'op';
  label := field || ' ' || left(op, 32);
  v := NULLIF(p_filter -> 'value', 'null'::jsonb);

  -- The operators that take no value.
  IF (p_kind IN ('text', 'choice', 'choices') AND op = 'is_empty') OR (p_kind = 'person' AND op IN ('me', 'my_team')) THEN
    IF v IS NOT NULL THEN
      RAISE EXCEPTION 'The filter "%" takes no value', label USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_kind = 'text' THEN
    IF op = 'is_empty' THEN
      RETURN jsonb_build_object('op', op);
    ELSIF op IN ('contains', 'is') THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'string' OR btrim(v #>> '{}') = '' THEN
        RAISE EXCEPTION 'The filter "%" needs some text (for no value, use is_empty)', label USING ERRCODE = '22023';
      END IF;
      IF char_length(v #>> '{}') > 200 THEN
        RAISE EXCEPTION 'The filter "%" takes at most 200 characters', label USING ERRCODE = '22023';
      END IF;
      RETURN jsonb_build_object('op', op, 'v', lower(btrim(v #>> '{}')));
    END IF;

  ELSIF p_kind = 'number' THEN
    IF op IN ('is', 'more_than', 'less_than') THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'The filter "%" needs a number', label USING ERRCODE = '22023';
      END IF;
      RETURN jsonb_build_object('op', op, 'v', v);
    ELSIF op = 'between' THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v) <> 2
         OR jsonb_typeof(v -> 0) <> 'number' OR jsonb_typeof(v -> 1) <> 'number' THEN
        RAISE EXCEPTION 'The filter "%" needs two numbers', label USING ERRCODE = '22023';
      END IF;
      n1 := (v ->> 0)::numeric;
      n2 := (v ->> 1)::numeric;
      RETURN jsonb_build_object('op', op, 'lo', LEAST(n1, n2), 'hi', GREATEST(n1, n2));
    END IF;

  ELSIF p_kind = 'date' THEN
    -- Every date operator becomes the days it keeps, both ends included; an open end is null.
    IF op IN ('on', 'before', 'after') THEN
      d1 := public.workspace_filter_day(v, label);
      RETURN jsonb_build_object('op', 'days',
        'lo', CASE op WHEN 'on' THEN d1 WHEN 'after' THEN d1 + 1 END,
        'hi', CASE op WHEN 'on' THEN d1 WHEN 'before' THEN d1 - 1 END);
    ELSIF op = 'between' THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v) <> 2 THEN
        RAISE EXCEPTION 'The filter "%" needs two days (YYYY-MM-DD)', label USING ERRCODE = '22023';
      END IF;
      d1 := public.workspace_filter_day(v -> 0, label);
      d2 := public.workspace_filter_day(v -> 1, label);
      RETURN jsonb_build_object('op', 'days', 'lo', LEAST(d1, d2), 'hi', GREATEST(d1, d2));
    ELSIF op IN ('in_next_days', 'in_last_days') THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'number' OR (v #>> '{}')::numeric NOT BETWEEN 0 AND 3660
         OR (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) THEN
        RAISE EXCEPTION 'The filter "%" needs a whole number of days, 0 to 3660', label USING ERRCODE = '22023';
      END IF;
      IF p_today IS NULL THEN
        RAISE EXCEPTION 'The filter "%" needs to know what day it is', label USING ERRCODE = '22023';
      END IF;
      n1 := (v #>> '{}')::numeric;
      RETURN jsonb_build_object('op', 'days',
        'lo', CASE op WHEN 'in_next_days' THEN p_today ELSE p_today - n1::integer END,
        'hi', CASE op WHEN 'in_next_days' THEN p_today + n1::integer ELSE p_today END);
    END IF;

  ELSIF p_kind IN ('choice', 'choices') THEN
    IF op = 'is_empty' THEN
      RETURN jsonb_build_object('op', op);
    ELSIF op IN ('any_of', 'none_of') THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'The filter "%" needs a list of values', label USING ERRCODE = '22023';
      END IF;
      -- An empty list would keep nothing (any_of) or everything (none_of): neither is a filter anyone chose.
      IF jsonb_array_length(v) = 0 OR jsonb_array_length(v) > 100 THEN
        RAISE EXCEPTION 'The filter "%" needs 1 to 100 values', label USING ERRCODE = '22023';
      END IF;
      FOR item IN SELECT e FROM jsonb_array_elements(v) e LOOP
        IF jsonb_typeof(item) <> 'string' OR btrim(item #>> '{}') = '' OR char_length(item #>> '{}') > 200 THEN
          RAISE EXCEPTION 'The filter "%" takes values of 1 to 200 characters', label USING ERRCODE = '22023';
        END IF;
        IF p_choices IS NOT NULL AND NOT lower(btrim(item #>> '{}')) = ANY (SELECT lower(c) FROM unnest(p_choices) c) THEN
          RAISE EXCEPTION 'The filter "%" can''t match "%": it isn''t one of the field''s values', label, left(item #>> '{}', 64)
            USING ERRCODE = '22023';
        END IF;
        vs := vs || lower(btrim(item #>> '{}'));
      END LOOP;
      RETURN jsonb_build_object('op', op, 'vs', to_jsonb(ARRAY(SELECT DISTINCT x FROM unnest(vs) x ORDER BY x)));
    END IF;

  ELSIF p_kind = 'yes_no' THEN
    IF op = 'is' THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'The filter "%" needs true or false', label USING ERRCODE = '22023';
      END IF;
      RETURN jsonb_build_object('op', op, 'v', v);
    END IF;

  ELSIF p_kind = 'person' THEN
    -- Me and my team are the caller's: a filter read here alone can't know who that is, so it comes back as it is and the table's query works the
    -- people out once per call (accounts_filters_checked). Any of is a list of people by their id (the id the table lists them under).
    IF op IN ('me', 'my_team') THEN
      RETURN jsonb_build_object('op', op);
    ELSIF op = 'any_of' THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'The filter "%" needs a list of people', label USING ERRCODE = '22023';
      END IF;
      IF jsonb_array_length(v) = 0 OR jsonb_array_length(v) > 100 THEN
        RAISE EXCEPTION 'The filter "%" needs 1 to 100 people', label USING ERRCODE = '22023';
      END IF;
      FOR item IN SELECT e FROM jsonb_array_elements(v) e LOOP
        IF jsonb_typeof(item) <> 'string' OR (item #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          RAISE EXCEPTION 'The filter "%" takes people by their id', label USING ERRCODE = '22023';
        END IF;
        vs := vs || lower(item #>> '{}');
      END LOOP;
      RETURN jsonb_build_object('op', op, 'vs', to_jsonb(ARRAY(SELECT DISTINCT x FROM unnest(vs) x ORDER BY x)));
    END IF;

  ELSE
    RAISE EXCEPTION 'No field is of the kind %', left(p_kind, 32) USING ERRCODE = '22023';
  END IF;

  RAISE EXCEPTION 'A % field can''t be filtered with "%"', p_kind, left(op, 32) USING ERRCODE = '22023';
END;
$$;

-- One owner against one checked filter. `p_checked` is what workspace_filter_check returned, with me and my team already worked out into any_of by the
-- table's query: an unresolved or unknown filter matches nothing, and so does a row with no owner. Never raises.
CREATE FUNCTION public.workspace_filter_match_person(p_value uuid, p_checked jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(CASE p_checked ->> 'op'
    WHEN 'any_of' THEN p_value::text IN (SELECT jsonb_array_elements_text(p_checked -> 'vs'))
  END, false)
$$;

REVOKE ALL ON FUNCTION public.workspace_filter_match_person(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The firm's members, by name ----------

-- A person's name as the workspace shows it (D-42): the name in their sign-up, else their email. Pure of the caller; internal.
CREATE FUNCTION public.person_display_name(p_meta jsonb, p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(btrim(CASE WHEN jsonb_typeof(p_meta -> 'full_name') = 'string' THEN p_meta ->> 'full_name' END), ''),
    NULLIF(btrim(CASE WHEN jsonb_typeof(p_meta -> 'name') = 'string' THEN p_meta ->> 'name' END), ''),
    p_email)
$$;

REVOKE ALL ON FUNCTION public.person_display_name(jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

-- The firm's current members, each by id and name, for the Owner filter's choices and the owner pickers (D-173): to a current member of the firm
-- (or Nevermore support at its address, which reads what a member reads, ADR 0024) and nobody else. A person whose membership has ended or is
-- suspended is not listed, and their records read as owned by no one (see accounts_rows). Sorted by name as the alphabet has it.
CREATE FUNCTION public.firm_member_choices(p_firm_id uuid)
RETURNS TABLE (user_id uuid, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  RETURN QUERY
    SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text)
    FROM public.firm_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = firm AND public.membership_is_current(m.valid_from, m.valid_until)
    ORDER BY lower(public.person_display_name(u.raw_user_meta_data, u.email::text) COLLATE "und-x-icu"), m.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_member_choices(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_member_choices(uuid) TO authenticated;

-- ---------- 3. Last activity, in one place (D-201) ----------

-- Every moment something happened on an account of the firm: the newest of them is its last activity. Today: the account's making, and a status change of a
-- quote request on one of its opportunities' intakes (its sending, a quote back, a decline). Editing a field is not activity. Calls, notes and tasks
-- logged or completed on the account, its contacts or its opportunities join in CRM-E1.5, and an email in Epic 6, each by one more branch of this
-- one function (CREATE OR REPLACE, with every branch it has): nothing else reads these moments. Internal: the table's query asks it.
CREATE FUNCTION public.account_activity_times(p_firm_id uuid)
RETURNS TABLE (account_id uuid, at timestamptz)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT a.id, a.created_at FROM public.accounts a WHERE a.firm_id = p_firm_id
  UNION ALL
  SELECT o.account_id, e.changed_at
  FROM public.opportunities o
  JOIN public.quote_requests q ON q.session_id = o.intake_id
  JOIN public.quote_request_events e ON e.quote_request_id = q.id AND e.field = 'status'
  WHERE o.firm_id = p_firm_id
$$;

REVOKE ALL ON FUNCTION public.account_activity_times(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- A quote request's status changes by the quote request, for the branch above.
CREATE INDEX quote_request_events_status_idx ON public.quote_request_events (quote_request_id, changed_at) WHERE field = 'status';

-- ---------- 4. The accounts table's fields ----------

-- The fields a filter or a sort may name, and the kind of each. Nothing else is a field (src/lib/accountsApi.ts holds the same list;
-- src/lib/accountsApi.test.ts compares them). There is none for the main contact: it is shown, never sorted (CRM-A1.1) or filtered. Renewal and labels are
-- later epics' (D-186, D-198), and custom fields are CRM-X3.1's.
CREATE FUNCTION public.accounts_field_kind(p_field text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    -- sync:begin accounts_fields
    WHEN 'name' THEN 'text'
    WHEN 'trade_name' THEN 'text'
    WHEN 'website' THEN 'text'
    WHEN 'city' THEN 'text'
    WHEN 'industry' THEN 'text'
    WHEN 'current_provider' THEN 'text'
    WHEN 'opportunity_name' THEN 'text'
    WHEN 'employees' THEN 'number'
    WHEN 'open_opportunities' THEN 'number'
    WHEN 'quote_requests_sent' THEN 'number'
    WHEN 'quotes_received' THEN 'number'
    WHEN 'created_at' THEN 'date'
    WHEN 'last_activity_at' THEN 'date'
    WHEN 'target_start' THEN 'date'
    WHEN 'earliest_quote_expires_on' THEN 'date'
    WHEN 'state' THEN 'choice'
    WHEN 'source' THEN 'choice'
    WHEN 'status' THEN 'choice'
    WHEN 'opportunity_stage' THEN 'choice'
    WHEN 'states_of_operation' THEN 'choices'
    WHEN 'archived' THEN 'yes_no'
    WHEN 'waiting_on_peo' THEN 'yes_no'
    WHEN 'owner' THEN 'person'
    -- sync:end accounts_fields
  END
$$;

-- The values a choice field holds, in the order it sorts by (a status and a stage sort by where they are in the list). A value outside the list is
-- refused rather than matching nothing. A state is checked as a state code (accounts_filters_checked); it has no list here.
--   source             D-211: set by the product, never edited
--   status             D-197
--   opportunity_stage  the stages an open opportunity is at (D-206): the column shows the open opportunity with the nearest target start, so a stage
--                      that is won or lost is never what it shows
CREATE FUNCTION public.accounts_field_choices(p_field text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    WHEN 'source' THEN ARRAY[
      -- sync:begin accounts_sources
      'employer_intake', 'added_by_hand', 'new_quote', 'lead', 'import'
      -- sync:end accounts_sources
    ]
    WHEN 'status' THEN ARRAY[
      -- sync:begin accounts_statuses
      'prospect', 'client'
      -- sync:end accounts_statuses
    ]
    WHEN 'opportunity_stage' THEN ARRAY[
      -- sync:begin accounts_open_stages
      'qualifying', 'intake_under_way', 'ready_to_send', 'in_market', 'quoted'
      -- sync:end accounts_open_stages
    ]
  END
$$;

-- One row of the table: what the page draws, and what a filter, a sort and an export read.
--   owner / owner_name            the record owner, only while they are a current member of the firm (a record whose owner left reads as owned by no one)
--   main_contact_*                the contact marked main; the phone is its phone or else its mobile
--   opportunity_*, target_start   the open opportunity with the nearest target start (an opportunity is open until it is won or lost, D-206)
--   open_opportunities            how many are open, so the page can say "+N more" for the others
--   quote_requests_sent, ...      across every opportunity of the account: those asked for that are not closed, how many came back (quoted), the nearest
--                                 expiry of a quote that came back, and whether any is still waiting on a PEO
--   last_activity_at              account_activity_times()'s newest
CREATE TYPE public.accounts_row AS (
  id uuid,
  name text,
  trade_name text,
  website text,
  city text,
  state text,
  industry text,
  employees integer,
  states_of_operation text[],
  current_provider text,
  source text,
  status text,
  archived boolean,
  archived_at timestamptz,
  created_at timestamptz,
  owner uuid,
  owner_name text,
  main_contact_id uuid,
  main_contact_name text,
  main_contact_email text,
  main_contact_phone text,
  opportunity_id uuid,
  opportunity_name text,
  opportunity_stage text,
  target_start date,
  open_opportunities integer,
  quote_requests_sent integer,
  quotes_received integer,
  waiting_on_peo boolean,
  earliest_quote_expires_on date,
  last_activity_at timestamptz
);

-- The filters of one call, checked: a list of at most 20, each on a listed field, each read by workspace_filter_check, and the caller's own people worked
-- out: "me" is the caller, "my team" every current member of the caller's team and of the teams under it (a person on no team has none). Both come back
-- as the list of people they are, so a row is only ever matched against ids. Returns the checked filters, each with its field. Reads no row of an account.
CREATE FUNCTION public.accounts_filters_checked(p_firm_id uuid, p_filters jsonb, p_today date)
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
    kind := public.accounts_field_kind(field);
    IF kind IS NULL THEN
      RAISE EXCEPTION 'The accounts table has no field "%" to filter by', left(field, 64) USING ERRCODE = '22023';
    END IF;
    checked := public.workspace_filter_check(kind, f, public.accounts_field_choices(field), p_today);
    IF field IN ('state', 'states_of_operation') AND checked ? 'vs' AND EXISTS (
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

-- Whether one row passes every checked filter ("and"), the archived rule aside. A moment is compared as the day it falls on in `p_time_zone`.
CREATE FUNCTION public.accounts_row_filters_pass(r public.accounts_row, p_checked jsonb, p_time_zone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_checked) f
    WHERE NOT COALESCE(CASE f ->> 'field'
      WHEN 'name' THEN public.workspace_filter_match_text(r.name, f)
      WHEN 'trade_name' THEN public.workspace_filter_match_text(r.trade_name, f)
      WHEN 'website' THEN public.workspace_filter_match_text(r.website, f)
      WHEN 'city' THEN public.workspace_filter_match_text(r.city, f)
      WHEN 'industry' THEN public.workspace_filter_match_text(r.industry, f)
      WHEN 'current_provider' THEN public.workspace_filter_match_text(r.current_provider, f)
      WHEN 'opportunity_name' THEN public.workspace_filter_match_text(r.opportunity_name, f)
      WHEN 'employees' THEN public.workspace_filter_match_number(r.employees, f)
      WHEN 'open_opportunities' THEN public.workspace_filter_match_number(r.open_opportunities, f)
      WHEN 'quote_requests_sent' THEN public.workspace_filter_match_number(r.quote_requests_sent, f)
      WHEN 'quotes_received' THEN public.workspace_filter_match_number(r.quotes_received, f)
      WHEN 'created_at' THEN public.workspace_filter_match_date((r.created_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'last_activity_at' THEN public.workspace_filter_match_date((r.last_activity_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'target_start' THEN public.workspace_filter_match_date(r.target_start, f)
      WHEN 'earliest_quote_expires_on' THEN public.workspace_filter_match_date(r.earliest_quote_expires_on, f)
      WHEN 'state' THEN public.workspace_filter_match_choice(r.state, f)
      WHEN 'source' THEN public.workspace_filter_match_choice(r.source, f)
      WHEN 'status' THEN public.workspace_filter_match_choice(r.status, f)
      WHEN 'opportunity_stage' THEN public.workspace_filter_match_choice(r.opportunity_stage, f)
      WHEN 'states_of_operation' THEN public.workspace_filter_match_choices(r.states_of_operation, f)
      WHEN 'archived' THEN public.workspace_filter_match_yes_no(r.archived, f)
      WHEN 'waiting_on_peo' THEN public.workspace_filter_match_yes_no(r.waiting_on_peo, f)
      WHEN 'owner' THEN public.workspace_filter_match_person(r.owner, f)
    END, false)
  )
$$;

-- Whether a row is in the table for these filters: it passes each, and it is not archived unless a filter on "archived" says what is asked for
-- ("an archived account leaves every view but Archived", CRM-A1.1). A filter "archived is yes" asks for the archived ones, "is no" for the rest.
CREATE FUNCTION public.accounts_row_passes(r public.accounts_row, p_checked jsonb, p_time_zone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN jsonb_array_length(p_checked) = 0 THEN NOT r.archived
    ELSE (NOT r.archived OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_checked) f WHERE f ->> 'field' = 'archived'))
         AND public.accounts_row_filters_pass(r, p_checked, p_time_zone)
  END
$$;

-- ---------- 5. The accounts the caller may see, with their worked-out columns ----------

-- Every account of the firm the caller may see (can_see_firm_record: by their level, or all of them where the firm shows everyone everything) that the
-- search matches, archived ones too, each with its columns. The one definition of a row of the table: the list, the counts and the export all read it.
-- Reads as its owner, so the visibility is decided here, by asking can_see_firm_record once for each owner an account of the firm has (and for no owner)
-- and keeping the accounts of those: the same rule row security applies, asked a few times and not for every account (supabase/tests/accounts_query.sql
-- compares the two). `p_ids`, when given, keeps only those accounts (an export of a selection).
--
-- Search: every word must be somewhere in the account's name, trade name or web domain, or in the name or email of one of its contacts (a word that is
-- an address, "www.acme.com", also finds the domain "acme.com"), ignoring case.
CREATE FUNCTION public.accounts_rows(p_firm_id uuid, p_search text, p_ids uuid[] DEFAULT NULL)
RETURNS SETOF public.accounts_row
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
-- Joins by hash, never by nested loop, and no JIT: the sets joined here are built inside the query, so the planner has no counts for them (and none at all for
-- a table just filled by an import until the database has looked at it), and thought of as one row each they were joined one by one, 5,000 accounts taking
-- 40 seconds. A plan with nested loops ruled out costs more than the limit above which the database compiles it, which cost another second.
SET enable_nestloop = off
SET jit = off
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
  WITH vis AS MATERIALIZED (
    SELECT a.*
    FROM public.accounts a
    WHERE a.firm_id = p_firm_id
      AND (a.owner_id = ANY (seen_owners) OR (a.owner_id IS NULL AND seen_unowned))
      AND (p_ids IS NULL OR a.id = ANY (p_ids))
  ),
  opp AS MATERIALIZED (
    SELECT o.id, o.account_id, o.name, o.target_start, o.created_at, o.intake_id, public.opportunity_stage(o.id) AS stage
    FROM public.opportunities o
    JOIN vis ON vis.id = o.account_id
    WHERE o.firm_id = p_firm_id
  ),
  open_opp AS (
    SELECT DISTINCT ON (o.account_id) o.account_id, o.id, o.name, o.target_start, o.stage, (count(*) OVER (PARTITION BY o.account_id))::integer AS n
    FROM opp o
    WHERE o.stage NOT IN ('won', 'lost')
    ORDER BY o.account_id, o.target_start NULLS LAST, o.created_at, o.id
  ),
  quotes AS (
    SELECT o.account_id,
           (count(*) FILTER (WHERE q.status <> 'closed'))::integer AS sent,
           (count(*) FILTER (WHERE q.status = 'quoted'))::integer AS received,
           min(q.quote_expires_on) FILTER (WHERE q.status = 'quoted') AS expires,
           COALESCE(bool_or(q.status = 'sent'), false) AS waiting
    FROM opp o
    JOIN public.quote_requests q ON q.session_id = o.intake_id
    GROUP BY o.account_id
  ),
  main_contact AS (
    SELECT c.account_id, c.id, btrim(concat_ws(' ', c.first_name, c.last_name)) AS name, NULLIF(btrim(c.email), '') AS email,
           COALESCE(NULLIF(btrim(c.phone), ''), NULLIF(btrim(c.mobile), '')) AS phone
    FROM public.contacts c
    JOIN vis ON vis.id = c.account_id
    WHERE c.is_main
  ),
  activity AS (
    SELECT t.account_id, max(t.at) AS at
    FROM public.account_activity_times(p_firm_id) t
    JOIN vis ON vis.id = t.account_id
    GROUP BY t.account_id
  ),
  contact_text AS (
    SELECT c.account_id, lower(string_agg(concat_ws(' ', c.first_name, c.last_name, c.email), E'\n')) AS t
    FROM public.contacts c
    JOIN vis ON vis.id = c.account_id
    WHERE cardinality(terms) > 0
    GROUP BY c.account_id
  ),
  members AS (
    SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text) AS name
    FROM public.firm_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = p_firm_id AND public.membership_is_current(m.valid_from, m.valid_until)
  )
  SELECT (ROW(
    a.id, a.name, a.trade_name, a.website, a.city, a.state, a.industry, a.employees, a.states_of_operation, a.current_provider, a.source,
    public.account_status(a.id), a.archived_at IS NOT NULL, a.archived_at, a.created_at,
    mem.user_id, mem.name,
    mc.id, mc.name, mc.email, mc.phone,
    oo.id, oo.name, oo.stage, oo.target_start, COALESCE(oo.n, 0),
    COALESCE(q.sent, 0), COALESCE(q.received, 0), COALESCE(q.waiting, false), q.expires,
    act.at
  )::public.accounts_row).*
  FROM vis a
  LEFT JOIN members mem ON mem.user_id = a.owner_id
  LEFT JOIN main_contact mc ON mc.account_id = a.id
  LEFT JOIN open_opp oo ON oo.account_id = a.id
  LEFT JOIN quotes q ON q.account_id = a.id
  LEFT JOIN activity act ON act.account_id = a.id
  LEFT JOIN contact_text ct ON ct.account_id = a.id
  WHERE NOT EXISTS (
    SELECT 1 FROM unnest(terms, domains) AS w (term, dom)
    WHERE strpos(lower(concat_ws(E'\n', a.name, a.trade_name, a.web_domain)) || E'\n' || COALESCE(ct.t, ''), w.term) = 0
      AND (w.dom IS NULL OR a.web_domain IS NULL OR strpos(a.web_domain, w.dom) = 0)
  );
END;
$$;

-- ---------- 6. What the browser calls ----------

-- One page of the accounts table: the accounts the caller may see that the search and every filter match, sorted, 50 a page, with how many match in all.
-- Returns {"rows": [...], "total": n, "page": p, "page_size": 50}; a page past the end has no rows and the same total. One firm at a time: the firm
-- named, or (NULL) the caller's only firm at this address (firm_to_act_for); a person of two firms on the bare domain must name one. Archived accounts
-- are left out unless a filter on "archived" asks for them.
--
-- Sort: any listed field except the main contact, which has none: "asc" or "desc". Text ignoring case and by the alphabet (not by code point); a status and a
-- stage by their place in the field's list; a moment as a moment. Empty values (no owner, no open opportunity, blank text) come last in both directions.
-- Equal values, and no sort at all, go by last activity, newest first (the table's own order), then the account's id: every row has one place.
CREATE FUNCTION public.accounts_list(
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
SET jit = off
AS $$
DECLARE
  page_size constant integer := 50;
  firm uuid;
  tz text;
  checked jsonb;
  pg integer := COALESCE(p_page, 1);
  choices text[];
  result jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  tz := public.workspace_time_zone(p_time_zone);
  checked := public.accounts_filters_checked(firm, p_filters, (now() AT TIME ZONE tz)::date);
  IF p_sort IS NOT NULL THEN
    IF public.accounts_field_kind(p_sort) IS NULL THEN
      RAISE EXCEPTION 'The accounts table has no field "%" to sort by', left(p_sort, 64) USING ERRCODE = '22023';
    END IF;
    choices := public.accounts_field_choices(p_sort);
  END IF;
  IF p_direction IS NULL OR p_direction NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'A sort goes asc or desc' USING ERRCODE = '22023';
  END IF;
  IF pg < 1 OR pg > 100000 THEN
    RAISE EXCEPTION 'A page number is 1 to 100000' USING ERRCODE = '22023';
  END IF;

  WITH matched AS MATERIALIZED (
    SELECT r
    FROM public.accounts_rows(firm, p_search) r
    WHERE public.accounts_row_passes(r, checked, tz)
  ),
  keyed AS (
    SELECT
      m.r,
      -- One key per type; only the sorted field's is set. Text, compared by the ICU collation so "Émile" sorts beside "emile", not after "zeta".
      NULLIF(btrim(CASE p_sort
        WHEN 'name' THEN lower((m.r).name COLLATE "und-x-icu")
        WHEN 'trade_name' THEN lower((m.r).trade_name COLLATE "und-x-icu")
        WHEN 'website' THEN lower((m.r).website COLLATE "und-x-icu")
        WHEN 'city' THEN lower((m.r).city COLLATE "und-x-icu")
        WHEN 'industry' THEN lower((m.r).industry COLLATE "und-x-icu")
        WHEN 'current_provider' THEN lower((m.r).current_provider COLLATE "und-x-icu")
        WHEN 'opportunity_name' THEN lower((m.r).opportunity_name COLLATE "und-x-icu")
        WHEN 'state' THEN lower((m.r).state COLLATE "und-x-icu")
        WHEN 'source' THEN lower((m.r).source COLLATE "und-x-icu")
        WHEN 'owner' THEN lower((m.r).owner_name COLLATE "und-x-icu")
        WHEN 'states_of_operation' THEN lower(array_to_string((m.r).states_of_operation, ', ') COLLATE "und-x-icu")
      END), '') AS k_text,
      CASE p_sort
        WHEN 'employees' THEN (m.r).employees::numeric
        WHEN 'open_opportunities' THEN (m.r).open_opportunities
        WHEN 'quote_requests_sent' THEN (m.r).quote_requests_sent
        WHEN 'quotes_received' THEN (m.r).quotes_received
        WHEN 'archived' THEN (m.r).archived::integer
        WHEN 'waiting_on_peo' THEN (m.r).waiting_on_peo::integer
        -- A choice by its place in the field's list; a value outside it, if one ever appears, after the listed ones.
        WHEN 'status' THEN COALESCE(array_position(choices, (m.r).status), cardinality(choices) + 1)
        WHEN 'opportunity_stage' THEN CASE WHEN (m.r).opportunity_stage IS NULL THEN NULL
          ELSE COALESCE(array_position(choices, (m.r).opportunity_stage), cardinality(choices) + 1) END
      END AS k_number,
      CASE p_sort
        WHEN 'created_at' THEN (m.r).created_at
        WHEN 'last_activity_at' THEN (m.r).last_activity_at
      END AS k_moment,
      CASE p_sort
        WHEN 'target_start' THEN (m.r).target_start
        WHEN 'earliest_quote_expires_on' THEN (m.r).earliest_quote_expires_on
      END AS k_day
    FROM matched m
  ),
  ordered AS (
    SELECT k.r, row_number() OVER (ORDER BY
      -- Empty values last, whichever way.
      (p_sort IS NOT NULL AND k.k_text IS NULL AND k.k_number IS NULL AND k.k_moment IS NULL AND k.k_day IS NULL),
      CASE WHEN p_direction = 'asc' THEN k.k_text END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_text END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_number END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_number END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_moment END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_moment END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_day END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_day END DESC,
      -- Then the table's own order: last activity, newest first, then the id, so every row has its one place.
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

-- The count for each view's tab: `p_views` is a list of {"name": text, "filters": [...]}, at most 20, names unique; returns one row per view in the order
-- given, each counting what accounts_list would total for those filters and the search, for the same firm and the same person. One refused filter
-- refuses the call, naming the view.
CREATE FUNCTION public.accounts_view_counts(p_firm_id uuid, p_views jsonb, p_search text DEFAULT NULL, p_time_zone text DEFAULT 'UTC')
RETURNS TABLE (view_name text, total bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET jit = off
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
      sets := sets || public.accounts_filters_checked(firm, COALESCE(v -> 'filters', '[]'::jsonb), today);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'View "%": %', v ->> 'name', SQLERRM USING ERRCODE = SQLSTATE;
    END;
    names := names || (v ->> 'name');
  END LOOP;

  RETURN QUERY
  WITH visible AS MATERIALIZED (
    SELECT r FROM public.accounts_rows(firm, p_search) r
  )
  SELECT w.name, (SELECT count(*) FROM visible x WHERE public.accounts_row_passes(x.r, w.filters, tz))
  FROM unnest(names, sets) WITH ORDINALITY AS w(name, filters, ord)
  ORDER BY w.ord;
END;
$$;

-- The helpers are internal: only the functions above (and the export's reader below) call them, after their own checks.
REVOKE ALL ON FUNCTION public.accounts_field_kind(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accounts_field_choices(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accounts_filters_checked(uuid, jsonb, date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accounts_row_filters_pass(public.accounts_row, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accounts_row_passes(public.accounts_row, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accounts_rows(uuid, text, uuid[]) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.accounts_list(uuid, jsonb, text, text, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accounts_view_counts(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounts_list(uuid, jsonb, text, text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounts_view_counts(uuid, jsonb, text, text) TO authenticated;

-- ---------- 7. Saved views and column choices ----------
-- `accounts` joins the tables whose views and column choices are kept (20261117120000: "adding accounts ... is one small migration that drops and adds
-- the domain's check with the longer list"). Nothing else changes: the functions that keep them take the table by name from this list.
ALTER DOMAIN public.workspace_table DROP CONSTRAINT workspace_table_known;
ALTER DOMAIN public.workspace_table ADD CONSTRAINT workspace_table_known CHECK (VALUE IN ('submissions', 'accounts'));

-- ---------- 8. Export (D-48, D-218) ----------

-- The words an exported file holds for a code a person never sees as one (a status, a stage, a source), the same words the page uses. Internal.
CREATE FUNCTION public.accounts_words(p_kind text, p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_kind
    WHEN 'status' THEN CASE p_code WHEN 'prospect' THEN 'Prospect' WHEN 'client' THEN 'Client' END
    WHEN 'stage' THEN CASE p_code WHEN 'qualifying' THEN 'Qualifying' WHEN 'intake_under_way' THEN 'Intake under way' WHEN 'ready_to_send' THEN 'Ready to send'
      WHEN 'in_market' THEN 'In market' WHEN 'quoted' THEN 'Quoted' WHEN 'won' THEN 'Won' WHEN 'lost' THEN 'Lost' END
    WHEN 'source' THEN CASE p_code WHEN 'employer_intake' THEN 'Employer''s intake' WHEN 'added_by_hand' THEN 'Added by hand' WHEN 'new_quote' THEN 'New quote'
      WHEN 'lead' THEN 'Lead' WHEN 'import' THEN 'Import' END
  END
$$;

REVOKE ALL ON FUNCTION public.accounts_words(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- What can be exported (20261119090000), restated with its two lines and the third: the accounts, for any current member (they read what row security shows
-- them, and the reader below applies that itself). The columns are the table's, in the order a file shows them.
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
     '[{"id":"name","label":"Account"},{"id":"trade_name","label":"Trade name"},{"id":"website","label":"Website"},{"id":"city","label":"City"},{"id":"state","label":"State"},{"id":"employees","label":"Employees"},{"id":"industry","label":"Industry"},{"id":"states_of_operation","label":"States of operation"},{"id":"current_provider","label":"Current provider"},{"id":"source","label":"Source"},{"id":"status","label":"Status"},{"id":"owner","label":"Owner"},{"id":"main_contact","label":"Main contact"},{"id":"main_contact_email","label":"Main contact email"},{"id":"main_contact_phone","label":"Main contact phone"},{"id":"opportunity","label":"Opportunity"},{"id":"opportunity_stage","label":"Opportunity stage"},{"id":"target_start","label":"Target start"},{"id":"open_opportunities","label":"Open opportunities"},{"id":"quote_requests_sent","label":"Quotes asked for"},{"id":"quotes_received","label":"Quotes back"},{"id":"earliest_quote_expires_on","label":"Nearest quote expiry"},{"id":"last_activity_at","label":"Last activity"},{"id":"created_at","label":"Created"},{"id":"archived","label":"Archived"}]'::jsonb)
  ) t (name, label, who, columns)
$$;

REVOKE ALL ON FUNCTION public.export_table_registry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_table_registry() TO service_role;

-- The accounts' reader, run by export_rows after its checks (a support session refused, a member of this firm at this address, the sign-in for a whole table).
-- It does what row security would, by the table's own query (accounts_rows: the accounts the caller may see, by their level) and no column the table does
-- not list. Filters: an object of `filters` (the table's own filters, as the page sends them), `search` and `time_zone`, each optional; a key it does not
-- have is refused, so a typo never exports everything. With no ids it exports what the table shows for those filters (archived accounts only when a filter
-- asks); a selection by ids names the accounts, archived ones too, and is not narrowed by the archived rule. In the table's own order (last activity, newest
-- first). A code is written in the words a person reads (Client, In market, Employer's intake).
CREATE FUNCTION public.export_source_accounts(p_firm_id uuid, p_filters jsonb, p_ids jsonb, p_limit integer)
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
  search_in text;
  ids uuid[];
BEGIN
  IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_filters) k WHERE k NOT IN ('filters', 'search', 'time_zone'))
     OR (p_filters ? 'search' AND jsonb_typeof(p_filters -> 'search') IS DISTINCT FROM 'string')
     OR (p_filters ? 'time_zone' AND jsonb_typeof(p_filters -> 'time_zone') IS DISTINCT FROM 'string')
     OR (p_filters ? 'filters' AND jsonb_typeof(p_filters -> 'filters') IS DISTINCT FROM 'array') THEN
    RAISE EXCEPTION 'Those filters don''t apply to this table' USING ERRCODE = '22023';
  END IF;
  tz := public.workspace_time_zone(p_filters ->> 'time_zone');
  checked := public.accounts_filters_checked(p_firm_id, COALESCE(p_filters -> 'filters', '[]'::jsonb), (now() AT TIME ZONE tz)::date);
  search_in := p_filters ->> 'search';
  IF p_ids IS NOT NULL THEN
    -- An id that is not an account's id (another firm's, a made-up one, text) gives no row, like one that is not there.
    SELECT COALESCE(array_agg(i::uuid), '{}') INTO ids
    FROM jsonb_array_elements_text(p_ids) i
    WHERE i ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;
  RETURN QUERY
    SELECT jsonb_build_object(
      'name', r.name, 'trade_name', r.trade_name, 'website', r.website, 'city', r.city, 'state', r.state, 'employees', r.employees,
      'industry', r.industry, 'states_of_operation', NULLIF(array_to_string(r.states_of_operation, ', '), ''), 'current_provider', r.current_provider,
      'source', public.accounts_words('source', r.source), 'status', public.accounts_words('status', r.status), 'owner', r.owner_name,
      'main_contact', NULLIF(r.main_contact_name, ''), 'main_contact_email', r.main_contact_email, 'main_contact_phone', r.main_contact_phone,
      'opportunity', r.opportunity_name, 'opportunity_stage', public.accounts_words('stage', r.opportunity_stage), 'target_start', r.target_start,
      'open_opportunities', r.open_opportunities, 'quote_requests_sent', r.quote_requests_sent, 'quotes_received', r.quotes_received,
      'earliest_quote_expires_on', r.earliest_quote_expires_on, 'last_activity_at', r.last_activity_at, 'created_at', r.created_at, 'archived', r.archived)
    FROM public.accounts_rows(p_firm_id, search_in, ids) r
    WHERE CASE WHEN ids IS NULL THEN public.accounts_row_passes(r, checked, tz) ELSE public.accounts_row_filters_pass(r, checked, tz) END
    ORDER BY r.last_activity_at DESC NULLS LAST, r.id
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.export_source_accounts(uuid, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;
