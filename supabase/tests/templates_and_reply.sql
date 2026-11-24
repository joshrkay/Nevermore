-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh templates_and_reply
-- A firm's own opening text for its messages, and a plain reply on a PEO's thread (BR-3.5, BR-3.4; P-3.2, M-3.5; docs/BROKER_CRM_BUILD.md "## Templates and
-- replies"; 20261203090000_templates_and_reply.sql). Two firms. Every migration is loaded, in filename order (D-105), this story's last.
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



-- ---------- set up: Acme's founder Ada (owner, with a mailbox) and Gus (an agent, with none); an intake sent to Harbor PEO ----------
DO $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.new_user('gus'); PERFORM pg_temp.new_user('pat');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('gus'), 'agent');
  PERFORM pg_temp.as_user('platform_admin'); PERFORM public.admin_add_peo('Harbor PEO'); PERFORM public.admin_add_peo('Quiet PEO'); PERFORM pg_temp.as_owner();
  v := pg_temp.opportunity('opp', 'A search');
  v := pg_temp.start_intake('intake', 'opp');
  UPDATE public.chamber_sessions SET user_id = pg_temp.id('pat') WHERE id = pg_temp.id('intake');
  PERFORM pg_temp.is((pg_temp.authorize('pat', 'intake', 'Harbor PEO')::jsonb ->> 'authorized'), 'true', 'set up: Harbor PEO is authorized');
  PERFORM pg_temp.is((pg_temp.authorize('pat', 'intake', 'Quiet PEO')::jsonb ->> 'authorized'), 'true', 'set up: Quiet PEO is authorized');
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (pg_temp.id('ada'), 'google', 'ada@acme.example', 'https://www.googleapis.com/auth/gmail.send', 'sealed', 'iv');
  PERFORM pg_temp.make_ready('intake', 'Reyes Bakery', 'EAA-2026-0301');
  PERFORM pg_temp.is(left(pg_temp.send('intake', 'Harbor PEO'), 1), '{', 'set up: sent to Harbor PEO');
  -- A quote request recorded by hand for Quiet PEO: the product sent it nothing.
  INSERT INTO public.quote_requests (session_id, peo_name, status) VALUES (pg_temp.id('intake'), 'Quiet PEO', 'sent');
END $$;

CREATE FUNCTION pg_temp.qr(market text) RETURNS bigint LANGUAGE sql AS $$ SELECT id FROM public.quote_requests WHERE session_id = pg_temp.id('intake') AND peo_name = market $$;
CREATE FUNCTION pg_temp.reply(who text, addr text, market text, p_note text DEFAULT 'Thanks, Dana. The census is the one certified on the 3rd.') RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, addr, format('SELECT public.reply_to_peo(%L, ARRAY[%L], %L, %L)::text', pg_temp.qr(market), 'dana@harbor.example', 'Re: Reyes Bakery: EAA-2026-0301, version 1', p_note))
$$;
CREATE FUNCTION pg_temp.tpl(who text, addr text, firm text, kind text, body text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, addr, format('SELECT public.set_firm_message_template(%L, %L, %L)::text', pg_temp.id(firm), kind, body))
$$;

-- ---------- 1. An owner sets the firm's opening text for a kind of message; every member reads it; clearing it puts the product's own back ----------
DO $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.is(pg_temp.got('gus', 'acme-brokers', format('SELECT public.firm_message_templates(%L)::text', pg_temp.id('acme'))), '{}', 'a firm with none of its own');
  PERFORM pg_temp.is(pg_temp.tpl('ada', 'acme-brokers', 'acme', 'follow_up', E'  Hi,\n\nChecking in on {company}.  \n'), '', 'the owner sets the follow-up''s');
  v := pg_temp.got('gus', 'acme-brokers', format('SELECT public.firm_message_templates(%L)::text', pg_temp.id('acme')));
  PERFORM pg_temp.is(v::jsonb, jsonb_build_object('follow_up', E'Hi,\n\nChecking in on {company}.'), 'an agent reads it, trimmed, and only the kind that was set: ' || v);
  PERFORM pg_temp.is(pg_temp.tpl('ada', 'acme-brokers', 'acme', 'follow_up', 'Hello again.'), '', 'set again');
  PERFORM pg_temp.is((SELECT count(*) || ':' || max(body) FROM public.firm_message_templates WHERE firm_id = pg_temp.id('acme')), '1:Hello again.', 'it replaces the one before');
  PERFORM pg_temp.is(pg_temp.tpl('ada', 'acme-brokers', 'acme', 'follow_up', '   '), '', 'cleared');
  PERFORM pg_temp.is(pg_temp.got('gus', 'acme-brokers', format('SELECT public.firm_message_templates(%L)::text', pg_temp.id('acme'))), '{}', 'and the firm has none of its own again');
  RAISE NOTICE 'templates_and_reply: 1 passed';
END $$;

