-- An owner changes a member's role and team, keeps the firm's teams, and sets who sees what (CRM-X1.1; docs/BROKER_READINESS_PRD.md BR-5.3;
-- docs/BROKER_CRM_BUILD.md "## Roles, teams and visibility", D-2320 to D-2339; supabase/tests/roles_teams_visibility.sql). The tables were there from the
-- start (firm_teams, dated firm_memberships with a team, firms.visibility) and the level rule already goes by them (can_see_firm_record); what was missing
-- was any way to change them after a person joined. No table is added.

SET lock_timeout = '5s';

-- ---------- 1. A role change does not disconnect a mailbox ----------
-- Restated from its only definition (drop_mailbox_when_membership_ends) with every line kept. Changing a member's role or team ends one membership and
-- begins another in the same transaction (a membership is never changed, D-33), and for the moment between the two the person has none; change_member says
-- so with a setting no API role can make, and the mailbox is left alone. Every other ending drops it as before.
CREATE OR REPLACE FUNCTION public.drop_mailbox_when_membership_ends()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('nevermore.membership_role_change', true), '') = 'on' THEN
    RETURN NULL;
  END IF;
  PERFORM public.lock_mailbox_owner(NEW.user_id);
  IF NOT EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.user_id = NEW.user_id AND public.membership_is_current(m.valid_from, m.valid_until))
     AND NOT EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.user_id = NEW.user_id AND s.ended_at IS NULL) THEN
    DELETE FROM public.broker_mailboxes WHERE user_id = NEW.user_id;
  END IF;
  RETURN NULL;
END;
$$;

