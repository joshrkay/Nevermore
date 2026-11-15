-- Search in the database (story CRM-S1.2b; docs/BROKER_CRM_BUILD.md D-24, D-28, D-33, D-43, D-44, D-185, D-186, D-187, D-206, D-214, D-219, D-226, D-227;
-- docs/BROKER_CRM_STORIES.md CRM-S1.2; GLOSSARY.md "The broker's CRM"; ADR 0006, 0016, 0023, 0024, 0025; 20261119100000_crm_records.sql,
-- 20261119130000_accounts_table_query.sql).
--
-- What this is. The two things the search box in the menu (CRM-S1.2a, a later story) asks the database:
--   1. search_records(firm, words): the accounts, contacts, opportunities and quotes of one firm that the person may see and whose own fields hold every
--      word typed, five of each kind (and whether there are more), found by name, business, email, phone, web domain, File ID and PEO;
--   2. a person's recent records, the last ones they opened, per person and per firm: note_recent_record(kind, id, firm) puts one at the top,
--      my_recent_records(firm, limit) lists them while the person may still see them.
--
-- What is searched, and what never is (ADR 0006; the privacy rule of the PRD: no search, report or export holds an intake's answers, a census, a FEIN or
-- anything about an employee).
--   * Only CRM records and the named fields, never an intake's answers. An account: its name, trade name, web domain and phone. A contact: its name,
--     email, phone and mobile. An opportunity: its name. A quote (D-185: a quote request): its PEO's name. An opportunity and a quote are also found by their
--     intake's File ID, a column of the intake that is not an answer; and a contact, an opportunity and a quote by the name, trade name, domain and phone of
--     their account (the "business"). Nothing reads chamber_sessions beyond its file_id and firm; no census, no FEIN, no answer, no email's body.
--   * Every word typed must be found (any order, any case), as a part of what a record holds ("contains"). A word that is an address ("www.acme.com",
--     "https://acme.com/about") also finds the domain "acme.com", and a word that is only digits and the marks of a telephone number also finds the phone
--     whatever its marks ("555-0142" finds "(503) 555-0142" and "5035550142"): one domain rule, public.web_domain_of (20261119100000), the accounts table
--     uses too. The words % and _ and \ are ordinary letters. Fewer than two characters, spaces not counted, find nothing (an empty answer, not an error).
--   * Leads are not built (CRM-L1.x); each adds its kind to this answer.
-- Who is found (CRM-S5.1, D-219): by the account's owner's level, as the accounts table does it: the owners the caller may see are asked once
-- (can_see_firm_record) and an account is kept when its owner is one of them; a contact, an opportunity and a quote are seen by whoever sees their account.
-- One firm at a time (ADR 0016): the firm named, or the caller's only firm at this address (firm_to_act_for); a person who belongs to none gets 42501, one
-- of two must name one. A support session reads at the firm's address as a member does (ADR 0024) and records nothing as recent (it is refused, PT423).
-- An archived account's records are found, after the live ones, and say so.
--
-- No SQL is built from what the browser sends (D-44): the words become values of fixed queries, never text of one.
-- Fast for a firm of thousands (the PRD's search target is under half a second): each kind is found through a trigram index that starts with the firm, so a
-- word that few records hold reads only those records of this firm, whoever else shares the tables (supabase/tests/search_everywhere.sql counts the rows
-- read). pg_trgm and btree_gin are contrib extensions of Supabase's `extensions` schema, as btree_gist is (20261116090000).
--
-- Recent records (D-43, D-214): `recent_records` is a table of the firm, one row per person, firm, kind and record, closed to the API roles (a person
-- reads their own through my_recent_records). Opening a record that is already there moves it to the top; only the last 20 of a person in a firm are kept.
-- Only a record the person may see is noted, so noting never says whether a record exists. Closing a firm deletes them (firm_closing_plan).
--
-- What is NOT here: the box and its screen (CRM-S1.2a); "see all" counts (the box passes the words to the Accounts table; a total here would read every
-- hit); leads; searching calls, notes and tasks (the story does not name them).

SET lock_timeout = '5s';

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS btree_gin WITH SCHEMA extensions;

-- ---------- 1. What each kind holds that a word can be found in ----------

-- A phone number's digits alone: "(503) 555-0142" is "5035550142". Pure.
CREATE FUNCTION public.search_digits(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT regexp_replace(COALESCE(p_text, ''), '[^0-9]', '', 'g')
$$;

REVOKE ALL ON FUNCTION public.search_digits(text) FROM PUBLIC, anon, authenticated, service_role;

-- What a search reads of an account, in lower case, one field to a line and the phone's digits last. The index and the query both call this, so they agree.
CREATE FUNCTION public.account_search_text(p_name text, p_trade_name text, p_web_domain text, p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(COALESCE(p_name, '') || E'\n' || COALESCE(p_trade_name, '') || E'\n' || COALESCE(p_web_domain, '') || E'\n' || COALESCE(p_phone, '')
               || E'\n' || public.search_digits(p_phone))
$$;

-- The same for a contact: its name, email, phone and mobile.
CREATE FUNCTION public.contact_search_text(p_first_name text, p_last_name text, p_email text, p_phone text, p_mobile text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, '') || E'\n' || COALESCE(p_email, '') || E'\n' || COALESCE(p_phone, '') || E'\n'
               || COALESCE(p_mobile, '') || E'\n' || public.search_digits(p_phone) || ' ' || public.search_digits(p_mobile))
$$;

-- Priced as the slow functions they are (they lower-case, join and strip each time), so the planner reads a firm's records through the trigram index rather
-- than calling them on every row of the firm.
ALTER FUNCTION public.account_search_text(text, text, text, text) COST 1000;
ALTER FUNCTION public.contact_search_text(text, text, text, text, text) COST 1000;

REVOKE ALL ON FUNCTION public.account_search_text(text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.contact_search_text(text, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The indexes: the firm first, then the words ----------
-- A word is found as a part of what a record holds, which a plain index cannot do. Each index leads with the firm, so a firm's search reads its own rows.
CREATE INDEX accounts_search_idx ON public.accounts
  USING gin (firm_id, (public.account_search_text(name, trade_name, web_domain, phone)) extensions.gin_trgm_ops);
CREATE INDEX contacts_search_idx ON public.contacts
  USING gin (firm_id, (public.contact_search_text(first_name, last_name, email, phone, mobile)) extensions.gin_trgm_ops);
CREATE INDEX opportunities_search_idx ON public.opportunities
  USING gin (firm_id, (lower(name)) extensions.gin_trgm_ops);
CREATE INDEX chamber_sessions_file_id_search_idx ON public.chamber_sessions
  USING gin (firm_id, (lower(file_id)) extensions.gin_trgm_ops) WHERE file_id IS NOT NULL;

-- ---------- 3. The words ----------

-- The words a person typed, as the values a search compares with, longest first (the longest is the one the index serves), at most six:
--   pat   the word as a part of a text, lower case, with % _ and \ taken literally (a LIKE pattern);
--   dom   when the word is an address, the domain in it (web_domain_of), as a pattern; else NULL. Not for a word with an @ (an email is not a domain);
--   dig   when the word is only digits and the marks of a telephone number and says more than its digits, its digits as a pattern; else NULL.
-- `first` is the first word typed, as a pattern for "starts with" (what a person typed first is the name they mean). Pure.
CREATE FUNCTION public.crm_search_terms(p_query text)
RETURNS TABLE (n integer, pat text, dom text, dig text, lead text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  WITH typed AS (
    SELECT lower(t.w) AS term, t.i
    FROM regexp_split_to_table(left(btrim(COALESCE(p_query, '')), 200), '\s+') WITH ORDINALITY AS t (w, i)
    WHERE t.w <> ''
  ), firsts AS (
    SELECT term, i FROM typed ORDER BY i LIMIT 6
  )
  SELECT (row_number() OVER (ORDER BY char_length(f.term) DESC, f.i))::integer,
         '%' || regexp_replace(f.term, '([\\%_])', '\\\1', 'g') || '%',
         CASE WHEN f.term !~ '@' AND public.web_domain_of(f.term) IS NOT NULL AND public.web_domain_of(f.term) <> f.term
              THEN '%' || regexp_replace(public.web_domain_of(f.term), '([\\%_])', '\\\1', 'g') || '%' END,
         CASE WHEN f.term ~ '^[0-9+().-]*[0-9][0-9+().-]*$' AND public.search_digits(f.term) <> f.term
              THEN '%' || public.search_digits(f.term) || '%' END,
         (SELECT regexp_replace(x.term, '([\\%_])', '\\\1', 'g') || '%' FROM firsts x ORDER BY x.i LIMIT 1)
  FROM firsts f
$$;

REVOKE ALL ON FUNCTION public.crm_search_terms(text) FROM PUBLIC, anon, authenticated, service_role;

-- Is every word found in the text? A word is found when the text holds it, or the domain in it, or its digits. The check the index's candidates pass. The text
-- of a contact is its own text and its account's, one line after the other: a word never holds a line break, so it is found in one of them or in neither. Pure.
CREATE FUNCTION public.crm_terms_found(p_text text, p_pats text[], p_doms text[], p_digs text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(p_pats, p_doms, p_digs) AS w (p, d, g)
    WHERE NOT (p_text LIKE w.p OR p_text LIKE w.d OR p_text LIKE w.g)
  )
$$;

REVOKE ALL ON FUNCTION public.crm_terms_found(text, text[], text[], text[]) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 4. Who is found: the owners the caller may see ----------
-- Reads as its owner, so the question is asked of each owner an account of the firm has (and of no owner), a few times and never for every account:
-- the same rule row security applies (supabase/tests/search_everywhere.sql compares the two). Internal.
CREATE FUNCTION public.crm_visible_owners(p_firm_id uuid, OUT owners uuid[], OUT unowned boolean)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  SELECT COALESCE(array_agg(o.owner_id) FILTER (WHERE o.owner_id IS NOT NULL), '{}'), COALESCE(bool_or(o.owner_id IS NULL), false)
  INTO owners, unowned
  FROM (SELECT DISTINCT a.owner_id FROM public.accounts a WHERE a.firm_id = p_firm_id OFFSET 0) o   -- OFFSET 0: asked of each owner, not pushed down to each account
  WHERE public.can_see_firm_record(p_firm_id, o.owner_id);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_visible_owners(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 5. One record as a search shows it ----------
-- A record by kind and id, in the firm, as the box shows it, or NULL when there is no such record in the firm or the owners given may not see it (the
-- answer for a record that is not there and one that is not theirs is the same). Never a field of an intake's answers: the File ID and the PEO are the
-- intake's reference and the quote request's own name. Internal.
CREATE FUNCTION public.crm_search_row(p_kind text, p_firm_id uuid, p_id text, p_owners uuid[], p_unowned boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  r jsonb;
  uid uuid;
BEGIN
  IF p_kind = 'quote' THEN
    IF p_id !~ '^[0-9]{1,18}$' THEN
      RETURN NULL;
    END IF;
    SELECT jsonb_build_object('kind', 'quote', 'id', q.id::text, 'peo_name', q.peo_name, 'status', q.status, 'file_id', s.file_id, 'submission_id', q.session_id,
                              'opportunity_id', o.id, 'opportunity_name', o.name, 'account_id', a.id, 'account_name', a.name, 'archived', a.archived_at IS NOT NULL)
    INTO r
    FROM public.quote_requests q
    JOIN public.opportunities o ON o.intake_id = q.session_id AND o.firm_id = p_firm_id
    JOIN public.accounts a ON a.id = o.account_id AND a.firm_id = p_firm_id
    LEFT JOIN public.chamber_sessions s ON s.id = q.session_id
    WHERE q.id = p_id::bigint AND (a.owner_id = ANY (p_owners) OR (a.owner_id IS NULL AND p_unowned));
    RETURN r;
  END IF;

  uid := public.record_history_key_uuid(p_id);
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_kind = 'account' THEN
    SELECT jsonb_build_object('kind', 'account', 'id', a.id::text, 'name', a.name, 'trade_name', a.trade_name, 'web_domain', a.web_domain, 'phone', a.phone,
                              'city', a.city, 'state', a.state, 'archived', a.archived_at IS NOT NULL)
    INTO r
    FROM public.accounts a
    WHERE a.id = uid AND a.firm_id = p_firm_id AND (a.owner_id = ANY (p_owners) OR (a.owner_id IS NULL AND p_unowned));
  ELSIF p_kind = 'contact' THEN
    SELECT jsonb_build_object('kind', 'contact', 'id', c.id::text, 'name', btrim(concat_ws(' ', c.first_name, c.last_name)), 'title', c.title, 'email', c.email,
                              'phone', COALESCE(NULLIF(btrim(c.phone), ''), NULLIF(btrim(c.mobile), '')),
                              'account_id', a.id, 'account_name', a.name, 'archived', a.archived_at IS NOT NULL)
    INTO r
    FROM public.contacts c
    JOIN public.accounts a ON a.id = c.account_id AND a.firm_id = p_firm_id
    WHERE c.id = uid AND c.firm_id = p_firm_id AND (a.owner_id = ANY (p_owners) OR (a.owner_id IS NULL AND p_unowned));
  ELSIF p_kind = 'opportunity' THEN
    SELECT jsonb_build_object('kind', 'opportunity', 'id', o.id::text, 'name', o.name, 'stage', public.opportunity_stage(o.id), 'file_id', s.file_id,
                              'submission_id', o.intake_id, 'account_id', a.id, 'account_name', a.name, 'archived', a.archived_at IS NOT NULL)
    INTO r
    FROM public.opportunities o
    JOIN public.accounts a ON a.id = o.account_id AND a.firm_id = p_firm_id
    LEFT JOIN public.chamber_sessions s ON s.id = o.intake_id
    WHERE o.id = uid AND o.firm_id = p_firm_id AND (a.owner_id = ANY (p_owners) OR (a.owner_id IS NULL AND p_unowned));
  END IF;
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_search_row(text, uuid, text, uuid[], boolean) FROM PUBLIC, anon, authenticated, service_role;

-- The opportunities a word is found on without their quotes' PEOs: by their own name, their account (the business), or their intake's File ID. The three
-- ways a quote is found through its opportunity too. `p_pats` are the patterns the index may serve. Internal.
CREATE FUNCTION public.crm_opportunity_hits(p_firm_id uuid, p_pats text[])
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT o.id FROM public.opportunities o WHERE o.firm_id = p_firm_id AND lower(o.name) LIKE ANY (p_pats)
  UNION
  SELECT o.id FROM public.accounts a JOIN public.opportunities o ON o.firm_id = a.firm_id AND o.account_id = a.id
  WHERE a.firm_id = p_firm_id AND public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone) LIKE ANY (p_pats)
  UNION
  SELECT o.id FROM public.chamber_sessions s JOIN public.opportunities o ON o.intake_id = s.id AND o.firm_id = s.firm_id
  WHERE s.firm_id = p_firm_id AND s.file_id IS NOT NULL AND lower(s.file_id) LIKE ANY (p_pats)
$$;

REVOKE ALL ON FUNCTION public.crm_opportunity_hits(uuid, text[]) FROM PUBLIC, anon, authenticated, service_role;

-- The quote requests whose PEO a word is found on, with the opportunity each sits on, found through the firm's own opportunities (a quote request has no firm
-- of its own: it sits on its intake, and the opportunity holds the intake, D-231), so a firm reads only its own however many quotes other firms hold. Internal.
CREATE FUNCTION public.crm_quote_hits(p_firm_id uuid, p_pats text[])
RETURNS TABLE (quote_id bigint, opportunity_id uuid)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT r.id, o.id
  FROM public.opportunities o
  CROSS JOIN LATERAL (SELECT q.id FROM public.quote_requests q WHERE q.session_id = o.intake_id AND lower(q.peo_name) LIKE ANY (p_pats) OFFSET 0) r
  WHERE o.firm_id = p_firm_id AND o.intake_id IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.crm_quote_hits(uuid, text[]) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 6. Search ----------
-- {query, accounts, contacts, opportunities, quotes}, each of the last four {rows: [at most five, each as crm_search_row shows it], more: whether
-- a sixth was found}. Nothing typed, or less than two characters, is four empty groups.
-- The patterns the index serves are the longest word's (or its domain's), and a phone-shaped word's digits: they hold every record that can match that
-- word, and crm_terms_found then asks every word of what the index found.
CREATE FUNCTION public.search_records(p_firm_id uuid, p_query text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  q text := left(btrim(COALESCE(p_query, '')), 200);
  pats text[];
  doms text[];
  digs text[];
  lead text;
  c0s text[];
  plain boolean;
  grp text[];
  k integer;
  seen bigint;
  least bigint;
  owners uuid[];
  unowned boolean;
  acc text[] := '{}';
  con text[] := '{}';
  opp text[] := '{}';
  qts text[] := '{}';
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF char_length(regexp_replace(q, '\s', '', 'g')) >= 2 THEN
    SELECT array_agg(t.pat ORDER BY t.n), array_agg(t.dom ORDER BY t.n), array_agg(t.dig ORDER BY t.n), max(t.lead)
    INTO pats, doms, digs, lead
    FROM public.crm_search_terms(q) t;
  END IF;
  IF pats IS NOT NULL THEN
    SELECT v.owners, v.unowned INTO owners, unowned FROM public.crm_visible_owners(firm) v;
    -- When no word is an address or a phone's digits, a record holds every word exactly when its text matches every pattern: the plain, fast check.
    plain := NOT EXISTS (SELECT 1 FROM unnest(doms, digs) AS u (d, g) WHERE u.d IS NOT NULL OR u.g IS NOT NULL);
    -- The patterns the index serves: those of the word that the firm's records hold least often (any one word will do for correctness, since a record that holds
    -- every word holds that one; the rarest reads the fewest). Each word is counted over the firm's accounts, contacts and opportunities, up to 300 each, through
    -- the same indexes; the longest word wins a tie. A word's patterns: its domain when it is an address (a part of the word, so a text that holds the word holds
    -- it), else the word; and its digits.
    FOR k IN 1..cardinality(pats) LOOP
      grp := ARRAY(SELECT x FROM unnest(ARRAY[COALESCE(doms[k], pats[k]), digs[k]]) AS x WHERE x IS NOT NULL);
      seen := (SELECT count(*) FROM (SELECT 1 FROM public.accounts a WHERE a.firm_id = firm
                                       AND public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone) LIKE ANY (grp) LIMIT 300) z)
            + (SELECT count(*) FROM (SELECT 1 FROM public.contacts c WHERE c.firm_id = firm
                                       AND public.contact_search_text(c.first_name, c.last_name, c.email, c.phone, c.mobile) LIKE ANY (grp) LIMIT 300) z)
            + (SELECT count(*) FROM (SELECT 1 FROM public.opportunities o WHERE o.firm_id = firm AND lower(o.name) LIKE ANY (grp) LIMIT 300) z);
      IF c0s IS NULL OR seen < least THEN
        c0s := grp;
        least := seen;
      END IF;
      EXIT WHEN least = 0;
    END LOOP;

    acc := ARRAY(
      SELECT a.id::text
      FROM public.accounts a
      WHERE a.firm_id = firm
        AND (a.owner_id = ANY (owners) OR (a.owner_id IS NULL AND unowned))
        AND public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone) LIKE ANY (c0s)
        AND CASE WHEN plain THEN public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone) LIKE ALL (pats)
                 ELSE public.crm_terms_found(public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone), pats, doms, digs) END
      ORDER BY (a.archived_at IS NOT NULL), (lower(a.name) NOT LIKE lead), lower(a.name) COLLATE "und-x-icu", a.id
      LIMIT 6);

    -- Each of the next three finds its candidates first, from the index, then looks at each by its key (a LATERAL that is not pulled up: OFFSET 0), so a
    -- few candidates cost a few lookups, never a join of whole tables.
    con := ARRAY(
      WITH hit AS (
        SELECT c.id FROM public.contacts c
        WHERE c.firm_id = firm AND public.contact_search_text(c.first_name, c.last_name, c.email, c.phone, c.mobile) LIKE ANY (c0s)
        UNION
        SELECT c.id FROM public.accounts a JOIN public.contacts c ON c.firm_id = a.firm_id AND c.account_id = a.id
        WHERE a.firm_id = firm AND public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone) LIKE ANY (c0s)
      )
      SELECT x.id
      FROM hit h CROSS JOIN LATERAL (
        SELECT c.id::text AS id, (a.archived_at IS NOT NULL) AS archived,
               (lower(btrim(concat_ws(' ', c.first_name, c.last_name))) NOT LIKE lead AND lower(c.last_name) NOT LIKE lead) AS not_lead,
               lower(c.last_name) AS last_name, lower(COALESCE(c.first_name, '')) AS first_name, c.id AS key
        FROM public.contacts c JOIN public.accounts a ON a.id = c.account_id
        WHERE c.id = h.id AND (a.owner_id = ANY (owners) OR (a.owner_id IS NULL AND unowned))
          AND CASE WHEN plain THEN (public.contact_search_text(c.first_name, c.last_name, c.email, c.phone, c.mobile) || E'\n'
                                    || public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone)) LIKE ALL (pats)
                   ELSE public.crm_terms_found(public.contact_search_text(c.first_name, c.last_name, c.email, c.phone, c.mobile) || E'\n'
                                               || public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone), pats, doms, digs) END
        OFFSET 0) x
      ORDER BY x.archived, x.not_lead, x.last_name COLLATE "und-x-icu", x.first_name COLLATE "und-x-icu", x.key
      LIMIT 6);

    opp := ARRAY(
      WITH hit AS (
        SELECT h.id FROM public.crm_opportunity_hits(firm, c0s) h
        UNION
        SELECT h.opportunity_id FROM public.crm_quote_hits(firm, c0s) h
      )
      SELECT x.id
      FROM hit h CROSS JOIN LATERAL (
        SELECT o.id::text AS id, (a.archived_at IS NOT NULL) AS archived, (lower(o.name) NOT LIKE lead) AS not_lead, o.created_at, o.id AS key
        FROM public.opportunities o JOIN public.accounts a ON a.id = o.account_id
        LEFT JOIN public.chamber_sessions s ON s.id = o.intake_id
        LEFT JOIN LATERAL (SELECT lower(string_agg(r.peo_name, E'\n')) AS t FROM public.quote_requests r WHERE r.session_id = o.intake_id) pq ON true
        WHERE o.id = h.id AND (a.owner_id = ANY (owners) OR (a.owner_id IS NULL AND unowned))
          AND CASE WHEN plain THEN (lower(o.name) || E'\n' || COALESCE(lower(s.file_id), '') || E'\n' || COALESCE(pq.t, '') || E'\n'
                                    || public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone)) LIKE ALL (pats)
                   ELSE public.crm_terms_found(lower(o.name) || E'\n' || COALESCE(lower(s.file_id), '') || E'\n' || COALESCE(pq.t, '') || E'\n'
                                               || public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone), pats, doms, digs) END
        OFFSET 0) x
      ORDER BY x.archived, x.not_lead, x.created_at DESC, x.key
      LIMIT 6);

    qts := ARRAY(
      WITH hit AS (
        SELECT h.quote_id AS id FROM public.crm_quote_hits(firm, c0s) h
        UNION
        SELECT r.id FROM public.crm_opportunity_hits(firm, c0s) h
        CROSS JOIN LATERAL (SELECT q.id FROM public.opportunities o JOIN public.quote_requests q ON q.session_id = o.intake_id WHERE o.id = h.id OFFSET 0) r
      )
      SELECT x.id
      FROM hit h CROSS JOIN LATERAL (
        SELECT r.id::text AS id, (a.archived_at IS NOT NULL) AS archived, (lower(r.peo_name) NOT LIKE lead) AS not_lead, r.id AS key
        FROM public.quote_requests r
        JOIN public.opportunities o ON o.intake_id = r.session_id AND o.firm_id = firm
        JOIN public.accounts a ON a.id = o.account_id
        LEFT JOIN public.chamber_sessions s ON s.id = r.session_id
        WHERE r.id = h.id AND (a.owner_id = ANY (owners) OR (a.owner_id IS NULL AND unowned))
          AND CASE WHEN plain THEN (lower(r.peo_name) || E'\n' || COALESCE(lower(s.file_id), '') || E'\n' || lower(o.name) || E'\n'
                                    || public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone)) LIKE ALL (pats)
                   ELSE public.crm_terms_found(lower(r.peo_name) || E'\n' || COALESCE(lower(s.file_id), '') || E'\n' || lower(o.name) || E'\n'
                                               || public.account_search_text(a.name, a.trade_name, a.web_domain, a.phone), pats, doms, digs) END
        OFFSET 0) x
      ORDER BY x.archived, x.not_lead, x.key DESC
      LIMIT 6);
  END IF;

  RETURN jsonb_build_object(
    'query', q,
    'accounts', jsonb_build_object(
      'rows', COALESCE((SELECT jsonb_agg(public.crm_search_row('account', firm, u.id, owners, unowned) ORDER BY u.n) FROM unnest(acc[1:5]) WITH ORDINALITY u (id, n)), '[]'::jsonb),
      'more', cardinality(acc) > 5),
    'contacts', jsonb_build_object(
      'rows', COALESCE((SELECT jsonb_agg(public.crm_search_row('contact', firm, u.id, owners, unowned) ORDER BY u.n) FROM unnest(con[1:5]) WITH ORDINALITY u (id, n)), '[]'::jsonb),
      'more', cardinality(con) > 5),
    'opportunities', jsonb_build_object(
      'rows', COALESCE((SELECT jsonb_agg(public.crm_search_row('opportunity', firm, u.id, owners, unowned) ORDER BY u.n) FROM unnest(opp[1:5]) WITH ORDINALITY u (id, n)), '[]'::jsonb),
      'more', cardinality(opp) > 5),
    'quotes', jsonb_build_object(
      'rows', COALESCE((SELECT jsonb_agg(public.crm_search_row('quote', firm, u.id, owners, unowned) ORDER BY u.n) FROM unnest(qts[1:5]) WITH ORDINALITY u (id, n)), '[]'::jsonb),
      'more', cardinality(qts) > 5));
