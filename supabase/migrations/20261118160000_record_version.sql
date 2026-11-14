-- The version for the conflict check (story CRM-S2.4b; docs/BROKER_CRM_BUILD.md D-24, D-29, D-32, D-33, D-45, D-46, D-104, D-115, D-122, D-129 to D-132;
-- ADR 0023, ADR 0024; 20261118130000 and 20261118130500, the record's history).
--
-- What this is. Two people can open the same partner, and the second to save used to overwrite the first without a word. Now a record
-- carries a whole-number version. A save names the version it started from. If that is still the record's version, the save goes through and
-- raises it by one. If it is not, the save changes nothing and answers with what is there now and who changed it, so the screen can show both
-- changes side by side and let the person keep either (CRM-S2.4a builds that screen). Nothing is overwritten silently.
--
-- What raises the version. A trigger, only when one of the record's own editable fields really changes: for a partner its name or its kind,
-- the same two the history tracks (one list, written once, in record_track below). A save that changes nothing, and a change to a stamp
-- (updated_at, who saved), raise nothing, so saving a form twice without editing it does not make the second save fail. Nobody sets the
-- version: the trigger puts back whatever an UPDATE wrote into it and gives every new row 1.
--
-- How the version relates to the history. The history now also says which version each of its entries produced (a new nullable column; the
-- old migrations are not touched). So "what changed since version N" is exact: the entries with a version above N and up to the version the
-- record is at. A conflict names each field whose current value differs from what it was at N, with the history's last entry for it: who
-- and when, named by the history's own rule (record_history_who, which record_history_list now uses too), so the conflict can't name
-- a person differently from the history (D-33: a member by email, staff as "Nevermore", the service role as "System", never an id).
--
-- How a save says "conflict". As a normal answer, not as a raised error: the answer is {conflict: true, currentVersion, current, changed}.
-- A conflict is an expected outcome, not a failure, so it needs no error handling, is not logged as one, and is one typed shape the browser
-- reads without parsing an error's detail text. It changes nothing because the one UPDATE ... WHERE version = the version sent touches no row;
-- that statement is what orders two saves (a second save from the same version waits for the first's row, then finds the version moved).
-- No new lock is taken. A save that names no version is refused (22023): "nothing is overwritten silently" is not kept by a save that
-- doesn't say what it started from.
--
-- Who may see a conflict. Only someone the save itself lets through: the firm checks (member of that firm at this address, not suspended
-- or removed), the support refusal (PT423) and the read-only guard of a closing firm (PT423) all come BEFORE the version is looked at, so a
-- person who is refused is refused with the same words whatever version they send, and another firm's values are never in an answer.
--
-- How a later table gets it: one call in the migration that gives the table its history, replacing record_history_track:
--     SELECT public.record_track('public.accounts', 'accounts', ARRAY['id'], ARRAY['name', 'owner']);
-- which gives the table a version column (existing rows at 1), the version trigger, the history trigger and the guard against TRUNCATE; and the
-- table's own save function does what advisor_update_referral_partner does below (the update guarded by the version, then record_version_changes
-- for the answer). A table that means to have a history without a version, or a version without a history, calls the one helper it wants.

-- ---------- 1. The history says which version an entry produced ----------
ALTER TABLE public.record_history ADD COLUMN version integer;

-- ---------- 2. Who: one rule, written once ----------
-- What the history shows for a person who made a change (restated out of record_history_list, which now asks this): staff as "Nevermore" with
-- no id or email, the service role (no actor) as "System", a member by email as the firm already sees its members. Internal.
CREATE FUNCTION public.record_history_who(p_actor_id uuid, p_actor_is_staff boolean)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_actor_is_staff THEN 'Nevermore'
    WHEN p_actor_id IS NULL THEN 'System'
    ELSE COALESCE((SELECT u.email::text FROM auth.users u WHERE u.id = p_actor_id), 'A deleted account')
  END
$$;

REVOKE ALL ON FUNCTION public.record_history_who(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- 20261118130000's reading function, restated with every rule it had (the refusal for a record the caller may not see, the page size and cursor,
-- the grants); only the name of who now comes from the helper above.
CREATE OR REPLACE FUNCTION public.record_history_list(
  p_firm_id uuid, p_table text, p_key text, p_limit integer DEFAULT 50, p_after_at timestamptz DEFAULT NULL, p_after_key uuid DEFAULT NULL)
RETURNS TABLE (
  entry_key uuid, at timestamptz, change_id uuid, kind text, who text, who_kind text, field text, from_value jsonb, to_value jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t public.record_history_table;
BEGIN
  t := public.record_history_table_named(p_table);
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR (p_after_at IS NULL) <> (p_after_key IS NULL) THEN
    RAISE EXCEPTION 'A page is 1 to 100 entries, after an entry given by its time and key together' USING ERRCODE = '22023';
  END IF;
  -- One refusal for a record of another firm, one that was never made and one the caller may not see: nobody learns that it exists.
  IF NOT public.record_history_can_see(p_firm_id, t, p_key) THEN
    RAISE EXCEPTION 'That record isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN QUERY
    SELECT h.entry_key, h.at, h.change_id, h.kind,
           public.record_history_who(h.actor_id, h.actor_is_staff),
           CASE WHEN h.actor_is_staff THEN 'nevermore' WHEN h.actor_id IS NULL THEN 'system' ELSE 'member' END,
           h.field, h.old_value, h.new_value
    FROM public.record_history h
    WHERE h.firm_id = p_firm_id AND h.table_name = t AND h.record_key = p_key
      AND (p_after_at IS NULL OR (h.at, h.entry_key) < (p_after_at, p_after_key))
    ORDER BY h.at DESC, h.entry_key DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid) TO authenticated;

-- ---------- 3. The writer records the version each entry produced ----------
-- 20261118130500's record_history_capture, restated with every rule it had; the only change is the new `version` column of an entry, read from
-- the record's own `version` column (null for a table that has none). The trigger that raises the version runs BEFORE the write, so the row
-- seen here already carries the version the change produced.
CREATE OR REPLACE FUNCTION public.record_history_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  t public.record_history_table;
  key_columns text[];
  tracked text[];
  new_row jsonb;
  old_row jsonb;
  f text;
  fid uuid;
  rkey text;
  old_key text;
  v_old jsonb;
  v_new jsonb;
  who uuid := auth.uid();
  staff boolean;
  change uuid := gen_random_uuid();
  ver integer;
BEGIN
  IF TG_NARGS < 3 THEN
    RAISE EXCEPTION 'record_history_capture needs a table name, a key and at least one field to track' USING ERRCODE = '22023';
  END IF;
  t := public.record_history_table_named(TG_ARGV[0]);
  key_columns := string_to_array(TG_ARGV[1], ',');
  tracked := TG_ARGV[2:TG_NARGS - 1];

  IF TG_OP = 'DELETE' THEN
    old_row := to_jsonb(OLD);
    fid := (old_row ->> 'firm_id')::uuid;
    rkey := public.record_history_key_of(old_row, key_columns);
    -- The record is gone, so its history goes with it (D-45), through the one function the removing role owns.
    PERFORM public.record_history_remove(fid, t, rkey);
    RETURN NULL;
  END IF;

  new_row := to_jsonb(NEW);
  fid := (new_row ->> 'firm_id')::uuid;
  rkey := public.record_history_key_of(new_row, key_columns);
  IF fid IS NULL OR rkey IS NULL THEN
    RAISE EXCEPTION 'A tracked record needs its firm and its key' USING ERRCODE = '23502';
  END IF;
  staff := public.firm_actor_is_staff(who, fid);
  ver := (new_row ->> 'version')::integer;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, actor_id, actor_is_staff, version)
    VALUES (fid, t, rkey, change, 'created', who, staff, ver);
    RETURN NULL;
  END IF;

  -- An update: the record's firm and key never change, or its history would be left behind under the old name.
  old_row := to_jsonb(OLD);
  old_key := public.record_history_key_of(old_row, key_columns);
  IF old_key IS DISTINCT FROM rkey OR (old_row ->> 'firm_id') IS DISTINCT FROM (new_row ->> 'firm_id') THEN
    RAISE EXCEPTION 'The firm and the key of a record with a history can''t change' USING ERRCODE = '23514';
  END IF;
  FOREACH f IN ARRAY tracked LOOP
    IF NOT (new_row ? f) THEN
      RAISE EXCEPTION 'The history was asked to track "%", which is not a column of %', f, TG_TABLE_NAME USING ERRCODE = '42703';
    END IF;
    v_old := old_row -> f;
    v_new := new_row -> f;
    IF v_old IS DISTINCT FROM v_new THEN
      INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, field, old_value, new_value, actor_id, actor_is_staff, version)
      VALUES (fid, t, rkey, change, 'changed', f,
              CASE WHEN v_old = 'null'::jsonb THEN NULL ELSE v_old END,
              CASE WHEN v_new = 'null'::jsonb THEN NULL ELSE v_new END,
              who, staff, ver);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_capture() FROM PUBLIC, anon, authenticated;

