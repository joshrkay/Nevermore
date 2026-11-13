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
    'member_suspended', 'member_restored'
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
    -- Someone else ended this membership between this call starting and getting the row lock: it is already changed.
    IF m.valid_until IS NOT NULL AND m.valid_until <= clock_timestamp() THEN
      RAISE EXCEPTION 'That person is not a member of this firm' USING ERRCODE = 'PT404';
    END IF;
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
  IF NOT FOUND OR (m.valid_until IS NOT NULL AND m.valid_until <= clock_timestamp()) THEN
    -- Not found, or someone else ended it between this call starting and getting the row lock.
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

-- One lock per person for everything that decides whether their stored mailbox may exist (D-32). Whether a person's LAST membership has
-- ended, and whether a mailbox may be stored for them, are answered from other rows, so no constraint can say it. Two endings of
-- a person's last two memberships in two firms would each still see the other one current and keep the mailbox; a store that checks
-- just before an ending commits would leave a mailbox for a non-member. Taking this lock first, then looking, makes each wait for the
-- other and look again at what it left. It is held to the end of the transaction. It is a lock on a number made from the person's id,
-- nothing a caller can name.
CREATE FUNCTION public.lock_mailbox_owner(p_user_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('broker_mailbox:' || p_user_id::text, 0));
$$;

REVOKE ALL ON FUNCTION public.lock_mailbox_owner(uuid) FROM PUBLIC, anon, authenticated;

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
  PERFORM public.lock_mailbox_owner(NEW.user_id);
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

-- A membership that already has a future end date (keep_firm_owner allows one) can still be ended sooner by an owner, so a removal or a
-- suspension of it works; any other change, and any change to a membership that has already ended, is still refused.
CREATE OR REPLACE FUNCTION public.keep_membership_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.id, NEW.firm_id, NEW.user_id, NEW.role, NEW.team_id, NEW.valid_from)
     IS DISTINCT FROM (OLD.id, OLD.firm_id, OLD.user_id, OLD.role, OLD.team_id, OLD.valid_from)
     OR (OLD.valid_until IS NOT NULL
         AND NOT (NEW.valid_until IS NOT NULL AND NEW.valid_until <= OLD.valid_until AND NEW.valid_until >= now())) THEN
    RAISE EXCEPTION 'A membership is never changed: end it and add another' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- The mailbox of a suspended person survives the loss of a platform role too, as it survives the end of their membership. No lock is
-- taken here: the end of a membership deletes the mailbox whatever platform role the person holds, so this can only ever be early.
CREATE OR REPLACE FUNCTION public.drop_mailbox_without_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = OLD.user_id AND r.role::text IN ('advisor', 'admin'))
     AND NOT EXISTS (SELECT 1 FROM public.firm_memberships f WHERE f.user_id = OLD.user_id AND public.membership_is_current(f.valid_from, f.valid_until))
     AND NOT EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.user_id = OLD.user_id AND s.ended_at IS NULL) THEN
    DELETE FROM public.broker_mailboxes WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;

