-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh opportunity_outcome
-- The review of CRM-O1.3b (docs/BROKER_CRM_BUILD.md D-46, D-423, D-461 to D-474; 20261121170000_opportunity_outcome.sql): a win and a reopening move the opportunity's
-- version (won_at and won_by are tracked fields, as lost_at and lost_by are), so a stale reopen cannot undo a newer win and a stale win is caught; and the page's
-- outcome (the lost reason, the placement with its renewal and payments, each quote's close reason) is one read, opportunity_outcome, with the page's visibility.
-- Two firms are used throughout. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261120121000_won_lost_commission.sql
\i supabase/migrations/20261120130000_opportunity_create.sql
\i supabase/migrations/20261121090000_spot_a_duplicate.sql
\i supabase/migrations/20261121100000_merge_records.sql
\i supabase/migrations/20261121110000_account_page_duplicate_mark.sql
\i supabase/migrations/20261121150000_epic4_after_merge_records.sql
\i supabase/migrations/20261121170000_opportunity_outcome.sql

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


-- ---------- the records ----------
-- Acme (by level): a1 is agent1's, a2 is agent2's (in Sales), a3 has no owner. Zenith (everyone sees everything): z1 is zenith_agent's.
DO $$
BEGIN
  PERFORM pg_temp.account('a1', 'acme', 'acme_agent1', 'Harborview Dental Group');
  PERFORM pg_temp.account('a2', 'acme', 'acme_agent2');
  PERFORM pg_temp.account('a3', 'acme', NULL);
  PERFORM pg_temp.account('z1', 'zenith', 'zenith_agent', 'Zenith client');
END $$;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.fid(who text) RETURNS uuid LANGUAGE sql AS $$ SELECT pg_temp.id(CASE WHEN who LIKE 'zenith%' THEN 'zenith' ELSE 'acme' END) $$;
CREATE FUNCTION pg_temp.addr(who text) RETURNS text LANGUAGE sql AS $$ SELECT CASE WHEN who LIKE 'zenith%' THEN 'zenith-benefits' ELSE 'acme-brokers' END $$;

CREATE FUNCTION pg_temp.pipeline(n text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id(n) $$;
CREATE FUNCTION pg_temp.ver(n text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT version FROM public.opportunities WHERE id = pg_temp.id(n) $$;

-- A quote request of an intake, made by the superuser (the advisor functions do it in the product). status 'quoted' gets a fee and a proposed start.
CREATE FUNCTION pg_temp.quote(n text, p_intake text, p_peo text, p_status text, p_fee numeric DEFAULT NULL, p_start date DEFAULT NULL) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE r bigint;
BEGIN
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on, admin_fee_pepm, proposed_start_on, quote_received_on)
  VALUES (pg_temp.id(p_intake), p_peo, p_status, current_date - 20, p_fee, p_start, CASE WHEN p_status = 'quoted' THEN current_date - 5 END) RETURNING id INTO r;
  RETURN r;
END $$;
CREATE FUNCTION pg_temp.qid(n text, peo text) RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id(n) AND peo_name = peo $$;

-- A quoted search: an intake moved to Quoted, its opportunity (owned by p_owner, 40 employees, target start 2027-04-01), and three quote requests: Justworks
-- (quoted, $85.00, proposes 2027-05-01), TriNet (quoted, $90.00, no proposed start) and Paychex (sent), plus Gusto (declined).
CREATE FUNCTION pg_temp.quoted(n text, p_firm text, p_account text, p_owner text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid := pg_temp.intake(n, p_firm);
BEGIN
  PERFORM pg_temp.move(n, 'submitted');
  PERFORM pg_temp.move(n, 'under_review');
  PERFORM pg_temp.move(n, 'ready_for_market');
  PERFORM pg_temp.move(n, 'sent_to_carrier');
  PERFORM pg_temp.move(n, 'quoted');
  PERFORM pg_temp.opportunity('o_' || n, p_account, p_owner, n);
  UPDATE public.opportunities SET employees = 40, target_start = DATE '2027-04-01' WHERE id = pg_temp.id('o_' || n);
  PERFORM pg_temp.quote(n || '_jw', n, 'Justworks', 'quoted', 85.00, DATE '2027-05-01');
  PERFORM pg_temp.quote(n || '_tn', n, 'TriNet', 'quoted', 90.00);
  PERFORM pg_temp.quote(n || '_px', n, 'Paychex', 'sent');
  PERFORM pg_temp.quote(n || '_gu', n, 'Gusto', 'declined');
  RETURN sid;
END $$;

-- Mark won as a person, by name, from the version given (NULL: the opportunity's own).
CREATE FUNCTION pg_temp.won(who text, p_opp text, p_quote bigint, p_start date, p_renewal date, p_broker text, p_version integer DEFAULT NULL,
                            p_basis text DEFAULT NULL, p_rate numeric DEFAULT NULL, p_yearly numeric DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format(
    'SELECT public.opportunity_mark_won(p_opportunity_id => %L, p_quote_request_id => %L, p_start_date => %L, p_renewal_date => %L, p_broker_of_record => %L, p_firm_id => %L, p_version => %L, p_commission_basis => %L, p_commission_rate => %L, p_commission_expected_yearly => %L)::text',
    pg_temp.id(p_opp), p_quote, p_start, p_renewal, p_broker, pg_temp.fid(who), COALESCE(p_version, pg_temp.ver(p_opp)), p_basis, p_rate, p_yearly))
$$;


-- A snapshot of everything a win writes, so a refused win can be shown to have written nothing.
CREATE FUNCTION pg_temp.snapshot(p_intake text, p_account text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT (SELECT status || ':' || COALESCE(won_quote_request_id::text, '-') FROM public.submission_workflow WHERE session_id = pg_temp.id(p_intake)) || '|'
    || (SELECT COALESCE(string_agg(q.id || q.status || COALESCE(q.close_reason, '-'), ',' ORDER BY q.id), '') FROM public.quote_requests q WHERE q.session_id = pg_temp.id(p_intake)) || '|'
    || (SELECT count(*) FROM public.placements WHERE account_id = pg_temp.id(p_account)) || '|' || (SELECT count(*) FROM public.renewals WHERE account_id = pg_temp.id(p_account)) || '|'
    || (SELECT count(*) FROM public.submission_status_history WHERE session_id = pg_temp.id(p_intake))
$$;

CREATE FUNCTION pg_temp.lost(who text, p_opp text, p_reason text, p_note text DEFAULT NULL, p_version integer DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format(
    'SELECT public.opportunity_mark_lost(p_opportunity_id => %L, p_reason => %L, p_note => %L, p_firm_id => %L, p_version => %L)::text',
    pg_temp.id(p_opp), p_reason, p_note, pg_temp.fid(who), COALESCE(p_version, pg_temp.ver(p_opp))))
$$;


CREATE FUNCTION pg_temp.reopen(who text, p_opp text, p_version integer DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format(
    'SELECT public.opportunity_reopen(p_opportunity_id => %L, p_firm_id => %L, p_version => %L)::text', pg_temp.id(p_opp), pg_temp.fid(who), COALESCE(p_version, pg_temp.ver(p_opp))))
$$;


CREATE FUNCTION pg_temp.pay(who text, p_placement text, p_on date, p_amount numeric, p_note text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.record_commission_payment(%L, %L, %L, %L, %L)::text', pg_temp.id(p_placement), p_on, p_amount, p_note, pg_temp.fid(who)))
$$;
CREATE FUNCTION pg_temp.payver(n text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT version FROM public.commission_payments WHERE id = pg_temp.id(n) $$;
CREATE FUNCTION pg_temp.payupd(who text, p_payment text, p_on date, p_amount numeric, p_note text, p_version integer) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.update_commission_payment(%L, %L, %L, %L, %L, %L)::text', pg_temp.id(p_payment), p_on, p_amount, p_note, pg_temp.fid(who), p_version))
$$;
CREATE FUNCTION pg_temp.paydel(who text, p_payment text, p_version integer) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.delete_commission_payment(%L, %L, %L)::text', pg_temp.id(p_payment), pg_temp.fid(who), p_version))
$$;


-- ---------- a win and a reopening move the opportunity's version (D-46, D-461, D-469) ----------
-- Break caught: a win with an intake writes nothing on the opportunity row, so the version stays where it was: a person who opened the page before the win and
-- one who opened it after are at the same version, a reopen from the page's old view passes the check and undoes a win made since (or the win of someone else),
-- and a win from a view that has been through a win and a reopening is not told so. The answers also name the version the page is to start its next save from.
DO $$
DECLARE r text; j jsonb; v0 integer; o uuid; jw bigint;
BEGIN
  PERFORM pg_temp.account('vx1', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('vxq1', 'acme', 'vx1', 'acme_agent1');
  o := pg_temp.id('o_vxq1');
  jw := pg_temp.qid('vxq1', 'Justworks');
  v0 := pg_temp.ver('o_vxq1');
  r := pg_temp.won('acme_agent1', 'o_vxq1', jw, NULL, NULL, 'Acme Brokers', v0);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the win: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is(pg_temp.ver('o_vxq1'), v0 + 1, 'a win moves the opportunity''s version by one');
  PERFORM pg_temp.is((j -> 'record' ->> 'version')::int, v0 + 1, 'and answers that version, for the next save to start from');
  PERFORM pg_temp.is((SELECT won_at IS NOT NULL AND won_by = pg_temp.id('acme_agent1') FROM public.opportunities WHERE id = o), true, 'it keeps when it was won and by whom');

  -- a reopening moves it again, and answers the version
  r := pg_temp.reopen('acme_agent1', 'o_vxq1', v0 + 1);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the reopening: ' || r);
  PERFORM pg_temp.is(pg_temp.ver('o_vxq1'), v0 + 2, 'a reopening moves the version by one');
  PERFORM pg_temp.is((r::jsonb -> 'record' ->> 'version')::int, v0 + 2, 'and answers it');
  PERFORM pg_temp.is((SELECT won_at IS NULL AND won_by IS NULL FROM public.opportunities WHERE id = o), true, 'the win''s mark is cleared');

  -- a win from the view before the win and the reopening is a conflict, and does nothing
  r := pg_temp.won('acme_agent1', 'o_vxq1', jw, NULL, NULL, 'Acme Brokers', v0);
  j := r::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'a win from a version that has been through a win and a reopening is a conflict: ' || r);
  PERFORM pg_temp.is((j ->> 'currentVersion')::int, v0 + 2, 'naming the version it is at');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',' ORDER BY c ->> 'field') FROM jsonb_array_elements(j -> 'changed') c), NULL::text,
    'a win and its reopening leave nothing different from where the view started, so nothing is named, and the dialog says so');
  PERFORM pg_temp.is(pg_temp.pipeline('vxq1'), 'quoted', 'nothing was won');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE opportunity_id = o), 0::bigint, 'and no placement made');
  r := pg_temp.won('acme_agent1', 'o_vxq1', jw, NULL, NULL, 'Acme Brokers', v0 + 2);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'from the current version it is won');
  PERFORM pg_temp.is(pg_temp.ver('o_vxq1'), v0 + 3, 'and the version moves again');
END $$;

-- Break caught: a reopen from a version older than the win undoes it (the page of someone who saw the opportunity Quoted, or Won before it was reopened and won
-- again); the conflict does not say the opportunity is Won, or does not name what changed; the refused reopen has already deleted the placement.
DO $$
DECLARE r text; j jsonb; v0 integer; o uuid; jw bigint; snap text;
BEGIN
  PERFORM pg_temp.account('vx2', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('vxq2', 'acme', 'vx2', 'acme_agent1');
  o := pg_temp.id('o_vxq2');
  jw := pg_temp.qid('vxq2', 'Justworks');
  v0 := pg_temp.ver('o_vxq2');
  PERFORM pg_temp.won('acme_agent1', 'o_vxq2', jw, NULL, NULL, 'Acme Brokers', v0);
  snap := pg_temp.snapshot('vxq2', 'vx2');
  -- opened before the win: the version it knew is older than the win
  r := pg_temp.reopen('acme_agent1', 'o_vxq2', v0);
  j := r::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'a reopen from the version before the win is a conflict: ' || r);
  PERFORM pg_temp.is((j ->> 'currentVersion')::int, v0 + 1, 'naming the version it is at');
  PERFORM pg_temp.is(j -> 'current' ->> 'stage', 'won', 'and the stage it is at');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',' ORDER BY c ->> 'field') FROM jsonb_array_elements(j -> 'changed') c), 'won_at,won_by', 'and what changed: when it was won, and by whom');
  PERFORM pg_temp.is(pg_temp.snapshot('vxq2', 'vx2'), snap, 'nothing was undone');
  -- the person who saw the win reopens it; another reopens... and wins again; the first one's reopen is stale
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_vxq2', v0 + 1)), 'ok', 'one person reopens the win');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_agent1', 'o_vxq2', jw, NULL, NULL, 'Acme Brokers', v0 + 2)), 'ok', 'and wins it again');
  snap := pg_temp.snapshot('vxq2', 'vx2');
  r := pg_temp.reopen('acme_owner', 'o_vxq2', v0 + 1);
  PERFORM pg_temp.is(((r::jsonb) ->> 'conflict')::boolean, true, 'a reopen from the first win''s version, held by someone else, is a conflict: ' || r);
  PERFORM pg_temp.is((r::jsonb ->> 'currentVersion')::int, v0 + 3, 'at the newest version');
  PERFORM pg_temp.is(pg_temp.pipeline('vxq2'), 'won', 'and the newer win stands');
  PERFORM pg_temp.is(pg_temp.snapshot('vxq2', 'vx2'), snap, 'with its placement');
  -- from the version it is at, the owner of the firm reopens it
  r := pg_temp.reopen('acme_owner', 'o_vxq2', v0 + 3);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'from the current version a reopening works: ' || r);
  PERFORM pg_temp.is((r::jsonb -> 'record' ->> 'version')::int, v0 + 4, 'and moves the version');
