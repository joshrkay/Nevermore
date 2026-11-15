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
--   * Every field rule is the database's (D-29). The phone is the repo's own rule, is_valid_phone (20261027090000: 7 to 15 digits, at most 50 characters, an
--     optional extension). A trigger on the account's phone asks it when the phone is made or CHANGED, never when it is left as it was, as validate_profile_phone
--     does for a profile: an account that kept an older-format phone can still have any other field saved, by update_account or by any other writer. A constraint
--     could not do that (even NOT VALID judges every later update of a row).
--   * account_owner_choices lists the people the maker may give an account to (the level rule above), for the form's Owner choice.
--
-- What is NOT here: the renewal date and the firm's own fields (D-186, CRM-X3.1), the warning for a likeness while typing (CRM-S4.2), and "Save and add a
-- contact" (CRM-A2.2).

-- ---------- 1. The phone rule ----------
-- An account's phone is judged when it is made or changed, by is_valid_phone (an empty phone is "not given"). A phone the row already had is left alone.
CREATE FUNCTION public.check_account_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;
  -- update_account trims what it saves, so " call me " kept and "call me" sent back are the same phone.
  IF TG_OP = 'UPDATE' AND btrim(NEW.phone) IS NOT DISTINCT FROM btrim(OLD.phone) THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_valid_phone(NEW.phone) THEN
    RAISE EXCEPTION 'Enter a phone number like (503) 555-0142. An extension can follow, like x12.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_account_phone() FROM PUBLIC, anon, authenticated, service_role;

-- The column's own length check (40, 20261119100000) is dropped: the repository's phone rule allows 50, and the trigger holds it.
ALTER TABLE public.accounts DROP CONSTRAINT accounts_phone_check;

CREATE TRIGGER accounts_phone_valid BEFORE INSERT OR UPDATE OF phone ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.check_account_phone();

-- ---------- 1b. The fields' check, without a length of its own for the phone ----------
-- Restated from 20261119140000 with every rule it had but the phone's length (40): the phone's whole rule, 50 characters included, is is_valid_phone's, asked by
-- the trigger above, so the save and the making never refuse a phone the repository's rule takes. Used by the save and by the making.
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

-- ---------- 2. Whom the maker may give an account to ----------
-- The firm's current people the caller may make an account for: those can_change_firm_record would let them change (an agent themselves, a lead themselves and
-- their teams and the teams under, an owner everyone). The same rule create_account asks, so the form never offers what the call would refuse.
CREATE FUNCTION public.account_owner_choices(p_firm_id uuid)
RETURNS TABLE (user_id uuid, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  RETURN QUERY
    SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text)
    FROM public.firm_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = firm AND public.membership_is_current(m.valid_from, m.valid_until) AND public.can_change_firm_record(firm, m.user_id)
    ORDER BY lower(public.person_display_name(u.raw_user_meta_data, u.email::text) COLLATE "und-x-icu"), m.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.account_owner_choices(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_owner_choices(uuid) TO authenticated;

-- ---------- 3. The making ----------
-- Makes an account of the firm the call acts for and answers its own fields (as the save's `record`: id, version 1, the fields, source Added by hand).
-- Refused, in this order: not a person of a firm (42501), not a member of the firm named (42501), a closing firm or Nevermore support (PT423), what is wrong
-- with a field, a phone included (22023), an owner who is not a current member of the firm (22023), an owner the level rule does not let the maker choose (42501).
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
  VALUES (firm, owner, name_in, trade_in, website_in, phone_in, street_in, city_in, state_in, postal_in, industry_in, p_employees, states_in, provider_in, 'added_by_hand')
  RETURNING * INTO made;
  RETURN public.crm_account_fields(made);
END;
$$;

REVOKE ALL ON FUNCTION public.create_account(text, text, text, text, text, text, text, text, text, integer, text[], text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_account(text, text, text, text, text, text, text, text, text, integer, text[], text, uuid, uuid) TO authenticated;
