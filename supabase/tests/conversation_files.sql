-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh conversation_files
-- The files a message to a contact may carry, as expiring links (story CRM-E1.2b, slice 6.3, #197; docs/BROKER_CRM_BUILD.md D-605, D-680 to D-689;
-- 20261122160000_conversation_files.sql). Two firms: Acme sees by level, Zenith shows everyone everything. Every migration is loaded, in filename
-- order (D-105), this story's last.
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
\i supabase/migrations/20261123090000_opportunity_close_withdraw.sql
\i supabase/migrations/20261123110000_firm_link.sql
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

-- A document on an intake, placed as the superuser (the upload stores it). Named in fx.
CREATE FUNCTION pg_temp.document(n text, p_intake text, p_verdict text, p_name text, p_category text DEFAULT 'other') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid; sid uuid := pg_temp.id(p_intake); uid uuid;
BEGIN
  SELECT user_id INTO uid FROM public.chamber_sessions WHERE id = sid;
  INSERT INTO public.documents (user_id, session_id, file_name, file_size, storage_path, category, size_bytes, mime_type, scan_verdict, created_at)
  VALUES (uid, sid, p_name, '1 KB', uid || '/' || sid || '/' || p_name, p_category, 1024, 'text/csv', p_verdict, now() - (SELECT count(*) FROM public.documents) * interval '1 minute')
  RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

-- ---------- the files: Reyes Bakery's intake has a clean census, a clean loss run and a file still being checked; Bay Cafe's intake has its own census;
-- Zenith's account has its own ----------
DO $$
BEGIN
  PERFORM pg_temp.intake('reyes_intake', 'acme');
  PERFORM pg_temp.opportunity('reyes_search', 'reyes', 'acme_agent1', 'reyes_intake', 'lucia');
  PERFORM pg_temp.document('reyes_census', 'reyes_intake', 'clean', 'census.xlsx', 'employee_census');
  PERFORM pg_temp.document('reyes_loss', 'reyes_intake', 'clean', 'loss-runs.pdf', 'workers_comp_loss_runs');
  PERFORM pg_temp.document('reyes_pending', 'reyes_intake', 'pending', 'payroll.pdf', 'payroll_report');
  PERFORM pg_temp.intake('bay_intake', 'acme');
  PERFORM pg_temp.opportunity('bay_search', 'bay', 'acme_agent2', 'bay_intake', 'bo');
  PERFORM pg_temp.document('bay_census', 'bay_intake', 'clean', 'bay-census.xlsx', 'employee_census');
  PERFORM pg_temp.intake('zen_intake', 'zenith');
  PERFORM pg_temp.opportunity('zen_search', 'zen', 'zenith_agent', 'zen_intake', 'zoe');
  PERFORM pg_temp.document('zen_census', 'zen_intake', 'clean', 'zen-census.xlsx', 'employee_census');
END $$;

-- ---------- 1. The files a message to a contact may carry (D-605). Catches: a file still being checked offered, another account's census offered, or
-- the list given to someone who may not see the contact ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((SELECT string_agg(f ->> 'file_name', ',' ORDER BY f ->> 'file_name')
                      FROM jsonb_array_elements(public.conversation_files_for(p_contact_id => pg_temp.id('lucia'), p_firm_id => pg_temp.id('acme'))) f),
    'census.xlsx,loss-runs.pdf', 'the files offered for a message to Reyes Bakery''s contact');
  PERFORM pg_temp.as_user('acme_agent3', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.conversation_files_for(p_contact_id => %L, p_firm_id => %L)$q$, pg_temp.id('lucia'), pg_temp.id('acme'))), ':', 1),
    'PT404', 'the files for a contact an agent may not see');
  PERFORM pg_temp.as_user('zenith_agent', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.conversation_files_for(p_contact_id => %L, p_firm_id => %L)$q$, pg_temp.id('lucia'), pg_temp.id('zenith'))), ':', 1),
    'PT404', 'the files for another firm''s contact');
  RESET ROLE;
END $$;

-- ---------- 2. A message carries the files chosen, each as a link to issue when it is sent (D-605). Catches: a file chosen and dropped, or a token kept
-- from the start (only its hash is ever kept, and only once the message is built) ----------
DO $$
DECLARE sent jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  sent := public.send_conversation_message(p_contact_id => pg_temp.id('lucia'), p_subject => 'Your census', p_body => 'Here it is',
                                           p_firm_id => pg_temp.id('acme'), p_document_ids => ARRAY[pg_temp.id('reyes_census'), pg_temp.id('reyes_loss')]);
  RESET ROLE;
  INSERT INTO fx VALUES ('msg_files', (sent ->> 'id')::uuid);
  PERFORM pg_temp.is((SELECT string_agg(f ->> 'file_name', ',' ORDER BY f ->> 'file_name') FROM jsonb_array_elements(sent -> 'files') f), 'census.xlsx,loss-runs.pdf',
    'the files the message answers with');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_message_files WHERE message_id = pg_temp.id('msg_files') AND token_hash IS NULL), 2,
    'one link per file, no token yet');
