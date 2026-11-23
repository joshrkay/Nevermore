-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh lines
-- A line says what is being quoted (ADR 0029; docs/BROKER_CRM_BUILD.md "## Lines", D-2000 to D-2019; 20261126090000_lines.sql). An opportunity is a PEO
-- search or a workers' comp search. Its intake is of that line, a market (a PEO, a carrier) is of one line, the employer authorizes and a firm sends to
-- markets of the intake's line only, and a quote holds what its line's quotes hold. Two firms, each made through sign-up and an admin's approval.
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

-- ---------- 1. An opportunity says what it quotes; made with no line, it is a PEO search ----------
-- Catches: every opportunity made before lines existed, and every one the chain or a conversion makes, reading as a search for nothing.
DO $$
DECLARE v text := pg_temp.opportunity('peo_opp', 'March 2027 PEO search');
BEGIN
  PERFORM pg_temp.is(CASE WHEN left(v, 1) = '{' THEN v::jsonb -> 'record' ->> 'line' ELSE v END, 'peo', 'the line of an opportunity made with none');
  RAISE NOTICE 'lines: 1 passed';
END $$;

-- ---------- 2. New opportunity can make a workers' comp search ----------
-- Catches: a line the form sends and the database drops, so a workers' comp search is saved as a PEO search and sent to PEOs.
DO $$
DECLARE v text := pg_temp.opportunity('wc_opp', 'March 2027 workers'' comp search', 'workers_comp');
BEGIN
  PERFORM pg_temp.is(CASE WHEN left(v, 1) = '{' THEN v::jsonb -> 'record' ->> 'line' ELSE v END, 'workers_comp', 'the line of an opportunity made as a workers'' comp search');
  RAISE NOTICE 'lines: 2 passed';
END $$;

-- ---------- 3. A line that is not one of the lines is refused in words, and nothing is made ----------
-- Catches: a line nobody quotes stored on an opportunity, or refused as a broken rule the form can't put into words.
DO $$
DECLARE v text := pg_temp.opportunity('odd_opp', 'A search for something else', 'commercial_auto');
BEGIN
  PERFORM pg_temp.is(left(v, 6), '22023:', 'an unknown line is a problem with what was sent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE name = 'A search for something else'), 0::bigint, 'and no opportunity is made');
  RAISE NOTICE 'lines: 3 passed';
END $$;

-- ---------- 4. A line sent as nothing is a line not said: a PEO search ----------
-- Catches: a form that sends its untouched choice as null being answered with a broken rule about a column.
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.got('ada', 'acme-brokers', format(
    'SELECT public.opportunity_create(%L, %L, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L, p_line => NULL)::text', pg_temp.id('reyes'), 'A search with no line said', pg_temp.id('acme')));
  PERFORM pg_temp.is(CASE WHEN left(v, 1) = '{' THEN v::jsonb -> 'record' ->> 'line' ELSE v END, 'peo', 'the line of an opportunity whose line was sent as nothing');
  RAISE NOTICE 'lines: 4 passed';
END $$;

-- ---------- 5. An opportunity's line never changes, whoever writes ----------
-- Catches: a later function, or a fix made by hand, turning a workers' comp search into a PEO search while its quotes hold a premium and no administrative fee.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.owner_state(format('UPDATE public.opportunities SET line = %L WHERE id = %L', 'peo', pg_temp.id('wc_opp'))), '23514', 'changing a line is refused');
  PERFORM pg_temp.is((SELECT line FROM public.opportunities WHERE id = pg_temp.id('wc_opp')), 'workers_comp', 'and the line is what it was');
  -- Writing the line it already has changes nothing and is no refusal: a statement that sets every column still goes through.
  PERFORM pg_temp.is(pg_temp.owner_state(format('UPDATE public.opportunities SET line = %L, next_step = %L WHERE id = %L', 'workers_comp', 'Call Lucia', pg_temp.id('wc_opp'))), 'ok',
    'writing the same line with another field');
  RAISE NOTICE 'lines: 5 passed';
END $$;

-- The intake an agent starts on an opportunity (P-2.2), as New quote starts one; its id is kept under the name given.
CREATE FUNCTION pg_temp.start_intake(n text, opp text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := pg_temp.got('ada', 'acme-brokers', format('SELECT public.start_broker_intake(%L, %L)::text', pg_temp.id(opp), pg_temp.id('acme')));
BEGIN
  IF left(v, 1) = '{' THEN INSERT INTO fx VALUES (n, (v::jsonb ->> 'intake_id')::uuid); END IF;
  RETURN v;
END $$;

-- ---------- 6. The intake an agent starts on an opportunity is of the opportunity's line, and a member of the firm reads which ----------
-- Catches: a workers' comp search whose intake reads as a PEO intake, so the employer is shown PEOs to authorize and the packet goes to them.
DO $$
DECLARE v text := pg_temp.start_intake('wc_intake', 'wc_opp');
BEGIN
  PERFORM pg_temp.is(left(v, 1), '{', 'the intake starts');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT line FROM public.chamber_sessions WHERE id = %L', pg_temp.id('wc_intake'))), 'workers_comp',
    'the line of an intake started on a workers'' comp search');
  PERFORM pg_temp.start_intake('peo_intake', 'peo_opp');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT line FROM public.chamber_sessions WHERE id = %L', pg_temp.id('peo_intake'))), 'peo',
    'the line of an intake started on a PEO search');
  RAISE NOTICE 'lines: 6 passed';
