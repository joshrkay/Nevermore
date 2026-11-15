-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh won_lost_commission
-- Won, lost and reopen in one step each, with commission (story CRM-O1.3a, Epic 4 build order row 4; docs/BROKER_CRM_BUILD.md D-24, D-28, D-45, D-46, D-209, D-222,
-- D-407, D-446, D-456, D-461 to D-474; ADR 0027; 20261120121000_won_lost_commission.sql). Marking an opportunity won chooses the quote, closes the rest, makes the
-- placement and its renewal and records the commission expected; lost keeps a reason; reopen undoes either; commission payments are the money received. Two firms
-- are used throughout. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261120121000_won_lost_commission.sql
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
-- Calls a function as a person at an address and answers its text, or the SQLSTATE and message it raised.
CREATE FUNCTION pg_temp.as_call(who text, addr text, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; s text; m text;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  BEGIN
    EXECUTE stmt INTO r;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    r := s || ': ' || m;
  END;
  RESET ROLE;
  RETURN r;
END $$;

-- The code of a refusal (its SQLSTATE), or 'ok'.
CREATE FUNCTION pg_temp.code(r text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN r ~ '^[0-9A-Z]{5}: ' THEN left(r, 5) ELSE 'ok' END $$;

-- A submission moved the way set_submission_status moves it: the pipeline row changes and a history row says from where to where.
CREATE FUNCTION pg_temp.move(intake text, to_status text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE from_status text;
BEGIN
  SELECT w.status INTO from_status FROM public.submission_workflow w WHERE w.session_id = pg_temp.id(intake);
  UPDATE public.submission_workflow SET status = to_status WHERE session_id = pg_temp.id(intake);
  INSERT INTO public.submission_status_history (session_id, from_status, to_status) VALUES (pg_temp.id(intake), from_status, to_status);
END $$;


-- ---------- the records ----------
-- Acme (by level): a1 is agent1's, a2 is agent2's (in Sales), a3 has no owner. Zenith (everyone sees everything): z1 is zenith_agent's.
DO $$
BEGIN
  PERFORM pg_temp.account('a1', 'acme', 'acme_agent1', 'Harborview Dental Group');
  PERFORM pg_temp.account('a2', 'acme', 'acme_agent2');
  PERFORM pg_temp.account('a3', 'acme', NULL);
  PERFORM pg_temp.account('z1', 'zenith', 'zenith_agent', 'Zenith client');
END $$;

-- ---------- helpers ----------
CREATE FUNCTION pg_temp.fid(who text) RETURNS uuid LANGUAGE sql AS $$ SELECT pg_temp.id(CASE WHEN who LIKE 'zenith%' THEN 'zenith' ELSE 'acme' END) $$;
CREATE FUNCTION pg_temp.addr(who text) RETURNS text LANGUAGE sql AS $$ SELECT CASE WHEN who LIKE 'zenith%' THEN 'zenith-benefits' ELSE 'acme-brokers' END $$;

CREATE FUNCTION pg_temp.pipeline(n text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id(n) $$;
CREATE FUNCTION pg_temp.ver(n text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT version FROM public.opportunities WHERE id = pg_temp.id(n) $$;

-- A quote request of an intake, made by the superuser (the advisor functions do it in the product). status 'quoted' gets a fee and a proposed start.
CREATE FUNCTION pg_temp.quote(n text, p_intake text, p_peo text, p_status text, p_fee numeric DEFAULT NULL, p_start date DEFAULT NULL) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE r bigint;
BEGIN
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on, admin_fee_pepm, proposed_start_on, quote_received_on)
  VALUES (pg_temp.id(p_intake), p_peo, p_status, current_date - 20, p_fee, p_start, CASE WHEN p_status = 'quoted' THEN current_date - 5 END) RETURNING id INTO r;
  RETURN r;
END $$;
CREATE FUNCTION pg_temp.qid(n text, peo text) RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id(n) AND peo_name = peo $$;

-- A quoted search: an intake moved to Quoted, its opportunity (owned by p_owner, 40 employees, target start 2027-04-01), and three quote requests: Justworks
-- (quoted, $85.00, proposes 2027-05-01), TriNet (quoted, $90.00, no proposed start) and Paychex (sent), plus Gusto (declined).
CREATE FUNCTION pg_temp.quoted(n text, p_firm text, p_account text, p_owner text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE sid uuid := pg_temp.intake(n, p_firm);
BEGIN
  PERFORM pg_temp.move(n, 'submitted');
  PERFORM pg_temp.move(n, 'under_review');
  PERFORM pg_temp.move(n, 'ready_for_market');
  PERFORM pg_temp.move(n, 'sent_to_carrier');
  PERFORM pg_temp.move(n, 'quoted');
  PERFORM pg_temp.opportunity('o_' || n, p_account, p_owner, n);
  UPDATE public.opportunities SET employees = 40, target_start = DATE '2027-04-01' WHERE id = pg_temp.id('o_' || n);
  PERFORM pg_temp.quote(n || '_jw', n, 'Justworks', 'quoted', 85.00, DATE '2027-05-01');
  PERFORM pg_temp.quote(n || '_tn', n, 'TriNet', 'quoted', 90.00);
  PERFORM pg_temp.quote(n || '_px', n, 'Paychex', 'sent');
  PERFORM pg_temp.quote(n || '_gu', n, 'Gusto', 'declined');
  RETURN sid;
END $$;

-- Mark won as a person, by name, from the version given (NULL: the opportunity's own).
CREATE FUNCTION pg_temp.won(who text, p_opp text, p_quote bigint, p_start date, p_renewal date, p_broker text, p_version integer DEFAULT NULL,
                            p_basis text DEFAULT NULL, p_rate numeric DEFAULT NULL, p_yearly numeric DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format(
    'SELECT public.opportunity_mark_won(p_opportunity_id => %L, p_quote_request_id => %L, p_start_date => %L, p_renewal_date => %L, p_broker_of_record => %L, p_firm_id => %L, p_version => %L, p_commission_basis => %L, p_commission_rate => %L, p_commission_expected_yearly => %L)::text',
    pg_temp.id(p_opp), p_quote, p_start, p_renewal, p_broker, pg_temp.fid(who), COALESCE(p_version, pg_temp.ver(p_opp)), p_basis, p_rate, p_yearly))
$$;

-- ---------- marking won (D-461, D-464, D-465) ----------
-- Break caught: Mark won does not choose the quote (the submission is not Won, or does not name it); leaves the other open quotes open (the PEOs would go on
-- waiting) or closes them with another reason, or closes a quote that has already declined; makes no placement, or one with the wrong PEO, start, broker or
-- quote; adds no renewal, or one with the wrong date or PEO; leaves the account a prospect.
DO $$
DECLARE r text; j jsonb; pl public.placements; rn public.renewals; i uuid; o uuid;
BEGIN
  i := pg_temp.quoted('w1', 'acme', 'a1', 'acme_agent1');
  o := pg_temp.id('o_w1');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('a1')), 'prospect', 'before the win the account is a prospect');
  r := pg_temp.won('acme_agent1', 'o_w1', pg_temp.qid('w1', 'Justworks'), DATE '2027-05-01', DATE '2028-05-01', 'Acme Brokers');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner of the opportunity marks it won: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is(pg_temp.pipeline('w1'), 'won', 'the submission is won');
  PERFORM pg_temp.is((SELECT w.won_quote_request_id FROM public.submission_workflow w WHERE w.session_id = i), pg_temp.qid('w1', 'Justworks'), 'naming the quote the employer took');
  PERFORM pg_temp.is(public.opportunity_stage(o), 'won', 'so the opportunity is Won');
  PERFORM pg_temp.is((SELECT string_agg(q.peo_name || ':' || q.status || ':' || COALESCE(q.close_reason, '-'), ' ' ORDER BY q.peo_name) FROM public.quote_requests q WHERE q.session_id = i),
    'Gusto:declined:- Justworks:quoted:- Paychex:closed:went_elsewhere TriNet:closed:went_elsewhere',
    'every other open quote is closed "the employer went elsewhere"; the winner stays quoted; a decline stays a decline');
  SELECT * INTO pl FROM public.placements p WHERE p.opportunity_id = o;
  PERFORM pg_temp.is(row (pl.peo_name, pl.start_date, pl.broker_of_record, pl.quote_request_id, pl.account_id, pl.ended_on)::text,
    row ('Justworks', DATE '2027-05-01', 'Acme Brokers', pg_temp.qid('w1', 'Justworks'), pg_temp.id('a1'), NULL::date)::text, 'the placement: the PEO from the quote, the start, the broker of record, the quote request, the account');
  SELECT * INTO rn FROM public.renewals x WHERE x.placement_id = pl.id;
  PERFORM pg_temp.is(row (rn.kind, rn.with_whom, rn.renews_on, rn.account_id, rn.opportunity_id)::text,
    row ('peo_placement', 'Justworks', DATE '2028-05-01', pg_temp.id('a1'), NULL::uuid)::text, 'the renewal: with the PEO, on the date given, on the account, worked by nobody');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('a1')), 'client', 'the account is now a client');
  PERFORM pg_temp.is(j -> 'record' ->> 'stage', 'won', 'the answer says Won');
  PERFORM pg_temp.is(j -> 'record' -> 'placement' ->> 'id', pl.id::text, 'and names the placement');
  PERFORM pg_temp.is(j -> 'record' -> 'renewal' ->> 'id', rn.id::text, 'and the renewal');
  PERFORM pg_temp.is(j -> 'record' -> 'renewal' ->> 'made_by_win', 'true', 'a renewal a win made');
  PERFORM pg_temp.is((SELECT h.from_status || '>' || h.to_status || ':' || h.changed_by::text FROM public.submission_status_history h WHERE h.session_id = i ORDER BY h.id DESC LIMIT 1),
    'quoted>won:' || pg_temp.id('acme_agent1')::text, 'the move is in the status history, by the person who made it');
END $$;

-- A snapshot of everything a win writes, so a refused win can be shown to have written nothing.
CREATE FUNCTION pg_temp.snapshot(p_intake text, p_account text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT (SELECT status || ':' || COALESCE(won_quote_request_id::text, '-') FROM public.submission_workflow WHERE session_id = pg_temp.id(p_intake)) || '|'
    || (SELECT COALESCE(string_agg(q.id || q.status || COALESCE(q.close_reason, '-'), ',' ORDER BY q.id), '') FROM public.quote_requests q WHERE q.session_id = pg_temp.id(p_intake)) || '|'
    || (SELECT count(*) FROM public.placements WHERE account_id = pg_temp.id(p_account)) || '|' || (SELECT count(*) FROM public.renewals WHERE account_id = pg_temp.id(p_account)) || '|'
    || (SELECT count(*) FROM public.submission_status_history WHERE session_id = pg_temp.id(p_intake))
$$;

-- ---------- who may mark won, and what a refused win leaves (D-462, D-209, D-46) ----------
-- Break caught: a win by someone who may not see the opportunity (it must read as not there), or who sees it but may not change it (D-462: whoever may change
-- it), or by another firm's person, or with no version, a version it never had, or a stale one (a second person's change overwritten); a conflict that names
-- nothing; a refused win that has already moved the submission, closed a quote or made a placement (all or none).
DO $$
DECLARE r text; j jsonb; snap text; jw bigint; v integer;
BEGIN
  PERFORM pg_temp.quoted('w2', 'acme', 'a2', 'acme_agent2');
  jw := pg_temp.qid('w2', 'Justworks');
  snap := pg_temp.snapshot('w2', 'a2');
  -- who may see
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_agent1', 'o_w2', jw, NULL, NULL, 'Acme', pg_temp.ver('o_w2'))), 'PT404', 'an agent who may not see the account: as if it were not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('zenith_owner', 'o_w2', jw, NULL, NULL, 'Acme', pg_temp.ver('o_w2'))), 'PT404', 'another firm''s owner: as if it were not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_owner', 'acme-brokers', format('SELECT public.opportunity_mark_won(%L, %L, NULL, NULL, ''Acme'', %L, 1)::text', pg_temp.id('o_w2'), jw, pg_temp.id('acme')))), '42501', 'and no member of Acme');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_removed', 'o_w2', jw, NULL, NULL, 'Acme', 1)), '42501', 'a former member');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_lead2', 'o_w2', jw, NULL, NULL, 'Acme', pg_temp.ver('o_w2'))), 'PT404', 'a lead whose team does not reach the account does not see it');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_owner', 'acme-brokers', format('SELECT public.opportunity_mark_won(%L, %L, NULL, NULL, ''Acme'', %L, 1)::text', gen_random_uuid(), jw, pg_temp.id('acme')))), 'PT404', 'an opportunity that does not exist');
  -- who may change: Zenith shows everyone everything, so zenith_agent2 sees zenith_agent's opportunity and may not change it
  PERFORM pg_temp.account('z2', 'zenith', 'zenith_agent');
  PERFORM pg_temp.quoted('zw1', 'zenith', 'z2', 'zenith_agent');
  r := pg_temp.won('zenith_agent2', 'o_zw1', pg_temp.qid('zw1', 'Justworks'), NULL, NULL, 'Zenith');
  PERFORM pg_temp.is(r, '42501: Only the opportunity''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'one who sees it but may not change it is refused in words');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('zenith_lead', 'o_zw1', pg_temp.qid('zw1', 'Justworks'), NULL, NULL, 'Zenith')), '42501', 'a lead whose team does not reach its owner');
  PERFORM pg_temp.is(pg_temp.snapshot('zw1', 'z2'), pg_temp.snapshot('zw1', 'z2'), 'the snapshot is stable');
  PERFORM pg_temp.is(pg_temp.pipeline('zw1'), 'quoted', 'none of those moved Zenith''s submission');
  -- an opportunity with no owner: a firm owner only (D-422)
  PERFORM pg_temp.quoted('w3', 'acme', 'a3', NULL);
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_agent1', 'o_w3', pg_temp.qid('w3', 'Justworks'), NULL, NULL, 'Acme')), 'PT404', 'an agent does not see an account with no owner');
  PERFORM pg_temp.is(pg_temp.snapshot('w2', 'a2'), snap, 'the refusals changed nothing');

  -- the version
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent2', 'acme-brokers', format('SELECT public.opportunity_mark_won(%L, %L, NULL, NULL, ''Acme'', %L, NULL)::text', pg_temp.id('o_w2'), jw, pg_temp.id('acme'))),
    '22023: This save did not say which version of the opportunity it started from, so it was refused. Reload the page and try again.', 'no version');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_agent2', 'o_w2', jw, NULL, NULL, 'Acme', 0)), '22023', 'version 0');
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_w2', jw, NULL, NULL, 'Acme', 99),
    '22023: This save names a version of the opportunity that does not exist, so it was refused. Reload the page and try again.', 'a version it never had');
  v := pg_temp.ver('o_w2');
  UPDATE public.opportunities SET next_step = 'Call the owner' WHERE id = pg_temp.id('o_w2');
  UPDATE public.opportunities SET value = 90000 WHERE id = pg_temp.id('o_w2');
  r := pg_temp.won('acme_agent2', 'o_w2', jw, NULL, NULL, 'Acme', v);
  j := r::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'a win from a version the opportunity has left is a conflict');
  PERFORM pg_temp.is((j ->> 'currentVersion')::int, v + 2, 'naming the version it is at');
  PERFORM pg_temp.is(j -> 'current' ->> 'stage', 'quoted', 'and the stage it is at');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',' ORDER BY c ->> 'field') FROM jsonb_array_elements(j -> 'changed') c), 'next_step,value', 'and the fields the other save changed');
  PERFORM pg_temp.is(pg_temp.snapshot('w2', 'a2'), snap, 'nothing was done');

  -- an archived account takes no win (D-222)
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('a2');
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_w2', jw, NULL, NULL, 'Acme'), '55000: This account is archived. Nothing on it can be changed.', 'an archived account');
  UPDATE public.accounts SET archived_at = NULL WHERE id = pg_temp.id('a2');
  PERFORM pg_temp.is(pg_temp.snapshot('w2', 'a2'), snap, 'and left nothing behind');
