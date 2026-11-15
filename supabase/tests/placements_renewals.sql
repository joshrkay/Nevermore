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


-- ---------- history and version (D-453) ----------
-- Break caught: a renewal's or placement's changes are not written (a person can't see who moved a date); its history is read by someone who may not see the
-- account, or by another firm; the history of a deleted renewal or placement is kept after it (the history is kept as long as the record is, D-45) or
-- deleted while the record is still there; the history domain does not know the two tables; the opportunity link or the placement a product sets is written
-- as the person's own field.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r1 text := pg_temp.id('r1')::text; p1 text := pg_temp.id('p1')::text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((SELECT string_agg(kind || ':' || COALESCE(field, ''), ',' ORDER BY kind DESC, field) FROM public.record_history_list(acme, 'renewals', r1)),
    'created:,changed:renews_on,changed:renews_on,changed:with_whom', 'a renewal''s history: its making, and each field changed (the date twice: the first edit, then the owner''s)');
  PERFORM pg_temp.is((SELECT to_value FROM public.record_history_list(acme, 'renewals', r1) WHERE field = 'with_whom'), '"Justworks PEO"'::jsonb, 'with the value it was changed to');
  PERFORM pg_temp.is((SELECT string_agg(kind || ':' || COALESCE(field, ''), ',' ORDER BY kind DESC, field) FROM public.record_history_list(acme, 'placements', p1)),
    'created:,changed:peo_name', 'a placement''s: its making and the PEO changed with the renewal''s');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'renewals', pg_temp.id('wr')::text)) > 0, true, 'a renewal a win would make has one too');
  PERFORM pg_temp.as_user('acme_agent2', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'renewals', %L)$q$, acme, r1)), 'PT404', 'another agent may not read a renewal''s history');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'placements', %L)$q$, acme, p1)), 'PT404', 'nor a placement''s');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(acme, 'renewals', r1)) > 0, true, 'an owner of the firm reads it');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'renewals', %L)$q$, acme, pg_temp.id('zr1')::text)), 'PT404', 'but not another firm''s renewal, asked for under their own firm');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'renewals', %L)$q$, acme, r1)), 'PT404', 'another firm''s owner is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT * FROM public.record_history_list(%L, 'renewals', %L)$q$, pg_temp.id('zenith'), r1)), 'PT404', 'and asking under their own firm finds nothing');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history_list(pg_temp.id('zenith'), 'renewals', pg_temp.id('zr1')::text)) > 0, true, 'a firm''s own owner reads its renewal''s');
  RESET ROLE;

  -- kept while the record is, gone with it
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'renewals' AND h.record_key = r1) > 0, true, 'the history is stored');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'renewals' AND h.record_key = pg_temp.id('r2')::text), 0::bigint, 'a deleted renewal''s history went with it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'placements' AND h.record_key = pg_temp.id('p4')::text), 0::bigint, 'and a deleted placement''s');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'renewals', r1), true, 'the history asks, and a renewal that is there exists');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'renewals', pg_temp.id('r2')::text), false, 'one that was deleted does not');
  PERFORM pg_temp.is(public.record_history_record_exists(acme, 'placements', p1), true, 'nor a placement that is there');
  PERFORM pg_temp.is(public.record_history_record_exists(pg_temp.id('zenith'), 'placements', p1), false, 'it is not in another firm');
  PERFORM pg_temp.is(public.record_history_can_see(acme, 'renewals', r1) IS NOT NULL, true, 'the visibility question is asked');

  -- the links the product sets are not the person's fields; a renewal's working opportunity is
  PERFORM pg_temp.opportunity('lk_o', 'a1', 'acme_agent1');
  UPDATE public.placements SET opportunity_id = pg_temp.id('lk_o') WHERE id = pg_temp.id('p1b');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'placements' AND h.record_key = pg_temp.id('p1b')::text AND h.kind = 'changed'), 0::bigint, 'a placement''s opportunity is not a tracked field');
  PERFORM pg_temp.is((SELECT version FROM public.placements WHERE id = pg_temp.id('p1b')), 1, 'and does not move its version');
  UPDATE public.placements SET opportunity_id = NULL WHERE id = pg_temp.id('p1b');
  UPDATE public.renewals SET opportunity_id = pg_temp.id('lk_o') WHERE id = pg_temp.id('r1b');
  PERFORM pg_temp.is((SELECT string_agg(field, ',') FROM public.record_history h WHERE h.table_name = 'renewals' AND h.record_key = pg_temp.id('r1b')::text AND h.kind = 'changed'), 'opportunity_id', 'a renewal''s working opportunity is');
  PERFORM pg_temp.is((SELECT version FROM public.renewals WHERE id = pg_temp.id('r1b')), 2, 'and moves its version');
  UPDATE public.renewals SET opportunity_id = NULL WHERE id = pg_temp.id('r1b');
