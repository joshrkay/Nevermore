-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh leads_bulk
-- Bulk actions on leads with Undo, the bin with Restore, the 30-day nightly removal, and export (story CRM-L1.1b, slice 8.4; docs/BROKER_CRM_BUILD.md D-806,
-- D-811, D-1640 to D-1649; 20261122210000_leads_bulk_and_bin.sql). Two firms: Acme sees by level, Zenith shows everyone everything. Every migration is loaded,
-- in filename order (D-105), this story's last.
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
\i supabase/migrations/20261122210000_leads_bulk_and_bin.sql
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

-- The names on a page, in order, as the caller reads them.
CREATE FUNCTION pg_temp.names(page jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(e ->> 'name', ',' ORDER BY o), '') FROM jsonb_array_elements(page -> 'rows') WITH ORDINALITY AS x (e, o)
$$;


-- Two of Acme's agents' leads, and one of Zenith's.
SELECT pg_temp.lead('a1', 'acme', 'acme_agent1', 'Reyes Bakery');
SELECT pg_temp.lead('a2', 'acme', 'acme_agent1', 'Kim Dental');
SELECT pg_temp.lead('b1', 'acme', 'acme_agent2', 'Other Co');
SELECT pg_temp.lead('z1', 'zenith', 'zenith_agent', 'Zenith Co');

-- What a lead holds now, read as the superuser.
CREATE FUNCTION pg_temp.lead_row(n text) RETURNS public.leads LANGUAGE sql AS $$ SELECT * FROM public.leads WHERE id = pg_temp.id(n) $$;

-- ---------- 1. Delete moves leads to the bin ----------
-- Catches: a bulk delete that does not put the lead in the bin, or answers no change to undo.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('a1')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'changed')::int, 1, 'one lead deleted');
  PERFORM pg_temp.is(r ->> 'change_id' IS NOT NULL, true, 'a change to undo');
  PERFORM pg_temp.is((pg_temp.lead_row('a1')).deleted_at IS NOT NULL, true, 'the lead is in the bin');
END $$;

