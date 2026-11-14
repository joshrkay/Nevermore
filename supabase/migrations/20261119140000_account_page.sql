-- An account's page, the database side (story CRM-A2.1a; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-33, D-44, D-45, D-46, D-104, D-105, D-185, D-186,
-- D-187, D-197, D-199, D-206, D-209, D-211, D-212, D-213, D-216; GLOSSARY.md "The broker's CRM", "Signed link"; ADR 0016, ADR 0023, ADR 0024;
-- 20261119100000_crm_records.sql, 20261118160000_record_version.sql, 20261118160500_record_version_fixes.sql).
--
-- What this is. Everything the account's page (CRM-A2.1b, screen 17) draws, asked of the database, and the one rule every later change to a record asks.
-- Nothing is on screen here. Five things:
--
--   1. can_change_firm_record(firm, owner): the LEVEL RULE for changes (D-209), written once. An agent changes the records they own, a lead their own and
--      those of their team and the teams under it, an owner the firm's; a record with no owner, or whose owner has left, only an owner. Whatever the firm's
--      visibility setting says: "everyone sees everything" lets a member SEE, never change. Nevermore support is no member, so it changes nothing (and the
--      one write guard, assert_firm_writable, refuses it first). Adding a contact, a call, a note or a task is open to anyone who may see the record: that
--      is the adding stories' to apply (CRM-A2.2, CRM-E1.5), and they do not call this. Not executable by an API role: the write functions call it, and the
--      page's read answers it as `can_change` so the screen shows or hides Edit.
--   2. account_page(firm, account): the page, in one read. The account's details (the standard fields, its worked-out status and source, its owner's name)
--      and, for each tab, its count and its first five rows: Contacts, Opportunities, Quotes, Activity, Files. There is no Renewals tab (D-186). It answers
--      only someone who may see the account (can_see_firm_record) and says nothing at all, the same as for an account that is not there, to anyone else:
--      another firm's member, a person with no firm, a platform admin, a former member and a member whose level does not reach it. One firm at a time:
--      the firm is named, and the address the request was made at narrows it as it does every membership question (D-40).
--   3. account_files(firm, account, limit, offset): the Files tab's whole list (D-199). An account's files are its intakes' files that passed the virus
--      check (scan verdict "clean"), never what is pending, quarantined or failed, and never what was read out of one. A row names the file; it does not
--      open it: the link is a signed link, made by Storage only to a caller whose own file rule lets them read that file (a support session opens none),
--      so each file stays under its own access rule. Uploading a file to an account is CRM-A2.5's.
--   4. update_account(...): the save of an account's own fields, edit in place (CRM-S4.1), with its version (D-46), modelled on
--      advisor_update_referral_partner: a member of the firm the call acts for (firm_to_act_for), the one write guard (assert_firm_writable: a closing firm
--      and Nevermore support are refused, ADR 0023, ADR 0024), the account must be one the caller may see (else the one refusal for an account that is not
--      there), the level rule, then UPDATE ... WHERE version = p_version, answering {conflict: false, record} or the conflict shape {conflict: true,
--      currentVersion, current, changed}. Owner, archiving and source are not edited here: an owner change and archiving are CRM-A1.1c's, and the source
--      is set by the product and never edited (D-211).
--   5. submission_account(firm, submission): a submission's account (its id and name), for the link "Account: <name>" on the submission's page (D-213),
--      to someone who may see the account; nothing, as above, for anyone else.
--
-- Every tab's rows are built by one internal function (account_tab_rows) that takes the tab and a page, so the page's first five and a later "see all" are
-- the same rows: the page asks for five; the Files list asks for a page of its own. The other tabs' full lists are not exposed to the API yet.
--
-- Where this stops. The Activity tab holds the record history of the account and of its contacts, newest first (D-212); calls, notes and tasks come with
-- CRM-E1.5 (row 16), which adds its rows to that one list under their own `type`, with `change` the type of every row here. Last activity (D-201) is
-- CRM-E1.5's too. The Overview's "Referred by" and firm's own fields are custom fields (D-186).

