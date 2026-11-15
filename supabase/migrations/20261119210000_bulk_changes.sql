-- Bulk changes in the database (story CRM-S3.7b; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-44, D-45, D-198, D-202, D-209, D-214, D-218, D-219, D-222;
-- ADR 0023, ADR 0024; 20261119130000_accounts_table_query.sql, 20261119160000_account_archive_delete_owner.sql).
--
-- What this is. Many accounts changed in one step, from the Accounts table's bulk bar (CRM-S3.7a puts it on screen, row 20). Five actions, each one of the
-- single changes CRM-A1.1c and CRM-A2.1a already make, asked the same questions:
--
--   owner         give the accounts to another current member, and when asked their open opportunities (change_account_owner's rules)
--   archive       set archived_at, and nothing else (archive_account)
--   field         set one optional standard field (never the name, which is required, and never what the product works out or sets: source, status, stage,
--                 last activity, the web domain, the possible-duplicate mark; custom fields are CRM-X3.1's). A blank value clears it.
--   label_add     put one of the firm's labels on the accounts, making the label when the firm has none of that name (D-198: made by typing one)
--   label_remove  take one label off
--
-- and "export the selection" is NOT built here: export_rows(firm, 'accounts', filters, ids) (CRM-S3.8b, D-218) already takes the same ids or the same
-- filters, so a second export would be a second place for the visibility rule. supabase/tests/bulk_changes.sql tests that it serves the bulk bar.
--
-- The selection (CRM-S3.6's contract). "Select all N that match" arrives as the table's own filters (with the search and the time zone, exactly as
-- export_source_accounts takes them) and NO ids; anything else arrives as ids. Exactly one of the two. The database recounts: the accounts the caller may see
-- that the filters match (the accounts query's own filter matching, never SQL built from what the browser sent, D-44), or the ids that are accounts of the
-- firm the caller may see. At most 1,000 (story CRM-S3.7); above that the preview says so and the change is refused (PT413) in words, with nothing done.
--
-- Two functions ask the same question, in the same code (bulk_account_outcome), so the dialog says exactly what the change will do:
--   bulk_accounts_preview  reads, locks nothing, changes nothing: how many accounts will change, how many already are as asked, and the accounts that will
--                          be SKIPPED, each named with its reason ("Only the account's owner, a lead ... can change it."; an archived account takes no label)
--   bulk_accounts_change   does it, and answers the same shape with what it did. ALL OR NONE: the accounts the person may change are all changed or, if
--                          anything fails, none (one transaction; one refusal rolls everything back). The accounts the level rule (D-209) does not give the
--                          person are the one thing left out, by the story's own words, counted and named, never an error.
--
-- The level rule is asked per account, once, by can_change_firm_record, with the words of the single change (account_change_words, restated into
-- account_to_change below so there is one copy). The new owner is held FOR SHARE by member_to_own, which change_account_owner now calls too (restated below:
-- the same rules and the same words). Open opportunities are handed over by give_open_opportunities, shared the same way.
--
-- Lock order. Every function that locks more than one thing takes them in this order and, inside each kind, by id:
--   1. accounts, FOR NO KEY UPDATE, in ONE statement ordered by id (the sort is under the row locks, so they are taken in id order)
--   2. the chosen owner's membership, FOR SHARE (member_to_own); for an undo, the previous owners' memberships ordered by their membership id
--   3. opportunities, FOR NO KEY UPDATE, ordered by id (give_open_opportunities)
--   4. the label, resolved again once the accounts are held (made when it is gone) and kept FOR KEY SHARE through the writes, so an undo that deletes a label
--      it made (FOR UPDATE, after ITS accounts) waits for this change or is waited for, and the label can't go between the lookup and the rows that name it
-- change_account_owner already took account, membership, opportunities, and a removal takes the membership and never an account (CRM-A1.1c's note),
-- so no two can wait on each other in a ring. Two bulk changes over overlapping accounts take the shared accounts in the same order: the second waits at its
-- first shared account for the whole of the first. supabase/tests/bulk_changes.sql proves it with two sessions over rows in opposite halves of each other.
-- An undo takes its change's row first (nothing else takes it while accounts are locked: a bulk change inserts its own new row and clears OLD rows only
-- with SKIP LOCKED), then 1 to 3 as above.
--
-- History. One entry per changed record, written by the history triggers that already watch the tracked fields (who, when, what from and what to, one
-- change_id per record per change). An account's labels are not a column, so account_labels has a trigger that writes ONE entry for the account, field
-- "labels", from the list of label names before to the list after. A change that leaves an account as it was (already owned by that person, already
-- archived, already carrying the label) writes nothing, is not counted as changed and is not in the undo.
--
-- Undo (D-202). Every change that changed something is kept, with each record's value before and what it was changed to, for ten minutes (made_at +
-- 10 minutes, `undo_until`; the page's own "until the person leaves it" is the page's) and, as a row, until the next bulk change of the firm clears those
-- older than a day. Only the person who made it undoes it, once (PT404 for anyone else, as for one that is not there; PT409 again; PT410 after ten
-- minutes). The undo puts back every record nobody has changed since, and SKIPS AND NAMES the rest (the story's and D-202's words): a record is "changed
-- since" when its field no longer holds what the change set it to (its owner, its archived stamp, the field's value, the label row the change made, or for a
-- removed label a row for that label there again). The level rule is NOT asked again by an undo: an agent who gave accounts away can no longer see or change
-- them, and the undo is theirs to make because they made the change and nobody has touched those records since. An owner is put back only while the
-- previous owner is still a current member (else the record is skipped, named, with that reason); a label is put back on an account only while it is not
-- archived (D-222), and a phone is put back only while it still passes the phone rule (else the record is skipped, named). A record deleted since takes its
-- rows with it (they stand on it by a foreign key, so none of its data is kept); the change keeps how many records it changed, and the undo says how many of
-- them are gone, as a count, never by name. A closing firm and a support session undo nothing (assert_firm_writable).
--
-- What is NOT here (D-24). Bulk restore, delete and merge (merge is CRM-S4.3b); the Label column and filter on the table are this migration's last section
-- (the accounts query has to know the word); renaming or deleting a label is Settings (Epic 9, D-198).

-- ---------- 1. Labels ----------
-- The firm's own list of words (D-198). Typed once, case-insensitively unique within a firm (the first spelling stays), any number on an account.
CREATE TABLE public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  name text NOT NULL CONSTRAINT labels_name_check CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 40 AND name !~ '[[:cntrl:]]' AND name !~ '\s\s'),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT labels_firm_id_id_key UNIQUE (firm_id, id)
);

CREATE UNIQUE INDEX labels_firm_name_key ON public.labels (firm_id, lower(name));

COMMENT ON TABLE public.labels IS 'A word in the firm''s own list of labels (glossary: Label). Made by typing it in a bulk change; written only by bulk_accounts_change and undone with it.';

CREATE TABLE public.account_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  account_id uuid NOT NULL,
  label_id uuid NOT NULL,
  added_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_labels_account_label_key UNIQUE (account_id, label_id),
  -- Of one firm: a label of another firm can't be put on an account. Deleting an account, or a label, takes its rows with it.
  CONSTRAINT account_labels_account_fkey FOREIGN KEY (firm_id, account_id) REFERENCES public.accounts (firm_id, id) ON DELETE CASCADE,
  CONSTRAINT account_labels_label_fkey FOREIGN KEY (firm_id, label_id) REFERENCES public.labels (firm_id, id) ON DELETE CASCADE
);

CREATE INDEX account_labels_label_idx ON public.account_labels (firm_id, label_id);

COMMENT ON TABLE public.account_labels IS 'A label on an account (glossary: Label). Written only by bulk_accounts_change and bulk_accounts_undo.';

-- What a bulk change did, for ten minutes' undo (D-202). Closed to the API; the functions below read and write it.
CREATE TABLE public.bulk_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  -- The maker's membership when they made it (an undo is theirs only while that membership is still current: a person made an agent since, or removed, holds
  -- a new one, and the level they had then is not theirs now, D-209).
  actor_membership_id bigint,
  action text NOT NULL CONSTRAINT bulk_changes_action_check CHECK (action IN ('owner', 'archive', 'field', 'label_add', 'label_remove')),
  -- The action's own details, as checked (the owner, the field and value, the label), for the record.
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  made_at timestamptz NOT NULL DEFAULT now(),
  undo_until timestamptz NOT NULL,
  undone_at timestamptz,
  -- How many accounts and opportunities it changed: a record deleted since takes its row (and every name and value kept for the undo) with it, and the undo
  -- reports the difference as gone, as a count.
  record_count integer NOT NULL DEFAULT 0 CONSTRAINT bulk_changes_record_count_check CHECK (record_count >= 0),
  opportunity_count integer NOT NULL DEFAULT 0 CONSTRAINT bulk_changes_opportunity_count_check CHECK (opportunity_count >= 0),
  CONSTRAINT bulk_changes_firm_id_id_key UNIQUE (firm_id, id)
);

