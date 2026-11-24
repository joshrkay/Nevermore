-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh import
-- Importing a book from a CSV (CRM-X4.1; docs/BROKER_READINESS_PRD.md BR-5.1; docs/BROKER_CRM_BUILD.md "## Import", D-2300 to D-2319;
-- 20261130090000_import.sql). The browser reads the file and sends rows; the database decides what each row makes. Two firms.
-- Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261123120000_broker_intake.sql
\i supabase/migrations/20261123120100_broker_intake_columns.sql
\i supabase/migrations/20261123130000_new_quote_account.sql
\i supabase/migrations/20261123180000_quotes_table.sql
\i supabase/migrations/20261123190000_intake_teaches_account.sql
\i supabase/migrations/20261123200000_employer_ends_access.sql
\i supabase/migrations/20261124090000_firm_signup_emails.sql
\i supabase/migrations/20261124100000_new_quote_intake.sql
\i supabase/migrations/20261124110000_employer_sees_firm.sql
\i supabase/migrations/20261124130000_quote_decline_reason.sql
\i supabase/migrations/20261124140000_quote_offer.sql
\i supabase/migrations/20261124150000_opportunity_activity_intake.sql
\i supabase/migrations/20261124160000_firm_approval_gates_sending.sql
\i supabase/migrations/20261124170000_leads_can_convert.sql
\i supabase/migrations/20261125090000_quote_document.sql
\i supabase/migrations/20261125100000_reply_suggestions.sql
\i supabase/migrations/20261125110000_quote_comparison.sql
\i supabase/migrations/20261125120000_question_requests.sql
\i supabase/migrations/20261125130000_broker_save_whole_form.sql
\i supabase/migrations/20261125140000_opportunity_intake_started_by_firm.sql
\i supabase/migrations/20261125150000_firm_started_intakes_do_not_expire.sql
\i supabase/migrations/20261126090000_lines.sql
\i supabase/migrations/20261127090000_sendable.sql
\i supabase/migrations/20261128090000_home.sql
\i supabase/migrations/20261129090000_daily_summary.sql
\i supabase/migrations/20261130090000_import.sql
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

