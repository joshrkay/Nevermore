-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh convert_lead
-- Converting a lead (story CRM-L2.2, slice 8.6; docs/BROKER_CRM_BUILD.md D-803, D-807, D-810, D-1653, D-1680 to D-1689; 20261122250000_convert_lead.sql).
-- convert_lead and lead_convert_context, and the restated activities_guard. Two firms: Acme sees by level, Zenith shows everyone everything. Every migration is
-- loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261122250000_convert_lead.sql
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


-- A lead, made as the superuser (no API role writes one). Named in fx.
CREATE FUNCTION pg_temp.lead(n text, firm text, p_owner text, p_business text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.leads (firm_id, owner_id, name, business, source) VALUES (pg_temp.id(firm), pg_temp.id(p_owner), 'Person ' || n, p_business, 'added_by_hand') RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;


-- A lead with every field a conversion reads, made as the superuser. Named in fx.
CREATE FUNCTION pg_temp.full_lead(n text, firm text, p_owner text, p_name text, p_business text, p_email text DEFAULT NULL, p_phone text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.leads (firm_id, owner_id, name, title, business, email, phone, city, state, employees, current_provider, note, source)
  VALUES (pg_temp.id(firm), pg_temp.id(p_owner), p_name, 'Owner', p_business, p_email, p_phone, 'Portland', 'OR', 12, 'Insperity', NULL, 'added_by_hand') RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

-- ---------- 1. Converting makes the account, and the lead is Converted and links to it ----------
-- Catches: a conversion that leaves the lead as it was, or an account that does not carry the lead's business, place and size.
DO $$
DECLARE r jsonb; a public.accounts; l public.leads;
BEGIN
  PERFORM pg_temp.full_lead('maria', 'acme', 'acme_agent1', 'Maria Reyes', 'Reyes Bakery LLC', 'maria@reyesbakery.example', '(503) 555-0142');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.convert_lead(pg_temp.id('maria'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('maria');
  PERFORM pg_temp.is(l.status, 'converted', 'the lead is Converted');
  SELECT * INTO a FROM public.accounts WHERE id = l.converted_account_id;
  PERFORM pg_temp.is(a.name, 'Reyes Bakery LLC', 'the account is named after the business');
  PERFORM pg_temp.is(a.source, 'lead', 'the account came from a lead');
  PERFORM pg_temp.is(a.state, 'OR', 'the state');
  PERFORM pg_temp.is(a.city, 'Portland', 'the city');
  PERFORM pg_temp.is(a.employees, 12, 'the employees');
  PERFORM pg_temp.is(a.current_provider, 'Insperity', 'the current provider');
  PERFORM pg_temp.is(a.owner_id, pg_temp.id('acme_agent1'), 'the lead''s owner owns the account');
  PERFORM pg_temp.is((r -> 'account' ->> 'id')::uuid, a.id, 'the answer names the account');
END $$;

-- ---------- 2. The contact comes from the lead's person ----------
-- Catches: a contact that is not made, is made with the whole name in one field, or loses the lead's title, email or phone; and one that is not the account's main contact.
DO $$
DECLARE r jsonb; c public.contacts; l public.leads;
BEGIN
  PERFORM pg_temp.full_lead('jo', 'acme', 'acme_agent1', 'Jo Q Doe', 'Doe Dental', 'jo@doedental.example', '(503) 555-0199');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.convert_lead(pg_temp.id('jo'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('jo');
  SELECT * INTO c FROM public.contacts WHERE id = l.converted_contact_id;
  PERFORM pg_temp.is(c.first_name, 'Jo Q', 'the first name');
  PERFORM pg_temp.is(c.last_name, 'Doe', 'the last name');
  PERFORM pg_temp.is(c.title, 'Owner', 'the title');
  PERFORM pg_temp.is(c.email, 'jo@doedental.example', 'the email');
  PERFORM pg_temp.is(c.phone, '(503) 555-0199', 'the phone');
  PERFORM pg_temp.is(c.account_id, l.converted_account_id, 'on the account it made');
  PERFORM pg_temp.is(c.is_main, true, 'the only contact of a new account is its main contact');
  PERFORM pg_temp.is(c.owner_id, pg_temp.id('acme_agent1'), 'the lead''s owner owns the contact');
  PERFORM pg_temp.is((r -> 'contact' ->> 'id')::uuid, c.id, 'the answer names the contact');
END $$;

-- ---------- 3. The opportunity is made and named "<Business> – PEO search" ----------
-- Catches: no opportunity, a name that differs from the lead page's "Converting makes" (D-1653), a target start nobody entered, or an opportunity that does not name the new contact.
DO $$
DECLARE r jsonb; o public.opportunities; l public.leads;
BEGIN
  PERFORM pg_temp.full_lead('opp', 'acme', 'acme_agent1', 'Pat Lee', 'Lee Landscaping');
  UPDATE public.leads SET email = 'pat@lee.example' WHERE id = pg_temp.id('opp');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.convert_lead(pg_temp.id('opp'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('opp');
  SELECT * INTO o FROM public.opportunities WHERE id = l.converted_opportunity_id;
  PERFORM pg_temp.is(o.name, 'Lee Landscaping – PEO search', 'named after the account');
  PERFORM pg_temp.is(o.target_start, NULL, 'no target start unless entered');
  PERFORM pg_temp.is(o.account_id, l.converted_account_id, 'on the account it made');
  PERFORM pg_temp.is(o.main_contact_id, l.converted_contact_id, 'the new contact is its main contact');
  PERFORM pg_temp.is(o.employees, 12, 'the employees');
  PERFORM pg_temp.is(o.owner_id, pg_temp.id('acme_agent1'), 'the lead''s owner');
  PERFORM pg_temp.is((r -> 'opportunity' ->> 'id')::uuid, o.id, 'the answer names the opportunity');
END $$;

-- ---------- 4. A business with no person makes an account and no contact, and says so ----------
-- Catches: a contact named after the business (a person nobody knows), a conversion that refuses because there is no one to contact, or an answer that does not
-- say no contact was made (CRM-L2.2: "converts to an account with no contact, and says so").
DO $$
DECLARE r jsonb; l public.leads; o public.opportunities;
BEGIN
  PERFORM pg_temp.full_lead('nobody_here', 'acme', 'acme_agent1', 'Harbor Hardware', 'harbor hardware', NULL, NULL);
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.convert_lead(pg_temp.id('nobody_here'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('nobody_here');
  PERFORM pg_temp.is(l.converted_contact_id, NULL, 'no contact');
  PERFORM pg_temp.is(r -> 'contact', 'null'::jsonb, 'the answer says no contact was made');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = l.converted_account_id), 0::bigint, 'the account has none');
  SELECT * INTO o FROM public.opportunities WHERE id = l.converted_opportunity_id;
  PERFORM pg_temp.is(o.main_contact_id, NULL, 'the opportunity has no main contact');
  PERFORM pg_temp.is((SELECT name FROM public.accounts WHERE id = l.converted_account_id), 'harbor hardware', 'the account is named after the business as typed');
END $$;

-- ---------- 5. A contact needs a name and an email or a phone; a refusal makes nothing at all ----------
-- Catches: a contact with nothing to reach them by (or a database error in place of the words), and a refused conversion that still left an account behind (all or none).
DO $$
DECLARE msg text; before_accounts bigint; l public.leads;
BEGIN
  PERFORM pg_temp.full_lead('unreachable', 'acme', 'acme_agent1', 'Sam Stone', 'Stone Supply');
  SELECT count(*) INTO before_accounts FROM public.accounts;
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  msg := pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('unreachable'), pg_temp.id('acme')));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(msg, '22023: Enter an email or a phone number.', 'a contact with no way to reach them is refused in words');
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('unreachable');
  PERFORM pg_temp.is(l.status, 'new', 'the lead is as it was');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), before_accounts, 'no account was left behind');
END $$;

-- ---------- 6. The agent fills in what the lead lacks on the form, and the contact takes it ----------
-- Catches: a form value ignored (the contact made from the lead's blanks), or one that leaves the lead's own email changed (the lead is history, not edited).
DO $$
DECLARE r jsonb; c public.contacts; l public.leads;
BEGIN
  PERFORM pg_temp.full_lead('fill', 'acme', 'acme_agent1', 'Sam Stone', 'Stone Supply');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.convert_lead(pg_temp.id('fill'), p_first_name => 'Samantha', p_last_name => 'Stone-Ito', p_contact_email => 'sam@stone.example', p_contact_phone => '(503) 555-0100',
    p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('fill');
  SELECT * INTO c FROM public.contacts WHERE id = l.converted_contact_id;
  PERFORM pg_temp.is(c.first_name, 'Samantha', 'the first name as typed');
  PERFORM pg_temp.is(c.last_name, 'Stone-Ito', 'the last name as typed');
  PERFORM pg_temp.is(c.email, 'sam@stone.example', 'the email as typed');
  PERFORM pg_temp.is(c.phone, '(503) 555-0100', 'the phone as typed');
  PERFORM pg_temp.is(l.email, NULL, 'the lead''s own email is not edited');
END $$;

-- ---------- 7. Unticking the contact converts a person with no contact; ticking it makes one for a business ----------
-- Catches: an unticked contact made anyway (or the unreachable person blocking the conversion), and a ticked contact for a business and no person that is not made.
DO $$
DECLARE r jsonb; l public.leads;
BEGIN
  PERFORM pg_temp.full_lead('unticked', 'acme', 'acme_agent1', 'Sam Stone', 'Stone Supply');
  PERFORM pg_temp.full_lead('ticked', 'acme', 'acme_agent1', 'Harbor Hardware', 'Harbor Hardware');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.convert_lead(pg_temp.id('unticked'), p_make_contact => false, p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.is(r -> 'contact', 'null'::jsonb, 'no contact when unticked');
  r := public.convert_lead(pg_temp.id('ticked'), p_make_contact => true, p_first_name => 'Hal', p_last_name => 'Harbor', p_contact_phone => '(503) 555-0111',
    p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('ticked');
  PERFORM pg_temp.is((SELECT last_name FROM public.contacts WHERE id = l.converted_contact_id), 'Harbor', 'a contact for a business, when asked for');
END $$;

-- ---------- 8. A contact asked for on a business with no person needs a name typed ----------
-- Catches: the business's own name split into a first and last name of a person nobody knows.
DO $$
BEGIN
  PERFORM pg_temp.full_lead('bizonly', 'acme', 'acme_agent1', 'Quay Quarry', 'Quay Quarry', NULL, '(503) 555-0123');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_make_contact => true, p_firm_id => %L)', pg_temp.id('bizonly'), pg_temp.id('acme'))),
    '22023: Enter the contact''s last name.', 'no name typed for a contact of a business');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 9. Using an existing account adds the contact and the opportunity to it and changes nothing else of it ----------
-- Catches: a second account made for a business the firm already has, the existing account's own fields overwritten by the lead's, or a new contact displacing the
-- account's main contact.
DO $$
DECLARE r jsonb; l public.leads; accounts_before bigint; existing uuid;
BEGIN
  existing := pg_temp.account('existing', 'acme', 'acme_agent1', 'Existing Eatery');
  PERFORM pg_temp.contact('existing_main', 'existing', 'acme_agent1', 'old@eatery.example', NULL, true);
  PERFORM pg_temp.full_lead('toexisting', 'acme', 'acme_agent1', 'Eve Eaton', 'Eaton Eats', 'eve@eaton.example');
  SELECT count(*) INTO accounts_before FROM public.accounts;
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.convert_lead(pg_temp.id('toexisting'), p_account_id => existing, p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('toexisting');
  PERFORM pg_temp.is(l.converted_account_id, existing, 'the lead links to the existing account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), accounts_before, 'no account was made');
  PERFORM pg_temp.is((SELECT city FROM public.accounts WHERE id = existing), NULL, 'the existing account''s fields are not overwritten');
  PERFORM pg_temp.is((SELECT name FROM public.accounts WHERE id = existing), 'Existing Eatery', 'nor its name');
  PERFORM pg_temp.is((SELECT account_id FROM public.contacts WHERE id = l.converted_contact_id), existing, 'the contact is on it');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = l.converted_contact_id), false, 'a new contact does not displace the main contact');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('existing_main')), true, 'the main contact stays');
  PERFORM pg_temp.is((SELECT name FROM public.opportunities WHERE id = l.converted_opportunity_id), 'Existing Eatery – PEO search', 'the opportunity is named after the account used');
  PERFORM pg_temp.is((r -> 'account' ->> 'created')::boolean, false, 'the answer says the account was not made');
END $$;

-- ---------- 10. An account the agent may not see, another firm's, or an archived one is refused, and nothing is made ----------
-- Catches: a lead attached to an account the agent cannot open (a way to learn it exists), another firm's account, or one that is archived (D-222: it takes nothing new).
DO $$
DECLARE other uuid; theirs uuid; archived uuid; contacts_before bigint;
BEGIN
  other := pg_temp.account('others_acct', 'acme', 'acme_agent2', 'Not Yours Inc');
  theirs := pg_temp.account('zenith_acct', 'zenith', 'zenith_agent', 'Zenith Client');
  archived := pg_temp.account('archived_acct', 'acme', 'acme_agent1', 'Archived Bakery');
  UPDATE public.accounts SET archived_at = now() WHERE id = archived;
  PERFORM pg_temp.full_lead('refused', 'acme', 'acme_agent1', 'Ray Ross', 'Ross Roofing', 'ray@ross.example');
  SELECT count(*) INTO contacts_before FROM public.contacts;
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_account_id => %L, p_firm_id => %L)', pg_temp.id('refused'), other, pg_temp.id('acme'))),
    'PT404: That account isn''t available', 'an account of another agent');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_account_id => %L, p_firm_id => %L)', pg_temp.id('refused'), theirs, pg_temp.id('acme'))),
    'PT404: That account isn''t available', 'another firm''s account');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_account_id => %L, p_firm_id => %L)', pg_temp.id('refused'), archived, pg_temp.id('acme'))),
    '55000: This account is archived. Nothing can be added to it.', 'an archived account');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status FROM public.leads WHERE id = pg_temp.id('refused')), 'new', 'the lead is as it was');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts), contacts_before, 'no contact was left behind');
