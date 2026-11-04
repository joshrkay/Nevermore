-- The pipeline moves one step at a time (F-4.1).
--
--   * A tenth pipeline stage, `ready_for_market`: the advisor has reviewed the file and it can go to PEOs.
--     It is internal, like the stages after it: the prospect keeps seeing the last status we share.
--   * An advisor can only move an intake to a stage the allow-list below names for its current stage.
--     Before this, any certified intake could go to any stage, so an archived file went straight back to
--     `under_review`. Now an archived file is reopened as `submitted` and is reviewed again from there,
--     and a won or lost file is archived before it is reopened.
--   * What the prospect does still moves the pipeline as before (sync_submission_workflow): certifying
--     enters it as `submitted` and answers a request for information, and withdrawing a certification at
--     `submitted` returns it to `draft`. Those moves are the system's, not an advisor's, and the allow-list
--     doesn't apply to them.
--
-- src/data/advisor.ts holds the same stages and the same allow-list (PIPELINE_STATUSES,
-- PIPELINE_TRANSITIONS); src/data/schemaSync.test.ts reads the sync blocks below and fails when they differ.

-- ---------- The stages ----------

ALTER TABLE public.submission_workflow DROP CONSTRAINT IF EXISTS submission_workflow_status_check;
ALTER TABLE public.submission_workflow
  ADD CONSTRAINT submission_workflow_status_check CHECK (status IN (
    -- sync:begin pipeline_statuses
    'draft', 'submitted', 'under_review', 'information_requested', 'ready_for_market',
    'sent_to_carrier', 'quoted', 'won', 'lost', 'archived'
    -- sync:end pipeline_statuses
  ));

-- ---------- Where an advisor can move an intake from each stage ----------

-- Draft is the system's stage (an intake the prospect hasn't certified, or whose certification they
-- withdrew while it was `submitted`): it can only be archived until they certify. Every other open stage
-- can be lost or archived; a closed one (won, lost) can only be archived; archived can only be reopened.
CREATE OR REPLACE FUNCTION public.pipeline_next_statuses(p_from text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_from
    -- sync:begin pipeline_transitions
    WHEN 'draft' THEN ARRAY['archived']
    WHEN 'submitted' THEN ARRAY['under_review', 'information_requested', 'lost', 'archived']
    WHEN 'under_review' THEN ARRAY['information_requested', 'ready_for_market', 'lost', 'archived']
    WHEN 'information_requested' THEN ARRAY['under_review', 'lost', 'archived']
    WHEN 'ready_for_market' THEN ARRAY['under_review', 'information_requested', 'sent_to_carrier', 'lost', 'archived']
    WHEN 'sent_to_carrier' THEN ARRAY['information_requested', 'quoted', 'lost', 'archived']
    WHEN 'quoted' THEN ARRAY['sent_to_carrier', 'won', 'lost', 'archived']
    WHEN 'won' THEN ARRAY['archived']
    WHEN 'lost' THEN ARRAY['archived']
    WHEN 'archived' THEN ARRAY['submitted']
    -- sync:end pipeline_transitions
    ELSE ARRAY[]::text[]
  END;
$$;

REVOKE ALL ON FUNCTION public.pipeline_next_statuses(text) FROM PUBLIC, anon, authenticated;

-- ---------- What an advisor can set ----------

-- Unchanged from 20261104115000_advisor_review_followups.sql except `ready_for_market` and the allow-list.
CREATE OR REPLACE FUNCTION public.set_submission_status(p_session_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS public.submission_workflow
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.submission_workflow;
  previous text;
  allowed text[];
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM public.require_advisor();
  IF p_status IS NULL OR p_status NOT IN (
    'submitted', 'under_review', 'information_requested', 'ready_for_market', 'sent_to_carrier', 'quoted', 'won', 'lost', 'archived'
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
  allowed := public.pipeline_next_statuses(current_row.status);
  IF NOT p_status = ANY (allowed) THEN
    RAISE EXCEPTION 'A submission can''t move from % to %. From % it can move to: %',
      replace(current_row.status, '_', ' '), replace(p_status, '_', ' '), replace(current_row.status, '_', ' '),
      replace(array_to_string(allowed, ', '), '_', ' ')
      USING ERRCODE = '22023';
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
