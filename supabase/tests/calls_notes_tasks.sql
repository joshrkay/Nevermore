-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh calls_notes_tasks
-- Calls, notes and tasks (story CRM-E1.5; docs/BROKER_CRM_BUILD.md D-24, D-28, D-29, D-33, D-200, D-204, D-209, D-212; 20261119180000_calls_notes_tasks.sql).
-- Logging a call, a note or a task on an account (and a contact), the follow-up task of a call, the note rule (a day, its writer, dated additions), tasks done,
-- who may see and change them, the Activity tab's one list and its filters, deletion and closing. Two firms are used throughout: Acme sees by level,
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
\i supabase/migrations/20261121100000_merge_records.sql
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
-- Calls a function as a person at an address and answers its jsonb, or the SQLSTATE and message it raised.
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

-- Writes a call, a note or a task straight into the table as the superuser, for cases only time can make (a note a day old).
CREATE FUNCTION pg_temp.raw_note(n text, p_account text, p_author text, p_age interval, p_body text DEFAULT 'An old note') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
  INSERT INTO public.activities (firm_id, account_id, kind, author_id, body, at, created_at)
  SELECT a.firm_id, a.id, 'note', pg_temp.id(p_author), p_body, now() - p_age, now() - p_age FROM public.accounts a WHERE a.id = pg_temp.id(p_account) RETURNING id INTO r;
  INSERT INTO fx VALUES (n, r);
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.keep(n text, r text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO fx VALUES (n, (r::jsonb -> 'activity' ->> 'id')::uuid);
  RETURN r;
END $$;

-- ---------- the records ----------
-- Acme (by level): a1 is agent1's, with two contacts (e1 the main one) and two opportunities; a2 is agent2's (in Sales); a3 has no owner.
-- Zenith (everyone sees everything): z1 is zenith_agent's.
DO $$
BEGIN
  PERFORM pg_temp.account('a1', 'acme', 'acme_agent1', 'Harborview Dental Group');
  PERFORM pg_temp.account('a2', 'acme', 'acme_agent2');
  PERFORM pg_temp.account('a3', 'acme', NULL);
  PERFORM pg_temp.account('z1', 'zenith', 'zenith_agent', 'Zenith client');
  PERFORM pg_temp.account('z2', 'zenith', 'zenith_agent2', 'Other Zenith client');
  PERFORM pg_temp.contact('e1', 'a1', 'acme_agent1', 'elena@harborview.example', NULL, true);
  PERFORM pg_temp.contact('e2', 'a1', 'acme_agent1', 'sam@harborview.example');
  PERFORM pg_temp.contact('e3', 'a2', 'acme_agent2', 'a2@example.test');
  PERFORM pg_temp.contact('ze1', 'z1', 'zenith_agent', 'ze1@example.test');
  PERFORM pg_temp.opportunity('o1', 'a1', 'acme_agent1');
  PERFORM pg_temp.opportunity('o2', 'a1', 'acme_agent1');
  PERFORM pg_temp.opportunity('o3', 'a2', 'acme_agent2');
  PERFORM pg_temp.opportunity('zo1', 'z1', 'zenith_agent');
END $$;

-- ---------- the table ----------
-- Break caught: the table can be written through the API; or read by someone who may not see its account; or a firm's activity answers to another firm.
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.is(has_table_privilege('authenticated', 'public.activities', 'INSERT') OR has_table_privilege('authenticated', 'public.activities', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.activities', 'DELETE') OR has_table_privilege('authenticated', 'public.activities', 'TRUNCATE'), false, 'no API role writes activities');
  PERFORM pg_temp.is(has_table_privilege('service_role', 'public.activities', 'INSERT') OR has_table_privilege('service_role', 'public.activities', 'UPDATE')
    OR has_table_privilege('service_role', 'public.activities', 'DELETE'), false, 'nor the service role');
  PERFORM pg_temp.is(has_table_privilege('anon', 'public.activities', 'SELECT'), false, 'a signed-out caller reads none');
  PERFORM pg_temp.is((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.activities'::regclass), true, 'row security is on');
END $$;

-- ---------- logging a call with a follow-up task ----------
-- Break caught: the follow-up is not written in the call's step (or the call is kept when the follow-up fails); the follow-up is not on the call's account,
-- contact and opportunity; the follow-up is for someone else by default; the call is not the caller's.
DO $$
DECLARE r text; j jsonb; acme uuid := pg_temp.id('acme');
BEGIN
  r := pg_temp.keep('call1', pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('call', %L, %L, %L, now() - interval '1 hour', 'spoke', '  Elena has the 2024 loss run.  ', NULL, NULL, NULL, 'Check the loss run arrived', current_date + 1, NULL, %L)::text$q$,
    pg_temp.id('a1'), pg_temp.id('e1'), pg_temp.id('o1'), acme)));
  j := r::jsonb;
  PERFORM pg_temp.is(j -> 'activity' ->> 'type', 'call', 'a call is logged');
  PERFORM pg_temp.is(j -> 'activity' ->> 'body', 'Elena has the 2024 loss run.', 'what was said, trimmed');
  PERFORM pg_temp.is(j -> 'activity' ->> 'outcome', 'spoke', 'how it went');
  PERFORM pg_temp.is(j -> 'activity' -> 'contact' ->> 'name', 'First e1 Last e1', 'with the contact, by name');
  PERFORM pg_temp.is(j -> 'activity' -> 'opportunity' ->> 'name', 'PEO search o1', 'about the opportunity, by name');
  PERFORM pg_temp.is(j -> 'activity' ->> 'who', 'acme_agent1@example.test', 'by the caller');
  PERFORM pg_temp.is((j -> 'activity' ->> 'at')::timestamptz < now() - interval '30 minutes', true, 'at the time given');
  PERFORM pg_temp.is(j -> 'activity' ->> 'can_edit', 'true', 'the caller may edit it');
  PERFORM pg_temp.is(j -> 'follow_up' ->> 'type', 'task', 'the follow-up is a task');
  PERFORM pg_temp.is(j -> 'follow_up' ->> 'title', 'Check the loss run arrived', 'what the follow-up is');
  PERFORM pg_temp.is(j -> 'follow_up' ->> 'due_on', to_char(current_date + 1, 'YYYY-MM-DD'), 'when it is due');
  PERFORM pg_temp.is(j -> 'follow_up' -> 'assignee' ->> 'id', pg_temp.id('acme_agent1')::text, 'for the caller when nobody is named');
  PERFORM pg_temp.is(j -> 'follow_up' -> 'contact' ->> 'id', pg_temp.id('e1')::text, 'on the call''s contact');
  PERFORM pg_temp.is(j -> 'follow_up' -> 'opportunity' ->> 'id', pg_temp.id('o1')::text, 'and opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('a1')), 2::bigint, 'two rows');
  INSERT INTO fx VALUES ('follow1', (j -> 'follow_up' ->> 'id')::uuid);

  -- A follow-up that can't be written leaves no call behind.
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, 'spoke', 'Hello', NULL, NULL, NULL, 'Send it', current_date, %L, %L)::text$q$, pg_temp.id('a1'), pg_temp.id('zenith_agent'), acme));
  PERFORM pg_temp.is(pg_temp.code(r), '22023', 'a follow-up for someone outside the firm is refused');
  PERFORM pg_temp.is(r, '22023: Choose someone from the firm for the follow-up task.', 'in words');
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, 'spoke', 'Hello', NULL, NULL, NULL, 'Send it', NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme));
  PERFORM pg_temp.is(r, '22023: Choose when the follow-up task is due.', 'a follow-up with no date is refused, and says so');
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, 'spoke', 'Hello', NULL, NULL, NULL, NULL, current_date, NULL, %L)::text$q$, pg_temp.id('a1'), acme));
  PERFORM pg_temp.is(r, '22023: Say what the follow-up task is.', 'a follow-up date with no task is refused');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('a1')), 2::bigint, 'nothing was left behind by the refused ones');
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'A note', NULL, NULL, NULL, 'Send it', current_date, NULL, %L)::text$q$, pg_temp.id('a1'), acme));
  PERFORM pg_temp.is(r, '22023: Only a call can add a follow-up task.', 'only a call adds a follow-up');
  RAISE NOTICE 'calls_notes_tasks: a call with a follow-up passed';
