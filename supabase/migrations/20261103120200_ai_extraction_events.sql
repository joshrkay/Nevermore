-- Extraction events (US-2.4a, decision D20): one row for every signed-in call to chamber-extract or
-- document-extract, so a refused or failed extraction can be found by intake or by request id after the
-- function logs are gone.
--
-- No prospect content, by construction: an event holds identifiers, codes, counts and field names or
-- schema paths, never a value, a message or a quote. The checks below refuse a field name that isn't an
-- identifier and a path that isn't a schema path, so a bug can't write someone's words in here.
--
-- Written by the functions with the service role. Advisors read them; prospects and guests can't read or
-- write them. Rows are pruned after public.ai_event_retention() (90 days) by a daily job.

-- True when every entry is a field name (company_name), or, with paths, a schema path (states[1],
-- census[0].dependents[2].relationship).
CREATE OR REPLACE FUNCTION public.ai_event_names_ok(names text[], paths boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(bool_and(
    char_length(n) <= 120 AND n ~ CASE
      WHEN paths THEN '^[a-z][a-z0-9_]*(\[[0-9]+\])?(\.[a-z][a-z0-9_]*(\[[0-9]+\])?)*$'
      ELSE '^[a-z][a-z0-9_]*$'
    END
  ), true)
  FROM unnest(names) AS n;
$$;

CREATE TABLE IF NOT EXISTS public.ai_extraction_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The id the function answered with (body `request_id`, header X-Request-Id) and logged.
  request_id uuid NOT NULL,
  function_name text NOT NULL CHECK (function_name IN ('chamber-extract', 'document-extract')),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Set only once the function has checked that the caller owns the intake.
  session_id uuid REFERENCES public.chamber_sessions (id) ON DELETE CASCADE,
  -- document-extract only. No foreign key: a document can be deleted while its events are kept.
  document_id uuid,
  outcome text NOT NULL CHECK (outcome IN ('ok', 'error')),
  error_code text CHECK (error_code IN (
    -- sync:begin ai_error_codes
    'bad_request', 'unauthorized', 'not_found', 'rate_limited', 'daily_cap', 'unavailable', 'provider_error',
    'timeout', 'invalid_response', 'internal'
    -- sync:end ai_error_codes
  )),
  http_status smallint NOT NULL CHECK (http_status BETWEEN 100 AND 599),
  -- What a document read left the document as (document-extract only).
  document_status text CHECK (document_status IN (
    'uploaded', 'processing', 'extracted', 'no_data', 'unsupported', 'encrypted', 'unreadable', 'too_large', 'failed'
  )),
  -- The fields extracted or proposed, by name; the schema paths refused, such as states[1]. Never values.
  fields text[] NOT NULL DEFAULT '{}' CHECK (cardinality(fields) <= 100 AND public.ai_event_names_ok(fields, false)),
  refused_paths text[] NOT NULL DEFAULT '{}' CHECK (cardinality(refused_paths) <= 50 AND public.ai_event_names_ok(refused_paths, true)),
  prompt_version smallint CHECK (prompt_version > 0),
  -- The intake schema version the answers were checked against.
  contract_version smallint CHECK (contract_version > 0),
  provider text CHECK (char_length(provider) <= 40),
  model text CHECK (char_length(model) <= 100),
  attempts smallint CHECK (attempts BETWEEN 0 AND 10),
  latency_ms integer CHECK (latency_ms >= 0),
  CONSTRAINT ai_extraction_events_outcome_code CHECK ((outcome = 'ok') = (error_code IS NULL))
);

CREATE INDEX IF NOT EXISTS ai_extraction_events_session_idx ON public.ai_extraction_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_extraction_events_request_idx ON public.ai_extraction_events (request_id);
CREATE INDEX IF NOT EXISTS ai_extraction_events_created_idx ON public.ai_extraction_events (created_at);

ALTER TABLE public.ai_extraction_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Advisors can view extraction events" ON public.ai_extraction_events;
CREATE POLICY "Advisors can view extraction events"
  ON public.ai_extraction_events FOR SELECT TO authenticated
  USING (public.is_advisor());
-- Only the functions (service role) write events.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ai_extraction_events FROM anon, authenticated;

-- ---------- Retention ----------

CREATE OR REPLACE FUNCTION public.ai_event_retention()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    -- sync:begin ai_event_retention
    interval '90 days'
    -- sync:end ai_event_retention
$$;

-- Deletes events older than the retention window, oldest first, at most p_limit a run, and says how
-- many went.
CREATE OR REPLACE FUNCTION public.prune_ai_extraction_events(p_limit integer DEFAULT 10000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.ai_extraction_events
  WHERE id IN (
    SELECT id FROM public.ai_extraction_events
    WHERE created_at < now() - public.ai_event_retention()
    ORDER BY created_at
    LIMIT greatest(p_limit, 0)
  );
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_ai_extraction_events(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_ai_extraction_events(integer) TO service_role;
REVOKE ALL ON FUNCTION public.ai_event_names_ok(text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_event_names_ok(text[], boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_event_retention() TO authenticated, service_role;

-- Daily, from the database. Needs pg_cron only. Without it this logs a notice and the job can be run
-- another way (`select public.prune_ai_extraction_events();` with the service role). An existing job of
-- the same name is left as it is.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'extraction events: pg_cron is not available (%); run public.prune_ai_extraction_events() another way', SQLERRM;
      RETURN;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-ai-extraction-events') THEN
    RAISE NOTICE 'extraction events: a prune-ai-extraction-events job already exists; leaving it as it is';
    RETURN;
  END IF;

  -- 03:43 UTC, off the hour and away from the other jobs.
  PERFORM cron.schedule('prune-ai-extraction-events', '43 3 * * *', 'select public.prune_ai_extraction_events();');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'extraction events: could not schedule prune-ai-extraction-events (%); run public.prune_ai_extraction_events() another way', SQLERRM;
END $$;
