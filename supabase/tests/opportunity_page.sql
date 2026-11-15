-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh opportunity_page
-- The opportunity's page in the database (story CRM-O1.1a; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-46, D-200, D-201, D-209, D-212, D-222, D-407,
-- D-421 to D-432; 20261120120000_opportunity_page.sql). One read of the opportunity with its stage, account, owner, main contact, quotes, intake and
-- contacts; the save of its own fields with the version and the level rule; a call, a note or a task logged on it, and its activity read. Two firms are used
-- throughout. Every migration is loaded, in filename order (D-105), this story's last.
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


-- ---------- helpers ----------
-- The address a person asks at, and the firm they act for.
CREATE FUNCTION pg_temp.addr(who text) RETURNS text LANGUAGE sql AS $$ SELECT CASE WHEN who LIKE 'zenith%' THEN 'zenith-benefits' ELSE 'acme-brokers' END $$;
CREATE FUNCTION pg_temp.firm_of(who text) RETURNS uuid LANGUAGE sql AS $$ SELECT pg_temp.id(CASE WHEN who LIKE 'zenith%' THEN 'zenith' ELSE 'acme' END) $$;

-- The page of an opportunity as a person reads it: its jsonb as text, or the SQLSTATE and message.
CREATE FUNCTION pg_temp.page(who text, opp text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.opportunity_page(%L, %L)::text', pg_temp.firm_of(who), pg_temp.id(opp)))
$$;

-- ---------- the records ----------
-- Acme (by level): a1 is agent1's, a2 is agent2's (in Sales), a3 has no owner. Zenith (everyone sees everything): z1 is zenith_agent's.
DO $$
BEGIN
  PERFORM pg_temp.account('a1', 'acme', 'acme_agent1', 'Harborview Dental Group');
  PERFORM pg_temp.account('a2', 'acme', 'acme_agent2');
  PERFORM pg_temp.account('a3', 'acme', NULL);
  PERFORM pg_temp.account('z1', 'zenith', 'zenith_agent', 'Zenith client');
  PERFORM pg_temp.contact('c1', 'a1', 'acme_agent1', 'one@example.test', NULL, true);
  PERFORM pg_temp.contact('c1b', 'a1', 'acme_agent1', 'onebee@example.test');
  PERFORM pg_temp.contact('c2', 'a2', 'acme_agent2', 'two@example.test', NULL, true);
  PERFORM pg_temp.contact('cz', 'z1', 'zenith_agent', 'zed@example.test', NULL, true);
  -- o1: agent1's, no intake, main contact c1. o2: no owner. o3: agent2's. oz: Zenith's.
  PERFORM pg_temp.opportunity('o1', 'a1', 'acme_agent1', NULL, 'c1');
  PERFORM pg_temp.opportunity('o2', 'a1', NULL);
  PERFORM pg_temp.opportunity('o3', 'a2', 'acme_agent2', NULL, 'c2');
  PERFORM pg_temp.opportunity('oz', 'z1', 'zenith_agent', NULL, 'cz');
  UPDATE public.opportunities SET target_start = '2027-03-01', employees = 40, expected_close = '2027-01-15', value = 12000.50, source = 'Referral', next_step = 'Call back'
  WHERE id = pg_temp.id('o1');
END $$;

-- ---------- the page: what it holds ----------
-- Break caught: the page leaves out a part (stage, account, owner, main contact, can_change), shows the stage as something other than the worked-out one,
-- or answers the details wrongly.
DO $$
DECLARE j jsonb;
BEGIN
  j := pg_temp.page('acme_agent1', 'o1')::jsonb;
  PERFORM pg_temp.is(j -> 'opportunity' ->> 'id', pg_temp.id('o1')::text, 'the opportunity');
  PERFORM pg_temp.is(j -> 'opportunity' ->> 'name', 'PEO search o1', 'its name');
  PERFORM pg_temp.is(j -> 'opportunity' ->> 'stage', 'qualifying', 'its stage is the worked-out one');
  PERFORM pg_temp.is((j -> 'opportunity' ->> 'version')::int, (SELECT version FROM public.opportunities WHERE id = pg_temp.id('o1')), 'with its version');
  PERFORM pg_temp.is(j -> 'opportunity' ->> 'target_start', '2027-03-01', 'target start');
  PERFORM pg_temp.is((j -> 'opportunity' ->> 'employees')::int, 40, 'employees');
  PERFORM pg_temp.is(j -> 'opportunity' ->> 'expected_close', '2027-01-15', 'expected close');
  PERFORM pg_temp.is((j -> 'opportunity' ->> 'value')::numeric, 12000.50, 'value');
  PERFORM pg_temp.is(j -> 'opportunity' ->> 'source', 'Referral', 'source');
  PERFORM pg_temp.is(j -> 'opportunity' ->> 'next_step', 'Call back', 'next step');
  PERFORM pg_temp.is(j -> 'account', jsonb_build_object('id', pg_temp.id('a1'), 'name', 'Harborview Dental Group', 'archived', false), 'its account: id, name, archived');
  PERFORM pg_temp.is(j -> 'owner', jsonb_build_object('id', pg_temp.id('acme_agent1'), 'name', 'acme_agent1@example.test'), 'its owner');
  PERFORM pg_temp.is(j -> 'main_contact' ->> 'id', pg_temp.id('c1')::text, 'its main contact');
  PERFORM pg_temp.is(j ->> 'can_change', 'true', 'its owner may change it');
  PERFORM pg_temp.is(j -> 'intake', 'null'::jsonb, 'no intake yet');
  PERFORM pg_temp.is(j -> 'quotes', '[]'::jsonb, 'and no quotes');
END $$;

-- ---------- who sees it, and who may change it (D-421, D-422, D-432) ----------
-- Break caught: the page is opened to someone who may not see its account (another agent in a level-seeing firm, another firm's member, a former member, a
-- platform admin, a person of no firm, a signed-out caller), or tells them apart (one refusal for not there, another firm's and not theirs, PT404); or
-- `can_change` follows the account's owner and not the opportunity's own, or shows Edit on an archived account.
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.is(pg_temp.code(pg_temp.page('acme_agent1', 'o1')), 'ok', 'the account''s owner reads it');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.page('acme_owner', 'o1')), 'ok', 'an owner of the firm reads it');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.page('acme_lead', 'o3')), 'ok', 'a lead reads their team''s account''s');
  PERFORM pg_temp.is(pg_temp.page('acme_agent2', 'o1'), 'PT404: That opportunity isn''t available', 'an agent does not see a colleague''s account''s opportunity');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.page('acme_agent1', 'o2')), 'ok', 'agent1 sees the account of o2 (agent1''s), though o2 has no owner');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.page('acme_agent1', 'o3')), 'PT404', 'and not agent2''s');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.page('zenith_agent2', 'oz')), 'ok', 'in a firm that shows everyone everything, anyone reads it');
  -- one answer for not there, another firm's, and not theirs
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.opportunity_page(%L, %L)::text', pg_temp.id('acme'), gen_random_uuid()));
  PERFORM pg_temp.is(r, 'PT404: That opportunity isn''t available', 'an opportunity that is not there');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.opportunity_page(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('oz'))),
    r, 'another firm''s, asked at one''s own firm, is the same answer');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.opportunity_page(%L, %L)::text', pg_temp.id('zenith'), pg_temp.id('oz'))),
    r, 'and asked at their firm''s id by a stranger, too');
  PERFORM pg_temp.is(pg_temp.as_call('zenith_owner', 'zenith-benefits', format('SELECT public.opportunity_page(%L, %L)::text', pg_temp.id('zenith'), pg_temp.id('o1'))),
    r, 'an Acme opportunity asked by a Zenith owner at Zenith');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.page('acme_removed', 'o1')), 'PT404', 'a former member');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('platform_admin', NULL, format('SELECT public.opportunity_page(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('o1')))), 'PT404', 'a platform admin is no member');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('nobody', NULL, format('SELECT public.opportunity_page(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('o1')))), 'PT404', 'a person of no firm');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.opportunity_page(NULL, %L)::text', pg_temp.id('o1')))), 'PT404', 'no firm named');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.opportunity_page(%L, %L)', pg_temp.id('acme'), pg_temp.id('o1'))) ~ '^42501', true, 'a signed-out caller may not call it');
  PERFORM pg_temp.as_owner();

  -- can_change: the level rule on the opportunity's own owner (D-422)
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'o1')::jsonb ->> 'can_change', 'true', 'an agent changes their own opportunity');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'o2')::jsonb ->> 'can_change', 'false', 'but not one with no owner, though they see its account');
  PERFORM pg_temp.is(pg_temp.page('acme_owner', 'o2')::jsonb ->> 'can_change', 'true', 'an owner of the firm changes one with no owner');
  PERFORM pg_temp.is(pg_temp.page('acme_lead', 'o3')::jsonb ->> 'can_change', 'true', 'a lead changes their team''s');
  PERFORM pg_temp.is(pg_temp.page('zenith_agent2', 'oz')::jsonb ->> 'can_change', 'false', 'seeing is not changing, even where everyone sees everything');
  -- the account's owner is not the opportunity's: agent1's account holds an opportunity of agent3's, which agent1 sees and may not change
  PERFORM pg_temp.opportunity('o4', 'a1', 'acme_agent3');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'o4')::jsonb ->> 'can_change', 'false', 'the account''s owner does not change what is another person''s opportunity');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.page('acme_agent3', 'o4')), 'PT404', 'and the opportunity''s own owner, who may not see its account, is refused it (D-422)');
END $$;

-- ---------- an archived account (D-432) ----------
-- Break caught: Edit and Add are offered on an archived account, or the page does not say the account is archived.
DO $$
DECLARE j jsonb;
BEGIN
  PERFORM pg_temp.account('a_arch', 'acme', 'acme_agent1', 'Archived Co');
  PERFORM pg_temp.opportunity('o_arch', 'a_arch', 'acme_agent1');
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('a_arch');
  j := pg_temp.page('acme_agent1', 'o_arch')::jsonb;
  PERFORM pg_temp.is(j -> 'account' ->> 'archived', 'true', 'the page says the account is archived');
  PERFORM pg_temp.is(j ->> 'can_change', 'false', 'nothing can be changed on it');
  PERFORM pg_temp.is(j ->> 'can_add', 'false', 'nor added to it');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'o1')::jsonb ->> 'can_add', 'true', 'an account that is not archived takes additions');