-- ---------- 4. The version: a trigger that owns it ----------
-- BEFORE INSERT OR UPDATE. The arguments are the fields that count as a change. An insert starts at 1 whatever it said. An update keeps the
-- old version unless one of the listed fields really differs (a null is a value: a field going from nothing to something differs), and then
-- raises it by exactly one; whatever the statement wrote into `version` is put back, so nobody can lower it to let a stale save through.
CREATE FUNCTION public.record_version_bump()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
  f text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1;
    RETURN NEW;
  END IF;
  NEW.version := OLD.version;
  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);
  FOREACH f IN ARRAY TG_ARGV LOOP
    IF (old_row -> f) IS DISTINCT FROM (new_row -> f) THEN
      NEW.version := OLD.version + 1;
      EXIT;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_version_bump() FROM PUBLIC, anon, authenticated;

-- Gives a table a version: the column (every row it already holds starts at 1) and the trigger, watching the fields listed. The table must be an
-- ordinary table of public with every field named; the version itself can't be a watched field. Run again, it replaces the trigger. Called by
-- the migration that gives a table a version (or, with the history, through record_track); no API role runs it.
CREATE FUNCTION public.record_version_track(p_table regclass, p_fields text[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  rel text;
  col text;
BEGIN
  IF p_fields IS NULL OR cardinality(p_fields) < 1 OR 'version' = ANY (p_fields) THEN
    RAISE EXCEPTION 'A version needs at least one field to watch, and the version itself is not one' USING ERRCODE = '22023';
  END IF;
  SELECT c.relname INTO rel FROM pg_class c WHERE c.oid = p_table AND c.relnamespace = 'public'::regnamespace AND c.relkind = 'r';
  IF rel IS NULL THEN
    RAISE EXCEPTION '% is not an ordinary table of the public schema', p_table USING ERRCODE = '42809';
  END IF;
  FOREACH col IN ARRAY p_fields LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = p_table AND a.attname = col AND a.attnum > 0 AND NOT a.attisdropped) THEN
      RAISE EXCEPTION '% has no column "%"', rel, col USING ERRCODE = '42703';
    END IF;
  END LOOP;
  EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1', p_table);
  IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = p_table AND a.attname = 'version' AND a.atttypid = 'int4'::regtype AND a.attnotnull) THEN
    RAISE EXCEPTION '% already has a column called version that is not a whole number which is always there', rel USING ERRCODE = '42804';
  END IF;
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', rel || '_version', p_table);
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.record_version_bump(%s)',
    rel || '_version', p_table, (SELECT string_agg(quote_literal(f), ', ' ORDER BY n) FROM unnest(p_fields) WITH ORDINALITY AS u (f, n)));
