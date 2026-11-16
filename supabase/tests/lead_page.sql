-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh lead_page
-- A lead's page (story CRM-L2.1, slice 8.5; docs/BROKER_CRM_BUILD.md D-803, D-807 to D-809, D-1650 to D-1659; 20261122220000_lead_page.sql).
-- lead_page, update_lead, mark_lead_not_fit, reopen_lead, log_lead_activity, lead_activity, lead_activity_options, and the restated update_activity,
-- add_to_note and set_task_done on a lead's calls, notes and tasks. Two firms: Acme sees by level, Zenith shows everyone everything. Every migration is
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
\i supabase/migrations/20261121090000_leads.sql
\i supabase/migrations/20261121100000_create_lead.sql
\i supabase/migrations/20261121110000_leads_table_query.sql
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
\i supabase/migrations/20261122220000_lead_page.sql
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

-- ---------- 1. The page: the lead's own fields, its owner, and whether the caller may change it ----------
-- Catches: a page that leaves out a field the header or the details show, or offers Edit to someone the level rule refuses.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.lead('reyes', 'acme', 'acme_agent1', 'Reyes Bakery');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.lead_page(pg_temp.id('acme'), pg_temp.id('reyes'));
  PERFORM pg_temp.is(r -> 'lead' ->> 'name', 'Person reyes', 'the name');
  PERFORM pg_temp.is(r -> 'lead' ->> 'business', 'Reyes Bakery', 'the business');
  PERFORM pg_temp.is(r -> 'lead' ->> 'status', 'new', 'the status');
  PERFORM pg_temp.is(r -> 'lead' ->> 'source', 'added_by_hand', 'the source');
  PERFORM pg_temp.is((r -> 'lead' ->> 'version')::int, 1, 'the version a save starts from');
  PERFORM pg_temp.is((r -> 'lead' -> 'owner' ->> 'id')::uuid, pg_temp.id('acme_agent1'), 'the owner');
  PERFORM pg_temp.is(r -> 'lead' -> 'owner' ->> 'name', 'acme_agent1@example.test', 'the owner named (their email when they gave no name)');
  PERFORM pg_temp.is((r ->> 'can_change')::boolean, true, 'its owner may change it');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 2. Who sees the page: the level rule, the bin and the firm (D-806, D-809) ----------
-- Catches: a page drawn for someone the leads table would not show the lead to, or one in the bin shown to an agent.
DO $$
BEGIN
  PERFORM pg_temp.lead('zl', 'zenith', 'zenith_agent');
  PERFORM pg_temp.lead('binned', 'acme', 'acme_agent1');
  UPDATE public.leads SET deleted_at = now() WHERE id = pg_temp.id('binned');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(public.lead_page(pg_temp.id('acme'), pg_temp.id('reyes')), NULL, 'another agent''s lead');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(public.lead_page(pg_temp.id('acme'), pg_temp.id('binned')), NULL, 'an agent''s own lead in the bin');
  PERFORM pg_temp.is(public.lead_page(pg_temp.id('zenith'), pg_temp.id('zl')), NULL, 'another firm''s lead');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(public.lead_page(pg_temp.id('acme'), pg_temp.id('binned')) -> 'lead' ->> 'name', 'Person binned', 'an owner reads one in the bin');
  PERFORM pg_temp.as_user('zenith_agent2', 'zenith-benefits');
  PERFORM pg_temp.is((public.lead_page(pg_temp.id('zenith'), pg_temp.id('zl')) ->> 'can_change')::boolean, false, 'everyone sees everything: another agent reads, not changes');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 3. The status bar: when New, Working and Converted each began ----------
-- Catches: a status bar with no dates, or Working dated from something other than the status change in the lead's history (D-808: every status change is one
-- history entry).
DO $$
DECLARE r jsonb; made timestamptz; worked timestamptz;
BEGIN
  PERFORM pg_temp.lead('worked', 'acme', 'acme_agent1');
  PERFORM pg_temp.claims_of('acme_agent1');
  UPDATE public.leads SET status = 'working' WHERE id = pg_temp.id('worked');
  SELECT created_at INTO made FROM public.leads WHERE id = pg_temp.id('worked');
  SELECT max(at) INTO worked FROM public.record_history WHERE table_name = 'leads' AND record_key = pg_temp.id('worked')::text AND field = 'status';
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.lead_page(pg_temp.id('acme'), pg_temp.id('worked')) -> 'stages';
  PERFORM pg_temp.is((r ->> 'new')::timestamptz, made, 'New began when it was made');
  PERFORM pg_temp.is((r ->> 'working')::timestamptz, worked, 'Working began at the status change');
  PERFORM pg_temp.is(r ->> 'converted', NULL, 'not converted');
  PERFORM pg_temp.is(public.lead_page(pg_temp.id('acme'), pg_temp.id('reyes')) -> 'stages' ->> 'working', NULL, 'a New lead has not begun Working');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 4. A converted lead names what it made ----------
