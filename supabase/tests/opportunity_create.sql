-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh opportunity_create
-- New opportunity on an account (story CRM-A2.3, screen 25; docs/BROKER_CRM_BUILD.md D-29, D-188, D-209, D-214, D-222, D-409, D-436 to D-442;
-- 20261120130000_opportunity_create.sql). The function that makes one, opportunity_create, and the read its form needs, opportunity_create_context. Two firms
-- are used throughout. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261119130000_accounts_table_query.sql
\i supabase/migrations/20261119140000_account_page.sql
\i supabase/migrations/20261119145000_account_tab.sql
\i supabase/migrations/20261119150000_create_account.sql
\i supabase/migrations/20261119160000_account_archive_delete_owner.sql
\i supabase/migrations/20261119170000_add_contact.sql
\i supabase/migrations/20261119180000_calls_notes_tasks.sql
\i supabase/migrations/20261119210000_bulk_changes.sql
\i supabase/migrations/20261119230000_search_everywhere.sql
\i supabase/migrations/20261119240000_contact_page.sql
\i supabase/migrations/20261120090000_opportunity_stage.sql
\i supabase/migrations/20261120110000_placements_renewals.sql
\i supabase/migrations/20261120111000_accounts_status_one_read.sql
\i supabase/migrations/20261120120000_opportunity_page.sql
\i supabase/migrations/20261120130000_opportunity_create.sql
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
CREATE FUNCTION pg_temp.account(n text, firm text, p_owner text, nm text DEFAULT NULL, site text DEFAULT NULL, src text DEFAULT 'added_by_hand') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.accounts (source, firm_id, owner_id, name, website) VALUES (src, pg_temp.id(firm), pg_temp.id(p_owner), COALESCE(nm, n), site) RETURNING id INTO r;
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


-- ---------- set up: two firms; Acme sees by level, Zenith shows everyone everything; people at each level ----------
-- Acme: an owner; a lead of Sales with an agent in it and a team under it (Sales West, with an agent); a second lead with no team; two agents with no team; and
-- a person whose membership ended. Zenith: an owner and an agent.
DO $$
DECLARE acme uuid; zenith uuid; sales uuid; west uuid; zsales uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at, visibility) VALUES ('Zenith Benefits', 'zenith-benefits', now(), 'everyone') RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_lead'); PERFORM pg_temp.new_user('acme_lead2'); PERFORM pg_temp.new_user('acme_agent1');
  PERFORM pg_temp.new_user('acme_agent2'); PERFORM pg_temp.new_user('acme_agent3'); PERFORM pg_temp.new_user('acme_west'); PERFORM pg_temp.new_user('acme_removed');
  PERFORM pg_temp.new_user('zenith_owner'); PERFORM pg_temp.new_user('zenith_lead'); PERFORM pg_temp.new_user('zenith_agent'); PERFORM pg_temp.new_user('zenith_agent2');
  PERFORM pg_temp.new_user('acme_gone'); PERFORM pg_temp.new_user('zenith_gone');
  PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_teams (firm_id, name) VALUES (acme, 'Sales') RETURNING id INTO sales;
  INSERT INTO public.firm_teams (firm_id, name, parent_team_id) VALUES (acme, 'Sales West', sales) RETURNING id INTO west;
  INSERT INTO public.firm_teams (firm_id, name) VALUES (zenith, 'Zenith Sales') RETURNING id INTO zsales;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner', NULL), (acme, pg_temp.id('acme_lead'), 'lead', sales), (acme, pg_temp.id('acme_lead2'), 'lead', NULL),
    (acme, pg_temp.id('acme_agent1'), 'agent', NULL), (acme, pg_temp.id('acme_agent2'), 'agent', sales), (acme, pg_temp.id('acme_agent3'), 'agent', NULL),
    (acme, pg_temp.id('acme_west'), 'agent', west),
    (zenith, pg_temp.id('zenith_owner'), 'owner', NULL), (zenith, pg_temp.id('zenith_lead'), 'lead', zsales), (zenith, pg_temp.id('zenith_agent'), 'agent', NULL),
    (zenith, pg_temp.id('zenith_agent2'), 'agent', NULL);
  -- People whose membership ended: one with no team, and one in each lead's own team (a departed teammate is no one's to change but an owner's).
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id, valid_from, valid_until) VALUES
    (acme, pg_temp.id('acme_removed'), 'agent', NULL, now() - interval '3 days', now() - interval '1 day'),
    (acme, pg_temp.id('acme_gone'), 'agent', sales, now() - interval '3 days', now() - interval '1 day'),
    (zenith, pg_temp.id('zenith_gone'), 'agent', zsales, now() - interval '3 days', now() - interval '1 day');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
