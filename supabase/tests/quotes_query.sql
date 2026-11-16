-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quotes_query
-- The quotes table's query (story CRM-Q4.1, slice 5.11; docs/BROKER_CRM_BUILD.md D-1702, D-1705, D-1707, D-1800 to D-1809; 20261123180000_quotes_table.sql).
-- quotes_list and quotes_view_counts: one row per PEO per opportunity, and one per opportunity left half done (an intake and no quote request), the rows a person may
-- see, searched, filtered and sorted. Two firms: Acme sees by level, Zenith shows everyone everything. Every migration is loaded, in filename order (D-105), this one last.
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
\i supabase/migrations/20261122240000_lead_alert_and_captcha.sql
\i supabase/migrations/20261122250000_convert_lead.sql
\i supabase/migrations/20261123090000_opportunity_close_withdraw.sql
\i supabase/migrations/20261123100000_quote_statuses.sql
\i supabase/migrations/20261123110000_firm_link.sql
\i supabase/migrations/20261123130000_new_quote_account.sql
\i supabase/migrations/20261123180000_quotes_table.sql
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



-- A certified intake's File ID, set the way a certification does: on the intake itself.
CREATE FUNCTION pg_temp.file_id(n text, p_file text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  SET LOCAL session_replication_role = replica;   -- the File ID is the database's (20261104120000); a fixture places one
  UPDATE public.chamber_sessions SET file_id = p_file WHERE id = pg_temp.id(n);
  SET LOCAL session_replication_role = origin;
END $$;

-- A quote request, made as the superuser (the product's functions need a mailbox and a certified version): named in fx as 'q_<intake>_<peo>'.
CREATE FUNCTION pg_temp.quote(p_intake text, p_peo text, p_status text, p_sent_on date DEFAULT NULL) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE r bigint;
BEGIN
  INSERT INTO public.quote_requests (session_id, peo_name, status, sent_on) VALUES (pg_temp.id(p_intake), p_peo, p_status, p_sent_on) RETURNING id INTO r;
  RETURN r;
END $$;

-- The rows of a page, in order, as the caller reads them: "<account>/<PEO>", or "<account>/-" for an opportunity left half done.
CREATE FUNCTION pg_temp.rows_of(page jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg((e ->> 'account_name') || '/' || COALESCE(e ->> 'peo', '-'), ',' ORDER BY o), '') FROM jsonb_array_elements(page -> 'rows') WITH ORDINALITY AS x (e, o)
$$;

-- ---------- fixtures: Acme's accounts, each with an opportunity; the intakes carry File IDs ----------
SELECT pg_temp.account('reyes', 'acme', 'acme_agent1', 'Reyes Bakery');
SELECT pg_temp.intake('s_reyes', 'acme');
SELECT pg_temp.file_id('s_reyes', 'EAA-2026-0001');
SELECT pg_temp.opportunity('o_reyes', 'reyes', 'acme_agent1', 's_reyes');
UPDATE public.opportunities SET target_start = DATE '2027-01-01' WHERE id = pg_temp.id('o_reyes');
SELECT pg_temp.quote('s_reyes', 'TriNet', 'sent', current_date - 3);
SELECT pg_temp.quote('s_reyes', 'Justworks', 'quoted', current_date - 10);
UPDATE public.quote_requests SET quote_received_on = current_date - 2, quote_expires_on = current_date + 20, admin_fee_pepm = 31.50, proposed_start_on = DATE '2027-02-01'
WHERE session_id = pg_temp.id('s_reyes') AND peo_name = 'Justworks';

-- ---------- 1. One row for each PEO of an opportunity, with its columns ----------
DO $$
DECLARE p jsonb; r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  p := public.quotes_list(NULL);
  PERFORM pg_temp.is((p ->> 'total')::int, 2, 'an opportunity sent to two PEOs is two rows');
  PERFORM pg_temp.is((p ->> 'page_size')::int, 50, 'fifty a page');
  SELECT e INTO r FROM jsonb_array_elements(p -> 'rows') e WHERE e ->> 'peo' = 'Justworks';
  PERFORM pg_temp.is(r ->> 'account_name', 'Reyes Bakery', 'its account');
  PERFORM pg_temp.is(r ->> 'opportunity_id', pg_temp.id('o_reyes')::text, 'its opportunity');
  PERFORM pg_temp.is(r ->> 'status', 'quoted', 'its status');
  PERFORM pg_temp.is(r ->> 'file_id', 'EAA-2026-0001', 'the File ID of its intake');
  PERFORM pg_temp.is((r ->> 'admin_fee_pepm')::numeric, 31.50, 'its admin fee');
  PERFORM pg_temp.is(r ->> 'expires_on', (current_date + 20)::text, 'its expiry');
  PERFORM pg_temp.is(r ->> 'target_start', '2027-01-01', 'the opportunity''s target start');
  PERFORM pg_temp.is(r ->> 'proposed_start', '2027-02-01', 'its proposed start');
  PERFORM pg_temp.is(r ->> 'owner_name', 'acme_agent1@example.test', 'the opportunity''s owner');
  PERFORM pg_temp.is((r ->> 'quote_request_id')::bigint, (SELECT q.id FROM public.quote_requests q WHERE q.peo_name = 'Justworks'), 'the quote request it opens');
END $$;

-- ---------- 2. An opportunity left half done is a row of its own: an intake and no quote request (D-1702) ----------
SELECT pg_temp.account('kim', 'acme', 'acme_agent1', 'Kim Dental');
SELECT pg_temp.intake('s_kim', 'acme');
SELECT pg_temp.opportunity('o_kim', 'kim', 'acme_agent1', 's_kim');
SELECT pg_temp.account('lone', 'acme', 'acme_agent1', 'Lone Wolf Co');
SELECT pg_temp.opportunity('o_lone', 'lone', 'acme_agent1');                    -- no intake: nothing to resume, so no row
SELECT pg_temp.account('lost', 'acme', 'acme_agent1', 'Lost Cause Co');
SELECT pg_temp.intake('s_lost', 'acme');
SELECT pg_temp.opportunity('o_lost', 'lost', 'acme_agent1', 's_lost');
UPDATE public.submission_workflow SET status = 'archived' WHERE session_id = pg_temp.id('s_lost');  -- lost with nothing sent: finished, not half done
DO $$
DECLARE p jsonb; r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  p := public.quotes_list(NULL);
  PERFORM pg_temp.is((p ->> 'total')::int, 3, 'two quote requests and one opportunity left half done; one with no intake and one lost are none');
  SELECT e INTO r FROM jsonb_array_elements(p -> 'rows') e WHERE e ->> 'account_name' = 'Kim Dental';
  PERFORM pg_temp.is(r ->> 'status', 'not_sent', 'it reads Not sent yet');
  PERFORM pg_temp.is(r ->> 'peo', NULL, 'no PEO yet');
  PERFORM pg_temp.is(r ->> 'quote_request_id', NULL, 'no quote to open');
  PERFORM pg_temp.is(r ->> 'key', 'o' || pg_temp.id('o_kim')::text, 'its key is its opportunity''s');
  PERFORM pg_temp.is(r ->> 'opportunity_id', pg_temp.id('o_kim')::text, 'it opens the opportunity');
END $$;

-- ---------- 3. Who sees a row: the level rule on the account's owner (as search and the opportunity page read it); one firm at a time ----------
SELECT pg_temp.account('other', 'acme', 'acme_agent2', 'Other Co');
SELECT pg_temp.intake('s_other', 'acme');
SELECT pg_temp.opportunity('o_other', 'other', 'acme_agent2', 's_other');
SELECT pg_temp.quote('s_other', 'Paychex', 'sent', current_date - 1);
SELECT pg_temp.account('zed', 'zenith', 'zenith_agent', 'Zenith Co');
SELECT pg_temp.intake('s_zed', 'zenith');
SELECT pg_temp.opportunity('o_zed', 'zed', 'zenith_agent', 's_zed');
SELECT pg_temp.quote('s_zed', 'TriNet', 'sent', current_date - 1);
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL)), 'Reyes Bakery/Justworks,Reyes Bakery/TriNet,Kim Dental/-', 'an agent reads the quotes of the accounts they own, not another agent''s');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is((public.quotes_list(NULL) ->> 'total')::int, 4, 'an owner of the firm reads all of its quotes, and none of another firm''s');
  PERFORM pg_temp.as_user('zenith_agent2', 'zenith-benefits');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL)), 'Zenith Co/TriNet', 'where the firm shows everyone everything, every member reads them');
  PERFORM pg_temp.as_user('nobody', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.quotes_list(NULL)'), '42501: Not a member of a firm', 'someone outside the firm reads nothing');
END $$;

-- ---------- 4. The table's own order, "needs me first": new mail, then expiring soonest (an expired quote first of them, D-1705), then the longest wait ----------
-- A third firm of one person, so the rows above keep their counts. Eight rows: Ee has new mail; Bb's quote expired two days ago and moved nothing (D-1705); Gg's expires in 5
-- days and Aa's in 30; Cc has waited 9 days and Dd 2; Ff was never sent; Hh declined.
DO $$
DECLARE ord uuid;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Order Brokers', 'order-brokers', now()) RETURNING id INTO ord;
  INSERT INTO fx VALUES ('ord', ord);
  PERFORM pg_temp.new_user('ord_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (ord, pg_temp.id('ord_owner'), 'owner');
END $$;
SELECT pg_temp.account('ord_aa', 'ord', 'ord_owner', 'Aa Co');
SELECT pg_temp.intake('s_aa', 'ord'); SELECT pg_temp.opportunity('o_aa', 'ord_aa', 'ord_owner', 's_aa'); SELECT pg_temp.quote('s_aa', 'TriNet', 'quoted', current_date - 20);
UPDATE public.quote_requests SET quote_expires_on = current_date + 30 WHERE session_id = pg_temp.id('s_aa');
SELECT pg_temp.account('ord_bb', 'ord', 'ord_owner', 'Bb Co');
SELECT pg_temp.intake('s_bb', 'ord'); SELECT pg_temp.opportunity('o_bb', 'ord_bb', 'ord_owner', 's_bb'); SELECT pg_temp.quote('s_bb', 'TriNet', 'quoted', current_date - 40);
UPDATE public.quote_requests SET quote_expires_on = current_date - 2 WHERE session_id = pg_temp.id('s_bb');
SELECT pg_temp.account('ord_cc', 'ord', 'ord_owner', 'Cc Co');
SELECT pg_temp.intake('s_cc', 'ord'); SELECT pg_temp.opportunity('o_cc', 'ord_cc', 'ord_owner', 's_cc'); SELECT pg_temp.quote('s_cc', 'TriNet', 'sent', current_date - 9);
SELECT pg_temp.account('ord_dd', 'ord', 'ord_owner', 'Dd Co');
SELECT pg_temp.intake('s_dd', 'ord'); SELECT pg_temp.opportunity('o_dd', 'ord_dd', 'ord_owner', 's_dd'); SELECT pg_temp.quote('s_dd', 'TriNet', 'acknowledged', current_date - 2);
SELECT pg_temp.account('ord_ee', 'ord', 'ord_owner', 'Ee Co');
SELECT pg_temp.intake('s_ee', 'ord'); SELECT pg_temp.opportunity('o_ee', 'ord_ee', 'ord_owner', 's_ee'); SELECT pg_temp.quote('s_ee', 'TriNet', 'sent', current_date - 1);
SELECT pg_temp.account('ord_ff', 'ord', 'ord_owner', 'Ff Co');
SELECT pg_temp.intake('s_ff', 'ord'); SELECT pg_temp.opportunity('o_ff', 'ord_ff', 'ord_owner', 's_ff');
SELECT pg_temp.account('ord_gg', 'ord', 'ord_owner', 'Gg Co');
SELECT pg_temp.intake('s_gg', 'ord'); SELECT pg_temp.opportunity('o_gg', 'ord_gg', 'ord_owner', 's_gg'); SELECT pg_temp.quote('s_gg', 'TriNet', 'quoted', current_date - 3);
UPDATE public.quote_requests SET quote_expires_on = current_date + 5 WHERE session_id = pg_temp.id('s_gg');
SELECT pg_temp.account('ord_hh', 'ord', 'ord_owner', 'Hh Co');
SELECT pg_temp.intake('s_hh', 'ord'); SELECT pg_temp.opportunity('o_hh', 'ord_hh', 'ord_owner', 's_hh'); SELECT pg_temp.quote('s_hh', 'TriNet', 'declined', current_date - 50);
INSERT INTO public.quote_request_messages (provider_message_id, quote_request_id, session_id, direction, from_address, recorded_at, firm_id)
SELECT 'ee-new', q.id, q.session_id, 'received', 'rep@trinet.test', now() - interval '1 hour', pg_temp.id('ord') FROM public.quote_requests q WHERE q.session_id = pg_temp.id('s_ee');
DO $$
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL)),
    'Ee Co/TriNet,Bb Co/TriNet,Gg Co/TriNet,Aa Co/TriNet,Cc Co/TriNet,Dd Co/TriNet,Ff Co/-,Hh Co/TriNet',
    'new mail first, then the soonest expiry (the expired first), then the longest wait, the rest by account');
