-- A line says what is being quoted (ADR 0029; docs/BROKER_CRM_BUILD.md "## Lines", D-2000 to D-2019; supabase/tests/lines.sql).
-- An opportunity is a PEO search or a workers' comp search, and what hangs from it follows: its intake, the markets the employer may authorize and the firm
-- may send to, what a quote holds and what the comparison shows. Everything else (sending, replies, the stage, won and lost, who may see what) is the same
-- for every line and reads none of this.

-- ---------- 1. The lines ----------
-- The one list. The browser holds the same (QUOTE_LINES in src/data/lines.ts; schemaSync compares them).
CREATE FUNCTION public.quote_lines()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT ARRAY[
    -- sync:begin quote_lines
    'peo', 'workers_comp'
    -- sync:end quote_lines
  ]
$$;
-- The check constraints below call it as whoever writes the row, a prospect starting an intake included (as is_source_code is called). A constant: it says
-- nothing the browser's own copy does not.
GRANT EXECUTE ON FUNCTION public.quote_lines() TO anon, authenticated, service_role;

-- ---------- 2. An opportunity's line ----------
-- Every opportunity made before this, and every one made with no line (the chain at certification, a conversion, a renewal started), is a PEO search.
ALTER TABLE public.opportunities ADD COLUMN line text NOT NULL DEFAULT 'peo';
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_line_check CHECK (line = ANY (public.quote_lines()));

COMMENT ON COLUMN public.opportunities.line IS 'What is being quoted (glossary: Line). Chosen when the opportunity is made and never changed.';

-- A line never changes once it is set (D-2001): what was sent and what was quoted under it would no longer be what the line says. A trigger, since a rule about
-- the row before and after is no check constraint; it binds every writer, the table's owner and so every definer function included. Writing the line a row
-- already has is no change.
CREATE FUNCTION public.refuse_line_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.line IS DISTINCT FROM OLD.line THEN
    RAISE EXCEPTION 'What is being quoted never changes once it is set. Make a new opportunity for the other line.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.refuse_line_change() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER opportunities_line_fixed BEFORE UPDATE OF line ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.refuse_line_change();

-- crm_opportunity_fields restated from its newest definition (20261120130000_opportunity_create.sql) with every line kept, and the line: opportunity_page,
-- opportunity_create's record and update_opportunity's record all read an opportunity through it, so each now says what it quotes.
CREATE OR REPLACE FUNCTION public.crm_opportunity_fields(o public.opportunities)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', o.id, 'version', o.version, 'account_id', o.account_id, 'owner_id', o.owner_id, 'name', o.name, 'target_start', o.target_start,
    'employees', o.employees, 'main_contact_id', o.main_contact_id, 'expected_close', o.expected_close, 'value', o.value, 'source', o.source,
    'referral_partner', (SELECT jsonb_build_object('code', p.code, 'name', p.name) FROM public.referral_partners p
                         WHERE p.firm_id = o.firm_id AND p.code = o.referral_partner_code),
    'next_step', o.next_step, 'submission_id', o.intake_id, 'created_at', o.created_at, 'updated_at', o.updated_at, 'line', o.line)
$$;

-- ---------- 3. New opportunity chooses the line ----------
-- opportunity_create restated from its newest definition (20261121160000_start_the_renewal.sql) with every line kept, and one more argument, last and with a
-- default: the line. A caller that names none (every caller before this, the browser until its form sends one) makes a PEO search, as before. The old
-- thirteen-argument function is dropped, since two would make a call that names its arguments ambiguous; the grants are restated.
DROP FUNCTION public.opportunity_create(uuid, text, date, integer, uuid, date, numeric, text, text, text, uuid, uuid, uuid);