-- ---------- 1. The level rule ----------
CREATE FUNCTION public.can_change_firm_record(p_firm_id uuid, p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.firm_role(p_firm_id)
    WHEN 'owner' THEN true
    WHEN 'agent' THEN p_owner_id IS NOT NULL AND p_owner_id = auth.uid()
    WHEN 'lead' THEN p_owner_id IS NOT NULL AND (
      p_owner_id = auth.uid()
      OR EXISTS (
        WITH RECURSIVE my_teams (id) AS (
          SELECT m.team_id
          FROM public.firm_memberships m
          WHERE m.firm_id = p_firm_id AND m.user_id = auth.uid() AND m.team_id IS NOT NULL
            AND public.membership_is_current(m.valid_from, m.valid_until)
          UNION
          SELECT t.id FROM public.firm_teams t JOIN my_teams ON t.parent_team_id = my_teams.id
        )
        SELECT 1
        FROM public.firm_memberships o
        WHERE o.firm_id = p_firm_id AND o.user_id = p_owner_id
          AND public.membership_is_current(o.valid_from, o.valid_until)
          AND o.team_id IN (SELECT id FROM my_teams)))
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.can_change_firm_record(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. Small pieces, internal ----------
-- A person's name as a screen shows it: the name they gave when they signed up, else their email (D-42). NULL for nobody. Internal.
CREATE FUNCTION public.crm_person_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(NULLIF(btrim(u.raw_user_meta_data ->> 'full_name'), ''), NULLIF(btrim(u.raw_user_meta_data ->> 'name'), ''), u.email::text)
  FROM auth.users u WHERE u.id = p_user_id
$$;

REVOKE ALL ON FUNCTION public.crm_person_name(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The account's own fields, as the page and a save answer them: the fields a person edits in place, the source the product set, and the version to
-- start the next save from. Internal.
CREATE FUNCTION public.crm_account_fields(a public.accounts)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', a.id, 'version', a.version, 'name', a.name, 'trade_name', a.trade_name, 'website', a.website, 'web_domain', a.web_domain, 'phone', a.phone,
    'street', a.street, 'city', a.city, 'state', a.state, 'postal_code', a.postal_code, 'industry', a.industry, 'employees', a.employees,
    'states_of_operation', to_jsonb(a.states_of_operation), 'current_provider', a.current_provider, 'source', a.source,
    'archived_at', a.archived_at, 'created_at', a.created_at, 'updated_at', a.updated_at)
$$;

REVOKE ALL ON FUNCTION public.crm_account_fields(public.accounts) FROM PUBLIC, anon, authenticated, service_role;

-- An account's page looks its opportunities up by the account alone (the account is already known to be the firm's), so they need an index that
-- leads with the account: CRM-Q1.1a's (firm_id, account_id) cannot serve a lookup that does not name the firm. It also orders by creation, for the
-- account's first intake (the source partner). Contacts already have one: the unique (account, prospect) index leads with the account.
CREATE INDEX opportunities_account_created_idx ON public.opportunities (account_id, created_at, id);

-- ---------- 3. One tab: its count and a page of its rows ----------
-- {count, rows}: how many the tab holds in all, and the rows from `p_offset` (newest or nearest first, ties by id, so a page is the same each time).
-- Fixed branches, no SQL made from text (D-44). Internal: the caller has already decided the person may see the account. Rows by tab:
--   contacts       id, first_name, last_name, title, email, phone, mobile, is_main, do_not_email: the main contact first
--   opportunities  id, name, stage (worked out, D-206), target_start, submission_id (the intake it holds, which its name opens until CRM-O1.1, D-187; null
--                  when it holds none)
--   quotes         id (the quote request's), submission_id, opportunity_id, opportunity_name, peo_name, status, sent_on, quote_received_on, quote_expires_on:
--                  a quote request on an intake of the account's opportunities, with the quote it returns (D-185)
--   activity       the record history of the account and of its contacts, one row per entry as record_history_list gives it, with the record it is about:
--                  type ('change'), entry_key, at, change_id, kind, who, who_kind, field, from_value, to_value, record_table, record_id, record_name
--   files          id, file_name, mime_type, size_bytes, category, created_at, submission_id, storage_path: a document of an intake of the account's
--                  opportunities whose scan passed; never what was read out of it
CREATE FUNCTION public.account_tab_rows(p_account_id uuid, p_tab text, p_limit integer, p_offset integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  n bigint;
  r jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit < 0 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'A page is 0 to 100 rows, from a place that is not before the first' USING ERRCODE = '22023';
  END IF;
  IF p_tab = 'contacts' THEN
    SELECT count(*) INTO n FROM public.contacts c WHERE c.account_id = p_account_id;
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY c.is_main DESC, lower(c.last_name), lower(COALESCE(c.first_name, '')), c.id) AS o,
             jsonb_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name, 'title', c.title, 'email', c.email, 'phone', c.phone,
                                'mobile', c.mobile, 'is_main', c.is_main, 'do_not_email', c.do_not_email) AS j
      FROM public.contacts c WHERE c.account_id = p_account_id
      ORDER BY c.is_main DESC, lower(c.last_name), lower(COALESCE(c.first_name, '')), c.id
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab = 'opportunities' THEN
    SELECT count(*) INTO n FROM public.opportunities o WHERE o.account_id = p_account_id;
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY o.target_start DESC NULLS LAST, o.created_at DESC, o.id) AS o,
             jsonb_build_object('id', o.id, 'name', o.name, 'stage', public.opportunity_stage(o.id), 'target_start', o.target_start,
                                'submission_id', o.intake_id) AS j
      FROM public.opportunities o WHERE o.account_id = p_account_id
      ORDER BY o.target_start DESC NULLS LAST, o.created_at DESC, o.id
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab = 'quotes' THEN
    SELECT count(*) INTO n FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE o.account_id = p_account_id;
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY q.sent_on DESC NULLS LAST, q.id DESC) AS o,
             jsonb_build_object('id', q.id, 'submission_id', q.session_id, 'opportunity_id', o.id, 'opportunity_name', o.name, 'peo_name', q.peo_name,
                                'status', q.status, 'sent_on', q.sent_on, 'quote_received_on', q.quote_received_on, 'quote_expires_on', q.quote_expires_on) AS j
      FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE o.account_id = p_account_id
      ORDER BY q.sent_on DESC NULLS LAST, q.id DESC
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab = 'files' THEN
    SELECT count(*) INTO n FROM public.documents d JOIN public.opportunities o ON o.intake_id = d.session_id
    WHERE o.account_id = p_account_id AND d.scan_verdict = 'clean';
    SELECT COALESCE(jsonb_agg(x.j ORDER BY x.o), '[]'::jsonb) INTO r FROM (
      SELECT row_number() OVER (ORDER BY d.created_at DESC, d.id) AS o,
             jsonb_build_object('id', d.id, 'file_name', d.file_name, 'mime_type', d.mime_type, 'size_bytes', d.size_bytes, 'category', d.category,
                                'created_at', d.created_at, 'submission_id', d.session_id, 'storage_path', d.storage_path) AS j
      FROM public.documents d JOIN public.opportunities o ON o.intake_id = d.session_id
      WHERE o.account_id = p_account_id AND d.scan_verdict = 'clean'
      ORDER BY d.created_at DESC, d.id
      OFFSET p_offset LIMIT p_limit) x;
  ELSIF p_tab = 'activity' THEN
    WITH entries AS (
      SELECT h.*, a.name AS record_name
      FROM public.accounts a
      JOIN public.record_history h ON h.firm_id = a.firm_id AND h.table_name = 'accounts' AND h.record_key = a.id::text
      WHERE a.id = p_account_id
      UNION ALL
      SELECT h.*, btrim(concat_ws(' ', c.first_name, c.last_name))
      FROM public.contacts c
      JOIN public.record_history h ON h.firm_id = c.firm_id AND h.table_name = 'contacts' AND h.record_key = c.id::text
      WHERE c.account_id = p_account_id
    )
    SELECT (SELECT count(*) FROM entries),
           COALESCE((SELECT jsonb_agg(x.j ORDER BY x.o) FROM (
             SELECT row_number() OVER (ORDER BY e.at DESC, e.entry_key DESC) AS o,
                    jsonb_build_object('type', 'change', 'entry_key', e.entry_key, 'at', e.at, 'change_id', e.change_id, 'kind', e.kind,
                                       'who', public.record_history_who(e.actor_id, e.actor_is_staff),
                                       'who_kind', CASE WHEN e.actor_is_staff THEN 'nevermore' WHEN e.actor_id IS NULL THEN 'system' ELSE 'member' END,
                                       'field', e.field, 'from_value', e.old_value, 'to_value', e.new_value,
                                       'record_table', e.table_name::text, 'record_id', e.record_key, 'record_name', e.record_name) AS j
             FROM entries e ORDER BY e.at DESC, e.entry_key DESC OFFSET p_offset LIMIT p_limit) x), '[]'::jsonb)
    INTO n, r;
  ELSE
    RAISE EXCEPTION 'An account has no tab called "%"', left(COALESCE(p_tab, ''), 40) USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('count', n, 'rows', r);
