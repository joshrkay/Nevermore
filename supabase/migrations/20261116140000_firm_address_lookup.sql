-- The firm address (story CRM-P1.3a; docs/BROKER_CRM_BUILD.md D-17, D-18, D-27).
--
-- A firm is reached at <address>.<the site's domain>. Two small functions answer the two questions the screen asks
-- there. Neither is the lock: row security and the membership helpers decide who reads what (D-18); these only
-- choose what the screen shows.
--
-- firm_public_name(address): what a person may be shown BEFORE signing in. The firm's name for any firm that exists,
-- approved or still waiting for approval (a waiting firm's members can work before approval; approval gates sending,
-- not signing in), and nothing only when no firm holds the address (D-27). Firms have no logo field yet; when one
-- exists it is added here, as part of what may be shown, and nothing else is.
--
-- is_member_of_firm_address(address): AFTER sign-in, whether the caller is a current member of the firm at that
-- address, approved or not: approval blocks sending, not a firm's own people working at its address (PRD 8.2). It
-- answers about the caller only, and needs no id: the screen never learns a firm's id from it.
CREATE FUNCTION public.firm_public_name(p_address text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.name
  FROM public.firms f
  WHERE f.address = lower(btrim(p_address))
$$;

CREATE FUNCTION public.is_member_of_firm_address(p_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.is_firm_member(f.id)
    FROM public.firms f
    WHERE f.address = lower(btrim(p_address))
  ), false)
$$;

REVOKE ALL ON FUNCTION public.firm_public_name(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_member_of_firm_address(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_public_name(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of_firm_address(text) TO authenticated;
