-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh leads_query
-- The leads table's query (story CRM-L1.1a, slice 8.3, #190; docs/BROKER_CRM_BUILD.md D-806, D-809, D-814; 20261121110000_leads_table_query.sql).
-- leads_list and leads_view_counts: the leads a person may see, one page at a time, searched, filtered and sorted; the bin left out. Two firms: Acme sees by
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
\i supabase/migrations/20261121090000_leads.sql
\i supabase/migrations/20261121100000_create_lead.sql
\i supabase/migrations/20261121110000_leads_table_query.sql
\i supabase/migrations/20261122090000_conversations.sql
\i supabase/migrations/20261122100000_peo_authorizations.sql
\i supabase/migrations/20261122100500_conversations_closing.sql
\i supabase/migrations/20261122110000_bundle_links.sql
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

SELECT pg_temp.lead('a1', 'acme', 'acme_agent1', 'Reyes Bakery');
UPDATE public.leads SET email = 'lucia@reyes.example', phone = '503-555-0101' WHERE id = pg_temp.id('a1');
SELECT pg_temp.lead('a2', 'acme', 'acme_agent1', 'Kim Dental');
SELECT pg_temp.lead('b1', 'acme', 'acme_agent2', 'Other Co');
SELECT pg_temp.lead('bin', 'acme', 'acme_agent1', 'Binned Co');
UPDATE public.leads SET deleted_at = now() WHERE id = pg_temp.id('bin');
SELECT pg_temp.lead('z1', 'zenith', 'zenith_agent', 'Zenith Co');

-- ---------- 1. A page of the leads the caller may see, the bin left out, each with its columns ----------
DO $$
DECLARE p jsonb; r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  p := public.leads_list(NULL);
  PERFORM pg_temp.is((p ->> 'total')::int, 2, 'an agent reads their own leads, and none in the bin');
  PERFORM pg_temp.is((p ->> 'page_size')::int, 50, 'fifty a page');
  SELECT e INTO r FROM jsonb_array_elements(p -> 'rows') e WHERE e ->> 'id' = pg_temp.id('a1')::text;
  PERFORM pg_temp.is(r ->> 'business', 'Reyes Bakery', 'its business');
  PERFORM pg_temp.is(r ->> 'email', 'lucia@reyes.example', 'its email');
  PERFORM pg_temp.is(r ->> 'status', 'new', 'its status');
  PERFORM pg_temp.is(r ->> 'source', 'added_by_hand', 'its source');
  PERFORM pg_temp.is(r ->> 'owner_name', 'acme_agent1@example.test', 'its owner, by name');
  PERFORM pg_temp.is(r ->> 'last_activity_at' IS NOT NULL, true, 'its last activity: when it was made, with nothing logged (D-814)');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((public.leads_list(NULL) ->> 'total')::int, 3, 'an owner reads every lead of the firm but the bin''s');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 2. Search: every word in the name, business, email or phone, ignoring case ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, p_search => 'reyes')), 'Person a1', 'a word of the business');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, p_search => 'LUCIA@')), 'Person a1', 'part of the email, any case');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, p_search => '555-0101')), 'Person a1', 'part of the phone');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, p_search => 'person a2')), 'Person a2', 'the name, every word');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, p_search => 'reyes dental')), '', 'every word must match somewhere');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, p_search => 'Other')), '', 'and only among the leads the caller may see');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 3. Filters: owner, source, status, state, employees, created, last activity ----------