-- Catches: a converted lead put in the bin (CRM-L1.1: a converted lead can't be deleted), or skipped without being named and why.
SELECT pg_temp.lead('conv', 'acme', 'acme_agent1', 'Converted Co');
SELECT pg_temp.account('conv_acct', 'acme', 'acme_agent1');
UPDATE public.leads SET status = 'converted', converted_at = now(), converted_account_id = pg_temp.id('conv_acct') WHERE id = pg_temp.id('conv');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('conv')::text, pg_temp.id('a2')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'changed')::int, 1, 'only the open lead deleted');
  PERFORM pg_temp.is(r #>> '{skipped,0,id}', pg_temp.id('conv')::text, 'the converted lead is named as skipped');
  PERFORM pg_temp.is(r #>> '{skipped,0,code}', 'converted', 'skipped because it is converted');
  PERFORM pg_temp.is(r #>> '{skipped,0,reason}', 'It is converted, so it can be read but not changed or deleted.', 'the reason in words');
  PERFORM pg_temp.is((pg_temp.lead_row('conv')).deleted_at, NULL::timestamptz, 'the converted lead is not in the bin');
END $$;

-- Catches (D-809, CRM-S3.7): an agent deleting a lead another agent owns. Where the agent sees it (Zenith shows everyone everything) it is skipped and named
-- with the level rule's words.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('zenith_agent2', 'zenith-benefits');
  r := public.bulk_leads_change(pg_temp.id('zenith'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('z1')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'changed')::int, 0, 'another agent''s lead is not changed');
  PERFORM pg_temp.is(r -> 'change_id', 'null'::jsonb, 'nothing to undo');
  PERFORM pg_temp.is(r #>> '{skipped,0,code}', 'level', 'skipped by the level rule');
  PERFORM pg_temp.is(r #>> '{skipped,0,reason}', 'Only the lead''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'the level rule in words');
  PERFORM pg_temp.is((pg_temp.lead_row('z1')).deleted_at, NULL::timestamptz, 'it is not in the bin');
END $$;

-- Catches (D-809, D-28): a lead the caller does not see (Acme, by level) or another firm's changed, or named to them. Counted as not available.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('b1')::text, pg_temp.id('z1')::text, 'not-an-id'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'changed')::int, 0, 'a lead the agent does not see is not changed');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'skipped'), 0, 'nor named');
  PERFORM pg_temp.is((r ->> 'unavailable')::int, 3, 'it, another firm''s and a made-up id are counted as not available');
  PERFORM pg_temp.is((pg_temp.lead_row('b1')).deleted_at, NULL::timestamptz, 'the unseen lead is not in the bin');
  -- From mutation: a lead already in the bin, named by its id, is not changed (it is put back by Restore, D-806).
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'status', '{"status":"working"}', NULL, jsonb_build_array(pg_temp.id('a1')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'unavailable')::int, 1, 'a lead in the bin is not available');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_preview(pg_temp.id('acme'), 'status', '{"status":"working"}', NULL, jsonb_build_array(pg_temp.id('a1')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'will_change')::int, 0, 'nor offered by the preview');
  PERFORM pg_temp.is((pg_temp.lead_row('a1')).status, 'new', 'and is not changed');
  PERFORM pg_temp.is((pg_temp.lead_row('z1')).deleted_at, NULL::timestamptz, 'nor the other firm''s');
END $$;

-- ---------- 2. Undo ----------
-- Catches (D-202, D-811): Undo of a delete leaving the leads in the bin. The agent who deleted them undoes it, though they no longer see them.
SELECT pg_temp.lead('u1', 'acme', 'acme_agent1', 'Undo Co');
DO $$
DECLARE r jsonb; u jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('u1')::text));
  u := public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((u ->> 'restored')::int, 1, 'one lead put back');
  PERFORM pg_temp.is((pg_temp.lead_row('u1')).deleted_at, NULL::timestamptz, 'out of the bin');
END $$;

-- Catches (D-202): someone else undoing a person's change (an owner of the same firm, who could see every lead).
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('u1')::text));
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_leads_undo(%L, %L)', r ->> 'change_id', pg_temp.id('acme'))), ':', 1), 'PT404', 'another person can''t undo it');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((pg_temp.lead_row('u1')).deleted_at IS NOT NULL, true, 'still in the bin');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
END $$;

-- Catches (D-202): an undo made twice (the second would put back what the person deleted again since).
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('u1')::text));
  PERFORM public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM split_part(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'delete', '{}', jsonb_build_array(pg_temp.id('u1')::text))), ':', 1);
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_leads_undo(%L, %L)', r ->> 'change_id', pg_temp.id('acme'))), ':', 1), 'PT409', 'undone once only');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((pg_temp.lead_row('u1')).deleted_at IS NOT NULL, true, 'the second delete stands');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
END $$;
-- The owner takes it out of the bin for the tests below.
UPDATE public.leads SET deleted_at = NULL WHERE id = pg_temp.id('u1');

-- Catches (D-202, CRM-S3.7): an undo after the ten minutes.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('u1')::text));
  PERFORM pg_temp.as_owner();
  UPDATE public.bulk_changes SET undo_until = now() - interval '1 second' WHERE id = (r ->> 'change_id')::uuid;
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_leads_undo(%L, %L)', r ->> 'change_id', pg_temp.id('acme'))), ':', 1), 'PT410', 'too late to undo');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((pg_temp.lead_row('u1')).deleted_at IS NOT NULL, true, 'still in the bin');
END $$;
UPDATE public.leads SET deleted_at = NULL WHERE id = pg_temp.id('u1');

