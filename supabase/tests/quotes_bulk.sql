-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh quotes_bulk
-- Bulk actions on the quotes table (story CRM-Q4.1, slice 5.11; docs/BROKER_CRM_BUILD.md D-1804 to D-1806; 20261123180000_quotes_table.sql): change the opportunity's owner, and
-- close quote requests with one reason. Nothing else about a quote is changed in bulk: its status, figures and dates are recorded on its own quote. Two firms: Acme sees by
-- level, Zenith shows everyone everything. Every migration is loaded, in filename order (D-105), this one last.
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


-- The key a row of the table has: 'q' and a quote request's id, or 'o' and the id of an opportunity not sent yet.
CREATE FUNCTION pg_temp.qkey(p_intake text, p_peo text) RETURNS text LANGUAGE sql AS $$
  SELECT 'q' || q.id FROM public.quote_requests q WHERE q.session_id = pg_temp.id(p_intake) AND q.peo_name = p_peo
$$;
CREATE FUNCTION pg_temp.okey(p_opportunity text) RETURNS text LANGUAGE sql AS $$ SELECT 'o' || pg_temp.id(p_opportunity)::text $$;

-- Who owns an opportunity, by the name its user was given here.
CREATE FUNCTION pg_temp.owner_of(p_opportunity text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT (SELECT split_part(u.email::text, '@', 1) FROM auth.users u WHERE u.id = o.owner_id) FROM public.opportunities o WHERE o.id = pg_temp.id(p_opportunity)
$$;

-- ---------- fixtures: Acme's accounts, each with an opportunity; Zenith shows everyone everything ----------
SELECT pg_temp.account('reyes', 'acme', 'acme_agent1', 'Reyes Bakery');
SELECT pg_temp.intake('s_reyes', 'acme');
SELECT pg_temp.opportunity('o_reyes', 'reyes', 'acme_agent1', 's_reyes');
SELECT pg_temp.quote('s_reyes', 'TriNet', 'sent', current_date - 3);
SELECT pg_temp.quote('s_reyes', 'Justworks', 'quoted', current_date - 10);
SELECT pg_temp.account('kim', 'acme', 'acme_agent1', 'Kim Dental');
SELECT pg_temp.intake('s_kim', 'acme');
SELECT pg_temp.opportunity('o_kim', 'kim', 'acme_agent1', 's_kim');
SELECT pg_temp.account('other', 'acme', 'acme_agent2', 'Other Co');
SELECT pg_temp.intake('s_other', 'acme');
SELECT pg_temp.opportunity('o_other', 'other', 'acme_agent2', 's_other');
SELECT pg_temp.quote('s_other', 'Paychex', 'sent', current_date - 1);
SELECT pg_temp.account('zed', 'zenith', 'zenith_agent', 'Zenith Co');
SELECT pg_temp.intake('s_zed', 'zenith');
SELECT pg_temp.opportunity('o_zed', 'zed', 'zenith_agent', 's_zed');
SELECT pg_temp.quote('s_zed', 'TriNet', 'sent', current_date - 1);

-- ---------- 1. Change owner: the opportunity's, once however many of its rows are chosen ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.bulk_quotes_change(NULL, 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent3')),
    NULL, jsonb_build_array(pg_temp.qkey('s_reyes', 'TriNet'), pg_temp.qkey('s_reyes', 'Justworks'), pg_temp.okey('o_kim')));
  PERFORM pg_temp.is((r ->> 'selected')::int, 3, 'three rows chosen');
  PERFORM pg_temp.is((r ->> 'changed')::int, 2, 'two opportunities changed: Reyes''s once for its two rows, and Kim''s');
  PERFORM pg_temp.is(pg_temp.owner_of('o_reyes'), 'acme_agent3', 'the opportunity has its new owner');
  PERFORM pg_temp.is(pg_temp.owner_of('o_kim'), 'acme_agent3', 'so has the one left half done');
  PERFORM pg_temp.is(pg_temp.owner_of('o_other'), 'acme_agent2', 'one not chosen is left alone');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 2. What the caller may not change is skipped, with the reason; what they may not see is not there ----------
