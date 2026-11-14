-- The records (story CRM-Q1.1a; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-45, D-46, D-104, D-105, D-186, D-192, D-193, D-194, D-197, D-198, D-204, D-206,
-- D-207, D-209, D-211, D-214; GLOSSARY.md "The broker's CRM"; ADR 0025; 20261116110000 (the visibility helper), 20261118130000 and 20261118160000
-- (history and version)).
--
-- What this is. The three tables every later Epic 3 story stands on: accounts (the businesses a firm quotes for), contacts (the people at them) and
-- opportunities (one search for one account and one start date). Nothing here is on screen and nothing writes to them yet: the functions that make and
-- change records are the later stories', so each of them can ask the level rule, the closing firm and support (D-209, ADR 0023, ADR 0024) in one place.
--
--   * Each table carries its firm and a record owner (nullable). A record with no owner, or whose owner left the firm, is an owner's alone, by
--     can_see_firm_record. An account is read by its own owner's level; a CONTACT AND AN OPPORTUNITY ARE READ BY THEIR ACCOUNT'S, so changing an
--     account's owner changes at once who sees it and everything on it (CRM-S5.1). A contact's or an opportunity's own owner decides who may CHANGE it
--     (D-209, a later story's function), never who sees it.
--   * The API roles may read what row security shows them and write nothing: no insert, update, delete or truncate. The service role reads too. The rows
--     are made by the migrations' own functions (later stories) and, in tests, by the superuser.
--   * The chain's rules are constraints, so no function can forget one (D-29): a contact is on an account of its own firm; an opportunity is on an
--     account of its own firm, and its main contact is a contact on that same account; at most one main contact per account; a prospect is at most one
--     contact of an account (D-194); an intake is on at most one opportunity, and an opportunity holds one intake (D-207); an account may be marked a
--     possible duplicate of another account of the same firm. The "an email or a phone" rule of a contact is a check.
--   * Both ends of the chain are left open for the stories that finish it: an opportunity may exist with no intake and be given one later (CRM-Q1.1b),
--     and an intake may exist with no opportunity until the rule that every submission has one is added (CRM-Q1.3).
--   * An account's STATUS and an opportunity's STAGE are worked out, never stored (D-197, D-206): account_status() and opportunity_stage() below, for
--     the later table and page queries to call. Neither is executable by an API role, since each answers for any account or opportunity by id; a query
--     that has already decided the caller may see the record calls it.
--   * History and version, through record_track(): the record's own fields (never a stamp, the derived web domain, the source the product sets, or the
--     link to an intake or a prospect, which the product sets), with the history domain, record_history_can_see and record_history_record_exists.
--   * Closing a firm deletes the three tables (firm_closing_plan), opportunities first, then contacts, then accounts.
--
-- What is NOT here: renewals, labels and custom fields (D-186, D-198); the duplicate match (CRM-Q1.1b, CRM-S4.2); the chain made at certification and
-- the rule that every submission sits on an opportunity (CRM-Q1.1b, CRM-Q1.3); calls, notes, tasks and last activity (CRM-E1.5); any save function.

-- ---------- 1. The web domain ----------
-- The match key of D-193: the address a person typed, reduced to its domain: lower case, no scheme, no login, no path, query, port or trailing dot,
-- and no leading "www." (any white space around it, a tab or a line break included, is trimmed, and a scheme with one slash or three, or with
-- backslashes, is still a scheme). Nothing is left of an address that is only a "www." or blanks, and that is no domain. (Whether the domain is a free-mail one
-- is the duplicate match's to decide, CRM-Q1.1b.) Pure.
CREATE FUNCTION public.web_domain_of(p_website text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                lower(regexp_replace(p_website, '^[[:space:] ​﻿]+|[[:space:] ​﻿]+$', '', 'g')),
                '^[a-z][a-z0-9+.-]*:[/\\]+', ''),
              '[/\\?#].*$', ''),
            '^.*@', ''),
          ':[0-9]*$', ''),
        '^www\.', ''),
      '\.+$', ''),
    '')
$$;

REVOKE ALL ON FUNCTION public.web_domain_of(text) FROM PUBLIC, anon, authenticated, service_role;

