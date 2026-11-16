-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh conversations
-- Conversations with contacts and leads, and sending one message through the agent's own mailbox (story CRM-E1.2a, slice 6.2, #196;
-- docs/BROKER_CRM_BUILD.md D-601, D-602, D-605, D-606 and D-630 to D-639; 20261122090000_conversations.sql). Two firms: Acme sees by level,
-- Zenith shows everyone everything. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261123130000_new_quote_account.sql
\i supabase/migrations/20261123200000_employer_ends_access.sql
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


-- A connected mailbox, placed as the superuser (the mailbox function stores it; the token is opaque here).
CREATE FUNCTION pg_temp.mailbox(p_user text, p_address text, p_provider text DEFAULT 'google') RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (pg_temp.id(p_user), p_provider, p_address, CASE WHEN p_provider = 'google' THEN 'https://www.googleapis.com/auth/gmail.send' ELSE 'Mail.Send' END, 'sealed', 'iv')
$$;

-- ---------- the records: Acme's agent 1 owns Reyes Bakery and a lead; agent 2 (Sales) owns Bay Cafe; Zenith has its own ----------
DO $$
BEGIN
  PERFORM pg_temp.account('reyes', 'acme', 'acme_agent1', 'Reyes Bakery & Sons');
  PERFORM pg_temp.contact('lucia', 'reyes', 'acme_agent1', 'lucia@reyes.example', NULL, true);
  PERFORM pg_temp.contact('dne', 'reyes', 'acme_agent1', 'dne@reyes.example');
  UPDATE public.contacts SET do_not_email = true WHERE id = pg_temp.id('dne');
  PERFORM pg_temp.contact('phone_only', 'reyes', 'acme_agent1', NULL, '(503) 555-0142');
  PERFORM pg_temp.account('bay', 'acme', 'acme_agent2', 'Bay Cafe');
  PERFORM pg_temp.contact('bo', 'bay', 'acme_agent2', 'bo@bay.example');
  PERFORM pg_temp.lead('ortiz', 'acme', 'acme_agent1', 'Ortiz Plumbing');
  UPDATE public.leads SET email = 'ana@ortiz.example' WHERE id = pg_temp.id('ortiz');
  PERFORM pg_temp.lead('no_email', 'acme', 'acme_agent1');
  PERFORM pg_temp.lead('binned', 'acme', 'acme_agent1');
  UPDATE public.leads SET email = 'bin@example.test', deleted_at = now() WHERE id = pg_temp.id('binned');
  PERFORM pg_temp.lead('converted', 'acme', 'acme_agent1');
  UPDATE public.leads SET email = 'conv@example.test', status = 'converted', converted_at = now(), converted_account_id = pg_temp.id('reyes')
  WHERE id = pg_temp.id('converted');
  PERFORM pg_temp.account('zen', 'zenith', 'zenith_agent', 'Zen Yoga');
  PERFORM pg_temp.contact('zoe', 'zen', 'zenith_agent', 'zoe@zen.example');
  PERFORM pg_temp.mailbox('acme_agent1', 'agent1@acme.example');
  PERFORM pg_temp.mailbox('acme_owner', 'owner@acme.example', 'microsoft');
  PERFORM pg_temp.mailbox('zenith_agent', 'zen.agent@zenith.example');
END $$;

-- ---------- 1. A conversation is with exactly one contact or one lead (D-601). Catches: a conversation on neither, or on both ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.conversations (firm_id, reply_address) VALUES (%L, 'c.x.0123456789abcdef')$q$, pg_temp.id('acme'))),
    '23514', 'a conversation with neither a contact nor a lead');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.conversations (firm_id, contact_id, lead_id, reply_address) VALUES (%L, %L, %L, 'c.x.0123456789abcdef')$q$,
    pg_temp.id('acme'), pg_temp.id('lucia'), pg_temp.id('ortiz'))), '23514', 'a conversation with both');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.conversations (firm_id, contact_id, reply_address) VALUES (%L, %L, 'c.x.0123456789abcdef')$q$,
    pg_temp.id('acme'), pg_temp.id('lucia'))), 'rows:1', 'a conversation with a contact');
END $$;

-- ---------- 2. One conversation per contact and one per lead (D-601). Catches: a second thread with the same person ----------
DO $$
BEGIN
  INSERT INTO public.conversations (firm_id, contact_id, reply_address) VALUES (pg_temp.id('acme'), pg_temp.id('bo'), 'c.bay.00000000000000aa');
  INSERT INTO public.conversations (firm_id, lead_id, reply_address) VALUES (pg_temp.id('acme'), pg_temp.id('no_email'), 'c.lead.00000000000000bb');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.conversations (firm_id, contact_id, reply_address) VALUES (%L, %L, 'c.bay.00000000000000cc')$q$,
    pg_temp.id('acme'), pg_temp.id('bo'))), '23505', 'a second conversation with a contact');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.conversations (firm_id, lead_id, reply_address) VALUES (%L, %L, 'c.lead.00000000000000dd')$q$,
    pg_temp.id('acme'), pg_temp.id('no_email'))), '23505', 'a second conversation with a lead');
END $$;


