-- A contact's page, the database side (story CRM-C1.1, screen 18; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-33, D-44, D-46, D-186, D-187, D-209, D-222,
-- D-233, D-238; GLOSSARY.md "The broker's CRM"; ADR 0016, ADR 0023, ADR 0024; 20261119100000_crm_records.sql, 20261119140000_account_page.sql,
-- 20261119170000_add_contact.sql, 20261119180000_calls_notes_tasks.sql).
--
-- What this is. What the contact's page draws, asked of the database, and the save of the contact's own fields. Nothing else is restated: the log form's
-- choices already come from account_activity_options (a contact's account is a known account), and moving a contact is move_contact (20261119170000).
--
--   contact_page(firm, contact)              The page in one read: the contact's own fields, its account (id, name, archived), its owner, `can_change` (the level
--                                            rule on the contact's own owner, D-209: Edit is shown to those it will serve), `can_move` (the first two of move_contact's
--                                            three yeses, the ones the picker asks: contact_leave_error), `can_add` (the account is not archived, D-222) and the
--                                            opportunities the contact is the main contact of. NULL, the same as for a contact that is not there, to anyone who may
--                                            not see the contact's account (can_see_firm_record on the account, the same visibility as the account's own page).
--   contact_activity(firm, contact, filter, limit, offset)
--                                            The contact's calls, notes and tasks, newest first, as the account's Activity tab gives them (crm_activity_row), a page
--                                            of at most 100, filtered by All, Calls, Notes or Tasks. {count, rows}; NULL as above. There is no second set of rows:
--                                            these are the activities that name the contact, on the account that holds it (D-233).
--   update_contact(...)                      The save of the contact's own fields with its version (D-46), modelled on update_account and add_contact.
--
-- Where this stops. The emails with the contact and the place to write (screen 18), Email, "Last email" and the firm's own fields wait for Epic 6 and the custom
-- fields (D-186). "Do not email" is kept and shown; it hides nothing yet, because there is nothing to hide until emails exist (Epic 6 reads it).

-- ---------- 1. The first thing wrong with a changed contact, in words ----------
-- The words of contact_input_error (20261119170000), judged on a save of an existing contact: an email, a phone or a mobile left as it was (compared trimmed) is
-- not judged again for its look, so a contact copied from an intake at certification (which never failed over a phone, ADR 0025) can still have its other fields
-- saved. A phone's length is always asked: the column's own check says 50. NULL when nothing is wrong. Inputs already trimmed, a blank as NULL. Internal.
CREATE FUNCTION public.contact_update_error(
  p_first_name text, p_last_name text, p_title text, p_email text, p_phone text, p_mobile text,
  p_judge_email boolean, p_judge_phone boolean, p_judge_mobile boolean)
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
    WHEN char_length(p_email) > 254 THEN 'Enter an email address like name@example.com.'
    WHEN p_judge_email AND p_email IS NOT NULL AND p_email !~ '^[^\s@<>,;"()\[\]\\]+@[^\s@<>,;"()\[\]\\]+\.[^\s@<>,;"()\[\]\\]+$'
      THEN 'Enter an email address like name@example.com.'
    WHEN char_length(p_phone) > 50 THEN 'Enter a phone number like (503) 555-0142. An extension can follow, like x12.'
    WHEN p_judge_phone AND p_phone IS NOT NULL AND NOT public.is_valid_phone(p_phone) THEN 'Enter a phone number like (503) 555-0142. An extension can follow, like x12.'
    WHEN char_length(p_mobile) > 50 THEN 'Enter a mobile number like (503) 555-0142. An extension can follow, like x12.'
    WHEN p_judge_mobile AND p_mobile IS NOT NULL AND NOT public.is_valid_phone(p_mobile) THEN 'Enter a mobile number like (503) 555-0142. An extension can follow, like x12.'
    WHEN p_email IS NULL AND p_phone IS NULL AND p_mobile IS NULL THEN 'Enter an email or a phone number.'
  END
$$;

