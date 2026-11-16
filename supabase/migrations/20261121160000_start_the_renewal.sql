-- CRM-A2.4b: Start the renewal (D-449). opportunity_create (20261120130000) takes an optional renewal and links the opportunity it makes to it in the same
-- transaction: 20261120130000 left "a renewal's link to the opportunity" to this story, and nothing else sets renewals.opportunity_id.
--
-- The signature changes (p_renewal_id uuid DEFAULT NULL, last), so the old one is dropped and the function restated whole from 20261120130000, its only
-- definition, with every behaviour kept (the refusal order, the owner rules and their clock_timestamp() recheck, the source and partner rules) and these added,
-- after all the existing refusals and before the insert:
--   * a renewal that is not on this account, or not there (22023 "Choose a renewal of this account.");
--   * renewal_to_change's own refusals (a renewal the caller may not see, 404; one they may not change, 42501: D-452);
--   * a renewal marked "Didn't renew" (PT409, done: D-449, D-451); one its opportunity won (PT409, "This renewal was renewed by <name>");
--   * one worked by an open opportunity (PT409, "Its renewal is being worked by <name>", as opportunity_mark_won says it). One whose opportunity was lost
--     links again: the new opportunity replaces the lost one.
-- Locks: the account first, held FOR NO KEY UPDATE when a renewal is named (FOR SHARE as before otherwise; upgrading would deadlock two saves on one
-- renewal), then the renewal through renewal_to_change. The renewal's opportunity_id is tracked, so its version and history move with the link. A second
-- save on the same renewal waits for the first and is then refused, the renewal being worked.
-- Grants as before. No table changes.

DROP FUNCTION public.opportunity_create(uuid, text, date, integer, uuid, date, numeric, text, text, text, uuid, uuid);

