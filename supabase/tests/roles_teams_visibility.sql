-- Run against a scratch Postgres as the superuser `postgres`, never one you care about:
--   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh roles_teams_visibility
-- An owner changes a member's role and team, keeps the firm's teams, and sets who sees what (CRM-X1.1; docs/BROKER_READINESS_PRD.md BR-5.3;
-- docs/BROKER_CRM_BUILD.md "## Roles, teams and visibility", D-2320 to D-2339; 20261201090000_roles_teams_visibility.sql). Two firms.
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
\i supabase/migrations/20261201090000_roles_teams_visibility.sql
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



-- ---------- set up: Acme's founder Ada (owner), Lea and Gus (agents); a lead of Gus's ----------
DO $$
BEGIN
  PERFORM pg_temp.new_user('lea'); PERFORM pg_temp.new_user('gus');
  INSERT INTO public.firm_memberships (firm_id, user_id, role) VALUES (pg_temp.id('acme'), pg_temp.id('lea'), 'agent'), (pg_temp.id('acme'), pg_temp.id('gus'), 'agent');
  INSERT INTO public.leads (firm_id, owner_id, name, source, status) VALUES (pg_temp.id('acme'), pg_temp.id('gus'), 'Gus''s Lead', 'added_by_hand', 'new');
  INSERT INTO public.broker_mailboxes (user_id, provider, address, scope, token_ciphertext, token_iv)
  VALUES (pg_temp.id('gus'), 'google', 'gus@acme.example', 'https://www.googleapis.com/auth/gmail.send', 'sealed', 'iv');
END $$;

CREATE FUNCTION pg_temp.team(who text, firm text, p_id uuid, p_name text, p_parent uuid DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, 'acme-brokers', format('SELECT public.save_team(%L, %L, %L, %L)::text', pg_temp.id(firm), p_id, p_name, p_parent))
$$;
CREATE FUNCTION pg_temp.change(who text, addr text, firm text, member text, p_role text, p_team uuid) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.got(who, addr, format('SELECT public.change_member(%L, %L, %L, %L)::text', pg_temp.id(firm), pg_temp.id(member), p_role, p_team))
$$;
-- A person's current membership of Acme, as "role/team name".
CREATE FUNCTION pg_temp.now_is(member text) RETURNS text LANGUAGE sql AS $$
  SELECT m.role || '/' || COALESCE(t.name, 'no team') FROM public.firm_memberships m LEFT JOIN public.firm_teams t ON t.id = m.team_id
  WHERE m.firm_id = pg_temp.id('acme') AND m.user_id = pg_temp.id(member) AND public.membership_is_current(m.valid_from, m.valid_until)
$$;