END $$;

-- ---------- an intake, certified, with quote requests: what the page reads ----------
-- The real flow: a prospect starts an intake, certifies it (which makes the account, its main contact from the prospect, and the opportunity that holds it),
-- an advisor moves it to Ready for market and records two sends and a quote.
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

CREATE FUNCTION pg_temp.answers(p_company text, p_state text DEFAULT 'TX', p_extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'company_name', p_company, 'hq_state', p_state, 'states', jsonb_build_array(p_state, 'CA'), 'employee_count', 12, 'pay_frequency', 'bi-weekly',
    'industry', 'Dental practice', 'street_address', '500 Harbor Street, Suite 300, Austin, TX 78701', 'website', 'https://www.Harborview.example/about',
    'start_month', 'March 2027', 'in_peo', true, 'current_peo', 'Paychex PEO', 'fein', '123456789',
    'census', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'first_name', 'Zelda', 'last_name', 'Censusperson', 'dob', '1988-03-15'),
                                jsonb_build_object('id', gen_random_uuid(), 'first_name', 'Yan', 'last_name', 'Censusperson', 'dob', '1990-01-02')))
  || p_extra
$$;

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

-- The superuser moves a submission the way an old move was made: the pipeline row changes and a history row says from where to where.
CREATE FUNCTION pg_temp.fmove(intake text, to_status text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE from_status text;
BEGIN
  SELECT w.status INTO from_status FROM public.submission_workflow w WHERE w.session_id = pg_temp.id(intake);
  UPDATE public.submission_workflow SET status = to_status WHERE session_id = pg_temp.id(intake);
  INSERT INTO public.submission_status_history (session_id, from_status, to_status) VALUES (pg_temp.id(intake), from_status, to_status);
END $$;

CREATE FUNCTION pg_temp.qid(n text, peo text) RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id(n) AND peo_name = peo
$$;

DO $$
DECLARE o uuid;
BEGIN
  PERFORM pg_temp.new_prospect('jo', 'Jo Q Doe', '555-0100');
  PERFORM pg_temp.start_intake('i_harbor', 'jo', pg_temp.answers('Harbor Intake Co'), 'acme');
  PERFORM pg_temp.is(pg_temp.certify('i_harbor', 'jo', 'Jo Q Doe'), 'ok', 'the prospect certifies');
  o := (SELECT id FROM public.opportunities WHERE intake_id = pg_temp.id('i_harbor'));
  INSERT INTO fx VALUES ('o_h', o), ('a_h', (SELECT account_id FROM public.opportunities WHERE id = o));
  INSERT INTO fx VALUES ('c_jo', (SELECT c.id FROM public.contacts c WHERE c.account_id = pg_temp.id('a_h') AND c.prospect_user_id = pg_temp.id('jo')));
  PERFORM pg_temp.fmove('i_harbor', 'under_review');
  PERFORM pg_temp.fmove('i_harbor', 'ready_for_market');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.advisor_record_quote_send(pg_temp.id('i_harbor'), 'Justworks', '2026-11-10');
  PERFORM public.advisor_record_quote_send(pg_temp.id('i_harbor'), 'Insperity', '2026-11-12');
  PERFORM public.advisor_update_quote_request(pg_temp.qid('i_harbor', 'Insperity'), 'quoted', '2026-11-14', '2026-12-14', '2027-03-01', 118.50, NULL);
  PERFORM public.advisor_record_quote_send(pg_temp.id('i_harbor'), 'TriNet', '2026-11-13');
  PERFORM public.advisor_update_quote_request(pg_temp.qid('i_harbor', 'TriNet'), 'declined', NULL, NULL, NULL, NULL, NULL);
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- the quotes (D-424) ----------
-- Break caught: a quote request is missing or doubled; a field of a row is wrong (PEO, status, sent, quote received, expires, admin fee per employee per month);
-- a close reason is shown before CRM-O1.3a adds the column; the rows come in no stable order.
DO $$
DECLARE j jsonb;
BEGIN
  j := pg_temp.page('acme_owner', 'o_h')::jsonb;
  PERFORM pg_temp.is(j -> 'opportunity' ->> 'stage', 'quoted', 'the stage follows the intake: a quote recorded while sent moves it to Quoted');
  PERFORM pg_temp.is(jsonb_array_length(j -> 'quotes'), 3, 'one row per quote request');
  PERFORM pg_temp.is((SELECT string_agg(q ->> 'peo_name', ',' ORDER BY ord) FROM jsonb_array_elements(j -> 'quotes') WITH ORDINALITY AS t (q, ord)), 'Insperity,Justworks,TriNet', 'in PEO order');
  PERFORM pg_temp.is(j -> 'quotes' -> 0, jsonb_build_object(
    'id', pg_temp.qid('i_harbor', 'Insperity'), 'peo_name', 'Insperity', 'status', 'quoted', 'sent_on', '2026-11-12', 'quote_received_on', '2026-11-14',
    'quote_expires_on', '2026-12-14', 'admin_fee_pepm', 118.50), 'a quoted row: PEO, status, sent, quote received, expires, admin fee');
  PERFORM pg_temp.is(j -> 'quotes' -> 1, jsonb_build_object(
    'id', pg_temp.qid('i_harbor', 'Justworks'), 'peo_name', 'Justworks', 'status', 'sent', 'sent_on', '2026-11-10', 'quote_received_on', NULL,
    'quote_expires_on', NULL, 'admin_fee_pepm', NULL), 'a sent row has no quote');
  PERFORM pg_temp.is(j -> 'quotes' -> 2 ->> 'status', 'declined', 'a declined row');
END $$;

-- ---------- the intake's summary (D-425) ----------
-- Break caught: the summary names another version than the last certified one, or its signer or day; the census size counts the live answers and not the
-- certified version; File ID, version or the pipeline stage is missing; the open items are counted by a rule of its own and so disagree with the advisor
-- queue, which counts the same intake (the count, and the first label).
DO $$
DECLARE j jsonb; q record; fid text;
BEGIN
  j := pg_temp.page('acme_owner', 'o_h')::jsonb -> 'intake';
  fid := (SELECT file_id FROM public.chamber_sessions WHERE id = pg_temp.id('i_harbor'));
  PERFORM pg_temp.is(fid IS NOT NULL, true, 'the database assigned the intake a File ID');
  PERFORM pg_temp.is(j ->> 'submission_id', pg_temp.id('i_harbor')::text, 'the intake''s submission');
  PERFORM pg_temp.is(j ->> 'file_id', fid, 'its File ID');
  -- D-426: "Intake under way" has something to say only while the draft is live; a certified intake has neither answers-so-far nor someone filling it in
  PERFORM pg_temp.is(j -> 'answered', 'null'::jsonb, 'a certified intake has no answers-so-far');
  PERFORM pg_temp.is(j -> 'prospect_name', 'null'::jsonb, 'and nobody filling it in');
  PERFORM pg_temp.is(j ->> 'pipeline_status', 'quoted', 'its pipeline stage');
  PERFORM pg_temp.is(j ->> 'certified_by', 'Jo Q Doe', 'certified by the prospect');
  PERFORM pg_temp.is((j ->> 'certified_at')::timestamptz, (SELECT c.recorded_at FROM public.chamber_certifications c WHERE c.session_id = pg_temp.id('i_harbor')), 'and when');
  PERFORM pg_temp.is((j ->> 'version')::int, 1, 'version 1');
  PERFORM pg_temp.is((j ->> 'census_size')::int, 2, 'the census rows in the certified version');
  -- a later certification is the one shown, and the census size follows it
  PERFORM pg_temp.new_prospect('kim', 'Kim Lee');
  PERFORM pg_temp.start_intake('i_two', 'kim', pg_temp.answers('Two Certs Co'), 'acme');
  PERFORM pg_temp.is(pg_temp.certify('i_two', 'kim', 'Kim First'), 'ok', 'certified once');
  PERFORM pg_temp.as_user('kim');
  UPDATE public.chamber_sessions SET chamber_data = jsonb_set(chamber_data, '{census}', chamber_data -> 'census' || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'first_name', 'X', 'last_name', 'Y', 'dob', '1980-01-01')))
  WHERE id = pg_temp.id('i_two');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.certify('i_two', 'kim', 'Kim Second'), 'ok', 'and again over changed answers');
  INSERT INTO fx VALUES ('o_two', (SELECT id FROM public.opportunities WHERE intake_id = pg_temp.id('i_two')));
  j := pg_temp.page('acme_owner', 'o_two')::jsonb -> 'intake';
  PERFORM pg_temp.is((j ->> 'version')::int, 2, 'the last certified version');
  PERFORM pg_temp.is(j ->> 'certified_by', 'Kim Second', 'by its signer');
  PERFORM pg_temp.is((j ->> 'census_size')::int, 3, 'with its own census');
  PERFORM pg_temp.is((j ->> 'certified_at')::timestamptz, (SELECT max(c.recorded_at) FROM public.chamber_certifications c WHERE c.session_id = pg_temp.id('i_two')), 'certified at the last one''s moment');
END $$;

