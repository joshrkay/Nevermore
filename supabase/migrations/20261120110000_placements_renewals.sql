-- Placements and renewals in the database (story CRM-A2.4a; docs/BROKER_CRM_BUILD.md D-446 to D-454 and D-520 to D-528; PRD 7 and 10; D-197, D-209, D-222;
-- ADR 0023, ADR 0024; 20261119100000_crm_records.sql, 20261119130000_accounts_table_query.sql, 20261119210000_bulk_changes.sql).
--
-- What this is. Two new tables, as PRD 10 lists them: `placements` (what was won: the account, the opportunity, the quote taken, the PEO's name, the start
-- date, the broker of record, when it ended and the commission CRM-O1.3a keeps on it) and `renewals` (what renews, with whom, when, the placement it came from
-- and the opportunity working it). With them:
--   1. a renewal added, edited and deleted by hand on an account (renewal_add, renewal_update, renewal_delete), and the account's renewals with the days
--      away (account_renewals); a PEO placement added by hand makes its placement record in the same step (D-447), so every PEO placement, won here or not,
--      makes the account a client and can end by one rule (D-451);
--   2. the link between a renewal and the opportunity that works it (renewal_link_opportunity: "Start the renewal" saves through it, CRM-A2.4b);
--   3. Former client: an account's status is still worked out, never stored (D-197, D-451), and now has a third value;
--   4. the accounts table's query learns the Renewal column (the account's nearest renewal not done) and the fields the "Renewing in 120 days" view
--      filters by (renewal_on, renewal_days_away). The view and the column on screen are CRM-A2.4b's.
-- Won and lost (which makes a placement and its renewal from a won opportunity) is CRM-O1.3a: it writes both tables as the superuser's functions do, so
-- no API role writes either (they are read by whoever may see the account, like a contact).
--
-- Not here: the Renewals tab and its screens (CRM-A2.4b), Home's renewals (CRM-H1), commission payments (CRM-O1.3a).

SET lock_timeout = '5s';

-- ---------- 1. The pair a renewal and a placement point at ----------
-- An opportunity named by a renewal or a placement is on the same account, by a foreign key on the pair (as an activity's is): the pair is unique since
-- 20261119180000 (opportunities_account_id_id_key).

-- ---------- 2. Placements ----------
CREATE TABLE public.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  account_id uuid NOT NULL,
  -- The won opportunity it came from; none for a placement the firm made before the product (D-447). A win makes one placement (unique below).
  opportunity_id uuid,
  -- The quote taken; none for a placement added by hand. A quote request's deletion leaves the placement.
  quote_request_id bigint REFERENCES public.quote_requests (id) ON DELETE SET NULL,
  peo_name text NOT NULL CONSTRAINT placements_peo_name_check CHECK (btrim(peo_name) = peo_name AND char_length(peo_name) BETWEEN 1 AND 80),
  start_date date,
  broker_of_record text NOT NULL CONSTRAINT placements_broker_check CHECK (btrim(broker_of_record) <> '' AND char_length(broker_of_record) <= 120),
  -- Set by "Didn't renew" (D-451) and by nothing else here; an ended placement no longer makes its account a client.
  ended_on date,
  -- The expected commission (D-466, CRM-O1.3a writes it): a share of the admin fee (the percent a person types, 20 for 20%), dollars per employee per
  -- month, or dollars flat a year; with its number and the yearly figure. Optional: all three or none.
  commission_basis text CONSTRAINT placements_commission_basis_check CHECK (commission_basis IN ('share_of_fee', 'per_employee_month', 'flat_year')),
  commission_rate numeric(14, 2),
  commission_yearly numeric(14, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT placements_account_fkey FOREIGN KEY (firm_id, account_id) REFERENCES public.accounts (firm_id, id),
  CONSTRAINT placements_opportunity_fkey FOREIGN KEY (account_id, opportunity_id) REFERENCES public.opportunities (account_id, id) ON DELETE SET NULL (opportunity_id),
  CONSTRAINT placements_account_id_id_key UNIQUE (account_id, id),
  CONSTRAINT placements_ended_after_start CHECK (ended_on IS NULL OR start_date IS NULL OR ended_on >= start_date),
  CONSTRAINT placements_commission_check CHECK (
    (commission_basis IS NULL AND commission_rate IS NULL AND commission_yearly IS NULL)
    OR (commission_basis IS NOT NULL AND commission_rate IS NOT NULL AND commission_yearly IS NOT NULL AND commission_rate > 0 AND commission_yearly >= 0 AND (commission_basis <> 'share_of_fee' OR commission_rate <= 100)))
);

CREATE UNIQUE INDEX placements_one_per_opportunity ON public.placements (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX placements_firm_account_idx ON public.placements (firm_id, account_id);

COMMENT ON TABLE public.placements IS 'What was won (glossary: Placement): the PEO the employer went with, from when, and when it ended. Seen by whoever may see its account.';

-- ---------- 3. Renewals ----------
CREATE TABLE public.renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  account_id uuid NOT NULL,
  -- What renews: a PEO placement, or the employer's current plan (which makes no placement, D-447).
  kind text NOT NULL CONSTRAINT renewals_kind_check CHECK (kind IN ('peo_placement', 'current_plan')),
  with_whom text NOT NULL CONSTRAINT renewals_with_whom_check CHECK (btrim(with_whom) = with_whom AND char_length(with_whom) BETWEEN 1 AND 80),
  renews_on date NOT NULL,
  -- The placement it came from (a PEO placement's renewal only); the placement's deletion leaves the renewal.
  placement_id uuid,
  -- The opportunity working it, at most one (D-449); an opportunity works at most one renewal (unique below). The opportunity's deletion clears it.
  opportunity_id uuid,
  -- "Didn't renew" (D-451): the renewal is then done, and the placement it came from ends on this date.
  not_renewed_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT renewals_account_fkey FOREIGN KEY (firm_id, account_id) REFERENCES public.accounts (firm_id, id),
  CONSTRAINT renewals_placement_fkey FOREIGN KEY (account_id, placement_id) REFERENCES public.placements (account_id, id) ON DELETE SET NULL (placement_id),
  CONSTRAINT renewals_opportunity_fkey FOREIGN KEY (account_id, opportunity_id) REFERENCES public.opportunities (account_id, id) ON DELETE SET NULL (opportunity_id),
  CONSTRAINT renewals_placement_only_for_a_peo CHECK (kind = 'peo_placement' OR placement_id IS NULL)
);

CREATE UNIQUE INDEX renewals_one_per_opportunity ON public.renewals (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX renewals_firm_account_idx ON public.renewals (firm_id, account_id);
-- A placement has one renewal (D-529): the renewal that came from it, so "Didn't renew" on that renewal is the one thing that ends it. The next renewal
-- of a won renewal comes from the placement the next win makes.
CREATE UNIQUE INDEX renewals_one_per_placement ON public.renewals (placement_id) WHERE placement_id IS NOT NULL;

COMMENT ON TABLE public.renewals IS 'What renews, with whom and when (glossary: Renewal). Done is worked out by renewal_is_done(), never stored. Seen by whoever may see its account.';

CREATE TRIGGER placements_updated_at BEFORE UPDATE ON public.placements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER renewals_updated_at BEFORE UPDATE ON public.renewals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 4. Row security ----------
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewals ENABLE ROW LEVEL SECURITY;

-- Nobody writes through the API (the functions below write, as the superuser's functions do); the service role reads.
REVOKE ALL ON public.placements, public.renewals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.placements, public.renewals TO authenticated, service_role;

-- Seen by whoever may see their account (as a contact and an opportunity are, D-407).
CREATE POLICY placements_visible ON public.placements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = placements.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id)));
CREATE POLICY renewals_visible ON public.renewals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = renewals.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id)));