END $$;

-- Break caught: a lost opportunity's reopening answers a version that is not the opportunity's (the page then starts its next save from a version that does not
-- exist or is old); marking lost and the reopening of a loss no longer move the version.
DO $$
DECLARE r text; v0 integer;
BEGIN
  PERFORM pg_temp.account('vx3', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('vxq3', 'acme', 'vx3', 'acme_agent1');
  v0 := pg_temp.ver('o_vxq3');
  r := pg_temp.lost('acme_agent1', 'o_vxq3', 'price', NULL, v0);
  PERFORM pg_temp.is((r::jsonb -> 'record' ->> 'version')::int, pg_temp.ver('o_vxq3'), 'a loss answers the opportunity''s version');
  PERFORM pg_temp.is(pg_temp.ver('o_vxq3') > v0, true, 'and moves it');
  r := pg_temp.reopen('acme_agent1', 'o_vxq3');
  PERFORM pg_temp.is((r::jsonb -> 'record' ->> 'version')::int, pg_temp.ver('o_vxq3'), 'the reopening of a loss answers the opportunity''s version');
  PERFORM pg_temp.is(pg_temp.pipeline('vxq3'), 'quoted', 'back to Quoted');
END $$;

-- Break caught: the win's mark is not in the opportunity's history (D-473: the win, with who and when) or is shown as the actor's mark when Nevermore staff won;
-- the earlier tracked fields (the lost mark, its reason, the referral partner) were dropped when the new two were added to the list.
DO $$
DECLARE o uuid; got text; acme uuid := pg_temp.id('acme'); f text;
BEGIN
  PERFORM pg_temp.account('vx4', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('vxq4', 'acme', 'vx4', 'acme_agent1');
  o := pg_temp.id('o_vxq4');
  PERFORM pg_temp.won('acme_agent1', 'o_vxq4', pg_temp.qid('vxq4', 'Justworks'), NULL, NULL, 'Acme Brokers');
  PERFORM pg_temp.reopen('acme_agent1', 'o_vxq4');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  SELECT string_agg(h.field || ':' || CASE WHEN h.from_value IS NULL OR h.from_value = 'null'::jsonb THEN 'none' ELSE 'set' END || '>' || CASE WHEN h.to_value IS NULL OR h.to_value = 'null'::jsonb THEN 'none' ELSE 'set' END || ':' || h.who_kind,
                    ' ' ORDER BY h.at, h.field) INTO got
    FROM public.record_history_list(acme, 'opportunities', o::text) h WHERE h.kind = 'changed' AND h.field IN ('won_at', 'won_by');
  RESET ROLE;
  PERFORM pg_temp.is(got, 'won_at:none>set:member won_by:none>set:member won_at:set>none:member won_by:set>none:member', 'the win and its reopening are in the history, as changes of won_at and won_by by a member');
  FOR f IN SELECT unnest(ARRAY['name', 'target_start', 'employees', 'main_contact_id', 'expected_close', 'value', 'source', 'next_step', 'account_id', 'owner_id', 'lost_at', 'lost_by',
                               'lost_reason', 'lost_note', 'referral_partner_code', 'won_at', 'won_by']) LOOP
    PERFORM pg_temp.is((SELECT count(*) FROM pg_trigger t, regexp_matches(pg_get_triggerdef(t.oid), '''' || f || '''') m WHERE t.tgrelid = 'public.opportunities'::regclass AND t.tgname = 'opportunities_version'), 1::bigint,
      'the opportunity''s version watches ' || f);
    PERFORM pg_temp.is((SELECT count(*) FROM pg_trigger t, regexp_matches(pg_get_triggerdef(t.oid), '''' || f || '''') m WHERE t.tgrelid = 'public.opportunities'::regclass AND t.tgname LIKE 'opportunities%history%'), 1::bigint,
      'and so does its history: ' || f);
  END LOOP;
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.opportunities SET won_by = gen_random_uuid() WHERE won_at IS NULL$q$), '23514', 'who won it is kept only with when');
END $$;

-- ---------- the page's one read of the outcome (D-423, D-424, D-467, D-468, D-472) ----------
CREATE FUNCTION pg_temp.outcome(who text, p_opp text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.opportunity_outcome(%L, %L)::text', pg_temp.fid(who), pg_temp.id(p_opp)))
$$;

-- Break caught: the read answers a shape the screen does not expect (a missing key reads as nothing, so a won opportunity is drawn without its placement); an open
-- opportunity answers a placement or payments; a quote's close reason or proposed start is missing, so the Quotes panel and the dialog's default start are wrong.
DO $$
DECLARE j jsonb; jw bigint;
BEGIN
  PERFORM pg_temp.account('oc1', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('ocq1', 'acme', 'oc1', 'acme_agent1');
  jw := pg_temp.qid('ocq1', 'Justworks');
  j := pg_temp.outcome('acme_agent1', 'o_ocq1')::jsonb;
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(j) k), 'lost_note,lost_reason,payments,placement,quotes,received_to_date,renewal', 'the answer has exactly these keys');
  PERFORM pg_temp.is(j -> 'placement', 'null'::jsonb, 'an open opportunity has no placement');
  PERFORM pg_temp.is(j -> 'renewal', 'null'::jsonb, 'no renewal');
  PERFORM pg_temp.is(j -> 'payments', '[]'::jsonb, 'no payments');
  PERFORM pg_temp.is((j ->> 'received_to_date')::numeric, 0::numeric, 'nothing received');
  PERFORM pg_temp.is(j -> 'lost_reason', 'null'::jsonb, 'no lost reason');
  PERFORM pg_temp.is(jsonb_array_length(j -> 'quotes'), 4, 'one entry for each quote request of the intake');
  PERFORM pg_temp.is((SELECT q ->> 'proposed_start_on' FROM jsonb_array_elements(j -> 'quotes') q WHERE (q ->> 'id')::bigint = jw), '2027-05-01', 'with the start the PEO proposed');
  PERFORM pg_temp.is((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys((j -> 'quotes') -> 0) k), 'close_reason,id,proposed_start_on', 'and nothing else of a quote');
  -- an opportunity with no intake: no quotes, no error
  PERFORM pg_temp.opportunity('oc_bare', 'oc1', 'acme_agent1');
  PERFORM pg_temp.is(pg_temp.outcome('acme_agent1', 'oc_bare')::jsonb -> 'quotes', '[]'::jsonb, 'an opportunity with no intake has no quotes');
END $$;

-- Break caught: a win's placement, renewal and payments are not in the answer, or in the wrong shape (an amount as text, the received total not summed to the
-- cent); a payment of another placement is counted; the quotes the win closed do not say why.
DO $$
DECLARE j jsonb; pl public.placements; rn public.renewals; r text;
BEGIN
  PERFORM pg_temp.account('oc2', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('ocq2', 'acme', 'oc2', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_ocq2', pg_temp.qid('ocq2', 'TriNet'), DATE '2027-04-01', DATE '2028-04-01', 'Acme Brokers', NULL, 'share', 20, 12960);
  SELECT * INTO pl FROM public.placements WHERE opportunity_id = pg_temp.id('o_ocq2');
  SELECT * INTO rn FROM public.renewals WHERE placement_id = pl.id;
  INSERT INTO fx VALUES ('oc2_pl', pl.id);
  INSERT INTO public.commission_payments (firm_id, account_id, placement_id, received_on, amount, note) VALUES
    (pl.firm_id, pl.account_id, pl.id, DATE '2027-05-10', 1000.10, NULL), (pl.firm_id, pl.account_id, pl.id, DATE '2027-04-10', 500.20, 'First');
  j := pg_temp.outcome('acme_agent1', 'o_ocq2')::jsonb;
  PERFORM pg_temp.is(j -> 'placement', jsonb_build_object('id', pl.id, 'peo_name', 'TriNet', 'start_date', '2027-04-01', 'broker_of_record', 'Acme Brokers', 'ended_on', NULL,
    'commission_basis', 'share', 'commission_rate', 20, 'commission_expected_yearly', 12960, 'version', pl.version), 'the placement: PEO, start, broker, end, the commission and its version');
  PERFORM pg_temp.is(j -> 'renewal', jsonb_build_object('id', rn.id, 'renews_on', '2028-04-01'), 'the renewal made with it');
  PERFORM pg_temp.is((SELECT jsonb_agg(p ->> 'received_on' ORDER BY ord) FROM jsonb_array_elements(j -> 'payments') WITH ORDINALITY x (p, ord)), '["2027-04-10", "2027-05-10"]'::jsonb, 'the payments, earliest day first');
  PERFORM pg_temp.is(j -> 'payments' -> 0, jsonb_build_object('id', (SELECT id FROM public.commission_payments WHERE amount = 500.20), 'received_on', '2027-04-10', 'amount', 500.20, 'note', 'First', 'version', 1), 'each with its id, day, amount, note and version');
  PERFORM pg_temp.is((j ->> 'received_to_date')::numeric, 1500.30::numeric, 'and what is received to date, to the cent');
  PERFORM pg_temp.is((SELECT string_agg(q ->> 'close_reason', ',' ORDER BY (q ->> 'id')::bigint) FROM jsonb_array_elements(j -> 'quotes') q WHERE q ->> 'close_reason' IS NOT NULL), 'went_elsewhere,went_elsewhere', 'the quotes the win closed say why');
  -- another win's payments are not counted
  PERFORM pg_temp.account('oc3', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('ocq3', 'acme', 'oc3', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_ocq3', pg_temp.qid('ocq3', 'TriNet'), NULL, NULL, 'Acme Brokers');
  PERFORM pg_temp.is((pg_temp.outcome('acme_agent1', 'o_ocq3')::jsonb ->> 'received_to_date')::numeric, 0::numeric, 'another placement''s payments are not counted');
  PERFORM pg_temp.is(pg_temp.outcome('acme_agent1', 'o_ocq3')::jsonb -> 'placement' -> 'commission_basis', 'null'::jsonb, 'and a win with no commission says none');
END $$;

-- Break caught: a lost opportunity's reason and note are not in the answer; the quotes a loss closed do not say the search ended.
DO $$
DECLARE j jsonb;
BEGIN
  PERFORM pg_temp.account('oc4', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('ocq4', 'acme', 'oc4', 'acme_agent1');
  PERFORM pg_temp.lost('acme_agent1', 'o_ocq4', 'other', 'Closed the practice');
  j := pg_temp.outcome('acme_agent1', 'o_ocq4')::jsonb;
  PERFORM pg_temp.is(j ->> 'lost_reason', 'other', 'the lost reason');
  PERFORM pg_temp.is(j ->> 'lost_note', 'Closed the practice', 'and its note');
  PERFORM pg_temp.is((SELECT string_agg(q ->> 'close_reason', ',' ORDER BY (q ->> 'id')::bigint) FROM jsonb_array_elements(j -> 'quotes') q WHERE q ->> 'close_reason' IS NOT NULL), 'search_ended,search_ended,search_ended', 'the quotes the loss closed say the search ended');
  PERFORM pg_temp.is(j -> 'placement', 'null'::jsonb, 'a lost opportunity has no placement');
END $$;

-- Break caught: the read is wider than the page's: a member of the firm who may not see the account (by level) reads the outcome of its opportunity; another firm's
-- member, a former member, a person of no firm, or a platform admin with no support session does; or the refusal tells them whether the opportunity exists. A support
-- session that may read the page cannot read it; a signed-out caller can call it.
DO $$
DECLARE r text; sess uuid; want text;
BEGIN
  PERFORM pg_temp.account('oc5', 'acme', 'acme_agent2');
  PERFORM pg_temp.quoted('ocq5', 'acme', 'oc5', 'acme_agent2');
  PERFORM pg_temp.won('acme_agent2', 'o_ocq5', pg_temp.qid('ocq5', 'Justworks'), NULL, NULL, 'Acme Brokers');
  want := 'PT404: That opportunity isn''t available';
  PERFORM pg_temp.is(pg_temp.code(pg_temp.outcome('acme_agent2', 'o_ocq5')), 'ok', 'the owner reads it');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.outcome('acme_owner', 'o_ocq5')), 'ok', 'an owner of the firm reads it');
  PERFORM pg_temp.is(pg_temp.outcome('acme_agent1', 'o_ocq5'), want, 'a member of the firm who may not see the account (by level): PT404');
  PERFORM pg_temp.is(pg_temp.outcome('acme_lead2', 'o_ocq5'), want, 'a lead whose team does not reach it');
  PERFORM pg_temp.is(pg_temp.outcome('zenith_owner', 'o_ocq5'), want, 'another firm''s owner, asked at their own firm');
  PERFORM pg_temp.is(pg_temp.as_call('zenith_owner', 'acme-brokers', format('SELECT public.opportunity_outcome(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('o_ocq5'))), want, 'and at Acme''s id');
  PERFORM pg_temp.is(pg_temp.outcome('acme_removed', 'o_ocq5'), want, 'a former member');
  PERFORM pg_temp.is(pg_temp.as_call('nobody', NULL, format('SELECT public.opportunity_outcome(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('o_ocq5'))), want, 'a person of no firm');
  PERFORM pg_temp.is(pg_temp.as_call('platform_admin', NULL, format('SELECT public.opportunity_outcome(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('o_ocq5'))), want, 'a platform admin with no support session');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent2', 'acme-brokers', format('SELECT public.opportunity_outcome(%L, %L)::text', pg_temp.id('acme'), gen_random_uuid())), want, 'an opportunity that is not there: the same answer');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent2', 'acme-brokers', format('SELECT public.opportunity_outcome(NULL, %L)::text', pg_temp.id('o_ocq5'))), want, 'no firm named');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent2', 'acme-brokers', format('SELECT public.opportunity_outcome(%L, NULL)::text', pg_temp.id('acme'))), want, 'no opportunity named');
  -- a support session may read, as the page lets it
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an opportunity the firm asked about') t);
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('platform_admin', 'acme-brokers', format('SELECT public.opportunity_outcome(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('o_ocq5')))), 'ok', 'a Nevermore support session reads it');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  -- the grants: signed-in callers only
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.opportunity_outcome(%L, %L)', pg_temp.id('acme'), pg_temp.id('o_ocq5'))), 5), '42501', 'a signed-out caller may not call it');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT has_function_privilege('authenticated', 'public.opportunity_outcome(uuid, uuid)', 'EXECUTE')), true, 'signed-in callers may');
  PERFORM pg_temp.is((SELECT has_function_privilege('anon', 'public.opportunity_outcome(uuid, uuid)', 'EXECUTE')), false, 'anon may not');
END $$;
