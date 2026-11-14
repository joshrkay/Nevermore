-- Join by organisation, fixes after review (story CRM-P1.4; docs/BROKER_CRM_BUILD.md D-16, D-19, D-32, D-33, D-108 to D-112).
-- 20261118100000_join_by_organisation.sql is merged and stays as it is; this file restates three of its functions.
--
-- 0. A correction to that file's header. It says "the firm is taken from the address the person is at, which the database resolves
--    itself ... the browser names no firm". What is true: ask_to_join_firm(p_firm_address) is given the address the browser is at, as
--    accept_invitation is (D-34), and the database looks the firm up from it. The browser's word is therefore the address and nothing
--    more: it names no organisation (that is read from the caller's own sign-in claims in auth.identities, which the caller can't
--    write), and the address only chooses among firms. A person is listed only if their sign-in is from an organisation THAT firm lists,
--    so naming another firm's address gets them nothing: the same trust as an invitation link opened at an address.
--
-- 1. ask_to_join_firm now answers 'none', and writes no request and no entry, for:
--    * a caller who holds the platform `admin` role (D-33, D-16). Nothing proves a listed domain is the firm's own, so a firm could list
--      Nevermore's domain and learn staff emails from the list, and the record would show their id under "Nevermore". A platform admin
--      joins a firm only by an owner's invitation.
--    * a person whose membership of that firm has ended (removed or left; a suspension ends it too). Like a declined request it is final
--      for the automatic ask: an owner brings them back by invitation.
--    * a session that signed in with a password. The token's `amr` lists how this sign-in began (as the second-factor rule in
--      20261116150000 reads it): a password sign-in is vouched for by no provider, even when the account once linked a Google or
--      Microsoft identity. What the token does NOT say is which provider a provider sign-in used (Supabase puts only "oauth" in `amr`,
--      and app_metadata.provider is the account's first provider, not this sign-in's), so an account with both a Google and a
--      Microsoft identity is matched through either. That is left as it is, and not guessed.
-- 2. approve_join_request and decline_join_request close the request only while it is still open (`status = 'open'`), and treat no row
--    updated as the existing "already decided" refusal (PT410), which rolls back the membership approve had just made. That guard is the
--    rule that keeps approve and decline at the same moment from both winning (D-29, D-32); the row lock they took is gone, since a test
--    (supabase/tests/join_by_organisation.sql) passes with the guard alone and fails without it. remove_firm_organisation keeps its lock:
--    without it the second of two removals writes a second entry, and a two-session test goes red.
-- 3. approve_join_request returns the role the person now holds: the one chosen, or the one they already had when they had become a member
--    another way, so the owner is told the truth.

CREATE OR REPLACE FUNCTION public.ask_to_join_firm(p_firm_address text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  f public.firms;
  ident record;
  prov text;
  org text;
  hit public.firm_organisations;
  made uuid;
BEGIN
  IF NOT public.is_signed_in_person() THEN
    RETURN 'none';
  END IF;
  -- A sign-in made with a password is vouched for by no provider.
  IF jsonb_path_exists(COALESCE(auth.jwt(), '{}'::jsonb), '$.amr[*] ? (@.method == "password")') THEN
    RETURN 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = uid AND u.email_confirmed_at IS NOT NULL) THEN
    RETURN 'none';
  END IF;
  -- Nevermore's own people join a firm only by invitation (D-33): the role is read as the stamp on the firm's record reads it.
  IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = uid AND r.role = 'admin') THEN
    RETURN 'none';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.address = lower(btrim(COALESCE(p_firm_address, ''))) AND x.decision IS DISTINCT FROM 'refused';
  IF NOT FOUND OR public.firm_is_suspended(f.id) THEN
    RETURN 'none';
  END IF;
  -- A current member, a person suspended there, and anyone whose membership of this firm has ended.
  IF EXISTS (SELECT 1 FROM public.firm_memberships m
             WHERE m.firm_id = f.id AND m.user_id = uid AND (public.membership_is_current(m.valid_from, m.valid_until) OR m.valid_until <= now()))
     OR EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.firm_id = f.id AND s.user_id = uid AND s.ended_at IS NULL) THEN
    RETURN 'none';
  END IF;
  IF EXISTS (SELECT 1 FROM public.join_requests r WHERE r.firm_id = f.id AND r.user_id = uid AND r.status = 'open') THEN
    RETURN 'asked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.join_requests r WHERE r.firm_id = f.id AND r.user_id = uid AND r.status = 'declined') THEN
    RETURN 'none';
  END IF;
  FOR ident IN SELECT i.provider, i.identity_data FROM auth.identities i WHERE i.user_id = uid AND i.provider IN ('google', 'azure') ORDER BY i.created_at LOOP
    prov := CASE ident.provider WHEN 'google' THEN 'google' ELSE 'microsoft' END;
    org := public.identity_organisation(prov, ident.identity_data);
    CONTINUE WHEN org IS NULL;
    SELECT * INTO hit FROM public.firm_organisations o WHERE o.firm_id = f.id AND o.provider = prov AND o.org_id = org;
    CONTINUE WHEN NOT FOUND;
    INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label)
    VALUES (f.id, uid, prov, org, hit.label)
    ON CONFLICT (firm_id, user_id) WHERE status = 'open' DO NOTHING
    RETURNING id INTO made;
    IF made IS NOT NULL THEN
      PERFORM public.firm_activity_append(f.id, 'join_asked', 'firm', f.id::text, uid);
    END IF;
    RETURN 'asked';
  END LOOP;
  RETURN 'none';
