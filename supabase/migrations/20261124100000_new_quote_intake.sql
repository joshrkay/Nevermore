-- New quote step 2, the intake with Lenore (story CRM-Q2.2, slice 5.5; docs/BROKER_CRM_BUILD.md D-1750, D-1751, D-1763, D-1870..D-1879; ADR 0025).

-- start_broker_intake, restated from 20261123120000_broker_intake.sql (its only definition; every line kept), with one addition: what the account holds is written into the new intake as the
-- member's entry before they type anything (D-1870). Each fact is a broker entry (D-1710) naming the member and "inferred", so the employer's certification confirms it and nothing
-- counts as the employer's own before then. Answers {intake_id}.
CREATE OR REPLACE FUNCTION public.start_broker_intake(p_opportunity_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  o public.opportunities;
  a public.accounts;
  made uuid;
  facts jsonb := '{}'::jsonb;
  prov jsonb := '{}'::jsonb;
  k text;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO a FROM public.accounts x WHERE x.id = (SELECT p.account_id FROM public.opportunities p WHERE p.id = p_opportunity_id AND p.firm_id = firm) FOR SHARE;
  SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = firm FOR UPDATE;
  IF o.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing can be added to it.' USING ERRCODE = '55000';
  END IF;
  IF o.intake_id IS NOT NULL THEN
    RAISE EXCEPTION 'This opportunity already has an intake' USING ERRCODE = 'PT409';
  END IF;
  -- Only what the account holds: a blank field, an empty list and an account with no current provider write nothing (D-1870).
  facts := jsonb_strip_nulls(jsonb_build_object(
    'company_name', a.name, 'industry', NULLIF(btrim(a.industry), ''), 'employee_count', a.employees,
    'states', CASE WHEN COALESCE(cardinality(a.states_of_operation), 0) > 0 THEN to_jsonb(a.states_of_operation) END,
    'hq_state', NULLIF(btrim(a.state), ''), 'street_address', NULLIF(btrim(a.street), ''), 'website', NULLIF(btrim(a.website), ''),
    'current_peo', NULLIF(btrim(a.current_provider), ''), 'in_peo', CASE WHEN NULLIF(btrim(a.current_provider), '') IS NOT NULL THEN true END));
  FOR k IN SELECT key FROM jsonb_object_keys(facts) AS key LOOP
    prov := prov || jsonb_build_object(k, jsonb_build_object('status', 'inferred', 'source', jsonb_build_object('kind', 'broker_entry', 'member_id', auth.uid()),
                                                              'updated_at', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  END LOOP;
  INSERT INTO public.chamber_sessions (user_id, firm_id, started_by, chamber_data, field_provenance) VALUES (NULL, firm, auth.uid(), facts, prov) RETURNING id INTO made;
  UPDATE public.opportunities SET intake_id = made WHERE id = o.id;
  RETURN jsonb_build_object('intake_id', made);
END;
$$;

REVOKE ALL ON FUNCTION public.start_broker_intake(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_broker_intake(uuid, uuid) TO authenticated;
