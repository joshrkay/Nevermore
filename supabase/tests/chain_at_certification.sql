-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh chain_at_certification
-- The chain at the first certification (story CRM-Q1.1b; docs/BROKER_CRM_BUILD.md D-29, D-32, D-101, D-188, D-192, D-193, D-194, D-196, D-211, D-214;
-- ADR 0006, 0023, 0024, 0025; 20261119110000_chain_at_certification.sql). When an intake an employer started is first certified, the same transaction
-- makes its account (or, when the duplicate match finds one, a new account marked as a possible duplicate of it), the account's fields from the
-- certified answers, the contact from the prospect (the main contact) and the opportunity that holds the intake. Every certification here is the real
-- one: the prospect saves the intake as themselves, with the role the browser has. Every migration is loaded, in filename order (D-105).
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

-- ---------- the first certification makes the chain ----------
-- Break caught: a certified intake has no account, no contact or no opportunity; or one of them is made wrong (another firm, an owner, no source, the
-- FEIN or an employee on the account).
DO $$
DECLARE p uuid; sid uuid; a public.accounts; o public.opportunities; c public.contacts; blob text;
BEGIN
  p := pg_temp.new_prospect('jo', 'Jo Q Doe', '555-0100');
  sid := pg_temp.start_intake('i_harbor', 'jo', pg_temp.answers('Harborview Dental Group'), 'acme');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), 0::bigint, 'a draft makes no account (ADR 0025)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities), 0::bigint, 'nor an opportunity');
  PERFORM pg_temp.is(pg_temp.certify('i_harbor', 'jo'), 'ok', 'the prospect certifies');

  a := pg_temp.acct('i_harbor'); o := pg_temp.opp('i_harbor');
  PERFORM pg_temp.is(o.id IS NOT NULL, true, 'the intake is on an opportunity');
  PERFORM pg_temp.is(o.intake_id, sid, 'which holds it');
  PERFORM pg_temp.is(o.firm_id, pg_temp.id('acme'), 'in the intake''s firm');
  PERFORM pg_temp.is(o.owner_id, NULL::uuid, 'owned by nobody (D-214)');
  PERFORM pg_temp.is(o.name, 'March 2027 PEO search', 'named for the start month (D-188)');
  PERFORM pg_temp.is(a.firm_id, pg_temp.id('acme'), 'the account is in the same firm');
  PERFORM pg_temp.is(a.owner_id, NULL::uuid, 'owned by nobody');
  PERFORM pg_temp.is(a.source, 'employer_intake', 'its source is Employer''s intake (D-211)');
  PERFORM pg_temp.is(a.name, 'Harborview Dental Group', 'named from the certified legal name');
  PERFORM pg_temp.is(a.street, '500 Harbor Street, Suite 300, Austin, TX 78701', 'its address');
  PERFORM pg_temp.is(a.state, 'TX', 'its state');
  PERFORM pg_temp.is(a.states_of_operation, ARRAY['TX', 'CA'], 'its states of operation');
  PERFORM pg_temp.is(a.employees, 12, 'its employees');
  PERFORM pg_temp.is(a.industry, 'Dental practice', 'its industry');
  PERFORM pg_temp.is(a.current_provider, 'Paychex PEO', 'its current provider');
  PERFORM pg_temp.is(a.web_domain, 'harborview.example', 'its website, so the domain can match the next intake');
  PERFORM pg_temp.is(a.possible_duplicate_of, NULL::uuid, 'no match, so no mark');
  PERFORM pg_temp.is(a.archived_at, NULL::timestamptz, 'not archived');

  SELECT * INTO c FROM public.contacts WHERE account_id = a.id;
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a.id), 1::bigint, 'one contact, the prospect');
  PERFORM pg_temp.is(c.firm_id, pg_temp.id('acme'), 'in the same firm');
  PERFORM pg_temp.is(c.prospect_user_id, p, 'linked to the prospect (D-194)');
  PERFORM pg_temp.is(c.first_name, 'Jo Q', 'first name from the profile''s contact name');
  PERFORM pg_temp.is(c.last_name, 'Doe', 'last name');
  PERFORM pg_temp.is(c.email, 'jo@example.test', 'the prospect''s email');
  PERFORM pg_temp.is(c.phone, '555-0100', 'and phone');
  PERFORM pg_temp.is(c.is_main, true, 'the main contact (D-214)');
  PERFORM pg_temp.is(c.owner_id, NULL::uuid, 'owned by nobody');
  PERFORM pg_temp.is(o.main_contact_id, c.id, 'and the opportunity''s main contact, as New opportunity offers the account''s');
  PERFORM pg_temp.is(o.account_id, a.id, 'the opportunity is on that account');

  -- ADR 0006: the FEIN, the census and anything about an employee never reach the CRM.
  -- Only the records' own values are searched: their ids (random uuids) and timestamps can hold "1988" or a run of digits by chance, which made
  -- this check fail on a lucky draw while nothing of the intake had reached the CRM.
  SELECT string_agg(e.value, ' ') INTO blob
  FROM (SELECT to_jsonb(a) AS j UNION ALL SELECT to_jsonb(c) UNION ALL SELECT to_jsonb(o)) r, jsonb_each_text(r.j) e
  WHERE e.value IS NOT NULL
    AND e.value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND e.value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9:.+-]+$';
  PERFORM pg_temp.is(blob LIKE '%123456789%' OR blob LIKE '%Zelda%' OR blob LIKE '%Censusperson%' OR blob LIKE '%1988%', false, 'no FEIN and nothing of the census (ADR 0006)');
  RAISE NOTICE 'chain_at_certification: the first certification passed';
END $$;

-- ---------- certifying again changes nothing about the chain ----------
-- Break caught: a second certification, a certification after the answers changed, or the step run twice makes a second account, contact or
-- opportunity; or it rewrites the account the firm has since taken as its own.
DO $$
DECLARE before_chain jsonb; r jsonb; a public.accounts; sid uuid := pg_temp.id('i_harbor');
BEGIN
  SELECT jsonb_build_object('a', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.accounts x), 'c', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.contacts x),
    'o', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.opportunities x)) INTO before_chain;
  PERFORM pg_temp.is(pg_temp.certify('i_harbor', 'jo'), 'ok', 'the same certification sent again');
  PERFORM pg_temp.is(pg_temp.certify('i_harbor', 'jo', 'Another Signer'), 'ok', 'a new signer certifies the same answers again');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid), 2::bigint, 'the second signer''s certification was recorded');
  PERFORM pg_temp.is(jsonb_build_object('a', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.accounts x), 'c', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.contacts x),
    'o', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.opportunities x)), before_chain, 'certifying again changed nothing in the chain');

  -- The employer changes answers (withdrawing the certification) and certifies again; the firm has meanwhile changed the account.
  UPDATE public.accounts SET name = 'Harborview Dental (the firm''s own name)', employees = 40 WHERE id = (pg_temp.acct('i_harbor')).id;
  PERFORM pg_temp.as_user('jo');
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"company_name":"Harborview Dental Partners","employee_count":99,"start_month":"May 2027"}' WHERE id = sid;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = sid), 'in_progress', 'changing the answers withdrew the certification');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = sid), 1::bigint, 'the chain stays while the intake is a draft again');
  PERFORM pg_temp.is(pg_temp.certify('i_harbor', 'jo'), 'ok', 'certified again over the new answers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), 1::bigint, 'still one account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts), 1::bigint, 'one contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities), 1::bigint, 'one opportunity');
  a := pg_temp.acct('i_harbor');
  PERFORM pg_temp.is(a.name || ' / ' || a.employees, 'Harborview Dental (the firm''s own name) / 40', 'the account is not rewritten from the new answers (that is CRM-Q1.2)');
  PERFORM pg_temp.is((pg_temp.opp('i_harbor')).name, 'March 2027 PEO search', 'nor is the opportunity renamed');

  -- The step itself, run twice, or after the chain exists, answers the chain that is there.
  PERFORM pg_temp.as_owner();
  r := public.make_intake_chain(sid);
  PERFORM pg_temp.is((r ->> 'made')::boolean, false, 'the step run again makes nothing');
  PERFORM pg_temp.is((r ->> 'account_id')::uuid, a.id, 'and answers the account that is there');
  PERFORM pg_temp.is((r ->> 'opportunity_id')::uuid, (pg_temp.opp('i_harbor')).id, 'and its opportunity');
  -- The constraint, not only the check, is what refuses a second opportunity for an intake (D-29).
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, account_id, intake_id, name) VALUES (%L, %L, %L, 'Second')$q$, a.firm_id, a.id, sid)), '23505',
    'a second opportunity for the intake is refused by the database');
  RAISE NOTICE 'chain_at_certification: certifying again passed';