-- ---------- 3. A conversation's contact or lead is of its own firm (D-28). Catches: a firm's thread pointing at another firm's person ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.conversations (firm_id, contact_id, reply_address) VALUES (%L, %L, 'c.zen.00000000000000ee')$q$,
    pg_temp.id('acme'), pg_temp.id('zoe'))), '23503', 'Acme''s conversation with Zenith''s contact');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.conversations (firm_id, lead_id, reply_address) VALUES (%L, %L, 'c.zen.00000000000000ef')$q$,
    pg_temp.id('zenith'), pg_temp.id('ortiz'))), '23503', 'Zenith''s conversation with Acme''s lead');
END $$;

-- ---------- 4. A conversation is deleted with its account (through its contact) and with its lead. Catches: mail left behind a deleted record ----------
DO $$
BEGIN
  PERFORM pg_temp.account('gone', 'acme', 'acme_agent1', 'Gone Ltd');
  PERFORM pg_temp.contact('gina', 'gone', 'acme_agent1', 'gina@gone.example');
  PERFORM pg_temp.lead('gone_lead', 'acme', 'acme_agent1');
  INSERT INTO public.conversations (firm_id, contact_id, reply_address) VALUES (pg_temp.id('acme'), pg_temp.id('gina'), 'c.gone.00000000000000f1');
  INSERT INTO public.conversations (firm_id, lead_id, reply_address) VALUES (pg_temp.id('acme'), pg_temp.id('gone_lead'), 'c.gone.00000000000000f2');
  DELETE FROM public.accounts WHERE id = pg_temp.id('gone');
  DELETE FROM public.leads WHERE id = pg_temp.id('gone_lead');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversations WHERE reply_address IN ('c.gone.00000000000000f1', 'c.gone.00000000000000f2')), 0,
    'the conversations of a deleted account and a deleted lead');
END $$;

-- ---------- 5. A reply address names one conversation (D-606). Catches: two threads sharing an address, so a reply lands in the wrong one ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.conversations (firm_id, contact_id, reply_address) VALUES (%L, %L, 'c.bay.00000000000000aa')$q$,
    pg_temp.id('acme'), pg_temp.id('dne'))), '23505', 'a second conversation with the same address');
END $$;

-- ---------- 6. A reply address reads c.<name>.<16 hex>, lower case (D-606). Catches: an address a quote request's could be taken for, or one mail rejects ----------
DO $$
DECLARE bad text;
BEGIN
  FOREACH bad IN ARRAY ARRAY['eaa-2026-1.bay.00000000000000a1', 'C.Bay.00000000000000a1', 'c.bay cafe.00000000000000a1', 'c.bay.00a1', 'c..00000000000000a1'] LOOP
    PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.conversations (firm_id, contact_id, reply_address) VALUES (%L, %L, %L)$q$,
      pg_temp.id('acme'), pg_temp.id('dne'), bad)), '23514', 'the address ' || bad);
  END LOOP;
END $$;

-- A message as the superuser places it (only send_conversation_message writes one through the API). $1 firm, $2 conversation's address, $3 Message-ID.
CREATE FUNCTION pg_temp.place_message(p_firm text, p_address text, p_message_id text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.attempt(format($q$INSERT INTO public.conversation_messages (firm_id, conversation_id, direction, from_address, to_addresses, subject, body_text, message_id, sender_id)
    SELECT %L, c.id, 'outbound', 'agent1@acme.example', ARRAY['bo@bay.example'], 'Hello', 'Hi Bo', %L, %L FROM public.conversations c WHERE c.reply_address = %L$q$,
    pg_temp.id(p_firm), p_message_id, pg_temp.id('acme_agent1'), p_address))
$$;

-- ---------- 7. A message is on a conversation of its own firm (D-601, D-28). Catches: a firm's message filed in another firm's thread ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.place_message('zenith', 'c.bay.00000000000000aa', '<m7a@acme.example>'), '23503', 'Zenith''s message on Acme''s conversation');
  PERFORM pg_temp.is(pg_temp.place_message('acme', 'c.bay.00000000000000aa', '<m7b@acme.example>'), 'rows:1', 'Acme''s message on its own conversation');
END $$;

-- ---------- 8. A message starts queued, and is queued, sent or failed (D-602). Catches: a message recorded as sent before anything went out ----------
DO $$
BEGIN
  INSERT INTO public.conversation_messages (firm_id, conversation_id, direction, from_address, to_addresses, subject, body_text, message_id, sender_id)
  SELECT c.firm_id, c.id, 'outbound', 'agent1@acme.example', ARRAY['bo@bay.example'], 'Hello', 'Hi Bo', '<m8@acme.example>', pg_temp.id('acme_agent1')
  FROM public.conversations c WHERE c.reply_address = 'c.bay.00000000000000aa';
  PERFORM pg_temp.is((SELECT status FROM public.conversation_messages WHERE message_id = '<m8@acme.example>'), 'queued', 'a message placed with no status');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.conversation_messages SET status = 'delivered' WHERE message_id = '<m8@acme.example>'$q$), '23514', 'a status of delivered');
END $$;

