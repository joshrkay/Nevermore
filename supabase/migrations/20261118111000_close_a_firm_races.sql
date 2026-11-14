-- CRM-P1.7 fixes 2, on top of 20261118110500_close_a_firm_fixes.sql (which is merged and not edited).
--
-- Removing the firm-row locks (20261118110500) opened races, and they come back here, each with a two-session test
-- (supabase/tests/close_a_firm_races.sql, which went red against the previous migration before this one existed). The firm's row is the one
-- lock that orders closing, suspending, deciding and members' writes (D-122):
--
--   * every guarded write takes the row FOR KEY SHARE inside assert_firm_writable (and in the helper the manuscript storage policies call);
--   * asking to close takes it FOR UPDATE before anything about the firm is read, then inserts the request;
--   * closing, suspending, lifting a suspension, withdrawing and stopping take it FOR UPDATE before they check anything
--     (admin_decide_firm already did).
--
-- FOR KEY SHARE conflicts only with FOR UPDATE. Two members' writes never wait on each other. A write that goes on to take FOR NO KEY UPDATE
-- (invite_member, the last-owner trigger) is not blocked by another write's KEY SHARE, so no pair of ordinary writes can deadlock, and one that
-- upgrades its own lock while a request waits is not blocked by the waiting request (tested). The functions that take FOR UPDATE take it before
-- any other lock, and hold nothing else while they wait for it, so they cannot be one side of a cycle.
--
-- The rest of this file: a due firm alert of a closed firm is ended by the claim itself; why a firm can't be asked to close is said by the
-- database; and the default firm's request, if one was ever made, is ended.