END $$;

-- ---------- 11. The lead's labels, calls, notes and tasks move to the account and contact ----------
-- Catches: a conversion that strands the lead's work on a record nobody opens any more (CRM-L2.2: emails, calls, notes, tasks move), a moved row that still belongs to
-- the lead, or a call that does not follow the person to their contact.
DO $$
DECLARE l public.leads; lbl uuid; call_id uuid; note_id uuid; task_id uuid; acct uuid;
BEGIN
  PERFORM pg_temp.full_lead('moving', 'acme', 'acme_agent1', 'Mo Vane', 'Vane Vending', 'mo@vane.example');
  PERFORM pg_temp.claims_of('acme_agent1');
  INSERT INTO public.activities (firm_id, lead_id, kind, author_id, outcome, body) VALUES (pg_temp.id('acme'), pg_temp.id('moving'), 'call', pg_temp.id('acme_agent1'), 'spoke', 'Asked about renewals') RETURNING id INTO call_id;
  INSERT INTO public.activities (firm_id, lead_id, kind, author_id, body) VALUES (pg_temp.id('acme'), pg_temp.id('moving'), 'note', pg_temp.id('acme_agent1'), 'Prefers email') RETURNING id INTO note_id;
  INSERT INTO public.activities (firm_id, lead_id, kind, author_id, title, due_on, assignee_id) VALUES (pg_temp.id('acme'), pg_temp.id('moving'), 'task', pg_temp.id('acme_agent1'), 'Send a proposal', current_date + 3, pg_temp.id('acme_agent1')) RETURNING id INTO task_id;
  PERFORM pg_temp.as_owner();
  INSERT INTO public.labels (firm_id, name) VALUES (pg_temp.id('acme'), 'Referred') RETURNING id INTO lbl;
  INSERT INTO public.lead_labels (firm_id, lead_id, label_id) VALUES (pg_temp.id('acme'), pg_temp.id('moving'), lbl);
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.convert_lead(pg_temp.id('moving'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('moving');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE lead_id = l.id), 0::bigint, 'nothing is left on the lead');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = l.converted_account_id AND id IN (call_id, note_id, task_id)), 3::bigint, 'the call, note and task are on the account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE contact_id = l.converted_contact_id AND id IN (call_id, note_id, task_id)), 3::bigint, 'and name its contact');
  PERFORM pg_temp.is((SELECT body FROM public.activities WHERE id = note_id), 'Prefers email', 'the note is as it was written');
  PERFORM pg_temp.is((SELECT author_id FROM public.activities WHERE id = call_id), pg_temp.id('acme_agent1'), 'by the same person');
  PERFORM pg_temp.is((SELECT count(*) FROM public.account_labels WHERE account_id = l.converted_account_id AND label_id = lbl), 1::bigint, 'the label is on the account');
