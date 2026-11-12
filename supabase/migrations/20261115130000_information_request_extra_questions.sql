-- An advisor's information request can name a PEO's own extra questions (joshrkay/Nevermore#91, L-2.3).
--
-- The intake asks the extra questions of the PEO the prospect chose. Another PEO's are asked only when an advisor's
-- information request names them ("What each PEO still needs" drafts a request with that PEO's unanswered ones).
-- information_requests.extra_questions holds them: [{ peo_id, key, question }], each a question of that listed PEO's
-- profile in use, by its key and as worded when it was asked (a reworded question is a new one), each once, at most
-- 60. advisor_request_information() takes them as p_extra_questions and refuses (22023) any other; the request is
-- still append-only. prospect_information_request() gives them to the prospect with the rest of the request, so The
-- Chamber shows that PEO's questions marked "Your advisor asked about this" and Lenore asks them.
--
-- The email is unchanged: it carries the fields' labels and never a PEO's questions, so it names no PEO.
--
-- Deploy this migration before the front end that sends p_extra_questions. The old front end keeps working: the
-- 3-argument call still matches, with no questions.

SET lock_timeout = '5s';

ALTER TABLE public.information_requests
  ADD COLUMN IF NOT EXISTS extra_questions jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(extra_questions) = 'array' AND jsonb_array_length(extra_questions) <= 60);

COMMENT ON COLUMN public.information_requests.extra_questions IS
  'The PEOs'' own extra questions the request names: [{ peo_id, key, question }], as worded when asked.';

-- ---------- Asking ----------

-- As in 20261105090000_information_requests.sql, plus p_extra_questions (above).
DROP FUNCTION public.advisor_request_information(uuid, text, text[]);

CREATE FUNCTION public.advisor_request_information(p_session_id uuid, p_message text, p_fields text[] DEFAULT '{}', p_extra_questions jsonb DEFAULT '[]')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.chamber_sessions;
  w public.submission_workflow;
  clean_message text := btrim(COALESCE(p_message, ''));
  clean_fields text[];
  unknown_fields text;
  recipient text;
  contact text;
  company text;
  req public.information_requests;
  questions jsonb := COALESCE(p_extra_questions, '[]'::jsonb);
  q jsonb;
BEGIN
  PERFORM public.require_advisor();

  IF clean_message = '' THEN
    RAISE EXCEPTION 'Write what you need from the prospect' USING ERRCODE = '22023';
  END IF;
  IF char_length(clean_message) > 1000 THEN
    RAISE EXCEPTION 'A request is limited to 1000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT string_agg(DISTINCT f, ', ') INTO unknown_fields
  FROM unnest(COALESCE(p_fields, '{}'::text[])) AS f
  WHERE f IS NULL OR NOT public.is_reviewable_field(f);
  IF unknown_fields IS NOT NULL OR array_position(COALESCE(p_fields, '{}'::text[]), NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Not a field the prospect can be asked about: %', COALESCE(unknown_fields, 'an empty name') USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(x.field ORDER BY x.first_at), '{}'::text[]) INTO clean_fields
  FROM (
    SELECT CASE WHEN u.f = 'employees' THEN 'census' ELSE u.f END AS field, min(u.ord) AS first_at
    FROM unnest(COALESCE(p_fields, '{}'::text[])) WITH ORDINALITY AS u(f, ord)
    GROUP BY 1
  ) x;
  IF cardinality(clean_fields) > 40 THEN
    RAISE EXCEPTION 'A request can name at most 40 fields' USING ERRCODE = '22023';
  END IF;

  -- The PEOs' own questions it names: each a question of a listed PEO's profile in use, by its key and as worded.
  IF jsonb_typeof(questions) <> 'array' THEN
    RAISE EXCEPTION 'A request names a PEO''s questions as a list' USING ERRCODE = '22023';
  END IF;
  -- sync:begin request_max_extra_questions
  IF jsonb_array_length(questions) > 60 THEN
  -- sync:end request_max_extra_questions
    RAISE EXCEPTION 'A request can name at most 60 of the PEOs'' own questions' USING ERRCODE = '22023';
  END IF;
  FOR q IN SELECT x FROM jsonb_array_elements(questions) x LOOP
    IF jsonb_typeof(q) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(q) k WHERE k NOT IN ('peo_id', 'key', 'question'))
       OR jsonb_typeof(q -> 'peo_id') IS DISTINCT FROM 'number' OR jsonb_typeof(q -> 'key') IS DISTINCT FROM 'string'
       OR jsonb_typeof(q -> 'question') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Each of a PEO''s questions is named by the PEO, its key and its wording' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.peos p
      CROSS JOIN LATERAL (
        SELECT v.extra_questions FROM public.peo_profile_versions v
        WHERE v.peo_id = p.id AND v.status = 'published' ORDER BY v.version DESC LIMIT 1
      ) in_use
      CROSS JOIN LATERAL jsonb_array_elements(in_use.extra_questions) asked
      WHERE p.id = (q ->> 'peo_id')::numeric AND p.listed
        AND asked ->> 'key' = q ->> 'key' AND asked ->> 'text' = q ->> 'question'
    ) THEN
      RAISE EXCEPTION 'Not a question that PEO''s profile asks, as worded: %', q ->> 'question' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  -- The PEO compared as a number, so 5 and 5.0 are the same PEO.
  IF (SELECT count(*) FROM jsonb_array_elements(questions)) <> (SELECT count(DISTINCT ((x ->> 'peo_id')::numeric, x ->> 'key')) FROM jsonb_array_elements(questions) x) THEN
    RAISE EXCEPTION 'A request names each question once' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO w FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO s FROM public.chamber_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  IF s.status IN ('archived', 'revoked', 'expired') THEN
    RAISE EXCEPTION 'This intake is closed (%), so the prospect can''t answer a request on it', s.status USING ERRCODE = '22023';
  END IF;
  IF NOT public.intake_ever_certified(p_session_id) THEN
    RAISE EXCEPTION 'The prospect hasn''t certified this intake yet, so there is nothing to ask them about' USING ERRCODE = '22023';
  END IF;
  IF w.status <> 'information_requested' AND NOT ('information_requested' = ANY (public.pipeline_next_statuses(w.status))) THEN
    RAISE EXCEPTION 'A submission can''t move from % to information requested', replace(w.status, '_', ' ') USING ERRCODE = '22023';
  END IF;

  SELECT NULLIF(btrim(u.email), '') INTO recipient
  FROM auth.users u
  WHERE u.id = s.user_id AND NOT COALESCE(u.is_anonymous, false);
  IF recipient IS NULL THEN
    RAISE EXCEPTION 'The prospect''s account has no email address to send this to' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.information_requests (session_id, message, fields, extra_questions, requested_by, requested_by_email)
  VALUES (p_session_id, clean_message, clean_fields, questions, auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO req;

  IF w.status <> 'information_requested' THEN
    UPDATE public.submission_workflow
    SET status = 'information_requested', updated_at = now(), updated_by = auth.uid()
    WHERE session_id = p_session_id;
  END IF;
  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (p_session_id, w.status, 'information_requested', left('Asked the prospect: ' || clean_message, 2000), auth.uid(), auth.jwt() ->> 'email');

  SELECT NULLIF(btrim(p.contact_name), '') INTO contact FROM public.profiles p WHERE p.user_id = s.user_id;
  company := NULLIF(btrim(s.chamber_data ->> 'company_name'), '');

  -- Unlike the certification emails, this one is the point of the call: a failure to queue it fails the request. It
  -- carries the fields' labels as before, and never a PEO's questions: the email names no PEO.
  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
  VALUES (
    'information_request', p_session_id, 'request:' || req.id,
    jsonb_build_object(
      'reference', left(COALESCE(NULLIF(btrim(s.file_id), ''), NULLIF(btrim(s.submission ->> 'file_id'), '')), 64),
      'company_name', left(company, 200),
      'recipient_name', left(contact, 200),
      'recipient_email', recipient,
      'message', clean_message,
      'fields', to_jsonb(clean_fields),
      'requested_at', to_char(req.requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  RETURN jsonb_build_object('request_id', req.id, 'from_status', w.status, 'status', 'information_requested');
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_request_information(uuid, text, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_request_information(uuid, text, text[], jsonb) TO authenticated;

-- ---------- What the prospect reads ----------

-- As in 20261105090000_information_requests.sql, with the request's extra questions.
CREATE OR REPLACE FUNCTION public.prospect_information_request(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('message', r.message, 'fields', to_jsonb(r.fields), 'extra_questions', r.extra_questions, 'requested_at', r.requested_at)
  FROM public.information_requests r
  JOIN public.chamber_sessions s ON s.id = r.session_id
  JOIN public.submission_workflow w ON w.session_id = r.session_id
  WHERE r.session_id = p_session_id
    AND s.user_id = auth.uid()
    AND s.status NOT IN ('archived', 'revoked')
    AND w.status = 'information_requested'
  ORDER BY r.id DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.prospect_information_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospect_information_request(uuid) TO authenticated;
