-- More statuses for a quote request (N-1.2; CRM-Q3.1's database half; slice 5.1; docs/BROKER_CRM_BUILD.md D-1701, D-1702, D-1705, D-1730 to D-1739).
--
--   1. quote_requests.status gains `acknowledged` (the PEO said it has the packet) and `question_open` (the PEO asked for something). "Not sent yet" is not
--      a status (D-1702): a quote request exists only once a PEO was sent to.
--   2. advisor_set_quote_request_status: an agent of the firm records Sent, Acknowledged or Question open (D-1731). Who and when are the existing log's:
--      log_quote_request_change writes every change to quote_request_events, which nothing can rewrite (D-1732). No table, so no closing-plan line.
--   3. A message the agent sends on a PEO's thread answers a question: Question open returns to Sent (D-1733). Mail that arrives moves nothing.
--   4. Open means Sent, Acknowledged or Question open wherever Sent counted (D-1735), each function restated from its newest definition with every line
--      it had and only that list changed: advisor_record_quote_send (20261122100000; a send recorded by hand answers a question), menu_counts
--      (20261122150000), advisor_list_submissions (20261118140500), queue_rows (20261117100000), queue_page_fast (20261117100500), accounts_rows
--      (20261120111000), set_submission_status (20261122200500), close_submission_and_withdraw (20261122190000), opportunity_activity (20261120120000).
--
-- Not changed here: opportunity_stage() and what moves it (D-1734: the stage is the submission's, moved by a send and by a recorded quote, and these two
-- statuses move nothing); advisor_update_quote_request (it already takes a quote, a decline or a close from any status but closed); expiry moves nothing
-- (D-1705); opportunity_mark_won and opportunity_mark_lost, which slice 5.0x restates and which must close the two new statuses too (D-1737).

-- ---------- 1. The two statuses ----------
ALTER TABLE public.quote_requests DROP CONSTRAINT quote_requests_status_check;
ALTER TABLE public.quote_requests ADD CONSTRAINT quote_requests_status_check CHECK (status IN (
  -- sync:begin quote_request_statuses
  'sent', 'acknowledged', 'question_open', 'quoted', 'declined', 'closed'
  -- sync:end quote_request_statuses
));

-- ---------- 2. An agent records the move ----------
CREATE FUNCTION public.advisor_set_quote_request_status(p_quote_request_id bigint, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req public.quote_requests;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  IF p_status IS NULL OR p_status NOT IN ('sent', 'acknowledged', 'question_open') THEN
    RAISE EXCEPTION 'This records Sent, Acknowledged or Question open. A quote, a decline or a close is recorded with its own form' USING ERRCODE = '22023';
  END IF;
  -- A quote request of the caller's own firm; another firm's is not there for them. Locked, as a send locks it.
  SELECT q.* INTO req FROM public.quote_requests q WHERE q.id = p_quote_request_id AND public.quote_request_in_my_firm(q.id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  IF req.status = 'closed' THEN
    RAISE EXCEPTION 'This quote request is closed. Send to % again to reopen it.', req.peo_name USING ERRCODE = '22023';
  END IF;
  IF req.status NOT IN ('sent', 'acknowledged', 'question_open') THEN
    RAISE EXCEPTION 'The quote request to % is already %, so it is not open any more.', req.peo_name, req.status USING ERRCODE = '22023';
  END IF;
  IF req.status = p_status THEN
    RAISE EXCEPTION '% is already %.', req.peo_name, upper(left(replace(p_status, '_', ' '), 1)) || substr(replace(p_status, '_', ' '), 2) USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_requests SET status = p_status WHERE id = req.id RETURNING * INTO req;
  RETURN to_jsonb(req);
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_set_quote_request_status(bigint, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.advisor_set_quote_request_status(bigint, text) TO authenticated;

-- ---------- 3. Answering a question returns it to Sent ----------
-- CRM-Q3.1: "Answering it, or sending again, returns it to Sent". A message the agent sends on a PEO's thread (a send, a send again, a follow-up, an update)
-- is that answer, whichever function recorded it, so the move is one trigger on the thread rather than a line in each writer. Only a message sent: mail that
-- arrives never reaches this (CRM-Q3.1: an email only suggests). Acknowledged stays, and so does every status that is not Question open. The change is
-- logged with the person sending, as every change to a quote request is (log_quote_request_change).
CREATE FUNCTION public.quote_request_question_answered()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.quote_requests q SET status = 'sent' WHERE q.id = NEW.quote_request_id AND q.status = 'question_open';
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.quote_request_question_answered() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER quote_request_messages_answer_question AFTER INSERT ON public.quote_request_messages
  FOR EACH ROW WHEN (NEW.direction = 'sent')
  EXECUTE FUNCTION public.quote_request_question_answered();

-- ---------- 4. Open means Sent, Acknowledged or Question open (D-1735) ----------
-- Each below is its newest definition (named in the header) with every line kept; what changed is the list of statuses, and for advisor_record_quote_send
-- the status a send gives back to Sent.
CREATE OR REPLACE FUNCTION public.advisor_record_quote_send(p_session_id uuid, p_peo text, p_sent_on date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  req public.quote_requests;
  stage text;
  peo text := btrim(COALESCE(p_peo, ''));
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');
  IF peo = '' THEN
    RAISE EXCEPTION 'Name the PEO the packet went to' USING ERRCODE = '22023';
  END IF;
  -- sync:begin quote_peo_length
  IF char_length(peo) > 80 THEN
  -- sync:end quote_peo_length
    RAISE EXCEPTION 'A PEO name is limited to 80 characters' USING ERRCODE = '22023';
  END IF;
  -- M-1.1: no send to a PEO without the employer's live authorization; the database refuses it, not only the screen.
  PERFORM public.assert_peo_authorized(p_session_id, peo);
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
        status = CASE WHEN quote_requests.status IN ('closed', 'question_open') THEN 'sent' ELSE quote_requests.status END
  RETURNING * INTO req;
  -- The address replies about this quote request are sent to; kept if it already has one.
  PERFORM public.issue_quote_request_address(req.id);
  -- ADR 0026: a send recorded while the submission is Ready for market moves it to Sent to PEOs, in this transaction, and at no other stage.
  IF stage = 'ready_for_market' THEN
    PERFORM public.submission_move_for_cause(p_session_id, 'ready_for_market', 'sent_to_carrier', 'quote_send', req.id);
  END IF;
  RETURN to_jsonb(req);
END;
$function$;

CREATE OR REPLACE FUNCTION public.menu_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  quotes bigint;
  inbox bigint;
  leads bigint;
BEGIN
  PERFORM public.require_advisor();
  -- The firms to look in: those the caller has a membership or an open support session for. This only narrows where to look;
  -- is_firm_member is the lock (current member, this address's firm, not suspended, past the second factor, or support's read).
  -- The rows are the queue's: an intake with its workflow row that the queue does not hide (queue_hides_empty_guest_draft).
  WITH mine AS (
    SELECT m.firm_id FROM public.firm_memberships m WHERE m.user_id = auth.uid()
    UNION
    SELECT s.firm_id FROM public.support_sessions s WHERE s.admin_id = auth.uid() AND s.ended_at IS NULL
  ), allowed AS MATERIALIZED (
    SELECT t.firm_id FROM mine t WHERE public.is_firm_member(t.firm_id)
  ), requests AS MATERIALIZED (
    SELECT q.id, q.session_id, q.status
    FROM public.chamber_sessions s
    JOIN public.submission_workflow w ON w.session_id = s.id
    JOIN public.quote_requests q ON q.session_id = s.id
    WHERE s.firm_id IN (SELECT a.firm_id FROM allowed a)
      -- The guest flag is read one session at a time, by key: joining the whole user table to the firm's sessions was a scan of every user.
      AND NOT public.queue_hides_empty_guest_draft(s.id, (SELECT u.is_anonymous FROM auth.users u WHERE u.id = s.user_id),
                                                  s.chamber_data, s.field_provenance, s.transcript, s.chosen_peo)
  )
  SELECT count(*) FILTER (WHERE r.status IN ('sent', 'acknowledged', 'question_open')) INTO quotes FROM requests r;
  -- The threads with new mail, in the same firms: one per PEO thread or conversation, however many new messages it has.
  SELECT count(DISTINCT (a.firm_id, r.kind, r.thread_id)) INTO inbox
  FROM (
    SELECT m.firm_id FROM public.firm_memberships m WHERE m.user_id = auth.uid()
    UNION
    SELECT s.firm_id FROM public.support_sessions s WHERE s.admin_id = auth.uid() AND s.ended_at IS NULL) a
  CROSS JOIN LATERAL public.inbox_rows(a.firm_id) r
  WHERE public.is_firm_member(a.firm_id) AND r.is_new;
  -- Open leads (New or Working) the caller may see by the level rule, the bin left out (CRM-S1.1, CRM-L1.1a), in the same firms.
  SELECT count(*) INTO leads
  FROM public.leads l
  WHERE l.firm_id IN (
      SELECT m.firm_id FROM public.firm_memberships m WHERE m.user_id = auth.uid()
      UNION
      SELECT s.firm_id FROM public.support_sessions s WHERE s.admin_id = auth.uid() AND s.ended_at IS NULL)
    AND public.is_firm_member(l.firm_id)
    AND l.status IN ('new', 'working') AND l.deleted_at IS NULL
    AND public.can_see_firm_record(l.firm_id, l.owner_id);
  RETURN jsonb_build_object('quotes', quotes, 'inbox', inbox, 'leads', leads);
END;
$$;

CREATE OR REPLACE FUNCTION public.advisor_list_submissions(p_status text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT NULL::integer, p_offset integer DEFAULT 0, p_needs_action boolean DEFAULT NULL::boolean, p_waiting boolean DEFAULT NULL::boolean, p_sort text DEFAULT NULL::text)
 RETURNS TABLE(session_id uuid, company_name text, contact_name text, employee_count integer, pipeline_status text, intake_status text, signer_name text, submitted_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, missing_required text[], open_fields integer, flagged_fields integer, verified_fields integer, file_id text, states text[], needs_action boolean, needs_action_note text, quote_requests_sent integer, quotes_received integer, oldest_waiting_on date, earliest_quote_expires_on date, sent_older_version boolean, new_peo_mail_requests integer, start_month text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHERE public.is_firm_member(s.firm_id)
      AND (p_status IS NULL OR w.status = p_status)
      AND (p_needs_action IS NULL OR w.needs_action = p_needs_action)
      -- Waiting on a PEO: a quote request sent and not yet answered.
      AND (p_waiting IS NULL OR p_waiting = EXISTS (
        SELECT 1 FROM public.quote_requests q WHERE q.session_id = s.id AND q.status IN ('sent', 'acknowledged', 'question_open')
      ))
      -- Not an empty guest draft (F-2.1): a guest's intake, never certified, that holds nothing the prospect did.
      -- Since A-1 an intake is created only by the prospect's first action, so these are left from before then.
      AND NOT public.queue_hides_empty_guest_draft(s.id, u.is_anonymous, s.chamber_data, s.field_provenance, s.transcript, s.chosen_peo)
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
    qs.new_mail,
    left(NULLIF(btrim(m.d ->> 'start_month'), ''), 200),
    count(*) OVER ()
  FROM matched m
  CROSS JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE q.status <> 'closed')::integer AS sent,
      count(*) FILTER (WHERE q.status = 'quoted')::integer AS received,
      min(q.sent_on) FILTER (WHERE q.status IN ('sent', 'acknowledged', 'question_open')) AS waiting_since,
      min(q.quote_expires_on) FILTER (WHERE q.status = 'quoted') AS expires,
      COALESCE(bool_or(q.sent_version < (
        SELECT max(c.version) FROM public.chamber_certifications c WHERE c.session_id = m.id
      )) FILTER (WHERE q.status IN ('sent', 'acknowledged', 'question_open', 'quoted')), false) AS older,
      -- New mail from a person at the PEO: the one rule, quote_requests_with_new_peo_mail(), which the menu's Inbox count asks too.
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.quote_requests_with_new_peo_mail() n WHERE n.quote_request_id = q.id))::integer AS new_mail
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
$function$;

CREATE OR REPLACE FUNCTION public.queue_rows(p_search text)
RETURNS SETOF public.queue_row
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT l.session_id, l.company_name, l.contact_name, l.employee_count, l.pipeline_status, l.intake_status, l.signer_name,
         l.submitted_at, l.created_at, l.updated_at, l.missing_required, l.open_fields, l.flagged_fields, l.verified_fields,
         l.file_id, l.states, l.needs_action, l.needs_action_note, l.quote_requests_sent, l.quotes_received, l.oldest_waiting_on,
         l.earliest_quote_expires_on, l.sent_older_version, l.new_peo_mail_requests, l.start_month,
         l.new_peo_mail_requests > 0,
         EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.session_id = l.session_id AND q.status IN ('sent', 'acknowledged', 'question_open'))
  FROM public.advisor_list_submissions(NULL, p_search, NULL, 0, NULL, NULL, NULL) l
$$;

CREATE OR REPLACE FUNCTION public.queue_page_fast(p_args jsonb, p_page integer, p_search text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH l AS (
    SELECT l.*
    FROM public.advisor_list_submissions(p_args ->> 'status', p_search, 50, (p_page - 1) * 50,
      (p_args ->> 'action')::boolean, (p_args ->> 'waiting')::boolean, p_args ->> 'sort')
      WITH ORDINALITY AS l(session_id, company_name, contact_name, employee_count, pipeline_status, intake_status, signer_name,
        submitted_at, created_at, updated_at, missing_required, open_fields, flagged_fields, verified_fields, file_id, states,
        needs_action, needs_action_note, quote_requests_sent, quotes_received, oldest_waiting_on, earliest_quote_expires_on,
        sent_older_version, new_peo_mail_requests, start_month, total_count, ord)
  )
  SELECT jsonb_build_object(
    'rows', COALESCE(jsonb_agg(to_jsonb(ROW(
        l.session_id, l.company_name, l.contact_name, l.employee_count, l.pipeline_status, l.intake_status, l.signer_name,
        l.submitted_at, l.created_at, l.updated_at, l.missing_required, l.open_fields, l.flagged_fields, l.verified_fields,
        l.file_id, l.states, l.needs_action, l.needs_action_note, l.quote_requests_sent, l.quotes_received, l.oldest_waiting_on,
        l.earliest_quote_expires_on, l.sent_older_version, l.new_peo_mail_requests, l.start_month,
        l.new_peo_mail_requests > 0,
        EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.session_id = l.session_id AND q.status IN ('sent', 'acknowledged', 'question_open'))
      )::public.queue_row) ORDER BY l.ord), '[]'::jsonb),
    'total', COALESCE(max(l.total_count), CASE WHEN p_page > 1 THEN (
      SELECT f.total_count FROM public.advisor_list_submissions(p_args ->> 'status', p_search, 1, 0,
        (p_args ->> 'action')::boolean, (p_args ->> 'waiting')::boolean, p_args ->> 'sort') f
    ) END, 0),
    'page', p_page,
    'page_size', 50
  )
  FROM l
$$;

CREATE OR REPLACE FUNCTION public.accounts_rows(p_firm_id uuid, p_search text, p_ids uuid[] DEFAULT NULL)
RETURNS SETOF public.accounts_row
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  seen_owners uuid[];
  seen_unowned boolean;
  terms text[] := ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '');
  domains text[] := ARRAY(SELECT public.web_domain_of(t) FROM unnest(ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '')) AS t);
