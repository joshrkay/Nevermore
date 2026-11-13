-- A second factor for password sign-ins (story CRM-P1.3b, decision D-19).
--
-- A sign-in that used a password gets advisor or admin access only once a second factor has been
-- completed in the same session (the token's assurance level is aal2). A sign-in through Google or
-- Microsoft relies on that provider and needs none. The rule is read from the token's own claims, which
-- Supabase Auth signs: `amr` lists how this sign-in began and `aal` is its level. It is "this sign-in used
-- a password", not "this account has a second factor", so an account that signs in another way is not asked.
--
-- Prospects and guests are never asked: nothing here reads them.
-- Until firms exist, "a firm's data" is what an advisor can open. The firm-scoping story (CRM-P2.1a) must
-- carry this same check into its membership helper.

CREATE OR REPLACE FUNCTION public.second_factor_rule_met()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NOT jsonb_path_exists(COALESCE(auth.jwt(), '{}'::jsonb), '$.amr[*] ? (@.method == "password")')
      OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

REVOKE ALL ON FUNCTION public.second_factor_rule_met() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.second_factor_rule_met() TO anon, authenticated;

-- A signed-in person, not a guest: the preamble every role check shares. It reads only the caller's own token.
CREATE OR REPLACE FUNCTION public.is_signed_in_person()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

REVOKE ALL ON FUNCTION public.is_signed_in_person() FROM PUBLIC, anon, authenticated;

-- Every role check that reads the caller's token (is_advisor, require_advisor and the admin-only functions and
-- policies all end here) now also asks for the second factor. A role granted to the account is not enough on its own.
-- The held-mail and mailbox functions run as the service role and cannot read the caller's token, so they ask
-- is_advisor() or has_role('admin') with the caller's own login before doing any work (their handlers do).
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_signed_in_person()
    AND public.second_factor_rule_met()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role);
$$;

REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO anon, authenticated;

-- True when the caller holds the advisor or admin role and is held back only by the second factor: a
-- password sign-in that has not completed one. The sign-in screens use it to send that person to set one
-- up, or to enter their code, and never ask anyone without a role. Guests and signed-out callers get false.
CREATE OR REPLACE FUNCTION public.advisor_needs_second_factor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_signed_in_person()
    AND NOT public.second_factor_rule_met()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.advisor_needs_second_factor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_needs_second_factor() TO authenticated;