-- ---------- 9. A failed message says what kind of failure and why, in words; only a failed one does. Catches: "Failed" with nothing to act on ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.conversation_messages SET status = 'failed' WHERE message_id = '<m8@acme.example>'$q$), '23514', 'failed with no kind or reason');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.conversation_messages SET status = 'failed', failure_kind = 'mailbox', failure_reason = 'Connect your mailbox again.' WHERE message_id = '<m8@acme.example>'$q$),
    'rows:1', 'failed for a mailbox reason, said in words');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.conversation_messages SET status = 'failed', failure_kind = 'gremlins', failure_reason = 'x' WHERE message_id = '<m8@acme.example>'$q$),
    '23514', 'a kind of failure nobody knows');
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.conversation_messages SET failure_kind = 'mailbox', failure_reason = 'x' WHERE message_id = '<m8@acme.example>'$q$),
    '23514', 'a reason on a message still queued');
END $$;

-- ---------- 10. A provider's id names one message (D-602). Catches: one send recorded against two messages ----------
DO $$
BEGIN
  INSERT INTO public.conversation_messages (firm_id, conversation_id, direction, from_address, to_addresses, subject, body_text, message_id, sender_id, provider_message_id)
  SELECT c.firm_id, c.id, 'outbound', 'agent1@acme.example', ARRAY['bo@bay.example'], 'Hello', 'Hi Bo', '<m10@acme.example>', pg_temp.id('acme_agent1'), 'gmail-1'
  FROM public.conversations c WHERE c.reply_address = 'c.bay.00000000000000aa';
  PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.conversation_messages SET provider_message_id = 'gmail-1' WHERE message_id = '<m8@acme.example>'$q$), '23505',
    'a second message with the same provider id');
END $$;

-- ---------- 11. A Message-ID names one message (RFC 5322; M-2.1). Catches: a reply's In-Reply-To matching two messages ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.place_message('acme', 'c.bay.00000000000000aa', '<m8@acme.example>'), '23505', 'a second message with the same Message-ID');
END $$;

-- How many rows of a table the current caller reads (row security applies), or 'denied'.
CREATE FUNCTION pg_temp.counted(tbl text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %s', tbl) INTO n;
  RETURN n::text;
EXCEPTION WHEN insufficient_privilege THEN RETURN 'denied';
END $$;

-- ---------- 12. Conversations and messages are read by the level rule, as calls, notes and tasks are (D-209, D-809). Catches: an agent reading a
-- colleague's client mail, or another firm reading it ----------
-- Acme has two: Bay Cafe's contact Bo (agent 2, of Sales; two messages) and agent 1's lead (none).
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('acme_agent1', 'acme-brokers', '1', '0'),
    ('acme_agent2', 'acme-brokers', '1', '2'),
    ('acme_lead', 'acme-brokers', '1', '2'),
    ('acme_owner', 'acme-brokers', '2', '2'),
    ('acme_removed', 'acme-brokers', '0', '0'),
    ('zenith_owner', 'zenith-benefits', '0', '0'),
    ('nobody', NULL, '0', '0')
  ) AS v (who, addr, convs, msgs) LOOP
    PERFORM pg_temp.as_user(c.who, c.addr);
    PERFORM pg_temp.is(pg_temp.counted('public.conversations'), c.convs, c.who || ' reads conversations');
    PERFORM pg_temp.is(pg_temp.counted('public.conversation_messages'), c.msgs, c.who || ' reads messages');
  END LOOP;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.counted('public.conversations'), 'denied', 'a guest reads conversations');
  PERFORM pg_temp.is(pg_temp.counted('public.conversation_messages'), 'denied', 'a guest reads messages');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 13. No API role writes a conversation or a message (D-601). Catches: a browser rewriting what was sent, or forging a message ----------
DO $$
DECLARE stmt text;
BEGIN
  FOREACH stmt IN ARRAY ARRAY[
    format($q$INSERT INTO public.conversations (firm_id, contact_id, reply_address) VALUES (%L, %L, 'c.x.00000000000000f9')$q$, pg_temp.id('acme'), pg_temp.id('dne')),
    $q$UPDATE public.conversations SET reply_address = 'c.x.00000000000000f8'$q$,
    $q$DELETE FROM public.conversations$q$,
    $q$UPDATE public.conversation_messages SET body_text = 'changed'$q$,
    $q$DELETE FROM public.conversation_messages$q$] LOOP
    PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
    PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'an owner: ' || left(stmt, 40));
    PERFORM pg_temp.as_service();
    PERFORM pg_temp.is(pg_temp.attempt(stmt), '42501', 'the service role: ' || left(stmt, 40));
  END LOOP;
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.place_message('acme', 'c.bay.00000000000000aa', '<m13@acme.example>'), '42501', 'an owner places a message');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 14. An agent writes to their contact: recorded as queued, from their own mailbox to the contact (D-602). Catches: a message from someone
-- else's address, or to the wrong person ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.send_conversation_message(p_contact_id => pg_temp.id('lucia'), p_subject => '  Your renewal ', p_body => 'Hi Lucia,' || chr(10) || 'Shall we talk?');
  PERFORM pg_temp.is(r ->> 'status', 'queued', 'its status');
  PERFORM pg_temp.is(r ->> 'direction', 'outbound', 'its direction');
  PERFORM pg_temp.is(r ->> 'from_address', 'agent1@acme.example', 'from the sender''s connected mailbox');
  PERFORM pg_temp.is(r -> 'to_addresses', '["lucia@reyes.example"]'::jsonb, 'to the contact');
  PERFORM pg_temp.is(r ->> 'subject', 'Your renewal', 'the subject, trimmed');
  PERFORM pg_temp.is(r ->> 'body_text', 'Hi Lucia,' || chr(10) || 'Shall we talk?', 'the body as written');
  PERFORM pg_temp.is((r ->> 'sender_id')::uuid, pg_temp.id('acme_agent1'), 'the sender');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_messages m WHERE m.id = (r ->> 'id')::uuid), 1, 'and the sender reads it');
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('m_lucia_1', (r ->> 'id')::uuid);
END $$;

