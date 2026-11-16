-- Bulk actions on leads with Undo, the bin with Restore, and the 30-day nightly removal (story CRM-L1.1b, slice 8.4; docs/BROKER_CRM_BUILD.md D-806, D-811,
-- D-1640 to D-1649; 20261119210000_bulk_changes.sql, whose shape this follows; supabase/tests/leads_bulk.sql).

-- ---------- 1. What a bulk change keeps, for leads too ----------
-- A bulk change of leads is kept as an accounts' one is (D-202): one row in bulk_changes, one in bulk_change_records per lead it changed, standing on the lead
-- by a foreign key, so removing a lead for good takes the names and values kept for its undo with it. Added to; nothing replaced (ADR 0007).
ALTER TABLE public.bulk_changes DROP CONSTRAINT bulk_changes_action_check;
ALTER TABLE public.bulk_changes ADD CONSTRAINT bulk_changes_action_check
  CHECK (action IN ('owner', 'archive', 'field', 'label_add', 'label_remove', 'delete'));

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

-- ---------- 2. The selection ----------
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
  outcome := 'change';
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_lead_outcome(public.leads, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. The change ----------
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
  sel record;
  locked uuid[];
  n_unavailable integer := 0;
  oc record;
  skipped jsonb := '[]'::jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT m.id INTO maker FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until);
  SELECT * INTO sel FROM public.bulk_leads_resolve(firm, p_filters, p_ids);
  -- Every lead of the selection, held in one statement in id order (the lock order of 20261119210000).
  SELECT COALESCE(array_agg(k.id ORDER BY k.id), '{}') INTO locked
  FROM (SELECT x.id FROM public.leads x WHERE x.firm_id = firm AND x.id = ANY (sel.lead_ids) AND x.deleted_at IS NULL ORDER BY x.id FOR NO KEY UPDATE) k;
  FOR l IN SELECT x.* FROM public.leads x WHERE x.firm_id = firm AND x.id = ANY (locked) ORDER BY x.id LOOP
    SELECT * INTO oc FROM public.bulk_lead_outcome(l, p_action, p_params);
    IF oc.outcome = 'skip' THEN
      skipped := skipped || jsonb_build_object('id', l.id, 'name', l.name, 'code', oc.code, 'reason', oc.reason);
      CONTINUE;
    END IF;
    IF NOT made THEN
      INSERT INTO public.bulk_changes (id, firm_id, actor_id, actor_membership_id, action, detail, made_at, undo_until)
      VALUES (chg, firm, auth.uid(), maker, p_action, '{}'::jsonb, now(), undo_by);
      made := true;
    END IF;
    UPDATE public.leads SET deleted_at = now() WHERE id = l.id;
    INSERT INTO public.bulk_change_records (change_id, firm_id, record_type, lead_id, record_name, before, after)
    VALUES (chg, firm, 'lead', l.id, l.name, jsonb_build_object('deleted_at', NULL), jsonb_build_object('deleted_at', now()));
    n_change := n_change + 1;
  END LOOP;
  IF made THEN
    UPDATE public.bulk_changes SET record_count = n_change WHERE id = chg;
  END IF;
  -- Named but not a lead the caller may see, or gone while the locks were taken: not available, so the counts add up to what was asked.
  n_unavailable := (cardinality(sel.lead_ids) - cardinality(locked)) + COALESCE(GREATEST(sel.requested - sel.selected, 0), 0);
  RETURN jsonb_build_object('action', p_action, 'selected', sel.selected, 'requested', sel.requested, 'unavailable', n_unavailable, 'changed', n_change, 'skipped', skipped, 'change_id', CASE WHEN made THEN chg END, 'undo_until', CASE WHEN made THEN undo_by END);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_leads_change(uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_leads_change(uuid, text, jsonb, jsonb, jsonb) TO authenticated;
