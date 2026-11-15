-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh placements_renewals
-- Placements and renewals, in the database (story CRM-A2.4a; docs/BROKER_CRM_BUILD.md D-24, D-28, D-45, D-46, D-197, D-209, D-222, D-407, D-446 to D-454;
-- 20261120110000_placements_renewals.sql). A placement is what a firm placed for an account with a PEO; a renewal is a date an account's cover comes up. Both
-- are seen by whoever may see their account, written by no API role (only the functions below), with a history and a version, in the closing plan; an
-- account's status (prospect, client, former client) and the accounts table's Renewal column and "Renewing in 120 days" view follow from them. Two firms
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
\i supabase/migrations/20261119180000_calls_notes_tasks.sql
\i supabase/migrations/20261120110000_placements_renewals.sql
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
  PERFORM pg_temp.account('z2', 'zenith', 'zenith_agent2', 'Other Zenith client');
END $$;

-- ---------- the tables ----------
-- Break caught: either table can be written through the API (D-407); is read by a signed-out caller; has no row security; or a row of one firm can name another
-- firm's account.
DO $$
DECLARE t text; r text;
BEGIN
  FOREACH t IN ARRAY ARRAY['placements', 'renewals'] LOOP
    PERFORM pg_temp.is(has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
      OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') OR has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE'), false, 'no API role writes ' || t);
    PERFORM pg_temp.is(has_table_privilege('service_role', 'public.' || t, 'INSERT') OR has_table_privilege('service_role', 'public.' || t, 'UPDATE')
      OR has_table_privilege('service_role', 'public.' || t, 'DELETE'), false, 'nor the service role writes ' || t);
    PERFORM pg_temp.is(has_table_privilege('authenticated', 'public.' || t, 'SELECT'), true, 'a signed-in caller may ask to read ' || t);
    PERFORM pg_temp.is(has_table_privilege('anon', 'public.' || t, 'SELECT'), false, 'a signed-out caller reads no ' || t);
    PERFORM pg_temp.is((SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass), true, 'row security is on for ' || t);
  END LOOP;
  -- a placement of one firm on another firm's account is refused by the table itself
  r := (SELECT CASE WHEN true THEN
    (SELECT pg_temp.attempt(format($q$INSERT INTO public.placements (firm_id, account_id, peo_name) VALUES (%L, %L, 'Some PEO')$q$, pg_temp.id('zenith'), pg_temp.id('a1')))) END);
  PERFORM pg_temp.is(r, '23503', 'a placement can''t sit on another firm''s account');
  r := pg_temp.attempt(format($q$INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on) VALUES (%L, %L, 'current_plan', 'Some carrier', current_date)$q$,
    pg_temp.id('zenith'), pg_temp.id('a1')));
  PERFORM pg_temp.is(r, '23503', 'nor can a renewal');
END $$;


-- ---------- adding a renewal by hand (D-447, D-452) ----------
-- The calls below: acme/zenith firm ids are named in each call, as the page does.
CREATE FUNCTION pg_temp.add_renewal(who text, p_account text, p_kind text, p_with text, p_on date, p_start date DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, CASE WHEN who LIKE 'zenith%' THEN 'zenith-benefits' ELSE 'acme-brokers' END, format(
    'SELECT public.add_renewal(%L, %L, %L, %L, %L, %L)::text', pg_temp.id(p_account), p_kind, p_with, p_on, p_start,
    pg_temp.id(CASE WHEN who LIKE 'zenith%' THEN 'zenith' ELSE 'acme' END)))
$$;