-- ---------- 1. An owner makes teams, one inside another, and renames one; a name is used once; a team can't sit under itself ----------
DO $$
DECLARE v text; east uuid; austin uuid;
BEGIN
  v := pg_temp.team('ada', 'acme', NULL, '  East  ');
  PERFORM pg_temp.is(v ~ '^[0-9a-f-]{36}$', true, 'a team is made: ' || v);
  east := v::uuid; INSERT INTO fx VALUES ('east', east);
  v := pg_temp.team('ada', 'acme', NULL, 'Austin', east); austin := v::uuid; INSERT INTO fx VALUES ('austin', austin);
  PERFORM pg_temp.is((SELECT name || '<' || (SELECT p.name FROM public.firm_teams p WHERE p.id = t.parent_team_id) FROM public.firm_teams t WHERE t.id = austin), 'Austin<East', 'one inside another, the first''s name trimmed');
  PERFORM pg_temp.is(pg_temp.team('ada', 'acme', NULL, 'east'), '22023: Your firm already has a team called East', 'the same name, in another case');
  PERFORM pg_temp.is(pg_temp.team('ada', 'acme', NULL, '   '), '22023: A team has a name of 1 to 80 characters', 'no name');
  PERFORM pg_temp.is(pg_temp.team('ada', 'acme', east, 'East', austin), '22023: A team can''t sit under itself or under a team inside it', 'a team put under its own child');
  PERFORM pg_temp.is(pg_temp.team('ada', 'acme', austin, 'Austin office', east), austin::text, 'renamed, keeping its place');
  PERFORM pg_temp.is((SELECT name FROM public.firm_teams WHERE id = austin), 'Austin office', 'the new name');
  PERFORM pg_temp.is(left(pg_temp.team('gus', 'acme', NULL, 'Mine'), 6), '42501:', 'an agent makes no team');
  PERFORM pg_temp.is(left(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.save_team(%L, %L, %L, NULL)::text', pg_temp.id('zenith'), east, 'Theirs')), 6), 'PT404:', 'another firm''s owner can''t rename it as their own');
  RAISE NOTICE 'roles_teams_visibility: 1 passed';
END $$;

-- ---------- 2. An owner changes a member's role and team: the old membership ends, a new one begins, and their mailbox is kept ----------
-- Catches: a membership overwritten (so who could see what on a past day can't be answered), or a role change that disconnects the person's mailbox.
DO $$
DECLARE n bigint;
BEGIN
  PERFORM pg_temp.is(pg_temp.change('ada', 'acme-brokers', 'acme', 'lea', 'lead', pg_temp.id('east')), '', 'an agent is made a lead of East');
  PERFORM pg_temp.is(pg_temp.now_is('lea'), 'lead/East', 'which is what they now are');
  SELECT count(*) INTO n FROM public.firm_memberships WHERE firm_id = pg_temp.id('acme') AND user_id = pg_temp.id('lea');
  PERFORM pg_temp.is(n, 2::bigint, 'the membership they had is kept, ended');
  PERFORM pg_temp.is((SELECT role || '/' || (valid_until IS NOT NULL) FROM public.firm_memberships WHERE firm_id = pg_temp.id('acme') AND user_id = pg_temp.id('lea') ORDER BY valid_from, id LIMIT 1), 'agent/true', 'as the agent they were');
  PERFORM pg_temp.is(pg_temp.change('ada', 'acme-brokers', 'acme', 'gus', 'agent', pg_temp.id('austin')), '', 'an agent is put in a team, their role as it was');
  PERFORM pg_temp.is(pg_temp.now_is('gus'), 'agent/Austin office', 'in the team');
  PERFORM pg_temp.is((SELECT count(*) FROM public.broker_mailboxes WHERE user_id = pg_temp.id('gus')), 1::bigint, 'and their mailbox is still connected');
  PERFORM pg_temp.is(pg_temp.change('ada', 'acme-brokers', 'acme', 'gus', 'agent', pg_temp.id('austin')), '', 'the same again is no change');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_memberships WHERE firm_id = pg_temp.id('acme') AND user_id = pg_temp.id('gus')), 2::bigint, 'and adds no membership');
  RAISE NOTICE 'roles_teams_visibility: 2 passed';
END $$;

-- ---------- 3. The change is what the level rule goes by: a lead sees the work of the people in their team and the teams inside it ----------
-- Catches: a team set on the screen that changes nothing about who sees what.
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.got('lea', 'acme-brokers', format('SELECT public.home_page(%L, %L)::text', pg_temp.id('acme'), 'team'));
  PERFORM pg_temp.is((v::jsonb ->> 'whose') || '/' || (v::jsonb -> 'counts' ->> 'open_leads'), 'team/1', 'the lead of East reads the lead of an agent in a team inside East: ' || left(v, 120));
  PERFORM pg_temp.is(pg_temp.change('ada', 'acme-brokers', 'acme', 'gus', 'agent', NULL), '', 'the agent is taken out of the team');
  v := pg_temp.got('lea', 'acme-brokers', format('SELECT public.home_page(%L, %L)::text', pg_temp.id('acme'), 'team'));
  PERFORM pg_temp.is(v::jsonb -> 'counts' ->> 'open_leads', '0', 'and the lead no longer reads it');
  PERFORM pg_temp.is(pg_temp.change('ada', 'acme-brokers', 'acme', 'gus', 'agent', pg_temp.id('austin')), '', 'and put back');
  RAISE NOTICE 'roles_teams_visibility: 3 passed';
END $$;

-- ---------- 4. Only an owner changes a member, of their own firm, to a role and a team that exist; the firm keeps an owner ----------
DO $$
BEGIN
  PERFORM pg_temp.is(left(pg_temp.change('lea', 'acme-brokers', 'acme', 'gus', 'lead', NULL), 6), '42501:', 'a lead');
  PERFORM pg_temp.is(left(pg_temp.change('zed', 'zenith-benefits', 'acme', 'gus', 'owner', NULL), 6), '42501:', 'another firm''s owner');
  PERFORM pg_temp.is(pg_temp.change('ada', 'acme-brokers', 'acme', 'zed', 'agent', NULL), 'PT404: That person is not a member of this firm', 'someone who is no member');
  PERFORM pg_temp.is(pg_temp.change('ada', 'acme-brokers', 'acme', 'gus', 'manager', NULL), '22023: A member is an owner, a lead or an agent', 'a role that is none of the three');
  PERFORM pg_temp.is(pg_temp.change('ada', 'acme-brokers', 'acme', 'gus', 'agent', gen_random_uuid()), '22023: That team isn''t one of this firm''s', 'a team that is not the firm''s');
  PERFORM pg_temp.is(pg_temp.change('ada', 'acme-brokers', 'acme', 'ada', 'agent', NULL), '23514: A firm keeps at least one owner. Make someone else an owner first.', 'the only owner made an agent');
  PERFORM pg_temp.is(pg_temp.now_is('ada') || ', ' || pg_temp.now_is('gus'), 'owner/no team, agent/Austin office', 'and nothing refused changed anything');
  PERFORM pg_temp.is(pg_temp.change('ada', 'acme-brokers', 'acme', 'gus', 'owner', NULL), '', 'a second owner is made');
  PERFORM pg_temp.is(pg_temp.change('gus', 'acme-brokers', 'acme', 'ada', 'agent', NULL), '', 'and then the first can be made an agent');
  PERFORM pg_temp.is(pg_temp.now_is('ada') || ', ' || pg_temp.now_is('gus'), 'agent/no team, owner/no team', 'as they now are');
  PERFORM pg_temp.is(pg_temp.change('gus', 'acme-brokers', 'acme', 'ada', 'owner', NULL), '', 'and an owner again');
  RAISE NOTICE 'roles_teams_visibility: 4 passed';
END $$;

-- ---------- 5. A team nobody has belonged to can be deleted; one that people have belonged to, or that holds another, stays ----------
DO $$
DECLARE spare uuid := pg_temp.team('ada', 'acme', NULL, 'Spare')::uuid;
BEGIN
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.delete_team(%L, %L)::text', pg_temp.id('acme'), spare)), '', 'an unused team is deleted');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.delete_team(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('east'))),
    '55000: East holds another team. Move or delete that one first.', 'a team that holds another');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', format('SELECT public.delete_team(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('austin'))),
    '55000: People have belonged to Austin office, so it stays as the record of who was in it. Rename it, or move its people out.', 'a team people have belonged to');
  PERFORM pg_temp.is(left(pg_temp.got('gus', 'zenith-benefits', format('SELECT public.delete_team(%L, %L)::text', pg_temp.id('acme'), pg_temp.id('east'))), 6), '42501:', 'at another firm''s address');
  PERFORM pg_temp.is((SELECT count(*) FROM public.firm_teams WHERE firm_id = pg_temp.id('acme')), 2::bigint, 'two teams remain');
  RAISE NOTICE 'roles_teams_visibility: 5 passed';
