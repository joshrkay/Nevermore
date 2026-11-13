-- The queue's query in the database (story CRM-S3.3b; docs/BROKER_CRM_BUILD.md D-38, D-39, D-43, D-44).
--
-- Sort, filter, pages and view counts run here, over a fixed list of the queue's fields, so every later table (accounts,
-- leads, quotes) copies one shape:
--
--   * workspace_filter_check(kind, filter, choices, today) reads one filter a browser sent, {field, op, value}, for a field
--     of a given kind, refuses it with a plain message when it is not one the kind takes, and returns it in the form the
--     matchers read. It reads the filter alone, never a row: whether a filter is refused can't depend on what rows exist.
--   * workspace_filter_match_<kind>(value, checked) decides whether one value passes one checked filter. They never raise.
--   * queue_list_submissions(filters, sort, direction, page, search, time zone): one page of 50, with the count of all that
--     match. queue_view_counts(views, search, time zone): the count for each of several named filter sets, in one call.
--
-- No SQL is built from what the caller sends (D-44): no EXECUTE, no format(). A field name chooses a branch of a fixed CASE.
--
-- Both read the queue's rows from advisor_list_submissions, unchanged, called with no page: it stays the one definition of a
-- queue row (its firm rule, what an agent sees, the hidden empty guest drafts, the open-item count of ADR 0009 and the
-- new-PEO-mail mark of D-39), and today's page, which calls it with its status, action, waiting and sort arguments, keeps
-- working as it is until stories 7, 10 and 13 move the page onto queue_list_submissions.

SET lock_timeout = '5s';

-- ---------- 1. Filters, for any table ----------

-- One filter, read for a field of `p_kind`. Returns what the matcher of that kind reads; refuses (22023) anything else, and
-- a person filter (0A000) until CRM-A1.1 gives records an owner. `p_choices`, when given, are the values a choice field
-- holds (compared ignoring case); `p_today` is the caller's day, which "in the next or last N days" counts from.
--
-- Kinds and operators (CRM-S3.3):
--   text      contains <text> | is <text> | is_empty                      ignoring case and surrounding spaces
--   number    is <n> | more_than <n> | less_than <n> | between [<n>, <n>]  ends in either order, both included
--   date      on <day> | before <day> | after <day> | between [<day>, <day>] | in_next_days <N> | in_last_days <N>
--             a day is YYYY-MM-DD; N is a whole number 0 to 3660, 0 being today; ends in either order, both included
--   choice    any_of [..] | none_of [..] | is_empty                       one value, ignoring case; none_of keeps empties
--   choices   any_of [..] | none_of [..] | is_empty                       several values: any_of is "holds any of"
--   yes_no    is true | is false
--   person    any_of [..] | me | my_team                                  refused until CRM-A1.1 (D-15, D-24)
CREATE FUNCTION public.workspace_filter_check(p_kind text, p_filter jsonb, p_choices text[] DEFAULT NULL, p_today date DEFAULT NULL)
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
    IF op IN ('any_of', 'me', 'my_team') THEN
      RAISE EXCEPTION 'Filters on a person arrive with CRM-A1.1, when records have an owner' USING ERRCODE = '0A000';
    END IF;

  ELSE
    RAISE EXCEPTION 'No field is of the kind %', left(p_kind, 32) USING ERRCODE = '22023';
  END IF;

  RAISE EXCEPTION 'A % field can''t be filtered with "%"', p_kind, left(op, 32) USING ERRCODE = '22023';
END;
$$;

