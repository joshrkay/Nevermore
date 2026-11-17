-- What the employer sees when a broker invited them to finish an intake (CRM-Q2.3, slice 5.6; docs/BROKER_CRM_BUILD.md D-1880..D-1889).
--
-- Most of the story is already built (D-1763): the firm's name and the line that the firm sees the answers on the first screen (5.2), "Your broker entered this" and its
-- confirmation (5.3), the employer's own certification, the PEO boxes (6.6a) and the refusal of a firm member's certification (D-1753). The gap is the person: the employer is
-- told which firm sees their intake but not who in it invited them. An employer can read neither a firm nor its invitations, so the database says it.

-- ---------- 1. The employer's view names who invited them ----------
-- my_intake_firms restated from its only definition (20261123200000_employer_ends_access.sql) with every line kept, and two columns added: who invited the caller (the member who
-- first invited them, by name as the workspace shows it, D-42; null for an intake that was started at the firm's link and never invited) and when. The columns of a function's
-- result can't be changed in place, so it is dropped and made again with the same grants.
DROP FUNCTION public.my_intake_firms();
CREATE FUNCTION public.my_intake_firms()
RETURNS TABLE (session_id uuid, firm_name text, company text, invited_by_name text, invited_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, f.name, NULLIF(btrim(s.chamber_data ->> 'company_name'), ''), v.invited_by_name, v.invited_at
  FROM public.chamber_sessions s
  JOIN public.firms f ON f.id = s.firm_id
  LEFT JOIN LATERAL (
    -- The first link made for the intake: Remind's later links name whoever reminded, not who invited.
    SELECT public.person_display_name(u.raw_user_meta_data, u.email::text) AS invited_by_name, i.invited_at
    FROM public.intake_invitations i
    LEFT JOIN auth.users u ON u.id = i.invited_by
    WHERE i.intake_id = s.id AND i.firm_id = s.firm_id
    ORDER BY i.created_at, i.id
    LIMIT 1
  ) v ON true
  WHERE auth.uid() IS NOT NULL AND s.user_id = auth.uid() AND s.firm_id <> public.default_firm_id()
$$;

REVOKE ALL ON FUNCTION public.my_intake_firms() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.my_intake_firms() TO authenticated;

-- ---------- 2. The invitation's page names who invited them ----------
-- peek_intake_invite restated from its only definition (20261123120000_broker_intake.sql) with every line kept, and one column added: the member who first invited them, by name
-- (person_display_name, D-42: the name in their sign-up, else their email, else "A member"). The page is shown to a visitor who holds the link, who was sent it by that member.
-- Dropped and made again for the new column, with the same grants.
DROP FUNCTION public.peek_intake_invite(text, text);
CREATE FUNCTION public.peek_intake_invite(p_token_hash text, p_firm_address text)
RETURNS TABLE (firm_name text, contact_name text, expires_at timestamptz, invited_by_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inv public.intake_invitations;
  f public.firms;
  inviter text;
BEGIN
  SELECT * INTO inv FROM public.intake_invitations v WHERE v.token_hash = p_token_hash FOR UPDATE;
  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'This invitation link is not valid' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.id = inv.firm_id;
  IF f.address IS DISTINCT FROM lower(btrim(COALESCE(p_firm_address, ''))) THEN
    RAISE EXCEPTION 'This invitation belongs to another firm''s address' USING ERRCODE = 'PT422';
  END IF;
  IF inv.status = 'replaced' THEN
    RAISE EXCEPTION 'This link was replaced by a newer one. Use the latest email.' USING ERRCODE = 'PT410';
  ELSIF inv.status = 'withdrawn' THEN
    RAISE EXCEPTION 'This invitation was withdrawn' USING ERRCODE = 'PT410';
  ELSIF inv.status = 'accepted' THEN
    RAISE EXCEPTION 'This invitation has already been used' USING ERRCODE = 'PT410';
  ELSIF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired' USING ERRCODE = 'PT410';
  END IF;
  UPDATE public.intake_invitations v SET last_opened_at = now() WHERE v.id = inv.id;
  -- The first link made for the intake, as my_intake_firms has it: Remind's later links name whoever reminded.
  SELECT public.person_display_name(u.raw_user_meta_data, u.email::text) INTO inviter
  FROM public.intake_invitations i
  LEFT JOIN auth.users u ON u.id = i.invited_by
  WHERE i.intake_id = inv.intake_id AND i.firm_id = inv.firm_id
  ORDER BY i.created_at, i.id
  LIMIT 1;
  RETURN QUERY SELECT f.name, inv.contact_name, inv.expires_at, inviter;
END;
$$;

REVOKE ALL ON FUNCTION public.peek_intake_invite(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_intake_invite(text, text) TO anon, authenticated;
