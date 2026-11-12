-- The advisor role by organisation (joshrkay/Nevermore#92, story M-4.2; docs/adr/0005-brokers-send-through-their-own-mailbox.md).
--
-- The console shows every submission to every advisor, so the advisor role can't go to whoever signs up. An admin keeps a
-- list of allowed organisations; a person who signs in with Google or Microsoft gets the advisor role without an admin only
-- when what the provider vouches for matches the list. Everyone else waits for an admin, as today.
--
-- * Matched on the provider's own claim, never on the email text (a Microsoft tenant's administrator can put any address in
--   a token): for Google, the verified hosted domain of the account (`hd`, with the email verified); for Microsoft, the
--   tenant ID the token was issued by (`tid`, or the one in its issuer). If a sign-in carries no such claim it matches
--   nothing, so the rule grants nothing rather than something it can't vouch for.
-- * A free-mail domain (gmail.com, outlook.com and the like) can't be added, and neither can Microsoft's tenants for personal
--   accounts, so no one with a free account is ever matched.
-- * The rule only ever grants `advisor`, never `admin`, and never takes a role away. Removing an organisation stops
--   later sign-ups matching; people already granted keep the role until an admin revokes it, as today.
-- * Every change to the list and every grant by the rule is logged, append-only: who, when and the organisation it matched.
-- * The list is readable and changeable by admins alone, and only through the functions below. claim_advisor_role_by_organisation()
--   reads the caller's own sign-in claims from auth.identities (which the caller can't write), never anything the browser sends.

SET lock_timeout = '5s';

CREATE TABLE public.allowed_organisations (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  org_id text NOT NULL,
  label text NOT NULL,
  added_by uuid,
  added_by_email text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, org_id)
);

ALTER TABLE public.allowed_organisations ADD CONSTRAINT allowed_organisations_check CHECK (
  provider IN ('google', 'microsoft')
  AND org_id = lower(btrim(org_id))
  AND char_length(org_id) BETWEEN 3 AND 253
  AND label = btrim(label) AND char_length(label) BETWEEN 1 AND 80
);

CREATE TABLE public.advisor_role_events (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  provider text NOT NULL,
  org_id text NOT NULL,
  org_label text,
  actor_id uuid,
  actor_email text,
  at timestamptz NOT NULL DEFAULT now()
);

-- org_added and org_removed: the admin who did it. role_granted: the person who was granted the role, and how it matched.
ALTER TABLE public.advisor_role_events ADD CONSTRAINT advisor_role_events_check CHECK (
  kind IN ('org_added', 'org_removed', 'role_granted') AND provider IN ('google', 'microsoft')
);

CREATE TRIGGER advisor_role_events_append_only
  BEFORE UPDATE OR DELETE ON public.advisor_role_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

ALTER TABLE public.allowed_organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_role_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.allowed_organisations, public.advisor_role_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.allowed_organisations, public.advisor_role_events TO authenticated;
CREATE POLICY allowed_organisations_admin_read ON public.allowed_organisations FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY advisor_role_events_admin_read ON public.advisor_role_events FOR SELECT TO authenticated USING (public.has_role('admin'));

