-- Advisor operations (Epic 4: US-4.1 to US-4.4).
--
-- * Roles: `advisor` and `admin` (plan decision D5) live in user_roles. Nobody can grant
--   themselves a role; see docs/ADVISOR_ACCESS.md for how roles are granted.
-- * Advisors can read every intake, certification and uploaded document. They cannot change
--   what the prospect provided: their corrections live in advisor_field_reviews, beside the
--   prospect's values, and every change is written to an append-only audit table.
-- * Each intake has a pipeline status (draft through archived) with an append-only history of
--   who changed it and when. Prospects only ever see the statuses we intend to share.
-- * Generated Manuscripts are stored privately per submission and version. Only advisors can
--   list or download them.
--
-- Every advisor read and write is checked here, in the database, not only in the UI.

-- ---------- Roles ----------

CREATE TYPE public.app_role AS ENUM ('advisor', 'admin');

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- No write policies, and no write grants: roles are granted with the service role only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_roles FROM anon, authenticated;

-- True when the signed-in user holds `_role`. False for signed-out callers and guests.
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role);
$$;

-- Admins can do everything advisors can.
CREATE OR REPLACE FUNCTION public.is_advisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role('advisor') OR public.has_role('admin');
$$;

REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_advisor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_advisor() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_advisor()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_advisor() THEN
    RAISE EXCEPTION 'Advisor access required' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Shared by the append-only audit tables below.
CREATE OR REPLACE FUNCTION public.reject_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '% records cannot be changed or deleted', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$;

-- ---------- Advisor read access to intakes ----------
-- Additive to the owner-only policies: prospects still see only their own rows.

CREATE POLICY "Advisors can view all sessions"
  ON public.chamber_sessions FOR SELECT TO authenticated
  USING (public.is_advisor());

CREATE POLICY "Advisors can view all certifications"
  ON public.chamber_certifications FOR SELECT TO authenticated
  USING (public.is_advisor());

CREATE POLICY "Advisors can view all documents"
  ON public.documents FOR SELECT TO authenticated
  USING (public.is_advisor());

CREATE POLICY "Advisors can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_advisor());

CREATE POLICY "Advisors can read uploaded documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.is_advisor());

-- ---------- Pipeline status ----------

-- Statuses a prospect may see (US-4.2). The rest are internal: in particular, this product tells
-- prospects they send the packet themselves, so carrier/PEO routing and outcomes stay internal.
CREATE OR REPLACE FUNCTION public.is_prospect_visible_status(s text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$ SELECT s IN ('submitted', 'under_review', 'information_requested') $$;

CREATE TABLE public.submission_workflow (
  session_id uuid PRIMARY KEY REFERENCES public.chamber_sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'under_review', 'information_requested',
    'sent_to_carrier', 'quoted', 'won', 'lost', 'archived'
  )),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE INDEX submission_workflow_status_idx ON public.submission_workflow (status);

ALTER TABLE public.submission_workflow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors can view pipeline status"
  ON public.submission_workflow FOR SELECT TO authenticated
  USING (public.is_advisor());
-- Changed only through set_submission_status() and the intake trigger below.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.submission_workflow FROM anon, authenticated;

CREATE TABLE public.submission_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- No foreign key on purpose: history must outlive the session row.
  session_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by uuid,          -- null for system changes (e.g. backfill)
  changed_by_email text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX submission_status_history_session_idx ON public.submission_status_history (session_id, changed_at DESC);

ALTER TABLE public.submission_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors can view status history"
  ON public.submission_status_history FOR SELECT TO authenticated
  USING (public.is_advisor());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.submission_status_history FROM anon, authenticated;

CREATE TRIGGER submission_status_history_append_only
  BEFORE UPDATE OR DELETE ON public.submission_status_history
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