END $$;

-- ---------- 3. A file a message may not carry is refused, and nothing is recorded (D-605). Catches: a file still being checked sent, a census sent to a
-- contact of another employer, or another firm's file sent ----------
DO $$
DECLARE before int := (SELECT count(*)::int FROM public.conversation_messages);
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B', p_firm_id => %L, p_document_ids => ARRAY[%L]::uuid[])$q$,
    pg_temp.id('lucia'), pg_temp.id('acme'), pg_temp.id('reyes_pending'))), '22023: That file can''t go with this message. Only the account''s own files that passed the virus check can.',
    'a file still being checked');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B', p_firm_id => %L, p_document_ids => ARRAY[%L]::uuid[])$q$,
    pg_temp.id('lucia'), pg_temp.id('acme'), pg_temp.id('bay_census'))), ':', 1), '22023', 'another employer''s census');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B', p_firm_id => %L, p_document_ids => ARRAY[%L]::uuid[])$q$,
    pg_temp.id('lucia'), pg_temp.id('acme'), pg_temp.id('zen_census'))), ':', 1), '22023', 'another firm''s file');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_lead_id => %L, p_subject => 'S', p_body => 'B', p_firm_id => %L, p_document_ids => ARRAY[%L]::uuid[])$q$,
    pg_temp.id('ortiz'), pg_temp.id('acme'), pg_temp.id('reyes_census'))), ':', 1), '22023', 'a file on a message to a lead');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_messages), before, 'nothing recorded for a refused file');
END $$;

-- ---------- 4. The links are issued when the message is built, each time it is tried, and only their hashes kept (D-605, D-640). Catches: a token kept
-- in the database, a link that never stops working, or an earlier attempt's link still opening after a retry ----------
DO $$
DECLARE claimed jsonb; again jsonb; tok text; tok2 text;
BEGIN
  PERFORM pg_temp.as_service();
  SELECT c.message INTO claimed FROM public.claim_conversation_mail(10, 5, 600) c WHERE (c.message ->> 'id')::uuid = pg_temp.id('msg_files');
  tok := claimed -> 'files' -> 0 ->> 'token';
  RESET ROLE;
  PERFORM pg_temp.is(tok ~ '^[A-Za-z0-9_-]{43}$', true, 'a token of 32 random bytes in URL-safe base64');
  PERFORM pg_temp.is(claimed -> 'files' -> 0 ->> 'file_name', 'census.xlsx', 'the first file by its name');
  PERFORM pg_temp.is((SELECT f.token_hash FROM public.conversation_message_files f WHERE f.message_id = pg_temp.id('msg_files') AND f.n = 1),
    encode(extensions.digest(tok, 'sha256'), 'hex'), 'only the token''s hash is kept');
  PERFORM pg_temp.is((SELECT f.expires_at::date - now()::date FROM public.conversation_message_files f WHERE f.message_id = pg_temp.id('msg_files') AND f.n = 1), 30,
    'a link stops working after 30 days');
  -- The attempt's claim runs out and the message is claimed again: a new token, and the first one opens nothing.
  UPDATE public.outbox_events SET locked_until = now() - interval '1 second' WHERE payload ->> 'message_id' = pg_temp.id('msg_files')::text;
  PERFORM pg_temp.as_service();
  SELECT c.message INTO again FROM public.claim_conversation_mail(10, 5, 600) c WHERE (c.message ->> 'id')::uuid = pg_temp.id('msg_files');
  tok2 := again -> 'files' -> 0 ->> 'token';
  RESET ROLE;
  PERFORM pg_temp.is(tok2 IS DISTINCT FROM tok, true, 'a retry issues a new token');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_message_files f WHERE f.token_hash = encode(extensions.digest(tok, 'sha256'), 'hex')), 0,
    'the first attempt''s token is gone');
END $$;