END $$;




-- ---------- helpers ----------
-- Calls a function as a person at an address and answers its text, or the SQLSTATE and message it raised.
CREATE FUNCTION pg_temp.as_call(who text, addr text, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; s text; m text;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  BEGIN
    EXECUTE stmt INTO r;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    r := s || ': ' || m;
  END;
  RESET ROLE;
  RETURN r;
END $$;

-- The code of a refusal (its SQLSTATE), or 'ok'.
CREATE FUNCTION pg_temp.code(r text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN r ~ '^[0-9A-Z]{5}: ' THEN left(r, 5) ELSE 'ok' END $$;

-- A submission moved the way set_submission_status moves it: the pipeline row changes and a history row says from where to where.
CREATE FUNCTION pg_temp.move(intake text, to_status text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE from_status text;
BEGIN
  SELECT w.status INTO from_status FROM public.submission_workflow w WHERE w.session_id = pg_temp.id(intake);
  UPDATE public.submission_workflow SET status = to_status WHERE session_id = pg_temp.id(intake);
  INSERT INTO public.submission_status_history (session_id, from_status, to_status) VALUES (pg_temp.id(intake), from_status, to_status);
END $$;



-- ---------- helpers for this story ----------
-- The address a person asks at, and the firm they act for.
CREATE FUNCTION pg_temp.addr(who text) RETURNS text LANGUAGE sql AS $$ SELECT CASE WHEN who LIKE 'zenith%' THEN 'zenith-benefits' ELSE 'acme-brokers' END $$;
CREATE FUNCTION pg_temp.firm_of(who text) RETURNS uuid LANGUAGE sql AS $$ SELECT pg_temp.id(CASE WHEN who LIKE 'zenith%' THEN 'zenith' ELSE 'acme' END) $$;


-- opportunity_create as a person, on an account (by name), with what is given (jsonb keys: name, target_start, employees, main, expected_close, value, source,
-- partner, next_step, owner); the answer's jsonb as text, or the SQLSTATE and message.
CREATE FUNCTION pg_temp.create_opp(who text, acct text, p jsonb DEFAULT '{}') RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_temp.as_call(who, pg_temp.addr(who), format(
    'SELECT public.opportunity_create(%L::uuid, %L::text, %L::date, %L::integer, %L::uuid, %L::date, %L::numeric, %L::text, %L::text, %L::text, %L::uuid, %L::uuid)::text',
    pg_temp.id(acct),
    CASE WHEN p ? 'name' THEN p ->> 'name' ELSE 'January 2028 PEO search' END,
    p ->> 'target_start', p ->> 'employees', pg_temp.id(p ->> 'main'), p ->> 'expected_close', p ->> 'value', p ->> 'source', p ->> 'partner', p ->> 'next_step',
    pg_temp.id(p ->> 'owner'), pg_temp.firm_of(who)));
END $$;

CREATE FUNCTION pg_temp.context(who text, acct text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.opportunity_create_context(%L, %L)::text', pg_temp.firm_of(who), pg_temp.id(acct)))
$$;

-- ---------- the records ----------
-- Acme (by level): a1 is agent1's (Harborview Dental Group, 45 employees, main contact c1), a2 is agent2's (in Sales), a3 has no owner, a_arch is agent1's and
-- archived. Zenith (everyone sees everything): z1 is zenith_agent's. Each firm has a referral partner of its own.
DO $$
BEGIN
  PERFORM pg_temp.account('a1', 'acme', 'acme_agent1', 'Harborview Dental Group');
  PERFORM pg_temp.account('a2', 'acme', 'acme_agent2');
  PERFORM pg_temp.account('a3', 'acme', NULL);
  PERFORM pg_temp.account('z1', 'zenith', 'zenith_agent', 'Zenith client');
  PERFORM pg_temp.account('a_arch', 'acme', 'acme_agent1', 'Archived Co');
  UPDATE public.accounts SET employees = 45 WHERE id = pg_temp.id('a1');
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('a_arch');
  PERFORM pg_temp.contact('c1', 'a1', 'acme_agent1', 'one@example.test', NULL, true);
  PERFORM pg_temp.contact('c1b', 'a1', 'acme_agent1', 'onebee@example.test');
  PERFORM pg_temp.contact('c2', 'a2', 'acme_agent2', 'two@example.test', NULL, true);
  PERFORM pg_temp.contact('cz', 'z1', 'zenith_agent', 'zed@example.test', NULL, true);
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES
    (pg_temp.id('acme'), 'acme-cfo', 'Acme''s CFO friend', 'accounting'), (pg_temp.id('zenith'), 'zenith-cfo', 'Zenith''s CFO friend', 'accounting');
END $$;

-- ---------- making one: what is made (D-438, D-442, D-409, D-440) ----------
-- Break caught: the opportunity is not made on the account asked for, in the caller's firm; is made with an intake or in a stage other than Qualifying; keeps a
-- field untrimmed or loses one; the maker is not its owner; the answer lacks its id, version or stage (the form opens the new page from it); a second open
-- opportunity on the account is refused (D-440); its history does not say who made it.
DO $$
DECLARE r jsonb; o public.opportunities;
BEGIN
  r := pg_temp.create_opp('acme_agent1', 'a1', jsonb_build_object('name', '  January 2028 PEO search ', 'target_start', '2028-01-01', 'employees', 45, 'main', 'c1',
    'expected_close', '2027-12-10', 'value', 7100, 'source', 'Referral', 'partner', 'acme-cfo', 'next_step', ' Ask Elena whether headcount changed. '))::jsonb;
  SELECT * INTO o FROM public.opportunities WHERE id = (r -> 'record' ->> 'id')::uuid;
  PERFORM pg_temp.is(o.firm_id, pg_temp.id('acme'), 'in the caller''s firm');
  PERFORM pg_temp.is(o.account_id, pg_temp.id('a1'), 'on the account');
  PERFORM pg_temp.is(o.name, 'January 2028 PEO search', 'its name, trimmed');
  PERFORM pg_temp.is(o.target_start, '2028-01-01'::date, 'target start');
  PERFORM pg_temp.is(o.employees, 45, 'employees');
  PERFORM pg_temp.is(o.main_contact_id, pg_temp.id('c1'), 'main contact');
  PERFORM pg_temp.is(o.expected_close, '2027-12-10'::date, 'expected close');
  PERFORM pg_temp.is(o.value, 7100::numeric, 'value');
  PERFORM pg_temp.is(o.source, 'Referral', 'source');
  PERFORM pg_temp.is(o.referral_partner_code, 'acme-cfo', 'and the referral partner it came from');
  PERFORM pg_temp.is(o.next_step, 'Ask Elena whether headcount changed.', 'next step, trimmed');
  PERFORM pg_temp.is(o.owner_id, pg_temp.id('acme_agent1'), 'the maker owns it');
  PERFORM pg_temp.is(o.intake_id, NULL::uuid, 'with no intake (D-442)');
  PERFORM pg_temp.is(public.opportunity_stage(o.id), 'qualifying', 'in the stage Qualifying (D-409)');
  PERFORM pg_temp.is(o.version, 1, 'at version 1');
  PERFORM pg_temp.is(r -> 'record' ->> 'stage', 'qualifying', 'the answer says its stage');
  PERFORM pg_temp.is((r -> 'record' ->> 'version')::int, 1, 'and its version');
  PERFORM pg_temp.is(r -> 'record' ->> 'account_id', pg_temp.id('a1')::text, 'and its account');
  PERFORM pg_temp.is(r -> 'record' ->> 'referral_partner_code', 'acme-cfo', 'and its partner');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'opportunities' AND h.record_key = o.id::text AND h.kind = 'created'
    AND h.actor_id = pg_temp.id('acme_agent1')), 1::bigint, 'its history says who made it');
  -- D-440: an account holds any number of opportunities, several open at once, and nothing says so
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_agent1', 'a1', '{"name":"A second one"}')), 'ok', 'a second opportunity on the same account is made');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_agent1', 'a1', '{"name":"A second one"}')), 'ok', 'even with the same name');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE account_id = pg_temp.id('a1')), 3::bigint, 'so the account holds three');
  -- only the name is needed
  r := pg_temp.create_opp('acme_agent1', 'a1', '{"name":"Bare"}')::jsonb;
  SELECT * INTO o FROM public.opportunities WHERE id = (r -> 'record' ->> 'id')::uuid;
  PERFORM pg_temp.is((o.target_start, o.employees, o.main_contact_id, o.expected_close, o.value, o.source, o.referral_partner_code, o.next_step) IS NOT DISTINCT FROM
    (NULL::date, NULL::integer, NULL::uuid, NULL::date, NULL::numeric, NULL::text, NULL::text, NULL::text), true, 'every other field may be left empty');
