-- Remove or suspend a member of a firm (story CRM-P1.5; docs/BROKER_CRM_BUILD.md D-16, D-18, D-27, D-29, D-32, D-33, D-35).

-- 1. Two kinds of entry for the firm's record. 'member_removed' already exists and was never written; removing a member writes it
-- now. Suspending and lifting are new kinds. The list belongs to 20261116190500_invitation_fixes.sql, which databases have run; the
-- check is dropped and added again here with the full list. src/data/firmActivity.ts (ENTRY_KINDS) is kept in step by
-- src/data/schemaSync.test.ts, which reads the list of the latest migration that holds it.
ALTER TABLE public.firm_activity DROP CONSTRAINT IF EXISTS firm_activity_kind_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    -- sync:begin firm_activity_kinds
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused', 'invitation_withdrawn',
    'member_suspended', 'member_restored',
    -- Also the kinds of 20261116230000 (suspending a firm), which was written beside this file: either may be applied to a
    -- database that already holds the other's entries, and a check that left them out would be refused.
    'firm_suspended', 'firm_restored'
    -- sync:end firm_activity_kinds
  ));

-- 2. The membership trigger of 20261116160001 writes "ended a membership" or "added a member" for every change of a membership.
-- Removing, suspending and lifting are each written once, as what they are, by the functions below; those say so for their own
-- transaction (the setting nevermore.membership_change) and the trigger then stays quiet. Anything else that changes a membership
-- (an owner's account removed, a later story's leaving) is written by the trigger as before. Only the early return is new.
CREATE OR REPLACE FUNCTION public.record_membership_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m public.firm_memberships;
  added boolean := TG_OP = 'INSERT';
BEGIN
  IF COALESCE(current_setting('nevermore.membership_change', true), '') = 'on' THEN
    RETURN NULL;
  END IF;
  m := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_OP = 'UPDATE' AND NEW.valid_until IS NOT DISTINCT FROM OLD.valid_until THEN
    RETURN NULL;
  END IF;
  -- Removing an account removes its memberships, the ones that had already ended too. An ended membership was recorded
  -- when it ended, so recording it again would make an old change look as if it just happened.
  IF TG_OP = 'DELETE' AND NOT public.membership_is_current(OLD.valid_from, OLD.valid_until) THEN
    RETURN NULL;
  END IF;
  PERFORM public.firm_activity_append(
    m.firm_id,
    CASE WHEN m.role = 'owner' THEN 'owner_' ELSE 'member_' END || CASE WHEN added THEN 'added' ELSE 'ended' END,
    'membership', m.id::text, m.user_id, m.role,
    -- A member ending their own membership acted as a member, though the row they just ended no longer says so.
    CASE WHEN TG_OP <> 'INSERT' AND OLD.user_id = auth.uid() AND public.membership_is_current(OLD.valid_from, OLD.valid_until) THEN true END);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_membership_change() FROM PUBLIC, anon, authenticated;

-- Suspending: the person is kept, and grants nothing, until an owner lifts it.
--
-- How it is kept. Every rule in the product asks one question, "is this person a current member" (membership_is_current over the
-- dated membership), and dozens of policies and functions, this story's and later stories', ask it by that one name. A suspension
-- is therefore written the way the rest of the product already reads a person who is not a member: the membership row is ended
-- now (never deleted) and this table keeps the suspension beside it, with what lifting must give back (the role and the team).
-- Everything that checks membership refuses the suspended person at once, with no second condition for any caller to forget.
-- Lifting adds a new membership from that moment, the same role and team, and closes the suspension. There is at most one open
-- suspension per person and firm: a unique index is the rule (D-29), so two owners suspending at once cannot keep two.
-- Nobody reads or writes it through the API, owners included: firm_members() is how an owner sees who is suspended.
CREATE TABLE public.firm_member_suspensions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- The membership this suspension ended. Its role and team are what lifting gives back.
  membership_id bigint NOT NULL REFERENCES public.firm_memberships (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'lead', 'agent')),
  team_id uuid,
  suspended_at timestamptz NOT NULL DEFAULT now(),
  -- No foreign key on purpose, as the firm's record has none: this is who did it and it outlives the account.
  suspended_by uuid,
  ended_at timestamptz,
  ended_how text CHECK (ended_how IN ('lifted', 'removed')),
  FOREIGN KEY (firm_id, team_id) REFERENCES public.firm_teams (firm_id, id),
  CONSTRAINT firm_member_suspensions_ended_is_whole CHECK ((ended_at IS NULL) = (ended_how IS NULL))
);

