-- Help from Nevermore, review fixes (story CRM-P2.4; docs/BROKER_CRM_BUILD.md D-24, D-33, D-104, D-122; ADR 0024; 20261118120000).
--
--   1. refuse_support_session(NULL) refuses a caller who holds ANY open support session, so a function that passes NULL fails closed.
--   2. can_see_firm_record gives 'support' what it gives an owner.
--   3. Becoming a member ends the person's open support session for that firm, in the same transaction: accept_invitation and
--      approve_join_request. The session is recorded as ended with the reason "became_member".
-- Every function below is restated from its latest definition with every rule it had.

-- 1. The refusal an export or a send calls first (20261118120000). With a firm: unchanged. With no firm (NULL, which a function that could
-- not find the firm would pass): it cannot say which firm, so it refuses a caller who holds any open, unexpired session at all. Refusing a
-- platform admin with a session somewhere costs nothing; refusing too little would let a support session export.
CREATE OR REPLACE FUNCTION public.refuse_support_session(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_firm_id IS NULL THEN
    IF auth.uid() IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.support_sessions s WHERE s.admin_id = auth.uid() AND s.ended_at IS NULL AND s.ends_at > now()) THEN
      RAISE EXCEPTION 'Nevermore support can look, not change' USING ERRCODE = 'PT423';
    END IF;
  ELSIF public.is_support_session(p_firm_id) THEN
    RAISE EXCEPTION 'Nevermore support can look, not change' USING ERRCODE = 'PT423';
  END IF;
END;
$$;

-- 2. May the caller see a record of this firm that this person owns? (20261116110000.) Support sees what an owner sees, at either setting
-- of the firm's visibility: it reads what an owner reads (ADR 0024), and the default 'by_level' would otherwise show it none of the firm's
-- leads and accounts once they use this. Every other rule is as it was: a current member sees the records of a firm whose visibility is
-- 'everyone' and the ones they own; a lead sees those of their team and the teams below it; nobody outside the firm sees any.
CREATE OR REPLACE FUNCTION public.can_see_firm_record(p_firm_id uuid, p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.firm_role(p_firm_id) IN ('owner', 'support'), false)
    OR (public.is_firm_member(p_firm_id) AND EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id AND f.visibility = 'everyone'))
    OR (public.is_firm_member(p_firm_id) AND p_owner_id IS NOT DISTINCT FROM auth.uid())
    OR (
      COALESCE(public.firm_role(p_firm_id) = 'lead', false)
      AND EXISTS (
        WITH RECURSIVE my_teams (id) AS (
          SELECT m.team_id
          FROM public.firm_memberships m
          WHERE m.firm_id = p_firm_id AND m.user_id = auth.uid() AND m.team_id IS NOT NULL
            AND public.membership_is_current(m.valid_from, m.valid_until)
          UNION
          SELECT t.id FROM public.firm_teams t JOIN my_teams ON t.parent_team_id = my_teams.id
        )
        SELECT 1
        FROM public.firm_memberships o
        WHERE o.firm_id = p_firm_id AND o.user_id = p_owner_id
          AND public.membership_is_current(o.valid_from, o.valid_until)
          AND o.team_id IN (SELECT id FROM my_teams)
      )
    )
$$;

-- 3. Becoming a member ends a support session. An admin who accepts an invitation to the firm (or whose request to join an owner approves)
-- during their own open session holds a role at that firm but, with the session still open, assert_firm_writable refused every write for the
-- rest of the hour. The session now ends in the same transaction, recorded as ended with the reason "became_member", as Nevermore's entry
-- in the firm's record like every other end. start_support_session already refuses a member.
ALTER TABLE public.support_sessions DROP CONSTRAINT support_sessions_ended_whole;
ALTER TABLE public.support_sessions ADD CONSTRAINT support_sessions_ended_whole CHECK (
  (ended_at IS NULL) = (ended_how IS NULL) AND (ended_how IS NULL OR ended_how IN ('ended', 'ran_out', 'firm_ended', 'became_member')));