-- Catches (D-202): an undo that overwrites what someone did since. A lead taken out of the bin and changed since is skipped and named; the undo of a delete
-- never puts it back in the bin.
DO $$
DECLARE r jsonb; u jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('u1')::text));
  PERFORM pg_temp.claims_of('acme_owner');
  UPDATE public.leads SET deleted_at = NULL, city = 'Salem' WHERE id = pg_temp.id('u1');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  u := public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((u ->> 'restored')::int, 0, 'nothing put back');
  PERFORM pg_temp.is(u #>> '{skipped,0,code}', 'changed_since', 'named as changed since');
  PERFORM pg_temp.is(u #>> '{skipped,0,name}', 'Person u1', 'by its name');
  PERFORM pg_temp.is((pg_temp.lead_row('u1')).deleted_at, NULL::timestamptz, 'it stays out of the bin');
END $$;

-- ---------- 3. The preview ----------
-- Catches (CRM-S3.7, CRM-L1.1): the dialog's words not coming from the same rules as the change, or the preview changing something. It counts what will change
-- and names what is skipped, and the leads stay as they are.
DO $$
DECLARE p jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  p := public.bulk_leads_preview(pg_temp.id('acme'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('u1')::text, pg_temp.id('conv')::text, pg_temp.id('b1')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((p ->> 'will_change')::int, 1, 'one will be deleted');
  PERFORM pg_temp.is(p #>> '{skipped,0,code}', 'converted', 'the converted one is named');
  PERFORM pg_temp.is((p ->> 'unavailable')::int, 1, 'the unseen one is counted');
  PERFORM pg_temp.is((p ->> 'selected')::int, 2, 'the selection the database counts');
  PERFORM pg_temp.is((pg_temp.lead_row('u1')).deleted_at, NULL::timestamptz, 'nothing deleted');
END $$;

-- ---------- 4. Change owner ----------
-- Catches (D-811): a bulk owner change that does not give the leads to the person chosen. A lead (role) gives their team's lead to another member.
SELECT pg_temp.lead('o1', 'acme', 'acme_agent2', 'Owner Co');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent1')), NULL, jsonb_build_array(pg_temp.id('o1')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'changed')::int, 1, 'one lead given away');
  PERFORM pg_temp.is((pg_temp.lead_row('o1')).owner_id, pg_temp.id('acme_agent1'), 'to the person chosen');
  PERFORM pg_temp.is((pg_temp.lead_row('o1')).deleted_at, NULL::timestamptz, 'and not deleted');
  PERFORM pg_temp.is(r #>> '{owner,name}', public.crm_person_name(pg_temp.id('acme_agent1')), 'the new owner named');
END $$;

-- Catches (D-202): Undo of an owner change putting back the bin instead of the owner.
DO $$
DECLARE r jsonb; u jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent2')), NULL, jsonb_build_array(pg_temp.id('o1')::text));
  u := public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((u ->> 'restored')::int, 1, 'the owner change undone');
  PERFORM pg_temp.is((pg_temp.lead_row('o1')).owner_id, pg_temp.id('acme_agent1'), 'the owner put back');
END $$;

-- Catches (D-202): an undo giving a lead back to someone who has left the firm (a lead owned by a former member is no one's to change but an owner's). It is
-- skipped and named.
SELECT pg_temp.new_user('acme_leaving');
INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('acme_leaving'), 'agent');
SELECT pg_temp.lead('o2', 'acme', 'acme_leaving', 'Leaving Co');
DO $$
DECLARE r jsonb; u jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent1')), NULL, jsonb_build_array(pg_temp.id('o2')::text));
  PERFORM pg_temp.as_owner();
  UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = pg_temp.id('acme_leaving');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  u := public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(u #>> '{skipped,0,code}', 'owner_left', 'named: the previous owner has left');
  PERFORM pg_temp.is((pg_temp.lead_row('o2')).owner_id, pg_temp.id('acme_agent1'), 'it keeps its new owner');
END $$;

-- Catches (CRM-S3.7): what a change asks for reaching the leads unchecked. Each is refused in words (22023), nothing changed.
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'owner', '{"owner_id":"x"}', jsonb_build_array(pg_temp.id('o1')::text))),
    '22023: Choose who will own these leads.', 'an owner that is not a person');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'archive', '{}', jsonb_build_array(pg_temp.id('o1')::text))),
    '22023: Choose what to change: the owner, the status, Not a fit, a field, a label or deleting.', 'an action leads do not have');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'delete', '{"x":1}', jsonb_build_array(pg_temp.id('o1')::text))),
    '22023: That change does not take "x".', 'a key the change does not take');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 5. Change status, Not a fit ----------
