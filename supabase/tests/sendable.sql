-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh sendable
-- What a firm needs before it can send (docs/BROKER_READINESS_PRD.md slice A; docs/BROKER_CRM_BUILD.md "## Sendable", D-2100 to D-2119;
-- 20261127090000_sendable.sql): a firm's own contacts at a PEO or carrier (BR-1.3), a firm asking for one that isn't listed (BR-1.4), and the firm's
-- licences on record, which a send to a carrier needs (BR-2.2). Two firms, each made through sign-up and an admin's approval.
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


-- ---------- set up: an agent beside Acme's founder, a PEO, a carrier and a PEO taken off the list, and one intake of each line ready to send ----------
DO $$
DECLARE v text; vid bigint;
BEGIN
  PERFORM pg_temp.new_user('gus');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('gus'), 'agent');
  PERFORM pg_temp.as_user('platform_admin');
  PERFORM public.admin_add_peo('Granite Ridge Mutual', 'workers_comp');
  PERFORM public.admin_add_peo('Harbor PEO');
  PERFORM public.admin_add_peo('Old Harbor PEO');
  PERFORM pg_temp.as_owner();
  UPDATE public.peos SET listed = false WHERE name = 'Old Harbor PEO';
  -- Harbor PEO's profile in use names one person with an email, as a published profile does (placed as the table's owner with its triggers off, as peo_send.sql places one).
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.peo_profile_versions (peo_id, version, status, published_at) SELECT id, 90, 'published', now() FROM public.peos WHERE name = 'Harbor PEO' RETURNING id INTO vid;
  INSERT INTO public.peo_contacts (profile_version_id, position, name, role, email) VALUES (vid, 1, 'Dana Platt', 'Underwriting', 'dana@harbor.example');
  PERFORM set_config('session_replication_role', 'origin', true);
  v := pg_temp.opportunity('wc_opp', 'March 2027 workers'' comp search', 'workers_comp');
  v := pg_temp.opportunity('peo_opp', 'March 2027 PEO search');
  v := pg_temp.start_intake('wc_intake', 'wc_opp');
  v := pg_temp.start_intake('peo_intake', 'peo_opp');
  PERFORM pg_temp.new_user('wes'); PERFORM pg_temp.new_user('pat');
  UPDATE public.chamber_sessions SET user_id = pg_temp.id('wes') WHERE id = pg_temp.id('wc_intake');
  UPDATE public.chamber_sessions SET user_id = pg_temp.id('pat') WHERE id = pg_temp.id('peo_intake');
  PERFORM pg_temp.is((pg_temp.authorize('wes', 'wc_intake', 'Granite Ridge Mutual')::jsonb ->> 'authorized'), 'true', 'set up: the carrier is authorized');
  PERFORM pg_temp.is((pg_temp.authorize('pat', 'peo_intake', 'Harbor PEO')::jsonb ->> 'authorized'), 'true', 'set up: the PEO is authorized');
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (pg_temp.id('ada'), 'google', 'ada@acme.example', 'https://www.googleapis.com/auth/gmail.send', 'sealed', 'iv');
  PERFORM pg_temp.make_ready('wc_intake', 'Reyes Bakery', 'EAA-2026-0101');
  PERFORM pg_temp.make_ready('peo_intake', 'Reyes Bakery', 'EAA-2026-0102');
END $$;

CREATE FUNCTION pg_temp.market(n text) RETURNS bigint LANGUAGE sql AS $$ SELECT id FROM public.peos WHERE name = n $$;

-- A member adds a contact of their firm's at a market. Answers what add_firm_market_contact answered, or its refusal.
CREATE FUNCTION pg_temp.add_contact(who text, addr text, firm text, market text, p_name text, p_email text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, addr, format('SELECT public.add_firm_market_contact(%L, %L, %L, NULL, %L, NULL)::text', pg_temp.id(firm), pg_temp.market(market), p_name, p_email))
$$;

-- =====================================================================================================================================================
-- A firm's own contacts at a market (BR-1.3)
-- =====================================================================================================================================================