-- What a person got from one statement at an address: its one value as text, or "SQLSTATE: message" when it was refused. Nothing a refusal did is kept.
CREATE FUNCTION pg_temp.got(who text, addr text, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.as_user(who, addr);
  BEGIN
    EXECUTE stmt INTO v;
  EXCEPTION WHEN OTHERS THEN
    v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM pg_temp.as_owner();
  RETURN v;
END $$;

-- What the table's owner got from one statement, as a definer function would run it: 'ok', or the SQLSTATE of its refusal. Nothing a refusal did is kept.
CREATE FUNCTION pg_temp.owner_state(stmt text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    RETURN SQLSTATE;
  END;
END $$;

-- ---------- set up: two firms made by their founders and approved; Acme's founder has an account ----------
DO $$
DECLARE fid uuid; r jsonb;
BEGIN
  PERFORM pg_temp.new_user('platform_admin');
  INSERT INTO public.user_roles (user_id, role) VALUES (pg_temp.id('platform_admin'), 'admin');
  PERFORM pg_temp.new_user('ada'); PERFORM pg_temp.new_user('zed');
  PERFORM pg_temp.as_user('ada');
  fid := public.sign_up_firm('Acme Brokers', 'acme-brokers');
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('acme', fid);
  PERFORM pg_temp.as_user('zed');
  fid := public.sign_up_firm('Zenith Benefits', 'zenith-benefits');
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('zenith', fid);
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_decide_firm(pg_temp.id('acme'), true, NULL);
  PERFORM public.admin_decide_firm(pg_temp.id('zenith'), true, NULL);
  PERFORM pg_temp.as_user('ada', 'acme-brokers');
  r := public.create_account('Reyes Bakery', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 24, '{}'::text[], NULL, pg_temp.id('ada'), pg_temp.id('acme'), 'added_by_hand');
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('reyes', (r ->> 'id')::uuid);
END $$;

-- An opportunity of Reyes Bakery made by Acme's founder, as New opportunity makes one; the line is left out unless it is given.
CREATE FUNCTION pg_temp.opportunity(n text, p_name text, p_line text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  v := pg_temp.got('ada', 'acme-brokers', format(
    'SELECT public.opportunity_create(%L, %L, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L%s)::text',
    pg_temp.id('reyes'), p_name, pg_temp.id('acme'), CASE WHEN p_line IS NULL THEN '' ELSE format(', p_line => %L', p_line) END));
  IF left(v, 1) = '{' THEN INSERT INTO fx VALUES (n, (v::jsonb -> 'record' ->> 'id')::uuid); END IF;
  RETURN v;
END $$;

-- The intake an agent starts on an opportunity (P-2.2), as New quote starts one; its id is kept under the name given.
CREATE FUNCTION pg_temp.start_intake(n text, opp text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := pg_temp.got('ada', 'acme-brokers', format('SELECT public.start_broker_intake(%L, %L)::text', pg_temp.id(opp), pg_temp.id('acme')));
BEGIN
  IF left(v, 1) = '{' THEN INSERT INTO fx VALUES (n, (v::jsonb ->> 'intake_id')::uuid); END IF;
  RETURN v;
END $$;
-- The employer of an intake says whether a market may receive their packet (M-1.1), as the Reckoning's list does.
CREATE FUNCTION pg_temp.authorize(who text, intake text, market text, yes boolean DEFAULT true) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, NULL, format('SELECT public.set_peo_authorization(%L, %L, %L, public.peo_authorization_version(), %L)::text',
                                       pg_temp.id(intake), market, yes, 'I authorize ' || market || ' to receive my packet.'))
$$;

-- An intake certified by its employer and moved to Ready for market, as quote_comparison.sql places one: the certification as the table's owner with its
-- triggers off, the pipeline by its own history.

-- An intake certified by its employer and moved to Ready for market, as quote_comparison.sql places one: the certification as the table's owner with its
-- triggers off, the pipeline by its own history.
CREATE FUNCTION pg_temp.make_ready(intake text, company text, p_file_id text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE sid uuid := pg_temp.id(intake); from_status text; to_status text;
BEGIN
  UPDATE public.chamber_sessions SET chamber_data = chamber_data || jsonb_build_object('company_name', company) WHERE id = sid;
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.chamber_certifications (session_id, user_id, signer_name, signer_title, consent_version, consent_text, signed_at, data_sha256, file_id, version, chamber_data)
  SELECT s.id, s.user_id, 'Wes Reyes', 'Owner', 'v1', 'I certify.', now(), 'h1', p_file_id, 1, s.chamber_data FROM public.chamber_sessions s WHERE s.id = sid;
  PERFORM set_config('session_replication_role', 'origin', true);
  FOREACH to_status IN ARRAY ARRAY['submitted', 'under_review', 'ready_for_market'] LOOP
    SELECT w.status INTO from_status FROM public.submission_workflow w WHERE w.session_id = sid;
    UPDATE public.submission_workflow SET status = to_status WHERE session_id = sid;
    INSERT INTO public.submission_status_history (session_id, from_status, to_status) VALUES (sid, from_status, to_status);
  END LOOP;
END $$;

-- A whole send as Acme's founder: send_to_peo to one person at the market. Answers what send_to_peo answered, or its refusal.
CREATE FUNCTION pg_temp.send(intake text, market text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got('ada', 'acme-brokers', format('SELECT public.send_to_peo(%L, %L, ARRAY[%L], %L, %L)::text',
                                                   pg_temp.id(intake), market, 'underwriting@market.example', 'Reyes Bakery: a submission', 'Here is Reyes Bakery.'))
$$;



-- ---------- set up: Acme's founder Ada (owner), Lea (a lead) and Gus (an agent) ----------
DO $$
BEGIN
  PERFORM pg_temp.new_user('lea'); PERFORM pg_temp.new_user('gus');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('lea'), 'lead'), (pg_temp.id('acme'), pg_temp.id('gus'), 'agent');
END $$;

CREATE FUNCTION pg_temp.preview(who text, addr text, firm text, kind text, p_rows jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, addr, format('SELECT public.import_preview(%L, %L, %L::jsonb)::text', pg_temp.id(firm), kind, p_rows))
$$;
-- A whole import as one person: started, its rows sent in one piece. Answers what import_rows answered, or the first refusal.
CREATE FUNCTION pg_temp.import(n text, who text, addr text, firm text, kind text, p_rows jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  v := pg_temp.got(who, addr, format('SELECT public.start_import(%L, %L, %L, %L)::text', pg_temp.id(firm), kind, n || '.csv', jsonb_array_length(p_rows)));
  IF v !~ '^[0-9a-f-]{36}$' THEN RETURN v; END IF;
  INSERT INTO fx VALUES (n, v::uuid);
  RETURN pg_temp.got(who, addr, format('SELECT public.import_rows(%L, %L, %L::jsonb)::text', pg_temp.id(firm), v, p_rows));
END $$;

-- ---------- 1. A review says what an import would do and makes nothing ----------
-- Catches: a review that differs from the import it previews, or one that leaves records behind.
DO $$
DECLARE v text; r jsonb := '[
  {"_row": 2, "name": "Dana Cole", "business": "Cole Plumbing", "email": "dana@cole.example", "employees": "12", "state": "tx"},
  {"_row": 3, "name": "", "email": "nobody@x.example"},
  {"_row": 4, "name": "Sam Roe", "employees": "about ten"}]';
BEGIN
  v := pg_temp.preview('ada', 'acme-brokers', 'acme', 'leads', r);
  PERFORM pg_temp.is((v::jsonb ->> 'create') || '/' || (v::jsonb ->> 'exists') || '/' || (v::jsonb ->> 'failed'), '1/0/2', 'one would be made, two can''t be: ' || left(v, 300));
  PERFORM pg_temp.is((SELECT string_agg((p ->> 'row') || ': ' || (p ->> 'reason'), '; ' ORDER BY (p ->> 'row')::int) FROM jsonb_array_elements(v::jsonb -> 'problems') p),
    '3: Enter a name: the person''s, or the business''s when you don''t know who to speak to.; 4: Employees must be a whole number, like 25', 'each row that can''t be imported, with its reason, by its row in the file');
  PERFORM pg_temp.is((SELECT count(*) FROM public.leads WHERE firm_id = pg_temp.id('acme')), 0::bigint, 'and no lead is made');
  PERFORM pg_temp.is((SELECT count(*) FROM public.imports), 0::bigint, 'and no import is recorded');
  RAISE NOTICE 'import: 1 passed';
END $$;

-- ---------- 2. Importing leads: each good row makes a lead from an import, owned by the importer; the rest are recorded with why ----------
DO $$
DECLARE v text; l public.leads;
BEGIN
  v := pg_temp.import('leads1', 'ada', 'acme-brokers', 'acme', 'leads', '[
    {"_row": 2, "name": " Dana Cole ", "business": "Cole Plumbing", "email": "dana@cole.example", "employees": "12", "state": "tx"},
    {"_row": 3, "name": "", "email": "nobody@x.example"}]');
  PERFORM pg_temp.is(v::jsonb, '{"created": 1, "exists": 0, "failed": 1}'::jsonb, 'what the rows made: ' || v);
  SELECT * INTO l FROM public.leads WHERE firm_id = pg_temp.id('acme');
  PERFORM pg_temp.is(l.name || '|' || l.state || '|' || l.employees || '|' || l.source || '|' || l.status, 'Dana Cole|TX|12|import|new', 'the lead, trimmed, its state in capitals, from an import');
  PERFORM pg_temp.is(l.owner_id, pg_temp.id('ada'), 'owned by the person importing');
  PERFORM pg_temp.is((SELECT string_agg(row_number || ':' || outcome || ':' || COALESCE(reason, ''), ', ' ORDER BY row_number) FROM public.import_rows WHERE import_id = pg_temp.id('leads1')),
    '2:created:, 3:failed:Enter a name: the person''s, or the business''s when you don''t know who to speak to.', 'each row''s outcome is kept');
  RAISE NOTICE 'import: 2 passed';
END $$;

-- ---------- 3. A lead already here, by its email, is not made twice; the same rows sent again change nothing ----------
-- Catches: a book imported twice doubling every lead, or a retried request doing so.
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.import('leads2', 'ada', 'acme-brokers', 'acme', 'leads', '[{"_row": 2, "name": "D. Cole", "email": "DANA@cole.example"}, {"_row": 3, "name": "New Person", "email": "new@p.example"}]');
  PERFORM pg_temp.is(v::jsonb, '{"created": 1, "exists": 1, "failed": 0}'::jsonb, 'one is already here: ' || v);
  v := pg_temp.got('ada', 'acme-brokers', format('SELECT public.import_rows(%L, %L, %L::jsonb)::text', pg_temp.id('acme'), pg_temp.id('leads2'),
    '[{"_row": 2, "name": "D. Cole", "email": "DANA@cole.example"}, {"_row": 3, "name": "New Person", "email": "new@p.example"}]'));
  PERFORM pg_temp.is(v::jsonb, '{"created": 0, "exists": 0, "failed": 0}'::jsonb, 'rows already recorded are not done again: ' || v);
  PERFORM pg_temp.is((SELECT count(*) FROM public.leads WHERE firm_id = pg_temp.id('acme')), 2::bigint, 'two leads in all');
  RAISE NOTICE 'import: 3 passed';
END $$;

-- ---------- 4. Importing accounts: the account, its contact as the main one, and its renewal, in one row; a row that fails makes none of them ----------
DO $$
DECLARE v text; a public.accounts;
BEGIN
  v := pg_temp.import('accts1', 'ada', 'acme-brokers', 'acme', 'accounts', '[
    {"_row": 2, "name": "Cole Plumbing", "website": "https://www.coleplumbing.example/", "state": "TX", "employees": "40", "current_provider": "Old PEO", "renewal_date": "1/15/2027",
     "contact_first_name": "Dana", "contact_last_name": "Cole", "contact_email": "dana@coleplumbing.example"},
    {"_row": 3, "name": "No Contact Co", "state": "OK"},
    {"_row": 4, "name": "Half Contact Co", "contact_first_name": "Only"},
    {"_row": 5, "name": "Bad Date Co", "current_provider": "Some PEO", "renewal_date": "next spring"},
    {"_row": 6, "name": "Date Alone Co", "renewal_date": "2027-03-01"}]');
  PERFORM pg_temp.is(v::jsonb, '{"created": 2, "exists": 0, "failed": 3}'::jsonb, 'what the rows made: ' || v);
  SELECT * INTO a FROM public.accounts WHERE name = 'Cole Plumbing';
  PERFORM pg_temp.is(a.source || '|' || a.employees || '|' || a.current_provider, 'import|40|Old PEO', 'the account, from an import');
  PERFORM pg_temp.is((SELECT first_name || ' ' || last_name || '|' || email || '|' || is_main FROM public.contacts WHERE account_id = a.id), 'Dana Cole|dana@coleplumbing.example|true', 'its contact, the main one');
  PERFORM pg_temp.is((SELECT kind || '|' || with_whom || '|' || renews_on FROM public.renewals WHERE account_id = a.id), 'current_plan|Old PEO|2027-01-15', 'its renewal, with its current provider');
  PERFORM pg_temp.is((SELECT string_agg(row_number || ': ' || reason, '; ' ORDER BY row_number) FROM public.import_rows WHERE import_id = pg_temp.id('accts1') AND outcome = 'failed'),
    '4: Enter the contact''s last name.; 5: Renewal date must be a date, like 2027-01-31 or 1/31/2027; 6: A renewal date needs the current provider it renews with', 'each failed row''s reason');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE name IN ('Half Contact Co', 'Bad Date Co', 'Date Alone Co')), 0::bigint, 'and a failed row makes no account');
  RAISE NOTICE 'import: 4 passed';
END $$;

-- ---------- 5. An account already here (the same website, or the same name and state) is not made twice ----------
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.import('accts2', 'ada', 'acme-brokers', 'acme', 'accounts', '[
    {"_row": 2, "name": "Cole Plumbing LLC", "website": "coleplumbing.example"},
    {"_row": 3, "name": "no contact co", "state": "ok"},
    {"_row": 4, "name": "No Contact Co", "state": "TX"}]');
  PERFORM pg_temp.is(v::jsonb, '{"created": 1, "exists": 2, "failed": 0}'::jsonb, 'two are already here; the same name in another state is not: ' || v);
  RAISE NOTICE 'import: 5 passed';
END $$;

-- ---------- 6. The owner of a row is the member its owner column names, by email or by name; a name nobody has fails the row ----------
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.import('owners', 'ada', 'acme-brokers', 'acme', 'leads', '[
    {"_row": 2, "name": "For Gus", "owner": "GUS@example.test"},
    {"_row": 3, "name": "For Nobody", "owner": "someone else"}]');
  PERFORM pg_temp.is(v::jsonb, '{"created": 1, "exists": 0, "failed": 1}'::jsonb, 'one owner is known: ' || v);
  PERFORM pg_temp.is((SELECT owner_id FROM public.leads WHERE name = 'For Gus'), pg_temp.id('gus'), 'the lead is the named member''s');
  PERFORM pg_temp.is((SELECT reason FROM public.import_rows WHERE import_id = pg_temp.id('owners') AND row_number = 3), 'No member of the firm is "someone else". Use their email.', 'and the other row says why');
  RAISE NOTICE 'import: 6 passed';
END $$;

-- ---------- 7. An owner or a lead imports; an agent, another firm and a closing firm don't. A lead imports only for themselves and their teams ----------
DO $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.is(left(pg_temp.import('by_agent', 'gus', 'acme-brokers', 'acme', 'leads', '[{"_row": 2, "name": "X"}]'), 6), '42501:', 'an agent');
  PERFORM pg_temp.is(left(pg_temp.preview('gus', 'acme-brokers', 'acme', 'leads', '[{"_row": 2, "name": "X"}]'), 6), '42501:', 'an agent''s review');
  PERFORM pg_temp.is(left(pg_temp.import('by_other', 'zed', 'zenith-benefits', 'acme', 'leads', '[{"_row": 2, "name": "X"}]'), 6), '42501:', 'another firm''s owner');
  PERFORM pg_temp.is(left(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.import_rows(%L, %L, %L::jsonb)::text', pg_temp.id('zenith'), pg_temp.id('leads1'), '[{"_row": 9, "name": "Planted"}]')), 6), 'PT404:',
    'another firm adding rows to this firm''s import');
  v := pg_temp.import('by_lead', 'lea', 'acme-brokers', 'acme', 'leads', '[{"_row": 2, "name": "Lea''s Lead"}, {"_row": 3, "name": "For Ada", "owner": "ada@example.test"}]');
  PERFORM pg_temp.is(v::jsonb, '{"created": 1, "exists": 0, "failed": 1}'::jsonb, 'a lead imports for themselves, not for someone outside their teams: ' || v);
  PERFORM pg_temp.is((SELECT count(*) FROM public.leads WHERE name IN ('X', 'Planted', 'For Ada')), 0::bigint, 'and nothing refused was made');
  RAISE NOTICE 'import: 7 passed';
END $$;

-- ---------- 8. The limits: 10,000 rows an import, 500 a request, a kind that is one of the two ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.start_import(%L, %L, %L, 10001)::text', pg_temp.id('acme'), 'leads', 'big.csv')), '22023: An import holds at most 10,000 rows. Split the file and import each part.', 'too many rows');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.start_import(%L, %L, %L, 5)::text', pg_temp.id('acme'), 'contacts', 'x.csv')), '22023: Import leads, or accounts with their contacts', 'a kind that is neither');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.import_rows(%L, %L, %L::jsonb)::text', pg_temp.id('acme'), pg_temp.id('leads1'),
    (SELECT jsonb_agg(jsonb_build_object('_row', g, 'name', 'N' || g)) FROM generate_series(100, 600) g))), '22023: Send at most 500 rows at a time', 'too many in one request');
  RAISE NOTICE 'import: 8 passed';
