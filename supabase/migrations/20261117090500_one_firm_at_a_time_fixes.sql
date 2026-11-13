-- One firm at a time, the follow-up (story CRM-S1.1b; ADR 0016). 20261117090000_one_firm_at_a_time.sql is merged and stays
-- as it is; this file replaces two of its functions and one function it relied on.
--
--   * address_admits_firm(): firm_role() runs once per row of every firm rule and asks it, and it parsed the whole
--     request.headers JSON twice per call (through request_firm_address()), with or without an address: every firm read was
--     about 60% slower. It now reads the headers once per call and returns at once when a request has none. Behaviour is
--     the same, including headers that are not JSON being refused (22P02), whatever their text says. request_firm_address()
--     is no longer called by anything and is dropped.
--   * my_firms(): also says which of the caller's firms were refused, so "Choose a firm" leaves a refused firm out instead
--     of linking to an address that shows nothing (D-31). Still never narrowed by the address (D-40).

-- Does the request's firm address admit a row of this firm? Yes when the request carries no address: no headers at all (a
-- job, the service role's own connection), headers without the address, or an empty one, as before. Otherwise only for the
-- one firm that holds the address, read as the database reads one (lower case, no surrounding spaces), and is not refused
-- (D-31). It narrows, never widens: firm_role() still asks for membership beside it. Headers that are not JSON raise 22P02,
-- so a request that can't be read is refused rather than taken as one with no address. Internal.
CREATE OR REPLACE FUNCTION public.address_admits_firm(p_firm_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  headers text := current_setting('request.headers', true);
  wanted text;
BEGIN
  IF headers IS NULL OR headers = '' THEN
    RETURN true;
  END IF;
  wanted := NULLIF(lower(btrim(headers::jsonb ->> 'x-firm-address')), '');
  IF wanted IS NULL THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.firms f
    WHERE f.id = p_firm_id
      AND f.address = wanted
      AND f.decision IS DISTINCT FROM 'refused'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.address_admits_firm(uuid) FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION public.request_firm_address();

-- The firms the caller currently belongs to (20261116210000), never narrowed by the address (D-40), now saying which of them
-- were refused. A refused firm is still the person's and its address stays taken (D-31), but that address shows nothing. The
-- return type changes, so the function is dropped and made again with the same body and grants. No function or policy
-- calls my_firms(); the browser does.
DROP FUNCTION public.my_firms();
CREATE FUNCTION public.my_firms()
RETURNS TABLE (firm_id uuid, name text, address text, role text, refused boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT f.id, f.name, f.address, m.role, f.decision IS NOT DISTINCT FROM 'refused'
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