END $$;

-- ---------- an intake that already sits on an opportunity gets no second chain; a draft and a missing intake have none ----------
-- Break caught: the step makes an account for an intake an agent started (New quote, Epic 5) that already belongs to an opportunity (it teaches that account instead, slice 5.12); or it makes a chain for
-- a draft that was never certified.
DO $$
DECLARE sid uuid; a uuid; o uuid; r jsonb; before_accounts bigint;
BEGIN
  PERFORM pg_temp.new_prospect('agent_made');
  sid := pg_temp.start_intake('i_agent', 'agent_made', pg_temp.answers('Agent Made Co', 'NY'), 'acme');
  -- The agent's chain, made before the employer certifies: the account is the agent's, the intake already on its opportunity.
  INSERT INTO public.accounts (firm_id, name, source) VALUES (pg_temp.id('acme'), 'The Agent''s Account', 'added_by_hand') RETURNING id INTO a;
  INSERT INTO public.opportunities (firm_id, account_id, intake_id, name) VALUES (pg_temp.id('acme'), a, sid, 'Agent''s search') RETURNING id INTO o;
  SELECT count(*) INTO before_accounts FROM public.accounts;
  PERFORM pg_temp.is(pg_temp.certify('i_agent', 'agent_made'), 'ok', 'the employer certifies an intake an agent started');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), before_accounts, 'no account was added');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a AND prospect_user_id = pg_temp.id('agent_made') AND is_main), 1::bigint, 'the certifier is the agent''s account''s one contact, as the main one (CRM-Q1.2, D-1715)');
  PERFORM pg_temp.is((SELECT account_id FROM public.opportunities WHERE intake_id = sid), a, 'the intake stays on the agent''s opportunity');
  PERFORM pg_temp.is((SELECT name FROM public.opportunities WHERE id = o), 'Agent''s search', 'whose name is not changed');

  -- A draft has no chain, and asking for one is refused rather than answered with nothing.
  sid := pg_temp.start_intake('i_draft', 'agent_made', pg_temp.answers('Never Certified Inc'), 'acme');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.make_intake_chain(%L)', sid)), '55000', 'the step refuses an intake never certified');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.make_intake_chain(%L)', gen_random_uuid())), 'P0002', 'and an intake that is not there');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE name = 'Never Certified Inc'), 0::bigint, 'a draft makes no account');
  RAISE NOTICE 'chain_at_certification: intakes that have a chain, and drafts, passed';
END $$;

