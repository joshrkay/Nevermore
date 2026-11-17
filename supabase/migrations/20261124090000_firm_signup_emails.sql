-- Creating a firm end to end: the emails (docs/BROKER_CRM_BUILD.md "Creating a firm end to end", D-1860 on; supabase/tests/firm_signup_emails.sql).
--
-- Two emails ride the outbox every other email uses; the database only queues them, in the same transaction as the change, and the
-- dispatch-outbox function sends them:
--   * firm_waiting: a firm signed up and waits for a decision. It goes to every platform admin.
--   * firm_decision: an admin approved or refused the firm. It goes to the person who signed the firm up.

-- ---------- 1. Two new kinds, each about a firm and no intake ----------
-- Restated whole, with every kind each already had (20261122240000).
ALTER TABLE public.outbox_events DROP CONSTRAINT outbox_events_one_target;
ALTER TABLE public.outbox_events ADD CONSTRAINT outbox_events_one_target CHECK (
  CASE WHEN kind IN ('member_left', 'firm_closing', 'export_alert', 'conversation_message', 'lead_from_link', 'firm_waiting', 'firm_decision') THEN session_id IS NULL AND firm_id IS NOT NULL
  ELSE session_id IS NOT NULL AND firm_id IS NULL END);

ALTER TABLE public.outbox_events DROP CONSTRAINT IF EXISTS outbox_events_kind_check;
ALTER TABLE public.outbox_events
  ADD CONSTRAINT outbox_events_kind_check CHECK (kind IN (
    -- sync:begin outbox_kinds
    'advisor_notification', 'prospect_confirmation', 'information_request', 'draft_expiry_reminder', 'peo_mail_arrived', 'member_left', 'firm_closing', 'export_alert',
    'conversation_message', 'peo_message', 'lead_from_link', 'firm_waiting', 'firm_decision'
    -- sync:end outbox_kinds
  ));

-- ---------- 2. A firm that signs up is queued for the admins ----------
CREATE FUNCTION public.queue_firm_signup_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  VALUES ('firm_waiting', NEW.id, 'firm_waiting:' || NEW.id,
          jsonb_build_object('firm_name', NEW.name, 'address', NEW.address,
                             'signed_up_by_email', (SELECT lower(btrim(u.email)) FROM auth.users u WHERE u.id = NEW.signed_up_by)))
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_firm_signup_emails() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firms_queue_signup_emails
  AFTER INSERT ON public.firms
  FOR EACH ROW WHEN (NEW.signed_up_by IS NOT NULL AND NEW.decision IS NULL)
  EXECUTE FUNCTION public.queue_firm_signup_emails();

-- ---------- 3. A decision is queued for the person who signed the firm up ----------
CREATE FUNCTION public.queue_firm_decision_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.outbox_events (kind, firm_id, dedupe_key, payload)
  VALUES ('firm_decision', NEW.id, 'firm_decision:' || NEW.id,
          jsonb_build_object('recipient_email', (SELECT lower(btrim(u.email)) FROM auth.users u WHERE u.id = NEW.signed_up_by),
                             'firm_name', NEW.name, 'address', NEW.address, 'approved', NEW.decision = 'approved', 'note', NEW.decision_note))
  ON CONFLICT (kind, dedupe_key) DO NOTHING;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_firm_decision_email() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firms_queue_decision_email
  AFTER UPDATE OF decision ON public.firms
  FOR EACH ROW WHEN (OLD.decision IS NULL AND NEW.decision IS NOT NULL AND NEW.signed_up_by IS NOT NULL)
  EXECUTE FUNCTION public.queue_firm_decision_email();

-- ---------- 4. Who the admins' email goes to ----------
-- Every platform admin with an address, asked by dispatch-outbox as the service role each time it builds or resends the email, so someone whose admin
-- role has been taken away stops receiving it at once (D-35's rule for every alert). One address once, whatever roles the person holds.
CREATE FUNCTION public.outbox_admin_recipients()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(DISTINCT lower(btrim(u.email)) ORDER BY lower(btrim(u.email))), ARRAY[]::text[])
  FROM public.user_roles r
  JOIN auth.users u ON u.id = r.user_id
  WHERE r.role = 'admin' AND COALESCE(btrim(u.email), '') <> ''
$$;

REVOKE ALL ON FUNCTION public.outbox_admin_recipients() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outbox_admin_recipients() TO service_role;