-- Break caught: an intake that is not certified is described as if it were (a signer, a version, a File ID or a census size from nowhere); an opportunity
-- with no intake has a summary.
DO $$
DECLARE j jsonb;
BEGIN
  PERFORM pg_temp.new_prospect('dee', 'Dee Draft');
  PERFORM pg_temp.start_intake('i_draft', 'dee', pg_temp.answers('Draft Co'), 'acme');
  PERFORM pg_temp.opportunity('o_draft', 'a1', 'acme_agent1', 'i_draft');
  j := pg_temp.page('acme_agent1', 'o_draft')::jsonb -> 'intake';
  PERFORM pg_temp.is(j ->> 'submission_id', pg_temp.id('i_draft')::text, 'a draft intake is named');
  PERFORM pg_temp.is(j ->> 'pipeline_status', 'draft', 'at Draft');
  PERFORM pg_temp.is(j -> 'certified_by', 'null'::jsonb, 'not certified by anyone');
  PERFORM pg_temp.is(j -> 'certified_at', 'null'::jsonb, 'at no time');
  PERFORM pg_temp.is(j -> 'version', 'null'::jsonb, 'with no version');
  PERFORM pg_temp.is(j -> 'file_id', 'null'::jsonb, 'and no File ID');
  PERFORM pg_temp.is(j -> 'census_size', 'null'::jsonb, 'and no certified census');
  PERFORM pg_temp.is((j -> 'open_items' ->> 'count')::int >= 0, true, 'its open items are counted as the queue counts a draft');
  -- D-426: how many answers the live draft holds (the thirteen the test's answers() gives, each one non-empty, as the queue's own test of an answer counts them)
  -- and the name of the person filling it in: their profile's contact name, never their email or their id (D-33)
  PERFORM pg_temp.is((j ->> 'answered')::int, 13, 'a draft holds its answers, counted');
  PERFORM pg_temp.is(j ->> 'prospect_name', 'Dee Draft', 'and says who is filling it in');
  PERFORM pg_temp.is(j::text !~ 'example\.test', true, 'with no email in the summary');
  PERFORM pg_temp.is(j::text !~ (SELECT user_id::text FROM public.chamber_sessions WHERE id = pg_temp.id('i_draft')), true, 'and no id of the person');
  -- empty answers do not count (null, blank text, an empty list), a stated "no" does
  PERFORM pg_temp.new_prospect('bo', 'Bo Blank');
  PERFORM pg_temp.start_intake('i_blanks', 'bo', jsonb_build_object('company_name', 'Blanks Co', 'industry', '   ', 'states', '[]'::jsonb, 'fein', NULL, 'in_peo', false), 'acme');
  PERFORM pg_temp.opportunity('o_blanks', 'a1', 'acme_agent1', 'i_blanks');
  PERFORM pg_temp.is((pg_temp.page('acme_agent1', 'o_blanks')::jsonb -> 'intake' ->> 'answered')::int, 2, 'an empty answer is not an answer, a stated no is');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'o1')::jsonb -> 'intake', 'null'::jsonb, 'an opportunity with no intake has no summary');
END $$;

-- ---------- the open items agree with the queue (D-425) ----------
-- Break caught: the page counts open items by a rule of its own, so the same intake is "3 open" in the queue and "5 open" on its page; the first label is not the
-- queue's; a verified field, a conflicting one or a missing required answer is counted differently. Each intake below is read both ways, as an advisor.
CREATE FUNCTION pg_temp.queue_open(n text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE q record;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  SELECT * INTO q FROM public.advisor_list_submissions(NULL, NULL, NULL, 0, NULL, NULL, NULL) l WHERE l.session_id = pg_temp.id(n);
  PERFORM pg_temp.as_owner();
  RETURN (cardinality(q.missing_required) + q.open_fields)::text || '|' || COALESCE(q.missing_required[1], '-');
END $$;

CREATE FUNCTION pg_temp.page_open(opp text) RETURNS text LANGUAGE sql AS $$
  SELECT (j -> 'intake' -> 'open_items' ->> 'count') || '|' || COALESCE(j -> 'intake' -> 'open_items' ->> 'first_label', '-')
  FROM (SELECT pg_temp.page('acme_owner', opp)::jsonb AS j) x
$$;

DO $$
DECLARE n text;
BEGIN
  PERFORM pg_temp.new_prospect('sam', 'Sam Sparse');
  PERFORM pg_temp.start_intake('i_sparse', 'sam', jsonb_build_object('company_name', 'Sparse Co'), 'acme');
  PERFORM pg_temp.opportunity('o_sparse', 'a1', 'acme_agent1', 'i_sparse');
  PERFORM pg_temp.new_prospect('cy', 'Cy Conflict');
  PERFORM pg_temp.start_intake('i_conf', 'cy', pg_temp.answers('Conflict Co'), 'acme');
  UPDATE public.chamber_sessions SET field_provenance = jsonb_build_object(
    'company_name', jsonb_build_object('status', 'conflicting'), 'industry', jsonb_build_object('status', 'inferred'), 'pay_frequency', jsonb_build_object('status', 'incomplete'))
  WHERE id = pg_temp.id('i_conf');
  PERFORM pg_temp.opportunity('o_conf', 'a1', 'acme_agent1', 'i_conf');
  -- an advisor verified one of them: settled, so not counted
  INSERT INTO public.advisor_field_reviews (session_id, field, review_state, updated_by) VALUES (pg_temp.id('i_conf'), 'industry', 'verified', pg_temp.id('acme_owner'));
  PERFORM pg_temp.is(split_part(pg_temp.queue_open('i_sparse'), '|', 1)::int > 1, true, 'a sparse draft has several open items (so the test is not empty)');
  PERFORM pg_temp.is(split_part(pg_temp.queue_open('i_conf'), '|', 1)::int >= 2, true, 'a draft with conflicting answers has open items');
  FOREACH n IN ARRAY ARRAY['harbor', 'two', 'draft', 'sparse', 'conf'] LOOP
    PERFORM pg_temp.is(pg_temp.page_open('o_' || CASE n WHEN 'harbor' THEN 'h' ELSE n END), pg_temp.queue_open('i_' || n), 'the page and the queue count ' || n || ' alike');
  END LOOP;
END $$;

-- D-425: the page can always name an open item. Break caught: open items exist but none is a missing required answer, and the page has nothing to name
-- (first_label is the queue's, null here): first_field is the first open item's field key, the required one first, and first_label stays the queue's.
DO $$
DECLARE j jsonb;
BEGIN
  -- only a non-required open item: every required answer given, one other field inferred
  PERFORM pg_temp.new_prospect('ned', 'Ned Nonrequired');
  PERFORM pg_temp.start_intake('i_nonreq', 'ned', pg_temp.answers('Nonrequired Co'), 'acme');
  UPDATE public.chamber_sessions SET field_provenance = jsonb_build_object('industry', jsonb_build_object('status', 'inferred')) WHERE id = pg_temp.id('i_nonreq');
  PERFORM pg_temp.opportunity('o_nonreq', 'a1', 'acme_agent1', 'i_nonreq');
  j := pg_temp.page('acme_owner', 'o_nonreq')::jsonb -> 'intake' -> 'open_items';
  PERFORM pg_temp.is((j ->> 'count')::int, 1, 'one open item, and it is not a required answer');
  PERFORM pg_temp.is(j -> 'first_label', 'null'::jsonb, 'so the queue''s first label is none');
  PERFORM pg_temp.is(j ->> 'first_field', 'industry', 'but the page can name the field');
  PERFORM pg_temp.is(pg_temp.page_open('o_nonreq'), pg_temp.queue_open('i_nonreq'), 'and the count still agrees with the queue');
  -- two non-required items: the first by field key
  UPDATE public.chamber_sessions SET field_provenance = jsonb_build_object('website', jsonb_build_object('status', 'unknown'), 'industry', jsonb_build_object('status', 'inferred'))
  WHERE id = pg_temp.id('i_nonreq');
  PERFORM pg_temp.is(pg_temp.page('acme_owner', 'o_nonreq')::jsonb -> 'intake' -> 'open_items' ->> 'first_field', 'industry', 'the first of several, by field key');
  -- a missing required answer comes first, with its label as the queue has it
  j := pg_temp.page('acme_owner', 'o_sparse')::jsonb -> 'intake' -> 'open_items';
  PERFORM pg_temp.is(j ->> 'first_field', 'states', 'the first required answer missing is the field named');
  PERFORM pg_temp.is(j ->> 'first_label', 'States of operation', 'with its label');
END $$;

-- ---------- contacts on this search (D-429) ----------
-- Break caught: the usual case, where the prospect is the main contact, shows two rows (or only one of the two marks); the prospect's contact is missing when
-- someone else is the main contact; a contact of another account is listed; a row has no name.
DO $$
DECLARE j jsonb;
BEGIN
  -- the prospect is the main contact (D-214): one row, both marks
  j := pg_temp.page('acme_owner', 'o_h')::jsonb;
  PERFORM pg_temp.is(j -> 'main_contact' ->> 'id', pg_temp.id('c_jo')::text, 'the chain made the prospect the main contact');
  PERFORM pg_temp.is(jsonb_array_length(j -> 'contacts'), 1, 'one row, not two');
  PERFORM pg_temp.is(j -> 'contacts' -> 0 ->> 'id', pg_temp.id('c_jo')::text, 'the contact');
  PERFORM pg_temp.is(j -> 'contacts' -> 0 ->> 'name', 'Jo Q Doe', 'with a name');
  PERFORM pg_temp.is(j -> 'contacts' -> 0 -> 'main', 'true'::jsonb, 'marked Main');
  PERFORM pg_temp.is(j -> 'contacts' -> 0 -> 'fills_in_intake', 'true'::jsonb, 'and as the one who fills in the intake');
  -- someone else is the main contact: two rows, the main one first
  PERFORM pg_temp.contact('c_other', 'a_h', 'acme_owner', 'other@example.test');
  UPDATE public.opportunities SET main_contact_id = pg_temp.id('c_other') WHERE id = pg_temp.id('o_h');
  j := pg_temp.page('acme_owner', 'o_h')::jsonb;
  PERFORM pg_temp.is(jsonb_array_length(j -> 'contacts'), 2, 'two rows when the main contact is not the prospect');
  PERFORM pg_temp.is(j -> 'contacts' -> 0 ->> 'id', pg_temp.id('c_other')::text, 'the main contact first');
  PERFORM pg_temp.is(j -> 'contacts' -> 0 -> 'main', 'true'::jsonb, 'marked Main');
  PERFORM pg_temp.is(j -> 'contacts' -> 0 -> 'fills_in_intake', 'false'::jsonb, 'and not as filling in the intake');
  PERFORM pg_temp.is(j -> 'contacts' -> 1 ->> 'id', pg_temp.id('c_jo')::text, 'the prospect second');
  PERFORM pg_temp.is(j -> 'contacts' -> 1 -> 'main', 'false'::jsonb, 'not Main');
  PERFORM pg_temp.is(j -> 'contacts' -> 1 -> 'fills_in_intake', 'true'::jsonb, 'and filling in the intake');
  -- no main contact: the prospect's alone
  UPDATE public.opportunities SET main_contact_id = NULL WHERE id = pg_temp.id('o_h');
  j := pg_temp.page('acme_owner', 'o_h')::jsonb;
  PERFORM pg_temp.is(j -> 'main_contact', 'null'::jsonb, 'no main contact');
  PERFORM pg_temp.is(jsonb_array_length(j -> 'contacts'), 1, 'the prospect alone');
  PERFORM pg_temp.is(j -> 'contacts' -> 0 -> 'main', 'false'::jsonb, 'not Main');
  -- no intake: the main contact alone; none at all: none
  j := pg_temp.page('acme_agent1', 'o1')::jsonb;
  PERFORM pg_temp.is(jsonb_array_length(j -> 'contacts'), 1, 'with no intake, the main contact alone');
  PERFORM pg_temp.is(j -> 'contacts' -> 0 -> 'fills_in_intake', 'false'::jsonb, 'who fills in nothing');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'o2')::jsonb -> 'contacts', '[]'::jsonb, 'no main contact and no intake: no contacts');
  -- another account's contact is never listed: the account's other contacts are not on this search
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(pg_temp.page('acme_agent1', 'o1')::jsonb -> 'contacts') c WHERE c ->> 'id' = pg_temp.id('c1b')::text), 0::bigint,
    'a contact of the account that is not on this search is not listed');
  UPDATE public.opportunities SET main_contact_id = pg_temp.id('c_jo') WHERE id = pg_temp.id('o_h');