END $$;

-- ---------- who may make one (D-437, D-209) ----------
-- Break caught: making one needs the level rule on the account (it is open to anyone who may see it, as adding a contact is); is open to someone who may not see
-- the account, another firm's member, a former member, a platform admin, a person of no firm or a signed-out caller; or tells "not there", "another firm's" and
-- "not theirs" apart (one answer, PT404).
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_agent1', 'a1')), 'ok', 'the account''s owner makes one');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_owner', 'a1')), 'ok', 'an owner of the firm makes one on any account');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_owner', 'a3')), 'ok', 'even on an account with no owner');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_lead', 'a2')), 'ok', 'a lead makes one on their team''s account');
  -- adding is open to anyone who may see the account, not only whoever may change it (D-209): agent1 sees and makes one on their own account for themselves
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('zenith_agent2', 'z1')), 'ok', 'where everyone sees everything, anyone makes one, though they may not change the account');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE account_id = pg_temp.id('z1') ORDER BY created_at DESC LIMIT 1), pg_temp.id('zenith_agent2'), 'and it is theirs');
  r := pg_temp.create_opp('acme_agent2', 'a1');
  PERFORM pg_temp.is(r, 'PT404: That account isn''t available', 'an agent may not make one on a colleague''s account');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.opportunity_create(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text', gen_random_uuid(), pg_temp.id('acme'))),
    r, 'an account that is not there is the same answer');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.opportunity_create(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text', pg_temp.id('z1'), pg_temp.id('acme'))),
    r, 'another firm''s account, asked at one''s own firm');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.opportunity_create(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text', pg_temp.id('z1'), pg_temp.id('zenith')))), '42501', 'a stranger naming another firm is refused as no member');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_owner', 'zenith-benefits', format('SELECT public.opportunity_create(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text', pg_temp.id('a1'), pg_temp.id('zenith')))), 'PT404', 'an Acme account asked by a Zenith owner at Zenith');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_removed', 'a1')), '42501', 'a former member');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('platform_admin', NULL, format('SELECT public.opportunity_create(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text', pg_temp.id('a1'), pg_temp.id('acme')))), '42501', 'a platform admin is no member');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('nobody', NULL, format('SELECT public.opportunity_create(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text', pg_temp.id('a1'), pg_temp.id('acme')))), '42501', 'a person of no firm');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.opportunity_create(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)', pg_temp.id('a1'), pg_temp.id('acme'))), 5), '42501', 'a signed-out caller may not call it');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.opportunity_create_context(%L, %L)', pg_temp.id('acme'), pg_temp.id('a1'))), 5), '42501', 'nor its form''s read');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- an archived account, a closing firm, Nevermore support (D-437, D-222, ADR 0023, ADR 0024) ----------
