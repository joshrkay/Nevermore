-- Per-user log of AI requests, used to rate-limit the chamber-extract function.
CREATE TABLE public.ai_request_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_request_log_user_created_idx ON public.ai_request_log (user_id, created_at DESC);

-- RLS with no policies: clients can't read or write this table directly;
-- only consume_ai_quota (SECURITY DEFINER) touches it.
ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

-- Records one request for the calling user and returns false if that would
-- exceed either limit. Rows older than a day are pruned as it goes.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(per_minute integer, per_day integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  minute_count integer;
  day_count integer;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  -- Serialize concurrent calls for the same user so the counts can't race.
  PERFORM pg_advisory_xact_lock(hashtext(uid::text));

  DELETE FROM public.ai_request_log
  WHERE user_id = uid AND created_at < now() - interval '1 day';

  SELECT
    count(*) FILTER (WHERE created_at > now() - interval '1 minute'),
    count(*)
  INTO minute_count, day_count
  FROM public.ai_request_log
  WHERE user_id = uid;

  IF minute_count >= per_minute OR day_count >= per_day THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_request_log (user_id) VALUES (uid);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(integer, integer) TO authenticated;