-- ---------- 5. History and version (D-453) ----------
ALTER DOMAIN public.record_history_table DROP CONSTRAINT record_history_table_known;
ALTER DOMAIN public.record_history_table ADD CONSTRAINT record_history_table_known
  CHECK (VALUE IN ('referral_partners', 'accounts', 'contacts', 'opportunities', 'placements', 'renewals'));

-- Each record's own fields; not the links the product sets (a placement's opportunity and quote, a renewal's kind and placement) and not the stamps.
SELECT public.record_track('public.placements', 'placements', ARRAY['id'], ARRAY[
  'peo_name', 'start_date', 'broker_of_record', 'ended_on', 'commission_basis', 'commission_rate', 'commission_yearly']);
SELECT public.record_track('public.renewals', 'renewals', ARRAY['id'], ARRAY['with_whom', 'renews_on', 'opportunity_id', 'not_renewed_on']);

-- Whether the caller may see THAT record in THAT firm (20261119100000, restated with every branch it had and the two new ones): a placement and a renewal
-- by their account's level. Internal.
CREATE OR REPLACE FUNCTION public.record_history_can_see(p_firm_id uuid, p_table public.record_history_table, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_firm_id IS NULL OR p_key IS NULL THEN
    RETURN false;
  END IF;
  IF p_table = 'referral_partners' THEN
    RETURN public.is_firm_member(p_firm_id)
      AND EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = p_firm_id AND r.code = p_key);
  ELSIF p_table = 'accounts' THEN
    RETURN EXISTS (SELECT 1 FROM public.accounts a WHERE a.firm_id = p_firm_id AND a.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'contacts' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
      WHERE c.firm_id = p_firm_id AND c.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'opportunities' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.opportunities o JOIN public.accounts a ON a.id = o.account_id
      WHERE o.firm_id = p_firm_id AND o.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'placements' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.placements p JOIN public.accounts a ON a.id = p.account_id
      WHERE p.firm_id = p_firm_id AND p.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  ELSIF p_table = 'renewals' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.renewals r JOIN public.accounts a ON a.id = r.account_id
      WHERE r.firm_id = p_firm_id AND r.id = public.record_history_key_uuid(p_key) AND public.can_see_firm_record(a.firm_id, a.owner_id));
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_can_see(uuid, public.record_history_table, text) FROM PUBLIC, anon, authenticated, service_role;

