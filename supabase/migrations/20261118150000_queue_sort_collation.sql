SET lock_timeout = '5s';

-- The queue's text sorts follow the alphabet, not code points (story CRM-S3.2a, after review; 20261117100000_queue_query.sql and
-- 20261117100500_queue_query_fast_path.sql, which are merged and are not edited).
--
-- queue_page_full sorted text by lower(x) compared under the database's own collation. Where that is C or C.UTF-8 (the test
-- databases) it is code-point order, so "Émile" and "Ünal" sorted after "zeta". Every text sort key (company, contact, signer, File ID,
-- the advisor's note, target start) and the two list-as-text keys (states, missing items) is now lowered and compared under the ICU
-- root collation "und-x-icu", as saved view names already are (20261117120500_table_settings_fixes.sql, point 5): the rule is the
-- same whatever the database's collation. Everything else in the function is as it was: the limits and refusals, empty values last in
-- both directions, a choice by its place in its list, equal values in the queue's own order and then the intake's id, the page, the
-- total. queue_list_submissions (the faster path) sorts no text, only oldest wait and earliest expiry, so it is not restated. Text
-- search and the "contains" and "is" filters lower and compare in queue_rows / workspace_filter_match_text and are not changed.

-- Stock Postgres and Supabase are built with ICU; without it this stops here rather than fall back to the database's own order.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'und-x-icu' AND collnamespace = 'pg_catalog'::regnamespace) THEN
    RAISE EXCEPTION 'The ICU collation "und-x-icu" is missing: the queue can''t be sorted by text in alphabetical order';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.queue_page_full(
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
SECURITY INVOKER
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
      -- One key per type; only the sorted field's is set. Text and a list of values by their text in lower case, compared by the ICU
      -- collation, so "Émile" sorts beside "emile", not after "zeta" as code-point order would put it.
      NULLIF(btrim(CASE WHEN choices IS NULL THEN CASE p_sort
        WHEN 'company_name' THEN lower((m.r).company_name COLLATE "und-x-icu")
        WHEN 'contact_name' THEN lower((m.r).contact_name COLLATE "und-x-icu")
        WHEN 'signer_name' THEN lower((m.r).signer_name COLLATE "und-x-icu")
        WHEN 'file_id' THEN lower((m.r).file_id COLLATE "und-x-icu")
        WHEN 'needs_action_note' THEN lower((m.r).needs_action_note COLLATE "und-x-icu")
        WHEN 'start_month' THEN lower((m.r).start_month COLLATE "und-x-icu")
        WHEN 'states' THEN lower(array_to_string((m.r).states, ', ') COLLATE "und-x-icu")
        WHEN 'missing_required' THEN lower(array_to_string((m.r).missing_required, ', ') COLLATE "und-x-icu")
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

-- Internal, as the first definition made it: only queue_list_submissions calls it, after its own checks.
REVOKE ALL ON FUNCTION public.queue_page_full(jsonb, text, text, integer, text, text) FROM PUBLIC, anon, authenticated, service_role;
