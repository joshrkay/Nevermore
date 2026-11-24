-- What a firm needs before it can send (docs/BROKER_READINESS_PRD.md slice A; docs/BROKER_CRM_BUILD.md "## Sendable", D-2100 to D-2119;
-- supabase/tests/sendable.sql). Three things, none of which replaces a table (ADR 0007):
--   1. A firm's own contacts at a PEO or carrier (BR-1.3): the people it deals with there, seen by no other firm, offered first when it sends.
--   2. A firm asking for a PEO or carrier that isn't listed (BR-1.4), which a platform admin answers.
--   3. The firm's producer number and licences on record (BR-2.2), which a platform admin reads and records as checked, and which a send to a carrier
--      needs (ADR 0029: a workers' comp search needs a property and casualty licence; D-21).

SET lock_timeout = '5s';

-- ---------- 1. A firm's own contacts at a market ----------
-- Closed to the API: a member reads their firm's through firm_market_contacts_list and the composer's read, and writes through the two functions below.
-- A contact is someone a send can go to, so it has an email address; otherwise it is held to the rules of a profile's contact (peo_contact_error).
CREATE TABLE public.firm_market_contacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  peo_id bigint NOT NULL REFERENCES public.peos (id),
  name text NOT NULL,
  role text,
  email text NOT NULL CHECK (email = lower(email)),
  phone text,
  added_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT firm_market_contacts_shape_check CHECK (public.peo_contact_error(name, role, email, phone) IS NULL)
);
ALTER TABLE public.firm_market_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_market_contacts FROM PUBLIC, anon, authenticated;
-- One address once for a firm at a market; the list a send reads is in the order added.
CREATE UNIQUE INDEX firm_market_contacts_once ON public.firm_market_contacts (firm_id, peo_id, email);

CREATE FUNCTION public.add_firm_market_contact(p_firm_id uuid, p_peo_id bigint, p_name text, p_role text, p_email text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- sync:begin firm_market_contact_cap
  max_contacts constant integer := 10;
  -- sync:end firm_market_contact_cap
  firm uuid;
  market public.peos;
  clean_name text := btrim(COALESCE(p_name, ''));
  clean_role text := NULLIF(btrim(COALESCE(p_role, '')), '');
  clean_email text := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  clean_phone text := NULLIF(btrim(COALESCE(p_phone, '')), '');
  problem text;
  made public.firm_market_contacts;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  -- A market taken off the list is offered to nobody (ADR 0010), so nobody adds a contact at it; one answer for it and for one that isn't there.
  SELECT * INTO market FROM public.peos p WHERE p.id = p_peo_id AND p.listed;
  IF market.id IS NULL THEN
    RAISE EXCEPTION 'That PEO or carrier isn''t on the list' USING ERRCODE = '22023';
  END IF;
  problem := public.peo_contact_error(clean_name, clean_role, clean_email, clean_phone);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem USING ERRCODE = '22023';
  END IF;
  IF clean_email IS NULL THEN
    RAISE EXCEPTION 'A contact you send to has an email address' USING ERRCODE = '22023';
  END IF;
  -- The firm's row is locked by assert_firm_writable for a member, so two adds at once count each other.
  IF EXISTS (SELECT 1 FROM public.firm_market_contacts c WHERE c.firm_id = firm AND c.peo_id = market.id AND c.email = clean_email) THEN
    RAISE EXCEPTION '% is already one of your firm''s contacts at %', clean_email, market.name USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.firm_market_contacts c WHERE c.firm_id = firm AND c.peo_id = market.id) >= max_contacts THEN
    RAISE EXCEPTION 'Your firm keeps at most % contacts at %. Remove one to add another.', max_contacts, market.name USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.firm_market_contacts (firm_id, peo_id, name, role, email, phone, added_by)
    VALUES (firm, market.id, clean_name, clean_role, clean_email, clean_phone, auth.uid())
    RETURNING * INTO made;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION '% is already one of your firm''s contacts at %', clean_email, market.name USING ERRCODE = '22023';
  END;
  RETURN jsonb_build_object('id', made.id, 'peo_id', made.peo_id, 'name', made.name, 'role', made.role, 'email', made.email, 'phone', made.phone);
