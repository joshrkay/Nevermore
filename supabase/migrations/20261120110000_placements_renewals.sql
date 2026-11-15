-- Placements and renewals, in the database (story CRM-A2.4a; docs/BROKER_CRM_BUILD.md D-24, D-28, D-45, D-46, D-197, D-209, D-222, D-407, D-446 to D-454;
-- GLOSSARY.md "The broker's CRM"; ADR 0023, ADR 0024; 20261119100000_crm_records.sql, 20261119130000_accounts_table_query.sql,
-- 20261119140000_account_page.sql, 20261119180000_calls_notes_tasks.sql).
--
-- What this is. The database half of CRM-A2.4 (the screens are CRM-A2.4b): two tables and the functions that make and change what is on them.
--
--   * placements: what a firm placed for an account (the PEO, the start, the broker of record, when it ended). Made here only by adding a renewal of a PEO
--     placement by hand (D-447: one the firm placed before the product); CRM-O1.3a makes the placement of a win, and adds commission to it (not here).
--   * renewals: a date an account's cover comes up: what renews (a PEO placement, or the employer's current plan), with whom (at most 80 characters), the
--     date, the placement it came from and the opportunity working it (at most one, set by "Start the renewal", CRM-A2.4b, so only the column and its rules
--     are here), and `not_renewed_on` ("Didn't renew", D-451).
--   Each carries its firm and is read by whoever may see its account (can_see_firm_record, as contacts and opportunities are); no API role writes either
--     (D-407): a person writes only through the functions below, each of which refuses a closing firm and Nevermore support first (assert_firm_writable,
--     ADR 0023, ADR 0024) and asks the level rule where it changes something (can_change_firm_record, D-209, D-222).
--   * Done is worked out and never stored (D-449): a renewal is done when its working opportunity is Won (renewal_is_done) or when it is marked
--     not renewed.
--   * An account's status (D-451, account_status, redefined): a client while it has a placement not ended, or a won submission with no placement (one won
--     before Epic 4); a FORMER CLIENT when it has placements and all have ended; otherwise a prospect. Still worked out, never stored.
--   * The accounts table (D-450): a Renewal column (the nearest renewal not done: its date) and a built-in view "Renewing in 120 days", which in the
--     table's own mechanism is a filter on the field renewing_in_120_days and a sort by renewal_date: accounts with a renewal not done within the next 120
--     days, overdue included, soonest first. The query's functions are restated with every rule they had, and these.
--   * History and version (record_track, D-453), the history domain taught `renewals` and `placements`, their lines in firm_closing_plan() (D-407).
--
-- What is NOT here: commission (CRM-O1.3a adds its columns to placements and its table), the placement and renewal that Mark won makes, "Start the renewal",
-- and any screen. record_history_list is not redefined (CRM-O1.2 redefines it): the two tables join the history's domain and its two helper questions.

SET lock_timeout = '5s';

-- ---------- 1. Placements ----------
-- An opportunity of an account is named with the pair (account_id, id), so a placement or a renewal can't name another account's opportunity: that pair
-- is already unique (opportunities_account_id_id_key, 20261119180000).

CREATE TABLE public.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  account_id uuid NOT NULL,
  -- The opportunity that was won to make it (CRM-O1.3a), at most one placement each. None: a placement the firm made before the product (D-447). Set by the
  -- product, so not one of the placement's own tracked fields.
  opportunity_id uuid CONSTRAINT placements_opportunity_id_key UNIQUE,
  -- The quote request the employer took (CRM-O1.3a); a quote request's deletion leaves the placement with none. Set by the product.
  quote_request_id bigint REFERENCES public.quote_requests (id) ON DELETE SET NULL,
  peo_name text NOT NULL CONSTRAINT placements_peo_name_check CHECK (btrim(peo_name) <> '' AND char_length(peo_name) <= 80),
  start_date date,
  broker_of_record text CONSTRAINT placements_broker_of_record_check CHECK (char_length(broker_of_record) <= 120),
  -- When it ended (D-451): set by "Didn't renew" and cleared by its undo. A placement is ended while this is set.
  ended_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT placements_ended_after_start CHECK (ended_on IS NULL OR start_date IS NULL OR ended_on >= start_date),
  CONSTRAINT placements_account_fkey FOREIGN KEY (firm_id, account_id) REFERENCES public.accounts (firm_id, id) ON DELETE CASCADE,
  -- The pair a renewal points at, so a renewal is on the same account as its placement.
  CONSTRAINT placements_account_id_id_key UNIQUE (account_id, id),
  -- The opportunity is one of the placement's own account. No cascade: an opportunity a placement stands on is not deleted from under it.
  CONSTRAINT placements_opportunity_fkey FOREIGN KEY (account_id, opportunity_id) REFERENCES public.opportunities (account_id, id)
);

