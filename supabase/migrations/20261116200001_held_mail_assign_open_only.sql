-- Assigning held mail needs a quote request that is still open. The list an admin picks from (admin_assignable_quote_requests) leaves closed
-- ones out, but the lookup of the chosen one did not: a request that closed after the admin loaded the list could still be assigned to.
-- Both the plan and the apply step now answer a closed quote request as one that isn't there. Nothing else changes.
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
    SELECT * INTO target FROM public.quote_requests WHERE id = p_target AND status <> 'closed';
    SELECT s.firm_id INTO target_firm FROM public.chamber_sessions s WHERE s.id = target.session_id;
    IF NOT FOUND OR (msg.firm_id IS NOT NULL AND msg.firm_id IS DISTINCT FROM target_firm) THEN
      RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
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