-- Catches: a Converted banner with nothing to link to (CRM-L2.1: a banner linking to the account, contact and opportunity).
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.lead('done', 'acme', 'acme_agent1', 'Done Dental');
  PERFORM pg_temp.account('done_acc', 'acme', 'acme_agent1', 'Done Dental');
  PERFORM pg_temp.contact('done_c', 'done_acc', 'acme_agent1', 'd@example.test');
  PERFORM pg_temp.opportunity('done_o', 'done_acc', 'acme_agent1');
  UPDATE public.leads SET status = 'converted', converted_at = now(), converted_account_id = pg_temp.id('done_acc'), converted_contact_id = pg_temp.id('done_c'),
    converted_opportunity_id = pg_temp.id('done_o') WHERE id = pg_temp.id('done');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.lead_page(pg_temp.id('acme'), pg_temp.id('done'));
  PERFORM pg_temp.is((r -> 'converted' -> 'account' ->> 'id')::uuid, pg_temp.id('done_acc'), 'the account it made');
  PERFORM pg_temp.is(r -> 'converted' -> 'account' ->> 'name', 'Done Dental', 'named');
  PERFORM pg_temp.is(r -> 'converted' -> 'contact' ->> 'name', 'First done_c Last done_c', 'the contact it made, named');
  PERFORM pg_temp.is(r -> 'converted' -> 'opportunity' ->> 'name', 'PEO search done_o', 'the opportunity it made, named');
  PERFORM pg_temp.is((r -> 'stages' ->> 'converted') IS NOT NULL, true, 'Converted began');
  PERFORM pg_temp.is(public.lead_page(pg_temp.id('acme'), pg_temp.id('reyes')) -> 'converted', 'null'::jsonb, 'a lead not converted made nothing');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 5. The details saved in place, from the version the person started from; a New lead becomes Working ----------
-- Catches: a save that drops a field, does not move the version on, or leaves a New lead New after its fields changed (D-808: the first saved change to its
-- fields makes it Working).
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.update_lead(p_lead_id => pg_temp.id('reyes'), p_name => ' Lucia Reyes ', p_title => 'Owner', p_business => 'Reyes Bakery', p_email => 'lucia@reyes.example',
    p_phone => '(503) 555-0142', p_city => 'Portland', p_state => 'or', p_employees => 23, p_current_provider => 'Gusto', p_note => 'Met at the breakfast',
    p_firm_id => pg_temp.id('acme'), p_version => 1);
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, false, 'saved');
  PERFORM pg_temp.is(r -> 'record' ->> 'name', 'Lucia Reyes', 'the name, trimmed');
  PERFORM pg_temp.is(r -> 'record' ->> 'state', 'OR', 'the state in capitals');
  PERFORM pg_temp.is((r -> 'record' ->> 'employees')::int, 23, 'employees');
  PERFORM pg_temp.is(r -> 'record' ->> 'city', 'Portland', 'the city');
  PERFORM pg_temp.is(r -> 'record' ->> 'status', 'working', 'a saved change makes a New lead Working');
  PERFORM pg_temp.is((r -> 'record' ->> 'version')::int > 1, true, 'the version moved on');
  PERFORM pg_temp.is(r -> 'record' -> 'owner' ->> 'name', 'acme_agent1@example.test', 'the owner kept and named');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 6. Who may save: the level rule on the lead's owner (D-809) ----------
-- Catches: a save by someone who may not see the lead (it must read as not there, PT404), or by someone who may read it and not change it (42501).
DO $$
DECLARE v int := (SELECT version FROM public.leads WHERE id = pg_temp.id('zl'));
BEGIN
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'X', p_version => 1)$q$, pg_temp.id('reyes'))), ':', 1),
    'PT404', 'another agent''s lead is not there');
  PERFORM pg_temp.as_user('zenith_agent2', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'X', p_version => %s)$q$, pg_temp.id('zl'), v)), ':', 1),
    '42501', 'everyone sees everything: another agent reads and does not change');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT name FROM public.leads WHERE id = pg_temp.id('zl')), 'Person zl', 'nothing changed');
