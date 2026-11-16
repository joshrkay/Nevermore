-- Bulk actions on leads with Undo, the bin with Restore, and the 30-day nightly removal (story CRM-L1.1b, slice 8.4; docs/BROKER_CRM_BUILD.md D-806, D-811,
-- D-1640 to D-1649; 20261119210000_bulk_changes.sql, whose shape this follows; supabase/tests/leads_bulk.sql).

-- ---------- 1. What a bulk change keeps, for leads too ----------
-- A bulk change of leads is kept as an accounts' one is (D-202): one row in bulk_changes, one in bulk_change_records per lead it changed, standing on the lead
-- by a foreign key, so removing a lead for good takes the names and values kept for its undo with it. Added to; nothing replaced (ADR 0007).
ALTER TABLE public.bulk_changes DROP CONSTRAINT bulk_changes_action_check;
ALTER TABLE public.bulk_changes ADD CONSTRAINT bulk_changes_action_check
  CHECK (action IN ('owner', 'archive', 'field', 'label_add', 'label_remove', 'delete', 'status', 'not_fit'));

ALTER TABLE public.bulk_change_records ADD COLUMN lead_id uuid;
ALTER TABLE public.bulk_change_records DROP CONSTRAINT bulk_change_records_one_record;
ALTER TABLE public.bulk_change_records DROP CONSTRAINT bulk_change_records_type_check;
ALTER TABLE public.bulk_change_records DROP COLUMN record_id;
ALTER TABLE public.bulk_change_records ADD COLUMN record_id uuid GENERATED ALWAYS AS (COALESCE(account_id, opportunity_id, lead_id)) STORED NOT NULL;
ALTER TABLE public.bulk_change_records ADD PRIMARY KEY (change_id, record_type, record_id);
ALTER TABLE public.bulk_change_records
  ADD CONSTRAINT bulk_change_records_type_check CHECK (record_type IN ('account', 'opportunity', 'lead')),
  ADD CONSTRAINT bulk_change_records_one_record CHECK ((record_type = 'account') = (account_id IS NOT NULL) AND (record_type = 'opportunity') = (opportunity_id IS NOT NULL)
    AND (record_type = 'lead') = (lead_id IS NOT NULL)),
  ADD CONSTRAINT bulk_change_records_lead_fkey FOREIGN KEY (firm_id, lead_id) REFERENCES public.leads (firm_id, id) ON DELETE CASCADE;

