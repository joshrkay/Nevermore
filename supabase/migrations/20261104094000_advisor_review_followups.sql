-- Follow-ups from the review of 20261104090000-20261104093000.
--
--   * "Certified at least once" no longer means only "has a chamber_certifications row": intakes
--     certified before that table existed have none, and were left archive-only, with a re-certification
--     treated as their first (which reset the advisor's status). A history row that reached `submitted`
--     counts too: the pipeline backfill wrote one for every intake that was certified then.
--   * An intake inserted already certified is recorded as certified, not as "Intake started".
--   * The prospect's status follows the order history rows were written (id), not their transaction's
--     start time, which can put a row written later before one written earlier.
--   * A Manuscript version recorded before certified_at existed is current when its data hash and
--     signing time match the certification, so it is still offered to the prospect.
--   * A document's removal records the stored file it had, so a file kept as certified evidence can be
--     found once the certification moves on (purging such files belongs to retention, H-1.2).

-- ---------- Certified at least once ----------

CREATE OR REPLACE FUNCTION public.intake_ever_certified(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = p_session_id)
      OR EXISTS (SELECT 1 FROM public.submission_status_history h WHERE h.session_id = p_session_id AND h.to_status = 'submitted');
$$;

REVOKE ALL ON FUNCTION public.intake_ever_certified(uuid) FROM PUBLIC, anon, authenticated;

-- Unchanged from 20261104090000_pipeline_follows_the_prospect.sql except the INSERT note and the test
-- for a first certification.
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
  certifying boolean;
  withdrawn boolean;
  first_certification boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target := CASE WHEN NEW.status = 'submitted' THEN 'submitted' ELSE 'draft' END;
    INSERT INTO public.submission_workflow (session_id, status, updated_by)
    VALUES (NEW.id, target, auth.uid())
    ON CONFLICT (session_id) DO NOTHING;
    INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by)
    VALUES (NEW.id, NULL, target,
            CASE WHEN target = 'submitted' THEN 'Prospect certified the intake' ELSE 'Intake started' END,
            auth.uid());
    RETURN NULL;
  END IF;

  -- The same test the certification triggers use (validate_certification, record_certification).
  certifying := NEW.status = 'submitted'
    AND (OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission);
  withdrawn := OLD.status = 'submitted' AND NEW.status IS DISTINCT FROM 'submitted';
  IF NOT certifying AND NOT withdrawn THEN
    RETURN NULL;
  END IF;

  SELECT status INTO current_status FROM public.submission_workflow WHERE session_id = NEW.id FOR UPDATE;

  IF certifying THEN
    -- record_certification has already written this certification (it fires first, by name) or will:
    -- one row at most, and no history of ever reaching `submitted`, means this is the first.
    first_certification := (SELECT count(*) FROM public.chamber_certifications WHERE session_id = NEW.id) <= 1
      AND NOT EXISTS (SELECT 1 FROM public.submission_status_history h WHERE h.session_id = NEW.id AND h.to_status = 'submitted');
    IF current_status IS NULL OR current_status = 'draft' OR first_certification THEN
      target := 'submitted';
      note := 'Prospect certified the intake';
    ELSIF current_status = 'information_requested' THEN
      target := 'submitted';
      note := 'Prospect certified their updated intake, answering the request for information';
    ELSE
      target := current_status;
      note := 'Prospect certified the intake again';
    END IF;
  ELSIF current_status = 'submitted' THEN
    target := 'draft';
    note := 'Certification withdrawn: the prospect changed their answers';
  ELSE
    target := current_status;
    note := 'Certification withdrawn: the prospect changed their answers. The status stays until they certify again';
  END IF;

  IF target IS DISTINCT FROM current_status THEN
    INSERT INTO public.submission_workflow (session_id, status, updated_at, updated_by)
    VALUES (NEW.id, target, now(), auth.uid())
    ON CONFLICT (session_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now(), updated_by = auth.uid();
  END IF;
  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by)
  VALUES (NEW.id, current_status, target, note, auth.uid());
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_submission_workflow() FROM PUBLIC, anon, authenticated;

