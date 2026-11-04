-- An advisor's review, and a Manuscript version, now belong to the answers they were made from.
--
-- Before this, a review was keyed only by (session, field). When the prospect changed an answer and
-- certified again, an earlier "Verified" (and any correction) carried over to the new answer, and the
-- next Manuscript printed it as advisor-confirmed. A Manuscript generated from a page loaded before a
-- re-certification was also recorded against the new certification. Now:
--   * When an answer an advisor sees changes, any review of that field is reset to unreviewed (a
--     correction stays, as an unapproved proposal), the row says the answer changed and from what, and
--     the change is written to advisor_review_events.
--   * review_submission_field takes the answer the advisor was looking at and refuses when the intake
--     now says something else.
--   * record_manuscript_version takes the certification the PDF was built from and refuses when the
--     intake has been certified again since.
-- Reviews recorded before this migration were not checked against the answers they were made on.
--
-- Every "this changed since your page loaded" refusal is SQLSTATE PT409, which PostgREST answers as
-- HTTP 409. It was 40001 (serialization_failure) in record_manuscript_version, but PostgREST retries a
-- transaction that fails with 40001 or 40P01, and a refusal that fails the same way every time is retried
-- until the client gives up: the request hung instead of saying why. Don't raise either code here.

-- ---------- The answers an advisor sees ----------