DO $$
DECLARE r jsonb;
BEGIN
  -- Zenith shows everyone everything: a member sees the row and the opportunity is another member's, so it is read, not changed.
  PERFORM pg_temp.as_user('zenith_agent2', 'zenith-benefits');
  r := public.bulk_quotes_change(NULL, 'owner', jsonb_build_object('owner_id', pg_temp.id('zenith_agent2')), NULL, jsonb_build_array(pg_temp.qkey('s_zed', 'TriNet')));
  PERFORM pg_temp.is((r ->> 'changed')::int, 0, 'nothing changed');
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'code', 'level', 'skipped by the level rule');
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'name', 'Zenith Co', 'named by its account');
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'reason', 'Only the opportunity''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'in words');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.owner_of('o_zed'), 'zenith_agent', 'the opportunity is as it was');
  -- Acme: an agent sees what their own accounts have, so another agent's row is not available to them at all; Kim's opportunity now belongs to agent3.
  PERFORM pg_temp.as_user('acme_agent1', 'acme-brokers');
  r := public.bulk_quotes_change(NULL, 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent1')), NULL, jsonb_build_array(pg_temp.qkey('s_other', 'Paychex'), pg_temp.okey('o_kim')));
  PERFORM pg_temp.is((r ->> 'requested')::int, 2, 'two rows asked for');
  PERFORM pg_temp.is((r ->> 'selected')::int, 1, 'one of them is theirs to see');
  PERFORM pg_temp.is((r ->> 'unavailable')::int, 1, 'the other is not available');
  PERFORM pg_temp.is(jsonb_array_length(r -> 'skipped'), 1, 'and the one they see is skipped');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.owner_of('o_other'), 'acme_agent2', 'Other Co''s opportunity is untouched');
END $$;

-- ---------- 3. Who will own them, and what to change, are asked for in words ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''owner'', ''{"owner_id":"%s"}'', NULL, ''["%s"]'')', pg_temp.id('acme_removed'), pg_temp.okey('o_kim'))),
    '22023: Choose a current member of the firm.', 'someone who has left is not an owner to give it to');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''owner'', ''{}'', NULL, ''["%s"]'')', pg_temp.okey('o_kim'))),
    '22023: Choose who will own these quotes.', 'no one chosen');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''status'', ''{"status":"quoted"}'', NULL, ''["%s"]'')', pg_temp.okey('o_kim'))),
    '22023: Choose what to change: the owner, or close.', 'a status is not changed in bulk: it is recorded on its own quote');
  r := public.bulk_quotes_change(NULL, 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent3')), NULL, jsonb_build_array(pg_temp.okey('o_kim')));
  PERFORM pg_temp.is((r ->> 'unchanged')::int, 1, 'an opportunity already theirs is counted as unchanged, not changed');
  PERFORM pg_temp.is((r ->> 'changed')::int, 0, 'and none changed');
  PERFORM pg_temp.as_owner();
END $$;

-- ---------- 4. "All that match": the table's own filters and search choose the rows ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.bulk_quotes_change(NULL, 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent1')),
    '{"filters":[{"field":"status","op":"any_of","value":["sent"]}],"time_zone":"UTC"}', NULL);
  PERFORM pg_temp.is((r ->> 'selected')::int, 2, 'two rows are sent: Reyes''s TriNet and Other Co''s Paychex');
  PERFORM pg_temp.is((r ->> 'changed')::int, 2, 'both opportunities changed');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.owner_of('o_reyes'), 'acme_agent1', 'Reyes''s opportunity');
  PERFORM pg_temp.is(pg_temp.owner_of('o_other'), 'acme_agent1', 'Other Co''s opportunity');
  PERFORM pg_temp.is(pg_temp.owner_of('o_kim'), 'acme_agent3', 'Kim''s, not a sent row, is as it was');
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.bulk_quotes_change(NULL, 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent1')), '{"search":"kim"}', NULL);
  PERFORM pg_temp.is((r ->> 'changed')::int, 1, 'under a search, only the rows it finds');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.owner_of('o_kim'), 'acme_agent1', 'Kim''s opportunity is now agent1''s');
END $$;

-- ---------- 5. The rows are chosen one way, and a choice that would be everything by mistake is refused ----------
DO $$
DECLARE too_many text;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''owner'', ''{"owner_id":"%s"}'')', pg_temp.id('acme_agent3'))),
    '22023: Choose the quotes to change.', 'neither keys nor filters: not every quote');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''owner'', ''{"owner_id":"%s"}'', ''{}'', ''["%s"]'')', pg_temp.id('acme_agent3'), pg_temp.okey('o_kim'))),
    '22023: Choose the quotes by their keys or by the table''s filters, not both.', 'both');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''owner'', ''{"owner_id":"%s"}'', NULL, ''[]'')', pg_temp.id('acme_agent3'))),
    '22023: Choose at least one quote.', 'an empty list');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''owner'', ''{"owner_id":"%s"}'', ''{"fein":"1"}'')', pg_temp.id('acme_agent3'))),
    '22023: Those filters don''t apply to this table', 'a filter object with something else in it');
  SELECT (SELECT jsonb_agg('q' || g) FROM generate_series(1, 1001) g)::text INTO too_many;
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''owner'', ''{"owner_id":"%s"}'', NULL, ''%s'')', pg_temp.id('acme_agent3'), too_many)), ':', 1), 'PT413', 'more than a thousand is refused before anything is looked up');
  PERFORM pg_temp.as_owner();