-- ---------- the duplicate match is exact, and a match never merges ----------
-- A new prospect whose intake for p_firm names the business, certified as the real thing. Their account is named 'a_<tag>' in fx; answers p_extra
-- replace the defaults (a null website or state is how an employer who left them out looks). Returns the account's id.
CREATE FUNCTION pg_temp.certified(tag text, p_firm text, p_company text, p_state text, p_website text DEFAULT NULL, p_email text DEFAULT NULL, p_extra jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.new_prospect(tag, 'Pat ' || tag, NULL, p_email);
  PERFORM pg_temp.start_intake('i_' || tag, tag,
    pg_temp.answers(p_company, COALESCE(p_state, 'TX'), jsonb_build_object('hq_state', p_state, 'website', p_website) || p_extra), p_firm);
  r := pg_temp.certify('i_' || tag, tag);
  IF r <> 'ok' THEN RAISE EXCEPTION 'FAIL: % could not certify: %', tag, r; END IF;
  INSERT INTO fx VALUES ('a_' || tag, (pg_temp.acct('i_' || tag)).id);
  -- The test runs in one transaction, where now() never moves: the account is made "later" than the ones before it.
  UPDATE public.accounts SET created_at = clock_timestamp() WHERE id = pg_temp.id('a_' || tag);
  RETURN pg_temp.id('a_' || tag);
END $$;

-- Break caught: the match keeps "Co." on the name, drops more than the last word, takes "Cost" for "Costco", loses the punctuation rule, or treats a
-- word that is not a designator as one.
DO $$
BEGIN
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(public.account_name_key('Acme'), 'acme', 'a plain name');
  PERFORM pg_temp.is(public.account_name_key('Acme Co.'), 'acme', 'Co. is dropped, with its dot');
  FOR i IN 1..9 LOOP
    PERFORM pg_temp.is(public.account_name_key((ARRAY['Acme LLC', 'ACME, Inc.', 'acme Corp', 'Acme L.L.C.', 'Acme, Ltd', 'Acme LLP.', 'Acme P.C.', 'Acme PLLC', 'Acme, Co'])[i]), 'acme',
      'the designator ' || (ARRAY['LLC', 'Inc.', 'Corp', 'L.L.C.', 'Ltd', 'LLP.', 'P.C.', 'PLLC', 'Co'])[i] || ' is dropped');
  END LOOP;
  PERFORM pg_temp.is(public.account_name_key('Costco'), 'costco', 'Costco is Costco');
  PERFORM pg_temp.is(public.account_name_key('Cost'), 'cost', 'Cost is Cost');
  PERFORM pg_temp.is(public.account_name_key('Cost Co'), 'cost', 'Cost Co is Cost');
  PERFORM pg_temp.is(public.account_name_key('Acme Company'), 'acmecompany', 'Company is not a designator in the list');
  PERFORM pg_temp.is(public.account_name_key('Acme Corporation'), 'acmecorporation', 'nor is Corporation');
  PERFORM pg_temp.is(public.account_name_key('Acme Inc Co'), 'acmeinc', 'only the last word goes');
  PERFORM pg_temp.is(public.account_name_key('Inc Acme'), 'incacme', 'and only from the end');
  PERFORM pg_temp.is(public.account_name_key('LLC'), 'llc', 'a name that is only a designator keeps it');
  PERFORM pg_temp.is(public.account_name_key('  Acme   &  Sons,   Inc. '), 'acmesons', 'spaces and symbols go');
  PERFORM pg_temp.is(public.account_name_key('Café Rio'), 'cafério', 'letters with accents stay letters');
  PERFORM pg_temp.is(public.account_name_key('Zoë Inc'), 'zoë', 'so "Zoë" is not "Zo"');
  PERFORM pg_temp.is(public.account_name_key('...'), NULL::text, 'nothing left is no key');
  PERFORM pg_temp.is(public.account_name_key(NULL), NULL::text, 'no name, no key');
  RAISE NOTICE 'chain_at_certification: the name key passed';
END $$;

-- Break caught: a free-mail domain can match two businesses, or a business's own domain is taken for one.
DO $$
DECLARE d text;
BEGIN
  FOREACH d IN ARRAY ARRAY['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com', 'aol.com', 'GMAIL.com'] LOOP
    PERFORM pg_temp.is(public.is_free_mail_domain(d), true, d || ' is a free-mail domain');
  END LOOP;
  PERFORM pg_temp.is(public.is_free_mail_domain('acme.example'), false, 'a business''s own domain is not');
  PERFORM pg_temp.is(public.is_free_mail_domain('mail.gmail.com'), true, 'a free-mail domain''s subdomain is one too');
  PERFORM pg_temp.is(public.is_free_mail_domain('login.yahoo.com'), true, 'login.yahoo.com');
  PERFORM pg_temp.is(public.is_free_mail_domain('a.b.outlook.com'), true, 'at any depth');
  PERFORM pg_temp.is(public.is_free_mail_domain('acme.com'), false, 'but a name that only ends like one is not (acme.com, me.com)');
  PERFORM pg_temp.is(public.is_free_mail_domain('alive.com'), false, 'alive.com, live.com');
  PERFORM pg_temp.is(public.is_free_mail_domain('gmail.com.example'), false, 'nor one that only starts with a free-mail name');
  PERFORM pg_temp.is(public.is_free_mail_domain(NULL), false, 'no domain is not one');
  RAISE NOTICE 'chain_at_certification: free mail passed';
END $$;

-- Break caught: the match is by likeness, matches across firms, ignores the state, treats a free-mail website as a business's, or is missing a way to match.
DO $$
DECLARE z1 uuid; z2 uuid; z3 uuid; zca uuid; zcost uuid; zcostco uuid; zcostco2 uuid; zdom uuid; zg1 uuid; zg2 uuid; zmail uuid; hand uuid; zemail uuid; zother uuid; ztwo uuid; before_z1 jsonb;
BEGIN
  -- The first Acme in Zenith: nothing to match.
  z1 := pg_temp.certified('z1', 'zenith', 'Acme Co.', 'TX', 'https://www.acme.example');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = z1), NULL::uuid, 'the first one matches nothing');
  SELECT to_jsonb(a) - 'updated_at' INTO before_z1 FROM public.accounts a WHERE id = z1;

  -- The same name and state, the designator dropped: marked, still made, nothing merged.
  z2 := pg_temp.certified('z2', 'zenith', 'Acme', 'TX');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = z2), z1, '"Acme" in TX is marked as a possible duplicate of "Acme Co." in TX');
  PERFORM pg_temp.is(z2 <> z1, true, 'as an account of its own');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id = pg_temp.id('zenith')), 2::bigint, 'nothing was merged: both accounts exist');
  PERFORM pg_temp.is((SELECT to_jsonb(a) - 'updated_at' FROM public.accounts a WHERE id = z1), before_z1, 'and the earlier account was not touched');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = z2), 1::bigint, 'the new account has its own contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE account_id = z2 AND intake_id = pg_temp.id('i_z2')), 1::bigint, 'and its own opportunity, holding the intake');

  -- With two to match, the earlier one.
  z3 := pg_temp.certified('z3', 'zenith', 'ACME, Inc.', 'TX');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = z3), z1, 'with two matches the earlier one is named');

  -- The state decides: the same name in another state is another business.
  zca := pg_temp.certified('zca', 'zenith', 'Acme LLC', 'CA');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zca), NULL::uuid, 'the same name in another state does not match');
  -- And an employer who gave no state cannot match by name.
  zca := pg_temp.certified('znostate', 'zenith', 'Acme', NULL);
  PERFORM pg_temp.is((SELECT state FROM public.accounts WHERE id = zca), NULL::text, 'no state on the account');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zca), NULL::uuid, 'a name with no state is not enough');

  -- Costco is not Cost.
  zcost := pg_temp.certified('zcost', 'zenith', 'Cost', 'NV');
  zcostco := pg_temp.certified('zcostco', 'zenith', 'Costco', 'NV');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zcostco), NULL::uuid, '"Costco" never matches "Cost"');
  zcostco2 := pg_temp.certified('zcostco2', 'zenith', 'Cost Co.', 'NV');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zcostco2), zcost, 'but "Cost Co." does');

  -- The web domain: another name, another state, the same site.
  zdom := pg_temp.certified('zdom', 'zenith', 'Totally Different Name', 'OR', 'http://ACME.example/about?x=1');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zdom), z1, 'the same web domain matches whatever the name and state');
  -- A free-mail website is not a business's.
  zg1 := pg_temp.certified('zg1', 'zenith', 'Gmail Business One', 'WA', 'https://www.gmail.com');
  zg2 := pg_temp.certified('zg2', 'zenith', 'Gmail Business Two', 'WI', 'gmail.com');
  PERFORM pg_temp.is((SELECT web_domain FROM public.accounts WHERE id = zg1), 'gmail.com', 'the site is kept as given');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zg2), NULL::uuid, 'but a free-mail domain never matches');

  -- The same email, ignoring case, against a contact the firm made by hand.
  INSERT INTO public.accounts (firm_id, name, source, state) VALUES (pg_temp.id('zenith'), 'Made By Hand LLC', 'added_by_hand', 'FL') RETURNING id INTO hand;
  INSERT INTO public.contacts (firm_id, account_id, last_name, email) VALUES (pg_temp.id('zenith'), hand, 'Smith', 'Pat.Smith@Example.test');
  zemail := pg_temp.certified('zemail', 'zenith', 'Unrelated Name', 'MT', NULL, 'pat.smith@EXAMPLE.TEST');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zemail), hand, 'a contact with the same email, ignoring case, matches');
  -- A different email does not.
  zemail := pg_temp.certified('zemail2', 'zenith', 'Unrelated Name Two', 'MT', NULL, 'pat.smith2@example.test');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zemail), NULL::uuid, 'a different email does not');

  -- Another firm's account is no match: Acme's Harborview, by site, by name and state.
  zother := pg_temp.certified('zother', 'zenith', 'Harborview Dental Group', 'TX', 'https://harborview.example');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zother), NULL::uuid, 'another firm''s account is never a match');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE possible_duplicate_of IS NOT NULL AND firm_id <> (SELECT firm_id FROM public.accounts a WHERE a.id = possible_duplicate_of)), 0::bigint, 'no mark crosses firms');

  -- An archived account is still a business the firm knows.
  UPDATE public.accounts SET archived_at = now() WHERE id = z1;
  ztwo := pg_temp.certified('zarch', 'zenith', 'Acme Corp', 'TX');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = ztwo), z1, 'an archived account still matches');
  RAISE NOTICE 'chain_at_certification: the duplicate match passed';
END $$;

-- Break caught: free text in the website answer ("N/A", "none", "-") or a page on a site everyone shares (a Facebook page) is taken for a business's own
-- domain, so unrelated businesses are marked as possible duplicates of one another.
DO $$
DECLARE d text; ok boolean; n integer := 0; first_id uuid; next_id uuid;
BEGIN
  PERFORM pg_temp.as_owner();
  FOREACH d IN ARRAY ARRAY['n', 'none', '-', 'n.a', 'a.b', '192.168.1.1', 'localhost', 'x_y.example', '-.example', 'facebook.com', 'm.facebook.com', 'fb.com', 'sites.google.com',
    'linkedin.com', 'instagram.com', 'gmail.com', 'mail.gmail.com', 'login.yahoo.com'] LOOP
    PERFORM pg_temp.is(public.is_matchable_web_domain(d), false, d || ' is not a domain that says which business');
  END LOOP;
  FOREACH d IN ARRAY ARRAY['acme.example', 'my-biz.co.uk', 'shop.acme.example', 'google.com', 'xn--bcher-kva.example', 'a1.io'] LOOP
    PERFORM pg_temp.is(public.is_matchable_web_domain(d), true, d || ' is');
  END LOOP;
  PERFORM pg_temp.is(public.is_matchable_web_domain(NULL), false, 'no domain is not');

  -- Through certification, in a firm of their own so only the website could match: the same free text, then pages on shared sites.
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Shared Hosts Brokers', 'shared-hosts', now());
  INSERT INTO fx SELECT 'hosts', id FROM public.firms WHERE address = 'shared-hosts';
  FOREACH d IN ARRAY ARRAY['N/A', 'none', '-', 'https://mail.gmail.com/inbox', 'https://www.facebook.com/acmepage', 'https://m.facebook.com/otherpage', 'https://sites.google.com/view/one',
    'linkedin.com/company/two', 'https://www.instagram.com/three'] LOOP
    n := n + 1;
    first_id := pg_temp.certified('h' || n || 'a', 'hosts', 'Hosts Name A ' || n, 'MO', d);
    next_id := pg_temp.certified('h' || n || 'b', 'hosts', 'Hosts Different B ' || n, 'MS', d);
    PERFORM pg_temp.is((SELECT web_domain FROM public.accounts WHERE id = next_id) IS NOT NULL, true, d || ': the site is kept as given');
    PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = next_id), NULL::uuid, d || ' is not a business''s own domain');
  END LOOP;
  -- A real domain, with a hyphen and a path, still matches.
  first_id := pg_temp.certified('real_a', 'hosts', 'Real A', 'MO', 'https://www.real-biz.example/about');
  next_id := pg_temp.certified('real_b', 'hosts', 'Real B Wholly Different', 'MS', 'http://REAL-biz.example');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = next_id), first_id, 'a real domain still matches');
  RAISE NOTICE 'chain_at_certification: shared hosts and free text passed';
