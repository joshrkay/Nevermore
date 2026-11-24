-- Importing a book from a CSV (CRM-X4.1; docs/BROKER_READINESS_PRD.md BR-5.1; docs/BROKER_CRM_BUILD.md "## Import", D-2300 to D-2319;
-- supabase/tests/import.sql). The browser reads the file and matches its columns; the database is sent rows of named fields and decides what each makes,
-- by the rules a record made by hand is held to. An import is one batch: listed with who ran it, and undone as a whole for 30 days. It contacts nobody.

SET lock_timeout = '5s';

-- ---------- 1. An import and what each of its rows made ----------
-- Both closed to the API. import_rows keeps no value from the file: the row's number in it, what it made, and why it made nothing.
CREATE TABLE public.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  kind text NOT NULL CHECK (kind IN (
    -- sync:begin import_kinds
    'leads', 'accounts'
    -- sync:end import_kinds
  )),
  file_name text CHECK (file_name IS NULL OR char_length(file_name) BETWEEN 1 AND 200),
  total_rows integer NOT NULL CHECK (total_rows BETWEEN 1 AND 10000),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.imports FROM PUBLIC, anon, authenticated;
CREATE INDEX imports_firm_idx ON public.imports (firm_id, created_at DESC);

CREATE TABLE public.import_rows (
  import_id uuid NOT NULL REFERENCES public.imports (id) ON DELETE CASCADE,
  firm_id uuid NOT NULL REFERENCES public.firms (id),
  row_number integer NOT NULL CHECK (row_number >= 1),
  outcome text NOT NULL CHECK (outcome IN ('created', 'exists', 'failed')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 300),
  -- What the row made, by id and with no foreign key: the record may be deleted or merged later, and the row still says what the import did.
  lead_id uuid,
  account_id uuid,
  PRIMARY KEY (import_id, row_number)
);
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.import_rows FROM PUBLIC, anon, authenticated;

-- The limits, in one place; the browser's are the same (src/data/import.ts; src/data/import.test.ts holds them equal).
CREATE FUNCTION public.import_limits()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT jsonb_build_object(
    -- sync:begin import_limits
    'max_rows', 10000, 'max_rows_a_request', 500, 'undo_days', 30
    -- sync:end import_limits
  )
$$;
REVOKE ALL ON FUNCTION public.import_limits() FROM PUBLIC, anon, authenticated;

