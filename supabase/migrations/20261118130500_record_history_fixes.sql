-- The history of a record, review fixes (story CRM-S5.2; docs/BROKER_CRM_BUILD.md D-45, D-117, D-129 to D-132; ADR 0012; 20261118130000).
--
--   1. Nobody deletes a history by setting something. The first build let a DELETE through when a session setting named the record or the
--      firm, and anyone who can run a statement can set it, the table's owner included (the thing ADR 0012 rejected for the firm's own
--      record). A delete is now allowed only for the role record_history_remover, which has no login, belongs to no API role, owns the one
--      function that deletes (record_history_remove) and holds nothing but read and delete on the table. The guard reads who is running the
--      statement; nothing a caller sets changes it. The function is also narrow: a record's history goes only when the record itself is gone,
--      and a whole firm's only while that firm's closing is running. close_firm_now deletes the history through it.
--   2. Emptying a tracked table (TRUNCATE) is refused, so a record made later with the same key can't inherit a history.
--   3. A composite key is stored unambiguously: one column reads as its value, several as a JSON array of the parts (so ('a/b','c') and
--      ('a','b/c') are two records). Every key stored so far is a single column, so no stored key changes.
--   4. record_history_track() attaches the capture trigger and the truncate guard together, and refuses a table, key column or field that
--      does not exist at attach time, not at the first change.
--   5. A timestamp is stored in UTC, so the same instant reads the same whoever wrote it.
-- Every function below is restated from its latest definition, with every rule it had.

-- ---------- 1. Deleting, by a role ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'record_history_remover') THEN
    CREATE ROLE record_history_remover NOLOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO record_history_remover;
GRANT SELECT, DELETE ON public.record_history TO record_history_remover;
CREATE POLICY record_history_remover_select ON public.record_history FOR SELECT TO record_history_remover USING (true);
CREATE POLICY record_history_remover_delete ON public.record_history FOR DELETE TO record_history_remover USING (true);

-- Whether a record still exists, per table. Internal.
CREATE FUNCTION public.record_history_record_exists(p_firm_id uuid, p_table public.record_history_table, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_table = 'referral_partners' THEN
    RETURN EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = p_firm_id AND r.code = p_key);
  END IF;
  -- A table nobody has taught this function counts as still there, so nothing of it is deleted.
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_record_exists(uuid, public.record_history_table, text) FROM PUBLIC, anon, authenticated, service_role;