END $$;

-- Break caught: the email match reads another firm's contacts, so a prospect whose email is a contact of another firm is marked a possible duplicate of that
-- firm's account (and the certification fails on the cross-firm foreign key).
DO $$
DECLARE acme_account uuid; zid uuid; zenith_contact uuid;
BEGIN
  PERFORM pg_temp.as_owner();
  INSERT INTO public.accounts (firm_id, name, source, state) VALUES (pg_temp.id('acme'), 'Acme Side Account', 'added_by_hand', 'OH') RETURNING id INTO acme_account;
  INSERT INTO public.contacts (firm_id, account_id, last_name, email) VALUES (pg_temp.id('acme'), acme_account, 'Shared', 'shared.person@example.test');
  zid := pg_temp.certified('xfirm', 'zenith', 'Cross Firm Email Co', 'OH', NULL, 'Shared.Person@example.test');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zid), NULL::uuid, 'another firm''s contact with the same email is no match');
  PERFORM pg_temp.is((SELECT firm_id FROM public.accounts WHERE id = zid), pg_temp.id('zenith'), 'the account is in the intake''s firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE possible_duplicate_of = acme_account), 0::bigint, 'and nothing refers to the other firm''s account');
  -- And the other way: a Zenith contact, an Acme prospect.
  INSERT INTO public.contacts (firm_id, account_id, last_name, email) VALUES (pg_temp.id('zenith'), zid, 'Other', 'acme.side@example.test');
  zid := pg_temp.certified('xfirm2', 'acme', 'Cross Firm Email Two', 'OH', NULL, 'ACME.side@example.test');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = zid), NULL::uuid, 'and the same the other way');
  RAISE NOTICE 'chain_at_certification: email across firms passed';
END $$;

-- Break caught: the same person certifying a second intake is not recognised, or the second intake takes over the first's contact.
DO $$
DECLARE s2 uuid; first_account uuid := (pg_temp.acct('i_harbor')).id; second_account uuid; r text;
BEGIN
  s2 := pg_temp.start_intake('i_harbor2', 'jo', pg_temp.answers('A Wholly Other Business', 'NY', '{"website":null}'), 'acme');
  r := pg_temp.certify('i_harbor2', 'jo');
  PERFORM pg_temp.is(r, 'ok', 'the same person certifies a second intake');
  second_account := (pg_temp.acct('i_harbor2')).id;
  PERFORM pg_temp.is(second_account <> first_account, true, 'on an account of its own');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = second_account), first_account, 'marked by the contact''s email');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE prospect_user_id = pg_temp.id('jo')), 2::bigint, 'the same prospect is a contact on two accounts, one each (D-194)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = first_account), 1::bigint, 'the first account still has its one contact');
  RAISE NOTICE 'chain_at_certification: a second intake of one prospect passed';
END $$;

-- ---------- the values are the certified ones ----------
-- A submission certified twice with different answers, whose chain is made later (CRM-Q1.3 brings the existing ones in) and whose answers were changed
-- again after the second certification. Break caught: the account takes the answers as they are now, or the first certification's, not the latest certified.
DO $$
DECLARE sid uuid; r jsonb;
BEGIN
  PERFORM pg_temp.new_prospect('snap');
  sid := pg_temp.start_intake('i_snap', 'snap', pg_temp.answers('Snapshot First Name', 'ND'), 'acme');
  PERFORM pg_temp.is(pg_temp.certify('i_snap', 'snap'), 'ok', 'certified');
  PERFORM pg_temp.as_user('snap');
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"company_name":"Snapshot Second Name","employee_count":50}' WHERE id = sid;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.certify('i_snap', 'snap'), 'ok', 'certified again over other answers');
  PERFORM pg_temp.as_user('snap');
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"company_name":"Snapshot Uncertified Edit","employee_count":99}' WHERE id = sid;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = sid), 'in_progress', 'the edit withdrew the certification');
  -- Its chain goes (as for a submission certified before the chain existed), and the step makes it.
  -- (CRM-Q1.3 refuses a submission with no opportunity at the end of the statement; here the chain is gone and made again in one transaction, so the rule
  -- is asked at its end.)
  SET CONSTRAINTS opportunities_keep_intake_delete DEFERRED;
  DELETE FROM public.opportunities WHERE intake_id = sid;
  DELETE FROM public.accounts WHERE name LIKE 'Snapshot %';
  r := public.make_intake_chain(sid);
  PERFORM pg_temp.is((pg_temp.acct('i_snap')).name, 'Snapshot Second Name', 'the account is named from the latest certification');
  PERFORM pg_temp.is((pg_temp.acct('i_snap')).employees, 50, 'with its headcount, not the edit made since');
  RAISE NOTICE 'chain_at_certification: certified values passed';
END $$;

-- ---------- what the certified answers hold that a column would refuse never fails the certification ----------
-- A certification written by the service role (no browser rules: nothing makes the company name or the state required there), over answers as given.
CREATE FUNCTION pg_temp.certified_raw(tag text, p_firm text, p_data jsonb, p_company_profile text DEFAULT NULL, p_contact text DEFAULT NULL, p_phone text DEFAULT NULL,
                                       p_email text DEFAULT NULL, p_signer text DEFAULT 'Jo Signer') RETURNS text LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid(); sid uuid; s text; m text;
BEGIN
  PERFORM pg_temp.as_owner();
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', p_email, now(), false, now(), now());
  INSERT INTO fx VALUES (tag, uid);
  UPDATE public.profiles SET company_name = p_company_profile, contact_name = p_contact, phone = p_phone WHERE user_id = uid;
  INSERT INTO public.chamber_sessions (user_id, chamber_data, firm_id) VALUES (uid, p_data, pg_temp.id(p_firm)) RETURNING id INTO sid;
  INSERT INTO fx VALUES ('i_' || tag, sid);
  BEGIN
    UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object(
      'signer_name', p_signer, 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z', 'consent_version', '2026-10-draft-1',
      'consent_text', '["I certify."]'::jsonb, 'chamber_data', p_data) WHERE id = sid;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    RETURN s || ': ' || m;
  END;
END $$;

