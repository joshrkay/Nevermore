-- The chain at the first certification (story CRM-Q1.1b; docs/BROKER_CRM_BUILD.md D-29, D-32, D-101, D-188, D-192, D-193, D-194, D-196, D-211, D-214,
-- D-219; GLOSSARY.md "The broker's CRM"; ADR 0006, 0023, 0024, 0025; 20261119100000_crm_records.sql, the tables this writes into).
--
-- What this is. An intake an employer started has no account, contact or opportunity while it is a draft (ADR 0025). The first time it is certified, in
-- the same transaction as the certification, this makes:
--   * the account, in the intake's firm (D-101), owned by nobody (D-214), its source Employer's intake (D-211), its empty fields filled from the
--     certified answers (D-196: legal name, address, website, states of operation, employees, industry, current provider; never the FEIN, the census or
--     anything about an employee, ADR 0006). When the duplicate match (D-193) finds an account of the firm that may be the same business, the new account
--     is still made, marked possible_duplicate_of the matched one: the employer is never asked and nothing is merged.
--   * the contact: the prospect's name, email and phone, copied once and linked to the prospect (D-194), the account's main contact (D-214).
--   * the opportunity, named for the start month and "PEO search" (D-188), holding the intake, owned by nobody, its main contact that contact.
-- Certifying again changes nothing about the chain. The same step run twice makes one chain: the opportunity's intake is unique (D-207, from the records'
-- migration) and the step looks for it first, so a second call, a second certification or a second session returns the chain that is there.
--
-- Where it hooks in. The certification is an update (or an insert) of chamber_sessions that sets status 'submitted' with a new certification
-- (validate_certification, record_certification). An AFTER trigger on the row makes the chain, so it runs inside that statement's transaction: a failure
-- here fails the certification and a submission is never left without its chain. It fires after record_certification (by name), so the certification
-- snapshot it reads is already written. The step itself is make_intake_chain(intake), which CRM-Q1.3 calls for the submissions that exist.
--
-- Closing and suspended firms. Certification is the employer's act, not a member's, so the chain does not ask the guards that stop a member
-- (assert_firm_writable, ADR 0023; refuse_support_session, ADR 0024: both do nothing for anyone who is not a member of the firm anyway). It is
-- written in whatever state the intake's firm is in: refusing would stop an employer from certifying, or leave a submission with no opportunity once
-- every submission needs one (CRM-Q1.3). A closing firm's chain is deleted with the rest when the closing ends (firm_closing_plan); a suspended firm's
-- members read nothing until the suspension is lifted, as for every other record (firm_role).
--
-- What is NOT here: the rule that every submission sits on an opportunity and bringing the existing submissions in (CRM-Q1.3); filling the account's
-- empty fields again on later certifications and "The intake says 23" (CRM-Q1.2); the duplicate warning while a person types (CRM-S4.2); merging
-- (CRM-S4.3); anything on screen.

