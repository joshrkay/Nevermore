-- Sign up a firm; a platform admin approves it (story CRM-P1.1 with Q-1.2; docs/BROKER_CRM_BUILD.md D-5, D-16, D-18, D-21).

-- The one place a firm event is recorded. Today it records nothing beyond the decision columns added below; the story that
-- builds the record of who did what (CRM-P2.3) replaces this body, and every caller stays as it is. p_kind is one of
-- firm_signed_up, firm_approved, firm_refused; p_detail carries what the event needs (the address, the note).
CREATE FUNCTION public.record_firm_event(p_firm_id uuid, p_kind text, p_actor uuid, p_detail jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_firm_event(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.sign_up_firm(p_name text, p_address text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  fid uuid;
  clean_name text := btrim(COALESCE(p_name, ''));
BEGIN
  -- A signed-in person, not a guest, whose email the provider or the confirmation link has verified. Anyone else
  -- gets the same refusal, so the call tells nothing about which accounts exist.
  IF NOT public.is_signed_in_person() OR NOT EXISTS (
       SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Sign in with a verified email to sign up a firm' USING ERRCODE = '42501';
  END IF;
  IF char_length(clean_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'A firm''s name is 1 to 80 characters' USING ERRCODE = '23514';
  END IF;
  -- One firm waiting at a time per person: nobody can hold addresses they have no use for, or fill the admin's list.
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.signed_up_by = auth.uid() AND f.decision IS NULL) THEN
    RAISE EXCEPTION 'You already have a firm waiting for approval' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.firms (name, address, signed_up_by) VALUES (clean_name, lower(btrim(p_address)), auth.uid()) RETURNING id INTO fid;
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (fid, auth.uid(), 'owner');
  PERFORM public.record_firm_event(fid, 'firm_signed_up', auth.uid(), jsonb_build_object('address', lower(btrim(p_address))));
  RETURN fid;
END;
$$;

REVOKE ALL ON FUNCTION public.sign_up_firm(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_up_firm(text, text) TO authenticated;

-- When a firm signed up. Firms that exist already (Edgar Allan Advisory) take the time this migration ran.
ALTER TABLE public.firms ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

-- Who signed the firm up, fixed when sign_up_firm creates it. Ownership can pass to someone else while approval is
-- pending, so the admin's list reads this, never whoever owns the firm now. Empty for firms that were not signed up
-- here, and when that account is deleted.
ALTER TABLE public.firms ADD COLUMN signed_up_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- The firms waiting for a platform admin's decision, oldest first, with the email of the person who signed each up.
-- A platform admin is no member of any firm (D-16), so row security shows them no firm: this function is how they
-- see these, and only these fields.
CREATE FUNCTION public.admin_waiting_firms()
RETURNS TABLE (firm_id uuid, name text, address text, signed_up_by_email text, signed_up_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT f.id, f.name, f.address,
         (SELECT u.email::text FROM auth.users u WHERE u.id = f.signed_up_by),
         f.created_at
  FROM public.firms f
  WHERE f.approved_at IS NULL AND f.decision IS NULL
  ORDER BY f.created_at, f.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_waiting_firms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_waiting_firms() TO authenticated;

-- The decision on a waiting firm, kept on the firm itself: what was decided, by whom, when, and why. `approved_at`
-- stays what the rest of the product reads (a firm may send once it is set); a refusal leaves it empty. The firm is
-- decided once: suspending or closing a firm later is its own story.
ALTER TABLE public.firms
  ADD COLUMN decision text CHECK (decision IN ('approved', 'refused')),
  ADD COLUMN decided_at timestamptz,
  ADD COLUMN decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN decision_note text CHECK (char_length(decision_note) <= 500),
  ADD CONSTRAINT firms_decision_is_whole CHECK ((decision IS NULL) = (decided_at IS NULL)),
  ADD CONSTRAINT firms_refused_is_not_approved CHECK (decision IS DISTINCT FROM 'refused' OR approved_at IS NULL);

-- A firm's own members read the firm, not the admin's side of the decision: the note and who decided stay behind the
-- admin functions (D-16). Column by column, so a column added later is not readable until it is granted here.
REVOKE SELECT ON public.firms FROM authenticated;
GRANT SELECT (id, name, address, visibility, approved_at, parent_firm_id, created_at, decision) ON public.firms TO authenticated;

-- A refused firm is not shown at its address and does not let its founder in there; the address stays taken.
CREATE OR REPLACE FUNCTION public.firm_public_name(p_address text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.name
  FROM public.firms f
  WHERE f.address = lower(btrim(p_address)) AND f.decision IS DISTINCT FROM 'refused'
$$;

CREATE OR REPLACE FUNCTION public.is_member_of_firm_address(p_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.is_firm_member(f.id)
    FROM public.firms f
    WHERE f.address = lower(btrim(p_address)) AND f.decision IS DISTINCT FROM 'refused'
  ), false)
$$;

CREATE FUNCTION public.admin_decide_firm(p_firm_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  f public.firms;
  note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_approve IS NULL THEN
    RAISE EXCEPTION 'Approve the firm or refuse it' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO f FROM public.firms WHERE id = p_firm_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  -- An admin does not decide on a firm they belong to.
  IF public.is_firm_member(p_firm_id) THEN
    RAISE EXCEPTION 'An admin does not decide on a firm they belong to' USING ERRCODE = '42501';
  END IF;
  IF f.approved_at IS NOT NULL OR f.decision IS NOT NULL THEN
    RAISE EXCEPTION 'That firm has been decided already' USING ERRCODE = '55000';
  END IF;
  UPDATE public.firms
  SET approved_at = CASE WHEN p_approve THEN now() END,
      decision = CASE WHEN p_approve THEN 'approved' ELSE 'refused' END,
      decided_at = now(), decided_by = auth.uid(), decision_note = note
  WHERE id = p_firm_id;
  PERFORM public.record_firm_event(p_firm_id, CASE WHEN p_approve THEN 'firm_approved' ELSE 'firm_refused' END,
                                   auth.uid(), jsonb_build_object('address', f.address, 'note', note));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide_firm(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_firm(uuid, boolean, text) TO authenticated;