END $$;

-- ---------- 5. Sort: a field, either way; a blank is last in both directions; equal values go by the table's own order ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[]', 'account_name', 'desc')), 'Hh Co/TriNet,Gg Co/TriNet,Ff Co/-,Ee Co/TriNet,Dd Co/TriNet,Cc Co/TriNet,Bb Co/TriNet,Aa Co/TriNet', 'by account, Z to A');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[]', 'sent_on', 'asc')), 'Hh Co/TriNet,Bb Co/TriNet,Aa Co/TriNet,Cc Co/TriNet,Gg Co/TriNet,Dd Co/TriNet,Ee Co/TriNet,Ff Co/-', 'by the day sent, oldest first, the one never sent last');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[]', 'sent_on', 'desc')), 'Ee Co/TriNet,Dd Co/TriNet,Gg Co/TriNet,Cc Co/TriNet,Aa Co/TriNet,Bb Co/TriNet,Hh Co/TriNet,Ff Co/-', 'newest first, the one never sent still last');
END $$;

-- ---------- 6. A sort, a direction or a page the table does not have is refused, in words ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.quotes_list(NULL, ''[]'', ''password'', ''asc'')'), '22023: The quotes table has no field "password" to sort by', 'a sort on something that is no field');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.quotes_list(NULL, ''[]'', ''sent_on'', ''sideways'')'), '22023: A sort goes asc or desc', 'a direction that is neither');
  PERFORM pg_temp.is(pg_temp.refusal('SELECT public.quotes_list(NULL, ''[]'', NULL, ''asc'', 0)'), '22023: A page number is 1 to 100000', 'page 0');