REVOKE ALL ON FUNCTION public.contact_update_error(text, text, text, text, text, text, boolean, boolean, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The page ----------
-- {contact, can_change, can_move, can_add, opportunities: {count, rows}} for a contact whose account the caller may see; NULL for anyone else. `contact` is the
-- contact's own fields (crm_contact_fields) with `account` ({id, name, archived}). The opportunities are the ones the contact is the main contact of (the one
-- link a contact has to an opportunity until the opportunity's page, Epic 4), newest target start first, at most 100 with their whole count; a row is {id, name,
-- stage (worked out, D-206), target_start, submission_id (what its name opens until CRM-O1.1, D-187)}.
CREATE FUNCTION public.contact_page(p_firm_id uuid, p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c public.contacts;
  a public.accounts;
  n bigint;
  r jsonb;
BEGIN
  IF p_firm_id IS NULL OR p_contact_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO c FROM public.contacts x WHERE x.id = p_contact_id AND x.firm_id = p_firm_id;
  IF c.id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = c.account_id AND x.firm_id = c.firm_id;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RETURN NULL;
  END IF;
  SELECT count(*) INTO n FROM public.opportunities o WHERE o.main_contact_id = c.id AND o.account_id = a.id;
  SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
    SELECT row_number() OVER (ORDER BY o.target_start DESC NULLS LAST, o.created_at DESC, o.id) AS o,
           jsonb_build_object('id', o.id, 'name', o.name, 'stage', public.opportunity_stage(o.id), 'target_start', o.target_start, 'submission_id', o.intake_id) AS j
    FROM public.opportunities o WHERE o.main_contact_id = c.id AND o.account_id = a.id
    ORDER BY o.target_start DESC NULLS LAST, o.created_at DESC, o.id
    LIMIT 100) x;
  RETURN jsonb_build_object(
    'contact', public.crm_contact_fields(c) || jsonb_build_object('account', jsonb_build_object('id', a.id, 'name', a.name, 'archived', a.archived_at IS NOT NULL)),
    'can_change', public.can_change_firm_record(c.firm_id, c.owner_id),
    'can_move', public.contact_leave_error(c.firm_id, c, a) IS NULL,
    'can_add', a.archived_at IS NULL,
    'opportunities', jsonb_build_object('count', n, 'rows', r));
END;
$$;