END $$;

-- Break caught: Won is allowed without a quoted quote (D-463), with a quote of another opportunity, one that is only sent, declined or closed, or on an
-- opportunity that is not Quoted (in market, won, lost); the chosen quote is not one of this opportunity's; the refusal names nothing helpful.
DO $$
DECLARE jw bigint; px bigint; tn bigint; snap text; other bigint;
BEGIN
  PERFORM pg_temp.quoted('w4', 'acme', 'a2', 'acme_agent2');
  jw := pg_temp.qid('w4', 'Justworks'); px := pg_temp.qid('w4', 'Paychex'); tn := pg_temp.qid('w4', 'TriNet');
  snap := pg_temp.snapshot('w4', 'a2');
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_w4', NULL, NULL, NULL, 'Acme'), '22023: Choose which of this opportunity''s quoted quotes the employer took.', 'no quote named');
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_w4', px, NULL, NULL, 'Acme'), '22023: Choose which of this opportunity''s quoted quotes the employer took.', 'a quote only sent');
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_w4', pg_temp.qid('w4', 'Gusto'), NULL, NULL, 'Acme'), '22023: Choose which of this opportunity''s quoted quotes the employer took.', 'a quote declined');
  PERFORM pg_temp.quoted('w5', 'acme', 'a2', 'acme_agent2');
  other := pg_temp.qid('w5', 'Justworks');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_agent2', 'o_w4', other, NULL, NULL, 'Acme')), '22023', 'another opportunity''s quote');
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_w4', 999999, NULL, NULL, 'Acme'), '22023: Choose which of this opportunity''s quoted quotes the employer took.', 'a quote that does not exist');
  PERFORM pg_temp.is(pg_temp.snapshot('w4', 'a2'), snap, 'none of those did anything');
  -- no quoted quote at all: the words the dialog shows beside the disabled Won
  UPDATE public.quote_requests SET status = 'sent', proposed_start_on = NULL, admin_fee_pepm = NULL, quote_received_on = NULL WHERE session_id = pg_temp.id('w4') AND status = 'quoted';
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_w4', jw, NULL, NULL, 'Acme'), '22023: Won needs a quote the employer took. None of this opportunity''s quotes is quoted yet', 'no quote is quoted yet');
  -- not Quoted
  PERFORM pg_temp.move('w4', 'sent_to_carrier');
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_w4', jw, NULL, NULL, 'Acme'), '22023: Only a quoted opportunity can be won. It is in market', 'in market');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_agent2', 'o_w5', other, NULL, NULL, 'Acme')), 'ok', 'a good win goes through');
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_w5', other, NULL, NULL, 'Acme'), '22023: This opportunity is already won.', 'a second win of the same opportunity is refused, not repeated');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE opportunity_id = pg_temp.id('o_w5')), 1::bigint, 'with one placement');
  PERFORM pg_temp.quoted('w6', 'acme', 'a2', 'acme_agent2');
  PERFORM pg_temp.move('w6', 'lost');
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_w6', pg_temp.qid('w6', 'Justworks'), NULL, NULL, 'Acme'), '22023: This opportunity is lost. Reopen it first.', 'a lost one');
  PERFORM pg_temp.opportunity('o_noint', 'a2', 'acme_agent2');
  PERFORM pg_temp.is(pg_temp.won('acme_agent2', 'o_noint', 1, NULL, NULL, 'Acme'), '22023: Won needs a quote the employer took. None of this opportunity''s quotes is quoted yet', 'one with no intake has no quote to take');
END $$;

-- ---------- the dates, the broker of record and the commission (D-465, D-466) ----------
-- Break caught: the start is not offered from the quote's proposed start and then the target start; the renewal is not a year after the start by default; a
-- renewal on or before the start is saved; no broker of record is accepted, or 121 characters; a commission with no basis, a share above 100 or at 0, a number
-- with a fraction of a cent, a negative figure, or a figure with no basis is saved; the commission is not kept on the placement as it was sent.
DO $$
DECLARE r text; snap text; pl public.placements; tn bigint;
BEGIN
  PERFORM pg_temp.account('d1', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('dd1', 'acme', 'd1', 'acme_agent1');
  snap := pg_temp.snapshot('dd1', 'd1');
  tn := pg_temp.qid('dd1', 'TriNet');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, DATE '2027-03-01', 'Acme'), '22023: The renewal must come after the start.', 'a renewal before the start (the start being the target start, 2027-04-01)');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, DATE '2027-06-01', DATE '2027-06-01', 'Acme'), '22023: The renewal must come after the start.', 'a renewal on the start');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, NULL), '22023: Say who the broker of record is.', 'no broker of record');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, '   '), '22023: Say who the broker of record is.', 'a blank one');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, repeat('b', 121)), '22023: Keep the broker of record to 120 characters.', '121 characters');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, 'bonus', 5), '22023: Choose how the commission is worked out: a share of the admin fee, per employee, or flat.', 'a made-up basis');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, NULL, 5), '22023: Choose how the commission is worked out.', 'a number with no basis');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, NULL, NULL, 5000), '22023: Choose how the commission is worked out.', 'a yearly figure with no basis');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, 'share', NULL), '22023: Give the commission''s number.', 'a basis with no number');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, 'share', 0), '22023: The commission must be more than zero.', 'a share of nothing');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, 'flat', -5), '22023: The commission must be more than zero.', 'a negative number');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, 'share', 100.01), '22023: A share is a percent: 100 at most.', 'a share above 100');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, 'per_employee', 4.005), '22023: Keep the commission to cents.', 'a fraction of a cent');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, 'flat', 1000000000000), '22023: That commission is too large.', 'a number too large to keep');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, 'flat', 1000, -1), '22023: The expected commission can''t be negative.', 'a negative yearly figure');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, 'Acme', NULL, 'flat', 1000, 5000.005), '22023: Keep the expected commission to cents.', 'a yearly figure with a fraction of a cent');
  PERFORM pg_temp.is(pg_temp.snapshot('dd1', 'd1'), snap, 'none of those did anything');

  -- the defaults: no proposed start on TriNet's quote, so the opportunity's target start; the renewal a year later; a share of 20 percent
  r := pg_temp.won('acme_agent1', 'o_dd1', tn, NULL, NULL, '  Acme Brokers  ', NULL, 'share', 20, 12960.00);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a win with the defaults: ' || r);
  SELECT * INTO pl FROM public.placements WHERE opportunity_id = pg_temp.id('o_dd1');
  PERFORM pg_temp.is(row (pl.start_date, pl.broker_of_record, pl.commission_basis, pl.commission_rate, pl.commission_expected_yearly)::text,
    row (DATE '2027-04-01', 'Acme Brokers', 'share', 20.00::numeric, 12960.00::numeric)::text, 'the start is the target start, the broker is trimmed, the commission is kept as typed (20 for 20 percent)');
  PERFORM pg_temp.is((SELECT r2.renews_on FROM public.renewals r2 WHERE r2.placement_id = pl.id), DATE '2028-04-01', 'the renewal is a year after the start');
  PERFORM pg_temp.is((r::jsonb -> 'record' -> 'placement' ->> 'commission_rate')::numeric, 20.00::numeric, 'and the answer carries the commission');

  -- the quote's own proposed start wins over the target start; the commission is optional
  PERFORM pg_temp.account('d2', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('dd2', 'acme', 'd2', 'acme_agent1');
  r := pg_temp.won('acme_agent1', 'o_dd2', pg_temp.qid('dd2', 'Justworks'), NULL, NULL, 'Acme');
  SELECT * INTO pl FROM public.placements WHERE opportunity_id = pg_temp.id('o_dd2');
  PERFORM pg_temp.is(row (pl.start_date, pl.commission_basis, pl.commission_rate, pl.commission_expected_yearly)::text, row (DATE '2027-05-01', NULL::text, NULL::numeric, NULL::numeric)::text,
    'the start is the quote''s proposed start; with no commission none is kept');
  PERFORM pg_temp.is((SELECT r2.renews_on FROM public.renewals r2 WHERE r2.placement_id = pl.id), DATE '2028-05-01', 'and the renewal a year after it');
  -- per employee and flat, and a feb-29 start (a year after is still after)
  PERFORM pg_temp.account('d3', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('dd3', 'acme', 'd3', 'acme_agent1');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_agent1', 'o_dd3', pg_temp.qid('dd3', 'Justworks'), DATE '2028-02-29', NULL, 'Acme', NULL, 'per_employee', 4.50, 2160)), 'ok', 'per employee, dollars');
  PERFORM pg_temp.is((SELECT r2.renews_on FROM public.renewals r2 JOIN public.placements p ON p.id = r2.placement_id WHERE p.opportunity_id = pg_temp.id('o_dd3')), DATE '2029-02-28', 'a year after a leap day');
  PERFORM pg_temp.account('d4', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('dd4', 'acme', 'd4', 'acme_agent1');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_agent1', 'o_dd4', pg_temp.qid('dd4', 'Justworks'), NULL, NULL, 'Acme', NULL, 'flat', 12000)), 'ok', 'flat a year, with no yearly figure');
  PERFORM pg_temp.is((SELECT p.commission_expected_yearly FROM public.placements p WHERE p.opportunity_id = pg_temp.id('o_dd4')), NULL::numeric, 'the yearly figure is optional');
  PERFORM pg_temp.account('d5', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('dd5', 'acme', 'd5', 'acme_agent1');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_agent1', 'o_dd5', pg_temp.qid('dd5', 'Justworks'), NULL, NULL, 'Acme', NULL, 'share', 100)), 'ok', '100 percent is a share');
END $$;

-- Break caught: a win that fails half way leaves the submission won, quotes closed or a placement behind (all or none, D-461).
DO $$
DECLARE snap text; r text;
BEGIN
  PERFORM pg_temp.account('aon', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('aon1', 'acme', 'aon', 'acme_agent1');
  snap := pg_temp.snapshot('aon1', 'aon');
  CREATE FUNCTION pg_temp.boom() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RAISE EXCEPTION 'boom' USING ERRCODE = 'XX001'; END $f$;
  CREATE TRIGGER boom BEFORE INSERT ON public.renewals FOR EACH ROW EXECUTE FUNCTION pg_temp.boom();
  r := pg_temp.won('acme_agent1', 'o_aon1', pg_temp.qid('aon1', 'Justworks'), NULL, NULL, 'Acme');
  DROP TRIGGER boom ON public.renewals;
  PERFORM pg_temp.is(pg_temp.code(r), 'XX001', 'the win failed at its last write');
  PERFORM pg_temp.is(pg_temp.snapshot('aon1', 'aon'), snap, 'and nothing it wrote before stayed');
END $$;

-- Break caught: a closing firm or Nevermore support can mark an opportunity won (ADR 0023, ADR 0024), or the guard is asked after the rule that hides it.
DO $$
DECLARE sess uuid; snap text; jw bigint;
BEGIN
  PERFORM pg_temp.account('g1', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('gg1', 'acme', 'g1', 'acme_agent1');
  jw := pg_temp.qid('gg1', 'Justworks');
  snap := pg_temp.snapshot('gg1', 'g1');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.won('acme_agent1', 'o_gg1', jw, NULL, NULL, 'Acme'), 6), 'PT423:', 'a closing firm marks nothing won');
  PERFORM pg_temp.is(left(pg_temp.won('acme_agent2', 'o_gg1', jw, NULL, NULL, 'Acme'), 6), 'PT423:', 'and the guard comes before the rule that hides the account');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an opportunity the firm asked about') t);
  PERFORM pg_temp.is(left(pg_temp.won('platform_admin', 'o_gg1', jw, NULL, NULL, 'Acme', 1), 6), 'PT423:', 'Nevermore support marks nothing won');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.snapshot('gg1', 'g1'), snap, 'nothing changed');
END $$;

-- ---------- winning a renewal's opportunity ends the placement it came from (D-456, D-474) ----------
-- Break caught: the win of an opportunity that works a renewal leaves the old placement running (a placement that can never end, and an account that never
-- becomes a former client when it later leaves); ends it on another day than the new placement's start; ends a placement of an opportunity that is not
-- working it; leaves the old renewal not done (D-449: won is done); moves the account's status; ends a placement earlier than it began (a check failure
-- instead of words); overwrites a day a placement already ended.
CREATE FUNCTION pg_temp.add_renewal(who text, p_account text, p_kind text, p_with text, p_on date, p_start date DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.add_renewal(%L, %L, %L, %L, %L, %L)::text', pg_temp.id(p_account), p_kind, p_with, p_on, p_start, pg_temp.fid(who)))
$$;
DO $$
DECLARE r text; j jsonb; old_p uuid; old_r uuid; snap text; pl public.placements;
BEGIN
  PERFORM pg_temp.account('rn1', 'acme', 'acme_agent1');
  -- the firm placed it before the product: Gusto from 2026-05-01, renewing 2027-05-01
  r := pg_temp.add_renewal('acme_agent1', 'rn1', 'peo_placement', 'Gusto', DATE '2027-05-01', DATE '2026-05-01');
  old_p := (r::jsonb -> 'placement' ->> 'id')::uuid; old_r := (r::jsonb -> 'renewal' ->> 'id')::uuid;
  INSERT INTO fx VALUES ('rn1_old_p', old_p), ('rn1_old_r', old_r);
  PERFORM pg_temp.quoted('rw1', 'acme', 'rn1', 'acme_agent1');
  -- "Start the renewal" (CRM-A2.4b) links the opportunity to the renewal
  UPDATE public.renewals SET opportunity_id = pg_temp.id('o_rw1') WHERE id = old_r;
  PERFORM pg_temp.is(public.renewal_is_done(NULL, pg_temp.id('o_rw1')), false, 'while the opportunity is open the renewal is not done');
  -- a start before the old placement began is refused in words, and nothing is done
  snap := pg_temp.snapshot('rw1', 'rn1');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_rw1', pg_temp.qid('rw1', 'Justworks'), DATE '2026-04-01', NULL, 'Acme'), '22023: The placement this renews started on 2026-05-01, so the new one can''t start before.', 'a start before the old placement began');
  PERFORM pg_temp.is(pg_temp.snapshot('rw1', 'rn1'), snap, 'refused whole');
  -- the win
  r := pg_temp.won('acme_agent1', 'o_rw1', pg_temp.qid('rw1', 'Justworks'), DATE '2027-05-01', DATE '2028-05-01', 'Acme');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the win: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = old_p), DATE '2027-05-01', 'the old placement ended on the new placement''s start');
  PERFORM pg_temp.is(j -> 'record' ->> 'ended_placement_id', old_p::text, 'the answer says which');
  PERFORM pg_temp.is(public.renewal_is_done((SELECT not_renewed_on FROM public.renewals WHERE id = old_r), pg_temp.id('o_rw1')), true, 'the old renewal is done: its working opportunity is won');
  PERFORM pg_temp.is((SELECT outcome FROM (SELECT public.crm_renewal_row(x, current_date) ->> 'outcome' AS outcome FROM public.renewals x WHERE x.id = old_r) z), 'renewed', 'and reads Renewed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE account_id = pg_temp.id('rn1') AND ended_on IS NULL), 1::bigint, 'one placement is running: the new one');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('rn1')), 'client', 'the account stays a client through the new placement');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE account_id = pg_temp.id('rn1') AND NOT public.renewal_is_done(not_renewed_on, opportunity_id)), 1::bigint, 'and the next renewal, the win''s, is the one not done');

  -- a day a placement already ended on is not overwritten
  PERFORM pg_temp.account('rn2', 'acme', 'acme_agent1');
  r := pg_temp.add_renewal('acme_agent1', 'rn2', 'peo_placement', 'Gusto', DATE '2027-05-01', DATE '2026-05-01');
  old_p := (r::jsonb -> 'placement' ->> 'id')::uuid; old_r := (r::jsonb -> 'renewal' ->> 'id')::uuid;
  PERFORM pg_temp.quoted('rw2', 'acme', 'rn2', 'acme_agent1');
  UPDATE public.renewals SET opportunity_id = pg_temp.id('o_rw2'), not_renewed_on = DATE '2027-02-01' WHERE id = old_r;
  UPDATE public.placements SET ended_on = DATE '2027-02-01' WHERE id = old_p;
  PERFORM pg_temp.won('acme_agent1', 'o_rw2', pg_temp.qid('rw2', 'Justworks'), DATE '2027-05-01', NULL, 'Acme');
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = old_p), DATE '2027-02-01', 'a placement that had already ended keeps its day');
  PERFORM pg_temp.is(pg_temp.pipeline('rw2'), 'won', 'and the win went through');

  -- an opportunity that works no renewal ends nobody's placement
  PERFORM pg_temp.account('rn3', 'acme', 'acme_agent1');
  r := pg_temp.add_renewal('acme_agent1', 'rn3', 'peo_placement', 'Gusto', DATE '2027-05-01', DATE '2026-05-01');
  old_p := (r::jsonb -> 'placement' ->> 'id')::uuid;
  PERFORM pg_temp.quoted('rw3', 'acme', 'rn3', 'acme_agent1');
  r := pg_temp.won('acme_agent1', 'o_rw3', pg_temp.qid('rw3', 'Justworks'), NULL, NULL, 'Acme');
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = old_p), NULL::date, 'the account''s other placement keeps running');
  PERFORM pg_temp.is((r::jsonb -> 'record' ->> 'ended_placement_id') IS NULL, true, 'and the answer ends none');
