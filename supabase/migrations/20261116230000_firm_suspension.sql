-- Suspend a firm, and lift the suspension (story CRM-P1.8; docs/BROKER_CRM_BUILD.md D-5, D-16, D-18, D-27, D-28, D-29, D-31, D-32,
-- D-33, D-34, D-35; docs/BROKER_CRM_PRD.md 8.5).
--
-- A platform admin (who belongs to no firm, D-16) suspends a firm with a reason and later lifts the suspension. While a firm is
-- suspended its members are refused the firm's data exactly as a non-member is: the one membership question every policy and
-- function asks (firm_role) answers "not a member" for a suspended firm. The firm's people can still sign in at its address and are
-- told it is suspended (firm_address_suspended). Nothing is deleted: lifting the suspension ends it and everything is as it was.
--
-- Suspension is separate from the approval decision (approved, refused, waiting). An approved firm can be suspended; so can a firm
-- still waiting for approval, which simply gains the suspended state (it is still decided by an admin as before, and is still
-- listed as waiting); a refused firm already behaves as no firm's address (D-31) and a suspension adds nothing visible to it.

-- ---------- the platform's record ----------
-- One row for each time a firm is suspended: who, when, why, and when and by whom it was lifted. Platform-side: no grant to any API
-- role, so a firm never reads the reason (functions below are the only way in). At most one suspension of a firm is open at a time
-- (D-29): the partial unique index is the rule, and the functions only give its usual message.
CREATE TABLE public.firm_suspensions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  suspended_at timestamptz NOT NULL DEFAULT now(),
  suspended_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (btrim(reason) <> '' AND char_length(reason) <= 500),
  lifted_at timestamptz,
  lifted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT firm_suspensions_lift_after CHECK (lifted_at IS NULL OR lifted_at >= suspended_at)
);

CREATE UNIQUE INDEX firm_suspensions_one_open ON public.firm_suspensions (firm_id) WHERE lifted_at IS NULL;

ALTER TABLE public.firm_suspensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_suspensions FROM PUBLIC, anon, authenticated;

-- Is this firm suspended now? The one place the question is written; every guard, policy and function asks this.
CREATE FUNCTION public.firm_is_suspended(p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.firm_suspensions s WHERE s.firm_id = p_firm_id AND s.lifted_at IS NULL)
$$;

REVOKE ALL ON FUNCTION public.firm_is_suspended(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.firm_is_suspended(uuid) TO service_role;

-- ---------- the firm's record ----------
-- Two kinds join the firm's record of who did what. Kept in step with src/data/firmActivity.ts by src/data/schemaSync.test.ts.
ALTER TABLE public.firm_activity DROP CONSTRAINT IF EXISTS firm_activity_kind_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    -- sync:begin firm_activity_kinds
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused', 'invitation_withdrawn',
    'firm_suspended', 'firm_restored',
    -- Also the kinds of 20261116220000 (suspending a member), which was written beside this file: either may be applied to a
    -- database that already holds the other's entries, and a check that left them out would be refused.
    'member_suspended', 'member_restored'
    -- sync:end firm_activity_kinds
  ));

