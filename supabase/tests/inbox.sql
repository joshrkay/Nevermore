-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh inbox
-- The inbox (story CRM-E1.4, slice 6.5, #199; docs/BROKER_CRM_BUILD.md D-607 and D-690 to D-699; 20261122150000_inbox.sql). Two firms: Acme sees by
-- level, Zenith shows everyone everything. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261123110000_firm_link.sql
\i supabase/migrations/20261123120000_broker_intake.sql
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

-- Mail as the receive-mail function records it (the service role): the provider's id, the reply addresses named, the sender, and whether it is automatic.
CREATE FUNCTION pg_temp.receive(p_id text, p_locals text[], p_from text, p_name text DEFAULT NULL, p_auto boolean DEFAULT false,
  p_headers jsonb DEFAULT '{}', p_cc text[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_service();
  r := public.record_inbound_mail(p_id, p_locals, p_from, p_name, ARRAY(SELECT x || '@quotes.example' FROM unnest(p_locals) x), p_cc, 'Re: hello', 'Thanks, see you Tuesday.',
                                  false, p_headers, p_auto, now());
  RESET ROLE;
  RETURN r;
END $$;

-- Each conversation as 6.2's send makes it: agent 1 writes to Lucia (Reyes Bakery) and to the Ortiz lead; Zenith's agent to Zoe. Their addresses are fixed here.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM public.send_conversation_message(p_contact_id => pg_temp.id('lucia'), p_subject => 'Hello', p_body => 'Hi Lucia');
  PERFORM public.send_conversation_message(p_lead_id => pg_temp.id('ortiz'), p_subject => 'Hello', p_body => 'Hi Ana');
  PERFORM pg_temp.as_user('zenith_agent');
  PERFORM public.send_conversation_message(p_contact_id => pg_temp.id('zoe'), p_subject => 'Hello', p_body => 'Hi Zoe');
  RESET ROLE;
  UPDATE public.conversations SET reply_address = 'c.reyes.00000000000000a1' WHERE contact_id = pg_temp.id('lucia');
  UPDATE public.conversations SET reply_address = 'c.ortiz.00000000000000a2' WHERE lead_id = pg_temp.id('ortiz');
  UPDATE public.conversations SET reply_address = 'c.zen.00000000000000a3' WHERE contact_id = pg_temp.id('zoe');
  INSERT INTO fx SELECT 'conv_lucia', id FROM public.conversations WHERE contact_id = pg_temp.id('lucia');
  INSERT INTO fx SELECT 'conv_ortiz', id FROM public.conversations WHERE lead_id = pg_temp.id('ortiz');
  INSERT INTO fx SELECT 'conv_zoe', id FROM public.conversations WHERE contact_id = pg_temp.id('zoe');
END $$;

-- The inbox as the caller reads it: one page (the filters and search as given), the caller's only firm at this address unless one is named.
CREATE FUNCTION pg_temp.inbox(p_filters jsonb DEFAULT '[]', p_search text DEFAULT NULL, p_firm text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.inbox_list(pg_temp.id(p_firm), p_filters, NULL, 'desc', 1, p_search)
$$;

-- ---------- 1. A reply from a contact is a row: who, what it is about, the first line, its kind, when. Catches: a row missing what the page draws ----------
DO $$
DECLARE r jsonb; row jsonb;
BEGIN
  PERFORM pg_temp.receive('in_lucia_1', ARRAY['c.reyes.00000000000000a1'], 'lucia@reyes.example', 'Lucia Reyes');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := pg_temp.inbox();
  SELECT e INTO row FROM jsonb_array_elements(r -> 'rows') e WHERE e ->> 'from_address' = 'lucia@reyes.example';
  PERFORM pg_temp.is(format('%s|%s|%s|%s|%s|%s|%s|%s|%s', row ->> 'kind', row ->> 'direction', row ->> 'from_name', row ->> 'subject', row ->> 'first_line',
      row ->> 'account_name', row ->> 'contact_name', (row ->> 'contact_id')::uuid = pg_temp.id('lucia'), (row ->> 'thread_id')::uuid = pg_temp.id('conv_lucia')),
    'contact|received|Lucia Reyes|Re: hello|Thanks, see you Tuesday.|Reyes Bakery & Sons|First lucia Last lucia|t|t', 'a contact''s reply reads as a row');
  PERFORM pg_temp.is((row ->> 'account_id')::uuid, pg_temp.id('reyes'), 'linked to its account');
  PERFORM pg_temp.is(row ? 'at', true, 'with when it came');
  PERFORM pg_temp.is(row ? 'body_text', false, 'and never the body itself, only its first line');
  RESET ROLE;
  RAISE NOTICE 'inbox: a contact''s reply is a row';
END $$;

-- ---------- 2. A message to a lead is a row too, the lead linked. Catches: a lead's conversation left out (it has no account) ----------
DO $$
DECLARE row jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  SELECT e INTO row FROM jsonb_array_elements(pg_temp.inbox() -> 'rows') e WHERE e ->> 'kind' = 'lead';
  PERFORM pg_temp.is(format('%s|%s|%s|%s|%s', row ->> 'direction', row ->> 'subject', row ->> 'first_line', row ->> 'lead_name', (row ->> 'lead_id')::uuid = pg_temp.id('ortiz')),
    'sent|Hello|Hi Ana|Person ortiz|t', 'the agent''s message to the Ortiz lead reads as a sent row on the lead');
  PERFORM pg_temp.is((row ->> 'thread_id')::uuid, pg_temp.id('conv_ortiz'), 'on the lead''s conversation');
  RESET ROLE;
  RAISE NOTICE 'inbox: a lead''s message is a row';
END $$;

-- PEO threads: Acme's intake for Reyes Bakery (its opportunity on the Reyes account, agent 1's), sent to TriNet, which wrote back; an advisor's own copy sent by
-- hand; held mail of Acme's that is on no quote request; Zenith's intake, sent to Justworks, which wrote back.
DO $$
DECLARE q bigint;
BEGIN
  PERFORM pg_temp.intake('reyes_intake', 'acme');
  PERFORM pg_temp.opportunity('reyes_opp', 'reyes', 'acme_agent1', 'reyes_intake');
  PERFORM pg_temp.intake('zen_intake', 'zenith');
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('reyes_intake'), 'TriNet', 'sent', current_date - 2) RETURNING id INTO q;
  INSERT INTO fx VALUES ('q_trinet', gen_random_uuid());
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, from_name, subject, body_text, recorded_at, firm_id)
  VALUES ('peo_trinet_1', q, pg_temp.id('reyes_intake'), 'received', 'rep@trinet.test', 'Rita at TriNet', 'Quote for Reyes', E'\n  We need the census.\nThanks', now() - interval '3 hours', pg_temp.id('acme')),
         ('peo_trinet_hand', q, pg_temp.id('reyes_intake'), 'sent_by_hand', 'agent1@acme.example', NULL, 'Re: Quote for Reyes', 'Attached.', now() - interval '2 hours', pg_temp.id('acme'));
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, address_local_part, held_reason, held_at, direction, from_address, subject, body_text, recorded_at, firm_id)
  VALUES ('peo_held', NULL, NULL, 'x', 'revoked_address', now(), 'received', 'who@where.test', 'Held', 'Held body', now() - interval '1 hour', pg_temp.id('acme'));
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id('zen_intake'), 'Justworks', 'sent', current_date - 1) RETURNING id INTO q;
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, subject, body_text, recorded_at, firm_id)
  VALUES ('peo_justworks_1', q, pg_temp.id('zen_intake'), 'received', 'rep@justworks.test', 'Quote for Zen', 'Here it is', now() - interval '1 hour', pg_temp.id('zenith'));
