-- The employee census is `chamber_data.census` (see supabase/functions/_shared/census.ts). Intakes
-- saved before it name the roster `employees`, with a `state` per row. The advisor queue and field
-- review read either name, and a census, like the old roster, is reviewed but never corrected here.

-- ---------- Census in advisor review ----------

CREATE OR REPLACE FUNCTION public.is_reviewable_field(f text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT f = ANY (ARRAY[
    'company_name', 'industry', 'hq_state', 'states', 'employee_count', 'start_month',
    'multiple_entities', 'fein_count', 'virgin_medical', 'current_carrier', 'renewal_date',
    'rate_history', 'benefits_waiting_period', 'ancillary_benefits', 'has_401k', 'retirement_type',
    'employer_contributes', 'payroll_vendor', 'pay_frequency', 'funding_days', 'has_nonexempt',
    'nonexempt_count', 'exempt_count', 'pto_types', 'accrual_method', 'has_handbook',
    'handbook_last_updated', 'hr_staff_count', 'has_1099', 'ca_contractors', 'uses_physical_clocks',
    'uses_mobile_app', 'uses_computer_timekeeping', 'shift_differentials', 'hris_system',
    'key_challenges', 'business_goals', 'census',
    -- The census's name before the census contract; reviews recorded under it stay valid.
    'employees'
  ]);
$$;

ALTER TABLE public.advisor_field_reviews
  ADD CONSTRAINT advisor_field_reviews_census_not_corrected CHECK (NOT has_correction OR field <> 'census');

-- Unchanged from 20261022090000_advisor_operations.sql except that the census, under either name,
-- can't be corrected.
CREATE OR REPLACE FUNCTION public.review_submission_field(
  p_session_id uuid,
  p_field text,
  p_review_state text,
  p_correction text DEFAULT 'keep',
  p_value jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS public.advisor_field_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev public.advisor_field_reviews;
  next_row public.advisor_field_reviews;
  clean_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  next_has boolean;
  next_value jsonb;
BEGIN
  PERFORM public.require_advisor();
  IF NOT public.is_reviewable_field(p_field) THEN
    RAISE EXCEPTION 'Unknown field: %', p_field USING ERRCODE = '22023';
  END IF;
  IF p_review_state IS NOT NULL AND p_review_state NOT IN ('verified', 'incomplete', 'follow_up') THEN
    RAISE EXCEPTION 'Unknown review state: %', p_review_state USING ERRCODE = '22023';
  END IF;
  IF p_correction NOT IN ('keep', 'set', 'clear') THEN
    RAISE EXCEPTION 'Unknown correction action: %', p_correction USING ERRCODE = '22023';
  END IF;
  IF p_correction = 'set' AND p_field IN ('census', 'employees') THEN
    RAISE EXCEPTION 'The census is corrected with the prospect, not here' USING ERRCODE = '22023';
  END IF;
  IF p_correction <> 'keep' AND clean_reason IS NULL THEN
    RAISE EXCEPTION 'A correction needs a reason' USING ERRCODE = '22023';
  END IF;
  IF length(clean_reason) > 2000 THEN
    RAISE EXCEPTION 'Reasons are limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chamber_sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO prev FROM public.advisor_field_reviews
  WHERE session_id = p_session_id AND field = p_field FOR UPDATE;

  next_has := CASE p_correction WHEN 'set' THEN true WHEN 'clear' THEN false ELSE COALESCE(prev.has_correction, false) END;
  next_value := CASE p_correction WHEN 'set' THEN p_value WHEN 'clear' THEN NULL ELSE prev.corrected_value END;

  INSERT INTO public.advisor_field_reviews AS r
    (session_id, field, review_state, has_correction, corrected_value, reason, updated_by, updated_by_email, updated_at)
  VALUES
    (p_session_id, p_field, p_review_state, next_has, next_value,
     CASE WHEN p_correction = 'keep' THEN COALESCE(clean_reason, prev.reason) ELSE clean_reason END,
     auth.uid(), auth.jwt() ->> 'email', now())
  ON CONFLICT (session_id, field) DO UPDATE SET
    review_state = EXCLUDED.review_state,
    has_correction = EXCLUDED.has_correction,
    corrected_value = EXCLUDED.corrected_value,
    reason = EXCLUDED.reason,
    updated_by = EXCLUDED.updated_by,
    updated_by_email = EXCLUDED.updated_by_email,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO next_row;

  INSERT INTO public.advisor_review_events
    (session_id, field, from_state, to_state, correction_changed, from_value, to_value,
     had_correction, has_correction, reason, actor_id, actor_email)
  VALUES
    (p_session_id, p_field, prev.review_state, next_row.review_state,
     COALESCE(prev.has_correction, false) IS DISTINCT FROM next_row.has_correction
       OR prev.corrected_value IS DISTINCT FROM next_row.corrected_value,
     prev.corrected_value, next_row.corrected_value,
     COALESCE(prev.has_correction, false), next_row.has_correction,
     clean_reason, auth.uid(), auth.jwt() ->> 'email');

  RETURN next_row;
END;
$$;

REVOKE ALL ON FUNCTION public.review_submission_field(uuid, text, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_submission_field(uuid, text, text, text, jsonb, text) TO authenticated;

-- ---------- Advisor queue ----------

-- Unchanged from 20261024100000_advisor_queue.sql except that the census (or the older roster) is
-- read once per intake as `roster`, and a row's work state is `work_state` (or the older `state`).
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
      CASE WHEN s.status = 'submitted' THEN (s.submission ->> 'certified_at')::timestamptz END AS certified_at,
      -- The census, or the roster an intake saved before the census contract.
      CASE
        WHEN jsonb_typeof(s.chamber_data -> 'census') = 'array' THEN s.chamber_data -> 'census'
        WHEN jsonb_typeof(s.chamber_data -> 'employees') = 'array' THEN s.chamber_data -> 'employees'
        ELSE '[]'::jsonb
      END AS roster
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
        SELECT 1 FROM jsonb_array_elements(b.roster) e
        WHERE COALESCE(btrim(COALESCE(e ->> 'work_state', e ->> 'state')), '') <> ''
      ) THEN 'States of operation' END,
      CASE WHEN COALESCE(btrim(b.d ->> 'pay_frequency'), '') = '' THEN 'Pay frequency' END,
      CASE WHEN jsonb_array_length(b.roster) = 0 THEN 'Employee census' END
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
        SELECT COALESCE(e ->> 'work_state', e ->> 'state') FROM jsonb_array_elements(b.roster) AS e
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