END $$;

-- ---------- 7. A status sorts by its place in the list, not the alphabet ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[]', 'status', 'asc')), 'Ff Co/-,Ee Co/TriNet,Cc Co/TriNet,Dd Co/TriNet,Bb Co/TriNet,Gg Co/TriNet,Aa Co/TriNet,Hh Co/TriNet',
    'not sent, sent, acknowledged, quoted, declined: the order of the story''s lifecycle, ties in the table''s own order');
END $$;

-- ---------- 8. Fifty rows a page; the total is all of them ----------
DO $$
DECLARE pagey uuid; i integer; p1 jsonb; p2 jsonb;
BEGIN
  INSERT INTO public.firms (name, address, approved_at) VALUES ('Pagey Brokers', 'pagey-brokers', now()) RETURNING id INTO pagey;
  INSERT INTO fx VALUES ('pagey', pagey);
  PERFORM pg_temp.new_user('pagey_owner');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pagey, pg_temp.id('pagey_owner'), 'owner');
  FOR i IN 1..55 LOOP
    PERFORM pg_temp.account('pg_a' || i, 'pagey', 'pagey_owner', 'Page Co ' || lpad(i::text, 2, '0'));
    PERFORM pg_temp.intake('pg_s' || i, 'pagey');
    PERFORM pg_temp.opportunity('pg_o' || i, 'pg_a' || i, 'pagey_owner', 'pg_s' || i);
  END LOOP;
  PERFORM pg_temp.as_user('pagey_owner', 'pagey-brokers');
  p1 := public.quotes_list(NULL);
  p2 := public.quotes_list(NULL, '[]', NULL, 'asc', 2);
  PERFORM pg_temp.is((p1 ->> 'total')::int, 55, 'the total is every row');
  PERFORM pg_temp.is(jsonb_array_length(p1 -> 'rows'), 50, 'a full page');
  PERFORM pg_temp.is(jsonb_array_length(p2 -> 'rows'), 5, 'the rest on page 2');
  PERFORM pg_temp.is(p2 -> 'rows' -> 0 ->> 'account_name', 'Page Co 51', 'page 2 starts where page 1 ended');
