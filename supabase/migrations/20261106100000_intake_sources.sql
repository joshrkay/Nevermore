-- Intake sources: where each intake came from, so the advisors' funnel can compare channels (plan J-2.3, decision
-- D43; docs/GO_TO_MARKET.md, section 7).
--
-- A link to the site can carry a referral code (?ref=) and campaign tags (utm_source, utm_medium, utm_campaign). The
-- browser keeps the codes of the last such link for 30 days (src/data/intakeSource.ts) and sends them when it creates
-- an intake. Here:
--
-- * Four columns on chamber_sessions hold them. Each is a short code (is_source_code: lowercase letters, digits,
--   dots, hyphens and underscores, at most 64 characters), never free text, so no answer, name with spaces, email
--   address or URL fits. They are set when the intake is created and never change: an update keeps what the row
--   had, whoever sends it.
-- * Each milestone row copies its intake's codes when it is recorded, so an intake still counts towards its source
--   after it is deleted, as it does in the funnel (20261105092000).
-- * referral_partners names the partner behind each referral code. Advisors read it, and add or rename partners
--   through advisor_add_referral_partner() and advisor_update_referral_partner(). A code never changes, because links
--   carrying it are already out. An intake whose referral code names no partner keeps the code, and the funnel shows
--   it as an unlisted code.
-- * advisor_intake_sources() counts, for intakes started in a period, how many from each source reached each step.
--   Advisors only.
--
-- Deploy order: this migration, then the front end. The front end sends the new columns when it creates an intake;
-- one from before them sends none, and its intakes count as having no source.

SET lock_timeout = '5s';

-- ---------- The code format ----------

