-- Archive, restore and delete an account, and change its owner (story CRM-A1.1c; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-45, D-204, D-209, D-214, D-219,
-- D-222; ADR 0023, ADR 0024; 20261119100000_crm_records.sql, 20261119140000_account_page.sql).
--
-- What this is. The four things a person does to a whole account, each one function, each asked the same questions in the same order (the order
-- update_account asks them): a member of the firm the call acts for (firm_to_act_for: 42501), the one write guard (assert_firm_writable: a closing firm and
-- Nevermore support are refused, PT423), an account the caller may see (else PT404, the same answer as for one that is not there), then the level rule
-- (can_change_firm_record, D-209: 42501 in words). The account's row is held for the change, so two people acting on one account are ordered.
--
--   archive_account   sets archived_at. An archived account leaves every view of the Accounts table but "Archived"; its fields can still be edited, but nothing
--                     can be added to it (D-222: CRM-A2.2, CRM-A2.3, CRM-E1.5 refuse while archived_at is set). Archiving changes nothing else: not its
--                     opportunities, not its status. Archiving an archived account changes nothing (changed = false).
--   restore_account   clears archived_at. Restoring an account that is not archived changes nothing.
--   delete_account    deletes the account with its contacts (and, from CRM-E1.5, its calls, notes and tasks, by their own foreign key), D-204.
--                     DECISION: an account that holds an intake is never deleted, whoever asks: it can only be archived (BUILD D-219 left the question to
--                     this story; PRD open question 6, QP-D4, is counsel's, so the cautious side holds). An account holds an intake when any of its
--                     opportunities does. A quote request and a submission sit on an intake, and an intake sits on an opportunity (CRM-Q1.3's rule), so
--                     refusing here keeps that rule whole: this function never deletes an opportunity that holds an intake. Emails (Epic 6) join the
--                     refusal when they exist. An account with none of these has its opportunities (each holds nothing) deleted with it.
--                     The race: the account's row is held FOR UPDATE, then every opportunity of it FOR UPDATE, and only then is "holds an intake" asked.
--                     A new opportunity (a chain at certification, a hand-made one) needs the account's row FOR KEY SHARE through its foreign key, and
--                     an intake joining an opportunity needs that opportunity's row, so both wait for this transaction and then fail on a row that is
--                     gone: none can land between the question and the delete. A quote request needs an intake that sits on one of these opportunities.
--   change_account_owner  gives the account to another current member of the firm, and, when asked (p_change_open_opportunities), the account's open
--                     opportunities (stage not won or lost, D-206) too: those the caller may change by the level rule (D-209) change, and the count of
--                     those it may not is answered, so a person is told what was left. The owner is never cleared here (owners assign unowned records).
--
-- Not here: selecting rows and bulk archive and bulk owner change are CRM-S3.6 and CRM-S3.7 (row 20), which ask these same rules. The screen is this story's
-- too (src/lib/accountActionsApi.ts).

-- ---------- 1. The shared start: the account, held and checked ----------
-- The firm's account (the firm already resolved by firm_to_act_for and cleared by assert_firm_writable, which each caller asks first), held for the change,
-- after the last two questions (may the caller see it, may they change it); returns it. p_lock is 'update' (a delete: conflicts with the key-share lock a new
-- opportunity takes) or 'no_key' (a change of the row's own fields). Internal.
CREATE FUNCTION public.account_to_change(p_firm_id uuid, p_account_id uuid, p_lock text)
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
    RAISE EXCEPTION '%', CASE WHEN cur.owner_id IS NULL
      THEN 'An account with no owner can only be changed by an owner of the firm.'
      ELSE 'Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
      USING ERRCODE = '42501';
  END IF;
  RETURN cur;
END;
$$;

REVOKE ALL ON FUNCTION public.account_to_change(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. Archive and restore ----------
-- {changed, record: <the account's own fields>}.
CREATE FUNCTION public.archive_account(p_account_id uuid, p_firm_id uuid DEFAULT NULL)
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
  IF cur.archived_at IS NOT NULL THEN
    RETURN jsonb_build_object('changed', false, 'record', public.crm_account_fields(cur));
  END IF;
  UPDATE public.accounts SET archived_at = now() WHERE id = cur.id RETURNING * INTO done;
  RETURN jsonb_build_object('changed', true, 'record', public.crm_account_fields(done));
END;
$$;

REVOKE ALL ON FUNCTION public.archive_account(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_account(uuid, uuid) TO authenticated;

CREATE FUNCTION public.restore_account(p_account_id uuid, p_firm_id uuid DEFAULT NULL)
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
  IF cur.archived_at IS NULL THEN
    RETURN jsonb_build_object('changed', false, 'record', public.crm_account_fields(cur));
  END IF;
  UPDATE public.accounts SET archived_at = NULL WHERE id = cur.id RETURNING * INTO done;
  RETURN jsonb_build_object('changed', true, 'record', public.crm_account_fields(done));
END;
$$;

REVOKE ALL ON FUNCTION public.restore_account(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_account(uuid, uuid) TO authenticated;

-- ---------- 3. Delete ----------
-- {deleted: true, name}. Refused with PT409 (in words) when the account holds an intake: archive it instead.
CREATE FUNCTION public.delete_account(p_account_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.accounts;
  holding integer;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  cur := public.account_to_change(firm, p_account_id, 'update');
  -- Every opportunity of the account is held before the question is asked (see the header): none can gain an intake, and none can be added, until this ends.
  PERFORM 1 FROM public.opportunities o WHERE o.account_id = cur.id FOR UPDATE;
  SELECT count(*) INTO holding FROM public.opportunities o WHERE o.account_id = cur.id AND o.intake_id IS NOT NULL;
  IF holding > 0 THEN
    RAISE EXCEPTION 'This account holds an intake, so it can''t be deleted. Archive it instead.' USING ERRCODE = 'PT409';
  END IF;
  DELETE FROM public.opportunities o WHERE o.account_id = cur.id;
  DELETE FROM public.accounts a WHERE a.id = cur.id;
  RETURN jsonb_build_object('deleted', true, 'name', cur.name);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_account(uuid, uuid) TO authenticated;

-- ---------- 4. Change the owner ----------
-- {record, owner: {id, name}, opportunities_changed, opportunities_skipped}.
CREATE FUNCTION public.change_account_owner(p_account_id uuid, p_owner_id uuid, p_change_open_opportunities boolean DEFAULT false, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.accounts;
  done public.accounts;
  changed integer := 0;
  skipped integer := 0;
  o record;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  cur := public.account_to_change(firm, p_account_id, 'no_key');
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Choose who will own this account.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.firm_memberships m
    WHERE m.firm_id = cur.firm_id AND m.user_id = p_owner_id AND public.membership_is_current(m.valid_from, m.valid_until)) THEN
    RAISE EXCEPTION 'Choose a current member of the firm.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.accounts SET owner_id = p_owner_id WHERE id = cur.id AND owner_id IS DISTINCT FROM p_owner_id RETURNING * INTO done;
  IF done.id IS NULL THEN
    done := cur;
  END IF;
  IF COALESCE(p_change_open_opportunities, false) THEN
    FOR o IN
      SELECT x.id, x.owner_id FROM public.opportunities x
      WHERE x.account_id = cur.id AND public.opportunity_stage(x.id) NOT IN ('won', 'lost') AND x.owner_id IS DISTINCT FROM p_owner_id
      ORDER BY x.id FOR NO KEY UPDATE
    LOOP
      IF public.can_change_firm_record(cur.firm_id, o.owner_id) THEN
        UPDATE public.opportunities SET owner_id = p_owner_id WHERE id = o.id;
        changed := changed + 1;
      ELSE
        skipped := skipped + 1;
      END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('record', public.crm_account_fields(done),
    'owner', jsonb_build_object('id', p_owner_id, 'name', public.crm_person_name(p_owner_id)),
    'opportunities_changed', changed, 'opportunities_skipped', skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.change_account_owner(uuid, uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_account_owner(uuid, uuid, boolean, uuid) TO authenticated;
