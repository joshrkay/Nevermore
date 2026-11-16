-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh intake_teaches_account
-- What an intake teaches its account (story CRM-Q1.2, slice 5.12; docs/BROKER_CRM_BUILD.md D-196, D-226, D-1715, D-1810..D-1819; ADR 0006, 0023, 0024, 0025;
-- 20261123190000_intake_teaches_account.sql). Each certification fills the empty fields of the account its intake sits on, makes the certifier a contact of it
-- (matched by email) and leaves the rest as the firm has it; account_intake_says answers, per field, what the latest certification says where the account differs.
-- Every certification here is the real one: the prospect saves the intake as themselves. Built one behaviour at a time (TDD_LOG.md).
\set ON_ERROR_STOP 1
\i e2e/stack/bootstrap.sql
\i supabase/migrations/20260323215855_6110f697-3604-440a-bcc3-685413801386.sql
\i supabase/migrations/20260323224722_847cb3a9-3573-491f-ba0c-54a2ccea0340.sql
\i supabase/migrations/20260324031329_0de2017b-f5c3-4631-b280-4cfa150f3c76.sql
\i supabase/migrations/20261020180000_signup_company_and_session_submission.sql
\i supabase/migrations/20261020190000_ai_rate_limit.sql
\i supabase/migrations/20261020200000_block_guest_submission.sql
\i supabase/migrations/20261020210000_certification_events.sql
\i supabase/migrations/20261020220000_guest_abuse_limits.sql
\i supabase/migrations/20261021090000_chamber_field_provenance.sql
\i supabase/migrations/20261021100000_session_documents.sql
\i supabase/migrations/20261022090000_advisor_operations.sql
\i supabase/migrations/20261023090000_document_categories_and_storage_access.sql
\i supabase/migrations/20261024090000_document_processing_started.sql
\i supabase/migrations/20261024100000_advisor_queue.sql
\i supabase/migrations/20261025090000_submission_outbox.sql
\i supabase/migrations/20261026090000_outbox_reliability.sql
\i supabase/migrations/20261027090000_intake_validation_and_versioning.sql
\i supabase/migrations/20261027090001_outbox_operations.sql
\i supabase/migrations/20261027100000_outbox_schedule.sql
\i supabase/migrations/20261028090000_email_delivery_events.sql
\i supabase/migrations/20261029090000_document_ingestion.sql
\i supabase/migrations/20261029091000_census_advisor_review.sql
\i supabase/migrations/20261029092000_census_in_intake_validation.sql
\i supabase/migrations/20261103090000_intake_lifecycle.sql
\i supabase/migrations/20261103091000_intake_schema_version.sql
\i supabase/migrations/20261103100000_chosen_peo.sql
\i supabase/migrations/20261103110000_certification_readiness.sql
\i supabase/migrations/20261103110001_document_storage_path.sql
\i supabase/migrations/20261103120000_intake_schema_v2_workers_comp.sql
\i supabase/migrations/20261103120100_intake_schema_v2_version.sql
\i supabase/migrations/20261103120200_ai_extraction_events.sql
\i supabase/migrations/20261104090000_intake_consent.sql
\i supabase/migrations/20261104091000_ops_monitoring.sql
\i supabase/migrations/20261104092000_data_retention_and_deletion.sql
\i supabase/migrations/20261104093000_security_review_fixes.sql
\i supabase/migrations/20261104100000_certification_conflicts.sql
\i supabase/migrations/20261104101000_transcript_validation.sql
\i supabase/migrations/20261104102000_one_open_draft.sql
\i supabase/migrations/20261104103000_required_items.sql
\i supabase/migrations/20261104110000_pin_reviews_and_manuscripts_to_answers.sql
\i supabase/migrations/20261104111000_pipeline_follows_the_prospect.sql
\i supabase/migrations/20261104112000_certified_evidence.sql
\i supabase/migrations/20261104113000_share_reviewed_manuscript.sql
\i supabase/migrations/20261104114000_paged_advisor_queue.sql
\i supabase/migrations/20261104115000_advisor_review_followups.sql
\i supabase/migrations/20261104116000_intake_deletion_removes_document_history.sql
\i supabase/migrations/20261104117000_certification_snapshots.sql
\i supabase/migrations/20261104117100_alert_headcount_census.sql
\i supabase/migrations/20261104118000_open_items.sql
\i supabase/migrations/20261104120000_submission_records.sql
\i supabase/migrations/20261104121000_voice_failed_ops_kind.sql
\i supabase/migrations/20261104122000_pipeline_transitions.sql
\i supabase/migrations/20261104130000_document_scanning.sql
\i supabase/migrations/20261104131000_certification_file_id_check.sql
\i supabase/migrations/20261104132000_needs_advisor_action.sql
\i supabase/migrations/20261104133000_queue_hides_empty_guest_drafts.sql
\i supabase/migrations/20261105090000_information_requests.sql
\i supabase/migrations/20261105091000_draft_expiry_reminders.sql
\i supabase/migrations/20261105092000_intake_milestones.sql
\i supabase/migrations/20261106090000_hardening.sql
\i supabase/migrations/20261106100000_intake_sources.sql
\i supabase/migrations/20261107090000_intake_consent_v2.sql
\i supabase/migrations/20261109090000_packet_error_messages.sql
\i supabase/migrations/20261110090000_quote_requests.sql
\i supabase/migrations/20261111090000_quote_request_notes.sql
\i supabase/migrations/20261111100000_quote_request_addresses.sql
\i supabase/migrations/20261111110000_quote_request_messages.sql
\i supabase/migrations/20261111120000_quote_request_threads.sql
\i supabase/migrations/20261111130000_held_mail.sql
\i supabase/migrations/20261111140000_peo_mail_alert.sql
\i supabase/migrations/20261112090000_intake_schema_v3_version.sql
\i supabase/migrations/20261112091000_intake_schema_v3_company_identity.sql
\i supabase/migrations/20261112092000_intake_schema_v3_industry_code.sql
\i supabase/migrations/20261112093000_intake_schema_v3_current_peo.sql
\i supabase/migrations/20261112094000_intake_schema_v3_census_columns.sql
\i supabase/migrations/20261112095000_intake_schema_v3_census_worksite.sql
\i supabase/migrations/20261112096000_intake_schema_v3_owners_officers.sql
\i supabase/migrations/20261112097000_intake_schema_v3_loss_history.sql
\i supabase/migrations/20261112098000_intake_schema_v3_medical_plans.sql
\i supabase/migrations/20261112099000_intake_schema_v3_suta_rates.sql
\i supabase/migrations/20261112100000_intake_schema_v3_acord_130_questions.sql
\i supabase/migrations/20261113090000_broker_mailboxes.sql
\i supabase/migrations/20261113100000_allowed_organisations.sql
\i supabase/migrations/20261115090000_peo_requirement_profiles.sql
\i supabase/migrations/20261115100000_peo_profile_editor.sql
\i supabase/migrations/20261115110000_peo_industry_class_codes.sql
\i supabase/migrations/20261115120000_extra_answers.sql
\i supabase/migrations/20261115130000_information_request_extra_questions.sql
\i supabase/migrations/20261115140000_peo_census_templates.sql
\i supabase/migrations/20261116090000_firms.sql
\i supabase/migrations/20261116110000_firm_scoped_policies.sql
\i supabase/migrations/20261116140000_firm_address_lookup.sql
\i supabase/migrations/20261116150000_second_factor_for_password_sign_ins.sql
\i supabase/migrations/20261116160000_firm_address_member_before_second_factor.sql
\i supabase/migrations/20261116160001_firm_activity.sql
\i supabase/migrations/20261116170000_firm_signup.sql
\i supabase/migrations/20261116170001_firm_events_recorded.sql
\i supabase/migrations/20261116180000_function_firm_scope.sql
\i supabase/migrations/20261116190000_firm_invitations.sql
\i supabase/migrations/20261116190500_invitation_fixes.sql
\i supabase/migrations/20261116200000_firm_scope_unsubmitted_data.sql
\i supabase/migrations/20261116200500_firm_scope_fixes.sql
\i supabase/migrations/20261116210000_console_per_firm.sql
\i supabase/migrations/20261116210500_console_per_firm_fixes.sql
\i supabase/migrations/20261116210600_mailbox_kept_for_members.sql
\i supabase/migrations/20261116220000_remove_or_suspend_a_member.sql
\i supabase/migrations/20261116220500_remove_or_suspend_fixes.sql
\i supabase/migrations/20261116230000_firm_suspension.sql
\i supabase/migrations/20261116240000_held_mail_to_the_right_firm.sql
\i supabase/migrations/20261117090000_one_firm_at_a_time.sql
\i supabase/migrations/20261117090500_one_firm_at_a_time_fixes.sql
\i supabase/migrations/20261117100000_queue_query.sql
\i supabase/migrations/20261117100500_queue_query_fast_path.sql
\i supabase/migrations/20261117120000_table_settings.sql
\i supabase/migrations/20261117120500_table_settings_fixes.sql
\i supabase/migrations/20261117160000_epics_reconciled.sql
\i supabase/migrations/20261118090000_leave_a_firm.sql
\i supabase/migrations/20261118090500_leave_a_firm_fixes.sql
\i supabase/migrations/20261118100000_join_by_organisation.sql
\i supabase/migrations/20261118100500_join_by_organisation_fixes.sql
\i supabase/migrations/20261118110000_close_a_firm.sql
\i supabase/migrations/20261118110500_close_a_firm_fixes.sql
\i supabase/migrations/20261118111000_close_a_firm_races.sql
\i supabase/migrations/20261118120000_help_from_nevermore.sql
\i supabase/migrations/20261118120500_help_from_nevermore_fixes.sql
\i supabase/migrations/20261118130000_record_history.sql
\i supabase/migrations/20261118130500_record_history_fixes.sql
\i supabase/migrations/20261118140000_menu_counts.sql
\i supabase/migrations/20261118140500_menu_counts_fixes.sql
\i supabase/migrations/20261118150000_queue_sort_collation.sql
\i supabase/migrations/20261118160000_record_version.sql
\i supabase/migrations/20261118160500_record_version_fixes.sql
\i supabase/migrations/20261118170000_export.sql
\i supabase/migrations/20261118170500_export_fixes.sql
\i supabase/migrations/20261118171000_export_fixes_again.sql
\i supabase/migrations/20261118180000_epic3_export_supersedes.sql
\i supabase/migrations/20261118180500_epic3_export_pause.sql
\i supabase/migrations/20261119090000_export.sql
\i supabase/migrations/20261119090500_epic3_export_carried.sql
\i supabase/migrations/20261119090600_epic3_export_pause_end.sql
\i supabase/migrations/20261119100000_crm_records.sql
\i supabase/migrations/20261119110000_chain_at_certification.sql
\i supabase/migrations/20261119120000_bring_submissions_in.sql
\i supabase/migrations/20261119140000_account_page.sql
\i supabase/migrations/20261119170000_add_contact.sql
\i supabase/migrations/20261123190000_intake_teaches_account.sql
SET client_min_messages = notice;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM set_config('request.headers', '', false);
END $$;

