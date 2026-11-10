-- Learning from what PEOs send back (joshrkay/Nevermore#88).
--
-- * Three milestones join the funnel: the first send of the packet to a PEO, the first quote, and won. Like the
--   others they hold no content, are kept a year and outlive a deleted intake. advisor_intake_funnel() times them from
--   certification (measured_from 'certification'), so how fast PEOs answer isn't blurred by the prospect's own pace;
--   the other steps keep timing from the start. advisor_intake_sources() counts them per source too.
-- * A decline reason, required when a quote request is declined and refused otherwise (is_decline_reason()).
-- * A lost reason, required to move a submission to lost and refused otherwise, kept in the status history
--   (is_lost_reason()). No prospect-facing function returns it.
-- * An underwriter's question can name the answers it is about (quote_request_events.fields).
-- * advisor_peo_outcomes(), advisor_lost_reasons() and advisor_question_fields(): what the funnel page counts, for
--   advisors only, computed from what exists (a deleted intake drops out).
--
-- Deploy this migration before the front end that sends a decline or lost reason: the older front end can still do
-- everything else, but marking a request declined or a submission lost now needs the reason it doesn't send.

SET lock_timeout = '5s';

-- ---------- The funnel's market steps ----------
ALTER TABLE public.intake_milestones DROP CONSTRAINT IF EXISTS intake_milestones_milestone_check;
ALTER TABLE public.intake_milestones ADD CONSTRAINT intake_milestones_milestone_check CHECK (milestone IN (
  -- sync:begin intake_milestones
  'started', 'answered', 'document_uploaded', 'census_provided', 'ready_to_certify', 'email_verified', 'certified', 'manuscript_downloaded',
  'sent_to_peo', 'first_quote', 'won'
  -- sync:end intake_milestones
));

-- The first send of the packet to a PEO, dated by the send, and the first quote. A failure never stops the send it records.
CREATE OR REPLACE FUNCTION public.track_quote_request_milestones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.note_intake_milestone(NEW.session_id, 'sent_to_peo', NEW.sent_on::timestamptz);
    END IF;
    -- The first quote, dated by the day it arrived (or now, when that isn't recorded).
    IF NEW.status = 'quoted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'quoted') THEN
      PERFORM public.note_intake_milestone(NEW.session_id, 'first_quote', COALESCE(NEW.quote_received_on::timestamptz, now()));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'intake milestones: quote request % not recorded (%)', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.track_quote_request_milestones() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER track_quote_request_milestones
  AFTER INSERT OR UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.track_quote_request_milestones();

-- A submission marked won. A failure never stops the move it records.
CREATE OR REPLACE FUNCTION public.track_won_milestone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'won' AND OLD.status IS DISTINCT FROM 'won' THEN
      PERFORM public.note_intake_milestone(NEW.session_id, 'won');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'intake milestones: won not recorded for % (%)', NEW.session_id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.track_won_milestone() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER track_won_milestone
  AFTER UPDATE OF status ON public.submission_workflow
  FOR EACH ROW EXECUTE FUNCTION public.track_won_milestone();

-- As in 20261105092000_intake_milestones.sql, plus the market steps (sent to a PEO, first quote, won) and which clock
-- each step's median uses: the market steps are timed from certification, so how fast PEOs answer isn't blurred by
-- how long the prospect took to finish; the others from the start, as before. Recorded times only.
DROP FUNCTION IF EXISTS public.advisor_intake_funnel(timestamptz, timestamptz);
CREATE FUNCTION public.advisor_intake_funnel(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (step integer, milestone text, intakes bigint, median_minutes numeric, measured_from text)
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
           round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM m.reached_at - COALESCE(c.reached_at, m.started_at)) / 60)
                  FILTER (WHERE NOT m.backfilled AND (k.clock = 'start' OR c.reached_at IS NOT NULL)))::numeric, 1),
           k.clock
    FROM unnest(ARRAY[
      'started', 'answered', 'document_uploaded', 'census_provided', 'ready_to_certify', 'email_verified', 'certified', 'manuscript_downloaded',
      'sent_to_peo', 'first_quote', 'won'
    ]) WITH ORDINALITY AS s(name, ord)
    CROSS JOIN LATERAL (
      SELECT CASE WHEN s.name IN ('sent_to_peo', 'first_quote', 'won') THEN 'certification' ELSE 'start' END AS clock
    ) k(clock)
    LEFT JOIN public.intake_milestones m
      ON m.milestone = s.name AND m.started_at >= p_from AND m.started_at < p_to
    -- The certification each market step is timed from (the intake's first, recorded once).
    LEFT JOIN public.intake_milestones c
      ON k.clock = 'certification' AND c.session_id = m.session_id AND c.milestone = 'certified' AND NOT c.backfilled
    GROUP BY s.ord, s.name, k.clock
    ORDER BY s.ord;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_intake_funnel(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_intake_funnel(timestamptz, timestamptz) TO authenticated;

-- As in 20261106100000_intake_sources.sql, plus the market steps, so a source's intakes can be followed to a quote.
DROP FUNCTION IF EXISTS public.advisor_intake_sources(timestamptz, timestamptz);
CREATE FUNCTION public.advisor_intake_sources(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  referral_code text,
  partner_name text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  started bigint,
  answered bigint,
  document_uploaded bigint,
  census_provided bigint,
  ready_to_certify bigint,
  email_verified bigint,
  certified bigint,
  manuscript_downloaded bigint,
  sent_to_peo bigint,
  first_quote bigint,
  won bigint
)
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
    SELECT m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign,
           count(*) FILTER (WHERE m.milestone = 'started'),
           count(*) FILTER (WHERE m.milestone = 'answered'),
           count(*) FILTER (WHERE m.milestone = 'document_uploaded'),
           count(*) FILTER (WHERE m.milestone = 'census_provided'),
           count(*) FILTER (WHERE m.milestone = 'ready_to_certify'),
           count(*) FILTER (WHERE m.milestone = 'email_verified'),
           count(*) FILTER (WHERE m.milestone = 'certified'),
           count(*) FILTER (WHERE m.milestone = 'manuscript_downloaded'),
           count(*) FILTER (WHERE m.milestone = 'sent_to_peo'),
           count(*) FILTER (WHERE m.milestone = 'first_quote'),
           count(*) FILTER (WHERE m.milestone = 'won')
    FROM public.intake_milestones m
    LEFT JOIN public.referral_partners p ON p.code = m.referral_code
    WHERE m.started_at >= p_from AND m.started_at < p_to
    GROUP BY m.referral_code, p.name, m.utm_source, m.utm_medium, m.utm_campaign
    ORDER BY count(*) FILTER (WHERE m.milestone = 'started') DESC,
             m.referral_code NULLS LAST, m.utm_source NULLS LAST, m.utm_medium NULLS LAST, m.utm_campaign NULLS LAST
    LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_intake_sources(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_intake_sources(timestamptz, timestamptz) TO authenticated;

-- ---------- Decline reasons ----------
-- Why a PEO declined, from a short list (DECLINE_REASONS in src/data/quoteRequests.ts; schemaSync compares them).
-- Required when a quote request is declined and refused otherwise; logged like any change. A decline never edits a
-- PEO's eligibility facts, which come only from the PEO's own materials.
CREATE OR REPLACE FUNCTION public.is_decline_reason(p_reason text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_reason IN (
    -- sync:begin decline_reasons
    'below_minimum_headcount', 'state_not_served', 'class_code_excluded', 'claims_history', 'incomplete_information', 'other'
    -- sync:end decline_reasons
  );
$$;

ALTER TABLE public.quote_requests ADD COLUMN decline_reason text
  CHECK (decline_reason IS NULL OR (status = 'declined' AND public.is_decline_reason(decline_reason)));

-- As in 20261110090000_quote_requests.sql, plus the decline reason.
DROP FUNCTION IF EXISTS public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text);
CREATE FUNCTION public.advisor_update_quote_request(
  p_quote_request_id bigint, p_status text, p_received_on date DEFAULT NULL, p_expires_on date DEFAULT NULL,
  p_start_on date DEFAULT NULL, p_admin_fee_pepm numeric DEFAULT NULL, p_note text DEFAULT NULL,
  p_decline_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  req public.quote_requests;
BEGIN
  PERFORM public.require_advisor();
  IF p_status IS NULL OR p_status NOT IN ('quoted', 'declined', 'closed') THEN
    RAISE EXCEPTION 'A PEO''s answer is quoted, declined or closed, not %. Record a send to send it again', COALESCE(p_status, 'nothing')
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  IF char_length(btrim(COALESCE(p_note, ''))) > 2000 THEN
    RAISE EXCEPTION 'A note is limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_admin_fee_pepm < 0 OR p_admin_fee_pepm > 100000 THEN
    RAISE EXCEPTION 'The admin fee is per employee per month, from 0 to 100000' USING ERRCODE = '22023';
  END IF;
  IF req.status = 'closed' AND p_status <> 'closed' THEN
    RAISE EXCEPTION 'This quote request is closed. Record a send to % to reopen it', req.peo_name USING ERRCODE = '22023';
  END IF;
  IF p_status <> 'quoted' AND (p_received_on, p_expires_on, p_start_on, p_admin_fee_pepm) IS DISTINCT FROM (NULL::date, NULL::date, NULL::date, NULL::numeric) THEN
    RAISE EXCEPTION 'Only a quote has dates and a fee. Mark it quoted, or leave them empty' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'declined' AND p_decline_reason IS NULL THEN
    RAISE EXCEPTION 'Say why the PEO declined' USING ERRCODE = '22023';
  END IF;
  IF p_status <> 'declined' AND p_decline_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Only a decline has a decline reason' USING ERRCODE = '22023';
  END IF;
  IF p_decline_reason IS NOT NULL AND NOT public.is_decline_reason(p_decline_reason) THEN
    RAISE EXCEPTION 'Not a decline reason: %', p_decline_reason USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_requests
  SET status = p_status,
      decline_reason = p_decline_reason,
      quote_received_on = p_received_on,
      quote_expires_on = p_expires_on,
      proposed_start_on = p_start_on,
      admin_fee_pepm = p_admin_fee_pepm,
      note = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_quote_request_id
  RETURNING * INTO req;
  RETURN to_jsonb(req);
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text, text) TO authenticated;

-- ---------- Lost reasons ----------
-- Why a submission's search ended without a quote taken, from a short list (LOST_REASONS in src/data/advisor.ts;
-- schemaSync compares them). Required to move to lost and refused for any other move; kept in the status history,
-- which nothing can change. No prospect-facing function returns it.
CREATE OR REPLACE FUNCTION public.is_lost_reason(p_reason text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_reason IN (
    -- sync:begin lost_reasons
    'stayed_with_current', 'chose_to_wait', 'cost', 'went_elsewhere', 'other'
    -- sync:end lost_reasons
  );
$$;

ALTER TABLE public.submission_status_history ADD COLUMN lost_reason text
  CHECK (lost_reason IS NULL OR (to_status = 'lost' AND public.is_lost_reason(lost_reason)));

-- As in 20261110090000_quote_requests.sql, plus the lost reason.
DROP FUNCTION IF EXISTS public.set_submission_status(uuid, text, text, bigint);
CREATE FUNCTION public.set_submission_status(
  p_session_id uuid, p_status text, p_note text DEFAULT NULL, p_won_quote_request_id bigint DEFAULT NULL,
  p_lost_reason text DEFAULT NULL)
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
  IF p_status = 'lost' AND p_lost_reason IS NULL THEN
    RAISE EXCEPTION 'Say why the search was lost' USING ERRCODE = '22023';
  END IF;
  IF p_status <> 'lost' AND p_lost_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Only a lost submission has a lost reason' USING ERRCODE = '22023';
  END IF;
  IF p_lost_reason IS NOT NULL AND NOT public.is_lost_reason(p_lost_reason) THEN
    RAISE EXCEPTION 'Not a lost reason: %', p_lost_reason USING ERRCODE = '22023';
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
  IF p_status = 'won' AND NOT EXISTS (
    SELECT 1 FROM public.quote_requests q
    WHERE q.id = p_won_quote_request_id AND q.session_id = p_session_id AND q.status = 'quoted'
  ) THEN
    RAISE EXCEPTION 'To mark this won, name which of this submission''s quotes the employer took' USING ERRCODE = '22023';
  END IF;
  previous := current_row.status;

  UPDATE public.submission_workflow
  SET status = p_status, updated_at = now(), updated_by = auth.uid(),
      won_quote_request_id = CASE WHEN p_status = 'won' THEN p_won_quote_request_id ELSE won_quote_request_id END
  WHERE session_id = p_session_id
  RETURNING * INTO current_row;

  -- A submission that is won, lost or archived waits on no PEO: close every quote request still open, except the
  -- winner. A decline stays a decline.
  IF p_status IN ('won', 'lost', 'archived') THEN
    UPDATE public.quote_requests
    SET status = 'closed'
    WHERE session_id = p_session_id AND status IN ('sent', 'quoted')
      AND id IS DISTINCT FROM current_row.won_quote_request_id;
  END IF;

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email, lost_reason)
  VALUES (p_session_id, previous, p_status, clean_note, auth.uid(), auth.jwt() ->> 'email', p_lost_reason);
  RETURN current_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_submission_status(uuid, text, text, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_submission_status(uuid, text, text, bigint, text) TO authenticated;

-- ---------- Underwriters' questions, tagged ----------
-- The answers an underwriter's question is about, optional, so the most-asked fields can be counted.
ALTER TABLE public.quote_request_events ADD COLUMN fields text[] CHECK (fields IS NULL OR cardinality(fields) <= 40);

-- As in 20261110090000_quote_requests.sql, plus the fields.
DROP FUNCTION IF EXISTS public.advisor_note_underwriter_question(bigint, text);
CREATE FUNCTION public.advisor_note_underwriter_question(p_quote_request_id bigint, p_question text, p_fields text[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  req public.quote_requests;
  question text := btrim(COALESCE(p_question, ''));
  ev public.quote_request_events;
  clean_fields text[];
  unknown_fields text;
BEGIN
  PERFORM public.require_advisor();
  IF question = '' THEN
    RAISE EXCEPTION 'Write the underwriter''s question' USING ERRCODE = '22023';
  END IF;
  IF char_length(question) > 2000 THEN
    RAISE EXCEPTION 'A question is limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  -- The answers it is about, as an information request names them: reviewable fields, the census under either name,
  -- each once in the order given.
  SELECT string_agg(DISTINCT f, ', ') INTO unknown_fields
  FROM unnest(COALESCE(p_fields, '{}'::text[])) AS f
  WHERE f IS NULL OR NOT public.is_reviewable_field(f);
  IF unknown_fields IS NOT NULL OR array_position(COALESCE(p_fields, '{}'::text[]), NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Not a field an underwriter can ask about: %', COALESCE(unknown_fields, 'an empty name') USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg(x.field ORDER BY x.first_at), '{}'::text[]) INTO clean_fields
  FROM (
    SELECT CASE WHEN u.f = 'employees' THEN 'census' ELSE u.f END AS field, min(u.ord) AS first_at
    FROM unnest(COALESCE(p_fields, '{}'::text[])) WITH ORDINALITY AS u(f, ord)
    GROUP BY 1
  ) x;
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value, fields, changed_by, changed_by_email)
  VALUES (req.id, req.session_id, 'underwriter_question', question, clean_fields, auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO ev;
  RETURN to_jsonb(ev);
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_note_underwriter_question(bigint, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_note_underwriter_question(bigint, text, text[]) TO authenticated;

-- ---------- What the funnel page counts ----------

-- For intakes started in [p_from, p_to): each PEO a quote request went to (names compared ignoring case),
-- alphabetically, with how many requests were sent, how many ever quoted, how many are declined (and why), the
-- median days from the send to the quote arriving, and how many won. Computed from the quote requests that exist, so a
-- deleted intake drops out. At most a year at once.
CREATE OR REPLACE FUNCTION public.advisor_peo_outcomes(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (peo_name text, sent bigint, quoted bigint, declined bigint, decline_reasons jsonb, median_days_to_quote numeric, won bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    WITH r AS (
      SELECT q.*,
             -- Ever quoted: a quote later closed (the employer went elsewhere) still came back.
             EXISTS (SELECT 1 FROM public.quote_request_events e
                     WHERE e.quote_request_id = q.id AND e.field = 'status' AND e.new_value = 'quoted') AS ever_quoted,
             EXISTS (SELECT 1 FROM public.submission_workflow w WHERE w.won_quote_request_id = q.id) AS is_winner
      FROM public.quote_requests q
      JOIN public.chamber_sessions s ON s.id = q.session_id
      WHERE s.created_at >= p_from AND s.created_at < p_to
    )
    SELECT min(r.peo_name),
           count(*),
           count(*) FILTER (WHERE r.ever_quoted),
           count(*) FILTER (WHERE r.status = 'declined'),
           COALESCE((SELECT jsonb_object_agg(d.reason, d.n) FROM (
             SELECT r2.decline_reason AS reason, count(*) AS n FROM r r2
             WHERE lower(r2.peo_name) = lower(min(r.peo_name)) AND r2.status = 'declined' GROUP BY r2.decline_reason
           ) d WHERE d.reason IS NOT NULL), '{}'::jsonb),
           (percentile_cont(0.5) WITHIN GROUP (ORDER BY r.quote_received_on - r.sent_on)
              FILTER (WHERE r.quote_received_on IS NOT NULL AND r.sent_on IS NOT NULL))::numeric,
           count(*) FILTER (WHERE r.is_winner)
    FROM r
    GROUP BY lower(r.peo_name)
    ORDER BY lower(r.peo_name);
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_peo_outcomes(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_peo_outcomes(timestamptz, timestamptz) TO authenticated;

-- For intakes started in [p_from, p_to) whose pipeline is lost now: how many by their latest lost reason, most first.
CREATE OR REPLACE FUNCTION public.advisor_lost_reasons(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (reason text, submissions bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    SELECT latest.lost_reason, count(*)
    FROM public.chamber_sessions s
    JOIN public.submission_workflow w ON w.session_id = s.id AND w.status = 'lost'
    CROSS JOIN LATERAL (
      SELECT h.lost_reason FROM public.submission_status_history h
      WHERE h.session_id = s.id AND h.to_status = 'lost' ORDER BY h.id DESC LIMIT 1
    ) latest
    WHERE s.created_at >= p_from AND s.created_at < p_to AND latest.lost_reason IS NOT NULL
    GROUP BY latest.lost_reason
    ORDER BY count(*) DESC, latest.lost_reason;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_lost_reasons(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_lost_reasons(timestamptz, timestamptz) TO authenticated;

-- For intakes started in [p_from, p_to): each field underwriters' questions were tagged with, most asked first, and on
-- every row how many questions there were and how many were tagged. Moving a field up Lenore's ask order stays a
-- reviewed change to the intake schema; nothing here reranks anything.
CREATE OR REPLACE FUNCTION public.advisor_question_fields(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (field text, questions bigint, total_questions bigint, tagged_questions bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    WITH asked AS (
      SELECT e.id, COALESCE(e.fields, '{}'::text[]) AS fields
      FROM public.quote_request_events e
      JOIN public.chamber_sessions s ON s.id = e.session_id
      WHERE e.field = 'underwriter_question' AND s.created_at >= p_from AND s.created_at < p_to
    ),
    totals AS (
      SELECT count(*) AS total, count(*) FILTER (WHERE cardinality(fields) > 0) AS tagged FROM asked
    )
    SELECT f.field, count(*), t.total, t.tagged
    FROM asked a
    CROSS JOIN LATERAL unnest(a.fields) AS f(field)
    CROSS JOIN totals t
    GROUP BY f.field, t.total, t.tagged
    ORDER BY count(*) DESC, f.field;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_question_fields(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_question_fields(timestamptz, timestamptz) TO authenticated;

RESET lock_timeout;