-- ---------- 15. The first message issues the conversation and its address; the next uses them (D-606). Catches: a new thread per message, so replies
-- scatter ----------
DO $$
DECLARE r jsonb; addr text;
BEGIN
  SELECT c.reply_address INTO addr FROM public.conversations c WHERE c.contact_id = pg_temp.id('lucia');
  PERFORM pg_temp.is(addr ~ '^c\.reyesbakerysons\.[0-9a-f]{16}$', true, 'the address names the account, shortened: ' || COALESCE(addr, 'none'));
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.send_conversation_message(p_contact_id => pg_temp.id('lucia'), p_subject => 'Again', p_body => 'Hello again');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversations c WHERE c.contact_id = pg_temp.id('lucia')), 1, 'still one conversation');
  PERFORM pg_temp.is((SELECT c.reply_address FROM public.conversations c WHERE c.id = (r ->> 'conversation_id')::uuid), addr, 'with the same address');
  INSERT INTO fx VALUES ('m_lucia_2', (r ->> 'id')::uuid);
END $$;

-- ---------- 16. A message's own Message-ID is <its id@the From domain>, set when it is recorded (M-2.1). Catches: a Message-ID that names another
-- domain, or one a reply can't be matched back by ----------
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT m.message_id FROM public.conversation_messages m WHERE m.id = pg_temp.id('m_lucia_1')), '<' || pg_temp.id('m_lucia_1') || '@acme.example>',
    'the Message-ID');
  PERFORM pg_temp.is((SELECT m.recorded_at = m.recorded_at FROM public.conversation_messages m WHERE m.id = pg_temp.id('m_lucia_1')), true, 'it says when it was recorded');
END $$;

-- ---------- 17. Each message is queued on the outbox with its id and nothing else (D-602). Catches: a message recorded but never sent, or mail content
-- copied into the queue ----------
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.outbox_events e WHERE e.kind = 'conversation_message' AND e.status = 'pending' AND e.firm_id = pg_temp.id('acme')
                        AND e.payload = jsonb_build_object('message_id', pg_temp.id('m_lucia_1'))), 1, 'the first message''s event, its id alone');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.outbox_events e WHERE e.kind = 'conversation_message'), 2, 'one event per message');
END $$;

-- ---------- 18. Only to a record the caller may see; any other is PT404, whoever's it is (D-209). Catches: writing to a colleague's client, or learning
-- that another firm's contact exists ----------
DO $$
DECLARE before int := (SELECT count(*) FROM public.conversation_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('bo'))), ':', 1),
    'PT404', 'a colleague''s contact');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('zoe'))), ':', 1),
    'PT404', 'another firm''s contact');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, gen_random_uuid())), ':', 1),
    'PT404', 'a contact that does not exist');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT public.send_conversation_message(p_subject => 'S', p_body => 'B')$q$), ':', 1), 'PT404', 'no record named');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_messages), before, 'none of them recorded a message');
END $$;

-- ---------- 19. An agent writes to their lead: to the lead's email, on the lead's conversation, its address naming the business (D-606). Catches: a lead's
-- mail with no thread, or a colleague writing to a lead they can't see ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_lead_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('ortiz'))), ':', 1),
    'PT404', 'a colleague''s lead');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.send_conversation_message(p_lead_id => pg_temp.id('ortiz'), p_subject => 'Hello Ana', p_body => 'About your plumbers');
  PERFORM pg_temp.is(r -> 'to_addresses', '["ana@ortiz.example"]'::jsonb, 'to the lead');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT c.lead_id FROM public.conversations c WHERE c.id = (r ->> 'conversation_id')::uuid), pg_temp.id('ortiz'), 'on the lead''s conversation');
  PERFORM pg_temp.is((SELECT c.reply_address ~ '^c\.ortizplumbing\.[0-9a-f]{16}$' FROM public.conversations c WHERE c.id = (r ->> 'conversation_id')::uuid), true,
    'its address names the business');
  INSERT INTO fx VALUES ('m_ortiz_1', (r ->> 'id')::uuid);
END $$;

-- ---------- 20. A lead in the bin or converted is not written to (CRM-L1.1, CRM-L2.2). Catches: mail to a lead that was thrown away, or to one whose mail
-- now belongs to its contact ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_lead_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('binned'))),
    'PT409: This lead is in the bin. Restore it to write to it.', 'a lead in the bin, even for an owner who sees the bin');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_lead_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('converted'))),
    'PT409: This lead was converted. Write to its contact instead.', 'a converted lead');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_lead_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('binned'))), ':', 1),
    'PT404', 'a lead in the bin, for its agent, who no longer sees it');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 21. Do not email, and no email, are refused (CRM-E1.2). Catches: mail to a person who asked for none, or a message with nobody to go to ----------