END $$;

-- ---------- 12. Unticking the opportunity makes none, and an archived account is still refused ----------
-- Catches: an opportunity made when the agent unticked it, and an archived account taking a contact because the refusal lived only in the opportunity's rules.
DO $$
DECLARE r jsonb; archived uuid; l public.leads;
BEGIN
  archived := pg_temp.account('archived2', 'acme', 'acme_agent1', 'Archived Two');
  UPDATE public.accounts SET archived_at = now() WHERE id = archived;
  PERFORM pg_temp.full_lead('noopp', 'acme', 'acme_agent1', 'Ola Orr', 'Orr Orchards', 'ola@orr.example');
  PERFORM pg_temp.full_lead('noopp2', 'acme', 'acme_agent1', 'Ola Orr', 'Orr Orchards Two', 'ola2@orr.example');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.convert_lead(pg_temp.id('noopp'), p_make_opportunity => false, p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.is(r -> 'opportunity', 'null'::jsonb, 'the answer says no opportunity was made');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_account_id => %L, p_make_opportunity => false, p_firm_id => %L)', pg_temp.id('noopp2'), archived, pg_temp.id('acme'))),
    '55000: This account is archived. Nothing can be added to it.', 'an archived account with no opportunity');
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('noopp');
  PERFORM pg_temp.is(l.converted_opportunity_id, NULL, 'the lead links to no opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE account_id = l.converted_account_id), 0::bigint, 'the account has none');
END $$;

-- ---------- 13. The agent can change the opportunity's name and give it a target start ----------
-- Catches: a typed name or date thrown away for the default, and a typed name that skips the opportunity's own rules (a blank or over-long name).
DO $$
DECLARE r jsonb; o public.opportunities; l public.leads;
BEGIN
  PERFORM pg_temp.full_lead('named', 'acme', 'acme_agent1', 'Nia North', 'North Nursery', 'nia@north.example');
  PERFORM pg_temp.full_lead('longname', 'acme', 'acme_agent1', 'Lou Long', 'Long Lumber', 'lou@long.example');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.convert_lead(pg_temp.id('named'), p_opportunity_name => 'North – 2027 renewal quote', p_target_start => DATE '2027-01-01', p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_opportunity_name => %L, p_firm_id => %L)', pg_temp.id('longname'), repeat('x', 201), pg_temp.id('acme'))),
    '22023: Keep the opportunity''s name to 200 characters.', 'an over-long name');
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('named');
  SELECT * INTO o FROM public.opportunities WHERE id = l.converted_opportunity_id;
  PERFORM pg_temp.is(o.name, 'North – 2027 renewal quote', 'the name as typed');
  PERFORM pg_temp.is(o.target_start, DATE '2027-01-01', 'the target start as entered');
  PERFORM pg_temp.is((SELECT status FROM public.leads WHERE id = pg_temp.id('longname')), 'new', 'a refused name leaves the lead as it was');
