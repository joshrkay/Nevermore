-- A quote that holds the whole offer (N-2.1, slice 7.2; docs/BROKER_CRM_BUILD.md "### 7.2 N-2.1 decisions", D-720 to D-729; supabase/tests/quote_offer.sql).

-- ---------- 1. What a quote may hold ----------
-- A cost area a quote leaves out is NULL, never an empty list and never 0 (D-721): N-3.1's comparison reads "Not quoted" from NULL. An area that is there is a
-- non-empty list, each line checked here so no writer can store one that can't be compared.
-- One-off fees: a name (trimmed, 1 to 80, each once whatever its case) and an amount from 0 to 10000000; no other keys. 0 is a fee the PEO waived.
CREATE FUNCTION public.quote_one_off_fees_valid(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p IS NULL OR (
    jsonb_typeof(p) = 'array'
    AND jsonb_array_length(p) BETWEEN 1 AND 20
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p) e
      WHERE NOT CASE WHEN jsonb_typeof(e) = 'object' THEN
        (SELECT count(*) FROM jsonb_object_keys(e)) = 2
        AND jsonb_typeof(e -> 'name') = 'string' AND e ->> 'name' = btrim(e ->> 'name') AND char_length(e ->> 'name') BETWEEN 1 AND 80
        AND jsonb_typeof(e -> 'amount') = 'number' AND (e ->> 'amount')::numeric BETWEEN 0 AND 10000000
      ELSE false END)
    AND (SELECT count(DISTINCT lower(e ->> 'name')) FROM jsonb_array_elements(p) e) = jsonb_array_length(p));
$$;
REVOKE ALL ON FUNCTION public.quote_one_off_fees_valid(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Workers' comp: a US state, a class code (letters, digits and hyphens, 1 to 10) and a rate per 100 dollars of payroll from 0 to 1000; each state and class code once.
CREATE FUNCTION public.quote_workers_comp_valid(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p IS NULL OR (
    jsonb_typeof(p) = 'array'
    AND jsonb_array_length(p) BETWEEN 1 AND 200
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p) e
      WHERE NOT CASE WHEN jsonb_typeof(e) = 'object' THEN
        (SELECT count(*) FROM jsonb_object_keys(e)) = 3
        AND jsonb_typeof(e -> 'state') = 'string' AND public.is_us_state_code(e ->> 'state')
        AND jsonb_typeof(e -> 'class_code') = 'string' AND (e ->> 'class_code') ~ '^[0-9A-Za-z-]{1,10}$'
        AND jsonb_typeof(e -> 'rate') = 'number' AND (e ->> 'rate')::numeric BETWEEN 0 AND 1000
      ELSE false END)
    AND (SELECT count(DISTINCT (e ->> 'state', lower(e ->> 'class_code'))) FROM jsonb_array_elements(p) e) = jsonb_array_length(p));
$$;
REVOKE ALL ON FUNCTION public.quote_workers_comp_valid(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Unemployment tax: for each US state (once), how it is charged: at the employer's own rate (nothing more), or at the PEO's rate, which names its percent of taxable wages (0 to 100).
CREATE FUNCTION public.quote_unemployment_valid(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p IS NULL OR (
    jsonb_typeof(p) = 'array'
    AND jsonb_array_length(p) BETWEEN 1 AND 51
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p) e
      WHERE NOT CASE WHEN jsonb_typeof(e) = 'object' THEN
        jsonb_typeof(e -> 'state') = 'string' AND public.is_us_state_code(e ->> 'state')
        AND CASE e ->> 'charge'
          WHEN 'employer_rate' THEN (SELECT count(*) FROM jsonb_object_keys(e)) = 2
          WHEN 'peo_rate' THEN (SELECT count(*) FROM jsonb_object_keys(e)) = 3
            AND jsonb_typeof(e -> 'rate') = 'number' AND (e ->> 'rate')::numeric BETWEEN 0 AND 100
          ELSE false END
      ELSE false END)
    AND (SELECT count(DISTINCT e ->> 'state') FROM jsonb_array_elements(p) e) = jsonb_array_length(p));
$$;
REVOKE ALL ON FUNCTION public.quote_unemployment_valid(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Medical: a plan (trimmed, 1 to 80), a tier (QUOTE_TIERS in src/data/quoteRequests.ts: employee only, employee and spouse, employee and children, family) and the monthly
-- rate for one employee at that tier (0 to 100000); each plan and tier once whatever the plan's case.
CREATE FUNCTION public.quote_medical_valid(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p IS NULL OR (
    jsonb_typeof(p) = 'array'
    AND jsonb_array_length(p) BETWEEN 1 AND 200
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p) e
      WHERE NOT CASE WHEN jsonb_typeof(e) = 'object' THEN
        (SELECT count(*) FROM jsonb_object_keys(e)) = 3
        AND jsonb_typeof(e -> 'plan') = 'string' AND e ->> 'plan' = btrim(e ->> 'plan') AND char_length(e ->> 'plan') BETWEEN 1 AND 80
        AND jsonb_typeof(e -> 'tier') = 'string' AND e ->> 'tier' IN (
          -- sync:begin quote_tiers
          'employee_only', 'employee_spouse', 'employee_children', 'family'
          -- sync:end quote_tiers
        )
        AND jsonb_typeof(e -> 'monthly') = 'number' AND (e ->> 'monthly')::numeric BETWEEN 0 AND 100000
      ELSE false END)
    AND (SELECT count(DISTINCT (lower(e ->> 'plan'), e ->> 'tier')) FROM jsonb_array_elements(p) e) = jsonb_array_length(p));
