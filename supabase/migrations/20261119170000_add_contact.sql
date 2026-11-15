-- Adding a contact to an account, and moving one to another (story CRM-A2.2, screen 24; docs/BROKER_CRM_BUILD.md D-29, D-194, D-209, D-219, D-222, D-233;
-- ADR 0023, ADR 0024; 20261119100000_crm_records.sql, 20261119140000_account_page.sql, 20261119160000_account_archive_delete_owner.sql).
--
-- What this is. Two writes of the firm's records and the small reads their form needs. Both ask, in the order every write of the firm's records does,
-- firm_to_act_for (a member of the firm the call acts for: 42501) and assert_firm_writable (a closing firm and a Nevermore support session are refused,
-- PT423), and then an account the caller may see (the one refusal, PT404, for an account that is not there or not theirs).
--
--   add_contact          Adds a contact to an account. Open to anyone who may see the account (D-209), and refused in words when the account is archived
--                        (D-222, 55000). The fields are checked in words (contact_input_error): a last name, and an email, a phone or a mobile. The owner is the
--                        maker unless they choose another, a current member of the firm whom the level rule lets them choose (as create_account does), so nobody
--                        adds a contact they could not then change. "Main contact" makes this one the account's only main contact: the one that was is unticked in
--                        the same transaction and named in the answer, so the screen says so. The one-main rule itself is the partial unique index
--                        contacts_one_main (20261119100000, D-29); what this adds is that two people ticking the box at once are ordered by the account's row.
--   move_contact         Moves a contact to another account of the firm. DECISION (D-209: "that covers ... moving a contact"): moving is leaving one account and
--                        joining another, so it takes three yeses by the level rule (can_change_firm_record): the contact's own owner's level, the account it
--                        leaves, and the account it joins. Each account must also be seen. An archived account takes nothing new (D-222), so it cannot be joined
--                        (it can be left). The contact's calls, notes and tasks go with it in the same transaction (D-233: their keys to the contact are
--                        deferrable and activities_guard lets an activity's account change only by following its own contact). A contact that is the main
--                        contact of its old account arrives as nobody's main contact: it never displaces the one on the account it joins.
--                        DECISION (D-233, D-209): a call, note or task that names the moved contact AND an opportunity of the account it leaves cannot stay on both
--                        accounts. It follows the contact (a contact's history goes with it) and its link to the opportunity is dropped; the opportunity itself is
--                        not touched. A contact that is the main contact of an opportunity there stops being it. Nothing is done in silence: without p_confirm
--                        the move is refused with PT409 in words saying how many, and with it the answer counts what was done. An opportunity the caller may not
--                        change keeps its main contact, so the move is refused (42501) rather than changing another person's record.
--   contact_move_choices The accounts a contact may be moved to by the same rules (seen and changeable, not archived, not where it is), narrowed by what was typed.
--   add_contact_context  What the Add a contact form needs: the account's name, whether it is archived, and its main contact now (to say, before saving, that
--                        ticking "Main contact" makes this one the main contact instead).
--
-- The history of a contact is the table's own (record_track, 20261119100000): adding is a "created" entry, a move one entry for the change (the account, and
-- is_main when it was), under the person who made it.
--
-- Not here: a contact's own page and its other edits (CRM-C1.1), the warning for an email already on another contact (CRM-S4.2), merging two contacts
-- (CRM-S4.3b), and custom fields (CRM-X3.1). Moving a contact's emails waits for the emails (Epic 6): they will name the contact and follow it as the calls do.
-- The calls, notes and tasks table is built by 20261119180000, which loads after this file: nothing here names it before it runs (plpgsql resolves its names
-- when the function first runs).

