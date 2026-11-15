-- Spotting a duplicate while creating an account or adding a contact (story CRM-S4.2, screens 23 and 24; docs/BROKER_CRM_BUILD.md D-193, D-209, D-219, D-226,
-- D-238 and D-600 to D-604; 20261119110000_chain_at_certification.sql, the match this reuses; 20261119100000_crm_records.sql).
--
-- What this is. Two reads the New account form and the Add a contact form ask while a person types, and one change of the match they share:
--
--   duplicates_of_account     The firm's accounts that may be the same business as the one described (D-193): the same web domain, the same name and state, or a
--                             contact with the same email. The rule is the chain's own (find_duplicate_account), now written once: that function asks this one
--                             for the earliest match, so the two can never disagree about what a duplicate is. Reads every account of the firm whoever may see it
--                             (the caller decides what to show). No API role can run it.
--   duplicates_of_contact     The firm's contacts with the same email, ignoring case. The same rule's email arm, answered per contact. No API role can run it.
--   duplicate_account_check   What the New account form shows. For the website, the name and the state typed so far: the accounts that match, each as
--                             {kind: 'account', visible: true, id, name, owner, archived, reasons} when the person may see it (the account's level rule, can_see_firm_record)
--                             and as {kind: 'account', visible: false, ask} when they may not.
--   duplicate_contact_check   What the Add a contact form shows, for the email typed so far: the contacts that match, each as {kind: 'contact', visible: true, id,
--                             name, account, owner, archived, reasons} for a contact whose account the person may see (a contact is seen as its account is, D-219) and
--                             {kind: 'contact', visible: false, ask} for one they may not.
--
-- The masked match (CRM-S4.2: "a match the person may not see says only that one exists and who to ask"). A record the person may not see is never named, never
-- linked, and its fields, its reasons and its id are never sent: only that a duplicate of that kind exists, and who to ask. Who to ask is the account's owner when
-- that person is a current member of the firm, else the firm's owners (the people who see a record with no owner, D-209), by name. Matches the person may not see
-- that have the same people to ask are one entry, so the answer never counts them. The checks answer no more than the person may be told: a record they may see is
-- shown in full, a record they may not is a mask, and an answer for another firm's record does not exist (the firm is the caller's own, firm_to_act_for).
--
-- Both checks are only advice: they never refuse a save and nothing in create_account or add_contact changes (D-193: a likeness is a warning, not a rule). They are
-- reads, so a closing firm and a support session may ask them as they may ask every other read.
--
-- What is NOT here: merging (CRM-S4.3), the warning for a lead (leads are Epic 5), and importing's review (CRM-X4.1).

