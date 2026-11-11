-- The answers to a PEO's own extra questions (joshrkay/Nevermore#91, L-2.3).
--
-- A requirement profile can ask up to 30 questions of its own (20261111090000). The intake asks them for the PEO the
-- prospect chose, and for another PEO when an advisor's information request names them. Their answers are kept with
-- the intake, beside the answers to its fields, in chamber_sessions.extra_answers:
--
--   { "<peo id>": { "<question key>": { question, kind, value, status, source, updated_at, candidates?, also_heard? } } }
--
-- Each answer carries the question's wording as it was answered and how it is answered (its kind), and the same field
-- status and source as a field's provenance (provenance_entry_status, 20261104103000), so the form and Lenore read and
-- write it the same way. An answer belongs to the question with that key AND that wording: a reworded question is a
-- new question, unanswered until answered, and an answer is never read against different wording (the browser,
-- src/data/extraAnswers.ts). "unknown" and "not applicable" hold no value; every other status holds one of the
-- question's kind (a yes or no, a number, text, or one of its choices).
--
-- They are certified with the rest: certifying copies them into the submission (submission.extra_answers) and into
-- the certification record (chamber_certifications.extra_answers), and changing one after certifying withdraws the
-- certification, as a changed answer does. They are the intake's own data: written by the same versioned save as the
-- answers (the prospect, under the row's own security), read by the prospect and by advisors as the rest of the intake
-- is, and deleted with it. They go only to that PEO: nothing that builds the packet, the emails or an export reads
-- this column.
--
-- Deploy this migration before the front end that reads extra_answers: every load selects the column. An older front
-- end keeps working against it (it never sends the column, and its rows keep {}).

SET lock_timeout = '5s';

ALTER TABLE public.chamber_sessions ADD COLUMN IF NOT EXISTS extra_answers jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.chamber_certifications ADD COLUMN IF NOT EXISTS extra_answers jsonb;

COMMENT ON COLUMN public.chamber_sessions.extra_answers IS
  'Answers to PEOs'' own extra questions, by PEO id then question key, each with the wording answered, its kind, value, field status and source.';
COMMENT ON COLUMN public.chamber_certifications.extra_answers IS
  'The extra answers exactly as certified. Null on a certification recorded before 20261113090000.';

-- ---------- What an answer may hold ----------

-- Whether `v` is an answer of `kind`: a yes or no, a number, text, or a choice.
CREATE OR REPLACE FUNCTION public.extra_answer_value_is_valid(v jsonb, kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(CASE kind
    WHEN 'yes_no' THEN jsonb_typeof(v) = 'boolean'
    -- sync:begin extra_answer_limits
    WHEN 'number' THEN jsonb_typeof(v) = 'number' AND abs((v #>> '{}')::numeric) <= 1000000000000
    WHEN 'text' THEN jsonb_typeof(v) = 'string' AND btrim(v #>> '{}') <> '' AND char_length(v #>> '{}') <= 1000
    WHEN 'choice' THEN jsonb_typeof(v) = 'string' AND btrim(v #>> '{}') <> '' AND char_length(v #>> '{}') <= 100
    -- sync:end extra_answer_limits
    ELSE false
  END, false);
$$;

-- The first thing wrong with a set of extra answers: where (extra_answers, extra_answers.<peo>, or
-- extra_answers.<peo>.<key>) and why. Null path when there is nothing wrong.
CREATE OR REPLACE FUNCTION public.extra_answers_error(p jsonb, OUT path text, OUT reason text)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  -- sync:begin extra_answer_caps
  max_peos constant integer := 50;
  max_answers constant integer := 100;
  max_question constant integer := 500;
  -- sync:end extra_answer_caps
  kinds constant text[] := ARRAY['text', 'yes_no', 'number', 'choice'];
  peo text;
  answers jsonb;
  key text;
  a jsonb;
  status text;
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN
    path := 'extra_answers'; reason := 'must be an object of answers by PEO'; RETURN;
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p)) > max_peos THEN
    path := 'extra_answers'; reason := format('answers at most %s PEOs'' questions', max_peos); RETURN;
  END IF;
  FOR peo, answers IN SELECT * FROM jsonb_each(p) LOOP
    IF peo !~ '^[1-9][0-9]{0,18}$' THEN
      path := 'extra_answers.' || peo; reason := 'is named by the PEO''s id'; RETURN;
    END IF;
    IF jsonb_typeof(answers) <> 'object' THEN
      path := 'extra_answers.' || peo; reason := 'must be an object of answers by question'; RETURN;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(answers)) > max_answers THEN
      path := 'extra_answers.' || peo; reason := format('holds at most %s answers', max_answers); RETURN;
    END IF;
    FOR key, a IN SELECT * FROM jsonb_each(answers) LOOP
      path := 'extra_answers.' || peo || '.' || key;
      -- The same pattern as a question's key in a profile (peo_profile_version_error).
      IF key !~ '^[a-z][a-z0-9_]{0,39}$' THEN reason := 'isn''t a question''s key'; RETURN; END IF;
      IF jsonb_typeof(a) <> 'object'
         OR EXISTS (SELECT 1 FROM jsonb_object_keys(a) k WHERE k NOT IN ('question', 'kind', 'value', 'status', 'source', 'updated_at', 'candidates', 'also_heard')) THEN
        reason := 'holds the question, its kind, the answer and its status and source, and nothing else'; RETURN;
      END IF;
      IF jsonb_typeof(a -> 'question') IS DISTINCT FROM 'string' OR char_length(btrim(a ->> 'question')) NOT BETWEEN 1 AND max_question THEN
        reason := format('keeps the question''s wording, 1 to %s characters', max_question); RETURN;
      END IF;
      IF NOT COALESCE(a ->> 'kind' = ANY (kinds), false) THEN reason := 'is answered as text, yes or no, a number, or a choice'; RETURN; END IF;
      status := public.provenance_entry_status(a);
      IF status IS NULL THEN reason := 'needs a field status, a source and when it was given'; RETURN; END IF;
      IF status IN ('unknown', 'not_applicable') THEN
        IF a ? 'value' THEN reason := 'holds no answer while it is unknown or doesn''t apply'; RETURN; END IF;
      ELSIF NOT public.extra_answer_value_is_valid(a -> 'value', a ->> 'kind') THEN
        reason := 'must be an answer of the question''s kind'; RETURN;
      END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a -> 'candidates') = 'array' THEN a -> 'candidates' ELSE '[]'::jsonb END) c
        WHERE NOT public.extra_answer_value_is_valid(c -> 'value', a ->> 'kind')
      ) THEN
        reason := 'competes only with answers of the question''s kind'; RETURN;
      END IF;
    END LOOP;
  END LOOP;
  path := NULL;