-- Signs in as a person, at a firm's address when one is named (D-40).
CREATE FUNCTION pg_temp.as_user(n text, addr text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  PERFORM set_config('request.headers', CASE WHEN addr IS NULL THEN '' ELSE jsonb_build_object('x-firm-address', addr)::text END, false);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', false);
  PERFORM set_config('request.headers', '', false);
  SET LOCAL ROLE service_role;
END $$;

CREATE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  PERFORM set_config('request.headers', '', false);
  SET LOCAL ROLE anon;
END $$;

CREATE FUNCTION pg_temp.is(got anyelement, want anyelement, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION 'FAIL: % gave %, expected %', label, got, want; END IF;
END $$;

-- Runs stmt and always rolls it back: 'rows:<n>' for the rows it touched, or the SQLSTATE it raised.
CREATE FUNCTION pg_temp.attempt(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint; s text; m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999', MESSAGE = n::text;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    IF s = 'ZZ999' THEN RETURN 'rows:' || m; END IF;
    RETURN s;
  END;
END $$;

-- A verified prospect, signed in as themselves, who has agreed to the intake consent (the Chamber needs it before an intake starts), with the
-- profile's contact name and phone when given. Named n in fx; their email is n@example.test.
CREATE FUNCTION pg_temp.new_prospect(n text, p_contact_name text DEFAULT NULL, p_phone text DEFAULT NULL, p_email text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.as_owner();
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', COALESCE(p_email, n || '@example.test'), now(), false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  UPDATE public.profiles SET contact_name = p_contact_name, phone = p_phone WHERE user_id = uid;
  PERFORM pg_temp.as_user(n);
  PERFORM public.record_intake_consent(public.intake_consent_version(), 'I agree to how my information is used.');
  RESET ROLE;
  RETURN uid;
END $$;

-- The answers an employer gives that the chain reads, and some it must never read: the FEIN, the census, an employee's name.
CREATE FUNCTION pg_temp.answers(p_company text, p_state text DEFAULT 'TX', p_extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'company_name', p_company, 'hq_state', p_state, 'states', jsonb_build_array(p_state, 'CA'), 'employee_count', 12, 'pay_frequency', 'bi-weekly',
    'industry', 'Dental practice', 'street_address', '500 Harbor Street, Suite 300, Austin, TX 78701', 'website', 'https://www.Harborview.example/about',
    'start_month', 'March 2027', 'in_peo', true, 'current_peo', 'Paychex PEO', 'fein', '123456789',
    'census', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'first_name', 'Zelda', 'last_name', 'Censusperson', 'dob', '1988-03-15')))
  || p_extra
$$;

-- A draft an employer started: the prospect saves it as themselves, so the browser's rules apply (the default firm, D-101), then the superuser moves it
-- to another firm when one is named. Named n in fx.
CREATE FUNCTION pg_temp.start_intake(n text, p_prospect text, p_data jsonb, p_firm text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.as_user(p_prospect);
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id(p_prospect), p_data) RETURNING id INTO sid;
  PERFORM pg_temp.as_owner();
  IF p_firm IS NOT NULL THEN UPDATE public.chamber_sessions SET firm_id = pg_temp.id(p_firm) WHERE id = sid; END IF;
  INSERT INTO fx VALUES (n, sid);
  RETURN sid;
END $$;

-- Certifies an intake over its saved answers as its prospect, as the Reckoning does. 'ok', or the SQLSTATE and message it was refused with.
CREATE FUNCTION pg_temp.certify(n text, p_prospect text, p_signer text DEFAULT 'Jo Doe') RETURNS text LANGUAGE plpgsql AS $$
DECLARE data jsonb; s text; m text;
BEGIN
  PERFORM pg_temp.as_user(p_prospect);
  SELECT chamber_data INTO data FROM public.chamber_sessions WHERE id = pg_temp.id(n);
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
      'signer_name', p_signer, 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z', 'consent_version', '2026-10-draft-1',
      'consent_text', '["I certify."]'::jsonb, 'chamber_data', data) WHERE id = pg_temp.id(n);
    PERFORM pg_temp.as_owner();
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    PERFORM pg_temp.as_owner();
    RETURN s || ': ' || m;
  END;
END $$;

-- The chain of an intake, as one line per kind: the account, the contact, the opportunity. NULL for none.
CREATE FUNCTION pg_temp.opp(n text) RETURNS public.opportunities LANGUAGE sql AS $$ SELECT o FROM public.opportunities o WHERE o.intake_id = pg_temp.id(n) $$;
CREATE FUNCTION pg_temp.acct(n text) RETURNS public.accounts LANGUAGE sql AS $$ SELECT a FROM public.accounts a JOIN public.opportunities o ON o.account_id = a.id WHERE o.intake_id = pg_temp.id(n) $$;

-- ---------- set up: two firms, one member each ----------
DO $$
DECLARE acme uuid; zenith uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith), ('default', public.default_firm_id());
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'acme_owner@example.test', now(), false, now(), now()) RETURNING id INTO acme;
  INSERT INTO fx VALUES ('acme_owner', acme);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), acme, 'owner');
