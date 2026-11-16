-- The owners' email when a visitor on the firm's link asks to be contacted, and the captcha in front of the form (slice 8.7b; docs/BROKER_CRM_BUILD.md D-1670 to D-1679, which amend D-1664 and D-1666; supabase/tests/request_contact.sql).

-- ---------- 1. A new kind on the outbox (D-1670) ----------
-- A firm's email like export_alert: belongs to a firm, not to an intake. Each restated whole, with every kind it had (one_target from 20261122090000, the kind list from 20261122140000).
ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_events_one_target;
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_events_one_target CHECK (
  CASE WHEN kind IN ('member_left', 'firm_closing', 'export_alert', 'conversation_message', 'lead_from_link') THEN session_id IS NULL AND firm_id IS NOT NULL
  ELSE session_id IS NOT NULL AND firm_id IS NULL END);

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request', 'draft_expiry_reminder', 'peo_mail_arrived', 'member_left', 'firm_closing', 'export_alert',
    'conversation_message', 'peo_message', 'lead_from_link'
    -- sync:end outbox_kinds
  ));

-- ---------- 2. request_contact tells the owners (D-1670) ----------
-- Restated from 20261122230000 with every line kept; the one addition is the outbox insert after the lead.
CREATE OR REPLACE FUNCTION public.request_contact(
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
  made public.leads;
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
  VALUES (firm, NULL, name_in, business_in, email_in, phone_in, 'Asked to be contacted' || COALESCE(': ' || message_in, '.'), 'firms_link')
  RETURNING * INTO made;
  -- The firm's owners are told, by email, in this same transaction (D-1670): who asked and of which firm, never the visitor's contact details or message.
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  SELECT 'lead_from_link', firm, 'lead_from_link:' || made.id,
         jsonb_build_object('visitor_name', made.name, 'business', made.business, 'firm_name', f.name, 'lead_id', made.id,
                            'requested_at', to_char(made.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  FROM public.firms f WHERE f.id = firm
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
  RETURN 'taken';
END;
$$;



-- ---------- 3. It is a firm's alert (D-1670) ----------
-- Like export_alert: it waits while the firm is suspended, a bounce never suppresses an owner's address, and it ends once the firm has closed (every one of them asks this function).
-- Restated from 20261119090000 with every kind it named.
CREATE OR REPLACE FUNCTION public.outbox_kind_is_firm_alert(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT p_kind IN ('advisor_notification', 'peo_mail_arrived', 'member_left', 'firm_closing', 'export_alert', 'lead_from_link') $$;

-- ---------- 4. Only the contact-request function may call it (D-1673) ----------
-- The captcha is checked by the edge function contact-request, which then calls this as the service role. A visitor's browser, a guest and a signed-in person
-- can no longer reach the database's function directly, so the check cannot be skipped. The abuse caps above stay here, in the database (D-1666).
REVOKE ALL ON FUNCTION public.request_contact(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_contact(text, text, text, text, text, text) TO service_role;