-- The people an alert was first prepared for (D-35, D-102). The frozen message that says whom it went to is disposable: a definitive
-- refusal of the first send clears it and it ages out of the provider's key window, so the dispatcher could no longer tell a retry who
-- had been meant from someone who joined later. They are written here once, by the first freeze, and nothing clears or rewrites them
-- (not a failure, not an operator's rebuild, not a later freeze for other people). Every retry sends to those of them who are still
-- members; when none is, the alert goes to the current members under a new key.
ALTER TABLE public.outbox_events ADD COLUMN first_recipients jsonb;

CREATE OR REPLACE FUNCTION public.freeze_outbox_message(
  p_id uuid,
  p_attempt integer,
  p_message jsonb,
  p_replace boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  frozen jsonb;
BEGIN
  IF p_message IS NULL OR jsonb_typeof(p_message) <> 'object'
     OR NOT (p_message ?& ARRAY['from', 'to', 'subject', 'text', 'html']) THEN
    RAISE EXCEPTION 'freeze_outbox_message: the message must be an object with from, to, subject, text and html'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.outbox_events e
  SET pending_send = jsonb_build_object(
    'key', 'outbox-' || p_id::text || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    'message', p_message,
    'attempt', p_attempt,
    'frozen_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ),
  first_recipients = COALESCE(e.first_recipients, p_message -> 'to')
  WHERE e.id = p_id AND e.status = 'claimed' AND e.attempts = p_attempt AND (e.pending_send IS NULL OR p_replace)
  RETURNING e.pending_send INTO frozen;

  RETURN frozen;
END;
$$;

-- Storing takes the same lock before it asks whether the person is a current member (see lock_mailbox_owner).
CREATE OR REPLACE FUNCTION public.mailbox_store(
  p_user_id uuid, p_provider text, p_address text, p_scope text, p_token_ciphertext text, p_token_iv text, p_rotated boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.lock_mailbox_owner(p_user_id);
  IF NOT EXISTS (SELECT 1 FROM public.firm_memberships f WHERE f.user_id = p_user_id AND public.membership_is_current(f.valid_from, f.valid_until)) THEN
    RAISE EXCEPTION 'Only a member of a firm can connect a mailbox' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (p_user_id, p_provider, p_address, p_scope, p_token_ciphertext, p_token_iv)
  ON CONFLICT (user_id) DO UPDATE
  SET provider = EXCLUDED.provider, address = EXCLUDED.address, scope = EXCLUDED.scope,
      token_ciphertext = EXCLUDED.token_ciphertext, token_iv = EXCLUDED.token_iv, token_updated_at = now(),
      -- A token Microsoft handed back on a refresh replaces the old one; the broker has not connected again.
      connected_at = CASE WHEN p_rotated THEN public.broker_mailboxes.connected_at ELSE now() END;
  RETURN jsonb_build_object('connected', true);
END;
$$;

-- A membership that ends by reaching its date fires no trigger, so nothing deletes the stored mailbox of a person whose last
-- membership ran out that way. This does, every hour (below): it deletes the stored mailbox of everyone with no current membership
-- and no open suspension, taking each person's lock and looking again before it deletes. mailbox_secret() already gives such a
-- person nothing in the meantime. It answers how many it deleted. Only the service role and the database's own scheduler run it.
CREATE FUNCTION public.drop_mailboxes_of_former_members()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  u uuid;
  dropped integer := 0;
  n integer;
BEGIN
  FOR u IN
    SELECT b.user_id FROM public.broker_mailboxes b
    WHERE NOT EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.user_id = b.user_id AND public.membership_is_current(m.valid_from, m.valid_until))
      AND NOT EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.user_id = b.user_id AND s.ended_at IS NULL)
  LOOP
    PERFORM public.lock_mailbox_owner(u);
    DELETE FROM public.broker_mailboxes b
    WHERE b.user_id = u
      AND NOT EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.user_id = b.user_id AND public.membership_is_current(m.valid_from, m.valid_until))
      AND NOT EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.user_id = b.user_id AND s.ended_at IS NULL);
    GET DIAGNOSTICS n = ROW_COUNT;
    dropped := dropped + n;
  END LOOP;
  RETURN dropped;
END;
$$;

REVOKE ALL ON FUNCTION public.drop_mailboxes_of_former_members() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.drop_mailboxes_of_former_members() TO service_role;

-- Hourly, from the database, the way the outbox is worked (20261027100000_outbox_schedule.sql): an existing job is left as it is, and
-- where pg_cron is not available this logs a notice and does nothing, since a missing scheduler must never fail the migration chain.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'mailbox cleanup: pg_cron is not available (%); run drop_mailboxes_of_former_members() every hour another way', SQLERRM;
      RETURN;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drop-former-members-mailboxes') THEN
    RAISE NOTICE 'mailbox cleanup: the job already exists; leaving it as it is';
    RETURN;
  END IF;
  PERFORM cron.schedule('drop-former-members-mailboxes', '7 * * * *', 'select public.drop_mailboxes_of_former_members()');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'mailbox cleanup: could not schedule the cleanup (%); run drop_mailboxes_of_former_members() every hour another way', SQLERRM;
END $$;
