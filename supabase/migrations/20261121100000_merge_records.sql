-- Merging in the database (story CRM-S4.3b; docs/BROKER_CRM_BUILD.md D-24, D-28, D-45, D-46, D-105, D-193, D-194, D-203, D-209, D-210, D-222, D-226, D-233, D-238,
-- D-446 to D-454, D-640 to D-652; docs/BROKER_CRM_STORIES.md CRM-S4.3; GLOSSARY.md "Merging"; ADR 0023, ADR 0024, ADR 0025; 20261119100000_crm_records.sql,
-- 20261119110000_chain_at_certification.sql, 20261119170000_add_contact.sql, 20261119180000_calls_notes_tasks.sql, 20261119210000_bulk_changes.sql,
-- 20261119230000_search_everywhere.sql, 20261120110000_placements_renewals.sql).
--
-- What this is. The three writes of "Merging" and what the screen (CRM-S4.3a) needs to show them, all in the database:
--
--   merge_accounts       Two accounts of the firm become one. The kept account takes everything that stood on the removed one: its contacts, its opportunities (each keeps
--                        its intake, and so its quotes), its calls, notes and tasks, its labels, its placements and renewals, and its history; then the removed account is
--                        deleted (D-203). The person picks, for each field that differs, which value the kept account keeps.
--   merge_contacts       Two contacts of ONE account become one (D-210): the kept contact takes the removed one's calls, notes and tasks, the opportunities it was main
--                        contact of, and its history. Contacts on two accounts are moved first (move_contact) or their accounts merged.
--   account_keep_separate "Keep separate": the possible-duplicate mark (D-193) is cleared on an account that carries it. Nothing is merged and nothing else changes.
--   merge_preview        What the screen shows before the choice: both records' fields and versions, the fields that differ, what would move, and whether the caller may
--                        merge them (and if not, why, in words).
--   resolve_merged_record The old address of a removed record leads to the kept one (D-203): the kept record's kind, id and name, for someone who may see it.
--
-- Who and when. Every write asks, in the order every write of the firm's records does, firm_to_act_for (a member of the firm the call acts for: 42501),
-- assert_firm_writable (a closing firm and a Nevermore support session are refused, PT423), then the records (the one refusal, PT404, for one that is not there or not
-- theirs). Merging two accounts is for whoever may change BOTH (D-203, the level rule of D-209: can_change_firm_record); two contacts, both. The kept account must not
-- be archived (nothing can be added to it, D-222, 55000); the removed one may be. A save names the version of each record the person chose from (D-46): either one
-- having changed since refuses the merge (40001), so a choice is never made on values that are no longer there.
--
-- What is kept, and where it goes.
--   * The removed record's HISTORY is copied to the kept one with each entry marked as from the merged record (record_history.merged_from_key / merged_from_name), at
--     its own time and by its own actor; the kept record gets one "merged" entry of its own. The removed record's own history is then deleted with it, as the history of any
--     deleted record is (D-45). Every record that moved (a contact, an opportunity) has its own one change in its own history, made by the table's trigger: its account.
--   * The removed record's ADDRESS is kept: merged_records says what it was merged into, by kind and id, so its old link resolves to the kept record (resolve_merged_record),
--     also when the kept record is itself merged later (the chain is followed).
--   * Recent records (20261119230000): a person's recently opened removed record becomes the kept one in their list (or goes, when the kept one is already there).
--   * The possible-duplicate mark (D-193): an account marked a duplicate of the removed one is now marked a duplicate of the kept one; the kept account's mark that named the
--     removed one is cleared; a kept account with no mark takes the removed one's.
--   * Two contacts of the two accounts that are the same prospect (D-194: one contact per prospect user per account) are merged into one, the kept account's contact winning
--     and taking what the other has and it lacks (D-641). Nothing else is merged by guesswork: two contacts with the same email stay two.
--
-- Not here: the screens (CRM-S4.3a), merging leads (CRM-L1.x), custom fields (CRM-X3.1), emails and files that name a contact or an account (Epic 6: they will follow as the
-- calls do). No "unmerge" (D-203).

SET lock_timeout = '5s';

-- ---------- 1. The history can say "from the merged record" ----------
ALTER TABLE public.record_history ADD COLUMN merged_from_key text;
ALTER TABLE public.record_history ADD COLUMN merged_from_name text;
ALTER TABLE public.record_history ADD CONSTRAINT record_history_merged_from_both
  CHECK ((merged_from_key IS NULL) = (merged_from_name IS NULL) AND (merged_from_key IS NULL OR char_length(merged_from_key) <= 200));

ALTER TABLE public.record_history DROP CONSTRAINT record_history_kind_check;
ALTER TABLE public.record_history ADD CONSTRAINT record_history_kind_check CHECK (kind IN ('created', 'changed', 'merged'));
ALTER TABLE public.record_history DROP CONSTRAINT record_history_shape;
ALTER TABLE public.record_history ADD CONSTRAINT record_history_shape CHECK (
  (kind = 'created' AND field IS NULL AND old_value IS NULL AND new_value IS NULL)
  OR (kind = 'changed' AND field ~ '^[a-z][a-z0-9_]{0,62}$')
  OR (kind = 'merged' AND field IS NULL AND old_value IS NULL AND new_value IS NULL AND merged_from_key IS NOT NULL));

-- The page of a record's history, now with where an entry came from: the removed record's name when it was copied in by a merge, and for the "merged" entry itself.
-- Restated whole (20261120090000 is the last to have restated it) with one more column; the same grant.
DROP FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid);
CREATE FUNCTION public.record_history_list(
  p_firm_id uuid, p_table text, p_key text, p_limit integer DEFAULT 50, p_after_at timestamptz DEFAULT NULL, p_after_key uuid DEFAULT NULL)
RETURNS TABLE (
  entry_key uuid, at timestamptz, change_id uuid, kind text, who text, who_kind text, field text, from_value jsonb, to_value jsonb, cause text, cause_peo text, merged_from text)
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
    WITH e AS (
      SELECT h.entry_key AS e_key, h.at AS e_at, h.change_id AS e_change, h.kind AS e_kind,
             public.record_history_who(h.actor_id, h.actor_is_staff) AS e_who,
             CASE WHEN h.actor_is_staff THEN 'nevermore' WHEN h.actor_id IS NULL THEN 'system' ELSE 'member' END AS e_who_kind,
             h.field AS e_field, h.old_value AS e_old, h.new_value AS e_new, NULL::text AS e_cause, NULL::text AS e_peo, h.merged_from_name AS e_merged
      FROM public.record_history h
      WHERE h.firm_id = p_firm_id AND h.table_name = t AND h.record_key = p_key
      UNION ALL
      SELECT md5('submission_status_history:' || s.id)::uuid, s.changed_at, md5('submission_status_history:' || s.id)::uuid, 'stage_changed',
             public.record_history_who(s.changed_by, s.actor_is_staff),
             CASE WHEN s.actor_is_staff THEN 'nevermore' WHEN s.changed_by IS NULL THEN 'system' ELSE 'member' END,
             'stage', to_jsonb(s.stage_before), to_jsonb(s.stage_after), s.cause,
             (SELECT q.peo_name FROM public.quote_requests q WHERE q.id = s.cause_quote_request_id AND q.session_id = s.session_id),
             NULL::text
      FROM (
        SELECT h.id, h.session_id, h.changed_at, h.changed_by, h.actor_is_staff, h.cause, h.cause_quote_request_id,
               CASE WHEN h.from_status = 'archived' THEN
                      CASE WHEN (SELECT x.from_status FROM public.submission_status_history x
                                 WHERE x.session_id = h.session_id AND x.to_status = 'archived' AND x.from_status IS DISTINCT FROM 'archived' AND x.id < h.id
                                 ORDER BY x.id DESC LIMIT 1) = 'won' THEN 'won' ELSE 'lost' END
                    ELSE public.opportunity_stage_of(h.from_status) END AS stage_before,
               CASE WHEN h.to_status = 'archived' THEN CASE WHEN h.from_status = 'won' THEN 'won' ELSE 'lost' END
                    ELSE public.opportunity_stage_of(h.to_status) END AS stage_after
        FROM public.opportunities o
        JOIN public.submission_status_history h ON h.session_id = o.intake_id
        WHERE t = 'opportunities' AND o.firm_id = p_firm_id AND o.id = public.record_history_key_uuid(p_key)
          AND h.from_status IS NOT NULL AND h.from_status IS DISTINCT FROM h.to_status
      ) s
      WHERE s.stage_before IS DISTINCT FROM s.stage_after
    )
    SELECT e.e_key, e.e_at, e.e_change, e.e_kind, e.e_who, e.e_who_kind, e.e_field, e.e_old, e.e_new, e.e_cause, e.e_peo, e.e_merged
    FROM e
    WHERE (p_after_at IS NULL OR (e.e_at, e.e_key) < (p_after_at, p_after_key))
    ORDER BY e.e_at DESC, e.e_key DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_history_list(uuid, text, text, integer, timestamptz, uuid) TO authenticated;

