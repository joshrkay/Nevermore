-- A required answer with two competing values can't be certified (B-2, decision D26): the prospect picks
-- one first. Until now only a missing answer blocked certification (20261103110000_certification_readiness.sql),
-- so a company legal name, states of operation or pay frequency that Lenore and a document disagreed on
-- could be signed and reach The Manuscript marked "Conflicting".
--
-- * public.intake_conflicting_required(field_provenance) returns the keys of the required fields whose
--   field status is 'conflicting', in the same fixed order as intake_missing_required: company_name,
--   states, pay_frequency. The front end holds the same rule (conflictingRequired in src/data/readiness.ts);
--   src/data/schemaSync.test.ts compares the two lists.
-- * refuse_unready_certification() keeps refusing missing answers first (EA003), then refuses a
--   certification from the browser while any required answer is in conflict, with SQLSTATE EA008 and the
--   keys, comma-separated, in DETAIL. PostgREST answers it with HTTP 400. The Reckoning won't send one, so
--   this is the backstop. Jobs, migrations and the service role are not refused, as before.
-- * A conflict on a recommended field never blocks: it stays an open item.
-- * A states conflict blocks even when census rows carry work states: the prospect gave two answers to the
--   question and hasn't said which is right.
--
-- What is read is the row's field_provenance as the certification leaves it. The browser saves its
-- provenance before it certifies and doesn't send it with the certification, so this is what the prospect
-- last saw. Field provenance is written by the browser and not validated, so this check holds an honest
-- client to its own state; it doesn't stop a client that lies about it (as A-2.2 notes).
--
-- Existing certifications are untouched: the check runs only when an intake is certified (status becomes
-- 'submitted', or a new submission replaces the old one), never on other saves, and a conflict that
-- appears after a certification doesn't withdraw it (the certified answers haven't changed).
--
-- Deploy order: either way round. A front end without the check gets a refusal it reports as a failed
-- certification; the new front end works against the old database (it just isn't backed up).

CREATE OR REPLACE FUNCTION public.intake_conflicting_required(p jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(f.key ORDER BY f.ord), '{}'::text[])
  FROM unnest(ARRAY[
    -- sync:begin required_conflict_fields
    'company_name', 'states', 'pay_frequency'
    -- sync:end required_conflict_fields
  ]) WITH ORDINALITY AS f(key, ord)
  WHERE jsonb_typeof(p) = 'object'
    AND jsonb_typeof(p -> f.key) = 'object'
    AND p -> f.key ->> 'status' = 'conflicting'
$$;

-- Refuses a certification from the browser while required answers are missing (EA003) or in conflict
-- (EA008). Same name, trigger and order as before: after the guest block, before the certification check.
CREATE OR REPLACE FUNCTION public.refuse_unready_certification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  certifying boolean := false;
  missing text[];
  conflicting text[];
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

  conflicting := public.intake_conflicting_required(NEW.field_provenance);
  IF cardinality(conflicting) > 0 THEN
    RAISE EXCEPTION 'This intake can''t be certified yet: % has two different answers', array_to_string(conflicting, ', ')
      USING ERRCODE = 'EA008', DETAIL = array_to_string(conflicting, ','),
            HINT = 'Choose one answer for each of them on the Review tab, then certify.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_unready_certification() FROM PUBLIC, anon, authenticated;
