-- Run against a scratch Postgres (NOT production):
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/chamber_field_provenance.sql
CREATE TABLE IF NOT EXISTS public.chamber_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamber_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
\i supabase/migrations/20261021090000_chamber_field_provenance.sql

DO $$
DECLARE sid uuid;
DECLARE prov jsonb;
BEGIN
  -- New and existing rows start with an empty map.
  INSERT INTO public.chamber_sessions DEFAULT VALUES RETURNING id INTO sid;
  SELECT field_provenance INTO prov FROM public.chamber_sessions WHERE id = sid;
  IF prov <> '{}'::jsonb THEN RAISE EXCEPTION 'FAIL: default was %', prov; END IF;

  -- A provenance map can be saved.
  UPDATE public.chamber_sessions
    SET field_provenance = '{"employee_count":{"status":"inferred","source":{"kind":"transcript","message_id":"m1"},"updated_at":"2026-10-21T00:00:00Z"}}'
    WHERE id = sid;

  -- Null and non-object values are rejected.
  BEGIN
    UPDATE public.chamber_sessions SET field_provenance = NULL WHERE id = sid;
    RAISE EXCEPTION 'FAIL: null field_provenance was allowed';
  EXCEPTION WHEN not_null_violation THEN NULL; END;
  BEGIN
    UPDATE public.chamber_sessions SET field_provenance = '[]' WHERE id = sid;
    RAISE EXCEPTION 'FAIL: array field_provenance was allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;

  RAISE NOTICE 'chamber_field_provenance: all cases passed';
END $$;
