-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh accounts_query
-- The accounts table's query in the database (story CRM-A1.1b; docs/BROKER_CRM_BUILD.md D-24, D-44, D-173, D-186, D-197, D-201, D-206, D-216, D-218, D-219;
-- 20261119130000_accounts_table_query.sql). Two firms are used throughout: Acme (sees by level) and Zenith. Proves, through what the browser calls:
--   1. the list: what a person sees, by their level, one firm at a time; archived accounts only when asked for; the worked-out columns;
--   2. filters, sort, search and pages over the listed fields, and what is refused;
--   3. view counts equal to what the list totals;
--   4. person filters: me, my team (the lead's team and the teams under it), any of;
--   5. the members the Owner filter offers;
--   6. accounts among the saved views' tables and the export's.
-- Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261121085500_leads.sql
\i supabase/migrations/20261121090000_spot_a_duplicate.sql
\i supabase/migrations/20261121095500_create_lead.sql
\i supabase/migrations/20261121100000_merge_records.sql
\i supabase/migrations/20261121110000_account_page_duplicate_mark.sql
\i supabase/migrations/20261121110500_leads_table_query.sql
\i supabase/migrations/20261121140000_leads_keep_commission_history.sql
\i supabase/migrations/20261121150000_epic4_after_merge_records.sql
\i supabase/migrations/20261121160000_start_the_renewal.sql
\i supabase/migrations/20261121170000_opportunity_outcome.sql
\i supabase/migrations/20261122090000_conversations.sql
\i supabase/migrations/20261122100000_peo_authorizations.sql
\i supabase/migrations/20261122100500_conversations_closing.sql
\i supabase/migrations/20261122110000_bundle_links.sql
\i supabase/migrations/20261122130000_conversation_replies.sql
\i supabase/migrations/20261122130500_closing_list_merged.sql
\i supabase/migrations/20261122140000_peo_send.sql
\i supabase/migrations/20261122150000_inbox.sql
\i supabase/migrations/20261122160000_conversation_files.sql
\i supabase/migrations/20261122180000_peo_update.sql
\i supabase/migrations/20261122190000_follow_up_and_withdraw.sql
\i supabase/migrations/20261122200000_peo_registrations.sql
\i supabase/migrations/20261122200500_main_merged.sql
\i supabase/migrations/20261122210000_leads_bulk_and_bin.sql
\i supabase/migrations/20261122220000_lead_page.sql
\i supabase/migrations/20261122230000_request_contact.sql
\i supabase/migrations/20261122240000_lead_alert_and_captcha.sql
\i supabase/migrations/20261122250000_convert_lead.sql
\i supabase/migrations/20261123090000_opportunity_close_withdraw.sql
\i supabase/migrations/20261123100000_quote_statuses.sql
\i supabase/migrations/20261123110000_firm_link.sql
\i supabase/migrations/20261123120000_broker_intake.sql
\i supabase/migrations/20261123120100_broker_intake_columns.sql
\i supabase/migrations/20261123130000_new_quote_account.sql
\i supabase/migrations/20261123180000_quotes_table.sql
\i supabase/migrations/20261123190000_intake_teaches_account.sql
\i supabase/migrations/20261123200000_employer_ends_access.sql
\i supabase/migrations/20261124090000_firm_signup_emails.sql
\i supabase/migrations/20261124100000_new_quote_intake.sql
\i supabase/migrations/20261124110000_employer_sees_firm.sql
\i supabase/migrations/20261124130000_quote_decline_reason.sql
\i supabase/migrations/20261124140000_quote_offer.sql
\i supabase/migrations/20261125090000_quote_document.sql
\i supabase/migrations/20261125100000_reply_suggestions.sql
\i supabase/migrations/20261125110000_quote_comparison.sql


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
SET client_min_messages = notice;

-- ---------- set up: two firms; Acme sees by level; teams (Sales, and Sales East under it); one person in both firms; one whose membership ended ----------
DO $$
DECLARE acme uuid; zenith uuid; sales uuid; east uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Acme Brokers', 'acme-brokers', now()) RETURNING id INTO acme;
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Zenith Benefits', 'zenith-benefits', now()) RETURNING id INTO zenith;
  INSERT INTO fx VALUES ('acme', acme), ('zenith', zenith);
  PERFORM pg_temp.new_user('acme_owner'); PERFORM pg_temp.new_user('acme_lead'); PERFORM pg_temp.new_user('acme_agent1'); PERFORM pg_temp.new_user('acme_agent2');
  PERFORM pg_temp.new_user('acme_agent3'); PERFORM pg_temp.new_user('acme_agent4'); PERFORM pg_temp.new_user('acme_removed'); PERFORM pg_temp.new_user('zenith_owner');
  PERFORM pg_temp.new_user('zenith_agent'); PERFORM pg_temp.new_user('both'); PERFORM pg_temp.new_user('platform_admin'); PERFORM pg_temp.new_user('nobody');
  INSERT INTO public.firm_teams (firm_id, name) VALUES (acme, 'Sales') RETURNING id INTO sales;
  INSERT INTO public.firm_teams (firm_id, name, parent_team_id) VALUES (acme, 'Sales East', sales) RETURNING id INTO east;
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (acme, pg_temp.id('acme_owner'), 'owner', NULL), (acme, pg_temp.id('acme_lead'), 'lead', sales), (acme, pg_temp.id('acme_agent1'), 'agent', NULL),
    (acme, pg_temp.id('acme_agent2'), 'agent', sales), (acme, pg_temp.id('acme_agent3'), 'agent', NULL), (acme, pg_temp.id('acme_agent4'), 'agent', east),
    (acme, pg_temp.id('both'), 'owner', NULL),
    (zenith, pg_temp.id('zenith_owner'), 'owner', NULL), (zenith, pg_temp.id('zenith_agent'), 'agent', NULL), (zenith, pg_temp.id('both'), 'agent', NULL);
  INSERT INTO public.firm_memberships (firm_id, user_id, role, valid_from, valid_until)
  VALUES (acme, pg_temp.id('acme_removed'), 'agent', now() - interval '3 days', now() - interval '1 day');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  -- A name for some people (the sign-up's user data), none for the rest, who are then known by their email.
  UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('full_name', 'Ann Agent') WHERE id = pg_temp.id('acme_agent1');
  UPDATE auth.users SET raw_user_meta_data = jsonb_build_object('name', 'Lena Lead') WHERE id = pg_temp.id('acme_lead');
END $$;

-- ---------- the accounts ----------
-- Acme, by what each is for. Created on a day each (Oct 2026) so that last activity orders them:
--   alpha   agent1's. Two open opportunities (the nearer start is the second), two quotes asked of a PEO and one back, a main contact and another contact
--   beta    agent2's (Sales), lower-case name. Its only opportunity is won: a client, nothing open
--   emile   no owner; a name that starts with a capital outside A-Z
--   gamma   agent3's, archived
--   delta   its owner's membership ended: it reads as no owner
--   echo    agent4's (Sales East, under Sales)
--   zulu    the owner's own, nothing on it
CREATE FUNCTION pg_temp.acct(n text, firm text, p_owner text, nm text, created date, p_extra jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.accounts (source, firm_id, owner_id, name, trade_name, website, city, state, employees, industry, states_of_operation, current_provider, created_at)
  VALUES (COALESCE(p_extra ->> 'source', 'added_by_hand'), pg_temp.id(firm), pg_temp.id(p_owner), nm, p_extra ->> 'trade', p_extra ->> 'site', p_extra ->> 'city', p_extra ->> 'state',
          (p_extra ->> 'employees')::integer, p_extra ->> 'industry', COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_extra -> 'states')), '{}'), p_extra ->> 'provider', created::timestamptz)
  RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

-- A quote request on an intake. Its events are written by a trigger when it is made: the day its status was last set is `status_changed`; every other
-- field's change (a note, the dates) is put much later, and must not count as activity (D-201: editing a field is not activity).
CREATE FUNCTION pg_temp.quote(intake text, peo text, st text, expires date, status_changed date) RETURNS void LANGUAGE plpgsql AS $$
DECLARE q bigint;
BEGIN
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on, quote_expires_on, quote_received_on)
  VALUES (pg_temp.id(intake), peo, st, date '2026-10-01', expires, CASE WHEN st = 'quoted' THEN date '2026-10-02' END) RETURNING id INTO q;
  -- The record is append-only; the fixture sets the days the way a restore would, with triggers off.
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.quote_request_events SET changed_at = CASE WHEN field = 'status' THEN status_changed::timestamptz ELSE timestamptz '2026-11-05 12:00+00' END WHERE quote_request_id = q;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;

DO $$
DECLARE
  alpha uuid; beta uuid; mc uuid; i1 text := 'intake_alpha'; i2 text := 'intake_beta';
BEGIN
  alpha := pg_temp.acct('alpha', 'acme', 'acme_agent1', 'Alpha Co', date '2026-10-01',
    jsonb_build_object('trade', 'Alfa Trading', 'site', 'https://www.alpha-co.example/home', 'city', 'Portland', 'state', 'OR', 'employees', 50, 'industry', 'Retail',
                       'states', jsonb_build_array('OR', 'WA'), 'provider', 'ADP TotalSource'));
  beta := pg_temp.acct('beta', 'acme', 'acme_agent2', 'beta inc', date '2026-10-10', jsonb_build_object('city', 'Seattle', 'state', 'WA', 'employees', 8, 'source', 'employer_intake'));
  PERFORM pg_temp.acct('emile', 'acme', NULL, 'Émile Holdings', date '2026-10-15', jsonb_build_object('industry', 'Consulting'));
  PERFORM pg_temp.acct('gamma', 'acme', 'acme_agent3', 'Gamma LLC', date '2026-10-12', jsonb_build_object('state', 'CA', 'employees', 30));
  UPDATE public.accounts SET archived_at = timestamptz '2026-10-20 00:00+00' WHERE id = pg_temp.id('gamma');
  PERFORM pg_temp.acct('delta', 'acme', 'acme_removed', 'Delta Works', date '2026-10-11', jsonb_build_object('state', 'OR', 'employees', 12));
  PERFORM pg_temp.acct('echo', 'acme', 'acme_agent4', 'Echo Co', date '2026-10-13', jsonb_build_object('state', 'NV', 'employees', 120, 'source', 'import'));
  PERFORM pg_temp.acct('zulu', 'acme', 'acme_owner', 'zulu corp', date '2026-10-14', '{}');
  PERFORM pg_temp.acct('zenith_one', 'zenith', 'zenith_agent', 'Zenith One', date '2026-10-02', jsonb_build_object('state', 'TX', 'employees', 77));
  PERFORM pg_temp.acct('zenith_two', 'zenith', NULL, 'Zenith Two', date '2026-10-03', '{}');
  -- Contacts: alpha's main contact and one other; beta's main contact has only a phone.
  INSERT INTO public.contacts (firm_id, account_id, first_name, last_name, email, phone, is_main)
  VALUES (pg_temp.id('acme'), alpha, 'Ann', 'Alpha', 'ann@alpha-co.example', '503-555-0101', true) RETURNING id INTO mc;
  INSERT INTO fx VALUES ('alpha_main', mc);
  INSERT INTO public.contacts (firm_id, account_id, first_name, last_name, email) VALUES (pg_temp.id('acme'), alpha, 'Zed', 'Zebra', 'zed@zebra.example');
  INSERT INTO public.contacts (firm_id, account_id, first_name, last_name, phone, is_main) VALUES (pg_temp.id('acme'), beta, 'Bea', 'Beta', '206-555-0102', true);
  INSERT INTO public.contacts (firm_id, account_id, last_name, email, is_main) VALUES (pg_temp.id('zenith'), pg_temp.id('zenith_one'), 'Zenithian', 'z@zenith.example', true);
  -- Opportunities: alpha has two open ones (the second, with the intake, starts sooner), beta's is won, zenith one has one.
  PERFORM pg_temp.intake(i1, 'acme'); PERFORM pg_temp.intake(i2, 'acme'); PERFORM pg_temp.intake('intake_zenith', 'zenith');
  INSERT INTO public.opportunities (firm_id, account_id, name, target_start, created_at) VALUES (pg_temp.id('acme'), alpha, 'Alpha later search', date '2027-03-01', timestamptz '2026-10-02 00:00+00') RETURNING id INTO mc;
  INSERT INTO fx VALUES ('opp_alpha_later', mc);
  INSERT INTO public.opportunities (firm_id, account_id, name, target_start, intake_id, created_at)
  VALUES (pg_temp.id('acme'), alpha, 'Alpha sooner search', date '2027-02-01', pg_temp.id(i1), timestamptz '2026-10-03 00:00+00') RETURNING id INTO mc;
  INSERT INTO fx VALUES ('opp_alpha_sooner', mc);
  INSERT INTO public.opportunities (firm_id, account_id, name, intake_id) VALUES (pg_temp.id('acme'), beta, 'Beta search', pg_temp.id(i2));
  INSERT INTO public.opportunities (firm_id, account_id, name, target_start, intake_id)
  VALUES (pg_temp.id('zenith'), pg_temp.id('zenith_one'), 'Zenith search', date '2027-01-01', pg_temp.id('intake_zenith'));
  UPDATE public.submission_workflow SET status = 'sent_to_carrier' WHERE session_id = pg_temp.id(i1);
  UPDATE public.submission_workflow SET status = 'won' WHERE session_id = pg_temp.id(i2);
  UPDATE public.submission_workflow SET status = 'under_review' WHERE session_id = pg_temp.id('intake_zenith');
  -- Quotes on alpha's intake: one back (expires Dec 31), one waiting, one closed; the status changes were on Oct 20, Oct 5 and Oct 6.
  PERFORM pg_temp.quote(i1, 'PEO One', 'quoted', date '2026-12-31', date '2026-10-20');
  PERFORM pg_temp.quote(i1, 'PEO Two', 'sent', NULL, date '2026-10-05');
  PERFORM pg_temp.quote(i1, 'PEO Three', 'closed', NULL, date '2026-10-06');
  -- A quote request of another firm's account, with an activity far later: it must never reach Acme's rows.
  PERFORM pg_temp.quote('intake_zenith', 'PEO Zed', 'quoted', date '2027-06-30', date '2026-11-10');
