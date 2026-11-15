-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh contact_page
-- A contact's page (story CRM-C1.1; docs/BROKER_CRM_BUILD.md D-28, D-29, D-46, D-186, D-209, D-222, D-233, D-238; 20261119240000_contact_page.sql).
-- contact_page (who sees a contact, what it carries, can_change / can_move / can_add), contact_activity (the contact's calls, notes and tasks, its filters and
-- its pages), update_contact (the level rule, the version and the conflict answer, the main contact, the owner, the look of a phone judged only when changed).
-- Two firms are used throughout: Acme sees by level, Zenith shows everyone everything. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261119240000_contact_page.sql
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


-- ---------- helpers for this story ----------
-- Saves a contact as a person at Acme's address: every field is sent, the version is the one the person started from.
CREATE FUNCTION pg_temp.save(who text, c text, v integer, first_n text, last_n text, title text, email text, phone text, mobile text, owner text DEFAULT NULL,
  main boolean DEFAULT false, dne boolean DEFAULT false) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, 'acme-brokers', format($q$SELECT public.update_contact(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)::text$q$,
    pg_temp.id(c), first_n, last_n, title, email, phone, mobile, pg_temp.id(owner), main, dne, pg_temp.id('acme'), v))
$$;
CREATE FUNCTION pg_temp.page(who text, c text, addr text DEFAULT 'acme-brokers') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, addr, format($q$SELECT public.contact_page(%L, %L)::text$q$, pg_temp.id(CASE WHEN addr = 'zenith-benefits' THEN 'zenith' ELSE 'acme' END), pg_temp.id(c)))
$$;
CREATE FUNCTION pg_temp.acts(who text, c text, filter text DEFAULT 'all', lim integer DEFAULT 50, off integer DEFAULT 0) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.as_call(who, 'acme-brokers', format($q$SELECT public.contact_activity(%L, %L, %L, %s, %s)::text$q$, pg_temp.id('acme'), pg_temp.id(c), filter, lim, off))
$$;

-- ---------- the page ----------
-- Break caught: a contact is read by someone who may not see its account; the contact's fields, account, owner or the can_* answers are wrong; the opportunities
-- the contact is the main contact of are not listed (or another's are).
DO $$
DECLARE j jsonb; r text;
BEGIN
  UPDATE public.opportunities SET main_contact_id = pg_temp.id('e1') WHERE id = pg_temp.id('o1');
  j := pg_temp.page('acme_agent1', 'e1')::jsonb;
  PERFORM pg_temp.is(j -> 'contact' ->> 'last_name', 'Last e1', 'the contact''s own fields');
  PERFORM pg_temp.is(j -> 'contact' ->> 'email', 'elena@harborview.example', 'its email');
  PERFORM pg_temp.is(j -> 'contact' ->> 'is_main', 'true', 'its main-contact mark');
  PERFORM pg_temp.is(j -> 'contact' ->> 'do_not_email', 'false', 'Do not email is stored and shown');
  PERFORM pg_temp.is(j -> 'contact' -> 'account' ->> 'name', 'Harborview Dental Group', 'its account, by name');
  PERFORM pg_temp.is(j -> 'contact' -> 'account' ->> 'archived', 'false', 'not archived');
  PERFORM pg_temp.is(j -> 'contact' -> 'owner' ->> 'name', 'acme_agent1@example.test', 'its owner, by name');
  PERFORM pg_temp.is(j ->> 'can_change', 'true', 'its owner may change it');
  PERFORM pg_temp.is(j ->> 'can_move', 'true', 'and move it');
  PERFORM pg_temp.is(j ->> 'can_add', 'true', 'and add to it');
  PERFORM pg_temp.is(j -> 'opportunities' ->> 'count', '1', 'one opportunity it is the main contact of');
  PERFORM pg_temp.is(j -> 'opportunities' -> 'rows' -> 0 ->> 'name', 'PEO search o1', 'named');
  PERFORM pg_temp.is(j -> 'opportunities' -> 'rows' -> 0 ->> 'stage', 'qualifying', 'with its stage');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'e2')::jsonb -> 'opportunities' ->> 'count', '0', 'none for a contact that is on none');
  -- who sees it
  PERFORM pg_temp.is(pg_temp.page('acme_agent3', 'e1'), NULL, 'an agent whose level does not reach the account reads nothing');
  PERFORM pg_temp.is(pg_temp.page('acme_owner', 'e1') IS NOT NULL, true, 'an owner of the firm reads it');
  PERFORM pg_temp.is(pg_temp.page('acme_lead', 'e3') IS NOT NULL, true, 'a lead reads a teammate''s account''s contact');
  PERFORM pg_temp.is(pg_temp.page('acme_lead2', 'e3'), NULL, 'a lead of another team does not');
  PERFORM pg_temp.is(pg_temp.page('zenith_owner', 'e1'), NULL, 'another firm''s owner reads nothing');
  PERFORM pg_temp.is(pg_temp.page('nobody', 'e1'), NULL, 'a person with no firm reads nothing');
  PERFORM pg_temp.is(pg_temp.page('platform_admin', 'e1'), NULL, 'a platform admin with no membership reads nothing');
  PERFORM pg_temp.is(pg_temp.page('acme_removed', 'e1'), NULL, 'a former member reads nothing');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'ze1'), NULL, 'a contact of another firm, asked at this firm, is as not there');
  PERFORM pg_temp.is(pg_temp.page('zenith_owner', 'ze1', 'zenith-benefits') IS NOT NULL, true, 'it is read in its own firm');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'e1', 'zenith-benefits'), NULL, 'the address narrows (D-40): at another firm''s address nothing is read');
  PERFORM pg_temp.is(pg_temp.as_call('acme_agent1', 'acme-brokers', format($q$SELECT public.contact_page(%L, %L)::text$q$, pg_temp.id('acme'), gen_random_uuid())), NULL, 'a contact that is not there');
  PERFORM pg_temp.as_anon();
  r := pg_temp.refusal(format($q$SELECT public.contact_page(%L, %L)$q$, pg_temp.id('acme'), pg_temp.id('e1')));
  RESET ROLE;
  PERFORM pg_temp.is(left(r, 5), '42501', 'a signed-out caller may not call it');
  -- the level rule: everyone-sees-everything lets a member see, never change (D-209)
  PERFORM pg_temp.is(pg_temp.page('zenith_agent2', 'ze1', 'zenith-benefits')::jsonb ->> 'can_change', 'false', 'seeing is not changing');
  PERFORM pg_temp.is(pg_temp.page('zenith_agent2', 'ze1', 'zenith-benefits')::jsonb ->> 'can_move', 'false', 'nor moving');
  PERFORM pg_temp.is(pg_temp.page('acme_lead', 'e3')::jsonb ->> 'can_change', 'true', 'a lead changes a teammate''s contact');
  PERFORM pg_temp.is(pg_temp.page('acme_owner', 'e1')::jsonb ->> 'can_change', 'true', 'an owner changes any');
