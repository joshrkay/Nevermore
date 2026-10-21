-- Document categories follow the intake guidance: a current PEO invoice and a prior proposal are
-- separate kinds of document. 'prior_invoices' only ever held invoices, so it becomes 'peo_invoice'.
ALTER TABLE public.documents DROP CONSTRAINT documents_category_check;
UPDATE public.documents SET category = 'peo_invoice' WHERE category = 'prior_invoices';
ALTER TABLE public.documents ADD CONSTRAINT documents_category_check
  CHECK (category IN ('census', 'benefits', 'payroll', 'workers_comp', 'peo_invoice', 'prior_proposal', 'other'));

-- Reading or deleting a stored file requires owning the intake it is stored under, the same as
-- reading its row. Objects are stored at {user_id}/{session_id}/{file}; files from before intakes
-- existed sit directly under {user_id}/ and stay reachable by their owner.
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

CREATE POLICY "Users can view documents in their own sessions"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.chamber_sessions s
      WHERE s.id::text = (storage.foldername(name))[2] AND s.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete documents in their own sessions"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    (storage.foldername(name))[2] IS NULL
    OR EXISTS (
      SELECT 1 FROM public.chamber_sessions s
      WHERE s.id::text = (storage.foldername(name))[2] AND s.user_id = auth.uid()
    )
  )
);
