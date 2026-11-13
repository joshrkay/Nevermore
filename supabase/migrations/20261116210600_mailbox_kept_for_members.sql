-- A mailbox is a current member's (20261116210500), but 20261113090000's trigger user_roles_drop_mailbox still calls
-- drop_mailbox_without_role() after every platform-role deletion, and that deleted the mailbox when no advisor or admin
-- role remained. A current firm member who lost their last platform role was silently disconnected. The function is
-- replaced (the trigger stays): the mailbox goes only when the person holds no platform role AND is no current member of
-- a firm. Deleting it when a person's last membership ends belongs to the removal story, CRM-P1.5 (20261116220000).

CREATE OR REPLACE FUNCTION public.drop_mailbox_without_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = OLD.user_id AND r.role::text IN ('advisor', 'admin'))
     AND NOT EXISTS (SELECT 1 FROM public.firm_memberships f WHERE f.user_id = OLD.user_id AND public.membership_is_current(f.valid_from, f.valid_until)) THEN
    DELETE FROM public.broker_mailboxes WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;
