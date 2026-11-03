-- Intake consent (US-6.2, plan H-2.2): before a prospect gives the Chamber anything about their company or
-- their employees, they read how Edgar Allan Advisory uses it and agree. Until now the only consent was the
-- certification at the very end, after the census, payroll and workers' comp data had already been sent.
--
-- * public.intake_consent_version() is the wording in force. The browser holds the same wording and version
--   (src/data/intakeConsent.ts); src/data/schemaSync.test.ts keeps the two versions equal. Bump both, in
--   the same change, whenever the wording changes: everyone is asked again.
-- * intake_consents keeps one row per account and version: the exact wording shown, and when the server
--   received the agreement (never a time the browser sends). The first agreement to a version stands.
--   Owners read their own; advisors read all, so a submission's consent can be shown in a dispute.
--   Nobody writes the table directly: public.record_intake_consent() is the only way in.
-- * A new intake, and a new document, from the browser is refused (EA004, DETAIL the version needed) unless
--   its owner agreed to the version in force. The new intake records which agreement it was made under
--   (chamber_sessions.intake_consent_id); the browser can't set or change that.
-- * Saves to an intake that already exists are NOT refused: tabs opened before this deploys keep saving,
--   and the Chamber asks for consent before it opens any intake. An intake started before this change has
--   no intake_consent_id until its owner agrees; their next save records it.
--
-- Deploy order: this migration, then the front end, close together. In between, the old front end can't
-- start a new intake or add a document (it never asks for consent); saving existing intakes keeps working.

-- ---------- The wording in force ----------

CREATE OR REPLACE FUNCTION public.intake_consent_version()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- sync:begin intake_consent_version
    '2026-11-draft-1'::text
    -- sync:end intake_consent_version
$$;

REVOKE ALL ON FUNCTION public.intake_consent_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intake_consent_version() TO anon, authenticated, service_role;

-- ---------- Agreements ----------

CREATE TABLE IF NOT EXISTS public.intake_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Deleting the account deletes its agreements: with no account there is nothing left to process.
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version text NOT NULL CHECK (length(consent_version) BETWEEN 1 AND 40),
  consent_text text NOT NULL CHECK (length(consent_text) BETWEEN 1 AND 20000),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intake_consents_user_version_key UNIQUE (user_id, consent_version)
);

ALTER TABLE public.intake_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own intake consents" ON public.intake_consents;
CREATE POLICY "Users can view their own intake consents"
  ON public.intake_consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Advisors can view intake consents" ON public.intake_consents;
CREATE POLICY "Advisors can view intake consents"
  ON public.intake_consents FOR SELECT TO authenticated
  USING (public.is_advisor());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.intake_consents FROM anon, authenticated;

-- Records the signed-in caller's agreement to the wording in force and returns when it was received.
-- Agreeing again returns the first time. EA005 (DETAIL the version in force) when the page showed an older
-- wording: the browser reloads it rather than recording agreement to text that is no longer shown.
CREATE OR REPLACE FUNCTION public.record_intake_consent(p_version text, p_text text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid constant uuid := auth.uid();
  clean_text constant text := btrim(COALESCE(p_text, ''));
  received timestamptz;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to start an intake' USING ERRCODE = '42501';
  END IF;
  IF p_version IS DISTINCT FROM public.intake_consent_version() THEN
    RAISE EXCEPTION 'This wording is out of date. Reload the page to read the current version.'
      USING ERRCODE = 'EA005', DETAIL = public.intake_consent_version();
  END IF;
  IF clean_text = '' OR length(clean_text) > 20000 THEN
    RAISE EXCEPTION 'The consent wording shown is required (1 to 20000 characters)' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.intake_consents (user_id, consent_version, consent_text)
  VALUES (uid, p_version, clean_text)
  ON CONFLICT ON CONSTRAINT intake_consents_user_version_key DO NOTHING;

  SELECT c.accepted_at INTO received
  FROM public.intake_consents c
  WHERE c.user_id = uid AND c.consent_version = p_version;
  RETURN received;
END;
$$;

REVOKE ALL ON FUNCTION public.record_intake_consent(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_intake_consent(text, text) TO authenticated;

-- ---------- Which agreement an intake was started under ----------

ALTER TABLE public.chamber_sessions
  ADD COLUMN IF NOT EXISTS intake_consent_id uuid REFERENCES public.intake_consents(id) ON DELETE SET NULL;

-- The owner's agreement to the version in force, or null. Runs as the caller, so row security limits it to
-- the caller's own agreements, which are the only ones a browser write may use.
CREATE OR REPLACE FUNCTION public.current_intake_consent_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id FROM public.intake_consents c
  WHERE c.user_id = p_user_id AND c.consent_version = public.intake_consent_version();
$$;

REVOKE ALL ON FUNCTION public.current_intake_consent_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_intake_consent_id(uuid) TO authenticated, service_role;

-- A browser write (current_user anon or authenticated) can't start an intake without an agreement, and never
-- chooses the agreement itself. Privileged writers (jobs, migrations, the service role, SECURITY DEFINER
-- functions) are left alone.
CREATE OR REPLACE FUNCTION public.stamp_intake_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  agreed uuid;
BEGIN
  -- Someone else's row is row security's to refuse (42501), with nothing said about their agreements.
  IF current_user NOT IN ('anon', 'authenticated') OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    agreed := public.current_intake_consent_id(NEW.user_id);
    IF agreed IS NULL THEN
      RAISE EXCEPTION 'Read and agree to how your information is used before you start an intake'
        USING ERRCODE = 'EA004', DETAIL = public.intake_consent_version();
    END IF;
    NEW.intake_consent_id := agreed;
  ELSE
    -- An intake keeps the agreement it was started under. One started before consent existed takes its
    -- owner's agreement on the first save after they give it.
    NEW.intake_consent_id := COALESCE(OLD.intake_consent_id, public.current_intake_consent_id(OLD.user_id));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_intake_consent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamber_sessions_intake_consent ON public.chamber_sessions;
CREATE TRIGGER chamber_sessions_intake_consent
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_intake_consent();

-- Documents are the most sensitive thing a prospect sends (census files, payroll reports, loss runs), so a
-- browser upload needs its owner's agreement too, including into an intake started before consent existed.
CREATE OR REPLACE FUNCTION public.documents_require_intake_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND NEW.user_id IS NOT DISTINCT FROM auth.uid()
     AND public.current_intake_consent_id(NEW.user_id) IS NULL THEN
    RAISE EXCEPTION 'Read and agree to how your information is used before you upload documents'
      USING ERRCODE = 'EA004', DETAIL = public.intake_consent_version();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.documents_require_intake_consent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS documents_require_intake_consent ON public.documents;
CREATE TRIGGER documents_require_intake_consent
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_require_intake_consent();