DO $$
DECLARE before int := (SELECT count(*) FROM public.conversation_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('dne'))),
    'PT409: This contact is marked Do not email.', 'a contact marked Do not email');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('phone_only'))),
    'PT409: This contact has no email address. Add one first.', 'a contact with no email');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_lead_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('no_email'))),
    'PT409: This lead has no email address. Add one first.', 'a lead with no email');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_messages), before, 'none of them recorded a message');
END $$;

-- ---------- 22. A message has a subject and a body (CRM-E1.2). Catches: an empty email going out in the agent's name ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => '   ', p_body => 'B')$q$, pg_temp.id('lucia'))),
    '22023: Enter a subject.', 'a blank subject');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => E' \n ')$q$, pg_temp.id('lucia'))),
    '22023: Write a message.', 'a blank body');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S')$q$, pg_temp.id('lucia'))),
    '22023: Write a message.', 'no body');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 23. A subject is one line of at most 300 characters; a body at most 50,000 (D-636). Catches: a subject that breaks into a second header,
-- or a message no mailbox takes ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => E'Hi\r\nBcc: x@evil.example', p_body => 'B')$q$, pg_temp.id('lucia'))),
    '22023: A subject is one line.', 'a subject with a line break');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => %L, p_body => 'B')$q$, pg_temp.id('lucia'), repeat('s', 301))),
    '22023: A subject is at most 300 characters.', 'a subject of 301 characters');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => %L)$q$, pg_temp.id('lucia'), repeat('b', 50001))),
    '22023: A message is at most 50,000 characters.', 'a body of 50,001 characters');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => %L, p_body => %L)$q$,
    pg_temp.id('lucia'), repeat('s', 300), repeat('b', 50000))), 'rows:1', 'a subject of 300 and a body of 50,000');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 24. At most 10 in CC, each an address by the one rule the message builder also uses (D-637). Catches: a CC that smuggles a header or a
-- list of strangers ----------
DO $$
DECLARE r jsonb; eleven text[] := ARRAY(SELECT 'p' || g || '@x.example' FROM generate_series(1, 11) g);
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B', p_cc => %L)$q$, pg_temp.id('lucia'), eleven)),
    '22023: At most 10 people in CC.', 'eleven in CC');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B', p_cc => %L)$q$, pg_temp.id('lucia'),
    ARRAY['ok@x.example', E'a@b.example\r\nBcc: z@evil.example'])), '22023: Enter each CC address like name@example.com.', 'a CC with a line break');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B', p_cc => %L)$q$, pg_temp.id('lucia'),
    ARRAY['Bo <bo@x.example>'])), '22023: Enter each CC address like name@example.com.', 'a CC with a name');
  r := public.send_conversation_message(p_contact_id => pg_temp.id('lucia'), p_subject => 'With CC', p_body => 'B', p_cc => ARRAY[' sam@reyes.example ', 'tom@reyes.example']);
  PERFORM pg_temp.is(r -> 'cc_addresses', '["sam@reyes.example", "tom@reyes.example"]'::jsonb, 'the CC, trimmed');
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('m_lucia_cc', (r ->> 'id')::uuid);
END $$;

-- ---------- 25. The person's own address must pass the same rule (D-637). Catches: a contact's email the table took (it asks less) that the message
-- builder would refuse, leaving a message queued that can never go ----------
DO $$
BEGIN
  PERFORM pg_temp.contact('nodot', 'reyes', 'acme_agent1', 'pat@localhost');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('nodot'))),
    'PT409: This contact''s email address can''t be written to. Correct it first.', 'a contact whose address the rule refuses');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.lead('lead_nodot', 'acme', 'acme_agent1');
  UPDATE public.leads SET email = 'pat@localhost' WHERE id = pg_temp.id('lead_nodot');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_lead_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('lead_nodot'))),
    'PT409: This lead''s email address can''t be written to. Correct it first.', 'a lead whose address the rule refuses');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 26. A sender with no connected mailbox is told to connect one, and nothing is recorded (CRM-E1.1, D-634). Catches: a queued message with no
-- From that can never go ----------
DO $$
DECLARE before int := (SELECT count(*) FROM public.conversation_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('bo'))),
    'PT412: Connect your mailbox to send from here.', 'an agent with no mailbox');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_messages), before, 'nothing recorded');
END $$;

-- ---------- 27. In-Reply-To and References only when the writer names the message they answer, and only one of this conversation (M-2.1). Catches: a new
-- message threaded under an old one by accident, or under another person's mail ----------
DO $$
DECLARE r1 jsonb; r2 jsonb; m1 text := (SELECT message_id FROM public.conversation_messages WHERE id = pg_temp.id('m_lucia_1'));
BEGIN
  PERFORM pg_temp.is((SELECT m.in_reply_to IS NULL AND m.message_references = '{}' FROM public.conversation_messages m WHERE m.id = pg_temp.id('m_lucia_2')), true,
    'a message that answers none');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r1 := public.send_conversation_message(p_contact_id => pg_temp.id('lucia'), p_subject => 'Re: Your renewal', p_body => 'Following up', p_in_reply_to => pg_temp.id('m_lucia_1'));
  PERFORM pg_temp.is(r1 ->> 'in_reply_to', m1, 'In-Reply-To names the message answered');
  PERFORM pg_temp.is(r1 -> 'message_references', jsonb_build_array(m1), 'References lists it');
  r2 := public.send_conversation_message(p_contact_id => pg_temp.id('lucia'), p_subject => 'Re: Your renewal', p_body => 'And again', p_in_reply_to => (r1 ->> 'id')::uuid);
  PERFORM pg_temp.is(r2 -> 'message_references', jsonb_build_array(m1, r1 ->> 'message_id'), 'References lists the thread, oldest first');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B', p_in_reply_to => %L)$q$,
    pg_temp.id('lucia'), pg_temp.id('m_ortiz_1'))), '22023: That message isn''t in this conversation.', 'answering a message of another conversation');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 28. conversation_for gives the conversation, newest first, to whoever may see the record; PT404 to anyone else (D-601). Catches: an old