END $$;

-- ---------- 9. Filters on words and on a status: every filter must hold ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"status","op":"any_of","value":["quoted"]}]')), 'Bb Co/TriNet,Gg Co/TriNet,Aa Co/TriNet', 'status is Quoted');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"status","op":"any_of","value":["not_sent"]}]')), 'Ff Co/-', 'status is Not sent yet');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"status","op":"any_of","value":["sent","acknowledged"]},{"field":"account_name","op":"contains","value":"D"}]')), 'Dd Co/TriNet', 'two filters both hold');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"peo","op":"is","value":"justworks"}]')), '', 'a PEO nobody sent to');
END $$;

-- ---------- 10. Filters on days: sent and expires ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, format('[{"field":"sent_on","op":"between","value":["%s","%s"]}]', current_date - 10, current_date - 2)::jsonb)), 'Gg Co/TriNet,Cc Co/TriNet,Dd Co/TriNet', 'sent between two days, both ends in');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"expires_on","op":"in_next_days","value":10}]')), 'Gg Co/TriNet', 'expires in the next 10 days');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, format('[{"field":"expires_on","op":"before","value":"%s"}]', current_date)::jsonb)), 'Bb Co/TriNet', 'an expired quote is found by expiry before today');
END $$;

-- ---------- 11. Days waiting: the days since the send, for a quote request still open (sent, acknowledged, question open); no one waits on a quote, a decline or a close ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"days_waiting","op":"more_than","value":5}]')), 'Cc Co/TriNet', 'waiting more than 5 days: not the quoted one sent 20 days ago');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"days_waiting","op":"less_than","value":3}]')), 'Ee Co/TriNet,Dd Co/TriNet', 'waiting less than 3 days');
END $$;