END;
$$;

REVOKE ALL ON FUNCTION public.add_firm_market_contact(uuid, bigint, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_firm_market_contact(uuid, bigint, text, text, text, text) TO authenticated;

-- Any member removes one of their firm's; one answer (PT404) for a contact that isn't there and for another firm's.
CREATE FUNCTION public.remove_firm_market_contact(p_firm_id uuid, p_contact_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  DELETE FROM public.firm_market_contacts c WHERE c.id = p_contact_id AND c.firm_id = firm;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That contact isn''t available' USING ERRCODE = 'PT404';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_firm_market_contact(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_firm_market_contact(uuid, bigint) TO authenticated;

-- The firm's contacts at every market, by market and then in the order added. Every member of the firm reads all of them: a contact is the firm's.
CREATE FUNCTION public.firm_market_contacts_list(p_firm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', c.id, 'peo_id', c.peo_id, 'peo_name', p.name, 'name', c.name, 'role', c.role, 'email', c.email, 'phone', c.phone,
                                        'added_by', public.crm_person_name(c.added_by), 'created_at', c.created_at)
                     ORDER BY lower(p.name), c.id)
    FROM public.firm_market_contacts c JOIN public.peos p ON p.id = c.peo_id
    WHERE c.firm_id = firm), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.firm_market_contacts_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_market_contacts_list(uuid) TO authenticated;

-- What the composer reads, restated from its only definition (20261122140000_peo_send.sql) with every line kept. The contacts are now the firm's own at
-- that market first, in the order added, then the people with an email on the market's profile in use; an address the firm keeps is offered once, as the
-- firm names it. Each says whether it is the firm's own. The firm is the intake's, which the caller was just held to.
CREATE OR REPLACE FUNCTION public.peo_send_context(p_session_id uuid, p_peo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  peo text := btrim(COALESCE(p_peo, ''));
  address text;
  firm uuid;
BEGIN
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');
  SELECT b.address INTO address FROM public.broker_mailboxes b WHERE b.user_id = auth.uid();
  SELECT s.firm_id INTO firm FROM public.chamber_sessions s WHERE s.id = p_session_id;
  RETURN jsonb_build_object(
    'mailbox', jsonb_build_object('connected', address IS NOT NULL, 'address', address),
    'contacts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', x.name, 'role', x.role, 'email', x.email, 'own', x.own) ORDER BY x.own DESC, x.pos)
      FROM (
        SELECT fc.name, fc.role, fc.email, true AS own, fc.id AS pos
        FROM public.firm_market_contacts fc JOIN public.peos p ON p.id = fc.peo_id
        WHERE fc.firm_id = firm AND lower(p.name) = lower(peo)
        UNION ALL
        SELECT c.name, c.role, c.email, false, c.position
        FROM public.peo_contacts c
        WHERE c.email IS NOT NULL AND c.profile_version_id = (
          SELECT v.id FROM public.peo_profile_versions v JOIN public.peos p ON p.id = v.peo_id
          WHERE lower(p.name) = lower(peo) AND v.status = 'published' ORDER BY v.version DESC LIMIT 1)
          AND NOT EXISTS (
            SELECT 1 FROM public.firm_market_contacts fc JOIN public.peos p ON p.id = fc.peo_id
            WHERE fc.firm_id = firm AND lower(p.name) = lower(peo) AND fc.email = lower(c.email))) x), '[]'::jsonb),
    'reply_address', (
      SELECT a.local_part FROM public.quote_request_addresses a JOIN public.quote_requests q ON q.id = a.quote_request_id
      WHERE q.session_id = p_session_id AND lower(q.peo_name) = lower(peo) AND a.revoked_at IS NULL ORDER BY a.issued_at DESC LIMIT 1));
END;
$$;

