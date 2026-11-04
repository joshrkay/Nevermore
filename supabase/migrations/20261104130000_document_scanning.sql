-- Uploaded documents are checked on the server before anything can read them (E-4.1, E-4.3).
--
-- * Files reach storage only through the document-upload edge function, which reads each file's leading
--   bytes (supabase/functions/_shared/fileSignature.ts) and refuses an executable, or contents that don't
--   match the file's name, before anything is stored. The prospect's own storage upload policy is dropped,
--   so a renamed file sent straight to the Storage API is refused too, not stored and later marked
--   `unsupported`. The bucket limits from 20261029090000 stay as a backstop.
-- * Every document carries a malware scan verdict that only the service role (and database functions)
--   can write: documents_guard_scan refuses it from the API roles. A prospect could always change their
--   document's `status` (document-extract writes it as them), so the verdict has its own columns.
-- * A file is readable only once its scan passed. document-upload scans the bytes before storing them: a
--   clean file goes to the `documents` bucket; an infected one, or one the scanner couldn't check yet, goes
--   to the `quarantine` bucket, which has no policies at all, so no signed-in caller can read, sign a link
--   to, list or delete anything in it. Reading a file in the `documents` bucket also needs its row's
--   verdict to have passed (public.is_withheld_document_file), which covers files uploaded before this
--   migration until they are scanned.
-- * document-scan, every five minutes, scans what is still pending (public.claim_document_scans), moves a
--   clean file out of quarantine and an infected legacy file into it, retries with backoff, and gives up
--   after six attempts (verdict `failed`, still unreadable). It also removes quarantined copies nothing
--   holds any more (public.document_scan_orphans).
-- * A detection records a `malware_detected` event and a scan that gave up a `scan_failed` event, and
--   ops-monitor alerts on the first of either (public.ops_alert_rules). The functions also post their
--   own MALWARE_DETECTED / SCAN_FAILED webhook at once (docs/RUNBOOK.md).
--
-- Verdicts:
--   pending   not scanned yet; unreadable (the file is in quarantine, or, for an older upload, withheld)
--   clean     the scanner found nothing; readable
--   skipped   the deployment runs without a scanner (MALWARE_SCANNER=none, M1 only); readable
--   infected  the scanner named a signature (scan_signature); quarantined and unreadable for good
--   failed    could not be scanned after every attempt (scan_error says why); unreadable until an operator
--             re-queues it (docs/RUNBOOK.md, "Scan failed")

-- ---------- Verdict columns ----------

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS scan_verdict text NOT NULL DEFAULT 'pending'
    CHECK (scan_verdict IN ('pending', 'clean', 'skipped', 'infected', 'failed')),
  ADD COLUMN IF NOT EXISTS scan_signature text CHECK (scan_signature IS NULL OR length(scan_signature) <= 200),
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS scan_attempts integer NOT NULL DEFAULT 0 CHECK (scan_attempts >= 0),
  -- Documents already stored are due at once; a new upload's own scan gets ten minutes first (below).
  ADD COLUMN IF NOT EXISTS scan_next_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS scan_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS scan_error text CHECK (scan_error IS NULL OR scan_error ~ '^[A-Za-z0-9_:.-]{1,80}$');

-- document-upload scans a new file itself; the sweep only picks it up if that didn't settle it, after the
-- upload has had time to finish (an edge function runs for at most 400 seconds).
ALTER TABLE public.documents ALTER COLUMN scan_next_at SET DEFAULT now() + interval '10 minutes';

COMMENT ON COLUMN public.documents.scan_verdict IS
  'Malware scan: pending, clean, skipped (no scanner configured), infected or failed. Written only by the service role (document-upload, document-scan); the file is readable only when clean or skipped.';

CREATE INDEX IF NOT EXISTS documents_storage_path_idx ON public.documents (storage_path);
CREATE INDEX IF NOT EXISTS documents_scan_due_idx ON public.documents (scan_next_at) WHERE scan_verdict = 'pending';