-- Every state of a list is a state code. Pure; a check constraint calls it.
CREATE FUNCTION public.crm_states_ok(p_states text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT cardinality(p_states) <= 60 AND NOT EXISTS (SELECT 1 FROM unnest(p_states) s WHERE NOT public.is_us_state_code(s))
$$;

REVOKE ALL ON FUNCTION public.crm_states_ok(text[]) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. Accounts ----------
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  -- The record owner (CRM-S5.1). Nobody, or someone who has left, is an owner's alone. A deleted person clears it.
  owner_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL CONSTRAINT accounts_name_check CHECK (btrim(name) <> '' AND char_length(name) <= 200),
  trade_name text CONSTRAINT accounts_trade_name_check CHECK (char_length(trade_name) <= 200),
  website text CONSTRAINT accounts_website_check CHECK (char_length(website) <= 300),
  -- Worked out from the website, never written (D-193).
  web_domain text GENERATED ALWAYS AS (public.web_domain_of(website)) STORED,
  phone text CONSTRAINT accounts_phone_check CHECK (char_length(phone) <= 40),
  street text CONSTRAINT accounts_street_check CHECK (char_length(street) <= 200),
  city text CONSTRAINT accounts_city_check CHECK (char_length(city) <= 100),
  state text CONSTRAINT accounts_state_check CHECK (public.is_us_state_code(state) OR state IS NULL),
  postal_code text CONSTRAINT accounts_postal_code_check CHECK (char_length(postal_code) <= 20),
  industry text CONSTRAINT accounts_industry_check CHECK (char_length(industry) <= 200),
  employees integer CONSTRAINT accounts_employees_check CHECK (employees >= 0),
  states_of_operation text[] NOT NULL DEFAULT '{}' CONSTRAINT accounts_states_of_operation_check CHECK (public.crm_states_ok(states_of_operation)),
  current_provider text CONSTRAINT accounts_current_provider_check CHECK (char_length(current_provider) <= 200),
  -- Set by the product when the account is made and never edited (D-211): the trigger below keeps what the row had. No default, so a step that makes an
  -- account and forgets to say where it came from fails instead of writing Added by hand.
  source text NOT NULL CONSTRAINT accounts_source_check CHECK (source IN ('employer_intake', 'added_by_hand', 'new_quote', 'lead', 'import')),
  possible_duplicate_of uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- The pair other tables point at, so a record of one firm can't be put on another firm's account.
  CONSTRAINT accounts_firm_id_id_key UNIQUE (firm_id, id),
  CONSTRAINT accounts_not_its_own_duplicate CHECK (possible_duplicate_of IS DISTINCT FROM id),
  -- The earlier account's deletion clears the mark and keeps the later account.
  CONSTRAINT accounts_possible_duplicate_of_fkey FOREIGN KEY (firm_id, possible_duplicate_of) REFERENCES public.accounts (firm_id, id)
    ON DELETE SET NULL (possible_duplicate_of)
);

CREATE INDEX accounts_owner_idx ON public.accounts (firm_id, owner_id);
CREATE INDEX accounts_web_domain_idx ON public.accounts (firm_id, web_domain) WHERE web_domain IS NOT NULL;
CREATE INDEX accounts_possible_duplicate_idx ON public.accounts (firm_id, possible_duplicate_of) WHERE possible_duplicate_of IS NOT NULL;

COMMENT ON TABLE public.accounts IS 'A business the firm quotes for (glossary: Account). Status is worked out by account_status(), never stored.';

-- ---------- 3. Contacts ----------
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  account_id uuid NOT NULL,
  -- Decides who may change the contact (D-209). Who sees it is its account's owner's level, never this.
  owner_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  first_name text CONSTRAINT contacts_first_name_check CHECK (char_length(first_name) <= 100),
  last_name text NOT NULL CONSTRAINT contacts_last_name_check CHECK (btrim(last_name) <> '' AND char_length(last_name) <= 100),
  title text CONSTRAINT contacts_title_check CHECK (char_length(title) <= 100),
  email text CONSTRAINT contacts_email_check CHECK (char_length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  phone text CONSTRAINT contacts_phone_check CHECK (char_length(phone) <= 40),
  mobile text CONSTRAINT contacts_mobile_check CHECK (char_length(mobile) <= 40),
  is_main boolean NOT NULL DEFAULT false,
  do_not_email boolean NOT NULL DEFAULT false,
  -- The prospect (the person who certified an intake) this contact was made from (D-194): the same person is never added twice to an account. The
  -- name, email and phone were copied once and are not kept in step. Set by the product, so it is not one of the contact's own tracked fields.
  prospect_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A name and an email or a phone (glossary: Contact). A mobile number is a phone.
  CONSTRAINT contacts_reachable CHECK (
    nullif(btrim(email), '') IS NOT NULL OR nullif(btrim(phone), '') IS NOT NULL OR nullif(btrim(mobile), '') IS NOT NULL),
  -- On exactly one account, of the contact's own firm.
  CONSTRAINT contacts_account_fkey FOREIGN KEY (firm_id, account_id) REFERENCES public.accounts (firm_id, id) ON DELETE CASCADE,
  -- The pair an opportunity's main contact points at, so the main contact is on the opportunity's own account.
  CONSTRAINT contacts_account_id_id_key UNIQUE (account_id, id),
  -- A prospect is at most one contact of an account. Plain, so "ON CONFLICT (account_id, prospect_user_id) DO NOTHING" makes the same step safe to run twice.
  CONSTRAINT contacts_one_per_prospect UNIQUE (account_id, prospect_user_id)
);

