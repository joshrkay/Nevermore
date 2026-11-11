-- Quote request notes (joshrkay/Nevermore#92, story M-2.5): what happened on a quote request outside the product.
--
-- * public.quote_request_notes: a dated entry an advisor adds to one quote request, with its kind: a call, a
--   portal entry, an email sent elsewhere, an underwriter's question, or other (GLOSSARY.md, Quote request note).
--   A note changes nothing else: it never records a send, sets the version sent or changes the status, and it can
--   be added to a closed quote request, which stays closed. The quote request's own `note` column stays, as the
--   request's summary.
-- * A note's kind, date and text can be corrected. Each correction is logged in public.quote_request_events, one
--   row per value changed (note_kind, note_noted_on, note_body) with the old value, naming the note in the new
--   `note_id` column. The log is still append-only.
-- * advisor_add_quote_request_note() and advisor_correct_quote_request_note() are the only writers.
-- * Underwriters' questions become notes of that kind. Each one already recorded (a quote_request_events row with
--   field 'underwriter_question') is copied to a note dated the day it was recorded, by whoever recorded it; the
--   log row stays, since the log is never changed. advisor_note_underwriter_question() now adds a note.
-- * complete_intake_deletion() deletes an intake's notes with the rest of it.
--
-- Advisors read the notes; prospects read none, even for their own submission.
--
-- Deploy this migration before the front end that reads notes. The older front end keeps working against it, with
-- one gap until the new one is live: a question it saves is stored as a note, which it doesn't show.

SET lock_timeout = '5s';