-- Break caught: a value the account or the contact would refuse (a blank or missing name, an over-long answer or phone) fails the certification instead of being left out; or the unnamed fallback is taken for a business's name by the match.
DO $$
DECLARE a public.accounts; c public.contacts; o public.opportunities; n1 uuid; n2 uuid;
BEGIN
  -- No company name: the signup's name; or, with none, a plain word that never matches another.
  PERFORM pg_temp.is(pg_temp.certified_raw('r_signup', 'zenith', '{"hq_state":"IN","states":["IN"]}', 'Signup Name LLC', 'Rae Raw', NULL, 'rraw@example.test'), 'ok', 'a certification with no company name');
  PERFORM pg_temp.is((pg_temp.acct('i_r_signup')).name, 'Signup Name LLC', 'takes the name the prospect signed up with');
  PERFORM pg_temp.is(pg_temp.certified_raw('r_none1', 'zenith', '{"hq_state":"IN","states":["IN"],"company_name":"   "}', NULL, NULL, NULL, 'rnone1@example.test', 'Cher'), 'ok', 'a blank one, with no signup name either');
  PERFORM pg_temp.is(pg_temp.certified_raw('r_none2', 'zenith', '{"hq_state":"IN","states":["IN"]}', NULL, NULL, NULL, 'rnone2@example.test'), 'ok', 'and another');
  a := pg_temp.acct('i_r_none1');
  PERFORM pg_temp.is(a.name, 'Unnamed business', 'is called what it is');
  PERFORM pg_temp.is((pg_temp.acct('i_r_none2')).possible_duplicate_of, NULL::uuid, 'two of them are not duplicates of each other');
  SELECT * INTO c FROM public.contacts WHERE account_id = a.id;
  PERFORM pg_temp.is(c.first_name, NULL::text, 'a one-word signer name is a last name alone');
  PERFORM pg_temp.is(c.last_name, 'Cher', 'which is the signer''s, as the profile has no name');
  PERFORM pg_temp.is((pg_temp.opp('i_r_none1')).name, 'PEO search', 'no start month: just "PEO search" (D-188)');

  -- Values the columns would refuse.
  PERFORM pg_temp.is(pg_temp.certified_raw('r_bad', 'zenith', jsonb_build_object('company_name', repeat('N', 300), 'hq_state', 'NM', 'states', jsonb_build_array('TX', 'TX', 'CA', 'TX', 'CA'),
    'employee_count', 1000000, 'industry', repeat('I', 300), 'street_address', repeat('S', 300), 'website', repeat('w', 400), 'in_peo', false, 'current_peo', 'Hidden PEO',
    'start_month', 'Q1'), NULL, 'Bad Data', '(555) 123-4567' || repeat(' ', 25) || 'ext 12345', 'rbad@example.test'), 'ok', 'a certification with answers the columns refuse');
  a := pg_temp.acct('i_r_bad'); c := (SELECT x FROM public.contacts x WHERE x.account_id = a.id);
  PERFORM pg_temp.is(char_length(a.name), 200, 'a long name is cut to the column');
  PERFORM pg_temp.is(a.states_of_operation, ARRAY['TX', 'CA'], 'the states of operation, each once, in the order given');
  PERFORM pg_temp.is(a.employees, 1000000, 'the largest headcount the intake takes');
  PERFORM pg_temp.is(char_length(a.industry), 200, 'a long industry is cut');
  PERFORM pg_temp.is(char_length(a.street), 200, 'and a long address');
  PERFORM pg_temp.is(char_length(a.website), 300, 'and a long site');
  PERFORM pg_temp.is(a.current_provider, NULL::text, 'a provider the employer said they do not have is not kept');
  PERFORM pg_temp.is(char_length(c.phone), 40, 'a long phone is cut');
  PERFORM pg_temp.is((pg_temp.opp('i_r_bad')).name, 'Q1 PEO search', 'the start month as it was given');

  PERFORM pg_temp.is(pg_temp.certified_raw('r_peo', 'zenith', '{"company_name":"Provider Kept","hq_state":"IN","in_peo":null,"current_peo":"  Justworks  "}', NULL, 'Pia Peo', NULL, 'rpeo@example.test'), 'ok', 'a provider with no yes or no beside it');
  PERFORM pg_temp.is((pg_temp.acct('i_r_peo')).current_provider, 'Justworks', 'is kept, trimmed');

  -- A prospect with no way to reach: the chain is made without a contact, rather than the certification failing.
  PERFORM pg_temp.is(pg_temp.certified_raw('r_nomail', 'zenith', '{"company_name":"No Way To Reach","hq_state":"IN"}', NULL, NULL, NULL, NULL), 'ok', 'a prospect with neither an email nor a phone');
  a := pg_temp.acct('i_r_nomail'); o := pg_temp.opp('i_r_nomail');
  PERFORM pg_temp.is(a.name, 'No Way To Reach', 'still gets the account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a.id), 0::bigint, 'and no contact (a contact needs an email or a phone)');
  PERFORM pg_temp.is(o.main_contact_id, NULL::uuid, 'so no main contact on the opportunity');
  RAISE NOTICE 'chain_at_certification: odd answers passed';
END $$;

-- ---------- a failure in the chain fails the certification ----------
-- Break caught: the chain is made after the certification commits, or its failure is swallowed, so a submission is left with no chain.
CREATE FUNCTION public.test_refuse_account() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'the chain was told to fail' USING ERRCODE = 'P0001'; END $$;
DO $$
DECLARE sid uuid; r text;
BEGIN
  PERFORM pg_temp.new_prospect('atomic');
  sid := pg_temp.start_intake('i_atomic', 'atomic', pg_temp.answers('Atomic Industries', 'WY'), 'acme');
  CREATE TRIGGER test_refuse_account BEFORE INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.test_refuse_account();
  r := pg_temp.certify('i_atomic', 'atomic');
  DROP TRIGGER test_refuse_account ON public.accounts;
  PERFORM pg_temp.is(r, 'P0001: the chain was told to fail', 'the certification fails with the chain''s failure');
  PERFORM pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = sid), 'in_progress', 'the intake is still a draft');
  PERFORM pg_temp.is((SELECT submission FROM public.chamber_sessions WHERE id = sid), NULL::jsonb, 'with no certification on it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid), 0::bigint, 'no certification was recorded');
  PERFORM pg_temp.is((SELECT status FROM public.submission_workflow WHERE session_id = sid), 'draft', 'the pipeline did not move');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = sid), 0::bigint, 'and no opportunity was made');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE name = 'Atomic Industries'), 0::bigint, 'nor an account');
  -- Without the failure the same intake certifies.
  PERFORM pg_temp.is(pg_temp.certify('i_atomic', 'atomic'), 'ok', 'and certifies when the chain can be made');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = sid), 1::bigint, 'with its chain');
  RAISE NOTICE 'chain_at_certification: atomic passed';
END $$;
DROP FUNCTION public.test_refuse_account();

-- ---------- a certification written straight as submitted (an insert) makes the chain too ----------
-- Break caught: the hook is on the update only, so an intake inserted already certified has no chain.
DO $$
DECLARE uid uuid := gen_random_uuid(); sid uuid; d jsonb := pg_temp.answers('Inserted Certified Co', 'AK');
BEGIN
  PERFORM pg_temp.as_owner();
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at) VALUES (uid, 'authenticated', 'authenticated', 'ins@example.test', now(), false, now(), now());
  INSERT INTO public.chamber_sessions (user_id, chamber_data, status, firm_id, submission) VALUES (uid, d, 'submitted', pg_temp.id('acme'), jsonb_build_object(
    'signer_name', 'Ina Insert', 'signer_title', 'CEO', 'signed_at', '2026-11-01T12:00:00Z', 'consent_version', 'v1', 'consent_text', 'I certify.', 'chamber_data', d)) RETURNING id INTO sid;
  INSERT INTO fx VALUES ('i_ins', sid);
  PERFORM pg_temp.is((pg_temp.acct('i_ins')).name, 'Inserted Certified Co', 'the account is made');
  PERFORM pg_temp.is((SELECT last_name FROM public.contacts WHERE account_id = (pg_temp.acct('i_ins')).id), 'Insert', 'with the signer as the contact when the profile has no name');
  RAISE NOTICE 'chain_at_certification: insert passed';
END $$;

