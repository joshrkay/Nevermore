-- Export in the database (story CRM-S3.8b; docs/BROKER_CRM_BUILD.md D-24, D-28, D-33, D-40, D-48, D-102, D-128; ADR 0016, ADR 0023, ADR 0024).
--
-- What this is. A table taken out of the product is one function, export_rows(), that returns the rows AND records the export in the same
-- statement, so the count in the record is the count of the rows given and an export cannot be made without its record: if the record cannot
-- be written the rows are not given, and if the rows cannot be read nothing is recorded. The button and the CSV are CRM-S3.8a's; this is the
-- half the browser cannot skip.
--
-- What it checks, in this order, before it reads a row or writes an entry:
--   1. refuse_support_session(firm): a support session exports nothing (D-128, ADR 0024). First, so that nothing else about the call is looked
--      at and a call that names no firm fails closed (a caller who holds any open session is refused).
--   2. firm_to_act_for(firm): a current member of that firm, at this firm's address when the request names one (D-40, ADR 0016): the firm is the
--      address's, never a guess, and the answer never holds two firms. A suspended firm has no members, so it exports nothing; a closed one
--      has none left.
--   3. the table: one the list below names, and the role it asks for (any member, or an owner).
--   4. the fresh sign-in: a whole table (every row that matches the filters) is taken only by someone whose sign-in is under 12 hours old (CRM-P1.3).
--      A selection named by ids is not "a whole table" and is not asked (the most it can hold is 1,000 ids; the alert still counts it).
--
-- What it gives. Only rows the person may see, and only the columns the table lists here: never an intake's answers, a census or a FEIN, which are
-- in no table the list names. At most 50,000 rows (more is refused in words, with the advice to filter): the answer is one value.
--
-- What it records. One entry in the firm's record, kind export_made, about the TABLE (record_type 'table', record_id the table's name) with the
-- number of rows given (the new column row_count). Never content. A closing firm exports: its owners are offered an export of every table before
-- the firm closes (CRM-P1.7), a member of a closing firm still reads, and the entry is the record that ADR 0023 keeps writable ("the firm's record").
--
-- What it tells the owners. An export of more than 500 rows, or the third export by one member in an hour, queues an email to the firm's owners in the
-- same statement (kind export_alert, the firm's alert like a member leaving): who, which table, how many rows, when. No row, no name of a partner.
--
-- How a later table joins (CRM-A1.1b accounts, CRM-S3.7b a selection by ids, CRM-L1.1, CRM-Q4.1): it adds one line to export_table_registry() and
-- one reader, export_source_<name>(firm, filters, ids, limit), and nothing here changes. The reader runs as its owner after this function's checks,
-- so it MUST do what row security would: for an owned record, can_see_firm_record(firm, owner), and no column the table does not list.
--
--   1. firm_activity.row_count         the count, tied to the kind by a check; 'table' is a record type; owners read the count
--   2. the limits, the sign-in time    written once
--   3. the table list and its readers  referral partners (any member) and the firm's record (owners)
--   4. export_rows                     the function
--   5. the owners' alert               an outbox kind, a firm's alert
--   6. firm_activity_list              restated with the count

-- 1. The record of an export. An entry of any other kind has no count and an export always has one; an export is about a table and nothing else is.
ALTER TABLE public.firm_activity ADD COLUMN row_count integer;

ALTER TABLE public.firm_activity DROP CONSTRAINT firm_activity_record_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_record_check CHECK (
  record_type IN (
    -- sync:begin firm_activity_record_types
    'submission', 'document', 'manuscript', 'quote_request', 'membership', 'firm', 'support_session', 'support_session_end', 'table'
    -- sync:end firm_activity_record_types
  )
  AND record_id ~ '^[A-Za-z0-9_-]{1,64}$');

ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_export_check CHECK (
  (kind = 'export_made') = (row_count IS NOT NULL)
  AND (kind = 'export_made') = (record_type = 'table')
  AND (row_count IS NULL OR row_count >= 0));

-- The table grants a reader its columns one by one (the number of an entry and who stored it are never given).
GRANT SELECT (row_count) ON public.firm_activity TO authenticated;

-- 2. The numbers the story names, written once. Internal: the function and its tests ask.
CREATE FUNCTION public.export_limits()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    -- sync:begin export_limits
    'sign_in_hours', 12,     -- a whole table asks the person to sign in again after this long (CRM-P1.3)
    'alert_rows', 500,       -- more than this many rows tells the owners (CRM-P2.3)
    'alert_repeats', 3,      -- this many exports by one member within alert_minutes tells them
    'alert_minutes', 60,
    'most_rows', 50000,      -- the most one export holds: it is one value
    'most_ids', 1000         -- the most a selection names (the most one bulk action takes)
    -- sync:end export_limits
  )