END $$;

-- Break caught: an archived account still takes new records through its contact's page (D-222), or stops being left.
DO $$
DECLARE j jsonb;
BEGIN
  UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('a2');
  j := pg_temp.page('acme_agent2', 'e3')::jsonb;
  PERFORM pg_temp.is(j ->> 'can_add', 'false', 'nothing can be added on an archived account');
  PERFORM pg_temp.is(j -> 'contact' -> 'account' ->> 'archived', 'true', 'and the page says it is archived');
  PERFORM pg_temp.is(j ->> 'can_change', 'true', 'its contact can still be edited');
  PERFORM pg_temp.is(j ->> 'can_move', 'true', 'and moved off');
  UPDATE public.accounts SET archived_at = NULL WHERE id = pg_temp.id('a2');
END $$;

-- A contact whose owner has left, and one with none: only an owner of the firm changes them (D-209).
DO $$
BEGIN
  PERFORM pg_temp.contact('e_gone', 'a1', 'acme_removed', 'gone@harborview.example');
  PERFORM pg_temp.contact('e_none', 'a1', NULL, 'none@harborview.example');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'e_none')::jsonb ->> 'can_change', 'false', 'nobody but an owner changes a contact with no owner');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'e_gone')::jsonb ->> 'can_change', 'false', 'nor one whose owner has left');
  PERFORM pg_temp.is(pg_temp.page('acme_owner', 'e_none')::jsonb ->> 'can_change', 'true', 'an owner of the firm does');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'e_none')::jsonb -> 'contact' -> 'owner', 'null'::jsonb, 'and no owner is shown');
END $$;