-- ---------- 2. What a bulk change asks for, checked ----------
-- What a bulk change of leads asks for, checked and tidied, as bulk_params_checked checks the accounts': {owner_id} | {} for delete. Anything else is refused
-- (22023, in words). Internal.
CREATE FUNCTION public.bulk_lead_params_checked(p_action text, p_params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  prm jsonb := COALESCE(NULLIF(p_params, 'null'::jsonb), '{}'::jsonb);
  allowed text[];
  k text;
BEGIN
  IF jsonb_typeof(prm) <> 'object' THEN
    RAISE EXCEPTION 'The change''s details are missing.' USING ERRCODE = '22023';
  END IF;
  allowed := CASE p_action
    WHEN 'owner' THEN ARRAY['owner_id']
    WHEN 'status' THEN ARRAY['status']
    WHEN 'not_fit' THEN ARRAY['reason']
    WHEN 'delete' THEN ARRAY[]::text[]
    ELSE NULL END;
  IF allowed IS NULL THEN
    RAISE EXCEPTION 'Choose what to change: the owner, the status, Not a fit, a field, a label or deleting.' USING ERRCODE = '22023';
  END IF;
  FOR k IN SELECT jsonb_object_keys(prm) LOOP
    IF NOT k = ANY (allowed) THEN
      RAISE EXCEPTION 'That change does not take "%".', left(k, 64) USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_action = 'owner' THEN
    IF jsonb_typeof(prm -> 'owner_id') IS DISTINCT FROM 'string' OR (prm ->> 'owner_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Choose who will own these leads.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('owner_id', lower(prm ->> 'owner_id'));
  END IF;
  IF p_action = 'status' THEN
    -- New or Working only: Converted is set by converting alone, and Not a fit has its own action with its reason (D-808, D-811).
    IF jsonb_typeof(prm -> 'status') IS DISTINCT FROM 'string' OR (prm ->> 'status') NOT IN ('new', 'working') THEN
      RAISE EXCEPTION 'Choose New or Working.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('status', prm ->> 'status');
  END IF;
  IF p_action = 'not_fit' THEN
    -- One reason for all, from the short list (CRM-L1.3, D-811).
    IF jsonb_typeof(prm -> 'reason') IS DISTINCT FROM 'string'
       OR NOT (prm ->> 'reason') = ANY (ARRAY['too_small', 'wrong_industry', 'not_interested', 'bad_contact_details', 'other']) THEN
      RAISE EXCEPTION 'Choose why they are not a fit: too small, wrong industry, not interested, bad contact details or other.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('reason', prm ->> 'reason');
  END IF;
  RETURN '{}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_lead_params_checked(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2b. The selection ----------
-- The leads a bulk change is for, as bulk_accounts_resolve finds accounts (CRM-S3.6's contract): `lead_ids` (in id order), `selected`, `requested` (for ids:
-- how many different ids were named; NULL for filters) and `too_many`. Only the firm's leads the caller may see and not in the bin (D-806: a lead in the bin
-- is in no view but Deleted, and is put back by Restore, not changed); an id that is not one (another firm's, made up, text) gives none. Internal.
CREATE FUNCTION public.bulk_leads_resolve(p_firm_id uuid, p_filters jsonb, p_ids jsonb, OUT lead_ids uuid[], OUT selected integer, OUT requested integer, OUT too_many boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i jsonb := NULLIF(p_ids, 'null'::jsonb);
  named uuid[];
BEGIN
  too_many := false;
  SELECT count(DISTINCT lower(e)) INTO requested FROM jsonb_array_elements_text(i) e;
  named := ARRAY(SELECT e::uuid FROM jsonb_array_elements_text(i) e WHERE e ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  SELECT COALESCE(array_agg(l.id ORDER BY l.id), '{}') INTO lead_ids
  FROM public.leads l
  WHERE l.firm_id = p_firm_id AND l.id = ANY (named) AND l.deleted_at IS NULL AND public.can_see_firm_record(l.firm_id, l.owner_id);
  selected := cardinality(lead_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_leads_resolve(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. What happens to one lead ----------
-- The words that refuse a change to a lead the level rule (D-809) does not give the caller, as account_change_words says them for an account. Internal.
CREATE FUNCTION public.lead_change_words(p_owner_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_owner_id IS NULL
    THEN 'A lead with no owner can only be changed by an owner of the firm.'
    ELSE 'Only the lead''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
$$;

REVOKE ALL ON FUNCTION public.lead_change_words(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- What the change does to this lead, asked the same way by the preview and by the change (the change holds the lead row; the preview reads it):
--   skip    the caller may not change it; `code` says why and `reason` in words
--   change  it will change
-- Internal.
CREATE FUNCTION public.bulk_lead_outcome(l public.leads, p_action text, p_params jsonb, OUT outcome text, OUT code text, OUT reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.can_change_firm_record(l.firm_id, l.owner_id) THEN
    outcome := 'skip';
    code := 'level';
    reason := public.lead_change_words(l.owner_id);
    RETURN;
  END IF;
  IF l.status = 'converted' THEN
    outcome := 'skip';
    code := 'converted';
    reason := 'It is converted, so it can be read but not changed or deleted.';
    RETURN;
  END IF;
  IF p_action = 'owner' THEN
    outcome := CASE WHEN l.owner_id IS NOT DISTINCT FROM (p_params ->> 'owner_id')::uuid THEN 'same' ELSE 'change' END;
    RETURN;
  END IF;
  IF p_action = 'status' THEN
    outcome := CASE WHEN l.status = p_params ->> 'status' THEN 'same' ELSE 'change' END;
    RETURN;
  END IF;
  IF p_action = 'not_fit' THEN
    outcome := CASE WHEN l.status = 'not_fit' AND l.not_fit_reason = p_params ->> 'reason' THEN 'same' ELSE 'change' END;
    RETURN;
  END IF;
  outcome := 'change';
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_lead_outcome(public.leads, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. The preview ----------
-- Answers {action, selected, requested, unavailable, limit, too_many, will_change, unchanged, skipped: [{id, name, code, reason}]}: what the change would do,
-- asked by the same rules (bulk_lead_outcome). It changes and locks nothing.
CREATE FUNCTION public.bulk_leads_preview(p_firm_id uuid, p_action text, p_params jsonb DEFAULT '{}'::jsonb, p_filters jsonb DEFAULT NULL, p_ids jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  firm uuid;
  sel record;
  l public.leads;
  oc record;
  n_change integer := 0;
  n_same integer := 0;
  seen integer := 0;
  skipped jsonb := '[]'::jsonb;
  params jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  params := public.bulk_lead_params_checked(p_action, p_params);
  SELECT * INTO sel FROM public.bulk_leads_resolve(firm, p_filters, p_ids);
  FOR l IN SELECT x.* FROM public.leads x WHERE x.firm_id = firm AND x.id = ANY (sel.lead_ids) ORDER BY x.id LOOP
    seen := seen + 1;
    SELECT * INTO oc FROM public.bulk_lead_outcome(l, p_action, params);
    IF oc.outcome = 'change' THEN
      n_change := n_change + 1;
    ELSIF oc.outcome = 'same' THEN
      n_same := n_same + 1;
    ELSE
      skipped := skipped || jsonb_build_object('id', l.id, 'name', l.name, 'code', oc.code, 'reason', oc.reason);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('action', p_action, 'selected', sel.selected, 'requested', sel.requested, 'limit', 1000, 'too_many', sel.too_many,
    'unavailable', (cardinality(sel.lead_ids) - seen) + COALESCE(GREATEST(sel.requested - sel.selected, 0), 0),
    'will_change', n_change, 'unchanged', n_same, 'skipped', skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_leads_preview(uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_leads_preview(uuid, text, jsonb, jsonb, jsonb) TO authenticated;

-- ---------- 5. The change ----------
CREATE FUNCTION public.bulk_leads_change(p_firm_id uuid, p_action text, p_params jsonb DEFAULT '{}'::jsonb, p_filters jsonb DEFAULT NULL, p_ids jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  firm uuid;
  l public.leads;
  chg uuid := gen_random_uuid();
  made boolean := false;
  n_change integer := 0;
  undo_by timestamptz := now() + interval '10 minutes';
  maker bigint;
  mark bigint;
  sel record;
  locked uuid[];
  n_unavailable integer := 0;
  oc record;
  skipped jsonb := '[]'::jsonb;
  params jsonb;
  new_owner uuid;
  n_same integer := 0;
  row_before jsonb;
  row_after jsonb;
  result jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  params := public.bulk_lead_params_checked(p_action, p_params);
  SELECT m.id INTO maker FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until);
  SELECT * INTO sel FROM public.bulk_leads_resolve(firm, p_filters, p_ids);
  -- Every lead of the selection, held in one statement in id order (the lock order of 20261119210000).
  SELECT COALESCE(array_agg(k.id ORDER BY k.id), '{}') INTO locked
  FROM (SELECT x.id FROM public.leads x WHERE x.firm_id = firm AND x.id = ANY (sel.lead_ids) AND x.deleted_at IS NULL ORDER BY x.id FOR NO KEY UPDATE) k;
  -- The new owner's membership, held FOR SHARE after the leads (the lock order of 20261119210000).
  IF p_action = 'owner' THEN
    new_owner := (params ->> 'owner_id')::uuid;
    PERFORM public.member_to_own(firm, new_owner);
  END IF;
  FOR l IN SELECT x.* FROM public.leads x WHERE x.firm_id = firm AND x.id = ANY (locked) ORDER BY x.id LOOP
    SELECT * INTO oc FROM public.bulk_lead_outcome(l, p_action, params);
    IF oc.outcome = 'skip' THEN
      skipped := skipped || jsonb_build_object('id', l.id, 'name', l.name, 'code', oc.code, 'reason', oc.reason);
      CONTINUE;
    ELSIF oc.outcome = 'same' THEN
      n_same := n_same + 1;
      CONTINUE;
    END IF;
    IF NOT made THEN
      INSERT INTO public.bulk_changes (id, firm_id, actor_id, actor_membership_id, action, detail, made_at, undo_until)
      VALUES (chg, firm, auth.uid(), maker, p_action, params, now(), undo_by);
      made := true;
    END IF;
    IF p_action = 'owner' THEN
      row_before := jsonb_build_object('owner_id', l.owner_id);
      row_after := jsonb_build_object('owner_id', new_owner);
      UPDATE public.leads SET owner_id = new_owner WHERE id = l.id;
    ELSIF p_action = 'status' THEN
      row_before := jsonb_build_object('status', l.status, 'not_fit_reason', l.not_fit_reason);
      row_after := jsonb_build_object('status', params ->> 'status', 'not_fit_reason', NULL);
      UPDATE public.leads SET status = params ->> 'status', not_fit_reason = NULL WHERE id = l.id;
    ELSIF p_action = 'not_fit' THEN
      row_before := jsonb_build_object('status', l.status, 'not_fit_reason', l.not_fit_reason);
      row_after := jsonb_build_object('status', 'not_fit', 'not_fit_reason', params ->> 'reason');
      UPDATE public.leads SET status = 'not_fit', not_fit_reason = params ->> 'reason' WHERE id = l.id;
    ELSE
      row_before := jsonb_build_object('deleted_at', NULL);
      row_after := jsonb_build_object('deleted_at', now());
      UPDATE public.leads SET deleted_at = now() WHERE id = l.id;
    END IF;
    -- The newest history entry of the lead once the change is done with it: an entry after it, by anyone, is a change made since (D-202).
    SELECT COALESCE(max(h.id), 0) INTO mark FROM public.record_history h WHERE h.firm_id = firm AND h.table_name = 'leads' AND h.record_key = l.id::text;
    INSERT INTO public.bulk_change_records (change_id, firm_id, record_type, lead_id, record_name, before, after, history_mark)
    VALUES (chg, firm, 'lead', l.id, l.name, row_before, row_after, mark);
    n_change := n_change + 1;
  END LOOP;
  IF made THEN
    UPDATE public.bulk_changes SET record_count = n_change WHERE id = chg;
  END IF;
  -- Named but not a lead the caller may see, or gone while the locks were taken: not available, so the counts add up to what was asked.
  n_unavailable := (cardinality(sel.lead_ids) - cardinality(locked)) + COALESCE(GREATEST(sel.requested - sel.selected, 0), 0);
  result := jsonb_build_object('action', p_action, 'selected', sel.selected, 'requested', sel.requested, 'limit', 1000, 'too_many', false,
    'unavailable', n_unavailable, 'will_change', n_change, 'changed', n_change, 'unchanged', n_same, 'skipped', skipped,
    'change_id', CASE WHEN made THEN chg END, 'undo_until', CASE WHEN made THEN undo_by END);
  IF p_action = 'owner' THEN
    result := result || jsonb_build_object('owner', jsonb_build_object('id', new_owner, 'name', public.crm_person_name(new_owner)));
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_leads_change(uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_leads_change(uuid, text, jsonb, jsonb, jsonb) TO authenticated;

-- ---------- 6. Undo ----------
-- Puts back every lead of the change nobody has changed since, and answers {action, restored, skipped: [{id, name, code, reason}], gone}. The level rule is
-- not asked again (as bulk_accounts_undo, D-202): an agent who deleted leads no longer sees them in the bin, and the undo is theirs to make.
CREATE FUNCTION public.bulk_leads_undo(p_change_id uuid, p_firm_id uuid DEFAULT NULL)
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
  l public.leads;
  restored integer := 0;
  skipped jsonb := '[]'::jsonb;
  since boolean;
  prev uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT * INTO ch FROM public.bulk_changes c WHERE c.id = p_change_id AND c.firm_id = firm FOR UPDATE;
  -- Only the person who made it, while the membership they made it under is still current (bulk_accounts_undo's rule).
  IF ch.id IS NULL OR ch.actor_id IS DISTINCT FROM auth.uid() OR ch.actor_membership_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.firm_memberships m WHERE m.id = ch.actor_membership_id AND m.firm_id = firm AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)) THEN
    RAISE EXCEPTION 'That change isn''t available to undo' USING ERRCODE = 'PT404';
  END IF;
  IF ch.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'That change was already undone.' USING ERRCODE = 'PT409';
  END IF;
  IF now() > ch.undo_until THEN
    RAISE EXCEPTION 'That change was made more than 10 minutes ago, so it can no longer be undone.' USING ERRCODE = 'PT410';
  END IF;
  FOR rec IN SELECT r.* FROM public.bulk_change_records r WHERE r.change_id = ch.id AND r.record_type = 'lead' ORDER BY r.record_id LOOP
    SELECT * INTO l FROM public.leads x WHERE x.id = rec.lead_id AND x.firm_id = firm FOR NO KEY UPDATE;
    -- Changed since: the lead's history has an entry for the field after the change finished with it, whoever made it (a value put back is a change too).
    since := EXISTS (SELECT 1 FROM public.record_history h WHERE h.firm_id = firm AND h.table_name = 'leads' AND h.record_key = l.id::text AND h.id > rec.history_mark
      AND h.field = CASE ch.action WHEN 'owner' THEN 'owner_id' WHEN 'status' THEN 'status' WHEN 'not_fit' THEN 'status' ELSE 'deleted_at' END);
    IF since THEN
      skipped := skipped || jsonb_build_object('id', l.id, 'name', rec.record_name, 'code', 'changed_since', 'reason', 'It has been changed since.');
      CONTINUE;
    END IF;
    IF ch.action = 'owner' THEN
      prev := (rec.before ->> 'owner_id')::uuid;
      IF prev IS NOT NULL AND NOT public.crm_is_current_member(firm, prev) THEN
        skipped := skipped || jsonb_build_object('id', l.id, 'name', rec.record_name, 'code', 'owner_left', 'reason', 'Its previous owner is no longer a member of the firm.');
        CONTINUE;
      END IF;
      UPDATE public.leads SET owner_id = prev WHERE id = l.id;
    ELSIF ch.action IN ('status', 'not_fit') THEN
      UPDATE public.leads SET status = rec.before ->> 'status', not_fit_reason = rec.before ->> 'not_fit_reason' WHERE id = l.id;
    ELSE
      UPDATE public.leads SET deleted_at = NULL WHERE id = l.id;
    END IF;
    restored := restored + 1;
  END LOOP;
  UPDATE public.bulk_changes SET undone_at = now() WHERE id = ch.id;
  RETURN jsonb_build_object('action', ch.action, 'restored', restored, 'skipped', skipped, 'gone', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_leads_undo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_leads_undo(uuid, uuid) TO authenticated;
