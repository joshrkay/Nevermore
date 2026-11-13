-- Three fixes to the invitations story (CRM-P1.2) found in review after it was merged. Everything here is new: the migrations the
-- story builds on (20261116160001_firm_activity.sql, 20261116190000_firm_invitations.sql) have already run on databases and are not
-- edited, so a database that ran them and a fresh one end in the same state.

-- 1. Withdrawing an invitation is recorded as its own kind of entry. The kinds list belongs to 20261116160001_firm_activity.sql, which
-- databases have run without this kind: the check is dropped and added again here with it. src/data/firmActivity.ts (ENTRY_KINDS) is
-- kept in step by src/data/schemaSync.test.ts, which reads the list of the latest migration that holds it.
ALTER TABLE public.firm_activity DROP CONSTRAINT firm_activity_kind_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    -- sync:begin firm_activity_kinds
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused', 'invitation_withdrawn'
    -- sync:end firm_activity_kinds
  ));

-- 2. The firm's record carries the role of an invitation. record_firm_event (20261116170001) handed the entry over without the
-- detail that holds the role, so every invitation, resend and withdrawal was stored with no role. An invitation sent (or sent
-- again) and an invitation withdrawn now record the role that was offered, so the firm's owners see who was invited as what.
-- Nothing else in p_detail (the address, the note, the invited email) is written, and the actor is still the caller's own sign-in.
CREATE OR REPLACE FUNCTION public.record_firm_event(p_firm_id uuid, p_kind text, p_actor uuid, p_detail jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.firm_activity_append(p_firm_id, p_kind, 'firm', p_firm_id::text, NULL,
    CASE WHEN p_kind IN ('invitation_sent', 'invitation_withdrawn') THEN p_detail ->> 'role' END);
END;
$$;

REVOKE ALL ON FUNCTION public.record_firm_event(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- 3. How much invitation mail a firm waiting for approval can send (D-36). The merged rule counted every email the firm had ever
-- caused and refused a waiting firm its eleventh for life, even with nothing pending. That lifetime limit is gone. D-34's five pending
-- invitations stay (invite_member). A waiting firm may send at most twenty invitation emails, first sends and resends together, in any
-- twenty-four hours; the next is refused with a message saying when it can send again. Both limits end when the firm is approved.
-- Each email is one 'invitation_sent' entry in the firm's record, written in the same transaction as the send, so the emails of the
-- last twenty-four hours are those entries. The refusal says when the oldest of the last twenty leaves the window, which is when the
-- next email can go. An approved firm is not limited here, and a refused firm is refused by its callers before this runs.
-- Callers hold the firm's row lock (FOR NO KEY UPDATE) when they call this, so two owners sending at once are counted one after the
-- other; the two-session test in supabase/tests/firm_invitations.sql goes red without that lock.
CREATE FUNCTION public.guard_invitation_mail_rate(p_firm public.firms)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE recent integer; oldest timestamptz;
BEGIN
  IF p_firm.approved_at IS NOT NULL OR p_firm.decision IS NOT NULL THEN
    RETURN;
  END IF;
  SELECT count(*), min(w.at) INTO recent, oldest
  FROM (SELECT a.at FROM public.firm_activity a
        WHERE a.firm_id = p_firm.id AND a.kind = 'invitation_sent' AND a.at > now() - interval '24 hours'
        ORDER BY a.at DESC LIMIT 20) w;
  IF recent >= 20 THEN
    RAISE EXCEPTION 'A firm waiting for approval can send at most twenty invitation emails in 24 hours. It can send again at %',
      to_char((oldest + interval '24 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI "UTC"') USING ERRCODE = 'PT409';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_invitation_mail_rate(public.firms) FROM PUBLIC, anon, authenticated;

-- invite_member and resend_invitation as 20261116190000 defines them, with the lifetime count of emails replaced by the rate limit.
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
  PERFORM public.guard_invitation_mail_rate(f);
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
  PERFORM public.record_firm_event(p_firm_id, 'invitation_sent', auth.uid(),
    jsonb_build_object('invitation_id', inv.id, 'email', clean_email, 'role', p_role));
  RETURN QUERY SELECT inv.id, inv.email, f.name, f.address, inv.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_member(uuid, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_member(uuid, text, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resend_invitation(p_invitation_id uuid, p_token_hash text)
RETURNS TABLE (invitation_id uuid, email text, firm_name text, firm_address text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inv public.firm_invitations;
  f public.firms;
  fid uuid;
BEGIN
  -- The firm's row is locked before the invitation's, as inviting does, so the count of a waiting firm's emails is read and
  -- spent by one caller at a time.
  SELECT i.firm_id INTO fid FROM public.firm_invitations i WHERE i.id = p_invitation_id;
  IF NOT FOUND OR public.firm_role(fid) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can do that' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO f FROM public.firms WHERE id = fid FOR NO KEY UPDATE;
  SELECT * INTO inv FROM public.firm_invitations i WHERE i.id = p_invitation_id FOR UPDATE;
  IF f.decision = 'refused' THEN
    RAISE EXCEPTION 'This firm can''t invite people' USING ERRCODE = 'PT403';
  END IF;
  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation has already been used or withdrawn' USING ERRCODE = 'PT410';
  END IF;
  PERFORM public.guard_invitation_mail_rate(f);
  UPDATE public.firm_invitations i
  SET token_hash = p_token_hash, expires_at = now() + interval '7 days', resent_at = now(), send_count = i.send_count + 1,
      email_sent_at = NULL, email_error = NULL, email_outcome = NULL
  WHERE i.id = inv.id
  RETURNING * INTO inv;
  PERFORM public.record_firm_event(inv.firm_id, 'invitation_sent', auth.uid(),
    jsonb_build_object('invitation_id', inv.id, 'email', inv.email, 'role', inv.role));
  RETURN QUERY SELECT inv.id, inv.email, f.name, f.address, inv.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.resend_invitation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resend_invitation(uuid, text) TO authenticated;