-- ---------- the contact's calls, notes and tasks ----------
-- Break caught: the list holds the account's other rows, or another contact's; the filters do not narrow the count; the order is not newest first; a page
-- is not a page; someone who may not see the account reads its rows.
DO $$
DECLARE j jsonb; r text;
BEGIN
  r := pg_temp.keep('c_call', pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('call', %L, %L, NULL, now() - interval '3 days', 'spoke', 'Renewal came in 14 percent up', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$,
    pg_temp.id('a1'), pg_temp.id('e1'), pg_temp.id('acme'))));
  r := pg_temp.keep('c_note', pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('note', %L, %L, NULL, NULL, NULL, 'Elena runs the day to day', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$,
    pg_temp.id('a1'), pg_temp.id('e1'), pg_temp.id('acme'))));
  r := pg_temp.keep('c_task', pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('task', %L, %L, NULL, NULL, NULL, NULL, 'Check Elena sent the loss run', current_date + 1, NULL, NULL, NULL, NULL, %L)::text$q$,
    pg_temp.id('a1'), pg_temp.id('e1'), pg_temp.id('acme'))));
  r := pg_temp.keep('other_note', pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('note', %L, %L, NULL, NULL, NULL, 'About Sam', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$,
    pg_temp.id('a1'), pg_temp.id('e2'), pg_temp.id('acme'))));
  r := pg_temp.keep('acct_note', pg_temp.as_call('acme_agent1', 'acme-brokers', format(
    $q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'About the whole account', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$,
    pg_temp.id('a1'), pg_temp.id('acme'))));
  j := pg_temp.acts('acme_agent1', 'e1')::jsonb;
  PERFORM pg_temp.is(j ->> 'count', '3', 'the contact''s three, and no other contact''s or the account''s own');
  PERFORM pg_temp.is(jsonb_array_length(j -> 'rows'), 3, 'three rows');
  PERFORM pg_temp.is(j -> 'rows' -> 2 ->> 'type', 'call', 'newest first: a call is placed when it took place, three days ago, so it is last');
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'type', ',' ORDER BY x ->> 'type') FROM jsonb_array_elements(j -> 'rows') x), 'call,note,task', 'a call, a note and a task');
  PERFORM pg_temp.is(j -> 'rows' -> 2 ->> 'body', 'Renewal came in 14 percent up', 'a row is the account tab''s own (crm_activity_row)');
  PERFORM pg_temp.is(j -> 'rows' -> 2 -> 'contact' ->> 'name', 'First e1 Last e1', 'with the contact named');
  PERFORM pg_temp.is(j -> 'rows' -> 2 ->> 'can_edit', 'true', 'and whether the caller may change it');
  PERFORM pg_temp.is(pg_temp.acts('acme_agent1', 'e1', 'calls')::jsonb ->> 'count', '1', 'Calls');
  PERFORM pg_temp.is(pg_temp.acts('acme_agent1', 'e1', 'notes')::jsonb -> 'rows' -> 0 ->> 'body', 'Elena runs the day to day', 'Notes');
  PERFORM pg_temp.is(pg_temp.acts('acme_agent1', 'e1', 'tasks')::jsonb -> 'rows' -> 0 ->> 'title', 'Check Elena sent the loss run', 'Tasks');
  PERFORM pg_temp.is(pg_temp.acts('acme_agent1', 'e2', 'tasks')::jsonb ->> 'count', '0', 'none for a contact with none');
  -- pages
  j := pg_temp.acts('acme_agent1', 'e1', 'all', 1, 1)::jsonb;
  PERFORM pg_temp.is(j ->> 'count', '3', 'a page keeps the whole count');
  PERFORM pg_temp.is(j -> 'rows' -> 0 ->> 'id', (pg_temp.acts('acme_agent1', 'e1')::jsonb -> 'rows' -> 1 ->> 'id'), 'from the second row');
  PERFORM pg_temp.is(jsonb_array_length(j -> 'rows'), 1, 'one row');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.acts('acme_agent1', 'e1', 'all', 101, 0)), '22023', 'a page is at most 100 rows');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.acts('acme_agent1', 'e1', 'all', 50, -1)), '22023', 'and starts at the first row or later');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.acts('acme_agent1', 'e1', 'changes')), '22023', 'there is no filter called changes here');
  -- who reads them
  PERFORM pg_temp.is(pg_temp.acts('acme_agent3', 'e1'), NULL, 'someone who may not see the account reads none');
  PERFORM pg_temp.is(pg_temp.acts('zenith_owner', 'e1'), NULL, 'nor another firm''s owner');
  PERFORM pg_temp.is(pg_temp.acts('acme_owner', 'e1')::jsonb ->> 'count', '3', 'an owner of the firm reads them');
  PERFORM pg_temp.as_anon();
  r := pg_temp.refusal(format($q$SELECT public.contact_activity(%L, %L)$q$, pg_temp.id('acme'), pg_temp.id('e1')));
  RESET ROLE;
  PERFORM pg_temp.is(left(r, 5), '42501', 'a signed-out caller may not call it');
  -- they move with the contact (D-233): the list follows the contact to its new account
  PERFORM pg_temp.is(pg_temp.acts('acme_agent2', 'e3')::jsonb ->> 'count', '0', 'a contact on another account with none');
END $$;

-- ---------- the save ----------
-- Break caught: a save is taken from someone the level rule does not name; the version is not asked; a stale save overwrites; the answer is not the agreed shape.
DO $$
DECLARE j jsonb; r text;
BEGIN
  r := pg_temp.save('acme_agent1', 'e2', 1, '  Sam ', ' Reyes ', ' Owner ', ' sam@harborview.example ', '', '(503) 555-0199', 'acme_agent1', false, true);
  j := r::jsonb;
  PERFORM pg_temp.is(j ->> 'conflict', 'false', 'a save from the current version is taken');
  PERFORM pg_temp.is(j -> 'record' ->> 'version', '2', 'and the version moves on');
  PERFORM pg_temp.is(j -> 'record' ->> 'first_name', 'Sam', 'text is trimmed');
  PERFORM pg_temp.is(j -> 'record' ->> 'title', 'Owner', 'the title');
  PERFORM pg_temp.is(j -> 'record' ->> 'phone', NULL, 'a blank is nothing');
  PERFORM pg_temp.is(j -> 'record' ->> 'mobile', '(503) 555-0199', 'the mobile');
  PERFORM pg_temp.is(j -> 'record' ->> 'do_not_email', 'true', 'Do not email is kept');
  PERFORM pg_temp.is(j -> 'previous_main', 'null'::jsonb, 'no main contact was displaced');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'e2')::jsonb -> 'contact' ->> 'do_not_email', 'true', 'and shown on the page');
  -- its history (D-212): one "changed" entry per field, by the caller
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = pg_temp.id('e2')::text AND h.kind = 'changed' AND h.field = 'last_name'), 1::bigint, 'the change of a field is in the contact''s history');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = pg_temp.id('e2')::text AND h.kind = 'changed' AND h.field = 'do_not_email'), 1::bigint, 'Do not email is tracked');
  -- a second save from the old version saves nothing and says who changed what
  r := pg_temp.save('acme_agent1', 'e2', 1, 'Samuel', 'Reyes', 'Owner', 'sam@harborview.example', '', '(503) 555-0199', 'acme_agent1');
  j := r::jsonb;
  PERFORM pg_temp.is(j ->> 'conflict', 'true', 'a stale save is a conflict');
  PERFORM pg_temp.is(j ->> 'currentVersion', '2', 'naming the version now');
  PERFORM pg_temp.is(j -> 'current' ->> 'last_name', 'Reyes', 'and the values now');
  PERFORM pg_temp.is(j -> 'current' ->> 'do_not_email', 'true', 'all the editable ones');
  PERFORM pg_temp.is((SELECT string_agg(x ->> 'field', ',' ORDER BY x ->> 'field') FROM jsonb_array_elements(j -> 'changed') x), 'do_not_email,first_name,last_name,mobile,title', 'with each field that differs since version 1');
  PERFORM pg_temp.is((SELECT first_name FROM public.contacts WHERE id = pg_temp.id('e2')), 'Sam', 'nothing was saved');
  -- the version is asked, and cannot be one the contact never had
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_agent1', 'e2', NULL, 'Sam', 'Reyes', '', 'sam@harborview.example', '', '', 'acme_agent1')), '22023', 'a save with no version is refused');
  PERFORM pg_temp.is(pg_temp.code(pg_temp.save('acme_agent1', 'e2', 9, 'Sam', 'Reyes', '', 'sam@harborview.example', '', '', 'acme_agent1')), '22023', 'and one from a version it never had');
  -- the fields, in words
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'e2', 2, 'Sam', '  ', '', 'sam@harborview.example', '', '', 'acme_agent1'), '22023: Enter the contact''s last name.', 'a last name is needed');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'e2', 2, 'Sam', 'Reyes', '', 'not an email', '', '', 'acme_agent1'), '22023: Enter an email address like name@example.com.', 'an email that is changed must look like one');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'e2', 2, 'Sam', 'Reyes', '', 'sam@harborview.example', 'call me', '', 'acme_agent1'), '22023: Enter a phone number like (503) 555-0142. An extension can follow, like x12.', 'a phone that is changed must look like one');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'e2', 2, 'Sam', 'Reyes', '', '', '', '', 'acme_agent1'), '22023: Enter an email or a phone number.', 'one way to reach them is needed');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'e2', 2, 'Sam', 'Reyes', repeat('t', 101), 'sam@harborview.example', '', '', 'acme_agent1'), '22023: Keep the title to 100 characters.', 'lengths');
  PERFORM pg_temp.is((SELECT version FROM public.contacts WHERE id = pg_temp.id('e2')), 2, 'a refusal saves nothing');
