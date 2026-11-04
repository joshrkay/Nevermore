-- One list of open items (US-2.2a, GLOSSARY.md): the advisor queue counts what Review and The Manuscript list
-- (src/data/openItems.ts), where until now it left out answers the prospect doesn't know yet.
--
-- This replaces the paged, searchable queue of 20261104114000_paged_advisor_queue.sql, changing only one thing:
--
-- * open_fields now counts every reviewable field whose status is conflicting, incomplete, unknown or inferred
--   (the `open_item_statuses` block; src/data/schemaSync.test.ts holds it to OPEN_ITEM_STATUSES), except a
--   required answer still missing, which missing_required already names, so a required answer the prospect
--   doesn't know is one open item, not two. A field an advisor marked verified is still left out: the queue is
--   the advisor's view, and the advisor has settled it. A field marked "Doesn't apply" is closed, so never counted.
-- * missing_required is unchanged: the required items public.intake_required_items reports missing. The
--   recommended census is never listed there; Review and The Manuscript show it as a document needed.
-- * supabase/tests/open_items.sql and src/data/openItems.test.ts read the same intakes from
--   supabase/tests/fixtures/open_items.json and expect the same open items of both.
--
-- It is numbered after the migrations that came before it on main, because it replaces a function they define:
-- run earlier, the later definition would undo it. Deploy order: either way round. The columns and their
-- types are unchanged.

CREATE OR REPLACE FUNCTION public.advisor_list_submissions(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT NULL,
  p_offset integer DEFAULT 0
)
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
  states text[],
  -- How many intakes match the status and search, before paging.
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  terms text[] := ARRAY(
    SELECT lower(t) FROM regexp_split_to_table(btrim(COALESCE(p_search, '')), '\s+') AS t WHERE t <> ''
  );
