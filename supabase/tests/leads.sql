-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh leads
-- Leads (story CRM-L1.3a, slice 8.1, #188; docs/BROKER_CRM_BUILD.md D-803 to D-809; 20261121085500_leads.sql).
-- A lead is its own record: who and which business, its source, its owner and its status; Not a fit with its reason; Converted only with what it
-- made; seen by the level rule; the bin; its history; calls, notes and tasks on it; labels on it. Two firms: Acme sees by level, Zenith shows
-- everyone everything. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261123190000_intake_teaches_account.sql
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

-- ---------- 1. A lead holds who and which business, and starts New ----------
DO $$
DECLARE l public.leads;
BEGIN
  INSERT INTO public.leads (firm_id, owner_id, name, title, business, email, phone, state, employees, current_provider, source)
  VALUES (pg_temp.id('acme'), pg_temp.id('acme_agent1'), 'Lucia Reyes', 'Owner', 'Reyes Bakery', 'lucia@reyes.example', '503-555-0101', 'OR', 23, 'Gusto', 'added_by_hand')
  RETURNING * INTO l;
  PERFORM pg_temp.is(l.status, 'new', 'a lead made with no status');
  PERFORM pg_temp.is(l.business, 'Reyes Bakery', 'the business it names');
  PERFORM pg_temp.is(l.employees, 23, 'its employees');
  PERFORM pg_temp.is(l.deleted_at, NULL::timestamptz, 'a new lead is not in the bin');
  INSERT INTO fx VALUES ('lucia', l.id);
END $$;

-- ---------- 2. Its status: New, Working, Converted or Not a fit; Not a fit with a reason from the list ----------
SELECT pg_temp.lead('reyes', 'acme', 'acme_agent1', 'Reyes Bakery');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'qualified' WHERE id = pg_temp.id('reyes')$$), '23514', 'a status that is not one of the four');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'working' WHERE id = pg_temp.id('reyes')$$), 'rows:1', 'Working');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'not_fit' WHERE id = pg_temp.id('reyes')$$), '23514', 'Not a fit with no reason');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'not_fit', not_fit_reason = 'too_pricey' WHERE id = pg_temp.id('reyes')$$), '23514', 'a reason not on the list');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET not_fit_reason = 'too_small' WHERE id = pg_temp.id('reyes')$$), '23514', 'a reason on a lead that is not Not a fit');
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['too_small', 'wrong_industry', 'not_interested', 'bad_contact_details', 'other'] LOOP
    PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.leads SET status = 'not_fit', not_fit_reason = %L WHERE id = pg_temp.id('reyes')$q$, r)), 'rows:1', 'Not a fit because ' || r);
  END LOOP;
END $$;

-- ---------- 3. Converted only with what it made, and then for good ----------
SELECT pg_temp.lead('kim', 'acme', 'acme_agent1', 'Kim Dental');
SELECT pg_temp.account('kim_dental', 'acme', 'acme_agent1');
SELECT pg_temp.account('zenith_acct', 'zenith', 'zenith_agent');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'converted', converted_at = now() WHERE id = pg_temp.id('kim')$$), '23514', 'Converted with no account it made');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET converted_account_id = pg_temp.id('kim_dental') WHERE id = pg_temp.id('kim')$$), '23514', 'what it made, on a lead not Converted');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'converted', converted_at = now(), converted_account_id = pg_temp.id('zenith_acct') WHERE id = pg_temp.id('kim')$$), '23503', 'Converted into another firm''s account');
UPDATE public.leads SET status = 'converted', converted_account_id = pg_temp.id('kim_dental'), converted_at = now() WHERE id = pg_temp.id('kim');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'working', converted_account_id = NULL, converted_at = NULL WHERE id = pg_temp.id('kim')$$), '42501', 'a converted lead made Working again');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET phone = '503-555-0199' WHERE id = pg_temp.id('kim')$$), '42501', 'a converted lead''s field changed');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET deleted_at = now() WHERE id = pg_temp.id('kim')$$), '42501', 'a converted lead put in the bin');

