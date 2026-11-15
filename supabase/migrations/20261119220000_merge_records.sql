-- Merging in the database (story CRM-S4.3b; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-32, D-33, D-45, D-195, D-198, D-202, D-203, D-209, D-210, D-219, D-222, D-231,
-- D-233, D-234, D-235; GLOSSARY.md "Merge", "Possible duplicate"; ADR 0023, ADR 0024, ADR 0025; 20261119100000_crm_records.sql, 20261119170000_add_contact.sql,
-- 20261119180000_calls_notes_tasks.sql, 20261119210000_bulk_changes.sql).
--
-- What this is. Two accounts made one, two contacts of one account made one, and "keep separate", which clears the possible-duplicate mark. The screen is
-- CRM-S4.3a's (row 22); this is every rule it asks of the database, and the old address that leads to the record kept.
--
--   merge_accounts_preview / merge_accounts
--       The account kept absorbs the account removed. Everything attached moves, in one transaction (all or none): its contacts (a main contact stays the
--       main contact of the kept account when that has none, else arrives as nobody's main contact, as a moved contact does), its opportunities (each with
--       its intake, so its quote requests, files and submission), its calls, notes and tasks (also those on the account alone, which no move of a contact
--       takes), its labels (a union: the kept account carries every label either had, the first label's who and when kept), and its history. The removed
--       account is deleted and nothing is lost. For each field that differs the person picks the value to keep (p_take names the fields taken from the removed
--       account; the others stay as the kept account has them): the database holds the pick, the screen is the choice. A pick may take the removed account's
--       owner (a current member, held FOR SHARE) and never clears the owner.
--   merge_contacts_preview / merge_contacts
--       The same for two contacts of one account (D-210): the removed contact's calls, notes and tasks and its place as an opportunity's main contact go to the
--       contact kept; the contact kept is the account's main contact when either was; "Do not email" stays ticked when either had it (a request not to be
--       written to is never lost by a merge); a prospect link the kept contact lacks is taken, so the same person is not added again by the chain.
--   keep_accounts_separate
--       Clears the possible-duplicate mark of an account (D-195). Nothing keeps the pair from being suggested again: only the chain at certification and the
--       bringing in of existing submissions ever set the mark, and each does so for an account at the moment it is made, so a cleared mark is not set again
--       (CRM-S4.2's warning while typing is a question about a record not yet made).
--   account_duplicate_mark
--       What the possible-duplicate banner needs: the account it is marked a duplicate of (only when the caller may see it), and whether the caller may merge
--       them or keep them separate.
--   follow_merged_record
--       The old address (D-203): the id of a record merged away leads to the record kept. See below.
--
-- Who may merge (D-203, D-209). Whoever may change both records by the level rule (can_change_firm_record) and sees both (PT404 otherwise, the same answer as
-- for a record that is not there), in a firm the call acts for (firm_to_act_for), which is not closing and not a Nevermore support session
-- (assert_firm_writable). What moves with an account is the account's own: its contacts, opportunities, calls, notes and tasks are not asked their own
-- owner's level (a merge is an act on the two accounts, which D-203 says; a person who may change both accounts is not stopped by a colleague's contact on one
-- of them). Two contacts are the records changed, so the level rule is asked of each contact's own owner. The kept account (and the account of two contacts)
-- must not be archived (D-222: nothing is added to one; 55000); the account removed may be, since leaving one is allowed. Who may follow an old address, below.
--
-- The old address (D-203: "its address leads to the kept record"). `merged_records` holds, for each record merged away, the record it became (its firm,
-- kind, old id, the id kept, the name it had, who and when). It is written only by the merge functions, and the foreign key to the record kept cascades: a
-- record deleted later takes the pointers to it with it. A second merge repoints the pointers to the record it removes at the record it keeps, so a pointer
-- is always one step. follow_merged_record(firm, kind, id) answers for a member of the firm the call acts for (and a Nevermore support session, which
-- reads): a record that is there (it may be seen) answers as itself; an id merged away answers the record kept, if the caller may see that one; anything
-- else (another firm's id, an id never made, a record the caller may not see, a pointer to a record the caller may not see) is the one refusal PT404. The
-- table is closed to the API (row security with no policy, no grant); the closing deletes it with the records.
--
-- History (D-203: "its history moves to the kept record marked as from the merged record"). The history is append-only, so moving it is narrow. A role with
-- no login (record_history_merger) owns the one function (record_history_move) that may change a history row, only its key and the two marks
-- (merged_from_key, merged_from_name), and only for a merge already recorded in merged_records; the guard allows an update by that role of those three
-- columns and of nothing else. The kept record's history then holds the removed record's entries (their times and authors as they were) each marked "from
-- <the removed record's name>", and one entry of its own, field "merged": the merge, by whom and when, the removed record's name as its value. Entries that
-- came from a record merged earlier keep their first mark.
--
-- Locks, in this order and by id inside each kind (supabase/tests/merge_records.sql proves it with two sessions):
--   0. the firm's row (assert_firm_writable), then the chain's advisory lock SHARED: make_intake_chain (D-226) takes it exclusive and then makes an account that
--      may name an earlier account as its possible duplicate, which would meet the removed account's delete; a merge in flight is waited for and then
--      sees what the chain made. Merges do not wait for each other here.
--   1. accounts, FOR UPDATE, in ONE statement ordered by id: the two, and every account marked a possible duplicate of the removed one (its mark is
--      repointed, which the delete's own foreign key action would otherwise do in an order nobody chose). The removed account is held FOR UPDATE at once, so
--      a call being logged on it (which holds the account FOR KEY SHARE) is waited for and then goes along, and one that arrives later waits and is refused
--      by the foreign key once the account is gone, never lost with it. The same order bulk_accounts_change, move_contact and delete_account use.
--   2. the chosen owner's membership, FOR SHARE (member_to_own), as every owner change.
--   3. the removed account's calls, notes and tasks, FOR UPDATE, then its contacts, then its opportunities. update_activity holds an activity and then wants
--      KEY SHARE on a contact or an opportunity it newly points at: taking the activities first means it is waited for, never met in a ring.
--   For two contacts: the account FOR SHARE (as add_contact and move_contact), both contacts FOR UPDATE by id, then the removed contact's activities (as
--   move_contact), the opportunities that name it as their main contact.
-- Nothing in a merge deletes or unlinks an opportunity, so the rule that every submission and quote request sits on one (20261119120000) is never at risk:
-- an opportunity's account changes, its intake does not (the unlink trigger is on the intake column, and is not fired). The race noted for this story
-- ("a quote request recorded while its opportunity is deleted by a merge") is closed by that, and supabase/tests/merge_records.sql proves it with two
-- sessions anyway.
--
-- A pending bulk change's undo (D-202). Its record of the removed account goes with the account (its foreign key cascades), and the undo counts it as gone,
-- as for any deleted account. Its record of the kept account is a record changed since if the merge changed that field or labels (the merge writes the
-- history entries the undo looks for); an entry that came from the removed account is not the kept account's own change (bulk_accounts_undo ignores marked
-- entries).
--
-- What is NOT here (D-24): leads' merge (CRM-L1.x), the screen (CRM-S4.3a), search's recent records (CRM-S1.2b adds recent_records; see its note), the emails
-- of a merged account (Epic 6: they will name the account and the contact and follow them as the calls do) and custom fields (CRM-X3.1).

-- ---------- 1. Contacts can be named by firm and id ----------
ALTER TABLE public.contacts ADD CONSTRAINT contacts_firm_id_id_key UNIQUE (firm_id, id);

-- ---------- 2. The old address ----------
CREATE TABLE public.merged_records (
  kind text NOT NULL CONSTRAINT merged_records_kind_check CHECK (kind IN ('account', 'contact')),
  -- The id of the record that was merged away. Not a foreign key: the record is gone.
  from_id uuid NOT NULL,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  into_account_id uuid,
  into_contact_id uuid,
  -- The name the record had (an account's name, a contact's name), for "merged into" and "from" lines.
  from_name text,
  merged_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  merged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, from_id),
  CONSTRAINT merged_records_one_target CHECK ((kind = 'account') = (into_account_id IS NOT NULL) AND (kind = 'contact') = (into_contact_id IS NOT NULL)),
  -- The record kept, of the same firm. Its deletion takes the pointers to it.
  CONSTRAINT merged_records_account_fkey FOREIGN KEY (firm_id, into_account_id) REFERENCES public.accounts (firm_id, id) ON DELETE CASCADE,
  CONSTRAINT merged_records_contact_fkey FOREIGN KEY (firm_id, into_contact_id) REFERENCES public.contacts (firm_id, id) ON DELETE CASCADE
);