-- ---------- suspending and lifting ----------
CREATE FUNCTION public.admin_suspend_firm(p_firm_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  clean_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason = '' OR char_length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'Give a reason of 1 to 500 characters' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id) THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  -- An admin does not act on a firm they belong to (as when deciding on one).
  IF public.admin_belongs_to_firm(p_firm_id) THEN
    RAISE EXCEPTION 'An admin does not suspend a firm they belong to' USING ERRCODE = '42501';
  END IF;
  BEGIN
    INSERT INTO public.firm_suspensions (firm_id, suspended_by, reason) VALUES (p_firm_id, auth.uid(), clean_reason);
  EXCEPTION WHEN unique_violation THEN
    -- The unique index firm_suspensions_one_open is the rule (D-29); this only gives its usual message.
    RAISE EXCEPTION 'That firm is suspended already' USING ERRCODE = 'PT409';
  END;
  PERFORM public.record_firm_event(p_firm_id, 'firm_suspended', auth.uid(), '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_suspend_firm(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_firm(uuid, text) TO authenticated;

CREATE FUNCTION public.admin_lift_firm_suspension(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  lifted integer;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id) THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  IF public.admin_belongs_to_firm(p_firm_id) THEN
    RAISE EXCEPTION 'An admin does not lift the suspension of a firm they belong to' USING ERRCODE = '42501';
  END IF;
  -- Closing the open row is one statement: two lifts at once see the second find nothing to close.
  UPDATE public.firm_suspensions s SET lifted_at = now(), lifted_by = auth.uid() WHERE s.firm_id = p_firm_id AND s.lifted_at IS NULL;
  GET DIAGNOSTICS lifted = ROW_COUNT;
  IF lifted = 0 THEN
    RAISE EXCEPTION 'That firm is not suspended' USING ERRCODE = 'PT409';
  END IF;
  PERFORM public.record_firm_event(p_firm_id, 'firm_restored', auth.uid(), '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_lift_firm_suspension(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_lift_firm_suspension(uuid) TO authenticated;

-- Every firm with its approval state and whether it is suspended now, for the platform admin's page (the approvals page lists the
-- waiting firms only). The reason and the date are the platform's record: only an admin reads them, here.
CREATE FUNCTION public.admin_firm_states()
RETURNS TABLE (firm_id uuid, name text, address text, state text, signed_up_at timestamptz,
               suspended boolean, suspended_at timestamptz, suspension_reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT f.id, f.name, f.address,
         CASE WHEN f.decision IS NOT NULL THEN f.decision WHEN f.approved_at IS NOT NULL THEN 'approved' ELSE 'waiting' END,
         f.created_at, o.id IS NOT NULL, o.suspended_at, o.reason
  FROM public.firms f
  LEFT JOIN public.firm_suspensions o ON o.firm_id = f.id AND o.lifted_at IS NULL
  ORDER BY lower(f.name), f.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_firm_states() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_firm_states() TO authenticated;

-- Is the caller a current member of the firm, whether or not it is suspended? The platform admin's rule needs the membership
-- itself, which firm_role no longer reports for a suspended firm. Internal.
CREATE FUNCTION public.admin_belongs_to_firm(p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.firm_memberships m
    WHERE m.firm_id = p_firm_id AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until))
$$;

REVOKE ALL ON FUNCTION public.admin_belongs_to_firm(uuid) FROM PUBLIC, anon, authenticated;

-- ---------- a suspended firm's members are refused as non-members are ----------
-- Membership is the one question every table policy and every firm-scoped function asks (firm_role / is_firm_member, D-18), so
-- the rule is written there once: a suspended firm has no members as far as the database's answers go. Nothing else of the
-- membership changes: the rows stay, dated as they were, and lifting the suspension gives every member back what they had.
-- This is 20261116110000's firm_role() with the one added condition.
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
    AND NOT public.firm_is_suspended(p_firm_id)
$$;

-- The two places that read a person's memberships directly, for the console's first line and the owner's Activity link, leave a
-- suspended firm out for the same reason.
CREATE OR REPLACE FUNCTION public.current_member_firm_ids()
RETURNS TABLE (firm_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.firm_id
  FROM public.firm_memberships m
  WHERE m.user_id = auth.uid()
    AND public.membership_is_current(m.valid_from, m.valid_until)
    AND NOT public.firm_is_suspended(m.firm_id)
$$;

CREATE OR REPLACE FUNCTION public.current_owner_firm_ids()
RETURNS TABLE (firm_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.firm_id
  FROM public.firm_memberships m
  WHERE m.user_id = auth.uid() AND m.role = 'owner'
    AND public.membership_is_current(m.valid_from, m.valid_until)
    AND NOT public.firm_is_suspended(m.firm_id)
$$;

CREATE OR REPLACE FUNCTION public.my_firms()
RETURNS TABLE (firm_id uuid, name text, address text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT f.id, f.name, f.address, m.role
  FROM public.firm_memberships m
  JOIN public.firms f ON f.id = m.firm_id
  WHERE m.user_id = auth.uid()
    AND public.membership_is_current(m.valid_from, m.valid_until)
    AND NOT public.firm_is_suspended(f.id)
    AND public.is_signed_in_person()
    AND public.second_factor_rule_met()
  ORDER BY f.name, f.id
$$;

-- ---------- invitations ----------
-- Inviting, sending again and withdrawing ask firm_role() for an owner, which a suspended firm's owners no longer pass. Accepting is
-- by a person who is no member yet, so it asks for itself: an invitation to a suspended firm is not accepted, joins nothing and is
-- not spent, so it still works once the suspension is lifted. The check comes after the address one (D-34), so a link opened at
-- another firm's address still learns nothing. Otherwise 20261116190000's accept_invitation, as it stands.
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token_hash text, p_firm_address text)
RETURNS TABLE (firm_id uuid, firm_address text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  UPDATE public.firm_invitations i SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now() WHERE i.id = inv.id;
  RETURN QUERY SELECT inv.firm_id, address, inv.role;
END;
$$;


REVOKE ALL ON FUNCTION public.accept_invitation(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, text) TO authenticated;

-- ---------- what a suspended firm's address shows ----------
-- firm_public_name() and is_member_of_firm_address() are not changed: a suspended firm's name and sign-in still show (D-27, as for a
-- waiting firm) and its members are still members at its address, which is what lets the screen tell them the firm is suspended
-- instead of "you aren't a member". This is the question the screen then asks. It answers about the caller only, and true only
-- for a current member of that firm, so no one else learns a firm is suspended.
CREATE FUNCTION public.my_suspended_firm_at_address(p_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT public.firm_is_suspended(f.id) AND public.admin_belongs_to_firm(f.id)
    FROM public.firms f
    WHERE f.address = lower(btrim(p_address))
      AND f.decision IS DISTINCT FROM 'refused'
      AND auth.uid() IS NOT NULL
      AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  ), false)
$$;

REVOKE ALL ON FUNCTION public.my_suspended_firm_at_address(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_suspended_firm_at_address(text) TO authenticated;

-- ---------- the firm's alerts ----------
-- A firm's alert (the advisor alert and the new-PEO-mail notice) is not sent while the firm is suspended, whether it is new or a
-- retry of one prepared before the suspension (D-35). The recipients of an alert are the firm's current members (20261116200000);
-- a suspended firm has none, so a send that was already claimed when the firm was suspended is told there is no one to tell and
-- retries later. The dispatcher also does not claim a firm's alert at all while the firm is suspended, so waiting costs no attempt
-- and nothing dies: lifting the suspension lets the same events go, with what was prepared for them. The employer's own
-- confirmation and reminders are not the firm's and go on.
CREATE OR REPLACE FUNCTION public.outbox_alert_recipients(p_session_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(array_agg(DISTINCT lower(btrim(u.email)) ORDER BY lower(btrim(u.email))), ARRAY[]::text[])
  FROM public.chamber_sessions s
  JOIN public.firm_memberships m ON m.firm_id = s.firm_id AND public.membership_is_current(m.valid_from, m.valid_until)
  JOIN auth.users u ON u.id = m.user_id
  WHERE s.id = p_session_id AND COALESCE(btrim(u.email), '') <> ''
    AND NOT public.firm_is_suspended(s.firm_id)
$$;

-- Is this outbox kind a firm's alert, sent to the firm's members? Internal.
CREATE FUNCTION public.outbox_kind_is_firm_alert(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT p_kind IN ('advisor_notification', 'peo_mail_arrived') $$;

REVOKE ALL ON FUNCTION public.outbox_kind_is_firm_alert(text) FROM PUBLIC, anon, authenticated;

-- claim_outbox_events as 20261106090000_hardening.sql leaves it, with one more condition on what is claimed.
CREATE OR REPLACE FUNCTION public.claim_outbox_events(
  p_kinds text[],
  p_batch integer,
  p_max_attempts integer,
  p_lock_seconds integer DEFAULT 600
)
RETURNS SETOF public.outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = left('suppressed: ' || s.reason, 200),
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  FROM public.email_suppressions s
  WHERE public.outbox_kind_reaches_prospect(e.kind)
    AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    AND s.address = lower(btrim(e.payload ->> 'recipient_email'));

  -- A draft reminder whose reason has gone is not sent: its owner stopped reminders, or the draft no longer closes
  -- when it says (a change moved the closing time; certifying, archiving or expiry ended it).
  UPDATE public.outbox_events e
  SET status = 'suppressed',
      last_error = CASE WHEN p.draft_reminders_at IS NULL THEN 'cancelled: reminders turned off' ELSE 'cancelled: the draft changed' END,
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  FROM public.chamber_sessions s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE e.kind = 'draft_expiry_reminder'
    AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    AND s.id = e.session_id
    AND (p.draft_reminders_at IS NULL
         OR s.status <> 'in_progress'
         OR s.expires_at IS NULL
         OR to_char(s.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') IS DISTINCT FROM e.payload ->> 'expires_at');

  RETURN QUERY
  UPDATE public.outbox_events e
  SET status = 'claimed', attempts = e.attempts + 1, claimed_at = now(),
      locked_until = now() + make_interval(secs => p_lock_seconds)
  WHERE e.id IN (
    SELECT o.id
    FROM public.outbox_events o
    WHERE o.kind = ANY (p_kinds)
      AND o.attempts < p_max_attempts
      AND NOT (public.outbox_kind_is_firm_alert(o.kind)
               AND public.firm_is_suspended((SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = o.session_id)))
      AND ((o.status = 'pending' AND o.next_attempt_at <= now()) OR (o.status = 'claimed' AND o.locked_until < now()))
    ORDER BY o.next_attempt_at, o.created_at
    LIMIT p_batch
    FOR UPDATE SKIP LOCKED
  )
  RETURNING e.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) TO service_role;

-- ---------- a member's mailbox, and held mail ----------
-- A mailbox is a current member's of a firm that is not suspended: nothing is sent as a member of a suspended firm, and no mailbox
-- is connected for one. The mailbox itself is kept, so it works again when the suspension is lifted (my_mailbox() already asks
-- is_firm_member, so the member is told it is not connected). Is this person a current member of any firm that is not suspended? Internal.
CREATE FUNCTION public.person_is_member_of_a_firm_in_good_standing(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.firm_memberships f
    WHERE f.user_id = p_user_id AND public.membership_is_current(f.valid_from, f.valid_until) AND NOT public.firm_is_suspended(f.firm_id))
$$;

REVOKE ALL ON FUNCTION public.person_is_member_of_a_firm_in_good_standing(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mailbox_secret(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('provider', m.provider, 'address', m.address, 'scope', m.scope,
                            'token_ciphertext', m.token_ciphertext, 'token_iv', m.token_iv)
  FROM public.broker_mailboxes m
  WHERE m.user_id = p_user_id
    AND public.person_is_member_of_a_firm_in_good_standing(m.user_id);
$$;

CREATE OR REPLACE FUNCTION public.mailbox_store(
  p_user_id uuid, p_provider text, p_address text, p_scope text, p_token_ciphertext text, p_token_iv text, p_rotated boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.person_is_member_of_a_firm_in_good_standing(p_user_id) THEN
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

-- Held mail. plan_mail_move and apply_mail_move as 20261116200000 leaves them, with two more refusals while a firm is suspended: a
-- member of the firm moves no mail off one of its threads, and mail held for the firm stays held (an admin does not assign it), and no
-- held mail is put onto the suspended firm's thread. Mail addressed to a suspended firm is still received and held as before.
CREATE OR REPLACE FUNCTION public.plan_mail_move(p_message_id bigint, p_target bigint, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  msg public.quote_request_messages;
  target public.quote_requests;
  target_firm uuid;
  prefix text;
BEGIN
  SELECT * INTO msg FROM public.quote_request_messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404';
  END IF;
  IF p_target IS NULL THEN
    IF NOT public.held_mail_actor_has(p_actor, 'advisor') OR NOT EXISTS (
      SELECT 1 FROM public.firm_memberships f
      WHERE f.user_id = p_actor AND f.firm_id = msg.firm_id AND public.membership_is_current(f.valid_from, f.valid_until)
        AND NOT public.firm_is_suspended(f.firm_id)
    ) THEN
      RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
    END IF;
    IF msg.quote_request_id IS NULL THEN
      RAISE EXCEPTION 'That message is already on the holding list' USING ERRCODE = '55000';
    END IF;
    prefix := 'held';
  ELSE
    IF NOT public.held_mail_actor_has(p_actor, 'admin') THEN
      RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;
    IF msg.quote_request_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only a held message can be assigned' USING ERRCODE = '55000';
    END IF;
    SELECT * INTO target FROM public.quote_requests WHERE id = p_target;
    SELECT s.firm_id INTO target_firm FROM public.chamber_sessions s WHERE s.id = target.session_id;
    IF NOT FOUND OR (msg.firm_id IS NOT NULL AND msg.firm_id IS DISTINCT FROM target_firm) THEN
      RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
    END IF;
    -- Mail held for a suspended firm stays held, and nothing is put onto a suspended firm's thread.
    IF public.firm_is_suspended(msg.firm_id) OR public.firm_is_suspended(target_firm) THEN
      RAISE EXCEPTION 'That firm is suspended' USING ERRCODE = '55000';
    END IF;
    prefix := target.session_id::text;
  END IF;
  RETURN jsonb_build_object('moves', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('attachment_id', a.id, 'from', a.storage_path, 'to', public.held_mail_path(a.storage_path, prefix)) ORDER BY a.id)
    FROM public.quote_request_message_attachments a
    WHERE a.message_id = msg.id AND a.status = 'stored' AND a.storage_path IS NOT NULL
      AND split_part(a.storage_path, '/', 1) <> prefix
  ), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_mail_move(p_message_id bigint, p_target bigint, p_actor uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  msg public.quote_request_messages;
  target public.quote_requests;
  target_firm uuid;
  actor_email text;
  prefix text;
  fresh boolean := false;
  clean_note text := NULLIF(left(btrim(COALESCE(p_note, '')), 500), '');
BEGIN
  SELECT * INTO msg FROM public.quote_request_messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404';
  END IF;
  SELECT u.email INTO actor_email FROM auth.users u WHERE u.id = p_actor;

  IF p_target IS NULL THEN
    IF NOT public.held_mail_actor_has(p_actor, 'advisor') OR NOT EXISTS (
      SELECT 1 FROM public.firm_memberships f
      WHERE f.user_id = p_actor AND f.firm_id = msg.firm_id AND public.membership_is_current(f.valid_from, f.valid_until)
        AND NOT public.firm_is_suspended(f.firm_id)
    ) THEN
      RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
    END IF;
    IF msg.quote_request_id IS NULL THEN
      RAISE EXCEPTION 'That message is already on the holding list' USING ERRCODE = '55000';
    END IF;
    prefix := 'held';
    UPDATE public.quote_request_messages
    SET quote_request_id = NULL, session_id = NULL, held_reason = 'moved_by_advisor', held_at = now(),
        moved_by = p_actor, moved_by_email = actor_email, moved_from_quote_request_id = msg.quote_request_id, moved_note = clean_note,
        new_sender = false
    WHERE id = msg.id;
    INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value, changed_by, changed_by_email)
    VALUES (msg.quote_request_id, msg.session_id, 'mail_moved_off', msg.id::text, p_actor, actor_email);
  ELSE
    IF NOT public.held_mail_actor_has(p_actor, 'admin') THEN
      RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
    END IF;
    IF msg.quote_request_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only a held message can be assigned' USING ERRCODE = '55000';
    END IF;
    SELECT * INTO target FROM public.quote_requests WHERE id = p_target;
    SELECT s.firm_id INTO target_firm FROM public.chamber_sessions s WHERE s.id = target.session_id;
    IF NOT FOUND OR (msg.firm_id IS NOT NULL AND msg.firm_id IS DISTINCT FROM target_firm) THEN
      RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
    END IF;
    -- Mail held for a suspended firm stays held, and nothing is put onto a suspended firm's thread.
    IF public.firm_is_suspended(msg.firm_id) OR public.firm_is_suspended(target_firm) THEN
      RAISE EXCEPTION 'That firm is suspended' USING ERRCODE = '55000';
    END IF;
    prefix := target.session_id::text;
    IF msg.direction = 'received' AND NOT msg.is_automatic THEN
      fresh := NOT EXISTS (
        SELECT 1 FROM public.quote_request_messages m
        WHERE m.quote_request_id = target.id
          AND (m.from_address = msg.from_address OR msg.from_address = ANY (m.to_addresses) OR msg.from_address = ANY (m.cc_addresses))
      );
    END IF;
    -- It joins the thread now, so it counts as mail nobody has opened yet (recorded_at is what "new" is measured by).
    UPDATE public.quote_request_messages
    SET quote_request_id = target.id, session_id = target.session_id, held_reason = NULL, held_at = NULL,
        moved_by = NULL, moved_by_email = NULL, moved_from_quote_request_id = NULL, moved_note = NULL,
        new_sender = fresh, recorded_at = now()
    WHERE id = msg.id;
    INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value, changed_by, changed_by_email)
    VALUES (target.id, target.session_id, 'mail_assigned', msg.id::text, p_actor, actor_email);
  END IF;

  UPDATE public.quote_request_message_attachments a
  SET storage_path = public.held_mail_path(a.storage_path, prefix), updated_at = now()
  WHERE a.message_id = msg.id AND a.status = 'stored' AND a.storage_path IS NOT NULL;

  RETURN jsonb_build_object('message_id', msg.id, 'quote_request_id', p_target, 'held', p_target IS NULL);
END;
$$;
