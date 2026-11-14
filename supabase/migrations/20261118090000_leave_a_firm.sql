-- Leave a firm (story CRM-P1.6; docs/BROKER_CRM_BUILD.md D-16, D-18, D-33, D-35, D-102).
--
-- A member ends their own membership. It is the same ending an owner gives a member when removing them (CRM-P1.5): one internal
-- function ends the membership, and remove_member and leave_firm both call it, so the last-owner rule, the dating and the deletion
-- of a stored mailbox (a trigger on the end of a membership) are one thing, not two.

-- 0. Leaving is its own kind of entry in the firm's record, beside 'member_removed': the owners can tell who chose to go from who was
-- sent. The list is the one 20261117160000_epics_reconciled.sql states, with 'member_left' added. src/data/firmActivity.ts
-- (ENTRY_KINDS) is kept in step by src/data/schemaSync.test.ts, which reads the list of the latest migration that holds it.
ALTER TABLE public.firm_activity DROP CONSTRAINT IF EXISTS firm_activity_kind_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    -- sync:begin firm_activity_kinds
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused', 'invitation_withdrawn',
    'member_suspended', 'member_restored',
    'firm_suspended', 'firm_restored',
    'member_left'
    -- sync:end firm_activity_kinds
  ));

-- 1. Ending a current membership now. Internal. The last-owner rule is keep_firm_owner() (20261116090000), a trigger that takes the
-- firm's row lock before it counts; it is only given plain words here, by the caller, since the words differ for "removed" and "leave".
-- The caller has already locked the row and checked who may do this.
CREATE FUNCTION public.end_membership_now(p_membership_id bigint, p_last_owner_message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- The caller writes the one entry for the firm's record, as what it is; the trigger that writes "ended a membership" stays quiet.
  PERFORM set_config('nevermore.membership_change', 'on', true);
  BEGIN
    UPDATE public.firm_memberships x SET valid_until = now() WHERE x.id = p_membership_id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION '%', p_last_owner_message USING ERRCODE = '23514';
  END;
  PERFORM set_config('nevermore.membership_change', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.end_membership_now(bigint, text) FROM PUBLIC, anon, authenticated;

-- 2. Removing a member: 20261116220500's function, with the ending taken out into end_membership_now above. Nothing else changes.
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
    PERFORM public.end_membership_now(m.id, 'The last owner of a firm can''t be removed. Make someone else an owner first.');
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

-- 3. Leaving. The caller's own membership of that firm, and no one else's: nothing names another person. Only a current member
-- passes (firm_role: signed in, past the second factor, at this firm's address, firm not suspended). A platform admin who is no
-- member of the firm has nothing to leave (D-16).
CREATE FUNCTION public.leave_firm(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m public.firm_memberships;
BEGIN
  IF public.firm_role(p_firm_id) IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this firm' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO m FROM public.firm_memberships x
  WHERE x.firm_id = p_firm_id AND x.user_id = auth.uid() AND public.membership_is_current(x.valid_from, x.valid_until)
  FOR UPDATE;
  IF NOT FOUND OR (m.valid_until IS NOT NULL AND m.valid_until <= clock_timestamp()) THEN
    RAISE EXCEPTION 'You are not a member of this firm' USING ERRCODE = 'PT404';
  END IF;
  PERFORM public.end_membership_now(m.id, 'You are the last owner of this firm, so you can''t leave it. Make someone else an owner first.');
  -- Written once, as what it is. The person who left was acting as a member, though the row they just ended no longer says so (D-33).
  PERFORM public.firm_activity_append(p_firm_id, 'member_left', 'membership', m.id::text, m.user_id, m.role, true);
  -- The owners are told in the same step, so a leaving that is not told, or a telling of a leaving that failed, cannot happen. The email
  -- names who left and when, and the firm: no role, no reason, nothing they made. The time is the time the membership ended.
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  SELECT 'member_left', p_firm_id, 'member_left:' || m.id,
         jsonb_build_object('member_email', lower(btrim(u.email)), 'left_at', to_char(x.valid_until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'firm_name', f.name)
  FROM public.firm_memberships x
  JOIN auth.users u ON u.id = x.user_id
  JOIN public.firms f ON f.id = x.firm_id
  WHERE x.id = m.id
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_firm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_firm(uuid) TO authenticated;

-- 4. The email to a firm's owners goes through the outbox the firm's alerts already use (20261025090000, 20261111140000), with one
-- difference: it belongs to the firm, not to an intake, so an outbox row may now have a firm and no intake. Every kind that had an
-- intake still must have one; only 'member_left' has none, and must have its firm.
ALTER TABLE public.outbox_events ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE public.outbox_events ADD COLUMN firm_id uuid REFERENCES public.firms (id) ON DELETE CASCADE;
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_events_one_target CHECK (
  CASE WHEN kind = 'member_left' THEN session_id IS NULL AND firm_id IS NOT NULL ELSE session_id IS NOT NULL AND firm_id IS NULL END);

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request', 'draft_expiry_reminder', 'peo_mail_arrived', 'member_left'
    -- sync:end outbox_kinds
  ));

-- A firm's alert is sent to people of the firm, so it waits while the firm is suspended (20261116230000). The email to the owners is one.
CREATE OR REPLACE FUNCTION public.outbox_kind_is_firm_alert(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT p_kind IN ('advisor_notification', 'peo_mail_arrived', 'member_left') $$;

-- claim_outbox_events as 20261116230000 leaves it, with one change: the firm an alert belongs to is the event's own firm when it has
-- one, else its intake's. (An event with no intake would otherwise never be claimed: its firm would read as unknown.)
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
               AND public.firm_is_suspended(COALESCE(o.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = o.session_id))))
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

-- Who the email goes to: the firm's current owners, asked by dispatch-outbox as the service role each time it builds or resends the
-- message, so someone who has stopped being an owner stops receiving at once (D-35), and the person who left, who no longer holds a
-- membership, is never among them. Nobody while the firm is suspended, as for the firm's other alerts.
CREATE FUNCTION public.outbox_owner_recipients(p_firm_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(array_agg(DISTINCT lower(btrim(u.email)) ORDER BY lower(btrim(u.email))), ARRAY[]::text[])
  FROM public.firm_memberships m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.firm_id = p_firm_id AND m.role = 'owner' AND public.membership_is_current(m.valid_from, m.valid_until)
    AND COALESCE(btrim(u.email), '') <> ''
    AND NOT public.firm_is_suspended(p_firm_id)
$$;

REVOKE ALL ON FUNCTION public.outbox_owner_recipients(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outbox_owner_recipients(uuid) TO service_role;

-- A bounce never suppresses an owner's address: record_email_delivery_event as 20261111140000 leaves it, with 'member_left' guarded
-- like the firm's other alerts.
CREATE OR REPLACE FUNCTION public.record_email_delivery_event(
  p_event_id text,
  p_type text,
  p_message_id text,
  p_recipients text[],
  p_bounce_type text,
  p_detail text,
  p_occurred_at timestamptz,
  p_protected text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipients text[];
  v_guard text[];
  v_kind text;
  v_sent_to text;
  v_acts boolean;
  v_reason text;
  v_suppress text[];
  v_protected_hit text[];
  v_outcome text;
  v_new_id uuid;
BEGIN
  IF p_event_id IS NULL OR btrim(p_event_id) = '' OR length(p_event_id) > 200 THEN
    RAISE EXCEPTION 'record_email_delivery_event: an event id is required' USING ERRCODE = '22023';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('email.bounced', 'email.complained', 'email.delivery_delayed', 'email.failed', 'email.suppressed') THEN
    RAISE EXCEPTION 'record_email_delivery_event: unsupported event type' USING ERRCODE = '22023';
  END IF;

  v_recipients := ARRAY(
    SELECT DISTINCT lower(btrim(r)) FROM unnest(COALESCE(p_recipients, ARRAY[]::text[])) AS r
    WHERE btrim(r) <> '' AND length(btrim(r)) <= 320
    LIMIT 20
  );
  v_guard := ARRAY(
    SELECT DISTINCT lower(btrim(g)) FROM unnest(COALESCE(p_protected, ARRAY[]::text[])) AS g WHERE btrim(g) <> ''
  );

  IF p_message_id IS NOT NULL THEN
    SELECT e.kind, lower(btrim(e.payload ->> 'recipient_email'))
    INTO v_kind, v_sent_to
    FROM public.outbox_events e
    WHERE e.provider_message_id = p_message_id
    ORDER BY e.created_at DESC
    LIMIT 1;
  END IF;
  IF v_kind IN ('advisor_notification', 'peo_mail_arrived', 'member_left') THEN
    v_guard := v_guard || v_recipients;
  ELSIF public.outbox_kind_reaches_prospect(v_kind) AND v_sent_to IS NOT NULL AND v_sent_to = ANY (v_recipients) THEN
    v_recipients := ARRAY[v_sent_to];
  END IF;

  -- Only what says the address cannot or must not be mailed acts. A transient bounce, a delay and
  -- a failure are the provider still trying (or reporting a fault of its own).
  v_acts := p_type IN ('email.complained', 'email.suppressed')
            OR (p_type = 'email.bounced' AND lower(COALESCE(p_bounce_type, '')) = 'permanent');
  v_reason := CASE p_type WHEN 'email.complained' THEN 'complained' WHEN 'email.suppressed' THEN 'provider_suppressed' ELSE 'bounced' END;
  v_suppress := CASE WHEN v_acts THEN ARRAY(SELECT r FROM unnest(v_recipients) AS r WHERE r <> ALL (v_guard)) ELSE ARRAY[]::text[] END;
  v_protected_hit := CASE WHEN v_acts THEN ARRAY(SELECT r FROM unnest(v_recipients) AS r WHERE r = ANY (v_guard)) ELSE ARRAY[]::text[] END;
  v_outcome := CASE
    WHEN cardinality(v_suppress) > 0 THEN 'suppressed'
    WHEN cardinality(v_protected_hit) > 0 THEN 'protected'
    ELSE 'recorded'
  END;

  INSERT INTO public.email_delivery_events
    (provider_event_id, type, provider_message_id, recipients, bounce_type, detail, outcome, occurred_at)
  VALUES (
    btrim(p_event_id), p_type, left(p_message_id, 200), v_recipients, left(NULLIF(btrim(p_bounce_type), ''), 40),
    -- Addresses are redacted by the function too; this is the backstop for what it missed.
    left(NULLIF(btrim(regexp_replace(COALESCE(p_detail, ''), '[^\s@<>,;"()]+@[^\s@<>,;"()]+', '[email]', 'g')), ''), 200),
    v_outcome, COALESCE(p_occurred_at, now())
  )
  ON CONFLICT (provider_event_id) DO NOTHING
  RETURNING id INTO v_new_id;
  IF v_new_id IS NULL THEN
    RETURN jsonb_build_object('duplicate', true);
  END IF;

  INSERT INTO public.email_suppressions (address, reason, first_event_id)
  SELECT r, v_reason, v_new_id FROM unnest(v_suppress) AS r
  ON CONFLICT (address) DO UPDATE
    SET event_count = public.email_suppressions.event_count + 1,
        updated_at = now(),
        -- A complaint is the stronger statement; otherwise the first reason stands.
        reason = CASE WHEN EXCLUDED.reason = 'complained' THEN 'complained' ELSE public.email_suppressions.reason END;

  -- What is already waiting for that address goes no further. (The claim does the same for
  -- anything queued later.)
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = left('suppressed: ' || v_reason, 200),
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  WHERE public.outbox_kind_reaches_prospect(e.kind) AND e.status = 'pending'
    AND lower(btrim(e.payload ->> 'recipient_email')) = ANY (v_suppress);

  RETURN jsonb_build_object(
    'duplicate', false, 'outcome', v_outcome,
    'suppressed', cardinality(v_suppress), 'protected', cardinality(v_protected_hit)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_email_delivery_event(text, text, text, text[], text, text, timestamptz, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_email_delivery_event(text, text, text, text[], text, text, timestamptz, text[]) TO service_role;
