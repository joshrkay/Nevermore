-- A firm's sign-up and its decision in the firm's record (story CRM-P2.3; docs/BROKER_CRM_BUILD.md D-16, D-24).
--
-- 20261116170000_firm_signup.sql made record_firm_event the one place a firm event is handed over and left its body empty,
-- because the record of who did what is built in 20261116160001, which runs before it. This takes the function over: every
-- caller stays as it is. The actor is the caller's own sign-in (the founder who signed up, the admin who decided), never
-- the p_actor argument, and no content is written: p_detail (the address, the note) is left out, so the record holds only
-- that the event happened to the firm, when, and by whom.
CREATE OR REPLACE FUNCTION public.record_firm_event(p_firm_id uuid, p_kind text, p_actor uuid, p_detail jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.firm_activity_append(p_firm_id, p_kind, 'firm', p_firm_id::text);
END;
$$;

REVOKE ALL ON FUNCTION public.record_firm_event(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
