-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh spot_a_duplicate
-- Spotting a duplicate while creating an account or adding a contact (story CRM-S4.2; docs/BROKER_CRM_BUILD.md D-193, D-209, D-219, D-226, D-238, D-600 to D-604;
-- 20261121090000_spot_a_duplicate.sql). duplicate_account_check and duplicate_contact_check: the match is the chain's own rule (D-193), a record the person may see is shown
-- in full, one they may not is only a mask that says one exists and whom to ask, the firm is the caller's own, and nothing is written. Two firms: Acme sees by level,
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
\i supabase/migrations/20261121090000_spot_a_duplicate.sql
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


-- ---------- helpers ----------
-- An account with a state and an archived flag, placed by the superuser; the earliest made is the earliest.
CREATE FUNCTION pg_temp.acct(n text, firm text, p_owner text, nm text, site text DEFAULT NULL, st text DEFAULT NULL, archived boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.accounts (source, firm_id, owner_id, name, website, state, archived_at, created_at)
  VALUES ('added_by_hand', pg_temp.id(firm), pg_temp.id(p_owner), nm, site, st, CASE WHEN archived THEN now() END, clock_timestamp()) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

-- The account check as a person, answering the function's jsonb.
CREATE FUNCTION pg_temp.chk(who text, nm text, site text DEFAULT NULL, st text DEFAULT NULL, firm text DEFAULT 'acme') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who);
  r := public.duplicate_account_check(CASE WHEN firm IS NULL THEN NULL ELSE pg_temp.id(firm) END, nm, site, st);
  RESET ROLE;
  RETURN r;
EXCEPTION WHEN OTHERS THEN RESET ROLE; RAISE;
END $$;

CREATE FUNCTION pg_temp.cchk(who text, email text, firm text DEFAULT 'acme') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user(who);
  r := public.duplicate_contact_check(CASE WHEN firm IS NULL THEN NULL ELSE pg_temp.id(firm) END, email);
  RESET ROLE;
  RETURN r;
EXCEPTION WHEN OTHERS THEN RESET ROLE; RAISE;
END $$;

