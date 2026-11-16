-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh conversation_replies
-- Replies come back to their conversation (story CRM-E1.3, slice 6.4, #198; docs/BROKER_CRM_BUILD.md D-601, D-606, D-607 and D-660 to D-669;
-- 20261122130000_conversation_replies.sql). Two firms: Acme sees by level, Zenith shows everyone everything. Every migration is loaded, in filename
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
\i supabase/migrations/20261121085500_leads.sql
\i supabase/migrations/20261121090000_spot_a_duplicate.sql
\i supabase/migrations/20261121095500_create_lead.sql
\i supabase/migrations/20261121100000_merge_records.sql
\i supabase/migrations/20261121110000_account_page_duplicate_mark.sql
\i supabase/migrations/20261121110500_leads_table_query.sql
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

-- ---------- 1. A reply to a conversation's address joins that conversation as a received message (D-606). Catches: a reply held, or filed on a quote request ----------
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.receive('re_lucia_1', ARRAY['c.reyes.00000000000000a1'], 'Lucia@Reyes.example', 'Lucia Reyes');
  PERFORM pg_temp.is(r ->> 'held', 'false', 'a reply to a conversation''s address is not held');
  PERFORM pg_temp.is((r ->> 'conversation_id')::uuid, pg_temp.id('conv_lucia'), 'it names the conversation it joined');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.quote_request_messages WHERE provider_message_id = 're_lucia_1'), 0, 'nothing is filed among the PEO mail');
  PERFORM pg_temp.is((SELECT format('%s|%s|%s|%s|%s', m.direction, m.status, m.from_address, m.from_name, (m.firm_id = pg_temp.id('acme'))::text)
                      FROM public.conversation_messages m WHERE m.id = (r ->> 'conversation_message_id')::uuid AND m.conversation_id = pg_temp.id('conv_lucia')),
    'inbound|received|lucia@reyes.example|Lucia Reyes|true', 'it is a received message on that conversation, of its firm');
  RAISE NOTICE 'conversation_replies: a reply joins its conversation';
END $$;

-- ---------- 2. A replayed delivery records nothing new (idempotent on the provider's id). Catches: the same reply shown twice, or a replay that fails ----------
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.receive('re_lucia_1', ARRAY['c.reyes.00000000000000a1'], 'lucia@reyes.example', 'Lucia Reyes');
  PERFORM pg_temp.is(r ->> 'duplicate', 'true', 'a replay is a duplicate');
  PERFORM pg_temp.is((r ->> 'conversation_message_id')::uuid, (SELECT id FROM public.conversation_messages WHERE provider_message_id = 're_lucia_1'),
    'and names the message first recorded');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_messages WHERE provider_message_id = 're_lucia_1'), 1, 'which is still the only one');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.quote_request_messages WHERE provider_message_id = 're_lucia_1'), 0, 'and nothing is held for it');
  RAISE NOTICE 'conversation_replies: a replay records nothing new';
END $$;

-- ---------- 3. An automatic reply is marked as one. Catches: an out-of-office reply read as the person writing ----------
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.receive('re_lucia_away', ARRAY['c.reyes.00000000000000a1'], 'lucia@reyes.example', NULL, true);
  PERFORM pg_temp.is((SELECT m.is_automatic FROM public.conversation_messages m WHERE m.id = (r ->> 'conversation_message_id')::uuid), true, 'an automatic reply is marked');
  PERFORM pg_temp.is((SELECT m.is_automatic FROM public.conversation_messages m WHERE m.provider_message_id = 're_lucia_1'), false, 'and a person''s is not');
  RAISE NOTICE 'conversation_replies: an automatic reply is marked';
END $$;