END $$;

-- ---------- the save of the opportunity's own fields (D-428, D-46, D-422) ----------
-- save(): every field is sent, as the page sends them; what the test names in p changes, the rest is the opportunity's own, and the version is the current one
-- unless one is given (NULL for none).
CREATE FUNCTION pg_temp.ver(opp text) RETURNS integer LANGUAGE sql AS $$ SELECT version FROM public.opportunities WHERE id = pg_temp.id(opp) $$;
CREATE FUNCTION pg_temp.save(who text, opp text, p jsonb DEFAULT '{}', ver integer DEFAULT -1) RETURNS text LANGUAGE plpgsql AS $$
DECLARE o public.opportunities;
BEGIN
  SELECT * INTO o FROM public.opportunities x WHERE x.id = pg_temp.id(opp);
  RETURN pg_temp.as_call(who, pg_temp.addr(who), format(
    'SELECT public.update_opportunity(%L::uuid, %L::text, %L::date, %L::integer, %L::uuid, %L::date, %L::numeric, %L::text, %L::text, %L::uuid, %L::uuid, %L::integer)::text',
    o.id,
    CASE WHEN p ? 'name' THEN p ->> 'name' ELSE o.name END,
    CASE WHEN p ? 'target_start' THEN p ->> 'target_start' ELSE o.target_start::text END,
    CASE WHEN p ? 'employees' THEN p ->> 'employees' ELSE o.employees::text END,
    CASE WHEN p ? 'main' THEN pg_temp.id(p ->> 'main') ELSE o.main_contact_id END,
    CASE WHEN p ? 'expected_close' THEN p ->> 'expected_close' ELSE o.expected_close::text END,
    CASE WHEN p ? 'value' THEN p ->> 'value' ELSE o.value::text END,
    CASE WHEN p ? 'source' THEN p ->> 'source' ELSE o.source END,
    CASE WHEN p ? 'next_step' THEN p ->> 'next_step' ELSE o.next_step END,
    CASE WHEN p ? 'owner' THEN pg_temp.id(p ->> 'owner') ELSE NULL END,
    pg_temp.firm_of(who),
    CASE WHEN ver = -1 THEN o.version ELSE ver END));
END $$;

-- Break caught: the save changes something it was not sent (the stage, the account, the intake), loses a field, or keeps what was typed untrimmed; a
-- blank is not cleared; the answer has no new version; the history does not hold the change with who made it.
DO $$
DECLARE r text; j jsonb; v integer; before_o public.opportunities; hmax bigint;
BEGIN
  v := pg_temp.ver('o1');
  hmax := (SELECT COALESCE(max(h.id), 0) FROM public.record_history h);
  SELECT * INTO before_o FROM public.opportunities WHERE id = pg_temp.id('o1');
  r := pg_temp.save('acme_agent1', 'o1', jsonb_build_object('name', '  Harborview 2027  ', 'target_start', '2027-04-01', 'employees', 55, 'main', 'c1b',
    'expected_close', '2027-02-20', 'value', 15000, 'source', ' Webinar ', 'next_step', '', 'owner', 'acme_agent1'));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner saves');
  j := r::jsonb;
  PERFORM pg_temp.is(j ->> 'conflict', 'false', 'no conflict');
  PERFORM pg_temp.is((j -> 'record' ->> 'version')::int, v + 1, 'the version rises by one');
  PERFORM pg_temp.is(j -> 'record' ->> 'name', 'Harborview 2027', 'the name, trimmed');
  PERFORM pg_temp.is(j -> 'record' ->> 'target_start', '2027-04-01', 'target start');
  PERFORM pg_temp.is((j -> 'record' ->> 'employees')::int, 55, 'employees');
  PERFORM pg_temp.is(j -> 'record' ->> 'main_contact_id', pg_temp.id('c1b')::text, 'main contact');
  PERFORM pg_temp.is(j -> 'record' ->> 'expected_close', '2027-02-20', 'expected close');
  PERFORM pg_temp.is((j -> 'record' ->> 'value')::numeric, 15000::numeric, 'value');
  PERFORM pg_temp.is(j -> 'record' ->> 'source', 'Webinar', 'source, trimmed');
  PERFORM pg_temp.is(j -> 'record' -> 'next_step', 'null'::jsonb, 'a blank next step is cleared');
  PERFORM pg_temp.is((SELECT row (o.account_id, o.intake_id, o.firm_id, o.created_at)::text FROM public.opportunities o WHERE o.id = pg_temp.id('o1')),
    row (before_o.account_id, before_o.intake_id, before_o.firm_id, before_o.created_at)::text, 'the account and the intake are not the save''s to change');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('o1')), 'qualifying', 'nor the stage');
  -- the history holds each field with the person who changed it, and the version rose once
  PERFORM pg_temp.is((SELECT string_agg(h.field, ',' ORDER BY h.field) FROM public.record_history h
                      WHERE h.id > hmax AND h.table_name = 'opportunities' AND h.record_key = pg_temp.id('o1')::text AND h.kind = 'changed'),
    'employees,expected_close,main_contact_id,name,next_step,source,target_start,value', 'the history has every field changed, and none that was not');
  PERFORM pg_temp.is((SELECT bool_and(h.actor_id = pg_temp.id('acme_agent1')) FROM public.record_history h
                      WHERE h.id > hmax AND h.table_name = 'opportunities' AND h.record_key = pg_temp.id('o1')::text AND h.kind = 'changed'), true, 'each made by the person who saved');
  -- a save that changes nothing still answers the record, with a fresh version, as the account's does
  r := pg_temp.save('acme_agent1', 'o1');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a save of what is already there');
  UPDATE public.opportunities SET main_contact_id = pg_temp.id('c1'), name = 'PEO search o1', target_start = '2027-03-01', employees = 40, expected_close = '2027-01-15',
    value = 12000.50, source = 'Referral', next_step = 'Call back' WHERE id = pg_temp.id('o1');
END $$;