BEGIN
  PERFORM public.require_advisor();
  IF p_limit IS NOT NULL AND (p_limit < 1 OR p_limit > 500) THEN
    RAISE EXCEPTION 'A page holds 1 to 500 submissions' USING ERRCODE = '22023';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'The page offset can''t be negative' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      s.user_id,
      s.status,
      s.created_at,
      s.updated_at,
      s.submission,
      w.status AS pipeline,
      CASE WHEN s.status = 'submitted' THEN (s.submission ->> 'certified_at')::timestamptz END AS certified_at,
      -- The copy the advisor sees, answers and provenance together: the certified snapshot while
      -- certified, otherwise as it stands. The same test as public.advisor_visible_answers.
      CASE WHEN snap.used THEN s.submission -> 'chamber_data' ELSE s.chamber_data END AS shown,
      CASE WHEN snap.used THEN s.submission -> 'field_provenance' ELSE s.field_provenance END AS prov
    FROM public.chamber_sessions s
    JOIN public.submission_workflow w ON w.session_id = s.id
    CROSS JOIN LATERAL (
      SELECT s.status = 'submitted'
         AND jsonb_typeof(s.submission) = 'object'
         AND btrim(COALESCE(s.submission ->> 'signer_name', '')) <> ''
         AND s.submission ? 'chamber_data' AS used
    ) snap
    WHERE p_status IS NULL OR w.status = p_status
  ),
  shaped AS (
    SELECT
      b.*,
      CASE WHEN jsonb_typeof(b.shown) = 'object' THEN b.shown ELSE '{}'::jsonb END AS d,
      CASE WHEN jsonb_typeof(b.prov) = 'object' THEN b.prov ELSE '{}'::jsonb END AS fp,
      p.company_name AS profile_company,
      p.contact_name AS profile_contact
    FROM base b
    LEFT JOIN public.profiles p ON p.user_id = b.user_id
  ),
  described AS (
    SELECT
      x.*,
      -- The census, or the roster an intake saved before the census contract.
      CASE
        WHEN jsonb_typeof(x.d -> 'census') = 'array' THEN x.d -> 'census'
        WHEN jsonb_typeof(x.d -> 'employees') = 'array' THEN x.d -> 'employees'
        ELSE '[]'::jsonb
      END AS roster,
      COALESCE(NULLIF(btrim(x.d ->> 'company_name'), ''), NULLIF(btrim(x.profile_company), '')) AS company,
      COALESCE(NULLIF(btrim(x.profile_contact), ''), NULLIF(btrim(x.submission ->> 'signer_name'), '')) AS contact,
      NULLIF(btrim(x.submission ->> 'file_id'), '') AS certified_file_id
    FROM shaped x
  ),
  matched AS (
    SELECT r.*
    FROM described r
    -- Every word must appear in the company, the contact or the reference the queue shows (the
    -- certified file id, or the one the app derives for a draft: EAA-<year>-<first 8 hex of the id>).
    WHERE NOT EXISTS (
      SELECT 1 FROM unnest(terms) AS t
      WHERE strpos(
        lower(concat_ws(E'\n', r.company, r.contact, COALESCE(
          r.certified_file_id,
          'EAA-' || extract(year FROM r.created_at AT TIME ZONE 'UTC')::int || '-' || upper(left(replace(r.id::text, '-', ''), 8))
        ))),
        t
      ) = 0
    )
  )
  SELECT
    m.id,
    m.company,
    m.contact,
    CASE WHEN jsonb_typeof(m.d -> 'employee_count') = 'number' THEN (m.d ->> 'employee_count')::numeric::integer END,
    m.pipeline,
    m.status,
    m.submission ->> 'signer_name',
    m.certified_at,
    m.created_at,
    m.updated_at,
    -- The required items still missing, in order (public.intake_required_items, 20261104103000: the
    -- recommended census is never one), less any the advisor supplied through a verified correction with
    -- a value, which the advisor's Manuscript shows. A verification alone supplies nothing.
    ARRAY(
      SELECT ri.item ->> 'label'
      FROM jsonb_array_elements(public.intake_required_items(m.d, m.fp, '{}'::text[])) WITH ORDINALITY AS ri(item, ord)
      WHERE ri.item ->> 'state' = 'missing' AND (ri.item ->> 'required')::boolean
        AND NOT public.advisor_supplied(m.id, ri.item ->> 'field')
      ORDER BY ri.ord
    ),
    -- The other open items, as Review and The Manuscript list them (src/data/openItems.ts): reviewable fields whose
    -- status leaves them open, less a required answer still missing (missing_required names it, so one the prospect
    -- doesn't know is one open item, not two), less the census when none is uploaded (a document, which the queue
    -- never lists), and less any field an advisor verified. A field closed as not applicable is never counted.
    -- The census matches a review under either of its names.
    (SELECT count(*)::integer
       FROM jsonb_each(m.fp) f
      WHERE f.value ->> 'status' IN (
          -- sync:begin open_item_statuses
          'conflicting', 'incomplete', 'unknown', 'inferred'
          -- sync:end open_item_statuses
        )
        AND public.is_reviewable_field(f.key)
        AND NOT (f.key IN ('census', 'employees') AND jsonb_array_length(m.roster) = 0)
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(public.intake_required_items(m.d, m.fp, '{}'::text[])) AS ri(item)
          WHERE ri.item ->> 'state' = 'missing' AND (ri.item ->> 'required')::boolean
            AND ri.item ->> 'field' = f.key
            AND NOT public.advisor_supplied(m.id, ri.item ->> 'field')
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.advisor_field_reviews r
          WHERE r.session_id = m.id AND r.review_state = 'verified'
            AND (r.field = f.key OR (r.field IN ('census', 'employees') AND f.key IN ('census', 'employees')))
        )),
    (SELECT count(*)::integer FROM public.advisor_field_reviews r
      WHERE r.session_id = m.id AND r.review_state IN ('incomplete', 'follow_up')),
    (SELECT count(*)::integer FROM public.advisor_field_reviews r
      WHERE r.session_id = m.id AND r.review_state = 'verified'),
    m.certified_file_id,
    ARRAY(
      SELECT DISTINCT upper(btrim(y.st)) AS abbr
      FROM (
        SELECT st FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(m.d -> 'states') = 'array' THEN m.d -> 'states' ELSE '[]'::jsonb END) AS st
        UNION ALL
        SELECT COALESCE(e ->> 'work_state', e ->> 'state') FROM jsonb_array_elements(m.roster) AS e
      ) y
      WHERE btrim(COALESCE(y.st, '')) <> ''
      ORDER BY abbr
    ),
    count(*) OVER ()
  FROM matched m
  -- Certified is the intake's status; its date only orders the group. Rows submitted before the
  -- server stamped certifications have no certified_at: they stay in the group, after the stamped ones.
  ORDER BY (m.status = 'submitted') DESC, m.certified_at DESC NULLS LAST, m.updated_at DESC, m.id
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_list_submissions(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_list_submissions(text, text, integer, integer) TO authenticated;

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
