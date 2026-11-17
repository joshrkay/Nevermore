-- Suggesting what a PEO's reply means (N-1.1, slice 7.4; docs/BROKER_CRM_BUILD.md D-740 to D-749; supabase/tests/reply_suggestions.sql).

ALTER TABLE public.quote_request_messages ADD COLUMN suggested_status text, ADD COLUMN suggestion_outcome text,
  ADD COLUMN suggestion_decided_by uuid, ADD COLUMN suggestion_decided_at timestamptz;

-- The mail function's alone (service role): what the model made of a reply. A suggestion only; nothing here touches the quote request.
CREATE FUNCTION public.record_reply_suggestion(p_message_id bigint, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.quote_request_messages SET suggested_status = p_status
  WHERE id = p_message_id AND direction = 'received' AND quote_request_id IS NOT NULL AND suggested_status IS NULL;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.quote_request_messages WHERE id = p_message_id AND suggested_status IS NOT NULL) THEN
      RAISE EXCEPTION 'This reply already has its suggestion' USING ERRCODE = '22023';
    END IF;
    RAISE EXCEPTION 'Only a reply from a PEO is read' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_reply_suggestion(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_reply_suggestion(bigint, text) TO service_role;

-- The suggestion is one of four words: what a reply can mean that the agent may then record. Nothing else is kept, so no sentence of the model's or the reply's can be.
ALTER TABLE public.quote_request_messages ADD CONSTRAINT quote_request_messages_suggestion_check CHECK (
  suggested_status IS NULL OR suggested_status IN ('acknowledged', 'question_open', 'quoted', 'declined')
);

-- An agent of the firm settles a suggestion: accepts it (the status is recorded through advisor_set_quote_request_status) or dismisses it. The record keeps which suggestion it was and what became of it, with who and when, never a word of the reply.
CREATE FUNCTION public.advisor_decide_reply_suggestion(p_message_id bigint, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  msg public.quote_request_messages;
BEGIN
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_request_messages zm JOIN public.chamber_sessions zs ON zs.id = zm.session_id WHERE zm.id = p_message_id));
  PERFORM public.require_advisor();
  IF p_decision IS NULL OR p_decision NOT IN ('accept', 'dismiss') THEN
    RAISE EXCEPTION 'Accept or dismiss' USING ERRCODE = '22023';
  END IF;
  SELECT m.* INTO msg FROM public.quote_request_messages m
  WHERE m.id = p_message_id AND m.suggested_status IS NOT NULL AND m.quote_request_id IS NOT NULL AND public.quote_request_in_my_firm(m.quote_request_id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found' USING ERRCODE = 'PT404';
  END IF;
  IF msg.suggestion_outcome IS NOT NULL THEN
    RAISE EXCEPTION 'This suggestion is already settled' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'accept' AND msg.suggested_status IN ('acknowledged', 'question_open') THEN
    -- The existing writer, never a new one: it logs who and when, and refuses what is closed or already so.
    PERFORM public.advisor_set_quote_request_status(msg.quote_request_id, msg.suggested_status);
  ELSIF p_decision = 'accept' AND NOT EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.id = msg.quote_request_id AND q.status = msg.suggested_status) THEN
    -- A quote and a decline are recorded with their own forms (their figures, their reason): accepting waits for that.
    RAISE EXCEPTION 'Record the % first, with its %, then accept this', CASE msg.suggested_status WHEN 'quoted' THEN 'quote' ELSE 'decline' END,
      CASE msg.suggested_status WHEN 'quoted' THEN 'figures' ELSE 'reason' END USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_request_messages SET suggestion_outcome = CASE p_decision WHEN 'accept' THEN 'accepted' ELSE 'dismissed' END, suggestion_decided_by = auth.uid(), suggestion_decided_at = now()
  WHERE id = msg.id RETURNING * INTO msg;
  RETURN jsonb_build_object('message_id', msg.id, 'suggested_status', msg.suggested_status, 'suggestion_outcome', msg.suggestion_outcome);
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_decide_reply_suggestion(bigint, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.advisor_decide_reply_suggestion(bigint, text) TO authenticated;