-- ---------- 2. Only an owner sets one, of a kind that exists, within its length; another firm reads and sets none of it ----------
DO $$
BEGIN
  PERFORM pg_temp.tpl('ada', 'acme-brokers', 'acme', 'send', 'Hello, here is a submission for you.');
  PERFORM pg_temp.is(left(pg_temp.tpl('gus', 'acme-brokers', 'acme', 'send', 'Mine'), 6), '42501:', 'an agent');
  PERFORM pg_temp.is(left(pg_temp.tpl('zed', 'zenith-benefits', 'acme', 'send', 'Theirs'), 6), '42501:', 'another firm''s owner');
  PERFORM pg_temp.is(pg_temp.tpl('ada', 'acme-brokers', 'acme', 'newsletter', 'x'), '22023: A template is for a first send, a follow-up or a withdrawal', 'a kind that is none of the three');
  PERFORM pg_temp.is(pg_temp.tpl('ada', 'acme-brokers', 'acme', 'send', repeat('x', 5001)), '22023: A template is at most 5,000 characters', 'too long');
  PERFORM pg_temp.is((SELECT body FROM public.firm_message_templates WHERE firm_id = pg_temp.id('acme') AND kind = 'send'), 'Hello, here is a submission for you.', 'and nothing refused changed it');
  PERFORM pg_temp.is(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.firm_message_templates(%L)::text', pg_temp.id('zenith'))), '{}', 'the other firm has none');
  PERFORM pg_temp.is(left(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.firm_message_templates(%L)::text', pg_temp.id('acme'))), 6), '42501:', 'and can''t read the first firm''s');
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', 'SELECT count(*)::text FROM public.firm_message_templates'), 6), '42501:', 'nobody reads the table itself');
  RAISE NOTICE 'templates_and_reply: 2 passed';
END $$;

-- ---------- 3. A reply goes on the PEO's thread from the agent's own mailbox, with no link, and changes nothing else ----------
-- Catches: a reply that starts a new thread, waits for a bundle link that never comes, or moves the quote request's status.
DO $$
DECLARE v text; m public.quote_request_messages; first_id text; e jsonb; links bigint;
BEGIN
  SELECT message_id INTO first_id FROM public.quote_request_messages WHERE quote_request_id = pg_temp.qr('Harbor PEO') ORDER BY id LIMIT 1;
  SELECT count(*) INTO links FROM public.bundle_links;
  v := pg_temp.reply('ada', 'acme-brokers', 'Harbor PEO');
  PERFORM pg_temp.is(left(v, 1), '{', 'the reply is recorded: ' || v);
  SELECT * INTO m FROM public.quote_request_messages WHERE id = (v::jsonb ->> 'message_id')::bigint;
  PERFORM pg_temp.is(m.direction || '|' || m.status || '|' || m.from_address || '|' || array_to_string(m.to_addresses, ','), 'sent|queued|ada@acme.example|dana@harbor.example', 'from the agent''s mailbox to the person named, queued');
  PERFORM pg_temp.is(m.in_reply_to, first_id, 'it answers the message before it on the thread');
  SELECT payload INTO e FROM public.outbox_events WHERE kind = 'peo_message' AND dedupe_key = 'peo_message:' || m.id;
  PERFORM pg_temp.is(e ->> 'without_link', 'true', 'its event goes as written, waiting for no link');
  PERFORM pg_temp.is((SELECT status FROM public.quote_requests WHERE id = pg_temp.qr('Harbor PEO')), 'sent', 'the quote request is as it was');
  PERFORM pg_temp.is((SELECT count(*) FROM public.bundle_links), links, 'and no link was made or revoked');
  RAISE NOTICE 'templates_and_reply: 3 passed';
END $$;

-- ---------- 4. A reply is refused with no mailbox, with nothing to say, on a thread the product never started, on a closed one, and for another firm ----------
DO $$
BEGIN
  PERFORM pg_temp.is(pg_temp.reply('gus', 'acme-brokers', 'Harbor PEO'), 'PT412: Connect your mailbox to send from here.', 'an agent with no mailbox');
  PERFORM pg_temp.is(left(pg_temp.reply('ada', 'acme-brokers', 'Harbor PEO', '   '), 6), '22023:', 'a reply that says nothing');
  PERFORM pg_temp.is(pg_temp.reply('ada', 'acme-brokers', 'Quiet PEO'), '22023: There is no thread with Quiet PEO here yet. Send to it first.', 'a quote request recorded by hand');
  PERFORM pg_temp.is(left(pg_temp.reply('zed', 'zenith-benefits', 'Harbor PEO'), 6), 'PT404:', 'another firm''s owner');
  PERFORM pg_temp.is(left(pg_temp.authorize('pat', 'intake', 'Harbor PEO', false), 1), '{', 'the employer withdraws the PEO');
  PERFORM pg_temp.is(left(pg_temp.reply('ada', 'acme-brokers', 'Harbor PEO'), 6) IN ('22023:', '42501:'), true, 'a PEO the employer no longer authorizes: ' || pg_temp.reply('ada', 'acme-brokers', 'Harbor PEO'));
  PERFORM pg_temp.is(left(pg_temp.authorize('pat', 'intake', 'Harbor PEO'), 1), '{', 'and authorizes it again');
  UPDATE public.quote_requests SET status = 'closed' WHERE id = pg_temp.qr('Harbor PEO');
  PERFORM pg_temp.is(pg_temp.reply('ada', 'acme-brokers', 'Harbor PEO'), '22023: Harbor PEO is closed. Send to it again to write to it.', 'a closed quote request');
  PERFORM pg_temp.is((SELECT count(*) FROM public.quote_request_messages WHERE quote_request_id = pg_temp.qr('Harbor PEO')), 2::bigint, 'and only the send and the one reply are on the thread');
  RAISE NOTICE 'templates_and_reply: 4 passed';
END $$;

-- ---------- 5. Closing a firm deletes its templates ----------
DO $$
BEGIN
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_closing_plan() p WHERE p.action = 'delete' AND p.src = 'public.firm_message_templates'), 1::bigint, 'the closing plan deletes them');
  RAISE NOTICE 'templates_and_reply: 5 passed';
END $$;

\echo templates_and_reply: all passed
