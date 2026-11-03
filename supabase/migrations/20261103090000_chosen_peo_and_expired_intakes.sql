-- The intake carries the prospect through to The Reckoning (US-1.3).
--
-- * chamber_sessions.chosen_peo is the PEO the prospect picked on PEO Match, saved with the intake so a
--   reload keeps it. Before this it lived only in the page and was lost on refresh. NULL until they pick
--   one, which is allowed: we don't rank PEOs or choose for them. It is written by the same versioned
--   save as the answers (it moves data_version like any other update), and it is not an answer: changing
--   it does not withdraw a certification. The certified PEO stays in submission.peo.
--   The name is trimmed and at most 80 characters, the limit of the "name another PEO" field. The
--   front end trims and cuts names to the same limit (PEO_NAME_MAX in src/data/peoCatalog.ts), and
--   src/data/schemaSync.test.ts compares the two.
--
-- * An intake whose status is 'expired' is closed. Its owner can still read it, so the Chamber and the
--   Manuscript can say it expired, but nothing a prospect sends changes it, including its status: such
--   an update is refused with SQLSTATE EA002, which PostgREST answers with HTTP 400. The front end
--   shows 'This intake has expired' and offers a new intake. Requests with the service-role key and
--   connections with no user JWT (migrations, scheduled jobs) are not refused.
--   Nothing sets 'expired' yet. When intakes expire, and what happens to their data, is the retention
--   decision (plan D4) and its job (US-1.1, plan A-1.5). This migration only makes an expired intake
--   behave as one wherever a prospect meets it.
--
-- Deploy this migration before the front end that reads chosen_peo: every load selects the column, and
-- without it every load, create and save fails. An older front end keeps working against it (it never
-- sends chosen_peo, and its rows simply have none).

ALTER TABLE public.chamber_sessions ADD COLUMN IF NOT EXISTS chosen_peo text;

ALTER TABLE public.chamber_sessions ADD CONSTRAINT chamber_sessions_chosen_peo_check CHECK (
  chosen_peo IS NULL OR (
    chosen_peo = btrim(chosen_peo)
    -- sync:begin chosen_peo_length
    AND char_length(chosen_peo) BETWEEN 1 AND 80
    -- sync:end chosen_peo_length
  )
);

COMMENT ON COLUMN public.chamber_sessions.chosen_peo IS
  'The PEO the prospect chose on PEO Match, kept across reloads. The certified PEO is submission.peo.';

-- Refuses a prospect's change to an expired intake. Named to sort first among the BEFORE triggers on
-- chamber_sessions (they fire in name order), so an expired intake is reported as expired rather than
-- as a refused answer or a refused guest certification.
CREATE OR REPLACE FUNCTION public.refuse_expired_intake_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'expired' AND COALESCE(auth.jwt() ->> 'role', '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'This intake has expired'
      USING ERRCODE = 'EA002', HINT = 'An expired intake cannot be changed. Start a new intake.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refuse_expired_intake_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chamber_sessions_a_refuse_expired
  BEFORE UPDATE ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_expired_intake_change();