END $$;

-- Break caught: the phone rule judges a phone that was not changed (an older-format phone blocks a save of another field), or one compared untrimmed, or a
-- changed one is let through.
DO $$
DECLARE j jsonb;
BEGIN
  PERFORM pg_temp.contact('e_old', 'a1', 'acme_agent1', 'old-format@harborview.example', ' 555 ');
  UPDATE public.contacts SET mobile = 'ask for Pat', email = 'pat@harborview' WHERE id = pg_temp.id('e_old');
  j := pg_temp.save('acme_agent1', 'e_old', 2, 'Old', 'Format', 'Manager', 'pat@harborview', '555', 'ask for Pat', 'acme_agent1')::jsonb;
  PERFORM pg_temp.is(j ->> 'conflict', 'false', 'an older-format phone, mobile and email, left as they were (the phone untrimmed vs trimmed), do not block a save of the title');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'e_old', 3, 'Old', 'Format', 'Manager', 'pat@harborview', '5551', 'ask for Pat', 'acme_agent1'), '22023: Enter a phone number like (503) 555-0142. An extension can follow, like x12.', 'a phone that is changed is judged');
  PERFORM pg_temp.is(pg_temp.save('acme_agent1', 'e_old', 3, 'Old', 'Format', 'Manager', 'pat@harborview', '555', 'ask for Sam', 'acme_agent1'), '22023: Enter a mobile number like (503) 555-0142. An extension can follow, like x12.', 'and so is a mobile');
END $$;