-- ---------- 4. The firm's own person copying the conversation in is "sent by hand". Catches: an agent's own mail read as the contact writing back ----------
-- By their sign-in address or their connected mailbox's, while they are a current member of the conversation's firm. Another firm's person, or a person who
-- left, writes like anyone else.
DO $$
BEGIN
  PERFORM pg_temp.receive('re_by_agent2', ARRAY['c.reyes.00000000000000a1'], 'ACME_agent2@example.test');
  PERFORM pg_temp.receive('re_by_mailbox', ARRAY['c.reyes.00000000000000a1'], 'agent1@acme.example');
  PERFORM pg_temp.receive('re_by_zenith', ARRAY['c.reyes.00000000000000a1'], 'zenith_agent@example.test');
  PERFORM pg_temp.receive('re_by_removed', ARRAY['c.reyes.00000000000000a1'], 'acme_removed@example.test');
  PERFORM pg_temp.is((SELECT string_agg(m.provider_message_id || '=' || m.direction, ',' ORDER BY m.provider_message_id) FROM public.conversation_messages m
                      WHERE m.provider_message_id LIKE 're_by_%'),
    're_by_agent2=sent_by_hand,re_by_mailbox=sent_by_hand,re_by_removed=inbound,re_by_zenith=inbound', 'who counts as the firm''s own');
  RAISE NOTICE 'conversation_replies: the firm''s own copy is sent by hand';
END $$;

-- ---------- 5. A sender not seen on the conversation before is marked new. Catches: a stranger's mail passing unnoticed, or the contact marked new ----------
-- Seen: an earlier message's sender, or anyone an earlier message was addressed or copied to. An automatic reply and the firm's own copy are never new.
DO $$
BEGIN
  PERFORM pg_temp.receive('re_new_1', ARRAY['c.reyes.00000000000000a1'], 'books@reyes.example', 'Pat Books', false, '{}', ARRAY['cc.person@reyes.example']);
  PERFORM pg_temp.receive('re_new_2', ARRAY['c.reyes.00000000000000a1'], 'books@reyes.example', 'Pat Books');
  PERFORM pg_temp.receive('re_new_3', ARRAY['c.reyes.00000000000000a1'], 'cc.person@reyes.example');
  PERFORM pg_temp.receive('re_new_auto', ARRAY['c.reyes.00000000000000a1'], 'robot@elsewhere.example', NULL, true);
  PERFORM pg_temp.receive('re_new_own', ARRAY['c.reyes.00000000000000a1'], 'acme_lead@example.test');
  PERFORM pg_temp.is((SELECT string_agg(m.provider_message_id || '=' || m.new_sender, ',' ORDER BY m.provider_message_id) FROM public.conversation_messages m
                      WHERE m.provider_message_id LIKE 're_new_%' OR m.provider_message_id = 're_lucia_1'),
    're_lucia_1=false,re_new_1=true,re_new_2=false,re_new_3=false,re_new_auto=false,re_new_own=false', 'who is new on the conversation');
  RAISE NOTICE 'conversation_replies: a new sender is marked';
END $$;

-- ---------- 6. Mail to a c. address that belongs to no record goes to the holding list, as today. Catches: such mail lost, or filed on a conversation ----------
-- An address never issued, and the address of a conversation deleted with its account, are alike: no firm can be told from them, so the platform's list.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.account('gone', 'acme', 'acme_agent1', 'Gone Ltd');
  PERFORM pg_temp.contact('gina', 'gone', 'acme_agent1', 'gina@gone.example');
  INSERT INTO public.conversations (firm_id, contact_id, reply_address) VALUES (pg_temp.id('acme'), pg_temp.id('gina'), 'c.gone.00000000000000f1');
  DELETE FROM public.accounts WHERE id = pg_temp.id('gone');
  FOR r IN SELECT pg_temp.receive('re_nobody_' || x, ARRAY[x], 'someone@else.example') FROM unnest(ARRAY['c.gone.00000000000000f1', 'c.never.0000000000000bad']) x LOOP
    PERFORM pg_temp.is(format('%s|%s', r ->> 'held', r ->> 'held_reason'), 'true|unknown_address', 'mail to a c. address of no record is held');
  END LOOP;
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.quote_request_messages WHERE provider_message_id LIKE 're_nobody_%' AND quote_request_id IS NULL AND firm_id IS NULL), 2,
    'on the platform''s holding list');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_messages WHERE provider_message_id LIKE 're_nobody_%'), 0, 'and on no conversation');
  RAISE NOTICE 'conversation_replies: mail to an address of no record is held';