-- A field of a row as text: trimmed, and nothing when it is empty or is not text or a number.
CREATE FUNCTION public.import_text(p_row jsonb, p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN jsonb_typeof(p_row -> p_key) IN ('string', 'number') THEN NULLIF(btrim(p_row ->> p_key), '') END
$$;
REVOKE ALL ON FUNCTION public.import_text(jsonb, text) FROM PUBLIC, anon, authenticated;

-- A date as a file holds one: 2027-01-31 or 1/31/2027. Null when it is neither, or is no day of the calendar.
CREATE FUNCTION public.import_date(p_text text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text ~ '^\d{4}-\d{1,2}-\d{1,2}$' THEN
    RETURN to_date(p_text, 'YYYY-MM-DD');
  ELSIF p_text ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
    RETURN to_date(p_text, 'MM/DD/YYYY');
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.import_date(text) FROM PUBLIC, anon, authenticated;

-- What one row makes, for the firm and the person importing. Not called through the API: the callers below have decided who may import. A row that
-- breaks a rule makes nothing and says why in the rule's own words; one whose record is already here makes nothing and says so.
CREATE FUNCTION public.import_apply_row(p_firm_id uuid, p_kind text, p_row jsonb, OUT outcome text, OUT reason text, OUT lead_id uuid, OUT account_id uuid)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  owner_in text := public.import_text(p_row, 'owner');
  owner uuid := auth.uid();
  employees_in text := public.import_text(p_row, 'employees');
  employees integer;
  name_in text := public.import_text(p_row, 'name');
  state_in text := upper(public.import_text(p_row, 'state'));
  email_in text := public.import_text(p_row, 'email');
  provider_in text := public.import_text(p_row, 'current_provider');
  website_in text := public.import_text(p_row, 'website');
  c_first text := public.import_text(p_row, 'contact_first_name');
  c_last text := public.import_text(p_row, 'contact_last_name');
  c_title text := public.import_text(p_row, 'contact_title');
  c_email text := public.import_text(p_row, 'contact_email');
  c_phone text := public.import_text(p_row, 'contact_phone');
  c_mobile text := public.import_text(p_row, 'contact_mobile');
  renewal_in text := public.import_text(p_row, 'renewal_date');
  renews_on date;
  has_contact boolean;
  problem text;
BEGIN
  outcome := 'failed';
  -- Whose it is: the member the row names, by email or by name, or the person importing (CRM-X4.1).
  IF owner_in IS NOT NULL THEN
    SELECT m.user_id INTO owner
    FROM public.firm_memberships m JOIN auth.users u ON u.id = m.user_id
    WHERE m.firm_id = p_firm_id AND public.membership_is_current(m.valid_from, m.valid_until)
      AND (lower(btrim(u.email)) = lower(owner_in) OR lower(public.crm_person_name(m.user_id)) = lower(owner_in))
    ORDER BY (lower(btrim(u.email)) = lower(owner_in)) DESC, m.user_id LIMIT 1;
    IF owner IS NULL THEN
      reason := left(format('No member of the firm is "%s". Use their email.', owner_in), 300);
      RETURN;
    END IF;
  END IF;
  IF NOT public.can_change_firm_record(p_firm_id, owner) THEN
    reason := 'You can import records only for yourself and, as a lead, for people on your teams.';
    RETURN;
  END IF;
  IF employees_in IS NOT NULL THEN
    IF employees_in !~ '^\d{1,7}$' THEN
      reason := 'Employees must be a whole number, like 25';
      RETURN;
    END IF;
    employees := employees_in::integer;
  END IF;

  IF p_kind = 'leads' THEN
    problem := public.lead_input_error(name_in, public.import_text(p_row, 'title'), public.import_text(p_row, 'business'), email_in, public.import_text(p_row, 'phone'),
                                       public.import_text(p_row, 'city'), state_in, employees, provider_in, public.import_text(p_row, 'note'));
    IF problem IS NOT NULL THEN
      reason := left(problem, 300);
      RETURN;
    END IF;
    -- Already here: a lead of the firm with that email, one in the bin included (an owner can restore it).
    IF email_in IS NOT NULL THEN
      SELECT l.id INTO lead_id FROM public.leads l WHERE l.firm_id = p_firm_id AND lower(l.email) = lower(email_in) ORDER BY l.created_at LIMIT 1;
      IF lead_id IS NOT NULL THEN
        outcome := 'exists';
        reason := 'A lead with this email is already here';
        RETURN;
      END IF;
    END IF;
    INSERT INTO public.leads (firm_id, owner_id, name, title, business, email, phone, city, state, employees, current_provider, note, source)
    VALUES (p_firm_id, owner, name_in, public.import_text(p_row, 'title'), public.import_text(p_row, 'business'), email_in, public.import_text(p_row, 'phone'),
            public.import_text(p_row, 'city'), state_in, employees, provider_in, public.import_text(p_row, 'note'), 'import')
    RETURNING id INTO lead_id;
    outcome := 'created';
    RETURN;
  END IF;

  -- An account, with its contact and its renewal when the row holds them. Everything is checked before anything is made, so a row makes all of it or none.
  problem := public.account_input_error(name_in, public.import_text(p_row, 'trade_name'), website_in, public.import_text(p_row, 'phone'), public.import_text(p_row, 'street'),
                                        public.import_text(p_row, 'city'), state_in, public.import_text(p_row, 'postal_code'), public.import_text(p_row, 'industry'),
                                        employees, '{}'::text[], provider_in);
  has_contact := COALESCE(c_first, c_last, c_title, c_email, c_phone, c_mobile) IS NOT NULL;
  IF problem IS NULL AND has_contact THEN
    problem := public.contact_input_error(c_first, c_last, c_title, c_email, c_phone, c_mobile);
  END IF;
  IF problem IS NULL AND renewal_in IS NOT NULL THEN
    renews_on := public.import_date(renewal_in);
    IF renews_on IS NULL THEN
      problem := 'Renewal date must be a date, like 2027-01-31 or 1/31/2027';
    ELSIF provider_in IS NULL THEN
      problem := 'A renewal date needs the current provider it renews with';
    ELSE
      problem := public.renewal_input_error(provider_in, renews_on);
    END IF;
  END IF;
  IF problem IS NOT NULL THEN
    reason := left(problem, 300);
    RETURN;
  END IF;
  -- Already here, as a new account's warning finds one (CRM-S4.2): the same website, the same name and state, or a contact with that email.
  account_id := public.find_duplicate_account(p_firm_id, public.web_domain_of(website_in), name_in, state_in, c_email);
  IF account_id IS NOT NULL THEN
    outcome := 'exists';
    reason := 'An account that matches this one is already here';
    RETURN;
  END IF;
  INSERT INTO public.accounts (firm_id, owner_id, name, trade_name, website, phone, street, city, state, postal_code, industry, employees, current_provider, source)
  VALUES (p_firm_id, owner, name_in, public.import_text(p_row, 'trade_name'), website_in, public.import_text(p_row, 'phone'), public.import_text(p_row, 'street'),
          public.import_text(p_row, 'city'), state_in, public.import_text(p_row, 'postal_code'), public.import_text(p_row, 'industry'), employees, provider_in, 'import')
  RETURNING id INTO account_id;
  IF has_contact THEN
    INSERT INTO public.contacts (firm_id, account_id, owner_id, first_name, last_name, title, email, phone, mobile, is_main)
    VALUES (p_firm_id, account_id, owner, c_first, c_last, c_title, c_email, c_phone, c_mobile, true);
  END IF;
  IF renews_on IS NOT NULL THEN
    INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on) VALUES (p_firm_id, account_id, 'current_plan', provider_in, renews_on);
  END IF;
  outcome := 'created';
END;
$$;
REVOKE ALL ON FUNCTION public.import_apply_row(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- The firm a person is importing into: a current owner or lead of it, and the firm writable. An agent brings records in one at a time.
CREATE FUNCTION public.firm_to_import_into(p_firm_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
BEGIN
  firm := public.firm_to_act_for(p_firm_id);
  IF public.firm_role(firm) IS NULL OR public.firm_role(firm) NOT IN ('owner', 'lead') THEN
    RAISE EXCEPTION 'Only an owner or a lead of the firm imports.' USING ERRCODE = '42501';
  END IF;
  RETURN firm;
END;
$$;
REVOKE ALL ON FUNCTION public.firm_to_import_into(uuid) FROM PUBLIC, anon, authenticated;

-- The rows of a request, checked: an array of at most the limit, each an object with its row number in the file (`_row`).
CREATE FUNCTION public.import_rows_checked(p_rows jsonb, p_kind text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('leads', 'accounts') THEN
    RAISE EXCEPTION 'Import leads, or accounts with their contacts' USING ERRCODE = '22023';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'Send the rows to import' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) > (public.import_limits() ->> 'max_rows_a_request')::integer THEN
    RAISE EXCEPTION 'Send at most % rows at a time', public.import_limits() ->> 'max_rows_a_request' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE jsonb_typeof(r) <> 'object' OR jsonb_typeof(r -> '_row') <> 'number' OR (r ->> '_row') !~ '^\d{1,6}$' OR (r ->> '_row')::integer < 1) THEN
    RAISE EXCEPTION 'Each row says which row of the file it is' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.import_rows_checked(jsonb, text) FROM PUBLIC, anon, authenticated;

-- ---------- 2. The review ----------
-- What these rows would make, by the import's own rules, and nothing made: every row is applied and then undone together (the block below is rolled back
-- by the error it ends with, which carries the answer out). So a review can't differ from the import it previews, except by what changes in between.
CREATE FUNCTION public.import_preview(p_firm_id uuid, p_kind text, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  r jsonb;
  o record;
  n_create integer := 0;
  n_exists integer := 0;
  n_failed integer := 0;
  problems jsonb := '[]'::jsonb;
  answer text;
BEGIN
  firm := public.firm_to_import_into(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  PERFORM public.import_rows_checked(p_rows, p_kind);
  BEGIN
    FOR r IN SELECT x FROM jsonb_array_elements(p_rows) x ORDER BY (x ->> '_row')::integer LOOP
      SELECT * INTO o FROM public.import_apply_row(firm, p_kind, r);
      IF o.outcome = 'created' THEN n_create := n_create + 1;
      ELSIF o.outcome = 'exists' THEN n_exists := n_exists + 1;
      ELSE n_failed := n_failed + 1;
      END IF;
      IF o.outcome <> 'created' THEN
        problems := problems || jsonb_build_object('row', (r ->> '_row')::integer, 'outcome', o.outcome, 'reason', o.reason);
      END IF;
    END LOOP;
    RAISE EXCEPTION USING ERRCODE = 'IMPRV', MESSAGE = jsonb_build_object('create', n_create, 'exists', n_exists, 'failed', n_failed, 'problems', problems)::text;
  EXCEPTION WHEN SQLSTATE 'IMPRV' THEN
    GET STACKED DIAGNOSTICS answer = MESSAGE_TEXT;
  END;
  RETURN answer::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.import_preview(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_preview(uuid, text, jsonb) TO authenticated;

-- ---------- 3. The import ----------
CREATE FUNCTION public.start_import(p_firm_id uuid, p_kind text, p_file_name text, p_total_rows integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  made uuid;
BEGIN
  firm := public.firm_to_import_into(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  IF p_kind IS NULL OR p_kind NOT IN ('leads', 'accounts') THEN
    RAISE EXCEPTION 'Import leads, or accounts with their contacts' USING ERRCODE = '22023';
  END IF;
  IF p_total_rows IS NULL OR p_total_rows < 1 THEN
    RAISE EXCEPTION 'The file has no rows to import' USING ERRCODE = '22023';
  END IF;
  IF p_total_rows > (public.import_limits() ->> 'max_rows')::integer THEN
    RAISE EXCEPTION 'An import holds at most 10,000 rows. Split the file and import each part.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.imports (firm_id, kind, file_name, total_rows, created_by)
  VALUES (firm, p_kind, NULLIF(left(btrim(COALESCE(p_file_name, '')), 200), ''), p_total_rows, auth.uid())
  RETURNING id INTO made;
  RETURN made;
END;
$$;

REVOKE ALL ON FUNCTION public.start_import(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_import(uuid, text, text, integer) TO authenticated;

-- Some of an import's rows, sent by the person who started it. A row already recorded is not done again, so a request that is sent twice makes nothing
-- twice. A row whose making fails for a reason no rule put into words is recorded as failed and the rest go on.
CREATE FUNCTION public.import_rows(p_firm_id uuid, p_import_id uuid, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  i public.imports;
  r jsonb;
  o record;
  n integer;
  n_create integer := 0;
  n_exists integer := 0;
  n_failed integer := 0;
BEGIN
  firm := public.firm_to_import_into(p_firm_id);
  PERFORM public.assert_firm_writable(firm);
  SELECT * INTO i FROM public.imports x WHERE x.id = p_import_id AND x.firm_id = firm AND x.created_by = auth.uid() FOR UPDATE;
  IF i.id IS NULL THEN
    RAISE EXCEPTION 'That import isn''t available' USING ERRCODE = 'PT404';
  END IF;
  IF i.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'That import was undone' USING ERRCODE = '55000';
  END IF;
  PERFORM public.import_rows_checked(p_rows, i.kind);
  FOR r IN SELECT x FROM jsonb_array_elements(p_rows) x ORDER BY (x ->> '_row')::integer LOOP
    n := (r ->> '_row')::integer;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.import_rows w WHERE w.import_id = i.id AND w.row_number = n);
    BEGIN
      SELECT * INTO o FROM public.import_apply_row(firm, i.kind, r);
    EXCEPTION WHEN OTHERS THEN
      SELECT 'failed'::text AS outcome, 'This row couldn''t be imported'::text AS reason, NULL::uuid AS lead_id, NULL::uuid AS account_id INTO o;
    END;
    INSERT INTO public.import_rows (import_id, firm_id, row_number, outcome, reason, lead_id, account_id)
    VALUES (i.id, firm, n, o.outcome, o.reason, CASE WHEN o.outcome = 'created' THEN o.lead_id END, CASE WHEN o.outcome = 'created' THEN o.account_id END);
    IF o.outcome = 'created' THEN n_create := n_create + 1;
    ELSIF o.outcome = 'exists' THEN n_exists := n_exists + 1;
    ELSE n_failed := n_failed + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('created', n_create, 'exists', n_exists, 'failed', n_failed);
END;
$$;

REVOKE ALL ON FUNCTION public.import_rows(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_rows(uuid, uuid, jsonb) TO authenticated;

-- ---------- 4. The list, an import's problems, and undoing one ----------
-- The firm's imports, newest first: an owner reads every one, a lead their own.
CREATE FUNCTION public.imports_list(p_firm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  is_owner boolean;
BEGIN
  firm := public.firm_to_import_into(p_firm_id);
  is_owner := public.firm_role(firm) = 'owner';
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', i.id, 'kind', i.kind, 'file_name', i.file_name, 'total_rows', i.total_rows, 'created_by', public.crm_person_name(i.created_by), 'created_at', i.created_at,
      'created', (SELECT count(*) FROM public.import_rows w WHERE w.import_id = i.id AND w.outcome = 'created'),
      'exists', (SELECT count(*) FROM public.import_rows w WHERE w.import_id = i.id AND w.outcome = 'exists'),
      'failed', (SELECT count(*) FROM public.import_rows w WHERE w.import_id = i.id AND w.outcome = 'failed'),
      'undone_at', i.undone_at,
      'can_undo', i.undone_at IS NULL AND i.created_at > now() - make_interval(days => (public.import_limits() ->> 'undo_days')::integer)) ORDER BY i.created_at DESC, i.id)
    FROM public.imports i
    WHERE i.firm_id = firm AND (is_owner OR i.created_by = auth.uid())), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.imports_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.imports_list(uuid) TO authenticated;

-- The import a person may read or undo: one of the firm's, their own or, for an owner, anyone's. One answer for one that isn't there and one they may not.
CREATE FUNCTION public.import_of_mine(p_firm_id uuid, p_import_id uuid)
RETURNS public.imports
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  firm uuid;
  i public.imports;
BEGIN
  firm := public.firm_to_import_into(p_firm_id);
  SELECT * INTO i FROM public.imports x WHERE x.id = p_import_id AND x.firm_id = firm AND (public.firm_role(firm) = 'owner' OR x.created_by = auth.uid());
  IF i.id IS NULL THEN
    RAISE EXCEPTION 'That import isn''t available' USING ERRCODE = 'PT404';
  END IF;
  RETURN i;
END;
$$;
REVOKE ALL ON FUNCTION public.import_of_mine(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- The rows of an import that made nothing, in the file's order, each with why: to be fixed in the file and imported again.
CREATE FUNCTION public.import_problems(p_firm_id uuid, p_import_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i public.imports;
BEGIN
  i := public.import_of_mine(p_firm_id, p_import_id);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('row', w.row_number, 'outcome', w.outcome, 'reason', w.reason) ORDER BY w.row_number)
    FROM public.import_rows w WHERE w.import_id = i.id AND w.outcome <> 'created'), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.import_problems(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_problems(uuid, uuid) TO authenticated;

-- Undoes an import as a whole, once, within 30 days: the leads it made go to the bin (an owner can restore one for 30 days more), and the accounts it made
-- are deleted with their contacts and renewals. What has moved on since is kept and counted: a lead that was converted, an account that has an opportunity.
-- It made nothing but new records, so there is nothing to put back.
CREATE FUNCTION public.undo_import(p_firm_id uuid, p_import_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i public.imports;
  w public.import_rows;
  removed integer := 0;
  kept integer := 0;
  n integer;
BEGIN
  PERFORM public.assert_firm_writable(public.firm_to_act_for(p_firm_id));
  i := public.import_of_mine(p_firm_id, p_import_id);
  PERFORM 1 FROM public.imports x WHERE x.id = i.id FOR UPDATE;
  SELECT * INTO i FROM public.imports x WHERE x.id = i.id;
  IF i.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'That import was undone already' USING ERRCODE = '55000';
  END IF;
  IF i.created_at <= now() - make_interval(days => (public.import_limits() ->> 'undo_days')::integer) THEN
    RAISE EXCEPTION 'An import can be undone for 30 days. This one is older.' USING ERRCODE = '55000';
  END IF;
  FOR w IN SELECT * FROM public.import_rows x WHERE x.import_id = i.id AND x.outcome = 'created' ORDER BY x.row_number LOOP
    IF w.lead_id IS NOT NULL THEN
      UPDATE public.leads l SET deleted_at = now() WHERE l.id = w.lead_id AND l.firm_id = i.firm_id AND l.deleted_at IS NULL AND l.status <> 'converted';
      GET DIAGNOSTICS n = ROW_COUNT;
    ELSE
      n := 0;
      BEGIN
        -- An account with an opportunity is never deleted (it may hold an employer's intake); anything else that still holds it back keeps it too.
        IF NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.account_id = w.account_id) THEN
          DELETE FROM public.renewals r WHERE r.account_id = w.account_id AND r.firm_id = i.firm_id;
          DELETE FROM public.contacts c WHERE c.account_id = w.account_id AND c.firm_id = i.firm_id;
          DELETE FROM public.accounts a WHERE a.id = w.account_id AND a.firm_id = i.firm_id;
          GET DIAGNOSTICS n = ROW_COUNT;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        n := 0;
      END;
    END IF;
    IF n > 0 THEN removed := removed + 1; ELSE kept := kept + 1; END IF;
  END LOOP;
  UPDATE public.imports SET undone_at = now(), undone_by = auth.uid() WHERE id = i.id;
  RETURN jsonb_build_object('removed', removed, 'kept', kept);
END;
$$;

REVOKE ALL ON FUNCTION public.undo_import(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_import(uuid, uuid) TO authenticated;

-- ---------- 5. Closing a firm deletes its imports ----------
-- firm_closing_plan restated from its newest definition (20261127090000_sendable.sql) with every line kept, and two lines for the new tables: the rows
-- before the imports they are of.
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
    (64, 'public.import_rows', 'delete', 'firm_id', 'what each row of an import made, by row number and with no value from the file; before the imports they are of'),
    (65, 'public.imports', 'delete', 'firm_id', 'the firm''s imports: who ran each, when, and of which file'),
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