-- ---------- who may save ----------
-- Break caught: a contact is saved by someone the level rule does not name; one with no owner by anyone but an owner; the refusal order leaks a contact that is not seen.
DO $$
DECLARE r text;
BEGIN
  -- Nothing about a contact the caller may not see is told by how a field is judged: the stored values are read only after the account is seen, so a bad field
  -- and a good one are the same PT404.
  PERFORM pg_temp.is(left(pg_temp.save('acme_agent3', 'e1', 1, 'F', '', '', 'elena@harborview.example', '', '', 'acme_agent3'), 5), 'PT404', 'a bad field on a contact that is not seen is as not there');
  r := pg_temp.save('acme_agent3', 'e1', 1, 'First e1', 'Last e1', '', 'elena@harborview.example', '', '');
  PERFORM pg_temp.is(left(r, 5), 'PT404', 'a contact whose account the caller may not see is as not there');
  r := pg_temp.save('zenith_owner', 'e1', 1, 'First e1', 'Last e1', '', 'elena@harborview.example', '', '');
  PERFORM pg_temp.is(left(r, 5), '42501', 'another firm''s owner is not a member of this one');
  r := pg_temp.save('nobody', 'e1', 1, 'First e1', 'Last e1', '', 'elena@harborview.example', '', '');
  PERFORM pg_temp.is(left(r, 5), '42501', 'a person with no firm may not');
  PERFORM pg_temp.as_anon();
  r := pg_temp.refusal(format($q$SELECT public.update_contact(%L, 'A', 'B', '', 'a@b.cc', '', '', NULL, false, false, %L, 1)$q$, pg_temp.id('e1'), pg_temp.id('acme')));
  RESET ROLE;
  PERFORM pg_temp.is(left(r, 5), '42501', 'a signed-out caller may not');
  -- seen but not theirs
  r := pg_temp.as_call('zenith_agent2', 'zenith-benefits', format($q$SELECT public.update_contact(%L, 'A', 'Last', '', 'ze1@example.test', '', '', NULL, false, false, %L, 1)::text$q$, pg_temp.id('ze1'), pg_temp.id('zenith')));
  PERFORM pg_temp.is(left(r, 5), '42501', 'a member who sees everything may not change another''s contact');
  PERFORM pg_temp.is(r, '42501: Only the contact''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'and is told who may');
  r := pg_temp.save('acme_agent1', 'e_none', 1, 'First', 'None', '', 'none@harborview.example', '', '');
  PERFORM pg_temp.is(r, '42501: A contact with no owner can only be changed by an owner of the firm.', 'a contact with no owner, in words');
  PERFORM pg_temp.is((pg_temp.save('acme_owner', 'e_none', 1, 'First', 'None', 'Boss', 'none@harborview.example', '', '')::jsonb) -> 'record' ->> 'title', 'Boss', 'an owner of the firm saves it');
  PERFORM pg_temp.is((SELECT owner_id FROM public.contacts WHERE id = pg_temp.id('e_none')), NULL, 'and it keeps having no owner when none is chosen');
  PERFORM pg_temp.is((pg_temp.save('acme_owner', 'e_gone', 1, 'First', 'Gone', 'Boss', 'gone@harborview.example', '', '')::jsonb) -> 'record' ->> 'title', 'Boss', 'a contact whose owner has left is saved without choosing one');
  PERFORM pg_temp.is((SELECT owner_id FROM public.contacts WHERE id = pg_temp.id('e_gone')), pg_temp.id('acme_removed'), 'and the departed owner is not touched');
  PERFORM pg_temp.is(pg_temp.save('acme_lead', 'e3', 1, 'First e3', 'Last e3', 'Cover', 'a2@example.test', '', '', 'acme_agent2') LIKE '{%', true, 'a lead saves a contact of their team');
  PERFORM pg_temp.is(left(pg_temp.save('acme_lead2', 'e3', 2, 'First e3', 'Last e3', 'Cover', 'a2@example.test', '', '', 'acme_agent2'), 5), 'PT404', 'a lead of another team does not see it');
  PERFORM pg_temp.is(left(pg_temp.save('acme_agent2', 'e1', 1, 'First e1', 'Last e1', '', 'elena@harborview.example', '', ''), 5), 'PT404', 'an agent saves only what they can see');
END $$;

-- ---------- the owner ----------
-- Break caught: a contact is given to someone who is not in the firm, or to someone the caller could not then give it back to or change.
DO $$
DECLARE r text;
BEGIN
  PERFORM pg_temp.contact('e_own', 'a1', 'acme_agent1', 'own@harborview.example');
  r := pg_temp.save('acme_agent1', 'e_own', 1, 'First', 'Own', '', 'own@harborview.example', '', '', 'acme_agent3');
  PERFORM pg_temp.is(r, '42501: You can give a contact only to yourself and, as a lead, to people on your teams.', 'an agent gives a contact only to themselves');
  r := pg_temp.save('acme_owner', 'e_own', 1, 'First', 'Own', '', 'own@harborview.example', '', '', 'zenith_agent');
  PERFORM pg_temp.is(r, '22023: Choose one of the firm''s people as the owner.', 'nobody outside the firm owns a contact');
  r := pg_temp.save('acme_owner', 'e_own', 1, 'First', 'Own', '', 'own@harborview.example', '', '', 'acme_removed');
  PERFORM pg_temp.is(r, '22023: Choose one of the firm''s people as the owner.', 'nor a person whose membership has ended');
  r := pg_temp.save('acme_owner', 'e_own', 1, 'First', 'Own', '', 'own@harborview.example', '', '', 'acme_agent3');
  PERFORM pg_temp.is((r::jsonb) -> 'record' -> 'owner' ->> 'id', pg_temp.id('acme_agent3')::text, 'an owner of the firm gives it to any current member');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = pg_temp.id('e_own')::text AND h.field = 'owner_id'), 1::bigint, 'and the change of owner is in its history');
END $$;

-- ---------- the main contact ----------
-- Break caught: two main contacts; taking over from a main contact the caller may not change; a stale save that has already unticked the old main contact.
DO $$
DECLARE r text; j jsonb; n bigint;
BEGIN
  -- e1 is main on a1. agent1 takes the mark for e2: e1 (agent1's) is unticked in the same step and named.
  j := pg_temp.save('acme_agent1', 'e2', 2, 'Sam', 'Reyes', 'Owner', 'sam@harborview.example', '', '(503) 555-0199', 'acme_agent1', true, true)::jsonb;
  PERFORM pg_temp.is(j -> 'record' ->> 'is_main', 'true', 'the contact is the main contact');
  PERFORM pg_temp.is(j -> 'previous_main' ->> 'id', pg_temp.id('e1')::text, 'taking over from the one that was');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('e1')), false, 'who is not any more');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('a1') AND is_main), 1::bigint, 'one main contact');
  -- the old main belongs to someone agent1 may not change: refused in words, nothing changes
  UPDATE public.contacts SET is_main = false WHERE id = pg_temp.id('e2');
  UPDATE public.contacts SET owner_id = pg_temp.id('acme_lead2'), is_main = true WHERE id = pg_temp.id('e1');
  r := pg_temp.save('acme_agent1', 'e2', (SELECT version FROM public.contacts WHERE id = pg_temp.id('e2')), 'Sam', 'Reyes', 'Owner', 'sam@harborview.example', '', '(503) 555-0199', 'acme_agent1', true);
  PERFORM pg_temp.is(r, '42501: Only someone who may change First e1 Last e1 can make another contact the main one.', 'taking over needs the level rule on the old main contact (D-238)');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('e1')), true, 'the old main contact is still main');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('e2')), false, 'and the contact is not');
  -- a stale save that asks to be main answers the conflict and leaves the old main contact alone (and out of its history)
  UPDATE public.contacts SET owner_id = pg_temp.id('acme_agent1') WHERE id = pg_temp.id('e1');
  SELECT count(*) INTO n FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = pg_temp.id('e1')::text AND h.field = 'is_main';
  j := pg_temp.save('acme_agent1', 'e2', 1, 'Sam', 'Reyes', 'Owner', 'sam@harborview.example', '', '(503) 555-0199', 'acme_agent1', true)::jsonb;
  PERFORM pg_temp.is(j ->> 'conflict', 'true', 'a stale save asking for the mark is a conflict');
  PERFORM pg_temp.is((SELECT is_main FROM public.contacts WHERE id = pg_temp.id('e1')), true, 'and the old main contact keeps the mark');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = pg_temp.id('e1')::text AND h.field = 'is_main'), n, 'with nothing new in its history');
  -- unticking the main contact leaves none
  j := pg_temp.save('acme_agent1', 'e1', (SELECT version FROM public.contacts WHERE id = pg_temp.id('e1')), 'First e1', 'Last e1', '', 'elena@harborview.example', '', '', 'acme_agent1', false)::jsonb;
  PERFORM pg_temp.is(j -> 'record' ->> 'is_main', 'false', 'the main contact can be unticked');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('a1') AND is_main), 0::bigint, 'leaving the account with none');