END $$;

-- ---------- 7. A message to two conversations' addresses is held as ambiguous: their firm's when both are one firm's, else the platform's. ----------
-- Catches: one message filed on whichever conversation sorted first, so one record's people read mail meant as much for another. A live quote request's
-- address wins over a conversation's, as before this slice (the PEO thread is unchanged).
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.mailbox('acme_agent2', 'agent2@acme.example');
  PERFORM pg_temp.as_user('acme_agent2');
  PERFORM public.send_conversation_message(p_contact_id => pg_temp.id('bo'), p_subject => 'Hello', p_body => 'Hi Bo');
  RESET ROLE;
  UPDATE public.conversations SET reply_address = 'c.bay.00000000000000a4' WHERE contact_id = pg_temp.id('bo');
  INSERT INTO fx SELECT 'conv_bo', id FROM public.conversations WHERE contact_id = pg_temp.id('bo');
  r := pg_temp.receive('re_two_acme', ARRAY['c.reyes.00000000000000a1', 'c.bay.00000000000000a4'], 'someone@else.example');
  PERFORM pg_temp.is(format('%s|%s', r ->> 'held', r ->> 'held_reason'), 'true|ambiguous_address', 'two of one firm''s conversations: held as ambiguous');
  PERFORM pg_temp.is((SELECT firm_id FROM public.quote_request_messages WHERE provider_message_id = 're_two_acme'), pg_temp.id('acme'), 'for that firm');
  r := pg_temp.receive('re_two_firms', ARRAY['c.reyes.00000000000000a1', 'c.zen.00000000000000a3'], 'someone@else.example');
  PERFORM pg_temp.is(format('%s|%s', r ->> 'held', r ->> 'held_reason'), 'true|ambiguous_address', 'two firms'' conversations: held as ambiguous');
  PERFORM pg_temp.is((SELECT firm_id FROM public.quote_request_messages WHERE provider_message_id = 're_two_firms'), NULL::uuid, 'for the platform alone');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.conversation_messages WHERE provider_message_id IN ('re_two_acme', 're_two_firms')), 0, 'and on no conversation');
  RAISE NOTICE 'conversation_replies: two conversations are ambiguous';
END $$;

-- ---------- 8. The conversation's read shows a received message: who sent it, by name, and whether it is new or automatic (6.2's conversation_for). ----------
-- Catches: replies stored but never shown on the contact, or shown without what says who wrote them.
DO $$
DECLARE c jsonb; m jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1');
  c := public.conversation_for(p_contact_id => pg_temp.id('lucia'));
  SELECT x INTO m FROM jsonb_array_elements(c -> 'messages') x WHERE x ->> 'id' = (SELECT id::text FROM public.conversation_messages WHERE provider_message_id = 're_new_1');
  PERFORM pg_temp.is(format('%s|%s|%s|%s|%s|%s', m ->> 'direction', m ->> 'status', m ->> 'from_address', m ->> 'from_name', m ->> 'new_sender', m ->> 'is_automatic'),
    'inbound|received|books@reyes.example|Pat Books|true|false', 'a received message as the conversation''s read shows it');
  SELECT x INTO m FROM jsonb_array_elements(c -> 'messages') x WHERE x ->> 'id' = (SELECT id::text FROM public.conversation_messages WHERE provider_message_id = 're_lucia_away');
  PERFORM pg_temp.is(m ->> 'is_automatic', 'true', 'and an automatic one says so');
  RESET ROLE;
  RAISE NOTICE 'conversation_replies: the conversation shows received messages';
END $$;

