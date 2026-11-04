-- One open draft per prospect (A-1). Two tabs, or two quick loads, could each start an intake for the same
-- person, leaving two drafts and the answers split between them. Now the database refuses a second one.
--
-- * An open draft is an intake that is in progress and has never been certified. A certified intake that
--   was changed afterwards is back in progress, but it is a changed submission, not a draft: Start over
--   keeps it (archive_chamber_session answers 'kept') and starts a new intake beside it, so it doesn't count.
-- * A new intake from the browser (current_user anon or authenticated) is refused while its owner has an
--   open draft, with SQLSTATE EA009 and that draft's id in DETAIL, so the Chamber can offer it instead.
--   PostgREST answers it with HTTP 400. The draft is the caller's own, so naming it reveals nothing.
-- * Two inserts for the same person at the same moment take turns on a transaction-scoped advisory lock,
--   so the second sees the first and is refused.
-- * Only inserts are checked. Existing rows are untouched, so a person who already has two open drafts
--   keeps both (the Chamber opens the latest); it just can't start a third.
-- * It runs as the caller, under row security: the owner can see their own intakes and certifications,
--   which is all it reads. Jobs, migrations and the service role are not checked.
--
-- Deploy order: either way round. A front end without the handling reports the refusal as a failure to
-- start the intake, and offers Retry; the new front end works against the old database.

CREATE OR REPLACE FUNCTION public.refuse_second_open_draft()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  open_id uuid;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR NEW.status IS DISTINCT FROM 'in_progress' THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('chamber_sessions open draft ' || NEW.user_id::text, 0));
  SELECT s.id INTO open_id
  FROM public.chamber_sessions s
  WHERE s.user_id = NEW.user_id
    AND s.status = 'in_progress'
    AND NOT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = s.id)
  ORDER BY s.last_activity_at DESC NULLS LAST
  LIMIT 1;
  IF open_id IS NOT NULL THEN
    RAISE EXCEPTION 'You already have an intake in progress'
      USING ERRCODE = 'EA009', DETAIL = open_id::text,
            HINT = 'Open the intake in progress, or start over from it.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_second_open_draft() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamber_sessions_one_open_draft ON public.chamber_sessions;
CREATE TRIGGER chamber_sessions_one_open_draft
  BEFORE INSERT ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_second_open_draft();
