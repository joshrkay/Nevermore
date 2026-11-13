-- Review fixes to invitations (story CRM-P1.2; docs/BROKER_CRM_BUILD.md D-29, D-32, D-34).

-- Accepting is bound to the firm's own address (D-34): the call is given the address it was opened at and joins nothing, and
-- spends nothing, unless that is the address of the invitation's firm. It is checked here, in the same call, so no caller can
-- accept at one firm's address an invitation to another. It comes before the used / expired / withdrawn messages, so a link
-- opened at the wrong address learns nothing about its state.
DROP FUNCTION public.accept_invitation(text);
CREATE FUNCTION public.accept_invitation(p_token_hash text, p_firm_address text)
RETURNS TABLE (firm_id uuid, firm_address text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inv public.firm_invitations;
  caller_email text;
  address text;
  decision text;
BEGIN
  SELECT lower(btrim(u.email)) INTO caller_email
  FROM auth.users u
  WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF NOT public.is_signed_in_person() OR caller_email IS NULL THEN
    RAISE EXCEPTION 'Sign in with a verified email to accept an invitation' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO inv FROM public.firm_invitations i WHERE i.token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invitation link is not valid' USING ERRCODE = 'PT404';
  END IF;
  SELECT f.address, f.decision INTO address, decision FROM public.firms f WHERE f.id = inv.firm_id;
  -- A refused firm is as good as no firm (D-31): its pending invitations read as links that are not valid.
  IF decision = 'refused' THEN
    RAISE EXCEPTION 'This invitation link is not valid' USING ERRCODE = 'PT404';
  END IF;
  IF address IS DISTINCT FROM lower(btrim(COALESCE(p_firm_address, ''))) THEN
    RAISE EXCEPTION 'This invitation belongs to another firm''s address' USING ERRCODE = 'PT422';
  END IF;
  IF inv.status = 'accepted' THEN
    RAISE EXCEPTION 'This invitation has already been used' USING ERRCODE = 'PT410';
  ELSIF inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'This invitation was withdrawn' USING ERRCODE = 'PT410';
  ELSIF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired' USING ERRCODE = 'PT410';
  END IF;
  IF inv.email <> caller_email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address than the one you are signed in with' USING ERRCODE = 'PT403';
  END IF;
  IF EXISTS (
       SELECT 1 FROM public.firm_memberships m
       WHERE m.firm_id = inv.firm_id AND m.user_id = auth.uid() AND public.membership_is_current(m.valid_from, m.valid_until)
     ) THEN
    RAISE EXCEPTION 'You are already a member of this firm' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES (inv.firm_id, auth.uid(), inv.role, inv.team_id);
  UPDATE public.firm_invitations i SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now() WHERE i.id = inv.id;
  PERFORM public.record_firm_event(inv.firm_id, 'member_invitation_accepted', auth.uid(),
    jsonb_build_object('invitation_id', inv.id, 'role', inv.role));
  RETURN QUERY SELECT inv.firm_id, address, inv.role;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, text) TO authenticated;

-- How the email of the current link fared: 'sent' (the mail provider accepted it), 'failed' (it certainly did not go) or 'unknown'
-- (a network failure, a timeout or a server error: the provider may have accepted it). Empty until a send has been tried.
ALTER TABLE public.firm_invitations
  ADD COLUMN email_outcome text CHECK (email_outcome IN ('sent', 'failed', 'unknown'));

