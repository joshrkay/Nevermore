-- Certification is a recorded event, not just a status flag.
--
-- * Submitting requires a complete certification: signer name, role, signing time and the consent
--   wording the signer agreed to. The database refuses anything less.
-- * The certified data must be exactly the data saved on the session, and its SHA-256 is recorded,
--   so a certification can always be matched to the answers it covered.
-- * Each certification is appended to chamber_certifications with a server-side timestamp that
--   the client cannot set.
-- * Changing the answers of a certified session withdraws the certification (status goes back to
--   'in_progress'), so a changed intake has to be certified again before it can be a Manuscript.

CREATE TABLE public.chamber_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chamber_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  signer_name text NOT NULL,
  signer_title text NOT NULL,
  consent_version text NOT NULL,
  consent_text text NOT NULL,
  file_id text,
  signed_at timestamptz NOT NULL,                    -- as captured in the signer's browser
  recorded_at timestamptz NOT NULL DEFAULT now(),    -- when the database recorded it
  data_sha256 text NOT NULL,
  superseded_at timestamptz,
  superseded_reason text
);

CREATE INDEX chamber_certifications_session_idx ON public.chamber_certifications (session_id, recorded_at DESC);

-- Read-only for the owner. Rows are written only by the trigger below (SECURITY DEFINER).
ALTER TABLE public.chamber_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own certifications"
  ON public.chamber_certifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE ALL ON public.chamber_certifications FROM anon, authenticated;
GRANT SELECT ON public.chamber_certifications TO authenticated;

-- Validates a certification, stamps server-side facts onto it, and withdraws a stale one.
-- Named to sort after chamber_sessions_block_guest_submission, so guests are refused first.
CREATE OR REPLACE FUNCTION public.validate_certification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  certifying boolean := false;
  hash text;
BEGIN
  IF NEW.status = 'submitted' THEN
    IF TG_OP = 'INSERT' THEN
      certifying := true;
    ELSIF OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission THEN
      certifying := true;
    END IF;
  END IF;

  IF certifying THEN
    IF NEW.submission IS NULL OR jsonb_typeof(NEW.submission) <> 'object' THEN
      RAISE EXCEPTION 'Certification is required to submit' USING ERRCODE = '23514';
    END IF;
    IF btrim(COALESCE(NEW.submission ->> 'signer_name', '')) = '' THEN
      RAISE EXCEPTION 'Certification requires the signer''s name' USING ERRCODE = '23514';
    END IF;
    IF btrim(COALESCE(NEW.submission ->> 'signer_title', '')) = '' THEN
      RAISE EXCEPTION 'Certification requires the signer''s role' USING ERRCODE = '23514';
    END IF;
    IF btrim(COALESCE(NEW.submission ->> 'consent_text', '')) = '' OR btrim(COALESCE(NEW.submission ->> 'consent_version', '')) = '' THEN
      RAISE EXCEPTION 'Certification requires the consent wording the signer agreed to' USING ERRCODE = '23514';
    END IF;
    BEGIN
      PERFORM (NEW.submission ->> 'signed_at')::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Certification requires a valid signing date and time' USING ERRCODE = '23514';
    END;
    IF (NEW.submission -> 'chamber_data') IS DISTINCT FROM NEW.chamber_data THEN
      RAISE EXCEPTION 'Certified data must match the saved session' USING ERRCODE = '23514';
    END IF;

    hash := encode(sha256(convert_to(NEW.chamber_data::text, 'UTF8')), 'hex');
    -- The client can't set these: they always reflect what the database saw.
    NEW.submission := NEW.submission || jsonb_build_object('certified_at', now(), 'data_sha256', hash);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND NEW.chamber_data IS DISTINCT FROM OLD.chamber_data THEN
    -- Answers changed after certification: the old certification no longer covers them.
    NEW.status := 'in_progress';
  END IF;

  RETURN NEW;
END;
$$;

-- Appends the certification event, and closes out earlier ones that this one replaces.
CREATE OR REPLACE FUNCTION public.record_certification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  certifying boolean := false;
BEGIN
  IF NEW.status = 'submitted' THEN
    IF TG_OP = 'INSERT' THEN
      certifying := true;
    ELSIF OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission THEN
      certifying := true;
    END IF;
  END IF;

  IF certifying THEN
    UPDATE public.chamber_certifications
    SET superseded_at = now(), superseded_reason = 'recertified'
    WHERE session_id = NEW.id AND superseded_at IS NULL;

    INSERT INTO public.chamber_certifications
      (session_id, user_id, signer_name, signer_title, consent_version, consent_text, file_id, signed_at, data_sha256)
    VALUES (
      NEW.id,
      NEW.user_id,
      btrim(NEW.submission ->> 'signer_name'),
      btrim(NEW.submission ->> 'signer_title'),
      NEW.submission ->> 'consent_version',
      NEW.submission ->> 'consent_text',
      NEW.submission ->> 'file_id',
      (NEW.submission ->> 'signed_at')::timestamptz,
      NEW.submission ->> 'data_sha256'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND NEW.status IS DISTINCT FROM 'submitted' THEN
    UPDATE public.chamber_certifications
    SET superseded_at = now(), superseded_reason = 'data_changed'
    WHERE session_id = NEW.id AND superseded_at IS NULL;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_certification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_sessions_certification_validate
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_certification();

CREATE TRIGGER chamber_sessions_certification_record
  AFTER INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.record_certification();