-- The API roles can't record or change a scan. A document a prospect adds from the API starts pending; the
-- service role and database functions (which run as their owner) write the verdict.
CREATE OR REPLACE FUNCTION public.documents_guard_scan()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.scan_verdict IS DISTINCT FROM 'pending' OR NEW.scan_signature IS NOT NULL OR NEW.scanned_at IS NOT NULL
       OR NEW.scan_attempts IS DISTINCT FROM 0 OR NEW.scan_locked_until IS NOT NULL OR NEW.scan_error IS NOT NULL THEN
      RAISE EXCEPTION 'Only the scanner records a document''s scan' USING ERRCODE = '42501';
    END IF;
    NEW.scan_next_at := now() + interval '10 minutes';
  ELSIF ROW(NEW.scan_verdict, NEW.scan_signature, NEW.scanned_at, NEW.scan_attempts, NEW.scan_next_at, NEW.scan_locked_until, NEW.scan_error)
        IS DISTINCT FROM ROW(OLD.scan_verdict, OLD.scan_signature, OLD.scanned_at, OLD.scan_attempts, OLD.scan_next_at, OLD.scan_locked_until, OLD.scan_error) THEN
    RAISE EXCEPTION 'Only the scanner records a document''s scan' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.documents_guard_scan() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS documents_guard_scan ON public.documents;
CREATE TRIGGER documents_guard_scan
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_guard_scan();

-- ---------- Buckets and file access ----------

INSERT INTO storage.buckets (id, name, public)
VALUES ('quarantine', 'quarantine', false)
ON CONFLICT (id) DO NOTHING;

-- Every document is stored as application/octet-stream, the one type a browser never shows inline, so a
-- signed link opens as a download even if its download parameter is removed (the parameter is not part of
-- what Storage signs). The type the bytes showed is kept in documents.mime_type. Older or stand-in storage
-- schemas without the limit columns are left alone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types'
  ) THEN
    UPDATE storage.buckets
    SET file_size_limit = 20 * 1024 * 1024,
        allowed_mime_types = ARRAY['application/octet-stream']
    WHERE id IN ('documents', 'quarantine');
  END IF;
END $$;

-- Only document-upload and document-scan (the service role) store documents now.
DROP POLICY IF EXISTS "Users can upload documents into their own sessions" ON storage.objects;

-- Whether a stored document's row says its file may not be read yet (or ever): its scan hasn't passed. A
-- file with no row (one from before intakes, or a certified file its prospect removed) is not withheld.
CREATE OR REPLACE FUNCTION public.is_withheld_document_file(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.storage_path = p_name AND d.scan_verdict NOT IN ('clean', 'skipped')
  );
$$;

REVOKE ALL ON FUNCTION public.is_withheld_document_file(text) FROM PUBLIC, anon;
-- Row security evaluates it as the reader.
GRANT EXECUTE ON FUNCTION public.is_withheld_document_file(text) TO authenticated, service_role;

-- Unchanged from 20261023090000_document_categories_and_storage_access.sql except for the last line.
DROP POLICY IF EXISTS "Users can view documents in their own sessions" ON storage.objects;
CREATE POLICY "Users can view documents in their own sessions"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.chamber_sessions s
      WHERE s.id::text = (storage.foldername(objects.name))[2] AND s.user_id = auth.uid()
    )
  )
  AND NOT public.is_withheld_document_file(name)
);

-- Unchanged from 20261022090000_advisor_operations.sql except for the last line.
DROP POLICY IF EXISTS "Advisors can read uploaded documents" ON storage.objects;
CREATE POLICY "Advisors can read uploaded documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.is_advisor() AND NOT public.is_withheld_document_file(name));

