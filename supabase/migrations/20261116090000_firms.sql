-- The one place Edgar Allan Advisory's id is written: the first firm, which every intake without a firm belongs to.
-- Later stories that need "the default firm" call this.
CREATE FUNCTION public.default_firm_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$ SELECT '00000000-0000-4000-8000-00000000eaa1'::uuid $$;

CREATE TABLE public.firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL UNIQUE,
  visibility text NOT NULL DEFAULT 'by_level' CHECK (visibility IN ('by_level', 'everyone')),
  approved_at timestamptz,
  parent_firm_id uuid REFERENCES public.firms (id)
);

INSERT INTO public.firms (id, name, address, visibility, approved_at)
VALUES (public.default_firm_id(), 'Edgar Allan Advisory', 'edgar-allan-advisory', 'everyone', now());

-- "Current" is written once: begun, and not ended (an end date is exclusive). Every guard and helper uses this.
CREATE FUNCTION public.membership_is_current(p_valid_from timestamptz, p_valid_until timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$ SELECT p_valid_from <= now() AND (p_valid_until IS NULL OR p_valid_until > now()) $$;

CREATE TABLE public.firm_memberships (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'lead', 'agent')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz CHECK (valid_until >= valid_from)
);

INSERT INTO public.firm_memberships (firm_id, user_id, role)
SELECT public.default_firm_id(), r.user_id,
       CASE WHEN bool_or(r.role = 'admin') THEN 'owner' ELSE 'agent' END
FROM public.user_roles r
WHERE r.role IN ('admin', 'advisor')
GROUP BY r.user_id;

ALTER TABLE public.chamber_sessions
  ADD COLUMN firm_id uuid NOT NULL DEFAULT public.default_firm_id() REFERENCES public.firms (id);

CREATE FUNCTION public.keep_intake_firm()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.firm_id := public.default_firm_id();
  ELSE
    NEW.firm_id := OLD.firm_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_intake_firm() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_sessions_firm
  BEFORE INSERT OR UPDATE OF firm_id ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.keep_intake_firm();

ALTER TABLE public.firms ADD CONSTRAINT firms_address_check CHECK (char_length(address) BETWEEN 3 AND 40 AND address ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
  AND address <> ALL (ARRAY['www', 'app', 'api', 'mail', 'admin', 'status', 'quotes'])
  AND position('nevermore' IN replace(address, '-', '')) = 0);

CREATE FUNCTION public.refuse_peo_firm_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE peo text;
BEGIN
  -- An address reads as a listed PEO when one of its hyphen-separated words is the PEO's name or its first word
  -- (adp, adp-benefits), or the address without hyphens is the whole name (adp-total-source). Matched as whole
  -- words, never as a piece of one (petrinetwork is not TriNet). A name with fewer than 3 letters or digits
  -- once cleaned ('&', 'A1') has nothing to compare and holds no address back.
  SELECT p.name INTO peo
  FROM public.peos p
  CROSS JOIN LATERAL (
    SELECT regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') AS whole,
           regexp_replace(lower(split_part(p.name, ' ', 1)), '[^a-z0-9]', '', 'g') AS first_word
  ) c
  WHERE p.listed
    AND ((char_length(c.whole) >= 3 AND (c.whole = replace(NEW.address, '-', '') OR c.whole = ANY (string_to_array(NEW.address, '-'))))
      OR (char_length(c.first_word) >= 3 AND c.first_word = ANY (string_to_array(NEW.address, '-'))))
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'A firm address can''t read as a PEO (%)', peo USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_peo_firm_address() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firms_address_not_a_peo
  BEFORE INSERT OR UPDATE OF address ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.refuse_peo_firm_address();

CREATE TABLE public.firm_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  name text NOT NULL,
  parent_team_id uuid,
  lead_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  UNIQUE (firm_id, id),
  FOREIGN KEY (firm_id, parent_team_id) REFERENCES public.firm_teams (firm_id, id)
);

CREATE FUNCTION public.refuse_team_loop()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE above (id) AS (
      SELECT NEW.parent_team_id
      UNION
      SELECT t.parent_team_id FROM public.firm_teams t JOIN above a ON t.id = a.id WHERE t.parent_team_id IS NOT NULL
    )
    SELECT 1 FROM above WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'A team can''t sit under itself' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_team_loop() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firm_teams_no_loop
  BEFORE INSERT OR UPDATE OF parent_team_id ON public.firm_teams
  FOR EACH ROW EXECUTE FUNCTION public.refuse_team_loop();

