-- The PEO the prospect chose is kept with the intake (US-1.3), so a reload during the final steps keeps it.
--
-- chamber_sessions.chosen_peo is the PEO picked on PEO Match. Before this it lived only in the page and was
-- lost on refresh. NULL until they pick one, which they never have to: we don't rank PEOs or choose for
-- them. It is written by the same versioned save as the answers (it moves data_version and counts as
-- activity, like any save from the browser), and it is not an answer: changing it does not withdraw a
-- certification. The certified PEO stays in submission.peo. A closed intake (expired, archived, revoked)
-- refuses it like any other change (20261103090000_intake_lifecycle.sql).
--
-- The name is trimmed and at most 80 characters, the limit of the "name another PEO" field. The front end
-- trims and cuts names to the same limit (PEO_NAME_MAX in src/data/peoCatalog.ts), and
-- src/data/schemaSync.test.ts compares the two.
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