END $$;

-- ---------- 3. PEO mail is a row, both directions, the PEO and its account linked; held mail is none. Catches: the PEO threads left out, or held mail shown ----------
DO $$
DECLARE rows jsonb; row jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  rows := pg_temp.inbox() -> 'rows';
  SELECT e INTO row FROM jsonb_array_elements(rows) e WHERE e ->> 'from_address' = 'rep@trinet.test';
  PERFORM pg_temp.is(format('%s|%s|%s|%s|%s|%s|%s', row ->> 'kind', row ->> 'direction', row ->> 'peo_name', row ->> 'from_name', row ->> 'first_line', row ->> 'account_name',
      (row ->> 'session_id')::uuid = pg_temp.id('reyes_intake')),
    'peo|received|TriNet|Rita at TriNet|We need the census.|Reyes Bakery & Sons|t', 'TriNet''s reply reads as a PEO row, its first line with words in it, the account its opportunity''s');
  PERFORM pg_temp.is((row ->> 'thread_id')::bigint, (SELECT id FROM public.quote_requests WHERE peo_name = 'TriNet' AND session_id = pg_temp.id('reyes_intake')), 'on its quote request');
  PERFORM pg_temp.is((row ->> 'account_id')::uuid, pg_temp.id('reyes'), 'the account linked');
  PERFORM pg_temp.is((SELECT e ->> 'direction' FROM jsonb_array_elements(rows) e WHERE e ->> 'subject' = 'Re: Quote for Reyes'), 'sent', 'a copy sent by hand is sent');
  PERFORM pg_temp.is((SELECT count(*)::int FROM jsonb_array_elements(rows) e WHERE e ->> 'subject' = 'Held'), 0, 'held mail is on no thread, so in no row');
  PERFORM pg_temp.is((SELECT count(*)::int FROM jsonb_array_elements(rows) e WHERE e ->> 'kind' = 'peo'), 2, 'Acme''s two PEO messages, never Zenith''s');
  RESET ROLE;
  RAISE NOTICE 'inbox: PEO mail is a row';
