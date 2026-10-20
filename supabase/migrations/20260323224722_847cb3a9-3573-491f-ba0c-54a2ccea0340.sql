
-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- RLS policies for storage
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create documents table to track uploads
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own documents"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own documents"
ON public.documents FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
ON public.documents FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
ON public.documents FOR DELETE TO authenticated
USING (auth.uid() = user_id);