-- An intake's stored files include what is quarantined under it, so deleting the intake removes those too.
-- Otherwise as in 20261104092000_data_retention_and_deletion.sql.
CREATE OR REPLACE FUNCTION public.intake_stored_files(p_session_id uuid, p_user_id uuid)
RETURNS TABLE (bucket text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.bucket_id::text, o.name::text
  FROM storage.objects o
  WHERE (o.bucket_id IN ('documents', 'quarantine') AND p_user_id IS NOT NULL
         AND o.name LIKE p_user_id::text || '/' || p_session_id::text || '/%')
     OR (o.bucket_id = 'manuscripts' AND o.name LIKE p_session_id::text || '/%')
  ORDER BY 1, 2;
$$;

REVOKE ALL ON FUNCTION public.intake_stored_files(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_stored_files(uuid, uuid) TO service_role;

-- ---------- Alerts ----------

ALTER TABLE public.ops_events DROP CONSTRAINT IF EXISTS ops_events_kind_check;
ALTER TABLE public.ops_events ADD CONSTRAINT ops_events_kind_check CHECK (kind IN (
  'app_error', 'upload_failed', 'ai_failed', 'auth_denied', 'deletion_failed', 'malware_detected', 'scan_failed'
));

-- As in 20261104091000_ops_monitoring.sql, plus the two scan kinds: one event is enough.
CREATE OR REPLACE FUNCTION public.ops_alert_rules()
RETURNS TABLE (kind text, window_minutes integer, threshold integer, cooldown_minutes integer)
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  VALUES
    -- sync:begin ops_alert_rules
    ('app_error'::text, 15, 10, 60),
    ('upload_failed', 15, 5, 60),
    ('ai_failed', 15, 5, 60),
    ('auth_denied', 15, 20, 60),
    ('deletion_failed', 60, 1, 60),
    ('malware_detected', 60, 1, 60),
    ('scan_failed', 60, 1, 60)
    -- sync:end ops_alert_rules
$$;

REVOKE ALL ON FUNCTION public.ops_alert_rules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_alert_rules() TO authenticated, service_role;

-- ---------- The scan queue (service role only) ----------

-- How many times a document is tried before it is marked failed.
CREATE OR REPLACE FUNCTION public.document_scan_max_attempts()
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT 6 $$;

REVOKE ALL ON FUNCTION public.document_scan_max_attempts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.document_scan_max_attempts() TO service_role;

-- Takes up to p_batch pending documents that are due, each locked for p_lock_seconds and counted as an
-- attempt, with the bucket its file is in now (quarantine first; NULL when neither holds it). A document
-- whose last claim lapsed with every attempt used (its worker died) is marked failed first, and recorded.
CREATE OR REPLACE FUNCTION public.claim_document_scans(p_batch integer DEFAULT 10, p_lock_seconds integer DEFAULT 300)
RETURNS TABLE (document_id uuid, storage_path text, attempt integer, bucket text)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lost AS (
    UPDATE public.documents d
    SET scan_verdict = 'failed', scan_error = 'worker_lost', scan_locked_until = NULL
    WHERE d.scan_verdict = 'pending'
      AND d.scan_locked_until IS NOT NULL AND d.scan_locked_until < now()
      AND d.scan_attempts >= public.document_scan_max_attempts()
    RETURNING d.user_id, d.session_id
  )
  INSERT INTO public.ops_events (kind, source, code, user_id, session_id)
  SELECT 'scan_failed', 'document-scan', 'worker_lost', l.user_id, l.session_id FROM lost l;

  WITH due AS (
    SELECT d.id
    FROM public.documents d
    WHERE d.scan_verdict = 'pending'
      AND d.scan_next_at <= now()
      AND (d.scan_locked_until IS NULL OR d.scan_locked_until < now())
      AND d.scan_attempts < public.document_scan_max_attempts()
    ORDER BY d.scan_next_at, d.id
    LIMIT LEAST(GREATEST(COALESCE(p_batch, 10), 1), 50)
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.documents d
    SET scan_attempts = d.scan_attempts + 1,
        scan_locked_until = now() + make_interval(secs => LEAST(GREATEST(COALESCE(p_lock_seconds, 300), 30), 3600))
    FROM due
    WHERE d.id = due.id
    RETURNING d.id, d.storage_path, d.scan_attempts, d.scan_next_at
  )
  SELECT c.id, c.storage_path, c.scan_attempts,
    CASE
      WHEN EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'quarantine' AND o.name = c.storage_path) THEN 'quarantine'
      WHEN EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'documents' AND o.name = c.storage_path) THEN 'documents'
    END
  FROM claimed c
  ORDER BY c.scan_next_at, c.id;
$$;

