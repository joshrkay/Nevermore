-- Hardening pass: what the browser can write, and how much of it (findings S-1, S-2, S-3, S-6 and S-8 of the
-- November 2026 review; docs/SECURITY_REVIEW.md, SR-18 onward). supabase/tests/hardening.sql covers each.
--
-- * S-1: `submission` is the certification record, so only certifying writes it. A write from the browser
--   that isn't certifying keeps the submission the row had (none on a new intake): a draft can't carry a File
--   ID or signer of its own making, and a withdrawn certification can't be rewritten. A certification also
--   records the provenance the row holds rather than the browser's copy. The advisor queue takes the File ID
--   from the column the database assigns and the signer from the certification on record.
-- * S-8: an intake's id and created_at are the server's: the browser can neither choose an id nor date an
--   intake into another month of the funnel.
-- * S-2: a document row is written (by document-upload, as the prospect) before its file is stored, so until
--   that write moves to the service role a prospect could add rows with no file. Each became a scan that
--   failed six times and alerted. Now a prospect can hold at most 25 rows whose file hasn't arrived, and the
--   scanner removes a row whose file never arrived once its upload window (15 minutes) has passed, quietly.
-- * S-3: size caps on what the browser writes, far above the largest real intake (a 5,000-employee census
--   with every column is about 3 MB), and the queue lists at most 200 characters of a name.
-- * S-6: a claim that lapsed is cancelled, like a pending one, when its reminders were turned off or its
--   address is suppressed.

-- ---------- S-1, S-8: columns only the server sets ----------

-- Fires before every other BEFORE trigger on chamber_sessions (the name sorts first), so they all see the
-- columns as the server has them. Not SECURITY DEFINER: current_user is the caller's API role.
CREATE OR REPLACE FUNCTION public.keep_server_intake_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.id := gen_random_uuid();
    NEW.created_at := now();
  ELSE
    NEW.id := OLD.id;
    NEW.created_at := OLD.created_at;
  END IF;

  -- Certifying, by the same test as validate_certification: the intake becomes (or is again) submitted, or a
  -- submitted intake's certification is sent again. Anything else leaves the certification record alone.
  IF NOT (NEW.status = 'submitted'
          AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission)) THEN
    NEW.submission := CASE WHEN TG_OP = 'UPDATE' THEN OLD.submission END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_server_intake_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamber_sessions_a_server_columns ON public.chamber_sessions;
CREATE TRIGGER chamber_sessions_a_server_columns
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.keep_server_intake_columns();

-- As in 20261104120000_submission_records.sql, with the provenance stamped from the row as well.
CREATE OR REPLACE FUNCTION public.validate_certification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  certifying boolean := false;
  hash text;
  reference text;
  cert_version integer;
  certified_data_version integer;
