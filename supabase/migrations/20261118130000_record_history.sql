-- The history of a record (story CRM-S5.2; docs/BROKER_CRM_BUILD.md D-24, D-28, D-33, D-45, D-115, D-117, D-122; ADR 0023, ADR 0024).
--
-- What this is. Every record a firm keeps (today its referral partners; later its leads, accounts, contacts and opportunities)
-- keeps who created it and when, and every change to its own fields: who, when, which field, from what and to what. Nobody can
-- edit it. It is a different thing from the firm's record of who did what (firm_activity, CRM-P2.3), and neither writes into the
-- other (D-45): that record holds no content, is read by owners and is pruned after ninety days; this one holds a record's own
-- field values, is read by whoever may see the record, and is kept as long as the record is.
--
-- How a field gets in. Only through one trigger function, record_history_capture(), attached to a table with the list of fields to
-- track written in the migration that attaches it:
--     CREATE TRIGGER referral_partners_history AFTER INSERT OR UPDATE OR DELETE ON public.referral_partners
--       FOR EACH ROW EXECUTE FUNCTION public.record_history_capture('referral_partners', 'code', 'name', 'kind');
-- The first argument is the table's short name (one of a fixed list: the domain record_history_table), the second is the column
-- (or the comma-separated columns) that name the record within its firm, and every one after is a field to track. Nothing else is
-- ever compared, so a column that is not listed (an intake's answers, a created or updated stamp) can never enter the history. An
-- intake's answers keep their own history as today (the second criterion of CRM-S5.2): chamber_sessions has no such trigger.
--
-- What is stored.
--   * One row per change of one field, and one row for the creation (kind 'created', no field, no values). Creation is one
--     entry, not one per field.
--   * The values are jsonb, so "from" and "to" read back as they were: text is a JSON string, a number a JSON number, a date or a
--     time its ISO text, a true or false a JSON boolean. A value that was not there (a null column) is SQL NULL here, so "no value"
--     reads back as null and never as the word "null" or an empty string.
--   * The record is named by its firm (firm_id) and its key within the firm (record_key, text). A referral partner's key within its
--     firm is its code, since its primary key is (firm_id, code); a table keyed by a uuid or a number later stores that as text, and
--     a composite key is its columns joined with "/". The key of a tracked record can't change (the trigger refuses it), so the
--     history can't be orphaned.
--   * Who. actor_id is the signed-in person who made the change (auth.uid()), or null for the service role and the scheduled jobs
--     (shown as "System"). actor_is_staff is stamped when the row is written, by the helper the firm's record already uses to
--     decide "acted as a member or as Nevermore" (D-33): a platform admin who was not a current member of the firm is staff, and is
--     shown as "Nevermore" with no id and no email. The real actor is stored for the platform's own use only.
--   * No row existed before this shipped and none is made up: history starts when this ships.
--
-- Who can write, change and read.
--   * Nobody through the API. The table is closed (row security on, no policy, no grant for a browser's role; the service role, which is
--     server code, may read it and write nothing), and the trigger writes as
--     the function's owner inside a write that was already guarded: a member's write reaches a tracked table only through a function
--     that asked assert_firm_writable (D-115), and a closing or suspended firm, or a support session, never gets that far.
--   * Nobody changes or deletes a row, the table's owner included: a trigger refuses an UPDATE always, and a DELETE except (1) the
--     deletion of the record itself, which removes that record's history in the same step (D-45: kept as long as the record), and
--     (2) the firm's closing, which deletes by firm_closing_plan() (D-117). No truncate either.
--   * It is read through record_history_list() only, by whoever may see the record (D-18, D-40): the function asks the caller's
--     membership of THAT firm at this address, and that the record exists in it, and gives one and the same refusal for a record
--     of another firm as for one that was never made. A support session reads it and writes nothing (ADR 0024).

-- ---------- 1. Which tables ----------
CREATE DOMAIN public.record_history_table AS text
  CONSTRAINT record_history_table_known CHECK (VALUE IN ('referral_partners'));

-- A table name a caller sent, as the domain: a name not on the list is refused with a plain message.
CREATE FUNCTION public.record_history_table_named(p_table text)
RETURNS public.record_history_table
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_table IS NULL THEN
    RAISE EXCEPTION 'Name a table' USING ERRCODE = '22023';
  END IF;
  RETURN p_table::public.record_history_table;
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'There is no history for a table called "%"', left(p_table, 64) USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_table_named(text) FROM PUBLIC, anon, authenticated;

-- ---------- 2. Who acted: one rule, written once ----------
-- D-33: the actor is a platform admin (Nevermore's own people) and was not a current member of the firm. p_acted_as_member lets a caller
-- say the actor was a member though the change being recorded has just ended it; left null it is read from the firm's memberships as they
-- stand now. This is the rule firm_activity_insert (20261116160001) wrote inline; it is moved here, unchanged, so the firm's record and the
-- history of a record decide it with the same words.
CREATE FUNCTION public.firm_actor_is_staff(p_actor_id uuid, p_firm_id uuid, p_acted_as_member boolean DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_actor_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_actor_id AND r.role = 'admin')
    AND NOT COALESCE(p_acted_as_member, EXISTS (
      SELECT 1 FROM public.firm_memberships m
      WHERE m.firm_id = p_firm_id AND m.user_id = p_actor_id AND public.membership_is_current(m.valid_from, m.valid_until)))
$$;

REVOKE ALL ON FUNCTION public.firm_actor_is_staff(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- The firm's record's one inserting statement (20261116160001), restated from its only definition with every rule it had; only the
-- staff stamp now asks the helper above.
CREATE OR REPLACE FUNCTION public.firm_activity_insert(
  p_actor_id uuid, p_firm_id uuid, p_kind text, p_record_type text, p_record_id text,
  p_subject_user_id uuid DEFAULT NULL, p_role text DEFAULT NULL, p_acted_as_member boolean DEFAULT NULL)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.firm_activity (firm_id, actor_id, actor_is_staff, kind, record_type, record_id, subject_user_id, role)
  VALUES (p_firm_id, p_actor_id, public.firm_actor_is_staff(p_actor_id, p_firm_id, p_acted_as_member),
          p_kind, p_record_type, p_record_id, p_subject_user_id, p_role)
  RETURNING id
$$;

-- ---------- 3. The table ----------
CREATE TABLE public.record_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- What a reader pages by, with `at`. Random, so it says nothing about how much happened in other firms (the number above is shared by
  -- every firm and never leaves the database).
  entry_key uuid NOT NULL DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  table_name public.record_history_table NOT NULL,
  record_key text NOT NULL CHECK (char_length(record_key) BETWEEN 1 AND 200),
  -- The fields changed by one save share this, so a screen can show them as one change.
  change_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('created', 'changed')),
  field text,
  old_value jsonb,
  new_value jsonb,
  -- The clock's own time, not the transaction's, so a creation and a change made in one transaction still read in the order they happened.
  at timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- No foreign key on purpose: the history outlives the account, and a key's ON DELETE would change a row.
  actor_id uuid,
  actor_is_staff boolean NOT NULL DEFAULT false,
  CONSTRAINT record_history_shape CHECK (
    (kind = 'created' AND field IS NULL AND old_value IS NULL AND new_value IS NULL)
    OR (kind = 'changed' AND field ~ '^[a-z][a-z0-9_]{0,62}$')),
  CONSTRAINT record_history_staff_has_actor CHECK (NOT actor_is_staff OR actor_id IS NOT NULL)
);

CREATE INDEX record_history_record_idx ON public.record_history (firm_id, table_name, record_key, at DESC, entry_key DESC);

ALTER TABLE public.record_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.record_history FROM PUBLIC, anon, authenticated, service_role;
-- The service role (server code, never a browser) may read it, as it reads the firm's record; it writes nothing, and nothing it does can
-- change a row (the trigger below refuses).
GRANT SELECT ON public.record_history TO service_role;

-- ---------- 4. Nobody edits it ----------
-- Refuses every change except the two deletions that are not an edit: a record's own deletion (the capture trigger names the record it is
-- removing the history of, for that statement only) and the firm's closing (close_firm_now names the firm, for that transaction only).
CREATE FUNCTION public.record_history_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND (
       current_setting('nevermore.closing_firm', true) = OLD.firm_id::text
       OR current_setting('nevermore.record_history_cleanup', true) = OLD.firm_id::text || '/' || OLD.table_name || '/' || OLD.record_key) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'The history of a record can''t be changed or deleted' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER record_history_append_only
  BEFORE UPDATE OR DELETE ON public.record_history
  FOR EACH ROW EXECUTE FUNCTION public.record_history_guard();