-- ---------- 9. A new sender on a contact's conversation is offered as a contact on that account; on a lead's, nothing is offered (D-662). ----------
-- Catches: no way to add the stranger, an offer on a lead (which has no account), or an offer for someone already a contact on the account.
DO $$
DECLARE offers text;
BEGIN
  PERFORM pg_temp.receive('re_ortiz_partner', ARRAY['c.ortiz.00000000000000a2'], 'partner@ortiz.example', 'Ortiz Partner');
  PERFORM pg_temp.receive('re_dne_writes', ARRAY['c.reyes.00000000000000a1'], 'DNE@reyes.example');
  PERFORM pg_temp.as_user('acme_agent1');
  SELECT string_agg(x ->> 'from_address' || '=' || (x ->> 'offer_contact'), ',' ORDER BY x ->> 'from_address') INTO offers
  FROM jsonb_array_elements(public.conversation_for(p_contact_id => pg_temp.id('lucia')) -> 'messages') x WHERE (x ->> 'new_sender')::boolean;
  -- dne@reyes.example is already a contact on Reyes Bakery: new on this conversation, but nothing to offer.
  PERFORM pg_temp.is(offers, 'acme_removed@example.test=true,books@reyes.example=true,dne@reyes.example=false,zenith_agent@example.test=true', 'the new senders on a contact''s conversation, and which are offered');
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'from_address' || '=' || (x ->> 'new_sender') || '/' || (x ->> 'offer_contact'), ',')
                      FROM jsonb_array_elements(public.conversation_for(p_lead_id => pg_temp.id('ortiz')) -> 'messages') x WHERE x ->> 'direction' = 'inbound'),
    'partner@ortiz.example=true/false', 'a lead''s new sender is marked new and offered nothing');
  RESET ROLE;
  RAISE NOTICE 'conversation_replies: a new sender is offered as a contact';
END $$;

-- ---------- 10. An agent adds the offered sender as a contact on that account, through the add-contact rules. Catches: the offer leading nowhere, or a ----------
-- contact made with another address than the sender's, on another account, or owned by someone the agent didn't choose.
DO $$
DECLARE r jsonb; msg uuid := (SELECT id FROM public.conversation_messages WHERE provider_message_id = 're_new_1');
BEGIN
  PERFORM pg_temp.as_user('acme_agent1');
  r := public.add_sender_as_contact(p_message_id => msg, p_first_name => 'Pat', p_last_name => 'Books', p_title => 'Bookkeeper');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT format('%s|%s|%s|%s|%s', c.first_name, c.last_name, c.title, c.email, (c.owner_id = pg_temp.id('acme_agent1'))::text)
                      FROM public.contacts c WHERE c.id = (r #>> '{record,id}')::uuid AND c.account_id = pg_temp.id('reyes')),
    'Pat|Books|Bookkeeper|books@reyes.example|true', 'the sender is a contact on the conversation''s account, with their address, owned by the agent');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is((SELECT x ->> 'offer_contact' FROM jsonb_array_elements(public.conversation_for(p_contact_id => pg_temp.id('lucia')) -> 'messages') x
                      WHERE x ->> 'id' = msg::text), 'false', 'and is offered no more');
  RESET ROLE;
  RAISE NOTICE 'conversation_replies: an offered sender is added as a contact';
END $$;

-- ---------- 11. Only an offered sender is added, and only by someone who may see the conversation. Catches: a contact made from a lead's mail, from the ----------
-- firm's own copy or the contact's own reply, twice for one person, or by someone the level rule keeps out (another firm's, or an agent who can't see it).
DO $$
DECLARE
  msg_new uuid := (SELECT id FROM public.conversation_messages WHERE provider_message_id = 're_new_1');
  msg_zen uuid := (SELECT id FROM public.conversation_messages WHERE provider_message_id = 're_by_zenith');
  msg_lead uuid := (SELECT id FROM public.conversation_messages WHERE provider_message_id = 're_ortiz_partner');
  msg_own uuid := (SELECT id FROM public.conversation_messages WHERE provider_message_id = 're_by_agent2');
  msg_lucia uuid := (SELECT id FROM public.conversation_messages WHERE provider_message_id = 're_lucia_1');
  msg_out uuid := (SELECT id FROM public.conversation_messages WHERE conversation_id = pg_temp.id('conv_lucia') AND direction = 'outbound');
