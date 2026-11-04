-- One list of open items (US-2.2a, GLOSSARY.md): the advisor queue counts what Review and The Manuscript list
-- (src/data/openItems.ts), where until now it left out answers the prospect doesn't know yet.
--
-- * missing_required is unchanged: the required answers with none, and the census when none is uploaded.
-- * open_fields now counts every field whose status is conflicting, incomplete, unknown or inferred (the
--   `open_item_statuses` block; src/data/schemaSync.test.ts holds it to OPEN_ITEM_STATUSES), except a field
--   already counted in missing_required, so a required answer the prospect doesn't know is one open item, not
--   two. A field an advisor marked verified is still left out: the queue is the advisor's view, and the
--   advisor has settled it.
-- * supabase/tests/open_items.sql and src/data/openItems.test.ts read the same intakes from
--   supabase/tests/fixtures/open_items.json and expect the same open items of both.
--
-- Deploy order: either way round. The columns and their types are unchanged.

CREATE OR REPLACE FUNCTION public.advisor_list_submissions(p_status text DEFAULT NULL)
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
    -- The same required items the Manuscript lists as missing, and the census.
    array_remove(ARRAY[
      -- sync:begin queue_missing_labels
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
      -- sync:end queue_missing_labels
    ], NULL),
    -- The other open items: answers of the intake schema whose status leaves them open, less those already in
    -- missing_required and those an advisor verified.
    (SELECT count(*)::integer
       FROM jsonb_each(CASE WHEN jsonb_typeof(b.field_provenance) = 'object' THEN b.field_provenance ELSE '{}'::jsonb END) fp
      WHERE fp.value ->> 'status' IN (
          -- sync:begin open_item_statuses
          'conflicting', 'incomplete', 'unknown', 'inferred'
          -- sync:end open_item_statuses
        )
        AND public.chamber_data_field_kind(fp.key) IS NOT NULL
        AND NOT fp.key = ANY (public.intake_missing_required(b.d))
        AND NOT (fp.key = 'census' AND jsonb_array_length(b.roster) = 0)
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

-- ---------- Workers' comp answers can be reviewed ----------

-- Intake schema v2 (20261103120000) added the workers' comp answers, but not here, so an advisor couldn't mark
-- one verified or needing follow-up. Every top-level answer of the schema, the census's older name included;
-- src/data/schemaSync.test.ts holds the list to the schema.
CREATE OR REPLACE FUNCTION public.is_reviewable_field(f text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  -- The last entry, employees, is the older name of the census: reviews recorded under it stay valid.
  SELECT f = ANY (ARRAY[
    -- sync:begin reviewable_fields
    'company_name', 'industry', 'hq_state', 'states', 'employee_count', 'start_month',
    'multiple_entities', 'fein_count', 'virgin_medical', 'current_carrier', 'renewal_date',
    'rate_history', 'benefits_waiting_period', 'ancillary_benefits', 'has_401k', 'retirement_type',
    'employer_contributes', 'payroll_vendor', 'pay_frequency', 'funding_days', 'has_nonexempt',
    'nonexempt_count', 'exempt_count', 'pto_types', 'accrual_method', 'has_handbook',
    'handbook_last_updated', 'hr_staff_count', 'has_1099', 'ca_contractors', 'uses_physical_clocks',
    'uses_mobile_app', 'uses_computer_timekeeping', 'shift_differentials', 'hris_system',
    'key_challenges', 'business_goals', 'wc_carrier', 'wc_renewal_date', 'wc_experience_mod',
    'wc_annual_premium', 'census', 'employees'
    -- sync:end reviewable_fields
  ])
$$;
