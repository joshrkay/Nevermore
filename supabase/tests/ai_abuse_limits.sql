-- Run against a scratch Postgres (NOT production):
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/ai_abuse_limits.sql
-- Stubs the Supabase roles the migration grants to.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
\i supabase/migrations/20261020210000_guest_abuse_limits.sql

DO $$
DECLARE ok boolean;
BEGIN
  -- Global ceiling: allows exactly max_calls per UTC day, then refuses.
  ASSERT (SELECT public.consume_global_ai_budget(3)), 'call 1 should be allowed';
  ASSERT (SELECT public.consume_global_ai_budget(3)), 'call 2 should be allowed';
  ASSERT (SELECT public.consume_global_ai_budget(3)), 'call 3 should be allowed';
  ASSERT NOT (SELECT public.consume_global_ai_budget(3)), 'call 4 should be refused';
  ASSERT NOT (SELECT public.consume_global_ai_budget(3)), 'refusals must not wrap around';
  ASSERT (SELECT calls FROM public.ai_global_usage WHERE day = (now() AT TIME ZONE 'utc')::date) = 3,
    'a refused call must not be counted';

  -- A ceiling of zero (or less) refuses everything, including the first call of the day.
  DELETE FROM public.ai_global_usage;
  ASSERT NOT (SELECT public.consume_global_ai_budget(0)), 'ceiling 0 refuses';

  -- Yesterday's usage does not count against today.
  INSERT INTO public.ai_global_usage (day, calls) VALUES ((now() AT TIME ZONE 'utc')::date - 1, 999999);
  ASSERT (SELECT public.consume_global_ai_budget(1)), 'today starts fresh';

  -- Per-IP: per-minute limit, independent per hash.
  ASSERT (SELECT public.consume_ip_quota('ip-a', 2, 100)), 'ip-a 1';
  ASSERT (SELECT public.consume_ip_quota('ip-a', 2, 100)), 'ip-a 2';
  ASSERT NOT (SELECT public.consume_ip_quota('ip-a', 2, 100)), 'ip-a 3 over per-minute';
  ASSERT (SELECT public.consume_ip_quota('ip-b', 2, 100)), 'ip-b unaffected by ip-a';

  -- Per-IP: daily limit counts older-than-a-minute rows within the day.
  INSERT INTO public.ai_ip_log (ip_hash, created_at)
    SELECT 'ip-c', now() - interval '2 hours' FROM generate_series(1, 5);
  ASSERT NOT (SELECT public.consume_ip_quota('ip-c', 100, 5)), 'ip-c over per-day';

  -- Rows older than a day are pruned for the caller's hash.
  INSERT INTO public.ai_ip_log (ip_hash, created_at) VALUES ('ip-d', now() - interval '3 days');
  PERFORM public.consume_ip_quota('ip-d', 100, 100);
  ASSERT (SELECT count(*) FROM public.ai_ip_log WHERE ip_hash = 'ip-d' AND created_at < now() - interval '1 day') = 0,
    'stale rows pruned';
END $$;

-- Only the service role may call these; guests and signed-in users cannot reset or probe them.
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.consume_global_ai_budget(100);
    RAISE EXCEPTION 'FAIL: authenticated could call consume_global_ai_budget';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.consume_ip_quota('x', 1, 1);
    RAISE EXCEPTION 'FAIL: authenticated could call consume_ip_quota';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.consume_global_ai_budget(100);
    RAISE EXCEPTION 'FAIL: anon could call consume_global_ai_budget';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM public.consume_global_ai_budget(100);
  PERFORM public.consume_ip_quota('x', 100, 100);
  RESET ROLE;
  RAISE NOTICE 'ai_abuse_limits: all cases passed';
END $$;