-- A firm's approval decision and what it may do with invitations (D-34, D-27, D-31):
--   approved                       invites without a limit;
--   waiting for a decision         can invite and be joined (its people work before approval), but holds at most five pending
--                                  invitations until it is approved, so an unapproved sign-up cannot use Nevermore's mail in bulk;
--   refused                        cannot invite or resend, and a pending invitation to it cannot be accepted (it reads as a link
--                                  that is not valid, as the firm's address reads as no firm's). Its owners may still withdraw.
-- The five cannot be a constraint (it counts rows), so inviting takes the firm's row lock before it counts: two owners inviting at the
-- same moment would otherwise each see four. FOR NO KEY UPDATE waits for another invitation to the same firm and for the decision
-- itself, not for the foreign-key checks of the invitation inserts. A test with two real connections goes red without the lock.
CREATE OR REPLACE FUNCTION public.invite_member(p_firm_id uuid, p_email text, p_role text, p_team_id uuid, p_token_hash text)
RETURNS TABLE (invitation_id uuid, email text, firm_name text, firm_address text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inv public.firm_invitations;
  f public.firms;
  clean_email text := lower(btrim(COALESCE(p_email, '')));
  violated text;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can invite people' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.firms WHERE id = p_firm_id FOR NO KEY UPDATE;
  IF f.decision = 'refused' THEN
    RAISE EXCEPTION 'This firm can''t invite people' USING ERRCODE = 'PT403';
  END IF;
  IF f.approved_at IS NULL AND f.decision IS NULL
     AND (SELECT count(*) FROM public.firm_invitations i WHERE i.firm_id = p_firm_id AND i.status = 'pending') >= 5 THEN
    RAISE EXCEPTION 'A firm waiting for approval can hold at most five pending invitations' USING ERRCODE = 'PT409';
  END IF;
  -- Someone who is already a current member of the firm is not invited again. The owner is told, since it is their own firm.
  IF EXISTS (
       SELECT 1
       FROM public.firm_memberships m
       JOIN auth.users u ON u.id = m.user_id
       WHERE m.firm_id = p_firm_id AND lower(btrim(u.email)) = clean_email
         AND public.membership_is_current(m.valid_from, m.valid_until)
     ) THEN
    RAISE EXCEPTION 'That person is already a member of this firm' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    INSERT INTO public.firm_invitations (firm_id, email, role, team_id, token_hash, invited_by, expires_at)
    VALUES (p_firm_id, clean_email, p_role, p_team_id, p_token_hash, auth.uid(), now() + interval '7 days')
    RETURNING * INTO inv;
  EXCEPTION WHEN unique_violation THEN
    -- The unique index firm_invitations_one_pending is the rule (D-29); this only gives its usual message. Any other unique
    -- violation (a token hash used twice) stays as it is.
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    IF violated = 'firm_invitations_one_pending' THEN
      RAISE EXCEPTION 'That email already has a pending invitation to this firm. Resend it instead.' USING ERRCODE = 'PT409';
    END IF;
    RAISE;
  END;
  PERFORM public.record_firm_event(p_firm_id, 'member_invited', auth.uid(),
    jsonb_build_object('invitation_id', inv.id, 'email', clean_email, 'role', p_role));
  RETURN QUERY SELECT inv.id, inv.email, f.name, f.address, inv.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.resend_invitation(p_invitation_id uuid, p_token_hash text)
RETURNS TABLE (invitation_id uuid, email text, firm_name text, firm_address text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inv public.firm_invitations;
  f public.firms;
BEGIN
  SELECT * INTO inv FROM public.firm_invitations i WHERE i.id = p_invitation_id FOR UPDATE;
  IF NOT FOUND OR public.firm_role(inv.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.firms WHERE id = inv.firm_id;
  IF f.decision = 'refused' THEN
    RAISE EXCEPTION 'This firm can''t invite people' USING ERRCODE = 'PT403';
  END IF;
  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation has already been used or withdrawn' USING ERRCODE = 'PT410';
  END IF;
  UPDATE public.firm_invitations i
  SET token_hash = p_token_hash, expires_at = now() + interval '7 days', resent_at = now(),
      email_sent_at = NULL, email_error = NULL, email_outcome = NULL
  WHERE i.id = inv.id
  RETURNING * INTO inv;
  PERFORM public.record_firm_event(inv.firm_id, 'member_invitation_resent', auth.uid(),
    jsonb_build_object('invitation_id', inv.id, 'email', inv.email, 'role', inv.role));
  RETURN QUERY SELECT inv.id, inv.email, f.name, f.address, inv.expires_at;
END;
$$;

-- The address rule is the mail sender's own (EMAIL_PATTERN in supabase/functions/dispatch-outbox/messages.ts): no spaces, quotes,
-- commas, semicolons, angle brackets, parentheses, square brackets or backslashes, and one dot after the at sign. The first
-- version of the table accepted more, so a direct caller could leave a pending invitation that could never be emailed and that
-- blocked the corrected one (one pending per firm and email).
ALTER TABLE public.firm_invitations DROP CONSTRAINT firm_invitations_email_check;
ALTER TABLE public.firm_invitations ADD CONSTRAINT firm_invitations_email_check CHECK (
  email = lower(btrim(email)) AND char_length(email) <= 254
  AND email ~ '^[^[:space:]@<>,;"()\[\]\\]+@[^[:space:]@<>,;"()\[\]\\]+\.[^[:space:]@<>,;"()\[\]\\]+$'
);

-- What the invite-member server function records once it has tried the email, for the link it was sending: the token's hash names
-- which send this is (a resend makes a new link with a new hash). A result for a link that is no longer the current one is not
-- recorded, so two resends that finish out of order cannot mark the current link delivered when its email failed, or the reverse.
-- Only the service role calls it. A failure or an unknown outcome takes the sent time back, since the email is not known to have gone.
DROP FUNCTION public.record_invitation_delivery(uuid, boolean, text);
CREATE FUNCTION public.record_invitation_delivery(p_invitation_id uuid, p_token_hash text, p_outcome text, p_error text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE recorded integer;
BEGIN
  UPDATE public.firm_invitations i
  SET email_outcome = p_outcome,
      email_sent_at = CASE WHEN p_outcome = 'sent' THEN now() END,
      email_error = CASE WHEN p_outcome = 'sent' THEN NULL ELSE left(COALESCE(NULLIF(btrim(p_error), ''), 'unknown'), 40) END
  WHERE i.id = p_invitation_id AND i.token_hash = p_token_hash AND i.status = 'pending';
  GET DIAGNOSTICS recorded = ROW_COUNT;
  RETURN recorded > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.record_invitation_delivery(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_invitation_delivery(uuid, text, text, text) TO service_role;

DROP FUNCTION public.firm_pending_invitations(uuid);
CREATE FUNCTION public.firm_pending_invitations(p_firm_id uuid)
RETURNS TABLE (invitation_id uuid, email text, role text, team_id uuid, invited_at timestamptz, expires_at timestamptz, expired boolean,
               resent_at timestamptz, email_sent_at timestamptz, email_error text, email_outcome text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT i.id, i.email, i.role, i.team_id, i.created_at, i.expires_at, i.expires_at <= now(), i.resent_at, i.email_sent_at, i.email_error, i.email_outcome
  FROM public.firm_invitations i
  WHERE i.firm_id = p_firm_id AND i.status = 'pending'
  ORDER BY i.created_at, i.id;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_pending_invitations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_pending_invitations(uuid) TO authenticated;
