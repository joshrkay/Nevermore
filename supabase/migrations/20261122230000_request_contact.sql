-- A visitor on a firm's public link asks to be contacted (story CRM-L1.2b, slice 8.7; docs/BROKER_CRM_BUILD.md D-804, D-1660 to D-1669; supabase/tests/request_contact.sql).

CREATE FUNCTION public.request_contact(
  p_address text, p_name text, p_email text DEFAULT NULL, p_phone text DEFAULT NULL, p_business text DEFAULT NULL, p_message text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  name_in text := NULLIF(btrim(p_name), '');
  email_in text := NULLIF(btrim(p_email), '');
  phone_in text := NULLIF(btrim(p_phone), '');
  message_in text := NULLIF(btrim(p_message), '');
  business_in text := NULLIF(btrim(p_business), '');
  problem text;
BEGIN
  IF name_in IS NULL THEN
    RAISE EXCEPTION 'Enter your name.' USING ERRCODE = '22023';
  END IF;
  IF char_length(message_in) > 1000 THEN
    RAISE EXCEPTION 'A message is at most 1,000 characters.' USING ERRCODE = '22023';
  END IF;
  IF email_in IS NULL AND phone_in IS NULL THEN
    RAISE EXCEPTION 'Enter an email address or a phone number so the firm can reach you.' USING ERRCODE = '22023';
  END IF;
  problem := public.lead_input_error(name_in, NULL, business_in, email_in, phone_in, NULL, NULL, NULL, NULL, NULL);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  SELECT f.id INTO firm FROM public.firms f WHERE f.address = lower(btrim(p_address)) AND f.decision IS DISTINCT FROM 'refused';
  IF firm IS NULL OR public.firm_is_closed(firm) THEN
    RAISE EXCEPTION 'No firm holds this address.' USING ERRCODE = 'PT404';
  END IF;
  -- A closing firm is read-only (ADR 0023). The row is held FOR KEY SHARE, as assert_firm_writable holds it, so a closure asked for now waits for this lead.
  PERFORM 1 FROM public.firms f WHERE f.id = firm FOR KEY SHARE;
  IF public.firm_is_read_only(firm) THEN
    RAISE EXCEPTION 'This firm is not taking requests right now.' USING ERRCODE = 'PT423';
  END IF;
  -- The same address asking again within a day is the same ask: told it is taken, and no second lead is made.
  IF email_in IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.firm_id = firm AND l.source = 'firms_link' AND lower(l.email) = lower(email_in) AND l.created_at > now() - interval '1 day') THEN
    RETURN 'taken';
  END IF;
  -- At most 20 an hour for one firm's link. The lock makes two requests at the limit count one after the other.
  PERFORM pg_advisory_xact_lock(hashtext('request_contact:' || firm::text));
  IF (SELECT count(*) FROM public.leads l WHERE l.firm_id = firm AND l.source = 'firms_link' AND l.created_at > now() - interval '1 hour') >= 20 THEN
    RETURN 'busy';
  END IF;
  -- And at most 200 an hour for every firm's link together, so a script spread over many firms' addresses is bounded too.
  PERFORM pg_advisory_xact_lock(hashtext('request_contact'));
  IF (SELECT count(*) FROM public.leads l WHERE l.source = 'firms_link' AND l.created_at > now() - interval '1 hour') >= 200 THEN
    RETURN 'busy';
  END IF;
  INSERT INTO public.leads (firm_id, owner_id, name, business, email, phone, note, source)
  VALUES (firm, NULL, name_in, business_in, email_in, phone_in, 'Asked to be contacted' || COALESCE(': ' || message_in, '.'), 'firms_link');
  RETURN 'taken';
END;
$$;

REVOKE ALL ON FUNCTION public.request_contact(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_contact(text, text, text, text, text, text) TO anon, authenticated;