-- ---------- 1. The match, once ----------
-- Every account of the firm that may be the same business as the one described, with why: 'website', 'name' and 'email' (the arms of D-193), each account once with its
-- reasons in a fixed order. One query for each way to match, so each finds its rows by its own index (web_domain, the name key and state, a contact's lower-case email).
CREATE FUNCTION public.duplicates_of_account(p_firm_id uuid, p_web_domain text, p_name text, p_state text, p_email text)
RETURNS TABLE (account_id uuid, created_at timestamptz, reasons text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.id, m.created_at, array_agg(DISTINCT m.reason ORDER BY m.reason)
  FROM (
    SELECT a.id, a.created_at, 'website'::text AS reason FROM public.accounts a
    WHERE public.is_matchable_web_domain(p_web_domain) AND a.firm_id = p_firm_id AND a.web_domain = p_web_domain
    UNION ALL
    SELECT a.id, a.created_at, 'name' FROM public.accounts a
    WHERE public.account_name_key(p_name) IS NOT NULL AND p_state IS NOT NULL AND a.firm_id = p_firm_id AND a.state = p_state
      AND public.account_name_key(a.name) = public.account_name_key(p_name)
    UNION ALL
    SELECT a.id, a.created_at, 'email' FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id AND a.firm_id = p_firm_id
    WHERE p_email IS NOT NULL AND c.firm_id = p_firm_id AND lower(c.email) = lower(p_email)
  ) m
  GROUP BY m.id, m.created_at
$$;

REVOKE ALL ON FUNCTION public.duplicates_of_account(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- The chain's own question, now answered by the one rule above: the firm's earliest account that may be the same business, or NULL. Same inputs, same answer as
-- before (20261119110000), so the chain at certification and the bringing-in of submissions are unchanged.
CREATE OR REPLACE FUNCTION public.find_duplicate_account(p_firm_id uuid, p_web_domain text, p_name text, p_state text, p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT d.account_id FROM public.duplicates_of_account(p_firm_id, p_web_domain, p_name, p_state, p_email) d ORDER BY d.created_at, d.account_id LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_duplicate_account(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- The firm's contacts whose email is the one given, ignoring case (D-193), with the account each is on. NULL or blank matches nothing. Found by contacts_email_idx.
CREATE FUNCTION public.duplicates_of_contact(p_firm_id uuid, p_email text)
RETURNS TABLE (contact_id uuid, account_id uuid, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.account_id, c.created_at
  FROM public.contacts c
  WHERE NULLIF(btrim(p_email), '') IS NOT NULL AND c.firm_id = p_firm_id AND lower(c.email) = lower(btrim(p_email))
$$;

REVOKE ALL ON FUNCTION public.duplicates_of_contact(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. Who to ask about a record the person may not see ----------
-- {kind: 'owner' | 'firm_owners', names: [...]}: the record's owner when they are a current member of the firm, else the firm's current owners (at most five, in name
-- order). Names only: no id, no email. Internal.
CREATE FUNCTION public.duplicate_who_to_ask(p_firm_id uuid, p_owner_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.firm_memberships m WHERE m.firm_id = p_firm_id AND m.user_id = p_owner_id AND public.membership_is_current(m.valid_from, m.valid_until))
      THEN jsonb_build_object('kind', 'owner', 'names', jsonb_build_array(public.crm_person_name(p_owner_id)))
    ELSE jsonb_build_object('kind', 'firm_owners', 'names', COALESCE((
      SELECT jsonb_agg(o.name ORDER BY lower(o.name COLLATE "und-x-icu"), o.name)
      FROM (
        SELECT public.crm_person_name(m.user_id) AS name
        FROM public.firm_memberships m
        WHERE m.firm_id = p_firm_id AND m.role = 'owner' AND public.membership_is_current(m.valid_from, m.valid_until)
        ORDER BY lower(public.crm_person_name(m.user_id) COLLATE "und-x-icu"), m.user_id
        LIMIT 5) o), '[]'::jsonb))
  END
$$;

REVOKE ALL ON FUNCTION public.duplicate_who_to_ask(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. The New account form ----------
-- {matches: [...], more: n}. At most five accounts the person may see, the earliest first (more says how many were left out), then one mask for the accounts they may
-- not see for each set of people to ask. An account counts only with the firm's own rule (D-193): so a name with no state, a free-mail domain or text that is not a
-- domain finds nothing. Blank input finds nothing. The firm is the caller's (a member of it: 42501).
CREATE FUNCTION public.duplicate_account_check(p_firm_id uuid, p_name text, p_website text, p_state text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  seen jsonb;
  more integer;
  masked jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  -- The visible ones, the earliest five.
  WITH found AS (
    SELECT a.*, d.reasons, row_number() OVER (ORDER BY a.created_at, a.id) AS n
    FROM public.duplicates_of_account(firm, public.web_domain_of(NULLIF(btrim(p_website), '')), NULLIF(btrim(p_name), ''), upper(NULLIF(btrim(p_state), '')), NULL) d
    JOIN public.accounts a ON a.id = d.account_id
    WHERE public.can_see_firm_record(a.firm_id, a.owner_id))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'kind', 'account', 'visible', true, 'id', f.id, 'name', f.name, 'archived', f.archived_at IS NOT NULL, 'reasons', to_jsonb(f.reasons),
      'owner', CASE WHEN f.owner_id IS NULL THEN NULL ELSE jsonb_build_object('id', f.owner_id, 'name', public.crm_person_name(f.owner_id)) END) ORDER BY f.n)
      FILTER (WHERE f.n <= 5), '[]'::jsonb),
    GREATEST(count(*) - 5, 0)
  INTO seen, more FROM found f;
  -- The ones the person may not see: one mask for each set of people to ask. Nothing of the record is read but whom to ask.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('kind', 'account', 'visible', false, 'ask', q.ask) ORDER BY q.first_at), '[]'::jsonb) INTO masked
  FROM (
    SELECT public.duplicate_who_to_ask(a.firm_id, a.owner_id) AS ask, min(a.created_at) AS first_at
    FROM public.duplicates_of_account(firm, public.web_domain_of(NULLIF(btrim(p_website), '')), NULLIF(btrim(p_name), ''), upper(NULLIF(btrim(p_state), '')), NULL) d
    JOIN public.accounts a ON a.id = d.account_id
    WHERE NOT public.can_see_firm_record(a.firm_id, a.owner_id)
    GROUP BY 1) q;
  RETURN jsonb_build_object('matches', seen || masked, 'more', more);
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_account_check(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_account_check(uuid, text, text, text) TO authenticated;

-- ---------- 4. The Add a contact form ----------
-- {matches: [...], more: n}, as above, for contacts with the email typed: at most five on accounts the person may see, then one mask for each set of people to ask
-- (a contact is seen as its account is, so the account's owner is who to ask). A contact on the very account the form is open on is a match too: it is the same
-- person twice. Blank input finds nothing.
CREATE FUNCTION public.duplicate_contact_check(p_firm_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  seen jsonb;
  more integer;
  masked jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  WITH found AS (
    SELECT c.id AS contact_id, c.first_name, c.last_name, c.owner_id AS contact_owner, a.id AS account_id, a.name AS account_name, a.archived_at,
      row_number() OVER (ORDER BY c.created_at, c.id) AS n
    FROM public.duplicates_of_contact(firm, p_email) d
    JOIN public.contacts c ON c.id = d.contact_id
    JOIN public.accounts a ON a.id = c.account_id
    WHERE public.can_see_firm_record(a.firm_id, a.owner_id))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'kind', 'contact', 'visible', true, 'id', f.contact_id, 'name', btrim(concat_ws(' ', f.first_name, f.last_name)), 'archived', f.archived_at IS NOT NULL,
      'reasons', jsonb_build_array('email'), 'account', jsonb_build_object('id', f.account_id, 'name', f.account_name),
      'owner', CASE WHEN f.contact_owner IS NULL THEN NULL ELSE jsonb_build_object('id', f.contact_owner, 'name', public.crm_person_name(f.contact_owner)) END) ORDER BY f.n)
      FILTER (WHERE f.n <= 5), '[]'::jsonb),
    GREATEST(count(*) - 5, 0)
  INTO seen, more FROM found f;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('kind', 'contact', 'visible', false, 'ask', q.ask) ORDER BY q.first_at), '[]'::jsonb) INTO masked
  FROM (
    SELECT public.duplicate_who_to_ask(a.firm_id, a.owner_id) AS ask, min(c.created_at) AS first_at
    FROM public.duplicates_of_contact(firm, p_email) d
    JOIN public.contacts c ON c.id = d.contact_id
    JOIN public.accounts a ON a.id = c.account_id
    WHERE NOT public.can_see_firm_record(a.firm_id, a.owner_id)
    GROUP BY 1) q;
  RETURN jsonb_build_object('matches', seen || masked, 'more', more);
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_contact_check(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_contact_check(uuid, text) TO authenticated;