END $$;

-- ---------- 14. A Not a fit lead, one in the bin and one already converted are refused, in words ----------
-- Catches: a Not a fit lead converted without being reopened (D-810), a lead in the bin converted, and converting twice making a second chain.
DO $$
DECLARE accounts_before bigint;
BEGIN
  PERFORM pg_temp.full_lead('notfit', 'acme', 'acme_agent1', 'Nell Nye', 'Nye Notions', 'nell@nye.example');
  UPDATE public.leads SET status = 'not_fit', not_fit_reason = 'too_small' WHERE id = pg_temp.id('notfit');
  PERFORM pg_temp.full_lead('binned2', 'acme', 'acme_agent1', 'Bo Bin', 'Bin Bakery', 'bo@bin.example');
  UPDATE public.leads SET deleted_at = now() WHERE id = pg_temp.id('binned2');
  PERFORM pg_temp.full_lead('twice', 'acme', 'acme_agent1', 'Tia Twice', 'Twice Tailors', 'tia@twice.example');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.convert_lead(pg_temp.id('twice'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT count(*) INTO accounts_before FROM public.accounts;
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('notfit'), pg_temp.id('acme'))),
    '55000: This lead is Not a fit. Reopen it before converting it.', 'a Not a fit lead');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('binned2'), pg_temp.id('acme'))),
    'PT404: That lead isn''t available', 'a lead in the bin is not the agent''s to see, so it is as not there');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('binned2'), pg_temp.id('acme'))),
    '55000: This lead is in the bin. Restore it to change it.', 'an owner is told to restore it');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('twice'), pg_temp.id('acme'))),
    '55000: This lead was converted already.', 'converting twice');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), accounts_before, 'no second chain');
