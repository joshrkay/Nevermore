-- Guest sessions are free to mint, so the per-user AI limit alone no longer bounds spend.
-- These add a per-IP limit and a global daily ceiling. Both are callable only by the service
-- role (the edge function), never by clients, and store no raw IP addresses.

-- ---------- Global daily ceiling ----------
CREATE TABLE public.ai_global_usage (
  day date PRIMARY KEY,
  calls integer NOT NULL DEFAULT 0
);
ALTER TABLE public.ai_global_usage ENABLE ROW LEVEL SECURITY;  -- no policies: no client access

-- Counts one AI call against today's (UTC) ceiling. Returns false, without counting, once
-- `max_calls` have been used. The conflict-update row lock serializes concurrent callers.
CREATE OR REPLACE FUNCTION public.consume_global_ai_budget(max_calls integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  IF max_calls IS NULL OR max_calls <= 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_global_usage (day, calls)
  VALUES ((now() AT TIME ZONE 'utc')::date, 1)
  ON CONFLICT (day) DO UPDATE SET calls = public.ai_global_usage.calls + 1
    WHERE public.ai_global_usage.calls < max_calls
  RETURNING calls INTO new_count;

  RETURN new_count IS NOT NULL;
END;
$$;

-- ---------- Per-IP limit ----------
CREATE TABLE public.ai_ip_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_ip_log_hash_created_idx ON public.ai_ip_log (ip_hash, created_at DESC);
ALTER TABLE public.ai_ip_log ENABLE ROW LEVEL SECURITY;  -- no policies: no client access

-- Records one request for a hashed IP and returns false if that would exceed either limit.
-- The caller hashes the address (with a secret) so no raw IP is stored; rows older than a day
-- are pruned for that hash as it goes.
CREATE OR REPLACE FUNCTION public.consume_ip_quota(p_ip_hash text, per_minute integer, per_day integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  minute_count integer;
  day_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ai_ip:' || p_ip_hash));

  DELETE FROM public.ai_ip_log
  WHERE ip_hash = p_ip_hash AND created_at < now() - interval '1 day';

  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '1 minute'),
    count(*)
  INTO minute_count, day_count
  FROM public.ai_ip_log
  WHERE ip_hash = p_ip_hash;

  IF minute_count >= per_minute OR day_count >= per_day THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_ip_log (ip_hash) VALUES (p_ip_hash);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_global_ai_budget(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ip_quota(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_global_ai_budget(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ip_quota(text, integer, integer) TO service_role;
