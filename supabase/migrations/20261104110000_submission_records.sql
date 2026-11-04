-- Submission records (C-2.1, C-3.1, C-3.2, D-2.1; decision D15): a certification is a numbered, immutable
-- submission with a server-assigned reference and its own copy of the answers it covered.
--
-- * The reference (the File ID) is assigned by the database the first time an intake is certified:
--   EAA-<year certified, UTC>-<NNNN> from a per-year sequence (submission_reference_counters), zero-padded
--   to four digits and unique across intakes. It is stored on the intake (chamber_sessions.file_id), on every
--   certification row, and stamped into submission.file_id, which the queue, the emails and the Manuscript
--   already read. An intake keeps one File ID for good: certifying again, after changed answers or a new
--   PEO, reuses it. One the browser sends is ignored, and nothing the browser sends can change the column.
--   Intakes certified before this carry the File ID their certification recorded, whatever rule made it.
-- * Every certification row now holds the submission as certified: version (1, 2, ... per intake),
--   data_version (the intake version the certification landed at), schema_version, chamber_data,
--   field_provenance, chosen_peo, and the uploaded documents as they stood (id, name, category, status).
--   The same facts are stamped into submission (version, data_version, schema_version, documents) beside
--   certified_at and data_sha256, so the row and the record always agree. Later edits withdraw the
--   certification and never touch the row, so every submitted version stays recoverable.
-- * A repeat of the certification on record (the same signer, signing time, PEO and answers: a second
--   click, or a retry after a lost response) records nothing new: the saved submission is kept as it is,
--   no certification row is added and no notification is queued.
-- * chamber_certifications is append-only: a row can be superseded (superseded_at, superseded_reason, once)
--   and its outbox marker columns can change; nothing else can, and no row can be deleted, by any role,
--   except by complete_intake_deletion() deleting the whole intake (20261104092000). The foreign key to
--   chamber_sessions is dropped, as the other audit tables have none: the record outlives the intake row
--   until the intake is deleted on purpose.
--
-- Deploy this migration before the front end that reads file_id back from a certification and opens the
-- Manuscript by reference. The older front end keeps working: it sends a file_id the database replaces
-- (its confirmation shows the one it made up until the next load), and reads submission.file_id as before.

-- ---------- The reference sequence ----------

CREATE TABLE IF NOT EXISTS public.submission_reference_counters (
  year integer PRIMARY KEY,
  last integer NOT NULL DEFAULT 0 CHECK (last >= 0)
);
-- Nobody reads or writes it through the API; row security (with no policy) backs the revoked grants up. The
-- service role keeps its default access, as on every table (the jobs never touch it).
ALTER TABLE public.submission_reference_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.submission_reference_counters FROM PUBLIC, anon, authenticated;