-- Catches (D-811, D-808): Change status not setting New or Working, or setting what only converting or Not a fit sets.
SELECT pg_temp.lead('s1', 'acme', 'acme_agent1', 'Status Co');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'status', '{"status":"working"}', NULL, jsonb_build_array(pg_temp.id('s1')::text));
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'status', '{"status":"converted"}', jsonb_build_array(pg_temp.id('s1')::text))), ':', 1),
    '22023', 'Converted is set only by converting');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'changed')::int, 1, 'one lead set');
  PERFORM pg_temp.is((pg_temp.lead_row('s1')).status, 'working', 'it is Working');
END $$;

-- Catches (D-202): Undo of a status change not putting the status back.
DO $$
DECLARE r jsonb; u jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'status', '{"status":"new"}', NULL, jsonb_build_array(pg_temp.id('s1')::text));
  u := public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((u ->> 'restored')::int, 1, 'the status change undone');
  PERFORM pg_temp.is((pg_temp.lead_row('s1')).status, 'working', 'Working again');
END $$;

-- Catches (D-811, CRM-L1.3): Not a fit without its one reason from the short list, or not set. Undo puts the status back and clears the reason.
SELECT pg_temp.lead('n1', 'acme', 'acme_agent1', 'Too Small Co');
DO $$
DECLARE r jsonb; u jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'not_fit', '{"reason":"bored"}', jsonb_build_array(pg_temp.id('n1')::text))),
    '22023: Choose why they are not a fit: too small, wrong industry, not interested, bad contact details or other.', 'a reason off the list');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'not_fit', '{"reason":"too_small"}', NULL, jsonb_build_array(pg_temp.id('n1')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((pg_temp.lead_row('n1')).status, 'not_fit', 'it is Not a fit');
  PERFORM pg_temp.is((pg_temp.lead_row('n1')).not_fit_reason, 'too_small', 'for the reason given');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  u := public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((pg_temp.lead_row('n1')).status, 'new', 'New again after Undo');
  PERFORM pg_temp.is((pg_temp.lead_row('n1')).not_fit_reason, NULL::text, 'with no reason');
END $$;

-- Catches (CRM-L1.1): a Not a fit lead changed. It can be read but not changed, except that it can be reopened (Change status) or deleted.
SELECT pg_temp.lead('n2', 'acme', 'acme_agent1', 'Wrong Co');
UPDATE public.leads SET status = 'not_fit', not_fit_reason = 'wrong_industry' WHERE id = pg_temp.id('n2');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent3')), NULL, jsonb_build_array(pg_temp.id('n2')::text));
  PERFORM pg_temp.is(r #>> '{skipped,0,code}', 'not_fit', 'skipped: it is Not a fit');
  PERFORM pg_temp.is(r #>> '{skipped,0,reason}', 'It is Not a fit, so it can be read but not changed. Reopen it first.', 'in words');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'not_fit', '{"reason":"other"}', NULL, jsonb_build_array(pg_temp.id('n2')::text));
  PERFORM pg_temp.is(r #>> '{skipped,0,code}', 'not_fit', 'its reason is not changed in bulk either');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'status', '{"status":"working"}', NULL, jsonb_build_array(pg_temp.id('n2')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((pg_temp.lead_row('n2')).owner_id, pg_temp.id('acme_agent1'), 'its owner did not change');
  PERFORM pg_temp.is((pg_temp.lead_row('n2')).status, 'working', 'reopened as Working');
  PERFORM pg_temp.is((pg_temp.lead_row('n2')).not_fit_reason, NULL::text, 'its reason cleared');
END $$;

-- ---------- 6. Set a field ----------
-- Catches (CRM-S3.7, D-811): Set a field not setting an optional field, offering the name, the status or the source, or writing a value the lead's own rules
-- refuse. A blank value clears the field.
SELECT pg_temp.lead('f1', 'acme', 'acme_agent1', 'Field Co');
UPDATE public.leads SET title = 'Owner' WHERE id = pg_temp.id('f1');
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.bulk_leads_change(pg_temp.id('acme'), 'field', '{"field":"city","value":"  Bend "}', NULL, jsonb_build_array(pg_temp.id('f1')::text));
  PERFORM public.bulk_leads_change(pg_temp.id('acme'), 'field', '{"field":"title","value":""}', NULL, jsonb_build_array(pg_temp.id('f1')::text));
  PERFORM public.bulk_leads_change(pg_temp.id('acme'), 'field', '{"field":"employees","value":12}', NULL, jsonb_build_array(pg_temp.id('f1')::text));
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'field', '{"field":"name","value":"X"}', jsonb_build_array(pg_temp.id('f1')::text))),
    '22023: The name is required on every lead, so it can''t be set on many at once.', 'never the name');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'field', '{"field":"source","value":"import"}', jsonb_build_array(pg_temp.id('f1')::text))), ':', 1),
    '22023', 'never the source');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'field', '{"field":"email","value":"not an email"}', jsonb_build_array(pg_temp.id('f1')::text))),
    '22023: Enter an email address like name@example.com.', 'the lead''s own rule for an email');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((pg_temp.lead_row('f1')).city, 'Bend', 'the city set, trimmed');
  PERFORM pg_temp.is((pg_temp.lead_row('f1')).title, NULL::text, 'a blank value clears the title');
  PERFORM pg_temp.is((pg_temp.lead_row('f1')).employees, 12, 'a number set');
