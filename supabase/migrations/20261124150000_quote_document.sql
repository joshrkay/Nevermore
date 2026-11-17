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
  -- Closing firms are read-only and so is a support session (ADR 0023, 0024), checked before anything about the quote is said.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quotes zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_id));
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

-- ---------- 2. A quote document recorded by hand ----------
-- An agent who holds the quote document but not the email it came in uploads it (quote-document-upload checks and scans the bytes). The file is kept the way mail files are: a
-- message recorded by hand on the quote request's thread, with one attachment that waits (pending, unreadable) for its scan (D-731). This starts it and says where the file goes.
CREATE FUNCTION public.start_quote_document_upload(p_quote_id bigint, p_file_name text, p_content_type text, p_size_bytes bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req public.quote_requests;
  msg public.quote_request_messages;
  att public.quote_request_message_attachments;
  who text := (SELECT lower(u.email) FROM auth.users u WHERE u.id = auth.uid());
BEGIN
  -- As attach_quote_document: the firm writable, an advisor, the quote in the caller's firm (another firm's and not found are one answer).
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quotes zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_id));
  PERFORM public.require_advisor();
  IF NOT EXISTS (SELECT 1 FROM public.quotes x WHERE x.id = p_quote_id AND public.quote_request_in_my_firm(x.quote_request_id)) THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO req FROM public.quote_requests r WHERE r.id = (SELECT x.quote_request_id FROM public.quotes x WHERE x.id = p_quote_id);
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, subject, sent_at)
  VALUES ('upload:' || gen_random_uuid(), req.id, req.session_id, 'sent_by_hand', who, 'Quote document uploaded by hand', now())
  RETURNING * INTO msg;
  INSERT INTO public.quote_request_message_attachments (message_id, provider_attachment_id, file_name, content_type, size_bytes, status)
  VALUES (msg.id, 'upload', COALESCE(NULLIF(left(btrim(COALESCE(p_file_name, '')), 255), ''), 'quote document'), left(p_content_type, 200), GREATEST(COALESCE(p_size_bytes, 0), 0), 'pending')
  RETURNING * INTO att;
  RETURN jsonb_build_object('attachment_id', att.id, 'message_id', msg.id, 'folder', msg.session_id || '/' || msg.id);
END;
$$;

REVOKE ALL ON FUNCTION public.start_quote_document_upload(bigint, text, text, bigint) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.start_quote_document_upload(bigint, text, text, bigint) TO authenticated;