END $$;

-- ---------- 7. Someone saved first: nothing is saved, and what is there now is answered ----------
-- Catches: a save from an older version overwriting a newer one (D-46).
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.update_lead(p_lead_id => pg_temp.id('reyes'), p_name => 'Someone else', p_firm_id => pg_temp.id('acme'), p_version => 1);
  PERFORM pg_temp.is((r ->> 'conflict')::boolean, true, 'a conflict');
  PERFORM pg_temp.is(r -> 'current' ->> 'name', 'Lucia Reyes', 'what is there now');
  PERFORM pg_temp.is((r ->> 'currentVersion')::int, (SELECT version FROM public.leads WHERE id = pg_temp.id('reyes')), 'its version');
  PERFORM pg_temp.is((SELECT count(*)::int FROM jsonb_array_elements(r -> 'changed') e WHERE e ->> 'field' = 'name'), 1, 'the name named as changed');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT name FROM public.leads WHERE id = pg_temp.id('reyes')), 'Lucia Reyes', 'nothing saved');
END $$;

-- ---------- 8. What is wrong with a field, or with the version, is said in words (22023) ----------
-- Catches: a save that blanks the name or stores a malformed email (the same rules as making a lead, lead_input_error), or one with no version or a version the
-- lead never had, which would otherwise save over anything.
DO $$
DECLARE c record; v int := (SELECT version FROM public.leads WHERE id = pg_temp.id('reyes'));
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  FOR c IN SELECT * FROM (VALUES
    (format($q$SELECT public.update_lead(p_lead_id => %L, p_name => '  ', p_version => %s)$q$, pg_temp.id('reyes'), v), 'Enter a name'),
    (format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'A', p_email => 'nope', p_version => %s)$q$, pg_temp.id('reyes'), v), 'Enter an email address'),
    (format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'A', p_state => 'ZZ', p_version => %s)$q$, pg_temp.id('reyes'), v), 'Choose a state'),
    (format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'A')$q$, pg_temp.id('reyes')), 'did not say which version'),
    (format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'A', p_version => %s)$q$, pg_temp.id('reyes'), v + 5), 'a version of the lead that does not exist')
  ) AS t (stmt, words) LOOP
    PERFORM pg_temp.is(split_part(pg_temp.refusal(c.stmt), ': ', 1), '22023', c.words || ' (code)');
    PERFORM pg_temp.is(position(c.words IN pg_temp.refusal(c.stmt)) > 0, true, c.words || ' (words)');
  END LOOP;
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT name FROM public.leads WHERE id = pg_temp.id('reyes')), 'Lucia Reyes', 'nothing saved');
END $$;

-- ---------- 9. Converted, Not a fit and the bin are read, not changed (CRM-L1.1) ----------
-- Catches: Edit offered on a lead that can only be read, or a save the database takes there (only Reopen moves a Not a fit lead; a converted lead is for good).
DO $$
DECLARE c record;
BEGIN
  PERFORM pg_temp.lead('nofit', 'acme', 'acme_agent1');
  UPDATE public.leads SET status = 'not_fit', not_fit_reason = 'too_small' WHERE id = pg_temp.id('nofit');
  FOR c IN SELECT * FROM (VALUES ('nofit', 'acme_agent1', 'Reopen it to change it'), ('done', 'acme_agent1', 'was converted'), ('binned', 'acme_owner', 'Restore it to change it')) AS t (n, who, words) LOOP
    PERFORM pg_temp.as_user(c.who, 'acme-brokers');
    PERFORM pg_temp.is((public.lead_page(pg_temp.id('acme'), pg_temp.id(c.n)) ->> 'can_change')::boolean, false, c.n || ': no Edit');
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'X', p_version => (SELECT version FROM public.leads WHERE id = %L))$q$,
      pg_temp.id(c.n), pg_temp.id(c.n))), ': ', 1), '55000', c.n || ': refused (code)');
    PERFORM pg_temp.is(position(c.words IN pg_temp.refusal(format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'X', p_version => (SELECT version FROM public.leads WHERE id = %L))$q$,
      pg_temp.id(c.n), pg_temp.id(c.n)))) > 0, true, c.n || ': refused (words)');
  END LOOP;
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 10. The owner is changed in place by the level rule; left out, it stays ----------
-- Catches: a lead given to someone the caller could not then change it for, to someone who has left, or an owner cleared by a save that did not choose one.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.lead('team', 'acme', 'acme_agent2');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  r := public.update_lead(p_lead_id => pg_temp.id('team'), p_name => 'Team lead', p_version => 1);
  PERFORM pg_temp.is((r -> 'record' -> 'owner' ->> 'id')::uuid, pg_temp.id('acme_agent2'), 'no owner sent: the owner stays');
  r := public.update_lead(p_lead_id => pg_temp.id('team'), p_name => 'Team lead', p_owner_id => pg_temp.id('acme_west'), p_version => (r -> 'record' ->> 'version')::int);
  PERFORM pg_temp.is((r -> 'record' -> 'owner' ->> 'id')::uuid, pg_temp.id('acme_west'), 'a lead gives it to someone on a team under theirs');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'X', p_owner_id => %L, p_version => %s)$q$,
    pg_temp.id('team'), pg_temp.id('acme_agent1'), (r -> 'record' ->> 'version')::int)), ':', 1), '42501', 'not to someone on no team of theirs');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'X', p_owner_id => %L, p_version => %s)$q$,
    pg_temp.id('team'), pg_temp.id('acme_gone'), (r -> 'record' ->> 'version')::int)), ':', 1), '22023', 'not to someone who has left');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 11. A save that changes nothing leaves a New lead New ----------