BEGIN
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_sender_as_contact(%L, ''A'', ''B'')', msg_new)),
    'PT409: This sender isn''t one to add: they are already a contact, or the message isn''t from someone new.', 'a sender already added');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_sender_as_contact(%L, ''A'', ''B'')', msg_lead)),
    'PT409: A lead''s conversation has no account to add a contact to.', 'a sender on a lead''s conversation');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.add_sender_as_contact(%L, ''A'', ''B'')', msg_own)), 5), 'PT409', 'the firm''s own copy');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.add_sender_as_contact(%L, ''A'', ''B'')', msg_lucia)), 5), 'PT409', 'the contact''s own reply');
  PERFORM pg_temp.is(left(pg_temp.refusal(format('SELECT public.add_sender_as_contact(%L, ''A'', ''B'')', msg_out)), 5), 'PT409', 'a message the agent sent');
  PERFORM pg_temp.as_user('acme_agent3');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_sender_as_contact(%L, ''A'', ''B'')', msg_zen)), 'PT404: That message isn''t one you can see.',
    'an agent who may not see the account');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_sender_as_contact(%L, ''A'', ''B'')', msg_zen)), 'PT404: That message isn''t one you can see.',
    'another firm''s owner');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.add_sender_as_contact(%L, ''A'', ''B'')', gen_random_uuid())), 'PT404: That message isn''t one you can see.',
    'a message that is not there');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.contacts WHERE lower(email) IN ('books@reyes.example', 'partner@ortiz.example', 'zenith_agent@example.test',
                      'acme_agent2@example.test')), 1, 'and no contact was made by any of them');
  RAISE NOTICE 'conversation_replies: only an offered sender is added';
END $$;