CREATE INDEX bulk_changes_firm_made_idx ON public.bulk_changes (firm_id, made_at);

-- One record a change changed. It stands on the record it is about by a foreign key, so deleting an account (or an opportunity) deletes its rows here at
-- once: the names and old values kept for an undo never outlive the record they describe. `record_id` is whichever of the two ids is set.
CREATE TABLE public.bulk_change_records (
  change_id uuid NOT NULL,
  firm_id uuid NOT NULL,
  record_type text NOT NULL CONSTRAINT bulk_change_records_type_check CHECK (record_type IN ('account', 'opportunity')),
  account_id uuid,
  opportunity_id uuid REFERENCES public.opportunities (id) ON DELETE CASCADE,
  record_id uuid GENERATED ALWAYS AS (COALESCE(account_id, opportunity_id)) STORED NOT NULL,
  -- The account's name when it was changed, so an undo can name one the person can no longer see.
  record_name text,
  before jsonb NOT NULL,
  after jsonb NOT NULL,
  -- The newest history entry of the record when the change had finished with it: an entry after it (by anyone) is a change made since (D-202).
  history_mark bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (change_id, record_type, record_id),
  CONSTRAINT bulk_change_records_one_record CHECK ((record_type = 'account') = (account_id IS NOT NULL) AND (record_type = 'opportunity') = (opportunity_id IS NOT NULL)),
  CONSTRAINT bulk_change_records_account_fkey FOREIGN KEY (firm_id, account_id) REFERENCES public.accounts (firm_id, id) ON DELETE CASCADE,
  CONSTRAINT bulk_change_records_change_fkey FOREIGN KEY (firm_id, change_id) REFERENCES public.bulk_changes (firm_id, id) ON DELETE CASCADE
);

-- Closed to the API: a person's own bulk changes are made and undone through the functions below, which say all there is to say. Row security is on, with
-- no policy and no grant to an API role, so a role that is ever granted a table reads nothing it was not given a policy for.
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_change_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.labels, public.account_labels, public.bulk_changes, public.bulk_change_records FROM PUBLIC, anon, authenticated, service_role;
-- The service role reads, as it reads every firm's table; it writes nothing.
GRANT SELECT ON public.labels, public.account_labels, public.bulk_changes, public.bulk_change_records TO service_role;

-- An account's labels, as the history shows them: their names, alphabetically, ignoring case. Internal.
CREATE FUNCTION public.account_label_names(p_account_id uuid, p_plus uuid DEFAULT NULL, p_minus uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(n.name ORDER BY lower(n.name), n.name), '[]'::jsonb)
  FROM (
    SELECT l.name FROM public.account_labels al JOIN public.labels l ON l.id = al.label_id
    WHERE al.account_id = p_account_id AND al.label_id IS DISTINCT FROM p_minus
    UNION
    SELECT l.name FROM public.labels l WHERE l.id = p_plus
  ) n
$$;

REVOKE ALL ON FUNCTION public.account_label_names(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The history of an account takes its labels as one field, "labels": one entry per label put on or taken off, from the list of names before to the list
-- after, by whoever did it (as record_history_capture names them: a member, Nevermore, System). It is written for an account that still exists (deleting
-- an account takes its labels with it, and its history goes too) and a label that still exists.
CREATE FUNCTION public.account_labels_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  acct public.accounts;
  nm text;
  before_list jsonb;
  after_list jsonb;
  who uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO acct FROM public.accounts a WHERE a.id = NEW.account_id;
    IF acct.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.labels l WHERE l.id = NEW.label_id) THEN
      RETURN NULL;
    END IF;
    after_list := public.account_label_names(NEW.account_id);
    before_list := public.account_label_names(NEW.account_id, NULL, NEW.label_id);
  ELSE
    SELECT * INTO acct FROM public.accounts a WHERE a.id = OLD.account_id;
    SELECT l.name INTO nm FROM public.labels l WHERE l.id = OLD.label_id;
    IF acct.id IS NULL OR nm IS NULL THEN
      RETURN NULL;
    END IF;
    after_list := public.account_label_names(OLD.account_id);
    before_list := public.account_label_names(OLD.account_id, OLD.label_id);
  END IF;
  INSERT INTO public.record_history (firm_id, table_name, record_key, change_id, kind, field, old_value, new_value, actor_id, actor_is_staff, version)
  VALUES (acct.firm_id, 'accounts', acct.id::text, gen_random_uuid(), 'changed', 'labels', before_list, after_list, who, public.firm_actor_is_staff(who, acct.firm_id), acct.version);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.account_labels_history() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER account_labels_history AFTER INSERT OR DELETE ON public.account_labels FOR EACH ROW EXECUTE FUNCTION public.account_labels_history();

