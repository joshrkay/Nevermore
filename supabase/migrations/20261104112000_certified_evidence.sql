-- What the prospect certified includes the evidence an advisor checks it against.
--
-- Before this, certifying froze the answers (submission.chamber_data) but not the conversation they came
-- from or the uploaded documents: a prospect could rewrite the transcript, delete or re-categorise a
-- document on a certified intake, and the advisor reviewed whatever was there now, with no record of
-- the change. Now:
--   * Certifying stamps a copy of the transcript and of the document list (id, name, category, size,
--     storage path, SHA-256) into the submission, beside the answers. The advisor reviews those.
--   * Every document added, removed, renamed or re-categorised is written to document_events (who and
--     when), which advisors can read and nobody can change.
--   * While an intake is certified, the stored file of a document it was certified with stays when the
--     prospect removes the document, so the advisor can still open it. The prospect's own screens are
--     unchanged: removing a document still succeeds for them.

-- ---------- The certified copy of the transcript and the documents ----------

-- Runs after validate_certification (triggers fire in name order), on the same test of "certifying".
CREATE OR REPLACE FUNCTION public.snapshot_certified_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission) THEN
    NEW.submission := NEW.submission || jsonb_build_object(
      'transcript', COALESCE(NEW.transcript, '[]'::jsonb),
      'documents', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', d.id, 'file_name', d.file_name, 'file_size', d.file_size, 'category', d.category,
                 'status', d.status, 'storage_path', d.storage_path, 'file_sha256', d.file_sha256,
                 'created_at', d.created_at)
               ORDER BY d.created_at, d.id)
        FROM public.documents d
        WHERE d.session_id = NEW.id
      ), '[]'::jsonb));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_certified_evidence() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_sessions_certification_validate_evidence
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_certified_evidence();

-- ---------- Who changed which document, and when ----------

CREATE TABLE public.document_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- No foreign keys on purpose: the record must outlive the document and the intake.
  session_id uuid,
  document_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('added', 'removed', 'renamed', 'recategorised')),
  file_name text NOT NULL,
  from_value text,
  to_value text,
  actor_id uuid,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX document_events_session_idx ON public.document_events (session_id, id DESC);

ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advisors can view document events"
  ON public.document_events FOR SELECT TO authenticated
  USING ((SELECT public.is_advisor()));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.document_events FROM anon, authenticated;

CREATE TRIGGER document_events_append_only
  BEFORE UPDATE OR DELETE ON public.document_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_change();

CREATE OR REPLACE FUNCTION public.record_document_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_email text := CASE WHEN auth.uid() IS NOT NULL THEN auth.jwt() ->> 'email' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.document_events (session_id, document_id, kind, file_name, to_value, actor_id, actor_email)
    VALUES (NEW.session_id, NEW.id, 'added', NEW.file_name, NEW.category, actor, actor_email);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.document_events (session_id, document_id, kind, file_name, from_value, actor_id, actor_email)
    VALUES (OLD.session_id, OLD.id, 'removed', OLD.file_name, OLD.category, actor, actor_email);
  ELSE
    IF NEW.file_name IS DISTINCT FROM OLD.file_name THEN
      INSERT INTO public.document_events (session_id, document_id, kind, file_name, from_value, to_value, actor_id, actor_email)
      VALUES (NEW.session_id, NEW.id, 'renamed', NEW.file_name, OLD.file_name, NEW.file_name, actor, actor_email);
    END IF;
    IF NEW.category IS DISTINCT FROM OLD.category THEN
      INSERT INTO public.document_events (session_id, document_id, kind, file_name, from_value, to_value, actor_id, actor_email)
      VALUES (NEW.session_id, NEW.id, 'recategorised', NEW.file_name, OLD.category, NEW.category, actor, actor_email);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.record_document_event() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER documents_record_event
  AFTER INSERT OR DELETE OR UPDATE OF file_name, category ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.record_document_event();

-- ---------- A certified document's file stays for the advisor ----------

-- True when `p_name` is the stored file of a document the caller's intake is certified with right now.
-- Used by the storage policy below; it answers only for the caller's own intakes.
CREATE OR REPLACE FUNCTION public.is_certified_evidence(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chamber_sessions s
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(s.submission -> 'documents') = 'array' THEN s.submission -> 'documents' ELSE '[]'::jsonb END
    ) AS d(doc)
    WHERE s.id::text = (storage.foldername(p_name))[2]
      AND s.user_id = auth.uid()
      AND s.status = 'submitted'
      AND d.doc ->> 'storage_path' = p_name
  );
$$;

REVOKE ALL ON FUNCTION public.is_certified_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_certified_evidence(text) TO authenticated;

-- Unchanged from 20261023090000_document_categories_and_storage_access.sql except for the last line.
-- A refused delete removes nothing and reports no error, so the prospect's screen still shows the
-- document gone (its row is deleted, and recorded in document_events).
DROP POLICY "Users can delete documents in their own sessions" ON storage.objects;
CREATE POLICY "Users can delete documents in their own sessions"
  ON storage.objects FOR DELETE TO authenticated
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
    AND NOT public.is_certified_evidence(name)
  );