END $$;

-- An account an agent made (New quote), with an intake the employer's prospect started on its opportunity. Named 'a_<tag>' and 'i_<tag>' in fx.
CREATE FUNCTION pg_temp.agent_account(tag text, p_data jsonb, p_account_name text DEFAULT 'The Agent''s Account') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid; a uuid;
BEGIN
  PERFORM pg_temp.new_prospect(tag, 'Pat ' || tag);
  sid := pg_temp.start_intake('i_' || tag, tag, p_data, 'acme');
  INSERT INTO public.accounts (firm_id, name, source) VALUES (pg_temp.id('acme'), p_account_name, 'added_by_hand') RETURNING id INTO a;
  INSERT INTO public.opportunities (firm_id, account_id, intake_id, name) VALUES (pg_temp.id('acme'), a, sid, 'Agent''s search');
  INSERT INTO fx VALUES ('a_' || tag, a);
  RETURN a;
END $$;

-- ---------- a certification fills the account's empty industry, and nothing of the intake's private answers ----------
-- Break caught: an intake an agent started is certified and the account stays as empty as it was; or the FEIN, the census or an employee's name is carried
-- to the account with it (ADR 0006).
DO $$
DECLARE a uuid; blob text;
BEGIN
  a := pg_temp.agent_account('t1', pg_temp.answers('Teach One LLC'));
  PERFORM pg_temp.is(pg_temp.certify('i_t1', 't1'), 'ok', 'the employer certifies');
  PERFORM pg_temp.is((SELECT industry FROM public.accounts WHERE id = a), 'Dental practice', 'the empty industry is filled from the certified answers (D-1715)');
  SELECT string_agg(e.value, ' ') INTO blob
  FROM (SELECT to_jsonb(x) AS j FROM public.accounts x WHERE x.id = a UNION ALL SELECT to_jsonb(c) FROM public.contacts c WHERE c.account_id = a) r, jsonb_each_text(r.j) e
  WHERE e.value IS NOT NULL AND e.value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND e.value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9:.+-]+$';
  PERFORM pg_temp.is(blob LIKE '%123456789%' OR blob LIKE '%Zelda%' OR blob LIKE '%Censusperson%' OR blob LIKE '%1988%', false, 'no FEIN and nothing of the census reaches the account (ADR 0006)');
  RAISE NOTICE 'intake_teaches_account: industry filled';
