-- One firm at a time (story CRM-S1.1b; docs/BROKER_CRM_BUILD.md D-18, D-27, D-31, D-40; ADR 0016).
--
-- Until now every table and function answered a person for every firm they currently belong to, so a member of two firms saw
-- both firms' rows mixed in every list, and the console kept such a person out (ADR 0014, the membership ADR). At a firm's address the browser now
-- sends that address with every request to the database, in the header x-firm-address, which PostgREST hands the database as
-- request.headers. The membership helper firm_role(), which is_firm_member(), can_see_firm_record() and every firm rule are
-- built on, then also requires that the firm asked about is that address's firm.
--
-- The address only narrows. Membership is still the lock (D-18): a header can be sent by anyone who can make a request, so it
-- never grants anything. At another firm's address a member reads nothing of that firm and nothing of their own; at an address
-- no firm holds, or a refused firm's (D-27, D-31), nothing at all. A request with no address (the bare domain, the service
-- role, a scheduled job, a server function that does not pass the header on) behaves exactly as before.
--
-- What this file changes, and why each:
--   * address_admits_firm(): reads the address from the request and says whether it admits a firm.
--   * firm_role(): asks address_admits_firm() too. Every firm rule and every function that asks is_firm_member(),
--     intake_in_my_firm(), can_see_firm_record() or firm_to_act_for() is narrowed through it, so a write "for the caller's
--     firm" (firm_to_act_for) at firm B's address acts for B and never for A.
--   * my_owner_firms(): the firms the caller owns, narrowed the same way, so a page at an address offers only that address's
--     firm (the firm's record of who did what is read through firm_role, so offering another firm there offered a refusal).
--     my_firms(), the list of a person's own firms, is NOT narrowed (D-40): the "Choose a firm" page and the address guard read it.
--   * admin_decide_firm(): asked is_firm_member() to REFUSE a platform admin deciding on a firm they belong to. Narrowed, that
--     answer turns false at any other address, which would have let such an admin approve their own firm by sending another
--     firm's address. It now asks the caller's memberships themselves, whatever the address.
-- Left as they were, because the address must not change them: my_firms(), is_member_of_firm_address() (asked about the
-- address the screen is at), require_advisor() and advisor_needs_second_factor() (whether the person may use the console at
-- all, and what holds them back; every row behind the console is narrowed), the service role's functions that take an actor
-- (held mail, mailboxes, alert recipients), and the triggers that stamp a firm's record.

-- Does the request's firm address admit a row of this firm? Yes when the request carries no address: no headers at all (a
-- job, the service role's own connection), headers without the address, or an empty one, as before this story. Otherwise only
-- for the one firm that holds the address, read as the database reads one (lower case, no surrounding spaces), and is not
-- refused (D-31: a refused firm's address is no firm's). It narrows, never widens: a caller must still be a member, which
-- firm_role() asks beside it. Headers that are not JSON raise an error (22P02), so a request that can't be read is refused
-- rather than taken as one with no address. firm_role() runs once per row of every firm rule, so the headers are read once
-- per call and a request without them returns at once. Internal.
CREATE FUNCTION public.address_admits_firm(p_firm_id uuid)
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

-- The caller's role in a firm today, for a sign-in that meets the second-factor rule (20261116110000), now only for the firm
-- of the address the request was made at, when it was made at one.
CREATE OR REPLACE FUNCTION public.firm_role(p_firm_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.firm_memberships m
  WHERE auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND public.second_factor_rule_met()
    AND m.firm_id = p_firm_id
    AND m.user_id = auth.uid()
    AND public.membership_is_current(m.valid_from, m.valid_until)
    AND public.address_admits_firm(p_firm_id)
$$;

-- The firms the caller currently owns (20261116160001), at a firm's address only that firm.
CREATE OR REPLACE FUNCTION public.my_owner_firms()
RETURNS TABLE (firm_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT f.id, f.name
  FROM public.current_owner_firm_ids() o
  JOIN public.firms f ON f.id = o.firm_id
  WHERE public.is_signed_in_person()
    AND public.second_factor_rule_met()
    AND public.address_admits_firm(f.id)
  ORDER BY f.name, f.id
$$;

-- A platform admin approves or refuses a waiting firm (20261116170000). "An admin does not decide on a firm they belong to" asks
-- the caller's own current memberships, whatever address the request was made at: a narrowed answer would say "not a member"
-- at another firm's address and let them decide on their own firm.
CREATE OR REPLACE FUNCTION public.admin_decide_firm(p_firm_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  f public.firms;
  note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_approve IS NULL THEN
    RAISE EXCEPTION 'Approve the firm or refuse it' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO f FROM public.firms WHERE id = p_firm_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  -- An admin does not decide on a firm they belong to.
  IF EXISTS (SELECT 1 FROM public.current_member_firm_ids() c WHERE c.firm_id = p_firm_id) THEN
    RAISE EXCEPTION 'An admin does not decide on a firm they belong to' USING ERRCODE = '42501';
  END IF;
  IF f.approved_at IS NOT NULL OR f.decision IS NOT NULL THEN
    RAISE EXCEPTION 'That firm has been decided already' USING ERRCODE = '55000';
  END IF;
  UPDATE public.firms
  SET approved_at = CASE WHEN p_approve THEN now() END,
      decision = CASE WHEN p_approve THEN 'approved' ELSE 'refused' END,
      decided_at = now(), decided_by = auth.uid(), decision_note = note
  WHERE id = p_firm_id;
  PERFORM public.record_firm_event(p_firm_id, CASE WHEN p_approve THEN 'firm_approved' ELSE 'firm_refused' END,
                                   auth.uid(), jsonb_build_object('address', f.address, 'note', note));
END;
$$;