-- ---------- 5. Opening a link: the file where the intake keeps it, each download logged (D-605). Catches: a link opening after it ran out or was revoked,
-- a file opening after it failed a later check, a download not logged, or a guess not counted ----------
DO $$
DECLARE tok text; h text; got jsonb; addr text := encode(extensions.digest('198.51.100.7', 'sha256'), 'hex');
BEGIN
  PERFORM pg_temp.as_service();
  UPDATE public.outbox_events SET locked_until = now() - interval '1 second' WHERE payload ->> 'message_id' = pg_temp.id('msg_files')::text;
  SELECT c.message -> 'files' -> 0 ->> 'token' INTO tok FROM public.claim_conversation_mail(10, 5, 600) c WHERE (c.message ->> 'id')::uuid = pg_temp.id('msg_files');
  h := encode(extensions.digest(tok, 'sha256'), 'hex');
  got := public.conversation_file_open(h, addr);
  RESET ROLE;
  PERFORM pg_temp.is(got ->> 'bucket', 'documents', 'the file is where the intake keeps it');
  PERFORM pg_temp.is(got ->> 'path', (SELECT d.storage_path FROM public.documents d WHERE d.id = pg_temp.id('reyes_census')), 'the census''s own path');
  PERFORM pg_temp.is(got ->> 'name', 'census.xlsx', 'downloaded by its name');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_file_downloads w JOIN public.conversation_message_files f ON f.id = w.file_id
                      WHERE f.message_id = pg_temp.id('msg_files') AND f.n = 1), 1, 'the download is logged');
  -- Past its 30 days, revoked, or a file that failed a later check: nothing.
  UPDATE public.conversation_message_files SET expires_at = now() - interval '1 second' WHERE token_hash = h;
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.conversation_file_open(h, addr), NULL::jsonb, 'a link past its 30 days');
  RESET ROLE;
  UPDATE public.conversation_message_files SET expires_at = now() + interval '1 day', revoked_at = now() WHERE token_hash = h;
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.conversation_file_open(h, addr), NULL::jsonb, 'a revoked link');
  RESET ROLE;
  UPDATE public.conversation_message_files SET revoked_at = NULL WHERE token_hash = h;
  UPDATE public.documents SET scan_verdict = 'infected' WHERE id = pg_temp.id('reyes_census');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(public.conversation_file_open(h, addr), NULL::jsonb, 'a file that failed a later check');
  PERFORM pg_temp.is(public.conversation_file_open(encode(extensions.digest('a guess', 'sha256'), 'hex'), addr), NULL::jsonb, 'a token that names no link');
  RESET ROLE;
  UPDATE public.documents SET scan_verdict = 'clean' WHERE id = pg_temp.id('reyes_census');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.bundle_link_misses WHERE address_hash = addr), 3, 'each link that opened nothing counted against the address');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_file_downloads), 1, 'nothing logged for a link that opened nothing');
END $$;

-- ---------- 6. The place to write reads each message's state and files (conversation_for). Catches: a message that didn't go shown with no reason, a
-- message with no time, or its files not named (a token never is) ----------
DO $$
DECLARE conv jsonb; m jsonb; ev uuid;
BEGIN
  SELECT e.id INTO ev FROM public.outbox_events e WHERE e.payload ->> 'message_id' = pg_temp.id('msg_files')::text;
  PERFORM pg_temp.as_service();
  PERFORM public.fail_conversation_mail(ev, (SELECT attempts FROM public.outbox_events WHERE id = ev), 'refused', 'Google or Microsoft refused this message.', NULL);
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  conv := public.conversation_for(p_contact_id => pg_temp.id('lucia'), p_firm_id => pg_temp.id('acme'));
  RESET ROLE;
  SELECT x INTO m FROM jsonb_array_elements(conv -> 'messages') x WHERE (x ->> 'id')::uuid = pg_temp.id('msg_files');
  PERFORM pg_temp.is(m ->> 'status', 'failed', 'the message failed');
  PERFORM pg_temp.is(m ->> 'failure_reason', 'Google or Microsoft refused this message.', 'with its reason');
  PERFORM pg_temp.is(m ->> 'failure_kind', 'refused', 'and its kind');
  PERFORM pg_temp.is(m ? 'recorded_at', true, 'with when it was written');
  PERFORM pg_temp.is((SELECT string_agg(f ->> 'file_name', ',' ORDER BY (f ->> 'n')::int) FROM jsonb_array_elements(m -> 'files') f), 'census.xlsx,loss-runs.pdf', 'its files by name');
  PERFORM pg_temp.is((SELECT count(*)::int FROM jsonb_array_elements(m -> 'files') f WHERE f ? 'token'), 0, 'never a token');
END $$;

-- ---------- 7. Emailing a lead makes it Working (D-808, D-639: CRM-L1.3's rule joined by CRM-E1.2). Catches: a lead written to and left New, or a lead
-- set Not a fit moved back by a message ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.send_conversation_message(p_lead_id => pg_temp.id('ortiz'), p_subject => 'Hello', p_body => 'Hi Ana', p_firm_id => pg_temp.id('acme'));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT status FROM public.leads WHERE id = pg_temp.id('ortiz')), 'working', 'a New lead written to is Working');
  PERFORM pg_temp.lead('unfit', 'acme', 'acme_agent1');
  UPDATE public.leads SET email = 'unfit@example.test', status = 'not_fit', not_fit_reason = 'too_small' WHERE id = pg_temp.id('unfit');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.send_conversation_message(p_lead_id => pg_temp.id('unfit'), p_subject => 'Hello', p_body => 'Hi', p_firm_id => pg_temp.id('acme'));
  RESET ROLE;
  PERFORM pg_temp.is((SELECT status FROM public.leads WHERE id = pg_temp.id('unfit')), 'not_fit', 'a Not a fit lead stays so');
END $$;

-- ---------- 8. At most 10 files on one message, said in words (D-685). Catches: an eleventh file refused by a constraint's own words ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format($q$SELECT public.send_conversation_message(p_contact_id => %L, p_subject => 'S', p_body => 'B', p_firm_id => %L, p_document_ids => ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 11)))$q$,
    pg_temp.id('lucia'), pg_temp.id('acme'))), '22023: At most 10 files can go with one message.', 'an eleventh file');
  RESET ROLE;
END $$;