-- ---------- 12. Sort by days waiting: the longest wait first; what no one waits on is last ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[]', 'days_waiting', 'desc')), 'Cc Co/TriNet,Dd Co/TriNet,Ee Co/TriNet,Bb Co/TriNet,Gg Co/TriNet,Aa Co/TriNet,Ff Co/-,Hh Co/TriNet', 'longest wait first, the rest in the table''s own order');
END $$;

-- ---------- 13. Has new mail: the mail on a PEO's thread an advisor has not opened ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"new_mail","op":"is","value":true}]')), 'Ee Co/TriNet', 'only the one with unread mail');
  PERFORM pg_temp.is((public.quotes_list(NULL, '[{"field":"new_mail","op":"is","value":false}]') ->> 'total')::int, 7, 'the other seven have none');
END $$;

-- ---------- 14. Owner: the opportunity's owner, named, or "me" ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, format('[{"field":"owner","op":"any_of","value":["%s"]}]', pg_temp.id('acme_agent2'))::jsonb)), 'Other Co/Paychex', 'owned by a named person');
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"owner","op":"me"}]')), 'Reyes Bakery/Justworks,Reyes Bakery/TriNet,Kim Dental/-', 'owned by me');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 15. Owner: "my team" is the people of the caller's team and the teams under it ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_lead', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"owner","op":"my_team"}]')), 'Other Co/Paychex', 'a lead of Sales reads what Sales owns, not what others own');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 16. A filter on a field the table does not have, or a status it does not know, is refused in words ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT public.quotes_list(NULL, '[{"field":"fein","op":"is","value":"1"}]')$q$), '22023: The quotes table has no field "fein" to filter by', 'a field the table does not have');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT public.quotes_list(NULL, '[{"field":"status","op":"any_of","value":["won"]}]')$q$), ':', 1), '22023', 'a status not on the list');
END $$;