END $$;

-- ---------- 4. Who sees what: the level rule for contacts and leads, every member for PEO threads, one firm at a time. Catches: an agent reading another
-- agent's mail, a firm reading another firm's, a PEO thread hidden from a member the queue shows it to ----------
CREATE FUNCTION pg_temp.inbox_kinds() RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg((e ->> 'kind') || ':' || (e ->> 'direction'), ',' ORDER BY e ->> 'kind', e ->> 'direction', e ->> 'subject'), '')
  FROM jsonb_array_elements(pg_temp.inbox() -> 'rows') e
$$;
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.inbox_kinds(), 'contact:received,contact:sent,lead:sent,peo:received,peo:sent', 'agent 1: their contact''s and lead''s mail, and the firm''s PEO mail');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.inbox_kinds(), 'peo:received,peo:sent', 'agent 2 (Sales): not agent 1''s contact or lead, but the PEO threads every member reads');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.inbox_kinds(), 'contact:received,contact:sent,lead:sent,peo:received,peo:sent', 'the owner: everyone''s');
  PERFORM pg_temp.as_user('zenith_agent2', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.inbox_kinds(), 'contact:sent,peo:received', 'Zenith shows everyone everything, and only Zenith''s');
  PERFORM pg_temp.as_user('acme_removed', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT pg_temp.inbox()$q$) LIKE '42501%', true, 'a person whose membership ended is refused');
  PERFORM pg_temp.as_user('acme_agent1', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT pg_temp.inbox(p_firm => 'zenith')$q$) LIKE '42501%', true, 'another firm''s inbox, named, is refused');
  RESET ROLE;
  RAISE NOTICE 'inbox: who sees what';
END $$;

-- ---------- 5. New: a message from a person after the thread was last opened; opening the thread (the existing open functions) clears it for everyone.
-- Catches: a sent message, an automatic reply or mail already read shown as new; a mark that stays for others after one person opens the thread ----------
CREATE FUNCTION pg_temp.new_subjects() RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(e ->> 'subject', ',' ORDER BY e ->> 'subject'), '') FROM jsonb_array_elements(pg_temp.inbox() -> 'rows') e WHERE (e ->> 'is_new')::boolean
$$;
DO $$
BEGIN
  PERFORM pg_temp.receive('in_lucia_away', ARRAY['c.reyes.00000000000000a1'], 'lucia@reyes.example', NULL, true);
  UPDATE public.conversation_messages SET subject = 'Away' WHERE provider_message_id = 'in_lucia_away';
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.new_subjects(), 'Quote for Reyes,Re: hello', 'new: Lucia''s reply and TriNet''s; never a sent message or the automatic reply');
  -- Agent 1 opens Lucia's conversation: it is no longer new, for the owner either.
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.open_conversation(pg_temp.id('conv_lucia'));
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.new_subjects(), 'Quote for Reyes', 'opening the conversation cleared it for everyone');
  PERFORM public.advisor_open_quote_request_thread((SELECT id FROM public.quote_requests WHERE peo_name = 'TriNet' AND session_id = pg_temp.id('reyes_intake')));
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.new_subjects(), '', 'and opening the PEO thread cleared TriNet''s');
  RESET ROLE;
  RAISE NOTICE 'inbox: new mail, and opening clears it';