-- The one function that deletes history. With a table and a key: that record's, once the record is gone. With neither: a whole firm's, while
-- that firm's closing is running. Anything else is refused. Owned by the role below, so it is the role that deletes.
CREATE FUNCTION public.record_history_remove(p_firm_id uuid, p_table text DEFAULT NULL, p_key text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  removed integer;
  t public.record_history_table;
BEGIN
  IF p_firm_id IS NULL OR (p_table IS NULL) <> (p_key IS NULL) THEN
    RAISE EXCEPTION 'Name a firm, and a record by its table and key together, or the firm alone' USING ERRCODE = '22023';
  END IF;
  IF p_table IS NULL THEN
    IF NOT public.firm_is_being_closed(p_firm_id) THEN
      RAISE EXCEPTION 'A firm''s history is deleted only when the firm closes' USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.record_history h WHERE h.firm_id = p_firm_id;
  ELSE
    t := public.record_history_table_named(p_table);
    IF public.record_history_record_exists(p_firm_id, t, p_key) THEN
      RAISE EXCEPTION 'The history of a record that still exists can''t be deleted' USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.record_history h WHERE h.firm_id = p_firm_id AND h.table_name = t AND h.record_key = p_key;
  END IF;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

-- Handing a function to a new owner needs the right to become that role, and, for a role that is not a superuser, CREATE on the function's
-- schema for the new owner. Both are given only for this statement (as 20261116160001 does for the firm's record).
DO $$
BEGIN
  IF NOT pg_has_role(current_user, 'record_history_remover', 'USAGE') THEN
    EXECUTE format('GRANT record_history_remover TO %I', current_user);
  END IF;
END $$;
GRANT CREATE ON SCHEMA public TO record_history_remover;
ALTER FUNCTION public.record_history_remove(uuid, text, text) OWNER TO record_history_remover;
REVOKE CREATE ON SCHEMA public FROM record_history_remover;
REVOKE ALL ON FUNCTION public.record_history_remove(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
-- What the role's function asks, and who runs it: the capture trigger and the closing (both owned by the one that applies migrations).
GRANT EXECUTE ON FUNCTION public.record_history_record_exists(uuid, public.record_history_table, text), public.firm_is_being_closed(uuid),
  public.record_history_table_named(text) TO record_history_remover;
DO $$
BEGIN
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.record_history_remove(uuid, text, text) TO %I', current_user);
END $$;

-- The guard: a delete only for that role. No setting is read.
CREATE OR REPLACE FUNCTION public.record_history_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = 'record_history_remover' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'The history of a record can''t be changed or deleted' USING ERRCODE = '42501';
END;
$$;

-- ---------- 3. A key that can't be confused ----------
CREATE FUNCTION public.record_history_key_of(p_row jsonb, p_columns text[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  parts text[] := '{}';
  c text;
  v text;
BEGIN
  FOREACH c IN ARRAY p_columns LOOP
    v := p_row ->> c;
    IF v IS NULL THEN
      RETURN NULL;
    END IF;
    parts := parts || v;
  END LOOP;
  IF cardinality(parts) = 1 THEN
    RETURN parts[1];
  END IF;
  RETURN to_json(parts)::text;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_key_of(jsonb, text[]) FROM PUBLIC, anon, authenticated;

-- ---------- 2, 5. The writer, restated ----------
-- As 20261118130000 with: the record's deletion goes through record_history_remove (after the record is gone), the key is the unambiguous one,
-- and the session's time zone is UTC while it runs, so a timestamp is stored as the same text whoever writes it.
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

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, actor_id, actor_is_staff)
    VALUES (fid, t, rkey, change, 'created', who, staff);
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
      INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, field, old_value, new_value, actor_id, actor_is_staff)
      VALUES (fid, t, rkey, change, 'changed', f,
              CASE WHEN v_old = 'null'::jsonb THEN NULL ELSE v_old END,
              CASE WHEN v_new = 'null'::jsonb THEN NULL ELSE v_new END,
              who, staff);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- ---------- 2, 4. Attaching it: both triggers, checked, in one call ----------
CREATE FUNCTION public.record_history_refuse_truncate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'The records of % have a history and can''t be emptied', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_refuse_truncate() FROM PUBLIC, anon, authenticated;

-- Gives a table a history: the capture trigger with the fields to track, and the guard that refuses to empty the table. The table must be in
-- public, have a firm_id, and have every key column and field; a field named twice, or one that is also a key column or the firm, is refused.
-- Run again for the same table, it replaces both. Called by the migration that gives a table a history; no API role runs it.
CREATE FUNCTION public.record_history_track(p_table regclass, p_name text, p_key_columns text[], p_fields text[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  rel text;
  col text;
BEGIN
  PERFORM public.record_history_table_named(p_name);
  IF p_key_columns IS NULL OR cardinality(p_key_columns) < 1 OR p_fields IS NULL OR cardinality(p_fields) < 1 THEN
    RAISE EXCEPTION 'A history needs a key and at least one field to track' USING ERRCODE = '22023';
  END IF;
  SELECT c.relname INTO rel FROM pg_class c WHERE c.oid = p_table AND c.relnamespace = 'public'::regnamespace AND c.relkind = 'r';
  IF rel IS NULL THEN
    RAISE EXCEPTION '% is not an ordinary table of the public schema', p_table USING ERRCODE = '42809';
  END IF;
  FOREACH col IN ARRAY ARRAY['firm_id'] || p_key_columns || p_fields LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = p_table AND a.attname = col AND a.attnum > 0 AND NOT a.attisdropped) THEN
      RAISE EXCEPTION '% has no column "%"', rel, col USING ERRCODE = '42703';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM unnest(ARRAY['firm_id'] || p_key_columns || p_fields) x) <> (SELECT count(DISTINCT x) FROM unnest(ARRAY['firm_id'] || p_key_columns || p_fields) x) THEN
    RAISE EXCEPTION 'The firm, the key columns and the tracked fields must all be different columns' USING ERRCODE = '22023';
  END IF;
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', rel || '_history', p_table);
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', rel || '_history_no_truncate', p_table);
  EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.record_history_capture(%L, %L%s)',
    rel || '_history', p_table, p_name, array_to_string(p_key_columns, ','),
    (SELECT string_agg(', ' || quote_literal(f), '' ORDER BY n) FROM unnest(p_fields) WITH ORDINALITY AS u (f, n)));
  EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION public.record_history_refuse_truncate()',
    rel || '_history_no_truncate', p_table);
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_track(regclass, text, text[], text[]) FROM PUBLIC, anon, authenticated;

-- Referral partners, attached again with both triggers.
SELECT public.record_history_track('public.referral_partners', 'referral_partners', ARRAY['code'], ARRAY['name', 'kind']);

-- ---------- The closing, restated ----------
-- 20261118111000's close_firm_now, with one change: the history's rows are deleted through record_history_remove. Everything else is as it was.
CREATE OR REPLACE FUNCTION public.close_firm_now(p_firm_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c public.firm_closures;
  step record;
  m record;
  counts jsonb := '{}'::jsonb;
  n integer;
  ended integer := 0;
  boxes_before integer;
  boxes_after integer;
BEGIN
  -- The firm's row first (FOR UPDATE): a suspension, a refusal, a withdrawal or a stop that is committing is waited for, and everything below
  -- reads the state after it. This lock is what orders them; the request row is not locked separately.
  PERFORM 1 FROM public.firms f WHERE f.id = p_firm_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  -- Never the default firm, whatever a request row says (D-121).
  IF p_firm_id = public.default_firm_id() THEN
    RAISE EXCEPTION 'This firm takes the intakes people start on Nevermore, so it can''t be closed' USING ERRCODE = 'PT403';
  END IF;
  SELECT * INTO c FROM public.firm_closures x WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm has no request to close' USING ERRCODE = 'PT404';
  END IF;
  IF c.closes_at > now() THEN
    RAISE EXCEPTION 'The 30 days have not ended' USING ERRCODE = '55000';
  END IF;
  -- A suspended firm is not closed: the request stays open and the firm stays as the suspension leaves it.
  IF public.firm_is_suspended(p_firm_id) THEN
    RAISE EXCEPTION 'A suspended firm is not closed' USING ERRCODE = '55000';
  END IF;
  PERFORM set_config('nevermore.closing_firm', p_firm_id::text, true);

  SELECT count(*) INTO boxes_before FROM public.broker_mailboxes b
  WHERE b.user_id IN (SELECT x.user_id FROM public.firm_memberships x WHERE x.firm_id = p_firm_id);

  UPDATE public.firm_memberships x SET team_id = NULL WHERE x.firm_id = p_firm_id AND x.team_id IS NOT NULL;
  UPDATE public.firm_member_suspensions x SET team_id = NULL WHERE x.firm_id = p_firm_id AND x.team_id IS NOT NULL;

  FOR step IN SELECT p.src, p.firm_column FROM public.firm_closing_plan() p WHERE p.action = 'delete' ORDER BY p.ord, p.src LOOP
    -- A record's history can be deleted only by the role that owns record_history_remove (ADR 0012), so it is deleted through it.
    IF step.src = 'public.record_history' THEN
      n := public.record_history_remove(p_firm_id);
    ELSE
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', substr(step.src, length('public.') + 1), step.firm_column) USING p_firm_id;
      GET DIAGNOSTICS n = ROW_COUNT;
    END IF;
    counts := counts || jsonb_build_object(substr(step.src, length('public.') + 1), n);
  END LOOP;

  -- Every member's access ends. The ending is the one every other path uses (end_membership_now); the last owner's rule is waived
  -- for this firm and this moment only (keep_firm_owner).
  FOR m IN
    SELECT x.id, x.valid_from, public.membership_is_current(x.valid_from, x.valid_until) AS is_current
    FROM public.firm_memberships x
    WHERE x.firm_id = p_firm_id AND (x.valid_until IS NULL OR x.valid_until > now())
    ORDER BY x.id
  LOOP
    IF m.is_current THEN
      PERFORM public.end_membership_now(m.id, 'The last owner of a firm can''t be removed');
    ELSE
      PERFORM set_config('nevermore.membership_change', 'on', true);
      UPDATE public.firm_memberships x SET valid_until = x.valid_from WHERE x.id = m.id;
      PERFORM set_config('nevermore.membership_change', 'off', true);
    END IF;
    ended := ended + 1;
  END LOOP;
  counts := counts || jsonb_build_object('memberships_ended', ended);

  UPDATE public.firm_member_suspensions x SET ended_at = now(), ended_how = 'removed' WHERE x.firm_id = p_firm_id AND x.ended_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('member_suspensions_ended', n);

  SELECT count(*) INTO boxes_after FROM public.broker_mailboxes b
  WHERE b.user_id IN (SELECT x.user_id FROM public.firm_memberships x WHERE x.firm_id = p_firm_id);
  counts := counts || jsonb_build_object('broker_mailboxes', boxes_before - boxes_after);

  -- The firm's alerts that are still waiting have no one to go to: they end, as a cancelled reminder does, so nothing waits for good.
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = 'cancelled: the firm closed', claimed_at = NULL, locked_until = NULL, pending_send = NULL
  WHERE e.status IN ('pending', 'claimed') AND public.outbox_kind_is_firm_alert(e.kind)
    AND COALESCE(e.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = e.session_id)) = p_firm_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('alerts_cancelled', n);

  UPDATE public.firm_closures x
  SET closed_at = now(), deleted_counts = counts, address = (SELECT f.address FROM public.firms f WHERE f.id = p_firm_id)
  WHERE x.id = c.id;
  PERFORM set_config('nevermore.closing_firm', '', true);
  RETURN counts;
END;
$function$;