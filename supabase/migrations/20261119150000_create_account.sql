-- Creating an account (story CRM-A1.2, screen 23; docs/BROKER_CRM_BUILD.md D-29, D-193, D-209, D-211, D-214, D-222, D-226, D-227, D-228;
-- 20261119100000_crm_records.sql, 20261119140000_account_page.sql).
--
-- What this is. The one function that makes an account by hand: create_account(...). It asks, in this order and the way every write of the firm's records
-- does, require_advisor (a person of a firm or a platform role), firm_to_act_for (the firm the call acts for), assert_firm_writable (a closing firm and a
-- Nevermore support session are refused, ADR 0023 and ADR 0024); then what is wrong with the fields, in words; then who the owner is.
--
--   * The owner is the maker unless they choose another (D-214). The one chosen must be a current member of the firm, and the level rule decides whether
--     the maker may hand the account to them (D-209, can_change_firm_record): an agent only to themselves, a lead to themselves and the people on their
--     teams and the teams under them, an owner to anyone in the firm. So the maker can always see what they made, and nobody makes a record they
--     could not then change.
--   * The source is Added by hand and is not a parameter (D-211); the version and the history of the making (record_track) are the table's.
--   * The same name, website or contact email as another account is never refused here: a likeness is a warning (D-193, CRM-S4.2), not a rule.
--   * Every field rule is the database's (D-29). The phone rule is new here and is also a check on the table, so no other writer can keep a phone that is not
--     one; the save of an account's own fields (update_account) asks it too, through account_input_error. The check is added NOT VALID: it holds for every
--     row written or changed from now on, and no existing row is judged by it.
--
-- What is NOT here: the renewal date and the firm's own fields (D-186, CRM-X3.1), the warning for a likeness while typing (CRM-S4.2), and "Save and add a
-- contact" (CRM-A2.2).

-- ---------- 1. The phone rule ----------
-- A phone number is 10 to 15 digits (a US number with its area code, or an international one with its country code), with only spaces, brackets, dots and
-- dashes between them, a plus only at the start, and, after it, an extension: "x" or "ext" with a "." and up to six digits ("(503) 555-0142 x12"). Pure.
CREATE FUNCTION public.crm_phone_ok(p_phone text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_phone IS NULL OR (
    p_phone ~* '^\+?[0-9 ().-]+(\s*(x|ext\.?)\s*[0-9]{1,6})?$'
    AND length(regexp_replace(regexp_replace(p_phone, '\s*(x|ext\.?)\s*[0-9]{1,6}$', '', 'i'), '[^0-9]', '', 'g')) BETWEEN 10 AND 15)
$$;

REVOKE ALL ON FUNCTION public.crm_phone_ok(text) FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.accounts ADD CONSTRAINT accounts_phone_format CHECK (public.crm_phone_ok(phone)) NOT VALID;

-- ---------- 2. The fields' check, with the phone ----------
-- Restated from 20261119140000 with every rule it had and the phone's. Used by the save and by the making.
CREATE OR REPLACE FUNCTION public.account_input_error(
  p_name text, p_trade_name text, p_website text, p_phone text, p_street text, p_city text, p_state text, p_postal_code text, p_industry text,
  p_employees integer, p_states_of_operation text[], p_current_provider text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_name IS NULL THEN 'Give the account a name.'
    WHEN char_length(p_name) > 200 THEN 'Keep the account''s name to 200 characters.'
    WHEN char_length(p_trade_name) > 200 THEN 'Keep the trade name to 200 characters.'
    WHEN char_length(p_website) > 300 THEN 'Keep the website to 300 characters.'
    WHEN char_length(p_phone) > 40 THEN 'Keep the phone number to 40 characters.'
    WHEN NOT public.crm_phone_ok(p_phone) THEN 'Enter a phone number like (503) 555-0142, with its area code. An extension can follow, like x12.'
    WHEN char_length(p_street) > 200 THEN 'Keep the street to 200 characters.'
    WHEN char_length(p_city) > 100 THEN 'Keep the city to 100 characters.'
    WHEN p_state IS NOT NULL AND NOT public.is_us_state_code(p_state) THEN 'Choose a state from the list.'
    WHEN char_length(p_postal_code) > 20 THEN 'Keep the postal code to 20 characters.'
    WHEN char_length(p_industry) > 200 THEN 'Keep the industry to 200 characters.'
    WHEN p_employees < 0 THEN 'Employees can''t be a negative number.'
    WHEN NOT public.crm_states_ok(p_states_of_operation) THEN 'Choose the states of operation from the list.'
    WHEN char_length(p_current_provider) > 200 THEN 'Keep the current provider to 200 characters.'
  END
$$;

REVOKE ALL ON FUNCTION public.account_input_error(text, text, text, text, text, text, text, text, text, integer, text[], text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. The making ----------
-- Makes an account of the firm the call acts for and answers its own fields (as the save's `record`: id, version 1, the fields, source Added by hand).
-- Refused, in this order: not a person of a firm (42501), not a member of the firm named (42501), a closing firm or Nevermore support (PT423), what is wrong
-- with a field (22023), an owner who is not a current member of the firm (22023), an owner the level rule does not let the maker choose (42501).
CREATE FUNCTION public.create_account(
  p_name text, p_trade_name text, p_website text, p_phone text, p_street text, p_city text, p_state text, p_postal_code text, p_industry text,
  p_employees integer, p_states_of_operation text[], p_current_provider text, p_owner_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
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
  -- The owner is the maker unless they choose another (D-214).
  owner := COALESCE(p_owner_id, auth.uid());
  IF owner IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = owner AND public.membership_is_current(m.valid_from, m.valid_until)) THEN
    RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_change_firm_record(firm, owner) THEN
    RAISE EXCEPTION 'You can make an account only for yourself and, as a lead, for people on your teams.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.accounts (firm_id, owner_id, name, trade_name, website, phone, street, city, state, postal_code, industry, employees, states_of_operation,
    current_provider, source)
  VALUES (firm, owner, name_in, trade_in, website_in, phone_in, street_in, city_in, state_in, postal_in, industry_in, p_employees, states_in, provider_in, 'added_by_hand')
  RETURNING * INTO made;
  RETURN public.crm_account_fields(made);
END;
$$;

REVOKE ALL ON FUNCTION public.create_account(text, text, text, text, text, text, text, text, text, integer, text[], text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_account(text, text, text, text, text, text, text, text, text, integer, text[], text, uuid, uuid) TO authenticated;