ALTER TABLE public.firm_memberships ADD COLUMN team_id uuid,
  ADD FOREIGN KEY (firm_id, team_id) REFERENCES public.firm_teams (firm_id, id);

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE public.firm_memberships ADD CONSTRAINT firm_memberships_one_at_a_time
  EXCLUDE USING gist (firm_id WITH =, user_id WITH =, tstzrange(valid_from, valid_until) WITH &&);

CREATE FUNCTION public.keep_membership_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.id, NEW.firm_id, NEW.user_id, NEW.role, NEW.team_id, NEW.valid_from)
     IS DISTINCT FROM (OLD.id, OLD.firm_id, OLD.user_id, OLD.role, OLD.team_id, OLD.valid_from)
     OR OLD.valid_until IS NOT NULL THEN
    RAISE EXCEPTION 'A membership is never changed: end it and add another' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_membership_history() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firm_memberships_history
  BEFORE UPDATE ON public.firm_memberships
  FOR EACH ROW EXECUTE FUNCTION public.keep_membership_history();

-- A firm always keeps a current owner (PRD 8.2). An owner with an end date is going to lapse, so only an owner
-- with no end date lets another current owner go: ending, deleting or cascading away a current owner's membership
-- is refused unless an open-ended current owner remains, and an owner is not added with an end date unless one
-- already exists. Ownership is passed by adding the new owner first. The firm row is locked first, so two
-- transactions ending different owners queue instead of each seeing the other still there.
CREATE FUNCTION public.keep_firm_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE r public.firm_memberships;
BEGIN
  r := CASE WHEN TG_OP = 'INSERT' THEN NEW ELSE OLD END;
  IF r.role <> 'owner' THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' AND (r.valid_until IS NULL OR r.valid_until <= now()) THEN
    RETURN NULL;
  END IF;
  IF TG_OP <> 'INSERT' AND NOT public.membership_is_current(r.valid_from, r.valid_until) THEN
    RETURN NULL;
  END IF;
  PERFORM 1 FROM public.firms WHERE id = r.firm_id FOR UPDATE;
  IF NOT EXISTS (
       SELECT 1 FROM public.firm_memberships m
       WHERE m.firm_id = r.firm_id AND m.role = 'owner' AND m.id <> r.id
         AND m.valid_until IS NULL AND public.membership_is_current(m.valid_from, m.valid_until)
     ) THEN
    RAISE EXCEPTION 'A firm keeps at least one current owner' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_firm_owner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER firm_memberships_keep_owner
  AFTER UPDATE OR DELETE ON public.firm_memberships
  FOR EACH ROW EXECUTE FUNCTION public.keep_firm_owner();

CREATE TRIGGER firm_memberships_keep_owner_insert
  AFTER INSERT ON public.firm_memberships
  FOR EACH ROW EXECUTE FUNCTION public.keep_firm_owner();

-- The caller's role in a firm today: from the dated memberships, a current one only (begun, not ended). NULL for
-- anyone who isn't a member: a prospect, a guest, and an account presenting a guest token,
-- as has_role() treats it. Signed-out callers can't call them (policies for them don't use them). Answers about the caller only; later stories' policies and functions call these.
CREATE FUNCTION public.firm_role(p_firm_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.firm_memberships m
  WHERE auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND m.firm_id = p_firm_id
    AND m.user_id = auth.uid()
    AND public.membership_is_current(m.valid_from, m.valid_until)
$$;

CREATE FUNCTION public.is_firm_member(p_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.firm_role(p_firm_id) IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.firm_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_firm_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_firm_member(uuid) TO authenticated;

-- Row security: a current member reads their own firm, its teams and their own memberships; nobody writes through
-- the API (a server function, as the service role, does). Existing tables' policies are not touched here.
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_memberships ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.firms, public.firm_teams, public.firm_memberships FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.firms, public.firm_teams, public.firm_memberships TO authenticated;

CREATE POLICY firms_members_read ON public.firms
  FOR SELECT TO authenticated USING (public.is_firm_member(id));

CREATE POLICY firm_teams_members_read ON public.firm_teams
  FOR SELECT TO authenticated USING (public.is_firm_member(firm_id));

CREATE POLICY firm_memberships_own_read ON public.firm_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_firm_member(firm_id));
