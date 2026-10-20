-- Guests (anonymous sign-ins) can fill in an intake but cannot certify it: certifying needs an
-- identified signer. The UI gates this too; this makes the backend refuse it (access is enforced
-- in the database, not by hiding a button).
--
-- Connections without a user JWT (service role, migrations) carry no `is_anonymous` claim and
-- are unaffected.
CREATE OR REPLACE FUNCTION public.block_guest_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_guest boolean := COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false);
  becoming_submitted boolean := false;
BEGIN
  IF NEW.status = 'submitted' THEN
    IF TG_OP = 'INSERT' THEN
      becoming_submitted := true;
    ELSIF OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission THEN
      becoming_submitted := true;
    END IF;
  END IF;

  IF becoming_submitted AND is_guest THEN
    RAISE EXCEPTION 'An email-verified account is required to certify an intake'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER chamber_sessions_block_guest_submission
  BEFORE INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.block_guest_submission();
