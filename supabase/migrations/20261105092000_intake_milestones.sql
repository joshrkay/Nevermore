-- Intake milestones: how far each intake got, for the advisors' pilot funnel.
--
-- Nothing recorded where prospects stop. An abandoned draft is deleted about 60 days after its last change, so the
-- evidence of where it stalled went with it. Each intake now leaves a row the first time it reaches each step:
--
--   started               the intake was created (the prospect's first change, after the consent gate)
--   answered              its answers first held something
--   document_uploaded     its first document's file was stored (document-upload reports it: record_document_uploaded)
--   census_provided       its answers first held an employee census
--   ready_to_certify      its required answers were first present with none in conflict (the certification gate's
--                         own rule: intake_missing_required, intake_conflicting_required)
--   email_verified        its owner first had a verified email: at the start, when an email was verified (from
--                         "Save your progress" or The Reckoning), or at the next save after it
--   certified             it was first certified
--   manuscript_downloaded the prospect first downloaded The Manuscript (their browser reports it:
--                         record_manuscript_download, the owner's own certified intake only)
--
-- A row holds the step, when it was reached and when the intake started, and nothing else: no answer, name,
-- address or document. When the intake is deleted, its rows stay with no link to it (complete_intake_deletion), so
-- the funnel still counts it; rows are pruned a year after their intake started (funnel_retention(), run_retention),
-- a whole cohort at once. Recording never stands in the prospect's way: a failure is a warning, not an error.
--
-- advisor_intake_funnel() counts, for intakes started in a period, how many reached each step and the median time
-- it took. Advisors only. Intakes from before this migration are backfilled from what the database still holds,
-- flagged `backfilled`, with approximate times that the medians leave out.
--
-- Deploy order: this migration, then the front end (it calls the two functions; a front end from before them
-- simply doesn't record downloads).

SET lock_timeout = '5s';

-- ---------- The record ----------

CREATE TABLE public.intake_milestones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Null once the intake is deleted.
  session_id uuid REFERENCES public.chamber_sessions(id) ON DELETE SET NULL,
  -- When the intake started: its cohort.
  started_at timestamptz NOT NULL,
  milestone text NOT NULL CHECK (milestone IN (
    -- sync:begin intake_milestones
    'started', 'answered', 'document_uploaded', 'census_provided', 'ready_to_certify', 'email_verified', 'certified', 'manuscript_downloaded'
    -- sync:end intake_milestones
  )),
  reached_at timestamptz NOT NULL DEFAULT now(),
  -- Recorded by this migration from what the database held, so reached_at is approximate.
  backfilled boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX intake_milestones_once ON public.intake_milestones (session_id, milestone) WHERE session_id IS NOT NULL;
CREATE INDEX intake_milestones_cohort ON public.intake_milestones (started_at, milestone);

-- Read only through advisor_intake_funnel(); written only by the functions below.
ALTER TABLE public.intake_milestones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.intake_milestones FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.funnel_retention()
RETURNS interval
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT
    -- sync:begin funnel_retention
    interval '365 days'
    -- sync:end funnel_retention
$$;

REVOKE ALL ON FUNCTION public.funnel_retention() FROM PUBLIC, anon, authenticated;

-- ---------- Recording ----------

-- Records that an intake reached a step, once; returns whether this call recorded it. Never raises for a missing
-- intake (there is nothing to record). Internal: the triggers and record_manuscript_download call it.
CREATE OR REPLACE FUNCTION public.note_intake_milestone(p_session_id uuid, p_milestone text, p_at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.intake_milestones (session_id, started_at, milestone, reached_at)
  SELECT s.id, s.created_at, p_milestone, GREATEST(COALESCE(p_at, now()), s.created_at)
  FROM public.chamber_sessions s
  WHERE s.id = p_session_id
  ON CONFLICT (session_id, milestone) WHERE session_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.note_intake_milestone(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;

-- Whether an intake's owner has a verified email (not an anonymous guest).
CREATE OR REPLACE FUNCTION public.intake_owner_verified(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p_user_id AND NOT COALESCE(u.is_anonymous, false) AND NULLIF(btrim(u.email), '') IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.intake_owner_verified(uuid) FROM PUBLIC, anon, authenticated;

-- What an intake's row says it has reached, after each insert or change of its answers.
CREATE OR REPLACE FUNCTION public.track_intake_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  census jsonb := NEW.chamber_data -> 'census';
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.note_intake_milestone(NEW.id, 'started', NEW.created_at);
    END IF;
    IF NOT public.intake_holds_nothing(NEW.chamber_data, '{}'::jsonb, '[]'::jsonb, NULL) THEN
      PERFORM public.note_intake_milestone(NEW.id, 'answered');
    END IF;
    IF jsonb_typeof(census) = 'array' AND jsonb_array_length(census) > 0 THEN
      PERFORM public.note_intake_milestone(NEW.id, 'census_provided');
    END IF;
    IF cardinality(public.intake_missing_required(NEW.chamber_data)) = 0
       AND cardinality(public.intake_conflicting_required(NEW.field_provenance)) = 0 THEN
      PERFORM public.note_intake_milestone(NEW.id, 'ready_to_certify');
    END IF;
    -- The owner verified an email: usually caught when it happens (track_email_verified), and here otherwise.
    IF NOT EXISTS (SELECT 1 FROM public.intake_milestones m WHERE m.session_id = NEW.id AND m.milestone = 'email_verified')
       AND public.intake_owner_verified(NEW.user_id) THEN
      PERFORM public.note_intake_milestone(NEW.id, 'email_verified');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- The funnel is a measurement; it never stops a prospect's save.
    RAISE WARNING 'intake milestones: not recorded for % (%)', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.track_intake_milestones() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS track_intake_milestones ON public.chamber_sessions;
CREATE TRIGGER track_intake_milestones
  AFTER INSERT OR UPDATE OF chamber_data, field_provenance ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.track_intake_milestones();

-- An upload counts once its file is stored and kept: document-upload inserts the row first, and deletes it if the file
-- can't be stored or the intake is being deleted, so the row alone isn't an upload. The function says so once it has
-- stored the file, with the service role. Returns whether this call recorded it.
CREATE OR REPLACE FUNCTION public.record_document_uploaded(p_document_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.documents;
BEGIN
  SELECT * INTO d FROM public.documents WHERE id = p_document_id;
  IF NOT FOUND OR d.session_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN public.note_intake_milestone(d.session_id, 'document_uploaded', d.created_at);
END;
$$;

REVOKE ALL ON FUNCTION public.record_document_uploaded(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_document_uploaded(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.track_certification_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    -- Certifying takes a verified email, so a certified intake's owner has one by now.
    PERFORM public.note_intake_milestone(NEW.session_id, 'email_verified');
    PERFORM public.note_intake_milestone(NEW.session_id, 'certified');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'intake milestones: certification not recorded for % (%)', NEW.session_id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.track_certification_milestone() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS track_certification_milestone ON public.chamber_certifications;
CREATE TRIGGER track_certification_milestone
  AFTER INSERT ON public.chamber_certifications
  FOR EACH ROW EXECUTE FUNCTION public.track_certification_milestone();

-- A guest who verifies an email is upgraded in place (is_anonymous goes false): each intake of theirs still open
-- has reached that step now.
CREATE OR REPLACE FUNCTION public.track_email_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.note_intake_milestone(s.id, 'email_verified')
    FROM public.chamber_sessions s
    WHERE s.user_id = NEW.id AND s.status IN ('in_progress', 'submitted');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'intake milestones: verification not recorded for % (%)', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.track_email_verified() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS track_email_verified ON auth.users;
CREATE TRIGGER track_email_verified
  AFTER UPDATE OF is_anonymous ON auth.users
  FOR EACH ROW
  WHEN (OLD.is_anonymous IS TRUE AND NEW.is_anonymous IS FALSE)
  EXECUTE FUNCTION public.track_email_verified();

-- The prospect downloaded The Manuscript of their own certified intake. Only their browser knows; it says so here.
-- Returns whether this was the first time. Anyone else's intake, or one not certified, records nothing.
CREATE OR REPLACE FUNCTION public.record_manuscript_download(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chamber_sessions s
    WHERE s.id = p_session_id AND s.user_id = auth.uid() AND s.status = 'submitted'
  ) THEN
    RETURN false;
  END IF;
  RETURN public.note_intake_milestone(p_session_id, 'manuscript_downloaded');
END;
$$;

REVOKE ALL ON FUNCTION public.record_manuscript_download(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manuscript_download(uuid) TO authenticated;

-- ---------- The funnel ----------

-- For intakes started in [p_from, p_to): each step in order, how many reached it, and the median minutes from the
-- start to reaching it (recorded times only; backfilled ones are approximate and left out). At most a year at once.
CREATE OR REPLACE FUNCTION public.advisor_intake_funnel(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (step integer, milestone text, intakes bigint, median_minutes numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.require_advisor();
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'The period must start before it ends' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > interval '366 days' THEN
    RAISE EXCEPTION 'The funnel covers at most a year at once' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT s.ord::integer, s.name,
           count(m.id),
           round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM m.reached_at - m.started_at) / 60)
                  FILTER (WHERE NOT m.backfilled))::numeric, 1)
    FROM unnest(ARRAY[
      'started', 'answered', 'document_uploaded', 'census_provided', 'ready_to_certify', 'email_verified', 'certified', 'manuscript_downloaded'
    ]) WITH ORDINALITY AS s(name, ord)
    LEFT JOIN public.intake_milestones m
      ON m.milestone = s.name AND m.started_at >= p_from AND m.started_at < p_to
    GROUP BY s.ord, s.name
    ORDER BY s.ord;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_intake_funnel(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_intake_funnel(timestamptz, timestamptz) TO authenticated;

-- ---------- What the database already holds ----------

-- Every intake still here, as far as can be told now. Times are approximate where nothing recorded the moment (the
-- intake's start, or its last change), and the rows say so.
INSERT INTO public.intake_milestones (session_id, started_at, milestone, reached_at, backfilled)
SELECT s.id, s.created_at, x.milestone, GREATEST(x.reached_at, s.created_at), true
FROM public.chamber_sessions s
CROSS JOIN LATERAL (
  SELECT 'started' AS milestone, s.created_at AS reached_at
  UNION ALL
  SELECT 'answered', s.created_at
  WHERE NOT public.intake_holds_nothing(s.chamber_data, '{}'::jsonb, '[]'::jsonb, NULL)
  UNION ALL
  SELECT 'document_uploaded', min(d.created_at) FROM public.documents d WHERE d.session_id = s.id HAVING count(*) > 0
  UNION ALL
  SELECT 'census_provided', s.updated_at
  WHERE jsonb_typeof(s.chamber_data -> 'census') = 'array' AND jsonb_array_length(s.chamber_data -> 'census') > 0
  UNION ALL
  SELECT 'ready_to_certify', s.updated_at
  WHERE cardinality(public.intake_missing_required(s.chamber_data)) = 0
    AND cardinality(public.intake_conflicting_required(s.field_provenance)) = 0
  UNION ALL
  SELECT 'email_verified', s.created_at WHERE public.intake_owner_verified(s.user_id)
  UNION ALL
  SELECT 'certified', min(c.recorded_at) FROM public.chamber_certifications c WHERE c.session_id = s.id HAVING count(*) > 0
) x
ON CONFLICT (session_id, milestone) WHERE session_id IS NOT NULL DO NOTHING;

-- ---------- Retention and deletion ----------

-- Unchanged from 20261104092000_data_retention_and_deletion.sql except that it prunes the funnel's milestones a year
-- after their intake started.
CREATE OR REPLACE FUNCTION public.run_retention()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  queued integer;
  ops_pruned integer;
  email_pruned integer;
  ai_pruned integer;
  ip_pruned integer;
  usage_pruned integer;
  milestones_pruned integer;
BEGIN
  queued := public.queue_retention_deletions(500);

  DELETE FROM public.ops_events WHERE created_at < now() - public.ops_event_retention();
  GET DIAGNOSTICS ops_pruned = ROW_COUNT;

  -- A suppression keeps its address; it only loses the link to the event that caused it.
  DELETE FROM public.email_delivery_events WHERE received_at < now() - public.email_event_retention();
  GET DIAGNOSTICS email_pruned = ROW_COUNT;

  -- The same day the limits look back over (20261020190000_ai_rate_limit, 20261020220000_guest_abuse_limits).
  DELETE FROM public.ai_request_log WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS ai_pruned = ROW_COUNT;
  DELETE FROM public.ai_ip_log WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS ip_pruned = ROW_COUNT;
  -- Daily totals hold no account or address; kept as long as operational events, for cost questions.
  DELETE FROM public.ai_global_usage WHERE day < (now() - public.ops_event_retention())::date;
  GET DIAGNOSTICS usage_pruned = ROW_COUNT;
  -- A whole cohort at once, by when its intakes started, so the funnel never counts half of one.
  DELETE FROM public.intake_milestones WHERE started_at < now() - public.funnel_retention();
  GET DIAGNOSTICS milestones_pruned = ROW_COUNT;

  RETURN jsonb_build_object(
    'deletions_queued', queued,
    'ops_events_pruned', ops_pruned,
    'email_events_pruned', email_pruned,
    'ai_request_log_pruned', ai_pruned,
    'ai_ip_log_pruned', ip_pruned,
    'ai_global_usage_pruned', usage_pruned,
    'intake_milestones_pruned', milestones_pruned
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_retention() TO service_role;

-- Unchanged from 20261105090000_information_requests.sql except that the intake's milestones lose their link to it
-- and stay, as its operational events do.
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
  DELETE FROM public.information_requests WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('information_requests', n);
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
  -- So are the funnel's milestones: how far the intake got stays, with no link to whose it was.
  UPDATE public.intake_milestones SET session_id = NULL WHERE session_id = sid;
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

RESET lock_timeout;