CREATE INDEX placements_firm_account_idx ON public.placements (firm_id, account_id);

COMMENT ON TABLE public.placements IS 'What a firm placed for an account with a PEO (glossary: Placement). Read by whoever may see the account; written only through functions.';

-- ---------- 2. Renewals ----------
CREATE TABLE public.renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  account_id uuid NOT NULL,
  -- What renews (D-446): a PEO placement, or the employer's current plan (which makes no placement, D-447).
  kind text NOT NULL CONSTRAINT renewals_kind_check CHECK (kind IN ('peo_placement', 'current_plan')),
  with_whom text NOT NULL CONSTRAINT renewals_with_whom_check CHECK (btrim(with_whom) <> '' AND char_length(with_whom) <= 80),
  renews_on date NOT NULL,
  -- The placement it came from: every PEO placement renewal has one, and a current-plan one never does.
  placement_id uuid,
  -- The opportunity working it: at most one (D-449), and an opportunity works at most one renewal. Set by "Start the renewal" (CRM-A2.4b); its deletion
  -- clears it.
  opportunity_id uuid,
  -- "Didn't renew" (D-451): the day, kept on the renewal. The renewal is then done, and the placement it came from ended on that day.
  not_renewed_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT renewals_kind_placement CHECK ((kind = 'peo_placement') = (placement_id IS NOT NULL)),
  CONSTRAINT renewals_account_fkey FOREIGN KEY (firm_id, account_id) REFERENCES public.accounts (firm_id, id) ON DELETE CASCADE,
  -- A placement's deletion (reopening a win, CRM-O1.3a) takes the renewal made with it.
  CONSTRAINT renewals_placement_fkey FOREIGN KEY (account_id, placement_id) REFERENCES public.placements (account_id, id) ON DELETE CASCADE,
  CONSTRAINT renewals_opportunity_fkey FOREIGN KEY (account_id, opportunity_id) REFERENCES public.opportunities (account_id, id)
    ON DELETE SET NULL (opportunity_id)
);

CREATE UNIQUE INDEX renewals_one_per_opportunity ON public.renewals (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX renewals_firm_account_idx ON public.renewals (firm_id, account_id, renews_on);
CREATE INDEX renewals_placement_idx ON public.renewals (placement_id) WHERE placement_id IS NOT NULL;

COMMENT ON TABLE public.renewals IS 'A date an account''s cover comes up (glossary: Renewal). Done is worked out by renewal_is_done(), never stored.';

CREATE TRIGGER placements_updated_at BEFORE UPDATE ON public.placements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER renewals_updated_at BEFORE UPDATE ON public.renewals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 3. Row security ----------
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewals ENABLE ROW LEVEL SECURITY;

-- Nobody writes through the API (D-407): no insert, update, delete or truncate for any API role, the service role included.
REVOKE ALL ON public.placements, public.renewals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.placements, public.renewals TO authenticated, service_role;

-- Read by whoever may see their account (CRM-S5.1), so changing the account's owner changes it at once.
CREATE POLICY placements_visible ON public.placements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = placements.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id)));

CREATE POLICY renewals_visible ON public.renewals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = renewals.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id)));

-- ---------- 4. History and version (D-453) ----------
-- The history's list of tables: the two new names are added to whatever the list holds when this runs (another story may have added its own), so no name
-- is dropped by being left out of a restated list.
DO $$
DECLARE
  names text[];
  n text;
BEGIN
  SELECT COALESCE(array_agg(m[1] ORDER BY m[1]), '{}') INTO names
  FROM pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS m
  WHERE c.contypid = 'public.record_history_table'::regtype AND c.conname = 'record_history_table_known';
  FOREACH n IN ARRAY ARRAY['renewals', 'placements'] LOOP
    IF NOT n = ANY (names) THEN names := names || n; END IF;
  END LOOP;
  ALTER DOMAIN public.record_history_table DROP CONSTRAINT record_history_table_known;
  EXECUTE format('ALTER DOMAIN public.record_history_table ADD CONSTRAINT record_history_table_known CHECK (VALUE IN (%s))',
    (SELECT string_agg(quote_literal(x), ', ' ORDER BY x) FROM unnest(names) x));
END $$;

-- Each record's own fields. Not its stamps, the account (a record never moves), nor what the product sets: a placement's opportunity and quote request
-- (CRM-O1.3a), a renewal's placement. A renewal's opportunity is tracked: linking one is a change somebody may want to see, and the version moves with it.
SELECT public.record_track('public.placements', 'placements', ARRAY['id'], ARRAY['peo_name', 'start_date', 'broker_of_record', 'ended_on']);
SELECT public.record_track('public.renewals', 'renewals', ARRAY['id'], ARRAY['kind', 'with_whom', 'renews_on', 'not_renewed_on', 'opportunity_id']);