END $$;

-- Catches (D-202): Undo of Set a field not putting the old value back.
DO $$
DECLARE r jsonb; u jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'field', '{"field":"city","value":"Eugene"}', NULL, jsonb_build_array(pg_temp.id('f1')::text));
  u := public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((u ->> 'restored')::int, 1, 'the field change undone');
  PERFORM pg_temp.is((pg_temp.lead_row('f1')).city, 'Bend', 'the old city back');
END $$;

-- ---------- 7. Labels ----------
-- Catches (D-805, D-811, CRM-S3.7): a label not put on the leads, a second word made for one the firm already has (case aside), or no history entry for it.
SELECT pg_temp.lead('lb1', 'acme', 'acme_agent1', 'Label Co');
INSERT INTO public.labels (firm_id, name) VALUES (pg_temp.id('acme'), 'Hot');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'label_add', '{"name":"hot"}', NULL, jsonb_build_array(pg_temp.id('lb1')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'changed')::int, 1, 'one lead labelled');
  PERFORM pg_temp.is(r ->> 'label', 'Hot', 'with the firm''s own spelling');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.lead_labels ll JOIN public.labels l ON l.id = ll.label_id WHERE ll.lead_id = pg_temp.id('lb1') AND l.name = 'Hot'), 1, 'the label is on it');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.labels WHERE firm_id = pg_temp.id('acme')), 1, 'no second word made');
  PERFORM pg_temp.is((SELECT h.new_value FROM public.record_history h WHERE h.table_name = 'leads' AND h.record_key = pg_temp.id('lb1')::text AND h.field = 'labels'),
    '["Hot"]'::jsonb, 'one history entry: the labels after');
END $$;

-- Catches (D-811): taking a label off that is not taken off, or one the firm does not have accepted as if it were.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_leads_preview(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'label_remove', '{"name":"Cold"}', jsonb_build_array(pg_temp.id('lb1')::text))),
    '22023: The firm has no label called "Cold".', 'a label the firm does not have');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'label_remove', '{"name":"HOT"}', NULL, jsonb_build_array(pg_temp.id('lb1')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'changed')::int, 1, 'one label taken off');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.lead_labels WHERE lead_id = pg_temp.id('lb1')), 0, 'the lead has no label now');
END $$;