END $$;

CREATE FUNCTION pg_temp.al(p_firm text, p_filters jsonb DEFAULT '[]', p_sort text DEFAULT NULL, p_dir text DEFAULT 'asc', p_page integer DEFAULT 1, p_search text DEFAULT NULL, p_tz text DEFAULT 'UTC')
RETURNS jsonb LANGUAGE sql AS $$ SELECT public.accounts_list(pg_temp.id(p_firm), p_filters, p_sort, p_dir, p_page, p_search, p_tz) $$;

-- The test's names of the accounts in a page, in the page's order.
CREATE FUNCTION pg_temp.names(j jsonb) RETURNS text[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(f.name ORDER BY r.ord), '{}') FROM jsonb_array_elements(j -> 'rows') WITH ORDINALITY r(v, ord) JOIN fx f ON f.id = (r.v ->> 'id')::uuid
$$;

-- What a person is told by the list at Acme (at its address), or the SQLSTATE they are refused with.
CREATE FUNCTION pg_temp.seen_by(who text, p_filters jsonb DEFAULT '[]') RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.as_user(who, 'acme-brokers');
  BEGIN
    r := array_to_string(pg_temp.names(pg_temp.al('acme', p_filters)), ',');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS r = RETURNED_SQLSTATE;
  END;
  RESET ROLE;
  RETURN r;
END $$;

-- ---------- the list: what a person sees ----------
-- Break caught: the list ignores the visibility helper (an agent sees the firm's accounts, a lead the wrong team's), shows another firm's accounts, shows an
-- archived account in "All", or is answered to a person who is no member. Last activity newest first is the default order.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.seen_by('acme_owner'), 'alpha,emile,zulu,echo,delta,beta', 'an owner sees every account of the firm that is not archived, last activity first');
  PERFORM pg_temp.is(pg_temp.seen_by('acme_lead'), 'echo,beta', 'a lead sees their team''s and the teams under it (agent2 in Sales, agent4 in Sales East)');
  PERFORM pg_temp.is(pg_temp.seen_by('acme_agent1'), 'alpha', 'an agent sees their own');
  PERFORM pg_temp.is(pg_temp.seen_by('acme_agent2'), 'beta', 'another agent sees theirs');
  PERFORM pg_temp.is(pg_temp.seen_by('acme_agent3'), '', 'an agent whose only account is archived sees nothing in All');
  PERFORM pg_temp.is(pg_temp.seen_by('acme_removed'), '42501', 'a former member is refused');
  PERFORM pg_temp.is(pg_temp.seen_by('zenith_owner'), '42501', 'another firm''s owner is refused at this firm');
  PERFORM pg_temp.is(pg_temp.seen_by('platform_admin'), '42501', 'a platform admin who is no member is refused');
  PERFORM pg_temp.is(pg_temp.seen_by('nobody'), '42501', 'a signed-in person with no firm is refused');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.accounts_list(%L)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'a signed-out caller cannot run it');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: who sees what passed';
END $$;

-- ---------- what the list agrees with row security on ----------
-- Break caught: the list shows an account the table's own policy would not (so a person reads through the list what they can't read from the table), or leaves
-- out one they can.
DO $$
DECLARE who text; from_list uuid[]; from_table uuid[];
BEGIN
  FOREACH who IN ARRAY ARRAY['acme_owner', 'acme_lead', 'acme_agent1', 'acme_agent2', 'acme_agent3', 'both'] LOOP
    PERFORM pg_temp.as_user(who, 'acme-brokers');
    SELECT COALESCE(array_agg((r ->> 'id')::uuid ORDER BY (r ->> 'id')::uuid), '{}') INTO from_list FROM jsonb_array_elements(pg_temp.al('acme', '[{"field":"archived","op":"is","value":false}]') -> 'rows') r;
    SELECT COALESCE(array_agg(a.id ORDER BY a.id), '{}') INTO from_table FROM public.accounts a WHERE a.archived_at IS NULL;
    PERFORM pg_temp.is(from_list, from_table, who || ' sees the accounts the table shows them');
    SELECT COALESCE(array_agg((r ->> 'id')::uuid ORDER BY (r ->> 'id')::uuid), '{}') INTO from_list FROM jsonb_array_elements(pg_temp.al('acme', '[{"field":"archived","op":"is","value":true}]') -> 'rows') r;
    SELECT COALESCE(array_agg(a.id ORDER BY a.id), '{}') INTO from_table FROM public.accounts a WHERE a.archived_at IS NOT NULL;
    PERFORM pg_temp.is(from_list, from_table, who || ' sees the archived accounts the table shows them');
  END LOOP;
  RESET ROLE;
  RAISE NOTICE 'accounts_query: the list agrees with row security';
END $$;

-- ---------- one firm at a time ----------
-- Break caught: a person of two firms is shown both firms' accounts together, or one firm's through the other firm's address, or a guess is made of
-- the firm when the person has two.
DO $$
BEGIN
  PERFORM pg_temp.as_user('both', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.al('acme')), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'at Acme''s address an owner of Acme sees Acme''s accounts');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.accounts_list(%L)$q$, pg_temp.id('zenith'))) LIKE '42501:%', true, 'but at Acme''s address Zenith''s accounts are not theirs to ask for');
  PERFORM pg_temp.is(pg_temp.names(public.accounts_list(NULL)), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'asking for no firm at a firm''s address is that firm');
  PERFORM pg_temp.as_user('both', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.al('zenith')), '{}'::text[], 'at Zenith''s address they are an agent there and own nothing: they see none of Zenith''s accounts, and none of Acme''s');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.accounts_list(%L)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'and Acme''s are not theirs to ask for at Zenith''s address');
  PERFORM pg_temp.as_user('both');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.accounts_list(NULL)'), '22023: You belong to more than one firm: say which', 'on the bare domain, asking for no firm is refused: the database never guesses');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.al('acme')), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'naming the firm gives only that firm''s accounts');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.al('zenith')), ARRAY['zenith_one', 'zenith_two'], 'Zenith''s owner sees Zenith''s own, newest activity first (a quote''s status change on Nov 10 puts Zenith One first)');
  RESET ROLE;
END $$;

-- ---------- the worked-out columns ----------
-- Break caught: the main contact is not the one marked; the opportunity shown is not the open one with the nearest target start, or "more" miscounts; a
-- closed quote request counts as sent; the quotes are another account's; the status is not account_status; last activity is a field's edit; the owner
-- is shown once their membership ended.
CREATE FUNCTION pg_temp.row_of(n text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT r FROM jsonb_array_elements(pg_temp.al('acme', '[]', NULL, 'asc', 1, NULL) -> 'rows') r WHERE (r ->> 'id')::uuid = pg_temp.id(n)
$$;
DO $$
DECLARE a jsonb; b jsonb; all_rows jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  a := pg_temp.row_of('alpha');
  PERFORM pg_temp.is(a ->> 'name', 'Alpha Co', 'the name');
  PERFORM pg_temp.is(a ->> 'trade_name', 'Alfa Trading', 'the trade name');
  PERFORM pg_temp.is(a ->> 'city' || ', ' || (a ->> 'state'), 'Portland, OR', 'the city and state');
  PERFORM pg_temp.is((a ->> 'employees')::integer, 50, 'employees');
  PERFORM pg_temp.is(a ->> 'industry', 'Retail', 'industry');
  PERFORM pg_temp.is(a -> 'states_of_operation', '["OR", "WA"]'::jsonb, 'states of operation');
  PERFORM pg_temp.is(a ->> 'current_provider', 'ADP TotalSource', 'current provider');
  PERFORM pg_temp.is(a ->> 'source', 'added_by_hand', 'source');
  PERFORM pg_temp.is(a ->> 'status', 'prospect', 'a prospect account');
  PERFORM pg_temp.is((a ->> 'archived')::boolean, false, 'not archived');
  PERFORM pg_temp.is(a ->> 'owner', pg_temp.id('acme_agent1')::text, 'the owner''s id');
  PERFORM pg_temp.is(a ->> 'owner_name', 'Ann Agent', 'the owner by the name in their sign-up');
  PERFORM pg_temp.is((a ->> 'main_contact_id')::uuid, pg_temp.id('alpha_main'), 'the main contact is the one marked, not the other contact');
  PERFORM pg_temp.is(a ->> 'main_contact_name', 'Ann Alpha', 'the main contact''s name');
  PERFORM pg_temp.is(a ->> 'main_contact_email', 'ann@alpha-co.example', 'with their email');
  PERFORM pg_temp.is(a ->> 'main_contact_phone', '503-555-0101', 'and phone');
  PERFORM pg_temp.is((a ->> 'opportunity_id')::uuid, pg_temp.id('opp_alpha_sooner'), 'the open opportunity with the nearest target start');
  PERFORM pg_temp.is(a ->> 'opportunity_name', 'Alpha sooner search', 'its name');
  PERFORM pg_temp.is(a ->> 'opportunity_stage', 'in_market', 'its stage, from its submission (D-206)');
  PERFORM pg_temp.is(a ->> 'target_start', '2027-02-01', 'its target start');
  PERFORM pg_temp.is((a ->> 'open_opportunities')::integer, 2, 'two are open, so the page says "+1 more"');
  PERFORM pg_temp.is((a ->> 'quote_requests_sent')::integer, 2, 'two quotes asked for that are still live: a closed one is not counted');
  PERFORM pg_temp.is((a ->> 'quotes_received')::integer, 1, 'one of them back');
  PERFORM pg_temp.is(a ->> 'earliest_quote_expires_on', '2026-12-31', 'its expiry');
  PERFORM pg_temp.is((a ->> 'waiting_on_peo')::boolean, true, 'one still waiting on a PEO');
  PERFORM pg_temp.is((a ->> 'last_activity_at')::timestamptz, timestamptz '2026-10-20 00:00+00', 'last activity is the newest quote status change, not the later edits of other fields');
  b := pg_temp.row_of('beta');
  PERFORM pg_temp.is(b ->> 'status', 'client', 'a won opportunity makes a client');
  PERFORM pg_temp.is(b ->> 'opportunity_id', NULL, 'a won opportunity is not open: none is shown');
  PERFORM pg_temp.is((b ->> 'open_opportunities')::integer, 0, 'none open');
  PERFORM pg_temp.is(b ->> 'main_contact_name', 'Bea Beta', 'a main contact with only a phone');
  PERFORM pg_temp.is(b ->> 'main_contact_email', NULL, 'has no email');
  PERFORM pg_temp.is(b ->> 'main_contact_phone', '206-555-0102', 'and their phone');
  PERFORM pg_temp.is(b ->> 'source', 'employer_intake', 'the source');
  PERFORM pg_temp.is((b ->> 'quote_requests_sent')::integer, 0, 'no quotes');
  PERFORM pg_temp.is(b ->> 'earliest_quote_expires_on', NULL, 'and no expiry');
  PERFORM pg_temp.is((b ->> 'last_activity_at')::timestamptz, timestamptz '2026-10-10 00:00+00', 'with no activity but its making, last activity is its creation');
  PERFORM pg_temp.is((pg_temp.row_of('emile') ->> 'owner'), NULL, 'an account with no owner');
  PERFORM pg_temp.is((pg_temp.row_of('emile') ->> 'main_contact_id'), NULL, 'no main contact');
  PERFORM pg_temp.is((pg_temp.row_of('delta') ->> 'owner'), NULL, 'an account whose owner''s membership ended reads as no owner');
  PERFORM pg_temp.is((pg_temp.row_of('delta') ->> 'owner_name'), NULL, 'and does not name them');
  PERFORM pg_temp.is((pg_temp.row_of('echo') ->> 'owner_name'), 'acme_agent4@example.test', 'a person with no name is known by their email');
  PERFORM pg_temp.is((pg_temp.row_of('zulu') ->> 'status'), 'prospect', 'an account with nothing on it is a prospect account');
  -- the worked-out columns agree with the records' own functions (which no API role may run), for every account
  all_rows := pg_temp.al('acme', '[]') -> 'rows';
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(all_rows) r
                      WHERE r ->> 'status' IS DISTINCT FROM public.account_status((r ->> 'id')::uuid)), 0::bigint, 'every status is account_status''s');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(all_rows) r
                      WHERE r ->> 'opportunity_id' IS NOT NULL AND r ->> 'opportunity_stage' IS DISTINCT FROM public.opportunity_stage((r ->> 'opportunity_id')::uuid)), 0::bigint,
                     'every stage is opportunity_stage''s');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: the worked-out columns passed';