END $$;

-- ---------- 7. An intake a prospect starts in the browser is a PEO intake, whatever line the browser sends ----------
-- Catches: anyone with an account starting a workers' comp intake at a firm's link by adding one field to the request, before a firm link carries a line.
DO $$
BEGIN
  PERFORM pg_temp.new_user('lucia');
  -- The intake consent first, as the browser records it before any intake.
  PERFORM pg_temp.is(left(pg_temp.got('lucia', NULL, 'SELECT public.record_intake_consent(public.intake_consent_version(), ''I agree to how my information is used.'')::text'), 6) <> 'EA004:',
    true, 'the prospect agrees to the intake consent');
  PERFORM pg_temp.is(pg_temp.got('lucia', NULL, format(
    'INSERT INTO public.chamber_sessions (user_id, chamber_data, line) VALUES (%L, %L, %L) RETURNING line', pg_temp.id('lucia'), '{}', 'workers_comp')), 'peo',
    'the line of an intake a prospect started, having sent workers'' comp');
  RAISE NOTICE 'lines: 7 passed';
END $$;

-- ---------- 8. A prospect's later save can't change their intake's line: the line is kept and the rest is saved ----------
-- Catches: a save that sends the whole row back being refused over a column the prospect never chose, or changing what the intake is for.
DO $$
DECLARE v text;
BEGIN
  INSERT INTO fx SELECT 'lucia_intake', s.id FROM public.chamber_sessions s WHERE s.user_id = pg_temp.id('lucia');
  v := pg_temp.got('lucia', NULL, format(
    'UPDATE public.chamber_sessions SET line = %L, chamber_data = %L WHERE id = %L RETURNING line || %L || (chamber_data ->> %L)',
    'workers_comp', '{"company_name": "Reyes Bakery"}', pg_temp.id('lucia_intake'), ' / ', 'company_name'));
  PERFORM pg_temp.is(v, 'peo / Reyes Bakery', 'the line and the answer after a save that sent another line');
  RAISE NOTICE 'lines: 8 passed';
END $$;

-- ---------- 9. No other writer changes an intake's line either ----------
-- Catches: a definer function, the service role or a fix made by hand turning a workers' comp intake into a PEO intake after carriers were authorized on it.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.owner_state(format('UPDATE public.chamber_sessions SET line = %L WHERE id = %L', 'peo', pg_temp.id('wc_intake'))), '23514',
    'the table''s owner changing an intake''s line');
  PERFORM pg_temp.is((SELECT line FROM public.chamber_sessions WHERE id = pg_temp.id('wc_intake')), 'workers_comp', 'and the line is what it was');
  RAISE NOTICE 'lines: 9 passed';
END $$;

-- ---------- 10. An opportunity holds only an intake of its own line ----------
-- Catches: a PEO intake, with PEOs authorized on it, hung on a workers' comp search (or the reverse) by any path that links the two.
DO $$
DECLARE sid uuid;
BEGIN
  -- An intake of Acme's with no opportunity yet, a PEO intake as every intake is unless a firm's path says otherwise; placed as the table's owner.
  PERFORM pg_temp.new_user('omar');
  INSERT INTO public.chamber_sessions (user_id, chamber_data) VALUES (pg_temp.id('omar'), '{}') RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('acme') WHERE id = sid;
  INSERT INTO fx VALUES ('omar_intake', sid);
  PERFORM pg_temp.opportunity('wc_opp2', 'A second workers'' comp search', 'workers_comp');
  PERFORM pg_temp.opportunity('peo_opp2', 'A second PEO search');
  PERFORM pg_temp.is(pg_temp.owner_state(format('UPDATE public.opportunities SET intake_id = %L WHERE id = %L', sid, pg_temp.id('wc_opp2'))), '23503',
    'a workers'' comp search taking a PEO intake');
  PERFORM pg_temp.is(pg_temp.owner_state(format('UPDATE public.opportunities SET intake_id = %L WHERE id = %L', sid, pg_temp.id('peo_opp2'))), 'ok',
    'a PEO search taking the same intake');
  RAISE NOTICE 'lines: 10 passed';
END $$;

-- ---------- 11. An opportunity made for an intake takes the intake's line ----------
-- The chain at certification, bringing submissions in and a merge each make an opportunity for an intake that already exists and name no line. An intake can be
-- a workers' comp intake with no opportunity: its employer ended a firm's access to it (CRM-P2.5), and certifies again.
-- Catches: that certification refused over a foreign key, because the opportunity made for it was made a PEO search.
DO $$
DECLARE sid uuid;
BEGIN
  PERFORM pg_temp.new_user('priya');
  INSERT INTO public.chamber_sessions (user_id, chamber_data, line) VALUES (pg_temp.id('priya'), '{}', 'workers_comp') RETURNING id INTO sid;
  UPDATE public.chamber_sessions SET firm_id = pg_temp.id('acme') WHERE id = sid;
  -- The chain's own statement (20261119110000_chain_at_certification.sql): firm, account, owner, intake, name, main contact; no line.
  PERFORM pg_temp.is(pg_temp.owner_state(format(
    'INSERT INTO public.opportunities (firm_id, account_id, owner_id, intake_id, name, main_contact_id) VALUES (%L, %L, NULL, %L, %L, NULL)',
    pg_temp.id('acme'), pg_temp.id('reyes'), sid, 'Reyes Bakery – made for its intake')), 'ok', 'an opportunity made for a workers'' comp intake');
  PERFORM pg_temp.is((SELECT line FROM public.opportunities WHERE intake_id = sid), 'workers_comp', 'and its line is the intake''s');
  RAISE NOTICE 'lines: 11 passed';
