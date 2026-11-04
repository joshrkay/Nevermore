-- Needs advisor action: a submission-level marker an advisor raises when someone on the team has to act on a
-- submission, and clears once they have (F-4.3, GLOSSARY.md). Field-level advisor follow-ups stay as they are;
-- this one belongs to the whole submission.
--
-- * submission_workflow carries it: whether it is raised, an optional note (500 characters at most), and who
--   last raised or cleared it and when. Advisors read it as they read the pipeline; nobody writes it directly.
-- * set_submission_needs_action raises or clears it, and appends the change to submission_status_history at the
--   current stage (from and to the same), so the status history shows who raised it, why, and who cleared it.
--   The prospect never sees it: prospect_submission_status reads stages only, and the stage is unchanged.
-- * advisor_list_submissions returns it with each row and takes p_needs_action: true lists only the
--   submissions that need advisor action, NULL (the default) lists every submission. Adding the parameter changes
--   the function's signature, so the old one is dropped first. Everything else is as in
--   20261104118000_open_items.sql.
--
-- Numbered after 20261104131000_certification_file_id_check.sql, the latest migration on main when it was written.

ALTER TABLE public.submission_workflow
  ADD COLUMN needs_action boolean NOT NULL DEFAULT false,
  ADD COLUMN needs_action_note text,
  ADD COLUMN needs_action_at timestamptz,
  ADD COLUMN needs_action_by uuid,
  ADD COLUMN needs_action_by_email text,
  -- The note is set only while it is raised; src/data/advisor.ts (NEEDS_ACTION_NOTE_MAX) holds the same cap.
  ADD CONSTRAINT submission_workflow_needs_action_note_check CHECK (
    needs_action_note IS NULL OR (
      needs_action
      -- sync:begin needs_action_note_length
      AND char_length(needs_action_note) BETWEEN 1 AND 500
      -- sync:end needs_action_note_length
    )
  );

CREATE INDEX submission_workflow_needs_action_idx ON public.submission_workflow (session_id) WHERE needs_action;

-- ---------- Raising and clearing it ----------

CREATE OR REPLACE FUNCTION public.set_submission_needs_action(p_session_id uuid, p_needs_action boolean, p_note text DEFAULT NULL)
RETURNS public.submission_workflow
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.submission_workflow;
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM public.require_advisor();
  IF p_needs_action IS NULL THEN
    RAISE EXCEPTION 'Say whether the submission needs advisor action' USING ERRCODE = '22023';
  END IF;
  IF length(clean_note) > 500 THEN
    RAISE EXCEPTION 'A needs-advisor-action note is limited to 500 characters' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  -- Already as asked: nothing to record. Raising it again with another note replaces the note.
  IF current_row.needs_action = p_needs_action
     AND (NOT p_needs_action OR current_row.needs_action_note IS NOT DISTINCT FROM clean_note) THEN
    RETURN current_row;
  END IF;

  UPDATE public.submission_workflow
  SET needs_action = p_needs_action,
      needs_action_note = CASE WHEN p_needs_action THEN clean_note END,
      needs_action_at = now(),
      needs_action_by = auth.uid(),
      needs_action_by_email = auth.jwt() ->> 'email'
  WHERE session_id = p_session_id
  RETURNING * INTO current_row;

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (
    p_session_id, current_row.status, current_row.status,
    CASE WHEN p_needs_action THEN 'Marked as needing advisor action' ELSE 'Cleared: no longer needs advisor action' END
      || COALESCE(': ' || clean_note, ''),
    auth.uid(), auth.jwt() ->> 'email'
  );
  RETURN current_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_submission_needs_action(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_submission_needs_action(uuid, boolean, text) TO authenticated;

-- ---------- The queue: shown on each row, and a filter ----------

DROP FUNCTION public.advisor_list_submissions(text, text, integer, integer);

CREATE FUNCTION public.advisor_list_submissions(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_needs_action boolean DEFAULT NULL
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
  -- Whether an advisor marked the submission as needing advisor action, and their note.
  needs_action boolean,
  needs_action_note text,
  -- How many intakes match the status, the needs-action filter and the search, before paging.
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
      w.needs_action AS action_needed,
      w.needs_action_note AS action_note,
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
    WHERE (p_status IS NULL OR w.status = p_status)
      AND (p_needs_action IS NULL OR w.needs_action = p_needs_action)
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
    m.action_needed,
    m.action_note,
    count(*) OVER ()
  FROM matched m
  -- Certified is the intake's status; its date only orders the group. Rows submitted before the
  -- server stamped certifications have no certified_at: they stay in the group, after the stamped ones.
  ORDER BY (m.status = 'submitted') DESC, m.certified_at DESC NULLS LAST, m.updated_at DESC, m.id
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_list_submissions(text, text, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_list_submissions(text, text, integer, integer, boolean) TO authenticated;
