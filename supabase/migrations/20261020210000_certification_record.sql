-- Final certification (US-1.6).
--
-- 1. An intake can only become `submitted` with a complete certification: signer name, role,
--    consent wording (and its version) and signing time, over a snapshot that matches the data
--    being submitted. The UI enforces this too; the database refuses it for every caller.
-- 2. Each accepted certification is written to an append-only table and stamped with the server's
--    clock and a hash of the certified data.
-- 3. Changing the data of a submitted intake withdraws the certification (status goes back to
--    `in_progress`), so the prospect has to certify again.

CREATE TABLE public.chamber_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No foreign key on purpose: the record must outlive edits to, or removal of, the session row.
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  signer_name text NOT NULL,
  signer_title text NOT NULL,
  consent_text_version text NOT NULL,
  consent_text jsonb NOT NULL,
  signed_at timestamptz NOT NULL,   -- the signer's browser clock
  certified_at timestamptz NOT NULL DEFAULT now(),   -- the server's clock
  data_hash text NOT NULL           -- sha256 of chamber_data as certified
);

CREATE INDEX chamber_certifications_session_idx ON public.chamber_certifications (session_id, certified_at DESC);

ALTER TABLE public.chamber_certifications ENABLE ROW LEVEL SECURITY;

-- Owners can read their own certifications. There is deliberately no INSERT/UPDATE/DELETE
-- policy: rows are written only by enforce_certification() below.
CREATE POLICY "Users can view their own certifications"
  ON public.chamber_certifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.chamber_certifications_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Certification records cannot be changed or deleted'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER chamber_certifications_append_only
  BEFORE UPDATE OR DELETE ON public.chamber_certifications
  FOR EACH ROW EXECUTE FUNCTION public.chamber_certifications_append_only();

CREATE OR REPLACE FUNCTION public.enforce_certification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub jsonb := NEW.submission;
  data_hash text := encode(sha256(convert_to(NEW.chamber_data::text, 'UTF8')), 'hex');
BEGIN
  -- Data edited after certification: the certification no longer covers it.
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'submitted' AND NEW.status = 'submitted'
     AND NEW.submission IS NOT DISTINCT FROM OLD.submission
     AND NEW.chamber_data IS DISTINCT FROM OLD.chamber_data THEN
    NEW.status := 'in_progress';
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND NEW.submission IS NOT DISTINCT FROM OLD.submission THEN
    RETURN NEW; -- already certified, nothing new being claimed
  END IF;

  -- Putting back the data that was certified (e.g. an edit was undone) revives that certification.
  IF TG_OP = 'UPDATE' AND NEW.submission IS NOT DISTINCT FROM OLD.submission THEN
    IF sub ->> 'data_hash' IS DISTINCT FROM data_hash THEN
      RAISE EXCEPTION 'The information changed after it was certified; certify it again'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- A new certification: it must be complete.
  IF sub IS NULL OR jsonb_typeof(sub) <> 'object'
     OR coalesce(btrim(sub ->> 'signer_name'), '') = ''
     OR coalesce(btrim(sub ->> 'signer_title'), '') = ''
     OR coalesce(btrim(sub ->> 'consent_text_version'), '') = ''
     OR jsonb_typeof(sub -> 'consent_text') IS DISTINCT FROM 'array'
     OR jsonb_array_length(sub -> 'consent_text') = 0
     OR coalesce(sub ->> 'signed_at', '') = '' THEN
    RAISE EXCEPTION 'Certification is incomplete: signer name, role, consent wording and signing time are required'
      USING ERRCODE = '23514';
  END IF;
  IF sub -> 'chamber_data' IS DISTINCT FROM NEW.chamber_data THEN
    RAISE EXCEPTION 'The information changed after it was certified; certify it again'
      USING ERRCODE = '23514';
  END IF;

  -- Keep the server's own record of when, and over what, this was certified.
  NEW.submission := sub || jsonb_build_object('certified_at', now(), 'data_hash', data_hash);

  INSERT INTO public.chamber_certifications
    (session_id, user_id, signer_name, signer_title, consent_text_version, consent_text, signed_at, certified_at, data_hash)
  VALUES
    (NEW.id, NEW.user_id, btrim(sub ->> 'signer_name'), btrim(sub ->> 'signer_title'),
     sub ->> 'consent_text_version', sub -> 'consent_text', (sub ->> 'signed_at')::timestamptz, now(), data_hash);

  RETURN NEW;
END;
$$;

-- Fires after block_guest_submission (triggers run in name order), so guests are refused first.
CREATE TRIGGER chamber_sessions_enforce_certification
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_certification();