-- Break caught: a PEO placement renewal added by hand makes no placement (so the account is never a client and the renewal can't end, D-447) or makes one
-- with an opportunity or a quote it has none of; the employer's current plan makes a placement; what was typed is kept untrimmed or not at all; the renewal
-- is not on the account it was added to; a first version is not 1.
DO $$
DECLARE r text; j jsonb; n bigint;
BEGIN
  r := pg_temp.add_renewal('acme_agent1', 'a1', 'peo_placement', '  Justworks ', current_date + 45, current_date - 320);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner of an account adds a renewal');
  j := r::jsonb;
  INSERT INTO fx VALUES ('r1', (j -> 'renewal' ->> 'id')::uuid), ('p1', (j -> 'placement' ->> 'id')::uuid);
  PERFORM pg_temp.is(j -> 'renewal' ->> 'kind', 'peo_placement', 'what renews');
  PERFORM pg_temp.is(j -> 'renewal' ->> 'with_whom', 'Justworks', 'with whom, trimmed');
  PERFORM pg_temp.is(j -> 'renewal' ->> 'renews_on', to_char(current_date + 45, 'YYYY-MM-DD'), 'the date');
  PERFORM pg_temp.is(j -> 'renewal' ->> 'account_id', pg_temp.id('a1')::text, 'on that account');
  PERFORM pg_temp.is((j -> 'renewal' ->> 'version')::int, 1, 'a first version');
  PERFORM pg_temp.is(j -> 'renewal' ->> 'placement_id', j -> 'placement' ->> 'id', 'it names the placement made in the same step');
  PERFORM pg_temp.is(j -> 'renewal' ->> 'done', 'false', 'not done');
  PERFORM pg_temp.is(j -> 'renewal' ->> 'made_by_win', 'false', 'and not made by a win');
  PERFORM pg_temp.is((SELECT row (p.peo_name, p.start_date, p.opportunity_id, p.quote_request_id, p.ended_on, p.account_id, p.broker_of_record)::text
                      FROM public.placements p WHERE p.id = pg_temp.id('p1')),
    row ('Justworks', current_date - 320, NULL::uuid, NULL::bigint, NULL::date, pg_temp.id('a1'), NULL::text)::text,
    'the placement: the PEO, the start date, no opportunity, no quote, not ended');
  PERFORM pg_temp.is((SELECT version FROM public.placements WHERE id = pg_temp.id('p1')), 1, 'with a version');

  -- no start date known: the placement has none
  r := pg_temp.add_renewal('acme_agent1', 'a1', 'peo_placement', 'Gusto', current_date + 200);
  PERFORM pg_temp.is((SELECT p.start_date FROM public.placements p WHERE p.id = (r::jsonb -> 'placement' ->> 'id')::uuid), NULL::date, 'a start date is optional');
  INSERT INTO fx VALUES ('r1b', (r::jsonb -> 'renewal' ->> 'id')::uuid), ('p1b', (r::jsonb -> 'placement' ->> 'id')::uuid);

  -- the employer's current plan makes no placement
  n := (SELECT count(*) FROM public.placements);
  r := pg_temp.add_renewal('acme_agent1', 'a1', 'current_plan', 'Aetna', current_date + 90);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a current plan''s renewal is added');
  PERFORM pg_temp.is(r::jsonb -> 'placement', 'null'::jsonb, 'it makes no placement');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements), n, 'no placement row');
  PERFORM pg_temp.is((SELECT placement_id FROM public.renewals WHERE id = (r::jsonb -> 'renewal' ->> 'id')::uuid), NULL::uuid, 'and the renewal names none');
  INSERT INTO fx VALUES ('r2', (r::jsonb -> 'renewal' ->> 'id')::uuid);
END $$;

