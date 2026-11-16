-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh account_archive_delete_owner
-- Archive, restore and delete an account, and change its owner (story CRM-A1.1c; docs/BROKER_CRM_BUILD.md D-204, D-209, D-214, D-219, D-222;
-- 20261119160000_account_archive_delete_owner.sql). Two firms: Acme sees by level, Zenith shows everyone everything. Every migration is loaded, in order.
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
\i supabase/migrations/20261123100000_quote_statuses.sql
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
-- Runs a statement that returns one text value as a person (at a firm's address when one is named) and says what it answered, or the SQLSTATE and words it
-- raised as "STATE: words". A refusal rolls its own work back; an answer keeps it.
CREATE FUNCTION pg_temp.run(who text, stmt text, addr text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; s text; m text;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  BEGIN
    EXECUTE stmt INTO r;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS s = RETURNED_SQLSTATE, m = MESSAGE_TEXT;
    RESET ROLE;
    RETURN s || ': ' || m;
  END;
  RESET ROLE;
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.archive(who text, acct text, firm text DEFAULT 'acme') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.archive_account(%L, %L)::text', pg_temp.id(acct), pg_temp.id(firm)))
$$;
CREATE FUNCTION pg_temp.restore(who text, acct text, firm text DEFAULT 'acme') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.restore_account(%L, %L)::text', pg_temp.id(acct), pg_temp.id(firm)))
$$;
CREATE FUNCTION pg_temp.remove(who text, acct text, firm text DEFAULT 'acme') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.delete_account(%L, %L)::text', pg_temp.id(acct), pg_temp.id(firm)))
$$;
CREATE FUNCTION pg_temp.give(who text, acct text, to_who text, with_opps boolean DEFAULT false, firm text DEFAULT 'acme') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT public.change_account_owner(%L, %L, %s, %L)::text', pg_temp.id(acct), pg_temp.id(to_who), with_opps::text, pg_temp.id(firm)))
$$;
CREATE FUNCTION pg_temp.owner_of(tbl text, n text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  EXECUTE format('SELECT (SELECT name FROM fx WHERE id = t.owner_id) FROM public.%I t WHERE t.id = %L', tbl, pg_temp.id(n)) INTO r;
  RETURN r;
END $$;

DO $$
BEGIN
  RESET ROLE;
  -- a1: agent1's, with two contacts and two empty opportunities (one open owned by agent1, one owned by agent2, one with the intake-less "won" stage cannot exist
  -- without an intake, so stages are tested with real intakes below). a2: agent2's (team Sales). a3: no owner. z1: Zenith's.
  PERFORM pg_temp.account('a1', 'acme', 'acme_agent1');
  PERFORM pg_temp.contact('c1', 'a1', 'acme_agent1', 'c1@x.test', NULL, true);
  PERFORM pg_temp.contact('c2', 'a1', 'acme_agent1', 'c2@x.test');
  PERFORM pg_temp.opportunity('o1', 'a1', 'acme_agent1', NULL, 'c1');
  PERFORM pg_temp.opportunity('o2', 'a1', 'acme_agent2');
  PERFORM pg_temp.account('a2', 'acme', 'acme_agent2');
  PERFORM pg_temp.account('a3', 'acme', NULL);
  PERFORM pg_temp.account('z1', 'zenith', 'zenith_agent');
  -- a4 holds an intake (a submission): the one that can never be deleted. a5 holds a won one and an open one (an owner change's open opportunities).
  PERFORM pg_temp.account('a4', 'acme', 'acme_agent1');
  PERFORM pg_temp.intake('i4', 'acme');
  PERFORM pg_temp.opportunity('o4', 'a4', 'acme_agent1', 'i4');
  PERFORM pg_temp.account('a5', 'acme', 'acme_agent1');
  PERFORM pg_temp.intake('i5', 'acme');
  PERFORM pg_temp.opportunity('o5won', 'a5', 'acme_agent1', 'i5');
  PERFORM pg_temp.opportunity('o5a', 'a5', 'acme_agent1');
  PERFORM pg_temp.opportunity('o5b', 'a5', 'acme_agent2');
  PERFORM pg_temp.opportunity('o5c', 'a5', 'acme_lead2');
  UPDATE public.submission_workflow SET status = 'won' WHERE session_id = pg_temp.id('i5');
  PERFORM pg_temp.is(public.opportunity_stage(pg_temp.id('o5won')), 'won', 'set-up: the opportunity with the won intake is Won');
END $$;

-- ---------- archive and restore ----------
-- Break caught: the owner of an account can't archive it, or a colleague who is not entitled can (the level rule is skipped, or read from visibility: Zenith
-- shows everyone everything and still refuses a colleague); a person with no firm, another firm's member, or someone naming another firm's account is served
-- (they get PT404 or 42501, the same as for no account); a closing firm or Nevermore support archives; archiving an archived account is a second change
-- (history grows); archiving touches the account's opportunities; restore needs an owner who isn't the account's; the history lacks who archived it.
DO $$
DECLARE r text; sess uuid; h1 bigint; h2 bigint;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.archive('acme_agent2', 'a1'), 'PT404: That account isn''t available', 'a colleague agent, who by level does not see it, may not archive another agent''s account');
  PERFORM pg_temp.is(pg_temp.archive('acme_agent1', 'a3'), 'PT404: That account isn''t available', 'an agent does not see an account with no owner: it is not available');
  PERFORM pg_temp.is(pg_temp.archive('acme_lead2', 'a3'), 'PT404: That account isn''t available', 'nor does a lead with no team');
  PERFORM pg_temp.is(pg_temp.archive('acme_owner', 'z1'), 'PT404: That account isn''t available', 'another firm''s account, named at your own firm, is not available');
  PERFORM pg_temp.is(pg_temp.archive('acme_owner', 'z1', 'zenith'), '42501: Not a member of that firm', 'naming the other firm is refused as no membership');
  PERFORM pg_temp.is(pg_temp.run('acme_owner', format('SELECT public.archive_account(%L, NULL)::text', pg_temp.id('z1'))), 'PT404: That account isn''t available', 'and an account of another firm, at your own firm, is not available');
  PERFORM pg_temp.is(pg_temp.archive('nobody', 'a1'), '42501: Not a member of that firm', 'a person with no firm is refused');
  PERFORM pg_temp.is(pg_temp.archive('platform_admin', 'a1'), '42501: Not a member of that firm', 'a platform admin is no member');
  PERFORM pg_temp.is(pg_temp.archive('acme_removed', 'a1'), '42501: Not a member of that firm', 'nor a former member');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.archive_account(%L, %L)$q$, pg_temp.id('a1'), pg_temp.id('acme'))), '42501', 'a signed-out caller has no right to run it');
  RESET ROLE;
  -- Zenith shows everyone everything: a colleague sees, and still may not change.
  PERFORM pg_temp.account('z2', 'zenith', 'zenith_agent');
  PERFORM pg_temp.is(pg_temp.archive('zenith_agent2', 'z2', 'zenith'), '42501: Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'visibility lets a colleague see an account, never archive it');

  SELECT count(*) INTO h1 FROM public.record_history x WHERE x.table_name = 'accounts' AND x.record_key = pg_temp.id('a1')::text;
  r := pg_temp.archive('acme_agent1', 'a1');
  PERFORM pg_temp.is((r::jsonb ->> 'changed')::boolean, true, 'an agent archives their own account');
  PERFORM pg_temp.is((r::jsonb #>> '{record,archived_at}') IS NOT NULL, true, 'and the answer carries it archived');
  PERFORM pg_temp.is((SELECT archived_at IS NOT NULL FROM public.accounts WHERE id = pg_temp.id('a1')), true, 'the row is archived');
  SELECT count(*) INTO h2 FROM public.record_history x WHERE x.table_name = 'accounts' AND x.record_key = pg_temp.id('a1')::text;
  PERFORM pg_temp.is(h2, h1 + 1, 'the history gains one entry');
  PERFORM pg_temp.is((SELECT string_agg(x.field, ',') FROM public.record_history x WHERE x.table_name = 'accounts' AND x.record_key = pg_temp.id('a1')::text AND x.field = 'archived_at'), 'archived_at', 'which says archived_at changed');
  PERFORM pg_temp.is((SELECT x.actor_id FROM public.record_history x WHERE x.table_name = 'accounts' AND x.record_key = pg_temp.id('a1')::text AND x.field = 'archived_at'), pg_temp.id('acme_agent1'), 'by the person who archived it');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE account_id = pg_temp.id('a1')), 2::bigint, 'archiving leaves the opportunities alone');
  r := pg_temp.archive('acme_agent1', 'a1');
  PERFORM pg_temp.is((r::jsonb ->> 'changed')::boolean, false, 'archiving it again changes nothing');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history x WHERE x.table_name = 'accounts' AND x.record_key = pg_temp.id('a1')::text), h2, 'and adds nothing to the history');

  -- An archived account's fields can still be edited (D-222).
  PERFORM pg_temp.is(pg_temp.run('acme_agent1', format($q$SELECT (public.update_account(%L, 'Renamed A1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', NULL, %L, %s)->>'conflict')$q$,
    pg_temp.id('a1'), pg_temp.id('acme'), (SELECT version FROM public.accounts WHERE id = pg_temp.id('a1')))), 'false', 'an archived account can still be edited');

  -- The table's Archived view finds it, and no other view does.
  PERFORM pg_temp.as_user('acme_agent1');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts_view_counts(pg_temp.id('acme'), '[{"name":"All","filters":[]},{"name":"Archived","filters":[{"field":"archived","op":"is","value":true}]}]'::jsonb, NULL, 'UTC') WHERE view_name = 'Archived' AND total = 1), 1::bigint, 'the Archived view counts it');
  PERFORM pg_temp.is((SELECT total FROM public.accounts_view_counts(pg_temp.id('acme'), '[{"name":"All","filters":[]}]'::jsonb, NULL, 'UTC')), 2::bigint, 'and the All view does not: agent1 reads a4 and a5 there, not the archived a1');
  RESET ROLE;

  -- Restore.
  PERFORM pg_temp.is(pg_temp.restore('zenith_agent2', 'z2', 'zenith'), '42501: Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'a colleague may not restore it either, where visibility shows it');
  PERFORM pg_temp.is(left(pg_temp.restore('acme_lead2', 'a1'), 6), 'PT404:', 'a lead whose team does not reach the account does not see it to restore');
  r := pg_temp.restore('acme_agent1', 'a1');
  PERFORM pg_temp.is((r::jsonb ->> 'changed')::boolean, true, 'its owner restores it');
  PERFORM pg_temp.is((SELECT archived_at IS NULL FROM public.accounts WHERE id = pg_temp.id('a1')), true, 'it is no longer archived');
  PERFORM pg_temp.is((pg_temp.restore('acme_agent1', 'a1')::jsonb ->> 'changed')::boolean, false, 'restoring one that is not archived changes nothing');
  -- An owner of the firm archives and restores anyone's, and the one with no owner.
  PERFORM pg_temp.is((pg_temp.archive('acme_owner', 'a3')::jsonb ->> 'changed')::boolean, true, 'an owner of the firm archives an account with no owner');
  PERFORM pg_temp.is((pg_temp.restore('acme_owner', 'a3')::jsonb ->> 'changed')::boolean, true, 'and restores it');
  -- A lead archives a teammate's, from the team the account's owner is in (agent2 is in Sales).
  PERFORM pg_temp.is((pg_temp.archive('acme_lead', 'a2')::jsonb ->> 'changed')::boolean, true, 'a lead archives their team''s account');
  PERFORM pg_temp.restore('acme_lead', 'a2');

  -- A closing firm and Nevermore support change nothing (ADR 0023, ADR 0024).
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(left(pg_temp.archive('acme_owner', 'a2'), 6), 'PT423:', 'a closing firm archives nothing');
  PERFORM pg_temp.is(left(pg_temp.restore('acme_owner', 'a2'), 6), 'PT423:', 'restores nothing');
  PERFORM pg_temp.is(left(pg_temp.remove('acme_owner', 'a2'), 6), 'PT423:', 'deletes nothing');
  PERFORM pg_temp.is(left(pg_temp.give('acme_owner', 'a2', 'acme_agent1'), 6), 'PT423:', 'and changes no owner');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an account the firm asked about') t);
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is(left(pg_temp.run('platform_admin', format('SELECT public.archive_account(%L, %L)::text', pg_temp.id('a2'), pg_temp.id('acme')), 'acme-brokers'), 6), 'PT423:', 'Nevermore support archives nothing');
  PERFORM pg_temp.is(left(pg_temp.run('platform_admin', format('SELECT public.delete_account(%L, %L)::text', pg_temp.id('a2'), pg_temp.id('acme')), 'acme-brokers'), 6), 'PT423:', 'deletes nothing');
  PERFORM pg_temp.is(left(pg_temp.run('platform_admin', format('SELECT public.change_account_owner(%L, %L, false, %L)::text', pg_temp.id('a2'), pg_temp.id('acme_agent1'), pg_temp.id('acme')), 'acme-brokers'), 6), 'PT423:', 'and changes no owner');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  RAISE NOTICE 'account_archive_delete_owner: archive and restore passed';
END $$;

-- ---------- delete ----------
-- Break caught: an account that has an opportunity is deleted (any opportunity, one a colleague owns, one holding an intake or a quote request: D-219), by
-- anyone; the refusal deletes anything on its way; an account with no opportunity keeps its contacts, its calls, notes and tasks or its history after it is
-- deleted, or an account that marked it as a possible duplicate keeps pointing at it; archive or restore takes its calls, notes and tasks away, or an archived
-- account takes a new one (D-233); someone the level rule refuses deletes; a firm owner can't delete an account with no owner.
DO $$
DECLARE r text;
BEGIN
  RESET ROLE;
  -- d1: agent3's, two contacts, a call, a note and a task, no opportunity. a6 marks it as its possible duplicate.
  PERFORM pg_temp.account('d1', 'acme', 'acme_agent3');
  PERFORM pg_temp.contact('d1c1', 'd1', 'acme_agent3', 'd1c1@x.test', NULL, true);
  PERFORM pg_temp.contact('d1c2', 'd1', 'acme_agent3', 'd1c2@x.test');
  PERFORM pg_temp.account('a6', 'acme', 'acme_agent3');
  UPDATE public.accounts SET possible_duplicate_of = pg_temp.id('d1') WHERE id = pg_temp.id('a6');
  INSERT INTO public.activities (firm_id, account_id, kind, author_id, outcome, body) VALUES (pg_temp.id('acme'), pg_temp.id('d1'), 'call', pg_temp.id('acme_agent3'), 'spoke', 'Hello');
  INSERT INTO public.activities (firm_id, account_id, kind, author_id, body) VALUES (pg_temp.id('acme'), pg_temp.id('d1'), 'note', pg_temp.id('acme_agent3'), 'A note');
  INSERT INTO public.activities (firm_id, account_id, kind, author_id, title, due_on) VALUES (pg_temp.id('acme'), pg_temp.id('d1'), 'task', pg_temp.id('acme_agent3'), 'Send it', current_date);
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('d1')), 3::bigint, 'set-up: a call, a note and a task');
  PERFORM pg_temp.is((SELECT count(*) > 0 FROM public.record_history x WHERE x.record_key IN (pg_temp.id('d1')::text, pg_temp.id('d1c1')::text, pg_temp.id('d1c2')::text)), true, 'set-up: history');

  PERFORM pg_temp.is(pg_temp.remove('acme_agent2', 'd1'), 'PT404: That account isn''t available', 'an agent who does not see the account can not delete it');
  PERFORM pg_temp.is(pg_temp.remove('acme_lead2', 'd1'), 'PT404: That account isn''t available', 'nor a lead whose team does not reach it');
  PERFORM pg_temp.is(pg_temp.remove('acme_removed', 'd1'), '42501: Not a member of that firm', 'nor a former member');
  PERFORM pg_temp.is(pg_temp.remove('zenith_agent2', 'z1', 'zenith'), '42501: Only the account''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'a colleague who sees it (visibility) still may not delete it');

  -- Archive and restore leave the calls, notes and tasks, and an archived account takes no new one (D-233).
  PERFORM pg_temp.archive('acme_agent3', 'd1');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('d1')), 3::bigint, 'archiving leaves its calls, notes and tasks');
  PERFORM pg_temp.is(left(pg_temp.run('acme_agent3', format($q$SELECT public.log_activity('note', %L, NULL, NULL, NULL, NULL, 'Late', NULL, NULL, NULL, NULL, NULL, NULL, %L)::text$q$, pg_temp.id('d1'), pg_temp.id('acme'))), 6), '55000:', 'an archived account takes no new note');
  PERFORM pg_temp.restore('acme_agent3', 'd1');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('d1')), 3::bigint, 'restoring leaves them too');

  r := pg_temp.remove('acme_agent3', 'd1');
  PERFORM pg_temp.is((r::jsonb ->> 'deleted')::boolean, true, 'an agent deletes their own account with no opportunity');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = pg_temp.id('d1')), 0::bigint, 'it is gone');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('d1')), 0::bigint, 'with its contacts');
  PERFORM pg_temp.is((SELECT count(*) FROM public.activities WHERE account_id = pg_temp.id('d1')), 0::bigint, 'and its calls, notes and tasks (D-204)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history x WHERE x.record_key IN (pg_temp.id('d1')::text, pg_temp.id('d1c1')::text, pg_temp.id('d1c2')::text)), 0::bigint, 'and their history');
  PERFORM pg_temp.is((SELECT possible_duplicate_of FROM public.accounts WHERE id = pg_temp.id('a6')), NULL::uuid, 'an account marked as its duplicate is kept, the mark cleared');
  PERFORM pg_temp.is(pg_temp.remove('acme_agent3', 'd1'), 'PT404: That account isn''t available', 'deleting it again says it is not available');

  -- Any opportunity refuses, and nothing is deleted on the way: a1 has two (one a colleague's); a4 holds an intake with a quote request on it; a5 a won one.
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (pg_temp.id('i4'), 'PEO A', 'sent');
  FOR r IN SELECT unnest(ARRAY['a1', 'a4', 'a5']) LOOP
    PERFORM pg_temp.is(pg_temp.remove('acme_owner', r), 'PT409: This account has opportunities, so it can''t be deleted. Archive it instead.', 'an owner of the firm can not delete ' || r || ', which has opportunities');
  END LOOP;
  PERFORM pg_temp.is(pg_temp.remove('acme_agent1', 'a1'), 'PT409: This account has opportunities, so it can''t be deleted. Archive it instead.', 'nor can its own agent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE account_id IN (pg_temp.id('a1'), pg_temp.id('a4'), pg_temp.id('a5'))), 7::bigint, 'the refusals deleted no opportunity (a colleague''s included)');
  PERFORM pg_temp.is((SELECT count(*) FROM public.contacts WHERE account_id = pg_temp.id('a1')), 2::bigint, 'nor a contact');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests WHERE session_id = pg_temp.id('i4')), 1::bigint, 'nor the quote request');
  PERFORM pg_temp.is((pg_temp.archive('acme_agent1', 'a4')::jsonb ->> 'changed')::boolean, true, 'it can be archived');
  PERFORM pg_temp.restore('acme_agent1', 'a4');

  -- A firm owner deletes an account with no owner, and a lead one of their team's.
  PERFORM pg_temp.is((pg_temp.remove('acme_owner', 'a3')::jsonb ->> 'deleted')::boolean, true, 'an owner of the firm deletes an account with no owner');
  PERFORM pg_temp.account('a7', 'acme', 'acme_agent2');
  PERFORM pg_temp.is((pg_temp.remove('acme_lead', 'a7')::jsonb ->> 'deleted')::boolean, true, 'a lead deletes their team''s account');
  RAISE NOTICE 'account_archive_delete_owner: delete passed';
END $$;

-- ---------- change the owner ----------
-- Break caught: the owner is changed by someone the level rule refuses; given to someone who is no member of the firm (another firm's, a former member's) or to
-- no one; the open opportunities change without being asked, or not when asked, or a won one changes; an opportunity the caller may not change (owned by a
-- colleague) is changed because the account was theirs, or the caller is not told how many were left; the same owner is a second change.
DO $$
DECLARE r jsonb; hist bigint;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is(pg_temp.give('acme_agent2', 'a5', 'acme_agent3'), 'PT404: That account isn''t available', 'a colleague who does not see the account can not give it away');
  PERFORM pg_temp.is(left(pg_temp.give('acme_agent1', 'a5', 'zenith_agent'), 6), '22023:', 'it can not be given to another firm''s member');
  PERFORM pg_temp.is(left(pg_temp.give('acme_agent1', 'a5', 'acme_removed'), 6), '22023:', 'nor to a former member');
  PERFORM pg_temp.is(left(pg_temp.give('acme_agent1', 'a5', 'nobody'), 6), '22023:', 'nor to a person with no firm');
  PERFORM pg_temp.is(pg_temp.run('acme_agent1', format('SELECT public.change_account_owner(%L, NULL, false, %L)::text', pg_temp.id('a5'), pg_temp.id('acme'))), '22023: Choose who will own this account.', 'nor to no one');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'a5'), 'acme_agent1', 'a refusal changes nothing');

  -- Without the offer taken, only the account changes.
  SELECT count(*) INTO hist FROM public.record_history x WHERE x.table_name = 'accounts' AND x.record_key = pg_temp.id('a5')::text;
  r := pg_temp.give('acme_agent1', 'a5', 'acme_agent3', false)::jsonb;
  PERFORM pg_temp.is(r #>> '{owner,name}', 'acme_agent3@example.test', 'the answer names the new owner');
  PERFORM pg_temp.is((r ->> 'opportunities_changed')::integer, 0, 'with no opportunity changed');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'a5'), 'acme_agent3', 'the account has its new owner');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'o5a'), 'acme_agent1', 'its open opportunities keep theirs when not asked');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history x WHERE x.table_name = 'accounts' AND x.record_key = pg_temp.id('a5')::text), hist + 1, 'the history gains the owner change');
  -- agent1 no longer sees a5 (an agent sees their own); the new owner gives it back, offering its open opportunities.
  PERFORM pg_temp.is(pg_temp.give('acme_agent1', 'a5', 'acme_agent1'), 'PT404: That account isn''t available', 'the old owner, who no longer sees it, can not take it back');
  r := pg_temp.give('acme_agent3', 'a5', 'acme_agent3', true)::jsonb;
  PERFORM pg_temp.is((r ->> 'opportunities_changed')::integer, 0, 'giving it to its own owner changes no opportunity that is not the caller''s to change');
  RESET ROLE;
  -- The caller owns the account and one open opportunity (o5a is agent1's, so first give it to agent3 as the owner of the firm, offering it).
  r := pg_temp.give('acme_owner', 'a5', 'acme_agent1', true)::jsonb;
  PERFORM pg_temp.is((r ->> 'opportunities_changed')::integer, 2, 'an owner of the firm gives the account and the two open opportunities not already the new owner''s');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'o5won'), 'acme_agent1', 'the won one keeps its owner (it was agent1''s already)');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'o5b'), 'acme_agent1', 'the open one a colleague owned went with it, for an owner of the firm');
  -- Now agent1 owns the account and all of it. Hand over with the offer to agent3 as agent1: agent2 and lead2 owned two of the opportunities, so own all.
  UPDATE public.opportunities SET owner_id = pg_temp.id('acme_agent2') WHERE id = pg_temp.id('o5b');
  UPDATE public.opportunities SET owner_id = pg_temp.id('acme_lead2') WHERE id = pg_temp.id('o5c');
  r := pg_temp.give('acme_agent1', 'a5', 'acme_agent3', true)::jsonb;
  PERFORM pg_temp.is((r ->> 'opportunities_changed')::integer, 1, 'an agent changes their own open opportunity');
  PERFORM pg_temp.is((r ->> 'opportunities_skipped')::integer, 2, 'and is told two of a colleague''s were left');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'o5a'), 'acme_agent3', 'their own went with the account');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'o5b'), 'acme_agent2', 'a colleague''s did not');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'o5c'), 'acme_lead2', 'nor another''s');
  PERFORM pg_temp.is(pg_temp.owner_of('opportunities', 'o5won'), 'acme_agent1', 'a won opportunity is never changed');
  -- An owner of the firm assigns an account with no owner.
  PERFORM pg_temp.account('a8', 'acme', NULL);
  PERFORM pg_temp.is(pg_temp.give('acme_lead', 'a8', 'acme_lead'), 'PT404: That account isn''t available', 'a lead does not see an account with no owner');
  PERFORM pg_temp.is((pg_temp.give('acme_owner', 'a8', 'acme_lead')::jsonb #>> '{record,archived_at}') IS NULL, true, 'an owner of the firm assigns an account with no owner');
  PERFORM pg_temp.is(pg_temp.owner_of('accounts', 'a8'), 'acme_lead', 'and it is the lead''s');
  RAISE NOTICE 'account_archive_delete_owner: owner change passed';
END $$;

-- ---------- delete races a new opportunity ----------
-- Break caught: delete_account looks for opportunities without holding the account's row first, so a delete that runs while an opportunity is being added
-- (not yet committed) sees none, and the account and the new opportunity meet at the foreign key (an error that names no reason). The delete is seen
-- WAITING on the uncommitted opportunity, and once it commits is refused in words, the account kept. The refusal itself is caught too: with it gone the
-- delete would answer the foreign key's error, not PT409.
CREATE SCHEMA race;
CREATE EXTENSION dblink SCHEMA race;

-- A runs `first_stmt` (as the superuser) in a transaction it leaves open; B runs its statement as a person and is waited for; then A commits.
CREATE FUNCTION pg_temp.race_delete(first_stmt text, b_who text, b_stmt text) RETURNS text LANGUAGE plpgsql AS $$
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
  BEGIN PERFORM race.dblink_exec('rb', 'ROLLBACK'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM race.dblink_disconnect('ra');
  PERFORM race.dblink_disconnect('rb');
  RETURN CASE WHEN waited THEN 'waited' ELSE 'did not wait' END || '|' || COALESCE(rb, '<null>');
END $$;

DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('r1', 'acme', 'acme_agent1');
END $$;

DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  r := pg_temp.race_delete(
    format($q$INSERT INTO public.opportunities (firm_id, account_id, name) VALUES (%L, %L, 'in flight')$q$, firm, pg_temp.id('r1')),
    'acme_agent1',
    format($q$SELECT public.delete_account(%L, %L)::text$q$, pg_temp.id('r1'), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the delete waits for the opportunity being added');
  PERFORM pg_temp.is(split_part(r, '|', 2), 'PT409', 'and, once it has committed, refuses in words');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = pg_temp.id('r1')), 1::bigint, 'the account is kept');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE name = 'in flight'), 1::bigint, 'and so is the opportunity');
  RAISE NOTICE 'account_archive_delete_owner: the race passed';
END $$;

-- ---------- the owner change races a member's removal ----------
-- Break caught: change_account_owner asks "is the chosen person a current member" without holding their membership row (FOR SHARE), so a removal that commits
-- after the question leaves the account (and its opportunities) owned by a former member. Both orders are seen WAITING: a removal not yet committed makes the
-- owner change wait and then be refused in words (22023); an owner change not yet committed makes the removal wait, and the owner change keeps its answer.
-- The removal (remove_member) holds the membership row FOR UPDATE and then the firm's row (keep_firm_owner, for an owner only); the owner change holds the
-- account, then the membership FOR SHARE, then the opportunities: the removal never takes an account or an opportunity, so the two cannot wait on each other in a ring.
DO $$
BEGIN
  RESET ROLE;
  PERFORM pg_temp.new_user('acme_mover1'); PERFORM pg_temp.new_user('acme_mover2'); PERFORM pg_temp.new_user('acme_mover3');
  INSERT INTO public.firm_memberships (firm_id, user_id, role, team_id) VALUES
    (pg_temp.id('acme'), pg_temp.id('acme_mover1'), 'agent', NULL), (pg_temp.id('acme'), pg_temp.id('acme_mover2'), 'agent', NULL), (pg_temp.id('acme'), pg_temp.id('acme_mover3'), 'agent', NULL);
  PERFORM pg_temp.account('m1', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('m2', 'acme', 'acme_agent1');
  PERFORM pg_temp.account('m3', 'acme', 'acme_agent1');
END $$;

DO $$
DECLARE r text; firm uuid := pg_temp.id('acme');
BEGIN
  RESET ROLE;
  -- A removes the person (not yet committed); B gives them an account.
  r := pg_temp.race_delete(
    format($q$SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; DO $d$ BEGIN PERFORM public.remove_member(%L, %L); END $d$ $q$,
      jsonb_build_object('sub', pg_temp.id('acme_owner'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_owner@example.test')::text, firm, pg_temp.id('acme_mover1')),
    'acme_agent1',
    format($q$SELECT public.change_account_owner(%L, %L, true, %L)::text$q$, pg_temp.id('m1'), pg_temp.id('acme_mover1'), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the owner change waits for the removal of the person it names');
  PERFORM pg_temp.is(split_part(r, '|', 2), '22023', 'and, once it has committed, is refused: not a current member');
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = pg_temp.id('m1')), pg_temp.id('acme_agent1'), 'the account is not left with a former member');
  -- A gives an account to the person (not yet committed); B removes them.
  r := pg_temp.race_delete(
    format($q$SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = %L; DO $d$ BEGIN PERFORM public.change_account_owner(%L, %L, false, %L); END $d$ $q$,
      jsonb_build_object('sub', pg_temp.id('acme_agent1'), 'role', 'authenticated', 'is_anonymous', false, 'email', 'acme_agent1@example.test')::text, pg_temp.id('m2'), pg_temp.id('acme_mover2'), firm),
    'acme_owner',
    format($q$SELECT public.remove_member(%L, %L)::text$q$, firm, pg_temp.id('acme_mover2')));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the removal waits for an owner change that names the person');
  PERFORM pg_temp.is((SELECT owner_id FROM public.accounts WHERE id = pg_temp.id('m2')), pg_temp.id('acme_mover2'), 'and the owner change stands');
  -- A plain update of the membership's end (a non-key update, which a weaker lock than FOR SHARE would not wait for), whatever path made it.
  r := pg_temp.race_delete(
    format($q$UPDATE public.firm_memberships SET valid_until = now() WHERE user_id = %L$q$, pg_temp.id('acme_mover3')),
    'acme_agent1',
    format($q$SELECT public.change_account_owner(%L, %L, false, %L)::text$q$, pg_temp.id('m3'), pg_temp.id('acme_mover3'), firm));
  PERFORM pg_temp.is(split_part(r, '|', 1), 'waited', 'the owner change waits for any update that ends the membership');
  PERFORM pg_temp.is(split_part(r, '|', 2), '22023', 'and is then refused');
  RAISE NOTICE 'account_archive_delete_owner: the removal races passed';
END $$;

-- ---------- which accounts the caller may change ----------
-- Break caught: the table offers row actions on accounts the database will refuse (a colleague's in a firm that shows everyone everything, an unowned one to a
-- lead, any in a closing firm or a support session); another firm's account id, or one the caller may not see, is answered as changeable; more than 100 ids
-- are answered; a non-member is served; the function is callable signed out.
CREATE FUNCTION pg_temp.changeable(who text, firm text, ids text[], addr text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.run(who, format('SELECT (SELECT COALESCE(string_agg(f.name, '','' ORDER BY f.name), '''') FROM unnest(public.accounts_can_change(%L, %L)) u JOIN fx f ON f.id = u)',
    pg_temp.id(firm), (SELECT array_agg(pg_temp.id(x)) FROM unnest(ids) x)), addr)
$$;

DO $$
DECLARE sess uuid; many text;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.account('z3', 'zenith', 'zenith_agent2');
  PERFORM pg_temp.is(pg_temp.changeable('acme_agent1', 'acme', ARRAY['a2', 'a4', 'a5', 'a8']), 'a4', 'an agent is offered their own only (a5 was given away) (the others are not even seen)');
  PERFORM pg_temp.is(pg_temp.changeable('acme_lead', 'acme', ARRAY['a2', 'a4', 'a8']), 'a2,a8', 'a lead is offered their team''s and their own, not an agent outside it');
  PERFORM pg_temp.is(pg_temp.changeable('acme_owner', 'acme', ARRAY['a2', 'a4', 'a5', 'a8', 'z1']), 'a2,a4,a5,a8', 'an owner of the firm is offered the firm''s, never another firm''s account');
  PERFORM pg_temp.is(pg_temp.changeable('zenith_agent2', 'zenith', ARRAY['z1', 'z2', 'z3']), 'z3', 'where everyone sees everything an agent is offered only their own: colleagues'' accounts are seen, not changeable');
  PERFORM pg_temp.is(pg_temp.changeable('acme_agent1', 'acme', ARRAY[]::text[]), '', 'no ids, none');
  PERFORM pg_temp.is(pg_temp.changeable('acme_removed', 'acme', ARRAY['a4']), '42501: Not a member of that firm', 'a former member is refused');
  PERFORM pg_temp.is(pg_temp.changeable('nobody', 'acme', ARRAY['a4']), '42501: Not a member of that firm', 'so is a person with no firm');
  SELECT string_agg(quote_literal(gen_random_uuid()::text), ',') INTO many FROM generate_series(1, 101);
  PERFORM pg_temp.is(left(pg_temp.run('acme_owner', format('SELECT public.accounts_can_change(%L, ARRAY[%s]::uuid[])::text', pg_temp.id('acme'), many)), 6), '22023:', 'more than 100 ids are refused');
  PERFORM pg_temp.as_anon();
  PERFORM pg_temp.is(pg_temp.attempt(format($q$SELECT public.accounts_can_change(%L, '{}')$q$, pg_temp.id('acme'))), '42501', 'signed out has no right to run it');
  RESET ROLE;
  -- A closing firm and Nevermore support are offered nothing: every change would be refused.
  INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('acme'), pg_temp.id('acme_owner'), now() + interval '30 days');
  PERFORM pg_temp.is(pg_temp.changeable('acme_owner', 'acme', ARRAY['a2', 'a4']), '', 'a closing firm is offered nothing');
  DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.as_user('platform_admin');
  sess := (SELECT t.session_id FROM public.start_support_session(pg_temp.id('acme'), 'Looking at an account the firm asked about') t);
  PERFORM pg_temp.is(pg_temp.changeable('platform_admin', 'acme', ARRAY['a2', 'a4'], 'acme-brokers'), '', 'Nevermore support is offered nothing');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.end_support_session(sess);
  RESET ROLE;
  RAISE NOTICE 'account_archive_delete_owner: which accounts may be changed passed';
END $$;