END $$;

-- ---------- a contact that moved ----------
-- Break caught: a contact's calls, notes and tasks do not follow it, so its page loses them, or its page keeps naming the first account. (A save that waits for a
-- move is the two-session test "a save and a move" below.)
DO $$
DECLARE r text;
BEGIN
  r := pg_temp.as_call('acme_owner', 'acme-brokers', format($q$SELECT public.move_contact(%L, %L, true, %L)::text$q$, pg_temp.id('e1'), pg_temp.id('a2'), pg_temp.id('acme')));
  PERFORM pg_temp.is(left(r, 1), '{', 'e1 moves to a2');
  PERFORM pg_temp.is(pg_temp.page('acme_agent2', 'e1')::jsonb -> 'contact' -> 'account' ->> 'name', 'a2', 'its page names the new account');
  PERFORM pg_temp.is(pg_temp.acts('acme_agent2', 'e1')::jsonb ->> 'count', '3', 'and its calls, notes and tasks went with it');
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'e1'), NULL, 'the first account''s owner no longer sees the contact');
END $$;

-- ---------- history and closing ----------
-- Break caught: the save is not in the contact's history under the person who made it.
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history h WHERE h.table_name = 'contacts' AND h.record_key = pg_temp.id('e2')::text AND h.actor_id = pg_temp.id('acme_agent1') AND h.field = 'last_name'), 1::bigint, 'the history carries the person who saved');
END $$;

