-- Epic 3's export supersedes main's (founder, 2026-11-14; docs/BROKER_CRM_BUILD.md "Superseded by Epic 3", M-200 to M-242; D-218).
--
-- CRM-S3.8b was built twice: on main as export_table (20261118170000_export.sql, 20261118170500_export_fixes.sql and
-- 20261118171000_export_fixes_again.sql, which may already be applied in production and are not edited), and on the Epic 3 branch as
-- export_rows (20261119090000_export.sql). The founder decided Epic 3's version wins. This migration runs between the two: it takes out
-- what main's export created that would clash with Epic 3's, or duplicate it, so 20261119090000 applies as it is written and the database
-- ends as Epic 3 designed it. Nothing main's export recorded is lost:
--
--   1. The exports main recorded in the firm's record (entries of kind export_made, record type 'table', with their row_count) are copied,
--      every column as it is, into a holding table, and taken out of firm_activity. 20261119090000 adds row_count afresh and checks every
--      entry against its rule (an export_made entry, and only one, carries a count and is about a table), which an entry it cannot give a
--      count to would fail. 20261119090500_epic3_export_carried.sql puts them back once the column and its rule exist, with the same number,
--      key, time, actor and count, and drops the holding table. The record is append-only (guard_firm_activity); its guard is set aside for
--      the one delete and nothing else, as the migrations that restate an intake's rows do with theirs.
--      main's export_table is live until step 4 and writes an export's entry and then its alert in one transaction, so nothing may write
--      to firm_activity or the outbox while they are set aside: both are locked (SHARE ROW EXCLUSIVE, in the order export_table writes
--      them) before anything is read. The lock waits for an export already writing, which is then copied with the rest; an export that
--      starts later waits for this migration and then fails on the dropped column, recording nothing. Steps 1 to 3 are one statement (a DO
--      block), so they are one transaction and the locks hold throughout even where a file is run statement by statement (psql, as the
--      SQL tests do); `supabase db push` and the e2e stack run each file in one transaction, which keeps them to the end of the file.
--   2. The owners' alerts main queued (outbox kind export_alert) stay in the outbox. Their payload names the table by its name (`table`);
--      Epic 3's dispatcher reads the table in words (`table_label`, D-218) and refuses an alert without it, so each is rewritten into Epic
--      3's shape, with the words export_table_registry() gives that table. Everything else in the payload is already Epic 3's.
--   3. main's column and its rule go: firm_activity.row_count (with its grant) and firm_activity_export_check, which 20261119090000 adds
--      again under the same names. firm_activity_list is restated as it was before main's export (20261116160001), so the database is
--      whole between the two; 20261119090000 restates it with the count.
--   4. main's functions go, each by its signature: export_table and the internal ones it called (export_rows(uuid, text, text[]), whose name
--      Epic 3's export_rows(uuid, text, jsonb, jsonb) reuses with other arguments; the column, filter, key and row checks; the limits; the
--      moment), and signed_in_within, which only export_table asked (Epic 3's fresh sign-in is caller_last_sign_in_at).
--
-- Left as they are, because they are already exactly what 20261119090000 restates: the outbox kind export_alert, the rule that it is a
-- firm-level row (outbox_events_one_target), outbox_kind_is_firm_alert, and the record type 'table' in firm_activity_record_check.

SET lock_timeout = '5s';

DO $$
BEGIN
  -- Nothing writes an export while it is set aside (see 1 above).
  LOCK TABLE public.firm_activity IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.outbox_events IN SHARE ROW EXCLUSIVE MODE;

  -- 1. main's recorded exports, set aside with every column.
  CREATE TABLE public.epic3_carried_exports AS
    SELECT a.* FROM public.firm_activity a
    WHERE a.kind = 'export_made' OR a.record_type = 'table' OR a.row_count IS NOT NULL;

  ALTER TABLE public.epic3_carried_exports ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.epic3_carried_exports FROM PUBLIC, anon, authenticated, service_role;

  ALTER TABLE public.firm_activity DISABLE TRIGGER firm_activity_append_only;
  DELETE FROM public.firm_activity a USING public.epic3_carried_exports c WHERE a.id = c.id;
  ALTER TABLE public.firm_activity ENABLE TRIGGER firm_activity_append_only;

  -- 2. main's alerts, in Epic 3's shape.
  UPDATE public.outbox_events e
  SET payload = (e.payload - 'table') || jsonb_build_object('table_label',
        CASE e.payload ->> 'table' WHEN 'referral_partners' THEN 'Referral partners' WHEN 'firm_activity' THEN 'The firm''s record' ELSE e.payload ->> 'table' END)
  WHERE e.kind = 'export_alert' AND e.payload ? 'table' AND NOT e.payload ? 'table_label';

  -- 3. main's column and its rule.
  ALTER TABLE public.firm_activity DROP CONSTRAINT firm_activity_export_check;
  ALTER TABLE public.firm_activity DROP COLUMN row_count;
END $$;

-- 3. The owners' reading of the record as it was before main's column.
DROP FUNCTION public.firm_activity_list(uuid, uuid, text, integer, timestamptz, uuid, boolean);
CREATE FUNCTION public.firm_activity_list(
  p_firm_id uuid, p_person uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_limit integer DEFAULT 50,
  p_before_at timestamptz DEFAULT NULL, p_before_key uuid DEFAULT NULL, p_nevermore boolean DEFAULT false)
RETURNS TABLE (
  entry_key uuid, at timestamptz, actor_id uuid, actor_email text, by_nevermore boolean, kind text, record_type text, record_id text,
  subject_user_id uuid, subject_email text, role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.can_read_firm_activity(p_firm_id) THEN
    RAISE EXCEPTION 'Only a firm''s owners can read its record' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR (p_before_at IS NULL) <> (p_before_key IS NULL) THEN
    RAISE EXCEPTION 'A page is 1 to 100 entries, after an entry given by its time and key together' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT a.entry_key, a.at, CASE WHEN a.actor_is_staff THEN NULL ELSE a.actor_id END, u.email::text, a.actor_is_staff, a.kind, a.record_type, a.record_id, a.subject_user_id, su.email::text, a.role
    FROM public.firm_activity a
    LEFT JOIN auth.users u ON u.id = a.actor_id AND NOT a.actor_is_staff
    LEFT JOIN auth.users su ON su.id = a.subject_user_id
    WHERE a.firm_id = p_firm_id
      AND (p_person IS NULL OR (a.actor_id = p_person AND NOT a.actor_is_staff))
      AND (NOT COALESCE(p_nevermore, false) OR a.actor_is_staff)
      AND (p_kind IS NULL OR a.kind = p_kind)
      AND (p_before_at IS NULL OR (a.at, a.entry_key) < (p_before_at, p_before_key))
    ORDER BY a.at DESC, a.entry_key DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_activity_list(uuid, uuid, text, integer, timestamptz, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_activity_list(uuid, uuid, text, integer, timestamptz, uuid, boolean) TO authenticated;

-- 4. main's functions.
DROP FUNCTION public.export_table(uuid, text, jsonb, jsonb, jsonb, text);
DROP FUNCTION public.export_rows(uuid, text, text[]);
DROP FUNCTION public.export_row_passes(text, jsonb, jsonb, text);
DROP FUNCTION public.export_keys_checked(jsonb);
DROP FUNCTION public.export_filters_checked(text, jsonb, date);
DROP FUNCTION public.export_columns_checked(text, jsonb);
DROP FUNCTION public.export_field_kind(text, text);
DROP FUNCTION public.export_columns(text);
DROP FUNCTION public.export_moment(timestamptz);
DROP FUNCTION public.export_row_cap();
DROP FUNCTION public.export_alert_rows();
DROP FUNCTION public.export_alert_repeats();
DROP FUNCTION public.export_fresh_sign_in();
DROP FUNCTION public.signed_in_within(interval);