-- ---------- 2. Asking for a market that isn't listed ----------
-- Closed to the API. A request is one firm's ask for one market of one line; it is open until a platform admin answers it, once: listed, naming the
-- market it now is, or declined, in words.
CREATE TABLE public.market_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  requested_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  -- As long as a market's own name (peos_name_check).
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 80),
  line text NOT NULL CHECK (line = ANY (public.quote_lines())),
  contact_name text CHECK (contact_name IS NULL OR char_length(contact_name) BETWEEN 1 AND 200),
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  note text CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'listed', 'declined')),
  answer text CHECK (answer IS NULL OR char_length(answer) BETWEEN 1 AND 500),
  answered_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  answered_at timestamptz,
  peo_id bigint REFERENCES public.peos (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_requests_answered_check CHECK ((status = 'open') = (answered_at IS NULL)),
  CONSTRAINT market_requests_listed_check CHECK ((status = 'listed') = (peo_id IS NOT NULL))
);
ALTER TABLE public.market_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_requests FROM PUBLIC, anon, authenticated;
-- One open ask for a market of a line by a firm.
CREATE UNIQUE INDEX market_requests_one_open ON public.market_requests (firm_id, lower(name), line) WHERE status = 'open';
CREATE INDEX market_requests_firm_idx ON public.market_requests (firm_id, id DESC);

CREATE FUNCTION public.request_market(p_firm_id uuid, p_name text, p_line text, p_contact_name text, p_contact_email text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_open constant integer := 20;
  firm uuid;
  clean_name text := btrim(COALESCE(p_name, ''));
  clean_contact text := NULLIF(btrim(COALESCE(p_contact_name, '')), '');
  clean_email text := NULLIF(lower(btrim(COALESCE(p_contact_email, ''))), '');
  clean_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  listed_name text;
  open_name text;
  made public.market_requests;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF char_length(clean_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Name the PEO or carrier, in 1 to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF p_line IS NULL OR NOT (p_line = ANY (public.quote_lines())) THEN
    RAISE EXCEPTION 'Say whether it quotes PEO or workers'' comp' USING ERRCODE = '22023';
  END IF;
  IF char_length(clean_contact) > 200 THEN
    RAISE EXCEPTION 'Their name is up to 200 characters' USING ERRCODE = '22023';
  END IF;
  IF clean_email IS NOT NULL AND (char_length(clean_email) > 254 OR clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Their email must be an email address' USING ERRCODE = '22023';
  END IF;
  IF char_length(clean_note) > 1000 THEN
    RAISE EXCEPTION 'A note is up to 1000 characters' USING ERRCODE = '22023';
  END IF;
  SELECT p.name INTO listed_name FROM public.peos p WHERE lower(p.name) = lower(clean_name) AND p.line = p_line AND p.listed LIMIT 1;
  IF listed_name IS NOT NULL THEN
    RAISE EXCEPTION '% is already listed', listed_name USING ERRCODE = '22023';
  END IF;
  SELECT r.name INTO open_name FROM public.market_requests r WHERE r.firm_id = firm AND lower(r.name) = lower(clean_name) AND r.line = p_line AND r.status = 'open';
  IF open_name IS NOT NULL THEN
    RAISE EXCEPTION 'Your firm has already asked for %', open_name USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.market_requests r WHERE r.firm_id = firm AND r.status = 'open') >= max_open THEN
    RAISE EXCEPTION 'Your firm has % requests waiting for an answer. Wait for one before asking for another.', max_open USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.market_requests (firm_id, requested_by, name, line, contact_name, contact_email, note)
    VALUES (firm, auth.uid(), clean_name, p_line, clean_contact, clean_email, clean_note)
    RETURNING * INTO made;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Your firm has already asked for %', clean_name USING ERRCODE = '22023';
  END;
  RETURN jsonb_build_object('id', made.id, 'name', made.name, 'line', made.line, 'status', made.status);
END;
$$;

REVOKE ALL ON FUNCTION public.request_market(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_market(uuid, text, text, text, text, text) TO authenticated;

-- The firm's own requests, newest first, each with its answer when it has one.
CREATE FUNCTION public.firm_market_requests(p_firm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'line', r.line, 'contact_name', r.contact_name, 'contact_email', r.contact_email, 'note', r.note,
                                        'status', r.status, 'answer', r.answer, 'answered_at', r.answered_at, 'peo_id', r.peo_id,
                                        'requested_by', public.crm_person_name(r.requested_by), 'created_at', r.created_at)
                     ORDER BY r.id DESC)
    FROM public.market_requests r WHERE r.firm_id = firm), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.firm_market_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_market_requests(uuid) TO authenticated;

-- Every firm's requests for a platform admin, the open ones first and oldest first among them, then the answered, newest first; each with its firm's name.
CREATE FUNCTION public.admin_market_requests()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', r.id, 'firm_id', r.firm_id, 'firm_name', f.name, 'name', r.name, 'line', r.line, 'contact_name', r.contact_name,
                                        'contact_email', r.contact_email, 'note', r.note, 'status', r.status, 'answer', r.answer, 'answered_at', r.answered_at,
                                        'peo_id', r.peo_id, 'created_at', r.created_at)
                     ORDER BY (r.status = 'open') DESC, CASE WHEN r.status = 'open' THEN r.id END, r.id DESC)
    FROM public.market_requests r JOIN public.firms f ON f.id = r.firm_id), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_market_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_market_requests() TO authenticated;