-- 1. The guard. VOLATILE now (a STABLE function can't lock, and would read the caller's older snapshot): it checks membership first, so
-- a person who is no member neither waits nor learns anything, then locks the row, then reads whether the firm is closing with a fresh snapshot.
CREATE OR REPLACE FUNCTION public.assert_firm_writable(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_firm_id IS NOT NULL AND public.admin_belongs_to_firm(p_firm_id) THEN
    PERFORM 1 FROM public.firms f WHERE f.id = p_firm_id FOR KEY SHARE;
    IF public.firm_is_read_only(p_firm_id) THEN
      RAISE EXCEPTION 'This firm is closing and can''t be changed' USING ERRCODE = 'PT423';
    END IF;
  END IF;
END;
$$;

-- 2. The same for the two storage policies. A policy expression can call a volatile function, so the manuscripts policies take the row FOR KEY
-- SHARE too (for the caller's own firm only; anyone else gets false at once and waits for nothing). The lock is held to the end of the transaction
-- that inserts or deletes the storage row, so a request to close waits for it and a row inserted after the request is refused. Known limit: the
-- file's bytes are written to the object store by the storage service outside the database transaction, so a file already on its way when a request
-- commits can still land in the bucket; what the lock orders is the row that makes it visible to the firm. Its consequence is one generated file
-- stored in the first moments of the read-only period, which is a generated copy of what the firm already holds.
CREATE OR REPLACE FUNCTION public.intake_folder_firm_read_only(p_folder text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  fid uuid;
BEGIN
  IF NOT public.intake_folder_in_my_firm(p_folder) THEN
    RETURN false;
  END IF;
  SELECT s.firm_id INTO fid FROM public.chamber_sessions s WHERE s.id::text = p_folder;
  PERFORM 1 FROM public.firms f WHERE f.id = fid FOR KEY SHARE;
  RETURN public.firm_is_read_only(fid);
END;
$$;

-- 3. A stop with no person (a repair, below) keeps its reason: the reason may exist without who. The rule is still that a reason is never blank.
ALTER TABLE public.firm_closures DROP CONSTRAINT firm_closures_stop_is_whole;
ALTER TABLE public.firm_closures ADD CONSTRAINT firm_closures_stop_is_whole CHECK (
  (stopped_by IS NULL OR stop_reason IS NOT NULL)
  AND (stop_reason IS NULL OR (withdrawn_at IS NOT NULL AND btrim(stop_reason) <> '' AND char_length(stop_reason) <= 500)));

-- 4. What a member's banner and Settings need, now with why an owner can't ask: 'default_firm', 'refused', 'closing' (a request is open), or
-- 'not_owner'. Null when the person may ask.
DROP FUNCTION public.my_firm_closure(uuid);
CREATE FUNCTION public.my_firm_closure(p_firm_id uuid)
RETURNS TABLE (asked_at timestamptz, closes_at timestamptz, can_ask boolean, cannot_ask_because text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.asked_at, c.closes_at, w.why IS NULL, w.why
  FROM public.firms f
  LEFT JOIN public.firm_closures c ON c.firm_id = f.id AND c.withdrawn_at IS NULL AND c.closed_at IS NULL
  CROSS JOIN LATERAL (SELECT CASE
      WHEN public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN 'not_owner'
      WHEN c.id IS NOT NULL THEN 'closing'
      WHEN f.id = public.default_firm_id() THEN 'default_firm'
      WHEN f.decision = 'refused' THEN 'refused'
    END AS why) w
  WHERE f.id = p_firm_id AND public.firm_role(p_firm_id) IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.my_firm_closure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_firm_closure(uuid) TO authenticated;

-- 5. Repair. Between 20261118110000 and 20261118110500 an owner of the default firm could ask to close it. An open request would keep it read-only
-- (the job refuses to close it, every day). This ends any such request as stopped by Nevermore with the reason, writes the firm's record the
-- way a stop does (as Nevermore's, no person), and emails no one. It does nothing where there is none, so it is safe to run again.
CREATE FUNCTION public.repair_default_firm_closure()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  fid uuid := public.default_firm_id();
  ended integer;
BEGIN
  PERFORM 1 FROM public.firms f WHERE f.id = fid FOR UPDATE;
  UPDATE public.firm_closures x
  SET withdrawn_at = now(), stop_reason = 'The default firm can''t be closed'
  WHERE x.firm_id = fid AND x.withdrawn_at IS NULL AND x.closed_at IS NULL;
  GET DIAGNOSTICS ended = ROW_COUNT;
  IF ended > 0 THEN
    INSERT INTO public.firm_activity (firm_id, actor_id, actor_is_staff, kind, record_type, record_id)
    VALUES (fid, NULL, true, 'closure_stopped', 'firm', fid::text);
  END IF;
  RETURN ended;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_default_firm_closure() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_default_firm_closure() TO service_role;
SELECT public.repair_default_firm_closure();

-- 6. The latest definition of each function below, with the one change named at it (the firm's row locked first).
CREATE OR REPLACE FUNCTION public.request_firm_closure(p_firm_id uuid, p_firm_name text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  f public.firms;
  c public.firm_closures;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  -- The firm's row, locked FOR UPDATE before anything is read about the firm: this waits for every guarded write in flight (each holds the
  -- row FOR KEY SHARE, see assert_firm_writable), and a write that starts after it waits for this to commit and then sees the request. It also
  -- orders this against refusing the firm, suspending it, withdrawing and closing, which take the same lock first.
  SELECT * INTO f FROM public.firms x WHERE x.id = p_firm_id FOR UPDATE;
  IF NOT FOUND OR f.decision = 'refused' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  -- The default firm takes the intakes people start on Nevermore (D-101): closing it would send every later intake to a firm nobody
  -- reads. It can't be closed until an intake can belong to another firm (D-121; New quote revisits this).
  IF p_firm_id = public.default_firm_id() THEN
    RAISE EXCEPTION 'This firm takes the intakes people start on Nevermore, so it can''t be closed' USING ERRCODE = 'PT403';
  END IF;
  IF lower(btrim(COALESCE(p_firm_name, ''))) <> lower(btrim(f.name)) THEN
    RAISE EXCEPTION 'Type the firm''s name exactly to confirm' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.firm_closures (firm_id, asked_by, closes_at)
    VALUES (p_firm_id, auth.uid(), now() + public.firm_closing_period())
    RETURNING * INTO c;
  EXCEPTION WHEN unique_violation THEN
    -- The unique index firm_closures_one_open is the rule (D-29); this only gives its usual message.
    RAISE EXCEPTION 'This firm is already closing' USING ERRCODE = 'PT409';
  END;
  PERFORM public.firm_activity_append(p_firm_id, 'closure_asked', 'firm', p_firm_id::text);
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  SELECT 'firm_closing', p_firm_id, 'firm_closing:asked:' || c.id,
         jsonb_build_object('event', 'asked', 'by_email', lower(btrim(u.email)), 'firm_name', f.name,
                            'closes_at', to_char(c.closes_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  FROM auth.users u WHERE u.id = auth.uid()
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
  RETURN c.closes_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.withdraw_firm_closure(p_firm_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  f public.firms;
  c public.firm_closures;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  -- The firm's row first (FOR UPDATE), as every function that decides the firm's state does: a withdrawal and the closing, or a stop, never
  -- interleave.
  SELECT * INTO f FROM public.firms x WHERE x.id = p_firm_id FOR UPDATE;
  -- One statement closes the open row: two withdrawals at once see the second find nothing, and a firm the job is closing is not
  -- withdrawn from under it.
  UPDATE public.firm_closures x SET withdrawn_at = now(), withdrawn_by = auth.uid()
  WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL AND x.closes_at > now()
  RETURNING * INTO c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This firm is not waiting to close' USING ERRCODE = 'PT409';
  END IF;
  PERFORM public.firm_activity_append(p_firm_id, 'closure_withdrawn', 'firm', p_firm_id::text);
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  SELECT 'firm_closing', p_firm_id, 'firm_closing:withdrawn:' || c.id,
         jsonb_build_object('event', 'withdrawn', 'by_email', lower(btrim(u.email)), 'firm_name', f.name)
  FROM auth.users u WHERE u.id = auth.uid()
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_firm_now(p_firm_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c public.firm_closures;
  step record;
  m record;
  counts jsonb := '{}'::jsonb;
  n integer;
  ended integer := 0;
  boxes_before integer;
  boxes_after integer;
BEGIN
  -- The firm's row first (FOR UPDATE): a suspension, a refusal, a withdrawal or a stop that is committing is waited for, and everything below
  -- reads the state after it. This lock is what orders them; the request row is not locked separately.
  PERFORM 1 FROM public.firms f WHERE f.id = p_firm_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  -- Never the default firm, whatever a request row says (D-121).
  IF p_firm_id = public.default_firm_id() THEN
    RAISE EXCEPTION 'This firm takes the intakes people start on Nevermore, so it can''t be closed' USING ERRCODE = 'PT403';
  END IF;
  SELECT * INTO c FROM public.firm_closures x WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm has no request to close' USING ERRCODE = 'PT404';
  END IF;
  IF c.closes_at > now() THEN
    RAISE EXCEPTION 'The 30 days have not ended' USING ERRCODE = '55000';
  END IF;
  -- A suspended firm is not closed: the request stays open and the firm stays as the suspension leaves it.
  IF public.firm_is_suspended(p_firm_id) THEN
    RAISE EXCEPTION 'A suspended firm is not closed' USING ERRCODE = '55000';
  END IF;
  PERFORM set_config('nevermore.closing_firm', p_firm_id::text, true);

  SELECT count(*) INTO boxes_before FROM public.broker_mailboxes b
  WHERE b.user_id IN (SELECT x.user_id FROM public.firm_memberships x WHERE x.firm_id = p_firm_id);

  UPDATE public.firm_memberships x SET team_id = NULL WHERE x.firm_id = p_firm_id AND x.team_id IS NOT NULL;
  UPDATE public.firm_member_suspensions x SET team_id = NULL WHERE x.firm_id = p_firm_id AND x.team_id IS NOT NULL;

  FOR step IN SELECT p.src, p.firm_column FROM public.firm_closing_plan() p WHERE p.action = 'delete' ORDER BY p.ord, p.src LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = $1', substr(step.src, length('public.') + 1), step.firm_column) USING p_firm_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object(substr(step.src, length('public.') + 1), n);
  END LOOP;

  -- Every member's access ends. The ending is the one every other path uses (end_membership_now); the last owner's rule is waived
  -- for this firm and this moment only (keep_firm_owner).
  FOR m IN
    SELECT x.id, x.valid_from, public.membership_is_current(x.valid_from, x.valid_until) AS is_current
    FROM public.firm_memberships x
    WHERE x.firm_id = p_firm_id AND (x.valid_until IS NULL OR x.valid_until > now())
    ORDER BY x.id
  LOOP
    IF m.is_current THEN
      PERFORM public.end_membership_now(m.id, 'The last owner of a firm can''t be removed');
    ELSE
      PERFORM set_config('nevermore.membership_change', 'on', true);
      UPDATE public.firm_memberships x SET valid_until = x.valid_from WHERE x.id = m.id;
      PERFORM set_config('nevermore.membership_change', 'off', true);
    END IF;
    ended := ended + 1;
  END LOOP;
  counts := counts || jsonb_build_object('memberships_ended', ended);

  UPDATE public.firm_member_suspensions x SET ended_at = now(), ended_how = 'removed' WHERE x.firm_id = p_firm_id AND x.ended_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('member_suspensions_ended', n);

  SELECT count(*) INTO boxes_after FROM public.broker_mailboxes b
  WHERE b.user_id IN (SELECT x.user_id FROM public.firm_memberships x WHERE x.firm_id = p_firm_id);
  counts := counts || jsonb_build_object('broker_mailboxes', boxes_before - boxes_after);

  -- The firm's alerts that are still waiting have no one to go to: they end, as a cancelled reminder does, so nothing waits for good.
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = 'cancelled: the firm closed', claimed_at = NULL, locked_until = NULL, pending_send = NULL
  WHERE e.status IN ('pending', 'claimed') AND public.outbox_kind_is_firm_alert(e.kind)
    AND COALESCE(e.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = e.session_id)) = p_firm_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('alerts_cancelled', n);

  UPDATE public.firm_closures x
  SET closed_at = now(), deleted_counts = counts, address = (SELECT f.address FROM public.firms f WHERE f.id = p_firm_id)
  WHERE x.id = c.id;
  PERFORM set_config('nevermore.closing_firm', '', true);
  RETURN counts;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_suspend_firm(p_firm_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  clean_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason = '' OR char_length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'Give a reason of 1 to 500 characters' USING ERRCODE = '22023';
  END IF;
  -- The firm's row first (FOR UPDATE): a closing that is running is waited for, and then the firm reads as closed; a suspension that is
  -- committing is seen by the closing, which then refuses to close.
  PERFORM 1 FROM public.firms f WHERE f.id = p_firm_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  IF public.firm_is_closed(p_firm_id) THEN
    RAISE EXCEPTION 'That firm is closed' USING ERRCODE = '55000';
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_lift_firm_suspension(p_firm_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  lifted integer;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  -- The firm's row first (FOR UPDATE), as suspending does: the closing sees the lift and the date it moved, or the lift sees the firm closed.
  PERFORM 1 FROM public.firms f WHERE f.id = p_firm_id FOR UPDATE;
  IF NOT FOUND THEN
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
  -- A request to close that waited out the suspension is not decided the moment it is lifted: its owners get seven days, at least, to
  -- withdraw it, and the date they are shown is the later one.
  UPDATE public.firm_closures x SET closes_at = greatest(x.closes_at, now() + public.firm_closing_grace())
  WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL;
  PERFORM public.record_firm_event(p_firm_id, 'firm_restored', auth.uid(), '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_stop_firm_closure(p_firm_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  clean_reason text := btrim(COALESCE(p_reason, ''));
  c public.firm_closures;
  f public.firms;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean_reason = '' OR char_length(clean_reason) > 500 THEN
    RAISE EXCEPTION 'Give a reason of 1 to 500 characters' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.id = p_firm_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  IF public.admin_belongs_to_firm(p_firm_id) THEN
    RAISE EXCEPTION 'An admin does not stop the closing of a firm they belong to' USING ERRCODE = '42501';
  END IF;
  UPDATE public.firm_closures x
  SET withdrawn_at = now(), stopped_by = auth.uid(), stop_reason = clean_reason
  WHERE x.firm_id = p_firm_id AND x.withdrawn_at IS NULL AND x.closed_at IS NULL
  RETURNING * INTO c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This firm is not waiting to close' USING ERRCODE = 'PT409';
  END IF;
  PERFORM public.firm_activity_append(p_firm_id, 'closure_stopped', 'firm', p_firm_id::text);
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  VALUES ('firm_closing', p_firm_id, 'firm_closing:stopped:' || c.id, jsonb_build_object('event', 'stopped', 'firm_name', f.name))
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_outbox_events(p_kinds text[], p_batch integer, p_max_attempts integer, p_lock_seconds integer DEFAULT 600)
 RETURNS SETOF outbox_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- A firm alert that was queued while the firm was closing, after the closing had ended what was waiting but before it committed, was not
  -- ended by anything else. It is ended here, before anything is claimed, so nothing of a closed firm waits for good.
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = 'cancelled: the firm closed', claimed_at = NULL, locked_until = NULL, pending_send = NULL
  WHERE public.outbox_kind_is_firm_alert(e.kind)
    AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    AND public.firm_is_closed(COALESCE(e.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = e.session_id)));

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
               AND (public.firm_is_suspended(COALESCE(o.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = o.session_id)))
                   OR public.firm_is_closed(COALESCE(o.firm_id, (SELECT cs.firm_id FROM public.chamber_sessions cs WHERE cs.id = o.session_id)))))
      AND ((o.status = 'pending' AND o.next_attempt_at <= now()) OR (o.status = 'claimed' AND o.locked_until < now()))
    ORDER BY o.next_attempt_at, o.created_at
    LIMIT p_batch
    FOR UPDATE SKIP LOCKED
  )
  RETURNING e.*;
END;
$function$;
