-- Mail for a reply address that belongs to no live record goes to the right firm's holding list, or the platform's (CRM-P2.2;
-- docs/BROKER_CRM_BUILD.md D-16, D-18, D-24).
--
-- record_inbound_mail() held mail for a revoked address under the firm of whichever address on the message sorted first, and
-- under no firm when an address nobody held happened to sort before it. It also filed a message sent to the revoked addresses of
-- two firms under one of them, whichever sorted first, so one firm read mail that was as much the other's. Now:
--   * every address of ours the message was sent to, live or revoked, is looked up, with the firm of each;
--   * a message held for addresses that all belong to one firm is held for that firm (a revoked address; two live addresses of one
--     firm that make it ambiguous), whatever else it was sent to;
--   * a message sent to addresses of two firms is ambiguous, and belongs to no firm: the platform's list, which shows only its File ID
--     and PEO (admin_held_mail). So is mail for an address nobody ever held.
-- A message on a quote request keeps the firm of that request's intake, as before (stamp_message_firm).

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.record_inbound_mail(
  p_provider_message_id text, p_local_parts text[], p_from_address text, p_from_name text, p_to text[], p_cc text[],
  p_subject text, p_body_text text, p_body_truncated boolean, p_headers jsonb, p_is_automatic boolean, p_sent_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  existing public.quote_request_messages;
  locals text[] := COALESCE((SELECT array_agg(DISTINCT lower(btrim(x))) FROM unnest(COALESCE(p_local_parts, '{}')) x WHERE btrim(x) <> ''), '{}');
  from_addr text := lower(btrim(COALESCE(p_from_address, '')));
  live_requests bigint[];
  req public.quote_requests;
  reason text;
  chosen_local text;
  matched_firms uuid[];
  matched_local text;
  held_firm uuid;
  dir text := 'received';
  fresh boolean := false;
  msg public.quote_request_messages;
BEGIN
  IF COALESCE(btrim(p_provider_message_id), '') = '' THEN
    RAISE EXCEPTION 'A message needs the provider''s id' USING ERRCODE = '22023';
  END IF;
  IF from_addr = '' THEN
    RAISE EXCEPTION 'A message needs a sender' USING ERRCODE = '22023';
  END IF;

  -- A replay records nothing new.
  SELECT * INTO existing FROM public.quote_request_messages WHERE provider_message_id = p_provider_message_id;
  IF FOUND THEN
    RETURN jsonb_build_object('message_id', existing.id, 'duplicate', true, 'held', existing.quote_request_id IS NULL,
      'held_reason', existing.held_reason, 'quote_request_id', existing.quote_request_id, 'session_id', existing.session_id);
  END IF;

  SELECT array_agg(DISTINCT a.quote_request_id) INTO live_requests
  FROM public.quote_request_addresses a WHERE a.local_part = ANY (locals) AND a.revoked_at IS NULL;

  -- Every address of ours the message was sent to, live or revoked: whose firms they are, and the first of them by name.
  SELECT array_agg(DISTINCT s.firm_id), min(a.local_part) INTO matched_firms, matched_local
  FROM public.quote_request_addresses a JOIN public.chamber_sessions s ON s.id = a.session_id
  WHERE a.local_part = ANY (locals);

  IF COALESCE(array_length(live_requests, 1), 0) = 1 THEN
    SELECT * INTO req FROM public.quote_requests WHERE id = live_requests[1];
    SELECT a.local_part INTO chosen_local FROM public.quote_request_addresses a
      WHERE a.quote_request_id = req.id AND a.local_part = ANY (locals) AND a.revoked_at IS NULL LIMIT 1;
  ELSIF COALESCE(array_length(live_requests, 1), 0) > 1 THEN
    reason := 'ambiguous_address';
  ELSIF matched_local IS NOT NULL THEN
    -- Addresses of two firms on one message are ambiguous too: no one firm can claim it.
    reason := CASE WHEN array_length(matched_firms, 1) > 1 THEN 'ambiguous_address' ELSE 'revoked_address' END;
  ELSE
    reason := 'unknown_address';
  END IF;
  -- Mail held for one firm's address, or addresses, is that firm's; anything else is the platform's alone (no firm).
  IF req.id IS NULL AND array_length(matched_firms, 1) = 1 THEN
    held_firm := matched_firms[1];
  END IF;
  IF chosen_local IS NULL THEN
    chosen_local := COALESCE(matched_local, locals[1]);
  END IF;

  -- An advisor's own copied-in message is "sent by hand".
  IF EXISTS (
    SELECT 1 FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id
    WHERE lower(u.email) = from_addr AND r.role IN ('advisor', 'admin')
  ) THEN
    dir := 'sent_by_hand';
  END IF;

  -- A sender not seen on the thread before: not among the earlier senders, and not among the people an earlier
  -- message was addressed to (the PEO contact the advisor wrote to is not a stranger).
  IF req.id IS NOT NULL AND dir = 'received' AND NOT COALESCE(p_is_automatic, false) THEN
    fresh := NOT EXISTS (
      SELECT 1 FROM public.quote_request_messages m
      WHERE m.quote_request_id = req.id
        AND (m.from_address = from_addr OR from_addr = ANY (m.to_addresses) OR from_addr = ANY (m.cc_addresses))
    );
  END IF;

  INSERT INTO public.quote_request_messages (
    provider_message_id, quote_request_id, session_id, firm_id, address_local_part, held_reason, direction, is_automatic,
    new_sender, from_address, from_name, to_addresses, cc_addresses, subject, body_text, body_truncated, headers, sent_at)
  VALUES (
    p_provider_message_id, req.id, req.session_id, held_firm, chosen_local, reason, dir, COALESCE(p_is_automatic, false),
    fresh, from_addr, NULLIF(left(btrim(COALESCE(p_from_name, '')), 200), ''),
    COALESCE((SELECT array_agg(lower(btrim(x))) FROM unnest(COALESCE(p_to, '{}')) x), '{}'),
    COALESCE((SELECT array_agg(lower(btrim(x))) FROM unnest(COALESCE(p_cc, '{}')) x), '{}'),
    left(p_subject, 998), p_body_text, COALESCE(p_body_truncated, false), COALESCE(p_headers, '{}'::jsonb), p_sent_at)
  ON CONFLICT (provider_message_id) DO NOTHING
  RETURNING * INTO msg;
  IF msg.id IS NULL THEN
    -- Another call recorded it between the check and the insert.
    SELECT * INTO msg FROM public.quote_request_messages WHERE provider_message_id = p_provider_message_id;
    RETURN jsonb_build_object('message_id', msg.id, 'duplicate', true, 'held', msg.quote_request_id IS NULL,
      'held_reason', msg.held_reason, 'quote_request_id', msg.quote_request_id, 'session_id', msg.session_id);
  END IF;
  RETURN jsonb_build_object('message_id', msg.id, 'duplicate', false, 'held', msg.quote_request_id IS NULL,
    'held_reason', msg.held_reason, 'quote_request_id', msg.quote_request_id, 'session_id', msg.session_id);
END;
$$;
