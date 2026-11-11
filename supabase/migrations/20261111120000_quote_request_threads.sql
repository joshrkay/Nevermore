-- The thread on the submission page (joshrkay/Nevermore#92, story M-3.4).
--
-- * public.quote_request_thread_reads: when an advisor last opened a quote request's thread, one row per quote
--   request for the whole team (not one per advisor): the "new PEO mail" mark shows on a quote request until any
--   advisor opens its thread. Read by advisors; written only by advisor_open_quote_request_thread().
-- * advisor_open_quote_request_thread(id, seen_through) marks the thread opened, through the time of the latest
--   message the advisor was shown (the recorded_at the page loaded), so mail that arrived after the page loaded
--   stays new. It never moves the mark backwards. Without a time it is now.
-- * New mail is a message from a person at the PEO: received, not automatic (an out-of-office reply is not), on a
--   quote request (held mail is not), recorded after the thread was last opened. An advisor's own copied-in
--   message never counts. src/data/mailThread.ts (hasNewMail) holds the same rule.
-- * advisor_list_submissions() gains new_peo_mail_requests: how many of a submission's quote requests have new mail,
--   for the queue's mark. Otherwise as in 20261110090000_quote_requests.sql.
-- * Deleting an intake deletes its quote requests, and the reads go with them (ON DELETE CASCADE).
--
-- Deploy this migration before the front end that shows the thread. The older front end keeps working against it
-- (it selects no new column, and ignores the queue's new one).

SET lock_timeout = '5s';

CREATE TABLE public.quote_request_thread_reads (
  quote_request_id bigint PRIMARY KEY REFERENCES public.quote_requests (id) ON DELETE CASCADE,
  last_opened_at timestamptz NOT NULL,
  last_opened_by uuid,
  last_opened_by_email text
);

ALTER TABLE public.quote_request_thread_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_request_thread_reads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quote_request_thread_reads TO authenticated;
CREATE POLICY quote_request_thread_reads_advisor_read ON public.quote_request_thread_reads
  FOR SELECT TO authenticated USING (public.is_advisor());

CREATE FUNCTION public.advisor_open_quote_request_thread(p_quote_request_id bigint, p_seen_through timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  seen timestamptz := LEAST(COALESCE(p_seen_through, now()), now());
  r public.quote_request_thread_reads;
BEGIN
  PERFORM public.require_advisor();
  IF NOT EXISTS (SELECT 1 FROM public.quote_requests WHERE id = p_quote_request_id) THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO public.quote_request_thread_reads AS t (quote_request_id, last_opened_at, last_opened_by, last_opened_by_email)
  VALUES (p_quote_request_id, seen, auth.uid(), auth.jwt() ->> 'email')
  ON CONFLICT (quote_request_id) DO UPDATE
    SET last_opened_at = GREATEST(t.last_opened_at, EXCLUDED.last_opened_at),
        last_opened_by = CASE WHEN EXCLUDED.last_opened_at > t.last_opened_at THEN EXCLUDED.last_opened_by ELSE t.last_opened_by END,
        last_opened_by_email = CASE WHEN EXCLUDED.last_opened_at > t.last_opened_at THEN EXCLUDED.last_opened_by_email ELSE t.last_opened_by_email END
  RETURNING * INTO r;
  RETURN to_jsonb(r);
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_open_quote_request_thread(bigint, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_open_quote_request_thread(bigint, timestamptz) TO authenticated;

-- ---------- The queue ----------
-- As in 20261110090000_quote_requests.sql, plus new_peo_mail_requests.
DROP FUNCTION public.advisor_list_submissions(text, text, integer, integer, boolean, boolean, text);
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
  -- How many quote requests hold mail a person at the PEO wrote that no advisor has opened yet (20261111120000).
  new_peo_mail_requests integer,
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
    qs.new_mail,
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
      )) FILTER (WHERE q.status IN ('sent', 'quoted')), false) AS older,
      -- Mail a person at the PEO wrote (not an automatic reply, not an advisor's own copied-in message) that arrived
      -- after any advisor last opened that quote request's thread; held mail belongs to no quote request.
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM public.quote_request_messages x
        WHERE x.quote_request_id = q.id AND x.direction = 'received' AND NOT x.is_automatic
          AND x.recorded_at > COALESCE((SELECT r.last_opened_at FROM public.quote_request_thread_reads r WHERE r.quote_request_id = q.id), '-infinity'::timestamptz)
      ))::integer AS new_mail
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