END $$;

-- ---------- 9. The firm's imports are listed with who ran each and what it made; an owner sees all, a lead their own; the problems of one can be read ----------
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.got('ada', 'acme-brokers', format('SELECT public.imports_list(%L)::text', pg_temp.id('acme')));
  PERFORM pg_temp.is(jsonb_array_length(v::jsonb), 6, 'the owner sees every import: ' || left(v, 200));
  PERFORM pg_temp.is((SELECT (i ->> 'kind') || '|' || (i ->> 'created') || '|' || (i ->> 'exists') || '|' || (i ->> 'failed') || '|' || (i ->> 'can_undo') FROM jsonb_array_elements(v::jsonb) i WHERE i ->> 'file_name' = 'accts1.csv'),
    'accounts|2|0|3|true', 'each with what it made and whether it can be undone');
  PERFORM pg_temp.is(jsonb_array_length(pg_temp.got('lea', 'acme-brokers', format('SELECT public.imports_list(%L)::text', pg_temp.id('acme')))::jsonb), 1, 'a lead sees their own');
  PERFORM pg_temp.is(left(pg_temp.got('gus', 'acme-brokers', format('SELECT public.imports_list(%L)::text', pg_temp.id('acme'))), 6), '42501:', 'an agent sees none');
  v := pg_temp.got('ada', 'acme-brokers', format('SELECT public.import_problems(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('accts1')));
  PERFORM pg_temp.is((SELECT string_agg(p ->> 'row', ',' ORDER BY (p ->> 'row')::int) FROM jsonb_array_elements(v::jsonb) p), '4,5,6', 'the rows of an import that were not made');
  PERFORM pg_temp.is(left(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.import_problems(%L, %L)::text', pg_temp.id('zenith'), pg_temp.id('accts1'))), 6), 'PT404:', 'another firm reads none of it');
  RAISE NOTICE 'import: 9 passed';
END $$;

-- ---------- 10. Undoing an import removes what it made and nothing else; an account that has since gained an opportunity is kept and said to be ----------
DO $$
DECLARE v text; kept uuid := (SELECT id FROM public.accounts WHERE name = 'No Contact Co' AND state = 'OK');
BEGIN
  INSERT INTO public.opportunities (firm_id, account_id, owner_id, name) VALUES (pg_temp.id('acme'), kept, pg_temp.id('ada'), 'A search since');
  PERFORM pg_temp.is(left(pg_temp.got('lea', 'acme-brokers', format('SELECT public.undo_import(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('accts1'))), 6), 'PT404:', 'a lead can''t undo someone else''s');
  v := pg_temp.got('ada', 'acme-brokers', format('SELECT public.undo_import(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('accts1')));
  PERFORM pg_temp.is(v::jsonb, '{"removed": 1, "kept": 1}'::jsonb, 'one removed, one kept: ' || v);
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE name = 'Cole Plumbing'), 0::bigint, 'the account is gone');
  PERFORM pg_temp.is((SELECT (SELECT count(*) FROM public.contacts WHERE email = 'dana@coleplumbing.example') + (SELECT count(*) FROM public.renewals WHERE with_whom = 'Old PEO')), 0::bigint, 'with its contact and its renewal');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE id = kept), 1::bigint, 'the one with an opportunity stays');
  PERFORM pg_temp.is((SELECT count(*) FROM public.accounts WHERE name = 'No Contact Co' AND state = 'TX'), 1::bigint, 'and another import''s account is untouched');
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', format('SELECT public.undo_import(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('accts1'))), 6), '55000:', 'it is undone once');
  -- Leads go to the bin, where an owner can restore them; one converted since is kept.
  v := pg_temp.got('ada', 'acme-brokers', format('SELECT public.undo_import(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('leads1')));
  PERFORM pg_temp.is(v::jsonb, '{"removed": 1, "kept": 0}'::jsonb, 'the import''s lead: ' || v);
  PERFORM pg_temp.is((SELECT deleted_at IS NOT NULL FROM public.leads WHERE email = 'dana@cole.example'), true, 'is in the bin');
  RAISE NOTICE 'import: 10 passed';
END $$;

-- ---------- 11. After 30 days an import can no longer be undone ----------
DO $$
BEGIN
  UPDATE public.imports SET created_at = now() - interval '31 days' WHERE id = pg_temp.id('leads2');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.undo_import(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('leads2'))), '55000: An import can be undone for 30 days. This one is older.', 'an old import');
  PERFORM pg_temp.is((SELECT (i ->> 'can_undo') FROM jsonb_array_elements(pg_temp.got('ada', 'acme-brokers', format('SELECT public.imports_list(%L)::text', pg_temp.id('acme')))::jsonb) i WHERE i ->> 'file_name' = 'leads2.csv'), 'false', 'and the list says so');
  RAISE NOTICE 'import: 11 passed';
END $$;

-- ---------- 12. Closing a firm deletes its imports ----------
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT string_agg(p.src, ', ' ORDER BY p.src) FROM public.firm_closing_plan() p WHERE p.action = 'delete' AND p.src IN ('public.imports', 'public.import_rows')),
    'public.import_rows, public.imports', 'the closing plan deletes both');
  RAISE NOTICE 'import: 12 passed';
END $$;

\echo import: all passed
