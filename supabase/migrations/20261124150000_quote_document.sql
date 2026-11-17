-- Keep the quote document (N-2.2, slice 7.3; docs/BROKER_CRM_BUILD.md "### 7.3 N-2.2, N-2.4 decisions", D-730 to D-739; supabase/tests/quote_document.sql).

-- ---------- 1. The file a quote names ----------
ALTER TABLE public.quotes ADD COLUMN document_attachment_id bigint REFERENCES public.quote_request_message_attachments (id) ON DELETE SET NULL;

CREATE FUNCTION public.attach_quote_document(p_quote_id bigint, p_attachment_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  q public.quotes;
BEGIN
  PERFORM public.require_advisor();
  -- Only an advisor of the quote's own firm; another firm's quote and one that is not there are the same answer.
  IF NOT EXISTS (SELECT 1 FROM public.quotes x WHERE x.id = p_quote_id AND public.quote_request_in_my_firm(x.quote_request_id)) THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.quotes SET document_attachment_id = p_attachment_id WHERE id = p_quote_id RETURNING * INTO q;
  RETURN to_jsonb(q);
END;
$$;

REVOKE ALL ON FUNCTION public.attach_quote_document(bigint, bigint) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.attach_quote_document(bigint, bigint) TO authenticated;