-- Break caught: an opportunity is made on an archived account (even by an owner of the firm), or in a closing firm, or in a support session; or the guard comes
-- after the rule that hides the account, so the refusal tells a stranger whether the account is there.
DO $$
DECLARE sess uuid; n bigint;
BEGIN
  n := (SELECT count(*) FROM public.opportunities);
  PERFORM pg_temp.is(pg_temp.create_opp('acme_owner', 'a_arch'), '55000: This account is archived. Nothing can be added to it.', 'an archived account takes no opportunity, even from an owner of the firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities), n, 'and nothing was made');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.create_opp('acme_owner', 'a1'), 6), 'PT423:', 'a closing firm makes none');
  PERFORM pg_temp.is(left(pg_temp.create_opp('acme_agent2', 'a1'), 6), 'PT423:', 'and the guard comes before the rule that hides the account');
  PERFORM pg_temp.is(left(pg_temp.create_opp('acme_owner', 'a_arch'), 6), 'PT423:', 'and before the archived account''s');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an account the firm asked about') t);
  PERFORM pg_temp.is(pg_temp.as_call('platform_admin', 'acme-brokers', format('SELECT public.opportunity_create(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text', pg_temp.id('a1'), pg_temp.id('acme'))) ~ '^PT423:', true, 'Nevermore support makes none');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities), n, 'and nothing was made');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