-- The names of the visible matches, in order, and how many are masks.
CREATE FUNCTION pg_temp.names(j jsonb) RETURNS text[] LANGUAGE sql AS $$ SELECT COALESCE(array_agg(x.m ->> 'name' ORDER BY x.o), '{}') FROM jsonb_array_elements(j -> 'matches') WITH ORDINALITY x (m, o) WHERE (x.m ->> 'visible')::boolean $$;
CREATE FUNCTION pg_temp.masks(j jsonb) RETURNS bigint LANGUAGE sql AS $$ SELECT count(*) FROM jsonb_array_elements(j -> 'matches') m WHERE NOT (m ->> 'visible')::boolean $$;
-- The SQLSTATE a statement raised, or 'ok'.
CREATE FUNCTION pg_temp.refused(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  EXECUTE stmt;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE; RETURN s;
END $$;

-- ---------- fixtures ----------
-- Acme: agent1 owns Harbor Dental LLC (harbordental.example, OR) with a contact; agent2 (Sales team) owns Cedar Dental (cedar, WA); an account with no owner, one owned
-- by a person who has left, one archived; agent3 owns two more with the same website. Zenith: Harbor Dental LLC too (another firm's, never matched).
DO $$
BEGIN
  PERFORM pg_temp.acct('harbor', 'acme', 'acme_agent1', 'Harbor Dental LLC', 'https://www.HarborDental.example/about', 'OR');
  PERFORM pg_temp.contact('harbor_c', 'harbor', 'acme_agent1', 'Pat.Harbor@Example.test');
  PERFORM pg_temp.acct('cedar', 'acme', 'acme_agent2', 'Cedar Dental', 'cedardental.example', 'WA');
  PERFORM pg_temp.contact('cedar_c', 'cedar', 'acme_agent2', 'sam@cedardental.example');
  PERFORM pg_temp.acct('unowned', 'acme', NULL, 'Unowned Bakery Inc.', 'unownedbakery.example', 'ID');
  PERFORM pg_temp.contact('unowned_c', 'unowned', NULL, 'baker@unownedbakery.example');
  PERFORM pg_temp.acct('left', 'acme', 'acme_removed', 'Leftover Bikes', 'leftoverbikes.example', 'MT');
  PERFORM pg_temp.acct('old', 'acme', 'acme_agent1', 'Oldtown Garage', 'oldtowngarage.example', 'OR', true);
  PERFORM pg_temp.acct('twin1', 'acme', 'acme_agent3', 'Twin Pines Co', 'twinpines.example', 'WA');
  PERFORM pg_temp.acct('twin2', 'acme', 'acme_agent3', 'Twin Pines', 'twinpines.example', 'WA');
  PERFORM pg_temp.acct('zharbor', 'zenith', 'zenith_agent', 'Harbor Dental LLC', 'harbordental.example', 'OR');
  PERFORM pg_temp.contact('zharbor_c', 'zharbor', 'zenith_agent', 'pat.harbor@example.test');
END $$;

-- ---------- the rule is the chain's ----------
-- Break caught: the form warns by a rule of its own (a likeness, a prefix, a free-mail domain) instead of D-193, or the chain and the form disagree about what a duplicate is.
DO $$
DECLARE r jsonb;
BEGIN
  r := pg_temp.chk('acme_agent1', 'Something else', 'HARBORDENTAL.example');
  PERFORM pg_temp.is(pg_temp.names(r), ARRAY['Harbor Dental LLC'], 'the same web domain, in any case and with or without www., matches');
  PERFORM pg_temp.is(r -> 'matches' -> 0 -> 'reasons', '["website"]'::jsonb, 'and says it was the website');
  r := pg_temp.chk('acme_agent1', 'harbor dental', NULL, 'or');
  PERFORM pg_temp.is(pg_temp.names(r), ARRAY['Harbor Dental LLC'], 'the same name and state matches, the legal designator dropped, case and state in any case');
  PERFORM pg_temp.is(r -> 'matches' -> 0 -> 'reasons', '["name"]'::jsonb, 'and says it was the name');
  r := pg_temp.chk('acme_agent1', 'Harbor Dental, L.L.C.', 'harbordental.example', 'OR');
  PERFORM pg_temp.is(r -> 'matches' -> 0 -> 'reasons', '["name", "website"]'::jsonb, 'both reasons are kept, once');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'matches'), 1, 'and the account is named once');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.chk('acme_agent1', 'Harbor Dental LLC', NULL, NULL)), '{}'::text[], 'a name with no state matches nothing (both must have a state)');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.chk('acme_agent1', 'Harbor Dental LLC', NULL, 'WA')), '{}'::text[], 'a name in another state matches nothing');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.chk('acme_agent1', 'Harbor', NULL, 'OR')), '{}'::text[], 'never by likeness: a name that is only part of another matches nothing');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.chk('acme_agent1', 'Harbor Dental Group', NULL, 'OR')), '{}'::text[], 'nor does another last word');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.chk('acme_agent1', 'Anything', 'gmail.com', 'OR')), '{}'::text[], 'a free-mail domain says nothing');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.chk('acme_agent1', 'Anything', 'N/A')), '{}'::text[], 'text that is not a domain says nothing');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.chk('acme_agent1', 'Anything', 'https://facebook.com/harbordental')), '{}'::text[], 'a shared site says nothing');
  PERFORM pg_temp.is(pg_temp.chk('acme_agent1', NULL, NULL, NULL), '{"matches": [], "more": 0}'::jsonb, 'nothing typed finds nothing');
  PERFORM pg_temp.is(pg_temp.chk('acme_agent1', '  ', '  ', ' '), '{"matches": [], "more": 0}'::jsonb, 'blanks find nothing');
  -- The chain's own question and the form's rule agree on what is the earliest match, for every probe.
  PERFORM pg_temp.is(public.find_duplicate_account(pg_temp.id('acme'), 'harbordental.example', NULL, NULL, NULL), pg_temp.id('harbor'), 'the chain finds it by website');
  PERFORM pg_temp.is(public.find_duplicate_account(pg_temp.id('acme'), NULL, 'Harbor Dental', 'OR', NULL), pg_temp.id('harbor'), 'by name and state');
  PERFORM pg_temp.is(public.find_duplicate_account(pg_temp.id('acme'), NULL, NULL, NULL, 'PAT.harbor@example.test'), pg_temp.id('harbor'), 'by a contact''s email');
  PERFORM pg_temp.is(public.find_duplicate_account(pg_temp.id('acme'), 'twinpines.example', NULL, NULL, NULL), pg_temp.id('twin1'), 'the earliest of two');
  PERFORM pg_temp.is(public.find_duplicate_account(pg_temp.id('acme'), 'nothing.example', 'No Such Firm', 'OR', 'no@such.test'), NULL::uuid, 'and nothing when nothing matches');
  PERFORM pg_temp.is((SELECT d.account_id FROM public.duplicates_of_account(pg_temp.id('acme'), 'twinpines.example', NULL, NULL, NULL) d ORDER BY d.created_at LIMIT 1), pg_temp.id('twin1'), 'the form''s rule gives the same earliest');
  PERFORM pg_temp.is((SELECT count(*) FROM public.duplicates_of_account(pg_temp.id('acme'), 'twinpines.example', 'Twin Pines', 'WA', NULL)), 2::bigint, 'two accounts, each once');
  RAISE NOTICE 'spot_a_duplicate: the rule is the chain''s passed';