-- ---------- 12. A conversation with mail from a person since anyone last opened it is marked new (D-607). Catches: a reply nobody is told about, or ----------
-- a conversation marked new by the agent's own sends, an automatic reply or the firm's own copy.
DO $$
BEGIN
  PERFORM pg_temp.receive('re_zoe_away', ARRAY['c.zen.00000000000000a3'], 'robot@zen.example', NULL, true);
  PERFORM pg_temp.receive('re_zoe_own', ARRAY['c.zen.00000000000000a3'], 'zen.agent@zenith.example');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(public.conversation_for(p_contact_id => pg_temp.id('lucia')) #>> '{conversation,new_mail}', 'true', 'a conversation with a reply is new');
  PERFORM pg_temp.as_user('acme_agent2');
  PERFORM pg_temp.is(public.conversation_for(p_contact_id => pg_temp.id('bo')) #>> '{conversation,new_mail}', 'false', 'one with only the agent''s own sends is not');
  PERFORM pg_temp.as_user('zenith_agent');
  PERFORM pg_temp.is(public.conversation_for(p_contact_id => pg_temp.id('zoe')) #>> '{conversation,new_mail}', 'false',
    'nor one with only an automatic reply and the firm''s own copy');
  RESET ROLE;
  RAISE NOTICE 'conversation_replies: new mail is marked';
END $$;

-- ---------- 13. Opening a conversation clears its mark for everyone in the firm, through what the page showed (D-607). Catches: a mark that stays after ----------
-- someone read it, one cleared for one person only, mail that came after the page loaded cleared unseen, or a mark moved backwards.
DO $$
DECLARE shown timestamptz;
BEGIN
  shown := (SELECT max(recorded_at) FROM public.conversation_messages WHERE conversation_id = pg_temp.id('conv_lucia'));
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.open_conversation(p_conversation_id => pg_temp.id('conv_lucia'), p_seen_through => shown);
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(public.conversation_for(p_contact_id => pg_temp.id('lucia')) #>> '{conversation,new_mail}', 'false', 'opened by one, it is new for no one');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT last_opened_by FROM public.conversations WHERE id = pg_temp.id('conv_lucia')), pg_temp.id('acme_owner'), 'it says who opened it');
  PERFORM pg_temp.receive('re_after_open', ARRAY['c.reyes.00000000000000a1'], 'lucia@reyes.example');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM public.open_conversation(p_conversation_id => pg_temp.id('conv_lucia'), p_seen_through => shown - interval '1 hour');
  PERFORM pg_temp.is(public.conversation_for(p_contact_id => pg_temp.id('lucia')) #>> '{conversation,new_mail}', 'true',
    'mail after what the page showed stays new, and an older mark doesn''t move it back');
  PERFORM public.open_conversation(p_conversation_id => pg_temp.id('conv_lucia'));
  PERFORM pg_temp.is(public.conversation_for(p_contact_id => pg_temp.id('lucia')) #>> '{conversation,new_mail}', 'false', 'with no moment, it is opened now');
  PERFORM pg_temp.as_user('acme_agent3');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.open_conversation(%L)', pg_temp.id('conv_lucia'))), 'PT404: That conversation isn''t one you can see.',
    'an agent who may not see it');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.open_conversation(%L)', pg_temp.id('conv_lucia'))), 'PT404: That conversation isn''t one you can see.',
    'another firm');
  RESET ROLE;
  RAISE NOTICE 'conversation_replies: opening clears the mark';
END $$;

-- ---------- 15. An account's page and an opportunity's page read the messages of their contacts' conversations, each message stored once (D-601). ----------
-- Catches: a reply shown on the contact but not the account or its opportunity, another account's mail mixed in, a copy kept per record, or the read open
-- to someone the level rule keeps out (an agent who can't see the account, another firm).
DO $$
DECLARE got jsonb; want text;
BEGIN
  INSERT INTO public.conversations (firm_id, contact_id, reply_address) VALUES (pg_temp.id('acme'), pg_temp.id('phone_only'), 'c.reyes.00000000000000a5');
  PERFORM pg_temp.receive('re_phone_only', ARRAY['c.reyes.00000000000000a5'], 'phone@reyes.example');
  PERFORM pg_temp.opportunity('reyes_opp', 'reyes', 'acme_agent1');
  PERFORM pg_temp.opportunity('bay_opp', 'bay', 'acme_agent2');
  want := (SELECT string_agg(m.id::text, ',' ORDER BY m.recorded_at DESC, m.id DESC) FROM public.conversation_messages m
           WHERE m.conversation_id IN (pg_temp.id('conv_lucia'), (SELECT id FROM public.conversations WHERE contact_id = pg_temp.id('phone_only'))));
  PERFORM pg_temp.as_user('acme_agent1');
  got := public.account_conversation_messages(p_account_id => pg_temp.id('reyes'));
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'id', ',' ORDER BY ord) FROM jsonb_array_elements(got -> 'messages') WITH ORDINALITY t (x, ord)), want,
    'the account reads every message of its contacts'' conversations, newest first');
  PERFORM pg_temp.is((SELECT x ->> 'contact_id' FROM jsonb_array_elements(got -> 'messages') x WHERE x ->> 'from_address' = 'phone@reyes.example'),
    pg_temp.id('phone_only')::text, 'each says whose conversation it is on');
  got := public.account_conversation_messages(p_opportunity_id => pg_temp.id('reyes_opp'));
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'id', ',' ORDER BY ord) FROM jsonb_array_elements(got -> 'messages') WITH ORDINALITY t (x, ord)), want,
    'and the account''s opportunity reads the same messages');
  PERFORM pg_temp.as_user('acme_agent3');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.account_conversation_messages(p_account_id => %L)', pg_temp.id('reyes'))),
    'PT404: That account or opportunity isn''t one you can see.', 'an agent who may not see the account');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.account_conversation_messages(p_opportunity_id => %L)', pg_temp.id('bay_opp'))),
    'PT404: That account or opportunity isn''t one you can see.', 'nor an opportunity they may not see');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.account_conversation_messages(p_account_id => %L)', pg_temp.id('reyes'))),
    'PT404: That account or opportunity isn''t one you can see.', 'nor another firm');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(jsonb_array_length(public.account_conversation_messages(p_account_id => pg_temp.id('bay')) -> 'messages'),
    (SELECT count(*)::int FROM public.conversation_messages WHERE conversation_id = pg_temp.id('conv_bo')), 'another account reads only its own');
  RESET ROLE;
  RAISE NOTICE 'conversation_replies: an account and an opportunity read their contacts'' mail';
