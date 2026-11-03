-- Which version of the intake schema a session's answers follow (A-2.1). The schema is
-- supabase/functions/_shared/intakeSchema.ts, published as docs/intake-schema.v1.json.
--
-- Version 1 is the only one, so every row, old and new, is version 1. The column has a constant default,
-- so adding it rewrites no rows and fires no triggers. A later version raises the check below in its own
-- migration, says how rows move, and changes INTAKE_SCHEMA_VERSION with it. src/data/schemaSync.test.ts
-- fails while the two differ.

ALTER TABLE public.chamber_sessions
  ADD COLUMN IF NOT EXISTS schema_version smallint NOT NULL DEFAULT 1;

ALTER TABLE public.chamber_sessions DROP CONSTRAINT IF EXISTS chamber_sessions_schema_version_check;
ALTER TABLE public.chamber_sessions ADD CONSTRAINT chamber_sessions_schema_version_check CHECK (
  -- sync:begin intake_schema_version
  schema_version = 1
  -- sync:end intake_schema_version
);