-- The next reference for a year. Only the certification trigger calls it; the row lock on the counter
-- makes two certifications in the same instant take different numbers.
CREATE OR REPLACE FUNCTION public.next_submission_reference(p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.submission_reference_counters AS c (year, last) VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last = c.last + 1
  RETURNING c.last INTO n;
  -- sync:begin reference_format
  RETURN format('EAA-%s-%s', p_year, lpad(n::text, 4, '0'));
  -- sync:end reference_format
END;
$$;
REVOKE ALL ON FUNCTION public.next_submission_reference(integer) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- The intake's reference ----------

ALTER TABLE public.chamber_sessions ADD COLUMN IF NOT EXISTS file_id text;
COMMENT ON COLUMN public.chamber_sessions.file_id IS
  'The File ID (reference) assigned by the database at the first certification, kept for good. Null until then; nothing the browser sends sets or changes it.';

-- Intakes already certified keep the File ID their certification recorded (the latest one, withdrawn or
-- not), or the one on their submission if they predate chamber_certifications. Should two intakes somehow
-- carry the same id, the older intake keeps it and the other is assigned a new one when next certified.
-- The backfill is not a save: no new version, no new updated_at, nothing re-validated.
ALTER TABLE public.chamber_sessions DISABLE TRIGGER USER;
WITH candidates AS (
  SELECT s.id, s.created_at, COALESCE(
    (SELECT NULLIF(btrim(c.file_id), '') FROM public.chamber_certifications c
      WHERE c.session_id = s.id AND NULLIF(btrim(c.file_id), '') IS NOT NULL
      ORDER BY c.recorded_at DESC, c.id DESC LIMIT 1),
    NULLIF(btrim(s.submission ->> 'file_id'), '')
  ) AS file_id
  FROM public.chamber_sessions s
  WHERE s.file_id IS NULL
), chosen AS (
  SELECT DISTINCT ON (file_id) id, file_id FROM candidates WHERE file_id IS NOT NULL ORDER BY file_id, created_at, id
)
UPDATE public.chamber_sessions s SET file_id = chosen.file_id FROM chosen WHERE s.id = chosen.id;
ALTER TABLE public.chamber_sessions ENABLE TRIGGER USER;

CREATE UNIQUE INDEX IF NOT EXISTS chamber_sessions_file_id_key ON public.chamber_sessions (file_id) WHERE file_id IS NOT NULL;

-- ---------- The submission on each certification ----------

ALTER TABLE public.chamber_certifications
  ADD COLUMN IF NOT EXISTS version integer CHECK (version > 0),
  ADD COLUMN IF NOT EXISTS data_version integer,
  ADD COLUMN IF NOT EXISTS schema_version smallint,
  ADD COLUMN IF NOT EXISTS chamber_data jsonb,
  ADD COLUMN IF NOT EXISTS field_provenance jsonb,
  ADD COLUMN IF NOT EXISTS chosen_peo text,
  ADD COLUMN IF NOT EXISTS documents jsonb;

COMMENT ON COLUMN public.chamber_certifications.version IS 'Which certification of its intake this is: 1 for the first, then 2, 3, ... The File ID stays the same.';
COMMENT ON COLUMN public.chamber_certifications.data_version IS 'The intake''s data_version once this certification was saved.';
COMMENT ON COLUMN public.chamber_certifications.chamber_data IS 'The answers exactly as certified. Null on a certification recorded before this column existed and since withdrawn.';
COMMENT ON COLUMN public.chamber_certifications.documents IS 'The uploaded documents as they stood at certification: id, file_name, category, status, uploaded_at.';

-- Existing rows: numbered in the order they were recorded. The one still in force gets the answers from
-- its intake's saved submission when that is the copy it hashed; withdrawn ones have no copy to recover.
UPDATE public.chamber_certifications c
SET version = numbered.version
FROM (
  SELECT id, row_number() OVER (PARTITION BY session_id ORDER BY recorded_at, id) AS version
  FROM public.chamber_certifications
) numbered
WHERE c.id = numbered.id AND c.version IS NULL;

UPDATE public.chamber_certifications c
SET chamber_data = s.submission -> 'chamber_data',
    field_provenance = s.submission -> 'field_provenance',
    chosen_peo = NULLIF(btrim(s.submission ->> 'peo'), ''),
    data_version = COALESCE(c.data_version, s.data_version),
    schema_version = COALESCE(c.schema_version, s.schema_version)
FROM public.chamber_sessions s
WHERE s.id = c.session_id
  AND c.superseded_at IS NULL
  AND c.chamber_data IS NULL
  AND jsonb_typeof(s.submission -> 'chamber_data') = 'object'
  AND s.submission ->> 'data_sha256' = c.data_sha256;

ALTER TABLE public.chamber_certifications DROP CONSTRAINT IF EXISTS chamber_certifications_session_version_key;
ALTER TABLE public.chamber_certifications ADD CONSTRAINT chamber_certifications_session_version_key UNIQUE (session_id, version);

-- The record outlives the intake row, as the other audit records do. (The index on session_id stays.)
ALTER TABLE public.chamber_certifications DROP CONSTRAINT IF EXISTS chamber_certifications_session_id_fkey;

-- ---------- Append-only ----------

-- What may change on a certification after it is recorded: superseding it (once), and the outbox's
-- marker columns (20261026090000_outbox_reliability.sql). Everything else, and the row itself, is fixed.
CREATE OR REPLACE FUNCTION public.guard_chamber_certification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  mutable constant text[] := ARRAY['superseded_at', 'superseded_reason', 'outbox_queued_at', 'outbox_failures', 'outbox_last_failed_at', 'outbox_last_sqlstate'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Only the deletion of the one intake complete_intake_deletion() is deleting, inside that function
    -- (20261104092000_data_retention_and_deletion.sql: the same rule as public.reject_audit_change).
    IF current_user NOT IN ('anon', 'authenticated', 'service_role')
       AND NULLIF(current_setting('eaa.deleting_intake', true), '') = OLD.session_id::text THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'chamber_certifications records cannot be deleted' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
    RAISE EXCEPTION 'chamber_certifications records cannot be changed, only superseded' USING ERRCODE = '42501';
  END IF;
  IF OLD.superseded_at IS NOT NULL
     AND (NEW.superseded_at IS DISTINCT FROM OLD.superseded_at OR NEW.superseded_reason IS DISTINCT FROM OLD.superseded_reason) THEN
    RAISE EXCEPTION 'A superseded certification stays superseded' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_chamber_certification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamber_certifications_guard ON public.chamber_certifications;
CREATE TRIGGER chamber_certifications_guard
  BEFORE UPDATE OR DELETE ON public.chamber_certifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_chamber_certification();

-- ---------- Certifying ----------

-- Validates a certification, stamps the server's facts onto it (the File ID, the version numbers, the
-- hash, the time, the documents), withdraws a stale one, and keeps a repeat from recording twice.
-- SECURITY DEFINER so it can take the next reference and read the intake's documents; it changes nothing
-- but the row being written.
CREATE OR REPLACE FUNCTION public.validate_certification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  certifying boolean := false;
  hash text;
  reference text;
  cert_version integer;
  certified_data_version integer;
  docs jsonb;
BEGIN
  -- The File ID is the database's: the browser can neither set nor change it.
  IF TG_OP = 'UPDATE' THEN
    NEW.file_id := OLD.file_id;
  ELSE
    NEW.file_id := NULL;
  END IF;

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

    -- The certification on record sent again (the same signer, signing time, PEO and answers): a second
    -- click, or a retry after a lost response. Nothing new was certified, so the record stands as it is.
    IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND jsonb_typeof(OLD.submission) = 'object'
       AND NEW.chamber_data IS NOT DISTINCT FROM OLD.chamber_data
       AND btrim(NEW.submission ->> 'signer_name') = btrim(COALESCE(OLD.submission ->> 'signer_name', ''))
       AND btrim(NEW.submission ->> 'signer_title') = btrim(COALESCE(OLD.submission ->> 'signer_title', ''))
       AND (NEW.submission ->> 'signed_at')::timestamptz = (OLD.submission ->> 'signed_at')::timestamptz
       AND NEW.submission ->> 'consent_version' = OLD.submission ->> 'consent_version'
       AND (NEW.submission -> 'peo') IS NOT DISTINCT FROM (OLD.submission -> 'peo') THEN
      NEW.submission := OLD.submission;
      RETURN NEW;
    END IF;

    hash := encode(sha256(convert_to(NEW.chamber_data::text, 'UTF8')), 'hex');
    -- The intake's own File ID, or the one any earlier certification of it recorded (withdrawn or not),
    -- or the next one in this year's sequence.
    reference := COALESCE(
      NULLIF(btrim(NEW.file_id), ''),
      (SELECT NULLIF(btrim(c.file_id), '') FROM public.chamber_certifications c
        WHERE c.session_id = NEW.id AND NULLIF(btrim(c.file_id), '') IS NOT NULL
        ORDER BY c.recorded_at DESC, c.id DESC LIMIT 1),
      public.next_submission_reference(EXTRACT(YEAR FROM (now() AT TIME ZONE 'UTC'))::integer)
    );
    NEW.file_id := reference;
    cert_version := (SELECT count(*) FROM public.chamber_certifications c WHERE c.session_id = NEW.id) + 1;
    -- What chamber_sessions_data_version (which runs after this trigger) will set.
    certified_data_version := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE OLD.data_version + 1 END;
    docs := (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', d.id, 'file_name', d.file_name, 'category', d.category, 'status', d.status, 'uploaded_at', d.created_at
      ) ORDER BY d.created_at, d.id), '[]'::jsonb)
      FROM public.documents d WHERE d.session_id = NEW.id
    );
    -- The client can't set these: they always reflect what the database saw.
    NEW.submission := NEW.submission || jsonb_build_object(
      'certified_at', now(),
      'data_sha256', hash,
      'file_id', reference,
      'version', cert_version,
      'data_version', certified_data_version,
      'schema_version', NEW.schema_version,
      'documents', docs
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND NEW.chamber_data IS DISTINCT FROM OLD.chamber_data THEN
    -- Answers changed after certification: the old certification no longer covers them.
    NEW.status := 'in_progress';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_certification() FROM PUBLIC, anon, authenticated, service_role;

-- Appends the certification as a submission record, and closes out earlier ones that this one replaces.
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
    IF (NEW.submission ->> 'data_version')::integer IS DISTINCT FROM NEW.data_version THEN
      RAISE EXCEPTION 'Certification stamped data_version % but the intake was saved as version %',
        NEW.submission ->> 'data_version', NEW.data_version USING ERRCODE = 'XX000';
    END IF;

    UPDATE public.chamber_certifications
    SET superseded_at = now(), superseded_reason = 'recertified'
    WHERE session_id = NEW.id AND superseded_at IS NULL;

    INSERT INTO public.chamber_certifications
      (session_id, user_id, signer_name, signer_title, consent_version, consent_text, file_id, signed_at, data_sha256,
       version, data_version, schema_version, chamber_data, field_provenance, chosen_peo, documents)
    VALUES (
      NEW.id,
      NEW.user_id,
      btrim(NEW.submission ->> 'signer_name'),
      btrim(NEW.submission ->> 'signer_title'),
      NEW.submission ->> 'consent_version',
      NEW.submission ->> 'consent_text',
      NEW.file_id,
      (NEW.submission ->> 'signed_at')::timestamptz,
      NEW.submission ->> 'data_sha256',
      (NEW.submission ->> 'version')::integer,
      NEW.data_version,
      NEW.schema_version,
      NEW.chamber_data,
      NEW.field_provenance,
      NEW.chosen_peo,
      COALESCE(NEW.submission -> 'documents', '[]'::jsonb)
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
