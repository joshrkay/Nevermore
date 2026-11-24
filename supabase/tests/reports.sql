-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh reports
-- The firm's reports (BR-6.1; CRM-R1.1 to CRM-R1.3; docs/BROKER_CRM_BUILD.md "## Reports"; 20261204090000_reports.sql): the pipeline, quotes by market,
-- won and lost, renewals, and commission. Two firms. Every migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261201090000_roles_teams_visibility.sql
\i supabase/migrations/20261202090000_lead_duplicates.sql
\i supabase/migrations/20261203090000_templates_and_reply.sql
\i supabase/migrations/20261204090000_reports.sql
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



-- The reports as a person reads them at an address, for the 90 days up to today unless said: the answer, or "SQLSTATE: message" when refused.
CREATE FUNCTION pg_temp.reports(who text, addr text, firm text, whose text DEFAULT 'mine', line text DEFAULT NULL, d_from date DEFAULT current_date - 90, d_to date DEFAULT current_date) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, addr, format('SELECT public.firm_reports(%L, %L, %L, %L, %L)::text', pg_temp.id(firm), d_from, d_to, whose, line))
$$;
CREATE FUNCTION pg_temp.stage_counts(r jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg((s ->> 'stage') || '=' || (s ->> 'count'), ' ' ORDER BY ord) FROM jsonb_array_elements(r -> 'pipeline' -> 'stages') WITH ORDINALITY x(s, ord)
$$;

-- ---------- 1. A firm with nothing reads five empty reports, every stage and month there with a zero ----------
DO $$
DECLARE v jsonb := pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone')::jsonb;
BEGIN
  PERFORM pg_temp.is(pg_temp.stage_counts(v), 'qualifying=0 intake_under_way=0 ready_to_send=0 in_market=0 quoted=0', 'every open stage, each with none');
  PERFORM pg_temp.is((v -> 'markets' ->> 'sent') || '/' || jsonb_array_length(v -> 'markets' -> 'markets'), '0/0', 'no market asked');
  PERFORM pg_temp.is((v -> 'won_lost' ->> 'won') || '/' || (v -> 'won_lost' ->> 'lost'), '0/0', 'nothing won or lost');
  PERFORM pg_temp.is(jsonb_array_length(v -> 'renewals' -> 'months'), 12, 'twelve months of renewals');
  PERFORM pg_temp.is((v -> 'commission' ->> 'expected') || '/' || (v -> 'commission' ->> 'received'), '0/0', 'no commission');
  PERFORM pg_temp.is((v ->> 'whose') || ':' || (v -> 'whose_choices')::text, 'everyone:["mine", "everyone"]', 'an owner may ask for their own or everyone''s');
  RAISE NOTICE 'reports: 1 passed';
END $$;

-- ---------- set up ----------
-- Acme: Ada (owner) has Reyes Bakery; Gus (an agent) has Gus Garage. Reyes: one search sent to Harbor PEO and quoted in 4 days, and to Slow PEO which
-- declined; one qualifying search worth 5,000 made 40 days ago; one won 10 days ago worth 12,000 (source Referral) and placed with Harbor PEO, 2,400 a year
-- expected from the 1st of last month, 150 received this month; one lost 5 days ago on price; one won and one lost 200 days ago. Garage: one qualifying search of Gus's,
-- and one of his lost 3 days ago. Renewals on Reyes: one last month kept (its search won), one last month marked as not renewed, one in 2 months being
-- worked, one in 3 months not. Zenith has a won search of its own.
DO $$
DECLARE v text; r jsonb; qid bigint; opp uuid; pl uuid; m0 date := date_trunc('month', current_date)::date;
BEGIN
  PERFORM pg_temp.new_user('gus'); PERFORM pg_temp.new_user('pat');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('gus'), 'agent');
  PERFORM pg_temp.as_user('platform_admin'); PERFORM public.admin_add_peo('Harbor PEO'); PERFORM public.admin_add_peo('Slow PEO'); PERFORM pg_temp.as_owner();
  PERFORM pg_temp.as_user('gus', 'acme-brokers');
  r := public.create_account('Gus Garage', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 12, '{}'::text[], NULL, pg_temp.id('gus'), pg_temp.id('acme'), 'added_by_hand');
  PERFORM pg_temp.as_owner();
  INSERT INTO fx VALUES ('garage', (r ->> 'id')::uuid);

  v := pg_temp.opportunity('market_opp', 'Market search');
  v := pg_temp.start_intake('intake', 'market_opp');
  UPDATE public.chamber_sessions SET user_id = pg_temp.id('pat') WHERE id = pg_temp.id('intake');
  PERFORM pg_temp.is((pg_temp.authorize('pat', 'intake', 'Harbor PEO')::jsonb ->> 'authorized'), 'true', 'set up: Harbor PEO is authorized');
  PERFORM pg_temp.is((pg_temp.authorize('pat', 'intake', 'Slow PEO')::jsonb ->> 'authorized'), 'true', 'set up: Slow PEO is authorized');
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (pg_temp.id('ada'), 'google', 'ada@acme.example', 'https://www.googleapis.com/auth/gmail.send', 'sealed', 'iv');
  PERFORM pg_temp.make_ready('intake', 'Reyes Bakery', 'EAA-2026-0401');
  PERFORM pg_temp.is(left(pg_temp.send('intake', 'Harbor PEO'), 1), '{', 'set up: sent to Harbor PEO');
  PERFORM pg_temp.is(left(pg_temp.send('intake', 'Slow PEO'), 1), '{', 'set up: sent to Slow PEO');
  -- The days are set as the table's owner: sent 6 days ago; Harbor quoted 4 days later; Slow declined.
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.quote_requests SET sent_on = current_date - 6 WHERE session_id = pg_temp.id('intake');
  UPDATE public.quote_requests SET status = 'quoted', quote_received_on = current_date - 2 WHERE session_id = pg_temp.id('intake') AND peo_name = 'Harbor PEO';
  UPDATE public.quote_requests SET status = 'declined', decline_reason = (public.quote_decline_reasons())[1] WHERE session_id = pg_temp.id('intake') AND peo_name = 'Slow PEO';
  UPDATE public.submission_workflow SET status = 'quoted' WHERE session_id = pg_temp.id('intake');

  INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, value, created_at) VALUES (pg_temp.id('acme'), pg_temp.id('reyes'), pg_temp.id('ada'), 'Old qualifying', 5000, now() - interval '40 days');
  -- Won: a search is won through its intake's pipeline, here stamped 10 days ago; and one won 200 days ago, outside the period.
  PERFORM set_config('session_replication_role', 'origin', true);
  v := pg_temp.opportunity('won_opp', 'Won search');
  v := pg_temp.start_intake('won_intake', 'won_opp');
  v := pg_temp.opportunity('old_won_opp', 'Won long ago');
  v := pg_temp.start_intake('old_won_intake', 'old_won_opp');
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.submission_workflow SET status = 'won' WHERE session_id IN (pg_temp.id('won_intake'), pg_temp.id('old_won_intake'));
  INSERT INTO public.submission_status_history (session_id, from_status, to_status, changed_at) VALUES
    (pg_temp.id('won_intake'), 'quoted', 'won', now() - interval '10 days'), (pg_temp.id('old_won_intake'), 'quoted', 'won', now() - interval '200 days');
  UPDATE public.opportunities SET value = 12000, source = 'Referral', won_at = now() - interval '10 days', won_by = pg_temp.id('ada') WHERE id = pg_temp.id('won_opp');
  INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, lost_at, lost_by, lost_reason) VALUES
    (pg_temp.id('acme'), pg_temp.id('reyes'), pg_temp.id('ada'), 'Lost on price', now() - interval '5 days', pg_temp.id('ada'), 'price'),
    (pg_temp.id('acme'), pg_temp.id('garage'), pg_temp.id('gus'), 'Garage lost', now() - interval '3 days', pg_temp.id('gus'), 'no_decision');
  INSERT INTO public.opportunities (firm_id, account_id, owner_id, name) VALUES (pg_temp.id('acme'), pg_temp.id('garage'), pg_temp.id('gus'), 'Garage search');
  INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, lost_at, lost_by, lost_reason)
  VALUES (pg_temp.id('acme'), pg_temp.id('reyes'), pg_temp.id('ada'), 'Lost long ago', now() - interval '200 days', pg_temp.id('ada'), 'went_direct');
  INSERT INTO public.accounts (firm_id, owner_id, name, source) VALUES (pg_temp.id('zenith'), pg_temp.id('zed'), 'Zenith Client', 'added_by_hand');
  INSERT INTO public.opportunities (firm_id, account_id, owner_id, name, lost_at, lost_by, lost_reason)
  SELECT pg_temp.id('zenith'), a.id, pg_temp.id('zed'), 'Zenith lost', now() - interval '2 days', pg_temp.id('zed'), 'price' FROM public.accounts a WHERE a.name = 'Zenith Client';
  -- The placement the win made, with Harbor PEO: 2,400 a year expected from the 1st of last month; 150 received this month and 100 long ago.
  INSERT INTO public.placements (firm_id, account_id, opportunity_id, peo_name, start_date, commission_basis, commission_rate, commission_expected_yearly)
  VALUES (pg_temp.id('acme'), pg_temp.id('reyes'), pg_temp.id('won_opp'), 'Harbor PEO', (m0 - interval '1 month')::date, 'flat', 2400, 2400) RETURNING id INTO pl;
  INSERT INTO fx VALUES ('placement', pl);
  INSERT INTO public.commission_payments (firm_id, account_id, placement_id, received_on, amount) VALUES
    (pg_temp.id('acme'), pg_temp.id('reyes'), pl, current_date, 150), (pg_temp.id('acme'), pg_temp.id('reyes'), pl, current_date - 400, 100);
  -- Renewals on Reyes Bakery.
  INSERT INTO public.renewals (firm_id, account_id, kind, with_whom, renews_on, not_renewed_on, opportunity_id) VALUES
    (pg_temp.id('acme'), pg_temp.id('reyes'), 'current_plan', 'Kept PEO', current_date - 20, NULL, pg_temp.id('won_opp')),
    (pg_temp.id('acme'), pg_temp.id('reyes'), 'current_plan', 'Gone PEO', current_date - 15, current_date - 15, NULL),
    (pg_temp.id('acme'), pg_temp.id('reyes'), 'current_plan', 'Worked PEO', (m0 + interval '2 months')::date, NULL, pg_temp.id('market_opp')),
    (pg_temp.id('acme'), pg_temp.id('reyes'), 'current_plan', 'Waiting PEO', (m0 + interval '3 months')::date, NULL, NULL);
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;