END $$;

-- ---------- marking lost (D-468, D-408) ----------
CREATE FUNCTION pg_temp.lost(who text, p_opp text, p_reason text, p_note text DEFAULT NULL, p_version integer DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format(
    'SELECT public.opportunity_mark_lost(p_opportunity_id => %L, p_reason => %L, p_note => %L, p_firm_id => %L, p_version => %L)::text',
    pg_temp.id(p_opp), p_reason, p_note, pg_temp.fid(who), COALESCE(p_version, pg_temp.ver(p_opp))))
$$;

-- Break caught: Lost with an intake leaves the submission where it was or closes no quote, or closes them for another reason than the search ending, or touches a
-- quote that declined; the reason and note are not kept on the opportunity (the banner and the history have nothing to say); a reason outside the list, "other"
-- with no note, or a note of 501 characters is saved; a lost one is lost again; a won one is lost without reopening it; a draft is lost though the pipeline
-- allows it only to be archived.
DO $$
DECLARE r text; j jsonb; o uuid; snap text; i uuid;
BEGIN
  PERFORM pg_temp.account('l1', 'acme', 'acme_agent1');
  i := pg_temp.quoted('lo1', 'acme', 'l1', 'acme_agent1');
  o := pg_temp.id('o_lo1');
  snap := pg_temp.snapshot('lo1', 'l1');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_lo1', 'cheaper'), '22023: Choose why it was lost: stayed with current provider, price, went direct to a PEO, no decision or other.', 'a reason outside the list');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_lo1', NULL), '22023: Choose why it was lost: stayed with current provider, price, went direct to a PEO, no decision or other.', 'no reason');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_lo1', 'other'), '22023: Other needs a note saying why.', 'other with no note');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_lo1', 'other', '   '), '22023: Other needs a note saying why.', 'other with a blank note');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_lo1', 'price', repeat('n', 501)), '22023: Keep the note to 500 characters.', 'a note of 501');
  PERFORM pg_temp.is(pg_temp.snapshot('lo1', 'l1'), snap, 'none of those did anything');
  r := pg_temp.lost('acme_agent1', 'o_lo1', 'price', '  They went with the incumbent''s renewal  ');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner marks it lost: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is(pg_temp.pipeline('lo1'), 'lost', 'the submission is lost');
  PERFORM pg_temp.is(public.opportunity_stage(o), 'lost', 'so the opportunity is Lost');
  PERFORM pg_temp.is((SELECT string_agg(q.peo_name || ':' || q.status || ':' || COALESCE(q.close_reason, '-'), ' ' ORDER BY q.peo_name) FROM public.quote_requests q WHERE q.session_id = i),
    'Gusto:declined:- Justworks:closed:search_ended Paychex:closed:search_ended TriNet:closed:search_ended', 'every open quote is closed "search ended"; a decline stays a decline');
  PERFORM pg_temp.is((SELECT row (lost_reason, lost_note, lost_at, lost_by)::text FROM public.opportunities WHERE id = o), row ('price', 'They went with the incumbent''s renewal', NULL::timestamptz, NULL::uuid)::text,
    'the reason and the trimmed note are kept on the opportunity; the submission, not the opportunity, says lost (no lost_at with an intake)');
  PERFORM pg_temp.is(j -> 'record' ->> 'stage', 'lost', 'the answer says Lost');
  PERFORM pg_temp.is(j -> 'record' ->> 'lost_reason', 'price', 'with the reason');
  PERFORM pg_temp.is((SELECT h.from_status || '>' || h.to_status || ':' || h.changed_by::text FROM public.submission_status_history h WHERE h.session_id = i ORDER BY h.id DESC LIMIT 1),
    'quoted>lost:' || pg_temp.id('acme_agent1')::text, 'the move is in the status history, by the person');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE opportunity_id = o), 0::bigint, 'a loss makes no placement');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('l1')), 'prospect', 'and no client');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_lo1', 'price'), '22023: This opportunity is already lost.', 'a lost one is not lost again');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_lo1', pg_temp.qid('lo1', 'Justworks'), NULL, NULL, 'Acme'), '22023: This opportunity is lost. Reopen it first.', 'nor won');

  -- other, with its note; the note of a listed reason is optional
  PERFORM pg_temp.account('l2', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('lo2', 'acme', 'l2', 'acme_agent1');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.lost('acme_agent1', 'o_lo2', 'other', repeat('n', 500))), 'ok', 'other with a note of 500');
  PERFORM pg_temp.is((SELECT row (lost_reason, char_length(lost_note))::text FROM public.opportunities WHERE id = pg_temp.id('o_lo2')), row ('other', 500)::text, 'kept');
  PERFORM pg_temp.account('l3', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('lo3', 'acme', 'l3', 'acme_agent1');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.lost('acme_agent1', 'o_lo3', 'no_decision')), 'ok', 'a listed reason needs no note');
  PERFORM pg_temp.is((SELECT row (lost_reason, lost_note)::text FROM public.opportunities WHERE id = pg_temp.id('o_lo3')), row ('no_decision', NULL::text)::text, 'none is kept');

  -- from the stages the pipeline allows, and not from the others
  PERFORM pg_temp.account('l4', 'acme', 'acme_agent1');
  PERFORM pg_temp.intake('lo4', 'acme');
  PERFORM pg_temp.opportunity('o_lo4', 'l4', 'acme_agent1', 'lo4');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_lo4', 'price'), '22023: A submission can''t move from draft to lost.', 'a draft can only be archived');
  PERFORM pg_temp.move('lo4', 'submitted');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.lost('acme_agent1', 'o_lo4', 'price')), 'ok', 'a submitted one can be lost');
  PERFORM pg_temp.account('l5', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('lo5', 'acme', 'l5', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_lo5', pg_temp.qid('lo5', 'Justworks'), NULL, NULL, 'Acme');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_lo5', 'price'), '22023: This opportunity is won. Reopen it first.', 'a won one is not lost without reopening it');
  PERFORM pg_temp.move('lo5', 'archived');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_lo5', 'price'), '22023: This opportunity''s submission is archived. Reopen it first.', 'nor an archived one');
  -- archived from a stage other than won or lost has no outcome to reopen: win, lose and reopen all say to restore it from the archive
  PERFORM pg_temp.account('l6', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('lo6', 'acme', 'l6', 'acme_agent1');
  PERFORM pg_temp.move('lo6', 'archived');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_lo6', 'price'), '22023: This opportunity''s submission is archived. Restore it from the archive.', 'lost: archived from Quoted is restored, not reopened');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_lo6', pg_temp.qid('lo6', 'Justworks'), NULL, NULL, 'Acme'), '22023: This opportunity''s submission is archived. Restore it from the archive.', 'won: the same words');
  PERFORM pg_temp.is(pg_temp.pipeline('lo6'), 'archived', 'neither moved it');
END $$;

-- Break caught: Lost with no intake is not kept on the opportunity (nothing says it is lost: D-408), or kept without who and when, or with an intake as well,
-- or without the reason; it is not in the history; the version does not move.
DO $$
DECLARE r text; o uuid; v integer; got text;
BEGIN
  PERFORM pg_temp.account('n1', 'acme', 'acme_agent1');
  PERFORM pg_temp.opportunity('o_n1', 'n1', 'acme_agent1');
  o := pg_temp.id('o_n1');
  v := pg_temp.ver('o_n1');
  PERFORM pg_temp.is(public.opportunity_stage(o), 'qualifying', 'with no intake it is Qualifying');
  r := pg_temp.lost('acme_agent1', 'o_n1', 'went_direct', 'Signed with the PEO''s own rep');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'marked lost with no intake: ' || r);
  PERFORM pg_temp.is(public.opportunity_stage(o), 'lost', 'it is Lost');
  PERFORM pg_temp.is((SELECT row (lost_at IS NOT NULL, lost_by, lost_reason, lost_note)::text FROM public.opportunities WHERE id = o),
    row (true, pg_temp.id('acme_agent1'), 'went_direct', 'Signed with the PEO''s own rep')::text, 'when, who, the reason and the note are on the opportunity');
  PERFORM pg_temp.is((SELECT version FROM public.opportunities WHERE id = o) > v, true, 'the version moved');
  SELECT string_agg(field, ',' ORDER BY field) INTO got FROM public.record_history WHERE table_name = 'opportunities' AND record_key = o::text AND kind = 'changed';
  PERFORM pg_temp.is(got, 'lost_at,lost_by,lost_note,lost_reason', 'lost, who and the reason are history entries');
  PERFORM pg_temp.is(pg_temp.lost('acme_agent1', 'o_n1', 'price'), '22023: This opportunity is already lost.', 'it is not lost again');
  PERFORM pg_temp.is(pg_temp.won('acme_agent1', 'o_n1', 1, NULL, NULL, 'Acme'), '22023: This opportunity is lost. Reopen it first.', 'and cannot be won');
END $$;

-- Break caught: Lost is open to anyone who sees the opportunity (D-462: whoever may change it), or ignores the version, or skips the closing-firm and support
-- guards.
DO $$
DECLARE snap text; v integer; r text; j jsonb; sess uuid;
BEGIN
  PERFORM pg_temp.account('lwa', 'acme', 'acme_agent2');
  PERFORM pg_temp.quoted('lw1', 'acme', 'lwa', 'acme_agent2');
  snap := pg_temp.snapshot('lw1', 'lwa');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.lost('acme_agent1', 'o_lw1', 'price')), 'PT404', 'someone who may not see the account: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.lost('zenith_owner', 'o_lw1', 'price')), 'PT404', 'another firm''s owner: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.lost('acme_removed', 'o_lw1', 'price', NULL, 1)), '42501', 'a former member');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.lost('zenith_agent2', 'o_zw1', 'price')), '42501', 'one who sees it but may not change it');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent2', 'acme-brokers', format('SELECT public.opportunity_mark_lost(%L, ''price'', NULL, %L, NULL)::text', pg_temp.id('o_lw1'), pg_temp.id('acme'))),
    '22023: This save did not say which version of the opportunity it started from, so it was refused. Reload the page and try again.', 'no version');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.lost('acme_agent2', 'o_lw1', 'price', NULL, 99)), '22023', 'a version it never had');
  v := pg_temp.ver('o_lw1');
  UPDATE public.opportunities SET next_step = 'Chase' WHERE id = pg_temp.id('o_lw1');
  j := pg_temp.lost('acme_agent2', 'o_lw1', 'price', NULL, v)::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'from an old version: a conflict');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',') FROM jsonb_array_elements(j -> 'changed') c), 'next_step', 'naming what the other save changed');
  PERFORM pg_temp.is(pg_temp.snapshot('lw1', 'lwa'), snap, 'nothing was done');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.lost('acme_agent2', 'o_lw1', 'price'), 6), 'PT423:', 'a closing firm loses nothing');
  PERFORM pg_temp.is(left(pg_temp.lost('acme_agent1', 'o_lw1', 'price'), 6), 'PT423:', 'and the guard comes first');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an opportunity the firm asked about') t);
  PERFORM pg_temp.is(left(pg_temp.lost('platform_admin', 'o_lw1', 'price', NULL, 1), 6), 'PT423:', 'Nevermore support loses nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.snapshot('lw1', 'lwa'), snap, 'still nothing');
END $$;

-- ---------- reopening (D-462, D-469, D-471, ADR 0027) ----------
CREATE FUNCTION pg_temp.reopen(who text, p_opp text, p_version integer DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format(
    'SELECT public.opportunity_reopen(p_opportunity_id => %L, p_firm_id => %L, p_version => %L)::text', pg_temp.id(p_opp), pg_temp.fid(who), COALESCE(p_version, pg_temp.ver(p_opp))))
$$;

-- Break caught: reopening a win leaves the submission Won or sends it somewhere but Quoted; leaves the quote chosen; keeps the placement or its renewal (the account
-- stays a client); reopens the quotes the win closed (they must stay closed) or closes the winner; leaves the old placement that the win ended still ended (the
-- renewal that was being worked is then not done and its account loses a placement that should run); lets a person who may only change the opportunity reopen it.
DO $$
DECLARE r text; j jsonb; i uuid; o uuid; old_p uuid; old_r uuid; snap text;
BEGIN
  -- the win of an opportunity that works a renewal
  PERFORM pg_temp.account('ro1', 'acme', 'acme_agent2');
  r := pg_temp.add_renewal('acme_agent2', 'ro1', 'peo_placement', 'Gusto', DATE '2027-05-01', DATE '2026-05-01');
  old_p := (r::jsonb -> 'placement' ->> 'id')::uuid; old_r := (r::jsonb -> 'renewal' ->> 'id')::uuid;
  i := pg_temp.quoted('rop1', 'acme', 'ro1', 'acme_agent2');
  o := pg_temp.id('o_rop1');
  UPDATE public.renewals SET opportunity_id = o WHERE id = old_r;
  PERFORM pg_temp.won('acme_agent2', 'o_rop1', pg_temp.qid('rop1', 'Justworks'), DATE '2027-05-01', NULL, 'Acme');
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = old_p), DATE '2027-05-01', 'the win ended the old placement');
  snap := pg_temp.snapshot('rop1', 'ro1');
  -- who may reopen: the record owner or a firm owner, not someone who merely may change it
  PERFORM pg_temp.is(pg_temp.reopen('acme_lead', 'o_rop1'), '42501: Only the opportunity''s owner or an owner of the firm can reopen it.', 'a lead of the owner''s team may change the opportunity, not reopen it');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_lead', 'o_w2', pg_temp.qid('w2', 'Justworks'), NULL, NULL, 'Acme')), 'ok', 'though they may mark it won, the level rule being theirs');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_rop1')), 'PT404', 'an agent who may not see it: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('zenith_owner', 'o_rop1')), 'PT404', 'another firm''s owner: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_removed', 'o_rop1', 1)), '42501', 'a former member');
  PERFORM pg_temp.is(pg_temp.snapshot('rop1', 'ro1'), snap, 'none of those did anything');
  -- Zenith shows everyone everything: zenith_owner may change zenith_agent's opportunity, zenith_agent2 sees it but is neither its owner nor a firm owner
  PERFORM pg_temp.account('zr', 'zenith', 'zenith_agent');
  PERFORM pg_temp.quoted('zrp', 'zenith', 'zr', 'zenith_agent');
  PERFORM pg_temp.won('zenith_agent', 'o_zrp', pg_temp.qid('zrp', 'Justworks'), NULL, NULL, 'Zenith');
  PERFORM pg_temp.is(pg_temp.reopen('zenith_agent2', 'o_zrp'), '42501: Only the opportunity''s owner or an owner of the firm can reopen it.', 'one who sees it but is not its owner nor a firm owner is refused in words');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('zenith_lead', 'o_zrp')), '42501', 'a lead likewise');
  PERFORM pg_temp.is(pg_temp.pipeline('zrp'), 'won', 'and it stays won');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('zenith_owner', 'o_zrp')), 'ok', 'a firm owner reopens another person''s opportunity');
  PERFORM pg_temp.is(pg_temp.pipeline('zrp'), 'quoted', 'to Quoted');

  -- the reopen
  r := pg_temp.reopen('acme_agent2', 'o_rop1');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the record owner reopens it: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is(pg_temp.pipeline('rop1'), 'quoted', 'the submission goes back to Quoted');
  PERFORM pg_temp.is(public.opportunity_stage(o), 'quoted', 'so does the opportunity');
  PERFORM pg_temp.is((SELECT won_quote_request_id FROM public.submission_workflow WHERE session_id = i), NULL::bigint, 'the quote is no longer chosen');
  PERFORM pg_temp.is((SELECT string_agg(q.peo_name || ':' || q.status || ':' || COALESCE(q.close_reason, '-'), ' ' ORDER BY q.peo_name) FROM public.quote_requests q WHERE q.session_id = i),
    'Gusto:declined:- Justworks:quoted:- Paychex:closed:went_elsewhere TriNet:closed:went_elsewhere', 'the winner stays quoted and the quotes the win closed stay closed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE opportunity_id = o), 0::bigint, 'the placement is deleted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE account_id = pg_temp.id('ro1') AND placement_id IS DISTINCT FROM old_p), 0::bigint, 'and the renewal the win made');
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = old_p), NULL::date, 'the placement the win ended runs again (the win that ended it is undone)');
  PERFORM pg_temp.is(public.renewal_is_done(NULL, o), false, 'and the renewal being worked is not done');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('ro1')), 'client', 'the account is a client through the old placement');
  PERFORM pg_temp.is(j -> 'record' ->> 'stage', 'quoted', 'the answer says Quoted');
  PERFORM pg_temp.is((SELECT h.from_status || '>' || h.to_status || ':' || h.changed_by::text FROM public.submission_status_history h WHERE h.session_id = i ORDER BY h.id DESC LIMIT 1),
    'won>quoted:' || pg_temp.id('acme_agent2')::text, 'the reopening is in the status history, by the person');
  PERFORM pg_temp.is(pg_temp.reopen('acme_agent2', 'o_rop1'), '22023: This opportunity isn''t won or lost.', 'a reopened one is not reopened again');
  -- and can be won again, on the quote that stayed quoted
  PERFORM pg_temp.is(pg_temp.code(pg_temp.won('acme_agent2', 'o_rop1', pg_temp.qid('rop1', 'Justworks'), DATE '2027-06-01', NULL, 'Acme')), 'ok', 'it can be won again');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE opportunity_id = o), 1::bigint, 'with one placement');
