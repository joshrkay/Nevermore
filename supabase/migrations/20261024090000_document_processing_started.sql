-- When a read of a document began, so a read that has stopped can be told apart from one still
-- running (in another tab, or from before the page was reopened).
ALTER TABLE public.documents ADD COLUMN processing_started_at timestamptz;
