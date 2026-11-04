-- One File ID, one intake (C-3.1, decision D15): every new certification carries its own intake's File ID.
--
-- 20261104120000_submission_records.sql assigns the File ID in the database: the next number in this year's
-- sequence (submission_reference_counters, EAA-YYYY-NNNN) at an intake's first certification, kept on the intake
-- for good, and the unique index chamber_sessions_file_id_key keeps two intakes from sharing one. Each
-- certification row copies it. Until now that copy was only what record_certification() happens to write; this
-- makes it a rule. A certification whose File ID is missing, or isn't its intake's, is refused (23514) whoever
-- inserts it, the service role and migrations included. With the unique index, a File ID on any certification
-- recorded from now on names exactly one intake.
--
-- Rows already recorded are left as they are: some carry File IDs that older browsers made up, which
-- 20261104120000 kept so that no File ID already issued changes.
--
-- Deploy order: either way round. Nothing in the front end depends on it.

CREATE OR REPLACE FUNCTION public.check_certification_file_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  intake_file_id text;
BEGIN
  SELECT s.file_id INTO intake_file_id FROM public.chamber_sessions s WHERE s.id = NEW.session_id;
  IF NULLIF(btrim(NEW.file_id), '') IS NULL OR NEW.file_id IS DISTINCT FROM intake_file_id THEN
    RAISE EXCEPTION 'A certification must carry its intake''s File ID'
      USING ERRCODE = '23514',
            DETAIL = format('intake %s has File ID %s; the certification carries %s',
                            NEW.session_id, COALESCE(intake_file_id, 'none'), COALESCE(NEW.file_id, 'none'));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.check_certification_file_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamber_certifications_file_id ON public.chamber_certifications;
CREATE TRIGGER chamber_certifications_file_id
  BEFORE INSERT ON public.chamber_certifications
  FOR EACH ROW EXECUTE FUNCTION public.check_certification_file_id();