UPDATE public.leads SET status = 'working', state = 'OR', employees = 40 WHERE id = pg_temp.id('a2');
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, '[{"field":"status","op":"any_of","value":["working"]}]')), 'Person a2', 'status is Working');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, '[{"field":"state","op":"any_of","value":["OR"]}]')), 'Person a2', 'state is OR');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, '[{"field":"employees","op":"more_than","value":10}]')), 'Person a2', 'employees over 10');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, format('[{"field":"owner","op":"any_of","value":["%s"]}]', pg_temp.id('acme_agent2'))::jsonb)), 'Person b1', 'owner is a named person');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, '[{"field":"source","op":"any_of","value":["import"]}]')), '', 'source is Import');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT public.leads_list(NULL, '[{"field":"status","op":"any_of","value":["qualified"]}]')$q$), ':', 1), '22023', 'a status not on the list');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT public.leads_list(NULL, '[{"field":"deleted_at","op":"is_empty"}]')$q$), ':', 1), '22023', 'a field the table does not have');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((public.leads_list(NULL, '[{"field":"owner","op":"me"}]') ->> 'total')::int, 2, 'owner is me');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 4. Sort: any field but email and phone; blanks last; by default last activity, newest first (D-814) ----------
-- A note on the lead made first, so only its note can put it first.
INSERT INTO public.activities (firm_id, lead_id, kind, body, at) VALUES (pg_temp.id('acme'), pg_temp.id('a1'), 'note', 'Called', now() + interval '1 hour');
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(split_part(pg_temp.names(public.leads_list(NULL)), ',', 1), 'Person a1', 'the lead with the newest call, note or task comes first');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, p_sort => 'business', p_direction => 'asc')), 'Person a2,Person b1,Person a1', 'by business, A to Z');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, p_sort => 'business', p_direction => 'desc')), 'Person a1,Person b1,Person a2', 'Z to A');
  PERFORM pg_temp.is(split_part(pg_temp.names(public.leads_list(NULL, p_sort => 'employees', p_direction => 'desc')), ',', 1), 'Person a2', 'by employees, most first');
  PERFORM pg_temp.is(split_part(pg_temp.names(public.leads_list(NULL, p_sort => 'employees', p_direction => 'asc')), ',', 1), 'Person a2', 'and fewest first: the leads with no number come last both ways');
  PERFORM pg_temp.is(pg_temp.names(public.leads_list(NULL, p_sort => 'status', p_direction => 'desc')), 'Person a2,Person a1,Person b1', 'a status by its place in the list, then the newest activity');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT public.leads_list(NULL, p_sort => 'email')$q$), ':', 1), '22023', 'email has no sort');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT public.leads_list(NULL, p_sort => 'name', p_direction => 'up')$q$), ':', 1), '22023', 'a direction is asc or desc');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 5. The count behind each view's tab ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((SELECT string_agg(view_name || '=' || total, ',' ORDER BY view_name) FROM public.leads_view_counts(NULL,
    '[{"name":"Open","filters":[{"field":"status","op":"any_of","value":["new","working"]}]},{"name":"Working","filters":[{"field":"status","op":"any_of","value":["working"]}]},{"name":"Converted","filters":[{"field":"status","op":"any_of","value":["converted"]}]}]')),
    'Converted=0,Open=3,Working=1', 'each view counts what its tab would list');
  PERFORM pg_temp.is((SELECT total FROM public.leads_view_counts(NULL, '[{"name":"All","filters":[]}]', 'reyes')), 1::bigint, 'with the search');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT * FROM public.leads_view_counts(NULL, '[{"name":"Bad","filters":[{"field":"nope","op":"is_empty"}]}]')$q$), ':', 1), '22023', 'a bad filter refuses the call');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 6. One firm at a time; nobody outside it reads a lead ----------
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES ('zenith_owner', 'acme-brokers'), ('acme_removed', 'acme-brokers'), ('nobody', NULL), ('platform_admin', NULL)) AS v (who, addr) LOOP
    PERFORM pg_temp.as_user(c.who, c.addr);
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT public.leads_list(%L)$q$, pg_temp.id('acme'))), ':', 1), '42501', c.who || ' lists Acme''s leads');
    PERFORM pg_temp.is(split_part(pg_temp.refusal(format($q$SELECT * FROM public.leads_view_counts(%L, '[{"name":"All","filters":[]}]')$q$, pg_temp.id('acme'))), ':', 1), '42501', c.who || ' counts them');
  END LOOP;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT public.leads_list(NULL)$q$), ':', 1), '42501', 'a guest');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 7. The list shows exactly what row security shows, person by person ----------
DO $$
DECLARE who text; listed text; policy text;
BEGIN
  FOREACH who IN ARRAY ARRAY['acme_owner', 'acme_lead', 'acme_lead2', 'acme_agent1', 'acme_agent2', 'acme_west', 'zenith_agent', 'zenith_owner'] LOOP
    PERFORM pg_temp.as_user(who, CASE WHEN who LIKE 'acme%' THEN 'acme-brokers' ELSE 'zenith-benefits' END);
    SELECT COALESCE(string_agg(e ->> 'id', ',' ORDER BY e ->> 'id'), '') INTO listed FROM jsonb_array_elements(public.leads_list(NULL) -> 'rows') e;
    SELECT COALESCE(string_agg(id::text, ',' ORDER BY id::text), '') INTO policy FROM public.leads WHERE deleted_at IS NULL;
    PERFORM pg_temp.is(listed, policy, who || ': the list and row security agree');
  END LOOP;
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 8. The leads table keeps saved views and column choices like the others ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT 'leads'::public.workspace_table$q$), 'rows:1', 'leads is a table the workspace keeps settings for');
END $$;

-- ---------- 9. A lead whose owner has left reads as owned by no one ----------
SELECT pg_temp.lead('left', 'acme', 'acme_gone', 'Left Co');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  SELECT e INTO r FROM jsonb_array_elements(public.leads_list(NULL) -> 'rows') e WHERE e ->> 'id' = pg_temp.id('left')::text;
  PERFORM pg_temp.is(r ->> 'owner', NULL, 'no owner');
  PERFORM pg_temp.is(r ->> 'owner_name', NULL, 'and no owner''s name');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 10. The menu counts the open leads the caller may see (CRM-S1.1) ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  -- Theirs: a1 (New) and a2 (Working); the binned one is not counted.
  PERFORM pg_temp.is((public.menu_counts() ->> 'leads')::int, 2, 'an agent''s open leads');
  PERFORM pg_temp.as_owner();
  UPDATE public.leads SET status = 'not_fit', not_fit_reason = 'too_small' WHERE id = pg_temp.id('a2');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((public.menu_counts() ->> 'leads')::int, 1, 'Not a fit is not open');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((public.menu_counts() ->> 'leads')::int, 3, 'an owner counts every open lead of the firm');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is((public.menu_counts() ->> 'leads')::int, 1, 'and only their own firm''s');
  PERFORM pg_temp.is(public.menu_counts() ? 'quotes' AND public.menu_counts() ? 'inbox', true, 'the other counts are still there');
  PERFORM pg_temp.as_owner();
END $$;

SELECT 'leads_query: all passed';