-- Catches: Working set by opening Edit and pressing Save (D-808: the first saved change to its fields, not a save).
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.lead('quiet', 'acme', 'acme_agent1', 'Quiet Co');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.update_lead(p_lead_id => pg_temp.id('quiet'), p_name => 'Person quiet ', p_business => 'Quiet Co', p_version => 1);
  PERFORM pg_temp.is(r -> 'record' ->> 'status', 'new', 'nothing changed: still New');
  r := public.update_lead(p_lead_id => pg_temp.id('quiet'), p_name => 'Person quiet', p_business => 'Quiet Co', p_owner_id => pg_temp.id('acme_agent1'),
    p_version => (r -> 'record' ->> 'version')::int);
  PERFORM pg_temp.is(r -> 'record' ->> 'status', 'new', 'the same owner chosen: still New');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 12. Not a fit, with a reason from the short list (CRM-L1.3) ----------
-- Catches: Not a fit without a reason or with one off the list, set by someone who may not change the lead, or on a converted lead.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.lead('small', 'acme', 'acme_agent1');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.mark_lead_not_fit(%L, NULL)$q$, pg_temp.id('small'))), ':', 1), '22023', 'no reason');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.mark_lead_not_fit(%L, 'too_big')$q$, pg_temp.id('small'))), ':', 1), '22023', 'a reason off the list');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.mark_lead_not_fit(%L, 'too_small')$q$, pg_temp.id('done'))), ':', 1), '55000', 'a converted lead');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.mark_lead_not_fit(%L, 'too_small')$q$, pg_temp.id('small'))), ':', 1), 'PT404', 'another agent''s lead');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.mark_lead_not_fit(pg_temp.id('small'), 'too_small');
  PERFORM pg_temp.is(r ->> 'status', 'not_fit', 'Not a fit');
  PERFORM pg_temp.is(r ->> 'not_fit_reason', 'too_small', 'with its reason');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.record_history WHERE record_key = pg_temp.id('small')::text AND field = 'status'), 1, 'one history entry for the status');
END $$;

-- ---------- 13. Reopen: a Not a fit lead is Working again, its reason cleared (D-1652) ----------
-- Catches: Reopen leaving the reason, reopening a lead that is not Not a fit, or reopening by someone who may not change it.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.reopen_lead(%L)$q$, pg_temp.id('quiet'))), ':', 1), '55000', 'a lead that is not Not a fit');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.reopen_lead(%L)$q$, pg_temp.id('done'))), ':', 1), '55000', 'a converted lead');
  PERFORM pg_temp.as_user('zenith_agent2', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.reopen_lead(%L)$q$, pg_temp.id('zl'))), ':', 1), '42501', 'one the caller may only read');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.reopen_lead(pg_temp.id('small'));
  PERFORM pg_temp.is(r ->> 'status', 'working', 'Working again');
  PERFORM pg_temp.is(r ->> 'not_fit_reason', NULL, 'its reason cleared');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 14. A call logged on a New lead makes it Working; a note or a task does not (D-807, D-808) ----------
