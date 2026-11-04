-- Every certification keeps its own copy of what it covered (C-3.2).
--
-- Until now the signed answers lived only on chamber_sessions.submission, which the next certification
-- overwrites, so certifying again lost the packet signed before it. Each chamber_certifications row now
-- holds the answers and their field status and source exactly as signed, and nothing can change them:
-- the row is written once by record_certification, and only its supersession and outbox bookkeeping may
-- move afterwards. Deleting a row (the deletion process, or the intake's cascade) is unaffected.
--
-- Deploy order: either. An old front end never reads these columns.

ALTER TABLE public.chamber_certifications
  ADD COLUMN chamber_data jsonb,
  ADD COLUMN field_provenance jsonb;

COMMENT ON COLUMN public.chamber_certifications.chamber_data IS
  'The answers exactly as signed (the submission''s snapshot). Null only for certifications recorded before 20261104110000 whose snapshot was already gone.';
COMMENT ON COLUMN public.chamber_certifications.field_provenance IS
  'Field status and source as signed, paired with chamber_data.';

-- The session's submission belongs to its latest certification only, so only that one gets it. Earlier ones
-- lost theirs to the overwrite and stay null, even one that certified the same answers: answers changed and
-- then restored hash the same, but their field status and sources can differ, so they can't be told apart.
UPDATE public.chamber_certifications c
SET chamber_data = s.submission -> 'chamber_data',
    field_provenance = s.submission -> 'field_provenance'
FROM public.chamber_sessions s
WHERE s.id = c.session_id
  AND c.chamber_data IS NULL
  AND s.submission ? 'chamber_data'
  AND c.data_sha256 = s.submission ->> 'data_sha256'
  AND c.signed_at = (s.submission ->> 'signed_at')::timestamptz
  AND c.id = (
    SELECT latest.id FROM public.chamber_certifications latest
    WHERE latest.session_id = s.id
    ORDER BY latest.recorded_at DESC, latest.id DESC
    LIMIT 1
  );

-- As before, plus the snapshot.
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
      (session_id, user_id, signer_name, signer_title, consent_version, consent_text, file_id, signed_at, data_sha256,
       chamber_data, field_provenance)
    VALUES (
      NEW.id,
      NEW.user_id,
      btrim(NEW.submission ->> 'signer_name'),
      btrim(NEW.submission ->> 'signer_title'),
      NEW.submission ->> 'consent_version',
      NEW.submission ->> 'consent_text',
      NEW.submission ->> 'file_id',
      (NEW.submission ->> 'signed_at')::timestamptz,
      NEW.submission ->> 'data_sha256',
      -- validate_certification has already made this equal to the saved answers.
      NEW.submission -> 'chamber_data',
      NEW.submission -> 'field_provenance'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND NEW.status IS DISTINCT FROM 'submitted' THEN
    UPDATE public.chamber_certifications
    SET superseded_at = now(), superseded_reason = 'data_changed'
    WHERE session_id = NEW.id AND superseded_at IS NULL;
  END IF;

  RETURN NULL;
END;
$$;

-- What was certified, by whom and under which wording never changes. Supersession, the outbox's
-- bookkeeping and the recorded time (which tests backdate) are not part of what was signed.
CREATE OR REPLACE FUNCTION public.chamber_certifications_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.signer_name IS DISTINCT FROM OLD.signer_name
     OR NEW.signer_title IS DISTINCT FROM OLD.signer_title
     OR NEW.consent_version IS DISTINCT FROM OLD.consent_version
     OR NEW.consent_text IS DISTINCT FROM OLD.consent_text
     OR NEW.file_id IS DISTINCT FROM OLD.file_id
     OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
     OR NEW.data_sha256 IS DISTINCT FROM OLD.data_sha256
     OR NEW.chamber_data IS DISTINCT FROM OLD.chamber_data
     OR NEW.field_provenance IS DISTINCT FROM OLD.field_provenance THEN
    RAISE EXCEPTION 'A recorded certification can''t be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chamber_certifications_immutable ON public.chamber_certifications;
CREATE TRIGGER chamber_certifications_immutable
  BEFORE UPDATE ON public.chamber_certifications
  FOR EACH ROW EXECUTE FUNCTION public.chamber_certifications_immutable();
REVOKE ALL ON FUNCTION public.chamber_certifications_immutable() FROM PUBLIC, anon, authenticated;