-- A day a date filter names: a string YYYY-MM-DD that is a real day. Part of workspace_filter_check.
CREATE FUNCTION public.workspace_filter_day(p_value jsonb, p_label text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  d date;
BEGIN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'string' OR (p_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'The filter "%" needs a day written YYYY-MM-DD', p_label USING ERRCODE = '22023';
  END IF;
  -- The ISO form is read the same whatever the session's date style; a day that doesn't exist (2026-02-30) is refused.
  BEGIN
    d := (p_value #>> '{}')::date;
  EXCEPTION WHEN OTHERS THEN
    d := NULL;
  END;
  IF d IS NULL THEN
    RAISE EXCEPTION 'The filter "%" names a day that doesn''t exist', p_label USING ERRCODE = '22023';
  END IF;
  RETURN d;
END;
$$;

-- The matchers: does one value pass one checked filter? An empty value passes only is_empty (and none_of). Never raise.
CREATE FUNCTION public.workspace_filter_match_text(p_value text, p_checked jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(CASE p_checked ->> 'op'
    WHEN 'contains' THEN strpos(lower(p_value), p_checked ->> 'v') > 0
    WHEN 'is' THEN lower(btrim(p_value)) = p_checked ->> 'v'
    WHEN 'is_empty' THEN p_value IS NULL OR btrim(p_value) = ''
  END, false)
$$;

CREATE FUNCTION public.workspace_filter_match_number(p_value numeric, p_checked jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(CASE p_checked ->> 'op'
    WHEN 'is' THEN p_value = (p_checked ->> 'v')::numeric
    WHEN 'more_than' THEN p_value > (p_checked ->> 'v')::numeric
    WHEN 'less_than' THEN p_value < (p_checked ->> 'v')::numeric
    WHEN 'between' THEN p_value BETWEEN (p_checked ->> 'lo')::numeric AND (p_checked ->> 'hi')::numeric
  END, false)
$$;

CREATE FUNCTION public.workspace_filter_match_date(p_value date, p_checked jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(p_checked ->> 'op' = 'days'
    AND p_value >= COALESCE((p_checked ->> 'lo')::date, '-infinity'::date)
    AND p_value <= COALESCE((p_checked ->> 'hi')::date, 'infinity'::date), false)
$$;

CREATE FUNCTION public.workspace_filter_match_choice(p_value text, p_checked jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(CASE p_checked ->> 'op'
    WHEN 'any_of' THEN lower(btrim(p_value)) IN (SELECT jsonb_array_elements_text(p_checked -> 'vs'))
    WHEN 'none_of' THEN p_value IS NULL OR lower(btrim(p_value)) NOT IN (SELECT jsonb_array_elements_text(p_checked -> 'vs'))
    WHEN 'is_empty' THEN p_value IS NULL OR btrim(p_value) = ''
  END, false)
$$;

CREATE FUNCTION public.workspace_filter_match_choices(p_value text[], p_checked jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(CASE p_checked ->> 'op'
    WHEN 'any_of' THEN EXISTS (
      SELECT 1 FROM unnest(p_value) e WHERE lower(btrim(e)) IN (SELECT jsonb_array_elements_text(p_checked -> 'vs')))
    WHEN 'none_of' THEN NOT EXISTS (
      SELECT 1 FROM unnest(p_value) e WHERE lower(btrim(e)) IN (SELECT jsonb_array_elements_text(p_checked -> 'vs')))
    WHEN 'is_empty' THEN COALESCE(cardinality(p_value), 0) = 0
  END, false)
$$;

CREATE FUNCTION public.workspace_filter_match_yes_no(p_value boolean, p_checked jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(p_checked ->> 'op' = 'is' AND p_value = (p_checked ->> 'v')::boolean, false)
$$;

-- The caller's time zone, which turns a moment into the day a date filter compares: an IANA name such as
-- America/New_York, or UTC. Anything else is refused.
CREATE FUNCTION public.workspace_time_zone(p_time_zone text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_time_zone IS NULL THEN
    RETURN 'UTC';
  END IF;
  IF char_length(p_time_zone) <= 64 AND p_time_zone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$' THEN
    BEGIN
      PERFORM now() AT TIME ZONE p_time_zone;
      RETURN p_time_zone;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RAISE EXCEPTION 'Unknown time zone "%"', left(p_time_zone, 64) USING ERRCODE = '22023';
END;
$$;

-- ---------- 2. The queue's fields ----------

-- What the queue lists: advisor_list_submissions's row, less its total, with the two yes-or-no marks a filter asks of it.
CREATE TYPE public.queue_row AS (
  session_id uuid,
  company_name text,
  contact_name text,
  employee_count integer,
  pipeline_status text,
  intake_status text,
  signer_name text,
  submitted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  missing_required text[],
  open_fields integer,
  flagged_fields integer,
  verified_fields integer,
  file_id text,
  states text[],
  needs_action boolean,
  needs_action_note text,
  quote_requests_sent integer,
  quotes_received integer,
  oldest_waiting_on date,
  earliest_quote_expires_on date,
  sent_older_version boolean,
  new_peo_mail_requests integer,
  start_month text,
  -- Inbox (D-38, D-39): a quote request has mail from a person at the PEO that no one has opened, by the queue's own mark.
  has_new_peo_mail boolean,
  -- Waiting on a PEO: a quote request sent and not yet answered (today's `waiting` argument).
  waiting_on_peo boolean
);

-- The fields a filter or a sort may name, and the kind of each. Nothing else is a field (src/lib/queueApi.ts holds the same
-- list; src/data/schemaSync.test.ts compares them).
CREATE FUNCTION public.queue_field_kind(p_field text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    -- sync:begin queue_fields
    WHEN 'company_name' THEN 'text'
    WHEN 'contact_name' THEN 'text'
    WHEN 'signer_name' THEN 'text'
    WHEN 'file_id' THEN 'text'
    WHEN 'needs_action_note' THEN 'text'
    WHEN 'start_month' THEN 'text'
    WHEN 'employee_count' THEN 'number'
    WHEN 'open_fields' THEN 'number'
    WHEN 'flagged_fields' THEN 'number'
    WHEN 'verified_fields' THEN 'number'
    WHEN 'quote_requests_sent' THEN 'number'
    WHEN 'quotes_received' THEN 'number'
    WHEN 'new_peo_mail_requests' THEN 'number'
    WHEN 'submitted_at' THEN 'date'
    WHEN 'created_at' THEN 'date'
    WHEN 'updated_at' THEN 'date'
    WHEN 'oldest_waiting_on' THEN 'date'
    WHEN 'earliest_quote_expires_on' THEN 'date'
    WHEN 'pipeline_status' THEN 'choice'
    WHEN 'intake_status' THEN 'choice'
    WHEN 'states' THEN 'choices'
    WHEN 'missing_required' THEN 'choices'
    WHEN 'needs_action' THEN 'yes_no'
    WHEN 'sent_older_version' THEN 'yes_no'
    WHEN 'has_new_peo_mail' THEN 'yes_no'
    WHEN 'waiting_on_peo' THEN 'yes_no'
    -- sync:end queue_fields
  END
$$;

-- The values a choice field holds, in the order it sorts by (a stage sorts by where it is in the pipeline). A value
-- outside the list is refused rather than matching nothing. States are checked as state codes; missing items are free text.
CREATE FUNCTION public.queue_field_choices(p_field text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    -- The stages of submission_workflow_status_check (20261104122000_pipeline_transitions.sql).
    WHEN 'pipeline_status' THEN ARRAY[
      -- sync:begin queue_pipeline_choices
      'draft', 'submitted', 'under_review', 'information_requested', 'ready_for_market',
      'sent_to_carrier', 'quoted', 'won', 'lost', 'archived'
      -- sync:end queue_pipeline_choices
    ]
    -- The intake statuses of chamber_sessions_status_check (20261103090000_intake_lifecycle.sql).
    WHEN 'intake_status' THEN ARRAY['in_progress', 'submitted', 'expired', 'archived', 'revoked']
  END
$$;

-- The filters of one call, checked: a list of at most 20, each on a listed field, each read by workspace_filter_check.
-- Returns the checked filters, each with its field. Reads no row.
CREATE FUNCTION public.queue_filters_checked(p_filters jsonb, p_today date)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  f jsonb;
  field text;
  kind text;
  checked jsonb;
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
    kind := public.queue_field_kind(field);
    IF kind IS NULL THEN
      RAISE EXCEPTION 'The queue has no field "%" to filter by', left(field, 64) USING ERRCODE = '22023';
    END IF;
    checked := public.workspace_filter_check(kind, f, public.queue_field_choices(field), p_today);
    IF field = 'states' AND checked ? 'vs' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(checked -> 'vs') s WHERE NOT COALESCE(public.is_us_state_code(upper(s)), false)
    ) THEN
      RAISE EXCEPTION 'The filter "states %" takes state codes such as CA', checked ->> 'op' USING ERRCODE = '22023';
    END IF;
    out := out || jsonb_build_array(checked || jsonb_build_object('field', field));
  END LOOP;
  RETURN out;
END;
$$;

-- Whether one queue row passes every checked filter ("and"). A moment is compared as the day it falls on in `p_time_zone`.
CREATE FUNCTION public.queue_row_passes(r public.queue_row, p_checked jsonb, p_time_zone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_checked) f
    WHERE NOT COALESCE(CASE f ->> 'field'
      WHEN 'company_name' THEN public.workspace_filter_match_text(r.company_name, f)
      WHEN 'contact_name' THEN public.workspace_filter_match_text(r.contact_name, f)
      WHEN 'signer_name' THEN public.workspace_filter_match_text(r.signer_name, f)
      WHEN 'file_id' THEN public.workspace_filter_match_text(r.file_id, f)
      WHEN 'needs_action_note' THEN public.workspace_filter_match_text(r.needs_action_note, f)
      WHEN 'start_month' THEN public.workspace_filter_match_text(r.start_month, f)
      WHEN 'employee_count' THEN public.workspace_filter_match_number(r.employee_count, f)
      WHEN 'open_fields' THEN public.workspace_filter_match_number(r.open_fields, f)
      WHEN 'flagged_fields' THEN public.workspace_filter_match_number(r.flagged_fields, f)
      WHEN 'verified_fields' THEN public.workspace_filter_match_number(r.verified_fields, f)
      WHEN 'quote_requests_sent' THEN public.workspace_filter_match_number(r.quote_requests_sent, f)
      WHEN 'quotes_received' THEN public.workspace_filter_match_number(r.quotes_received, f)
      WHEN 'new_peo_mail_requests' THEN public.workspace_filter_match_number(r.new_peo_mail_requests, f)
      WHEN 'submitted_at' THEN public.workspace_filter_match_date((r.submitted_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'created_at' THEN public.workspace_filter_match_date((r.created_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'updated_at' THEN public.workspace_filter_match_date((r.updated_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'oldest_waiting_on' THEN public.workspace_filter_match_date(r.oldest_waiting_on, f)
      WHEN 'earliest_quote_expires_on' THEN public.workspace_filter_match_date(r.earliest_quote_expires_on, f)
      WHEN 'pipeline_status' THEN public.workspace_filter_match_choice(r.pipeline_status, f)
      WHEN 'intake_status' THEN public.workspace_filter_match_choice(r.intake_status, f)
      WHEN 'states' THEN public.workspace_filter_match_choices(r.states, f)
      WHEN 'missing_required' THEN public.workspace_filter_match_choices(r.missing_required, f)
      WHEN 'needs_action' THEN public.workspace_filter_match_yes_no(r.needs_action, f)
      WHEN 'sent_older_version' THEN public.workspace_filter_match_yes_no(r.sent_older_version, f)
      WHEN 'has_new_peo_mail' THEN public.workspace_filter_match_yes_no(r.has_new_peo_mail, f)
      WHEN 'waiting_on_peo' THEN public.workspace_filter_match_yes_no(r.waiting_on_peo, f)
    END, false)
  )
$$;

-- Every queue row the caller may see that the search matches: advisor_list_submissions's rows, by its firm rule, unpaged.
CREATE FUNCTION public.queue_rows(p_search text)
RETURNS SETOF public.queue_row
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT l.session_id, l.company_name, l.contact_name, l.employee_count, l.pipeline_status, l.intake_status, l.signer_name,
         l.submitted_at, l.created_at, l.updated_at, l.missing_required, l.open_fields, l.flagged_fields, l.verified_fields,
         l.file_id, l.states, l.needs_action, l.needs_action_note, l.quote_requests_sent, l.quotes_received, l.oldest_waiting_on,
         l.earliest_quote_expires_on, l.sent_older_version, l.new_peo_mail_requests, l.start_month,
         l.new_peo_mail_requests > 0,
         EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.session_id = l.session_id AND q.status = 'sent')
  FROM public.advisor_list_submissions(NULL, p_search, NULL, 0, NULL, NULL, NULL) l
$$;

-- ---------- 3. What the browser calls ----------

-- One page of the queue: the rows the caller may see that the search and every filter match, sorted, 50 a page, with how
-- many match in all. Returns {"rows": [...], "total": n, "page": p, "page_size": 50}; a page past the end has no rows and
-- the same total.
--
-- Sort: any listed field, "asc" or "desc". Text ignoring case; a choice by its place in the field's list; a list of values
-- by its text; yes before no is "desc"; a moment as a moment. Empty values (null, blank text, an empty list) come last
-- in both directions. Equal values keep the queue's own order (certified first, newest certification, latest change), then
-- the intake's id, so a row is on exactly one page. No sort is the queue's own order.
CREATE FUNCTION public.queue_list_submissions(
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
  tz text;
  checked jsonb;
  sort_kind text;
  choices text[];
  pg integer := COALESCE(p_page, 1);
  result jsonb;
BEGIN
  PERFORM public.require_advisor();
  tz := public.workspace_time_zone(p_time_zone);
  checked := public.queue_filters_checked(p_filters, (now() AT TIME ZONE tz)::date);
  IF p_sort IS NOT NULL THEN
    sort_kind := public.queue_field_kind(p_sort);
    IF sort_kind IS NULL THEN
      RAISE EXCEPTION 'The queue has no field "%" to sort by', left(p_sort, 64) USING ERRCODE = '22023';
    END IF;
    choices := public.queue_field_choices(p_sort);
  END IF;
  IF p_direction IS NULL OR p_direction NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'A sort goes asc or desc' USING ERRCODE = '22023';
  END IF;
  IF pg < 1 OR pg > 100000 THEN
    RAISE EXCEPTION 'A page number is 1 to 100000' USING ERRCODE = '22023';
  END IF;

  WITH matched AS MATERIALIZED (
    SELECT r
    FROM public.queue_rows(p_search) r
    WHERE public.queue_row_passes(r, checked, tz)
  ),
  keyed AS (
    SELECT
      m.r,
      -- One key per type; only the sorted field's is set. Text and a list of values by their text in lower case.
      NULLIF(btrim(CASE WHEN choices IS NULL THEN CASE p_sort
        WHEN 'company_name' THEN lower((m.r).company_name)
        WHEN 'contact_name' THEN lower((m.r).contact_name)
        WHEN 'signer_name' THEN lower((m.r).signer_name)
        WHEN 'file_id' THEN lower((m.r).file_id)
        WHEN 'needs_action_note' THEN lower((m.r).needs_action_note)
        WHEN 'start_month' THEN lower((m.r).start_month)
        WHEN 'states' THEN lower(array_to_string((m.r).states, ', '))
        WHEN 'missing_required' THEN lower(array_to_string((m.r).missing_required, ', '))
      END END), '') AS k_text,
      CASE p_sort
        WHEN 'employee_count' THEN (m.r).employee_count::numeric
        WHEN 'open_fields' THEN (m.r).open_fields
        WHEN 'flagged_fields' THEN (m.r).flagged_fields
        WHEN 'verified_fields' THEN (m.r).verified_fields
        WHEN 'quote_requests_sent' THEN (m.r).quote_requests_sent
        WHEN 'quotes_received' THEN (m.r).quotes_received
        WHEN 'new_peo_mail_requests' THEN (m.r).new_peo_mail_requests
        WHEN 'needs_action' THEN (m.r).needs_action::integer
        WHEN 'sent_older_version' THEN (m.r).sent_older_version::integer
        WHEN 'has_new_peo_mail' THEN (m.r).has_new_peo_mail::integer
        WHEN 'waiting_on_peo' THEN (m.r).waiting_on_peo::integer
        -- A choice by its place in the field's list; a value outside it, if one ever appears, after the listed ones.
        WHEN 'pipeline_status' THEN COALESCE(array_position(choices, (m.r).pipeline_status), cardinality(choices) + 1)
        WHEN 'intake_status' THEN COALESCE(array_position(choices, (m.r).intake_status), cardinality(choices) + 1)
      END AS k_number,
      CASE p_sort
        WHEN 'submitted_at' THEN (m.r).submitted_at
        WHEN 'created_at' THEN (m.r).created_at
        WHEN 'updated_at' THEN (m.r).updated_at
      END AS k_moment,
      CASE p_sort
        WHEN 'oldest_waiting_on' THEN (m.r).oldest_waiting_on
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
      -- Then the queue's own order (advisor_list_submissions), then the id: every row has its one place.
      ((k.r).intake_status = 'submitted') DESC, (k.r).submitted_at DESC NULLS LAST, (k.r).updated_at DESC, (k.r).session_id
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

-- The count for each view's tab (CRM-S3.4): `p_views` is a list of {"name": text, "filters": [...]}, at most 20, names
-- unique; returns one row per view in the order given, each counting what queue_list_submissions would total for those
-- filters and the search, under the same firm rule. One refused filter refuses the call, naming the view.
CREATE FUNCTION public.queue_view_counts(p_views jsonb, p_search text DEFAULT NULL, p_time_zone text DEFAULT 'UTC')
RETURNS TABLE(view_name text, total bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tz text;
  today date;
  v jsonb;
  names text[] := '{}';
  sets jsonb[] := '{}';
BEGIN
  PERFORM public.require_advisor();
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
      sets := sets || public.queue_filters_checked(COALESCE(v -> 'filters', '[]'::jsonb), today);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'View "%": %', v ->> 'name', SQLERRM USING ERRCODE = SQLSTATE;
    END;
    names := names || (v ->> 'name');
  END LOOP;

  RETURN QUERY
  WITH visible AS MATERIALIZED (
    SELECT r FROM public.queue_rows(p_search) r
  )
  SELECT w.name, (SELECT count(*) FROM visible x WHERE public.queue_row_passes(x.r, w.filters, tz))
  FROM unnest(names, sets) WITH ORDINALITY AS w(name, filters, ord)
  ORDER BY w.ord;
END;
$$;

-- The helpers are internal: only the two functions above call them, after their own checks.
REVOKE ALL ON FUNCTION public.workspace_filter_check(text, jsonb, text[], date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_filter_day(jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_filter_match_text(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_filter_match_number(numeric, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_filter_match_date(date, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_filter_match_choice(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_filter_match_choices(text[], jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_filter_match_yes_no(boolean, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_time_zone(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.queue_field_kind(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.queue_field_choices(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.queue_filters_checked(jsonb, date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.queue_row_passes(public.queue_row, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.queue_rows(text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.queue_list_submissions(jsonb, text, text, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.queue_view_counts(jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_list_submissions(jsonb, text, text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_view_counts(jsonb, text, text) TO authenticated;