CREATE INDEX merged_records_account_idx ON public.merged_records (firm_id, into_account_id) WHERE into_account_id IS NOT NULL;
CREATE INDEX merged_records_contact_idx ON public.merged_records (firm_id, into_contact_id) WHERE into_contact_id IS NOT NULL;

COMMENT ON TABLE public.merged_records IS 'A record merged away and the record it became, so an old address leads to the record kept (glossary: Merge). Written only by the merge functions; read through follow_merged_record.';

ALTER TABLE public.merged_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merged_records FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.merged_records TO service_role;

-- ---------- 3. The history can be moved to the record kept, by one role, in one way ----------
ALTER TABLE public.record_history ADD COLUMN merged_from_key text;
ALTER TABLE public.record_history ADD COLUMN merged_from_name text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'record_history_merger') THEN
    CREATE ROLE record_history_merger NOLOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO record_history_merger;
GRANT SELECT ON public.record_history TO record_history_merger;
GRANT UPDATE (record_key, merged_from_key, merged_from_name) ON public.record_history TO record_history_merger;
GRANT SELECT ON public.merged_records TO record_history_merger;
CREATE POLICY record_history_merger_select ON public.record_history FOR SELECT TO record_history_merger USING (true);
CREATE POLICY record_history_merger_update ON public.record_history FOR UPDATE TO record_history_merger USING (true) WITH CHECK (true);
CREATE POLICY merged_records_merger_select ON public.merged_records FOR SELECT TO record_history_merger USING (true);

-- 20261118130500's guard, with the one new way through: the merger role changes a row's key and its two marks, and no other column.
CREATE OR REPLACE FUNCTION public.record_history_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = 'record_history_remover' THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND current_user = 'record_history_merger'
     AND (to_jsonb(NEW) - 'record_key' - 'merged_from_key' - 'merged_from_name') = (to_jsonb(OLD) - 'record_key' - 'merged_from_key' - 'merged_from_name') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'The history of a record can''t be changed or deleted' USING ERRCODE = '42501';
END;
$$;

-- Moves a record's history to the record kept, for a merge already recorded in merged_records (the removed record is still there). Marks each moved entry as
-- from the removed record, keeping the mark of an entry that came from a record merged earlier. Answers how many entries moved. Owned by the merger role, so
-- it is the role that updates; no API role can call it.
CREATE FUNCTION public.record_history_move(p_firm_id uuid, p_table text, p_from_key text, p_into_key text, p_from_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  moved integer;
BEGIN
  IF p_table NOT IN ('accounts', 'contacts') THEN
    RAISE EXCEPTION 'Only an account''s or a contact''s history is moved by a merge' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.merged_records m
    WHERE m.firm_id = p_firm_id AND m.kind = CASE p_table WHEN 'accounts' THEN 'account' ELSE 'contact' END
      AND m.from_id::text = p_from_key AND COALESCE(m.into_account_id, m.into_contact_id)::text = p_into_key) THEN
    RAISE EXCEPTION 'The history of a record moves only for a merge that has been recorded' USING ERRCODE = '42501';
  END IF;
  UPDATE public.record_history h
  SET record_key = p_into_key, merged_from_key = COALESCE(h.merged_from_key, p_from_key), merged_from_name = COALESCE(h.merged_from_name, p_from_name)
  WHERE h.firm_id = p_firm_id AND h.table_name = p_table::public.record_history_table AND h.record_key = p_from_key;
  GET DIAGNOSTICS moved = ROW_COUNT;
  RETURN moved;
END;
$$;

DO $$
BEGIN
  IF NOT pg_has_role(current_user, 'record_history_merger', 'USAGE') THEN
    EXECUTE format('GRANT record_history_merger TO %I', current_user);
  END IF;
END $$;
GRANT CREATE ON SCHEMA public TO record_history_merger;
ALTER FUNCTION public.record_history_move(uuid, text, text, text, text) OWNER TO record_history_merger;
REVOKE CREATE ON SCHEMA public FROM record_history_merger;
REVOKE ALL ON FUNCTION public.record_history_move(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
DO $$
BEGIN
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.record_history_move(uuid, text, text, text, text) TO %I', current_user);
END $$;

-- The history as a reader gets it (20261118160000's record_history_list, restated with every rule it had) now says which entries came from a record merged
-- into this one.
DROP FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid);
CREATE FUNCTION public.record_history_list(
  p_firm_id uuid, p_table text, p_key text, p_limit integer DEFAULT 50, p_after_at timestamptz DEFAULT NULL, p_after_key uuid DEFAULT NULL)
RETURNS TABLE (
  entry_key uuid, at timestamptz, change_id uuid, kind text, who text, who_kind text, field text, from_value jsonb, to_value jsonb, merged_from text)
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
           h.field, h.old_value, h.new_value, h.merged_from_name
    FROM public.record_history h
    WHERE h.firm_id = p_firm_id AND h.table_name = t AND h.record_key = p_key
      AND (p_after_at IS NULL OR (h.at, h.entry_key) < (p_after_at, p_after_key))
    ORDER BY h.at DESC, h.entry_key DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid) TO authenticated;

-- ---------- 4. Calls, notes and tasks follow a merge ----------
-- 20261119180000's guard, restated with every rule it had; the one new way for an activity's account to change: its account was merged into the account it
-- moves to (merged_records says so, and only a merge writes it). That moves the ones on the account alone, which have no contact or opportunity to follow.
CREATE OR REPLACE FUNCTION public.activities_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n integer;
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.firm_id IS DISTINCT FROM OLD.firm_id
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A call, note or task can''t be moved to another firm or made into another kind' USING ERRCODE = '42501';
  END IF;
  -- Its account changes only by following its contact or its opportunity, which has already moved there (the same transaction, an earlier statement), and which
  -- the row still names: a different contact or opportunity of the new account in its place is not following.
  IF NEW.account_id IS DISTINCT FROM OLD.account_id AND NOT (
       (NEW.contact_id IS NOT NULL AND NEW.contact_id IS NOT DISTINCT FROM OLD.contact_id AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = NEW.contact_id AND c.firm_id = NEW.firm_id AND c.account_id = NEW.account_id))
    OR (NEW.opportunity_id IS NOT NULL AND NEW.opportunity_id IS NOT DISTINCT FROM OLD.opportunity_id AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = NEW.opportunity_id AND o.firm_id = NEW.firm_id AND o.account_id = NEW.account_id))
    OR EXISTS (SELECT 1 FROM public.merged_records m WHERE m.kind = 'account' AND m.from_id = OLD.account_id AND m.into_account_id = NEW.account_id AND m.firm_id = NEW.firm_id)) THEN
    RAISE EXCEPTION 'A call, note or task moves to another account only with its contact or its opportunity' USING ERRCODE = '42501';
  END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id AND NEW.author_id IS NOT NULL THEN
    RAISE EXCEPTION 'Who logged a call, note or task can''t be changed' USING ERRCODE = '42501';
  END IF;
  IF OLD.kind = 'note' THEN
    IF NEW.body IS DISTINCT FROM OLD.body OR NEW.at IS DISTINCT FROM OLD.at THEN
      IF OLD.author_id IS NULL OR OLD.author_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the person who wrote a note can change it' USING ERRCODE = '42501';
      END IF;
      IF now() >= OLD.created_at + interval '24 hours' THEN
        RAISE EXCEPTION 'A note can''t be changed after a day. Add to it instead.' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NEW.additions IS DISTINCT FROM OLD.additions THEN
      n := jsonb_array_length(OLD.additions);
      IF jsonb_array_length(NEW.additions) < n OR COALESCE((
           SELECT jsonb_agg(x.e ORDER BY x.i) FROM jsonb_array_elements(NEW.additions) WITH ORDINALITY AS x (e, i) WHERE x.i <= n), '[]'::jsonb)
         IS DISTINCT FROM OLD.additions THEN
        RAISE EXCEPTION 'What was added to a note can''t be changed or taken away' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.activities_guard() FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 5. The Activity tab marks what came from a merged account ----------