-- ---------- 17. Filters on what a quote records and on the search's start: admin fee, version sent, proposed start, target start ----------
UPDATE public.quote_requests SET sent_version = 2 WHERE session_id = pg_temp.id('s_reyes') AND peo_name = 'Justworks';
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"admin_fee_pepm","op":"more_than","value":30}]')), 'Reyes Bakery/Justworks', 'an admin fee over 30');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"sent_version","op":"is","value":2}]')), 'Reyes Bakery/Justworks', 'version 2 was sent');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"proposed_start","op":"on","value":"2027-02-01"}]')), 'Reyes Bakery/Justworks', 'a proposed start of 1 February');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"target_start","op":"on","value":"2027-01-01"}]')), 'Reyes Bakery/Justworks,Reyes Bakery/TriNet', 'the opportunity''s target start is on both of its rows');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"file_id","op":"contains","value":"0001"},{"field":"opportunity_name","op":"contains","value":"reyes"}]')), 'Reyes Bakery/Justworks,Reyes Bakery/TriNet', 'by File ID and opportunity name');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 18. Search: every word, in the account, the PEO or the File ID, ignoring case (CRM-Q4.1) ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[]', NULL, 'asc', 1, 'JUSTWORKS')), 'Reyes Bakery/Justworks', 'a PEO, in any case');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[]', NULL, 'asc', 1, 'bakery eaa-2026-0001')), 'Reyes Bakery/Justworks,Reyes Bakery/TriNet', 'words across the account and the File ID');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[]', NULL, 'asc', 1, 'kim')), 'Kim Dental/-', 'an account whose quote was never sent');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[]', NULL, 'asc', 1, 'o_reyes')), '', 'the opportunity''s name is not searched: the story says account, PEO and File ID');
END $$;

-- ---------- 19. The count behind each view's tab: the same rows, filters and search as the list, for each view ----------
DO $$
DECLARE c text;
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  SELECT string_agg(v.view_name || '=' || v.total, ',' ORDER BY v.view_name) INTO c FROM public.quotes_view_counts(NULL, '[
    {"name":"Open","filters":[{"field":"status","op":"any_of","value":["not_sent","sent","acknowledged","question_open","quoted"]}]},
    {"name":"Not sent yet","filters":[{"field":"status","op":"any_of","value":["not_sent"]}]},
    {"name":"Waiting on a PEO","filters":[{"field":"status","op":"any_of","value":["sent","acknowledged","question_open"]}]},
    {"name":"Quoted","filters":[{"field":"status","op":"any_of","value":["quoted"]}]},
    {"name":"Declined","filters":[{"field":"status","op":"any_of","value":["declined"]}]},
    {"name":"Closed","filters":[{"field":"status","op":"any_of","value":["closed"]}]}]') v;
  PERFORM pg_temp.is(c, 'Closed=0,Declined=1,Not sent yet=1,Open=7,Quoted=3,Waiting on a PEO=3', 'each view counts its own rows');
  SELECT string_agg(v.view_name || '=' || v.total, ',' ORDER BY v.view_name) INTO c FROM public.quotes_view_counts(NULL, '[{"name":"Open","filters":[{"field":"status","op":"any_of","value":["sent","quoted"]}]}]', 'cc') v;
  PERFORM pg_temp.is(c, 'Open=1', 'under the search in force');
  PERFORM pg_temp.is(split_part(pg_temp.refusal($q$SELECT * FROM public.quotes_view_counts(NULL, '[{"name":"X","filters":[{"field":"fein","op":"is_empty"}]}]')$q$), ':', 1), '22023', 'a view that names a field the table does not have is refused');