END $$;

-- ---------- closing a firm (D-407) ----------
-- Break caught: the closing's list lacks either table (a firm that closes keeps its renewals); deletes the placements before the renewals or either one after
-- the opportunities and accounts they stand on, so the closing fails on a foreign key; or drops a line it had.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT action FROM public.firm_closing_plan() WHERE src = 'public.renewals'), 'delete', 'closing a firm deletes its renewals');
  PERFORM pg_temp.is((SELECT action FROM public.firm_closing_plan() WHERE src = 'public.placements'), 'delete', 'and its placements');
  PERFORM pg_temp.is((SELECT firm_column FROM public.firm_closing_plan() WHERE src = 'public.placements'), 'firm_id', 'by the firm');
  PERFORM pg_temp.is((SELECT ord FROM public.firm_closing_plan() WHERE src = 'public.renewals') < (SELECT ord FROM public.firm_closing_plan() WHERE src = 'public.placements'), true, 'the renewals first');
  PERFORM pg_temp.is((SELECT ord FROM public.firm_closing_plan() WHERE src = 'public.placements') < (SELECT min(ord) FROM public.firm_closing_plan() WHERE src IN ('public.opportunities', 'public.contacts', 'public.accounts')), true, 'both before the records they stand on');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() WHERE src IN ('public.accounts', 'public.contacts', 'public.opportunities', 'public.activities', 'public.record_history', 'public.referral_partners')), 6::bigint, 'and every line it had is kept');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() WHERE action = 'keep'), 34::bigint, 'with every kept table');
END $$;


-- ---------- "Didn't renew" and its undo (D-451) ----------
CREATE FUNCTION pg_temp.ver(p_renewal text) RETURNS integer LANGUAGE sql AS $$ SELECT version FROM public.renewals WHERE id = pg_temp.id(p_renewal) $$;
CREATE FUNCTION pg_temp.didnt(who text, p_renewal text, p_on date, p_version integer) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.mark_renewal_not_renewed(%L, %L, %L, %L)::text', pg_temp.id(p_renewal), p_on, pg_temp.fid(who), p_version))
$$;
CREATE FUNCTION pg_temp.undo(who text, p_renewal text, p_version integer) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.undo_renewal_not_renewed(%L, %L, %L)::text', pg_temp.id(p_renewal), pg_temp.fid(who), p_version))
$$;