END $$;

-- ---------- logging a note and a task, and what is refused ----------
-- Break caught: a blank note, a call with no outcome, a task with no words or no date, a future call, a contact or opportunity of another account, a task
-- for someone who is not in the firm (or who has left) is saved; an unknown kind is saved; the firm's name is not asked.
DO $$
DECLARE r text; acme uuid := pg_temp.id('acme');
BEGIN
  r := pg_temp.keep('note1', pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('note', %L, %L, NULL, NULL, NULL, 'Prefers email', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), pg_temp.id('e2'), acme)));
  PERFORM pg_temp.is(r::jsonb -> 'activity' ->> 'type', 'note', 'a note is logged');
  PERFORM pg_temp.is(r::jsonb -> 'activity' ->> 'editable_until' IS NOT NULL, true, 'and says until when its writer may change it');
  PERFORM pg_temp.is(r::jsonb -> 'follow_up', 'null'::jsonb, 'with no follow-up');
  r := pg_temp.keep('task1', pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('task', %L, NULL, %L, NULL, NULL, NULL, 'Send the census template', current_date, %L, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), pg_temp.id('o2'), pg_temp.id('acme_agent3'), acme)));
  PERFORM pg_temp.is(r::jsonb -> 'activity' -> 'assignee' ->> 'id', pg_temp.id('acme_agent3')::text, 'a task for another member');
  PERFORM pg_temp.is(r::jsonb -> 'activity' ->> 'done_at', NULL, 'open');

  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, '   ', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme)),
    '22023: Write the note.', 'a blank note');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme)),
    '22023: Choose how the call went.', 'a call with no outcome');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, 'chatted', 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme)),
    '22023: Choose how the call went.', 'an outcome that is not one of the four');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('call', %L, NULL, NULL, now() + interval '1 day', 'spoke', 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme)),
    '22023: A call can''t be in the future.', 'a call tomorrow');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('task', %L, NULL, NULL, NULL, NULL, NULL, '  ', current_date, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme)),
    '22023: Say what the task is.', 'a task with no words');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('task', %L, NULL, NULL, NULL, NULL, NULL, 'Do it', NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme)),
    '22023: Choose when the task is due.', 'a task with no date');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('task', %L, NULL, NULL, NULL, NULL, NULL, 'Do it', current_date, %L, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), pg_temp.id('acme_removed'), acme)),
    '22023: Choose someone from the firm for the task.', 'a task for a former member');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('task', %L, NULL, NULL, NULL, NULL, NULL, 'Do it', current_date, %L, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), pg_temp.id('zenith_agent'), acme)),
    '22023: Choose someone from the firm for the task.', 'a task for another firm''s member');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, %L, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), pg_temp.id('e3'), acme)),
    '22023: Choose a contact of this account.', 'a contact of another account');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, %L, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), pg_temp.id('o3'), acme)),
    '22023: Choose an opportunity of this account.', 'an opportunity of another account');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('email', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme)),
    '22023: Choose a call, a note or a task.', 'a kind that is not one');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, %L, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), repeat('x', 5001), acme)),
    '22023: Keep the note to 5,000 characters.', 'a note too long');
  RAISE NOTICE 'calls_notes_tasks: logging and its refusals passed';
END $$;

-- ---------- who may log on what (visibility follows the record) ----------
-- Break caught: an agent logs on a colleague's account they may not see; a member of another firm logs on this firm's; the account's firm is not the
-- firm the call acts for; a person with no firm, a former member, a platform admin or a signed-out caller logs anything; the same refusal is not given
-- for an account that is not there and one that is not theirs.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith');
BEGIN
  -- agent3 (no team) may not see agent1's account at Acme: the one answer for "not there".
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent3', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme))),
    'PT404', 'an agent logs nothing on a colleague''s account');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent3', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, gen_random_uuid(), acme))),
    'PT404', 'the same for an account that is not there');
  -- a lead sees its team's account (a2 is agent2's, in Sales): anyone who may SEE it may log on it, whoever may change it.
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_lead', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'Lead note', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a2'), acme))),
    'ok', 'a lead logs on their team''s account');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_owner', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'Owner note', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a3'), acme))),
    'ok', 'an owner logs on an account with no owner');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a3'), acme))),
    'PT404', 'an agent logs nothing on an account with no owner');
  -- in a firm that shows everyone everything, an agent sees (and so may log on) a colleague's account but may not change it (level rule)
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, 'no_answer', NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('z1'), zenith))),
    'ok', 'where everyone sees everything, any member logs on any account');
  -- another firm
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_owner', 'zenith-benefits', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme))),
    '42501', 'a member of another firm naming this firm is refused');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_owner', 'zenith-benefits', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), zenith))),
    'PT404', 'naming their own firm, an account of another firm is not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('nobody', NULL, format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, NULL)::text$q$, pg_temp.id('a1')))),
    '42501', 'a person with no firm');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_removed', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme))),
    '42501', 'a former member');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('platform_admin', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme))),
    '42501', 'a platform admin who is no member');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)$q$, pg_temp.id('a1'), acme)), '42501', 'a signed-out caller');
  PERFORM pg_temp.as_service();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)$q$, pg_temp.id('a1'), acme)), '42501', 'and the service role');
  RESET ROLE;
  RAISE NOTICE 'calls_notes_tasks: who may log passed';
END $$;

