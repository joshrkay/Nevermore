-- A mailbox is a current member's (20261116210500), but the only cleanup, drop_mailbox_without_role(), fires when a platform
-- role row is deleted, and a founder or an invited agent has none. Their stored mail token would outlive their membership and
-- would come back to use if they joined any firm again. It now also goes when the person's last current membership ends,
-- by an end date set or a row deleted. A membership with an end date still ahead counts as current until it lapses; the
-- token is unusable from then on (mailbox_secret asks for a current membership), and is deleted the next time any of the
-- person's memberships changes or they disconnect.

CREATE FUNCTION public.drop_mailbox_without_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.firm_memberships f
    WHERE f.user_id = OLD.user_id AND public.membership_is_current(f.valid_from, f.valid_until)
  ) THEN
    DELETE FROM public.broker_mailboxes WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.drop_mailbox_without_membership() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firm_memberships_drop_mailbox
  AFTER UPDATE OR DELETE ON public.firm_memberships
  FOR EACH ROW EXECUTE FUNCTION public.drop_mailbox_without_membership();
