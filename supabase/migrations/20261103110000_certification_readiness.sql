-- An intake can't be certified (and so made into a Manuscript) without the answers underwriting needs
-- first (US-1.2, decision D2): the company legal name, the states of operation, and the pay frequency.
--
-- * public.intake_missing_required(chamber_data) returns the keys of the required answers an intake lacks,
--   in a fixed order: company_name, states, pay_frequency. States count as answered when `states` holds a
--   code or a census row (or a row of the older `employees` roster) has a work state, as in the
--   Manuscript's state breakdown. Blank text is not an answer. The front end holds the same list
--   (REQUIRED_ITEMS in src/data/readiness.ts); src/data/schemaSync.test.ts compares the two.
-- * A certification sent from the browser (current_user anon or authenticated, as in
--   20261103090000_intake_lifecycle.sql) is refused while any are missing, with SQLSTATE EA003 and the
--   missing keys, comma-separated, in DETAIL. PostgREST answers it with HTTP 400. The Reckoning won't send
--   one, so this is the backstop. Jobs, migrations and the service role are not refused.
-- * The employee census is recommended, not required: it can only come from an uploaded file today, and
--   no document is required. The advisor queue still lists a missing census under missing_required, as
--   underwriting needs one before it can quote.
--
-- Existing certifications are untouched: the check runs only when an intake is certified (status becomes
-- 'submitted', or a new submission replaces the old one), never on other saves.
--
-- Deploy order: either way round. A front end without the check in the Reckoning gets a refusal it reports
-- as a failed certification; the new front end works against the old database (it just isn't backed up).

CREATE OR REPLACE FUNCTION public.intake_missing_required(d jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  WITH intake AS (
    SELECT
      CASE WHEN jsonb_typeof(d) = 'object' THEN d ELSE '{}'::jsonb END AS d
  ), roster AS (
    SELECT CASE
      WHEN jsonb_typeof(i.d -> 'census') = 'array' THEN i.d -> 'census'
      WHEN jsonb_typeof(i.d -> 'employees') = 'array' THEN i.d -> 'employees'
      ELSE '[]'::jsonb
    END AS rows
    FROM intake i
  )
  SELECT array_remove(ARRAY[
    -- sync:begin required_items
    CASE WHEN COALESCE(btrim(i.d ->> 'company_name'), '') = '' THEN 'company_name' END,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(i.d -> 'states') = 'array' THEN i.d -> 'states' ELSE '[]'::jsonb END) st
      WHERE jsonb_typeof(st) = 'string' AND btrim(st #>> '{}') <> ''
    ) AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(r.rows) e
      WHERE jsonb_typeof(e) = 'object' AND COALESCE(btrim(COALESCE(e ->> 'work_state', e ->> 'state')), '') <> ''
    ) THEN 'states' END,
    CASE WHEN COALESCE(btrim(i.d ->> 'pay_frequency'), '') = '' THEN 'pay_frequency' END
    -- sync:end required_items
  ], NULL)
  FROM intake i, roster r
$$;

-- Refuses a certification from the browser while required answers are missing. Named to sort after
-- chamber_sessions_block_guest_submission (a guest is refused as a guest first) and before
-- chamber_sessions_certification_validate, so the prospect hears what's missing before anything about
-- the signature, which the Reckoning always sends complete.
CREATE OR REPLACE FUNCTION public.refuse_unready_certification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  certifying boolean := false;
  missing text[];
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR NEW.status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    certifying := true;
  ELSIF OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission THEN
    certifying := true;
  END IF;
  IF NOT certifying THEN
    RETURN NEW;
  END IF;

  missing := public.intake_missing_required(NEW.chamber_data);
  IF cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'This intake can''t be certified yet: it needs %', array_to_string(missing, ', ')
      USING ERRCODE = 'EA003', DETAIL = array_to_string(missing, ','),
            HINT = 'Add the company legal name, states of operation and pay frequency, then certify.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_unready_certification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_sessions_certification_ready
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_unready_certification();