END;
$$;

REVOKE ALL ON FUNCTION public.record_version_track(regclass, text[]) FROM PUBLIC, anon, authenticated;

-- The one call a table's migration makes: the history (record_history_track) and the version, watching the very fields the history tracks, so
-- the two lists can't disagree.
CREATE FUNCTION public.record_track(p_table regclass, p_name text, p_key_columns text[], p_fields text[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.record_history_track(p_table, p_name, p_key_columns, p_fields);
  PERFORM public.record_version_track(p_table, p_fields);
END;
$$;

REVOKE ALL ON FUNCTION public.record_track(regclass, text, text[], text[]) FROM PUBLIC, anon, authenticated;

-- ---------- 5. What differs: the answer a conflict carries ----------
-- For a record that is at version p_upto, started from version p_since: one element per field whose value now differs from its value at
-- p_since, as {field, value, who, at}: the current value and the last entry that set it. A field changed and changed back is no difference. The
-- entries read are those of versions above p_since and up to p_upto, so a save that lands while the answer is being built is not half
-- in it (the caller read p_upto from the record, and nothing is locked for this). Internal: the caller has already decided the person may see
-- the record.
CREATE FUNCTION public.record_version_changes(p_firm_id uuid, p_table public.record_history_table, p_key text, p_since integer, p_upto integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH e AS (
    SELECT h.id, h.field, h.old_value, h.new_value, h.at, h.actor_id, h.actor_is_staff
    FROM public.record_history h
    WHERE h.firm_id = p_firm_id AND h.table_name = p_table AND h.record_key = p_key AND h.kind = 'changed'
      AND h.version > p_since AND h.version <= p_upto
  ),
  first_old AS (SELECT DISTINCT ON (field) field, old_value FROM e ORDER BY field, id),
  last_new AS (SELECT DISTINCT ON (field) field, new_value, at, actor_id, actor_is_staff FROM e ORDER BY field, id DESC)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'field', l.field, 'value', l.new_value, 'who', public.record_history_who(l.actor_id, l.actor_is_staff), 'at', l.at) ORDER BY l.field), '[]'::jsonb)
  FROM last_new l JOIN first_old f ON f.field = l.field
  WHERE f.old_value IS DISTINCT FROM l.new_value