-- Catches: a lead's call not logged on the lead, or the status left New after the first call, or moved by a note.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.lead('calls', 'acme', 'acme_agent1');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.log_lead_activity(p_kind => 'note', p_lead_id => pg_temp.id('calls'), p_body => 'Owner is away until March');
  PERFORM pg_temp.is(r -> 'activity' ->> 'body', 'Owner is away until March', 'the note');
  PERFORM pg_temp.is(public.lead_page(pg_temp.id('acme'), pg_temp.id('calls')) -> 'lead' ->> 'status', 'new', 'a note leaves it New');
  r := public.log_lead_activity(p_kind => 'task', p_lead_id => pg_temp.id('calls'), p_title => 'Call in March', p_due_on => DATE '2027-03-01');
  PERFORM pg_temp.is(r -> 'activity' -> 'assignee' ->> 'id', pg_temp.id('acme_agent1')::text, 'a task is for the person logging it');
  PERFORM pg_temp.is(public.lead_page(pg_temp.id('acme'), pg_temp.id('calls')) -> 'lead' ->> 'status', 'new', 'a task leaves it New');
  r := public.log_lead_activity(p_kind => 'call', p_lead_id => pg_temp.id('calls'), p_outcome => 'left_message', p_follow_up_title => 'Try again', p_follow_up_due_on => DATE '2027-01-05');
  PERFORM pg_temp.is(r -> 'activity' ->> 'outcome', 'left_message', 'the call');
  PERFORM pg_temp.is(r -> 'follow_up' ->> 'title', 'Try again', 'with its follow-up task');
  PERFORM pg_temp.is(public.lead_page(pg_temp.id('acme'), pg_temp.id('calls')) -> 'lead' ->> 'status', 'working', 'the first call makes it Working');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.activities WHERE lead_id = pg_temp.id('calls') AND account_id IS NULL), 4, 'all four on the lead');
END $$;

-- ---------- 15. Nothing is logged on a lead the caller may not see, or on one that is read, not changed ----------
-- Catches: a call logged on another agent's lead, or on a Converted, Not a fit or binned lead (CRM-L1.1: read, not changed).
DO $$
DECLARE before int := (SELECT count(*) FROM public.activities);
BEGIN
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.log_lead_activity(p_kind => 'note', p_lead_id => %L, p_body => 'x')$q$, pg_temp.id('calls'))), ':', 1),
    'PT404', 'another agent''s lead');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.log_lead_activity(p_kind => 'note', p_lead_id => %L, p_body => 'x')$q$, pg_temp.id('nofit'))), ':', 1),
    '55000', 'a Not a fit lead');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.log_lead_activity(p_kind => 'call', p_lead_id => %L, p_outcome => 'spoke')$q$, pg_temp.id('done'))), ':', 1),
    '55000', 'a converted lead');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.log_lead_activity(p_kind => 'note', p_lead_id => %L, p_body => 'x')$q$, pg_temp.id('binned'))), ':', 1),
    '55000', 'a lead in the bin');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.activities), before, 'nothing logged');
END $$;

