-- The advisor sees these refusals as they are (a toast when generating a version), so they now say "packet", the
-- name the product uses since the Nevermore rebrand. Only the four messages change: the function is otherwise the
-- one in 20261104113000_share_reviewed_manuscript.sql, the SQLSTATEs are the same, and the browser tells the refusals
-- apart by code (PT409, isStaleRefusal in src/data/advisor.ts), never by their words. The table and function keep
-- their manuscript names.

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
    RAISE EXCEPTION 'Only a certified intake can become a packet' USING ERRCODE = '23514';
  END IF;
  IF p_certified_data_hash IS DISTINCT FROM (s.submission ->> 'data_sha256')
     OR p_certified_at IS DISTINCT FROM (s.submission ->> 'certified_at')::timestamptz THEN
    RAISE EXCEPTION 'The prospect certified their intake again while this packet was being generated; generate it again'
      USING ERRCODE = 'PT409';
  END IF;
  IF p_storage_path IS NULL OR p_storage_path NOT LIKE p_session_id::text || '/%' THEN
    RAISE EXCEPTION 'The file must be stored under its submission' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'manuscripts' AND name = p_storage_path) THEN
    RAISE EXCEPTION 'The packet file was not uploaded' USING ERRCODE = '22023';
  END IF;

  -- One version number at a time per submission.
  PERFORM pg_advisory_xact_lock(hashtext('manuscript_versions:' || p_session_id::text));

  SELECT COALESCE(max(id), 0) INTO latest_event FROM public.advisor_review_events WHERE session_id = p_session_id;
  IF p_review_event_id IS DISTINCT FROM latest_event THEN
    RAISE EXCEPTION 'The review changed while this packet was being generated; generate it again'
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