-- Break caught: marking a renewal not renewed leaves its placement running (the account stays a client, D-451); ends a placement the renewal did not come from;
-- sets a date before the placement began (a check the table would raise as an error nobody can read); keeps no date; the undo leaves the placement ended or
-- the renewal marked (the account never comes back); a current plan's renewal ends something it has not got; both ignore the version; a renewal that a win
-- already renewed is marked as not renewed.
DO $$
DECLARE r text; j jsonb;
BEGIN
  PERFORM pg_temp.account('nr', 'acme', 'acme_agent1');
  r := pg_temp.add_renewal('acme_agent1', 'nr', 'peo_placement', 'Justworks', current_date + 40, current_date - 325);
  INSERT INTO fx VALUES ('nr1', (r::jsonb -> 'renewal' ->> 'id')::uuid), ('nr1_p', (r::jsonb -> 'placement' ->> 'id')::uuid);
  PERFORM pg_temp.is(public.account_status(pg_temp.id('nr')), 'client', 'the account is a client with its placement running');

  r := pg_temp.didnt('acme_agent1', 'nr1', current_date + 40, 1);
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner marks it "Didn''t renew" with a date');
  j := r::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, false, 'no conflict');
  PERFORM pg_temp.is(j -> 'record' ->> 'not_renewed_on', to_char(current_date + 40, 'YYYY-MM-DD'), 'the date is kept on the renewal');
  PERFORM pg_temp.is(j -> 'record' ->> 'done', 'true', 'it is done');
  PERFORM pg_temp.is(j -> 'record' ->> 'outcome', 'not_renewed', 'as not renewed');
  PERFORM pg_temp.is((j -> 'record' ->> 'version')::int, 2, 'a new version');
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = pg_temp.id('nr1_p')), current_date + 40, 'the placement it came from ends on that day');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('nr')), 'former_client', 'and the account is a former client');
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = pg_temp.id('p1b')), NULL::date, 'another account''s placements are not ended');

  -- the undo brings both back
  r := pg_temp.undo('acme_agent1', 'nr1', 2);
  PERFORM pg_temp.is(r::jsonb -> 'record' ->> 'not_renewed_on', NULL::text, 'undo clears the date');
  PERFORM pg_temp.is(r::jsonb -> 'record' ->> 'done', 'false', 'the renewal is not done');
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = pg_temp.id('nr1_p')), NULL::date, 'the placement is not ended');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('nr')), 'client', 'and the account is a client again');
  PERFORM pg_temp.is((r::jsonb -> 'record' ->> 'version')::int, 3, 'each is a version');

  -- a different day can be given by marking again (the placement ends on the new day)
  PERFORM pg_temp.didnt('acme_agent1', 'nr1', current_date + 41, 3);
  r := pg_temp.didnt('acme_agent1', 'nr1', current_date + 45, 4);
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = pg_temp.id('nr1_p')), current_date + 45, 'marked again, the placement ends on the later day');
  PERFORM pg_temp.undo('acme_agent1', 'nr1', 5);

  -- the date is needed, and not before the placement began
  PERFORM pg_temp.is(pg_temp.didnt('acme_agent1', 'nr1', NULL, 6), '22023: Give the day it didn''t renew.', 'a date is asked for');
  PERFORM pg_temp.is(pg_temp.didnt('acme_agent1', 'nr1', current_date - 326, 6), '22023: The placement started on ' || to_char(current_date - 325, 'YYYY-MM-DD') || ', so it can''t end before.', 'not before the placement began');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.didnt('acme_agent1', 'nr1', current_date - 325, 6)), 'ok', 'the day it began is allowed');
  PERFORM pg_temp.undo('acme_agent1', 'nr1', 7);

  -- a current plan's renewal has no placement to end
  r := pg_temp.add_renewal('acme_agent1', 'nr', 'current_plan', 'Aetna', current_date + 12);
  INSERT INTO fx VALUES ('nr2', (r::jsonb -> 'renewal' ->> 'id')::uuid);
  r := pg_temp.didnt('acme_agent1', 'nr2', current_date + 12, 1);
  PERFORM pg_temp.is(r::jsonb -> 'record' ->> 'done', 'true', 'a current plan''s renewal can be marked too');
  PERFORM pg_temp.is(public.account_status(pg_temp.id('nr')), 'client', 'and the account''s placement is untouched');
  PERFORM pg_temp.is((SELECT count(*) FROM public.placements WHERE account_id = pg_temp.id('nr') AND ended_on IS NOT NULL), 0::bigint, 'none ended');

  -- the version
  j := pg_temp.didnt('acme_agent1', 'nr1', current_date + 40, 1)::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'a save from an old version is a conflict');
  PERFORM pg_temp.is((j ->> 'currentVersion')::int, pg_temp.ver('nr1'), 'naming the version it is at');
  PERFORM pg_temp.is(j -> 'current' ->> 'not_renewed_on', NULL::text, 'and what is there now');
  PERFORM pg_temp.is((SELECT ended_on FROM public.placements WHERE id = pg_temp.id('nr1_p')), NULL::date, 'nothing was saved');
  PERFORM pg_temp.is(pg_temp.didnt('acme_agent1', 'nr1', current_date + 40, NULL),
    '22023: This save did not say which version of the renewal it started from, so it was refused. Reload the page and try again.', 'no version');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.didnt('acme_agent1', 'nr1', current_date + 40, 99)), '22023', 'a version it never had');
  PERFORM pg_temp.is(pg_temp.undo('acme_agent1', 'nr1', NULL),
    '22023: This save did not say which version of the renewal it started from, so it was refused. Reload the page and try again.', 'the undo needs one too');
  j := pg_temp.undo('acme_agent1', 'nr1', 1)::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'an undo from an old version is a conflict');
  PERFORM pg_temp.didnt('acme_agent1', 'nr1', current_date + 40, pg_temp.ver('nr1'));
  j := pg_temp.undo('acme_agent1', 'nr1', 1)::jsonb;
  PERFORM pg_temp.is((j ->> 'conflict')::boolean, true, 'and one that would undo what a later save did');
  PERFORM pg_temp.is(j -> 'current' ->> 'not_renewed_on', to_char(current_date + 40, 'YYYY-MM-DD'), 'it shows the day now there');
  PERFORM pg_temp.is((SELECT string_agg(c ->> 'field', ',') FROM jsonb_array_elements(j -> 'changed') c), 'not_renewed_on', 'and the field that was changed');
  PERFORM pg_temp.undo('acme_agent1', 'nr1', pg_temp.ver('nr1'));
