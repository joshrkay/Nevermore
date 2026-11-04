-- The advisor-reviewed Manuscript is the final packet, and the prospect can download it.
--
-- The prospect sends the packet to the PEO themselves, but the only packet they could get was the one
-- their browser builds from what they certified, which never includes an advisor's corrections. Now:
--   * A Manuscript version records the certification it was built from by its certification time too
--     (certified_at): with the data hash and signing time it already kept, "built from the current
--     certification" is exact.
--   * prospect_final_manuscript(session) gives the prospect the latest version of their own certified
--     intake, when it was built from their current certification; nothing otherwise (an older version
--     shows answers they have since changed). Only what they need to fetch it is returned.
--   * The prospect may read that one stored file; every other stored Manuscript stays advisor-only.

ALTER TABLE public.manuscript_versions ADD COLUMN certified_at timestamptz;

-- Unchanged from 20261104100000_pin_reviews_and_manuscripts_to_answers.sql except that the version
-- records certified_at.
CREATE OR REPLACE FUNCTION public.record_manuscript_version(
  p_session_id uuid,
  p_version integer,
  p_storage_path text,
  p_pdf_sha256 text,
  p_review_event_id bigint,
  p_corrections_applied integer,
  p_sensitive_revealed boolean,
  p_certified_data_hash text,
  p_certified_at timestamptz
)
RETURNS public.manuscript_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.chamber_sessions;
  latest_event bigint;
  next_version integer;
  result public.manuscript_versions;
BEGIN
  PERFORM public.require_advisor();

  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF s.status IS DISTINCT FROM 'submitted' OR s.submission IS NULL THEN
    RAISE EXCEPTION 'Only a certified intake can become a Manuscript' USING ERRCODE = '23514';
  END IF;
  IF p_certified_data_hash IS DISTINCT FROM (s.submission ->> 'data_sha256')
     OR p_certified_at IS DISTINCT FROM (s.submission ->> 'certified_at')::timestamptz THEN
    RAISE EXCEPTION 'The prospect certified their intake again while this Manuscript was being generated; generate it again'
      USING ERRCODE = 'PT409';
  END IF;
  IF p_storage_path IS NULL OR p_storage_path NOT LIKE p_session_id::text || '/%' THEN
    RAISE EXCEPTION 'The file must be stored under its submission' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = p_storage_path) THEN
    RAISE EXCEPTION 'The Manuscript file was not uploaded' USING ERRCODE = '22023';
  END IF;

  -- One version number at a time per submission.
  PERFORM pg_advisory_xact_lock(hashtext('manuscript_versions:' || p_session_id::text));

  SELECT COALESCE(max(id), 0) INTO latest_event FROM public.advisor_review_events WHERE session_id = p_session_id;
  IF p_review_event_id IS DISTINCT FROM latest_event THEN
    RAISE EXCEPTION 'The review changed while this Manuscript was being generated; generate it again'
      USING ERRCODE = 'PT409';
  END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO next_version FROM public.manuscript_versions WHERE session_id = p_session_id;
  IF p_version IS DISTINCT FROM next_version THEN
    RAISE EXCEPTION 'Another version was generated meanwhile; generate it again' USING ERRCODE = 'PT409';
  END IF;

  INSERT INTO public.manuscript_versions
    (session_id, version, file_id, storage_path, pdf_sha256, certified_data_hash, certified_signed_at, certified_at,
     review_event_id, corrections_applied, sensitive_revealed, generated_by, generated_by_email)
  VALUES
    (p_session_id, next_version,
     COALESCE(NULLIF(s.submission ->> 'file_id', ''), 'EAA-' || upper(left(replace(p_session_id::text, '-', ''), 8))),
     p_storage_path, lower(p_pdf_sha256),
     COALESCE(s.submission ->> 'data_sha256', encode(sha256(convert_to(s.chamber_data::text, 'UTF8')), 'hex')),
     (s.submission ->> 'signed_at')::timestamptz,
     (s.submission ->> 'certified_at')::timestamptz,
     latest_event, GREATEST(COALESCE(p_corrections_applied, 0), 0), COALESCE(p_sensitive_revealed, false),
     auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_manuscript_version(uuid, integer, text, text, bigint, integer, boolean, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manuscript_version(uuid, integer, text, text, bigint, integer, boolean, text, timestamptz) TO authenticated;

-- The final Manuscript of the caller's own intake: its latest version, if the intake is certified and
-- that version was built from the current certification. No row for anyone else's intake, an
-- uncertified one, or a version that predates the prospect's latest certification.
CREATE OR REPLACE FUNCTION public.prospect_final_manuscript(p_session_id uuid)
RETURNS TABLE (version integer, storage_path text, generated_at timestamptz, corrections_applied integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.version, v.storage_path, v.generated_at, v.corrections_applied
  FROM public.manuscript_versions v
  JOIN public.chamber_sessions s ON s.id = v.session_id
  WHERE v.session_id = p_session_id
    AND s.user_id = auth.uid()
    AND s.status = 'submitted'
    AND v.version = (SELECT max(m.version) FROM public.manuscript_versions m WHERE m.session_id = p_session_id)
    AND v.certified_at IS NOT DISTINCT FROM (s.submission ->> 'certified_at')::timestamptz
    AND v.certified_signed_at IS NOT DISTINCT FROM (s.submission ->> 'signed_at')::timestamptz
    AND v.certified_data_hash IS NOT DISTINCT FROM (s.submission ->> 'data_sha256');
$$;

REVOKE ALL ON FUNCTION public.prospect_final_manuscript(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospect_final_manuscript(uuid) TO authenticated;

-- True when `p_name` is the stored file of the caller's final Manuscript. For the storage policy below.
CREATE OR REPLACE FUNCTION public.is_own_final_manuscript(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.manuscript_versions v
    CROSS JOIN LATERAL public.prospect_final_manuscript(v.session_id) f
    WHERE v.storage_path = p_name AND f.storage_path = p_name
  );
$$;

REVOKE ALL ON FUNCTION public.is_own_final_manuscript(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_own_final_manuscript(text) TO authenticated;

CREATE POLICY "Prospects can read their final Manuscript"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'manuscripts' AND public.is_own_final_manuscript(name));