-- message shown first, or a colleague's client mail read through the function ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.conversation_for(p_contact_id => pg_temp.id('lucia'));
  PERFORM pg_temp.is(r -> 'conversation' ->> 'reply_address', (SELECT reply_address FROM public.conversations WHERE contact_id = pg_temp.id('lucia')), 'the conversation');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'messages'), 5, 'its five messages');
  PERFORM pg_temp.is(r -> 'messages' -> 0 ->> 'subject', 'Re: Your renewal', 'newest first');
  PERFORM pg_temp.is(r -> 'messages' -> 4 ->> 'id', pg_temp.id('m_lucia_1')::text, 'the first message last');
  r := public.conversation_for(p_contact_id => pg_temp.id('dne'));
  PERFORM pg_temp.is(r -> 'conversation', 'null'::jsonb, 'a contact never written to has no conversation');
  PERFORM pg_temp.is(r -> 'messages', '[]'::jsonb, 'and no messages');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.conversation_for(p_contact_id => %L)$q$, pg_temp.id('lucia'))), ':', 1), 'PT404', 'a colleague''s contact');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.conversation_for(p_lead_id => %L)$q$, pg_temp.id('ortiz'))), ':', 1), 'PT404', 'a colleague''s lead');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.conversation_for(p_contact_id => %L)$q$, pg_temp.id('lucia'))), ':', 1), 'PT404', 'another firm''s contact');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 29. A contact's conversation follows the contact to another account (D-606). Catches: mail left on the old account, read by its people and
-- lost to the new one's ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.contact('mia', 'reyes', 'acme_agent1', 'mia@reyes.example');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.send_conversation_message(p_contact_id => pg_temp.id('mia'), p_subject => 'Before the move', p_body => 'B');
  PERFORM pg_temp.as_owner();
  UPDATE public.contacts SET account_id = pg_temp.id('bay') WHERE id = pg_temp.id('mia');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  r := public.conversation_for(p_contact_id => pg_temp.id('mia'));
  PERFORM pg_temp.is(r -> 'messages' -> 0 ->> 'subject', 'Before the move', 'the new account''s agent reads it');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.conversation_for(p_contact_id => %L)$q$, pg_temp.id('mia'))), ':', 1), 'PT404', 'the old account''s agent no longer does');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 30. conversation_for says whether the caller has a mailbox and whether their last send failed for a mailbox reason, so the place to write
-- says Connect or Reconnect (CRM-E1.1). Catches: a place to write that offers Send to someone who can't, or hides why the last one failed ----------
DO $$
DECLARE r jsonb; last_one uuid;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.conversation_for(p_contact_id => pg_temp.id('lucia'));
  PERFORM pg_temp.is(r -> 'mailbox', '{"connected": true, "last_send_failed": false}'::jsonb, 'an agent with a mailbox whose sends have not failed');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  r := public.conversation_for(p_contact_id => pg_temp.id('bo'));
  PERFORM pg_temp.is(r -> 'mailbox', '{"connected": false, "last_send_failed": false}'::jsonb, 'an agent with none: Connect');
  -- Agent 1's newest send failed because Google took the permission back, and the token was deleted with it.
  PERFORM pg_temp.as_owner();
  SELECT m.id INTO last_one FROM public.conversation_messages m WHERE m.sender_id = pg_temp.id('acme_agent1') ORDER BY m.recorded_at DESC, m.id DESC LIMIT 1;
  UPDATE public.conversation_messages SET status = 'failed', failure_kind = 'mailbox', failure_reason = 'Google no longer lets Nevermore send as you.' WHERE id = last_one;
  DELETE FROM public.broker_mailboxes WHERE user_id = pg_temp.id('acme_agent1');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.conversation_for(p_contact_id => pg_temp.id('lucia'));
  PERFORM pg_temp.is(r -> 'mailbox', '{"connected": false, "last_send_failed": true}'::jsonb, 'the last send failed for a mailbox reason: Reconnect');
  -- A failure that was not the mailbox's says nothing about it.
  PERFORM pg_temp.as_owner();
  UPDATE public.conversation_messages SET failure_kind = 'refused' WHERE id = last_one;
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(public.conversation_for(p_contact_id => pg_temp.id('lucia')) -> 'mailbox' -> 'last_send_failed', 'false'::jsonb, 'a refusal by the provider');
  PERFORM pg_temp.as_owner();
  -- As it was: queued, and the mailbox connected again.
  UPDATE public.conversation_messages SET status = 'queued', failure_kind = NULL, failure_reason = NULL WHERE id = last_one;
  PERFORM pg_temp.mailbox('acme_agent1', 'agent1@acme.example');
END $$;

