-- The queue's query, follow-ups from review (story CRM-S3.3b; 20261117100000_queue_query.sql).
--
-- 1. A faster path for the requests today's queue already makes. Asked for every row unpaged, advisor_list_submissions
--    works out its costly columns (missing items, open items) for every row; asked for one page, it works them out for that
--    page's rows only. So when a request means nothing advisor_list_submissions can't say with its own arguments (no filter
--    but one stage, needs action and waiting on a PEO, no sort but the two it has, oldest wait and earliest expiry, both
--    ascending), queue_list_submissions now asks it for the one page, with its total; for a page past the end, where no row
--    carries the total, it asks again for the first row alone, which carries it. Anything else takes the full path as
--    before. The two give the same rows, order and total (supabase/tests/queue_query.sql, section 9), so nobody can tell
--    which ran.
-- 2. The caller's time zone is an IANA name (Area/Location) or UTC, nothing else: an abbreviation such as PST is a fixed
--    offset with no daylight saving, so a date filter would be an hour out half the year; specials such as Z, zulu,
--    localtime and Factory are not a person's zone.
-- 3. The browser's list of the queue's fields (src/lib/queueApi.ts QUEUE_FIELDS) is compared with queue_field_kind's
--    `queue_fields` block by src/lib/queueApi.test.ts (20261117100000's comment names src/data/schemaSync.test.ts; it is
--    not that one).

SET lock_timeout = '5s';

-- ---------- 2. The time zone ----------
CREATE OR REPLACE FUNCTION public.workspace_time_zone(p_time_zone text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_time_zone IS NULL THEN
    RETURN 'UTC';
  END IF;
  -- UTC, or Area/Location as the database's zone list names it. Abbreviations (PST, EST, GMT) and specials (Z, zulu,
  -- localtime, Factory, posixrules, EST5EDT) have no "/" and are not UTC; the copies under posix/ and right/ are not names
  -- a browser gives.
  IF p_time_zone = 'UTC'
     OR (char_length(p_time_zone) <= 64
         AND p_time_zone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){1,2}$'
         AND p_time_zone !~ '^(posix|right)/'
         AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_time_zone)) THEN
    RETURN p_time_zone;
  END IF;
  RAISE EXCEPTION 'Unknown time zone "%"', left(p_time_zone, 64) USING ERRCODE = '22023';
END;
$$;

-- ---------- 1. The faster path ----------