-- ---------- 1. A member adds the person their firm deals with at a listed market, and every member of the firm reads it ----------
-- Catches: a contact an agent adds that their colleague can't send to, or that is kept nowhere.
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.add_contact('gus', 'acme-brokers', 'acme', 'Harbor PEO', 'Lee Ortiz', 'Lee@Harbor.example');
  PERFORM pg_temp.is(CASE WHEN left(v, 1) = '{' THEN v::jsonb ->> 'email' ELSE v END, 'lee@harbor.example', 'the contact is kept, its address in lower case');
  v := pg_temp.got('ada', 'acme-brokers', format('SELECT public.firm_market_contacts_list(%L)::text', pg_temp.id('acme')));
  PERFORM pg_temp.is(v::jsonb -> 0 ->> 'name', 'Lee Ortiz', 'the founder reads the agent''s contact: ' || v);
  PERFORM pg_temp.is(v::jsonb -> 0 ->> 'peo_name', 'Harbor PEO', 'under its market');
  PERFORM pg_temp.is(jsonb_array_length(v::jsonb), 1, 'and it is the only one');
  RAISE NOTICE 'sendable: 1 passed';
END $$;

-- ---------- 2. A firm's contacts are its own: another firm reads none of them and adds none to them ----------
-- Catches: one firm learning who another deals with at a PEO, the thing a broker guards most.
DO $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.is(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.firm_market_contacts_list(%L)::text', pg_temp.id('zenith'))), '[]', 'the other firm''s own list is empty');
  PERFORM pg_temp.is(left(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.firm_market_contacts_list(%L)::text', pg_temp.id('acme'))), 6), '42501:', 'it can''t read the first firm''s');
  PERFORM pg_temp.is(left(pg_temp.add_contact('zed', 'zenith-benefits', 'acme', 'Harbor PEO', 'Planted', 'planted@harbor.example'), 6), '42501:', 'or add to it');
  PERFORM pg_temp.is(left(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.remove_firm_market_contact(%L, %L)::text',
    pg_temp.id('zenith'), (SELECT id FROM public.firm_market_contacts WHERE email = 'lee@harbor.example'))), 6), 'PT404:', 'or remove one of them as its own');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_market_contacts WHERE firm_id = pg_temp.id('acme')), 1::bigint, 'and the first firm''s contact is as it was');
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', 'SELECT count(*)::text FROM public.firm_market_contacts'), 6), '42501:', 'no member reads the table itself');
  RAISE NOTICE 'sendable: 2 passed';
END $$;

-- ---------- 3. A contact is someone a send can go to: a name, an email address, at a market on the list, once ----------
-- Catches: a contact with no address offered in a send, one at a market nobody is offered, and the same person listed twice.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.add_contact('gus', 'acme-brokers', 'acme', 'Harbor PEO', 'No Address', NULL), '22023: A contact you send to has an email address', 'no email');
  PERFORM pg_temp.is(pg_temp.add_contact('gus', 'acme-brokers', 'acme', 'Harbor PEO', 'Bad Address', 'not-an-address'), '22023: A contact''s email must be an email address', 'a bad email');
  PERFORM pg_temp.is(pg_temp.add_contact('gus', 'acme-brokers', 'acme', 'Harbor PEO', '  ', 'x@harbor.example'), '22023: Each contact has a name of 1 to 200 characters', 'no name');
  PERFORM pg_temp.is(pg_temp.add_contact('gus', 'acme-brokers', 'acme', 'Old Harbor PEO', 'Kim', 'kim@old.example'), '22023: That PEO or carrier isn''t on the list', 'a market taken off the list');
  PERFORM pg_temp.is(pg_temp.got('gus', 'acme-brokers', format('SELECT public.add_firm_market_contact(%L, %L, %L, NULL, %L, NULL)::text', pg_temp.id('acme'), 987654, 'Kim', 'kim@old.example')),
    '22023: That PEO or carrier isn''t on the list', 'a market that does not exist');
  PERFORM pg_temp.is(pg_temp.add_contact('ada', 'acme-brokers', 'acme', 'Harbor PEO', 'Lee O.', 'LEE@harbor.example'),
    '22023: lee@harbor.example is already one of your firm''s contacts at Harbor PEO', 'the same address again, in another case');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_market_contacts), 1::bigint, 'and none of them is kept');
  RAISE NOTICE 'sendable: 3 passed';