END $$;

-- ---------- 12. A platform admin adds a market of a line: a carrier for workers' comp, a PEO when no line is said ----------
-- Catches: a carrier listed as a PEO, so it is offered to every employer on a PEO intake and to no workers' comp search.
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.got('platform_admin', NULL, 'SELECT public.admin_add_peo(''Granite Ridge Mutual'', ''workers_comp'')::text');
  PERFORM pg_temp.is(CASE WHEN left(v, 1) = '{' THEN v::jsonb ->> 'line' ELSE v END, 'workers_comp', 'the line of a market added as a workers'' comp carrier');
  v := pg_temp.got('platform_admin', NULL, 'SELECT public.admin_add_peo(''Harbor PEO'')::text');
  PERFORM pg_temp.is(CASE WHEN left(v, 1) = '{' THEN v::jsonb ->> 'line' ELSE v END, 'peo', 'the line of a market added with none');
  RAISE NOTICE 'lines: 12 passed';
END $$;

-- ---------- 13. A market of a line that is not one of the lines is refused in words, and nothing is listed ----------
-- Catches: the admin's form answered with a broken rule about a column, or a market listed that no search can be sent to.
DO $$
BEGIN
  PERFORM pg_temp.is(left(pg_temp.got('platform_admin', NULL, 'SELECT public.admin_add_peo(''Nowhere Indemnity'', ''commercial_auto'')::text'), 6), '22023:',
    'an unknown line for a market is a problem with what was sent');
  PERFORM pg_temp.is((SELECT count(*) FROM public.peos WHERE name = 'Nowhere Indemnity'), 0::bigint, 'and no market is listed');
  RAISE NOTICE 'lines: 13 passed';
END $$;

-- ---------- 14. A market's line sent as nothing is a line not said: a PEO ----------
-- Catches: the admin's form, sending its untouched choice as null, answered with a broken rule about a column.
DO $$
DECLARE v text := pg_temp.got('platform_admin', NULL, 'SELECT public.admin_add_peo(''Lakeshore PEO'', NULL)::text');
BEGIN
  PERFORM pg_temp.is(CASE WHEN left(v, 1) = '{' THEN v::jsonb ->> 'line' ELSE v END, 'peo', 'the line of a market whose line was sent as nothing');
  RAISE NOTICE 'lines: 14 passed';
END $$;

-- ---------- 15. The catalog says each market's line ----------
-- Catches: the screens that offer markets (the send, the employer's list, the admin's page) unable to tell a carrier from a PEO.
DO $$
DECLARE c jsonb;
BEGIN
  PERFORM pg_temp.as_user('ada', 'acme-brokers');
  c := public.peo_catalog();
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is((SELECT m ->> 'line' FROM jsonb_array_elements(c) m WHERE m ->> 'name' = 'Granite Ridge Mutual'), 'workers_comp', 'the catalog''s line for a carrier');
  PERFORM pg_temp.is((SELECT m ->> 'line' FROM jsonb_array_elements(c) m WHERE m ->> 'name' = 'Harbor PEO'), 'peo', 'the catalog''s line for a PEO');
  RAISE NOTICE 'lines: 15 passed';
END $$;

-- ---------- 16. A market's line never changes ----------
-- Catches: a carrier turned into a PEO after employers authorized it as a carrier, so their word now covers something they never read.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.owner_state('UPDATE public.peos SET line = ''peo'' WHERE name = ''Granite Ridge Mutual'''), '23514', 'changing a market''s line');
  PERFORM pg_temp.is((SELECT line FROM public.peos WHERE name = 'Granite Ridge Mutual'), 'workers_comp', 'and the line is what it was');
  RAISE NOTICE 'lines: 16 passed';
END $$;

-- ---------- 17. The markets an intake offers for the employer's authorization are the ones of its line ----------
-- Catches: an employer on a workers' comp intake shown every PEO to authorize, and no carrier.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT string_agg(peo, %L ORDER BY peo) FROM public.peo_authorization_states(%L)', ', ', pg_temp.id('wc_intake'))),
    'Granite Ridge Mutual', 'the markets offered on a workers'' comp intake');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format(
    'SELECT (count(*) FILTER (WHERE peo = %L))::text || %L || (count(*) FILTER (WHERE peo = %L))::text FROM public.peo_authorization_states(%L)',
    'Harbor PEO', ' PEO, carriers: ', 'Granite Ridge Mutual', pg_temp.id('peo_intake'))), '1 PEO, carriers: 0', 'a PEO intake offers the PEO and no carrier');
  RAISE NOTICE 'lines: 17 passed';
END $$;

-- The employer of an intake says whether a market may receive their packet (M-1.1), as the Reckoning's list does.
CREATE FUNCTION pg_temp.authorize(who text, intake text, market text, yes boolean DEFAULT true) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, NULL, format('SELECT public.set_peo_authorization(%L, %L, %L, public.peo_authorization_version(), %L)::text',
                                       pg_temp.id(intake), market, yes, 'I authorize ' || market || ' to receive my packet.'))
$$;