END $$;

-- ---------- 20. An opportunity whose owner has left the firm reads as owned by no one ----------
SELECT pg_temp.account('left', 'acme', 'acme_agent2', 'Left Behind Co');
SELECT pg_temp.intake('s_left', 'acme');
SELECT pg_temp.opportunity('o_left', 'left', 'acme_gone', 's_left');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  SELECT e INTO r FROM jsonb_array_elements(public.quotes_list(NULL, '[]', NULL, 'asc', 1, 'left behind') -> 'rows') e;
  PERFORM pg_temp.is(r ->> 'owner', NULL, 'no owner id');
  PERFORM pg_temp.is(r ->> 'owner_name', NULL, 'no name of someone who is no longer a member');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 21. Emails: how many messages are on the PEO's thread, and when the last was recorded ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('ord_owner', 'order-brokers');
  SELECT e INTO r FROM jsonb_array_elements(public.quotes_list(NULL, '[]', NULL, 'asc', 1, 'ee co') -> 'rows') e;
  PERFORM pg_temp.is((r ->> 'emails')::int, 1, 'one message on its thread');
  PERFORM pg_temp.is(r ->> 'last_message_at' IS NOT NULL, true, 'and when it came');
  SELECT e INTO r FROM jsonb_array_elements(public.quotes_list(NULL, '[]', NULL, 'asc', 1, 'cc co') -> 'rows') e;
  PERFORM pg_temp.is((r ->> 'emails')::int, 0, 'none on a quiet one');
  PERFORM pg_temp.is(r ->> 'last_message_at', NULL, 'no last message');
  PERFORM pg_temp.is(pg_temp.rows_of(public.quotes_list(NULL, '[{"field":"emails","op":"more_than","value":0}]')), 'Ee Co/TriNet', 'filtered to those with mail');
END $$;

-- ---------- 22. The quotes table keeps saved views and column choices like the others ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT 'quotes'::public.workspace_table$q$), 'rows:1', 'quotes is a table the workspace keeps settings for');
  PERFORM pg_temp.is(pg_temp.attempt($q$SELECT 'leads'::public.workspace_table$q$), 'rows:1', 'and leads still is');
END $$;

-- ---------- 23. Export: through the existing export (CRM-S3.8a), the table's own rows in its own order, each column in words ----------
CREATE FUNCTION pg_temp.as_fresh(n text, addr text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.id(n), 'role', 'authenticated', 'is_anonymous', false, 'email', n || '@example.test',
    'amr', jsonb_build_array(jsonb_build_object('method', 'oauth', 'timestamp', floor(extract(epoch FROM now() - interval '1 hour'))::bigint)))::text, false);
  PERFORM set_config('request.headers', jsonb_build_object('x-firm-address', addr)::text, false);
  SET LOCAL ROLE authenticated;