-- 20261119180000's account_tab_rows, restated with every branch it had; a history entry also carries `merged_from`, the name of the record it came from when it
-- was moved by a merge.
CREATE OR REPLACE FUNCTION public.account_tab_rows(p_account_id uuid, p_tab text, p_limit integer, p_offset integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  n bigint;
  r jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit < 0 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'A page is 0 to 100 rows, from a place that is not before the first' USING ERRCODE = '22023';
  END IF;
  IF p_tab = 'contacts' THEN
    SELECT count(*) INTO n FROM public.contacts c WHERE c.account_id = p_account_id;
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY c.is_main DESC, lower(c.last_name), lower(COALESCE(c.first_name, '')), c.id) AS o,
             jsonb_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name, 'title', c.title, 'email', c.email, 'phone', c.phone,
                                'mobile', c.mobile, 'is_main', c.is_main, 'do_not_email', c.do_not_email) AS j
      FROM public.contacts c WHERE c.account_id = p_account_id
      ORDER BY c.is_main DESC, lower(c.last_name), lower(COALESCE(c.first_name, '')), c.id
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab = 'opportunities' THEN
    SELECT count(*) INTO n FROM public.opportunities o WHERE o.account_id = p_account_id;
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY o.target_start DESC NULLS LAST, o.created_at DESC, o.id) AS o,
             jsonb_build_object('id', o.id, 'name', o.name, 'stage', public.opportunity_stage(o.id), 'target_start', o.target_start,
                                'submission_id', o.intake_id) AS j
      FROM public.opportunities o WHERE o.account_id = p_account_id
      ORDER BY o.target_start DESC NULLS LAST, o.created_at DESC, o.id
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab = 'quotes' THEN
    SELECT count(*) INTO n FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE o.account_id = p_account_id;
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY q.sent_on DESC NULLS LAST, q.id DESC) AS o,
             jsonb_build_object('id', q.id, 'submission_id', q.session_id, 'opportunity_id', o.id, 'opportunity_name', o.name, 'peo_name', q.peo_name,
                                'status', q.status, 'sent_on', q.sent_on, 'quote_received_on', q.quote_received_on, 'quote_expires_on', q.quote_expires_on) AS j
      FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE o.account_id = p_account_id
      ORDER BY q.sent_on DESC NULLS LAST, q.id DESC
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab = 'files' THEN
    SELECT count(*) INTO n FROM public.documents d JOIN public.opportunities o ON o.intake_id = d.session_id
    WHERE o.account_id = p_account_id AND d.scan_verdict = 'clean';
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY d.created_at DESC, d.id) AS o,
             jsonb_build_object('id', d.id, 'file_name', d.file_name, 'mime_type', d.mime_type, 'size_bytes', d.size_bytes, 'category', d.category,
                                'created_at', d.created_at, 'submission_id', d.session_id, 'storage_path', d.storage_path) AS j
      FROM public.documents d JOIN public.opportunities o ON o.intake_id = d.session_id
      WHERE o.account_id = p_account_id AND d.scan_verdict = 'clean'
      ORDER BY d.created_at DESC, d.id
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab IN ('activity', 'activity_calls', 'activity_notes', 'activity_tasks', 'activity_changes') THEN
    WITH entries AS (
      -- The record history of the account and of its contacts.
      SELECT 'change'::text AS type, e.at, e.entry_key,
             jsonb_build_object('type', 'change', 'entry_key', e.entry_key, 'at', e.at, 'change_id', e.change_id, 'kind', e.kind,
                                'who', public.record_history_who(e.actor_id, e.actor_is_staff),
                                'who_kind', CASE WHEN e.actor_is_staff THEN 'nevermore' WHEN e.actor_id IS NULL THEN 'system' ELSE 'member' END,
                                'field', e.field, 'from_value', e.old_value, 'to_value', e.new_value,
                                'record_table', e.table_name::text, 'record_id', e.record_key, 'record_name', e.record_name, 'merged_from', e.merged_from_name) AS j
      FROM (
        SELECT h.*, a.name AS record_name
        FROM public.accounts a
        JOIN public.record_history h ON h.firm_id = a.firm_id AND h.table_name = 'accounts' AND h.record_key = a.id::text
        WHERE a.id = p_account_id
        UNION ALL
        SELECT h.*, btrim(concat_ws(' ', c.first_name, c.last_name))
        FROM public.contacts c
        JOIN public.record_history h ON h.firm_id = c.firm_id AND h.table_name = 'contacts' AND h.record_key = c.id::text
        WHERE c.account_id = p_account_id) e
      WHERE p_tab IN ('activity', 'activity_changes')
      UNION ALL
      -- Its calls, notes and tasks (and those on its contacts, which carry the account too). Only the key is taken here: the row is built below, for the page's
      -- rows alone, so an account with thousands of notes does not build them all to show five.
      SELECT t.kind, t.at, t.id, NULL::jsonb
      FROM public.activities t
      WHERE t.account_id = p_account_id
        AND (p_tab = 'activity' OR t.kind = CASE p_tab WHEN 'activity_calls' THEN 'call' WHEN 'activity_notes' THEN 'note' WHEN 'activity_tasks' THEN 'task' END)
    )
    SELECT (SELECT count(*) FROM entries),
           COALESCE((SELECT jsonb_agg(x.j ORDER BY x.o) FROM (
             SELECT row_number() OVER (ORDER BY e.at DESC, e.entry_key DESC) AS o,
                    COALESCE(e.j, (SELECT public.crm_activity_row(t) FROM public.activities t WHERE t.id = e.entry_key)) AS j
             FROM (SELECT * FROM entries ORDER BY at DESC, entry_key DESC OFFSET p_offset LIMIT p_limit) e) x), '[]'::jsonb)
    INTO n, r;
  ELSE
    RAISE EXCEPTION 'An account has no tab called "%"', left(COALESCE(p_tab, ''), 40) USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('count', n, 'rows', r);
END;
$$;