END $$;

-- Break caught: a reopen of an account's first win leaves the account a client (D-197 follows the placement, D-455).
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.account('ro2', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('rop2', 'acme', 'ro2', 'acme_agent1');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('ro2')), 'prospect', 'a prospect');
  PERFORM pg_temp.won('acme_agent1', 'o_rop2', pg_temp.qid('rop2', 'Justworks'), NULL, NULL, 'Acme');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('ro2')), 'client', 'a won opportunity makes the account a client');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_rop2')), 'ok', 'reopened');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('ro2')), 'prospect', 'the account is a prospect again: not a former client, since it has no placement left (D-469)');
END $$;

-- Break caught: a reopen deletes a win's renewal that an opportunity is now working (the next year's work loses its renewal), or runs with a version it never
-- had or a stale one; or on an opportunity that is neither won nor lost.
DO $$
DECLARE r text; snap text; o uuid; v integer; j jsonb;
BEGIN
  PERFORM pg_temp.account('ro3', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('rop3', 'acme', 'ro3', 'acme_agent1');
  o := pg_temp.id('o_rop3');
  PERFORM pg_temp.is(pg_temp.reopen('acme_agent1', 'o_rop3'), '22023: This opportunity isn''t won or lost.', 'a quoted one has nothing to reopen');
  PERFORM pg_temp.won('acme_agent1', 'o_rop3', pg_temp.qid('rop3', 'Justworks'), NULL, NULL, 'Acme');
  PERFORM pg_temp.opportunity('o_next', 'ro3', 'acme_agent1');
  UPDATE public.renewals SET opportunity_id = pg_temp.id('o_next') WHERE account_id = pg_temp.id('ro3');
  snap := pg_temp.snapshot('rop3', 'ro3');
  r := pg_temp.reopen('acme_agent1', 'o_rop3');
  PERFORM pg_temp.is(r, 'PT409: Its renewal is being worked by PEO search o_next', 'refused while the renewal is worked by an opportunity');
  PERFORM pg_temp.is(pg_temp.snapshot('rop3', 'ro3'), snap, 'and nothing was reopened');
  UPDATE public.renewals SET opportunity_id = NULL WHERE account_id = pg_temp.id('ro3');
  -- the version
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.opportunity_reopen(%L, %L, NULL)::text', o, pg_temp.id('acme'))),
    '22023: This save did not say which version of the opportunity it started from, so it was refused. Reload the page and try again.', 'no version');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_rop3', 99)), '22023', 'a version it never had');
  v := pg_temp.ver('o_rop3');
  UPDATE public.opportunities SET next_step = 'Congratulate' WHERE id = o;
  j := pg_temp.reopen('acme_agent1', 'o_rop3', v)::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'from an old version: a conflict');
  PERFORM pg_temp.is(j -> 'current' ->> 'stage', 'won', 'naming the stage it is at');
  PERFORM pg_temp.is(pg_temp.snapshot('rop3', 'ro3'), snap, 'nothing was reopened');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_rop3')), 'ok', 'from the current version it goes through');
END $$;

-- Break caught: reopening a loss goes to Quoted whatever it was lost from (D-469: the stage it was lost from, from the LAST move into Lost); reopens the closed
-- quotes; keeps the reason on the opportunity (it is cleared; the history keeps it); a loss with no intake keeps its mark.
DO $$
DECLARE r text; o uuid; i uuid; got text;
BEGIN
  PERFORM pg_temp.account('rl1', 'acme', 'acme_agent1');
  i := pg_temp.quoted('rlp1', 'acme', 'rl1', 'acme_agent1');
  o := pg_temp.id('o_rlp1');
  PERFORM pg_temp.move('rlp1', 'sent_to_carrier');   -- an advisor put it back to send to another PEO
  PERFORM pg_temp.is(pg_temp.code(pg_temp.lost('acme_agent1', 'o_rlp1', 'price', 'Too dear')), 'ok', 'lost from In market');
  r := pg_temp.reopen('acme_agent1', 'o_rlp1');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'reopened: ' || r);
  PERFORM pg_temp.is(pg_temp.pipeline('rlp1'), 'sent_to_carrier', 'back to the stage it was lost from');
  PERFORM pg_temp.is((SELECT row (lost_reason, lost_note)::text FROM public.opportunities WHERE id = o), row (NULL::text, NULL::text)::text, 'the reason and note are cleared from the opportunity');
  PERFORM pg_temp.is((SELECT string_agg(q.peo_name || ':' || q.status || ':' || COALESCE(q.close_reason, '-'), ' ' ORDER BY q.peo_name) FROM public.quote_requests q WHERE q.session_id = i),
    'Gusto:declined:- Justworks:closed:search_ended Paychex:closed:search_ended TriNet:closed:search_ended', 'closed quotes stay closed');
  SELECT string_agg(field || ':' || COALESCE(old_value #>> '{}', '-') || '>' || COALESCE(new_value #>> '{}', '-'), ' ' ORDER BY id) INTO got
    FROM public.record_history WHERE table_name = 'opportunities' AND record_key = o::text AND kind = 'changed' AND field IN ('lost_reason', 'lost_note');
  PERFORM pg_temp.is(got, 'lost_reason:->price lost_note:->Too dear lost_reason:price>- lost_note:Too dear>-', 'the history keeps the reason and its clearing');
  -- lost again from Quoted: the reopening goes to the stage of THAT loss
  PERFORM pg_temp.move('rlp1', 'quoted');
  PERFORM pg_temp.lost('acme_agent1', 'o_rlp1', 'no_decision');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_rlp1')), 'ok', 'reopened again');
  PERFORM pg_temp.is(pg_temp.pipeline('rlp1'), 'quoted', 'to the stage of the last loss');

  -- archived straight from lost, and from won (D-471): reopen restores them as above
  PERFORM pg_temp.account('rl2', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('rlp2', 'acme', 'rl2', 'acme_agent1');
  PERFORM pg_temp.lost('acme_agent1', 'o_rlp2', 'price');
  PERFORM pg_temp.move('rlp2', 'archived');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('o_rlp2')), 'lost', 'archived from lost it is still Lost');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_rlp2')), 'ok', 'reopening it');
  PERFORM pg_temp.is(pg_temp.pipeline('rlp2'), 'quoted', 'restores it to the stage it was lost from');
  PERFORM pg_temp.is((SELECT h.from_status || '>' || h.to_status FROM public.submission_status_history h WHERE h.session_id = pg_temp.id('rlp2') ORDER BY h.id DESC LIMIT 1), 'archived>quoted', 'by a move out of archived');
  PERFORM pg_temp.account('rwa2', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('rwp2', 'acme', 'rwa2', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_rwp2', pg_temp.qid('rwp2', 'Justworks'), NULL, NULL, 'Acme');
  PERFORM pg_temp.move('rwp2', 'archived');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('o_rwp2')), 'won', 'archived from won it is still Won');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_rwp2')), 'ok', 'reopening it');
  PERFORM pg_temp.is(pg_temp.pipeline('rwp2'), 'quoted', 'restores it to Quoted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE opportunity_id = pg_temp.id('o_rwp2')), 0::bigint, 'and deletes its placement');
  PERFORM pg_temp.is((SELECT won_quote_request_id FROM public.submission_workflow WHERE session_id = pg_temp.id('rwp2')), NULL::bigint, 'and un-chooses the quote');
  -- archived from any other stage has no outcome to undo: it is restored from the archive, not reopened
  PERFORM pg_temp.account('rl3', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('rlp3', 'acme', 'rl3', 'acme_agent1');
  PERFORM pg_temp.move('rlp3', 'archived');
  PERFORM pg_temp.is(pg_temp.reopen('acme_agent1', 'o_rlp3'), '22023: This opportunity was archived, not won or lost. Restore it from the archive.', 'archived from Quoted is not reopened here');
  PERFORM pg_temp.is(pg_temp.pipeline('rlp3'), 'archived', 'and stays archived');

  -- lost with no intake: the mark and the reason go
  PERFORM pg_temp.account('rl4', 'acme', 'acme_agent1');
  PERFORM pg_temp.opportunity('o_rl4', 'rl4', 'acme_agent1');
  PERFORM pg_temp.lost('acme_agent1', 'o_rl4', 'went_direct', 'Signed direct');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_rl4')), 'ok', 'reopened with no intake');
  PERFORM pg_temp.is((SELECT row (lost_at, lost_by, lost_reason, lost_note)::text FROM public.opportunities WHERE id = pg_temp.id('o_rl4')), row (NULL::timestamptz, NULL::uuid, NULL::text, NULL::text)::text, 'the mark, who and the reason are cleared');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('o_rl4')), 'qualifying', 'it is Qualifying again');
  PERFORM pg_temp.is(pg_temp.reopen('acme_agent1', 'o_rl4'), '22023: This opportunity isn''t won or lost.', 'and is not reopened again');
END $$;

-- Break caught: reopen skips the guards every write asks, or an archived account takes a reopen.
DO $$
DECLARE sess uuid; snap text;
BEGIN
  PERFORM pg_temp.account('rg1', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('rgp1', 'acme', 'rg1', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_rgp1', pg_temp.qid('rgp1', 'Justworks'), NULL, NULL, 'Acme');
  snap := pg_temp.snapshot('rgp1', 'rg1');
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('rg1');
  PERFORM pg_temp.is(pg_temp.reopen('acme_agent1', 'o_rgp1'), '55000: This account is archived. Nothing on it can be changed.', 'an archived account');
  UPDATE public.accounts SET archived_at = NULL WHERE id = pg_temp.id('rg1');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.reopen('acme_agent1', 'o_rgp1'), 6), 'PT423:', 'a closing firm reopens nothing');
  PERFORM pg_temp.is(left(pg_temp.reopen('acme_agent2', 'o_rgp1'), 6), 'PT423:', 'and the guard comes first');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an opportunity the firm asked about') t);
  PERFORM pg_temp.is(left(pg_temp.reopen('platform_admin', 'o_rgp1', 1), 6), 'PT423:', 'Nevermore support reopens nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.snapshot('rgp1', 'rg1'), snap, 'nothing changed');
END $$;

-- Break caught: "Didn't renew" is undone after the renewal's opportunity was won, which clears the old placement's end day and leaves two placements running (the old
-- one can then never end). The undo is refused in words while the renewal's working opportunity is won; the win itself is not refused (didn't renew, then won
-- elsewhere, is normal); once the win is reopened the undo works.
DO $$
DECLARE r text; old_p uuid; old_r uuid; rv integer;
BEGIN
  PERFORM pg_temp.account('rn4', 'acme', 'acme_agent1');
  r := pg_temp.add_renewal('acme_agent1', 'rn4', 'peo_placement', 'Gusto', DATE '2027-05-01', DATE '2026-05-01');
  old_p := (r::jsonb -> 'placement' ->> 'id')::uuid; old_r := (r::jsonb -> 'renewal' ->> 'id')::uuid;
  PERFORM pg_temp.quoted('rw4', 'acme', 'rn4', 'acme_agent1');
  UPDATE public.renewals SET opportunity_id = pg_temp.id('o_rw4') WHERE id = old_r;
  rv := (SELECT version FROM public.renewals WHERE id = old_r);
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.mark_renewal_not_renewed(%L, %L, %L, %L)::text', old_r, DATE '2027-02-01', pg_temp.fid('acme_agent1'), rv));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'marked Didn''t renew: ' || r);
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = old_p), DATE '2027-02-01', 'which ended the placement');
  r := pg_temp.won('acme_agent1', 'o_rw4', pg_temp.qid('rw4', 'Justworks'), DATE '2027-05-01', NULL, 'Acme');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the opportunity is won anyway (didn''t renew, then won elsewhere): ' || r);
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = old_p), DATE '2027-02-01', 'the old placement keeps its end day');
  rv := (SELECT version FROM public.renewals WHERE id = old_r);
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.undo_renewal_not_renewed(%L, %L, %L)::text', old_r, pg_temp.fid('acme_agent1'), rv));
  PERFORM pg_temp.is(r, 'PT409: This renewal was renewed by PEO search o_rw4. Reopen that win first.', 'the undo is refused in words while the opportunity is won');
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = old_p), DATE '2027-02-01', 'and the old placement stays ended');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE account_id = pg_temp.id('rn4') AND ended_on IS NULL), 1::bigint, 'one placement running');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_rw4')), 'ok', 'the win is reopened');
  rv := (SELECT version FROM public.renewals WHERE id = old_r);
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.undo_renewal_not_renewed(%L, %L, %L)::text', old_r, pg_temp.fid('acme_agent1'), rv));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'then the undo works: ' || r);
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = old_p), NULL::date, 'and the placement runs again');
END $$;

