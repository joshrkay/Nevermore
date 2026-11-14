-- CRM-P1.5 review fixes, on top of 20261116220000 (which is merged and not edited): a membership with a future end date can be ended
-- sooner; two owners removing the same member at once tell the loser the person is no longer a member; a stored mailbox is deleted
-- when a person's last current membership ends (by removal or by reaching its date, hourly), under one per-person lock (D-32);
-- an alert's first recipients are kept on the outbox row (D-35, D-102). Everything is written so that it works on a database where
-- 20261116220000 has already run.

-- One lock per person for everything that decides whether their stored mailbox may exist (D-32). Whether a person's LAST membership has
-- ended, and whether a mailbox may be stored for them, are answered from other rows, so no constraint can say it. Two endings of
-- a person's last two memberships in two firms would each still see the other one current and keep the mailbox; a store that checks
-- just before an ending commits would leave a mailbox for a non-member. Taking this lock first, then looking, makes each wait for the
-- other and look again at what it left. It is held to the end of the transaction. It is a lock on a number made from the person's id,
-- nothing a caller can name.
CREATE OR REPLACE FUNCTION public.lock_mailbox_owner(p_user_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('broker_mailbox:' || p_user_id::text, 0));
$$;

REVOKE ALL ON FUNCTION public.lock_mailbox_owner(uuid) FROM PUBLIC, anon, authenticated;

-- Removing and suspending: the same as before, and a membership that someone else has just ended is reported as no longer a member.
CREATE OR REPLACE FUNCTION public.remove_member(p_firm_id uuid, p_user_id uuid)
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

CREATE OR REPLACE FUNCTION public.suspend_member(p_firm_id uuid, p_user_id uuid)
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

-- The end of a membership deletes the mailbox under the person's lock.
CREATE OR REPLACE FUNCTION public.drop_mailbox_when_membership_ends()
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
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS first_recipients jsonb;

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
CREATE OR REPLACE FUNCTION public.drop_mailboxes_of_former_members()
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
