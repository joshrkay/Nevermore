-- One rule for a required answer in conflict. Two branches built it at once: 20261104100000_certification_conflicts.sql
-- refused a certification (EA008) when a required field's status was conflicting, and
-- 20261104100100_required_items.sql (B-2.2) gave the browser a fuller rule, public.intake_required_items: a field an
-- advisor verified is settled, and States of operation is settled by a settled census that names work states even when
-- the states answer is in conflict. The two could disagree, so the database refused what the Reckoning allowed.
--
-- * refuse_unready_certification() now takes its conflicts from public.intake_required_items (the required items whose
--   state is conflicting), with the fields an advisor verified (public.session_verified_fields). Same order, same
--   keys, same EA008 and DETAIL. Missing answers are still refused first (EA003, intake_missing_required).
-- * public.intake_conflicting_required(jsonb), the raw-status rule, is dropped: nothing else called it.
--
-- Deploy order: after 20261104100100_required_items.sql (it uses its functions); either way round with the front end.

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

  SELECT COALESCE(array_agg(i.value ->> 'item' ORDER BY i.ordinality), '{}'::text[]) INTO conflicting
  FROM jsonb_array_elements(public.intake_required_items(NEW.chamber_data, NEW.field_provenance, public.session_verified_fields(NEW.id)))
    WITH ORDINALITY AS i(value, ordinality)
  WHERE (i.value ->> 'required')::boolean AND i.value ->> 'state' = 'conflicting';
  IF cardinality(conflicting) > 0 THEN
    RAISE EXCEPTION 'This intake can''t be certified yet: % has two different answers', array_to_string(conflicting, ', ')
      USING ERRCODE = 'EA008', DETAIL = array_to_string(conflicting, ','),
            HINT = 'Choose one answer for each of them on the Review tab, then certify.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_unready_certification() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.intake_conflicting_required(jsonb);