-- Break caught: adding is held to who may CHANGE the account when D-452 says who may SEE it (an agent can't add to a colleague's account they can see in a
-- firm that shows everyone everything), or opened to someone who can't see it at all; a made-up kind, blank or long "with whom", no date, or a start date on a
-- current plan is saved; another firm's account takes one; an archived account takes one (D-222).
DO $$
DECLARE n bigint := (SELECT count(*) FROM public.renewals); m bigint := (SELECT count(*) FROM public.placements);
BEGIN
  -- Zenith shows everyone everything: zenith_agent2 sees z1 (zenith_agent's) and may add to it, though they may not change it.
  PERFORM pg_temp.is(pg_temp.code(pg_temp.add_renewal('zenith_agent2', 'z1', 'current_plan', 'Cigna', current_date + 10)), 'ok', 'anyone who may see an account adds a renewal to it');
  -- Acme sees by level: agent2 can't see agent1's account, nor an agent an account with no owner.
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent2', 'acme-brokers', format('SELECT public.add_renewal(%L, ''current_plan'', ''X'', current_date, NULL, %L)::text', pg_temp.id('a1'), pg_temp.id('acme'))),
    'PT404: That account isn''t available', 'an account the caller may not see is as if it were not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.add_renewal('acme_agent1', 'a3', 'current_plan', 'X', current_date)), 'PT404', 'an agent does not see an account with no owner');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.add_renewal('acme_owner', 'a3', 'current_plan', 'X', current_date)), 'ok', 'an owner of the firm adds to it');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_owner', 'acme-brokers', format('SELECT public.add_renewal(%L, ''current_plan'', ''X'', current_date, NULL, %L)::text', pg_temp.id('a1'), pg_temp.id('acme')))), '42501',
    'another firm''s owner is no member of Acme');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.add_renewal('zenith_owner', 'a1', 'current_plan', 'X', current_date)), 'PT404', 'and names no account of their own firm');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.add_renewal(%L, ''current_plan'', ''X'', current_date, NULL, %L)::text', pg_temp.id('z1'), pg_temp.id('acme')))), 'PT404',
    'nor does another firm''s account take one, as one that is not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.add_renewal(%L, ''current_plan'', ''X'', current_date, NULL, %L)::text', gen_random_uuid(), pg_temp.id('acme')))), 'PT404', 'an account that does not exist');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.add_renewal('acme_removed', 'a1', 'current_plan', 'X', current_date)), '42501', 'a former member is refused');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('nobody', NULL, format('SELECT public.add_renewal(%L, ''current_plan'', ''X'', current_date, NULL, NULL)::text', pg_temp.id('a1')))), '42501', 'and a person of no firm');

  PERFORM pg_temp.is(pg_temp.add_renewal('acme_agent1', 'a1', 'both', 'X', current_date), '22023: Choose what renews: a PEO placement or the employer''s current plan.', 'a made-up kind');
  PERFORM pg_temp.is(pg_temp.add_renewal('acme_agent1', 'a1', NULL, 'X', current_date), '22023: Choose what renews: a PEO placement or the employer''s current plan.', 'no kind');
  PERFORM pg_temp.is(pg_temp.add_renewal('acme_agent1', 'a1', 'current_plan', '   ', current_date), '22023: Say who it is with.', 'a blank with whom');
  PERFORM pg_temp.is(pg_temp.add_renewal('acme_agent1', 'a1', 'current_plan', NULL, current_date), '22023: Say who it is with.', 'no with whom');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.add_renewal('acme_agent1', 'a1', 'current_plan', repeat('x', 80), current_date)), 'ok', '80 characters of with whom is allowed');
  PERFORM pg_temp.is(pg_temp.add_renewal('acme_agent1', 'a1', 'current_plan', repeat('x', 81), current_date), '22023: Keep who it is with to 80 characters.', 'and 81 is not');
  PERFORM pg_temp.is(pg_temp.add_renewal('acme_agent1', 'a1', 'current_plan', 'X', NULL), '22023: Give the renewal date.', 'a date is needed');
  PERFORM pg_temp.is(pg_temp.add_renewal('acme_agent1', 'a1', 'current_plan', 'X', current_date, current_date - 5), '22023: Only a PEO placement has a start date.', 'a current plan has no placement to start');
  PERFORM pg_temp.is(pg_temp.add_renewal('acme_agent1', 'a1', 'peo_placement', repeat('x', 81), current_date), '22023: Keep who it is with to 80 characters.', 'a PEO placement''s PEO is held to the same 80');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals), n + 3, 'only the three good ones were saved');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements), m, 'and none of the refused ones left a placement behind');
END $$;

