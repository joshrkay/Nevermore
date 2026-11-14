-- The firm address answers "are you a member?" before the second factor (story CRM-P2.1a, decisions D-19 and D-27).
--
-- is_member_of_firm_address() (20261116140000) asked is_firm_member(), which since the firm-scoping migration also asks
-- for the second factor: a member who signed in with a password and has none yet was answered "no" and shown "You aren't
-- a member of this firm" instead of the screen that sets one up. The question here is only whether the caller is a
-- current member of the firm at that address, whether or not the firm is approved; it reads the caller's own membership
-- and returns one boolean about the caller, never a firm's data, so it does not ask for the second factor. Every table
-- and storage policy still asks is_firm_member()/firm_role(), which do.
CREATE OR REPLACE FUNCTION public.is_member_of_firm_address(p_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.firms f
    JOIN public.firm_memberships m ON m.firm_id = f.id
    WHERE f.address = lower(btrim(p_address))
      AND auth.uid() IS NOT NULL
      AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      AND m.user_id = auth.uid()
      AND public.membership_is_current(m.valid_from, m.valid_until)
  )
$$;

REVOKE ALL ON FUNCTION public.is_member_of_firm_address(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member_of_firm_address(text) TO authenticated;