-- At most one main contact per account (D-29; CRM-A2.2).
CREATE UNIQUE INDEX contacts_one_main ON public.contacts (account_id) WHERE is_main;
-- What the duplicate match asks: a contact's email, ignoring case, within a firm (D-193).
-- Firm-scoped reads, a firm's closing (DELETE ... WHERE firm_id) and an account's cascade find a firm's contacts by this.
CREATE INDEX contacts_firm_account_idx ON public.contacts (firm_id, account_id);
CREATE INDEX contacts_email_idx ON public.contacts (firm_id, lower(email)) WHERE email IS NOT NULL;

COMMENT ON TABLE public.contacts IS 'A person at an account (glossary: Contact), on exactly one account. Seen by whoever may see its account.';

-- ---------- 4. Opportunities ----------
ALTER TABLE public.chamber_sessions ADD CONSTRAINT chamber_sessions_id_firm_id_key UNIQUE (id, firm_id);

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  account_id uuid NOT NULL,
  owner_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  -- The intake (chamber_sessions.id) this opportunity holds: at most one each way (D-207), by the two uniqueness rules (this column is unique, and an
  -- opportunity has one column). Plain unique so the step that makes the chain can say ON CONFLICT (intake_id) DO NOTHING. The intake's deletion
  -- leaves the opportunity, with none. Set by the product, so not one of the opportunity's own tracked fields.
  intake_id uuid CONSTRAINT opportunities_intake_id_key UNIQUE,
  name text NOT NULL CONSTRAINT opportunities_name_check CHECK (btrim(name) <> '' AND char_length(name) <= 200),
  target_start date,
  -- Employees in this search, which may differ from the account's.
  employees integer CONSTRAINT opportunities_employees_check CHECK (employees >= 0),
  main_contact_id uuid,
  expected_close date,
  value numeric(14, 2) CONSTRAINT opportunities_value_check CHECK (value >= 0),
  source text CONSTRAINT opportunities_source_check CHECK (char_length(source) <= 100),
  next_step text CONSTRAINT opportunities_next_step_check CHECK (char_length(next_step) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_account_fkey FOREIGN KEY (firm_id, account_id) REFERENCES public.accounts (firm_id, id),
  -- The intake is one of the opportunity's own firm, enforced from both sides by this foreign key on the pair: an opportunity can't name another firm's
  -- intake, and an intake that an opportunity holds can't be moved to another firm, by anyone (the service role can move an intake: keep_intake_firm binds
  -- only the browser's roles). The intake's deletion leaves the opportunity, with none.
  CONSTRAINT opportunities_intake_fkey FOREIGN KEY (intake_id, firm_id) REFERENCES public.chamber_sessions (id, firm_id) ON DELETE SET NULL (intake_id),
  -- The main contact is a contact on the same account; a contact's deletion clears it. Moving a contact to another account while it is the main
  -- contact of an opportunity is refused, unless the opportunity moves with it in the same transaction. The link is deferrable (initially immediate), so a merge (CRM-S4.3b) can move contacts and the opportunities that name them in one transaction without clearing and
  -- restoring each main contact.
  CONSTRAINT opportunities_main_contact_fkey FOREIGN KEY (account_id, main_contact_id) REFERENCES public.contacts (account_id, id)
    ON DELETE SET NULL (main_contact_id) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX opportunities_account_idx ON public.opportunities (firm_id, account_id);
CREATE INDEX opportunities_owner_idx ON public.opportunities (firm_id, owner_id);
CREATE INDEX opportunities_main_contact_idx ON public.opportunities (main_contact_id) WHERE main_contact_id IS NOT NULL;

COMMENT ON TABLE public.opportunities IS 'One search for one account and one start date (glossary: Opportunity). Its stage is worked out by opportunity_stage(), never stored.';

-- chamber_sessions holds its firm in another column, so the foreign key on the pair above needs it unique with the id. Additive: the id is already the key.
-- (A trigger on the opportunity alone was tried first and refused: it fires only when the opportunity changes, so an intake moved to another firm
-- left the opportunity on it.)
-- ---------- 5. Stamps, and a source nobody edits ----------
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- An account's source is the product's (D-211): an update keeps what the row had, whoever sends it (as keep_intake_source does for an intake's).
CREATE FUNCTION public.keep_account_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.source := OLD.source;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_account_source() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER accounts_keep_source BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.keep_account_source();

-- ---------- 6. Row security ----------
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Nobody writes through the API: no insert, update, delete or truncate for any API role. The service role (server code) reads, as it reads every
-- firm's table.
REVOKE ALL ON public.accounts, public.contacts, public.opportunities FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.accounts, public.contacts, public.opportunities TO authenticated, service_role;

-- An account is seen by its own owner's level (can_see_firm_record: a current member of a firm that shows everyone everything; otherwise an owner sees
-- the firm's, a lead their team's and the teams under it, an agent their own; no owner is an owner's alone; nobody who is not a current member).
CREATE POLICY accounts_visible ON public.accounts FOR SELECT TO authenticated
  USING (public.can_see_firm_record(firm_id, owner_id));

-- A contact and an opportunity are seen by whoever may see their account (CRM-S5.1), so changing the account's owner changes it at once.
CREATE POLICY contacts_visible ON public.contacts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = contacts.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id)));