-- ---------- 2. The pipeline: what is open now by stage and by owner, the longest open first; nothing won or lost ----------
DO $$
DECLARE v jsonb := pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone')::jsonb; p jsonb := v -> 'pipeline';
BEGIN
  PERFORM pg_temp.is(pg_temp.stage_counts(v), 'qualifying=2 intake_under_way=0 ready_to_send=0 in_market=0 quoted=1', 'open searches by stage: ' || pg_temp.stage_counts(v));
  PERFORM pg_temp.is((p ->> 'count') || '/' || (p ->> 'value')::float8, '3/5000', 'three open, worth 5,000');
  PERFORM pg_temp.is(p -> 'rows' -> 0 ->> 'name', 'Old qualifying', 'the one open longest is first');
  PERFORM pg_temp.is((p -> 'rows' -> 0 ->> 'days')::int, 40, 'open for 40 days');
  PERFORM pg_temp.is((SELECT (s ->> 'median_days')::numeric FROM jsonb_array_elements(p -> 'stages') s WHERE s ->> 'stage' = 'qualifying'), 20::numeric, 'the median days open of a stage');
  PERFORM pg_temp.is((SELECT string_agg((o ->> 'owner') || '=' || (o ->> 'count'), ', ' ORDER BY o ->> 'owner') FROM jsonb_array_elements(p -> 'owners') o), 'ada@example.test=2, gus@example.test=1', 'by owner');
  RAISE NOTICE 'reports: 2 passed';