END $$;

-- ---------- filters ----------
-- The names a list gives for these filters, sort and search, as Acme's owner (who sees all of Acme's accounts) at Acme's address.
CREATE FUNCTION pg_temp.f(p_filters jsonb DEFAULT '[]', p_sort text DEFAULT NULL, p_dir text DEFAULT 'asc', p_page integer DEFAULT 1, p_search text DEFAULT NULL, p_tz text DEFAULT 'UTC') RETURNS text[] LANGUAGE sql AS $$
  SELECT pg_temp.names(pg_temp.al('acme', p_filters, p_sort, p_dir, p_page, p_search, p_tz))
$$;
CREATE FUNCTION pg_temp.f(p_filters text) RETURNS text[] LANGUAGE sql AS $$ SELECT pg_temp.f(p_filters::jsonb) $$;
CREATE FUNCTION pg_temp.total(p_filters jsonb DEFAULT '[]', p_search text DEFAULT NULL) RETURNS bigint LANGUAGE sql AS $$
  SELECT (pg_temp.al('acme', p_filters, NULL, 'asc', 1, p_search) ->> 'total')::bigint
$$;
-- A refusal of this SQLSTATE whose message holds these words.
CREATE FUNCTION pg_temp.refused(stmt text, code text, words text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text := pg_temp.refusal(stmt);
BEGIN
  IF r NOT LIKE code || ': %' OR strpos(r, words) = 0 THEN RAISE EXCEPTION 'FAIL: % gave %, expected % with "%"', label, r, code, words; END IF;
END $$;
CREATE FUNCTION pg_temp.q(p_filters jsonb, p_sort text DEFAULT NULL, p_dir text DEFAULT 'asc') RETURNS jsonb LANGUAGE sql AS $$ SELECT pg_temp.al('acme', p_filters, p_sort, p_dir) $$;

-- Break caught: a filter on a field the table lists reads the wrong column or the wrong operator; the archived rule leaks archived accounts into other
-- views; a date is read in the wrong day; a field the list does not hold (an id, a firm, the main contact) is let through.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  -- text
  PERFORM pg_temp.is(pg_temp.f('[{"field":"name","op":"contains","value":"CO"}]'), ARRAY['alpha', 'zulu', 'echo'], 'a name contains, ignoring case');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"name","op":"is","value":" BETA INC "}]'), ARRAY['beta'], 'a name is, ignoring case and surrounding spaces');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"trade_name","op":"is","value":"alfa trading"}]'), ARRAY['alpha'], 'the trade name');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"trade_name","op":"is_empty"}]'), ARRAY['emile', 'zulu', 'echo', 'delta', 'beta'], 'accounts with no trade name');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"website","op":"contains","value":"alpha-co"}]'), ARRAY['alpha'], 'the website');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"city","op":"is","value":"seattle"}]'), ARRAY['beta'], 'the city');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"industry","op":"contains","value":"consult"}]'), ARRAY['emile'], 'the industry');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"current_provider","op":"contains","value":"adp"}]'), ARRAY['alpha'], 'the current provider');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"opportunity_name","op":"contains","value":"sooner"}]'), ARRAY['alpha'], 'the open opportunity''s name: the one the column shows');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"opportunity_name","op":"contains","value":"later"}]'), '{}'::text[], 'not the other open opportunity''s');
  -- number
  PERFORM pg_temp.is(pg_temp.f('[{"field":"employees","op":"more_than","value":40}]'), ARRAY['alpha', 'echo'], 'employees more than');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"employees","op":"less_than","value":12}]'), ARRAY['beta'], 'employees less than');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"employees","op":"between","value":[12,8]}]'), ARRAY['delta', 'beta'], 'employees between, the ends in either order and included');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"employees","op":"is","value":8}]'), ARRAY['beta'], 'employees is');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"open_opportunities","op":"more_than","value":0}]'), ARRAY['alpha'], 'open opportunities');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"open_opportunities","op":"is","value":0}]'), ARRAY['emile', 'zulu', 'echo', 'delta', 'beta'], 'none open (a won opportunity is not open)');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"quote_requests_sent","op":"is","value":2}]'), ARRAY['alpha'], 'quotes asked for');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"quotes_received","op":"more_than","value":0}]'), ARRAY['alpha'], 'quotes back');
  -- date: a moment is the day it falls on for the caller
  PERFORM pg_temp.is(pg_temp.f('[{"field":"created_at","op":"between","value":["2026-10-10","2026-10-12"]}]'), ARRAY['delta', 'beta'], 'created between two days');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"created_at","op":"on","value":"2026-10-10"}]'), ARRAY['beta'], 'created on a day, in UTC');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"created_at","op":"on","value":"2026-10-10"}]', NULL, 'asc', 1, NULL, 'America/Los_Angeles'), ARRAY['delta'], 'the same day is another account in Los Angeles, where midnight UTC is the evening before');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"last_activity_at","op":"on","value":"2026-10-20"}]'), ARRAY['alpha'], 'last activity on a day');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"last_activity_at","op":"before","value":"2026-10-12"}]'), ARRAY['delta', 'beta'], 'last activity before a day');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"target_start","op":"before","value":"2027-03-01"}]'), ARRAY['alpha'], 'the target start of the open opportunity shown (Feb 1, not Mar 1)');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"earliest_quote_expires_on","op":"on","value":"2026-12-31"}]'), ARRAY['alpha'], 'the nearest expiry');
  -- choices
  PERFORM pg_temp.is(pg_temp.f('[{"field":"state","op":"any_of","value":["or"]}]'), ARRAY['alpha', 'delta'], 'state is any of, ignoring case');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"state","op":"none_of","value":["OR","WA"]}]'), ARRAY['emile', 'zulu', 'echo'], 'state is none of keeps those with none');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"state","op":"is_empty"}]'), ARRAY['emile', 'zulu'], 'state is empty');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"source","op":"any_of","value":["import","employer_intake"]}]'), ARRAY['echo', 'beta'], 'the source');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"status","op":"any_of","value":["client"]}]'), ARRAY['beta'], 'a client');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"status","op":"any_of","value":["prospect"]}]'), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta'], 'a prospect account');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"opportunity_stage","op":"any_of","value":["in_market"]}]'), ARRAY['alpha'], 'the open opportunity''s stage');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"opportunity_stage","op":"is_empty"}]'), ARRAY['emile', 'zulu', 'echo', 'delta', 'beta'], 'no open opportunity');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"states_of_operation","op":"any_of","value":["wa"]}]'), ARRAY['alpha'], 'states of operation holds any of');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"states_of_operation","op":"is_empty"}]'), ARRAY['emile', 'zulu', 'echo', 'delta', 'beta'], 'states of operation is empty');
  -- yes or no
  PERFORM pg_temp.is(pg_temp.f('[{"field":"waiting_on_peo","op":"is","value":true}]'), ARRAY['alpha'], 'waiting on a PEO');
  PERFORM pg_temp.is(pg_temp.total('[{"field":"waiting_on_peo","op":"is","value":false}]'), 5::bigint, 'not waiting');
  -- archived: left out of every view unless asked for
  PERFORM pg_temp.is(pg_temp.f('[{"field":"archived","op":"is","value":true}]'), ARRAY['gamma'], 'archived is yes: only the archived ones');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"archived","op":"is","value":false}]'), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'archived is no: the rest');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"state","op":"any_of","value":["CA"]}]'), '{}'::text[], 'an archived account is in no other view, whatever matches it');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"state","op":"any_of","value":["CA"]},{"field":"archived","op":"is","value":true}]'), ARRAY['gamma'], 'and is found again with the archived filter');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"employees","op":"more_than","value":0},{"field":"status","op":"any_of","value":["prospect"]}]'), ARRAY['alpha', 'echo', 'delta'], 'filters combine with and');
  PERFORM pg_temp.is(pg_temp.total('null'), 6::bigint, 'a JSON null is no filters');
  PERFORM pg_temp.is(pg_temp.total(NULL), 6::bigint, 'nor is NULL');
  -- what is refused
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"firm_id","op":"is","value":"x"}]')$q$, '22023', 'The accounts table has no field "firm_id"', 'a column not in the list is refused');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"id","op":"is","value":"x"}]')$q$, '22023', 'no field "id"', 'the account''s id is not a field');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"owner_id","op":"me"}]')$q$, '22023', 'no field "owner_id"', 'the owner is the field "owner"');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"main_contact","op":"contains","value":"ann"}]')$q$, '22023', 'no field "main_contact"', 'the main contact has no filter');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"name; DROP TABLE accounts","op":"is","value":"x"}]')$q$, '22023', 'no field', 'a field is a name, never SQL');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"employees","op":"contains","value":"x"}]')$q$, '22023', 'A number field can''t be filtered with "contains"', 'an operator the kind has not is refused');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"state","op":"any_of","value":["ZZ"]}]')$q$, '22023', 'state codes', 'a state that does not exist is refused');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"states_of_operation","op":"any_of","value":["Oregon"]}]')$q$, '22023', 'state codes', 'a state is its code');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"source","op":"any_of","value":["bogus"]}]')$q$, '22023', 'isn''t one of the field''s values', 'a source that does not exist is refused');
  PERFORM pg_temp.q('[{"field":"status","op":"any_of","value":["former_client"]}]'); -- a former client has arrived with the placement record (CRM-A2.4a, D-197): the value is accepted
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"opportunity_stage","op":"any_of","value":["won"]}]')$q$, '22023', 'isn''t one of the field''s values', 'an open opportunity is never won or lost');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"owner","op":"is","value":"x"}]')$q$, '22023', 'A person field can''t be filtered with "is"', 'a person has any of, me and my team');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('{"field":"name","op":"is_empty"}')$q$, '22023', 'Filters are a list', 'filters that are not a list are refused');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q((SELECT jsonb_agg('{"field":"name","op":"is_empty"}'::jsonb) FROM generate_series(1, 21)))$q$, '22023', 'at most 20', 'more than 20 filters are refused');
  PERFORM pg_temp.refused($q$SELECT pg_temp.al('acme', '[]', NULL, 'asc', 1, NULL, 'PST')$q$, '22023', 'Unknown time zone', 'a time zone that is an abbreviation is refused');
  -- a value that looks like SQL is only a value
  PERFORM pg_temp.is(pg_temp.f('[{"field":"name","op":"contains","value":"x''; DROP TABLE public.accounts; --"}]'), '{}'::text[], 'a value with quotes and SQL in it matches nothing');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'x''; DROP TABLE public.accounts; --'), '{}'::text[], 'nor does a search');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), 9::bigint, 'and no account is gone');
  RAISE NOTICE 'accounts_query: filters passed';