$$;
REVOKE ALL ON FUNCTION public.quote_medical_valid(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 2. The table ----------
CREATE TABLE public.quotes (
  id bigserial PRIMARY KEY,
  quote_request_id bigint NOT NULL REFERENCES public.quote_requests (id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  kind text NOT NULL,
  received_on date,
  expires_on date,
  proposed_start_on date,
  admin_fee numeric,
  admin_fee_basis text,
  one_off_fees jsonb,
  workers_comp jsonb,
  unemployment jsonb,
  medical jsonb,
  note text
);

-- An estimate or a firm offer (QUOTE_KINDS in src/data/quoteRequests.ts; schemaSync compares them): required, and the comparison never shows one as the other (D-722).
ALTER TABLE public.quotes ADD CONSTRAINT quotes_kind_check CHECK (kind IN (
  -- sync:begin quote_kinds
  'estimate', 'firm_offer'
  -- sync:end quote_kinds
));

-- The administrative fee and the basis it is charged on come together (D-723): per employee per month, or percent of payroll.
ALTER TABLE public.quotes ADD CONSTRAINT quotes_admin_fee_check CHECK (
  (admin_fee IS NULL) = (admin_fee_basis IS NULL)
  AND (admin_fee_basis IS NULL OR admin_fee_basis IN (
    -- sync:begin quote_admin_fee_bases
    'per_employee_per_month', 'percent_of_payroll'
    -- sync:end quote_admin_fee_bases
  ))
  AND (admin_fee IS NULL OR (admin_fee >= 0 AND admin_fee <= 100000 AND (admin_fee_basis <> 'percent_of_payroll' OR admin_fee <= 100))));

ALTER TABLE public.quotes ADD CONSTRAINT quotes_one_off_fees_check CHECK (public.quote_one_off_fees_valid(one_off_fees));

ALTER TABLE public.quotes ADD CONSTRAINT quotes_workers_comp_check CHECK (public.quote_workers_comp_valid(workers_comp));

ALTER TABLE public.quotes ADD CONSTRAINT quotes_unemployment_check CHECK (public.quote_unemployment_valid(unemployment));

ALTER TABLE public.quotes ADD CONSTRAINT quotes_medical_check CHECK (public.quote_medical_valid(medical));

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotes_firm_read ON public.quotes FOR SELECT TO authenticated USING (public.intake_in_my_firm(session_id));
REVOKE ALL ON public.quotes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quotes TO authenticated;
REVOKE ALL ON SEQUENCE public.quotes_id_seq FROM PUBLIC, anon, authenticated;

-- ---------- 3. Recording a quote ----------
CREATE FUNCTION public.record_quote(
  p_quote_request_id bigint, p_kind text, p_received_on date DEFAULT NULL, p_expires_on date DEFAULT NULL, p_start_on date DEFAULT NULL,
  p_admin_fee numeric DEFAULT NULL, p_admin_fee_basis text DEFAULT NULL,
  p_one_off_fees jsonb DEFAULT NULL, p_workers_comp jsonb DEFAULT NULL,
  p_unemployment jsonb DEFAULT NULL,
  p_medical jsonb DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  q public.quotes;
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
  IF (p_admin_fee IS NULL) <> (p_admin_fee_basis IS NULL) OR p_admin_fee_basis NOT IN ('per_employee_per_month', 'percent_of_payroll') THEN
    RAISE EXCEPTION 'An administrative fee comes with its basis: per employee per month, or percent of payroll' USING ERRCODE = '22023';
  END IF;
  IF p_admin_fee < 0 OR p_admin_fee > 100000 OR (p_admin_fee_basis = 'percent_of_payroll' AND p_admin_fee > 100) THEN
    RAISE EXCEPTION 'The administrative fee is 0 to 100000 per employee per month, or 0 to 100 percent of payroll' USING ERRCODE = '22023';
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
  INSERT INTO public.quotes (quote_request_id, session_id, kind, received_on, expires_on, proposed_start_on, admin_fee, admin_fee_basis, one_off_fees, workers_comp, unemployment, medical, note)
  SELECT r.id, r.session_id, p_kind, p_received_on, p_expires_on, p_start_on, p_admin_fee, p_admin_fee_basis, p_one_off_fees, p_workers_comp, p_unemployment, p_medical, p_note
  FROM public.quote_requests r WHERE r.id = p_quote_request_id
  RETURNING * INTO q;
  RETURN to_jsonb(q);
END;
$$;

REVOKE ALL ON FUNCTION public.record_quote(bigint, text, date, date, date, numeric, text, jsonb, jsonb, jsonb, jsonb, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_quote(bigint, text, date, date, date, numeric, text, jsonb, jsonb, jsonb, jsonb, text) TO authenticated;

-- ---------- 4. Closing a firm keeps the quotes ----------
-- firm_closing_plan restated from its newest definition (20261123200000_employer_ends_access.sql) with every line kept, and the one line for the new table (D-727): a quote
-- belongs to its quote request and so to the intake, which the employer owns.
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
    (60, 'public.leads', 'delete', 'firm_id', 'leads, the people and businesses the firm is not quoting yet, the bin with them; after their calls, notes and tasks'),
    (61, 'public.opportunities', 'delete', 'firm_id', 'opportunities (each is one search for one account); before the contacts and accounts they stand on'),
    (62, 'public.contacts', 'delete', 'firm_id', 'contacts, the people at the firm''s accounts'),
    (63, 'public.accounts', 'delete', 'firm_id', 'accounts, the businesses the firm quotes for; the intakes on their opportunities stay with their employers (below)'),
    (64, 'public.labels', 'delete', 'firm_id', 'the firm''s own list of labels; after the accounts that carried them'),
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