END $$;

-- ---------- the fields (D-438) ----------
-- Break caught: a field the story limits is taken beyond its limit (the name's 200, the next step's 2,000, a negative value or count, a trillion), a name of
-- spaces is taken, or a refusal does not say what is wrong in words; nothing is made on a refusal.
DO $$
DECLARE n bigint := (SELECT count(*) FROM public.opportunities);
BEGIN
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"name":"   "}'), '22023: Give the opportunity a name.', 'a name of spaces is no name');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', jsonb_build_object('name', repeat('x', 201))), '22023: Keep the opportunity''s name to 200 characters.', 'a name over 200');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_agent1', 'a1', jsonb_build_object('name', repeat('x', 200)))), 'ok', 'a name of 200');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', jsonb_build_object('next_step', repeat('x', 2001))), '22023: Keep the next step to 2,000 characters.', 'a next step over 2,000');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_agent1', 'a1', jsonb_build_object('next_step', repeat('x', 2000)))), 'ok', 'a next step of 2,000');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"value":-1}'), '22023: The value can''t be a negative number.', 'a negative value');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"employees":-1}'), '22023: Employees can''t be a negative number.', 'a negative count');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"value":999999999999.995}'), '22023: Keep the value under a trillion.', 'a value that rounds up to a trillion');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_agent1', 'a1', '{"value":0,"employees":0}')), 'ok', 'zero is not negative');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities), n + 3, 'only the three that were fine were made');
END $$;

-- ---------- the source and the referral partner (D-439) ----------
-- Break caught: any word is taken as a source; a word is taken in another case; a referral partner of another firm, or one that is not there, or one named for a
-- source that is not Referral, is kept; "Referral" cannot name a partner; the partner is not kept on the opportunity.
DO $$
DECLARE s text; r jsonb;
BEGIN
  FOREACH s IN ARRAY ARRAY['Referral', 'Renewal', 'Existing client', 'Inbound', 'Outbound', 'Event', 'Other'] LOOP
    r := pg_temp.create_opp('acme_agent1', 'a1', jsonb_build_object('source', s))::jsonb;
    PERFORM pg_temp.is(r -> 'record' ->> 'source', s, 'the source ' || s || ' is kept');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"source":"Cold call"}'), '22023: Choose a source from the list.', 'a word not on the list');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"source":"referral"}'), '22023: Choose a source from the list.', 'the list''s words are exact');
  PERFORM pg_temp.is((pg_temp.create_opp('acme_agent1', 'a1', '{"source":"  "}')::jsonb) -> 'record' -> 'source', 'null'::jsonb, 'a blank source is no source');
  PERFORM pg_temp.is((pg_temp.create_opp('acme_agent1', 'a1', '{"source":" Inbound "}')::jsonb) -> 'record' ->> 'source', 'Inbound', 'a source is trimmed');
  PERFORM pg_temp.is((pg_temp.create_opp('acme_agent1', 'a1', '{"source":"Referral"}')::jsonb) -> 'record' -> 'referral_partner_code', 'null'::jsonb, 'a referral may name no partner');
  r := pg_temp.create_opp('acme_agent1', 'a1', '{"source":"Referral","partner":"acme-cfo"}')::jsonb;
  PERFORM pg_temp.is((SELECT referral_partner_code FROM public.opportunities WHERE id = (r -> 'record' ->> 'id')::uuid), 'acme-cfo', 'a referral names the firm''s own partner');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"source":"Referral","partner":"zenith-cfo"}'), '22023: Choose one of the firm''s referral partners.', 'not another firm''s partner');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"source":"Referral","partner":"nobody"}'), '22023: Choose one of the firm''s referral partners.', 'nor one that is not there');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"source":"Inbound","partner":"acme-cfo"}'), '22023: A referral partner goes only with the source Referral.', 'a partner goes with Referral alone');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"partner":"acme-cfo"}'), '22023: A referral partner goes only with the source Referral.', 'and with no source, none');
  -- the partner's removal (a firm's own delete of a partner) leaves the opportunity, with none
  INSERT INTO public.referral_partners (firm_id, code, name, kind) VALUES (pg_temp.id('acme'), 'temp-cfo', 'Temporary', 'other');
  r := pg_temp.create_opp('acme_agent1', 'a1', '{"source":"Referral","partner":"temp-cfo"}')::jsonb;
  DELETE FROM public.referral_partners WHERE firm_id = pg_temp.id('acme') AND code = 'temp-cfo';
  PERFORM pg_temp.is((SELECT referral_partner_code FROM public.opportunities WHERE id = (r -> 'record' ->> 'id')::uuid), NULL::text, 'a removed partner leaves the opportunity with none');
  -- the partner is tracked: the history of the making, and a later change of it, are the opportunity's own
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'opportunities' AND h.record_key = (r -> 'record' ->> 'id') AND h.field = 'referral_partner_code' AND h.kind = 'changed'),
    1::bigint, 'and its history says the partner went');