-- ---------- who may save (D-422, D-209, D-222, D-432) ----------
-- Break caught: the level rule is asked of the account's owner and not the opportunity's; an agent saves a colleague's; one who sees but may not change gets
-- the "not there" answer (or a stranger gets the "may not change" one, which tells them it exists); an owner of the firm is refused an ownerless one; a lead
-- is refused their team's; another firm's member saves; an archived account's opportunity is saved; the questions are asked in another order.
DO $$
DECLARE r text; sess uuid;
BEGIN
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_agent1', 'o1', '{"next_step":"a"}')), 'ok', 'an agent saves their own');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_owner', 'o1', '{"next_step":"b"}')), 'ok', 'an owner of the firm saves any');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_lead', 'o3', '{"next_step":"c"}')), 'ok', 'a lead saves their team''s');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_owner', 'o2', '{"next_step":"d"}')), 'ok', 'an owner of the firm saves one with no owner');
  r := pg_temp.save('acme_agent1', 'o2', '{"next_step":"x"}');
  PERFORM pg_temp.is(r, '42501: An opportunity with no owner can only be changed by an owner of the firm.', 'an agent who sees its account may not change one with no owner');
  r := pg_temp.save('acme_agent1', 'o4', '{"next_step":"x"}');
  PERFORM pg_temp.is(r, '42501: Only the opportunity''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'nor another agent''s, though it is on their account (the opportunity''s owner decides, not the account''s)');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('zenith_agent2', 'oz', '{"next_step":"x"}')), '42501', 'where everyone sees everything, seeing is not changing');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('zenith_agent', 'oz', '{"next_step":"x"}')), 'ok', 'the owner saves there');
  PERFORM pg_temp.is(pg_temp.save('acme_agent2', 'o1', '{"next_step":"x"}'), 'PT404: That opportunity isn''t available', 'someone who may not see its account: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_agent1', 'o3', '{"next_step":"x"}')), 'PT404', 'a colleague''s account''s');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.update_opportunity(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L, 1)::text', pg_temp.id('oz'), pg_temp.id('acme'))),
    'PT404: That opportunity isn''t available', 'another firm''s opportunity, at one''s own firm: the same answer');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.update_opportunity(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L, 1)::text', gen_random_uuid(), pg_temp.id('acme'))),
    'PT404: That opportunity isn''t available', 'and one that is not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_owner', 'acme-brokers', format('SELECT public.update_opportunity(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L, 1)::text', pg_temp.id('o1'), pg_temp.id('acme')))),
    '42501', 'another firm''s owner is no member of Acme');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_removed', 'o1', '{"next_step":"x"}')), '42501', 'a former member');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('nobody', NULL, format('SELECT public.update_opportunity(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1)::text', pg_temp.id('o1')))), '42501', 'a person of no firm');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.update_opportunity(%L, ''X'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L, 1)', pg_temp.id('o1'), pg_temp.id('acme'))), 5), '42501', 'a signed-out caller may not call it');
  PERFORM pg_temp.as_owner();
  -- an archived account takes no change (D-432), even from an owner of the firm
  r := pg_temp.save('acme_owner', 'o_arch', '{"next_step":"x"}');
  PERFORM pg_temp.is(r, '55000: This account is archived. Nothing on its opportunities can be changed.', 'an archived account''s opportunity is not saved');
  PERFORM pg_temp.is((SELECT next_step FROM public.opportunities WHERE id = pg_temp.id('o_arch')), NULL::text, 'and nothing was changed');
  -- a closing firm and Nevermore support change nothing (ADR 0023, ADR 0024): the guard is asked before anything else, so even an opportunity the caller
  -- could not see answers PT423
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.save('acme_owner', 'o1', '{"next_step":"x"}'), 6), 'PT423:', 'a closing firm saves nothing');
  PERFORM pg_temp.is(left(pg_temp.save('acme_agent2', 'o1', '{"next_step":"x"}'), 6), 'PT423:', 'and the guard comes before the rule that hides the opportunity');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an opportunity the firm asked about') t);
  PERFORM pg_temp.is(left(pg_temp.save('platform_admin', 'o1', '{"next_step":"x"}'), 6), 'PT423:', 'Nevermore support saves nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
END $$;

-- ---------- what is wrong with what was sent, and the contact and the owner ----------
-- Break caught: a blank name, a negative number, a too-long text or a huge value is saved (or fails as a raw database error instead of words); the main
-- contact is one of another account (or another firm); the new owner is no current member of the firm, or one of another firm; clearing the owner by
-- sending none changes it.
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{"name":"   "}'), '22023: Give the opportunity a name.', 'a blank name');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', jsonb_build_object('name', repeat('n', 201))), '22023: Keep the opportunity''s name to 200 characters.', 'a long name');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{"employees":-1}'), '22023: Employees can''t be a negative number.', 'negative employees');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{"value":-1}'), '22023: The value can''t be a negative number.', 'a negative value');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{"value":1000000000000}'), '22023: Keep the value under a trillion.', 'a value too big for the column');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', jsonb_build_object('source', repeat('s', 101))), '22023: Keep the source to 100 characters.', 'a long source');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', jsonb_build_object('next_step', repeat('n', 2001))), '22023: Keep the next step to 2,000 characters.', 'a long next step');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{"main":"c2"}'), '22023: Choose a contact of this account.', 'a contact of another account of the firm is not a main contact');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{"main":"cz"}'), '22023: Choose a contact of this account.', 'nor is another firm''s');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_agent1', 'o1', '{"main":"c1b"}')), 'ok', 'a contact of this account is');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_agent1', 'o1', jsonb_build_object('main', NULL))), 'ok', 'and none clears it');
  PERFORM pg_temp.is((SELECT main_contact_id FROM public.opportunities WHERE id = pg_temp.id('o1')), NULL::uuid, 'the main contact is cleared');
  UPDATE public.opportunities SET main_contact_id = pg_temp.id('c1') WHERE id = pg_temp.id('o1');
  -- the owner
  PERFORM pg_temp.is(pg_temp.save('acme_owner', 'o1', '{"owner":"acme_removed"}'), '22023: Choose one of the firm''s people as the owner.', 'a former member is not a person to give it to');
  PERFORM pg_temp.is(pg_temp.save('acme_owner', 'o1', '{"owner":"zenith_agent"}'), '22023: Choose one of the firm''s people as the owner.', 'nor is another firm''s');
  PERFORM pg_temp.is(pg_temp.save('acme_owner', 'o1', '{"owner":"nobody"}'), '22023: Choose one of the firm''s people as the owner.', 'nor a stranger');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = pg_temp.id('o1')), pg_temp.id('acme_agent1'), 'and the owner is as it was');
  -- who it may be given to: update_contact's rule (the caller could change a record of that person's), and someone who can see the account, or its owner
  -- could not open it (visibility follows the account, D-422)
  PERFORM pg_temp.is(pg_temp.save('acme_owner', 'o1', '{"owner":"acme_agent3"}'), '22023: Choose someone who can see this account.', 'a current member who could not see its account is refused, even by an owner of the firm');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = pg_temp.id('o1')), pg_temp.id('acme_agent1'), 'and the owner is as it was');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_owner', 'o1', '{"owner":"acme_owner"}')), 'ok', 'an owner of the firm may give it to anyone current who sees the account (here, themselves)');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = pg_temp.id('o1')), pg_temp.id('acme_owner'), 'the owner is changed');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{"next_step":"x"}') ~ '^42501', true, 'whose former owner can then change it no more');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_owner', 'o1', '{"next_step":"kept"}')), 'ok', 'sending no owner leaves it with the one it has');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = pg_temp.id('o1')), pg_temp.id('acme_owner'), 'the owner is never cleared here');
  PERFORM pg_temp.is((SELECT h.new_value #>> '{}' FROM public.record_history h WHERE h.table_name = 'opportunities' AND h.record_key = pg_temp.id('o1')::text
                      AND h.field = 'owner_id' ORDER BY h.id DESC LIMIT 1), pg_temp.id('acme_owner')::text, 'the owner change is in the history');
  PERFORM pg_temp.save('acme_owner', 'o1', '{"owner":"acme_agent1"}');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = pg_temp.id('o1')), pg_temp.id('acme_agent1'), 'given back');
  -- an agent may give it to no one else, though the other can see the account (a visible account is no reason to change someone else's record)
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{"owner":"acme_agent2"}'), '42501: You can give an opportunity only to yourself and, as a lead, to people on your teams.', 'an agent cannot give theirs to another agent');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = pg_temp.id('o1')), pg_temp.id('acme_agent1'), 'and it stays theirs');
  -- a lead: not to someone off their teams; to someone on them only if that person can see the account
  PERFORM pg_temp.is(pg_temp.save('acme_lead', 'o3', '{"owner":"acme_agent1"}'), '42501: You can give an opportunity only to yourself and, as a lead, to people on your teams.', 'a lead cannot give their team''s to a person off their teams');
  PERFORM pg_temp.is(pg_temp.save('acme_lead', 'o3', '{"owner":"acme_west"}'), '22023: Choose someone who can see this account.', 'nor to a team member who could not see its account');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_lead', 'o3', '{"owner":"acme_lead"}')), 'ok', 'but to themselves');
  PERFORM pg_temp.save('acme_owner', 'o3', '{"owner":"acme_agent2"}');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = pg_temp.id('o3')), pg_temp.id('acme_agent2'), 'an owner of the firm gives it back');
  -- where everyone sees everything: a lead gives to a member of their team, not to one off it; an owner to anyone current
  PERFORM pg_temp.new_user('zenith_team1'); PERFORM pg_temp.new_user('zenith_team2');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id)
  SELECT pg_temp.id('zenith'), pg_temp.id(u), 'agent', t.id FROM (VALUES ('zenith_team1'), ('zenith_team2')) v (u), public.firm_teams t WHERE t.firm_id = pg_temp.id('zenith') AND t.name = 'Zenith Sales';
  PERFORM pg_temp.account('z2', 'zenith', 'zenith_team1');
  PERFORM pg_temp.opportunity('oz2', 'z2', 'zenith_team1');
  PERFORM pg_temp.is(pg_temp.save('zenith_lead', 'oz2', '{"owner":"zenith_agent"}'), '42501: You can give an opportunity only to yourself and, as a lead, to people on your teams.', 'a lead of Zenith Sales cannot give their team''s to a person off it');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('zenith_lead', 'oz2', '{"owner":"zenith_team2"}')), 'ok', 'but to a member of their team who sees the account');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = pg_temp.id('oz2')), pg_temp.id('zenith_team2'), 'it is theirs now');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('zenith_owner', 'oz2', '{"owner":"zenith_agent2"}')), 'ok', 'an owner of the firm gives it to anyone current who sees the account');
END $$;

-- ---------- the version and the conflict (D-46, D-183) ----------
-- Break caught: a save with no version or one from the future is accepted; a stale save overwrites a newer one; the conflict says nothing of what changed
-- or who changed it, names the wrong current values, or saves part of the stale one; two saves from one version both win.
DO $$
DECLARE r text; j jsonb; v integer;
BEGIN
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{}', NULL) ~ '^22023: This save did not say which version of the opportunity it started from', true, 'no version is refused');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{}', 0) ~ '^22023: This save did not say', true, 'and version 0');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{}', pg_temp.ver('o1') + 5) ~ '^22023: This save names a version of the opportunity that does not exist', true, 'a version it never had is refused');
  v := pg_temp.ver('o1');
  -- the owner of the firm saves first, from the current version; the agent then saves from the version they started from
  PERFORM pg_temp.save('acme_owner', 'o1', '{"next_step":"By the owner","value":20000}');
  r := pg_temp.save('acme_agent1', 'o1', '{"next_step":"By the agent","name":"Agent''s name"}', v);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a stale save is answered, not refused');
  j := r::jsonb;
  PERFORM pg_temp.is(j ->> 'conflict', 'true', 'as a conflict');
  PERFORM pg_temp.is((j ->> 'currentVersion')::int, pg_temp.ver('o1'), 'naming the version now');
  PERFORM pg_temp.is(j -> 'current' ->> 'next_step', 'By the owner', 'with the values now');
  PERFORM pg_temp.is((j -> 'current' ->> 'value')::numeric, 20000::numeric, 'every one');
  PERFORM pg_temp.is(j -> 'current' ->> 'name', 'PEO search o1', 'the name the agent tried to change is the current one');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',' ORDER BY c ->> 'field') FROM jsonb_array_elements(j -> 'changed') c), 'next_step,value', 'and what changed since the version they started from');
  PERFORM pg_temp.is((SELECT c ->> 'who' FROM jsonb_array_elements(j -> 'changed') c WHERE c ->> 'field' = 'value'), 'acme_owner@example.test', 'by whom');
  PERFORM pg_temp.is((SELECT name FROM public.opportunities WHERE id = pg_temp.id('o1')), 'PEO search o1', 'and nothing of the stale save was saved');
  PERFORM pg_temp.is(pg_temp.ver('o1'), (j ->> 'currentVersion')::int, 'the version did not move');
  -- two saves from one version: the first wins, the second is the conflict
  v := pg_temp.ver('o1');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{"source":"first"}', v)::jsonb ->> 'conflict', 'false', 'the first save from a version wins');
  PERFORM pg_temp.is(pg_temp.save('acme_owner', 'o1', '{"source":"second"}', v)::jsonb ->> 'conflict', 'true', 'the second from the same version does not');
  PERFORM pg_temp.is((SELECT source FROM public.opportunities WHERE id = pg_temp.id('o1')), 'first', 'and the first one''s is what is there');
  -- a stale save names a main contact that has since been moved off the account: the answer is the conflict, not "Choose a contact of this account"
  PERFORM pg_temp.contact('c_mv', 'a1', 'acme_agent1', 'mv@example.test');
  v := pg_temp.ver('o1');
  PERFORM pg_temp.save('acme_owner', 'o1', '{"next_step":"Moved on"}');
  UPDATE public.contacts SET account_id = pg_temp.id('a2') WHERE id = pg_temp.id('c_mv');
  r := pg_temp.save('acme_agent1', 'o1', '{"main":"c_mv"}', v);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a stale save whose main contact has since moved is not refused as a bad contact');
  PERFORM pg_temp.is(r::jsonb ->> 'conflict', 'true', 'it is the conflict');
  -- from the current version the same contact is refused, in words
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'o1', '{"main":"c_mv"}'), '22023: Choose a contact of this account.', 'and a current save naming it is refused');
END $$;

