-- Bring the existing submissions in, and the rule that every submission sits on an opportunity (story CRM-Q1.3; docs/BROKER_CRM_BUILD.md D-29, D-32, D-105,
-- D-185, D-193, D-195, D-207, D-214, D-219; GLOSSARY.md "The broker's CRM"; ADR 0023, 0025; 20261119100000_crm_records.sql, 20261119110000_chain_at_certification.sql).
--
-- What this is. Before CRM-Q1.1b a certified intake had no account, contact or opportunity. This brings every one that exists when it ships in, by the same
-- step a first certification takes (make_intake_chain): its own account (matched by D-193 only to mark it, never merged), a contact from its prospect, an
-- opportunity holding it, all owned by nobody (D-214). Then it adds the rule: a submission, and a quote request, sits on one opportunity, and the database
-- refuses anything else.
--
-- A submission. ADR 0025: an intake certified at least once, not a draft. That is "has a row in chamber_certifications", the same test the step uses, and it
-- stays true when the employer changes the answers afterwards and the intake goes back to in progress (the chain stays, as the step's tests prove).
--
-- Quote requests as quotes. A quote request is already on an intake (quote_requests.session_id) and the Quote of the workspace's screens is that quote request
-- (D-185, GLOSSARY "Quote"), so it sits on the opportunity that holds its intake: bringing the intake in is what brings its quote requests in. No table is
-- needed and none is made; the quotes table of the New quote flow (Epic 5) is not what this story asks for. The report counts the quote requests that are now
-- on an opportunity.
--
-- The run. bring_submissions_in() is the whole of it and can be run again: it looks only at certified intakes that sit on no opportunity, so a second run
-- finds none and answers zeros. The earliest first certification goes first, and each record it makes is given that time as its creation, so the duplicate
-- match (which takes the earliest account by creation) marks the LATER submission as the possible duplicate of the EARLIER one, however fast the run is.
-- It answers, and the migration prints, how many of each it made. A closed firm's submissions are left alone (it holds no CRM records, and closing deleted
-- them on purpose; the step answers closed).
--
-- One transaction, and why. A migration is one transaction under `supabase db push`, and the step holds the firm's advisory lock until commit, so every
-- certification of a firm with something to bring in waits for the run. Row 6's note was to bring them in in batches; a migration cannot commit between
-- batches, and the rule below cannot be added until the last submission has its opportunity. So the run is one transaction, kept short: nothing but the step
-- runs in it, the lock is taken only for firms that have an intake to bring in, and a wait longer than 15 seconds for the lock fails the run (and rolls the
-- migration back, to be run again) instead of hanging. The time is that of one chain for each submission (milliseconds each; measured in the test).
-- Nothing is lost by running it in a quiet hour.
--
-- The rule (D-29: constraint triggers, no lock). Row-level constraint triggers that fire at the end of the statement and are deferrable, so a fixture or a
-- later merge can move records in one transaction with SET CONSTRAINTS:
--   * an intake is saved as submitted (chamber_sessions insert or update): it must sit on an opportunity. The chain trigger of CRM-Q1.1b fires first in the same
--     statement (it is named earlier), so a first certification passes, and a submission can't be made without its opportunity. (The certification row is written
--     by a trigger that runs before the intake's row is, so a check on the certification itself would run before the chain and refuse every first one.)
--   * an opportunity is deleted, or no longer holds its intake: the intake must still sit on one, if it is a submission or holds a quote request.
--   * a quote request is made on an intake, or moved to another: the intake must sit on an opportunity.
-- What the rule leaves alone, each with its reason:
--   * a closed firm (firm_closures.closed_at): closing deleted the opportunities and kept the intakes (D-117), and a certification there makes no chain;
--   * a firm that is closing right now (the setting close_firm_now makes for the transaction): it is deleting the opportunities;
--   * an intake that is gone: deleting an intake clears its opportunity's link, and nothing is left to refuse;
--   * a draft that was never certified: ADR 0025.
-- A closing firm that is not yet closed keeps its chains (its members read, and write nothing, ADR 0023), so it has nothing to be exempted from.
-- Moving an intake to another firm is already refused while an opportunity holds it (opportunities_intake_fkey, 20261119100000): the rule adds that the
-- opportunity may not simply be deleted first.
--
-- What is NOT here: a quotes table or a quote on screen (Epic 5, CRM-Q2); merging the possible duplicates it marks (CRM-S4.3); the account's fields being
-- filled again (CRM-Q1.2); anything on screen.

-- ---------- 1. Bringing them in ----------
CREATE OR REPLACE FUNCTION public.bring_submissions_in()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET lock_timeout = '15s'
AS $$
DECLARE
  s record;
  r jsonb;
  submissions integer := 0;
  accounts_made integer := 0;
  contacts_made integer := 0;
  opportunities_made integer := 0;
  duplicates integer := 0;
  closed_left integer := 0;
  quote_requests_on integer := 0;
  n integer;