-- ---------- 18. The employer authorizes a market of their intake's line, and no other ----------
-- Catches: an employer's word given to a PEO on a workers' comp intake (or to a carrier on a PEO intake), which a send would then be let through on.
DO $$
BEGIN
  -- The employers the agent's two intakes were handed to (an invitation accepted, P-2.4), placed as the table's owner.
  PERFORM pg_temp.new_user('wes'); PERFORM pg_temp.new_user('pat');
  UPDATE public.chamber_sessions SET user_id = pg_temp.id('wes') WHERE id = pg_temp.id('wc_intake');
  UPDATE public.chamber_sessions SET user_id = pg_temp.id('pat') WHERE id = pg_temp.id('peo_intake');
  PERFORM pg_temp.is(left(pg_temp.authorize('wes', 'wc_intake', 'Harbor PEO'), 6), '22023:', 'a PEO on a workers'' comp intake');
  PERFORM pg_temp.is(left(pg_temp.authorize('pat', 'peo_intake', 'Granite Ridge Mutual'), 6), '22023:', 'a carrier on a PEO intake');
  PERFORM pg_temp.is((SELECT count(*) FROM public.peo_authorizations WHERE session_id IN (pg_temp.id('wc_intake'), pg_temp.id('peo_intake'))), 0::bigint, 'and nothing is recorded');
  PERFORM pg_temp.is((pg_temp.authorize('wes', 'wc_intake', 'Granite Ridge Mutual')::jsonb ->> 'authorized'), 'true', 'a carrier on a workers'' comp intake');
  PERFORM pg_temp.is((pg_temp.authorize('pat', 'peo_intake', 'Harbor PEO')::jsonb ->> 'authorized'), 'true', 'a PEO on a PEO intake');
  RAISE NOTICE 'lines: 18 passed';
END $$;

-- ---------- 19. No path records an authorization for a market of another line ----------
-- Catches: a later function that writes the record itself (an import, a fix made by hand) leaving an employer's word on a market their intake is not for,
-- which assert_peo_authorized would read as leave to send.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.owner_state(format(
    'INSERT INTO public.peo_authorizations (session_id, peo_id, peo_name, authorized, wording_version, wording_text, signed_by)
     SELECT %L, p.id, p.name, true, %L, %L, %L FROM public.peos p WHERE p.name = %L',
    pg_temp.id('wc_intake'), 'draft-1', 'I authorize Harbor PEO to receive my packet.', pg_temp.id('wes'), 'Harbor PEO')), '23514', 'a PEO''s authorization written straight onto a workers'' comp intake');
  PERFORM pg_temp.is((SELECT count(*) FROM public.peo_authorizations WHERE session_id = pg_temp.id('wc_intake') AND peo_name = 'Harbor PEO'), 0::bigint, 'and none is recorded');
  RAISE NOTICE 'lines: 19 passed';
END $$;

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

-- ---------- 20. A workers' comp search is sent to the carrier its employer authorized, as a PEO search is sent to a PEO ----------
-- Catches: the send, written when every market was a PEO, refusing a carrier or recording nothing for one.
DO $$
DECLARE v text;
BEGIN
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (pg_temp.id('ada'), 'google', 'ada@acme.example', 'https://www.googleapis.com/auth/gmail.send', 'sealed', 'iv');
  PERFORM pg_temp.make_ready('wc_intake', 'Reyes Bakery', 'EAA-2026-0101');
  PERFORM pg_temp.make_ready('peo_intake', 'Reyes Bakery', 'EAA-2026-0102');
  v := pg_temp.send('wc_intake', 'Granite Ridge Mutual');
  PERFORM pg_temp.is(left(v, 1), '{', 'the send to the carrier is recorded: ' || v);
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE session_id = pg_temp.id('wc_intake') AND peo_name = 'Granite Ridge Mutual'), 'sent', 'its quote request is Sent');
  PERFORM pg_temp.is((SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id('wc_intake')), 'sent_to_carrier', 'and the search is in market');
  RAISE NOTICE 'lines: 20 passed';
END $$;

-- ---------- 21. A quote request is never for a listed market of another line, whatever writes it ----------
-- Every send asks for the employer's authorization, which is of the intake's line (18, 19). This holds a later path that records a quote request without
-- asking (a quote the employer brought themselves, an import).
-- Catches: a PEO's quote request on a workers' comp search, whose quote would then be held to the wrong shape and compared with carriers'.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.owner_state(format('INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (%L, %L, %L)', pg_temp.id('wc_intake'), 'harbor peo', 'sent')),
    '23514', 'a quote request for a PEO on a workers'' comp search, its name in another case');
  -- A name no market holds has no line to disagree with: recorded as before.
  PERFORM pg_temp.is(pg_temp.owner_state(format('INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (%L, %L, %L)', pg_temp.id('wc_intake'), 'A Name Nobody Listed', 'sent')),
    'ok', 'a quote request for a name that is no listed market');
  RAISE NOTICE 'lines: 21 passed';
END $$;

CREATE FUNCTION pg_temp.qr(intake text, market text) RETURNS bigint LANGUAGE sql AS $$
  SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id(intake) AND peo_name = market $$;

