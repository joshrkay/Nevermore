-- Advisor submission queue (F-2).
--
-- The list function gains what the queue needs to be searched and scanned without opening each
-- intake: the reference (file id) and the state footprint. Still one row per intake with no census,
-- payroll, DOB, EIN or transcript content.
--
-- Order is fixed and explained on the dashboard: certified submissions first, newest certification
-- first (those submitted before certifications were stamped have no date and follow the dated ones);
-- everything not (or no longer) certified after them, most recently touched first; session id breaks
-- any tie, so two loads of the same data always list the same way. (Previously a draft being
-- edited sorted above older submissions, which made the queue jump around.)

DROP FUNCTION IF EXISTS public.advisor_list_submissions(text);

CREATE FUNCTION public.advisor_list_submissions(p_status text DEFAULT NULL)
RETURNS TABLE (
  session_id uuid,
  company_name text,
  contact_name text,
  employee_count integer,
  pipeline_status text,
  intake_status text,
  signer_name text,
  submitted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  missing_required text[],
  open_fields integer,
  flagged_fields integer,
  verified_fields integer,
  -- The certified file id; null until certified (the app derives the same id for drafts).
  file_id text,
  -- Every state named as operating or as a census work state, upper-cased, sorted, distinct.
  states text[]
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      s.user_id,
      s.status,
      s.created_at,
      s.updated_at,
      s.submission,
      s.field_provenance,
      CASE WHEN jsonb_typeof(s.chamber_data) = 'object' THEN s.chamber_data ELSE '{}'::jsonb END AS d,
      w.status AS pipeline,
      CASE WHEN s.status = 'submitted' THEN (s.submission ->> 'certified_at')::timestamptz END AS certified_at
    FROM public.chamber_sessions s
    JOIN public.submission_workflow w ON w.session_id = s.id
    WHERE p_status IS NULL OR w.status = p_status
  )
  SELECT
    b.id,
    COALESCE(NULLIF(btrim(b.d ->> 'company_name'), ''), NULLIF(btrim(p.company_name), '')),
    COALESCE(NULLIF(btrim(p.contact_name), ''), NULLIF(btrim(b.submission ->> 'signer_name'), '')),
    CASE WHEN jsonb_typeof(b.d -> 'employee_count') = 'number' THEN (b.d ->> 'employee_count')::numeric::integer END,
    b.pipeline,
    b.status,
    b.submission ->> 'signer_name',
    b.certified_at,
    b.created_at,
    b.updated_at,
    -- The same required items the Manuscript lists as missing.
    array_remove(ARRAY[
      CASE WHEN COALESCE(btrim(b.d ->> 'company_name'), '') = '' THEN 'Company legal name' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(b.d -> 'states') = 'array' THEN b.d -> 'states' ELSE '[]'::jsonb END) st
        WHERE btrim(st) <> ''
      ) AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(b.d -> 'employees') = 'array' THEN b.d -> 'employees' ELSE '[]'::jsonb END) e
        WHERE COALESCE(btrim(e ->> 'state'), '') <> ''
      ) THEN 'States of operation' END,
      CASE WHEN COALESCE(btrim(b.d ->> 'pay_frequency'), '') = '' THEN 'Pay frequency' END,
      CASE WHEN jsonb_typeof(b.d -> 'employees') IS DISTINCT FROM 'array' OR jsonb_array_length(b.d -> 'employees') = 0
        THEN 'Employee census' END
    ], NULL),
    -- Fields still inferred, incomplete or conflicting that no advisor has verified.
    (SELECT count(*)::integer
       FROM jsonb_each(CASE WHEN jsonb_typeof(b.field_provenance) = 'object' THEN b.field_provenance ELSE '{}'::jsonb END) fp
      WHERE fp.value ->> 'status' IN ('inferred', 'incomplete', 'conflicting')
        AND NOT EXISTS (
          SELECT 1 FROM public.advisor_field_reviews r
          WHERE r.session_id = b.id AND r.field = fp.key AND r.review_state = 'verified'
        )),
    (SELECT count(*)::integer FROM public.advisor_field_reviews r
      WHERE r.session_id = b.id AND r.review_state IN ('incomplete', 'follow_up')),
    (SELECT count(*)::integer FROM public.advisor_field_reviews r
      WHERE r.session_id = b.id AND r.review_state = 'verified'),
    NULLIF(btrim(b.submission ->> 'file_id'), ''),
    ARRAY(
      SELECT DISTINCT upper(btrim(x.st)) AS abbr
      FROM (
        SELECT st FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(b.d -> 'states') = 'array' THEN b.d -> 'states' ELSE '[]'::jsonb END) AS st
        UNION ALL
        SELECT e ->> 'state' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(b.d -> 'employees') = 'array' THEN b.d -> 'employees' ELSE '[]'::jsonb END) AS e
      ) x
      WHERE btrim(COALESCE(x.st, '')) <> ''
      ORDER BY abbr
    )
  FROM base b
  LEFT JOIN public.profiles p ON p.user_id = b.user_id
  -- Certified is the intake's status; its date only orders the group. Rows submitted before the
  -- server stamped certifications have no certified_at: they stay in the group, after the stamped ones.
  ORDER BY (b.status = 'submitted') DESC, b.certified_at DESC NULLS LAST, b.updated_at DESC, b.id;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_list_submissions(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_list_submissions(text) TO authenticated;