CREATE FUNCTION public.end_support_session_for_new_member(p_firm_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
BEGIN
  -- The row's own update decides who records it: a second caller finds it ended and writes nothing.
  FOR r IN SELECT s.id, s.admin_id FROM public.support_sessions s WHERE s.firm_id = p_firm_id AND s.admin_id = p_user_id AND s.ended_at IS NULL FOR UPDATE LOOP
    UPDATE public.support_sessions SET ended_at = GREATEST(started_at, LEAST(ends_at, now())), ended_how = 'became_member' WHERE id = r.id AND ended_at IS NULL;
    IF FOUND THEN
      PERFORM public.support_activity_append(p_firm_id, r.admin_id, 'support_session_end', r.id, LEAST((SELECT s.ends_at FROM public.support_sessions s WHERE s.id = r.id), now()));
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.end_support_session_for_new_member(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Accepting an invitation (20261118110000), with every rule it had; the only addition is the call that ends the session.
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token_hash text, p_firm_address text)
 RETURNS TABLE(firm_id uuid, firm_address text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  inv public.firm_invitations;
  caller_email text;
  address text;
  decision text;
BEGIN
  SELECT lower(btrim(u.email)) INTO caller_email
  FROM auth.users u
  WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF NOT public.is_signed_in_person() OR caller_email IS NULL THEN
    RAISE EXCEPTION 'Sign in with a verified email to accept an invitation' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv FROM public.firm_invitations i WHERE i.token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invitation link is not valid' USING ERRCODE = 'PT404';
  END IF;
  SELECT f.address, f.decision INTO address, decision FROM public.firms f WHERE f.id = inv.firm_id;
  -- A refused firm is as good as no firm (D-31): its pending invitations read as links that are not valid.
  IF decision = 'refused' THEN
    RAISE EXCEPTION 'This invitation link is not valid' USING ERRCODE = 'PT404';
  END IF;
  IF address IS DISTINCT FROM lower(btrim(COALESCE(p_firm_address, ''))) THEN
    RAISE EXCEPTION 'This invitation belongs to another firm''s address' USING ERRCODE = 'PT422';
  END IF;
  IF public.firm_is_read_only(inv.firm_id) THEN
    RAISE EXCEPTION 'This firm is closing, so it can''t take new members' USING ERRCODE = 'PT423';
  END IF;
  IF public.firm_is_suspended(inv.firm_id) THEN
    RAISE EXCEPTION 'This firm is suspended, so it can''t take new members' USING ERRCODE = 'PT403';
  END IF;
  IF inv.status = 'accepted' THEN
    RAISE EXCEPTION 'This invitation has already been used' USING ERRCODE = 'PT410';
  ELSIF inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'This invitation was withdrawn' USING ERRCODE = 'PT410';
  ELSIF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired' USING ERRCODE = 'PT410';
  END IF;
  IF inv.email <> caller_email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address than the one you are signed in with' USING ERRCODE = 'PT403';
  END IF;
  IF EXISTS (
       SELECT 1 FROM public.firm_memberships m
       WHERE m.firm_id = inv.firm_id AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)
     ) THEN
    RAISE EXCEPTION 'You are already a member of this firm' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES (inv.firm_id, auth.uid(), inv.role, inv.team_id);
  -- An admin who held a support session for this firm is a member now: the session ends in this same transaction (CRM-P2.4).
  PERFORM public.end_support_session_for_new_member(inv.firm_id, auth.uid());
  UPDATE public.firm_invitations i SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now() WHERE i.id = inv.id;
  RETURN QUERY SELECT inv.firm_id, address, inv.role;
END;
$function$;

-- Approving a request to join (20261118110000), with every rule it had; the only addition is the call that ends the session.
CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id uuid, p_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.join_requests;
  have text;
  held text;
  closed integer;
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zr.firm_id FROM public.join_requests zr WHERE zr.id = p_request_id));
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
    -- An admin who held a support session for this firm is a member now: the session ends in this same transaction (CRM-P2.4).
    PERFORM public.end_support_session_for_new_member(req.firm_id, req.user_id);
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
$function$;
