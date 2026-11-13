-- The console asks "is a current member of a firm", not "is an advisor" (story P-1.4; docs/BROKER_CRM_BUILD.md D-15, D-16, D-18, D-19).
--
-- Until now the console opened for the platform roles advisor and admin. A person who signs a firm up, or is invited to one,
-- holds neither, and a platform admin (who belongs to no firm, D-16) held the console though every function already
-- answers them with no firm's rows. This migration lets the screens ask the question the database asks (a current
-- membership), and makes the role check agree with it:
--   * my_firms(): the firms the caller currently belongs to and their role in each, for the screens to decide what to show.
--     It tells nothing to a guest, a stranger, or a password sign-in that still owes its second factor (D-19).
--   * require_advisor(), the first line of every console function: a current member of a firm passes it, whether or not
--     they hold a platform role. Each of those functions filters by the row's firm (20261116180000), so this lets a member
--     in and shows them nothing outside their firm. is_advisor() is NOT widened: it still means the platform role, which is
--     what keeps the PEO catalogue, its contacts and the other platform-wide reads to people who hold it (the isolation
--     matrix in data_isolation.sql proves a member with no role reads none of them). The two referral-partner functions
--     are platform-wide until CRM-P2.1c scopes them, so they now ask for the role themselves rather than the membership.
--   * advisor_needs_second_factor(): a current member is sent to the second factor as a role holder or an owner is.
-- The address a person is at never enters here: no firm is taken from the caller (D-18).

-- Every current membership of the caller, whatever sign-in they hold: the one place "the caller currently belongs to this
-- firm" is written for the second-factor question, which must be answerable before the factor is done. Internal.
CREATE FUNCTION public.current_member_firm_ids()
RETURNS TABLE (firm_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.firm_id
  FROM public.firm_memberships m
  WHERE m.user_id = auth.uid()
    AND public.membership_is_current(m.valid_from, m.valid_until)
$$;

REVOKE ALL ON FUNCTION public.current_member_firm_ids() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.my_firms()
RETURNS TABLE (firm_id uuid, name text, address text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT f.id, f.name, f.address, m.role
  FROM public.firm_memberships m
  JOIN public.firms f ON f.id = m.firm_id
  WHERE m.user_id = auth.uid()
    AND public.membership_is_current(m.valid_from, m.valid_until)
    AND public.is_signed_in_person()
    AND public.second_factor_rule_met()
  ORDER BY f.name, f.id
$$;

REVOKE ALL ON FUNCTION public.my_firms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_firms() TO authenticated;

-- The caller is a signed-in person with a current membership in some firm and, for a password sign-in, the second factor
-- done. Internal: the console's functions ask it through require_advisor().
CREATE FUNCTION public.caller_is_firm_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_signed_in_person()
    AND public.second_factor_rule_met()
    AND EXISTS (SELECT 1 FROM public.current_member_firm_ids())
$$;

REVOKE ALL ON FUNCTION public.caller_is_firm_member() FROM PUBLIC, anon, authenticated, service_role;

-- The first line of every console function. The platform roles pass as before; so does a current member of a firm.
CREATE OR REPLACE FUNCTION public.require_advisor()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_advisor() OR public.caller_is_firm_member()) THEN
    RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Referral partners belong to the platform until CRM-P2.1c: they keep asking for the platform role, as before this file.
CREATE OR REPLACE FUNCTION public.advisor_add_referral_partner(p_code text, p_name text, p_kind text)
RETURNS public.referral_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_in text := lower(btrim(COALESCE(p_code, '')));
  problem text := public.referral_partner_input_error(p_name, p_kind);
  added public.referral_partners;
BEGIN
  IF NOT public.is_advisor() THEN
    RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE(public.is_source_code(code_in), false) THEN
    RAISE EXCEPTION 'A referral code is 1 to 64 lowercase letters, digits, dots, hyphens or underscores, starting with a letter or digit.'
      USING ERRCODE = '22023';
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.referral_partners (code, name, kind, created_by_email, updated_by_email)
  VALUES (code_in, btrim(p_name), p_kind, auth.jwt() ->> 'email', auth.jwt() ->> 'email')
  ON CONFLICT (code) DO NOTHING
  RETURNING * INTO added;
  IF added.code IS NULL THEN
    RAISE EXCEPTION 'The code % is already a partner''s. Choose another.', code_in USING ERRCODE = '23505', DETAIL = code_in;
  END IF;
  RETURN added;
END;
$$;

CREATE OR REPLACE FUNCTION public.advisor_update_referral_partner(p_code text, p_name text, p_kind text)
RETURNS public.referral_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  problem text := public.referral_partner_input_error(p_name, p_kind);
  changed public.referral_partners;
BEGIN
  IF NOT public.is_advisor() THEN
    RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  UPDATE public.referral_partners
  SET name = btrim(p_name), kind = p_kind, updated_at = now(), updated_by_email = auth.jwt() ->> 'email'
  WHERE code = lower(btrim(COALESCE(p_code, '')))
  RETURNING * INTO changed;
  IF changed.code IS NULL THEN
    RAISE EXCEPTION 'No partner has that code' USING ERRCODE = 'PT404';
  END IF;
  RETURN changed;
END;
$$;

-- A password sign-in that has not done its second factor is held back (D-19) for a platform role, for an owner and now for
-- any current member, who may hold no platform role. Anyone who holds neither a role nor a current membership is never asked.
CREATE OR REPLACE FUNCTION public.advisor_needs_second_factor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_signed_in_person()
    AND NOT public.second_factor_rule_met()
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.current_member_firm_ids())
    );
$$;
