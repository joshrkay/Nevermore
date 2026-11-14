-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh bring_submissions_in
-- Bringing the existing submissions in, and the rule that every submission and every quote request sits on one opportunity (story CRM-Q1.3;
-- docs/BROKER_CRM_BUILD.md D-29, D-193, D-195, D-207, D-214, D-219; ADR 0025; 20261119120000_bring_submissions_in.sql). The database is built as it was
-- BEFORE the chain existed: the migrations up to the records' are loaded, employers certify intakes (no account, contact or opportunity comes of it), a firm
-- is closed, and quote requests are recorded. Then the chain's migration and this story's are loaded, and the second one brings them in. Every migration is
-- loaded, in filename order (D-105).
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

-- ---------- before this story: certified intakes with no chain ----------
-- Four businesses of the default firm, two of them the same business as the third by D-193's name rule ("Harborview Dental Group", "... LLC" and "... , Inc."), the
-- earliest certified last in time of making; a business of another firm with a name that matches too (a match never crosses firms); an intake certified and
-- then changed (a submission that is a draft again, ADR 0025); a draft; and a closed firm's submission. Two quote requests on one, one on another and one on
-- the closed firm's.
DO $$
DECLARE f uuid; zo uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Acme Brokers', 'acme-brokers', now(), 'approved', now()) RETURNING id INTO f;
  INSERT INTO fx VALUES ('acme', f), ('default', public.default_firm_id());
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Old Brokers', 'old-brokers', now(), 'approved', now()) RETURNING id INTO f;
  INSERT INTO fx VALUES ('old', f);
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'old_owner@example.test', now(), false, now(), now()) RETURNING id INTO zo;
  INSERT INTO fx VALUES ('old_owner', zo);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (f, zo, 'owner');
END $$;

-- Certifies a new prospect's intake for p_company in p_firm; its first certification was recorded at p_at.
CREATE FUNCTION pg_temp.legacy(tag text, p_firm text, p_company text, p_state text, p_website text, p_at timestamptz) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.new_prospect('p_' || tag, 'Pat ' || tag, '555-0100');
  PERFORM pg_temp.start_intake('i_' || tag, 'p_' || tag, pg_temp.answers(p_company, p_state, jsonb_build_object('website', p_website)), p_firm);
  r := pg_temp.certify('i_' || tag, 'p_' || tag);
  IF r <> 'ok' THEN RAISE EXCEPTION 'FAIL: % could not certify: %', tag, r; END IF;
  -- A recorded certification is fixed; the test sets the time it was recorded at, as a real database has days between its.
  ALTER TABLE public.chamber_certifications DISABLE TRIGGER chamber_certifications_guard;
  UPDATE public.chamber_certifications SET recorded_at = p_at WHERE session_id = pg_temp.id('i_' || tag);
  ALTER TABLE public.chamber_certifications ENABLE TRIGGER chamber_certifications_guard;
END $$;

