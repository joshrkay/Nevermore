-- An underwriter's question becomes an information request (N-1.3, slice 7.5; docs/BROKER_CRM_BUILD.md D-750 to D-759; supabase/tests/question_requests.sql).

-- The agent turns an underwriter's question into the existing information request (advisor_request_information), in their own words.
CREATE FUNCTION public.advisor_ask_about_question(p_quote_request_id bigint, p_message text, p_fields text[] DEFAULT '{}'::text[], p_extra_questions jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sid uuid;
BEGIN
  SELECT q.session_id INTO sid FROM public.quote_requests q WHERE q.id = p_quote_request_id;
  RETURN public.advisor_request_information(sid, p_message, p_fields, p_extra_questions);
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_ask_about_question(bigint, text, text[], jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.advisor_ask_about_question(bigint, text, text[], jsonb) TO authenticated;
