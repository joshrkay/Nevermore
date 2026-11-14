-- Export in the database (story CRM-S3.8b; docs/BROKER_CRM_BUILD.md D-24, D-33, D-40, D-44, D-48, D-104, D-115, D-128, D-200 to D-214;
-- ADR 0006, 0024).
--
-- One function, export_table(firm, table, columns, filters, keys, time zone), returns the rows of one of a fixed list of tables that the
-- caller may see AND records the export in the same transaction, so the recorded count is the count returned and the record cannot be
-- skipped (D-48). It is the only way the product exports; the Export button and the CSV are CRM-S3.8a's.
--
--   1. The record: an export is an entry in the firm's record of who did what (firm_activity), kind 'export_made' (accepted since
--      20261116160001), record type 'table' (new here), the table's name as the record id, and the number of rows in a new column,
--      row_count. Owners read it there, ninety days, as every other entry (D-200).
--   2. What can be exported: referral partners (any current member) and the firm's record (its owners). Never the queue: its columns are an
--      intake's answers (D-48). Each table has a fixed list of columns and of filter fields; nothing else is reachable (D-201, D-202).
--   3. Who: refuse_support_session(firm) first, before anything is read or written (D-128); then a current member at the firm's address
--      (firm_role, D-40); then the table's own rule (D-203).
--   4. The cap: 10,000 rows. A larger export is refused, never cut short (D-204).
--   5. A whole-table export (every row the caller may see, at least one) needs a sign-in within 12 hours, read from the sign-in token's
--      `amr` timestamps (D-205).
--   6. The owners' alert: more than 500 rows, or a member's third export within an hour, queues one firm-level email to the firm's
--      current owners, kind 'export_alert', through the outbox (D-206, D-207).
--   7. A closing firm may export (its owners are offered a full export first, PRD 8.5): exempt from assert_firm_writable (D-208).
--
-- No SQL is built from what the caller sends (D-44): no EXECUTE, no format(). A table or field name chooses a branch of a fixed CASE.

SET lock_timeout = '5s';

-- ---------- 1. The record of an export ----------

-- How many rows an export held. Only an export carries it, and an export always does, as an entry about a table. NOT VALID: entries
-- written before this migration are left as they are (none of kind 'export_made' can exist: nothing wrote that kind), every new one is held to it.
ALTER TABLE public.firm_activity ADD COLUMN row_count integer;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_export_check CHECK (
  (kind = 'export_made') = (row_count IS NOT NULL)
  AND (kind <> 'export_made' OR (record_type = 'table' AND row_count >= 0))) NOT VALID;

-- The record's kinds of record (20261118120000), with one more: a table, for an export. The record id is the table's name.
ALTER TABLE public.firm_activity DROP CONSTRAINT firm_activity_record_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_record_check CHECK (
  record_type IN (
    -- sync:begin firm_activity_record_types
    'submission', 'document', 'manuscript', 'quote_request', 'membership', 'firm', 'support_session', 'support_session_end', 'table'
    -- sync:end firm_activity_record_types
  )
  AND record_id ~ '^[A-Za-z0-9_-]{1,64}$');

GRANT SELECT (row_count) ON public.firm_activity TO authenticated;

-- The owners' reading of the record (20261116160001), with every rule it had and one more column, how many rows an export held (null for
-- every other entry). Its return type changes, so it is dropped and made again with the same arguments and grants.
DROP FUNCTION public.firm_activity_list(uuid, uuid, text, integer, timestamptz, uuid, boolean);
CREATE FUNCTION public.firm_activity_list(
  p_firm_id uuid, p_person uuid DEFAULT NULL, p_kind text DEFAULT NULL, p_limit integer DEFAULT 50,
  p_before_at timestamptz DEFAULT NULL, p_before_key uuid DEFAULT NULL, p_nevermore boolean DEFAULT false)
RETURNS TABLE (
  entry_key uuid, at timestamptz, actor_id uuid, actor_email text, by_nevermore boolean, kind text, record_type text, record_id text,
  subject_user_id uuid, subject_email text, role text, row_count integer)
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
    SELECT a.entry_key, a.at, CASE WHEN a.actor_is_staff THEN NULL ELSE a.actor_id END, u.email::text, a.actor_is_staff, a.kind, a.record_type, a.record_id, a.subject_user_id, su.email::text, a.role, a.row_count
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

-- ---------- 2. The limits, each written once ----------

