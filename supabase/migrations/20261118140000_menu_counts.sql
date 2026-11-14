-- Menu counts (story CRM-S1.1c; docs/BROKER_CRM_BUILD.md D-38, D-39, D-40, D-44, D-49, ADR 0023, ADR 0024).
--
-- 1. "New PEO mail" is defined once. quote_request_has_new_peo_mail(quote request) says whether a person at the PEO wrote (not
--    an automatic reply, not an advisor's own copied-in message) after any advisor last opened that quote request's thread
--    (quote_request_thread_reads). Held mail belongs to no quote request. The queue's mark (new_peo_mail_requests, which
--    has_new_peo_mail reads) and the menu's Inbox count both ask it, so they cannot disagree. advisor_list_submissions is
--    restated from its LATEST definition (20261116180000_function_firm_scope.sql), every rule kept; the only change is that the
--    inline test is now the call (D-104).
-- 2. menu_counts(): one call for every count the menu shows, as a jsonb object so a later story adds a key (leads, others)
--    and no caller changes. Today:
--      quotes: quote requests with status 'sent' on intakes the caller may see (D-39). A submission sent to three PEOs counts three.
--      inbox:  intakes with at least one quote request with new PEO mail, the rows the queue's "has new PEO mail" filter shows
--              (D-38): the number never contradicts the page it opens. D-39 said "quote requests"; see D-133.
--    It reads only (ADR 0023), writes nothing, takes no firm from the browser (the firm helpers read the address, D-40), and
--    answers {"quotes":0,"inbox":0} for a caller with no firm, the same shape as for a firm with nothing (D-18). A caller who is
--    not let into the console is refused as the queue refuses them (42501).

SET lock_timeout = '5s';

CREATE FUNCTION public.quote_request_has_new_peo_mail(p_quote_request_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quote_request_messages x
    WHERE x.quote_request_id = p_quote_request_id AND x.direction = 'received' AND NOT x.is_automatic
      AND x.recorded_at > COALESCE((SELECT r.last_opened_at FROM public.quote_request_thread_reads r WHERE r.quote_request_id = p_quote_request_id), '-infinity'::timestamptz)
  )
$$;

REVOKE ALL ON FUNCTION public.quote_request_has_new_peo_mail(bigint) FROM PUBLIC, anon, authenticated, service_role;

-- advisor_list_submissions: 20261116180000's definition, with the new-mail test replaced by the one rule.
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
      -- New mail from a person at the PEO: the one rule, quote_request_has_new_peo_mail, which the menu's Inbox count asks too.
      count(*) FILTER (WHERE public.quote_request_has_new_peo_mail(q.id))::integer AS new_mail
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


CREATE FUNCTION public.menu_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  quotes bigint;
  inbox bigint;
BEGIN
  PERFORM public.require_advisor();
  -- The firms to look in: those the caller has a membership of or an open support session for. This only narrows where to look;
  -- is_firm_member is the lock (current member, this address's firm, not suspended, past the second factor, or support's read).
  WITH mine AS (
    SELECT m.firm_id FROM public.firm_memberships m WHERE m.user_id = auth.uid()
    UNION
    SELECT s.firm_id FROM public.support_sessions s WHERE s.admin_id = auth.uid() AND s.ended_at IS NULL
  ), allowed AS MATERIALIZED (
    SELECT t.firm_id FROM mine t WHERE public.is_firm_member(t.firm_id)
  ), requests AS MATERIALIZED (
    SELECT q.id, q.session_id, q.status
    FROM public.quote_requests q
    JOIN public.chamber_sessions s ON s.id = q.session_id
    WHERE s.firm_id IN (SELECT a.firm_id FROM allowed a)
  )
  SELECT
    count(*) FILTER (WHERE r.status = 'sent'),
    count(DISTINCT r.session_id) FILTER (WHERE public.quote_request_has_new_peo_mail(r.id))
  INTO quotes, inbox
  FROM requests r;
  RETURN jsonb_build_object('quotes', quotes, 'inbox', inbox);
END;
$$;

REVOKE ALL ON FUNCTION public.menu_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.menu_counts() TO authenticated;