-- ---------- the intake's firm, whatever its state (D-101; ADR 0023, 0024) ----------
-- Break caught: the chain is written to the default firm or the employer's, not the intake's; or a closing or suspended firm turns the employer's
-- certification away or leaves its submission with no chain.
DO $$
DECLARE closing uuid; susp uuid; sid uuid; zo uuid;
BEGIN
  -- The default firm, as every intake of today is stamped (D-101).
  PERFORM pg_temp.certified('d1', 'default', 'Default Firm Business', 'MN');
  PERFORM pg_temp.is((SELECT firm_id FROM public.accounts WHERE id = pg_temp.id('a_d1')), public.default_firm_id(), 'an intake of the default firm gets its chain there');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities o JOIN public.contacts c ON c.account_id = o.account_id WHERE o.firm_id <> c.firm_id), 0::bigint, 'no chain spans two firms');

  -- A firm that is closing: read-only for its members, but certifying is the employer's act.
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Closing Brokers', 'closing-brokers', now(), 'approved', now()) RETURNING id INTO closing;
  INSERT INTO fx VALUES ('closing', closing);
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at) VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'closing_owner@example.test', now(), false, now(), now()) RETURNING id INTO zo;
  INSERT INTO fx VALUES ('closing_owner', zo);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (closing, zo, 'owner');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (closing, zo, now() + interval '30 days');
  PERFORM pg_temp.is(public.firm_is_read_only(closing), true, 'the firm is read-only');
  PERFORM pg_temp.certified('c1', 'closing', 'Certified While Closing', 'KS');
  PERFORM pg_temp.is((SELECT firm_id FROM public.opportunities WHERE intake_id = pg_temp.id('i_c1')), closing, 'an intake of a closing firm gets its chain, in that firm');
  PERFORM pg_temp.as_user('closing_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = pg_temp.id('a_c1')), 1::bigint, 'which its members read');
  PERFORM pg_temp.as_owner();
  -- At the end of its 30 days the closing deletes the firm's records, the chain made during them included, and keeps the intake.
  UPDATE public.firm_closures SET asked_at = asked_at - interval '31 days', closes_at = closes_at - interval '31 days' WHERE firm_id = closing;
  PERFORM public.close_firm_now(closing);
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id = closing), 0::bigint, 'closing deletes the accounts');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE firm_id = closing) + (SELECT count(*) FROM public.contacts WHERE firm_id = closing), 0::bigint, 'and the opportunities and contacts');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE id = pg_temp.id('i_c1')), 1::bigint, 'the intake is kept');
  -- The firm is closed and holds no CRM records: the employer certifying that intake again is not refused, and no chain comes back.
  PERFORM pg_temp.is(public.firm_is_closed(closing), true, 'the firm is closed');
  PERFORM pg_temp.is(pg_temp.certify('i_c1', 'c1', 'Signer After Closing'), 'ok', 'the employer certifies again after the firm closed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_certifications WHERE session_id = pg_temp.id('i_c1')), 2::bigint, 'the certification was recorded');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id = closing) + (SELECT count(*) FROM public.contacts WHERE firm_id = closing)
    + (SELECT count(*) FROM public.opportunities WHERE firm_id = closing), 0::bigint, 'a closed firm holds no chain');
  PERFORM pg_temp.is(public.make_intake_chain(pg_temp.id('i_c1')) ->> 'made', 'false', 'nor does the step make one');

  -- A suspended firm.
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Suspended Brokers', 'suspended-brokers', now(), 'approved', now()) RETURNING id INTO susp;
  INSERT INTO fx VALUES ('susp', susp);
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at) VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'susp_owner@example.test', now(), false, now(), now()) RETURNING id INTO zo;
  INSERT INTO fx VALUES ('susp_owner', zo);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (susp, zo, 'owner');
  INSERT INTO public.firm_suspensions (firm_id, reason) VALUES (susp, 'Under review');
  PERFORM pg_temp.is(public.firm_is_suspended(susp), true, 'the firm is suspended');
  PERFORM pg_temp.certified('s1', 'susp', 'Certified While Suspended', 'KS');
  PERFORM pg_temp.is((SELECT firm_id FROM public.opportunities WHERE intake_id = pg_temp.id('i_s1')), susp, 'an intake of a suspended firm gets its chain, in that firm');
  PERFORM pg_temp.as_user('susp_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), 0::bigint, 'which its members read nothing of while it is suspended');
  PERFORM pg_temp.as_owner();
  UPDATE public.firm_suspensions SET lifted_at = now() WHERE firm_id = susp;
  PERFORM pg_temp.as_user('susp_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), 1::bigint, 'and read once it is lifted');
  PERFORM pg_temp.as_owner();
  RAISE NOTICE 'chain_at_certification: firms passed';
END $$;

-- ---------- who sees and who may write ----------
-- Break caught: the chain is read by the employer, by another firm or by a visitor; or an API role can run the step or the match, or write the records.
DO $$
DECLARE zo uuid; a uuid := (pg_temp.acct('i_harbor')).id; sid uuid := pg_temp.id('i_harbor');
BEGIN
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at) VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'zenith_owner@example.test', now(), false, now(), now()) RETURNING id INTO zo;
  INSERT INTO fx VALUES ('zenith_owner', zo);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('zenith'), zo, 'owner');

  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = a), 1::bigint, 'the firm''s owner reads the account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a), 1::bigint, 'its contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = sid), 1::bigint, 'and its opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id <> pg_temp.id('acme')), 0::bigint, 'and nothing of another firm');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = a) + (SELECT count(*) FROM public.contacts WHERE account_id = a) + (SELECT count(*) FROM public.opportunities WHERE intake_id = sid), 0::bigint, 'another firm''s owner reads none of it');
  PERFORM pg_temp.as_user('jo');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts) + (SELECT count(*) FROM public.contacts) + (SELECT count(*) FROM public.opportunities), 0::bigint, 'the employer who certified reads none of it: the firm''s record of them is not theirs');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT count(*) FROM public.accounts'), '42501', 'a visitor reads none of it');
  PERFORM pg_temp.as_owner();

  -- No API role runs the step, the match, the hook or a helper.
  PERFORM pg_temp.is((SELECT bool_or(has_function_privilege(r, p.oid, 'EXECUTE')) FROM pg_proc p, unnest(ARRAY['anon', 'authenticated', 'service_role']) r
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('make_intake_chain', 'find_duplicate_account', 'chain_at_certification', 'is_free_mail_domain', 'is_shared_web_host', 'is_matchable_web_domain', 'account_name_key', 'crm_answer_text', 'crm_split_person_name')),
    false, 'no API role can run any function of this story');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.make_intake_chain(%L)', sid)), '42501', 'a firm''s owner cannot ask for a chain');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.make_intake_chain(%L)', sid)), '42501', 'nor can the service role');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.find_duplicate_account(%L, 'x.example', 'X', 'TX', 'x@example.test')$q$, pg_temp.id('acme'))), '42501', 'or ask the match');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (firm_id, name, source) VALUES (%L, 'Hand made', 'added_by_hand')$q$, pg_temp.id('acme'))), '42501', 'or write an account');
  PERFORM pg_temp.as_owner();

  -- The history of each record begins with its creation.
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'accounts' AND record_key = a::text AND kind = 'created'), 1::bigint, 'the account''s history starts with its creation');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h JOIN public.contacts c ON c.id::text = h.record_key WHERE h.table_name = 'contacts' AND c.account_id = a AND h.kind = 'created'), 1::bigint, 'and the contact''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'opportunities' AND record_key = (pg_temp.opp('i_harbor')).id::text AND kind = 'created'), 1::bigint, 'and the opportunity''s');
  RAISE NOTICE 'chain_at_certification: visibility and privileges passed';
END $$;

-- ---------- two sessions at once (D-29, D-32) ----------
-- Each case is two real connections (dblink): the first begins and does its part without committing, the second starts and is seen waiting, the first
-- commits. What the second gives afterwards is read from the committed rows. The helpers are those of close_a_firm_races.sql.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;

