-- Three lines of work each rewrote the same database objects without seeing the others: removing or suspending a member and the
-- firm-scope fixes (crm/epic-01-firms-security), suspending a firm (main), and one firm at a time (crm/epic-02-shell-tables).
-- Loaded in filename order, the later file silently undid the earlier one's rule. This migration states each object once, with
-- every rule its rewrites added, and changes nothing else. Each story's own SQL test (firm_members, firm_suspension,
-- files_tokens_addresses, one_firm_at_a_time, console_per_firm, data_isolation) now loads every migration, this one included,
-- so each rule is proved against the whole schema.
--
--   firm_activity_kind_check  20261116230000 dropped member_suspended and member_restored (20261116220000), so suspending a
--                             member failed on the check.
--   apply_mail_move,          20261116230000 dropped "not onto a closed quote request" and its row lock (20261116200500).
--   plan_mail_move
--   mailbox_store             20261116230000 dropped the mailbox owner's lock (20261116220500).
--   firm_role                 20261117090000 dropped "not while the firm is suspended" (20261116230000), which reopened every
--                             policy and function that asks it to a suspended firm's members.
--   my_firms                  20261117090500 dropped "not while the firm is suspended" (20261116230000), which let a suspended
--                             firm's members back into the console.

-- 1. Every kind of entry a firm's record holds. src/data/firmActivity.ts (ENTRY_KINDS) is kept in step by
-- src/data/schemaSync.test.ts, which reads the list of the latest migration that holds it.
ALTER TABLE public.firm_activity DROP CONSTRAINT IF EXISTS firm_activity_kind_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    -- sync:begin firm_activity_kinds
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused', 'invitation_withdrawn',
    'member_suspended', 'member_restored',
    'firm_suspended', 'firm_restored'
    -- sync:end firm_activity_kinds
  ));

-- 2. Moving held mail: a suspended firm's mail stays held (20261116230000) and nothing lands on a closed request (20261116200500).
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
    SELECT * INTO target FROM public.quote_requests WHERE id = p_target AND status <> 'closed';
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
    -- FOR UPDATE: a request being closed by another transaction is waited for, and the open check is read again afterwards, so the
    -- mail is never put on a request that closed between the check and this commit.
    SELECT * INTO target FROM public.quote_requests WHERE id = p_target AND status <> 'closed' FOR UPDATE;
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

-- 3. Connecting a mailbox: the owner's lock (20261116220500) and a firm in good standing (20261116230000).
CREATE OR REPLACE FUNCTION public.mailbox_store(
  p_user_id uuid, p_provider text, p_address text, p_scope text, p_token_ciphertext text, p_token_iv text, p_rotated boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.lock_mailbox_owner(p_user_id);
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

-- 4. A member's role in a firm: at this address's firm only (20261117090000), and not while the firm is suspended (20261116230000).
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
    AND public.address_admits_firm(p_firm_id)
    AND NOT public.firm_is_suspended(p_firm_id)
$$;

-- 5. The firms a person is a current member of: with whether each was refused (20261117090500), leaving out a suspended firm
-- (20261116230000). The shape is unchanged, so nothing that reads it needs dropping.
CREATE OR REPLACE FUNCTION public.my_firms()
RETURNS TABLE (firm_id uuid, name text, address text, role text, refused boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT f.id, f.name, f.address, m.role, f.decision IS NOT DISTINCT FROM 'refused'
  FROM public.firm_memberships m
  JOIN public.firms f ON f.id = m.firm_id
  WHERE m.user_id = auth.uid()
    AND public.membership_is_current(m.valid_from, m.valid_until)
    AND NOT public.firm_is_suspended(f.id)
    AND public.is_signed_in_person()
    AND public.second_factor_rule_met()
  ORDER BY f.name, f.id
$$;
