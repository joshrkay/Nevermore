-- Intake schema v3, part 1: every intake records version 3 (Epic K, story K-5.1).
--
-- v3 (supabase/functions/_shared/intakeSchema.ts, published as docs/intake-schema.v3.json) is v2 with the
-- common questions added: what PEOs and their carriers already ask on their own forms. Each group of new
-- answers arrives in its own migration after this one, and none changes an answer v2 had. Every answer
-- set that follows v2 therefore follows v3, so every row moves to 3 and no answer is rewritten. New rows
-- get 3 by default, and no other version can be stored. src/data/schemaSync.test.ts holds the check
-- below to INTAKE_SCHEMA_VERSION.
--
-- Moving the rows is not a save: with the table's own triggers off, no row gets a new data_version,
-- updated_at or last_activity_at, nothing is re-validated or re-certified, and an open tab is not told
-- its intake changed.

ALTER TABLE public.chamber_sessions DROP CONSTRAINT IF EXISTS chamber_sessions_schema_version_check;

ALTER TABLE public.chamber_sessions DISABLE TRIGGER USER;
UPDATE public.chamber_sessions SET schema_version = 3 WHERE schema_version IS DISTINCT FROM 3;
ALTER TABLE public.chamber_sessions ENABLE TRIGGER USER;

ALTER TABLE public.chamber_sessions ALTER COLUMN schema_version SET DEFAULT 3;
ALTER TABLE public.chamber_sessions ADD CONSTRAINT chamber_sessions_schema_version_check CHECK (
  -- sync:begin intake_schema_version
  schema_version = 3
  -- sync:end intake_schema_version
);