END $$;

-- ---------- 16. A received message keeps its own Message-ID and what it answers, so the agent's answer to it threads in the contact's mail (M-2.1). ----------
-- Catches: an answer to a reply that starts a new thread in the contact's mailbox, or a second copy of one message refused for its repeated Message-ID.
DO $$
DECLARE r jsonb; out_id text := (SELECT message_id FROM public.conversation_messages WHERE conversation_id = pg_temp.id('conv_lucia') AND direction = 'outbound');
  answer jsonb;
BEGIN
  r := pg_temp.receive('re_threaded', ARRAY['c.reyes.00000000000000a1'], 'lucia@reyes.example', NULL, false,
                       jsonb_build_object('message-id', '<CAx1@mail.reyes.example>', 'in-reply-to', out_id));
  PERFORM pg_temp.is((SELECT format('%s|%s', message_id, (in_reply_to = out_id)::text) FROM public.conversation_messages WHERE id = (r ->> 'conversation_message_id')::uuid),
    '<CAx1@mail.reyes.example>|true', 'its Message-ID and In-Reply-To are kept');
  PERFORM pg_temp.as_user('acme_agent1');
  answer := public.send_conversation_message(p_contact_id => pg_temp.id('lucia'), p_subject => 'Re: hello', p_body => 'Tuesday it is',
                                             p_in_reply_to => (r ->> 'conversation_message_id')::uuid);
  RESET ROLE;
  PERFORM pg_temp.is(answer ->> 'in_reply_to', '<CAx1@mail.reyes.example>', 'the agent''s answer names it');
  -- The same message delivered again under another provider id (sent to the address twice): kept, under an id of its own.
  r := pg_temp.receive('re_threaded_again', ARRAY['c.reyes.00000000000000a1'], 'lucia@reyes.example', NULL, false,
                       jsonb_build_object('message-id', '<CAx1@mail.reyes.example>'));
  PERFORM pg_temp.is((SELECT message_id <> '<CAx1@mail.reyes.example>' FROM public.conversation_messages WHERE id = (r ->> 'conversation_message_id')::uuid), true,
    'a repeated Message-ID is kept under one of its own');
  RAISE NOTICE 'conversation_replies: a received message keeps its Message-ID';
END $$;

-- ---------- 17. A received message's attachments follow PEO mail's rules: each recorded, then settled by its own scan; a failed scan blocks only that ----------
-- file. Catches: an infected file shown as kept, a clean file beside it lost with it, or a file shown before its scan.
DO $$
DECLARE msg uuid := (SELECT id FROM public.conversation_messages WHERE provider_message_id = 're_lucia_1'); a1 jsonb; a2 jsonb; a3 jsonb; shown jsonb;
BEGIN
  PERFORM pg_temp.as_service();
  a1 := public.record_conversation_attachment(msg, 'att_1', 'census.pdf', 'application/pdf', 1000);
  a2 := public.record_conversation_attachment(msg, 'att_2', 'invoice.pdf', 'application/pdf', 2000);
  a3 := public.record_conversation_attachment(msg, 'att_3', 'macro.xlsm', 'application/vnd.ms-excel', 3000, 'unsupported_type');
  PERFORM pg_temp.is(format('%s|%s|%s', a1 ->> 'status', a2 ->> 'status', a3 ->> 'status'), 'pending|pending|not_kept', 'each is recorded, pending its scan or not kept');
  PERFORM pg_temp.is(public.record_conversation_attachment(msg, 'att_1', 'census.pdf', 'application/pdf', 1000) ->> 'id', a1 ->> 'id', 'a replay records it once');
  PERFORM public.finish_conversation_attachment((a1 ->> 'id')::uuid, 'clean', NULL, 'contact-mail', 'p/census.pdf', repeat('a', 64));
  PERFORM public.finish_conversation_attachment((a2 ->> 'id')::uuid, 'infected', 'Eicar-Test-Signature');
  RESET ROLE;
  PERFORM pg_temp.as_user('acme_agent1');
  SELECT x -> 'attachments' INTO shown FROM jsonb_array_elements(public.conversation_for(p_contact_id => pg_temp.id('lucia')) -> 'messages') x WHERE x ->> 'id' = msg::text;
  RESET ROLE;
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'file_name' || '=' || (x ->> 'status') || '/' || COALESCE(x ->> 'storage_path', '-'), ',' ORDER BY x ->> 'file_name')
                      FROM jsonb_array_elements(shown) x),
    'census.pdf=stored/p/census.pdf,invoice.pdf=blocked/-,macro.xlsm=not_kept/-', 'the message shows each file as it was settled: only the infected one is blocked');
  RAISE NOTICE 'conversation_replies: attachments are scanned one by one';