DO $$
DECLARE z uuid := pg_temp.id('old_owner');
BEGIN
  PERFORM pg_temp.legacy('harbor',  'default', 'Harborview Dental Group',       'TX', 'https://harborview.example', '2026-03-01');
  PERFORM pg_temp.legacy('harbor2', 'default', 'Harborview Dental Group LLC',   'TX', NULL,                         '2026-04-01');
  PERFORM pg_temp.legacy('harbor0', 'default', 'Harborview Dental Group, Inc.', 'TX', NULL,                         '2026-02-01');
  PERFORM pg_temp.legacy('zenith',  'acme',    'Zenith Cleaning',               'OR', NULL,                         '2026-03-15');
  PERFORM pg_temp.legacy('hacme',   'acme',    'Harborview Dental Group',       'TX', NULL,                         '2026-05-01');
  PERFORM pg_temp.legacy('changed', 'default', 'Changed Answers Inc',           'WA', NULL,                         '2026-05-10');
  -- The employer changes the answers after certifying: the certification is withdrawn and the intake is in progress again.
  PERFORM pg_temp.as_user('p_changed');
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || '{"employee_count":50}' WHERE id = pg_temp.id('i_changed');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.new_prospect('p_draft', 'Pat Draft', '555-0100');
  PERFORM pg_temp.start_intake('i_draft', 'p_draft', pg_temp.answers('Never Certified Inc'), 'default');
  PERFORM pg_temp.legacy('closed',  'old',     'Closed Firm Co',                'KS', NULL,                         '2026-01-01');
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES
    (pg_temp.id('i_harbor'), 'TriNet', 'sent'), (pg_temp.id('i_harbor'), 'Justworks', 'quoted'), (pg_temp.id('i_harbor0'), 'Paychex', 'sent'),
    (pg_temp.id('i_closed'), 'TriNet', 'sent');
  -- The old firm closes: its records go (none yet) and its intake stays.
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('old'), z, now() + interval '30 days');
  UPDATE public.firm_closures SET asked_at = asked_at - interval '31 days', closes_at = closes_at - interval '31 days' WHERE firm_id = pg_temp.id('old');
  PERFORM public.close_firm_now(pg_temp.id('old'));
  PERFORM pg_temp.is(public.firm_is_closed(pg_temp.id('old')), true, 'the old firm is closed');
  PERFORM pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = pg_temp.id('i_changed')), 'in_progress', 'the changed intake is a draft again');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_certifications), 7::bigint, 'seven certified intakes (the draft has none)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts) + (SELECT count(*) FROM public.contacts) + (SELECT count(*) FROM public.opportunities), 0::bigint,
    'before this story the submissions have no account, contact or opportunity');
  RAISE NOTICE 'bring_submissions_in: the old database is built';
END $$;

-- What the database holds now, to compare with after a second run.
CREATE TEMP TABLE snap (k text PRIMARY KEY, v jsonb NOT NULL);

-- The chain's step and then this story's migration, which brings them in and prints how many of each it made.
\i supabase/migrations/20261119110000_chain_at_certification.sql
\i supabase/migrations/20261119120000_bring_submissions_in.sql
\i supabase/migrations/20261119130000_accounts_table_query.sql
\i supabase/migrations/20261119140000_account_page.sql
\i supabase/migrations/20261119145000_account_tab.sql
SET client_min_messages = notice;