CREATE FUNCTION public.opportunity_create(
  p_account_id uuid, p_name text, p_target_start date, p_employees integer, p_main_contact_id uuid, p_expected_close date, p_value numeric, p_source text,
  p_referral_partner_code text, p_next_step text, p_owner_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL, p_renewal_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  name_in text := NULLIF(btrim(p_name), '');
  source_in text := NULLIF(btrim(p_source), '');
  partner_in text := NULLIF(btrim(p_referral_partner_code), '');
  next_in text := NULLIF(btrim(p_next_step), '');
  problem text;
  a public.accounts;
  owner uuid;
  owner_until timestamptz;
  made public.opportunities;
  violated text;
  renewal_account uuid;
  r public.renewals;
  worker_name text;
  worker_stage text;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  -- With a renewal to link, the account is held FOR NO KEY UPDATE from the start (renewal_to_change holds it so): taking FOR SHARE first and upgrading would
  -- deadlock two saves on one renewal. Without one, FOR SHARE as before.
  IF p_renewal_id IS NULL THEN
    SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR SHARE;
  ELSE
    SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR NO KEY UPDATE;
  END IF;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing can be added to it.' USING ERRCODE = '55000';
  END IF;
  problem := public.opportunity_input_error(name_in, p_employees, p_value, source_in, next_in);
  IF problem IS NULL AND NOT public.opportunity_source_is_known(source_in) THEN
    problem := 'Choose a source from the list.';
  END IF;
  IF problem IS NULL AND partner_in IS NOT NULL THEN
    IF source_in IS DISTINCT FROM 'Referral' THEN
      problem := 'A referral partner goes only with the source Referral.';
    ELSIF NOT EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = firm AND r.code = partner_in) THEN
      problem := 'Choose one of the firm''s referral partners.';
    END IF;
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_main_contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_main_contact_id AND c.account_id = a.id) THEN
    RAISE EXCEPTION 'Choose a contact of this account.' USING ERRCODE = '22023';
  END IF;
  -- The owner is the maker unless they choose another. Their membership is locked FOR SHARE (not KEY SHARE: removing or suspending a person is a non-key UPDATE of
  -- this row) until the end of the transaction, as add_contact and create_account lock it: a removal either committed first and the person is no longer current
  -- here, or waits.
  owner := COALESCE(p_owner_id, auth.uid());
  IF owner IS NOT NULL THEN
    SELECT m.valid_until INTO owner_until FROM public.firm_memberships m
    WHERE m.firm_id = firm AND m.user_id = owner AND public.membership_is_current(m.valid_from, m.valid_until)
    FOR SHARE;
  END IF;
  -- membership_is_current reads now(), the start of this transaction, and the row may have been waited for: a removal that committed meanwhile sets valid_until to a
  -- time after that start, so the answer above is stale. Asked again of the row as it is now, against the clock (update_opportunity does the same).
  IF owner IS NULL OR NOT FOUND OR (owner_until IS NOT NULL AND owner_until <= clock_timestamp()) THEN
    RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
  END IF;
  -- update_contact's rule: an owner the caller could not themselves change a record of (an agent: only themselves; a lead: themselves and their teams).
  IF NOT public.can_change_firm_record(firm, owner) THEN
    RAISE EXCEPTION 'You can make an opportunity only for yourself and, as a lead, for people on your teams.' USING ERRCODE = '42501';
  END IF;
  -- And one who can see the account: visibility follows it (D-422), so anyone else would be given an opportunity they could not open.
  IF NOT public.crm_person_sees_record(firm, a.owner_id, owner) THEN
    RAISE EXCEPTION 'Choose someone who can see this account.' USING ERRCODE = '22023';
  END IF;
  -- The renewal this one starts (D-449), asked after everything above. Its account is read without a lock first, so a renewal of another account is refused
  -- before any lock on that account is taken; then renewal_to_change holds the renewal (the account is already held) and asks whether the caller may change it.
  IF p_renewal_id IS NOT NULL THEN
    SELECT x.account_id INTO renewal_account FROM public.renewals x WHERE x.id = p_renewal_id AND x.firm_id = firm;
    IF renewal_account IS DISTINCT FROM a.id THEN
      RAISE EXCEPTION 'Choose a renewal of this account.' USING ERRCODE = '22023';
    END IF;
    r := public.renewal_to_change(firm, p_renewal_id);
    IF r.not_renewed_on IS NOT NULL THEN
      RAISE EXCEPTION 'This renewal is marked as not renewed, so there is no renewal to start.' USING ERRCODE = 'PT409';
    END IF;
    IF r.opportunity_id IS NOT NULL THEN
      SELECT o.name, public.opportunity_stage(o.id) INTO worker_name, worker_stage FROM public.opportunities o WHERE o.id = r.opportunity_id;
      IF worker_stage = 'won' THEN
        RAISE EXCEPTION 'This renewal was renewed by %', COALESCE(worker_name, 'an opportunity') USING ERRCODE = 'PT409';
      ELSIF worker_stage IS DISTINCT FROM 'lost' THEN
        RAISE EXCEPTION 'Its renewal is being worked by %', COALESCE(worker_name, 'an opportunity') USING ERRCODE = 'PT409';
      END IF;
    END IF;
  END IF;
  BEGIN
    INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, target_start, employees, main_contact_id, expected_close, value, source, referral_partner_code, next_step)
    VALUES (firm, a.id, owner, name_in, p_target_start, p_employees, p_main_contact_id, p_expected_close, p_value, source_in, partner_in, next_in)
    RETURNING * INTO made;
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    IF violated = 'opportunities_referral_partner_fkey' THEN
      RAISE EXCEPTION 'Choose one of the firm''s referral partners.' USING ERRCODE = '22023';
    END IF;
    -- The contact was deleted between the look above and the write.
    RAISE EXCEPTION 'Choose a contact of this account.' USING ERRCODE = '22023';
  END;
  IF p_renewal_id IS NOT NULL THEN
    UPDATE public.renewals SET opportunity_id = made.id WHERE id = r.id;
  END IF;
  RETURN jsonb_build_object('record',
    public.crm_opportunity_fields(made) || jsonb_build_object('stage', public.opportunity_stage(made.id), 'referral_partner_code', made.referral_partner_code));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_create(uuid, text, date, integer, uuid, date, numeric, text, text, text, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_create(uuid, text, date, integer, uuid, date, numeric, text, text, text, uuid, uuid, uuid) TO authenticated;