-- ---------- calls, notes and tasks on an opportunity (D-427; CRM-E1.5's rules) ----------
-- log_activity already names an opportunity of the account (a call's "About"). These tests pin it for all three kinds, so the page's Add a note and Add a task
-- rest on rules that are tested here and not assumed.
-- logs(): log_activity as a person, on an account and an opportunity (by name), with named arguments; the activity's id, or the SQLSTATE and message.
CREATE FUNCTION pg_temp.logs(who text, kind text, acct text, opp text, p jsonb DEFAULT '{}') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format(
    'SELECT (public.log_activity(p_kind => %L, p_account_id => %L, p_opportunity_id => %L, p_outcome => %L, p_body => %L, p_title => %L, p_due_on => %L, p_firm_id => %L)->''activity''->>''id'')',
    kind, pg_temp.id(acct), pg_temp.id(opp), p ->> 'outcome', p ->> 'body', p ->> 'title', p ->> 'due_on', pg_temp.firm_of(who)))
$$;

-- Break caught: a call, a note or a task can't be logged on an opportunity, or is logged on one of another account; anyone who may see the account can't add;
-- someone who may not see it can; an archived account takes one; the opportunity is lost from the row.
DO $$
DECLARE r text;
BEGIN
  r := pg_temp.logs('acme_owner', 'note', 'a_h', 'o_h', '{"body":"Spoke with Jo about terms"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a note is logged on an opportunity');
  INSERT INTO fx VALUES ('n_h', r::uuid);
  r := pg_temp.logs('acme_owner', 'call', 'a_h', 'o_h', '{"outcome":"spoke","body":"Walked through the quotes"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a call');
  INSERT INTO fx VALUES ('call_h', r::uuid);
  r := pg_temp.logs('acme_owner', 'task', 'a_h', 'o_h', jsonb_build_object('title', 'Send the census again', 'due_on', current_date + 3));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a task');
  INSERT INTO fx VALUES ('task_h', r::uuid);
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE opportunity_id = pg_temp.id('o_h')), 3::bigint, 'all three name the opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE opportunity_id = pg_temp.id('o_h') AND account_id = pg_temp.id('a_h')), 3::bigint, 'and sit on its account');
  -- on the account, not about the opportunity: not its activity
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_owner', 'acme-brokers', format('SELECT (public.log_activity(p_kind => ''note'', p_account_id => %L, p_body => ''Account-wide note'', p_firm_id => %L)->''activity''->>''id'')', pg_temp.id('a_h'), pg_temp.id('acme')))), 'ok', 'a note on the account alone');
  -- another account's opportunity is refused in words
  PERFORM pg_temp.is(pg_temp.logs('acme_owner', 'note', 'a_h', 'o1', '{"body":"x"}'), '22023: Choose an opportunity of this account.', 'an opportunity of another account is not one to log on');
  -- anyone who may see the account may add (D-209): zenith_agent2 sees z1 and does not own it
  PERFORM pg_temp.is(pg_temp.code(pg_temp.logs('zenith_agent2', 'note', 'z1', 'oz', '{"body":"A colleague''s note"}')), 'ok', 'anyone who may see the account adds, owner or not');
  -- one who may not see it can not, and is told the account is not there
  PERFORM pg_temp.is(pg_temp.logs('acme_agent2', 'note', 'a1', 'o1', '{"body":"x"}'), 'PT404: That account isn''t available', 'someone who may not see the account is refused');
  -- an archived account takes nothing more
  PERFORM pg_temp.is(pg_temp.logs('acme_owner', 'note', 'a_arch', 'o_arch', '{"body":"x"}'), '55000: This account is archived. Nothing can be added to it.', 'an archived account takes none');
END $$;

-- Break caught: the note rule (D-200) is not applied to a note on an opportunity: another person edits it, it is edited after a day, or can't be added to; a
-- task is marked done only by the one who made it.
DO $$
DECLARE r text;
BEGIN
  -- the owner of the firm writes a note and a task on agent1's opportunity; agent1, who sees the account and did not write them, then acts on them
  INSERT INTO fx VALUES ('n_1', pg_temp.logs('acme_owner', 'note', 'a1', 'o1', '{"body":"Owner''s note"}')::uuid);
  INSERT INTO fx VALUES ('task_1', pg_temp.logs('acme_owner', 'task', 'a1', 'o1', jsonb_build_object('title', 'Owner''s task', 'due_on', current_date + 2))::uuid);
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.update_activity(%L, p_body => ''Changed by another person'', p_firm_id => %L)::text', pg_temp.id('n_1'), pg_temp.id('acme')));
  PERFORM pg_temp.is(r, '42501: Only the person who wrote a note can change it.', 'only the writer changes the note');
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.add_to_note(%L, ''An addition by someone who sees it'', %L)::text', pg_temp.id('n_1'), pg_temp.id('acme')));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'anyone who may see the account adds to it');
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.set_task_done(%L, true, %L)::text', pg_temp.id('task_1'), pg_temp.id('acme')));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'and marks its task done');
  -- a note written yesterday, on the opportunity
  WITH ins AS (
    INSERT INTO public.activities (firm_id, account_id, opportunity_id, kind, author_id, body, at, created_at)
    SELECT a.firm_id, a.id, pg_temp.id('o1'), 'note', pg_temp.id('acme_owner'), 'An old note', now() - interval '25 hours', now() - interval '25 hours'
    FROM public.accounts a WHERE a.id = pg_temp.id('a1') RETURNING id)
  INSERT INTO fx SELECT 'old_1', ins.id FROM ins;
  r := pg_temp.as_call('acme_owner', 'acme-brokers', format('SELECT public.update_activity(%L, p_body => ''Too late'', p_firm_id => %L)::text', pg_temp.id('old_1'), pg_temp.id('acme')));
  PERFORM pg_temp.is(r, '42501: A note can''t be changed after a day. Add to it instead.', 'after a day even the writer adds instead');
END $$;

-- ---------- last activity (D-201) ----------
-- Break caught: a note logged on an opportunity is not activity on its account, so an account worked through its opportunities looks untouched.
DO $$
DECLARE before_at timestamptz; r text; after_at timestamptz;
BEGIN
  SELECT max(t.at) INTO before_at FROM public.account_activity_times(pg_temp.id('acme'), pg_temp.id('a_h')) t;
  PERFORM pg_sleep(0.05);
  r := pg_temp.logs('acme_owner', 'note', 'a_h', 'o_h', '{"body":"Later note about the quotes"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a later note');
  SELECT max(t.at) INTO after_at FROM public.account_activity_times(pg_temp.id('acme'), pg_temp.id('a_h')) t;
  PERFORM pg_temp.is(after_at > before_at, true, 'moves the account''s last activity');
  PERFORM pg_temp.is(after_at, (SELECT a.activity_at FROM public.activities a WHERE a.id = r::uuid), 'to that note''s moment');
END $$;

-- ---------- the activity read (D-427, D-212) ----------
CREATE FUNCTION pg_temp.act(who text, opp text, p_filter text DEFAULT 'all', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.opportunity_activity(%L, %L, %L, %s, %s)::text', pg_temp.firm_of(who), pg_temp.id(opp), p_filter, p_limit, p_offset))
$$;
-- The types of a page's rows, in order, as one line.
CREATE FUNCTION pg_temp.types(j jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(e ->> 'type', ',' ORDER BY ord), '') FROM jsonb_array_elements(j -> 'rows') WITH ORDINALITY AS t (e, ord)
$$;

-- Break caught: the activity leaves out one of its kinds (calls, notes, tasks, its quote requests' events, its record history with its stage changes), or takes in
-- what is not its own (the account's other notes, another opportunity's, a contact's); is not newest first; counts one thing and lists another.
DO $$
DECLARE j jsonb; n bigint; prev timestamptz; r jsonb;
BEGIN
  j := pg_temp.act('acme_owner', 'o_h')::jsonb;
  -- what the opportunity holds: its 3 calls, notes and tasks (and a later note, and none of the account's own), 7 quote events, its history and stage changes
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'note'), 2::bigint, 'its two notes, not the account-wide one');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'call'), 1::bigint, 'its call');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'task'), 1::bigint, 'its task');
  PERFORM pg_temp.is((SELECT string_agg(e ->> 'event' || ':' || (e ->> 'peo_name'), ',' ORDER BY e ->> 'peo_name', e ->> 'event') FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'quote'),
    'quoted:Insperity,sent:Insperity,sent:Justworks,declined:TriNet,sent:TriNet', 'its quote requests'' events: sent, quoted, declined');
  PERFORM pg_temp.is((SELECT string_agg((e ->> 'from_value') || '>' || (e ->> 'to_value') || ':' || COALESCE(e ->> 'cause', '-') || ':' || COALESCE(e ->> 'cause_peo', '-'), ' ' ORDER BY array_position(ARRAY['ready_to_send', 'in_market', 'quoted'], e ->> 'to_value'))
                      FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'kind' = 'stage_changed'),
    'intake_under_way>ready_to_send:-:- ready_to_send>in_market:quote_send:Justworks in_market>quoted:quote_recorded:Insperity', 'its stage changes, with their causes (as record_history_list gives them)');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'change' AND e ->> 'kind' = 'changed'), (SELECT count(*) FROM public.record_history h WHERE h.table_name = 'opportunities' AND h.record_key = pg_temp.id('o_h')::text AND h.kind = 'changed'), 'and every field change in its record history');
  PERFORM pg_temp.is((j ->> 'count')::bigint, jsonb_array_length(j -> 'rows')::bigint, 'the count is of what is listed (one page holds it all here)');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' NOT IN ('call', 'note', 'task', 'change', 'quote')), 0::bigint, 'with no other kind');
  -- a change row says which record it is about
  r := (SELECT e FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'change' LIMIT 1);
  PERFORM pg_temp.is(r ->> 'record_table', 'opportunities', 'a change row names its table');
  PERFORM pg_temp.is(r ->> 'record_id', pg_temp.id('o_h')::text, 'its record');
  -- newest first
  prev := 'infinity';
  FOR r IN SELECT e FROM jsonb_array_elements(j -> 'rows') e LOOP
    PERFORM pg_temp.is((r ->> 'at')::timestamptz <= prev, true, 'newest first');
    prev := (r ->> 'at')::timestamptz;
  END LOOP;
  -- a call is placed when it took place, a note when it was made: the crm_activity_row of the account's own Activity tab
  PERFORM pg_temp.is((SELECT e ->> 'body' FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'call'), 'Walked through the quotes', 'a call row is the account tab''s row');
  PERFORM pg_temp.is((SELECT e -> 'opportunity' ->> 'id' FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'call'), pg_temp.id('o_h')::text, 'naming the opportunity');
  PERFORM pg_temp.is((SELECT (e ->> 'can_edit')::boolean FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'call'), true, 'with can_edit for the caller');
  -- an opportunity that has none of it
  j := pg_temp.act('acme_agent1', 'o2')::jsonb;
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' <> 'change'), 0::bigint, 'an opportunity nobody has called, noted or quoted holds only its record history');
  PERFORM pg_temp.is((j ->> 'count')::bigint, (SELECT count(*) FROM public.record_history h WHERE h.table_name = 'opportunities' AND h.record_key = pg_temp.id('o2')::text), 'which is what the history holds');