END $$;

-- ---------- sort ----------
-- Break caught: text sorts by code point (so Émile follows zulu) or by case (beta after Echo); a sort by number or date reads another column; empty values
-- come first when descending; equal values and the unsorted table are not in last activity order; the main contact can be sorted by.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.f(), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'no sort: last activity, newest first');
  PERFORM pg_temp.is(pg_temp.f('[]', 'last_activity_at', 'desc'), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'last activity, newest first, asked for');
  PERFORM pg_temp.is(pg_temp.f('[]', 'last_activity_at', 'asc'), ARRAY['beta', 'delta', 'echo', 'zulu', 'emile', 'alpha'], 'last activity, oldest first');
  PERFORM pg_temp.is(pg_temp.f('[]', 'name', 'asc'), ARRAY['alpha', 'beta', 'delta', 'echo', 'emile', 'zulu'], 'name: the alphabet, case ignored, "Émile" after "Echo" and before "zulu"');
  PERFORM pg_temp.is(pg_temp.f('[]', 'name', 'desc'), ARRAY['zulu', 'emile', 'echo', 'delta', 'beta', 'alpha'], 'name, descending');
  PERFORM pg_temp.is(pg_temp.f('[]', 'employees', 'asc'), ARRAY['beta', 'delta', 'alpha', 'echo', 'emile', 'zulu'], 'employees, the empty ones last (and in last activity order)');
  PERFORM pg_temp.is(pg_temp.f('[]', 'employees', 'desc'), ARRAY['echo', 'alpha', 'delta', 'beta', 'emile', 'zulu'], 'employees, descending: the empty ones still last');
  PERFORM pg_temp.is(pg_temp.f('[]', 'created_at', 'asc'), ARRAY['alpha', 'beta', 'delta', 'echo', 'zulu', 'emile'], 'created');
  PERFORM pg_temp.is(pg_temp.f('[]', 'state', 'asc'), ARRAY['echo', 'alpha', 'delta', 'beta', 'emile', 'zulu'], 'state (NV, OR, OR, WA, then none)');
  PERFORM pg_temp.is(pg_temp.f('[]', 'owner', 'asc'), ARRAY['beta', 'echo', 'zulu', 'alpha', 'emile', 'delta'], 'owner by their name; no owner (and one whose membership ended) last');
  PERFORM pg_temp.is(pg_temp.f('[]', 'owner', 'desc'), ARRAY['alpha', 'zulu', 'echo', 'beta', 'emile', 'delta'], 'owner, descending: no owner still last');
  PERFORM pg_temp.is(pg_temp.f('[]', 'source', 'asc'), ARRAY['beta', 'alpha', 'emile', 'zulu', 'delta', 'echo'], 'source: by its place in the list (Employer''s intake, Added by hand, New quote, Lead, Import), not by its code');
  PERFORM pg_temp.is(pg_temp.f('[]', 'source', 'desc'), ARRAY['echo', 'alpha', 'emile', 'zulu', 'delta', 'beta'], 'source, descending');
  PERFORM pg_temp.is(pg_temp.f('[]', 'status', 'asc'), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'status: prospects before clients');
  PERFORM pg_temp.is(pg_temp.f('[]', 'status', 'desc'), ARRAY['beta', 'alpha', 'emile', 'zulu', 'echo', 'delta'], 'status, descending');
  PERFORM pg_temp.is(pg_temp.f('[]', 'opportunity_stage', 'asc'), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'stage: the one with an open opportunity first, the rest last');
  PERFORM pg_temp.is(pg_temp.f('[]', 'target_start', 'desc'), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'target start');
  PERFORM pg_temp.is(pg_temp.f('[]', 'earliest_quote_expires_on', 'asc'), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'nearest expiry');
  PERFORM pg_temp.is(pg_temp.f('[]', 'quote_requests_sent', 'desc'), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'quotes asked for');
  PERFORM pg_temp.is(pg_temp.f('[]', 'waiting_on_peo', 'desc'), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'waiting on a PEO');
  PERFORM pg_temp.is(pg_temp.f('[]', 'states_of_operation', 'asc'), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'states of operation');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"archived","op":"is","value":true}]', 'name', 'asc'), ARRAY['gamma'], 'the archived view sorts too');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[]', 'main_contact')$q$, '22023', 'no field "main_contact" to sort by', 'the main contact is not sorted by (CRM-A1.1)');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[]', 'main_contact_name')$q$, '22023', 'to sort by', 'nor its name');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[]', 'id')$q$, '22023', 'no field "id" to sort by', 'nor the id');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[]', 'name; DROP TABLE accounts')$q$, '22023', 'to sort by', 'a sort is a field''s name, never SQL');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[]', 'name', 'sideways')$q$, '22023', 'asc or desc', 'a direction is asc or desc');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[]', 'name', NULL)$q$, '22023', 'asc or desc', 'and not nothing');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: sort passed';
END $$;

-- ---------- search ----------
-- Break caught: a search misses the trade name, the web domain or a contact's name or email; reads a character as a pattern; finds another firm's
-- contact or one the person may not see; or leaks an archived account into a view.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'alpha'), ARRAY['alpha'], 'by account name');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, '  ALPHA  '), ARRAY['alpha'], 'ignoring case and surrounding spaces');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'alfa'), ARRAY['alpha'], 'by trade name');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'alpha-co.example'), ARRAY['alpha'], 'by web domain');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'https://www.alpha-co.example/home'), ARRAY['alpha'], 'by a web address pasted whole');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'www.alpha-co.example'), ARRAY['alpha'], 'by a web address with www');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'ann alpha'), ARRAY['alpha'], 'by a contact''s name');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'zebra'), ARRAY['alpha'], 'by a contact who is not the main one');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'zed@zebra.example'), ARRAY['alpha'], 'by a contact''s email');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'bea'), ARRAY['beta'], 'a contact with only a phone, by name');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'ann zebra'), ARRAY['alpha'], 'every word, anywhere in the account or its contacts');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'alpha nothing'), '{}'::text[], 'a word that is nowhere is no match');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'émile'), ARRAY['emile'], 'a name with an accent');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, '   '), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'blanks are no search');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, NULL), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'nor is nothing');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, '%'), '{}'::text[], 'a percent sign is a character, not a pattern');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'al_ha'), '{}'::text[], 'nor is an underscore');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'zenithian'), '{}'::text[], 'another firm''s contact is not found');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'zenith'), '{}'::text[], 'nor another firm''s account');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'gamma'), '{}'::text[], 'an archived account is not found in the table');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"archived","op":"is","value":true}]', NULL, 'asc', 1, 'gamma'), ARRAY['gamma'], 'but is in the Archived view');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"status","op":"any_of","value":["prospect"]}]', NULL, 'asc', 1, 'co'), ARRAY['alpha', 'zulu', 'echo'], 'a search and a filter together');
  PERFORM pg_temp.is(pg_temp.total('[]', 'co'), 3::bigint, 'the total counts what the search matches');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'alpha'), '{}'::text[], 'an agent searching for another''s account finds nothing');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'zebra'), '{}'::text[], 'nor another''s contact');
  PERFORM pg_temp.is(pg_temp.f('[]', NULL, 'asc', 1, 'bea'), ARRAY['beta'], 'but their own''s contact');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: search passed';
END $$;

-- ---------- pages ----------
-- A firm of its own with 120 accounts, all in one city, so a sort by city has only ties.
-- Break caught: a page holds other than 50; a page past the end is an error or has another total; equal values put a row on two pages or none.
DO $$
DECLARE firm uuid; pg integer; seen uuid[] := '{}'; ids uuid[]; j jsonb;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Bulk Brokers', 'bulk-brokers', now()) RETURNING id INTO firm;
  INSERT INTO fx VALUES ('bulk', firm);
  PERFORM pg_temp.new_user('bulk_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (firm, pg_temp.id('bulk_owner'), 'owner');
  INSERT INTO public.accounts (source, firm_id, name, city, created_at)
  SELECT 'import', firm, 'Bulk ' || lpad(n::text, 3, '0'), 'Same', timestamptz '2026-01-01 00:00+00' + (n || ' minutes')::interval FROM generate_series(1, 120) n;
  PERFORM pg_temp.as_user('bulk_owner', 'bulk-brokers');
  j := pg_temp.al('bulk');
  PERFORM pg_temp.is(jsonb_array_length(j -> 'rows'), 50, 'a page holds 50');
  PERFORM pg_temp.is(j ->> 'total', '120', 'with the total of all');
  PERFORM pg_temp.is((j ->> 'page_size')::integer, 50, 'and says the size');
  PERFORM pg_temp.is(j -> 'rows' -> 0 ->> 'name', 'Bulk 120', 'newest activity first');
  FOREACH pg IN ARRAY ARRAY[1, 2, 3] LOOP
    j := pg_temp.al('bulk', '[]', 'city', 'asc', pg);
    SELECT array_agg((r ->> 'id')::uuid) INTO ids FROM jsonb_array_elements(j -> 'rows') r;
    PERFORM pg_temp.is(jsonb_array_length(j -> 'rows'), CASE WHEN pg = 3 THEN 20 ELSE 50 END, 'page ' || pg || ' of a sort of ties');
    PERFORM pg_temp.is(ids && seen, false, 'page ' || pg || ' shares no row with an earlier page');
    seen := seen || ids;
    PERFORM pg_temp.is((j ->> 'page')::integer, pg, 'the page asked for is the page given');
  END LOOP;
  PERFORM pg_temp.is(cardinality(seen), 120, 'the pages together hold every row once');
  j := pg_temp.al('bulk', '[]', NULL, 'asc', 4);
  PERFORM pg_temp.is(jsonb_array_length(j -> 'rows'), 0, 'a page past the end has no rows');
  PERFORM pg_temp.is(j ->> 'total', '120', 'and the same total');
  PERFORM pg_temp.is(pg_temp.al('bulk', '[{"field":"name","op":"contains","value":"bulk 11"}]') ->> 'total', '10', 'the total is of what matches');
  PERFORM pg_temp.refused($q$SELECT pg_temp.al('bulk', '[]', NULL, 'asc', 0)$q$, '22023', '1 to 100000', 'page 0 is refused');
  PERFORM pg_temp.refused($q$SELECT pg_temp.al('bulk', '[]', NULL, 'asc', 100001)$q$, '22023', '1 to 100000', 'a page beyond the limit is refused');
  PERFORM pg_temp.is(pg_temp.al('bulk', '[]', NULL, 'asc', NULL) ->> 'page', '1', 'no page is page 1');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: pages passed';
END $$;

-- ---------- view counts ----------
-- Break caught: a tab counts what its rows would not show (another firm's, another person's, archived ones outside Archived), or a refused filter is
-- dropped from a view.
CREATE FUNCTION pg_temp.views() RETURNS jsonb LANGUAGE sql AS $$
  SELECT '[{"name":"All","filters":[]},
           {"name":"Open opportunities","filters":[{"field":"open_opportunities","op":"more_than","value":0}]},
           {"name":"Waiting on quotes","filters":[{"field":"waiting_on_peo","op":"is","value":true}]},
           {"name":"Clients","filters":[{"field":"status","op":"any_of","value":["client"]}]},
           {"name":"Archived","filters":[{"field":"archived","op":"is","value":true}]}]'::jsonb