-- Whether a record still exists, per table (20261119100000, restated with the two new tables).
CREATE OR REPLACE FUNCTION public.record_history_record_exists(p_firm_id uuid, p_table public.record_history_table, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_table = 'referral_partners' THEN
    RETURN EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = p_firm_id AND r.code = p_key);
  ELSIF p_table = 'accounts' THEN
    RETURN EXISTS (SELECT 1 FROM public.accounts a WHERE a.firm_id = p_firm_id AND a.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'contacts' THEN
    RETURN EXISTS (SELECT 1 FROM public.contacts c WHERE c.firm_id = p_firm_id AND c.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'opportunities' THEN
    RETURN EXISTS (SELECT 1 FROM public.opportunities o WHERE o.firm_id = p_firm_id AND o.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'placements' THEN
    RETURN EXISTS (SELECT 1 FROM public.placements p WHERE p.firm_id = p_firm_id AND p.id = public.record_history_key_uuid(p_key));
  ELSIF p_table = 'renewals' THEN
    RETURN EXISTS (SELECT 1 FROM public.renewals r WHERE r.firm_id = p_firm_id AND r.id = public.record_history_key_uuid(p_key));
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_record_exists(uuid, public.record_history_table, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_history_record_exists(uuid, public.record_history_table, text) TO record_history_remover;

-- ---------- 6. A renewal done, a renewal's state, a placement ended (D-448, D-449, D-451) ----------
-- Done is worked out from two things and nothing else (D-449): the renewal is marked "Didn't renew", or the opportunity working it is Won. Internal: asked
-- of rows the caller may already see.
CREATE FUNCTION public.renewal_is_done(r public.renewals)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT r.not_renewed_on IS NOT NULL OR (r.opportunity_id IS NOT NULL AND public.opportunity_stage(r.opportunity_id) = 'won')
$$;

REVOKE ALL ON FUNCTION public.renewal_is_done(public.renewals) FROM PUBLIC, anon, authenticated, service_role;

-- What a renewal is at: not_renewed (marked "Didn't renew"), renewed (its opportunity is Won), lost (its opportunity is Lost: Start the renewal is offered
-- again), working (its opportunity is open) or open (nobody is working it). Internal.
CREATE FUNCTION public.renewal_state(r public.renewals)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN r.not_renewed_on IS NOT NULL THEN 'not_renewed'
    WHEN r.opportunity_id IS NULL THEN 'open'
    ELSE CASE public.opportunity_stage(r.opportunity_id) WHEN 'won' THEN 'renewed' WHEN 'lost' THEN 'lost' ELSE 'working' END
  END
$$;

REVOKE ALL ON FUNCTION public.renewal_state(public.renewals) FROM PUBLIC, anon, authenticated, service_role;

-- Whether a placement has ended on a day (D-451): an end date of today or before. A placement told to end on a day to come is still current until then
-- (D-520). Pure. Internal.
CREATE FUNCTION public.placement_has_ended(p_ended_on date, p_today date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT p_ended_on IS NOT NULL AND p_ended_on <= p_today $$;

REVOKE ALL ON FUNCTION public.placement_has_ended(date, date) FROM PUBLIC, anon, authenticated, service_role;

-- One account's status by its id (20261119100000, D-197 as D-451 completes it): a client while it has a placement not ended, or a won submission with no
-- placement (one won before Epic 4); a former client when it has placements and all of them have ended; otherwise a prospect. NULL for an account that is not
-- there. Not executable by an API role, for the reason it never was.
CREATE OR REPLACE FUNCTION public.account_status(p_account_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = p_account_id) THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.placements p
      WHERE p.account_id = p_account_id AND NOT public.placement_has_ended(p.ended_on, (now() AT TIME ZONE 'UTC')::date))
      OR EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.account_id = p_account_id AND o.intake_id IS NOT NULL AND public.submission_opportunity_stage(o.intake_id) = 'won'
          AND NOT EXISTS (SELECT 1 FROM public.placements p WHERE p.opportunity_id = o.id)) THEN 'client'
    WHEN EXISTS (SELECT 1 FROM public.placements p WHERE p.account_id = p_account_id) THEN 'former_client'
    ELSE 'prospect'
  END
$$;

REVOKE ALL ON FUNCTION public.account_status(uuid) FROM PUBLIC, anon, authenticated, service_role;


-- ---------- 7. Former client, the Renewal column and the 120-day view in the accounts table's query (D-450, D-451) ----------
-- Five of the query's functions are restated with every rule they had (20261119130000, 20261119210000); what this story adds is each one's renewal lines and
-- the status's third value. The row gains `renewal_on`: the date of the account's nearest renewal not done (D-450), which the Renewal column shows with its
-- days away (worked out in the browser from today, D-448). The two fields below are what "Renewing in 120 days" filters by: renewal_days_away less than 121
-- keeps every account with a renewal not done within the next 120 days, overdue included; renewal_on is the date itself, to filter and to sort by.
ALTER TYPE public.accounts_row ADD ATTRIBUTE renewal_on date;

-- accounts_field_choices: the status's values, with Former client (D-451).

CREATE OR REPLACE FUNCTION public.accounts_field_choices(p_field text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    WHEN 'source' THEN ARRAY[
      -- sync:begin accounts_sources
      'employer_intake', 'added_by_hand', 'new_quote', 'lead', 'import'
      -- sync:end accounts_sources
    ]
    WHEN 'status' THEN ARRAY[
      -- sync:begin accounts_statuses
      'prospect', 'client', 'former_client'
      -- sync:end accounts_statuses
    ]
    WHEN 'opportunity_stage' THEN ARRAY[
      -- sync:begin accounts_open_stages
      'qualifying', 'intake_under_way', 'ready_to_send', 'in_market', 'quoted'
      -- sync:end accounts_open_stages
    ]
  END
$$;

-- accounts_field_kind: the field list, and the two new lines.
-- accounts_field_kind: the field list, and the one new line.
CREATE OR REPLACE FUNCTION public.accounts_field_kind(p_field text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_field
    -- sync:begin accounts_fields
    WHEN 'name' THEN 'text'
    WHEN 'trade_name' THEN 'text'
    WHEN 'website' THEN 'text'
    WHEN 'city' THEN 'text'
    WHEN 'industry' THEN 'text'
    WHEN 'current_provider' THEN 'text'
    WHEN 'opportunity_name' THEN 'text'
    WHEN 'employees' THEN 'number'
    WHEN 'open_opportunities' THEN 'number'
    WHEN 'quote_requests_sent' THEN 'number'
    WHEN 'quotes_received' THEN 'number'
    WHEN 'renewal_days_away' THEN 'number'
    WHEN 'created_at' THEN 'date'
    WHEN 'last_activity_at' THEN 'date'
    WHEN 'target_start' THEN 'date'
    WHEN 'earliest_quote_expires_on' THEN 'date'
    WHEN 'renewal_on' THEN 'date'
    WHEN 'state' THEN 'choice'
    WHEN 'source' THEN 'choice'
    WHEN 'status' THEN 'choice'
    WHEN 'opportunity_stage' THEN 'choice'
    WHEN 'states_of_operation' THEN 'choices'
    WHEN 'labels' THEN 'choices'
    WHEN 'archived' THEN 'yes_no'
    WHEN 'waiting_on_peo' THEN 'yes_no'
    WHEN 'owner' THEN 'person'
    -- sync:end accounts_fields
  END
$$;

-- accounts_row_filters_pass: one row against the checked filters; two new lines.
CREATE OR REPLACE FUNCTION public.accounts_row_filters_pass(r public.accounts_row, p_checked jsonb, p_time_zone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_checked) f
    WHERE NOT COALESCE(CASE f ->> 'field'
      WHEN 'name' THEN public.workspace_filter_match_text(r.name, f)
      WHEN 'trade_name' THEN public.workspace_filter_match_text(r.trade_name, f)
      WHEN 'website' THEN public.workspace_filter_match_text(r.website, f)
      WHEN 'city' THEN public.workspace_filter_match_text(r.city, f)
      WHEN 'industry' THEN public.workspace_filter_match_text(r.industry, f)
      WHEN 'current_provider' THEN public.workspace_filter_match_text(r.current_provider, f)
      WHEN 'opportunity_name' THEN public.workspace_filter_match_text(r.opportunity_name, f)
      WHEN 'employees' THEN public.workspace_filter_match_number(r.employees, f)
      WHEN 'open_opportunities' THEN public.workspace_filter_match_number(r.open_opportunities, f)
      WHEN 'quote_requests_sent' THEN public.workspace_filter_match_number(r.quote_requests_sent, f)
      WHEN 'quotes_received' THEN public.workspace_filter_match_number(r.quotes_received, f)
      -- Days to the nearest renewal not done, from today in the caller's time zone: negative once it is overdue, which is how a view says "within 120 days, overdue included".
      WHEN 'renewal_days_away' THEN public.workspace_filter_match_number(r.renewal_on - (now() AT TIME ZONE p_time_zone)::date, f)
      WHEN 'created_at' THEN public.workspace_filter_match_date((r.created_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'last_activity_at' THEN public.workspace_filter_match_date((r.last_activity_at AT TIME ZONE p_time_zone)::date, f)
      WHEN 'target_start' THEN public.workspace_filter_match_date(r.target_start, f)
      WHEN 'earliest_quote_expires_on' THEN public.workspace_filter_match_date(r.earliest_quote_expires_on, f)
      WHEN 'renewal_on' THEN public.workspace_filter_match_date(r.renewal_on, f)
      WHEN 'state' THEN public.workspace_filter_match_choice(r.state, f)
      WHEN 'source' THEN public.workspace_filter_match_choice(r.source, f)
      WHEN 'status' THEN public.workspace_filter_match_choice(r.status, f)
      WHEN 'opportunity_stage' THEN public.workspace_filter_match_choice(r.opportunity_stage, f)
      WHEN 'states_of_operation' THEN public.workspace_filter_match_choices(r.states_of_operation, f)
      WHEN 'labels' THEN public.workspace_filter_match_choices(r.labels, f)
      WHEN 'archived' THEN public.workspace_filter_match_yes_no(r.archived, f)
      WHEN 'waiting_on_peo' THEN public.workspace_filter_match_yes_no(r.waiting_on_peo, f)
      WHEN 'owner' THEN public.workspace_filter_match_person(r.owner, f)
    END, false)
  )
$$;

-- accounts_rows: the accounts the caller may see, with their columns; the status follows D-451 and the renewal is a new lateral lookup by the account.
CREATE OR REPLACE FUNCTION public.accounts_rows(p_firm_id uuid, p_search text, p_ids uuid[] DEFAULT NULL)
RETURNS SETOF public.accounts_row
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  seen_owners uuid[];
  seen_unowned boolean;
  terms text[] := ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '');
  domains text[] := ARRAY(SELECT public.web_domain_of(t) FROM unnest(ARRAY(SELECT lower(t) FROM regexp_split_to_table(left(btrim(COALESCE(p_search, '')), 200), '\s+') AS t WHERE t <> '')) AS t);
BEGIN
  SELECT COALESCE(array_agg(o.owner_id) FILTER (WHERE o.owner_id IS NOT NULL), '{}'), COALESCE(bool_or(o.owner_id IS NULL), false)
  INTO seen_owners, seen_unowned
  FROM (SELECT DISTINCT a.owner_id FROM public.accounts a WHERE a.firm_id = p_firm_id OFFSET 0) o   -- OFFSET 0: the question is asked of each owner, not pushed down to each account
  WHERE public.can_see_firm_record(p_firm_id, o.owner_id);

  RETURN QUERY
  SELECT (ROW(
    a.id, a.name, a.trade_name, a.website, a.city, a.state, a.industry, a.employees, a.states_of_operation, a.current_provider, a.source,
    CASE WHEN won.live OR won.is_won THEN 'client' WHEN won.placed THEN 'former_client' ELSE 'prospect' END, a.archived_at IS NOT NULL, a.archived_at, a.created_at,
    mem.user_id, mem.name,
    mc.id, mc.name, mc.email, mc.phone,
    oo.id, oo.name, oo.stage, oo.target_start, COALESCE(oo.n, 0),
    COALESCE(q.sent, 0), COALESCE(q.received, 0), COALESCE(q.waiting, false), q.expires,
    act.at, COALESCE(lab.names, '{}'), ren.on_day
  )::public.accounts_row).*
  FROM public.accounts a
  LEFT JOIN LATERAL (
    SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text) AS name
    FROM public.firm_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = p_firm_id AND m.user_id = a.owner_id AND public.membership_is_current(m.valid_from, m.valid_until)
    LIMIT 1
  ) mem ON true
  -- The account's status (D-197, D-451): a client while it has a placement not ended or a won opportunity with no placement (one won before Epic 4); a former
  -- client when it has placements and all have ended. account_status() says the same for any account by its id alone, which no index serves (opportunities
  -- and placements are indexed by firm and account), so asked for each account of a firm it reads every row of every firm; this asks by firm and account.
  -- supabase/tests/accounts_query.sql compares the two for every account.
  LEFT JOIN LATERAL (
    SELECT
      EXISTS (SELECT 1 FROM public.placements p WHERE p.firm_id = p_firm_id AND p.account_id = a.id
              AND NOT public.placement_has_ended(p.ended_on, (now() AT TIME ZONE 'UTC')::date)) AS live,
      EXISTS (SELECT 1 FROM public.placements p WHERE p.firm_id = p_firm_id AND p.account_id = a.id) AS placed,
      EXISTS (
        SELECT 1 FROM public.opportunities w
        WHERE w.firm_id = p_firm_id AND w.account_id = a.id AND w.intake_id IS NOT NULL AND public.submission_opportunity_stage(w.intake_id) = 'won'
          AND NOT EXISTS (SELECT 1 FROM public.placements pw WHERE pw.firm_id = p_firm_id AND pw.account_id = a.id AND pw.opportunity_id = w.id)) AS is_won
  ) won ON true
  LEFT JOIN LATERAL (
    SELECT c.id, btrim(concat_ws(' ', c.first_name, c.last_name)) AS name, NULLIF(btrim(c.email), '') AS email,
           COALESCE(NULLIF(btrim(c.phone), ''), NULLIF(btrim(c.mobile), '')) AS phone
    FROM public.contacts c
    WHERE c.account_id = a.id AND c.is_main
  ) mc ON true
  LEFT JOIN LATERAL (
    SELECT x.id, x.name, x.target_start, x.stage, x.intake_id, (count(*) OVER ())::integer AS n
    FROM (
      SELECT o.id, o.name, o.target_start, o.created_at, o.intake_id, public.opportunity_stage(o.id) AS stage
      FROM public.opportunities o
      WHERE o.firm_id = p_firm_id AND o.account_id = a.id
    ) x
    WHERE x.stage NOT IN ('won', 'lost')
    ORDER BY x.target_start NULLS LAST, x.created_at, x.id
    LIMIT 1
  ) oo ON true
  LEFT JOIN LATERAL (
    SELECT (count(*) FILTER (WHERE r.status <> 'closed'))::integer AS sent,
           (count(*) FILTER (WHERE r.status = 'quoted'))::integer AS received,
           min(r.quote_expires_on) FILTER (WHERE r.status = 'quoted') AS expires,
           COALESCE(bool_or(r.status = 'sent'), false) AS waiting
    FROM public.quote_requests r
    WHERE r.session_id = oo.intake_id
  ) q ON true
  LEFT JOIN LATERAL (
    SELECT max(t.at) AS at FROM public.account_activity_times(p_firm_id, a.id) t
  ) act ON true
  LEFT JOIN LATERAL (
    SELECT lower(string_agg(concat_ws(' ', c.first_name, c.last_name, c.email), E'\n')) AS t
    FROM public.contacts c
    WHERE cardinality(terms) > 0 AND c.account_id = a.id
  ) ct ON true
  LEFT JOIN LATERAL (
    SELECT array_agg(l.name ORDER BY lower(l.name), l.name) AS names
    FROM public.account_labels al JOIN public.labels l ON l.id = al.label_id
    WHERE al.account_id = a.id
  ) lab ON true
  -- The Renewal column (D-450): the account's nearest renewal not done, overdue included.
  LEFT JOIN LATERAL (
    SELECT min(rn.renews_on) AS on_day FROM public.renewals rn
    WHERE rn.firm_id = p_firm_id AND rn.account_id = a.id AND NOT public.renewal_is_done(rn)
  ) ren ON true
  WHERE a.firm_id = p_firm_id
    AND (a.owner_id = ANY (seen_owners) OR (a.owner_id IS NULL AND seen_unowned))
    AND (p_ids IS NULL OR a.id = ANY (p_ids))
    AND NOT EXISTS (
      SELECT 1 FROM unnest(terms, domains) AS w (term, dom)
      WHERE strpos(lower(concat_ws(E'\n', a.name, a.trade_name, a.web_domain)) || E'\n' || COALESCE(ct.t, ''), w.term) = 0
        AND (w.dom IS NULL OR a.web_domain IS NULL OR strpos(a.web_domain, w.dom) = 0)
    );
END;
$$;

-- accounts_list: the page; the two renewal fields sort.
CREATE OR REPLACE FUNCTION public.accounts_list(
  p_firm_id uuid,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_sort text DEFAULT NULL,
  p_direction text DEFAULT 'asc',
  p_page integer DEFAULT 1,
  p_search text DEFAULT NULL,
  p_time_zone text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  page_size constant integer := 50;
  firm uuid;
  tz text;
  checked jsonb;
  pg integer := COALESCE(p_page, 1);
  choices text[];
  result jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  tz := public.workspace_time_zone(p_time_zone);
  checked := public.accounts_filters_checked(firm, p_filters, (now() AT TIME ZONE tz)::date);
  IF p_sort IS NOT NULL THEN
    IF public.accounts_field_kind(p_sort) IS NULL THEN
      RAISE EXCEPTION 'The accounts table has no field "%" to sort by', left(p_sort, 64) USING ERRCODE = '22023';
    END IF;
    choices := public.accounts_field_choices(p_sort);
  END IF;
  IF p_direction IS NULL OR p_direction NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'A sort goes asc or desc' USING ERRCODE = '22023';
  END IF;
  IF pg < 1 OR pg > 100000 THEN
    RAISE EXCEPTION 'A page number is 1 to 100000' USING ERRCODE = '22023';
  END IF;

  WITH matched AS MATERIALIZED (
    SELECT r
    FROM public.accounts_rows(firm, p_search) r
    WHERE public.accounts_row_passes(r, checked, tz)
  ),
  keyed AS (
    SELECT
      m.r,
      -- One key per type; only the sorted field's is set. Text, compared by the ICU collation so "Émile" sorts beside "emile", not after "zeta".
      NULLIF(btrim(CASE p_sort
        WHEN 'name' THEN lower((m.r).name COLLATE "und-x-icu")
        WHEN 'trade_name' THEN lower((m.r).trade_name COLLATE "und-x-icu")
        WHEN 'website' THEN lower((m.r).website COLLATE "und-x-icu")
        WHEN 'city' THEN lower((m.r).city COLLATE "und-x-icu")
        WHEN 'industry' THEN lower((m.r).industry COLLATE "und-x-icu")
        WHEN 'current_provider' THEN lower((m.r).current_provider COLLATE "und-x-icu")
        WHEN 'opportunity_name' THEN lower((m.r).opportunity_name COLLATE "und-x-icu")
        WHEN 'state' THEN lower((m.r).state COLLATE "und-x-icu")
        WHEN 'owner' THEN lower((m.r).owner_name COLLATE "und-x-icu")
        WHEN 'states_of_operation' THEN lower(array_to_string((m.r).states_of_operation, ', ') COLLATE "und-x-icu")
        WHEN 'labels' THEN lower(array_to_string((m.r).labels, ', ') COLLATE "und-x-icu")
      END), '') AS k_text,
      CASE p_sort
        WHEN 'employees' THEN (m.r).employees::numeric
        WHEN 'open_opportunities' THEN (m.r).open_opportunities
        WHEN 'quote_requests_sent' THEN (m.r).quote_requests_sent
        WHEN 'quotes_received' THEN (m.r).quotes_received
        WHEN 'renewal_days_away' THEN (m.r).renewal_on - (now() AT TIME ZONE tz)::date
        WHEN 'archived' THEN (m.r).archived::integer
        WHEN 'waiting_on_peo' THEN (m.r).waiting_on_peo::integer
        -- A choice by its place in the field's list; a value outside it, if one ever appears, after the listed ones.
        WHEN 'status' THEN COALESCE(array_position(choices, (m.r).status), cardinality(choices) + 1)
        WHEN 'source' THEN COALESCE(array_position(choices, (m.r).source), cardinality(choices) + 1)
        WHEN 'opportunity_stage' THEN CASE WHEN (m.r).opportunity_stage IS NULL THEN NULL
          ELSE COALESCE(array_position(choices, (m.r).opportunity_stage), cardinality(choices) + 1) END
      END AS k_number,
      CASE p_sort
        WHEN 'created_at' THEN (m.r).created_at
        WHEN 'last_activity_at' THEN (m.r).last_activity_at
      END AS k_moment,
      CASE p_sort
        WHEN 'target_start' THEN (m.r).target_start
        WHEN 'earliest_quote_expires_on' THEN (m.r).earliest_quote_expires_on
        WHEN 'renewal_on' THEN (m.r).renewal_on
      END AS k_day
    FROM matched m
  ),
  ordered AS (
    SELECT k.r, row_number() OVER (ORDER BY
      -- Empty values last, whichever way.
      (p_sort IS NOT NULL AND k.k_text IS NULL AND k.k_number IS NULL AND k.k_moment IS NULL AND k.k_day IS NULL),
      CASE WHEN p_direction = 'asc' THEN k.k_text END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_text END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_number END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_number END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_moment END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_moment END DESC,
      CASE WHEN p_direction = 'asc' THEN k.k_day END ASC,
      CASE WHEN p_direction = 'desc' THEN k.k_day END DESC,
      -- Then the table's own order: last activity, newest first, then the id, so every row has its one place.
      (k.r).last_activity_at DESC NULLS LAST, (k.r).id
    ) AS pos
    FROM keyed k
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(o.r) ORDER BY o.pos)
      FROM ordered o
      WHERE o.pos > (pg - 1)::bigint * page_size AND o.pos <= pg::bigint * page_size
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM matched),
    'page', pg,
    'page_size', page_size
  ) INTO result;
  RETURN result;
END;
$$;


-- ---------- 8. A renewal as the screens read it ----------
-- A renewal's own fields, as a save answers them (with its version). Internal.
CREATE FUNCTION public.crm_renewal_fields(r public.renewals)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', r.id, 'version', r.version, 'account_id', r.account_id, 'kind', r.kind, 'with_whom', r.with_whom, 'renews_on', r.renews_on,
    'placement_id', r.placement_id, 'opportunity_id', r.opportunity_id, 'not_renewed_on', r.not_renewed_on,
    'created_at', r.created_at, 'updated_at', r.updated_at)
$$;

REVOKE ALL ON FUNCTION public.crm_renewal_fields(public.renewals) FROM PUBLIC, anon, authenticated, service_role;

-- The first thing wrong with a renewal's fields, in words, or NULL (inputs trimmed, a blank as NULL). The same words as the form's rules. Internal.
CREATE FUNCTION public.renewal_input_error(p_with_whom text, p_renews_on date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_with_whom IS NULL THEN 'Enter who the renewal is with.'
    WHEN char_length(p_with_whom) > 80 THEN 'Keep who it is with to 80 characters.'
    WHEN p_renews_on IS NULL THEN 'Enter the renewal date.'
  END
$$;

REVOKE ALL ON FUNCTION public.renewal_input_error(text, date) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 9. The account's renewals, with days away (D-448, D-454) ----------
-- {count, can_add, can_change, archived, rows: [...]} for an account the caller may see; NULL, the same as for an account that is not there, for anyone else.
-- Each row: id, version, kind, with_whom, renews_on, days_away (from today in the caller's time zone: 45 is "in 45 days", 0 "today", -12 "12 days ago"),
-- state (open, working, lost, renewed, not_renewed: renewal_state), done, overdue (not done and past), the opportunity working it ({id, name, stage} or
-- null), placement_id, from_win (made by a win: it can be removed only by reopening that win, D-452), not_renewed_on. Not done first, nearest first; then
-- those done, the latest first. can_add is open to anyone who may see the account and is not archived; can_change is the level rule (D-452).
CREATE FUNCTION public.account_renewals(p_firm_id uuid, p_account_id uuid, p_time_zone text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  a public.accounts;
  today date;
  n bigint;
  r jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  today := (now() AT TIME ZONE public.workspace_time_zone(p_time_zone))::date;
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RETURN NULL;
  END IF;
  SELECT count(*) INTO n FROM public.renewals rn WHERE rn.firm_id = firm AND rn.account_id = a.id;
  SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
    SELECT row_number() OVER (ORDER BY s.done, CASE WHEN NOT s.done THEN (s.rn).renews_on END, (s.rn).renews_on DESC, (s.rn).id) AS o,
           jsonb_build_object(
             'id', (s.rn).id, 'version', (s.rn).version, 'kind', (s.rn).kind, 'with_whom', (s.rn).with_whom, 'renews_on', (s.rn).renews_on,
             'days_away', (s.rn).renews_on - today, 'state', s.state, 'done', s.done, 'overdue', NOT s.done AND (s.rn).renews_on < today,
             'opportunity', CASE WHEN (s.rn).opportunity_id IS NULL THEN NULL ELSE (
               SELECT jsonb_build_object('id', op.id, 'name', op.name, 'stage', public.opportunity_stage(op.id)) FROM public.opportunities op WHERE op.id = (s.rn).opportunity_id) END,
             'placement_id', (s.rn).placement_id,
             'from_win', EXISTS (SELECT 1 FROM public.placements pl WHERE pl.id = (s.rn).placement_id AND pl.opportunity_id IS NOT NULL),
             'not_renewed_on', (s.rn).not_renewed_on) AS j
    FROM (
      SELECT rn, public.renewal_state(rn) AS state, public.renewal_state(rn) IN ('renewed', 'not_renewed') AS done
      FROM public.renewals rn WHERE rn.firm_id = firm AND rn.account_id = a.id
    ) s
  ) x;
  RETURN jsonb_build_object(
    'count', n,
    'can_add', a.archived_at IS NULL,
    'can_change', a.archived_at IS NULL AND public.can_change_firm_record(a.firm_id, a.owner_id),
    'archived', a.archived_at IS NOT NULL,
    'rows', r);
END;
$$;

REVOKE ALL ON FUNCTION public.account_renewals(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_renewals(uuid, uuid, text) TO authenticated;

-- ---------- 10. Adding a renewal by hand (D-447, D-452) ----------
-- Answers {record: <the renewal's own fields>, placement_id}. A PEO placement makes its placement record in the same step: the PEO, the start date if
-- known, the firm's name as the broker of record, no opportunity and no quote; the employer's current plan makes none. Open to anyone who may see the
-- account (as adding a contact is, D-209). Refused, in this order: not a member of the firm (42501), a closing firm or Nevermore support (PT423), an
-- account the caller may not see or that is not there (PT404), an archived account (55000), what is wrong with a field (22023, in words).
CREATE FUNCTION public.renewal_add(
  p_account_id uuid, p_kind text, p_with_whom text, p_renews_on date, p_start_date date DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  a public.accounts;
  with_in text := NULLIF(btrim(p_with_whom), '');
  problem text;
  broker text;
  placed public.placements;
  made public.renewals;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  -- Held to the end of the transaction, so a renewal is never added to an account whose archiving is on its way.
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR SHARE;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing can be added to it.' USING ERRCODE = '55000';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('peo_placement', 'current_plan') THEN
    RAISE EXCEPTION 'Choose what renews: a PEO placement or the employer''s current plan.' USING ERRCODE = '22023';
  END IF;
  problem := public.renewal_input_error(with_in, p_renews_on);
  IF problem IS NULL AND p_start_date IS NOT NULL AND p_kind = 'current_plan' THEN
    problem := 'A start date goes with a PEO placement, not the employer''s current plan.';
  END IF;
  IF problem IS NULL AND p_start_date IS NOT NULL AND p_start_date >= p_renews_on THEN
    problem := 'The renewal date must come after the start date.';
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'peo_placement' THEN
    SELECT left(btrim(f.name), 120) INTO broker FROM public.firms f WHERE f.id = firm;
    INSERT INTO public.placements (firm_id, account_id, peo_name, start_date, broker_of_record)
    VALUES (firm, a.id, with_in, p_start_date, COALESCE(NULLIF(broker, ''), 'The firm'))
    RETURNING * INTO placed;
  END IF;
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, placement_id)
  VALUES (firm, a.id, p_kind, with_in, p_renews_on, placed.id)
  RETURNING * INTO made;
  RETURN jsonb_build_object('record', public.crm_renewal_fields(made), 'placement_id', made.placement_id);
END;
$$;

REVOKE ALL ON FUNCTION public.renewal_add(uuid, text, text, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renewal_add(uuid, text, text, date, date, uuid) TO authenticated;

-- ---------- 11. The renewal, held and checked ----------
-- The firm's renewal and its account, held for a change after the questions every change asks, in this order: may the caller see the account (PT404, one
-- answer for an account or a renewal that is not there or not theirs), is it archived (55000). The level rule is the caller's to ask (p_level: renewal_update
-- and renewal_delete ask it, D-452; renewal_link_opportunity does not). Returns the renewal; its account is read again by the caller. Internal.
CREATE FUNCTION public.renewal_to_change(p_firm_id uuid, p_renewal_id uuid, p_level boolean)
RETURNS public.renewals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cur public.renewals;
  a public.accounts;
BEGIN
  SELECT * INTO cur FROM public.renewals x WHERE x.id = p_renewal_id AND x.firm_id = p_firm_id FOR NO KEY UPDATE;
  IF cur.id IS NULL THEN
    RAISE EXCEPTION 'That renewal isn''t available' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = cur.account_id FOR SHARE;
  IF NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That renewal isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing on it can be changed.' USING ERRCODE = '55000';
  END IF;
  IF p_level AND NOT public.can_change_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION '%', CASE WHEN a.owner_id IS NULL
      THEN 'An account with no owner can only be changed by an owner of the firm.'
      ELSE 'Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
      USING ERRCODE = '42501';
  END IF;
  RETURN cur;
END;
$$;

REVOKE ALL ON FUNCTION public.renewal_to_change(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 12a. The renewal's opportunity's pipeline row, held first (D-530) ----------
-- Whether a renewal is renewed is read from its opportunity's stage, which is its submission's pipeline row. set_submission_status takes that row FOR UPDATE
-- before it moves the stage, so a save that reads the stage and then writes "Didn't renew" must hold the same row first, in the same order (pipeline row,
-- then the renewal), or a win could commit between the check and the write and leave a renewal marked "Didn't renew" with its placement ended although its
-- opportunity is won. CRM-O1.3a, which writes the win, takes the pipeline row first (as set_submission_status does) and only then the renewal and the
-- placement; it settles a renewal marked "Didn't renew" whose opportunity it wins by clearing the mark and the placement's end date in the same transaction,
-- so a won renewal is never left ended. No row: an opportunity with no intake has no pipeline row to hold. Internal.
CREATE FUNCTION public.renewal_hold_stage(p_opportunity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_opportunity_id IS NULL THEN
    RETURN;
  END IF;
  PERFORM 1 FROM public.submission_workflow w JOIN public.opportunities o ON o.intake_id = w.session_id WHERE o.id = p_opportunity_id FOR UPDATE OF w;
END;
$$;

REVOKE ALL ON FUNCTION public.renewal_hold_stage(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 12. Editing a renewal, and "Didn't renew" (D-451, D-452) ----------
-- Saves with whom, the date and the "Didn't renew" date (every one is sent; a blank date clears it: Undo) from the version the person started from. What
-- renews (the kind) is not edited: remove the renewal and add another. "Didn't renew" ends the placement the renewal came from on that date, and clearing
-- it brings the placement back, in the same transaction; a renewal whose opportunity is Won is renewed and can't be marked. Answers
--   {conflict: false, record: <the renewal's own fields, with its new version>}  or, when someone saved first and nothing was saved,
--   {conflict: true, currentVersion, current: {with_whom, renews_on, not_renewed_on}, changed: [{field, value, who, at}]}.
-- Refused, in this order and before the version is looked at: not a member of the firm (42501), a closing firm or Nevermore support (PT423), what is wrong
-- with the fields (22023), no version (22023), a renewal the caller may not see or that is not there (PT404), an archived account (55000), a renewal the
-- level rule does not give the caller (42501), a date that does not fit the placement or the state (22023), a version the renewal never had (22023).
CREATE FUNCTION public.renewal_update(
  p_renewal_id uuid, p_with_whom text, p_renews_on date, p_not_renewed_on date DEFAULT NULL, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  with_in text := NULLIF(btrim(p_with_whom), '');
  problem text;
  cur public.renewals;
  pl public.placements;
  changed public.renewals;
  pre_opp uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  problem := public.renewal_input_error(with_in, p_renews_on);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the renewal it started from, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  -- The opportunity's pipeline row first, then the renewal (D-530); if the renewal was linked to another opportunity meanwhile, that one's row too.
  SELECT x.opportunity_id INTO pre_opp FROM public.renewals x WHERE x.id = p_renewal_id AND x.firm_id = firm;
  PERFORM public.renewal_hold_stage(pre_opp);
  cur := public.renewal_to_change(firm, p_renewal_id, true);
  IF cur.opportunity_id IS DISTINCT FROM pre_opp THEN
    PERFORM public.renewal_hold_stage(cur.opportunity_id);
  END IF;
  IF cur.placement_id IS NOT NULL THEN
    SELECT * INTO pl FROM public.placements x WHERE x.id = cur.placement_id FOR NO KEY UPDATE;
  END IF;
  IF pl.id IS NOT NULL AND pl.start_date IS NOT NULL THEN
    IF p_renews_on <= pl.start_date THEN
      RAISE EXCEPTION 'The renewal date must come after the start date, %.', to_char(pl.start_date, 'FMMon FMDD, YYYY') USING ERRCODE = '22023';
    END IF;
    IF p_not_renewed_on IS NOT NULL AND p_not_renewed_on < pl.start_date THEN
      RAISE EXCEPTION 'It can''t end before it started, %.', to_char(pl.start_date, 'FMMon FMDD, YYYY') USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_not_renewed_on IS NOT NULL AND cur.not_renewed_on IS NULL AND public.renewal_state(cur) = 'renewed' THEN
    RAISE EXCEPTION 'This renewal was won, so it can''t be marked as not renewed.' USING ERRCODE = '22023';
  END IF;
  -- The one statement that orders two saves: it touches the row only if it is still at the version the person started from.
  UPDATE public.renewals SET with_whom = with_in, renews_on = p_renews_on, not_renewed_on = p_not_renewed_on
  WHERE id = cur.id AND version = p_version
  RETURNING * INTO changed;
  IF changed.id IS NOT NULL THEN
    -- The placement it came from ends on the day, or goes on when the day is cleared (D-451): one rule, in the same transaction.
    IF pl.id IS NOT NULL AND pl.ended_on IS DISTINCT FROM p_not_renewed_on THEN
      UPDATE public.placements SET ended_on = p_not_renewed_on WHERE id = pl.id;
    END IF;
    RETURN jsonb_build_object('conflict', false, 'record', public.crm_renewal_fields(changed));
  END IF;
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the renewal that does not exist, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'conflict', true,
    'currentVersion', cur.version,
    'current', jsonb_build_object('with_whom', cur.with_whom, 'renews_on', cur.renews_on, 'not_renewed_on', cur.not_renewed_on),
    'changed', public.record_version_changes(cur.firm_id, 'renewals', cur.id::text, p_version, cur.version));
END;
$$;

REVOKE ALL ON FUNCTION public.renewal_update(uuid, text, date, date, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renewal_update(uuid, text, date, date, uuid, integer) TO authenticated;

-- ---------- 13. Deleting a renewal (D-452) ----------
-- {deleted: true, placement_deleted}. By whoever may change the account. A renewal made by a win is deleted only by reopening that win (CRM-O1.3): refused
-- with PT409 in words. The placement a hand-made renewal made goes with it when nothing else stands on it (no other renewal, no commission): adding a
-- renewal by mistake is undone completely, and the account stops being a client of it (D-521).
CREATE FUNCTION public.renewal_delete(p_renewal_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.renewals;
  pl public.placements;
  dropped boolean := false;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  cur := public.renewal_to_change(firm, p_renewal_id, true);
  IF cur.placement_id IS NOT NULL THEN
    SELECT * INTO pl FROM public.placements x WHERE x.id = cur.placement_id FOR NO KEY UPDATE;
  END IF;
  IF pl.id IS NOT NULL AND pl.opportunity_id IS NOT NULL THEN
    RAISE EXCEPTION 'This renewal came from a win. Reopen the win to remove it.' USING ERRCODE = 'PT409';
  END IF;
  DELETE FROM public.renewals WHERE id = cur.id;
  IF pl.id IS NOT NULL AND pl.quote_request_id IS NULL AND pl.commission_basis IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.renewals o WHERE o.placement_id = pl.id) THEN
    DELETE FROM public.placements WHERE id = pl.id;
    dropped := true;
  END IF;
  RETURN jsonb_build_object('deleted', true, 'placement_deleted', dropped);
END;
$$;

REVOKE ALL ON FUNCTION public.renewal_delete(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renewal_delete(uuid, uuid) TO authenticated;

-- ---------- 14. The opportunity working a renewal (D-449) ----------
-- "Start the renewal" saves its new opportunity and links it here (CRM-A2.4b). One opportunity of the renewal's own account that is still open, for a renewal
-- nobody is working: not done, and either with no opportunity or with one that was Lost (the new one replaces it). Open to anyone who may see the account,
-- as making the opportunity is (D-437, D-522). Answers {record}. Refused, in this order: not a member (42501), a closing firm or Nevermore support (PT423), a
-- renewal the caller may not see or that is not there (PT404), an archived account (55000), then in words (22023): an opportunity of another account or not
-- there, one that is Won or Lost, one that already works another renewal, a renewal that is done, a renewal that is being worked.
CREATE FUNCTION public.renewal_link_opportunity(p_renewal_id uuid, p_opportunity_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.renewals;
  op public.opportunities;
  at_state text;
  changed public.renewals;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  cur := public.renewal_to_change(firm, p_renewal_id, false);
  SELECT * INTO op FROM public.opportunities o WHERE o.id = p_opportunity_id AND o.firm_id = firm AND o.account_id = cur.account_id FOR UPDATE;
  IF op.id IS NULL THEN
    RAISE EXCEPTION 'Choose an opportunity of this account.' USING ERRCODE = '22023';
  END IF;
  IF public.opportunity_stage(op.id) IN ('won', 'lost') THEN
    RAISE EXCEPTION 'That opportunity is closed, so it can''t work a renewal.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.renewals o WHERE o.opportunity_id = op.id AND o.id <> cur.id) THEN
    RAISE EXCEPTION 'That opportunity already works another renewal.' USING ERRCODE = '22023';
  END IF;
  at_state := public.renewal_state(cur);
  IF at_state IN ('renewed', 'not_renewed') THEN
    RAISE EXCEPTION 'This renewal is done.' USING ERRCODE = '22023';
  END IF;
  IF at_state = 'working' THEN
    RAISE EXCEPTION 'This renewal is being worked by %.', (SELECT w.name FROM public.opportunities w WHERE w.id = cur.opportunity_id) USING ERRCODE = '22023';
  END IF;
  -- The opportunity is held FOR UPDATE above, so two links of one opportunity are ordered and the second sees the first in the check; the unique index
  -- is the last word, and its violation is said in the same words (D-531).
  BEGIN
    UPDATE public.renewals SET opportunity_id = op.id WHERE id = cur.id RETURNING * INTO changed;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That opportunity already works another renewal.' USING ERRCODE = '22023';
  END;
  RETURN jsonb_build_object('record', public.crm_renewal_fields(changed));
END;
$$;

REVOKE ALL ON FUNCTION public.renewal_link_opportunity(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renewal_link_opportunity(uuid, uuid, uuid) TO authenticated;

-- ---------- 15. Deleting an account that has renewals or placements ----------
-- 20261119160000's delete_account, restated with every rule it had; what is new is that an account with a renewal or a placement is not deleted either (its
-- records would otherwise be lost in silence): archive it instead.
CREATE OR REPLACE FUNCTION public.delete_account(p_account_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  cur public.accounts;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  -- Held FOR UPDATE, so an opportunity being added (which holds the row FOR KEY SHARE until it commits) is waited for and seen below.
  cur := public.account_to_change(firm, p_account_id, 'update');
  IF EXISTS (SELECT 1 FROM public.opportunities o WHERE o.account_id = cur.id) THEN
    RAISE EXCEPTION 'This account has opportunities, so it can''t be deleted. Archive it instead.' USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (SELECT 1 FROM public.renewals r WHERE r.account_id = cur.id) OR EXISTS (SELECT 1 FROM public.placements p WHERE p.account_id = cur.id) THEN
    RAISE EXCEPTION 'This account has renewals or placements, so it can''t be deleted. Archive it instead.' USING ERRCODE = 'PT409';
  END IF;
  DELETE FROM public.accounts a WHERE a.id = cur.id;
  RETURN jsonb_build_object('deleted', true, 'name', cur.name);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_account(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_account(uuid, uuid) TO authenticated;


-- ---------- 15a. The words an export holds for a status (D-532) ----------
-- 20261119130000's accounts_words, restated with every word it had and Former client, so a file never holds a blank status for a former client.
CREATE OR REPLACE FUNCTION public.accounts_words(p_kind text, p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_kind
    WHEN 'status' THEN CASE p_code WHEN 'prospect' THEN 'Prospect' WHEN 'client' THEN 'Client' WHEN 'former_client' THEN 'Former client' END
    WHEN 'stage' THEN CASE p_code WHEN 'qualifying' THEN 'Qualifying' WHEN 'intake_under_way' THEN 'Intake under way' WHEN 'ready_to_send' THEN 'Ready to send'
      WHEN 'in_market' THEN 'In market' WHEN 'quoted' THEN 'Quoted' WHEN 'won' THEN 'Won' WHEN 'lost' THEN 'Lost' END
    WHEN 'source' THEN CASE p_code WHEN 'employer_intake' THEN 'Employer''s intake' WHEN 'added_by_hand' THEN 'Added by hand' WHEN 'new_quote' THEN 'New quote'
      WHEN 'lead' THEN 'Lead' WHEN 'import' THEN 'Import' END
  END
$$;

REVOKE ALL ON FUNCTION public.accounts_words(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 16. Closing a firm deletes them ----------
-- The closing's one list (20261119100000, restated in 20261119180000, 20261119210000 and 20261119230000), restated with every line it had and the renewals and
-- placements before the opportunities and accounts they stand on.
CREATE OR REPLACE FUNCTION public.firm_closing_plan()
RETURNS TABLE (ord integer, src text, action text, firm_column text, why text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    -- Deleted: the firm's own working data.
    (10, 'public.firm_invitations', 'delete', 'firm_id', 'pending and past invitations to join'),
    (20, 'public.firm_organisations', 'delete', 'firm_id', 'the listed Google domains and Microsoft tenants'),
    (30, 'public.join_requests', 'delete', 'firm_id', 'requests to join'),
    (40, 'public.table_preferences', 'delete', 'firm_id', 'each person''s column choices'),
    (50, 'public.saved_views', 'delete', 'firm_id', 'saved views'),
    (55, 'public.record_history', 'delete', 'firm_id', 'the history of each record: who created it and every change to its fields; it goes with the record'),
    (56, 'public.recent_records', 'delete', 'firm_id', 'each person''s last opened records, for the search box'),
    (56, 'public.bulk_change_records', 'delete', 'firm_id', 'what each bulk change did to each record, kept for ten minutes'' undo'),
    (57, 'public.bulk_changes', 'delete', 'firm_id', 'bulk changes, kept for ten minutes'' undo'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (58, 'public.activities', 'delete', 'firm_id', 'calls, notes and tasks on the firm''s accounts and contacts; before the opportunities, contacts and accounts they stand on'),
    (59, 'public.account_labels', 'delete', 'firm_id', 'the labels on the firm''s accounts; before the accounts they stand on'),
    (59, 'public.renewals', 'delete', 'firm_id', 'renewals (what renews, with whom and when); before the placements, opportunities and accounts they stand on'),
    (60, 'public.placements', 'delete', 'firm_id', 'placements (what was won, with the commission expected); before the opportunities and accounts they stand on'),
    (61, 'public.opportunities', 'delete', 'firm_id', 'opportunities (each is one search for one account); before the contacts and accounts they stand on'),
    (62, 'public.contacts', 'delete', 'firm_id', 'contacts, the people at the firm''s accounts'),
    (63, 'public.accounts', 'delete', 'firm_id', 'accounts, the businesses the firm quotes for; the intakes on their opportunities stay with their employers (below)'),
    (64, 'public.labels', 'delete', 'firm_id', 'the firm''s own list of labels; after the accounts that carried them'),
    (70, 'public.firm_teams', 'delete', 'firm_id', 'teams (the memberships that named one are cleared first)'),
    -- Kept, and why.
    (900, 'public.firms', 'keep', NULL, 'the row stays: its address stays taken for twelve months and its record must still exist'),
    (900, 'public.firm_memberships', 'keep', NULL, 'every membership is ended, not deleted: a membership is the dated record of who belonged (it is never changed)'),
    (900, 'public.firm_member_suspensions', 'keep', NULL, 'each open one is ended; the rows are the dated record of who was suspended'),
    (900, 'public.firm_activity', 'keep', NULL, 'the firm''s own record is pruned after ninety days by its own job (D-45)'),
    (900, 'public.firm_suspensions', 'keep', NULL, 'the platform''s record of suspensions'),
    (900, 'public.firm_closures', 'keep', NULL, 'the platform''s record of this: when it was asked, by whom, when it closed, and what was deleted, without content'),
    (900, 'public.support_sessions', 'keep', NULL, 'the platform''s record of each time Nevermore looked at the firm: who, why, when it started and ended (a session ends when the firm closes)'),
    (900, 'public.advisor_field_reviews', 'keep', NULL, 'an intake''s: it stays for its employer under the intake retention rules'),
    (900, 'public.advisor_notes', 'keep', NULL, 'an intake''s'),
    (900, 'public.advisor_review_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.ai_extraction_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.chamber_certifications', 'keep', NULL, 'an intake''s'),
    (900, 'public.chamber_sessions', 'keep', NULL, 'the intakes: they belong to the employer who made them and are not the firm''s to delete'),
    (900, 'public.document_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.documents', 'keep', NULL, 'an intake''s'),
    (900, 'public.information_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.intake_consents', 'keep', NULL, 'the employer''s own agreement'),
    (900, 'public.intake_deletions', 'keep', NULL, 'the record that an intake was deleted, kept after it'),
    (900, 'public.intake_lifecycle_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.manuscript_versions', 'keep', NULL, 'an intake''s'),
    (900, 'public.profiles', 'keep', NULL, 'the employer''s own profile'),
    (900, 'public.quote_request_addresses', 'keep', NULL, 'a quote request''s: quote requests belong to an intake'),
    (900, 'public.quote_request_events', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_message_attachments', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_messages', 'keep', NULL, 'a quote request''s mail thread with a PEO'),
    (900, 'public.quote_request_messages WHERE quote_request_id IS NULL', 'keep', NULL, 'held mail from a PEO: held for the platform once the firm has no members, and discarded by the holding list''s own schedule'),
    (900, 'public.quote_request_notes', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_thread_reads', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_status_history', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_workflow', 'keep', NULL, 'an intake''s'),
    (900, 'storage.objects WHERE bucket_id = ''documents''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''manuscripts''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;