END $$;

-- Break caught: a filter keeps what it should drop (Calls with notes, Changes without the stage changes or the quote events, Notes with a task), or drops what it
-- should keep; All is not the sum of the others; a bad filter is accepted.
DO $$
DECLARE all_n bigint; calls bigint; notes bigint; tasks bigint; changes bigint;
BEGIN
  all_n := (pg_temp.act('acme_owner', 'o_h')::jsonb ->> 'count')::bigint;
  calls := (pg_temp.act('acme_owner', 'o_h', 'calls')::jsonb ->> 'count')::bigint;
  notes := (pg_temp.act('acme_owner', 'o_h', 'notes')::jsonb ->> 'count')::bigint;
  tasks := (pg_temp.act('acme_owner', 'o_h', 'tasks')::jsonb ->> 'count')::bigint;
  changes := (pg_temp.act('acme_owner', 'o_h', 'changes')::jsonb ->> 'count')::bigint;
  PERFORM pg_temp.is(pg_temp.types(pg_temp.act('acme_owner', 'o_h', 'calls')::jsonb), 'call', 'Calls: the call alone');
  PERFORM pg_temp.is(pg_temp.types(pg_temp.act('acme_owner', 'o_h', 'notes')::jsonb), 'note,note', 'Notes: the two notes');
  PERFORM pg_temp.is(pg_temp.types(pg_temp.act('acme_owner', 'o_h', 'tasks')::jsonb), 'task', 'Tasks: the task alone');
  PERFORM pg_temp.is((SELECT count(DISTINCT e ->> 'type') FROM jsonb_array_elements(pg_temp.act('acme_owner', 'o_h', 'changes')::jsonb -> 'rows') e), 2::bigint, 'Changes: record history and quote events, no call, note or task');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(pg_temp.act('acme_owner', 'o_h', 'changes')::jsonb -> 'rows') e WHERE e ->> 'kind' = 'stage_changed'), 3::bigint, 'with the stage changes');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(pg_temp.act('acme_owner', 'o_h', 'changes')::jsonb -> 'rows') e WHERE e ->> 'type' = 'quote'), 5::bigint, 'and the quote events');
  PERFORM pg_temp.is(calls = 1 AND notes = 2 AND tasks = 1 AND changes > 8, true, 'each is what it should be');
  PERFORM pg_temp.is(all_n, calls + notes + tasks + changes, 'All is the five together');
  PERFORM pg_temp.is(pg_temp.act('acme_owner', 'o_h', 'everything'), '22023: An opportunity''s activity is all, calls, notes, tasks or changes', 'a filter that is not one');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_owner', 'acme-brokers', format('SELECT public.opportunity_activity(%L, %L, NULL)::text', pg_temp.id('acme'), pg_temp.id('o_h')))), '22023', 'nor none');
END $$;

-- Break caught: a page skips or repeats an entry, or holds more than asked; the page size or offset is unchecked; the pages of a long history (more than the 100
-- record_history_list gives at once) stop at the first hundred or repeat entries that share a moment.
DO $$
DECLARE all_n bigint; got text[] := '{}'; page jsonb; off integer := 0; keys text[];
BEGIN
  all_n := (pg_temp.act('acme_owner', 'o_h')::jsonb ->> 'count')::bigint;
  LOOP
    page := pg_temp.act('acme_owner', 'o_h', 'all', 4, off)::jsonb;
    EXIT WHEN jsonb_array_length(page -> 'rows') = 0;
    PERFORM pg_temp.is(jsonb_array_length(page -> 'rows') <= 4, true, 'a page holds no more than asked');
    got := got || ARRAY(SELECT e ->> 'entry_key' FROM jsonb_array_elements(page -> 'rows') e);
    off := off + 4;
  END LOOP;
  PERFORM pg_temp.is(cardinality(got)::bigint, all_n, 'the pages together hold every entry');
  PERFORM pg_temp.is((SELECT count(DISTINCT k) FROM unnest(got) k), all_n, 'none twice');
  keys := ARRAY(SELECT e ->> 'entry_key' FROM jsonb_array_elements(pg_temp.act('acme_owner', 'o_h', 'all', 100, 0)::jsonb -> 'rows') e);
  PERFORM pg_temp.is(got, keys, 'and in the order of one big page');
  PERFORM pg_temp.is(pg_temp.act('acme_owner', 'o_h', 'all', 101, 0), '22023: A page is 0 to 100 rows, from a place that is not before the first', 'a page of 101 is refused');
  PERFORM pg_temp.is(left(pg_temp.act('acme_owner', 'o_h', 'all', 10, -1), 6), '22023:', 'and one from before the first');
  PERFORM pg_temp.is(pg_temp.act('acme_owner', 'o_h', 'all', 0, 0)::jsonb -> 'rows', '[]'::jsonb, 'a page of none is allowed, with the count');
  -- a long history: 130 changes made one after another, which share a moment
  PERFORM pg_temp.opportunity('o_long', 'a1', 'acme_agent1');
  FOR off IN 1 .. 130 LOOP
    UPDATE public.opportunities SET next_step = 'Step ' || off WHERE id = pg_temp.id('o_long');
  END LOOP;
  all_n := (SELECT count(*) FROM public.record_history h WHERE h.table_name = 'opportunities' AND h.record_key = pg_temp.id('o_long')::text);
  PERFORM pg_temp.is(all_n > 130, true, 'the history is longer than the 100 it is read in');
  page := pg_temp.act('acme_agent1', 'o_long', 'changes', 100, 0)::jsonb;
  PERFORM pg_temp.is((page ->> 'count')::bigint, all_n, 'all of it is counted');
  got := ARRAY(SELECT e ->> 'entry_key' FROM jsonb_array_elements(page -> 'rows') e) || ARRAY(SELECT e ->> 'entry_key' FROM jsonb_array_elements(pg_temp.act('acme_agent1', 'o_long', 'changes', 100, 100)::jsonb -> 'rows') e);
  PERFORM pg_temp.is(cardinality(got)::bigint, all_n, 'and every entry is on a page');
  PERFORM pg_temp.is((SELECT count(DISTINCT k) FROM unnest(got) k), all_n, 'none twice');
END $$;

-- Break caught: the activity is read by someone who may not see the opportunity, or the refusals tell them apart (not there, another firm's, not theirs).
DO $$
DECLARE r text;
BEGIN
  r := pg_temp.act('acme_agent2', 'o1');
  PERFORM pg_temp.is(r, 'PT404: That opportunity isn''t available', 'an agent who may not see its account');
  PERFORM pg_temp.is(pg_temp.act('acme_agent1', 'o1') ~ '^{', true, 'its account''s owner reads it');
  PERFORM pg_temp.is(pg_temp.act('zenith_agent2', 'oz') ~ '^{', true, 'where everyone sees everything, anyone does');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.opportunity_activity(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('oz'))), r, 'another firm''s opportunity: the same answer');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.opportunity_activity(%L, %L)::text', pg_temp.id('acme'), gen_random_uuid())), r, 'one that is not there');
  PERFORM pg_temp.is(pg_temp.act('acme_removed', 'o1'), r, 'a former member');
  PERFORM pg_temp.is(pg_temp.as_call('nobody', NULL, format('SELECT public.opportunity_activity(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('o1'))), r, 'a person of no firm');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.opportunity_activity(%L, %L)', pg_temp.id('acme'), pg_temp.id('o1'))), 5), '42501', 'a signed-out caller may not call it');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- who made a quote event (D-33) ----------
-- Break caught: a quote request's event made by Nevermore's own staff (a platform admin who is not a member of the firm) shows their email and reads as a member;
-- the actor is judged by a rule of the activity's own and not the firm's record of who did what (firm_actor_is_staff).
DO $$
DECLARE j jsonb; q bigint;
BEGIN
  PERFORM pg_temp.new_prospect('quin', 'Quin Quote');
  PERFORM pg_temp.start_intake('i_qev', 'quin', pg_temp.answers('Quote Event Co'), 'acme');
  PERFORM pg_temp.opportunity('o_qev', 'a1', 'acme_agent1', 'i_qev');
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('i_qev'), 'Paychex', 'sent', '2026-11-10') RETURNING id INTO q;
  -- the events are append-only: one by a platform admin who is no member of Acme (declined), one by a member (closed); the send itself, made here, has no actor
  INSERT INTO public.quote_request_events (quote_request_id, session_id, field, old_value, new_value, changed_by, changed_by_email)
  VALUES (q, pg_temp.id('i_qev'), 'status', 'sent', 'declined', pg_temp.id('platform_admin'), 'platform_admin@example.test'),
         (q, pg_temp.id('i_qev'), 'status', 'declined', 'closed', pg_temp.id('acme_agent1'), 'acme_agent1@example.test');
  j := pg_temp.act('acme_agent1', 'o_qev', 'changes')::jsonb;
  PERFORM pg_temp.is((SELECT e ->> 'who' FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'quote' AND e ->> 'event' = 'declined'), 'Nevermore', 'staff reads as Nevermore');
  PERFORM pg_temp.is((SELECT e ->> 'who_kind' FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'quote' AND e ->> 'event' = 'declined'), 'nevermore', 'with the kind nevermore');
  PERFORM pg_temp.is(j::text !~ 'platform_admin', true, 'and no trace of their email');
  PERFORM pg_temp.is((SELECT e ->> 'who_kind' FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'quote' AND e ->> 'event' = 'closed'), 'member', 'a member of the firm is still a member');
  PERFORM pg_temp.is((SELECT e ->> 'who' FROM jsonb_array_elements(j -> 'rows') e WHERE e ->> 'type' = 'quote' AND e ->> 'event' = 'closed'), 'acme_agent1@example.test', 'by their name');