-- The full path is 20261117100000's queue_list_submissions, kept as it is under another name and now internal: the one
-- below calls it for everything the faster path can't answer.
ALTER FUNCTION public.queue_list_submissions(jsonb, text, text, integer, text, text) RENAME TO queue_page_full;
ALTER FUNCTION public.queue_page_full(jsonb, text, text, integer, text, text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.queue_page_full(jsonb, text, text, integer, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- What advisor_list_submissions's own arguments would say for these checked filters and sort, or NULL when they can't say
-- it: at most one filter each of a single stage, needs action (yes or no) and waiting on a PEO (yes or no), and no sort or
-- oldest_waiting_on / earliest_quote_expires_on ascending. Reads no row.
CREATE FUNCTION public.queue_fast_arguments(p_checked jsonb, p_sort text, p_direction text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  f jsonb;
  status text;
  action boolean;
  waiting boolean;
  old_sort text;
BEGIN
  IF p_sort IS NOT NULL THEN
    IF p_direction = 'asc' AND p_sort = 'oldest_waiting_on' THEN
      old_sort := 'oldest_waiting';
    ELSIF p_direction = 'asc' AND p_sort = 'earliest_quote_expires_on' THEN
      old_sort := 'earliest_expiry';
    ELSE
      RETURN NULL;
    END IF;
  END IF;
  FOR f IN SELECT e FROM jsonb_array_elements(COALESCE(p_checked, '[]'::jsonb)) e LOOP
    IF f ->> 'field' = 'pipeline_status' AND f ->> 'op' = 'any_of' AND jsonb_array_length(f -> 'vs') = 1 AND status IS NULL THEN
      status := f -> 'vs' ->> 0;
    ELSIF f ->> 'field' = 'needs_action' AND f ->> 'op' = 'is' AND action IS NULL THEN
      action := (f ->> 'v')::boolean;
    ELSIF f ->> 'field' = 'waiting_on_peo' AND f ->> 'op' = 'is' AND waiting IS NULL THEN
      waiting := (f ->> 'v')::boolean;
    ELSE
      RETURN NULL;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('status', status, 'action', action, 'waiting', waiting, 'sort', old_sort);
END;
$$;

-- One page from advisor_list_submissions's own arguments, shaped as queue_page_full shapes it (the same row as queue_rows,
-- the same keys). An empty page past the first takes its total from the first row alone (a page of one, which works out
-- the costly columns for that row only).
CREATE FUNCTION public.queue_page_fast(p_args jsonb, p_page integer, p_search text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH l AS (
    SELECT l.*
    FROM public.advisor_list_submissions(p_args ->> 'status', p_search, 50, (p_page - 1) * 50,
      (p_args ->> 'action')::boolean, (p_args ->> 'waiting')::boolean, p_args ->> 'sort')
      WITH ORDINALITY AS l(session_id, company_name, contact_name, employee_count, pipeline_status, intake_status, signer_name,
        submitted_at, created_at, updated_at, missing_required, open_fields, flagged_fields, verified_fields, file_id, states,
        needs_action, needs_action_note, quote_requests_sent, quotes_received, oldest_waiting_on, earliest_quote_expires_on,
        sent_older_version, new_peo_mail_requests, start_month, total_count, ord)
  )
  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(to_jsonb(ROW(
        l.session_id, l.company_name, l.contact_name, l.employee_count, l.pipeline_status, l.intake_status, l.signer_name,
        l.submitted_at, l.created_at, l.updated_at, l.missing_required, l.open_fields, l.flagged_fields, l.verified_fields,
        l.file_id, l.states, l.needs_action, l.needs_action_note, l.quote_requests_sent, l.quotes_received, l.oldest_waiting_on,
        l.earliest_quote_expires_on, l.sent_older_version, l.new_peo_mail_requests, l.start_month,
        l.new_peo_mail_requests > 0,
        EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.session_id = l.session_id AND q.status = 'sent')
      )::public.queue_row) ORDER BY l.ord), '[]'::jsonb),
    'total', COALESCE(max(l.total_count), CASE WHEN p_page > 1 THEN (
      SELECT f.total_count FROM public.advisor_list_submissions(p_args ->> 'status', p_search, 1, 0,
        (p_args ->> 'action')::boolean, (p_args ->> 'waiting')::boolean, p_args ->> 'sort') f
    ) END, 0),
    'page', p_page,
    'page_size', 50
  )
  FROM l
$$;

REVOKE ALL ON FUNCTION public.queue_fast_arguments(jsonb, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.queue_page_fast(jsonb, integer, text) FROM PUBLIC, anon, authenticated, service_role;

-- What the browser calls: as in 20261117100000 (the same arguments, checks, refusals and answer), by the faster path when
-- it can.
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
  tz text;
  checked jsonb;
  args jsonb;
  pg integer := COALESCE(p_page, 1);
BEGIN
  -- The same checks, in the same order, as the full path, so a refusal reads the same whichever path would have run.
  PERFORM public.require_advisor();
  tz := public.workspace_time_zone(p_time_zone);
  checked := public.queue_filters_checked(p_filters, (now() AT TIME ZONE tz)::date);
  IF p_sort IS NOT NULL AND public.queue_field_kind(p_sort) IS NULL THEN
    RAISE EXCEPTION 'The queue has no field "%" to sort by', left(p_sort, 64) USING ERRCODE = '22023';
  END IF;
  IF p_direction IS NULL OR p_direction NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'A sort goes asc or desc' USING ERRCODE = '22023';
  END IF;
  IF pg < 1 OR pg > 100000 THEN
    RAISE EXCEPTION 'A page number is 1 to 100000' USING ERRCODE = '22023';
  END IF;

  args := public.queue_fast_arguments(checked, p_sort, p_direction);
  IF args IS NOT NULL THEN
    RETURN public.queue_page_fast(args, pg, p_search);
  END IF;
  RETURN public.queue_page_full(p_filters, p_sort, p_direction, pg, p_search, p_time_zone);
END;
$$;

REVOKE ALL ON FUNCTION public.queue_list_submissions(jsonb, text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_list_submissions(jsonb, text, text, integer, text, text) TO authenticated;