-- ---------- Nevermore support reads and writes nothing (ADR 0024) ----------
-- Break caught: a write function that does not call assert_firm_writable (a support session logs, changes, adds or marks done).
DO $$
DECLARE sess uuid; acme uuid := pg_temp.id('acme'); r text; n bigint;
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(acme, 'Looking at an account the firm asked about') t);
  RESET ROLE;
  n := (SELECT count(*) FROM public.activities);
  PERFORM pg_temp.is(pg_temp.as_call('platform_admin', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme)),
    'PT423: Nevermore support can look, not change', 'support logs nothing');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('platform_admin', 'acme-brokers', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, 'spoke', 'x', NULL, NULL, NULL, %L)::text$q$, pg_temp.id('call1'), acme))), 'PT423', 'changes nothing');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('platform_admin', 'acme-brokers', format($q$SELECT public.add_to_note(%L, 'x', %L)::text$q$, pg_temp.id('note1'), acme))), 'PT423', 'adds to nothing');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('platform_admin', 'acme-brokers', format($q$SELECT public.set_task_done(%L, true, %L)::text$q$, pg_temp.id('task1'), acme))), 'PT423', 'marks nothing done');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities), n, 'no row was written');
  -- but it reads, as an owner does
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is((public.account_tab(acme, pg_temp.id('a1'), 'activity_calls') ->> 'count')::int, 1, 'and reads what an owner reads');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  RAISE NOTICE 'calls_notes_tasks: support passed';
END $$;

-- ---------- the note rule (D-200) ----------
-- Break caught: a note is changed by someone who did not write it (an owner of the firm included); after a day; a note's addition is changed, removed or
-- put before another; a written note is moved to another account or made a call; by hand, with no function, a note is changed against the rule; "Add to
-- note" is refused to someone who may see the note; an addition is not dated and signed.
DO $$
DECLARE zenith uuid := pg_temp.id('zenith'); r text; j jsonb;
BEGIN
  r := pg_temp.keep('znote', pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.log_activity('note', %L, %L, NULL, NULL, NULL, 'Dr. Park leans toward PEB', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('z1'), pg_temp.id('ze1'), zenith)));
  -- the writer, within a day
  r := pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, 'Dr. Park leans toward PEO B', NULL, NULL, NULL, %L)::text$q$, pg_temp.id('znote'), zenith));
  PERFORM pg_temp.is(r::jsonb ->> 'body', 'Dr. Park leans toward PEO B', 'the writer changes their note within a day');
  -- someone else, who may see it, even an owner
  PERFORM pg_temp.is(pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, 'Mine now', NULL, NULL, NULL, %L)::text$q$, pg_temp.id('znote'), zenith)),
    '42501: Only the person who wrote a note can change it.', 'another member may not change it');
  PERFORM pg_temp.is(pg_temp.as_call('zenith_owner', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, 'Owner''s now', NULL, NULL, NULL, %L)::text$q$, pg_temp.id('znote'), zenith)),
    '42501: Only the person who wrote a note can change it.', 'nor an owner of the firm');
  -- a day later
  PERFORM pg_temp.raw_note('old1', 'z1', 'zenith_agent', interval '25 hours');
  PERFORM pg_temp.raw_note('fresh1', 'z1', 'zenith_agent', interval '23 hours');
  PERFORM pg_temp.is(pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, 'Late edit', NULL, NULL, NULL, %L)::text$q$, pg_temp.id('old1'), zenith)),
    '42501: A note can''t be changed after a day. Add to it instead.', 'the writer, after a day, is told to add');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, 'Not late', NULL, NULL, NULL, %L)::text$q$, pg_temp.id('fresh1'), zenith))),
    'ok', 'at 23 hours it can still be changed');
  RAISE NOTICE 'calls_notes_tasks: the note rule (functions) passed';
END $$;

-- The same rule held by the table itself, whatever writes it: as the writer's own session (a function writing for them) and as nobody (the superuser,
-- the service role, a job).
DO $$
DECLARE zenith uuid := pg_temp.id('zenith'); r text; j jsonb;
BEGIN
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET body = 'By hand' WHERE id = %L$q$, pg_temp.id('fresh1'))), '42501', 'a note is changed by no one in particular: refused');
  PERFORM pg_temp.claims_of('zenith_agent2');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET body = 'By hand' WHERE id = %L$q$, pg_temp.id('fresh1'))), '42501', 'a note changed in another member''s session is refused');
  PERFORM pg_temp.claims_of('zenith_agent');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET body = 'By hand' WHERE id = %L$q$, pg_temp.id('fresh1'))), 'rows:1', 'the writer''s own session within a day may');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET body = 'By hand' WHERE id = %L$q$, pg_temp.id('old1'))), '42501', 'but not after a day');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET at = now() WHERE id = %L$q$, pg_temp.id('old1'))), '42501', 'nor the time it was written');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET kind = 'call', outcome = 'spoke' WHERE id = %L$q$, pg_temp.id('fresh1'))), '42501', 'a note is not made a call');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET created_at = now() WHERE id = %L$q$, pg_temp.id('old1'))), '42501', 'its age is not reset');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET account_id = %L WHERE id = %L$q$, pg_temp.id('z2'), pg_temp.id('old1'))), '42501', 'it is not moved to another account');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET author_id = %L WHERE id = %L$q$, pg_temp.id('zenith_agent2'), pg_temp.id('old1'))), '42501', 'its writer is not changed');
  RESET ROLE;

  -- additions: anyone who may see the note, any time, dated and signed
  r := pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.add_to_note(%L, '  Park confirmed PEO B on the call.  ', %L)::text$q$, pg_temp.id('old1'), zenith));
  j := r::jsonb;
  PERFORM pg_temp.is(jsonb_array_length(j -> 'additions'), 1, 'an addition to a note a day old, by someone else');
  PERFORM pg_temp.is(j -> 'additions' -> 0 ->> 'text', 'Park confirmed PEO B on the call.', 'trimmed');
  PERFORM pg_temp.is(j -> 'additions' -> 0 ->> 'who', 'zenith_agent2@example.test', 'signed');
  PERFORM pg_temp.is((j -> 'additions' -> 0 ->> 'at')::timestamptz > now() - interval '1 minute', true, 'dated');
  PERFORM pg_temp.is(j ->> 'body', 'An old note', 'the note itself is as it was');
  r := pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.add_to_note(%L, 'Second', %L)::text$q$, pg_temp.id('old1'), zenith));
  PERFORM pg_temp.is(jsonb_array_length(r::jsonb -> 'additions'), 2, 'and the writer adds too');
  PERFORM pg_temp.is(r::jsonb -> 'additions' -> 1 ->> 'text', 'Second', 'at the end');
  PERFORM pg_temp.is(pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.add_to_note(%L, '   ', %L)::text$q$, pg_temp.id('old1'), zenith)), '22023: Write what to add.', 'an empty addition');
  PERFORM pg_temp.is(pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.add_to_note(%L, 'x', %L)::text$q$, pg_temp.id('task1'), zenith)), 'PT404: That isn''t available', 'a task of another firm is not there');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent3', 'acme-brokers', format($q$SELECT public.add_to_note(%L, 'x', %L)::text$q$, pg_temp.id('note1'), pg_temp.id('acme')))), 'PT404', 'a person who may not see the account adds nothing');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.add_to_note(%L, 'x', %L)::text$q$, pg_temp.id('call1'), pg_temp.id('acme'))), '22023: Only a note can be added to.', 'a call is not added to');

  -- the additions are append-only, in the table itself
  PERFORM pg_temp.claims_of('zenith_agent');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET additions = '[]' WHERE id = %L$q$, pg_temp.id('old1'))), '42501', 'additions are not taken away');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET additions = jsonb_set(additions, '{0,text}', '"Changed"') WHERE id = %L$q$, pg_temp.id('old1'))), '42501', 'nor changed');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET additions = additions - 0 WHERE id = %L$q$, pg_temp.id('old1'))), '42501', 'nor the first dropped');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET additions = jsonb_build_array(additions -> 1, additions -> 0) WHERE id = %L$q$, pg_temp.id('old1'))), '42501', 'nor reordered');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET additions = additions || '[{"at": "2026-01-01T00:00:00Z", "by": null, "text": "More"}]'::jsonb WHERE id = %L$q$, pg_temp.id('old1'))), 'rows:1', 'but one can be put at the end');
  RESET ROLE;
  RAISE NOTICE 'calls_notes_tasks: the note rule (table, additions) passed';