BEGIN
  -- The certified intakes that sit on no opportunity, earliest first certification first (the id breaks a tie).
  FOR s IN
    SELECT cs.id, f.first_at
    FROM public.chamber_sessions cs
    CROSS JOIN LATERAL (SELECT min(c.recorded_at) AS first_at FROM public.chamber_certifications c WHERE c.session_id = cs.id) f
    WHERE f.first_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.intake_id = cs.id)
    ORDER BY f.first_at, cs.id
  LOOP
    submissions := submissions + 1;
    r := public.make_intake_chain(s.id);
    IF COALESCE((r ->> 'closed')::boolean, false) THEN
      closed_left := closed_left + 1;
    ELSIF (r ->> 'made')::boolean THEN
      -- The records are the submission's age, not the migration's, so the next intake's match finds the earliest account first.
      UPDATE public.accounts SET created_at = s.first_at WHERE id = (r ->> 'account_id')::uuid;
      UPDATE public.contacts SET created_at = s.first_at WHERE id = (r ->> 'contact_id')::uuid;
      UPDATE public.opportunities SET created_at = s.first_at WHERE id = (r ->> 'opportunity_id')::uuid;
      accounts_made := accounts_made + 1;
      opportunities_made := opportunities_made + 1;
      IF r ->> 'contact_id' IS NOT NULL THEN contacts_made := contacts_made + 1; END IF;
      IF r ->> 'possible_duplicate_of' IS NOT NULL THEN duplicates := duplicates + 1; END IF;
      SELECT count(*) INTO n FROM public.quote_requests q WHERE q.session_id = s.id;
      quote_requests_on := quote_requests_on + n;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'submissions_found', submissions,
    'accounts', accounts_made,
    'contacts', contacts_made,
    'opportunities', opportunities_made,
    'possible_duplicates', duplicates,
    'quote_requests_on_an_opportunity', quote_requests_on,
    'left_alone_closed_firm', closed_left);
END;
$$;

REVOKE ALL ON FUNCTION public.bring_submissions_in() FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The rule ----------
-- Refuses (23514) an intake that is a submission or holds a quote request and sits on no opportunity, unless its firm is closed or closing now, or it is
-- gone. The one place that says what the rule is; the three triggers below ask it.
CREATE OR REPLACE FUNCTION public.require_opportunity_for_intake(p_intake_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_firm uuid;
BEGIN
  IF p_intake_id IS NULL OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.intake_id = p_intake_id) THEN
    RETURN;
  END IF;
  SELECT cs.firm_id INTO v_firm FROM public.chamber_sessions cs WHERE cs.id = p_intake_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF public.firm_is_closed(v_firm) OR current_setting('nevermore.closing_firm', true) = v_firm::text THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.chamber_sessions cs WHERE cs.id = p_intake_id AND cs.status = 'submitted')
     OR EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = p_intake_id)
     OR EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.session_id = p_intake_id) THEN
    RAISE EXCEPTION 'Every submission and every quote request sits on one opportunity' USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.require_opportunity_for_intake(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_opportunity_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'opportunities' THEN
    PERFORM public.require_opportunity_for_intake(OLD.intake_id);
  ELSIF TG_TABLE_NAME = 'chamber_sessions' THEN
    PERFORM public.require_opportunity_for_intake(NEW.id);
  ELSE
    PERFORM public.require_opportunity_for_intake(NEW.session_id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_opportunity_rule() FROM PUBLIC, anon, authenticated, service_role;

-- Dropped first so the migration can be run again.
DROP TRIGGER IF EXISTS chamber_sessions_has_opportunity ON public.chamber_sessions;
DROP TRIGGER IF EXISTS opportunities_keep_intake_delete ON public.opportunities;
DROP TRIGGER IF EXISTS opportunities_keep_intake_unlink ON public.opportunities;
DROP TRIGGER IF EXISTS quote_requests_has_opportunity ON public.quote_requests;

-- Fires after the chain trigger (chamber_sessions_chain) of the same statement, which makes the chain at a first certification; only then is this asked.
CREATE CONSTRAINT TRIGGER chamber_sessions_has_opportunity AFTER INSERT OR UPDATE OF status, firm_id ON public.chamber_sessions
  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW WHEN (NEW.status = 'submitted') EXECUTE FUNCTION public.enforce_opportunity_rule();

CREATE CONSTRAINT TRIGGER opportunities_keep_intake_delete AFTER DELETE ON public.opportunities
  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW WHEN (OLD.intake_id IS NOT NULL) EXECUTE FUNCTION public.enforce_opportunity_rule();

CREATE CONSTRAINT TRIGGER opportunities_keep_intake_unlink AFTER UPDATE OF intake_id ON public.opportunities
  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW WHEN (OLD.intake_id IS NOT NULL AND NEW.intake_id IS DISTINCT FROM OLD.intake_id) EXECUTE FUNCTION public.enforce_opportunity_rule();

CREATE CONSTRAINT TRIGGER quote_requests_has_opportunity AFTER INSERT OR UPDATE OF session_id ON public.quote_requests
  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION public.enforce_opportunity_rule();

-- ---------- 3. The run ----------
-- The rule is in place first, so nothing brought in can go against it. The report is a notice, which
-- `supabase db push` prints, and the function answers the same counts to anyone who runs it again.
DO $$
DECLARE
  r jsonb := public.bring_submissions_in();
BEGIN
  RAISE NOTICE 'CRM-Q1.3: % submissions had no opportunity; made % accounts, % contacts and % opportunities (% marked possible duplicate); % quote requests are on an opportunity; % submissions of closed firms left alone',
    r ->> 'submissions_found', r ->> 'accounts', r ->> 'contacts', r ->> 'opportunities', r ->> 'possible_duplicates',
    r ->> 'quote_requests_on_an_opportunity', r ->> 'left_alone_closed_firm';
END $$;