CREATE POLICY opportunities_visible ON public.opportunities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = opportunities.account_id AND public.can_see_firm_record(a.firm_id, a.owner_id)));

-- ---------- 7. History and version ----------
-- The history's list of tables.
ALTER DOMAIN public.record_history_table DROP CONSTRAINT record_history_table_known;
ALTER DOMAIN public.record_history_table ADD CONSTRAINT record_history_table_known
  CHECK (VALUE IN ('referral_partners', 'accounts', 'contacts', 'opportunities'));

-- Each record's own fields. Not its stamps (created_at, updated_at), the web domain worked out from the website, the account's source, or the links
-- the product sets (a contact's prospect, an opportunity's intake); not the version, which the trigger owns.
SELECT public.record_track('public.accounts', 'accounts', ARRAY['id'], ARRAY[
  'owner_id', 'name', 'trade_name', 'website', 'phone', 'street', 'city', 'state', 'postal_code', 'industry', 'employees', 'states_of_operation',
  'current_provider', 'possible_duplicate_of', 'archived_at']);
SELECT public.record_track('public.contacts', 'contacts', ARRAY['id'], ARRAY[
  'account_id', 'owner_id', 'first_name', 'last_name', 'title', 'email', 'phone', 'mobile', 'is_main', 'do_not_email']);
SELECT public.record_track('public.opportunities', 'opportunities', ARRAY['id'], ARRAY[
  'account_id', 'owner_id', 'name', 'target_start', 'employees', 'main_contact_id', 'expected_close', 'value', 'source', 'next_step']);