$$;
CREATE FUNCTION pg_temp.counts(p_firm text, p_views jsonb, p_search text DEFAULT NULL, p_tz text DEFAULT 'UTC') RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(view_name || '=' || total, ', ') FROM public.accounts_view_counts(pg_temp.id(p_firm), p_views, p_search, p_tz)
$$;
DO $$
DECLARE who text; v jsonb; got text; want text;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.counts('acme', pg_temp.views()), 'All=6, Open opportunities=1, Waiting on quotes=1, Clients=1, Archived=1', 'an owner''s tabs, in the order asked');
  PERFORM pg_temp.is(pg_temp.counts('acme', pg_temp.views(), 'co'), 'All=3, Open opportunities=1, Waiting on quotes=1, Clients=0, Archived=0', 'under a search');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.counts('acme', pg_temp.views()), 'All=2, Open opportunities=0, Waiting on quotes=0, Clients=1, Archived=0', 'a lead''s tabs count only what the lead sees');
  PERFORM pg_temp.as_user('acme_agent3', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.counts('acme', pg_temp.views()), 'All=0, Open opportunities=0, Waiting on quotes=0, Clients=0, Archived=1', 'an agent with only an archived account');
  -- every tab equals what the list totals under the same filters, for every kind of person
  FOREACH who IN ARRAY ARRAY['acme_owner', 'acme_lead', 'acme_agent1', 'acme_agent2', 'acme_agent3', 'both'] LOOP
    PERFORM pg_temp.as_user(who, 'acme-brokers');
    FOR v IN SELECT e FROM jsonb_array_elements(pg_temp.views()) e LOOP
      got := pg_temp.counts('acme', jsonb_build_array(v), 'o');
      want := (v ->> 'name') || '=' || (pg_temp.al('acme', v -> 'filters', NULL, 'asc', 1, 'o') ->> 'total');
      PERFORM pg_temp.is(got, want, who || '''s tab "' || (v ->> 'name') || '" equals the list''s total');
    END LOOP;
  END LOOP;
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.refused($q$SELECT pg_temp.counts('acme', '[{"name":"A","filters":[{"field":"main_contact","op":"is_empty"}]}]')$q$, '22023', 'View "A": The accounts table has no field "main_contact"', 'a refused filter refuses the call and names the view');
  PERFORM pg_temp.refused($q$SELECT pg_temp.counts('acme', '[{"name":"A"},{"name":"A"}]')$q$, '22023', 'Two views are named "A"', 'names are unique');
  PERFORM pg_temp.refused($q$SELECT pg_temp.counts('acme', '[]')$q$, '22023', '1 to 20', 'at least one view');
  PERFORM pg_temp.refused($q$SELECT pg_temp.counts('acme', (SELECT jsonb_agg(jsonb_build_object('name', n)) FROM generate_series(1, 21) n))$q$, '22023', '1 to 20', 'at most 20');
  PERFORM pg_temp.refused($q$SELECT pg_temp.counts('acme', '[{"name":"A","fields":[]}]')$q$, '22023', 'a name and its filters', 'a view holds a name and its filters, nothing else');
  PERFORM pg_temp.refused($q$SELECT pg_temp.counts('acme', '[{"name":" "}]')$q$, '22023', '1 to 100 characters', 'a name is not blank');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.accounts_view_counts(%L, %L)$q$, pg_temp.id('acme'), pg_temp.views())) LIKE '42501:%', true, 'another firm''s owner is refused');
  PERFORM pg_temp.as_user('acme_removed', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.accounts_view_counts(%L, %L)$q$, pg_temp.id('acme'), pg_temp.views())) LIKE '42501:%', true, 'a former member is refused');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.accounts_view_counts(%L, %L)$q$, pg_temp.id('acme'), pg_temp.views())) LIKE '42501:%', true, 'a signed-out caller is refused');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: view counts passed';
END $$;

-- ---------- person filters (D-173) ----------
-- Break caught: "me" is another person; "my team" is only the lead's own team, or leaves out the teams under it, or shows what the lead may not see;
-- "any of" shows an account the person may not see, or one whose owner has left; a person filter is let through for a field that has none.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"owner","op":"me"}]'), ARRAY['zulu'], 'me is the account''s owner (an owner''s own account)');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"owner","op":"my_team"}]'), '{}'::text[], 'an owner who is on no team has no team');
  PERFORM pg_temp.is(pg_temp.f(format('[{"field":"owner","op":"any_of","value":["%s","%s"]}]', pg_temp.id('acme_agent1'), pg_temp.id('acme_agent4'))), ARRAY['alpha', 'echo'], 'any of two people');
  PERFORM pg_temp.is(pg_temp.f(format('[{"field":"owner","op":"any_of","value":["%s"]}]', upper(pg_temp.id('acme_agent1')::text))), ARRAY['alpha'], 'an id in capitals');
  PERFORM pg_temp.is(pg_temp.f(format('[{"field":"owner","op":"any_of","value":["%s"]}]', pg_temp.id('acme_removed'))), '{}'::text[], 'a person who has left owns nothing here: their account reads as no owner');
  PERFORM pg_temp.is(pg_temp.f(format('[{"field":"owner","op":"any_of","value":["%s"]}]', gen_random_uuid())), '{}'::text[], 'a person nobody knows owns nothing');
  PERFORM pg_temp.is(pg_temp.f(format('[{"field":"owner","op":"any_of","value":["%s"]},{"field":"status","op":"any_of","value":["client"]}]', pg_temp.id('acme_agent2'))), ARRAY['beta'], 'with another filter');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"owner","op":"my_team"}]'), ARRAY['echo', 'beta'], 'my team is the lead''s team and the team under it');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"owner","op":"me"}]'), '{}'::text[], 'the lead owns none');
  PERFORM pg_temp.is(pg_temp.f(format('[{"field":"owner","op":"any_of","value":["%s"]}]', pg_temp.id('acme_agent1'))), '{}'::text[], 'a lead filtering on a person outside the team sees nothing of theirs');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"owner","op":"my_team"}]'), ARRAY['beta'], 'an agent''s team is the one they are on and under it; they still see only their own');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"owner","op":"me"}]'), ARRAY['beta'], 'me, for an agent');
  PERFORM pg_temp.as_user('acme_agent4', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.f('[{"field":"owner","op":"my_team"}]'), ARRAY['echo'], 'an agent on the team under Sales has only that team, not the one above it');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.counts('acme', '[{"name":"Mine","filters":[{"field":"owner","op":"me"}]},{"name":"Team","filters":[{"field":"owner","op":"my_team"}]}]'), 'Mine=1, Team=0', 'a tab of my accounts');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"owner","op":"any_of","value":["x"]}]')$q$, '22023', 'takes people by their id', 'a person is named by their id');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"owner","op":"me","value":"x"}]')$q$, '22023', 'takes no value', 'me takes no value');
  PERFORM pg_temp.refused($q$SELECT pg_temp.q('[{"field":"name","op":"me"}]')$q$, '22023', 'A text field can''t be filtered with "me"', 'a text field has no me');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: person filters passed';
END $$;

-- ---------- the members the Owner filter offers ----------
-- Break caught: the list shows a person who left, another firm's people, or is given to someone who is no member; a person is shown by their id.
CREATE FUNCTION pg_temp.members(p_firm text) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(name, ' | ' ORDER BY ord) FROM (SELECT name, row_number() OVER () AS ord FROM public.firm_member_choices(pg_temp.id(p_firm))) m
$$;
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.members('acme'),
    'acme_agent2@example.test | acme_agent3@example.test | acme_agent4@example.test | acme_owner@example.test | Ann Agent | both@example.test | Lena Lead',
    'the current members by name (else email), in the alphabet; not the person who left, and no one of another firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_choices(pg_temp.id('acme')) c WHERE c.user_id = pg_temp.id('acme_agent1') AND c.name = 'Ann Agent'), 1::bigint, 'with the id the filter takes');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_choices(NULL)), 7::bigint, 'no firm is the one at the address');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_choices(pg_temp.id('acme'))), 7::bigint, 'an agent is offered the same people');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.members('zenith'), 'both@example.test | zenith_agent@example.test | zenith_owner@example.test', 'another firm''s own members');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_member_choices(%L)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'another firm''s member is refused');
  PERFORM pg_temp.as_user('acme_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_member_choices(%L)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'at another firm''s address the firm of the address only');
  PERFORM pg_temp.as_user('acme_removed', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_member_choices(%L)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'a former member is refused');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_member_choices(%L)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'a platform admin who is no member is refused');
  PERFORM pg_temp.as_user('nobody', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_member_choices(%L)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'a person of no firm is refused');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.firm_member_choices(%L)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'a signed-out caller is refused');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: members passed';
END $$;

-- ---------- saved views and column choices ----------
-- Break caught: accounts is not among the tables whose views and column choices are kept, or opens the door to any other name; a view of one table is
-- listed under the other.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); v uuid;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  v := public.save_view(acme, 'accounts', 'My accounts', '[{"field":"owner","op":"me"}]', '{"field":"last_activity_at","direction":"desc"}', NULL);
  PERFORM pg_temp.is((SELECT count(*) FROM public.list_saved_views(acme, 'accounts') l WHERE l.view_id = v), 1::bigint, 'a view of the accounts table is kept and listed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.list_saved_views(acme, 'submissions') l WHERE l.view_id = v), 0::bigint, 'and is not one of the queue''s');
  PERFORM public.set_my_table_columns(acme, 'accounts', NULL, '["name", "owner", "last_activity_at"]');
  PERFORM pg_temp.is((SELECT m.columns FROM public.my_table_columns(acme, 'accounts', NULL) m), '["name", "owner", "last_activity_at"]'::jsonb, 'the person''s column choice for the table is kept');
  PERFORM pg_temp.is((SELECT count(*) FROM public.my_table_columns(acme, 'submissions', NULL) m WHERE m.source = 'mine'), 0::bigint, 'and is not the queue''s');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.save_view(%L, 'invoices', 'x', NULL, NULL, NULL)$q$, acme)) LIKE '22023: There is no table called%', true, 'a table that is not on the list is still refused');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.save_view(%L, 'Accounts', 'x', NULL, NULL, NULL)$q$, acme)) LIKE '22023:%', true, 'a name is exact');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.list_saved_views(%L, 'accounts')$q$, acme)) LIKE '42501:%', true, 'another firm''s member reads none of Acme''s views');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: saved views passed';
END $$;

-- ---------- export ----------
-- Break caught: the accounts are not in the export's list; the reader shows an account the person may not see, a column nobody listed or another firm's row; a
-- selection leaks by id; an export is not recorded; the reader is open to the API roles.
CREATE FUNCTION pg_temp.as_fresh(n text, addr text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test',
    'amr', jsonb_build_array(jsonb_build_object('method', 'oauth', 'timestamp', floor(extract(epoch FROM now() - interval '1 hour'))::bigint)))::text, false);
  PERFORM set_config('request.headers', jsonb_build_object('x-firm-address', addr)::text, false);
  SET LOCAL ROLE authenticated;
END $$;
CREATE FUNCTION pg_temp.exported(p_table text, p_filters jsonb DEFAULT '{}', p_ids jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.export_rows(pg_temp.id('acme'), p_table, p_filters, p_ids)
$$;
CREATE FUNCTION pg_temp.exported_names(j jsonb) RETURNS text LANGUAGE sql AS $$ SELECT COALESCE(string_agg(r ->> 'name', ',' ORDER BY ord), '') FROM jsonb_array_elements(j -> 'rows') WITH ORDINALITY x(r, ord) $$;
DO $$
DECLARE j jsonb; ids jsonb; n_before bigint; one jsonb;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is((SELECT who FROM public.export_table_registry() WHERE name = 'accounts'), 'member', 'any member may export accounts (they read what they may see)');
  PERFORM pg_temp.is(to_regprocedure('public.export_source_accounts(uuid, jsonb, jsonb, integer)') IS NOT NULL, true, 'the table has its reader');
  PERFORM pg_temp.is(has_function_privilege('authenticated', 'public.export_source_accounts(uuid, jsonb, jsonb, integer)', 'EXECUTE')
                     OR has_function_privilege('anon', 'public.export_source_accounts(uuid, jsonb, jsonb, integer)', 'EXECUTE'), false, 'closed to the API');
  PERFORM pg_temp.as_fresh('acme_owner', 'acme-brokers');
  SELECT count(*) INTO n_before FROM public.firm_activity WHERE kind = 'export_made';
  j := pg_temp.exported('accounts');
  PERFORM pg_temp.is(j ->> 'count', '6', 'a whole table: the six accounts the owner sees');
  PERFORM pg_temp.is(pg_temp.exported_names(j), 'Alpha Co,Émile Holdings,zulu corp,Echo Co,Delta Works,beta inc', 'in the table''s order');
  PERFORM pg_temp.is(j ->> 'label', 'Accounts', 'its name in words');
  -- every row holds exactly the columns declared, each a text, number, yes or no, or nothing
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(j -> 'rows') r WHERE (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(r) k) IS DISTINCT FROM
                       (SELECT array_agg(c ->> 'id' ORDER BY c ->> 'id') FROM jsonb_array_elements(j -> 'columns') c)), 0::bigint, 'every row holds exactly the declared columns');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(j -> 'rows') r, jsonb_each(r) e WHERE jsonb_typeof(e.value) NOT IN ('string', 'number', 'boolean', 'null')), 0::bigint, 'and nothing nested');
  SELECT x INTO one FROM jsonb_array_elements(j -> 'rows') x WHERE x ->> 'name' = 'Alpha Co';
  PERFORM pg_temp.is(one, jsonb_build_object('name', 'Alpha Co', 'trade_name', 'Alfa Trading', 'website', 'https://www.alpha-co.example/home', 'city', 'Portland', 'state', 'OR', 'employees', 50,
    'industry', 'Retail', 'states_of_operation', 'OR, WA', 'current_provider', 'ADP TotalSource', 'source', 'Added by hand', 'status', 'Prospect', 'owner', 'Ann Agent',
    'main_contact', 'Ann Alpha', 'main_contact_email', 'ann@alpha-co.example', 'main_contact_phone', '503-555-0101', 'opportunity', 'Alpha sooner search',
    'opportunity_stage', 'In market', 'target_start', '2027-02-01', 'open_opportunities', 2, 'quote_requests_sent', 2, 'quotes_received', 1,
    'earliest_quote_expires_on', '2026-12-31', 'last_activity_at', '2026-10-20T00:00:00+00:00', 'created_at', '2026-10-01T00:00:00+00:00', 'archived', false,
    'renewal_date', NULL), 'a row, in words');  -- renewal_date: 20261121160000 (start_the_renewal) adds the account's nearest renewal; Alpha Co has none
  SELECT x INTO one FROM jsonb_array_elements(j -> 'rows') x WHERE x ->> 'name' = 'beta inc';
  PERFORM pg_temp.is(one ->> 'status', 'Client', 'a client');
  PERFORM pg_temp.is(one ->> 'source', 'Employer''s intake', 'the source in words');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_activity WHERE kind = 'export_made'), n_before + 1, 'the export is recorded');
  PERFORM pg_temp.is((SELECT row_count FROM public.firm_activity WHERE kind = 'export_made' AND record_id = 'accounts' ORDER BY at DESC LIMIT 1), 6, 'with the number of rows given');
  -- filters, a search and the archived accounts
  PERFORM pg_temp.is(pg_temp.exported_names(pg_temp.exported('accounts', '{"filters":[{"field":"status","op":"any_of","value":["client"]}]}')), 'beta inc', 'what the table shows for a filter');
  PERFORM pg_temp.is(pg_temp.exported_names(pg_temp.exported('accounts', '{"search":"zebra"}')), 'Alpha Co', 'for a search');
  PERFORM pg_temp.is(pg_temp.exported_names(pg_temp.exported('accounts', '{"filters":[{"field":"archived","op":"is","value":true}]}')), 'Gamma LLC', 'the Archived view');
  PERFORM pg_temp.is(pg_temp.exported_names(pg_temp.exported('accounts', '{"filters":[{"field":"created_at","op":"on","value":"2026-10-10"}],"time_zone":"America/Los_Angeles"}')), 'Delta Works', 'in the person''s time zone');
  PERFORM pg_temp.is(pg_temp.exported_names(pg_temp.exported('accounts', '{"filters":[{"field":"owner","op":"me"}]}')), 'zulu corp', 'a person filter is the person exporting');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT pg_temp.exported('accounts', '{"fliters":[]}')$q$) LIKE '22023: Those filters don''t apply to this table%', true, 'a key the table does not have is refused');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT pg_temp.exported('accounts', '{"filters":[{"field":"firm_id","op":"is","value":"x"}]}')$q$) LIKE '22023: The accounts table has no field "firm_id"%', true, 'a field it does not list is refused');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT pg_temp.exported('accounts', '{"filters":{}}')$q$) LIKE '22023:%', true, 'filters that are not a list are refused');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT pg_temp.exported('accounts', '{"time_zone":"PST"}')$q$) LIKE '22023:%', true, 'a time zone that is not one is refused');
  -- a selection by ids: the person's own visibility, archived ones named too, another firm's and invented ones skipped
  ids := jsonb_build_array(pg_temp.id('alpha'), pg_temp.id('beta'), pg_temp.id('gamma'), pg_temp.id('zenith_one'), 'not-an-id', gen_random_uuid());
  j := pg_temp.exported('accounts', '{}', ids);
  PERFORM pg_temp.is(pg_temp.exported_names(j), 'Alpha Co,Gamma LLC,beta inc', 'a selection gives the named accounts, an archived one included, in the table''s order');
  PERFORM pg_temp.is(j ->> 'skipped', '3', 'and says how many gave no row: another firm''s, text, one that is not there');
  PERFORM pg_temp.is(pg_temp.exported_names(pg_temp.exported('accounts', '{"filters":[{"field":"status","op":"any_of","value":["client"]}]}', ids)), 'beta inc', 'a selection with a filter keeps the filter');
  PERFORM pg_temp.as_fresh('acme_agent1', 'acme-brokers');
  j := pg_temp.exported('accounts', '{}', ids);
  PERFORM pg_temp.is(pg_temp.exported_names(j), 'Alpha Co', 'an agent exports only what they may see, even when they name more');
  PERFORM pg_temp.is(j ->> 'skipped', '5', 'the others look like ids that are not there');
  PERFORM pg_temp.is(pg_temp.exported_names(pg_temp.exported('accounts')), 'Alpha Co', 'and a whole table is theirs only');
  PERFORM pg_temp.as_fresh('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.exported_names(pg_temp.exported('accounts')), 'Echo Co,beta inc', 'a lead''s is their team''s');
  PERFORM pg_temp.as_fresh('acme_agent3', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.exported('accounts') ->> 'count', '0', 'an agent with none to see exports none (and the export is still recorded)');
  PERFORM pg_temp.as_fresh('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.export_rows(%L, 'accounts', '{}', NULL)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'another firm''s owner cannot export Acme''s');
  PERFORM pg_temp.is(pg_temp.exported_names(public.export_rows(pg_temp.id('zenith'), 'accounts', '{}', jsonb_build_array(pg_temp.id('alpha')))), '', 'nor name an Acme account as their own firm''s');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT * FROM public.export_source_accounts(%L, '{}', NULL, 10)$q$, pg_temp.id('acme'))) LIKE '42501:%', true, 'a person cannot run the reader');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: export passed';
END $$;

-- ---------- what moves a row ----------
-- Each block makes its changes and undoes them (a subtransaction rolled back), since the record of a quote request's changes is append-only.
-- Break caught: last activity counts an edit of a field; a quote's status change does not count; the sources of last activity are not in one place (a story
-- that adds calls, notes and tasks has to change the table's query); a lost opportunity is shown as open; a won file put away stops being a client.
CREATE FUNCTION pg_temp.move(intake text, to_status text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE from_status text;
BEGIN
  SELECT w.status INTO from_status FROM public.submission_workflow w WHERE w.session_id = pg_temp.id(intake);
  UPDATE public.submission_workflow SET status = to_status WHERE session_id = pg_temp.id(intake);
  INSERT INTO public.submission_status_history (session_id, from_status, to_status) VALUES (pg_temp.id(intake), from_status, to_status);
END $$;
CREATE FUNCTION pg_temp.row_as_owner(n text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := pg_temp.row_of(n);
  RESET ROLE;
  RETURN r;
END $$;

DO $$
DECLARE before timestamptz; r jsonb;
BEGIN
  BEGIN
    before := (pg_temp.row_as_owner('alpha') ->> 'last_activity_at')::timestamptz;
    -- A field edited on the quote request, and on the account, is not activity.
    UPDATE public.quote_requests SET note = 'called them' WHERE session_id = pg_temp.id('intake_alpha') AND peo_name = 'PEO One';
    UPDATE public.accounts SET city = 'Salem', industry = 'Wholesale' WHERE id = pg_temp.id('alpha');
    PERFORM pg_temp.is((pg_temp.row_as_owner('alpha') ->> 'last_activity_at')::timestamptz, before, 'editing a field is not activity (D-201)');
    -- A status change is.
    UPDATE public.quote_requests SET status = 'declined' WHERE session_id = pg_temp.id('intake_alpha') AND peo_name = 'PEO Two';
    PERFORM pg_temp.is((pg_temp.row_as_owner('alpha') ->> 'last_activity_at')::timestamptz > before, true, 'a quote request''s status changing is activity');
    PERFORM pg_temp.is((pg_temp.row_as_owner('alpha') ->> 'last_activity_at')::timestamptz > now() - interval '1 minute', true, 'and is the newest');
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'waiting_on_peo', 'false', 'nothing is waiting any more');
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'quote_requests_sent', '2', 'a decline is still a quote asked for');
    -- The one place later stories extend: a branch added to account_activity_times is last activity, and nothing else was changed.
    CREATE OR REPLACE FUNCTION public.account_activity_times(p_firm_id uuid, p_account_id uuid) RETURNS TABLE (at timestamptz) LANGUAGE sql STABLE AS $f$
      SELECT a.created_at FROM public.accounts a WHERE a.firm_id = p_firm_id AND a.id = p_account_id
      UNION ALL SELECT timestamptz '2030-01-01 00:00+00' FROM public.accounts a WHERE a.firm_id = p_firm_id AND a.id = p_account_id AND a.name = 'Echo Co'
    $f$;
    PERFORM pg_temp.is((pg_temp.row_as_owner('echo') ->> 'last_activity_at')::timestamptz, timestamptz '2030-01-01 00:00+00', 'a story that adds a source of activity changes that one function');
    PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
    PERFORM pg_temp.is((pg_temp.f())[1], 'echo', 'and the table is ordered by it');
    RESET ROLE;
    RAISE EXCEPTION USING ERRCODE = 'ZZ999';
  EXCEPTION WHEN SQLSTATE 'ZZ999' THEN NULL;
  END;
  PERFORM pg_temp.is((pg_temp.row_as_owner('alpha') ->> 'last_activity_at')::timestamptz, before, 'the fixture is as it was');
  RAISE NOTICE 'accounts_query: last activity passed';
END $$;

DO $$
DECLARE r jsonb;
BEGIN
  BEGIN
    -- Alpha's nearer opportunity is lost: it is no longer open, so the other one is the one shown, with none more.
    PERFORM pg_temp.move('intake_alpha', 'lost');
    r := pg_temp.row_as_owner('alpha');
    PERFORM pg_temp.is(r ->> 'opportunity_id', pg_temp.id('opp_alpha_later')::text, 'a lost opportunity is not shown: the next open one is');
    PERFORM pg_temp.is(r ->> 'opportunity_stage', 'qualifying', 'an opportunity with no intake is Qualifying');
    PERFORM pg_temp.is(r ->> 'open_opportunities', '1', 'and none is "more"');
    PERFORM pg_temp.is(r ->> 'status', 'prospect', 'a lost opportunity does not make a client');
    -- It is won while the other is open: a client with an open opportunity.
    PERFORM pg_temp.move('intake_alpha', 'won');
    r := pg_temp.row_as_owner('alpha');
    PERFORM pg_temp.is(r ->> 'status', 'client', 'a client with an open opportunity is both');
    PERFORM pg_temp.is(r ->> 'opportunity_name', 'Alpha later search', 'and shows the open one');
    -- Put away straight from won, it stays won (D-216); reopened it is open again.
    PERFORM pg_temp.move('intake_alpha', 'archived');
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'status', 'client', 'a won file put away keeps its account a client (D-216)');
    -- Marking it as needing action, and clearing that, writes a history row from archived to archived, which is not a move: still a client, as account_status says.
    PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
    PERFORM public.set_submission_needs_action(pg_temp.id('intake_alpha'), true, 'check the renewal');
    RESET ROLE;
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'status', 'client', 'marked as needing action, the put-away won file still keeps its account a client');
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'status', public.account_status(pg_temp.id('alpha')), 'and the table says what account_status says');
    PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
    PERFORM public.set_submission_needs_action(pg_temp.id('intake_alpha'), false, NULL);
    RESET ROLE;
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'status', 'client', 'and once cleared');
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'status', public.account_status(pg_temp.id('alpha')), 'still what account_status says');
    PERFORM pg_temp.move('intake_alpha', 'submitted');
    r := pg_temp.row_as_owner('alpha');
    PERFORM pg_temp.is(r ->> 'status', 'prospect', 'reopened, the account is a prospect again');
    PERFORM pg_temp.is(r ->> 'open_opportunities', '2', 'and the opportunity is open');
    PERFORM pg_temp.is(r ->> 'opportunity_stage', 'intake_under_way', 'at its stage');
    -- Archived from another stage is lost.
    PERFORM pg_temp.move('intake_alpha', 'archived');
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'open_opportunities', '1', 'archived from another stage is lost: not open');
    -- A contact marked main, moved: the page's main contact follows the mark.
    UPDATE public.contacts SET is_main = false WHERE id = pg_temp.id('alpha_main');
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'main_contact_id', NULL, 'with none marked, an account has no main contact');
    UPDATE public.contacts SET is_main = true WHERE account_id = pg_temp.id('alpha') AND last_name = 'Zebra';
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'main_contact_name', 'Zed Zebra', 'the one marked is the one shown');
    -- A contact with only a mobile number.
    UPDATE public.contacts SET email = NULL, phone = NULL, mobile = '503-555-0199' WHERE account_id = pg_temp.id('alpha') AND last_name = 'Zebra';
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'main_contact_phone', '503-555-0199', 'a mobile number is the phone when there is no other');
    -- The same target start: the earlier-made opportunity is the one shown, so a page never flips between two.
    UPDATE public.opportunities SET target_start = date '2027-02-01' WHERE id = pg_temp.id('opp_alpha_later');
    PERFORM pg_temp.move('intake_alpha', 'submitted');
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'opportunity_id', pg_temp.id('opp_alpha_later')::text, 'a tie of target starts goes to the one made first');
    UPDATE public.opportunities SET target_start = NULL WHERE id = pg_temp.id('opp_alpha_later');
    PERFORM pg_temp.is(pg_temp.row_as_owner('alpha') ->> 'opportunity_id', pg_temp.id('opp_alpha_sooner')::text, 'an open opportunity with no target start is shown after one with');
    RAISE EXCEPTION USING ERRCODE = 'ZZ999';
  EXCEPTION WHEN SQLSTATE 'ZZ999' THEN NULL;
  END;
  RAISE NOTICE 'accounts_query: stages passed';
END $$;

-- ---------- a member with no name and no email ----------
-- Break caught: a current member who has neither a name nor an email (an account's email may be empty or none) is given as nothing, so the owner column and
-- the Owner filter's choices hold a null where they promise a name. The last word is "A member", as the export's alert calls such a member (D-218).
DO $$
DECLARE u uuid := gen_random_uuid(); r jsonb; e text;
BEGIN
  FOREACH e IN ARRAY ARRAY[NULL, '', '  '] LOOP
    BEGIN
      INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at, raw_user_meta_data)
      VALUES (u, 'authenticated', 'authenticated', e, now(), false, now(), now(), '{"name": "  ", "full_name": 7}');
      INSERT INTO fx VALUES ('ghost', u);
      INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), u, 'agent');
      PERFORM pg_temp.acct('ghost_acct', 'acme', 'ghost', 'Ghost Co', date '2026-10-17');
      r := pg_temp.row_as_owner('ghost_acct');
      PERFORM pg_temp.is(r ->> 'owner_name', 'A member', 'a member with no name and email ' || COALESCE('"' || e || '"', 'none') || ' is "A member" in the owner column');
      PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
      PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_choices(pg_temp.id('acme')) c WHERE c.name IS NULL), 0::bigint, 'no choice of the Owner filter is nameless');
      PERFORM pg_temp.is((SELECT c.name FROM public.firm_member_choices(pg_temp.id('acme')) c WHERE c.user_id = u), 'A member', 'the same word there');
      PERFORM pg_temp.is((pg_temp.names(pg_temp.al('acme', '[]', 'owner', 'asc')))[1], 'ghost_acct', 'sorted by owner, "A member" sorts among the names (as "a member", before "acme_agent2")');
      RESET ROLE;
      RAISE EXCEPTION USING ERRCODE = 'ZZ999';
    EXCEPTION WHEN SQLSTATE 'ZZ999' THEN NULL;
    END;
  END LOOP;
  RAISE NOTICE 'accounts_query: a member with no name passed';
END $$;

-- ---------- the Quotes column is for the shown opportunity (CRM-A1.1) ----------
-- Break caught: the quotes (and "waiting on a PEO") are counted across every opportunity of the account, so an account with a won opportunity and a new
-- open one shows last year's "1 back of 1, expires 2025-12-31"; or they are the other open opportunity's, not the one the Opportunity column shows.
DO $$
DECLARE r jsonb;
BEGIN
  BEGIN
    -- Renewing: last year's opportunity is won and holds a quote that came back; this year's is open and has one request, still waiting.
    PERFORM pg_temp.acct('renew', 'acme', 'acme_owner', 'Renewing Co', date '2026-10-16');
    PERFORM pg_temp.intake('i_old', 'acme'); PERFORM pg_temp.intake('i_new', 'acme');
    INSERT INTO public.opportunities (firm_id, account_id, name, target_start, intake_id)
    VALUES (pg_temp.id('acme'), pg_temp.id('renew'), 'Last year', date '2025-09-01', pg_temp.id('i_old')), (pg_temp.id('acme'), pg_temp.id('renew'), 'This year', date '2026-12-01', pg_temp.id('i_new'));
    UPDATE public.submission_workflow SET status = 'won' WHERE session_id = pg_temp.id('i_old');
    UPDATE public.submission_workflow SET status = 'sent_to_carrier' WHERE session_id = pg_temp.id('i_new');
    PERFORM pg_temp.quote('i_old', 'PEO Old', 'quoted', date '2025-12-31', date '2025-10-01');
    PERFORM pg_temp.quote('i_new', 'PEO New', 'sent', NULL, date '2026-10-30');
    r := pg_temp.row_as_owner('renew');
    PERFORM pg_temp.is(r ->> 'status', 'client', 'the account is a client (last year''s was won)');
    PERFORM pg_temp.is(r ->> 'opportunity_name', 'This year', 'and shows this year''s opportunity');
    PERFORM pg_temp.is(r ->> 'quote_requests_sent', '1', 'with its one quote asked for, not last year''s too');
    PERFORM pg_temp.is(r ->> 'quotes_received', '0', 'none back: last year''s quote is not this year''s');
    PERFORM pg_temp.is(r ->> 'earliest_quote_expires_on', NULL, 'and no expiry of last year''s');
    PERFORM pg_temp.is(r ->> 'waiting_on_peo', 'true', 'it is waiting on a PEO');
    -- A filter on quotes back reads the same: this account has none.
    PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
    PERFORM pg_temp.is(pg_temp.f('[{"field":"quotes_received","op":"more_than","value":0}]'), ARRAY['alpha'], 'only the account whose shown opportunity has a quote back has one');
    RESET ROLE;
    -- This year's opportunity has no intake yet (Qualifying): it has no quotes, whatever last year's had.
    -- CRM-Q1.3 asks that an intake with quote requests sit on an opportunity; this block is rolled back, and asks at its end.
    SET CONSTRAINTS opportunities_keep_intake_unlink DEFERRED;
    UPDATE public.opportunities SET intake_id = NULL WHERE account_id = pg_temp.id('renew') AND name = 'This year';
    r := pg_temp.row_as_owner('renew');
    PERFORM pg_temp.is(r ->> 'opportunity_stage', 'qualifying', 'an open opportunity with no intake is Qualifying');
    PERFORM pg_temp.is(r ->> 'quote_requests_sent', '0', 'and has asked for no quotes');
    PERFORM pg_temp.is(r ->> 'waiting_on_peo', 'false', 'and waits on no PEO');
    -- Of two open opportunities, the quotes are the shown one's (the nearer start): Alpha's other opportunity holds none, and takes the lead.
    UPDATE public.opportunities SET intake_id = pg_temp.id('i_new') WHERE account_id = pg_temp.id('renew') AND name = 'This year';
    UPDATE public.opportunities SET target_start = date '2027-06-01' WHERE id = pg_temp.id('opp_alpha_sooner');
    UPDATE public.opportunities SET target_start = date '2027-05-01' WHERE id = pg_temp.id('opp_alpha_later');
    r := pg_temp.row_as_owner('alpha');
    PERFORM pg_temp.is(r ->> 'opportunity_name', 'Alpha later search', 'the other open opportunity is nearer now');
    PERFORM pg_temp.is(r ->> 'quote_requests_sent', '0', 'so the quotes are its (none), not the other''s');
    PERFORM pg_temp.is(r ->> 'quotes_received', '0', 'none back');
    PERFORM pg_temp.is(r ->> 'earliest_quote_expires_on', NULL, 'no expiry');
    PERFORM pg_temp.is(r ->> 'waiting_on_peo', 'false', 'and no waiting');
    PERFORM pg_temp.is(r ->> 'open_opportunities', '2', 'with both still open');
    RAISE EXCEPTION USING ERRCODE = 'ZZ999';
  EXCEPTION WHEN SQLSTATE 'ZZ999' THEN NULL;
  END;
  RAISE NOTICE 'accounts_query: the quotes of the shown opportunity passed';
END $$;

-- ---------- last activity takes calls, notes and tasks in (CRM-E1.5, D-201) ----------
-- Break caught: a call, a note or a task on the account, on one of its contacts or on one of its opportunities does not move last activity; a task's
-- completion or an addition to a note does not; an edit of a call or a task (or of a note's text) does; an older call hides a newer moment; or the
-- function loses a branch it had (the quote status change, the account's making).
DO $$
DECLARE alpha uuid := pg_temp.id('alpha'); acme uuid := pg_temp.id('acme'); t uuid; n uuid; r jsonb;
BEGIN
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT max(x.at) FROM public.account_activity_times(acme, alpha) x), timestamptz '2026-10-20 00:00+00', 'before: the quote status change is the newest');
  INSERT INTO public.activities (firm_id, account_id, kind, contact_id, at, outcome) VALUES (acme, alpha, 'call', pg_temp.id('alpha_main'), timestamptz '2026-10-25 09:00+00', 'spoke');
  PERFORM pg_temp.is((SELECT max(x.at) FROM public.account_activity_times(acme, alpha) x), timestamptz '2026-10-25 09:00+00', 'a call on a contact of the account');
  INSERT INTO public.activities (firm_id, account_id, kind, opportunity_id, at, outcome) VALUES (acme, alpha, 'call', pg_temp.id('opp_alpha_sooner'), timestamptz '2026-10-01 09:00+00', 'no_answer');
  PERFORM pg_temp.is((SELECT max(x.at) FROM public.account_activity_times(acme, alpha) x), timestamptz '2026-10-25 09:00+00', 'an older call hides nothing');
  INSERT INTO public.activities (firm_id, account_id, kind, title, due_on, at, created_at) VALUES (acme, alpha, 'task', 'Send it', date '2026-11-01', timestamptz '2026-10-26 09:00+00', timestamptz '2026-10-26 09:00+00') RETURNING id INTO t;
  PERFORM pg_temp.is((SELECT max(x.at) FROM public.account_activity_times(acme, alpha) x), timestamptz '2026-10-26 09:00+00', 'a task made');
  UPDATE public.activities SET done_at = timestamptz '2026-10-27 09:00+00' WHERE id = t;
  PERFORM pg_temp.is((SELECT max(x.at) FROM public.account_activity_times(acme, alpha) x), timestamptz '2026-10-27 09:00+00', 'and done');
  INSERT INTO public.activities (firm_id, account_id, kind, body, at, created_at, additions) VALUES (acme, alpha, 'note', 'A note', timestamptz '2026-10-20 09:00+00', timestamptz '2026-10-20 09:00+00',
    '[{"at": "2026-10-28T09:00:00+00:00", "by": null, "text": "More"}]') RETURNING id INTO n;
  PERFORM pg_temp.is((SELECT max(x.at) FROM public.account_activity_times(acme, alpha) x), timestamptz '2026-10-28 09:00+00', 'an addition to a note');
  UPDATE public.activities SET title = 'Send it today', updated_at = timestamptz '2026-12-01 00:00+00' WHERE id = t;
  PERFORM pg_temp.is((SELECT max(x.at) FROM public.account_activity_times(acme, alpha) x), timestamptz '2026-10-28 09:00+00', 'editing a task is not activity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.account_activity_times(acme, pg_temp.id('beta')) x), 1::bigint, 'another account''s are not read: beta has only its making');
  PERFORM pg_temp.is((SELECT count(*) FROM public.account_activity_times(pg_temp.id('zenith'), alpha) x), 0::bigint, 'nor under another firm');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := pg_temp.row_of('alpha');
  PERFORM pg_temp.is((r ->> 'last_activity_at')::timestamptz, timestamptz '2026-10-28 09:00+00', 'the accounts list shows it');
  RESET ROLE;
  RAISE NOTICE 'accounts_query: last activity with calls, notes and tasks passed';
END $$;

-- ---------- a small firm's list reads a few rows, not every firm's ----------
-- Break caught: the query joins whole tables (a planner override that forces hash joins, or a join of a built set), so listing 6 accounts reads every
-- firm's quote requests, main contacts and status events: 13 ms for a firm of 10 accounts beside one of 5,000, against 7. Asked by what the listing reads:
-- a second firm of 400 accounts, each with a main contact and an opportunity, and 400 quote requests on one intake, with their status events, all
-- counted; Acme's owner lists Acme's 6 accounts, and each table the query reads must give up only a few rows (a list reads 2 contacts, 6 quote requests and
-- 3 events, and some 60 opportunities by the account's and the stage's lookups, against the 400 of each a scan of the big firm gives), planned once first,
-- with sequential scans priced out, as the history functions' test does.
CREATE FUNCTION pg_temp.rows_read(t text) RETURNS bigint LANGUAGE sql AS $$
  SELECT s.seq_tup_read + COALESCE(s.idx_tup_fetch, 0) FROM pg_stat_xact_user_tables s WHERE s.relid = ('public.' || t)::regclass
$$;
DO $$
DECLARE big uuid; i uuid; opp uuid; t text; before bigint; spent text := ''; j jsonb;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Big Brokers', 'big-brokers', now()) RETURNING id INTO big;
  INSERT INTO fx VALUES ('big', big);
  INSERT INTO public.accounts (source, firm_id, name, created_at)
  SELECT 'import', big, 'Big ' || lpad(n::text, 3, '0'), timestamptz '2026-01-01 00:00+00' + (n || ' minutes')::interval FROM generate_series(1, 400) n;
  INSERT INTO public.contacts (firm_id, account_id, last_name, email, is_main) SELECT big, a.id, 'Big contact', 'big-' || a.id || '@example.test', true FROM public.accounts a WHERE a.firm_id = big;
  INSERT INTO public.opportunities (firm_id, account_id, name, target_start) SELECT big, a.id, 'Big search', date '2027-01-01' FROM public.accounts a WHERE a.firm_id = big;
  INSERT INTO public.activities (firm_id, account_id, kind, body) SELECT big, a.id, 'note', 'Big note' FROM public.accounts a WHERE a.firm_id = big;
  i := pg_temp.intake('big_intake', 'big');
  UPDATE public.opportunities SET intake_id = i WHERE id = (SELECT o.id FROM public.opportunities o WHERE o.firm_id = big ORDER BY o.account_id LIMIT 1);
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) SELECT i, 'Big PEO ' || n, 'sent', date '2026-10-01' FROM generate_series(1, 400) n;
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_events WHERE session_id = i AND field = 'status'), 400::bigint, 'the big firm''s quote requests have their events');
END $$;
ANALYZE public.accounts, public.contacts, public.opportunities, public.activities, public.quote_requests, public.quote_request_events, public.submission_workflow;

DO $$
DECLARE t text; before bigint; used bigint; j jsonb;
BEGIN
  PERFORM set_config('enable_seqscan', 'off', true);
  PERFORM set_config('plan_cache_mode', 'force_generic_plan', true);
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.al('acme');
  PERFORM pg_temp.al('acme', '[]', NULL, 'asc', 1, 'zebra');
  FOREACH t IN ARRAY ARRAY['contacts', 'opportunities', 'quote_requests', 'quote_request_events', 'activities'] LOOP
    before := pg_temp.rows_read(t);
    j := pg_temp.al('acme');
    used := pg_temp.rows_read(t) - before;
    PERFORM pg_temp.is(jsonb_array_length(j -> 'rows'), 6, 'the list is whole');
    PERFORM pg_temp.is(used < CASE t WHEN 'opportunities' THEN 150 ELSE 30 END, true, 'listing 6 accounts read ' || used || ' rows of ' || t || ', not every firm''s');
    before := pg_temp.rows_read(t);
    PERFORM pg_temp.al('acme', '[]', NULL, 'asc', 1, 'zebra');
    used := pg_temp.rows_read(t) - before;
    PERFORM pg_temp.is(used < CASE t WHEN 'opportunities' THEN 150 ELSE 30 END, true, 'a search read ' || used || ' rows of ' || t);
    before := pg_temp.rows_read(t);
    PERFORM public.accounts_view_counts(pg_temp.id('acme'), pg_temp.views());
    used := pg_temp.rows_read(t) - before;
    PERFORM pg_temp.is(used < CASE t WHEN 'opportunities' THEN 150 ELSE 30 END, true, 'the tabs read ' || used || ' rows of ' || t);
  END LOOP;
  -- The measure can see a scan: the big firm's own list reads its 400 contacts.
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  RESET ROLE;
  before := pg_temp.rows_read('contacts');
  PERFORM count(*) FROM public.contacts c WHERE c.firm_id = pg_temp.id('big');
  PERFORM pg_temp.is(pg_temp.rows_read('contacts') - before >= 400, true, 'a scan of the big firm''s contacts is seen by the count');
  RAISE NOTICE 'accounts_query: few rows read passed';
END $$;

-- ---------- last activity reads a handful of rows however much an account holds (CRM-E1.5) ----------
-- Break caught: last activity scans each account's calls, notes and tasks (and expands every addition) for every account the list sorts, so 5,000 notes with
-- additions on one account are read to show the first page: the function takes the newest of the maintained moment by the (account, moment) index.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); alpha uuid := pg_temp.id('alpha');
BEGIN
  PERFORM pg_temp.as_owner();
  INSERT INTO public.activities (firm_id, account_id, kind, body, at, created_at, additions)
  SELECT acme, alpha, 'note', 'Heavy ' || n, timestamptz '2026-09-01 00:00+00' + (n || ' minutes')::interval, timestamptz '2026-09-01 00:00+00' + (n || ' minutes')::interval,
         jsonb_build_array(jsonb_build_object('at', (timestamptz '2026-09-01 00:00+00' + (n || ' minutes')::interval + interval '1 hour')::text, 'by', NULL, 'text', 'More'),
                           jsonb_build_object('at', (timestamptz '2026-09-01 00:00+00' + (n || ' minutes')::interval + interval '2 hours')::text, 'by', NULL, 'text', 'Again'))
  FROM generate_series(1, 5000) n;
END $$;
ANALYZE public.activities;
DO $$
DECLARE before bigint; used bigint; j jsonb;
BEGIN
  PERFORM set_config('enable_seqscan', 'off', true);
  PERFORM set_config('plan_cache_mode', 'force_generic_plan', true);
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.al('acme');
  before := pg_temp.rows_read('activities');
  j := pg_temp.al('acme');
  used := pg_temp.rows_read('activities') - before;
  PERFORM pg_temp.is(jsonb_array_length(j -> 'rows'), 6, 'the list is whole');
  PERFORM pg_temp.is(used < 30, true, 'listing 6 accounts, one with 5,000 notes, read ' || used || ' rows of activities, not its history');
  RESET ROLE;
END $$;
-- And the time of that first page, with the planner as it is (a second call, so planning is not counted).
DO $$
DECLARE t0 timestamptz; ms numeric; j jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.al('acme');
  t0 := clock_timestamp();
  j := pg_temp.al('acme');
  ms := extract(epoch FROM clock_timestamp() - t0) * 1000;
  RAISE NOTICE 'accounts_query: the first page with 5000 notes (10000 additions) on one account took % ms', round(ms);
  PERFORM pg_temp.is(ms < 500, true, 'the first page took ' || round(ms) || ' ms');
  RESET ROLE;
END $$;


-- ---------- how it is run ----------
-- Break caught: the functions the browser calls are open to a signed-out caller, or a helper is.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('accounts_list', 'accounts_view_counts', 'firm_member_choices')
                       AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'))), 0::bigint, 'the three calls are for signed-in callers and no one else');
  PERFORM pg_temp.is((SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('accounts_rows', 'accounts_filters_checked', 'accounts_row_passes', 'accounts_row_filters_pass',
                       'account_activity_times', 'accounts_field_kind', 'accounts_field_choices', 'accounts_words', 'person_display_name', 'workspace_filter_match_person')
                       AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('service_role', p.oid, 'EXECUTE'))), 0::bigint,
                     'the helpers are run by no API role');
  RAISE NOTICE 'accounts_query: how it is run passed';
END $$;

-- ---------- Nevermore support ----------
-- Break caught: a support session at the firm's address cannot read the table (it reads what a member reads, ADR 0024), or reads it at another address, or exports.
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (acme, pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck quote', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.al('acme')), ARRAY['alpha', 'emile', 'zulu', 'echo', 'delta', 'beta'], 'a support session reads what an owner reads, at the firm''s address');
  PERFORM pg_temp.is(pg_temp.counts('acme', pg_temp.views()), 'All=6, Open opportunities=1, Waiting on quotes=1, Clients=1, Archived=1', 'and its tabs');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_member_choices(acme)), 7::bigint, 'and the people the Owner filter offers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.export_rows(%L, 'accounts', '{}', NULL)$q$, acme)), 'PT423: Nevermore support can look, not change', 'but exports nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.accounts_list(%L)$q$, acme)) LIKE '42501:%', true, 'on the bare domain it reads none');
  PERFORM pg_temp.as_user('platform_admin', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.accounts_list(%L)$q$, acme)) LIKE '42501:%', true, 'nor at another firm''s address');
  RESET ROLE;
  DELETE FROM public.support_sessions WHERE firm_id = acme;
  RAISE NOTICE 'accounts_query: support passed';
END $$;