END $$;

-- ---------- calls and tasks stay editable; anyone who may see a task may mark it done ----------
-- Break caught: a call or a task is fixed after a day like a note; anyone who may see it may rewrite it (the level rule is not asked); its writer, the person it
-- is for or the account's owner may not; a task is not marked done by someone who may see it, or by someone who may not; done is not kept with who and when;
-- opening it again keeps the old done; a call is marked done.
DO $$
DECLARE zenith uuid := pg_temp.id('zenith'); acme uuid := pg_temp.id('acme'); r text; j jsonb;
BEGIN
  -- backdate a call and a task of agent1's by two days: the table keeps its own age, so the superuser writes them
  INSERT INTO public.activities (firm_id, account_id, kind, author_id, at, created_at, outcome, body)
  VALUES (acme, pg_temp.id('a1'), 'call', pg_temp.id('acme_agent1'), now() - interval '2 days', now() - interval '2 days', 'left_message', 'Left a message');
  INSERT INTO fx SELECT 'oldcall', id FROM public.activities WHERE body = 'Left a message';
  r := pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.update_activity(%L, %L, %L, now() - interval '1 day', 'spoke', 'Spoke after all', NULL, NULL, NULL, %L)::text$q$, pg_temp.id('oldcall'), pg_temp.id('e1'), pg_temp.id('o2'), acme));
  j := r::jsonb;
  PERFORM pg_temp.is(j ->> 'outcome', 'spoke', 'a call two days old is still editable by its writer');
  PERFORM pg_temp.is(j ->> 'body', 'Spoke after all', 'what was said');
  PERFORM pg_temp.is(j -> 'contact' ->> 'id', pg_temp.id('e1')::text, 'with a contact');
  PERFORM pg_temp.is(j -> 'opportunity' ->> 'id', pg_temp.id('o2')::text, 'about an opportunity');
  -- who else may change it: the level rule (agent1's account: agent1, their lead is not on Sales... owner of the firm yes)
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_owner', 'acme-brokers', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, 'no_answer', NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('oldcall'), acme))), 'ok', 'an owner of the firm changes a call on any account');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('oldcall'), acme)),
    '22023: Choose how the call went.', 'a call is saved with an outcome');
  -- Zenith: z1 is zenith_agent's; zenith_agent2 sees it (everyone sees everything) but may not change it
  r := pg_temp.keep('zcall', pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, 'spoke', 'Zenith call', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('z1'), zenith)));
  r := pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, 'no_answer', NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('zcall'), zenith));
  PERFORM pg_temp.is(left(r, 5), '42501', 'a member who sees a call but did not log it and does not own the account may not change it');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, 'no_answer', NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('zcall'), zenith))), 'ok', 'the writer does');
  -- the account's owner may change a colleague's call on their account
  r := pg_temp.keep('zcall2', pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, 'spoke', 'On z1 by agent2', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('z1'), zenith)));
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, 'no_answer', NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('zcall2'), zenith))), 'ok', 'the account''s owner changes a call on their account');

  -- a task: for agent3, logged by agent1 on a1 (agent3 may not see a1)
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent3', 'acme-brokers', format($q$SELECT public.set_task_done(%L, true, %L)::text$q$, pg_temp.id('task1'), acme))), 'PT404', 'a task on an account the person may not see can not be marked done, even when it is for them');
  -- a task on z1 for zenith_agent2, logged by zenith_agent
  r := pg_temp.keep('ztask', pg_temp.as_call('zenith_agent', 'zenith-benefits', format($q$SELECT public.log_activity('task', %L, NULL, NULL, NULL, NULL, NULL, 'Call Elena', current_date, %L, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('z1'), pg_temp.id('zenith_agent2'), zenith)));
  r := pg_temp.as_call('zenith_owner', 'zenith-benefits', format($q$SELECT public.set_task_done(%L, true, %L)::text$q$, pg_temp.id('ztask'), zenith));
  j := r::jsonb;
  PERFORM pg_temp.is((j ->> 'done_at') IS NOT NULL, true, 'anyone who may see it marks it done');
  PERFORM pg_temp.is(j ->> 'done_by', 'zenith_owner@example.test', 'and it says who');
  PERFORM pg_temp.is((SELECT done_by FROM public.activities WHERE id = pg_temp.id('ztask')), pg_temp.id('zenith_owner'), 'in the table');
  r := pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.set_task_done(%L, true, %L)::text$q$, pg_temp.id('ztask'), zenith));
  PERFORM pg_temp.is((SELECT done_by FROM public.activities WHERE id = pg_temp.id('ztask')), pg_temp.id('zenith_owner'), 'marking it done again keeps who did it first');
  r := pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.set_task_done(%L, false, %L)::text$q$, pg_temp.id('ztask'), zenith));
  PERFORM pg_temp.is(r::jsonb ->> 'done_at', NULL, 'it is opened again');
  PERFORM pg_temp.is((SELECT done_by FROM public.activities WHERE id = pg_temp.id('ztask')), NULL, 'with no one having done it');
  PERFORM pg_temp.is(pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.set_task_done(%L, true, %L)::text$q$, pg_temp.id('zcall'), zenith)), '22023: Only a task can be marked done.', 'a call is not marked done');
  PERFORM pg_temp.is(pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.set_task_done(%L, NULL, %L)::text$q$, pg_temp.id('ztask'), zenith)), '22023: Say whether the task is done.', 'nor with no answer');
  -- the person it is for may rewrite it; another viewer may not
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, NULL, 'Call Elena today', current_date + 2, NULL, %L)::text$q$, pg_temp.id('ztask'), zenith))), 'ok', 'the person it is for changes it');
  PERFORM pg_temp.is((SELECT title FROM public.activities WHERE id = pg_temp.id('ztask')), 'Call Elena today', 'the words');
  PERFORM pg_temp.is((SELECT assignee_id FROM public.activities WHERE id = pg_temp.id('ztask')), pg_temp.id('zenith_agent2'), 'still for them when no one is named');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('zenith_owner', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, NULL, 'Owner rewrites', current_date + 2, NULL, %L)::text$q$, pg_temp.id('ztask'), zenith))), 'ok', 'an owner of the firm may (level rule)');
  -- an agent who sees but is neither writer, assignee nor owner: use a second task for agent2 logged by owner on z1... zenith_agent is z1's owner, so use z2 (zenith_agent2's)
  r := pg_temp.keep('ztask2', pg_temp.as_call('zenith_owner', 'zenith-benefits', format($q$SELECT public.log_activity('task', %L, NULL, NULL, NULL, NULL, NULL, 'Owner''s task', current_date, %L, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('z1'), pg_temp.id('zenith_owner'), zenith)));
  PERFORM pg_temp.is(left(pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, NULL, 'Hijack', current_date, NULL, %L)::text$q$, pg_temp.id('ztask2'), zenith)), 5), '42501', 'a viewer who is none of those may not change it');
  PERFORM pg_temp.is(pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, NULL, 'Hijack', current_date, NULL, %L)::text$q$, pg_temp.id('ztask2'), zenith)),
    '42501: Only whoever logged it, whoever it is for, the account''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'in words');
  RAISE NOTICE 'calls_notes_tasks: editing and done passed';