-- Catches (D-202): Undo of a label change not putting the leads' labels back as they were.
DO $$
DECLARE r jsonb; u jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'label_add', '{"name":"Hot"}', NULL, jsonb_build_array(pg_temp.id('lb1')::text));
  u := public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM pg_temp.is((u ->> 'restored')::int, 1, 'adding undone');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.lead_labels WHERE lead_id = pg_temp.id('lb1')), 0, 'the label is off again');
  INSERT INTO public.lead_labels (firm_id, lead_id, label_id) SELECT firm_id, pg_temp.id('lb1'), id FROM public.labels WHERE firm_id = pg_temp.id('acme') AND name = 'Hot';
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'label_remove', '{"name":"Hot"}', NULL, jsonb_build_array(pg_temp.id('lb1')::text));
  u := public.bulk_leads_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.lead_labels WHERE lead_id = pg_temp.id('lb1')), 1, 'the label is back on');
END $$;

-- Catches (D-805: one label list for accounts and leads): undoing an accounts' change that made a word taking that word off the leads that carry it too.
SELECT pg_temp.account('lbacct', 'acme', 'acme_agent1');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_accounts_change(pg_temp.id('acme'), 'label_add', '{"name":"Shared word"}', NULL, jsonb_build_array(pg_temp.id('lbacct')::text));
  PERFORM public.bulk_leads_change(pg_temp.id('acme'), 'label_add', '{"name":"Shared word"}', NULL, jsonb_build_array(pg_temp.id('lb1')::text));
  PERFORM public.bulk_accounts_undo((r ->> 'change_id')::uuid, pg_temp.id('acme'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.labels WHERE firm_id = pg_temp.id('acme') AND name = 'Shared word'), 1, 'the word stays in the firm''s list');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.lead_labels ll JOIN public.labels l ON l.id = ll.label_id WHERE ll.lead_id = pg_temp.id('lb1') AND l.name = 'Shared word'), 1,
    'the lead keeps it');
END $$;

-- ---------- 8. The selection: all that match, and the most one change takes ----------
-- Catches (CRM-S3.6, D-44): "Select all N that match" changing leads the filters and search do not match, or ones the person does not see.
SELECT pg_temp.lead('m1', 'acme', 'acme_agent1', 'Match Co');
SELECT pg_temp.lead('m2', 'acme', 'acme_agent1', 'Match Co');
SELECT pg_temp.lead('m3', 'acme', 'acme_agent2', 'Match Co');
UPDATE public.leads SET state = 'WA' WHERE id IN (pg_temp.id('m1'), pg_temp.id('m2'), pg_temp.id('m3'));
-- From mutation: a lead the search finds but the filter does not (Oregon) must stay as it is.
SELECT pg_temp.lead('m4', 'acme', 'acme_agent1', 'Match Co');
UPDATE public.leads SET state = 'OR' WHERE id = pg_temp.id('m4');
UPDATE public.leads SET employees = 200 WHERE id = pg_temp.id('m2');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'field', '{"field":"city","value":"Spokane"}',
    '{"filters":[{"field":"state","op":"any_of","value":["WA"]}],"search":"match","time_zone":"America/Los_Angeles"}', NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'selected')::int, 2, 'the two the agent sees that match');
  PERFORM pg_temp.is((SELECT string_agg(f.name, ',' ORDER BY f.name) FROM public.leads l JOIN fx f ON f.id = l.id WHERE l.city = 'Spokane'), 'm1,m2', 'only they changed');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, %L, %L)', pg_temp.id('acme'), 'delete', '{}', '{"filters":[]}', jsonb_build_array(pg_temp.id('m1')::text))),
    '22023: Choose the leads by their ids or by the table''s filters, not both.', 'ids and filters together');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, %L, NULL)', pg_temp.id('acme'), 'delete', '{}', '{"filter":[]}')), ':', 1),
    '22023', 'a filter key the table does not have never selects everything');
  PERFORM pg_temp.as_owner();
END $$;

