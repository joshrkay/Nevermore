-- CRM-A2.4b: Start the renewal (D-449). opportunity_create (20261120130000) takes an optional renewal and links the opportunity it makes to it in the same
-- transaction: 20261120130000 left "a renewal's link to the opportunity" to this story, and nothing else sets renewals.opportunity_id.
--
-- The signature changes (p_renewal_id uuid DEFAULT NULL, last), so the old one is dropped and the function restated whole from 20261120130000, its only
-- definition, with every behaviour kept (the refusal order, the owner rules and their clock_timestamp() recheck, the source and partner rules) and these added,
-- after all the existing refusals and before the insert:
--   * a renewal that is not on this account, or not there (22023 "Choose a renewal of this account.");
--   * renewal_to_change's own refusals (a renewal the caller may not see, 404; one they may not change, 42501: D-452);
--   * a renewal marked "Didn't renew" (PT409, done: D-449, D-451); one its opportunity won (PT409, "This renewal was renewed by <name>. Reopen that win first.", as renewal_set_not_renewed says it);
--   * one worked by an open opportunity (PT409, "Its renewal is being worked by <name>", as opportunity_mark_won says it). One whose opportunity was lost
--     links again: the new opportunity replaces the lost one.
-- Locks: the account first, held FOR NO KEY UPDATE when a renewal is named (FOR SHARE as before otherwise; upgrading would deadlock two saves on one
-- renewal), then the renewal through renewal_to_change. The renewal's opportunity_id is tracked, so its version and history move with the link. A second
-- save on the same renewal waits for the first and is then refused, the renewal being worked.
--   * Source (D-439): with a renewal, a source other than Renewal is refused with the field problems (22023, in words, before the renewal is looked at).
-- Grants as before. No table changes.
--
-- Also here (D-223, CRM-A2.4b review): the accounts export carries the Renewal column the table now shows. export_table_registry and export_source_accounts are
-- restated from 20261119130000, their latest definitions, with `renewal_date` (the nearest renewal not done, as the table's column has it) added after the
-- nearest quote expiry, and nothing else changed. Same grants (the functions are replaced in place).

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
  -- Start the renewal's source is Renewal (D-439, D-449): the form holds it, and so does this.
  IF problem IS NULL AND p_renewal_id IS NOT NULL AND source_in IS DISTINCT FROM 'Renewal' THEN
    problem := 'The source of an opportunity that starts a renewal is Renewal.';
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
        RAISE EXCEPTION 'This renewal was renewed by %. Reopen that win first.', COALESCE(worker_name, 'an opportunity') USING ERRCODE = 'PT409';
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

-- ---------- The accounts export carries the Renewal column ----------
CREATE OR REPLACE FUNCTION public.export_table_registry()
RETURNS TABLE (name text, label text, who text, columns jsonb)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    ('referral_partners', 'Referral partners', 'member',
     '[{"id":"code","label":"Code"},{"id":"name","label":"Name"},{"id":"kind","label":"Kind"},{"id":"started_30d","label":"Started, 30 days"},{"id":"certified_30d","label":"Certified, 30 days"},{"id":"created_at","label":"Added"},{"id":"updated_at","label":"Last changed"}]'::jsonb),
    ('firm_activity', 'The firm''s record', 'owner',
     '[{"id":"at","label":"When"},{"id":"who","label":"Who"},{"id":"kind","label":"What"},{"id":"record_type","label":"Record type"},{"id":"record_id","label":"Record"},{"id":"subject","label":"About"},{"id":"role","label":"Role"},{"id":"row_count","label":"Rows"}]'::jsonb),
    ('accounts', 'Accounts', 'member',
     '[{"id":"name","label":"Account"},{"id":"trade_name","label":"Trade name"},{"id":"website","label":"Website"},{"id":"city","label":"City"},{"id":"state","label":"State"},{"id":"employees","label":"Employees"},{"id":"industry","label":"Industry"},{"id":"states_of_operation","label":"States of operation"},{"id":"current_provider","label":"Current provider"},{"id":"source","label":"Source"},{"id":"status","label":"Status"},{"id":"owner","label":"Owner"},{"id":"main_contact","label":"Main contact"},{"id":"main_contact_email","label":"Main contact email"},{"id":"main_contact_phone","label":"Main contact phone"},{"id":"opportunity","label":"Opportunity"},{"id":"opportunity_stage","label":"Opportunity stage"},{"id":"target_start","label":"Target start"},{"id":"open_opportunities","label":"Open opportunities"},{"id":"quote_requests_sent","label":"Quotes asked for"},{"id":"quotes_received","label":"Quotes back"},{"id":"earliest_quote_expires_on","label":"Nearest quote expiry"},{"id":"renewal_date","label":"Renewal date"},{"id":"last_activity_at","label":"Last activity"},{"id":"created_at","label":"Created"},{"id":"archived","label":"Archived"}]'::jsonb)
  ) t (name, label, who, columns)