$$;

REVOKE ALL ON FUNCTION public.export_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_limits() TO service_role;

-- When the caller last signed in, from the token's own claims (Supabase Auth signs them): `amr` lists each way the session was proved, with the
-- time (seconds); a second factor done later is a later entry, and a refreshed token keeps them. The latest is "last signed in". A token that
-- says nothing of when has none, and the caller asks for a fresh sign-in (fail closed).
CREATE FUNCTION public.caller_last_sign_in_at()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT to_timestamp(max((e ->> 'timestamp')::bigint))
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(auth.jwt() -> 'amr') = 'array' THEN auth.jwt() -> 'amr' ELSE '[]'::jsonb END) e
  WHERE jsonb_typeof(e) = 'object' AND (e ->> 'timestamp') ~ '^[0-9]{1,12}$'
$$;

REVOKE ALL ON FUNCTION public.caller_last_sign_in_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.caller_last_sign_in_at() TO service_role;

-- 3. What can be exported. `who`: 'member' (any current member of the firm) or 'owner'. `columns`: the columns of a row, in the order a CSV
-- would show them, each with its words. A later story restates this function with its line and adds its reader (export_source_<name>), which
-- supabase/tests/export.sql requires. Nothing here is an intake's answers, a census or a FEIN: an export never holds them (D-48).
CREATE FUNCTION public.export_table_registry()
RETURNS TABLE (name text, label text, who text, columns jsonb)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    ('referral_partners', 'Referral partners', 'member',
     '[{"id":"code","label":"Code"},{"id":"name","label":"Name"},{"id":"kind","label":"Kind"},{"id":"created_at","label":"Added"},{"id":"updated_at","label":"Last changed"}]'::jsonb),
    ('firm_activity', 'The firm''s record', 'owner',
     '[{"id":"at","label":"When"},{"id":"who","label":"Who"},{"id":"kind","label":"What"},{"id":"record_type","label":"Record type"},{"id":"record_id","label":"Record"},{"id":"subject","label":"About"},{"id":"role","label":"Role"},{"id":"row_count","label":"Rows"}]'::jsonb)
  ) t (name, label, who, columns)
$$;

REVOKE ALL ON FUNCTION public.export_table_registry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_table_registry() TO service_role;