END $$;

-- A quote request's status and why it was withdrawn, as the database holds them.
CREATE FUNCTION pg_temp.status_of(p_intake text, p_peo text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT q.status || '/' || COALESCE(q.withdrawn_reason, '-') FROM public.quote_requests q WHERE q.session_id = pg_temp.id(p_intake) AND q.peo_name = p_peo
$$;

-- ---------- 6. Close: each chosen quote request closes with one reason; one never sent has nothing to close ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.bulk_quotes_change(NULL, 'close', '{"reason":"peo_not_a_fit"}', NULL,
    jsonb_build_array(pg_temp.qkey('s_reyes', 'TriNet'), pg_temp.qkey('s_reyes', 'Justworks'), pg_temp.okey('o_kim')));
  PERFORM pg_temp.is((r ->> 'selected')::int, 3, 'three rows chosen');
  PERFORM pg_temp.is((r ->> 'changed')::int, 2, 'two quote requests closed');
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'code', 'not_sent', 'the one never sent is skipped');
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'reason', 'Nothing was sent for it yet, so there is nothing to close.', 'in words');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.status_of('s_reyes', 'TriNet'), 'closed/peo_not_a_fit', 'a sent one is closed, with the reason');
  PERFORM pg_temp.is(pg_temp.status_of('s_reyes', 'Justworks'), 'closed/peo_not_a_fit', 'a quote is closed too');
  PERFORM pg_temp.is(pg_temp.status_of('s_other', 'Paychex'), 'sent/-', 'one not chosen is left alone');
END $$;

-- ---------- 7. Close takes a reason from the four, or it is refused ----------
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''close'', ''{}'', NULL, ''["%s"]'')', pg_temp.qkey('s_other', 'Paychex'))),
    '22023: Choose why: the employer went elsewhere, the prospect withdrew this PEO, the PEO is not a fit, or other.', 'no reason');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''close'', ''{"reason":"bored"}'', NULL, ''["%s"]'')', pg_temp.qkey('s_other', 'Paychex'))), ':', 1),
    '22023', 'a reason that is not one of the four');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.status_of('s_other', 'Paychex'), 'sent/-', 'nothing was closed');
END $$;

-- ---------- 8. One already closed is counted, not closed again: its first reason stands ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.bulk_quotes_change(NULL, 'close', '{"reason":"other"}', NULL, jsonb_build_array(pg_temp.qkey('s_reyes', 'TriNet')));
  PERFORM pg_temp.is((r ->> 'unchanged')::int, 1, 'counted as unchanged');
  PERFORM pg_temp.is((r ->> 'changed')::int, 0, 'none changed');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.status_of('s_reyes', 'TriNet'), 'closed/peo_not_a_fit', 'its first reason stands');
END $$;

-- ---------- 9. Closing stops the PEO's link, as a withdrawal does (M-2.4) ----------
INSERT INTO public.bundle_links (firm_id, quote_request_id, session_id, version, token_hash, folder, files, expires_at)
SELECT pg_temp.id('acme'), q.id, q.session_id, 1, repeat('a', 64), gen_random_uuid(), '[]'::jsonb, now() + interval '30 days'
FROM public.quote_requests q WHERE q.session_id = pg_temp.id('s_other') AND q.peo_name = 'Paychex';
DO $$
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  PERFORM public.bulk_quotes_change(NULL, 'close', '{"reason":"employer_went_elsewhere"}', NULL, jsonb_build_array(pg_temp.qkey('s_other', 'Paychex')));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT revoked_reason FROM public.bundle_links WHERE token_hash = repeat('a', 64)), 'withdrawn', 'its live link stops working, for the reason a withdrawal gives');
  PERFORM pg_temp.is(pg_temp.status_of('s_other', 'Paychex'), 'closed/employer_went_elsewhere', 'and the quote request is closed with the reason');
END $$;

-- ---------- 10. Close follows the level rule on the opportunity's owner, as the owner change does ----------
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('zenith_agent2', 'zenith-benefits');
  r := public.bulk_quotes_change(NULL, 'close', '{"reason":"other"}', NULL, jsonb_build_array(pg_temp.qkey('s_zed', 'TriNet')));
  PERFORM pg_temp.is((r ->> 'changed')::int, 0, 'nothing closed');
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'code', 'level', 'skipped by the level rule');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.status_of('s_zed', 'TriNet'), 'sent/-', 'another member''s quote request is still open');
END $$;