-- Starts every intake as a draft and moves it to `submitted` when the prospect certifies it.
-- A certification withdrawn before an advisor picks the intake up sends it back to draft;
-- once an advisor has moved it on, its pipeline status is theirs to manage.
CREATE OR REPLACE FUNCTION public.sync_submission_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status text;
  target text;
  note text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target := CASE WHEN NEW.status = 'submitted' THEN 'submitted' ELSE 'draft' END;
    INSERT INTO public.submission_workflow (session_id, status, updated_by)
    VALUES (NEW.id, target, auth.uid())
    ON CONFLICT (session_id) DO NOTHING;
    INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by)
    VALUES (NEW.id, NULL, target, 'Intake started', auth.uid());
    RETURN NULL;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;

  SELECT status INTO current_status FROM public.submission_workflow WHERE session_id = NEW.id FOR UPDATE;
  IF NEW.status = 'submitted' AND COALESCE(current_status, 'draft') = 'draft' THEN
    target := 'submitted';
    note := 'Prospect certified the intake';
  ELSIF OLD.status = 'submitted' AND current_status = 'submitted' THEN
    target := 'draft';
    note := 'Certification withdrawn: the prospect changed their answers';
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO public.submission_workflow (session_id, status, updated_at, updated_by)
  VALUES (NEW.id, target, now(), auth.uid())
  ON CONFLICT (session_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now(), updated_by = auth.uid();
  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by)
  VALUES (NEW.id, current_status, target, note, auth.uid());
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_submission_workflow() FROM PUBLIC, anon, authenticated;

-- Not `UPDATE OF status`: the certification trigger can change the status of an update that
-- only set chamber_data, and that must reach the pipeline too.
CREATE TRIGGER chamber_sessions_sync_workflow
  AFTER INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.sync_submission_workflow();

-- Existing intakes join the pipeline where they stand.
INSERT INTO public.submission_workflow (session_id, status, updated_at)
SELECT id, CASE WHEN status = 'submitted' THEN 'submitted' ELSE 'draft' END, updated_at
FROM public.chamber_sessions
ON CONFLICT (session_id) DO NOTHING;

INSERT INTO public.submission_status_history (session_id, from_status, to_status, note)
SELECT session_id, NULL, status, 'Added to the advisor pipeline'
FROM public.submission_workflow;

-- The one way to change a pipeline status. Draft is reserved for intakes the prospect hasn't
-- certified, so advisors can't move a submission back to it.
CREATE OR REPLACE FUNCTION public.set_submission_status(p_session_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS public.submission_workflow
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.submission_workflow;
  previous text;
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM public.require_advisor();
  IF p_status IS NULL OR p_status NOT IN (
    'submitted', 'under_review', 'information_requested', 'sent_to_carrier', 'quoted', 'won', 'lost', 'archived'
  ) THEN
    RAISE EXCEPTION 'Not a status an advisor can set: %', p_status USING ERRCODE = '22023';
  END IF;
  IF length(clean_note) > 2000 THEN
    RAISE EXCEPTION 'Status notes are limited to 2000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_row FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF current_row.status = p_status THEN
    RETURN current_row;
  END IF;
  previous := current_row.status;

  UPDATE public.submission_workflow
  SET status = p_status, updated_at = now(), updated_by = auth.uid()
  WHERE session_id = p_session_id
  RETURNING * INTO current_row;

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (p_session_id, previous, p_status, clean_note, auth.uid(), auth.jwt() ->> 'email');
  RETURN current_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_submission_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_submission_status(uuid, text, text) TO authenticated;

-- What the prospect is told about their own intake: the latest status we intend to share, so an
-- internal status (say, `lost`) never reaches them. Null for anyone else's intake, without
-- revealing whether it exists.
CREATE OR REPLACE FUNCTION public.prospect_submission_status(p_session_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.to_status
  FROM public.submission_status_history h
  JOIN public.chamber_sessions s ON s.id = h.session_id
  WHERE h.session_id = p_session_id
    AND s.user_id = auth.uid()
    AND s.status = 'submitted'
    AND public.is_prospect_visible_status(h.to_status)
  ORDER BY h.changed_at DESC, h.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.prospect_submission_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospect_submission_status(uuid) TO authenticated;

-- ---------- Internal notes ----------

CREATE TABLE public.advisor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chamber_sessions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_email text,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX advisor_notes_session_idx ON public.advisor_notes (session_id, created_at DESC);

ALTER TABLE public.advisor_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors can view notes"
  ON public.advisor_notes FOR SELECT TO authenticated
  USING (public.is_advisor());
CREATE POLICY "Advisors can add notes as themselves"
  ON public.advisor_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_advisor() AND author_id = auth.uid());
-- Notes are a record: nobody edits or deletes them.
REVOKE UPDATE, DELETE, TRUNCATE ON public.advisor_notes FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.stamp_advisor_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.author_email := auth.jwt() ->> 'email';
  NEW.created_at := now();
  NEW.body := btrim(NEW.body);
  RETURN NEW;
END;
$$;

CREATE TRIGGER advisor_notes_stamp
  BEFORE INSERT ON public.advisor_notes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_advisor_note();

CREATE TRIGGER advisor_notes_append_only
  BEFORE UPDATE OR DELETE ON public.advisor_notes
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

-- ---------- Field review and corrections ----------

-- Keys of chamber_data an advisor can review. `employees` (the census) can be reviewed but not
-- corrected here.
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
    'key_challenges', 'business_goals', 'employees'
  ]);