-- A platform admin's one answer. Listed names the market the request now is: on the list, and of the request's line. Declined says why.
CREATE FUNCTION public.admin_answer_market_request(p_request_id bigint, p_listed boolean, p_answer text, p_peo_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.market_requests;
  words text := NULLIF(btrim(COALESCE(p_answer, '')), '');
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.market_requests x WHERE x.id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That request isn''t there' USING ERRCODE = 'PT404';
  END IF;
  IF r.status <> 'open' THEN
    RAISE EXCEPTION 'That request has been answered already' USING ERRCODE = '55000';
  END IF;
  IF p_listed IS NULL THEN
    RAISE EXCEPTION 'Say whether it is listed now or not' USING ERRCODE = '22023';
  END IF;
  IF char_length(words) > 500 OR (NOT p_listed AND words IS NULL) THEN
    RAISE EXCEPTION 'Say why, in up to 500 characters' USING ERRCODE = '22023';
  END IF;
  IF p_listed AND NOT EXISTS (SELECT 1 FROM public.peos p WHERE p.id = p_peo_id AND p.listed AND p.line = r.line) THEN
    RAISE EXCEPTION 'Say which listed PEO or carrier this request is now' USING ERRCODE = '22023';
  END IF;
  UPDATE public.market_requests
  SET status = CASE WHEN p_listed THEN 'listed' ELSE 'declined' END, answer = words, answered_by = auth.uid(), answered_at = now(),
      peo_id = CASE WHEN p_listed THEN p_peo_id END
  WHERE id = r.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_answer_market_request(bigint, boolean, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_answer_market_request(bigint, boolean, text, bigint) TO authenticated;

-- ---------- 3. The firm's licences on record ----------
-- Both closed to the API. firm_licence_records holds one row for a firm: its National Producer Number, when its record last changed, and when a platform
-- admin last recorded that they checked it. firm_licences holds each state and line the firm says it is licensed in.
CREATE TABLE public.firm_licence_records (
  firm_id uuid PRIMARY KEY REFERENCES public.firms (id),
  npn text CHECK (npn IS NULL OR npn ~ '^[0-9]{1,10}$'),
  changed_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz,
  checked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
ALTER TABLE public.firm_licence_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_licence_records FROM PUBLIC, anon, authenticated;

CREATE TABLE public.firm_licences (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  state text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  line text NOT NULL CHECK (line IN (
    -- sync:begin firm_licence_lines
    'life_health', 'property_casualty'
    -- sync:end firm_licence_lines
  )),
  licence_number text CHECK (licence_number IS NULL OR char_length(licence_number) BETWEEN 1 AND 40),
  expires_on date,
  added_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, state, line)
);
ALTER TABLE public.firm_licences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_licences FROM PUBLIC, anon, authenticated;

-- The firm an owner is changing the licence record of: a current owner of it (each caller has asked that the firm is writable first). Marks the record changed, which is what tells a
-- platform admin that their check no longer covers it.
CREATE FUNCTION public.firm_licence_change(p_firm_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF public.firm_role(firm) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only an owner of the firm keeps its licences.' USING ERRCODE = '42501';
  END IF;
  -- The clock's own time, not the transaction's: a change and a check made in one transaction still read in the order they happened.
  INSERT INTO public.firm_licence_records (firm_id, changed_at) VALUES (firm, clock_timestamp())
  ON CONFLICT (firm_id) DO UPDATE SET changed_at = clock_timestamp();
  RETURN firm;
END;
$$;

REVOKE ALL ON FUNCTION public.firm_licence_change(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.set_firm_npn(p_firm_id uuid, p_npn text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  clean text := NULLIF(btrim(COALESCE(p_npn, '')), '');
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(public.firm_to_act_for(p_firm_id));
  firm := public.firm_licence_change(p_firm_id);
  IF clean IS NOT NULL AND clean !~ '^[0-9]{1,10}$' THEN
    RAISE EXCEPTION 'A National Producer Number is up to 10 digits' USING ERRCODE = '22023';
  END IF;
  UPDATE public.firm_licence_records SET npn = clean WHERE firm_id = firm;
END;
$$;

REVOKE ALL ON FUNCTION public.set_firm_npn(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_firm_npn(uuid, text) TO authenticated;

CREATE FUNCTION public.add_firm_licence(p_firm_id uuid, p_state text, p_line text, p_licence_number text, p_expires_on date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  clean_state text := upper(btrim(COALESCE(p_state, '')));
  clean_number text := NULLIF(btrim(COALESCE(p_licence_number, '')), '');
  made public.firm_licences;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(public.firm_to_act_for(p_firm_id));
  firm := public.firm_licence_change(p_firm_id);
  IF clean_state !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Give the state as its two letters, like TX' USING ERRCODE = '22023';
  END IF;
  IF p_line IS NULL OR p_line NOT IN ('life_health', 'property_casualty') THEN
    RAISE EXCEPTION 'A licence is life and health, or property and casualty' USING ERRCODE = '22023';
  END IF;
  IF char_length(clean_number) > 40 THEN
    RAISE EXCEPTION 'A licence number is up to 40 characters' USING ERRCODE = '22023';
  END IF;
  BEGIN
    INSERT INTO public.firm_licences (firm_id, state, line, licence_number, expires_on, added_by)
    VALUES (firm, clean_state, p_line, clean_number, p_expires_on, auth.uid())
    RETURNING * INTO made;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That licence is already on record. Remove it to change it.' USING ERRCODE = '22023';
  END;
  RETURN jsonb_build_object('id', made.id, 'state', made.state, 'line', made.line, 'licence_number', made.licence_number, 'expires_on', made.expires_on);
END;
$$;

REVOKE ALL ON FUNCTION public.add_firm_licence(uuid, text, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_firm_licence(uuid, text, text, text, date) TO authenticated;

CREATE FUNCTION public.remove_firm_licence(p_firm_id uuid, p_licence_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable(public.firm_to_act_for(p_firm_id));
  firm := public.firm_licence_change(p_firm_id);
  DELETE FROM public.firm_licences l WHERE l.id = p_licence_id AND l.firm_id = firm;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That licence isn''t on record' USING ERRCODE = 'PT404';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_firm_licence(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_firm_licence(uuid, bigint) TO authenticated;

-- A firm's record as both of its readers are given it. Not called through the API.
CREATE FUNCTION public.firm_licence_record_of(p_firm_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'npn', (SELECT r.npn FROM public.firm_licence_records r WHERE r.firm_id = p_firm_id),
    'licences', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', l.id, 'state', l.state, 'line', l.line, 'licence_number', l.licence_number, 'expires_on', l.expires_on,
                                          'expired', l.expires_on IS NOT NULL AND l.expires_on < current_date)
                       ORDER BY l.state, l.line)
      FROM public.firm_licences l WHERE l.firm_id = p_firm_id), '[]'::jsonb),
    'checked_at', (SELECT r.checked_at FROM public.firm_licence_records r WHERE r.firm_id = p_firm_id),
    -- A record changed after it was checked: the check covers what was there then, not what is there now.
    'changed_since_check', COALESCE((SELECT r.checked_at IS NOT NULL AND r.changed_at > r.checked_at FROM public.firm_licence_records r WHERE r.firm_id = p_firm_id), false))
$$;

REVOKE ALL ON FUNCTION public.firm_licence_record_of(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Every member of the firm reads its record, and whether they may change it.
CREATE FUNCTION public.firm_licence_record(p_firm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  RETURN public.firm_licence_record_of(firm) || jsonb_build_object('can_change', public.firm_role(firm) IS NOT DISTINCT FROM 'owner');
END;
$$;

REVOKE ALL ON FUNCTION public.firm_licence_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_licence_record(uuid) TO authenticated;

-- A platform admin reads any firm's record, to check it before approving the firm (Q-1.1).
CREATE FUNCTION public.admin_firm_licence_record(p_firm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id) THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  RETURN public.firm_licence_record_of(p_firm_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_firm_licence_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_firm_licence_record(uuid) TO authenticated;

-- A platform admin records that they checked the firm's licences as they stand now. As with the decision on a firm, never on a firm they belong to.
CREATE FUNCTION public.admin_record_licence_check(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.firms f WHERE f.id = p_firm_id) THEN
    RAISE EXCEPTION 'That firm does not exist' USING ERRCODE = 'PT404';
  END IF;
  IF EXISTS (SELECT 1 FROM public.current_member_firm_ids() c WHERE c.firm_id = p_firm_id) THEN
    RAISE EXCEPTION 'An admin does not check a firm they belong to' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.firm_licence_records (firm_id, changed_at, checked_at, checked_by) VALUES (p_firm_id, now(), clock_timestamp(), auth.uid())
  ON CONFLICT (firm_id) DO UPDATE SET checked_at = clock_timestamp(), checked_by = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_licence_check(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_licence_check(uuid) TO authenticated;

-- A send to a carrier needs a property and casualty licence on record that has not expired (ADR 0029, D-21). The rule is on the message a send records,
-- as the firm's approval is (20261124160000): no write path can skip it, and the refusal undoes the quote request, the stage move and the registration
-- made with it. Which states a licence must cover is counsel's (docs/LEGAL_REVIEW.md, question 2), so any state's licence passes for now.
-- Deploy note: a firm that could send to a carrier before this migration can't until an owner records the licence.
CREATE FUNCTION public.guard_firm_licensed_for_line()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.chamber_sessions;
BEGIN
  SELECT * INTO s FROM public.chamber_sessions x WHERE x.id = NEW.session_id;
  IF s.line = 'workers_comp' AND NOT EXISTS (
    SELECT 1 FROM public.firm_licences l
    WHERE l.firm_id = s.firm_id AND l.line = 'property_casualty' AND (l.expires_on IS NULL OR l.expires_on >= current_date)
  ) THEN
    RAISE EXCEPTION 'Your firm has no property and casualty licence on record. An owner adds it in Settings, under Licences, before anything is sent to a carrier.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_firm_licensed_for_line() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER quote_request_messages_firm_licensed
  BEFORE INSERT ON public.quote_request_messages
  FOR EACH ROW WHEN (NEW.direction = 'sent')
  EXECUTE FUNCTION public.guard_firm_licensed_for_line();

-- ---------- 4. Closing a firm deletes all four ----------
-- firm_closing_plan restated from its newest definition (20261125110000_quote_comparison.sql) with every line kept, and four lines for the new tables: a
-- firm's contacts at markets, its requests and its licences are its own working data, and go with it.
CREATE OR REPLACE FUNCTION public.firm_closing_plan()
RETURNS TABLE (ord integer, src text, action text, firm_column text, why text)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM (VALUES
    -- Deleted: the firm's own working data.
    (10, 'public.firm_invitations', 'delete', 'firm_id', 'pending and past invitations to join'),
    (11, 'public.intake_invitations', 'delete', 'firm_id', 'the invitations of broker-started intakes to their employers (the link, never its token); the intakes stay with their employers'),
    (20, 'public.firm_organisations', 'delete', 'firm_id', 'the listed Google domains and Microsoft tenants'),
    (30, 'public.join_requests', 'delete', 'firm_id', 'requests to join'),
    (40, 'public.table_preferences', 'delete', 'firm_id', 'each person''s column choices'),
    (50, 'public.saved_views', 'delete', 'firm_id', 'saved views'),
    (55, 'public.record_history', 'delete', 'firm_id', 'the history of each record: who created it and every change to its fields; it goes with the record'),
    (56, 'public.recent_records', 'delete', 'firm_id', 'each person''s last opened records, for the search box'),
    (56, 'public.bulk_change_records', 'delete', 'firm_id', 'what each bulk change did to each record, kept for ten minutes'' undo'),
    (57, 'public.bulk_changes', 'delete', 'firm_id', 'bulk changes, kept for ten minutes'' undo'),
    (60, 'public.referral_partners', 'delete', 'firm_id', 'referral partners'),
    (54, 'public.commission_payments', 'delete', 'firm_id', 'commission payments (what the firm received for its placements); before the placements and accounts they stand on'),
    (56, 'public.renewals', 'delete', 'firm_id', 'renewals (the dates an account''s cover comes up); before the placements they come from and the opportunities working them'),
    (57, 'public.placements', 'delete', 'firm_id', 'placements (what the firm placed for its accounts); before the opportunities and accounts they stand on'),
    (57, 'public.merged_records', 'delete', 'firm_id', 'where each merged-away account or contact went, so its old address led to the kept one'),
    (58, 'public.activities', 'delete', 'firm_id', 'calls, notes and tasks on the firm''s accounts, contacts and leads; before the opportunities, contacts and accounts they stand on'),
    (58, 'public.conversation_file_downloads', 'delete', 'firm_id', 'each download of a file link on the firm''s contact mail; before the links they are of'),
    (58, 'public.conversation_message_files', 'delete', 'firm_id', 'the file links on the firm''s contact mail (the files stay with their intakes); before the messages they are on'),
    (58, 'public.conversation_message_attachments', 'delete', 'firm_id', 'the files received on the firm''s contact and lead mail, each one''s name, size and scan; before the messages they are on'),
    (58, 'public.conversation_messages', 'delete', 'firm_id', 'the mail with the firm''s contacts and leads; before the conversations they are on'),
    (58, 'public.conversations', 'delete', 'firm_id', 'the conversations with the firm''s contacts and leads, their reply addresses with them; before the contacts and leads they are with'),
    (59, 'public.account_labels', 'delete', 'firm_id', 'the labels on the firm''s accounts; before the accounts they stand on'),
    (59, 'public.lead_labels', 'delete', 'firm_id', 'the labels on the firm''s leads; before the leads they stand on'),
    (59, 'public.quote_comparison_notes', 'delete', 'firm_id', 'the broker''s notes on the comparison of an opportunity''s quotes, internal and for the client: the firm''s own working notes; before the opportunities they are on'),
    (60, 'public.leads', 'delete', 'firm_id', 'leads, the people and businesses the firm is not quoting yet, the bin with them; after their calls, notes and tasks'),
    (61, 'public.opportunities', 'delete', 'firm_id', 'opportunities (each is one search for one account); before the contacts and accounts they stand on'),
    (62, 'public.contacts', 'delete', 'firm_id', 'contacts, the people at the firm''s accounts'),
    (63, 'public.accounts', 'delete', 'firm_id', 'accounts, the businesses the firm quotes for; the intakes on their opportunities stay with their employers (below)'),
    (64, 'public.labels', 'delete', 'firm_id', 'the firm''s own list of labels; after the accounts that carried them'),
    (65, 'public.firm_market_contacts', 'delete', 'firm_id', 'the firm''s own contacts at PEOs and carriers: the people it deals with there'),
    (65, 'public.market_requests', 'delete', 'firm_id', 'the firm''s requests for a PEO or carrier that wasn''t listed, each with its answer'),
    (65, 'public.firm_licences', 'delete', 'firm_id', 'the states and lines the firm said it was licensed in'),
    (65, 'public.firm_licence_records', 'delete', 'firm_id', 'the firm''s National Producer Number and when its licences were last checked'),
    (70, 'public.firm_teams', 'delete', 'firm_id', 'teams (the memberships that named one are cleared first)'),
    -- Kept, and why.
    (900, 'public.bundle_links', 'keep', NULL, 'a quote request''s links to its bundle: they go with the intake, under the intake retention rules'),
    (900, 'storage.objects WHERE bucket_id = ''bundle-links''', 'keep', NULL, 'an intake''s files: a bundle link''s made files, deleted with the intake'),
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
    (900, 'public.intake_access_ends', 'keep', NULL, 'each time an employer ended the firm''s access to an intake: appended only, naming the firm, the intake and the employer and holding no answers'),
    (900, 'public.intake_deletions', 'keep', NULL, 'the record that an intake was deleted, kept after it'),
    (900, 'public.intake_lifecycle_events', 'keep', NULL, 'an intake''s'),
    (900, 'public.manuscript_versions', 'keep', NULL, 'an intake''s'),
    (900, 'public.peo_authorizations', 'keep', NULL, 'the employer''s own say over which PEOs may receive their packet; an intake''s'),
    (900, 'public.peo_registrations', 'keep', NULL, 'the firm''s proof of each send to a PEO (firm, PEO, the employer''s FEIN or name and state, version, time): appended only, so nobody deletes it, the closing included; it stays as the record that the send happened, and still warns another firm sending the same employer to that PEO (D-1635)'),
    (900, 'public.profiles', 'keep', NULL, 'the employer''s own profile'),
    (900, 'public.quote_request_addresses', 'keep', NULL, 'a quote request''s: quote requests belong to an intake'),
    (900, 'public.quote_request_events', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_message_attachments', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_messages', 'keep', NULL, 'a quote request''s mail thread with a PEO'),
    (900, 'public.quote_request_messages WHERE quote_request_id IS NULL', 'keep', NULL, 'held mail from a PEO: held for the platform once the firm has no members, and discarded by the holding list''s own schedule'),
    (900, 'public.quote_request_notes', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_request_thread_reads', 'keep', NULL, 'a quote request''s'),
    (900, 'public.quote_requests', 'keep', NULL, 'an intake''s'),
    (900, 'public.quotes', 'keep', NULL, 'a quote request''s: what a PEO quoted on it, the whole offer; quote requests belong to an intake'),
    (900, 'public.submission_status_history', 'keep', NULL, 'an intake''s'),
    (900, 'public.submission_workflow', 'keep', NULL, 'an intake''s'),
    (900, 'storage.objects WHERE bucket_id = ''documents''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''manuscripts''', 'keep', NULL, 'an intake''s files'),
    (900, 'storage.objects WHERE bucket_id = ''contact-mail''', 'keep', NULL, 'the bytes of files received on the firm''s contact mail: unreadable once the closing deletes their rows (the bucket is read only through a stored attachment''s row), and not removable from SQL (D-667)'),
    (900, 'storage.objects WHERE bucket_id = ''peo-mail''', 'keep', NULL, 'an intake''s files')
  ) AS t (ord, src, action, firm_column, why)
$$;