-- ---------- 16. What is wrong with a call, a note or a task is said in the account's own words (22023) ----------
-- Catches: a call with no outcome, a call in the future, a task for someone outside the firm, or a follow-up on a note, taken on a lead when the account's
-- log refuses it.
DO $$
DECLARE c record;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  FOR c IN SELECT * FROM (VALUES
    ($q$SELECT public.log_lead_activity(p_kind => 'visit', p_lead_id => pg_temp.id('calls'))$q$, 'Choose a call, a note or a task'),
    ($q$SELECT public.log_lead_activity(p_kind => 'call', p_lead_id => pg_temp.id('calls'))$q$, 'Choose how the call went'),
    ($q$SELECT public.log_lead_activity(p_kind => 'call', p_lead_id => pg_temp.id('calls'), p_outcome => 'spoke', p_at => now() + interval '1 day')$q$, 'can''t be in the future'),
    ($q$SELECT public.log_lead_activity(p_kind => 'note', p_lead_id => pg_temp.id('calls'), p_body => '  ')$q$, 'Write the note'),
    ($q$SELECT public.log_lead_activity(p_kind => 'task', p_lead_id => pg_temp.id('calls'), p_title => 'T', p_due_on => DATE '2027-01-01', p_for => pg_temp.id('zenith_agent'))$q$, 'Choose someone from the firm'),
    ($q$SELECT public.log_lead_activity(p_kind => 'note', p_lead_id => pg_temp.id('calls'), p_body => 'n', p_follow_up_title => 'T')$q$, 'Only a call can add a follow-up'),
    ($q$SELECT public.log_lead_activity(p_kind => 'call', p_lead_id => pg_temp.id('calls'), p_outcome => 'spoke', p_follow_up_title => 'T')$q$, 'Choose when the follow-up task is due')
  ) AS t (stmt, words) LOOP
    PERFORM pg_temp.is(split_part(pg_temp.refusal(c.stmt), ': ', 1), '22023', c.words || ' (code)');
    PERFORM pg_temp.is(position(c.words IN pg_temp.refusal(c.stmt)) > 0, true, c.words || ' (words) ' || pg_temp.refusal(c.stmt));
  END LOOP;
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 17. The lead's calls, notes and tasks, newest first, filtered and paged ----------
-- Catches: a list in another order, one that mixes in another record's rows, a filter that does not narrow, or a list drawn for someone who may not see the lead.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.claims_of('acme_agent1');
  UPDATE public.activities SET at = at - interval '1 hour' WHERE lead_id = pg_temp.id('calls') AND kind = 'note';
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.lead_activity(pg_temp.id('acme'), pg_temp.id('calls'));
  PERFORM pg_temp.is((r ->> 'count')::int, 4, 'all four');
  PERFORM pg_temp.is(r -> 'rows' -> 3 ->> 'type', 'note', 'the oldest last');
  PERFORM pg_temp.is((SELECT bool_and((e ->> 'at') >= (r -> 'rows' -> 3 ->> 'at')) FROM jsonb_array_elements(r -> 'rows') e), true, 'newest first');
  r := public.lead_activity(pg_temp.id('acme'), pg_temp.id('calls'), 'tasks');
  PERFORM pg_temp.is((r ->> 'count')::int, 2, 'the tasks: the task and the follow-up');
  r := public.lead_activity(pg_temp.id('acme'), pg_temp.id('calls'), 'all', 1, 1);
  PERFORM pg_temp.is(jsonb_array_length(r -> 'rows'), 1, 'a page of one');
  PERFORM pg_temp.is((public.lead_activity(pg_temp.id('acme'), pg_temp.id('reyes')) ->> 'count')::int, 0, 'a lead with nothing logged');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(public.lead_activity(pg_temp.id('acme'), pg_temp.id('calls')), NULL, 'another agent''s lead');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 18. A lead's call or task is changed, its note added to and its task marked done, as an account's are ----------
-- Catches: update_activity, add_to_note and set_task_done reading only an account, so every entry on a lead's page is "not available" to change.
DO $$
DECLARE r jsonb; call_id uuid; note_id uuid; task_id uuid;
BEGIN
  SELECT id INTO call_id FROM public.activities WHERE lead_id = pg_temp.id('calls') AND kind = 'call';
  SELECT id INTO note_id FROM public.activities WHERE lead_id = pg_temp.id('calls') AND kind = 'note';
  SELECT id INTO task_id FROM public.activities WHERE lead_id = pg_temp.id('calls') AND kind = 'task' AND title = 'Call in March';
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.update_activity(p_activity_id => call_id, p_outcome => 'spoke', p_body => 'Spoke to the owner');
  PERFORM pg_temp.is(r ->> 'body', 'Spoke to the owner', 'a lead''s call changed');
  r := public.add_to_note(note_id, 'Back in February after all');
  PERFORM pg_temp.is(r -> 'additions' -> 0 ->> 'text', 'Back in February after all', 'a lead''s note added to');
  r := public.set_task_done(task_id, true);
  PERFORM pg_temp.is(r ->> 'done_at' IS NOT NULL, true, 'a lead''s task done');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 19. Nothing on a lead that is read, not changed, is changed (CRM-L1.1) ----------