END $$;

-- ---------- a value the account already has is left as the firm has it ----------
-- Break caught: a certification overwrites an industry the firm typed.
DO $$
DECLARE a uuid;
BEGIN
  a := pg_temp.agent_account('t2', pg_temp.answers('Teach Two LLC'));
  UPDATE public.accounts SET industry = 'Law firm' WHERE id = a;
  PERFORM pg_temp.is(pg_temp.certify('i_t2', 't2'), 'ok', 'the employer certifies');
  PERFORM pg_temp.is((SELECT industry FROM public.accounts WHERE id = a), 'Law firm', 'the industry the account holds is not changed (D-196)');
  RAISE NOTICE 'intake_teaches_account: a held value stays';
END $$;

-- ---------- employees ----------
-- Break caught: the certified employee count is not copied to an account that has none, or one the firm set is overwritten.
DO $$
DECLARE a uuid; b uuid;
BEGIN
  a := pg_temp.agent_account('t3', pg_temp.answers('Teach Three LLC'));
  b := pg_temp.agent_account('t3b', pg_temp.answers('Teach Three B LLC'));
  UPDATE public.accounts SET employees = 40 WHERE id = b;
  PERFORM pg_temp.is(pg_temp.certify('i_t3', 't3'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.certify('i_t3b', 't3b'), 'ok', 'certified, the other');
  PERFORM pg_temp.is((SELECT employees FROM public.accounts WHERE id = a), 12, 'the empty employee count is filled');
  PERFORM pg_temp.is((SELECT employees FROM public.accounts WHERE id = b), 40, 'a count the firm set is kept');
  RAISE NOTICE 'intake_teaches_account: employees';
END $$;

-- ---------- states of operation ----------
-- Break caught: the states are not copied to an account with none, or a list the firm typed is replaced or added to; the same state twice is not stored twice.
DO $$
DECLARE a uuid; b uuid;
BEGIN
  a := pg_temp.agent_account('t4', pg_temp.answers('Teach Four LLC', 'TX', '{"states":["TX","CA","TX"]}'));
  b := pg_temp.agent_account('t4b', pg_temp.answers('Teach Four B LLC'));
  UPDATE public.accounts SET states_of_operation = ARRAY['NY'] WHERE id = b;
  PERFORM pg_temp.is(pg_temp.certify('i_t4', 't4'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.certify('i_t4b', 't4b'), 'ok', 'certified, the other');
  PERFORM pg_temp.is((SELECT states_of_operation FROM public.accounts WHERE id = a), ARRAY['TX', 'CA'], 'the empty list is filled: each once, in the order given');
  PERFORM pg_temp.is((SELECT states_of_operation FROM public.accounts WHERE id = b), ARRAY['NY'], 'a list the firm typed is kept as it is');
  RAISE NOTICE 'intake_teaches_account: states';
END $$;

-- ---------- current provider ----------
-- Break caught: the provider is not copied, a held one is replaced, or an employer who says they are in no PEO is given the PEO name left in their answers.
DO $$
DECLARE a uuid; b uuid; c uuid;
BEGIN
  a := pg_temp.agent_account('t5', pg_temp.answers('Teach Five LLC'));
  b := pg_temp.agent_account('t5b', pg_temp.answers('Teach Five B LLC'));
  c := pg_temp.agent_account('t5c', pg_temp.answers('Teach Five C LLC', 'TX', '{"in_peo":false}'));
  UPDATE public.accounts SET current_provider = 'ADP TotalSource' WHERE id = b;
  PERFORM pg_temp.is(pg_temp.certify('i_t5', 't5'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.certify('i_t5b', 't5b'), 'ok', 'certified, the second');
  PERFORM pg_temp.is(pg_temp.certify('i_t5c', 't5c'), 'ok', 'certified, the third');
  PERFORM pg_temp.is((SELECT current_provider FROM public.accounts WHERE id = a), 'Paychex PEO', 'the empty provider is filled');
  PERFORM pg_temp.is((SELECT current_provider FROM public.accounts WHERE id = b), 'ADP TotalSource', 'a provider the firm typed is kept');
  PERFORM pg_temp.is((SELECT current_provider FROM public.accounts WHERE id = c), NULL::text, 'in no PEO: no provider');
  RAISE NOTICE 'intake_teaches_account: provider';
END $$;

-- ---------- address and website ----------
-- Break caught: the street, the state or the website is not filled, or one the firm typed is replaced. (A street held with no state, and the reverse, are filled
-- and kept each on its own.)
DO $$
DECLARE a uuid; b uuid;
BEGIN
  a := pg_temp.agent_account('t6', pg_temp.answers('Teach Six LLC'));
  b := pg_temp.agent_account('t6b', pg_temp.answers('Teach Six B LLC'));
  UPDATE public.accounts SET street = '1 Main St', website = 'https://own.example' WHERE id = b;
  PERFORM pg_temp.is(pg_temp.certify('i_t6', 't6'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.certify('i_t6b', 't6b'), 'ok', 'certified, the other');
  PERFORM pg_temp.is((SELECT street FROM public.accounts WHERE id = a), '500 Harbor Street, Suite 300, Austin, TX 78701', 'the empty street is filled');
  PERFORM pg_temp.is((SELECT state FROM public.accounts WHERE id = a), 'TX', 'and the state');
  PERFORM pg_temp.is((SELECT website FROM public.accounts WHERE id = a), 'https://www.Harborview.example/about', 'and the website (D-226)');
  PERFORM pg_temp.is((SELECT street || ' ' || website FROM public.accounts WHERE id = b), '1 Main St https://own.example', 'the firm''s street and website are kept');
  PERFORM pg_temp.is((SELECT state FROM public.accounts WHERE id = b), 'TX', 'while the state it had none of is filled');
  RAISE NOTICE 'intake_teaches_account: address and website';
END $$;

-- ---------- the certifier becomes a contact ----------
-- Break caught: the person who certified is not a contact of the account their intake sits on.
DO $$
DECLARE a uuid; c public.contacts;
BEGIN
  a := pg_temp.agent_account('t7', pg_temp.answers('Teach Seven LLC'));
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a), 0::bigint, 'the agent''s account has no contact');
  PERFORM pg_temp.is(pg_temp.certify('i_t7', 't7'), 'ok', 'certified');
  SELECT * INTO c FROM public.contacts WHERE account_id = a;
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a), 1::bigint, 'the certifier is now a contact');
  PERFORM pg_temp.is(c.email, 't7@example.test', 'with their email');
  PERFORM pg_temp.is(c.first_name || ' ' || c.last_name, 'Pat t7', 'and the name from their profile');
  PERFORM pg_temp.is(c.prospect_user_id, pg_temp.id('t7'), 'linked to the prospect (D-194)');
  PERFORM pg_temp.is(c.owner_id, NULL::uuid, 'owned by nobody, as the chain''s contact is');
  PERFORM pg_temp.is(c.firm_id, pg_temp.id('acme'), 'in the account''s firm');
  RAISE NOTICE 'intake_teaches_account: certifier contact';
