-- What an intake teaches its account (story CRM-Q1.2, slice 5.12; docs/BROKER_CRM_BUILD.md D-196, D-226, D-1715, D-1810..D-1819; ADR 0006, 0025).

-- The states of operation of certified answers as the account takes them: state codes only, each once, in the order given. {} when there are none. Pure.
CREATE FUNCTION public.crm_certified_states(p_data jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN jsonb_typeof(p_data -> 'states') = 'array' THEN
    COALESCE((SELECT array_agg(s.state ORDER BY s.first_at)
              FROM (SELECT x.state, min(x.at) AS first_at
                    FROM (SELECT e.value #>> '{}' AS state, e.at FROM jsonb_array_elements(p_data -> 'states') WITH ORDINALITY AS e (value, at)
                          WHERE jsonb_typeof(e.value) = 'string') x
                    WHERE public.is_us_state_code(x.state) GROUP BY x.state) s), '{}') ELSE '{}' END
$$;

REVOKE ALL ON FUNCTION public.crm_certified_states(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.teach_account_from_intake(p_intake_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  d jsonb;
  v_account uuid;
  v_firm uuid;
  v_user uuid;
  v_signer text;
  prof record;
  v_email text;
  v_names text[];
BEGIN
  SELECT o.account_id, o.firm_id, s.user_id INTO v_account, v_firm, v_user
  FROM public.opportunities o JOIN public.chamber_sessions s ON s.id = o.intake_id WHERE o.intake_id = p_intake_id;
  IF v_account IS NULL THEN
    RETURN;
  END IF;
  -- An archived account takes nothing new (D-222), so the intake teaches it nothing.
  IF EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = v_account AND a.archived_at IS NOT NULL) THEN
    RETURN;
  END IF;
  SELECT c.chamber_data, c.signer_name INTO d, v_signer FROM public.chamber_certifications c WHERE c.session_id = p_intake_id ORDER BY c.version DESC, c.id DESC LIMIT 1;
  -- Only a field that is empty and that the certification answers is written, and the row is written only if something in it changes: an account the
  -- certification has nothing to add to keeps its updated_at and its version (so certifying again changes nothing, and nobody mid-edit meets a conflict).
  WITH filled AS (
    SELECT x.id,
      COALESCE(x.industry, public.crm_answer_text(d, 'industry', 200)) AS industry,
      COALESCE(x.employees, CASE WHEN jsonb_typeof(d -> 'employee_count') = 'number' AND (d ->> 'employee_count') ~ '^[0-9]{1,9}$' THEN (d ->> 'employee_count')::integer END) AS employees,
      CASE WHEN cardinality(x.states_of_operation) = 0 THEN public.crm_certified_states(d) ELSE x.states_of_operation END AS states_of_operation,
      COALESCE(x.current_provider, CASE WHEN COALESCE((d ->> 'in_peo') <> 'false', true) THEN public.crm_answer_text(d, 'current_peo', 200) END) AS current_provider,
      COALESCE(x.street, public.crm_answer_text(d, 'street_address', 200)) AS street,
      COALESCE(x.state, CASE WHEN public.is_us_state_code(public.crm_answer_text(d, 'hq_state', 2)) THEN public.crm_answer_text(d, 'hq_state', 2) END) AS state,
      COALESCE(x.website, public.crm_answer_text(d, 'website', 300)) AS website
    FROM public.accounts x WHERE x.id = v_account)
  UPDATE public.accounts t SET industry = f.industry, employees = f.employees, states_of_operation = f.states_of_operation, current_provider = f.current_provider,
    street = f.street, state = f.state, website = f.website
  FROM filled f
  WHERE t.id = f.id
    AND (t.industry, t.employees, t.states_of_operation, t.current_provider, t.street, t.state, t.website)
        IS DISTINCT FROM (f.industry, f.employees, f.states_of_operation, f.current_provider, f.street, f.state, f.website);

  SELECT u.email::text AS email, p.contact_name, p.phone INTO prof
  FROM (SELECT 1) one LEFT JOIN auth.users u ON u.id = v_user LEFT JOIN public.profiles p ON p.user_id = v_user;
  v_email := CASE WHEN length(prof.email) <= 254 AND prof.email ~ '^[^@[:space:]]+@[^@[:space:]]+$' THEN prof.email END;
  v_names := public.crm_split_person_name(COALESCE(NULLIF(btrim(prof.contact_name), ''), v_signer));
  IF v_names IS NOT NULL AND (v_email IS NOT NULL OR NULLIF(btrim(prof.phone), '') IS NOT NULL)
     AND (v_email IS NULL OR NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.account_id = v_account AND lower(c.email) = lower(v_email))) THEN
    INSERT INTO public.contacts (firm_id, account_id, owner_id, first_name, last_name, email, phone, is_main, prospect_user_id)
    VALUES (v_firm, v_account, NULL, v_names[1], v_names[2], v_email, left(NULLIF(btrim(prof.phone), ''), 40), NOT EXISTS (SELECT 1 FROM public.contacts m WHERE m.account_id = v_account AND m.is_main), v_user)
    ON CONFLICT (account_id, prospect_user_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.teach_account_from_intake(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- chain_at_certification (20261119110000), as it was, with the teaching after the chain.
CREATE OR REPLACE FUNCTION public.chain_at_certification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'submitted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission) THEN
    PERFORM public.make_intake_chain(NEW.id);
    PERFORM public.teach_account_from_intake(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.chain_at_certification() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.account_intake_says(p_firm_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a public.accounts;
  d jsonb;
  v_employees integer;
  v_provider text;
  v_state text;
BEGIN
  IF p_firm_id IS NULL OR p_account_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = p_firm_id;
  -- One answer, nothing, for an account that is not there and one the caller may not see (the level rule, as the account's page).
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RETURN NULL;
  END IF;
  SELECT c.chamber_data INTO d
  FROM public.opportunities o JOIN public.chamber_certifications c ON c.session_id = o.intake_id
  WHERE o.account_id = a.id AND c.superseded_at IS NULL ORDER BY c.recorded_at DESC, c.id DESC LIMIT 1;
  v_employees := CASE WHEN jsonb_typeof(d -> 'employee_count') = 'number' AND (d ->> 'employee_count') ~ '^[0-9]{1,9}$' THEN (d ->> 'employee_count')::integer END;
  v_provider := CASE WHEN COALESCE((d ->> 'in_peo') <> 'false', true) THEN public.crm_answer_text(d, 'current_peo', 200) END;
  v_state := CASE WHEN public.is_us_state_code(public.crm_answer_text(d, 'hq_state', 2)) THEN public.crm_answer_text(d, 'hq_state', 2) END;
  RETURN jsonb_strip_nulls(jsonb_build_object(
    'industry', CASE WHEN lower(public.crm_answer_text(d, 'industry', 200)) IS DISTINCT FROM lower(btrim(a.industry)) THEN public.crm_answer_text(d, 'industry', 200) END,
    'name', CASE WHEN lower(public.crm_answer_text(d, 'company_name', 200)) IS DISTINCT FROM lower(btrim(a.name)) THEN public.crm_answer_text(d, 'company_name', 200) END,
    'street', CASE WHEN lower(public.crm_answer_text(d, 'street_address', 200)) IS DISTINCT FROM lower(btrim(a.street)) THEN public.crm_answer_text(d, 'street_address', 200) END,
    'current_provider', CASE WHEN lower(v_provider) IS DISTINCT FROM lower(btrim(a.current_provider)) THEN v_provider END,
    'state', CASE WHEN v_state IS DISTINCT FROM a.state THEN v_state END,
    'website', CASE WHEN lower(public.crm_answer_text(d, 'website', 300)) IS DISTINCT FROM lower(btrim(a.website)) THEN public.crm_answer_text(d, 'website', 300) END,
    'employees', CASE WHEN a.employees IS DISTINCT FROM v_employees THEN v_employees END,
    'states_of_operation', CASE WHEN cardinality(public.crm_certified_states(d)) > 0 AND NOT (public.crm_certified_states(d) <@ a.states_of_operation AND public.crm_certified_states(d) @> a.states_of_operation)
      THEN to_jsonb(public.crm_certified_states(d)) END));
END;
$$;

REVOKE ALL ON FUNCTION public.account_intake_says(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_intake_says(uuid, uuid) TO authenticated;