BEGIN
  -- The File ID is the database's: the browser can neither set nor change it.
  IF TG_OP = 'UPDATE' THEN
    NEW.file_id := OLD.file_id;
  ELSE
    NEW.file_id := NULL;
  END IF;

  IF NEW.status = 'submitted' THEN
    IF TG_OP = 'INSERT' THEN
      certifying := true;
    ELSIF OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission THEN
      certifying := true;
    END IF;
  END IF;

  IF certifying THEN
    IF NEW.submission IS NULL OR jsonb_typeof(NEW.submission) <> 'object' THEN
      RAISE EXCEPTION 'Certification is required to submit' USING ERRCODE = '23514';
    END IF;
    IF btrim(COALESCE(NEW.submission ->> 'signer_name', '')) = '' THEN
      RAISE EXCEPTION 'Certification requires the signer''s name' USING ERRCODE = '23514';
    END IF;
    IF btrim(COALESCE(NEW.submission ->> 'signer_title', '')) = '' THEN
      RAISE EXCEPTION 'Certification requires the signer''s role' USING ERRCODE = '23514';
    END IF;
    IF btrim(COALESCE(NEW.submission ->> 'consent_text', '')) = '' OR btrim(COALESCE(NEW.submission ->> 'consent_version', '')) = '' THEN
      RAISE EXCEPTION 'Certification requires the consent wording the signer agreed to' USING ERRCODE = '23514';
    END IF;
    BEGIN
      PERFORM (NEW.submission ->> 'signed_at')::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Certification requires a valid signing date and time' USING ERRCODE = '23514';
    END;
    IF (NEW.submission -> 'chamber_data') IS DISTINCT FROM NEW.chamber_data THEN
      RAISE EXCEPTION 'Certified data must match the saved session' USING ERRCODE = '23514';
    END IF;

    -- The certification on record sent again (the same signer, signing time, PEO and answers): a second
    -- click, or a retry after a lost response. Nothing new was certified, so the record stands as it is.
    IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND jsonb_typeof(OLD.submission) = 'object'
       AND NEW.chamber_data IS NOT DISTINCT FROM OLD.chamber_data
       AND btrim(NEW.submission ->> 'signer_name') = btrim(COALESCE(OLD.submission ->> 'signer_name', ''))
       AND btrim(NEW.submission ->> 'signer_title') = btrim(COALESCE(OLD.submission ->> 'signer_title', ''))
       AND (NEW.submission ->> 'signed_at')::timestamptz = (OLD.submission ->> 'signed_at')::timestamptz
       AND NEW.submission ->> 'consent_version' = OLD.submission ->> 'consent_version'
       AND (NEW.submission -> 'peo') IS NOT DISTINCT FROM (OLD.submission -> 'peo') THEN
      NEW.submission := OLD.submission;
      RETURN NEW;
    END IF;

    hash := encode(sha256(convert_to(NEW.chamber_data::text, 'UTF8')), 'hex');
    -- The intake's own File ID, or the one any earlier certification of it recorded (withdrawn or not)
    -- unless another intake carries it (two intakes once shared one; the backfill left it with the older),
    -- or the next one in this year's sequence.
    reference := COALESCE(
      NULLIF(btrim(NEW.file_id), ''),
      (SELECT NULLIF(btrim(c.file_id), '') FROM public.chamber_certifications c
        WHERE c.session_id = NEW.id AND NULLIF(btrim(c.file_id), '') IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.chamber_sessions o WHERE o.file_id = btrim(c.file_id) AND o.id <> NEW.id)
        ORDER BY c.recorded_at DESC, c.id DESC LIMIT 1),
      public.next_submission_reference(EXTRACT(YEAR FROM (now() AT TIME ZONE 'UTC'))::integer)
    );
    NEW.file_id := reference;
    cert_version := (SELECT count(*) FROM public.chamber_certifications c WHERE c.session_id = NEW.id) + 1;
    -- What chamber_sessions_data_version (which runs after this trigger) will set.
    certified_data_version := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE OLD.data_version + 1 END;
    -- The client can't set these: they always reflect what the database saw. (The document list and the
    -- conversation are stamped beside them by snapshot_certified_evidence, 20261104112000, which fires next.)
    -- The provenance is the row's (S-1): advisors read the certified copy, so it can't be the browser's own.
    NEW.submission := NEW.submission || jsonb_build_object(
      'certified_at', now(),
      'data_sha256', hash,
      'file_id', reference,
      'version', cert_version,
      'data_version', certified_data_version,
      'schema_version', NEW.schema_version,
      'field_provenance', NEW.field_provenance
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND NEW.chamber_data IS DISTINCT FROM OLD.chamber_data THEN
    -- Answers changed after certification: the old certification no longer covers them.
    NEW.status := 'in_progress';
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------- S-2: document rows whose file never arrives ----------

-- How many of a prospect's documents (on any of their intakes) are still waiting for a file that hasn't been
-- stored in either bucket. Rows are written before their file (document-upload), so a few are always in
-- flight; a pile of them is rows written straight to the table.
CREATE OR REPLACE FUNCTION public.documents_limit_unstored()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The caller's API role (current_user is this function's owner): privileged writes aren't limited.
  IF COALESCE(current_setting('role', true), 'none') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF (SELECT count(*) FROM public.documents d
       WHERE d.user_id = NEW.user_id AND d.scan_verdict = 'pending'
         AND NOT EXISTS (SELECT 1 FROM storage.objects o
                          WHERE o.bucket_id IN ('documents', 'quarantine') AND o.name = d.storage_path)) >= 25 THEN
    RAISE EXCEPTION 'Up to 25 uploads can be waiting to finish at once; try again in a few minutes'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.documents_limit_unstored() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS documents_limit_unstored ON public.documents;