END $$;

-- ---------- a contact with the certifier's email is not added again ----------
-- Break caught: the certifier is added to an account whose contact already has their email (typed in another case, by an agent), making a second person of one.
DO $$
DECLARE a uuid; b uuid;
BEGIN
  a := pg_temp.agent_account('t8', pg_temp.answers('Teach Eight LLC'));
  INSERT INTO public.contacts (firm_id, account_id, first_name, last_name, email) VALUES (pg_temp.id('acme'), a, 'Patricia', 'Eight', 'T8@Example.TEST');
  b := pg_temp.agent_account('t8b', pg_temp.answers('Teach Eight B LLC'));
  INSERT INTO public.contacts (firm_id, account_id, first_name, last_name, email) VALUES (pg_temp.id('acme'), b, 'Someone', 'Else', 'else@example.test');
  PERFORM pg_temp.is(pg_temp.certify('i_t8', 't8'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.certify('i_t8b', 't8b'), 'ok', 'certified, the other');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a), 1::bigint, 'the contact with their email, in another case, is them: no second one');
  PERFORM pg_temp.is((SELECT first_name FROM public.contacts WHERE account_id = a), 'Patricia', 'and it is left as the firm wrote it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = b), 2::bigint, 'a contact with another email does not stop them being added');
  RAISE NOTICE 'intake_teaches_account: email match';
END $$;

-- ---------- the main contact is never displaced ----------
-- Break caught: the certifier takes over as the main contact of an account that has one (or the unique main-contact index fails the certification); or an
-- account with no main contact is left with none.
DO $$
DECLARE a uuid; b uuid;
BEGIN
  a := pg_temp.agent_account('t9', pg_temp.answers('Teach Nine LLC'));
  INSERT INTO public.contacts (firm_id, account_id, first_name, last_name, email, is_main) VALUES (pg_temp.id('acme'), a, 'Main', 'Person', 'main@example.test', true);
  b := pg_temp.agent_account('t9b', pg_temp.answers('Teach Nine B LLC'));
  PERFORM pg_temp.is(pg_temp.certify('i_t9', 't9'), 'ok', 'certified over an account that has a main contact');
  PERFORM pg_temp.is(pg_temp.certify('i_t9b', 't9b'), 'ok', 'certified over an account that has none');
  PERFORM pg_temp.is((SELECT email FROM public.contacts WHERE account_id = a AND is_main), 'main@example.test', 'the main contact is still the one the firm chose');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE account_id = a AND prospect_user_id IS NOT NULL), false, 'the certifier is one more contact');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE account_id = b), true, 'with no main contact, the certifier is the main one (as in a chain made for a new account)');
  RAISE NOTICE 'intake_teaches_account: main contact';
END $$;