REVOKE ALL ON FUNCTION public.claim_document_scans(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_document_scans(integer, integer) TO service_role;

-- Records a scan's verdict: clean, skipped (no scanner configured) or infected (with the signature it
-- matched). A detection is recorded as a malware_detected event, which ops-monitor alerts on. Raises PT404
-- when the document is gone (its prospect removed it meanwhile).
CREATE OR REPLACE FUNCTION public.record_document_scan(
  p_document_id uuid,
  p_verdict text,
  p_signature text DEFAULT NULL,
  p_source text DEFAULT 'document-scan'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.documents;
  sig text := left(NULLIF(btrim(p_signature), ''), 200);
BEGIN
  IF p_verdict IS NULL OR p_verdict NOT IN ('clean', 'skipped', 'infected') THEN
    RAISE EXCEPTION 'A scan verdict is clean, skipped or infected' USING ERRCODE = '22023';
  END IF;
  IF p_verdict = 'infected' AND sig IS NULL THEN
    RAISE EXCEPTION 'An infected verdict names the signature it matched' USING ERRCODE = '22023';
  END IF;

  UPDATE public.documents
  SET scan_verdict = p_verdict,
      scan_signature = CASE WHEN p_verdict = 'infected' THEN sig END,
      scanned_at = now(),
      scan_locked_until = NULL,
      scan_error = NULL
  WHERE id = p_document_id
  RETURNING * INTO d;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found' USING ERRCODE = 'PT404';
  END IF;

  IF p_verdict = 'infected' THEN
    PERFORM public.record_ops_event('malware_detected', COALESCE(p_source, 'document-scan'),
      'malware:' || COALESCE(public.ops_clean_code(sig), 'unnamed'), NULL, d.user_id, d.session_id);
  END IF;
  RETURN p_verdict;
END;
$$;

REVOKE ALL ON FUNCTION public.record_document_scan(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_document_scan(uuid, text, text, text) TO service_role;

-- A scan that didn't settle (the scanner was unreachable, the file couldn't be read). Tried again in
-- p_retry_in_seconds, or, once every attempt is used, marked failed and recorded as a scan_failed event.
-- Answers 'retrying', 'failed', or 'gone' when the document was removed or already has a verdict.
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

-- Quarantined files nothing holds there any more: their document was removed, or has passed its scan (and
-- so has its copy in the documents bucket). document-scan removes them. A new upload's row is written
-- before its file is stored, so a file on its way in is never listed.
CREATE OR REPLACE FUNCTION public.document_scan_orphans(p_limit integer DEFAULT 100)
RETURNS TABLE (name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.name::text
  FROM storage.objects o
  WHERE o.bucket_id = 'quarantine'
    AND NOT EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = o.name AND d.scan_verdict IN ('pending', 'infected', 'failed')
    )
  ORDER BY o.name
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000);
$$;

REVOKE ALL ON FUNCTION public.document_scan_orphans(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.document_scan_orphans(integer) TO service_role;

-- An operator puts a failed (or infected, after a false positive is confirmed) document back in the queue.
-- Its file stays unreadable until the next scan passes. Service role only (the SQL editor).
CREATE OR REPLACE FUNCTION public.requeue_document_scan(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.documents
  SET scan_verdict = 'pending', scan_signature = NULL, scanned_at = NULL, scan_attempts = 0,
      scan_next_at = now(), scan_locked_until = NULL, scan_error = NULL
  WHERE id = p_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found' USING ERRCODE = 'PT404';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.requeue_document_scan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_document_scan(uuid) TO service_role;

-- ---------- Schedule ----------

-- document-scan every five minutes, the same way purge-intakes is scheduled
-- (20261104092000_data_retention_and_deletion.sql): Vault holds the project URL and service-role key, the
-- job does nothing until both exist, and a missing pg_cron or pg_net is a notice, not a failed migration.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'scan schedule: pg_cron is not available (%); schedule document-scan another way (docs/RUNBOOK.md)', SQLERRM;
      RETURN;
    END;
  END IF;

  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'scan schedule: pg_net is not available (%); schedule document-scan another way (docs/RUNBOOK.md)', SQLERRM;
      RETURN;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'document-scan') THEN
    RAISE NOTICE 'scan schedule: a document-scan job already exists; leaving it as it is';
    RETURN;
  END IF;

  PERFORM cron.schedule('document-scan', '*/5 * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/document-scan',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'),
      body := '{}'::jsonb
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
      and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
  $job$);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'scan schedule: could not schedule document-scan (%); schedule it another way (docs/RUNBOOK.md)', SQLERRM;
END $$;
