-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh crm_records
-- The records (story CRM-Q1.1a; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-186, D-192, D-194, D-197, D-204, D-206, D-207, D-209, D-211;
-- 20261119100000_crm_records.sql). Accounts, contacts and opportunities: each with its firm and its record owner, seen by level through
-- can_see_firm_record (a contact and an opportunity by their account's), with a history and a version, an account's status and an opportunity's
-- stage worked out and never stored, and closed to every write through the API. Two firms are used throughout. Every migration is loaded, in
-- filename order (D-105), this story's last.
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
\i supabase/migrations/20261119100000_crm_records.sql
SET client_min_messages = notice;

CREATE TEMP TABLE fx (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON fx TO anon, authenticated, service_role;
CREATE FUNCTION pg_temp.id(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM fx WHERE name = n $$;

CREATE FUNCTION pg_temp.new_user(n text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at)
  VALUES (uid, 'authenticated', 'authenticated', n || '@example.test', now(), false, now(), now());
  INSERT INTO fx VALUES (n, uid);
  RETURN uid;
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

-- The same person's claims with the superuser's rights: what a trigger sees when a function writes on their behalf.
CREATE FUNCTION pg_temp.claims_of(n text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test')::text, false);
  PERFORM set_config('request.headers', '', false);
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

CREATE FUNCTION pg_temp.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM set_config('request.headers', '', false);
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

-- The SQLSTATE and message a statement raised, or 'ok' when it did not. Nothing is rolled back.
CREATE FUNCTION pg_temp.refusal(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text; m text;
BEGIN
  BEGIN
    EXECUTE stmt;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    RETURN s || ': ' || m;
  END;
END $$;

-- Which of the test's named records the current caller reads from a table (row security applies), by name; 'denied' for a table it may not read.
CREATE FUNCTION pg_temp.seen(tbl text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  EXECUTE format('SELECT COALESCE(string_agg(f.name, '','' ORDER BY f.name), '''') FROM %s t JOIN fx f ON f.id = t.id', tbl) INTO r;
  RETURN r;
EXCEPTION WHEN insufficient_privilege THEN RETURN 'denied';
END $$;

-- An intake of a firm, started by its own prospect, placed by the superuser.
CREATE FUNCTION pg_temp.intake(n text, firm text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE uid uuid := pg_temp.new_user('p_' || n); sid uuid;
BEGIN
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (uid, jsonb_build_object('company_name', n)) RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id(firm) WHERE id = sid;
  INSERT INTO fx VALUES (n, sid);
  RETURN sid;
END $$;

-- Records, made as the superuser (no API role can write them). Each is named in fx.
CREATE FUNCTION pg_temp.account(n text, firm text, p_owner text, nm text DEFAULT NULL, site text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.accounts (source, firm_id, owner_id, name, website) VALUES ('added_by_hand', pg_temp.id(firm), pg_temp.id(p_owner), COALESCE(nm, n), site) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.contact(n text, p_account text, p_owner text, p_email text DEFAULT NULL, p_phone text DEFAULT NULL, p_main boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.contacts (firm_id, account_id, owner_id, first_name, last_name, email, phone, is_main)
  SELECT a.firm_id, a.id, pg_temp.id(p_owner), 'First ' || n, 'Last ' || n, p_email, p_phone, p_main FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.opportunity(n text, p_account text, p_owner text, p_intake text DEFAULT NULL, p_main_contact text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, intake_id, main_contact_id)
  SELECT a.firm_id, a.id, pg_temp.id(p_owner), 'PEO search ' || n, pg_temp.id(p_intake), pg_temp.id(p_main_contact) FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

-- ---------- set up: two firms; Acme sees by level; people at each level; one whose membership ended ----------
DO $$
DECLARE acme uuid; zenith uuid; sales uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_lead'); PERFORM pg_temp.new_user('acme_agent1'); PERFORM pg_temp.new_user('acme_agent2');
  PERFORM pg_temp.new_user('acme_agent3'); PERFORM pg_temp.new_user('acme_removed'); PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('zenith_agent');
  PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_teams (firm_id, name) VALUES (acme, 'Sales') RETURNING id INTO sales;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner', NULL), (acme, pg_temp.id('acme_lead'), 'lead', sales), (acme, pg_temp.id('acme_agent1'), 'agent', NULL),
    (acme, pg_temp.id('acme_agent2'), 'agent', sales), (acme, pg_temp.id('acme_agent3'), 'agent', NULL),
    (zenith, pg_temp.id('zenith_owner'), 'owner', NULL), (zenith, pg_temp.id('zenith_agent'), 'agent', NULL);
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (acme, pg_temp.id('acme_removed'), 'agent', now() - interval '3 days', now() - interval '1 day');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
END $$;

-- ---------- the records exist, with the columns later stories rely on ----------
-- Break caught: a table or a column a later story reads is missing, so that story would have to change the table.
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(t.tbl || '.' || t.col, ', ') INTO missing
  FROM (VALUES
    ('accounts', 'id'), ('accounts', 'firm_id'), ('accounts', 'owner_id'), ('accounts', 'name'), ('accounts', 'trade_name'), ('accounts', 'website'),
    ('accounts', 'web_domain'), ('accounts', 'phone'), ('accounts', 'street'), ('accounts', 'city'), ('accounts', 'state'), ('accounts', 'postal_code'),
    ('accounts', 'industry'), ('accounts', 'employees'), ('accounts', 'states_of_operation'), ('accounts', 'current_provider'), ('accounts', 'source'),
    ('accounts', 'possible_duplicate_of'), ('accounts', 'archived_at'), ('accounts', 'created_at'), ('accounts', 'updated_at'), ('accounts', 'version'),
    ('contacts', 'id'), ('contacts', 'firm_id'), ('contacts', 'account_id'), ('contacts', 'owner_id'), ('contacts', 'first_name'), ('contacts', 'last_name'),
    ('contacts', 'title'), ('contacts', 'email'), ('contacts', 'phone'), ('contacts', 'mobile'), ('contacts', 'is_main'), ('contacts', 'do_not_email'),
    ('contacts', 'prospect_user_id'), ('contacts', 'created_at'), ('contacts', 'updated_at'), ('contacts', 'version'),
    ('opportunities', 'id'), ('opportunities', 'firm_id'), ('opportunities', 'account_id'), ('opportunities', 'owner_id'), ('opportunities', 'intake_id'),
    ('opportunities', 'name'), ('opportunities', 'target_start'), ('opportunities', 'employees'), ('opportunities', 'main_contact_id'),
    ('opportunities', 'expected_close'), ('opportunities', 'value'), ('opportunities', 'source'), ('opportunities', 'next_step'),
    ('opportunities', 'created_at'), ('opportunities', 'updated_at'), ('opportunities', 'version')
  ) AS t (tbl, col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.tbl AND c.column_name = t.col);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: missing columns: %', missing; END IF;
  -- Renewal date, labels and custom fields are not here (D-186, D-198).
  SELECT string_agg(c.table_name || '.' || c.column_name, ', ') INTO missing FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name IN ('accounts', 'contacts', 'opportunities') AND (c.column_name LIKE '%renewal%' OR c.column_name LIKE '%label%' OR c.column_name LIKE '%custom%');
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'FAIL: columns a later epic owns are here: %', missing; END IF;
  RAISE NOTICE 'crm_records: the columns passed';
END $$;

-- ---------- the web domain ----------
-- Break caught: the match key of D-193 keeps a scheme, a path, a port, a www. or capitals, so one site is two domains; or it is settable.
DO $$
BEGIN
  PERFORM pg_temp.is(public.web_domain_of('https://www.HarborviewDental.example/about?x=1#top'), 'harborviewdental.example', 'a full address');
  PERFORM pg_temp.is(public.web_domain_of('harborviewdental.example'), 'harborviewdental.example', 'a bare domain');
  PERFORM pg_temp.is(public.web_domain_of('  WWW.Example.COM:8080/a/b '), 'example.com', 'a port, capitals, spaces and www.');
  PERFORM pg_temp.is(public.web_domain_of('http://user:pw@shop.example.com./x'), 'shop.example.com', 'a login and a trailing dot');
  PERFORM pg_temp.is(public.web_domain_of('http://sub.www.example.com'), 'sub.www.example.com', 'only a leading www. goes');
  PERFORM pg_temp.is(public.web_domain_of(E'\thttps://Example.com/\n'), 'example.com', 'a tab or a line break around the address is trimmed like a space');
  PERFORM pg_temp.is(public.web_domain_of(E' \u00a0www.Example.com\r\n'), 'example.com', 'and so is a non-breaking space');
  PERFORM pg_temp.is(public.web_domain_of('http:/x.example.com'), 'x.example.com', 'a scheme with one slash is a scheme');
  PERFORM pg_temp.is(public.web_domain_of('http:///x.example.com/y'), 'x.example.com', 'and one with three');
  PERFORM pg_temp.is(public.web_domain_of('HTTPS:\\x.example.com\y'), 'x.example.com', 'and one with backslashes');
  PERFORM pg_temp.is(public.web_domain_of('example.com:8080'), 'example.com', 'a port on a bare domain is not taken for a scheme');
  PERFORM pg_temp.is(public.web_domain_of('www.'), NULL, 'nothing left is no domain');
  PERFORM pg_temp.is(public.web_domain_of('   '), NULL, 'blank is no domain');
  PERFORM pg_temp.is(public.web_domain_of(NULL), NULL, 'nothing is no domain');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.accounts SET web_domain = 'x.example'$q$), '428C9', 'the domain can''t be set by hand');
  RAISE NOTICE 'crm_records: web domain passed';
END $$;

-- ---------- what a record must have ----------
-- Break caught: a rule of the chain is not a constraint, so a record the story forbids can be written.
DO $$
DECLARE
  a1 uuid; a2 uuid; za uuid; c1 uuid; i1 uuid; i2 uuid; zi uuid; o1 uuid;
  acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); r text;
BEGIN
  a1 := pg_temp.account('a1', 'acme', 'acme_agent1', 'Harborview Dental Group', 'https://www.HarborviewDental.example/about');
  a2 := pg_temp.account('a2', 'acme', NULL);
  za := pg_temp.account('za', 'zenith', 'zenith_agent');
  PERFORM pg_temp.is((SELECT web_domain FROM public.accounts WHERE id = a1), 'harborviewdental.example', 'the domain follows the website');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (firm_id, name) VALUES (%L, 'No source')$q$, acme)), '23502', 'an account made with no source is refused, not made Added by hand: the step that makes it must say where it came from');
  PERFORM pg_temp.is((SELECT states_of_operation FROM public.accounts WHERE id = a1), '{}'::text[], 'with no states of operation yet');

  -- accounts
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (source, firm_id, name) VALUES ('added_by_hand', %L, '')$q$, acme)), '23514', 'an account needs a name');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (source, firm_id, name) VALUES ('added_by_hand', %L, '   ')$q$, acme)), '23514', 'not blank spaces');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (source, firm_id, name) VALUES ('added_by_hand', %L, NULL)$q$, acme)), '23502', 'nor none');
  PERFORM pg_temp.is(pg_temp.attempt($q$INSERT INTO public.accounts (source, name) VALUES ('added_by_hand', 'No firm')$q$), '23502', 'an account has a firm');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (source, firm_id, name, state) VALUES ('added_by_hand', %L, 'X', 'ZZ')$q$, acme)), '23514', 'a state is a state code');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (source, firm_id, name, states_of_operation) VALUES ('added_by_hand', %L, 'X', ARRAY['CA', 'XX'])$q$, acme)), '23514', 'and so is each state of operation');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (source, firm_id, name, employees) VALUES ('added_by_hand', %L, 'X', -1)$q$, acme)), '23514', 'employees are not negative');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (firm_id, name, source) VALUES (%L, 'X', 'made up')$q$, acme)), '23514', 'a source is one the product lists');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (firm_id, name, source) VALUES (%L, 'X', 'employer_intake')$q$, acme)), 'rows:1', 'Employer''s intake is one');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (source, firm_id, name, possible_duplicate_of) VALUES ('added_by_hand', %L, 'X', %L)$q$, acme, za)), '23503', 'a possible duplicate is of an account of the same firm');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (source, firm_id, name, possible_duplicate_of) VALUES ('added_by_hand', %L, 'X', %L)$q$, acme, a1)), 'rows:1', 'and that is allowed');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.accounts SET possible_duplicate_of = id WHERE id = %L$q$, a1)), '23514', 'an account is not a possible duplicate of itself');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (source, firm_id, owner_id, name) VALUES ('added_by_hand', %L, %L, 'X')$q$, acme, gen_random_uuid())), '23503', 'an owner is a person');

  -- contacts
  c1 := pg_temp.contact('c1', 'a1', 'acme_agent2', 'elena@harborview.example', NULL, true);
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email) VALUES (%L, %L, 'Marsh', 'x@example.test')$q$, zenith, a1)), '23503', 'a contact is on an account of its own firm');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, last_name, email) VALUES (%L, 'Marsh', 'x@example.test')$q$, acme)), '23502', 'a contact is on an account');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email) VALUES (%L, %L, '', 'x@example.test')$q$, acme, a1)), '23514', 'a contact has a last name');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name) VALUES (%L, %L, 'Marsh')$q$, acme, a1)), '23514', 'and an email or a phone');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email, phone) VALUES (%L, %L, 'Marsh', '  ', ' ')$q$, acme, a1)), '23514', 'not blanks');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, phone) VALUES (%L, %L, 'Marsh', '503-555-0100')$q$, acme, a1)), 'rows:1', 'a phone alone will do');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email) VALUES (%L, %L, 'Marsh', 'x@example.test')$q$, acme, a1)), 'rows:1', 'an email alone will do');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, mobile) VALUES (%L, %L, 'Marsh', '503-555-0102')$q$, acme, a1)), 'rows:1', 'so will a mobile number, which is a phone');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email) VALUES (%L, %L, 'Marsh', 'not an email')$q$, acme, a1)), '23514', 'an email looks like one');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email, is_main) VALUES (%L, %L, 'Two', 'two@example.test', true)$q$, acme, a1)), '23505', 'an account has at most one main contact');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email, is_main) VALUES (%L, %L, 'Two', 'two@example.test', true)$q$, acme, a2)), 'rows:1', 'another account has its own');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email, is_main) VALUES (%L, %L, 'Two', 'two@example.test', false), (%L, %L, 'Three', 'three@example.test', false)$q$, acme, a1, acme, a1)), 'rows:2', 'and any number are not');
  INSERT INTO public.contacts (firm_id, account_id, last_name, email, prospect_user_id) VALUES (acme, a2, 'Pro', 'pro@example.test', pg_temp.id('nobody'));
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email, prospect_user_id) VALUES (%L, %L, 'Pro Again', 'pro2@example.test', %L)$q$, acme, a2, pg_temp.id('nobody'))), '23505', 'a prospect is one contact of an account');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email, prospect_user_id) VALUES (%L, %L, 'Pro', 'pro@example.test', %L)$q$, acme, a1, pg_temp.id('nobody'))), 'rows:1', 'but may be a contact of another');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.contacts (firm_id, account_id, last_name, email, prospect_user_id) VALUES (%L, %L, 'Pro Again', 'pro2@example.test', %L) ON CONFLICT (account_id, prospect_user_id) DO NOTHING$q$, acme, a2, pg_temp.id('nobody'))), 'rows:0', 'and making the same one twice can be left to do nothing');

  -- opportunities
  i1 := pg_temp.intake('i1', 'acme'); i2 := pg_temp.intake('i2', 'acme'); zi := pg_temp.intake('zi', 'zenith');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, name) VALUES (%L, 'PEO search')$q$, acme)), '23502', 'an opportunity is on an account');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, account_id, name) VALUES (%L, %L, 'PEO search')$q$, zenith, a1)), '23503', 'of its own firm');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, account_id, name) VALUES (%L, %L, '')$q$, acme, a1)), '23514', 'and has a name');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, account_id, name, value) VALUES (%L, %L, 'PEO search', -5)$q$, acme, a1)), '23514', 'a value is not negative');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, account_id, name, employees) VALUES (%L, %L, 'PEO search', -5)$q$, acme, a1)), '23514', 'nor are the employees');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, account_id, name, main_contact_id) VALUES (%L, %L, 'PEO search', %L)$q$, acme, a2, c1)), '23503', 'its main contact is a contact of the same account');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, account_id, name, intake_id) VALUES (%L, %L, 'PEO search', %L)$q$, acme, a1, zi)), '23503', 'its intake is of the same firm');
  o1 := pg_temp.opportunity('o1', 'a1', 'acme_agent1', 'i1', 'c1');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, account_id, name, intake_id) VALUES (%L, %L, 'Another', %L)$q$, acme, a2, i1)), '23505', 'an intake is on at most one opportunity (D-207)');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, account_id, name, intake_id) VALUES (%L, %L, 'Another', %L)$q$, acme, a1, i2)), 'rows:1', 'and an opportunity of an account may have any other intake');
  -- The intake's own side: the service role can move an intake to another firm (keep_intake_firm binds only the browser's roles), and an intake that
  -- an opportunity holds must not leave the opportunity's firm.
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.chamber_sessions SET firm_id = %L WHERE id = %L$q$, zenith, i1)), '23503', 'the service role can''t move an intake that an opportunity holds to another firm');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.chamber_sessions SET firm_id = %L WHERE id = %L$q$, zenith, i2)), 'rows:1', 'but can move one that none holds');
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.chamber_sessions SET firm_id = %L WHERE id = %L$q$, zenith, i1)), '23503', 'nor can the superuser');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.chamber_sessions SET firm_id = %L WHERE id = %L$q$, acme, i1)), 'rows:1', 'and a save of the same firm is not a move');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.opportunities SET intake_id = %L WHERE id = %L$q$, i2, o1)), 'rows:1', 'an opportunity holds one intake, so a second is a change of it, not an addition');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.opportunities (firm_id, account_id, name, intake_id) VALUES (%L, %L, 'Same step again', %L) ON CONFLICT (intake_id) DO NOTHING$q$, acme, a1, i1)), 'rows:0', 'the step that makes the chain can be run twice');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE intake_id = i1), 1::bigint, 'and still makes one');
  -- Nothing here stops the later stories: an opportunity can be made with no intake and given one later; an intake needs no opportunity to exist.
  PERFORM pg_temp.opportunity('o2', 'a1', 'acme_agent1');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.opportunities SET intake_id = %L WHERE id = %L$q$, i2, pg_temp.id('o2'))), 'rows:1', 'an intake is attached to an opportunity that had none');
  PERFORM pg_temp.is((SELECT count(*) FROM public.chamber_sessions WHERE id = zi AND NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.intake_id = zi)), 1::bigint, 'and an intake with no opportunity is not refused (the rule that every submission has one is CRM-Q1.3''s)');

  -- the links that go when what they point at goes
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM public.accounts WHERE id = %L$q$, a1)), '23503', 'an account that still has an opportunity is not deleted by a stray delete');
  RAISE NOTICE 'crm_records: constraints passed';
END $$;

-- ---------- who sees what ----------
-- Break caught: an account is read by someone who may not see it (another firm, a platform admin, a former member, a signed-out caller, an
-- agent of another's); a contact or an opportunity is read by its own owner rather than by whoever may see its account; changing an account's
-- owner does not change at once who sees it and what hangs off it; a record with no owner, or whose owner left, is seen by an agent; Nevermore support
-- sees nothing without a session and an owner's view with one.
DO $$
DECLARE c uuid; sess uuid;
BEGIN
  PERFORM pg_temp.account('a3', 'acme', 'acme_agent2');
  PERFORM pg_temp.account('a4', 'acme', 'acme_agent3');
  PERFORM pg_temp.account('a5', 'acme', 'acme_removed');
  PERFORM pg_temp.contact('c2', 'a1', 'acme_agent1', NULL, '503-555-0101');
  PERFORM pg_temp.contact('c3', 'a3', 'acme_agent3', 'c3@example.test');
  PERFORM pg_temp.contact('c4', 'a2', 'acme_agent1', 'c4@example.test');
  PERFORM pg_temp.opportunity('o3', 'a3', 'acme_agent1');
  PERFORM pg_temp.opportunity('o4', 'a2', 'acme_agent2');
  PERFORM pg_temp.contact('zc', 'za', 'zenith_agent', 'zc@example.test');
  PERFORM pg_temp.opportunity('zo', 'za', 'zenith_agent', 'zi');

  -- Acme sees by level. a1: agent1's (no team), a2: no owner, a3: agent2's (team Sales), a4: agent3's, a5: owned by someone whose membership ended.
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), 'a1', 'an agent sees the accounts they own');
  PERFORM pg_temp.is(pg_temp.seen('public.contacts'), 'c1,c2', 'and the contacts on them, whoever owns the contact (c1 is agent2''s, c4 is agent1''s on an account that is no one''s)');
  PERFORM pg_temp.is(pg_temp.seen('public.opportunities'), 'o1,o2', 'and the opportunities on them, whoever owns the opportunity (o3 is agent1''s on agent2''s account)');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), 'a3', 'another agent sees theirs');
  PERFORM pg_temp.is(pg_temp.seen('public.contacts'), 'c3', 'a contact they own on an account they may not see is not theirs to see; one on theirs is');
  PERFORM pg_temp.is(pg_temp.seen('public.opportunities'), 'o3', 'likewise an opportunity');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), 'a3', 'a team lead sees the accounts of their team''s members, and not an agent''s with no team');
  PERFORM pg_temp.is(pg_temp.seen('public.contacts') || '|' || pg_temp.seen('public.opportunities'), 'c3|o3', 'and what hangs off them');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), 'a1,a2,a3,a4,a5', 'an owner sees the firm''s, those with no owner and those whose owner left included');
  PERFORM pg_temp.is(pg_temp.seen('public.contacts'), 'c1,c2,c3,c4', 'all its contacts');
  PERFORM pg_temp.is(pg_temp.seen('public.opportunities'), 'o1,o2,o3,o4', 'and all its opportunities');
  PERFORM pg_temp.as_user('acme_agent3', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), 'a4', 'an agent does not see an account with no owner, nor one whose owner left');
  -- Nobody outside the firm.
  PERFORM pg_temp.as_user('acme_removed', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts') || '|' || pg_temp.seen('public.contacts') || '|' || pg_temp.seen('public.opportunities'), '||', 'a former member sees nothing, though the account is still named for them');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts') || '|' || pg_temp.seen('public.contacts') || '|' || pg_temp.seen('public.opportunities'), 'za|zc|zo', 'another firm''s owner sees only their own firm''s');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), 'za', 'with no address, the same');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts') || '|' || pg_temp.seen('public.contacts') || '|' || pg_temp.seen('public.opportunities'), '||', 'a platform admin sees no firm''s records (D-16)');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts') || '|' || pg_temp.seen('public.contacts') || '|' || pg_temp.seen('public.opportunities'), '||', 'a person with no firm sees none');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.seen('public.accounts') || '|' || pg_temp.seen('public.contacts') || '|' || pg_temp.seen('public.opportunities'), 'denied|denied|denied', 'a signed-out caller may not read the tables');

  -- Nevermore support (ADR 0024): a platform admin with an open session reads what an owner reads, at the firm's address, and nothing without one.
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an account the firm asked about') t);
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts') || '|' || pg_temp.seen('public.contacts') || '|' || pg_temp.seen('public.opportunities'),
    'a1,a2,a3,a4,a5|c1,c2,c3,c4|o1,o2,o3,o4', 'a support session at the firm''s address reads every record of the firm, as an owner does');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(pg_temp.id('acme'), 'accounts', pg_temp.id('a1')::text)) > 0, true, 'and its histories');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (source, firm_id, name) VALUES ('added_by_hand', %L, 'By support')$q$, pg_temp.id('acme'))), '42501', 'but writes nothing');
  PERFORM pg_temp.as_user('platform_admin', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), '', 'and reads nothing of another firm');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), '', 'when the session has ended it reads nothing again');

  -- Changing an account's owner changes at once who sees it and what hangs off it.
  RESET ROLE;
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent3') WHERE id = pg_temp.id('a1');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts') || '|' || pg_temp.seen('public.contacts') || '|' || pg_temp.seen('public.opportunities'), '||', 'the old owner sees the account, its contacts and its opportunities no more');
  PERFORM pg_temp.as_user('acme_agent3', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts') || '|' || pg_temp.seen('public.contacts') || '|' || pg_temp.seen('public.opportunities'), 'a1,a4|c1,c2|o1,o2', 'the new owner sees them at once');
  RESET ROLE;
  UPDATE public.accounts SET owner_id = NULL WHERE id = pg_temp.id('a1');
  PERFORM pg_temp.as_user('acme_agent3', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), 'a4', 'with no owner an agent sees it no more');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), 'a1,a2,a3,a4,a5', 'and an owner still does');
  RESET ROLE;
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent1') WHERE id = pg_temp.id('a1');

  -- A firm set to "everyone sees everything".
  UPDATE public.firms SET visibility = 'everyone' WHERE id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts') || '|' || pg_temp.seen('public.contacts') || '|' || pg_temp.seen('public.opportunities'),
    'a1,a2,a3,a4,a5|c1,c2,c3,c4|o1,o2,o3,o4', 'a member of a firm that shows everyone everything sees it all');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.seen('public.accounts'), 'za', 'and the other firm''s agent still sees only their own');
  RESET ROLE;
  UPDATE public.firms SET visibility = 'by_level' WHERE id = pg_temp.id('acme');
  RAISE NOTICE 'crm_records: who sees what passed';
END $$;

-- ---------- nobody writes through the API ----------
-- Break caught: an API role is given a write (the write functions are later stories' and check the level rule, the closing firm and support).
DO $$
DECLARE who text; t text; r text; a1 uuid := pg_temp.id('a1');
BEGIN
  FOREACH who IN ARRAY ARRAY['acme_owner', 'acme_agent1', 'platform_admin', 'zenith_owner', 'anon', 'service'] LOOP
    IF who = 'anon' THEN PERFORM pg_temp.as_anon(); ELSIF who = 'service' THEN PERFORM pg_temp.as_service(); ELSE PERFORM pg_temp.as_user(who, 'acme-brokers'); END IF;
    FOREACH t IN ARRAY ARRAY['accounts', 'contacts', 'opportunities'] LOOP
      r := pg_temp.attempt(format($q$INSERT INTO public.%I (firm_id) VALUES (%L)$q$, t, pg_temp.id('acme')));
      PERFORM pg_temp.is(r, '42501', who || ' inserting into ' || t);
      PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.%I SET firm_id = firm_id$q$, t)), '42501', who || ' updating ' || t);
      PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM public.%I$q$, t)), '42501', who || ' deleting from ' || t);
      PERFORM pg_temp.is(pg_temp.attempt(format($q$TRUNCATE public.%I$q$, t)), '42501', who || ' emptying ' || t);
    END LOOP;
  END LOOP;
  -- The service role reads (server code), as it reads every firm's table.
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts) > 0, true, 'the service role reads the accounts');
  RESET ROLE;
  RAISE NOTICE 'crm_records: closed to writes passed';
END $$;

-- ---------- history and version ----------
-- What the history holds of one record, read as the table's owner, oldest first.
CREATE FUNCTION pg_temp.held(tbl text, rid uuid) RETURNS SETOF public.record_history LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.record_history WHERE table_name = tbl AND record_key = rid::text ORDER BY at, id
$$;
CREATE FUNCTION pg_temp.fields_of(tbl text, rid uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(string_agg(COALESCE(h.field, h.kind), ',' ORDER BY (h.kind = 'changed'), h.field), '') FROM public.record_history h WHERE h.table_name = tbl AND h.record_key = rid::text
$$;

-- Break caught: a record's creation or a change of its own field is not kept, or a stamp, a derived value or a link the product sets is.
DO $$
DECLARE h1 uuid; hc uuid; ho uuid; r public.record_history; cnt bigint;
BEGIN
  PERFORM pg_temp.claims_of('acme_owner');
  h1 := pg_temp.account('h1', 'acme', 'acme_agent1', 'History Co', 'history.example');
  hc := pg_temp.contact('hc', 'h1', 'acme_agent1', 'hc@example.test');
  ho := pg_temp.opportunity('ho', 'h1', 'acme_agent1');
  PERFORM pg_temp.is(pg_temp.fields_of('accounts', h1), 'created', 'creating an account is one entry');
  PERFORM pg_temp.is(pg_temp.fields_of('contacts', hc), 'created', 'a contact');
  PERFORM pg_temp.is(pg_temp.fields_of('opportunities', ho), 'created', 'an opportunity');
  SELECT * INTO r FROM pg_temp.held('accounts', h1);
  PERFORM pg_temp.is(r.actor_id, pg_temp.id('acme_owner'), 'by the person who made it');
  PERFORM pg_temp.is((SELECT version FROM public.accounts WHERE id = h1), 1, 'a new record is at version 1');

  PERFORM pg_temp.claims_of('acme_agent1');
  UPDATE public.accounts SET name = 'History Company', phone = '503-555-0100', employees = 12, states_of_operation = ARRAY['OR'] WHERE id = h1;
  PERFORM pg_temp.is(pg_temp.fields_of('accounts', h1), 'created,employees,name,phone,states_of_operation', 'each changed field is an entry');
  PERFORM pg_temp.is((SELECT version FROM public.accounts WHERE id = h1), 2, 'and the save raises the version once');
  PERFORM pg_temp.is((SELECT old_value::text || '>' || new_value::text FROM pg_temp.held('accounts', h1) WHERE field = 'name'), '"History Co">"History Company"', 'from and to');
  PERFORM pg_temp.is((SELECT new_value::text FROM pg_temp.held('accounts', h1) WHERE field = 'states_of_operation'), '["OR"]', 'a list of states reads back as a list');
  PERFORM pg_temp.is((SELECT count(DISTINCT change_id) FROM pg_temp.held('accounts', h1) WHERE kind = 'changed'), 1::bigint, 'one save is one change');
  PERFORM pg_temp.is((SELECT string_agg(DISTINCT version::text, ',') FROM pg_temp.held('accounts', h1) WHERE kind = 'changed'), '2', 'and says which version it made');

  -- not the stamps, not the derived domain, not the link the product sets
  cnt := (SELECT count(*) FROM pg_temp.held('accounts', h1));
  UPDATE public.accounts SET created_at = created_at - interval '1 day' WHERE id = h1;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held('accounts', h1)), cnt, 'a change of a stamp writes nothing');
  PERFORM pg_temp.is((SELECT version FROM public.accounts WHERE id = h1), 2, 'and raises nothing');
  UPDATE public.accounts SET website = 'history.example' WHERE id = h1;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held('accounts', h1)), cnt, 'saving the same website writes nothing');
  UPDATE public.accounts SET website = 'https://www.history2.example/' WHERE id = h1;
  PERFORM pg_temp.is((SELECT field FROM pg_temp.held('accounts', h1) ORDER BY id DESC LIMIT 1), 'website', 'a new website is the entry; the domain it gives is not another');
  PERFORM pg_temp.is((SELECT web_domain FROM public.accounts WHERE id = h1), 'history2.example', 'though it follows');
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent3'), archived_at = now() WHERE id = h1;
  PERFORM pg_temp.is((SELECT string_agg(field, ',' ORDER BY field) FROM pg_temp.held('accounts', h1) WHERE version = 4), 'archived_at,owner_id', 'a change of owner and archiving are changes of the record');
  -- the source is the product's and never edited
  UPDATE public.accounts SET source = 'import' WHERE id = h1;
  PERFORM pg_temp.is((SELECT source FROM public.accounts WHERE id = h1), 'added_by_hand', 'an account''s source is never changed');
  PERFORM pg_temp.is((SELECT version FROM public.accounts WHERE id = h1), 4, 'and trying changes nothing');
  -- an account the product made from an intake keeps the source it was made with
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.accounts (firm_id, name, source) VALUES (%L, 'From intake', 'employer_intake')$q$, pg_temp.id('acme'))), 'rows:1', 'a source is set when the account is made');

  UPDATE public.accounts SET version = 1 WHERE id = h1;
  PERFORM pg_temp.is((SELECT version FROM public.accounts WHERE id = h1), 4, 'nobody sets the version: what a save wrote into it is put back');

  UPDATE public.contacts SET email = 'new@example.test', title = 'Manager', do_not_email = true, is_main = true WHERE id = hc;
  PERFORM pg_temp.is(pg_temp.fields_of('contacts', hc), 'created,do_not_email,email,is_main,title', 'a contact''s own fields');
  UPDATE public.contacts SET prospect_user_id = pg_temp.id('nobody') WHERE id = hc;
  PERFORM pg_temp.is(pg_temp.fields_of('contacts', hc), 'created,do_not_email,email,is_main,title', 'but not the link to its prospect');
  PERFORM pg_temp.is((SELECT version FROM public.contacts WHERE id = hc), 2, 'a contact is at version 2 after one save');
  UPDATE public.opportunities SET next_step = 'Call back', value = 7100, target_start = date '2027-03-01', employees = 45 WHERE id = ho;
  PERFORM pg_temp.is(pg_temp.fields_of('opportunities', ho), 'created,employees,next_step,target_start,value', 'an opportunity''s own fields');
  PERFORM pg_temp.is((SELECT version FROM public.opportunities WHERE id = ho), 2, 'at version 2');
  PERFORM pg_temp.is((SELECT replace(encode(t.tgargs, 'escape'), '\000', ',') FROM pg_trigger t WHERE t.tgrelid = 'public.opportunities'::regclass AND t.tgname = 'opportunities_history'),
    'opportunities,id,account_id,owner_id,name,target_start,employees,main_contact_id,expected_close,value,source,next_step,', 'the list is written in the trigger''s arguments');
  RESET ROLE;
  RAISE NOTICE 'crm_records: history and version passed';
END $$;

-- Break caught: the updated stamp (moved by every save, in a transaction of its own here so it really moves) is tracked, so a save of nothing writes
-- a history entry and raises the version.
DO $$
DECLARE h1 uuid := pg_temp.id('h1'); cnt bigint; ver integer; stamp timestamptz;
BEGIN
  PERFORM pg_temp.claims_of('acme_agent1');
  cnt := (SELECT count(*) FROM pg_temp.held('accounts', h1));
  ver := (SELECT version FROM public.accounts WHERE id = h1);
  stamp := (SELECT updated_at FROM public.accounts WHERE id = h1);
  UPDATE public.accounts SET phone = phone WHERE id = h1;
  PERFORM pg_temp.is((SELECT updated_at > stamp FROM public.accounts WHERE id = h1), true, 'a save moves the updated stamp');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held('accounts', h1)), cnt, 'and writes nothing to the history');
  PERFORM pg_temp.is((SELECT version FROM public.accounts WHERE id = h1), ver, 'and raises nothing');
  RESET ROLE;
  RAISE NOTICE 'crm_records: stamps passed';
END $$;

-- Break caught: a record's history outlives the record; a contact's history is left behind by its account's deletion; the history of an
-- intake link is written as a field.
DO $$
DECLARE d uuid; dc uuid; dc2 uuid; do_ uuid; di uuid;
BEGIN
  PERFORM pg_temp.claims_of('acme_owner');
  d := pg_temp.account('d1', 'acme', 'acme_agent1');
  dc := pg_temp.contact('dc', 'd1', 'acme_agent1', 'dc@example.test');
  dc2 := pg_temp.contact('dc2', 'd1', 'acme_agent1', 'dc2@example.test');
  do_ := pg_temp.opportunity('do', 'd1', 'acme_agent1', NULL, 'dc');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held('contacts', dc)), 1::bigint, 'the contact has a history');
  DELETE FROM public.contacts WHERE id = dc2;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held('contacts', dc2)), 0::bigint, 'deleting a contact deletes its history');
  DELETE FROM public.contacts WHERE id = dc;
  PERFORM pg_temp.is((SELECT main_contact_id FROM public.opportunities WHERE id = do_), NULL::uuid, 'deleting a main contact leaves the opportunity without one');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE id = do_), 1::bigint, 'and the opportunity');
  PERFORM pg_temp.contact('dc3', 'd1', 'acme_agent1', 'dc3@example.test');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$DELETE FROM public.accounts WHERE id = %L$q$, d)), '23503', 'an account with an opportunity is kept until the opportunity is deleted');
  DELETE FROM public.opportunities WHERE id = do_;
  PERFORM pg_temp.is((SELECT count(*) FROM pg_temp.held('opportunities', do_)), 0::bigint, 'an opportunity''s history goes with it');
  DELETE FROM public.accounts WHERE id = d;
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = d), 0::bigint, 'deleting an account deletes its contacts (D-204)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.record_key IN (d::text, pg_temp.id('dc3')::text)), 0::bigint, 'and the history of both');

  -- possible duplicate marks go when the earlier account does; an intake's deletion leaves its opportunity
  PERFORM pg_temp.account('e1', 'acme', NULL);
  INSERT INTO public.accounts (source, firm_id, name, possible_duplicate_of) VALUES ('added_by_hand', pg_temp.id('acme'), 'Later', pg_temp.id('e1')) RETURNING id INTO d;
  DELETE FROM public.accounts WHERE id = pg_temp.id('e1');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = d), NULL::uuid, 'deleting the earlier account clears the mark and keeps the later');
  di := pg_temp.intake('di', 'acme');
  PERFORM pg_temp.account('e2', 'acme', NULL);
  PERFORM pg_temp.opportunity('eo', 'e2', NULL, 'di');
  DELETE FROM public.chamber_sessions WHERE id = di;
  PERFORM pg_temp.is((SELECT intake_id FROM public.opportunities WHERE id = pg_temp.id('eo')), NULL::uuid, 'an intake deleted leaves its opportunity, now with none');
  PERFORM pg_temp.is((SELECT string_agg(field, ',') FROM pg_temp.held('opportunities', pg_temp.id('eo')) WHERE kind = 'changed'), NULL::text, 'and the link is not a field of its history');
  RESET ROLE;
  RAISE NOTICE 'crm_records: deleting passed';
END $$;

-- ---------- reading a history ----------
-- Break caught: a history is read by someone who may not see its record; a contact's or an opportunity's is read by its own owner rather than by
-- whoever may see its account; another firm's or a missing record answers differently from one the caller may not see.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); a1 uuid := pg_temp.id('a1'); c1 uuid := pg_temp.id('c1'); o1 uuid := pg_temp.id('o1'); n bigint;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'accounts', a1::text)) > 0, true, 'the owner of the account reads its history');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'contacts', c1::text)) > 0, true, 'and its contact''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'opportunities', o1::text)) > 0, true, 'and its opportunity''s');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'accounts', %L)$q$, acme, a1::text)), 'PT404', 'another agent may not read an account''s history');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'contacts', %L)$q$, acme, c1::text)), 'PT404', 'nor its contact''s, though they own that contact');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'opportunities', %L)$q$, acme, o1::text)), 'PT404', 'nor its opportunity''s');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'accounts', %L)$q$, acme, gen_random_uuid()::text)), 'PT404', 'the same words for a record that does not exist');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'accounts', a1::text)) > 0, true, 'an owner reads every account''s');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'accounts', %L)$q$, acme, pg_temp.id('za')::text)), 'PT404', 'but not another firm''s, asked for under their own');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'accounts', %L)$q$, acme, a1::text)), 'PT404', 'another firm''s owner is refused the same');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'accounts', %L)$q$, pg_temp.id('zenith'), a1::text)), 'PT404', 'and asking under their own firm finds nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'accounts', %L)$q$, acme, a1::text)), 'PT404', 'a platform admin is refused');
  PERFORM pg_temp.as_user('acme_removed', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'accounts', %L)$q$, acme, a1::text)), 'PT404', 'and a former member');
  RESET ROLE;
  -- Changing the owner changes who reads the history, at once.
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent2') WHERE id = a1;
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'contacts', c1::text)) > 0, true, 'the new owner of the account reads its contact''s history');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'accounts', %L)$q$, acme, a1::text)), 'PT404', 'and the old owner no more');
  RESET ROLE;
  UPDATE public.accounts SET owner_id = pg_temp.id('acme_agent1') WHERE id = a1;
  RAISE NOTICE 'crm_records: reading a history passed';
END $$;

-- A submission moved the way set_submission_status moves it: the pipeline row changes and a history row says from where to where.
CREATE FUNCTION pg_temp.move(intake text, to_status text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE from_status text;
BEGIN
  SELECT w.status INTO from_status FROM public.submission_workflow w WHERE w.session_id = pg_temp.id(intake);
  UPDATE public.submission_workflow SET status = to_status WHERE session_id = pg_temp.id(intake);
  INSERT INTO public.submission_status_history (session_id, from_status, to_status) VALUES (pg_temp.id(intake), from_status, to_status);
END $$;

-- ---------- an opportunity's stage, worked out ----------
-- Break caught: a stage is stored instead of worked out; a pipeline stage maps to the wrong stage (D-206); an opportunity with no intake is not
-- Qualifying; a stage nobody mapped is let through as nothing; the functions are open to the API roles.
DO $$
DECLARE s text; want text; got text; i uuid; o uuid;
BEGIN
  PERFORM pg_temp.account('s1', 'acme', NULL);
  FOREACH s IN ARRAY ARRAY['draft', 'submitted', 'under_review', 'information_requested', 'ready_for_market', 'sent_to_carrier', 'quoted', 'won', 'lost', 'archived'] LOOP
    want := CASE s
      WHEN 'draft' THEN 'intake_under_way' WHEN 'submitted' THEN 'intake_under_way' WHEN 'under_review' THEN 'intake_under_way'
      WHEN 'information_requested' THEN 'intake_under_way' WHEN 'ready_for_market' THEN 'ready_to_send' WHEN 'sent_to_carrier' THEN 'in_market'
      WHEN 'quoted' THEN 'quoted' WHEN 'won' THEN 'won' WHEN 'lost' THEN 'lost' WHEN 'archived' THEN 'lost' END;
    i := pg_temp.intake('st_' || s, 'acme');
    o := pg_temp.opportunity('so_' || s, 's1', NULL, 'st_' || s);
    UPDATE public.submission_workflow SET status = s WHERE session_id = i;
    PERFORM pg_temp.is((SELECT w.status FROM public.submission_workflow w WHERE w.session_id = i), s, 'the fixture is at ' || s);
    PERFORM pg_temp.is(public.opportunity_stage_of(s), want, s || ' as a pipeline stage');
    PERFORM pg_temp.is(public.opportunity_stage(o), want, 'an opportunity whose submission is ' || s);
  END LOOP;
  -- every stage the pipeline has is mapped (a stage added later fails here until it is)
  FOR s IN SELECT unnest(public.queue_field_choices('pipeline_status')) LOOP
    PERFORM pg_temp.is(public.opportunity_stage_of(s) IS NOT NULL, true, 'the pipeline stage ' || s || ' has a stage');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.opportunity_stage_of('on_hold')$q$), '22023', 'a stage nobody mapped is refused, not answered with nothing');
  PERFORM pg_temp.is(public.opportunity_stage_of(NULL), 'qualifying', 'no intake is Qualifying');
  PERFORM pg_temp.opportunity('so_none', 's1', NULL);
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('so_none')), 'qualifying', 'an opportunity with no intake is Qualifying');
  PERFORM pg_temp.is(public.opportunity_stage(gen_random_uuid()), NULL::text, 'an opportunity that is not there has no stage');
  -- reopening an archived submission brings its opportunity back (it is worked out each time)
  UPDATE public.submission_workflow SET status = 'submitted' WHERE session_id = pg_temp.id('st_archived');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('so_archived')), 'intake_under_way', 'reopened, the opportunity is back');
  -- D-216: a submission archived straight from won keeps its opportunity Won; archived from any other stage is Lost.
  PERFORM pg_temp.account('s2', 'acme', NULL);
  PERFORM pg_temp.intake('w1', 'acme'); PERFORM pg_temp.opportunity('wo1', 's2', NULL, 'w1');
  PERFORM pg_temp.move('w1', 'submitted'); PERFORM pg_temp.move('w1', 'won');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('wo1')), 'won', 'won');
  PERFORM pg_temp.move('w1', 'archived');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('wo1')), 'won', 'a submission archived from won keeps its opportunity Won (D-216)');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s2')), 'client', 'and its account a client');
  PERFORM pg_temp.move('w1', 'submitted');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('wo1')), 'intake_under_way', 'reopened, it is under way again');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s2')), 'prospect', 'and its account a prospect until it is won again');
  PERFORM pg_temp.move('w1', 'quoted'); PERFORM pg_temp.move('w1', 'archived');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('wo1')), 'lost', 'archived from quoted, after an earlier archive from won, is Lost: the last move into archived decides');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s2')), 'prospect', 'and does not make a client');
  PERFORM pg_temp.intake('w2', 'acme'); PERFORM pg_temp.opportunity('wo2', 's2', NULL, 'w2');
  PERFORM pg_temp.move('w2', 'submitted'); PERFORM pg_temp.move('w2', 'lost'); PERFORM pg_temp.move('w2', 'archived');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('wo2')), 'lost', 'archived from lost is Lost');
  PERFORM pg_temp.intake('w3', 'acme'); PERFORM pg_temp.opportunity('wo3', 's2', NULL, 'w3');
  PERFORM pg_temp.move('w3', 'submitted'); PERFORM pg_temp.move('w3', 'under_review'); PERFORM pg_temp.move('w3', 'archived');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('wo3')), 'lost', 'archived from under review is Lost');
  PERFORM pg_temp.is(public.opportunity_stage_of('archived'), 'lost', 'and the pure mapping of the stage alone is still D-206''s');
  -- never stored
  PERFORM pg_temp.is((SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name IN ('accounts', 'opportunities', 'contacts') AND c.column_name IN ('stage', 'status')), 0::bigint, 'no table stores a stage or a status');
  -- the API roles do not run them
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.opportunity_stage(%L)$q$, pg_temp.id('so_won'))), '42501', 'a member may not call the stage by id');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_status(%L)$q$, pg_temp.id('s1'))), '42501', 'nor the status');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT public.opportunity_stage_of('won')$q$), '42501', 'nor the mapping');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_status(%L)$q$, pg_temp.id('s1'))), '42501', 'a signed-out caller neither');
  RESET ROLE;
  RAISE NOTICE 'crm_records: stage passed';
END $$;

-- ---------- an account's status, worked out ----------
-- Break caught: a won submission does not make a client; a submission in any other stage does; another account's win counts; status is stored.
DO $$
DECLARE s text; i uuid;
BEGIN
  PERFORM pg_temp.account('t1', 'acme', NULL);
  PERFORM pg_temp.account('t2', 'acme', NULL);
  PERFORM pg_temp.is(public.account_status(pg_temp.id('t1')), 'prospect', 'an account with nothing on it is a prospect account');
  PERFORM pg_temp.opportunity('to_none', 't1', NULL);
  PERFORM pg_temp.is(public.account_status(pg_temp.id('t1')), 'prospect', 'with an opportunity and no intake');
  FOREACH s IN ARRAY ARRAY['draft', 'submitted', 'under_review', 'information_requested', 'ready_for_market', 'sent_to_carrier', 'quoted', 'lost', 'archived', 'won'] LOOP
    i := pg_temp.intake('ts_' || s, 'acme');
    PERFORM pg_temp.opportunity('tos_' || s, 't1', NULL, 'ts_' || s);
    UPDATE public.submission_workflow SET status = s WHERE session_id = i;
    PERFORM pg_temp.is(public.account_status(pg_temp.id('t1')), CASE WHEN s = 'won' THEN 'client' ELSE 'prospect' END,
      'an account whose newest submission is ' || s || ' (the ones before it all but won)');
    IF s <> 'won' THEN
      -- put it out of the way, so each stage is judged alone
      UPDATE public.opportunities SET intake_id = NULL WHERE id = pg_temp.id('tos_' || s);
    END IF;
  END LOOP;
  PERFORM pg_temp.is(public.account_status(pg_temp.id('t2')), 'prospect', 'another account''s win is not this one''s');
  PERFORM pg_temp.move('ts_won', 'archived');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('t1')), 'client', 'a won submission filed away is still a client (D-216; a former client is Epic 4''s)');
  PERFORM pg_temp.move('ts_won', 'submitted');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('t1')), 'prospect', 'reopened, it no longer is');
  PERFORM pg_temp.move('ts_won', 'won');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('t1')), 'client', 'won again is a client again');
  PERFORM pg_temp.is(public.account_status(gen_random_uuid()), NULL::text, 'an account that is not there has no status');
  RAISE NOTICE 'crm_records: status passed';
END $$;

-- ---------- a firm's records are found by firm ----------
-- Break caught: closing a firm (DELETE ... WHERE firm_id) and every firm-scoped read scan every firm's rows of a table with no index that leads with the firm.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts', 'contacts', 'opportunities'] LOOP
    PERFORM pg_temp.is(EXISTS (
      SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
      WHERE i.indrelid = ('public.' || t)::regclass AND a.attname = 'firm_id' AND i.indpred IS NULL AND i.indexprs IS NULL), true, t || ' has an index that leads with the firm');
  END LOOP;
  RAISE NOTICE 'crm_records: indexes passed';
END $$;

-- ---------- moving a contact with its opportunity ----------
-- Break caught: the main-contact link can't be deferred, so a merge (CRM-S4.3b) has to clear and restore every main contact to move contacts and their
-- opportunities to another account; or deferring it lets an inconsistent move be committed.
DO $$
DECLARE c uuid; o uuid; from_a uuid; to_a uuid;
BEGIN
  from_a := pg_temp.account('m1', 'acme', NULL); to_a := pg_temp.account('m2', 'acme', NULL);
  c := pg_temp.contact('mc', 'm1', NULL, 'mc@example.test');
  o := pg_temp.opportunity('mo', 'm1', NULL, NULL, 'mc');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.contacts SET account_id = %L WHERE id = %L$q$, to_a, c)), '23503', 'a contact can''t be moved away from an opportunity that names it its main contact (immediately)');
  SET CONSTRAINTS public.opportunities_main_contact_fkey DEFERRED;
  UPDATE public.contacts SET account_id = to_a WHERE id = c;
  UPDATE public.opportunities SET account_id = to_a WHERE id = o;
  SET CONSTRAINTS public.opportunities_main_contact_fkey IMMEDIATE;
  PERFORM pg_temp.is((SELECT main_contact_id FROM public.opportunities WHERE id = o), c, 'a deferred move of both keeps the main contact');
  SET CONSTRAINTS public.opportunities_main_contact_fkey DEFERRED;
  UPDATE public.contacts SET account_id = from_a WHERE id = c;
  PERFORM pg_temp.is(pg_temp.refusal('SET CONSTRAINTS public.opportunities_main_contact_fkey IMMEDIATE') LIKE '23503:%', true, 'but moving one without the other is refused when the check comes');
  UPDATE public.contacts SET account_id = to_a WHERE id = c;
  SET CONSTRAINTS public.opportunities_main_contact_fkey IMMEDIATE;
  RAISE NOTICE 'crm_records: moving a contact passed';
END $$;

-- ---------- a key that is not a record's ----------
-- Break caught: a history key is compared as text (no index, a scan of every contact) or cast and raises for a key that is not an id.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); a1 uuid := pg_temp.id('a1');
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, %L, 'not-an-id')$q$, acme, 'contacts')), 'PT404', 'a key that is not an id is a record that is not there, not an error');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'accounts', %L)$q$, acme, upper(a1::text))), 'PT404', 'and so is an id in capitals, which no history holds');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'opportunities', '')$q$, acme)), 'PT404', 'and an empty one');
  RESET ROLE;
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'accounts', a1::text), true, 'an account that is there exists');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'accounts', 'not-an-id'), false, 'a key that is not an id is no record');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'contacts', pg_temp.id('c1')::text), true, 'a contact');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'opportunities', pg_temp.id('o1')::text), true, 'an opportunity');
  -- Found by the primary key's index: the id is compared as an id (a text comparison reads every contact of the firm: 18 s to delete one account with
  -- 2,000 contacts among 200,000). Row counts say nothing reliable about a plan, so this asks what the two functions' source compares, as
  -- close_a_firm.sql asks whether a write still asks its guard.
  PERFORM pg_temp.is((SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('record_history_can_see', 'record_history_record_exists')
    AND (p.prosrc ~ 'id::text' OR p.prosrc !~ 'record_history_key_uuid')), 0::bigint, 'the history functions compare a record''s id as an id');
  RAISE NOTICE 'crm_records: keys passed';
END $$;

-- ---------- closing a firm ----------
-- Break caught: the closing neither deletes nor lists the three tables, or deletes them in an order the links refuse.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT string_agg(p.src || ':' || p.action || ':' || p.firm_column, ',' ORDER BY p.ord) FROM public.firm_closing_plan() p WHERE p.src IN ('public.opportunities', 'public.contacts', 'public.accounts')),
    'public.opportunities:delete:firm_id,public.contacts:delete:firm_id,public.accounts:delete:firm_id', 'the closing deletes opportunities, then contacts, then accounts');
  PERFORM pg_temp.is((SELECT max(p.ord) FROM public.firm_closing_plan() p WHERE p.src = 'public.record_history') < (SELECT min(p.ord) FROM public.firm_closing_plan() p WHERE p.src = 'public.opportunities'), true, 'after the history, as the partners are');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() p WHERE p.src = 'public.referral_partners' AND p.action = 'delete'), 1::bigint, 'and the lines it had are all still there');
  RAISE NOTICE 'crm_records: closing passed';
END $$;

SELECT 'crm_records: all passed';
