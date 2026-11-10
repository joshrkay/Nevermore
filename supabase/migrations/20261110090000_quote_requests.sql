-- Quote requests (joshrkay/Nevermore#82, decision D44): which PEOs each submission was sent to and what each
-- answered, and the queue that shows them.
--
-- * public.quote_requests: one per PEO per submission (the PEO's name compared ignoring case). Advisors record a
--   send after doing it outside the product, which sends nothing to a PEO. Status sent, quoted, declined or closed;
--   a quote holds when it arrived and expires, the proposed start, the admin fee per employee per month and a note.
--   The version sent is the submission's latest certification when the send was recorded.
-- * public.quote_request_events: every change to a quote request, column by column (who, when, old, new), written
--   by a trigger so nothing changes one unlogged, and each underwriter's question. Append-only.
-- * advisor_record_quote_send(), advisor_update_quote_request(), advisor_note_underwriter_question(): the only
--   writers. A send is refused before Ready for market; a second send to the same PEO continues its quote request
--   and reopens a closed one.
-- * set_submission_status() gains the winning quote: Won names one of the submission's quotes, kept in
--   submission_workflow.won_quote_request_id; Won, Lost and Archived close the requests still open. The stage is
--   still moved by hand.
-- * advisor_list_submissions() gains what the queue shows (quotes back out of sent, the longest wait, the earliest
--   expiry, an older version sent, the target start), a Waiting on a PEO filter, and two sorts.
-- * complete_intake_deletion() deletes an intake's quote requests and their history with the rest of it.
--
-- Advisors read both tables; prospects read neither, even for their own submission.
--
-- Deploy this migration before the front end that reads quote requests: it selects the new tables and columns and
-- calls the new arguments. The older front end keeps working against it (it calls set_submission_status and
-- advisor_list_submissions with arguments that still exist), except that it can't mark a submission won: that now
-- needs the winning quote.

SET lock_timeout = '5s';

CREATE TABLE public.quote_requests (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL,
  peo_name text NOT NULL,
  status text NOT NULL,
  sent_version integer,
  sent_on date,
  quote_received_on date,
  quote_expires_on date,
  proposed_start_on date,
  admin_fee_pepm numeric(10, 2),
  note text
);

-- Where one PEO's quote request stands (QUOTE_REQUEST_STATUSES in src/data/quoteRequests.ts; schemaSync compares
-- them). A name and a note are trimmed and bounded as the functions write them.
ALTER TABLE public.quote_requests ADD CONSTRAINT quote_requests_status_check CHECK (status IN (
  -- sync:begin quote_request_statuses
  'sent', 'quoted', 'declined', 'closed'
  -- sync:end quote_request_statuses
));
ALTER TABLE public.quote_requests ADD CONSTRAINT quote_requests_text_check CHECK (
  peo_name = btrim(peo_name) AND char_length(peo_name) BETWEEN 1 AND 80
  AND (note IS NULL OR char_length(note) <= 2000)
);

-- One quote request per PEO per submission, whatever the capitalisation.
CREATE UNIQUE INDEX quote_requests_one_per_peo ON public.quote_requests (session_id, lower(peo_name));

CREATE OR REPLACE FUNCTION public.advisor_record_quote_send(p_session_id uuid, p_peo text, p_sent_on date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  req public.quote_requests;
  stage text;
  peo text := btrim(COALESCE(p_peo, ''));
BEGIN
  PERFORM public.require_advisor();
  IF peo = '' THEN
    RAISE EXCEPTION 'Name the PEO the packet went to' USING ERRCODE = '22023';
  END IF;
  -- sync:begin quote_peo_length
  IF char_length(peo) > 80 THEN
  -- sync:end quote_peo_length
    RAISE EXCEPTION 'A PEO name is limited to 80 characters' USING ERRCODE = '22023';
  END IF;
  SELECT w.status INTO stage FROM public.submission_workflow w WHERE w.session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  IF stage NOT IN (
    -- sync:begin quote_sendable_stages
    'ready_for_market', 'sent_to_carrier', 'quoted'
    -- sync:end quote_sendable_stages
  ) THEN
    RAISE EXCEPTION 'Move this submission to Ready for market first. It is %', replace(stage, '_', ' ') USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_version, sent_on)
  VALUES (
    p_session_id, peo, 'sent',
    (SELECT max(c.version) FROM public.chamber_certifications c WHERE c.session_id = p_session_id),
    COALESCE(p_sent_on, current_date)
  )
  ON CONFLICT (session_id, lower(peo_name)) DO UPDATE
    SET sent_version = EXCLUDED.sent_version, sent_on = EXCLUDED.sent_on,
        status = CASE WHEN quote_requests.status = 'closed' THEN 'sent' ELSE quote_requests.status END
  RETURNING * INTO req;
  RETURN to_jsonb(req);
END;
$$;

CREATE TABLE public.quote_request_events (
  id bigserial PRIMARY KEY,
  quote_request_id bigint NOT NULL,
  session_id uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_by_email text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Logs every column a write changed, one row each, old and new as text. A new quote request logs each value it
-- starts with (old_value null). Runs for every write, so no function can change a quote request unlogged.
CREATE OR REPLACE FUNCTION public.log_quote_request_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.quote_request_events (quote_request_id, session_id, field, old_value, new_value, changed_by, changed_by_email)
  SELECT NEW.id, NEW.session_id, n.key, o.value, n.value, auth.uid(), auth.jwt() ->> 'email'
  FROM jsonb_each_text(to_jsonb(NEW)) n
  LEFT JOIN jsonb_each_text(CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END) o ON o.key = n.key
  WHERE n.key NOT IN ('id', 'session_id')
    AND n.value IS DISTINCT FROM o.value
    AND NOT (TG_OP = 'INSERT' AND n.value IS NULL);
  RETURN NULL;
END;
$$;

CREATE TRIGGER quote_requests_log_change
  AFTER INSERT OR UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_quote_request_change();

-- Advisors read both tables; nobody else reads either, the prospect included. Nobody writes them directly: the
-- advisor functions write quote requests, and the trigger above writes the history, which nothing can change.
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_requests, public.quote_request_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quote_requests, public.quote_request_events TO authenticated;

CREATE POLICY quote_requests_advisor_read ON public.quote_requests
  FOR SELECT TO authenticated USING (public.is_advisor());
CREATE POLICY quote_request_events_advisor_read ON public.quote_request_events
  FOR SELECT TO authenticated USING (public.is_advisor());

CREATE TRIGGER quote_request_events_append_only
  BEFORE UPDATE OR DELETE ON public.quote_request_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

CREATE OR REPLACE FUNCTION public.advisor_update_quote_request(
  p_quote_request_id bigint, p_status text, p_received_on date DEFAULT NULL, p_expires_on date DEFAULT NULL,
  p_start_on date DEFAULT NULL, p_admin_fee_pepm numeric DEFAULT NULL, p_note text DEFAULT NULL)
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
  UPDATE public.quote_requests
  SET status = p_status,
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

CREATE OR REPLACE FUNCTION public.advisor_note_underwriter_question(p_quote_request_id bigint, p_question text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  req public.quote_requests;
  question text := btrim(COALESCE(p_question, ''));
  ev public.quote_request_events;
BEGIN
  PERFORM public.require_advisor();
  IF question = '' THEN
    RAISE EXCEPTION 'Write the underwriter''s question' USING ERRCODE = '22023';
  END IF;
  IF char_length(question) > 2000 THEN
    RAISE EXCEPTION 'A question is limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO public.quote_request_events (quote_request_id, session_id, field, new_value, changed_by, changed_by_email)
  VALUES (req.id, req.session_id, 'underwriter_question', question, auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO ev;
  RETURN to_jsonb(ev);
END;
$$;

-- ---------- Won, lost and archived ----------
-- As in 20261104122000_pipeline_transitions.sql, plus the quote the employer took: Won needs the submission's
-- quoted quote request that won.
ALTER TABLE public.submission_workflow ADD COLUMN won_quote_request_id bigint REFERENCES public.quote_requests (id);
COMMENT ON COLUMN public.submission_workflow.won_quote_request_id IS 'The quote request whose quote the employer took, once the submission is won.';

DROP FUNCTION IF EXISTS public.set_submission_status(uuid, text, text);
CREATE FUNCTION public.set_submission_status(
  p_session_id uuid, p_status text, p_note text DEFAULT NULL, p_won_quote_request_id bigint DEFAULT NULL)
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

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (p_session_id, previous, p_status, clean_note, auth.uid(), auth.jwt() ->> 'email');
  RETURN current_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_submission_status(uuid, text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_submission_status(uuid, text, text, bigint) TO authenticated;

-- ---------- The queue ----------
-- As in 20261106090000_hardening.sql, plus what the quote requests say: how many were sent and quoted, how long the
-- oldest has waited, the earliest expiry, whether a PEO has an older version, and the target start; a filter to
-- the submissions waiting on a PEO; and a sort by the longest wait or the earliest expiry.
DROP FUNCTION IF EXISTS public.advisor_list_submissions(text, text, integer, integer, boolean);
CREATE FUNCTION public.advisor_list_submissions(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_needs_action boolean DEFAULT NULL,
  p_waiting boolean DEFAULT NULL,
  p_sort text DEFAULT NULL
)
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
  verified_fields integer,
  -- The certified file id; null until certified (the app derives the same id for drafts).
  file_id text,
  -- Every state named as operating or as a census work state, upper-cased, sorted, distinct.
  states text[],
  -- Whether an advisor marked the submission as needing advisor action, and their note.
  needs_action boolean,
  needs_action_note text,
  -- The quote requests not closed, and how many of them hold a quote.
  quote_requests_sent integer,
  quotes_received integer,
  -- When the longest-waiting quote request was sent; null when none waits.
  oldest_waiting_on date,
  -- The earliest expiry among the quotes held.
  earliest_quote_expires_on date,
  -- An open quote request was sent an older version of the submission than the latest certified.
  sent_older_version boolean,
  -- The prospect's target start, as they wrote it.
  start_month text,
  -- How many intakes match the status, the needs-action filter and the search, before paging.
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  terms text[] := ARRAY(
    SELECT lower(t) FROM regexp_split_to_table(btrim(COALESCE(p_search, '')), '\s+') AS t WHERE t <> ''
  );
BEGIN
  PERFORM public.require_advisor();
  IF p_limit IS NOT NULL AND (p_limit < 1 OR p_limit > 500) THEN
    RAISE EXCEPTION 'A page holds 1 to 500 submissions' USING ERRCODE = '22023';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'The page offset can''t be negative' USING ERRCODE = '22023';
  END IF;
  IF p_sort IS NOT NULL AND p_sort NOT IN ('oldest_waiting', 'earliest_expiry') THEN
    RAISE EXCEPTION 'The queue sorts by oldest_waiting or earliest_expiry, not %', p_sort USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      s.user_id,
      s.status,
      s.created_at,
      s.updated_at,
      s.submission,
      s.file_id,
      -- Who signed: the certification in force, or, once it was withdrawn, the latest on record. Never a
      -- submission the browser wrote (S-1; since 20261106090000 only certifying writes one).
      CASE WHEN snap.used THEN NULLIF(btrim(s.submission ->> 'signer_name'), '')
        ELSE (SELECT NULLIF(btrim(c.signer_name), '') FROM public.chamber_certifications c
               WHERE c.session_id = s.id ORDER BY c.recorded_at DESC, c.id DESC LIMIT 1)
      END AS signer,
      w.status AS pipeline,
      w.needs_action AS action_needed,
      w.needs_action_note AS action_note,
      CASE WHEN s.status = 'submitted' THEN (s.submission ->> 'certified_at')::timestamptz END AS certified_at,
      -- The copy the advisor sees, answers and provenance together: the certified snapshot while
      -- certified, otherwise as it stands. The same test as public.advisor_visible_answers.
      CASE WHEN snap.used THEN s.submission -> 'chamber_data' ELSE s.chamber_data END AS shown,
      CASE WHEN snap.used THEN s.submission -> 'field_provenance' ELSE s.field_provenance END AS prov
    FROM public.chamber_sessions s
    JOIN public.submission_workflow w ON w.session_id = s.id
    LEFT JOIN auth.users u ON u.id = s.user_id
    CROSS JOIN LATERAL (
      SELECT s.status = 'submitted'
         AND jsonb_typeof(s.submission) = 'object'
         AND btrim(COALESCE(s.submission ->> 'signer_name', '')) <> ''
         AND s.submission ? 'chamber_data' AS used
    ) snap
    WHERE (p_status IS NULL OR w.status = p_status)
      AND (p_needs_action IS NULL OR w.needs_action = p_needs_action)
      -- Waiting on a PEO: a quote request sent and not yet answered.
      AND (p_waiting IS NULL OR p_waiting = EXISTS (
        SELECT 1 FROM public.quote_requests q WHERE q.session_id = s.id AND q.status = 'sent'
      ))
      -- Not an empty guest draft (F-2.1): a guest's intake, never certified, that holds nothing the prospect did.
      -- Since A-1 an intake is created only by the prospect's first action, so these are left from before then.
      AND NOT (
        COALESCE(u.is_anonymous, false)
        AND NOT public.intake_ever_certified(s.id)
        AND public.intake_holds_nothing(s.chamber_data, s.field_provenance, s.transcript, s.chosen_peo)
        AND NOT EXISTS (SELECT 1 FROM public.documents doc WHERE doc.session_id = s.id)
      )
  ),
  shaped AS (
    SELECT
      b.*,
      CASE WHEN jsonb_typeof(b.shown) = 'object' THEN b.shown ELSE '{}'::jsonb END AS d,
      CASE WHEN jsonb_typeof(b.prov) = 'object' THEN b.prov ELSE '{}'::jsonb END AS fp,
      p.company_name AS profile_company,
      p.contact_name AS profile_contact
    FROM base b
    LEFT JOIN public.profiles p ON p.user_id = b.user_id
  ),
  described AS (
    SELECT
      x.*,
      -- The census, or the roster an intake saved before the census contract.
      CASE
        WHEN jsonb_typeof(x.d -> 'census') = 'array' THEN x.d -> 'census'
        WHEN jsonb_typeof(x.d -> 'employees') = 'array' THEN x.d -> 'employees'
        ELSE '[]'::jsonb
      END AS roster,
      -- At most 200 characters of each: a page lists up to 500 rows (S-3).
      left(COALESCE(NULLIF(btrim(x.d ->> 'company_name'), ''), NULLIF(btrim(x.profile_company), '')), 200) AS company,
      left(COALESCE(NULLIF(btrim(x.profile_contact), ''), x.signer), 200) AS contact,
      -- The File ID the database assigned (S-1), kept when a certification is withdrawn.
      NULLIF(btrim(x.file_id), '') AS certified_file_id
    FROM shaped x
  ),
  matched AS (
    SELECT r.*
    FROM described r
    -- Every word must appear in the company, the contact or the reference the queue shows (the
    -- certified file id, or the one the app derives for a draft: EAA-<year>-<first 8 hex of the id>).
    WHERE NOT EXISTS (
      SELECT 1 FROM unnest(terms) AS t
      WHERE strpos(
        lower(concat_ws(E'\n', r.company, r.contact, COALESCE(
          r.certified_file_id,
          'EAA-' || extract(year FROM r.created_at AT TIME ZONE 'UTC')::int || '-' || upper(left(replace(r.id::text, '-', ''), 8))
        ))),
        t
      ) = 0
    )
  )
  SELECT
    m.id,
    m.company,
    m.contact,
    CASE WHEN jsonb_typeof(m.d -> 'employee_count') = 'number' THEN (m.d ->> 'employee_count')::numeric::integer END,
    m.pipeline,
    m.status,
    left(m.signer, 200),
    m.certified_at,
    m.created_at,
    m.updated_at,
    -- The required items still missing, in order (public.intake_required_items, 20261104103000: the
    -- recommended census is never one), less any the advisor supplied through a verified correction with
    -- a value, which the advisor's Manuscript shows. A verification alone supplies nothing.
    ARRAY(
      SELECT ri.item ->> 'label'
      FROM jsonb_array_elements(public.intake_required_items(m.d, m.fp, '{}'::text[])) WITH ORDINALITY AS ri(item, ord)
      WHERE ri.item ->> 'state' = 'missing' AND (ri.item ->> 'required')::boolean
        AND NOT public.advisor_supplied(m.id, ri.item ->> 'field')
      ORDER BY ri.ord
    ),
    -- The other open items, as Review and The Manuscript list them (src/data/openItems.ts): reviewable fields whose
    -- status leaves them open, less a required answer still missing (missing_required names it, so one the prospect
    -- doesn't know is one open item, not two), less the census when none is uploaded (a document, which the queue
    -- never lists), and less any field an advisor verified. A field closed as not applicable is never counted.
    -- The census matches a review under either of its names.
    (SELECT count(*)::integer
       FROM jsonb_each(m.fp) f
      WHERE f.value ->> 'status' IN (
          -- sync:begin open_item_statuses
          'conflicting', 'incomplete', 'unknown', 'inferred'
          -- sync:end open_item_statuses
        )
        AND public.is_reviewable_field(f.key)
        AND NOT (f.key IN ('census', 'employees') AND jsonb_array_length(m.roster) = 0)
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(public.intake_required_items(m.d, m.fp, '{}'::text[])) AS ri(item)
          WHERE ri.item ->> 'state' = 'missing' AND (ri.item ->> 'required')::boolean
            AND ri.item ->> 'field' = f.key
            AND NOT public.advisor_supplied(m.id, ri.item ->> 'field')
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.advisor_field_reviews r
          WHERE r.session_id = m.id AND r.review_state = 'verified'
            AND (r.field = f.key OR (r.field IN ('census', 'employees') AND f.key IN ('census', 'employees')))
        )),
    (SELECT count(*)::integer FROM public.advisor_field_reviews r
      WHERE r.session_id = m.id AND r.review_state IN ('incomplete', 'follow_up')),
    (SELECT count(*)::integer FROM public.advisor_field_reviews r
      WHERE r.session_id = m.id AND r.review_state = 'verified'),
    m.certified_file_id,
    ARRAY(
      SELECT DISTINCT upper(btrim(y.st)) AS abbr
      FROM (
        SELECT st FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(m.d -> 'states') = 'array' THEN m.d -> 'states' ELSE '[]'::jsonb END) AS st
        UNION ALL
        SELECT COALESCE(e ->> 'work_state', e ->> 'state') FROM jsonb_array_elements(m.roster) AS e
      ) y
      WHERE btrim(COALESCE(y.st, '')) <> ''
      ORDER BY abbr
    ),
    m.action_needed,
    m.action_note,
    qs.sent,
    qs.received,
    qs.waiting_since,
    qs.expires,
    qs.older,
    left(NULLIF(btrim(m.d ->> 'start_month'), ''), 200),
    count(*) OVER ()
  FROM matched m
  CROSS JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE q.status <> 'closed')::integer AS sent,
      count(*) FILTER (WHERE q.status = 'quoted')::integer AS received,
      min(q.sent_on) FILTER (WHERE q.status = 'sent') AS waiting_since,
      min(q.quote_expires_on) FILTER (WHERE q.status = 'quoted') AS expires,
      COALESCE(bool_or(q.sent_version < (
        SELECT max(c.version) FROM public.chamber_certifications c WHERE c.session_id = m.id
      )) FILTER (WHERE q.status IN ('sent', 'quoted')), false) AS older
    FROM public.quote_requests q
    WHERE q.session_id = m.id
  ) qs
  -- Certified is the intake's status; its date only orders the group. Rows submitted before the
  -- server stamped certifications have no certified_at: they stay in the group, after the stamped ones.
  ORDER BY
    CASE WHEN p_sort = 'oldest_waiting' THEN qs.waiting_since END ASC NULLS LAST,
    CASE WHEN p_sort = 'earliest_expiry' THEN qs.expires END ASC NULLS LAST,
    (m.status = 'submitted') DESC, m.certified_at DESC NULLS LAST, m.updated_at DESC, m.id
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_list_submissions(text, text, integer, integer, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_list_submissions(text, text, integer, integer, boolean, boolean, text) TO authenticated;

-- ---------- Deleting an intake ----------
-- As in 20261105092000_intake_milestones.sql, plus the intake's quote requests and their history, which the
-- deletion removes with everything else of the intake (docs/DATA_HANDLING.md).
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
  -- After the pipeline row, which names the winning quote request.
  DELETE FROM public.quote_request_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_events', n);
  DELETE FROM public.quote_requests WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_requests', n);
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

-- ---------- Who may call what ----------
REVOKE ALL ON FUNCTION public.advisor_record_quote_send(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_record_quote_send(uuid, text, date) TO authenticated;
REVOKE ALL ON FUNCTION public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_update_quote_request(bigint, text, date, date, date, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.advisor_note_underwriter_question(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_note_underwriter_question(bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.log_quote_request_change() FROM PUBLIC, anon, authenticated;