CREATE TRIGGER record_history_no_truncate
  BEFORE TRUNCATE ON public.record_history
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_audit_change();

-- ---------- 5. The one writer ----------
-- Arguments: the table's short name, the key column(s) within the firm (comma-separated), then the fields to track. The tracked table
-- has a firm_id column. Runs inside the write that made the change (as the function's owner, since no API role may write the history),
-- so a refused write leaves no history and a write that rolls back takes its history with it.
CREATE FUNCTION public.record_history_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t public.record_history_table;
  key_columns text[];
  tracked text[];
  new_row jsonb;
  old_row jsonb;
  f text;
  c text;
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
    SELECT string_agg(old_row ->> k, '/' ORDER BY n) INTO rkey FROM unnest(key_columns) WITH ORDINALITY AS u (k, n);
    -- The record is gone, so its history goes with it (D-45); the guard allows exactly this record's rows, for this statement.
    PERFORM set_config('nevermore.record_history_cleanup', fid::text || '/' || t || '/' || rkey, true);
    DELETE FROM public.record_history h WHERE h.firm_id = fid AND h.table_name = t AND h.record_key = rkey;
    PERFORM set_config('nevermore.record_history_cleanup', '', true);
    RETURN NULL;
  END IF;

  new_row := to_jsonb(NEW);
  fid := (new_row ->> 'firm_id')::uuid;
  SELECT string_agg(new_row ->> k, '/' ORDER BY n) INTO rkey FROM unnest(key_columns) WITH ORDINALITY AS u (k, n);
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
  SELECT string_agg(old_row ->> k, '/' ORDER BY n) INTO old_key FROM unnest(key_columns) WITH ORDINALITY AS u (k, n);
  IF old_key IS DISTINCT FROM rkey OR (old_row ->> 'firm_id') IS DISTINCT FROM (new_row ->> 'firm_id') THEN
    RAISE EXCEPTION 'The firm and the key of a record with a history can''t change' USING ERRCODE = '23514';
  END IF;
  FOREACH f IN ARRAY tracked LOOP
    c := f;
    IF NOT (new_row ? c) THEN
      RAISE EXCEPTION 'The history was asked to track "%", which is not a column of %', c, TG_TABLE_NAME USING ERRCODE = '42703';
    END IF;
    v_old := old_row -> c;
    v_new := new_row -> c;
    IF v_old IS DISTINCT FROM v_new THEN
      INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, field, old_value, new_value, actor_id, actor_is_staff)
      VALUES (fid, t, rkey, change, 'changed', c,
              CASE WHEN v_old = 'null'::jsonb THEN NULL ELSE v_old END,
              CASE WHEN v_new = 'null'::jsonb THEN NULL ELSE v_new END,
              who, staff);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_capture() FROM PUBLIC, anon, authenticated;