-- ---------- 2. Where a removed record went ----------
CREATE TABLE public.merged_records (
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  kind text NOT NULL CONSTRAINT merged_records_kind_check CHECK (kind IN ('account', 'contact')),
  removed_id uuid NOT NULL,
  kept_id uuid NOT NULL,
  removed_name text NOT NULL CONSTRAINT merged_records_name_check CHECK (btrim(removed_name) <> '' AND char_length(removed_name) <= 300),
  merged_at timestamptz NOT NULL DEFAULT now(),
  merged_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT merged_records_pkey PRIMARY KEY (firm_id, kind, removed_id),
  CONSTRAINT merged_records_not_itself CHECK (removed_id <> kept_id)
);
CREATE INDEX merged_records_kept_idx ON public.merged_records (firm_id, kind, kept_id);

-- Closed to the API, as the bulk changes' tables are: a person reaches it through resolve_merged_record only. The service role reads.
ALTER TABLE public.merged_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merged_records FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.merged_records TO service_role;
COMMENT ON TABLE public.merged_records IS 'Where a merged-away account or contact went: the kept record''s id, so the removed one''s old address leads to it (D-203). Closed to the API roles; resolve_merged_record reads.';

-- Closing a firm deletes it, with the firm's other working data.
CREATE OR REPLACE FUNCTION public.firm_closing_plan()
 RETURNS TABLE(ord integer, src text, action text, firm_column text, why text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT * FROM (VALUES
    -- Deleted: the firm's own working data.
    (10, 'public.firm_invitations', 'delete', 'firm_id', 'pending and past invitations to join'),
    (20, 'public.firm_organisations', 'delete', 'firm_id', 'the listed Google domains and Microsoft tenants'),
    (30, 'public.join_requests', 'delete', 'firm_id', 'requests to join'),
    (40, 'public.table_preferences', 'delete', 'firm_id', 'each person''s column choices'),
    (50, 'public.saved_views', 'delete', 'firm_id', 'saved views'),
    (55, 'public.record_history', 'delete', 'firm_id', 'the history of each record: who created it and every change to its fields; it goes with the record'),
    (56, 'public.recent_records', 'delete', 'firm_id', 'each person''s last opened records, for the search box'),
    (56, 'public.bulk_change_records', 'delete', 'firm_id', 'what each bulk change did to each record, kept for ten minutes'' undo'),
    (57, 'public.bulk_changes', 'delete', 'firm_id', 'bulk changes, kept for ten minutes'' undo'),
    (57, 'public.merged_records', 'delete', 'firm_id', 'where each merged-away account or contact went, so its old address led to the kept one'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (58, 'public.activities', 'delete', 'firm_id', 'calls, notes and tasks on the firm''s accounts and contacts; before the opportunities, contacts and accounts they stand on'),
    (59, 'public.account_labels', 'delete', 'firm_id', 'the labels on the firm''s accounts; before the accounts they stand on'),
    (56, 'public.renewals', 'delete', 'firm_id', 'renewals (the dates an account''s cover comes up); before the placements they come from and the opportunities working them'),
    (57, 'public.placements', 'delete', 'firm_id', 'placements (what the firm placed for its accounts); before the opportunities and accounts they stand on'),
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

-- ---------- 3. The keys a merge changes at the end, not in the middle ----------
-- A merge moves an opportunity, its placement, its renewals and the contacts they name from one account to another in several statements. These keys name the
-- account and the row together, so between the statements they would not hold; made deferrable (still checked at the end of every statement unless a function
-- defers them, as move_contact defers the other two) they are checked once, before the merge returns. Nothing else about them changes.
ALTER TABLE public.placements ALTER CONSTRAINT placements_opportunity_fkey DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.renewals ALTER CONSTRAINT renewals_opportunity_fkey DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.renewals ALTER CONSTRAINT renewals_placement_fkey DEFERRABLE INITIALLY IMMEDIATE;

-- A call, note or task moves to another account only with its contact or its opportunity, which have already moved (20261119180000). A merge also moves the ones that
-- name neither (a note on the account itself): while a merge of exactly that pair of accounts runs, they may. The setting is made by merge_accounts for its own
-- transaction (as the history's own clean-up and a firm's closing are, 20261118130000), then cleared. Otherwise as 20261119180000 left it.
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
  -- the row still names: a different contact or opportunity of the new account in its place is not following. Or by a merge of its account into the new one.
  IF NEW.account_id IS DISTINCT FROM OLD.account_id AND NOT (
       (NEW.contact_id IS NOT NULL AND NEW.contact_id IS NOT DISTINCT FROM OLD.contact_id AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = NEW.contact_id AND c.firm_id = NEW.firm_id AND c.account_id = NEW.account_id))
    OR (NEW.opportunity_id IS NOT NULL AND NEW.opportunity_id IS NOT DISTINCT FROM OLD.opportunity_id AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.id = NEW.opportunity_id AND o.firm_id = NEW.firm_id AND o.account_id = NEW.account_id))
    OR COALESCE(current_setting('nevermore.merging_accounts', true), '') = OLD.account_id::text || '>' || NEW.account_id::text) THEN
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

REVOKE ALL ON FUNCTION public.activities_guard() FROM PUBLIC, anon, authenticated;

-- ---------- 4. Helpers (internal: no API role runs them) ----------

-- Whether a choice is for the removed record's value. p_choices maps a field to 'kept' or 'removed'; a field not named keeps the kept record's value, or takes the
-- removed one's when the kept one is blank (D-640). Pure.
CREATE FUNCTION public.crm_merge_takes_removed(p_choices jsonb, p_field text, p_kept_is_blank boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_choices ->> p_field WHEN 'removed' THEN true WHEN 'kept' THEN false ELSE COALESCE(p_kept_is_blank, false) END
$$;

REVOKE ALL ON FUNCTION public.crm_merge_takes_removed(jsonb, text, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- What is wrong with a person's choices, in words, or NULL: an object of field names (from p_allowed) to "kept" or "removed". Pure.
CREATE FUNCTION public.crm_merge_choices_error(p_choices jsonb, p_allowed text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_choices IS NULL THEN NULL
    WHEN jsonb_typeof(p_choices) <> 'object' THEN 'Choices are a list of fields, each kept or removed.'
    WHEN EXISTS (SELECT 1 FROM jsonb_object_keys(p_choices) k WHERE k <> ALL (p_allowed)) THEN 'Choose only among the fields that can differ.'
    WHEN EXISTS (SELECT 1 FROM jsonb_each(p_choices) e WHERE e.value NOT IN ('"kept"'::jsonb, '"removed"'::jsonb)) THEN 'Each field keeps the value of the kept record or of the removed one.'
  END
$$;

REVOKE ALL ON FUNCTION public.crm_merge_choices_error(jsonb, text[]) FROM PUBLIC, anon, authenticated, service_role;

-- Copies a removed record's history to the kept one, each entry marked as from the removed record (an entry already copied by an earlier merge keeps its first mark),
-- at its own time and by its own actor, and with NO version: a version is the kept record's own count of saves, and `record_version_changes` (the conflict dialog's "what
-- changed") picks entries by version, so a copy that kept the removed record's number would be reported as a change the kept record never had (D-643); then the kept record's own "merged" entry, now. Called before the removed record is deleted (the deletion clears its history).
CREATE FUNCTION public.crm_merge_history(p_firm_id uuid, p_table text, p_kept_key text, p_removed_key text, p_removed_name text, p_kept_version integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t public.record_history_table := public.record_history_table_named(p_table);
  who uuid := auth.uid();
BEGIN
  INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, field, old_value, new_value, at, actor_id, actor_is_staff, version, merged_from_key, merged_from_name)
  SELECT h.firm_id, h.table_name, p_kept_key, h.change_id, h.kind, h.field, h.old_value, h.new_value, h.at, h.actor_id, h.actor_is_staff, NULL,
         COALESCE(h.merged_from_key, p_removed_key), COALESCE(h.merged_from_name, p_removed_name)
  FROM public.record_history h
  WHERE h.firm_id = p_firm_id AND h.table_name = t AND h.record_key = p_removed_key AND h.kind <> 'merged';
  -- The removed record's own "merged" entries (it had absorbed others) stay with what it absorbed, as copies marked with those names: copied with their own marks.
  INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, field, old_value, new_value, at, actor_id, actor_is_staff, version, merged_from_key, merged_from_name)
  SELECT h.firm_id, h.table_name, p_kept_key, h.change_id, h.kind, h.field, h.old_value, h.new_value, h.at, h.actor_id, h.actor_is_staff, NULL, h.merged_from_key, h.merged_from_name
  FROM public.record_history h
  WHERE h.firm_id = p_firm_id AND h.table_name = t AND h.record_key = p_removed_key AND h.kind = 'merged';
  INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, actor_id, actor_is_staff, version, merged_from_key, merged_from_name)
  VALUES (p_firm_id, t, p_kept_key, gen_random_uuid(), 'merged', who, public.firm_actor_is_staff(who, p_firm_id), p_kept_version, p_removed_key, p_removed_name);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_merge_history(uuid, text, text, text, text, integer) FROM PUBLIC, anon, authenticated, service_role;

-- The removed record's recent-record rows lead to the kept record, for every person; where a person already has the kept record in their list, the removed one's row goes.
CREATE FUNCTION public.crm_merge_recent(p_firm_id uuid, p_kind text, p_kept_id uuid, p_removed_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.recent_records x
  WHERE x.firm_id = p_firm_id AND x.kind = p_kind AND x.record_id = p_removed_id::text
    AND EXISTS (SELECT 1 FROM public.recent_records y WHERE y.firm_id = x.firm_id AND y.user_id = x.user_id AND y.kind = p_kind AND y.record_id = p_kept_id::text);
  UPDATE public.recent_records SET record_id = p_kept_id::text
  WHERE firm_id = p_firm_id AND kind = p_kind AND record_id = p_removed_id::text;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_merge_recent(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Everything one contact leaves behind when it is merged into another of the same account, and its deletion: its calls, notes and tasks, the opportunities it is the main
-- contact of, its recent-record rows, its history (copied), its address (kept). The two are on one account (the caller has checked). With p_fill, what the kept contact
-- lacks it takes from the removed one (a person who was two contacts of the same prospect, D-641), and is main if the removed one was and the account has no other main. Internal.
CREATE FUNCTION public.crm_absorb_contact(p_kept_id uuid, p_removed_id uuid, p_fill boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  k public.contacts;
  r public.contacts;
  acts integer;
  opps integer;
  who uuid := auth.uid();
BEGIN
  SELECT * INTO k FROM public.contacts WHERE id = p_kept_id;
  SELECT * INTO r FROM public.contacts WHERE id = p_removed_id;
  -- Calls, notes and tasks follow the contact (a link of the same account, so the key holds at once).
  UPDATE public.activities SET contact_id = k.id WHERE contact_id = r.id;
  GET DIAGNOSTICS acts = ROW_COUNT;
  UPDATE public.opportunities SET main_contact_id = k.id WHERE main_contact_id = r.id;
  GET DIAGNOSTICS opps = ROW_COUNT;
  PERFORM public.crm_merge_recent(k.firm_id, 'contact', k.id, r.id);
  -- Its address leads to the kept contact (what was merged into it earlier is followed through it: resolve_merged_record walks the chain).
  INSERT INTO public.merged_records (firm_id, kind, removed_id, kept_id, removed_name, merged_by)
  VALUES (k.firm_id, 'contact', r.id, k.id, public.crm_contact_name(r), who);
  PERFORM public.crm_merge_history(k.firm_id, 'contacts', k.id::text, r.id::text, public.crm_contact_name(r), k.version);
  DELETE FROM public.contacts WHERE id = r.id;
  IF p_fill THEN
    UPDATE public.contacts SET
      first_name = COALESCE(k.first_name, r.first_name), title = COALESCE(k.title, r.title), email = COALESCE(k.email, r.email),
      phone = COALESCE(k.phone, r.phone), mobile = COALESCE(k.mobile, r.mobile), do_not_email = k.do_not_email OR r.do_not_email,
      is_main = k.is_main OR (r.is_main AND NOT EXISTS (SELECT 1 FROM public.contacts m WHERE m.account_id = k.account_id AND m.is_main))
    WHERE id = k.id;
  END IF;
  RETURN jsonb_build_object('activities_moved', acts, 'opportunities_repointed', opps);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_absorb_contact(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 5. Why two records cannot be merged by this caller, in words ----------
-- NULL when they can. The rules a merge and its preview share. Internal; the records are already seen by the caller.
CREATE FUNCTION public.crm_merge_accounts_problem(k public.accounts, r public.accounts)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN k.id = r.id THEN 'Choose two different accounts to merge.'
    WHEN NOT public.can_change_firm_record(k.firm_id, k.owner_id) THEN 'You can''t change ' || k.name || ', so you can''t merge it.'
    WHEN NOT public.can_change_firm_record(r.firm_id, r.owner_id) THEN 'You can''t change ' || r.name || ', so you can''t merge it.'
    WHEN k.archived_at IS NOT NULL THEN 'The account to keep is archived. Nothing can be added to it. Restore it, or keep the other one.'
  END
$$;

REVOKE ALL ON FUNCTION public.crm_merge_accounts_problem(public.accounts, public.accounts) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.crm_merge_contacts_problem(k public.contacts, r public.contacts)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN k.id = r.id THEN 'Choose two different contacts to merge.'
    WHEN k.account_id <> r.account_id THEN 'Only two contacts on the same account can be merged. Move one onto the other''s account first, or merge their accounts.'
    WHEN NOT public.can_change_firm_record(k.firm_id, k.owner_id) THEN
      CASE WHEN k.owner_id IS NULL THEN 'Only an owner of the firm can merge a contact that has no owner.'
        ELSE 'Only the contact''s owner, a lead of the owner''s team or an owner of the firm can merge ' || public.crm_contact_name(k) || '.' END
    WHEN NOT public.can_change_firm_record(r.firm_id, r.owner_id) THEN
      CASE WHEN r.owner_id IS NULL THEN 'Only an owner of the firm can merge a contact that has no owner.'
        ELSE 'Only the contact''s owner, a lead of the owner''s team or an owner of the firm can merge ' || public.crm_contact_name(r) || '.' END
  END
$$;

REVOKE ALL ON FUNCTION public.crm_merge_contacts_problem(public.contacts, public.contacts) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 6. The words a choice can be about ----------
-- Accounts: the fields update_account saves, and the owner. Contacts: the fields update_contact saves, and the owner.
-- (kept as literals in each function below, one list each; this comment is the index.)

-- ---------- 7. What the screen needs before the choice ----------
-- {kind, kept, removed, differs: [field...], moves: {...counts...}, problem: text | null}. `kept` and `removed` are the records' own fields as a save answers them
-- (with their versions, which the merge asks for back). `problem` says in words why the caller can't merge them, else null. The records must be seen by the caller
-- (PT404, the one refusal), and in the firm the call acts for (42501 for a stranger). A closing firm and a support session may look: nothing is written.
CREATE FUNCTION public.merge_preview(p_firm_id uuid, p_kind text, p_kept_id uuid, p_removed_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  ka public.accounts;
  ra public.accounts;
  kc public.contacts;
  rc public.contacts;
  differs text[];
  problem text;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF p_kind = 'account' THEN
    SELECT * INTO ka FROM public.accounts x WHERE x.id = p_kept_id AND x.firm_id = firm;
    SELECT * INTO ra FROM public.accounts x WHERE x.id = p_removed_id AND x.firm_id = firm;
    IF ka.id IS NULL OR ra.id IS NULL OR NOT public.can_see_firm_record(ka.firm_id, ka.owner_id) OR NOT public.can_see_firm_record(ra.firm_id, ra.owner_id) THEN
      RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
    END IF;
    problem := public.crm_merge_accounts_problem(ka, ra);
    SELECT COALESCE(array_agg(f ORDER BY n), '{}') INTO differs FROM (VALUES
      (1, 'name', ka.name IS DISTINCT FROM ra.name), (2, 'trade_name', ka.trade_name IS DISTINCT FROM ra.trade_name), (3, 'website', ka.website IS DISTINCT FROM ra.website),
      (4, 'phone', ka.phone IS DISTINCT FROM ra.phone), (5, 'street', ka.street IS DISTINCT FROM ra.street), (6, 'city', ka.city IS DISTINCT FROM ra.city),
      (7, 'state', ka.state IS DISTINCT FROM ra.state), (8, 'postal_code', ka.postal_code IS DISTINCT FROM ra.postal_code), (9, 'industry', ka.industry IS DISTINCT FROM ra.industry),
      (10, 'employees', ka.employees IS DISTINCT FROM ra.employees), (11, 'states_of_operation', ka.states_of_operation IS DISTINCT FROM ra.states_of_operation),
      (12, 'current_provider', ka.current_provider IS DISTINCT FROM ra.current_provider), (13, 'owner', ka.owner_id IS DISTINCT FROM ra.owner_id)) AS d (n, f, different) WHERE different;
    RETURN jsonb_build_object(
      'kind', 'account', 'problem', problem, 'differs', to_jsonb(differs),
      'kept', public.crm_account_fields(ka) || jsonb_build_object('owner', CASE WHEN ka.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', ka.owner_id, 'name', public.crm_person_name(ka.owner_id)) END),
      'removed', public.crm_account_fields(ra) || jsonb_build_object('owner', CASE WHEN ra.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', ra.owner_id, 'name', public.crm_person_name(ra.owner_id)) END),
      'moves', jsonb_build_object(
        'contacts', (SELECT count(*) FROM public.contacts c WHERE c.account_id = ra.id),
        'opportunities', (SELECT count(*) FROM public.opportunities o WHERE o.account_id = ra.id),
        'intakes', (SELECT count(*) FROM public.opportunities o WHERE o.account_id = ra.id AND o.intake_id IS NOT NULL),
        'activities', (SELECT count(*) FROM public.activities a WHERE a.account_id = ra.id),
        'placements', (SELECT count(*) FROM public.placements p WHERE p.account_id = ra.id),
        'renewals', (SELECT count(*) FROM public.renewals w WHERE w.account_id = ra.id),
        'labels', (SELECT count(*) FROM public.account_labels l WHERE l.account_id = ra.id AND NOT EXISTS (SELECT 1 FROM public.account_labels y WHERE y.account_id = ka.id AND y.label_id = l.label_id))));
  ELSIF p_kind = 'contact' THEN
    SELECT * INTO kc FROM public.contacts x WHERE x.id = p_kept_id AND x.firm_id = firm;
    SELECT * INTO rc FROM public.contacts x WHERE x.id = p_removed_id AND x.firm_id = firm;
    IF kc.id IS NULL OR rc.id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = kc.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id))
       OR NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = rc.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id)) THEN
      RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
    END IF;
    problem := public.crm_merge_contacts_problem(kc, rc);
    SELECT COALESCE(array_agg(f ORDER BY n), '{}') INTO differs FROM (VALUES
      (1, 'first_name', kc.first_name IS DISTINCT FROM rc.first_name), (2, 'last_name', kc.last_name IS DISTINCT FROM rc.last_name), (3, 'title', kc.title IS DISTINCT FROM rc.title),
      (4, 'email', kc.email IS DISTINCT FROM rc.email), (5, 'phone', kc.phone IS DISTINCT FROM rc.phone), (6, 'mobile', kc.mobile IS DISTINCT FROM rc.mobile),
      (7, 'do_not_email', kc.do_not_email IS DISTINCT FROM rc.do_not_email), (8, 'owner', kc.owner_id IS DISTINCT FROM rc.owner_id)) AS d (n, f, different) WHERE different;
    RETURN jsonb_build_object(
      'kind', 'contact', 'problem', problem, 'differs', to_jsonb(differs), 'kept', public.crm_contact_fields(kc), 'removed', public.crm_contact_fields(rc),
      'moves', jsonb_build_object(
        'activities', (SELECT count(*) FROM public.activities a WHERE a.contact_id = rc.id),
        'opportunities_main_contact_of', (SELECT count(*) FROM public.opportunities o WHERE o.main_contact_id = rc.id)));
  END IF;
  RAISE EXCEPTION 'Merge accounts or contacts.' USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public.merge_preview(uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_preview(uuid, text, uuid, uuid) TO authenticated;

-- ---------- 8. Merging two accounts ----------
-- Answers {record: <the kept account's fields>, removed: {id, name}, moved: {contacts, contacts_merged, opportunities, activities, placements, renewals, labels}}.
-- p_choices: {"phone": "removed", ...} among name, trade_name, website, phone, street, city, state, postal_code, industry, employees, states_of_operation,
-- current_provider and owner; a field not named keeps the kept account's value, or takes the removed one's when the kept one is blank (D-640); the owner is the kept
-- account's unless the removed one's is chosen.
-- Refused, in this order: not a member of the firm (42501), a closing firm or Nevermore support (PT423), either account the caller may not see or that is not there
-- (PT404), the same account twice or an account of the two the caller may not change (the level rule of D-209, 42501 in words) or the kept one archived (55000), choices
-- that make no sense or a value no account may hold (22023, in words), a version either account is no longer at (40001).
--
-- Locks, in the order every writer of these records takes them (an account FOR SHARE or KEY SHARE first, then its contacts, then their activities): both accounts FOR UPDATE,
-- lowest id first (so a merge of A into B and one of B into A order themselves, and add_contact and move_contact on either account are waited for and seen; a
-- certification's chain that matched either account waits too, through the lock the chain step takes on the account it matches, section 12), then the contacts, opportunities, calls/notes/tasks, placements and renewals of the two, each in id order.
CREATE FUNCTION public.merge_accounts(
  p_kept_id uuid, p_removed_id uuid, p_choices jsonb DEFAULT '{}'::jsonb, p_kept_version integer DEFAULT NULL, p_removed_version integer DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  k public.accounts;
  r public.accounts;
  said text;
  ch jsonb := COALESCE(p_choices, '{}'::jsonb);
  v_name text;
  v_trade text;
  v_website text;
  v_phone text;
  v_street text;
  v_city text;
  v_state text;
  v_postal text;
  v_industry text;
  v_employees integer;
  v_states text[];
  v_provider text;
  v_owner uuid;
  v_dup uuid;
  rc public.contacts;
  kc public.contacts;
  n_contacts integer := 0;
  n_merged integer := 0;
  n_opps integer;
  n_acts integer;
  n_placements integer;
  n_renewals integer;
  n_labels integer;
  has_main boolean;
  done public.accounts;
  who uuid := auth.uid();
  names_before jsonb;
  names_after jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  PERFORM 1 FROM public.accounts x WHERE x.firm_id = firm AND x.id IN (p_kept_id, p_removed_id) ORDER BY x.id FOR UPDATE;
  SELECT * INTO k FROM public.accounts x WHERE x.id = p_kept_id AND x.firm_id = firm;
  SELECT * INTO r FROM public.accounts x WHERE x.id = p_removed_id AND x.firm_id = firm;
  IF k.id IS NULL OR r.id IS NULL OR NOT public.can_see_firm_record(k.firm_id, k.owner_id) OR NOT public.can_see_firm_record(r.firm_id, r.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  said := public.crm_merge_accounts_problem(k, r);
  IF said IS NOT NULL THEN
    RAISE EXCEPTION '%', said USING ERRCODE = CASE WHEN k.id = r.id THEN '22023' WHEN k.archived_at IS NOT NULL AND public.can_change_firm_record(k.firm_id, k.owner_id) AND public.can_change_firm_record(r.firm_id, r.owner_id) THEN '55000' ELSE '42501' END;
  END IF;
  said := public.crm_merge_choices_error(ch, ARRAY['name', 'trade_name', 'website', 'phone', 'street', 'city', 'state', 'postal_code', 'industry', 'employees', 'states_of_operation', 'current_provider', 'owner']);
  IF said IS NOT NULL THEN
    RAISE EXCEPTION '%', said USING ERRCODE = '22023';
  END IF;
  IF p_kept_version IS NULL OR p_removed_version IS NULL THEN
    RAISE EXCEPTION 'This merge did not say which version of each account it started from, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  IF p_kept_version <> k.version OR p_removed_version <> r.version THEN
    RAISE EXCEPTION 'One of these accounts was changed while you were choosing. Reload the page and choose again.' USING ERRCODE = '40001';
  END IF;

  v_name := CASE WHEN public.crm_merge_takes_removed(ch, 'name', false) THEN r.name ELSE k.name END;
  v_trade := CASE WHEN public.crm_merge_takes_removed(ch, 'trade_name', k.trade_name IS NULL) THEN r.trade_name ELSE k.trade_name END;
  v_website := CASE WHEN public.crm_merge_takes_removed(ch, 'website', k.website IS NULL) THEN r.website ELSE k.website END;
  v_phone := CASE WHEN public.crm_merge_takes_removed(ch, 'phone', k.phone IS NULL) THEN r.phone ELSE k.phone END;
  v_street := CASE WHEN public.crm_merge_takes_removed(ch, 'street', k.street IS NULL) THEN r.street ELSE k.street END;
  v_city := CASE WHEN public.crm_merge_takes_removed(ch, 'city', k.city IS NULL) THEN r.city ELSE k.city END;
  v_state := CASE WHEN public.crm_merge_takes_removed(ch, 'state', k.state IS NULL) THEN r.state ELSE k.state END;
  v_postal := CASE WHEN public.crm_merge_takes_removed(ch, 'postal_code', k.postal_code IS NULL) THEN r.postal_code ELSE k.postal_code END;
  v_industry := CASE WHEN public.crm_merge_takes_removed(ch, 'industry', k.industry IS NULL) THEN r.industry ELSE k.industry END;
  v_employees := CASE WHEN public.crm_merge_takes_removed(ch, 'employees', k.employees IS NULL) THEN r.employees ELSE k.employees END;
  v_states := CASE WHEN public.crm_merge_takes_removed(ch, 'states_of_operation', cardinality(k.states_of_operation) = 0) THEN r.states_of_operation ELSE k.states_of_operation END;
  v_provider := CASE WHEN public.crm_merge_takes_removed(ch, 'current_provider', k.current_provider IS NULL) THEN r.current_provider ELSE k.current_provider END;
  v_owner := CASE WHEN public.crm_merge_takes_removed(ch, 'owner', false) THEN r.owner_id ELSE k.owner_id END;
  said := public.account_input_error(v_name, v_trade, v_website, v_phone, v_street, v_city, v_state, v_postal, v_industry, v_employees, v_states, v_provider);
  IF said IS NOT NULL THEN
    RAISE EXCEPTION '%', said USING ERRCODE = '22023';
  END IF;
  -- A different owner is chosen as change_account_owner chooses one (20261119160000): someone, and a current member of the firm, whose membership is held FOR SHARE to
  -- the end of this transaction so that a removal either committed first or waits.
  IF v_owner IS DISTINCT FROM k.owner_id THEN
    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'Choose who will own this account.' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = v_owner AND public.membership_is_current(m.valid_from, m.valid_until) FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose a current member of the firm.' USING ERRCODE = '22023';
    END IF;
  END IF;
  v_dup := CASE WHEN k.possible_duplicate_of = r.id THEN NULL
                WHEN k.possible_duplicate_of IS NULL AND r.possible_duplicate_of IS DISTINCT FROM k.id THEN r.possible_duplicate_of
                ELSE k.possible_duplicate_of END;

  -- Everything that moves is held now, in an order no other writer reverses.
  PERFORM 1 FROM public.contacts x WHERE x.account_id IN (k.id, r.id) ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.opportunities x WHERE x.account_id IN (k.id, r.id) ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.activities x WHERE x.account_id IN (k.id, r.id) ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.placements x WHERE x.account_id IN (k.id, r.id) ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.renewals x WHERE x.account_id IN (k.id, r.id) ORDER BY x.id FOR UPDATE;

  -- Between the statements the keys that name an account and a row together are not looked at; they are looked at, once, before this function returns.
  SET CONSTRAINTS public.activities_contact_fkey, public.activities_opportunity_fkey, public.opportunities_main_contact_fkey,
    public.placements_opportunity_fkey, public.renewals_opportunity_fkey, public.renewals_placement_fkey DEFERRED;
  PERFORM set_config('nevermore.merging_accounts', r.id::text || '>' || k.id::text, true);

  -- Contacts. Two that are the same prospect (D-194) become one, the kept account's winning; the rest move, and the removed account's main contact is main only if the
  -- kept account has none.
  FOR rc IN SELECT * FROM public.contacts x WHERE x.account_id = r.id AND x.prospect_user_id IS NOT NULL ORDER BY x.id LOOP
    SELECT * INTO kc FROM public.contacts x WHERE x.account_id = k.id AND x.prospect_user_id = rc.prospect_user_id;
    IF kc.id IS NOT NULL THEN
      PERFORM public.crm_absorb_contact(kc.id, rc.id, true);
      n_merged := n_merged + 1;
    END IF;
  END LOOP;
  SELECT EXISTS (SELECT 1 FROM public.contacts x WHERE x.account_id = k.id AND x.is_main) INTO has_main;
  UPDATE public.contacts SET account_id = k.id, is_main = (is_main AND NOT has_main) WHERE account_id = r.id;
  GET DIAGNOSTICS n_contacts = ROW_COUNT;

  UPDATE public.opportunities SET account_id = k.id WHERE account_id = r.id;
  GET DIAGNOSTICS n_opps = ROW_COUNT;
  UPDATE public.activities SET account_id = k.id WHERE account_id = r.id;
  GET DIAGNOSTICS n_acts = ROW_COUNT;
  UPDATE public.placements SET account_id = k.id WHERE account_id = r.id;
  GET DIAGNOSTICS n_placements = ROW_COUNT;
  UPDATE public.renewals SET account_id = k.id WHERE account_id = r.id;
  GET DIAGNOSTICS n_renewals = ROW_COUNT;
  PERFORM set_config('nevermore.merging_accounts', '', true);

  -- Labels: the kept account takes the removed one's that it lacks; one history entry says so. The rest go with the removed account.
  names_before := public.account_label_names(k.id);
  UPDATE public.account_labels SET account_id = k.id
  WHERE account_id = r.id AND NOT EXISTS (SELECT 1 FROM public.account_labels y WHERE y.account_id = k.id AND y.label_id = account_labels.label_id);
  GET DIAGNOSTICS n_labels = ROW_COUNT;
  names_after := public.account_label_names(k.id);

  -- Accounts marked a possible duplicate of the removed one are now marked of the kept one.
  UPDATE public.accounts SET possible_duplicate_of = k.id WHERE firm_id = firm AND possible_duplicate_of = r.id AND id <> k.id;

  -- History, address and recent records, then the removed account goes. (Its history is copied first: deleting it clears its own.)
  PERFORM public.crm_merge_history(firm, 'accounts', k.id::text, r.id::text, r.name, k.version);
  INSERT INTO public.merged_records (firm_id, kind, removed_id, kept_id, removed_name, merged_by) VALUES (firm, 'account', r.id, k.id, r.name, who);
  PERFORM public.crm_merge_recent(firm, 'account', k.id, r.id);
  DELETE FROM public.accounts WHERE id = r.id;

  UPDATE public.accounts SET
    name = v_name, trade_name = v_trade, website = v_website, phone = v_phone, street = v_street, city = v_city, state = v_state, postal_code = v_postal,
    industry = v_industry, employees = v_employees, states_of_operation = v_states, current_provider = v_provider, owner_id = v_owner, possible_duplicate_of = v_dup
  WHERE id = k.id
  RETURNING * INTO done;
  IF n_labels > 0 AND names_before IS DISTINCT FROM names_after THEN
    INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, field, old_value, new_value, actor_id, actor_is_staff, version)
    VALUES (firm, 'accounts', k.id::text, gen_random_uuid(), 'changed', 'labels', names_before, names_after, who, public.firm_actor_is_staff(who, firm), done.version);
  END IF;

  SET CONSTRAINTS public.activities_contact_fkey, public.activities_opportunity_fkey, public.opportunities_main_contact_fkey,
    public.placements_opportunity_fkey, public.renewals_opportunity_fkey, public.renewals_placement_fkey IMMEDIATE;
  RETURN jsonb_build_object(
    'record', public.crm_account_fields(done),
    'removed', jsonb_build_object('id', r.id, 'name', r.name),
    'moved', jsonb_build_object(
      'contacts', n_contacts, 'contacts_merged', n_merged, 'opportunities', n_opps, 'activities', n_acts, 'placements', n_placements, 'renewals', n_renewals, 'labels', n_labels));
END;
$$;

REVOKE ALL ON FUNCTION public.merge_accounts(uuid, uuid, jsonb, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_accounts(uuid, uuid, jsonb, integer, integer, uuid) TO authenticated;

-- ---------- 9. Merging two contacts of one account ----------
-- Answers {record: <the kept contact's fields>, removed: {id, name}, moved: {activities, opportunities}}. p_choices among first_name, last_name, title, email, phone,
-- mobile, do_not_email and owner; as for accounts a field not named keeps the kept contact's value, or takes the removed one's when the kept one is blank; "do not email" is
-- on if either was on unless chosen (D-641). The kept contact is the main contact if either was, and keeps the removed one's prospect link when it has none.
-- Refused, in this order: not a member (42501), a closing firm or Nevermore support (PT423), a contact on an account the caller may not see or not there (PT404), two
-- contacts of two accounts (22023, in words, D-210), the level rule on each (42501), choices that make no sense or leave no email or phone (22023), a version either is no
-- longer at (40001). An archived account's contacts can be merged: nothing is added to it (D-222).
CREATE FUNCTION public.merge_contacts(
  p_kept_id uuid, p_removed_id uuid, p_choices jsonb DEFAULT '{}'::jsonb, p_kept_version integer DEFAULT NULL, p_removed_version integer DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  k public.contacts;
  r public.contacts;
  acct_a uuid;
  acct_b uuid;
  said text;
  ch jsonb := COALESCE(p_choices, '{}'::jsonb);
  v_first text;
  v_last text;
  v_title text;
  v_email text;
  v_phone text;
  v_mobile text;
  v_dne boolean;
  v_owner uuid;
  v_main boolean;
  v_prospect uuid;
  moved jsonb;
  done public.contacts;
  who uuid := auth.uid();
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT x.account_id INTO acct_a FROM public.contacts x WHERE x.id = p_kept_id AND x.firm_id = firm;
  SELECT x.account_id INTO acct_b FROM public.contacts x WHERE x.id = p_removed_id AND x.firm_id = firm;
  IF acct_a IS NULL OR acct_b IS NULL THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  -- The accounts first, FOR SHARE, lowest id first (archiving one is waited for; as move_contact does), then the contacts FOR UPDATE, lowest id first, then their calls,
  -- notes and tasks.
  PERFORM 1 FROM public.accounts x WHERE x.firm_id = firm AND x.id IN (acct_a, acct_b) ORDER BY x.id FOR SHARE;
  PERFORM 1 FROM public.contacts x WHERE x.firm_id = firm AND x.id IN (p_kept_id, p_removed_id) ORDER BY x.id FOR UPDATE;
  SELECT * INTO k FROM public.contacts x WHERE x.id = p_kept_id AND x.firm_id = firm;
  SELECT * INTO r FROM public.contacts x WHERE x.id = p_removed_id AND x.firm_id = firm;
  IF k.id IS NULL OR r.id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = k.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id))
     OR NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = r.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id)) THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF k.account_id <> acct_a OR r.account_id <> acct_b THEN
    RAISE EXCEPTION 'A contact was moved while you were working. Try again.' USING ERRCODE = '40001';
  END IF;
  said := public.crm_merge_contacts_problem(k, r);
  IF said IS NOT NULL THEN
    RAISE EXCEPTION '%', said USING ERRCODE = CASE WHEN k.id = r.id OR k.account_id <> r.account_id THEN '22023' ELSE '42501' END;
  END IF;
  said := public.crm_merge_choices_error(ch, ARRAY['first_name', 'last_name', 'title', 'email', 'phone', 'mobile', 'do_not_email', 'owner']);
  IF said IS NOT NULL THEN
    RAISE EXCEPTION '%', said USING ERRCODE = '22023';
  END IF;
  IF p_kept_version IS NULL OR p_removed_version IS NULL THEN
    RAISE EXCEPTION 'This merge did not say which version of each contact it started from, so it was refused. Reload the page and try again.' USING ERRCODE = '22023';
  END IF;
  IF p_kept_version <> k.version OR p_removed_version <> r.version THEN
    RAISE EXCEPTION 'One of these contacts was changed while you were choosing. Reload the page and choose again.' USING ERRCODE = '40001';
  END IF;
  -- Calls, notes and tasks of the two, and the opportunities that name either as main contact, are held in id order (their writers hold an account and then a contact).
  PERFORM 1 FROM public.activities x WHERE x.contact_id IN (k.id, r.id) ORDER BY x.id FOR UPDATE;
  PERFORM 1 FROM public.opportunities x WHERE x.main_contact_id IN (k.id, r.id) ORDER BY x.id FOR UPDATE;
  -- An opportunity whose main contact changes is that opportunity's record, which the level rule governs (D-209), as move_contact does.
  IF EXISTS (SELECT 1 FROM public.opportunities o WHERE o.main_contact_id = r.id AND NOT public.can_change_firm_record(o.firm_id, o.owner_id)) THEN
    RAISE EXCEPTION '% is the main contact of an opportunity you can''t change. Ask its owner, or an owner of the firm, to merge them.', public.crm_contact_name(r) USING ERRCODE = '42501';
  END IF;

  v_first := CASE WHEN public.crm_merge_takes_removed(ch, 'first_name', k.first_name IS NULL) THEN r.first_name ELSE k.first_name END;
  v_last := CASE WHEN public.crm_merge_takes_removed(ch, 'last_name', false) THEN r.last_name ELSE k.last_name END;
  v_title := CASE WHEN public.crm_merge_takes_removed(ch, 'title', k.title IS NULL) THEN r.title ELSE k.title END;
  v_email := CASE WHEN public.crm_merge_takes_removed(ch, 'email', k.email IS NULL) THEN r.email ELSE k.email END;
  v_phone := CASE WHEN public.crm_merge_takes_removed(ch, 'phone', k.phone IS NULL) THEN r.phone ELSE k.phone END;
  v_mobile := CASE WHEN public.crm_merge_takes_removed(ch, 'mobile', k.mobile IS NULL) THEN r.mobile ELSE k.mobile END;
  v_dne := CASE ch ->> 'do_not_email' WHEN 'removed' THEN r.do_not_email WHEN 'kept' THEN k.do_not_email ELSE k.do_not_email OR r.do_not_email END;
  v_owner := CASE WHEN public.crm_merge_takes_removed(ch, 'owner', false) THEN r.owner_id ELSE k.owner_id END;
  v_main := k.is_main OR r.is_main;
  v_prospect := COALESCE(k.prospect_user_id, r.prospect_user_id);
  said := public.contact_input_error(NULLIF(btrim(v_first), ''), NULLIF(btrim(v_last), ''), NULLIF(btrim(v_title), ''), NULLIF(btrim(v_email), ''), NULLIF(btrim(v_phone), ''), NULLIF(btrim(v_mobile), ''));
  IF said IS NOT NULL THEN
    RAISE EXCEPTION '%', said USING ERRCODE = '22023';
  END IF;
  -- As update_contact (20261119240000): a different owner is a current member of the firm, whose membership is held FOR SHARE until the end of the transaction.
  IF v_owner IS DISTINCT FROM k.owner_id THEN
    IF v_owner IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = v_owner AND public.membership_is_current(m.valid_from, m.valid_until) FOR SHARE) THEN
      RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- The removed contact goes first (it may be the account's main contact, and its prospect link is unique per account); the kept one then takes its place in each.
  moved := public.crm_absorb_contact(k.id, r.id, false);
  UPDATE public.contacts SET
    first_name = v_first, last_name = v_last, title = v_title, email = v_email, phone = v_phone, mobile = v_mobile, do_not_email = v_dne, owner_id = v_owner,
    is_main = v_main, prospect_user_id = v_prospect
  WHERE id = k.id
  RETURNING * INTO done;
  RETURN jsonb_build_object('record', public.crm_contact_fields(done), 'removed', jsonb_build_object('id', r.id, 'name', public.crm_contact_name(r)), 'moved', moved);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_contacts(uuid, uuid, jsonb, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_contacts(uuid, uuid, jsonb, integer, integer, uuid) TO authenticated;

-- ---------- 10. Keep separate ----------
-- Clears the possible-duplicate mark of an account that carries it (D-193). Whoever may change the account (D-209) may. The account's history shows the mark taken off, as any
-- change of that field. Answers {record, was_duplicate_of: {id, name} | null}. Refused: not a member (42501), a closing firm or support (PT423), an account the caller may not
-- see (PT404), the level rule (42501, in words), an account that carries no mark (22023). A mark whose other account is gone is already cleared by the database, so it reads
-- as no mark.
CREATE FUNCTION public.account_keep_separate(p_account_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.accounts;
  other public.accounts;
  done public.accounts;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  cur := public.account_to_change(firm, p_account_id, 'update');
  IF cur.possible_duplicate_of IS NULL THEN
    RAISE EXCEPTION 'This account isn''t marked as a possible duplicate.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO other FROM public.accounts x WHERE x.id = cur.possible_duplicate_of AND x.firm_id = firm;
  UPDATE public.accounts SET possible_duplicate_of = NULL WHERE id = cur.id RETURNING * INTO done;
  RETURN jsonb_build_object(
    'record', public.crm_account_fields(done),
    'was_duplicate_of', CASE WHEN other.id IS NULL OR NOT public.can_see_firm_record(other.firm_id, other.owner_id) THEN NULL
                             ELSE jsonb_build_object('id', other.id, 'name', other.name) END);
END;
$$;

REVOKE ALL ON FUNCTION public.account_keep_separate(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_keep_separate(uuid, uuid) TO authenticated;

-- ---------- 11. The old address ----------
-- {kind, id, name} of the record a merged-away account or contact became, following the chain when that one was merged too; NULL when p_id was never merged, when what
-- it became is gone, and when the caller may not see it (nobody learns that a record exists). Anyone who is a member of the firm the call acts for may ask: it answers only for a
-- record they may see. A support session reads as a member does.
CREATE FUNCTION public.resolve_merged_record(p_firm_id uuid, p_kind text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur uuid := p_id;
  nxt uuid;
  hops integer := 0;
  a public.accounts;
  c public.contacts;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF p_kind NOT IN ('account', 'contact') THEN
    RAISE EXCEPTION 'Ask about an account or a contact.' USING ERRCODE = '22023';
  END IF;
  LOOP
    SELECT m.kept_id INTO nxt FROM public.merged_records m WHERE m.firm_id = firm AND m.kind = p_kind AND m.removed_id = cur;
    EXIT WHEN nxt IS NULL OR hops >= 50;
    cur := nxt;
    hops := hops + 1;
  END LOOP;
  IF hops = 0 THEN
    RETURN NULL;
  END IF;
  IF p_kind = 'account' THEN
    SELECT * INTO a FROM public.accounts x WHERE x.id = cur AND x.firm_id = firm;
    IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
      RETURN NULL;
    END IF;
    RETURN jsonb_build_object('kind', 'account', 'id', a.id, 'name', a.name);
  END IF;
  SELECT x.* INTO c FROM public.contacts x JOIN public.accounts y ON y.id = x.account_id
  WHERE x.id = cur AND x.firm_id = firm AND public.can_see_firm_record(y.firm_id, y.owner_id);
  IF c.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('kind', 'contact', 'id', c.id, 'name', public.crm_contact_name(c), 'account_id', c.account_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_merged_record(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_merged_record(uuid, text, uuid) TO authenticated;

-- ---------- 12. The chain at certification waits for a merge ----------
-- The chain step (20261119110000, restated by 20261119120000) as it stands, with one change: after it matches an existing account (D-193) it holds that account FOR KEY
-- SHARE and looks again, following a merge to the account it became (D-644). Everything else is as it was; `v_hop` is the only new variable.
CREATE OR REPLACE FUNCTION public.make_intake_chain(p_intake_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  i public.chamber_sessions;
  v_hop integer;
  cert record;
  cert_data jsonb;
  cert_signer text;
  prof record;
  existing public.opportunities;
  d jsonb;
  v_name text;
  v_name_certified boolean;
  v_website text;
  v_domain text;
  v_state text;
  v_street text;
  v_industry text;
  v_employees integer;
  v_states text[];
  v_provider text;
  v_start text;
  v_email text;
  v_phone text;
  v_names text[];
  v_dup uuid;
  v_account uuid;
  v_contact uuid;
  v_opportunity uuid;
BEGIN
  SELECT * INTO i FROM public.chamber_sessions WHERE id = p_intake_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The intake does not exist' USING ERRCODE = 'P0002';
  END IF;

  -- The chain that is there (a cheap look first: every update of a certified intake asks).
  SELECT * INTO existing FROM public.opportunities WHERE intake_id = p_intake_id;
  IF FOUND THEN
    RETURN jsonb_build_object('made', false, 'account_id', existing.account_id, 'opportunity_id', existing.id);
  END IF;

  SELECT c.chamber_data, c.signer_name INTO cert
  FROM public.chamber_certifications c WHERE c.session_id = p_intake_id ORDER BY c.version DESC, c.id DESC LIMIT 1;
  IF FOUND THEN
    cert_data := cert.chamber_data;
    cert_signer := cert.signer_name;
  ELSIF public.intake_ever_certified(p_intake_id) THEN
    -- Submitted before certifications were recorded (CRM-Q1.3): there is no snapshot, so the values are the intake's own answers as they are now, and there
    -- is no signer's name to fall back on.
    cert_data := i.chamber_data;
  ELSE
    RAISE EXCEPTION 'The intake has never been certified, so it has no account, contact or opportunity' USING ERRCODE = '55000';
  END IF;
  d := cert_data;

  -- The prospect: the person who certified. Their profile's name and phone, their email (a signer's name when the profile has none).
  SELECT u.email::text AS email, p.contact_name, p.company_name, p.phone INTO prof
  FROM (SELECT 1) one LEFT JOIN auth.users u ON u.id = i.user_id LEFT JOIN public.profiles p ON p.user_id = i.user_id;

  -- The account's values, each as its column takes it. What a column would refuse is left out, never allowed to fail the certification.
  v_name := public.crm_answer_text(d, 'company_name', 200);
  v_name_certified := v_name IS NOT NULL;
  v_name := COALESCE(v_name, left(NULLIF(btrim(prof.company_name), ''), 200), 'Unnamed business');
  v_website := public.crm_answer_text(d, 'website', 300);
  v_domain := public.web_domain_of(v_website);
  v_state := CASE WHEN public.is_us_state_code(public.crm_answer_text(d, 'hq_state', 2)) THEN public.crm_answer_text(d, 'hq_state', 2) END;
  v_street := public.crm_answer_text(d, 'street_address', 200);
  v_industry := public.crm_answer_text(d, 'industry', 200);
  v_employees := CASE WHEN jsonb_typeof(d -> 'employee_count') = 'number' AND (d ->> 'employee_count') ~ '^[0-9]{1,9}$' THEN (d ->> 'employee_count')::integer END;
  v_states := CASE WHEN jsonb_typeof(d -> 'states') = 'array' THEN
    COALESCE((SELECT array_agg(s.state ORDER BY s.first_at)
              FROM (SELECT x.state, min(x.at) AS first_at
                    FROM (SELECT e.value #>> '{}' AS state, e.at FROM jsonb_array_elements(d -> 'states') WITH ORDINALITY AS e (value, at)
                          WHERE jsonb_typeof(e.value) = 'string') x
                    WHERE public.is_us_state_code(x.state) GROUP BY x.state) s), '{}') ELSE '{}' END;
  v_provider := CASE WHEN COALESCE((d ->> 'in_peo') <> 'false', true) THEN public.crm_answer_text(d, 'current_peo', 200) END;
  v_start := public.crm_answer_text(d, 'start_month', 100);

  -- The contact's values.
  v_email := CASE WHEN length(prof.email) <= 254 AND prof.email ~ '^[^@[:space:]]+@[^@[:space:]]+$' THEN prof.email END;
  v_phone := left(NULLIF(btrim(prof.phone), ''), 40);
  v_names := public.crm_split_person_name(COALESCE(NULLIF(btrim(prof.contact_name), ''), cert_signer));

  -- A closed firm holds no CRM records: closing deleted them and kept the intake, so a certification again must not bring the chain back. The firm's row is
  -- held FOR KEY SHARE first, which conflicts only with the closing's FOR UPDATE of that row (close_firm_now, D-122): a closing that is running is waited for,
  -- and the question is then asked of what it committed, so a chain is never written after the closing's delete pass. The employer's certification is not
  -- refused; it just has no chain. A firm that is closing and not yet closed still gets its chain, which its closing deletes with the rest. (This lock is
  -- taken before the firm's advisory lock below; the closing takes the row and no advisory lock, so the two cannot wait on each other.)
  PERFORM 1 FROM public.firms f WHERE f.id = i.firm_id FOR KEY SHARE;
  IF public.firm_is_closed(i.firm_id) THEN
    RETURN jsonb_build_object('made', false, 'closed', true);
  END IF;

  -- One chain at a time within a firm (see above), then the look again: another step may have made it while this one waited.
  PERFORM pg_advisory_xact_lock(hashtextextended('crm_chain:' || i.firm_id::text, 0));
  SELECT * INTO existing FROM public.opportunities WHERE intake_id = p_intake_id;
  IF FOUND THEN
    RETURN jsonb_build_object('made', false, 'account_id', existing.account_id, 'opportunity_id', existing.id);
  END IF;

  v_dup := public.find_duplicate_account(i.firm_id,
    v_domain,
    CASE WHEN v_name_certified THEN v_name END,
    v_state,
    v_email);

  -- The matched account is held FOR KEY SHARE before the new account names it (CRM-S4.3b). A merge holds both its accounts FOR UPDATE and then deletes the removed one: a
  -- chain that matched that one and went straight to its insert would find the account gone at the key check (23503) and fail the employer's certification. Holding
  -- it makes the chain wait for the merge, and then look again: an account merged away is followed through merged_records to the account it became (its own match,
  -- held the same way), and one that is simply gone is no match at all. The look again repeats if what it became was merged in turn.
  IF v_dup IS NOT NULL THEN
    FOR v_hop IN 1..50 LOOP
      PERFORM 1 FROM public.accounts x WHERE x.id = v_dup AND x.firm_id = i.firm_id FOR KEY SHARE;
      EXIT WHEN FOUND;
      SELECT m.kept_id INTO v_dup FROM public.merged_records m WHERE m.firm_id = i.firm_id AND m.kind = 'account' AND m.removed_id = v_dup;
      EXIT WHEN v_dup IS NULL;
    END LOOP;
  END IF;

  INSERT INTO public.accounts (firm_id, owner_id, name, website, street, state, industry, employees, states_of_operation, current_provider, source, possible_duplicate_of)
  VALUES (i.firm_id, NULL, v_name, v_website, v_street, v_state, v_industry, v_employees, v_states, v_provider, 'employer_intake', v_dup)
  RETURNING id INTO v_account;

  IF v_names IS NOT NULL AND (v_email IS NOT NULL OR v_phone IS NOT NULL) THEN
    INSERT INTO public.contacts (firm_id, account_id, owner_id, first_name, last_name, email, phone, is_main, prospect_user_id)
    VALUES (i.firm_id, v_account, NULL, v_names[1], v_names[2], v_email, v_phone, true, i.user_id)
    RETURNING id INTO v_contact;
  END IF;

  INSERT INTO public.opportunities (firm_id, account_id, owner_id, intake_id, name, main_contact_id)
  VALUES (i.firm_id, v_account, NULL, p_intake_id, CASE WHEN v_start IS NULL THEN 'PEO search' ELSE v_start || ' PEO search' END, v_contact)
  ON CONFLICT (intake_id) DO NOTHING
  RETURNING id INTO v_opportunity;
  IF v_opportunity IS NULL THEN
    RAISE EXCEPTION 'Another step made this intake''s opportunity first' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object('made', true, 'account_id', v_account, 'contact_id', v_contact, 'opportunity_id', v_opportunity, 'possible_duplicate_of', v_dup);
END;
$$;

REVOKE ALL ON FUNCTION public.make_intake_chain(uuid) FROM PUBLIC, anon, authenticated, service_role;

