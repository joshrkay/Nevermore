CREATE TABLE public.firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL UNIQUE,
  visibility text NOT NULL DEFAULT 'by_level' CHECK (visibility IN ('by_level', 'everyone')),
  approved_at timestamptz,
  parent_firm_id uuid REFERENCES public.firms (id)
);

INSERT INTO public.firms (id, name, address, visibility, approved_at)
VALUES ('00000000-0000-4000-8000-00000000eaa1', 'Edgar Allan Advisory', 'edgar-allan-advisory', 'everyone', now());

CREATE TABLE public.firm_memberships (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'lead', 'agent')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz CHECK (valid_until >= valid_from)
);

INSERT INTO public.firm_memberships (firm_id, user_id, role)
SELECT '00000000-0000-4000-8000-00000000eaa1', r.user_id,
       CASE WHEN bool_or(r.role = 'admin') THEN 'owner' ELSE 'agent' END
FROM public.user_roles r
WHERE r.role IN ('admin', 'advisor')
GROUP BY r.user_id;

ALTER TABLE public.chamber_sessions
  ADD COLUMN firm_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-00000000eaa1' REFERENCES public.firms (id);

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
    NEW.firm_id := '00000000-0000-4000-8000-00000000eaa1';
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
  SELECT p.name INTO peo
  FROM public.peos p
  WHERE p.listed
    AND position(regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') IN replace(NEW.address, '-', '')) > 0
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