END $$;

-- ---------- the main contact (D-438) ----------
-- Break caught: a contact of another account (or another firm) is taken as the main contact; one of the account is refused.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_agent1', 'a1', '{"main":"c1b"}')), 'ok', 'a contact of the account, though not its main contact');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_owner', 'a1', '{"main":"c2"}'), '22023: Choose a contact of this account.', 'a contact of another account of the firm');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_owner', 'a1', '{"main":"cz"}'), '22023: Choose a contact of this account.', 'a contact of another firm');
END $$;

-- ---------- the owner (D-438, D-214, D-209) ----------
-- Break caught: the maker is not the owner by default; an agent hands one to someone else, a lead to someone outside their teams; an owner of the firm cannot
-- hand one to anyone; a person who has left, another firm's member, or someone who could not then open the account, is made the owner.
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.account('a_west', 'acme', 'acme_west', 'West account');
  r := pg_temp.create_opp('acme_owner', 'a1');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = (r::jsonb -> 'record' ->> 'id')::uuid), pg_temp.id('acme_owner'), 'the maker is the owner when no one else is chosen');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_agent1', 'a1', '{"owner":"acme_agent1"}')), 'ok', 'an agent may name themselves');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_agent1', 'a1', '{"owner":"acme_agent3"}'), '42501: You can make an opportunity only for yourself and, as a lead, for people on your teams.', 'an agent may not hand it to someone else');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_lead', 'a2', '{"owner":"acme_agent2"}')), 'ok', 'a lead hands it to someone on their team');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_lead', 'a_west', '{"owner":"acme_west"}')), 'ok', 'and to someone on a team under theirs, on an account of that team');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_lead', 'a2', '{"owner":"acme_west"}'), '22023: Choose someone who can see this account.', 'though not to one who could not open the account');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_lead', 'a2', '{"owner":"acme_lead"}')), 'ok', 'and to themselves');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_lead2', 'a1', '{"owner":"acme_agent1"}')), 'PT404', 'a lead of no team does not see an agent''s account at all');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_lead', 'a2', '{"owner":"acme_agent1"}')), '42501', 'a lead may not hand it to someone outside their teams');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('acme_owner', 'a1', '{"owner":"acme_agent1"}')), 'ok', 'an owner of the firm hands it to anyone who sees the account');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_owner', 'a1', '{"owner":"acme_removed"}'), '22023: Choose one of the firm''s people as the owner.', 'a person who has left');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_owner', 'a1', '{"owner":"zenith_agent"}'), '22023: Choose one of the firm''s people as the owner.', 'another firm''s member');
  PERFORM pg_temp.is(pg_temp.create_opp('acme_owner', 'a1', '{"owner":"nobody"}'), '22023: Choose one of the firm''s people as the owner.', 'a person of no firm');
  -- someone who could not then open the account: agent3 does not see agent1's account (visibility follows the account, D-422)
  PERFORM pg_temp.is(pg_temp.create_opp('acme_owner', 'a1', '{"owner":"acme_agent3"}'), '22023: Choose someone who can see this account.', 'someone who could not open the account');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.create_opp('zenith_owner', 'z1', '{"owner":"zenith_agent2"}')), 'ok', 'where everyone sees everything, anyone may own it');
END $$;

