-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh merge_leads
-- Merging two leads (BR-5.4; CRM-S4.3; docs/BROKER_CRM_BUILD.md "## Leads catch up", D-2360 on; 20261207090000_merge_leads.sql). Two firms. Every
-- migration is loaded, in filename order (D-105), this story's last.
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
\i supabase/migrations/20261205090000_search_leads.sql
\i supabase/migrations/20261206090000_lead_labels_column.sql
\i supabase/migrations/20261207090000_merge_leads.sql
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



CREATE FUNCTION pg_temp.lead(n text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.leads WHERE name = n $$;
CREATE FUNCTION pg_temp.ver(n text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT version FROM public.leads WHERE name = n $$;
-- A merge as a person asks for it at an address, from the versions the two leads are at now unless said: the answer, or "SQLSTATE: message".
CREATE FUNCTION pg_temp.merge(who text, addr text, kept uuid, removed uuid, choices jsonb DEFAULT '{}', kv integer DEFAULT -1, rv integer DEFAULT -1) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, addr, format('SELECT public.merge_leads(%L, %L, %L::jsonb, %L, %L)::text', kept, removed, choices,
    CASE kv WHEN -1 THEN (SELECT version FROM public.leads WHERE id = kept) ELSE kv END, CASE rv WHEN -1 THEN (SELECT version FROM public.leads WHERE id = removed) ELSE rv END))
$$;

-- Acme (by level): Ada the owner, Gus and Hal agents. Ada's Dana Cole (new; title, business, a note; label Hot; a note logged on her) and D. Cole (working;
-- email, phone, city, another note; labels Hot and VIP; a task and a call; one conversation with a message). Gus's own two; Hal's one; one of Ada's
-- converted; one in the bin. Zenith has a lead of its own.
DO $$
DECLARE r jsonb; conv uuid;
BEGIN
  PERFORM pg_temp.new_user('gus'); PERFORM pg_temp.new_user('hal');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('gus'), 'agent'), (pg_temp.id('acme'), pg_temp.id('hal'), 'agent');
  UPDATE public.firms SET visibility = 'by_level' WHERE id = pg_temp.id('acme');
  INSERT INTO public.leads (firm_id, owner_id, name, title, business, email, phone, city, note, source, status) VALUES
    (pg_temp.id('acme'), pg_temp.id('ada'), 'Dana Cole', 'Owner', 'Cole Plumbing', NULL, NULL, NULL, 'Met at the trade show.', 'added_by_hand', 'new'),
    (pg_temp.id('acme'), pg_temp.id('ada'), 'D. Cole', NULL, 'Cole Plumbing LLC', 'dana@cole.example', '(512) 555-0147', 'Austin', 'Asked for a call back.', 'import', 'working'),
    (pg_temp.id('acme'), pg_temp.id('gus'), 'Gus One', NULL, NULL, NULL, NULL, NULL, NULL, 'added_by_hand', 'new'),
    (pg_temp.id('acme'), pg_temp.id('gus'), 'Gus Two', NULL, NULL, NULL, NULL, NULL, NULL, 'added_by_hand', 'new'),
    (pg_temp.id('acme'), pg_temp.id('hal'), 'Hal One', NULL, NULL, NULL, NULL, NULL, NULL, 'added_by_hand', 'new'),
    (pg_temp.id('acme'), pg_temp.id('ada'), 'Was Converted', NULL, NULL, NULL, NULL, NULL, NULL, 'added_by_hand', 'new'),
    (pg_temp.id('zenith'), pg_temp.id('zed'), 'Zoe', NULL, NULL, NULL, NULL, NULL, NULL, 'added_by_hand', 'new');
  INSERT INTO public.leads (firm_id, owner_id, name, source, status, deleted_at) VALUES (pg_temp.id('acme'), pg_temp.id('ada'), 'Binned', 'added_by_hand', 'new', now());
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.leads SET status = 'converted', converted_at = now() WHERE name = 'Was Converted';
  PERFORM set_config('session_replication_role', 'origin', true);
  INSERT INTO public.activities (firm_id, lead_id, kind, body, author_id) VALUES (pg_temp.id('acme'), pg_temp.lead('Dana Cole'), 'note', 'A note on Dana Cole', pg_temp.id('ada'));
  INSERT INTO public.activities (firm_id, lead_id, kind, title, assignee_id, author_id, due_on) VALUES (pg_temp.id('acme'), pg_temp.lead('D. Cole'), 'task', 'Call D. Cole back', pg_temp.id('ada'), pg_temp.id('ada'), current_date + 1);
  INSERT INTO public.activities (firm_id, lead_id, kind, outcome, author_id) VALUES (pg_temp.id('acme'), pg_temp.lead('D. Cole'), 'call', 'left_message', pg_temp.id('ada'));
  PERFORM pg_temp.as_user('ada', 'acme-brokers');
  r := public.bulk_leads_change(pg_temp.id('acme'), 'label_add', '{"name":"Hot"}', NULL, (SELECT jsonb_agg(id::text) FROM public.leads WHERE name IN ('Dana Cole', 'D. Cole')));
  r := public.bulk_leads_change(pg_temp.id('acme'), 'label_add', '{"name":"VIP"}', NULL, (SELECT jsonb_agg(id::text) FROM public.leads WHERE name = 'D. Cole'));
  PERFORM pg_temp.as_owner();
  INSERT INTO public.conversations (firm_id, lead_id, reply_address) VALUES (pg_temp.id('acme'), pg_temp.lead('D. Cole'), 'c.dcole.0123456789abcdef') RETURNING id INTO conv;
  INSERT INTO fx VALUES ('conv', conv);