-- The most rows one export holds (D-204).
CREATE FUNCTION public.export_row_cap() RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$ SELECT 10000 $$;
-- An export of more rows than this tells the firm's owners (PRD 8.6, CRM-P2.3).
CREATE FUNCTION public.export_alert_rows() RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$ SELECT 500 $$;
-- A member's export that is this many within the last hour tells the firm's owners (D-207).
CREATE FUNCTION public.export_alert_repeats() RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$ SELECT 3 $$;
-- How recent a sign-in a whole-table export needs (CRM-P1.3, D-205).
CREATE FUNCTION public.export_fresh_sign_in() RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$ SELECT interval '12 hours' $$;

REVOKE ALL ON FUNCTION public.export_row_cap(), public.export_alert_rows(), public.export_alert_repeats(), public.export_fresh_sign_in()
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. A recent sign-in ----------

-- Whether the caller's sign-in proved who they are within `p_window`: the latest `timestamp` in the token's `amr` (how this sign-in was
-- made, each method with the moment it was used: a password, a provider, a code, a second factor). Supabase Auth signs the token and
-- keeps `amr` across refreshes, so refreshing a session does not make it recent, and signing in again (or completing a second factor
-- again) does. `iat` is not used: it is renewed by every refresh. A token with no `amr` (none the product issues) is not recent. Reusable
-- by the other step CRM-P1.3 asks a recent sign-in for (changing members); only exports ask it today.
CREATE FUNCTION public.signed_in_within(p_window interval)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT max((e ->> 'timestamp')::numeric)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(auth.jwt() -> 'amr') = 'array' THEN auth.jwt() -> 'amr' ELSE '[]'::jsonb END) e
    WHERE jsonb_typeof(e) = 'object' AND jsonb_typeof(e -> 'timestamp') = 'number'
  ) >= extract(epoch FROM now() - p_window), false)
$$;

REVOKE ALL ON FUNCTION public.signed_in_within(interval) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signed_in_within(interval) TO authenticated;

-- ---------- 4. The tables, their columns and their filters ----------