-- Recording a quote on a quote request as Acme's founder, with the arguments given after the quote request and its kind. Answers what record_quote answered.
CREATE FUNCTION pg_temp.quote(intake text, market text, args text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got('ada', 'acme-brokers', format('SELECT public.record_quote(p_quote_request_id => %s, p_kind => %L%s)::text',
                                                   pg_temp.qr(intake, market), 'firm_offer', CASE WHEN args = '' THEN '' ELSE ', ' || args END))
$$;

-- ---------- 22. A carrier's quote holds what a workers' comp quote holds: the premium, the rates, the experience modification and the minimum premium ----------
-- Catches: a carrier's quote with nowhere to put its premium, recorded as a note or squeezed into an administrative fee, so nothing can be compared.
DO $$
DECLARE v text; q jsonb;
BEGIN
  v := pg_temp.quote('wc_intake', 'Granite Ridge Mutual',
    $a$p_annual_premium => 18450.00, p_workers_comp => '[{"state": "OR", "class_code": "2003", "rate": 4.12}]', p_experience_mod => 0.92, p_minimum_premium => 1500$a$);
  PERFORM pg_temp.is(left(v, 1), '{', 'the quote is recorded: ' || v);
  q := v::jsonb;
  PERFORM pg_temp.is((q ->> 'annual_premium')::numeric, 18450.00, 'its annual premium');
  PERFORM pg_temp.is((q ->> 'experience_mod')::numeric, 0.92, 'its experience modification');
  PERFORM pg_temp.is((q ->> 'minimum_premium')::numeric, 1500::numeric, 'its minimum premium');
  PERFORM pg_temp.is(q -> 'workers_comp', '[{"state": "OR", "class_code": "2003", "rate": 4.12}]'::jsonb, 'its rates by state and class code');
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = pg_temp.qr('wc_intake', 'Granite Ridge Mutual')), 'quoted', 'and its quote request is Quoted');
  RAISE NOTICE 'lines: 22 passed';
END $$;

-- ---------- 23. A workers' comp quote holds nothing only a PEO's quote holds ----------
-- Catches: a carrier's quote recorded with an administrative fee, unemployment or medical, read into a comparison that has no row for them.
DO $$
DECLARE before bigint := (SELECT count(*) FROM public.quotes);
BEGIN
  PERFORM pg_temp.is(left(pg_temp.quote('wc_intake', 'Granite Ridge Mutual', $a$p_annual_premium => 100, p_admin_fee => 45, p_admin_fee_basis => 'per_employee_per_month'$a$), 6),
    '22023:', 'an administrative fee on a workers'' comp quote');
  PERFORM pg_temp.is(left(pg_temp.quote('wc_intake', 'Granite Ridge Mutual', $a$p_annual_premium => 100, p_unemployment => '[{"state": "OR", "charge": "employer_rate"}]'$a$), 6),
    '22023:', 'unemployment tax on a workers'' comp quote');
  PERFORM pg_temp.is(left(pg_temp.quote('wc_intake', 'Granite Ridge Mutual', $a$p_annual_premium => 100, p_medical => '[{"plan": "Gold", "tier": "family", "rate": 900}]'$a$), 6),
    '22023:', 'medical on a workers'' comp quote');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quotes), before, 'and no quote is recorded');
  RAISE NOTICE 'lines: 23 passed';
END $$;

-- ---------- 24. A PEO's quote holds nothing only a workers' comp quote holds ----------
-- Catches: a PEO's quote recorded with an annual premium, an experience modification or a minimum premium, which the PEO comparison never shows.
DO $$
DECLARE v text; before bigint;
BEGIN
  v := pg_temp.send('peo_intake', 'Harbor PEO');
  PERFORM pg_temp.is(left(v, 1), '{', 'the PEO search is sent to its PEO: ' || v);
  before := (SELECT count(*) FROM public.quotes);
  PERFORM pg_temp.is(left(pg_temp.quote('peo_intake', 'Harbor PEO', $a$p_admin_fee => 45, p_admin_fee_basis => 'per_employee_per_month', p_annual_premium => 100$a$), 6),
    '22023:', 'an annual premium on a PEO''s quote');
  PERFORM pg_temp.is(left(pg_temp.quote('peo_intake', 'Harbor PEO', $a$p_admin_fee => 45, p_admin_fee_basis => 'per_employee_per_month', p_experience_mod => 0.92$a$), 6),
    '22023:', 'an experience modification on a PEO''s quote');
  PERFORM pg_temp.is(left(pg_temp.quote('peo_intake', 'Harbor PEO', $a$p_admin_fee => 45, p_admin_fee_basis => 'per_employee_per_month', p_minimum_premium => 1500$a$), 6),
    '22023:', 'a minimum premium on a PEO''s quote');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quotes), before, 'and no quote is recorded');
  -- A PEO's quote as it has always been recorded still is.
  v := pg_temp.quote('peo_intake', 'Harbor PEO', $a$p_admin_fee => 45, p_admin_fee_basis => 'per_employee_per_month', p_workers_comp => '[{"state": "OR", "class_code": "2003", "rate": 3.9}]'$a$);
  PERFORM pg_temp.is((v::jsonb ->> 'admin_fee')::numeric, 45::numeric, 'a PEO''s quote with its administrative fee and rates');
  RAISE NOTICE 'lines: 24 passed';
END $$;

-- ---------- 25. No path stores a quote that holds another line's areas ----------
-- Catches: a later writer of quotes (reading a quote document, an import) storing a carrier's quote with an administrative fee, past record_quote's check.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.owner_state(format(
    'INSERT INTO public.quotes (quote_request_id, session_id, kind, admin_fee, admin_fee_basis) VALUES (%s, %L, %L, 45, %L)',
    pg_temp.qr('wc_intake', 'Granite Ridge Mutual'), pg_temp.id('wc_intake'), 'estimate', 'per_employee_per_month')), '23514', 'an administrative fee written straight onto a workers'' comp quote');
  PERFORM pg_temp.is(pg_temp.owner_state(format(
    'UPDATE public.quotes SET annual_premium = 100 WHERE quote_request_id = %s', pg_temp.qr('peo_intake', 'Harbor PEO'))), '23514', 'an annual premium written straight onto a PEO''s quote');
  RAISE NOTICE 'lines: 25 passed';