-- A history key as the record's id, or NULL when it is not one (only the canonical lower-case form: it is what the history stores). The three tables
-- compare ids as ids, so the primary key's index is used: comparing `id::text = key` scans the table, which a firm's contacts made slow enough to matter
-- (deleting one account with 2,000 contacts in a database of 200,000 took 18 s). Pure.
CREATE FUNCTION public.record_history_key_uuid(p_key text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_key::uuid END
$$;

REVOKE ALL ON FUNCTION public.record_history_key_uuid(text) FROM PUBLIC, anon, authenticated, service_role;

-- Whether the caller may see THAT record in THAT firm (20261118130000, restated with its referral-partner rule). An account is seen by its own owner's
-- level; a contact and an opportunity by their account's, as their rows are. The record must exist in the firm. Internal.
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
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_can_see(uuid, public.record_history_table, text) FROM PUBLIC, anon, authenticated, service_role;

-- Whether a record still exists, per table (20261118130500, restated). A table nobody has taught this function counts as still there.
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
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_history_record_exists(uuid, public.record_history_table, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_history_record_exists(uuid, public.record_history_table, text) TO record_history_remover;

-- ---------- 8. An opportunity's stage and an account's status, worked out ----------
-- The opportunity's stage from its submission's pipeline stage (D-206), pure: draft, submitted, under review and information requested are Intake under
-- way; ready for market is Ready to send; sent to PEOs (sent_to_carrier) is In market; quoted is Quoted; won is Won; lost and archived are Lost. No
-- submission (null) is Qualifying. A pipeline stage nobody mapped is refused, not answered with nothing, so a new stage can't slip by. The words on
-- screens are the screens' (Intake under way, Ready to send, In market ...). Reopening an archived submission brings its opportunity back because
-- nothing is stored: the stage is asked each time. An opportunity is open until it is won or lost.
CREATE FUNCTION public.opportunity_stage_of(p_pipeline_status text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  stage text;
BEGIN
  IF p_pipeline_status IS NULL THEN
    RETURN 'qualifying';
  END IF;
  stage := CASE p_pipeline_status
    WHEN 'draft' THEN 'intake_under_way'
    WHEN 'submitted' THEN 'intake_under_way'
    WHEN 'under_review' THEN 'intake_under_way'
    WHEN 'information_requested' THEN 'intake_under_way'
    WHEN 'ready_for_market' THEN 'ready_to_send'
    WHEN 'sent_to_carrier' THEN 'in_market'
    WHEN 'quoted' THEN 'quoted'
    WHEN 'won' THEN 'won'
    WHEN 'lost' THEN 'lost'
    WHEN 'archived' THEN 'lost'
  END;
  IF stage IS NULL THEN
    RAISE EXCEPTION 'The pipeline stage "%" has no opportunity stage', left(p_pipeline_status, 64) USING ERRCODE = '22023';
  END IF;
  RETURN stage;
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_stage_of(text) FROM PUBLIC, anon, authenticated, service_role;

-- The stage a submission gives its opportunity (D-206, with D-216): the pipeline stage's stage, except that a submission archived straight from won (the
-- last move into archived, in its status history, was from won) keeps its opportunity Won: archived is the only move the pipeline allows from won, so
-- every won file put away would otherwise flip to Lost and its account back to a prospect. Archived from any other stage is Lost. Reopening it (archived
-- to submitted) brings it back, since the stage is asked each time. A submission with no pipeline row yet is a draft. Internal: the two functions below
-- ask it.
CREATE FUNCTION public.submission_opportunity_stage(p_intake_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN s.status = 'archived' AND (
      SELECT h.from_status FROM public.submission_status_history h
      WHERE h.session_id = p_intake_id AND h.to_status = 'archived' ORDER BY h.id DESC LIMIT 1) = 'won' THEN 'won'
    ELSE public.opportunity_stage_of(s.status)
  END
  FROM (SELECT COALESCE((SELECT w.status FROM public.submission_workflow w WHERE w.session_id = p_intake_id), 'draft') AS status) s
$$;

REVOKE ALL ON FUNCTION public.submission_opportunity_stage(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- One opportunity's stage by its id: Qualifying with no intake, else its submission's (above). NULL for an opportunity that is not there. Answers for any
-- opportunity: no API role runs it; a query that has already decided the caller may see the record calls it, for each row it returns.
CREATE FUNCTION public.opportunity_stage(p_opportunity_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN o.intake_id IS NULL THEN 'qualifying' ELSE public.submission_opportunity_stage(o.intake_id) END
  FROM public.opportunities o
  WHERE o.id = p_opportunity_id
$$;

REVOKE ALL ON FUNCTION public.opportunity_stage(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- One account's status by its id (CRM-A1.3 as D-197 scopes it): 'prospect' until one of its opportunities is Won (a submission won, and one archived
-- straight from won, D-216), then 'client'. Reopening the submission makes it a prospect again until it is won again; a former client arrives with the
-- placement record in Epic 4. NULL for an account that is not there. Not executable by an API role, for the reason above.
CREATE FUNCTION public.account_status(p_account_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = p_account_id) THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.account_id = p_account_id AND o.intake_id IS NOT NULL AND public.submission_opportunity_stage(o.intake_id) = 'won') THEN 'client'
    ELSE 'prospect'
  END
$$;

REVOKE ALL ON FUNCTION public.account_status(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 9. Closing a firm deletes them ----------
-- The closing's one list (20261118130000, restated with every line it had), with the three tables: opportunities first, then contacts, then
-- accounts, after the history (ord 55) and with the partners. The intakes on the opportunities stay with their employers: they are kept below.
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
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (61, 'public.opportunities', 'delete', 'firm_id', 'opportunities (each is one search for one account); before the contacts and accounts they stand on'),
    (62, 'public.contacts', 'delete', 'firm_id', 'contacts, the people at the firm''s accounts'),
    (63, 'public.accounts', 'delete', 'firm_id', 'accounts, the businesses the firm quotes for; the intakes on their opportunities stay with their employers (below)'),
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