END $$;

-- ---------- what a person may see is shown in full, and nothing else is ----------
-- Break caught: a match the person may not see is named, linked, or its fields leak (its name, id, reason or owner's id), the masks tell how many there are, or a record
-- the person may see is hidden.
DO $$
DECLARE r jsonb; m jsonb;
BEGIN
  -- The owner of the account: shown in full.
  r := pg_temp.chk('acme_agent1', 'Harbor Dental LLC', NULL, 'OR');
  m := r -> 'matches' -> 0;
  PERFORM pg_temp.is(m ->> 'kind', 'account', 'an account');
  PERFORM pg_temp.is((m ->> 'visible')::boolean, true, 'seen');
  PERFORM pg_temp.is((m ->> 'id')::uuid, pg_temp.id('harbor'), 'with its id (for the link)');
  PERFORM pg_temp.is(m ->> 'name', 'Harbor Dental LLC', 'its name');
  PERFORM pg_temp.is((m -> 'owner' ->> 'id')::uuid, pg_temp.id('acme_agent1'), 'its owner');
  PERFORM pg_temp.is(m -> 'owner' ->> 'name', 'acme_agent1@example.test', 'named');
  PERFORM pg_temp.is((m ->> 'archived')::boolean, false, 'not archived');
  -- An agent who may not see it: a mask, nothing of the record.
  r := pg_temp.chk('acme_agent2', 'Harbor Dental LLC', 'harbordental.example', 'OR');
  PERFORM pg_temp.is(pg_temp.names(r), '{}'::text[], 'a colleague at agent level sees no name');
  PERFORM pg_temp.is(pg_temp.masks(r), 1::bigint, 'only that one exists');
  PERFORM pg_temp.is(r -> 'matches' -> 0, '{"kind": "account", "visible": false, "ask": {"kind": "owner", "names": ["acme_agent1@example.test"]}}'::jsonb, 'the mask says that an account exists and whom to ask, and nothing else');
  PERFORM pg_temp.is(r::text ~ (pg_temp.id('harbor')::text || '|' || pg_temp.id('acme_agent1')::text || '|Harbor|website'), false, 'no id, no name, no reason anywhere in the answer');
  -- A lead sees the team's, an owner sees all.
  PERFORM pg_temp.is(pg_temp.names(pg_temp.chk('acme_lead', 'Cedar Dental', NULL, 'WA')), ARRAY['Cedar Dental'], 'a lead sees their team''s account');
  PERFORM pg_temp.is(pg_temp.masks(pg_temp.chk('acme_lead', 'Harbor Dental', NULL, 'OR')), 1::bigint, 'and not another''s');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.chk('acme_owner', 'Harbor Dental', NULL, 'OR')), ARRAY['Harbor Dental LLC'], 'an owner sees the firm''s');
  -- No owner, or a departed one: the firm's owners are who to ask.
  r := pg_temp.chk('acme_agent2', NULL, 'unownedbakery.example');
  PERFORM pg_temp.is(r -> 'matches' -> 0 -> 'ask', '{"kind": "firm_owners", "names": ["acme_owner@example.test"]}'::jsonb, 'an account with no owner: ask the firm''s owners');
  r := pg_temp.chk('acme_agent2', NULL, 'leftoverbikes.example');
  PERFORM pg_temp.is(r -> 'matches' -> 0 -> 'ask', '{"kind": "firm_owners", "names": ["acme_owner@example.test"]}'::jsonb, 'a departed owner is not asked: the firm''s owners are');
  -- Two accounts with the same person to ask are one mask: nothing counts them.
  r := pg_temp.chk('acme_agent2', 'Twin Pines', 'twinpines.example', 'WA');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'matches'), 1, 'two accounts the person may not see, with the same person to ask, are one mask');
  r := pg_temp.chk('acme_agent3', 'Twin Pines', 'twinpines.example', 'WA');
  PERFORM pg_temp.is(pg_temp.names(r), ARRAY['Twin Pines Co', 'Twin Pines'], 'the owner sees both, the earliest first');
  -- Seen and masked together: seen first.
  r := pg_temp.chk('acme_agent1', 'Harbor Dental', 'cedardental.example', 'OR');
  PERFORM pg_temp.is(pg_temp.names(r), ARRAY['Harbor Dental LLC'], 'one seen');
  PERFORM pg_temp.is(pg_temp.masks(r), 1::bigint, 'one masked');
  PERFORM pg_temp.is((r -> 'matches' -> 0 ->> 'visible')::boolean, true, 'the seen one is first');
  -- Archived accounts still count, and say so.
  r := pg_temp.chk('acme_agent1', 'Oldtown Garage', NULL, 'OR');
  PERFORM pg_temp.is((r -> 'matches' -> 0 ->> 'archived')::boolean, true, 'an archived account is a match and says it is archived');
  -- Another firm's accounts are never matched, whoever asks; Zenith shows everyone everything.
  PERFORM pg_temp.is(pg_temp.names(pg_temp.chk('zenith_agent2', 'Harbor Dental', NULL, 'OR', 'zenith')), ARRAY['Harbor Dental LLC'], 'Zenith''s agents see Zenith''s account (it shows everyone everything)');
  PERFORM pg_temp.is((pg_temp.chk('zenith_agent2', 'Harbor Dental', NULL, 'OR', 'zenith') -> 'matches' -> 0 ->> 'id')::uuid, pg_temp.id('zharbor'), 'and it is Zenith''s own');
  PERFORM pg_temp.is(jsonb_array_length(pg_temp.chk('acme_owner', 'Harbor Dental', NULL, 'OR') -> 'matches'), 1, 'Acme''s owner matches only Acme''s account');
  PERFORM pg_temp.is((pg_temp.chk('acme_owner', 'Harbor Dental', NULL, 'OR') -> 'matches' -> 0 ->> 'id')::uuid, pg_temp.id('harbor'), 'and it is Acme''s own');
  RAISE NOTICE 'spot_a_duplicate: seen and masked passed';