-- ---------- 31. The send-mail function claims queued messages, the oldest first, each with what it needs to build the email and a lease (D-638). Only
-- the service role may. Catches: a browser claiming mail, two workers sending the same message, or a message claimed without its reply address ----------
DO $$
DECLARE c record; n int; first_row record;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal('SELECT * FROM public.claim_conversation_mail(1, 5, 600)'), ':', 1), '42501', 'an owner claims mail');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(split_part(pg_temp.refusal('SELECT * FROM public.claim_conversation_mail(1, 5, 600)'), ':', 1), '42501', 'a guest claims mail');
  PERFORM pg_temp.as_service();
  SELECT * INTO first_row FROM public.claim_conversation_mail(1, 5, 600);
  PERFORM pg_temp.is(first_row.attempt, 1, 'the first attempt');
  PERFORM pg_temp.is((first_row.message ->> 'id')::uuid, pg_temp.id('m_lucia_1'), 'the oldest queued message first');
  PERFORM pg_temp.is(first_row.message ->> 'sender_id', pg_temp.id('acme_agent1')::text, 'with its sender, whose mailbox sends it');
  PERFORM pg_temp.is(first_row.message ->> 'reply_address', (SELECT reply_address FROM public.conversations WHERE contact_id = pg_temp.id('lucia')), 'and its reply address');
  PERFORM pg_temp.is(first_row.message ->> 'message_id', '<' || pg_temp.id('m_lucia_1') || '@acme.example>', 'and its Message-ID');
  SELECT count(*) INTO n FROM public.claim_conversation_mail(100, 5, 600) x WHERE (x.message ->> 'id')::uuid = pg_temp.id('m_lucia_1');
  PERFORM pg_temp.is(n, 0, 'a message under lease is not claimed again');
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('ev_lucia_1', first_row.event_id);
  -- The rest go back to waiting, as they were.
  UPDATE public.outbox_events SET status = 'pending', attempts = 0, claimed_at = NULL, locked_until = NULL WHERE kind = 'conversation_message' AND id <> first_row.event_id;
END $$;

-- ---------- 32. Completing marks the message sent, with the provider's id and when; only the worker holding that attempt's claim may (D-638). Catches:
-- a lost worker's late answer overwriting a retry's, or a sent message still shown queued ----------
DO $$
DECLARE m public.conversation_messages;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.complete_conversation_mail(%L, 1, %L)', pg_temp.id('ev_lucia_1'), 'gmail-x')), ':', 1), '42501',
    'an owner completes a send');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.complete_conversation_mail(pg_temp.id('ev_lucia_1'), 2, 'gmail-late'), false, 'an attempt that does not hold the claim');
  PERFORM pg_temp.is(public.complete_conversation_mail(pg_temp.id('ev_lucia_1'), 1, 'gmail-18c2f'), true, 'the attempt that holds it');
  PERFORM pg_temp.as_owner();
  SELECT * INTO m FROM public.conversation_messages WHERE id = pg_temp.id('m_lucia_1');
  PERFORM pg_temp.is(m.status, 'sent', 'the message is sent');
  PERFORM pg_temp.is(m.provider_message_id, 'gmail-18c2f', 'with the provider''s id');
  PERFORM pg_temp.is(m.sent_at IS NOT NULL, true, 'and when');
  PERFORM pg_temp.is((SELECT status FROM public.outbox_events WHERE id = pg_temp.id('ev_lucia_1')), 'sent', 'its event is done');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.complete_conversation_mail(pg_temp.id('ev_lucia_1'), 1, 'gmail-again'), false, 'completing it twice');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT provider_message_id FROM public.conversation_messages WHERE id = pg_temp.id('m_lucia_1')), 'gmail-18c2f', 'keeps the first id');
END $$;

-- ---------- 33. A failure is retried later, the message still queued, or is final, the message failed with its kind and reason (D-632, D-638). Catches:
-- a final failure shown as still on its way, a retry shown as failed, or a stale worker's failure landing on a newer attempt ----------
DO $$
DECLARE c record; m public.conversation_messages; e public.outbox_events;
BEGIN
  PERFORM pg_temp.as_service();
  SELECT * INTO c FROM public.claim_conversation_mail(1, 5, 600);
  PERFORM pg_temp.is((c.message ->> 'id')::uuid, pg_temp.id('m_lucia_2'), 'the next message is claimed');
  PERFORM pg_temp.is(public.fail_conversation_mail(c.event_id, c.attempt + 1, 'unavailable', 'Google didn''t answer.', 60), false, 'an attempt that does not hold the claim');
  PERFORM pg_temp.is(public.fail_conversation_mail(c.event_id, c.attempt, 'unavailable', 'Google didn''t answer.', 60), true, 'a failure to retry');
  PERFORM pg_temp.as_owner();
  SELECT * INTO m FROM public.conversation_messages WHERE id = pg_temp.id('m_lucia_2');
  SELECT * INTO e FROM public.outbox_events WHERE id = c.event_id;
  PERFORM pg_temp.is(m.status, 'queued', 'a message to retry is still queued');
  PERFORM pg_temp.is(e.status, 'pending', 'and its event waits');
  PERFORM pg_temp.is(e.next_attempt_at > now() + interval '50 seconds', true, 'for the retry''s delay');
  PERFORM pg_temp.is(e.last_error, 'unavailable', 'its event keeps the kind of failure, not the words');
  -- The retry comes round and fails for good.
  UPDATE public.outbox_events SET next_attempt_at = now() - interval '1 day' WHERE id = c.event_id;
  PERFORM pg_temp.as_service();
  SELECT * INTO c FROM public.claim_conversation_mail(1, 5, 600);
  PERFORM pg_temp.is(c.attempt, 2, 'the second attempt');
  PERFORM pg_temp.is(public.fail_conversation_mail(c.event_id, c.attempt, 'mailbox', 'Google no longer lets Nevermore send as you. Connect your mailbox again.', NULL), true,
    'a final failure');
  PERFORM pg_temp.as_owner();
  SELECT * INTO m FROM public.conversation_messages WHERE id = pg_temp.id('m_lucia_2');
  PERFORM pg_temp.is(m.status || ' ' || m.failure_kind || ': ' || m.failure_reason, 'failed mailbox: Google no longer lets Nevermore send as you. Connect your mailbox again.',
    'the message failed, saying why');
  PERFORM pg_temp.is((SELECT status FROM public.outbox_events WHERE id = c.event_id), 'dead', 'its event is dead');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.fail_conversation_mail(%L, 2, ''refused'', ''x'', NULL)', c.event_id)), ':', 1), '42501',
    'an owner fails a send');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 34. A worker lost on the last attempt leaves its message failed as uncertain, not queued for good (D-632). The outbox's own reaper ends the
