-- A field an advisor verified is settled whatever its stored status (B-2.2): the Review step, the Reckoning
-- and The Manuscript stop asking the prospect about it (requiredItems and readiness in src/data). The
-- certification gate has to agree. Until now it read the row's field_provenance alone
-- (20261104100000_certification_conflicts.sql), so a required answer an advisor had verified while its
-- stored answers still conflicted was refused (EA008) with advice to choose one on a Review tab that no
-- longer listed it: a dead end.
--
-- refuse_unready_certification() keeps refusing missing answers first (EA003), then required answers in
-- conflict (EA008), now less the fields an advisor verified: public.session_verified_fields
-- (20261104100100_required_items.sql), which answers the intake's owner, and a certification from the
-- browser is the owner's. Same name, trigger and order as before. Nothing else changes:
-- intake_conflicting_required and its sync block stay as they are, and a conflict on a field nobody
-- verified is refused as before.
--
-- Deploy order: either way round with the front end, which already treats a verified field as settled.

CREATE OR REPLACE FUNCTION public.refuse_unready_certification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  certifying boolean := false;
  missing text[];
  conflicting text[];
  verified text[];
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
  -- A guest never gets this far (the guest block runs first), and only a signed-in owner may ask what an
  -- advisor verified; a conflict the advisor has verified is theirs to settle no longer.
  IF cardinality(conflicting) > 0 AND current_user = 'authenticated' THEN
    verified := public.session_verified_fields(NEW.id);
    conflicting := ARRAY(
      SELECT c.key FROM unnest(conflicting) WITH ORDINALITY AS c(key, ord)
      WHERE NOT (c.key = ANY (verified))
      ORDER BY c.ord
    );
  END IF;
  IF cardinality(conflicting) > 0 THEN
    RAISE EXCEPTION 'This intake can''t be certified yet: % has two different answers', array_to_string(conflicting, ', ')
      USING ERRCODE = 'EA008', DETAIL = array_to_string(conflicting, ','),
            HINT = 'Choose one answer for each of them on the Review tab, then certify.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_unready_certification() FROM PUBLIC, anon, authenticated;