END $$;

-- ---------- 26. A workers' comp figure outside its limits is refused in words ----------
-- The limits are the intake's own for the same kinds of figure: dollars from 0 to 100000000, an experience modification from 0 to 10.
-- Catches: a typing slip (a premium with two extra digits, a modification of 92 for 0.92) stored and carried into the comparison.
DO $$
DECLARE before bigint := (SELECT count(*) FROM public.quotes);
BEGIN
  PERFORM pg_temp.is(left(pg_temp.quote('wc_intake', 'Granite Ridge Mutual', 'p_annual_premium => 100000001'), 6), '22023:', 'an annual premium over the limit');
  PERFORM pg_temp.is(left(pg_temp.quote('wc_intake', 'Granite Ridge Mutual', 'p_annual_premium => -1'), 6), '22023:', 'an annual premium under 0');
  PERFORM pg_temp.is(left(pg_temp.quote('wc_intake', 'Granite Ridge Mutual', 'p_annual_premium => 100, p_experience_mod => 92'), 6), '22023:', 'an experience modification over the limit');
  PERFORM pg_temp.is(left(pg_temp.quote('wc_intake', 'Granite Ridge Mutual', 'p_annual_premium => 100, p_experience_mod => -0.5'), 6), '22023:', 'an experience modification under 0');
  PERFORM pg_temp.is(left(pg_temp.quote('wc_intake', 'Granite Ridge Mutual', 'p_annual_premium => 100, p_minimum_premium => 100000001'), 6), '22023:', 'a minimum premium over the limit');
  PERFORM pg_temp.is(left(pg_temp.quote('wc_intake', 'Granite Ridge Mutual', 'p_annual_premium => 100, p_minimum_premium => -1'), 6), '22023:', 'a minimum premium under 0');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quotes), before, 'and no quote is recorded');
  -- The limits themselves are figures a quote may hold.
  PERFORM pg_temp.is(left(pg_temp.quote('wc_intake', 'Granite Ridge Mutual', 'p_annual_premium => 100000000, p_experience_mod => 10, p_minimum_premium => 0'), 1), '{', 'the figures at their limits');
  RAISE NOTICE 'lines: 26 passed';
END $$;

-- ---------- 27. No path stores a workers' comp figure outside its limits ----------
-- Catches: the same slips written by anything that does not go through record_quote.
DO $$
DECLARE stmt text := format('INSERT INTO public.quotes (quote_request_id, session_id, kind, %%s) VALUES (%s, %L, %L, %%s)',
                            pg_temp.qr('wc_intake', 'Granite Ridge Mutual'), pg_temp.id('wc_intake'), 'estimate');
BEGIN
  PERFORM pg_temp.is(pg_temp.owner_state(format(stmt, 'annual_premium', '100000001')), '23514', 'an annual premium over the limit, written straight to the table');
  PERFORM pg_temp.is(pg_temp.owner_state(format(stmt, 'annual_premium', '-1')), '23514', 'an annual premium under 0');
  PERFORM pg_temp.is(pg_temp.owner_state(format(stmt, 'experience_mod', '10.01')), '23514', 'an experience modification over the limit');
  PERFORM pg_temp.is(pg_temp.owner_state(format(stmt, 'experience_mod', '-0.01')), '23514', 'an experience modification under 0');
  PERFORM pg_temp.is(pg_temp.owner_state(format(stmt, 'minimum_premium', '100000001')), '23514', 'a minimum premium over the limit');
  PERFORM pg_temp.is(pg_temp.owner_state(format(stmt, 'minimum_premium', '-1')), '23514', 'a minimum premium under 0');
  RAISE NOTICE 'lines: 27 passed';
END $$;