-- ---------- one way to win, lose and reopen (D-470, D-471) ----------
CREATE FUNCTION pg_temp.setst(who text, p_intake text, p_status text, p_quote bigint DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT (public.set_submission_status(%L, %L, NULL, %L)).status', pg_temp.id(p_intake), p_status, p_quote))
$$;

-- Break caught: the console's stage control (set_submission_status) still wins or loses a submission that sits on an opportunity, so a win would choose a quote
-- and write no placement, renewal or commission and a loss would keep no reason (two ways to win, two truths); lets an archived-from-won or archived-from-lost submission be restored to Submitted, losing the outcome, the placement or the reason;
-- refuses restoring a submission archived from any other stage, or a move that was fine before.
DO $$
DECLARE snap text; i uuid;
BEGIN
  PERFORM pg_temp.account('ss1', 'acme', 'acme_agent1');
  i := pg_temp.quoted('sst1', 'acme', 'ss1', 'acme_agent1');
  snap := pg_temp.snapshot('sst1', 'ss1');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst1', 'won', pg_temp.qid('sst1', 'Justworks')), '22023: Mark it won or lost on its opportunity', 'won is refused for a submission on an opportunity');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst1', 'lost'), '22023: Mark it won or lost on its opportunity', 'and lost');
  PERFORM pg_temp.is(pg_temp.snapshot('sst1', 'ss1'), snap, 'nothing moved');
  -- the other moves still work and keep their rules
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst1', 'sent_to_carrier'), 'sent_to_carrier', 'a move back to Sent to PEOs still works');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst1', 'sent_to_carrier'), 'sent_to_carrier', 'the same status is no move');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst1', 'under_review'), '22023: A submission can''t move from sent to carrier to under review. From sent to carrier it can move to: information requested, quoted, lost, archived', 'a move the pipeline does not allow still says so');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst1', 'nonsense'), '22023: Not a status an advisor can set: nonsense', 'a made-up status');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.setst('zenith_owner', 'sst1', 'archived')), 'P0002', 'another firm''s owner: not found');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst1', 'archived'), 'archived', 'archiving still works');
  -- archived from Sent to PEOs: restored to Submitted as before
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst1', 'submitted'), 'submitted', 'archived from any other stage is restored to Submitted as before');

  -- archived straight from won or from lost: restoring it is refused (the outcome lives on the opportunity)
  PERFORM pg_temp.account('ss2', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('sst2', 'acme', 'ss2', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_sst2', pg_temp.qid('sst2', 'Justworks'), NULL, NULL, 'Acme');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst2', 'archived'), 'archived', 'a won submission can be archived (D-216)');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst2', 'submitted'), '22023: Reopen it on its opportunity', 'archived from won: not restored to Submitted');
  PERFORM pg_temp.is(pg_temp.pipeline('sst2'), 'archived', 'it stays archived');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE opportunity_id = pg_temp.id('o_sst2')), 1::bigint, 'with its placement');
  PERFORM pg_temp.account('ss3', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('sst3', 'acme', 'ss3', 'acme_agent1');
  PERFORM pg_temp.lost('acme_agent1', 'o_sst3', 'price');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst3', 'archived'), 'archived', 'a lost submission can be archived');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst3', 'submitted'), '22023: Reopen it on its opportunity', 'archived from lost: not restored to Submitted');
  PERFORM pg_temp.is((SELECT lost_reason FROM public.opportunities WHERE id = pg_temp.id('o_sst3')), 'price', 'with its reason');
  -- reopening is the way back
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_sst3')), 'ok', 'reopening restores it');
  PERFORM pg_temp.is(pg_temp.pipeline('sst3'), 'quoted', 'to the stage it was lost from');
  -- the reopened one can be archived and restored by the old call: it was archived from Quoted, which has no outcome to undo
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst3', 'archived'), 'archived', 'archived again');
  PERFORM pg_temp.is(pg_temp.setst('acme_agent1', 'sst3', 'submitted'), 'submitted', 'now restored from the archive as before');
  -- a closing firm still refuses first
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.setst('acme_agent1', 'sst3', 'under_review'), 6), 'PT423:', 'a closing firm still moves nothing');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
END $$;

-- ---------- commission payments (Q-4.1, D-467, D-407) ----------
CREATE FUNCTION pg_temp.pay(who text, p_placement text, p_on date, p_amount numeric, p_note text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.record_commission_payment(%L, %L, %L, %L, %L)::text', pg_temp.id(p_placement), p_on, p_amount, p_note, pg_temp.fid(who)))
$$;
CREATE FUNCTION pg_temp.payver(n text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT version FROM public.commission_payments WHERE id = pg_temp.id(n) $$;
CREATE FUNCTION pg_temp.payupd(who text, p_payment text, p_on date, p_amount numeric, p_note text, p_version integer) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.update_commission_payment(%L, %L, %L, %L, %L, %L)::text', pg_temp.id(p_payment), p_on, p_amount, p_note, pg_temp.fid(who), p_version))
$$;
CREATE FUNCTION pg_temp.paydel(who text, p_payment text, p_version integer) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.delete_commission_payment(%L, %L, %L)::text', pg_temp.id(p_payment), pg_temp.fid(who), p_version))
$$;

-- Break caught: the table can be written through the API (D-407); is read by a signed-out caller; has no row security; takes a payment of one firm on another's
-- account or on another account's placement; keeps an amount of zero or less, a note over 500 characters or a blank one.
DO $$
DECLARE r text; pl uuid;
BEGIN
  PERFORM pg_temp.account('cp1', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('cpq1', 'acme', 'cp1', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_cpq1', pg_temp.qid('cpq1', 'Justworks'), NULL, NULL, 'Acme', NULL, 'share', 20, 12000);
  INSERT INTO fx SELECT 'pl_cp1', id FROM public.placements WHERE opportunity_id = pg_temp.id('o_cpq1');
  pl := pg_temp.id('pl_cp1');
  PERFORM pg_temp.is(has_table_privilege('authenticated', 'public.commission_payments', 'INSERT') OR has_table_privilege('authenticated', 'public.commission_payments', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.commission_payments', 'DELETE') OR has_table_privilege('authenticated', 'public.commission_payments', 'TRUNCATE'), false, 'no API role writes payments');
  PERFORM pg_temp.is(has_table_privilege('service_role', 'public.commission_payments', 'INSERT') OR has_table_privilege('service_role', 'public.commission_payments', 'UPDATE')
    OR has_table_privilege('service_role', 'public.commission_payments', 'DELETE'), false, 'nor the service role');
  PERFORM pg_temp.is(has_table_privilege('authenticated', 'public.commission_payments', 'SELECT'), true, 'a signed-in caller may ask to read them');
  PERFORM pg_temp.is(has_table_privilege('anon', 'public.commission_payments', 'SELECT'), false, 'a signed-out caller reads none');
  PERFORM pg_temp.is((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.commission_payments'::regclass), true, 'row security is on');
  r := pg_temp.attempt(format($q$INSERT INTO public.commission_payments (firm_id, account_id, placement_id, received_on, amount) VALUES (%L, %L, %L, current_date, 10)$q$, pg_temp.id('zenith'), pg_temp.id('cp1'), pl));
  PERFORM pg_temp.is(r, '23503', 'a payment of one firm can''t sit on another firm''s account');
  r := pg_temp.attempt(format($q$INSERT INTO public.commission_payments (firm_id, account_id, placement_id, received_on, amount) VALUES (%L, %L, %L, current_date, 10)$q$, pg_temp.id('acme'), pg_temp.id('a2'), pl));
  PERFORM pg_temp.is(r, '23503', 'nor on another account''s placement');
  r := pg_temp.attempt(format($q$INSERT INTO public.commission_payments (firm_id, account_id, placement_id, received_on, amount) VALUES (%L, %L, %L, current_date, 0)$q$, pg_temp.id('acme'), pg_temp.id('cp1'), pl));
  PERFORM pg_temp.is(r, '23514', 'an amount of zero');
  r := pg_temp.attempt(format($q$INSERT INTO public.commission_payments (firm_id, account_id, placement_id, received_on, amount, note) VALUES (%L, %L, %L, current_date, 5, %L)$q$, pg_temp.id('acme'), pg_temp.id('cp1'), pl, repeat('n', 501)));
  PERFORM pg_temp.is(r, '23514', 'a note of 501');
  r := pg_temp.attempt(format($q$INSERT INTO public.commission_payments (firm_id, account_id, placement_id, received_on, amount, note) VALUES (%L, %L, %L, current_date, 5, '')$q$, pg_temp.id('acme'), pg_temp.id('cp1'), pl));
  PERFORM pg_temp.is(r, '23514', 'a blank note');
END $$;

-- Break caught: a payment is recorded by someone who may see the opportunity but not change it (D-467: whoever may change the opportunity), or by one who may
-- not see it; the fields are not held to their limits; the amount or date is not what was sent; the answer does not say what has been received to date against
-- what is expected; the first version is not 1.
DO $$
DECLARE r text; j jsonb; pl uuid := pg_temp.id('pl_cp1');
BEGIN
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('acme_agent2', 'pl_cp1', current_date, 100)), 'PT404', 'someone who may not see the account: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('zenith_owner', 'pl_cp1', current_date, 100)), 'PT404', 'another firm''s owner: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('acme_removed', 'pl_cp1', current_date, 100)), '42501', 'a former member');
  -- Zenith shows everyone everything: zenith_agent2 sees zenith_agent's placement and may not change it
  INSERT INTO fx SELECT 'pl_zr', id FROM public.placements WHERE opportunity_id = pg_temp.id('o_zrp');
  PERFORM pg_temp.won('zenith_agent', 'o_zrp', pg_temp.qid('zrp', 'Justworks'), NULL, NULL, 'Zenith');
  INSERT INTO fx SELECT 'pl_zr', id FROM public.placements WHERE opportunity_id = pg_temp.id('o_zrp') ON CONFLICT DO NOTHING;
  PERFORM pg_temp.is(pg_temp.pay('zenith_agent2', 'pl_zr', current_date, 100), '42501: Only the opportunity''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'one who sees but may not change it is refused in words');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('zenith_agent', 'pl_zr', current_date, 100)), 'ok', 'the opportunity''s owner records one');
  PERFORM pg_temp.is(pg_temp.pay('acme_agent1', 'pl_cp1', NULL, 100), '22023: Give the date it was received.', 'no date');
  PERFORM pg_temp.is(pg_temp.pay('acme_agent1', 'pl_cp1', current_date, NULL), '22023: Give the amount received.', 'no amount');
  PERFORM pg_temp.is(pg_temp.pay('acme_agent1', 'pl_cp1', current_date, 0), '22023: The amount must be more than zero.', 'an amount of zero');
  PERFORM pg_temp.is(pg_temp.pay('acme_agent1', 'pl_cp1', current_date, -5), '22023: The amount must be more than zero.', 'a negative amount');
  PERFORM pg_temp.is(pg_temp.pay('acme_agent1', 'pl_cp1', current_date, 10.005), '22023: Keep the amount to cents.', 'a fraction of a cent');
  PERFORM pg_temp.is(pg_temp.pay('acme_agent1', 'pl_cp1', current_date, 1000000000000), '22023: That amount is too large.', 'an amount too large to keep');
  PERFORM pg_temp.is(pg_temp.pay('acme_agent1', 'pl_cp1', current_date, 10, repeat('n', 501)), '22023: Keep the note to 500 characters.', 'a note of 501');
  PERFORM pg_temp.is((SELECT count(*) FROM public.commission_payments WHERE placement_id = pl), 0::bigint, 'none of those was saved');
  r := pg_temp.pay('acme_agent1', 'pl_cp1', DATE '2027-06-15', 3000.50, '  First month  ');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner records a payment: ' || r);
  j := r::jsonb;
  INSERT INTO fx VALUES ('cpay1', (j -> 'payment' ->> 'id')::uuid);
  PERFORM pg_temp.is((SELECT row (received_on, amount, note, placement_id, account_id, firm_id, version)::text FROM public.commission_payments WHERE id = pg_temp.id('cpay1')),
    row (DATE '2027-06-15', 3000.50::numeric, 'First month', pl, pg_temp.id('cp1'), pg_temp.id('acme'), 1)::text, 'kept as sent, the note trimmed, on the placement''s account, a first version');
  PERFORM pg_temp.is((j ->> 'received_to_date')::numeric, 3000.50::numeric, 'the answer says what has been received to date');
  PERFORM pg_temp.is((j ->> 'expected_yearly')::numeric, 12000::numeric, 'against what is expected a year');
  r := pg_temp.pay('acme_agent1', 'pl_cp1', DATE '2027-07-15', 3000);
  INSERT INTO fx VALUES ('cpay2', (r::jsonb -> 'payment' ->> 'id')::uuid);
  PERFORM pg_temp.is((r::jsonb ->> 'received_to_date')::numeric, 6000.50::numeric, 'and adds the next');
  -- an owner of the firm records one on another person's opportunity
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('acme_owner', 'pl_cp1', DATE '2027-08-15', 1)), 'ok', 'an owner of the firm may');
  DELETE FROM public.commission_payments WHERE placement_id = pl AND amount = 1;
END $$;

-- Break caught: an edit saved without looking at the version, or from one it never had; a conflict that names nothing; an edit by someone who may only see; a delete
-- that does not take the version; the money recorded in history without who and what.
DO $$
DECLARE r text; j jsonb; acme uuid := pg_temp.id('acme'); v integer;
BEGIN
  r := pg_temp.payupd('acme_agent1', 'cpay1', DATE '2027-06-16', 3100, 'Corrected', 1);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner edits a payment');
  j := r::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, false, 'no conflict');
  PERFORM pg_temp.is((SELECT row (received_on, amount, note, version)::text FROM public.commission_payments WHERE id = pg_temp.id('cpay1')), row (DATE '2027-06-16', 3100.00::numeric, 'Corrected', 2)::text, 'saved, a new version');
  PERFORM pg_temp.is((j -> 'record' ->> 'id'), pg_temp.id('cpay1')::text, 'the answer is the record');
  PERFORM pg_temp.is((j ->> 'received_to_date')::numeric, 6100::numeric, 'with what has been received to date');
  j := pg_temp.payupd('acme_agent1', 'cpay1', DATE '2027-06-17', 1, NULL, 1)::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'from an old version: a conflict');
  PERFORM pg_temp.is((j ->> 'currentVersion')::int, 2, 'naming the version it is at');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',' ORDER BY c ->> 'field') FROM jsonb_array_elements(j -> 'changed') c), 'amount,note,received_on', 'and what the other save changed');
  PERFORM pg_temp.is((SELECT amount FROM public.commission_payments WHERE id = pg_temp.id('cpay1')), 3100.00::numeric, 'nothing was saved');
  PERFORM pg_temp.is(pg_temp.payupd('acme_agent1', 'cpay1', DATE '2027-06-17', 1, NULL, NULL), '22023: This save did not say which version of the payment it started from, so it was refused. Reload the page and try again.', 'no version');
  PERFORM pg_temp.is(pg_temp.payupd('acme_agent1', 'cpay1', DATE '2027-06-17', 1, NULL, 9), '22023: This save names a version of the payment that does not exist, so it was refused. Reload the page and try again.', 'a version it never had');
  PERFORM pg_temp.is(pg_temp.payupd('acme_agent1', 'cpay1', DATE '2027-06-17', 0, NULL, 2), '22023: The amount must be more than zero.', 'the fields are held to the same limits');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.payupd('acme_agent2', 'cpay1', DATE '2027-06-17', 5, NULL, 2)), 'PT404', 'someone who may not see it: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.payupd('zenith_agent2', 'cpay1', DATE '2027-06-17', 5, NULL, 2)), 'PT404', 'another firm: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.payupd('acme_agent1', 'a1', DATE '2027-06-17', 5, NULL, 2)), 'PT404', 'an id that is no payment');

  -- history: who and what, in the domain the history knows
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((SELECT string_agg(kind || ':' || COALESCE(field, ''), ',' ORDER BY kind DESC, field) FROM public.record_history_list(acme, 'commission_payments', pg_temp.id('cpay1')::text)),
    'created:,changed:amount,changed:note,changed:received_on', 'the payment''s history: made, then each field changed');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'commission_payments', %L)$q$, acme, pg_temp.id('cpay1')::text)), 'rows:4', 'the owner of the account reads it');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'commission_payments', %L)$q$, acme, pg_temp.id('cpay1')::text)), 'PT404', 'another agent may not read it');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'commission_payments', %L)$q$, pg_temp.id('zenith'), pg_temp.id('cpay1')::text)), 'PT404', 'another firm''s owner finds nothing');
  RESET ROLE;
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'commission_payments', pg_temp.id('cpay1')::text), true, 'a payment that is there exists');
  PERFORM pg_temp.is(public.record_history_record_exists(pg_temp.id('zenith'), 'commission_payments', pg_temp.id('cpay1')::text), false, 'not in another firm');
  -- the history's earlier branches still answer (the history helpers were extended, not replaced)
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'placements', pg_temp.id('pl_cp1')::text), true, 'a placement still exists to the history');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'renewals', gen_random_uuid()::text), false, 'a renewal that is not there does not');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'accounts', pg_temp.id('cp1')::text), true, 'an account still exists to it');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'contacts', gen_random_uuid()::text), false, 'a contact that is not there does not');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'opportunities', pg_temp.id('o_cpq1')::text), true, 'an opportunity still exists to it');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'referral_partners', 'nobody'), false, 'a partner that is not there does not');
  PERFORM pg_temp.claims_of('acme_agent1');
  PERFORM pg_temp.is(public.record_history_can_see(acme, 'accounts', pg_temp.id('cp1')::text), true, 'the owner still sees an account''s history');
  PERFORM pg_temp.is(public.record_history_can_see(acme, 'opportunities', pg_temp.id('o_cpq1')::text), true, 'an opportunity''s');
  PERFORM pg_temp.is(public.record_history_can_see(acme, 'placements', pg_temp.id('pl_cp1')::text), true, 'a placement''s');
  PERFORM pg_temp.is(public.record_history_can_see(acme, 'commission_payments', pg_temp.id('cpay1')::text), true, 'and a payment''s');
  RESET ROLE;

  -- delete from the version
  v := pg_temp.payver('cpay2');
  PERFORM pg_temp.is(pg_temp.paydel('acme_agent1', 'cpay2', NULL), '22023: This save did not say which version of the payment it started from, so it was refused. Reload the page and try again.', 'a delete with no version');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.paydel('acme_agent2', 'cpay2', v)), 'PT404', 'someone who may not see it: not there');
  PERFORM pg_temp.is((pg_temp.paydel('acme_agent1', 'cpay2', v + 1)), '22023: This save names a version of the payment that does not exist, so it was refused. Reload the page and try again.', 'a version it never had');
  UPDATE public.commission_payments SET note = 'Changed elsewhere' WHERE id = pg_temp.id('cpay2');
  j := pg_temp.paydel('acme_agent1', 'cpay2', v)::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'a delete from an old version is a conflict');
  PERFORM pg_temp.is((SELECT count(*) FROM public.commission_payments WHERE id = pg_temp.id('cpay2')), 1::bigint, 'and deleted nothing');
  j := pg_temp.paydel('acme_agent1', 'cpay2', pg_temp.payver('cpay2'))::jsonb;
  PERFORM pg_temp.is((j ->> 'deleted')::boolean, true, 'from the current version it is deleted');
  PERFORM pg_temp.is((j ->> 'received_to_date')::numeric, 3100::numeric, 'the answer says what has been received to date');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'commission_payments' AND h.record_key = pg_temp.id('cpay2')::text), 0::bigint, 'and its history went with it');
