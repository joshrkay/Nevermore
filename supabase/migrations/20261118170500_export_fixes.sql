-- CRM-S3.8b review fixes, on top of 20261118170000_export.sql (which is merged and not edited). docs/BROKER_CRM_BUILD.md D-211, D-212.
--
--  1. An export past the cap is refused before it is built (D-211). The first build turned every matching row into JSON, numbered and
--     sorted every visible row, and gathered them all, and only then compared the count with the cap: an export of a very large table did
--     all that work to be refused. Now the matching rows are counted, stopping at one past the cap, and the cap is checked, before any row
--     is gathered; the whole-table test counts the visible rows only up to one past the export's own count; and the rows are built, sorted
--     and gathered only once both have passed. A selection is applied inside the rows' own query, by its key, so a selection of two rows
--     of a large table reads two rows. The count recorded is still the count returned, and every rule and refusal is as it was.
--  2. The rows are one SQL function with no SET clause (export_rows), so Postgres folds it into each query that reads it (as D-134's
--     quote_requests_with_new_peo_mail): a count reads no column it does not need. Each table's rule is still asked inside it, once per
--     query rather than once per row. It is executable by no API role; every name in it is schema-qualified.

SET lock_timeout = '5s';

-- The rows of a table of a firm the caller may see, each with its key (what a selection names), its sort key, and its exportable
-- columns, narrowed to the selection when one is given. Unordered: the reader orders by `s` and `k` (partners by name then code; the
-- record newest first). Internal.
CREATE FUNCTION public.export_rows(p_firm_id uuid, p_table text, p_keys text[])
RETURNS TABLE (k text, s text, o jsonb)
LANGUAGE sql
STABLE
AS $$
  SELECT r.code, lower(r.name),
         jsonb_build_object('code', r.code, 'name', r.name, 'kind', r.kind,
                            'created_at', public.export_moment(r.created_at), 'updated_at', public.export_moment(r.updated_at))
  FROM public.referral_partners r
  WHERE p_table = 'referral_partners' AND r.firm_id = p_firm_id AND (p_keys IS NULL OR r.code = ANY (p_keys))
    AND (SELECT public.is_firm_member(p_firm_id))
  UNION ALL
  SELECT a.entry_key::text, to_char(a.at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US'),
         jsonb_build_object('at', public.export_moment(a.at),
                            'who', CASE WHEN a.actor_is_staff THEN 'Nevermore' WHEN a.actor_id IS NULL THEN 'System' ELSE u.email::text END,
                            'kind', a.kind, 'record_type', a.record_type, 'record_id', a.record_id, 'subject', su.email::text,
                            'role', a.role, 'rows', a.row_count)
  FROM public.firm_activity a
  LEFT JOIN auth.users u ON u.id = a.actor_id AND NOT a.actor_is_staff
  LEFT JOIN auth.users su ON su.id = a.subject_user_id
  WHERE p_table = 'firm_activity' AND a.firm_id = p_firm_id AND (p_keys IS NULL OR a.entry_key::text = ANY (p_keys))
    AND (SELECT public.can_read_firm_activity(p_firm_id))
$$;

REVOKE ALL ON FUNCTION public.export_rows(uuid, text, text[]) FROM PUBLIC, anon, authenticated, service_role;

-- The first build's rows (20261118170000), replaced by export_rows; nothing else called it.
DROP FUNCTION public.export_visible_rows(uuid, text);

-- export_table (20261118170000), restated with every rule, refusal and lock it had, in the same order. What changed: how the rows are
-- counted and built (1 above), and the cap's sentence, which now says "more than" the cap, since the count stops there.
CREATE OR REPLACE FUNCTION public.export_table(
  p_firm_id uuid,
  p_table text,
  p_columns jsonb,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_keys jsonb DEFAULT NULL,
  p_time_zone text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cols text[];
  tz text;
  checked jsonb;
  keys text[];
  visible_n bigint;
  n bigint;
  rows_out jsonb;
  whole boolean;
  e public.firm_activity;
  recent integer;
  cap constant integer := public.export_row_cap();
BEGIN
  -- D-128: before anything else, of the firm named (a NULL refuses a caller who holds any open session).
  PERFORM public.refuse_support_session(p_firm_id);
  IF NOT public.is_signed_in_person() OR p_firm_id IS NULL OR public.firm_role(p_firm_id) IS NULL THEN
    RAISE EXCEPTION 'Only a member of this firm can export its records' USING ERRCODE = '42501';
  END IF;
  IF p_table IN ('submissions', 'queue') THEN
    RAISE EXCEPTION 'The queue can''t be exported: its columns are an intake''s answers' USING ERRCODE = '22023';
  END IF;
  IF public.export_columns(p_table) IS NULL THEN
    RAISE EXCEPTION 'There is no table called "%" to export', left(p_table, 64) USING ERRCODE = '22023';
  END IF;
  IF p_table = 'firm_activity' AND NOT public.can_read_firm_activity(p_firm_id) THEN
    RAISE EXCEPTION 'Only a firm''s owners can export its record' USING ERRCODE = '42501';
  END IF;
  cols := public.export_columns_checked(p_table, p_columns);
  tz := public.workspace_time_zone(p_time_zone);
  checked := public.export_filters_checked(p_table, p_filters, (now() AT TIME ZONE tz)::date);
  keys := public.export_keys_checked(p_keys);

  -- One member's exports in one firm are counted one at a time, so two at once can't both miss being the third in the hour (D-207).
  PERFORM pg_advisory_xact_lock(hashtextextended('export_table:' || p_firm_id::text || ':' || auth.uid()::text, 0));

  -- How many rows the export holds, counted no further than one past the cap, with nothing built but what a filter reads (D-211).
  IF checked = '[]'::jsonb THEN
    SELECT count(*) INTO n FROM (SELECT 1 FROM public.export_rows(p_firm_id, p_table, keys) v LIMIT cap + 1) x;
  ELSE
    SELECT count(*) INTO n FROM (
      SELECT 1 FROM public.export_rows(p_firm_id, p_table, keys) v WHERE public.export_row_passes(p_table, v.o, checked, tz) LIMIT cap + 1) x;
  END IF;
  IF n > cap THEN
    RAISE EXCEPTION 'This export would hold more than % rows, the most one export holds. Narrow it with a filter.', cap USING ERRCODE = '54000';
  END IF;
  -- Whether it holds every row the caller may see (D-205): the visible rows, counted no further than one past the export's own.
  SELECT count(*) INTO visible_n FROM (SELECT 1 FROM public.export_rows(p_firm_id, p_table, NULL) v LIMIT n + 1) x;
  whole := n > 0 AND n = visible_n;
  IF whole AND NOT public.signed_in_within(public.export_fresh_sign_in()) THEN
    RAISE EXCEPTION 'Sign in again to export the whole table: you last signed in more than 12 hours ago' USING ERRCODE = 'PT428';
  END IF;

  -- Only now are the rows built, each as its columns in the order asked, in the table's order.
  SELECT COALESCE(jsonb_agg(m.r ORDER BY m.ord), '[]'::jsonb) INTO rows_out
  FROM (
    SELECT (SELECT jsonb_agg(v.o -> c.name ORDER BY c.i) FROM unnest(cols) WITH ORDINALITY AS c(name, i)) AS r,
           row_number() OVER (ORDER BY
             CASE WHEN p_table = 'referral_partners' THEN v.s END, CASE WHEN p_table = 'referral_partners' THEN v.k END,
             CASE WHEN p_table = 'firm_activity' THEN v.s END DESC, CASE WHEN p_table = 'firm_activity' THEN v.k END DESC) AS ord
    FROM public.export_rows(p_firm_id, p_table, keys) v
    WHERE checked = '[]'::jsonb OR public.export_row_passes(p_table, v.o, checked, tz)
  ) m;

  -- The record (D-48, D-200): who, when, which table, how many rows. The staff stamp is the record's own rule (D-33, D-131).
  INSERT INTO public.firm_activity (firm_id, actor_id, actor_is_staff, kind, record_type, record_id, row_count)
  VALUES (p_firm_id, auth.uid(), public.firm_actor_is_staff(auth.uid(), p_firm_id), 'export_made', 'table', p_table, n)
  RETURNING * INTO e;

  -- The owners' alert (D-206): one email for this export when it is large, or is the member's third within the hour, or both.
  SELECT count(*) INTO recent FROM public.firm_activity a
  WHERE a.firm_id = p_firm_id AND a.actor_id = auth.uid() AND a.kind = 'export_made' AND a.at > e.at - interval '1 hour';
  IF n > public.export_alert_rows() OR recent = public.export_alert_repeats() THEN
    INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
    SELECT 'export_alert', p_firm_id, 'export_alert:' || e.entry_key,
           jsonb_build_object('member_email', lower(btrim(u.email)), 'firm_name', f.name, 'table', p_table, 'row_count', n,
                              'exported_at', to_char(e.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                              'large', n > public.export_alert_rows(), 'exports_in_hour', recent)
    FROM auth.users u, public.firms f
    WHERE u.id = auth.uid() AND f.id = p_firm_id
    ON CONFLICT (kind, dedupe_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('table', p_table, 'columns', to_jsonb(cols), 'rows', rows_out, 'row_count', n, 'whole_table', whole,
                            'exported_at', public.export_moment(e.at));
END;
$$;

REVOKE ALL ON FUNCTION public.export_table(uuid, text, jsonb, jsonb, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_table(uuid, text, jsonb, jsonb, jsonb, text) TO authenticated;