END;
$$;

REVOKE ALL ON FUNCTION public.search_records(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_records(uuid, text) TO authenticated;

-- ---------- 7. Each person's recent records ----------
CREATE TABLE public.recent_records (
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CONSTRAINT recent_records_kind_check CHECK (kind IN ('account', 'contact', 'opportunity', 'quote')),
  -- An account's, contact's or opportunity's id, or a quote request's number: the record's own key as text (no foreign key: four kinds, and a record that
  -- is gone or no longer seen is simply not shown).
  record_id text NOT NULL CONSTRAINT recent_records_record_id_check CHECK (
    CASE WHEN kind = 'quote' THEN record_id ~ '^[0-9]{1,18}$' ELSE record_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' END),
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (firm_id, user_id, kind, record_id)
);

-- A person's last ones in a firm, newest first, and the cap's pruning.
CREATE INDEX recent_records_person_idx ON public.recent_records (firm_id, user_id, opened_at DESC);

ALTER TABLE public.recent_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recent_records FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.recent_records TO service_role;

COMMENT ON TABLE public.recent_records IS 'The last records a person opened in a firm (at most 20 each), for the search box''s "last five opened". Closed to the API roles: note_recent_record writes, my_recent_records reads.';

-- A record the person has just opened goes to the top of their list for the firm. Only a record in this firm that the person may see is noted (the
-- answer false is the same for one that is not there), so noting says nothing of what the person may not see. Refused as every write is for a closing firm
-- and a support session, PT423 (ADR 0023, ADR 0024): Nevermore support records nothing. Only the last 20 of the person in the firm are kept.
CREATE FUNCTION public.note_recent_record(p_kind text, p_id text, p_firm_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  me uuid := auth.uid();
  owners uuid[];
  unowned boolean;
  id text := btrim(COALESCE(p_id, ''));
  bad boolean;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_kind IS NULL OR p_kind NOT IN ('account', 'contact', 'opportunity', 'quote') THEN
    RAISE EXCEPTION 'A recent record is an account, a contact, an opportunity or a quote' USING ERRCODE = '22023';
  END IF;
  bad := CASE WHEN p_kind = 'quote' THEN id !~ '^[0-9]{1,18}$' ELSE public.record_history_key_uuid(id) IS NULL END;
  IF bad THEN
    RAISE EXCEPTION 'That is not the number of a record' USING ERRCODE = '22023';
  END IF;
  SELECT v.owners, v.unowned INTO owners, unowned FROM public.crm_visible_owners(firm) v;
  IF public.crm_search_row(p_kind, firm, id, owners, unowned) IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.recent_records (firm_id, user_id, kind, record_id, opened_at)
  VALUES (firm, me, p_kind, id, clock_timestamp())
  ON CONFLICT (firm_id, user_id, kind, record_id) DO UPDATE SET opened_at = EXCLUDED.opened_at;
  DELETE FROM public.recent_records r
  WHERE r.firm_id = firm AND r.user_id = me
    AND (r.kind, r.record_id) NOT IN (
      SELECT k.kind, k.record_id FROM public.recent_records k WHERE k.firm_id = firm AND k.user_id = me ORDER BY k.opened_at DESC, k.kind, k.record_id LIMIT 20);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.note_recent_record(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.note_recent_record(text, text, uuid) TO authenticated;

-- The person's recent records in the firm, newest first, as the box shows them (each as crm_search_row shows a record, with `opened_at`), at most `p_limit`
-- (1 to 20; five is the box's). A record shows only while the person may still see it: one that was deleted, or whose account's owner changed, is passed
-- over for the next. A support session has none.
CREATE FUNCTION public.my_recent_records(p_firm_id uuid DEFAULT NULL, p_limit integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  owners uuid[];
  unowned boolean;
  rows jsonb := '[]'::jsonb;
  r record;
  one jsonb;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Recent records come 1 to 20 at a time' USING ERRCODE = '22023';
  END IF;
  SELECT v.owners, v.unowned INTO owners, unowned FROM public.crm_visible_owners(firm) v;
  FOR r IN SELECT x.kind, x.record_id, x.opened_at FROM public.recent_records x WHERE x.firm_id = firm AND x.user_id = auth.uid() ORDER BY x.opened_at DESC, x.kind, x.record_id LOOP
    one := public.crm_search_row(r.kind, firm, r.record_id, owners, unowned);
    IF one IS NOT NULL THEN
      rows := rows || jsonb_build_array(one || jsonb_build_object('opened_at', r.opened_at));
      EXIT WHEN jsonb_array_length(rows) >= p_limit;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('rows', rows);
END;
$$;

REVOKE ALL ON FUNCTION public.my_recent_records(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_recent_records(uuid, integer) TO authenticated;

-- ---------- 8. Closing a firm deletes them ----------
-- The closing's one list (20261119100000, restated in 20261119180000), restated with every line it had and the recent records before the records they name.
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
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (58, 'public.activities', 'delete', 'firm_id', 'calls, notes and tasks on the firm''s accounts and contacts; before the opportunities, contacts and accounts they stand on'),
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
