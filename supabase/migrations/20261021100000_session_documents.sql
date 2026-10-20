-- Uploads belong to an intake (chamber_sessions row), not just to a user, and carry the
-- metadata Lenore and the advisor need: MIME type, size, category, processing status and
-- whatever was read out of them.

ALTER TABLE public.documents
  ADD COLUMN session_id uuid REFERENCES public.chamber_sessions(id) ON DELETE CASCADE,
  ADD COLUMN mime_type text,
  ADD COLUMN size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  ADD COLUMN category text NOT NULL DEFAULT 'other',
  ADD COLUMN extraction jsonb;

-- Rows uploaded before this migration have no intake. They stay owned by their user (and
-- deletable) but no longer appear in any intake's file list.
CREATE INDEX documents_session_created_idx ON public.documents (session_id, created_at);

UPDATE public.documents SET category = CASE doc_type
  WHEN 'Employee Census' THEN 'census'
  WHEN 'Benefits Invoice' THEN 'benefits'
  WHEN 'Plan Design' THEN 'benefits'
  WHEN 'W/C Loss Runs' THEN 'workers_comp'
  WHEN 'Payroll Report' THEN 'payroll'
  ELSE 'other'
END;
ALTER TABLE public.documents DROP COLUMN doc_type;

ALTER TABLE public.documents ADD CONSTRAINT documents_category_check
  CHECK (category IN ('census', 'benefits', 'payroll', 'workers_comp', 'prior_invoices', 'other'));

UPDATE public.documents SET status = 'uploaded'
  WHERE status NOT IN ('uploaded', 'processing', 'extracted', 'no_data', 'unsupported', 'encrypted', 'unreadable', 'too_large', 'failed');
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('uploaded', 'processing', 'extracted', 'no_data', 'unsupported', 'encrypted', 'unreadable', 'too_large', 'failed'));

-- Whose file it is, which intake it belongs to, and where it is stored never change after upload.
CREATE OR REPLACE FUNCTION public.documents_lock_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    RAISE EXCEPTION 'A document cannot be moved to another user, intake, or storage path'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER documents_lock_ownership
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_lock_ownership();

-- Access requires owning both the row and the intake it is attached to.
DROP POLICY "Users can insert their own documents" ON public.documents;
DROP POLICY "Users can view their own documents" ON public.documents;
DROP POLICY "Users can update their own documents" ON public.documents;
DROP POLICY "Users can delete their own documents" ON public.documents;

CREATE POLICY "Users can insert documents into their own sessions"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);

CREATE POLICY "Users can view documents in their own sessions"
ON public.documents FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  AND (session_id IS NULL
    OR EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
);

CREATE POLICY "Users can update documents in their own sessions"
ON public.documents FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);

CREATE POLICY "Users can delete documents in their own sessions"
ON public.documents FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  AND (session_id IS NULL
    OR EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
);

-- Stored objects live at {user_id}/{session_id}/{file}; new uploads must name an intake the
-- uploader owns. Reading and deleting keep the per-user folder rule.
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Users can upload documents into their own sessions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.chamber_sessions s
    WHERE s.id::text = (storage.foldername(name))[2] AND s.user_id = auth.uid()
  )
);
