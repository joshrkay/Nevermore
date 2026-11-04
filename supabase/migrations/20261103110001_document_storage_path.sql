-- A document's row must point at a file in its own intake's folder: {user_id}/{session_id}/{file}.
--
-- The insert policy checked user_id and session_id but not storage_path, so a prospect could add a row
-- to their own intake that pointed at another user's stored file. They still couldn't read that file
-- (the storage policies check the folder), but an advisor can read every file, and opening the row
-- would have shown them the other user's file as this prospect's document. The browser has always
-- stored files at {user_id}/{session_id}/{uuid}_{name}, so it is unaffected. documents_lock_ownership
-- already stops storage_path changing after insert, so this only has to hold on insert.
--
-- The file part is one path segment, and never "." or "..", so the path can't climb out of the folder.

DROP POLICY IF EXISTS "Users can insert documents into their own sessions" ON public.documents;
CREATE POLICY "Users can insert documents into their own sessions"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  -- uuids are hex and hyphens only, so they are safe to put in the pattern as they are.
  AND storage_path ~ ('^' || user_id::text || '/' || session_id::text || '/[^/]+$')
  AND split_part(storage_path, '/', 3) NOT IN ('.', '..')
);

-- Rows already stored are left as they are. Say how many intake documents point outside their own
-- folder, so an operator can look at them (rows from before intakes existed have no session and are
-- not counted).
DO $$
DECLARE
  stray integer;
BEGIN
  SELECT count(*) INTO stray
  FROM public.documents
  WHERE session_id IS NOT NULL
    AND storage_path !~ ('^' || user_id::text || '/' || session_id::text || '/[^/]+$');
  IF stray > 0 THEN
    RAISE NOTICE 'document storage path: % existing intake document(s) point outside {user_id}/{session_id}/; review them', stray;
  END IF;
END $$;