-- ---------- what the form is told (D-436, D-438) ----------
-- Break caught: the context omits the account's name, employees or archived state, or does not offer the main contact first; offers the people the call would
-- refuse (an agent is offered only themselves; a person who has left, another firm's member and someone who could not open the account are never offered), or
-- another firm's referral partners; is answered to someone who may not see the account; or tells "not there" and "not theirs" apart.
DO $$
DECLARE j jsonb;
BEGIN
  j := pg_temp.context('acme_agent1', 'a1')::jsonb;
  PERFORM pg_temp.is(j -> 'account', jsonb_build_object('id', pg_temp.id('a1'), 'name', 'Harborview Dental Group', 'archived', false, 'employees', 45), 'the account');
  PERFORM pg_temp.is(j -> 'main_contact', jsonb_build_object('id', pg_temp.id('c1'), 'name', 'First c1 Last c1'), 'its main contact');
  PERFORM pg_temp.is(j -> 'contacts', jsonb_build_array(
    jsonb_build_object('id', pg_temp.id('c1'), 'name', 'First c1 Last c1', 'title', NULL, 'is_main', true),
    jsonb_build_object('id', pg_temp.id('c1b'), 'name', 'First c1b Last c1b', 'title', NULL, 'is_main', false)), 'its contacts, the main one first');
  PERFORM pg_temp.is(j -> 'partners', jsonb_build_array(jsonb_build_object('code', 'acme-cfo', 'name', 'Acme''s CFO friend')), 'the firm''s own referral partners, no other firm''s');
  PERFORM pg_temp.is((SELECT jsonb_agg(o ->> 'id') FROM jsonb_array_elements(j -> 'owners') o), jsonb_build_array(pg_temp.id('acme_agent1')::text), 'an agent is offered only themselves');
  j := pg_temp.context('acme_owner', 'a1')::jsonb;
  PERFORM pg_temp.is((SELECT array_agg(o ->> 'id' ORDER BY o ->> 'id') FROM jsonb_array_elements(j -> 'owners') o),
    (SELECT array_agg(x::text ORDER BY x::text) FROM unnest(ARRAY[pg_temp.id('acme_agent1'), pg_temp.id('acme_owner')]) x), 'an owner of the firm is offered those who see the account (its owner and owners; not agent3 or agent2, who could not open it, not a former member)');
  j := pg_temp.context('acme_lead', 'a2')::jsonb;
  PERFORM pg_temp.is((SELECT array_agg(o ->> 'id' ORDER BY o ->> 'id') FROM jsonb_array_elements(j -> 'owners') o),
    (SELECT array_agg(x::text ORDER BY x::text) FROM unnest(ARRAY[pg_temp.id('acme_lead'), pg_temp.id('acme_agent2')]) x), 'a lead is offered themselves and their teams, those of them who see the account (not west, under Sales, who cannot see agent2''s)');
  PERFORM pg_temp.is((pg_temp.context('acme_agent1', 'a_arch')::jsonb) -> 'account' ->> 'archived', 'true', 'an archived account is answered, saying so');
  PERFORM pg_temp.is(pg_temp.context('acme_agent2', 'a1'), 'PT404: That account isn''t available', 'an account the caller may not see');
  PERFORM pg_temp.is(pg_temp.context('zenith_agent', 'a1'), 'PT404: That account isn''t available', 'another firm''s account');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.context('acme_removed', 'a1')), '42501', 'a former member');
  PERFORM pg_temp.is((pg_temp.context('zenith_agent2', 'z1')::jsonb) -> 'partners', jsonb_build_array(jsonb_build_object('code', 'zenith-cfo', 'name', 'Zenith''s CFO friend')), 'each firm sees its own partners');
END $$;

-- ---------- two sessions at once: an archive, and a removal of the new owner ----------
-- Break caught: (1) the making reads the account without a lock, so an archive that commits between its read and its write lets an opportunity land on an
-- archived account (D-222); and (2) a new owner who is removed while the making waits for their membership is still taken, as the transaction's start (what
-- membership_is_current reads) is before the removal. Shown with two sessions: the first holds the archive (or the removal) uncommitted; the second's making
-- waits on it; the first commits; the making is refused (55000, 22023) and nothing is made.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
-- The fixtures, committed first (a DO block is one transaction), so the two other sessions below can see them.
DO $$
BEGIN
  PERFORM pg_temp.new_user('rm_victim');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES (pg_temp.id('acme'), pg_temp.id('rm_victim'), 'agent', NULL);
  PERFORM pg_temp.account('rm_a', 'acme', 'rm_victim');
  PERFORM pg_temp.account('rm_b', 'acme', 'rm_victim');
  PERFORM pg_temp.account('lk_b', 'acme', 'acme_agent1');
