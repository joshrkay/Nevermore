-- Status (confirmed / inferred / incomplete / conflicting) and source (transcript message,
-- document, or prospect edit) for each captured field, keyed by chamber_data field name.
-- Owner-only RLS on chamber_sessions already covers the new column.
ALTER TABLE public.chamber_sessions
  ADD COLUMN field_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.chamber_sessions
  ADD CONSTRAINT chamber_sessions_field_provenance_is_object
  CHECK (jsonb_typeof(field_provenance) = 'object');