$$;

REVOKE ALL ON FUNCTION public.record_version_changes(uuid, public.record_history_table, text, integer, integer) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 6. Referral partners ----------
-- The column, the trigger, the history's two triggers (replaced with themselves): one call.
SELECT public.record_track('public.referral_partners', 'referral_partners', ARRAY['code'], ARRAY['name', 'kind']);

-- ---------- 7. The save ----------
-- 20261118110000's advisor_update_referral_partner, with every rule it had (the advisor check, the firm to act for D-18 and D-40, the guard
-- that refuses a support session and a closing firm and holds the firm's row, ADR 0023 and ADR 0024, the input messages, "No partner has that
-- code"), and now the version. The old four-argument form is dropped on purpose: it could overwrite without looking, and the only caller (the
-- partners page, src/lib/advisorApi.ts) now sends the version. The new argument comes last and defaults to nothing, so an old call that
-- still arrives is refused with a plain message rather than failing as an unknown function.
-- Answers {conflict: false, record: <the saved row, with its new version>} or
--         {conflict: true, currentVersion, current: {name, kind}, changed: [{field, value, who, at}]}.
DROP FUNCTION public.advisor_update_referral_partner(text, text, text, uuid);
CREATE FUNCTION public.advisor_update_referral_partner(p_code text, p_name text, p_kind text, p_firm_id uuid DEFAULT NULL::uuid, p_version integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  problem text := public.referral_partner_input_error(p_name, p_kind);
  firm uuid;
  code_in text := lower(btrim(COALESCE(p_code, '')));
  changed public.referral_partners;
  cur public.referral_partners;
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the partner it started from, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  -- The one statement that orders two saves: it touches the row only if it is still at the version the person started from. A second save
  -- from the same version waits for the first's row, then finds the version moved and touches nothing.
  UPDATE public.referral_partners
  SET name = btrim(p_name), kind = p_kind, updated_at = now(), updated_by_email = auth.jwt() ->> 'email'
  WHERE firm_id = firm AND code = code_in AND version = p_version
  RETURNING * INTO changed;
  IF changed.code IS NOT NULL THEN
    RETURN jsonb_build_object('conflict', false, 'record', to_jsonb(changed));
  END IF;
  SELECT * INTO cur FROM public.referral_partners r WHERE r.firm_id = firm AND r.code = code_in;
  IF cur.code IS NULL THEN
    RAISE EXCEPTION 'No partner has that code' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object(
    'conflict', true,
    'currentVersion', cur.version,
    'current', jsonb_build_object('name', cur.name, 'kind', cur.kind),
    'changed', public.record_version_changes(firm, 'referral_partners', cur.code, p_version, cur.version));
END;
$function$;

REVOKE ALL ON FUNCTION public.advisor_update_referral_partner(text, text, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_update_referral_partner(text, text, text, uuid, integer) TO authenticated;