END $$;

-- ---------- 3. Quotes by market: sent, quoted, declined and why, days to a quote, and which was placed with ----------
DO $$
DECLARE v jsonb := pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone')::jsonb; m jsonb := v -> 'markets'; h jsonb; s jsonb;
BEGIN
  PERFORM pg_temp.is(format('%s/%s/%s', m ->> 'sent', m ->> 'quoted', m ->> 'declined'), '2/1/1', 'two sent, one quoted, one declined');
  SELECT x INTO h FROM jsonb_array_elements(m -> 'markets') x WHERE x ->> 'market' = 'Harbor PEO';
  SELECT x INTO s FROM jsonb_array_elements(m -> 'markets') x WHERE x ->> 'market' = 'Slow PEO';
  PERFORM pg_temp.is(format('%s/%s/%s/%s', h ->> 'sent', h ->> 'quoted', h ->> 'declined', (h ->> 'median_days')::float8), '1/1/0/4', 'Harbor PEO quoted in 4 days');
  PERFORM pg_temp.is(format('%s/%s/%s', s ->> 'sent', s ->> 'quoted', s ->> 'declined') || (s -> 'decline_reasons')::text, '1/0/1' || jsonb_build_object((public.quote_decline_reasons())[1], 1)::text, 'Slow PEO declined, and why');
  PERFORM pg_temp.is(s ->> 'median_days', NULL, 'a market that never quoted has no days to a quote');
  PERFORM pg_temp.is(jsonb_array_length(m -> 'rows'), 2, 'the quote requests counted are listed');
  v := pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone', NULL, current_date - 5, current_date)::jsonb;
  PERFORM pg_temp.is(v -> 'markets' ->> 'sent', '0', 'a period after the sends counts none');
  RAISE NOTICE 'reports: 3 passed';