END $$;

-- ---------- 1. Before it is done: what differs, each lead's own values, and how much would move ----------
DO $$
DECLARE v jsonb := pg_temp.got('ada', 'acme-brokers', format('SELECT public.merge_leads_preview(%L, %L, %L)::text', pg_temp.id('acme'), pg_temp.lead('Dana Cole'), pg_temp.lead('D. Cole')))::jsonb;
BEGIN
  PERFORM pg_temp.is(v ->> 'problem', NULL, 'nothing stops an owner');
  PERFORM pg_temp.is(v -> 'differs', '["name", "title", "business", "email", "phone", "city", "note", "status"]'::jsonb, 'the fields that differ, in the screen''s order: ' || (v -> 'differs')::text);
  PERFORM pg_temp.is(format('%s|%s|%s', v -> 'kept' ->> 'name', v -> 'removed' ->> 'email', v -> 'kept' -> 'owner' ->> 'name'), 'Dana Cole|dana@cole.example|ada@example.test', 'each lead''s own values, and its owner by name');
  PERFORM pg_temp.is(v -> 'moves', '{"labels": 1, "emails": 0, "activities": 2}'::jsonb, 'two calls or tasks and the one label the kept lead lacks would move: ' || (v -> 'moves')::text);
  PERFORM pg_temp.is((SELECT count(*) FROM public.leads WHERE firm_id = pg_temp.id('acme') AND name IN ('Dana Cole', 'D. Cole')), 2::bigint, 'and nothing was changed by asking');
  RAISE NOTICE 'merge_leads: 1 passed';
END $$;