-- ---------- What can never be on the list ----------
-- Consumer sign-in domains, and Microsoft's tenants for personal accounts. A match on any of them would be everyone with a free account.
CREATE FUNCTION public.is_consumer_organisation(p_provider text, p_org_id text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT CASE p_provider
    WHEN 'google' THEN lower(p_org_id) = ANY (ARRAY[
      'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'passport.com', 'yahoo.com', 'ymail.com',
      'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'mail.com',
      'yandex.com', 'zoho.com', 'fastmail.com', 'hey.com', 'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net'])
    WHEN 'microsoft' THEN lower(p_org_id) = ANY (ARRAY['9188040d-6c67-4c5b-b112-36a304b66dad', 'f8cdef31-a31e-4b4a-93e4-5f571e91255a'])
    ELSE true
  END;
$$;

-- The organisation a sign-in vouches for, from the claims the provider's token carried, or null when it vouches for none.
-- Never reads the email address, because an email is text a tenant's administrator can set.
CREATE FUNCTION public.identity_organisation(p_provider text, p_identity jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  org text;
  guid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF p_provider = 'google' THEN
    -- Google's hosted domain, and only for an account whose email Google verified.
    IF lower(COALESCE(p_identity ->> 'email_verified', '')) <> 'true' THEN RETURN NULL; END IF;
    org := lower(btrim(COALESCE(p_identity ->> 'hd', '')));
    IF org ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN RETURN org; END IF;
    RETURN NULL;
  ELSIF p_provider = 'microsoft' THEN
    -- The tenant that issued the token: its `tid`, wherever the provider's data keeps it, or the one in its issuer.
    org := lower(btrim(COALESCE(
      NULLIF(p_identity ->> 'tid', ''),
      NULLIF(p_identity -> 'custom_claims' ->> 'tid', ''),
      substring(COALESCE(p_identity ->> 'iss', '') FROM 'login\.microsoftonline\.com/([0-9A-Fa-f-]{36})/'),
      '')));
    IF org ~ guid THEN RETURN org; END IF;
    RETURN NULL;
  END IF;
  RETURN NULL;
END;
$$;

-- ---------- The admin's list ----------
CREATE FUNCTION public.admin_add_allowed_organisation(p_provider text, p_org_id text, p_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  org text := lower(btrim(COALESCE(p_org_id, '')));
  lbl text := btrim(COALESCE(p_label, ''));
  row public.allowed_organisations;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_provider NOT IN ('google', 'microsoft') THEN
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
    RAISE EXCEPTION 'A free-mail domain or personal-account tenant can never be allowed: it would match everyone with a free account' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.allowed_organisations (provider, org_id, label, added_by, added_by_email)
  VALUES (p_provider, org, lbl, auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO row;
  INSERT INTO public.advisor_role_events (kind, provider, org_id, org_label, actor_id, actor_email)
  VALUES ('org_added', row.provider, row.org_id, row.label, auth.uid(), auth.jwt() ->> 'email');
  RETURN jsonb_build_object('id', row.id);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'That organisation is already on the list' USING ERRCODE = '23505';
END;
$$;

CREATE FUNCTION public.admin_remove_allowed_organisation(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE row public.allowed_organisations;
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.allowed_organisations WHERE id = p_id RETURNING * INTO row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That organisation is not on the list' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO public.advisor_role_events (kind, provider, org_id, org_label, actor_id, actor_email)
  VALUES ('org_removed', row.provider, row.org_id, row.label, auth.uid(), auth.jwt() ->> 'email');
  RETURN jsonb_build_object('id', p_id);
END;
$$;

-- ---------- Claiming the role ----------
-- Called by the signed-in person after they sign in. It reads their own sign-in claims, never anything the caller passes, and
-- grants the advisor role only when one matches the list. Safe to call again: it changes nothing for someone who has a role.
CREATE FUNCTION public.claim_advisor_role_by_organisation()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  uid uuid := auth.uid();
  ident record;
  prov text;
  org text;
  hit public.allowed_organisations;
BEGIN
  IF uid IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'not_signed_in');
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = uid AND r.role::text IN ('advisor', 'admin')) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_has_role');
  END IF;
  FOR ident IN SELECT i.provider, i.identity_data FROM auth.identities i WHERE i.user_id = uid AND i.provider IN ('google', 'azure') LOOP
    prov := CASE ident.provider WHEN 'google' THEN 'google' ELSE 'microsoft' END;
    org := public.identity_organisation(prov, ident.identity_data);
    CONTINUE WHEN org IS NULL;
    SELECT * INTO hit FROM public.allowed_organisations o WHERE o.provider = prov AND o.org_id = org;
    CONTINUE WHEN NOT FOUND;
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'advisor') ON CONFLICT DO NOTHING;
    INSERT INTO public.advisor_role_events (kind, provider, org_id, org_label, actor_id, actor_email)
    VALUES ('role_granted', prov, org, hit.label, uid, lower(ident.identity_data ->> 'email'));
    RETURN jsonb_build_object('granted', true, 'organisation', hit.label);
  END LOOP;
  RETURN jsonb_build_object('granted', false, 'reason', 'no_match');
END;
$$;

REVOKE ALL ON FUNCTION public.is_consumer_organisation(text, text), public.identity_organisation(text, jsonb),
  public.admin_add_allowed_organisation(text, text, text), public.admin_remove_allowed_organisation(bigint),
  public.claim_advisor_role_by_organisation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_allowed_organisation(text, text, text), public.admin_remove_allowed_organisation(bigint),
  public.claim_advisor_role_by_organisation() TO authenticated;