END $$;

-- ---------- the certified version, not the live answers (D-425) ----------
-- Break caught: the census size counts the answers as they stand now, so a prospect who adds a row after certifying changes "the census in the certified version".
DO $$
DECLARE j jsonb;
BEGIN
  PERFORM pg_temp.as_user('kim');
  UPDATE public.chamber_sessions SET chamber_data = jsonb_set(chamber_data, '{census}', chamber_data -> 'census' || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'first_name', 'Q', 'last_name', 'R', 'dob', '1970-01-01')))
  WHERE id = pg_temp.id('i_two');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(jsonb_array_length((SELECT chamber_data -> 'census' FROM public.chamber_sessions WHERE id = pg_temp.id('i_two'))), 4, 'the live answers now have four census rows');
  j := pg_temp.page('acme_owner', 'o_two')::jsonb -> 'intake';
  PERFORM pg_temp.is((j ->> 'census_size')::int, 3, 'the certified version still has three');
  PERFORM pg_temp.is((j ->> 'version')::int, 2, 'and is version 2');
END $$;

-- ---------- the save changes only its own fields, on an opportunity that holds an intake ----------
-- Break caught: a save of an opportunity with an intake loses or changes the intake, the account, the firm or the stage.
DO $$
DECLARE before_o public.opportunities; r text;
BEGIN
  SELECT * INTO before_o FROM public.opportunities WHERE id = pg_temp.id('o_h');
  r := pg_temp.save('acme_owner', 'o_h', '{"name":"Harbor, renamed","next_step":"Chase the quote"}');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'an owner of the firm saves an opportunity that holds an intake');
  PERFORM pg_temp.is((SELECT row (o.account_id, o.intake_id, o.firm_id, o.created_at)::text FROM public.opportunities o WHERE o.id = pg_temp.id('o_h')),
    row (before_o.account_id, before_o.intake_id, before_o.firm_id, before_o.created_at)::text, 'its intake, account and firm are as they were');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('o_h')), 'quoted', 'and so is its stage');
  PERFORM pg_temp.is(pg_temp.page('acme_owner', 'o_h')::jsonb -> 'opportunity' ->> 'name', 'Harbor, renamed', 'the page shows the saved name');
END $$;

-- ---------- lock order: the account first, then the opportunity (as renewal writes, archive, delete and owner change take them) ----------
-- Break caught: the save locks the opportunity and only then reads the account (or never locks the account), so (1) it can hold an opportunity while an owner
-- change or archive holds the account and wait on it, in a ring with a writer that takes them the other way round, (2) it asks the level rule of rows another
-- session is changing (a stale owner: a person who was just given the opportunity away still saves it), and (3) an archive that commits between its read and its
-- write lets a change land on an archived account. Shown with two sessions: while the second holds the account's row as an owner change or an archive does (FOR
-- NO KEY UPDATE), the save waits on the account before it takes the opportunity, so the second can still take the opportunity within two seconds; a save that
-- waited behind an owner change judges the level rule against the new owner; and one that waited behind an archive refuses (55000) once it commits.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
-- The fixtures, committed first (a DO block is one transaction), so the two other sessions below can see them.
DO $$
BEGIN
  PERFORM pg_temp.account('lk_a', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('lk_b', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('lk_c', 'acme', 'acme_agent1');
  PERFORM pg_temp.opportunity('lk_o', 'lk_a', 'acme_agent1');
  PERFORM pg_temp.opportunity('lk_arch', 'lk_b', 'acme_agent1');
  PERFORM pg_temp.opportunity('lk_own', 'lk_c', 'acme_agent1');
END $$;
DO $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  fid uuid := pg_temp.id('acme');
  a_pid integer; b_pid integer; tries integer; got text; code text;
  save_stmt text;
  open_as text := format('SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; SET LOCAL request.headers = %L',
    jsonb_build_object('sub', pg_temp.id('acme_agent1'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_agent1@example.test')::text,
    jsonb_build_object('x-firm-address', 'acme-brokers')::text);
BEGIN
  PERFORM race.dblink_connect('qa', dsn);
  PERFORM race.dblink_connect('qb', dsn);
  SELECT pid INTO a_pid FROM race.dblink('qa', 'SELECT pg_backend_pid()') AS t(pid integer);
  SELECT pid INTO b_pid FROM race.dblink('qb', 'SELECT pg_backend_pid()') AS t(pid integer);

  -- 1. The second holds the account row as an owner change does; the save waits on it and has not taken the opportunity.
  save_stmt := format($q$SELECT public.update_opportunity(%L, 'Held', NULL, NULL, NULL, NULL, NULL, NULL, 'Held next step', NULL, %L, 1)::text$q$, pg_temp.id('lk_o'), fid);
  PERFORM race.dblink_exec('qb', 'BEGIN');
  PERFORM race.dblink_exec('qb', format('DO $do$ BEGIN PERFORM 1 FROM public.accounts WHERE id = %L FOR NO KEY UPDATE; END $do$', pg_temp.id('lk_a')));
  PERFORM race.dblink_exec('qa', 'BEGIN');
  PERFORM race.dblink_exec('qa', open_as);
  PERFORM race.dblink_send_query('qa', save_stmt);
  tries := 0;
  WHILE tries < 100 AND NOT (b_pid = ANY (pg_blocking_pids(a_pid))) LOOP
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM pg_temp.is(b_pid = ANY (pg_blocking_pids(a_pid)), true, 'the save waits on the account row');
  BEGIN
    PERFORM race.dblink_exec('qb', format('SET LOCAL lock_timeout = %L; DO $do$ BEGIN PERFORM 1 FROM public.opportunities WHERE id = %L FOR NO KEY UPDATE; END $do$', '2s', pg_temp.id('lk_o')));
    got := 'ok';
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE;
  END;
  PERFORM race.dblink_exec('qb', 'ROLLBACK');
  PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
  PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
  PERFORM race.dblink_exec('qa', 'ROLLBACK');
  PERFORM pg_temp.is(got, 'ok', 'the opportunity was free while the save waited: the account is taken first');

  -- 2. An owner change commits while the save waits: the save judges the level rule against the opportunity as it is then (agent3's, not agent1's).
  save_stmt := format($q$SELECT public.update_opportunity(%L, 'Late', NULL, NULL, NULL, NULL, NULL, NULL, 'Late next step', NULL, %L, 1)::text$q$, pg_temp.id('lk_own'), fid);
  PERFORM race.dblink_exec('qb', 'BEGIN');
  PERFORM race.dblink_exec('qb', format('DO $do$ BEGIN PERFORM 1 FROM public.accounts WHERE id = %L FOR NO KEY UPDATE; END $do$', pg_temp.id('lk_c')));
  PERFORM race.dblink_exec('qb', format('UPDATE public.opportunities SET owner_id = %L WHERE id = %L', pg_temp.id('acme_agent3'), pg_temp.id('lk_own')));
  PERFORM race.dblink_exec('qa', 'BEGIN');
  PERFORM race.dblink_exec('qa', open_as);
  PERFORM race.dblink_send_query('qa', save_stmt);
  tries := 0;
  WHILE tries < 100 AND NOT (b_pid = ANY (pg_blocking_pids(a_pid))) LOOP
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM pg_temp.is(b_pid = ANY (pg_blocking_pids(a_pid)), true, 'a save waits behind an owner change');
  PERFORM race.dblink_exec('qb', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
    got := 'ok';
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE;
  END;
  PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
  PERFORM race.dblink_exec('qa', 'ROLLBACK');
  PERFORM pg_temp.is(got, '42501', 'and refuses once the owner has changed: agent1 no longer owns it');
  PERFORM pg_temp.is((SELECT next_step FROM public.opportunities WHERE id = pg_temp.id('lk_own')), NULL::text, 'leaving it unchanged');

  -- 3. An archive commits while the save waits: the save then sees the account archived and refuses (55000).
  save_stmt := format($q$SELECT public.update_opportunity(%L, 'Too late', NULL, NULL, NULL, NULL, NULL, NULL, 'Archived next step', NULL, %L, 1)::text$q$, pg_temp.id('lk_arch'), fid);
  PERFORM race.dblink_exec('qb', 'BEGIN');
  PERFORM race.dblink_exec('qb', format('UPDATE public.accounts SET archived_at = now() WHERE id = %L', pg_temp.id('lk_b')));
  PERFORM race.dblink_exec('qa', 'BEGIN');
  PERFORM race.dblink_exec('qa', open_as);
  PERFORM race.dblink_send_query('qa', save_stmt);
  tries := 0;
  WHILE tries < 100 AND NOT (b_pid = ANY (pg_blocking_pids(a_pid))) LOOP
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM pg_temp.is(b_pid = ANY (pg_blocking_pids(a_pid)), true, 'a save waits behind an archive');
  PERFORM race.dblink_exec('qb', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
    got := 'ok';
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE;
  END;
  PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
  PERFORM race.dblink_exec('qa', 'ROLLBACK');
  PERFORM race.dblink_disconnect('qa');
  PERFORM race.dblink_disconnect('qb');
  PERFORM pg_temp.is(got, '55000', 'and refuses once the archive has committed');
  PERFORM pg_temp.is((SELECT next_step FROM public.opportunities WHERE id = pg_temp.id('lk_arch')), NULL::text, 'leaving nothing changed on the archived account');
  RAISE NOTICE 'opportunity_page: lock order passed';
END $$;