END $$;

-- ---------- 4. A firm keeps at most ten contacts at one market ----------
-- Catches: a list with no end, read on every send.
DO $$
DECLARE i integer;
BEGIN
  FOR i IN 1..9 LOOP
    PERFORM pg_temp.is(left(pg_temp.add_contact('gus', 'acme-brokers', 'acme', 'Granite Ridge Mutual', 'Person ' || i, 'p' || i || '@granite.example'), 1), '{', 'contact ' || i);
  END LOOP;
  PERFORM pg_temp.is(left(pg_temp.add_contact('gus', 'acme-brokers', 'acme', 'Granite Ridge Mutual', 'Person 10', 'p10@granite.example'), 1), '{', 'the tenth');
  PERFORM pg_temp.is(pg_temp.add_contact('gus', 'acme-brokers', 'acme', 'Granite Ridge Mutual', 'Person 11', 'p11@granite.example'),
    '22023: Your firm keeps at most 10 contacts at Granite Ridge Mutual. Remove one to add another.', 'the eleventh');
  RAISE NOTICE 'sendable: 4 passed';
END $$;

-- ---------- 5. The composer offers the firm's own contacts first, then the profile's, each address once, and never another firm's ----------
-- Catches: a firm's contact kept and never offered; the profile's contact lost once a firm adds its own; another firm's contact offered in a send.
DO $$
DECLARE c jsonb;
BEGIN
  PERFORM pg_temp.is(left(pg_temp.add_contact('zed', 'zenith-benefits', 'zenith', 'Harbor PEO', 'Zenith''s Person', 'theirs@harbor.example'), 1), '{', 'the other firm adds its own');
  PERFORM pg_temp.is(left(pg_temp.add_contact('gus', 'acme-brokers', 'acme', 'Harbor PEO', 'Dana P.', 'DANA@harbor.example'), 1), '{', 'the firm adds the profile''s person as its own');
  c := pg_temp.got('ada', 'acme-brokers', format('SELECT public.peo_send_context(%L, %L)::text', pg_temp.id('peo_intake'), 'harbor peo'))::jsonb -> 'contacts';
  PERFORM pg_temp.is(c, '[{"name": "Lee Ortiz", "role": null, "email": "lee@harbor.example", "own": true}, {"name": "Dana P.", "role": null, "email": "dana@harbor.example", "own": true}]'::jsonb,
    'the firm''s own two, in the order added, the profile''s person once and as the firm names them');
  PERFORM pg_temp.is(left(pg_temp.got('gus', 'acme-brokers', format('SELECT public.remove_firm_market_contact(%L, %L)::text',
    pg_temp.id('acme'), (SELECT id FROM public.firm_market_contacts WHERE email = 'dana@harbor.example'))), 6), '', 'the agent removes one');
  c := pg_temp.got('ada', 'acme-brokers', format('SELECT public.peo_send_context(%L, %L)::text', pg_temp.id('peo_intake'), 'Harbor PEO'))::jsonb -> 'contacts';
  PERFORM pg_temp.is(c, '[{"name": "Lee Ortiz", "role": null, "email": "lee@harbor.example", "own": true}, {"name": "Dana Platt", "role": "Underwriting", "email": "dana@harbor.example", "own": false}]'::jsonb,
    'then the firm''s own first and the profile''s person after');
  -- A market with no published profile has the firm's own contacts to send to.
  c := pg_temp.got('ada', 'acme-brokers', format('SELECT public.peo_send_context(%L, %L)::text', pg_temp.id('wc_intake'), 'Granite Ridge Mutual'))::jsonb -> 'contacts';
  PERFORM pg_temp.is(jsonb_array_length(c), 10, 'a carrier with no profile in use offers the firm''s ten');
  RAISE NOTICE 'sendable: 5 passed';
END $$;

-- =====================================================================================================================================================
-- Asking for a market that isn't listed (BR-1.4)
-- =====================================================================================================================================================

CREATE FUNCTION pg_temp.ask(who text, addr text, firm text, p_name text, p_line text DEFAULT 'peo') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, addr, format('SELECT public.request_market(%L, %L, %L, %L, %L, %L)::text', pg_temp.id(firm), p_name, p_line, 'Sam Cole', 'sam@summit.example', 'We place three groups a year with them.'))
$$;