END $$;

-- ---------- the Activity tab: one list, filtered ----------
-- (the history is made first: a field of a1 is changed, so a change is in the list beside the calls, notes and tasks)
UPDATE public.accounts SET industry = 'Dental' WHERE id = pg_temp.id('a1');

-- Break caught: the calls, notes and tasks are not in the list with the history; the list is not newest first (a call is placed by when it was logged and
-- not when it took place); a filter shows the wrong kind; the filters' counts or pages are off; the account's page does not count them; someone who may
-- not see the account reads the list; a note's, call's or task's row lacks who, with whom, what or the right to edit.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r jsonb; types text;
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.account_tab(acme, pg_temp.id('a1'), 'activity', 50, 0);
  PERFORM pg_temp.is((r ->> 'count')::int, (public.account_tab(acme, pg_temp.id('a1'), 'activity_calls') ->> 'count')::int + (public.account_tab(acme, pg_temp.id('a1'), 'activity_notes') ->> 'count')::int + (public.account_tab(acme, pg_temp.id('a1'), 'activity_tasks') ->> 'count')::int + (public.account_tab(acme, pg_temp.id('a1'), 'activity_changes') ->> 'count')::int, 'the list holds every call, note and task and the history');
  PERFORM pg_temp.is((SELECT bool_and((x.v ->> 'at')::timestamptz >= (y.v ->> 'at')::timestamptz) FROM jsonb_array_elements(r -> 'rows') WITH ORDINALITY x(v, i) JOIN jsonb_array_elements(r -> 'rows') WITH ORDINALITY y(v, i) ON y.i = x.i + 1), true, 'newest first');
  types := (SELECT string_agg(DISTINCT x ->> 'type', ',' ORDER BY x ->> 'type') FROM jsonb_array_elements(r -> 'rows') x);
  PERFORM pg_temp.is(types, 'call,change,note,task', 'every kind is in it');
  -- filters
  PERFORM pg_temp.is((public.account_tab(acme, pg_temp.id('a1'), 'activity_calls') ->> 'count')::int, 2, 'Calls: the two calls');
  PERFORM pg_temp.is((SELECT string_agg(DISTINCT x ->> 'type', ',') FROM jsonb_array_elements(public.account_tab(acme, pg_temp.id('a1'), 'activity_calls') -> 'rows') x), 'call', 'and only calls');
  PERFORM pg_temp.is((public.account_tab(acme, pg_temp.id('a1'), 'activity_notes') ->> 'count')::int, 1, 'Notes');
  PERFORM pg_temp.is((SELECT string_agg(DISTINCT x ->> 'type', ',') FROM jsonb_array_elements(public.account_tab(acme, pg_temp.id('a1'), 'activity_tasks') -> 'rows') x), 'task', 'Tasks');
  PERFORM pg_temp.is((public.account_tab(acme, pg_temp.id('a1'), 'activity_tasks') ->> 'count')::int, 2, 'two of them (the follow-up and the census one)');
  PERFORM pg_temp.is((SELECT string_agg(DISTINCT x ->> 'type', ',') FROM jsonb_array_elements(public.account_tab(acme, pg_temp.id('a1'), 'activity_changes') -> 'rows') x), 'change', 'Changes: only the history');
  PERFORM pg_temp.is((public.account_tab(acme, pg_temp.id('a1'), 'activity_calls', 1, 1) -> 'rows' -> 0 ->> 'type'), 'call', 'a filter pages by offset');
  PERFORM pg_temp.is(jsonb_array_length(public.account_tab(acme, pg_temp.id('a1'), 'activity_calls', 1, 2) -> 'rows'), 0, 'and ends');
  -- a call is placed where it took place: the call two days... the one logged first (1 hour ago) is after the one a day ago? the older call is at 1 day ago
  PERFORM pg_temp.is((public.account_tab(acme, pg_temp.id('a1'), 'activity_calls') -> 'rows' -> 0 ->> 'body'), 'Elena has the 2024 loss run.', 'a call is placed at when it took place (an hour ago before a day ago)');
  -- a row
  r := public.account_tab(acme, pg_temp.id('a1'), 'activity_calls') -> 'rows' -> 0;
  PERFORM pg_temp.is(r -> 'contact' ->> 'name', 'First e1 Last e1', 'a row names the contact');
  PERFORM pg_temp.is(r -> 'opportunity' ->> 'name', 'PEO search o1', 'and the opportunity');
  PERFORM pg_temp.is(r ->> 'who', 'acme_agent1@example.test', 'and who');
  PERFORM pg_temp.is(r ->> 'can_edit', 'true', 'and that the caller may edit');
  PERFORM pg_temp.is((public.account_tab(acme, pg_temp.id('a1'), 'activity_notes') -> 'rows' -> 0 ->> 'can_edit'), 'true', 'the writer may edit their fresh note');
  -- the page counts and shows them
  r := public.account_page(acme, pg_temp.id('a1'));
  PERFORM pg_temp.is((r -> 'tabs' -> 'activity' ->> 'count')::int, (public.account_tab(acme, pg_temp.id('a1'), 'activity') ->> 'count')::int, 'the page counts them');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'tabs' -> 'activity' -> 'rows'), 5, 'and holds the first five');
  RESET ROLE;
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_tab(%L, %L, 'activity_other')$q$, acme, pg_temp.id('a1'))), '22023', 'an unknown filter is refused');
  RESET ROLE;
  RAISE NOTICE 'calls_notes_tasks: the Activity tab passed';
END $$;