REVOKE ALL ON FUNCTION public.account_tab_rows(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated, service_role;


-- ---------- 6. A bulk change's undo does not take a moved entry for a change made since ----------
-- 20261119210000's undo, restated with every rule it had; the one change: the history entries it counts as changes made to an account since are the account's
-- own, not those a merge moved to it from another account (their ids are older or newer by accident of when that account was changed).
CREATE OR REPLACE FUNCTION public.bulk_accounts_undo(p_change_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  firm uuid;
  ch public.bulk_changes;
  rec public.bulk_change_records;
  a public.accounts;
  o public.opportunities;
  restored integer := 0;
  skipped jsonb := '[]'::jsonb;
  opp_restored integer := 0;
  opp_skipped integer := 0;
  prev uuid;
  lid uuid;
  current_value jsonb;
  why text;
  since boolean;
  gone integer;
  opp_gone integer;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO ch FROM public.bulk_changes c WHERE c.id = p_change_id AND c.firm_id = firm FOR UPDATE;
  IF ch.id IS NULL OR ch.actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'That change isn''t available to undo' USING ERRCODE = 'PT404';
  END IF;
  -- Theirs only while the membership they made it under is still current: one who has since been removed, or made another role under a new membership, holds
  -- the level they hold now (D-209), and a change they could no longer make is not theirs to put back. (Giving accounts away does not end it.)
  IF ch.actor_membership_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.firm_memberships m WHERE m.id = ch.actor_membership_id AND m.firm_id = firm AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)) THEN
    RAISE EXCEPTION 'That change isn''t available to undo' USING ERRCODE = 'PT404';
  END IF;
  IF ch.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'That change was already undone.' USING ERRCODE = 'PT409';
  END IF;
  IF now() > ch.undo_until THEN
    RAISE EXCEPTION 'That change was made more than 10 minutes ago, so it can no longer be undone.' USING ERRCODE = 'PT410';
  END IF;

  -- 1. The accounts, in id order, in one statement. 2. The previous owners' memberships. 3. The opportunities.
  PERFORM 1 FROM public.accounts x WHERE x.firm_id = firm AND x.id IN (SELECT r.record_id FROM public.bulk_change_records r WHERE r.change_id = ch.id AND r.record_type = 'account')
  ORDER BY x.id FOR NO KEY UPDATE;
  IF ch.action = 'owner' THEN
    PERFORM 1 FROM public.firm_memberships m
    WHERE m.firm_id = firm AND public.membership_is_current(m.valid_from, m.valid_until)
      AND m.user_id IN (SELECT (r.before ->> 'owner_id')::uuid FROM public.bulk_change_records r WHERE r.change_id = ch.id)
    ORDER BY m.id FOR SHARE;
  END IF;
  PERFORM 1 FROM public.opportunities x WHERE x.firm_id = firm AND x.id IN (SELECT r.record_id FROM public.bulk_change_records r WHERE r.change_id = ch.id AND r.record_type = 'opportunity')
  ORDER BY x.id FOR NO KEY UPDATE;

  FOR rec IN SELECT r.* FROM public.bulk_change_records r WHERE r.change_id = ch.id AND r.record_type = 'account' ORDER BY r.record_id LOOP
    SELECT * INTO a FROM public.accounts x WHERE x.id = rec.record_id AND x.firm_id = firm;
    why := NULL;
    IF a.id IS NULL THEN
      CONTINUE;
    END IF;
    -- Changed since: the record's history has an entry for this field after the change finished with it (a value put back to what it was is a change too,
    -- D-202), whoever made it; the value is looked at as well.
    since := EXISTS (SELECT 1 FROM public.record_history h WHERE h.firm_id = firm AND h.table_name = 'accounts' AND h.record_key = a.id::text AND h.merged_from_key IS NULL AND h.id > rec.history_mark
      AND h.field = CASE ch.action WHEN 'owner' THEN 'owner_id' WHEN 'archive' THEN 'archived_at' WHEN 'field' THEN rec.after ->> 'field' ELSE 'labels' END);
    IF since THEN
      why := 'It has been changed since.';
    ELSIF ch.action = 'owner' THEN
      prev := (rec.before ->> 'owner_id')::uuid;
      IF a.owner_id IS DISTINCT FROM (rec.after ->> 'owner_id')::uuid THEN
        why := 'Its owner has changed since.';
      ELSIF prev IS NOT NULL AND NOT public.crm_is_current_member(firm, prev) THEN
        skipped := skipped || jsonb_build_object('id', a.id, 'name', rec.record_name, 'code', 'owner_left', 'reason', 'Its previous owner is no longer a member of the firm.');
        CONTINUE;
      ELSE
        UPDATE public.accounts SET owner_id = prev WHERE id = a.id;
      END IF;
    ELSIF ch.action = 'archive' THEN
      IF COALESCE(to_jsonb(a.archived_at), 'null'::jsonb) IS DISTINCT FROM rec.after -> 'archived_at' THEN
        why := 'It has been archived or restored again since.';
      ELSE
        UPDATE public.accounts SET archived_at = NULL WHERE id = a.id;
      END IF;
    ELSIF ch.action = 'field' THEN
      IF public.account_field_json(a, rec.after ->> 'field') IS DISTINCT FROM COALESCE(rec.after -> 'value', 'null'::jsonb) THEN
        why := 'That field has changed since.';
      ELSIF rec.after ->> 'field' = 'phone' AND NULLIF(rec.before ->> 'value', '') IS NOT NULL AND NOT public.is_valid_phone(rec.before ->> 'value') THEN
        -- An old phone that fails today's rule may stay until it is changed, but it can't be written back (check_account_phone): this record is named, the rest go.
        skipped := skipped || jsonb_build_object('id', a.id, 'name', rec.record_name, 'code', 'phone_rule', 'reason', 'Its earlier phone number no longer passes the phone rule.');
        CONTINUE;
      ELSE
        PERFORM public.account_set_field(a.id, rec.before ->> 'field', COALESCE(rec.before -> 'value', 'null'::jsonb));
      END IF;
    ELSIF ch.action = 'label_add' THEN
      IF NOT EXISTS (SELECT 1 FROM public.account_labels al WHERE al.id = (rec.after ->> 'account_label_id')::uuid) THEN
        why := 'The label has been taken off since.';
      ELSE
        DELETE FROM public.account_labels WHERE id = (rec.after ->> 'account_label_id')::uuid;
      END IF;
    ELSE
      lid := (rec.before ->> 'label_id')::uuid;
      IF EXISTS (SELECT 1 FROM public.account_labels al WHERE al.account_id = a.id AND al.label_id = lid) THEN
        why := 'The label has been put on again since.';
      ELSIF NOT EXISTS (SELECT 1 FROM public.labels l WHERE l.id = lid AND l.firm_id = firm) THEN
        why := 'The label no longer exists.';
      ELSIF a.archived_at IS NOT NULL THEN
        skipped := skipped || jsonb_build_object('id', a.id, 'name', rec.record_name, 'code', 'archived', 'reason', 'It is archived, and nothing can be added to an archived account. Restore it first.');
        CONTINUE;
      ELSE
        INSERT INTO public.account_labels (firm_id, account_id, label_id, added_by, added_at)
        VALUES (firm, a.id, lid, (rec.before ->> 'added_by')::uuid, (rec.before ->> 'added_at')::timestamptz);
      END IF;
    END IF;
    IF why IS NOT NULL THEN
      skipped := skipped || jsonb_build_object('id', a.id, 'name', rec.record_name, 'code', 'changed_since', 'reason', why);
    ELSE
      restored := restored + 1;
    END IF;
  END LOOP;

  -- The opportunities the owner change handed over: put back where their owner is still the one it set and the previous owner is still a member.
  FOR rec IN SELECT r.* FROM public.bulk_change_records r WHERE r.change_id = ch.id AND r.record_type = 'opportunity' ORDER BY r.record_id LOOP
    SELECT * INTO o FROM public.opportunities x WHERE x.id = rec.record_id AND x.firm_id = firm;
    prev := (rec.before ->> 'owner_id')::uuid;
    IF o.id IS NULL OR o.owner_id IS DISTINCT FROM (rec.after ->> 'owner_id')::uuid
       OR EXISTS (SELECT 1 FROM public.record_history h WHERE h.firm_id = firm AND h.table_name = 'opportunities' AND h.record_key = o.id::text AND h.field = 'owner_id' AND h.id > rec.history_mark)
       OR (prev IS NOT NULL AND NOT public.crm_is_current_member(firm, prev)) THEN
      opp_skipped := opp_skipped + 1;
    ELSE
      UPDATE public.opportunities SET owner_id = prev WHERE id = o.id;
      opp_restored := opp_restored + 1;
    END IF;
  END LOOP;

  -- A label this change made, which no account carries any more, goes out of the firm's list: nobody can delete one until Settings (Epic 9). The label is held
  -- first, so an account that is just being given it by another change is waited for and seen (and its row is not taken with the label).
  IF ch.action = 'label_add' AND ch.detail ->> 'label_created' = 'true' THEN
    lid := (ch.detail ->> 'label_id')::uuid;
    PERFORM 1 FROM public.labels l WHERE l.id = lid AND l.firm_id = firm FOR UPDATE;
    IF FOUND AND NOT EXISTS (SELECT 1 FROM public.account_labels al WHERE al.label_id = lid) THEN
      DELETE FROM public.labels WHERE id = lid AND firm_id = firm;
    END IF;
  END IF;
  UPDATE public.bulk_changes SET undone_at = now() WHERE id = ch.id;
  -- Records the change changed that are no longer there (an account or an opportunity deleted since took its row with it): a count, never a name.
  gone := GREATEST(ch.record_count - (SELECT count(*) FROM public.bulk_change_records r WHERE r.change_id = ch.id AND r.record_type = 'account'), 0);
  opp_gone := GREATEST(ch.opportunity_count - (SELECT count(*) FROM public.bulk_change_records r WHERE r.change_id = ch.id AND r.record_type = 'opportunity'), 0);
  RETURN jsonb_build_object('action', ch.action, 'restored', restored, 'skipped', skipped, 'gone', gone,
    'opportunities', jsonb_build_object('restored', opp_restored, 'skipped', opp_skipped, 'gone', opp_gone));
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_accounts_undo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_accounts_undo(uuid, uuid) TO authenticated;

-- ---------- 7. The common rules ----------
-- The two accounts of a merge, checked, and held when p_lock. The firm is already known (firm_to_act_for) and writable. Refused, in this order: two accounts not
-- chosen or the same one (22023), either not there or not seen (PT404), either not changeable by the level rule (42501, in words that name it), the account
-- kept archived (55000). With p_lock: the chain's advisory lock shared, then every account the merge writes, FOR UPDATE, in one statement in id order (the
-- two and the accounts marked a possible duplicate of the removed one); an account marked since the first look is a clash the person is asked to retry (40001).
CREATE FUNCTION public.account_merge_pair(p_firm_id uuid, p_keep_id uuid, p_remove_id uuid, p_lock boolean, OUT kept_row public.accounts, OUT gone_row public.accounts)
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  dep uuid[];
  dep2 uuid[];
