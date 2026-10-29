-- Document handling for census ingestion (Epic E).
--
-- * Document categories take the names underwriting uses: employee_census, benefits_summary,
--   payroll_report and workers_comp_loss_runs (peo_invoice, prior_proposal and other are unchanged).
-- * Each document records the SHA-256 of its file, and an intake can't hold the same file twice.
-- * An intake holds at most 25 documents, and the 'documents' bucket refuses files over 20 MB or of
--   a type the intake doesn't take, so the limits the upload screen shows hold on the server too.

-- ---------- Categories ----------

ALTER TABLE public.documents DROP CONSTRAINT documents_category_check;
UPDATE public.documents SET category = CASE category
  WHEN 'census' THEN 'employee_census'
  WHEN 'benefits' THEN 'benefits_summary'
  WHEN 'payroll' THEN 'payroll_report'
  WHEN 'workers_comp' THEN 'workers_comp_loss_runs'
  ELSE category
END
WHERE category IN ('census', 'benefits', 'payroll', 'workers_comp');
ALTER TABLE public.documents ADD CONSTRAINT documents_category_check CHECK (category IN (
  'employee_census', 'benefits_summary', 'payroll_report',
  'workers_comp_loss_runs', 'peo_invoice', 'prior_proposal', 'other'
));

-- ---------- File fingerprint and extraction default ----------

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_sha256 text CHECK (file_sha256 IS NULL OR file_sha256 ~ '^[0-9a-f]{64}$');
CREATE UNIQUE INDEX IF NOT EXISTS documents_session_file_sha256_key
  ON public.documents (session_id, file_sha256)
  WHERE file_sha256 IS NOT NULL;

ALTER TABLE public.documents ALTER COLUMN extraction SET DEFAULT '{}'::jsonb;

-- ---------- Upload limits ----------

CREATE OR REPLACE FUNCTION public.documents_limit_per_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL
    AND (SELECT count(*) FROM public.documents d WHERE d.session_id = NEW.session_id) >= 25 THEN
    RAISE EXCEPTION 'An intake can hold up to 25 documents' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_limit_per_session ON public.documents;
CREATE TRIGGER documents_limit_per_session
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_limit_per_session();

-- Storage enforces these on upload. Older or stand-in storage schemas without the columns are left alone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types'
  ) THEN
    UPDATE storage.buckets
    SET file_size_limit = 20 * 1024 * 1024,
        allowed_mime_types = ARRAY[
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/csv',
          'application/csv',
          'text/comma-separated-values',
          'text/plain'
        ]
    WHERE id = 'documents';
  END IF;
END $$;