CREATE UNIQUE INDEX firm_member_suspensions_one_open ON public.firm_member_suspensions (firm_id, user_id) WHERE ended_at IS NULL;

ALTER TABLE public.firm_member_suspensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_member_suspensions FROM PUBLIC, anon, authenticated;

-- Removing: the membership ends now. It is dated and kept, never deleted (a membership is only ever ended, and another added).
-- Only a current owner of that firm may do it: the caller's own role in the firm, from the dated memberships (D-18); an address is
-- never the lock and a platform admin who is not a member of the firm may not (D-16). A person can't remove themself here (leaving
-- is CRM-P1.6).
CREATE FUNCTION public.remove_member(p_firm_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m public.firm_memberships;
  s public.firm_member_suspensions;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You can''t remove yourself' USING ERRCODE = 'PT409';
  END IF;
  SELECT * INTO m FROM public.firm_memberships x
  WHERE x.firm_id = p_firm_id AND x.user_id = p_user_id AND public.membership_is_current(x.valid_from, x.valid_until)
  FOR UPDATE;
  IF FOUND THEN
    -- The rule that a firm keeps a current owner is keep_firm_owner() (20261116090000), a trigger that takes the firm's row lock
    -- before it counts, so two owners removing each other at the same moment queue instead of each seeing the other still there.
    -- It is only given plain words here.
    PERFORM set_config('nevermore.membership_change', 'on', true);
    BEGIN
      UPDATE public.firm_memberships x SET valid_until = now() WHERE x.id = m.id;
    EXCEPTION WHEN check_violation THEN
      RAISE EXCEPTION 'The last owner of a firm can''t be removed. Make someone else an owner first.' USING ERRCODE = '23514';
    END;
    PERFORM set_config('nevermore.membership_change', 'off', true);
    PERFORM public.firm_activity_append(p_firm_id, 'member_removed', 'membership', m.id::text, m.user_id, m.role);
    RETURN;
  END IF;
  -- A suspended person has no current membership; removing them closes the suspension, and the membership stays ended.
  SELECT * INTO s FROM public.firm_member_suspensions x
  WHERE x.firm_id = p_firm_id AND x.user_id = p_user_id AND x.ended_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not a member of this firm' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.firm_member_suspensions x SET ended_at = now(), ended_how = 'removed' WHERE x.id = s.id;
  PERFORM public.firm_activity_append(p_firm_id, 'member_removed', 'membership', s.membership_id::text, s.user_id, s.role);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO authenticated;

CREATE FUNCTION public.suspend_member(p_firm_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE m public.firm_memberships;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You can''t suspend yourself' USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.firm_id = p_firm_id AND s.user_id = p_user_id AND s.ended_at IS NULL) THEN
    RAISE EXCEPTION 'That person is already suspended' USING ERRCODE = 'PT409';
  END IF;
  SELECT * INTO m FROM public.firm_memberships x
  WHERE x.firm_id = p_firm_id AND x.user_id = p_user_id AND public.membership_is_current(x.valid_from, x.valid_until)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not a member of this firm' USING ERRCODE = 'PT404';
  END IF;
  BEGIN
    -- The suspension is written before the membership ends, so what reacts to the end (a stored mailbox) can see it is one.
    INSERT INTO public.firm_member_suspensions (firm_id, user_id, membership_id, role, team_id, suspended_by)
    VALUES (p_firm_id, p_user_id, m.id, m.role, m.team_id, auth.uid());
    PERFORM set_config('nevermore.membership_change', 'on', true);
    UPDATE public.firm_memberships x SET valid_until = now() WHERE x.id = m.id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'The last owner of a firm can''t be suspended. Make someone else an owner first.' USING ERRCODE = '23514';
  END;
  PERFORM set_config('nevermore.membership_change', 'off', true);
  PERFORM public.firm_activity_append(p_firm_id, 'member_suspended', 'membership', m.id::text, m.user_id, m.role);
END;
$$;

REVOKE ALL ON FUNCTION public.suspend_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_member(uuid, uuid) TO authenticated;

-- A suspended person is not added again by another way in (an invitation accepted, a membership inserted): that would end the
-- suspension with no owner having lifted it. Lifting is the only way back, and says so by a setting only it makes, for its own
-- transaction. An owner who wants the person back lifts the suspension, or removes them and invites them again.
CREATE FUNCTION public.keep_suspension()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('nevermore.lifting_suspension', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.firm_id = NEW.firm_id AND s.user_id = NEW.user_id AND s.ended_at IS NULL) THEN
    RAISE EXCEPTION 'This person is suspended at this firm. An owner lifts the suspension.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_suspension() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firm_memberships_keep_suspension
  BEFORE INSERT ON public.firm_memberships
  FOR EACH ROW EXECUTE FUNCTION public.keep_suspension();

-- Lifting: the suspension ends and a membership begins now, with the role and team the person had.
CREATE FUNCTION public.lift_member_suspension(p_firm_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.firm_member_suspensions;
  new_id bigint;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM public.firm_member_suspensions x
  WHERE x.firm_id = p_firm_id AND x.user_id = p_user_id AND x.ended_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not suspended' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.firm_member_suspensions x SET ended_at = now(), ended_how = 'lifted' WHERE x.id = s.id;
  PERFORM set_config('nevermore.lifting_suspension', 'on', true);
  PERFORM set_config('nevermore.membership_change', 'on', true);
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES (p_firm_id, p_user_id, s.role, s.team_id)
  RETURNING id INTO new_id;
  PERFORM set_config('nevermore.lifting_suspension', 'off', true);
  PERFORM set_config('nevermore.membership_change', 'off', true);
  PERFORM public.firm_activity_append(p_firm_id, 'member_restored', 'membership', new_id::text, p_user_id, s.role);
END;
$$;

REVOKE ALL ON FUNCTION public.lift_member_suspension(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lift_member_suspension(uuid, uuid) TO authenticated;

-- The firm's members as an owner sees them: the current ones and the suspended ones (a removed person is not listed; the firm's
-- record says they were). Owners of that firm only, past the second factor (firm_role): the same refusal for everyone else.
CREATE FUNCTION public.firm_members(p_firm_id uuid)
RETURNS TABLE (user_id uuid, email text, role text, state text, since timestamptz, is_you boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT l.user_id, u.email::text, l.role, l.state, l.since, l.user_id = auth.uid()
  FROM (
    SELECT m.user_id, m.role, 'current'::text AS state, m.valid_from AS since
    FROM public.firm_memberships m
    WHERE m.firm_id = p_firm_id AND public.membership_is_current(m.valid_from, m.valid_until)
    UNION ALL
    SELECT s.user_id, s.role, 'suspended', s.suspended_at
    FROM public.firm_member_suspensions s
    WHERE s.firm_id = p_firm_id AND s.ended_at IS NULL
  ) l
  JOIN auth.users u ON u.id = l.user_id
  ORDER BY CASE l.role WHEN 'owner' THEN 0 WHEN 'lead' THEN 1 ELSE 2 END, lower(u.email), l.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_members(uuid) TO authenticated;

-- A broker's stored mailbox is their own credential (one per person, across firms). It is deleted when the person's last current
-- membership anywhere ends, so a credential never outlives the access it was given for. A suspended person keeps it stored (an
-- owner lifting the suspension gives them back what they had), but can't use it: mailbox_secret() and my_mailbox() already ask for
-- a current membership. Someone suspended at one firm and removed from another still holds a membership, so keeps it. It is a
-- trigger on the end of a membership, not code in the removal, so leaving a firm (CRM-P1.6) and any other end are covered.
CREATE FUNCTION public.drop_mailbox_when_membership_ends()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.user_id = NEW.user_id AND public.membership_is_current(m.valid_from, m.valid_until))
     AND NOT EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.user_id = NEW.user_id AND s.ended_at IS NULL) THEN
    DELETE FROM public.broker_mailboxes WHERE user_id = NEW.user_id;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.drop_mailbox_when_membership_ends() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firm_memberships_drop_mailbox
  AFTER UPDATE OF valid_until ON public.firm_memberships
  FOR EACH ROW EXECUTE FUNCTION public.drop_mailbox_when_membership_ends();

-- Removing someone who is suspended is the end of a membership they still held.
CREATE TRIGGER firm_member_suspensions_drop_mailbox
  AFTER UPDATE OF ended_at ON public.firm_member_suspensions
  FOR EACH ROW WHEN (NEW.ended_how = 'removed')
  EXECUTE FUNCTION public.drop_mailbox_when_membership_ends();