END;
$$;

REVOKE ALL ON FUNCTION public.account_tab_rows(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. The page ----------
-- {account, can_change, tabs: {contacts, opportunities, quotes, activity, files}} for an account the caller may see; NULL, the same as for an account that
-- is not there, for anyone else. `account` is the standard fields (crm_account_fields) with: status (prospect or client, worked out, D-197), owner ({id,
-- name} or null), and source_partner (for an account made from an employer's intake that came by a referral partner's link, the partner's name; it is
-- read from the intake and never stored, D-211). `can_change` is the level rule asked of this account, so the screen shows Edit to those it will serve.
-- Each tab is {count, rows}, its first five rows.
CREATE FUNCTION public.account_page(p_firm_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a public.accounts;
  partner text;
BEGIN
  IF p_firm_id IS NULL OR p_account_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = p_firm_id;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RETURN NULL;
  END IF;
  IF a.source = 'employer_intake' THEN
    -- The account's first intake is the one on its earliest opportunity that holds one; the partner is whoever's link that intake came by, if any.
    SELECT r.name INTO partner
    FROM (SELECT o.intake_id FROM public.opportunities o WHERE o.account_id = a.id AND o.intake_id IS NOT NULL ORDER BY o.created_at, o.id LIMIT 1) first_intake
    JOIN public.chamber_sessions s ON s.id = first_intake.intake_id
    LEFT JOIN public.referral_partners r ON r.firm_id = a.firm_id AND r.code = s.referral_code;
  END IF;
  RETURN jsonb_build_object(
    'account', public.crm_account_fields(a) || jsonb_build_object(
      'status', public.account_status(a.id),
      'owner', CASE WHEN a.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', a.owner_id, 'name', public.crm_person_name(a.owner_id)) END,
      'source_partner', partner),
    'can_change', public.can_change_firm_record(a.firm_id, a.owner_id),
    'tabs', jsonb_build_object(
      'contacts', public.account_tab_rows(a.id, 'contacts', 5, 0),
      'opportunities', public.account_tab_rows(a.id, 'opportunities', 5, 0),
      'quotes', public.account_tab_rows(a.id, 'quotes', 5, 0),
      'activity', public.account_tab_rows(a.id, 'activity', 5, 0),
      'files', public.account_tab_rows(a.id, 'files', 5, 0)));
END;
$$;

REVOKE ALL ON FUNCTION public.account_page(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_page(uuid, uuid) TO authenticated;

-- ---------- 5. The Files list ----------
-- {count, rows} for an account the caller may see (rows as the files tab above, a page of at most 100, newest first); NULL for anyone else. A row names
-- a file and says where it is stored; the link that opens it is a signed link, made by Storage only to a caller its own file rule lets read that file.
CREATE FUNCTION public.account_files(p_firm_id uuid, p_account_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a public.accounts;
BEGIN
  IF p_firm_id IS NULL OR p_account_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO a FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = p_firm_id;
  IF a.id IS NULL OR NOT public.can_see_firm_record(a.firm_id, a.owner_id) THEN
    RETURN NULL;
  END IF;
  RETURN public.account_tab_rows(a.id, 'files', p_limit, p_offset);
END;
$$;

REVOKE ALL ON FUNCTION public.account_files(uuid, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_files(uuid, uuid, integer, integer) TO authenticated;

-- ---------- 6. A submission's account ----------
-- {id, name} of the account that holds the submission (through its opportunity), for someone who may see that account; NULL for anyone else, a submission
-- that is on no account yet included.
CREATE FUNCTION public.submission_account(p_firm_id uuid, p_submission_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('id', a.id, 'name', a.name)
  FROM public.opportunities o
  JOIN public.accounts a ON a.id = o.account_id AND a.firm_id = o.firm_id
  WHERE p_firm_id IS NOT NULL AND o.firm_id = p_firm_id AND o.intake_id = p_submission_id
    AND public.can_see_firm_record(a.firm_id, a.owner_id)
$$;

REVOKE ALL ON FUNCTION public.submission_account(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submission_account(uuid, uuid) TO authenticated;

-- ---------- 7. The save of an account's own fields ----------
-- The first thing wrong with what was sent, in words, or NULL. Plain: the form shows what it can itself and the database says the rest. Internal.
CREATE FUNCTION public.account_input_error(
  p_name text, p_trade_name text, p_website text, p_phone text, p_street text, p_city text, p_state text, p_postal_code text, p_industry text,
  p_employees integer, p_states_of_operation text[], p_current_provider text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_name IS NULL THEN 'Give the account a name.'
    WHEN char_length(p_name) > 200 THEN 'Keep the account''s name to 200 characters.'
    WHEN char_length(p_trade_name) > 200 THEN 'Keep the trade name to 200 characters.'
    WHEN char_length(p_website) > 300 THEN 'Keep the website to 300 characters.'
    WHEN char_length(p_phone) > 40 THEN 'Keep the phone number to 40 characters.'
    WHEN char_length(p_street) > 200 THEN 'Keep the street to 200 characters.'
    WHEN char_length(p_city) > 100 THEN 'Keep the city to 100 characters.'
    WHEN p_state IS NOT NULL AND NOT public.is_us_state_code(p_state) THEN 'Choose a state from the list.'
    WHEN char_length(p_postal_code) > 20 THEN 'Keep the postal code to 20 characters.'
    WHEN char_length(p_industry) > 200 THEN 'Keep the industry to 200 characters.'
    WHEN p_employees < 0 THEN 'Employees can''t be a negative number.'
    WHEN NOT public.crm_states_ok(p_states_of_operation) THEN 'Choose the states of operation from the list.'
    WHEN char_length(p_current_provider) > 200 THEN 'Keep the current provider to 200 characters.'
  END
$$;

REVOKE ALL ON FUNCTION public.account_input_error(text, text, text, text, text, text, text, text, text, integer, text[], text) FROM PUBLIC, anon, authenticated, service_role;

-- Saves the account's own fields (every one is sent; a blank one is cleared) from the version the person started from. Answers
--   {conflict: false, record: <the account's own fields, with its new version>}  or, when someone saved first and nothing was saved,
--   {conflict: true, currentVersion, current: {the fields a person edits}, changed: [{field, value, who, at}]}.
-- Refused, in this order and before the version is looked at: not a member of the firm (42501), a closing firm or Nevermore support (PT423), what is
-- wrong with the fields (22023), no version (22023), an account the caller may not see or that is not there (PT404, one answer for both), an account the
-- level rule does not give the caller (42501), a version the account never had (22023).
CREATE FUNCTION public.update_account(
  p_account_id uuid, p_name text, p_trade_name text, p_website text, p_phone text, p_street text, p_city text, p_state text, p_postal_code text,
  p_industry text, p_employees integer, p_states_of_operation text[], p_current_provider text, p_firm_id uuid DEFAULT NULL, p_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  name_in text := NULLIF(btrim(p_name), '');
  trade_in text := NULLIF(btrim(p_trade_name), '');
  website_in text := NULLIF(btrim(p_website), '');
  phone_in text := NULLIF(btrim(p_phone), '');
  street_in text := NULLIF(btrim(p_street), '');
  city_in text := NULLIF(btrim(p_city), '');
  state_in text := upper(NULLIF(btrim(p_state), ''));
  postal_in text := NULLIF(btrim(p_postal_code), '');
  industry_in text := NULLIF(btrim(p_industry), '');
  provider_in text := NULLIF(btrim(p_current_provider), '');
  states_in text[];
  problem text;
  cur public.accounts;
  changed public.accounts;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  -- The states of operation are state codes in capitals, each once, in the order sent.
  SELECT COALESCE(array_agg(s ORDER BY first_at), '{}') INTO states_in
  FROM (SELECT upper(btrim(x)) AS s, min(n) AS first_at FROM unnest(COALESCE(p_states_of_operation, '{}')) WITH ORDINALITY AS u (x, n) GROUP BY upper(btrim(x))) d;
  problem := public.account_input_error(name_in, trade_in, website_in, phone_in, street_in, city_in, state_in, postal_in, industry_in, p_employees, states_in, provider_in);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'This save did not say which version of the account it started from, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  -- The row is held from here, so that a save waiting behind another save of the same account, from the same version, reads what that save left: its
  -- version, its values and its author. Without it the second would read the row as it was before the first and answer a conflict naming the version it
  -- sent, with the old values and nothing in `changed`. (A change of the owner can't slip in either way: the update below asks the version.)
  SELECT * INTO cur FROM public.accounts x WHERE x.id = p_account_id AND x.firm_id = firm FOR NO KEY UPDATE;
  IF cur.id IS NULL OR NOT public.can_see_firm_record(cur.firm_id, cur.owner_id) THEN
    RAISE EXCEPTION 'That account isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF NOT public.can_change_firm_record(cur.firm_id, cur.owner_id) THEN
    RAISE EXCEPTION '%', CASE WHEN cur.owner_id IS NULL
      THEN 'An account with no owner can only be changed by an owner of the firm.'
      ELSE 'Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.' END
      USING ERRCODE = '42501';
  END IF;
  -- The one statement that orders two saves: it touches the row only if it is still at the version the person started from.
  UPDATE public.accounts SET
    name = name_in, trade_name = trade_in, website = website_in, phone = phone_in, street = street_in, city = city_in, state = state_in,
    postal_code = postal_in, industry = industry_in, employees = p_employees, states_of_operation = states_in, current_provider = provider_in
  WHERE id = cur.id AND version = p_version
  RETURNING * INTO changed;
  IF changed.id IS NOT NULL THEN
    RETURN jsonb_build_object('conflict', false, 'record', public.crm_account_fields(changed));
  END IF;
  -- A version the account has never had is not "someone else changed it": nobody did.
  IF p_version > cur.version THEN
    RAISE EXCEPTION 'This save names a version of the account that does not exist, so it was refused. Reload the page and try again.'
      USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'conflict', true,
    'currentVersion', cur.version,
    'current', jsonb_build_object(
      'name', cur.name, 'trade_name', cur.trade_name, 'website', cur.website, 'phone', cur.phone, 'street', cur.street, 'city', cur.city,
      'state', cur.state, 'postal_code', cur.postal_code, 'industry', cur.industry, 'employees', cur.employees,
      'states_of_operation', to_jsonb(cur.states_of_operation), 'current_provider', cur.current_provider),
    'changed', public.record_version_changes(cur.firm_id, 'accounts', cur.id::text, p_version, cur.version));
END;
$$;

REVOKE ALL ON FUNCTION public.update_account(uuid, text, text, text, text, text, text, text, text, text, integer, text[], text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_account(uuid, text, text, text, text, text, text, text, text, text, integer, text[], text, uuid, integer) TO authenticated;