-- ---------- 6. Applied to referral partners ----------
-- The partner's own fields: its name and its kind. Not its code (which never changes: it is the key) and not its created or updated
-- stamps or who last saved it (those are the history's own job).
CREATE TRIGGER referral_partners_history
  AFTER INSERT OR UPDATE OR DELETE ON public.referral_partners
  FOR EACH ROW EXECUTE FUNCTION public.record_history_capture('referral_partners', 'code', 'name', 'kind');

-- ---------- 7. Reading ----------
-- Whether the caller may see THAT record in THAT firm: the one place the rule is written for each table, so the reading function and a
-- later screen ask the same question. A referral partner is seen by any current member of its firm at this address (D-18, D-40) and by a
-- support session, which firm_role() reports as 'support'; the record must exist. A table added later adds its line, with the rule its own
-- rows use (can_see_firm_record for a record a person owns). Internal.
CREATE FUNCTION public.record_history_can_see(p_firm_id uuid, p_table public.record_history_table, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_firm_id IS NULL OR p_key IS NULL THEN
    RETURN false;
  END IF;
  IF p_table = 'referral_partners' THEN
    RETURN public.is_firm_member(p_firm_id)
      AND EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = p_firm_id AND r.code = p_key);
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_can_see(uuid, public.record_history_table, text) FROM PUBLIC, anon, authenticated, service_role;

-- A page of one record's history, newest first. A page starts after the last entry the reader saw: the cursor is that entry's time and key
-- together, the two the list is ordered by (paging by offset repeats or skips an entry when one arrives between two pages). Who is a
-- member's email as the firm already sees its members, "Nevermore" for staff with no id or email (D-33), "System" for the service role.
CREATE FUNCTION public.record_history_list(
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
           CASE WHEN h.actor_is_staff THEN 'Nevermore' WHEN h.actor_id IS NULL THEN 'System' ELSE COALESCE(u.email::text, 'A deleted account') END,
           CASE WHEN h.actor_is_staff THEN 'nevermore' WHEN h.actor_id IS NULL THEN 'system' ELSE 'member' END,
           h.field, h.old_value, h.new_value
    FROM public.record_history h
    LEFT JOIN auth.users u ON u.id = h.actor_id AND NOT h.actor_is_staff
    WHERE h.firm_id = p_firm_id AND h.table_name = t AND h.record_key = p_key
      AND (p_after_at IS NULL OR (h.at, h.entry_key) < (p_after_at, p_after_key))
    ORDER BY h.at DESC, h.entry_key DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid) TO authenticated;

-- ---------- 8. Closing a firm deletes it ----------
-- The closing's one list (20261118120000, restated with every line it had). The history of a deleted record goes with the record, so a
-- closing deletes it, and before the records it belongs to (ord 55, partners are 60), though the records' own deletion would clear it too.
CREATE OR REPLACE FUNCTION public.firm_closing_plan()
RETURNS TABLE (ord integer, src text, action text, firm_column text, why text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    -- Deleted: the firm's own working data.
    (10, 'public.firm_invitations', 'delete', 'firm_id', 'pending and past invitations to join'),
    (20, 'public.firm_organisations', 'delete', 'firm_id', 'the listed Google domains and Microsoft tenants'),
    (30, 'public.join_requests', 'delete', 'firm_id', 'requests to join'),
    (40, 'public.table_preferences', 'delete', 'firm_id', 'each person''s column choices'),
    (50, 'public.saved_views', 'delete', 'firm_id', 'saved views'),
    (55, 'public.record_history', 'delete', 'firm_id', 'the history of each record: who created it and every change to its fields; it goes with the record'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (70, 'public.firm_teams', 'delete', 'firm_id', 'teams (the memberships that named one are cleared first)'),
    -- Kept, and why.
    (900, 'public.firms', 'keep', NULL, 'the row stays: its address stays taken for twelve months and its record must still exist'),
    (900, 'public.firm_memberships', 'keep', NULL, 'every membership is ended, not deleted: a membership is the dated record of who belonged (it is never changed)'),
    (900, 'public.firm_member_suspensions', 'keep', NULL, 'each open one is ended; the rows are the dated record of who was suspended'),
    (900, 'public.firm_activity', 'keep', NULL, 'the firm''s own record is pruned after ninety days by its own job (D-45)'),
    (900, 'public.firm_suspensions', 'keep', NULL, 'the platform''s record of suspensions'),
    (900, 'public.firm_closures', 'keep', NULL, 'the platform''s record of this: when it was asked, by whom, when it closed, and what was deleted, without content'),
    (900, 'public.support_sessions', 'keep', NULL, 'the platform''s record of each time Nevermore looked at the firm: who, why, when it started and ended (a session ends when the firm closes)'),
    (900, 'public.advisor_field_reviews', 'keep', NULL, 'an intake''s: it stays for its employer under the intake retention rules'),
    (900, 'public.advisor_notes', 'keep', NULL, 'an intake''s'),
    (900, 'public.advisor_review_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.ai_extraction_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.chamber_certifications', 'keep', NULL, 'an intake''s'),
    (900, 'public.chamber_sessions', 'keep', NULL, 'the intakes: they belong to the employer who made them and are not the firm''s to delete'),
    (900, 'public.document_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.documents', 'keep', NULL, 'an intake''s'),
    (900, 'public.information_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.intake_consents', 'keep', NULL, 'the employer''s own agreement'),
    (900, 'public.intake_deletions', 'keep', NULL, 'the record that an intake was deleted, kept after it'),
    (900, 'public.intake_lifecycle_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.manuscript_versions', 'keep', NULL, 'an intake''s'),
    (900, 'public.profiles', 'keep', NULL, 'the employer''s own profile'),
    (900, 'public.quote_request_addresses', 'keep', NULL, 'a quote request''s: quote requests belong to an intake'),
    (900, 'public.quote_request_events', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_message_attachments', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_messages', 'keep', NULL, 'a quote request''s mail thread with a PEO'),
    (900, 'public.quote_request_messages WHERE quote_request_id IS NULL', 'keep', NULL, 'held mail from a PEO: held for the platform once the firm has no members, and discarded by the holding list''s own schedule'),
    (900, 'public.quote_request_notes', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_thread_reads', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_status_history', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_workflow', 'keep', NULL, 'an intake''s'),
    (900, 'storage.objects WHERE bucket_id = ''documents''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''manuscripts''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;