-- ---------- 2. The rules, in one place ----------
-- The words that refuse a change to an account the level rule does not give the caller (D-209), for the person to read: used by every single change
-- (account_to_change), and by a bulk change for the accounts it skips. Internal.
CREATE FUNCTION public.account_change_words(p_owner_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_owner_id IS NULL
    THEN 'An account with no owner can only be changed by an owner of the firm.'
    ELSE 'Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
$$;

REVOKE ALL ON FUNCTION public.account_change_words(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 20261119160000's start of every single change, restated with every rule it had; only the words now come from account_change_words.
CREATE OR REPLACE FUNCTION public.account_to_change(p_firm_id uuid, p_account_id uuid, p_lock text)
RETURNS public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid := p_firm_id;
  cur public.accounts;
BEGIN
  IF p_lock = 'update' THEN
    SELECT * INTO cur FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR UPDATE;
  ELSE
    SELECT * INTO cur FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR NO KEY UPDATE;
  END IF;
  IF cur.id IS NULL OR NOT public.can_see_firm_record(cur.firm_id, cur.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF NOT public.can_change_firm_record(cur.firm_id, cur.owner_id) THEN
    RAISE EXCEPTION '%', public.account_change_words(cur.owner_id) USING ERRCODE = '42501';
  END IF;
  RETURN cur;
END;
$$;

-- The chosen new owner must be a current member of the firm, and stay one to the end of the transaction: their membership is held FOR SHARE. Removing or
-- suspending a member is an UPDATE of valid_until (a non-key update, FOR NO KEY UPDATE, which FOR KEY SHARE would not stop), so a removal not yet committed is
-- waited for and then seen (the row no longer qualifies), and one that starts after this question waits for the change. Taken AFTER the accounts and before the
-- opportunities (the lock order above). Internal; 22023 in words.
CREATE FUNCTION public.member_to_own(p_firm_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM 1 FROM public.firm_memberships m
  WHERE m.firm_id = p_firm_id AND m.user_id = p_user_id AND public.membership_is_current(m.valid_from, m.valid_until)
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose a current member of the firm.' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.member_to_own(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Gives the open opportunities (stage not won or lost, D-206) of the accounts to the person, those the caller may change by the level rule (D-209); the others
-- are left and returned with changed = false so the caller can say how many. An opportunity already theirs is not returned. The opportunities are held
-- FOR NO KEY UPDATE in id order. The accounts are already held by the caller. Internal.
CREATE FUNCTION public.give_open_opportunities(p_firm_id uuid, p_account_ids uuid[], p_owner_id uuid)
RETURNS TABLE (opportunity_id uuid, from_owner uuid, changed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o record;
BEGIN
  FOR o IN
    SELECT x.id AS oid, x.owner_id AS oowner FROM public.opportunities x
    WHERE x.firm_id = p_firm_id AND x.account_id = ANY (p_account_ids) AND public.opportunity_stage(x.id) NOT IN ('won', 'lost')
      AND x.owner_id IS DISTINCT FROM p_owner_id
    ORDER BY x.id FOR NO KEY UPDATE
  LOOP
    opportunity_id := o.oid;
    from_owner := o.oowner;
    IF public.can_change_firm_record(p_firm_id, o.oowner) THEN
      UPDATE public.opportunities SET owner_id = p_owner_id WHERE id = o.oid;
      changed := true;
    ELSE
      changed := false;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.give_open_opportunities(uuid, uuid[], uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 20261119160000's owner change, restated with every rule it had; the new owner and the opportunities now come from the two helpers above, which a bulk
-- owner change calls too, so the rule lives in one place. Same answer, same refusals, same words.
CREATE OR REPLACE FUNCTION public.change_account_owner(p_account_id uuid, p_owner_id uuid, p_change_open_opportunities boolean DEFAULT false, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.accounts;
  done public.accounts;
  n_changed integer := 0;
  n_skipped integer := 0;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  cur := public.account_to_change(firm, p_account_id, 'no_key');
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Choose who will own this account.' USING ERRCODE = '22023';
  END IF;
  -- Lock order: account, membership, opportunities (see the head of this file).
  PERFORM public.member_to_own(cur.firm_id, p_owner_id);
  UPDATE public.accounts SET owner_id = p_owner_id WHERE id = cur.id AND owner_id IS DISTINCT FROM p_owner_id RETURNING * INTO done;
  IF done.id IS NULL THEN
    done := cur;
  END IF;
  IF COALESCE(p_change_open_opportunities, false) THEN
    SELECT count(*) FILTER (WHERE g.changed)::integer, count(*) FILTER (WHERE NOT g.changed)::integer INTO n_changed, n_skipped
    FROM public.give_open_opportunities(cur.firm_id, ARRAY[cur.id], p_owner_id) g;
  END IF;
  RETURN jsonb_build_object('record', public.crm_account_fields(done),
    'owner', jsonb_build_object('id', p_owner_id, 'name', public.crm_person_name(p_owner_id)),
    'opportunities_changed', n_changed, 'opportunities_skipped', n_skipped);
END;
$$;

-- ---------- 3. What a bulk change asks for, checked ----------
-- The words of a label's name, or NULL when there is nothing: no more than 40 characters, no control characters, white space collapsed. Internal.
CREATE FUNCTION public.label_name_clean(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(btrim(regexp_replace(p_name, '\s+', ' ', 'g')), '')
$$;

REVOKE ALL ON FUNCTION public.label_name_clean(text) FROM PUBLIC, anon, authenticated, service_role;

-- The account's value of one of the fields a bulk change can set, as JSON (null for none). Internal.
CREATE FUNCTION public.account_field_json(a public.accounts, p_field text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(CASE p_field
    WHEN 'trade_name' THEN to_jsonb(a.trade_name)
    WHEN 'website' THEN to_jsonb(a.website)
    WHEN 'phone' THEN to_jsonb(a.phone)
    WHEN 'street' THEN to_jsonb(a.street)
    WHEN 'city' THEN to_jsonb(a.city)
    WHEN 'state' THEN to_jsonb(a.state)
    WHEN 'postal_code' THEN to_jsonb(a.postal_code)
    WHEN 'industry' THEN to_jsonb(a.industry)
    WHEN 'employees' THEN to_jsonb(a.employees)
    WHEN 'states_of_operation' THEN to_jsonb(a.states_of_operation)
    WHEN 'current_provider' THEN to_jsonb(a.current_provider)
  END, 'null'::jsonb)
$$;

REVOKE ALL ON FUNCTION public.account_field_json(public.accounts, text) FROM PUBLIC, anon, authenticated, service_role;

-- Writes one of those fields of one account (the value as account_field_json holds it). One statement for each field: a CASE over them could be folded
-- by the planner and fail on a branch not taken. Internal.
CREATE FUNCTION public.account_set_field(p_account_id uuid, p_field text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v text := p_value #>> '{}';
BEGIN
  IF p_field = 'trade_name' THEN UPDATE public.accounts SET trade_name = v WHERE id = p_account_id;
  ELSIF p_field = 'website' THEN UPDATE public.accounts SET website = v WHERE id = p_account_id;
  ELSIF p_field = 'phone' THEN UPDATE public.accounts SET phone = v WHERE id = p_account_id;
  ELSIF p_field = 'street' THEN UPDATE public.accounts SET street = v WHERE id = p_account_id;
  ELSIF p_field = 'city' THEN UPDATE public.accounts SET city = v WHERE id = p_account_id;
  ELSIF p_field = 'state' THEN UPDATE public.accounts SET state = v WHERE id = p_account_id;
  ELSIF p_field = 'postal_code' THEN UPDATE public.accounts SET postal_code = v WHERE id = p_account_id;
  ELSIF p_field = 'industry' THEN UPDATE public.accounts SET industry = v WHERE id = p_account_id;
  ELSIF p_field = 'employees' THEN UPDATE public.accounts SET employees = v::integer WHERE id = p_account_id;
  ELSIF p_field = 'states_of_operation' THEN
    UPDATE public.accounts SET states_of_operation = COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_value)), '{}') WHERE id = p_account_id;
  ELSIF p_field = 'current_provider' THEN UPDATE public.accounts SET current_provider = v WHERE id = p_account_id;
  ELSE
    RAISE EXCEPTION 'That field can''t be set on many accounts at once.' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.account_set_field(uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- What a bulk change asks for, checked and tidied: {owner_id, change_open_opportunities} | {field, value} | {name} | {}. Anything else is refused (22023, in
-- words): an action that is not one of the five, a key it does not take, a field that is the name, is required or is worked out or set by the product (so the
-- list of fields is the one the account's own edit form has, less its name), a value the field would not hold. A blank value clears an optional field.
-- Internal.
CREATE FUNCTION public.bulk_params_checked(p_action text, p_params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  prm jsonb := COALESCE(NULLIF(p_params, 'null'::jsonb), '{}'::jsonb);
  allowed text[];
  k text;
  field text;
  val jsonb;
  s text;
  n numeric;
  t_trade text; t_website text; t_phone text; t_street text; t_city text; t_state text; t_postal text; t_industry text; t_provider text;
  n_emp integer;
  s_states text[] := '{}';
  problem text;
  nm text;
BEGIN
  IF jsonb_typeof(prm) <> 'object' THEN
    RAISE EXCEPTION 'The change''s details are missing.' USING ERRCODE = '22023';
  END IF;
  allowed := CASE p_action
    WHEN 'owner' THEN ARRAY['owner_id', 'change_open_opportunities']
    WHEN 'field' THEN ARRAY['field', 'value']
    WHEN 'label_add' THEN ARRAY['name']
    WHEN 'label_remove' THEN ARRAY['name']
    WHEN 'archive' THEN ARRAY[]::text[]
    ELSE NULL END;
  IF allowed IS NULL THEN
    RAISE EXCEPTION 'Choose what to change: the owner, a field, a label or archiving.' USING ERRCODE = '22023';
  END IF;
  FOR k IN SELECT jsonb_object_keys(prm) LOOP
    IF NOT k = ANY (allowed) THEN
      RAISE EXCEPTION 'That change does not take "%".', left(k, 64) USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF p_action = 'archive' THEN
    RETURN '{}'::jsonb;
  END IF;

  IF p_action = 'owner' THEN
    IF jsonb_typeof(prm -> 'owner_id') IS DISTINCT FROM 'string' OR (prm ->> 'owner_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Choose who will own these accounts.' USING ERRCODE = '22023';
    END IF;
    IF prm ? 'change_open_opportunities' AND jsonb_typeof(prm -> 'change_open_opportunities') <> 'boolean' THEN
      RAISE EXCEPTION 'Say whether open opportunities change owner too: yes or no.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('owner_id', lower(prm ->> 'owner_id'), 'change_open_opportunities', COALESCE((prm ->> 'change_open_opportunities')::boolean, false));
  END IF;

  IF p_action IN ('label_add', 'label_remove') THEN
    IF jsonb_typeof(prm -> 'name') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Type a label.' USING ERRCODE = '22023';
    END IF;
    nm := public.label_name_clean(prm ->> 'name');
    IF nm IS NULL THEN
      RAISE EXCEPTION 'Type a label.' USING ERRCODE = '22023';
    END IF;
    IF char_length(nm) > 40 THEN
      RAISE EXCEPTION 'Keep a label to 40 characters.' USING ERRCODE = '22023';
    END IF;
    IF nm ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'A label is plain text on one line.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('name', nm);
  END IF;

  -- A field.
  IF jsonb_typeof(prm -> 'field') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Choose the field to set.' USING ERRCODE = '22023';
  END IF;
  field := prm ->> 'field';
  IF field = 'name' THEN
    RAISE EXCEPTION 'The name is required on every account, so it can''t be set on many at once.' USING ERRCODE = '22023';
  END IF;
  IF field NOT IN ('trade_name', 'website', 'phone', 'street', 'city', 'state', 'postal_code', 'industry', 'employees', 'states_of_operation', 'current_provider') THEN
    RAISE EXCEPTION 'That field can''t be set on many accounts at once. Choose an optional field the account''s form lets you edit.' USING ERRCODE = '22023';
  END IF;
  val := COALESCE(prm -> 'value', 'null'::jsonb);
  IF field = 'employees' THEN
    IF jsonb_typeof(val) = 'null' THEN
      n_emp := NULL;
    ELSIF jsonb_typeof(val) = 'number' THEN
      n := (val #>> '{}')::numeric;
      IF n <> trunc(n) OR n < 0 OR n > 2147483647 THEN
        RAISE EXCEPTION 'Employees must be a whole number, 0 or more.' USING ERRCODE = '22023';
      END IF;
      n_emp := n::integer;
    ELSE
      RAISE EXCEPTION 'Employees must be a whole number, 0 or more.' USING ERRCODE = '22023';
    END IF;
    val := COALESCE(to_jsonb(n_emp), 'null'::jsonb);
  ELSIF field = 'states_of_operation' THEN
    IF jsonb_typeof(val) = 'null' THEN
      val := '[]'::jsonb;
    END IF;
    IF jsonb_typeof(val) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(val) e WHERE jsonb_typeof(e) <> 'string') THEN
      RAISE EXCEPTION 'Choose the states of operation from the list.' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(s2 ORDER BY first_at), '{}') INTO s_states
    FROM (SELECT upper(btrim(x)) AS s2, min(i) AS first_at FROM jsonb_array_elements_text(val) WITH ORDINALITY AS u (x, i) WHERE btrim(x) <> '' GROUP BY upper(btrim(x))) d;
    val := to_jsonb(s_states);
  ELSE
    IF jsonb_typeof(val) NOT IN ('null', 'string') THEN
      RAISE EXCEPTION 'That field takes text.' USING ERRCODE = '22023';
    END IF;
    s := NULLIF(btrim(val #>> '{}'), '');
    IF field = 'state' THEN s := upper(s); END IF;
    t_trade := CASE WHEN field = 'trade_name' THEN s END;
    t_website := CASE WHEN field = 'website' THEN s END;
    IF field = 'phone' AND s IS NOT NULL AND NOT public.is_valid_phone(s) THEN
      -- The phone's own rule (check_account_phone), so the preview refuses what the change would.
      RAISE EXCEPTION 'Enter a phone number like (503) 555-0142. An extension can follow, like x12.' USING ERRCODE = '22023';
    END IF;
    t_phone := CASE WHEN field = 'phone' THEN s END;
    t_street := CASE WHEN field = 'street' THEN s END;
    t_city := CASE WHEN field = 'city' THEN s END;
    t_state := CASE WHEN field = 'state' THEN s END;
    t_postal := CASE WHEN field = 'postal_code' THEN s END;
    t_industry := CASE WHEN field = 'industry' THEN s END;
    t_provider := CASE WHEN field = 'current_provider' THEN s END;
    val := COALESCE(to_jsonb(s), 'null'::jsonb);
  END IF;
  -- The account's own rules for each field, in its own words (the name is given as something, since this is not the name's check).
  problem := public.account_input_error('x', t_trade, t_website, t_phone, t_street, t_city, t_state, t_postal, t_industry, n_emp, s_states, t_provider);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('field', field, 'value', val);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_params_checked(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. The selection ----------
-- The accounts a bulk change is for: `account_ids` (in id order), `selected` (how many accounts that is), `requested` (for ids: how many different ids were
-- named, so the screen can say how many were not available; NULL for filters), and `too_many` (more than 1,000; then account_ids is empty). Exactly one of
-- p_filters and p_ids: the table's filters (an object of `filters`, `search` and `time_zone`, each optional, as export_source_accounts takes them; a key it
-- does not have is refused so a typo never selects everything) for "Select all N that match", or the ids. Only accounts of the firm the caller may see; an id
-- that is not one (another firm's, made up, text) gives none, like one that is not there. The filters select as the table does (the accounts query's own
-- matching: archived accounts only when a filter asks), the ids select archived accounts too. Internal.
CREATE FUNCTION public.bulk_accounts_resolve(p_firm_id uuid, p_filters jsonb, p_ids jsonb, OUT account_ids uuid[], OUT selected integer, OUT requested integer, OUT too_many boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cap constant integer := 1000;
  f jsonb := NULLIF(p_filters, 'null'::jsonb);
  i jsonb := NULLIF(p_ids, 'null'::jsonb);
  tz text;
  checked jsonb;
  hits uuid[];
  named uuid[];
BEGIN
  too_many := false;
  requested := NULL;
  IF f IS NOT NULL AND i IS NOT NULL THEN
    RAISE EXCEPTION 'Choose the accounts by their ids or by the table''s filters, not both.' USING ERRCODE = '22023';
  END IF;
  IF f IS NULL AND i IS NULL THEN
    RAISE EXCEPTION 'Choose the accounts to change.' USING ERRCODE = '22023';
  END IF;
  IF i IS NOT NULL THEN
    IF jsonb_typeof(i) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(i) e WHERE jsonb_typeof(e) <> 'string') THEN
      RAISE EXCEPTION 'Name the accounts as a list of ids.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(i) = 0 THEN
      RAISE EXCEPTION 'Choose at least one account.' USING ERRCODE = '22023';
    END IF;
    -- Cut before anything is looked up: a list of a million ids costs one length.
    IF jsonb_array_length(i) > cap THEN
      requested := jsonb_array_length(i);
      selected := requested;
      account_ids := '{}';
      too_many := true;
      RETURN;
    END IF;
    SELECT count(DISTINCT lower(e)) INTO requested FROM jsonb_array_elements_text(i) e;
    named := ARRAY(SELECT e::uuid FROM jsonb_array_elements_text(i) e WHERE e ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
    SELECT COALESCE(array_agg(a.id ORDER BY a.id), '{}') INTO hits
    FROM public.accounts a
    WHERE a.firm_id = p_firm_id AND a.id = ANY (named) AND public.can_see_firm_record(a.firm_id, a.owner_id);
  ELSE
    IF jsonb_typeof(f) IS DISTINCT FROM 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(f) k WHERE k NOT IN ('filters', 'search', 'time_zone'))
       OR (f ? 'search' AND jsonb_typeof(f -> 'search') IS DISTINCT FROM 'string')
       OR (f ? 'time_zone' AND jsonb_typeof(f -> 'time_zone') IS DISTINCT FROM 'string')
       OR (f ? 'filters' AND jsonb_typeof(f -> 'filters') IS DISTINCT FROM 'array') THEN
      RAISE EXCEPTION 'Those filters don''t apply to this table' USING ERRCODE = '22023';
    END IF;
    tz := public.workspace_time_zone(f ->> 'time_zone');
    checked := public.accounts_filters_checked(p_firm_id, COALESCE(f -> 'filters', '[]'::jsonb), (now() AT TIME ZONE tz)::date);
    SELECT COALESCE(array_agg(r.id ORDER BY r.id), '{}') INTO hits
    FROM public.accounts_rows(p_firm_id, f ->> 'search') r
    WHERE public.accounts_row_passes(r, checked, tz);
  END IF;
  selected := cardinality(hits);
  IF selected > cap THEN
    too_many := true;
    account_ids := '{}';
  ELSE
    account_ids := hits;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_accounts_resolve(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 5. What happens to one account ----------
-- What the change does to this account, asked the same way by the preview and by the change (the account row is held by the change; the preview reads it):
--   unavailable  the caller may not see it any more (another change took it from them, or it is gone)
--   skip         the caller may not change it (level rule, D-209), or it is archived and the change would add a label (D-222: nothing is added to an archived
--                account); `code` is 'level' or 'archived' and `reason` is the words
--   same         it is already as asked (owned by that person, archived, has that value, has or lacks the label)
--   change       it will change
-- The label's id is the firm's label of that name, NULL when there is none yet. Internal.
CREATE FUNCTION public.bulk_account_outcome(a public.accounts, p_action text, p_params jsonb, p_label_id uuid, OUT outcome text, OUT code text, OUT reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  has_label boolean;
BEGIN
  IF NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    outcome := 'unavailable';
    RETURN;
  END IF;
  IF NOT public.can_change_firm_record(a.firm_id, a.owner_id) THEN
    outcome := 'skip';
    code := 'level';
    reason := public.account_change_words(a.owner_id);
    RETURN;
  END IF;
  IF p_action = 'owner' THEN
    outcome := CASE WHEN a.owner_id IS NOT DISTINCT FROM (p_params ->> 'owner_id')::uuid THEN 'same' ELSE 'change' END;
  ELSIF p_action = 'archive' THEN
    outcome := CASE WHEN a.archived_at IS NOT NULL THEN 'same' ELSE 'change' END;
  ELSIF p_action = 'field' THEN
    outcome := CASE WHEN public.account_field_json(a, p_params ->> 'field') = COALESCE(p_params -> 'value', 'null'::jsonb) THEN 'same' ELSE 'change' END;
  ELSE
    has_label := p_label_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.account_labels al WHERE al.account_id = a.id AND al.label_id = p_label_id);
    IF p_action = 'label_remove' THEN
      outcome := CASE WHEN has_label THEN 'change' ELSE 'same' END;
    ELSIF has_label THEN
      outcome := 'same';
    ELSIF a.archived_at IS NOT NULL THEN
      outcome := 'skip';
      code := 'archived';
      reason := 'It is archived, and nothing can be added to an archived account. Restore it first.';
    ELSE
      outcome := 'change';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_account_outcome(public.accounts, text, jsonb, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 6. The preview ----------
-- Answers {action, selected, requested, unavailable, limit, too_many, will_change, unchanged, skipped: [{id, name, code, reason}], owner?, label?,
-- opportunities?: {will_change, skipped}}. It changes and locks nothing. For too many accounts it says so and counts nothing else. A refusal as the change
-- would give for who the caller is, what they ask and the new owner; a label to remove that the firm does not have is refused.
CREATE FUNCTION public.bulk_accounts_preview(p_firm_id uuid, p_action text, p_params jsonb DEFAULT '{}'::jsonb, p_filters jsonb DEFAULT NULL, p_ids jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  firm uuid;
  params jsonb;
  sel record;
  lbl uuid;
  a public.accounts;
  oc record;
  n_change integer := 0;
  n_same integer := 0;
  n_unavailable integer := 0;
  seen integer := 0;
  skipped jsonb := '[]'::jsonb;
  allowed uuid[] := '{}';
  opp_change integer := 0;
  opp_skip integer := 0;
  result jsonb;
  new_owner uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  params := public.bulk_params_checked(p_action, p_params);
  SELECT * INTO sel FROM public.bulk_accounts_resolve(firm, p_filters, p_ids);
  result := jsonb_build_object('action', p_action, 'selected', sel.selected, 'requested', sel.requested, 'limit', 1000, 'too_many', sel.too_many);
  IF p_action IN ('label_add', 'label_remove') THEN
    SELECT l.id INTO lbl FROM public.labels l WHERE l.firm_id = firm AND lower(l.name) = lower(params ->> 'name');
    IF p_action = 'label_remove' AND lbl IS NULL THEN
      RAISE EXCEPTION 'The firm has no label called "%".', params ->> 'name' USING ERRCODE = '22023';
    END IF;
    result := result || jsonb_build_object('label', COALESCE((SELECT l.name FROM public.labels l WHERE l.id = lbl), params ->> 'name'));
  ELSIF p_action = 'owner' THEN
    new_owner := (params ->> 'owner_id')::uuid;
    IF NOT public.crm_is_current_member(firm, new_owner) THEN
      RAISE EXCEPTION 'Choose a current member of the firm.' USING ERRCODE = '22023';
    END IF;
    result := result || jsonb_build_object('owner', jsonb_build_object('id', new_owner, 'name', public.crm_person_name(new_owner)));
  END IF;
  IF sel.too_many THEN
    RETURN result || jsonb_build_object('unavailable', 0, 'will_change', 0, 'unchanged', 0, 'skipped', '[]'::jsonb);
  END IF;
  FOR a IN SELECT x.* FROM public.accounts x WHERE x.firm_id = firm AND x.id = ANY (sel.account_ids) ORDER BY x.id LOOP
    seen := seen + 1;
    SELECT * INTO oc FROM public.bulk_account_outcome(a, p_action, params, lbl);
    IF oc.outcome = 'change' THEN
      n_change := n_change + 1;
      allowed := allowed || a.id;
    ELSIF oc.outcome = 'same' THEN
      n_same := n_same + 1;
      allowed := allowed || a.id;
    ELSIF oc.outcome = 'skip' THEN
      skipped := skipped || jsonb_build_object('id', a.id, 'name', a.name, 'code', oc.code, 'reason', oc.reason);
    ELSE
      n_unavailable := n_unavailable + 1;
    END IF;
  END LOOP;
  -- Selected but not found now (deleted since) is unavailable too, so the counts add up to what was selected.
  n_unavailable := n_unavailable + (cardinality(sel.account_ids) - seen) + COALESCE(GREATEST(sel.requested - sel.selected, 0), 0);
  result := result || jsonb_build_object('unavailable', n_unavailable, 'will_change', n_change, 'unchanged', n_same, 'skipped', skipped);
  IF p_action = 'owner' AND (params ->> 'change_open_opportunities')::boolean THEN
    SELECT count(*) FILTER (WHERE public.can_change_firm_record(firm, x.owner_id))::integer, count(*) FILTER (WHERE NOT public.can_change_firm_record(firm, x.owner_id))::integer
    INTO opp_change, opp_skip
    FROM public.opportunities x
    WHERE x.firm_id = firm AND x.account_id = ANY (allowed) AND public.opportunity_stage(x.id) NOT IN ('won', 'lost') AND x.owner_id IS DISTINCT FROM new_owner;
    result := result || jsonb_build_object('opportunities', jsonb_build_object('will_change', opp_change, 'skipped', opp_skip));
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_accounts_preview(uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_accounts_preview(uuid, text, jsonb, jsonb, jsonb) TO authenticated;

-- ---------- 7. The change ----------
-- Answers what the preview answers, as it happened, and: changed (how many accounts), change_id (NULL when nothing changed, so there is nothing to undo),
-- undo_until, opportunities: {changed, skipped}. Refusals, in the order asked: not a member of the firm (42501), a closing firm and Nevermore support (PT423),
-- what is asked (22023), more than 1,000 accounts (PT413), a new owner who is not a current member (22023), a label to remove the firm does not have (22023).
-- The accounts the caller may change all change or, if anything fails, none.
CREATE FUNCTION public.bulk_accounts_change(p_firm_id uuid, p_action text, p_params jsonb DEFAULT '{}'::jsonb, p_filters jsonb DEFAULT NULL, p_ids jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  firm uuid;
  params jsonb;
  sel record;
  lbl uuid;
  a public.accounts;
  oc record;
  g record;
  chg uuid := gen_random_uuid();
  made boolean := false;
  new_owner uuid;
  n_change integer := 0;
  n_same integer := 0;
  n_unavailable integer := 0;
  skipped jsonb := '[]'::jsonb;
  allowed uuid[] := '{}';
  opp_change integer := 0;
  opp_skip integer := 0;
  undo_by timestamptz := now() + interval '10 minutes';
  maker bigint;
  mark bigint;
  locked uuid[];
  row_before jsonb;
  row_after jsonb;
  al_id uuid;
  old_al public.account_labels;
  result jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  params := public.bulk_params_checked(p_action, p_params);
  SELECT m.id INTO maker FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until);
  SELECT * INTO sel FROM public.bulk_accounts_resolve(firm, p_filters, p_ids);
  IF sel.too_many THEN
    RAISE EXCEPTION 'That is % accounts. A bulk change takes at most 1,000: narrow the selection and try again.', sel.selected USING ERRCODE = 'PT413';
  END IF;
  IF p_action = 'label_remove' AND NOT EXISTS (SELECT 1 FROM public.labels l WHERE l.firm_id = firm AND lower(l.name) = lower(params ->> 'name')) THEN
    RAISE EXCEPTION 'The firm has no label called "%".', params ->> 'name' USING ERRCODE = '22023';
  END IF;
  -- Changes older than a day are cleared (those another person is undoing right now are left, not waited for).
  DELETE FROM public.bulk_changes c WHERE c.id IN (
    SELECT o.id FROM public.bulk_changes o WHERE o.firm_id = firm AND o.made_at < now() - interval '1 day' FOR UPDATE SKIP LOCKED);

  -- 1. Every account of the selection, held in one statement in id order (the lock order, above).
  SELECT COALESCE(array_agg(k.id ORDER BY k.id), '{}') INTO locked
  FROM (SELECT x.id FROM public.accounts x WHERE x.firm_id = firm AND x.id = ANY (sel.account_ids) ORDER BY x.id FOR NO KEY UPDATE) k;
  -- 2. The new owner's membership.
  IF p_action = 'owner' THEN
    new_owner := (params ->> 'owner_id')::uuid;
    PERFORM public.member_to_own(firm, new_owner);
  END IF;
  -- 4. The label, looked up again now the accounts are held, and kept FOR KEY SHARE to the end: an undo that deletes it (a label its change made, with no account
  -- left carrying it) waits for this change, or is waited for and the label is made again below; the rows that name it never meet a label that has gone.
  IF p_action IN ('label_add', 'label_remove') THEN
    SELECT l.id INTO lbl FROM public.labels l WHERE l.firm_id = firm AND lower(l.name) = lower(params ->> 'name') FOR KEY SHARE;
    IF p_action = 'label_remove' AND lbl IS NULL THEN
      RAISE EXCEPTION 'The firm has no label called "%".', params ->> 'name' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- The accounts, now stable: what each will do, and the doing.
  -- (An account deleted while the locks were being taken is not in `locked`; it is counted unavailable below.)
  FOR a IN SELECT x.* FROM public.accounts x WHERE x.firm_id = firm AND x.id = ANY (locked) ORDER BY x.id LOOP
    SELECT * INTO oc FROM public.bulk_account_outcome(a, p_action, params, lbl);
    IF oc.outcome = 'skip' THEN
      skipped := skipped || jsonb_build_object('id', a.id, 'name', a.name, 'code', oc.code, 'reason', oc.reason);
      CONTINUE;
    ELSIF oc.outcome = 'unavailable' THEN
      n_unavailable := n_unavailable + 1;
      CONTINUE;
    ELSIF oc.outcome = 'same' THEN
      n_same := n_same + 1;
      allowed := allowed || a.id;
      CONTINUE;
    END IF;
    n_change := n_change + 1;
    allowed := allowed || a.id;
    IF NOT made THEN
      INSERT INTO public.bulk_changes (id, firm_id, actor_id, actor_membership_id, action, detail, made_at, undo_until)
      VALUES (chg, firm, auth.uid(), maker, p_action, params, now(), undo_by);
      made := true;
    END IF;

    IF p_action = 'owner' THEN
      row_before := jsonb_build_object('owner_id', a.owner_id);
      row_after := jsonb_build_object('owner_id', new_owner);
      UPDATE public.accounts SET owner_id = new_owner WHERE id = a.id;
    ELSIF p_action = 'archive' THEN
      row_before := jsonb_build_object('archived_at', NULL);
      row_after := jsonb_build_object('archived_at', now());
      UPDATE public.accounts SET archived_at = now() WHERE id = a.id;
    ELSIF p_action = 'field' THEN
      row_before := jsonb_build_object('field', params ->> 'field', 'value', public.account_field_json(a, params ->> 'field'));
      row_after := jsonb_build_object('field', params ->> 'field', 'value', params -> 'value');
      PERFORM public.account_set_field(a.id, params ->> 'field', params -> 'value');
    ELSIF p_action = 'label_add' THEN
      IF lbl IS NULL THEN
        -- Made by typing it (D-198), once, by whoever gets there first: a second bulk change of the same word finds it.
        INSERT INTO public.labels (firm_id, name, created_by) VALUES (firm, params ->> 'name', auth.uid())
        ON CONFLICT (firm_id, lower(name)) DO NOTHING RETURNING id INTO lbl;
        IF lbl IS NULL THEN
          SELECT l.id INTO lbl FROM public.labels l WHERE l.firm_id = firm AND lower(l.name) = lower(params ->> 'name');
        ELSE
          -- This change made the word, so its undo, when no account is left carrying it, takes the word out of the firm's list again.
          UPDATE public.bulk_changes SET detail = detail || jsonb_build_object('label_id', lbl, 'label_created', true) WHERE id = chg;
        END IF;
      END IF;
      INSERT INTO public.account_labels (firm_id, account_id, label_id, added_by) VALUES (firm, a.id, lbl, auth.uid()) RETURNING id INTO al_id;
      row_before := jsonb_build_object('label_id', lbl, 'present', false);
      row_after := jsonb_build_object('label_id', lbl, 'account_label_id', al_id);
    ELSE
      DELETE FROM public.account_labels WHERE account_id = a.id AND label_id = lbl RETURNING * INTO old_al;
      row_before := jsonb_build_object('label_id', lbl, 'present', true, 'added_by', old_al.added_by, 'added_at', old_al.added_at);
      row_after := jsonb_build_object('label_id', lbl, 'present', false);
    END IF;
    SELECT COALESCE(max(h.id), 0) INTO mark FROM public.record_history h WHERE h.firm_id = firm AND h.table_name = 'accounts' AND h.record_key = a.id::text;
    INSERT INTO public.bulk_change_records (change_id, firm_id, record_type, account_id, record_name, before, after, history_mark)
    VALUES (chg, firm, 'account', a.id, a.name, row_before, row_after, mark);
  END LOOP;

  -- 3. Their open opportunities, when asked (the same rule as the single change: the accounts the caller may change, those already the new owner's too).
  IF p_action = 'owner' AND (params ->> 'change_open_opportunities')::boolean AND cardinality(allowed) > 0 THEN
    FOR g IN SELECT * FROM public.give_open_opportunities(firm, allowed, new_owner) LOOP
      IF g.changed THEN
        opp_change := opp_change + 1;
        IF NOT made THEN
          INSERT INTO public.bulk_changes (id, firm_id, actor_id, actor_membership_id, action, detail, made_at, undo_until)
          VALUES (chg, firm, auth.uid(), maker, p_action, params, now(), undo_by);
          made := true;
        END IF;
        INSERT INTO public.bulk_change_records (change_id, firm_id, record_type, opportunity_id, before, after, history_mark)
        VALUES (chg, firm, 'opportunity', g.opportunity_id, jsonb_build_object('owner_id', g.from_owner), jsonb_build_object('owner_id', new_owner),
          (SELECT COALESCE(max(h.id), 0) FROM public.record_history h WHERE h.firm_id = firm AND h.table_name = 'opportunities' AND h.record_key = g.opportunity_id::text));
      ELSE
        opp_skip := opp_skip + 1;
      END IF;
    END LOOP;
  END IF;

  IF made THEN
    UPDATE public.bulk_changes SET record_count = n_change, opportunity_count = opp_change WHERE id = chg;
  END IF;
  -- Selected but deleted while the locks were taken: unavailable, so the counts add up to what was selected.
  n_unavailable := n_unavailable + (cardinality(sel.account_ids) - cardinality(locked)) + COALESCE(GREATEST(sel.requested - sel.selected, 0), 0);
  result := jsonb_build_object('action', p_action, 'selected', sel.selected, 'requested', sel.requested, 'limit', 1000, 'too_many', false,
    'unavailable', n_unavailable, 'will_change', n_change, 'changed', n_change, 'unchanged', n_same, 'skipped', skipped,
    'change_id', CASE WHEN made THEN chg END, 'undo_until', CASE WHEN made THEN undo_by END);
  IF p_action = 'owner' THEN
    result := result || jsonb_build_object('owner', jsonb_build_object('id', new_owner, 'name', public.crm_person_name(new_owner)));
    IF (params ->> 'change_open_opportunities')::boolean THEN
      result := result || jsonb_build_object('opportunities', jsonb_build_object('changed', opp_change, 'skipped', opp_skip));
    END IF;
  ELSIF p_action IN ('label_add', 'label_remove') THEN
    result := result || jsonb_build_object('label', COALESCE((SELECT l.name FROM public.labels l WHERE l.id = lbl), params ->> 'name'));
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_accounts_change(uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_accounts_change(uuid, text, jsonb, jsonb, jsonb) TO authenticated;

-- ---------- 8. Undo ----------
-- Puts back every record of the change nobody has changed since, and answers {restored, skipped: [{id, name, code, reason}], opportunities: {restored,
-- skipped}}; the skipped ones are the records changed since, a previous owner who has left the firm, a label for an account archived since (D-222) and a
-- record that is gone. Only the person who made the change, once, within ten minutes of it. The level rule is not asked again (head of this file).
CREATE FUNCTION public.bulk_accounts_undo(p_change_id uuid, p_firm_id uuid DEFAULT NULL)
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
    since := EXISTS (SELECT 1 FROM public.record_history h WHERE h.firm_id = firm AND h.table_name = 'accounts' AND h.record_key = a.id::text AND h.id > rec.history_mark
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

-- ---------- 9. The firm's labels ----------
-- The words the bulk bar offers, alphabetically, to any current member of the firm the call acts for: [{id, name}].
CREATE FUNCTION public.firm_labels(p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) ORDER BY lower(l.name) COLLATE "und-x-icu", l.name) FROM public.labels l WHERE l.firm_id = firm), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.firm_labels(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_labels(uuid) TO authenticated;

-- ---------- 10. Closing a firm deletes them ----------
-- 20261119180000's list, restated with every line it had and four more: the undo's records and changes, the labels on accounts (before the accounts they stand on)
-- and the firm's labels (after them).
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

-- ---------- 11. The Label column and filter on the Accounts table (D-198) ----------
-- The accounts query learns the word: a row carries its labels (alphabetical, ignoring case), and "labels" is a field to filter and sort by. As the states of
-- operation it is a "choices" field: any of, none of, is empty, each by the label's name ignoring case; the values a filter takes are the firm's own words, so
-- the filter takes any text of 1 to 200 characters (a word the firm does not have matches nothing). Sorting is by the labels in the row, as a line of text.
-- Four of 20261119130000's functions are restated below with every rule they had; the lines this story adds are the labels'. (The field list keeps its sync
-- markers: the page's test reads the newest definition and allows `labels` as the one extra until CRM-S3.7a, which puts the column on screen, adds it.) The export's columns are
-- unchanged: a Labels column in a file comes when a story asks for one (CRM-S3.8's).
ALTER TYPE public.accounts_row ADD ATTRIBUTE labels text[];

-- accounts_field_kind: the field list, and the one new line.
CREATE OR REPLACE FUNCTION public.accounts_field_kind(p_field text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    -- sync:begin accounts_fields
    WHEN 'name' THEN 'text'
    WHEN 'trade_name' THEN 'text'
    WHEN 'website' THEN 'text'
    WHEN 'city' THEN 'text'
    WHEN 'industry' THEN 'text'
    WHEN 'current_provider' THEN 'text'
    WHEN 'opportunity_name' THEN 'text'
    WHEN 'employees' THEN 'number'
    WHEN 'open_opportunities' THEN 'number'
    WHEN 'quote_requests_sent' THEN 'number'
    WHEN 'quotes_received' THEN 'number'
    WHEN 'created_at' THEN 'date'
    WHEN 'last_activity_at' THEN 'date'
    WHEN 'target_start' THEN 'date'
    WHEN 'earliest_quote_expires_on' THEN 'date'
    WHEN 'state' THEN 'choice'
    WHEN 'source' THEN 'choice'
    WHEN 'status' THEN 'choice'
    WHEN 'opportunity_stage' THEN 'choice'
    WHEN 'states_of_operation' THEN 'choices'
    WHEN 'labels' THEN 'choices'
    WHEN 'archived' THEN 'yes_no'
    WHEN 'waiting_on_peo' THEN 'yes_no'
    WHEN 'owner' THEN 'person'
    -- sync:end accounts_fields
  END
$$;
-- accounts_row_filters_pass: one row against the checked filters; one new line.
CREATE OR REPLACE FUNCTION public.accounts_row_filters_pass(r public.accounts_row, p_checked jsonb, p_time_zone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_checked) f
    WHERE NOT COALESCE(CASE f ->> 'field'
      WHEN 'name' THEN public.workspace_filter_match_text(r.name, f)
      WHEN 'trade_name' THEN public.workspace_filter_match_text(r.trade_name, f)
      WHEN 'website' THEN public.workspace_filter_match_text(r.website, f)
      WHEN 'city' THEN public.workspace_filter_match_text(r.city, f)
      WHEN 'industry' THEN public.workspace_filter_match_text(r.industry, f)
      WHEN 'current_provider' THEN public.workspace_filter_match_text(r.current_provider, f)
      WHEN 'opportunity_name' THEN public.workspace_filter_match_text(r.opportunity_name, f)
      WHEN 'employees' THEN public.workspace_filter_match_number(r.employees, f)
      WHEN 'open_opportunities' THEN public.workspace_filter_match_number(r.open_opportunities, f)
      WHEN 'quote_requests_sent' THEN public.workspace_filter_match_number(r.quote_requests_sent, f)
      WHEN 'quotes_received' THEN public.workspace_filter_match_number(r.quotes_received, f)
      WHEN 'created_at' THEN public.workspace_filter_match_date((r.created_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'last_activity_at' THEN public.workspace_filter_match_date((r.last_activity_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'target_start' THEN public.workspace_filter_match_date(r.target_start, f)
      WHEN 'earliest_quote_expires_on' THEN public.workspace_filter_match_date(r.earliest_quote_expires_on, f)
      WHEN 'state' THEN public.workspace_filter_match_choice(r.state, f)
      WHEN 'source' THEN public.workspace_filter_match_choice(r.source, f)
      WHEN 'status' THEN public.workspace_filter_match_choice(r.status, f)
      WHEN 'opportunity_stage' THEN public.workspace_filter_match_choice(r.opportunity_stage, f)
      WHEN 'states_of_operation' THEN public.workspace_filter_match_choices(r.states_of_operation, f)
      WHEN 'labels' THEN public.workspace_filter_match_choices(r.labels, f)
      WHEN 'archived' THEN public.workspace_filter_match_yes_no(r.archived, f)
      WHEN 'waiting_on_peo' THEN public.workspace_filter_match_yes_no(r.waiting_on_peo, f)
      WHEN 'owner' THEN public.workspace_filter_match_person(r.owner, f)
    END, false)
  )
$$;
-- accounts_rows: the accounts the caller may see, with their columns; the labels column is the new lateral lookup (by the account's own id, like the others).
CREATE OR REPLACE FUNCTION public.accounts_rows(p_firm_id uuid, p_search text, p_ids uuid[] DEFAULT NULL)
RETURNS SETOF public.accounts_row
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  seen_owners uuid[];
  seen_unowned boolean;
  terms text[] := ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '');
  domains text[] := ARRAY(SELECT public.web_domain_of(t) FROM unnest(ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '')) AS t);
BEGIN
  SELECT COALESCE(array_agg(o.owner_id) FILTER (WHERE o.owner_id IS NOT NULL), '{}'), COALESCE(bool_or(o.owner_id IS NULL), false)
  INTO seen_owners, seen_unowned
  FROM (SELECT DISTINCT a.owner_id FROM public.accounts a WHERE a.firm_id = p_firm_id OFFSET 0) o   -- OFFSET 0: the question is asked of each owner, not pushed down to each account
  WHERE public.can_see_firm_record(p_firm_id, o.owner_id);

  RETURN QUERY
  SELECT (ROW(
    a.id, a.name, a.trade_name, a.website, a.city, a.state, a.industry, a.employees, a.states_of_operation, a.current_provider, a.source,
    CASE WHEN won.is_won THEN 'client' ELSE 'prospect' END, a.archived_at IS NOT NULL, a.archived_at, a.created_at,
    mem.user_id, mem.name,
    mc.id, mc.name, mc.email, mc.phone,
    oo.id, oo.name, oo.stage, oo.target_start, COALESCE(oo.n, 0),
    COALESCE(q.sent, 0), COALESCE(q.received, 0), COALESCE(q.waiting, false), q.expires,
    act.at, COALESCE(lab.names, '{}')
  )::public.accounts_row).*
  FROM public.accounts a
  LEFT JOIN LATERAL (
    SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text) AS name
    FROM public.firm_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = p_firm_id AND m.user_id = a.owner_id AND public.membership_is_current(m.valid_from, m.valid_until)
    LIMIT 1
  ) mem ON true
  -- The account's status (D-197): a client once an opportunity of it is Won. account_status() says the same for any account by its id alone, which no index
  -- serves (opportunities are indexed by firm and account), so asked for each account of a firm it reads every opportunity of every firm; this asks by firm
  -- and account. supabase/tests/accounts_query.sql compares the two for every account.
  LEFT JOIN LATERAL (
    SELECT EXISTS (
      SELECT 1 FROM public.opportunities w
      WHERE w.firm_id = p_firm_id AND w.account_id = a.id AND w.intake_id IS NOT NULL AND public.submission_opportunity_stage(w.intake_id) = 'won') AS is_won
  ) won ON true
  LEFT JOIN LATERAL (
    SELECT c.id, btrim(concat_ws(' ', c.first_name, c.last_name)) AS name, NULLIF(btrim(c.email), '') AS email,
           COALESCE(NULLIF(btrim(c.phone), ''), NULLIF(btrim(c.mobile), '')) AS phone
    FROM public.contacts c
    WHERE c.account_id = a.id AND c.is_main
  ) mc ON true
  LEFT JOIN LATERAL (
    SELECT x.id, x.name, x.target_start, x.stage, x.intake_id, (count(*) OVER ())::integer AS n
    FROM (
      SELECT o.id, o.name, o.target_start, o.created_at, o.intake_id, public.opportunity_stage(o.id) AS stage
      FROM public.opportunities o
      WHERE o.firm_id = p_firm_id AND o.account_id = a.id
    ) x
    WHERE x.stage NOT IN ('won', 'lost')
    ORDER BY x.target_start NULLS LAST, x.created_at, x.id
    LIMIT 1
  ) oo ON true
  LEFT JOIN LATERAL (
    SELECT (count(*) FILTER (WHERE r.status <> 'closed'))::integer AS sent,
           (count(*) FILTER (WHERE r.status = 'quoted'))::integer AS received,
           min(r.quote_expires_on) FILTER (WHERE r.status = 'quoted') AS expires,
           COALESCE(bool_or(r.status = 'sent'), false) AS waiting
    FROM public.quote_requests r
    WHERE r.session_id = oo.intake_id
  ) q ON true
  LEFT JOIN LATERAL (
    SELECT max(t.at) AS at FROM public.account_activity_times(p_firm_id, a.id) t
  ) act ON true
  LEFT JOIN LATERAL (
    SELECT lower(string_agg(concat_ws(' ', c.first_name, c.last_name, c.email), E'\n')) AS t
    FROM public.contacts c
    WHERE cardinality(terms) > 0 AND c.account_id = a.id
  ) ct ON true
  LEFT JOIN LATERAL (
    SELECT array_agg(l.name ORDER BY lower(l.name), l.name) AS names
    FROM public.account_labels al JOIN public.labels l ON l.id = al.label_id
    WHERE al.account_id = a.id
  ) lab ON true
  WHERE a.firm_id = p_firm_id
    AND (a.owner_id = ANY (seen_owners) OR (a.owner_id IS NULL AND seen_unowned))
    AND (p_ids IS NULL OR a.id = ANY (p_ids))
    AND NOT EXISTS (
      SELECT 1 FROM unnest(terms, domains) AS w (term, dom)
      WHERE strpos(lower(concat_ws(E'\n', a.name, a.trade_name, a.web_domain)) || E'\n' || COALESCE(ct.t, ''), w.term) = 0
        AND (w.dom IS NULL OR a.web_domain IS NULL OR strpos(a.web_domain, w.dom) = 0)
    );
END;
$$;
-- accounts_list: the page; one new line in the text sort keys.
CREATE OR REPLACE FUNCTION public.accounts_list(
  p_firm_id uuid,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_sort text DEFAULT NULL,
  p_direction text DEFAULT 'asc',
  p_page integer DEFAULT 1,
  p_search text DEFAULT NULL,
  p_time_zone text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  page_size constant integer := 50;
  firm uuid;
  tz text;
  checked jsonb;
  pg integer := COALESCE(p_page, 1);
  choices text[];
  result jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  tz := public.workspace_time_zone(p_time_zone);
  checked := public.accounts_filters_checked(firm, p_filters, (now() AT TIME ZONE tz)::date);
  IF p_sort IS NOT NULL THEN
    IF public.accounts_field_kind(p_sort) IS NULL THEN
      RAISE EXCEPTION 'The accounts table has no field "%" to sort by', left(p_sort, 64) USING ERRCODE = '22023';
    END IF;
    choices := public.accounts_field_choices(p_sort);
  END IF;
  IF p_direction IS NULL OR p_direction NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'A sort goes asc or desc' USING ERRCODE = '22023';
  END IF;
  IF pg < 1 OR pg > 100000 THEN
    RAISE EXCEPTION 'A page number is 1 to 100000' USING ERRCODE = '22023';
  END IF;

  WITH matched AS MATERIALIZED (
    SELECT r
    FROM public.accounts_rows(firm, p_search) r
    WHERE public.accounts_row_passes(r, checked, tz)
  ),
  keyed AS (
    SELECT
      m.r,
      -- One key per type; only the sorted field's is set. Text, compared by the ICU collation so "Émile" sorts beside "emile", not after "zeta".
      NULLIF(btrim(CASE p_sort
        WHEN 'name' THEN lower((m.r).name COLLATE "und-x-icu")
        WHEN 'trade_name' THEN lower((m.r).trade_name COLLATE "und-x-icu")
        WHEN 'website' THEN lower((m.r).website COLLATE "und-x-icu")
        WHEN 'city' THEN lower((m.r).city COLLATE "und-x-icu")
        WHEN 'industry' THEN lower((m.r).industry COLLATE "und-x-icu")
        WHEN 'current_provider' THEN lower((m.r).current_provider COLLATE "und-x-icu")
        WHEN 'opportunity_name' THEN lower((m.r).opportunity_name COLLATE "und-x-icu")
        WHEN 'state' THEN lower((m.r).state COLLATE "und-x-icu")
        WHEN 'owner' THEN lower((m.r).owner_name COLLATE "und-x-icu")
        WHEN 'states_of_operation' THEN lower(array_to_string((m.r).states_of_operation, ', ') COLLATE "und-x-icu")
        WHEN 'labels' THEN lower(array_to_string((m.r).labels, ', ') COLLATE "und-x-icu")
      END), '') AS k_text,
      CASE p_sort
        WHEN 'employees' THEN (m.r).employees::numeric
        WHEN 'open_opportunities' THEN (m.r).open_opportunities
        WHEN 'quote_requests_sent' THEN (m.r).quote_requests_sent
        WHEN 'quotes_received' THEN (m.r).quotes_received
        WHEN 'archived' THEN (m.r).archived::integer
        WHEN 'waiting_on_peo' THEN (m.r).waiting_on_peo::integer
        -- A choice by its place in the field's list; a value outside it, if one ever appears, after the listed ones.
        WHEN 'status' THEN COALESCE(array_position(choices, (m.r).status), cardinality(choices) + 1)
        WHEN 'source' THEN COALESCE(array_position(choices, (m.r).source), cardinality(choices) + 1)
        WHEN 'opportunity_stage' THEN CASE WHEN (m.r).opportunity_stage IS NULL THEN NULL
          ELSE COALESCE(array_position(choices, (m.r).opportunity_stage), cardinality(choices) + 1) END
      END AS k_number,
      CASE p_sort
        WHEN 'created_at' THEN (m.r).created_at
        WHEN 'last_activity_at' THEN (m.r).last_activity_at
      END AS k_moment,
      CASE p_sort
        WHEN 'target_start' THEN (m.r).target_start
        WHEN 'earliest_quote_expires_on' THEN (m.r).earliest_quote_expires_on
      END AS k_day
    FROM matched m
  ),
  ordered AS (
    SELECT k.r, row_number() OVER (ORDER BY
      -- Empty values last, whichever way.
      (p_sort IS NOT NULL AND k.k_text IS NULL AND k.k_number IS NULL AND k.k_moment IS NULL AND k.k_day IS NULL),
      CASE WHEN p_direction = 'asc' THEN k.k_text END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_text END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_number END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_number END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_moment END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_moment END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_day END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_day END DESC,
      -- Then the table's own order: last activity, newest first, then the id, so every row has its one place.
      (k.r).last_activity_at DESC NULLS LAST, (k.r).id
    ) AS pos
    FROM keyed k
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(o.r) ORDER BY o.pos)
      FROM ordered o
      WHERE o.pos > (pg - 1)::bigint * page_size AND o.pos <= pg::bigint * page_size
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM matched),
    'page', pg,
    'page_size', page_size
  ) INTO result;
  RETURN result;
END;
$$;