-- Whether a referral or campaign code is well formed. Null is not a code, and passes the checks that use this.
CREATE OR REPLACE FUNCTION public.is_source_code(p_code text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT p_code ~ (
    -- sync:begin source_code_pattern
    '^[a-z0-9][a-z0-9._-]{0,63}$'
    -- sync:end source_code_pattern
  );
$$;

-- The check constraints below call it as whoever writes the row, prospects included.
GRANT EXECUTE ON FUNCTION public.is_source_code(text) TO anon, authenticated, service_role;

-- ---------- Where an intake came from ----------

ALTER TABLE public.chamber_sessions
  ADD COLUMN referral_code text,
  ADD COLUMN utm_source text,
  ADD COLUMN utm_medium text,
  ADD COLUMN utm_campaign text,
  ADD CONSTRAINT chamber_sessions_referral_code_format CHECK (public.is_source_code(referral_code)),
  ADD CONSTRAINT chamber_sessions_utm_source_format CHECK (public.is_source_code(utm_source)),
  ADD CONSTRAINT chamber_sessions_utm_medium_format CHECK (public.is_source_code(utm_medium)),
  ADD CONSTRAINT chamber_sessions_utm_campaign_format CHECK (public.is_source_code(utm_campaign));

COMMENT ON COLUMN public.chamber_sessions.referral_code IS
  'The ?ref= code of the link the intake started from (referral_partners.code when the partner is listed). Set when the intake is created; never changes.';
COMMENT ON COLUMN public.chamber_sessions.utm_source IS 'The utm_source tag of the link the intake started from. Set when the intake is created; never changes.';
COMMENT ON COLUMN public.chamber_sessions.utm_medium IS 'The utm_medium tag of the link the intake started from. Set when the intake is created; never changes.';
COMMENT ON COLUMN public.chamber_sessions.utm_campaign IS 'The utm_campaign tag of the link the intake started from. Set when the intake is created; never changes.';

-- The source is the link the intake started from, so nothing changes it later: not the prospect's browser, not an
-- advisor, not a server function. An update keeps the codes the row had.
CREATE OR REPLACE FUNCTION public.keep_intake_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.referral_code := OLD.referral_code;
  NEW.utm_source := OLD.utm_source;
  NEW.utm_medium := OLD.utm_medium;
  NEW.utm_campaign := OLD.utm_campaign;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_intake_source() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamber_sessions_source_fixed ON public.chamber_sessions;
CREATE TRIGGER chamber_sessions_source_fixed
  BEFORE UPDATE OF referral_code, utm_source, utm_medium, utm_campaign ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.keep_intake_source();

-- ---------- The funnel keeps the source ----------

ALTER TABLE public.intake_milestones
  ADD COLUMN referral_code text,
  ADD COLUMN utm_source text,
  ADD COLUMN utm_medium text,
  ADD COLUMN utm_campaign text;

-- Unchanged from 20261105092000_intake_milestones.sql except that each row copies its intake's source codes.
CREATE OR REPLACE FUNCTION public.note_intake_milestone(p_session_id uuid, p_milestone text, p_at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.intake_milestones (session_id, started_at, milestone, reached_at, referral_code, utm_source, utm_medium, utm_campaign)
  SELECT s.id, s.created_at, p_milestone, GREATEST(COALESCE(p_at, now()), s.created_at),
         s.referral_code, s.utm_source, s.utm_medium, s.utm_campaign
  FROM public.chamber_sessions s
  WHERE s.id = p_session_id
  ON CONFLICT (session_id, milestone) WHERE session_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.note_intake_milestone(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE INDEX intake_milestones_source ON public.intake_milestones (started_at, referral_code, utm_source);

-- ---------- Referral partners ----------

-- The kinds of partner an advisor can choose (src/data/intakeSource.ts labels them).
CREATE OR REPLACE FUNCTION public.is_referral_partner_kind(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT p_kind IN (
    -- sync:begin referral_partner_kinds
    'accounting', 'startup_network', 'law_firm', 'hr_consultant', 'benefits_broker', 'event', 'other'
    -- sync:end referral_partner_kinds
  );
$$;

-- Only the table's check and the functions below use it, all as the table's owner.
REVOKE ALL ON FUNCTION public.is_referral_partner_kind(text) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.referral_partners (
  -- The ?ref= code in the partner's link. Never changes.
  code text PRIMARY KEY CHECK (public.is_source_code(code)),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120 AND name = btrim(name)),
  kind text NOT NULL CHECK (public.is_referral_partner_kind(kind)),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_email text
);

-- Advisors read the list directly; they write it only through the two functions below.
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors can view referral partners"
  ON public.referral_partners FOR SELECT TO authenticated
  USING (public.is_advisor());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.referral_partners FROM anon, authenticated;
REVOKE SELECT ON public.referral_partners FROM anon;

-- The checks both functions make, with messages an advisor can act on.
CREATE OR REPLACE FUNCTION public.referral_partner_input_error(p_name text, p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_name IS NULL OR char_length(btrim(p_name)) = 0 THEN 'Give the partner a name.'
    WHEN char_length(btrim(p_name)) > 120 THEN 'Keep the partner''s name to 120 characters.'
    WHEN NOT COALESCE(public.is_referral_partner_kind(p_kind), false) THEN 'Choose what kind of partner this is.'
  END;
$$;

REVOKE ALL ON FUNCTION public.referral_partner_input_error(text, text) FROM PUBLIC, anon, authenticated;

-- Adds a partner under a new code. A code already taken is refused (23505), so an advisor never renames someone
-- else's partner by reusing their code.
CREATE OR REPLACE FUNCTION public.advisor_add_referral_partner(p_code text, p_name text, p_kind text)
RETURNS public.referral_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_in text := lower(btrim(COALESCE(p_code, '')));
  problem text := public.referral_partner_input_error(p_name, p_kind);
  added public.referral_partners;
BEGIN
  PERFORM public.require_advisor();
  IF NOT COALESCE(public.is_source_code(code_in), false) THEN
    RAISE EXCEPTION 'A referral code is 1 to 64 lowercase letters, digits, dots, hyphens or underscores, starting with a letter or digit.'
      USING ERRCODE = '22023';
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.referral_partners (code, name, kind, created_by_email, updated_by_email)
  VALUES (code_in, btrim(p_name), p_kind, auth.jwt() ->> 'email', auth.jwt() ->> 'email')
  ON CONFLICT (code) DO NOTHING
  RETURNING * INTO added;
  IF added.code IS NULL THEN
    RAISE EXCEPTION 'The code % is already a partner''s. Choose another.', code_in USING ERRCODE = '23505', DETAIL = code_in;
  END IF;
  RETURN added;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_add_referral_partner(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_add_referral_partner(text, text, text) TO authenticated;

-- Renames a partner or changes its kind. The code stays: links carrying it are already out.
CREATE OR REPLACE FUNCTION public.advisor_update_referral_partner(p_code text, p_name text, p_kind text)
RETURNS public.referral_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  problem text := public.referral_partner_input_error(p_name, p_kind);
  changed public.referral_partners;
BEGIN
  PERFORM public.require_advisor();
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  UPDATE public.referral_partners
  SET name = btrim(p_name), kind = p_kind, updated_at = now(), updated_by_email = auth.jwt() ->> 'email'
  WHERE code = lower(btrim(COALESCE(p_code, '')))
  RETURNING * INTO changed;
  IF changed.code IS NULL THEN
    RAISE EXCEPTION 'No partner has that code' USING ERRCODE = 'PT404';
  END IF;
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_update_referral_partner(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_update_referral_partner(text, text, text) TO authenticated;

-- ---------- The funnel by source ----------

-- For intakes started in [p_from, p_to): each source (its referral code, the partner it names if listed, and its
-- campaign tags), with how many of its intakes reached each step. Intakes with no source form one row of nulls. The
-- sources with the most intakes started come first, at most 200 of them. At most a year at once.
CREATE OR REPLACE FUNCTION public.advisor_intake_sources(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  referral_code text,
  partner_name text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  started bigint,
  answered bigint,
  document_uploaded bigint,
  census_provided bigint,
  ready_to_certify bigint,
  email_verified bigint,
  certified bigint,
  manuscript_downloaded bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'The period must start before it ends' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > interval '366 days' THEN
    RAISE EXCEPTION 'The funnel covers at most a year at once' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign,
           count(*) FILTER (WHERE m.milestone = 'started'),
           count(*) FILTER (WHERE m.milestone = 'answered'),
           count(*) FILTER (WHERE m.milestone = 'document_uploaded'),
           count(*) FILTER (WHERE m.milestone = 'census_provided'),
           count(*) FILTER (WHERE m.milestone = 'ready_to_certify'),
           count(*) FILTER (WHERE m.milestone = 'email_verified'),
           count(*) FILTER (WHERE m.milestone = 'certified'),
           count(*) FILTER (WHERE m.milestone = 'manuscript_downloaded')
    FROM public.intake_milestones m
    LEFT JOIN public.referral_partners p ON p.code = m.referral_code
    WHERE m.started_at >= p_from AND m.started_at < p_to
    GROUP BY m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign
    ORDER BY count(*) FILTER (WHERE m.milestone = 'started') DESC,
             m.referral_code NULLS LAST, m.utm_source NULLS LAST, m.utm_medium NULLS LAST, m.utm_campaign NULLS LAST
    LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_intake_sources(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_intake_sources(timestamptz, timestamptz) TO authenticated;

RESET lock_timeout;