-- ---------- every certified submission has its chain, in its own firm, owned by nobody ----------
-- Break caught: a submission is left out (the draft that was certified once, or one of another firm), or one is given another's account (merged), or a record
-- is made in the wrong firm or with an owner; or the FEIN or the census reaches the CRM.
DO $$
DECLARE tag text; a public.accounts; o public.opportunities; c public.contacts; blob text;
BEGIN
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), 6::bigint, 'six accounts: one for each certified submission of an open firm, none merged');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts), 6::bigint, 'six contacts, one from each prospect');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities), 6::bigint, 'six opportunities');
  FOREACH tag IN ARRAY ARRAY['harbor', 'harbor2', 'harbor0', 'zenith', 'hacme', 'changed'] LOOP
    a := pg_temp.acct('i_' || tag); o := pg_temp.opp('i_' || tag);
    PERFORM pg_temp.is(o.id IS NOT NULL AND a.id IS NOT NULL, true, tag || ' is on an opportunity and an account');
    PERFORM pg_temp.is(a.firm_id, (SELECT firm_id FROM public.chamber_sessions WHERE id = pg_temp.id('i_' || tag)), tag || '''s account is in its intake''s firm');
    PERFORM pg_temp.is(o.firm_id, a.firm_id, tag || '''s opportunity is in the same firm');
    PERFORM pg_temp.is(a.owner_id IS NULL AND o.owner_id IS NULL, true, tag || ' is owned by nobody (D-214)');
    PERFORM pg_temp.is(a.source, 'employer_intake', tag || '''s account says where it came from (D-211)');
    SELECT * INTO c FROM public.contacts WHERE account_id = a.id;
    PERFORM pg_temp.is((c.prospect_user_id, c.is_main, c.owner_id IS NULL), (pg_temp.id('p_' || tag), true, true), tag || '''s contact is its prospect, the main contact');
    PERFORM pg_temp.is(o.main_contact_id, c.id, tag || '''s opportunity names that contact');
  END LOOP;
  PERFORM pg_temp.is((pg_temp.acct('i_harbor')).name || '/' || (pg_temp.acct('i_harbor')).state || '/' || (pg_temp.acct('i_harbor')).employees, 'Harborview Dental Group/TX/12',
    'the account is filled from the certified answers, by the same step');
  PERFORM pg_temp.is((pg_temp.opp('i_harbor')).name, 'March 2027 PEO search', 'and the opportunity named as at a first certification');
  PERFORM pg_temp.is((pg_temp.acct('i_changed')).employees, 12, 'a submission changed after certifying comes in on its certified answers, not the new ones');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = pg_temp.id('i_draft')), 0::bigint, 'a draft never certified has none (ADR 0025)');
  SELECT to_jsonb(x)::text INTO blob FROM (SELECT (SELECT jsonb_agg(to_jsonb(xa)) FROM public.accounts xa) AS accounts, (SELECT jsonb_agg(to_jsonb(xc)) FROM public.contacts xc) AS contacts,
    (SELECT jsonb_agg(to_jsonb(xo)) FROM public.opportunities xo) AS opportunities) x;
  PERFORM pg_temp.is(blob LIKE '%123456789%' OR blob LIKE '%Zelda%' OR blob LIKE '%Censusperson%', false, 'no FEIN and nothing of the census (ADR 0006)');
  RAISE NOTICE 'bring_submissions_in: every submission has its chain';
END $$;

-- ---------- duplicates are marked, the earliest first, and nothing is merged ----------
-- Break caught: the earliest is marked as a duplicate of the later; the run's own order decides (the three accounts are made in one transaction, so only the
-- submission's age can say which is earlier); a later one is marked as a duplicate of the next earlier instead of the earliest; a match crosses firms; or the two
-- are merged into one account.
DO $$
DECLARE earliest uuid := (pg_temp.acct('i_harbor0')).id;
BEGIN
  PERFORM pg_temp.is((pg_temp.acct('i_harbor0')).possible_duplicate_of, NULL::uuid, 'the earliest of the three is not marked');
  PERFORM pg_temp.is((pg_temp.acct('i_harbor')).possible_duplicate_of, earliest, 'the next is marked "Possible duplicate of" the earliest (D-195)');
  PERFORM pg_temp.is((pg_temp.acct('i_harbor2')).possible_duplicate_of, earliest, 'the latest too, of the earliest and not the one before it');
  PERFORM pg_temp.is((pg_temp.acct('i_zenith')).possible_duplicate_of, NULL::uuid, 'a different business is not marked');
  PERFORM pg_temp.is((pg_temp.acct('i_hacme')).possible_duplicate_of, NULL::uuid, 'the same name in another firm is not a match');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE possible_duplicate_of IS NOT NULL), 2::bigint, 'two marks in all');
  PERFORM pg_temp.is((pg_temp.acct('i_harbor0')).created_at, '2026-02-01'::timestamptz, 'an account is as old as its submission''s first certification');
  PERFORM pg_temp.is((SELECT c.created_at FROM public.contacts c WHERE c.account_id = (pg_temp.acct('i_harbor2')).id), '2026-04-01'::timestamptz, 'so is its contact');
  PERFORM pg_temp.is((pg_temp.opp('i_harbor')).created_at, '2026-03-01'::timestamptz, 'and its opportunity');
  RAISE NOTICE 'bring_submissions_in: duplicates passed';
END $$;

-- ---------- quote requests sit on the opportunity of their intake ----------
-- Break caught: a quote request is left without an opportunity (an intake brought in without its quote requests), or one is attached to the wrong opportunity.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id), 3::bigint, 'three quote requests are on an opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE o.id = (pg_temp.opp('i_harbor')).id), 2::bigint,
    'both of one submission''s on its opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests q WHERE NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.intake_id = q.session_id)), 1::bigint,
    'only the closed firm''s is on none');
  RAISE NOTICE 'bring_submissions_in: quote requests passed';
END $$;

-- ---------- a closed firm's submissions are left alone ----------
-- Break caught: the closed firm gets a chain back after closing deleted it (its records are gone on purpose, D-117), or the run fails on it.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE firm_id = pg_temp.id('old')) + (SELECT count(*) FROM public.contacts WHERE firm_id = pg_temp.id('old'))
    + (SELECT count(*) FROM public.opportunities WHERE firm_id = pg_temp.id('old')), 0::bigint, 'the closed firm holds no account, contact or opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE id = pg_temp.id('i_closed')), 1::bigint, 'its intake is kept');
  RAISE NOTICE 'bring_submissions_in: the closed firm passed';
END $$;

-- ---------- run twice: nothing new, and zeros reported ----------
-- Break caught: a second run makes a second copy of an account, contact or opportunity, or marks another duplicate, or reports a number it did not make.
DO $$
BEGIN
  INSERT INTO snap SELECT 'before', jsonb_build_object('a', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.accounts x), 'c', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.contacts x),
    'o', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.opportunities x));
END $$;
-- The migration itself, loaded again.
\i supabase/migrations/20261119120000_bring_submissions_in.sql
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.is((SELECT jsonb_build_object('a', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.accounts x), 'c', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.contacts x),
    'o', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.opportunities x)) ), (SELECT v FROM snap WHERE k = 'before'), 'the migration run again changed nothing');
  r := public.bring_submissions_in();
  PERFORM pg_temp.is(r, jsonb_build_object('submissions_found', 1, 'accounts', 0, 'contacts', 0, 'opportunities', 0, 'possible_duplicates', 0,
    'quote_requests_on_an_opportunity', 0, 'left_alone_closed_firm', 1), 'run again it reports zero of each (the closed firm''s submission is found and left alone)');
  RAISE NOTICE 'bring_submissions_in: run twice passed';
END $$;

-- ---------- and what it reports the first time ----------
-- Submissions that came in while the chain's trigger and this rule's were off (a restored backup, say): one the same business as the earliest, one new with a
-- quote request. The report counts what was made.
-- Break caught: a count is not the number made (the contact, the duplicate mark or the quote requests counted wrong, the closed firm's counted as made).
DO $$
DECLARE r jsonb;
BEGIN
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER chamber_sessions_chain;
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER chamber_sessions_has_opportunity;
  ALTER TABLE public.quote_requests DISABLE TRIGGER quote_requests_has_opportunity;
  PERFORM pg_temp.legacy('n_dup',  'default', 'Harborview Dental Group', 'TX', NULL, '2026-06-01');
  PERFORM pg_temp.legacy('n_new',  'default', 'Brand New Business',      'NV', NULL, '2026-06-02');
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (pg_temp.id('i_n_new'), 'TriNet', 'sent'), (pg_temp.id('i_n_new'), 'Paychex', 'sent');
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER chamber_sessions_chain;
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER chamber_sessions_has_opportunity;
  ALTER TABLE public.quote_requests ENABLE TRIGGER quote_requests_has_opportunity;
  r := public.bring_submissions_in();
  PERFORM pg_temp.is(r, jsonb_build_object('submissions_found', 3, 'accounts', 2, 'contacts', 2, 'opportunities', 2, 'possible_duplicates', 1,
    'quote_requests_on_an_opportunity', 2, 'left_alone_closed_firm', 1), 'the report: three found, two of each made, one marked, two quote requests, one closed firm left alone');
  PERFORM pg_temp.is((pg_temp.acct('i_n_dup')).possible_duplicate_of, (pg_temp.acct('i_harbor0')).id, 'the later one is marked a duplicate of the earliest');
  PERFORM pg_temp.is((pg_temp.acct('i_n_new')).possible_duplicate_of, NULL::uuid, 'the new business is not marked');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), 8::bigint, 'two accounts added to the six');
  RAISE NOTICE 'bring_submissions_in: the report passed';
END $$;

-- ---------- no API role runs it ----------
-- Break caught: the run, or the check behind the rule, is executable through the API (it answers for any intake by id, or makes a chain in any firm).
DO $$
DECLARE fn text; r text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.bring_submissions_in()', 'public.require_opportunity_for_intake(uuid)', 'public.enforce_opportunity_rule()'] LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      PERFORM pg_temp.is(has_function_privilege(r, fn, 'EXECUTE'), false, r || ' can''t run ' || fn);
    END LOOP;
  END LOOP;
  RAISE NOTICE 'bring_submissions_in: no API role passed';
END $$;

-- ---------- a submission from before certifications were recorded ----------
-- An intake whose submission is a row of its status history alone (it has no certification row) is a submission (intake_ever_certified). It is brought in on its own
-- answers, and then an advisor can take it to ready for market and record a send, which the rule needs an opportunity for.
-- Break caught: the run skips it and reports 0 (the story's P1), the rule does not count it as a submission, or the step refuses it for having no certification.
DO $$
DECLARE r jsonb; adv uuid; a public.accounts;
BEGIN
  PERFORM pg_temp.as_owner();
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER chamber_sessions_chain;
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER chamber_sessions_has_opportunity;
  PERFORM pg_temp.legacy('hist', 'default', 'History Only Co', 'MT', NULL, now());
  ALTER TABLE public.chamber_certifications DISABLE TRIGGER chamber_certifications_guard;
  DELETE FROM public.chamber_certifications WHERE session_id = pg_temp.id('i_hist');
  ALTER TABLE public.chamber_certifications ENABLE TRIGGER chamber_certifications_guard;
  ALTER TABLE public.submission_status_history DISABLE TRIGGER submission_status_history_append_only;
  UPDATE public.submission_status_history SET changed_at = '2026-01-20' WHERE session_id = pg_temp.id('i_hist') AND to_status = 'submitted';
  ALTER TABLE public.submission_status_history ENABLE TRIGGER submission_status_history_append_only;
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER chamber_sessions_chain;
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER chamber_sessions_has_opportunity;
  PERFORM pg_temp.is(public.intake_ever_certified(pg_temp.id('i_hist')), true, 'setup: its submission is in its status history alone');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_certifications WHERE session_id = pg_temp.id('i_hist')), 0::bigint, 'setup: it has no certification row');

  r := public.bring_submissions_in();
  PERFORM pg_temp.is(r ->> 'accounts', '1', 'the run chains it and counts it');
  PERFORM pg_temp.is(r ->> 'submissions_found', '2', 'found with the closed firm''s');
  a := pg_temp.acct('i_hist');
  PERFORM pg_temp.is(a.name, 'History Only Co', 'its account is made from its own answers');
  PERFORM pg_temp.is(a.created_at, '2026-01-20'::timestamptz, 'as old as its submission');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = a.id), 1::bigint, 'with its prospect as contact');

  -- Its advisor takes it to ready for market and records a send.
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'adv@example.test', now(), false, now(), now()) RETURNING id INTO adv;
  INSERT INTO fx VALUES ('adv', adv);
  INSERT INTO public.user_roles (user_id, role) VALUES (adv, 'advisor');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (public.default_firm_id(), adv, 'owner');
  PERFORM pg_temp.as_user('adv');
  PERFORM public.set_submission_status(pg_temp.id('i_hist'), 'under_review', 'Picked up');
  PERFORM public.set_submission_status(pg_temp.id('i_hist'), 'ready_for_market', 'Reviewed');
  PERFORM public.advisor_record_quote_send(pg_temp.id('i_hist'), 'TriNet', NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests q JOIN public.opportunities o ON o.intake_id = q.session_id WHERE q.session_id = pg_temp.id('i_hist')), 1::bigint,
    'a send can be recorded, and the quote request is on its opportunity');
  PERFORM pg_temp.is(pg_temp.attempt(format('DELETE FROM public.opportunities WHERE intake_id = %L', pg_temp.id('i_hist'))), '23514', 'and the rule counts it as a submission');

  -- One that is in progress again and holds no quote request: still a submission, so its opportunity stays.
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER chamber_sessions_chain;
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER chamber_sessions_has_opportunity;
  PERFORM pg_temp.legacy('hist2', 'default', 'History Two Co', 'MT', NULL, now());
  ALTER TABLE public.chamber_certifications DISABLE TRIGGER chamber_certifications_guard;
  DELETE FROM public.chamber_certifications WHERE session_id = pg_temp.id('i_hist2');
  ALTER TABLE public.chamber_certifications ENABLE TRIGGER chamber_certifications_guard;
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER chamber_sessions_chain;
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER chamber_sessions_has_opportunity;
  PERFORM public.bring_submissions_in();
  UPDATE public.chamber_sessions SET status = 'in_progress' WHERE id = pg_temp.id('i_hist2');
  PERFORM pg_temp.is(pg_temp.attempt(format('DELETE FROM public.opportunities WHERE intake_id = %L', pg_temp.id('i_hist2'))), '23514', 'an ever-submitted intake in progress again keeps its opportunity');
  RAISE NOTICE 'bring_submissions_in: a submission from status history alone passed';
END $$;

-- ---------- an older submission brought in is the earlier one ----------
-- An account made at a certification since the chain began is LATER than a submission brought in from before it; D-195 marks the later one.
-- Break caught: the brought-in older submission is marked a duplicate of the newer account, and the newer one is left unmarked.
DO $$
DECLARE newer uuid; older uuid;
BEGIN
  PERFORM pg_temp.legacy('late', 'default', 'Late Match Business', 'NM', NULL, now());
  newer := (pg_temp.acct('i_late')).id;
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER chamber_sessions_chain;
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER chamber_sessions_has_opportunity;
  PERFORM pg_temp.legacy('early', 'default', 'Late Match Business', 'NM', NULL, '2026-01-10');
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER chamber_sessions_chain;
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER chamber_sessions_has_opportunity;
  PERFORM pg_temp.is(public.bring_submissions_in() ->> 'possible_duplicates', '1', 'one mark');
  older := (pg_temp.acct('i_early')).id;
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = older), NULL::uuid, 'the older submission''s account is not marked');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = newer), older, 'the newer account is marked a duplicate of it');
  RAISE NOTICE 'bring_submissions_in: the older one is the earlier passed';
END $$;

-- ---------- the rule: a submission and a quote request sit on an opportunity ----------
-- The rule is a constraint trigger (D-29), so each case below is a single statement the database refuses.
-- Break caught: a certification that makes no chain is recorded anyway; an opportunity can be deleted or let go of its intake; a quote request can be made on,
-- or moved to, an intake that sits on none.
DO $$
DECLARE sid uuid; opp uuid; qr bigint; a uuid;
BEGIN
  -- A first certification passes: the chain is made before the rule asks.
  PERFORM pg_temp.legacy('r1', 'default', 'Rule One Co', 'CO', NULL, now());
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = pg_temp.id('i_r1')), 1::bigint, 'a new certification makes its chain and passes the rule');

  -- A certification that makes no chain (its trigger off, as a bug would leave it) is refused, and the intake stays a draft.
  ALTER TABLE public.chamber_sessions DISABLE TRIGGER chamber_sessions_chain;
  PERFORM pg_temp.new_prospect('p_r2', 'Pat R2', '555-0100');
  PERFORM pg_temp.start_intake('i_r2', 'p_r2', pg_temp.answers('Rule Two Co', 'CO'), 'default');
  PERFORM pg_temp.is(left(pg_temp.certify('i_r2', 'p_r2'), 5), '23514', 'a certification that leaves its submission with no opportunity is refused');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_certifications WHERE session_id = pg_temp.id('i_r2')), 0::bigint, 'and records nothing');
  PERFORM pg_temp.is((SELECT status FROM public.chamber_sessions WHERE id = pg_temp.id('i_r2')), 'in_progress', 'the intake stays a draft');
  ALTER TABLE public.chamber_sessions ENABLE TRIGGER chamber_sessions_chain;
  PERFORM pg_temp.is(pg_temp.certify('i_r2', 'p_r2'), 'ok', 'with the chain made it certifies');

  -- The opportunity of a submission can't be deleted, or let go of its intake.
  sid := pg_temp.id('i_r1'); opp := (pg_temp.opp('i_r1')).id;
  PERFORM pg_temp.is(pg_temp.attempt(format('DELETE FROM public.opportunities WHERE id = %L', opp)), '23514', 'the opportunity of a submission can''t be deleted');
  PERFORM pg_temp.is(pg_temp.attempt(format('UPDATE public.opportunities SET intake_id = NULL WHERE id = %L', opp)), '23514', 'nor let go of its intake');
  PERFORM pg_temp.is(pg_temp.attempt(format('UPDATE public.opportunities SET name = %L WHERE id = %L', 'Renamed search', opp)), 'rows:1', 'but it can be changed in any other way');
  PERFORM pg_temp.is(pg_temp.attempt(format('DELETE FROM public.accounts WHERE id = %L', (pg_temp.acct('i_r1')).id)), '23503', 'and its account stays (an account with an opportunity is not deleted)');
  -- ...but one opportunity can give its intake to another in one transaction, as a merge will.
  a := (pg_temp.acct('i_r1')).id;
  SET CONSTRAINTS opportunities_keep_intake_delete DEFERRED;
  DELETE FROM public.opportunities WHERE id = opp;
  INSERT INTO public.opportunities (firm_id, account_id, intake_id, name) VALUES (pg_temp.id('default'), a, sid, 'Replacement search');
  SET CONSTRAINTS opportunities_keep_intake_delete IMMEDIATE;
  PERFORM pg_temp.is((SELECT name FROM public.opportunities WHERE intake_id = sid), 'Replacement search', 'the rule is deferrable: an opportunity is replaced in one transaction');

  -- A draft an agent started: its opportunity holds a draft, which no rule keeps.
  PERFORM pg_temp.new_prospect('p_ag');
  PERFORM pg_temp.start_intake('i_ag', 'p_ag', pg_temp.answers('Agent Draft Co'), 'default');
  INSERT INTO public.accounts (firm_id, name, source) VALUES (pg_temp.id('default'), 'Agent''s Account', 'added_by_hand') RETURNING id INTO a;
  INSERT INTO public.opportunities (firm_id, account_id, intake_id, name) VALUES (pg_temp.id('default'), a, pg_temp.id('i_ag'), 'Agent search') RETURNING id INTO opp;
  PERFORM pg_temp.is(pg_temp.attempt(format('DELETE FROM public.opportunities WHERE id = %L', opp)), 'rows:1', 'the opportunity of a draft that was never certified can be deleted');
  DELETE FROM public.opportunities WHERE id = opp;

  -- Quote requests. An intake with no opportunity takes none, and none is moved to it.
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (%L, 'TriNet', 'sent')$q$, pg_temp.id('i_ag'))), '23514',
    'a quote request on an intake that sits on no opportunity is refused');
  INSERT INTO public.opportunities (firm_id, account_id, intake_id, name) VALUES (pg_temp.id('default'), a, pg_temp.id('i_ag'), 'Agent search again');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (%L, 'TriNet', 'sent')$q$, pg_temp.id('i_ag'))), 'rows:1',
    'on one that does it is made');
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (pg_temp.id('i_ag'), 'TriNet', 'sent');
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (sid, 'TriNet', 'sent') RETURNING id INTO qr;
  PERFORM pg_temp.new_prospect('p_nochain');
  PERFORM pg_temp.start_intake('i_nochain', 'p_nochain', pg_temp.answers('No Chain Co'), 'default');
  PERFORM pg_temp.is(pg_temp.attempt(format('UPDATE public.quote_requests SET session_id = %L WHERE id = %L', pg_temp.id('i_nochain'), qr)), '23514', 'nor can a quote request be moved to such an intake');
  PERFORM pg_temp.is(pg_temp.attempt(format('UPDATE public.quote_requests SET status = %L WHERE id = %L', 'quoted', qr)), 'rows:1', 'any other change to a quote request is not asked');
  -- A quote request keeps its intake's opportunity: with a quote request on it, the opportunity of even a draft stays.
  PERFORM pg_temp.is(pg_temp.attempt(format('DELETE FROM public.opportunities WHERE intake_id = %L', pg_temp.id('i_ag'))), '23514', 'the opportunity a quote request sits on can''t be deleted');
  RAISE NOTICE 'bring_submissions_in: the rule passed';
END $$;

-- ---------- what the rule leaves alone ----------
-- Break caught: closing a firm that holds submissions fails (the rule refuses the closing's own deletes) or leaves records; a closed firm's submission can't be
-- certified again or take a quote request; deleting an intake is refused; an intake can be moved to another firm with no chain behind.
DO $$
DECLARE f uuid; z uuid; r text;
BEGIN
  INSERT INTO public.firms (name, address, approved_at, decision, decided_at) VALUES ('Closing Soon', 'closing-soon', now(), 'approved', now()) RETURNING id INTO f;
  INSERT INTO fx VALUES ('soon', f);
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (gen_random_uuid(), 'authenticated', 'authenticated', 'soon_owner@example.test', now(), false, now(), now()) RETURNING id INTO z;
  INSERT INTO fx VALUES ('soon_owner', z);
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (f, z, 'owner');
  PERFORM pg_temp.legacy('s1', 'soon', 'Closing Soon Client', 'ID', NULL, now());
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (pg_temp.id('i_s1'), 'TriNet', 'sent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE firm_id = f), 1::bigint, 'the firm has a chain');

  -- A closing firm keeps its chain and its rule until it closes.
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (f, z, now() + interval '30 days');
  PERFORM pg_temp.is(pg_temp.attempt(format('DELETE FROM public.opportunities WHERE firm_id = %L', f)), '23514', 'a closing firm''s opportunities are not deleted by hand');
  UPDATE public.firm_closures SET asked_at = asked_at - interval '31 days', closes_at = closes_at - interval '31 days' WHERE firm_id = f;
  PERFORM public.close_firm_now(f);
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE firm_id = f) + (SELECT count(*) FROM public.accounts WHERE firm_id = f), 0::bigint, 'closing deletes the chain the rule keeps');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE id = pg_temp.id('i_s1')), 1::bigint, 'and keeps the intake');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests WHERE session_id = pg_temp.id('i_s1')), 1::bigint, 'and its quote request');

  -- The closed firm: the employer certifies again and a quote request is recorded, with no chain.
  PERFORM pg_temp.is(pg_temp.certify('i_s1', 'p_s1', 'Signer After Closing'), 'ok', 'a closed firm''s intake is certified again');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (%L, 'Paychex', 'sent')$q$, pg_temp.id('i_s1'))), 'rows:1',
    'and takes a quote request');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE firm_id = f), 0::bigint, 'with no opportunity made');

  -- An intake's deletion leaves its opportunity with none and is not refused.
  PERFORM pg_temp.is(pg_temp.attempt(format('DELETE FROM public.chamber_sessions WHERE id = %L', pg_temp.id('i_r2'))), 'rows:1', 'a submission''s deletion is not refused');
  DELETE FROM public.chamber_sessions WHERE id = pg_temp.id('i_r2');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE account_id = (SELECT id FROM public.accounts WHERE name = 'Rule Two Co') AND intake_id IS NULL), 1::bigint,
    'its opportunity stays, holding none');
  RAISE NOTICE 'bring_submissions_in: what the rule leaves alone passed';
END $$;

-- ---------- a submission can't be left with no opportunity by moving it ----------
-- Break caught: an intake that an opportunity holds is moved to another firm, or its opportunity is deleted first to let it.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.chamber_sessions SET firm_id = %L WHERE id = %L$q$, pg_temp.id('acme'), pg_temp.id('i_harbor'))), '23503',
    'a submission can''t be moved to another firm while its opportunity holds it');
  PERFORM pg_temp.is(pg_temp.attempt(format('DELETE FROM public.opportunities WHERE intake_id = %L', pg_temp.id('i_harbor'))), '23514', 'nor can its opportunity be removed to let it');
  RAISE NOTICE 'bring_submissions_in: all cases passed';
END $$;