END $$;

-- Break caught: a renewal a win has already renewed (its working opportunity is Won) is marked as not renewed, so it is "done" two ways and the account
-- is a former client while its newest placement runs.
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.account('wn', 'acme', 'acme_agent1');
  r := pg_temp.add_renewal('acme_agent1', 'wn', 'peo_placement', 'Justworks', current_date + 5);
  INSERT INTO fx VALUES ('wn1', (r::jsonb -> 'renewal' ->> 'id')::uuid);
  PERFORM pg_temp.intake('wn_i', 'acme');
  PERFORM pg_temp.opportunity('wn_o', 'wn', 'acme_agent1', 'wn_i');
  UPDATE public.renewals SET opportunity_id = pg_temp.id('wn_o') WHERE id = pg_temp.id('wn1');
  PERFORM pg_temp.is(pg_temp.didnt('acme_agent1', 'wn1', current_date + 5, pg_temp.ver('wn1')) LIKE '%"conflict": false%', true, 'while the opportunity is open, it can be marked');
  PERFORM pg_temp.undo('acme_agent1', 'wn1', pg_temp.ver('wn1'));
  PERFORM pg_temp.move('wn_i', 'won');
  PERFORM pg_temp.is(pg_temp.didnt('acme_agent1', 'wn1', current_date + 5, pg_temp.ver('wn1')),
    'PT409: This renewal was renewed, so it can''t be marked as not renewed.', 'once the opportunity is won, it can not');
  PERFORM pg_temp.is((SELECT not_renewed_on FROM public.renewals WHERE id = pg_temp.id('wn1')), NULL::date, 'nothing was saved');
END $$;