END $$;

-- Break caught: a payment can be recorded on a placement the firm made by hand (D-467: commission is recorded on a placement won from an opportunity; a hand-made
-- one has none), or the refusal is not in words, or comes before the questions of who may see and change the account; a hand-made placement that was refused its
-- payment can then not be deleted with its renewal; a payment on an archived account; or by a closing firm or Nevermore support (ADR 0023, ADR 0024).
DO $$
DECLARE r text; sess uuid; n bigint; pl uuid; rid text;
BEGIN
  PERFORM pg_temp.account('cp2', 'acme', 'acme_agent2');
  r := pg_temp.add_renewal('acme_agent2', 'cp2', 'peo_placement', 'Gusto', DATE '2027-05-01', DATE '2026-05-01');
  INSERT INTO fx VALUES ('pl_hand', (r::jsonb -> 'placement' ->> 'id')::uuid);
  PERFORM pg_temp.is(pg_temp.pay('acme_agent2', 'pl_hand', current_date, 50), 'PT409: Commission is recorded on a placement won from an opportunity', 'money received on a placement made by hand is refused in words, even for the account''s owner');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('acme_agent1', 'pl_hand', current_date, 50)), 'PT404', 'one who may not see it still finds nothing');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('acme_lead', 'pl_hand', current_date, 50)), 'PT409', 'a lead of the owner''s team is refused as well');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('acme_owner', 'pl_hand', current_date, 50)), 'PT409', 'and an owner of the firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.commission_payments WHERE placement_id = pg_temp.id('pl_hand')), 0::bigint, 'none was recorded');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('zenith_agent2', 'pl_zr', current_date, 50)), '42501', 'one who may only see the account may not');
  -- Zenith shows everyone everything: zenith_agent2 sees a placement made by hand on zenith_agent's account and may not record money on it
  r := pg_temp.add_renewal('zenith_agent', 'z1', 'peo_placement', 'Gusto', DATE '2027-05-01', DATE '2026-05-01');
  INSERT INTO fx VALUES ('pl_zhand', (r::jsonb -> 'placement' ->> 'id')::uuid);
  PERFORM pg_temp.is(pg_temp.pay('zenith_agent2', 'pl_zhand', current_date, 50), '42501: Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'a placement made by hand: one who sees its account but may not change it is refused in words');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('zenith_agent', 'pl_zhand', current_date, 50)), 'PT409', 'its account''s owner is refused: there is no opportunity');
  -- an account with no owner: an owner of the firm only
  r := pg_temp.add_renewal('acme_owner', 'a3', 'peo_placement', 'Gusto', DATE '2027-05-01', DATE '2026-05-01');
  INSERT INTO fx VALUES ('pl_nohand', (r::jsonb -> 'placement' ->> 'id')::uuid);
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('acme_agent1', 'pl_nohand', current_date, 50)), 'PT404', 'an agent does not see an account with no owner');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.pay('acme_owner', 'pl_nohand', current_date, 50)), 'PT409', 'an owner of the firm is refused: there is no opportunity');
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('cp2');
  PERFORM pg_temp.is(pg_temp.pay('acme_agent2', 'pl_hand', current_date, 50), '55000: This account is archived. Nothing on it can be changed.', 'an archived account takes no payment');
  UPDATE public.accounts SET archived_at = NULL WHERE id = pg_temp.id('cp2');
  -- the refused hand-made placement is deleted with its renewal as before
  r := pg_temp.as_call('acme_agent2', 'acme-brokers', format('SELECT public.delete_renewal(%L, %L, %L)::text', (SELECT id FROM public.renewals WHERE placement_id = pg_temp.id('pl_hand')), pg_temp.fid('acme_agent2'),
    (SELECT version FROM public.renewals WHERE placement_id = pg_temp.id('pl_hand'))));
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a renewal added by hand is still deleted with its placement: ' || r);
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE id = pg_temp.id('pl_hand')), 0::bigint, 'the placement went with it');
  n := (SELECT count(*) FROM public.commission_payments);
  rid := pg_temp.id('cpay1')::text;
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.pay('acme_owner', 'pl_cp1', current_date, 5), 6), 'PT423:', 'a closing firm records nothing');
  PERFORM pg_temp.is(left(pg_temp.payupd('acme_owner', 'cpay1', current_date, 5, NULL, pg_temp.payver('cpay1')), 6), 'PT423:', 'edits nothing');
  PERFORM pg_temp.is(left(pg_temp.paydel('acme_owner', 'cpay1', pg_temp.payver('cpay1')), 6), 'PT423:', 'deletes nothing');
  PERFORM pg_temp.is(left(pg_temp.pay('acme_agent2', 'pl_cp1', current_date, 5), 6), 'PT423:', 'and the guard comes before the rule that hides it');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at a placement the firm asked about') t);
  PERFORM pg_temp.is(left(pg_temp.pay('platform_admin', 'pl_cp1', current_date, 5), 6), 'PT423:', 'Nevermore support records nothing');
  PERFORM pg_temp.is(left(pg_temp.payupd('platform_admin', 'cpay1', current_date, 5, NULL, 1), 6), 'PT423:', 'edits nothing');
  PERFORM pg_temp.is(left(pg_temp.paydel('platform_admin', 'cpay1', 1), 6), 'PT423:', 'deletes nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.commission_payments), n, 'nothing changed');
END $$;

-- Break caught: reopening a win deletes its money records (D-469: refused while the placement has commission payments, so no money record is lost), or the
-- refusal leaves the submission reopened; deleting the payments does not free it.
DO $$
DECLARE r text; snap text;
BEGIN
  PERFORM pg_temp.account('cp3', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('cpq3', 'acme', 'cp3', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_cpq3', pg_temp.qid('cpq3', 'Justworks'), NULL, NULL, 'Acme');
  INSERT INTO fx SELECT 'pl_cp3', id FROM public.placements WHERE opportunity_id = pg_temp.id('o_cpq3');
  r := pg_temp.pay('acme_agent1', 'pl_cp3', current_date, 250);
  INSERT INTO fx VALUES ('cpay3', (r::jsonb -> 'payment' ->> 'id')::uuid);
  snap := pg_temp.snapshot('cpq3', 'cp3');
  PERFORM pg_temp.is(pg_temp.reopen('acme_agent1', 'o_cpq3'), 'PT409: Delete its payments first', 'a win with payments is not reopened');
  PERFORM pg_temp.is(pg_temp.snapshot('cpq3', 'cp3'), snap, 'and nothing was reopened');
  PERFORM pg_temp.paydel('acme_agent1', 'cpay3', pg_temp.payver('cpay3'));
  PERFORM pg_temp.is(pg_temp.code(pg_temp.reopen('acme_agent1', 'o_cpq3')), 'ok', 'with its payments deleted it is');
END $$;

-- ---------- adding or changing a placement's commission later (D-466) ----------
CREATE FUNCTION pg_temp.setcom(who text, p_placement text, p_version integer, p_basis text, p_rate numeric, p_yearly numeric) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.set_placement_commission(p_placement_id => %L, p_firm_id => %L, p_version => %L, p_basis => %L, p_rate => %L, p_expected_yearly => %L)::text',
    pg_temp.id(p_placement), pg_temp.fid(who), p_version, p_basis, p_rate, p_yearly))
$$;
CREATE FUNCTION pg_temp.plver(n text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT version FROM public.placements WHERE id = pg_temp.id(n) $$;
-- Break caught: a win made with no commission can never get one (D-466: it can be added later), or a change is saved with no version, from one it never had or a
-- stale one (a second person's change overwritten, a conflict that names nothing); the values are not held to the win's limits; it is open to anyone who sees
-- the opportunity (whoever may change the opportunity it was won on only), or to a placement made by hand (no opportunity: PT409); an archived account takes one;
-- a closing firm or Nevermore support makes one; the commission is not cleared by sending nothing; the change is not in the placement's history.
DO $$
DECLARE r text; j jsonb; v integer; sess uuid; acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.account('sc1', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('scq1', 'acme', 'sc1', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_scq1', pg_temp.qid('scq1', 'Justworks'), NULL, NULL, 'Acme');
  INSERT INTO fx SELECT 'pl_sc1', id FROM public.placements WHERE opportunity_id = pg_temp.id('o_scq1');
  v := pg_temp.plver('pl_sc1');
  PERFORM pg_temp.is(v, 1, 'a win with no commission: version 1');
  -- who
  PERFORM pg_temp.is(pg_temp.code(pg_temp.setcom('acme_agent2', 'pl_sc1', v, 'flat', 9000, NULL)), 'PT404', 'someone who may not see it: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.setcom('zenith_owner', 'pl_sc1', v, 'flat', 9000, NULL)), 'PT404', 'another firm''s owner: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.setcom('acme_removed', 'pl_sc1', v, 'flat', 9000, NULL)), '42501', 'a former member');
  PERFORM pg_temp.is(pg_temp.setcom('zenith_agent2', 'pl_zr', pg_temp.plver('pl_zr'), 'flat', 9000, NULL), '42501: Only the opportunity''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'one who sees but may not change it is refused in words');
  -- the fields and the version
  PERFORM pg_temp.is(pg_temp.setcom('acme_agent1', 'pl_sc1', v, NULL, 5, NULL), '22023: Choose how the commission is worked out.', 'a number with no basis');
  PERFORM pg_temp.is(pg_temp.setcom('acme_agent1', 'pl_sc1', v, 'share', 101, NULL), '22023: A share is a percent: 100 at most.', 'a share above 100');
  PERFORM pg_temp.is(pg_temp.setcom('acme_agent1', 'pl_sc1', v, 'flat', 9000, 100.005), '22023: Keep the expected commission to cents.', 'a yearly figure with a fraction of a cent');
  PERFORM pg_temp.is(pg_temp.setcom('acme_agent1', 'pl_sc1', NULL, 'flat', 9000, NULL), '22023: This save did not say which version of the placement it started from, so it was refused. Reload the page and try again.', 'no version');
  PERFORM pg_temp.is(pg_temp.setcom('acme_agent1', 'pl_sc1', 9, 'flat', 9000, NULL), '22023: This save names a version of the placement that does not exist, so it was refused. Reload the page and try again.', 'a version it never had');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.setcom('acme_agent1', 'a1', v, 'flat', 9000, NULL)), 'PT404', 'an id that is no placement');
  PERFORM pg_temp.is((SELECT commission_basis FROM public.placements WHERE id = pg_temp.id('pl_sc1')), NULL::text, 'none of those saved');
  -- set it
  r := pg_temp.setcom('acme_agent1', 'pl_sc1', v, 'share', 20, 12000);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner adds the commission later: ' || r);
  j := r::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, false, 'no conflict');
  PERFORM pg_temp.is((SELECT row (commission_basis, commission_rate, commission_expected_yearly, version)::text FROM public.placements WHERE id = pg_temp.id('pl_sc1')),
    row ('share'::text, 20.00::numeric, 12000.00::numeric, 2)::text, 'kept as sent, a new version');
  PERFORM pg_temp.is(j -> 'record' ->> 'commission_basis', 'share', 'the answer is the placement as the screens read it');
  PERFORM pg_temp.is((j -> 'record' ->> 'version')::int, 2, 'at its new version');
  -- stale
  j := pg_temp.setcom('acme_agent1', 'pl_sc1', 1, 'flat', 5000, NULL)::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'from an old version: a conflict');
  PERFORM pg_temp.is((j ->> 'currentVersion')::int, 2, 'naming the version it is at');
  PERFORM pg_temp.is((j -> 'current' ->> 'commission_basis') || ':' || (j -> 'current' ->> 'commission_rate'), 'share:20.00', 'and what it holds now');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',' ORDER BY c ->> 'field') FROM jsonb_array_elements(j -> 'changed') c), 'commission_basis,commission_expected_yearly,commission_rate', 'and what the other save changed');
  PERFORM pg_temp.is((SELECT commission_basis FROM public.placements WHERE id = pg_temp.id('pl_sc1')), 'share', 'nothing was saved');
  -- change a part, then clear it all
  PERFORM pg_temp.is(pg_temp.code(pg_temp.setcom('acme_owner', 'pl_sc1', 2, 'flat', 9000, NULL)), 'ok', 'an owner of the firm changes the basis and drops the yearly figure');
  PERFORM pg_temp.is((SELECT row (commission_basis, commission_rate, commission_expected_yearly)::text FROM public.placements WHERE id = pg_temp.id('pl_sc1')), row ('flat'::text, 9000.00::numeric, NULL::numeric)::text, 'as sent');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.setcom('acme_agent1', 'pl_sc1', 3, NULL, NULL, NULL)), 'ok', 'sending nothing clears the commission');
  PERFORM pg_temp.is((SELECT row (commission_basis, commission_rate, commission_expected_yearly, version)::text FROM public.placements WHERE id = pg_temp.id('pl_sc1')), row (NULL::text, NULL::numeric, NULL::numeric, 4)::text, 'all three empty');
  -- history
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'placements' AND record_key = pg_temp.id('pl_sc1')::text AND kind = 'changed' AND field = 'commission_rate'), 3::bigint, 'each change to the rate is in the placement''s history');
  -- a placement made by hand has no opportunity
  PERFORM pg_temp.account('sc2', 'acme', 'acme_agent1');
  r := pg_temp.add_renewal('acme_agent1', 'sc2', 'peo_placement', 'Gusto', DATE '2027-05-01', DATE '2026-05-01');
  INSERT INTO fx VALUES ('pl_sc2', (r::jsonb -> 'placement' ->> 'id')::uuid);
  PERFORM pg_temp.is(pg_temp.setcom('acme_agent1', 'pl_sc2', 1, 'flat', 9000, NULL), 'PT409: Commission is recorded on a placement won from an opportunity', 'a placement made by hand is refused in words');
  -- archived, closing, support
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('sc1');
  PERFORM pg_temp.is(pg_temp.setcom('acme_agent1', 'pl_sc1', 4, 'flat', 9000, NULL), '55000: This account is archived. Nothing on it can be changed.', 'an archived account takes none');
  UPDATE public.accounts SET archived_at = NULL WHERE id = pg_temp.id('sc1');
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (acme, pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.setcom('acme_owner', 'pl_sc1', 4, 'flat', 9000, NULL), 6), 'PT423:', 'a closing firm sets nothing');
  PERFORM pg_temp.is(left(pg_temp.setcom('acme_agent2', 'pl_sc1', 4, 'flat', 9000, NULL), 6), 'PT423:', 'and the guard comes before the rule that hides it');
  DELETE FROM public.firm_closures WHERE firm_id = acme;
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(acme, 'Looking at a placement the firm asked about') t);
  PERFORM pg_temp.is(left(pg_temp.setcom('platform_admin', 'pl_sc1', 4, 'flat', 9000, NULL), 6), 'PT423:', 'Nevermore support sets nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  PERFORM pg_temp.is((SELECT version FROM public.placements WHERE id = pg_temp.id('pl_sc1')), 4, 'nothing changed');
END $$;

-- An account's status as the accounts table reads it for its owner (searched by the account's name).
CREATE FUNCTION pg_temp.row_status(n text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  r := pg_temp.as_call('acme_owner', 'acme-brokers', format('SELECT (public.accounts_list(%L, ''[]'', NULL, ''asc'', 1, %L, ''UTC'') -> ''rows'' -> 0 ->> ''status'')', pg_temp.id('acme'), n));
  RETURN r;
END $$;

-- ---------- history and version (D-473, D-407) ----------
-- Break caught: won, lost and reopening are not in the opportunity's history with who (D-473); lost's reason and the placement's commission are not tracked
-- fields (a change to either moves no version and has no entry); the opportunity's earlier tracked fields were dropped by the new list (a restated copy of an
-- older list); the history of a payment is not readable through the history list.
DO $$
DECLARE o uuid; r text; acme uuid := pg_temp.id('acme'); got text; pl uuid;
BEGIN
  PERFORM pg_temp.account('hs1', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('hsq1', 'acme', 'hs1', 'acme_agent1');
  o := pg_temp.id('o_hsq1');
  PERFORM pg_temp.won('acme_agent1', 'o_hsq1', pg_temp.qid('hsq1', 'Justworks'), NULL, NULL, 'Acme', NULL, 'per_employee', 4.50, 2160);
  PERFORM pg_temp.reopen('acme_agent1', 'o_hsq1');
  PERFORM pg_temp.won('acme_agent1', 'o_hsq1', pg_temp.qid('hsq1', 'Justworks'), NULL, NULL, 'Acme');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  SELECT string_agg(h.field || ':' || COALESCE(h.from_value #>> '{}', '-') || '>' || COALESCE(h.to_value #>> '{}', '-') || ':' || h.who_kind, ' ' ORDER BY h.field || ':' || COALESCE(h.from_value #>> '{}', '-') || '>' || COALESCE(h.to_value #>> '{}', '-')) INTO got
    FROM public.record_history_list(acme, 'opportunities', o::text) h WHERE h.kind = 'stage_changed' AND h.who_kind = 'member';
  RESET ROLE;
  PERFORM pg_temp.is(got, 'stage:quoted>won:member stage:quoted>won:member stage:won>quoted:member', 'won, the reopening and the second win are in the opportunity''s history, by a member');
  PERFORM pg_temp.is((SELECT count(*) FROM public.submission_status_history WHERE session_id = pg_temp.id('hsq1') AND changed_by = pg_temp.id('acme_agent1') AND to_status IN ('won', 'quoted')), 3::bigint, 'each move names the person who made it');
  -- D-473: the quote taken is in the history, by the cause the history list already carries (cause and the PEO's name, no id)
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((SELECT string_agg(h.cause || ':' || h.cause_peo, ' ') FROM public.record_history_list(acme, 'opportunities', o::text) h WHERE h.kind = 'stage_changed' AND h.to_value #>> '{}' = 'won'),
    'quote_taken:Justworks quote_taken:Justworks', 'each win in the opportunity''s history says the quote taken, and its PEO');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'opportunities', o::text) h WHERE h.kind = 'stage_changed' AND h.to_value #>> '{}' <> 'won' AND h.cause IS NOT NULL), 0::bigint, 'and the reopening, which no quote caused, says none');
  RESET ROLE;
  -- the commission and the reason are tracked fields
  PERFORM pg_temp.is((SELECT version FROM public.placements WHERE opportunity_id = o), 1, 'a placement made by a win starts at version 1');
  pl := (SELECT id FROM public.placements WHERE opportunity_id = o);
  UPDATE public.placements SET commission_basis = 'flat', commission_rate = 9000, commission_expected_yearly = 9000 WHERE id = pl;
  PERFORM pg_temp.is((SELECT version FROM public.placements WHERE id = pl), 2, 'commission added later moves the version');
  SELECT string_agg(field, ',' ORDER BY field) INTO got FROM public.record_history WHERE table_name = 'placements' AND record_key = pl::text AND kind = 'changed';
  PERFORM pg_temp.is(got, 'commission_basis,commission_expected_yearly,commission_rate', 'and is in the placement''s history');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'placements' AND record_key = pl::text AND kind = 'created'), 1::bigint, 'with its making');
  -- the opportunity's own earlier fields are still tracked: each one moves the version and writes an entry
  FOR got IN SELECT unnest(ARRAY['name', 'target_start', 'employees', 'main_contact_id', 'expected_close', 'value', 'source', 'next_step', 'account_id', 'owner_id', 'lost_at', 'lost_by', 'lost_reason', 'lost_note']) LOOP
    PERFORM pg_temp.is((SELECT count(*) FROM pg_trigger t, regexp_matches(pg_get_triggerdef(t.oid), '''' || got || '''') m WHERE t.tgrelid = 'public.opportunities'::regclass AND t.tgname = 'opportunities_version'), 1::bigint,
      'the opportunity''s version watches ' || got);
    PERFORM pg_temp.is((SELECT count(*) FROM pg_trigger t, regexp_matches(pg_get_triggerdef(t.oid), '''' || got || '''') m WHERE t.tgrelid = 'public.opportunities'::regclass AND t.tgname LIKE 'opportunities%history%'), 1::bigint,
      'and so does its history: ' || got);
  END LOOP;
  FOR got IN SELECT unnest(ARRAY['peo_name', 'start_date', 'broker_of_record', 'ended_on', 'commission_basis', 'commission_rate', 'commission_expected_yearly']) LOOP
    PERFORM pg_temp.is((SELECT count(*) FROM pg_trigger t, regexp_matches(pg_get_triggerdef(t.oid), '''' || got || '''') m WHERE t.tgrelid = 'public.placements'::regclass AND t.tgname = 'placements_version'), 1::bigint,
      'the placement''s version watches ' || got);
  END LOOP;
END $$;

-- Break caught: the migration's helper that adds tracked fields to a table's version trigger reads the fields already there with a pattern that does not match a
-- name with a digit in it, so a table with such a field (say field_2) loses it, or the helper refuses the table, when another story's field is added.
DO $$
BEGIN
  CREATE TABLE public.scratch_tracked (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), firm_id uuid, field_2 text, extra text);
  PERFORM public.record_track('public.scratch_tracked', 'accounts', ARRAY['id'], ARRAY['field_2']);
  PERFORM pg_temp.track_more('public.scratch_tracked', 'accounts', ARRAY['extra']);
  PERFORM pg_temp.is((SELECT string_agg(r.m[1], ',' ORDER BY r.ord) FROM pg_trigger t CROSS JOIN LATERAL regexp_matches(pg_get_triggerdef(t.oid), '''([a-z0-9_]+)''', 'g') WITH ORDINALITY AS r (m, ord)
                      WHERE t.tgrelid = 'public.scratch_tracked'::regclass AND t.tgname = 'scratch_tracked_version'), 'field_2,extra', 'a field with a digit in its name is kept, and the new one added');
  DROP TABLE public.scratch_tracked;
END $$;

-- Break caught: a quote reopened by a send keeps the reason it was closed (a quote shown as "closed, went elsewhere" that is open again); a reason is kept on a quote
-- that is not closed; a reason outside the two words is saved.
DO $$
DECLARE r text; q bigint;
BEGIN
  PERFORM pg_temp.account('cr1', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('crq1', 'acme', 'cr1', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_crq1', pg_temp.qid('crq1', 'Justworks'), NULL, NULL, 'Acme');
  q := pg_temp.qid('crq1', 'TriNet');
  PERFORM pg_temp.is((SELECT close_reason FROM public.quote_requests WHERE id = q), 'went_elsewhere', 'a quote the win closed says why');
  PERFORM pg_temp.reopen('acme_agent1', 'o_crq1');
  PERFORM pg_temp.is((SELECT close_reason FROM public.quote_requests WHERE id = q), 'went_elsewhere', 'a reopening leaves it closed, with its reason');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM public.advisor_record_quote_send(pg_temp.id('crq1'), 'TriNet', NULL);
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT status || ':' || COALESCE(close_reason, '-') FROM public.quote_requests WHERE id = q), 'sent:-', 'a send opens it again and clears the reason');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.quote_requests SET close_reason = 'search_ended' WHERE id = %s$q$, q)), '23514', 'a reason written to an open quote is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.quote_requests SET status = 'closed', close_reason = 'because' WHERE id = %s$q$, q)), '23514', 'a reason outside the two words');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.quote_requests SET status = 'closed' WHERE id = %s$q$, q)), 'rows:1', 'a quote closed by hand has no reason');
END $$;

-- ---------- the closing plan and the history's questions keep what earlier stories gave them ----------
-- Break caught: the migration restates firm_closing_plan() (or the history's two questions) from older text and loses a line or a branch; the payments are not
-- deleted when a firm closes, or are deleted after the placements they stand on (the delete would then fail); a line twice.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() p WHERE p.action = 'delete' AND p.src = 'public.commission_payments'), 1::bigint, 'the plan deletes the payments, once');
  PERFORM pg_temp.is((SELECT p.ord < (SELECT p2.ord FROM public.firm_closing_plan() p2 WHERE p2.src = 'public.placements') FROM public.firm_closing_plan() p WHERE p.src = 'public.commission_payments'), true, 'before the placements they stand on');
  PERFORM pg_temp.is((SELECT p.ord < (SELECT p2.ord FROM public.firm_closing_plan() p2 WHERE p2.src = 'public.accounts') FROM public.firm_closing_plan() p WHERE p.src = 'public.commission_payments'), true, 'and the accounts');
  PERFORM pg_temp.is((SELECT p.firm_column FROM public.firm_closing_plan() p WHERE p.src = 'public.commission_payments'), 'firm_id', 'by the firm');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() WHERE action = 'keep'), 34::bigint, 'every table it kept is kept');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() p WHERE p.action = 'delete' AND p.src IN ('public.labels', 'public.account_labels', 'public.bulk_changes', 'public.bulk_change_records', 'public.recent_records',
    'public.activities', 'public.renewals', 'public.placements', 'public.accounts', 'public.contacts', 'public.opportunities', 'public.record_history', 'public.referral_partners', 'public.saved_views')), 14::bigint,
    'and every delete line it had, with these');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() p WHERE p.action = 'delete'), (SELECT count(*) FROM (SELECT DISTINCT src FROM public.firm_closing_plan() WHERE action = 'delete') d), 'no table twice');
  -- the history domain still knows every table it knew
  PERFORM pg_temp.is((SELECT string_agg(m[1], ',' ORDER BY m[1]) FROM pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS m
                      WHERE c.contypid = 'public.record_history_table'::regtype AND c.conname = 'record_history_table_known'),
    'accounts,commission_payments,contacts,opportunities,placements,referral_partners,renewals', 'the history domain holds every table it had, and the payments');
  -- running the three patches a second time changes nothing
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() WHERE src = 'public.commission_payments'), 1::bigint, 'one line');
END $$;

