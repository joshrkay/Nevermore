-- Epic 4 meets main's merge (CRM-O1.3a, 20261120121000, after CRM-S4.3b, 20261121100000; docs/BROKER_CRM_BUILD.md Epic 4 build order, D-648).
--
-- Epic 4's branch was merged with main after both had been built beside each other, and two things CRM-O1.3a put in place were undone, or never known, by main's
-- 20261121100000_merge_records.sql, which sorts after 20261120121000 and so wins wherever the two touched the same thing. This migration is dated after it (20261121150000, the
-- timestamp the build order gives the Epic 4 merge) and puts both back, without editing either.
--
--   1. Closing a firm. 20261121100000 restated firm_closing_plan() from text that had no step for commission_payments, so a firm with a recorded payment could no longer be
--      closed (the payment's key to its placement has no cascade) or left rows behind. The step is added again as 20261120121000 added it: to the definition as it stands now, read with
--      pg_get_functiondef, before the renewals (which come before the placements); a function without the line to put it next to stops the migration. Nothing else in the plan changes.
--   2. Merging two accounts. merge_accounts moved a removed account's contacts, opportunities, calls, placements, renewals and labels but not its commission payments, so a removed
--      account with a placement that had payments either failed on the payments' key to (account, placement) when the placement moved, or lost the payments when the account
--      was deleted (their key to the account cascades): a money record gone. merge_accounts is restated from its latest definition (20261121100000, the only one) with the payments held,
--      moved and counted with the placements and renewals, and their key to the placement made deferrable as the other keys a merge changes are. merge_preview, restated the same
--      way, counts them in what would move. crm_merge_accounts_problem says nothing about payments and needs no change: a merge of accounts the caller may change moves the money too.
--
-- Checked and left alone: record_history_can_see and record_history_record_exists still hold the commission_payments branch (20261121100000 only calls them); recent records
-- name accounts and contacts, and a merge moves opportunities without changing their ids; an opportunity's won quote and a renewal's opportunity move with their opportunity and
-- account (the keys are deferred); quote_request_events.actor_is_staff is stamped when an event is written and a merge writes none.

SET lock_timeout = '5s';

-- ---------- 1. Closing a firm deletes the commission payments before the placements ----------
DO $$
DECLARE
  def text;
BEGIN
  def := pg_get_functiondef('public.firm_closing_plan()'::regprocedure);
  IF position('public.commission_payments' IN def) = 0 THEN
    IF position('    (56, ''public.renewals'',' IN def) = 0 THEN
      RAISE EXCEPTION 'firm_closing_plan() has no line for the renewals to put the commission payments before';
    END IF;
    EXECUTE replace(def, '    (56, ''public.renewals'',', E'    (54, ''public.commission_payments'', ''delete'', ''firm_id'', ''commission payments (what the firm received for its placements); before the placements and accounts they stand on''),\n    (56, ''public.renewals'',');
  END IF;
  -- The history's two questions are not touched by the merge migration; say so if that ever stops being true.
  IF position('commission_payments' IN pg_get_functiondef('public.record_history_can_see(uuid, public.record_history_table, text)'::regprocedure)) = 0
     OR position('commission_payments' IN pg_get_functiondef('public.record_history_record_exists(uuid, public.record_history_table, text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'the history''s questions no longer know the commission payments';
  END IF;
END $$;

-- ---------- 2. A merge of accounts keeps the commission payments ----------
-- The payments' key to the placement names the account and the placement together, like the keys to a placement's opportunity and a renewal's placement: between the statements of
-- a merge, with the placement on the kept account and the payment still on the removed one, it would not hold. Deferrable, checked at the end of every statement unless
-- merge_accounts defers it (it does, and checks once before returning). Nothing else about it changes.
ALTER TABLE public.commission_payments ALTER CONSTRAINT commission_payments_placement_fkey DEFERRABLE INITIALLY IMMEDIATE;

-- What the screen shows before the choice: the same as 20261121100000, with the payments counted in what would move.
CREATE OR REPLACE FUNCTION public.merge_preview(p_firm_id uuid, p_kind text, p_kept_id uuid, p_removed_id uuid)
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
        'commission_payments', (SELECT count(*) FROM public.commission_payments y WHERE y.account_id = ra.id),
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

-- Answers {record, removed: {id, name}, moved: {contacts, contacts_merged, opportunities, activities, placements, renewals, commission_payments, labels}}.
-- Restated whole from 20261121100000: the commission payments are locked with the placements and renewals, deferred and moved with them, and counted in `moved`.
CREATE OR REPLACE FUNCTION public.merge_accounts(
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
  n_payments integer;
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
  PERFORM 1 FROM public.commission_payments x WHERE x.account_id IN (k.id, r.id) ORDER BY x.id FOR UPDATE;

  -- Between the statements the keys that name an account and a row together are not looked at; they are looked at, once, before this function returns.
  SET CONSTRAINTS public.activities_contact_fkey, public.activities_opportunity_fkey, public.opportunities_main_contact_fkey,
    public.placements_opportunity_fkey, public.renewals_opportunity_fkey, public.renewals_placement_fkey, public.commission_payments_placement_fkey DEFERRED;
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
  -- The commission the firm received follows its placement (CRM-O1.3a). Without this the payments would stop the placement from moving, or be deleted with the removed
  -- account (their key to the account cascades): money lost. Their version and history are untouched: only fields the history tracks change them, and the account is not one.
  UPDATE public.commission_payments SET account_id = k.id WHERE account_id = r.id;
  GET DIAGNOSTICS n_payments = ROW_COUNT;
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
    public.placements_opportunity_fkey, public.renewals_opportunity_fkey, public.renewals_placement_fkey, public.commission_payments_placement_fkey IMMEDIATE;
  RETURN jsonb_build_object(
    'record', public.crm_account_fields(done),
    'removed', jsonb_build_object('id', r.id, 'name', r.name),
    'moved', jsonb_build_object(
      'contacts', n_contacts, 'contacts_merged', n_merged, 'opportunities', n_opps, 'activities', n_acts, 'placements', n_placements, 'renewals', n_renewals, 'commission_payments', n_payments, 'labels', n_labels));
END;
$$;

REVOKE ALL ON FUNCTION public.merge_accounts(uuid, uuid, jsonb, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_accounts(uuid, uuid, jsonb, integer, integer, uuid) TO authenticated;
