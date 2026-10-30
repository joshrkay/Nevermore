-- The advisor alert's headcount, now that the intake keeps its roster under `census`.
--
-- 20261027095000 derived `employee_count`, when the intake states none, from the W-2 rows of the
-- old `employees` roster. The intake now keeps that roster as `census` (classification `w2` or
-- `1099`, lowercase), so a submission with a census and no stated count went out without one. This
-- counts the census's W-2 rows first and falls back to `employees`. Nothing else changes: the same
-- notification, the same dedupe key, and the same grants (CREATE OR REPLACE keeps them).

SET lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.enqueue_certification_notifications(p_certification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cert public.chamber_certifications;
  s public.chamber_sessions;
  prof public.profiles;
  account_email text;
  company text;
  reference text;
  dedupe text;
  is_update boolean;
  headcount integer;
  hq text;
BEGIN
  -- Locked, so "still active" stays true until this transaction ends: a re-certification waits.
  SELECT * INTO cert FROM public.chamber_certifications WHERE id = p_certification_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'certification % does not exist', p_certification_id USING ERRCODE = 'P0002';
  END IF;
  IF cert.superseded_at IS NOT NULL THEN
    -- The newer certification carries the current data; alerting for this one would be stale.
    RAISE EXCEPTION 'certification % is superseded', p_certification_id;
  END IF;

  SELECT * INTO s FROM public.chamber_sessions WHERE id = cert.session_id;
  SELECT * INTO prof FROM public.profiles WHERE user_id = cert.user_id;
  SELECT u.email INTO account_email FROM auth.users u WHERE u.id = cert.user_id;

  company := COALESCE(NULLIF(btrim(s.chamber_data ->> 'company_name'), ''), NULLIF(btrim(prof.company_name), ''));
  -- Same fallback the advisor view uses (fileIdForSession) if the certification carries none.
  reference := left(COALESCE(
    NULLIF(btrim(cert.file_id), ''),
    'EAA-' || to_char(s.created_at, 'YYYY') || '-' || upper(left(replace(s.id::text, '-', ''), 8))
  ), 64);
  dedupe := cert.session_id::text || ':' || cert.data_sha256;
  -- Checked before inserting: an earlier alert for this intake makes this one an update.
  is_update := EXISTS (
    SELECT 1 FROM public.outbox_events WHERE session_id = cert.session_id AND kind = 'advisor_notification'
  );

  -- Nested CASEs, not AND: SQL does not promise to skip the cast when the type test fails.
  headcount := CASE
    WHEN jsonb_typeof(s.chamber_data -> 'employee_count') = 'number' THEN
      CASE WHEN (s.chamber_data ->> 'employee_count')::numeric BETWEEN 0 AND 10000000
           THEN round((s.chamber_data ->> 'employee_count')::numeric)::integer END
    -- No stated count: the W-2 rows of the census, or of the roster the census replaced (`employees`).
    ELSE COALESCE(
      NULLIF((SELECT count(*)::integer FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(s.chamber_data -> 'census') = 'array' THEN s.chamber_data -> 'census' ELSE '[]'::jsonb END) r
              WHERE lower(r ->> 'classification') = 'w2'), 0),
      NULLIF((SELECT count(*)::integer FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(s.chamber_data -> 'employees') = 'array' THEN s.chamber_data -> 'employees' ELSE '[]'::jsonb END) r
              WHERE r ->> 'classification' = 'W2'), 0)
    )
  END;
  hq := CASE
    WHEN jsonb_typeof(s.chamber_data -> 'hq_state') = 'string' AND (s.chamber_data ->> 'hq_state') ~ '^[A-Za-z]{2}$'
    THEN upper(s.chamber_data ->> 'hq_state')
  END;

  INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
  VALUES (
    'advisor_notification', cert.session_id, dedupe,
    jsonb_build_object(
      'reference', reference,
      'company_name', left(company, 200),
      'contact_name', left(COALESCE(NULLIF(btrim(prof.contact_name), ''), cert.signer_name), 200),
      'contact_email', account_email,
      'contact_phone', left(NULLIF(btrim(prof.phone), ''), 50),
      'signer_name', left(cert.signer_name, 200),
      'signer_title', left(cert.signer_title, 200),
      'employee_count', headcount,
      'hq_state', hq,
      -- The database's own stamp (what the advisor review shows), not the signer's browser clock.
      'certified_at', to_char(cert.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'resubmission', is_update
    )
  )
  ON CONFLICT (kind, dedupe_key) DO NOTHING;

  -- The confirmation goes to the signed-in account's own address: a certifying account is never
  -- anonymous (see block_guest_submission), and an address typed into the intake is not trusted.
  IF account_email IS NOT NULL AND btrim(account_email) <> '' THEN
    INSERT INTO public.outbox_events (kind, session_id, dedupe_key, payload)
    VALUES (
      'prospect_confirmation', cert.session_id, dedupe,
      jsonb_build_object(
        'reference', reference,
        'company_name', left(company, 200),
        'recipient_name', left(cert.signer_name, 200),
        'recipient_email', account_email
      )
    )
    ON CONFLICT (kind, dedupe_key) DO NOTHING;
  END IF;

  -- Last, so the marker is only ever set once everything above has happened.
  UPDATE public.chamber_certifications SET outbox_queued_at = now() WHERE id = p_certification_id;
END;
$$;

RESET lock_timeout;