$$;

-- The advisor's current view of each field. The prospect's own value is never changed: a
-- correction sits here beside it, and the Manuscript an advisor generates uses it only once
-- the field is marked verified.
CREATE TABLE public.advisor_field_reviews (
  session_id uuid NOT NULL REFERENCES public.chamber_sessions(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (public.is_reviewable_field(field)),
  review_state text CHECK (review_state IN ('verified', 'incomplete', 'follow_up')),
  has_correction boolean NOT NULL DEFAULT false,
  corrected_value jsonb,
  reason text,
  updated_by uuid NOT NULL,
  updated_by_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, field),
  CHECK (has_correction OR corrected_value IS NULL),
  CHECK (NOT has_correction OR field <> 'employees')
);

ALTER TABLE public.advisor_field_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors can view field reviews"
  ON public.advisor_field_reviews FOR SELECT TO authenticated
  USING (public.is_advisor());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.advisor_field_reviews FROM anon, authenticated;

-- Every review change, kept for good: the audit trail of material changes (US-4.3).
CREATE TABLE public.advisor_review_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL,
  field text NOT NULL,
  from_state text,
  to_state text,
  correction_changed boolean NOT NULL,
  from_value jsonb,
  to_value jsonb,
  had_correction boolean NOT NULL,
  has_correction boolean NOT NULL,
  reason text,
  actor_id uuid NOT NULL,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX advisor_review_events_session_idx ON public.advisor_review_events (session_id, id DESC);

ALTER TABLE public.advisor_review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors can view review events"
  ON public.advisor_review_events FOR SELECT TO authenticated
  USING (public.is_advisor());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.advisor_review_events FROM anon, authenticated;

CREATE TRIGGER advisor_review_events_append_only
  BEFORE UPDATE OR DELETE ON public.advisor_review_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

-- Marks a field verified / incomplete / needing follow-up (or clears the mark), and sets, keeps
-- or clears the advisor's correction. A correction needs a reason. Writes one audit event.
--   p_correction: 'keep' leaves any correction as is, 'set' stores p_value, 'clear' removes it.
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
  IF p_correction = 'set' AND p_field = 'employees' THEN
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

-- ---------- Submission list ----------

