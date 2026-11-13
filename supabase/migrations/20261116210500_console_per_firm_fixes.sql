-- Fixes to the console story (P-1.4, 20261116210000) found after it merged. That migration is merged and is not edited; what
-- it got wrong is put right here.
--
-- 1. Referral partners. 20261116200000 (CRM-P2.1c) DROPs the three-argument advisor_add_referral_partner and
--    advisor_update_referral_partner and creates firm-scoped four-argument versions. 20261116210000 then ran CREATE OR REPLACE
--    on the THREE-argument versions, behind the platform-role check: in migration order that brought back a write path that
--    ignores the firm, and made a three-argument call ambiguous between the two. They are dropped again. The only
--    referral-partner functions left are CRM-P2.1c's, which act for a firm the caller currently belongs to.
-- 2. require_advisor() and advisor_needs_second_factor() were also redefined by 20261116210000. Nothing runs after it that
--    redefines them, and the definition it left is the one both stories need, so they are not redefined here:
--      * require_advisor(): the platform role, or a current member of a firm past the second factor (D-19). The console is
--        a member's, and every function behind it filters by the row's firm.
--      * advisor_needs_second_factor(): a password sign-in still owing its factor, for a platform role or any current member.
--        That includes the owners 20261116160001 named, so it replaces that definition with a wider one and loses nothing.
-- 3. The mailbox. 20261116200000 let mailbox_store() store a mailbox only for a person holding a platform role AND a current
--    membership, which turned away a firm's founder and an invited member who hold no platform role, though the Mailbox page
--    and the mailbox function let them in. It now asks only for a current membership. A platform admin who belongs to no
--    firm still connects none (D-16). The second factor is asked by the mailbox function through my_firms() before it
--    calls this. my_mailbox() and mailbox_secret() already ask only for a membership and are as they were.

DROP FUNCTION IF EXISTS public.advisor_add_referral_partner(text, text, text);
DROP FUNCTION IF EXISTS public.advisor_update_referral_partner(text, text, text);

CREATE OR REPLACE FUNCTION public.mailbox_store(
  p_user_id uuid, p_provider text, p_address text, p_scope text, p_token_ciphertext text, p_token_iv text, p_rotated boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.firm_memberships f WHERE f.user_id = p_user_id AND public.membership_is_current(f.valid_from, f.valid_until)) THEN
    RAISE EXCEPTION 'Only a member of a firm can connect a mailbox' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (p_user_id, p_provider, p_address, p_scope, p_token_ciphertext, p_token_iv)
  ON CONFLICT (user_id) DO UPDATE
  SET provider = EXCLUDED.provider, address = EXCLUDED.address, scope = EXCLUDED.scope,
      token_ciphertext = EXCLUDED.token_ciphertext, token_iv = EXCLUDED.token_iv, token_updated_at = now(),
      -- A token Microsoft handed back on a refresh replaces the old one; the broker has not connected again.
      connected_at = CASE WHEN p_rotated THEN public.broker_mailboxes.connected_at ELSE now() END;
  RETURN jsonb_build_object('connected', true);
END;
$$;