-- The columns each table exports, in the order a whole row has them. A name not here can't be asked for. Nothing here holds an intake's
-- answers, a census, a FEIN or a file (ADR 0006, docs/DATA_HANDLING.md): referral partners are a firm's own contacts' names and kinds; the
-- record holds kinds and ids, never content. Who wrote a partner (created_by_email, updated_by_email) is left out: a partner of the default
-- firm can have been written by a person of Nevermore's, whom a firm never learns (D-33).
CREATE FUNCTION public.export_columns(p_table text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_table
    -- sync:begin export_columns_referral_partners
    WHEN 'referral_partners' THEN ARRAY['code', 'name', 'kind', 'created_at', 'updated_at']
    -- sync:end export_columns_referral_partners
    -- sync:begin export_columns_firm_activity
    WHEN 'firm_activity' THEN ARRAY['at', 'who', 'kind', 'record_type', 'record_id', 'subject', 'role', 'rows']
    -- sync:end export_columns_firm_activity
  END
$$;

-- The kind of each field a filter may name (the kinds of workspace_filter_check, 20261117100000). Each is also a column above.
CREATE FUNCTION public.export_field_kind(p_table text, p_field text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_table
    WHEN 'referral_partners' THEN CASE p_field
      WHEN 'code' THEN 'text' WHEN 'name' THEN 'text' WHEN 'kind' THEN 'choice' WHEN 'created_at' THEN 'date' WHEN 'updated_at' THEN 'date' END
    WHEN 'firm_activity' THEN CASE p_field
      WHEN 'at' THEN 'date' WHEN 'who' THEN 'text' WHEN 'kind' THEN 'choice' WHEN 'record_type' THEN 'choice' WHEN 'role' THEN 'choice' END
  END
$$;

-- A moment as the export writes it: UTC, to the millisecond, ISO 8601, whatever the session's time zone.
CREATE FUNCTION public.export_moment(p_at timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT to_char(p_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- Every row of a table of a firm the caller may see, in the export's order: its key (what a selection names), its position, and its
-- exportable columns. Called by export_table only, after its checks; each table's own rule is asked again here, so the rows can't
-- outrun it. Referral partners: any current member of the firm (the table's policy, is_firm_member). The record: the firm's owners
-- (can_read_firm_activity), with a person of Nevermore's shown as "Nevermore" and no id or email (D-33) and the system as "System".
CREATE FUNCTION public.export_visible_rows(p_firm_id uuid, p_table text)
RETURNS TABLE (k text, ord bigint, o jsonb)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT r.code, row_number() OVER (ORDER BY lower(r.name), r.code),
         jsonb_build_object('code', r.code, 'name', r.name, 'kind', r.kind,
                            'created_at', public.export_moment(r.created_at), 'updated_at', public.export_moment(r.updated_at))
  FROM public.referral_partners r
  WHERE p_table = 'referral_partners' AND r.firm_id = p_firm_id AND public.is_firm_member(p_firm_id)
  UNION ALL
  SELECT a.entry_key::text, row_number() OVER (ORDER BY a.at DESC, a.entry_key DESC),
         jsonb_build_object('at', public.export_moment(a.at),
                            'who', CASE WHEN a.actor_is_staff THEN 'Nevermore' WHEN a.actor_id IS NULL THEN 'System' ELSE u.email::text END,
                            'kind', a.kind, 'record_type', a.record_type, 'record_id', a.record_id, 'subject', su.email::text,
                            'role', a.role, 'rows', a.row_count)
  FROM public.firm_activity a
  LEFT JOIN auth.users u ON u.id = a.actor_id AND NOT a.actor_is_staff
  LEFT JOIN auth.users su ON su.id = a.subject_user_id
  WHERE p_table = 'firm_activity' AND a.firm_id = p_firm_id AND public.can_read_firm_activity(p_firm_id)
$$;

-- The columns asked for, checked: a list of 1 or more distinct names, each one the table exports, in the order given.
CREATE FUNCTION public.export_columns_checked(p_table text, p_columns jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  allowed text[] := public.export_columns(p_table);
  c jsonb;
  out text[] := '{}';
BEGIN
  IF p_columns IS NULL OR jsonb_typeof(p_columns) <> 'array' OR jsonb_array_length(p_columns) = 0 THEN
    RAISE EXCEPTION 'Name the columns to export, as a list' USING ERRCODE = '22023';
  END IF;
  FOR c IN SELECT e FROM jsonb_array_elements(p_columns) e LOOP
    IF jsonb_typeof(c) <> 'string' OR NOT (c #>> '{}') = ANY (allowed) THEN
      RAISE EXCEPTION 'The table "%" has no column "%" to export', p_table, left(c #>> '{}', 64) USING ERRCODE = '22023';
    END IF;
    IF (c #>> '{}') = ANY (out) THEN
      RAISE EXCEPTION 'The column "%" is named twice', c #>> '{}' USING ERRCODE = '22023';
    END IF;
    out := out || (c #>> '{}');
  END LOOP;
  RETURN out;
END;
$$;

-- The filters, checked: at most 20, each on a field of the table, each read by workspace_filter_check (the queue's shape, D-44). A
-- partner's kind must be one of the kinds; a role one of the three. Reads no row.
CREATE FUNCTION public.export_filters_checked(p_table text, p_filters jsonb, p_today date)
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
    kind := public.export_field_kind(p_table, field);
    IF kind IS NULL THEN
      RAISE EXCEPTION 'The table "%" has no field "%" to filter by', p_table, left(field, 64) USING ERRCODE = '22023';
    END IF;
    checked := public.workspace_filter_check(kind, f,
      CASE WHEN p_table = 'firm_activity' AND field = 'role' THEN ARRAY['owner', 'lead', 'agent'] END, p_today);
    IF p_table = 'referral_partners' AND field = 'kind' AND checked ? 'vs' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(checked -> 'vs') v WHERE NOT COALESCE(public.is_referral_partner_kind(v), false)) THEN
      RAISE EXCEPTION 'The filter "kind %" takes the kinds of partner, such as accounting', checked ->> 'op' USING ERRCODE = '22023';
    END IF;
    out := out || jsonb_build_array(checked || jsonb_build_object('field', field));
  END LOOP;
  RETURN out;
END;
$$;

-- The selection, checked: NULL for none (every row that matches), or a list of 1 to the cap of keys (a partner's code, an entry's key).
CREATE FUNCTION public.export_keys_checked(p_keys jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_keys IS NULL OR p_keys = 'null'::jsonb THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_keys) <> 'array' OR jsonb_array_length(p_keys) = 0 OR jsonb_array_length(p_keys) > public.export_row_cap()
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_keys) e WHERE jsonb_typeof(e) <> 'string' OR char_length(e #>> '{}') NOT BETWEEN 1 AND 200) THEN
    RAISE EXCEPTION 'A selection is a list of 1 to % keys', public.export_row_cap() USING ERRCODE = '22023';
  END IF;
  RETURN ARRAY(SELECT e FROM jsonb_array_elements_text(p_keys) e);
END;
$$;

-- Whether one row passes every checked filter ("and"). A moment is compared as the day it falls on in the caller's time zone.
CREATE FUNCTION public.export_row_passes(p_table text, o jsonb, p_checked jsonb, p_time_zone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_checked) f
    WHERE NOT COALESCE(CASE public.export_field_kind(p_table, f ->> 'field')
      WHEN 'text' THEN public.workspace_filter_match_text(o ->> (f ->> 'field'), f)
      WHEN 'choice' THEN public.workspace_filter_match_choice(o ->> (f ->> 'field'), f)
      WHEN 'date' THEN public.workspace_filter_match_date(((o ->> (f ->> 'field'))::timestamptz AT TIME ZONE p_time_zone)::date, f)
    END, false)
  )
$$;

REVOKE ALL ON FUNCTION public.export_columns(text), public.export_field_kind(text, text), public.export_moment(timestamptz),
  public.export_visible_rows(uuid, text), public.export_columns_checked(text, jsonb), public.export_filters_checked(text, jsonb, date),
  public.export_keys_checked(jsonb), public.export_row_passes(text, jsonb, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 5. The owners' alert goes through the outbox ----------

-- A firm-level email (D-106), like the leaving notice and the closing notice: a firm and no intake.
ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_events_one_target;
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_events_one_target CHECK (
  CASE WHEN kind IN ('member_left', 'firm_closing', 'export_alert') THEN session_id IS NULL AND firm_id IS NOT NULL ELSE session_id IS NOT NULL AND firm_id IS NULL END);

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request', 'draft_expiry_reminder', 'peo_mail_arrived', 'member_left', 'firm_closing', 'export_alert'
    -- sync:end outbox_kinds
  ));

-- A firm's alert (20261118110000), with the export alert: it waits while the firm is suspended, a bounce never suppresses an owner's
-- address, and it ends as cancelled once the firm has closed (D-118), as the firm's other alerts do.
CREATE OR REPLACE FUNCTION public.outbox_kind_is_firm_alert(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT p_kind IN ('advisor_notification', 'peo_mail_arrived', 'member_left', 'firm_closing', 'export_alert') $$;

-- ---------- 6. The export ----------

-- Returns {"table", "columns": [names, in the order asked], "rows": [[values, in that order], ...], "row_count", "whole_table",
-- "exported_at"} and, in the same step, writes the export to the firm's record and, when it calls for one, queues the owners' alert.
--
-- Refusals, in this order (nothing is read or recorded before any of them):
--   PT423  a support session for the firm (D-128): asked first, of the firm named.
--   42501  not a signed-in current member of the firm at its address (anonymous, a guest, another firm's member, a former or suspended
--          member, a platform admin who is no member, the bare domain, a password sign-in that owes its second factor).
--   22023  the queue ("its columns are an intake's answers"), a table that is not on the list, a column or filter field the table does
--          not have, a filter the field's kind does not take, a selection that is not a list of keys, an unknown time zone.
--   42501  the firm's record, for a member who is not an owner.
--   54000  more rows than the cap: narrow it with a filter (D-204).
--   PT428  a whole-table export whose sign-in is older than 12 hours: sign in again (D-205).
CREATE FUNCTION public.export_table(
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

  -- One read of the rows the caller may see: how many there are, how many this export holds, and those rows, each as its columns in
  -- the order asked, in the table's order.
  WITH v AS MATERIALIZED (
    SELECT x.k, x.ord, x.o FROM public.export_visible_rows(p_firm_id, p_table) x
  ), m AS MATERIALIZED (
    SELECT v.ord, v.o FROM v WHERE (keys IS NULL OR v.k = ANY (keys)) AND public.export_row_passes(p_table, v.o, checked, tz)
  )
  SELECT (SELECT count(*) FROM v), (SELECT count(*) FROM m),
         (SELECT COALESCE(jsonb_agg((SELECT jsonb_agg(m.o -> c.name ORDER BY c.i) FROM unnest(cols) WITH ORDINALITY AS c(name, i)) ORDER BY m.ord), '[]'::jsonb) FROM m)
    INTO visible_n, n, rows_out;

  IF n > public.export_row_cap() THEN
    RAISE EXCEPTION 'This export would hold % rows; the most one export holds is %. Narrow it with a filter.', n, public.export_row_cap()
      USING ERRCODE = '54000';
  END IF;
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