END $$;

-- ---------- 6. The views' filters: New, From PEOs, From contacts and leads, Sent. Catches: a view that lets in what isn't its own (a sent message under
-- "From", a PEO's under contacts and leads, read mail under New) ----------
CREATE FUNCTION pg_temp.subjects(p_filters jsonb, p_search text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg((e ->> 'kind') || ':' || (e ->> 'subject'), ',' ORDER BY e ->> 'kind', e ->> 'subject'), '')
  FROM jsonb_array_elements(pg_temp.inbox(p_filters, p_search) -> 'rows') e
$$;
DO $$
BEGIN
  PERFORM pg_temp.receive('in_lucia_2', ARRAY['c.reyes.00000000000000a1'], 'lucia@reyes.example', 'Lucia Reyes');
  UPDATE public.conversation_messages SET subject = 'Second reply' WHERE provider_message_id = 'in_lucia_2';
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.subjects('[{"field":"is_new","op":"is","value":true}]'), 'contact:Second reply', 'New: only the mail that came after the thread was opened');
  PERFORM pg_temp.is(pg_temp.subjects('[{"field":"kind","op":"any_of","value":["peo"]},{"field":"direction","op":"any_of","value":["received"]}]'), 'peo:Quote for Reyes',
    'From PEOs: what a PEO wrote, never the firm''s copy');
  PERFORM pg_temp.is(pg_temp.subjects('[{"field":"kind","op":"any_of","value":["contact","lead"]},{"field":"direction","op":"any_of","value":["received"]}]'),
    'contact:Away,contact:Re: hello,contact:Second reply', 'From contacts and leads: what they wrote, the automatic reply among it');
  PERFORM pg_temp.is(pg_temp.subjects('[{"field":"direction","op":"any_of","value":["sent"]}]'), 'contact:Hello,lead:Hello,peo:Re: Quote for Reyes',
    'Sent: what the firm sent, by the product or by hand');
  RESET ROLE;
  RAISE NOTICE 'inbox: the views'' filters';
END $$;

-- ---------- 7. The Owner filter: whose record the thread is on (a contact's account, a lead, a quote request's opportunity), named. Catches: an owner filter that
-- reads the sender, or leaves a PEO thread with no owner ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.mailbox('acme_agent2', 'agent2@acme.example');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM public.send_conversation_message(p_contact_id => pg_temp.id('bo'), p_subject => 'Hi Bo', p_body => 'Hello from Bay');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.subjects(jsonb_build_array(jsonb_build_object('field', 'owner', 'op', 'any_of', 'value', jsonb_build_array(pg_temp.id('acme_agent2'))))),
    'contact:Hi Bo', 'the owner filter on agent 2: Bay Cafe''s mail only');
  PERFORM pg_temp.is(pg_temp.subjects(jsonb_build_array(jsonb_build_object('field', 'owner', 'op', 'any_of', 'value', jsonb_build_array(pg_temp.id('acme_agent1'))))),
    'contact:Away,contact:Hello,contact:Re: hello,contact:Second reply,lead:Hello,peo:Quote for Reyes,peo:Re: Quote for Reyes', 'on agent 1: their contact''s, their lead''s and the PEO thread of their opportunity');
  r := pg_temp.inbox();
  PERFORM pg_temp.is((SELECT e ->> 'owner_name' FROM jsonb_array_elements(r -> 'rows') e WHERE e ->> 'subject' = 'Hi Bo'), 'acme_agent2@example.test', 'the owner is named');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.subjects('[{"field":"owner","op":"me"}]'), 'contact:Hi Bo', '"me" is the caller');
  RESET ROLE;
  RAISE NOTICE 'inbox: the owner filter';
END $$;

