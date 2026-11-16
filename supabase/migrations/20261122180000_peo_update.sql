-- Sending an update to a PEO (story M-2.3, slice 6.8, #202; docs/BROKER_CRM_BUILD.md D-609, D-670 to D-679, D-1610 to D-1619; ADR 0003, ADR 0005;
-- supabase/tests/peo_update.sql).
--
-- A PEO that holds an older certified version than the latest is offered the update on its card; nothing goes until an advisor sends it. The update
-- is a send (send_to_peo, every check and refusal of M-2.1's kept, on the same quote request and thread), which then says under the note what changed
-- since the version the PEO holds: the fields by label and the census by count, never a value. Issuing the new version's link revokes the old one as
-- 'newer_version'. A quote the PEO gave stays, marked as given on the version it was given on, until the advisor records a new answer.

-- ---------- 1. A message names the version the PEO held when it is an update ----------
-- Added to, nothing replaced (ADR 0007): null on every message that is not an update (D-1611).
ALTER TABLE public.quote_request_messages
  ADD COLUMN update_from_version integer CONSTRAINT quote_request_messages_update_from_version_check CHECK (update_from_version > 0);

-- ---------- 2. What changed between two certified versions, in words a PEO may read ----------
-- Each answer's label, in the field review's order (FIELD_LABELS in src/data/provenance.ts, from the intake schema; src/data/schemaSync.test.ts keeps
-- this copy equal to it). The census is counted, not named, so it is not here.
CREATE FUNCTION public.intake_field_labels()
RETURNS TABLE (field text, label text, place bigint)
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  -- VALUES are read in the order written, so the row number is the list's order.
  SELECT v.field, v.label, row_number() OVER ()
  FROM (VALUES
    -- sync:begin intake_field_labels
      ('company_name', 'Company legal name'),
      ('industry', 'Industry'),
      ('hq_state', 'HQ state'),
      ('states', 'States of operation'),
      ('employee_count', 'Employee count'),
      ('start_month', 'Target start'),
      ('multiple_entities', 'Multiple entities'),
      ('fein_count', 'FEIN count'),
      ('virgin_medical', 'First-time medical coverage'),
      ('current_carrier', 'Current carrier'),
      ('renewal_date', 'Renewal date'),
      ('rate_history', 'Rate history'),
      ('benefits_waiting_period', 'Waiting period'),
      ('ancillary_benefits', 'Ancillary benefits'),
      ('has_401k', 'Retirement plan'),
      ('retirement_type', 'Retirement plan type'),
      ('employer_contributes', 'Employer retirement contribution'),
      ('payroll_vendor', 'Payroll vendor'),
      ('pay_frequency', 'Pay frequency'),
      ('funding_days', 'Funding lead time'),
      ('has_nonexempt', 'Nonexempt employees'),
      ('nonexempt_count', 'Nonexempt count'),
      ('exempt_count', 'Exempt count'),
      ('pto_types', 'PTO types'),
      ('accrual_method', 'Accrual method'),
      ('has_handbook', 'Employee handbook'),
      ('handbook_last_updated', 'Handbook last updated'),
      ('hr_staff_count', 'In-house HR staff'),
      ('has_1099', '1099 contractors'),
      ('ca_contractors', 'California contractors'),
      ('uses_physical_clocks', 'Physical time clocks'),
      ('uses_mobile_app', 'Mobile timekeeping'),
      ('uses_computer_timekeeping', 'Computer timekeeping'),
      ('shift_differentials', 'Shift differentials'),
      ('hris_system', 'HRIS system'),
      ('key_challenges', 'Key challenges'),
      ('business_goals', 'Business goals'),
      ('wc_carrier', 'Workers'' comp carrier'),
      ('wc_renewal_date', 'Workers'' comp renewal date'),
      ('wc_experience_mod', 'Experience mod'),
      ('wc_annual_premium', 'Workers'' comp annual premium'),
      ('fein', 'FEIN'),
      ('entity_type', 'Entity type'),
      ('year_founded', 'Year founded'),
      ('street_address', 'Street address'),
      ('website', 'Website'),
      ('entities', 'Legal entities'),
      ('naics_code', 'NAICS code'),
      ('operations_description', 'Description of operations'),
      ('in_peo', 'In a PEO now'),
      ('current_peo', 'Current PEO'),
      ('peo_renewal_date', 'PEO agreement renewal'),
      ('owners_officers', 'Owners and officers'),
      ('loss_history', 'Loss history'),
      ('medical_plans', 'Current medical plans'),
      ('suta_rates', 'State unemployment tax rates'),
      ('wcq_01', 'ACORD 130 No. 1: Aircraft or watercraft'),
      ('wcq_01_explain', 'ACORD 130 No. 1, explanation: Aircraft or watercraft'),
      ('wcq_02', 'ACORD 130 No. 2: Hazardous material'),
      ('wcq_02_explain', 'ACORD 130 No. 2, explanation: Hazardous material'),
      ('wcq_03', 'ACORD 130 No. 3: Work underground or above 15 feet'),
      ('wcq_03_explain', 'ACORD 130 No. 3, explanation: Work underground or above 15 feet'),
      ('wcq_04', 'ACORD 130 No. 4: Work on or over water'),
      ('wcq_04_explain', 'ACORD 130 No. 4, explanation: Work on or over water'),
      ('wcq_05', 'ACORD 130 No. 5: Any other type of business'),
      ('wcq_05_explain', 'ACORD 130 No. 5, explanation: Any other type of business'),
      ('wcq_06', 'ACORD 130 No. 6: Subcontractors used'),
      ('wcq_06_explain', 'ACORD 130 No. 6, explanation: Subcontractors used'),
      ('wcq_07', 'ACORD 130 No. 7: Work sublet without certificates of insurance'),
      ('wcq_07_explain', 'ACORD 130 No. 7, explanation: Work sublet without certificates of insurance'),
      ('wcq_08', 'ACORD 130 No. 8: Written safety program'),
      ('wcq_08_explain', 'ACORD 130 No. 8, explanation: Written safety program'),
      ('wcq_09', 'ACORD 130 No. 9: Group transportation'),
      ('wcq_09_explain', 'ACORD 130 No. 9, explanation: Group transportation'),
      ('wcq_10', 'ACORD 130 No. 10: Employees under 16 or over 60'),
      ('wcq_10_explain', 'ACORD 130 No. 10, explanation: Employees under 16 or over 60'),
      ('wcq_11', 'ACORD 130 No. 11: Seasonal employees'),
      ('wcq_11_explain', 'ACORD 130 No. 11, explanation: Seasonal employees'),
      ('wcq_12', 'ACORD 130 No. 12: Volunteer or donated labor'),
      ('wcq_12_explain', 'ACORD 130 No. 12, explanation: Volunteer or donated labor'),
      ('wcq_13', 'ACORD 130 No. 13: Employees with physical handicaps'),
      ('wcq_13_explain', 'ACORD 130 No. 13, explanation: Employees with physical handicaps'),
      ('wcq_14', 'ACORD 130 No. 14: Travel out of state'),
      ('wcq_14_explain', 'ACORD 130 No. 14, explanation: Travel out of state'),
      ('wcq_15', 'ACORD 130 No. 15: Athletic teams sponsored'),
      ('wcq_15_explain', 'ACORD 130 No. 15, explanation: Athletic teams sponsored'),
      ('wcq_16', 'ACORD 130 No. 16: Physicals after offers of employment'),
      ('wcq_16_explain', 'ACORD 130 No. 16, explanation: Physicals after offers of employment'),
      ('wcq_17', 'ACORD 130 No. 17: Other insurance with this insurer'),
      ('wcq_17_explain', 'ACORD 130 No. 17, explanation: Other insurance with this insurer'),
      ('wcq_18', 'ACORD 130 No. 18: Coverage declined, cancelled or non-renewed in the last three years'),
      ('wcq_18_explain', 'ACORD 130 No. 18, explanation: Coverage declined, cancelled or non-renewed in the last three years'),
      ('wcq_19', 'ACORD 130 No. 19: Employee health plans provided'),
      ('wcq_19_explain', 'ACORD 130 No. 19, explanation: Employee health plans provided'),
      ('wcq_20', 'ACORD 130 No. 20: Employees work for other businesses or subsidiaries'),
      ('wcq_20_explain', 'ACORD 130 No. 20, explanation: Employees work for other businesses or subsidiaries'),
      ('wcq_21', 'ACORD 130 No. 21: Employees leased to or from other employers'),
      ('wcq_21_explain', 'ACORD 130 No. 21, explanation: Employees leased to or from other employers'),
      ('wcq_22', 'ACORD 130 No. 22: Employees predominantly working at home'),
      ('wcq_22_explain', 'ACORD 130 No. 22, explanation: Employees predominantly working at home'),
      ('wcq_23', 'ACORD 130 No. 23: Tax liens or bankruptcy in the last five years'),
      ('wcq_23_explain', 'ACORD 130 No. 23, explanation: Tax liens or bankruptcy in the last five years'),
      ('wcq_24', 'ACORD 130 No. 24: Unpaid workers'' comp premium due'),
      ('wcq_24_explain', 'ACORD 130 No. 24, explanation: Unpaid workers'' comp premium due')
    -- sync:end intake_field_labels
  ) AS v (field, label)
$$;

-- What changed from one certified version of an intake to another (D-1612): the answers by label, in the field review's order, and the census by
-- count, people matched by their row id: added, removed, changed. Never a value: only labels from the list above and numbers are written. Not a
-- definer: it is read inside send_peo_update's own write, and no API role may call it.
CREATE FUNCTION public.peo_update_changes(p_session_id uuid, p_from integer, p_to integer)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  before jsonb := (SELECT c.chamber_data FROM public.chamber_certifications c WHERE c.session_id = p_session_id AND c.version = p_from);
  after jsonb := (SELECT c.chamber_data FROM public.chamber_certifications c WHERE c.session_id = p_session_id AND c.version = p_to);
  fields text;
  added integer;
  removed integer;
  changed integer;
BEGIN
  SELECT string_agg(l.label, ', ' ORDER BY l.place) INTO fields
  FROM public.intake_field_labels() l
  WHERE COALESCE(before -> l.field, 'null'::jsonb) IS DISTINCT FROM COALESCE(after -> l.field, 'null'::jsonb);
  WITH o AS (SELECT COALESCE(e ->> 'id', '#' || n) AS k, e FROM jsonb_array_elements(COALESCE(before -> 'census', '[]'::jsonb)) WITH ORDINALITY AS t (e, n)),
       a AS (SELECT COALESCE(e ->> 'id', '#' || n) AS k, e FROM jsonb_array_elements(COALESCE(after -> 'census', '[]'::jsonb)) WITH ORDINALITY AS t (e, n))
  SELECT (SELECT count(*) FROM a WHERE a.k NOT IN (SELECT o.k FROM o)),
         (SELECT count(*) FROM o WHERE o.k NOT IN (SELECT a.k FROM a)),
         (SELECT count(*) FROM o JOIN a ON a.k = o.k WHERE a.e IS DISTINCT FROM o.e)
  INTO added, removed, changed;
  IF fields IS NULL AND added + removed + changed = 0 THEN
    RETURN 'Nothing in the answers or the census changed since version ' || p_from || '.';
  END IF;
  RETURN 'Changed since version ' || p_from || ': ' || COALESCE(fields, 'no answers, only the census') || E'.\n'
    || CASE WHEN added + removed + changed = 0 THEN 'Census: unchanged.'
            ELSE 'Census: ' || added || ' added, ' || removed || ' removed, ' || changed || ' changed.' END;
END;
$$;

REVOKE ALL ON FUNCTION public.intake_field_labels() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.peo_update_changes(uuid, integer, integer) FROM PUBLIC, anon, authenticated, service_role;

-- ---------- 3. Sending the update ----------
CREATE FUNCTION public.send_peo_update(p_session_id uuid, p_peo text, p_to text[], p_subject text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  peo text := btrim(COALESCE(p_peo, ''));
  req public.quote_requests;
  latest integer;
  r jsonb;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.chamber_sessions zs WHERE zs.id = p_session_id));
  PERFORM public.require_advisor();
  PERFORM public.require_intake_in_my_firm(p_session_id, 'PT404');
  -- The pipeline row first, then the quote request, as every send locks them.
  PERFORM 1 FROM public.submission_workflow w WHERE w.session_id = p_session_id FOR UPDATE;
  SELECT * INTO req FROM public.quote_requests q WHERE q.session_id = p_session_id AND lower(q.peo_name) = lower(peo) FOR UPDATE;
  IF NOT FOUND OR req.sent_version IS NULL THEN
    RAISE EXCEPTION 'Nothing was sent to % yet, so there is no update. Send it the bundle.', peo USING ERRCODE = 'PT409';
  END IF;
  -- Only a PEO still open on the submission, as the queue counts one holding an older version (sent or quoted).
  IF req.status = 'declined' THEN
    RAISE EXCEPTION '% declined, so there is no update to send. Send it the bundle to ask again.', req.peo_name USING ERRCODE = 'PT409';
  END IF;
  IF req.status = 'closed' THEN
    RAISE EXCEPTION '%''s quote request is closed, so there is no update to send. Send it the bundle to reopen it.', req.peo_name USING ERRCODE = 'PT409';
  END IF;
  -- An update is a newer certified version than the one the PEO holds; the latest one still current (send_to_peo refuses when an answer changed since).
  SELECT c.version INTO latest FROM public.chamber_certifications c WHERE c.session_id = p_session_id AND c.superseded_at IS NULL
  ORDER BY c.version DESC LIMIT 1;
  IF latest IS NOT NULL AND req.sent_version >= latest THEN
    RAISE EXCEPTION '% already has version %, the latest certified.', req.peo_name, req.sent_version USING ERRCODE = 'PT409';
  END IF;
  r := public.send_to_peo(p_session_id, peo, p_to, p_subject, p_note);
  -- Under the note, what changed since the version the PEO holds (D-1612); the fixed block follows it when the link joins (attach_peo_link).
  UPDATE public.quote_request_messages m
  SET update_from_version = req.sent_version,
      body_text = m.body_text || E'\n\n' || public.peo_update_changes(p_session_id, req.sent_version, (SELECT q.sent_version FROM public.quote_requests q WHERE q.id = req.id))
  WHERE m.id = (r ->> 'message_id')::bigint;
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.send_peo_update(uuid, text, text[], text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.send_peo_update(uuid, text, text[], text, text) TO authenticated;

-- ---------- 4. The new version's link revokes the old one as 'newer_version' (D-609, D-1614) ----------
-- 20261122110000's issue_bundle_link, restated with every rule it had; the link before is now revoked as 'newer_version' when it was for an older version
-- than the one issued, and as 'replaced' otherwise, so the change log says why. Whatever made the send (an update, a send, 6.7's several), the reason follows.
CREATE OR REPLACE FUNCTION public.issue_bundle_link(p_quote_request_id bigint, p_version integer, p_folder uuid, p_files jsonb, p_open_items jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req public.quote_requests;
  firm uuid;
  token text := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  link public.bundle_links;
BEGIN
  -- Closing firms are read-only (ADR 0023), and so is a support session (ADR 0024): the one check, before anything is read or changed.
  PERFORM public.assert_firm_writable((SELECT zs.firm_id FROM public.quote_requests zq JOIN public.chamber_sessions zs ON zs.id = zq.session_id WHERE zq.id = p_quote_request_id));
  PERFORM public.require_advisor();
  -- Only a quote request of the caller's own firm; another firm's is not there for them. Locked, so two issues one after the other.
  SELECT q.* INTO req FROM public.quote_requests q WHERE q.id = p_quote_request_id AND public.quote_request_in_my_firm(q.id) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote request not found' USING ERRCODE = 'PT404';
  END IF;
  IF req.status = 'closed' THEN
    RAISE EXCEPTION 'This quote request is closed. Record a send to % to reopen it', req.peo_name USING ERRCODE = '22023';
  END IF;
  -- The database refuses a link for a PEO the employer has not authorized, or withdrew, as it refuses a send (M-1.1, slice 6.6a).
  PERFORM public.assert_peo_authorized(req.session_id, req.peo_name);
  IF p_version IS NULL OR NOT EXISTS (SELECT 1 FROM public.chamber_certifications c WHERE c.session_id = req.session_id AND c.version = p_version) THEN
    RAISE EXCEPTION 'Version % of this submission was never certified', COALESCE(p_version::text, '(none)') USING ERRCODE = '22023';
  END IF;
  -- What the page lists: one or more files, each a name that is one part of a storage path (no slash, no control character) and what it is;
  -- the open items a list.
  IF jsonb_typeof(p_files) IS DISTINCT FROM 'array' OR jsonb_array_length(p_files) = 0 OR jsonb_array_length(p_files) > 100
     OR jsonb_typeof(COALESCE(p_open_items, '[]'::jsonb)) <> 'array'
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_files) f
       WHERE jsonb_typeof(f) <> 'object' OR jsonb_typeof(f -> 'name') IS DISTINCT FROM 'string' OR jsonb_typeof(f -> 'what') IS DISTINCT FROM 'string'
          OR btrim(f ->> 'name') = '' OR char_length(f ->> 'name') > 120 OR f ->> 'name' ~ '[/\\[:cntrl:]]' OR f ->> 'name' IN ('.', '..')
          OR btrim(f ->> 'what') = '' OR char_length(f ->> 'what') > 200) THEN
    RAISE EXCEPTION 'A link lists one or more files, each with a name and what it is' USING ERRCODE = '22023';
  END IF;
  -- A document is named, not copied: only one of this intake whose scan passed (clean, or skipped where no scanner is set up), as a download
  -- of it is anywhere else in the product.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_files) f
    WHERE f ? 'document_id' AND NOT EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id::text = f ->> 'document_id' AND d.session_id = req.session_id AND d.scan_verdict IN ('clean', 'skipped'))) THEN
    RAISE EXCEPTION 'A link carries only this submission''s documents that passed their scan' USING ERRCODE = '22023';
  END IF;
  SELECT s.firm_id INTO firm FROM public.chamber_sessions s WHERE s.id = req.session_id;
  -- The link before, if any, stops working now (one live link per quote request): as 'newer_version' when this link is for a newer version (M-2.3),
  -- else as 'replaced'.
  UPDATE public.bundle_links SET revoked_at = now(), revoked_reason = CASE WHEN version < p_version THEN 'newer_version' ELSE 'replaced' END
  WHERE quote_request_id = req.id AND revoked_at IS NULL;
  INSERT INTO public.bundle_links (firm_id, quote_request_id, session_id, version, token_hash, folder, files, open_items, issued_by, expires_at)
  VALUES (firm, req.id, req.session_id, p_version, encode(extensions.digest(token, 'sha256'), 'hex'), p_folder, p_files, COALESCE(p_open_items, '[]'::jsonb),
          auth.uid(), now() + interval '30 days')
  RETURNING * INTO link;
  RETURN jsonb_build_object('id', link.id, 'token', token, 'expires_at', link.expires_at, 'version', link.version);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_bundle_link(bigint, integer, uuid, jsonb, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.issue_bundle_link(bigint, integer, uuid, jsonb, jsonb) TO authenticated;

-- ---------- 5. A quote is marked with the version it was given on (D-1615) ----------
-- A quote request that was quoted stays quoted when an update is sent; its quote was given on the version the PEO held, which quoted_version keeps,
-- until the advisor records a new answer. Set by a trigger, so every way a quote is recorded sets it. Null while the request is not quoted.
ALTER TABLE public.quote_requests
  ADD COLUMN quoted_version integer CONSTRAINT quote_requests_quoted_version_check CHECK (quoted_version > 0);

CREATE FUNCTION public.quote_request_quoted_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status <> 'quoted' THEN
    NEW.quoted_version := NULL;
  -- Becoming quoted, or a quoted request's quote itself changed (when it arrived, expires, the start, the fee): an answer recorded, on the version sent.
  -- Its note alone, a send, or the version sent moving is no new answer.
  ELSIF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'quoted'
        OR (NEW.quote_received_on, NEW.quote_expires_on, NEW.proposed_start_on, NEW.admin_fee_pepm)
           IS DISTINCT FROM (OLD.quote_received_on, OLD.quote_expires_on, OLD.proposed_start_on, OLD.admin_fee_pepm) THEN
    NEW.quoted_version := NEW.sent_version;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.quote_request_quoted_version() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER quote_requests_quoted_version BEFORE INSERT OR UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.quote_request_quoted_version();

-- A quote recorded before this was given on the version then sent, as far as anyone can now tell. Not a change anyone made, so not logged.
ALTER TABLE public.quote_requests DISABLE TRIGGER quote_requests_log_change;
UPDATE public.quote_requests SET quoted_version = sent_version WHERE status = 'quoted';
ALTER TABLE public.quote_requests ENABLE TRIGGER quote_requests_log_change;