-- ---------- 6. A member asks for a PEO or carrier that isn't listed; their firm reads the request, a platform admin reads it with the firm's name, nobody else ----------
-- Catches: a request that reaches nobody, or one firm reading which markets another is asking for.
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.ask('gus', 'acme-brokers', 'acme', '  Summit PEO ');
  PERFORM pg_temp.is(CASE WHEN left(v, 1) = '{' THEN v::jsonb ->> 'status' ELSE v END, 'open', 'the request is open');
  v := pg_temp.got('ada', 'acme-brokers', format('SELECT public.firm_market_requests(%L)::text', pg_temp.id('acme')));
  PERFORM pg_temp.is(v::jsonb -> 0 ->> 'name', 'Summit PEO', 'the founder reads it, its name trimmed: ' || v);
  PERFORM pg_temp.is(v::jsonb -> 0 ->> 'contact_email', 'sam@summit.example', 'with the contact given');
  PERFORM pg_temp.is(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.firm_market_requests(%L)::text', pg_temp.id('zenith'))), '[]', 'the other firm reads none');
  PERFORM pg_temp.is(left(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.firm_market_requests(%L)::text', pg_temp.id('acme'))), 6), '42501:', 'and not the first firm''s');
  v := pg_temp.got('platform_admin', NULL, 'SELECT public.admin_market_requests()::text');
  PERFORM pg_temp.is(v::jsonb -> 0 ->> 'firm_name', 'Acme Brokers', 'a platform admin reads it with the firm''s name: ' || v);
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', 'SELECT public.admin_market_requests()::text'), 6), '42501:', 'a firm''s owner does not read every firm''s');
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', 'SELECT count(*)::text FROM public.market_requests'), 6), '42501:', 'no member reads the table itself');
  RAISE NOTICE 'sendable: 6 passed';
END $$;

-- ---------- 7. A request names a market of one line that isn't listed already, once while it is open ----------
-- Catches: an admin's list filled with markets already there, or the same ask twenty times.
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.ask('gus', 'acme-brokers', 'acme', '   '), '22023: Name the PEO or carrier, in 1 to 80 characters', 'no name');
  PERFORM pg_temp.is(pg_temp.ask('gus', 'acme-brokers', 'acme', 'Somewhere Auto', 'commercial_auto'), '22023: Say whether it quotes PEO or workers'' comp', 'a line nobody quotes');
  PERFORM pg_temp.is(pg_temp.ask('gus', 'acme-brokers', 'acme', 'harbor peo'), '22023: Harbor PEO is already listed', 'a PEO already listed, in another case');
  PERFORM pg_temp.is(pg_temp.ask('ada', 'acme-brokers', 'acme', 'SUMMIT PEO'), '22023: Your firm has already asked for Summit PEO', 'the same ask while the first is open');
  -- A name a carrier holds is not a PEO already listed: the PEO of that name can be asked for.
  PERFORM pg_temp.is(left(pg_temp.ask('gus', 'acme-brokers', 'acme', 'Granite Ridge Mutual', 'peo'), 1), '{', 'a PEO under a name only a carrier holds');
  PERFORM pg_temp.is(pg_temp.got('gus', 'acme-brokers', format('SELECT public.request_market(%L, %L, %L, NULL, %L, NULL)::text', pg_temp.id('acme'), 'Ridge PEO', 'peo', 'nope')),
    '22023: Their email must be an email address', 'a contact address that is no address');
  PERFORM pg_temp.is((SELECT count(*) FROM public.market_requests), 2::bigint, 'two requests are kept');
  RAISE NOTICE 'sendable: 7 passed';
END $$;

-- ---------- 8. A platform admin answers a request once: listed, naming the market, or not, in words; the firm reads the answer ----------
-- Catches: a request answered "listed" with nothing to send to, declined with no reason, or answered by someone who is no admin.
DO $$
DECLARE rid bigint := (SELECT id FROM public.market_requests WHERE name = 'Summit PEO'); other bigint := (SELECT id FROM public.market_requests WHERE name = 'Granite Ridge Mutual'); v text;
BEGIN
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', format('SELECT public.admin_answer_market_request(%L, false, %L, NULL)::text', rid, 'No')), 6), '42501:', 'a firm''s owner can''t answer');
  PERFORM pg_temp.is(pg_temp.got('platform_admin', NULL, format('SELECT public.admin_answer_market_request(%L, true, NULL, NULL)::text', rid)),
    '22023: Say which listed PEO or carrier this request is now', 'listed, with no market named');
  PERFORM pg_temp.is(pg_temp.got('platform_admin', NULL, format('SELECT public.admin_answer_market_request(%L, true, NULL, %L)::text', rid, pg_temp.market('Granite Ridge Mutual'))),
    '22023: Say which listed PEO or carrier this request is now', 'listed, as a market of another line');
  PERFORM pg_temp.is(pg_temp.got('platform_admin', NULL, format('SELECT public.admin_answer_market_request(%L, false, %L, NULL)::text', other, '  ')),
    '22023: Say why, in up to 500 characters', 'declined with no reason');
  PERFORM pg_temp.as_user('platform_admin'); PERFORM public.admin_add_peo('Summit PEO'); PERFORM pg_temp.as_owner();
  PERFORM pg_temp.is(pg_temp.got('platform_admin', NULL, format('SELECT public.admin_answer_market_request(%L, true, %L, %L)::text', rid, 'Listed today.', pg_temp.market('Summit PEO'))), '', 'listed');
  PERFORM pg_temp.is(pg_temp.got('platform_admin', NULL, format('SELECT public.admin_answer_market_request(%L, false, %L, NULL)::text', other, 'A carrier, not a PEO: it is listed under workers'' comp.')), '', 'declined');
  PERFORM pg_temp.is(left(pg_temp.got('platform_admin', NULL, format('SELECT public.admin_answer_market_request(%L, false, %L, NULL)::text', rid, 'Again')), 6), '55000:', 'a second answer');
  PERFORM pg_temp.is(left(pg_temp.got('platform_admin', NULL, 'SELECT public.admin_answer_market_request(987654, false, ''No'', NULL)::text'), 6), 'PT404:', 'a request that is not there');
  v := pg_temp.got('gus', 'acme-brokers', format('SELECT public.firm_market_requests(%L)::text', pg_temp.id('acme')));
  PERFORM pg_temp.is((SELECT string_agg((r ->> 'name') || ': ' || (r ->> 'status') || ', ' || (r ->> 'answer'), '; ' ORDER BY r ->> 'name') FROM jsonb_array_elements(v::jsonb) r),
    'Granite Ridge Mutual: declined, A carrier, not a PEO: it is listed under workers'' comp.; Summit PEO: listed, Listed today.', 'the firm reads both answers');
  -- Answered, the same market can be asked for again (a declined one, later).
  PERFORM pg_temp.is(left(pg_temp.ask('gus', 'acme-brokers', 'acme', 'Granite Ridge Mutual', 'peo'), 1), '{', 'a declined ask can be made again');
  RAISE NOTICE 'sendable: 8 passed';
END $$;

-- =====================================================================================================================================================
-- The firm's licences on record (BR-2.2)
-- =====================================================================================================================================================

CREATE FUNCTION pg_temp.licence(who text, firm text, p_state text, p_line text, p_expires text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, 'acme-brokers', format('SELECT public.add_firm_licence(%L, %L, %L, %L, %L)::text', pg_temp.id(firm), p_state, p_line, 'L-100', p_expires))
$$;
CREATE FUNCTION pg_temp.record(who text, addr text, firm text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, addr, format('SELECT public.firm_licence_record(%L)::text', pg_temp.id(firm)))
$$;

-- ---------- 9. With no property and casualty licence on record, a firm's send to a carrier is refused and records nothing; its send to a PEO goes ----------
-- Catches: a firm with no P&C licence sending a workers' comp submission to a carrier under Nevermore's name (ADR 0029, D-21).
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.send('wc_intake', 'Granite Ridge Mutual');
  PERFORM pg_temp.is(v, '42501: Your firm has no property and casualty licence on record. An owner adds it in Settings, under Licences, before anything is sent to a carrier.', 'the send to a carrier');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_requests WHERE session_id = pg_temp.id('wc_intake')), 0::bigint, 'no quote request is made');
  PERFORM pg_temp.is((SELECT status FROM public.submission_workflow WHERE session_id = pg_temp.id('wc_intake')), 'ready_for_market', 'and the search has not moved');
  v := pg_temp.send('peo_intake', 'Harbor PEO');
  PERFORM pg_temp.is(left(v, 1), '{', 'the send to a PEO goes with no licence on record: ' || v);
  RAISE NOTICE 'sendable: 9 passed';