-- Referral partners: every current member of the firm sees them all (the table's policy is is_firm_member), so a member exports them all.
-- Filters: `kind` (one of the partner kinds) and `search` (the name or the code, any case). The firm and the rights are export_rows's.
CREATE FUNCTION public.export_source_referral_partners(p_firm_id uuid, p_filters jsonb, p_ids jsonb, p_limit integer)
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  kind_in text;
  search_in text;
  ids text[];
BEGIN
  IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_filters) k WHERE k NOT IN ('kind', 'search'))
     OR (p_filters ? 'kind' AND (jsonb_typeof(p_filters -> 'kind') <> 'string' OR NOT COALESCE(public.is_referral_partner_kind(p_filters ->> 'kind'), false)))
     OR (p_filters ? 'search' AND jsonb_typeof(p_filters -> 'search') <> 'string') THEN
    RAISE EXCEPTION 'Those filters don''t apply to this table' USING ERRCODE = '22023';
  END IF;
  kind_in := p_filters ->> 'kind';
  search_in := lower(btrim(COALESCE(p_filters ->> 'search', '')));
  IF p_ids IS NOT NULL THEN
    SELECT COALESCE(array_agg(i), '{}') INTO ids FROM jsonb_array_elements_text(p_ids) i;
  END IF;
  RETURN QUERY
    SELECT jsonb_build_object('code', r.code, 'name', r.name, 'kind', r.kind, 'created_at', r.created_at, 'updated_at', r.updated_at)
    FROM public.referral_partners r
    WHERE r.firm_id = p_firm_id
      AND (kind_in IS NULL OR r.kind = kind_in)
      AND (search_in = '' OR position(search_in IN lower(r.name)) > 0 OR position(search_in IN r.code) > 0)
      AND (ids IS NULL OR r.code = ANY (ids))
    ORDER BY lower(r.name) COLLATE "C", r.code COLLATE "C"
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.export_source_referral_partners(uuid, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;

-- The firm's record: an owner's, and the same rows an owner reads on the page (firm_activity_list): who by the page's words (a person at Nevermore as
-- "Nevermore", never their id or email, D-33), never the number of an entry or who stored it. Filters: `person` (a member's id, or "nevermore") and
-- `kind`. A selection names entries by the key the page pages by (entry_key).
CREATE FUNCTION public.export_source_firm_activity(p_firm_id uuid, p_filters jsonb, p_ids jsonb, p_limit integer)
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  person_in text;
  kind_in text;
  ids text[];
BEGIN
  IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_filters) k WHERE k NOT IN ('person', 'kind'))
     OR (p_filters ? 'kind' AND jsonb_typeof(p_filters -> 'kind') <> 'string')
     OR (p_filters ? 'person' AND (jsonb_typeof(p_filters -> 'person') <> 'string'
         OR (p_filters ->> 'person' <> 'nevermore' AND p_filters ->> 'person' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))) THEN
    RAISE EXCEPTION 'Those filters don''t apply to this table' USING ERRCODE = '22023';
  END IF;
  person_in := lower(p_filters ->> 'person');
  kind_in := p_filters ->> 'kind';
  IF p_ids IS NOT NULL THEN
    SELECT COALESCE(array_agg(lower(i)), '{}') INTO ids FROM jsonb_array_elements_text(p_ids) i;
  END IF;
  RETURN QUERY
    SELECT jsonb_build_object(
      'at', a.at,
      'who', CASE WHEN a.actor_is_staff THEN 'Nevermore' WHEN a.actor_id IS NULL THEN 'System' ELSE COALESCE(u.email::text, 'A former member') END,
      'kind', a.kind, 'record_type', a.record_type, 'record_id', a.record_id,
      'subject', CASE WHEN a.subject_user_id IS NULL THEN NULL ELSE COALESCE(su.email::text, 'A former member') END,
      'role', a.role, 'row_count', a.row_count)
    FROM public.firm_activity a
    LEFT JOIN auth.users u ON u.id = a.actor_id AND NOT a.actor_is_staff
    LEFT JOIN auth.users su ON su.id = a.subject_user_id
    WHERE a.firm_id = p_firm_id
      AND (kind_in IS NULL OR a.kind = kind_in)
      AND (person_in IS NULL OR (person_in = 'nevermore' AND a.actor_is_staff) OR (person_in <> 'nevermore' AND a.actor_id = person_in::uuid AND NOT a.actor_is_staff))
      AND (ids IS NULL OR a.entry_key::text = ANY (ids))
    ORDER BY a.at DESC, a.entry_key DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.export_source_firm_activity(uuid, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;

-- 5. The owners' alert goes through the outbox the firm's other alerts use (a member leaving, a request to close): it belongs to the firm, not to an
-- intake, and is a firm's alert, so it waits while the firm is suspended and a bounce never suppresses an owner's address. The kind is new.
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

CREATE OR REPLACE FUNCTION public.outbox_kind_is_firm_alert(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT p_kind IN ('advisor_notification', 'peo_mail_arrived', 'member_left', 'firm_closing', 'export_alert') $$;

-- 4. The export. Answers one value: {table, label, columns: [{id, label}], rows: [{<column id>: value}], count, skipped, exportedAt}.
--   p_firm_id  the firm; null acts for the caller's only firm at this address (firm_to_act_for), as every function that acts for a firm does
--   p_table    a name export_table_registry() lists
--   p_filters  an object of the table's own filters ({} for none); one the table doesn't have is refused (22023), so a typo never exports everything
--   p_ids      null for every row that matches the filters (a whole table); a list of the records' ids for a selection, which is the rows among them
--              the person may see, once each, in the table's order; `skipped` says how many ids gave no row (another firm's and a missing one look alike)
-- Refusals: PT423 a support session; 42501 not a member (or not an owner, for the record); 22023 a table, filters or ids that are not valid;
-- PT401 a whole table with a sign-in more than 12 hours old (the person signs in again and tries again); PT413 more than 50,000 rows.
CREATE FUNCTION public.export_rows(p_firm_id uuid, p_table text, p_filters jsonb DEFAULT '{}'::jsonb, p_ids jsonb DEFAULT NULL::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  lim constant jsonb := public.export_limits();
  firm uuid;
  reg record;
  filters_in jsonb := COALESCE(p_filters, '{}'::jsonb);
  requested integer := 0;
  taken jsonb;
  n integer;
  entry bigint;
  recent integer;
  large boolean;
  signed_in timestamptz;
  exported timestamptz := now();
BEGIN
  -- 1. Nevermore support exports nothing (ADR 0024, D-128). First: before the firm is looked up, so a session is told so and not "not a member".
  PERFORM public.refuse_support_session(p_firm_id);
  -- 2. A current member of one firm, the one the address names (D-40).
  firm := public.firm_to_act_for(p_firm_id);
  -- 3. A table the list names, and the role it asks for.
  SELECT r.* INTO reg FROM public.export_table_registry() r WHERE r.name = p_table;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose a table to export' USING ERRCODE = '22023';
  END IF;
  IF reg.who = 'owner' AND public.firm_role(firm) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can export that' USING ERRCODE = '42501';
  END IF;
  -- A selection: a list of ids, no more than a bulk action takes.
  IF p_ids IS NOT NULL THEN
    IF jsonb_typeof(p_ids) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_ids) e WHERE jsonb_typeof(e) <> 'string') THEN
      RAISE EXCEPTION 'Name the records to export as a list' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_ids) > (lim ->> 'most_ids')::integer THEN
      RAISE EXCEPTION 'Pick at most 1,000 records to export' USING ERRCODE = '22023';
    END IF;
    SELECT count(DISTINCT e) INTO requested FROM jsonb_array_elements_text(p_ids) e;
  END IF;
  -- 4. A whole table asks for a sign-in within the last 12 hours.
  IF p_ids IS NULL THEN
    signed_in := public.caller_last_sign_in_at();
    IF signed_in IS NULL OR signed_in < now() - make_interval(hours => (lim ->> 'sign_in_hours')::integer) THEN
      RAISE EXCEPTION 'Sign in again to export a whole table' USING ERRCODE = 'PT401';
    END IF;
  END IF;

  -- One member's exports are counted one at a time, so two at once see each other.
  PERFORM pg_advisory_xact_lock(hashtextextended('export:' || firm::text || ':' || auth.uid()::text, 0));

  -- The rows: the reader of that table, named by the list and nothing else, asked for one more than the most so that "too many" is known.
  EXECUTE format('SELECT COALESCE(jsonb_agg(r), ''[]''::jsonb), count(*)::integer FROM public.%I($1, $2, $3, $4) r', 'export_source_' || reg.name)
    INTO taken, n USING firm, filters_in, p_ids, (lim ->> 'most_rows')::integer + 1;
  IF n > (lim ->> 'most_rows')::integer THEN
    RAISE EXCEPTION 'That is more than 50,000 rows. Narrow it with a filter and export again.' USING ERRCODE = 'PT413';
  END IF;

  -- The record, in the same statement as the rows: its count is the rows given.
  INSERT INTO public.firm_activity (firm_id, actor_id, actor_is_staff, kind, record_type, record_id, row_count)
  VALUES (firm, auth.uid(), false, 'export_made', 'table', reg.name, n)
  RETURNING id INTO entry;

  -- The owners are told of a large export and of the third in an hour, in the same transaction.
  SELECT count(*)::integer INTO recent FROM public.firm_activity a
  WHERE a.firm_id = firm AND a.actor_id = auth.uid() AND a.kind = 'export_made'
    AND a.at > now() - make_interval(mins => (lim ->> 'alert_minutes')::integer);
  large := n > (lim ->> 'alert_rows')::integer;
  IF large OR recent = (lim ->> 'alert_repeats')::integer THEN
    INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
    SELECT 'export_alert', firm, 'export_alert:' || entry,
           jsonb_build_object('member_email', lower(btrim(u.email)), 'table_label', reg.label, 'row_count', n, 'exports_in_hour', recent, 'large', large,
                              'exported_at', to_char(exported AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'firm_name', f.name)
    FROM auth.users u, public.firms f
    WHERE u.id = auth.uid() AND f.id = firm
    ON CONFLICT (kind, dedupe_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('table', reg.name, 'label', reg.label, 'columns', reg.columns, 'rows', taken, 'count', n,
                            'skipped', CASE WHEN p_ids IS NULL THEN 0 ELSE GREATEST(requested - n, 0) END, 'exportedAt', exported);
END;
$$;

REVOKE ALL ON FUNCTION public.export_rows(uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_rows(uuid, text, jsonb, jsonb) TO authenticated;

-- 6. The firm's record, read by its owners, now says how many rows an export held (the page that shows it is CRM-S3.8a's). Restated from
-- 20261116160001 with every rule it had; the only change is the last column. The return type changes, so it is dropped and made again.
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
    SELECT a.entry_key, a.at, CASE WHEN a.actor_is_staff THEN NULL ELSE a.actor_id END, u.email::text, a.actor_is_staff, a.kind, a.record_type, a.record_id,
           a.subject_user_id, su.email::text, a.role, a.row_count
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