-- Catches (CRM-S3.7): more than 1,000 leads changed in one step. The preview says so and counts nothing else; the change is refused in words, nothing done.
DO $$
DECLARE p jsonb; many jsonb;
BEGIN
  many := (SELECT jsonb_agg(gen_random_uuid()::text) FROM generate_series(1, 1001));
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  p := public.bulk_leads_preview(pg_temp.id('acme'), 'delete', '{}', NULL, many);
  PERFORM pg_temp.is(p -> 'too_many', 'true'::jsonb, 'the preview says too many');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('acme'), 'delete', '{}', many)),
    'PT413: That is 1001 leads. A bulk change takes at most 1,000: narrow the selection and try again.', 'the change refused');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 9. A closing firm and Nevermore support change nothing (ADR 0023, ADR 0024) ----------
-- Catches: a bulk change, its preview or its Undo let through for a firm that is closing.
CREATE TEMP TABLE kept (k text PRIMARY KEY, v jsonb);
GRANT ALL ON kept TO authenticated;
DO $$
BEGIN
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  INSERT INTO kept VALUES ('z_delete', public.bulk_leads_change(pg_temp.id('zenith'), 'delete', '{}', NULL, jsonb_build_array(pg_temp.id('z1')::text)));
  PERFORM pg_temp.as_owner();
END $$;
INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('zenith'), pg_temp.id('zenith_owner'), now() + interval '30 days');
DO $$
DECLARE chg text := (SELECT v ->> 'change_id' FROM kept WHERE k = 'z_delete');
BEGIN
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_leads_preview(%L, %L, %L, NULL, %L)', pg_temp.id('zenith'), 'delete', '{}', jsonb_build_array(pg_temp.id('z1')::text))), ':', 1), 'PT423', 'no preview');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_leads_change(%L, %L, %L, NULL, %L)', pg_temp.id('zenith'), 'status', '{"status":"working"}', jsonb_build_array(pg_temp.id('z1')::text))), ':', 1), 'PT423', 'no change');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_leads_undo(%L, %L)', chg, pg_temp.id('zenith'))), ':', 1), 'PT423', 'no undo');
  PERFORM pg_temp.as_owner();
END $$;
DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('zenith');
UPDATE public.leads SET deleted_at = NULL WHERE id = pg_temp.id('z1');

-- ---------- 10. The bin ----------
-- Catches (D-806, CRM-L1.1): the bin shown to someone who is not an owner, or not showing an owner each lead in it with when it was deleted and the day it goes.
SELECT pg_temp.lead('bin1', 'acme', 'acme_agent2', 'Bin Co');
UPDATE public.leads SET deleted_at = '2026-11-01T10:00:00Z' WHERE id = pg_temp.id('bin1');
DO $$
DECLARE p jsonb; mine jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  p := public.leads_bin(pg_temp.id('acme'));
  SELECT e INTO mine FROM jsonb_array_elements(p -> 'rows') e WHERE e ->> 'id' = pg_temp.id('bin1')::text;
  PERFORM pg_temp.is(mine ->> 'name', 'Person bin1', 'the owner sees the deleted lead');
  PERFORM pg_temp.is(mine ->> 'removed_on', '2026-12-01', 'with the day it is removed for good');
  PERFORM pg_temp.is((mine ->> 'deleted_at')::timestamptz, '2026-11-01T10:00:00Z'::timestamptz, 'and when it was deleted');
  PERFORM pg_temp.is((SELECT count(*)::int FROM jsonb_array_elements(p -> 'rows') e WHERE e ->> 'id' = pg_temp.id('m1')::text), 0, 'a lead not in the bin is not in it');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.leads_bin(%L)', pg_temp.id('acme'))), ':', 1), '42501', 'a lead (role) does not see the bin');
  PERFORM pg_temp.as_owner();
END $$;

