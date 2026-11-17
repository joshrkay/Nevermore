-- A firm sends nothing to a PEO until a platform admin has approved it.
--
-- docs/QUOTING_PLATFORM_STORIES.md says it twice: P-1.3 ("a new firm can work intakes immediately but cannot send to a PEO until an admin has approved it")
-- and Q-1.2 ("an admin approves a firm before its first send"); docs/BROKER_CRM_BUILD.md says it again, D-26 ("Platform admins approve each firm before it can
-- send (Q-1.2), which is where a look-alike is caught") and D-27 ("approval gates sending, not signing in"). Nothing enforced it: firms.approved_at was read
-- by the invitation limits (D-34, D-36) and written by admin_decide_firm, and send_to_peo, follow_up_peo and withdraw_from_peo never looked at it, so a firm
-- waiting for approval, or one an admin had refused, could mail a PEO from its agent's own mailbox.
--
-- The rule is on the message a send records (direction 'sent'), not restated into the three functions: no write path can skip it, and the functions keep
-- every rule they already have (D-104). A send is recorded in the same transaction as its quote request, its stage move, its outbox row and its
-- registration (Q-2.1), so the refusal undoes all of them.
--
-- Not stopped, because they send nothing: advisor_record_quote_send (an agent noting an email they sent themselves), mail received, and a message
-- recorded as sent by hand.
--
-- Deploy note: a firm waiting for approval, or refused, that could send before this migration can no longer. Edgar Allan Advisory, the default firm, is approved
-- from the start (20261116090000_firms.sql).

SET lock_timeout = '5s';

CREATE FUNCTION public.guard_firm_approved_to_send()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chamber_sessions s JOIN public.firms f ON f.id = s.firm_id
    WHERE s.id = NEW.session_id AND f.approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Your firm hasn''t been approved to send to PEOs yet. Nevermore approves each firm before its first send; you can keep working on intakes meanwhile.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_firm_approved_to_send() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_request_messages_firm_approved
  BEFORE INSERT ON public.quote_request_messages
  FOR EACH ROW WHEN (NEW.direction = 'sent')
  EXECUTE FUNCTION public.guard_firm_approved_to_send();