END $$;

-- ---------- many matches ----------
-- Break caught: the answer grows with the firm (a form that lists every account), or hides that some were left out.
DO $$
DECLARE r jsonb; i int;
BEGIN
  FOR i IN 1..7 LOOP
    PERFORM pg_temp.acct('dup' || i, 'acme', 'acme_agent1', 'Dup Co ' || i, 'multi.example', 'OR');
  END LOOP;
  r := pg_temp.chk('acme_agent1', NULL, 'multi.example');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'matches'), 5, 'at most five accounts are listed');
  PERFORM pg_temp.is((r ->> 'more')::int, 2, 'and the rest are counted');
  PERFORM pg_temp.is(pg_temp.names(r), ARRAY['Dup Co 1', 'Dup Co 2', 'Dup Co 3', 'Dup Co 4', 'Dup Co 5'], 'the earliest five');
  RAISE NOTICE 'spot_a_duplicate: many matches passed';
END $$;

-- ---------- a contact's email ----------
-- Break caught: the contact form matches by a likeness or by case, shows a contact of an account the person may not see, or names the wrong account or owner.
DO $$
DECLARE r jsonb; m jsonb;
BEGIN
  r := pg_temp.cchk('acme_agent1', '  PAT.harbor@EXAMPLE.test ');
  m := r -> 'matches' -> 0;
  PERFORM pg_temp.is(jsonb_array_length(r -> 'matches'), 1, 'the same email, in any case and trimmed, matches once (Zenith''s contact with it is another firm''s)');
  PERFORM pg_temp.is(m ->> 'kind', 'contact', 'a contact');
  PERFORM pg_temp.is((m ->> 'id')::uuid, pg_temp.id('harbor_c'), 'with its id');
  PERFORM pg_temp.is(m ->> 'name', 'First harbor_c Last harbor_c', 'its name');
  PERFORM pg_temp.is((m -> 'account' ->> 'id')::uuid, pg_temp.id('harbor'), 'and its account');
  PERFORM pg_temp.is(m -> 'account' ->> 'name', 'Harbor Dental LLC', 'named');
  PERFORM pg_temp.is(m -> 'owner' ->> 'name', 'acme_agent1@example.test', 'its owner');
  PERFORM pg_temp.is(m -> 'reasons', '["email"]'::jsonb, 'by its email');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.cchk('acme_agent1', 'pat.harbor@example')), '{}'::text[], 'never by likeness');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.cchk('acme_agent1', 'harbor@example.test')), '{}'::text[], 'nor a part of an address');
  PERFORM pg_temp.is(pg_temp.cchk('acme_agent1', NULL), '{"matches": [], "more": 0}'::jsonb, 'no email finds nothing');
  PERFORM pg_temp.is(pg_temp.cchk('acme_agent1', '   '), '{"matches": [], "more": 0}'::jsonb, 'a blank finds nothing');
  -- A contact on an account the person may not see is a mask: its account's owner is whom to ask.
  r := pg_temp.cchk('acme_agent2', 'pat.harbor@example.test');
  PERFORM pg_temp.is(r -> 'matches', '[{"kind": "contact", "visible": false, "ask": {"kind": "owner", "names": ["acme_agent1@example.test"]}}]'::jsonb, 'only that one exists, and whom to ask');
  PERFORM pg_temp.is(r::text ~* 'harbor', false, 'nothing of it leaks');
  PERFORM pg_temp.is(pg_temp.cchk('acme_agent2', 'baker@unownedbakery.example') -> 'matches' -> 0 -> 'ask', '{"kind": "firm_owners", "names": ["acme_owner@example.test"]}'::jsonb, 'a contact of an unowned account: the firm''s owners');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.cchk('acme_lead', 'sam@cedardental.example')), ARRAY['First cedar_c Last cedar_c'], 'a lead sees a contact of their team''s account');
  PERFORM pg_temp.is(pg_temp.names(pg_temp.cchk('acme_owner', 'sam@cedardental.example')), ARRAY['First cedar_c Last cedar_c'], 'an owner sees it');
  -- The same email on two accounts: the ones seen are listed and the rest are one mask.
  PERFORM pg_temp.contact('twin_c1', 'twin1', 'acme_agent3', 'shared@twin.test');
  PERFORM pg_temp.contact('harbor_c2', 'harbor', 'acme_agent1', 'shared@twin.test');
  r := pg_temp.cchk('acme_agent1', 'shared@twin.test');
  PERFORM pg_temp.is(pg_temp.names(r), ARRAY['First harbor_c2 Last harbor_c2'], 'seen: the one on the account the person may see');
  PERFORM pg_temp.is(pg_temp.masks(r), 1::bigint, 'and a mask for the other');
  -- The firm's own only.
  PERFORM pg_temp.is((pg_temp.cchk('zenith_agent', 'pat.harbor@example.test', 'zenith') -> 'matches' -> 0 ->> 'id')::uuid, pg_temp.id('zharbor_c'), 'Zenith finds Zenith''s contact');
  RAISE NOTICE 'spot_a_duplicate: a contact''s email passed';