-- ---------- who sees the list, and who may edit what in it ----------
-- Break caught: the list answers someone who may not see the account; "can_edit" is the same for every viewer; the options leak.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); zenith uuid := pg_temp.id('zenith'); r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_agent3', 'acme-brokers');
  PERFORM pg_temp.is(public.account_tab(acme, pg_temp.id('a1'), 'activity'), NULL, 'an agent who may not see the account reads no activity');
  PERFORM pg_temp.is(public.account_activity_options(acme, pg_temp.id('a1')), NULL, 'and no options');
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(public.account_tab(zenith, pg_temp.id('a1'), 'activity'), NULL, 'another firm''s account is nothing');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities)::int, (SELECT count(*)::int FROM public.activities WHERE firm_id = zenith) , 'the table shows a member only their firm''s');
  PERFORM pg_temp.as_user('zenith_agent2', 'zenith-benefits');
  r := public.account_tab(zenith, pg_temp.id('z1'), 'activity_notes') -> 'rows';
  PERFORM pg_temp.is((SELECT bool_or((x ->> 'can_edit')::boolean) FROM jsonb_array_elements(r) x), false, 'a viewer who wrote none of the notes may edit none');
  r := public.account_tab(zenith, pg_temp.id('z1'), 'activity_calls') -> 'rows';
  PERFORM pg_temp.is((SELECT bool_and((x ->> 'can_edit')::boolean) FROM jsonb_array_elements(r) x WHERE x ->> 'who' = 'zenith_agent2@example.test'), true, 'a viewer may edit the call they logged');
  PERFORM pg_temp.is((SELECT bool_and((x ->> 'can_edit')::boolean) FROM jsonb_array_elements(r) x WHERE x ->> 'who' = 'zenith_agent@example.test'), false, 'and not a colleague''s on a colleague''s account');
  -- the options
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.account_activity_options(acme, pg_temp.id('a1'));
  PERFORM pg_temp.is(jsonb_array_length(r -> 'contacts'), 2, 'the contacts of the account');
  PERFORM pg_temp.is(r -> 'contacts' -> 0 ->> 'name', 'First e1 Last e1', 'the main one first');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'opportunities'), 2, 'its opportunities');
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'name', ',' ORDER BY x ->> 'name') FROM jsonb_array_elements(r -> 'people') x),
    'acme_agent1@example.test,acme_agent2@example.test,acme_agent3@example.test,acme_lead2@example.test,acme_lead@example.test,acme_owner@example.test,acme_west@example.test', 'the firm''s current members, and no one who left');
  RESET ROLE;
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.account_activity_options(%L, %L)$q$, acme, pg_temp.id('a1'))), '42501', 'signed out, none');
  RESET ROLE;
END $$;

-- ---------- row security ----------
-- Break caught: the table's policy does not follow the account's visibility.
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.activities WHERE account_id = pg_temp.id('a1')), 5, 'the account''s owner reads its activities');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.activities WHERE account_id = pg_temp.id('a2')), 0, 'and none on a colleague''s account');
  PERFORM pg_temp.is(pg_temp.attempt($q$INSERT INTO public.activities (firm_id, account_id, kind, body) SELECT firm_id, id, 'note', 'x' FROM public.accounts LIMIT 1$q$), '42501', 'no API role inserts');
  PERFORM pg_temp.is(pg_temp.attempt($q$DELETE FROM public.activities$q$), '42501', 'nor deletes');
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.activities WHERE account_id = pg_temp.id('a2')), 1, 'a lead reads their team''s account''s activity');
  PERFORM pg_temp.as_user('acme_agent3', 'acme-brokers');
  PERFORM pg_temp.is((SELECT count(*)::int FROM public.activities WHERE firm_id = acme), 0, 'an agent with none of those accounts reads nothing');
  RESET ROLE;
END $$;

-- ---------- deleting a contact, an account; closing a firm ----------
-- Break caught: a deleted contact takes its calls with it (they stay on the account); a deleted account leaves its activities (D-204); the closing's list
-- lacks the table or puts it after the records it stands on.
DO $$
DECLARE n bigint;
BEGIN
  PERFORM pg_temp.account('d1', 'acme', 'acme_agent1');
  PERFORM pg_temp.contact('dc1', 'd1', 'acme_agent1', 'dc1@example.test');
  INSERT INTO public.activities (firm_id, account_id, kind, contact_id, author_id, at, outcome)
  SELECT firm_id, id, 'call', pg_temp.id('dc1'), pg_temp.id('acme_agent1'), now(), 'spoke' FROM public.accounts WHERE id = pg_temp.id('d1');
  DELETE FROM public.contacts WHERE id = pg_temp.id('dc1');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('d1') AND contact_id IS NULL), 1::bigint, 'a deleted contact leaves its call on the account');
  DELETE FROM public.accounts WHERE id = pg_temp.id('d1');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('d1')), 0::bigint, 'a deleted account deletes its calls, notes and tasks');
  PERFORM pg_temp.is((SELECT ord FROM public.firm_closing_plan() WHERE src = 'public.activities') < (SELECT ord FROM public.firm_closing_plan() WHERE src = 'public.opportunities'), true, 'closing a firm deletes them before the records they stand on');
  PERFORM pg_temp.is((SELECT action FROM public.firm_closing_plan() WHERE src = 'public.activities'), 'delete', 'it deletes them');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() WHERE src IN ('public.accounts', 'public.contacts', 'public.opportunities', 'public.record_history', 'public.referral_partners')), 5::bigint, 'and keeps every line it had');
  RAISE NOTICE 'calls_notes_tasks: all passed';
END $$;

-- ---------- an archived account takes nothing more (D-222) ----------
-- Break caught: log_activity saves a note, or a call with its follow-up task, on an archived account; add_to_note appends to its notes; or the refusal also
-- shuts what stays open (a call or a task can still be changed, a task marked done, as an archived account can still be edited).
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r text; n bigint; fu text := $q$'Send it', current_date, NULL$q$;
BEGIN
  PERFORM pg_temp.as_owner();
  INSERT INTO public.accounts (source, firm_id, owner_id, name, archived_at) VALUES ('added_by_hand', acme, pg_temp.id('acme_agent1'), 'Archived Co', now()) RETURNING id INTO STRICT r;
  INSERT INTO fx VALUES ('arch', r::uuid);
  INSERT INTO public.activities (id, firm_id, account_id, kind, body, author_id) VALUES (gen_random_uuid(), acme, pg_temp.id('arch'), 'note', 'An old note', pg_temp.id('acme_agent1'));
  INSERT INTO fx SELECT 'arch_note', id FROM public.activities WHERE account_id = pg_temp.id('arch') AND kind = 'note';
  INSERT INTO public.activities (firm_id, account_id, kind, outcome, author_id) VALUES (acme, pg_temp.id('arch'), 'call', 'spoke', pg_temp.id('acme_agent1'));
  INSERT INTO fx SELECT 'arch_call', id FROM public.activities WHERE account_id = pg_temp.id('arch') AND kind = 'call';
  INSERT INTO public.activities (firm_id, account_id, kind, title, due_on, author_id, assignee_id) VALUES (acme, pg_temp.id('arch'), 'task', 'Old task', current_date, pg_temp.id('acme_agent1'), pg_temp.id('acme_agent1'));
  INSERT INTO fx SELECT 'arch_task', id FROM public.activities WHERE account_id = pg_temp.id('arch') AND kind = 'task';
  n := (SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('arch'));
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'More', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('arch'), acme)),
    '55000: This account is archived. Nothing can be added to it.', 'a note on an archived account');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('call', %L, NULL, NULL, NULL, 'spoke', 'Hi', NULL, NULL, NULL, 'Send it', current_date, NULL, %L)::text$q$, pg_temp.id('arch'), acme))),
    '55000', 'a call with its follow-up task');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('task', %L, NULL, NULL, NULL, NULL, NULL, 'Do it', current_date, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('arch'), acme))),
    '55000', 'a task');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.add_to_note(%L, 'More', %L)::text$q$, pg_temp.id('arch_note'), acme)),
    '55000: This account is archived. Nothing can be added to it.', 'an addition to a note');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('arch')), n, 'nothing was saved');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, 'no_answer', NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('arch_call'), acme))),
    'ok', 'a call can still be changed');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.update_activity(%L, NULL, NULL, NULL, NULL, NULL, 'Renamed', current_date, NULL, %L)::text$q$, pg_temp.id('arch_task'), acme))),
    'ok', 'and a task');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.set_task_done(%L, true, %L)::text$q$, pg_temp.id('arch_task'), acme))),
    'ok', 'and marked done');
  RAISE NOTICE 'calls_notes_tasks: archived passed';