BEGIN
  SELECT COALESCE(array_agg(o.owner_id) FILTER (WHERE o.owner_id IS NOT NULL), '{}'), COALESCE(bool_or(o.owner_id IS NULL), false)
  INTO seen_owners, seen_unowned
  FROM (SELECT DISTINCT a.owner_id FROM public.accounts a WHERE a.firm_id = p_firm_id OFFSET 0) o   -- OFFSET 0: the question is asked of each owner, not pushed down to each account
  WHERE public.can_see_firm_record(p_firm_id, o.owner_id);

  RETURN QUERY
  SELECT (ROW(
    a.id, a.name, a.trade_name, a.website, a.city, a.state, a.industry, a.employees, a.states_of_operation, a.current_provider, a.source,
    CASE WHEN st.is_client THEN 'client' WHEN st.has_placement THEN 'former_client' ELSE 'prospect' END, a.archived_at IS NOT NULL, a.archived_at, a.created_at,
    mem.user_id, mem.name,
    mc.id, mc.name, mc.email, mc.phone,
    oo.id, oo.name, oo.stage, oo.target_start, COALESCE(oo.n, 0),
    COALESCE(q.sent, 0), COALESCE(q.received, 0), COALESCE(q.waiting, false), q.expires,
    act.at, COALESCE(lab.names, '{}'), ren.renews_on
  )::public.accounts_row).*
  FROM public.accounts a
  LEFT JOIN LATERAL (
    SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text) AS name
    FROM public.firm_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = p_firm_id AND m.user_id = a.owner_id AND public.membership_is_current(m.valid_from, m.valid_until)
    LIMIT 1
  ) mem ON true
  -- The account's status (D-197, D-451, D-455): a client while it has a placement not ended, or, with no placement at all, a won submission (one won before
  -- placements); a former client when it has placements and all of them have ended. account_status() says the same for any account by its id alone, which no
  -- index serves for the opportunities (they are indexed by firm and account), so asked for each account of a firm it reads every opportunity of every firm;
  -- this asks by firm and account. supabase/tests/accounts_query.sql and placements_renewals.sql compare the two for every account.
  LEFT JOIN LATERAL (
    -- One read of the account's placements (by placements_firm_account_idx) answers both questions; the won-submission fallback is asked only when the
    -- account has no placement at all (D-455), which is the only case it can change the answer.
    SELECT pl.has_placement,
           pl.has_active_placement
           OR (NOT pl.has_placement
               AND EXISTS (SELECT 1 FROM public.opportunities w
                           WHERE w.firm_id = p_firm_id AND w.account_id = a.id AND w.intake_id IS NOT NULL AND public.submission_opportunity_stage(w.intake_id) = 'won')) AS is_client
    FROM (SELECT count(*) > 0 AS has_placement, COALESCE(bool_or(p.ended_on IS NULL), false) AS has_active_placement
          FROM public.placements p WHERE p.firm_id = p_firm_id AND p.account_id = a.id) pl
  ) st ON true
  -- The Renewal column (D-450): the date of the nearest renewal not done (renewal_is_done: not marked "Didn't renew" and not worked by a Won opportunity).
  LEFT JOIN LATERAL (
    SELECT min(rn.renews_on) AS renews_on
    FROM public.renewals rn
    WHERE rn.firm_id = p_firm_id AND rn.account_id = a.id AND NOT public.renewal_is_done(rn.not_renewed_on, rn.opportunity_id)
  ) ren ON true
  LEFT JOIN LATERAL (
    SELECT c.id, btrim(concat_ws(' ', c.first_name, c.last_name)) AS name, NULLIF(btrim(c.email), '') AS email,
           COALESCE(NULLIF(btrim(c.phone), ''), NULLIF(btrim(c.mobile), '')) AS phone
    FROM public.contacts c
    WHERE c.account_id = a.id AND c.is_main
  ) mc ON true
  LEFT JOIN LATERAL (
    SELECT x.id, x.name, x.target_start, x.stage, x.intake_id, (count(*) OVER ())::integer AS n
    FROM (
      SELECT o.id, o.name, o.target_start, o.created_at, o.intake_id, public.opportunity_stage(o.id) AS stage
      FROM public.opportunities o
      WHERE o.firm_id = p_firm_id AND o.account_id = a.id
    ) x
    WHERE x.stage NOT IN ('won', 'lost')
    ORDER BY x.target_start NULLS LAST, x.created_at, x.id
    LIMIT 1
  ) oo ON true
  LEFT JOIN LATERAL (
    SELECT (count(*) FILTER (WHERE r.status <> 'closed'))::integer AS sent,
           (count(*) FILTER (WHERE r.status = 'quoted'))::integer AS received,
           min(r.quote_expires_on) FILTER (WHERE r.status = 'quoted') AS expires,
           COALESCE(bool_or(r.status IN ('sent', 'acknowledged', 'question_open')), false) AS waiting
    FROM public.quote_requests r
    WHERE r.session_id = oo.intake_id
  ) q ON true
  LEFT JOIN LATERAL (
    SELECT max(t.at) AS at FROM public.account_activity_times(p_firm_id, a.id) t
  ) act ON true
  LEFT JOIN LATERAL (
    SELECT lower(string_agg(concat_ws(' ', c.first_name, c.last_name, c.email), E'\n')) AS t
    FROM public.contacts c
    WHERE cardinality(terms) > 0 AND c.account_id = a.id
  ) ct ON true
  LEFT JOIN LATERAL (
    SELECT array_agg(l.name ORDER BY lower(l.name), l.name) AS names
    FROM public.account_labels al JOIN public.labels l ON l.id = al.label_id
    WHERE al.account_id = a.id
  ) lab ON true
  WHERE a.firm_id = p_firm_id
    AND (a.owner_id = ANY (seen_owners) OR (a.owner_id IS NULL AND seen_unowned))
    AND (p_ids IS NULL OR a.id = ANY (p_ids))
    AND NOT EXISTS (
      SELECT 1 FROM unnest(terms, domains) AS w (term, dom)
      WHERE strpos(lower(concat_ws(E'\n', a.name, a.trade_name, a.web_domain)) || E'\n' || COALESCE(ct.t, ''), w.term) = 0
        AND (w.dom IS NULL OR a.web_domain IS NULL OR strpos(a.web_domain, w.dom) = 0)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_submission_status(p_session_id uuid, p_status text, p_note text DEFAULT NULL::text, p_won_quote_request_id bigint DEFAULT NULL::bigint)
 RETURNS submission_workflow
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_row public.submission_workflow;
  previous text;
  allowed text[];
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  -- Closing firms are read-only (CRM-P1.7): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');
  IF p_status IS NULL OR p_status NOT IN (
    'submitted', 'under_review', 'information_requested', 'ready_for_market', 'sent_to_carrier', 'quoted', 'won', 'lost', 'archived'
  ) THEN
    RAISE EXCEPTION 'Not a status an advisor can set: %', p_status USING ERRCODE = '22023';
  END IF;
  IF length(clean_note) > 2000 THEN
    RAISE EXCEPTION 'Status notes are limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  -- D-470: a submission on an opportunity is won or lost on its opportunity (opportunity_mark_won, opportunity_mark_lost), which choose the quote, close the
  -- rest with their reason and make the placement, renewal and commission or keep the lost reason in one step. Only a submission with no opportunity is moved
  -- to Won or Lost here.
  IF p_status IN ('won', 'lost') AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.intake_id = p_session_id) THEN
    RAISE EXCEPTION 'Mark it won or lost on its opportunity' USING ERRCODE = '22023';
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
  -- D-471: a submission archived straight from Won or from Lost is a closed search with its outcome, placement or reason: it is restored by reopening it on
  -- its opportunity (opportunity_reopen), not to Submitted. One archived from any other stage has no outcome to undo and is restored as before.
  IF current_row.status = 'archived' AND p_status = 'submitted' AND EXISTS (SELECT 1 FROM public.opportunities o WHERE o.intake_id = p_session_id)
     AND (SELECT x.from_status FROM public.submission_status_history x
          WHERE x.session_id = p_session_id AND x.to_status = 'archived' AND x.from_status IS DISTINCT FROM 'archived' ORDER BY x.id DESC LIMIT 1) IN ('won', 'lost') THEN
    RAISE EXCEPTION 'Reopen it on its opportunity' USING ERRCODE = '22023';
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
    WHERE session_id = p_session_id AND status IN ('sent', 'acknowledged', 'question_open', 'quoted')
      AND id IS DISTINCT FROM current_row.won_quote_request_id;
    -- M-2.4: and no PEO but the winner can open the employer's packet any more, whether or not the advisor writes to them (D-1624).
    PERFORM public.bundle_link_revoke(q.id, 'submission_closed')
    FROM public.quote_requests q
    WHERE q.session_id = p_session_id AND q.id IS DISTINCT FROM current_row.won_quote_request_id;
  END IF;

  INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
  VALUES (p_session_id, previous, p_status, clean_note, auth.uid(), auth.jwt() ->> 'email');
  RETURN current_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_submission_and_withdraw(p_session_id uuid, p_status text, p_note text, p_won_quote_request_id bigint, p_subject text,
                                                     p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sender_address text;
  problem text;
  targets jsonb;
  target jsonb;
  made public.quote_request_messages;
  ids jsonb := '[]'::jsonb;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  -- Another firm's intake is not there for them, before anything about the caller's own mailbox is said (as set_submission_status refuses it).
  PERFORM public.require_intake_in_my_firm(p_session_id, 'P0002');
  -- From the advisor's own connected mailbox (ADR 0005). With none, the submission does not move either: the advisor chose to tell the PEOs (D-634).
  SELECT b.address INTO sender_address FROM public.broker_mailboxes b WHERE b.user_id = auth.uid();
  IF sender_address IS NULL THEN
    RAISE EXCEPTION 'Connect your mailbox to send from here.' USING ERRCODE = 'PT412';
  END IF;
  -- The one note by 6.2's limits (D-636), for every PEO it goes to.
  problem := public.conversation_message_input_error(p_subject, p_body, '{}');
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  -- The PEOs still open, and who each was last written to, read before the move closes them.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', q.id, 'to', (
           SELECT to_jsonb(m.to_addresses) FROM public.quote_request_messages m WHERE m.quote_request_id = q.id AND m.direction = 'sent'
           ORDER BY m.recorded_at DESC, m.id DESC LIMIT 1)) ORDER BY q.id), '[]'::jsonb)
  INTO targets
  FROM public.quote_requests q
  WHERE q.session_id = p_session_id AND q.status IN ('sent', 'acknowledged', 'question_open', 'quoted') AND q.id IS DISTINCT FROM p_won_quote_request_id
    AND EXISTS (SELECT 1 FROM public.quote_request_messages m WHERE m.quote_request_id = q.id AND m.direction = 'sent');
  PERFORM public.set_submission_status(p_session_id, p_status, p_note, p_won_quote_request_id);
  FOR target IN SELECT * FROM jsonb_array_elements(targets) LOOP
    made := public.record_peo_thread_message((target ->> 'id')::bigint, sender_address, ARRAY(SELECT jsonb_array_elements_text(target -> 'to')),
                                             p_subject, p_body, true);
    ids := ids || to_jsonb(made.id);
  END LOOP;
  RETURN jsonb_build_object('message_ids', ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.opportunity_activity(p_firm_id uuid, p_opportunity_id uuid, p_filter text DEFAULT 'all', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.opportunities;
  a public.accounts;
  want text;
  hist jsonb := '[]'::jsonb;
  chunk jsonb;
  after_at timestamptz;
  after_key uuid;
  need bigint := p_offset::bigint + p_limit;
  hist_total bigint := 0;
  take integer;
  n bigint;
  r jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit < 0 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'A page is 0 to 100 rows, from a place that is not before the first' USING ERRCODE = '22023';
  END IF;
  IF p_filter IS NULL OR p_filter NOT IN ('all', 'calls', 'notes', 'tasks', 'changes') THEN
    RAISE EXCEPTION 'An opportunity''s activity is all, calls, notes, tasks or changes' USING ERRCODE = '22023';
  END IF;
  IF p_firm_id IS NOT NULL AND p_opportunity_id IS NOT NULL THEN
    SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = p_firm_id;
    SELECT * INTO a FROM public.accounts x WHERE x.id = o.account_id AND x.firm_id = o.firm_id;
  END IF;
  IF o.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  want := CASE p_filter WHEN 'calls' THEN 'call' WHEN 'notes' THEN 'note' WHEN 'tasks' THEN 'task' END;
  IF p_filter IN ('all', 'changes') THEN
    -- How many history entries there are, without building them: the capture trigger's rows and the intake's stage changes.
    SELECT (SELECT count(*) FROM public.record_history h
            WHERE h.firm_id = o.firm_id AND h.table_name = public.record_history_table_named('opportunities') AND h.record_key = o.id::text)
           + CASE WHEN o.intake_id IS NULL THEN 0 ELSE public.opportunity_stage_change_count(o.intake_id) END
    INTO hist_total;
    -- The newest `need` of them, and no more.
    WHILE jsonb_array_length(hist) < LEAST(need, hist_total) LOOP
      take := LEAST(100, need - jsonb_array_length(hist))::integer;
      SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.at DESC, l.entry_key DESC), '[]'::jsonb) INTO chunk
      FROM public.record_history_list(o.firm_id, 'opportunities', o.id::text, take, after_at, after_key) l;
      EXIT WHEN jsonb_array_length(chunk) = 0;
      hist := hist || chunk;
      after_at := (chunk -> (jsonb_array_length(chunk) - 1) ->> 'at')::timestamptz;
      after_key := (chunk -> (jsonb_array_length(chunk) - 1) ->> 'entry_key')::uuid;
    END LOOP;
  END IF;
  WITH entries AS (
    SELECT h.e ->> 'entry_key' AS entry_key, (h.e ->> 'at')::timestamptz AS at,
           h.e || jsonb_build_object('type', 'change', 'record_table', 'opportunities', 'record_id', o.id, 'record_name', o.name) AS j
    FROM jsonb_array_elements(hist) AS h (e)
    UNION ALL
    SELECT 'quote_request_event:' || e.id, e.changed_at,
           jsonb_build_object('type', 'quote', 'entry_key', 'quote_request_event:' || e.id, 'at', e.changed_at, 'quote_request_id', e.quote_request_id,
                              'peo_name', q.peo_name, 'event', e.new_value, 'who', public.record_history_who(e.changed_by, e.actor_is_staff),
                              'who_kind', CASE WHEN e.actor_is_staff THEN 'nevermore' WHEN e.changed_by IS NULL THEN 'system' ELSE 'member' END)
    FROM public.quote_request_events e JOIN public.quote_requests q ON q.id = e.quote_request_id
    WHERE p_filter IN ('all', 'changes') AND o.intake_id IS NOT NULL AND e.session_id = o.intake_id AND e.field = 'status'
      AND e.new_value IN ('sent', 'acknowledged', 'question_open', 'quoted', 'declined', 'closed')
    UNION ALL
    -- Only the key is taken here: the row is built below, for the page's rows alone.
    SELECT t.id::text, t.at, NULL::jsonb
    FROM public.activities t
    WHERE p_filter IN ('all', 'calls', 'notes', 'tasks') AND t.opportunity_id = o.id AND t.account_id = o.account_id AND (want IS NULL OR t.kind = want)
  )
  SELECT (SELECT count(*) FROM entries) + (hist_total - jsonb_array_length(hist)),
         COALESCE((SELECT jsonb_agg(x.j ORDER BY x.o) FROM (
           SELECT row_number() OVER (ORDER BY e.at DESC, e.entry_key DESC) AS o,
                  COALESCE(e.j, (SELECT public.crm_activity_row(t) FROM public.activities t WHERE t.id = e.entry_key::uuid)) AS j
           FROM (SELECT * FROM entries ORDER BY at DESC, entry_key DESC OFFSET p_offset LIMIT p_limit) e) x), '[]'::jsonb)
  INTO n, r;
  RETURN jsonb_build_object('count', n, 'rows', r);
END;
$$;
