-- The advisor pipeline keeps track of what the prospect does, whatever status an advisor has set.
--
--   * Every certification and every withdrawn certification is written to the status history, not only
--     while the pipeline is at draft or submitted. A re-certification sent as one update (the intake
--     stays `submitted`, with a new certification) counts too.
--   * A prospect who certifies while the pipeline is `information_requested` has answered the request:
--     the pipeline returns to `submitted`, so the advisor sees it and the prospect is no longer asked to act.
--     A first certification also enters the pipeline as `submitted`, even if an advisor archived the draft.
--     Any other status an advisor set stays theirs to manage; the history records what the prospect did.
--   * The prospect is never told "your advisor needs a little more information" once the pipeline has
--     moved past `information_requested`; they're told an advisor is reviewing their submission.
--   * An intake the prospect has never certified can only be archived (draft is the system's status).

-- ---------- What the prospect does, in the pipeline and its history ----------

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
    VALUES (NEW.id, NULL, target, 'Intake started', auth.uid());
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
    -- record_certification has already written this certification (or runs after this trigger and
    -- will): at most one row means the intake was never certified before.
    first_certification := (SELECT count(*) FROM public.chamber_certifications WHERE session_id = NEW.id) <= 1;
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

-- ---------- What the prospect is told ----------

-- The latest status we chose to share, for the caller's own certified intake (as before), except that
-- `information_requested` is shared only while it is the pipeline's status: once the advisor has moved
-- on, nothing is waiting on the prospect, so they're told an advisor is reviewing their submission.
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
  ORDER BY h.changed_at DESC, h.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.prospect_submission_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospect_submission_status(uuid) TO authenticated;

-- ---------- What an advisor can set ----------

-- Unchanged from 20261022090000_advisor_operations.sql except that an intake the prospect has never
-- certified can only be archived: it isn't a submission yet, and its later certification must reach
-- the history as the moment it was submitted.
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
  IF p_status <> 'archived'
     AND NOT EXISTS (SELECT 1 FROM public.chamber_certifications WHERE session_id = p_session_id) THEN
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