CREATE TABLE public.quote_request_notes (
  id bigserial PRIMARY KEY,
  quote_request_id bigint NOT NULL REFERENCES public.quote_requests (id),
  session_id uuid NOT NULL,
  kind text NOT NULL,
  noted_on date NOT NULL,
  body text NOT NULL,
  created_by uuid,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- What kind of thing happened (QUOTE_NOTE_KINDS in src/data/quoteRequests.ts; schemaSync compares them).
ALTER TABLE public.quote_request_notes ADD CONSTRAINT quote_request_notes_kind_check CHECK (kind IN (
  -- sync:begin quote_request_note_kinds
  'call', 'portal_entry', 'email_elsewhere', 'underwriter_question', 'other'
  -- sync:end quote_request_note_kinds
));
ALTER TABLE public.quote_request_notes ADD CONSTRAINT quote_request_notes_body_check CHECK (
  body = btrim(body) AND char_length(body) BETWEEN 1 AND 2000
);

CREATE INDEX quote_request_notes_by_request ON public.quote_request_notes (quote_request_id);
CREATE INDEX quote_request_notes_by_session ON public.quote_request_notes (session_id);

-- Which note a logged correction belongs to; null for a change to the quote request itself.
ALTER TABLE public.quote_request_events ADD COLUMN note_id bigint;

-- Logs every value a correction changed, one row each, with the old value. A new note logs nothing: the note
-- itself says who wrote it and when. Runs for every update, so no function can correct a note unlogged.
CREATE FUNCTION public.log_quote_request_note_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF (NEW.id, NEW.quote_request_id, NEW.session_id, NEW.created_by, NEW.created_by_email, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.quote_request_id, OLD.session_id, OLD.created_by, OLD.created_by_email, OLD.created_at) THEN
    RAISE EXCEPTION 'Only a note''s kind, date and text can be corrected' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.quote_request_events (quote_request_id, session_id, note_id, field, old_value, new_value, changed_by, changed_by_email)
  SELECT NEW.quote_request_id, NEW.session_id, NEW.id, 'note_' || n.key, o.value, n.value, auth.uid(), auth.jwt() ->> 'email'
  FROM jsonb_each_text(to_jsonb(NEW)) n
  JOIN jsonb_each_text(to_jsonb(OLD)) o ON o.key = n.key
  WHERE n.key IN ('kind', 'noted_on', 'body') AND n.value IS DISTINCT FROM o.value;
  RETURN NULL;
END;
$$;

CREATE TRIGGER quote_request_notes_log_change
  AFTER UPDATE ON public.quote_request_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_quote_request_note_change();

-- Advisors read notes; nobody else does, the prospect included. Nobody writes them directly.
ALTER TABLE public.quote_request_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_request_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quote_request_notes TO authenticated;

CREATE POLICY quote_request_notes_advisor_read ON public.quote_request_notes
  FOR SELECT TO authenticated USING (public.is_advisor());

-- A note's kind, date and text as an advisor gave them, or the reason they can't be saved. The date is the day
-- the thing happened: it can be in the past, and up to a day ahead of the server's date, since an advisor east
-- of UTC is already on tomorrow's date when the server is not.
CREATE FUNCTION public.check_quote_request_note(p_kind text, p_noted_on date, p_body text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  body text := btrim(COALESCE(p_body, ''));
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN (
    -- sync:begin quote_request_note_kinds_checked
    'call', 'portal_entry', 'email_elsewhere', 'underwriter_question', 'other'
    -- sync:end quote_request_note_kinds_checked
  ) THEN
    RAISE EXCEPTION 'A note is a call, a portal entry, an email sent elsewhere, an underwriter''s question or other, not %', COALESCE(p_kind, 'nothing')
      USING ERRCODE = '22023';
  END IF;
  IF body = '' THEN
    RAISE EXCEPTION 'Write the note' USING ERRCODE = '22023';
  END IF;
  -- sync:begin quote_request_note_length
  IF char_length(body) > 2000 THEN
  -- sync:end quote_request_note_length
    RAISE EXCEPTION 'A note is limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF p_noted_on IS NULL THEN
    RAISE EXCEPTION 'Give the date it happened' USING ERRCODE = '22023';
  END IF;
  RETURN body;
END;
$$;

CREATE FUNCTION public.advisor_add_quote_request_note(p_quote_request_id bigint, p_kind text, p_noted_on date, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  req public.quote_requests;
  clean_body text;
  note public.quote_request_notes;
BEGIN
  PERFORM public.require_advisor();
  clean_body := public.check_quote_request_note(p_kind, p_noted_on, p_body);
  IF p_noted_on > current_date + 1 THEN
    RAISE EXCEPTION 'A note records something that has happened. Its date can''t be in the future' USING ERRCODE = '22023';
  END IF;
  -- Any status, a closed one included: a PEO that phones after its quote request closed can still be recorded.
  SELECT * INTO req FROM public.quote_requests WHERE id = p_quote_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO public.quote_request_notes (quote_request_id, session_id, kind, noted_on, body, created_by, created_by_email)
  VALUES (req.id, req.session_id, p_kind, p_noted_on, clean_body, auth.uid(), auth.jwt() ->> 'email')
  RETURNING * INTO note;
  RETURN to_jsonb(note);
END;
$$;

CREATE FUNCTION public.advisor_correct_quote_request_note(p_note_id bigint, p_kind text, p_noted_on date, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  clean_body text;
  note public.quote_request_notes;
BEGIN
  PERFORM public.require_advisor();
  clean_body := public.check_quote_request_note(p_kind, p_noted_on, p_body);
  IF p_noted_on > current_date + 1 THEN
    RAISE EXCEPTION 'A note records something that has happened. Its date can''t be in the future' USING ERRCODE = '22023';
  END IF;
  UPDATE public.quote_request_notes
  SET kind = p_kind, noted_on = p_noted_on, body = clean_body
  WHERE id = p_note_id
  RETURNING * INTO note;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN to_jsonb(note);
END;
$$;

-- ---------- Underwriters' questions ----------
-- Each question already recorded becomes a note, dated the day it was recorded (UTC), by whoever recorded it.
INSERT INTO public.quote_request_notes (quote_request_id, session_id, kind, noted_on, body, created_by, created_by_email, created_at)
SELECT e.quote_request_id, e.session_id, 'underwriter_question', (e.changed_at AT TIME ZONE 'UTC')::date,
       left(btrim(e.new_value), 2000), e.changed_by, e.changed_by_email, e.changed_at
FROM public.quote_request_events e
WHERE e.field = 'underwriter_question' AND btrim(COALESCE(e.new_value, '')) <> ''
  AND EXISTS (SELECT 1 FROM public.quote_requests r WHERE r.id = e.quote_request_id)
ORDER BY e.id;

-- Kept for the front end already deployed: a question is now a note of that kind, dated today.
CREATE OR REPLACE FUNCTION public.advisor_note_underwriter_question(p_quote_request_id bigint, p_question text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.require_advisor();
  IF btrim(COALESCE(p_question, '')) = '' THEN
    RAISE EXCEPTION 'Write the underwriter''s question' USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(p_question)) > 2000 THEN
    RAISE EXCEPTION 'A question is limited to 2000 characters' USING ERRCODE = '22023';
  END IF;
  RETURN public.advisor_add_quote_request_note(p_quote_request_id, 'underwriter_question', current_date, p_question);
END;
$$;

-- ---------- Deleting an intake ----------
-- As in 20261110090000_quote_requests.sql, plus the intake's quote request notes, deleted before the quote
-- requests they belong to.
CREATE OR REPLACE FUNCTION public.complete_intake_deletion(p_deletion_id uuid, p_files_deleted integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.intake_deletions;
  sid uuid;
  owner_id uuid;
  remaining integer;
  n integer;
  removed jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO d FROM public.intake_deletions WHERE id = p_deletion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deletion not found' USING ERRCODE = 'PT404';
  END IF;
  IF d.status <> 'claimed' THEN
    RAISE EXCEPTION 'Only a claimed deletion can be completed (this one is %)', d.status USING ERRCODE = '55000';
  END IF;
  sid := d.session_id;

  -- Hold the intake still while it is checked and deleted. This waits for any upload still in flight: each
  -- holds a share lock on the row from its policy check (intake_accepts_files) until it commits, so its file
  -- is visible to the check below, and any upload after this one finds the deletion open, or the intake gone.
  SELECT s.user_id INTO owner_id FROM public.chamber_sessions s WHERE s.id = sid FOR UPDATE;
  owner_id := COALESCE(owner_id, d.user_id);

  SELECT count(*)::integer INTO remaining FROM public.intake_stored_files(sid, owner_id);
  IF remaining > 0 THEN
    RAISE EXCEPTION 'The intake still has % stored file(s); remove them first', remaining
      USING ERRCODE = 'EA006', DETAIL = remaining::text;
  END IF;

  PERFORM set_config('eaa.deleting_intake', sid::text, true);

  -- Children first, so each count says what that table held; the session row last.
  DELETE FROM public.manuscript_versions WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('manuscript_versions', n);
  DELETE FROM public.advisor_review_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_review_events', n);
  DELETE FROM public.advisor_field_reviews WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_field_reviews', n);
  DELETE FROM public.advisor_notes WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('advisor_notes', n);
  DELETE FROM public.information_requests WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('information_requests', n);
  DELETE FROM public.submission_status_history WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('submission_status_history', n);
  DELETE FROM public.submission_workflow WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('submission_workflow', n);
  -- After the pipeline row, which names the winning quote request.
  DELETE FROM public.quote_request_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_events', n);
  DELETE FROM public.quote_request_notes WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_request_notes', n);
  DELETE FROM public.quote_requests WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('quote_requests', n);
  DELETE FROM public.intake_lifecycle_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('intake_lifecycle_events', n);
  DELETE FROM public.outbox_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('outbox_events', n);
  DELETE FROM public.chamber_certifications WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('chamber_certifications', n);
  DELETE FROM public.document_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('document_events', n);
  DELETE FROM public.documents WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('documents', n);
  DELETE FROM public.ai_extraction_events WHERE session_id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('ai_extraction_events', n);
  -- Operational events stay (they are counts for monitoring) but no longer point at the intake.
  UPDATE public.ops_events SET session_id = NULL WHERE session_id = sid;
  -- So are the funnel's milestones: how far the intake got stays, with no link to whose it was.
  UPDATE public.intake_milestones SET session_id = NULL WHERE session_id = sid;
  DELETE FROM public.chamber_sessions WHERE id = sid;
  GET DIAGNOSTICS n = ROW_COUNT; removed := removed || jsonb_build_object('chamber_sessions', n);

  PERFORM set_config('eaa.deleting_intake', '', true);

  UPDATE public.intake_deletions
  SET status = 'done',
      completed_at = now(),
      locked_until = NULL,
      last_error = NULL,
      files_deleted = GREATEST(COALESCE(p_files_deleted, 0), 0),
      rows_deleted = removed
  WHERE id = d.id;
  RETURN removed;
END;
$$;

-- ---------- Who may call what ----------
REVOKE ALL ON FUNCTION public.advisor_add_quote_request_note(bigint, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_add_quote_request_note(bigint, text, date, text) TO authenticated;
REVOKE ALL ON FUNCTION public.advisor_correct_quote_request_note(bigint, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advisor_correct_quote_request_note(bigint, text, date, text) TO authenticated;
REVOKE ALL ON FUNCTION public.check_quote_request_note(text, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_quote_request_note_change() FROM PUBLIC, anon, authenticated;