-- ---------- 8. The Account filter, by the account's name; a lead's business stands for its account until it is converted. Catches: an account filter that
-- misses the PEO threads of an account's intake, or every lead ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.subjects('[{"field":"account","op":"contains","value":"bay"}]'), 'contact:Hi Bo', 'Bay Cafe''s mail');
  PERFORM pg_temp.is(pg_temp.subjects('[{"field":"account","op":"is","value":"reyes bakery & sons"}]'),
    'contact:Away,contact:Hello,contact:Re: hello,contact:Second reply,peo:Quote for Reyes,peo:Re: Quote for Reyes', 'Reyes Bakery''s, its PEO thread with it');
  PERFORM pg_temp.is(pg_temp.subjects('[{"field":"account","op":"contains","value":"plumbing"}]'), 'lead:Hello', 'the Ortiz lead, by its business');
  RESET ROLE;
  RAISE NOTICE 'inbox: the account filter';
END $$;

-- ---------- 9. Search: every word in the sender (address or name), the subject or the account; never the body. Catches: a search that reads the mail's
-- words, or misses a field the story names ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.subjects('[]', 'rita'), 'peo:Quote for Reyes', 'the sender''s name');
  PERFORM pg_temp.is(pg_temp.subjects('[]', 'TRINET.test'), 'peo:Quote for Reyes', 'the sender''s address, ignoring case');
  PERFORM pg_temp.is(pg_temp.subjects('[]', 'second reply'), 'contact:Second reply', 'the subject, every word');
  PERFORM pg_temp.is(pg_temp.subjects('[]', 'cafe'), 'contact:Hi Bo', 'the account');
  PERFORM pg_temp.is(pg_temp.subjects('[]', 'census'), '', 'never the body: "census" is only in TriNet''s words');
  PERFORM pg_temp.is(pg_temp.subjects('[]', 'tuesday'), '', 'nor Lucia''s');
  RESET ROLE;
  RAISE NOTICE 'inbox: search';
END $$;

-- ---------- 10. The views' tabs count what each view lists, for the same person, firm and search. Catches: a tab whose number disagrees with its list ----------
DO $$
DECLARE views jsonb := '[{"name":"All","filters":[]},{"name":"New","filters":[{"field":"is_new","op":"is","value":true}]},
  {"name":"From PEOs","filters":[{"field":"kind","op":"any_of","value":["peo"]},{"field":"direction","op":"any_of","value":["received"]}]},
  {"name":"From contacts and leads","filters":[{"field":"kind","op":"any_of","value":["contact","lead"]},{"field":"direction","op":"any_of","value":["received"]}]},
  {"name":"Sent","filters":[{"field":"direction","op":"any_of","value":["sent"]}]}]';
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((SELECT string_agg(view_name || '=' || total, ',') FROM public.inbox_view_counts(NULL, views)),
    'All=8,New=1,From PEOs=1,From contacts and leads=3,Sent=4', 'the owner''s tabs');
  PERFORM pg_temp.is((SELECT string_agg(view_name || '=' || total, ',') FROM public.inbox_view_counts(NULL, views, 'reyes')),
    'All=6,New=1,From PEOs=1,From contacts and leads=3,Sent=2', 'under a search');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is((SELECT string_agg(view_name || '=' || total, ',') FROM public.inbox_view_counts(NULL, views)),
    'All=3,New=0,From PEOs=1,From contacts and leads=0,Sent=2', 'agent 2''s, by their level');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT * FROM public.inbox_view_counts(NULL, '[{"name":"X","filters":[{"field":"body","op":"contains","value":"census"}]}]')$q$), ':', 1),
    '22023', 'a view on a field the inbox has not (the body) is refused');
  RESET ROLE;
  RAISE NOTICE 'inbox: the views'' counts';
END $$;

-- ---------- 11. The menu's Inbox counts the threads with new mail, PEO threads and conversations, that the caller may see: the threads the New view lists.
-- Catches: a count of intakes or of messages instead of threads, a conversation left out, or a count that disagrees with the page it opens ----------
CREATE FUNCTION pg_temp.new_threads() RETURNS bigint LANGUAGE sql AS $$
  SELECT count(DISTINCT (e ->> 'kind') || (e ->> 'thread_id')) FROM jsonb_array_elements(pg_temp.inbox('[{"field":"is_new","op":"is","value":true}]') -> 'rows') e