END $$;

-- ---------- 15. The lead's conversation and its reply address move to the contact (D-606) ----------
-- Catches: a lead's emails left on a record nobody writes to, a reply address that changes (replies to the old one would be held for nobody), and a conversation
-- that moves onto an account with no contact (there is no one to write to).
DO $$
DECLARE conv uuid; addr text; l public.leads; conv2 uuid;
BEGIN
  PERFORM pg_temp.full_lead('mailed', 'acme', 'acme_agent1', 'Mia Mail', 'Mail Mart', 'mia@mailmart.example');
  PERFORM pg_temp.full_lead('mailed_biz', 'acme', 'acme_agent1', 'Parcel Post', 'Parcel Post', NULL, '(503) 555-0150');
  INSERT INTO public.conversations (firm_id, lead_id, reply_address) VALUES (pg_temp.id('acme'), pg_temp.id('mailed'), 'c.miamail.0123456789abcdef') RETURNING id, reply_address INTO conv, addr;
  INSERT INTO public.conversation_messages (firm_id, conversation_id, direction, from_address, to_addresses, subject, body_text, message_id, status)
  VALUES (pg_temp.id('acme'), conv, 'inbound', 'mia@mailmart.example', ARRAY['c.miamail.0123456789abcdef@mail.example'], 'Hello', 'Hi', '<m1@mailmart.example>', 'received');
  INSERT INTO public.conversations (firm_id, lead_id, reply_address) VALUES (pg_temp.id('acme'), pg_temp.id('mailed_biz'), 'c.parcel.0123456789abcdee') RETURNING id INTO conv2;
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.convert_lead(pg_temp.id('mailed'), p_firm_id => pg_temp.id('acme'));
  PERFORM public.convert_lead(pg_temp.id('mailed_biz'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('mailed');
  PERFORM pg_temp.is((SELECT contact_id FROM public.conversations WHERE id = conv), l.converted_contact_id, 'the conversation is the contact''s');
  PERFORM pg_temp.is((SELECT lead_id FROM public.conversations WHERE id = conv), NULL, 'and no longer the lead''s');
  PERFORM pg_temp.is((SELECT reply_address FROM public.conversations WHERE id = conv), addr, 'its reply address is unchanged');
  PERFORM pg_temp.is((SELECT count(*) FROM public.conversation_messages WHERE conversation_id = conv), 1::bigint, 'its messages are with it');
  PERFORM pg_temp.is((SELECT lead_id FROM public.conversations WHERE id = conv2), pg_temp.id('mailed_biz'), 'with no contact made, the conversation stays on the lead');
END $$;

-- ---------- 16. Who may convert: the level rule on the lead's owner (D-809) ----------
-- Catches: another agent converting a lead they may not even see, an agent converting a lead with no owner (an owner's alone), a lead of the owner's team refused,
-- and another firm's lead reached by naming its id.
DO $$
DECLARE msg text;
BEGIN
  PERFORM pg_temp.full_lead('level1', 'acme', 'acme_agent2', 'Lia Lane', 'Lane Laundry', 'lia@lane.example');
  PERFORM pg_temp.full_lead('level2', 'acme', NULL, 'Lex Lord', 'Lord Lighting', 'lex@lord.example');
  PERFORM pg_temp.full_lead('level3', 'acme', 'acme_agent2', 'Lu Low', 'Low Lofts', 'lu@low.example');
  PERFORM pg_temp.full_lead('level4', 'zenith', 'zenith_agent', 'Zed Zee', 'Zee Zippers', 'zed@zee.example');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('level1'), pg_temp.id('acme'))), ':', 1), 'PT404', 'another agent''s lead is not there');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('level4'), pg_temp.id('acme'))), ':', 1), 'PT404', 'another firm''s lead is not there');
  PERFORM pg_temp.as_user('acme_agent3', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('level2'), pg_temp.id('acme'))), ':', 1), 'PT404', 'a lead with no owner is an owner''s alone');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  msg := pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('level3'), pg_temp.id('acme')));
  PERFORM pg_temp.is(msg, 'ok', 'a lead of the owner''s team converts it');
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = (SELECT converted_account_id FROM public.leads WHERE id = pg_temp.id('level3'))), pg_temp.id('acme_agent2'), 'and it stays the agent''s');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.convert_lead(pg_temp.id('level2'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = (SELECT converted_account_id FROM public.leads WHERE id = pg_temp.id('level2'))), pg_temp.id('acme_owner'), 'a lead with no owner converted by an owner is the owner''s');
END $$;