END $$;

-- ---------- 10. Only an owner keeps the firm's producer number and licences; every member of the firm reads them, and no other firm ----------
-- Catches: an agent recording a licence the firm doesn't hold, or another firm reading where this one is licensed.
DO $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.is(left(pg_temp.licence('gus', 'acme', 'TX', 'property_casualty'), 6), '42501:', 'an agent adds a licence');
  PERFORM pg_temp.is(left(pg_temp.got('gus', 'acme-brokers', format('SELECT public.set_firm_npn(%L, %L)::text', pg_temp.id('acme'), '1234567')), 6), '42501:', 'an agent sets the number');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.set_firm_npn(%L, %L)::text', pg_temp.id('acme'), ' 1234567 ')), '', 'the owner sets the number');
  PERFORM pg_temp.is(left(pg_temp.licence('ada', 'acme', 'tx', 'life_health', '2027-06-30'), 1), '{', 'the owner adds a life and health licence');
  v := pg_temp.record('gus', 'acme-brokers', 'acme');
  PERFORM pg_temp.is(v::jsonb ->> 'npn', '1234567', 'the agent reads the number: ' || v);
  PERFORM pg_temp.is(v::jsonb -> 'licences' -> 0 ->> 'state', 'TX', 'and the licence, its state in capitals');
  PERFORM pg_temp.is(v::jsonb ->> 'can_change', 'false', 'and is told they can''t change it');
  PERFORM pg_temp.is(pg_temp.record('ada', 'acme-brokers', 'acme')::jsonb ->> 'can_change', 'true', 'the owner is told they can');
  PERFORM pg_temp.is(left(pg_temp.record('zed', 'zenith-benefits', 'acme'), 6), '42501:', 'another firm can''t read it');
  PERFORM pg_temp.is(pg_temp.record('zed', 'zenith-benefits', 'zenith')::jsonb, '{"npn": null, "licences": [], "checked_at": null, "changed_since_check": false, "can_change": true}'::jsonb, 'whose own record is empty');
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', 'SELECT count(*)::text FROM public.firm_licences'), 6), '42501:', 'no member reads the table itself');
  RAISE NOTICE 'sendable: 10 passed';