-- ---------- 4. Who sees a lead: the level rule (D-809), and the bin to owners only (D-806) ----------
-- Acme sees by level: an agent their own, a lead their team's and the teams under it, an owner every lead; a lead with no owner, or whose owner left,
-- is an owner's alone. Zenith shows everyone everything. Nobody outside a firm sees its leads. A lead in the bin is in no view but owners' Deleted.
SELECT pg_temp.lead('a2', 'acme', 'acme_agent2');
SELECT pg_temp.lead('w1', 'acme', 'acme_west');
SELECT pg_temp.lead('un', 'acme', NULL);
SELECT pg_temp.lead('gone', 'acme', 'acme_gone');
SELECT pg_temp.lead('binned', 'acme', 'acme_agent1');
UPDATE public.leads SET deleted_at = now() WHERE id = pg_temp.id('binned');
SELECT pg_temp.lead('z1', 'zenith', 'zenith_agent');
SELECT pg_temp.lead('z2', 'zenith', 'zenith_agent2');

DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('acme_agent1', 'acme-brokers', 'kim,lucia,reyes'),
    ('acme_agent2', 'acme-brokers', 'a2'),
    ('acme_west', 'acme-brokers', 'w1'),
    ('acme_lead', 'acme-brokers', 'a2,w1'),
    ('acme_lead2', 'acme-brokers', ''),
    ('acme_owner', 'acme-brokers', 'a2,binned,gone,kim,lucia,reyes,un,w1'),
    ('acme_removed', 'acme-brokers', ''),
    ('acme_owner', 'zenith-benefits', ''),
    ('zenith_agent', 'zenith-benefits', 'z1,z2'),
    ('zenith_owner', 'zenith-benefits', 'z1,z2'),
    ('platform_admin', NULL, ''),
    ('nobody', NULL, '')
  ) AS v (who, addr, want) LOOP
    PERFORM pg_temp.as_user(c.who, c.addr);
    PERFORM pg_temp.is(pg_temp.seen('public.leads'), c.want, c.who || ' at ' || COALESCE(c.addr, 'the bare domain') || ' sees');
  END LOOP;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.seen('public.leads'), 'denied', 'a guest');
  PERFORM pg_temp.as_owner();
END $$;

-- Nobody writes a lead through the API: the functions of later slices do.
DO $$
DECLARE who text;
BEGIN
  FOREACH who IN ARRAY ARRAY['acme_owner', 'acme_agent1'] LOOP
    PERFORM pg_temp.as_user(who, 'acme-brokers');
    PERFORM pg_temp.is(pg_temp.attempt($q$UPDATE public.leads SET name = 'x'$q$), '42501', who || ' updates a lead directly');
    PERFORM pg_temp.is(pg_temp.attempt($q$DELETE FROM public.leads$q$), '42501', who || ' deletes a lead directly');
    PERFORM pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.leads (firm_id, name, source) VALUES (%L, 'x', 'added_by_hand')$q$, pg_temp.id('acme'))), '42501', who || ' inserts a lead directly');
  END LOOP;
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 5. Its history: made, and every change of status and field, with who (D-808, D-45) ----------
SELECT pg_temp.claims_of('acme_agent1');
SELECT pg_temp.lead('hist', 'acme', 'acme_agent1', 'History Co');
UPDATE public.leads SET status = 'working' WHERE id = pg_temp.id('hist');
UPDATE public.leads SET status = 'not_fit', not_fit_reason = 'too_small' WHERE id = pg_temp.id('hist');
UPDATE public.leads SET phone = '503-555-0142' WHERE id = pg_temp.id('hist');
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.record_history_list(pg_temp.id('acme'), 'leads', pg_temp.id('hist')::text) WHERE kind = 'created'),
                     1, 'the lead''s owner reads that it was made');
  PERFORM pg_temp.is((SELECT string_agg(to_value #>> '{}', ',' ORDER BY at, entry_key)
                      FROM public.record_history_list(pg_temp.id('acme'), 'leads', pg_temp.id('hist')::text) WHERE field = 'status'),
                     'working,not_fit', 'each status change, in order');
  PERFORM pg_temp.is((SELECT string_agg(field || '=' || (to_value #>> '{}'), ',' ORDER BY field)
                      FROM public.record_history_list(pg_temp.id('acme'), 'leads', pg_temp.id('hist')::text) WHERE field IN ('not_fit_reason', 'phone')),
                     'not_fit_reason=too_small,phone=503-555-0142', 'the reason and a field change');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'leads', %L)$q$, pg_temp.id('acme'), pg_temp.id('hist')::text)), 'PT404', 'another agent may not read it');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'leads', %L)$q$, pg_temp.id('acme'), pg_temp.id('hist')::text)), 'PT404', 'nor another firm''s owner (one refusal: nobody learns it exists)');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 6. Calls, notes and tasks on a lead: each on exactly one of an account or a lead (D-807) ----------