END $$;

-- ---------- 6. An owner sets whether everyone in the firm sees every record, or each person their own and a lead their team's ----------
DO $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', 'SELECT count(*)::text FROM public.leads'), '1', 'by level, an owner reads the lead');
  PERFORM pg_temp.change('gus', 'acme-brokers', 'acme', 'ada', 'agent', NULL);
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', 'SELECT count(*)::text FROM public.leads'), '0', 'and as an agent, not their colleague''s');
  PERFORM pg_temp.is(left(pg_temp.got('ada', 'acme-brokers', format('SELECT public.set_firm_visibility(%L, %L)::text', pg_temp.id('acme'), 'everyone')), 6), '42501:', 'an agent can''t change the setting');
  PERFORM pg_temp.is(pg_temp.got('gus', 'acme-brokers', format('SELECT public.set_firm_visibility(%L, %L)::text', pg_temp.id('acme'), 'anyone')), '22023: Everyone sees everything, or each person sees their own and a lead their team''s', 'a setting that is neither');
  PERFORM pg_temp.is(pg_temp.got('gus', 'acme-brokers', format('SELECT public.set_firm_visibility(%L, %L)::text', pg_temp.id('acme'), 'everyone')), '', 'an owner sets everyone');
  PERFORM pg_temp.is(pg_temp.got('ada', 'acme-brokers', 'SELECT count(*)::text FROM public.leads'), '1', 'and the agent reads their colleague''s lead');
  PERFORM pg_temp.is(pg_temp.got('zed', 'zenith-benefits', 'SELECT count(*)::text FROM public.leads'), '0', 'but another firm reads none of it');
  PERFORM pg_temp.is(pg_temp.got('gus', 'acme-brokers', format('SELECT public.set_firm_visibility(%L, %L)::text', pg_temp.id('acme'), 'by_level')), '', 'and back');
  PERFORM pg_temp.change('gus', 'acme-brokers', 'acme', 'ada', 'owner', NULL);
  RAISE NOTICE 'roles_teams_visibility: 6 passed';