$$;
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((public.menu_counts() ->> 'inbox')::int, 1, 'one conversation with new mail (Lucia''s), no PEO thread');
  RESET ROLE;
  PERFORM pg_temp.receive('in_lucia_3', ARRAY['c.reyes.00000000000000a1'], 'lucia@reyes.example', 'Lucia Reyes');
  INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, subject, body_text, recorded_at, firm_id)
  SELECT 'peo_trinet_2', q.id, q.session_id, 'received', 'rep@trinet.test', 'Census', 'Got it', now(), pg_temp.id('acme')
  FROM public.quote_requests q WHERE q.peo_name = 'TriNet' AND q.session_id = pg_temp.id('reyes_intake');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((public.menu_counts() ->> 'inbox')::int, 2, 'a second message on Lucia''s conversation is the same thread; TriNet''s new mail is a second');
  PERFORM pg_temp.is(pg_temp.new_threads(), 2::bigint, 'the threads the New view lists');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is((public.menu_counts() ->> 'inbox')::int, 1, 'agent 2: only the PEO thread, Lucia''s conversation is not theirs to see');
  PERFORM pg_temp.is(pg_temp.new_threads(), 1::bigint, 'as their New view lists');
  PERFORM pg_temp.is((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(public.menu_counts()) k), ARRAY['inbox', 'leads', 'quotes'], 'every count the menu had, leads among them');
  RESET ROLE;
  RAISE NOTICE 'inbox: the menu''s count';
END $$;

-- ---------- 12. One firm at a time, for a person in two firms. Catches: a row of the other firm let in because the level rule alone lets its member see it ----------
DO $$
BEGIN
  PERFORM pg_temp.new_user('in_both');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('in_both'), 'owner'), (pg_temp.id('zenith'), pg_temp.id('in_both'), 'owner');
  PERFORM pg_temp.as_user('in_both');
  PERFORM pg_temp.is((SELECT count(*)::int FROM jsonb_array_elements(pg_temp.inbox(p_firm => 'acme') -> 'rows') e
                      WHERE e ->> 'account_name' = 'Zen Yoga' OR e ->> 'peo_name' = 'Justworks'), 0, 'naming Acme: never Zenith''s mail');
  PERFORM pg_temp.is((SELECT count(*)::int FROM jsonb_array_elements(pg_temp.inbox(p_firm => 'zenith') -> 'rows') e
                      WHERE e ->> 'account_name' IN ('Reyes Bakery & Sons', 'Bay Cafe', 'Ortiz Plumbing') OR e ->> 'peo_name' = 'TriNet'), 0, 'naming Zenith: never Acme''s');
  PERFORM pg_temp.is((SELECT count(*)::int FROM jsonb_array_elements(pg_temp.inbox(p_firm => 'zenith') -> 'rows') e), 2, 'and Zenith''s own two');
  RESET ROLE;
  RAISE NOTICE 'inbox: one firm at a time';
END $$;

-- ---------- 13. A record whose owner has left reads as owned by no one, as the leads table has it. Catches: a departed member named as an owner, or matched by
-- the Owner filter ----------
DO $$
DECLARE row jsonb;
BEGIN
  PERFORM pg_temp.account('left_behind', 'acme', 'acme_removed', 'Left Behind Ltd');
  PERFORM pg_temp.contact('lena', 'left_behind', 'acme_removed', 'lena@left.example');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.send_conversation_message(p_contact_id => pg_temp.id('lena'), p_subject => 'Still here?', p_body => 'Checking in');
  SELECT e INTO row FROM jsonb_array_elements(pg_temp.inbox() -> 'rows') e WHERE e ->> 'subject' = 'Still here?';
  PERFORM pg_temp.is(format('%s|%s', row ->> 'owner', row ->> 'owner_name'), '|', 'no owner, and no name');
  PERFORM pg_temp.is(pg_temp.subjects(jsonb_build_array(jsonb_build_object('field', 'owner', 'op', 'any_of', 'value', jsonb_build_array(pg_temp.id('acme_removed'))))),
    '', 'the Owner filter on the person who left matches nothing');
  RESET ROLE;
  RAISE NOTICE 'inbox: an owner who left';
END $$;