-- dblink_exec runs commands that return nothing: a SELECT is run as a PERFORM inside an anonymous block.
CREATE FUNCTION pg_temp.as_command(stmt text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN stmt ~* '^SELECT ' THEN format('DO $do$ BEGIN PERFORM %s; END $do$', substr(stmt, 8)) ELSE stmt END
$$;

-- Runs two statements in two committed-or-not transactions and says what happened: 'waited:<result>' when the second was seen waiting on
-- the first (the result is what it gave after the first committed: 'ok' or its SQLSTATE), or 'did not wait:<result>' when it finished without
-- waiting. `*_who` is a user's name, or NULL to stay as the connecting superuser. `a_late` runs in the first after the second is waiting and
-- before the first commits (its SQLSTATE, or 'ok', is appended as ' late:<it>').
CREATE FUNCTION pg_temp.race_pair(a_who text, a_stmts text[], b_who text, b_stmt text, a_late text DEFAULT NULL, a_slow text DEFAULT NULL, b_delay numeric DEFAULT 0.4) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  b_pid integer; tries integer := 0; waited boolean := false; res text; late text := ''; s text; i integer; a_async boolean := false;
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  PERFORM race.dblink_exec('rb', 'SET lock_timeout = ''20s''');
  PERFORM race.dblink_exec('ra', 'SET lock_timeout = ''20s''');
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  IF a_who IS NOT NULL THEN
    PERFORM race.dblink_exec('ra', 'SET LOCAL ROLE authenticated');
    PERFORM race.dblink_exec('ra', format('SET LOCAL request.jwt.claims = %L',
      jsonb_build_object('sub', pg_temp.id(a_who), 'role', 'authenticated', 'is_anonymous', false, 'email', a_who || '@example.test')::text));
  END IF;
  FOR i IN 1..cardinality(a_stmts) LOOP
    IF a_slow IS NOT NULL AND i = cardinality(a_stmts) THEN
      -- The last statement runs in the background and is slowed inside (a trigger sleeps `a_slow` seconds when it updates a request), so
      -- the second starts while the first is part-way through, not after it has finished.
      PERFORM race.dblink_exec('ra', format('SET LOCAL zz.slow = %L', a_slow));
      PERFORM race.dblink_send_query('ra', a_stmts[i]);
      a_async := true;
      PERFORM pg_sleep(b_delay);
    ELSE
      PERFORM race.dblink_exec('ra', pg_temp.as_command(a_stmts[i]));
    END IF;
  END LOOP;
  PERFORM race.dblink_exec('rb', 'BEGIN');
  IF b_who IS NOT NULL THEN
    PERFORM race.dblink_exec('rb', 'SET LOCAL ROLE authenticated');
    PERFORM race.dblink_exec('rb', format('SET LOCAL request.jwt.claims = %L',
      jsonb_build_object('sub', pg_temp.id(b_who), 'role', 'authenticated', 'is_anonymous', false, 'email', b_who || '@example.test')::text));
  END IF;
  PERFORM race.dblink_send_query('rb', b_stmt);
  WHILE tries < 80 LOOP
    IF cardinality(pg_blocking_pids(b_pid)) > 0 THEN waited := true; EXIT; END IF;
    IF race.dblink_is_busy('rb') = 0 THEN EXIT; END IF;
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  IF a_async THEN
    BEGIN PERFORM * FROM race.dblink_get_result('ra') AS t(r text); EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE; late := late || ' first:' || s; END;
    BEGIN PERFORM * FROM race.dblink_get_result('ra') AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF a_late IS NOT NULL THEN
    BEGIN
      PERFORM race.dblink_exec('ra', pg_temp.as_command(a_late));
      late := ' late:ok';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
      late := ' late:' || s;
    END;
  END IF;
  BEGIN PERFORM race.dblink_exec('ra', 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
    res := 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE;
    res := s;
  END;
  BEGIN PERFORM * FROM race.dblink_get_result('rb') AS t(r text); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM race.dblink_exec('rb', 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  RETURN CASE WHEN waited THEN 'waited:' ELSE 'did not wait:' END || res || late;
END $$;

-- The certification a prospect sends for an intake, as text for a connection that is not this one.
CREATE FUNCTION pg_temp.certify_stmt(n text, p_signer text DEFAULT 'Jo Doe') RETURNS text LANGUAGE sql AS $$
  SELECT format($q$UPDATE public.chamber_sessions SET status = 'submitted', submission = jsonb_build_object('signer_name', %L, 'signer_title', 'CEO',
    'signed_at', '2026-11-01T12:00:00Z', 'consent_version', '2026-10-draft-1', 'consent_text', '["I certify."]'::jsonb, 'chamber_data', chamber_data) WHERE id = %L$q$,
    p_signer, pg_temp.id(n))
$$;

-- Drafts, committed so both connections see them: one prospect certifying the same intake from two places; two prospects of one business; one
-- certified intake that has no chain (one that was certified before the chain existed).
DO $$
BEGIN
  PERFORM pg_temp.new_prospect('race_p1');
  PERFORM pg_temp.start_intake('i_race1', 'race_p1', pg_temp.answers('Race One Corp', 'ID'), 'acme');
  PERFORM pg_temp.new_prospect('race_p2');
  PERFORM pg_temp.start_intake('i_race2', 'race_p2', pg_temp.answers('Race Two Corp', 'ID', '{"website":"https://www.racetwo.example"}'), 'acme');
  PERFORM pg_temp.new_prospect('race_p3');
  PERFORM pg_temp.start_intake('i_race3', 'race_p3', pg_temp.answers('Race Three Different Name', 'UT', '{"website":"racetwo.example/home"}'), 'acme');
  PERFORM pg_temp.new_prospect('race_p4');
  PERFORM pg_temp.start_intake('i_race4', 'race_p4', pg_temp.answers('Race Four Corp', 'ID'), 'acme');
  PERFORM pg_temp.is(pg_temp.certify('i_race4', 'race_p4'), 'ok', 'an intake certified');
  -- Two more of one business, certified.
  PERFORM pg_temp.new_prospect('race_p5');
  PERFORM pg_temp.start_intake('i_race5', 'race_p5', pg_temp.answers('Race Five Corp', 'ID', '{"website":"https://racefive.example"}'), 'acme');
  PERFORM pg_temp.new_prospect('race_p6');
  PERFORM pg_temp.start_intake('i_race6', 'race_p6', pg_temp.answers('Race Six Other Name', 'UT', '{"website":"https://www.racefive.example/x"}'), 'acme');
  PERFORM pg_temp.is(pg_temp.certify('i_race5', 'race_p5'), 'ok', 'one certified');
  PERFORM pg_temp.is(pg_temp.certify('i_race6', 'race_p6'), 'ok', 'and the other');
  PERFORM pg_temp.new_prospect('race_p7');
  PERFORM pg_temp.start_intake('i_race7', 'race_p7', pg_temp.answers('Race Seven Corp', 'ID'), 'acme');
  PERFORM pg_temp.is(pg_temp.certify('i_race7', 'race_p7'), 'ok', 'and one more');
  -- Take their chains away: now they are submissions certified before the chain existed, which CRM-Q1.3 brings in. That rule refuses the deletion of the
  -- opportunity of a submission, and this fixture needs them to stay without one past the end of the block (the races below make them), so its trigger is off
  -- for these statements.
  ALTER TABLE public.opportunities DISABLE TRIGGER opportunities_keep_intake_delete;
  DELETE FROM public.opportunities WHERE intake_id = pg_temp.id('i_race7');
  DELETE FROM public.accounts WHERE name = 'Race Seven Corp';
  DELETE FROM public.opportunities WHERE intake_id IN (pg_temp.id('i_race4'), pg_temp.id('i_race5'), pg_temp.id('i_race6'));
  DELETE FROM public.accounts WHERE name IN ('Race Four Corp', 'Race Five Corp', 'Race Six Other Name');
  ALTER TABLE public.opportunities ENABLE TRIGGER opportunities_keep_intake_delete;
END $$;

-- The same intake certified at once from two places makes one chain.
-- Break caught: two certifications at once of one intake make two chains.
DO $$
DECLARE r text; sid uuid := pg_temp.id('i_race1');
BEGIN
  r := pg_temp.race_pair('race_p1', ARRAY[pg_temp.certify_stmt('i_race1', 'First Hand')], 'race_p1', pg_temp.certify_stmt('i_race1', 'Second Hand'));
  PERFORM pg_temp.is(r, 'waited:ok', 'the second certification waits for the first and then goes through');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = sid), 1::bigint, 'one opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE name = 'Race One Corp'), 1::bigint, 'one account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE prospect_user_id = pg_temp.id('race_p1')), 1::bigint, 'one contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_certifications WHERE session_id = sid), 2::bigint, 'and both certifications recorded');
  RAISE NOTICE 'chain_at_certification: the same intake at once passed';
END $$;

-- The step itself, asked at once for an intake that has none.
-- Break caught: without the firm's lock the second step makes an account and then fails on the opportunity (or, without the constraint, makes two
-- chains); with it the second waits and finds the first's.
DO $$
DECLARE r text; sid uuid := pg_temp.id('i_race4');
BEGIN
  r := pg_temp.race_pair(NULL, ARRAY[format('SELECT public.make_intake_chain(%L)', sid)], NULL, format('SELECT public.make_intake_chain(%L)', sid));
  PERFORM pg_temp.is(r, 'waited:ok', 'the second step waits for the first and finds its chain');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = sid), 1::bigint, 'one opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE name = 'Race Four Corp'), 1::bigint, 'one account, none left over by the one that lost');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE prospect_user_id = pg_temp.id('race_p4')), 1::bigint, 'one contact');
  RAISE NOTICE 'chain_at_certification: the step at once passed';
