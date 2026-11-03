-- Intake schema v2, part 2: every intake records version 2 (US-2.1a).
--
-- v2 (supabase/functions/_shared/intakeSchema.ts, published as docs/intake-schema.v2.json) is v1 with the
-- four workers' comp answers added (part 1, 20261103100000), and nothing in v1 changed. Every answer set
-- that follows v1 therefore follows v2, so every row moves to 2 and no answer is rewritten. New rows get
-- 2 by default, and no other version can be stored. src/data/schemaSync.test.ts holds the check below
-- to INTAKE_SCHEMA_VERSION.
--
-- Moving the rows is not a save: with the table's own triggers off, no row gets a new data_version,
-- updated_at or last_activity_at, nothing is re-validated or re-certified, and an open tab is not told
-- its intake changed.

ALTER TABLE public.chamber_sessions DROP CONSTRAINT IF EXISTS chamber_sessions_schema_version_check;

ALTER TABLE public.chamber_sessions DISABLE TRIGGER USER;
UPDATE public.chamber_sessions SET schema_version = 2 WHERE schema_version IS DISTINCT FROM 2;
ALTER TABLE public.chamber_sessions ENABLE TRIGGER USER;

ALTER TABLE public.chamber_sessions ALTER COLUMN schema_version SET DEFAULT 2;
ALTER TABLE public.chamber_sessions ADD CONSTRAINT chamber_sessions_schema_version_check CHECK (
  -- sync:begin intake_schema_version
  schema_version = 2
  -- sync:end intake_schema_version
);
