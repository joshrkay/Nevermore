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
  -- A file of this quote request's own mail: its message names this quote's quote request (never another PEO's, held mail or another firm's).
  IF NOT EXISTS (
    SELECT 1 FROM public.quote_request_message_attachments a
    JOIN public.quote_request_messages m ON m.id = a.message_id
    JOIN public.quotes x ON x.quote_request_id = m.quote_request_id
    WHERE a.id = p_attachment_id AND x.id = p_quote_id
  ) THEN
    RAISE EXCEPTION 'That file isn''t on this quote request''s mail' USING ERRCODE = '22023';
  END IF;
  -- Only a file that is stored, which is to say scanned clean (receive-mail settles it): never a blocked, pending or not-kept one.
  IF NOT EXISTS (SELECT 1 FROM public.quote_request_message_attachments a WHERE a.id = p_attachment_id AND a.status = 'stored') THEN
    RAISE EXCEPTION 'That file isn''t stored: it was blocked, not kept, or is still being checked' USING ERRCODE = '22023';
  END IF;
  UPDATE public.quotes SET document_attachment_id = p_attachment_id WHERE id = p_quote_id RETURNING * INTO q;
  RETURN to_jsonb(q);
END;
$$;

REVOKE ALL ON FUNCTION public.attach_quote_document(bigint, bigint) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.attach_quote_document(bigint, bigint) TO authenticated;
