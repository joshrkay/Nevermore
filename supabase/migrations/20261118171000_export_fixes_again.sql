-- CRM-S3.8b second review fix, on top of 20261118170500_export_fixes.sql (merged, not edited). docs/BROKER_CRM_BUILD.md D-241.
--
-- 20261118170500 split export_table's reading into three statements (the capped count, the visible count, the rows). Under READ COMMITTED
-- each statement takes its own snapshot, so a row committed between them was returned but not counted: the recorded count was not the
-- count returned (D-48), and the whole-table decision (D-205), the cap and the alert could each judge different rows. Its header (item 1)
-- and D-211 said the count was still true; that was wrong. Restated here with every rule, refusal and lock it had: the three are one
-- statement again, so one snapshot, and the build is gated on the capped count, so a refused export still builds nothing (D-211's
-- property). The count recorded, the whole-table decision and the alert are all taken from the rows built.

SET lock_timeout = '5s';

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
  matched_n bigint;
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

  -- One statement, so one snapshot (READ COMMITTED gives each statement its own): how many rows match, counted no further than one past
  -- the cap; how many the caller may see, counted no further than one past that; and the rows themselves, built only when the count is
  -- within the cap (a refused export builds nothing). What is recorded, judged whole and alerted on is what was built (D-241).
  WITH cnt AS MATERIALIZED (
    SELECT count(*) AS n FROM (
      SELECT 1 FROM public.export_rows(p_firm_id, p_table, keys) v
      WHERE checked = '[]'::jsonb OR public.export_row_passes(p_table, v.o, checked, tz)
      LIMIT cap + 1) x
  ), vis AS MATERIALIZED (
    SELECT count(*) AS n FROM (
      SELECT 1 FROM public.export_rows(p_firm_id, p_table, NULL) v LIMIT (SELECT cnt.n FROM cnt) + 1) y
  ), built AS MATERIALIZED (
    SELECT (SELECT jsonb_agg(v.o -> c.name ORDER BY c.i) FROM unnest(cols) WITH ORDINALITY AS c(name, i)) AS r,
           row_number() OVER (ORDER BY
             CASE WHEN p_table = 'referral_partners' THEN v.s END, CASE WHEN p_table = 'referral_partners' THEN v.k END,
             CASE WHEN p_table = 'firm_activity' THEN v.s END DESC, CASE WHEN p_table = 'firm_activity' THEN v.k END DESC) AS ord
    FROM public.export_rows(p_firm_id, p_table, keys) v
    WHERE (SELECT cnt.n FROM cnt) <= cap
      AND (checked = '[]'::jsonb OR public.export_row_passes(p_table, v.o, checked, tz))
  )
  SELECT (SELECT cnt.n FROM cnt), (SELECT vis.n FROM vis), (SELECT count(*) FROM built),
         (SELECT COALESCE(jsonb_agg(m.r ORDER BY m.ord), '[]'::jsonb) FROM built m)
    INTO matched_n, visible_n, n, rows_out;

  IF matched_n > cap THEN
    RAISE EXCEPTION 'This export would hold more than % rows, the most one export holds. Narrow it with a filter.', cap USING ERRCODE = '54000';
  END IF;
  -- n is the count of the rows built and returned, from the same snapshot as visible_n.
  whole := n > 0 AND n = visible_n;
  IF whole AND NOT public.signed_in_within(public.export_fresh_sign_in()) THEN
    RAISE EXCEPTION 'Sign in again to export the whole table: you last signed in more than 12 hours ago' USING ERRCODE = 'PT428';
  END IF;

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