-- ---------- a certifier who can't be reached is no contact, and an archived account is left alone ----------
-- Break caught: a prospect with neither a usable email nor a phone is added as an empty contact (or fails the certification, ADR 0025); an archived account
-- (which add_contact refuses, D-222) is given a contact or has its fields filled.
DO $$
DECLARE a uuid; b uuid; p uuid;
BEGIN
  a := pg_temp.agent_account('t10', pg_temp.answers('Teach Ten LLC'));
  UPDATE auth.users SET email = NULL WHERE id = pg_temp.id('t10');
  b := pg_temp.agent_account('t10b', pg_temp.answers('Teach Ten B LLC'));
  UPDATE public.accounts SET archived_at = now() WHERE id = b;
  PERFORM pg_temp.is(pg_temp.certify('i_t10', 't10'), 'ok', 'a certifier with no email and no phone certifies');
  PERFORM pg_temp.is(pg_temp.certify('i_t10b', 't10b'), 'ok', 'an intake on an archived account certifies');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a), 0::bigint, 'no contact is made from nothing to reach them by');
  PERFORM pg_temp.is((SELECT industry FROM public.accounts WHERE id = a), 'Dental practice', 'though the account is still filled');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = b), 0::bigint, 'an archived account gets no contact');
  PERFORM pg_temp.is((SELECT industry FROM public.accounts WHERE id = b), NULL::text, 'and no fields filled');
  RAISE NOTICE 'intake_teaches_account: unreachable certifier and archived account';
END $$;

-- What the account page asks, as the firm's owner.
CREATE FUNCTION pg_temp.says(p_account text, p_as text DEFAULT 'acme_owner') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(p_as, 'acme-brokers');
  r := public.account_intake_says(pg_temp.id('acme'), pg_temp.id(p_account));
  PERFORM pg_temp.as_owner();
  RETURN r;
END $$;