-- Break caught: either function skips the questions every write asks, or asks them in another order (a closing firm or support session refused first, then who
-- may see, then who may change).
DO $$
DECLARE sess uuid; r text;
BEGIN
  PERFORM pg_temp.is(pg_temp.code(pg_temp.didnt('acme_agent2', 'nr1', current_date, pg_temp.ver('nr1'))), 'PT404', 'someone who may not see the account: not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.undo('acme_agent2', 'nr1', pg_temp.ver('nr1'))), 'PT404', 'nor the undo');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.didnt('acme_agent1', 'zr1', current_date, 1)), 'PT404', 'another firm''s renewal is not there');
  r := pg_temp.didnt('zenith_agent2', 'zr1', current_date, pg_temp.ver('zr1'));
  PERFORM pg_temp.is(left(r, 6), '42501:', 'one who sees but may not change it is refused');
  PERFORM pg_temp.is(left(pg_temp.undo('zenith_agent2', 'zr1', pg_temp.ver('zr1')), 6), '42501:', 'and the undo');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.didnt('acme_removed', 'nr1', current_date, 1)), '42501', 'a former member');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.didnt('zenith_owner', 'zr1', current_date, pg_temp.ver('zr1'))), 'ok', 'a firm''s owner may');
  PERFORM pg_temp.undo('zenith_owner', 'zr1', pg_temp.ver('zr1'));

  -- a closing firm and Nevermore support change nothing, whichever function (ADR 0023, ADR 0024): the guard is asked before anything else, so even a renewal
  -- the caller could not see answers PT423
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.add_renewal('acme_owner', 'a1', 'current_plan', 'X', current_date), 6), 'PT423:', 'a closing firm adds nothing');
  PERFORM pg_temp.is(left(pg_temp.upd('acme_owner', 'r1', 'X', current_date, pg_temp.ver('r1')), 6), 'PT423:', 'edits nothing');
  PERFORM pg_temp.is(left(pg_temp.del('acme_owner', 'r1'), 6), 'PT423:', 'deletes nothing');
  PERFORM pg_temp.is(left(pg_temp.didnt('acme_owner', 'nr1', current_date, pg_temp.ver('nr1')), 6), 'PT423:', 'marks nothing');
  PERFORM pg_temp.is(left(pg_temp.undo('acme_owner', 'nr1', pg_temp.ver('nr1')), 6), 'PT423:', 'undoes nothing');
  PERFORM pg_temp.is(left(pg_temp.didnt('acme_agent2', 'nr1', current_date, pg_temp.ver('nr1')), 6), 'PT423:', 'and the guard comes before the rule that hides the account');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an account the firm asked about') t);
  PERFORM pg_temp.is(left(pg_temp.add_renewal('platform_admin', 'a1', 'current_plan', 'X', current_date), 6), 'PT423:', 'Nevermore support adds nothing');
  PERFORM pg_temp.is(left(pg_temp.upd('platform_admin', 'r1', 'X', current_date, pg_temp.ver('r1')), 6), 'PT423:', 'edits nothing');
  PERFORM pg_temp.is(left(pg_temp.del('platform_admin', 'r1'), 6), 'PT423:', 'deletes nothing');
  PERFORM pg_temp.is(left(pg_temp.didnt('platform_admin', 'nr1', current_date, pg_temp.ver('nr1')), 6), 'PT423:', 'marks nothing');
  PERFORM pg_temp.is(left(pg_temp.undo('platform_admin', 'nr1', pg_temp.ver('nr1')), 6), 'PT423:', 'undoes nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
END $$;


-- ---------- reading an account's renewals (D-448, D-449, D-454) ----------
CREATE FUNCTION pg_temp.renewals_of(who text, p_account text, p_tz text DEFAULT 'UTC') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, pg_temp.addr(who), format('SELECT public.account_renewals(%L, %L, %L)::text', pg_temp.fid(who), pg_temp.id(p_account), p_tz))
$$;
-- One row of the answer by the renewal's name.
CREATE FUNCTION pg_temp.row_of(j jsonb, p_renewal text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT e.value FROM jsonb_array_elements(j -> 'rows') e WHERE e.value ->> 'id' = pg_temp.id(p_renewal)::text
$$;

-- Break caught: the list leaves out what a person needs (what, with whom, the date, how far away, the opportunity working it, whether it is done); days away
-- is stored or taken from another day than the caller's (D-448: worked out each time, from today); a past renewal not done reads as done; done is read from
-- anything but the opportunity being Won and the not-renewed day (D-449); a lost opportunity makes it done; the list is another account's or another firm's.
DO $$
DECLARE r text; j jsonb; one jsonb;
BEGIN
  PERFORM pg_temp.account('rd', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('rd_empty', 'acme', 'acme_agent1');
  r := pg_temp.add_renewal('acme_agent1', 'rd', 'peo_placement', 'Justworks', current_date + 45);        INSERT INTO fx VALUES ('rd_a', (r::jsonb -> 'renewal' ->> 'id')::uuid);
  r := pg_temp.add_renewal('acme_agent1', 'rd', 'current_plan', 'Aetna', current_date);                   INSERT INTO fx VALUES ('rd_b', (r::jsonb -> 'renewal' ->> 'id')::uuid);
  r := pg_temp.add_renewal('acme_agent1', 'rd', 'current_plan', 'Cigna', current_date - 12);               INSERT INTO fx VALUES ('rd_c', (r::jsonb -> 'renewal' ->> 'id')::uuid);
  r := pg_temp.add_renewal('acme_agent1', 'rd', 'peo_placement', 'Gusto', current_date + 300);            INSERT INTO fx VALUES ('rd_d', (r::jsonb -> 'renewal' ->> 'id')::uuid);
  r := pg_temp.add_renewal('acme_agent1', 'rd', 'peo_placement', 'TriNet', current_date + 100);           INSERT INTO fx VALUES ('rd_e', (r::jsonb -> 'renewal' ->> 'id')::uuid);
  r := pg_temp.add_renewal('acme_agent1', 'rd', 'current_plan', 'Kaiser', current_date + 200);            INSERT INTO fx VALUES ('rd_f', (r::jsonb -> 'renewal' ->> 'id')::uuid);
  -- rd_d is worked by an opportunity that was won (renewed); rd_e by one that was lost; rd_f by one still open; rd_c is marked not renewed
  PERFORM pg_temp.intake('rd_won_i', 'acme');  PERFORM pg_temp.opportunity('rd_won', 'rd', 'acme_agent1', 'rd_won_i');  PERFORM pg_temp.move('rd_won_i', 'won');
  PERFORM pg_temp.intake('rd_lost_i', 'acme'); PERFORM pg_temp.opportunity('rd_lost', 'rd', 'acme_agent1', 'rd_lost_i'); PERFORM pg_temp.move('rd_lost_i', 'lost');
  PERFORM pg_temp.opportunity('rd_open', 'rd', 'acme_agent1');
  UPDATE public.renewals SET opportunity_id = pg_temp.id('rd_won') WHERE id = pg_temp.id('rd_d');
  UPDATE public.renewals SET opportunity_id = pg_temp.id('rd_lost') WHERE id = pg_temp.id('rd_e');
  UPDATE public.renewals SET opportunity_id = pg_temp.id('rd_open') WHERE id = pg_temp.id('rd_f');
  PERFORM pg_temp.didnt('acme_agent1', 'rd_c', current_date - 12, pg_temp.ver('rd_c'));

  r := pg_temp.renewals_of('acme_agent1', 'rd');
  PERFORM pg_temp.is(pg_temp.code(r), 'ok', 'the owner of the account reads its renewals');
  j := r::jsonb;
  PERFORM pg_temp.is((j ->> 'count')::int, 6, 'six renewals');
  PERFORM pg_temp.is(jsonb_array_length(j -> 'rows'), 6, 'six rows');
  PERFORM pg_temp.is((j ->> 'can_change')::boolean, true, 'the owner may change them');
  one := pg_temp.row_of(j, 'rd_a');
  PERFORM pg_temp.is(one - 'id' - 'account_id' - 'placement_id' - 'version', jsonb_build_object('kind', 'peo_placement', 'with_whom', 'Justworks',
    'renews_on', to_char(current_date + 45, 'YYYY-MM-DD'), 'days_away', 45, 'opportunity', NULL, 'not_renewed_on', NULL, 'done', false, 'outcome', NULL, 'made_by_win', false),
    'what, with whom, the date, 45 days away, no opportunity, not done');
  PERFORM pg_temp.is((pg_temp.row_of(j, 'rd_b') ->> 'days_away')::int, 0, 'today is 0 days away');
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_b') ->> 'done', 'false', 'a renewal today is not done');
  -- rd_c is past and marked not renewed: done. A past one not done would read negative and not done (below).
  PERFORM pg_temp.is((pg_temp.row_of(j, 'rd_c') ->> 'days_away')::int, -12, 'twelve days ago is -12');
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_c') ->> 'outcome', 'not_renewed', 'marked "Didn''t renew": done');
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_d') ->> 'outcome', 'renewed', 'its opportunity Won: done, renewed');
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_d') ->> 'done', 'true', 'done');
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_d') -> 'opportunity' ->> 'name', 'PEO search rd_won', 'it names the opportunity');
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_d') -> 'opportunity' ->> 'stage', 'won', 'and its stage');
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_e') ->> 'done', 'false', 'a lost opportunity does not make it done');
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_e') -> 'opportunity' ->> 'stage', 'lost', 'it shows the opportunity, lost');
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_f') ->> 'done', 'false', 'an open opportunity does not make it done');
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_f') -> 'opportunity' ->> 'stage', 'qualifying', 'it shows the open opportunity''s stage');
  PERFORM pg_temp.is((SELECT string_agg(left(e.value ->> 'with_whom', 6), ',') FROM jsonb_array_elements(j -> 'rows') e), 'Aetna,Justwo,TriNet,Kaiser,Cigna,Gusto',
    'not done first, soonest first; done after');

  -- a past renewal not done reads negative and not done (D-448: shown in the warning colour)
  UPDATE public.renewals SET not_renewed_on = NULL WHERE id = pg_temp.id('rd_c');
  j := pg_temp.renewals_of('acme_agent1', 'rd')::jsonb;
  PERFORM pg_temp.is(pg_temp.row_of(j, 'rd_c') ->> 'done', 'false', 'a past renewal not done is not done');
  PERFORM pg_temp.is((SELECT e.value ->> 'with_whom' FROM jsonb_array_elements(j -> 'rows') e LIMIT 1), 'Cigna', 'and comes first, overdue');

  -- days away follows the caller's day
  PERFORM pg_temp.is((pg_temp.row_of(pg_temp.renewals_of('acme_agent1', 'rd', 'Pacific/Kiritimati')::jsonb, 'rd_a') ->> 'days_away')::int
    <= (pg_temp.row_of(pg_temp.renewals_of('acme_agent1', 'rd', 'Etc/GMT+12')::jsonb, 'rd_a') ->> 'days_away')::int - 1, true, 'days away is counted from the caller''s own today');

  -- who reads them: whoever may see the account, nothing for anyone else
  PERFORM pg_temp.is(pg_temp.renewals_of('acme_agent2', 'rd'), NULL::text, 'someone who may not see the account reads nothing, as for an account not there');
  PERFORM pg_temp.is(pg_temp.renewals_of('zenith_owner', 'rd'), NULL::text, 'another firm''s owner reads nothing');
  PERFORM pg_temp.is(pg_temp.renewals_of('acme_owner', 'rd') IS NOT NULL, true, 'an owner of the firm reads them');
  PERFORM pg_temp.is((pg_temp.renewals_of('acme_owner', 'rd')::jsonb ->> 'can_change')::boolean, true, 'and may change them');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.account_renewals(%L, %L)::text', pg_temp.id('zenith'), pg_temp.id('rd'))), NULL::text, 'naming the wrong firm: nothing');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format('SELECT public.account_renewals(%L, %L)::text', pg_temp.id('acme'), gen_random_uuid())), NULL::text, 'an account that is not there: nothing');
  PERFORM pg_temp.is(pg_temp.as_call('platform_admin', 'acme-brokers', format('SELECT public.account_renewals(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('rd'))), NULL::text, 'a platform admin who is no member: nothing');
  PERFORM pg_temp.is(pg_temp.as_call('acme_removed', 'acme-brokers', format('SELECT public.account_renewals(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('rd'))), NULL::text, 'a former member: nothing');
  -- Zenith shows everyone everything: one who may see an account reads its renewals but may not change them
  j := pg_temp.renewals_of('zenith_agent2', 'z1')::jsonb;
  PERFORM pg_temp.is((j ->> 'count')::int, 2, 'a member who sees a colleague''s account reads its renewals');
  PERFORM pg_temp.is((j ->> 'can_change')::boolean, false, 'and is told they may not change them');
  -- an account with none
  PERFORM pg_temp.is(pg_temp.renewals_of('acme_agent1', 'rd_empty')::jsonb, jsonb_build_object('count', 0, 'rows', '[]'::jsonb, 'can_change', true), 'an account with no renewal: none, to add one');
END $$;