-- Catches (D-806, CRM-L1.1): Restore not taking a lead out of the bin, or anyone but an owner restoring. Restoring is one history entry; a lead not in the bin
-- is not counted.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.restore_leads(%L, %L)', pg_temp.id('acme'), jsonb_build_array(pg_temp.id('bin1')::text))), ':', 1), '42501',
    'a lead (role) restores nothing');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.restore_leads(pg_temp.id('acme'), jsonb_build_array(pg_temp.id('bin1')::text, pg_temp.id('m1')::text));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((r ->> 'restored')::int, 1, 'one lead restored');
  PERFORM pg_temp.is((pg_temp.lead_row('bin1')).deleted_at, NULL::timestamptz, 'out of the bin');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.record_history h WHERE h.table_name = 'leads' AND h.record_key = pg_temp.id('bin1')::text AND h.field = 'deleted_at'
    AND COALESCE(h.new_value, 'null'::jsonb) = 'null'::jsonb), 1, 'one history entry');
END $$;

-- ---------- 11. The nightly removal ----------
-- Catches (D-806): a lead removed before its 30 days in the bin, or one past them kept, or its calls, notes, tasks and history kept after it.
SELECT pg_temp.lead('old', 'acme', 'acme_agent1', 'Old Co');
SELECT pg_temp.lead('young', 'zenith', 'zenith_agent', 'Young Co');
INSERT INTO public.activities (firm_id, lead_id, kind, author_id, body) VALUES (pg_temp.id('acme'), pg_temp.id('old'), 'note', pg_temp.id('acme_agent1'), 'A note');
UPDATE public.leads SET deleted_at = now() - interval '30 days 1 minute' WHERE id = pg_temp.id('old');
UPDATE public.leads SET deleted_at = now() - interval '29 days 23 hours' WHERE id = pg_temp.id('young');
DO $$
DECLARE n integer;
BEGIN
  n := public.remove_binned_leads();
  PERFORM pg_temp.is(n, 1, 'one lead removed');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE id = pg_temp.id('old')), 0, 'the lead past 30 days is gone');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.activities WHERE lead_id = pg_temp.id('old')), 0, 'with its note');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.record_history WHERE table_name = 'leads' AND record_key = pg_temp.id('old')::text), 0, 'and its history');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.leads WHERE id = pg_temp.id('young')), 1, 'the lead short of 30 days stays in the bin');
END $$;
UPDATE public.leads SET deleted_at = NULL WHERE id = pg_temp.id('young');

-- ---------- 12. Export ----------
-- Catches (D-811, CRM-S3.8): the leads table not exportable through the one export, or an export holding a lead the person does not see or one in the bin. The
-- columns are the table's, in its words.
SELECT pg_temp.lead('x1', 'acme', 'acme_agent1', 'Export Co');
SELECT pg_temp.lead('xbin', 'acme', 'acme_agent1', 'Export Bin Co');
UPDATE public.leads SET deleted_at = now(), email = 'x1@example.test' WHERE id = pg_temp.id('xbin');
UPDATE public.leads SET email = 'x1@example.test', status = 'working' WHERE id = pg_temp.id('x1');
DO $$
DECLARE e jsonb; row1 jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  e := public.export_rows(pg_temp.id('acme'), 'leads', '{}', jsonb_build_array(pg_temp.id('x1')::text, pg_temp.id('xbin')::text, pg_temp.id('b1')::text));
  PERFORM pg_temp.is((e ->> 'count')::int, 1, 'only the lead the agent sees, not in the bin');
  PERFORM pg_temp.is((e ->> 'skipped')::int, 2, 'the others skipped');
  row1 := e #> '{rows,0}';
  PERFORM pg_temp.is(row1 ->> 'name', 'Person x1', 'its name');
  PERFORM pg_temp.is(row1 ->> 'status', 'Working', 'the status in words');
  PERFORM pg_temp.is(row1 ->> 'source', 'Added by hand', 'the source in words');
  -- A whole table asks for a sign-in within 12 hours: the token says when.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id('acme_agent1'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_agent1@example.test',
    'amr', jsonb_build_array(jsonb_build_object('method', 'oauth', 'timestamp', floor(extract(epoch FROM now()))::bigint)))::text, false);
  e := public.export_rows(pg_temp.id('acme'), 'leads', '{"filters":[],"search":"x1@example.test"}', NULL);
  PERFORM pg_temp.is((e ->> 'count')::int, 1, 'all that match: the bin left out');
  PERFORM pg_temp.as_owner();
END $$;
