-- Creating a lead (story CRM-L1.2a, slice 8.2, #189, screen 21; docs/BROKER_CRM_BUILD.md D-803, D-804, D-809; supabase/tests/create_lead.sql).
--
-- The one function that makes a lead by hand: create_lead(...). It asks, in this order and the way every write of the firm's records does (create_account,
-- 20261119150000): require_advisor (a person of a firm or a platform role), firm_to_act_for (the firm the call acts for), assert_firm_writable (a closing firm
-- and a Nevermore support session are refused, ADR 0023 and ADR 0024); then what is wrong with the fields, in words; then who the owner is.
--
--   * The name is required: the person's, or the business's when no person is known (CRM-L1.2).
--   * The owner is the maker unless they choose another, by the level rule (D-209, D-809): the same people account_owner_choices lists, so the form's Owner
--     choice is that list.
--   * The source is Added by hand and is not a parameter (D-804); the status is New (D-808). Every lead starts New, whoever made it.
--
-- What is NOT here: the firm's own fields (Epic 9, D-805), and "Save and add another", which is the form's (it calls this again).

-- ---------- 1. What is wrong with a lead's fields, in words ----------
-- NULL when nothing is. The values are already trimmed (empty is not given) and the state in capitals. Used by the making, and by the save (slice 8.5).
CREATE FUNCTION public.lead_input_error(
  p_name text, p_title text, p_business text, p_email text, p_phone text, p_city text, p_state text, p_employees integer, p_current_provider text, p_note text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_name IS NULL THEN 'Enter a name: the person''s, or the business''s when you don''t know who to speak to.'
    WHEN char_length(p_name) > 200 THEN 'A name is at most 200 characters.'
    WHEN char_length(p_title) > 200 THEN 'A title is at most 200 characters.'
    WHEN char_length(p_business) > 200 THEN 'A business name is at most 200 characters.'
    WHEN p_email IS NOT NULL AND (char_length(p_email) > 254 OR p_email !~ '^[^\s@<>,;"()\[\]\\]+@[^\s@<>,;"()\[\]\\]+\.[^\s@<>,;"()\[\]\\]+$')
      THEN 'Enter an email address like name@example.com.'
    WHEN p_phone IS NOT NULL AND NOT public.is_valid_phone(p_phone) THEN 'Enter a phone number like (503) 555-0142. An extension can follow, like x12.'
    WHEN char_length(p_city) > 100 THEN 'A city is at most 100 characters.'
    WHEN p_state IS NOT NULL AND NOT public.is_us_state_code(p_state) THEN 'Choose a state.'
    WHEN p_employees < 0 THEN 'Employees can''t be fewer than none.'
    WHEN char_length(p_current_provider) > 200 THEN 'A current provider is at most 200 characters.'
    WHEN char_length(p_note) > 5000 THEN 'A note is at most 5,000 characters.'
  END
$$;

REVOKE ALL ON FUNCTION public.lead_input_error(text, text, text, text, text, text, text, integer, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- The lead's own fields, as the making and the page answer them. Internal.
CREATE FUNCTION public.crm_lead_fields(l public.leads)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', l.id, 'version', l.version, 'owner_id', l.owner_id, 'name', l.name, 'title', l.title, 'business', l.business, 'email', l.email, 'phone', l.phone,
    'city', l.city, 'state', l.state, 'employees', l.employees, 'current_provider', l.current_provider, 'note', l.note, 'source', l.source,
    'status', l.status, 'not_fit_reason', l.not_fit_reason, 'created_at', l.created_at, 'updated_at', l.updated_at)
$$;

REVOKE ALL ON FUNCTION public.crm_lead_fields(public.leads) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The making ----------
-- Makes a lead of the firm the call acts for and answers its own fields. Refused, in this order: not a person of a firm (42501), not a member of the firm named
-- (42501), a closing firm or Nevermore support (PT423), what is wrong with a field (22023), an owner who is not a current member of the firm (22023), an owner
-- the level rule does not let the maker choose (42501).
CREATE FUNCTION public.create_lead(
  p_name text, p_title text DEFAULT NULL, p_business text DEFAULT NULL, p_email text DEFAULT NULL, p_phone text DEFAULT NULL, p_city text DEFAULT NULL,
  p_state text DEFAULT NULL, p_employees integer DEFAULT NULL, p_current_provider text DEFAULT NULL, p_note text DEFAULT NULL, p_owner_id uuid DEFAULT NULL,
  p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  owner uuid;
  name_in text := NULLIF(btrim(p_name), '');
  title_in text := NULLIF(btrim(p_title), '');
  business_in text := NULLIF(btrim(p_business), '');
  email_in text := NULLIF(btrim(p_email), '');
  phone_in text := NULLIF(btrim(p_phone), '');
  city_in text := NULLIF(btrim(p_city), '');
  state_in text := upper(NULLIF(btrim(p_state), ''));
  provider_in text := NULLIF(btrim(p_current_provider), '');
  note_in text := NULLIF(btrim(p_note), '');
  problem text;
  made public.leads;
BEGIN
  PERFORM public.require_advisor();
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  problem := public.lead_input_error(name_in, title_in, business_in, email_in, phone_in, city_in, state_in, p_employees, provider_in, note_in);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  -- The owner is the maker unless they choose another; their membership is held FOR SHARE to the end, as create_account holds it.
  owner := COALESCE(p_owner_id, auth.uid());
  IF owner IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = owner AND public.membership_is_current(m.valid_from, m.valid_until) FOR SHARE) THEN
    RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_change_firm_record(firm, owner) THEN
    RAISE EXCEPTION 'You can make a lead only for yourself and, as a lead, for people on your teams.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.leads (firm_id, owner_id, name, title, business, email, phone, city, state, employees, current_provider, note, source)
  VALUES (firm, owner, name_in, title_in, business_in, email_in, phone_in, city_in, state_in, p_employees, provider_in, note_in, 'added_by_hand')
  RETURNING * INTO made;
  RETURN public.crm_lead_fields(made);
END;
$$;

REVOKE ALL ON FUNCTION public.create_lead(text, text, text, text, text, text, text, integer, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_lead(text, text, text, text, text, text, text, integer, text, text, uuid, uuid) TO authenticated;