-- ---------- 1. Pure helpers ----------
-- Whether a web domain (as web_domain_of gives it) is a free-mail provider's: many businesses share it, so it can never say two accounts are one business
-- (D-193). This is the list of the duplicate match. A twin, is_consumer_organisation (20261113100000), keeps a list for the sign-in organisations a firm may
-- allow: it answers another question and already differs (it has passport.com, which this lacks; this has aim.com, rocketmail.com, bellsouth.net, cox.net
-- and charter.net, which it lacks). The two are not kept in step. Pure.
CREATE FUNCTION public.is_free_mail_domain(p_domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  -- The listed domain or any subdomain of it (mail.gmail.com, login.yahoo.com).
  SELECT EXISTS (SELECT 1 FROM unnest(ARRAY[
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com', 'rocketmail.com', 'icloud.com',
    'me.com', 'mac.com', 'aol.com', 'aim.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'yandex.com',
    'fastmail.com', 'hey.com', 'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net', 'charter.net']) h
    WHERE lower(btrim(p_domain)) = h OR lower(btrim(p_domain)) LIKE '%.' || h)
$$;

REVOKE ALL ON FUNCTION public.is_free_mail_domain(text) FROM PUBLIC, anon, authenticated, service_role;

-- Whether a web domain is a site many businesses use as theirs (a Facebook page, a Google Sites page, a bare site-builder address): the same domain on two
-- accounts then says nothing about the business. A social site counts with every subdomain (m.facebook.com); a site builder only as the bare address,
-- because acme.wixsite.com is one business's own. Pure.
CREATE FUNCTION public.is_shared_web_host(p_domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(btrim(p_domain)) = ANY (ARRAY[
      'sites.google.com', 'wixsite.com', 'weebly.com', 'squarespace.com', 'godaddysites.com', 'business.site', 'github.io', 'wordpress.com', 'blogspot.com'])
    OR EXISTS (SELECT 1 FROM unnest(ARRAY[
      'facebook.com', 'fb.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'pinterest.com', 'yelp.com',
      'linktr.ee']) h WHERE lower(btrim(p_domain)) = h OR lower(btrim(p_domain)) LIKE '%.' || h)
$$;

REVOKE ALL ON FUNCTION public.is_shared_web_host(text) FROM PUBLIC, anon, authenticated, service_role;

-- Whether a web domain is one that says which business it is, so the duplicate match may use it: host-shaped (labels of letters, digits and hyphens with a dot
-- between, and a top-level domain of letters), not a free-mail domain and not a shared site. The website answer is free text ("N/A", "none", "-" reduce to
-- "n", "none", "-"), so a domain is never trusted for its shape alone. Pure.
CREATE FUNCTION public.is_matchable_web_domain(p_domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    lower(p_domain) ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
    AND lower(p_domain) ~ '\.([a-z]{2,}|xn--[a-z0-9-]+)$'
    AND NOT public.is_free_mail_domain(p_domain) AND NOT public.is_shared_web_host(p_domain), false)
$$;

REVOKE ALL ON FUNCTION public.is_matchable_web_domain(text) FROM PUBLIC, anon, authenticated, service_role;

-- The name the duplicate match compares (D-193): the last word dropped when it is a legal designator (LLC, Inc, Corp, Co, Ltd, LLP, PC or PLLC, with or
-- without its punctuation, and only when another word is left), and only then in lower case with letters and digits only. "Acme Co." and "Acme" are
-- one key; "Costco" and "Cost" are two. NULL when nothing is left. Pure.
CREATE FUNCTION public.account_name_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(regexp_replace(lower(
    CASE
      WHEN w.n ~ ' ' AND regexp_replace(lower(substring(w.n FROM '[^ ]+$')), '[^[:alnum:]]', '', 'g') IN ('llc', 'inc', 'corp', 'co', 'ltd', 'llp', 'pc', 'pllc')
        THEN substring(w.n FROM '^(.*) [^ ]+$')
      ELSE w.n
    END), '[^[:alnum:]]', '', 'g'), '')
  FROM (SELECT regexp_replace(regexp_replace(p_name, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g') AS n) w
$$;

REVOKE ALL ON FUNCTION public.account_name_key(text) FROM PUBLIC, anon, authenticated, service_role;

-- The duplicate match's name and state, found by an index.
CREATE INDEX accounts_name_key_idx ON public.accounts (firm_id, public.account_name_key(name), state) WHERE state IS NOT NULL;

-- One answer of an intake as text: a string, trimmed, at most p_max characters, NULL when it is not a string or is blank. Pure.
CREATE FUNCTION public.crm_answer_text(p_data jsonb, p_key text, p_max integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN jsonb_typeof(p_data -> p_key) = 'string' THEN left(NULLIF(btrim(p_data ->> p_key, E' \t\r\n'), ''), p_max) END
$$;

REVOKE ALL ON FUNCTION public.crm_answer_text(jsonb, text, integer) FROM PUBLIC, anon, authenticated, service_role;

-- A person's name as a first and a last name: the last word is the last name and the rest the first name, so "Jo Q Doe" is "Jo Q" and "Doe", and one
-- word is a last name alone (a contact needs one, the first is optional). NULL for a blank name. Pure.
CREATE FUNCTION public.crm_split_person_name(p_name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN w.n = '' THEN NULL
    WHEN w.n !~ ' ' THEN ARRAY[NULL, left(w.n, 100)]
    ELSE ARRAY[left(substring(w.n FROM '^(.*) [^ ]+$'), 100), left(substring(w.n FROM '[^ ]+$'), 100)]
  END
  FROM (SELECT regexp_replace(regexp_replace(COALESCE(p_name, ''), '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g') AS n) w
$$;

REVOKE ALL ON FUNCTION public.crm_split_person_name(text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The duplicate match ----------
-- The firm's earliest account that may be the same business as the one described (D-193), or NULL. Exact, never by likeness: the same web domain (never a
-- free-mail one, a shared site or free text), the same name and state by account_name_key (both must have a state), or a contact with the same email ignoring case. Reads every account
-- of the firm whoever may see it: a caller decides what to show. No API role can run it.
CREATE FUNCTION public.find_duplicate_account(p_firm_id uuid, p_web_domain text, p_name text, p_state text, p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- One query for each way to match, so each finds its rows by its own index (web_domain, the name key and state, a contact's lower-case email).
  SELECT m.id
  FROM (
    SELECT a.id, a.created_at FROM public.accounts a
    WHERE public.is_matchable_web_domain(p_web_domain) AND a.firm_id = p_firm_id AND a.web_domain = p_web_domain
    UNION ALL
    SELECT a.id, a.created_at FROM public.accounts a
    WHERE public.account_name_key(p_name) IS NOT NULL AND p_state IS NOT NULL AND a.firm_id = p_firm_id AND a.state = p_state
      AND public.account_name_key(a.name) = public.account_name_key(p_name)
    UNION ALL
    SELECT a.id, a.created_at FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id AND a.firm_id = p_firm_id
    WHERE p_email IS NOT NULL AND c.firm_id = p_firm_id AND lower(c.email) = lower(p_email)
  ) m
  ORDER BY m.created_at, m.id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_duplicate_account(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. The step ----------
-- Makes the chain of an intake that has been certified, or returns the one that is there. Answers {"made": true, "account_id", "contact_id" (null when the
-- prospect has neither a usable email nor a phone), "opportunity_id", "possible_duplicate_of" (null for none)}, or {"made": false, "account_id",
-- "opportunity_id"} for an intake that already sits on an opportunity, whoever made it, and {"made": false, "closed": true} for an intake of a closed firm. Refuses an intake that does not exist (P0002) and one that has
-- never been certified (55000): a draft has no chain (ADR 0025).
--
-- The values are the certified ones: the answers of the intake's latest certification (its snapshot), not the working copy. Ordering, D-29 and D-32:
-- the opportunity's intake is unique, which is what proves one chain. A chain that is already there is answered at once, without the lock (a
-- certification again must not queue behind a chain being made). Otherwise the firm's advisory lock is taken, the chain looked for again and only then
-- the match made, so two steps at once for the same intake find one chain, and two at once for the same business are matched against each other (the
-- second sees the first, which committed before the lock was released) instead of each missing the other. A conflict on the intake that the lock should
-- have made impossible fails the step and rolls the account back, so even without the lock no second chain is made.
CREATE FUNCTION public.make_intake_chain(p_intake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i public.chamber_sessions;
  cert record;
  prof record;
  existing public.opportunities;
  d jsonb;
  v_name text;
  v_name_certified boolean;
  v_website text;
  v_domain text;
  v_state text;
  v_street text;
  v_industry text;
  v_employees integer;
  v_states text[];
  v_provider text;
  v_start text;
  v_email text;
  v_phone text;
  v_names text[];
  v_dup uuid;
  v_account uuid;
  v_contact uuid;
  v_opportunity uuid;
BEGIN
  SELECT * INTO i FROM public.chamber_sessions WHERE id = p_intake_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The intake does not exist' USING ERRCODE = 'P0002';
  END IF;

  -- The chain that is there (a cheap look first: every update of a certified intake asks).
  SELECT * INTO existing FROM public.opportunities WHERE intake_id = p_intake_id;
  IF FOUND THEN
    RETURN jsonb_build_object('made', false, 'account_id', existing.account_id, 'opportunity_id', existing.id);
  END IF;

  SELECT c.chamber_data, c.signer_name INTO cert
  FROM public.chamber_certifications c WHERE c.session_id = p_intake_id ORDER BY c.version DESC, c.id DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The intake has never been certified, so it has no account, contact or opportunity' USING ERRCODE = '55000';
  END IF;
  d := cert.chamber_data;

  -- The prospect: the person who certified. Their profile's name and phone, their email (a signer's name when the profile has none).
  SELECT u.email::text AS email, p.contact_name, p.company_name, p.phone INTO prof
  FROM (SELECT 1) one LEFT JOIN auth.users u ON u.id = i.user_id LEFT JOIN public.profiles p ON p.user_id = i.user_id;

  -- The account's values, each as its column takes it. What a column would refuse is left out, never allowed to fail the certification.
  v_name := public.crm_answer_text(d, 'company_name', 200);
  v_name_certified := v_name IS NOT NULL;
  v_name := COALESCE(v_name, left(NULLIF(btrim(prof.company_name), ''), 200), 'Unnamed business');
  v_website := public.crm_answer_text(d, 'website', 300);
  v_domain := public.web_domain_of(v_website);
  v_state := CASE WHEN public.is_us_state_code(public.crm_answer_text(d, 'hq_state', 2)) THEN public.crm_answer_text(d, 'hq_state', 2) END;
  v_street := public.crm_answer_text(d, 'street_address', 200);
  v_industry := public.crm_answer_text(d, 'industry', 200);
  v_employees := CASE WHEN jsonb_typeof(d -> 'employee_count') = 'number' AND (d ->> 'employee_count') ~ '^[0-9]{1,9}$' THEN (d ->> 'employee_count')::integer END;
  v_states := CASE WHEN jsonb_typeof(d -> 'states') = 'array' THEN
    COALESCE((SELECT array_agg(s.state ORDER BY s.first_at)
              FROM (SELECT x.state, min(x.at) AS first_at
                    FROM (SELECT e.value #>> '{}' AS state, e.at FROM jsonb_array_elements(d -> 'states') WITH ORDINALITY AS e (value, at)
                          WHERE jsonb_typeof(e.value) = 'string') x
                    WHERE public.is_us_state_code(x.state) GROUP BY x.state) s), '{}') ELSE '{}' END;
  v_provider := CASE WHEN COALESCE((d ->> 'in_peo') <> 'false', true) THEN public.crm_answer_text(d, 'current_peo', 200) END;
  v_start := public.crm_answer_text(d, 'start_month', 100);

  -- The contact's values.
  v_email := CASE WHEN length(prof.email) <= 254 AND prof.email ~ '^[^@[:space:]]+@[^@[:space:]]+$' THEN prof.email END;
  v_phone := left(NULLIF(btrim(prof.phone), ''), 40);
  v_names := public.crm_split_person_name(COALESCE(NULLIF(btrim(prof.contact_name), ''), cert.signer_name));

  -- A closed firm holds no CRM records: closing deleted them and kept the intake, so a certification again must not bring the chain back. The firm's row is
  -- held FOR KEY SHARE first, which conflicts only with the closing's FOR UPDATE of that row (close_firm_now, D-122): a closing that is running is waited for,
  -- and the question is then asked of what it committed, so a chain is never written after the closing's delete pass. The employer's certification is not
  -- refused; it just has no chain. A firm that is closing and not yet closed still gets its chain, which its closing deletes with the rest. (This lock is
  -- taken before the firm's advisory lock below; the closing takes the row and no advisory lock, so the two cannot wait on each other.)
  PERFORM 1 FROM public.firms f WHERE f.id = i.firm_id FOR KEY SHARE;
  IF public.firm_is_closed(i.firm_id) THEN
    RETURN jsonb_build_object('made', false, 'closed', true);
  END IF;

  -- One chain at a time within a firm (see above), then the look again: another step may have made it while this one waited.
  PERFORM pg_advisory_xact_lock(hashtextextended('crm_chain:' || i.firm_id::text, 0));
  SELECT * INTO existing FROM public.opportunities WHERE intake_id = p_intake_id;
  IF FOUND THEN
    RETURN jsonb_build_object('made', false, 'account_id', existing.account_id, 'opportunity_id', existing.id);
  END IF;

  v_dup := public.find_duplicate_account(i.firm_id,
    v_domain,
    CASE WHEN v_name_certified THEN v_name END,
    v_state,
    v_email);

  INSERT INTO public.accounts (firm_id, owner_id, name, website, street, state, industry, employees, states_of_operation, current_provider, source, possible_duplicate_of)
  VALUES (i.firm_id, NULL, v_name, v_website, v_street, v_state, v_industry, v_employees, v_states, v_provider, 'employer_intake', v_dup)
  RETURNING id INTO v_account;

  IF v_names IS NOT NULL AND (v_email IS NOT NULL OR v_phone IS NOT NULL) THEN
    INSERT INTO public.contacts (firm_id, account_id, owner_id, first_name, last_name, email, phone, is_main, prospect_user_id)
    VALUES (i.firm_id, v_account, NULL, v_names[1], v_names[2], v_email, v_phone, true, i.user_id)
    RETURNING id INTO v_contact;
  END IF;

  INSERT INTO public.opportunities (firm_id, account_id, owner_id, intake_id, name, main_contact_id)
  VALUES (i.firm_id, v_account, NULL, p_intake_id, CASE WHEN v_start IS NULL THEN 'PEO search' ELSE v_start || ' PEO search' END, v_contact)
  ON CONFLICT (intake_id) DO NOTHING
  RETURNING id INTO v_opportunity;
  IF v_opportunity IS NULL THEN
    RAISE EXCEPTION 'Another step made this intake''s opportunity first' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object('made', true, 'account_id', v_account, 'contact_id', v_contact, 'opportunity_id', v_opportunity, 'possible_duplicate_of', v_dup);
END;
$$;

REVOKE ALL ON FUNCTION public.make_intake_chain(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. The hook ----------
-- After a certification (the same test validate_certification and record_certification use), inside its transaction.
CREATE FUNCTION public.chain_at_certification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'submitted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' OR NEW.submission IS DISTINCT FROM OLD.submission) THEN
    PERFORM public.make_intake_chain(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.chain_at_certification() FROM PUBLIC, anon, authenticated, service_role;

-- Named so that it fires after chamber_sessions_certification_record, which writes the certification this reads.
CREATE TRIGGER chamber_sessions_chain AFTER INSERT OR UPDATE ON public.chamber_sessions
  FOR EACH ROW WHEN (NEW.status = 'submitted') EXECUTE FUNCTION public.chain_at_certification();