-- ---------- a guess at what a contact holds (a contact the caller may not see) ----------
-- Break caught: the "judged only when changed" comparison reads the stored contact before the account is seen, so a member who may not see the contact learns whether a
-- guess at its non-conforming email or phone is right (right: PT404; wrong: 22023 in words).
DO $$
DECLARE right_guess text; wrong_guess text;
BEGIN
  PERFORM pg_temp.contact('e_guess', 'a2', 'acme_agent2', 'pat@harborview', 'ask for Pat');
  -- agent1 does not see a2 (agent2's). A right guess at the stored email and phone, and a wrong one, are one answer.
  right_guess := pg_temp.save('acme_agent1', 'e_guess', 1, 'F', 'L', '', 'pat@harborview', 'ask for Pat', '', 'acme_agent1');
  wrong_guess := pg_temp.save('acme_agent1', 'e_guess', 1, 'F', 'L', '', 'pat@harborview.', 'ask for Sam', '', 'acme_agent1');
  PERFORM pg_temp.is(right_guess, 'PT404: That contact isn''t available', 'a right guess is not available');
  PERFORM pg_temp.is(wrong_guess, right_guess, 'and a wrong one is the same answer');
  PERFORM pg_temp.is((SELECT version FROM public.contacts WHERE id = pg_temp.id('e_guess')), 1, 'nothing was saved');
END $$;

-- ---------- a Nevermore support session ----------
-- Break caught: support, which reads, may change a contact (D-209: it changes nothing, ADR 0024), or is told it can, or cannot read the page.
DO $$
DECLARE j jsonb; r text; v0 integer := (SELECT version FROM public.contacts WHERE id = pg_temp.id('e2'));
BEGIN
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.start_support_session(pg_temp.id('acme'), 'Customer asked for help with a contact');
  RESET ROLE;
  j := pg_temp.page('platform_admin', 'e2')::jsonb;
  PERFORM pg_temp.is(j IS NOT NULL, true, 'a support session reads the contact''s page');
  PERFORM pg_temp.is(j -> 'contact' ->> 'last_name', 'Reyes', 'and what it holds');
  PERFORM pg_temp.is(j ->> 'can_change', 'false', 'it may not change it');
  PERFORM pg_temp.is(j ->> 'can_move', 'false', 'nor move it');
  PERFORM pg_temp.is(pg_temp.acts('platform_admin', 'e2', 'all')::jsonb ->> 'count', '1', 'it reads the contact''s calls, notes and tasks');
  r := pg_temp.save('platform_admin', 'e2', v0, 'Sam', 'Reyes', 'Owner', 'sam@harborview.example', '', '(503) 555-0199', 'acme_agent1');
  PERFORM pg_temp.is(left(r, 5), 'PT423', 'its save is refused: ' || r);
  PERFORM pg_temp.is((SELECT version FROM public.contacts WHERE id = pg_temp.id('e2')), v0, 'and nothing was saved');
END $$;

-- ---------- two sessions ----------
-- update_contact holds the account (FOR SHARE) and then the contact (FOR NO KEY UPDATE), and an owner's membership (FOR SHARE). Each test shows a session WAITING for
-- the one it races (so the lock is what orders them), and then what it gets. Break caught, one lock removed at a time:
--   the contact's lock: a second save from the same version reads the row as it was before the first and answers a "conflict" with the fields all null;
--   the moved-contact check: a save that waited for a move to an account the saver cannot see answers the contact's fields and its new account;
--   the membership lock: a contact is given to a member whose removal is in flight.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;
CREATE FUNCTION race.try(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; s text; m text;
BEGIN
  EXECUTE stmt INTO r;
  RETURN COALESCE(r, '');
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
  RETURN s || ': ' || m;
END $$;
GRANT USAGE ON SCHEMA race TO authenticated;

CREATE FUNCTION pg_temp.race(first_stmt text, b_who text, b_stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  dsn text := format('dbname=%s user=%s port=%s host=%s', current_database(), session_user, current_setting('port'),
    split_part(current_setting('unix_socket_directories'), ',', 1));
  b_pid integer; tries integer := 0; waited boolean := false; rb text;
BEGIN
  PERFORM race.dblink_connect('ra', dsn);
  PERFORM race.dblink_connect('rb', dsn);
  PERFORM race.dblink_exec('ra', 'SET lock_timeout = ''20s''');
  PERFORM race.dblink_exec('rb', 'SET lock_timeout = ''20s''');
  SELECT pid INTO b_pid FROM race.dblink('rb', 'SELECT pg_backend_pid()') AS t(pid integer);
  PERFORM race.dblink_exec('ra', 'BEGIN');
  PERFORM race.dblink_exec('ra', first_stmt);
  PERFORM race.dblink_exec('rb', 'BEGIN');
  PERFORM race.dblink_exec('rb', 'SET LOCAL ROLE authenticated');
  PERFORM race.dblink_exec('rb', format('SET LOCAL request.jwt.claims = %L',
    jsonb_build_object('sub', pg_temp.id(b_who), 'role', 'authenticated', 'is_anonymous', false, 'email', b_who || '@example.test')::text));
  PERFORM race.dblink_send_query('rb', b_stmt);
  WHILE tries < 80 LOOP
    IF cardinality(pg_blocking_pids(b_pid)) > 0 THEN waited := true; EXIT; END IF;
    IF race.dblink_is_busy('rb') = 0 THEN EXIT; END IF;
    tries := tries + 1;
    PERFORM pg_sleep(0.05);
  END LOOP;
  PERFORM race.dblink_exec('ra', 'COMMIT');
  BEGIN
    SELECT r INTO rb FROM race.dblink_get_result('rb') AS t(r text);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS rb = RETURNED_SQLSTATE;
  END;
  BEGIN
    PERFORM r FROM race.dblink_get_result('rb') AS t(r text);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN PERFORM race.dblink_exec('rb', 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  RETURN CASE WHEN waited THEN 'waited' ELSE 'did not wait' END || '|' || COALESCE(rb, '<null>');
END $$;

-- The call of update_contact for a contact of the race fixtures (every field is sent; the email is the contact's own).
CREATE FUNCTION pg_temp.call_save(c text, v integer, title text, owner text) RETURNS text LANGUAGE sql AS $$
  SELECT format('public.update_contact(%L, ''First'', ''Last'', %L, %L, NULL, NULL, %L, false, false, %L, %s)', pg_temp.id(c), title, c || '@e.example', pg_temp.id(owner), pg_temp.id('acme'), v)
$$;
-- A statement run in the first session as a person, left open.
CREATE FUNCTION pg_temp.as_first(who text, body text) RETURNS text LANGUAGE sql AS $$
  SELECT format($q$SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; DO $d$ BEGIN PERFORM %s; END $d$ $q$,
    jsonb_build_object('sub', pg_temp.id(who), 'role', 'authenticated', 'is_anonymous', false, 'email', who || '@example.test')::text, body)
$$;
CREATE FUNCTION pg_temp.second(call text) RETURNS text LANGUAGE sql AS $$ SELECT format('SELECT race.try(%L)', 'SELECT ' || call || '::text') $$;
CREATE FUNCTION pg_temp.rest(r text) RETURNS text LANGUAGE sql AS $$ SELECT substr(r, position('|' in r) + 1) $$;
CREATE FUNCTION pg_temp.step(r text) RETURNS text LANGUAGE sql AS $$ SELECT split_part(r, '|', 1) $$;

DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('q1', 'acme', 'acme_agent1', 'Race one');
  PERFORM pg_temp.account('q2', 'acme', 'acme_agent2', 'Race two');
  PERFORM pg_temp.contact('qa', 'q1', 'acme_agent1', 'qa@e.example');
  PERFORM pg_temp.contact('qb', 'q1', 'acme_agent1', 'qb@e.example');
  PERFORM pg_temp.contact('qc', 'q1', 'acme_agent1', 'qc@e.example');
  PERFORM pg_temp.contact('qd', 'q1', 'acme_agent1', 'qd@e.example');
  PERFORM pg_temp.contact('qe', 'q1', 'acme_agent1', 'qe@e.example');
END $$;

-- Two saves from the same version: the second waits for the first and is told someone saved first, with the first's values.
DO $$
DECLARE r text; j jsonb;
BEGIN
  RESET ROLE;
  r := pg_temp.race(pg_temp.as_first('acme_agent1', pg_temp.call_save('qa', 1, 'First save', 'acme_agent1')), 'acme_agent1',
    pg_temp.second(pg_temp.call_save('qa', 1, 'Second save', 'acme_agent1')));
  PERFORM pg_temp.is(pg_temp.step(r), 'waited', 'the second save waits for the first');
  j := pg_temp.rest(r)::jsonb;
  PERFORM pg_temp.is(j ->> 'conflict', 'true', 'and is told someone saved first: ' || r);
  PERFORM pg_temp.is(j ->> 'currentVersion', '2', 'at the first''s version');
  PERFORM pg_temp.is(j -> 'current' ->> 'title', 'First save', 'with the first save''s values');
  PERFORM pg_temp.is((SELECT title FROM public.contacts WHERE id = pg_temp.id('qa')), 'First save', 'and the first save stands');
END $$;

-- A save and a move, the move first: the save waits for the move and is refused in words, with nothing of the account the contact went to (which the saver may not see).
DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.page('acme_agent1', 'qb') IS NOT NULL, true, 'the saver sees the contact where it is');
  r := pg_temp.race(pg_temp.as_first('acme_owner', format('public.move_contact(%L, %L, false, %L)', pg_temp.id('qb'), pg_temp.id('q2'), pg_temp.id('acme'))), 'acme_agent1',
    pg_temp.second(pg_temp.call_save('qb', 1, 'Late save', 'acme_agent1')));
  PERFORM pg_temp.is(pg_temp.step(r), 'waited', 'the save waits for the move in flight');
  PERFORM pg_temp.is(pg_temp.rest(r), '40001: That contact was moved while you were working. Try again.', 'and is then refused in words');
  PERFORM pg_temp.is(pg_temp.rest(r) LIKE '%' || pg_temp.id('q2')::text || '%', false, 'with nothing of the new account');
  PERFORM pg_temp.is((SELECT account_id FROM public.contacts WHERE id = pg_temp.id('qb')), pg_temp.id('q2'), 'the contact moved');
  PERFORM pg_temp.is((SELECT title FROM public.contacts WHERE id = pg_temp.id('qb')), NULL, 'and the late save changed nothing');
END $$;

-- A save and a move, the save first: the move waits for the save, then goes ahead and takes the saved values with the contact.
DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  r := pg_temp.race(pg_temp.as_first('acme_agent1', pg_temp.call_save('qc', 1, 'Saved first', 'acme_agent1')), 'acme_owner',
    pg_temp.second(format('public.move_contact(%L, %L, false, %L)', pg_temp.id('qc'), pg_temp.id('q2'), pg_temp.id('acme'))));
  PERFORM pg_temp.is(pg_temp.step(r), 'waited', 'the move waits for the save');
  PERFORM pg_temp.is(pg_temp.rest(r) LIKE '{%', true, 'and is then served: ' || pg_temp.rest(r));
  PERFORM pg_temp.is((SELECT account_id FROM public.contacts WHERE id = pg_temp.id('qc')), pg_temp.id('q2'), 'the contact moved');
  PERFORM pg_temp.is((SELECT title FROM public.contacts WHERE id = pg_temp.id('qc')), 'Saved first', 'with what was saved');
END $$;

-- An owner change and the removal of that member, the removal first: the save waits for it and is refused, the member being no longer one.
DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  r := pg_temp.race(pg_temp.as_first('acme_owner', format('public.remove_member(%L, %L)', pg_temp.id('acme'), pg_temp.id('acme_agent3'))), 'acme_owner',
    pg_temp.second(pg_temp.call_save('qd', 1, 'To a leaver', 'acme_agent3')));
  PERFORM pg_temp.is(pg_temp.step(r), 'waited', 'giving a contact to a member waits for their removal in flight');
  PERFORM pg_temp.is(pg_temp.rest(r), '22023: Choose one of the firm''s people as the owner.', 'and is then refused');
  PERFORM pg_temp.is((SELECT owner_id FROM public.contacts WHERE id = pg_temp.id('qd')), pg_temp.id('acme_agent1'), 'the contact keeps its owner');
END $$;

-- The owner change first: the removal of that member waits for it, so a contact is never left with an owner who left a moment before.
DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  r := pg_temp.race(pg_temp.as_first('acme_owner', pg_temp.call_save('qe', 1, 'To a member', 'acme_west')), 'acme_owner',
    pg_temp.second(format('public.remove_member(%L, %L)', pg_temp.id('acme'), pg_temp.id('acme_west'))));
  PERFORM pg_temp.is(pg_temp.step(r), 'waited', 'the removal waits for a contact being given to that member');
  PERFORM pg_temp.is((SELECT owner_id FROM public.contacts WHERE id = pg_temp.id('qe')), pg_temp.id('acme_west'), 'the contact was given to them');
  -- (valid_until is the removing session's own clock; this block's transaction began before it, so "current" is not asked here.)
  PERFORM pg_temp.is((SELECT valid_until IS NOT NULL FROM public.firm_memberships WHERE user_id = pg_temp.id('acme_west') AND firm_id = pg_temp.id('acme')), true, 'and then the removal went through');
END $$;

SELECT 'contact_page: ok' AS result;
