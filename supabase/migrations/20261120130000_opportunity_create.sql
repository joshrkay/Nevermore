-- New opportunity on an account (story CRM-A2.3, Epic 4 build order row 6, screen 25; docs/BROKER_CRM_BUILD.md D-29, D-188, D-209, D-214, D-222, D-409,
-- D-436 to D-442; GLOSSARY.md "The broker's CRM"; ADR 0023, ADR 0024; 20261119100000_crm_records.sql, 20261119170000_add_contact.sql,
-- 20261120090000_opportunity_stage.sql, 20261120120000_opportunity_page.sql). The form itself is on the account's page.
--
-- What this is. The one function that makes an opportunity by hand and the one read the form needs:
--
--   opportunity_create(account, fields)    Makes an opportunity on an account of the firm the call acts for and answers it (D-442). It has no intake and is in
--                                          the stage Qualifying, which is worked out and never stored (D-408, D-409): the stage is not a parameter. Open to
--                                          anyone who may see the account, as adding a contact is (D-437, D-209); refused on an archived account (D-222), a
--                                          closing firm (ADR 0023) and a Nevermore support session (ADR 0024). An account holds any number of opportunities and
--                                          several may be open at once: nothing here refuses another (D-440).
--   opportunity_create_context(firm, acct) What the form needs in one read (D-436, D-438): the account's name, whether it is archived and its employees (offered
--                                          as the opportunity's), its contacts (the main contact first, offered as the opportunity's), the firm's referral partners
--                                          and the people who may own it. Answered to anyone who may see the account, like add_contact_context.
--
-- Refusal order of opportunity_create, as add_contact's and update_opportunity's: not a member of the firm (42501), a closing firm or Nevermore support (PT423),
-- an account the caller may not see or that is not there (PT404, one answer for both), an archived account (55000), what is wrong with the fields in words
-- (22023), a main contact that is not the account's (22023), an owner who is not a current member (22023), an owner the caller could not give an opportunity to
-- (42501: the level rule, D-209, as update_opportunity has it), an owner who could not see the account (22023, as update_opportunity has it: visibility follows
-- the account, D-422).
--
-- The source (D-439). One of a fixed list kept in one module on the client (src/data/opportunityFields.ts) and checked here; the two are held together by
-- `-- sync:begin opportunity_sources` below and src/data/schemaSync.test.ts. A blank source is no source. "Referral" may name which of the firm's referral
-- partners sent it, kept in the new column referral_partner_code; a partner is named for no other source, and it must be one of the firm's own.
--
-- DECISION, the name of the column. D-439 calls it `referral_partner_id`, but a referral partner has no id: its key is the pair (firm, code), the code never
-- changes once given (20261106100000, 20261116200000), and every place that names a partner (the intake's referral code, the history) names it by that code. So
-- the column is `referral_partner_code`, a foreign key on the pair, which also keeps a partner of another firm out of an opportunity. The partner's own row is
-- left as it is (no id added to a table other stories read and export).
--
-- Kept in step on a save (D-439). update_opportunity (20261120120000) is restated below, with two changes and nothing else: a source that differs from the
-- opportunity's own must be on the list (22023 "Choose a source from the list."; a source left as it was is accepted even when it is not, so an opportunity
-- with an older free-text source can still be saved), and a save that moves the source away from Referral clears referral_partner_code in the same update (the
-- CHECK above would refuse it otherwise). crm_opportunity_fields is restated with `referral_partner: {code, name} | null`, for the page (CRM-O1.1b, not built
-- here) to show "Referral · <partner>".
--
-- Not here: "Save and start the quote" and "Start from last year's certified answers" (New quote, Epic 5: D-441, D-402), and a renewal's link to the opportunity
-- (CRM-A2.4b). The opportunity's page showing its partner is CRM-O1.1b's: this returns the data only.

-- ---------- 1. The referral partner an opportunity came from ----------
ALTER TABLE public.opportunities ADD COLUMN referral_partner_code text;

-- The partner is one of the opportunity's own firm's, by the pair. A partner's removal leaves the opportunity with none. (A firm's closing deletes its referral
-- partners, ord 60, before its opportunities, ord 61, in firm_closing_plan, so this SET NULL runs first there and the opportunities are deleted afterwards; harmless.)
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_referral_partner_fkey
  FOREIGN KEY (firm_id, referral_partner_code) REFERENCES public.referral_partners (firm_id, code) ON DELETE SET NULL (referral_partner_code);

