-- Suggesting what a PEO's reply means (N-1.1, slice 7.4; docs/BROKER_CRM_BUILD.md D-740 to D-749; supabase/tests/reply_suggestions.sql).

ALTER TABLE public.quote_request_messages ADD COLUMN suggested_status text;

-- The mail function's alone (service role): what the model made of a reply. A suggestion only; nothing here touches the quote request.
CREATE FUNCTION public.record_reply_suggestion(p_message_id bigint, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.quote_request_messages SET suggested_status = p_status WHERE id = p_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_reply_suggestion(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_reply_suggestion(bigint, text) TO service_role;
