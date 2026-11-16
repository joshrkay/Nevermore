-- New quote's step 1 makes the account (story CRM-Q2.1, slice 5.4; docs/BROKER_CRM_BUILD.md D-211, D-1709, D-1760).
--
-- create_account (20261119150000, its newest definition) learns where an account came from: a last parameter p_source, 'added_by_hand' unless said, which
-- New quote sets to 'new_quote' (D-211 left "later New quote" for this story). Restated with every line it had; only the source is new. The old
-- fourteen-argument function is dropped, so there is one create_account and every existing call (which names fourteen arguments) still means Added by hand.

DROP FUNCTION public.create_account(text, text, text, text, text, text, text, text, text, integer, text[], text, uuid, uuid);

CREATE FUNCTION public.create_account(
  p_name text, p_trade_name text, p_website text, p_phone text, p_street text, p_city text, p_state text, p_postal_code text, p_industry text,
  p_employees integer, p_states_of_operation text[], p_current_provider text, p_owner_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL, p_source text DEFAULT 'added_by_hand')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  owner uuid;
  name_in text := NULLIF(btrim(p_name), '');
  trade_in text := NULLIF(btrim(p_trade_name), '');
  website_in text := NULLIF(btrim(p_website), '');
  phone_in text := NULLIF(btrim(p_phone), '');
  street_in text := NULLIF(btrim(p_street), '');
  city_in text := NULLIF(btrim(p_city), '');
  state_in text := upper(NULLIF(btrim(p_state), ''));
  postal_in text := NULLIF(btrim(p_postal_code), '');
  industry_in text := NULLIF(btrim(p_industry), '');
  provider_in text := NULLIF(btrim(p_current_provider), '');
  states_in text[];
  problem text;
  made public.accounts;
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  -- The states of operation are state codes in capitals, each once, in the order sent (as the save does).
  SELECT COALESCE(array_agg(s ORDER BY first_at), '{}') INTO states_in
  FROM (SELECT upper(btrim(x)) AS s, min(n) AS first_at FROM unnest(COALESCE(p_states_of_operation, '{}')) WITH ORDINALITY AS u (x, n) GROUP BY upper(btrim(x))) d;
  problem := public.account_input_error(name_in, trade_in, website_in, phone_in, street_in, city_in, state_in, postal_in, industry_in, p_employees, states_in, provider_in);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  -- The source is the product's, never free text (D-211): a member's account is Added by hand, or New quote when step 1 of New quote makes it. The others
  -- (the employer's intake, a lead, an import) are set by their own paths.
  IF p_source IS NULL OR p_source NOT IN ('added_by_hand', 'new_quote') THEN
    RAISE EXCEPTION 'An account''s source is Added by hand or New quote here.' USING ERRCODE = '22023';
  END IF;
  -- The owner is the maker unless they choose another (D-214).
  -- The owner's membership is locked FOR SHARE until the end of this transaction (not KEY SHARE: removing or suspending a person is a non-key UPDATE of this row,
  -- which does not conflict with KEY SHARE). A removal then either committed first, and the owner is no longer current here, or waits for this making to commit.
  -- remove_member and suspend_member lock this row FOR UPDATE and then the firm's row (keep_firm_owner); this takes only this one row before it writes, so no
  -- cycle can form with them.
  owner := COALESCE(p_owner_id, auth.uid());
  IF owner IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = owner AND public.membership_is_current(m.valid_from, m.valid_until) FOR SHARE) THEN
    RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_change_firm_record(firm, owner) THEN
    RAISE EXCEPTION 'You can make an account only for yourself and, as a lead, for people on your teams.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.accounts (firm_id, owner_id, name, trade_name, website, phone, street, city, state, postal_code, industry, employees, states_of_operation,
    current_provider, source)
  VALUES (firm, owner, name_in, trade_in, website_in, phone_in, street_in, city_in, state_in, postal_in, industry_in, p_employees, states_in, provider_in, p_source)
  RETURNING * INTO made;
  RETURN public.crm_account_fields(made);
END;
$$;

REVOKE ALL ON FUNCTION public.create_account(text, text, text, text, text, text, text, text, text, integer, text[], text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_account(text, text, text, text, text, text, text, text, text, integer, text[], text, uuid, uuid, text) TO authenticated;