REVOKE ALL ON FUNCTION public.contact_page(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_page(uuid, uuid) TO authenticated;

-- ---------- 3. The contact's calls, notes and tasks ----------
-- {count, rows} of the activities that name this contact, newest first (when a call took place, when a note or a task was made, ties by id: the account's own
-- order, so the two lists agree), a page of at most 100 from a place that is not before the first. p_filter is 'all', 'calls', 'notes' or 'tasks' (22023
-- otherwise). The rows are crm_activity_row's, the same as the account's Activity tab, so they are drawn by the same code. NULL for anyone who may not see the
-- contact's account, and for a contact that is not there.
CREATE FUNCTION public.contact_activity(p_firm_id uuid, p_contact_id uuid, p_filter text DEFAULT 'all', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c public.contacts;
  a public.accounts;
  want text;
  n bigint;
  r jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit < 0 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'A page is 0 to 100 rows, from a place that is not before the first' USING ERRCODE = '22023';
  END IF;
  IF p_filter IS NULL OR p_filter NOT IN ('all', 'calls', 'notes', 'tasks') THEN
    RAISE EXCEPTION 'A contact''s activity is all, calls, notes or tasks' USING ERRCODE = '22023';
  END IF;
  IF p_firm_id IS NULL OR p_contact_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO c FROM public.contacts x WHERE x.id = p_contact_id AND x.firm_id = p_firm_id;
  IF c.id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = c.account_id AND x.firm_id = c.firm_id;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RETURN NULL;
  END IF;
  want := CASE p_filter WHEN 'calls' THEN 'call' WHEN 'notes' THEN 'note' WHEN 'tasks' THEN 'task' END;
  SELECT count(*) INTO n FROM public.activities t WHERE t.contact_id = c.id AND (want IS NULL OR t.kind = want);
  SELECT COALESCE(jsonb_agg(public.crm_activity_row(x) ORDER BY x.at DESC, x.id DESC), '[]'::jsonb) INTO r FROM (
    SELECT t.* FROM public.activities t WHERE t.contact_id = c.id AND (want IS NULL OR t.kind = want)
    ORDER BY t.at DESC, t.id DESC OFFSET p_offset LIMIT p_limit) x;
  RETURN jsonb_build_object('count', n, 'rows', r);
END;
$$;

REVOKE ALL ON FUNCTION public.contact_activity(uuid, uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_activity(uuid, uuid, text, integer, integer) TO authenticated;

-- ---------- 4. The save of a contact's own fields ----------
-- Saves the contact's own fields (every one is sent; a blank one is cleared) from the version the person started from. Answers
--   {conflict: false, record: <the contact's own fields, with its new version>, previous_main: {id, name} | null}  or, when someone saved first and nothing was
--   saved, {conflict: true, currentVersion, current: {the fields a person edits}, changed: [{field, value, who, at}]}.
-- p_owner_id NULL leaves the owner as it is (so a contact whose owner has left, or who has none, can be saved without choosing one); a person is chosen from the
-- firm's current members, and the level rule must let the caller give the contact to them (as add_contact asks), so nobody gives away a contact they could not
-- then change. The account is not edited here: moving a contact is move_contact's.
-- "Main contact" makes this one the account's only main contact: the one that was is unticked in the same transaction and named in the answer, and taking
-- over needs the level rule on that old main contact (D-238, 42501 in words otherwise). Unticking the main contact leaves the account with none.
-- Refused, in this order and before the version is looked at: not a member of the firm (42501), a closing firm or Nevermore support (PT423), what is wrong with
-- the fields (22023), no version (22023), a contact whose account the caller may not see or that is not there (PT404, one answer for both), a contact the level
-- rule does not give the caller (42501; a contact with no owner can be changed only by an owner of the firm), an owner who is not a current member (22023) or one
-- the level rule does not let the caller choose (42501), the old main contact's level (42501), a version the contact never had (22023). The version then
-- orders two saves: the row is held, so a save from an older version changes nothing at all (the old main contact included) and answers the conflict.
-- Locks, in the order add_contact and move_contact take them: the account first (FOR SHARE, or FOR NO KEY UPDATE when taking over as main contact, so two
-- people ticking "Main contact" at once are ordered), then the contact. A contact that moved while this waited is refused (40001).
CREATE FUNCTION public.update_contact(
  p_contact_id uuid, p_first_name text, p_last_name text, p_title text, p_email text, p_phone text, p_mobile text, p_owner_id uuid DEFAULT NULL,
  p_is_main boolean DEFAULT false, p_do_not_email boolean DEFAULT false, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  first_in text := NULLIF(btrim(p_first_name), '');
  last_in text := NULLIF(btrim(p_last_name), '');
  title_in text := NULLIF(btrim(p_title), '');
  email_in text := NULLIF(btrim(p_email), '');
  phone_in text := NULLIF(btrim(p_phone), '');
  mobile_in text := NULLIF(btrim(p_mobile), '');
  seen uuid;
  a public.accounts;
  cur public.contacts;
  old_main public.contacts;
  changed public.contacts;
  owner uuid;
  takes_main boolean := COALESCE(p_is_main, false);
  problem text;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO cur FROM public.contacts x WHERE x.id = p_contact_id AND x.firm_id = firm;
  seen := cur.account_id;
  -- The look of an email, a phone or a mobile is judged only when it was changed from what the contact holds now (compared trimmed).
  problem := public.contact_update_error(
    first_in, last_in, title_in, email_in, phone_in, mobile_in,
    email_in IS DISTINCT FROM NULLIF(btrim(cur.email), ''), phone_in IS DISTINCT FROM NULLIF(btrim(cur.phone), ''), mobile_in IS DISTINCT FROM NULLIF(btrim(cur.mobile), ''));
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the contact it started from, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  IF seen IS NULL THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF takes_main AND NOT cur.is_main THEN
    SELECT * INTO a FROM public.accounts x WHERE x.id = seen AND x.firm_id = firm FOR NO KEY UPDATE;
  ELSE
    SELECT * INTO a FROM public.accounts x WHERE x.id = seen AND x.firm_id = firm FOR SHARE;
  END IF;
  -- The row is held from here, so that a save waiting behind another save of the same contact, from the same version, reads what that save left.
  SELECT * INTO cur FROM public.contacts x WHERE x.id = p_contact_id AND x.firm_id = firm FOR NO KEY UPDATE;
  IF cur.id IS NULL OR a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF cur.account_id <> a.id THEN
    RAISE EXCEPTION 'That contact was moved while you were working. Try again.' USING ERRCODE = '40001';
  END IF;
  IF NOT public.can_change_firm_record(cur.firm_id, cur.owner_id) THEN
    RAISE EXCEPTION '%', CASE WHEN cur.owner_id IS NULL
      THEN 'A contact with no owner can only be changed by an owner of the firm.'
      ELSE 'Only the contact''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
      USING ERRCODE = '42501';
  END IF;
  owner := COALESCE(p_owner_id, cur.owner_id);
  IF owner IS DISTINCT FROM cur.owner_id THEN
    -- Their membership is held FOR SHARE until the end of the transaction, as add_contact does: a removal either committed first or waits.
    IF NOT EXISTS (
      SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = firm AND m.user_id = owner AND public.membership_is_current(m.valid_from, m.valid_until) FOR SHARE) THEN
      RAISE EXCEPTION 'Choose one of the firm''s people as the owner.' USING ERRCODE = '22023';
    END IF;
    IF NOT public.can_change_firm_record(firm, owner) THEN
      RAISE EXCEPTION 'You can give a contact only to yourself and, as a lead, to people on your teams.' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF takes_main AND NOT cur.is_main THEN
    SELECT * INTO old_main FROM public.contacts c WHERE c.account_id = a.id AND c.is_main AND c.id <> cur.id FOR UPDATE;
    -- Taking the main contact's place changes that contact's record, which the level rule governs (D-209, D-238).
    IF old_main.id IS NOT NULL AND NOT public.can_change_firm_record(firm, old_main.owner_id) THEN
      RAISE EXCEPTION 'Only someone who may change % can make another contact the main one.', public.crm_contact_name(old_main) USING ERRCODE = '42501';
    END IF;
  END IF;
  -- A version the contact has never had is not "someone else changed it": nobody did.
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the contact that does not exist, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  -- The row is held, so its version is the current one: a save from an older version changes nothing (not even the old main contact) and is answered below.
  IF p_version = cur.version THEN
    IF old_main.id IS NOT NULL THEN
      UPDATE public.contacts SET is_main = false WHERE id = old_main.id;
    END IF;
    UPDATE public.contacts SET
      first_name = first_in, last_name = last_in, title = title_in, email = email_in, phone = phone_in, mobile = mobile_in, owner_id = owner,
      is_main = takes_main, do_not_email = COALESCE(p_do_not_email, false)
    WHERE id = cur.id AND version = p_version
    RETURNING * INTO changed;
    RETURN jsonb_build_object(
      'conflict', false, 'record', public.crm_contact_fields(changed),
      'previous_main', CASE WHEN old_main.id IS NULL THEN NULL ELSE jsonb_build_object('id', old_main.id, 'name', public.crm_contact_name(old_main)) END);
  END IF;
  RETURN jsonb_build_object(
    'conflict', true,
    'currentVersion', cur.version,
    'current', jsonb_build_object(
      'first_name', cur.first_name, 'last_name', cur.last_name, 'title', cur.title, 'email', cur.email, 'phone', cur.phone, 'mobile', cur.mobile,
      'owner_id', cur.owner_id, 'is_main', cur.is_main, 'do_not_email', cur.do_not_email),
    'changed', public.record_version_changes(cur.firm_id, 'contacts', cur.id::text, p_version, cur.version));
END;
$$;

REVOKE ALL ON FUNCTION public.update_contact(uuid, text, text, text, text, text, text, uuid, boolean, boolean, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_contact(uuid, text, text, text, text, text, text, uuid, boolean, boolean, uuid, integer) TO authenticated;