-- ---------- 17. A lead whose owner has left makes records for the person converting ----------
-- Catches: an account given to someone no longer in the firm (nobody could then change it but an owner).
DO $$
BEGIN
  PERFORM pg_temp.full_lead('departed', 'acme', 'acme_removed', 'Dee Dart', 'Dart Diner', 'dee@dart.example');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.convert_lead(pg_temp.id('departed'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = (SELECT converted_account_id FROM public.leads WHERE id = pg_temp.id('departed'))), pg_temp.id('acme_owner'), 'the account');
  PERFORM pg_temp.is((SELECT owner_id FROM public.contacts WHERE id = (SELECT converted_contact_id FROM public.leads WHERE id = pg_temp.id('departed'))), pg_temp.id('acme_owner'), 'the contact');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = (SELECT converted_opportunity_id FROM public.leads WHERE id = pg_temp.id('departed'))), pg_temp.id('acme_owner'), 'the opportunity');
END $$;

-- ---------- 18. The lead's own note becomes a note on the account and contact ----------
-- Catches: the lead's note (what a visitor asked, what the agent jotted) lost when the lead becomes read only: it is a field of the lead, not a row of calls, notes
-- and tasks, so it has to be carried over (CRM-L2.2: nothing of the lead is lost).
DO $$
DECLARE l public.leads; n public.activities;
BEGIN
  PERFORM pg_temp.full_lead('noted', 'acme', 'acme_agent1', 'Nat Noon', 'Noon Nails', 'nat@noon.example');
  PERFORM pg_temp.full_lead('unnoted', 'acme', 'acme_agent1', 'Una Noon', 'Una Nails', 'una@noon.example');
  UPDATE public.leads SET note = 'Asked to be contacted: wants a quote before June.' WHERE id = pg_temp.id('noted');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.convert_lead(pg_temp.id('noted'), p_firm_id => pg_temp.id('acme'));
  PERFORM public.convert_lead(pg_temp.id('unnoted'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('noted');
  SELECT * INTO n FROM public.activities WHERE account_id = l.converted_account_id AND kind = 'note';
  PERFORM pg_temp.is(n.body, 'Asked to be contacted: wants a quote before June.', 'the note''s text');
  PERFORM pg_temp.is(n.contact_id, l.converted_contact_id, 'on the contact too');
  PERFORM pg_temp.is(n.author_id, pg_temp.id('acme_agent1'), 'by the person converting');
  PERFORM pg_temp.is(l.note, 'Asked to be contacted: wants a quote before June.', 'the lead keeps its own note');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = (SELECT converted_account_id FROM public.leads WHERE id = pg_temp.id('unnoted'))), 0::bigint, 'no note, no empty note');