-- ---------- 1. A phone's length ----------
-- The repository's phone rule (is_valid_phone, 20261027090000) allows 50 characters; the columns' own checks said 40. The rule itself is asked, in words, by
-- contact_input_error whenever a contact is added; it is not a trigger, because the chain at certification copies a prospect's phone into a contact and a
-- certification must never fail for the look of a phone (ADR 0025).
ALTER TABLE public.contacts DROP CONSTRAINT contacts_phone_check;
ALTER TABLE public.contacts DROP CONSTRAINT contacts_mobile_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_phone_check CHECK (char_length(phone) <= 50);
ALTER TABLE public.contacts ADD CONSTRAINT contacts_mobile_check CHECK (char_length(mobile) <= 50);

-- ---------- 2. The first thing wrong with a contact's fields, in words ----------
-- Inputs already trimmed, a blank as NULL. NULL when nothing is wrong. The same words as the form's rules (src/components/workspace/form/fieldRules.ts).
CREATE FUNCTION public.contact_input_error(p_first_name text, p_last_name text, p_title text, p_email text, p_phone text, p_mobile text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_last_name IS NULL THEN 'Enter the contact''s last name.'
    WHEN char_length(p_first_name) > 100 THEN 'Keep the first name to 100 characters.'
    WHEN char_length(p_last_name) > 100 THEN 'Keep the last name to 100 characters.'
    WHEN char_length(p_title) > 100 THEN 'Keep the title to 100 characters.'
    WHEN p_email IS NOT NULL AND (char_length(p_email) > 254 OR p_email !~ '^[^\s@<>,;"()\[\]\\]+@[^\s@<>,;"()\[\]\\]+\.[^\s@<>,;"()\[\]\\]+$')
      THEN 'Enter an email address like name@example.com.'
    WHEN p_phone IS NOT NULL AND NOT public.is_valid_phone(p_phone) THEN 'Enter a phone number like (503) 555-0142. An extension can follow, like x12.'
    WHEN p_mobile IS NOT NULL AND NOT public.is_valid_phone(p_mobile) THEN 'Enter a mobile number like (503) 555-0142. An extension can follow, like x12.'
    WHEN p_email IS NULL AND p_phone IS NULL AND p_mobile IS NULL THEN 'Enter an email or a phone number.'
  END
$$;

REVOKE ALL ON FUNCTION public.contact_input_error(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- A contact's own fields, as a save answers them. Internal.
CREATE FUNCTION public.crm_contact_fields(c public.contacts)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', c.id, 'version', c.version, 'account_id', c.account_id, 'first_name', c.first_name, 'last_name', c.last_name, 'title', c.title, 'email', c.email,
    'phone', c.phone, 'mobile', c.mobile, 'is_main', c.is_main, 'do_not_email', c.do_not_email,
    'owner', CASE WHEN c.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', c.owner_id, 'name', public.crm_person_name(c.owner_id)) END,
    'created_at', c.created_at, 'updated_at', c.updated_at)
$$;

REVOKE ALL ON FUNCTION public.crm_contact_fields(public.contacts) FROM PUBLIC, anon, authenticated, service_role;

-- A contact's name as the screens say it. Internal.
CREATE FUNCTION public.crm_contact_name(c public.contacts)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT btrim(concat_ws(' ', c.first_name, c.last_name)) $$;

REVOKE ALL ON FUNCTION public.crm_contact_name(public.contacts) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. What the form needs ----------
-- {account: {id, name, archived}, main_contact: {id, name} | null}. An account the caller may not see is as not there (PT404).
CREATE FUNCTION public.add_contact_context(p_firm_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  a public.accounts;
  m public.contacts;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO m FROM public.contacts c WHERE c.account_id = a.id AND c.is_main;
  RETURN jsonb_build_object(
    'account', jsonb_build_object('id', a.id, 'name', a.name, 'archived', a.archived_at IS NOT NULL),
    'main_contact', CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object('id', m.id, 'name', public.crm_contact_name(m)) END);
END;
$$;

REVOKE ALL ON FUNCTION public.add_contact_context(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_contact_context(uuid, uuid) TO authenticated;

-- ---------- 4. Adding ----------
-- Answers {record: <the contact's own fields>, previous_main: {id, name} | null}. Refused, in this order: not a member of the firm (42501), a closing firm or
-- Nevermore support (PT423), an account the caller may not see or that is not there (PT404), an archived account (55000), what is wrong with a field (22023,
-- in words), an owner who is not a current member of the firm (22023), an owner the level rule does not let the maker choose (42501).
CREATE FUNCTION public.add_contact(
  p_account_id uuid, p_first_name text, p_last_name text, p_title text, p_email text, p_phone text, p_mobile text, p_owner_id uuid DEFAULT NULL,
  p_is_main boolean DEFAULT false, p_do_not_email boolean DEFAULT false, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  a public.accounts;
  owner uuid;
  first_in text := NULLIF(btrim(p_first_name), '');
  last_in text := NULLIF(btrim(p_last_name), '');
  title_in text := NULLIF(btrim(p_title), '');
  email_in text := NULLIF(btrim(p_email), '');
  phone_in text := NULLIF(btrim(p_phone), '');
  mobile_in text := NULLIF(btrim(p_mobile), '');
  problem text;
  old_main public.contacts;
  made public.contacts;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  -- The account's row is held to the end of this transaction. FOR SHARE conflicts with archiving (a non-key UPDATE of archived_at), so a contact is never added
  -- to an account whose archiving is on its way. A main contact takes FOR NO KEY UPDATE, which conflicts with another adder's lock: two people ticking "Main
  -- contact" at once are ordered, and the second sees the first's main contact and takes over from it.
  IF COALESCE(p_is_main, false) THEN
    SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR NO KEY UPDATE;
  ELSE
    SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR SHARE;
  END IF;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF a.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing can be added to it.' USING ERRCODE = '55000';
  END IF;
  problem := public.contact_input_error(first_in, last_in, title_in, email_in, phone_in, mobile_in);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  -- The owner is the maker unless they choose another. Their membership is locked FOR SHARE (not KEY SHARE: removing or suspending a person is a non-key UPDATE
  -- of this row) until the end of the transaction, as create_account does: a removal either committed first and the person is no longer current here, or waits.
  owner := COALESCE(p_owner_id, auth.uid());
  IF owner IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = owner AND public.membership_is_current(m.valid_from, m.valid_until) FOR SHARE) THEN
    RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_change_firm_record(firm, owner) THEN
    RAISE EXCEPTION 'You can add a contact only for yourself and, as a lead, for people on your teams.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p_is_main, false) THEN
    -- Whoever may see the account may add to it, and so may take the main contact's place on it: the old main contact is unticked, not changed otherwise, and its
    -- change is in its history. Done before the insert, because the index admits one main contact at every moment.
    SELECT * INTO old_main FROM public.contacts c WHERE c.account_id = a.id AND c.is_main FOR UPDATE;
    IF old_main.id IS NOT NULL THEN
      UPDATE public.contacts SET is_main = false WHERE id = old_main.id;
    END IF;
  END IF;
  INSERT INTO public.contacts (firm_id, account_id, owner_id, first_name, last_name, title, email, phone, mobile, is_main, do_not_email)
  VALUES (firm, a.id, owner, first_in, last_in, title_in, email_in, phone_in, mobile_in, COALESCE(p_is_main, false), COALESCE(p_do_not_email, false))
  RETURNING * INTO made;
  RETURN jsonb_build_object(
    'record', public.crm_contact_fields(made),
    'previous_main', CASE WHEN old_main.id IS NULL THEN NULL ELSE jsonb_build_object('id', old_main.id, 'name', public.crm_contact_name(old_main)) END);
END;
$$;

REVOKE ALL ON FUNCTION public.add_contact(uuid, text, text, text, text, text, text, uuid, boolean, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_contact(uuid, text, text, text, text, text, text, uuid, boolean, boolean, uuid) TO authenticated;

-- ---------- 5. Where a contact may go ----------
-- The firm's accounts the contact could be moved to by move_contact's own rules: seen and changeable by the caller, not archived, not the one it is on. At most
-- 25, by name, narrowed by what was typed (anywhere in the name, case ignored). The contact must be one the caller may see (PT404).
CREATE FUNCTION public.contact_move_choices(p_firm_id uuid, p_contact_id uuid, p_search text DEFAULT '')
RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  c public.contacts;
  src public.accounts;
  pattern text := '%' || replace(replace(replace(COALESCE(btrim(p_search), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  SELECT * INTO c FROM public.contacts x WHERE x.id = p_contact_id AND x.firm_id = firm;
  SELECT * INTO src FROM public.accounts x WHERE x.id = c.account_id;
  IF c.id IS NULL OR NOT public.can_see_firm_record(src.firm_id, src.owner_id) THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN QUERY
    SELECT a.id, a.name FROM public.accounts a
    WHERE a.firm_id = firm AND a.archived_at IS NULL AND a.id <> c.account_id AND a.name ILIKE pattern
      AND public.can_see_firm_record(a.firm_id, a.owner_id) AND public.can_change_firm_record(a.firm_id, a.owner_id)
    ORDER BY lower(a.name COLLATE "und-x-icu"), a.id
    LIMIT 25;
END;
$$;

REVOKE ALL ON FUNCTION public.contact_move_choices(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_move_choices(uuid, uuid, text) TO authenticated;

-- ---------- 6. Moving ----------
-- Answers {record, from: {id, name}, to: {id, name}, was_main, activities_moved, opportunity_links_dropped, main_contact_cleared}. Refused, in this order: not a
-- member (42501), a closing firm or Nevermore support (PT423), a contact or an account the caller may not see or that is not there (PT404), the same account
-- (22023), the level rule on the contact, then the account it leaves, then the account it joins (42501, each in its own words), an archived account to join
-- (55000), an opportunity the caller may not change that has the contact as its main contact (42501), a person who is already a contact of the account joined
-- (22023), and, unless p_confirm, what moving would take off an opportunity (PT409, in words).
--
-- Locks, in an order that cannot make a ring with add_contact (which takes an account and then a contact): the accounts first, FOR SHARE, lowest id first (so
-- archiving either of them is waited for and two moves in opposite directions do not deadlock), then the contact FOR UPDATE, which waits for a call being logged
-- for it (that insert holds the contact FOR KEY SHARE through its key) and so takes it along. A contact that moved while this waited is refused (40001).
CREATE FUNCTION public.move_contact(p_contact_id uuid, p_to_account_id uuid, p_confirm boolean DEFAULT false, p_firm_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  seen uuid;
  c public.contacts;
  src public.accounts;
  dst public.accounts;
  nm text;
  links integer;
  mains integer;
  moved integer;
  done public.contacts;
  said text;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT x.account_id INTO seen FROM public.contacts x WHERE x.id = p_contact_id AND x.firm_id = firm;
  IF seen IS NULL THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  PERFORM 1 FROM public.accounts x WHERE x.firm_id = firm AND x.id IN (seen, p_to_account_id) ORDER BY x.id FOR SHARE;
  SELECT * INTO c FROM public.contacts x WHERE x.id = p_contact_id AND x.firm_id = firm FOR UPDATE;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF c.account_id <> seen THEN
    RAISE EXCEPTION 'That contact was moved while you were working. Try again.' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO src FROM public.accounts x WHERE x.id = c.account_id;
  IF NOT public.can_see_firm_record(src.firm_id, src.owner_id) THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  SELECT * INTO dst FROM public.accounts x WHERE x.id = p_to_account_id AND x.firm_id = firm;
  IF dst.id IS NULL OR NOT public.can_see_firm_record(dst.firm_id, dst.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF dst.id = src.id THEN
    RAISE EXCEPTION 'That contact is already on this account.' USING ERRCODE = '22023';
  END IF;
  -- The three yeses (D-209).
  IF NOT public.can_change_firm_record(firm, c.owner_id) THEN
    RAISE EXCEPTION '%', CASE WHEN c.owner_id IS NULL THEN 'Only an owner of the firm can move a contact that has no owner.'
      ELSE 'Only the contact''s owner, a lead of the owner''s team or an owner of the firm can move this contact.' END USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_change_firm_record(src.firm_id, src.owner_id) THEN
    RAISE EXCEPTION 'You can''t change the account this contact is on, so you can''t move it off.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_change_firm_record(dst.firm_id, dst.owner_id) THEN
    RAISE EXCEPTION 'You can''t change %, so you can''t move a contact onto it.', dst.name USING ERRCODE = '42501';
  END IF;
  IF dst.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This account is archived. Nothing can be moved onto it.' USING ERRCODE = '55000';
  END IF;
  nm := public.crm_contact_name(c);
  -- What the contact's leaving does to an opportunity it was on.
  IF EXISTS (SELECT 1 FROM public.opportunities o WHERE o.main_contact_id = c.id AND NOT public.can_change_firm_record(o.firm_id, o.owner_id)) THEN
    RAISE EXCEPTION '% is the main contact of an opportunity you can''t change. Ask its owner, or an owner of the firm, to change that first.', nm USING ERRCODE = '42501';
  END IF;
  IF c.prospect_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.contacts x WHERE x.account_id = dst.id AND x.prospect_user_id = c.prospect_user_id) THEN
    RAISE EXCEPTION 'That account already has this person as a contact.' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO links FROM public.activities a WHERE a.contact_id = c.id AND a.opportunity_id IS NOT NULL;
  SELECT count(*) INTO mains FROM public.opportunities o WHERE o.main_contact_id = c.id;
  IF (links > 0 OR mains > 0) AND NOT COALESCE(p_confirm, false) THEN
    said := CASE WHEN links = 0 THEN NULL WHEN links = 1 THEN 'takes 1 call, note or task off an opportunity on ' || src.name
      ELSE 'takes ' || links || ' calls, notes and tasks off an opportunity on ' || src.name END;
    RAISE EXCEPTION 'Moving % %. Move anyway?', nm, CASE
      WHEN links > 0 AND mains > 0 THEN said || ' and removes them as the main contact of ' || mains || CASE WHEN mains = 1 THEN ' opportunity' ELSE ' opportunities' END || ' there'
      WHEN links > 0 THEN said
      ELSE 'removes them as the main contact of ' || mains || CASE WHEN mains = 1 THEN ' opportunity' ELSE ' opportunities' END || ' on ' || src.name END
      USING ERRCODE = 'PT409';
  END IF;
  -- The links the contact's history cannot keep, undone first, while every key is still immediate.
  UPDATE public.opportunities SET main_contact_id = NULL WHERE main_contact_id = c.id;
  UPDATE public.activities SET opportunity_id = NULL WHERE contact_id = c.id AND opportunity_id IS NOT NULL;
  -- The contact changes account and its calls, notes and tasks follow: the two keys to the contact are deferrable, so between the two statements the keys are not
  -- looked at, and they are looked at, once, before this function returns.
  SET CONSTRAINTS activities_contact_fkey, opportunities_main_contact_fkey DEFERRED;
  BEGIN
    UPDATE public.contacts SET account_id = dst.id, is_main = false WHERE id = c.id RETURNING * INTO done;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That account already has this person as a contact.' USING ERRCODE = '22023';
  END;
  UPDATE public.activities SET account_id = dst.id WHERE contact_id = c.id;
  GET DIAGNOSTICS moved = ROW_COUNT;
  SET CONSTRAINTS activities_contact_fkey, opportunities_main_contact_fkey IMMEDIATE;
  RETURN jsonb_build_object(
    'record', public.crm_contact_fields(done),
    'from', jsonb_build_object('id', src.id, 'name', src.name), 'to', jsonb_build_object('id', dst.id, 'name', dst.name),
    'was_main', c.is_main, 'activities_moved', moved, 'opportunity_links_dropped', links, 'main_contact_cleared', mains);
END;
$$;

REVOKE ALL ON FUNCTION public.move_contact(uuid, uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_contact(uuid, uuid, boolean, uuid) TO authenticated;
