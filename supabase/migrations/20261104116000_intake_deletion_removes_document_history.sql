-- Deleting an intake (complete_intake_deletion, 20261104092000_data_retention_and_deletion.sql) deletes its
-- document history (document_events, 20261104112000_certified_evidence.sql) with its other rows, so no file
-- name or path of a deleted intake is kept. record_document_event (20261104115000) writes nothing while an
-- intake is being deleted, so the count of what was removed is what the intake held.

-- Unchanged from 20261104092000_data_retention_and_deletion.sql except that the intake's document_events
-- (20261104112000_certified_evidence.sql) are deleted with its other rows, before its documents, whose
-- deletion records nothing (record_document_event, 20261104115000). The record of what was removed counts them.
CREATE OR REPLACE FUNCTION public.complete_intake_deletion(p_deletion_id uuid, p_files_deleted integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.intake_deletions;
  sid uuid;
  owner_id uuid;
  remaining integer;
  n integer;
  removed jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO d FROM public.intake_deletions WHERE id = p_deletion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deletion not found' USING ERRCODE = 'PT404';
  END IF;
  IF d.status <> 'claimed' THEN
    RAISE EXCEPTION 'Only a claimed deletion can be completed (this one is %)', d.status USING ERRCODE = '55000';
  END IF;
  sid := d.session_id;

  -- Hold the intake still while it is checked and deleted. This waits for any upload still in flight: each
  -- holds a share lock on the row from its policy check (intake_accepts_files) until it commits, so its file
  -- is visible to the check below, and any upload after this one finds the deletion open, or the intake gone.
  SELECT s.user_id INTO owner_id FROM public.chamber_sessions s WHERE s.id = sid FOR UPDATE;
  owner_id := COALESCE(owner_id, d.user_id);

  SELECT count(*)::integer INTO remaining FROM public.intake_stored_files(sid, owner_id);
  IF remaining > 0 THEN
    RAISE EXCEPTION 'The intake still has % stored file(s); remove them first', remaining
      USING ERRCODE = 'EA006', DETAIL = remaining::text;
  END IF;

  PERFORM set_config('eaa.deleting_intake', sid::text, true);

  -- Children first, so each count says what that table held; the session row last.
  DELETE FROM public.manuscript_versions WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('manuscript_versions', n);
  DELETE FROM public.advisor_review_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_review_events', n);
  DELETE FROM public.advisor_field_reviews WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_field_reviews', n);
  DELETE FROM public.advisor_notes WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_notes', n);
  DELETE FROM public.submission_status_history WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('submission_status_history', n);
  DELETE FROM public.submission_workflow WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('submission_workflow', n);
  DELETE FROM public.intake_lifecycle_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('intake_lifecycle_events', n);
  DELETE FROM public.outbox_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('outbox_events', n);
  DELETE FROM public.chamber_certifications WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('chamber_certifications', n);
  DELETE FROM public.document_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('document_events', n);
  DELETE FROM public.documents WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('documents', n);
  DELETE FROM public.ai_extraction_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('ai_extraction_events', n);
  -- Operational events stay (they are counts for monitoring) but no longer point at the intake.
  UPDATE public.ops_events SET session_id = NULL WHERE session_id = sid;
  DELETE FROM public.chamber_sessions WHERE id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('chamber_sessions', n);

  PERFORM set_config('eaa.deleting_intake', '', true);

  UPDATE public.intake_deletions
  SET status = 'done',
      completed_at = now(),
      locked_until = NULL,
      last_error = NULL,
      files_deleted = GREATEST(COALESCE(p_files_deleted, 0), 0),
      rows_deleted = removed
  WHERE id = d.id;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_intake_deletion(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_intake_deletion(uuid, integer) TO service_role;