END $$;

-- ---------- 11. A licence is of a state and one of two lines, once; a producer number is digits ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.licence('ada', 'acme', 'Texas', 'property_casualty'), '22023: Give the state as its two letters, like TX', 'a state spelled out');
  PERFORM pg_temp.is(pg_temp.licence('ada', 'acme', 'TX', 'surplus_lines'), '22023: A licence is life and health, or property and casualty', 'a line that is neither');
  PERFORM pg_temp.is(pg_temp.licence('ada', 'acme', 'TX', 'life_health'), '22023: That licence is already on record. Remove it to change it.', 'the same state and line again');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.set_firm_npn(%L, %L)::text', pg_temp.id('acme'), '12AB')), '22023: A National Producer Number is up to 10 digits', 'a number with letters');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_licences), 1::bigint, 'one licence is kept');
  RAISE NOTICE 'sendable: 11 passed';
END $$;

-- ---------- 12. A send to a carrier needs a property and casualty licence that has not expired; then it goes ----------
-- Catches: a life and health licence, or a lapsed one, read as leave to send to a carrier.
DO $$
DECLARE v text; lid bigint;
BEGIN
  PERFORM pg_temp.is(left(pg_temp.send('wc_intake', 'Granite Ridge Mutual'), 6), '42501:', 'with a life and health licence alone');
  PERFORM pg_temp.is(left(pg_temp.licence('ada', 'acme', 'TX', 'property_casualty', (current_date - 1)::text), 1), '{', 'a lapsed one is on record');
  PERFORM pg_temp.is(left(pg_temp.send('wc_intake', 'Granite Ridge Mutual'), 6), '42501:', 'with a lapsed property and casualty licence');
  SELECT id INTO lid FROM public.firm_licences WHERE line = 'property_casualty';
  PERFORM pg_temp.is(left(pg_temp.got('gus', 'acme-brokers', format('SELECT public.remove_firm_licence(%L, %L)::text', pg_temp.id('acme'), lid)), 6), '42501:', 'an agent can''t remove it');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.remove_firm_licence(%L, %L)::text', pg_temp.id('acme'), lid)), '', 'the owner removes it');
  PERFORM pg_temp.is(left(pg_temp.licence('ada', 'acme', 'TX', 'property_casualty', current_date::text), 1), '{', 'one that runs to today');
  v := pg_temp.send('wc_intake', 'Granite Ridge Mutual');
  PERFORM pg_temp.is(left(v, 1), '{', 'the send to the carrier goes: ' || v);
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE session_id = pg_temp.id('wc_intake') AND peo_name = 'Granite Ridge Mutual'), 'sent', 'its quote request is Sent');
  RAISE NOTICE 'sendable: 12 passed';