-- One row per intake for the advisor dashboard: no census, payroll or transcript content.
-- Runs with the caller's rights, so row security applies as well as the explicit check.
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
  verified_fields integer
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
      w.status AS pipeline
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
    CASE WHEN b.status = 'submitted' THEN (b.submission ->> 'certified_at')::timestamptz END,
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
      WHERE r.session_id = b.id AND r.review_state = 'verified')
  FROM base b
  LEFT JOIN public.profiles p ON p.user_id = b.user_id
  ORDER BY COALESCE(CASE WHEN b.status = 'submitted' THEN (b.submission ->> 'certified_at')::timestamptz END, b.updated_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_list_submissions(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_list_submissions(text) TO authenticated;

-- ---------- Manuscript versions ----------

-- Private: only advisors can read or add files, and nobody can overwrite or delete one.
INSERT INTO storage.buckets (id, name, public)
VALUES ('manuscripts', 'manuscripts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Advisors can read generated manuscripts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'manuscripts' AND public.is_advisor());

CREATE POLICY "Advisors can store generated manuscripts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'manuscripts' AND public.is_advisor());

-- One row per generated Manuscript. A version pins exactly what it was built from: the
-- certification (by its data hash and signing time) and the advisor review state (the latest
-- review event it includes).
CREATE TABLE public.manuscript_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No foreign key on purpose: the record must outlive the session row.
  session_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  file_id text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  pdf_sha256 text NOT NULL CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  certified_data_hash text NOT NULL,
  certified_signed_at timestamptz NOT NULL,
  review_event_id bigint NOT NULL DEFAULT 0,
  corrections_applied integer NOT NULL DEFAULT 0,
  sensitive_revealed boolean NOT NULL DEFAULT false,
  generated_by uuid NOT NULL,
  generated_by_email text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, version)
);

ALTER TABLE public.manuscript_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors can view manuscript versions"
  ON public.manuscript_versions FOR SELECT TO authenticated
  USING (public.is_advisor());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.manuscript_versions FROM anon, authenticated;

CREATE TRIGGER manuscript_versions_append_only
  BEFORE UPDATE OR DELETE ON public.manuscript_versions
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

-- Records a Manuscript the advisor has just uploaded. Refused unless the intake is certified, the
-- file was stored under this submission, and it was built from the current review state (so a
-- packet generated before someone else's correction can't be filed as the latest version).
-- An upload whose version couldn't be recorded may be cleaned up; a recorded one never can.
CREATE POLICY "Advisors can remove unrecorded manuscript uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'manuscripts' AND public.is_advisor()
    AND NOT EXISTS (SELECT 1 FROM public.manuscript_versions v WHERE v.storage_path = name)
  );

CREATE OR REPLACE FUNCTION public.record_manuscript_version(
  p_session_id uuid,
  p_version integer,
  p_storage_path text,
  p_pdf_sha256 text,
  p_review_event_id bigint,
  p_corrections_applied integer,
  p_sensitive_revealed boolean
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

  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF s.status IS DISTINCT FROM 'submitted' OR s.submission IS NULL THEN
    RAISE EXCEPTION 'Only a certified intake can become a Manuscript' USING ERRCODE = '23514';
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
      USING ERRCODE = '40001';
  END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO next_version FROM public.manuscript_versions WHERE session_id = p_session_id;
  IF p_version IS DISTINCT FROM next_version THEN
    RAISE EXCEPTION 'Another version was generated meanwhile; generate it again' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.manuscript_versions
    (session_id, version, file_id, storage_path, pdf_sha256, certified_data_hash, certified_signed_at,
     review_event_id, corrections_applied, sensitive_revealed, generated_by, generated_by_email)
  VALUES
    (p_session_id, next_version,
     COALESCE(NULLIF(s.submission ->> 'file_id', ''), 'EAA-' || upper(left(replace(p_session_id::text, '-', ''), 8))),
     p_storage_path, lower(p_pdf_sha256),
     COALESCE(s.submission ->> 'data_sha256', encode(sha256(convert_to(s.chamber_data::text, 'UTF8')), 'hex')),
     (s.submission ->> 'signed_at')::timestamptz,
     latest_event, GREATEST(COALESCE(p_corrections_applied, 0), 0), COALESCE(p_sensitive_revealed, false),
     auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_manuscript_version(uuid, integer, text, text, bigint, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manuscript_version(uuid, integer, text, text, bigint, integer, boolean) TO authenticated;