-- event; the message says it may have gone. Catches: a message shown "Sending" forever after its worker died ----------
DO $$
DECLARE c record; m public.conversation_messages;
BEGIN
  PERFORM pg_temp.as_service();
  SELECT * INTO c FROM public.claim_conversation_mail(1, 5, 600);
  PERFORM pg_temp.as_owner();
  UPDATE public.outbox_events SET attempts = 5, locked_until = now() - interval '1 minute' WHERE id = c.event_id;
  PERFORM pg_temp.as_service();
  PERFORM public.reap_outbox_events(5);
  PERFORM pg_temp.as_owner();
  SELECT * INTO m FROM public.conversation_messages WHERE id = (c.message ->> 'id')::uuid;
  PERFORM pg_temp.is(m.status || ' ' || m.failure_kind, 'failed uncertain', 'the message of a lost worker''s last attempt');
  PERFORM pg_temp.is(m.failure_reason, 'This message may have been sent. Look in your Sent folder before writing again.', 'saying what to do');
END $$;

-- ---------- 35. A queued message whose record was deleted is never sent, and its event ends (D-601). Catches: mail going out to a client the firm has
-- just deleted, or an event retried for good ----------
DO $$
DECLARE r jsonb; ev uuid; n int;
BEGIN
  PERFORM pg_temp.account('soon_gone', 'acme', 'acme_agent1', 'Soon Gone Inc');
  PERFORM pg_temp.contact('sid', 'soon_gone', 'acme_agent1', 'sid@soongone.example');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.send_conversation_message(p_contact_id => pg_temp.id('sid'), p_subject => 'S', p_body => 'B');
  PERFORM pg_temp.as_owner();
  SELECT id INTO ev FROM public.outbox_events WHERE payload ->> 'message_id' = r ->> 'id';
  UPDATE public.outbox_events SET next_attempt_at = now() - interval '2 days' WHERE id = ev;
  DELETE FROM public.accounts WHERE id = pg_temp.id('soon_gone');
  PERFORM pg_temp.as_service();
  SELECT count(*) INTO n FROM public.claim_conversation_mail(1, 5, 600);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status || ' ' || last_error FROM public.outbox_events WHERE id = ev), 'suppressed cancelled: the message is gone', 'its event ends');
  PERFORM pg_temp.is(n, 1, 'and the claim takes the next one instead');
  UPDATE public.outbox_events SET status = 'pending', attempts = 0, claimed_at = NULL, locked_until = NULL WHERE kind = 'conversation_message' AND status = 'claimed';
END $$;

-- ---------- 36. Who may send at all: a current member of the firm, not Nevermore support, not a closing firm (ADR 0023, ADR 0024). Catches: support
-- sending mail in an agent's name, a closing firm still writing to clients, or a stranger sending at all ----------
DO $$
DECLARE before int := (SELECT count(*) FROM public.conversation_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_removed', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('lucia'))), ':', 1),
    '42501', 'a former member');
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('lucia'))), ':', 1),
    '42501', 'a person of no firm');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('lucia'))), ':', 1),
    '42501', 'a guest');
  PERFORM pg_temp.as_owner();
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck email', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  -- Support names the firm, as every write probed for it in help_from_nevermore.sql does.
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B', p_firm_id => %L)$q$,
    pg_temp.id('lucia'), pg_temp.id('acme'))), 'PT423: Nevermore support can look, not change', 'a support session');
  PERFORM pg_temp.is(jsonb_array_length(public.conversation_for(p_contact_id => pg_temp.id('lucia'), p_firm_id => pg_temp.id('acme')) -> 'messages') > 0, true,
    'which reads the conversation, as an owner does');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.support_sessions WHERE firm_id = pg_temp.id('acme');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('zenith'), pg_temp.id('zenith_owner'), now() + interval '30 days');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B')$q$, pg_temp.id('zoe'))), ':', 1),
    'PT423', 'a closing firm');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_messages), before, 'none of them recorded a message');
END $$;
SELECT 'conversations: all passed';