-- ---------- 2. Changing a member ----------
-- An owner gives a current member another role, another team, or both. The membership they had is ended and a new one begins at the same moment, so who
-- could see a record on a given day can always be answered. The firm's record gains the ending and the beginning, as it does for any membership.
CREATE FUNCTION public.change_member(p_firm_id uuid, p_user_id uuid, p_role text, p_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m public.firm_memberships;
  -- The transaction's own time, as end_membership_now uses: what membership_is_current goes by, so the old membership is over and the new one current at once.
  at_once timestamptz := now();
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('owner', 'lead', 'agent') THEN
    RAISE EXCEPTION 'A member is an owner, a lead or an agent' USING ERRCODE = '22023';
  END IF;
  IF p_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.firm_teams t WHERE t.id = p_team_id AND t.firm_id = p_firm_id) THEN
    RAISE EXCEPTION 'That team isn''t one of this firm''s' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO m FROM public.firm_memberships x
  WHERE x.firm_id = p_firm_id AND x.user_id = p_user_id AND public.membership_is_current(x.valid_from, x.valid_until)
  FOR UPDATE;
  IF NOT FOUND OR (m.valid_until IS NOT NULL AND m.valid_until <= at_once) THEN
    RAISE EXCEPTION 'That person is not a member of this firm' USING ERRCODE = 'PT404';
  END IF;
  IF m.role = p_role AND m.team_id IS NOT DISTINCT FROM p_team_id THEN
    RETURN;
  END IF;
  PERFORM set_config('nevermore.membership_role_change', 'on', true);
  BEGIN
    UPDATE public.firm_memberships x SET valid_until = at_once WHERE x.id = m.id;
  EXCEPTION WHEN check_violation THEN
    PERFORM set_config('nevermore.membership_role_change', 'off', true);
    RAISE EXCEPTION 'A firm keeps at least one owner. Make someone else an owner first.' USING ERRCODE = '23514';
  END;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id, valid_from) VALUES (p_firm_id, p_user_id, p_role, p_team_id, at_once);
  PERFORM set_config('nevermore.membership_role_change', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.change_member(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_member(uuid, uuid, text, uuid) TO authenticated;

-- ---------- 3. Teams ----------
-- Makes a team (no id) or renames and moves one (its id): a name of 1 to 80 characters, used once in the firm whatever its capitals, and optionally the
-- team it sits in. Answers the team's id.
CREATE FUNCTION public.save_team(p_firm_id uuid, p_team_id uuid, p_name text, p_parent_team_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  clean text := btrim(COALESCE(p_name, ''));
  taken text;
  saved uuid;
BEGIN
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  IF char_length(clean) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'A team has a name of 1 to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF p_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.firm_teams t WHERE t.id = p_team_id AND t.firm_id = p_firm_id) THEN
    RAISE EXCEPTION 'That team isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF p_parent_team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.firm_teams t WHERE t.id = p_parent_team_id AND t.firm_id = p_firm_id) THEN
    RAISE EXCEPTION 'That team isn''t one of this firm''s' USING ERRCODE = '22023';
  END IF;
  SELECT t.name INTO taken FROM public.firm_teams t WHERE t.firm_id = p_firm_id AND lower(t.name) = lower(clean) AND t.id IS DISTINCT FROM p_team_id LIMIT 1;
  IF taken IS NOT NULL THEN
    RAISE EXCEPTION 'Your firm already has a team called %', taken USING ERRCODE = '22023';
  END IF;
  BEGIN
    IF p_team_id IS NULL THEN
      INSERT INTO public.firm_teams (firm_id, name, parent_team_id) VALUES (p_firm_id, clean, p_parent_team_id) RETURNING id INTO saved;
    ELSE
      UPDATE public.firm_teams t SET name = clean, parent_team_id = p_parent_team_id WHERE t.id = p_team_id AND t.firm_id = p_firm_id RETURNING t.id INTO saved;
    END IF;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'A team can''t sit under itself or under a team inside it' USING ERRCODE = '22023';
  END;
  RETURN saved;
END;
$$;

REVOKE ALL ON FUNCTION public.save_team(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_team(uuid, uuid, text, uuid) TO authenticated;

-- Whether a team can be deleted: it holds no team, and no membership has ever named it (an ended membership still says which team the person was in, and
-- is never changed).
CREATE FUNCTION public.team_delete_problem(p_team public.firm_teams)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.firm_teams c WHERE c.parent_team_id = p_team.id) THEN format('%s holds another team. Move or delete that one first.', p_team.name)
    WHEN EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.team_id = p_team.id)
      THEN format('People have belonged to %s, so it stays as the record of who was in it. Rename it, or move its people out.', p_team.name)
  END
$$;
REVOKE ALL ON FUNCTION public.team_delete_problem(public.firm_teams) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.delete_team(p_firm_id uuid, p_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t public.firm_teams;
  problem text;
BEGIN
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.firm_teams x WHERE x.id = p_team_id AND x.firm_id = p_firm_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That team isn''t available' USING ERRCODE = 'PT404';
  END IF;
  problem := public.team_delete_problem(t);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '55000';
  END IF;
  DELETE FROM public.firm_teams x WHERE x.id = t.id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_team(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_team(uuid, uuid) TO authenticated;

-- ---------- 4. Who sees what ----------
-- 'by_level': each person their own records, a lead their teams', an owner everything. 'everyone': every member sees every record of the firm.
CREATE FUNCTION public.set_firm_visibility(p_firm_id uuid, p_visibility text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.assert_firm_writable(p_firm_id);
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  IF p_visibility IS NULL OR p_visibility NOT IN ('by_level', 'everyone') THEN
    RAISE EXCEPTION 'Everyone sees everything, or each person sees their own and a lead their team''s' USING ERRCODE = '22023';
  END IF;
  UPDATE public.firms f SET visibility = p_visibility WHERE f.id = p_firm_id AND f.visibility IS DISTINCT FROM p_visibility;
END;
$$;

REVOKE ALL ON FUNCTION public.set_firm_visibility(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_firm_visibility(uuid, text) TO authenticated;

-- ---------- 5. What the Members page reads beside its list ----------
-- For an owner (or a support session reading as one): the setting, each team with what it sits in, how many current members are in it and whether it can
-- be deleted, and each current member's role and team.
CREATE FUNCTION public.firm_teams_page(p_firm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(public.firm_role(p_firm_id), '') NOT IN ('owner', 'support') THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'visibility', (SELECT f.visibility FROM public.firms f WHERE f.id = p_firm_id),
    'teams', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'parent_team_id', t.parent_team_id, 'parent_name', (SELECT p.name FROM public.firm_teams p WHERE p.id = t.parent_team_id),
        'members', (SELECT count(*) FROM public.firm_memberships m WHERE m.team_id = t.id AND public.membership_is_current(m.valid_from, m.valid_until)),
        'can_delete', public.team_delete_problem(t) IS NULL) ORDER BY lower(t.name), t.id)
      FROM public.firm_teams t WHERE t.firm_id = p_firm_id), '[]'::jsonb),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email, 'name', public.crm_person_name(m.user_id), 'role', m.role, 'team_id', m.team_id,
                                          'team_name', (SELECT t.name FROM public.firm_teams t WHERE t.id = m.team_id)) ORDER BY lower(u.email), m.user_id)
      FROM public.firm_memberships m JOIN auth.users u ON u.id = m.user_id
      WHERE m.firm_id = p_firm_id AND public.membership_is_current(m.valid_from, m.valid_until)), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.firm_teams_page(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_teams_page(uuid) TO authenticated;