END $$;

-- Two prospects of one business certify at once: the second sees the first, so one is marked as a possible duplicate of the other. (Two first
-- certifications already wait on one another for the File ID's counter, so this one does not prove the firm's lock: the next case does.)
-- Break caught: each misses the other, so the same business is two accounts and nobody is told.
DO $$
DECLARE r text; a2 uuid; a3 uuid;
BEGIN
  r := pg_temp.race_pair('race_p2', ARRAY[pg_temp.certify_stmt('i_race2')], 'race_p3', pg_temp.certify_stmt('i_race3'));
  PERFORM pg_temp.is(r, 'waited:ok', 'the second chain waits for the first');
  a2 := (pg_temp.acct('i_race2')).id; a3 := (pg_temp.acct('i_race3')).id;
  PERFORM pg_temp.is(a2 <> a3, true, 'two accounts');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = a2), NULL::uuid, 'the first is not marked');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = a3), a2, 'the second is marked a possible duplicate of the first');
  RAISE NOTICE 'chain_at_certification: two businesses at once passed';
END $$;

-- The same, for two intakes whose chains are made by the step itself (the bringing in of existing submissions, CRM-Q1.3), where nothing else makes
-- them wait: without the firm's lock each misses the other.
-- Break caught: the lock before the match is gone.
DO $$
DECLARE r text; a5 uuid; a6 uuid;
BEGIN
  r := pg_temp.race_pair(NULL, ARRAY[format('SELECT public.make_intake_chain(%L)', pg_temp.id('i_race5'))], NULL, format('SELECT public.make_intake_chain(%L)', pg_temp.id('i_race6')));
  PERFORM pg_temp.is(r, 'waited:ok', 'the second step waits for the first');
  a5 := (pg_temp.acct('i_race5')).id; a6 := (pg_temp.acct('i_race6')).id;
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = a5), NULL::uuid, 'the first is not marked');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = a6), a5, 'the second is marked a possible duplicate of the first');
  RAISE NOTICE 'chain_at_certification: two businesses by the step passed';
END $$;

-- A chain that is already there is answered without waiting for the firm's lock, so a certification again never queues behind a chain being made.
-- Break caught: every step takes the lock first, so each recertification of any intake of the firm waits for the chain being made.
DO $$
DECLARE r text;
BEGIN
  r := pg_temp.race_pair(NULL, ARRAY[format('SELECT public.make_intake_chain(%L)', pg_temp.id('i_race7'))], NULL, format('SELECT public.make_intake_chain(%L)', pg_temp.id('i_race4')));
  PERFORM pg_temp.is(r, 'did not wait:ok', 'a step for an intake that has its chain does not wait');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = pg_temp.id('i_race7')), 1::bigint, 'and the other chain was made');
  RAISE NOTICE 'chain_at_certification: no waiting for a chain that is there passed';
END $$;

-- A certification that waits behind the firm's closing (D-122: the closing holds the firm's row until it commits) leaves no records in the closed firm.
-- Break caught: the chain is made after the closing's delete pass has committed, and nothing ever removes it; or only the closed check is there, taken
-- before the closing commits, so the chain is made in a firm with no members.
DO $$
DECLARE f uuid; o uuid; n integer;
BEGIN
  FOR n IN 1..2 LOOP
    INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Race Closing Brokers ' || n, 'race-closing-' || n, now(), 'approved', now()) RETURNING id INTO f;
    INSERT INTO fx VALUES ('race_closing' || n, f);
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at) VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'race_closing_owner' || n || '@example.test', now(), false, now(), now()) RETURNING id INTO o;
    INSERT INTO fx VALUES ('race_closing_owner' || n, o);
    INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (f, o, 'owner');
    INSERT INTO public.firm_closures (firm_id, asked_at, asked_by, closes_at) VALUES (f, now() - interval '31 days', o, now() - interval '1 day');
  END LOOP;
  -- A draft the employer certifies while the first firm closes; a submission of the second firm, certified before and with no chain (as CRM-Q1.3 will find
  -- it), whose chain is asked for by the step while that firm closes.
  PERFORM pg_temp.new_prospect('race_p8');
  PERFORM pg_temp.start_intake('i_race8', 'race_p8', pg_temp.answers('Race Eight Corp', 'ID'), 'race_closing1');
  PERFORM pg_temp.new_prospect('race_p9');
  PERFORM pg_temp.start_intake('i_race9', 'race_p9', pg_temp.answers('Race Nine Corp', 'ID'), 'race_closing2');
  PERFORM pg_temp.is(pg_temp.certify('i_race9', 'race_p9'), 'ok', 'certified before the closing');
  ALTER TABLE public.opportunities DISABLE TRIGGER opportunities_keep_intake_delete; -- the submission must stay without its opportunity past this block (CRM-Q1.3)
  DELETE FROM public.opportunities WHERE intake_id = pg_temp.id('i_race9');
  DELETE FROM public.accounts WHERE name = 'Race Nine Corp';
  ALTER TABLE public.opportunities ENABLE TRIGGER opportunities_keep_intake_delete;
END $$;
DO $$
DECLARE r text; f uuid := pg_temp.id('race_closing1');
BEGIN
  r := pg_temp.race_pair(NULL, ARRAY[format('SELECT public.close_firm_now(%L)', f)], 'race_p8', pg_temp.certify_stmt('i_race8'));
  PERFORM pg_temp.is(r, 'waited:ok', 'the certification waits for the closing and then goes through');
  PERFORM pg_temp.is(public.firm_is_closed(f), true, 'the firm is closed');
  PERFORM pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = pg_temp.id('i_race8')), 'submitted', 'the employer''s certification was not refused');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id = f) + (SELECT count(*) FROM public.contacts WHERE firm_id = f)
    + (SELECT count(*) FROM public.opportunities WHERE firm_id = f), 0::bigint, 'and the closed firm holds no records');
  RAISE NOTICE 'chain_at_certification: a certification behind a closing passed';
END $$;

-- The same for the step on its own, where nothing else makes it wait for the firm's row: without its own lock it asks whether the firm is closed before
-- the closing commits, and then waits for the closing at the insert and writes the chain after it.
-- Break caught: the lock on the firm's row before the closed question is gone.
DO $$
DECLARE r text; f uuid := pg_temp.id('race_closing2');
BEGIN
  r := pg_temp.race_pair(NULL, ARRAY[format('SELECT public.close_firm_now(%L)', f)], NULL, format('SELECT public.make_intake_chain(%L)', pg_temp.id('i_race9')));
  PERFORM pg_temp.is(r, 'waited:ok', 'the step waits for the closing');
  PERFORM pg_temp.is(public.firm_is_closed(f), true, 'the firm is closed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id = f) + (SELECT count(*) FROM public.opportunities WHERE firm_id = f), 0::bigint, 'and makes no chain in it');
  RAISE NOTICE 'chain_at_certification: the step behind a closing passed';
END $$;