END $$;

-- ---------- a call's time: five minutes past now, and no more ----------
-- Break caught: the limit is dropped, or becomes one that refuses a clock a little ahead (5 minutes exactly passes, a second more does not), for a new call or a changed one.
DO $$
DECLARE acme uuid := pg_temp.id('acme');
BEGIN
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('call', %L, NULL, NULL, now() + interval '5 minutes', 'spoke', 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme))),
    'ok', 'a call five minutes ahead is taken');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.log_activity('call', %L, NULL, NULL, now() + interval '5 minutes 1 second', 'spoke', 'x', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('a1'), acme)),
    '22023: A call can''t be in the future.', 'a second more is refused');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.update_activity(%L, NULL, NULL, now() + interval '5 minutes', 'spoke', 'x', NULL, NULL, NULL, %L)::text$q$, pg_temp.id('call1'), acme))),
    'ok', 'a changed call five minutes ahead is taken');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.update_activity(%L, NULL, NULL, now() + interval '5 minutes 1 second', 'spoke', 'x', NULL, NULL, NULL, %L)::text$q$, pg_temp.id('call1'), acme)),
    '22023: A call can''t be in the future.', 'and a second more refused');
END $$;

-- ---------- a contact's and an opportunity's activities move with it ----------
-- (The move itself is CRM-A2.2's and the merge's; this proves the table lets it be made in one transaction, and only so.)
-- Break caught: the keys to the contact and the opportunity are not deferrable (the move fails with 23503); an activity's account changes on its own, or following
-- a contact that has not moved; an activity left behind on the old account with a contact that moved is not noticed at the end of the move.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); r text;
BEGIN
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.account('mva', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('mvb', 'acme', 'acme_agent1');
  PERFORM pg_temp.contact('mvc', 'mva', 'acme_agent1', 'mvc@example.test');
  PERFORM pg_temp.contact('mvc2', 'mva', 'acme_agent1', 'mvc2@example.test');
  PERFORM pg_temp.opportunity('mvo', 'mva', 'acme_agent1');
  INSERT INTO public.activities (firm_id, account_id, kind, contact_id, opportunity_id, outcome, author_id) VALUES (acme, pg_temp.id('mva'), 'call', pg_temp.id('mvc'), pg_temp.id('mvo'), 'spoke', pg_temp.id('acme_agent1'));
  INSERT INTO public.activities (firm_id, account_id, kind, contact_id, body, author_id) VALUES (acme, pg_temp.id('mva'), 'note', pg_temp.id('mvc'), 'On the contact', pg_temp.id('acme_agent1'));
  INSERT INTO public.activities (firm_id, account_id, kind, opportunity_id, title, due_on, author_id) VALUES (acme, pg_temp.id('mva'), 'task', pg_temp.id('mvo'), 'On the opportunity', current_date, pg_temp.id('acme_agent1'));
  INSERT INTO public.activities (firm_id, account_id, kind, contact_id, body, author_id) VALUES (acme, pg_temp.id('mva'), 'note', pg_temp.id('mvc2'), 'On the other contact', pg_temp.id('acme_agent1'));
  INSERT INTO public.activities (firm_id, account_id, kind, body, author_id) VALUES (acme, pg_temp.id('mva'), 'note', 'On the account alone', pg_temp.id('acme_agent1'));
  INSERT INTO fx SELECT 'mv_alone', id FROM public.activities WHERE body = 'On the account alone';
  INSERT INTO fx SELECT 'mv_other', id FROM public.activities WHERE body = 'On the other contact';

  -- on their own, none of it moves
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.contacts SET account_id = %L WHERE id = %L$q$, pg_temp.id('mvb'), pg_temp.id('mvc'))), '23503', 'a contact with activities does not move while they stay behind');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET account_id = %L WHERE id = %L$q$, pg_temp.id('mvb'), pg_temp.id('mv_alone'))), '42501', 'an activity on the account alone is not moved on its own');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET account_id = %L WHERE id = %L$q$, pg_temp.id('mvb'), pg_temp.id('mv_other'))), '42501', 'nor with a contact that has not moved');

  -- one transaction: the contact and the opportunity move, and what is on them
  SET CONSTRAINTS public.activities_contact_fkey, public.activities_opportunity_fkey DEFERRED;
  UPDATE public.contacts SET account_id = pg_temp.id('mvb') WHERE id = pg_temp.id('mvc');
  UPDATE public.opportunities SET account_id = pg_temp.id('mvb') WHERE id = pg_temp.id('mvo');
  UPDATE public.activities SET account_id = pg_temp.id('mvb') WHERE contact_id = pg_temp.id('mvc') OR opportunity_id = pg_temp.id('mvo');
  SET CONSTRAINTS public.activities_contact_fkey, public.activities_opportunity_fkey IMMEDIATE;
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('mvb')), 3::bigint, 'the call, the contact''s note and the opportunity''s task moved');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('mva')), 2::bigint, 'the other contact''s note and the account''s own stayed');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE contact_id = pg_temp.id('mvc') AND account_id = pg_temp.id('mvb')), 2::bigint, 'each still names its contact');

  -- swapping in a different contact or opportunity of the new account is replacing the link, not following it
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET account_id = %L, contact_id = %L WHERE id = %L$q$, pg_temp.id('mvb'), pg_temp.id('mvc'), pg_temp.id('mv_other'))), '42501', 'a different contact of the new account in its place is refused');
  PERFORM pg_temp.is(pg_temp.attempt(format($q$UPDATE public.activities SET account_id = %L, contact_id = NULL, opportunity_id = %L WHERE id = %L$q$, pg_temp.id('mvb'), pg_temp.id('mvo'), pg_temp.id('mv_other'))), '42501', 'and a different opportunity');

  -- a move that leaves one behind is refused where it ends
  PERFORM pg_temp.account('mvd', 'acme', 'acme_agent1');
  PERFORM pg_temp.contact('mvc3', 'mva', 'acme_agent1', 'mvc3@example.test');
  INSERT INTO public.activities (firm_id, account_id, kind, contact_id, body, author_id) VALUES (acme, pg_temp.id('mva'), 'note', pg_temp.id('mvc3'), 'Left behind', pg_temp.id('acme_agent1'));
  r := pg_temp.attempt(format($q$DO $d$ BEGIN SET CONSTRAINTS public.activities_contact_fkey DEFERRED; UPDATE public.contacts SET account_id = %L WHERE id = %L; SET CONSTRAINTS public.activities_contact_fkey IMMEDIATE; END $d$ $q$, pg_temp.id('mvd'), pg_temp.id('mvc3')));
  PERFORM pg_temp.is(r, '23503', 'a contact moved and its activity left behind is refused at the end');
  RAISE NOTICE 'calls_notes_tasks: moving with the contact passed';