-- A partner is named only on a Referral (D-439). The CHECK holds it for every writer: opportunity_create and update_opportunity say it in words first.
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_partner_needs_referral CHECK (referral_partner_code IS NULL OR COALESCE(source = 'Referral', false));

CREATE INDEX opportunities_referral_partner_idx ON public.opportunities (firm_id, referral_partner_code) WHERE referral_partner_code IS NOT NULL;

-- The partner is one of the opportunity's own tracked fields (20261120090000's list, with it): its history and version follow it.
SELECT public.record_track('public.opportunities', 'opportunities', ARRAY['id'], ARRAY[
  'account_id', 'owner_id', 'name', 'target_start', 'employees', 'main_contact_id', 'expected_close', 'value', 'source', 'next_step',
  'lost_at', 'lost_by', 'referral_partner_code']);

-- ---------- 2. The source, from the fixed list ----------
-- Whether a trimmed source is one of the list (D-439). NULL is no source. Plain: the same words, in the same order, as src/data/opportunityFields.ts.
CREATE FUNCTION public.opportunity_source_is_known(p_source text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_source IS NULL OR p_source IN (
    -- sync:begin opportunity_sources
    'Referral', 'Renewal', 'Existing client', 'Inbound', 'Outbound', 'Event', 'Other'
    -- sync:end opportunity_sources
  )
$$;

REVOKE ALL ON FUNCTION public.opportunity_source_is_known(text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. Whom an opportunity of an account may be given to ----------
-- The firm's current people the caller may give an opportunity of this account to: those update_opportunity would accept (the level rule on the new owner,
-- can_change_firm_record, and who sees the account, crm_person_sees_record). The same two questions opportunity_create asks, so the form never offers what the
-- call would refuse. Internal.
CREATE FUNCTION public.opportunity_owner_choices(p_firm_id uuid, p_account_owner uuid)
RETURNS TABLE (user_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.user_id, public.person_display_name(u.raw_user_meta_data, u.email::text)
  FROM public.firm_memberships m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.firm_id = p_firm_id AND public.membership_is_current(m.valid_from, m.valid_until)
    AND public.can_change_firm_record(p_firm_id, m.user_id) AND public.crm_person_sees_record(p_firm_id, p_account_owner, m.user_id)
  ORDER BY lower(public.person_display_name(u.raw_user_meta_data, u.email::text) COLLATE "und-x-icu"), m.user_id
$$;

REVOKE ALL ON FUNCTION public.opportunity_owner_choices(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. What the form needs ----------
-- Answers {account: {id, name, archived, employees}, main_contact: {id, name} | null, contacts: [{id, name, title, is_main}] (the main contact first, then by
-- name), partners: [{code, name}] (the firm's own, by name), owners: [{id, name}] (see opportunity_owner_choices)}. An archived account is answered, so the
-- form can say so. Refused: not a member of the firm (42501), an account the caller may not see or that is not there (PT404).
CREATE FUNCTION public.opportunity_create_context(p_firm_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  a public.accounts;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object(
    'account', jsonb_build_object('id', a.id, 'name', a.name, 'archived', a.archived_at IS NOT NULL, 'employees', a.employees),
    'main_contact', (SELECT jsonb_build_object('id', c.id, 'name', public.crm_contact_name(c)) FROM public.contacts c WHERE c.account_id = a.id AND c.is_main),
    'contacts', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', public.crm_contact_name(c), 'title', c.title, 'is_main', c.is_main)
                                           ORDER BY c.is_main DESC, lower(public.crm_contact_name(c) COLLATE "und-x-icu"), c.id)
                          FROM public.contacts c WHERE c.account_id = a.id), '[]'::jsonb),
    'partners', COALESCE((SELECT jsonb_agg(jsonb_build_object('code', p.code, 'name', p.name) ORDER BY lower(p.name COLLATE "und-x-icu"), p.code)
                          FROM public.referral_partners p WHERE p.firm_id = firm), '[]'::jsonb),
    'owners', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', o.user_id, 'name', o.name) ORDER BY lower(o.name COLLATE "und-x-icu"), o.user_id)
                        FROM public.opportunity_owner_choices(firm, a.owner_id) o), '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_create_context(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_create_context(uuid, uuid) TO authenticated;

-- ---------- 5. The making ----------
-- Answers {record: <the opportunity's own fields with its stage and referral_partner_code, version 1>}. The opportunity is the maker's unless they choose another
-- owner (D-214, D-438), a current member of the firm held to the end of the transaction as add_contact holds one, and, once held, checked against the clock as
-- update_opportunity does (a removal that commits while this waits is seen). Every field is sent; a blank is no value.
-- Locks, in the order every write on an account's records takes them: the ACCOUNT first, FOR SHARE (it conflicts with the archive's, the owner change's and the
-- delete's row locks, so an opportunity is never made on an account whose archiving is on its way, and an archive that commits first is seen), then the new
-- row. A contact deleted between the look and the write is told as a contact that is not the account's.
CREATE FUNCTION public.opportunity_create(
  p_account_id uuid, p_name text, p_target_start date, p_employees integer, p_main_contact_id uuid, p_expected_close date, p_value numeric, p_source text,
  p_referral_partner_code text, p_next_step text, p_owner_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL)
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
  problem text;
  a public.accounts;
  owner uuid;
  owner_until timestamptz;
  made public.opportunities;
  violated text;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR SHARE;
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
  IF problem IS NULL AND partner_in IS NOT NULL THEN
    IF source_in IS DISTINCT FROM 'Referral' THEN
      problem := 'A referral partner goes only with the source Referral.';
    ELSIF NOT EXISTS (SELECT 1 FROM public.referral_partners r WHERE r.firm_id = firm AND r.code = partner_in) THEN
      problem := 'Choose one of the firm''s referral partners.';
    END IF;
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
  BEGIN
    INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, target_start, employees, main_contact_id, expected_close, value, source, referral_partner_code, next_step)
    VALUES (firm, a.id, owner, name_in, p_target_start, p_employees, p_main_contact_id, p_expected_close, p_value, source_in, partner_in, next_in)
    RETURNING * INTO made;
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
    IF violated = 'opportunities_referral_partner_fkey' THEN
      RAISE EXCEPTION 'Choose one of the firm''s referral partners.' USING ERRCODE = '22023';
    END IF;
    -- The contact was deleted between the look above and the write.
    RAISE EXCEPTION 'Choose a contact of this account.' USING ERRCODE = '22023';
  END;
  RETURN jsonb_build_object('record',
    public.crm_opportunity_fields(made) || jsonb_build_object('stage', public.opportunity_stage(made.id), 'referral_partner_code', made.referral_partner_code));
END;
$$;

REVOKE ALL ON FUNCTION public.opportunity_create(uuid, text, date, integer, uuid, date, numeric, text, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_create(uuid, text, date, integer, uuid, date, numeric, text, text, text, uuid, uuid) TO authenticated;

-- ---------- 6. What the page and a save read of an opportunity ----------
-- crm_opportunity_fields (20261120120000), restated with the referral partner it came from: `referral_partner: {code, name} | null` (D-439, "Referral ·
-- <partner>"). Everything else is as it was. Internal; opportunity_page and update_opportunity's record call it.
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
    'next_step', o.next_step, 'submission_id', o.intake_id, 'created_at', o.created_at, 'updated_at', o.updated_at)
$$;

-- ---------- 7. The save, with the source checked ----------
-- Saves the opportunity's own fields (every one is sent; a blank one is cleared) from the version the person started from: name, target start, employees, main
-- contact, expected close, value, source, next step and owner. The stage and the account are never edited here (D-428): the stage moves only by the intake, a
-- send, a quote, and won or lost (D-408, D-411), and an opportunity changes account only by a move (CRM-A2.2). Answers
--   {conflict: false, record: <the opportunity's own fields, with its new version>}  or, when someone saved first and nothing was saved,
--   {conflict: true, currentVersion, current: {the fields a person edits}, changed: [{field, value, who, at}]}.
-- p_owner_id NULL leaves the owner as it is (so an opportunity whose owner has left, or who has none, can be saved without choosing one); the owner is never
-- cleared here (owners assign unowned records, as change_account_owner has it), and a new one must be a current member of the firm, held to the end of the
-- transaction as change_account_owner holds it (and, unlike it, checked again against the clock once the row is held: a removal that commits while this waits is seen, see below), and who the caller could change a record of (update_contact's rule: an agent gives it to no one else, a lead to
-- themselves and their teams, an owner of the firm to anyone) and who sees the account (visibility follows it, D-422). The main contact must be a contact of the opportunity's own account (22023 otherwise).
-- Refused, in this order and before the version is looked at: not a member of the firm (42501), a closing firm or Nevermore support (PT423), what is wrong
-- with the fields (22023), no version (22023), an opportunity the caller may not see or that is not there (PT404, one answer for both: whoever sees its account
-- sees it, D-422), an archived account (55000, D-432), an opportunity the level rule does not give the caller (42501: D-209 on the opportunity's own owner; with
-- no owner, a firm owner only), an owner who is not a current member (22023), an owner the caller could not give it to (42501) or who could not see the account (22023), a version the
-- opportunity never had (22023); then, for a save from the current
-- version, a main contact that is not the account's (22023). A stale save is answered with the conflict before its main contact is looked at.
-- A new owner is judged twice: as a current member by the transaction's start (membership_is_current), as change_account_owner does, and, once their membership is
-- held, against the clock (valid_until not yet reached): a removal commits while this save waits for the row, with a valid_until later than this transaction's
-- start, and only the second look sees it. change_account_owner (member_to_own, 20261119210000) has the first look only; it is a merged migration and is left as it is.
-- Locks, in the order every write on an account's records takes them (renewal_to_change, change_account_owner, archive and delete): the ACCOUNT first (FOR NO
-- KEY UPDATE, which conflicts with the archive's and the owner change's and the delete's), then the opportunity; the level rule is judged on the rows as held,
-- not on ones an owner change is about to replace, and an archive that commits first is seen. An opportunity that moved to another account while this waited
-- is refused (40001).
-- CRM-A2.3 (D-439): the source is checked as opportunity_create checks it. One that differs from the opportunity's own must be on the list
-- (opportunity_source_is_known), or the save is refused, 22023 "Choose a source from the list."; one left as it was is accepted though it is not on the list, so an
-- opportunity with an older free-text source can still be saved. It is asked of a save that will be written, as the main contact is: a stale one is answered with
-- the conflict. A save that changes the source away from Referral clears referral_partner_code in the same update, so its history and version carry both fields
-- (referral_partner_code is tracked, above), and the table's CHECK (opportunities_partner_needs_referral) is never what refuses it. The partner itself is not set here.
CREATE OR REPLACE FUNCTION public.update_opportunity(
  p_opportunity_id uuid, p_name text, p_target_start date, p_employees integer, p_main_contact_id uuid, p_expected_close date, p_value numeric,
  p_source text, p_next_step text, p_owner_id uuid DEFAULT NULL, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  name_in text := NULLIF(btrim(p_name), '');
  source_in text := NULLIF(btrim(p_source), '');
  next_in text := NULLIF(btrim(p_next_step), '');
  problem text;
  acct uuid;
  a public.accounts;
  cur public.opportunities;
  changed public.opportunities;
  owner uuid;
  owner_until timestamptz;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  problem := public.opportunity_input_error(name_in, p_employees, p_value, source_in, next_in);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the opportunity it started from, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  -- The account first (an opportunity's account is found without a lock, then held), then the opportunity.
  SELECT x.account_id INTO acct FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = firm;
  IF acct IS NOT NULL THEN
    SELECT * INTO a FROM public.accounts y WHERE y.id = acct AND y.firm_id = firm FOR NO KEY UPDATE;
  END IF;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  -- The row is held from here, so that a save waiting behind another save of the same opportunity, from the same version, reads what that save left: its
  -- version, its values and its author.
  SELECT * INTO cur FROM public.opportunities x WHERE x.id = p_opportunity_id AND x.firm_id = firm FOR NO KEY UPDATE;
  IF cur.id IS NULL THEN
    RAISE EXCEPTION 'That opportunity isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF cur.account_id <> a.id THEN
    RAISE EXCEPTION 'That opportunity was moved while you were working. Try again.' USING ERRCODE = '40001';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing on its opportunities can be changed.' USING ERRCODE = '55000';
  END IF;
  IF NOT public.can_change_firm_record(cur.firm_id, cur.owner_id) THEN
    RAISE EXCEPTION '%', CASE WHEN cur.owner_id IS NULL
      THEN 'An opportunity with no owner can only be changed by an owner of the firm.'
      ELSE 'Only the opportunity''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
      USING ERRCODE = '42501';
  END IF;
  owner := COALESCE(p_owner_id, cur.owner_id);
  IF owner IS DISTINCT FROM cur.owner_id THEN
    SELECT m.valid_until INTO owner_until FROM public.firm_memberships m
    WHERE m.firm_id = cur.firm_id AND m.user_id = owner AND public.membership_is_current(m.valid_from, m.valid_until)
    FOR SHARE;
    -- membership_is_current reads now(), the start of this transaction, and the row may have been waited for: a removal that committed meanwhile sets
    -- valid_until to a time after that start, so the answer above is stale. Asked again of the row as it is now, against the clock.
    IF NOT FOUND OR (owner_until IS NOT NULL AND owner_until <= clock_timestamp()) THEN
      RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
    END IF;
    -- update_contact's rule: a new owner the caller could not themselves change a record of (an agent: only themselves; a lead: themselves and their teams).
    IF NOT public.can_change_firm_record(cur.firm_id, owner) THEN
      RAISE EXCEPTION 'You can give an opportunity only to yourself and, as a lead, to people on your teams.' USING ERRCODE = '42501';
    END IF;
    -- And one who can see the account: visibility follows it (D-422), so anyone else would be given an opportunity they could not open.
    IF NOT public.crm_person_sees_record(cur.firm_id, a.owner_id, owner) THEN
      RAISE EXCEPTION 'Choose someone who can see this account.' USING ERRCODE = '22023';
    END IF;
  END IF;
  -- A version the opportunity has never had is not "someone else changed it": nobody did.
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the opportunity that does not exist, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  -- The row is held, so its version is the current one: a save from an older version changes nothing and is answered below.
  IF p_version = cur.version THEN
    -- Asked only of a save that will be written: a stale one is answered with the conflict whatever contact it names (it may since have moved), as its
    -- other fields are not judged against the opportunity either.
    IF p_main_contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_main_contact_id AND c.account_id = a.id) THEN
      RAISE EXCEPTION 'Choose a contact of this account.' USING ERRCODE = '22023';
    END IF;
    IF source_in IS DISTINCT FROM cur.source AND NOT public.opportunity_source_is_known(source_in) THEN
      RAISE EXCEPTION 'Choose a source from the list.' USING ERRCODE = '22023';
    END IF;
    BEGIN
      UPDATE public.opportunities SET
        name = name_in, target_start = p_target_start, employees = p_employees, main_contact_id = p_main_contact_id, expected_close = p_expected_close,
        value = p_value, source = source_in, next_step = next_in, owner_id = owner,
        referral_partner_code = CASE WHEN source_in IS NOT DISTINCT FROM 'Referral' THEN referral_partner_code ELSE NULL END
      WHERE id = cur.id AND version = p_version
      RETURNING * INTO changed;
    EXCEPTION WHEN foreign_key_violation THEN
      -- The contact was deleted between the look above and the write.
      RAISE EXCEPTION 'Choose a contact of this account.' USING ERRCODE = '22023';
    END;
    RETURN jsonb_build_object('conflict', false, 'record', public.crm_opportunity_fields(changed));
  END IF;
  RETURN jsonb_build_object(
    'conflict', true,
    'currentVersion', cur.version,
    'current', jsonb_build_object(
      'name', cur.name, 'target_start', cur.target_start, 'employees', cur.employees, 'main_contact_id', cur.main_contact_id,
      'expected_close', cur.expected_close, 'value', cur.value, 'source', cur.source, 'next_step', cur.next_step, 'owner_id', cur.owner_id),
    'changed', public.record_version_changes(cur.firm_id, 'opportunities', cur.id::text, p_version, cur.version));
END;
$$;

REVOKE ALL ON FUNCTION public.update_opportunity(uuid, text, date, integer, uuid, date, numeric, text, text, uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_opportunity(uuid, text, date, integer, uuid, date, numeric, text, text, uuid, uuid, integer) TO authenticated;