CREATE TRIGGER documents_limit_unstored
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_limit_unstored();

-- As in 20261104130000_document_scanning.sql, except that a document whose file never arrived and whose
-- upload window has passed is removed ('gone') rather than retried into a scan_failed alert: its upload
-- stopped between writing the row and storing the file, or the row was written straight to the table.
CREATE OR REPLACE FUNCTION public.fail_document_scan(p_document_id uuid, p_error text, p_retry_in_seconds integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.documents;
  code text := COALESCE(public.ops_clean_code(p_error), 'unknown');
BEGIN
  SELECT * INTO d FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR d.scan_verdict <> 'pending' THEN
    RETURN 'gone';
  END IF;

  IF code LIKE 'file_missing%'
     AND d.created_at < now() - interval '15 minutes'
     AND NOT EXISTS (SELECT 1 FROM storage.objects o
                      WHERE o.bucket_id IN ('documents', 'quarantine') AND o.name = d.storage_path) THEN
    DELETE FROM public.documents WHERE id = p_document_id;
    RETURN 'gone';
  END IF;

  IF d.scan_attempts >= public.document_scan_max_attempts() THEN
    UPDATE public.documents
    SET scan_verdict = 'failed', scan_error = code, scan_locked_until = NULL
    WHERE id = p_document_id;
    PERFORM public.record_ops_event('scan_failed', 'document-scan', code, NULL, d.user_id, d.session_id);
    RETURN 'failed';
  END IF;

  UPDATE public.documents
  SET scan_error = code,
      scan_locked_until = NULL,
      scan_next_at = now() + make_interval(secs => LEAST(GREATEST(COALESCE(p_retry_in_seconds, 300), 60), 86400))
  WHERE id = p_document_id;
  RETURN 'retrying';
END;
$$;

REVOKE ALL ON FUNCTION public.fail_document_scan(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_document_scan(uuid, text, integer) TO service_role;

-- ---------- S-3: size caps ----------
-- NOT VALID: rows already stored aren't checked, every new write is. Each cap is well above the largest real
-- intake: chamber_data holds a 5,000-employee census with every column in about 3 MB; a conversation is a few
-- hundred messages; provenance is a short record per field; a certification copies the answers, provenance,
-- conversation and document list, so its cap is the sum of theirs and some.

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_company_name_length CHECK (char_length(company_name) <= 200) NOT VALID,
  ADD CONSTRAINT profiles_contact_name_length CHECK (char_length(contact_name) <= 200) NOT VALID;

ALTER TABLE public.chamber_sessions
  ADD CONSTRAINT chamber_sessions_chamber_data_size CHECK (pg_column_size(chamber_data) <= 16 * 1024 * 1024) NOT VALID,
  ADD CONSTRAINT chamber_sessions_field_provenance_size CHECK (pg_column_size(field_provenance) <= 1024 * 1024) NOT VALID,
  ADD CONSTRAINT chamber_sessions_transcript_size CHECK (
    pg_column_size(transcript) <= 8 * 1024 * 1024
    AND CASE WHEN jsonb_typeof(transcript) = 'array' THEN jsonb_array_length(transcript) <= 2000 ELSE true END
  ) NOT VALID,
  ADD CONSTRAINT chamber_sessions_submission_size CHECK (pg_column_size(submission) <= 32 * 1024 * 1024) NOT VALID;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_text_length CHECK (
    char_length(file_name) <= 255
    AND char_length(file_size) <= 32
    AND char_length(mime_type) <= 255
    AND char_length(storage_path) <= 1024
    AND char_length(metadata) <= 4000
  ) NOT VALID,
  ADD CONSTRAINT documents_extraction_size CHECK (pg_column_size(extraction) <= 16 * 1024 * 1024) NOT VALID;

-- A sign-up's company name is clipped rather than refused (the profile caps it at 200 characters).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, company_name)
  VALUES (NEW.id, left(NULLIF(trim(NEW.raw_user_meta_data ->> 'company_name'), ''), 200));
  RETURN NEW;
END;
$function$;

-- ---------- S-1, S-3: the advisor queue ----------
-- As in 20261104133000_queue_hides_empty_guest_drafts.sql, except that the File ID is the column the database
-- assigns, the signer is the certification's (in force, or the latest on record once withdrawn), and the
-- company, contact and signer are clipped to 200 characters.
CREATE OR REPLACE FUNCTION public.advisor_list_submissions(
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_needs_action boolean DEFAULT NULL
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
    count(*) OVER ()
  FROM matched m
  -- Certified is the intake's status; its date only orders the group. Rows submitted before the
  -- server stamped certifications have no certified_at: they stay in the group, after the stamped ones.
  ORDER BY (m.status = 'submitted') DESC, m.certified_at DESC NULLS LAST, m.updated_at DESC, m.id
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.advisor_list_submissions(text, text, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_list_submissions(text, text, integer, integer, boolean) TO authenticated;

-- ---------- S-6: lapsed claims are cancelled too ----------
-- As in 20261105091000_draft_expiry_reminders.sql, except that both cancellations also take a claim that
-- lapsed (its worker died mid-send), which the claim below would otherwise take again and send.
CREATE OR REPLACE FUNCTION public.claim_outbox_events(
  p_kinds text[],
  p_batch integer,
  p_max_attempts integer,
  p_lock_seconds integer DEFAULT 600
)
RETURNS SETOF public.outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.outbox_events e
  SET status = 'suppressed', last_error = left('suppressed: ' || s.reason, 200),
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  FROM public.email_suppressions s
  WHERE public.outbox_kind_reaches_prospect(e.kind)
    AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    AND s.address = lower(btrim(e.payload ->> 'recipient_email'));

  -- A draft reminder whose reason has gone is not sent: its owner stopped reminders, or the draft no longer closes
  -- when it says (a change moved the closing time; certifying, archiving or expiry ended it).
  UPDATE public.outbox_events e
  SET status = 'suppressed',
      last_error = CASE WHEN p.draft_reminders_at IS NULL THEN 'cancelled: reminders turned off' ELSE 'cancelled: the draft changed' END,
      claimed_at = NULL, locked_until = NULL, pending_send = NULL
  FROM public.chamber_sessions s
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE e.kind = 'draft_expiry_reminder'
    AND ((e.status = 'pending' AND e.next_attempt_at <= now()) OR (e.status = 'claimed' AND e.locked_until < now()))
    AND s.id = e.session_id
    AND (p.draft_reminders_at IS NULL
         OR s.status <> 'in_progress'
         OR s.expires_at IS NULL
         OR to_char(s.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') IS DISTINCT FROM e.payload ->> 'expires_at');

  RETURN QUERY
  UPDATE public.outbox_events e
  SET status = 'claimed', attempts = e.attempts + 1, claimed_at = now(),
      locked_until = now() + make_interval(secs => p_lock_seconds)
  WHERE e.id IN (
    SELECT o.id
    FROM public.outbox_events o
    WHERE o.kind = ANY (p_kinds)
      AND o.attempts < p_max_attempts
      AND ((o.status = 'pending' AND o.next_attempt_at <= now()) OR (o.status = 'claimed' AND o.locked_until < now()))
    ORDER BY o.next_attempt_at, o.created_at
    LIMIT p_batch
    FOR UPDATE SKIP LOCKED
  )
  RETURNING e.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbox_events(text[], integer, integer, integer) TO service_role;