-- ---------- 11. A won or lost opportunity is finished: its quotes are read, not changed in bulk ----------
SELECT pg_temp.account('won', 'acme', 'acme_agent1', 'Won Co');
SELECT pg_temp.intake('s_won', 'acme');
SELECT pg_temp.opportunity('o_won', 'won', 'acme_agent1', 's_won');
SELECT pg_temp.quote('s_won', 'Gusto', 'quoted', current_date - 20);
UPDATE public.submission_workflow SET status = 'won' WHERE session_id = pg_temp.id('s_won');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.bulk_quotes_change(NULL, 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent3')), NULL, jsonb_build_array(pg_temp.qkey('s_won', 'Gusto')));
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'code', 'finished', 'its owner is not changed');
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'reason', 'The opportunity is won or lost, so it is read, not changed.', 'in words');
  r := public.bulk_quotes_change(NULL, 'close', '{"reason":"other"}', NULL, jsonb_build_array(pg_temp.qkey('s_won', 'Gusto')));
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'code', 'finished', 'its winning quote is not closed');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.status_of('s_won', 'Gusto'), 'quoted/-', 'the winner stays quoted');
  PERFORM pg_temp.is(pg_temp.owner_of('o_won'), 'acme_agent1', 'and keeps its owner');
END $$;

-- ---------- 12. Nothing on an archived account is changed (D-432) ----------
SELECT pg_temp.account('arch', 'acme', 'acme_agent1', 'Archived Co');
SELECT pg_temp.intake('s_arch', 'acme');
SELECT pg_temp.opportunity('o_arch', 'arch', 'acme_agent1', 's_arch');
SELECT pg_temp.quote('s_arch', 'Insperity', 'sent', current_date - 4);
UPDATE public.accounts SET archived_at = now() WHERE id = pg_temp.id('arch');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.as_user('acme_owner', 'acme-brokers');
  r := public.bulk_quotes_change(NULL, 'close', '{"reason":"other"}', NULL, jsonb_build_array(pg_temp.qkey('s_arch', 'Insperity')));
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'code', 'archived', 'a quote of an archived account is not closed');
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'reason', 'This account is archived. Nothing on it can be changed.', 'in the words the account''s own page uses');
  r := public.bulk_quotes_change(NULL, 'owner', jsonb_build_object('owner_id', pg_temp.id('acme_agent3')), NULL, jsonb_build_array(pg_temp.qkey('s_arch', 'Insperity')));
  PERFORM pg_temp.is(r -> 'skipped' -> 0 ->> 'code', 'archived', 'nor is its opportunity given to anyone');
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.status_of('s_arch', 'Insperity'), 'sent/-', 'still sent');
  PERFORM pg_temp.is(pg_temp.owner_of('o_arch'), 'acme_agent1', 'and still theirs');
END $$;

-- ---------- 13. A closing firm and Nevermore support change nothing (ADR 0023, ADR 0024); support reads what a member reads ----------
DO $$
BEGIN
  INSERT INTO public.support_sessions (firm_id, admin_id, admin_email, reason, started_at, ends_at)
  VALUES (pg_temp.id('acme'), pg_temp.id('platform_admin'), 'platform_admin@example.test', 'Looking at a stuck quote', now(), now() + interval '1 hour');
  PERFORM pg_temp.as_user('platform_admin', 'acme-brokers');
  PERFORM pg_temp.is((public.quotes_list(pg_temp.id('acme')) ->> 'total')::int > 0, true, 'support reads the table');
  PERFORM pg_temp.is(pg_temp.refusal(format('SELECT public.bulk_quotes_change(%L, ''owner'', ''{"owner_id":"%s"}'', NULL, ''["%s"]'')', pg_temp.id('acme'), pg_temp.id('acme_agent3'), pg_temp.okey('o_kim'))),
    'PT423: Nevermore support can look, not change', 'and changes nothing');
  PERFORM pg_temp.as_owner();
  DELETE FROM public.support_sessions WHERE admin_id = pg_temp.id('platform_admin');
END $$;
INSERT INTO public.firm_closures (firm_id, asked_by, closes_at) VALUES (pg_temp.id('zenith'), pg_temp.id('zenith_owner'), now() + interval '30 days');
DO $$
BEGIN
  PERFORM pg_temp.as_user('zenith_owner', 'zenith-benefits');
  PERFORM pg_temp.is(split_part(pg_temp.refusal(format('SELECT public.bulk_quotes_change(NULL, ''close'', ''{"reason":"other"}'', NULL, ''["%s"]'')', pg_temp.qkey('s_zed', 'TriNet'))), ':', 1), 'PT423', 'a closing firm is read-only');
  PERFORM pg_temp.as_owner();
END $$;
DELETE FROM public.firm_closures WHERE firm_id = pg_temp.id('zenith');