END $$;

-- ---------- a big account's first page is not built from every row ----------
-- Break caught: every call, note and task of the account is built into its row before the page is cut (5,000 notes took 765 ms to show five).
DO $$
DECLARE acme uuid := pg_temp.id('acme'); t0 timestamptz; ms numeric; r jsonb;
BEGIN
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.account('big', 'acme', 'acme_agent1', 'Big account');
  INSERT INTO public.activities (firm_id, account_id, kind, body, at, created_at, author_id)
  SELECT acme, pg_temp.id('big'), 'note', 'Note ' || n, now() - (n || ' minutes')::interval, now() - (n || ' minutes')::interval, pg_temp.id('acme_agent1') FROM generate_series(1, 5000) n;
  ANALYZE public.activities;
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.account_tab(acme, pg_temp.id('big'), 'activity', 5, 0);
  t0 := clock_timestamp();
  r := public.account_page(acme, pg_temp.id('big'));
  ms := extract(epoch FROM clock_timestamp() - t0) * 1000;
  RAISE NOTICE 'calls_notes_tasks: the page of an account with 5000 notes took % ms', round(ms);
  PERFORM pg_temp.is(jsonb_array_length(r -> 'tabs' -> 'activity' -> 'rows'), 5, 'five rows');
  PERFORM pg_temp.is((r -> 'tabs' -> 'activity' ->> 'count')::int, 5001, 'of 5000 notes and the account''s creation');
  PERFORM pg_temp.is(r -> 'tabs' -> 'activity' -> 'rows' -> 1 ->> 'body', 'Note 1', 'the newest note first, after the account''s creation');
  PERFORM pg_temp.is(ms < 300, true, 'the page took ' || round(ms) || ' ms');
  PERFORM pg_temp.is(public.account_tab(acme, pg_temp.id('big'), 'activity_notes', 5, 4995) -> 'rows' -> 4 ->> 'body', 'Note 5000', 'and the last page is the oldest');
  RESET ROLE;
END $$;

-- ---------- a member with no name and no email (the log form's choices) ----------
-- Break caught: the form's list of people holds a null name for such a member, which the screen rejects whole, so no dialog on the account opens.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); u uuid := gen_random_uuid(); r jsonb;
BEGIN
  PERFORM pg_temp.as_owner();
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, created_at, updated_at) VALUES (u, 'authenticated', 'authenticated', NULL, now(), false, now(), now());
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (acme, u, 'agent');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.account_activity_options(acme, pg_temp.id('a1'));
  PERFORM pg_temp.is((SELECT x ->> 'name' FROM jsonb_array_elements(r -> 'people') x WHERE x ->> 'id' = u::text), 'A member', 'a member with no name or email is "A member"');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(r -> 'people') x WHERE x ->> 'name' IS NULL), 0::bigint, 'and no name is null');
  RESET ROLE;
  PERFORM pg_temp.as_owner();
  DELETE FROM public.firm_memberships WHERE user_id = u;
END $$;

-- ---------- activity_at only grows, and is no one's to write (D-201) ----------
-- Break caught: opening a task again, or changing a call's time or a task's words, takes a moment back or moves it; a value sent for it is kept; an addition or
-- a completion does not move it.
DO $$
DECLARE acme uuid := pg_temp.id('acme'); t uuid; n uuid; c uuid;
BEGIN
  PERFORM pg_temp.as_owner();
  INSERT INTO public.activities (firm_id, account_id, kind, title, due_on, at, created_at, activity_at) VALUES (acme, pg_temp.id('a3'), 'task', 'T', current_date, timestamptz '2026-01-01 00:00+00', timestamptz '2026-01-01 00:00+00', timestamptz '2030-01-01') RETURNING id INTO t;
  PERFORM pg_temp.is((SELECT activity_at FROM public.activities WHERE id = t), timestamptz '2026-01-01 00:00+00', 'a value sent for it is ignored');
  UPDATE public.activities SET done_at = timestamptz '2026-01-05 00:00+00' WHERE id = t;
  PERFORM pg_temp.is((SELECT activity_at FROM public.activities WHERE id = t), timestamptz '2026-01-05 00:00+00', 'a task done moves it');
  UPDATE public.activities SET done_at = NULL, done_by = NULL WHERE id = t;
  PERFORM pg_temp.is((SELECT activity_at FROM public.activities WHERE id = t), timestamptz '2026-01-05 00:00+00', 'opening it again takes nothing back');
  UPDATE public.activities SET title = 'Renamed', activity_at = timestamptz '2020-01-01' WHERE id = t;
  PERFORM pg_temp.is((SELECT activity_at FROM public.activities WHERE id = t), timestamptz '2026-01-05 00:00+00', 'editing it changes nothing, and nothing can lower it');
  INSERT INTO public.activities (firm_id, account_id, kind, outcome, at) VALUES (acme, pg_temp.id('a3'), 'call', 'spoke', timestamptz '2026-02-01 00:00+00') RETURNING id INTO c;
  UPDATE public.activities SET at = timestamptz '2026-01-01 00:00+00' WHERE id = c;
  PERFORM pg_temp.is((SELECT activity_at FROM public.activities WHERE id = c), timestamptz '2026-02-01 00:00+00', 'a call''s time put earlier does not take its moment back');
  INSERT INTO public.activities (firm_id, account_id, kind, body, additions) VALUES (acme, pg_temp.id('a3'), 'note', 'N', '[{"at": "2999-01-01T00:00:00+00:00", "by": null, "text": "later"}]') RETURNING id INTO n;
  PERFORM pg_temp.is((SELECT activity_at FROM public.activities WHERE id = n), timestamptz '2999-01-01 00:00+00', 'a note''s last addition is its moment');
  DELETE FROM public.activities WHERE id = n;
END $$;