END $$;

-- ---------- 18. A received file is read only by whoever reads its conversation, and only once its scan passed. Catches: a contact's file open to an ----------
-- agent the level rule keeps out, to another firm, or to anyone before or without a clean scan.
DO $$
DECLARE n text;
BEGIN
  INSERT INTO storage.objects (bucket_id, name) VALUES ('contact-mail', 'p/census.pdf'), ('contact-mail', 'p/unrecorded.pdf');
  FOR n IN SELECT unnest(ARRAY['acme_agent1', 'acme_owner', 'acme_agent3', 'zenith_owner']) LOOP
    PERFORM pg_temp.as_user(n);
    PERFORM pg_temp.is(format('%s|%s', (SELECT count(*) FROM public.conversation_message_attachments a
                                        WHERE a.message_id = (SELECT id FROM public.conversation_messages WHERE provider_message_id = 're_lucia_1')),
                              (SELECT string_agg(o.name, ',' ORDER BY o.name) FROM storage.objects o WHERE o.bucket_id = 'contact-mail')),
      CASE WHEN n IN ('acme_agent1', 'acme_owner') THEN '3|p/census.pdf' ELSE '0|' END, n || ' reads the files of the conversations they may read, and only stored ones');
  END LOOP;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.conversation_message_attachments'), '42501', 'a signed-out visitor reads none');
  RESET ROLE;
  RAISE NOTICE 'conversation_replies: a received file is read as its conversation is';
END $$;

-- ---------- 19. (from the mutation pass) Opening with an older moment never moves the mark back. Catches: a stale page, opened late, making mail ----------
-- someone already read new again for the whole firm.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM public.open_conversation(p_conversation_id => pg_temp.id('conv_lucia'));
  PERFORM public.open_conversation(p_conversation_id => pg_temp.id('conv_lucia'), p_seen_through => now() - interval '1 day');
  PERFORM pg_temp.is(public.conversation_for(p_contact_id => pg_temp.id('lucia')) #>> '{conversation,new_mail}', 'false', 'a later open through an older moment leaves it read');
  RESET ROLE;
  RAISE NOTICE 'conversation_replies: the mark never moves back';
END $$;

-- ---------- 20. (from the mutation pass) An opportunity's mail needs the opportunity itself to be one the caller may see, not only its account. ----------
-- Catches: an agent reading, through an opportunity of a colleague's that the level rule keeps from them, the mail of an account they may see.
DO $$
BEGIN
  PERFORM pg_temp.opportunity('reyes_opp_other', 'reyes', 'acme_agent3');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.account_conversation_messages(p_opportunity_id => %L)', pg_temp.id('reyes_opp_other'))),
    'PT404: That account or opportunity isn''t one you can see.', 'an opportunity the agent may not see, on an account they may');
  RESET ROLE;
  RAISE NOTICE 'conversation_replies: an opportunity''s mail asks for the opportunity''s own level';
END $$;