-- Break caught: an archived account takes a renewal (D-222: nothing can be added to it).
DO $$
DECLARE n bigint;
BEGIN
  PERFORM pg_temp.account('arch', 'acme', 'acme_agent1');
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('arch');
  n := (SELECT count(*) FROM public.renewals);
  PERFORM pg_temp.is(pg_temp.add_renewal('acme_agent1', 'arch', 'current_plan', 'X', current_date), '55000: This account is archived. Nothing can be added to it.', 'an archived account takes no renewal');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals), n, 'nothing was saved');
END $$;


-- ---------- an account's status (D-451, D-197) ----------
-- Break caught: a placement not ended does not make a client (D-447: "every PEO placement makes the account a client"); a current plan's renewal does;
-- all placements ended is not a former client, or one still running is; a won submission with no placement is no longer a client (one won before Epic 4);
-- a won submission whose placement has ended is still a client; another account's placement counts; the status is stored.
CREATE FUNCTION pg_temp.placement(n text, p_account text, p_peo text, p_ended date DEFAULT NULL, p_opportunity text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.placements (firm_id, account_id, opportunity_id, peo_name, ended_on)
  SELECT a.firm_id, a.id, pg_temp.id(p_opportunity), p_peo, p_ended FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

DO $$
DECLARE won uuid;
BEGIN
  PERFORM pg_temp.account('s_none', 'acme', NULL);
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_none')), 'prospect', 'an account with nothing on it is a prospect');
  PERFORM pg_temp.is(public.account_status(gen_random_uuid()), NULL::text, 'an account that is not there has no status');
  -- a1 has a PEO placement not ended (added above) and a current plan
  PERFORM pg_temp.is(public.account_status(pg_temp.id('a1')), 'client', 'a placement not ended makes a client');
  PERFORM pg_temp.account('s_plan', 'acme', NULL);
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on) SELECT firm_id, id, 'current_plan', 'Aetna', current_date + 30 FROM public.accounts WHERE id = pg_temp.id('s_plan');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_plan')), 'prospect', 'a renewal of the employer''s current plan makes no client');

  -- a former client: it has placements and every one has ended
  PERFORM pg_temp.account('s_former', 'acme', NULL);
  PERFORM pg_temp.placement('sf_p1', 's_former', 'Justworks', current_date - 10);
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_former')), 'former_client', 'one placement, ended: a former client');
  PERFORM pg_temp.placement('sf_p2', 's_former', 'Gusto', current_date - 5);
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_former')), 'former_client', 'two, both ended: a former client');
  PERFORM pg_temp.placement('sf_p3', 's_former', 'TriNet');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_former')), 'client', 'a third still running makes it a client again');
  UPDATE public.placements SET ended_on = current_date WHERE id = pg_temp.id('sf_p3');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_former')), 'former_client', 'and ended, a former client once more');
  UPDATE public.placements SET ended_on = NULL WHERE id = pg_temp.id('sf_p3');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_former')), 'client', 'undone, a client (nothing is stored: it is asked each time)');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_none')), 'prospect', 'another account''s placements are not this one''s');
  PERFORM pg_temp.is((SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name ~ 'status'), 0::bigint, 'no status is stored on the account');

  -- a won submission with no placement is a client (one won before Epic 4); with a placement the placement says
  PERFORM pg_temp.account('s_won', 'acme', NULL);
  PERFORM pg_temp.intake('s_won_i', 'acme');
  PERFORM pg_temp.opportunity('s_won_o', 's_won', NULL, 's_won_i');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_won')), 'prospect', 'an opportunity not won is a prospect');
  PERFORM pg_temp.move('s_won_i', 'won');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_won')), 'client', 'a won submission with no placement is a client');
  PERFORM pg_temp.placement('s_won_p', 's_won', 'Justworks', current_date - 1, 's_won_o');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_won')), 'former_client', 'its placement ended: a former client, though the submission is still won');
  UPDATE public.placements SET ended_on = NULL WHERE id = pg_temp.id('s_won_p');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_won')), 'client', 'its placement running: a client');

  -- an ended placement of the account and a won submission with none: the win has no placement, so it is a client
  PERFORM pg_temp.account('s_mixed', 'acme', NULL);
  PERFORM pg_temp.intake('s_mixed_i', 'acme');
  PERFORM pg_temp.opportunity('s_mixed_o', 's_mixed', NULL, 's_mixed_i');
  PERFORM pg_temp.placement('s_mixed_p', 's_mixed', 'Gusto', current_date - 1);
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_mixed')), 'former_client', 'an ended placement alone: a former client');
  PERFORM pg_temp.move('s_mixed_i', 'won');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_mixed')), 'client', 'a win with no placement of its own makes it a client again');
  -- a won submission archived stays won (D-216)
  PERFORM pg_temp.move('s_mixed_i', 'archived');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('s_mixed')), 'client', 'archived from won, still a client');

  -- no API role asks it
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_status(%L)$q$, pg_temp.id('a1'))), 'rows:1', 'the superuser asks');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_status(%L)$q$, pg_temp.id('a1'))), '42501', 'but no API role does');
  RESET ROLE;