END $$;

-- ---------- 4. Won and lost in the period: by owner, by source, lost by reason; what closed before the period is not counted ----------
DO $$
DECLARE v jsonb := pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone')::jsonb; w jsonb := v -> 'won_lost';
BEGIN
  PERFORM pg_temp.is(format('%s/%s/%s', w ->> 'won', w ->> 'lost', (w ->> 'value_won')::float8), '1/2/12000', 'one won worth 12,000, two lost');
  PERFORM pg_temp.is((SELECT string_agg(format('%s=%s-%s', split_part(o ->> 'owner', '@', 1), o ->> 'won', o ->> 'lost'), ', ' ORDER BY o ->> 'owner') FROM jsonb_array_elements(w -> 'owners') o), 'ada=1-1, gus=0-1', 'by owner');
  PERFORM pg_temp.is((SELECT string_agg(format('%s=%s-%s', o ->> 'source', o ->> 'won', o ->> 'lost'), ', ' ORDER BY o ->> 'source') FROM jsonb_array_elements(w -> 'sources') o), 'Not said=0-2, Referral=1-0', 'by source');
  PERFORM pg_temp.is((SELECT string_agg(format('%s=%s', o ->> 'reason', o ->> 'count'), ', ' ORDER BY o ->> 'reason') FROM jsonb_array_elements(w -> 'reasons') o), 'no_decision=1, price=1', 'lost by reason');
  PERFORM pg_temp.is((SELECT string_agg(o ->> 'name', ', ' ORDER BY o ->> 'name') FROM jsonb_array_elements(w -> 'rows') o), 'Garage lost, Lost on price, Won search', 'the searches counted are listed, and no other firm''s');
  v := pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone', NULL, current_date - 300, current_date)::jsonb;
  PERFORM pg_temp.is(format('%s/%s', v -> 'won_lost' ->> 'won', v -> 'won_lost' ->> 'lost'), '2/3', 'a longer period reaches the older ones, the win by the day its pipeline said so');
  RAISE NOTICE 'reports: 4 passed';
END $$;

-- ---------- 5. Renewals: what renews in each coming month and whether it is being worked; how the period's ended ----------
DO $$
DECLARE v jsonb := pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone')::jsonb; r jsonb := v -> 'renewals'; m0 date := date_trunc('month', current_date)::date;
BEGIN
  PERFORM pg_temp.is(r -> 'months' -> 0 ->> 'month', to_char(m0, 'YYYY-MM'), 'the months start with this one');
  PERFORM pg_temp.is(format('%s/%s', r -> 'months' -> 2 ->> 'due', r -> 'months' -> 2 ->> 'worked'), '1/1', 'two months out: one due, being worked');
  PERFORM pg_temp.is(format('%s/%s', r -> 'months' -> 3 ->> 'due', r -> 'months' -> 3 ->> 'worked'), '1/0', 'three months out: one due, not worked');
  PERFORM pg_temp.is(format('%s/%s/%s', r ->> 'kept', r ->> 'lost', r ->> 'open'), '1/1/0', 'in the period: one kept, one lost');
  PERFORM pg_temp.is((SELECT string_agg(o ->> 'with_whom', ', ' ORDER BY o ->> 'with_whom') FROM jsonb_array_elements(r -> 'rows') o), 'Gone PEO, Kept PEO', 'and they are listed');
  RAISE NOTICE 'reports: 5 passed';
END $$;