CREATE FUNCTION public.opportunity_create(
  p_account_id uuid, p_name text, p_target_start date, p_employees integer, p_main_contact_id uuid, p_expected_close date, p_value numeric, p_source text,
  p_referral_partner_code text, p_next_step text, p_owner_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL, p_renewal_id uuid DEFAULT NULL,
  p_line text DEFAULT 'peo')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  name_in text := NULLIF(btrim(p_name), '');
  source_in text := NULLIF(btrim(p_source), '');
  partner_in text := NULLIF(btrim(p_referral_partner_code), '');
  next_in text := NULLIF(btrim(p_next_step), '');
  -- A line sent as nothing is a line not said: a PEO search, as when it is left out.
  line_in text := COALESCE(p_line, 'peo');
  problem text;
  a public.accounts;
  owner uuid;
  owner_until timestamptz;
  made public.opportunities;
  violated text;
  renewal_account uuid;
  r public.renewals;
  worker_name text;
  worker_stage text;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  -- With a renewal to link, the account is held FOR NO KEY UPDATE from the start (renewal_to_change holds it so): taking FOR SHARE first and upgrading would
  -- deadlock two saves on one renewal. Without one, FOR SHARE as before.
  IF p_renewal_id IS NULL THEN
    SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR SHARE;
  ELSE
    SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR NO KEY UPDATE;
  END IF;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing can be added to it.' USING ERRCODE = '55000';
  END IF;
  problem := public.opportunity_input_error(name_in, p_employees, p_value, source_in, next_in);
  IF problem IS NULL AND NOT public.opportunity_source_is_known(source_in) THEN
    problem := 'Choose a source from the list.';
  END IF;
  -- Start the renewal's source is Renewal (D-439, D-449): the form holds it, and so does this.
  IF problem IS NULL AND p_renewal_id IS NOT NULL AND source_in IS DISTINCT FROM 'Renewal' THEN
    problem := 'The source of an opportunity that starts a renewal is Renewal.';
  END IF;
  IF problem IS NULL AND partner_in IS NOT NULL THEN
    IF source_in IS DISTINCT FROM 'Referral' THEN
      problem := 'A referral partner goes only with the source Referral.';
    ELSIF NOT EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = firm AND r.code = partner_in) THEN
      problem := 'Choose one of the firm''s referral partners.';
    END IF;
  END IF;
  -- The line is one of the lines (ADR 0029), said in words like any other field's problem.
  IF problem IS NULL AND NOT (line_in = ANY (public.quote_lines())) THEN
    problem := 'Choose what this opportunity quotes: a PEO, or workers'' comp.';
  END IF;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_main_contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_main_contact_id AND c.account_id = a.id) THEN
    RAISE EXCEPTION 'Choose a contact of this account.' USING ERRCODE = '22023';
  END IF;
  -- The owner is the maker unless they choose another. Their membership is locked FOR SHARE (not KEY SHARE: removing or suspending a person is a non-key UPDATE of
  -- this row) until the end of the transaction, as add_contact and create_account lock it: a removal either committed first and the person is no longer current
  -- here, or waits.
  owner := COALESCE(p_owner_id, auth.uid());
  IF owner IS NOT NULL THEN
    SELECT m.valid_until INTO owner_until FROM public.firm_memberships m
    WHERE m.firm_id = firm AND m.user_id = owner AND public.membership_is_current(m.valid_from, m.valid_until)
    FOR SHARE;
  END IF;
  -- membership_is_current reads now(), the start of this transaction, and the row may have been waited for: a removal that committed meanwhile sets valid_until to a
  -- time after that start, so the answer above is stale. Asked again of the row as it is now, against the clock (update_opportunity does the same).
  IF owner IS NULL OR NOT FOUND OR (owner_until IS NOT NULL AND owner_until <= clock_timestamp()) THEN
    RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
  END IF;
  -- update_contact's rule: an owner the caller could not themselves change a record of (an agent: only themselves; a lead: themselves and their teams).
  IF NOT public.can_change_firm_record(firm, owner) THEN
    RAISE EXCEPTION 'You can make an opportunity only for yourself and, as a lead, for people on your teams.' USING ERRCODE = '42501';
  END IF;
  -- And one who can see the account: visibility follows it (D-422), so anyone else would be given an opportunity they could not open.
  IF NOT public.crm_person_sees_record(firm, a.owner_id, owner) THEN
    RAISE EXCEPTION 'Choose someone who can see this account.' USING ERRCODE = '22023';
  END IF;
  -- The renewal this one starts (D-449), asked after everything above. Its account is read without a lock first, so a renewal of another account is refused
  -- before any lock on that account is taken; then renewal_to_change holds the renewal (the account is already held) and asks whether the caller may change it.
  IF p_renewal_id IS NOT NULL THEN
    SELECT x.account_id INTO renewal_account FROM public.renewals x WHERE x.id = p_renewal_id AND x.firm_id = firm;
    IF renewal_account IS DISTINCT FROM a.id THEN
      RAISE EXCEPTION 'Choose a renewal of this account.' USING ERRCODE = '22023';
    END IF;
    r := public.renewal_to_change(firm, p_renewal_id);
    IF r.not_renewed_on IS NOT NULL THEN
      RAISE EXCEPTION 'This renewal is marked as not renewed, so there is no renewal to start.' USING ERRCODE = 'PT409';
    END IF;
    IF r.opportunity_id IS NOT NULL THEN
      SELECT o.name, public.opportunity_stage(o.id) INTO worker_name, worker_stage FROM public.opportunities o WHERE o.id = r.opportunity_id;
      IF worker_stage = 'won' THEN
        RAISE EXCEPTION 'This renewal was renewed by %. Reopen that win first.', COALESCE(worker_name, 'an opportunity') USING ERRCODE = 'PT409';
      ELSIF worker_stage IS DISTINCT FROM 'lost' THEN
        RAISE EXCEPTION 'Its renewal is being worked by %', COALESCE(worker_name, 'an opportunity') USING ERRCODE = 'PT409';
      END IF;
    END IF;
  END IF;
  BEGIN
    INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, target_start, employees, main_contact_id, expected_close, value, source, referral_partner_code, next_step,
                                      line)
    VALUES (firm, a.id, owner, name_in, p_target_start, p_employees, p_main_contact_id, p_expected_close, p_value, source_in, partner_in, next_in, line_in)
    RETURNING * INTO made;
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    IF violated = 'opportunities_referral_partner_fkey' THEN
      RAISE EXCEPTION 'Choose one of the firm''s referral partners.' USING ERRCODE = '22023';
    END IF;
    -- The contact was deleted between the look above and the write.
    RAISE EXCEPTION 'Choose a contact of this account.' USING ERRCODE = '22023';
  END;
  IF p_renewal_id IS NOT NULL THEN
    UPDATE public.renewals SET opportunity_id = made.id WHERE id = r.id;
  END IF;
  RETURN jsonb_build_object('record',
    public.crm_opportunity_fields(made) || jsonb_build_object('stage', public.opportunity_stage(made.id), 'referral_partner_code', made.referral_partner_code));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_create(uuid, text, date, integer, uuid, date, numeric, text, text, text, uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_create(uuid, text, date, integer, uuid, date, numeric, text, text, text, uuid, uuid, uuid, text) TO authenticated;

-- ---------- 4. An intake's line ----------
-- An intake is of one line too: what the employer is asked, shown and may authorize follows it, and the employer reads their own intake, never the firm's
-- opportunity. Every intake made before this is a PEO intake.
ALTER TABLE public.chamber_sessions ADD COLUMN line text NOT NULL DEFAULT 'peo';
ALTER TABLE public.chamber_sessions ADD CONSTRAINT chamber_sessions_line_check CHECK (line = ANY (public.quote_lines()));

COMMENT ON COLUMN public.chamber_sessions.line IS 'What this intake is for (glossary: Line): its opportunity''s line. Set when the intake is made and never changed.';

-- start_broker_intake restated from its newest definition (20261124100000_new_quote_intake.sql) with every line kept: the intake it makes is of the
-- opportunity's line. Same arguments, so the grants stand.
CREATE OR REPLACE FUNCTION public.start_broker_intake(p_opportunity_id uuid, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  o public.opportunities;
  a public.accounts;
  made uuid;
  facts jsonb := '{}'::jsonb;
  prov jsonb := '{}'::jsonb;
  k text;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO a FROM public.accounts x WHERE x.id = (SELECT p.account_id FROM public.opportunities p WHERE p.id = p_opportunity_id AND p.firm_id = firm) FOR SHARE;
  SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = firm FOR UPDATE;
  IF o.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing can be added to it.' USING ERRCODE = '55000';
  END IF;
  IF o.intake_id IS NOT NULL THEN
    RAISE EXCEPTION 'This opportunity already has an intake' USING ERRCODE = 'PT409';
  END IF;
  -- Only what the account holds: a blank field, an empty list and an account with no current provider write nothing (D-1870).
  facts := jsonb_strip_nulls(jsonb_build_object(
    'company_name', a.name, 'industry', NULLIF(btrim(a.industry), ''), 'employee_count', a.employees,
    'states', CASE WHEN COALESCE(cardinality(a.states_of_operation), 0) > 0 THEN to_jsonb(a.states_of_operation) END,
    'hq_state', NULLIF(btrim(a.state), ''), 'street_address', NULLIF(btrim(a.street), ''), 'website', NULLIF(btrim(a.website), ''),
    'current_peo', NULLIF(btrim(a.current_provider), ''), 'in_peo', CASE WHEN NULLIF(btrim(a.current_provider), '') IS NOT NULL THEN true END));
  FOR k IN SELECT key FROM jsonb_object_keys(facts) AS key LOOP
    prov := prov || jsonb_build_object(k, jsonb_build_object('status', 'inferred', 'source', jsonb_build_object('kind', 'broker_entry', 'member_id', auth.uid()),
                                                              'updated_at', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  END LOOP;
  -- The intake is of the opportunity's line (ADR 0029): the opportunity can hold no other (opportunities_intake_line_fkey).
  INSERT INTO public.chamber_sessions (user_id, firm_id, started_by, chamber_data, field_provenance, line) VALUES (NULL, firm, auth.uid(), facts, prov, o.line)
  RETURNING id INTO made;
  UPDATE public.opportunities SET intake_id = made WHERE id = o.id;
  RETURN jsonb_build_object('intake_id', made);
END;
$$;

-- An intake a prospect starts in the browser is a PEO intake, whatever the browser sends (D-2003): until a firm link carries a line, the line of an intake is
-- chosen only by the firm, on the opportunity it starts the intake from. Bound to the browser's own writes, as keep_server_intake_columns is: a definer
-- function (start_broker_intake) and the service role say the line themselves.
CREATE FUNCTION public.keep_intake_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  -- A later save keeps the line the intake has and saves the rest, as a lead's source is kept: the browser may send the whole row back.
  NEW.line := CASE WHEN TG_OP = 'UPDATE' THEN OLD.line ELSE 'peo' END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.keep_intake_line() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER chamber_sessions_a_line BEFORE INSERT OR UPDATE OF line ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.keep_intake_line();

-- And no other writer changes it (D-2001): after keep_intake_line by name, so the browser's save has already been given its old line back and is not refused.
CREATE TRIGGER chamber_sessions_line_fixed BEFORE UPDATE OF line ON public.chamber_sessions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_line_change();

-- ---------- 5. An opportunity holds only an intake of its own line ----------
-- By a foreign key on the pair, as the firm is held (opportunities_intake_fkey), so it holds whatever path links the two and whenever (D-29): a rule inside
-- start_broker_intake alone would leave the chain at certification, a merge and any later path to keep it by themselves. Additive: the id is already the key.
ALTER TABLE public.chamber_sessions ADD CONSTRAINT chamber_sessions_id_line_key UNIQUE (id, line);
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_intake_line_fkey
  FOREIGN KEY (intake_id, line) REFERENCES public.chamber_sessions (id, line) ON DELETE SET NULL (intake_id);

-- An opportunity made for an intake that already exists takes the intake's line (D-2002): the chain at certification, bringing submissions in and a merge
-- name no line, and the key above would refuse any but the intake's. Almost always that is a PEO intake and nothing changes. It is not when an employer
-- ended a firm's access to a workers' comp intake (CRM-P2.5) and certifies again: the opportunity the chain then makes is a workers' comp search.
CREATE FUNCTION public.opportunity_takes_intake_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.line := COALESCE((SELECT s.line FROM public.chamber_sessions s WHERE s.id = NEW.intake_id), NEW.line);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.opportunity_takes_intake_line() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER opportunities_intake_line BEFORE INSERT ON public.opportunities
  FOR EACH ROW WHEN (NEW.intake_id IS NOT NULL) EXECUTE FUNCTION public.opportunity_takes_intake_line();

-- ---------- 6. A market's line ----------
-- Who a quote request is sent to is a market (glossary): a PEO for a PEO search, a carrier for a workers' comp search. Both are rows of `peos`, which
-- keeps its name: the requirement profile, the contacts, the employer's authorization, the send's registration and the reply address are the same for
-- either, so a second table would be a second copy of all of it. A market is of one line. Every market listed before this is a PEO.
ALTER TABLE public.peos ADD COLUMN line text NOT NULL DEFAULT 'peo';
ALTER TABLE public.peos ADD CONSTRAINT peos_line_check CHECK (line = ANY (public.quote_lines()));

COMMENT ON COLUMN public.peos.line IS 'The line this market quotes (glossary: Line, Market): peo for a PEO, workers_comp for a carrier. Never changed.';

-- admin_add_peo restated from its only definition (20261115090000_peo_requirement_profiles.sql) with every line kept, and one more argument, last and with
-- a default: the market's line. A caller that names none adds a PEO, as before. The old one-argument function is dropped, since two would make a call that
-- names its argument ambiguous; the grants are restated.
DROP FUNCTION public.admin_add_peo(text);

CREATE FUNCTION public.admin_add_peo(p_name text, p_line text DEFAULT 'peo')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  peo public.peos;
  clean text := btrim(COALESCE(p_name, ''));
  -- A line sent as nothing is a line not said: a PEO, as when it is left out.
  line_in text := COALESCE(p_line, 'peo');
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF clean = '' OR char_length(clean) > 80 THEN
    RAISE EXCEPTION 'A PEO''s name is 1 to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF NOT (line_in = ANY (public.quote_lines())) THEN
    RAISE EXCEPTION 'Choose what this market quotes: a PEO, or workers'' comp (a carrier).' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.peos (name, created_by, line) VALUES (clean, auth.uid(), line_in) RETURNING * INTO peo;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION '% is already listed', clean USING ERRCODE = '23505';
  END;
  RETURN to_jsonb(peo);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_peo(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_peo(text, text) TO authenticated;

-- peo_catalog restated from its only definition (20261115090000_peo_requirement_profiles.sql) with every line kept, and each market's line: the screens
-- that offer markets show the ones of the intake's line. Same arguments, so the grants stand.
CREATE OR REPLACE FUNCTION public.peo_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH reader AS (SELECT public.is_advisor() AS advisor)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'listed', p.listed, 'line', p.line, 'profile', (
    SELECT to_jsonb(v) - 'peo_id' - 'status' - 'created_at' - 'created_by' - 'published_by' - 'revision'
      || jsonb_build_object('sources', CASE WHEN r.advisor THEN v.sources ELSE (
        SELECT COALESCE(jsonb_object_agg(s.key, CASE WHEN s.value ->> 'kind' = 'person' THEN s.value - 'name' ELSE s.value END), '{}'::jsonb)
        FROM jsonb_each(v.sources - 'contacts') s
      ) END)
    FROM public.peo_profile_versions v
    WHERE v.peo_id = p.id AND v.status = 'published'
    ORDER BY v.version DESC
    LIMIT 1
  )) ORDER BY lower(p.name), p.name), '[]'::jsonb)
  FROM public.peos p CROSS JOIN reader r;
$$;

-- A market's line never changes either (D-2001): the employers who authorized it read it as a market of that line.
CREATE TRIGGER peos_line_fixed BEFORE UPDATE OF line ON public.peos
  FOR EACH ROW EXECUTE FUNCTION public.refuse_line_change();

-- ---------- 7. The employer authorizes markets of the intake's line ----------
-- peo_authorization_states restated from its only definition (20261122100000_peo_authorizations.sql) with every line kept, and the line: the markets an
-- intake offers are the ones of its line (a carrier on a workers' comp intake, a PEO on a PEO intake). Same arguments, so the grants stand.
CREATE OR REPLACE FUNCTION public.peo_authorization_states(p_session_id uuid)
RETURNS TABLE (peo text, state text, signed_at timestamptz, wording_version text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- The employer, and the members of the intake's firm (D-16, D-18); anyone else is told there is no such submission.
  IF NOT (EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = p_session_id AND s.user_id = auth.uid())
          OR public.intake_in_my_firm(p_session_id)) THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN QUERY
  SELECT p.name,
         CASE WHEN l.id IS NULL THEN 'not_asked' WHEN l.authorized THEN 'authorized' ELSE 'withdrawn' END,
         l.signed_at, l.wording_version
  FROM public.peos p
  LEFT JOIN LATERAL (
    SELECT a.id, a.authorized, a.signed_at, a.wording_version FROM public.peo_authorizations a
    WHERE a.session_id = p_session_id AND a.peo_id = p.id ORDER BY a.id DESC LIMIT 1) l ON true
  WHERE (p.listed OR l.id IS NOT NULL)
    AND p.line = (SELECT s.line FROM public.chamber_sessions s WHERE s.id = p_session_id)
  ORDER BY lower(p.name);
END;
$$;

-- set_peo_authorization restated from its only definition (20261122100000_peo_authorizations.sql) with every line kept: the market is one of the intake's
-- own line. Same arguments, so the grants stand.
CREATE OR REPLACE FUNCTION public.set_peo_authorization(p_session_id uuid, p_peo text, p_authorized boolean, p_version text, p_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  peo public.peos;
  rec public.peo_authorizations;
  w public.submission_workflow;
  note text;
  clean_peo constant text := btrim(COALESCE(p_peo, ''));
  clean_text constant text := btrim(COALESCE(p_text, ''));
BEGIN
  -- The intake's own employer, and nobody else: not its firm's members, another employer, or a caller signed out.
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.chamber_sessions s WHERE s.id = p_session_id AND s.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the employer can choose who receives their packet.' USING ERRCODE = '42501';
  END IF;
  -- Signed under the wording the page shows now, or not at all: the browser reloads it (DETAIL the version in force).
  IF p_version IS DISTINCT FROM public.peo_authorization_version() THEN
    RAISE EXCEPTION 'This wording is out of date. Reload the page to read the current version.'
      USING ERRCODE = 'EA005', DETAIL = public.peo_authorization_version();
  END IF;
  IF clean_text = '' OR char_length(clean_text) > 20000 THEN
    RAISE EXCEPTION 'The wording shown is required (1 to 20000 characters).' USING ERRCODE = '22023';
  END IF;
  IF p_authorized IS NULL THEN
    RAISE EXCEPTION 'Say whether the PEO may receive your packet.' USING ERRCODE = '22023';
  END IF;
  IF clean_peo = '' THEN
    RAISE EXCEPTION 'Name the PEO.' USING ERRCODE = '22023';
  END IF;
  -- Only a PEO on the product's list (L-1.1), by name ignoring case and outer spaces; there is no "any PEO". And only a market of the intake's own line
  -- (ADR 0029): a carrier on a workers' comp intake, a PEO on a PEO intake. A market of the other line is as one not listed, in the line's own words.
  SELECT * INTO peo FROM public.peos p
  WHERE lower(p.name) = lower(clean_peo) AND p.listed AND p.line = (SELECT s.line FROM public.chamber_sessions s WHERE s.id = p_session_id);
  IF NOT FOUND THEN
    IF (SELECT s.line FROM public.chamber_sessions s WHERE s.id = p_session_id) = 'workers_comp' THEN
      RAISE EXCEPTION '% is not on the list of workers'' comp carriers. Ask your advisor to have it added first.', left(clean_peo, 80) USING ERRCODE = '22023';
    END IF;
    RAISE EXCEPTION '% is not on the list of PEOs. Ask your advisor to have it added first.', left(clean_peo, 80) USING ERRCODE = '22023';
  END IF;
  -- One change at a time per intake, so two tabs can't both append the same change.
  PERFORM 1 FROM public.chamber_sessions s WHERE s.id = p_session_id FOR UPDATE;
  SELECT * INTO rec FROM public.peo_authorizations a WHERE a.session_id = p_session_id AND a.peo_id = peo.id ORDER BY a.id DESC LIMIT 1;
  -- Saying the same again appends nothing; there is nothing to withdraw from a PEO not authorized.
  IF p_authorized AND rec.authorized THEN
    RETURN to_jsonb(rec);
  ELSIF NOT p_authorized AND rec.authorized IS DISTINCT FROM true THEN
    RAISE EXCEPTION '% is not authorized, so there is nothing to withdraw.', peo.name USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.peo_authorizations (session_id, peo_id, peo_name, authorized, wording_version, wording_text, signed_by)
  VALUES (p_session_id, peo.id, peo.name, p_authorized, p_version, clean_text, auth.uid())
  RETURNING * INTO rec;
  -- Withdrawing a PEO already sent to closes its quote request and marks the submission Needs advisor action, naming the PEO, so an advisor tells it.
  -- The product sends the PEO nothing. Lock order as advisor_record_quote_send's: the pipeline row first, then the quote request.
  IF NOT p_authorized THEN
    SELECT * INTO w FROM public.submission_workflow WHERE session_id = p_session_id FOR UPDATE;
    -- A won quote is kept: the win names it.
    IF w.won_quote_request_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.id = w.won_quote_request_id AND lower(q.peo_name) = lower(peo.name)) THEN
      note := format('The employer withdrew %s, whose quote they took. The quote is kept; talk to the employer.', peo.name);
    ELSE
      UPDATE public.quote_requests q SET status = 'closed'
      WHERE q.session_id = p_session_id AND lower(q.peo_name) = lower(peo.name) AND q.status <> 'closed';
      IF FOUND THEN
        note := format('The employer withdrew %s. Tell %s not to use the packet; nothing was sent to it.', peo.name, peo.name);
      END IF;
    END IF;
    IF note IS NOT NULL AND w.session_id IS NOT NULL THEN
      UPDATE public.submission_workflow
      SET needs_action = true, needs_action_note = note, needs_action_at = now(), needs_action_by = auth.uid(), needs_action_by_email = auth.jwt() ->> 'email'
      WHERE session_id = p_session_id;
      INSERT INTO public.submission_status_history (session_id, from_status, to_status, note, changed_by, changed_by_email)
      VALUES (p_session_id, w.status, w.status, 'Marked as needing advisor action: ' || note, auth.uid(), auth.jwt() ->> 'email');
    END IF;
  END IF;
  RETURN to_jsonb(rec);
END;
$$;

-- And no path records one for a market of another line (D-29, D-2004): assert_peo_authorized reads the newest record as leave to send, so the record itself
-- must be right whoever wrote it. Both lines it compares never change (above), so what holds when the record is written holds for good.
CREATE FUNCTION public.authorization_is_of_intake_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT p.line FROM public.peos p WHERE p.id = NEW.peo_id) IS DISTINCT FROM (SELECT s.line FROM public.chamber_sessions s WHERE s.id = NEW.session_id) THEN
    RAISE EXCEPTION 'An employer authorizes only markets of their intake''s own line' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.authorization_is_of_intake_line() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER peo_authorizations_line BEFORE INSERT ON public.peo_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.authorization_is_of_intake_line();

-- ---------- 8. A quote request's market is of its intake's line ----------
-- Every send asks for the employer's authorization first, and an authorization is of the intake's line (above), so no function here can make the wrong one.
-- This holds whatever writes a quote request without asking (D-29, D-2005). A name no market holds has no line to disagree with, as before.
CREATE FUNCTION public.quote_request_market_is_of_intake_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.peos p
             WHERE lower(p.name) = lower(NEW.peo_name) AND p.line IS DISTINCT FROM (SELECT s.line FROM public.chamber_sessions s WHERE s.id = NEW.session_id)) THEN
    RAISE EXCEPTION '% does not quote what this search is for', NEW.peo_name USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.quote_request_market_is_of_intake_line() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER quote_requests_market_line BEFORE INSERT OR UPDATE OF peo_name, session_id ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.quote_request_market_is_of_intake_line();

-- ---------- 9. What a workers' comp quote holds ----------
-- A carrier's quote is a premium, not a fee on payroll: the estimated annual premium, the experience modification the carrier applied and the minimum
-- premium, beside the rates by state and class code a PEO's quote already holds (the same list, the same rule) and any fees it names. As every cost area
-- (D-721), one left out is NULL, never 0.
ALTER TABLE public.quotes ADD COLUMN annual_premium numeric;
ALTER TABLE public.quotes ADD COLUMN experience_mod numeric;
ALTER TABLE public.quotes ADD COLUMN minimum_premium numeric;

-- Their limits are the intake's own for the same kinds of figure (QUOTE_PREMIUM_MAX and QUOTE_EXPERIENCE_MOD_MAX in src/data/lines.ts; schemaSync compares
-- them): dollars from 0 to 100000000, an experience modification from 0 to 10. On the table, so no writer stores a figure past them (D-29).
ALTER TABLE public.quotes ADD CONSTRAINT quotes_workers_comp_figures_check CHECK (
  (annual_premium IS NULL OR (annual_premium >= 0 AND annual_premium <=
    -- sync:begin quote_premium_max
    100000000
    -- sync:end quote_premium_max
  ))
  AND (minimum_premium IS NULL OR (minimum_premium >= 0 AND minimum_premium <= 100000000))
  AND (experience_mod IS NULL OR (experience_mod >= 0 AND experience_mod <=
    -- sync:begin quote_experience_mod_max
    10
    -- sync:end quote_experience_mod_max
  )));