-- ---------- 28. The comparison says the opportunity's line and gives each quote's workers' comp figures ----------
-- Catches: a workers' comp comparison drawn with a PEO's rows (an administrative fee nobody quoted) and no premium.
DO $$
DECLARE r jsonb; q jsonb;
BEGIN
  PERFORM pg_temp.as_user('ada', 'acme-brokers');
  r := public.opportunity_quote_comparison(pg_temp.id('acme'), pg_temp.id('wc_opp'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(r ->> 'line', 'workers_comp', 'the comparison''s line');
  q := (SELECT c -> 'quote' FROM jsonb_array_elements(r -> 'columns') c WHERE c ->> 'peo_name' = 'Granite Ridge Mutual');
  -- The carrier's current quote is the newest recorded: the one at the limits (26). A minimum premium of 0 is a figure, not a blank (D-721).
  PERFORM pg_temp.is((q ->> 'annual_premium')::numeric, 100000000::numeric, 'the current quote''s annual premium');
  PERFORM pg_temp.is((q ->> 'experience_mod')::numeric, 10::numeric, 'its experience modification');
  PERFORM pg_temp.is(q -> 'minimum_premium', '0'::jsonb, 'its minimum premium, which is 0 and not left out');
  PERFORM pg_temp.as_user('ada', 'acme-brokers');
  r := public.opportunity_quote_comparison(pg_temp.id('acme'), pg_temp.id('peo_opp'));
  PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(r ->> 'line', 'peo', 'a PEO search''s comparison says so');
  RAISE NOTICE 'lines: 28 passed';
END $$;

-- A note on an opportunity's comparison, about one area of one market's column, as Acme's founder writes it.
CREATE FUNCTION pg_temp.note(opp text, intake text, market text, area text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got('ada', 'acme-brokers', format('SELECT public.add_comparison_note(%L, %L, %s, %L, %L, %L)::text',
                                                   pg_temp.id('acme'), pg_temp.id(opp), pg_temp.qr(intake, market), area, 'internal', 'A note about ' || area))
$$;

-- ---------- 29. A note on a comparison is about an area of the comparison's own line ----------
-- Catches: a broker unable to note anything about a carrier's premium, or a note filed under an area the comparison has no row for and so never shown.
DO $$
BEGIN
  PERFORM pg_temp.is(left(pg_temp.note('wc_opp', 'wc_intake', 'Granite Ridge Mutual', 'annual_premium'), 1), '{', 'a note about the annual premium on a workers'' comp comparison');
  PERFORM pg_temp.is(left(pg_temp.note('wc_opp', 'wc_intake', 'Granite Ridge Mutual', 'admin_fee'), 6), '22023:', 'a note about an administrative fee on a workers'' comp comparison');
  PERFORM pg_temp.is(left(pg_temp.note('peo_opp', 'peo_intake', 'Harbor PEO', 'annual_premium'), 6), '22023:', 'a note about an annual premium on a PEO comparison');
  PERFORM pg_temp.is(left(pg_temp.note('peo_opp', 'peo_intake', 'Harbor PEO', 'admin_fee'), 1), '{', 'a note about the administrative fee on a PEO comparison');
  RAISE NOTICE 'lines: 29 passed';
END $$;

-- ---------- 30. Another firm reads and writes none of a workers' comp search, at its own address or at the firm's ----------
-- Catches: one of the functions restated here losing its firm check or its grants on the way (a restated function keeps only what the new text says).
DO $$
DECLARE stmt text; got text; addr text; n bigint;
BEGIN
  FOREACH addr IN ARRAY ARRAY['zenith-benefits', 'acme-brokers'] LOOP
    FOREACH stmt IN ARRAY ARRAY[
      format('SELECT public.opportunity_create(%L, %L, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L, p_line => %L)::text', pg_temp.id('reyes'), 'Planted', pg_temp.id('acme'), 'workers_comp'),
      format('SELECT public.opportunity_create(%L, %L, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, %L, p_line => %L)::text', pg_temp.id('reyes'), 'Planted', pg_temp.id('zenith'), 'workers_comp'),
      format('SELECT public.start_broker_intake(%L, %L)::text', pg_temp.id('wc_opp2'), pg_temp.id('acme')),
      format('SELECT public.start_broker_intake(%L, %L)::text', pg_temp.id('wc_opp2'), pg_temp.id('zenith')),
      format('SELECT public.record_quote(p_quote_request_id => %s, p_kind => %L, p_annual_premium => 1)::text', pg_temp.qr('wc_intake', 'Granite Ridge Mutual'), 'estimate'),
      -- A quote of the wrong shape for its line is still "not found" to a stranger: the refusal in the line's words would tell them what the search is for.
      format('SELECT public.record_quote(p_quote_request_id => %s, p_kind => %L, p_admin_fee => 45, p_admin_fee_basis => %L)::text', pg_temp.qr('wc_intake', 'Granite Ridge Mutual'), 'estimate',
             'per_employee_per_month'),
      format('SELECT public.opportunity_quote_comparison(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('wc_opp')),
      format('SELECT public.opportunity_quote_comparison(%L, %L)::text', pg_temp.id('zenith'), pg_temp.id('wc_opp')),
      format('SELECT public.add_comparison_note(%L, %L, NULL, %L, %L, %L)::text', pg_temp.id('acme'), pg_temp.id('wc_opp'), 'annual_premium', 'internal', 'Planted'),
      format('SELECT public.add_comparison_note(%L, %L, NULL, %L, %L, %L)::text', pg_temp.id('zenith'), pg_temp.id('wc_opp'), 'annual_premium', 'internal', 'Planted'),
      format('SELECT count(*)::text FROM public.peo_authorization_states(%L)', pg_temp.id('wc_intake')),
      format('SELECT public.send_to_peo(%L, %L, ARRAY[%L], %L, %L)::text', pg_temp.id('wc_intake'), 'Granite Ridge Mutual', 'x@market.example', 'Subject', 'Body'),
      'SELECT public.admin_add_peo(''Planted Mutual'', ''workers_comp'')::text'
    ] LOOP
      got := pg_temp.got('zed', addr, stmt);
      IF left(got, 6) NOT IN ('42501:', 'PT404:') THEN RAISE EXCEPTION 'FAIL: at "%" Zenith''s founder ran % and got %', addr, stmt, got; END IF;
    END LOOP;
    -- And by the tables: the search, its intake (whose line a member of its firm reads), its quote requests and its quotes.
    PERFORM pg_temp.is(pg_temp.got('zed', addr, format('SELECT count(*)::text FROM public.opportunities WHERE id = %L', pg_temp.id('wc_opp'))), '0', 'the search, read at ' || addr);
    PERFORM pg_temp.is(pg_temp.got('zed', addr, format('SELECT count(*)::text FROM public.chamber_sessions WHERE id = %L', pg_temp.id('wc_intake'))), '0', 'its intake, read at ' || addr);
    PERFORM pg_temp.is(pg_temp.got('zed', addr, format('SELECT count(*)::text FROM public.quote_requests WHERE session_id = %L', pg_temp.id('wc_intake'))), '0', 'its quote requests, read at ' || addr);
    PERFORM pg_temp.is(pg_temp.got('zed', addr, format('SELECT count(*)::text FROM public.quotes WHERE session_id = %L', pg_temp.id('wc_intake'))), '0', 'its quotes, read at ' || addr);
  END LOOP;
  -- Nothing above was written, and the rows it could not read are there: the zeros are the rules' doing.
  PERFORM pg_temp.is((SELECT count(*) FROM public.opportunities WHERE name = 'Planted'), 0::bigint, 'no opportunity was planted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.peos WHERE name = 'Planted Mutual'), 0::bigint, 'no market was planted');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_comparison_notes WHERE body = 'Planted'), 0::bigint, 'no note was planted');
  n := (SELECT count(*) FROM public.quotes WHERE session_id = pg_temp.id('wc_intake'));
  IF n < 1 THEN RAISE EXCEPTION 'FAIL: the workers'' comp search has no quote, so reading none of them proves nothing'; END IF;
  -- The firm's own founder reads them, by the same statements.
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT count(*)::text FROM public.quotes WHERE session_id = %L', pg_temp.id('wc_intake'))), n::text, 'the firm''s founder reads its quotes');
  RAISE NOTICE 'lines: 30 passed';
END $$;

-- A send with its bundle link joined, as the browser does it after send_to_peo (M-2.1): the link issued for the version sent, then attach_peo_link, which
-- writes the fixed block under the note. Answers the message's body as stored.
CREATE FUNCTION pg_temp.sent_body(intake text, market text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r jsonb; l jsonb; body text;
BEGIN
  PERFORM pg_temp.as_user('ada', 'acme-brokers');
  r := public.send_to_peo(pg_temp.id(intake), market, ARRAY['underwriting@market.example'], 'Reyes Bakery: a submission', 'Here is Reyes Bakery.');
  l := public.issue_bundle_link((r ->> 'quote_request_id')::bigint,
         (SELECT sent_version FROM public.quote_requests WHERE id = (r ->> 'quote_request_id')::bigint), gen_random_uuid(),
         '[{"name": "packet.pdf", "what": "The packet"}]'::jsonb, '[]'::jsonb);
  PERFORM public.attach_peo_link((r ->> 'message_id')::bigint, (l ->> 'id')::bigint, l ->> 'token');
  PERFORM pg_temp.as_owner();
  SELECT m.body_text INTO body FROM public.quote_request_messages m WHERE m.id = (r ->> 'message_id')::bigint;
  RETURN body;
END $$;

-- ---------- 31. The line every message carries names who it is for: a carrier on a workers' comp search, a PEO on a PEO search ----------
-- The fixed block under the advisor's note ends with the line counsel's wording will replace (D-12); the advisor can't edit it.
-- Catches: mail to a carrier that says it was sent "for this PEO alone".
DO $$
DECLARE body text;
BEGIN
  -- A second send to a market continues its quote request with a new message (M-2.1).
  body := pg_temp.sent_body('wc_intake', 'Granite Ridge Mutual');
  PERFORM pg_temp.is(body LIKE '%for this carrier alone to consider them for a quote%', true, 'the message to a carrier says it is for this carrier alone: ' || right(body, 160));
  PERFORM pg_temp.is(body LIKE '%PEO%', false, 'and says PEO nowhere');
  body := pg_temp.sent_body('peo_intake', 'Harbor PEO');
  PERFORM pg_temp.is(body LIKE '%for this PEO alone to consider them for a quote%', true, 'the message to a PEO says it is for this PEO alone: ' || right(body, 160));
  RAISE NOTICE 'lines: 31 passed';
END $$;

-- ---------- 32. A workers' comp search is won with its carrier's quote, and the placement names the carrier ----------
-- Catches: the end of the search (won, the placement, its renewal), written when every market was a PEO, refusing a carrier's quote.
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.got('ada', 'acme-brokers', format(
    'SELECT public.opportunity_mark_won(%L, %s, %L, %L, %L, %L, %s, NULL, NULL, NULL, %L)::text',
    pg_temp.id('wc_opp'), pg_temp.qr('wc_intake', 'Granite Ridge Mutual'), '2027-03-01', '2028-03-01', 'Acme Brokers', pg_temp.id('acme'),
    (SELECT version FROM public.opportunities WHERE id = pg_temp.id('wc_opp')), 'America/Los_Angeles'));
  PERFORM pg_temp.is(left(v, 1), '{', 'the search is marked won: ' || v);
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT peo_name FROM public.placements WHERE opportunity_id = %L', pg_temp.id('wc_opp'))), 'Granite Ridge Mutual',
    'the placement names the carrier');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.opportunity_page(%L, %L) -> %L ->> %L', pg_temp.id('acme'), pg_temp.id('wc_opp'), 'opportunity', 'stage')),
    'won', 'and the search''s page says its stage is Won');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.opportunity_page(%L, %L) -> %L ->> %L', pg_temp.id('acme'), pg_temp.id('wc_opp'), 'opportunity', 'line')),
    'workers_comp', 'and its line');
  RAISE NOTICE 'lines: 32 passed';
END $$;

SELECT 'lines: all passed';