-- Break caught: an account's status needs a stored flag, or does not follow the win (D-197, D-451, D-455): a prospect with a won opportunity, or a client after
-- the reopen.
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.account('as1', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('asq1', 'acme', 'as1', 'acme_agent1');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('as1')), 'prospect', 'before: a prospect');
  PERFORM pg_temp.won('acme_agent1', 'o_asq1', pg_temp.qid('asq1', 'Justworks'), NULL, NULL, 'Acme');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('as1')), 'client', 'a win: a client');
  PERFORM pg_temp.is((SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name ~ 'status|client'), 0::bigint, 'with nothing stored on the account');
  PERFORM pg_temp.reopen('acme_agent1', 'o_asq1');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('as1')), 'prospect', 'the reopen: a prospect again');
  PERFORM pg_temp.won('acme_agent1', 'o_asq1', pg_temp.qid('asq1', 'Justworks'), NULL, NULL, 'Acme');
  PERFORM pg_temp.is(pg_temp.row_status('as1'), 'client', 'and the accounts table says the same');
END $$;

-- ---------- lock order: the account, then the opportunity, then the pipeline row, then the quote requests, placement and renewals ----------
-- Break caught: a function that locks the opportunity (or its pipeline row, quote requests, placement or renewals) and only then reads the account, so (1) it holds a
-- child while an owner change, an archive or a delete holds the account and waits on it in a ring with a writer that takes them the other way round, and (2) it
-- asks the level rule of an account row another session is changing; one that takes the quote requests BEFORE the submission's pipeline row (the order
-- set_submission_status and advisor_update_quote_request hold them: pipeline row first), so recording a quote while someone marks the opportunity won
-- deadlocks. Shown with two sessions. (1) While the second holds the account's row as an owner change or an archive does (FOR NO KEY UPDATE), each function
-- waits on the account before it takes anything else: the second can still take the opportunity, the pipeline row, the quote requests, the placement, the renewals
-- and the payment within two seconds (a change to the commission takes the same locks as a payment). (2) While the second holds the pipeline row as set_submission_status does, each waits on it before it takes the quote
-- requests: the second can still take them. 
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
-- The fixtures, committed first (a DO block is one transaction), so the two other sessions below can see them.
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.account('lka', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('lkw', 'acme', 'lka', 'acme_agent1');
  PERFORM pg_temp.quoted('lkl', 'acme', 'lka', 'acme_agent1');
  PERFORM pg_temp.quoted('lkr', 'acme', 'lka', 'acme_agent1');
  PERFORM pg_temp.quoted('lkp', 'acme', 'lka', 'acme_agent1');
  PERFORM pg_temp.won('acme_agent1', 'o_lkr', pg_temp.qid('lkr', 'Justworks'), NULL, NULL, 'Acme');
  PERFORM pg_temp.won('acme_agent1', 'o_lkp', pg_temp.qid('lkp', 'Justworks'), NULL, NULL, 'Acme');
  INSERT INTO fx SELECT 'pl_lkp', id FROM public.placements WHERE opportunity_id = pg_temp.id('o_lkp');
  FOREACH r IN ARRAY ARRAY['lk_pay1', 'lk_pay2', 'lk_pay3'] LOOP
    INSERT INTO fx VALUES (r, (pg_temp.pay('acme_agent1', 'pl_lkp', current_date, 10)::jsonb -> 'payment' ->> 'id')::uuid);
  END LOOP;
  PERFORM pg_temp.account('lkb', 'acme', 'acme_agent1');
END $$;
DO $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  fid uuid := pg_temp.id('acme'); acct uuid := pg_temp.id('lka'); arch uuid := pg_temp.id('lkb');
  a_pid integer; b_pid integer; tries integer; got text; stmt text; who text; probe text; wf text;
  calls text[][];
  i integer;
  open_as text := format('SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; SET LOCAL request.headers = %L',
    jsonb_build_object('sub', pg_temp.id('acme_agent1'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_agent1@example.test')::text,
    jsonb_build_object('x-firm-address', 'acme-brokers')::text);
BEGIN
  calls := ARRAY[
    ['won', format($q$SELECT public.opportunity_mark_won(%L, %s, NULL, NULL, 'Acme', %L, %s)::text$q$, pg_temp.id('o_lkw'), pg_temp.qid('lkw', 'Justworks'), fid, pg_temp.ver('o_lkw')),
     format($p$PERFORM 1 FROM public.opportunities WHERE id = %L FOR NO KEY UPDATE; PERFORM 1 FROM public.submission_workflow WHERE session_id = %L FOR UPDATE; PERFORM 1 FROM public.quote_requests WHERE session_id = %L FOR UPDATE$p$, pg_temp.id('o_lkw'), pg_temp.id('lkw'), pg_temp.id('lkw')), pg_temp.id('lkw')::text],
    ['lost', format($q$SELECT public.opportunity_mark_lost(%L, 'price', NULL, %L, %s)::text$q$, pg_temp.id('o_lkl'), fid, pg_temp.ver('o_lkl')),
     format($p$PERFORM 1 FROM public.opportunities WHERE id = %L FOR NO KEY UPDATE; PERFORM 1 FROM public.submission_workflow WHERE session_id = %L FOR UPDATE; PERFORM 1 FROM public.quote_requests WHERE session_id = %L FOR UPDATE$p$, pg_temp.id('o_lkl'), pg_temp.id('lkl'), pg_temp.id('lkl')), pg_temp.id('lkl')::text],
    ['reopen', format($q$SELECT public.opportunity_reopen(%L, %L, %s)::text$q$, pg_temp.id('o_lkr'), fid, pg_temp.ver('o_lkr')),
     format($p$PERFORM 1 FROM public.opportunities WHERE id = %L FOR NO KEY UPDATE; PERFORM 1 FROM public.submission_workflow WHERE session_id = %L FOR UPDATE; PERFORM 1 FROM public.quote_requests WHERE session_id = %L FOR UPDATE; PERFORM 1 FROM public.placements WHERE opportunity_id = %L FOR NO KEY UPDATE; PERFORM 1 FROM public.renewals WHERE account_id = %L FOR NO KEY UPDATE$p$, pg_temp.id('o_lkr'), pg_temp.id('lkr'), pg_temp.id('lkr'), pg_temp.id('o_lkr'), acct), pg_temp.id('lkr')::text],
    ['pay', format($q$SELECT public.record_commission_payment(%L, current_date, 5, NULL, %L)::text$q$, pg_temp.id('pl_lkp'), fid),
     format($p$PERFORM 1 FROM public.opportunities WHERE id = %L FOR NO KEY UPDATE; PERFORM 1 FROM public.placements WHERE id = %L FOR NO KEY UPDATE$p$, pg_temp.id('o_lkp'), pg_temp.id('pl_lkp')), NULL],
    ['setcom', format($q$SELECT public.set_placement_commission(%L, %L, 1, 'flat', 100, NULL)::text$q$, pg_temp.id('pl_lkp'), fid),
     format($p$PERFORM 1 FROM public.opportunities WHERE id = %L FOR NO KEY UPDATE; PERFORM 1 FROM public.placements WHERE id = %L FOR NO KEY UPDATE$p$, pg_temp.id('o_lkp'), pg_temp.id('pl_lkp')), NULL],
    ['payupd', format($q$SELECT public.update_commission_payment(%L, current_date, 6, NULL, %L, 1)::text$q$, pg_temp.id('lk_pay1'), fid),
     format($p$PERFORM 1 FROM public.opportunities WHERE id = %L FOR NO KEY UPDATE; PERFORM 1 FROM public.placements WHERE id = %L FOR NO KEY UPDATE; PERFORM 1 FROM public.commission_payments WHERE id = %L FOR NO KEY UPDATE$p$, pg_temp.id('o_lkp'), pg_temp.id('pl_lkp'), pg_temp.id('lk_pay1')), NULL],
    ['paydel', format($q$SELECT public.delete_commission_payment(%L, %L, 1)::text$q$, pg_temp.id('lk_pay2'), fid),
     format($p$PERFORM 1 FROM public.opportunities WHERE id = %L FOR NO KEY UPDATE; PERFORM 1 FROM public.placements WHERE id = %L FOR NO KEY UPDATE; PERFORM 1 FROM public.commission_payments WHERE id = %L FOR NO KEY UPDATE$p$, pg_temp.id('o_lkp'), pg_temp.id('pl_lkp'), pg_temp.id('lk_pay2')), NULL]];
  PERFORM race.dblink_connect('qa', dsn);
  PERFORM race.dblink_connect('qb', dsn);
  SELECT pid INTO a_pid FROM race.dblink('qa', 'SELECT pg_backend_pid()') AS t(pid integer);
  SELECT pid INTO b_pid FROM race.dblink('qb', 'SELECT pg_backend_pid()') AS t(pid integer);
  FOR i IN 1 .. array_length(calls, 1) LOOP
    who := calls[i][1]; stmt := calls[i][2]; probe := calls[i][3]; wf := calls[i][4]; tries := 0;
    -- (1) The second holds the account row as an owner change does.
    PERFORM race.dblink_exec('qb', 'BEGIN');
    PERFORM race.dblink_exec('qb', format('DO $do$ BEGIN PERFORM 1 FROM public.accounts WHERE id = %L FOR NO KEY UPDATE; END $do$', acct));
    PERFORM race.dblink_exec('qa', 'BEGIN');
    PERFORM race.dblink_exec('qa', open_as);
    PERFORM race.dblink_send_query('qa', stmt);
    WHILE tries < 100 AND NOT (b_pid = ANY (pg_blocking_pids(a_pid))) LOOP
      tries := tries + 1;
      PERFORM pg_sleep(0.05);
    END LOOP;
    PERFORM pg_temp.is(b_pid = ANY (pg_blocking_pids(a_pid)), true, who || ' waits on the account row');
    -- While it waits, everything below the account is still free: the function has not taken any of it first.
    BEGIN
      PERFORM race.dblink_exec('qb', format('SET LOCAL lock_timeout = %L; DO $do$ BEGIN %s; END $do$', '2s', probe));
      got := 'ok';
    EXCEPTION WHEN OTHERS THEN
      got := SQLSTATE;
    END;
    PERFORM pg_temp.is(got, 'ok', who || ': the opportunity, its pipeline row, quote requests, placement and renewals were free while it waited (account first)');
    PERFORM race.dblink_exec('qb', 'ROLLBACK');
    PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
    PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
    PERFORM race.dblink_exec('qa', 'ROLLBACK');

    -- (2) The second holds the submission's pipeline row, as set_submission_status does before it closes the quote requests.
    IF wf IS NOT NULL THEN
      tries := 0;
      PERFORM race.dblink_exec('qb', 'BEGIN');
      PERFORM race.dblink_exec('qb', format('DO $do$ BEGIN PERFORM 1 FROM public.submission_workflow WHERE session_id = %L FOR UPDATE; END $do$', wf::uuid));
      PERFORM race.dblink_exec('qa', 'BEGIN');
      PERFORM race.dblink_exec('qa', open_as);
      PERFORM race.dblink_send_query('qa', stmt);
      WHILE tries < 100 AND NOT (b_pid = ANY (pg_blocking_pids(a_pid))) LOOP
        tries := tries + 1;
        PERFORM pg_sleep(0.05);
      END LOOP;
      PERFORM pg_temp.is(b_pid = ANY (pg_blocking_pids(a_pid)), true, who || ' waits on the pipeline row');
      BEGIN
        PERFORM race.dblink_exec('qb', format('SET LOCAL lock_timeout = %L; DO $do$ BEGIN PERFORM 1 FROM public.quote_requests WHERE session_id = %L FOR UPDATE; END $do$', '2s', wf::uuid));
        got := 'ok';
      EXCEPTION WHEN OTHERS THEN
        got := SQLSTATE;
      END;
      PERFORM pg_temp.is(got, 'ok', who || ': the quote requests were free while it waited for the pipeline row (pipeline row first)');
      PERFORM race.dblink_exec('qb', 'ROLLBACK');
      PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
      PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
      PERFORM race.dblink_exec('qa', 'ROLLBACK');
    END IF;
  END LOOP;

  -- An archive commits while a win waits behind it: the win then refuses on the archived account (55000), not a placement on an archived account.
  tries := 0;
  PERFORM race.dblink_exec('qb', 'BEGIN');
  PERFORM race.dblink_exec('qb', format('UPDATE public.accounts SET archived_at = now() WHERE id = %L', acct));
  PERFORM race.dblink_exec('qa', 'BEGIN');
  PERFORM race.dblink_exec('qa', open_as);
  PERFORM race.dblink_send_query('qa', format($q$SELECT public.opportunity_mark_won(%L, %s, NULL, NULL, 'Acme', %L, 1)::text$q$, pg_temp.id('o_lkw'), pg_temp.qid('lkw', 'Justworks'), fid));
  WHILE tries < 100 AND NOT (b_pid = ANY (pg_blocking_pids(a_pid))) LOOP
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM pg_temp.is(b_pid = ANY (pg_blocking_pids(a_pid)), true, 'a win waits behind an archive');
  PERFORM race.dblink_exec('qb', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
    got := 'ok';
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE;
  END;
  PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
  PERFORM race.dblink_exec('qa', 'ROLLBACK');
  PERFORM race.dblink_disconnect('qa');
  PERFORM race.dblink_disconnect('qb');
  PERFORM pg_temp.is(got, '55000', 'and refuses once the archive has committed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE opportunity_id = pg_temp.id('o_lkw')), 0::bigint, 'leaving no placement on the archived account');
  RAISE NOTICE 'won_lost_commission: lock order passed';
END $$;

-- ---------- an opportunity that moved to another account while a write waited for the first one ----------
-- Break caught: opportunity_to_change holds the account it read before the opportunity moved and asks the level rule and the archive check of it, though the
-- opportunity now belongs to another account (CRM-O1.1a's update_opportunity re-checks and refuses 40001 "moved while you were working"). Shown with two sessions:
-- the second moves the opportunity to another account and has not committed when the first, which read the old account, holds that account and waits for the
-- opportunity; once the second commits the first refuses (40001) and writes nothing.
DO $$
BEGIN
  PERFORM pg_temp.account('mva', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('mvb', 'acme', 'acme_agent1');
  PERFORM pg_temp.quoted('mvq', 'acme', 'mva', 'acme_agent1');
END $$;
DO $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  a_pid integer; b_pid integer; tries integer := 0; got text; v integer := pg_temp.ver('o_mvq');
  open_as text := format('SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; SET LOCAL request.headers = %L',
    jsonb_build_object('sub', pg_temp.id('acme_agent1'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_agent1@example.test')::text,
    jsonb_build_object('x-firm-address', 'acme-brokers')::text);
BEGIN
  PERFORM race.dblink_connect('qa', dsn);
  PERFORM race.dblink_connect('qb', dsn);
  SELECT pid INTO a_pid FROM race.dblink('qa', 'SELECT pg_backend_pid()') AS t(pid integer);
  SELECT pid INTO b_pid FROM race.dblink('qb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('qb', 'BEGIN');
  PERFORM race.dblink_exec('qb', format('UPDATE public.opportunities SET account_id = %L WHERE id = %L', pg_temp.id('mvb'), pg_temp.id('o_mvq')));
  PERFORM race.dblink_exec('qa', 'BEGIN');
  PERFORM race.dblink_exec('qa', open_as);
  PERFORM race.dblink_send_query('qa', format($q$SELECT public.opportunity_mark_lost(%L, 'price', NULL, %L, %s)::text$q$, pg_temp.id('o_mvq'), pg_temp.id('acme'), v));
  WHILE tries < 100 AND NOT (b_pid = ANY (pg_blocking_pids(a_pid))) LOOP
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM pg_temp.is(b_pid = ANY (pg_blocking_pids(a_pid)), true, 'the write waits for the opportunity the second session has moved');
  PERFORM race.dblink_exec('qb', 'COMMIT');
  BEGIN
    PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
    got := 'ok';
  EXCEPTION WHEN OTHERS THEN
    got := SQLSTATE;
  END;
  PERFORM * FROM race.dblink_get_result('qa') AS t(r text);
  PERFORM race.dblink_exec('qa', 'ROLLBACK');
  PERFORM race.dblink_disconnect('qa');
  PERFORM race.dblink_disconnect('qb');
  PERFORM pg_temp.is(got, '40001', 'refused once the opportunity is on another account');
  PERFORM pg_temp.is(pg_temp.pipeline('mvq'), 'quoted', 'and nothing was written');
END $$;