END $$;


-- ---------- editing and deleting a renewal (D-452, D-46, D-209) ----------
CREATE FUNCTION pg_temp.fid(who text) RETURNS uuid LANGUAGE sql AS $$
  SELECT pg_temp.id(CASE WHEN who LIKE 'zenith%' THEN 'zenith' ELSE 'acme' END)
$$;
CREATE FUNCTION pg_temp.addr(who text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN who LIKE 'zenith%' THEN 'zenith-benefits' ELSE 'acme-brokers' END
$$;
CREATE FUNCTION pg_temp.upd(who text, p_renewal text, p_with text, p_on date, p_version integer) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.update_renewal(%L, %L, %L, %L, %L)::text',
    pg_temp.id(p_renewal), p_with, p_on, pg_temp.fid(who), p_version))
$$;
CREATE FUNCTION pg_temp.del(who text, p_renewal text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.delete_renewal(%L, %L)::text', pg_temp.id(p_renewal), pg_temp.fid(who)))
$$;

-- A renewal a win would make (CRM-O1.3a): its placement has an opportunity. Made as the superuser, since no function makes one yet.
CREATE FUNCTION pg_temp.win_renewal(n text, p_account text, p_opportunity text, p_on date) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE pl uuid; r uuid;
BEGIN
  pl := pg_temp.placement(n || '_p', p_account, 'Justworks', NULL, p_opportunity);
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, placement_id)
  SELECT a.firm_id, a.id, 'peo_placement', 'Justworks', p_on, pl FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

