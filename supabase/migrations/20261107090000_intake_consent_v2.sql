-- Intake consent, version 2026-11-draft-2 (the Nevermore rebrand). The wording a prospect agrees to before an intake
-- opens (src/data/intakeConsent.ts) now introduces the product as "Nevermore, a service of Edgar Allan Advisory" and
-- no longer calls the packet "the Manuscript". Nothing else in it changed, but any change to the wording is a new
-- version, so everyone is asked to agree again.
--
-- Only public.intake_consent_version() changes. src/data/schemaSync.test.ts reads its sync block from this, the latest
-- migration that defines it, and holds it equal to INTAKE_CONSENT_VERSION. Agreements to 2026-11-draft-1 stay in
-- intake_consents as they were; an intake keeps the agreement it was started under.
--
-- Deploy order: this migration, then the front end, close together. In between, a tab still on the old wording
-- can't record an agreement (EA005: it asks the prospect to reload and agree again), and a new intake or document
-- from someone who agreed only to the old wording is refused (EA004, DETAIL the version needed). Saves to an
-- existing intake keep working.

CREATE OR REPLACE FUNCTION public.intake_consent_version()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    -- sync:begin intake_consent_version
    '2026-11-draft-2'::text
    -- sync:end intake_consent_version
$$;

REVOKE ALL ON FUNCTION public.intake_consent_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intake_consent_version() TO anon, authenticated, service_role;