$$;

CREATE OR REPLACE FUNCTION public.export_source_accounts(p_firm_id uuid, p_filters jsonb, p_ids jsonb, p_limit integer)
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET timezone = 'UTC'
AS $$
DECLARE
  tz text;
  checked jsonb;
  search_in text;
  ids uuid[];
BEGIN
  IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_filters) k WHERE k NOT IN ('filters', 'search', 'time_zone'))
     OR (p_filters ? 'search' AND jsonb_typeof(p_filters -> 'search') IS DISTINCT FROM 'string')
     OR (p_filters ? 'time_zone' AND jsonb_typeof(p_filters -> 'time_zone') IS DISTINCT FROM 'string')
     OR (p_filters ? 'filters' AND jsonb_typeof(p_filters -> 'filters') IS DISTINCT FROM 'array') THEN
    RAISE EXCEPTION 'Those filters don''t apply to this table' USING ERRCODE = '22023';
  END IF;
  tz := public.workspace_time_zone(p_filters ->> 'time_zone');
  checked := public.accounts_filters_checked(p_firm_id, COALESCE(p_filters -> 'filters', '[]'::jsonb), (now() AT TIME ZONE tz)::date);
  search_in := p_filters ->> 'search';
  IF p_ids IS NOT NULL THEN
    -- An id that is not an account's id (another firm's, a made-up one, text) gives no row, like one that is not there.
    SELECT COALESCE(array_agg(i::uuid), '{}') INTO ids
    FROM jsonb_array_elements_text(p_ids) i
    WHERE i ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;
  RETURN QUERY
    SELECT jsonb_build_object(
      'name', r.name, 'trade_name', r.trade_name, 'website', r.website, 'city', r.city, 'state', r.state, 'employees', r.employees,
      'industry', r.industry, 'states_of_operation', NULLIF(array_to_string(r.states_of_operation, ', '), ''), 'current_provider', r.current_provider,
      'source', public.accounts_words('source', r.source), 'status', public.accounts_words('status', r.status), 'owner', r.owner_name,
      'main_contact', NULLIF(r.main_contact_name, ''), 'main_contact_email', r.main_contact_email, 'main_contact_phone', r.main_contact_phone,
      'opportunity', r.opportunity_name, 'opportunity_stage', public.accounts_words('stage', r.opportunity_stage), 'target_start', r.target_start,
      'open_opportunities', r.open_opportunities, 'quote_requests_sent', r.quote_requests_sent, 'quotes_received', r.quotes_received,
      'earliest_quote_expires_on', r.earliest_quote_expires_on, 'renewal_date', r.renewal_date, 'last_activity_at', r.last_activity_at, 'created_at', r.created_at, 'archived', r.archived)
    FROM public.accounts_rows(p_firm_id, search_in, ids) r
    WHERE CASE WHEN ids IS NULL THEN public.accounts_row_passes(r, checked, tz) ELSE public.accounts_row_filters_pass(r, checked, tz) END
    ORDER BY r.last_activity_at DESC NULLS LAST, r.id
    LIMIT p_limit;
END;
$$;