-- ---------- 6. Commission: expected against received by month and placement, for an owner only ----------
DO $$
DECLARE m0 date := date_trunc('month', current_date)::date; v jsonb; c jsonb;
BEGIN
  v := pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone', NULL, (m0 - interval '1 month')::date, current_date)::jsonb; c := v -> 'commission';
  PERFORM pg_temp.is(format('%s/%s', (c ->> 'expected')::float8, (c ->> 'received')::float8), '400/150', 'two months at 200 expected, 150 received in the period');
  PERFORM pg_temp.is((SELECT string_agg(format('%s:%s/%s', x ->> 'month', (x ->> 'expected')::float8, (x ->> 'received')::float8), ' ' ORDER BY x ->> 'month') FROM jsonb_array_elements(c -> 'months') x),
    format('%s:200/0 %s:200/150', to_char(m0 - interval '1 month', 'YYYY-MM'), to_char(m0, 'YYYY-MM')), 'by month');
  PERFORM pg_temp.is(format('%s %s %s/%s', c -> 'rows' -> 0 ->> 'account', c -> 'rows' -> 0 ->> 'market', (c -> 'rows' -> 0 ->> 'expected')::float8, (c -> 'rows' -> 0 ->> 'received')::float8),
    'Reyes Bakery Harbor PEO 400/150', 'by placement');
  v := pg_temp.reports('gus', 'acme-brokers', 'acme')::jsonb;
  PERFORM pg_temp.is(v -> 'commission', 'null'::jsonb, 'an agent is given no commission report');
  PERFORM pg_temp.is(v ? 'commission', true, 'and the answer says so plainly');
  RAISE NOTICE 'reports: 6 passed';
END $$;

-- ---------- 7. An agent reads only their own; "everyone" asked by one who may not is read as their own; an owner's "mine" is theirs alone ----------
DO $$
DECLARE v jsonb := pg_temp.reports('gus', 'acme-brokers', 'acme', 'everyone')::jsonb;
BEGIN
  PERFORM pg_temp.is((v ->> 'whose') || ':' || (v -> 'whose_choices')::text, 'mine:["mine"]', 'an agent''s only choice is their own');
  PERFORM pg_temp.is(pg_temp.stage_counts(v), 'qualifying=1 intake_under_way=0 ready_to_send=0 in_market=0 quoted=0', 'their one open search');
  PERFORM pg_temp.is(format('%s/%s/%s', v -> 'won_lost' ->> 'won', v -> 'won_lost' ->> 'lost', v -> 'markets' ->> 'sent'), '0/1/0', 'their one loss, and none of the owner''s wins or sends');
  PERFORM pg_temp.is((SELECT sum((m ->> 'due')::int) FROM jsonb_array_elements(v -> 'renewals' -> 'months') m), 0::bigint, 'and none of the owner''s renewals');
  v := pg_temp.reports('ada', 'acme-brokers', 'acme', 'mine')::jsonb;
  PERFORM pg_temp.is(format('%s/%s', v -> 'won_lost' ->> 'won', v -> 'won_lost' ->> 'lost'), '1/1', 'an owner asking for their own');
  RAISE NOTICE 'reports: 7 passed';
END $$;

-- ---------- 8. One line of business; another firm; a period that makes no sense ----------
DO $$
DECLARE v jsonb; other text := (SELECT l FROM unnest(public.quote_lines()) l WHERE l <> 'peo' LIMIT 1);
BEGIN
  v := pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone', 'peo')::jsonb;
  PERFORM pg_temp.is(v -> 'pipeline' ->> 'count', '3', 'every search here is a PEO search');
  v := pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone', other)::jsonb;
  PERFORM pg_temp.is(format('%s/%s/%s/%s', v -> 'pipeline' ->> 'count', v -> 'won_lost' ->> 'won', v -> 'markets' ->> 'sent', (v -> 'commission' ->> 'expected')::float8), '0/0/0/0', 'and none is of another line: ' || other);
  PERFORM pg_temp.is(left(pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone', 'pet_insurance'), 6), '22023:', 'a line that is not one');
  PERFORM pg_temp.is(left(pg_temp.reports('zed', 'zenith-benefits', 'acme', 'everyone'), 6), '42501:', 'another firm''s owner');
  v := pg_temp.reports('zed', 'zenith-benefits', 'zenith', 'everyone')::jsonb;
  PERFORM pg_temp.is(format('%s/%s', v -> 'won_lost' ->> 'won', v -> 'won_lost' ->> 'lost'), '0/1', 'who reads only their own firm''s');
  PERFORM pg_temp.is(pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone', NULL, current_date, current_date - 1), '22023: Choose a period that starts on or before the day it ends', 'a period that ends before it starts');
  PERFORM pg_temp.is(pg_temp.reports('ada', 'acme-brokers', 'acme', 'everyone', NULL, current_date - 2000, current_date), '22023: A report covers at most three years', 'a period too long');
  RAISE NOTICE 'reports: 8 passed';
END $$;

\echo reports: all passed