-- Break caught: an edit saved without looking at the version (a second person's change lost without a word); saved from a version that never existed; a conflict
-- that names nothing the other person changed; an edit by someone who may see the account but not change it (D-452: edited by whoever may CHANGE); the
-- by-hand placement's PEO left behind when the renewal's "with whom" is corrected; one saved for what the add refuses.
DO $$
DECLARE r text; j jsonb;
BEGIN
  -- r1 is a1's PEO placement renewal (version 1), r2 its current plan's
  r := pg_temp.upd('acme_agent1', 'r1', 'Justworks PEO', current_date + 50, 1);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner of the account edits its renewal');
  j := r::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, false, 'no conflict');
  PERFORM pg_temp.is(j -> 'record' ->> 'with_whom', 'Justworks PEO', 'with whom saved');
  PERFORM pg_temp.is(j -> 'record' ->> 'renews_on', to_char(current_date + 50, 'YYYY-MM-DD'), 'the date saved');
  PERFORM pg_temp.is((j -> 'record' ->> 'version')::int, 2, 'a new version');
  PERFORM pg_temp.is((j -> 'record' ->> 'days_away')::int, 50, 'days away worked out from today');
  PERFORM pg_temp.is((SELECT p.peo_name FROM public.placements p WHERE p.id = pg_temp.id('p1')), 'Justworks PEO', 'the placement made by hand is with the PEO the renewal now names');
  PERFORM pg_temp.is((SELECT row (kind, placement_id)::text FROM public.renewals WHERE id = pg_temp.id('r1')), row ('peo_placement', pg_temp.id('p1'))::text, 'what renews does not change');

  -- the version
  r := pg_temp.upd('acme_agent1', 'r1', 'Gusto', current_date + 60, 1);
  j := r::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'a save from an old version is a conflict');
  PERFORM pg_temp.is((j ->> 'currentVersion')::int, 2, 'naming the version it is at');
  PERFORM pg_temp.is(j -> 'current' ->> 'with_whom', 'Justworks PEO', 'and what is there now');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',' ORDER BY c ->> 'field') FROM jsonb_array_elements(j -> 'changed') c), 'renews_on,with_whom', 'and the fields the other save changed');
  PERFORM pg_temp.is((SELECT with_whom FROM public.renewals WHERE id = pg_temp.id('r1')), 'Justworks PEO', 'nothing was saved');
  PERFORM pg_temp.is(pg_temp.upd('acme_agent1', 'r1', 'Gusto', current_date + 60, NULL),
    '22023: This save did not say which version of the renewal it started from, so it was refused. Reload the page and try again.', 'no version');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.upd('acme_agent1', 'r1', 'Gusto', current_date + 60, 0)), '22023', 'version 0');
  PERFORM pg_temp.is(pg_temp.upd('acme_agent1', 'r1', 'Gusto', current_date + 60, 9),
    '22023: This save names a version of the renewal that does not exist, so it was refused. Reload the page and try again.', 'a version it never had');

  -- who
  PERFORM pg_temp.is(pg_temp.code(pg_temp.upd('acme_agent2', 'r1', 'X', current_date, 2)), 'PT404', 'someone who may not see the account: as if it were not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.upd('acme_owner', 'r1', 'Justworks PEO', current_date + 51, 2)), 'ok', 'an owner of the firm edits it');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.upd('acme_lead', 'r1', 'X', current_date, 3)), 'PT404', 'a lead whose team does not reach the account does not see it');
  -- Zenith (everyone sees everything): zenith_agent2 sees z1's renewal and may not change it; its owner may.
  r := pg_temp.add_renewal('zenith_agent', 'z1', 'current_plan', 'Cigna', current_date + 20);
  INSERT INTO fx VALUES ('zr1', (r::jsonb -> 'renewal' ->> 'id')::uuid);
  PERFORM pg_temp.is(pg_temp.upd('zenith_agent2', 'zr1', 'Cigna Inc', current_date + 21, 1),
    '42501: Only the account''s owner, a lead of the owner''s team or an owner of the firm can change its renewals.', 'one who sees but may not change it is refused in words');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.upd('zenith_owner', 'zr1', 'Cigna Inc', current_date + 21, 1)), 'ok', 'an owner may');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.upd('acme_owner', 'zr1', 'X', current_date, 1)), 'PT404', 'another firm''s renewal, named at one''s own firm, is not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_owner', 'acme-brokers', format('SELECT public.update_renewal(%L, ''X'', current_date, %L, 1)::text', pg_temp.id('r1'), pg_temp.id('acme')))), '42501', 'a member of another firm is refused at this firm');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.upd('acme_removed', 'r1', 'X', current_date, 3)), '42501', 'a former member');
  -- an account with no owner: only an owner of the firm changes its renewals
  r := pg_temp.add_renewal('acme_owner', 'a3', 'current_plan', 'Kaiser', current_date + 70);
  INSERT INTO fx VALUES ('r3', (r::jsonb -> 'renewal' ->> 'id')::uuid);
  PERFORM pg_temp.is(pg_temp.upd('acme_owner', 'r3', 'Kaiser Permanente', current_date + 71, 1) LIKE '%"conflict": false%', true, 'an owner edits an unowned account''s renewal');

  -- what the add refuses
  PERFORM pg_temp.is(pg_temp.upd('acme_agent1', 'r2', '  ', current_date, 1), '22023: Say who it is with.', 'a blank with whom');
  PERFORM pg_temp.is(pg_temp.upd('acme_agent1', 'r2', repeat('x', 81), current_date, 1), '22023: Keep who it is with to 80 characters.', 'a long one');
  PERFORM pg_temp.is(pg_temp.upd('acme_agent1', 'r2', 'Aetna', NULL, 1), '22023: Give the renewal date.', 'no date');
  PERFORM pg_temp.is((SELECT version FROM public.renewals WHERE id = pg_temp.id('r2')), 1, 'a refused edit does not move the version');

  -- a win's renewal: the placement's PEO is not the renewal's to rename
  PERFORM pg_temp.opportunity('wr_o', 'a1', 'acme_agent1');
  PERFORM pg_temp.win_renewal('wr', 'a1', 'wr_o', current_date + 365);
  r := pg_temp.upd('acme_agent1', 'wr', 'Justworks, renamed', current_date + 366, 1);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'a renewal made by a win can be edited');
  PERFORM pg_temp.is((SELECT peo_name FROM public.placements WHERE id = pg_temp.id('wr_p')), 'Justworks', 'but its placement''s PEO is the win''s');
