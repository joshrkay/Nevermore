-- Join by organisation (story CRM-P1.4; docs/BROKER_CRM_BUILD.md D-18, D-23, D-27, D-29, D-31, D-33, D-34, D-40).
--
-- An owner lists the firm's Google domain or Microsoft tenant. A person who signs in at the firm's address from a listed organisation,
-- and is not a member, is listed for the firm's owners as "asked to join". Nobody becomes a member until an owner approves them with a
-- role. This replaces the platform admin's list (20261113100000_allowed_organisations.sql): that list gave a person the platform-wide
-- advisor role without anyone at the firm agreeing, which no longer means anything now that a firm's membership is the lock (D-18).
--
-- * The match is on what the provider vouches for, never on the email text, exactly as before: identity_organisation() (Google's
--   verified hosted domain, Microsoft's tenant id) is kept as it is and is the only thing that decides which organisation a sign-in is
--   from. A sign-in that vouches for none matches nothing. is_consumer_organisation() is kept too: a free-mail domain or a Microsoft
--   tenant for personal accounts can't be listed, so nobody with a free account is ever matched.
-- * The firm is taken from the address the person is at, which the database resolves itself (as accept_invitation does, D-34); the
--   browser names no firm and no organisation. The organisation comes from the caller's own sign-in claims in auth.identities, which
--   the caller can't write.
-- * Asking to join tells an outsider nothing about what a firm has listed: for everyone who is not from a listed organisation the
--   answer is the same "none" whether the firm lists nothing, lists other organisations, or is not a firm at all.
-- * One organisation may be listed by more than one firm. A listing never grants membership by itself; an owner approves each person.
-- * A person has at most one open request to join a given firm, and an organisation is listed at most once per firm: both are
--   constraints (D-29).
-- * A refused firm lists and approves nothing (D-31); a firm waiting for approval does (its people work before approval, D-27); a
--   suspended firm's owners are refused by firm_role() as for everything else.
-- * Approving makes a membership with the chosen role. The membership's team stays empty until CRM-X1.1 (D-20). The membership's own
--   trigger writes the "member_added" (or "owner_added") entry, so approving writes none of its own.

-- 0. The firm's record: four more kinds. The list is the one 20261118090000_leave_a_firm.sql states, with these added.
-- src/data/firmActivity.ts (ENTRY_KINDS) is kept in step by src/data/schemaSync.test.ts, which reads the list of the latest migration
-- that holds it. These entries belong to the firm (record type 'firm', the firm's id) and hold no content: a request's person is the
-- entry's subject, and nothing names the organisation.
ALTER TABLE public.firm_activity DROP CONSTRAINT IF EXISTS firm_activity_kind_check;
ALTER TABLE public.firm_activity ADD CONSTRAINT firm_activity_kind_check CHECK (kind IN (
    -- sync:begin firm_activity_kinds
    'sign_in', 'submission_viewed', 'document_downloaded', 'packet_downloaded', 'send_recorded',
    'member_added', 'member_ended', 'owner_added', 'owner_ended',
    'export_made', 'invitation_sent', 'member_removed', 'support_access',
    'firm_signed_up', 'firm_approved', 'firm_refused', 'invitation_withdrawn',
    'member_suspended', 'member_restored',
    'firm_suspended', 'firm_restored',
    'member_left',
    'organisation_listed', 'organisation_removed', 'join_asked', 'join_declined'
    -- sync:end firm_activity_kinds
  ));

-- 1. The organisations a firm lists. Closed to the API, owners included: an owner reads and changes the list through the functions
-- below, which check that the caller is a current owner of the firm (D-18).
CREATE TABLE public.firm_organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  -- A Google domain or a Microsoft tenant id, in lower case.
  org_id text NOT NULL CHECK (org_id = lower(btrim(org_id)) AND char_length(org_id) BETWEEN 3 AND 253),
  label text NOT NULL CHECK (label = btrim(label) AND char_length(label) BETWEEN 1 AND 80),
  added_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  -- An organisation is listed at most once per firm (D-29). Two firms may each list it.
  CONSTRAINT firm_organisations_once_per_firm UNIQUE (firm_id, provider, org_id)
);

ALTER TABLE public.firm_organisations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_organisations FROM PUBLIC, anon, authenticated;

-- 2. Listing, reading and removing. Each checks the caller's own current ownership of the firm through firm_role(), which also holds a
-- password sign-in back for its second factor (D-19), narrows to the firm at the address (D-40) and refuses a suspended firm's owners.
-- A refused firm is refused here (D-31).
CREATE FUNCTION public.add_firm_organisation(p_firm_id uuid, p_provider text, p_org_id text, p_label text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  org text := lower(btrim(COALESCE(p_org_id, '')));
  lbl text := btrim(COALESCE(p_label, ''));
  row public.firm_organisations;
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can list organisations' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t list organisations' USING ERRCODE = 'PT403';
  END IF;
  IF p_provider IS NULL OR p_provider NOT IN ('google', 'microsoft') THEN
    RAISE EXCEPTION 'The provider is Google or Microsoft' USING ERRCODE = '22023';
  END IF;
  IF char_length(lbl) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Name the organisation, in 80 characters or fewer' USING ERRCODE = '22023';
  END IF;
  IF p_provider = 'google' AND org !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN
    RAISE EXCEPTION 'A Google organisation is its verified domain, such as advisory.example' USING ERRCODE = '22023';
  END IF;
  IF p_provider = 'microsoft' AND org !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'A Microsoft organisation is its tenant ID, a GUID, not a domain or an address' USING ERRCODE = '22023';
  END IF;
  IF public.is_consumer_organisation(p_provider, org) THEN
    RAISE EXCEPTION 'A free-mail domain or personal-account tenant can never be listed: it would match everyone with a free account' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.firm_organisations (firm_id, provider, org_id, label, added_by)
    VALUES (p_firm_id, p_provider, org, lbl, auth.uid())
    RETURNING * INTO row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That organisation is already listed' USING ERRCODE = '23505';
  END;
  PERFORM public.firm_activity_append(p_firm_id, 'organisation_listed', 'firm', p_firm_id::text);
  RETURN jsonb_build_object('id', row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.add_firm_organisation(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_firm_organisation(uuid, text, text, text) TO authenticated;

CREATE FUNCTION public.firm_organisations(p_firm_id uuid)
RETURNS TABLE (id uuid, provider text, org_id text, label text, added_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can see its organisations' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t list organisations' USING ERRCODE = 'PT403';
  END IF;
  RETURN QUERY
    SELECT o.id, o.provider, o.org_id, o.label, o.added_at
    FROM public.firm_organisations o
    WHERE o.firm_id = p_firm_id
    ORDER BY o.added_at, o.id;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_organisations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_organisations(uuid) TO authenticated;

-- Removing a listing stops later requests matching it. Requests already open stay, for an owner to approve or decline: the person did
-- sign in from a listed organisation when they asked. An id that is another firm's gets the same refusal as one that matches nothing.
CREATE FUNCTION public.remove_firm_organisation(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE row public.firm_organisations;
BEGIN
  SELECT * INTO row FROM public.firm_organisations o WHERE o.id = p_id FOR UPDATE;
  IF NOT FOUND OR public.firm_role(row.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can remove its organisations' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = row.firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t list organisations' USING ERRCODE = 'PT403';
  END IF;
  DELETE FROM public.firm_organisations o WHERE o.id = row.id;
  PERFORM public.firm_activity_append(row.firm_id, 'organisation_removed', 'firm', row.firm_id::text);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_firm_organisation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_firm_organisation(uuid) TO authenticated;

-- 3. Requests to join. A person asks by signing in at the firm's address from a listed organisation (ask_to_join_firm below); nothing
-- else writes a row. Closed to the API: an owner reads the open ones through firm_join_requests(), which adds the person's email.
CREATE TABLE public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Which organisation vouched, as it was listed when the person asked: kept as written, so removing the listing later does not
  -- rewrite who vouched for an open request.
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  org_id text NOT NULL,
  org_label text NOT NULL CHECK (char_length(org_label) BETWEEN 1 AND 80),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'declined')),
  asked_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decided_at timestamptz,
  -- The role an owner approved them with.
  decided_role text CHECK (decided_role IN ('owner', 'lead', 'agent')),
  CONSTRAINT join_requests_decided_is_whole CHECK ((status = 'open') = (decided_at IS NULL)),
  CONSTRAINT join_requests_role_only_when_approved CHECK (decided_role IS NULL OR status = 'approved')
);

-- A person has at most one open request to join a given firm (D-29): the constraint is the rule, the check in ask_to_join_firm only
-- makes asking again a plain "yes, you have asked".
CREATE UNIQUE INDEX join_requests_one_open ON public.join_requests (firm_id, user_id) WHERE status = 'open';
CREATE INDEX join_requests_firm_open_idx ON public.join_requests (firm_id, asked_at) WHERE status = 'open';

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.join_requests FROM PUBLIC, anon, authenticated;

-- 4. Asking. The firm is the one that holds the address, resolved here (D-18, D-34); the organisation is whatever the caller's own
-- sign-in vouches for (identity_organisation, which never reads the email text), matched against that firm's list. The answer is
-- 'asked' or 'none'. 'none' is the answer for every other reason too (no such firm, a refused or suspended firm, already a member,
-- suspended there, a guest, an unconfirmed email, an organisation the firm does not list, a declined earlier request), so a person
-- who is not from a listed organisation learns nothing about what a firm has listed.
-- A declined request is final for that person at that firm: asking again by signing in again gives 'none'. An owner who changes their
-- mind invites the person by email. Without that, a person could ask every time they signed in.
CREATE FUNCTION public.ask_to_join_firm(p_firm_address text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  f public.firms;
  ident record;
  prov text;
  org text;
  hit public.firm_organisations;
  made uuid;
BEGIN
  IF NOT public.is_signed_in_person() THEN
    RETURN 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = uid AND u.email_confirmed_at IS NOT NULL) THEN
    RETURN 'none';
  END IF;
  SELECT * INTO f FROM public.firms x WHERE x.address = lower(btrim(COALESCE(p_firm_address, ''))) AND x.decision IS DISTINCT FROM 'refused';
  IF NOT FOUND OR public.firm_is_suspended(f.id) THEN
    RETURN 'none';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = f.id AND m.user_id = uid AND public.membership_is_current(m.valid_from, m.valid_until))
     OR EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.firm_id = f.id AND s.user_id = uid AND s.ended_at IS NULL) THEN
    RETURN 'none';
  END IF;
  IF EXISTS (SELECT 1 FROM public.join_requests r WHERE r.firm_id = f.id AND r.user_id = uid AND r.status = 'open') THEN
    RETURN 'asked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.join_requests r WHERE r.firm_id = f.id AND r.user_id = uid AND r.status = 'declined') THEN
    RETURN 'none';
  END IF;
  FOR ident IN SELECT i.provider, i.identity_data FROM auth.identities i WHERE i.user_id = uid AND i.provider IN ('google', 'azure') ORDER BY i.created_at LOOP
    prov := CASE ident.provider WHEN 'google' THEN 'google' ELSE 'microsoft' END;
    org := public.identity_organisation(prov, ident.identity_data);
    CONTINUE WHEN org IS NULL;
    SELECT * INTO hit FROM public.firm_organisations o WHERE o.firm_id = f.id AND o.provider = prov AND o.org_id = org;
    CONTINUE WHEN NOT FOUND;
    INSERT INTO public.join_requests (firm_id, user_id, provider, org_id, org_label)
    VALUES (f.id, uid, prov, org, hit.label)
    ON CONFLICT (firm_id, user_id) WHERE status = 'open' DO NOTHING
    RETURNING id INTO made;
    IF made IS NOT NULL THEN
      PERFORM public.firm_activity_append(f.id, 'join_asked', 'firm', f.id::text, uid);
    END IF;
    RETURN 'asked';
  END LOOP;
  RETURN 'none';
END;
$$;

REVOKE ALL ON FUNCTION public.ask_to_join_firm(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ask_to_join_firm(text) TO authenticated;

-- 5. What an owner sees: each open request with the person's email, when they asked and which listed organisation vouched.
CREATE FUNCTION public.firm_join_requests(p_firm_id uuid)
RETURNS TABLE (request_id uuid, email text, asked_at timestamptz, provider text, org_label text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.firm_role(p_firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can see who asked to join' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t take new members' USING ERRCODE = 'PT403';
  END IF;
  RETURN QUERY
    SELECT r.id, lower(btrim(u.email::text)), r.asked_at, r.provider, r.org_label
    FROM public.join_requests r
    JOIN auth.users u ON u.id = r.user_id
    WHERE r.firm_id = p_firm_id AND r.status = 'open'
    ORDER BY r.asked_at, r.id;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_join_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_join_requests(uuid) TO authenticated;

-- 6. Approving and declining. An id that is another firm's gets the same refusal as one that matches nothing.
-- Approving makes the membership with the chosen role and no team (D-20), in the same step that closes the request; the membership's
-- trigger writes the firm's "member_added" or "owner_added" entry. A person who has become a member some other way meanwhile (an
-- invitation) has the request closed and keeps the role they have.
CREATE FUNCTION public.approve_join_request(p_request_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req public.join_requests;
  have text;
BEGIN
  SELECT * INTO req FROM public.join_requests r WHERE r.id = p_request_id FOR UPDATE;
  IF NOT FOUND OR public.firm_role(req.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can approve a request' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = req.firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t take new members' USING ERRCODE = 'PT403';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('owner', 'lead', 'agent') THEN
    RAISE EXCEPTION 'Choose a role: owner, lead or agent' USING ERRCODE = '22023';
  END IF;
  IF req.status <> 'open' THEN
    RAISE EXCEPTION 'That request has already been decided' USING ERRCODE = 'PT410';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firm_member_suspensions s WHERE s.firm_id = req.firm_id AND s.user_id = req.user_id AND s.ended_at IS NULL) THEN
    RAISE EXCEPTION 'That person is suspended at this firm. Lift the suspension instead.' USING ERRCODE = 'PT409';
  END IF;
  SELECT m.role INTO have FROM public.firm_memberships m
  WHERE m.firm_id = req.firm_id AND m.user_id = req.user_id AND public.membership_is_current(m.valid_from, m.valid_until) LIMIT 1;
  IF have IS NULL THEN
    INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (req.firm_id, req.user_id, p_role);
  END IF;
  UPDATE public.join_requests r
  SET status = 'approved', decided_by = auth.uid(), decided_at = now(), decided_role = COALESCE(have, p_role)
  WHERE r.id = req.id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_join_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid, text) TO authenticated;

CREATE FUNCTION public.decline_join_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE req public.join_requests;
BEGIN
  SELECT * INTO req FROM public.join_requests r WHERE r.id = p_request_id FOR UPDATE;
  IF NOT FOUND OR public.firm_role(req.firm_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm can decline a request' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.firms f WHERE f.id = req.firm_id AND f.decision = 'refused') THEN
    RAISE EXCEPTION 'This firm can''t take new members' USING ERRCODE = 'PT403';
  END IF;
  IF req.status <> 'open' THEN
    RAISE EXCEPTION 'That request has already been decided' USING ERRCODE = 'PT410';
  END IF;
  UPDATE public.join_requests r SET status = 'declined', decided_by = auth.uid(), decided_at = now() WHERE r.id = req.id;
  PERFORM public.firm_activity_append(req.firm_id, 'join_declined', 'firm', req.firm_id::text, req.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.decline_join_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_join_request(uuid) TO authenticated;

-- 7. What this story retires (D-23). The platform admin's list gave a person the platform-wide advisor role when they signed in from a
-- listed organisation; a firm's membership is the lock now (D-18), so the three functions that kept and used that list are dropped,
-- and with them their grants. A person who already holds the role keeps it, as the old migration said: nothing here takes a role away.
-- Kept on purpose: identity_organisation() and is_consumer_organisation() (this story's two rules), and the two old tables, which
-- hold the old list and the append-only log of who was given the role and why. They are history now: nothing reads or writes them but
-- the platform's own record. The old migration is not edited.
DROP FUNCTION public.claim_advisor_role_by_organisation();
DROP FUNCTION public.admin_add_allowed_organisation(text, text, text);
DROP FUNCTION public.admin_remove_allowed_organisation(bigint);