-- What a quote of a line holds: its cost areas, in the order its comparison shows them. The one list of it. The browser holds the same (QUOTE_LINE_AREAS in
-- src/data/lines.ts; schemaSync compares them). The workers' comp rates and the fees are part of both.
CREATE FUNCTION public.quote_line_areas(p_line text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE p_line
    WHEN 'peo' THEN ARRAY[
      -- sync:begin quote_line_areas_peo
      'admin_fee', 'one_off_fees', 'workers_comp', 'unemployment', 'medical'
      -- sync:end quote_line_areas_peo
    ]
    WHEN 'workers_comp' THEN ARRAY[
      -- sync:begin quote_line_areas_workers_comp
      'annual_premium', 'workers_comp', 'experience_mod', 'minimum_premium', 'one_off_fees'
      -- sync:end quote_line_areas_workers_comp
    ]
  END
$$;
REVOKE ALL ON FUNCTION public.quote_line_areas(text) FROM PUBLIC, anon, authenticated, service_role;

-- The cost areas a quote holds that are no part of its line's quote: every area p_quote has a value for (a key whose value is not null) that
-- quote_line_areas(p_line) does not name. Empty when the quote is one its line's quotes can be compared with.
CREATE FUNCTION public.quote_areas_outside_line(p_line text, p_quote jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(array_agg(every.area ORDER BY every.area), '{}')
  FROM (SELECT DISTINCT unnest(public.quote_line_areas(l)) AS area FROM unnest(public.quote_lines()) l) every
  WHERE COALESCE(jsonb_typeof(p_quote -> every.area), 'null') <> 'null'
    AND NOT (every.area = ANY (public.quote_line_areas(p_line)))
$$;
REVOKE ALL ON FUNCTION public.quote_areas_outside_line(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- record_quote restated from its only definition (20261124140000_quote_offer.sql) with every line kept, and three more arguments, last and with defaults:
-- the workers' comp figures. A caller that names none records a quote as before. The old twelve-argument function is dropped, since two would make a call
-- that names its arguments ambiguous; the grants are restated.
DROP FUNCTION public.record_quote(bigint, text, date, date, date, numeric, text, jsonb, jsonb, jsonb, jsonb, text);

CREATE FUNCTION public.record_quote(
  p_quote_request_id bigint, p_kind text, p_received_on date DEFAULT NULL, p_expires_on date DEFAULT NULL, p_start_on date DEFAULT NULL,
  p_admin_fee numeric DEFAULT NULL, p_admin_fee_basis text DEFAULT NULL,
  p_one_off_fees jsonb DEFAULT NULL, p_workers_comp jsonb DEFAULT NULL,
  p_unemployment jsonb DEFAULT NULL,
  p_medical jsonb DEFAULT NULL, p_note text DEFAULT NULL,
  p_annual_premium numeric DEFAULT NULL, p_experience_mod numeric DEFAULT NULL, p_minimum_premium numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  q public.quotes;
  v_line text;
BEGIN
  -- Closing firms are read-only and so is a support session (ADR 0023, 0024), and only an advisor of the quote request's own firm records a quote; all of it before anything
  -- about the quote is said, so a stranger learns nothing from a refusal. Not found and another firm's are the same answer.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  IF NOT EXISTS (SELECT 1 FROM public.quote_requests r WHERE r.id = p_quote_request_id AND public.quote_request_in_my_firm(r.id)) THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('estimate', 'firm_offer') THEN
    RAISE EXCEPTION 'A quote is marked an estimate or a firm offer' USING ERRCODE = '22023';
  END IF;
  -- What a quote holds follows its line (ADR 0029): an area that is no part of the line's quote is refused, in the line's own words, before anything about
  -- the area itself is said. A basis given alone counts as the fee it is the basis of.
  v_line := (SELECT s.line FROM public.quote_requests r JOIN public.chamber_sessions s ON s.id = r.session_id WHERE r.id = p_quote_request_id);
  IF cardinality(public.quote_areas_outside_line(v_line, jsonb_build_object(
       'admin_fee', COALESCE(p_admin_fee::text, p_admin_fee_basis), 'one_off_fees', p_one_off_fees, 'workers_comp', p_workers_comp, 'unemployment', p_unemployment,
       'medical', p_medical, 'annual_premium', p_annual_premium, 'experience_mod', p_experience_mod, 'minimum_premium', p_minimum_premium))) > 0 THEN
    RAISE EXCEPTION '%', CASE v_line
      WHEN 'workers_comp' THEN 'A workers'' comp quote holds a premium, rates, an experience modification, a minimum premium and fees. Leave out the administrative fee, unemployment tax and medical: they are a PEO''s.'
      ELSE 'A PEO''s quote holds an administrative fee, one-off fees, workers'' comp rates, unemployment tax and medical. Leave out the annual premium, the experience modification and the minimum premium: they are a workers'' comp quote''s.'
    END USING ERRCODE = '22023';
  END IF;
  IF (p_admin_fee IS NULL) <> (p_admin_fee_basis IS NULL) OR p_admin_fee_basis NOT IN ('per_employee_per_month', 'percent_of_payroll') THEN
    RAISE EXCEPTION 'An administrative fee comes with its basis: per employee per month, or percent of payroll' USING ERRCODE = '22023';
  END IF;
  IF p_admin_fee < 0 OR p_admin_fee > 100000 OR (p_admin_fee_basis = 'percent_of_payroll' AND p_admin_fee > 100) THEN
    RAISE EXCEPTION 'The administrative fee is 0 to 100000 per employee per month, or 0 to 100 percent of payroll' USING ERRCODE = '22023';
  END IF;
  -- The workers' comp figures, by the intake's own limits for the same kinds of figure (a premium in dollars, an experience modification).
  IF p_annual_premium < 0 OR p_annual_premium > 100000000 OR p_minimum_premium < 0 OR p_minimum_premium > 100000000 THEN
    RAISE EXCEPTION 'The annual premium and the minimum premium are each 0 to 100000000 dollars; leave one out when the quote has none' USING ERRCODE = '22023';
  END IF;
  IF p_experience_mod < 0 OR p_experience_mod > 10 THEN
    RAISE EXCEPTION 'The experience modification is a factor from 0 to 10, such as 0.92; leave it out when the quote has none' USING ERRCODE = '22023';
  END IF;
  IF NOT public.quote_one_off_fees_valid(p_one_off_fees) THEN
    RAISE EXCEPTION 'One-off fees are a list of a name and an amount from 0 to 10000000, each name once; leave them out when the quote has none' USING ERRCODE = '22023';
  END IF;
  IF NOT public.quote_workers_comp_valid(p_workers_comp) THEN
    RAISE EXCEPTION 'Workers'' comp rates are a list of a state, a class code and a rate per 100 dollars of payroll from 0 to 1000, each state and class code once; leave them out when the quote has none' USING ERRCODE = '22023';
  END IF;
  IF NOT public.quote_unemployment_valid(p_unemployment) THEN
    RAISE EXCEPTION 'Unemployment tax is a list of a state and how it is charged, the employer''s own rate or the PEO''s rate with its percent of taxable wages from 0 to 100, each state once; leave it out when the quote has none' USING ERRCODE = '22023';
  END IF;
  IF NOT public.quote_medical_valid(p_medical) THEN
    RAISE EXCEPTION 'Medical rates are a list of a plan, a tier (employee_only, employee_spouse, employee_children or family) and a monthly rate per employee from 0 to 100000, each plan and tier once; leave them out when the quote has none' USING ERRCODE = '22023';
  END IF;
  PERFORM public.advisor_update_quote_request(p_quote_request_id, 'quoted', p_received_on, p_expires_on, p_start_on,
    CASE WHEN p_admin_fee_basis = 'per_employee_per_month' THEN p_admin_fee END, p_note);
  INSERT INTO public.quotes (quote_request_id, session_id, kind, received_on, expires_on, proposed_start_on, admin_fee, admin_fee_basis, one_off_fees, workers_comp, unemployment, medical, note,
                             annual_premium, experience_mod, minimum_premium)
  SELECT r.id, r.session_id, p_kind, p_received_on, p_expires_on, p_start_on, p_admin_fee, p_admin_fee_basis, p_one_off_fees, p_workers_comp, p_unemployment, p_medical, p_note,
         p_annual_premium, p_experience_mod, p_minimum_premium
  FROM public.quote_requests r WHERE r.id = p_quote_request_id
  RETURNING * INTO q;
  RETURN to_jsonb(q);
END;
$$;

REVOKE ALL ON FUNCTION public.record_quote(bigint, text, date, date, date, numeric, text, jsonb, jsonb, jsonb, jsonb, text, numeric, numeric, numeric) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_quote(bigint, text, date, date, date, numeric, text, jsonb, jsonb, jsonb, jsonb, text, numeric, numeric, numeric) TO authenticated;

-- And no path stores a quote that holds another line's areas (D-29, D-2007): record_quote says it in words; this holds every other writer. The intake's
-- line never changes, so a quote that passes when it is written is right for good.
CREATE FUNCTION public.quote_is_of_intake_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  outside text[];
BEGIN
  outside := public.quote_areas_outside_line((SELECT s.line FROM public.chamber_sessions s WHERE s.id = NEW.session_id), to_jsonb(NEW));
  IF cardinality(outside) > 0 THEN
    RAISE EXCEPTION 'A quote holds only what its line''s quotes hold; this one also holds: %', array_to_string(outside, ', ') USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.quote_is_of_intake_line() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER quotes_line BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quote_is_of_intake_line();

-- ---------- 10. The comparison follows the line ----------
-- opportunity_quote_comparison restated from its only definition (20261125110000_quote_comparison.sql) with every line kept: it says the opportunity's line,
-- and each quote carries the workers' comp figures beside the rest (a figure left out stays JSON null, D-721). Same arguments, so the grants stand.
CREATE OR REPLACE FUNCTION public.opportunity_quote_comparison(p_firm_id uuid, p_opportunity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o public.opportunities;
  a public.accounts;
BEGIN
  IF p_firm_id IS NOT NULL AND p_opportunity_id IS NOT NULL THEN
    SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = p_firm_id;
    SELECT * INTO a FROM public.accounts x WHERE x.id = o.account_id AND x.firm_id = o.firm_id;
  END IF;
  IF o.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object(
    -- What is compared (ADR 0029): the screen draws the rows of this line's quotes, quote_line_areas(o.line), and no others.
    'line', o.line,
    -- Whether a note may be added: the account is not archived (D-432), as the opportunity's page has it.
    'can_add', a.archived_at IS NULL,
    'columns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('quote_request_id', q.id, 'peo_name', q.peo_name, 'status', q.status,
                                          'quote', CASE WHEN cq.id IS NULL THEN NULL ELSE jsonb_build_object(
                                            'id', cq.id, 'kind', cq.kind, 'received_on', cq.received_on, 'expires_on', cq.expires_on, 'proposed_start_on', cq.proposed_start_on,
                                            'admin_fee', cq.admin_fee, 'admin_fee_basis', cq.admin_fee_basis,
                                            -- A cost area left out is NULL and stays JSON null here, never [] or 0 (D-721); the screen reads "Not quoted" from it.
                                            'one_off_fees', cq.one_off_fees, 'workers_comp', cq.workers_comp, 'unemployment', cq.unemployment, 'medical', cq.medical,
                                            'annual_premium', cq.annual_premium, 'experience_mod', cq.experience_mod, 'minimum_premium', cq.minimum_premium,
                                            'note', cq.note) END)
                       ORDER BY lower(q.peo_name), q.id)
      FROM public.quote_requests q
      -- The current quote is the newest row of the quote request (D-720).
      LEFT JOIN LATERAL (SELECT x.* FROM public.quotes x WHERE x.quote_request_id = q.id ORDER BY x.id DESC LIMIT 1) cq ON true
      WHERE q.session_id = o.intake_id), '[]'::jsonb),
    -- The notes on it, newest first.
    'notes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', n.id, 'quote_request_id', n.quote_request_id, 'area', n.area, 'visibility', n.visibility, 'body', n.body,
                                          'author', public.crm_person_name(n.author_id), 'created_at', n.created_at) ORDER BY n.id DESC)
      FROM public.quote_comparison_notes n WHERE n.opportunity_id = o.id), '[]'::jsonb));