END $$;

-- ---------- 19. History: the lead's change to Converted is one entry, and what it made starts with a "created" entry by the person converting ----------
-- Catches: a conversion that leaves no trace of who did it (D-808: every status change is one history entry), or records made with nobody named.
DO $$
DECLARE l public.leads;
BEGIN
  PERFORM pg_temp.full_lead('hist', 'acme', 'acme_agent1', 'Hal Hill', 'Hill Hotels', 'hal@hill.example');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.convert_lead(pg_temp.id('hist'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('hist');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'leads' AND record_key = l.id::text AND field = 'status' AND new_value = to_jsonb('converted'::text)
                      AND actor_id = pg_temp.id('acme_agent1')), 1::bigint, 'one status entry, by the agent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'accounts' AND record_key = l.converted_account_id::text AND kind = 'created' AND actor_id = pg_temp.id('acme_agent1')), 1::bigint, 'the account''s created entry');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'contacts' AND record_key = l.converted_contact_id::text AND kind = 'created' AND actor_id = pg_temp.id('acme_agent1')), 1::bigint, 'the contact''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'opportunities' AND record_key = l.converted_opportunity_id::text AND kind = 'created' AND actor_id = pg_temp.id('acme_agent1')), 1::bigint, 'the opportunity''s');
END $$;

-- ---------- 20. Possible matches: the duplicate match (D-193) among the accounts the agent may see ----------
-- Catches: a lead converted into a second account for a business the firm has, a match the agent may not see being named (a way to learn it exists), an archived
-- account offered (it takes nothing new, D-222), a match by likeness ("Cost" for "Costco"), and a match with no state on either side.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.account('m_name', 'acme', 'acme_agent1', 'Bluebird Bakery Inc');
  UPDATE public.accounts SET state = 'OR' WHERE id = pg_temp.id('m_name');
  PERFORM pg_temp.account('m_email', 'acme', 'acme_agent1', 'Totally Different Name');
  PERFORM pg_temp.contact('m_email_c', 'm_email', 'acme_agent1', 'ceo@bluebird.example');
  PERFORM pg_temp.account('m_hidden', 'acme', 'acme_agent2', 'Bluebird Bakery');
  UPDATE public.accounts SET state = 'OR' WHERE id = pg_temp.id('m_hidden');
  PERFORM pg_temp.account('m_archived', 'acme', 'acme_agent1', 'Bluebird Bakery Co');
  UPDATE public.accounts SET state = 'OR', archived_at = now() WHERE id = pg_temp.id('m_archived');
  PERFORM pg_temp.account('m_like', 'acme', 'acme_agent1', 'Bluebird Bake');
  UPDATE public.accounts SET state = 'OR' WHERE id = pg_temp.id('m_like');
  PERFORM pg_temp.account('m_nostate', 'acme', 'acme_agent1', 'Bluebird Bakery LLC');
  PERFORM pg_temp.full_lead('matchy', 'acme', 'acme_agent1', 'Bea Bird', 'Bluebird Bakery', 'CEO@Bluebird.example');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.lead_convert_context(pg_temp.id('acme'), pg_temp.id('matchy'));
  PERFORM pg_temp.is((SELECT string_agg(m ->> 'name', ', ' ORDER BY m ->> 'name') FROM jsonb_array_elements(r -> 'matches') m), 'Bluebird Bakery Inc, Totally Different Name',
    'the same name and state, and the same contact email, among the accounts the agent sees');
  PERFORM pg_temp.is((SELECT m -> 'reasons' FROM jsonb_array_elements(r -> 'matches') m WHERE m ->> 'name' = 'Totally Different Name'), '["email"]'::jsonb, 'why');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 21. A lead with no business makes an account named after the person (D-1653) ----------