SELECT pg_temp.lead('act', 'acme', 'acme_agent1', 'Activity Co');
SELECT pg_temp.account('act_acct', 'acme', 'acme_agent1');
SELECT pg_temp.contact('act_contact', 'act_acct', 'acme_agent1', 'c@act.example');
DO $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.activities (firm_id, lead_id, kind, body) VALUES (pg_temp.id('acme'), pg_temp.id('act'), 'note', 'Called the front desk') RETURNING id INTO r;
  INSERT INTO fx VALUES ('act_note', r);
  INSERT INTO public.activities (firm_id, lead_id, kind, outcome) VALUES (pg_temp.id('acme'), pg_temp.id('act'), 'call', 'spoke') RETURNING id INTO r;
  INSERT INTO fx VALUES ('act_call', r);
END $$;
SELECT pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.activities (firm_id, kind, body) VALUES (%L, 'note', 'On nothing')$q$, pg_temp.id('acme'))), '23514', 'a note on neither an account nor a lead');
SELECT pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.activities (firm_id, account_id, lead_id, kind, body) VALUES (%L, %L, %L, 'note', 'On both')$q$,
  pg_temp.id('acme'), pg_temp.id('act_acct'), pg_temp.id('act'))), '23514', 'a note on both an account and a lead');
SELECT pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.activities (firm_id, lead_id, kind, body) VALUES (%L, %L, 'note', 'Other firm')$q$,
  pg_temp.id('zenith'), pg_temp.id('act'))), '23503', 'a note of one firm on another firm''s lead');
SELECT pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.activities (firm_id, lead_id, contact_id, kind, body) VALUES (%L, %L, pg_temp.id('act_contact'), 'note', 'With a contact')$q$,
  pg_temp.id('acme'), pg_temp.id('act'))), '23514', 'a lead''s note naming a contact');

-- Seen by whoever sees the lead.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('acme_agent1', 'acme-brokers', 'act_call,act_note'),
    ('acme_agent2', 'acme-brokers', ''),
    ('acme_owner', 'acme-brokers', 'act_call,act_note'),
    ('zenith_owner', 'zenith-benefits', '')
  ) AS v (who, addr, want) LOOP
    PERFORM pg_temp.as_user(c.who, c.addr);
    PERFORM pg_temp.is((SELECT COALESCE(string_agg(f.name, ',' ORDER BY f.name), '') FROM public.activities t JOIN fx f ON f.id = t.id WHERE f.name LIKE 'act\_%'),
                       c.want, c.who || ' sees the lead''s calls, notes and tasks');
  END LOOP;
  PERFORM pg_temp.as_owner();
END $$;

-- Removing a lead for good takes its calls, notes and tasks with it.
DELETE FROM public.leads WHERE id = pg_temp.id('act');
SELECT pg_temp.is((SELECT count(*)::int FROM public.activities WHERE id IN (pg_temp.id('act_note'), pg_temp.id('act_call'))), 0, 'a removed lead''s activities');

-- ---------- 7. Labels on leads, from the firm's one list (D-805) ----------
SELECT pg_temp.lead('lab', 'acme', 'acme_agent1', 'Label Co');
INSERT INTO public.labels (firm_id, name) VALUES (pg_temp.id('acme'), 'VIP'), (pg_temp.id('zenith'), 'Hot');
SELECT pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.lead_labels (firm_id, lead_id, label_id) SELECT %L, %L, id FROM public.labels WHERE name = 'VIP'$q$,
  pg_temp.id('acme'), pg_temp.id('lab'))), 'rows:1', 'the firm''s label on its lead');
SELECT pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.lead_labels (firm_id, lead_id, label_id) SELECT %L, %L, id FROM public.labels WHERE name = 'Hot'$q$,
  pg_temp.id('acme'), pg_temp.id('lab'))), '23503', 'another firm''s label on a lead');
INSERT INTO public.lead_labels (firm_id, lead_id, label_id) SELECT pg_temp.id('acme'), pg_temp.id('lab'), id FROM public.labels WHERE name = 'VIP';
SELECT pg_temp.is(pg_temp.attempt(format($q$INSERT INTO public.lead_labels (firm_id, lead_id, label_id) SELECT %L, %L, id FROM public.labels WHERE name = 'VIP'$q$,
  pg_temp.id('acme'), pg_temp.id('lab'))), '23505', 'the same label twice on a lead');
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt('SELECT * FROM public.lead_labels'), '42501', 'labels on leads are read through the functions only, like an account''s');
  PERFORM pg_temp.as_owner();