END $$;

-- ---------- 13. A platform admin reads a firm's licences and records that they were checked; a change after that says so ----------
-- Catches: a firm approved on licences nobody looked at, or a licence swapped after the check with the check still standing.
DO $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', format('SELECT public.admin_firm_licence_record(%L)::text', pg_temp.id('zenith'))), 6), '42501:', 'a firm''s owner reads no other firm''s through the admin''s read');
  v := pg_temp.got('platform_admin', NULL, format('SELECT public.admin_firm_licence_record(%L)::text', pg_temp.id('acme')));
  PERFORM pg_temp.is(v::jsonb ->> 'npn', '1234567', 'the admin reads the number: ' || v);
  PERFORM pg_temp.is(jsonb_array_length(v::jsonb -> 'licences'), 2, 'and both licences');
  PERFORM pg_temp.is(v::jsonb ->> 'checked_at', NULL, 'not yet checked');
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', format('SELECT public.admin_record_licence_check(%L)::text', pg_temp.id('acme'))), 6), '42501:', 'an owner can''t record the check');
  PERFORM pg_temp.is(pg_temp.got('platform_admin', NULL, format('SELECT public.admin_record_licence_check(%L)::text', pg_temp.id('acme'))), '', 'the admin records it');
  v := pg_temp.record('ada', 'acme-brokers', 'acme');
  PERFORM pg_temp.is((v::jsonb ->> 'checked_at') IS NOT NULL, true, 'the firm reads that it was checked');
  PERFORM pg_temp.is(v::jsonb ->> 'changed_since_check', 'false', 'and nothing has changed since');
  PERFORM pg_temp.is(left(pg_temp.licence('ada', 'acme', 'OK', 'property_casualty'), 1), '{', 'the owner adds another state');
  PERFORM pg_temp.is(pg_temp.got('platform_admin', NULL, format('SELECT public.admin_firm_licence_record(%L)::text', pg_temp.id('acme')))::jsonb ->> 'changed_since_check', 'true', 'the admin reads that it changed since');
  PERFORM pg_temp.is(left(pg_temp.got('platform_admin', NULL, format('SELECT public.admin_record_licence_check(%L)::text', gen_random_uuid())), 6), 'PT404:', 'a firm that is not there');
  RAISE NOTICE 'sendable: 13 passed';
END $$;

-- ---------- 14. Closing a firm deletes its contacts at markets, its requests and its licences ----------
-- Catches: a closed firm's contacts and licence numbers kept with nobody left to read them (ADR 0023).
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT string_agg(p.src, ', ' ORDER BY p.src) FROM public.firm_closing_plan() p
                      WHERE p.action = 'delete' AND p.firm_column = 'firm_id' AND p.src IN ('public.firm_market_contacts', 'public.market_requests', 'public.firm_licences', 'public.firm_licence_records')),
    'public.firm_licence_records, public.firm_licences, public.firm_market_contacts, public.market_requests', 'the closing plan deletes all four');
  RAISE NOTICE 'sendable: 14 passed';
END $$;

\echo sendable: all passed