END;
$$;

-- add_comparison_note restated from its only definition (20261125110000_quote_comparison.sql) with every line kept but one moved: the area is checked
-- against the opportunity's own line, so after the opportunity is found (a stranger is told not found before anything about an area). Same arguments, so
-- the grants stand.
CREATE OR REPLACE FUNCTION public.add_comparison_note(
  p_firm_id uuid, p_opportunity_id uuid, p_quote_request_id bigint, p_area text, p_visibility text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  o public.opportunities;
  a public.accounts;
  n public.quote_comparison_notes;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_visibility IS NULL OR p_visibility NOT IN ('internal', 'client') THEN
    RAISE EXCEPTION 'A note is marked internal or for the client' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_body), '') IS NULL OR char_length(btrim(p_body)) > 2000 THEN
    RAISE EXCEPTION 'A note has words, at most 2000 characters' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO o FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = firm;
  SELECT * INTO a FROM public.accounts x WHERE x.id = o.account_id AND x.firm_id = o.firm_id;
  IF o.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing on its opportunities can be changed.' USING ERRCODE = '55000';
  END IF;
  -- The area is one of the comparison's own line (ADR 0029), asked once the opportunity is known: quote_line_areas is the one list of them.
  IF p_area IS NOT NULL AND NOT (p_area = ANY (public.quote_line_areas(o.line))) THEN
    RAISE EXCEPTION '%', CASE o.line
      WHEN 'workers_comp' THEN 'A note is about the annual premium, workers'' comp rates, the experience modification, the minimum premium or fees'
      ELSE 'A note is about the administrative fee, one-off fees, workers'' comp, unemployment tax or medical'
    END USING ERRCODE = '22023';
  END IF;
  IF p_quote_request_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.quote_requests q WHERE q.id = p_quote_request_id AND q.session_id = o.intake_id) THEN
    RAISE EXCEPTION 'That PEO is not on this opportunity' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.quote_comparison_notes (firm_id, opportunity_id, quote_request_id, area, visibility, body, author_id)
  VALUES (firm, o.id, p_quote_request_id, p_area, p_visibility, btrim(p_body), auth.uid())
  RETURNING * INTO n;
  RETURN jsonb_build_object('id', n.id, 'body', n.body);