-- Unchanged from 20261104090000_pipeline_follows_the_prospect.sql except the certified-once test.
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
  IF p_status <> 'archived' AND NOT public.intake_ever_certified(p_session_id) THEN
    RAISE EXCEPTION 'The prospect hasn''t certified this intake yet, so it can only be archived' USING ERRCODE = '22023';
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

-- ---------- What the prospect is told: in the order it was written ----------

-- Unchanged from 20261104090000_pipeline_follows_the_prospect.sql except the order. changed_at is the
-- writing transaction's start, so a row written later (a certification that waited on an advisor's
-- change) can carry an earlier time; ids follow the order rows were written.
CREATE OR REPLACE FUNCTION public.prospect_submission_status(p_session_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN h.to_status = 'information_requested' AND w.status IS DISTINCT FROM 'information_requested' THEN 'under_review'
    ELSE h.to_status
  END
  FROM public.submission_status_history h
  JOIN public.chamber_sessions s ON s.id = h.session_id
  LEFT JOIN public.submission_workflow w ON w.session_id = h.session_id
  WHERE h.session_id = p_session_id
    AND s.user_id = auth.uid()
    AND s.status = 'submitted'
    AND public.is_prospect_visible_status(h.to_status)
  ORDER BY h.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.prospect_submission_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospect_submission_status(uuid) TO authenticated;

-- ---------- Versions recorded before certified_at ----------

-- Unchanged from 20261104092000_share_reviewed_manuscript.sql except that a version with no
-- certified_at (recorded before that column) is current when its data hash and signing time match.
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
    AND (v.certified_at IS NULL OR v.certified_at IS NOT DISTINCT FROM (s.submission ->> 'certified_at')::timestamptz)
    AND v.certified_signed_at IS NOT DISTINCT FROM (s.submission ->> 'signed_at')::timestamptz
    AND v.certified_data_hash IS NOT DISTINCT FROM (s.submission ->> 'data_sha256');
$$;

REVOKE ALL ON FUNCTION public.prospect_final_manuscript(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospect_final_manuscript(uuid) TO authenticated;

-- ---------- Which stored file a removed document had ----------

ALTER TABLE public.document_events ADD COLUMN storage_path text;

-- Unchanged from 20261104091000_certified_evidence.sql except that every event records the document's
-- stored file.
CREATE OR REPLACE FUNCTION public.record_document_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_email text := CASE WHEN auth.uid() IS NOT NULL THEN auth.jwt() ->> 'email' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.document_events (session_id, document_id, kind, file_name, to_value, storage_path, actor_id, actor_email)
    VALUES (NEW.session_id, NEW.id, 'added', NEW.file_name, NEW.category, NEW.storage_path, actor, actor_email);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.document_events (session_id, document_id, kind, file_name, from_value, storage_path, actor_id, actor_email)
    VALUES (OLD.session_id, OLD.id, 'removed', OLD.file_name, OLD.category, OLD.storage_path, actor, actor_email);
  ELSE
    IF NEW.file_name IS DISTINCT FROM OLD.file_name THEN
      INSERT INTO public.document_events (session_id, document_id, kind, file_name, from_value, to_value, storage_path, actor_id, actor_email)
      VALUES (NEW.session_id, NEW.id, 'renamed', NEW.file_name, OLD.file_name, NEW.file_name, NEW.storage_path, actor, actor_email);
    END IF;
    IF NEW.category IS DISTINCT FROM OLD.category THEN
      INSERT INTO public.document_events (session_id, document_id, kind, file_name, from_value, to_value, storage_path, actor_id, actor_email)
      VALUES (NEW.session_id, NEW.id, 'recategorised', NEW.file_name, OLD.category, NEW.category, NEW.storage_path, actor, actor_email);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_document_event() FROM PUBLIC, anon, authenticated;