-- Catches: an account with no name, or a name that differs from "Converting makes" on the lead's page, which names the same three records.
DO $$
DECLARE l public.leads;
BEGIN
  PERFORM pg_temp.full_lead('nobiz', 'acme', 'acme_agent1', 'Ken Kemp', NULL, 'ken@kemp.example');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.convert_lead(pg_temp.id('nobiz'), p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('nobiz');
  PERFORM pg_temp.is((SELECT name FROM public.accounts WHERE id = l.converted_account_id), 'Ken Kemp', 'the account takes the lead''s name');
  PERFORM pg_temp.is((SELECT last_name FROM public.contacts WHERE id = l.converted_contact_id), 'Kemp', 'and the contact is the person');
  PERFORM pg_temp.is((SELECT name FROM public.opportunities WHERE id = l.converted_opportunity_id), 'Ken Kemp – PEO search', 'the opportunity');
END $$;

-- ---------- 22. The dialog's read: a lead the caller may not see is not there, and a stranger is refused ----------
-- Catches: the matches of a lead the caller may not see (it would tell them which accounts the firm has), and a read open to people who are not in the firm.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.lead_convert_context(%L, %L)', pg_temp.id('acme'), pg_temp.id('matchy'))), ':', 1), 'PT404', 'another agent''s lead');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.lead_convert_context(%L, %L)', pg_temp.id('acme'), pg_temp.id('matchy'))), ':', 1), '42501', 'a member of another firm');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('matchy'), pg_temp.id('acme'))), ':', 1), '42501', 'and cannot convert');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.convert_lead(%L)', pg_temp.id('matchy'))), ':', 1), '42501', 'a person of no firm');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format('SELECT public.convert_lead(%L)', pg_temp.id('matchy'))), '42501', 'a visitor cannot run it');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 18b. Into an existing account, what is made belongs to the person converting (D-1682) ----------
-- Catches (from mutation): the lead's owner given a contact and an opportunity on an account they cannot see, which the opportunity's own rule then refuses, or a record
-- nobody who made it can open.
DO $$
DECLARE r jsonb; acct uuid; l public.leads;
BEGIN
  acct := pg_temp.account('team_lead_acct', 'acme', 'acme_lead', 'Team Lead Account');
  PERFORM pg_temp.full_lead('crossed', 'acme', 'acme_agent2', 'Cass Cross', 'Cross Cafe', 'cass@cross.example');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  r := public.convert_lead(pg_temp.id('crossed'), p_account_id => acct, p_firm_id => pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  SELECT * INTO l FROM public.leads WHERE id = pg_temp.id('crossed');
  PERFORM pg_temp.is((SELECT owner_id FROM public.contacts WHERE id = l.converted_contact_id), pg_temp.id('acme_lead'), 'the contact is the converter''s');
  PERFORM pg_temp.is((SELECT owner_id FROM public.opportunities WHERE id = l.converted_opportunity_id), pg_temp.id('acme_lead'), 'and the opportunity');
END $$;

-- ---------- Z. A Nevermore support session and a closing firm read, and convert nothing (ADR 0023, ADR 0024) ----------
-- Catches: the conversion skipping the one write guard (assert_firm_writable), so a closing firm, or support, could make an account. Last: the firm is left closing.
DO $$
DECLARE before_accounts bigint;
BEGIN
  PERFORM pg_temp.full_lead('guarded', 'acme', 'acme_agent1', 'Gus Gray', 'Gray Garage', 'gus@gray.example');
  SELECT count(*) INTO before_accounts FROM public.accounts;
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.start_support_session(pg_temp.id('acme'), 'Customer asked for help with a lead');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(jsonb_typeof(public.lead_convert_context(pg_temp.id('acme'), pg_temp.id('guarded'))), 'object', 'support reads the dialog''s matches');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('guarded'), pg_temp.id('acme'))), ':', 1), 'PT423', 'support converts nothing');
  PERFORM pg_temp.as_owner();
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(jsonb_typeof(public.lead_convert_context(pg_temp.id('acme'), pg_temp.id('guarded'))), 'object', 'a closing firm still reads it');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.convert_lead(%L, p_firm_id => %L)', pg_temp.id('guarded'), pg_temp.id('acme'))), ':', 1), 'PT423', 'a closing firm converts nothing');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), before_accounts, 'nothing was made');
  PERFORM pg_temp.is((SELECT status FROM public.leads WHERE id = pg_temp.id('guarded')), 'new', 'the lead is as it was');
END $$;

SELECT 'convert_lead: all passed';