END;
$$;

-- The browser's saves run the validation trigger as the signed-in caller, as chamber_data_error is.
REVOKE ALL ON FUNCTION public.extra_answer_value_is_valid(jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extra_answers_error(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extra_answer_value_is_valid(jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extra_answers_error(jsonb) TO authenticated, service_role;

-- Refuses invalid extra answers, as validate_chamber_data refuses invalid answers (EA001, DETAIL the path), when
-- they change. A row that was already invalid can still be saved in its other columns.
CREATE OR REPLACE FUNCTION public.validate_extra_answers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  failure record;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.extra_answers IS DISTINCT FROM OLD.extra_answers THEN
    -- Far above 50 PEOs' 100 answers each; a cap on what a browser can write (as 20261106090000's S-3).
    IF octet_length(NEW.extra_answers::text) > 2000000 THEN
      RAISE EXCEPTION 'Invalid intake data at extra_answers: too large' USING ERRCODE = 'EA001', DETAIL = 'extra_answers', HINT = 'too large';
    END IF;
    SELECT * INTO failure FROM public.extra_answers_error(NEW.extra_answers);
    IF failure.path IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid intake data at %: %', failure.path, failure.reason
        USING ERRCODE = 'EA001', DETAIL = failure.path, HINT = failure.reason;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_extra_answers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamber_sessions_extra_answers_validate ON public.chamber_sessions;
CREATE TRIGGER chamber_sessions_extra_answers_validate
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_extra_answers();

-- ---------- Certified with the rest ----------

-- Runs after validate_certification and snapshot_certified_evidence (triggers fire in name order), on the same test
-- of "certifying": a certification copies the extra answers into the submission. Otherwise a certified intake whose
-- extra answers change is back in progress, as when an answer changes (validate_certification): the certification no
-- longer covers them. That includes the certification on record sent again over changed extra answers, which
-- validate_certification keeps as it was.
CREATE OR REPLACE FUNCTION public.certify_extra_answers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission) THEN
    NEW.submission := NEW.submission || jsonb_build_object('extra_answers', NEW.extra_answers);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND NEW.status = 'submitted' AND NEW.extra_answers IS DISTINCT FROM OLD.extra_answers THEN
    NEW.status := 'in_progress';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.certify_extra_answers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamber_sessions_certification_validate_extra ON public.chamber_sessions;
CREATE TRIGGER chamber_sessions_certification_validate_extra
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.certify_extra_answers();

-- The certification record keeps them too: record_certification (20261104120000) writes the row from the
-- submission just stamped, and this fills its extra answers from that same submission.
CREATE OR REPLACE FUNCTION public.record_certified_extra_answers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.extra_answers := (SELECT s.submission -> 'extra_answers' FROM public.chamber_sessions s WHERE s.id = NEW.session_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_certified_extra_answers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamber_certifications_extra_answers ON public.chamber_certifications;
CREATE TRIGGER chamber_certifications_extra_answers
  BEFORE INSERT ON public.chamber_certifications
  FOR EACH ROW EXECUTE FUNCTION public.record_certified_extra_answers();