-- ---------- 5. Done, worked out (D-449) ----------
-- A renewal is done when the opportunity working it is Won, or when it is marked "Didn't renew" (D-451), and by nothing else. Never stored beyond
-- not_renewed_on. Internal: a query that has already decided the caller may see the account asks it.
CREATE FUNCTION public.renewal_is_done(p_not_renewed_on date, p_opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_not_renewed_on IS NOT NULL OR (p_opportunity_id IS NOT NULL AND public.opportunity_stage(p_opportunity_id) = 'won')
$$;

REVOKE ALL ON FUNCTION public.renewal_is_done(date, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- One renewal as the screens read it (D-448, D-454): what, with whom, the date and how far away it is from `p_today` (negative: past), the placement, the
-- opportunity working it (id, name and its stage worked out), whether it is done and how ("renewed" by a win, "not_renewed"), whether a win made it
-- (its placement has an opportunity: such a renewal is deleted only by reopening, D-452) and its version. Internal.
CREATE FUNCTION public.crm_renewal_row(r public.renewals, p_today date)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', r.id, 'account_id', r.account_id, 'kind', r.kind, 'with_whom', r.with_whom, 'renews_on', r.renews_on, 'days_away', r.renews_on - p_today,
    'placement_id', r.placement_id,
    'opportunity', (SELECT jsonb_build_object('id', o.id, 'name', o.name, 'stage', public.opportunity_stage(o.id)) FROM public.opportunities o WHERE o.id = r.opportunity_id),
    'not_renewed_on', r.not_renewed_on,
    'done', public.renewal_is_done(r.not_renewed_on, r.opportunity_id),
    'outcome', CASE WHEN r.not_renewed_on IS NOT NULL THEN 'not_renewed'
                    WHEN r.opportunity_id IS NOT NULL AND public.opportunity_stage(r.opportunity_id) = 'won' THEN 'renewed' END,
    'made_by_win', EXISTS (SELECT 1 FROM public.placements p WHERE p.id = r.placement_id AND p.opportunity_id IS NOT NULL),
    'version', r.version)
$$;

REVOKE ALL ON FUNCTION public.crm_renewal_row(public.renewals, date) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 6. Adding a renewal by hand ----------
-- Adds a renewal to an account: what renews ('peo_placement' or 'current_plan'), with whom, the date. A PEO placement makes its placement record in the same
-- step (D-447: one the firm placed before the product): the PEO is the one it is with, the start date is the one given, if known, and there is no opportunity and
-- no quote; the employer's current plan makes none (a start date for it is refused). Answers {renewal, placement} (placement null for a current plan).
-- Refused, in this order: not a member of the firm (42501), a closing firm or Nevermore support (PT423), an account the caller may not see or that is not
-- there (PT404, one answer for both), an archived account (55000, D-222), what is wrong with what was sent (22023, in words). Anyone who may see the account may
-- add one (D-452, D-209), not only who may change it.
CREATE FUNCTION public.add_renewal(
  p_account_id uuid, p_kind text, p_with_whom text, p_renews_on date, p_placement_start_on date DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  a public.accounts;
  with_in text := NULLIF(btrim(p_with_whom), '');
  pl public.placements;
  made public.renewals;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing can be added to it.' USING ERRCODE = '55000';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('peo_placement', 'current_plan') THEN
    RAISE EXCEPTION 'Choose what renews: a PEO placement or the employer''s current plan.' USING ERRCODE = '22023';
  END IF;
  IF with_in IS NULL THEN
    RAISE EXCEPTION 'Say who it is with.' USING ERRCODE = '22023';
  END IF;
  IF char_length(with_in) > 80 THEN
    RAISE EXCEPTION 'Keep who it is with to 80 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_renews_on IS NULL THEN
    RAISE EXCEPTION 'Give the renewal date.' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'current_plan' AND p_placement_start_on IS NOT NULL THEN
    RAISE EXCEPTION 'Only a PEO placement has a start date.' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'peo_placement' THEN
    INSERT INTO public.placements (firm_id, account_id, peo_name, start_date) VALUES (a.firm_id, a.id, with_in, p_placement_start_on) RETURNING * INTO pl;
  END IF;
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, placement_id)
  VALUES (a.firm_id, a.id, p_kind, with_in, p_renews_on, pl.id) RETURNING * INTO made;
  RETURN jsonb_build_object('renewal', public.crm_renewal_row(made, current_date),
    'placement', CASE WHEN pl.id IS NULL THEN NULL ELSE jsonb_build_object('id', pl.id, 'peo_name', pl.peo_name, 'start_date', pl.start_date) END);
END;
$$;

REVOKE ALL ON FUNCTION public.add_renewal(uuid, text, text, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_renewal(uuid, text, text, date, date, uuid) TO authenticated;