END $$;
CREATE FUNCTION pg_temp.exported(p_filters jsonb DEFAULT '{}', p_ids jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.export_rows(pg_temp.id('ord'), 'quotes', p_filters, p_ids)
$$;
CREATE FUNCTION pg_temp.exported_accounts(j jsonb) RETURNS text LANGUAGE sql AS $$ SELECT COALESCE(string_agg(r ->> 'account', ',' ORDER BY ord), '') FROM jsonb_array_elements(j -> 'rows') WITH ORDINALITY x(r, ord) $$;
DO $$
DECLARE j jsonb; one jsonb;
BEGIN
  RESET ROLE;
  PERFORM pg_temp.is((SELECT who FROM public.export_table_registry() WHERE name = 'quotes'), 'member', 'any member may export quotes (they read what they may see)');
  PERFORM pg_temp.is(has_function_privilege('authenticated', 'public.export_source_quotes(uuid, jsonb, jsonb, integer)', 'EXECUTE')
                     OR has_function_privilege('anon', 'public.export_source_quotes(uuid, jsonb, jsonb, integer)', 'EXECUTE'), false, 'the reader is closed to the API');
  PERFORM pg_temp.as_fresh('ord_owner', 'order-brokers');
  j := pg_temp.exported();
  PERFORM pg_temp.is(j ->> 'count', '8', 'a whole table: the eight rows');
  PERFORM pg_temp.is(pg_temp.exported_accounts(j), 'Ee Co,Bb Co,Gg Co,Aa Co,Cc Co,Dd Co,Ff Co,Hh Co', 'in the table''s own order, needs me first');
  PERFORM pg_temp.is((SELECT count(*) FROM jsonb_array_elements(j -> 'rows') r WHERE (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(r) k) IS DISTINCT FROM
                       (SELECT array_agg(c ->> 'id' ORDER BY c ->> 'id') FROM jsonb_array_elements(j -> 'columns') c)), 0::bigint, 'every row holds exactly the declared columns');
  SELECT x INTO one FROM jsonb_array_elements(j -> 'rows') x WHERE x ->> 'account' = 'Gg Co';
  PERFORM pg_temp.is(one ->> 'status', 'Quoted', 'a status in words');
  PERFORM pg_temp.is(one ->> 'expires_on', (current_date + 5)::text, 'a day as a day');
  PERFORM pg_temp.is(one ->> 'owner', 'ord_owner@example.test', 'the owner by name');
  SELECT x INTO one FROM jsonb_array_elements(j -> 'rows') x WHERE x ->> 'account' = 'Ff Co';
  PERFORM pg_temp.is(one ->> 'status', 'Not sent yet', 'one left half done reads Not sent yet');
  PERFORM pg_temp.is(one ->> 'peo', NULL, 'with no PEO');
  SELECT x INTO one FROM jsonb_array_elements(j -> 'rows') x WHERE x ->> 'account' = 'Ee Co';
  PERFORM pg_temp.is((one ->> 'new_mail')::boolean, true, 'the new-mail mark');
  PERFORM pg_temp.is((one ->> 'emails')::int, 1, 'and the number of emails');
END $$;

-- ---------- 24. Export follows the table: its filters, its search, a selection by keys, and what the person may see ----------
DO $$
DECLARE j jsonb; ids jsonb;
BEGIN
  RESET ROLE;
  -- a selection by keys: Aa's quote request, Ff's half-done opportunity, one that is not there, and Acme's quote (another firm's)
  SELECT jsonb_build_array((SELECT 'q' || q.id FROM public.quote_requests q WHERE q.session_id = pg_temp.id('s_aa')), 'o' || pg_temp.id('o_ff')::text, 'q999999',
    (SELECT 'q' || q.id FROM public.quote_requests q WHERE q.session_id = pg_temp.id('s_reyes') AND q.peo_name = 'TriNet')) INTO ids;
  PERFORM pg_temp.as_fresh('ord_owner', 'order-brokers');
  PERFORM pg_temp.is(pg_temp.exported_accounts(pg_temp.exported('{"filters":[{"field":"status","op":"any_of","value":["quoted"]}]}')), 'Bb Co,Gg Co,Aa Co', 'what the table shows for a filter');
  PERFORM pg_temp.is(pg_temp.exported_accounts(pg_temp.exported('{"search":"dd co"}')), 'Dd Co', 'for a search');
  PERFORM pg_temp.is(pg_temp.refusal($q$SELECT pg_temp.exported('{"fliters":[]}')$q$) LIKE '22023: Those filters don''t apply to this table%', true, 'a key the table does not have is refused');
  j := pg_temp.exported('{}', ids);
  PERFORM pg_temp.is(pg_temp.exported_accounts(j), 'Aa Co,Ff Co', 'a selection gives the named rows, in the table''s order');
  PERFORM pg_temp.is(j ->> 'skipped', '2', 'and says how many gave no row: not there, another firm''s');
END $$;