-- The certified snapshot while the intake is certified, otherwise the live answers. This is the copy
-- the advisor's detail page shows and builds the Manuscript from (src/lib/advisorApi.ts loadSubmission).
CREATE OR REPLACE FUNCTION public.advisor_visible_answers(p_status text, p_submission jsonb, p_chamber_data jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'submitted'
     AND jsonb_typeof(p_submission) = 'object'
     AND btrim(COALESCE(p_submission ->> 'signer_name', '')) <> ''
     AND p_submission ? 'chamber_data'
    THEN p_submission -> 'chamber_data'
    ELSE p_chamber_data
  END;
$$;

REVOKE ALL ON FUNCTION public.advisor_visible_answers(text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------- Reviews remember that their answer changed ----------

ALTER TABLE public.advisor_field_reviews
  -- Set when the prospect changes the answer after it was reviewed; cleared by the advisor's next review.
  ADD COLUMN answer_changed_at timestamptz,
  -- The answer as it was when it was reviewed (null when there was none).
  ADD COLUMN answer_changed_from jsonb;

ALTER TABLE public.advisor_review_events
  -- 'advisor': an advisor's review. 'answer_changed': the prospect changed a reviewed answer, so its review was reset.
  ADD COLUMN cause text NOT NULL DEFAULT 'advisor' CHECK (cause IN ('advisor', 'answer_changed')),
  ADD COLUMN answer_from jsonb,
  ADD COLUMN answer_to jsonb;

-- A reset is made by whoever changed the answer: the prospect, or nobody (a service-role write).
ALTER TABLE public.advisor_review_events ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE public.advisor_review_events
  ADD CONSTRAINT advisor_review_events_advisor_actor CHECK (cause <> 'advisor' OR actor_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.reset_reviews_on_answer_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  before_answers jsonb := public.advisor_visible_answers(OLD.status, OLD.submission, OLD.chamber_data);
  after_answers jsonb := public.advisor_visible_answers(NEW.status, NEW.submission, NEW.chamber_data);
  r public.advisor_field_reviews;
BEGIN
  IF before_answers IS NOT DISTINCT FROM after_answers THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT * FROM public.advisor_field_reviews
    WHERE session_id = NEW.id
      AND (review_state IS NOT NULL OR has_correction)
      AND (before_answers -> field) IS DISTINCT FROM (after_answers -> field)
    ORDER BY field
    FOR UPDATE
  LOOP
    UPDATE public.advisor_field_reviews
    SET review_state = NULL,
        -- Keep the answer the advisor actually reviewed, however many times it has changed since.
        answer_changed_from = CASE WHEN r.answer_changed_at IS NULL THEN before_answers -> r.field ELSE r.answer_changed_from END,
        answer_changed_at = now()
    WHERE session_id = r.session_id AND field = r.field;

    INSERT INTO public.advisor_review_events
      (session_id, field, from_state, to_state, correction_changed, from_value, to_value,
       had_correction, has_correction, reason, actor_id, actor_email, cause, answer_from, answer_to)
    VALUES
      (r.session_id, r.field, r.review_state, NULL, false, r.corrected_value, r.corrected_value,
       r.has_correction, r.has_correction, NULL, auth.uid(),
       CASE WHEN auth.uid() IS NOT NULL THEN auth.jwt() ->> 'email' END,
       'answer_changed', before_answers -> r.field, after_answers -> r.field);
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_reviews_on_answer_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_sessions_reset_changed_reviews
  AFTER UPDATE ON public.chamber_sessions
  FOR EACH ROW
  WHEN (OLD.chamber_data IS DISTINCT FROM NEW.chamber_data
        OR OLD.submission IS DISTINCT FROM NEW.submission
        OR OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.reset_reviews_on_answer_change();

-- ---------- Reviewing the answer the advisor saw ----------

-- Unchanged from 20261029091000_census_advisor_review.sql except:
--   * p_answer is the answer the advisor was looking at, as {"value": <answer>} ({} when there was
--     none). The review is refused (PT409) when the intake now says something else. Null skips the
--     check, for a page loaded before this migration.
--   * The intake row is locked for the check, so a prospect's change can't land between the check
--     and the review (their change then waits, and resets this review when it does land).
--   * Reviewing clears the "answer changed" mark.
DROP FUNCTION public.review_submission_field(uuid, text, text, text, jsonb, text);

CREATE FUNCTION public.review_submission_field(
  p_session_id uuid,
  p_field text,
  p_review_state text,
  p_correction text DEFAULT 'keep',
  p_value jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_answer jsonb DEFAULT NULL
)
RETURNS public.advisor_field_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.chamber_sessions;
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
  IF p_answer IS NOT NULL AND jsonb_typeof(p_answer) <> 'object' THEN
    RAISE EXCEPTION 'The answer reviewed must be given as {"value": ...}' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_answer IS NOT NULL
     AND (p_answer -> 'value') IS DISTINCT FROM (public.advisor_visible_answers(s.status, s.submission, s.chamber_data) -> p_field) THEN
    RAISE EXCEPTION 'The prospect changed this answer after the page was loaded; review the current answer'
      USING ERRCODE = 'PT409';
  END IF;

  SELECT * INTO prev FROM public.advisor_field_reviews
  WHERE session_id = p_session_id AND field = p_field FOR UPDATE;

  next_has := CASE p_correction WHEN 'set' THEN true WHEN 'clear' THEN false ELSE COALESCE(prev.has_correction, false) END;
  next_value := CASE p_correction WHEN 'set' THEN p_value WHEN 'clear' THEN NULL ELSE prev.corrected_value END;

  INSERT INTO public.advisor_field_reviews AS r
    (session_id, field, review_state, has_correction, corrected_value, reason, updated_by, updated_by_email, updated_at,
     answer_changed_at, answer_changed_from)
  VALUES
    (p_session_id, p_field, p_review_state, next_has, next_value,
     CASE WHEN p_correction = 'keep' THEN COALESCE(clean_reason, prev.reason) ELSE clean_reason END,
     auth.uid(), auth.jwt() ->> 'email', now(), NULL, NULL)
  ON CONFLICT (session_id, field) DO UPDATE SET
    review_state = EXCLUDED.review_state,
    has_correction = EXCLUDED.has_correction,
    corrected_value = EXCLUDED.corrected_value,
    reason = EXCLUDED.reason,
    updated_by = EXCLUDED.updated_by,
    updated_by_email = EXCLUDED.updated_by_email,
    updated_at = EXCLUDED.updated_at,
    answer_changed_at = NULL,
    answer_changed_from = NULL
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

REVOKE ALL ON FUNCTION public.review_submission_field(uuid, text, text, text, jsonb, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_submission_field(uuid, text, text, text, jsonb, text, jsonb) TO authenticated;

-- ---------- Manuscript versions name the certification they were built from ----------

-- Unchanged from 20261022090000_advisor_operations.sql except:
--   * p_certified_data_hash and p_certified_at identify the certification the PDF was built from (the
--     snapshot's data_sha256 and certified_at, both stamped by the database). The version is refused
--     (PT409) when the intake has been certified again since. They are required: a client that can't
--     say what it built from can't record a version.
--   * Its refusals for a review or version that moved on are PT409, not 40001 (see the top of this file).
--   * The intake row is locked while the version is recorded, so a re-certification can't land between
--     the check and the insert.
DROP FUNCTION public.record_manuscript_version(uuid, integer, text, text, bigint, integer, boolean);

CREATE FUNCTION public.record_manuscript_version(
  p_session_id uuid,
  p_version integer,
  p_storage_path text,
  p_pdf_sha256 text,
  p_review_event_id bigint,
  p_corrections_applied integer,
  p_sensitive_revealed boolean,
  p_certified_data_hash text,
  p_certified_at timestamptz
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

  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF s.status IS DISTINCT FROM 'submitted' OR s.submission IS NULL THEN
    RAISE EXCEPTION 'Only a certified intake can become a Manuscript' USING ERRCODE = '23514';
  END IF;
  IF p_certified_data_hash IS DISTINCT FROM (s.submission ->> 'data_sha256')
     OR p_certified_at IS DISTINCT FROM (s.submission ->> 'certified_at')::timestamptz THEN
    RAISE EXCEPTION 'The prospect certified their intake again while this Manuscript was being generated; generate it again'
      USING ERRCODE = 'PT409';
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
      USING ERRCODE = 'PT409';
  END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO next_version FROM public.manuscript_versions WHERE session_id = p_session_id;
  IF p_version IS DISTINCT FROM next_version THEN
    RAISE EXCEPTION 'Another version was generated meanwhile; generate it again' USING ERRCODE = 'PT409';
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

REVOKE ALL ON FUNCTION public.record_manuscript_version(uuid, integer, text, text, bigint, integer, boolean, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manuscript_version(uuid, integer, text, text, bigint, integer, boolean, text, timestamptz) TO authenticated;