END $$;

-- ---------- who may ask, and that nothing is written ----------
-- Break caught: the check is open to a signed-out caller, a person who is no member of the firm, or a firm the caller was not placed in; the internals are callable through
-- the API; or asking writes.
DO $$
DECLARE before_a bigint; before_c bigint; before_h bigint;
BEGIN
  SELECT count(*) INTO before_a FROM public.accounts;
  SELECT count(*) INTO before_c FROM public.contacts;
  SELECT count(*) INTO before_h FROM public.record_history;
  PERFORM pg_temp.as_user('nobody');
  PERFORM pg_temp.is(pg_temp.refused(format($q$SELECT public.duplicate_account_check(%L, 'Harbor Dental', NULL, 'OR')$q$, pg_temp.id('acme'))), '42501', 'a person of no firm is refused (accounts)');
  PERFORM pg_temp.is(pg_temp.refused(format($q$SELECT public.duplicate_contact_check(%L, 'a@b.test')$q$, pg_temp.id('acme'))), '42501', 'and (contacts)');
  PERFORM pg_temp.as_user('zenith_owner');
  PERFORM pg_temp.is(pg_temp.refused(format($q$SELECT public.duplicate_account_check(%L, 'Harbor Dental', NULL, 'OR')$q$, pg_temp.id('acme'))), '42501', 'a member of another firm is refused for Acme');
  PERFORM pg_temp.is(pg_temp.refused(format($q$SELECT public.duplicate_contact_check(%L, 'pat.harbor@example.test')$q$, pg_temp.id('acme'))), '42501', 'and for Acme''s contacts');
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is(pg_temp.refused('SELECT public.duplicate_account_check(NULL, ''Harbor Dental'', NULL, ''OR'')'), 'ok', 'naming no firm acts for the person''s only firm');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.refused(format($q$SELECT public.duplicate_account_check(%L, 'Harbor Dental', NULL, 'OR')$q$, pg_temp.id('acme'))), '42501', 'a signed-out caller cannot run it (accounts)');
  PERFORM pg_temp.is(pg_temp.refused(format($q$SELECT public.duplicate_contact_check(%L, 'a@b.test')$q$, pg_temp.id('acme'))), '42501', 'nor (contacts)');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.refused(format($q$SELECT public.duplicate_account_check(%L, 'Harbor Dental', NULL, 'OR')$q$, pg_temp.id('acme'))), '42501', 'the service role is no member of a firm');
  PERFORM pg_temp.as_user('acme_owner');
  PERFORM pg_temp.is(pg_temp.refused($q$SELECT public.duplicates_of_account(NULL, NULL, NULL, NULL, NULL)$q$), '42501', 'the rule itself is not for the API (accounts)');
  PERFORM pg_temp.is(pg_temp.refused($q$SELECT public.duplicates_of_contact(NULL, NULL)$q$), '42501', 'nor the contacts''');
  PERFORM pg_temp.is(pg_temp.refused($q$SELECT public.duplicate_who_to_ask(NULL, NULL)$q$), '42501', 'nor whom to ask');
  PERFORM pg_temp.is(pg_temp.refused($q$SELECT public.find_duplicate_account(NULL, NULL, NULL, NULL, NULL)$q$), '42501', 'nor the chain''s question');
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts), before_a, 'asking makes no account');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts), before_c, 'no contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history), before_h, 'and no history');
  PERFORM pg_temp.is((SELECT bool_and(p.provolatile = 's' AND p.prosecdef) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('duplicate_account_check', 'duplicate_contact_check')), true, 'both are stable reads that run as their owner');
  RAISE NOTICE 'spot_a_duplicate: who may ask passed';
END $$;

-- ---------- saving is never refused for a likeness ----------
-- Break caught: create_account or add_contact starts refusing a duplicate (D-193: a likeness is a warning, never a rule).
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1');
  r := public.create_account('Harbor Dental LLC', NULL, 'harbordental.example', NULL, NULL, NULL, 'OR', NULL, NULL, NULL, '{}', NULL, NULL, pg_temp.id('acme'));
  PERFORM pg_temp.is(r ->> 'name', 'Harbor Dental LLC', 'an account the same as one that exists is made');
  r := public.add_contact(pg_temp.id('harbor'), 'Pat', 'Harbor', NULL, 'pat.harbor@example.test', NULL, NULL, NULL, false, false, pg_temp.id('acme'));
  PERFORM pg_temp.is(r -> 'record' ->> 'email', 'pat.harbor@example.test', 'and a contact with an email that exists is added');
  RESET ROLE;
  RAISE NOTICE 'spot_a_duplicate: saving is never refused passed';
END $$;

SELECT 'spot_a_duplicate: all passed' AS result;