END $$;

-- ---------- 7. An owner reads the firm's teams, who is in each, and the setting; nobody else does ----------
DO $$
DECLARE v text;
BEGIN
  v := pg_temp.got('ada', 'acme-brokers', format('SELECT public.firm_teams_page(%L)::text', pg_temp.id('acme')));
  PERFORM pg_temp.is(v::jsonb ->> 'visibility', 'by_level', 'the setting: ' || left(v, 200));
  PERFORM pg_temp.is((SELECT string_agg((t ->> 'name') || ':' || (t ->> 'members') || ':' || COALESCE(t ->> 'parent_name', '-') || ':' || (t ->> 'can_delete'), ', ' ORDER BY t ->> 'name') FROM jsonb_array_elements(v::jsonb -> 'teams') t),
    'Austin office:0:East:false, East:1:-:false', 'each team with how many are in it now, what it sits in, and whether it can be deleted');
  PERFORM pg_temp.is((SELECT string_agg((m ->> 'email') || '=' || (m ->> 'role') || '/' || COALESCE(m ->> 'team_name', '-'), ', ' ORDER BY m ->> 'email') FROM jsonb_array_elements(v::jsonb -> 'members') m),
    'ada@example.test=owner/-, gus@example.test=owner/-, lea@example.test=lead/East', 'each member with their role and team');
  PERFORM pg_temp.is(left(pg_temp.got('lea', 'acme-brokers', format('SELECT public.firm_teams_page(%L)::text', pg_temp.id('acme'))), 6), '42501:', 'a lead does not read it');
  PERFORM pg_temp.is(left(pg_temp.got('zed', 'zenith-benefits', format('SELECT public.firm_teams_page(%L)::text', pg_temp.id('acme'))), 6), '42501:', 'nor another firm''s owner');
  RAISE NOTICE 'roles_teams_visibility: 7 passed';
END $$;

\echo roles_teams_visibility: all passed