-- Catches: a Not a fit lead's call edited, its task marked done or its note added to, or its rows offered as editable.
DO $$
DECLARE r jsonb; call_id uuid; task_id uuid; note_id uuid;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  call_id := (public.log_lead_activity(p_kind => 'call', p_lead_id => pg_temp.id('small'), p_outcome => 'spoke') -> 'activity' ->> 'id')::uuid;
  task_id := (public.log_lead_activity(p_kind => 'task', p_lead_id => pg_temp.id('small'), p_title => 'T', p_due_on => DATE '2027-01-01') -> 'activity' ->> 'id')::uuid;
  note_id := (public.log_lead_activity(p_kind => 'note', p_lead_id => pg_temp.id('small'), p_body => 'N') -> 'activity' ->> 'id')::uuid;
  PERFORM public.mark_lead_not_fit(pg_temp.id('small'), 'not_interested');
  r := public.lead_activity(pg_temp.id('acme'), pg_temp.id('small'));
  PERFORM pg_temp.is((SELECT bool_or((e ->> 'can_edit')::boolean) FROM jsonb_array_elements(r -> 'rows') e), false, 'no row offered as editable');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.update_activity(p_activity_id => %L, p_outcome => 'spoke', p_body => 'x')$q$, call_id)), ':', 1), '55000', 'a call');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.set_task_done(%L, true)$q$, task_id)), ':', 1), '55000', 'a task done');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.add_to_note(%L, 'more')$q$, note_id)), ':', 1), '55000', 'a note added to');
  PERFORM public.reopen_lead(pg_temp.id('small'));
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 20. What the log form offers on a lead: the firm's people a task can be for, and no contacts or opportunities ----------
-- Catches: the log form on a lead with no one to give a task to, or offering another record's contacts.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.lead_activity_options(pg_temp.id('acme'), pg_temp.id('calls'));
  PERFORM pg_temp.is(r -> 'contacts', '[]'::jsonb, 'no contacts');
  PERFORM pg_temp.is(r -> 'opportunities', '[]'::jsonb, 'no opportunities');
  PERFORM pg_temp.is((SELECT count(*)::int FROM jsonb_array_elements(r -> 'people') e WHERE e ->> 'id' = pg_temp.id('acme_agent2')::text), 1, 'the firm''s people');
  PERFORM pg_temp.is((SELECT count(*)::int FROM jsonb_array_elements(r -> 'people') e WHERE e ->> 'id' = pg_temp.id('acme_removed')::text), 0, 'not someone who has left');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(public.lead_activity_options(pg_temp.id('acme'), pg_temp.id('calls')), NULL, 'nothing for a lead the caller may not see');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- Z. A Nevermore support session and a closing firm read and change nothing (ADR 0023, ADR 0024) ----------
-- Catches: a write of the page that skips the one write guard (assert_firm_writable). Last: the firm is left closing.
DO $$
DECLARE v int := (SELECT version FROM public.leads WHERE id = pg_temp.id('reyes'));
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.start_support_session(pg_temp.id('acme'), 'Customer asked for help with a lead');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(public.lead_page(pg_temp.id('acme'), pg_temp.id('reyes')) -> 'lead' ->> 'name', 'Lucia Reyes', 'support reads the page');
  PERFORM pg_temp.is((public.lead_page(pg_temp.id('acme'), pg_temp.id('reyes')) ->> 'can_change')::boolean, false, 'and may not change it');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'X', p_firm_id => %L, p_version => %s)$q$,
    pg_temp.id('reyes'), pg_temp.id('acme'), v)), ':', 1), 'PT423', 'support saves nothing');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.log_lead_activity(p_kind => 'note', p_lead_id => %L, p_body => 'x', p_firm_id => %L)$q$,
    pg_temp.id('reyes'), pg_temp.id('acme'))), ':', 1), 'PT423', 'support logs nothing');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.mark_lead_not_fit(%L, 'other', %L)$q$, pg_temp.id('reyes'), pg_temp.id('acme'))), ':', 1),
    'PT423', 'support marks nothing Not a fit');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.reopen_lead(%L, %L)$q$, pg_temp.id('nofit'), pg_temp.id('acme'))), ':', 1),
    'PT423', 'support reopens nothing');
  PERFORM pg_temp.as_owner();
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.update_lead(p_lead_id => %L, p_name => 'X', p_version => %s)$q$, pg_temp.id('reyes'), v)), ':', 1),
    'PT423', 'a closing firm saves nothing');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.log_lead_activity(p_kind => 'note', p_lead_id => %L, p_body => 'x')$q$, pg_temp.id('reyes'))), ':', 1),
    'PT423', 'a closing firm logs nothing');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT version FROM public.leads WHERE id = pg_temp.id('reyes')), v, 'nothing was saved');
END $$;

SELECT 'lead_page: all passed';