BEGIN
  IF p_keep_id IS NULL OR p_remove_id IS NULL THEN
    RAISE EXCEPTION 'Choose two accounts to merge.' USING ERRCODE = '22023';
  END IF;
  IF p_keep_id = p_remove_id THEN
    RAISE EXCEPTION 'Choose two different accounts to merge.' USING ERRCODE = '22023';
  END IF;
  IF p_lock THEN
    PERFORM pg_advisory_xact_lock_shared(hashtextextended('crm_chain:' || p_firm_id::text, 0));
    SELECT COALESCE(array_agg(x.id), '{}') INTO dep FROM public.accounts x WHERE x.firm_id = p_firm_id AND x.possible_duplicate_of = p_remove_id AND x.id <> p_keep_id;
    PERFORM 1 FROM public.accounts x WHERE x.firm_id = p_firm_id AND x.id = ANY (ARRAY[p_keep_id, p_remove_id] || dep) ORDER BY x.id FOR UPDATE;
    SELECT COALESCE(array_agg(x.id), '{}') INTO dep2 FROM public.accounts x WHERE x.firm_id = p_firm_id AND x.possible_duplicate_of = p_remove_id AND x.id <> p_keep_id;
    IF EXISTS (SELECT 1 FROM unnest(dep2) d WHERE d <> ALL (dep)) THEN
      RAISE EXCEPTION 'An account was marked as a possible duplicate while this was starting. Try again.' USING ERRCODE = '40001';
    END IF;
  END IF;
  SELECT * INTO kept_row FROM public.accounts x WHERE x.id = p_keep_id AND x.firm_id = p_firm_id;
  SELECT * INTO gone_row FROM public.accounts x WHERE x.id = p_remove_id AND x.firm_id = p_firm_id;
  IF kept_row.id IS NULL OR gone_row.id IS NULL
     OR NOT public.can_see_firm_record(kept_row.firm_id, kept_row.owner_id) OR NOT public.can_see_firm_record(gone_row.firm_id, gone_row.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF NOT public.can_change_firm_record(kept_row.firm_id, kept_row.owner_id) THEN
    RAISE EXCEPTION 'You can''t merge these accounts, because you can''t change %. %', kept_row.name, public.account_change_words(kept_row.owner_id) USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_change_firm_record(gone_row.firm_id, gone_row.owner_id) THEN
    RAISE EXCEPTION 'You can''t merge these accounts, because you can''t change %. %', gone_row.name, public.account_change_words(gone_row.owner_id) USING ERRCODE = '42501';
  END IF;
  IF kept_row.archived_at IS NOT NULL THEN
    RAISE EXCEPTION '% is archived, and nothing can be moved onto an archived account. Restore it first, or keep the other account.', kept_row.name USING ERRCODE = '55000';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.account_merge_pair(uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- The fields a person picks between, in the order a screen shows them. owner_id is the owner. Internal.
CREATE FUNCTION public.account_merge_fields()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT ARRAY['name', 'trade_name', 'website', 'phone', 'street', 'city', 'state', 'postal_code', 'industry', 'employees', 'states_of_operation', 'current_provider', 'owner_id']
$$;

REVOKE ALL ON FUNCTION public.account_merge_fields() FROM PUBLIC, anon, authenticated, service_role;

-- An account's own fields with its owner, as the merge's answers give them. Internal.
CREATE FUNCTION public.crm_account_with_owner(a public.accounts)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.crm_account_fields(a) || jsonb_build_object(
    'owner', CASE WHEN a.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', a.owner_id, 'name', public.crm_person_name(a.owner_id)) END)
$$;

REVOKE ALL ON FUNCTION public.crm_account_with_owner(public.accounts) FROM PUBLIC, anon, authenticated, service_role;

-- What a merge of these two moves, counted: {contacts, opportunities, quotes, calls, notes, tasks, labels (those the kept account lacks), history}. Internal.
CREATE FUNCTION public.account_merge_counts(p_keep_id uuid, p_remove_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'contacts', (SELECT count(*) FROM public.contacts c WHERE c.account_id = p_remove_id),
    'opportunities', (SELECT count(*) FROM public.opportunities o WHERE o.account_id = p_remove_id),
    'quotes', (SELECT count(*) FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE o.account_id = p_remove_id),
    'calls', (SELECT count(*) FROM public.activities t WHERE t.account_id = p_remove_id AND t.kind = 'call'),
    'notes', (SELECT count(*) FROM public.activities t WHERE t.account_id = p_remove_id AND t.kind = 'note'),
    'tasks', (SELECT count(*) FROM public.activities t WHERE t.account_id = p_remove_id AND t.kind = 'task'),
    'labels', (SELECT count(*) FROM public.account_labels l WHERE l.account_id = p_remove_id
               AND NOT EXISTS (SELECT 1 FROM public.account_labels k WHERE k.account_id = p_keep_id AND k.label_id = l.label_id)),
    'history', (SELECT count(*) FROM public.record_history h WHERE h.table_name = 'accounts' AND h.record_key = p_remove_id::text))
$$;

REVOKE ALL ON FUNCTION public.account_merge_counts(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 8. Merging two accounts: what it will do ----------
-- {keep, remove, fields, moves}: both accounts as the page gives them (with their versions, to send back), the fields that differ ([{field, keep, remove}]; the
-- owner as {id, name} or null) and what will move (account_merge_counts). Changes nothing and locks nothing. Refused as the merge is, in the same order, except
-- what only the merge itself can find out (a version that moved, a race).
CREATE FUNCTION public.merge_accounts_preview(p_firm_id uuid, p_keep_id uuid, p_remove_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  k public.accounts;
  r public.accounts;
  kj jsonb;
  rj jsonb;
  diff jsonb;
  pair record;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO pair FROM public.account_merge_pair(firm, p_keep_id, p_remove_id, false);
  k := pair.kept_row;
  r := pair.gone_row;
  kj := to_jsonb(k) || jsonb_build_object('owner_id', CASE WHEN k.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', k.owner_id, 'name', public.crm_person_name(k.owner_id)) END);
  rj := to_jsonb(r) || jsonb_build_object('owner_id', CASE WHEN r.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', r.owner_id, 'name', public.crm_person_name(r.owner_id)) END);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('field', f.field, 'keep', kj -> f.field, 'remove', rj -> f.field) ORDER BY f.n), '[]'::jsonb) INTO diff
  FROM unnest(public.account_merge_fields()) WITH ORDINALITY AS f (field, n)
  WHERE (kj -> f.field) IS DISTINCT FROM (rj -> f.field);
  RETURN jsonb_build_object('keep', public.crm_account_with_owner(k), 'remove', public.crm_account_with_owner(r), 'fields', diff,
    'moves', public.account_merge_counts(k.id, r.id));
END;
$$;

REVOKE ALL ON FUNCTION public.merge_accounts_preview(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_accounts_preview(uuid, uuid, uuid) TO authenticated;

-- ---------- 9. Merging two accounts ----------
-- Answers {record: <the account kept, with its owner>, merged_from: {id, name}, moved: <counts>}. p_take names the fields taken from the removed account
-- (account_merge_fields); every other field stays as the kept account has it. The two versions are those the preview gave: a merge cannot be undone, so one
-- that does not say what it started from is refused (22023), and one started from a version since changed is refused (PT409) and nothing is lost to a
-- colleague's edit made in between. Refused, in this order: not a member of the firm (42501), a closing firm and Nevermore support (PT423), what was not
-- said (22023), the rules of account_merge_pair, a field that is not one (22023), a version that moved (PT409), an owner taken that is none or no longer a
-- current member (22023).
CREATE FUNCTION public.merge_accounts(
  p_firm_id uuid, p_keep_id uuid, p_remove_id uuid, p_take text[] DEFAULT '{}', p_keep_version integer DEFAULT NULL, p_remove_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  who uuid := auth.uid();
  k public.accounts;
  r public.accounts;
  done public.accounts;
  take text[] := COALESCE(p_take, '{}');
  counts jsonb;
  held_activities uuid[];
  held_contacts uuid[];
  held_opportunities uuid[];
  kept_main boolean;
  pair record;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_keep_version IS NULL OR p_remove_version IS NULL THEN
    RAISE EXCEPTION 'This merge did not say which versions of the accounts it started from, so it was refused. Reload and try again.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO pair FROM public.account_merge_pair(firm, p_keep_id, p_remove_id, true);
  k := pair.kept_row;
  r := pair.gone_row;
  IF EXISTS (SELECT 1 FROM unnest(take) t WHERE t <> ALL (public.account_merge_fields())) THEN
    RAISE EXCEPTION 'Choose only fields an account has.' USING ERRCODE = '22023';
  END IF;
  IF k.version <> p_keep_version OR r.version <> p_remove_version THEN
    RAISE EXCEPTION 'One of these accounts was changed after you looked at it. Look again, then merge.' USING ERRCODE = 'PT409';
  END IF;
  IF 'owner_id' = ANY (take) THEN
    IF r.owner_id IS NULL THEN
      RAISE EXCEPTION '% has no owner to take. Keep the owner of %.', r.name, k.name USING ERRCODE = '22023';
    END IF;
    IF NOT public.crm_is_current_member(firm, r.owner_id) THEN
      RAISE EXCEPTION 'The owner of % is no longer in the firm. Keep the owner of %.', r.name, k.name USING ERRCODE = '22023';
    END IF;
    PERFORM public.member_to_own(firm, r.owner_id);
  END IF;
  counts := public.account_merge_counts(k.id, r.id);

  -- The old address first: the move of the calls, notes and tasks below and the history's are allowed by it. A record merged into the removed account
  -- now leads to the account kept.
  INSERT INTO public.merged_records (kind, from_id, firm_id, into_account_id, from_name, merged_by) VALUES ('account', r.id, firm, k.id, r.name, who);
  UPDATE public.merged_records m SET into_account_id = k.id WHERE m.kind = 'account' AND m.into_account_id = r.id;

  -- What is attached, held: calls, notes and tasks, then contacts, then opportunities (head of this file).
  SELECT COALESCE(array_agg(x.id ORDER BY x.id), '{}') INTO held_activities FROM (SELECT a.id FROM public.activities a WHERE a.account_id = r.id ORDER BY a.id FOR UPDATE) x;
  SELECT COALESCE(array_agg(x.id ORDER BY x.id), '{}') INTO held_contacts FROM (SELECT c.id FROM public.contacts c WHERE c.account_id = r.id ORDER BY c.id FOR UPDATE) x;
  SELECT COALESCE(array_agg(x.id ORDER BY x.id), '{}') INTO held_opportunities FROM (SELECT o.id FROM public.opportunities o WHERE o.account_id = r.id ORDER BY o.id FOR UPDATE) x;

  -- The fields the person took. A change is one history entry per field, under the person.
  UPDATE public.accounts SET
    name = CASE WHEN 'name' = ANY (take) THEN r.name ELSE name END,
    trade_name = CASE WHEN 'trade_name' = ANY (take) THEN r.trade_name ELSE trade_name END,
    website = CASE WHEN 'website' = ANY (take) THEN r.website ELSE website END,
    phone = CASE WHEN 'phone' = ANY (take) THEN r.phone ELSE phone END,
    street = CASE WHEN 'street' = ANY (take) THEN r.street ELSE street END,
    city = CASE WHEN 'city' = ANY (take) THEN r.city ELSE city END,
    state = CASE WHEN 'state' = ANY (take) THEN r.state ELSE state END,
    postal_code = CASE WHEN 'postal_code' = ANY (take) THEN r.postal_code ELSE postal_code END,
    industry = CASE WHEN 'industry' = ANY (take) THEN r.industry ELSE industry END,
    employees = CASE WHEN 'employees' = ANY (take) THEN r.employees ELSE employees END,
    states_of_operation = CASE WHEN 'states_of_operation' = ANY (take) THEN r.states_of_operation ELSE states_of_operation END,
    current_provider = CASE WHEN 'current_provider' = ANY (take) THEN r.current_provider ELSE current_provider END,
    owner_id = CASE WHEN 'owner_id' = ANY (take) THEN r.owner_id ELSE owner_id END
  WHERE id = k.id;

  -- Accounts that were marked a possible duplicate of the removed one are now marked a possible duplicate of the kept one; the kept account is not a
  -- possible duplicate of the account it has just absorbed. (A mark the removed account itself carried goes with it.)
  UPDATE public.accounts SET possible_duplicate_of = k.id WHERE firm_id = firm AND possible_duplicate_of = r.id AND id <> k.id;
  UPDATE public.accounts SET possible_duplicate_of = NULL WHERE id = k.id AND possible_duplicate_of = r.id;

  -- The moves. The keys that join an activity or an opportunity to a contact, and an activity to an opportunity, are looked at once, at the end of the moves.
  SET CONSTRAINTS activities_contact_fkey, activities_opportunity_fkey, opportunities_main_contact_fkey DEFERRED;
  kept_main := EXISTS (SELECT 1 FROM public.contacts c WHERE c.account_id = k.id AND c.is_main);
  -- A main contact stays the main contact only where the kept account has none; a prospect already a contact of the kept account is not twice one.
  UPDATE public.contacts c SET account_id = k.id, is_main = c.is_main AND NOT kept_main,
    prospect_user_id = CASE WHEN c.prospect_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.contacts x WHERE x.account_id = k.id AND x.prospect_user_id = c.prospect_user_id)
                            THEN NULL ELSE c.prospect_user_id END
  WHERE c.id = ANY (held_contacts);
  UPDATE public.opportunities SET account_id = k.id WHERE id = ANY (held_opportunities);
  UPDATE public.activities SET account_id = k.id WHERE id = ANY (held_activities);
  SET CONSTRAINTS activities_contact_fkey, activities_opportunity_fkey, opportunities_main_contact_fkey IMMEDIATE;

  -- Labels: a union. The kept account's own rows stay as they are.
  INSERT INTO public.account_labels (firm_id, account_id, label_id, added_by, added_at)
  SELECT firm, k.id, l.label_id, l.added_by, l.added_at FROM public.account_labels l
  WHERE l.account_id = r.id AND NOT EXISTS (SELECT 1 FROM public.account_labels x WHERE x.account_id = k.id AND x.label_id = l.label_id)
  ORDER BY l.label_id;

  -- History: the removed account's entries to the kept one, marked; then the merge itself.
  PERFORM public.record_history_move(firm, 'accounts', r.id::text, k.id::text, r.name);
  SELECT * INTO done FROM public.accounts x WHERE x.id = k.id;
  INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, field, old_value, new_value, actor_id, actor_is_staff, version, merged_from_key, merged_from_name)
  VALUES (firm, 'accounts', k.id::text, gen_random_uuid(), 'changed', 'merged', NULL, to_jsonb(r.name), who, public.firm_actor_is_staff(who, firm), done.version, r.id::text, r.name);

  -- The removed account has nothing left on it.
  DELETE FROM public.accounts WHERE id = r.id;
  RETURN jsonb_build_object('record', public.crm_account_with_owner(done), 'merged_from', jsonb_build_object('id', r.id, 'name', r.name), 'moved', counts);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_accounts(uuid, uuid, uuid, text[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_accounts(uuid, uuid, uuid, text[], integer, integer) TO authenticated;

-- ---------- 10. Two contacts of one account ----------
-- The two contacts, held when p_lock, and their account. Refused, in this order: two not chosen or the same (22023), either not there or its account not seen
-- (PT404), not of the same account (22023, D-210), the account archived (55000), either contact not changeable by the level rule (42501, in words). With
-- p_lock: the account FOR SHARE (it conflicts with archiving and with a merge of the account), then both contacts FOR UPDATE in id order; a contact that
-- moved while this waited is refused (40001).
CREATE FUNCTION public.contact_merge_pair(p_firm_id uuid, p_keep_id uuid, p_remove_id uuid, p_lock boolean, OUT kept_row public.contacts, OUT gone_row public.contacts, OUT account_row public.accounts)
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ka uuid;
  ra uuid;
BEGIN
  IF p_keep_id IS NULL OR p_remove_id IS NULL THEN
    RAISE EXCEPTION 'Choose two contacts to merge.' USING ERRCODE = '22023';
  END IF;
  IF p_keep_id = p_remove_id THEN
    RAISE EXCEPTION 'Choose two different contacts to merge.' USING ERRCODE = '22023';
  END IF;
  SELECT c.account_id INTO ka FROM public.contacts c WHERE c.id = p_keep_id AND c.firm_id = p_firm_id;
  SELECT c.account_id INTO ra FROM public.contacts c WHERE c.id = p_remove_id AND c.firm_id = p_firm_id;
  IF ka IS NULL OR ra IS NULL THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF p_lock THEN
    PERFORM 1 FROM public.accounts x WHERE x.id = ka AND x.firm_id = p_firm_id FOR SHARE;
  END IF;
  SELECT * INTO account_row FROM public.accounts x WHERE x.id = ka AND x.firm_id = p_firm_id;
  IF account_row.id IS NULL OR NOT public.can_see_firm_record(account_row.firm_id, account_row.owner_id) THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF ka <> ra THEN
    IF NOT EXISTS (SELECT 1 FROM public.accounts x WHERE x.id = ra AND x.firm_id = p_firm_id AND public.can_see_firm_record(x.firm_id, x.owner_id)) THEN
      RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
    END IF;
    RAISE EXCEPTION 'Only two contacts of the same account can be merged. Move one of them to the other''s account first.' USING ERRCODE = '22023';
  END IF;
  IF p_lock THEN
    PERFORM 1 FROM public.contacts c WHERE c.id IN (p_keep_id, p_remove_id) AND c.firm_id = p_firm_id ORDER BY c.id FOR UPDATE;
  END IF;
  SELECT * INTO kept_row FROM public.contacts c WHERE c.id = p_keep_id AND c.firm_id = p_firm_id;
  SELECT * INTO gone_row FROM public.contacts c WHERE c.id = p_remove_id AND c.firm_id = p_firm_id;
  IF kept_row.id IS NULL OR gone_row.id IS NULL THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF kept_row.account_id <> ka OR gone_row.account_id <> ka THEN
    RAISE EXCEPTION 'A contact was moved while you were working. Try again.' USING ERRCODE = '40001';
  END IF;
  IF account_row.archived_at IS NOT NULL THEN
    RAISE EXCEPTION '% is archived. Restore it to merge its contacts.', account_row.name USING ERRCODE = '55000';
  END IF;
  IF NOT public.can_change_firm_record(kept_row.firm_id, kept_row.owner_id) THEN
    RAISE EXCEPTION 'You can''t merge these contacts, because you can''t change %. %', public.crm_contact_name(kept_row),
      CASE WHEN kept_row.owner_id IS NULL THEN 'A contact with no owner can only be changed by an owner of the firm.'
        ELSE 'Only the contact''s owner, a lead of the owner''s team or an owner of the firm can change it.' END USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_change_firm_record(gone_row.firm_id, gone_row.owner_id) THEN
    RAISE EXCEPTION 'You can''t merge these contacts, because you can''t change %. %', public.crm_contact_name(gone_row),
      CASE WHEN gone_row.owner_id IS NULL THEN 'A contact with no owner can only be changed by an owner of the firm.'
        ELSE 'Only the contact''s owner, a lead of the owner''s team or an owner of the firm can change it.' END USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.contact_merge_pair(uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.contact_merge_fields()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT ARRAY['first_name', 'last_name', 'title', 'email', 'phone', 'mobile', 'owner_id']
$$;

REVOKE ALL ON FUNCTION public.contact_merge_fields() FROM PUBLIC, anon, authenticated, service_role;

-- {contacts: the two as the account's tab gives them, fields, moves: {activities, opportunities (those that name the contact removed as their main contact)}}.
CREATE FUNCTION public.merge_contacts_preview(p_firm_id uuid, p_keep_id uuid, p_remove_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  k public.contacts;
  r public.contacts;
  a public.accounts;
  kj jsonb;
  rj jsonb;
  diff jsonb;
  pair record;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO pair FROM public.contact_merge_pair(firm, p_keep_id, p_remove_id, false);
  k := pair.kept_row;
  r := pair.gone_row;
  a := pair.account_row;
  kj := to_jsonb(k) || jsonb_build_object('owner_id', CASE WHEN k.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', k.owner_id, 'name', public.crm_person_name(k.owner_id)) END);
  rj := to_jsonb(r) || jsonb_build_object('owner_id', CASE WHEN r.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', r.owner_id, 'name', public.crm_person_name(r.owner_id)) END);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('field', f.field, 'keep', kj -> f.field, 'remove', rj -> f.field) ORDER BY f.n), '[]'::jsonb) INTO diff
  FROM unnest(public.contact_merge_fields()) WITH ORDINALITY AS f (field, n)
  WHERE (kj -> f.field) IS DISTINCT FROM (rj -> f.field);
  RETURN jsonb_build_object(
    'account', jsonb_build_object('id', a.id, 'name', a.name),
    'keep', public.crm_contact_fields(k), 'remove', public.crm_contact_fields(r), 'fields', diff,
    'moves', jsonb_build_object(
      'activities', (SELECT count(*) FROM public.activities t WHERE t.contact_id = r.id),
      'opportunities', (SELECT count(*) FROM public.opportunities o WHERE o.main_contact_id = r.id),
      'history', (SELECT count(*) FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = r.id::text)),
    'do_not_email', k.do_not_email OR r.do_not_email,
    'main', k.is_main OR r.is_main);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_contacts_preview(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_contacts_preview(uuid, uuid, uuid) TO authenticated;

-- Answers {record, merged_from: {id, name}, moved: {activities, opportunities}}. Refused as merge_accounts is (the same codes, in the same order), with the
-- fields of a contact; a contact left with no email, no phone and no mobile, or a value that fails the contact's rule, is refused in words (22023).
CREATE FUNCTION public.merge_contacts(
  p_firm_id uuid, p_keep_id uuid, p_remove_id uuid, p_take text[] DEFAULT '{}', p_keep_version integer DEFAULT NULL, p_remove_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  who uuid := auth.uid();
  k public.contacts;
  r public.contacts;
  a public.accounts;
  done public.contacts;
  take text[] := COALESCE(p_take, '{}');
  res public.contacts;
  problem text;
  held_activities uuid[];
  n_activities integer;
  n_opportunities integer;
  pair record;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_keep_version IS NULL OR p_remove_version IS NULL THEN
    RAISE EXCEPTION 'This merge did not say which versions of the contacts it started from, so it was refused. Reload and try again.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO pair FROM public.contact_merge_pair(firm, p_keep_id, p_remove_id, true);
  k := pair.kept_row;
  r := pair.gone_row;
  a := pair.account_row;
  IF EXISTS (SELECT 1 FROM unnest(take) t WHERE t <> ALL (public.contact_merge_fields())) THEN
    RAISE EXCEPTION 'Choose only fields a contact has.' USING ERRCODE = '22023';
  END IF;
  IF k.version <> p_keep_version OR r.version <> p_remove_version THEN
    RAISE EXCEPTION 'One of these contacts was changed after you looked at it. Look again, then merge.' USING ERRCODE = 'PT409';
  END IF;
  IF 'owner_id' = ANY (take) THEN
    IF r.owner_id IS NULL THEN
      RAISE EXCEPTION '% has no owner to take. Keep the owner of %.', public.crm_contact_name(r), public.crm_contact_name(k) USING ERRCODE = '22023';
    END IF;
    IF NOT public.crm_is_current_member(firm, r.owner_id) THEN
      RAISE EXCEPTION 'The owner of % is no longer in the firm. Keep the owner of %.', public.crm_contact_name(r), public.crm_contact_name(k) USING ERRCODE = '22023';
    END IF;
    PERFORM public.member_to_own(firm, r.owner_id);
  END IF;
  -- What the contact kept will hold, and the contact's own rules asked of what is new (an old phone that fails today's rule may stay, as for any other save).
  res := k;
  IF 'first_name' = ANY (take) THEN res.first_name := r.first_name; END IF;
  IF 'last_name' = ANY (take) THEN res.last_name := r.last_name; END IF;
  IF 'title' = ANY (take) THEN res.title := r.title; END IF;
  IF 'email' = ANY (take) THEN res.email := r.email; END IF;
  IF 'phone' = ANY (take) THEN res.phone := r.phone; END IF;
  IF 'mobile' = ANY (take) THEN res.mobile := r.mobile; END IF;
  problem := public.contact_input_error(res.first_name, res.last_name, res.title,
    CASE WHEN res.email IS DISTINCT FROM k.email THEN res.email END, CASE WHEN res.phone IS DISTINCT FROM k.phone THEN res.phone END,
    CASE WHEN res.mobile IS DISTINCT FROM k.mobile THEN res.mobile END);
  IF problem = 'Enter an email or a phone number.' AND (res.email IS NOT NULL OR res.phone IS NOT NULL OR res.mobile IS NOT NULL) THEN
    problem := NULL;
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.merged_records (kind, from_id, firm_id, into_contact_id, from_name, merged_by) VALUES ('contact', r.id, firm, k.id, public.crm_contact_name(r), who);
  UPDATE public.merged_records m SET into_contact_id = k.id WHERE m.kind = 'contact' AND m.into_contact_id = r.id;

  -- The removed contact's calls, notes and tasks, held (as move_contact holds a moved contact's), and the opportunities it was the main contact of.
  SELECT COALESCE(array_agg(x.id ORDER BY x.id), '{}') INTO held_activities FROM (SELECT t.id FROM public.activities t WHERE t.contact_id = r.id ORDER BY t.id FOR UPDATE) x;
  PERFORM 1 FROM public.opportunities o WHERE o.main_contact_id = r.id ORDER BY o.id FOR NO KEY UPDATE;
  UPDATE public.opportunities SET main_contact_id = k.id WHERE main_contact_id = r.id;
  GET DIAGNOSTICS n_opportunities = ROW_COUNT;
  UPDATE public.activities SET contact_id = k.id WHERE id = ANY (held_activities);
  n_activities := cardinality(held_activities);

  PERFORM public.record_history_move(firm, 'contacts', r.id::text, k.id::text, public.crm_contact_name(r));
  DELETE FROM public.contacts WHERE id = r.id;
  -- The contact kept, with what was picked. The main place, a request not to be emailed and the prospect link are never lost.
  UPDATE public.contacts SET
    first_name = res.first_name, last_name = res.last_name, title = res.title, email = res.email, phone = res.phone, mobile = res.mobile,
    owner_id = CASE WHEN 'owner_id' = ANY (take) THEN r.owner_id ELSE owner_id END,
    is_main = k.is_main OR r.is_main, do_not_email = k.do_not_email OR r.do_not_email, prospect_user_id = COALESCE(k.prospect_user_id, r.prospect_user_id)
  WHERE id = k.id RETURNING * INTO done;
  INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, field, old_value, new_value, actor_id, actor_is_staff, version, merged_from_key, merged_from_name)
  VALUES (firm, 'contacts', k.id::text, gen_random_uuid(), 'changed', 'merged', NULL, to_jsonb(public.crm_contact_name(r)), who, public.firm_actor_is_staff(who, firm), done.version,
          r.id::text, public.crm_contact_name(r));
  RETURN jsonb_build_object('record', public.crm_contact_fields(done), 'merged_from', jsonb_build_object('id', r.id, 'name', public.crm_contact_name(r)),
    'moved', jsonb_build_object('activities', n_activities, 'opportunities', n_opportunities));
END;
$$;

REVOKE ALL ON FUNCTION public.merge_contacts(uuid, uuid, uuid, text[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_contacts(uuid, uuid, uuid, text[], integer, integer) TO authenticated;

-- ---------- 11. Keep separate ----------
-- Clears an account's possible-duplicate mark. Whoever may change that account (the level rule, with its words), not archived or not: a field of an archived
-- account can be edited. Answers {changed, record}; an account with no mark changes nothing.
CREATE FUNCTION public.keep_accounts_separate(p_firm_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.accounts;
  done public.accounts;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  cur := public.account_to_change(firm, p_account_id, 'no_key');
  IF cur.possible_duplicate_of IS NULL THEN
    RETURN jsonb_build_object('changed', false, 'record', public.crm_account_with_owner(cur));
  END IF;
  UPDATE public.accounts SET possible_duplicate_of = NULL WHERE id = cur.id RETURNING * INTO done;
  RETURN jsonb_build_object('changed', true, 'record', public.crm_account_with_owner(done));
END;
$$;

REVOKE ALL ON FUNCTION public.keep_accounts_separate(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.keep_accounts_separate(uuid, uuid) TO authenticated;

-- ---------- 12. The possible-duplicate banner ----------
-- NULL for an account the caller may not see, one that is not there and one with no mark (the same answer for each). Otherwise {other: {id, name, archived} or
-- null when the caller may not see the other account, can_merge, can_keep_separate}: may the caller merge the two (see both, change both, the firm writable)
-- and may they clear the mark (change this account, the firm writable).
CREATE FUNCTION public.account_duplicate_mark(p_firm_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  a public.accounts;
  o public.accounts;
  writable boolean := true;
  sees boolean;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) OR a.possible_duplicate_of IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    PERFORM public.assert_firm_writable(firm);
  EXCEPTION WHEN SQLSTATE 'PT423' THEN
    writable := false;
  END;
  SELECT * INTO o FROM public.accounts x WHERE x.id = a.possible_duplicate_of AND x.firm_id = firm;
  sees := o.id IS NOT NULL AND public.can_see_firm_record(o.firm_id, o.owner_id);
  RETURN jsonb_build_object(
    'other', CASE WHEN sees THEN jsonb_build_object('id', o.id, 'name', o.name, 'archived', o.archived_at IS NOT NULL) END,
    'can_merge', writable AND sees AND public.can_change_firm_record(a.firm_id, a.owner_id) AND public.can_change_firm_record(o.firm_id, o.owner_id),
    'can_keep_separate', writable AND public.can_change_firm_record(a.firm_id, a.owner_id));
END;
$$;

REVOKE ALL ON FUNCTION public.account_duplicate_mark(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_duplicate_mark(uuid, uuid) TO authenticated;

-- ---------- 13. The old address ----------
-- Follows an id to the record it is, or became. p_kind is 'account' or 'contact'. Answers {merged, kind, id, account_id, name, from_name, merged_at}: `id` is the
-- record to open (a contact's is on `account_id`); `merged` is true when the id asked was merged away (and then from_name is what it was called and
-- merged_at when). Any current member of the firm the call acts for may follow one, and a Nevermore support session (a read): a person who may see the record
-- kept. PT404, the one answer, for an id of another firm, one never made, a record the caller may not see and a pointer to one.
CREATE FUNCTION public.follow_merged_record(p_firm_id uuid, p_kind text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  m public.merged_records;
  a public.accounts;
  c public.contacts;
  merged boolean := false;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF p_kind IS NULL OR p_kind NOT IN ('account', 'contact') OR p_id IS NULL THEN
    RAISE EXCEPTION 'Name an account or a contact' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'account' THEN
    SELECT * INTO a FROM public.accounts x WHERE x.id = p_id AND x.firm_id = firm;
    IF a.id IS NULL THEN
      SELECT * INTO m FROM public.merged_records x WHERE x.kind = 'account' AND x.from_id = p_id AND x.firm_id = firm;
      IF m.from_id IS NULL THEN
        RAISE EXCEPTION 'That record isn''t available' USING ERRCODE = 'PT404';
      END IF;
      merged := true;
      SELECT * INTO a FROM public.accounts x WHERE x.id = m.into_account_id AND x.firm_id = firm;
    END IF;
    IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
      RAISE EXCEPTION 'That record isn''t available' USING ERRCODE = 'PT404';
    END IF;
    RETURN jsonb_build_object('merged', merged, 'kind', 'account', 'id', a.id, 'account_id', a.id, 'name', a.name, 'from_name', m.from_name, 'merged_at', m.merged_at);
  END IF;
  SELECT * INTO c FROM public.contacts x WHERE x.id = p_id AND x.firm_id = firm;
  IF c.id IS NULL THEN
    SELECT * INTO m FROM public.merged_records x WHERE x.kind = 'contact' AND x.from_id = p_id AND x.firm_id = firm;
    IF m.from_id IS NULL THEN
      RAISE EXCEPTION 'That record isn''t available' USING ERRCODE = 'PT404';
    END IF;
    merged := true;
    SELECT * INTO c FROM public.contacts x WHERE x.id = m.into_contact_id AND x.firm_id = firm;
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = c.account_id AND x.firm_id = firm;
  IF c.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That record isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('merged', merged, 'kind', 'contact', 'id', c.id, 'account_id', c.account_id, 'name', public.crm_contact_name(c), 'from_name', m.from_name, 'merged_at', m.merged_at);
END;
$$;

REVOKE ALL ON FUNCTION public.follow_merged_record(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_merged_record(uuid, text, uuid) TO authenticated;

-- ---------- 14. Closing a firm deletes the pointers ----------
-- 20261119210000's list, restated with every line it had and one more: the old addresses, before the accounts and contacts they lead to.
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
    (54, 'public.merged_records', 'delete', 'firm_id', 'the old addresses of merged records, which lead to the accounts and contacts kept; before the records they lead to'),
    (55, 'public.record_history', 'delete', 'firm_id', 'the history of each record: who created it and every change to its fields; it goes with the record'),
    (56, 'public.bulk_change_records', 'delete', 'firm_id', 'what each bulk change did to each record, kept for ten minutes'' undo'),
    (57, 'public.bulk_changes', 'delete', 'firm_id', 'bulk changes, kept for ten minutes'' undo'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (58, 'public.activities', 'delete', 'firm_id', 'calls, notes and tasks on the firm''s accounts and contacts; before the opportunities, contacts and accounts they stand on'),
    (59, 'public.account_labels', 'delete', 'firm_id', 'the labels on the firm''s accounts; before the accounts they stand on'),
    (61, 'public.opportunities', 'delete', 'firm_id', 'opportunities (each is one search for one account); before the contacts and accounts they stand on'),
    (62, 'public.contacts', 'delete', 'firm_id', 'contacts, the people at the firm''s accounts'),
    (63, 'public.accounts', 'delete', 'firm_id', 'accounts, the businesses the firm quotes for; the intakes on their opportunities stay with their employers (below)'),
    (64, 'public.labels', 'delete', 'firm_id', 'the firm''s own list of labels; after the accounts that carried them'),
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