END $$;
DELETE FROM public.leads WHERE id = pg_temp.id('lab');
SELECT pg_temp.is((SELECT count(*)::int FROM public.lead_labels), 0, 'a removed lead''s labels go with it');

-- ---------- 7b. What converting made is of the one account it made; the source is the product's (review of #214) ----------
SELECT pg_temp.lead('conv', 'acme', 'acme_agent1', 'Conv Co');
SELECT pg_temp.account('conv_acct', 'acme', 'acme_agent1');
SELECT pg_temp.account('other_acct', 'acme', 'acme_agent1');
SELECT pg_temp.contact('other_contact', 'other_acct', 'acme_agent1', 'o@other.example');
SELECT pg_temp.opportunity('other_opp', 'other_acct', 'acme_agent1');
SELECT pg_temp.contact('zen_contact', 'zenith_acct', 'zenith_agent', 'z@zen.example');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'converted', converted_at = now(), converted_account_id = pg_temp.id('conv_acct'), converted_contact_id = pg_temp.id('other_contact') WHERE id = pg_temp.id('conv')$$),
  '23503', 'a contact of another account than the one it made');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'converted', converted_at = now(), converted_account_id = pg_temp.id('conv_acct'), converted_contact_id = pg_temp.id('zen_contact') WHERE id = pg_temp.id('conv')$$),
  '23503', 'another firm''s contact');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'converted', converted_at = now(), converted_account_id = pg_temp.id('conv_acct'), converted_opportunity_id = pg_temp.id('other_opp') WHERE id = pg_temp.id('conv')$$),
  '23503', 'an opportunity of another account');
SELECT pg_temp.contact('conv_contact', 'conv_acct', 'acme_agent1', 'c@conv.example');
SELECT pg_temp.opportunity('conv_opp', 'conv_acct', 'acme_agent1');
SELECT pg_temp.is(pg_temp.attempt($$UPDATE public.leads SET status = 'converted', converted_at = now(), converted_account_id = pg_temp.id('conv_acct'), converted_contact_id = pg_temp.id('conv_contact'), converted_opportunity_id = pg_temp.id('conv_opp') WHERE id = pg_temp.id('conv')$$),
  'rows:1', 'the account it made, with that account''s contact and opportunity');

UPDATE public.leads SET source = 'import' WHERE id = pg_temp.id('conv');
SELECT pg_temp.is((SELECT source FROM public.leads WHERE id = pg_temp.id('conv')), 'added_by_hand', 'a lead keeps the source it was made with, whoever writes (D-211)');


-- ---------- 8. Closing a firm deletes its leads, their labels and their calls, notes and tasks; another firm's stay (D-803, CRM-P1.7) ----------
DO $$
DECLARE before_acme int := (SELECT count(*) FROM public.leads WHERE firm_id = pg_temp.id('acme'));
BEGIN
  PERFORM pg_temp.lead('zl', 'zenith', 'zenith_agent', 'Zenith Lead Co');
  INSERT INTO public.activities (firm_id, lead_id, kind, body) VALUES (pg_temp.id('zenith'), pg_temp.id('zl'), 'note', 'Zenith note');
  INSERT INTO public.lead_labels (firm_id, lead_id, label_id) SELECT pg_temp.id('zenith'), pg_temp.id('zl'), id FROM public.labels WHERE name = 'Hot';
  INSERT INTO public.firm_closures (firm_id, asked_at, asked_by, closes_at) VALUES (pg_temp.id('zenith'), now() - interval '31 days', pg_temp.id('zenith_owner'), now() - interval '1 day');
  PERFORM public.close_firm_now(pg_temp.id('zenith'));
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE firm_id = pg_temp.id('zenith')), 0, 'the closed firm''s leads');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.lead_labels WHERE firm_id = pg_temp.id('zenith')), 0, 'the labels on them');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.activities WHERE firm_id = pg_temp.id('zenith')), 0, 'their calls, notes and tasks');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE firm_id = pg_temp.id('acme')), before_acme, 'another firm''s leads are untouched');
END $$;

SELECT 'leads: all passed';