END $$;
DO $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  fid uuid := pg_temp.id('acme');
  a_pid integer; b_pid integer; tries integer; got text;
  save_stmt text;
  open_as text := format('SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; SET LOCAL request.headers = %L',
    jsonb_build_object('sub', pg_temp.id('acme_owner'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_owner@example.test')::text,
    jsonb_build_object('x-firm-address', 'acme-brokers')::text);
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  SELECT pid INTO a_pid FROM race.dblink('ra', 'SELECT pg_backend_pid()') AS t(pid integer);
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);

  -- 1. An archive commits while the making waits: the making then sees the account archived and refuses (55000).
  save_stmt := format($q$SELECT public.opportunity_create(%L, 'Too late', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('lk_b'), fid);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  PERFORM race.dblink_exec('ra', format('UPDATE public.accounts SET archived_at = now() WHERE id = %L', pg_temp.id('lk_b')));
  PERFORM race.dblink_exec('rb', 'BEGIN');
  PERFORM race.dblink_exec('rb', open_as);
  PERFORM race.dblink_send_query('rb', save_stmt);
  tries := 0;
  WHILE tries < 100 AND NOT (a_pid = ANY (pg_blocking_pids(b_pid))) LOOP
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM pg_temp.is(a_pid = ANY (pg_blocking_pids(b_pid)), true, 'the making waits behind an archive');
  PERFORM race.dblink_exec('ra', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
    got := 'ok';
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE;
  END;
  PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
  PERFORM race.dblink_exec('rb', 'ROLLBACK');
  PERFORM pg_temp.is(got, '55000', 'and refuses once the archive has committed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE account_id = pg_temp.id('lk_b')), 0::bigint, 'leaving nothing on the archived account');

  -- 2. The making holds the account; an archive that starts after waits for it (so a making that got in first is whole, and the archive follows).
  save_stmt := format($q$SELECT public.opportunity_create(%L, 'In time', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('rm_a'), fid);
  PERFORM race.dblink_exec('rb', 'BEGIN');
  PERFORM race.dblink_exec('rb', open_as);
  PERFORM race.dblink_exec('rb', 'DO $do$ BEGIN ' || replace(replace(save_stmt, 'SELECT ', 'PERFORM '), '::text', '') || '; END $do$');
  PERFORM race.dblink_send_query('ra', format('UPDATE public.accounts SET archived_at = now() WHERE id = %L', pg_temp.id('rm_a')));
  tries := 0;
  WHILE tries < 100 AND NOT (b_pid = ANY (pg_blocking_pids(a_pid))) LOOP
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM pg_temp.is(b_pid = ANY (pg_blocking_pids(a_pid)), true, 'an archive waits behind a making in progress');
  PERFORM race.dblink_exec('rb', 'COMMIT');
  PERFORM * FROM race.dblink_get_result('ra') AS t(r text);
  PERFORM * FROM race.dblink_get_result('ra') AS t(r text);
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE account_id = pg_temp.id('rm_a') AND name = 'In time'), 1::bigint, 'and the making is whole');

  -- 3. A new owner removed while the making waits for their membership: the making is refused (22023) once the removal commits.
  save_stmt := format($q$SELECT public.opportunity_create(%L, 'Handed on', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L, %L)::text$q$, pg_temp.id('rm_b'), pg_temp.id('rm_victim'), fid);
  -- B begins first, so its now() is before the removal's.
  PERFORM race.dblink_exec('rb', 'BEGIN');
  PERFORM race.dblink_exec('rb', open_as);
  PERFORM pg_sleep(0.1);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  PERFORM race.dblink_exec('ra', format('UPDATE public.firm_memberships SET valid_until = now() WHERE firm_id = %L AND user_id = %L', fid, pg_temp.id('rm_victim')));
  PERFORM race.dblink_send_query('rb', save_stmt);
  tries := 0;
  WHILE tries < 100 AND NOT (a_pid = ANY (pg_blocking_pids(b_pid))) LOOP
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM pg_temp.is(a_pid = ANY (pg_blocking_pids(b_pid)), true, 'the making waits on the membership the removal holds');
  PERFORM pg_sleep(0.1);
  PERFORM race.dblink_exec('ra', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
    got := 'ok';
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM * FROM race.dblink_get_result('rb') AS t(r text);
  PERFORM race.dblink_exec('rb', 'ROLLBACK');
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  PERFORM pg_temp.is(got, '22023: Choose one of the firm''s people as the owner.', 'the making is refused once the removal has committed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE name = 'Handed on'), 0::bigint, 'and nothing was made');
  RAISE NOTICE 'opportunity_create: races passed';
END $$;
