-- An underwriter's question becomes an information request (N-1.3, slice 7.5; docs/BROKER_CRM_BUILD.md D-750 to D-759; supabase/tests/question_requests.sql).

-- The agent turns an underwriter's question into the existing information request (advisor_request_information), in their own words.
CREATE FUNCTION public.advisor_ask_about_question(p_quote_request_id bigint, p_message text, p_fields text[] DEFAULT '{}'::text[], p_extra_questions jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  q public.quote_requests;
  req jsonb;
BEGIN
  -- A closing firm is read-only and a support session reads only (ADR 0023, 0024): asked before anything is looked at.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  SELECT * INTO q FROM public.quote_requests WHERE id = p_quote_request_id AND public.quote_request_in_my_firm(id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  IF q.status IS DISTINCT FROM 'question_open' THEN
    RAISE EXCEPTION 'This quote request has no open question to ask about' USING ERRCODE = '22023';
  END IF;
  req := public.advisor_request_information(q.session_id, p_message, p_fields, p_extra_questions);
  -- The quote request's log ties the request to the question: who asked, and which request (the thread reads it back to say waiting or answered).
  INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value, changed_by, changed_by_email)
  VALUES (q.id, q.session_id, 'asked_employer', req ->> 'request_id', auth.uid(), auth.jwt() ->> 'email');
  RETURN req || jsonb_build_object('quote_request_id', q.id);
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_ask_about_question(bigint, text, text[], jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.advisor_ask_about_question(bigint, text, text[], jsonb) TO authenticated;