END;
$$;

-- ---------- 11. The line every message to a carrier carries (D-12) ----------
-- DRAFT, not yet reviewed by counsel, as the PEO's is (public.peo_send_notice, 20261122140000). The words are src/data/legalWording.ts's CARRIER_SEND_NOTICE,
-- the one legal-wording module; src/data/schemaSync.test.ts keeps this copy equal to it. A message to a carrier never says it is for a PEO.
CREATE FUNCTION public.carrier_send_notice()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    -- sync:begin carrier_send_notice
    'Draft wording: sent with the authorization of the employer, for this carrier alone to consider them for a quote. Please do not pass the link on.'
    -- sync:end carrier_send_notice
$$;
REVOKE ALL ON FUNCTION public.carrier_send_notice() FROM PUBLIC, anon, authenticated, service_role;

-- attach_peo_link restated from its only definition (20261122140000_peo_send.sql) with every line kept: the fixed block under the advisor's note ends with
-- the notice of the intake's own line. Same arguments, so the grants stand.
CREATE OR REPLACE FUNCTION public.attach_peo_link(p_message_id bigint, p_link_id bigint, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  m public.quote_request_messages;
  link public.bundle_links;
  file_id text;
  firm_name text;
  person text;
  phone text;
  items text;
  block text;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zm.firm_id FROM public.quote_request_messages zm WHERE zm.id = p_message_id));
  PERFORM public.require_advisor();
  -- A message of the caller's own firm; another firm's reads as none. Only the advisor who wrote it sends it: it goes from their mailbox.
  SELECT * INTO m FROM public.quote_request_messages x
  WHERE x.id = p_message_id AND x.direction = 'sent' AND public.intake_in_my_firm(x.session_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404';
  END IF;
  IF m.sender_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the advisor who wrote this message can send it.' USING ERRCODE = 'PT409';
  END IF;
  IF m.bundle_link_id IS NOT NULL OR m.status <> 'queued' THEN
    RAISE EXCEPTION 'This message already has its link.' USING ERRCODE = 'PT409';
  END IF;
  -- The live link of the message's own quote request, opened by this token: what the PEO will be sent is what opens.
  SELECT * INTO link FROM public.bundle_links b
  WHERE b.id = p_link_id AND b.quote_request_id = m.quote_request_id AND b.revoked_at IS NULL AND b.expires_at > now()
    AND b.token_hash = encode(extensions.digest(COALESCE(p_token, ''), 'sha256'), 'hex');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bundle link isn''t this message''s.' USING ERRCODE = '22023';
  END IF;
  SELECT c.file_id INTO file_id FROM public.chamber_certifications c WHERE c.session_id = link.session_id AND c.version = link.version;
  SELECT f.name INTO firm_name FROM public.firms f WHERE f.id = link.firm_id;
  SELECT COALESCE(NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''), NULLIF(btrim(u.raw_user_meta_data ->> 'name'), ''), u.email::text)
  INTO person FROM auth.users u WHERE u.id = m.sender_id;
  SELECT NULLIF(btrim(p.phone), '') INTO phone FROM public.profiles p WHERE p.user_id = m.sender_id;
  SELECT string_agg(x, '; ' ORDER BY n) INTO items FROM jsonb_array_elements_text(link.open_items) WITH ORDINALITY AS t (x, n);
  -- The fixed block under the note, which the advisor can't edit: the link, File ID and version, the open items, the advisor's name, firm and phone,
  -- and the line counsel's wording will replace (D-12).
  block := E'-- \n'
    || 'The bundle: ' || public.peo_link_marker() || E'\n'
    || 'The link stops working on ' || to_char(link.expires_at AT TIME ZONE 'UTC', 'FMMonth FMDD, YYYY') || E'.\n'
    || 'File ID ' || COALESCE(file_id, 'not assigned') || ', version ' || link.version || E'\n'
    || 'Open items: ' || COALESCE(items, 'none') || E'\n'
    || concat_ws(', ', person, firm_name, phone) || E'\n'
    -- The line names who the message is for (ADR 0029): a carrier on a workers' comp search, a PEO on a PEO search.
    || CASE (SELECT s.line FROM public.chamber_sessions s WHERE s.id = link.session_id)
         WHEN 'workers_comp' THEN public.carrier_send_notice()
         ELSE public.peo_send_notice()
       END;
  UPDATE public.quote_request_messages SET body_text = m.body_text || E'\n\n' || block, bundle_link_id = link.id WHERE id = m.id;
  -- The token goes on the outbox event alone, which no API role reads, for the send-mail function to put in the email.
  UPDATE public.outbox_events e SET payload = e.payload || jsonb_build_object('link_token', p_token)
  WHERE e.kind = 'peo_message' AND (e.payload ->> 'message_id')::bigint = m.id;
  RETURN jsonb_build_object('message_id', m.id);
END;
$$;
