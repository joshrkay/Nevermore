-- The transcript is source evidence (A-3), so the database now holds its shape the way it holds the
-- answers' (20261027090000_intake_validation_and_versioning.sql). Until now only "is a jsonb array" was
-- checked, so a client could store anything as a message.
--
-- * public.chamber_transcript_error(transcript) returns the first problem's path and reason, or nulls.
--   The transcript is a list of messages in the order they happened. A message is an object with:
--     id        text, not blank, at most 100 characters (required)
--     sender    'lenore', 'user' or 'system' (required): Lenore, the prospect, or a note from the Chamber
--     text      text, at most 20,000 characters (required)
--     timestamp text, at most 64 characters: an ISO 8601 instant since 2026-11-04, a local time of day
--               before that (optional)
--     kind      'greeting' (optional): Lenore's hello
--     spoken    a boolean (optional): said aloud in a voice call (D33)
--   and nothing else. The browser holds the same limits (src/data/chat.ts; src/data/schemaSync.test.ts
--   compares them), and what it writes, and what parseTranscript reads back from older rows, always fits.
-- * A write that breaks it changes nothing and raises SQLSTATE EA001, as an invalid answer does, with the
--   path (transcript[3].sender) in DETAIL and the reason in HINT. PostgREST answers it with HTTP 400. The
--   message text is never echoed.
-- * It runs on insert and whenever the transcript changes. Existing rows are not re-validated: a row
--   whose stored transcript breaks a rule stays editable in its other columns, and the browser rewrites
--   the whole transcript from what parseTranscript accepts the next time it saves one.
-- * The number of messages isn't capped, and nothing re-orders or re-stamps them: the order is the
--   order the browser appended them, which a stale tab can't overwrite (data_version, A-2.2).
--
-- Deploy order: either way round. Every bundle in use, old or new, writes messages that fit.

CREATE OR REPLACE FUNCTION public.chamber_transcript_error(t jsonb, OUT path text, OUT reason text)
RETURNS record
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  m jsonb;
  i integer := 0;
  k text;
  at text;
BEGIN
  IF t IS NULL OR jsonb_typeof(t) <> 'array' THEN
    path := 'transcript'; reason := 'must be a list of messages'; RETURN;
  END IF;
  FOR m IN SELECT e.value FROM jsonb_array_elements(t) e LOOP
    at := format('transcript[%s]', i);
    IF jsonb_typeof(m) <> 'object' THEN
      path := at; reason := 'must be a message'; RETURN;
    END IF;
    FOR k IN SELECT jsonb_object_keys(m) LOOP
      IF k NOT IN ('id', 'sender', 'text', 'timestamp', 'kind', 'spoken') THEN
        path := at || '.' || k; reason := 'is not part of a message'; RETURN;
      END IF;
    END LOOP;
    -- sync:begin transcript_rules
    IF jsonb_typeof(m -> 'id') IS DISTINCT FROM 'string' OR btrim(m ->> 'id') = '' OR char_length(m ->> 'id') > 100 THEN
      path := at || '.id'; reason := 'must be an id of 1 to 100 characters'; RETURN;
    END IF;
    IF jsonb_typeof(m -> 'sender') IS DISTINCT FROM 'string' OR (m ->> 'sender') NOT IN ('lenore', 'user', 'system') THEN
      path := at || '.sender'; reason := 'must be lenore, user or system'; RETURN;
    END IF;
    IF jsonb_typeof(m -> 'text') IS DISTINCT FROM 'string' OR char_length(m ->> 'text') > 20000 THEN
      path := at || '.text'; reason := 'must be text of at most 20000 characters'; RETURN;
    END IF;
    IF m ? 'timestamp' AND (jsonb_typeof(m -> 'timestamp') <> 'string' OR char_length(m ->> 'timestamp') > 64) THEN
      path := at || '.timestamp'; reason := 'must be text of at most 64 characters'; RETURN;
    END IF;
    -- sync:end transcript_rules
    IF m ? 'kind' AND (m -> 'kind') IS DISTINCT FROM '"greeting"'::jsonb THEN
      path := at || '.kind'; reason := 'must be greeting'; RETURN;
    END IF;
    IF m ? 'spoken' AND jsonb_typeof(m -> 'spoken') <> 'boolean' THEN
      path := at || '.spoken'; reason := 'must be true or false'; RETURN;
    END IF;
    i := i + 1;
  END LOOP;
END;
$$;

-- As chamber_data_error: the trigger runs as the prospect (authenticated), and a signed-out caller has no use for it.
REVOKE ALL ON FUNCTION public.chamber_transcript_error(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamber_transcript_error(jsonb) TO authenticated, service_role;

-- Refuses an invalid transcript on insert and whenever it changes. Named to run after
-- chamber_sessions_data_validate, so an invalid answer is named before an invalid message.
CREATE OR REPLACE FUNCTION public.validate_chamber_transcript()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  failure record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.transcript IS NOT DISTINCT FROM OLD.transcript THEN
    RETURN NEW;
  END IF;
  SELECT * INTO failure FROM public.chamber_transcript_error(NEW.transcript);
  IF failure.path IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid intake data at %: %', failure.path, failure.reason
      USING ERRCODE = 'EA001', DETAIL = failure.path, HINT = failure.reason;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_chamber_transcript() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamber_sessions_transcript_validate ON public.chamber_sessions;
CREATE TRIGGER chamber_sessions_transcript_validate
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_chamber_transcript();