END;
$$;

REVOKE ALL ON FUNCTION public.ask_to_join_firm(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ask_to_join_firm(text) TO authenticated;

-- The return type changes (void to text), so approve is dropped and made again with the same checks and grants.
DROP FUNCTION public.approve_join_request(uuid, text);
CREATE FUNCTION public.approve_join_request(p_request_id uuid, p_role text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req public.join_requests;
  have text;
  held text;
  closed integer;
BEGIN
  SELECT * INTO req FROM public.join_requests r WHERE r.id = p_request_id;
  IF NOT FOUND OR public.firm_role(req.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can approve a request' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = req.firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t take new members' USING ERRCODE = 'PT403';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('owner', 'lead', 'agent') THEN
    RAISE EXCEPTION 'Choose a role: owner, lead or agent' USING ERRCODE = '22023';
  END IF;
  IF req.status <> 'open' THEN
    RAISE EXCEPTION 'That request has already been decided' USING ERRCODE = 'PT410';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.firm_id = req.firm_id AND s.user_id = req.user_id AND s.ended_at IS NULL) THEN
    RAISE EXCEPTION 'That person is suspended at this firm. Lift the suspension instead.' USING ERRCODE = 'PT409';
  END IF;
  SELECT m.role INTO have FROM public.firm_memberships m
  WHERE m.firm_id = req.firm_id AND m.user_id = req.user_id AND public.membership_is_current(m.valid_from, m.valid_until) LIMIT 1;
  IF have IS NULL THEN
    INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (req.firm_id, req.user_id, p_role);
  END IF;
  held := COALESCE(have, p_role);
  -- Only an open request is closed. If someone decided it first (at the same moment), nothing is updated and the membership just made is
  -- rolled back with this refusal.
  UPDATE public.join_requests r
  SET status = 'approved', decided_by = auth.uid(), decided_at = now(), decided_role = held
  WHERE r.id = req.id AND r.status = 'open';
  GET DIAGNOSTICS closed = ROW_COUNT;
  IF closed = 0 THEN
    RAISE EXCEPTION 'That request has already been decided' USING ERRCODE = 'PT410';
  END IF;
  RETURN held;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_join_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_join_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req public.join_requests;
  closed integer;
BEGIN
  SELECT * INTO req FROM public.join_requests r WHERE r.id = p_request_id;
  IF NOT FOUND OR public.firm_role(req.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can decline a request' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = req.firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t take new members' USING ERRCODE = 'PT403';
  END IF;
  IF req.status <> 'open' THEN
    RAISE EXCEPTION 'That request has already been decided' USING ERRCODE = 'PT410';
  END IF;
  UPDATE public.join_requests r SET status = 'declined', decided_by = auth.uid(), decided_at = now() WHERE r.id = req.id AND r.status = 'open';
  GET DIAGNOSTICS closed = ROW_COUNT;
  IF closed = 0 THEN
    RAISE EXCEPTION 'That request has already been decided' USING ERRCODE = 'PT410';
  END IF;
  PERFORM public.firm_activity_append(req.firm_id, 'join_declined', 'firm', req.firm_id::text, req.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.decline_join_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_join_request(uuid) TO authenticated;