-- ---------- 2. Who may not, and what is refused, each leaving both leads as they were ----------
DO $$
DECLARE dana uuid := pg_temp.lead('Dana Cole'); dc uuid := pg_temp.lead('D. Cole'); v text;
BEGIN
  PERFORM pg_temp.is(left(pg_temp.merge('gus', 'acme-brokers', dana, dc), 6), 'PT404:', 'an agent who may see neither');
  PERFORM pg_temp.is(left(pg_temp.merge('gus', 'acme-brokers', pg_temp.lead('Gus One'), pg_temp.lead('Hal One')), 6), 'PT404:', 'an agent with one of their own and one they may not see');
  PERFORM pg_temp.is(left(pg_temp.merge('zed', 'zenith-benefits', dana, dc), 6), 'PT404:', 'another firm''s owner, acting for their own firm, where neither lead is');
  PERFORM pg_temp.is(left(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.merge_leads(%L, %L, %L::jsonb, 1, 1, %L)::text', dana, dc, '{}', pg_temp.id('acme'))), 6), '42501:', 'and naming the first firm, of which they are no member');
  PERFORM pg_temp.is(left(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.merge_leads(%L, %L, %L::jsonb, 1, 1, %L)::text', pg_temp.lead('Zoe'), dana, '{}', pg_temp.id('zenith'))), 6), 'PT404:', 'a lead of another firm as the one removed');
  -- Seeing is not changing: where everyone sees every record, an agent still changes only their own.
  UPDATE public.firms SET visibility = 'everyone' WHERE id = pg_temp.id('acme');
  PERFORM pg_temp.is(pg_temp.merge('gus', 'acme-brokers', pg_temp.lead('Gus One'), pg_temp.lead('Hal One')),
    '42501: You can''t change Hal One. Only the lead''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'an agent merging away a lead they may see and not change');
  PERFORM pg_temp.is(left(pg_temp.merge('gus', 'acme-brokers', pg_temp.lead('Hal One'), pg_temp.lead('Gus One')), 31), '42501: You can''t change Hal One', 'or keeping it');
  PERFORM pg_temp.is(pg_temp.got('gus', 'acme-brokers', format('SELECT public.merge_leads_preview(%L, %L, %L) ->> %L', pg_temp.id('acme'), pg_temp.lead('Gus One'), pg_temp.lead('Hal One'), 'problem')),
    'You can''t change Hal One. Only the lead''s owner, a lead of the owner''s team or an owner of the firm can change it.', 'and the preview says so before they try');
  UPDATE public.firms SET visibility = 'by_level' WHERE id = pg_temp.id('acme');
  PERFORM pg_temp.is(pg_temp.merge('ada', 'acme-brokers', dana, dana), '22023: Choose two different leads.', 'the same lead twice');
  PERFORM pg_temp.is(pg_temp.merge('ada', 'acme-brokers', dana, pg_temp.lead('Was Converted')), '22023: Was Converted is converted. Merge the account it became instead.', 'a converted lead');
  PERFORM pg_temp.is(left(pg_temp.merge('ada', 'acme-brokers', dana, pg_temp.lead('Binned')), 6), 'PT404:', 'a lead in the bin');
  PERFORM pg_temp.is(pg_temp.merge('ada', 'acme-brokers', dana, dc, '{"source":"removed"}'), '22023: Choose only among the fields that can differ.', 'a field that is not chosen between');
  PERFORM pg_temp.is(pg_temp.merge('ada', 'acme-brokers', dana, dc, '{"name":"both"}'), '22023: Each field keeps the value of the kept record or of the removed one.', 'a choice that is neither');
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', format('SELECT public.merge_leads(%L, %L)::text', dana, dc)), 6), '22023:', 'no versions');
  PERFORM pg_temp.is(pg_temp.merge('ada', 'acme-brokers', dana, dc, '{}', pg_temp.ver('Dana Cole') + 1), '40001: One of these leads was changed while you were choosing. Reload the page and choose again.', 'a version the kept lead is not at');
  PERFORM pg_temp.is(left(pg_temp.merge('ada', 'acme-brokers', dana, dc, '{}', -1, 99), 6), '40001:', 'a version the removed lead is not at');
  PERFORM pg_temp.is((SELECT count(*) FROM public.leads WHERE id IN (dana, dc)) || '/' || (SELECT count(*) FROM public.merged_records WHERE kind = 'lead'), '2/0', 'both leads are still there and nothing is recorded as merged');
  RAISE NOTICE 'merge_leads: 2 passed';
END $$;

-- ---------- 3. The merge: the values chosen, what the kept lead lacked taken, everything moved, the history copied, the old address kept ----------
DO $$
DECLARE dana uuid := pg_temp.lead('Dana Cole'); dc uuid := pg_temp.lead('D. Cole'); v jsonb; l public.leads;
BEGIN
  v := pg_temp.merge('ada', 'acme-brokers', dana, dc, '{"business":"removed","status":"removed","note":"kept"}')::jsonb;
  SELECT * INTO l FROM public.leads WHERE id = dana;
  PERFORM pg_temp.is(format('%s|%s|%s', l.name, l.title, l.note), 'Dana Cole|Owner|Met at the trade show.', 'what was not chosen, and what was chosen kept, stays the kept lead''s');
  PERFORM pg_temp.is(format('%s|%s', l.business, l.status), 'Cole Plumbing LLC|working', 'what was chosen from the removed lead is taken');
  PERFORM pg_temp.is(format('%s|%s|%s', l.email, l.phone, l.city), 'dana@cole.example|(512) 555-0147|Austin', 'and so is what the kept lead had none of, with nothing said');
  PERFORM pg_temp.is(l.source, 'added_by_hand', 'where it came from stays the kept lead''s');
  PERFORM pg_temp.is(v -> 'moved', '{"labels": 1, "emails": 0, "activities": 2}'::jsonb, 'what the answer says moved: ' || (v -> 'moved')::text);
  PERFORM pg_temp.is(v -> 'removed' ->> 'name', 'D. Cole', 'and which lead went');
  PERFORM pg_temp.is((SELECT count(*) FROM public.leads WHERE id = dc), 0::bigint, 'the removed lead is gone');
  PERFORM pg_temp.is((SELECT string_agg(kind, ',' ORDER BY kind) FROM public.activities WHERE lead_id = dana), 'call,note,task', 'its call and task are the kept lead''s, beside the note it had');
  PERFORM pg_temp.is(public.lead_label_names(dana)::text, '["Hot", "VIP"]', 'its labels too, the one in common once');
  PERFORM pg_temp.is((SELECT lead_id FROM public.conversations WHERE id = pg_temp.id('conv')), dana, 'and its emails');
  PERFORM pg_temp.is((SELECT count(*) FROM public.record_history WHERE table_name = 'leads' AND record_key = dana::text AND kind = 'merged' AND merged_from_name = 'D. Cole'), 1::bigint, 'the kept lead''s history says it was merged with D. Cole');
  PERFORM pg_temp.is((SELECT count(*) > 0 FROM public.record_history WHERE table_name = 'leads' AND record_key = dana::text AND kind = 'created' AND merged_from_key = dc::text), true, 'and holds the removed lead''s own history, marked as its');
  PERFORM pg_temp.is(pg_temp.got('gus', 'acme-brokers', format('SELECT public.resolve_merged_lead(%L, %L)::text', pg_temp.id('acme'), dc)), NULL, 'the old address tells nothing to someone who may not see the kept lead');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.resolve_merged_lead(%L, %L)::text', pg_temp.id('acme'), dc))::jsonb, jsonb_build_object('id', dana, 'name', 'Dana Cole'), 'and leads its owner to the kept lead');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.resolve_merged_lead(%L, %L)::text', pg_temp.id('acme'), dana)), NULL, 'a lead never merged away has no other address');
  RAISE NOTICE 'merge_leads: 3 passed';
END $$;

-- ---------- 4. An agent merges their own two; the owner can be the removed lead's; two conversations become one ----------
DO $$
DECLARE one uuid := pg_temp.lead('Gus One'); two uuid := pg_temp.lead('Gus Two'); hal uuid := pg_temp.lead('Hal One'); dana uuid := pg_temp.lead('Dana Cole'); v text; c2 uuid;
BEGIN
  v := pg_temp.merge('gus', 'acme-brokers', one, two);
  PERFORM pg_temp.is(left(v, 1), '{', 'an agent merges two leads of their own: ' || v);
  -- Hal's lead has a conversation with one message; so has the kept lead since case 3.
  INSERT INTO public.conversations (firm_id, lead_id, reply_address) VALUES (pg_temp.id('acme'), hal, 'c.hal.fedcba9876543210') RETURNING id INTO c2;
  PERFORM pg_temp.is(pg_temp.merge('ada', 'acme-brokers', dana, hal, '{"owner":"removed"}')::jsonb -> 'record' ->> 'owner_id', pg_temp.id('hal')::text, 'the owner chosen from the removed lead');
  PERFORM pg_temp.is((SELECT count(*) FROM public.conversations WHERE lead_id = dana) || '/' || (SELECT count(*) FROM public.conversations WHERE id = c2), '1/0', 'the kept lead still has one conversation, and the other is gone');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.resolve_merged_lead(%L, %L)::text', pg_temp.id('acme'), hal))::jsonb ->> 'name', 'Dana Cole', 'its old address leads to the kept lead');
  RAISE NOTICE 'merge_leads: 4 passed';
END $$;

\echo merge_leads: all passed