END $$;

-- Break caught: a delete that skips the version-less path's checks (a person who may only see the account deletes); a renewal made by a win deleted (it goes
-- only by reopening the win, D-452); a by-hand PEO placement renewal deleted and its placement left, so the account stays a client and nothing can end it;
-- a placement of a win deleted along with a renewal.
DO $$
DECLARE r text; n bigint;
BEGIN
  PERFORM pg_temp.is(pg_temp.code(pg_temp.del('acme_agent2', 'r2')), 'PT404', 'someone who may not see the account deletes nothing');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.del('zenith_agent2', 'zr1')), '42501', 'one who sees but may not change it deletes nothing');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.del('acme_agent1', 'zr1')), 'PT404', 'another firm''s renewal is not there');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE id IN (pg_temp.id('r2'), pg_temp.id('zr1'))), 2::bigint, 'both are still there');
  PERFORM pg_temp.is(pg_temp.del('acme_agent1', 'wr'),
    'PT409: This renewal was made by a win. Reopen the win to delete it.', 'a renewal made by a win is deleted only by reopening');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE id = pg_temp.id('wr')), 1::bigint, 'it is still there');

  r := pg_temp.del('acme_agent1', 'r2');
  PERFORM pg_temp.is(r::jsonb ->> 'deleted', 'true', 'the owner deletes a current plan''s renewal');
  PERFORM pg_temp.is(r::jsonb ->> 'with_whom', 'Aetna', 'and is told which');
  PERFORM pg_temp.is((SELECT count(*) FROM public.renewals WHERE id = pg_temp.id('r2')), 0::bigint, 'it is gone');

  -- a by-hand PEO placement renewal takes its placement with it: the account is a client no longer
  PERFORM pg_temp.is(public.account_status(pg_temp.id('a1')), 'client', 'a1 is a client (its placements)');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.add_renewal('acme_agent1', 'a3', 'peo_placement', 'TriNet', current_date + 10)), 'PT404', 'an agent does not see the unowned account (so nothing is made)');
  r := pg_temp.add_renewal('acme_owner', 'a3', 'peo_placement', 'TriNet', current_date + 10);
  INSERT INTO fx VALUES ('r4', (r::jsonb -> 'renewal' ->> 'id')::uuid), ('p4', (r::jsonb -> 'placement' ->> 'id')::uuid);
  PERFORM pg_temp.is(public.account_status(pg_temp.id('a3')), 'client', 'a3 is a client with its placement');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.del('acme_owner', 'r4')), 'ok', 'deleting its renewal');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE id = pg_temp.id('p4')), 0::bigint, 'takes the placement made with it by hand');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('a3')), 'prospect', 'and the account is not a client');
  -- a placement a win made is never deleted by deleting a renewal of it (D-452: the win can only be reopened)
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE id = pg_temp.id('wr_p')), 1::bigint, 'a win''s placement is still there');
END $$;