-- ---------- where the account differs, the intake says so ----------
-- Break caught: an account holding a different industry than the one certified shows nothing of it.
DO $$
DECLARE a uuid;
BEGIN
  a := pg_temp.agent_account('t13', pg_temp.answers('Teach Thirteen LLC'));
  UPDATE public.accounts SET industry = 'Law firm' WHERE id = a;
  PERFORM pg_temp.is(pg_temp.certify('i_t13', 't13'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.says('a_t13') -> 'industry', '"Dental practice"'::jsonb, 'the page is told what the intake says of the industry (D-1715)');
  RAISE NOTICE 'intake_teaches_account: the intake says';
END $$;

-- ---------- a value that says the same is no suggestion ----------
-- Break caught: "The intake says Dental practice" is shown against an account that already says "dental practice " (case and spaces are no difference), or against one that says it exactly.
DO $$
DECLARE a uuid; b uuid;
BEGIN
  a := pg_temp.agent_account('t14', pg_temp.answers('Teach Fourteen LLC'));
  b := pg_temp.agent_account('t14b', pg_temp.answers('Teach Fourteen B LLC'));
  PERFORM pg_temp.is(pg_temp.certify('i_t14', 't14'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.certify('i_t14b', 't14b'), 'ok', 'certified, the other');
  PERFORM pg_temp.is(pg_temp.says('a_t14') ? 'industry', false, 'the account says what the intake says: nothing to suggest');
  UPDATE public.accounts SET industry = '  dental PRACTICE ' WHERE id = b;
  PERFORM pg_temp.is(pg_temp.says('a_t14b') ? 'industry', false, 'the same in another case, with spaces: nothing to suggest');
  RAISE NOTICE 'intake_teaches_account: same is no suggestion';
END $$;

-- ---------- employees ----------
-- Break caught: "The intake says 23" is not shown when the account's count differs, or is shown when they are the same.
DO $$
DECLARE a uuid; b uuid;
BEGIN
  a := pg_temp.agent_account('t15', pg_temp.answers('Teach Fifteen LLC', 'TX', '{"employee_count":23}'));
  b := pg_temp.agent_account('t15b', pg_temp.answers('Teach Fifteen B LLC', 'TX', '{"employee_count":23}'));
  UPDATE public.accounts SET employees = 40 WHERE id = a;
  UPDATE public.accounts SET employees = 23 WHERE id = b;
  PERFORM pg_temp.is(pg_temp.certify('i_t15', 't15'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.certify('i_t15b', 't15b'), 'ok', 'certified, the other');
  PERFORM pg_temp.is(pg_temp.says('a_t15') -> 'employees', '23'::jsonb, 'the intake says 23 where the account says 40');
  PERFORM pg_temp.is(pg_temp.says('a_t15b') ? 'employees', false, 'and nothing where the account says 23 too');
  RAISE NOTICE 'intake_teaches_account: employees suggestion';
END $$;

-- ---------- states of operation ----------
-- Break caught: the states are not offered when the account's list differs, or are offered when it holds the same states in another order.
DO $$
DECLARE a uuid; b uuid;
BEGIN
  a := pg_temp.agent_account('t16', pg_temp.answers('Teach Sixteen LLC', 'TX', '{"states":["TX","CA"]}'));
  b := pg_temp.agent_account('t16b', pg_temp.answers('Teach Sixteen B LLC', 'TX', '{"states":["TX","CA"]}'));
  UPDATE public.accounts SET states_of_operation = ARRAY['TX', 'NY'] WHERE id = a;
  UPDATE public.accounts SET states_of_operation = ARRAY['CA', 'TX'] WHERE id = b;
  PERFORM pg_temp.is(pg_temp.certify('i_t16', 't16'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.certify('i_t16b', 't16b'), 'ok', 'certified, the other');
  PERFORM pg_temp.is(pg_temp.says('a_t16') -> 'states_of_operation', '["TX","CA"]'::jsonb, 'the intake says TX, CA where the account says TX, NY');
  PERFORM pg_temp.is(pg_temp.says('a_t16b') ? 'states_of_operation', false, 'the same states in another order are no difference');
  RAISE NOTICE 'intake_teaches_account: states suggestion';
END $$;

-- ---------- name, street and current provider ----------
-- Break caught: the certified legal name, street or provider is not offered where the account's differs; a provider is offered to an employer who says they are in no PEO.
DO $$
DECLARE a uuid; b uuid;
BEGIN
  a := pg_temp.agent_account('t17', pg_temp.answers('Teach Seventeen LLC'), 'Seventeen (the firm''s name)');
  b := pg_temp.agent_account('t17b', pg_temp.answers('Teach Seventeen B LLC', 'TX', '{"in_peo":false}'));
  UPDATE public.accounts SET street = '1 Main St', current_provider = 'ADP TotalSource' WHERE id IN (a, b);
  PERFORM pg_temp.is(pg_temp.certify('i_t17', 't17'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.certify('i_t17b', 't17b'), 'ok', 'certified, the other');
  PERFORM pg_temp.is(pg_temp.says('a_t17') -> 'name', '"Teach Seventeen LLC"'::jsonb, 'the legal name is offered against the account''s name');
  PERFORM pg_temp.is(pg_temp.says('a_t17') -> 'street', '"500 Harbor Street, Suite 300, Austin, TX 78701"'::jsonb, 'the street');
  PERFORM pg_temp.is(pg_temp.says('a_t17') -> 'current_provider', '"Paychex PEO"'::jsonb, 'the provider');
  PERFORM pg_temp.is(pg_temp.says('a_t17b') ? 'current_provider', false, 'no provider is offered for an employer in no PEO');
  RAISE NOTICE 'intake_teaches_account: name, street, provider suggestions';
END $$;

-- ---------- state and website ----------
-- Break caught: the headquarters state or the website is not offered where the account's differs, or is when it is the same.
DO $$
DECLARE a uuid; b uuid;
BEGIN
  a := pg_temp.agent_account('t18', pg_temp.answers('Teach Eighteen LLC'));
  b := pg_temp.agent_account('t18b', pg_temp.answers('Teach Eighteen B LLC'));
  UPDATE public.accounts SET state = 'NY', website = 'https://own.example' WHERE id = a;
  UPDATE public.accounts SET state = 'TX', website = 'https://www.Harborview.example/about' WHERE id = b;
  PERFORM pg_temp.is(pg_temp.certify('i_t18', 't18'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.certify('i_t18b', 't18b'), 'ok', 'certified, the other');
  PERFORM pg_temp.is(pg_temp.says('a_t18') -> 'state', '"TX"'::jsonb, 'the intake says TX where the account says NY');
  PERFORM pg_temp.is(pg_temp.says('a_t18') -> 'website', '"https://www.Harborview.example/about"'::jsonb, 'and its website where the account has another');
  PERFORM pg_temp.is(pg_temp.says('a_t18b') ? 'state' OR pg_temp.says('a_t18b') ? 'website', false, 'nothing where they are the same');
  RAISE NOTICE 'intake_teaches_account: state and website suggestions';
END $$;

-- ---------- "Use it" is an edit of the account, and the history says who did what ----------
-- Break caught: using what the intake says leaves the suggestion on the page, or leaves no entry in the account's history; or the filling at certification
-- leaves none (a changed field with no record of how it changed).
CREATE FUNCTION pg_temp.history(p_account text, p_field text) RETURNS TABLE (who text, who_kind text, from_value jsonb, to_value jsonb) LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  RETURN QUERY SELECT h.who, h.who_kind, h.from_value, h.to_value FROM public.record_history_list(pg_temp.id('acme'), 'accounts', pg_temp.id(p_account)::text) h
    WHERE h.field = p_field ORDER BY h.at DESC, h.entry_key DESC;
  PERFORM pg_temp.as_owner();
END $$;

DO $$
DECLARE a uuid; r jsonb; ver integer; h record;
BEGIN
  a := pg_temp.agent_account('t19', pg_temp.answers('Teach Nineteen LLC'));
  UPDATE public.accounts SET employees = 40 WHERE id = a;
  PERFORM pg_temp.is(pg_temp.certify('i_t19', 't19'), 'ok', 'certified');
  SELECT * INTO h FROM pg_temp.history('a_t19', 'industry') LIMIT 1;
  PERFORM pg_temp.is(h.to_value, '"Dental practice"'::jsonb, 'the filling of the industry is in the account''s history');
  PERFORM pg_temp.is(h.who_kind, 'member', 'as a change by a person (the employer''s prospect), not by the system');
  PERFORM pg_temp.is(pg_temp.says('a_t19') -> 'employees', '12'::jsonb, 'the intake says 12 where the account says 40');
  -- Use it: the account page saves the account with that one field changed, as any edit of it (update_account).
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  SELECT version INTO ver FROM public.accounts WHERE id = a;
  r := public.update_account(a, (SELECT name FROM public.accounts WHERE id = a), NULL, (SELECT website FROM public.accounts WHERE id = a), NULL,
    (SELECT street FROM public.accounts WHERE id = a), NULL, (SELECT state FROM public.accounts WHERE id = a), NULL, (SELECT industry FROM public.accounts WHERE id = a),
    12, (SELECT states_of_operation FROM public.accounts WHERE id = a), (SELECT current_provider FROM public.accounts WHERE id = a), pg_temp.id('acme'), ver);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, false, 'the save is accepted');
  PERFORM pg_temp.is(pg_temp.says('a_t19') ? 'employees', false, 'used: the suggestion is gone');
  SELECT * INTO h FROM pg_temp.history('a_t19', 'employees') LIMIT 1;
  PERFORM pg_temp.is(h.from_value || h.to_value, '[40,12]'::jsonb, 'the history shows 40 became 12');
  PERFORM pg_temp.is(h.who, 'acme_owner@example.test', 'by the person who used it');
  RAISE NOTICE 'intake_teaches_account: use it and history';
END $$;

-- ---------- the next certification changes what the intake says; a withdrawn one says nothing ----------
-- Break caught: the page keeps offering the first certification's value after the employer certified another; or offers what a withdrawn certification said
-- while the employer's answers are being changed.
DO $$
DECLARE a uuid; sid uuid;
BEGIN
  a := pg_temp.agent_account('t20', pg_temp.answers('Teach Twenty LLC'));
  sid := pg_temp.id('i_t20');
  UPDATE public.accounts SET industry = 'Law firm' WHERE id = a;
  PERFORM pg_temp.is(pg_temp.certify('i_t20', 't20'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.says('a_t20') -> 'industry', '"Dental practice"'::jsonb, 'the first certification says Dental practice');
  PERFORM pg_temp.as_user('t20');
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"industry":"Restaurant"}' WHERE id = sid;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = sid), 'in_progress', 'the employer changed an answer: the certification is withdrawn');
  PERFORM pg_temp.is(pg_temp.says('a_t20'), '{}'::jsonb, 'a withdrawn certification suggests nothing');
  PERFORM pg_temp.is(pg_temp.certify('i_t20', 't20'), 'ok', 'certified again');
  PERFORM pg_temp.is(pg_temp.says('a_t20') -> 'industry', '"Restaurant"'::jsonb, 'now it says Restaurant: the value the next certification changed it to');
  PERFORM pg_temp.is((SELECT industry FROM public.accounts WHERE id = a), 'Law firm', 'and the account is as the firm has it');
  RAISE NOTICE 'intake_teaches_account: the next certification';
END $$;

-- ---------- only someone who may see the account is told ----------
-- Break caught: the employer's prospect, someone of another firm or an account that is not there is answered with what the intake says (or an error that tells a
-- record exists); the answer names the wrong firm's account.
DO $$
DECLARE a uuid; r jsonb;
BEGIN
  a := pg_temp.agent_account('t21', pg_temp.answers('Teach Twentyone LLC'));
  PERFORM pg_temp.is(pg_temp.certify('i_t21', 't21'), 'ok', 'certified');
  PERFORM pg_temp.is(pg_temp.says('a_t21') ? 'name', true, 'the firm''s owner is told');
  PERFORM pg_temp.is(pg_temp.says('a_t21', 't21'), NULL::jsonb, 'the employer''s prospect, who is not in the firm, is told nothing');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.account_intake_says(pg_temp.id('zenith'), a);
  PERFORM pg_temp.is(r, NULL::jsonb, 'the account asked for under another firm is as not there');
  r := public.account_intake_says(pg_temp.id('acme'), gen_random_uuid());
  PERFORM pg_temp.is(r, NULL::jsonb, 'an account that is not there is as not there');
  r := public.account_intake_says(NULL, NULL);
  PERFORM pg_temp.is(r, NULL::jsonb, 'and nothing named is nothing');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.account_intake_says(%L, %L)', pg_temp.id('acme'), a)), '42501', 'anon may not call it');
  PERFORM pg_temp.as_owner();
  RAISE NOTICE 'intake_teaches_account: who is told';
END $$;

-- ---------- a chain made at the first certification has nothing to suggest, and each later certification teaches it again ----------
-- Break caught: a freshly made chain's account is offered its own values back, or its prospect is made a second contact; a later certification fills nothing
-- of what the firm emptied meanwhile, or the answer carries the FEIN, the census or an employee (ADR 0006).
DO $$
DECLARE sid uuid; a uuid; blob text; k text;
BEGIN
  PERFORM pg_temp.new_prospect('t22', 'Pat t22');
  sid := pg_temp.start_intake('i_t22', 't22', pg_temp.answers('Teach Twentytwo LLC'), 'acme');
  PERFORM pg_temp.is(pg_temp.certify('i_t22', 't22'), 'ok', 'certified for the first time: the chain is made');
  a := (pg_temp.acct('i_t22')).id;
  INSERT INTO fx VALUES ('a_t22', a);
  PERFORM pg_temp.is(pg_temp.says('a_t22'), '{}'::jsonb, 'the account made from the intake has nothing to be told');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a), 1::bigint, 'and one contact, the prospect');

  UPDATE public.accounts SET industry = NULL, employees = NULL, name = 'The firm''s own name' WHERE id = a;
  PERFORM pg_temp.as_user('t22');
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"employee_count":31}' WHERE id = sid;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.certify('i_t22', 't22'), 'ok', 'certified again');
  PERFORM pg_temp.is((SELECT employees FROM public.accounts WHERE id = a), 31, 'the second certification fills what the firm emptied (every certification, not only the first)');
  PERFORM pg_temp.is((SELECT industry FROM public.accounts WHERE id = a), 'Dental practice', 'all of it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a), 1::bigint, 'the prospect is still one contact');
  PERFORM pg_temp.is(pg_temp.says('a_t22') -> 'name', '"Teach Twentytwo LLC"'::jsonb, 'and the name the firm changed is offered, not put back');

  -- ADR 0006: only the eight fields an account has can be in the answer, and none of the intake's private answers.
  UPDATE public.accounts SET name = 'x', street = 'x', state = 'NY', website = 'x', industry = 'x', employees = 1, states_of_operation = ARRAY['NY'], current_provider = 'x' WHERE id = a;
  FOR k IN SELECT jsonb_object_keys(pg_temp.says('a_t22')) LOOP
    PERFORM pg_temp.is(k = ANY (ARRAY['name', 'website', 'street', 'state', 'industry', 'employees', 'states_of_operation', 'current_provider']), true, 'the field ' || k || ' is one of the account''s');
  END LOOP;
  blob := pg_temp.says('a_t22')::text;
  PERFORM pg_temp.is(blob LIKE '%123456789%' OR blob LIKE '%Zelda%' OR blob LIKE '%Censusperson%' OR blob LIKE '%1988%', false, 'no FEIN and nothing of the census in what the page is told (ADR 0006)');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_object_keys(pg_temp.says('a_t22'))), 8::bigint, 'all eight differ, so all eight are offered');
  RAISE NOTICE 'intake_teaches_account: later certifications and ADR 0006';
END $$;
